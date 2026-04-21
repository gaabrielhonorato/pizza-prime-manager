import { useState, useMemo, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  format, subDays, subWeeks, subMonths, startOfWeek, differenceInDays, parseISO, isWithinInterval, startOfDay, endOfDay
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import { CalendarIcon, ChevronDown, Filter, Users, UserPlus, Activity, TrendingUp, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import ExportButton from "@/components/gestor/ExportButton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

const COLORS = ["#6b7280", "#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

type Consumer = {
  id: string; usuario_id: string; criado_em: string;
  genero: string | null; data_nascimento: string | null; aceita_whatsapp: boolean;
  pizzaria_id: string | null; campanha_id: string | null;
};
type Usuario = { id: string; nome: string; telefone: string | null; ultimo_acesso: string | null; criado_em: string };
type Pedido = { id: string; consumidor_id: string | null; data_pedido: string; valor_total: number; pizzaria_id: string; campanha_id: string };

type DesempenhoContext = { selectedPizzaria: string; selectedCampanha: string };

export default function DesempenhoClientes() {
  const { selectedPizzaria, selectedCampanha } = useOutletContext<DesempenhoContext>();
  const navigate = useNavigate();

  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters
  const [minPedidos, setMinPedidos] = useState("");
  const [maxPedidos, setMaxPedidos] = useState("");
  const [minGasto, setMinGasto] = useState("");
  const [maxGasto, setMaxGasto] = useState("");
  const [minTicket, setMinTicket] = useState("");
  const [maxTicket, setMaxTicket] = useState("");
  const [aniversarioMes, setAniversarioMes] = useState("");
  const [generoFilter, setGeneroFilter] = useState<string[]>([]);
  const [aceitaWAFilter, setAceitaWAFilter] = useState("");

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [cRes, uRes, pRes] = await Promise.all([
        supabase.from("consumidores").select("*"),
        supabase.from("usuarios").select("id, nome, telefone, ultimo_acesso, criado_em"),
        supabase.from("pedidos").select("id, consumidor_id, data_pedido, valor_total, pizzaria_id, campanha_id").order("data_pedido", { ascending: false }).limit(5000),
      ]);
      setConsumers((cRes.data as Consumer[]) || []);
      setUsuarios((uRes.data as Usuario[]) || []);
      setPedidos((pRes.data as Pedido[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  // Build enriched consumer list
  const enrichedConsumers = useMemo(() => {
    const uMap = new Map(usuarios.map((u) => [u.id, u]));
    const now = new Date();

    return consumers.map((c) => {
      const u = uMap.get(c.usuario_id);
      let cPedidos = pedidos.filter((p) => p.consumidor_id === c.id);
      if (selectedPizzaria !== "todas") cPedidos = cPedidos.filter((p) => p.pizzaria_id === selectedPizzaria);
      if (selectedCampanha !== "todas") cPedidos = cPedidos.filter((p) => p.campanha_id === selectedCampanha);

      const totalGasto = cPedidos.reduce((s, p) => s + p.valor_total, 0);
      const totalPedidos = cPedidos.length;
      const ticket = totalPedidos > 0 ? totalGasto / totalPedidos : 0;
      const lastOrder = cPedidos.length > 0 ? cPedidos[0].data_pedido : null;
      const daysSinceLastOrder = lastOrder ? differenceInDays(now, new Date(lastOrder)) : null;

      // Purchase interval (average days between orders)
      let avgInterval = 0;
      if (cPedidos.length > 1) {
        const sorted = [...cPedidos].sort((a, b) => new Date(a.data_pedido).getTime() - new Date(b.data_pedido).getTime());
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
  }, [consumers, usuarios, pedidos, selectedPizzaria, selectedCampanha]);

  // Filter
  const filtered = useMemo(() => {
    let list = [...enrichedConsumers];
    if (minPedidos) list = list.filter((c) => c.totalPedidos >= parseInt(minPedidos));
    if (maxPedidos) list = list.filter((c) => c.totalPedidos <= parseInt(maxPedidos));
    if (minGasto) list = list.filter((c) => c.totalGasto >= parseFloat(minGasto));
    if (maxGasto) list = list.filter((c) => c.totalGasto <= parseFloat(maxGasto));
    if (minTicket) list = list.filter((c) => c.ticket >= parseFloat(minTicket));
    if (maxTicket) list = list.filter((c) => c.ticket <= parseFloat(maxTicket));
    if (aniversarioMes) {
      const m = parseInt(aniversarioMes);
      list = list.filter((c) => c.data_nascimento && new Date(c.data_nascimento).getMonth() + 1 === m);
    }
    if (generoFilter.length > 0) list = list.filter((c) => c.genero && generoFilter.includes(c.genero));
    if (aceitaWAFilter === "sim") list = list.filter((c) => c.aceita_whatsapp);
    if (aceitaWAFilter === "nao") list = list.filter((c) => !c.aceita_whatsapp);
    return list;
  }, [enrichedConsumers, minPedidos, maxPedidos, minGasto, maxGasto, minTicket, maxTicket, aniversarioMes, generoFilter, aceitaWAFilter]);

  const clearFilters = () => {
    setMinPedidos(""); setMaxPedidos(""); setMinGasto(""); setMaxGasto("");
    setMinTicket(""); setMaxTicket(""); setAniversarioMes(""); setGeneroFilter([]); setAceitaWAFilter("");
  };

  const toggleArr = (arr: string[], v: string) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // KPIs
  const now = new Date();
  const totalClientes = filtered.length;
  const novosEstaSemana = filtered.filter((c) => differenceInDays(now, new Date(c.criado_em)) <= 7).length;
  const novosEsteMes = filtered.filter((c) => {
    const d = new Date(c.criado_em);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const clientesAtivos = filtered.filter((c) => c.daysSinceLastOrder !== null && c.daysSinceLastOrder <= 30).length;

  // New clients per week (last 8 weeks)
  const weeklyNewClients = useMemo(() => {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const count = enrichedConsumers.filter((c) => {
        const d = new Date(c.criado_em);
        return d >= weekStart && d <= weekEnd;
      }).length;
      weeks.push({
        label: format(weekStart, "dd/MM", { locale: ptBR }),
        clientes: count,
      });
    }
    return weeks;
  }, [enrichedConsumers]);

  // Recurrence groups
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
    return groups.map((g) => {
      const count = enrichedConsumers.filter(g.filter).length;
      return { name: g.label, value: count, pct: (count / total) * 100 };
    });
  }, [enrichedConsumers]);

  // Birthdays per month
  const birthdayData = useMemo(() => {
    const counts = Array(12).fill(0);
    enrichedConsumers.forEach((c) => {
      if (c.data_nascimento) {
        counts[new Date(c.data_nascimento).getMonth()] += 1;
      }
    });
    return counts.map((count, i) => ({
      month: MONTHS[i].substring(0, 3),
      count,
      isCurrent: i === now.getMonth(),
    }));
  }, [enrichedConsumers]);

  // Purchase interval
  const avgGlobalInterval = useMemo(() => {
    const actives = enrichedConsumers.filter((c) => c.avgInterval > 0);
    if (actives.length === 0) return 0;
    return actives.reduce((s, c) => s + c.avgInterval, 0) / actives.length;
  }, [enrichedConsumers]);

  // Interval trend by week
  const intervalTrend = useMemo(() => {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      // Calculate average interval for consumers who made an order that week
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const consumersWithOrderThisWeek = enrichedConsumers.filter((c) =>
        pedidos.some((p) => p.consumidor_id === c.id && new Date(p.data_pedido) >= weekStart && new Date(p.data_pedido) <= weekEnd)
      );
      const avg = consumersWithOrderThisWeek.length > 0
        ? consumersWithOrderThisWeek.reduce((s, c) => s + c.avgInterval, 0) / consumersWithOrderThisWeek.length
        : 0;
      weeks.push({
        label: format(weekStart, "dd/MM", { locale: ptBR }),
        dias: Math.round(avg),
      });
    }
    return weeks;
  }, [enrichedConsumers, pedidos]);

  // Meta Ads segments
  const [metaSegmentModal, setMetaSegmentModal] = useState(false);

  const metaSegments = [
    { label: "Clientes ativos", key: "ativos", filter: (c: typeof enrichedConsumers[0]) => c.daysSinceLastOrder !== null && c.daysSinceLastOrder <= 30 },
    { label: "Clientes inativos (60+ dias)", key: "inativos-60dias", filter: (c: typeof enrichedConsumers[0]) => c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 60 },
    { label: "Clientes alto valor (ticket > R$100)", key: "alto-valor", filter: (c: typeof enrichedConsumers[0]) => c.ticket > 100 },
    { label: "Aniversariantes do mês", key: "aniversariantes-mes", filter: (c: typeof enrichedConsumers[0]) => c.data_nascimento != null && new Date(c.data_nascimento).getMonth() === now.getMonth() },
    { label: "Filtro atual aplicado", key: "filtro-atual", filter: () => true },
  ];

  const exportMetaSegment = (segKey: string) => {
    const seg = metaSegments.find(s => s.key === segKey);
    if (!seg) return;
    const source = segKey === "filtro-atual" ? filtered : enrichedConsumers.filter(seg.filter);
    const uMap = new Map(usuarios.map(u => [u.id, u]));
    const header = "phone,email,fn,ln,zip,ct,st,country";
    const rows = source.map(c => {
      const u = uMap.get(c.usuario_id);
      const parts = (c.nome || "").trim().split(/\s+/);
      const phone = (u?.telefone || "").replace(/\D/g, "");
      return [
        phone.startsWith("55") ? phone : "55" + phone,
        "", parts[0] || "", parts.slice(1).join(" ") || "",
        "", "", "", "BR",
      ].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meta-ads-${segKey}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMetaSegmentModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Export bar */}
      <div className="flex justify-end gap-2">
        <ExportButton
          data={filtered.map(c => ({
            nome: c.nome, telefone: c.telefone || "", totalPedidos: c.totalPedidos,
            totalGasto: c.totalGasto.toFixed(2), ticket: c.ticket.toFixed(2),
            ultimoPedido: c.lastOrder ? format(new Date(c.lastOrder), "dd/MM/yyyy") : "—",
            intervalo: Math.round(c.avgInterval) + " dias",
            genero: c.genero || "—", aniversario: c.data_nascimento ? format(new Date(c.data_nascimento), "dd/MM") : "—",
          }))}
          columns={[
            { key: "nome", label: "Nome" }, { key: "telefone", label: "Telefone" },
            { key: "totalPedidos", label: "Total Pedidos" }, { key: "totalGasto", label: "Total Gasto" },
            { key: "ticket", label: "Ticket Médio" }, { key: "ultimoPedido", label: "Último Pedido" },
            { key: "intervalo", label: "Intervalo Médio" }, { key: "genero", label: "Gênero" },
            { key: "aniversario", label: "Aniversário" },
          ]}
          fileName="desempenho-clientes"
          metaAds={{
            enabled: true,
            mapping: { phone: "telefone", fn: "nome" },
            getData: () => filtered.map(c => ({ telefone: c.telefone, nome: c.nome })),
          }}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Segmento Meta Ads
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {metaSegments.map(s => (
              <DropdownMenuItem key={s.key} onClick={() => setMetaSegmentModal(true)} className="text-xs">
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog open={metaSegmentModal} onOpenChange={setMetaSegmentModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Exportar segmento para Meta Ads</DialogTitle>
              <DialogDescription>
                Selecione o segmento para exportar no formato Meta Ads (Público Personalizado).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {metaSegments.map(s => (
                <Button key={s.key} variant="outline" className="w-full justify-start text-xs" onClick={() => exportMetaSegment(s.key)}>
                  {s.label}
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMetaSegmentModal(false)}>Cancelar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {/* Container 1 — Filters */}
      <Card>
        <CardContent className="pt-6">
          <Collapsible open={showFilters} onOpenChange={setShowFilters}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                <Filter className="mr-1 h-3 w-3" />
                {showFilters ? "Ocultar filtros" : "Mostrar filtros"}
                <ChevronDown className={cn("ml-1 h-3 w-3 transition-transform", showFilters && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Total de pedidos</label>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Mín" value={minPedidos} onChange={(e) => setMinPedidos(e.target.value)} className="h-8 text-xs" />
                    <Input type="number" placeholder="Máx" value={maxPedidos} onChange={(e) => setMaxPedidos(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Total gasto (R$)</label>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Mín" value={minGasto} onChange={(e) => setMinGasto(e.target.value)} className="h-8 text-xs" />
                    <Input type="number" placeholder="Máx" value={maxGasto} onChange={(e) => setMaxGasto(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Ticket médio (R$)</label>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Mín" value={minTicket} onChange={(e) => setMinTicket(e.target.value)} className="h-8 text-xs" />
                    <Input type="number" placeholder="Máx" value={maxTicket} onChange={(e) => setMaxTicket(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Próximo aniversário</label>
                  <Select value={aniversarioMes} onValueChange={setAniversarioMes}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Mês" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Gênero</label>
                  <div className="flex flex-col gap-1">
                    {[{ v: "masculino", l: "Masculino" }, { v: "feminino", l: "Feminino" }, { v: "outro", l: "Outro" }, { v: "nao_informado", l: "Não informado" }].map((g) => (
                      <label key={g.v} className="flex items-center gap-2 text-xs">
                        <Checkbox checked={generoFilter.includes(g.v)} onCheckedChange={() => setGeneroFilter(toggleArr(generoFilter, g.v))} />
                        {g.l}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Aceita WhatsApp</label>
                  <Select value={aceitaWAFilter} onValueChange={setAceitaWAFilter}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={clearFilters} className="text-xs">Limpar filtros</Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Container 2 — KPI Cards */}
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

      {/* Container 3 — New clients per week */}
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

      {/* Container 4 — Recurrence */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recorrência dos clientes</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={recurrenceGroups} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, pct }: any) => `${pct.toFixed(0)}%`}>
                    {recurrenceGroups.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {recurrenceGroups.map((g, i) => (
                <button
                  key={g.name}
                  className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                  onClick={() => {/* Could navigate to consumers with filter */}}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-sm">{g.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium">{g.value}</span>
                    <span className="text-xs text-muted-foreground ml-2">({g.pct.toFixed(1)}%)</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Container 5 — Birthdays per month */}
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
                  {birthdayData.map((d, i) => (
                    <Cell key={i} fill={d.isCurrent ? "#f97316" : "#6b7280"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Container 6 — Purchase interval */}
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
