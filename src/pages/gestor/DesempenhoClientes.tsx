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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ExportButton from "@/components/gestor/ExportButton";
import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────
// Constantes e helpers
// ─────────────────────────────────────────────────────────────
const COLORS = ["#6b7280", "#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899"];
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
};

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────
export default function DesempenhoClientes() {
  const { selectedPizzaria, selectedCampanha, selectedConsumidor, setExportNode, advancedFilterSlot } =
    useOutletContext<DesempenhoContext>();

  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  // UI
  const [filterOpen, setFilterOpen] = useState(false);
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
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

  // ─── Fetch ─────────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [cRes, uRes, pRes] = await Promise.all([
        supabase.from("consumidores").select("*"),
        supabase.from("usuarios").select("id, nome, telefone, ultimo_acesso, criado_em"),
        supabase.from("pedidos")
          .select("id, consumidor_id, data_pedido, valor_total, pizzaria_id, campanha_id, canal")
          .order("data_pedido", { ascending: false }).limit(5000),
      ]);
      setConsumers((cRes.data as Consumer[]) || []);
      setUsuarios((uRes.data as Usuario[]) || []);
      setPedidos((pRes.data as Pedido[]) || []);
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
        totalPedidos, totalGasto, ticket, lastOrder, daysSinceLastOrder, avgInterval,
      };
    });

    if (selectedConsumidor !== "todos")
      list = list.filter(c => c.usuario_id === selectedConsumidor);

    return list;
  }, [consumers, usuarios, pedidos, selectedPizzaria, selectedCampanha, selectedConsumidor, dateRange, selectedCanais, valorOp, valorMin, valorMax]);

  // ─── filtered ──────────────────────────────────────────────
  const filtered = useMemo(() => {
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

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedFiltered = pageSize === 0 ? filtered : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
    setExportNode(
      <ExportButton
        data={filtered.map(c => ({
          nome: c.nome, telefone: c.telefone || "",
          totalPedidos: c.totalPedidos, totalGasto: c.totalGasto.toFixed(2),
          ticket: c.ticket.toFixed(2),
          ultimoPedido: c.lastOrder ? format(new Date(c.lastOrder), "dd/MM/yyyy") : "—",
          intervalo: Math.round(c.avgInterval) + " dias",
          genero: c.genero || "—",
          aniversario: c.data_nascimento ? format(new Date(c.data_nascimento), "dd/MM") : "—",
        }))}
        columns={[
          { key: "nome", label: "Nome" }, { key: "telefone", label: "Telefone" },
          { key: "totalPedidos", label: "Total Pedidos" }, { key: "totalGasto", label: "Total Gasto" },
          { key: "ticket", label: "Ticket Médio" }, { key: "ultimoPedido", label: "Último Pedido" },
          { key: "intervalo", label: "Intervalo Médio" }, { key: "genero", label: "Gênero" },
          { key: "aniversario", label: "Aniversário" },
        ]}
        fileName="desempenho-clientes"
      />
    );
    return () => setExportNode(null);
  }, [filtered, setExportNode]);

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
      weeks.push({ label: format(weekStart, "dd/MM", { locale: ptBR }), clientes: count });
    }
    return weeks;
  }, [enrichedConsumers]);

  const recurrenceGroups = useMemo(() => {
    const groups = [
      { label: "Nunca compraram", filter: (c: typeof enrichedConsumers[0]) => c.totalPedidos === 0 },
      { label: "Últimos 30 dias", filter: (c: typeof enrichedConsumers[0]) => c.daysSinceLastOrder !== null && c.daysSinceLastOrder <= 30 },
      { label: "30 a 60 dias", filter: (c: typeof enrichedConsumers[0]) => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 30 && c.daysSinceLastOrder <= 60 },
      { label: "60 a 90 dias", filter: (c: typeof enrichedConsumers[0]) => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 60 && c.daysSinceLastOrder <= 90 },
      { label: "90 a 180 dias", filter: (c: typeof enrichedConsumers[0]) => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 90 && c.daysSinceLastOrder <= 180 },
      { label: "Mais de 180 dias", filter: (c: typeof enrichedConsumers[0]) => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 180 },
    ];
    const total = enrichedConsumers.length || 1;
    return groups.map(g => { const count = enrichedConsumers.filter(g.filter).length; return { name: g.label, value: count, pct: (count / total) * 100 }; });
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
          <CardTitle className="text-base">
            Clientes
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </span>
          </CardTitle>

          {filtered.length > 0 && (
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
                    {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} de {filtered.length}
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
          {filtered.length === 0 ? (
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
          <CardHeader><CardTitle className="text-base">Novos clientes por semana</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyNewClients}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="clientes" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recorrência dos clientes */}
        <Card>
          <CardHeader><CardTitle className="text-base">Recorrência dos clientes</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="h-[260px] flex-1 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={recurrenceGroups}
                      dataKey="value"
                      nameKey="name"
                      cx="50%" cy="50%"
                      outerRadius={85}
                      label={({ pct }: any) => pct > 4 ? `${pct.toFixed(0)}%` : ""}
                      labelLine={false}
                    >
                      {recurrenceGroups.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, name: string) => [v, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 shrink-0 w-[140px]">
                {recurrenceGroups.map((g, i) => (
                  <div key={g.name} className="flex items-center justify-between py-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-[11px] leading-tight truncate">{g.name}</span>
                    </div>
                    <span className="text-[11px] font-medium ml-1 shrink-0">{g.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ── Aniversariantes por mês ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Aniversariantes por mês</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={birthdayData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {birthdayData.map((d, i) => <Cell key={i} fill={d.isCurrent ? "#f97316" : "#6b7280"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── Intervalo de compras ── */}
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
                <Line type="monotone" dataKey="dias" stroke="#f97316" strokeWidth={2} dot={{ fill: "#f97316" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

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
                  <span className="text-xs text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
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
    </div>
  );
}
