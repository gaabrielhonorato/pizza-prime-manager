import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Clock, CheckCircle,
  Calendar, Search, FileDown,
} from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  C, TABLE_STYLES, loadLetteringDataUrl,
  buildPdfHeader, addPdfFooter, drawSectionTitle,
} from "@/lib/pdf-helpers";

const fmt = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtShort = (v: number) =>
  v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : fmt(v);

interface Pizzaria { id: string; nome: string }
interface Props { cobrancas: any[]; pizzarias: Pizzaria[] }

const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"] as const;
const MONTH_LABELS: Record<string, string> = {
  "01":"Janeiro","02":"Fevereiro","03":"Março","04":"Abril",
  "05":"Maio","06":"Junho","07":"Julho","08":"Agosto",
  "09":"Setembro","10":"Outubro","11":"Novembro","12":"Dezembro",
};

export default function FinanceiroRelatorio({ cobrancas, pizzarias }: Props) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState("todos");
  const [searchPizzaria, setSearchPizzaria] = useState("");
  const [exporting, setExporting] = useState(false);

  const years = useMemo(() => {
    const ys = new Set(cobrancas.map(c => new Date(c.criado_em).getFullYear()));
    ys.add(currentYear);
    return Array.from(ys).sort((a, b) => b - a);
  }, [cobrancas, currentYear]);

  const periodCobrancas = useMemo(() =>
    cobrancas.filter(c => {
      const d = new Date(c.criado_em);
      if (String(d.getFullYear()) !== selectedYear) return false;
      if (selectedMonth !== "todos" &&
          String(d.getMonth() + 1).padStart(2, "0") !== selectedMonth) return false;
      return true;
    }),
  [cobrancas, selectedYear, selectedMonth]);

  const nonCancelled = useMemo(() =>
    periodCobrancas.filter(c => c.status !== "cancelado"),
  [periodCobrancas]);

  // ── KPIs ──────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalFaturado = nonCancelled.reduce((s, c) => s + Number(c.valor_total_devido), 0);
    const pagas = nonCancelled.filter(c => c.status === "pago");
    const totalRecebido = pagas.reduce(
      (s, c) => s + Number(c.valor_recebido ?? c.valor_total_devido), 0);
    const emAberto = nonCancelled
      .filter(c => c.status !== "pago")
      .reduce((s, c) => s + Number(c.valor_total_devido), 0);
    const inadimplencia = totalFaturado > 0 ? (emAberto / totalFaturado) * 100 : 0;
    const ticketMedio = nonCancelled.length > 0 ? totalFaturado / nonCancelled.length : 0;

    const pmrSrc = pagas.filter(c => c.data_pagamento && c.criado_em);
    const pmr = pmrSrc.length > 0
      ? pmrSrc.reduce((s, c) =>
          s + (new Date(c.data_pagamento).getTime() - new Date(c.criado_em).getTime()) / 86400000,
        0) / pmrSrc.length
      : null;

    return {
      totalFaturado, totalRecebido, emAberto,
      inadimplencia, ticketMedio, pmr,
      qtdTotal: nonCancelled.length,
      qtdPagas: pagas.length,
    };
  }, [nonCancelled]);

  // ── Aging ─────────────────────────────────────────────────────────
  const aging = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const abertos = nonCancelled.filter(c => c.status !== "pago");

    const buckets = [
      { key: "semBoleto", label: "Sem boleto",  sublabel: "Pendente / Agendado",     color: "bg-slate-400",  count: 0, value: 0 },
      { key: "aVencer",  label: "A vencer",     sublabel: "Dentro do prazo",         color: "bg-emerald-500",count: 0, value: 0 },
      { key: "d1_30",    label: "1–30 dias",    sublabel: "Atenção",                 color: "bg-amber-400",  count: 0, value: 0 },
      { key: "d31_60",   label: "31–60 dias",   sublabel: "Risco moderado",          color: "bg-orange-500", count: 0, value: 0 },
      { key: "d61_90",   label: "61–90 dias",   sublabel: "Risco alto",              color: "bg-red-500",    count: 0, value: 0 },
      { key: "d90plus",  label: "+90 dias",     sublabel: "Provisão devedores duv.", color: "bg-red-900",    count: 0, value: 0 },
    ];

    for (const c of abertos) {
      const val = Number(c.valor_total_devido);
      if (c.status === "pendente" || c.status === "agendado") {
        buckets[0].count++; buckets[0].value += val;
      } else if (c.status === "enviado") {
        if (!c.vencimento_boleto) {
          buckets[1].count++; buckets[1].value += val;
        } else {
          const venc = new Date(c.vencimento_boleto + "T12:00:00");
          venc.setHours(0, 0, 0, 0);
          const dias = Math.floor((hoje.getTime() - venc.getTime()) / 86400000);
          if (dias <= 0)       { buckets[1].count++; buckets[1].value += val; }
          else if (dias <= 30) { buckets[2].count++; buckets[2].value += val; }
          else if (dias <= 60) { buckets[3].count++; buckets[3].value += val; }
          else if (dias <= 90) { buckets[4].count++; buckets[4].value += val; }
          else                 { buckets[5].count++; buckets[5].value += val; }
        }
      }
    }
    const totalAberto = buckets.reduce((s, b) => s + b.value, 0);
    return { buckets, totalAberto };
  }, [nonCancelled]);

  // ── Saldo por pizzaria (histórico completo) ───────────────────────
  const saldoPorPizzaria = useMemo(() => {
    const map = new Map<string, any>();
    for (const pz of pizzarias) {
      map.set(pz.id, {
        id: pz.id, nome: pz.nome,
        totalCobrado: 0, totalRecebido: 0, emAberto: 0,
        qtdCobradas: 0, qtdPagas: 0,
        ultimaCobranca: null as string | null,
        emAtraso: false,
      });
    }
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    for (const c of cobrancas.filter(x => x.status !== "cancelado")) {
      const entry = map.get(c.pizzaria_id);
      if (!entry) continue;
      const val = Number(c.valor_total_devido);
      entry.qtdCobradas++;
      entry.totalCobrado += val;
      if (c.status === "pago") {
        entry.qtdPagas++;
        entry.totalRecebido += Number(c.valor_recebido ?? val);
      } else {
        entry.emAberto += val;
        if (c.status === "enviado" && c.vencimento_boleto) {
          const venc = new Date(c.vencimento_boleto + "T12:00:00");
          venc.setHours(0, 0, 0, 0);
          if (hoje > venc) entry.emAtraso = true;
        }
      }
      if (!entry.ultimaCobranca || c.criado_em > entry.ultimaCobranca)
        entry.ultimaCobranca = c.criado_em;
    }
    return Array.from(map.values())
      .filter(e => e.qtdCobradas > 0)
      .sort((a, b) => b.emAberto - a.emAberto);
  }, [cobrancas, pizzarias]);

  const filteredSaldo = useMemo(() => {
    const q = searchPizzaria.toLowerCase();
    return q ? saldoPorPizzaria.filter(p => p.nome.toLowerCase().includes(q)) : saldoPorPizzaria;
  }, [saldoPorPizzaria, searchPizzaria]);

  // ── Evolução mensal (últimos 12 meses) ────────────────────────────
  // faturado → agrupado por vencimento_boleto (quando o pagamento era esperado)
  // recebido → agrupado por data_pagamento (quando o dinheiro entrou)
  const evolucaoMensal = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(new Date(), 11 - i);
      return {
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: format(d, "MMM/yy", { locale: ptBR }),
        faturado: 0,
        recebido: 0,
      };
    });
    for (const c of cobrancas.filter(x => x.status !== "cancelado")) {
      const val = Number(c.valor_total_devido);
      // Faturado: pelo vencimento do boleto; sem boleto usa criado_em como fallback
      const faturadoKey = c.vencimento_boleto
        ? (c.vencimento_boleto as string).slice(0, 7)
        : (c.criado_em as string).slice(0, 7);
      const mF = months.find(m => m.key === faturadoKey);
      if (mF) mF.faturado += val;
      // Recebido: pela data real de pagamento
      if (c.status === "pago" && c.data_pagamento) {
        const recebidoKey = (c.data_pagamento as string).slice(0, 7);
        const mR = months.find(m => m.key === recebidoKey);
        if (mR) mR.recebido += Number(c.valor_recebido ?? val);
      }
    }
    return months;
  }, [cobrancas]);

  // ── Exportar PDF ──────────────────────────────────────────────────
  const exportPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const periodoLabel = selectedMonth === "todos"
        ? `Ano ${selectedYear}`
        : `${MONTH_LABELS[selectedMonth]} / ${selectedYear}`;

      const lettering = await loadLetteringDataUrl();
      let y = buildPdfHeader(
        doc,
        "Relatório Financeiro",
        `Pizza Premiada — ${periodoLabel}`,
        [`Período: ${periodoLabel}`, `Total de cobranças: ${kpis.qtdTotal}`],
        lettering,
      );

      // ── Seção 1: KPIs ──────────────────────────────────────────────
      y = drawSectionTitle(doc, "Indicadores do Período", y);
      autoTable(doc, {
        startY: y,
        head: [["Indicador", "Valor", "Observação"]],
        body: [
          ["Total Faturado",    fmt(kpis.totalFaturado), `${kpis.qtdTotal} cobranças geradas`],
          ["Total Recebido",    fmt(kpis.totalRecebido), `${kpis.qtdPagas} cobranças pagas`],
          ["Total em Aberto",   fmt(kpis.emAberto),      `${kpis.qtdTotal - kpis.qtdPagas} cobranças pendentes`],
          ["Inadimplência",     `${kpis.inadimplencia.toFixed(1)}%`, kpis.inadimplencia > 20 ? "Acima do ideal (>20%)" : "Dentro do normal"],
          ["Ticket Médio",      fmt(kpis.ticketMedio),   "Por cobrança"],
          ["PMR",               kpis.pmr !== null ? `${Math.round(kpis.pmr)} dias` : "—", "Prazo médio de recebimento"],
        ],
        ...TABLE_STYLES,
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 }, 1: { cellWidth: 55 }, 2: {} },
      });

      // ── Seção 2: Aging ─────────────────────────────────────────────
      y = (doc as any).lastAutoTable.finalY + 10;
      if (y > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); y = 20; }
      y = drawSectionTitle(doc, "Aging de Recebíveis — Em Aberto por Faixa de Atraso", y);
      autoTable(doc, {
        startY: y,
        head: [["Faixa", "Situação", "Qtd. Cobranças", "Valor em Aberto", "% do Total Aberto"]],
        body: aging.buckets.map(b => [
          b.label,
          b.sublabel,
          String(b.count),
          b.count > 0 ? fmt(b.value) : "—",
          aging.totalAberto > 0 && b.value > 0
            ? `${((b.value / aging.totalAberto) * 100).toFixed(1)}%`
            : "—",
        ]),
        foot: [[
          "Total em Aberto", "",
          String(aging.buckets.reduce((s, b) => s + b.count, 0)),
          fmt(aging.totalAberto),
          "100%",
        ]],
        ...TABLE_STYLES,
        footStyles: { fillColor: C.slate700, textColor: C.white, fontStyle: "bold", fontSize: 8 },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 35 },
          1: { cellWidth: 55 },
          2: { halign: "center", cellWidth: 35 },
          3: { halign: "right", cellWidth: 50 },
          4: { halign: "right", cellWidth: 40 },
        },
      });

      // ── Seção 3: Evolução Mensal ───────────────────────────────────
      y = (doc as any).lastAutoTable.finalY + 10;
      if (y > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); y = 20; }
      y = drawSectionTitle(doc, "Evolução Mensal — Últimos 12 Meses", y);
      autoTable(doc, {
        startY: y,
        head: [["Mês", "Faturado", "Recebido", "Em Aberto", "Taxa de Recebimento"]],
        body: evolucaoMensal.map(m => {
          const aberto = m.faturado - m.recebido;
          const taxa = m.faturado > 0 ? (m.recebido / m.faturado) * 100 : 0;
          return [
            m.label,
            m.faturado > 0 ? fmt(m.faturado) : "—",
            m.recebido > 0 ? fmt(m.recebido) : "—",
            aberto > 0 ? fmt(aberto) : "—",
            m.faturado > 0 ? `${taxa.toFixed(1)}%` : "—",
          ];
        }),
        ...TABLE_STYLES,
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 28 },
          1: { halign: "right", cellWidth: 45 },
          2: { halign: "right", cellWidth: 45 },
          3: { halign: "right", cellWidth: 45 },
          4: { halign: "right", cellWidth: 40 },
        },
      });

      // ── Seção 4: Saldo por Pizzaria ────────────────────────────────
      doc.addPage();
      y = 20;
      y = drawSectionTitle(doc, "Saldo por Pizzaria — Histórico Completo", y);
      autoTable(doc, {
        startY: y,
        head: [["Pizzaria", "Cobranças", "Total Cobrado", "Total Recebido", "Em Aberto", "% Pagas", "Situação"]],
        body: saldoPorPizzaria.map(pz => {
          const pctPagas = pz.qtdCobradas > 0
            ? `${((pz.qtdPagas / pz.qtdCobradas) * 100).toFixed(0)}%`
            : "—";
          const situacao = pz.emAberto === 0
            ? "Adimplente"
            : pz.emAtraso
            ? "Em atraso"
            : "Em aberto";
          return [
            pz.nome,
            String(pz.qtdCobradas),
            fmt(pz.totalCobrado),
            fmt(pz.totalRecebido),
            pz.emAberto > 0 ? fmt(pz.emAberto) : "—",
            pctPagas,
            situacao,
          ];
        }),
        foot: [[
          `Total (${saldoPorPizzaria.length} pizzarias)`,
          String(saldoPorPizzaria.reduce((s, p) => s + p.qtdCobradas, 0)),
          fmt(saldoPorPizzaria.reduce((s, p) => s + p.totalCobrado, 0)),
          fmt(saldoPorPizzaria.reduce((s, p) => s + p.totalRecebido, 0)),
          fmt(saldoPorPizzaria.reduce((s, p) => s + p.emAberto, 0)),
          "",
          "",
        ]],
        ...TABLE_STYLES,
        footStyles: { fillColor: C.slate700, textColor: C.white, fontStyle: "bold", fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 65 },
          1: { halign: "center", cellWidth: 22 },
          2: { halign: "right", cellWidth: 42 },
          3: { halign: "right", cellWidth: 42 },
          4: { halign: "right", cellWidth: 42 },
          5: { halign: "center", cellWidth: 22 },
          6: { halign: "center", cellWidth: 28 },
        },
      });

      addPdfFooter(doc, `Relatório Financeiro — ${periodoLabel} — Pizza Premiada`);
      doc.save(`relatorio-financeiro-${selectedYear}${selectedMonth !== "todos" ? `-${selectedMonth}` : ""}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Toolbar: período + exportar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground font-medium">Período</span>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[145px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo o ano</SelectItem>
              {MONTHS.map(m => (
                <SelectItem key={m} value={m}>{MONTH_LABELS[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {nonCancelled.length} cobranças no período
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          onClick={exportPDF}
          disabled={exporting || nonCancelled.length === 0}
        >
          <FileDown className="h-3.5 w-3.5" />
          {exporting ? "Gerando PDF…" : "Exportar PDF"}
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          icon={<DollarSign className="h-4 w-4 text-primary" />}
          label="Total faturado"
          value={fmt(kpis.totalFaturado)}
          sub={`${kpis.qtdTotal} cobranças`}
        />
        <KpiCard
          icon={<CheckCircle className="h-4 w-4 text-emerald-400" />}
          label="Total recebido"
          value={fmt(kpis.totalRecebido)}
          sub={`${kpis.qtdPagas} pagas`}
          valueClass="text-emerald-500 dark:text-emerald-400"
        />
        <KpiCard
          icon={<Clock className="h-4 w-4 text-amber-400" />}
          label="Em aberto"
          value={fmt(kpis.emAberto)}
          sub={`${kpis.qtdTotal - kpis.qtdPagas} cobranças`}
          valueClass="text-amber-500 dark:text-amber-400"
        />
        <KpiCard
          icon={
            kpis.inadimplencia > 20
              ? <TrendingUp className="h-4 w-4 text-red-400" />
              : <TrendingDown className="h-4 w-4 text-emerald-400" />
          }
          label="Inadimplência"
          value={`${kpis.inadimplencia.toFixed(1)}%`}
          sub={kpis.inadimplencia > 20 ? "Acima do ideal" : "Dentro do normal"}
          valueClass={kpis.inadimplencia > 20
            ? "text-red-500 dark:text-red-400"
            : "text-emerald-500 dark:text-emerald-400"}
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4 text-blue-400" />}
          label="Ticket médio"
          value={fmt(kpis.ticketMedio)}
          sub="por cobrança"
          valueClass="text-blue-500 dark:text-blue-400"
        />
        <KpiCard
          icon={<Calendar className="h-4 w-4 text-purple-400" />}
          label="PMR"
          value={kpis.pmr !== null ? `${Math.round(kpis.pmr)} dias` : "—"}
          sub="prazo médio de recebimento"
          valueClass="text-purple-500 dark:text-purple-400"
        />
      </div>

      {/* Aging de Recebíveis */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="font-heading text-base">Aging de Recebíveis</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Classificação dos valores em aberto por faixa de atraso
              </p>
            </div>
            <span className="text-sm text-muted-foreground">
              Total em aberto:{" "}
              <span className="font-semibold text-foreground">{fmt(aging.totalAberto)}</span>
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {aging.totalAberto > 0 && (
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
              {aging.buckets.filter(b => b.value > 0).map(b => (
                <div
                  key={b.key}
                  className={b.color}
                  style={{ width: `${(b.value / aging.totalAberto) * 100}%` }}
                  title={`${b.label}: ${fmt(b.value)}`}
                />
              ))}
            </div>
          )}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Faixa</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Situação</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Cobranças</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Valor</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">% aberto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {aging.buckets.map(b => (
                  <tr key={b.key} className={b.count === 0 ? "opacity-40" : ""}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${b.color}`} />
                        <span className="font-medium">{b.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                      {b.sublabel}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{b.count}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {b.count > 0 ? fmt(b.value) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {aging.totalAberto > 0 && b.value > 0
                        ? `${((b.value / aging.totalAberto) * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/20 font-semibold text-xs">
                  <td className="px-4 py-2.5" colSpan={2}>Total em aberto</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {aging.buckets.reduce((s, b) => s + b.count, 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt(aging.totalAberto)}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Evolução Mensal */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base">Evolução Mensal — Últimos 12 meses</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Comparativo entre faturamento gerado e valor efetivamente recebido
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={evolucaoMensal} barGap={2} barCategoryGap="28%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={fmtShort}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip
                formatter={(val: number, name: string) => [
                  fmt(val),
                  name === "faturado" ? "Faturado" : "Recebido",
                ]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  color: "hsl(var(--foreground))",
                }}
                labelStyle={{ fontSize: 12, fontWeight: 600 }}
              />
              <Legend
                formatter={n => n === "faturado" ? "Faturado" : "Recebido"}
                wrapperStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="faturado" name="faturado" fill="hsl(var(--primary))" radius={[3,3,0,0]} opacity={0.85} />
              <Bar dataKey="recebido" name="recebido" fill="hsl(142 76% 36%)" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Saldo por Pizzaria */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="font-heading text-base">Saldo por Pizzaria</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Histórico completo de cobranças por cliente
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar pizzaria..."
                value={searchPizzaria}
                onChange={e => setSearchPizzaria(e.target.value)}
                className="pl-8 w-[210px] h-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto rounded-b-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Pizzaria</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Cobranças</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Total cobrado</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Total recebido</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Em aberto</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Pagas</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSaldo.map(pz => {
                  const pctPagas = pz.qtdCobradas > 0
                    ? Math.round((pz.qtdPagas / pz.qtdCobradas) * 100)
                    : 0;
                  return (
                    <tr key={pz.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{pz.nome}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{pz.qtdCobradas}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(pz.totalCobrado)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                        {fmt(pz.totalRecebido)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        <span className={pz.emAberto > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"}>
                          {fmt(pz.emAberto)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs hidden md:table-cell">
                        <span className="text-muted-foreground">
                          {pz.qtdPagas}/{pz.qtdCobradas}
                          {" "}
                          <span className={pctPagas === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                            ({pctPagas}%)
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {pz.emAberto === 0 ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs">
                            Adimplente
                          </Badge>
                        ) : pz.emAtraso ? (
                          <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 text-xs">
                            Em atraso
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs">
                            Em aberto
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredSaldo.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                      Nenhuma pizzaria encontrada
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredSaldo.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border bg-muted/20 font-semibold text-xs">
                    <td className="px-4 py-2.5">
                      Total ({filteredSaldo.length} pizzaria{filteredSaldo.length !== 1 ? "s" : ""})
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {filteredSaldo.reduce((s, p) => s + p.qtdCobradas, 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {fmt(filteredSaldo.reduce((s, p) => s + p.totalCobrado, 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {fmt(filteredSaldo.reduce((s, p) => s + p.totalRecebido, 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">
                      {fmt(filteredSaldo.reduce((s, p) => s + p.emAberto, 0))}
                    </td>
                    <td className="hidden md:table-cell" />
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

function KpiCard({
  icon, label, value, sub, valueClass = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-xs text-muted-foreground leading-tight">{label}</span>
        </div>
        <p className={`text-xl font-heading font-bold ${valueClass}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}
