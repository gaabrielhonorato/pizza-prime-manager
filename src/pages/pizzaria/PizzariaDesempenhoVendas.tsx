import { useState, useMemo, useEffect } from "react";
import {
  format, subDays, subWeeks, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfDay, endOfDay, getDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { ChevronDown, SlidersHorizontal, Download, FileSpreadsheet, FileText, BarChart2, List, ChevronLeft, ChevronRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useMinhaPizzaria } from "@/contexts/MinhaPizzariaContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { C, TABLE_STYLES, loadLetteringDataUrl, buildPdfHeader, addPdfFooter } from "@/lib/pdf-helpers";

// ─────────────────────────────────────────────────────────────
const COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#6b7280"];
const FORMAS_PAGAMENTO = ["cartao_credito", "cartao_debito", "pix", "dinheiro", "voucher", "outros"];
const FORMAS_LABELS: Record<string, string> = {
  cartao_credito: "Cartão de crédito", cartao_debito: "Cartão de débito", pix: "Pix",
  dinheiro: "Dinheiro", voucher: "Voucher", outros: "Outros",
};
const TIPOS = [
  { value: "delivery", label: "Delivery" },
  { value: "retirada", label: "Retirada" },
  { value: "local", label: "No local" },
];
const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type QuickPeriod = "campanha" | "hoje" | "ontem" | "esta_semana" | "semana_passada" | "este_mes" | "mes_passado" | "2m" | "3m" | "6m" | "custom";
const QUICK_LABELS: Record<Exclude<QuickPeriod, "custom">, string> = {
  campanha: "Toda a campanha", hoje: "Hoje", ontem: "Ontem",
  esta_semana: "Esta semana", semana_passada: "Semana passada",
  este_mes: "Este mês", mes_passado: "Mês passado",
  "2m": "Últimos 2 meses", "3m": "Últimos 3 meses", "6m": "Últimos 6 meses",
};

function getQuickRange(p: Exclude<QuickPeriod, "campanha" | "custom">): [Date, Date] {
  const now = new Date();
  switch (p) {
    case "hoje": return [startOfDay(now), endOfDay(now)];
    case "ontem": return [startOfDay(subDays(now, 1)), endOfDay(subDays(now, 1))];
    case "esta_semana": return [startOfWeek(now, { weekStartsOn: 1 }), endOfDay(now)];
    case "semana_passada": { const s = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }); return [s, endOfWeek(s, { weekStartsOn: 1 })]; }
    case "este_mes": return [startOfMonth(now), endOfDay(now)];
    case "mes_passado": return [startOfMonth(subMonths(now, 1)), endOfMonth(subMonths(now, 1))];
    case "2m": return [startOfDay(subMonths(now, 2)), endOfDay(now)];
    case "3m": return [startOfDay(subMonths(now, 3)), endOfDay(now)];
    case "6m": return [startOfDay(subMonths(now, 6)), endOfDay(now)];
  }
}

type Pedido = {
  id: string; data_pedido: string; valor_total: number; cupons_gerados: number;
  canal: string; status: string; forma_pagamento: string | null;
  tipo_pedido: string | null; taxa_entrega: number; desconto: number;
  bairro_entrega: string | null;
};

