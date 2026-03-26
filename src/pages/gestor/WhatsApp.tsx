import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ClipboardList, Rocket, BarChart3, Edit, Send, Copy, Trash2,
  Calendar, Users, MessageSquare, CheckCircle2, XCircle, Clock,
  ChevronRight, ChevronLeft, AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ── Variables ── */
const VARIABLES = [
  "{nome}", "{total_cupons}", "{qtd_cupons}", "{premio_1}",
  "{premio_2}", "{premio_3}", "{pizzaria}", "{data_sorteio}", "{cidade}",
];

const SAMPLE_DATA: Record<string, string> = {
  "{nome}": "Lucas Mendes",
  "{total_cupons}": "12",
  "{qtd_cupons}": "3",
  "{premio_1}": "iPhone 15",
  "{premio_2}": "Smart TV 55\"",
  "{premio_3}": "Vale-compras R$500",
  "{pizzaria}": "Pizzaria Bella Napoli",
  "{data_sorteio}": "15/04/2026",
  "{cidade}": "São Paulo",
};

/* ── Disparos automáticos mock ── */
interface DisparoAutomatico {
  id: string;
  nome: string;
  descricaoGatilho: string;
  mensagemPadrao: string;
  ativo: boolean;
  disparosNoCiclo: number;
}

const initialDisparos: DisparoAutomatico[] = [
  {
    id: "1",
    nome: "Bem-vindo ao Cadastro",
    descricaoGatilho: "Consumidor completa o cadastro e aceita os termos",
    mensagemPadrao:
      "Olá, {nome}! 🍕 Seu cadastro na Pizza Premiada foi confirmado. A partir de agora, cada pizza que você pedir gera cupons para concorrer a prêmios incríveis. Boa sorte!",
    ativo: true,
    disparosNoCiclo: 127,
  },
  {
    id: "2",
    nome: "Novo Cupom Gerado",
    descricaoGatilho: "Cupom é gerado após um pedido",
    mensagemPadrao:
      "Oi, {nome}! Você ganhou {qtd_cupons} cupom(ns) novo(s) 🎟️ Agora você tem {total_cupons} cupons no total. Continue pedindo e aumente suas chances de ganhar {premio_1}!",
    ativo: true,
    disparosNoCiclo: 843,
  },
  {
    id: "3",
    nome: "Resultado do Sorteio",
    descricaoGatilho: "Gestor marca o sorteio como realizado",
    mensagemPadrao:
      "🎉 O sorteio da Pizza Premiada aconteceu! Os ganhadores foram anunciados. Acesse seu perfil para conferir o resultado. Obrigado por participar, {nome}!",
    ativo: false,
    disparosNoCiclo: 0,
  },
];

/* ── Campanhas mock ── */
interface Campanha {
  id: string;
  nome: string;
  publicoAlvo: string;
  totalDestinatarios: number;
  dataEnvio: Date | null;
  status: "Rascunho" | "Agendada" | "Enviada" | "Falhou";
  mensagem: string;
}

const campanhasMock: Campanha[] = [
  {
    id: "1",
    nome: "Reativação — clientes inativos",
    publicoAlvo: "Sem pedido há 30 dias",
    totalDestinatarios: 84,
    dataEnvio: new Date(2026, 2, 10, 14, 0),
    status: "Enviada",
    mensagem: "Oi {nome}, sentimos sua falta! 🍕 Peça hoje e ganhe cupons extras para o sorteio.",
  },
  {
    id: "2",
    nome: "Promoção relâmpago São Paulo",
    publicoAlvo: "Clientes em São Paulo",
    totalDestinatarios: 156,
    dataEnvio: new Date(2026, 2, 28, 10, 0),
    status: "Agendada",
    mensagem: "Olá {nome}! Promoção exclusiva para {cidade}: peça 2 pizzas e ganhe 5 cupons extras!",
  },
  {
    id: "3",
    nome: "Cadastro incompleto",
    publicoAlvo: "Nunca completaram cadastro",
    totalDestinatarios: 32,
    dataEnvio: null,
    status: "Rascunho",
    mensagem: "Oi {nome}, complete seu cadastro e comece a acumular cupons!",
  },
];

/* ── Helper ── */
function replaceVars(msg: string) {
  let out = msg;
  for (const [k, v] of Object.entries(SAMPLE_DATA)) out = out.split(k).join(v);
  return out;
}

