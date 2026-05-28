import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, User, Ticket, ShoppingBag, MessageSquare, Save,
  Copy, Send, KeyRound, Shield, Plus, Crown, Gift,
  Download, FileSpreadsheet, FileText,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { usePizzarias } from "@/contexts/PizzariasContext";
import { useConsumidoresData } from "@/hooks/useConsumidoresData";
import { BRASIL_ESTADOS, fetchCidadesDoEstado } from "@/lib/brasil";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { seqToLuckyRandom } from "@/lib/lucky-numbers";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export default function ConsumidorDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pizzarias } = usePizzarias();

  const { data: allConsumidores, loading } = useConsumidoresData();
  const consumidor = allConsumidores.find((c) => c.id === id);

  const ranking = useMemo(
    () => [...allConsumidores].sort((a, b) => b.cuponsAcumulados - a.cuponsAcumulados),
    [allConsumidores]
  );
  const posRanking = consumidor ? ranking.findIndex((c) => c.id === consumidor.id) + 1 : 0;

  /* ── Editable profile state ── */
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [estado, setEstado] = useState("");
  const [cidade, setCidade] = useState("");
  const [cidadesOptions, setCidadesOptions] = useState<string[]>([]);
  const [cidadesLoading, setCidadesLoading] = useState(false);
  const [bairro, setBairro] = useState("");
  const [pizzariaId, setPizzariaId] = useState("");
  const [genero, setGenero] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [aceitaWhatsapp, setAceitaWhatsapp] = useState(true);
  const [contaAtiva, setContaAtiva] = useState(true);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);

  /* ── Sync states when consumidor data loads ── */
  useEffect(() => {
    if (consumidor) {
      setNome(consumidor.nome);
      setCpf(consumidor.cpf);
      setEmail(consumidor.email);
      setTelefone(consumidor.telefone);
      const savedEstado = consumidor.estado || "";
      setEstado(savedEstado);
      setCidade(consumidor.cidade);
      setBairro(consumidor.bairro);
      setPizzariaId(consumidor.pizzariaVinculadaId);
      setContaAtiva(consumidor.status === "Ativo");
      setGenero(consumidor.genero || "");
      setDataNascimento(consumidor.dataNascimento || "");
      setAceitaWhatsapp(consumidor.aceitaWhatsapp !== false);
      if (savedEstado) {
        setCidadesLoading(true);
        fetchCidadesDoEstado(savedEstado).then((cids) => {
          setCidadesOptions(cids);
          setCidadesLoading(false);
        });
      }
    }
  }, [consumidor]);

  /* ── Load cities when estado changes ── */
  const handleEstado = async (uf: string) => {
    setEstado(uf);
    setCidade("");
    setCidadesOptions([]);
    if (!uf) return;
    setCidadesLoading(true);
    const cids = await fetchCidadesDoEstado(uf);
    setCidadesOptions(cids);
    setCidadesLoading(false);
  };

  /* ── Real messages from disparos_whatsapp ── */
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [mensagensLoading, setMensagensLoading] = useState(true);

  useEffect(() => {
    if (!consumidor) return;
    const fetchMensagens = async () => {
      setMensagensLoading(true);
      const { data: msgs } = await supabase
        .from("disparos_whatsapp")
        .select("*")
        .eq("consumidor_id", consumidor.id)
        .order("criado_em", { ascending: false });
      setMensagens(msgs ?? []);
      setMensagensLoading(false);
    };
    fetchMensagens();
  }, [consumidor?.id]);

  /* ── Números da sorte ── */
  const [meusSeqs, setMeusSeqs] = useState<number[]>([]);
  const [numerosLoading, setNumerosLoading] = useState(false);
  const [numSeries, setNumSeries] = useState(5);
  const [detalhesCampanhaId, setDetalhesCampanhaId] = useState<string | null>(null);
  const [showAllNums, setShowAllNums] = useState(false);
  const NUMS_LIMIT = 300;

  useEffect(() => {
    if (!consumidor) return;
    const computeNumbers = async () => {
      setNumerosLoading(true);
      const { data: consRow } = await supabase
        .from("consumidores").select("campanha_id").eq("id", consumidor.id).single();
      if (!consRow?.campanha_id) { setNumerosLoading(false); return; }
      setDetalhesCampanhaId(consRow.campanha_id);
      const { data: campRow } = await supabase
        .from("campanhas").select("num_series").eq("id", consRow.campanha_id).single();
      setNumSeries(campRow?.num_series ?? 5);
      const { data: todos } = await supabase
        .from("cupons")
        .select("consumidor_id, quantidade")
        .eq("campanha_id", consRow.campanha_id)
        .eq("status", "validado")
        .order("criado_em", { ascending: true });
      if (!todos) { setNumerosLoading(false); return; }
      let cur = 1;
      const seqs: number[] = [];
      for (const c of todos) {
        for (let i = 0; i < c.quantidade; i++) {
          if (c.consumidor_id === consumidor.id) seqs.push(cur);
          cur++;
        }
      }
      setMeusSeqs(seqs);
      setNumerosLoading(false);
    };
    computeNumbers();
  }, [consumidor?.id]);

  /* ── Vouchers premiação ── */
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);

  useEffect(() => {
    if (!consumidor) return;
    setVouchersLoading(true);
    supabase
      .from("vouchers_premiacao")
      .select("*")
      .eq("consumidor_id", consumidor.id)
      .order("emitido_em", { ascending: false })
      .then(({ data }) => { setVouchers(data ?? []); setVouchersLoading(false); });
  }, [consumidor?.id]);

  const marcarResgatado = async (voucherId: string) => {
    const { error } = await supabase
      .from("vouchers_premiacao")
      .update({ status: "resgatado", resgatado_em: new Date().toISOString() })
      .eq("id", voucherId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setVouchers(v => v.map(x => x.id === voucherId ? { ...x, status: "resgatado", resgatado_em: new Date().toISOString() } : x));
    toast({ title: "Voucher marcado como resgatado" });
  };

  /* ── Cupons bonus ── */
  const [cuponsBonus, setCuponsBonus] = useState<any[]>([]);

  useEffect(() => {
    if (!consumidor) return;
    supabase
      .from("cupons_bonus")
      .select("*")
      .eq("consumidor_id", consumidor.id)
      .order("criado_em", { ascending: false })
      .then(({ data }) => setCuponsBonus(data ?? []));
  }, [consumidor?.id]);

  /* ── Histórico unificado: pedidos + bônus ── */
  const historicoCupons = useMemo(() => {
    if (!consumidor) return [];
    const pedidosItems = consumidor.pedidos.map(p => ({
      id: p.id,
      data: p.data,
      tipo: "pedido",
      descricao: `${p.pizzariaNome}  ·  R$ ${p.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      quantidade: p.cuponsGerados,
    }));
    const bonusItems = cuponsBonus.map(cb => ({
      id: cb.id,
      data: new Date(cb.criado_em),
      tipo: cb.tipo as string,
      descricao: cb.motivo || "—",
      quantidade: cb.quantidade as number,
    }));
    return [...pedidosItems, ...bonusItems].sort((a, b) => b.data.getTime() - a.data.getTime());
  }, [consumidor, cuponsBonus]);

  /* ── Add coupons modal ── */
  const [addCupomOpen, setAddCupomOpen] = useState(false);
  const [cupomQtd, setCupomQtd] = useState("1");
  const [cupomMotivo, setCupomMotivo] = useState("");
  const [salvandoCupom, setSalvandoCupom] = useState(false);

  /* ── Send message state ── */
  const [msgText, setMsgText] = useState("");
  const [enviandoMsg, setEnviandoMsg] = useState(false);

  /* ── Save profile state ── */
  const [salvando, setSalvando] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!consumidor) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-muted-foreground">Consumidor não encontrado.</p>
        <Button variant="outline" onClick={() => navigate("/gestor/consumidores")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
      </div>
    );
  }

  const salvarPerfil = async () => {
    setSalvando(true);
    const [r1, r2] = await Promise.all([
      supabase.from("usuarios").update({
        nome: nome.trim(),
        cpf: cpf.trim() || null,
        email: email.trim().toLowerCase() || null,
        telefone: telefone.trim() || null,
      }).eq("id", consumidor.usuarioId),
      supabase.from("consumidores").update({
        estado: estado.trim() || null,
        cidade: cidade.trim() || null,
        bairro: bairro.trim() || null,
        genero: genero || null,
        data_nascimento: dataNascimento || null,
        aceita_whatsapp: aceitaWhatsapp,
        pizzaria_id: pizzariaId || null,
        cadastro_completo: !!(nome.trim() && cpf.trim() && telefone.trim()),
      }).eq("id", consumidor.id),
    ]);
    setSalvando(false);
    const err = r1.error || r2.error;
    if (err) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
      return;
    }
    toast({ title: "Perfil salvo", description: "As alterações foram salvas com sucesso." });
  };

  const toggleContaAtiva = async (value: boolean) => {
    setContaAtiva(value);
    const { error } = await supabase
      .from("usuarios")
      .update({ ativo: value })
      .eq("id", consumidor.usuarioId);
    if (error) {
      setContaAtiva(!value);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const gerarSenha = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
    let s = "";
    for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
    setSenhaGerada(s);
  };

  const copiarSenha = () => {
    if (senhaGerada) {
      navigator.clipboard.writeText(senhaGerada);
      toast({ title: "Copiado!", description: "Senha copiada para a área de transferência." });
    }
  };

  const enviarMsgManual = async () => {
    if (!msgText.trim()) return;
    setEnviandoMsg(true);
    const mensagemFinal = msgText
      .replace(/\{nome\}/g, consumidor.nome)
      .replace(/\{total_cupons\}/g, String(consumidor.cuponsAcumulados))
      .replace(/\{pizzaria\}/g, consumidor.pizzariaVinculadaNome)
      .replace(/\{cidade\}/g, consumidor.cidade);
    const { error } = await supabase.from("disparos_whatsapp").insert({
      consumidor_id: consumidor.id,
      mensagem: mensagemFinal,
      tipo: "manual",
      status: "enviado",
    });
    if (error) {
      setEnviandoMsg(false);
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
      return;
    }
    const { data: msgs } = await supabase
      .from("disparos_whatsapp")
      .select("*")
      .eq("consumidor_id", consumidor.id)
      .order("criado_em", { ascending: false });
    setMensagens(msgs ?? []);
    setEnviandoMsg(false);
    setMsgText("");
    toast({ title: "Mensagem enviada", description: `Mensagem enviada para ${consumidor.nome}.` });
  };

  /* ── Exports do histórico de cupons ── */
  const TIPO_LABEL: Record<string, string> = {
    pedido: "Pedido",
    manual: "Bônus Manual",
    top_ganhador: "Top Ganhador",
    brinde: "Brinde",
    bonus: "Bônus",
  };
  const TIPO_BADGE: Record<string, string> = {
    pedido: "default",
    manual: "secondary",
    top_ganhador: "outline",
    brinde: "outline",
  };

  const exportHistoricoPdf = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
    const pageW = doc.internal.pageSize.getWidth();
    const today = format(new Date(), "yyyy-MM-dd");
    const ORANGE: [number,number,number] = [249,115,22];
    const S900: [number,number,number] = [15,23,42];
    const S500: [number,number,number] = [100,116,139];
    const S200: [number,number,number] = [226,232,240];
    const S50:  [number,number,number] = [248,250,252];
    const WHITE:[number,number,number] = [255,255,255];

    const HEADER_H = 84;
    doc.setFillColor(...S50); doc.rect(0, 0, pageW, HEADER_H, "F");
    doc.setFillColor(...ORANGE); doc.rect(0, 0, pageW, 4, "F");

    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(...S900);
    doc.text(consumidor.nome, 20, 30);
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...S500);
    doc.text(`Histórico de Cupons  ·  Gerado em ${format(new Date(), "dd/MM/yyyy 'as' HH:mm")}`, 20, 46);

    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...ORANGE);
    doc.text(`${consumidor.cuponsAcumulados} cupons acumulados`, pageW - 20, 30, { align: "right" });
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...S500);
    doc.text(`${historicoCupons.length} registros  ·  ${posRanking}° no ranking`, pageW - 20, 46, { align: "right" });

    doc.setDrawColor(...S200); doc.setLineWidth(0.5);
    doc.line(20, HEADER_H, pageW - 20, HEADER_H);

    autoTable(doc, {
      head: [["Data", "Tipo", "Descrição", "Cupons"]],
      body: historicoCupons.map(h => [
        format(h.data, "dd/MM/yyyy"),
        TIPO_LABEL[h.tipo] ?? h.tipo,
        h.descricao,
        h.quantidade >= 0 ? `+${h.quantidade}` : String(h.quantidade),
      ]),
      startY: HEADER_H + 14,
      headStyles: { fillColor: S900, textColor: WHITE, fontStyle: "bold", fontSize: 8, cellPadding: 6 },
      alternateRowStyles: { fillColor: S50 },
      bodyStyles: { fontSize: 8, textColor: S500, cellPadding: 5 },
      styles: { lineColor: S200, lineWidth: 0.4 },
      margin: { left: 20, right: 20, bottom: 28 },
      columnStyles: { 0: { cellWidth: 58 }, 1: { cellWidth: 80 }, 3: { halign: "right" as const, textColor: ORANGE, fontStyle: "bold" as const } },
    });

    const totalPgs = doc.getNumberOfPages();
    for (let i = 1; i <= totalPgs; i++) {
      doc.setPage(i);
      const pH = doc.internal.pageSize.getHeight();
      doc.setDrawColor(...S200); doc.setLineWidth(0.5); doc.line(20, pH - 20, pageW - 20, pH - 20);
      doc.setFontSize(7); doc.setTextColor(...S500);
      doc.text(`Histórico de Cupons — ${consumidor.nome} — Pizza Premiada`, 20, pH - 9);
      doc.text(`Pág. ${i} de ${totalPgs}`, pageW / 2, pH - 9, { align: "center" });
      doc.text(format(new Date(), "dd/MM/yyyy"), pageW - 20, pH - 9, { align: "right" });
    }
    doc.save(`cupons-${consumidor.nome.split(" ")[0].toLowerCase()}-${today}.pdf`);
  };

  const exportHistoricoExcel = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [consumidor.nome],
      [`Total: ${consumidor.cuponsAcumulados} cupons  |  ${posRanking}° no ranking`],
      [],
      ["Data", "Tipo", "Descrição", "Cupons"],
      ...historicoCupons.map(h => [
        format(h.data, "dd/MM/yyyy"),
        TIPO_LABEL[h.tipo] ?? h.tipo,
        h.descricao,
        h.quantidade,
      ]),
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Histórico Cupons");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/octet-stream" }));
    const a = document.createElement("a"); a.href = url;
    a.download = `cupons-${consumidor.nome.split(" ")[0].toLowerCase()}-${today}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportHistoricoCsv = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const header = "Data,Tipo,Descricao,Cupons";
    const rows = historicoCupons.map(h => {
      const desc = h.descricao.includes(",") ? `"${h.descricao}"` : h.descricao;
      return [format(h.data, "dd/MM/yyyy"), h.tipo, desc, String(h.quantidade)].join(",");
    });
    const url = URL.createObjectURL(new Blob(["﻿" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url;
    a.download = `cupons-${consumidor.nome.split(" ")[0].toLowerCase()}-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigate("/gestor/consumidores")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{consumidor.nome}</h1>
          <p className="text-sm text-muted-foreground">{consumidor.cpf} · {consumidor.email}</p>
        </div>
        <Badge variant={consumidor.status === "Ativo" ? "default" : "secondary"} className="ml-auto">
          {consumidor.status}
        </Badge>
      </div>

      <Tabs defaultValue="perfil" className="space-y-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="perfil" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
            <User className="h-4 w-4" /> Perfil
          </TabsTrigger>
          <TabsTrigger value="cupons" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
            <Ticket className="h-4 w-4" /> Cupons
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
            <ShoppingBag className="h-4 w-4" /> Pedidos
          </TabsTrigger>
          <TabsTrigger value="mensagens" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
            <MessageSquare className="h-4 w-4" /> Mensagens
          </TabsTrigger>
          <TabsTrigger value="premios" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
            <Gift className="h-4 w-4" /> Prêmios
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════ PERFIL ══════════════════════ */}
        <TabsContent value="perfil" className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base">Dados Pessoais</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nome completo</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>CPF</Label>
                  <Input value={cpf} onChange={(e) => setCpf(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone / WhatsApp</Label>
                  <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Estado</Label>
                  <Select value={estado} onValueChange={handleEstado}>
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
                  {estado ? (
                    <Select value={cidade} onValueChange={setCidade} disabled={cidadesLoading}>
                      <SelectTrigger>
                        <SelectValue placeholder={cidadesLoading ? "Carregando..." : "Selecione a cidade"} />
                      </SelectTrigger>
                      <SelectContent>
                        {cidadesOptions.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Selecione o estado primeiro" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Bairro</Label>
                  <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Pizzaria vinculada</Label>
                  <Select value={pizzariaId} onValueChange={setPizzariaId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {pizzarias.filter((p) => p.status === "Ativa").map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Gênero</Label>
                  <Select value={genero} onValueChange={setGenero}>
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
                  <Input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <Switch checked={aceitaWhatsapp} onCheckedChange={setAceitaWhatsapp} />
                <span className="text-sm">Permitir envio de mensagens (WhatsApp)</span>
              </div>
              <Button className="mt-4" onClick={salvarPerfil} disabled={salvando}>
                <Save className="h-4 w-4 mr-1" /> {salvando ? "Salvando..." : "Salvar alterações"}
              </Button>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Segurança</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={gerarSenha}>
                  <KeyRound className="h-3.5 w-3.5 mr-1" /> Redefinir senha
                </Button>
                <Button variant="outline" size="sm">
                  <Send className="h-3.5 w-3.5 mr-1" /> Enviar link via WhatsApp
                </Button>
              </div>
              {senhaGerada && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2">
                  <code className="text-sm font-mono text-primary">{senhaGerada}</code>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copiarSenha}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Switch checked={contaAtiva} onCheckedChange={toggleContaAtiva} />
                <span className="text-sm">{contaAtiva ? "Conta ativa" : "Conta suspensa"}</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Cadastro: {format(consumidor.dataCadastro, "dd/MM/yyyy", { locale: ptBR })}</p>
                <p>Último acesso: {consumidor.ultimoPedido ? format(consumidor.ultimoPedido, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════ CUPONS ══════════════════════ */}
        <TabsContent value="cupons" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-secondary p-2.5"><Ticket className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold text-primary">{consumidor.cuponsAcumulados}</p>
                  <p className="text-xs text-muted-foreground">Cupons acumulados</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-secondary p-2.5"><Crown className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold">{posRanking}°</p>
                  <p className="text-xs text-muted-foreground">Posição no ranking</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-center justify-center">
                <Button variant="outline" onClick={() => setAddCupomOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar cupons manualmente
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Números da Sorte */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                🍀 Números da Sorte
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {numerosLoading ? "Calculando..." : meusSeqs.length === 0 ? "Nenhum número ainda" : `${meusSeqs.length} número${meusSeqs.length !== 1 ? "s" : ""} da sorte`}
              </p>
            </CardHeader>
            <CardContent>
              {numerosLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Calculando sequência...
                </div>
              ) : meusSeqs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum cupom validado encontrado.</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {(showAllNums ? meusSeqs : meusSeqs.slice(0, NUMS_LIMIT)).map((seq) => (
                      <Badge key={seq} variant="outline" className="font-mono text-xs border-primary/30 text-primary">
                        {detalhesCampanhaId ? seqToLuckyRandom(seq, numSeries, detalhesCampanhaId) : seq}
                      </Badge>
                    ))}
                  </div>
                  {meusSeqs.length > NUMS_LIMIT && (
                    <button
                      className="text-xs text-primary underline"
                      onClick={() => setShowAllNums(v => !v)}
                    >
                      {showAllNums ? "Mostrar menos" : `+ ${meusSeqs.length - NUMS_LIMIT} números ocultos — mostrar todos`}
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Histórico de Cupons</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {historicoCupons.length} registro(s) — pedidos + bônus
                  </p>
                </div>
                {historicoCupons.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportHistoricoPdf}>
                      <FileText className="h-3.5 w-3.5" /> PDF
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportHistoricoExcel}>
                      <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportHistoricoCsv}>
                      <Download className="h-3.5 w-3.5" /> CSV
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">Data</TableHead>
                    <TableHead className="w-[110px]">Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right w-[80px]">Cupons</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicoCupons.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-xs">{format(h.data, "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-xs">
                        <Badge
                          variant={
                            h.tipo === "pedido" ? "default"
                            : h.tipo === "top_ganhador" ? "outline"
                            : "secondary"
                          }
                          className="text-[10px] px-1.5"
                        >
                          {TIPO_LABEL[h.tipo] ?? h.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{h.descricao}</TableCell>
                      <TableCell className="text-right text-xs font-bold text-primary">
                        +{h.quantidade}
                      </TableCell>
                    </TableRow>
                  ))}
                  {historicoCupons.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum cupom registrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Add coupons dialog */}
          <Dialog open={addCupomOpen} onOpenChange={setAddCupomOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar Cupons Manualmente</DialogTitle>
                <DialogDescription>Informe a quantidade e o motivo.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Quantidade</Label>
                  <Input type="number" min="1" value={cupomQtd} onChange={(e) => setCupomQtd(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Motivo</Label>
                  <Input value={cupomMotivo} onChange={(e) => setCupomMotivo(e.target.value)} placeholder="Ex: Compensação, promoção especial..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddCupomOpen(false)}>Cancelar</Button>
                <Button disabled={salvandoCupom} onClick={async () => {
                  const qtd = parseInt(cupomQtd);
                  if (!qtd || qtd < 1) return;
                  setSalvandoCupom(true);
                  const { error } = await supabase.from("cupons_bonus").insert({
                    consumidor_id: consumidor.id,
                    quantidade: qtd,
                    motivo: cupomMotivo.trim() || null,
                    tipo: "manual",
                    status: "validado",
                  });
                  if (error) {
                    setSalvandoCupom(false);
                    toast({ title: "Erro ao adicionar cupons", description: error.message, variant: "destructive" });
                    return;
                  }
                  const { data } = await supabase
                    .from("cupons_bonus")
                    .select("*")
                    .eq("consumidor_id", consumidor.id)
                    .order("criado_em", { ascending: false });
                  setCuponsBonus(data ?? []);
                  setSalvandoCupom(false);
                  setAddCupomOpen(false);
                  setCupomQtd("1");
                  setCupomMotivo("");
                  toast({ title: "Cupons adicionados", description: `${qtd} cupom(ns) adicionado(s) a ${consumidor.nome}.` });
                }}>
                  {salvandoCupom ? "Adicionando..." : "Adicionar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ══════════════════════ PEDIDOS ══════════════════════ */}
        <TabsContent value="pedidos" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base">Histórico de Pedidos</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Pizzaria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">Cupons</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumidor.pedidos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{format(p.data, "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-xs">{p.pizzariaNome}</TableCell>
                      <TableCell className="text-right text-xs">R$ {p.valor}</TableCell>
                      <TableCell className="text-xs">{p.canalVenda}</TableCell>
                      <TableCell className="text-right text-xs font-bold text-primary">{p.cuponsGerados}</TableCell>
                    </TableRow>
                  ))}
                  {consumidor.pedidos.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum pedido registrado.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            {consumidor.pedidos.length > 0 && (
              <div className="border-t border-border px-6 py-3 flex flex-wrap gap-6 text-sm">
                <div><span className="text-muted-foreground">Total de pedidos:</span> <strong>{consumidor.totalPedidos}</strong></div>
                <div><span className="text-muted-foreground">Total gasto:</span> <strong>R$ {consumidor.totalGasto.toLocaleString("pt-BR")}</strong></div>
                <div><span className="text-muted-foreground">Ticket médio:</span> <strong>R$ {consumidor.ticketMedio}</strong></div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ══════════════════════ MENSAGENS ══════════════════════ */}
        <TabsContent value="mensagens" className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base">Histórico de Mensagens</CardTitle></CardHeader>
            <CardContent className="p-0">
              {mensagensLoading ? (
                <p className="text-center text-muted-foreground py-6">Carregando...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Conteúdo</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mensagens.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhuma mensagem enviada.</TableCell></TableRow>
                    ) : mensagens.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs whitespace-nowrap">{format(new Date(m.criado_em), "dd/MM/yyyy HH:mm")}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={m.tipo === "automatico" ? "bg-secondary text-secondary-foreground border-border" : "bg-primary/10 text-primary border-primary/30"}>
                            {m.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-xs truncate">{m.mensagem}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={m.status === "enviado" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                            {m.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Send manual message */}
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base">Enviar Mensagem Manual</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {["{nome}", "{total_cupons}", "{pizzaria}", "{cidade}"].map((v) => (
                  <Badge key={v} variant="secondary" className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs" onClick={() => setMsgText((p) => p + " " + v)}>
                    {v}
                  </Badge>
                ))}
              </div>
              <Textarea value={msgText} onChange={(e) => setMsgText(e.target.value)} rows={3} placeholder="Escreva sua mensagem..." />
              {/* Message preview mirror */}
              {msgText.trim() && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">👁 Preview da mensagem:</p>
                  <p className="text-sm">
                    {msgText
                      .replace(/\{nome\}/g, consumidor.nome)
                      .replace(/\{total_cupons\}/g, String(consumidor.cuponsAcumulados))
                      .replace(/\{pizzaria\}/g, consumidor.pizzariaVinculadaNome)
                      .replace(/\{cidade\}/g, consumidor.cidade)}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{msgText.length} caracteres</span>
                <Button onClick={enviarMsgManual} disabled={!msgText.trim() || enviandoMsg}>
                  <Send className="h-4 w-4 mr-1" /> {enviandoMsg ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════ PRÊMIOS ══════════════════════ */}
        <TabsContent value="premios" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Gift className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Vouchers de Premiação</CardTitle>
              <span className="ml-auto text-xs text-muted-foreground">{vouchers.length} voucher(s)</span>
            </CardHeader>
            <CardContent>
              {vouchersLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : vouchers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum voucher emitido para este consumidor.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead className="text-center">Validade</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Emitido em</TableHead>
                        <TableHead className="text-center">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vouchers.map((v) => {
                        const tipoLabel: Record<string, string> = {
                          pizza_gratis: "🍕 Pizza Grátis",
                          desconto_percentual: "% Desconto",
                          desconto_fixo: "R$ Desconto",
                          produto: "🎁 Produto",
                          brinde_especial: "⭐ Brinde Especial",
                        };
                        const statusVariant: Record<string, "default"|"secondary"|"destructive"|"outline"> = {
                          ativo: "default",
                          resgatado: "secondary",
                          expirado: "outline",
                          cancelado: "destructive",
                        };
                        return (
                          <TableRow key={v.id}>
                            <TableCell className="text-xs font-medium whitespace-nowrap">{tipoLabel[v.tipo] ?? v.tipo}</TableCell>
                            <TableCell className="text-xs max-w-[200px]"><span className="block truncate" title={v.descricao}>{v.descricao}</span></TableCell>
                            <TableCell className="font-mono text-xs font-bold tracking-widest">{v.codigo}</TableCell>
                            <TableCell className="text-center text-xs">{v.validade ? format(new Date(v.validade + "T00:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={statusVariant[v.status] ?? "outline"} className="text-xs">
                                {v.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-xs">{format(new Date(v.emitido_em), "dd/MM/yyyy")}</TableCell>
                            <TableCell className="text-center">
                              {v.status === "ativo" && (
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => marcarResgatado(v.id)}>
                                  Resgatar
                                </Button>
                              )}
                              {v.status === "resgatado" && (
                                <span className="text-xs text-muted-foreground">{v.resgatado_em ? format(new Date(v.resgatado_em), "dd/MM/yy") : "—"}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
