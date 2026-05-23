import { useState, useMemo, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subMonths, subWeeks, startOfDay, endOfDay, getDay
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
import { ChevronDown, Clock, Filter, Download, FileSpreadsheet, FileText, BarChart2, List } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { usePizzarias } from "@/contexts/PizzariasContext";

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

type Pedido = {
  id: string; data_pedido: string; valor_total: number; cupons_gerados: number;
  canal: string; status: string; forma_pagamento: string | null;
  tipo_pedido: string | null; taxa_entrega: number; desconto: number;
  bairro_entrega: string | null; horario_pedido: string | null;
  pizzaria_id: string; campanha_id: string;
};
type QuickPeriod = "campanha" | "hoje" | "ontem" | "esta_semana" | "semana_passada" | "este_mes" | "mes_passado" | "2m" | "3m" | "6m" | "custom";
type DesempenhoContext = { selectedPizzaria: string; selectedCampanha: string };

const QUICK_LABELS: Record<Exclude<QuickPeriod, "custom">, string> = {
  campanha: "Toda a campanha",
  hoje: "Hoje", ontem: "Ontem",
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
    case "semana_passada": {
      const s = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      return [s, endOfWeek(s, { weekStartsOn: 1 })];
    }
    case "este_mes": return [startOfMonth(now), endOfDay(now)];
    case "mes_passado": return [startOfMonth(subMonths(now, 1)), endOfMonth(subMonths(now, 1))];
    case "2m": return [startOfDay(subMonths(now, 2)), endOfDay(now)];
    case "3m": return [startOfDay(subMonths(now, 3)), endOfDay(now)];
    case "6m": return [startOfDay(subMonths(now, 6)), endOfDay(now)];
  }
}