function statusColor(s: string) {
  switch (s) {
    case "Enviada": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "Agendada": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "Falhou": return "bg-red-500/20 text-red-400 border-red-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function WhatsApp() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">💬 WhatsApp</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie disparos automáticos, campanhas manuais e relatórios de mensagens.
        </p>
      </div>

      <Tabs defaultValue="disparos" className="space-y-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="disparos" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
            <ClipboardList className="h-4 w-4" /> Disparos Automáticos
          </TabsTrigger>
          <TabsTrigger value="campanhas" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
            <Rocket className="h-4 w-4" /> Campanhas
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
            <BarChart3 className="h-4 w-4" /> Relatórios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="disparos"><DisparosTab /></TabsContent>
        <TabsContent value="campanhas"><CampanhasTab /></TabsContent>
        <TabsContent value="relatorios"><RelatoriosTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ═══════════════════════════════════════
   TAB — Disparos Automáticos
   ═══════════════════════════════════════ */
function DisparosTab() {
  const [disparos, setDisparos] = useState<DisparoAutomatico[]>(initialDisparos);
  const [editing, setEditing] = useState<DisparoAutomatico | null>(null);
  const [editMsg, setEditMsg] = useState("");

  const toggle = (id: string) =>
    setDisparos((prev) => prev.map((d) => (d.id === id ? { ...d, ativo: !d.ativo } : d)));

  const openEdit = (d: DisparoAutomatico) => {
    setEditing(d);
    setEditMsg(d.mensagemPadrao);
  };

  const saveEdit = () => {
    if (!editing) return;
    setDisparos((prev) => prev.map((d) => (d.id === editing.id ? { ...d, mensagemPadrao: editMsg } : d)));
    setEditing(null);
  };

  const insertVar = (v: string) => setEditMsg((p) => p + " " + v);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {disparos.map((d) => (
          <Card key={d.id} className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{d.nome}</CardTitle>
                <Badge variant="outline" className={d.ativo
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : "bg-muted text-muted-foreground border-border"}>
                  {d.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <CardDescription className="text-xs">{d.descricaoGatilho}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground line-clamp-3 bg-secondary/50 rounded-md p-2 italic">
                {d.mensagemPadrao}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  <Send className="inline h-3 w-3 mr-1" />{d.disparosNoCiclo} disparos no ciclo
                </span>
                <Switch checked={d.ativo} onCheckedChange={() => toggle(d.id)} />
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => openEdit(d)}>
                <Edit className="h-3.5 w-3.5 mr-1" /> Editar mensagem
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar mensagem — {editing?.nome}</DialogTitle>
            <DialogDescription>Use as variáveis abaixo para personalizar a mensagem.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map((v) => (
                <Badge key={v} variant="secondary" className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs" onClick={() => insertVar(v)}>
                  {v}
                </Badge>
              ))}
            </div>
            <Textarea value={editMsg} onChange={(e) => setEditMsg(e.target.value)} rows={5} className="text-sm" />
            <p className="text-xs text-muted-foreground">Caracteres: {editMsg.length}</p>
            <div className="rounded-md border border-border bg-secondary/40 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Preview:</p>
              <p className="text-sm">{replaceVars(editMsg)}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ═══════════════════════════════════════
   TAB — Campanhas
   ═══════════════════════════════════════ */
function CampanhasTab() {
  const [campanhas, setCampanhas] = useState<Campanha[]>(campanhasMock);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);

  /* wizard state */
  const [filtroInativos, setFiltroInativos] = useState(false);
  const [diasInativos, setDiasInativos] = useState(30);
  const [filtroCadastro, setFiltroCadastro] = useState(false);
  const [filtroCidade, setFiltroCidade] = useState(false);
  const [cidadeSel, setCidadeSel] = useState("");
  const [campNome, setCampNome] = useState("");
  const [campMsg, setCampMsg] = useState("");
  const [envioTipo, setEnvioTipo] = useState<"agora" | "agendar">("agora");
  const [envioData, setEnvioData] = useState("");
  const [envioHora, setEnvioHora] = useState("10:00");

  const estimativa = () => {
    let n = 0;
    if (filtroInativos) n += 84;
    if (filtroCadastro) n += 32;
    if (filtroCidade && cidadeSel) n += 156;
    return n || 0;
  };

  const resetWizard = () => {
    setStep(1);
    setFiltroInativos(false);
    setFiltroCadastro(false);
    setFiltroCidade(false);
    setCidadeSel("");
    setCampNome("");
    setCampMsg("");
    setEnvioTipo("agora");
    setEnvioData("");
    setEnvioHora("10:00");
  };

  const insertVarCamp = (v: string) => setCampMsg((p) => p + " " + v);

  const duplicar = (c: Campanha) => {
    const novo: Campanha = {
      ...c,
      id: crypto.randomUUID(),
      nome: c.nome + " (cópia)",
      status: "Rascunho",
      dataEnvio: null,
    };
    setCampanhas((prev) => [novo, ...prev]);
  };

  const excluir = (id: string) => setCampanhas((prev) => prev.filter((c) => c.id !== id));

  const salvarRascunho = () => {
    const novo: Campanha = {
      id: crypto.randomUUID(),
      nome: campNome || "Campanha sem nome",
      publicoAlvo: [
        filtroInativos && `Sem pedido há ${diasInativos} dias`,
        filtroCadastro && "Cadastro incompleto",
        filtroCidade && cidadeSel && `Cidade: ${cidadeSel}`,
      ].filter(Boolean).join(", ") || "Todos",
      totalDestinatarios: estimativa(),
      dataEnvio: null,
      status: "Rascunho",
      mensagem: campMsg,
    };
    setCampanhas((prev) => [novo, ...prev]);
    setWizardOpen(false);
    resetWizard();
  };

  const confirmarEnvio = () => {
    const novo: Campanha = {
      id: crypto.randomUUID(),
      nome: campNome || "Campanha sem nome",
      publicoAlvo: [
        filtroInativos && `Sem pedido há ${diasInativos} dias`,
        filtroCadastro && "Cadastro incompleto",
        filtroCidade && cidadeSel && `Cidade: ${cidadeSel}`,
      ].filter(Boolean).join(", ") || "Todos",
      totalDestinatarios: estimativa(),
      dataEnvio: envioTipo === "agora" ? new Date() : envioData ? new Date(envioData + "T" + envioHora) : new Date(),
      status: envioTipo === "agora" ? "Enviada" : "Agendada",
      mensagem: campMsg,
    };
    setCampanhas((prev) => [novo, ...prev]);
    setConfirmOpen(false);
    setWizardOpen(false);
    resetWizard();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Campanhas</h2>
        <Button onClick={() => { resetWizard(); setWizardOpen(true); }}>
          <Rocket className="h-4 w-4 mr-1" /> Nova Campanha
        </Button>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Público-alvo</TableHead>
                <TableHead className="text-center">Destinatários</TableHead>
                <TableHead>Data de envio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campanhas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{c.publicoAlvo}</TableCell>
                  <TableCell className="text-center">{c.totalDestinatarios}</TableCell>
                  <TableCell className="text-xs">
                    {c.dataEnvio ? format(c.dataEnvio, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor(c.status)}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => duplicar(c)} title="Duplicar"><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => excluir(c.id)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {campanhas.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma campanha criada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Wizard modal */}
      <Dialog open={wizardOpen} onOpenChange={(o) => { if (!o) { setWizardOpen(false); resetWizard(); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Campanha — Passo {step} de 3</DialogTitle>
            <DialogDescription>
              {step === 1 && "Quem vai receber essa mensagem?"}
              {step === 2 && "Escreva a mensagem da campanha"}
              {step === 3 && "Revise e agende o envio"}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicators */}
          <div className="flex items-center gap-2 mb-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/30">
                <Checkbox checked={filtroInativos} onCheckedChange={(v) => setFiltroInativos(!!v)} id="fi" />
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="fi" className="cursor-pointer">Clientes sem pedido há X dias</Label>
                  {filtroInativos && (
                    <div className="flex items-center gap-2">
                      <Input type="number" value={diasInativos} onChange={(e) => setDiasInativos(+e.target.value)} className="w-20 h-8" />
                      <span className="text-xs text-muted-foreground">dias</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/30">
                <Checkbox checked={filtroCadastro} onCheckedChange={(v) => setFiltroCadastro(!!v)} id="fc" />
                <Label htmlFor="fc" className="cursor-pointer">Clientes que nunca completaram o cadastro</Label>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/30">
                <Checkbox checked={filtroCidade} onCheckedChange={(v) => setFiltroCidade(!!v)} id="fci" />
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="fci" className="cursor-pointer">Clientes por cidade</Label>
                  {filtroCidade && (
                    <Select value={cidadeSel} onValueChange={setCidadeSel}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Selecione a cidade" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="São Paulo">São Paulo</SelectItem>
                        <SelectItem value="Campinas">Campinas</SelectItem>
                        <SelectItem value="Rio de Janeiro">Rio de Janeiro</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="rounded-md bg-primary/10 border border-primary/20 p-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Estimativa: {estimativa()} consumidores</span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label>Nome da campanha</Label>
                <Input value={campNome} onChange={(e) => setCampNome(e.target.value)} placeholder="Ex: Reativação março" className="mt-1" />
              </div>
              <div>
                <Label>Mensagem</Label>
                <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                  {VARIABLES.filter(v => ["{nome}","{total_cupons}","{pizzaria}","{cidade}"].includes(v)).map((v) => (
                    <Badge key={v} variant="secondary" className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs" onClick={() => insertVarCamp(v)}>
                      {v}
                    </Badge>
                  ))}
                </div>
                <Textarea value={campMsg} onChange={(e) => setCampMsg(e.target.value)} rows={4} placeholder="Escreva sua mensagem..." />
                <p className="text-xs text-muted-foreground mt-1">Caracteres: {campMsg.length}</p>
              </div>
              {campMsg && (
                <div className="rounded-md border border-border bg-secondary/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Preview:</p>
                  <p className="text-sm">{replaceVars(campMsg)}</p>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Quando enviar?</Label>
                <div className="flex gap-3">
                  <Button variant={envioTipo === "agora" ? "default" : "outline"} size="sm" onClick={() => setEnvioTipo("agora")}>Enviar agora</Button>
                  <Button variant={envioTipo === "agendar" ? "default" : "outline"} size="sm" onClick={() => setEnvioTipo("agendar")}>
                    <Calendar className="h-3.5 w-3.5 mr-1" /> Agendar
                  </Button>
                </div>
                {envioTipo === "agendar" && (
                  <div className="flex gap-2 mt-2">
                    <Input type="date" value={envioData} onChange={(e) => setEnvioData(e.target.value)} className="flex-1" />
                    <Input type="time" value={envioHora} onChange={(e) => setEnvioHora(e.target.value)} className="w-28" />
                  </div>
                )}
              </div>

              <Card className="border-border bg-secondary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Resumo</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1.5">
                  <p><span className="text-muted-foreground">Campanha:</span> {campNome || "Sem nome"}</p>
                  <p><span className="text-muted-foreground">Destinatários:</span> {estimativa()}</p>
                  <p><span className="text-muted-foreground">Envio:</span> {envioTipo === "agora" ? "Imediato" : `${envioData} às ${envioHora}`}</p>
                  {campMsg && <p className="text-xs italic text-muted-foreground mt-2 line-clamp-2">{campMsg}</p>}
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
            <div>
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {step === 3 && (
                <Button variant="outline" onClick={salvarRascunho}>Salvar como rascunho</Button>
              )}
              {step < 3 ? (
                <Button onClick={() => setStep(step + 1)}>
                  Próximo <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={() => setConfirmOpen(true)}>Confirmar envio</Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" /> Confirmar envio
            </DialogTitle>
            <DialogDescription>
              Você está prestes a enviar mensagem para <strong>{estimativa()}</strong> consumidores. Confirmar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarEnvio}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════
   TAB — Relatórios
   ═══════════════════════════════════════ */
function RelatoriosTab() {
  const stats = [
    { label: "Mensagens enviadas", value: "1.247", icon: Send, color: "text-primary" },
    { label: "Taxa de entrega", value: "96,3%", icon: CheckCircle2, color: "text-emerald-400" },
    { label: "Disparo mais acionado", value: "Novo Cupom", icon: MessageSquare, color: "text-primary" },
    { label: "Campanhas enviadas", value: "5", icon: Rocket, color: "text-amber-400" },
  ];

  const historico = [
    { nome: "Reativação — clientes inativos", data: "10/03/2026", publico: "Sem pedido há 30 dias", destinatarios: 84, status: "Enviada" },
    { nome: "Promoção Campinas", data: "01/03/2026", publico: "Cidade: Campinas", destinatarios: 62, status: "Enviada" },
    { nome: "Boas-vindas extra", data: "20/02/2026", publico: "Novos cadastros", destinatarios: 45, status: "Enviada" },
    { nome: "Teste de integração", data: "15/02/2026", publico: "Interno", destinatarios: 3, status: "Falhou" },
    { nome: "Black Friday Pizza", data: "29/11/2025", publico: "Todos", destinatarios: 320, status: "Enviada" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-secondary p-2.5">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Histórico de campanhas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Público</TableHead>
                <TableHead className="text-center">Destinatários</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historico.map((h, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{h.nome}</TableCell>
                  <TableCell className="text-xs">{h.data}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{h.publico}</TableCell>
                  <TableCell className="text-center">{h.destinatarios}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor(h.status)}>{h.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
