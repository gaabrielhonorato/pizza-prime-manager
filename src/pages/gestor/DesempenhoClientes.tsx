import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import {
  format, subDays, subWeeks, subMonths,
  startOfWeek, endOfWeek, startOfDay, endOfDay,
  startOfMonth, endOfMonth, differenceInDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import {
  ChevronDown, Users, UserPlus, Activity, Clock,
  SlidersHorizontal, CalendarDays,
  BarChart2, List, FileSpreadsheet, FileText, Download,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────
// Constantes e helpers
// ─────────────────────────────────────────────────────────────
const COLORS = ["#6b7280", "#22c55e", "#84cc16", "#f97316", "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const CANAIS = [
  { value: "cardapioweb", label: "Cardápio Web" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "balcao", label: "Balcão" },
  { value: "anuncios", label: "Anúncios" },
  { value: "outros", label: "Outros" },
];

type QuickPeriod = "campanha" | "hoje" | "ontem" | "esta_semana" | "semana_passada" | "este_mes" | "mes_passado" | "3m" | "custom";

const QUICK_LABELS: Record<Exclude<QuickPeriod, "custom">, string> = {
  campanha: "Toda a campanha",
  hoje: "Hoje", ontem: "Ontem",
  esta_semana: "Esta semana", semana_passada: "Semana passada",
  este_mes: "Este mês", mes_passado: "Mês passado",
  "3m": "Últimos 3 meses",
};

type DateOp = "eq" | "gt" | "gte" | "lt" | "lte" | "empty" | "notempty" | "";

const DATE_OP_LABELS: Record<Exclude<DateOp, "">, string> = {
  eq: "é igual a",
  gt: "é posterior a",
  gte: "é posterior ou igual a",
  lt: "é anterior a",
  lte: "é anterior ou igual a",
  empty: "está vazio",
  notempty: "não está vazio",
};

const RELATIVE_VALUES = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "anteontem", label: "Anteontem" },
  { value: "esta_semana", label: "Esta semana" },
  { value: "semana_passada", label: "Semana passada" },
  { value: "este_mes", label: "Este mês" },
  { value: "mes_passado", label: "Mês passado" },
  { value: "30d", label: "30 dias atrás" },
  { value: "60d", label: "60 dias atrás" },
  { value: "90d", label: "90 dias atrás" },
];

function resolveRelativeDateRange(valor: string): { from: Date; to: Date } {
  const now = new Date();
  switch (valor) {
    case "hoje": return { from: startOfDay(now), to: endOfDay(now) };
    case "ontem": { const d = subDays(now, 1); return { from: startOfDay(d), to: endOfDay(d) }; }
    case "anteontem": { const d = subDays(now, 2); return { from: startOfDay(d), to: endOfDay(d) }; }
    case "esta_semana": return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
    case "semana_passada": {
      const s = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      return { from: s, to: endOfWeek(s, { weekStartsOn: 1 }) };
    }
    case "este_mes": return { from: startOfMonth(now), to: endOfDay(now) };
    case "mes_passado": { const m = subMonths(now, 1); return { from: startOfMonth(m), to: endOfMonth(m) }; }
    case "30d": return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
    case "60d": return { from: startOfDay(subDays(now, 60)), to: endOfDay(now) };
    case "90d": return { from: startOfDay(subDays(now, 90)), to: endOfDay(now) };
    default:
      if (/^\d{4}-\d{2}$/.test(valor)) {
        const [y, mo] = valor.split("-").map(Number);
        const ref = new Date(y, mo - 1, 1);
        return { from: startOfMonth(ref), to: endOfMonth(ref) };
      }
      const d = new Date(valor);
      return { from: startOfDay(d), to: endOfDay(d) };
  }
}

function applyDateOpFilter<T>(
  list: T[],
  op: DateOp,
  valor: string,
  getDate: (item: T) => Date | null,
): T[] {
  if (!op) return list;
  if (op === "empty") return list.filter(item => !getDate(item));
  if (op === "notempty") return list.filter(item => !!getDate(item));
  if (!valor) return list;
  const { from, to } = resolveRelativeDateRange(valor);
  return list.filter(item => {
    const d = getDate(item);
    if (!d) return false;
    switch (op) {
      case "eq": return d >= from && d <= to;
      case "gt": return d > to;
      case "gte": return d >= from;
      case "lt": return d < from;
      case "lte": return d <= to;
      default: return true;
    }
  });
}

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
    case "3m": return [startOfDay(subMonths(now, 3)), endOfDay(now)];
  }
}

// ─────────────────────────────────────────────────────────────
// Sub-componente: linha colapsável do painel de filtros
// ─────────────────────────────────────────────────────────────
function FilterRow({
  title, active, open, onToggle, children,
}: {
  title: string; active: boolean; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{title}</span>
          {active && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pt-1 pb-5">
          {children}
        </div>
      )}
    </div>
  );
}

