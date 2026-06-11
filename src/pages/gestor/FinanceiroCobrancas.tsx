import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import { Receipt, Clock, Send, CheckCircle, Ban, Eye, CalendarDays, Download, FileSpreadsheet, FileText, BarChart2, List, SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight, Copy, ExternalLink, Landmark, RefreshCw, FileDown } from "lucide-react";
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

  const [cancelId, setCancelId] = useState<string | null>(null);
  const [gerandoBoleto, setGerandoBoleto] = useState(false);
  const cobrancasTableRef = useRef<HTMLDivElement>(null);

  // Drawer detail state
  const [drawerPedidos, setDrawerPedidos] = useState<any[]>([]);
  const [drawerCupons, setDrawerCupons] = useState<any[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerTab, setDrawerTab] = useState("resumo");

  // Navegação semanal — padrão: última semana completa
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(() => {
    const now = new Date();
    const dow = now.getDay(); // 0=Dom
    const daysSinceMon = dow === 0 ? 6 : dow - 1;
    const thisMon = new Date(now);
    thisMon.setDate(now.getDate() - daysSinceMon);
    const lastMon = new Date(thisMon);
    lastMon.setDate(thisMon.getDate() - 7);
    return lastMon.toISOString().slice(0, 10);
  });

  const selectedWeekEnd = useMemo(() => {
    const d = new Date(selectedWeekStart + "T12:00:00");
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  }, [selectedWeekStart]);

  const goToPrevWeek = () => {
    const d = new Date(selectedWeekStart + "T12:00:00");
    d.setDate(d.getDate() - 7);
    setSelectedWeekStart(d.toISOString().slice(0, 10));
    setCurrentPage(1);
  };
  const goToNextWeek = () => {
    const d = new Date(selectedWeekStart + "T12:00:00");
    d.setDate(d.getDate() + 7);
    setSelectedWeekStart(d.toISOString().slice(0, 10));
    setCurrentPage(1);
  };

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
    let pQ = supabase.from("pedidos").select("*").eq("status", "entregue");
    if (selectedCampanha !== "todas") pQ = pQ.eq("campanha_id", selectedCampanha);
    let cQ = supabase.from("cobrancas_repasse").select("*");
    if (selectedCampanha !== "todas") cQ = cQ.eq("campanha_id", selectedCampanha);
    const [{ data: pz }, { data: p }, { data: c }, { data: validConsumers }] = await Promise.all([
      supabase.from("pizzarias").select("id, nome, cnpj"),
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

  // Snap para a semana mais recente com dados quando cobranças carregam pela 1ª vez
  const weekSnapDone = useRef(false);
  useEffect(() => {
    if (!cobrancas.length || weekSnapDone.current) return;
    weekSnapDone.current = true;
    const hasCurrent = cobrancas.some(c => c.periodo_inicio === selectedWeekStart);
    if (hasCurrent) return;
    const mostRecent = cobrancas
      .map((c: any) => c.periodo_inicio as string)
      .filter(Boolean)
      .sort()
      .pop();
    if (mostRecent) setSelectedWeekStart(mostRecent);
  }, [cobrancas]);

  // Reset snap ao trocar campanha
  useEffect(() => { weekSnapDone.current = false; }, [selectedCampanha]);

  // Mantém detailDrawer sincronizado quando cobrancas é recarregado
  useEffect(() => {
    if (!detailDrawer) return;
    const fresh = cobrancas.find((c: any) => c.id === detailDrawer.id);
    if (fresh) setDetailDrawer(fresh);
  }, [cobrancas]);

  // Carrega pedidos e cupons detalhados quando o drawer abre
  useEffect(() => {
    if (!detailDrawer?.id) {
      setDrawerPedidos([]);
      setDrawerCupons([]);
      return;
    }
    const ids: string[] = Array.isArray(detailDrawer.pedidos_snapshot) ? detailDrawer.pedidos_snapshot : [];
    if (!ids.length) {
      setDrawerPedidos([]);
      setDrawerCupons([]);
      return;
    }
    setDrawerLoading(true);
    setDrawerTab("resumo");
    Promise.all([
      supabase.from("pedidos")
        .select("id, data_pedido, valor_total, tipo_pedido, canal, cupons_gerados")
        .in("id", ids),
      supabase.from("cupons")
        .select("id, pedido_id, quantidade, status, criado_em")
        .in("pedido_id", ids),
    ]).then(([{ data: peds }, { data: cups }]) => {
      setDrawerPedidos(peds ?? []);
      setDrawerCupons(cups ?? []);
      setDrawerLoading(false);
    });
  }, [detailDrawer?.id]);

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

  const weekCobrancas = useMemo(
    () => cobrancas.filter(c => c.periodo_inicio === selectedWeekStart),
    [cobrancas, selectedWeekStart],
  );

  const stats = useMemo(() => {
    const pendente = weekCobrancas.filter(c => c.status === "pendente").reduce((s, c) => s + Number(c.valor_total_devido), 0);
    const agendado = weekCobrancas.filter(c => c.status === "agendado").reduce((s, c) => s + Number(c.valor_total_devido), 0);
    const enviado = weekCobrancas.filter(c => c.status === "enviado").reduce((s, c) => s + Number(c.valor_total_devido), 0);
    const pago = weekCobrancas.filter(c => c.status === "pago").reduce((s, c) => s + Number(c.valor_total_devido), 0);
    return { pendente, agendado, enviado, pago };
  }, [weekCobrancas]);

  const filteredCobrancas = useMemo(() => {
    let list = weekCobrancas;
    if (filterPizzaria !== "todas") list = list.filter(c => c.pizzaria_id === filterPizzaria);
    if (filterStatus !== "todos") list = list.filter(c => c.status === filterStatus);
    return list;
  }, [weekCobrancas, filterPizzaria, filterStatus]);

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
    if (error) { toast.error(`Erro ao gerar cobrança: ${error.message}`); setSaving(false); return; }
    toast.success("Cobrança gerada com sucesso!");
    setSaving(false);
    setGenModal(null);
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

  const [verificandoNFSe, setVerificandoNFSe] = useState(false);

  const verificarNFSe = async (cobrancaId: string) => {
    setVerificandoNFSe(true);
    try {
      const { data, error } = await supabase.functions.invoke("spedy-check-nfse", {
        body: { cobranca_id: cobrancaId },
      });
      if (error || !data?.ok) throw new Error(data?.error ?? error?.message ?? "Erro ao verificar NFS-e");
      await fetchAll();
      if (detailDrawer?.id === cobrancaId) {
        setDetailDrawer((prev: any) => ({
          ...prev,
          spedy_invoice_status: data.spedy_invoice_status,
          spedy_invoice_id:     data.spedy_invoice_id ?? prev.spedy_invoice_id,
          spedy_nfse_number:    data.spedy_nfse_number ?? prev.spedy_nfse_number,
          spedy_nfse_pdf_url:   data.spedy_nfse_pdf_url ?? prev.spedy_nfse_pdf_url,
          spedy_invoice_error:  data.spedy_invoice_error ?? prev.spedy_invoice_error,
        }));
      }
      if (data.spedy_invoice_status === "authorized") toast.success("NFS-e autorizada!");
      else if (data.spedy_invoice_status === "rejected") toast.error(`NFS-e rejeitada: ${data.spedy_invoice_error ?? "verifique o backoffice Spedy"}`);
      else toast.info("NFS-e ainda em processamento.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao verificar NFS-e");
    } finally {
      setVerificandoNFSe(false);
    }
  };

  const emitirBoleto = async (cobrancaId: string) => {
    setGerandoBoleto(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-create-charge", {
        body: { cobranca_id: cobrancaId },
      });
      if (error || !data?.ok) throw new Error(data?.error ?? error?.message ?? "Erro ao emitir boleto");

      toast.success("Boleto emitido! O link foi salvo na cobrança.");
      if (data.spedy_warning) toast.warning(`NFS-e: ${data.spedy_warning}`);
      else if (data.spedy_order_id) toast.success("NFS-e enviada para emissão pela Spedy.");

      await fetchAll();
      if (detailDrawer?.id === cobrancaId) {
        setDetailDrawer((prev: any) => ({
          ...prev,
          asaas_payment_id:       data.payment_id,
          boleto_url:             data.boleto_url,
          boleto_linha_digitavel: data.linha_digitavel,
          vencimento_boleto:      data.due_date,
          status:                 "enviado",
          spedy_order_id:         data.spedy_order_id ?? prev.spedy_order_id,
          spedy_invoice_status:   data.spedy_order_id ? "pending" : prev.spedy_invoice_status,
        }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao emitir boleto via Asaas");
    } finally {
      setGerandoBoleto(false);
    }
  };

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

  const exportRelatorioPDF = async () => {
    if (!detailDrawer) return;
    const lettering = await loadLetteringDataUrl();
    const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
    const pzNome = pzName(detailDrawer.pizzaria_id);
    const periodo = `${detailDrawer.periodo_inicio} a ${detailDrawer.periodo_fim}`;

    // ── Página 1: Resumo + Pedidos + Cupons ─────────────────────────────
    let y = buildPdfHeader(doc, pzNome, `Relatório de Cobrança — ${periodo}`, [], lettering);

    y = drawSectionTitle(doc, "Resumo Financeiro", y);
    autoTable(doc, {
      ...TABLE_STYLES,
      head: [["", "Valor"]],
      body: [
        [`Delivery (${detailDrawer.taxa_delivery_aplicada ?? 15}%)`, fmt(Number(detailDrawer.total_delivery))],
        [`Retirada (${detailDrawer.taxa_retirada_aplicada ?? 15}%)`, fmt(Number(detailDrawer.total_retirada))],
        [`Salao (${detailDrawer.taxa_local_aplicada ?? 12}%)`, fmt(Number(detailDrawer.total_local))],
        ["Retido automaticamente (cardapio web)", `- ${fmt(Number(detailDrawer.valor_automatico_pp))}`],
        ["Valor devido", fmt(Number(detailDrawer.valor_total_devido))],
      ],
      startY: y,
      tableWidth: 380,
    });

    y = (doc as any).lastAutoTable.finalY + 14;
    y = drawSectionTitle(doc, `Pedidos Incluidos (${drawerPedidos.length})`, y);
    autoTable(doc, {
      ...TABLE_STYLES,
      head: [["#", "Data/Hora", "Tipo", "Canal", "Valor", "Comissao"]],
      body: [...drawerPedidos]
        .sort((a, b) => new Date(a.data_pedido).getTime() - new Date(b.data_pedido).getTime())
        .map((p, i) => {
          const taxa = getTaxa(p.tipo_pedido);
          const tipoLabel = p.tipo_pedido === "retirada" ? "Retirada" : p.tipo_pedido === "local" ? "Salao" : "Delivery";
          return [
            i + 1,
            format(new Date(p.data_pedido), "dd/MM/yyyy HH:mm", { locale: ptBR }),
            tipoLabel,
            p.canal === "cardapioweb" ? "App" : "Manual",
            fmt(Number(p.valor_total)),
            fmt(Number(p.valor_total) * taxa / 100),
          ];
        }),
      startY: y,
    });

    y = (doc as any).lastAutoTable.finalY + 14;
    y = drawSectionTitle(doc, `Cupons Gerados`, y);
    const totalCupons = drawerCupons.reduce((s, c) => s + (c.quantidade ?? 1), 0);
    autoTable(doc, {
      ...TABLE_STYLES,
      head: [["Total", "Utilizados", "Disponiveis"]],
      body: [[
        totalCupons,
        drawerCupons.filter(c => c.status === "utilizado").length,
        drawerCupons.filter(c => c.status !== "utilizado" && c.status !== "expirado").length,
      ]],
      startY: y,
      tableWidth: 340,
    });
    addPdfFooter(doc, `Cobranca — ${pzNome}`);

    // ── Página 2: NFS-e ──────────────────────────────────────────────────
    doc.addPage();
    y = buildPdfHeader(doc, pzNome, `Nota Fiscal de Servico (NFS-e) — ${periodo}`, [], lettering);
    y = drawSectionTitle(doc, "Dados da NFS-e", y);
    const nfseRows: (string | number)[][] = [];
    if (detailDrawer.spedy_order_id) {
      nfseRows.push(["Spedy Order ID", detailDrawer.spedy_order_id]);
      nfseRows.push(["Status",
        detailDrawer.spedy_invoice_status === "authorized" ? "Autorizada" :
        detailDrawer.spedy_invoice_status === "rejected"   ? "Rejeitada"  : "Pendente / Em processamento"
      ]);
      if (detailDrawer.spedy_invoice_id) nfseRows.push(["Invoice ID", detailDrawer.spedy_invoice_id]);
      if (detailDrawer.spedy_nfse_number) nfseRows.push(["Numero NFS-e", detailDrawer.spedy_nfse_number]);
      if (detailDrawer.spedy_nfse_pdf_url) nfseRows.push(["PDF NFS-e", detailDrawer.spedy_nfse_pdf_url]);
      if (detailDrawer.spedy_invoice_error) nfseRows.push(["Erro", detailDrawer.spedy_invoice_error]);
    } else {
      nfseRows.push(["Status", "NFS-e nao emitida para esta cobranca"]);
    }
    autoTable(doc, { ...TABLE_STYLES, head: [["Campo", "Valor"]], body: nfseRows, startY: y });
    addPdfFooter(doc, `NFS-e — ${pzNome}`);

    // ── Página 3: Boleto ─────────────────────────────────────────────────
    doc.addPage();
    y = buildPdfHeader(doc, pzNome, `Boleto Bancario — ${periodo}`, [], lettering);
    y = drawSectionTitle(doc, "Dados do Boleto", y);
    const boletoRows: (string | number)[][] = [];
    if (detailDrawer.asaas_payment_id) {
      boletoRows.push(["ID Asaas", detailDrawer.asaas_payment_id]);
      if (detailDrawer.vencimento_boleto) boletoRows.push(["Vencimento", format(new Date(detailDrawer.vencimento_boleto + "T12:00:00"), "dd/MM/yyyy")]);
      boletoRows.push(["Valor", fmt(Number(detailDrawer.valor_total_devido))]);
      if (detailDrawer.boleto_linha_digitavel) boletoRows.push(["Linha Digitavel", detailDrawer.boleto_linha_digitavel]);
      if (detailDrawer.boleto_url) boletoRows.push(["Link do Boleto", detailDrawer.boleto_url]);
    } else {
      boletoRows.push(["Status", "Boleto nao emitido para esta cobranca"]);
    }
    autoTable(doc, { ...TABLE_STYLES, head: [["Campo", "Valor"]], body: boletoRows, startY: y });
    addPdfFooter(doc, `Boleto — ${pzNome}`);

    doc.save(`relatorio-${pzNome.replace(/\s+/g, "-").toLowerCase()}-${detailDrawer.periodo_inicio}.pdf`);
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

      {/* ── Navegação semanal ── */}
      <div className="flex items-center justify-between bg-secondary rounded-xl px-5 py-3 border border-border">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground" onClick={goToPrevWeek}>
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold font-heading">
            Semana de {format(new Date(selectedWeekStart + "T12:00:00"), "dd/MM", { locale: ptBR })} a {format(new Date(selectedWeekEnd + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {weekCobrancas.length} cobrança{weekCobrancas.length !== 1 ? "s" : ""} •{" "}
            {fmt(weekCobrancas.reduce((s, c) => s + Number(c.valor_total_devido), 0))}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground" onClick={goToNextWeek}>
          Próxima <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card"><CardHeader className="flex flex-row items-center gap-2 pb-2"><Clock className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-sm text-muted-foreground">Total pendente</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold">{fmt(stats.pendente)}</p></CardContent></Card>
        <Card className="border-border bg-card"><CardHeader className="flex flex-row items-center gap-2 pb-2"><CalendarDays className="h-5 w-5 text-blue-400" /><CardTitle className="text-sm text-muted-foreground">Total agendado</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold text-blue-400">{fmt(stats.agendado)}</p></CardContent></Card>
        <Card className="border-border bg-card"><CardHeader className="flex flex-row items-center gap-2 pb-2"><Send className="h-5 w-5 text-amber-400" /><CardTitle className="text-sm text-muted-foreground">Aguardando pgto</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold text-amber-400">{fmt(stats.enviado)}</p></CardContent></Card>
        <Card className="border-border bg-card"><CardHeader className="flex flex-row items-center gap-2 pb-2"><CheckCircle className="h-5 w-5 text-emerald-400" /><CardTitle className="text-sm text-muted-foreground">Pago no ciclo</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold text-emerald-400">{fmt(stats.pago)}</p></CardContent></Card>
      </div>

      {/* ── Tabela de cobranças ── */}
      <div ref={cobrancasTableRef} />
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading">Cobranças</CardTitle>
          <TablePagination total={filteredCobrancas.length} pageSize={pageSize} currentPage={currentPage} onPageSizeChange={setPageSize} onPageChange={setCurrentPage} />
        </CardHeader>
        <CardContent>
          {filteredCobrancas.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-muted-foreground text-sm">Nenhuma cobrança nesta semana.</p>
              <p className="text-xs text-muted-foreground/60">Use as setas acima para navegar entre semanas.</p>
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
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setCancelId(c.id)} title="Cancelar"><Ban className="h-4 w-4" /></Button>
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

      {/* ── Modal full-screen: detalhes da cobrança ── */}
      <Dialog open={!!detailDrawer} onOpenChange={o => !o && setDetailDrawer(null)}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          {detailDrawer && (
            <>
              {/* Header */}
              <div className="px-6 pt-5 pb-4 border-b border-border shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-heading font-semibold">{pzName(detailDrawer.pizzaria_id)}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-muted-foreground">
                        {detailDrawer.periodo_inicio} a {detailDrawer.periodo_fim}
                      </span>
                      {statusBadge(detailDrawer.status)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-heading font-bold text-primary">{fmt(Number(detailDrawer.valor_total_devido))}</p>
                    <p className="text-xs text-muted-foreground">a receber</p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={drawerTab} onValueChange={setDrawerTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="mx-6 mt-4 shrink-0 self-start bg-secondary">
                  <TabsTrigger value="resumo">Resumo</TabsTrigger>
                  <TabsTrigger value="pedidos" className="gap-1.5">
                    Pedidos
                    <span className="text-[10px] bg-primary/20 text-primary rounded-full px-1.5 py-0.5 font-semibold">
                      {drawerLoading ? "…" : drawerPedidos.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="cupons" className="gap-1.5">
                    Cupons
                    <span className="text-[10px] bg-primary/20 text-primary rounded-full px-1.5 py-0.5 font-semibold">
                      {drawerLoading ? "…" : drawerCupons.reduce((s, c) => s + (c.quantidade ?? 1), 0)}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="fiscal">Boleto & NFS-e</TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 mt-4">
                  <div className="px-6 pb-6">

                    {/* ── Resumo ── */}
                    <TabsContent value="resumo" className="mt-0 space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="bg-secondary rounded-lg p-4">
                          <p className="text-xs text-muted-foreground mb-1">Total em vendas</p>
                          <p className="text-xl font-bold">{fmt(Number(detailDrawer.total_delivery) + Number(detailDrawer.total_retirada) + Number(detailDrawer.total_local))}</p>
                        </div>
                        <div className="bg-secondary rounded-lg p-4">
                          <p className="text-xs text-muted-foreground mb-1">Pedidos incluídos</p>
                          <p className="text-xl font-bold">{Array.isArray(detailDrawer.pedidos_snapshot) ? detailDrawer.pedidos_snapshot.length : 0}</p>
                        </div>
                        <div className="bg-secondary rounded-lg p-4">
                          <p className="text-xs text-muted-foreground mb-1">Cupons gerados</p>
                          <p className="text-xl font-bold">{drawerLoading ? "…" : drawerCupons.reduce((s, c) => s + (c.quantidade ?? 1), 0)}</p>
                        </div>
                      </div>

                      <div className="bg-secondary rounded-lg p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>🛵 Delivery — {detailDrawer.taxa_delivery_aplicada}%</span>
                          <span>{fmt(Number(detailDrawer.total_delivery))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>🏪 Retirada — {detailDrawer.taxa_retirada_aplicada}%</span>
                          <span>{fmt(Number(detailDrawer.total_retirada))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>🍽️ Salão — {detailDrawer.taxa_local_aplicada}%</span>
                          <span>{fmt(Number(detailDrawer.total_local))}</span>
                        </div>
                        <div className="border-t border-border pt-2 flex justify-between text-muted-foreground text-xs">
                          <span>Já retido automaticamente (cardápio web)</span>
                          <span>– {fmt(Number(detailDrawer.valor_automatico_pp))}</span>
                        </div>
                        <div className="flex justify-between font-bold text-base text-primary pt-1">
                          <span>Valor devido</span>
                          <span>{fmt(Number(detailDrawer.valor_total_devido))}</span>
                        </div>
                      </div>

                      {detailDrawer.data_pagamento && (
                        <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Pago em {format(new Date(detailDrawer.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                      {detailDrawer.observacao && (
                        <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-3">{detailDrawer.observacao}</p>
                      )}
                    </TabsContent>

                    {/* ── Pedidos ── */}
                    <TabsContent value="pedidos" className="mt-0">
                      {drawerLoading ? (
                        <p className="text-sm text-muted-foreground text-center py-12">Carregando pedidos...</p>
                      ) : drawerPedidos.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-12">Nenhum pedido encontrado.</p>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {(["delivery", "retirada", "local"] as const).map(tipo => {
                              const filtered = drawerPedidos.filter(p =>
                                tipo === "delivery" ? (!p.tipo_pedido || p.tipo_pedido === "delivery") : p.tipo_pedido === tipo
                              );
                              const total = filtered.reduce((s, p) => s + Number(p.valor_total), 0);
                              const icon = tipo === "retirada" ? "🏪" : tipo === "local" ? "🍽️" : "🛵";
                              const label = tipo === "retirada" ? "Retirada" : tipo === "local" ? "Salão" : "Delivery";
                              const taxa = tipo === "retirada" ? taxaRet : tipo === "local" ? taxaLoc : taxaDel;
                              return (
                                <div key={tipo} className="bg-secondary rounded-lg p-3">
                                  <p className="text-xs text-muted-foreground">{icon} {label} ({filtered.length})</p>
                                  <p className="font-bold mt-1 text-sm">{fmt(total)}</p>
                                  <p className="text-xs text-primary">Comissão: {fmt(total * taxa / 100)}</p>
                                </div>
                              );
                            })}
                            <div className="bg-secondary rounded-lg p-3">
                              <p className="text-xs text-muted-foreground">Total comissão</p>
                              <p className="font-bold text-primary mt-1 text-sm">
                                {fmt(drawerPedidos.reduce((s, p) => s + Number(p.valor_total) * getTaxa(p.tipo_pedido) / 100, 0))}
                              </p>
                            </div>
                          </div>

                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10">#</TableHead>
                                <TableHead>Data/hora</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Canal</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead className="text-right">Comissão</TableHead>
                                <TableHead className="text-right">Cupons</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {[...drawerPedidos]
                                .sort((a, b) => new Date(a.data_pedido).getTime() - new Date(b.data_pedido).getTime())
                                .map((p, i) => {
                                  const taxa = getTaxa(p.tipo_pedido);
                                  const comissao = Number(p.valor_total) * taxa / 100;
                                  const tipoLabel = p.tipo_pedido === "retirada" ? "Retirada" : p.tipo_pedido === "local" ? "Salão" : "Delivery";
                                  const tipoIcon = p.tipo_pedido === "retirada" ? "🏪" : p.tipo_pedido === "local" ? "🍽️" : "🛵";
                                  return (
                                    <TableRow key={p.id}>
                                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                                      <TableCell className="text-xs">{format(new Date(p.data_pedido), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                                      <TableCell className="text-xs">{tipoIcon} {tipoLabel}</TableCell>
                                      <TableCell className="text-xs">{p.canal === "cardapioweb" ? "App" : "Manual"}</TableCell>
                                      <TableCell className="text-right text-xs font-medium">{fmt(Number(p.valor_total))}</TableCell>
                                      <TableCell className="text-right text-xs font-medium text-primary">{fmt(comissao)}</TableCell>
                                      <TableCell className="text-right text-xs">{p.cupons_gerados ?? 0}</TableCell>
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </TabsContent>

                    {/* ── Cupons ── */}
                    <TabsContent value="cupons" className="mt-0">
                      {drawerLoading ? (
                        <p className="text-sm text-muted-foreground text-center py-12">Carregando cupons...</p>
                      ) : drawerCupons.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-12">Nenhum cupom gerado neste período.</p>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-secondary rounded-lg p-4">
                              <p className="text-xs text-muted-foreground mb-1">Total de cupons</p>
                              <p className="text-xl font-bold">{drawerCupons.reduce((s, c) => s + (c.quantidade ?? 1), 0)}</p>
                            </div>
                            <div className="bg-secondary rounded-lg p-4">
                              <p className="text-xs text-muted-foreground mb-1">Utilizados</p>
                              <p className="text-xl font-bold text-emerald-400">{drawerCupons.filter(c => c.status === "utilizado").length}</p>
                            </div>
                            <div className="bg-secondary rounded-lg p-4">
                              <p className="text-xs text-muted-foreground mb-1">Disponíveis</p>
                              <p className="text-xl font-bold text-amber-400">{drawerCupons.filter(c => c.status !== "utilizado" && c.status !== "expirado").length}</p>
                            </div>
                          </div>

                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead className="text-right">Qtd</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Gerado em</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {drawerCupons.map(c => (
                                <TableRow key={c.id}>
                                  <TableCell className="text-xs font-mono text-muted-foreground">{c.id.slice(0, 8)}…</TableCell>
                                  <TableCell className="text-right text-xs">{c.quantidade ?? 1}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={
                                      c.status === "utilizado" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                                      c.status === "expirado"  ? "bg-muted text-muted-foreground" :
                                      "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                    }>{c.status}</Badge>
                                  </TableCell>
                                  <TableCell className="text-xs">{format(new Date(c.criado_em), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </TabsContent>

                    {/* ── Boleto & NFS-e ── */}
                    <TabsContent value="fiscal" className="mt-0 space-y-4">

                      {/* Boleto Asaas */}
                      <div className="space-y-2">
                        <p className="font-medium flex items-center gap-2">
                          <Landmark className="h-4 w-4 text-primary" /> Boleto Asaas
                        </p>
                        {detailDrawer.asaas_payment_id ? (
                          <div className="bg-secondary rounded-lg p-3 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">ID Asaas</span>
                              <span className="text-xs font-mono">{detailDrawer.asaas_payment_id}</span>
                            </div>
                            {detailDrawer.vencimento_boleto && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Vencimento</span>
                                <span className="text-xs font-medium">
                                  {format(new Date(detailDrawer.vencimento_boleto + "T12:00:00"), "dd/MM/yyyy")}
                                </span>
                              </div>
                            )}
                            {detailDrawer.boleto_linha_digitavel && (
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Linha digitável</p>
                                <div className="flex items-center gap-2">
                                  <code className="text-[10px] bg-background rounded px-2 py-1.5 flex-1 break-all leading-relaxed">
                                    {detailDrawer.boleto_linha_digitavel}
                                  </code>
                                  <Button
                                    variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                                    onClick={() => { navigator.clipboard.writeText(detailDrawer.boleto_linha_digitavel); toast.success("Linha digitável copiada!"); }}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            {detailDrawer.boleto_url && (
                              <Button variant="outline" size="sm" className="w-full gap-2 mt-1" asChild>
                                <a href={detailDrawer.boleto_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3.5 w-3.5" /> Abrir / baixar boleto
                                </a>
                              </Button>
                            )}
                          </div>
                        ) : detailDrawer.status !== "pago" && detailDrawer.status !== "cancelado" ? (
                          <div className="space-y-2">
                            {!pzCnpj(detailDrawer.pizzaria_id) && (
                              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
                                CNPJ não cadastrado nesta pizzaria. Acesse <strong>Pizzarias → {pzName(detailDrawer.pizzaria_id)} → Editar</strong> para adicioná-lo.
                              </p>
                            )}
                            <Button
                              size="sm" className="gap-2 w-full"
                              onClick={() => emitirBoleto(detailDrawer.id)}
                              disabled={gerandoBoleto || !pzCnpj(detailDrawer.pizzaria_id)}
                            >
                              <Landmark className="h-3.5 w-3.5" />
                              {gerandoBoleto ? "Emitindo boleto..." : "Emitir Boleto via Asaas"}
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Cobrança {detailDrawer.status} — boleto não foi emitido por esta via.
                          </p>
                        )}
                      </div>

                      {/* NFS-e Spedy */}
                      <div className="space-y-2">
                        <p className="font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" /> Nota Fiscal de Serviço (NFS-e)
                        </p>
                        {detailDrawer.spedy_order_id ? (
                          <div className="bg-secondary rounded-lg p-3 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Status</span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                detailDrawer.spedy_invoice_status === "authorized" ? "bg-emerald-500/20 text-emerald-400" :
                                detailDrawer.spedy_invoice_status === "rejected"   ? "bg-red-500/20 text-red-400" :
                                "bg-amber-500/20 text-amber-400"
                              }`}>
                                {detailDrawer.spedy_invoice_status === "authorized" ? "Autorizada" :
                                 detailDrawer.spedy_invoice_status === "rejected"   ? "Rejeitada"  : "Aguardando"}
                              </span>
                            </div>
                            {detailDrawer.spedy_invoice_error && (
                              <p className="text-[11px] text-red-400 bg-red-500/10 rounded px-2 py-1.5">
                                {detailDrawer.spedy_invoice_error}
                              </p>
                            )}
                            {detailDrawer.spedy_nfse_number && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Número NFS-e</span>
                                <span className="text-xs font-medium">{detailDrawer.spedy_nfse_number}</span>
                              </div>
                            )}
                            {detailDrawer.spedy_nfse_pdf_url ? (
                              <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                                <a href={detailDrawer.spedy_nfse_pdf_url} target="_blank" rel="noopener noreferrer">
                                  <Download className="h-3.5 w-3.5" /> Baixar NFS-e (PDF)
                                </a>
                              </Button>
                            ) : (
                              <Button
                                variant="outline" size="sm" className="w-full gap-2"
                                onClick={() => verificarNFSe(detailDrawer.id)}
                                disabled={verificandoNFSe}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                {verificandoNFSe ? "Verificando..." : detailDrawer.spedy_invoice_status === "rejected" ? "Tentar novamente" : "Verificar NFS-e"}
                              </Button>
                            )}
                          </div>
                        ) : detailDrawer.asaas_payment_id ? (
                          <div className="space-y-2">
                            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
                              Nota fiscal ainda não emitida para este boleto.
                            </p>
                            <Button
                              size="sm" variant="outline" className="gap-2 w-full"
                              onClick={() => emitirBoleto(detailDrawer.id)}
                              disabled={gerandoBoleto}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {gerandoBoleto ? "Emitindo NFS-e..." : "Emitir NFS-e agora"}
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            A NFS-e é gerada automaticamente ao emitir o boleto.
                          </p>
                        )}
                      </div>
                    </TabsContent>

                  </div>
                </ScrollArea>
              </Tabs>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border shrink-0 flex justify-between items-center gap-3">
                <div>
                  {detailDrawer.status !== "pago" && detailDrawer.status !== "cancelado" && (
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                      onClick={() => { setCancelId(detailDrawer.id); setDetailDrawer(null); }}>
                      <Ban className="h-3.5 w-3.5" /> Cancelar cobrança
                    </Button>
                  )}
                </div>
                <div className="flex-1 flex justify-center">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={exportRelatorioPDF}>
                    <FileDown className="h-3.5 w-3.5" /> Emitir Relatório
                  </Button>
                </div>
                <div>
                  {detailDrawer.status === "enviado" && (
                    <Button size="sm" className="gap-2"
                      onClick={() => { setPayModal(detailDrawer.id); setPayDate(new Date().toISOString().slice(0, 10)); setPayObs(""); }}>
                      <CheckCircle className="h-3.5 w-3.5" /> Marcar como pago
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
