import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import { Receipt, Clock, Send, CheckCircle, Ban, Eye, CalendarDays, Download, FileSpreadsheet, FileText, BarChart2, List, SlidersHorizontal, ChevronDown } from "lucide-react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TablePagination from "@/components/gestor/TablePagination";
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
    pendente: { cls: "bg-muted text-muted-foreground", label: "Pendente" },
    agendado: { cls: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Agendado" },
    enviado: { cls: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "Enviado" },
    pago: { cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Pago" },
    cancelado: { cls: "bg-destructive/20 text-destructive", label: "Cancelado" },
  };
  const m = map[s] || map.pendente;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
};

const statusLabel = (s: string) => ({ pendente: "Pendente", agendado: "Agendado", enviado: "Enviado", pago: "Pago", cancelado: "Cancelado" }[s] ?? s);

export default function FinanceiroCobrancas() {
  const { selectedCampanha, filterSlot, exportSlot } = useOutletContext<ContextType>();
  const [pizzarias, setPizzarias] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [campanha, setCampanha] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [genModal, setGenModal] = useState<string | null>(null);
  const [sendOption, setSendOption] = useState("agora");
  const [customDate, setCustomDate] = useState(addDays(new Date(), 7).toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [payModal, setPayModal] = useState<string | null>(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payObs, setPayObs] = useState("");
  const [detailDrawer, setDetailDrawer] = useState<any>(null);

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Filtros básicos
  const [filterPizzaria, setFilterPizzaria] = useState("todas");
  const [filterStatus, setFilterStatus] = useState("todos");

  // Filtro avançado — período
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [quick, setQuick] = useState<QuickPeriod>("campanha");
  const [dateFrom, setDateFrom] = useState<Date>(() => startOfDay(subDays(new Date(), 29)));
  const [dateTo, setDateTo] = useState<Date>(() => endOfDay(new Date()));
  const [customFromStr, setCustomFromStr] = useState("");
  const [customToStr, setCustomToStr] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ periodo: false });
  const toggleSection = (k: string) => setOpenSections(s => ({ ...s, [k]: !s[k] }));

  const fetchAll = async () => {
    setLoading(true);
    let campId = selectedCampanha;
    if (campId === "todas") {
      const { data: cp } = await supabase.from("campanhas").select("*").eq("is_principal", true).limit(1).single();
      campId = cp?.id ?? "";
      setCampanha(cp);
    } else {
      const { data: cp } = await supabase.from("campanhas").select("*").eq("id", campId).single();
      setCampanha(cp);
    }
    let pQ = supabase.from("pedidos").select("*").eq("status", "entregue");
    if (selectedCampanha !== "todas") pQ = pQ.eq("campanha_id", selectedCampanha);
    let cQ = supabase.from("cobrancas_repasse").select("*");
    if (selectedCampanha !== "todas") cQ = cQ.eq("campanha_id", selectedCampanha);
    const [{ data: pz }, { data: p }, { data: c }, { data: validConsumers }] = await Promise.all([
      supabase.from("pizzarias").select("id, nome"),
      pQ,
      cQ.order("criado_em", { ascending: false }),
      supabase.from("consumidores").select("id, usuarios(nome, telefone)"),
    ]);
    const validIds = new Set((validConsumers ?? []).filter((c: any) => c.usuarios?.nome && c.usuarios?.telefone).map((c: any) => c.id));
    setPizzarias(pz ?? []);
    setPedidos((p ?? []).filter((ped: any) => validIds.has(ped.consumidor_id)));
    setCobrancas(c ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [selectedCampanha]);

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
      const pzPedidos = pedidos.filter(p => p.pizzaria_id === pz.id && !coberedPedidoIds.has(p.id));
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
    }).filter(pz => pz.pendingPedidos.length > 0);
  }, [pizzarias, pedidos, coberedPedidoIds, taxaDel, taxaRet, taxaLoc]);

  const stats = useMemo(() => {
    const pendente = cobrancas.filter(c => c.status === "pendente").reduce((s, c) => s + Number(c.valor_total_devido), 0);
    const agendado = cobrancas.filter(c => c.status === "agendado").reduce((s, c) => s + Number(c.valor_total_devido), 0);
    const enviado = cobrancas.filter(c => c.status === "enviado").reduce((s, c) => s + Number(c.valor_total_devido), 0);
    const pago = cobrancas.filter(c => c.status === "pago").reduce((s, c) => s + Number(c.valor_total_devido), 0);
    return { pendente, agendado, enviado, pago };
  }, [cobrancas]);

  const filteredCobrancas = useMemo(() => {
    let list = cobrancas;
    if (filterPizzaria !== "todas") list = list.filter(c => c.pizzaria_id === filterPizzaria);
    if (filterStatus !== "todos") list = list.filter(c => c.status === filterStatus);
    if (quick !== "campanha") list = list.filter(c => {
      const d = new Date(c.criado_em);
      return d >= dateFrom && d <= dateTo;
    });
    return list;
  }, [cobrancas, filterPizzaria, filterStatus, quick, dateFrom, dateTo]);

  const hasActiveFilters = quick !== "campanha";
  const activeFilterCount = [quick !== "campanha"].filter(Boolean).length;
  const clearFilters = () => { setQuick("campanha"); setCustomFromStr(""); setCustomToStr(""); };

  const pagedCobrancas = pageSize === 0 ? filteredCobrancas : filteredCobrancas.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const genPz = genModal ? pizzariaSaldos.find(p => p.id === genModal) : null;

  const handleGenerate = async () => {
    if (!genPz || !campanha) return;
    setSaving(true);
    const periodoInicio = genPz.pendingPedidos.reduce((min: string, p: any) => p.data_pedido < min ? p.data_pedido : min, genPz.pendingPedidos[0].data_pedido).slice(0, 10);
    const periodoFim = new Date().toISOString().slice(0, 10);
    const snapshot = genPz.pendingPedidos.map((p: any) => p.id);
    const dataAgendada = sendOption === "agora" ? new Date().toISOString() : sendOption === "semana" ? addDays(new Date(), 7).toISOString() : new Date(customDate + "T10:00:00").toISOString();
    const status = sendOption === "agora" ? "enviado" : "agendado";
    const { error } = await supabase.from("cobrancas_repasse").insert({
      pizzaria_id: genPz.id, campanha_id: campanha.id, periodo_inicio: periodoInicio, periodo_fim: periodoFim,
      total_vendas_automatico: genPz.pendingPedidos.filter((p: any) => p.canal === "cardapioweb").reduce((s: number, p: any) => s + Number(p.valor_total), 0),
      total_vendas_manual: genPz.pendingPedidos.filter((p: any) => p.canal !== "cardapioweb").reduce((s: number, p: any) => s + Number(p.valor_total), 0),
      total_delivery: genPz.totalDel, total_retirada: genPz.totalRet, total_local: genPz.totalLoc,
      taxa_delivery_aplicada: taxaDel, taxa_retirada_aplicada: taxaRet, taxa_local_aplicada: taxaLoc,
      valor_automatico_pp: genPz.autoSplit, valor_manual_devido: genPz.totalPP - genPz.autoSplit,
      valor_total_devido: genPz.totalPP - genPz.autoSplit, data_agendada: dataAgendada, status,
      data_envio: sendOption === "agora" ? new Date().toISOString() : null, pedidos_snapshot: snapshot,
    });
    if (error) { toast.error("Erro ao gerar cobrança."); setSaving(false); return; }
    if (sendOption === "agora") {
      const msg = `Olá ${genPz.nome}!\n\nCobrança referente ao período ${periodoInicio} a ${periodoFim}:\n\nDelivery (${genPz.delivery.length} pedidos): ${fmt(genPz.ppDel)}\nRetirada (${genPz.retirada.length} pedidos): ${fmt(genPz.ppRet)}\nSalão (${genPz.local.length} pedidos): ${fmt(genPz.ppLoc)}\n\nTotal de vendas: ${fmt(genPz.totalDel + genPz.totalRet + genPz.totalLoc)}\nJá retido automaticamente: ${fmt(genPz.autoSplit)}\nValor a transferir: ${fmt(genPz.totalPP - genPz.autoSplit)}\n\nPizza Premiada`;
      console.log("[COBRANÇA WHATSAPP]", msg);
    }
    toast.success("Cobrança gerada com sucesso!"); setSaving(false); setGenModal(null); fetchAll();
  };

  const markPaid = async () => {
    if (!payModal) return;
    const { error } = await supabase.from("cobrancas_repasse").update({ status: "pago", data_pagamento: payDate, observacao: payObs || null }).eq("id", payModal);
    if (error) { toast.error("Erro ao atualizar."); return; }
    toast.success("Cobrança marcada como paga!"); setPayModal(null); fetchAll();
  };

  const sendNow = async (id: string) => {
    const { error } = await supabase.from("cobrancas_repasse").update({ status: "enviado", data_envio: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("Erro ao enviar."); return; }
    toast.success("Cobrança enviada!"); fetchAll();
  };

  const cancelCobranca = async (id: string) => {
    const { error } = await supabase.from("cobrancas_repasse").update({ status: "cancelado" }).eq("id", id);
    if (error) { toast.error("Erro ao cancelar."); return; }
    toast.success("Cobrança cancelada. Pedidos liberados para próxima cobrança."); fetchAll();
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
      {filterSlot && createPortal(
        <>
          <Select value={filterPizzaria} onValueChange={setFilterPizzaria}>
            <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas pizzarias</SelectItem>
              {pizzarias.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="agendado">Agendado</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
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
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => { clearFilters(); setAdvancedOpen(false); }}>Limpar tudo</Button>
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

        </>,
        filterSlot,
      )}

      {exportSlot && createPortal(
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
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
        </DropdownMenu>,
        exportSlot,
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card"><CardHeader className="flex flex-row items-center gap-2 pb-2"><Clock className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-sm text-muted-foreground">Total pendente</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold">{fmt(stats.pendente)}</p></CardContent></Card>
        <Card className="border-border bg-card"><CardHeader className="flex flex-row items-center gap-2 pb-2"><CalendarDays className="h-5 w-5 text-blue-400" /><CardTitle className="text-sm text-muted-foreground">Total agendado</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold text-blue-400">{fmt(stats.agendado)}</p></CardContent></Card>
        <Card className="border-border bg-card"><CardHeader className="flex flex-row items-center gap-2 pb-2"><Send className="h-5 w-5 text-amber-400" /><CardTitle className="text-sm text-muted-foreground">Aguardando pgto</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold text-amber-400">{fmt(stats.enviado)}</p></CardContent></Card>
        <Card className="border-border bg-card"><CardHeader className="flex flex-row items-center gap-2 pb-2"><CheckCircle className="h-5 w-5 text-emerald-400" /><CardTitle className="text-sm text-muted-foreground">Pago no ciclo</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold text-emerald-400">{fmt(stats.pago)}</p></CardContent></Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="font-heading">Pizzarias com saldo pendente</CardTitle></CardHeader>
        <CardContent>
          {pizzariaSaldos.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Nenhuma pizzaria com saldo pendente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pizzaria</TableHead>
                  <TableHead className="text-right">Saldo pendente</TableHead>
                  <TableHead>Último pedido</TableHead>
                  <TableHead>Última cobrança</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pizzariaSaldos.map(pz => (
                  <TableRow key={pz.id}>
                    <TableCell className="font-medium">{pz.nome}</TableCell>
                    <TableCell className="text-right font-medium text-amber-500">{fmt(pz.saldo)}</TableCell>
                    <TableCell className="text-sm">{pz.lastPedido ? format(new Date(pz.lastPedido), "dd/MM/yyyy", { locale: ptBR }) : "—"}</TableCell>
                    <TableCell className="text-sm">{pz.lastCobranca ? format(new Date(pz.lastCobranca), "dd/MM/yyyy", { locale: ptBR }) : "—"}</TableCell>
                    <TableCell className="text-right"><Button size="sm" onClick={() => { setGenModal(pz.id); setSendOption("agora"); }}>Gerar cobrança</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading">Cobranças geradas</CardTitle>
          <TablePagination total={filteredCobrancas.length} pageSize={pageSize} currentPage={currentPage} onPageSizeChange={setPageSize} onPageChange={setCurrentPage} />
        </CardHeader>
        <CardContent>
          {filteredCobrancas.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Nenhuma cobrança encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pizzaria</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Valor devido</TableHead>
                  <TableHead>Agendado para</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedCobrancas.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{pzName(c.pizzaria_id)}</TableCell>
                    <TableCell className="text-sm">{c.periodo_inicio} a {c.periodo_fim}</TableCell>
                    <TableCell className="text-right">{Array.isArray(c.pedidos_snapshot) ? c.pedidos_snapshot.length : 0}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(c.valor_total_devido))}</TableCell>
                    <TableCell className="text-sm">{c.data_agendada ? format(new Date(c.data_agendada), "dd/MM/yyyy", { locale: ptBR }) : "—"}</TableCell>
                    <TableCell>{statusBadge(c.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailDrawer(c)} title="Ver detalhes"><Eye className="h-4 w-4" /></Button>
                        {(c.status === "pendente" || c.status === "agendado") && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => sendNow(c.id)} title="Enviar agora"><Send className="h-4 w-4" /></Button>
                        )}
                        {c.status === "enviado" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-400" onClick={() => { setPayModal(c.id); setPayDate(new Date().toISOString().slice(0, 10)); setPayObs(""); }} title="Marcar como pago"><CheckCircle className="h-4 w-4" /></Button>
                        )}
                        {c.status !== "pago" && c.status !== "cancelado" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => cancelCobranca(c.id)} title="Cancelar"><Ban className="h-4 w-4" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!genModal} onOpenChange={o => !o && setGenModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar cobrança — {genPz?.nome}</DialogTitle>
            <DialogDescription>Confira os valores e escolha quando enviar.</DialogDescription>
          </DialogHeader>
          {genPz && (
            <div className="space-y-4 py-2">
              <div className="space-y-2 text-sm">
                <p className="font-medium">Pedidos incluídos nesta cobrança:</p>
                <p className="text-muted-foreground">Total: {genPz.pendingPedidos.length} pedidos</p>
                <div className="space-y-1 bg-secondary rounded-lg p-3">
                  <p>🛵 Delivery: {genPz.delivery.length} pedidos × {taxaDel}% = {fmt(genPz.ppDel)}</p>
                  <p>🏪 Retirada: {genPz.retirada.length} pedidos × {taxaRet}% = {fmt(genPz.ppRet)}</p>
                  <p>🍽️ Salão: {genPz.local.length} pedidos × {taxaLoc}% = {fmt(genPz.ppLoc)}</p>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-muted-foreground">Já retido automaticamente:</span>
                  <span>{fmt(genPz.autoSplit)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Valor devido:</span>
                  <span className="text-primary">{fmt(genPz.totalPP - genPz.autoSplit)}</span>
                </div>
              </div>
              <div className="space-y-3">
                <Label className="font-medium">Quando enviar a cobrança:</Label>
                <RadioGroup value={sendOption} onValueChange={setSendOption}>
                  <div className="flex items-center gap-2"><RadioGroupItem value="agora" id="agora" /><Label htmlFor="agora">Agora — enviar imediatamente</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="semana" id="semana" /><Label htmlFor="semana">Na próxima semana (7 dias)</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="custom" id="custom" /><Label htmlFor="custom">Data personalizada</Label></div>
                </RadioGroup>
                {sendOption === "custom" && <Input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)} className="w-48" />}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenModal(null)}>Cancelar</Button>
            <Button onClick={handleGenerate} disabled={saving}>{saving ? "Gerando..." : "Confirmar cobrança"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Sheet open={!!detailDrawer} onOpenChange={o => !o && setDetailDrawer(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader><SheetTitle>Detalhes da Cobrança</SheetTitle></SheetHeader>
          {detailDrawer && (
            <div className="space-y-4 mt-4 text-sm">
              <div className="space-y-1">
                <p><strong>Pizzaria:</strong> {pzName(detailDrawer.pizzaria_id)}</p>
                <p><strong>Período:</strong> {detailDrawer.periodo_inicio} a {detailDrawer.periodo_fim}</p>
                <p><strong>Status:</strong> {detailDrawer.status}</p>
                {detailDrawer.data_pagamento && <p><strong>Pago em:</strong> {format(new Date(detailDrawer.data_pagamento), "dd/MM/yyyy")}</p>}
                {detailDrawer.observacao && <p><strong>Obs:</strong> {detailDrawer.observacao}</p>}
              </div>
              <div className="space-y-1 bg-secondary rounded-lg p-3">
                <p>Delivery: {fmt(Number(detailDrawer.total_delivery))} × {detailDrawer.taxa_delivery_aplicada}%</p>
                <p>Retirada: {fmt(Number(detailDrawer.total_retirada))} × {detailDrawer.taxa_retirada_aplicada}%</p>
                <p>Salão: {fmt(Number(detailDrawer.total_local))} × {detailDrawer.taxa_local_aplicada}%</p>
                <p className="pt-2">Automático: {fmt(Number(detailDrawer.valor_automatico_pp))}</p>
                <p className="font-bold">Devido: {fmt(Number(detailDrawer.valor_total_devido))}</p>
              </div>
              <div>
                <p className="font-medium mb-2">Pedidos incluídos ({Array.isArray(detailDrawer.pedidos_snapshot) ? detailDrawer.pedidos_snapshot.length : 0}):</p>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {Array.isArray(detailDrawer.pedidos_snapshot) && detailDrawer.pedidos_snapshot.map((id: string, i: number) => (
                    <p key={id} className="text-xs text-muted-foreground font-mono">{i + 1}. {id.slice(0, 8)}...</p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
