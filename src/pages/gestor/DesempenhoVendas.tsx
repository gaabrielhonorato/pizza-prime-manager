import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import {
  format, subDays, startOfWeek, startOfMonth,
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
import {
  ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal,
  Download, FileSpreadsheet, FileText, BarChart2, List, Layers, CalendarDays,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { seqToLuckyRandom } from "@/lib/lucky-numbers";
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
const TIPO_META: Record<string, { emoji: string; label: string }> = {
  delivery: { emoji: "🛵", label: "Delivery" },
  retirada: { emoji: "🛍️", label: "Retirada" },
  local:    { emoji: "🍽️", label: "No local" },
};
const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// ─────────────────────────────────────────────────────────────
// Helpers de período
// ─────────────────────────────────────────────────────────────
type QuickPeriod = "campanha" | "hoje" | "ontem" | "esta_semana" | "este_mes" | "custom";

const QUICK_LABELS: Record<Exclude<QuickPeriod, "custom">, string> = {
  campanha: "Máximo",
  hoje: "Hoje",
  ontem: "Ontem",
  esta_semana: "Esta semana",
  este_mes: "Este mês",
};

function getQuickRange(p: Exclude<QuickPeriod, "campanha" | "custom">): [Date, Date] {
  const now = new Date();
  switch (p) {
    case "hoje": return [startOfDay(now), endOfDay(now)];
    case "ontem": return [startOfDay(subDays(now, 1)), endOfDay(subDays(now, 1))];
    case "esta_semana": return [startOfWeek(now, { weekStartsOn: 1 }), endOfDay(now)];
    case "este_mes": return [startOfMonth(now), endOfDay(now)];
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
  const HEADER_H = 100;

  doc.setFillColor(250, 250, 252);
  doc.rect(0, 0, pageW, HEADER_H, "F");

  // col1 = col3 (mesma largura); col2 maior no meio
  // total: 20 + col1W + 20(div) + col2W + 20(div) + col3W + 20 = pageW
  const col1W = availW * 0.24;
  const col3W = col1W;
  const col2W = availW - 40 - 2 * col1W;

  // Col 1: Lettering — alinhado à esquerda
  const col1X = 20;
  if (letteringDataUrl) {
    const imgH = 52; const imgW = imgH * 2.2;
    const imgY = (HEADER_H - imgH) / 2;
    doc.addImage(letteringDataUrl, "PNG", col1X, imgY, imgW, imgH);
  }

  // Divider 1
  const div1X = col1X + col1W + 8;
  doc.setDrawColor(...C.slate200); doc.setLineWidth(0.6);
  doc.line(div1X, 12, div1X, HEADER_H - 12);

  // Col 2: Título — centralizado
  const col2X = div1X + 12;
  const col2CX = col2X + col2W / 2;

  doc.setTextColor(...C.slate900);
  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text(title, col2CX, 32, { align: "center", maxWidth: col2W });
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.slate500);
  doc.text(`${subtitle}  ·  Gerado em ${format(new Date(), "dd/MM/yyyy 'as' HH:mm")}`, col2CX, 54, { align: "center", maxWidth: col2W });

  // Divider 2
  const div2X = col2X + col2W + 8;
  doc.setDrawColor(...C.slate200); doc.setLineWidth(0.6);
  doc.line(div2X, 12, div2X, HEADER_H - 12);

  // Col 3: Filtros — alinhado à direita
  const col3RightX = pageW - 20; // = div2X + 12 + col3W
  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.orange);
  doc.text("FILTROS APLICADOS", col3RightX, 22, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setTextColor(...C.slate900);
  if (filterLines.length === 0) {
    doc.setTextColor(...C.slate500); doc.setFontSize(8);
    doc.text("Sem filtros avancados", col3RightX, 35, { align: "right" });
  } else {
    const MAX_LINES = 6;
    const visible = filterLines.slice(0, MAX_LINES);
    const overflow = filterLines.length - MAX_LINES;
    let lineY = 34;
    visible.forEach(line => {
      doc.setFontSize(9);
      doc.text(`• ${line}`, col3RightX, lineY, { align: "right", maxWidth: col3W });
      lineY += 10;
    });
    if (overflow > 0) {
      doc.setFontSize(8); doc.setTextColor(...C.slate500);
      doc.text(`+ ${overflow} mais`, col3RightX, lineY, { align: "right" });
    }
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
  advancedFilterSlot2: HTMLDivElement | null;
};

// ─────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────
export default function DesempenhoVendas() {
  const { selectedPizzaria, selectedCampanha, setExportNode, advancedFilterSlot, advancedFilterSlot2 } =
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
  const [selectedFormas, setSelectedFormas] = useState<string[] | null>(null);
  const [cuponMin, setCuponMin] = useState("");
  const [cuponMax, setCuponMax] = useState("");
  const [valorOp, setValorOp] = useState<"gt" | "lt" | "between" | "">("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");

  // ── Filtro 2 (refinamento adicional) ─────────────────────────
  const [quick2, setQuick2] = useState<QuickPeriod>("campanha");
  const [dateFrom2, setDateFrom2] = useState<Date>(() => startOfDay(subDays(new Date(), 29)));
  const [dateTo2, setDateTo2] = useState<Date>(() => endOfDay(new Date()));
  const [customFromStr2, setCustomFromStr2] = useState("");
  const [customToStr2, setCustomToStr2] = useState("");
  const [selectedCanais2, setSelectedCanais2] = useState<string[] | null>(null);
  const [selectedTipos2, setSelectedTipos2] = useState<string[] | null>(null);
  const [selectedFormas2, setSelectedFormas2] = useState<string[] | null>(null);
  const [cuponMin2, setCuponMin2] = useState("");
  const [cuponMax2, setCuponMax2] = useState("");
  const [valorOp2, setValorOp2] = useState<"gt" | "lt" | "between" | "">("");
  const [advancedOpen2, setAdvancedOpen2] = useState(false);
  const [valorMin2, setValorMin2] = useState("");
  const [valorMax2, setValorMax2] = useState("");

  // UI
  const [groupBy, setGroupBy] = useState<"hora" | "dia" | "dia_semana" | "semana" | "mes">("dia");
  const [pageBairros, setPageBairros] = useState(1);
  const [selectedFormaChart, setSelectedFormaChart] = useState<string | null>(null);

  // Dados
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [pedidoLuckyMap, setPedidoLuckyMap] = useState<Map<string, string[]>>(new Map());
  const [pageAnalitico, setPageAnalitico] = useState(1);

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

  useEffect(() => {
    if (!pedidos.length) { setPedidoLuckyMap(new Map()); return; }
    const compute = async () => {
      const campanhaIds = [...new Set(pedidos.map(p => p.campanha_id).filter(Boolean))];
      const resultMap = new Map<string, string[]>();
      await Promise.all(campanhaIds.map(async campanhaId => {
        const [{ data: campRow }, { data: cupons }] = await Promise.all([
          supabase.from("campanhas").select("num_series").eq("id", campanhaId).single(),
          supabase.from("cupons").select("pedido_id, quantidade")
            .eq("campanha_id", campanhaId).eq("status", "validado")
            .order("criado_em", { ascending: true }),
        ]);
        const numSeries: number = (campRow as any)?.num_series ?? 5;
        if (!cupons) return;
        let seq = 1;
        for (const c of cupons as any[]) {
          const pedidoId: string | null = c.pedido_id;
          const qty: number = c.quantidade || 0;
          const nums: string[] = [];
          for (let i = 0; i < qty; i++) {
            nums.push(seqToLuckyRandom(seq, numSeries, campanhaId));
            seq++;
          }
          if (pedidoId) {
            const existing = resultMap.get(pedidoId) ?? [];
            resultMap.set(pedidoId, [...existing, ...nums]);
          }
        }
      }));
      setPedidoLuckyMap(new Map(resultMap));
    };
    compute();
  }, [pedidos]);

  const canaisDisponiveis = useMemo(
    () => [...new Set(pedidos.map(p => p.canal))].filter(Boolean).sort(),
    [pedidos],
  );

  const filteredByAdv1 = useMemo(() => {
    let list = (quick === "campanha"
      ? [...pedidos]
      : pedidos.filter(p => { const d = new Date(p.data_pedido); return d >= dateFrom && d <= dateTo; })
    ).filter(p => p.status !== "cancelado");

    if (selectedCanais && selectedCanais.length > 0)
      list = list.filter(p => selectedCanais.includes(p.canal));
    if (selectedTipos && selectedTipos.length > 0)
      list = list.filter(p => p.tipo_pedido && selectedTipos.includes(p.tipo_pedido));
    if (selectedFormas && selectedFormas.length > 0)
      list = list.filter(p => selectedFormas.includes(p.forma_pagamento || "outros"));
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

  const filteredPedidos = useMemo(() => {
    let list = quick2 !== "campanha"
      ? filteredByAdv1.filter(p => { const d = new Date(p.data_pedido); return d >= dateFrom2 && d <= dateTo2; })
      : [...filteredByAdv1];
    if (selectedCanais2 && selectedCanais2.length > 0)
      list = list.filter(p => selectedCanais2.includes(p.canal));
    if (selectedTipos2 && selectedTipos2.length > 0)
      list = list.filter(p => p.tipo_pedido && selectedTipos2.includes(p.tipo_pedido));
    if (selectedFormas2 && selectedFormas2.length > 0)
      list = list.filter(p => selectedFormas2.includes(p.forma_pagamento || "outros"));
    if (cuponMin2 !== "") list = list.filter(p => (p.cupons_gerados || 0) >= parseInt(cuponMin2));
    if (cuponMax2 !== "") list = list.filter(p => (p.cupons_gerados || 0) <= parseInt(cuponMax2));
    if (valorOp2 && valorMin2) {
      const v1 = parseFloat(valorMin2), v2 = valorMax2 ? parseFloat(valorMax2) : 0;
      list = list.filter(p => {
        switch (valorOp2) {
          case "gt": return p.valor_total > v1;
          case "lt": return p.valor_total < v1;
          case "between": return p.valor_total >= v1 && p.valor_total <= v2;
          default: return true;
        }
      });
    }
    if (selectedFormaChart) list = list.filter(p => (p.forma_pagamento || "outros") === selectedFormaChart);
    return list;
  }, [filteredByAdv1, quick2, dateFrom2, dateTo2, selectedCanais2, selectedTipos2, selectedFormas2, cuponMin2, cuponMax2, valorOp2, valorMin2, valorMax2, selectedFormaChart]);

  useEffect(() => { setPageBairros(1); }, [filteredPedidos]);
  useEffect(() => { setPageAnalitico(1); }, [filteredPedidos]);

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
    const map: Record<string, { label: string; faturamento: number; pedidos: number; cupons: number }> = {};
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
      if (!map[key]) map[key] = { label, faturamento: 0, pedidos: 0, cupons: 0 };
      map[key].faturamento += p.valor_total;
      map[key].pedidos += 1;
      map[key].cupons += p.cupons_gerados || 0;
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
    const map: Record<string, { faturamento: number; qty: number; cupons: number }> = {};
    filteredPedidos.forEach(p => {
      const b = p.bairro_entrega || "Não informado";
      if (!map[b]) map[b] = { faturamento: 0, qty: 0, cupons: 0 };
      map[b].faturamento += p.valor_total; map[b].qty++;
      map[b].cupons += p.cupons_gerados || 0;
    });
    return Object.entries(map).map(([bairro, d]) => ({
      bairro, faturamento: d.faturamento, qty: d.qty, cupons: d.cupons,
      ticket: d.qty > 0 ? d.faturamento / d.qty : 0, taxaPP: d.faturamento * 0.15,
    })).sort((a, b) => b.faturamento - a.faturamento);
  }, [filteredPedidos]);

  const canalSummary = useMemo(() => {
    const map = new Map<string, { qty: number; total: number; cupons: number }>();
    filteredPedidos.forEach(p => {
      const c = p.canal || "Outros";
      const cur = map.get(c) ?? { qty: 0, total: 0, cupons: 0 };
      map.set(c, { qty: cur.qty + 1, total: cur.total + p.valor_total, cupons: cur.cupons + (p.cupons_gerados || 0) });
    });
    return [...map.entries()]
      .map(([canal, d]) => ({ canal, qty: d.qty, total: d.total, cupons: d.cupons,
        pct: totalFaturamento > 0 ? (d.total / totalFaturamento) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filteredPedidos, totalFaturamento]);

  const tipoSummary = useMemo(() => {
    const map = new Map<string, { qty: number; total: number; cupons: number }>();
    filteredPedidos.forEach(p => {
      const t = p.tipo_pedido || "Não informado";
      const cur = map.get(t) ?? { qty: 0, total: 0, cupons: 0 };
      map.set(t, { qty: cur.qty + 1, total: cur.total + p.valor_total, cupons: cur.cupons + (p.cupons_gerados || 0) });
    });
    return [...map.entries()]
      .map(([tipo, d]) => ({ tipo, qty: d.qty, total: d.total, cupons: d.cupons,
        pct: totalFaturamento > 0 ? (d.total / totalFaturamento) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filteredPedidos, totalFaturamento]);

  const dayGroups = useMemo(() => {
    const map = new Map<string, typeof filteredPedidos>();
    [...filteredPedidos]
      .sort((a, b) => new Date(a.data_pedido).getTime() - new Date(b.data_pedido).getTime())
      .forEach(p => {
        const key = format(new Date(p.data_pedido), "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(p);
      });
    return [...map.entries()].map(([dateKey, pedidos]) => ({
      dateKey,
      date: new Date(dateKey + "T12:00:00"),
      pedidos,
    }));
  }, [filteredPedidos]);

  // ── Helpers de UI ─────────────────────────────────────────────
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const pizzariaName = selectedPizzaria === "todas"
    ? "Todas as pizzarias"
    : pizzarias.find(p => p.id === selectedPizzaria)?.nome ?? "—";

  const periodoLabel = quick === "custom"
    ? `${format(dateFrom, "dd/MM")} – ${format(dateTo, "dd/MM")}`
    : QUICK_LABELS[quick as Exclude<QuickPeriod, "custom">];

  const canalTipoCount = (selectedCanais?.length ?? 0) + (selectedTipos?.length ?? 0);
  const hasActiveFilters = quick !== "campanha" || canalTipoCount > 0 || !!selectedFormas || cuponMin !== "" || cuponMax !== "" || !!valorOp;
  const activeFilterCount = [
    quick !== "campanha",
    selectedCanais !== null,
    selectedTipos !== null,
    selectedFormas !== null,
    cuponMin !== "" || cuponMax !== "",
    !!valorOp,
  ].filter(Boolean).length;
  const valorLabel = !valorOp ? "Qualquer"
    : valorOp === "gt" ? `> R$${valorMin}`
    : valorOp === "lt" ? `< R$${valorMin}`
    : `R$${valorMin}–${valorMax}`;

  const clearFilters = () => {
    setQuick("campanha"); setSelectedCanais(null); setSelectedTipos(null); setSelectedFormas(null);
    setCuponMin(""); setCuponMax("");
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
  const toggleForma = (forma: string) => {
    const cur = selectedFormas ?? FORMAS_PAGAMENTO;
    const next = cur.includes(forma) ? cur.filter(f => f !== forma) : [...cur, forma];
    setSelectedFormas(next.length === FORMAS_PAGAMENTO.length ? null : next);
  };

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    periodo: false, canal: false, tipo: false, pagamento: false, cupons: false, valor: false,
  });
  const toggleSection = (key: string) =>
    setOpenSections(s => ({ ...s, [key]: !s[key] }));

  // ── Computed filter2 ──────────────────────────────────────────
  const hasActiveFilters2 = quick2 !== "campanha" || selectedCanais2 !== null || selectedTipos2 !== null || selectedFormas2 !== null || cuponMin2 !== "" || cuponMax2 !== "" || !!valorOp2;
  const activeFilterCount2 = [
    quick2 !== "campanha",
    selectedCanais2 !== null,
    selectedTipos2 !== null,
    selectedFormas2 !== null,
    cuponMin2 !== "" || cuponMax2 !== "",
    !!valorOp2,
  ].filter(Boolean).length;

  const clearFilters2 = () => {
    setQuick2("campanha"); setSelectedCanais2(null); setSelectedTipos2(null); setSelectedFormas2(null);
    setCuponMin2(""); setCuponMax2("");
    setValorOp2(""); setValorMin2(""); setValorMax2("");
    setCustomFromStr2(""); setCustomToStr2("");
  };
  const toggleCanal2 = (canal: string) => {
    const cur = selectedCanais2 ?? canaisDisponiveis;
    const next = cur.includes(canal) ? cur.filter(c => c !== canal) : [...cur, canal];
    setSelectedCanais2(next.length === canaisDisponiveis.length ? null : next);
  };
  const toggleTipo2 = (tipo: string) => {
    const cur = selectedTipos2 ?? TIPOS.map(t => t.value);
    const next = cur.includes(tipo) ? cur.filter(t => t !== tipo) : [...cur, tipo];
    setSelectedTipos2(next.length === TIPOS.length ? null : next);
  };
  const toggleForma2 = (forma: string) => {
    const cur = selectedFormas2 ?? FORMAS_PAGAMENTO;
    const next = cur.includes(forma) ? cur.filter(f => f !== forma) : [...cur, forma];
    setSelectedFormas2(next.length === FORMAS_PAGAMENTO.length ? null : next);
  };
  const [openSections2, setOpenSections2] = useState<Record<string, boolean>>({
    periodo: false, canal: false, tipo: false, pagamento: false, cupons: false, valor: false,
  });
  const toggleSection2 = (key: string) =>
    setOpenSections2(s => ({ ...s, [key]: !s[key] }));

  // ── Paginação de bairros ──────────────────────────────────────
  const bairrosPageSize = 10;
  const totalPagesBairros = Math.max(1, Math.ceil(bairroData.length / bairrosPageSize));
  const pagedBairros = bairroData.slice(
    (pageBairros - 1) * bairrosPageSize,
    pageBairros * bairrosPageSize,
  );

  // ── Paginação analítico ───────────────────────────────────────
  const analiticoPageSize = 50;
  const totalPagesAnalitico = Math.max(1, Math.ceil(filteredPedidos.length / analiticoPageSize));
  const pagedAnalitico = filteredPedidos.slice(
    (pageAnalitico - 1) * analiticoPageSize,
    pageAnalitico * analiticoPageSize,
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
    if (selectedFormas && selectedFormas.length > 0)
      filterLines.push(`Pagamento: ${selectedFormas.map(f => FORMAS_LABELS[f] ?? f).join(", ")}`);
    if (cuponMin !== "" || cuponMax !== "") {
      const cuponDesc = cuponMin !== "" && cuponMax !== "" ? `${cuponMin}–${cuponMax}`
        : cuponMin !== "" ? `≥ ${cuponMin}` : `≤ ${cuponMax}`;
      filterLines.push(`Cupons: ${cuponDesc}`);
    }
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
    if (selectedFormas && selectedFormas.length > 0)
      titleParts.push(selectedFormas.map(f => FORMAS_LABELS[f] ?? f).join(", "));
    if (cuponMin !== "" || cuponMax !== "") titleParts.push("Cupons");
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
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text(kpi.value, x + boxW / 2, y + 44, { align: "center" });
      });
      y += boxH + 24;

      // Evolução no período
      y = drawSectionTitle(doc, "Evolução no Período", y);
      autoTable(doc, {
        head: [["Período", "Faturamento", "Pedidos", "Cupons"]],
        body: [
          ...chartData.map(d => [d.label, fmtBRL(d.faturamento), String(d.pedidos), String(d.cupons)]),
          ["TOTAL", fmtBRL(totalFaturamento), String(totalPedidos), String(totalCupons)],
        ],
        startY: y, ...TABLE_STYLES,
        columnStyles: { 1: { halign: "right" as const }, 2: { halign: "center" as const }, 3: { halign: "center" as const } },
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
        head: [["Canal", "Qtd", "Total (R$)", "%", "Cupons"]],
        body: canalSummary.map(d => [d.canal, String(d.qty), fmtBRL(d.total), `${d.pct.toFixed(1)}%`, String(d.cupons)]),
        startY: y, ...TABLE_STYLES,
        columnStyles: {
          1: { halign: "center" as const }, 2: { halign: "right" as const },
          3: { halign: "center" as const }, 4: { halign: "center" as const },
        },
      });
      y = (doc as any).lastAutoTable.finalY + 24;

      // Por tipo de pedido
      y = drawSectionTitle(doc, "Por Tipo de Pedido", y);
      autoTable(doc, {
        head: [["Tipo", "Qtd", "Total (R$)", "%", "Cupons"]],
        body: tipoSummary.map(d => [d.tipo, String(d.qty), fmtBRL(d.total), `${d.pct.toFixed(1)}%`, String(d.cupons)]),
        startY: y, ...TABLE_STYLES,
        columnStyles: {
          1: { halign: "center" as const }, 2: { halign: "right" as const },
          3: { halign: "center" as const }, 4: { halign: "center" as const },
        },
      });
      y = (doc as any).lastAutoTable.finalY + 24;

      // Ranking de bairros
      y = drawSectionTitle(doc, "Ranking de Bairros (Top 10)", y);
      autoTable(doc, {
        head: [["#", "Bairro", "Faturamento", "Pedidos", "Ticket Médio", "Cupons"]],
        body: bairroData.slice(0, 10).map((d, i) => [
          String(i + 1), d.bairro, fmtBRL(d.faturamento), String(d.qty), fmtBRL(d.ticket), String(d.cupons),
        ]),
        startY: y, ...TABLE_STYLES,
        columnStyles: {
          0: { halign: "center" as const }, 2: { halign: "right" as const },
          3: { halign: "center" as const }, 4: { halign: "right" as const }, 5: { halign: "center" as const },
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
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text(item.value, x + boxW / 2, y + 37, { align: "center" });
      });
      y += boxH + 20;

      autoTable(doc, {
        head: [["Data/Hora", "Pizzaria", "Valor", "Nº Cupons", "Números da Sorte", "Forma Pgto", "Bairro", "Taxa Entrega"]],
        body: filteredPedidos.map(p => {
          const pizzariaNome = pizzarias.find(pz => pz.id === p.pizzaria_id)?.nome ?? "—";
          const luckys = pedidoLuckyMap.get(p.id) ?? [];
          return [
            format(new Date(p.data_pedido), "dd/MM/yyyy HH:mm"),
            pizzariaNome,
            fmtBRL(p.valor_total),
            String(p.cupons_gerados || 0),
            luckys.length > 0 ? luckys.join(", ") : "—",
            FORMAS_LABELS[p.forma_pagamento || "outros"] || p.forma_pagamento || "—",
            p.bairro_entrega || "—",
            fmtBRL(p.taxa_entrega || 0),
          ];
        }),
        foot: [["TOTAL", "", fmtBRL(totalFaturamento), String(totalCupons), "", "", "", fmtBRL(totalTaxaEntrega)]],
        startY: y,
        headStyles: { fillColor: C.slate900, textColor: C.white, fontStyle: "bold", fontSize: 7, cellPadding: 5 },
        footStyles: { fillColor: C.slate50, textColor: C.slate900, fontStyle: "bold", fontSize: 7, cellPadding: 5 },
        alternateRowStyles: { fillColor: C.slate50 },
        bodyStyles: { fontSize: 6, textColor: C.slate700, cellPadding: 4 },
        styles: { lineColor: C.slate200, lineWidth: 0.4 },
        margin: { left: 20, right: 20, bottom: 28 },
        columnStyles: {
          2: { halign: "right" as const },
          3: { halign: "center" as const },
          7: { halign: "right" as const },
        },
      });

      addPdfFooter(doc, `${reportTitle} — Analítico`);
      doc.save(`${fileSlug}-analitico-${today}.pdf`);
    };

    // ── Por Pizzaria PDF ──────────────────────────────────────
    const exportPorPizzariaPDF = async () => {
      const lettering = await loadLetteringDataUrl();
      const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      let y = buildPdfHeader(doc, "Relatório por Pizzaria", "Desempenho · Vendas", filterLines, lettering);

      // Agrupar pedidos por pizzaria
      const pizMap = new Map<string, typeof filteredPedidos>();
      filteredPedidos.forEach(p => {
        const id = p.pizzaria_id || "sem-pizzaria";
        if (!pizMap.has(id)) pizMap.set(id, []);
        pizMap.get(id)!.push(p);
      });
      const nameMap = new Map(pizzarias.map(p => [p.id, p.nome]));
      const groups = [...pizMap.entries()]
        .map(([id, peds]) => {
          const fat = peds.reduce((s, p) => s + p.valor_total, 0);
          const qty = peds.length;
          const cups = peds.reduce((s, p) => s + (p.cupons_gerados || 0), 0);
          const ticket = qty > 0 ? fat / qty : 0;
          return { id, nome: nameMap.get(id) || id, peds, fat, qty, cups, ticket };
        })
        .sort((a, b) => b.fat - a.fat);

      // Resumo geral
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.slate500);
      doc.text(`${groups.length} pizzaria${groups.length !== 1 ? "s" : ""} · ${filteredPedidos.length} pedido${filteredPedidos.length !== 1 ? "s" : ""} no período`, 20, y);
      y += 22;

      const gap = 8;
      const boxW = (pageW - 40 - gap * 3) / 4;
      const boxH = 58;

      groups.forEach(g => {
        // Nova página se não couber seção (título + KPIs + tabela mínima)
        if (y + boxH + 100 > pageH - 40) { doc.addPage(); y = 40; }

        y = drawSectionTitle(doc, g.nome, y);

        // KPI boxes
        [
          { label: "Faturamento", value: fmtBRL(g.fat) },
          { label: "Pedidos", value: String(g.qty) },
          { label: "Ticket Médio", value: fmtBRL(g.ticket) },
          { label: "Cupons", value: String(g.cups) },
        ].forEach((kpi, i) => {
          const x = 20 + i * (boxW + gap);
          doc.setFillColor(...C.white);
          doc.setDrawColor(...C.slate200); doc.setLineWidth(0.6);
          doc.roundedRect(x, y, boxW, boxH, 4, 4, "FD");
          doc.setTextColor(...C.slate500);
          doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
          doc.text(kpi.label, x + boxW / 2, y + 16, { align: "center" });
          doc.setTextColor(...C.slate900);
          doc.setFontSize(14); doc.setFont("helvetica", "bold");
          doc.text(kpi.value, x + boxW / 2, y + 42, { align: "center" });
        });
        y += boxH + 12;

        // Canal breakdown
        const canalMap = new Map<string, { qty: number; total: number; cupons: number }>();
        g.peds.forEach(p => {
          const c = p.canal || "outros";
          const cur = canalMap.get(c) ?? { qty: 0, total: 0, cupons: 0 };
          canalMap.set(c, { qty: cur.qty + 1, total: cur.total + p.valor_total, cupons: cur.cupons + (p.cupons_gerados || 0) });
        });
        const canalRows = [...canalMap.entries()]
          .sort((a, b) => b[1].total - a[1].total)
          .map(([canal, d]) => [canal, String(d.qty), fmtBRL(d.total), `${g.fat > 0 ? ((d.total / g.fat) * 100).toFixed(1) : "0.0"}%`, String(d.cupons)]);

        autoTable(doc, {
          head: [["Canal", "Qtd", "Total (R$)", "%", "Cupons"]],
          body: canalRows,
          startY: y, ...TABLE_STYLES,
          margin: { left: 20, right: 20 },
          columnStyles: {
            1: { halign: "center" as const }, 2: { halign: "right" as const },
            3: { halign: "center" as const }, 4: { halign: "center" as const },
          },
        });
        y = (doc as any).lastAutoTable.finalY + 24;
      });

      addPdfFooter(doc, "Relatório por Pizzaria");
      doc.save(`vendas-por-pizzaria-${today}.pdf`);
    };

    // ── Diário Detalhado PDF ──────────────────────────────────
    const exportDiarioPDF = async () => {
      const lettering = await loadLetteringDataUrl();
      const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      let y = buildPdfHeader(doc, reportTitle, "Desempenho · Diário Detalhado", filterLines, lettering);

      // KPI boxes
      const kpisD = [
        { label: "Faturamento Total", value: fmtBRL(totalFaturamento) },
        { label: "Pedidos", value: String(totalPedidos) },
        { label: "Ticket Médio", value: fmtBRL(ticketMedio) },
        { label: "Taxa PP (15%)", value: fmtBRL(totalFaturamento * 0.15) },
      ];
      const gapD = 8;
      const boxWD = (pageW - 40 - gapD * 3) / 4;
      const boxHD = 52;
      kpisD.forEach((kpi, i) => {
        const x = 20 + i * (boxWD + gapD);
        doc.setFillColor(...C.white);
        doc.setDrawColor(...C.slate200); doc.setLineWidth(0.5);
        doc.roundedRect(x, y, boxWD, boxHD, 4, 4, "FD");
        doc.setFillColor(...C.orange);
        doc.rect(x, y, boxWD, 2.5, "F");
        doc.setTextColor(...C.slate500);
        doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
        doc.text(kpi.label, x + boxWD / 2, y + 16, { align: "center" });
        doc.setTextColor(...C.slate900);
        doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text(kpi.value, x + boxWD / 2, y + 38, { align: "center" });
      });
      y += boxHD + 20;

      // Agrupar por dia (cronológico)
      const dayMapD = new Map<string, Pedido[]>();
      [...filteredPedidos]
        .sort((a, b) => new Date(a.data_pedido).getTime() - new Date(b.data_pedido).getTime())
        .forEach(p => {
          const key = format(new Date(p.data_pedido), "yyyy-MM-dd");
          if (!dayMapD.has(key)) dayMapD.set(key, []);
          dayMapD.get(key)!.push(p);
        });

      const showPiz = selectedPizzaria === "todas";
      const COLS_D = showPiz
        ? ["#", "Referência", "Horário", "Pizzaria", "Valor (R$)", "Cupons", "Taxa PP (R$)"]
        : ["#", "Referência", "Horário", "Valor (R$)", "Cupons", "Taxa PP (R$)"];

      for (const [dateKey, dayPedidos] of dayMapD) {
        if (y + 100 > pageH - 40) { doc.addPage(); y = 40; }

        const date = new Date(dateKey + "T12:00:00");
        const dayLbl = format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
        const dayLblCap = dayLbl.charAt(0).toUpperCase() + dayLbl.slice(1);
        const dayTot = dayPedidos.reduce((s, p) => s + p.valor_total, 0);
        const dayCups = dayPedidos.reduce((s, p) => s + (p.cupons_gerados || 0), 0);

        y = drawSectionTitle(doc, dayLblCap, y);
        doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.slate500);
        doc.text(
          `${dayPedidos.length} venda${dayPedidos.length !== 1 ? "s" : ""}  ·  Faturamento: ${fmtBRL(dayTot)}  ·  Taxa PP: ${fmtBRL(dayTot * 0.15)}`,
          27, y,
        );
        y += 14;

        const body = dayPedidos.map((p, i) => {
          const ref = p.id.slice(-8).toUpperCase();
          const hora = format(new Date(p.data_pedido), "HH:mm");
          const pizNome = pizzarias.find(pz => pz.id === p.pizzaria_id)?.nome ?? "—";
          const taxaPP = p.valor_total * 0.15;
          return showPiz
            ? [String(i + 1), ref, hora, pizNome, fmtBRL(p.valor_total), String(p.cupons_gerados || 0), fmtBRL(taxaPP)]
            : [String(i + 1), ref, hora, fmtBRL(p.valor_total), String(p.cupons_gerados || 0), fmtBRL(taxaPP)];
        });

        const footD = showPiz
          ? [["TOTAL DO DIA", "", `${dayPedidos.length} pedidos`, "", fmtBRL(dayTot), String(dayCups), fmtBRL(dayTot * 0.15)]]
          : [["TOTAL DO DIA", "", `${dayPedidos.length} pedidos`, fmtBRL(dayTot), String(dayCups), fmtBRL(dayTot * 0.15)]];

        const colD = showPiz ? {
          0: { halign: "center" as const, cellWidth: 22 },
          1: { halign: "center" as const, cellWidth: 60 },
          2: { halign: "center" as const, cellWidth: 40 },
          4: { halign: "right" as const },
          5: { halign: "center" as const },
          6: { halign: "right" as const },
        } : {
          0: { halign: "center" as const, cellWidth: 22 },
          1: { halign: "center" as const, cellWidth: 60 },
          2: { halign: "center" as const, cellWidth: 40 },
          3: { halign: "right" as const },
          4: { halign: "center" as const },
          5: { halign: "right" as const },
        };

        autoTable(doc, {
          head: [COLS_D], body, foot: footD, startY: y,
          headStyles: { fillColor: C.slate900, textColor: C.white, fontStyle: "bold", fontSize: 7, cellPadding: 4 },
          footStyles: { fillColor: C.orange, textColor: C.white, fontStyle: "bold", fontSize: 7, cellPadding: 4 },
          alternateRowStyles: { fillColor: C.slate50 },
          bodyStyles: { fontSize: 7, textColor: C.slate700, cellPadding: 3.5 },
          styles: { lineColor: C.slate200, lineWidth: 0.4 },
          margin: { left: 20, right: 20, bottom: 28 },
          columnStyles: colD,
        });
        y = (doc as any).lastAutoTable.finalY + 22;
      }

      // Total geral
      if (y + 80 > pageH - 40) { doc.addPage(); y = 40; }
      y = drawSectionTitle(doc, "TOTAL GERAL DO PERÍODO", y);
      autoTable(doc, {
        head: [["Dias com vendas", "Total de Pedidos", "Faturamento Total", "Cupons Totais", "Taxa PP Total (15%)"]],
        body: [[
          String(dayMapD.size),
          String(filteredPedidos.length),
          fmtBRL(totalFaturamento),
          String(totalCupons),
          fmtBRL(totalFaturamento * 0.15),
        ]],
        startY: y, ...TABLE_STYLES,
        columnStyles: {
          0: { halign: "center" as const },
          1: { halign: "center" as const },
          2: { halign: "right" as const },
          3: { halign: "center" as const },
          4: { halign: "right" as const },
        },
      });

      addPdfFooter(doc, `${reportTitle} — Diário Detalhado`);
      doc.save(`${fileSlug}-diario-detalhado-${today}.pdf`);
    };

    // ── Excel ─────────────────────────────────────────────────
    const exportExcel = () => {
      const wb = XLSX.utils.book_new();

      const ws1 = XLSX.utils.aoa_to_sheet([
        ["Data/Hora", "Pizzaria", "Valor", "Nº Cupons", "Números da Sorte", "Forma Pagamento", "Bairro", "Taxa Entrega"],
        ...filteredPedidos.map(p => {
          const pizzariaNome = pizzarias.find(pz => pz.id === p.pizzaria_id)?.nome ?? "—";
          const luckys = pedidoLuckyMap.get(p.id) ?? [];
          return [
            format(new Date(p.data_pedido), "dd/MM/yyyy HH:mm"),
            pizzariaNome,
            p.valor_total,
            p.cupons_gerados || 0,
            luckys.length > 0 ? luckys.join(", ") : "—",
            FORMAS_LABELS[p.forma_pagamento || "outros"] || p.forma_pagamento || "—",
            p.bairro_entrega || "—",
            p.taxa_entrega || 0,
          ];
        }),
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

      // Aba "Detalhado por Dia"
      const dayMapX = new Map<string, Pedido[]>();
      [...filteredPedidos]
        .sort((a, b) => new Date(a.data_pedido).getTime() - new Date(b.data_pedido).getTime())
        .forEach(p => {
          const key = format(new Date(p.data_pedido), "yyyy-MM-dd");
          if (!dayMapX.has(key)) dayMapX.set(key, []);
          dayMapX.get(key)!.push(p);
        });

      const ws5Rows: (string | number)[][] = [
        ["Data", "Dia da Semana", "# do Dia", "Referência", "Horário", "Pizzaria", "Valor (R$)", "Cupons", "Taxa PP (R$)"],
      ];
      for (const [dateKey, dayPedidos] of dayMapX) {
        const date = new Date(dateKey + "T12:00:00");
        const dateFmt = format(date, "dd/MM/yyyy");
        const diaSemana = format(date, "EEEE", { locale: ptBR });
        const diaSemanaC = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
        dayPedidos.forEach((p, i) => {
          const pizNome = pizzarias.find(pz => pz.id === p.pizzaria_id)?.nome ?? "—";
          ws5Rows.push([
            dateFmt,
            diaSemanaC,
            i + 1,
            p.id.slice(-8).toUpperCase(),
            format(new Date(p.data_pedido), "HH:mm"),
            pizNome,
            p.valor_total,
            p.cupons_gerados || 0,
            +(p.valor_total * 0.15).toFixed(2),
          ]);
        });
        const dayTotX = dayPedidos.reduce((s, p) => s + p.valor_total, 0);
        const dayCupsX = dayPedidos.reduce((s, p) => s + (p.cupons_gerados || 0), 0);
        ws5Rows.push([
          `SUBTOTAL — ${dateFmt}`,
          "",
          dayPedidos.length,
          "",
          "",
          "",
          +dayTotX.toFixed(2),
          dayCupsX,
          +(dayTotX * 0.15).toFixed(2),
        ]);
        ws5Rows.push([]);
      }
      ws5Rows.push([
        "TOTAL GERAL", "", filteredPedidos.length, "", "", "",
        +totalFaturamento.toFixed(2),
        totalCupons,
        +(totalFaturamento * 0.15).toFixed(2),
      ]);
      const ws5 = XLSX.utils.aoa_to_sheet(ws5Rows);
      XLSX.utils.book_append_sheet(wb, ws5, "Detalhado por Dia");

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
      const header = "Data/Hora,Pizzaria,Valor,Nº Cupons,Números da Sorte,Forma Pagamento,Bairro,Taxa Entrega";
      const rows = filteredPedidos.map(p => {
        const pizzariaNome = pizzarias.find(pz => pz.id === p.pizzaria_id)?.nome ?? "—";
        const luckys = pedidoLuckyMap.get(p.id) ?? [];
        const vals = [
          format(new Date(p.data_pedido), "dd/MM/yyyy HH:mm"),
          pizzariaNome,
          String(p.valor_total),
          String(p.cupons_gerados || 0),
          luckys.length > 0 ? luckys.join(" | ") : "—",
          FORMAS_LABELS[p.forma_pagamento || "outros"] || p.forma_pagamento || "—",
          p.bairro_entrega || "—",
          String(p.taxa_entrega || 0),
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
          <DropdownMenuItem onClick={exportPorPizzariaPDF} className="gap-2 text-xs">
            <Layers className="h-3.5 w-3.5" /> Relatório por Pizzaria
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportDiarioPDF} className="gap-2 text-xs">
            <CalendarDays className="h-3.5 w-3.5" /> Relatório Diário Detalhado
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
    quick, selectedCanais, selectedTipos, selectedFormas, cuponMin, cuponMax, valorOp, valorMin, valorMax,
    pizzariaName, periodoLabel, pizzarias, pedidoLuckyMap, selectedPizzaria, taxaPP,
  ]);

  // ─────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Filtros avançados injetados na barra do layout ── */}
      {advancedFilterSlot && createPortal(
        <Popover open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="sm" className="h-8 text-xs gap-1.5"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Avançado
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-white/25 text-[10px] font-semibold px-1.5 leading-4">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 overflow-x-hidden" align="start" style={{ maxHeight: "540px", overflowY: "auto" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <span className="text-sm font-semibold">Filtros avançados</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{filteredByAdv1.length} resultado{filteredByAdv1.length !== 1 ? "s" : ""}</span>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="text-xs h-6 px-2"
                    onClick={() => { clearFilters(); setAdvancedOpen(false); }}>
                    Limpar tudo
                  </Button>
                )}
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto divide-y divide-border">

              {/* ── Período ── */}
              <div>
                <button
                  onClick={() => toggleSection("periodo")}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Período</span>
                    {quick !== "campanha" && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections.periodo ? "rotate-180" : ""}`} />
                </button>
                {openSections.periodo && (
                  <div className="px-5 pt-1 pb-5 space-y-2">
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {(["campanha", "hoje", "ontem"] as const).map(p => (
                          <Button key={p} variant={quick === p ? "default" : "outline"} size="sm"
                            className="flex-1 text-xs h-7"
                            onClick={() => {
                              if (p === "campanha") { setQuick("campanha"); } else {
                                const [f, t] = getQuickRange(p);
                                setQuick(p); setDateFrom(f); setDateTo(t);
                              }
                            }}>
                            {QUICK_LABELS[p]}
                          </Button>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        {(["esta_semana", "este_mes"] as const).map(p => (
                          <Button key={p} variant={quick === p ? "default" : "outline"} size="sm"
                            className="flex-1 text-xs h-7"
                            onClick={() => {
                              const [f, t] = getQuickRange(p);
                              setQuick(p); setDateFrom(f); setDateTo(t);
                            }}>
                            {QUICK_LABELS[p]}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input type="date" value={customFromStr} onChange={e => setCustomFromStr(e.target.value)}
                        className="w-full min-w-0 text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring" />
                      <input type="date" value={customToStr} onChange={e => setCustomToStr(e.target.value)}
                        className="w-full min-w-0 text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring" />
                    </div>
                    <Button size="sm" className="w-full text-xs h-7"
                      disabled={!customFromStr || !customToStr}
                      onClick={() => {
                        setQuick("custom");
                        setDateFrom(startOfDay(new Date(customFromStr + "T00:00:00")));
                        setDateTo(endOfDay(new Date(customToStr + "T00:00:00")));
                      }}
                    >
                      Aplicar período personalizado
                    </Button>
                  </div>
                )}
              </div>

              {/* ── Canal ── */}
              {canaisDisponiveis.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection("canal")}
                    className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Canal</span>
                      {selectedCanais !== null && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections.canal ? "rotate-180" : ""}`} />
                  </button>
                  {openSections.canal && (
                    <div className="px-5 pt-1 pb-5 space-y-1.5">
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
                  )}
                </div>
              )}

              {/* ── Tipo de pedido ── */}
              <div>
                <button
                  onClick={() => toggleSection("tipo")}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Tipo de pedido</span>
                    {selectedTipos !== null && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections.tipo ? "rotate-180" : ""}`} />
                </button>
                {openSections.tipo && (
                  <div className="px-5 pt-1 pb-5 space-y-1.5">
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
                )}
              </div>

              {/* ── Forma de pagamento ── */}
              <div>
                <button
                  onClick={() => toggleSection("pagamento")}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Forma de pagamento</span>
                    {selectedFormas !== null && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections.pagamento ? "rotate-180" : ""}`} />
                </button>
                {openSections.pagamento && (
                  <div className="px-5 pt-1 pb-5 space-y-1.5">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={selectedFormas === null}
                        onCheckedChange={v => setSelectedFormas(v ? null : [])}
                      />
                      Todas as formas
                    </label>
                    {FORMAS_PAGAMENTO.map(f => (
                      <label key={f} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={selectedFormas === null || selectedFormas.includes(f)}
                          onCheckedChange={() => toggleForma(f)}
                        />
                        {FORMAS_LABELS[f]}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Cupons gerados ── */}
              <div>
                <button
                  onClick={() => toggleSection("cupons")}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Cupons gerados</span>
                    {(cuponMin !== "" || cuponMax !== "") && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections.cupons ? "rotate-180" : ""}`} />
                </button>
                {openSections.cupons && (
                  <div className="px-5 pt-1 pb-5">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-1">Mínimo</p>
                        <Input type="number" min="0" placeholder="0" value={cuponMin}
                          onChange={e => setCuponMin(e.target.value)} className="h-7 text-xs" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-1">Máximo</p>
                        <Input type="number" min="0" placeholder="—" value={cuponMax}
                          onChange={e => setCuponMax(e.target.value)} className="h-7 text-xs" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Valor do pedido ── */}
              <div>
                <button
                  onClick={() => toggleSection("valor")}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Valor do pedido</span>
                    {!!valorOp && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
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
                        <Input type="number" placeholder="R$" value={valorMin}
                          onChange={e => setValorMin(e.target.value)} className="h-7 text-xs" />
                        {valorOp === "between" && (
                          <Input type="number" placeholder="R$" value={valorMax}
                            onChange={e => setValorMax(e.target.value)} className="h-7 text-xs" />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </PopoverContent>
        </Popover>,
        advancedFilterSlot,
      )}

      {/* ── Filtro avançado 2 (refinamento adicional) ── */}
      {advancedFilterSlot2 && createPortal(
        <Popover open={advancedOpen2} onOpenChange={setAdvancedOpen2}>
          <PopoverTrigger asChild>
            <Button
              variant={hasActiveFilters2 ? "default" : "outline"}
              size="sm" className="h-8 text-xs gap-1.5"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Refinar
              {activeFilterCount2 > 0 && (
                <span className="rounded-full bg-white/25 text-[10px] font-semibold px-1.5 leading-4">
                  {activeFilterCount2}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 overflow-x-hidden" align="start" style={{ maxHeight: "540px", overflowY: "auto" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <span className="text-sm font-semibold">Refinamento adicional</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{filteredPedidos.length} resultado{filteredPedidos.length !== 1 ? "s" : ""}</span>
                {hasActiveFilters2 && (
                  <Button variant="ghost" size="sm" className="text-xs h-6 px-2"
                    onClick={() => { clearFilters2(); setAdvancedOpen2(false); }}>
                    Limpar tudo
                  </Button>
                )}
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto divide-y divide-border">

              {/* ── Período ── */}
              <div>
                <button
                  onClick={() => toggleSection2("periodo")}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Período</span>
                    {quick2 !== "campanha" && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections2.periodo ? "rotate-180" : ""}`} />
                </button>
                {openSections2.periodo && (
                  <div className="px-5 pt-1 pb-5 space-y-2">
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {(["campanha", "hoje", "ontem"] as const).map(p => (
                          <Button key={p} variant={quick2 === p ? "default" : "outline"} size="sm"
                            className="flex-1 text-xs h-7"
                            onClick={() => {
                              if (p === "campanha") { setQuick2("campanha"); } else {
                                const [f, t] = getQuickRange(p);
                                setQuick2(p); setDateFrom2(f); setDateTo2(t);
                              }
                            }}>
                            {QUICK_LABELS[p]}
                          </Button>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        {(["esta_semana", "este_mes"] as const).map(p => (
                          <Button key={p} variant={quick2 === p ? "default" : "outline"} size="sm"
                            className="flex-1 text-xs h-7"
                            onClick={() => {
                              const [f, t] = getQuickRange(p);
                              setQuick2(p); setDateFrom2(f); setDateTo2(t);
                            }}>
                            {QUICK_LABELS[p]}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input type="date" value={customFromStr2} onChange={e => setCustomFromStr2(e.target.value)}
                        className="w-full min-w-0 text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring" />
                      <input type="date" value={customToStr2} onChange={e => setCustomToStr2(e.target.value)}
                        className="w-full min-w-0 text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring" />
                    </div>
                    <Button size="sm" className="w-full text-xs h-7"
                      disabled={!customFromStr2 || !customToStr2}
                      onClick={() => {
                        setQuick2("custom");
                        setDateFrom2(startOfDay(new Date(customFromStr2 + "T00:00:00")));
                        setDateTo2(endOfDay(new Date(customToStr2 + "T00:00:00")));
                      }}
                    >
                      Aplicar período personalizado
                    </Button>
                  </div>
                )}
              </div>

              {/* ── Canal ── */}
              {canaisDisponiveis.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection2("canal")}
                    className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Canal</span>
                      {selectedCanais2 !== null && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections2.canal ? "rotate-180" : ""}`} />
                  </button>
                  {openSections2.canal && (
                    <div className="px-5 pt-1 pb-5 space-y-1.5">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={selectedCanais2 === null || selectedCanais2.length === canaisDisponiveis.length}
                          onCheckedChange={v => setSelectedCanais2(v ? null : [])}
                        />
                        Todos os canais
                      </label>
                      {canaisDisponiveis.map(c => (
                        <label key={c} className="flex items-center gap-2 text-xs cursor-pointer">
                          <Checkbox
                            checked={selectedCanais2 === null || selectedCanais2.includes(c)}
                            onCheckedChange={() => toggleCanal2(c)}
                          />
                          {c}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Tipo de pedido ── */}
              <div>
                <button
                  onClick={() => toggleSection2("tipo")}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Tipo de pedido</span>
                    {selectedTipos2 !== null && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections2.tipo ? "rotate-180" : ""}`} />
                </button>
                {openSections2.tipo && (
                  <div className="px-5 pt-1 pb-5 space-y-1.5">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={selectedTipos2 === null || selectedTipos2.length === TIPOS.length}
                        onCheckedChange={v => setSelectedTipos2(v ? null : [])}
                      />
                      Todos os tipos
                    </label>
                    {TIPOS.map(t => (
                      <label key={t.value} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={selectedTipos2 === null || selectedTipos2.includes(t.value)}
                          onCheckedChange={() => toggleTipo2(t.value)}
                        />
                        {t.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Forma de pagamento ── */}
              <div>
                <button
                  onClick={() => toggleSection2("pagamento")}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Forma de pagamento</span>
                    {selectedFormas2 !== null && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections2.pagamento ? "rotate-180" : ""}`} />
                </button>
                {openSections2.pagamento && (
                  <div className="px-5 pt-1 pb-5 space-y-1.5">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={selectedFormas2 === null}
                        onCheckedChange={v => setSelectedFormas2(v ? null : [])}
                      />
                      Todas as formas
                    </label>
                    {FORMAS_PAGAMENTO.map(f => (
                      <label key={f} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={selectedFormas2 === null || selectedFormas2.includes(f)}
                          onCheckedChange={() => toggleForma2(f)}
                        />
                        {FORMAS_LABELS[f]}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Cupons gerados ── */}
              <div>
                <button
                  onClick={() => toggleSection2("cupons")}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Cupons gerados</span>
                    {(cuponMin2 !== "" || cuponMax2 !== "") && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections2.cupons ? "rotate-180" : ""}`} />
                </button>
                {openSections2.cupons && (
                  <div className="px-5 pt-1 pb-5">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-1">Mínimo</p>
                        <Input type="number" min="0" placeholder="0" value={cuponMin2}
                          onChange={e => setCuponMin2(e.target.value)} className="h-7 text-xs" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-1">Máximo</p>
                        <Input type="number" min="0" placeholder="—" value={cuponMax2}
                          onChange={e => setCuponMax2(e.target.value)} className="h-7 text-xs" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Valor do pedido ── */}
              <div>
                <button
                  onClick={() => toggleSection2("valor")}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Valor do pedido</span>
                    {!!valorOp2 && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections2.valor ? "rotate-180" : ""}`} />
                </button>
                {openSections2.valor && (
                  <div className="px-5 pt-1 pb-5 space-y-2">
                    <Select value={valorOp2 || "__none__"} onValueChange={v => setValorOp2(v === "__none__" ? "" : v as "gt" | "lt" | "between")}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Qualquer valor" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Qualquer valor</SelectItem>
                        <SelectItem value="gt">Maior que</SelectItem>
                        <SelectItem value="lt">Menor que</SelectItem>
                        <SelectItem value="between">Entre</SelectItem>
                      </SelectContent>
                    </Select>
                    {valorOp2 && (
                      <div className="flex gap-2">
                        <Input type="number" placeholder="R$" value={valorMin2}
                          onChange={e => setValorMin2(e.target.value)} className="h-7 text-xs" />
                        {valorOp2 === "between" && (
                          <Input type="number" placeholder="R$" value={valorMax2}
                            onChange={e => setValorMax2(e.target.value)} className="h-7 text-xs" />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </PopoverContent>
        </Popover>,
        advancedFilterSlot2,
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
                  <Line animationDuration={3000} animationEasing="linear" yAxisId="left" type="monotone" dataKey="faturamento" stroke="#f97316" strokeWidth={2} dot={false}/>
                  <Line animationDuration={3000} animationEasing="linear" yAxisId="right" type="monotone" dataKey="pedidos" stroke="#3b82f6" strokeWidth={2} dot={false}/>
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
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Análise por forma de pagamento</CardTitle>
            {selectedFormaChart && (
              <Button variant="outline" size="sm" className="h-6 text-xs px-2 gap-1 border-primary/40 text-primary"
                onClick={() => setSelectedFormaChart(null)}>
                {FORMAS_LABELS[selectedFormaChart] || selectedFormaChart} ×
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                    label={({ name, pct }: any) => `${name}: ${pct.toFixed(1)}%`} labelLine={false}
                    onClick={(entry: any) => { setSelectedFormaChart(prev => prev === entry.key ? null : entry.key); }}
                    style={{ cursor: "pointer" }}
                  >
                    {paymentData.map((d, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]}
                        opacity={selectedFormaChart && selectedFormaChart !== d.key ? 0.3 : 1} />
                    ))}
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
                  <TableRow
                    key={d.key}
                    className={`cursor-pointer transition-opacity ${selectedFormaChart && selectedFormaChart !== d.key ? "opacity-30" : ""} ${selectedFormaChart === d.key ? "bg-primary/5" : "hover:bg-muted/40"}`}
                    onClick={() => setSelectedFormaChart(prev => prev === d.key ? null : d.key)}
                  >
                    <TableCell className="text-xs font-medium flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: COLORS[paymentData.indexOf(d) % COLORS.length] }} />
                      {d.name}
                    </TableCell>
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

      {/* ── Diário Detalhado ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Pedidos por dia</h3>
          <p className="text-xs text-muted-foreground">
            {filteredPedidos.length} pedido{filteredPedidos.length !== 1 ? "s" : ""} · {dayGroups.length} dia{dayGroups.length !== 1 ? "s" : ""}
          </p>
        </div>

        {dayGroups.length === 0 ? (
          <div className="rounded-lg border border-border py-12 text-center text-xs text-muted-foreground">
            Nenhum pedido encontrado com os filtros aplicados.
          </div>
        ) : (
          dayGroups.map(({ dateKey, date, pedidos: dayPedidos }) => {
            const dayTot = dayPedidos.reduce((s, p) => s + p.valor_total, 0);
            const comissao = dayTot * 0.15;
            const dayLbl = format(date, "EEEE, dd/MM/yyyy", { locale: ptBR });
            const dayLblCap = dayLbl.charAt(0).toUpperCase() + dayLbl.slice(1);
            const showPizzaria = selectedPizzaria === "todas";
            return (
              <div key={dateKey} className="rounded-lg border border-border overflow-hidden">
                {/* Header do dia */}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
                  <span className="font-semibold text-sm">{dayLblCap}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">
                      {dayPedidos.length} pedido{dayPedidos.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-foreground font-medium">{fmtBRL(dayTot)}</span>
                    <span className="text-primary font-semibold">comissão: {fmtBRL(comissao)}</span>
                  </div>
                </div>
                {/* Tabela */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs w-10">#</TableHead>
                        <TableHead className="text-xs">Hora</TableHead>
                        <TableHead className="text-xs">Tipo</TableHead>
                        <TableHead className="text-xs">Canal</TableHead>
                        {showPizzaria && <TableHead className="text-xs">Pizzaria</TableHead>}
                        <TableHead className="text-xs text-right">Valor</TableHead>
                        <TableHead className="text-xs text-right">Comissão</TableHead>
                        <TableHead className="text-xs text-right">Cupons</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dayPedidos.map((p, i) => {
                        const tipoMeta = TIPO_META[p.tipo_pedido ?? "delivery"] ?? { emoji: "📦", label: p.tipo_pedido ?? "—" };
                        const canalLbl = p.canal === "app" ? "App" : p.canal === "manual" ? "Manual" : p.canal ?? "—";
                        const pizzariaNome = pizzarias.find(pz => pz.id === p.pizzaria_id)?.nome ?? "—";
                        return (
                          <TableRow key={p.id} className="hover:bg-muted/30">
                            <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="text-xs font-mono">{format(new Date(p.data_pedido), "HH:mm")}</TableCell>
                            <TableCell className="text-xs">
                              <span className="flex items-center gap-1.5">
                                <span>{tipoMeta.emoji}</span>
                                <span>{tipoMeta.label}</span>
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{canalLbl}</TableCell>
                            {showPizzaria && (
                              <TableCell className="text-xs max-w-[140px] truncate">{pizzariaNome}</TableCell>
                            )}
                            <TableCell className="text-xs text-right font-medium">{fmtBRL(p.valor_total)}</TableCell>
                            <TableCell className="text-xs text-right font-semibold text-primary">{fmtBRL(p.valor_total * 0.15)}</TableCell>
                            <TableCell className="text-xs text-right">{p.cupons_gerados || 0}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })
        )}
      </div>

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