// Sub-componente: seletor de data com operador + valor relativo
function DateFieldFilter({
  op, onOpChange, valor, onValorChange, data, onDataChange, last12Months,
}: {
  op: DateOp; onOpChange: (v: DateOp) => void;
  valor: string; onValorChange: (v: string) => void;
  data: string; onDataChange: (v: string) => void;
  last12Months: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Select value={op || "__none__"} onValueChange={v => onOpChange(v === "__none__" ? "" : v as DateOp)}>
        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="— sem filtro —" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— sem filtro —</SelectItem>
          {(Object.entries(DATE_OP_LABELS) as [Exclude<DateOp, "">, string][]).map(([k, l]) => (
            <SelectItem key={k} value={k}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {op && op !== "empty" && op !== "notempty" && (
        <>
          <Select value={valor} onValueChange={onValorChange}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RELATIVE_VALUES.map(rv => <SelectItem key={rv.value} value={rv.value}>{rv.label}</SelectItem>)}
              <SelectItem value="__sep__" disabled className="text-[10px] text-muted-foreground py-0.5">── Meses ──</SelectItem>
              {last12Months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              <SelectItem value="data_especifica">Uma data específica</SelectItem>
            </SelectContent>
          </Select>
          {valor === "data_especifica" && (
            <Input type="date" value={data} onChange={e => onDataChange(e.target.value)} className="h-7 text-xs" />
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────
type Consumer = {
  id: string; usuario_id: string; criado_em: string;
  genero: string | null; data_nascimento: string | null; aceita_whatsapp: boolean;
  pizzaria_id: string | null; campanha_id: string | null;
};
type Usuario = { id: string; nome: string; telefone: string | null; ultimo_acesso: string | null; criado_em: string };
type Pedido = {
  id: string; consumidor_id: string | null; data_pedido: string;
  valor_total: number; pizzaria_id: string; campanha_id: string; canal: string | null;
};
type DesempenhoContext = {
  selectedPizzaria: string;
  selectedCampanha: string;
  selectedConsumidor: string;
  setExportNode: (node: ReactNode) => void;
  advancedFilterSlot: HTMLDivElement | null;
  advancedFilterSlot2: HTMLDivElement | null;
};

// ─────────────────────────────────────────────────────────────
// Helpers PDF
// ─────────────────────────────────────────────────────────────
// Paleta do design system
const C = {
  slate900:  [15,  23,  42]  as [number,number,number],  // #0F172A
  slate700:  [51,  65,  85]  as [number,number,number],  // #334155
  slate500:  [100, 116, 139] as [number,number,number],  // #64748B
  slate200:  [226, 232, 240] as [number,number,number],  // #E2E8F0
  slate50:   [248, 250, 252] as [number,number,number],  // #F8FAFC
  white:     [255, 255, 255] as [number,number,number],
  orange:    [249, 115,  22] as [number,number,number],  // usado apenas como acento
};

// Layout de cabeçalho em 3 colunas: [Lettering | Título | Filtros]
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
    const imgH = 52;
    const imgW = imgH * 2.2;
    const imgY = (HEADER_H - imgH) / 2;
    doc.addImage(letteringDataUrl, "PNG", col1X, imgY, imgW, imgH);
  }

  // Divider 1
  const div1X = col1X + col1W + 8;
  doc.setDrawColor(...C.slate200);
  doc.setLineWidth(0.6);
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
  doc.setDrawColor(...C.slate200);
  doc.setLineWidth(0.6);
  doc.line(div2X, 12, div2X, HEADER_H - 12);

  // Col 3: Filtros — alinhado à direita
  const col3RightX = pageW - 20; // = div2X + 12 + col3W

  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.orange);
  doc.text("FILTROS APLICADOS", col3RightX, 22, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.slate900);
  if (filterLines.length === 0) {
    doc.setTextColor(...C.slate500);
    doc.setFontSize(8);
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

  doc.setDrawColor(...C.slate200);
  doc.setLineWidth(0.5);
  doc.line(20, HEADER_H + 2, pageW - 20, HEADER_H + 2);

  return HEADER_H + 14;
}

async function loadLetteringDataUrl(): Promise<string | undefined> {
  try {
    const res = await fetch("/lettering-pizza-premiada.png");
    const blob = await res.blob();
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

function addPdfFooter(doc: jsPDF, reportTitle: string) {
  const total = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    // Linha separadora acima do footer
    doc.setDrawColor(...C.slate200);
    doc.setLineWidth(0.5);
    doc.line(20, pageH - 20, pageW - 20, pageH - 20);
    doc.setFontSize(7); doc.setTextColor(...C.slate500);
    doc.text(reportTitle, 20, pageH - 9);
    doc.text(`Página ${i} de ${total}`, pageW / 2, pageH - 9, { align: "center" });
    doc.text(format(new Date(), "dd/MM/yyyy"), pageW - 20, pageH - 9, { align: "right" });
  }
}

// Estilo de tabela padrão — reutilizado em todas as autoTable
const TABLE_STYLES = {
  headStyles: { fillColor: C.slate900, textColor: C.white, fontStyle: "bold" as const, fontSize: 8, cellPadding: 6 },
  alternateRowStyles: { fillColor: C.slate50 },
  bodyStyles: { fontSize: 8, textColor: C.slate700, cellPadding: 5 },
  styles: { lineColor: C.slate200, lineWidth: 0.4 },
  margin: { left: 20, right: 20, bottom: 28 },
};

function drawSectionTitle(doc: jsPDF, text: string, y: number): number {
  // Acento laranja mínimo — linha de 2pt à esquerda do título
  doc.setFillColor(...C.orange);
  doc.rect(20, y, 2, 10, "F");
  doc.setTextColor(...C.slate900);
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text(text, 27, y + 8);
  return y + 18;
}

function xlsxAutoWidth(data: any[][], header: string[]) {
  return header.map((h, i) => {
    let max = h.length;
    data.forEach(row => { const v = row[i] != null ? String(row[i]) : ""; if (v.length > max) max = v.length; });
    return { wch: Math.min(max + 2, 50) };
  });
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────
export default function DesempenhoClientes() {
  const { selectedPizzaria, selectedCampanha, selectedConsumidor, setExportNode, advancedFilterSlot, advancedFilterSlot2 } =
    useOutletContext<DesempenhoContext>();

  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  // UI
  const [filterOpen, setFilterOpen] = useState(false);
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecurrenceGroup, setSelectedRecurrenceGroup] = useState<string | null>(null);
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<string | null>(null);
  const [selectedBirthdayMonth, setSelectedBirthdayMonth] = useState<number | null>(null);
  const toggleRow = (k: string) =>
    setOpenRows(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // ── Data do último pedido
  const [ultimoPedidoOp, setUltimoPedidoOp] = useState<DateOp>("");
  const [ultimoPedidoValor, setUltimoPedidoValor] = useState("este_mes");
  const [ultimoPedidoData, setUltimoPedidoData] = useState("");

  // ── Data de cadastro
  const [cadastroOp, setCadastroOp] = useState<DateOp>("");
  const [cadastroValor, setCadastroValor] = useState("este_mes");
  const [cadastroData, setCadastroData] = useState("");

  // ── Intervalo médio
  const [minIntervalo, setMinIntervalo] = useState("");
  const [maxIntervalo, setMaxIntervalo] = useState("");

  // ── Gênero
  const [generoFilter, setGeneroFilter] = useState<string[]>([]);

  // ── Total de Pedidos
  const [minPedidos, setMinPedidos] = useState("");
  const [maxPedidos, setMaxPedidos] = useState("");

  // ── Total Gasto
  const [minGasto, setMinGasto] = useState("");
  const [maxGasto, setMaxGasto] = useState("");

  // ── Valor do Pedido
  const [valorOp, setValorOp] = useState<"gt" | "lt" | "between" | "">("");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");

  // ── Ticket Médio
  const [minTicket, setMinTicket] = useState("");
  const [maxTicket, setMaxTicket] = useState("");

  // ── Canais
  const [selectedCanais, setSelectedCanais] = useState<string[]>([]);

  // ── Período dos pedidos
  const [quick, setQuick] = useState<QuickPeriod>("campanha");
  const [customFromStr, setCustomFromStr] = useState("");
  const [customToStr, setCustomToStr] = useState("");

  // ── Filtro 2 (refinamento adicional) ─────────────────────────
  const [filterOpen2, setFilterOpen2] = useState(false);
  const [openRows2, setOpenRows2] = useState<Set<string>>(new Set());
  const toggleRow2 = (k: string) =>
    setOpenRows2(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const [ultimoPedidoOp2, setUltimoPedidoOp2] = useState<DateOp>("");
  const [ultimoPedidoValor2, setUltimoPedidoValor2] = useState("este_mes");
  const [ultimoPedidoData2, setUltimoPedidoData2] = useState("");
  const [cadastroOp2, setCadastroOp2] = useState<DateOp>("");
  const [cadastroValor2, setCadastroValor2] = useState("este_mes");
  const [cadastroData2, setCadastroData2] = useState("");
  const [minIntervalo2, setMinIntervalo2] = useState("");
  const [maxIntervalo2, setMaxIntervalo2] = useState("");
  const [generoFilter2, setGeneroFilter2] = useState<string[]>([]);
  const [minPedidos2, setMinPedidos2] = useState("");
  const [maxPedidos2, setMaxPedidos2] = useState("");
  const [minGasto2, setMinGasto2] = useState("");
  const [maxGasto2, setMaxGasto2] = useState("");
  const [valorOp2, setValorOp2] = useState<"gt" | "lt" | "between" | "">("");
  const [valorMin2, setValorMin2] = useState("");
  const [valorMax2, setValorMax2] = useState("");
  const [minTicket2, setMinTicket2] = useState("");
  const [maxTicket2, setMaxTicket2] = useState("");
  const [selectedCanais2, setSelectedCanais2] = useState<string[]>([]);
  const [quick2, setQuick2] = useState<QuickPeriod>("campanha");
  const [customFromStr2, setCustomFromStr2] = useState("");
  const [customToStr2, setCustomToStr2] = useState("");

  // ─── Computed ──────────────────────────────────────────────
  const last12Months = useMemo(() => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const d = subMonths(new Date(), i);
      months.push({ value: format(d, "yyyy-MM"), label: format(d, "MMMM/yyyy", { locale: ptBR }) });
    }
    return months;
  }, []);

  const dateRange = useMemo((): [Date, Date] | null => {
    if (quick === "campanha") return null;
    if (quick === "custom") {
      if (customFromStr && customToStr) {
        const from = startOfDay(new Date(customFromStr));
        const to = endOfDay(new Date(customToStr));
        if (!isNaN(from.getTime()) && !isNaN(to.getTime())) return [from, to];
      }
      return null;
    }
    return getQuickRange(quick as Exclude<QuickPeriod, "campanha" | "custom">);
  }, [quick, customFromStr, customToStr]);

  const periodoLabel = quick === "custom" && dateRange
    ? `${format(dateRange[0], "dd/MM")} – ${format(dateRange[1], "dd/MM")}`
    : QUICK_LABELS[quick as Exclude<QuickPeriod, "custom">] ?? "Personalizado";

  const dateRange2 = useMemo((): [Date, Date] | null => {
    if (quick2 === "campanha") return null;
    if (quick2 === "custom") {
      if (customFromStr2 && customToStr2) {
        const from = startOfDay(new Date(customFromStr2));
        const to = endOfDay(new Date(customToStr2));
        if (!isNaN(from.getTime()) && !isNaN(to.getTime())) return [from, to];
      }
      return null;
    }
    return getQuickRange(quick2 as Exclude<QuickPeriod, "campanha" | "custom">);
  }, [quick2, customFromStr2, customToStr2]);

  const periodoLabel2 = quick2 === "custom" && dateRange2
    ? `${format(dateRange2[0], "dd/MM")} – ${format(dateRange2[1], "dd/MM")}`
    : QUICK_LABELS[quick2 as Exclude<QuickPeriod, "custom">] ?? "Personalizado";

  // ─── Fetch ─────────────────────────────────────────────────
  // RPCs retornam json scalar — bypassam o max-rows=1000 do PostgREST
  // (fetchAll + .range() falhava porque offset>=1000 gera HTTP 416)
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [consRes, pedRes] = await Promise.all([
        supabase.rpc("rpc_consumidores_lista"),
        supabase.rpc("rpc_pedidos_todos"),
      ]);
      const allConsumers: any[] = consRes.data ?? [];
      const allPedidos: any[] = pedRes.data ?? [];

      // Constrói lista de usuarios a partir dos dados embedados nos consumidores
      // (evita query separada que também teria limit=1000)
      const allUsuarios: Usuario[] = allConsumers.map((c: any) => ({
        id: c.usuario_id,
        nome: c.usuarios?.nome ?? "",
        telefone: c.usuarios?.telefone ?? null,
        ultimo_acesso: c.usuarios?.ultimo_acesso ?? null,
        criado_em: c.usuarios?.criado_em ?? c.criado_em,
      }));

      setConsumers(allConsumers as Consumer[]);
      setUsuarios(allUsuarios);
      setPedidos(allPedidos as Pedido[]);
      setLoading(false);
    };
    fetch();
  }, []);

  // ─── enrichedConsumers ─────────────────────────────────────
  const enrichedConsumers = useMemo(() => {
    const uMap = new Map(usuarios.map(u => [u.id, u]));
    const now = new Date();

    let list = consumers.map(c => {
      const u = uMap.get(c.usuario_id);
      let cPedidos = pedidos.filter(p => p.consumidor_id === c.id);

      if (selectedPizzaria !== "todas") cPedidos = cPedidos.filter(p => p.pizzaria_id === selectedPizzaria);
      if (selectedCampanha !== "todas") cPedidos = cPedidos.filter(p => p.campanha_id === selectedCampanha);

      if (dateRange) {
        const [from, to] = dateRange;
        cPedidos = cPedidos.filter(p => {
          const t = new Date(p.data_pedido).getTime();
          return t >= from.getTime() && t <= to.getTime();
        });
      }
      if (selectedCanais.length > 0)
        cPedidos = cPedidos.filter(p => selectedCanais.includes(p.canal || "outros"));
      if (valorOp && valorMin) {
        const v1 = parseFloat(valorMin), v2 = valorMax ? parseFloat(valorMax) : 0;
        cPedidos = cPedidos.filter(p => {
          switch (valorOp) {
            case "gt": return p.valor_total > v1;
            case "lt": return p.valor_total < v1;
            case "between": return p.valor_total >= v1 && p.valor_total <= v2;
            default: return true;
          }
        });
      }

      const totalGasto = cPedidos.reduce((s, p) => s + p.valor_total, 0);
      const totalPedidos = cPedidos.length;
      const ticket = totalPedidos > 0 ? totalGasto / totalPedidos : 0;
      const cuponsAcumulados = cPedidos.reduce((s, p) => s + (p.cupons_gerados || 0), 0);
      const lastOrder = cPedidos.length > 0 ? cPedidos[0].data_pedido : null;
      const daysSinceLastOrder = lastOrder ? differenceInDays(now, new Date(lastOrder)) : null;

      let avgInterval = 0;
      if (cPedidos.length > 1) {
        const sorted = [...cPedidos].sort((a, b) =>
          new Date(a.data_pedido).getTime() - new Date(b.data_pedido).getTime()
        );
        let totalDiff = 0;
        for (let i = 1; i < sorted.length; i++)
          totalDiff += differenceInDays(new Date(sorted[i].data_pedido), new Date(sorted[i - 1].data_pedido));
        avgInterval = totalDiff / (sorted.length - 1);
      }

      return {
        ...c, nome: u?.nome || "—", telefone: u?.telefone || null,
        ultimo_acesso: u?.ultimo_acesso || null,
        totalPedidos, totalGasto, ticket, cuponsAcumulados, lastOrder, daysSinceLastOrder, avgInterval,
      };
    });

    if (selectedConsumidor !== "todos")
      list = list.filter(c => c.usuario_id === selectedConsumidor);

    return list;
  }, [consumers, usuarios, pedidos, selectedPizzaria, selectedCampanha, selectedConsumidor, dateRange, selectedCanais, valorOp, valorMin, valorMax]);

  // ─── filteredByAdv1 (filtro avançado 1) ───────────────────
  const filteredByAdv1 = useMemo(() => {
    let list = [...enrichedConsumers];

    // Data do último pedido
    if (ultimoPedidoOp) {
      const vk = ultimoPedidoValor === "data_especifica" ? ultimoPedidoData : ultimoPedidoValor;
      list = applyDateOpFilter(list, ultimoPedidoOp, vk, c => c.lastOrder ? new Date(c.lastOrder) : null);
    }

    // Data de cadastro
    if (cadastroOp) {
      const vk = cadastroValor === "data_especifica" ? cadastroData : cadastroValor;
      list = applyDateOpFilter(list, cadastroOp, vk, c => new Date(c.criado_em));
    }

    // Intervalo médio
    if (minIntervalo) list = list.filter(c => c.avgInterval >= parseFloat(minIntervalo));
    if (maxIntervalo) list = list.filter(c => c.avgInterval <= parseFloat(maxIntervalo));

    // Gênero
    if (generoFilter.length > 0) list = list.filter(c => c.genero && generoFilter.includes(c.genero));

    // Total de pedidos
    if (minPedidos) list = list.filter(c => c.totalPedidos >= parseInt(minPedidos));
    if (maxPedidos) list = list.filter(c => c.totalPedidos <= parseInt(maxPedidos));

    // Total gasto
    if (minGasto) list = list.filter(c => c.totalGasto >= parseFloat(minGasto));
    if (maxGasto) list = list.filter(c => c.totalGasto <= parseFloat(maxGasto));

    // Ticket médio
    if (minTicket) list = list.filter(c => c.ticket >= parseFloat(minTicket));
    if (maxTicket) list = list.filter(c => c.ticket <= parseFloat(maxTicket));

    return list;
  }, [
    enrichedConsumers,
    ultimoPedidoOp, ultimoPedidoValor, ultimoPedidoData,
    cadastroOp, cadastroValor, cadastroData,
    minIntervalo, maxIntervalo,
    generoFilter,
    minPedidos, maxPedidos,
    minGasto, maxGasto,
    minTicket, maxTicket,
  ]);

  // ─── filtered (filtro avançado 2 encadeado) ────────────────
  const filtered = useMemo(() => {
    let list = [...filteredByAdv1];

    if (ultimoPedidoOp2) {
      const vk = ultimoPedidoValor2 === "data_especifica" ? ultimoPedidoData2 : ultimoPedidoValor2;
      list = applyDateOpFilter(list, ultimoPedidoOp2, vk, c => c.lastOrder ? new Date(c.lastOrder) : null);
    }
    if (cadastroOp2) {
      const vk = cadastroValor2 === "data_especifica" ? cadastroData2 : cadastroValor2;
      list = applyDateOpFilter(list, cadastroOp2, vk, c => new Date(c.criado_em));
    }
    if (minIntervalo2) list = list.filter(c => c.avgInterval >= parseFloat(minIntervalo2));
    if (maxIntervalo2) list = list.filter(c => c.avgInterval <= parseFloat(maxIntervalo2));
    if (generoFilter2.length > 0) list = list.filter(c => c.genero && generoFilter2.includes(c.genero));
    if (minPedidos2) list = list.filter(c => c.totalPedidos >= parseInt(minPedidos2));
    if (maxPedidos2) list = list.filter(c => c.totalPedidos <= parseInt(maxPedidos2));
    if (minGasto2) list = list.filter(c => c.totalGasto >= parseFloat(minGasto2));
    if (maxGasto2) list = list.filter(c => c.totalGasto <= parseFloat(maxGasto2));
    if (minTicket2) list = list.filter(c => c.ticket >= parseFloat(minTicket2));
    if (maxTicket2) list = list.filter(c => c.ticket <= parseFloat(maxTicket2));

    return list;
  }, [
    filteredByAdv1,
    ultimoPedidoOp2, ultimoPedidoValor2, ultimoPedidoData2,
    cadastroOp2, cadastroValor2, cadastroData2,
    minIntervalo2, maxIntervalo2,
    generoFilter2,
    minPedidos2, maxPedidos2,
    minGasto2, maxGasto2,
    minTicket2, maxTicket2,
  ]);

  const clearFilters = () => {
    setUltimoPedidoOp(""); setUltimoPedidoValor("este_mes"); setUltimoPedidoData("");
    setCadastroOp(""); setCadastroValor("este_mes"); setCadastroData("");
    setMinIntervalo(""); setMaxIntervalo("");
    setGeneroFilter([]);
    setMinPedidos(""); setMaxPedidos("");
    setMinGasto(""); setMaxGasto("");
    setValorOp(""); setValorMin(""); setValorMax("");
    setMinTicket(""); setMaxTicket("");
    setSelectedCanais([]);
    setQuick("campanha"); setCustomFromStr(""); setCustomToStr("");
  };

  const clearFilters2 = () => {
    setUltimoPedidoOp2(""); setUltimoPedidoValor2("este_mes"); setUltimoPedidoData2("");
    setCadastroOp2(""); setCadastroValor2("este_mes"); setCadastroData2("");
    setMinIntervalo2(""); setMaxIntervalo2("");
    setGeneroFilter2([]);
    setMinPedidos2(""); setMaxPedidos2("");
    setMinGasto2(""); setMaxGasto2("");
    setValorOp2(""); setValorMin2(""); setValorMax2("");
    setMinTicket2(""); setMaxTicket2("");
    setSelectedCanais2([]);
    setQuick2("campanha"); setCustomFromStr2(""); setCustomToStr2("");
  };

  const activeGroups2 = [
    !!ultimoPedidoOp2,
    !!cadastroOp2,
    !!minIntervalo2 || !!maxIntervalo2,
    generoFilter2.length > 0,
    !!minPedidos2 || !!maxPedidos2,
    !!minGasto2 || !!maxGasto2,
    !!minTicket2 || !!maxTicket2,
    selectedCanais2.length > 0,
    quick2 !== "campanha",
  ].filter(Boolean).length;

  const hasActiveFilters2 = activeGroups2 > 0;

  const tableFiltered = useMemo(() => {
    const recurrenceFns: Record<string, (c: typeof enrichedConsumers[0]) => boolean> = {
      "Nunca compraram":  c => c.totalPedidos === 0,
      "Últimos 7 dias":   c => c.daysSinceLastOrder !== null && c.daysSinceLastOrder <= 7,
      "8 a 15 dias":      c => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 7 && c.daysSinceLastOrder <= 15,
      "16 a 30 dias":     c => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 15 && c.daysSinceLastOrder <= 30,
      "30 a 60 dias":     c => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 30 && c.daysSinceLastOrder <= 60,
      "60 a 90 dias":     c => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 60 && c.daysSinceLastOrder <= 90,
      "90 a 180 dias":    c => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 90 && c.daysSinceLastOrder <= 180,
      "Mais de 180 dias": c => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 180,
    };
    let list = filtered;
    if (selectedRecurrenceGroup) {
      const fn = recurrenceFns[selectedRecurrenceGroup];
      if (fn) list = list.filter(fn);
    }
    if (selectedWeekFilter) {
      const ws = new Date(selectedWeekFilter);
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      list = list.filter(c => { const d = new Date(c.criado_em); return d >= ws && d <= we; });
    }
    if (selectedBirthdayMonth !== null) {
      list = list.filter(c => (c as any).data_nascimento && new Date((c as any).data_nascimento).getMonth() === selectedBirthdayMonth);
    }
    return list;
  }, [filtered, selectedRecurrenceGroup, selectedWeekFilter, selectedBirthdayMonth]);

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(tableFiltered.length / pageSize));
  const pagedFiltered = pageSize === 0 ? tableFiltered : tableFiltered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setCurrentPage(1); }, [filtered]);

  const toggleArr = (arr: string[], v: string) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  // Indicadores individuais
  const activeGroups = [
    !!ultimoPedidoOp,
    !!cadastroOp,
    !!minIntervalo || !!maxIntervalo,
    generoFilter.length > 0,
    !!minPedidos || !!maxPedidos,
    !!minGasto || !!maxGasto,
    !!valorOp,
    !!minTicket || !!maxTicket,
    selectedCanais.length > 0,
    quick !== "campanha",
  ].filter(Boolean).length;

  const hasActiveFilters = activeGroups > 0;

  // ─── Exportar no layout ────────────────────────────────────
  useEffect(() => {
    if (!setExportNode) return;

    const today = format(new Date(), "yyyy-MM-dd");

    // ── Filtros detalhados para o cabeçalho PDF ────────────────
    const resolveValorLabel = (valor: string, data: string) =>
      valor === "data_especifica"
        ? (data || "—")
        : (RELATIVE_VALUES.find(r => r.value === valor)?.label ?? valor);

    const filterLines: string[] = [];
    if (selectedPizzaria !== "todas") filterLines.push("Pizzaria: selecionada");
    if (selectedCampanha !== "todas") filterLines.push("Campanha: selecionada");
    if (ultimoPedidoOp) {
      if (ultimoPedidoOp === "empty" || ultimoPedidoOp === "notempty") {
        filterLines.push(`Último pedido: ${DATE_OP_LABELS[ultimoPedidoOp]}`);
      } else {
        filterLines.push(`Último pedido: ${DATE_OP_LABELS[ultimoPedidoOp as Exclude<DateOp,"">]} ${resolveValorLabel(ultimoPedidoValor, ultimoPedidoData)}`);
      }
    }
    if (cadastroOp) {
      if (cadastroOp === "empty" || cadastroOp === "notempty") {
        filterLines.push(`Cadastro: ${DATE_OP_LABELS[cadastroOp]}`);
      } else {
        filterLines.push(`Cadastro: ${DATE_OP_LABELS[cadastroOp as Exclude<DateOp,"">]} ${resolveValorLabel(cadastroValor, cadastroData)}`);
      }
    }
    if (minIntervalo || maxIntervalo) {
      const p = [minIntervalo && `mín. ${minIntervalo}d`, maxIntervalo && `máx. ${maxIntervalo}d`].filter(Boolean).join(", ");
      filterLines.push(`Intervalo de compras: ${p}`);
    }
    if (generoFilter.length > 0) filterLines.push(`Gênero: ${generoFilter.join(", ")}`);
    if (minPedidos || maxPedidos) {
      const p = [minPedidos && `mín. ${minPedidos}`, maxPedidos && `máx. ${maxPedidos}`].filter(Boolean).join(", ");
      filterLines.push(`Total de pedidos: ${p}`);
    }
    if (minGasto || maxGasto) {
      const p = [minGasto && `mín. R$${minGasto}`, maxGasto && `máx. R$${maxGasto}`].filter(Boolean).join(", ");
      filterLines.push(`Total gasto: ${p}`);
    }
    if (valorOp && valorMin) {
      if (valorOp === "gt") filterLines.push(`Valor do pedido: maior que R$${valorMin}`);
      else if (valorOp === "lt") filterLines.push(`Valor do pedido: menor que R$${valorMin}`);
      else filterLines.push(`Valor do pedido: entre R$${valorMin} e R$${valorMax}`);
    }
    if (minTicket || maxTicket) {
      const p = [minTicket && `mín. R$${minTicket}`, maxTicket && `máx. R$${maxTicket}`].filter(Boolean).join(", ");
      filterLines.push(`Ticket médio: ${p}`);
    }
    if (selectedCanais.length > 0) {
      filterLines.push(`Canal: ${selectedCanais.map(v => CANAIS.find(c => c.value === v)?.label ?? v).join(", ")}`);
    }
    if (quick !== "campanha") {
      filterLines.push(`Período dos pedidos: ${QUICK_LABELS[quick as Exclude<QuickPeriod,"custom">] ?? "Personalizado"}`);
    }
    filterLines.push(`Total exportado: ${filtered.length} cliente${filtered.length !== 1 ? "s" : ""}`);

    // Título dinâmico baseado nos filtros ativos
    const advancedParts: string[] = [];
    if (ultimoPedidoOp) advancedParts.push("Último Pedido");
    if (cadastroOp) advancedParts.push("Cadastro");
    if (minIntervalo || maxIntervalo) advancedParts.push("Intervalo de Compras");
    if (generoFilter.length > 0) advancedParts.push(generoFilter.join(", "));
    if (minPedidos || maxPedidos) advancedParts.push("Total de Pedidos");
    if (minGasto || maxGasto) advancedParts.push("Total Gasto");
    if (valorOp) advancedParts.push("Valor do Pedido");
    if (minTicket || maxTicket) advancedParts.push("Ticket Médio");
    if (selectedCanais.length > 0) advancedParts.push(
      selectedCanais.map(v => CANAIS.find(c => c.value === v)?.label ?? v).join(", ")
    );
    if (quick !== "campanha") advancedParts.push(
      QUICK_LABELS[quick as Exclude<QuickPeriod, "custom">] ?? "Período personalizado"
    );
    const reportTitle = advancedParts.length === 0
      ? "Relatório de Clientes"
      : advancedParts.length === 1
        ? `Clientes — ${advancedParts[0]}`
        : `Clientes — ${advancedParts.slice(0, 2).join(", ")}${advancedParts.length > 2 ? ` +${advancedParts.length - 2}` : ""}`;
    const fileSlug = reportTitle.toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    // KPIs calculados a partir de filtered
    const totalC = filtered.length;
    const ativosC = filtered.filter(c => c.daysSinceLastOrder !== null && c.daysSinceLastOrder <= 30).length;
    const novosC = (() => {
      const n = new Date();
      return filtered.filter(c => {
        const d = new Date(c.criado_em);
        return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
      }).length;
    })();

    // ── Sintético PDF ─────────────────────────────────────────
    const exportSinteticoPDF = async () => {
      const lettering = await loadLetteringDataUrl();
      const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
      const pageW = doc.internal.pageSize.getWidth();
      let y = buildPdfHeader(doc, reportTitle, "Desempenho · Sintético", filterLines, lettering);

      // Todos os dados calculados a partir de `filtered` — reflete os filtros aplicados
      const filteredAvgInterval = (() => {
        const actives = filtered.filter(c => c.avgInterval > 0);
        if (actives.length === 0) return 0;
        return actives.reduce((s, c) => s + c.avgInterval, 0) / actives.length;
      })();

      const filteredRecurrence = (() => {
        const groups = [
          { name: "Nunca compraram",  fn: (c: typeof filtered[0]) => c.totalPedidos === 0 },
          { name: "Últimos 7 dias",   fn: (c: typeof filtered[0]) => c.daysSinceLastOrder !== null && c.daysSinceLastOrder <= 7 },
          { name: "8 a 15 dias",      fn: (c: typeof filtered[0]) => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 7 && c.daysSinceLastOrder <= 15 },
          { name: "16 a 30 dias",     fn: (c: typeof filtered[0]) => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 15 && c.daysSinceLastOrder <= 30 },
          { name: "30 a 60 dias",     fn: (c: typeof filtered[0]) => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 30 && c.daysSinceLastOrder <= 60 },
          { name: "60 a 90 dias",     fn: (c: typeof filtered[0]) => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 60 && c.daysSinceLastOrder <= 90 },
          { name: "90 a 180 dias",    fn: (c: typeof filtered[0]) => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 90 && c.daysSinceLastOrder <= 180 },
          { name: "Mais de 180 dias", fn: (c: typeof filtered[0]) => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 180 },
        ];
        const total = filtered.length || 1;
        return groups.map(g => {
          const count = filtered.filter(g.fn).length;
          return { name: g.name, value: count, pct: (count / total) * 100 };
        });
      })();

      const filteredWeekly = (() => {
        const now = new Date();
        return Array.from({ length: 8 }, (_, i) => {
          const weekStart = startOfWeek(subWeeks(now, 7 - i), { weekStartsOn: 1 });
          const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
          const count = filtered.filter(c => {
            const d = new Date(c.criado_em);
            return d >= weekStart && d <= weekEnd;
          }).length;
          return { label: format(weekStart, "dd/MM", { locale: ptBR }), clientes: count };
        });
      })();

      const filteredBirthdays = (() => {
        const counts = Array(12).fill(0);
        filtered.forEach(c => {
          if ((c as any).data_nascimento)
            counts[new Date((c as any).data_nascimento).getMonth()] += 1;
        });
        const now = new Date();
        return counts.map((count, i) => ({ month: MONTHS[i].substring(0, 3), count, isCurrent: i === now.getMonth() }));
      })();

      // KPI boxes
      const kpis = [
        { label: "Total de Clientes", value: String(totalC) },
        { label: "Ativos (últimos 30d)", value: String(ativosC) },
        { label: "Novos este mês", value: String(novosC) },
        { label: "Intervalo Médio", value: `${Math.round(filteredAvgInterval)}d` },
      ];
      const gap = 8;
      const boxW = (pageW - 40 - gap * 3) / 4;
      const boxH = 60;
      kpis.forEach((kpi, i) => {
        const x = 20 + i * (boxW + gap);
        doc.setFillColor(...C.white);
        doc.setDrawColor(...C.slate200);
        doc.setLineWidth(0.6);
        doc.roundedRect(x, y, boxW, boxH, 4, 4, "FD");
        doc.setFillColor(...C.orange);
        doc.rect(x, y, boxW, 2.5, "F");
        doc.setTextColor(...C.slate500);
        doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
        doc.text(kpi.label, x + boxW / 2, y + 17, { align: "center" });
        doc.setTextColor(...C.slate900);
        doc.setFontSize(18); doc.setFont("helvetica", "bold");
        doc.text(kpi.value, x + boxW / 2, y + 44, { align: "center" });
      });
      y += boxH + 24;

      // Recorrência
      y = drawSectionTitle(doc, "Recorrência dos Clientes", y);
      autoTable(doc, {
        head: [["Grupo", "Quantidade", "%"]],
        body: filteredRecurrence.map(g => [g.name, String(g.value), `${g.pct.toFixed(1)}%`]),
        startY: y, ...TABLE_STYLES,
        columnStyles: { 1: { halign: "center" }, 2: { halign: "center" } },
      });
      y = (doc as any).lastAutoTable.finalY + 24;

      // Novos por semana
      y = drawSectionTitle(doc, "Novos Clientes por Semana (últimas 8 semanas)", y);
      autoTable(doc, {
        head: [["Semana", "Novos Cadastros"]],
        body: filteredWeekly.map(w => [w.label, String(w.clientes)]),
        startY: y, ...TABLE_STYLES,
        columnStyles: { 1: { halign: "center" } },
      });
      y = (doc as any).lastAutoTable.finalY + 24;

      // Aniversariantes
      y = drawSectionTitle(doc, "Aniversariantes por Mês", y);
      autoTable(doc, {
        head: [["Mês", "Quantidade"]],
        body: filteredBirthdays.map(b => [b.month, String(b.count)]),
        startY: y, ...TABLE_STYLES,
        columnStyles: { 1: { halign: "center" } },
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

      // Cards de totais — 3 pills em linha
      const avgTicketGlobal = totalC > 0
        ? filtered.reduce((s, c) => s + c.ticket, 0) / totalC : 0;
      const summaryItems = [
        { label: "Total de Clientes", value: String(totalC) },
        { label: "Ativos (30d)", value: String(ativosC) },
        { label: "Ticket Médio Global", value: `R$ ${avgTicketGlobal.toFixed(2)}` },
      ];
      const pillW = (pageW - 40 - 16) / 3;
      const pillH = 44;
      summaryItems.forEach((item, i) => {
        const x = 20 + i * (pillW + 8);
        doc.setFillColor(...C.slate50);
        doc.setDrawColor(...C.slate200);
        doc.setLineWidth(0.5);
        doc.roundedRect(x, y, pillW, pillH, 3, 3, "FD");
        doc.setTextColor(...C.slate500);
        doc.setFontSize(7); doc.setFont("helvetica", "normal");
        doc.text(item.label, x + pillW / 2, y + 14, { align: "center" });
        doc.setTextColor(...C.slate900);
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text(item.value, x + pillW / 2, y + 33, { align: "center" });
      });
      y += pillH + 20;

      autoTable(doc, {
        head: [["Nome", "Telefone", "Pedidos", "Cupons", "Total Gasto", "Ticket Médio", "Último Pedido", "Dias", "Intervalo", "Gênero"]],
        body: filtered.map(c => [
          c.nome,
          c.telefone || "—",
          String(c.totalPedidos),
          String(c.cuponsAcumulados),
          `R$ ${c.totalGasto.toFixed(2)}`,
          c.totalPedidos > 0 ? `R$ ${c.ticket.toFixed(2)}` : "—",
          c.lastOrder ? format(new Date(c.lastOrder), "dd/MM/yyyy") : "—",
          c.daysSinceLastOrder !== null ? `${c.daysSinceLastOrder}d` : "—",
          c.avgInterval > 0 ? `${Math.round(c.avgInterval)}d` : "—",
          (c as any).genero || "—",
        ]),
        startY: y,
        ...TABLE_STYLES,
        headStyles: { ...TABLE_STYLES.headStyles, fontSize: 7, cellPadding: 5 },
        bodyStyles: { fontSize: 7, textColor: C.slate700, cellPadding: 4 },
        columnStyles: {
          2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "right" },
          5: { halign: "right" }, 6: { halign: "center" }, 7: { halign: "center" },
          8: { halign: "center" }, 9: { halign: "center" },
        },
      });

      addPdfFooter(doc, `${reportTitle} — Analítico`);
      doc.save(`${fileSlug}-analitico-${today}.pdf`);
    };

    // ── Excel ──────────────────────────────────────────────────
    const exportExcel = () => {
      const wb = XLSX.utils.book_new();

      const dadosHeader = ["Nome", "Telefone", "Total Pedidos", "Total Gasto (R$)", "Ticket Médio (R$)", "Último Pedido", "Dias desde último", "Intervalo Médio (d)", "Gênero", "Aniversário"];
      const dadosBody = filtered.map(c => [
        c.nome, c.telefone || "",
        c.totalPedidos, parseFloat(c.totalGasto.toFixed(2)), parseFloat(c.ticket.toFixed(2)),
        c.lastOrder ? format(new Date(c.lastOrder), "dd/MM/yyyy") : "",
        c.daysSinceLastOrder ?? "",
        c.avgInterval > 0 ? Math.round(c.avgInterval) : "",
        (c as any).genero || "",
        (c as any).data_nascimento ? format(new Date((c as any).data_nascimento), "dd/MM") : "",
      ]);
      const dadosWs = XLSX.utils.aoa_to_sheet([dadosHeader, ...dadosBody]);
      dadosWs["!cols"] = xlsxAutoWidth(dadosBody, dadosHeader);
      XLSX.utils.book_append_sheet(wb, dadosWs, "Dados");

      const recHeader = ["Grupo", "Quantidade", "%"];
      const recBody = recurrenceGroups.map(g => [g.name, g.value, parseFloat(g.pct.toFixed(1))]);
      const recWs = XLSX.utils.aoa_to_sheet([recHeader, ...recBody]);
      recWs["!cols"] = xlsxAutoWidth(recBody, recHeader);
      XLSX.utils.book_append_sheet(wb, recWs, "Recorrência");

      const metaWs = XLSX.utils.aoa_to_sheet([
        ["Data de exportação", format(new Date(), "dd/MM/yyyy HH:mm")],
        ["Total de clientes", totalC],
        ["Filtros aplicados", filterLines.join(" · ")],
      ]);
      XLSX.utils.book_append_sheet(wb, metaWs, "Metadados");

      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      downloadBlob(new Blob([buf], { type: "application/octet-stream" }), `${fileSlug}-${today}.xlsx`);
    };

    // ── CSV ────────────────────────────────────────────────────
    const exportCSV = () => {
      const cols = [
        { key: "nome", label: "Nome" }, { key: "telefone", label: "Telefone" },
        { key: "totalPedidos", label: "Total Pedidos" }, { key: "totalGasto", label: "Total Gasto" },
        { key: "ticket", label: "Ticket Médio" }, { key: "ultimoPedido", label: "Último Pedido" },
        { key: "intervalo", label: "Intervalo Médio" }, { key: "genero", label: "Gênero" },
        { key: "aniversario", label: "Aniversário" },
      ];
      const rows = filtered.map(c => ({
        nome: c.nome, telefone: c.telefone || "",
        totalPedidos: c.totalPedidos, totalGasto: c.totalGasto.toFixed(2),
        ticket: c.ticket.toFixed(2),
        ultimoPedido: c.lastOrder ? format(new Date(c.lastOrder), "dd/MM/yyyy") : "—",
        intervalo: c.avgInterval > 0 ? Math.round(c.avgInterval) + "d" : "—",
        genero: (c as any).genero || "—",
        aniversario: (c as any).data_nascimento ? format(new Date((c as any).data_nascimento), "dd/MM") : "—",
      }));
      const header = cols.map(c => c.label).join(",");
      const body = rows.map(r => cols.map(col => {
        const v = (r as any)[col.key] ?? "";
        return typeof v === "string" && v.includes(",") ? `"${v}"` : String(v);
      }).join(","));
      downloadBlob(
        new Blob(["﻿" + [header, ...body].join("\n")], { type: "text/csv;charset=utf-8" }),
        `${fileSlug}-${today}.csv`
      );
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
      </DropdownMenu>
    );
    return () => setExportNode(null);
  }, [
    filtered, setExportNode,
    selectedPizzaria, selectedCampanha,
    generoFilter, quick, selectedCanais,
    minPedidos, maxPedidos, minGasto, maxGasto,
    valorOp, valorMin, valorMax, minTicket, maxTicket,
  ]);

  // ─── KPIs ──────────────────────────────────────────────────
  const now = new Date();
  const totalClientes = filtered.length;
  const novosEstaSemana = filtered.filter(c => differenceInDays(now, new Date(c.criado_em)) <= 7).length;
  const novosEsteMes = filtered.filter(c => {
    const d = new Date(c.criado_em);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const clientesAtivos = filtered.filter(c => c.daysSinceLastOrder !== null && c.daysSinceLastOrder <= 30).length;

  const weeklyNewClients = useMemo(() => {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
      const count = enrichedConsumers.filter(c => { const d = new Date(c.criado_em); return d >= weekStart && d <= weekEnd; }).length;
      weeks.push({ label: format(weekStart, "dd/MM", { locale: ptBR }), weekStartIso: weekStart.toISOString(), clientes: count });
    }
    return weeks;
  }, [enrichedConsumers]);

  const recurrenceGroups = useMemo(() => {
    type C = typeof enrichedConsumers[0];
    const groups: { label: string; filter: (c: C) => boolean }[] = [
      { label: "Nunca compraram",  filter: c => c.totalPedidos === 0 },
      { label: "Últimos 7 dias",   filter: c => c.daysSinceLastOrder !== null && c.daysSinceLastOrder <= 7 },
      { label: "8 a 15 dias",      filter: c => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 7 && c.daysSinceLastOrder <= 15 },
      { label: "16 a 30 dias",     filter: c => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 15 && c.daysSinceLastOrder <= 30 },
      { label: "30 a 60 dias",     filter: c => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 30 && c.daysSinceLastOrder <= 60 },
      { label: "60 a 90 dias",     filter: c => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 60 && c.daysSinceLastOrder <= 90 },
      { label: "90 a 180 dias",    filter: c => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 90 && c.daysSinceLastOrder <= 180 },
      { label: "Mais de 180 dias", filter: c => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 180 },
    ];
    const total = enrichedConsumers.length || 1;
    return groups.map(g => {
      const count = enrichedConsumers.filter(g.filter).length;
      return { name: g.label, value: count, pct: (count / total) * 100 };
    });
  }, [enrichedConsumers]);

  const birthdayData = useMemo(() => {
    const counts = Array(12).fill(0);
    enrichedConsumers.forEach(c => { if (c.data_nascimento) counts[new Date(c.data_nascimento).getMonth()] += 1; });
    return counts.map((count, i) => ({ month: MONTHS[i].substring(0, 3), count, isCurrent: i === now.getMonth() }));
  }, [enrichedConsumers]);

  const avgGlobalInterval = useMemo(() => {
    const actives = enrichedConsumers.filter(c => c.avgInterval > 0);
    if (actives.length === 0) return 0;
    return actives.reduce((s, c) => s + c.avgInterval, 0) / actives.length;
  }, [enrichedConsumers]);

  const intervalTrend = useMemo(() => {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
      const consumersWithOrder = enrichedConsumers.filter(c =>
        pedidos.some(p => p.consumidor_id === c.id && new Date(p.data_pedido) >= weekStart && new Date(p.data_pedido) <= weekEnd)
      );
      const avg = consumersWithOrder.length > 0
        ? consumersWithOrder.reduce((s, c) => s + c.avgInterval, 0) / consumersWithOrder.length : 0;
      weeks.push({ label: format(weekStart, "dd/MM", { locale: ptBR }), dias: Math.round(avg) });
    }
    return weeks;
  }, [enrichedConsumers, pedidos]);

  // ─────────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Total de clientes</p><p className="text-2xl font-bold">{totalClientes}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10"><UserPlus className="h-5 w-5 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Novos esta semana</p><p className="text-2xl font-bold">{novosEstaSemana}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10"><UserPlus className="h-5 w-5 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Novos este mês</p><p className="text-2xl font-bold">{novosEsteMes}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10"><Activity className="h-5 w-5 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Clientes ativos</p><p className="text-2xl font-bold">{clientesAtivos}</p></div>
        </CardContent></Card>
      </div>

      {/* ── Lista de clientes (resultado dos filtros) ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base">
              Clientes
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {tableFiltered.length} resultado{tableFiltered.length !== 1 ? "s" : ""}
              </span>
            </CardTitle>
            {selectedRecurrenceGroup && (
              <Button variant="outline" size="sm" className="h-6 text-xs px-2 gap-1 border-primary/40 text-primary"
                onClick={() => { setSelectedRecurrenceGroup(null); setCurrentPage(1); }}>
                {selectedRecurrenceGroup} ×
              </Button>
            )}
            {selectedWeekFilter && (
              <Button variant="outline" size="sm" className="h-6 text-xs px-2 gap-1 border-primary/40 text-primary"
                onClick={() => { setSelectedWeekFilter(null); setCurrentPage(1); }}>
                Semana {weeklyNewClients.find(w => w.weekStartIso === selectedWeekFilter)?.label ?? "—"} ×
              </Button>
            )}
            {selectedBirthdayMonth !== null && (
              <Button variant="outline" size="sm" className="h-6 text-xs px-2 gap-1 border-primary/40 text-primary"
                onClick={() => { setSelectedBirthdayMonth(null); setCurrentPage(1); }}>
                Aniversário {birthdayData[selectedBirthdayMonth]?.month} ×
              </Button>
            )}
          </div>

          {tableFiltered.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span>Linhas por página:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={v => { setPageSize(Number(v)); setCurrentPage(1); }}
                >
                  <SelectTrigger className="h-7 w-[70px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100, 0].map(n => (
                      <SelectItem key={n} value={String(n)} className="text-xs">
                        {n === 0 ? "Todos" : n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {pageSize > 0 && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <span className="mr-1">
                    {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, tableFiltered.length)} de {tableFiltered.length}
                  </span>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-xs"
                    disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>«</Button>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-xs"
                    disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>‹</Button>
                  <span className="px-2">{currentPage} / {totalPages}</span>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-xs"
                    disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>›</Button>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-xs"
                    disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>»</Button>
                </div>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {tableFiltered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente encontrado com os filtros aplicados.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-center">Pedidos</TableHead>
                    <TableHead className="text-right">Total Gasto</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                    <TableHead className="text-center">Último Pedido</TableHead>
                    <TableHead className="text-center">Intervalo Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedFiltered.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <div>
                          <p className="text-sm">{c.nome}</p>
                          {c.telefone && <p className="text-xs text-muted-foreground">{c.telefone}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{c.totalPedidos}</TableCell>
                      <TableCell className="text-right">R$ {c.totalGasto.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{c.totalPedidos > 0 ? `R$ ${c.ticket.toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="text-center text-sm">
                        {c.lastOrder ? format(new Date(c.lastOrder), "dd/MM/yyyy") : "—"}
                        {c.daysSinceLastOrder !== null && (
                          <p className="text-xs text-muted-foreground">{c.daysSinceLastOrder}d atrás</p>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {c.avgInterval > 0 ? `${Math.round(c.avgInterval)}d` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Gráficos lado a lado ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Novos clientes por semana */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base">Novos clientes por semana</CardTitle>
            {selectedWeekFilter && (
              <Button variant="outline" size="sm" className="h-6 text-xs px-2 gap-1 border-primary/40 text-primary"
                onClick={() => { setSelectedWeekFilter(null); setCurrentPage(1); }}>
                Semana de {weeklyNewClients.find(w => w.weekStartIso === selectedWeekFilter)?.label ?? "—"} ×
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyNewClients}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar
                    dataKey="clientes" radius={[4, 4, 0, 0]}
                    onClick={(data: any) => { setSelectedWeekFilter(prev => prev === data.weekStartIso ? null : data.weekStartIso); setCurrentPage(1); }}
                    style={{ cursor: "pointer" }}
                  >
                    {weeklyNewClients.map((d, i) => (
                      <Cell key={i}
                        fill="#f97316"
                        opacity={selectedWeekFilter && selectedWeekFilter !== d.weekStartIso ? 0.3 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recorrência dos clientes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recorrência dos clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center h-[280px]">
              <div className="h-full flex-1 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 24, bottom: 0, left: 0, right: 0 }}>
                    <Pie
                      data={recurrenceGroups}
                      dataKey="value"
                      nameKey="name"
                      cx="50%" cy="52%"
                      innerRadius={55}
                      outerRadius={95}
                      label={({ pct }: any) => pct > 5 ? `${pct.toFixed(0)}%` : ""}
                      labelLine={false}
                      onClick={(entry: any) => {
                        const name = entry?.name as string;
                        setSelectedRecurrenceGroup(prev => prev === name ? null : name);
                        setCurrentPage(1);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      {recurrenceGroups.map((g, i) => (
                        <Cell
                          key={i}
                          fill={COLORS[i % COLORS.length]}
                          opacity={selectedRecurrenceGroup && selectedRecurrenceGroup !== g.name ? 0.35 : 1}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number, name: string) => [v, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="shrink-0 w-[160px] flex flex-col justify-center gap-2 pr-2">
                {recurrenceGroups.map((g, i) => (
                  <button
                    key={g.name}
                    className={`flex items-center justify-between text-left w-full rounded px-1 py-0.5 transition-opacity ${selectedRecurrenceGroup && selectedRecurrenceGroup !== g.name ? "opacity-35" : ""} hover:bg-muted/40`}
                    onClick={() => { setSelectedRecurrenceGroup(prev => prev === g.name ? null : g.name); setCurrentPage(1); }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs leading-tight truncate text-muted-foreground">{g.name}</span>
                    </div>
                    <span className="text-xs font-semibold ml-2 shrink-0">{g.value}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ── Aniversariantes + Intervalo lado a lado ── */}
      <div className="grid grid-cols-2 gap-4">

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base">Aniversariantes por mês</CardTitle>
            {selectedBirthdayMonth !== null && (
              <Button variant="outline" size="sm" className="h-6 text-xs px-2 gap-1 border-primary/40 text-primary"
                onClick={() => { setSelectedBirthdayMonth(null); setCurrentPage(1); }}>
                {birthdayData[selectedBirthdayMonth]?.month} ×
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={birthdayData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar
                    dataKey="count" radius={[4, 4, 0, 0]}
                    onClick={(_: any, index: number) => { setSelectedBirthdayMonth(prev => prev === index ? null : index); setCurrentPage(1); }}
                    style={{ cursor: "pointer" }}
                  >
                    {birthdayData.map((d, i) => (
                      <Cell key={i}
                        fill={selectedBirthdayMonth === i ? "#f97316" : d.isCurrent && selectedBirthdayMonth === null ? "#f97316" : "#6b7280"}
                        opacity={selectedBirthdayMonth !== null && selectedBirthdayMonth !== i ? 0.3 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Intervalo de compras</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-4xl font-bold text-primary">{Math.round(avgGlobalInterval)} dias</p>
                <p className="text-xs text-muted-foreground mt-1">Média de intervalo entre pedidos dos clientes ativos</p>
              </div>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={intervalTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${v} dias`, "Intervalo médio"]} />
                  <Line animationDuration={3000} animationEasing="linear" type="monotone" dataKey="dias" stroke="#f97316" strokeWidth={2} dot={{ fill: "#f97316" }}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ── Botão Avançado portado para a barra de filtros do layout ── */}
      {advancedFilterSlot && createPortal(
        <div className="flex items-center gap-3">
          <div className="w-px h-5 bg-border" />
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={hasActiveFilters ? "default" : "outline"}
                size="sm"
                className="text-xs h-8 gap-1.5"
              >
                <SlidersHorizontal className="h-3 w-3" />
                Avançado
                {activeGroups > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-white/20 font-bold leading-none">
                    {activeGroups}
                  </span>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[400px] p-0" align="start" sideOffset={4}>
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <span className="text-sm font-semibold">Filtros avançados</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{filteredByAdv1.length} resultado{filteredByAdv1.length !== 1 ? "s" : ""}</span>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={clearFilters}>
                      Limpar tudo
                    </Button>
                  )}
                </div>
              </div>

              <div className="max-h-[70vh] overflow-y-auto divide-y divide-border">

                <FilterRow title="Data do último pedido" active={!!ultimoPedidoOp} open={openRows.has("ultimoPedido")} onToggle={() => toggleRow("ultimoPedido")}>
                  <DateFieldFilter op={ultimoPedidoOp} onOpChange={setUltimoPedidoOp} valor={ultimoPedidoValor} onValorChange={setUltimoPedidoValor} data={ultimoPedidoData} onDataChange={setUltimoPedidoData} last12Months={last12Months} />
                </FilterRow>

                <FilterRow title="Data de Cadastro" active={!!cadastroOp} open={openRows.has("cadastro")} onToggle={() => toggleRow("cadastro")}>
                  <DateFieldFilter op={cadastroOp} onOpChange={setCadastroOp} valor={cadastroValor} onValorChange={setCadastroValor} data={cadastroData} onDataChange={setCadastroData} last12Months={last12Months} />
                </FilterRow>

                <FilterRow title="Intervalo médio de Compras (dias)" active={!!minIntervalo || !!maxIntervalo} open={openRows.has("intervalo")} onToggle={() => toggleRow("intervalo")}>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Mín" value={minIntervalo} onChange={e => setMinIntervalo(e.target.value)} className="h-7 text-xs" />
                    <Input type="number" placeholder="Máx" value={maxIntervalo} onChange={e => setMaxIntervalo(e.target.value)} className="h-7 text-xs" />
                  </div>
                </FilterRow>

                <FilterRow title="Gênero" active={generoFilter.length > 0} open={openRows.has("genero")} onToggle={() => toggleRow("genero")}>
                  <div className="space-y-1.5">
                    {[{ v: "masculino", l: "Masculino" }, { v: "feminino", l: "Feminino" }, { v: "outro", l: "Outro" }, { v: "nao_informado", l: "Não informado" }].map(g => (
                      <label key={g.v} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox checked={generoFilter.includes(g.v)} onCheckedChange={() => setGeneroFilter(toggleArr(generoFilter, g.v))} />
                        {g.l}
                      </label>
                    ))}
                  </div>
                </FilterRow>

                <FilterRow title="Total de Pedidos" active={!!minPedidos || !!maxPedidos} open={openRows.has("totalPedidos")} onToggle={() => toggleRow("totalPedidos")}>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Mín" value={minPedidos} onChange={e => setMinPedidos(e.target.value)} className="h-7 text-xs" />
                    <Input type="number" placeholder="Máx" value={maxPedidos} onChange={e => setMaxPedidos(e.target.value)} className="h-7 text-xs" />
                  </div>
                </FilterRow>

                <FilterRow title="Total Gasto (R$)" active={!!minGasto || !!maxGasto} open={openRows.has("totalGasto")} onToggle={() => toggleRow("totalGasto")}>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Mín" value={minGasto} onChange={e => setMinGasto(e.target.value)} className="h-7 text-xs" />
                    <Input type="number" placeholder="Máx" value={maxGasto} onChange={e => setMaxGasto(e.target.value)} className="h-7 text-xs" />
                  </div>
                </FilterRow>

                <FilterRow title="Valor do Pedido" active={!!valorOp} open={openRows.has("valorPedido")} onToggle={() => toggleRow("valorPedido")}>
                  <div className="space-y-2">
                    <Select value={valorOp || "__none__"} onValueChange={v => setValorOp(v === "__none__" ? "" : v as typeof valorOp)}>
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
                        <Input type="number" placeholder={valorOp === "between" ? "Mín (R$)" : "Valor (R$)"} value={valorMin} onChange={e => setValorMin(e.target.value)} className="h-7 text-xs" />
                        {valorOp === "between" && <Input type="number" placeholder="Máx (R$)" value={valorMax} onChange={e => setValorMax(e.target.value)} className="h-7 text-xs" />}
                      </div>
                    )}
                  </div>
                </FilterRow>

                <FilterRow title="Ticket Médio (R$)" active={!!minTicket || !!maxTicket} open={openRows.has("ticketMedio")} onToggle={() => toggleRow("ticketMedio")}>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Mín" value={minTicket} onChange={e => setMinTicket(e.target.value)} className="h-7 text-xs" />
                    <Input type="number" placeholder="Máx" value={maxTicket} onChange={e => setMaxTicket(e.target.value)} className="h-7 text-xs" />
                  </div>
                </FilterRow>

                <FilterRow title="Canais de Venda" active={selectedCanais.length > 0} open={openRows.has("canais")} onToggle={() => toggleRow("canais")}>
                  <div className="space-y-1.5">
                    {CANAIS.map(c => (
                      <label key={c.value} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox checked={selectedCanais.includes(c.value)} onCheckedChange={() => setSelectedCanais(prev => prev.includes(c.value) ? prev.filter(x => x !== c.value) : [...prev, c.value])} />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </FilterRow>

                <FilterRow title={`Período dos Pedidos${quick !== "campanha" ? ` — ${periodoLabel}` : ""}`} active={quick !== "campanha"} open={openRows.has("periodo")} onToggle={() => toggleRow("periodo")}>
                  <div className="space-y-1">
                    {(Object.entries(QUICK_LABELS) as [Exclude<QuickPeriod, "custom">, string][]).map(([k, l]) => (
                      <button key={k} onClick={() => setQuick(k)} className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${quick === k ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"}`}>{l}</button>
                    ))}
                    <button onClick={() => setQuick("custom")} className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${quick === "custom" ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"}`}>Personalizado</button>
                    {quick === "custom" && (
                      <div className="flex gap-2 pt-1">
                        <Input type="date" value={customFromStr} onChange={e => setCustomFromStr(e.target.value)} className="h-7 text-xs" />
                        <Input type="date" value={customToStr} onChange={e => setCustomToStr(e.target.value)} className="h-7 text-xs" />
                      </div>
                    )}
                  </div>
                </FilterRow>

              </div>
            </PopoverContent>
          </Popover>
        </div>,
        advancedFilterSlot
      )}

      {/* ── Botão Refinar portado para o segundo slot ── */}
      {advancedFilterSlot2 && createPortal(
        <div className="flex items-center gap-3">
          <div className="w-px h-5 bg-border" />
          <Popover open={filterOpen2} onOpenChange={setFilterOpen2}>
            <PopoverTrigger asChild>
              <Button
                variant={hasActiveFilters2 ? "default" : "outline"}
                size="sm"
                className="text-xs h-8 gap-1.5"
              >
                <SlidersHorizontal className="h-3 w-3" />
                Refinar
                {activeGroups2 > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-white/20 font-bold leading-none">
                    {activeGroups2}
                  </span>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[400px] p-0" align="start" sideOffset={4}>
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <span className="text-sm font-semibold">Refinamento adicional</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
                  {hasActiveFilters2 && (
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={clearFilters2}>
                      Limpar tudo
                    </Button>
                  )}
                </div>
              </div>

              <div className="max-h-[70vh] overflow-y-auto divide-y divide-border">

                <FilterRow title="Data do último pedido" active={!!ultimoPedidoOp2} open={openRows2.has("ultimoPedido")} onToggle={() => toggleRow2("ultimoPedido")}>
                  <DateFieldFilter op={ultimoPedidoOp2} onOpChange={setUltimoPedidoOp2} valor={ultimoPedidoValor2} onValorChange={setUltimoPedidoValor2} data={ultimoPedidoData2} onDataChange={setUltimoPedidoData2} last12Months={last12Months} />
                </FilterRow>

                <FilterRow title="Data de Cadastro" active={!!cadastroOp2} open={openRows2.has("cadastro")} onToggle={() => toggleRow2("cadastro")}>
                  <DateFieldFilter op={cadastroOp2} onOpChange={setCadastroOp2} valor={cadastroValor2} onValorChange={setCadastroValor2} data={cadastroData2} onDataChange={setCadastroData2} last12Months={last12Months} />
                </FilterRow>

                <FilterRow title="Intervalo médio de Compras (dias)" active={!!minIntervalo2 || !!maxIntervalo2} open={openRows2.has("intervalo")} onToggle={() => toggleRow2("intervalo")}>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Mín" value={minIntervalo2} onChange={e => setMinIntervalo2(e.target.value)} className="h-7 text-xs" />
                    <Input type="number" placeholder="Máx" value={maxIntervalo2} onChange={e => setMaxIntervalo2(e.target.value)} className="h-7 text-xs" />
                  </div>
                </FilterRow>

                <FilterRow title="Gênero" active={generoFilter2.length > 0} open={openRows2.has("genero")} onToggle={() => toggleRow2("genero")}>
                  <div className="space-y-1.5">
                    {[{ v: "masculino", l: "Masculino" }, { v: "feminino", l: "Feminino" }, { v: "outro", l: "Outro" }, { v: "nao_informado", l: "Não informado" }].map(g => (
                      <label key={g.v} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox checked={generoFilter2.includes(g.v)} onCheckedChange={() => setGeneroFilter2(toggleArr(generoFilter2, g.v))} />
                        {g.l}
                      </label>
                    ))}
                  </div>
                </FilterRow>

                <FilterRow title="Total de Pedidos" active={!!minPedidos2 || !!maxPedidos2} open={openRows2.has("totalPedidos")} onToggle={() => toggleRow2("totalPedidos")}>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Mín" value={minPedidos2} onChange={e => setMinPedidos2(e.target.value)} className="h-7 text-xs" />
                    <Input type="number" placeholder="Máx" value={maxPedidos2} onChange={e => setMaxPedidos2(e.target.value)} className="h-7 text-xs" />
                  </div>
                </FilterRow>

                <FilterRow title="Total Gasto (R$)" active={!!minGasto2 || !!maxGasto2} open={openRows2.has("totalGasto")} onToggle={() => toggleRow2("totalGasto")}>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Mín" value={minGasto2} onChange={e => setMinGasto2(e.target.value)} className="h-7 text-xs" />
                    <Input type="number" placeholder="Máx" value={maxGasto2} onChange={e => setMaxGasto2(e.target.value)} className="h-7 text-xs" />
                  </div>
                </FilterRow>

                <FilterRow title="Ticket Médio (R$)" active={!!minTicket2 || !!maxTicket2} open={openRows2.has("ticketMedio")} onToggle={() => toggleRow2("ticketMedio")}>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Mín" value={minTicket2} onChange={e => setMinTicket2(e.target.value)} className="h-7 text-xs" />
                    <Input type="number" placeholder="Máx" value={maxTicket2} onChange={e => setMaxTicket2(e.target.value)} className="h-7 text-xs" />
                  </div>
                </FilterRow>

                <FilterRow title="Canais de Venda" active={selectedCanais2.length > 0} open={openRows2.has("canais")} onToggle={() => toggleRow2("canais")}>
                  <div className="space-y-1.5">
                    {CANAIS.map(c => (
                      <label key={c.value} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox checked={selectedCanais2.includes(c.value)} onCheckedChange={() => setSelectedCanais2(prev => prev.includes(c.value) ? prev.filter(x => x !== c.value) : [...prev, c.value])} />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </FilterRow>

                <FilterRow title={`Período dos Pedidos${quick2 !== "campanha" ? ` — ${periodoLabel2}` : ""}`} active={quick2 !== "campanha"} open={openRows2.has("periodo")} onToggle={() => toggleRow2("periodo")}>
                  <div className="space-y-1">
                    {(Object.entries(QUICK_LABELS) as [Exclude<QuickPeriod, "custom">, string][]).map(([k, l]) => (
                      <button key={k} onClick={() => setQuick2(k)} className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${quick2 === k ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"}`}>{l}</button>
                    ))}
                    <button onClick={() => setQuick2("custom")} className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${quick2 === "custom" ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"}`}>Personalizado</button>
                    {quick2 === "custom" && (
                      <div className="flex gap-2 pt-1">
                        <Input type="date" value={customFromStr2} onChange={e => setCustomFromStr2(e.target.value)} className="h-7 text-xs" />
                        <Input type="date" value={customToStr2} onChange={e => setCustomToStr2(e.target.value)} className="h-7 text-xs" />
                      </div>
                    )}
                  </div>
                </FilterRow>

              </div>
            </PopoverContent>
          </Popover>
        </div>,
        advancedFilterSlot2
      )}
    </div>
  );
}
