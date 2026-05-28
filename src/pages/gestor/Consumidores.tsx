import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Users, UserCheck, Ticket, Crown, Search,
  Eye, X, Plus, MessageCircle, Gift,
  MapPin, Clock, BarChart2, Tag, Trophy,
  Download, FileSpreadsheet, FileText, List, Printer, RefreshCw,
} from "lucide-react";
import { format, startOfDay, endOfDay, subDays, startOfMonth, subMonths, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid } from "recharts";

const medalColors: Record<number, string> = {
  0: "bg-yellow-500 text-black",
  1: "bg-gray-400 text-black",
  2: "bg-amber-700 text-white",
};

const CHART_COLORS = [
  "hsl(25 95% 53%)",
  "hsl(38 92% 52%)",
  "hsl(14 88% 50%)",
  "hsl(50 90% 50%)",
  "hsl(5 82% 46%)",
  "hsl(55 88% 48%)",
  "hsl(350 78% 48%)",
];
import { usePizzarias } from "@/contexts/PizzariasContext";
import { useConsumidoresData, type ConsumidorData } from "@/hooks/useConsumidoresData";
import { BRASIL_ESTADOS, fetchCidadesDoEstado } from "@/lib/brasil";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// ─── PDF helpers ─────────────────────────────────────────────
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

function buildConsumidoresPdfHeader(doc: jsPDF, title: string, subtitle: string, letteringDataUrl?: string): number {
  const pageW = doc.internal.pageSize.getWidth();
  const HEADER_H = 62;

  doc.setFillColor(250, 250, 252);
  doc.rect(0, 0, pageW, HEADER_H, "F");

  // Lettering — alinhado à esquerda
  if (letteringDataUrl) {
    const imgH = 42; const imgW = imgH * 2.2;
    const imgY = (HEADER_H - imgH) / 2;
    doc.addImage(letteringDataUrl, "PNG", 20, imgY, imgW, imgH);
  }

  // Título + legenda — alinhados à direita
  const rightX = pageW - 20;
  doc.setTextColor(...C.slate900);
  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text(title, rightX, 28, { align: "right" });

  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.slate500);
  doc.text(`${subtitle}  ·  Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, rightX, 44, { align: "right" });

  // Linha divisória inferior
  doc.setDrawColor(...C.slate200); doc.setLineWidth(0.5);
  doc.line(20, HEADER_H + 2, pageW - 20, HEADER_H + 2);
  return HEADER_H + 14;
}

function addConsumidoresPdfFooter(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.slate200); doc.setLineWidth(0.5);
    doc.line(20, pageH - 20, pageW - 20, pageH - 20);
    doc.setFontSize(7); doc.setTextColor(...C.slate500);
    doc.text("Relatório de Consumidores — Pizza Premiada", 20, pageH - 9);
    doc.text(`Página ${i} de ${total}`, pageW / 2, pageH - 9, { align: "center" });
    doc.text(format(new Date(), "dd/MM/yyyy"), pageW - 20, pageH - 9, { align: "right" });
  }
}

function drawConsumidoresSectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFillColor(...C.orange);
  doc.rect(20, y, 2, 10, "F");
  doc.setTextColor(...C.slate900);
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text(text, 27, y + 8);
  return y + 18;
}

function generateVoucherCode(): string {
  return "PPV-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

interface VoucherPdfData {
  tipo: string;
  codigo: string;
  descricao: string;
  validade: string | null;
  pizzariaNome: string | null;
}

function generateVoucherPdf(consumidorNome: string, v: VoucherPdfData): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const SIDEBAR_W = 28;
  const ORANGE: [number, number, number] = [249, 115, 22];
  const DARK: [number, number, number] = [15, 23, 42];
  const GRAY: [number, number, number] = [100, 116, 139];
  const LIGHT: [number, number, number] = [248, 250, 252];

  doc.setFillColor(...LIGHT);
  doc.rect(0, 0, W, H, "F");

  doc.setFillColor(...ORANGE);
  doc.rect(0, 0, SIDEBAR_W, H, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("VOUCHER DE PRÊMIO", SIDEBAR_W / 2, H / 2, { align: "center", angle: 90 });

  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text("PIZZA PREMIADA", SIDEBAR_W + 8, 10);

  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(consumidorNome, SIDEBAR_W + 8, 22);

  const tipoLabel: Record<string, string> = {
    pizza_gratis: "PIZZA GRÁTIS",
    desconto_percentual: "DESCONTO %",
    desconto_fixo: "DESCONTO R$",
    produto: "PRODUTO",
    brinde_especial: "BRINDE ESPECIAL",
  };
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...ORANGE);
  doc.text(tipoLabel[v.tipo] ?? v.tipo.toUpperCase(), SIDEBAR_W + 8, 30);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  const descLines = doc.splitTextToSize(v.descricao, W - SIDEBAR_W - 16);
  doc.text(descLines, SIDEBAR_W + 8, 40);

  let detailY = 82;
  if (v.validade) {
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`Válido até: ${v.validade}`, SIDEBAR_W + 8, detailY);
    detailY += 7;
  }
  if (v.pizzariaNome) {
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`Válido em: ${v.pizzariaNome}`, SIDEBAR_W + 8, detailY);
  }

  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.3);
  doc.line(SIDEBAR_W + 8, H - 38, W - 8, H - 38);

  const codeBoxX = SIDEBAR_W + 8;
  const codeBoxW = W - SIDEBAR_W - 16;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.8);
  doc.roundedRect(codeBoxX, H - 34, codeBoxW, 20, 2, 2, "FD");

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text("CÓDIGO DO VOUCHER", codeBoxX + codeBoxW / 2, H - 27, { align: "center" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(v.codigo, codeBoxX + codeBoxW / 2, H - 18, { align: "center" });

  doc.setFontSize(5.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy")} · Pizza Premiada`, W / 2, H - 3, { align: "center" });

  doc.save(`voucher-${v.codigo}.pdf`);
}

type Consumidor = ConsumidorData;

type SortKey = "cupons" | "pedidos" | "gasto" | "recente";
type QuickPeriod = "hoje" | "7dias" | "30dias" | "este_mes" | "mes_anterior" | null;

function getQuickRange(p: NonNullable<QuickPeriod>): [Date, Date] {
  const today = startOfDay(new Date());
  switch (p) {
    case "hoje": return [today, endOfDay(today)];
    case "7dias": return [subDays(today, 6), endOfDay(today)];
    case "30dias": return [subDays(today, 29), endOfDay(today)];
    case "este_mes": return [startOfMonth(today), endOfDay(today)];
    case "mes_anterior": {
      const prev = subMonths(today, 1);
      return [startOfMonth(prev), endOfDay(endOfMonth(prev))];
    }
  }
}

const QUICK_LABELS: Record<NonNullable<QuickPeriod>, string> = {
  hoje: "Hoje",
  "7dias": "7 dias",
  "30dias": "30 dias",
  este_mes: "Este mês",
  mes_anterior: "Mês anterior",
};

