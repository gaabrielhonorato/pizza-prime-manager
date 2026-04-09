import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, User, Ticket, ShoppingBag, MessageSquare, Save,
  Copy, Send, KeyRound, Shield, Plus, Crown,
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [pizzariaId, setPizzariaId] = useState("");
  const [contaAtiva, setContaAtiva] = useState(true);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);

  /* ── Sync states when consumidor data loads ── */
  useEffect(() => {
    if (consumidor) {
      setNome(consumidor.nome);
      setCpf(consumidor.cpf);
      setEmail(consumidor.email);
      setTelefone(consumidor.telefone);
      setCidade(consumidor.cidade);
      setBairro(consumidor.bairro);
      setPizzariaId(consumidor.pizzariaVinculadaId);
      setContaAtiva(consumidor.status === "Ativo");
    }
  }, [consumidor]);

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

  /* ── Add coupons modal ── */
  const [addCupomOpen, setAddCupomOpen] = useState(false);
  const [cupomQtd, setCupomQtd] = useState("1");
  const [cupomMotivo, setCupomMotivo] = useState("");

  /* ── Send message state ── */
  const [msgText, setMsgText] = useState("");

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

  const salvarPerfil = () => {
    toast({ title: "Perfil salvo", description: "As alterações foram salvas com sucesso." });
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

  const enviarMsgManual = () => {
    if (!msgText.trim()) return;
    toast({ title: "Mensagem enviada", description: `Mensagem enviada para ${consumidor.nome}.` });
    setMsgText("");
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
                  <Label>Cidade</Label>
                  <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
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
              </div>
              <Button className="mt-4" onClick={salvarPerfil}>
                <Save className="h-4 w-4 mr-1" /> Salvar alterações
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
                <Switch checked={contaAtiva} onCheckedChange={setContaAtiva} />
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

          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base">Histórico de Cupons</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Pizzaria</TableHead>
                    <TableHead className="text-right">Valor do Pedido</TableHead>
                    <TableHead className="text-right">Cupons Gerados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumidor.pedidos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{format(p.data, "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-xs">{p.pizzariaNome}</TableCell>
                      <TableCell className="text-right text-xs">R$ {p.valor}</TableCell>
                      <TableCell className="text-right text-xs font-bold text-primary">{p.cuponsGerados}</TableCell>
                    </TableRow>
                  ))}
                  {consumidor.pedidos.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum cupom gerado.</TableCell></TableRow>
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
                <Button onClick={() => {
                  toast({ title: "Cupons adicionados", description: `${cupomQtd} cupom(ns) adicionado(s) a ${consumidor.nome}.` });
                  setAddCupomOpen(false);
                  setCupomQtd("1");
                  setCupomMotivo("");
                }}>Adicionar</Button>
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
                  {mensagensMock.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs whitespace-nowrap">{format(m.data, "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={m.tipo === "Automático" ? "bg-secondary text-secondary-foreground border-border" : "bg-primary/10 text-primary border-primary/30"}>
                          {m.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-xs truncate">{m.conteudo}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={m.statusEntrega === "Entregue" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                          {m.statusEntrega}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{msgText.length} caracteres</span>
                <Button onClick={enviarMsgManual} disabled={!msgText.trim()}>
                  <Send className="h-4 w-4 mr-1" /> Enviar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
