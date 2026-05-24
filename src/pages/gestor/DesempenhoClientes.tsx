import { useState, useMemo, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { ChevronDown, Users, UserPlus, Activity, ShoppingBag, Clock, Filter, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ExportButton from "@/components/gestor/ExportButton";
import type { ReactNode } from "react";

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
};

export default function DesempenhoClientes() {
  const { selectedPizzaria, selectedCampanha, selectedConsumidor, setExportNode } =
    useOutletContext<DesempenhoContext>();
  const navigate = useNavigate();

  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Filtros de perfil
  const [minPedidos, setMinPedidos] = useState("");
  const [maxPedidos, setMaxPedidos] = useState("");
  const [minGasto, setMinGasto] = useState("");
  const [maxGasto, setMaxGasto] = useState("");
  const [minTicket, setMinTicket] = useState("");
  const [maxTicket, setMaxTicket] = useState("");
  const [aniversarioMes, setAniversarioMes] = useState("");
  const [generoFilter, setGeneroFilter] = useState<string[]>([]);
  const [aceitaWAFilter, setAceitaWAFilter] = useState("");

  // ── Filtros de período
  const [quick, setQuick] = useState<QuickPeriod>("campanha");
  const [customFromStr, setCustomFromStr] = useState("");
  const [customToStr, setCustomToStr] = useState("");

  // ── Filtros de canal e valor
  const [selectedCanais, setSelectedCanais] = useState<string[]>([]);
  const [valorOp, setValorOp] = useState<"gt" | "lt" | "between" | "">("");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");

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

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [cRes, uRes, pRes] = await Promise.all([
        supabase.from("consumidores").select("*"),
        supabase.from("usuarios").select("id, nome, telefone, ultimo_acesso, criado_em"),
        supabase.from("pedidos")
          .select("id, consumidor_id, data_pedido, valor_total, pizzaria_id, campanha_id, canal")
          .order("data_pedido", { ascending: false })
          .limit(5000),
      ]);
      setConsumers((cRes.data as Consumer[]) || []);
      setUsuarios((uRes.data as Usuario[]) || []);
      setPedidos((pRes.data as Pedido[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  // ── Lista enriquecida de consumidores
  const enrichedConsumers = useMemo(() => {
    const uMap = new Map(usuarios.map(u => [u.id, u]));
    const now = new Date();

    let list = consumers.map(c => {
      const u = uMap.get(c.usuario_id);
      let cPedidos = pedidos.filter(p => p.consumidor_id === c.id);

      // Filtros do layout
      if (selectedPizzaria !== "todas") cPedidos = cPedidos.filter(p => p.pizzaria_id === selectedPizzaria);
      if (selectedCampanha !== "todas") cPedidos = cPedidos.filter(p => p.campanha_id === selectedCampanha);

      // Filtro de período
      if (dateRange) {
        const [from, to] = dateRange;
        cPedidos = cPedidos.filter(p => {
          const t = new Date(p.data_pedido).getTime();
          return t >= from.getTime() && t <= to.getTime();
        });
      }

      // Filtro de canal
      if (selectedCanais.length > 0) {
        cPedidos = cPedidos.filter(p => selectedCanais.includes(p.canal || "outros"));
      }

      // Filtro de valor
      if (valorOp && valorMin) {
        const v1 = parseFloat(valorMin);
        const v2 = valorMax ? parseFloat(valorMax) : 0;
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
        for (let i = 1; i < sorted.length; i++) {
          totalDiff += differenceInDays(new Date(sorted[i].data_pedido), new Date(sorted[i - 1].data_pedido));
        }
        avgInterval = totalDiff / (sorted.length - 1);
      }

      return {
        ...c,
        nome: u?.nome || "—",
        telefone: u?.telefone || null,
        ultimo_acesso: u?.ultimo_acesso || null,
        totalPedidos,
        totalGasto,
        ticket,
        lastOrder,
        daysSinceLastOrder,
        avgInterval,
      };
    });

    // Filtro de consumidor individual (vem do layout)
    if (selectedConsumidor !== "todos") {
      list = list.filter(c => c.usuario_id === selectedConsumidor);
    }

    return list;
  }, [consumers, usuarios, pedidos, selectedPizzaria, selectedCampanha, selectedConsumidor, dateRange, selectedCanais, valorOp, valorMin, valorMax]);

  // ── Filtros de perfil aplicados sobre a lista enriquecida
  const filtered = useMemo(() => {
    let list = [...enrichedConsumers];
    if (minPedidos) list = list.filter(c => c.totalPedidos >= parseInt(minPedidos));
    if (maxPedidos) list = list.filter(c => c.totalPedidos <= parseInt(maxPedidos));
    if (minGasto) list = list.filter(c => c.totalGasto >= parseFloat(minGasto));
    if (maxGasto) list = list.filter(c => c.totalGasto <= parseFloat(maxGasto));
    if (minTicket) list = list.filter(c => c.ticket >= parseFloat(minTicket));
    if (maxTicket) list = list.filter(c => c.ticket <= parseFloat(maxTicket));
    if (aniversarioMes) {
      const m = parseInt(aniversarioMes);
      list = list.filter(c => c.data_nascimento && new Date(c.data_nascimento).getMonth() + 1 === m);
    }
    if (generoFilter.length > 0) list = list.filter(c => c.genero && generoFilter.includes(c.genero));
    if (aceitaWAFilter === "sim") list = list.filter(c => c.aceita_whatsapp);
    if (aceitaWAFilter === "nao") list = list.filter(c => !c.aceita_whatsapp);
    return list;
  }, [enrichedConsumers, minPedidos, maxPedidos, minGasto, maxGasto, minTicket, maxTicket, aniversarioMes, generoFilter, aceitaWAFilter]);

  const clearFilters = () => {
    setMinPedidos(""); setMaxPedidos(""); setMinGasto(""); setMaxGasto("");
    setMinTicket(""); setMaxTicket(""); setAniversarioMes(""); setGeneroFilter([]); setAceitaWAFilter("");
    setQuick("campanha"); setCustomFromStr(""); setCustomToStr("");
    setSelectedCanais([]); setValorOp(""); setValorMin(""); setValorMax("");
  };

  const toggleArr = (arr: string[], v: string) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  const hasActiveFilters =
    generoFilter.length > 0 || !!aceitaWAFilter || !!aniversarioMes ||
    !!minPedidos || !!maxPedidos || !!minGasto || !!maxGasto || !!minTicket || !!maxTicket ||
    quick !== "campanha" || selectedCanais.length > 0 || !!valorOp;

  const canaisLabel = selectedCanais.length === 0 ? "Todos" : `${selectedCanais.length} canal${selectedCanais.length > 1 ? "is" : ""}`;
  const valorLabel = !valorOp ? "Qualquer" : valorOp === "gt" ? `> R$${valorMin}` : valorOp === "lt" ? `< R$${valorMin}` : `R$${valorMin}–${valorMax}`;

  // ── Registra ExportButton na barra do layout
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

  // ── KPIs
  const now = new Date();
  const totalClientes = filtered.length;
  const novosEstaSemana = filtered.filter(c => differenceInDays(now, new Date(c.criado_em)) <= 7).length;
  const novosEsteMes = filtered.filter(c => {
    const d = new Date(c.criado_em);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const clientesAtivos = filtered.filter(c => c.daysSinceLastOrder !== null && c.daysSinceLastOrder <= 30).length;

  // ── Novos clientes por semana (últimas 8 semanas)
  const weeklyNewClients = useMemo(() => {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const count = enrichedConsumers.filter(c => {
        const d = new Date(c.criado_em);
        return d >= weekStart && d <= weekEnd;
      }).length;
      weeks.push({ label: format(weekStart, "dd/MM", { locale: ptBR }), clientes: count });
    }
    return weeks;
  }, [enrichedConsumers]);

  // ── Grupos de recorrência
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
    return groups.map(g => {
      const count = enrichedConsumers.filter(g.filter).length;
      return { name: g.label, value: count, pct: (count / total) * 100 };
    });
  }, [enrichedConsumers]);

  // ── Aniversariantes por mês
  const birthdayData = useMemo(() => {
    const counts = Array(12).fill(0);
    enrichedConsumers.forEach(c => {
      if (c.data_nascimento) counts[new Date(c.data_nascimento).getMonth()] += 1;
    });
    return counts.map((count, i) => ({
      month: MONTHS[i].substring(0, 3),
      count,
      isCurrent: i === now.getMonth(),
    }));
  }, [enrichedConsumers]);

  // ── Intervalo médio de compras
  const avgGlobalInterval = useMemo(() => {
    const actives = enrichedConsumers.filter(c => c.avgInterval > 0);
    if (actives.length === 0) return 0;
    return actives.reduce((s, c) => s + c.avgInterval, 0) / actives.length;
  }, [enrichedConsumers]);

  const intervalTrend = useMemo(() => {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const consumersWithOrder = enrichedConsumers.filter(c =>
        pedidos.some(p => p.consumidor_id === c.id && new Date(p.data_pedido) >= weekStart && new Date(p.data_pedido) <= weekEnd)
      );
      const avg = consumersWithOrder.length > 0
        ? consumersWithOrder.reduce((s, c) => s + c.avgInterval, 0) / consumersWithOrder.length
        : 0;
      weeks.push({ label: format(weekStart, "dd/MM", { locale: ptBR }), dias: Math.round(avg) });
    }
    return weeks;
  }, [enrichedConsumers, pedidos]);

  return (
    <div className="space-y-6">

      {/* ── Linha única de filtros da página ── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Perfil */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={(generoFilter.length > 0 || aceitaWAFilter || aniversarioMes) ? "default" : "outline"}
              size="sm" className="text-xs h-8 gap-1.5"
            >
              <Users className="h-3 w-3" />
              {(generoFilter.length > 0 || !!aceitaWAFilter || !!aniversarioMes)
                ? `${[generoFilter.length > 0, !!aceitaWAFilter, !!aniversarioMes].filter(Boolean).length} filtro(s)`
                : "Perfil"}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-3" align="start">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Gênero</p>
            <div className="space-y-1.5 mb-3">
              {[{ v: "masculino", l: "Masculino" }, { v: "feminino", l: "Feminino" }, { v: "outro", l: "Outro" }, { v: "nao_informado", l: "Não informado" }].map(g => (
                <label key={g.v} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox checked={generoFilter.includes(g.v)} onCheckedChange={() => setGeneroFilter(toggleArr(generoFilter, g.v))} />
                  {g.l}
                </label>
              ))}
            </div>
            <div className="h-px bg-border mb-2" />
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Aceita WhatsApp</p>
            <Select value={aceitaWAFilter || "__none__"} onValueChange={v => setAceitaWAFilter(v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-7 text-xs mb-3"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Todos</SelectItem>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
              </SelectContent>
            </Select>
            <div className="h-px bg-border mb-2" />
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Aniversário</p>
            <Select value={aniversarioMes || "__none__"} onValueChange={v => setAniversarioMes(v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Qualquer mês" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Qualquer mês</SelectItem>
                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </PopoverContent>
        </Popover>

        {/* Compras */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={(minPedidos || maxPedidos || minGasto || maxGasto || minTicket || maxTicket) ? "default" : "outline"}
              size="sm" className="text-xs h-8 gap-1.5"
            >
              <ShoppingBag className="h-3 w-3" />
              {(minPedidos || maxPedidos || minGasto || maxGasto || minTicket || maxTicket) ? "Compras filtradas" : "Compras"}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Total de pedidos</p>
            <div className="flex gap-2 mb-3">
              <Input type="number" placeholder="Mín" value={minPedidos} onChange={e => setMinPedidos(e.target.value)} className="h-7 text-xs" />
              <Input type="number" placeholder="Máx" value={maxPedidos} onChange={e => setMaxPedidos(e.target.value)} className="h-7 text-xs" />
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Total gasto (R$)</p>
            <div className="flex gap-2 mb-3">
              <Input type="number" placeholder="Mín" value={minGasto} onChange={e => setMinGasto(e.target.value)} className="h-7 text-xs" />
              <Input type="number" placeholder="Máx" value={maxGasto} onChange={e => setMaxGasto(e.target.value)} className="h-7 text-xs" />
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ticket médio (R$)</p>
            <div className="flex gap-2">
              <Input type="number" placeholder="Mín" value={minTicket} onChange={e => setMinTicket(e.target.value)} className="h-7 text-xs" />
              <Input type="number" placeholder="Máx" value={maxTicket} onChange={e => setMaxTicket(e.target.value)} className="h-7 text-xs" />
            </div>
          </PopoverContent>
        </Popover>

        {/* Período */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={quick !== "campanha" ? "default" : "outline"}
              size="sm" className="text-xs h-8 gap-1.5"
            >
              <Clock className="h-3 w-3" />
              {periodoLabel}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Período dos pedidos</p>
            <div className="space-y-1">
              {(Object.entries(QUICK_LABELS) as [Exclude<QuickPeriod, "custom">, string][]).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setQuick(k)}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${quick === k ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"}`}
                >
                  {l}
                </button>
              ))}
              <button
                onClick={() => setQuick("custom")}
                className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${quick === "custom" ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"}`}
              >
                Personalizado
              </button>
            </div>
            {quick === "custom" && (
              <div className="mt-3 space-y-2">
                <div className="h-px bg-border" />
                <div className="flex gap-2 mt-2">
                  <Input type="date" value={customFromStr} onChange={e => setCustomFromStr(e.target.value)} className="h-7 text-xs" />
                  <Input type="date" value={customToStr} onChange={e => setCustomToStr(e.target.value)} className="h-7 text-xs" />
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Canais */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={selectedCanais.length > 0 ? "default" : "outline"}
              size="sm" className="text-xs h-8 gap-1.5"
            >
              <Filter className="h-3 w-3" />
              {canaisLabel}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-3" align="start">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Canais de venda</p>
            <div className="space-y-1.5">
              {CANAIS.map(c => (
                <label key={c.value} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={selectedCanais.includes(c.value)}
                    onCheckedChange={() => setSelectedCanais(prev =>
                      prev.includes(c.value) ? prev.filter(x => x !== c.value) : [...prev, c.value]
                    )}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Valor do pedido */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={!!valorOp ? "default" : "outline"}
              size="sm" className="text-xs h-8 gap-1.5"
            >
              <DollarSign className="h-3 w-3" />
              {valorLabel}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-3" align="start">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Valor do pedido (R$)</p>
            <Select value={valorOp || "__none__"} onValueChange={v => setValorOp(v === "__none__" ? "" : v as typeof valorOp)}>
              <SelectTrigger className="h-7 text-xs mb-2"><SelectValue placeholder="Qualquer valor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Qualquer valor</SelectItem>
                <SelectItem value="gt">Maior que</SelectItem>
                <SelectItem value="lt">Menor que</SelectItem>
                <SelectItem value="between">Entre</SelectItem>
              </SelectContent>
            </Select>
            {valorOp && (
              <div className="flex gap-2 mt-1">
                <Input type="number" placeholder={valorOp === "between" ? "Mín" : "Valor"} value={valorMin} onChange={e => setValorMin(e.target.value)} className="h-7 text-xs" />
                {valorOp === "between" && (
                  <Input type="number" placeholder="Máx" value={valorMax} onChange={e => setValorMax(e.target.value)} className="h-7 text-xs" />
                )}
              </div>
            )}
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="text-xs h-8 text-muted-foreground" onClick={clearFilters}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Total de clientes</p>
            <p className="text-2xl font-bold">{totalClientes}</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10"><UserPlus className="h-5 w-5 text-primary" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Novos esta semana</p>
            <p className="text-2xl font-bold">{novosEstaSemana}</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10"><UserPlus className="h-5 w-5 text-primary" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Novos este mês</p>
            <p className="text-2xl font-bold">{novosEsteMes}</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10"><Activity className="h-5 w-5 text-primary" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Clientes ativos</p>
            <p className="text-2xl font-bold">{clientesAtivos}</p>
          </div>
        </CardContent></Card>
      </div>

      {/* ── Novos clientes por semana ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Novos clientes por semana</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[250px]">
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

      {/* ── Recorrência dos clientes ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recorrência dos clientes</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={recurrenceGroups} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, pct }: any) => `${pct.toFixed(0)}%`}>
                    {recurrenceGroups.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {recurrenceGroups.map((g, i) => (
                <div key={g.name} className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-sm">{g.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium">{g.value}</span>
                    <span className="text-xs text-muted-foreground ml-2">({g.pct.toFixed(1)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
