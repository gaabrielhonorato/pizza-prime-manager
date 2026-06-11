import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle, Ban, Copy, ExternalLink, Landmark, FileText, RefreshCw, FileDown, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TABLE_STYLES, loadLetteringDataUrl, buildPdfHeader, addPdfFooter, drawSectionTitle } from "@/lib/pdf-helpers";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const statusBadge = (s: string) => {
  const map: Record<string, { cls: string; label: string }> = {
    pendente:  { cls: "bg-muted text-muted-foreground", label: "Pendente" },
    agendado:  { cls: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Agendado" },
    enviado:   { cls: "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 border-amber-500 dark:border-amber-500/30", label: "Enviado" },
    pago:      { cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Pago" },
    cancelado: { cls: "bg-destructive/20 text-destructive", label: "Cancelado" },
  };
  const m = map[s] ?? map.pendente;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
};

interface Props {
  cobranca: any | null;
  pizzariaNome: string;
  pizzariaCnpj: string | null;
  campanha: any | null;
  onClose: () => void;
  onRefresh: () => void;
}

export default function CobrancaDetalheModal({ cobranca, pizzariaNome, pizzariaCnpj, campanha, onClose, onRefresh }: Props) {
  const [cob, setCob] = useState<any>(cobranca);
  const [drawerPedidos, setDrawerPedidos] = useState<any[]>([]);
  const [drawerCupons, setDrawerCupons]   = useState<any[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerTab, setDrawerTab]         = useState("resumo");
  const [verificandoNFSe, setVerificandoNFSe] = useState(false);
  const [gerandoBoleto, setGerandoBoleto]     = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [payOpen, setPayOpen]         = useState(false);
  const [payDate, setPayDate]         = useState(new Date().toISOString().slice(0, 10));
  const [payObs,  setPayObs]          = useState("");
  const [payForma, setPayForma]       = useState("");
  const [payValor, setPayValor]       = useState("");

  const taxaDel = campanha?.taxa_delivery ?? 15;
  const taxaRet = campanha?.taxa_retirada ?? 15;
  const taxaLoc = campanha?.taxa_local    ?? 12;
  const getTaxa = (tipo: string | null) =>
    tipo === "retirada" ? taxaRet : tipo === "local" ? taxaLoc : taxaDel;

  // Sync cob when prop changes — preserve local boleto data if DB refresh is stale
  useEffect(() => {
    if (!cobranca) { setCob(null); return; }
    setCob((prev: any) => {
      if (prev?.asaas_payment_id && !cobranca.asaas_payment_id) {
        return {
          ...cobranca,
          asaas_payment_id:       prev.asaas_payment_id,
          boleto_url:             prev.boleto_url,
          boleto_linha_digitavel: prev.boleto_linha_digitavel,
          vencimento_boleto:      prev.vencimento_boleto,
          spedy_order_id:         prev.spedy_order_id       ?? cobranca.spedy_order_id,
          spedy_invoice_status:   prev.spedy_invoice_status ?? cobranca.spedy_invoice_status,
        };
      }
      return cobranca;
    });
  }, [cobranca]);

  // Fetch pedidos + cupons when cobrança changes
  useEffect(() => {
    if (!cob?.id) { setDrawerPedidos([]); setDrawerCupons([]); return; }
    const ids: string[] = Array.isArray(cob.pedidos_snapshot) ? cob.pedidos_snapshot : [];
    if (!ids.length) { setDrawerPedidos([]); setDrawerCupons([]); return; }
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
  }, [cob?.id]);

  const verificarNFSe = async () => {
    if (!cob) return;
    setVerificandoNFSe(true);
    try {
      const { data, error } = await supabase.functions.invoke("spedy-check-nfse", {
        body: { cobranca_id: cob.id },
      });
      if (error || !data?.ok) throw new Error(data?.error ?? error?.message ?? "Erro ao verificar NFS-e");
      setCob((prev: any) => ({
        ...prev,
        spedy_invoice_status: data.spedy_invoice_status,
        spedy_invoice_id:     data.spedy_invoice_id     ?? prev.spedy_invoice_id,
        spedy_nfse_number:    data.spedy_nfse_number    ?? prev.spedy_nfse_number,
        spedy_nfse_pdf_url:   data.spedy_nfse_pdf_url   ?? prev.spedy_nfse_pdf_url,
        spedy_invoice_error:  data.spedy_invoice_error  ?? prev.spedy_invoice_error,
      }));
      onRefresh();
      if (data.spedy_invoice_status === "authorized") toast.success("NFS-e autorizada!");
      else if (data.spedy_invoice_status === "rejected") toast.error(`NFS-e rejeitada: ${data.spedy_invoice_error ?? "verifique o backoffice Spedy"}`);
      else toast.info("NFS-e ainda em processamento.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao verificar NFS-e");
    } finally {
      setVerificandoNFSe(false);
    }
  };

  const emitirBoleto = async () => {
    if (!cob) return;
    setGerandoBoleto(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-create-charge", {
        body: { cobranca_id: cob.id },
      });
      if (error || !data?.ok) throw new Error(data?.error ?? error?.message ?? "Erro ao emitir boleto");
      toast.success("Boleto emitido! O link foi salvo na cobrança.");
      if (data.spedy_warning)  toast.warning(`NFS-e: ${data.spedy_warning}`);
      else if (data.spedy_order_id) toast.success("NFS-e enviada para emissão pela Spedy.");
      setCob((prev: any) => ({
        ...prev,
        asaas_payment_id:       data.payment_id,
        boleto_url:             data.boleto_url,
        boleto_linha_digitavel: data.linha_digitavel,
        vencimento_boleto:      data.due_date,
        status:                 "enviado",
        spedy_order_id:         data.spedy_order_id ?? prev.spedy_order_id,
        spedy_invoice_status:   data.spedy_order_id ? "pending" : prev.spedy_invoice_status,
      }));
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao emitir boleto");
    } finally {
      setGerandoBoleto(false);
    }
  };

  const cancelCobranca = async () => {
    if (!cob) return;
    const { error } = await supabase.from("cobrancas_repasse").update({ status: "cancelado" }).eq("id", cob.id);
    if (error) { toast.error(`Erro ao cancelar: ${error.message}`); return; }
    toast.success("Cobrança cancelada. Pedidos liberados para próxima cobrança.");
    onRefresh();
    onClose();
  };

  const markPaid = async () => {
    if (!cob) return;
    if (!payForma) { toast.error("Selecione a forma de pagamento."); return; }
    if (!payObs.trim()) { toast.error("Preencha a justificativa do pagamento manual."); return; }
    const valorRecebido = payValor ? parseFloat(payValor) : null;
    const { error } = await supabase.from("cobrancas_repasse")
      .update({
        status: "pago",
        data_pagamento: payDate,
        forma_pagamento: payForma,
        valor_recebido: valorRecebido,
        observacao: payObs,
      })
      .eq("id", cob.id);
    if (error) { toast.error(`Erro ao marcar como pago: ${error.message}`); return; }
    toast.success("Cobrança marcada como paga!");
    setCob((prev: any) => ({ ...prev, status: "pago", data_pagamento: payDate, forma_pagamento: payForma }));
    setPayOpen(false);
    onRefresh();
  };

  const exportRelatorioPDF = async () => {
    if (!cob) return;
    const lettering = await loadLetteringDataUrl();
    const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
    const periodo = `${cob.periodo_inicio} a ${cob.periodo_fim}`;

    // ── Página 1: Resumo + Pedidos + Cupons ──────────────────────────────
    let y = buildPdfHeader(doc, pizzariaNome, `Relatório de Cobrança — ${periodo}`, [], lettering);
    y = drawSectionTitle(doc, "Resumo Financeiro", y);
    autoTable(doc, {
      ...TABLE_STYLES,
      head: [["", "Valor"]],
      body: [
        [`Delivery (${cob.taxa_delivery_aplicada ?? 15}%)`, fmt(Number(cob.total_delivery))],
        [`Retirada (${cob.taxa_retirada_aplicada ?? 15}%)`, fmt(Number(cob.total_retirada))],
        [`Salao (${cob.taxa_local_aplicada ?? 12}%)`, fmt(Number(cob.total_local))],
        ["Retido automaticamente (cardapio web)", `- ${fmt(Number(cob.valor_automatico_pp))}`],
        ["Valor devido", fmt(Number(cob.valor_total_devido))],
      ],
      startY: y, tableWidth: 380,
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
          return [i + 1, format(new Date(p.data_pedido), "dd/MM/yyyy HH:mm", { locale: ptBR }), tipoLabel, p.canal === "cardapioweb" ? "App" : "Manual", fmt(Number(p.valor_total)), fmt(Number(p.valor_total) * taxa / 100)];
        }),
      startY: y,
    });

    y = (doc as any).lastAutoTable.finalY + 14;
    y = drawSectionTitle(doc, "Cupons Gerados", y);
    autoTable(doc, {
      ...TABLE_STYLES,
      head: [["Total", "Utilizados", "Disponiveis"]],
      body: [[
        drawerCupons.reduce((s, c) => s + (c.quantidade ?? 1), 0),
        drawerCupons.filter(c => c.status === "utilizado").length,
        drawerCupons.filter(c => c.status !== "utilizado" && c.status !== "expirado").length,
      ]],
      startY: y, tableWidth: 340,
    });
    addPdfFooter(doc, `Cobranca — ${pizzariaNome}`);

    // ── Página 2: NFS-e ──────────────────────────────────────────────────
    doc.addPage();
    y = buildPdfHeader(doc, pizzariaNome, `Nota Fiscal de Servico (NFS-e) — ${periodo}`, [], lettering);
    y = drawSectionTitle(doc, "Dados da NFS-e", y);
    const nfseRows: (string | number)[][] = cob.spedy_order_id ? [
      ["Spedy Order ID", cob.spedy_order_id],
      ["Status", cob.spedy_invoice_status === "authorized" ? "Autorizada" : cob.spedy_invoice_status === "rejected" ? "Rejeitada" : "Pendente"],
      ...(cob.spedy_invoice_id    ? [["Invoice ID", cob.spedy_invoice_id]]      : []),
      ...(cob.spedy_nfse_number   ? [["Numero NFS-e", cob.spedy_nfse_number]]   : []),
      ...(cob.spedy_nfse_pdf_url  ? [["PDF NFS-e", cob.spedy_nfse_pdf_url]]     : []),
      ...(cob.spedy_invoice_error ? [["Erro", cob.spedy_invoice_error]]          : []),
    ] : [["Status", "NFS-e nao emitida para esta cobranca"]];
    autoTable(doc, { ...TABLE_STYLES, head: [["Campo", "Valor"]], body: nfseRows, startY: y });
    addPdfFooter(doc, `NFS-e — ${pizzariaNome}`);

    // ── Página 3: Boleto ─────────────────────────────────────────────────
    doc.addPage();
    y = buildPdfHeader(doc, pizzariaNome, `Boleto Bancario — ${periodo}`, [], lettering);
    y = drawSectionTitle(doc, "Dados do Boleto", y);
    const boletoRows: (string | number)[][] = cob.asaas_payment_id ? [
      ["Referência boleto", cob.asaas_payment_id],
      ...(cob.vencimento_boleto        ? [["Vencimento", format(new Date(cob.vencimento_boleto + "T12:00:00"), "dd/MM/yyyy")]] : []),
      ["Valor", fmt(Number(cob.valor_total_devido))],
      ...(cob.boleto_linha_digitavel   ? [["Linha Digitavel", cob.boleto_linha_digitavel]] : []),
      ...(cob.boleto_url               ? [["Link do Boleto", cob.boleto_url]]               : []),
    ] : [["Status", "Boleto nao emitido para esta cobranca"]];
    autoTable(doc, { ...TABLE_STYLES, head: [["Campo", "Valor"]], body: boletoRows, startY: y });
    addPdfFooter(doc, `Boleto — ${pizzariaNome}`);

    doc.save(`relatorio-${pizzariaNome.replace(/\s+/g, "-").toLowerCase()}-${cob.periodo_inicio}.pdf`);
  };

  if (!cob) return null;

  return (
    <>
      <Dialog open={!!cob} onOpenChange={o => !o && onClose()}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">

          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-border shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-heading font-semibold">{pizzariaNome}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground">{cob.periodo_inicio} a {cob.periodo_fim}</span>
                  {statusBadge(cob.status)}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-heading font-bold text-primary">{fmt(Number(cob.valor_total_devido))}</p>
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
                      <p className="text-xl font-bold">{fmt(Number(cob.total_delivery) + Number(cob.total_retirada) + Number(cob.total_local))}</p>
                    </div>
                    <div className="bg-secondary rounded-lg p-4">
                      <p className="text-xs text-muted-foreground mb-1">Pedidos incluídos</p>
                      <p className="text-xl font-bold">{Array.isArray(cob.pedidos_snapshot) ? cob.pedidos_snapshot.length : 0}</p>
                    </div>
                    <div className="bg-secondary rounded-lg p-4">
                      <p className="text-xs text-muted-foreground mb-1">Cupons gerados</p>
                      <p className="text-xl font-bold">{drawerLoading ? "…" : drawerCupons.reduce((s, c) => s + (c.quantidade ?? 1), 0)}</p>
                    </div>
                  </div>
                  <div className="bg-secondary rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span>🛵 Delivery — {cob.taxa_delivery_aplicada}%</span><span>{fmt(Number(cob.total_delivery))}</span></div>
                    <div className="flex justify-between"><span>🏪 Retirada — {cob.taxa_retirada_aplicada}%</span><span>{fmt(Number(cob.total_retirada))}</span></div>
                    <div className="flex justify-between"><span>🍽️ Salão — {cob.taxa_local_aplicada}%</span><span>{fmt(Number(cob.total_local))}</span></div>
                    <div className="border-t border-border pt-2 flex justify-between text-muted-foreground text-xs">
                      <span>Já retido automaticamente (cardápio web)</span>
                      <span>– {fmt(Number(cob.valor_automatico_pp))}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base text-primary pt-1">
                      <span>Valor devido</span><span>{fmt(Number(cob.valor_total_devido))}</span>
                    </div>
                  </div>
                  {cob.data_pagamento && (
                    <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Pago em {format(new Date(cob.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  )}
                  {cob.observacao && (
                    <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-3">{cob.observacao}</p>
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
                          const icon  = tipo === "retirada" ? "🏪" : tipo === "local" ? "🍽️" : "🛵";
                          const label = tipo === "retirada" ? "Retirada" : tipo === "local" ? "Salão" : "Delivery";
                          const taxa  = tipo === "retirada" ? taxaRet : tipo === "local" ? taxaLoc : taxaDel;
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
                              const taxa      = getTaxa(p.tipo_pedido);
                              const tipoLabel = p.tipo_pedido === "retirada" ? "Retirada" : p.tipo_pedido === "local" ? "Salão" : "Delivery";
                              const tipoIcon  = p.tipo_pedido === "retirada" ? "🏪" : p.tipo_pedido === "local" ? "🍽️" : "🛵";
                              return (
                                <TableRow key={p.id}>
                                  <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                                  <TableCell className="text-xs">{format(new Date(p.data_pedido), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                                  <TableCell className="text-xs">{tipoIcon} {tipoLabel}</TableCell>
                                  <TableCell className="text-xs">{p.canal === "cardapioweb" ? "App" : "Manual"}</TableCell>
                                  <TableCell className="text-right text-xs font-medium">{fmt(Number(p.valor_total))}</TableCell>
                                  <TableCell className="text-right text-xs font-medium text-primary">{fmt(Number(p.valor_total) * taxa / 100)}</TableCell>
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
                                  "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 border-amber-500 dark:border-amber-500/30"
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

                  {/* Boleto */}
                  <div className="space-y-2">
                    <p className="font-medium flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-primary" /> Boleto
                    </p>
                    {cob.asaas_payment_id ? (
                      <div className="bg-secondary rounded-lg p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Referência</span>
                          <span className="text-xs font-mono">{cob.asaas_payment_id}</span>
                        </div>
                        {cob.vencimento_boleto && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Vencimento</span>
                            <span className="text-xs font-medium">{format(new Date(cob.vencimento_boleto + "T12:00:00"), "dd/MM/yyyy")}</span>
                          </div>
                        )}
                        {cob.boleto_linha_digitavel && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Linha digitável</p>
                            <div className="flex items-center gap-2">
                              <code className="text-[10px] bg-background rounded px-2 py-1.5 flex-1 break-all leading-relaxed">{cob.boleto_linha_digitavel}</code>
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                                onClick={() => { navigator.clipboard.writeText(cob.boleto_linha_digitavel); toast.success("Linha digitável copiada!"); }}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                        {cob.boleto_url && (
                          <Button variant="outline" size="sm" className="w-full gap-2 mt-1" asChild>
                            <a href={cob.boleto_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" /> Abrir / baixar boleto
                            </a>
                          </Button>
                        )}
                      </div>
                    ) : cob.status !== "pago" && cob.status !== "cancelado" ? (
                      <div className="space-y-2">
                        {!pizzariaCnpj && (
                          <p className="text-xs text-amber-900 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 border border-amber-500 dark:border-amber-500/30 rounded-md px-3 py-2">
                            CNPJ não cadastrado nesta pizzaria.
                          </p>
                        )}
                        <Button size="sm" className="gap-2 w-full" onClick={emitirBoleto} disabled={gerandoBoleto || !pizzariaCnpj}>
                          <Landmark className="h-3.5 w-3.5" />
                          {gerandoBoleto ? "Emitindo boleto..." : "Emitir Boleto"}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Cobrança {cob.status} — boleto não foi emitido por esta via.</p>
                    )}
                  </div>

                  {/* NFS-e Spedy */}
                  <div className="space-y-2">
                    <p className="font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" /> Nota Fiscal de Serviço (NFS-e)
                    </p>
                    {cob.spedy_order_id ? (
                      <div className="bg-secondary rounded-lg p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Status</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            cob.spedy_invoice_status === "authorized" ? "bg-emerald-500/20 text-emerald-400" :
                            cob.spedy_invoice_status === "rejected"   ? "bg-red-500/20 text-red-400" :
                            "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400"
                          }`}>
                            {cob.spedy_invoice_status === "authorized" ? "Autorizada" : cob.spedy_invoice_status === "rejected" ? "Rejeitada" : "Aguardando"}
                          </span>
                        </div>
                        {cob.spedy_invoice_error && (
                          <p className="text-[11px] text-red-400 bg-red-500/10 rounded px-2 py-1.5">{cob.spedy_invoice_error}</p>
                        )}
                        {cob.spedy_nfse_number && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Número NFS-e</span>
                            <span className="text-xs font-medium">{cob.spedy_nfse_number}</span>
                          </div>
                        )}
                        {cob.spedy_nfse_pdf_url ? (
                          <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                            <a href={cob.spedy_nfse_pdf_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-3.5 w-3.5" /> Baixar NFS-e (PDF)
                            </a>
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="w-full gap-2" onClick={verificarNFSe} disabled={verificandoNFSe}>
                            <RefreshCw className="h-3.5 w-3.5" />
                            {verificandoNFSe ? "Verificando..." : cob.spedy_invoice_status === "rejected" ? "Tentar novamente" : "Verificar NFS-e"}
                          </Button>
                        )}
                      </div>
                    ) : cob.asaas_payment_id ? (
                      <div className="space-y-2">
                        <p className="text-xs text-amber-900 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 border border-amber-500 dark:border-amber-500/30 rounded-md px-3 py-2">
                          Nota fiscal ainda não emitida para este boleto.
                        </p>
                        <Button size="sm" variant="outline" className="gap-2 w-full" onClick={emitirBoleto} disabled={gerandoBoleto}>
                          <FileText className="h-3.5 w-3.5" />
                          {gerandoBoleto ? "Emitindo NFS-e..." : "Emitir NFS-e agora"}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">A NFS-e é gerada automaticamente ao emitir o boleto.</p>
                    )}
                  </div>
                </TabsContent>

              </div>
            </ScrollArea>
          </Tabs>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border shrink-0 flex justify-between items-center gap-3">
            <div>
              {cob.status !== "pago" && cob.status !== "cancelado" && (
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                  onClick={() => setCancelDialog(true)}>
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
              {cob.status === "enviado" && (
                <Button size="sm" className="gap-2"
                  onClick={() => { setPayDate(new Date().toISOString().slice(0, 10)); setPayObs(""); setPayForma(""); setPayValor(""); setPayOpen(true); }}>
                  <CheckCircle className="h-3.5 w-3.5" /> Marcar como pago
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: cancelar */}
      <AlertDialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar cobrança?</AlertDialogTitle>
            <AlertDialogDescription>Os pedidos incluídos serão liberados para a próxima cobrança. Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={cancelCobranca} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancelar cobrança
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: marcar como pago */}
      <Dialog open={payOpen} onOpenChange={o => { if (!o) { setPayOpen(false); setPayForma(""); setPayValor(""); setPayObs(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento Manual</DialogTitle>
            <DialogDescription>
              Use quando o pagamento foi recebido fora do boleto (Pix, negociação direta, etc.).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Data do Recebimento <span className="text-destructive">*</span></Label>
              <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Forma de Recebimento <span className="text-destructive">*</span></Label>
              <select
                value={payForma}
                onChange={e => setPayForma(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Selecione...</option>
                <option value="pix">Pix</option>
                <option value="transferencia">Transferência bancária</option>
                <option value="boleto">Boleto bancário</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="negociacao">Negociação direta</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>
                Valor recebido (R$)
                <span className="ml-1 text-[11px] text-muted-foreground">
                  — deixe em branco se igual ao valor da cobrança ({fmt(Number(cob?.valor_total_devido ?? 0))})
                </span>
              </Label>
              <Input
                type="number" min="0" step="0.01" placeholder={fmt(Number(cob?.valor_total_devido ?? 0))}
                value={payValor} onChange={e => setPayValor(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Justificativa <span className="text-destructive">*</span></Label>
              <Textarea
                value={payObs}
                onChange={e => setPayObs(e.target.value)}
                rows={3}
                placeholder="Ex: Cliente pagou via Pix após atraso. Negociamos desconto de 10% para liquidação imediata."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPayOpen(false); setPayForma(""); setPayValor(""); setPayObs(""); }}>Cancelar</Button>
            <Button onClick={markPaid}>Confirmar Pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
