import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import {
  format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subMonths, subWeeks, startOfDay, endOfDay, getDay,
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
import {
  ChevronDown, ChevronLeft, ChevronRight, Clock, Filter,
  Download, FileSpreadsheet, FileText, BarChart2, List,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { usePizzarias } from "@/contexts/PizzariasContext";
import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────
// Constantes
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

// ─────────────────────────────────────────────────────────────
// Helpers de período
// ─────────────────────────────────────────────────────────────
type QuickPeriod = "campanha" | "hoje" | "ontem" | "esta_semana" | "semana_passada" | "este_mes" | "mes_passado" | "2m" | "3m" | "6m" | "custom";

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

// ─────────────────────────────────────────────────────────────
// Helpers PDF — mesma paleta e design de DesempenhoClientes
// ─────────────────────────────────────────────────────────────
const C = {
  slate900: [15,  23,  42]  as [number, number, number],
  slate700: [51,  65,  85]  as [number, number, number],
  slate500: [100, 116, 139] as [number, number, number],
  slate200: [226, 232, 240] as [number, number, number],
  slate50:  [248, 250, 252] as [number, number, number],
  white:    [255, 255, 255] as [number, number, number],
  orange:   [249, 115,  22] as [number, number, number],
};

const TABLE_STYLES = {
  headStyles: { fillColor: C.slate900, textColor: C.white, fontStyle: "bold" as const, fontSize: 8, cellPadding: 6 },
  alternateRowStyles: { fillColor: C.slate50 },
  bodyStyles: { fontSize: 8, textColor: C.slate700, cellPadding: 5 },
  styles: { lineColor: C.slate200, lineWidth: 0.4 },
  margin: { left: 20, right: 20, bottom: 28 },
};

async function loadLetteringDataUrl(): Promise<string | undefined> {
  try {
    const res = await fetch("/lettering-pizza-premiada.png");
    const blob = await res.blob();
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch { return undefined; }
}

function buildPdfHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  filterLines: string[],
  letteringDataUrl?: string,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const availW = pageW - 40;
  const HEADER_H = 80;

  doc.setFillColor(250, 250, 252);
  doc.rect(0, 0, pageW, HEADER_H, "F");

  // Col 1: Lettering (25%)
  const col1W = availW * 0.25;
  const col1X = 20;
  if (letteringDataUrl) {
    const imgH = 44; const imgW = imgH * 2.2;
    const imgX = col1X + (col1W - imgW) / 2;
    const imgY = (HEADER_H - imgH) / 2;
    doc.addImage(letteringDataUrl, "PNG", imgX, imgY, imgW, imgH);
  }

  // Divider 1
  const div1X = col1X + col1W + 8;
  doc.setDrawColor(...C.slate200); doc.setLineWidth(0.6);
  doc.line(div1X, 12, div1X, HEADER_H - 12);

  // Col 2: Título (38%)
  const col2X = div1X + 12;
  const col2W = availW * 0.38;
  doc.setFillColor(...C.orange);
  doc.rect(col2X, 0, col2W, 3, "F");
  doc.setTextColor(...C.slate900);
  doc.setFontSize(14); doc.setFont("helvetica", "bold");
  doc.text(title, col2X, 24, { maxWidth: col2W });
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.slate500);
  doc.text(subtitle, col2X, 38);
  doc.setFontSize(7);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, col2X, 52);

  // Divider 2
  const div2X = col2X + col2W + 8;
  doc.line(div2X, 12, div2X, HEADER_H - 12);

  // Col 3: Filtros
  const col3X = div2X + 12;
  doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.slate500);
  doc.text("FILTROS APLICADOS", col3X, 20);
  doc.setFont("helvetica", "normal"); doc.setTextColor(...C.slate700);
  const col3W = pageW - col3X - 16;
  if (filterLines.length === 0) {
    doc.setTextColor(...C.slate500); doc.text("Sem filtros avançados", col3X, 32);
  } else {
    let lineY = 31;
    filterLines.forEach(line => {
      doc.setFontSize(7);
      doc.text(`• ${line}`, col3X, lineY, { maxWidth: col3W });
      lineY += 9;
    });
  }

  doc.setDrawColor(...C.slate200); doc.setLineWidth(0.5);
  doc.line(20, HEADER_H + 2, pageW - 20, HEADER_H + 2);
  return HEADER_H + 14;
}

