import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import { Receipt, Clock, Send, CheckCircle, Ban, Eye, CalendarDays, Download, FileSpreadsheet, FileText, BarChart2, List, SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Copy, ExternalLink, Landmark, RefreshCw, FileDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TablePagination from "@/components/gestor/TablePagination";
import CobrancaDetalheModal from "@/components/gestor/CobrancaDetalheModal";
import { C, TABLE_STYLES, loadLetteringDataUrl, buildPdfHeader, addPdfFooter, drawSectionTitle } from "@/lib/pdf-helpers";
import {
  format, addDays, startOfDay, endOfDay, subDays, subMonths, subWeeks,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type QuickPeriod = "campanha" | "hoje" | "ontem" | "esta_semana" | "semana_passada" | "este_mes" | "mes_passado" | "3m" | "6m" | "custom";
const QUICK_LABELS: Record<Exclude<QuickPeriod, "custom">, string> = {
  campanha: "Toda a campanha", hoje: "Hoje", ontem: "Ontem",
  esta_semana: "Esta semana", semana_passada: "Semana passada",
  este_mes: "Este mês", mes_passado: "Mês passado",
  "3m": "Últimos 3 meses", "6m": "Últimos 6 meses",
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
    case "3m": return [startOfDay(subMonths(now, 3)), endOfDay(now)];
    case "6m": return [startOfDay(subMonths(now, 6)), endOfDay(now)];
  }
}

interface ContextType { selectedCampanha: string; filterSlot: HTMLDivElement | null; exportSlot: HTMLDivElement | null; }

const statusBadge = (s: string) => {
  const map: Record<string, { cls: string; label: string }> = {
    pendente: { cls: "bg-muted text-muted-foreground", label: "Aguardando boleto" },
    agendado: { cls: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Agendado" },
    enviado: { cls: "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 border-amber-500 dark:border-amber-500/30", label: "Boleto emitido" },
    pago: { cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Pago" },
    cancelado: { cls: "bg-destructive/20 text-destructive", label: "Cancelado" },
  };
  const m = map[s] || map.pendente;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
};

const statusLabel = (s: string) => ({ pendente: "Aguardando boleto", agendado: "Agendado", enviado: "Boleto emitido", pago: "Pago", cancelado: "Cancelado" }[s] ?? s);

const modalidadeBadge = (m: "boleto" | "split") =>
  m === "split"
    ? <Badge variant="outline" className="bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30">Split</Badge>
    : <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">Boleto</Badge>;

export default function FinanceiroCobrancas() {
  const { selectedCampanha, filterSlot, exportSlot } = useOutletContext<ContextType>();
  const [pizzarias, setPizzarias] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [campanha, setCampanha] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [genModal, setGenModal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulkGenConfirm, setBulkGenConfirm] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [payModal, setPayModal] = useState<string | null>(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payObs, setPayObs] = useState("");
  const [detailDrawer, setDetailDrawer] = useState<any>(null);

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [cancelId, setCancelId] = useState<string | null>(null);
  const cobrancasTableRef = useRef<HTMLDivElement>(null);
  const [searchSaldo, setSearchSaldo] = useState("");
  const [genPeriodStart, setGenPeriodStart] = useState("");
  const [genPeriodEnd, setGenPeriodEnd] = useState("");

  // Retorna a segunda-feira da semana de uma data ISO
  const getMondayOf = (isoDate: string) => {
    const d = new Date(isoDate.slice(0, 10) + "T12:00:00");
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return d.toISOString().slice(0, 10);
  };

  // Navegação semanal — padrão: semana atual (cobranças agrupadas por quando foram criadas)
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(() => getMondayOf(new Date().toISOString()));

  const selectedWeekEnd = useMemo(() => {
    const d = new Date(selectedWeekStart + "T12:00:00");
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  }, [selectedWeekStart]);

  // Limite inferior: segunda-feira da semana de início da campanha
  const firstAvailableWeek = useMemo(() => {
    if (campanha?.data_inicio) return getMondayOf(campanha.data_inicio as string);
    return getMondayOf(new Date(new Date().getFullYear(), 0, 1).toISOString());
  }, [campanha]);

  // Limite superior: segunda-feira desta semana
  const lastAvailableWeek = useMemo(() => getMondayOf(new Date().toISOString()), []);

  const atFirstWeek = selectedWeekStart <= firstAvailableWeek;
  const atLastWeek  = selectedWeekStart >= lastAvailableWeek;

  const goToPrevWeek = () => {
    if (atFirstWeek) return;
    const d = new Date(selectedWeekStart + "T12:00:00");
    d.setDate(d.getDate() - 7);
    const next = d.toISOString().slice(0, 10);
    setSelectedWeekStart(next < firstAvailableWeek ? firstAvailableWeek : next);
    setCurrentPage(1);
  };
  const goToNextWeek = () => {
    if (atLastWeek) return;
    const d = new Date(selectedWeekStart + "T12:00:00");
    d.setDate(d.getDate() + 7);
    const next = d.toISOString().slice(0, 10);
    setSelectedWeekStart(next > lastAvailableWeek ? lastAvailableWeek : next);
    setCurrentPage(1);
  };
  const goToFirstWeek = () => {
    setSelectedWeekStart(firstAvailableWeek);
    setCurrentPage(1);
  };
  const goToLatestWeek = () => {
    const weeks = cobrancas.map((c: any) => getMondayOf(c.criado_em as string)).filter(Boolean).sort();
    const newest = weeks[weeks.length - 1];
    if (newest) { setSelectedWeekStart(newest); setCurrentPage(1); }
  };

  // Filtros básicos
  const [filterPizzaria, setFilterPizzaria] = useState("todas");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterModalidade, setFilterModalidade] = useState<"todos" | "boleto" | "split">("todos");

  // Modo de período: semanal | mensal | todos
  const [periodoMode, setPeriodoMode] = useState<"semanal" | "mensal" | "todos">("semanal");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const goToPrevMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setCurrentPage(1);
  };
  const goToNextMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setCurrentPage(1);
  };
  const atLastMonth = selectedMonth >= new Date().toISOString().slice(0, 7);

  // Filtro avançado — período
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [quick, setQuick] = useState<QuickPeriod>("campanha");
  const [dateFrom, setDateFrom] = useState<Date>(() => startOfDay(subDays(new Date(), 29)));
  const [dateTo, setDateTo] = useState<Date>(() => endOfDay(new Date()));
  const [customFromStr, setCustomFromStr] = useState("");
  const [customToStr, setCustomToStr] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ periodo: false });
  const toggleSection = (k: string) => setOpenSections(s => ({ ...s, [k]: !s[k] }));

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    let campId = selectedCampanha;
    if (campId === "todas") {
      const { data: cp } = await supabase.from("campanhas").select("*").eq("is_principal", true).limit(1).single();
      campId = cp?.id ?? "";
      setCampanha(cp);
    } else {
      const { data: cp } = await supabase.from("campanhas").select("*").eq("id", campId).single();
      setCampanha(cp);
    }
    let cQ = supabase.from("cobrancas_repasse").select("*");
    if (selectedCampanha !== "todas") cQ = cQ.eq("campanha_id", selectedCampanha);
    const [{ data: pz }, { data: pedRaw }, { data: c }, { data: consRaw }] = await Promise.all([
      supabase.from("pizzarias").select("id, nome, cnpj, modalidade_cobranca"),
      supabase.rpc("rpc_pedidos_todos_full"),
      cQ.order("criado_em", { ascending: false }),
      supabase.rpc("rpc_consumidores_lista"),
    ]);
    const validIds = new Set((consRaw ?? []).filter((c: any) => c.usuarios?.nome && c.usuarios?.telefone).map((c: any) => c.id));
    let peds = (pedRaw ?? []).filter((p: any) => p.status === "entregue" && validIds.has(p.consumidor_id));
    if (selectedCampanha !== "todas") peds = peds.filter((p: any) => p.campanha_id === selectedCampanha);
    setPizzarias(pz ?? []);
    setPedidos(peds);
    setCobrancas(c ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [selectedCampanha]);

  // Snap para a semana mais recente com cobranças quando carregam pela 1ª vez
  const weekSnapDone = useRef(false);
  useEffect(() => {
    if (!cobrancas.length || weekSnapDone.current) return;
    weekSnapDone.current = true;
    const weeks = cobrancas
      .map((c: any) => getMondayOf(c.criado_em as string))
      .filter(Boolean)
      .sort();
    const mostRecent = weeks[weeks.length - 1];
    if (mostRecent && mostRecent !== selectedWeekStart) setSelectedWeekStart(mostRecent);
  }, [cobrancas]);

  // Reset snap ao trocar campanha
  useEffect(() => { weekSnapDone.current = false; }, [selectedCampanha]);

  // Mantém detailDrawer sincronizado quando cobrancas é recarregado
  useEffect(() => {
    if (!detailDrawer) return;
    const fresh = cobrancas.find((c: any) => c.id === detailDrawer.id);
    if (fresh) setDetailDrawer(fresh);
  }, [cobrancas]);


  const taxaDel = campanha?.taxa_delivery ?? 15;
  const taxaRet = campanha?.taxa_retirada ?? 15;
  const taxaLoc = campanha?.taxa_local ?? 12;

  const getTaxa = (tipo: string | null) => {
    if (tipo === "retirada") return taxaRet;
    if (tipo === "local") return taxaLoc;
    return taxaDel;
  };

  const coberedPedidoIds = useMemo(() => {
    const ids = new Set<string>();
    cobrancas.filter(c => c.status !== "cancelado").forEach(c => {
      const snap = c.pedidos_snapshot as string[];
      if (Array.isArray(snap)) snap.forEach(id => ids.add(id));
    });
    return ids;
  }, [cobrancas]);

  const pizzariaSaldos = useMemo(() => {
    return pizzarias.map(pz => {
      let pzPedidos = pedidos.filter(p => p.pizzaria_id === pz.id && !coberedPedidoIds.has(p.id));
      if (periodoMode === "semanal") {
        pzPedidos = pzPedidos.filter(p => {
          const d = (p.data_pedido as string).slice(0, 10);
          return d >= selectedWeekStart && d <= selectedWeekEnd;
        });
      }
      const delivery = pzPedidos.filter(p => !p.tipo_pedido || p.tipo_pedido === "delivery");
      const retirada = pzPedidos.filter(p => p.tipo_pedido === "retirada");
      const local = pzPedidos.filter(p => p.tipo_pedido === "local");
      const totalDel = delivery.reduce((s, p) => s + Number(p.valor_total), 0);
      const totalRet = retirada.reduce((s, p) => s + Number(p.valor_total), 0);
      const totalLoc = local.reduce((s, p) => s + Number(p.valor_total), 0);
      const ppDel = totalDel * taxaDel / 100;
      const ppRet = totalRet * taxaRet / 100;
      const ppLoc = totalLoc * taxaLoc / 100;
      const autoSplit = pzPedidos.filter(p => p.canal === "cardapioweb").reduce((s, p) => s + Number(p.valor_total) * getTaxa(p.tipo_pedido) / 100, 0);
      const totalPP = ppDel + ppRet + ppLoc;
      const lastPedido = pzPedidos.sort((a, b) => new Date(b.data_pedido).getTime() - new Date(a.data_pedido).getTime())[0];
      const lastCobranca = cobrancas.filter(c => c.pizzaria_id === pz.id).sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())[0];
      return {
        ...pz, pendingPedidos: pzPedidos, saldo: totalPP - autoSplit,
        delivery, retirada, local,
        totalDel, totalRet, totalLoc, ppDel, ppRet, ppLoc, autoSplit, totalPP,
        lastPedido: lastPedido?.data_pedido ?? null,
        lastCobranca: lastCobranca?.criado_em ?? null,
      };
    }).filter(pz => pz.pendingPedidos.length > 0 && ((pz as any).modalidade_cobranca ?? "boleto") === "boleto");
  }, [pizzarias, pedidos, coberedPedidoIds, taxaDel, taxaRet, taxaLoc, periodoMode, selectedWeekStart, selectedWeekEnd]);

  // Saldos filtrados por busca de nome
  const filteredSaldos = useMemo(() => {
    if (!searchSaldo.trim()) return pizzariaSaldos;
    const q = searchSaldo.toLowerCase();
    return pizzariaSaldos.filter((pz: any) => pz.nome.toLowerCase().includes(q));
  }, [pizzariaSaldos, searchSaldo]);

  // Pedidos pendentes da pizzaria selecionada para o modal de geração (sem filtro de semana)
  const genPzAllPending = useMemo(() => {
    if (!genModal) return [];
    return pedidos.filter(p => p.pizzaria_id === genModal && !coberedPedidoIds.has(p.id));
  }, [genModal, pedidos, coberedPedidoIds]);

  // Pedidos do modal filtrados pelo período personalizado
  const genPeriodPedidos = useMemo(() => {
    if (!genPeriodStart || !genPeriodEnd) return genPzAllPending;
    return genPzAllPending.filter(p => {
      const d = (p.data_pedido as string).slice(0, 10);
      return d >= genPeriodStart && d <= genPeriodEnd;
    });
  }, [genPzAllPending, genPeriodStart, genPeriodEnd]);

  // Stats calculados para o modal de geração baseado no escopo selecionado
  const genPeriodStats = useMemo(() => {
    const delivery = genPeriodPedidos.filter((p: any) => !p.tipo_pedido || p.tipo_pedido === "delivery");
    const retirada = genPeriodPedidos.filter((p: any) => p.tipo_pedido === "retirada");
    const local    = genPeriodPedidos.filter((p: any) => p.tipo_pedido === "local");
    const totalDel = delivery.reduce((s: number, p: any) => s + Number(p.valor_total), 0);
    const totalRet = retirada.reduce((s: number, p: any) => s + Number(p.valor_total), 0);
    const totalLoc = local.reduce((s: number, p: any)    => s + Number(p.valor_total), 0);
    const ppDel = totalDel * taxaDel / 100;
    const ppRet = totalRet * taxaRet / 100;
    const ppLoc = totalLoc * taxaLoc / 100;
    const autoSplit = genPeriodPedidos.filter((p: any) => p.canal === "cardapioweb").reduce((s: number, p: any) => s + Number(p.valor_total) * getTaxa(p.tipo_pedido) / 100, 0);
    const totalPP = ppDel + ppRet + ppLoc;
    return { totalDel, totalRet, totalLoc, ppDel, ppRet, ppLoc, autoSplit, totalPP, saldo: totalPP - autoSplit };
  }, [genPeriodPedidos, taxaDel, taxaRet, taxaLoc]);

  const periodCobrancas = useMemo(() => {
    if (periodoMode === "semanal") {
      // Filtra por sobreposição de período (não por data de criação)
      return cobrancas.filter(c => {
        const pi = (c.periodo_inicio as string) ?? (c.criado_em as string).slice(0, 10);
        const pf = (c.periodo_fim as string) ?? pi;
        return pi <= selectedWeekEnd && pf >= selectedWeekStart;
      });
    }
    if (periodoMode === "mensal") {
      return cobrancas.filter(c => {
        const pi = (c.periodo_inicio as string) ?? "";
        return pi.slice(0, 7) === selectedMonth;
      });
    }
    return [...cobrancas];
  }, [cobrancas, periodoMode, selectedWeekStart, selectedWeekEnd, selectedMonth]);

  const stats = useMemo(() => {
    const active = periodCobrancas.filter(c => c.status !== "cancelado");
    const pendente = active.filter(c => c.status === "pendente").reduce((s, c) => s + Number(c.valor_total_devido), 0);
    const agendado = active.filter(c => c.status === "agendado").reduce((s, c) => s + Number(c.valor_total_devido), 0);
    const enviado  = active.filter(c => c.status === "enviado").reduce((s, c) => s + Number(c.valor_total_devido), 0);
    const pago     = active.filter(c => c.status === "pago").reduce((s, c) => s + Number(c.valor_total_devido), 0);
    const autoSplit = active.reduce((s, c) => s + Number(c.valor_automatico_pp ?? 0), 0);
    return { pendente, agendado, enviado, pago, autoSplit };
  }, [periodCobrancas]);

  // Pedidos entregues que nunca entraram em nenhuma cobrança (acumulado geral)
  const semCobrancaTotal = useMemo(() =>
    pedidos
      .filter(p => !coberedPedidoIds.has(p.id))
      .reduce((s, p) => s + Number(p.valor_total) * getTaxa(p.tipo_pedido) / 100, 0),
    [pedidos, coberedPedidoIds, taxaDel, taxaRet, taxaLoc],
  );
  const semCobrancaCount = useMemo(() =>
    pedidos.filter(p => !coberedPedidoIds.has(p.id)).length,
    [pedidos, coberedPedidoIds],
  );

  const filteredCobrancas = useMemo(() => {
    let list = periodCobrancas;
    if (filterPizzaria !== "todas") list = list.filter(c => c.pizzaria_id === filterPizzaria);
    if (filterStatus !== "todos") list = list.filter(c => c.status === filterStatus);
    if (filterModalidade !== "todos") {
      list = list.filter(c => {
        const pz = pizzarias.find(p => p.id === c.pizzaria_id) as any;
        return (pz?.modalidade_cobranca ?? "boleto") === filterModalidade;
      });
    }
    return list;
  }, [periodCobrancas, filterPizzaria, filterStatus, filterModalidade, pizzarias]);

  const hasActiveFilters = quick !== "campanha";
  const activeFilterCount = [quick !== "campanha"].filter(Boolean).length;
  const clearFilters = () => { setQuick("campanha"); setCustomFromStr(""); setCustomToStr(""); };

  const pagedCobrancas = pageSize === 0 ? filteredCobrancas : filteredCobrancas.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const genPz = genModal ? pizzarias.find((p: any) => p.id === genModal) : null;

  const openGenModal = (pzId: string) => {
    setGenModal(pzId);
    if (periodoMode === "semanal") {
      setGenPeriodStart(selectedWeekStart);
      setGenPeriodEnd(selectedWeekEnd);
    } else {
      const allPending = pedidos.filter(p => p.pizzaria_id === pzId && !coberedPedidoIds.has(p.id));
      if (allPending.length > 0) {
        const earliest = allPending.reduce((min: string, p: any) => p.data_pedido < min ? p.data_pedido : min, allPending[0].data_pedido).slice(0, 10);
        setGenPeriodStart(earliest);
      } else {
        setGenPeriodStart(new Date().toISOString().slice(0, 10));
      }
      setGenPeriodEnd(new Date().toISOString().slice(0, 10));
    }
  };

  const buildCobrancaPayloadFromScope = () => {
    if (!genPz || !campanha || genPeriodPedidos.length === 0) return null;
    return {
      pizzaria_id: genPz.id,
      campanha_id: campanha.id,
      periodo_inicio: genPeriodStart,
      periodo_fim: genPeriodEnd,
      total_vendas_automatico: genPeriodPedidos.filter((p: any) => p.canal === "cardapioweb").reduce((s: number, p: any) => s + Number(p.valor_total), 0),
      total_vendas_manual: genPeriodPedidos.filter((p: any) => p.canal !== "cardapioweb").reduce((s: number, p: any) => s + Number(p.valor_total), 0),
      total_delivery: genPeriodStats.totalDel,
      total_retirada: genPeriodStats.totalRet,
      total_local: genPeriodStats.totalLoc,
      taxa_delivery_aplicada: taxaDel,
      taxa_retirada_aplicada: taxaRet,
      taxa_local_aplicada: taxaLoc,
      valor_automatico_pp: genPeriodStats.autoSplit,
      valor_manual_devido: genPeriodStats.totalPP - genPeriodStats.autoSplit,
      valor_total_devido: genPeriodStats.totalPP - genPeriodStats.autoSplit,
      data_agendada: null,
      status: "pendente",
      data_envio: null,
      pedidos_snapshot: genPeriodPedidos.map((p: any) => p.id),
    };
  };

  const buildCobrancaPayload = (pz: any) => {
    const periodoInicio = pz.pendingPedidos.reduce((min: string, p: any) => p.data_pedido < min ? p.data_pedido : min, pz.pendingPedidos[0].data_pedido).slice(0, 10);
    const periodoFim = periodoMode === "semanal" ? selectedWeekEnd : new Date().toISOString().slice(0, 10);
    return {
      pizzaria_id: pz.id, campanha_id: campanha!.id, periodo_inicio: periodoInicio, periodo_fim: periodoFim,
      total_vendas_automatico: pz.pendingPedidos.filter((p: any) => p.canal === "cardapioweb").reduce((s: number, p: any) => s + Number(p.valor_total), 0),
      total_vendas_manual: pz.pendingPedidos.filter((p: any) => p.canal !== "cardapioweb").reduce((s: number, p: any) => s + Number(p.valor_total), 0),
      total_delivery: pz.totalDel, total_retirada: pz.totalRet, total_local: pz.totalLoc,
      taxa_delivery_aplicada: taxaDel, taxa_retirada_aplicada: taxaRet, taxa_local_aplicada: taxaLoc,
      valor_automatico_pp: pz.autoSplit, valor_manual_devido: pz.totalPP - pz.autoSplit,
      valor_total_devido: pz.totalPP - pz.autoSplit,
      data_agendada: null, status: "pendente", data_envio: null,
      pedidos_snapshot: pz.pendingPedidos.map((p: any) => p.id),
    };
  };

  const handleGenerate = async () => {
    const payload = buildCobrancaPayloadFromScope();
    if (!payload) return;
    setSaving(true);
    const { error } = await supabase.from("cobrancas_repasse").insert(payload);
    if (error) { toast.error(`Erro ao gerar cobrança: ${error.message}`); setSaving(false); return; }
    toast.success("Cobrança gerada! Use 'Emitir boleto' no detalhe para enviar.");
    setSaving(false);
    setGenModal(null);
    await fetchAll(true);
  };

  const handleBulkGenerate = async () => {
    if (!campanha || !pizzariaSaldos.length) return;
    setBulkGenerating(true);
    let ok = 0, errs = 0;
    for (const pz of pizzariaSaldos) {
      const { error } = await supabase.from("cobrancas_repasse").insert(buildCobrancaPayload(pz));
      if (error) errs++; else ok++;
    }
    setBulkGenerating(false);
    setBulkGenConfirm(false);
    if (errs > 0) toast.error(`${ok} geradas, ${errs} com erro.`);
    else toast.success(`${ok} cobrança${ok !== 1 ? "s" : ""} gerada${ok !== 1 ? "s" : ""}! Abra cada uma para emitir o boleto.`);
    await fetchAll(true);
  };

  const markPaid = async () => {
    if (!payModal) return;
    const { error } = await supabase.from("cobrancas_repasse").update({ status: "pago", data_pagamento: payDate, observacao: payObs || null }).eq("id", payModal);
    if (error) { toast.error(`Erro ao marcar como pago: ${error.message}`); return; }
    toast.success("Cobrança marcada como paga!"); setPayModal(null); fetchAll(true);
  };

  const sendNow = async (id: string) => {
    const { error } = await supabase.from("cobrancas_repasse").update({ status: "enviado", data_envio: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(`Erro ao enviar: ${error.message}`); return; }
    toast.success("Cobrança marcada como enviada!"); fetchAll(true);
  };

  const pzCnpj = (id: string) => pizzarias.find(p => p.id === id)?.cnpj ?? null;
  const pzModalidade = (id: string): "boleto" | "split" => (pizzarias.find(p => p.id === id) as any)?.modalidade_cobranca ?? "boleto";

  const cancelCobranca = async (id: string) => {
    const { error } = await supabase.from("cobrancas_repasse").update({ status: "cancelado" }).eq("id", id);
    if (error) { toast.error(`Erro ao cancelar: ${error.message}`); return; }
    toast.success("Cobrança cancelada. Pedidos liberados para próxima cobrança."); fetchAll(true);
  };

  const pzName = (id: string) => pizzarias.find(p => p.id === id)?.nome ?? "—";
  const today = format(new Date(), "yyyy-MM-dd");

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const header = ["Pizzaria", "Período", "Pedidos", "Valor Devido", "Agendado para", "Status"];
    const rows = filteredCobrancas.map(c => [pzName(c.pizzaria_id), `${c.periodo_inicio} a ${c.periodo_fim}`, Array.isArray(c.pedidos_snapshot) ? c.pedidos_snapshot.length : 0, fmt(Number(c.valor_total_devido)), c.data_agendada ? format(new Date(c.data_agendada), "dd/MM/yyyy") : "—", statusLabel(c.status)]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = header.map((h, i) => ({ wch: Math.min(Math.max(h.length, ...rows.map(r => String(r[i]).length)) + 2, 50) }));
    XLSX.utils.book_append_sheet(wb, ws, "Cobranças");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/octet-stream" }));
    const a = document.createElement("a"); a.href = url; a.download = `financeiro-cobrancas-${today}.xlsx`; a.click(); URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const header = ["Pizzaria", "Período", "Pedidos", "Valor Devido", "Status"].join(",");
    const rows = filteredCobrancas.map(c => [pzName(c.pizzaria_id), `${c.periodo_inicio} a ${c.periodo_fim}`, Array.isArray(c.pedidos_snapshot) ? c.pedidos_snapshot.length : 0, fmt(Number(c.valor_total_devido)), statusLabel(c.status)].map(v => typeof v === "string" && v.includes(",") ? `"${v}"` : v).join(","));
    const csv = [header, ...rows].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `financeiro-cobrancas-${today}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportSinteticoPDF = async () => {
    const lettering = await loadLetteringDataUrl();
    const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
    let y = buildPdfHeader(doc, "Cobranças", "Relatório Sintético", [], lettering);
    y = drawSectionTitle(doc, "KPIs por Status", y);
    autoTable(doc, { ...TABLE_STYLES, head: [["Status", "Qtd.", "Total"]], body: [["Pendente", cobrancas.filter(c => c.status === "pendente").length, fmt(stats.pendente)], ["Agendado", cobrancas.filter(c => c.status === "agendado").length, fmt(stats.agendado)], ["Enviado", cobrancas.filter(c => c.status === "enviado").length, fmt(stats.enviado)], ["Pago", cobrancas.filter(c => c.status === "pago").length, fmt(stats.pago)]], startY: y, tableWidth: 300 });
    addPdfFooter(doc, "Cobranças — Sintético");
    doc.save(`financeiro-cobrancas-sintetico-${today}.pdf`);
  };

  const exportAnaliticoPDF = async () => {
    const lettering = await loadLetteringDataUrl();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
    let y = buildPdfHeader(doc, "Cobranças", "Relatório Analítico — Todas as Cobranças", [], lettering);
    autoTable(doc, { ...TABLE_STYLES, head: [["Pizzaria", "Período", "Pedidos", "Valor Devido", "Agendado para", "Enviado em", "Status"]], body: filteredCobrancas.map(c => [pzName(c.pizzaria_id), `${c.periodo_inicio} a ${c.periodo_fim}`, Array.isArray(c.pedidos_snapshot) ? c.pedidos_snapshot.length : 0, fmt(Number(c.valor_total_devido)), c.data_agendada ? format(new Date(c.data_agendada), "dd/MM/yyyy") : "—", c.data_envio ? format(new Date(c.data_envio), "dd/MM/yyyy") : "—", statusLabel(c.status)]), startY: y });
    addPdfFooter(doc, "Cobranças — Analítico");
    doc.save(`financeiro-cobrancas-analitico-${today}.pdf`);
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      {filterSlot && createPortal(<></>, filterSlot)}
      {exportSlot && createPortal(<></>, exportSlot)}

      {/* ── Navegação de período ── */}
      <div className="flex flex-col gap-2 bg-card rounded-xl px-3 py-3 border border-border">
        {/* Seletor de modo */}
        <div className="flex items-center justify-center gap-1">
          {(["semanal", "mensal", "todos"] as const).map(m => (
            <Button key={m} variant={periodoMode === m ? "default" : "ghost"} size="sm" className="text-xs h-7 px-3"
              onClick={() => { setPeriodoMode(m); setCurrentPage(1); }}>
              {m === "semanal" ? "Semanal" : m === "mensal" ? "Mensal" : "Todo o período"}
            </Button>
          ))}
        </div>

        {/* Navegação semanal */}
        {periodoMode === "semanal" && (
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="gap-1 px-2" onClick={goToFirstWeek} title="Primeira semana" disabled={atFirstWeek}>
                <ChevronsLeft className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Primeira</span>
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5 px-2" onClick={goToPrevWeek} title="Semana anterior" disabled={atFirstWeek}>
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Anterior</span>
              </Button>
            </div>
            <div className="text-center flex-1">
              <p className="text-sm font-semibold font-heading">
                Semana de {format(new Date(selectedWeekStart + "T12:00:00"), "dd/MM", { locale: ptBR })} a {format(new Date(selectedWeekEnd + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {periodCobrancas.length} cobrança{periodCobrancas.length !== 1 ? "s" : ""} •{" "}
                {fmt(periodCobrancas.reduce((s, c) => s + Number(c.valor_total_devido), 0))}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="gap-1.5 px-2" onClick={goToNextWeek} title="Próxima semana" disabled={atLastWeek}>
                <span className="hidden sm:inline text-xs">Próxima</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="gap-1 px-2" onClick={goToLatestWeek} title="Semana mais recente" disabled={atLastWeek}>
                <span className="hidden sm:inline text-xs">Atual</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Navegação mensal */}
        {periodoMode === "mensal" && (
          <div className="flex items-center justify-between gap-1">
            <Button variant="ghost" size="sm" className="gap-1.5 px-2" onClick={goToPrevMonth}>
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Anterior</span>
            </Button>
            <div className="text-center flex-1">
              <p className="text-sm font-semibold font-heading capitalize">
                {format(new Date(selectedMonth + "-01T12:00:00"), "MMMM yyyy", { locale: ptBR })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {periodCobrancas.length} cobrança{periodCobrancas.length !== 1 ? "s" : ""} •{" "}
                {fmt(periodCobrancas.reduce((s, c) => s + Number(c.valor_total_devido), 0))}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 px-2" onClick={goToNextMonth} disabled={atLastMonth}>
              <span className="hidden sm:inline text-xs">Próximo</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Todo o período */}
        {periodoMode === "todos" && (
          <div className="text-center py-0.5">
            <p className="text-sm font-semibold font-heading">Todo o período</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {periodCobrancas.length} cobrança{periodCobrancas.length !== 1 ? "s" : ""} •{" "}
              {fmt(periodCobrancas.reduce((s, c) => s + Number(c.valor_total_devido), 0))}
            </p>
          </div>
        )}
      </div>

      {/* ── KPI cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card"><CardHeader className="flex flex-row items-center gap-2 pb-2"><Clock className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-sm text-muted-foreground">Total pendente</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold">{fmt(stats.pendente)}</p></CardContent></Card>
        <Card className="border-border bg-card"><CardHeader className="flex flex-row items-center gap-2 pb-2"><CalendarDays className="h-5 w-5 text-blue-400" /><CardTitle className="text-sm text-muted-foreground">Total agendado</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold text-blue-400">{fmt(stats.agendado)}</p></CardContent></Card>
        <Card className="border-border bg-card"><CardHeader className="flex flex-row items-center gap-2 pb-2"><Send className="h-5 w-5 text-amber-400" /><CardTitle className="text-sm text-muted-foreground">Aguardando pgto</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold text-amber-400">{fmt(stats.enviado)}</p></CardContent></Card>
        <Card className="border-border bg-card"><CardHeader className="flex flex-row items-center gap-2 pb-2"><CheckCircle className="h-5 w-5 text-emerald-400" /><CardTitle className="text-sm text-muted-foreground">Pago no ciclo</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold text-emerald-400">{fmt(stats.pago)}</p></CardContent></Card>
      </div>

      {/* ── Saldos a cobrar por pizzaria ── */}
      {pizzariaSaldos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold font-heading text-muted-foreground uppercase tracking-wide">
              Saldos a cobrar{periodoMode === "semanal" ? " esta semana" : ""} — {pizzariaSaldos.length} pizzaria{pizzariaSaldos.length !== 1 ? "s" : ""}
            </h3>
            <Button
              variant="outline" size="sm" className="gap-1.5 text-xs h-7 shrink-0"
              disabled={pizzariaSaldos.length === 0}
              onClick={() => setBulkGenConfirm(true)}
            >
              <Receipt className="h-3 w-3" />
              Gerar todas ({pizzariaSaldos.length})
            </Button>
          </div>
          <Card className="border-border bg-card">
            <CardContent className="p-0">
              {/* Barra de busca */}
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar pizzaria por nome..."
                    value={searchSaldo}
                    onChange={e => setSearchSaldo(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring pl-3"
                  />
                </div>
              </div>
              {/* Lista */}
              <Table>
                <TableHeader>
                  <TableRow className="text-[11px]">
                    <TableHead className="py-2">Pizzaria</TableHead>
                    <TableHead className="text-right py-2">Pedidos</TableHead>
                    <TableHead className="text-right py-2">🛵 Del.</TableHead>
                    <TableHead className="text-right py-2">🏪 Ret.</TableHead>
                    <TableHead className="text-right py-2">🍽️ Salão</TableHead>
                    <TableHead className="text-right py-2">Saldo PP</TableHead>
                    <TableHead className="py-2">Último pedido</TableHead>
                    <TableHead className="text-right py-2"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSaldos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6 text-sm text-muted-foreground">
                        {searchSaldo ? "Nenhuma pizzaria encontrada para essa busca." : "Nenhum saldo pendente."}
                      </TableCell>
                    </TableRow>
                  ) : filteredSaldos.map((pz: any) => {
                    const lastPedidoDate = pz.lastPedido
                      ? format(new Date(pz.lastPedido.slice(0, 10) + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })
                      : "—";
                    return (
                      <TableRow key={pz.id} className="text-xs hover:bg-muted/40">
                        <TableCell className="py-2">
                          <p className="font-medium text-sm">{pz.nome}</p>
                          {pz.cidade && <p className="text-[10px] text-muted-foreground">{pz.cidade}</p>}
                        </TableCell>
                        <TableCell className="text-right py-2 tabular-nums">{pz.pendingPedidos.length}</TableCell>
                        <TableCell className="text-right py-2">
                          <span className="tabular-nums font-medium">{pz.delivery.length}</span>
                          {pz.ppDel > 0 && <p className="text-[10px] text-primary tabular-nums">{fmt(pz.ppDel)}</p>}
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <span className="tabular-nums font-medium">{pz.retirada.length}</span>
                          {pz.ppRet > 0 && <p className="text-[10px] text-primary tabular-nums">{fmt(pz.ppRet)}</p>}
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <span className="tabular-nums font-medium">{pz.local.length}</span>
                          {pz.ppLoc > 0 && <p className="text-[10px] text-primary tabular-nums">{fmt(pz.ppLoc)}</p>}
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <span className="font-bold text-primary tabular-nums">{fmt(pz.saldo)}</span>
                        </TableCell>
                        <TableCell className="py-2 text-muted-foreground">{lastPedidoDate}</TableCell>
                        <TableCell className="text-right py-2">
                          <Button size="sm" className="gap-1 h-6 text-[11px] px-2" onClick={() => openGenModal(pz.id)}>
                            <Receipt className="h-3 w-3" />
                            Gerar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Reconciliação com faturamento PP ── */}
      {(() => {
        const boletoGerado = stats.pendente + stats.agendado + stats.enviado + stats.pago;
        const totalPP = boletoGerado + stats.autoSplit + (periodoMode === "todos" ? semCobrancaTotal : 0);
        const isTodos = periodoMode === "todos";
        return (
          <Card className="border-border bg-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Reconciliação — Faturamento PP {!isTodos && <span className="normal-case font-normal">(parcial do período)</span>}
                </p>
                <p className="text-sm font-bold font-heading">{fmt(totalPP)}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {/* Boleto gerado */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-7 w-7 rounded-full bg-foreground/10 flex items-center justify-center shrink-0">
                    <Receipt className="h-3.5 w-3.5 text-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Boleto gerado</p>
                    <p className="text-base font-bold font-heading">{fmt(boletoGerado)}</p>
                    <p className="text-xs text-muted-foreground">{periodCobrancas.filter(c => c.status !== "cancelado").length} cobrança{periodCobrancas.filter(c => c.status !== "cancelado").length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                {/* Split retido */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-7 w-7 rounded-full bg-sky-500/15 flex items-center justify-center shrink-0">
                    <Landmark className="h-3.5 w-3.5 text-sky-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Split retido automaticamente</p>
                    <p className="text-base font-bold font-heading text-sky-400">{fmt(stats.autoSplit)}</p>
                    <p className="text-xs text-muted-foreground">CardápioDigital — já recebido</p>
                  </div>
                </div>
                {/* Sem cobrança */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-7 w-7 rounded-full bg-amber-500/40 flex items-center justify-center shrink-0">
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sem cobrança gerada</p>
                    <p className="text-base font-bold font-heading text-amber-400">{fmt(semCobrancaTotal)}</p>
                    <p className="text-xs text-muted-foreground">{semCobrancaCount} pedido{semCobrancaCount !== 1 ? "s" : ""} descobertos{!isTodos ? " (total acum.)" : ""}</p>
                  </div>
                </div>
              </div>
              {/* Barra proporcional */}
              {totalPP > 0 && (
                <div className="mt-4 flex h-2 rounded-full overflow-hidden gap-px">
                  <div className="bg-foreground/30 transition-all" style={{ width: `${(boletoGerado / totalPP) * 100}%` }} title={`Boleto: ${fmt(boletoGerado)}`} />
                  <div className="bg-sky-400 transition-all" style={{ width: `${(stats.autoSplit / totalPP) * 100}%` }} title={`Split: ${fmt(stats.autoSplit)}`} />
                  <div className="bg-amber-400 transition-all" style={{ width: `${(semCobrancaTotal / totalPP) * 100}%` }} title={`Sem cobrança: ${fmt(semCobrancaTotal)}`} />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Tabela de cobranças ── */}
      <div ref={cobrancasTableRef} />
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="font-heading">Cobranças</CardTitle>
            <TablePagination total={filteredCobrancas.length} pageSize={pageSize} currentPage={currentPage} onPageSizeChange={setPageSize} onPageChange={setCurrentPage} />
          </div>
          {/* Barra de filtros + ações */}
          <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-border">
            <Select value={filterPizzaria} onValueChange={v => { setFilterPizzaria(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[170px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas pizzarias</SelectItem>
                {pizzarias.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="pendente">Aguardando boleto</SelectItem>
                <SelectItem value="agendado">Agendado</SelectItem>
                <SelectItem value="enviado">Boleto emitido</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterModalidade} onValueChange={v => { setFilterModalidade(v as "todos" | "boleto" | "split"); setCurrentPage(1); }}>
              <SelectTrigger className="w-[155px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas modalidades</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="split">Split</SelectItem>
              </SelectContent>
            </Select>
            <Popover open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <PopoverTrigger asChild>
                <Button variant={hasActiveFilters ? "default" : "outline"} size="sm" className="h-8 text-xs gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Avançado
                  {activeFilterCount > 0 && (
                    <span className="rounded-full bg-white/25 text-[10px] font-semibold px-1.5 leading-4">{activeFilterCount}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 overflow-x-hidden" align="start" style={{ maxHeight: "540px", overflowY: "auto" }}>
                <div className="flex items-center justify-between px-5 py-4 border-b">
                  <span className="text-sm font-semibold">Filtros avançados</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{filteredCobrancas.length} resultado{filteredCobrancas.length !== 1 ? "s" : ""}</span>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => { clearFilters(); setAdvancedOpen(false); }}>Limpar</Button>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-border">
                  <div>
                    <button onClick={() => toggleSection("periodo")} className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Data de criação</span>
                        {quick !== "campanha" && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                      </div>
                      <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections.periodo ? "rotate-180" : ""}`} />
                    </button>
                    {openSections.periodo && (
                      <div className="px-5 pt-1 pb-5 space-y-2">
                        <div className="flex flex-wrap gap-1 overflow-hidden">
                          {(Object.keys(QUICK_LABELS) as Exclude<QuickPeriod, "custom">[]).map(p => (
                            <Button key={p} variant={quick === p ? "default" : "outline"} size="sm" className="text-xs h-6 px-2"
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
                        <div className="grid grid-cols-2 gap-1.5">
                          <input type="date" value={customFromStr} onChange={e => setCustomFromStr(e.target.value)} className="w-full min-w-0 text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring" />
                          <input type="date" value={customToStr} onChange={e => setCustomToStr(e.target.value)} className="w-full min-w-0 text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring" />
                        </div>
                        <Button size="sm" className="w-full text-xs h-7" disabled={!customFromStr || !customToStr}
                          onClick={() => { setQuick("custom"); setDateFrom(startOfDay(new Date(customFromStr))); setDateTo(endOfDay(new Date(customToStr))); }}>
                          Aplicar período personalizado
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {(filterPizzaria !== "todas" || filterStatus !== "todos" || filterModalidade !== "todos" || hasActiveFilters) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setFilterPizzaria("todas"); setFilterStatus("todos"); setFilterModalidade("todos"); clearFilters(); }}>
                Limpar filtros
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                className="gap-1.5 text-xs h-8"
                disabled={pizzariaSaldos.length === 0}
                onClick={() => setBulkGenConfirm(true)}
              >
                <Receipt className="h-3.5 w-3.5" />
                Gerar cobranças
                {pizzariaSaldos.length > 0 && (
                  <span className="rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 leading-4">
                    {pizzariaSaldos.length}
                  </span>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                    <Download className="h-3.5 w-3.5" /> Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wide">Relatórios PDF</DropdownMenuLabel>
                  <DropdownMenuItem onClick={exportSinteticoPDF} className="gap-2 text-xs">
                    <BarChart2 className="h-3.5 w-3.5" /> Relatório Sintético
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportAnaliticoPDF} className="gap-2 text-xs">
                    <List className="h-3.5 w-3.5" /> Relatório Analítico
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wide">Dados</DropdownMenuLabel>
                  <DropdownMenuItem onClick={exportExcel} className="gap-2 text-xs">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportCSV} className="gap-2 text-xs">
                    <FileText className="h-3.5 w-3.5" /> CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCobrancas.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-muted-foreground text-sm">Nenhuma cobrança no período selecionado.</p>
              <p className="text-xs text-muted-foreground/60">Ajuste o filtro de período ou modalidade acima.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pizzaria</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Valor devido</TableHead>
                  <TableHead>Agendado para</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedCobrancas.map(c => {
                  const mod = pzModalidade(c.pizzaria_id);
                  return (
                  <TableRow key={c.id} className={mod === "split" ? "bg-sky-500/5" : undefined}>
                    <TableCell className="font-medium">{pzName(c.pizzaria_id)}</TableCell>
                    <TableCell className="text-sm">{c.periodo_inicio} a {c.periodo_fim}</TableCell>
                    <TableCell className="text-right">{Array.isArray(c.pedidos_snapshot) ? c.pedidos_snapshot.length : 0}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(c.valor_total_devido))}</TableCell>
                    <TableCell className="text-sm">
                      {mod === "split"
                        ? <span className="text-sky-600 dark:text-sky-400 text-xs italic">Automático</span>
                        : c.data_agendada ? format(new Date(c.data_agendada), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                    </TableCell>
                    <TableCell>{modalidadeBadge(mod)}</TableCell>
                    <TableCell>{statusBadge(c.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailDrawer(c)} title="Ver detalhes"><Eye className="h-4 w-4" /></Button>
                        {mod === "boleto" && (c.status === "pendente" || c.status === "agendado") && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => sendNow(c.id)} title="Enviar agora"><Send className="h-4 w-4" /></Button>
                        )}
                        {mod === "boleto" && c.status === "enviado" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-400" onClick={() => { setPayModal(c.id); setPayDate(new Date().toISOString().slice(0, 10)); setPayObs(""); }} title="Marcar como pago"><CheckCircle className="h-4 w-4" /></Button>
                        )}
                        {c.status !== "pago" && c.status !== "cancelado" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setCancelId(c.id)} title="Cancelar"><Ban className="h-4 w-4" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Modal: marcar como pago ── */}
      <Dialog open={!!payModal} onOpenChange={o => !o && setPayModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar como Pago</DialogTitle><DialogDescription>Informe a data do pagamento.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2"><Label>Data do Pagamento</Label><Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Observação (opcional)</Label><Textarea value={payObs} onChange={e => setPayObs(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayModal(null)}>Cancelar</Button>
            <Button onClick={markPaid}>Confirmar Pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog: cancelar cobrança ── */}
      <AlertDialog open={!!cancelId} onOpenChange={o => !o && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar cobrança?</AlertDialogTitle>
            <AlertDialogDescription>Os pedidos incluídos serão liberados para a próxima cobrança. Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { cancelCobranca(cancelId!); setCancelId(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Cancelar cobrança</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog: gerar cobrança individual ── */}
      <Dialog open={!!genModal} onOpenChange={o => !o && setGenModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar cobrança — {genPz?.nome}</DialogTitle>
            <DialogDescription>Defina o escopo de dias e confirme. O boleto pode ser emitido depois.</DialogDescription>
          </DialogHeader>
          {genPz && (
            <div className="space-y-3">
              {/* Seletor de período */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Período da cobrança</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">De</p>
                    <input
                      type="date"
                      value={genPeriodStart}
                      onChange={e => setGenPeriodStart(e.target.value)}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">Até</p>
                    <input
                      type="date"
                      value={genPeriodEnd}
                      onChange={e => setGenPeriodEnd(e.target.value)}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>

              {/* Preview do escopo */}
              <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Pedidos no período</span>
                  <span className="font-medium">{genPeriodPedidos.length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">🛵 Delivery ({genPeriodStats.totalDel > 0 ? fmt(genPeriodStats.totalDel) : "—"})</span>
                  <span className="font-medium">{genPeriodPedidos.filter((p: any) => !p.tipo_pedido || p.tipo_pedido === "delivery").length} ped.</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">🏪 Retirada ({genPeriodStats.totalRet > 0 ? fmt(genPeriodStats.totalRet) : "—"})</span>
                  <span className="font-medium">{genPeriodPedidos.filter((p: any) => p.tipo_pedido === "retirada").length} ped.</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">🍽️ Salão ({genPeriodStats.totalLoc > 0 ? fmt(genPeriodStats.totalLoc) : "—"})</span>
                  <span className="font-medium">{genPeriodPedidos.filter((p: any) => p.tipo_pedido === "local").length} ped.</span>
                </div>
                {genPeriodStats.autoSplit > 0 && (
                  <div className="flex justify-between text-xs border-t border-border pt-2">
                    <span className="text-muted-foreground">Split retido (app)</span>
                    <span className="text-sky-400">– {fmt(genPeriodStats.autoSplit)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-sm border-t border-border pt-2">
                  <span>Valor a cobrar</span>
                  <span className="text-primary">{fmt(genPeriodStats.saldo)}</span>
                </div>
              </div>
              {genPeriodPedidos.length === 0 && (
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
                  Nenhum pedido encontrado nesse intervalo. Ajuste as datas.
                </p>
              )}
              {genPzAllPending.length > genPeriodPedidos.length && (
                <p className="text-xs text-muted-foreground">
                  {genPzAllPending.length - genPeriodPedidos.length} pedido{genPzAllPending.length - genPeriodPedidos.length !== 1 ? "s" : ""} fora do escopo (total acumulado: {genPzAllPending.length})
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenModal(null)}>Cancelar</Button>
            <Button onClick={handleGenerate} disabled={saving || genPeriodPedidos.length === 0}>
              {saving ? "Gerando…" : "Gerar cobrança"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: gerar cobranças em lote ── */}
      <Dialog open={bulkGenConfirm} onOpenChange={o => { if (!bulkGenerating) setBulkGenConfirm(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar cobranças da semana</DialogTitle>
            <DialogDescription>
              {pizzariaSaldos.length} pizzaria{pizzariaSaldos.length !== 1 ? "s" : ""} com pedidos sem cobrança.
              Todas serão criadas como <strong>pendente</strong> — boletos emitidos manualmente depois.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-64">
            <div className="space-y-1 pr-2">
              {pizzariaSaldos.map(pz => (
                <div key={pz.id} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 text-sm">
                  <span>{pz.nome}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{pz.pendingPedidos.length} pedido{pz.pendingPedidos.length !== 1 ? "s" : ""}</span>
                    <span className="font-medium tabular-nums">{fmt(pz.saldo)}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="rounded-md bg-muted/40 px-3 py-2 text-sm flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold">{fmt(pizzariaSaldos.reduce((s, p) => s + p.saldo, 0))}</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkGenConfirm(false)} disabled={bulkGenerating}>Cancelar</Button>
            <Button onClick={handleBulkGenerate} disabled={bulkGenerating}>
              {bulkGenerating ? "Gerando…" : `Gerar ${pizzariaSaldos.length} cobrança${pizzariaSaldos.length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CobrancaDetalheModal
        cobranca={detailDrawer}
        pizzariaNome={detailDrawer ? pzName(detailDrawer.pizzaria_id) : ""}
        pizzariaCnpj={detailDrawer ? pzCnpj(detailDrawer.pizzaria_id) : null}
        pizzariaModalidade={detailDrawer ? pzModalidade(detailDrawer.pizzaria_id) : "boleto"}
        campanha={campanha}
        onClose={() => setDetailDrawer(null)}
        onRefresh={() => fetchAll(true)}
      />
    </div>
  );
}
