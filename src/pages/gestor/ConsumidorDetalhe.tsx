import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, User, Ticket, ShoppingBag, MessageSquare, Save,
  Copy, Send, KeyRound, Shield, Plus, Crown, Gift,
  Download, FileSpreadsheet, FileText, CheckCircle2, XCircle,
  MessageCircle, ChevronDown, Pencil, Trash2, FilterX,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: allConsumidores, loading } = useConsumidoresData();
  const consumidor = allConsumidores.find((c) => c.id === id);

  const ranking = useMemo(
    () => [...allConsumidores].sort((a, b) => b.cuponsAcumulados - a.cuponsAcumulados),
    [allConsumidores]
  );
  const posRanking = consumidor ? ranking.findIndex((c) => c.id === consumidor.id) + 1 : 0;

  /* ── Profile state ── */
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
  const [salvando, setSalvando] = useState(false);

  /* ── Lucky numbers state ── */
  const [meusSeqs, setMeusSeqs] = useState<number[]>([]);
  const [seqToPedidoId, setSeqToPedidoId] = useState<Map<number, string>>(new Map());
  const [pedidoSeqsMap, setPedidoSeqsMap] = useState<Map<string, number[]>>(new Map());
  const [numerosLoading, setNumerosLoading] = useState(false);
  const [numSeries, setNumSeries] = useState(5);
  const [detalhesCampanhaId, setDetalhesCampanhaId] = useState<string | null>(null);
  const [showAllNums, setShowAllNums] = useState(false);
  const [luckyPopupPedidoId, setLuckyPopupPedidoId] = useState<string | null>(null);
  const NUMS_LIMIT = 300;

  /* ── Vouchers state ── */
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);
  const [editVoucherOpen, setEditVoucherOpen] = useState(false);
  const [editVoucher, setEditVoucher] = useState<any | null>(null);
  const [editDescricao, setEditDescricao] = useState("");
  const [editValidade, setEditValidade] = useState("");
  const [editCodigo, setEditCodigo] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [salvandoVoucher, setSalvandoVoucher] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletandoVoucher, setDeletandoVoucher] = useState(false);

  /* ── Cupons bonus state ── */
  const [cuponsBonus, setCuponsBonus] = useState<any[]>([]);

  /* ── Chamados state ── */
  const [chamados, setChamados] = useState<any[]>([]);
  const [chamadosLoading, setChamadosLoading] = useState(true);
  const [selectedChamadoId, setSelectedChamadoId] = useState<string | null>(null);
  const [chamadoMsgs, setChamadoMsgs] = useState<any[]>([]);
  const [chamadoMsgsLoading, setChamadoMsgsLoading] = useState(false);
  const [chamadoMsgText, setChamadoMsgText] = useState("");
  const [enviandoChamadoMsg, setEnviandoChamadoMsg] = useState(false);
  const [novoChamadoOpen, setNovoChamadoOpen] = useState(false);
  const [novoChamadoAssunto, setNovoChamadoAssunto] = useState("");
  const [novoChamadoPrimeiraMsg, setNovoChamadoPrimeiraMsg] = useState("");
  const [criandoChamado, setCriandoChamado] = useState(false);

  /* ── Add coupons modal state ── */
  const [addCupomOpen, setAddCupomOpen] = useState(false);
  const [cupomQtd, setCupomQtd] = useState("1");
  const [cupomMotivo, setCupomMotivo] = useState("");
  const [salvandoCupom, setSalvandoCupom] = useState(false);

  /* ── Pedidos filter state ── */
  const [filtroDataFrom, setFiltroDataFrom] = useState("");
  const [filtroDataTo, setFiltroDataTo] = useState("");
  const [filtroPizzFiltro, setFiltroPizzFiltro] = useState("none");
  const [filtroCanal, setFiltroCanal] = useState("none");

  /* ── fetchChamados ── */
  const fetchChamados = async () => {
    if (!consumidor) return;
    setChamadosLoading(true);
    const { data } = await supabase
      .from("chamados_whatsapp")
      .select("*")
      .eq("consumidor_id", consumidor.id)
      .order("criado_em", { ascending: false });
    setChamados(data ?? []);
    setChamadosLoading(false);
  };

  /* ── Pedidos filtrados ── */
  const pedidosFiltrados = useMemo(() => {
    if (!consumidor) return [];
    return consumidor.pedidos.filter(p => {
      if (filtroDataFrom && p.data < new Date(filtroDataFrom)) return false;
      if (filtroDataTo && p.data > new Date(filtroDataTo + "T23:59:59")) return false;
      if (filtroPizzFiltro !== "none" && p.pizzariaNome !== filtroPizzFiltro) return false;
      if (filtroCanal !== "none" && p.canalVenda !== filtroCanal) return false;
      return true;
    });
  }, [consumidor, filtroDataFrom, filtroDataTo, filtroPizzFiltro, filtroCanal]);

  /* ── Unified coupon history ── */
  const historicoCupons = useMemo(() => {
    if (!consumidor) return [];
    const pedidosItems = consumidor.pedidos.map(p => ({
      id: p.id, data: p.data, tipo: "pedido",
      descricao: `${p.pizzariaNome}  ·  R$ ${p.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      quantidade: p.cuponsGerados,
    }));
    const bonusItems = cuponsBonus.map(cb => ({
      id: cb.id, data: new Date(cb.criado_em), tipo: cb.tipo as string,
      descricao: cb.motivo || "—", quantidade: cb.quantidade as number,
    }));
    return [...pedidosItems, ...bonusItems].sort((a, b) => b.data.getTime() - a.data.getTime());
  }, [consumidor, cuponsBonus]);

  /* ── Sync profile ── */
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
        fetchCidadesDoEstado(savedEstado).then((cids) => { setCidadesOptions(cids); setCidadesLoading(false); });
      }
    }
  }, [consumidor]);

  useEffect(() => { fetchChamados(); }, [consumidor?.id]);

  useEffect(() => {
    if (!selectedChamadoId) { setChamadoMsgs([]); return; }
    setChamadoMsgsLoading(true);
    supabase.from("disparos_whatsapp").select("*")
      .eq("chamado_id", selectedChamadoId).order("criado_em", { ascending: true })
      .then(({ data }) => { setChamadoMsgs(data ?? []); setChamadoMsgsLoading(false); });
  }, [selectedChamadoId]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chamadoMsgs]);

  useEffect(() => {
    if (!consumidor) return;
    const computeNumbers = async () => {
      setNumerosLoading(true);
      const { data: consRow } = await supabase.from("consumidores").select("campanha_id").eq("id", consumidor.id).single();
      if (!consRow?.campanha_id) { setNumerosLoading(false); return; }
      setDetalhesCampanhaId(consRow.campanha_id);
      const { data: campRow } = await supabase.from("campanhas").select("num_series").eq("id", consRow.campanha_id).single();
      setNumSeries(campRow?.num_series ?? 5);
      const { data: todos } = await supabase.from("cupons")
        .select("consumidor_id, quantidade, pedido_id")
        .eq("campanha_id", consRow.campanha_id).eq("status", "validado").order("criado_em", { ascending: true });
      if (!todos) { setNumerosLoading(false); return; }
      let cur = 1;
      const seqs: number[] = [];
      const newSeqMap = new Map<number, string>();
      const newPedMap = new Map<string, number[]>();
      for (const c of todos) {
        for (let i = 0; i < c.quantidade; i++) {
          if (c.consumidor_id === consumidor.id) {
            seqs.push(cur);
            if (c.pedido_id) {
              newSeqMap.set(cur, c.pedido_id);
              const arr = newPedMap.get(c.pedido_id) ?? [];
              arr.push(cur);
              newPedMap.set(c.pedido_id, arr);
            }
          }
          cur++;
        }
      }
      setMeusSeqs(seqs);
      setSeqToPedidoId(newSeqMap);
      setPedidoSeqsMap(newPedMap);
      setNumerosLoading(false);
    };
    computeNumbers();
  }, [consumidor?.id]);

  useEffect(() => {
    if (!consumidor) return;
    setVouchersLoading(true);
    supabase.from("vouchers_premiacao").select("*").eq("consumidor_id", consumidor.id)
      .order("emitido_em", { ascending: false })
      .then(({ data }) => { setVouchers(data ?? []); setVouchersLoading(false); });
  }, [consumidor?.id]);

  useEffect(() => {
    if (!consumidor) return;
    supabase.from("cupons_bonus").select("*").eq("consumidor_id", consumidor.id)
      .order("criado_em", { ascending: false })
      .then(({ data }) => setCuponsBonus(data ?? []));
  }, [consumidor?.id]);

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

  /* ── Derived filter options ── */
  const pizzariasUnicas = [...new Set(consumidor.pedidos.map(p => p.pizzariaNome))].sort();
  const canaisUnicos = [...new Set(consumidor.pedidos.map(p => p.canalVenda))].sort();
  const filtrosAtivos = !!(filtroDataFrom || filtroDataTo || filtroPizzFiltro !== "none" || filtroCanal !== "none");

  /* ── Profile handlers ── */
  const salvarPerfil = async () => {
    setSalvando(true);
    const [r1, r2] = await Promise.all([
      supabase.from("usuarios").update({
        nome: nome.trim(), cpf: cpf.trim() || null,
        email: email.trim().toLowerCase() || null, telefone: telefone.trim() || null,
      }).eq("id", consumidor.usuarioId),
      supabase.from("consumidores").update({
        estado: estado.trim() || null, cidade: cidade.trim() || null, bairro: bairro.trim() || null,
        genero: genero || null, data_nascimento: dataNascimento || null, aceita_whatsapp: aceitaWhatsapp,
        pizzaria_id: pizzariaId || null,
        cadastro_completo: !!(nome.trim() && cpf.trim() && telefone.trim()),
      }).eq("id", consumidor.id),
    ]);
    setSalvando(false);
    const err = r1.error || r2.error;
    if (err) { toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }); return; }
    toast({ title: "Perfil salvo" });
  };

  const handleEstado = async (uf: string) => {
    setEstado(uf); setCidade(""); setCidadesOptions([]);
    if (!uf) return;
    setCidadesLoading(true);
    const cids = await fetchCidadesDoEstado(uf);
    setCidadesOptions(cids); setCidadesLoading(false);
  };

  const toggleContaAtiva = async (value: boolean) => {
    setContaAtiva(value);
    const { error } = await supabase.from("usuarios").update({ ativo: value }).eq("id", consumidor.usuarioId);
    if (error) { setContaAtiva(!value); toast({ title: "Erro", description: error.message, variant: "destructive" }); }
  };

  const gerarSenha = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
    let s = "";
    for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
    setSenhaGerada(s);
  };

  const copiarSenha = () => {
    if (senhaGerada) { navigator.clipboard.writeText(senhaGerada); toast({ title: "Copiado!" }); }
  };

  /* ── Voucher handlers ── */
  const marcarResgatado = async (voucherId: string) => {
    const { error } = await supabase.from("vouchers_premiacao")
      .update({ status: "resgatado", resgatado_em: new Date().toISOString() }).eq("id", voucherId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setVouchers(v => v.map(x => x.id === voucherId ? { ...x, status: "resgatado", resgatado_em: new Date().toISOString() } : x));
    toast({ title: "Voucher marcado como resgatado" });
  };

  const openEditVoucher = (v: any) => {
    setEditVoucher(v);
    setEditDescricao(v.descricao ?? "");
    setEditValidade(v.validade ?? "");
    setEditCodigo(v.codigo ?? "");
    setEditStatus(v.status ?? "ativo");
    setEditVoucherOpen(true);
  };

  const saveEditVoucher = async () => {
    if (!editVoucher) return;
    setSalvandoVoucher(true);
    const { error } = await supabase.from("vouchers_premiacao").update({
      descricao: editDescricao.trim(),
      validade: editValidade || null,
      codigo: editCodigo.trim(),
      status: editStatus,
    }).eq("id", editVoucher.id);
    setSalvandoVoucher(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setVouchers(v => v.map(x => x.id === editVoucher.id
      ? { ...x, descricao: editDescricao.trim(), validade: editValidade || null, codigo: editCodigo.trim(), status: editStatus }
      : x));
    setEditVoucherOpen(false);
    toast({ title: "Voucher atualizado" });
  };

  const deleteVoucher = async (vId: string) => {
    setDeletandoVoucher(true);
    const { error } = await supabase.from("vouchers_premiacao").delete().eq("id", vId);
    setDeletandoVoucher(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setVouchers(v => v.filter(x => x.id !== vId));
    setDeleteConfirmId(null);
    toast({ title: "Voucher excluído" });
  };

  /* ── Chamados handlers ── */
  const generateProtocolo = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return `PP-${code}`;
  };

  const abrirNovoChamado = async () => {
    if (!novoChamadoAssunto.trim()) return;
    setCriandoChamado(true);
    const protocolo = generateProtocolo();
    const { data: chamado, error } = await supabase.from("chamados_whatsapp")
      .insert({ consumidor_id: consumidor.id, protocolo, assunto: novoChamadoAssunto.trim(), status: "aberto" })
      .select().single();
    if (error) { setCriandoChamado(false); toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    if (novoChamadoPrimeiraMsg.trim()) {
      await supabase.from("disparos_whatsapp").insert({
        consumidor_id: consumidor.id, mensagem: novoChamadoPrimeiraMsg.trim(),
        tipo: "manual", status: "enviado", chamado_id: chamado.id, direcao: "saida",
      });
    }
    await fetchChamados();
    setSelectedChamadoId(chamado.id);
    setNovoChamadoOpen(false); setNovoChamadoAssunto(""); setNovoChamadoPrimeiraMsg("");
    setCriandoChamado(false);
    toast({ title: "Chamado aberto", description: `Protocolo: ${protocolo}` });
  };

  const fecharChamado = async (chamadoId: string) => {
    await supabase.from("chamados_whatsapp")
      .update({ status: "fechado", fechado_em: new Date().toISOString() }).eq("id", chamadoId);
    await fetchChamados();
    toast({ title: "Chamado encerrado" });
  };

  const reabrirChamado = async (chamadoId: string) => {
    await supabase.from("chamados_whatsapp").update({ status: "aberto", fechado_em: null }).eq("id", chamadoId);
    await fetchChamados();
    toast({ title: "Chamado reaberto" });
  };

  const enviarMsgNoChamado = async () => {
    if (!chamadoMsgText.trim() || !selectedChamadoId) return;
    setEnviandoChamadoMsg(true);
    const { error } = await supabase.from("disparos_whatsapp").insert({
      consumidor_id: consumidor.id, mensagem: chamadoMsgText.trim(),
      tipo: "manual", status: "enviado", chamado_id: selectedChamadoId, direcao: "saida",
    });
    if (error) { setEnviandoChamadoMsg(false); toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    const { data } = await supabase.from("disparos_whatsapp").select("*")
      .eq("chamado_id", selectedChamadoId).order("criado_em", { ascending: true });
    setChamadoMsgs(data ?? []);
    setChamadoMsgText("");
    setEnviandoChamadoMsg(false);
  };

  /* ── Lucky number popup data ── */
  const getLuckyPopupData = (pedidoId: string) => {
    const pedido = consumidor.pedidos.find(p => p.id === pedidoId);
    if (!pedido) return null;
    const seqs = pedidoSeqsMap.get(pedidoId) ?? [];
    const luckyNums = detalhesCampanhaId
      ? seqs.map(s => seqToLuckyRandom(s, numSeries, detalhesCampanhaId!))
      : seqs;
    return { pedido, luckyNums };
  };

  /* ── Lucky popup PDF comprovante ── */
  const exportLuckyPopupPdf = (pedidoId: string) => {
    const d = getLuckyPopupData(pedidoId);
    if (!d) return;
    const { pedido, luckyNums } = d;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a5" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const ORANGE: [number,number,number] = [249,115,22];
    const S900: [number,number,number] = [15,23,42];
    const S500: [number,number,number] = [100,116,139];
    const S200: [number,number,number] = [226,232,240];
    const S50:  [number,number,number] = [248,250,252];
    const WHITE:[number,number,number] = [255,255,255];

    // Orange header
    doc.setFillColor(...ORANGE); doc.rect(0, 0, W, 44, "F");
    doc.setFillColor(...WHITE); doc.circle(26, 22, 13, "F");
    doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(...ORANGE);
    doc.text("PP", 26, 26, { align: "center" });
    doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(...WHITE);
    doc.text("COMPROVANTE DE NÚMEROS DA SORTE", W/2 + 10, 17, { align: "center" });
    doc.setFontSize(7); doc.setFont("helvetica","normal");
    doc.text("Pizza Premiada — documento gerado automaticamente pelo sistema", W/2 + 10, 29, { align: "center" });
    doc.setFontSize(6.5); doc.setTextColor(255,230,200);
    doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, W - 10, 39, { align: "right" });

    let y = 56;

    // Consumer info box
    doc.setFillColor(...S50); doc.roundedRect(10, y, W-20, 48, 3, 3, "F");
    doc.setDrawColor(...S200); doc.setLineWidth(0.4); doc.roundedRect(10, y, W-20, 48, 3, 3, "D");
    doc.setFontSize(6); doc.setFont("helvetica","normal"); doc.setTextColor(...S500);
    doc.text("CONSUMIDOR", 18, y+10);
    doc.setFontSize(12); doc.setFont("helvetica","bold"); doc.setTextColor(...S900);
    doc.text(consumidor.nome, 18, y+24);
    doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.setTextColor(...S500);
    doc.text(`CPF: ${consumidor.cpf || "—"}  ·  ${posRanking}° no ranking`, 18, y+38);
    y += 58;

    // Purchase info grid (2x2)
    const boxes = [
      { label: "DATA DO PEDIDO", value: format(pedido.data, "dd/MM/yyyy", { locale: ptBR }) },
      { label: "PIZZARIA", value: pedido.pizzariaNome },
      { label: "VALOR PAGO", value: `R$ ${pedido.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
      { label: "CUPONS GERADOS", value: String(pedido.cuponsGerados) },
    ];
    const bW = (W - 24) / 2;
    boxes.forEach((b, i) => {
      const bx = 10 + (i % 2) * (bW + 4);
      const by = y + Math.floor(i / 2) * 42;
      doc.setFillColor(...S50); doc.roundedRect(bx, by, bW, 36, 3, 3, "F");
      doc.setDrawColor(...S200); doc.roundedRect(bx, by, bW, 36, 3, 3, "D");
      doc.setFontSize(6); doc.setFont("helvetica","normal"); doc.setTextColor(...S500);
      doc.text(b.label, bx+8, by+10);
      doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(...S900);
      doc.text(b.value, bx+8, by+24);
    });
    y += 92;

    // Lucky numbers header
    doc.setFillColor(...ORANGE); doc.roundedRect(10, y, W-20, 24, 3, 3, "F");
    doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(...WHITE);
    doc.text(`NÚMEROS DA SORTE DESTA COMPRA (${luckyNums.length})`, W/2, y+15, { align: "center" });
    y += 32;

    // Lucky number badges in grid
    const cols = 6;
    const numW = (W - 20 - (cols-1)*3) / cols;
    const numH = 18;
    luckyNums.forEach((n, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const nx = 10 + col * (numW + 3);
      const ny = y + row * (numH + 3);
      doc.setFillColor(...S50); doc.roundedRect(nx, ny, numW, numH, 2, 2, "F");
      doc.setDrawColor(...ORANGE); doc.setLineWidth(0.5); doc.roundedRect(nx, ny, numW, numH, 2, 2, "D");
      doc.setFontSize(7); doc.setFont("helvetica","bold"); doc.setTextColor(...ORANGE);
      doc.text(String(n), nx + numW/2, ny + 12, { align: "center" });
    });

    // Footer
    doc.setDrawColor(...S200); doc.setLineWidth(0.4); doc.line(10, H-22, W-10, H-22);
    doc.setFontSize(5.5); doc.setFont("helvetica","normal"); doc.setTextColor(...S500);
    doc.text("Este documento comprova que os números da sorte acima foram gerados a partir da compra identificada neste comprovante.", W/2, H-13, { align: "center" });
    doc.text("Pizza Premiada — Sistema de Gestão de Fidelidade  ·  Document ID: " + Math.random().toString(36).slice(2,10).toUpperCase(), W/2, H-5, { align: "center" });

    doc.save(`comprovante-${consumidor.nome.split(" ")[0].toLowerCase()}-${format(pedido.data,"yyyy-MM-dd")}.pdf`);
  };

  /* ── Label maps ── */
  const TIPO_LABEL: Record<string, string> = {
    pedido: "Pedido", manual: "Bônus Manual", top_ganhador: "Top Ganhador", brinde: "Brinde", bonus: "Bônus",
  };
  const VOUCHER_TIPO_LABEL: Record<string, string> = {
    pizza_gratis: "🍕 Pizza Grátis", desconto_percentual: "% Desconto",
    desconto_fixo: "R$ Desconto", produto: "🎁 Produto", brinde_especial: "⭐ Brinde Especial",
  };

  /* ── History exports ── */
  const exportHistoricoPdf = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
    const pageW = doc.internal.pageSize.getWidth();
    const today = format(new Date(), "yyyy-MM-dd");
    const ORANGE: [number,number,number] = [249,115,22]; const S900: [number,number,number] = [15,23,42];
    const S500: [number,number,number] = [100,116,139]; const S200: [number,number,number] = [226,232,240];
    const S50: [number,number,number] = [248,250,252]; const WHITE: [number,number,number] = [255,255,255];
    const H = 84;
    doc.setFillColor(...S50); doc.rect(0,0,pageW,H,"F");
    doc.setFillColor(...ORANGE); doc.rect(0,0,pageW,4,"F");
    doc.setFontSize(18); doc.setFont("helvetica","bold"); doc.setTextColor(...S900); doc.text(consumidor.nome, 20, 30);
    doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(...S500);
    doc.text(`Histórico de Cupons  ·  ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 20, 46);
    doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(...ORANGE);
    doc.text(`${consumidor.cuponsAcumulados} cupons acumulados`, pageW-20, 30, { align: "right" });
    doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(...S500);
    doc.text(`${historicoCupons.length} registros  ·  ${posRanking}° no ranking`, pageW-20, 46, { align: "right" });
    doc.setDrawColor(...S200); doc.setLineWidth(0.5); doc.line(20, H, pageW-20, H);
    autoTable(doc, {
      head: [["Data","Tipo","Descrição","Cupons"]],
      body: historicoCupons.map(h => [format(h.data,"dd/MM/yyyy"), TIPO_LABEL[h.tipo]??h.tipo, h.descricao, h.quantidade>=0?`+${h.quantidade}`:String(h.quantidade)]),
      startY: H+14, headStyles:{fillColor:S900,textColor:WHITE,fontStyle:"bold",fontSize:8,cellPadding:6},
      alternateRowStyles:{fillColor:S50}, bodyStyles:{fontSize:8,textColor:S500,cellPadding:5},
      styles:{lineColor:S200,lineWidth:0.4}, margin:{left:20,right:20,bottom:28},
      columnStyles:{0:{cellWidth:58},1:{cellWidth:80},3:{halign:"right" as const,textColor:ORANGE,fontStyle:"bold" as const}},
    });
    const tp = doc.getNumberOfPages();
    for (let i = 1; i <= tp; i++) {
      doc.setPage(i); const pH = doc.internal.pageSize.getHeight();
      doc.setDrawColor(...S200); doc.setLineWidth(0.5); doc.line(20,pH-20,pageW-20,pH-20);
      doc.setFontSize(7); doc.setTextColor(...S500);
      doc.text(`Histórico de Cupons — ${consumidor.nome}`, 20, pH-9);
      doc.text(`Pág. ${i} de ${tp}`, pageW/2, pH-9, {align:"center"});
      doc.text(format(new Date(),"dd/MM/yyyy"), pageW-20, pH-9, {align:"right"});
    }
    doc.save(`cupons-${consumidor.nome.split(" ")[0].toLowerCase()}-${today}.pdf`);
  };

  const exportHistoricoExcel = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [consumidor.nome], [`Total: ${consumidor.cuponsAcumulados} cupons  |  ${posRanking}° no ranking`], [],
      ["Data","Tipo","Descrição","Cupons"],
      ...historicoCupons.map(h => [format(h.data,"dd/MM/yyyy"), TIPO_LABEL[h.tipo]??h.tipo, h.descricao, h.quantidade]),
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Histórico Cupons");
    const buf = XLSX.write(wb, {bookType:"xlsx",type:"array"});
    const url = URL.createObjectURL(new Blob([buf],{type:"application/octet-stream"}));
    const a = document.createElement("a"); a.href=url; a.download=`cupons-${consumidor.nome.split(" ")[0].toLowerCase()}-${today}.xlsx`; a.click(); URL.revokeObjectURL(url);
  };

  const exportHistoricoCsv = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const rows = historicoCupons.map(h => {
      const desc = h.descricao.includes(",") ? `"${h.descricao}"` : h.descricao;
      return [format(h.data,"dd/MM/yyyy"), h.tipo, desc, String(h.quantidade)].join(",");
    });
    const url = URL.createObjectURL(new Blob(["﻿"+["Data,Tipo,Descricao,Cupons",...rows].join("\n")],{type:"text/csv;charset=utf-8"}));
    const a = document.createElement("a"); a.href=url; a.download=`cupons-${consumidor.nome.split(" ")[0].toLowerCase()}-${today}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  /* ── Pedidos exports ── */
  const exportPedidosPdf = (tipo: "sintetico" | "analitico") => {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
    const pageW = doc.internal.pageSize.getWidth();
    const today = format(new Date(), "yyyy-MM-dd");
    const ORANGE: [number,number,number] = [249,115,22]; const S900: [number,number,number] = [15,23,42];
    const S500: [number,number,number] = [100,116,139]; const S200: [number,number,number] = [226,232,240];
    const S50: [number,number,number] = [248,250,252]; const WHITE: [number,number,number] = [255,255,255];
    const H = 84;
    doc.setFillColor(...S50); doc.rect(0,0,pageW,H,"F");
    doc.setFillColor(...ORANGE); doc.rect(0,0,pageW,4,"F");
    doc.setFontSize(18); doc.setFont("helvetica","bold"); doc.setTextColor(...S900); doc.text(consumidor.nome, 20, 30);
    doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(...S500);
    doc.text(`${tipo==="sintetico"?"Relatório Sintético":"Relatório Analítico"} de Pedidos  ·  ${format(new Date(),"dd/MM/yyyy 'às' HH:mm")}`, 20, 46);
    doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(...ORANGE);
    doc.text(`${pedidosFiltrados.length} pedido(s)`, pageW-20, 30, {align:"right"});
    doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(...S500);
    const totalFiltrado = pedidosFiltrados.reduce((s,p)=>s+p.valor,0);
    doc.text(`R$ ${totalFiltrado.toLocaleString("pt-BR")} total`, pageW-20, 46, {align:"right"});
    doc.setDrawColor(...S200); doc.setLineWidth(0.5); doc.line(20,H,pageW-20,H);
    let startY = H+14;
    if (tipo === "sintetico") {
      const kpis = [
        {label:"Pedidos",value:String(pedidosFiltrados.length)},
        {label:"Total gasto",value:`R$ ${totalFiltrado.toLocaleString("pt-BR",{minimumFractionDigits:2})}`},
        {label:"Ticket médio",value:pedidosFiltrados.length>0?`R$ ${(totalFiltrado/pedidosFiltrados.length).toLocaleString("pt-BR",{minimumFractionDigits:2})}`:"—"},
        {label:"Cupons gerados",value:String(pedidosFiltrados.reduce((s,p)=>s+p.cuponsGerados,0))},
      ];
      const bW = (pageW-44)/4;
      kpis.forEach((k,i)=>{
        const bx=20+i*(bW+4);
        doc.setFillColor(...S50); doc.roundedRect(bx,startY,bW,38,3,3,"F");
        doc.setDrawColor(...S200); doc.setLineWidth(0.4); doc.roundedRect(bx,startY,bW,38,3,3,"D");
        doc.setFontSize(13); doc.setFont("helvetica","bold"); doc.setTextColor(...ORANGE);
        doc.text(k.value,bx+bW/2,startY+18,{align:"center"});
        doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.setTextColor(...S500);
        doc.text(k.label,bx+bW/2,startY+30,{align:"center"});
      });
      startY+=52;
      const byPiz = pedidosFiltrados.reduce<Record<string,{nome:string;total:number;qtd:number}>>((acc,p)=>{
        if(!acc[p.pizzariaNome]) acc[p.pizzariaNome]={nome:p.pizzariaNome,total:0,qtd:0};
        acc[p.pizzariaNome].total+=p.valor; acc[p.pizzariaNome].qtd++;
        return acc;
      },{});
      autoTable(doc,{
        head:[["Pizzaria","Pedidos","Total gasto","Ticket médio"]],
        body:Object.values(byPiz).sort((a,b)=>b.total-a.total).map(r=>[r.nome,r.qtd,`R$ ${r.total.toLocaleString("pt-BR",{minimumFractionDigits:2})}`,`R$ ${(r.total/r.qtd).toLocaleString("pt-BR",{minimumFractionDigits:2})}`]),
        startY, headStyles:{fillColor:S900,textColor:WHITE,fontStyle:"bold",fontSize:8,cellPadding:5},
        alternateRowStyles:{fillColor:S50}, bodyStyles:{fontSize:8,textColor:S500,cellPadding:4},
        styles:{lineColor:S200,lineWidth:0.4}, margin:{left:20,right:20,bottom:28},
        columnStyles:{1:{halign:"center" as const},2:{halign:"right" as const},3:{halign:"right" as const}},
      });
    } else {
      autoTable(doc,{
        head:[["Data","Pizzaria","Canal","Valor","Cupons"]],
        body:pedidosFiltrados.map(p=>[format(p.data,"dd/MM/yyyy"),p.pizzariaNome,p.canalVenda,`R$ ${p.valor.toLocaleString("pt-BR",{minimumFractionDigits:2})}`,p.cuponsGerados]),
        startY, headStyles:{fillColor:S900,textColor:WHITE,fontStyle:"bold",fontSize:8,cellPadding:5},
        alternateRowStyles:{fillColor:S50}, bodyStyles:{fontSize:8,textColor:S500,cellPadding:4},
        styles:{lineColor:S200,lineWidth:0.4}, margin:{left:20,right:20,bottom:28},
        columnStyles:{0:{cellWidth:55},3:{halign:"right" as const,textColor:ORANGE,fontStyle:"bold" as const},4:{halign:"center" as const}},
      });
    }
    const tp = doc.getNumberOfPages();
    for (let i=1;i<=tp;i++){
      doc.setPage(i); const pH=doc.internal.pageSize.getHeight();
      doc.setDrawColor(...S200); doc.setLineWidth(0.5); doc.line(20,pH-20,pageW-20,pH-20);
      doc.setFontSize(7); doc.setTextColor(...S500);
      doc.text(`Pedidos — ${consumidor.nome}`, 20, pH-9);
      doc.text(`Pág. ${i} de ${tp}`, pageW/2, pH-9, {align:"center"});
      doc.text(format(new Date(),"dd/MM/yyyy"), pageW-20, pH-9, {align:"right"});
    }
    doc.save(`pedidos-${tipo}-${consumidor.nome.split(" ")[0].toLowerCase()}-${today}.pdf`);
  };

  const exportPedidosExcel = () => {
    const today = format(new Date(),"yyyy-MM-dd");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [consumidor.nome],
      [`Total: ${pedidosFiltrados.length} pedidos  |  R$ ${pedidosFiltrados.reduce((s,p)=>s+p.valor,0).toLocaleString("pt-BR")} gasto`],
      [],
      ["Data","Pizzaria","Canal","Valor (R$)","Cupons gerados"],
      ...pedidosFiltrados.map(p=>[format(p.data,"dd/MM/yyyy"),p.pizzariaNome,p.canalVenda,p.valor,p.cuponsGerados]),
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
    const buf = XLSX.write(wb,{bookType:"xlsx",type:"array"});
    const url = URL.createObjectURL(new Blob([buf],{type:"application/octet-stream"}));
    const a = document.createElement("a"); a.href=url; a.download=`pedidos-${consumidor.nome.split(" ")[0].toLowerCase()}-${today}.xlsx`; a.click(); URL.revokeObjectURL(url);
  };

  const exportPedidosCsv = () => {
    const today = format(new Date(),"yyyy-MM-dd");
    const rows = pedidosFiltrados.map(p=>{
      const piz=p.pizzariaNome.includes(",")?`"${p.pizzariaNome}"`:p.pizzariaNome;
      return [format(p.data,"dd/MM/yyyy"),piz,p.canalVenda,p.valor,p.cuponsGerados].join(",");
    });
    const url = URL.createObjectURL(new Blob(["﻿"+["Data,Pizzaria,Canal,Valor,Cupons",...rows].join("\n")],{type:"text/csv;charset=utf-8"}));
    const a = document.createElement("a"); a.href=url; a.download=`pedidos-${consumidor.nome.split(" ")[0].toLowerCase()}-${today}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const selectedChamado = chamados.find(c => c.id === selectedChamadoId);

  /* ════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
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

      <Tabs defaultValue="cupons" className="space-y-4">
        <TabsList className="bg-secondary">
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
          <TabsTrigger value="perfil" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
            <User className="h-4 w-4" /> Perfil
          </TabsTrigger>
        </TabsList>

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

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">🍀 Números da Sorte</CardTitle>
              <p className="text-xs text-muted-foreground">
                {numerosLoading ? "Calculando..." : meusSeqs.length === 0 ? "Nenhum número ainda"
                  : `${meusSeqs.length} número${meusSeqs.length !== 1 ? "s" : ""} da sorte — clique para ver detalhes da compra`}
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
                    {(showAllNums ? meusSeqs : meusSeqs.slice(0, NUMS_LIMIT)).map((seq) => {
                      const pedidoId = seqToPedidoId.get(seq);
                      return (
                        <Badge key={seq} variant="outline"
                          className="font-mono text-xs border-primary/30 text-primary cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={() => pedidoId && setLuckyPopupPedidoId(pedidoId)}>
                          {detalhesCampanhaId ? seqToLuckyRandom(seq, numSeries, detalhesCampanhaId) : seq}
                        </Badge>
                      );
                    })}
                  </div>
                  {meusSeqs.length > NUMS_LIMIT && (
                    <button className="text-xs text-primary underline" onClick={() => setShowAllNums(v => !v)}>
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
                  <p className="text-xs text-muted-foreground mt-0.5">{historicoCupons.length} registro(s) — pedidos + bônus</p>
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
                        <Badge variant={h.tipo === "pedido" ? "default" : h.tipo === "top_ganhador" ? "outline" : "secondary"} className="text-[10px] px-1.5">
                          {TIPO_LABEL[h.tipo] ?? h.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{h.descricao}</TableCell>
                      <TableCell className="text-right text-xs font-bold text-primary">+{h.quantidade}</TableCell>
                    </TableRow>
                  ))}
                  {historicoCupons.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum cupom registrado.</TableCell></TableRow>
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
                <div className="space-y-1.5"><Label>Quantidade</Label>
                  <Input type="number" min="1" value={cupomQtd} onChange={(e) => setCupomQtd(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Motivo</Label>
                  <Input value={cupomMotivo} onChange={(e) => setCupomMotivo(e.target.value)} placeholder="Ex: Compensação, promoção especial..." /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddCupomOpen(false)}>Cancelar</Button>
                <Button disabled={salvandoCupom} onClick={async () => {
                  const qtd = parseInt(cupomQtd);
                  if (!qtd || qtd < 1) return;
                  setSalvandoCupom(true);
                  const { error } = await supabase.from("cupons_bonus").insert({
                    consumidor_id: consumidor.id, quantidade: qtd, motivo: cupomMotivo.trim() || null, tipo: "manual", status: "validado",
                  });
                  if (error) { setSalvandoCupom(false); toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
                  const { data } = await supabase.from("cupons_bonus").select("*").eq("consumidor_id", consumidor.id).order("criado_em", { ascending: false });
                  setCuponsBonus(data ?? []);
                  setSalvandoCupom(false); setAddCupomOpen(false); setCupomQtd("1"); setCupomMotivo("");
                  toast({ title: "Cupons adicionados", description: `${qtd} cupom(ns) adicionado(s) a ${consumidor.nome}.` });
                }}>
                  {salvandoCupom ? "Adicionando..." : "Adicionar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Lucky number detail popup */}
          <Dialog open={luckyPopupPedidoId !== null} onOpenChange={() => setLuckyPopupPedidoId(null)}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Detalhes da Compra</DialogTitle>
                <DialogDescription>Pedido que gerou estes números da sorte.</DialogDescription>
              </DialogHeader>
              {luckyPopupPedidoId && (() => {
                const d = getLuckyPopupData(luckyPopupPedidoId);
                if (!d) return <p className="text-sm text-muted-foreground">Pedido não encontrado.</p>;
                const { pedido, luckyNums } = d;
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border bg-secondary/30 px-3 py-2.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Data</p>
                        <p className="text-sm font-semibold">{format(pedido.data, "dd/MM/yyyy", { locale: ptBR })}</p>
                      </div>
                      <div className="rounded-lg border bg-secondary/30 px-3 py-2.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Valor do pedido</p>
                        <p className="text-sm font-semibold text-primary">R$ {pedido.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="rounded-lg border bg-secondary/30 px-3 py-2.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pizzaria</p>
                        <p className="text-sm font-semibold">{pedido.pizzariaNome}</p>
                      </div>
                      <div className="rounded-lg border bg-secondary/30 px-3 py-2.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cupons gerados</p>
                        <p className="text-sm font-semibold text-primary">{pedido.cuponsGerados}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">🍀 Números da sorte deste pedido ({luckyNums.length}):</p>
                      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto rounded-md border bg-secondary/20 p-2">
                        {luckyNums.map((n, i) => (
                          <Badge key={i} variant="outline" className="font-mono text-xs border-primary/30 text-primary">{n}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
              <DialogFooter>
                <Button variant="outline" onClick={() => setLuckyPopupPedidoId(null)}>Fechar</Button>
                {luckyPopupPedidoId && (
                  <Button onClick={() => { exportLuckyPopupPdf(luckyPopupPedidoId); }}>
                    <FileText className="h-3.5 w-3.5 mr-1.5" /> Exportar Comprovante
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ══════════════════════ PEDIDOS ══════════════════════ */}
        <TabsContent value="pedidos" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-base">Histórico de Pedidos</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {pedidosFiltrados.length}/{consumidor.pedidos.length} pedido(s)
                    {filtrosAtivos && <span className="ml-1 text-primary">(filtrado)</span>}
                  </p>
                </div>
                {consumidor.pedidos.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                        <Download className="h-3.5 w-3.5" /> Exportar <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => exportPedidosPdf("sintetico")}>
                        <FileText className="h-3.5 w-3.5 mr-2" /> PDF Sintético
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportPedidosPdf("analitico")}>
                        <FileText className="h-3.5 w-3.5 mr-2" /> PDF Analítico
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={exportPedidosExcel}>
                        <FileSpreadsheet className="h-3.5 w-3.5 mr-2" /> Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportPedidosCsv}>
                        <Download className="h-3.5 w-3.5 mr-2" /> CSV
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-2 mt-2">
                <Input type="date" value={filtroDataFrom} onChange={e => setFiltroDataFrom(e.target.value)}
                  className="h-7 text-xs w-32" title="Data inicial" />
                <Input type="date" value={filtroDataTo} onChange={e => setFiltroDataTo(e.target.value)}
                  className="h-7 text-xs w-32" title="Data final" />
                <Select value={filtroPizzFiltro} onValueChange={setFiltroPizzFiltro}>
                  <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Pizzaria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todas as pizzarias</SelectItem>
                    {pizzariasUnicas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filtroCanal} onValueChange={setFiltroCanal}>
                  <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Canal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todos os canais</SelectItem>
                    {canaisUnicos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {filtrosAtivos && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground"
                    onClick={() => { setFiltroDataFrom(""); setFiltroDataTo(""); setFiltroPizzFiltro("none"); setFiltroCanal("none"); }}>
                    <FilterX className="h-3.5 w-3.5" /> Limpar filtros
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Data</TableHead>
                    <TableHead>Pizzaria</TableHead>
                    <TableHead className="text-right w-[90px]">Valor</TableHead>
                    <TableHead className="w-[90px]">Canal</TableHead>
                    <TableHead className="text-center w-[60px]">Cupons</TableHead>
                    <TableHead>Números da Sorte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidosFiltrados.map((p) => {
                    const pedSeqs = pedidoSeqsMap.get(p.id) ?? [];
                    const pedLucky = detalhesCampanhaId
                      ? pedSeqs.map(s => seqToLuckyRandom(s, numSeries, detalhesCampanhaId!))
                      : pedSeqs;
                    const maxShow = 12;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">{format(p.data, "dd/MM/yy")}</TableCell>
                        <TableCell className="text-xs">{p.pizzariaNome}</TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          R$ {p.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.canalVenda}</TableCell>
                        <TableCell className="text-center text-xs font-bold text-primary">{p.cuponsGerados}</TableCell>
                        <TableCell>
                          {pedLucky.length === 0 ? (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-0.5">
                              {pedLucky.slice(0, maxShow).map((n, i) => (
                                <Badge key={i} variant="outline" className="font-mono text-[9px] px-1 h-4 border-primary/20 text-primary">
                                  {n}
                                </Badge>
                              ))}
                              {pedLucky.length > maxShow && (
                                <Badge variant="secondary" className="text-[9px] px-1 h-4 cursor-pointer"
                                  onClick={() => setLuckyPopupPedidoId(p.id)}>
                                  +{pedLucky.length - maxShow}
                                </Badge>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {pedidosFiltrados.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      {filtrosAtivos ? "Nenhum pedido encontrado com os filtros aplicados." : "Nenhum pedido registrado."}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            {pedidosFiltrados.length > 0 && (
              <div className="border-t border-border px-6 py-3 flex flex-wrap gap-6 text-sm">
                <div><span className="text-muted-foreground">Pedidos:</span> <strong>{pedidosFiltrados.length}</strong></div>
                <div><span className="text-muted-foreground">Total:</span> <strong>R$ {pedidosFiltrados.reduce((s,p)=>s+p.valor,0).toLocaleString("pt-BR")}</strong></div>
                <div><span className="text-muted-foreground">Ticket médio:</span> <strong>R$ {(pedidosFiltrados.reduce((s,p)=>s+p.valor,0)/pedidosFiltrados.length).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong></div>
                <div><span className="text-muted-foreground">Cupons gerados:</span> <strong>{pedidosFiltrados.reduce((s,p)=>s+p.cuponsGerados,0)}</strong></div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ══════════════════════ MENSAGENS ══════════════════════ */}
        <TabsContent value="mensagens">
          <div className="flex h-[600px] border border-border rounded-lg overflow-hidden bg-card">
            <div className="w-[30%] min-w-[200px] border-r border-border flex flex-col">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-secondary/30">
                <span className="text-sm font-semibold">Chamados</span>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setNovoChamadoOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Novo
                </Button>
              </div>
              <ScrollArea className="flex-1">
                {chamadosLoading ? (
                  <p className="text-center text-xs text-muted-foreground py-6">Carregando...</p>
                ) : chamados.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-6 px-3">Nenhum chamado. Clique em "Novo" para abrir um.</p>
                ) : chamados.map((ch) => (
                  <button key={ch.id}
                    className={`w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-secondary/50 transition-colors ${selectedChamadoId === ch.id ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}
                    onClick={() => setSelectedChamadoId(ch.id)}>
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-mono text-[10px] text-muted-foreground">{ch.protocolo}</span>
                      <Badge variant={ch.status === "aberto" ? "default" : "secondary"} className="text-[9px] px-1 h-4">{ch.status}</Badge>
                    </div>
                    <p className="text-xs font-medium truncate">{ch.assunto || "Sem assunto"}</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(ch.criado_em), "dd/MM/yyyy HH:mm")}</p>
                  </button>
                ))}
              </ScrollArea>
            </div>

            <div className="flex-1 flex flex-col">
              {!selectedChamadoId ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Selecione um chamado para ver a conversa</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/20">
                    <div>
                      <p className="text-sm font-semibold">{selectedChamado?.assunto || "Sem assunto"}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{selectedChamado?.protocolo}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={selectedChamado?.status === "aberto" ? "default" : "secondary"} className="text-xs">{selectedChamado?.status}</Badge>
                      {selectedChamado?.status === "aberto" ? (
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => fecharChamado(selectedChamadoId)}>
                          <XCircle className="h-3.5 w-3.5" /> Encerrar
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => reabrirChamado(selectedChamadoId)}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Reabrir
                        </Button>
                      )}
                    </div>
                  </div>
                  <ScrollArea className="flex-1 px-4 py-3">
                    {chamadoMsgsLoading ? (
                      <p className="text-center text-xs text-muted-foreground py-4">Carregando mensagens...</p>
                    ) : chamadoMsgs.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-4">Nenhuma mensagem neste chamado.</p>
                    ) : (
                      <div className="space-y-2">
                        {chamadoMsgs.map((m) => {
                          const isOut = m.direcao !== "entrada";
                          return (
                            <div key={m.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[75%] rounded-xl px-3 py-2 ${isOut ? "bg-primary text-primary-foreground rounded-br-none" : "bg-secondary text-foreground rounded-bl-none"}`}>
                                <p className="text-xs leading-relaxed whitespace-pre-wrap">{m.mensagem}</p>
                                <p className={`text-[10px] mt-0.5 ${isOut ? "text-primary-foreground/70 text-right" : "text-muted-foreground"}`}>
                                  {format(new Date(m.criado_em), "HH:mm")}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={chatEndRef} />
                      </div>
                    )}
                  </ScrollArea>
                  {selectedChamado?.status === "aberto" ? (
                    <div className="flex items-end gap-2 px-4 py-3 border-t border-border">
                      <Textarea className="flex-1 min-h-[40px] max-h-[120px] text-sm resize-none"
                        placeholder="Digite uma mensagem... (Enter para enviar)" rows={1}
                        value={chamadoMsgText} onChange={(e) => setChamadoMsgText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarMsgNoChamado(); } }} />
                      <Button size="sm" className="h-9" onClick={enviarMsgNoChamado} disabled={!chamadoMsgText.trim() || enviandoChamadoMsg}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="px-4 py-3 border-t border-border bg-secondary/20">
                      <p className="text-xs text-center text-muted-foreground">Chamado encerrado — reabra para enviar mensagens.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <Dialog open={novoChamadoOpen} onOpenChange={setNovoChamadoOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Novo Chamado</DialogTitle>
                <DialogDescription>Um protocolo PP-XXXXXXXX será gerado automaticamente.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Assunto</Label>
                  <Input value={novoChamadoAssunto} onChange={(e) => setNovoChamadoAssunto(e.target.value)} placeholder="Ex: Dúvida sobre cupons..." /></div>
                <div className="space-y-1.5"><Label>Mensagem inicial (opcional)</Label>
                  <Textarea value={novoChamadoPrimeiraMsg} onChange={(e) => setNovoChamadoPrimeiraMsg(e.target.value)} rows={3} placeholder="Primeira mensagem do chamado..." /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNovoChamadoOpen(false)}>Cancelar</Button>
                <Button onClick={abrirNovoChamado} disabled={criandoChamado || !novoChamadoAssunto.trim()}>
                  {criandoChamado ? "Abrindo..." : "Abrir chamado"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ══════════════════════ PRÊMIOS ══════════════════════ */}
        <TabsContent value="premios" className="space-y-4">
          <Tabs defaultValue="disponiveis">
            <TabsList className="bg-secondary mb-4">
              <TabsTrigger value="disponiveis" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
                <Gift className="h-3.5 w-3.5" /> Disponíveis
                {vouchers.filter(v => v.status === "ativo").length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 h-4">{vouchers.filter(v => v.status === "ativo").length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="resgatados" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Resgatados
                {vouchers.filter(v => v.status === "resgatado").length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 h-4">{vouchers.filter(v => v.status === "resgatado").length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Helper: voucher row actions */}
            {(() => {
              const VoucherRow = ({ v }: { v: any }) => (
                <TableRow key={v.id}>
                  <TableCell className="text-xs font-medium whitespace-nowrap">{VOUCHER_TIPO_LABEL[v.tipo] ?? v.tipo}</TableCell>
                  <TableCell className="text-xs max-w-[160px]"><span className="block truncate" title={v.descricao}>{v.descricao}</span></TableCell>
                  <TableCell className="font-mono text-xs font-bold tracking-widest">{v.codigo}</TableCell>
                  <TableCell className="text-center text-xs">{v.validade ? format(new Date(v.validade+"T00:00:00"),"dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell className="text-center text-xs">{format(new Date(v.emitido_em),"dd/MM/yyyy")}</TableCell>
                  <TableCell className="text-center text-xs">{v.resgatado_em ? format(new Date(v.resgatado_em),"dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {v.status === "ativo" && (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => marcarResgatado(v.id)}>Resgatar</Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditVoucher(v)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(v.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );

              const VoucherTable = ({ list }: { list: any[] }) => (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Código</TableHead>
                        <TableHead className="text-center">Validade</TableHead><TableHead className="text-center">Emitido</TableHead>
                        <TableHead className="text-center">Resgatado</TableHead><TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map(v => <VoucherRow key={v.id} v={v} />)}
                    </TableBody>
                  </Table>
                </div>
              );

              return (
                <>
                  <TabsContent value="disponiveis">
                    <Card className="border-border bg-card">
                      <CardHeader className="flex flex-row items-center gap-2 pb-3">
                        <Gift className="h-4 w-4 text-primary" />
                        <CardTitle className="text-base">Vouchers Disponíveis</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {vouchersLoading ? <p className="text-sm text-muted-foreground">Carregando...</p>
                          : vouchers.filter(v => v.status === "ativo").length === 0
                          ? <p className="text-sm text-muted-foreground">Nenhum voucher disponível para resgate.</p>
                          : <VoucherTable list={vouchers.filter(v => v.status === "ativo")} />}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="resgatados">
                    <Card className="border-border bg-card">
                      <CardHeader className="flex flex-row items-center gap-2 pb-3">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <CardTitle className="text-base">Vouchers Resgatados</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {vouchersLoading ? <p className="text-sm text-muted-foreground">Carregando...</p>
                          : vouchers.filter(v => v.status === "resgatado").length === 0
                          ? <p className="text-sm text-muted-foreground">Nenhum voucher resgatado ainda.</p>
                          : <VoucherTable list={vouchers.filter(v => v.status === "resgatado")} />}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </>
              );
            })()}
          </Tabs>

          {/* Edit voucher dialog */}
          <Dialog open={editVoucherOpen} onOpenChange={setEditVoucherOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Editar Voucher</DialogTitle>
                <DialogDescription>Altere os dados do voucher selecionado.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Código</Label>
                  <Input value={editCodigo} onChange={e => setEditCodigo(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Descrição</Label>
                  <Textarea value={editDescricao} onChange={e => setEditDescricao(e.target.value)} rows={2} /></div>
                <div className="space-y-1.5"><Label>Validade</Label>
                  <Input type="date" value={editValidade} onChange={e => setEditValidade(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="resgatado">Resgatado</SelectItem>
                      <SelectItem value="expirado">Expirado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditVoucherOpen(false)}>Cancelar</Button>
                <Button onClick={saveEditVoucher} disabled={salvandoVoucher}>
                  {salvandoVoucher ? "Salvando..." : "Salvar alterações"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete confirm dialog */}
          <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Excluir Voucher</DialogTitle>
                <DialogDescription>Esta ação não pode ser desfeita. O voucher será permanentemente removido.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
                <Button variant="destructive" onClick={() => deleteConfirmId && deleteVoucher(deleteConfirmId)} disabled={deletandoVoucher}>
                  {deletandoVoucher ? "Excluindo..." : "Excluir"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ══════════════════════ PERFIL ══════════════════════ */}
        <TabsContent value="perfil" className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base">Dados Pessoais</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Nome completo</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>CPF</Label><Input value={cpf} onChange={(e) => setCpf(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Telefone / WhatsApp</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Estado</Label>
                  <Select value={estado} onValueChange={handleEstado}>
                    <SelectTrigger><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
                    <SelectContent>{BRASIL_ESTADOS.map((e) => <SelectItem key={e.uf} value={e.uf}>{e.nome} ({e.uf})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Cidade</Label>
                  {estado ? (
                    <Select value={cidade} onValueChange={setCidade} disabled={cidadesLoading}>
                      <SelectTrigger><SelectValue placeholder={cidadesLoading ? "Carregando..." : "Selecione a cidade"} /></SelectTrigger>
                      <SelectContent>{cidadesOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Selecione o estado primeiro" />
                  )}
                </div>
                <div className="space-y-1.5"><Label>Bairro</Label><Input value={bairro} onChange={(e) => setBairro(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Pizzaria vinculada</Label>
                  <Select value={pizzariaId} onValueChange={setPizzariaId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{pizzarias.filter((p) => p.status === "Ativa").map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Gênero</Label>
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
                <div className="space-y-1.5"><Label>Data de nascimento</Label>
                  <Input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} /></div>
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

          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Segurança</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={gerarSenha}><KeyRound className="h-3.5 w-3.5 mr-1" /> Redefinir senha</Button>
                <Button variant="outline" size="sm"><Send className="h-3.5 w-3.5 mr-1" /> Enviar link via WhatsApp</Button>
              </div>
              {senhaGerada && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2">
                  <code className="text-sm font-mono text-primary">{senhaGerada}</code>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copiarSenha}><Copy className="h-3.5 w-3.5" /></Button>
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
      </Tabs>
    </div>
  );
}