function buildPdfHeader(doc: any, title: string, filters: string[]): number {
  const pageW = doc.internal.pageSize.getWidth();
  const hasFilters = filters.length > 0;
  const headerH = hasFilters ? 52 : 38;
  doc.setFillColor(249, 115, 22);
  doc.rect(0, 0, pageW, headerH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text(title, 20, 22);
  if (hasFilters) {
    doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
    doc.text(filters.join("  ·  "), 20, 36, { maxWidth: pageW - 120 });
  }
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  const now = new Date();
  const ts = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " +
    now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  doc.text(ts, pageW - 20, 22, { align: "right" });
  return headerH + 10;
}

export default function DesempenhoVendas() {
  const { selectedPizzaria, selectedCampanha } = useOutletContext<DesempenhoContext>();
  const { pizzarias } = usePizzarias();

  const [quick, setQuick] = useState<QuickPeriod>("campanha");
  const [dateFrom, setDateFrom] = useState<Date>(() => startOfDay(subDays(new Date(), 29)));
  const [dateTo, setDateTo] = useState<Date>(() => endOfDay(new Date()));
  const [customFromStr, setCustomFromStr] = useState("");
  const [customToStr, setCustomToStr] = useState("");

  const [selectedCanais, setSelectedCanais] = useState<string[] | null>(null);
  const [selectedTipos, setSelectedTipos] = useState<string[] | null>(null);
  const [valorOp, setValorOp] = useState<"gt" | "lt" | "between" | "">("");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");

  const [groupBy, setGroupBy] = useState<"hora" | "dia" | "dia_semana" | "semana" | "mes">("dia");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      let q = supabase.from("pedidos").select("*");
      if (selectedPizzaria !== "todas") q = q.eq("pizzaria_id", selectedPizzaria);
      if (selectedCampanha !== "todas") q = q.eq("campanha_id", selectedCampanha);
      const { data } = await q.order("data_pedido", { ascending: false }).limit(5000);
      setPedidos((data as Pedido[]) || []);
      setLoading(false);
    };
    fetch();
  }, [selectedPizzaria, selectedCampanha]);

  const canaisDisponiveis = useMemo(() => [...new Set(pedidos.map(p => p.canal))].filter(Boolean).sort(), [pedidos]);

  const filteredPedidos = useMemo(() => {
    let list = (quick === "campanha"
      ? [...pedidos]
      : pedidos.filter(p => { const d = new Date(p.data_pedido); return d >= dateFrom && d <= dateTo; })
    ).filter(p => p.status !== "cancelado");

    if (selectedCanais && selectedCanais.length > 0)
      list = list.filter(p => selectedCanais.includes(p.canal));
    if (selectedTipos && selectedTipos.length > 0)
      list = list.filter(p => p.tipo_pedido && selectedTipos.includes(p.tipo_pedido));
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
  }, [pedidos, quick, dateFrom, dateTo, selectedCanais, selectedTipos, valorOp, valorMin, valorMax]);

  const totalFaturamento = filteredPedidos.reduce((s, p) => s + p.valor_total, 0);
  const totalPedidos = filteredPedidos.length;
  const ticketMedio = totalPedidos > 0 ? totalFaturamento / totalPedidos : 0;
  const totalCupons = useMemo(
    () => filteredPedidos.reduce((s, p) => s + (p.cupons_gerados || 0), 0),
    [filteredPedidos]
  );
  const totalTaxaEntrega = filteredPedidos.reduce((s, p) => s + (p.taxa_entrega || 0), 0);
  const totalDescontos = filteredPedidos.reduce((s, p) => s + (p.desconto || 0), 0);
  const taxaPP = totalFaturamento * 0.15;

  const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
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
        case "semana": key = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd"); label = `Sem ${format(d, "dd/MM", { locale: ptBR })}`; break;
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
    return FORMAS_PAGAMENTO.map(f => ({
      name: FORMAS_LABELS[f] || f, key: f, qty: map[f].qty, total: map[f].total,
      pct: total > 0 ? (map[f].total / total) * 100 : 0,
      ticket: map[f].qty > 0 ? map[f].total / map[f].qty : 0,
    })).filter(d => d.qty > 0);
  }, [filteredPedidos]);

  const bairroData = useMemo(() => {
    const map: Record<string, { faturamento: number; qty: number }> = {};
    filteredPedidos.forEach(p => {
      const b = p.bairro_entrega || "Não informado";
      if (!map[b]) map[b] = { faturamento: 0, qty: 0 };
      map[b].faturamento += p.valor_total; map[b].qty++;
    });
    return Object.entries(map).map(([bairro, d]) => ({
      bairro, faturamento: d.faturamento, qty: d.qty,
      ticket: d.qty > 0 ? d.faturamento / d.qty : 0, taxaPP: d.faturamento * 0.15,
    })).sort((a, b) => b.faturamento - a.faturamento);
  }, [filteredPedidos]);

  const canalSummary = useMemo(() => {
    const map = new Map<string, { qty: number; total: number }>();
    filteredPedidos.forEach(p => {
      const c = p.canal || "Outros";
      const cur = map.get(c) ?? { qty: 0, total: 0 };
      map.set(c, { qty: cur.qty + 1, total: cur.total + p.valor_total });
    });
    return [...map.entries()]
      .map(([canal, d]) => ({ canal, qty: d.qty, total: d.total,
        pct: totalFaturamento > 0 ? (d.total / totalFaturamento) * 100 : 0 }))
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
      .map(([tipo, d]) => ({ tipo, qty: d.qty, total: d.total,
        pct: totalFaturamento > 0 ? (d.total / totalFaturamento) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filteredPedidos, totalFaturamento]);

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const pizzariaName = selectedPizzaria === "todas"
    ? "Todas as pizzarias"
    : pizzarias.find(p => p.id === selectedPizzaria)?.nome ?? "—";

  const canalTipoCount = (selectedCanais?.length ?? 0) + (selectedTipos?.length ?? 0);
  const hasActiveFilters = quick !== "campanha" || canalTipoCount > 0 || !!valorOp;

  const clearFilters = () => {
    setQuick("campanha"); setSelectedCanais(null); setSelectedTipos(null);
    setValorOp(""); setValorMin(""); setValorMax("");
    setCustomFromStr(""); setCustomToStr("");
  };

  const periodoLabel = quick === "custom"
    ? `${format(dateFrom, "dd/MM")} – ${format(dateTo, "dd/MM")}`
    : QUICK_LABELS[quick as Exclude<QuickPeriod, "custom">];
  const canalTipoLabel = canalTipoCount === 0 ? "Todos" : `${canalTipoCount} filtro${canalTipoCount > 1 ? "s" : ""}`;
  const valorLabel = !valorOp ? "Qualquer" : valorOp === "gt" ? `> R$${valorMin}` : valorOp === "lt" ? `< R$${valorMin}` : `R$${valorMin}–${valorMax}`;

  const activeFiltersList = useMemo(() => {
    const f: string[] = [];
    f.push(`Pizzaria: ${pizzariaName}`);
    f.push(`Período: ${periodoLabel}`);
    if (selectedCanais && selectedCanais.length > 0) f.push(`Canal: ${selectedCanais.join(", ")}`);
    if (selectedTipos && selectedTipos.length > 0) f.push(`Tipo: ${selectedTipos.join(", ")}`);
    if (valorOp && valorMin) {
      if (valorOp === "gt") f.push(`Valor: > R$ ${valorMin}`);
      else if (valorOp === "lt") f.push(`Valor: < R$ ${valorMin}`);
      else if (valorOp === "between") f.push(`Valor: R$ ${valorMin}–${valorMax}`);
    }
    return f;
  }, [pizzariaName, periodoLabel, selectedCanais, selectedTipos, valorOp, valorMin, valorMax]);

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

  const exportSinteticoPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let startY = buildPdfHeader(doc, "Relatório de Vendas — Sintético", activeFiltersList);

    const kpis = [
      { label: "Faturamento Total", value: fmtBRL(totalFaturamento) },
      { label: "Pedidos", value: String(totalPedidos) },
      { label: "Ticket Médio", value: fmtBRL(ticketMedio) },
      { label: "Cupons", value: String(totalCupons) },
    ];
    const boxW = (pageW - 52) / 4;
    kpis.forEach((kpi, i) => {
      const x = 20 + i * (boxW + 4);
      doc.setFillColor(243, 244, 246);
      doc.roundedRect(x, startY, boxW, 42, 4, 4, "F");
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
      doc.text(kpi.label, x + boxW / 2, startY + 13, { align: "center" });
      doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(249, 115, 22);
      doc.text(kpi.value, x + boxW / 2, startY + 32, { align: "center" });
    });
    startY += 56;

    const addSection = (title: string) => {
      if (startY + 40 > pageH - 40) { doc.addPage(); startY = 30; }
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 30, 30);
      doc.text(title, 20, startY);
      startY += 6;
    };
    const hs = { headStyles: { fillColor: [249, 115, 22] as [number,number,number], textColor: [255,255,255] as [number,number,number], fontStyle: "bold" as const, fontSize: 7 }, alternateRowStyles: { fillColor: [249,250,251] as [number,number,number] }, bodyStyles: { fontSize: 7, textColor: [30,30,30] as [number,number,number] }, styles: { cellPadding: 3, lineColor: [230,230,230] as [number,number,number], lineWidth: 0.3 }, margin: { left: 20, right: 20 } };

    addSection("Evolução no Período");
    autoTable(doc, { ...hs, head: [["Período", "Faturamento", "Pedidos"]], body: [...chartData.map(d => [d.label, fmtBRL(d.faturamento), String(d.pedidos)]), ["TOTAL", fmtBRL(totalFaturamento), String(totalPedidos)]], startY });
    startY = (doc as any).lastAutoTable.finalY + 14;

    addSection("Por Forma de Pagamento");
    autoTable(doc, { ...hs, head: [["Forma", "Qtd", "Total (R$)", "%", "Ticket Médio"]], body: paymentData.map(d => [d.name, String(d.qty), fmtBRL(d.total), `${d.pct.toFixed(1)}%`, fmtBRL(d.ticket)]), startY });
    startY = (doc as any).lastAutoTable.finalY + 14;

    addSection("Por Canal");
    autoTable(doc, { ...hs, head: [["Canal", "Qtd", "Total (R$)", "%"]], body: canalSummary.map(d => [d.canal, String(d.qty), fmtBRL(d.total), `${d.pct.toFixed(1)}%`]), startY });
    startY = (doc as any).lastAutoTable.finalY + 14;

    addSection("Por Tipo de Pedido");
    autoTable(doc, { ...hs, head: [["Tipo", "Qtd", "Total (R$)", "%"]], body: tipoSummary.map(d => [d.tipo, String(d.qty), fmtBRL(d.total), `${d.pct.toFixed(1)}%`]), startY });
    startY = (doc as any).lastAutoTable.finalY + 14;

    addSection("Ranking de Bairros (Top 10)");
    autoTable(doc, { ...hs, head: [["#", "Bairro", "Faturamento", "Pedidos", "Ticket Médio"]], body: bairroData.slice(0, 10).map((d, i) => [String(i + 1), d.bairro, fmtBRL(d.faturamento), String(d.qty), fmtBRL(d.ticket)]), startY });

    const totalPgs = doc.getNumberOfPages();
    for (let i = 1; i <= totalPgs; i++) {
      doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${totalPgs}`, pageW / 2, pageH - 10, { align: "center" });
    }
    doc.save(`relatorio-sintetico-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const exportAnaliticoPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let startY = buildPdfHeader(doc, "Relatório de Vendas — Analítico", activeFiltersList);

    const summaryItems = [
      { label: "Faturamento", value: fmtBRL(totalFaturamento) },
      { label: "Pedidos", value: String(totalPedidos) },
      { label: "Ticket Médio", value: fmtBRL(ticketMedio) },
      { label: "Cupons", value: String(totalCupons) },
    ];
    const boxW = (pageW - 52) / 4;
    doc.setFillColor(255, 247, 237);
    doc.rect(20, startY, pageW - 40, 38, "F");
    summaryItems.forEach((item, i) => {
      const x = 20 + i * (boxW + 4);
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(150, 100, 50);
      doc.text(item.label, x + boxW / 2, startY + 12, { align: "center" });
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(249, 115, 22);
      doc.text(item.value, x + boxW / 2, startY + 28, { align: "center" });
    });
    startY += 50;

    autoTable(doc, {
      head: [["Data/Hora", "Valor", "Canal", "Tipo", "Forma Pgto", "Bairro", "Taxa Entrega", "Desconto", "Cupons", "Status"]],
      body: filteredPedidos.map(p => [
        format(new Date(p.data_pedido), "dd/MM/yyyy HH:mm"),
        fmtBRL(p.valor_total),
        p.canal || "—",
        p.tipo_pedido || "—",
        FORMAS_LABELS[p.forma_pagamento || "outros"] || p.forma_pagamento || "—",
        p.bairro_entrega || "—",
        fmtBRL(p.taxa_entrega || 0),
        fmtBRL(p.desconto || 0),
        String(p.cupons_gerados || 0),
        p.status,
      ]),
      foot: [["TOTAL", fmtBRL(totalFaturamento), "", "", "", "", fmtBRL(totalTaxaEntrega), fmtBRL(totalDescontos), String(totalCupons), ""]],
      startY,
      headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6 },
      footStyles: { fillColor: [254, 243, 199], textColor: [30, 30, 30], fontStyle: "bold", fontSize: 6 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      bodyStyles: { fontSize: 6, textColor: [30, 30, 30] },
      styles: { cellPadding: 3, lineColor: [230, 230, 230], lineWidth: 0.3 },
      margin: { left: 20, right: 20, bottom: 24 },
    });

    const totalPgs = doc.getNumberOfPages();
    for (let i = 1; i <= totalPgs; i++) {
      doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${totalPgs}`, pageW / 2, pageH - 10, { align: "center" });
    }
    doc.save(`relatorio-analitico-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const exportExcelVendas = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.aoa_to_sheet([
      ["Data/Hora", "Valor", "Canal", "Tipo", "Forma Pagamento", "Bairro", "Taxa Entrega", "Desconto", "Cupons", "Status"],
      ...filteredPedidos.map(p => [
        format(new Date(p.data_pedido), "dd/MM/yyyy HH:mm"),
        p.valor_total, p.canal || "—", p.tipo_pedido || "—",
        FORMAS_LABELS[p.forma_pagamento || "outros"] || p.forma_pagamento || "—",
        p.bairro_entrega || "—", p.taxa_entrega || 0, p.desconto || 0, p.cupons_gerados || 0, p.status,
      ]),
    ]);
    XLSX.utils.book_append_sheet(wb, ws1, "Pedidos");

    const ws2 = XLSX.utils.aoa_to_sheet([
      ["Forma", "Qtd", "Total (R$)", "%", "Ticket Médio"],
      ...paymentData.map(d => [d.name, d.qty, d.total, `${d.pct.toFixed(1)}%`, d.ticket]),
    ]);
    XLSX.utils.book_append_sheet(wb, ws2, "Formas de Pagamento");

    const ws3 = XLSX.utils.aoa_to_sheet([
      ["#", "Bairro", "Faturamento", "Pedidos", "Ticket Médio", "Taxa PP"],
      ...bairroData.map((d, i) => [i + 1, d.bairro, d.faturamento, d.qty, d.ticket, d.taxaPP]),
    ]);
    XLSX.utils.book_append_sheet(wb, ws3, "Ranking Bairros");

    const ws4 = XLSX.utils.aoa_to_sheet([
      ["Data de exportação", format(new Date(), "dd/MM/yyyy HH:mm")],
      ["Total de registros", filteredPedidos.length],
      ...activeFiltersList.map(f => ["Filtro", f]),
    ]);
    XLSX.utils.book_append_sheet(wb, ws4, "Metadados");

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/octet-stream" }));
    const a = document.createElement("a"); a.href = url; a.download = `desempenho-vendas-${today}.xlsx`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportCSVVendas = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const header = "Data/Hora,Valor,Canal,Tipo,Forma Pagamento,Bairro,Taxa Entrega,Desconto,Cupons,Status";
    const rows = filteredPedidos.map(p => {
      const vals = [
        format(new Date(p.data_pedido), "dd/MM/yyyy HH:mm"),
        String(p.valor_total), p.canal || "—", p.tipo_pedido || "—",
        FORMAS_LABELS[p.forma_pagamento || "outros"] || p.forma_pagamento || "—",
        p.bairro_entrega || "—", String(p.taxa_entrega || 0), String(p.desconto || 0),
        String(p.cupons_gerados || 0), p.status,
      ];
      return vals.map(v => v.includes(",") ? `"${v}"` : v).join(",");
    });
    const csv = [header, ...rows].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `desempenho-vendas-${today}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* ── Filter bar ── */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Período */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={quick !== "campanha" ? "default" : "outline"} size="sm" className="text-xs h-7 gap-1.5">
                  <Clock className="h-3 w-3" />{periodoLabel}<ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="start">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Período</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(Object.keys(QUICK_LABELS) as Exclude<QuickPeriod, "custom">[]).map(p => (
                    <Button key={p} variant={quick === p ? "default" : "outline"} size="sm" className="text-xs h-6 px-2 shrink-0"
                      onClick={() => {
                        if (p === "campanha") { setQuick("campanha"); } else {
                          const [f, t] = getQuickRange(p as Exclude<QuickPeriod, "campanha" | "custom">);
                          setQuick(p); setDateFrom(f); setDateTo(t);
                        }
                      }}>
                      {QUICK_LABELS[p]}
                    </Button>
                  ))}
                </div>
                <div className="h-px bg-border mb-2" />
                <p className="text-[11px] text-muted-foreground mb-1.5">Personalizado</p>
                <div className="flex items-center gap-1.5">
                  <input type="date" value={customFromStr} onChange={e => setCustomFromStr(e.target.value)}
                    className="flex-1 text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring" />
                  <span className="text-xs text-muted-foreground shrink-0">–</span>
                  <input type="date" value={customToStr} onChange={e => setCustomToStr(e.target.value)}
                    className="flex-1 text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring" />
                  <Button size="sm" className="text-xs h-7 shrink-0 px-2" disabled={!customFromStr || !customToStr}
                    onClick={() => { setQuick("custom"); setDateFrom(startOfDay(new Date(customFromStr))); setDateTo(endOfDay(new Date(customToStr))); }}>
                    OK
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Canal/Tipo */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={canalTipoCount > 0 ? "default" : "outline"} size="sm" className="text-xs h-7 gap-1.5">
                  <Filter className="h-3 w-3" />{canalTipoLabel}<ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="start">
                {canaisDisponiveis.length > 0 && (
                  <>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Canal</p>
                    <div className="space-y-1.5 mb-3">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox checked={selectedCanais === null || selectedCanais.length === canaisDisponiveis.length}
                          onCheckedChange={v => setSelectedCanais(v ? null : [])} />
                        Todos os canais
                      </label>
                      {canaisDisponiveis.map(c => (
                        <label key={c} className="flex items-center gap-2 text-xs cursor-pointer">
                          <Checkbox checked={selectedCanais === null || selectedCanais.includes(c)}
                            onCheckedChange={() => toggleCanal(c)} />
                          {c}
                        </label>
                      ))}
                    </div>
                    <div className="h-px bg-border mb-2" />
                  </>
                )}
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tipo de pedido</p>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={selectedTipos === null || selectedTipos.length === TIPOS.length}
                      onCheckedChange={v => setSelectedTipos(v ? null : [])} />
                    Todos os tipos
                  </label>
                  {TIPOS.map(t => (
                    <label key={t.value} className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox checked={selectedTipos === null || selectedTipos.includes(t.value)}
                        onCheckedChange={() => toggleTipo(t.value)} />
                      {t.label}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Valor */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={!!valorOp ? "default" : "outline"} size="sm" className="text-xs h-7 gap-1.5">
                  R$ {valorLabel}<ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" align="start">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Valor do pedido</p>
                <Select value={valorOp || "__none__"} onValueChange={v => setValorOp(v === "__none__" ? "" : v as "gt" | "lt" | "between")}>
                  <SelectTrigger className="h-7 text-xs mb-2"><SelectValue placeholder="Qualquer valor" /></SelectTrigger>
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
                    {valorOp === "between" && (
                      <Input type="number" placeholder="R$" value={valorMax} onChange={e => setValorMax(e.target.value)} className="h-7 text-xs" />
                    )}
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={clearFilters}>
                Limpar filtros
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Exibindo <strong>{filteredPedidos.length}</strong> pedidos com os filtros aplicados
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wide px-2 py-1">Relatórios PDF</DropdownMenuLabel>
                <DropdownMenuItem onClick={exportSinteticoPDF} className="gap-2 text-xs">
                  <BarChart2 className="h-3.5 w-3.5" /> Relatório Sintético
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportAnaliticoPDF} className="gap-2 text-xs">
                  <List className="h-3.5 w-3.5" /> Relatório Analítico
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wide px-2 py-1">Dados</DropdownMenuLabel>
                <DropdownMenuItem onClick={exportExcelVendas} className="gap-2 text-xs">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportCSVVendas} className="gap-2 text-xs">
                  <FileText className="h-3.5 w-3.5" /> CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* ── Chart ── */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <Card><CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground">Total de faturamento</p>
              <p className="text-2xl font-bold text-primary">{fmtBRL(totalFaturamento)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground">Quantidade de pedidos</p>
              <p className="text-2xl font-bold">{totalPedidos}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground">Ticket médio</p>
              <p className="text-2xl font-bold">{fmtBRL(ticketMedio)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground">Quantidade de cupons</p>
              <p className="text-2xl font-bold text-amber-500">{totalCupons}</p>
            </CardContent></Card>
          </div>

          <div className="flex justify-end gap-1">
            {(["hora", "dia", "dia_semana", "semana", "mes"] as const).map(g => (
              <Button key={g} size="sm" variant={groupBy === g ? "default" : "outline"} onClick={() => setGroupBy(g)} className="text-xs">
                {g === "dia_semana" ? "Dia sem." : g.charAt(0).toUpperCase() + g.slice(1)}
              </Button>
            ))}
          </div>

          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, name: string) => [name === "faturamento" ? fmtBRL(v) : v, name === "faturamento" ? "Faturamento" : "Pedidos"]} />
                <Line yAxisId="left" type="monotone" dataKey="faturamento" stroke="#f97316" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="pedidos" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── Detail cards ── */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Total de faturamento</p>
          <p className="text-xl font-bold">{fmtBRL(totalFaturamento)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Total taxa de entrega</p>
          <p className="text-xl font-bold">{fmtBRL(totalTaxaEntrega)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Total de descontos</p>
          <p className="text-xl font-bold">{fmtBRL(totalDescontos)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Taxa Pizza Premiada (15%)</p>
          <p className="text-xl font-bold text-primary">{fmtBRL(taxaPP)}</p>
        </CardContent></Card>
      </div>

      {/* ── Payment analysis ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Análise por forma de pagamento</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                    label={({ name, pct }: any) => `${name}: ${pct.toFixed(1)}%`} labelLine={false}>
                    {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
                  <TableHead className="text-xs text-right">Ticket médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentData.map(d => (
                  <TableRow key={d.key}>
                    <TableCell className="text-xs">{d.name}</TableCell>
                    <TableCell className="text-xs text-right">{d.qty}</TableCell>
                    <TableCell className="text-xs text-right">{fmtBRL(d.total)}</TableCell>
                    <TableCell className="text-xs text-right">{d.pct.toFixed(1)}%</TableCell>
                    <TableCell className="text-xs text-right">{fmtBRL(d.ticket)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Bairro analysis ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Análise por bairro</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-12">#</TableHead>
                <TableHead className="text-xs">Bairro</TableHead>
                <TableHead className="text-xs text-right">Faturamento</TableHead>
                <TableHead className="text-xs text-right">Pedidos</TableHead>
                <TableHead className="text-xs text-right">Ticket médio</TableHead>
                <TableHead className="text-xs text-right">Taxa PP (15%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bairroData.map((d, i) => (
                <TableRow key={d.bairro}>
                  <TableCell className="text-xs font-medium">{i + 1}</TableCell>
                  <TableCell className="text-xs">{d.bairro}</TableCell>
                  <TableCell className="text-xs text-right">{fmtBRL(d.faturamento)}</TableCell>
                  <TableCell className="text-xs text-right">{d.qty}</TableCell>
                  <TableCell className="text-xs text-right">{fmtBRL(d.ticket)}</TableCell>
                  <TableCell className="text-xs text-right">{fmtBRL(d.taxaPP)}</TableCell>
                </TableRow>
              ))}
              {bairroData.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">Nenhum dado disponível</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