// ─────────────────────────────────────────────────────────────
export default function PizzariaDesempenhoVendas() {
  const { pizzaria, loading: pizzariaLoading } = useMinhaPizzaria();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [quick, setQuick] = useState<QuickPeriod>("campanha");
  const [dateFrom, setDateFrom] = useState<Date>(() => startOfDay(subDays(new Date(), 29)));
  const [dateTo, setDateTo] = useState<Date>(() => endOfDay(new Date()));
  const [customFromStr, setCustomFromStr] = useState("");
  const [customToStr, setCustomToStr] = useState("");
  const [selectedCanais, setSelectedCanais] = useState<string[] | null>(null);
  const [selectedTipos, setSelectedTipos] = useState<string[] | null>(null);
  const [selectedFormas, setSelectedFormas] = useState<string[] | null>(null);
  const [cuponMin, setCuponMin] = useState("");
  const [cuponMax, setCuponMax] = useState("");
  const [valorOp, setValorOp] = useState<"gt" | "lt" | "between" | "">("");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [groupBy, setGroupBy] = useState<"hora" | "dia" | "dia_semana" | "semana" | "mes">("dia");
  const [pageBairros, setPageBairros] = useState(1);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggleSection = (k: string) => setOpenSections(s => ({ ...s, [k]: !s[k] }));

  useEffect(() => {
    if (!pizzaria) return;
    const fetchData = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("pedidos")
        .select("id, data_pedido, valor_total, cupons_gerados, canal, status, forma_pagamento, tipo_pedido, taxa_entrega, desconto, bairro_entrega")
        .eq("pizzaria_id", pizzaria.id)
        .order("data_pedido", { ascending: false })
        .limit(5000);
      setPedidos((data as Pedido[]) || []);
      setLoading(false);
    };
    fetchData();
  }, [pizzaria]);

  const canaisDisponiveis = useMemo(() => [...new Set(pedidos.map(p => p.canal))].filter(Boolean).sort(), [pedidos]);

  const filteredPedidos = useMemo(() => {
    let list = (quick === "campanha"
      ? [...pedidos]
      : pedidos.filter(p => { const d = new Date(p.data_pedido); return d >= dateFrom && d <= dateTo; })
    ).filter(p => p.status !== "cancelado");

    if (selectedCanais && selectedCanais.length > 0) list = list.filter(p => selectedCanais.includes(p.canal));
    if (selectedTipos && selectedTipos.length > 0) list = list.filter(p => p.tipo_pedido && selectedTipos.includes(p.tipo_pedido));
    if (selectedFormas && selectedFormas.length > 0) list = list.filter(p => selectedFormas.includes(p.forma_pagamento || "outros"));
    if (cuponMin !== "") list = list.filter(p => (p.cupons_gerados || 0) >= parseInt(cuponMin));
    if (cuponMax !== "") list = list.filter(p => (p.cupons_gerados || 0) <= parseInt(cuponMax));
    if (valorOp && valorMin) {
      const v1 = parseFloat(valorMin), v2 = valorMax ? parseFloat(valorMax) : 0;
      list = list.filter(p => {
        switch (valorOp) {
          case "gt": return p.valor_total > v1;
          case "lt": return p.valor_total < v1;
          case "between": return p.valor_total >= v1 && p.valor_total <= v2;
          default: return true;
        }
      });
    }
    return list;
  }, [pedidos, quick, dateFrom, dateTo, selectedCanais, selectedTipos, selectedFormas, cuponMin, cuponMax, valorOp, valorMin, valorMax]);

  useEffect(() => { setPageBairros(1); }, [filteredPedidos]);

  // KPIs
  const totalFaturamento = filteredPedidos.reduce((s, p) => s + p.valor_total, 0);
  const totalPedidos = filteredPedidos.length;
  const ticketMedio = totalPedidos > 0 ? totalFaturamento / totalPedidos : 0;
  const totalCupons = filteredPedidos.reduce((s, p) => s + (p.cupons_gerados || 0), 0);
  const totalTaxaEntrega = filteredPedidos.reduce((s, p) => s + (p.taxa_entrega || 0), 0);
  const totalDescontos = filteredPedidos.reduce((s, p) => s + (p.desconto || 0), 0);

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const periodoLabel = quick === "custom"
    ? `${format(dateFrom, "dd/MM")} – ${format(dateTo, "dd/MM")}`
    : QUICK_LABELS[quick as Exclude<QuickPeriod, "custom">];

  // Charts / tables
  const chartData = useMemo(() => {
    if (!filteredPedidos.length) return [];
    const map: Record<string, { label: string; faturamento: number; pedidos: number }> = {};
    filteredPedidos.forEach(p => {
      const d = new Date(p.data_pedido);
      let key: string, label: string;
      switch (groupBy) {
        case "hora": key = `${d.getHours()}`; label = `${d.getHours()}h`; break;
        case "dia": key = format(d, "yyyy-MM-dd"); label = format(d, "dd/MM", { locale: ptBR }); break;
        case "dia_semana": key = `${getDay(d)}`; label = DAY_NAMES[getDay(d)]; break;
        case "semana":
          key = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
          label = `Sem ${format(d, "dd/MM", { locale: ptBR })}`;
          break;
        default: key = format(d, "yyyy-MM"); label = format(d, "MMM/yy", { locale: ptBR });
      }
      if (!map[key]) map[key] = { label, faturamento: 0, pedidos: 0 };
      map[key].faturamento += p.valor_total;
      map[key].pedidos += 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [filteredPedidos, groupBy]);

  const paymentData = useMemo(() => {
    const map: Record<string, { qty: number; total: number }> = {};
    FORMAS_PAGAMENTO.forEach(f => (map[f] = { qty: 0, total: 0 }));
    filteredPedidos.forEach(p => {
      const key = p.forma_pagamento || "outros";
      if (!map[key]) map[key] = { qty: 0, total: 0 };
      map[key].qty++; map[key].total += p.valor_total;
    });
    const total = filteredPedidos.reduce((s, p) => s + p.valor_total, 0);
    return FORMAS_PAGAMENTO
      .map(f => ({
        name: FORMAS_LABELS[f] || f, key: f, qty: map[f].qty, total: map[f].total,
        pct: total > 0 ? (map[f].total / total) * 100 : 0,
        ticket: map[f].qty > 0 ? map[f].total / map[f].qty : 0,
      }))
      .filter(d => d.qty > 0);
  }, [filteredPedidos]);

  const canalSummary = useMemo(() => {
    const map = new Map<string, { qty: number; total: number }>();
    filteredPedidos.forEach(p => {
      const c = p.canal || "Outros";
      const cur = map.get(c) ?? { qty: 0, total: 0 };
      map.set(c, { qty: cur.qty + 1, total: cur.total + p.valor_total });
    });
    return [...map.entries()]
      .map(([canal, d]) => ({ canal, qty: d.qty, total: d.total, pct: totalFaturamento > 0 ? (d.total / totalFaturamento) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filteredPedidos, totalFaturamento]);

  const tipoSummary = useMemo(() => {
    const map = new Map<string, { qty: number; total: number }>();
    filteredPedidos.forEach(p => {
      const t = p.tipo_pedido || "Não informado";
      const cur = map.get(t) ?? { qty: 0, total: 0 };
      map.set(t, { qty: cur.qty + 1, total: cur.total + p.valor_total });
    });
    return [...map.entries()]
      .map(([tipo, d]) => ({ tipo, qty: d.qty, total: d.total, pct: totalFaturamento > 0 ? (d.total / totalFaturamento) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filteredPedidos, totalFaturamento]);

  const bairroData = useMemo(() => {
    const map: Record<string, { faturamento: number; qty: number }> = {};
    filteredPedidos.forEach(p => {
      const b = p.bairro_entrega || "Não informado";
      if (!map[b]) map[b] = { faturamento: 0, qty: 0 };
      map[b].faturamento += p.valor_total; map[b].qty++;
    });
    return Object.entries(map)
      .map(([bairro, d]) => ({ bairro, faturamento: d.faturamento, qty: d.qty, ticket: d.qty > 0 ? d.faturamento / d.qty : 0 }))
      .sort((a, b) => b.faturamento - a.faturamento);
  }, [filteredPedidos]);

  const bairrosPageSize = 10;
  const totalPagesBairros = Math.max(1, Math.ceil(bairroData.length / bairrosPageSize));
  const pagedBairros = bairroData.slice((pageBairros - 1) * bairrosPageSize, pageBairros * bairrosPageSize);

  // Filter helpers
  const hasActiveFilters = quick !== "campanha" || selectedCanais !== null || selectedTipos !== null || selectedFormas !== null || cuponMin !== "" || cuponMax !== "" || !!valorOp;
  const activeFilterCount = [quick !== "campanha", selectedCanais !== null, selectedTipos !== null, selectedFormas !== null, cuponMin !== "" || cuponMax !== "", !!valorOp].filter(Boolean).length;

  const clearFilters = () => {
    setQuick("campanha"); setSelectedCanais(null); setSelectedTipos(null); setSelectedFormas(null);
    setCuponMin(""); setCuponMax(""); setValorOp(""); setValorMin(""); setValorMax("");
    setCustomFromStr(""); setCustomToStr("");
  };
  const toggleCanal = (canal: string) => {
    const cur = selectedCanais ?? canaisDisponiveis;
    const next = cur.includes(canal) ? cur.filter(c => c !== canal) : [...cur, canal];
    setSelectedCanais(next.length === canaisDisponiveis.length ? null : next);
  };
  const toggleTipo = (tipo: string) => {
    const cur = selectedTipos ?? TIPOS.map(t => t.value);
    const next = cur.includes(tipo) ? cur.filter(t => t !== tipo) : [...cur, tipo];
    setSelectedTipos(next.length === TIPOS.length ? null : next);
  };
  const toggleForma = (forma: string) => {
    const cur = selectedFormas ?? FORMAS_PAGAMENTO;
    const next = cur.includes(forma) ? cur.filter(f => f !== forma) : [...cur, forma];
    setSelectedFormas(next.length === FORMAS_PAGAMENTO.length ? null : next);
  };

  // Exports
  const filterLines = [
    `Período: ${periodoLabel}`,
    ...(selectedCanais ? [`Canal: ${selectedCanais.join(", ")}`] : []),
    ...(selectedFormas ? [`Pagamento: ${selectedFormas.map(f => FORMAS_LABELS[f] ?? f).join(", ")}`] : []),
    `Total: ${filteredPedidos.length} pedidos`,
  ];

  async function exportSinteticoPDF() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const lettering = await loadLetteringDataUrl();
    let y = buildPdfHeader(doc, "Desempenho de Vendas — Sintético", pizzaria?.nome ?? "", filterLines, lettering);

    const kpis = [
      { label: "Faturamento", value: fmtBRL(totalFaturamento) },
      { label: "Pedidos", value: String(totalPedidos) },
      { label: "Ticket Médio", value: fmtBRL(ticketMedio) },
      { label: "Cupons", value: String(totalCupons) },
    ];
    const boxW = 42; const boxH = 22; const gap = 4;
    kpis.forEach((k, i) => {
      const bx = 20 + i * (boxW + gap);
      doc.setFillColor(...C.slate50); doc.setDrawColor(...C.slate200); doc.setLineWidth(0.4);
      doc.rect(bx, y, boxW, boxH, "FD");
      doc.setFontSize(6); doc.setTextColor(...C.slate500); doc.setFont("helvetica", "normal");
      doc.text(k.label, bx + 3, y + 7, { maxWidth: boxW - 6 });
      doc.setFontSize(9); doc.setTextColor(...C.slate900); doc.setFont("helvetica", "bold");
      doc.text(k.value, bx + 3, y + 17, { maxWidth: boxW - 6 });
    });
    y += boxH + 10;

    autoTable(doc, { startY: y, head: [["Período", "Faturamento", "Pedidos"]], body: chartData.map(d => [d.label, fmtBRL(d.faturamento), String(d.pedidos)]), ...TABLE_STYLES });
    y = (doc as any).lastAutoTable.finalY + 8;
    autoTable(doc, { startY: y, head: [["Forma de Pagamento", "Qtd", "Total", "%"]], body: paymentData.map(d => [d.name, String(d.qty), fmtBRL(d.total), `${d.pct.toFixed(1)}%`]), ...TABLE_STYLES });
    y = (doc as any).lastAutoTable.finalY + 8;
    autoTable(doc, { startY: y, head: [["Canal", "Qtd", "Total", "%"]], body: canalSummary.map(d => [d.canal, String(d.qty), fmtBRL(d.total), `${d.pct.toFixed(1)}%`]), ...TABLE_STYLES });
    y = (doc as any).lastAutoTable.finalY + 8;
    autoTable(doc, { startY: y, head: [["Bairro", "Faturamento", "Pedidos", "Ticket"]], body: bairroData.slice(0, 10).map(d => [d.bairro, fmtBRL(d.faturamento), String(d.qty), fmtBRL(d.ticket)]), ...TABLE_STYLES });
    addPdfFooter(doc, "Desempenho de Vendas — Sintético");
    doc.save(`desempenho-vendas-sintetico-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.pdf`);
  }

  async function exportAnaliticoPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const lettering = await loadLetteringDataUrl();
    const y = buildPdfHeader(doc, "Desempenho de Vendas — Analítico", pizzaria?.nome ?? "", filterLines, lettering);
    autoTable(doc, {
      startY: y,
      head: [["Data", "Valor", "Canal", "Tipo", "Forma Pgto", "Bairro", "Cupons"]],
      body: filteredPedidos.map(p => [
        format(new Date(p.data_pedido), "dd/MM/yyyy HH:mm"),
        fmtBRL(p.valor_total), p.canal || "—", p.tipo_pedido || "—",
        FORMAS_LABELS[p.forma_pagamento || "outros"] || p.forma_pagamento || "—",
        p.bairro_entrega || "—", String(p.cupons_gerados || 0),
      ]),
      ...TABLE_STYLES,
    });
    addPdfFooter(doc, "Desempenho de Vendas — Analítico");
    doc.save(`desempenho-vendas-analitico-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.pdf`);
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Data", "Valor", "Canal", "Tipo", "Forma Pagamento", "Bairro", "Cupons"],
      ...filteredPedidos.map(p => [
        format(new Date(p.data_pedido), "dd/MM/yyyy HH:mm"),
        p.valor_total, p.canal || "—", p.tipo_pedido || "—",
        FORMAS_LABELS[p.forma_pagamento || "outros"] || p.forma_pagamento || "—",
        p.bairro_entrega || "—", p.cupons_gerados || 0,
      ]),
    ]), "Pedidos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Forma", "Qtd", "Total (R$)", "%", "Ticket Médio"],
      ...paymentData.map(d => [d.name, d.qty, d.total, parseFloat(d.pct.toFixed(1)), d.ticket]),
    ]), "Formas de Pagamento");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Bairro", "Faturamento", "Pedidos", "Ticket"],
      ...bairroData.map(d => [d.bairro, d.faturamento, d.qty, d.ticket]),
    ]), "Ranking Bairros");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/octet-stream" }));
    const a = document.createElement("a"); a.href = url; a.download = `desempenho-vendas-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.xlsx`;
    a.click(); URL.revokeObjectURL(url);
  }

  if (pizzariaLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
  if (!pizzaria) return <div className="flex items-center justify-center h-64 text-muted-foreground">Nenhuma pizzaria vinculada.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Desempenho · Vendas</h1>
          <p className="text-muted-foreground text-sm mt-1">{pizzaria.nome} — análise detalhada de vendas</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Advanced filter */}
          <Popover open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <PopoverTrigger asChild>
              <Button variant={hasActiveFilters ? "default" : "outline"} size="sm" className="h-8 text-xs gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-white/25 text-[10px] font-semibold px-1.5 leading-4">{activeFilterCount}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end" style={{ maxHeight: "540px", overflowY: "auto" }}>
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <span className="text-sm font-semibold">Filtros</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{filteredPedidos.length} resultado{filteredPedidos.length !== 1 ? "s" : ""}</span>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => { clearFilters(); setAdvancedOpen(false); }}>Limpar</Button>
                  )}
                </div>
              </div>
              <div className="divide-y divide-border">

                {/* Período */}
                <div>
                  <button onClick={() => toggleSection("periodo")} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Período</span>
                      {quick !== "campanha" && <span className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections.periodo ? "rotate-180" : ""}`} />
                  </button>
                  {openSections.periodo && (
                    <div className="px-5 pt-1 pb-5 space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {(Object.keys(QUICK_LABELS) as Exclude<QuickPeriod, "custom">[]).map(p => (
                          <Button key={p} variant={quick === p ? "default" : "outline"} size="sm" className="text-xs h-6 px-2"
                            onClick={() => {
                              if (p === "campanha") { setQuick("campanha"); }
                              else { const [f, t] = getQuickRange(p as Exclude<QuickPeriod, "campanha" | "custom">); setQuick(p); setDateFrom(f); setDateTo(t); }
                            }}>
                            {QUICK_LABELS[p]}
                          </Button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input type="date" value={customFromStr} onChange={e => setCustomFromStr(e.target.value)}
                          className="w-full text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring" />
                        <input type="date" value={customToStr} onChange={e => setCustomToStr(e.target.value)}
                          className="w-full text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring" />
                      </div>
                      <Button size="sm" className="w-full text-xs h-7" disabled={!customFromStr || !customToStr}
                        onClick={() => { setQuick("custom"); setDateFrom(startOfDay(new Date(customFromStr))); setDateTo(endOfDay(new Date(customToStr))); }}>
                        Aplicar personalizado
                      </Button>
                    </div>
                  )}
                </div>

                {/* Canal */}
                {canaisDisponiveis.length > 0 && (
                  <div>
                    <button onClick={() => toggleSection("canal")} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Canal</span>
                        {selectedCanais !== null && <span className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections.canal ? "rotate-180" : ""}`} />
                    </button>
                    {openSections.canal && (
                      <div className="px-5 pt-1 pb-5 space-y-1.5">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <Checkbox checked={selectedCanais === null} onCheckedChange={v => setSelectedCanais(v ? null : [])} />
                          Todos os canais
                        </label>
                        {canaisDisponiveis.map(c => (
                          <label key={c} className="flex items-center gap-2 text-xs cursor-pointer">
                            <Checkbox checked={selectedCanais === null || selectedCanais.includes(c)} onCheckedChange={() => toggleCanal(c)} />
                            {c}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tipo */}
                <div>
                  <button onClick={() => toggleSection("tipo")} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Tipo de pedido</span>
                      {selectedTipos !== null && <span className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections.tipo ? "rotate-180" : ""}`} />
                  </button>
                  {openSections.tipo && (
                    <div className="px-5 pt-1 pb-5 space-y-1.5">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox checked={selectedTipos === null} onCheckedChange={v => setSelectedTipos(v ? null : [])} />
                        Todos os tipos
                      </label>
                      {TIPOS.map(t => (
                        <label key={t.value} className="flex items-center gap-2 text-xs cursor-pointer">
                          <Checkbox checked={selectedTipos === null || selectedTipos.includes(t.value)} onCheckedChange={() => toggleTipo(t.value)} />
                          {t.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pagamento */}
                <div>
                  <button onClick={() => toggleSection("pagamento")} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Forma de pagamento</span>
                      {selectedFormas !== null && <span className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections.pagamento ? "rotate-180" : ""}`} />
                  </button>
                  {openSections.pagamento && (
                    <div className="px-5 pt-1 pb-5 space-y-1.5">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox checked={selectedFormas === null} onCheckedChange={v => setSelectedFormas(v ? null : [])} />
                        Todas as formas
                      </label>
                      {FORMAS_PAGAMENTO.map(f => (
                        <label key={f} className="flex items-center gap-2 text-xs cursor-pointer">
                          <Checkbox checked={selectedFormas === null || selectedFormas.includes(f)} onCheckedChange={() => toggleForma(f)} />
                          {FORMAS_LABELS[f]}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Valor */}
                <div>
                  <button onClick={() => toggleSection("valor")} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Valor do pedido</span>
                      {!!valorOp && <span className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections.valor ? "rotate-180" : ""}`} />
                  </button>
                  {openSections.valor && (
                    <div className="px-5 pt-1 pb-5 space-y-2">
                      <Select value={valorOp || "__none__"} onValueChange={v => setValorOp(v === "__none__" ? "" : v as "gt" | "lt" | "between")}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Qualquer valor" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Qualquer valor</SelectItem>
                          <SelectItem value="gt">Maior que</SelectItem>
                          <SelectItem value="lt">Menor que</SelectItem>
                          <SelectItem value="between">Entre</SelectItem>
                        </SelectContent>
                      </Select>
                      {valorOp && (
                        <div className="flex gap-2">
                          <Input type="number" placeholder="R$" value={valorMin} onChange={e => setValorMin(e.target.value)} className="h-7 text-xs" />
                          {valorOp === "between" && <Input type="number" placeholder="R$" value={valorMax} onChange={e => setValorMax(e.target.value)} className="h-7 text-xs" />}
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </PopoverContent>
          </Popover>

          {/* Export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                <Download className="h-3.5 w-3.5" /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wide">Relatórios PDF</DropdownMenuLabel>
              <DropdownMenuItem onClick={exportSinteticoPDF} className="gap-2 text-xs"><BarChart2 className="h-3.5 w-3.5" /> Relatório Sintético</DropdownMenuItem>
              <DropdownMenuItem onClick={exportAnaliticoPDF} className="gap-2 text-xs"><List className="h-3.5 w-3.5" /> Relatório Analítico</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wide">Dados</DropdownMenuLabel>
              <DropdownMenuItem onClick={exportExcel} className="gap-2 text-xs"><FileSpreadsheet className="h-3.5 w-3.5" /> Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const header = "Data,Valor,Canal,Tipo,Forma Pagamento,Bairro,Cupons";
                const rows = filteredPedidos.map(p => [format(new Date(p.data_pedido), "dd/MM/yyyy HH:mm"), p.valor_total, p.canal || "—", p.tipo_pedido || "—", FORMAS_LABELS[p.forma_pagamento || "outros"] || p.forma_pagamento || "—", p.bairro_entrega || "—", p.cupons_gerados || 0].join(","));
                const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `desempenho-vendas-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.csv`; a.click(); URL.revokeObjectURL(url);
              }} className="gap-2 text-xs"><FileText className="h-3.5 w-3.5" /> CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Faturamento total", value: fmtBRL(totalFaturamento), sub: periodoLabel },
          { label: "Quantidade de pedidos", value: String(totalPedidos), sub: periodoLabel },
          { label: "Ticket médio", value: fmtBRL(ticketMedio), sub: "por pedido" },
          { label: "Cupons gerados", value: String(totalCupons), sub: periodoLabel },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-2xl font-bold mt-1">{k.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Evolução no período */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Evolução no período</CardTitle>
            <div className="flex gap-1 flex-wrap">
              {(["hora", "dia", "dia_semana", "semana", "mes"] as const).map(g => (
                <Button key={g} size="sm" variant={groupBy === g ? "default" : "outline"} onClick={() => setGroupBy(g)} className="text-xs h-7">
                  {g === "dia_semana" ? "Dia sem." : g.charAt(0).toUpperCase() + g.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number, name: string) => [name === "faturamento" ? fmtBRL(v) : v, name === "faturamento" ? "Faturamento" : "Pedidos"]} />
                  <Line animationDuration={3000} animationEasing="linear" yAxisId="left" type="monotone" dataKey="faturamento" stroke="#f97316" strokeWidth={2} dot={false}/>
                  <Line animationDuration={3000} animationEasing="linear" yAxisId="right" type="monotone" dataKey="pedidos" stroke="#3b82f6" strokeWidth={2} dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">{filteredPedidos.length} pedidos exibidos · {periodoLabel}</p>
        </CardContent>
      </Card>

      {/* Forma de pagamento */}
      <Card>
        <CardHeader><CardTitle className="text-base">Por forma de pagamento</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie animationBegin={0} animationDuration={3000} animationEasing="linear" data={paymentData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false}
                    label={({ name, pct }: any) => pct > 5 ? `${name}: ${pct.toFixed(0)}%` : ""}>
                    {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Forma</TableHead>
                  <TableHead className="text-xs text-right">Qtd</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                  <TableHead className="text-xs text-right">%</TableHead>
                  <TableHead className="text-xs text-right">Ticket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentData.map((d, i) => (
                  <TableRow key={d.key}>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        {d.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-right">{d.qty}</TableCell>
                    <TableCell className="text-xs text-right">{fmtBRL(d.total)}</TableCell>
                    <TableCell className="text-xs text-right">{d.pct.toFixed(1)}%</TableCell>
                    <TableCell className="text-xs text-right">{fmtBRL(d.ticket)}</TableCell>
                  </TableRow>
                ))}
                {paymentData.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">Sem dados</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Canal + Tipo lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Por canal</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Canal</TableHead>
                  <TableHead className="text-xs text-right">Pedidos</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                  <TableHead className="text-xs text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {canalSummary.map(d => (
                  <TableRow key={d.canal}>
                    <TableCell className="text-xs">{d.canal}</TableCell>
                    <TableCell className="text-xs text-right">{d.qty}</TableCell>
                    <TableCell className="text-xs text-right">{fmtBRL(d.total)}</TableCell>
                    <TableCell className="text-xs text-right">{d.pct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
                {canalSummary.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">Sem dados</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Por tipo de pedido</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs text-right">Pedidos</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                  <TableHead className="text-xs text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tipoSummary.map(d => (
                  <TableRow key={d.tipo}>
                    <TableCell className="text-xs">{d.tipo}</TableCell>
                    <TableCell className="text-xs text-right">{d.qty}</TableCell>
                    <TableCell className="text-xs text-right">{fmtBRL(d.total)}</TableCell>
                    <TableCell className="text-xs text-right">{d.pct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
                {tipoSummary.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">Sem dados</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Ranking de bairros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Ranking de bairros</CardTitle>
            {totalPagesBairros > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={pageBairros === 1} onClick={() => setPageBairros(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground w-16 text-center">{pageBairros} / {totalPagesBairros}</span>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={pageBairros === totalPagesBairros} onClick={() => setPageBairros(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-10">#</TableHead>
                <TableHead className="text-xs">Bairro</TableHead>
                <TableHead className="text-xs text-right">Faturamento</TableHead>
                <TableHead className="text-xs text-right">Pedidos</TableHead>
                <TableHead className="text-xs text-right">Ticket médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedBairros.map((d, i) => (
                <TableRow key={d.bairro}>
                  <TableCell className="text-xs font-medium">{(pageBairros - 1) * bairrosPageSize + i + 1}</TableCell>
                  <TableCell className="text-xs">{d.bairro}</TableCell>
                  <TableCell className="text-xs text-right">{fmtBRL(d.faturamento)}</TableCell>
                  <TableCell className="text-xs text-right">{d.qty}</TableCell>
                  <TableCell className="text-xs text-right">{fmtBRL(d.ticket)}</TableCell>
                </TableRow>
              ))}
              {bairroData.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">Nenhum dado disponível</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