export default function Consumidores() {
  const navigate = useNavigate();
  const { pizzarias } = usePizzarias();
  const { data, loading: consumidoresLoading } = useConsumidoresData();

  // Filters — table
  const [searchText, setSearchText] = useState("");
  const [filterPizzaria, setFilterPizzaria] = useState("all");
  const [filterCidade, setFilterCidade] = useState("all");
  const [filterBairro, setFilterBairro] = useState("all");
  const [filterCuponsMin, setFilterCuponsMin] = useState("");
  const [filterCuponsMax, setFilterCuponsMax] = useState("");
  const [filterPedidosMin, setFilterPedidosMin] = useState("");
  const [filterPedidosMax, setFilterPedidosMax] = useState("");
  const [filterTicketMin, setFilterTicketMin] = useState("");
  const [filterTicketMax, setFilterTicketMax] = useState("");
  const [filterStatus, setFilterStatus] = useState("Ativo");

  // Table
  const [sortKey, setSortKey] = useState<SortKey>("cupons");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);

  // Premio Top Ganhador
  const [premioOpen, setPremioOpen] = useState(false);
  const [premioConsumidor, setPremioConsumidor] = useState<{ id: string; nome: string; telefone: string; cupons: number } | null>(null);
  const [premioTab, setPremioTab] = useState<"cupons" | "brinde" | "whatsapp">("cupons");
  const [premioQtd, setPremioQtd] = useState("1");
  const [premioMotivo, setPremioMotivo] = useState("");
  const [premioCuponsLoading, setPremioCuponsLoading] = useState(false);
  const [premioBrindeLoading, setPremioBrindeLoading] = useState(false);
  // Voucher fields
  const [voucherTipo, setVoucherTipo] = useState<"pizza_gratis"|"desconto_percentual"|"desconto_fixo"|"produto"|"brinde_especial">("pizza_gratis");
  const [voucherPizzariaSelecionada, setVoucherPizzariaSelecionada] = useState("");
  const [voucherValidade, setVoucherValidade] = useState("");
  const [voucherCodigo, setVoucherCodigo] = useState("");
  const [voucherMotivo, setVoucherMotivo] = useState("");
  const [voucherObs, setVoucherObs] = useState("");
  const [pizzaTamanho, setPizzaTamanho] = useState("");
  const [pizzaSaborObs, setPizzaSaborObs] = useState("");
  const [descontoPercentual, setDescontoPercentual] = useState("");
  const [pedidoMinimoPerc, setPedidoMinimoPerc] = useState("");
  const [descontoValor, setDescontoValor] = useState("");
  const [pedidoMinimoFixo, setPedidoMinimoFixo] = useState("");
  const [produtoNome, setProdutoNome] = useState("");
  const [produtoLocalRetirada, setProdutoLocalRetirada] = useState("");
  const [brindeDescricao, setBrindeDescricao] = useState("");
  const [premioMsg, setPremioMsg] = useState("");
  const [premioWaLoading, setPremioWaLoading] = useState(false);

  // Add consumer modal
  const [addOpen, setAddOpen] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newCpf, setNewCpf] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newTelefone, setNewTelefone] = useState("");
  const [newCidade, setNewCidade] = useState("");
  const [newBairro, setNewBairro] = useState("");
  const [newPizzaria, setNewPizzaria] = useState("");
  const [newSenha, setNewSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [sendBoasVindas, setSendBoasVindas] = useState(true);
  const [newGenero, setNewGenero] = useState("");
  const [newDataNascimento, setNewDataNascimento] = useState("");
  const [newAceitaWhatsapp, setNewAceitaWhatsapp] = useState(true);
  const [newEstado, setNewEstado] = useState("");
  const [addCidades, setAddCidades] = useState<string[]>([]);
  const [addCidadesLoading, setAddCidadesLoading] = useState(false);

  // Chart period
  const [chartQuick, setChartQuick] = useState<QuickPeriod>("este_mes");
  const [chartFrom, setChartFrom] = useState<Date>(startOfMonth(new Date()));
  const [chartTo, setChartTo] = useState<Date>(endOfDay(new Date()));
  const [chartCustomFromStr, setChartCustomFromStr] = useState("");
  const [chartCustomToStr, setChartCustomToStr] = useState("");

  const selectChartQuick = (p: NonNullable<QuickPeriod>) => {
    setChartQuick(p);
    const [f, t] = getQuickRange(p);
    setChartFrom(f); setChartTo(t);
    setChartCustomFromStr(format(f, "yyyy-MM-dd"));
    setChartCustomToStr(format(t, "yyyy-MM-dd"));
  };
  const applyChartCustom = () => {
    if (chartCustomFromStr && chartCustomToStr) {
      setChartQuick(null);
      setChartFrom(startOfDay(new Date(chartCustomFromStr + "T00:00:00")));
      setChartTo(endOfDay(new Date(chartCustomToStr + "T00:00:00")));
    }
  };

  // Derived: cities / bairros — filter(Boolean) prevents empty-string SelectItem crash
  const cidades = useMemo(() => [...new Set(data.map((c) => c.cidade).filter(Boolean))].sort(), [data]);
  const bairros = useMemo(() => {
    const base = filterCidade === "all" ? data : data.filter((c) => c.cidade === filterCidade);
    return [...new Set(base.map((c) => c.bairro).filter(Boolean))].sort();
  }, [data, filterCidade]);

  // Active filter flags
  const isLocalizacaoActive = filterPizzaria !== "all" || filterCidade !== "all" || filterBairro !== "all";
  const localizacaoCount = (filterPizzaria !== "all" ? 1 : 0) + (filterCidade !== "all" ? 1 : 0) + (filterBairro !== "all" ? 1 : 0);
  const isMetricasActive = !!(filterCuponsMin || filterCuponsMax || filterPedidosMin || filterPedidosMax || filterTicketMin || filterTicketMax);
  const metricasCount = [filterCuponsMin, filterCuponsMax, filterPedidosMin, filterPedidosMax, filterTicketMin, filterTicketMax].filter(Boolean).length;
  const hasActiveFilters = isLocalizacaoActive || isMetricasActive || filterStatus !== "Ativo";

  // Apply filters
  const filtered = useMemo(() => {
    let list = [...data];
    if (searchText) {
      const q = searchText.toLowerCase();
      list = list.filter((c) =>
        c.nome.toLowerCase().includes(q) ||
        c.cpf.includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.telefone.includes(q)
      );
    }
    if (filterPizzaria !== "all") list = list.filter((c) => c.pizzariaVinculadaId === filterPizzaria);
    if (filterCidade !== "all") list = list.filter((c) => c.cidade === filterCidade);
    if (filterBairro !== "all") list = list.filter((c) => c.bairro === filterBairro);
    if (filterCuponsMin) list = list.filter((c) => c.cuponsAcumulados >= Number(filterCuponsMin));
    if (filterCuponsMax) list = list.filter((c) => c.cuponsAcumulados <= Number(filterCuponsMax));
    if (filterPedidosMin) list = list.filter((c) => c.totalPedidos >= Number(filterPedidosMin));
    if (filterPedidosMax) list = list.filter((c) => c.totalPedidos <= Number(filterPedidosMax));
    if (filterTicketMin) list = list.filter((c) => c.ticketMedio >= Number(filterTicketMin));
    if (filterTicketMax) list = list.filter((c) => c.ticketMedio <= Number(filterTicketMax));
    if (filterStatus !== "Todos") list = list.filter((c) => c.status === filterStatus);
    return list;
  }, [data, searchText, filterPizzaria, filterCidade, filterBairro, filterCuponsMin, filterCuponsMax, filterPedidosMin, filterPedidosMax, filterTicketMin, filterTicketMax, filterStatus]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortKey) {
      case "cupons": return arr.sort((a, b) => b.cuponsAcumulados - a.cuponsAcumulados);
      case "pedidos": return arr.sort((a, b) => b.totalPedidos - a.totalPedidos);
      case "gasto": return arr.sort((a, b) => b.totalGasto - a.totalGasto);
      case "recente": return arr.sort((a, b) => b.dataCadastro.getTime() - a.dataCadastro.getTime());
    }
  }, [filtered, sortKey]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const paged = sorted.slice((page - 1) * perPage, page * perPage);

  const clearFilters = () => {
    setSearchText(""); setFilterPizzaria("all"); setFilterCidade("all"); setFilterBairro("all");
    setFilterCuponsMin(""); setFilterCuponsMax("");
    setFilterPedidosMin(""); setFilterPedidosMax("");
    setFilterTicketMin(""); setFilterTicketMax("");
    setFilterStatus("Ativo"); setPage(1);
  };

  // KPI cards
  const totalConsumidores = data.length;
  const ativos = data.filter((c) => c.status === "Ativo").length;
  const mediaCupons = totalConsumidores > 0 ? (data.reduce((s, c) => s + c.cuponsAcumulados, 0) / totalConsumidores).toFixed(1) : "0";
  const topConsumidor = useMemo(() => {
    if (data.length === 0) return null;
    return [...data].sort((a, b) => b.cuponsAcumulados - a.cuponsAcumulados)[0];
  }, [data]);

  // Ranking position helper
  const rankingSorteio = useMemo(() => {
    return [...data].sort((a, b) => b.cuponsAcumulados - a.cuponsAcumulados);
  }, [data]);

  const getRankingPosition = (id: string) => {
    const idx = rankingSorteio.findIndex((c) => c.id === id);
    return idx >= 0 ? idx + 1 : null;
  };

  // Chart data — novos consumidores por dia
  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: startOfDay(chartFrom), end: endOfDay(chartTo) });
    return days.map((day) => ({
      label: format(day, "dd/MM"),
      novos: data.filter((c) => isSameDay(c.dataCadastro, day)).length,
    }));
  }, [data, chartFrom, chartTo]);

  // Top 10 consumidores por cupons
  const topConsumidoresData = useMemo(() =>
    [...data].sort((a, b) => b.cuponsAcumulados - a.cuponsAcumulados)
      .slice(0, 10)
      .map((c) => ({
        id: c.id,
        nome: c.nome.split(" ")[0],
        nomeCompleto: c.nome,
        telefone: c.telefone,
        cupons: c.cuponsAcumulados,
        gasto: c.totalGasto,
      })),
    [data]
  );

  const handlePremioCupons = async () => {
    if (!premioConsumidor) return;
    const qtd = parseInt(premioQtd);
    if (!qtd || qtd < 1) return;
    setPremioCuponsLoading(true);
    const { error } = await supabase.from("cupons_bonus").insert({
      consumidor_id: premioConsumidor.id,
      quantidade: qtd,
      motivo: premioMotivo.trim() || "Top ganhador — prêmio especial",
      tipo: "top_ganhador",
      status: "validado",
    });
    setPremioCuponsLoading(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Cupons adicionados!", description: `${qtd} cupom(ns) bônus para ${premioConsumidor.nome}.` });
    setPremioQtd("1"); setPremioMotivo("");
  };

  const resetVoucherForm = () => {
    setVoucherTipo("pizza_gratis");
    setVoucherPizzariaSelecionada("");
    setVoucherValidade("");
    setVoucherCodigo(generateVoucherCode());
    setVoucherMotivo("");
    setVoucherObs("");
    setPizzaTamanho("");
    setPizzaSaborObs("");
    setDescontoPercentual("");
    setPedidoMinimoPerc("");
    setDescontoValor("");
    setPedidoMinimoFixo("");
    setProdutoNome("");
    setProdutoLocalRetirada("");
    setBrindeDescricao("");
  };

  const handleSaveVoucher = async (withPdf: boolean) => {
    if (!premioConsumidor) return;

    if (voucherTipo === "pizza_gratis" && !pizzaTamanho) {
      toast({ title: "Informe o tamanho da pizza", variant: "destructive" }); return;
    }
    if (voucherTipo === "desconto_percentual" && !descontoPercentual) {
      toast({ title: "Informe o percentual de desconto", variant: "destructive" }); return;
    }
    if (voucherTipo === "desconto_fixo" && !descontoValor) {
      toast({ title: "Informe o valor do desconto", variant: "destructive" }); return;
    }
    if (voucherTipo === "produto" && !produtoNome) {
      toast({ title: "Informe o nome do produto", variant: "destructive" }); return;
    }
    if (voucherTipo === "brinde_especial" && !brindeDescricao) {
      toast({ title: "Informe a descrição do brinde", variant: "destructive" }); return;
    }
    if (!voucherCodigo) {
      toast({ title: "Código do voucher não gerado", variant: "destructive" }); return;
    }

    let descricao = "";
    if (voucherTipo === "pizza_gratis") {
      descricao = `Pizza Grátis — ${pizzaTamanho}${pizzaSaborObs ? ` (${pizzaSaborObs})` : ""}`;
    } else if (voucherTipo === "desconto_percentual") {
      descricao = `${descontoPercentual}% de desconto${pedidoMinimoPerc ? ` em pedidos acima de R$${pedidoMinimoPerc}` : ""}`;
    } else if (voucherTipo === "desconto_fixo") {
      descricao = `R$${descontoValor} de desconto${pedidoMinimoFixo ? ` em pedidos acima de R$${pedidoMinimoFixo}` : ""}`;
    } else if (voucherTipo === "produto") {
      descricao = `${produtoNome}${produtoLocalRetirada ? ` — Retirada: ${produtoLocalRetirada}` : ""}`;
    } else {
      descricao = brindeDescricao;
    }

    const pizzariaSel = pizzarias.find(p => p.id === voucherPizzariaSelecionada);

    setPremioBrindeLoading(true);
    const { error } = await supabase.from("vouchers_premiacao").insert({
      consumidor_id: premioConsumidor.id,
      tipo: voucherTipo,
      codigo: voucherCodigo,
      descricao,
      pizza_tamanho: voucherTipo === "pizza_gratis" ? pizzaTamanho : null,
      pizza_sabor_obs: voucherTipo === "pizza_gratis" ? pizzaSaborObs || null : null,
      percentual_desconto: voucherTipo === "desconto_percentual" ? Number(descontoPercentual) : null,
      valor_desconto: voucherTipo === "desconto_fixo" ? Number(descontoValor) : null,
      valor_minimo_pedido: voucherTipo === "desconto_percentual"
        ? (pedidoMinimoPerc ? Number(pedidoMinimoPerc) : null)
        : voucherTipo === "desconto_fixo"
          ? (pedidoMinimoFixo ? Number(pedidoMinimoFixo) : null)
          : null,
      produto_local_retirada: voucherTipo === "produto" ? (produtoLocalRetirada || null) : null,
      pizzaria_id: voucherPizzariaSelecionada || null,
      validade: voucherValidade || null,
      observacoes: voucherObs || null,
      motivo: voucherMotivo || "Top ganhador — prêmio especial",
      status: "ativo",
    });
    setPremioBrindeLoading(false);

    if (error) { toast({ title: "Erro ao salvar voucher", description: error.message, variant: "destructive" }); return; }

    if (withPdf) {
      generateVoucherPdf(premioConsumidor.nome, {
        tipo: voucherTipo,
        codigo: voucherCodigo,
        descricao,
        validade: voucherValidade || null,
        pizzariaNome: pizzariaSel?.nome ?? null,
      });
    }

    toast({ title: "Voucher emitido!", description: `${descricao} para ${premioConsumidor.nome}.` });
    resetVoucherForm();
  };

  const handlePremioWhatsapp = async () => {
    if (!premioConsumidor || !premioMsg.trim()) return;
    setPremioWaLoading(true);
    const msg = premioMsg
      .replace(/\{nome\}/g, premioConsumidor.nome)
      .replace(/\{cupons\}/g, String(premioConsumidor.cupons));
    const { error } = await supabase.from("disparos_whatsapp").insert({
      consumidor_id: premioConsumidor.id,
      mensagem: msg,
      tipo: "premio_top",
      status: "enviado",
    });
    setPremioWaLoading(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Mensagem enviada!", description: `Mensagem de premiação para ${premioConsumidor.nome}.` });
    setPremioMsg("");
  };

  // Frequência de compras — segmentação por intervalo médio
  const frequenciaData = useMemo(() => {
    const segments = [
      { name: "Sem compras", color: CHART_COLORS[4], filter: (c: ConsumidorData) => c.totalPedidos === 0 },
      { name: "Pedido único", color: CHART_COLORS[2], filter: (c: ConsumidorData) => c.totalPedidos === 1 },
      { name: "Semanal", color: CHART_COLORS[3], filter: (c: ConsumidorData) => c.intervaloMedio > 0 && c.intervaloMedio <= 10 },
      { name: "Quinzenal", color: CHART_COLORS[1], filter: (c: ConsumidorData) => c.intervaloMedio > 10 && c.intervaloMedio <= 20 },
      { name: "Mensal", color: CHART_COLORS[0], filter: (c: ConsumidorData) => c.intervaloMedio > 20 && c.intervaloMedio <= 40 },
      { name: "Bimestral", color: CHART_COLORS[5], filter: (c: ConsumidorData) => c.intervaloMedio > 40 && c.intervaloMedio <= 90 },
      { name: "Esporádico", color: CHART_COLORS[6], filter: (c: ConsumidorData) => c.intervaloMedio > 90 },
    ];
    return segments
      .map(s => ({ name: s.name, color: s.color, count: data.filter(s.filter).length }))
      .filter(s => s.count > 0);
  }, [data]);

  // Distribuição por cidade (top 7)
  const cidadeDistData = useMemo(() => {
    const map = new Map<string, number>();
    data.filter((c) => c.cidade).forEach((c) => map.set(c.cidade, (map.get(c.cidade) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([cidade, count]) => ({ cidade, count }));
  }, [data]);

  const resetAddForm = () => {
    setNewNome(""); setNewCpf(""); setNewEmail(""); setNewTelefone("");
    setNewCidade(""); setNewBairro(""); setNewPizzaria(""); setNewSenha("");
    setShowSenha(false); setSendBoasVindas(true);
    setNewGenero(""); setNewDataNascimento(""); setNewAceitaWhatsapp(true);
    setNewEstado(""); setAddCidades([]);
  };

  const chartPeriodLabel = chartQuick ? QUICK_LABELS[chartQuick] : `${format(chartFrom, "dd/MM/yyyy")} – ${format(chartTo, "dd/MM/yyyy")}`;

  const buildActiveFiltersText = () => {
    const parts: string[] = [];
    if (searchText) parts.push(`Busca: "${searchText}"`);
    if (filterStatus !== "Todos") parts.push(`Status: ${filterStatus === "Ativo" ? "Ativos" : "Inativos"}`);
    if (filterPizzaria !== "all") {
      const p = pizzarias.find(x => x.id === filterPizzaria);
      parts.push(`Pizzaria: ${p?.nome ?? filterPizzaria}`);
    }
    if (filterCidade !== "all") parts.push(`Cidade: ${filterCidade}`);
    if (filterBairro !== "all") parts.push(`Bairro: ${filterBairro}`);
    if (filterCuponsMin || filterCuponsMax) parts.push(`Cupons: ${filterCuponsMin || "0"} – ${filterCuponsMax || "∞"}`);
    if (filterPedidosMin || filterPedidosMax) parts.push(`Pedidos: ${filterPedidosMin || "0"} – ${filterPedidosMax || "∞"}`);
    if (filterTicketMin || filterTicketMax) parts.push(`Ticket R$: ${filterTicketMin || "0"} – ${filterTicketMax || "∞"}`);
    return parts.length > 0 ? `Filtros ativos: ${parts.join("  |  ")}` : "Todos os consumidores (sem filtros)";
  };

  // Fetch cities from IBGE when estado changes in add form
  const handleNewEstado = async (uf: string) => {
    setNewEstado(uf);
    setNewCidade("");
    setAddCidades([]);
    if (!uf) return;
    setAddCidadesLoading(true);
    const cids = await fetchCidadesDoEstado(uf);
    setAddCidades(cids);
    setAddCidadesLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="font-heading text-2xl font-bold">Consumidores</h1>

      {/* BLOCO 1 — KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cadastrados</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-heading font-bold">{totalConsumidores}</div></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ativos no Ciclo</CardTitle>
            <UserCheck className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-heading font-bold">{ativos}</div></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Média de Cupons</CardTitle>
            <Ticket className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-heading font-bold">{mediaCupons}</div></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mais Cupons</CardTitle>
            <Crown className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-heading font-bold">{topConsumidor?.nome ?? "-"}</div>
            <p className="text-xs text-muted-foreground">{topConsumidor ? `${topConsumidor.cuponsAcumulados} cupons` : ""}</p>
          </CardContent>
        </Card>
      </div>

      {/* BLOCO 3 — Table */}
      <Card className="border-border bg-card">
        <CardHeader className="py-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Left: title + count */}
            <CardTitle className="text-base font-heading shrink-0">Lista de Consumidores</CardTitle>
            <span className="text-xs text-muted-foreground shrink-0">
              {sorted.length === data.length ? data.length : `${sorted.length} / ${data.length}`}
            </span>
            {/* Right: search + filters + controls + actions */}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Buscar..." className="pl-8 h-8 text-xs w-44" value={searchText} onChange={(e) => { setSearchText(e.target.value); setPage(1); }} />
              </div>
              <div className="w-px h-5 bg-border mx-0.5" />
              {/* Localização */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={isLocalizacaoActive ? "default" : "outline"} size="sm" className="h-8 text-xs gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {isLocalizacaoActive ? `${localizacaoCount} local` : "Localização"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3 space-y-3" align="end">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Pizzaria</label>
                    <Select value={filterPizzaria} onValueChange={(v) => { setFilterPizzaria(v); setPage(1); }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {pizzarias.filter((p) => p.status === "Ativa").map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Cidade</label>
                    <Select value={filterCidade} onValueChange={(v) => { setFilterCidade(v); setFilterBairro("all"); setPage(1); }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {cidades.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Bairro</label>
                    <Select value={filterBairro} onValueChange={(v) => { setFilterBairro(v); setPage(1); }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {bairros.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Métricas */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={isMetricasActive ? "default" : "outline"} size="sm" className="h-8 text-xs gap-1.5">
                    <BarChart2 className="h-3.5 w-3.5" />
                    {isMetricasActive ? `${metricasCount} métrica(s)` : "Métricas"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-3 space-y-3" align="end">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Cupons (min – máx)</label>
                    <div className="flex gap-1">
                      <Input type="number" placeholder="Min" className="h-8 text-xs" value={filterCuponsMin} onChange={(e) => { setFilterCuponsMin(e.target.value); setPage(1); }} />
                      <Input type="number" placeholder="Máx" className="h-8 text-xs" value={filterCuponsMax} onChange={(e) => { setFilterCuponsMax(e.target.value); setPage(1); }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Pedidos (min – máx)</label>
                    <div className="flex gap-1">
                      <Input type="number" placeholder="Min" className="h-8 text-xs" value={filterPedidosMin} onChange={(e) => { setFilterPedidosMin(e.target.value); setPage(1); }} />
                      <Input type="number" placeholder="Máx" className="h-8 text-xs" value={filterPedidosMax} onChange={(e) => { setFilterPedidosMax(e.target.value); setPage(1); }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Ticket Médio R$ (min – máx)</label>
                    <div className="flex gap-1">
                      <Input type="number" placeholder="Min" className="h-8 text-xs" value={filterTicketMin} onChange={(e) => { setFilterTicketMin(e.target.value); setPage(1); }} />
                      <Input type="number" placeholder="Máx" className="h-8 text-xs" value={filterTicketMax} onChange={(e) => { setFilterTicketMax(e.target.value); setPage(1); }} />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Status */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={filterStatus !== "Ativo" ? "default" : "outline"} size="sm" className="h-8 text-xs gap-1.5">
                    <Tag className="h-3.5 w-3.5" />
                    {filterStatus === "Ativo" ? "Ativos" : filterStatus === "Inativo" ? "Inativos" : "Todos"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-40 p-2 space-y-0.5" align="end">
                  {(["Ativo", "Inativo", "Todos"] as const).map((s) => (
                    <Button key={s} variant={filterStatus === s ? "default" : "ghost"} size="sm" className="w-full justify-start text-xs h-8" onClick={() => { setFilterStatus(s); setPage(1); }}>
                      {s === "Ativo" ? "Ativos" : s === "Inativo" ? "Inativos" : "Todos"}
                    </Button>
                  ))}
                </PopoverContent>
              </Popover>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground gap-1" onClick={clearFilters}>
                  <X className="h-3.5 w-3.5" /> Limpar
                </Button>
              )}

              <div className="w-px h-5 bg-border mx-1" />

              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cupons">Mais cupons</SelectItem>
                  <SelectItem value="pedidos">Mais pedidos</SelectItem>
                  <SelectItem value="gasto">Maior gasto</SelectItem>
                  <SelectItem value="recente">Cadastro recente</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-8 w-[85px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 30, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} / pág</SelectItem>)}
                </SelectContent>
              </Select>

              <div className="w-px h-5 bg-border mx-0.5" />

              {/* Ações */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                    <Download className="h-3.5 w-3.5" /> Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wide px-2 py-1">Relatórios PDF</DropdownMenuLabel>
                  <DropdownMenuItem className="gap-2 text-xs" onClick={async () => {
                    const lettering = await loadLetteringDataUrl();
                    const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
                    const pageW = doc.internal.pageSize.getWidth();
                    const today = format(new Date(), "yyyy-MM-dd");
                    let y = buildConsumidoresPdfHeader(doc, "Relatório de Consumidores", "Sintético", lettering);
                    const sinteticoFilters = buildActiveFiltersText();
                    doc.setFontSize(7.5); doc.setFont("helvetica", "italic"); doc.setTextColor(...C.slate500);
                    doc.text(sinteticoFilters, 20, y); y += 13;
                    const kpis = [
                      { label: "Total Cadastrados", value: String(data.length) },
                      { label: "Ativos no Ciclo", value: String(data.filter(c => c.status === "Ativo").length) },
                      { label: "Média de Cupons", value: (data.length > 0 ? (data.reduce((s, c) => s + c.cuponsAcumulados, 0) / data.length) : 0).toFixed(1) },
                      { label: "Total de Cupons", value: String(data.reduce((s, c) => s + c.cuponsAcumulados, 0)) },
                    ];
                    const gap = 8; const boxW = (pageW - 40 - gap * 3) / 4; const boxH = 60;
                    kpis.forEach((kpi, i) => {
                      const x = 20 + i * (boxW + gap);
                      doc.setFillColor(...C.white); doc.setDrawColor(...C.slate200); doc.setLineWidth(0.6);
                      doc.roundedRect(x, y, boxW, boxH, 4, 4, "FD");
                      doc.setFillColor(...C.orange); doc.rect(x, y, boxW, 2.5, "F");
                      doc.setTextColor(...C.slate500); doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
                      doc.text(kpi.label, x + boxW / 2, y + 16, { align: "center" });
                      doc.setTextColor(...C.slate900); doc.setFontSize(16); doc.setFont("helvetica", "bold");
                      doc.text(kpi.value, x + boxW / 2, y + 44, { align: "center" });
                    });
                    y += boxH + 24;
                    y = drawConsumidoresSectionTitle(doc, `Lista de Consumidores (${sorted.length})`, y);
                    autoTable(doc, {
                      head: [["#", "Nome", "Pedidos", "Cupons", "Total Gasto"]],
                      body: sorted.map((c, i) => [
                        String(i + 1),
                        c.nome,
                        String(c.totalPedidos),
                        String(c.cuponsAcumulados),
                        `R$ ${c.totalGasto.toLocaleString("pt-BR")}`,
                      ]),
                      startY: y, ...TABLE_STYLES,
                      columnStyles: {
                        4: { halign: "right" as const },
                      },
                    });
                    addConsumidoresPdfFooter(doc);
                    doc.save(`consumidores-sintetico-${today}.pdf`);
                  }}>
                    <BarChart2 className="h-3.5 w-3.5" /> Relatório Sintético
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-xs" onClick={async () => {
                    const lettering = await loadLetteringDataUrl();
                    const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
                    const today = format(new Date(), "yyyy-MM-dd");
                    let y = buildConsumidoresPdfHeader(doc, "Relatório de Consumidores", "Analítico — Lista Completa", lettering);
                    const analiticoFilters = buildActiveFiltersText();
                    doc.setFontSize(7.5); doc.setFont("helvetica", "italic"); doc.setTextColor(...C.slate500);
                    doc.text(analiticoFilters, 20, y); y += 13;
                    autoTable(doc, {
                      head: [["#", "Data Cadastro", "Nome", "CPF", "Telefone", "E-mail", "Cidade", "Estado", "Pedidos", "Cupons", "Frequência", "Total Gasto"]],
                      body: sorted.map((c, i) => [
                        String(i + 1),
                        format(c.dataCadastro, "dd/MM/yyyy"),
                        c.nome, c.cpf, c.telefone, c.email,
                        c.cidade || "—", c.estado || "—",
                        String(c.totalPedidos),
                        String(c.cuponsAcumulados),
                        c.intervaloMedio > 0 ? `${c.intervaloMedio}d` : "—",
                        `R$ ${c.totalGasto.toLocaleString("pt-BR")}`,
                      ]),
                      startY: y,
                      headStyles: { fillColor: C.slate900, textColor: C.white, fontStyle: "bold", fontSize: 7, cellPadding: 5 },
                      alternateRowStyles: { fillColor: C.slate50 },
                      bodyStyles: { fontSize: 6.5, textColor: C.slate700, cellPadding: 4 },
                      styles: { lineColor: C.slate200, lineWidth: 0.4 },
                      margin: { left: 20, right: 20, bottom: 28 },
                      columnStyles: {
                        11: { halign: "right" as const },
                      },
                    });
                    addConsumidoresPdfFooter(doc);
                    doc.save(`consumidores-analitico-${today}.pdf`);
                  }}>
                    <List className="h-3.5 w-3.5" /> Relatório Analítico
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-xs" onClick={async () => {
                    const lettering = await loadLetteringDataUrl();
                    const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
                    const today = format(new Date(), "yyyy-MM-dd");
                    let y = buildConsumidoresPdfHeader(doc, "Relatório de Consumidores", "Por Grupo — Localização & Pizzaria", lettering);
                    const grupoFilters = buildActiveFiltersText();
                    doc.setFontSize(7.5); doc.setFont("helvetica", "italic"); doc.setTextColor(...C.slate500);
                    doc.text(grupoFilters, 20, y); y += 13;

                    // ── Seção 1: Por Estado / Cidade ─────────────────────────
                    y = drawConsumidoresSectionTitle(doc, "Por Localizacao - Estado e Cidade", y);

                    // Agrupa por estado → cidade
                    const byEstado = new Map<string, Map<string, ConsumidorData[]>>();
                    data.forEach(c => {
                      const est = c.estado || "Não informado";
                      const cid = c.cidade || "Não informada";
                      if (!byEstado.has(est)) byEstado.set(est, new Map());
                      const byCidade = byEstado.get(est)!;
                      if (!byCidade.has(cid)) byCidade.set(cid, []);
                      byCidade.get(cid)!.push(c);
                    });

                    const locRows: (string | number)[][] = [];
                    const summaryRowIndices = new Set<number>();
                    [...byEstado.entries()]
                      .sort(([a], [b]) => a.localeCompare(b))
                      .forEach(([estado, cidadeMap]) => {
                        const estadoConsumidores = [...cidadeMap.values()].flat();
                        summaryRowIndices.add(locRows.length);
                        locRows.push([
                          estado, "Total do estado",
                          estadoConsumidores.length,
                          estadoConsumidores.reduce((s, c) => s + c.totalPedidos, 0),
                          estadoConsumidores.reduce((s, c) => s + c.cuponsAcumulados, 0),
                          `R$ ${estadoConsumidores.reduce((s, c) => s + c.totalGasto, 0).toLocaleString("pt-BR")}`,
                        ]);
                        [...cidadeMap.entries()]
                          .sort(([a], [b]) => a.localeCompare(b))
                          .forEach(([cidade, consumidores]) => {
                            locRows.push([
                              "", `   ${cidade}`,
                              consumidores.length,
                              consumidores.reduce((s, c) => s + c.totalPedidos, 0),
                              consumidores.reduce((s, c) => s + c.cuponsAcumulados, 0),
                              `R$ ${consumidores.reduce((s, c) => s + c.totalGasto, 0).toLocaleString("pt-BR")}`,
                            ]);
                          });
                      });

                    autoTable(doc, {
                      head: [["Estado", "Cidade / Subtotal", "Clientes", "Pedidos", "Cupons", "Total Gasto"]],
                      body: locRows,
                      startY: y,
                      ...TABLE_STYLES,
                      columnStyles: {
                        2: { halign: "center" as const },
                        3: { halign: "center" as const },
                        4: { halign: "center" as const },
                        5: { halign: "right" as const },
                      },
                      didParseCell: (hookData: any) => {
                        if (hookData.row.section === "body" && summaryRowIndices.has(hookData.row.index)) {
                          hookData.cell.styles.fontStyle = "bold";
                          hookData.cell.styles.fillColor = C.slate200;
                          hookData.cell.styles.textColor = C.slate900;
                        }
                      },
                    });

                    // ── Seção 2: Por Pizzaria (baseado nos pedidos) ───────────
                    const afterLocY = (doc as any).lastAutoTable.finalY + 20;
                    y = drawConsumidoresSectionTitle(doc, "Por Pizzaria", afterLocY);

                    // Agrega por pizzaria a partir dos pedidos de cada consumidor
                    type PizzariaAgg = { clientesIds: Set<string>; pedidos: number; cupons: number; gasto: number };
                    const byPizzaria = new Map<string, PizzariaAgg>();
                    data.forEach(c => {
                      c.pedidos.forEach(p => {
                        const nome = p.pizzariaNome || "Sem identificação";
                        if (!byPizzaria.has(nome)) byPizzaria.set(nome, { clientesIds: new Set(), pedidos: 0, cupons: 0, gasto: 0 });
                        const agg = byPizzaria.get(nome)!;
                        agg.clientesIds.add(c.id);
                        agg.pedidos += 1;
                        agg.cupons += p.cuponsGerados;
                        agg.gasto += p.valor;
                      });
                    });

                    const totalPedidosGeral = data.reduce((s, c) => s + c.totalPedidos, 0);
                    const pizzariaRows = [...byPizzaria.entries()]
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([nome, agg]) => {
                        const pct = totalPedidosGeral > 0 ? ((agg.pedidos / totalPedidosGeral) * 100).toFixed(1) + "%" : "0%";
                        return [nome, agg.clientesIds.size, agg.pedidos, pct, agg.cupons, `R$ ${agg.gasto.toLocaleString("pt-BR")}`];
                      });

                    autoTable(doc, {
                      head: [["Pizzaria", "Clientes", "Pedidos", "% Pedidos", "Cupons", "Total Gasto"]],
                      body: pizzariaRows,
                      startY: y,
                      ...TABLE_STYLES,
                      columnStyles: {
                        1: { halign: "center" as const },
                        2: { halign: "center" as const },
                        3: { halign: "center" as const },
                        4: { halign: "center" as const },
                        5: { halign: "right" as const },
                      },
                    });

                    addConsumidoresPdfFooter(doc);
                    doc.save(`consumidores-por-grupo-${today}.pdf`);
                  }}>
                    <MapPin className="h-3.5 w-3.5" /> Relatório por Grupo
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wide px-2 py-1">Dados</DropdownMenuLabel>
                  <DropdownMenuItem className="gap-2 text-xs" onClick={() => {
                    const today = format(new Date(), "yyyy-MM-dd");
                    const wb = XLSX.utils.book_new();
                    const ws = XLSX.utils.aoa_to_sheet([
                      [buildActiveFiltersText()],
                      [`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
                      [],
                      ["Nome", "Telefone", "E-mail", "CPF", "Cidade", "Bairro", "Pizzaria", "Pedidos", "Total Gasto", "Cupons", "Saldo Acumulado", "Falta Próx. Cupom", "Dias s/ Pedido", "Frequência", "Data Cadastro", "Status"],
                      ...sorted.map(c => [
                        c.nome, c.telefone, c.email, c.cpf, c.cidade, c.bairro, c.pizzariaVinculadaNome,
                        c.totalPedidos, c.totalGasto, c.cuponsAcumulados,
                        c.saldoAcumulado, c.faltaProximoCupom,
                        c.diasDesdeUltimoPedido !== null ? c.diasDesdeUltimoPedido : "",
                        c.intervaloMedio > 0 ? c.intervaloMedio : "",
                        format(c.dataCadastro, "dd/MM/yyyy"), c.status,
                      ]),
                    ]);
                    XLSX.utils.book_append_sheet(wb, ws, "Consumidores");
                    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
                    const url = URL.createObjectURL(new Blob([buf], { type: "application/octet-stream" }));
                    const a = document.createElement("a"); a.href = url; a.download = `consumidores-${today}.xlsx`; a.click(); URL.revokeObjectURL(url);
                  }}>
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-xs" onClick={() => {
                    const today = format(new Date(), "yyyy-MM-dd");
                    const csvFilterMeta = `"${buildActiveFiltersText()}"`;
                    const csvDateMeta = `"Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}"`;
                    const header = "Nome,Telefone,E-mail,CPF,Cidade,Bairro,Pizzaria,Pedidos,Total Gasto,Cupons,Saldo Acumulado,Falta Próx. Cupom,Dias s/ Pedido,Frequência,Data Cadastro,Status";
                    const rows = sorted.map(c => {
                      const vals = [
                        c.nome, c.telefone, c.email, c.cpf, c.cidade, c.bairro, c.pizzariaVinculadaNome || "",
                        String(c.totalPedidos), String(c.totalGasto), String(c.cuponsAcumulados),
                        c.saldoAcumulado.toFixed(2), c.faltaProximoCupom.toFixed(2),
                        c.diasDesdeUltimoPedido !== null ? String(c.diasDesdeUltimoPedido) : "",
                        c.intervaloMedio > 0 ? String(c.intervaloMedio) : "",
                        format(c.dataCadastro, "dd/MM/yyyy"), c.status,
                      ];
                      return vals.map(v => v.includes(",") ? `"${v}"` : v).join(",");
                    });
                    const csv = [csvFilterMeta, csvDateMeta, "", header, ...rows].join("\n");
                    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
                    const a = document.createElement("a"); a.href = url; a.download = `consumidores-${today}.csv`; a.click(); URL.revokeObjectURL(url);
                  }}>
                    <FileText className="h-3.5 w-3.5" /> CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" className="h-8 text-xs" onClick={() => { resetAddForm(); setAddOpen(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center w-[180px] min-w-[180px] max-w-[180px]">Nome</TableHead>
                  <TableHead className="text-center">Pedidos</TableHead>
                  <TableHead className="text-center">Ticket Médio</TableHead>
                  <TableHead className="text-center">Total Gasto</TableHead>
                  <TableHead className="text-center">Cupons</TableHead>
                  <TableHead className="text-center">Saldo</TableHead>
                  <TableHead className="text-center">Falta</TableHead>
                  <TableHead className="text-center">1º Pedido</TableHead>
                  <TableHead className="text-center">Último Pedido</TableHead>
                  <TableHead className="text-center">Dias s/ Pedido</TableHead>
                  <TableHead className="text-center">Frequência</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-center w-[180px] min-w-[180px] max-w-[180px]"><span className="block truncate">{c.nome}</span></TableCell>
                    <TableCell className="text-center">{c.totalPedidos}</TableCell>
                    <TableCell className="text-center">R$ {c.ticketMedio}</TableCell>
                    <TableCell className="text-center">R$ {c.totalGasto.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-center font-bold text-primary">{c.cuponsAcumulados}</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">R$ {c.saldoAcumulado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-center text-xs text-amber-500 font-medium">R$ {c.faltaProximoCupom.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-center text-xs">{c.primeiroPedido ? format(c.primeiroPedido, "dd/MM/yy") : "-"}</TableCell>
                    <TableCell className="text-center text-xs">{c.ultimoPedido ? format(c.ultimoPedido, "dd/MM/yy") : "-"}</TableCell>
                    <TableCell className="text-center text-xs">
                      {c.diasDesdeUltimoPedido !== null
                        ? <span className={c.diasDesdeUltimoPedido > 60 ? "text-destructive font-medium" : c.diasDesdeUltimoPedido > 30 ? "text-amber-500 font-medium" : "text-green-500 font-medium"}>
                            {c.diasDesdeUltimoPedido}d
                          </span>
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {c.intervaloMedio === 0
                        ? <span className="text-muted-foreground">—</span>
                        : (() => {
                            const d = c.intervaloMedio;
                            const [label, cls] = d <= 10
                              ? ["Semanal", "text-green-500"]
                              : d <= 20 ? ["Quinzenal", "text-green-500"]
                              : d <= 40 ? ["Mensal", "text-amber-500"]
                              : d <= 90 ? ["Bimestral", "text-amber-500"]
                              : ["Esporádico", "text-destructive"];
                            return <span className={`font-medium ${cls}`}>{label} ({d}d)</span>;
                          })()
                      }
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/gestor/consumidores/${c.id}`)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Próxima</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BLOCO 5 — Gráficos: linha 1 (Novos por dia + Top consumidores) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Novos Consumidores por Dia — AreaChart estilo Dashboard */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-heading">Novos Consumidores por Dia</CardTitle>
              <p className="text-xs text-muted-foreground">{chartPeriodLabel}</p>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {chartPeriodLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 space-y-3" align="end">
                <p className="text-xs font-medium text-muted-foreground">Período</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(QUICK_LABELS) as NonNullable<QuickPeriod>[]).map((p) => (
                    <Button key={p} variant={chartQuick === p ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => selectChartQuick(p)}>
                      {QUICK_LABELS[p]}
                    </Button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Personalizado</p>
                  <div className="flex items-center gap-1">
                    <Input type="date" className="h-7 text-xs" value={chartCustomFromStr} onChange={(e) => setChartCustomFromStr(e.target.value)} />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input type="date" className="h-7 text-xs" value={chartCustomToStr} onChange={(e) => setChartCustomToStr(e.target.value)} />
                  </div>
                  <Button size="sm" className="text-xs h-7 w-full" onClick={applyChartCustom} disabled={!chartCustomFromStr || !chartCustomToStr}>Aplicar</Button>
                </div>
              </PopoverContent>
            </Popover>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ novos: { label: "Novos", color: "hsl(25 95% 53%)" } }} className="h-[220px] w-full">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="gradNovos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(25 95% 53%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(25 95% 53%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" vertical={false} />
                <XAxis dataKey="label" stroke="hsl(220 10% 55%)" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="hsl(220 10% 55%)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="novos" stroke="hsl(25 95% 53%)" strokeWidth={2} fill="url(#gradNovos)" dot={false} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Ranking Consumidores */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-heading">Ranking Consumidores</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Top 10 por cupons acumulados — clique em 🎁 para premiar</p>
          </CardHeader>
          <CardContent>
            {topConsumidoresData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dado disponível.</p>
            ) : (() => {
              const maxCupons = topConsumidoresData[0].cupons;
              return (
                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                  {topConsumidoresData.map((item, idx) => {
                    const pct = maxCupons > 0 ? Math.round((item.cupons / maxCupons) * 100) : 0;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-2 min-w-0">
                            {idx < 3 ? (
                              <Badge className={`${medalColors[idx]} text-xs px-1.5 shrink-0`}>{idx + 1}º</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground w-6 text-center shrink-0">{idx + 1}º</span>
                            )}
                            <span className="font-medium text-sm truncate">{item.nome}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-1">
                            <span className="text-sm font-heading font-bold text-primary">
                              {item.cupons}
                            </span>
                            <Button
                              variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary"
                              title="Premiar este consumidor"
                              onClick={() => {
                                setPremioConsumidor({ id: item.id, nome: item.nomeCompleto, telefone: item.telefone, cupons: item.cupons });
                                setVoucherCodigo(generateVoucherCode());
                                setPremioTab("cupons");
                                setPremioOpen(true);
                              }}
                            >
                              <Gift className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* BLOCO 6 — Gráficos: linha 2 (Distribuição por cidade + Ticket médio) */}
      {cidadeDistData.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Distribuição por Cidade */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading">Distribuição por Cidade</CardTitle>
              <p className="text-xs text-muted-foreground">Consumidores por cidade cadastrada</p>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <ChartContainer config={{ count: { label: "Consumidores" } }} className="h-[200px] w-[200px] shrink-0">
                <PieChart>
                  <Pie data={cidadeDistData} dataKey="count" nameKey="cidade" cx="50%" cy="50%" outerRadius={80} innerRadius={44} paddingAngle={3}>
                    {cidadeDistData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                {cidadeDistData.map((item, i) => (
                  <div key={item.cidade} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="truncate text-muted-foreground">{item.cidade}</span>
                    </div>
                    <span className="font-medium shrink-0">{item.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Frequência de Compras */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading">Frequência de Compras</CardTitle>
              <p className="text-xs text-muted-foreground">Distribuição por intervalo médio entre pedidos</p>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <ChartContainer config={{ count: { label: "Consumidores" } }} className="h-[200px] w-[200px] shrink-0">
                <PieChart>
                  <Pie data={frequenciaData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={44} paddingAngle={3}>
                    {frequenciaData.map((item, i) => <Cell key={i} fill={item.color} />)}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                {frequenciaData.map((item) => {
                  const total = frequenciaData.reduce((s, x) => s + x.count, 0);
                  const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                  return (
                    <div key={item.name} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: item.color }} />
                        <span className="truncate text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-medium shrink-0">{item.count} <span className="text-muted-foreground">({pct}%)</span></span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal — Premio Top Ganhador */}
      <Dialog open={premioOpen} onOpenChange={setPremioOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Premiar — {premioConsumidor?.nome}
            </DialogTitle>
            <DialogDescription>
              🏆 {premioConsumidor?.cupons} cupons acumulados
            </DialogDescription>
          </DialogHeader>
          <Tabs value={premioTab} onValueChange={(v) => setPremioTab(v as "cupons" | "brinde" | "whatsapp")}>
            <TabsList className="w-full">
              <TabsTrigger value="cupons" className="flex-1">Cupons Bônus</TabsTrigger>
              <TabsTrigger value="brinde" className="flex-1">Brinde / Voucher</TabsTrigger>
              <TabsTrigger value="whatsapp" className="flex-1">WhatsApp</TabsTrigger>
            </TabsList>

            <TabsContent value="cupons" className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label>Quantidade de cupons</Label>
                <Input type="number" min="1" value={premioQtd} onChange={(e) => setPremioQtd(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Motivo (opcional)</Label>
                <Input value={premioMotivo} onChange={(e) => setPremioMotivo(e.target.value)} placeholder="Ex: Top ganhador do mês de maio" />
              </div>
              <Button className="w-full" disabled={premioCuponsLoading} onClick={handlePremioCupons}>
                {premioCuponsLoading ? "Adicionando..." : "Adicionar Cupons Bônus"}
              </Button>
            </TabsContent>

            <TabsContent value="brinde" className="space-y-3 pt-3 max-h-[60vh] overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <Label>Tipo de voucher</Label>
                <Select value={voucherTipo} onValueChange={(v) => setVoucherTipo(v as typeof voucherTipo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pizza_gratis">🍕 Pizza Grátis</SelectItem>
                    <SelectItem value="desconto_percentual">% Desconto Percentual</SelectItem>
                    <SelectItem value="desconto_fixo">R$ Desconto Fixo</SelectItem>
                    <SelectItem value="produto">🎁 Produto</SelectItem>
                    <SelectItem value="brinde_especial">⭐ Brinde Especial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {voucherTipo === "pizza_gratis" && (
                <div className="space-y-3 rounded-md border border-border p-3 bg-muted/30">
                  <div className="space-y-1.5">
                    <Label>Tamanho da pizza <span className="text-destructive">*</span></Label>
                    <Select value={pizzaTamanho} onValueChange={setPizzaTamanho}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Broto">Broto</SelectItem>
                        <SelectItem value="Média">Média</SelectItem>
                        <SelectItem value="Grande">Grande</SelectItem>
                        <SelectItem value="Família">Família</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Observação de sabor (opcional)</Label>
                    <Input value={pizzaSaborObs} onChange={(e) => setPizzaSaborObs(e.target.value)} placeholder="Ex: sabor à escolha do cliente" />
                  </div>
                </div>
              )}

              {voucherTipo === "desconto_percentual" && (
                <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3 bg-muted/30">
                  <div className="space-y-1.5">
                    <Label>Desconto (%) <span className="text-destructive">*</span></Label>
                    <Input type="number" min="1" max="100" value={descontoPercentual} onChange={(e) => setDescontoPercentual(e.target.value)} placeholder="Ex: 15" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pedido mínimo R$ (opcional)</Label>
                    <Input type="number" min="0" value={pedidoMinimoPerc} onChange={(e) => setPedidoMinimoPerc(e.target.value)} placeholder="Ex: 50" />
                  </div>
                </div>
              )}

              {voucherTipo === "desconto_fixo" && (
                <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3 bg-muted/30">
                  <div className="space-y-1.5">
                    <Label>Valor do desconto R$ <span className="text-destructive">*</span></Label>
                    <Input type="number" min="1" value={descontoValor} onChange={(e) => setDescontoValor(e.target.value)} placeholder="Ex: 20" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pedido mínimo R$ (opcional)</Label>
                    <Input type="number" min="0" value={pedidoMinimoFixo} onChange={(e) => setPedidoMinimoFixo(e.target.value)} placeholder="Ex: 40" />
                  </div>
                </div>
              )}

              {voucherTipo === "produto" && (
                <div className="space-y-3 rounded-md border border-border p-3 bg-muted/30">
                  <div className="space-y-1.5">
                    <Label>Nome do produto <span className="text-destructive">*</span></Label>
                    <Input value={produtoNome} onChange={(e) => setProdutoNome(e.target.value)} placeholder="Ex: Refrigerante 2L" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Local de retirada (opcional)</Label>
                    <Input value={produtoLocalRetirada} onChange={(e) => setProdutoLocalRetirada(e.target.value)} placeholder="Ex: Balcão da pizzaria" />
                  </div>
                </div>
              )}

              {voucherTipo === "brinde_especial" && (
                <div className="space-y-3 rounded-md border border-border p-3 bg-muted/30">
                  <div className="space-y-1.5">
                    <Label>Descrição do brinde <span className="text-destructive">*</span></Label>
                    <Textarea value={brindeDescricao} onChange={(e) => setBrindeDescricao(e.target.value)} placeholder="Descreva o prêmio em detalhes..." rows={2} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Pizzaria (opcional)</Label>
                  <Select value={voucherPizzariaSelecionada} onValueChange={setVoucherPizzariaSelecionada}>
                    <SelectTrigger className="text-xs"><SelectValue placeholder="Qualquer pizzaria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Qualquer pizzaria</SelectItem>
                      {pizzarias.filter(p => p.status === "Ativa").map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Válido até (opcional)</Label>
                  <Input type="date" value={voucherValidade} onChange={(e) => setVoucherValidade(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Motivo interno (opcional)</Label>
                <Input value={voucherMotivo} onChange={(e) => setVoucherMotivo(e.target.value)} placeholder="Ex: Top ganhador do mês de maio" />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Código do voucher</Label>
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-muted-foreground" onClick={() => setVoucherCodigo(generateVoucherCode())}>
                    <RefreshCw className="h-3 w-3" /> Regenerar
                  </Button>
                </div>
                <Input value={voucherCodigo} readOnly className="font-mono text-sm font-bold tracking-widest bg-muted text-center" />
              </div>

              <div className="flex gap-2 pt-1">
                <Button className="flex-1 gap-1.5" disabled={premioBrindeLoading} onClick={() => handleSaveVoucher(true)}>
                  <Printer className="h-3.5 w-3.5" /> {premioBrindeLoading ? "Salvando..." : "Salvar e Imprimir PDF"}
                </Button>
                <Button variant="outline" className="flex-1" disabled={premioBrindeLoading} onClick={() => handleSaveVoucher(false)}>
                  Só Registrar
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="whatsapp" className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label>Mensagem personalizada</Label>
                <p className="text-xs text-muted-foreground">Variáveis: {"{nome}"}, {"{cupons}"}</p>
                <Textarea
                  rows={5}
                  value={premioMsg}
                  onChange={(e) => setPremioMsg(e.target.value)}
                  placeholder={`Oi {nome}, parabéns! 🏆 Você é o top ganhador com {cupons} cupons e ganhou um prêmio especial! Em breve entraremos em contato.`}
                />
              </div>
              <Button className="w-full" disabled={premioWaLoading || !premioMsg.trim()} onClick={handlePremioWhatsapp}>
                {premioWaLoading ? "Enviando..." : "Enviar via WhatsApp"}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Modal — Adicionar Consumidor */}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) setAddOpen(false); }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Consumidor</DialogTitle>
            <DialogDescription>Preencha os dados para cadastrar manualmente.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input value={newNome} onChange={(e) => setNewNome(e.target.value)} placeholder="Nome do consumidor" />
            </div>
            <div className="space-y-1.5">
              <Label>CPF</Label>
              <Input value={newCpf} onChange={(e) => setNewCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone / WhatsApp</Label>
              <Input value={newTelefone} onChange={(e) => setNewTelefone(e.target.value)} placeholder="(00) 90000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={newEstado} onValueChange={handleNewEstado}>
                <SelectTrigger><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
                <SelectContent>
                  {BRASIL_ESTADOS.map((e) => (
                    <SelectItem key={e.uf} value={e.uf}>{e.nome} ({e.uf})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Select value={newCidade} onValueChange={setNewCidade} disabled={!newEstado || addCidadesLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={addCidadesLoading ? "Carregando..." : newEstado ? "Selecione a cidade" : "Selecione o estado primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {addCidades.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Bairro</Label>
              <Input value={newBairro} onChange={(e) => setNewBairro(e.target.value)} placeholder="Bairro" />
            </div>
            <div className="space-y-1.5">
              <Label>Pizzaria vinculada</Label>
              <Select value={newPizzaria} onValueChange={setNewPizzaria}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {pizzarias.filter((p) => p.status === "Ativa").map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Senha inicial</Label>
              <div className="relative">
                <Input type={showSenha ? "text" : "password"} value={newSenha} onChange={(e) => setNewSenha(e.target.value)} placeholder="Senha" />
                <button type="button" className="absolute right-2 top-2.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowSenha(!showSenha)}>
                  {showSenha ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <Switch checked={newAceitaWhatsapp} onCheckedChange={setNewAceitaWhatsapp} />
            <span className="text-sm">Permitir envio de mensagens (WhatsApp)</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 mt-2">
            <div className="space-y-1.5">
              <Label>Gênero</Label>
              <Select value={newGenero} onValueChange={setNewGenero}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                  <SelectItem value="nao_informar">Prefiro não informar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data de nascimento</Label>
              <Input type="date" value={newDataNascimento} onChange={(e) => setNewDataNascimento(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <Switch checked={sendBoasVindas} onCheckedChange={setSendBoasVindas} />
            <span className="text-sm flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> Enviar mensagem de boas-vindas via WhatsApp
            </span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!newNome.trim() || !newEmail.trim() || !newSenha.trim()) {
                toast({ title: "Preencha nome, e-mail e senha", variant: "destructive" });
                return;
              }
              try {
                const res = await supabase.functions.invoke("create-user", {
                  body: {
                    email: newEmail.trim().toLowerCase(),
                    password: newSenha,
                    nome: newNome.trim(),
                    cpf: newCpf || null,
                    telefone: newTelefone || null,
                    perfil: "consumidor",
                    extra: {
                      cidade: newCidade || null,
                      estado: newEstado || null,
                      bairro: newBairro || null,
                      pizzariaId: newPizzaria || null,
                      genero: newGenero || null,
                      dataNascimento: newDataNascimento || null,
                      aceitaWhatsapp: newAceitaWhatsapp,
                    },
                  },
                });
                if (res.error || res.data?.error) {
                  toast({ title: "Erro ao cadastrar", description: res.data?.error || res.error?.message, variant: "destructive" });
                } else {
                  toast({ title: "Consumidor cadastrado com sucesso!" });
                  setAddOpen(false);
                }
              } catch (err: any) {
                toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
              }
            }} disabled={!newNome.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