function addPdfFooter(doc: jsPDF, reportTitle: string) {
  const total = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.slate200); doc.setLineWidth(0.5);
    doc.line(20, pageH - 20, pageW - 20, pageH - 20);
    doc.setFontSize(7); doc.setTextColor(...C.slate500);
    doc.text(reportTitle, 20, pageH - 9);
    doc.text(`Página ${i} de ${total}`, pageW / 2, pageH - 9, { align: "center" });
    doc.text(format(new Date(), "dd/MM/yyyy"), pageW - 20, pageH - 9, { align: "right" });
  }
}

function drawSectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFillColor(...C.orange);
  doc.rect(20, y, 2, 10, "F");
  doc.setTextColor(...C.slate900);
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text(text, 27, y + 8);
  return y + 18;
}

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────
type Pedido = {
  id: string; data_pedido: string; valor_total: number; cupons_gerados: number;
  canal: string; status: string; forma_pagamento: string | null;
  tipo_pedido: string | null; taxa_entrega: number; desconto: number;
  bairro_entrega: string | null; horario_pedido: string | null;
  pizzaria_id: string; campanha_id: string;
};

type DesempenhoContext = {
  selectedPizzaria: string;
  selectedCampanha: string;
  setExportNode: (node: ReactNode) => void;
  advancedFilterSlot: HTMLDivElement | null;
};

// ─────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────
export default function DesempenhoVendas() {
  const { selectedPizzaria, selectedCampanha, setExportNode, advancedFilterSlot } =
    useOutletContext<DesempenhoContext>();
  const { pizzarias } = usePizzarias();

  // Filtros
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

  // UI
  const [groupBy, setGroupBy] = useState<"hora" | "dia" | "dia_semana" | "semana" | "mes">("dia");
  const [pageBairros, setPageBairros] = useState(1);

  // Dados
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

  const canaisDisponiveis = useMemo(
    () => [...new Set(pedidos.map(p => p.canal))].filter(Boolean).sort(),
    [pedidos],
  );

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

  useEffect(() => { setPageBairros(1); }, [filteredPedidos]);

  // ── KPIs ──────────────────────────────────────────────────────
  const totalFaturamento = filteredPedidos.reduce((s, p) => s + p.valor_total, 0);
  const totalPedidos = filteredPedidos.length;
  const ticketMedio = totalPedidos > 0 ? totalFaturamento / totalPedidos : 0;
  const totalCupons = useMemo(
    () => filteredPedidos.reduce((s, p) => s + (p.cupons_gerados || 0), 0),
    [filteredPedidos],
  );
  const totalTaxaEntrega = filteredPedidos.reduce((s, p) => s + (p.taxa_entrega || 0), 0);
  const totalDescontos = filteredPedidos.reduce((s, p) => s + (p.desconto || 0), 0);
  const taxaPP = totalFaturamento * 0.15;

  // ── Gráficos / tabelas ────────────────────────────────────────
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

  // ── Helpers de UI ─────────────────────────────────────────────
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const pizzariaName = selectedPizzaria === "todas"
    ? "Todas as pizzarias"
    : pizzarias.find(p => p.id === selectedPizzaria)?.nome ?? "—";

  const periodoLabel = quick === "custom"
    ? `${format(dateFrom, "dd/MM")} – ${format(dateTo, "dd/MM")}`
    : QUICK_LABELS[quick as Exclude<QuickPeriod, "custom">];

  const canalTipoCount = (selectedCanais?.length ?? 0) + (selectedTipos?.length ?? 0);
  const hasActiveFilters = quick !== "campanha" || canalTipoCount > 0 || !!valorOp;
  const valorLabel = !valorOp ? "Qualquer"
    : valorOp === "gt" ? `> R$${valorMin}`
    : valorOp === "lt" ? `< R$${valorMin}`
    : `R$${valorMin}–${valorMax}`;

  const clearFilters = () => {
    setQuick("campanha"); setSelectedCanais(null); setSelectedTipos(null);
    setValorOp(""); setValorMin(""); setValorMax("");
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

  // ── Paginação de bairros ──────────────────────────────────────
  const bairrosPageSize = 10;
  const totalPagesBairros = Math.max(1, Math.ceil(bairroData.length / bairrosPageSize));
  const pagedBairros = bairroData.slice(
    (pageBairros - 1) * bairrosPageSize,
    pageBairros * bairrosPageSize,
  );

  // ── Export ────────────────────────────────────────────────────
  useEffect(() => {
    if (!setExportNode) return;
    const today = format(new Date(), "yyyy-MM-dd");

    // Linhas de filtros para o cabeçalho do PDF
    const filterLines: string[] = [];
    filterLines.push(`Pizzaria: ${pizzariaName}`);
    filterLines.push(`Período: ${periodoLabel}`);
    if (selectedCanais && selectedCanais.length > 0)
      filterLines.push(`Canal: ${selectedCanais.join(", ")}`);
    if (selectedTipos && selectedTipos.length > 0)
      filterLines.push(`Tipo: ${selectedTipos.map(t => TIPOS.find(x => x.value === t)?.label ?? t).join(", ")}`);
    if (valorOp && valorMin) {
      if (valorOp === "gt") filterLines.push(`Valor: > R$ ${valorMin}`);
      else if (valorOp === "lt") filterLines.push(`Valor: < R$ ${valorMin}`);
      else if (valorOp === "between") filterLines.push(`Valor: R$ ${valorMin} – R$ ${valorMax}`);
    }
    filterLines.push(`Total exportado: ${filteredPedidos.length} pedido${filteredPedidos.length !== 1 ? "s" : ""}`);

    // Título dinâmico
    const titleParts: string[] = [];
    if (quick !== "campanha") titleParts.push(periodoLabel);
    if (selectedCanais && selectedCanais.length > 0)
      titleParts.push(`Canal: ${selectedCanais.join(", ")}`);
    if (selectedTipos && selectedTipos.length > 0)
      titleParts.push(selectedTipos.map(t => TIPOS.find(x => x.value === t)?.label ?? t).join(", "));
    if (valorOp && valorMin) titleParts.push(`Valor: ${valorLabel}`);
    const reportTitle = titleParts.length === 0 ? "Relatório de Vendas"
      : titleParts.length === 1 ? `Vendas — ${titleParts[0]}`
      : `Vendas — ${titleParts.slice(0, 2).join(", ")}${titleParts.length > 2 ? ` +${titleParts.length - 2}` : ""}`;
    const fileSlug = reportTitle.toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    // ── Sintético PDF ─────────────────────────────────────────
    const exportSinteticoPDF = async () => {
      const lettering = await loadLetteringDataUrl();
      const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
      const pageW = doc.internal.pageSize.getWidth();
      let y = buildPdfHeader(doc, reportTitle, "Desempenho · Sintético", filterLines, lettering);

      // KPI boxes
      const kpis = [
        { label: "Faturamento Total", value: fmtBRL(totalFaturamento), monetary: true },
        { label: "Pedidos", value: String(totalPedidos), monetary: false },
        { label: "Ticket Médio", value: fmtBRL(ticketMedio), monetary: true },
        { label: "Cupons Gerados", value: String(totalCupons), monetary: false },
      ];
      const gap = 8;
      const boxW = (pageW - 40 - gap * 3) / 4;
      const boxH = 62;
      kpis.forEach((kpi, i) => {
        const x = 20 + i * (boxW + gap);
        doc.setFillColor(...C.white);
        doc.setDrawColor(...C.slate200); doc.setLineWidth(0.6);
        doc.roundedRect(x, y, boxW, boxH, 4, 4, "FD");
        doc.setFillColor(...C.orange);
        doc.rect(x, y, boxW, 2.5, "F");
        doc.setTextColor(...C.slate500);
        doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
        doc.text(kpi.label, x + boxW / 2, y + 18, { align: "center" });
        doc.setTextColor(...C.slate900);
        doc.setFontSize(kpi.monetary ? 10 : 18); doc.setFont("helvetica", "bold");
        doc.text(kpi.value, x + boxW / 2, y + (kpi.monetary ? 40 : 46), { align: "center" });
      });
      y += boxH + 24;

      // Evolução no período
      y = drawSectionTitle(doc, "Evolução no Período", y);
      autoTable(doc, {
        head: [["Período", "Faturamento", "Pedidos"]],
        body: [
          ...chartData.map(d => [d.label, fmtBRL(d.faturamento), String(d.pedidos)]),
          ["TOTAL", fmtBRL(totalFaturamento), String(totalPedidos)],
        ],
        startY: y, ...TABLE_STYLES,
        columnStyles: { 1: { halign: "right" as const }, 2: { halign: "center" as const } },
      });
      y = (doc as any).lastAutoTable.finalY + 24;

      // Por forma de pagamento
      y = drawSectionTitle(doc, "Por Forma de Pagamento", y);
      autoTable(doc, {
        head: [["Forma", "Qtd", "Total (R$)", "%", "Ticket Médio"]],
        body: paymentData.map(d => [d.name, String(d.qty), fmtBRL(d.total), `${d.pct.toFixed(1)}%`, fmtBRL(d.ticket)]),
        startY: y, ...TABLE_STYLES,
        columnStyles: {
          1: { halign: "center" as const }, 2: { halign: "right" as const },
          3: { halign: "center" as const }, 4: { halign: "right" as const },
        },
      });
      y = (doc as any).lastAutoTable.finalY + 24;

      // Por canal
      y = drawSectionTitle(doc, "Por Canal", y);
      autoTable(doc, {
        head: [["Canal", "Qtd", "Total (R$)", "%"]],
        body: canalSummary.map(d => [d.canal, String(d.qty), fmtBRL(d.total), `${d.pct.toFixed(1)}%`]),
        startY: y, ...TABLE_STYLES,
        columnStyles: {
          1: { halign: "center" as const }, 2: { halign: "right" as const }, 3: { halign: "center" as const },
        },
      });
      y = (doc as any).lastAutoTable.finalY + 24;

      // Por tipo de pedido
      y = drawSectionTitle(doc, "Por Tipo de Pedido", y);
      autoTable(doc, {
        head: [["Tipo", "Qtd", "Total (R$)", "%"]],
        body: tipoSummary.map(d => [d.tipo, String(d.qty), fmtBRL(d.total), `${d.pct.toFixed(1)}%`]),
        startY: y, ...TABLE_STYLES,
        columnStyles: {
          1: { halign: "center" as const }, 2: { halign: "right" as const }, 3: { halign: "center" as const },
        },
      });
      y = (doc as any).lastAutoTable.finalY + 24;

      // Ranking de bairros
      y = drawSectionTitle(doc, "Ranking de Bairros (Top 10)", y);
      autoTable(doc, {
        head: [["#", "Bairro", "Faturamento", "Pedidos", "Ticket Médio"]],
        body: bairroData.slice(0, 10).map((d, i) => [
          String(i + 1), d.bairro, fmtBRL(d.faturamento), String(d.qty), fmtBRL(d.ticket),
        ]),
        startY: y, ...TABLE_STYLES,
        columnStyles: {
          0: { halign: "center" as const }, 2: { halign: "right" as const },
          3: { halign: "center" as const }, 4: { halign: "right" as const },
        },
      });

      addPdfFooter(doc, `${reportTitle} — Sintético`);
      doc.save(`${fileSlug}-sintetico-${today}.pdf`);
    };

    // ── Analítico PDF ─────────────────────────────────────────
    const exportAnaliticoPDF = async () => {
      const lettering = await loadLetteringDataUrl();
      const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
      const pageW = doc.internal.pageSize.getWidth();
      let y = buildPdfHeader(doc, reportTitle, "Desempenho · Analítico", filterLines, lettering);

      // Totais em boxes
      const summaryItems = [
        { label: "Faturamento Total", value: fmtBRL(totalFaturamento) },
        { label: "Pedidos", value: String(totalPedidos) },
        { label: "Ticket Médio", value: fmtBRL(ticketMedio) },
        { label: "Cupons Gerados", value: String(totalCupons) },
      ];
      const gap = 8;
      const boxW = (pageW - 40 - gap * 3) / 4;
      const boxH = 52;
      summaryItems.forEach((item, i) => {
        const x = 20 + i * (boxW + gap);
        doc.setFillColor(...C.slate50);
        doc.setDrawColor(...C.slate200); doc.setLineWidth(0.5);
        doc.roundedRect(x, y, boxW, boxH, 4, 4, "FD");
        doc.setTextColor(...C.slate500);
        doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
        doc.text(item.label, x + boxW / 2, y + 15, { align: "center" });
        doc.setTextColor(...C.slate900);
        doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text(item.value, x + boxW / 2, y + 37, { align: "center" });
      });
      y += boxH + 20;

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
        startY: y,
        headStyles: { fillColor: C.slate900, textColor: C.white, fontStyle: "bold", fontSize: 7, cellPadding: 5 },
        footStyles: { fillColor: C.slate50, textColor: C.slate900, fontStyle: "bold", fontSize: 7, cellPadding: 5 },
        alternateRowStyles: { fillColor: C.slate50 },
        bodyStyles: { fontSize: 6.5, textColor: C.slate700, cellPadding: 4 },
        styles: { lineColor: C.slate200, lineWidth: 0.4 },
        margin: { left: 20, right: 20, bottom: 28 },
        columnStyles: {
          1: { halign: "right" as const }, 6: { halign: "right" as const },
          7: { halign: "right" as const }, 8: { halign: "center" as const },
        },
      });

      addPdfFooter(doc, `${reportTitle} — Analítico`);
      doc.save(`${fileSlug}-analitico-${today}.pdf`);
    };

    // ── Excel ─────────────────────────────────────────────────
    const exportExcel = () => {
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
        ["Filtros aplicados", filterLines.join(" · ")],
      ]);
      XLSX.utils.book_append_sheet(wb, ws4, "Metadados");

      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const url = URL.createObjectURL(new Blob([buf], { type: "application/octet-stream" }));
      const a = document.createElement("a"); a.href = url; a.download = `desempenho-vendas-${today}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
    };

    // ── CSV ───────────────────────────────────────────────────
    const exportCSV = () => {
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

    setExportNode(
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
          <DropdownMenuItem onClick={exportExcel} className="gap-2 text-xs">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportCSV} className="gap-2 text-xs">
            <FileText className="h-3.5 w-3.5" /> CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    return () => setExportNode(null);
  }, [
    filteredPedidos, setExportNode, chartData, paymentData, bairroData, canalSummary, tipoSummary,
    totalFaturamento, totalPedidos, ticketMedio, totalCupons, totalTaxaEntrega, totalDescontos,
    quick, selectedCanais, selectedTipos, valorOp, valorMin, valorMax, pizzariaName, periodoLabel,
  ]);

  // ─────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Filtros avançados injetados na barra do layout ── */}
      {advancedFilterSlot && createPortal(
        <>
          {/* Período */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={quick !== "campanha" ? "default" : "outline"} size="sm" className="text-xs h-8 gap-1.5">
                <Clock className="h-3 w-3" />{periodoLabel}<ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="start">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Período</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(Object.keys(QUICK_LABELS) as Exclude<QuickPeriod, "custom">[]).map(p => (
                  <Button
                    key={p} variant={quick === p ? "default" : "outline"} size="sm"
                    className="text-xs h-6 px-2 shrink-0"
                    onClick={() => {
                      if (p === "campanha") { setQuick("campanha"); } else {
                        const [f, t] = getQuickRange(p as Exclude<QuickPeriod, "campanha" | "custom">);
                        setQuick(p); setDateFrom(f); setDateTo(t);
                      }
                    }}
                  >
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
                <Button size="sm" className="text-xs h-7 shrink-0 px-2"
                  disabled={!customFromStr || !customToStr}
                  onClick={() => {
                    setQuick("custom");
                    setDateFrom(startOfDay(new Date(customFromStr)));
                    setDateTo(endOfDay(new Date(customToStr)));
                  }}
                >
                  OK
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Canal / Tipo */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={canalTipoCount > 0 ? "default" : "outline"} size="sm" className="text-xs h-8 gap-1.5">
                <Filter className="h-3 w-3" />
                {canalTipoCount === 0 ? "Canal/Tipo" : `${canalTipoCount} filtro${canalTipoCount > 1 ? "s" : ""}`}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
              {canaisDisponiveis.length > 0 && (
                <>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Canal</p>
                  <div className="space-y-1.5 mb-3">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={selectedCanais === null || selectedCanais.length === canaisDisponiveis.length}
                        onCheckedChange={v => setSelectedCanais(v ? null : [])}
                      />
                      Todos os canais
                    </label>
                    {canaisDisponiveis.map(c => (
                      <label key={c} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={selectedCanais === null || selectedCanais.includes(c)}
                          onCheckedChange={() => toggleCanal(c)}
                        />
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
                  <Checkbox
                    checked={selectedTipos === null || selectedTipos.length === TIPOS.length}
                    onCheckedChange={v => setSelectedTipos(v ? null : [])}
                  />
                  Todos os tipos
                </label>
                {TIPOS.map(t => (
                  <label key={t.value} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={selectedTipos === null || selectedTipos.includes(t.value)}
                      onCheckedChange={() => toggleTipo(t.value)}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Valor */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={!!valorOp ? "default" : "outline"} size="sm" className="text-xs h-8 gap-1.5">
                {!!valorOp ? valorLabel : "Valor"}<ChevronDown className="h-3 w-3" />
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
                  <Input type="number" placeholder="R$" value={valorMin}
                    onChange={e => setValorMin(e.target.value)} className="h-7 text-xs" />
                  {valorOp === "between" && (
                    <Input type="number" placeholder="R$" value={valorMax}
                      onChange={e => setValorMax(e.target.value)} className="h-7 text-xs" />
                  )}
                </div>
              )}
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="text-xs h-8 text-muted-foreground" onClick={clearFilters}>
              Limpar
            </Button>
          )}
        </>,
        advancedFilterSlot,
      )}

      {/* ── KPI cards ── */}
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

      {/* ── Evolução no período ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Evolução no período</CardTitle>
            <div className="flex gap-1">
              {(["hora", "dia", "dia_semana", "semana", "mes"] as const).map(g => (
                <Button key={g} size="sm" variant={groupBy === g ? "default" : "outline"}
                  onClick={() => setGroupBy(g)} className="text-xs h-7">
                  {g === "dia_semana" ? "Dia sem." : g.charAt(0).toUpperCase() + g.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      name === "faturamento" ? fmtBRL(v) : v,
                      name === "faturamento" ? "Faturamento" : "Pedidos",
                    ]}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="faturamento" stroke="#f97316" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="pedidos" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Exibindo <strong>{filteredPedidos.length}</strong> pedidos com os filtros aplicados
          </p>
        </CardContent>
      </Card>

      {/* ── Detalhes financeiros ── */}
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

      {/* ── Forma de pagamento ── */}
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

      {/* ── Ranking de bairros ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Análise por bairro</CardTitle>
            {totalPagesBairros > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{bairroData.length} bairros</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                    disabled={pageBairros === 1} onClick={() => setPageBairros(p => p - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs text-muted-foreground w-16 text-center">
                    {pageBairros} / {totalPagesBairros}
                  </span>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                    disabled={pageBairros === totalPagesBairros} onClick={() => setPageBairros(p => p + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
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
              {pagedBairros.map((d, i) => (
                <TableRow key={d.bairro}>
                  <TableCell className="text-xs font-medium">
                    {(pageBairros - 1) * bairrosPageSize + i + 1}
                  </TableCell>
                  <TableCell className="text-xs">{d.bairro}</TableCell>
                  <TableCell className="text-xs text-right">{fmtBRL(d.faturamento)}</TableCell>
                  <TableCell className="text-xs text-right">{d.qty}</TableCell>
                  <TableCell className="text-xs text-right">{fmtBRL(d.ticket)}</TableCell>
                  <TableCell className="text-xs text-right">{fmtBRL(d.taxaPP)}</TableCell>
                </TableRow>
              ))}
              {bairroData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                    Nenhum dado disponível
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
