import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ClipboardList, Rocket, BarChart3, Edit, Send, Copy, Trash2,
  Calendar, Users, MessageSquare, CheckCircle2, Clock,
  ChevronRight, ChevronLeft, AlertTriangle, Building2, Zap, Plus, User,
  Search, RefreshCw, XCircle, Headphones,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { seqToLuckyRandom } from "@/lib/lucky-numbers";
import ExportButton from "@/components/gestor/ExportButton";
import { getWhatsAppAgentStatus, logoutWhatsAppAgent, processPendingWhatsApp, restartWhatsAppAgent, sendWhatsAppMessage, type WhatsAppAgentStatus } from "@/lib/whatsappAgent";
import { toast } from "sonner";

/* ── Variables ── */
const VARIABLES = [
  "{nome}", "{total_cupons}", "{qtd_cupons}", "{lista_cupons}", "{premio_1}",
  "{premio_2}", "{premio_3}", "{pizzaria}", "{data_sorteio}", "{cidade}",
  "{link_cadastro}",
];

const SAMPLE_DATA: Record<string, string> = {
  "{nome}": "Lucas Mendes",
  "{total_cupons}": "12",
  "{qtd_cupons}": "3",
  "{lista_cupons}": "🎟️ Cupom #001\n🎟️ Cupom #002\n🎟️ Cupom #003",
  "{premio_1}": "iPhone 15",
  "{premio_2}": "Smart TV 55\"",
  "{premio_3}": "Vale-compras R$500",
  "{pizzaria}": "Pizzaria Bella Napoli",
  "{data_sorteio}": "15/04/2026",
  "{cidade}": "São Paulo",
  "{link_cadastro}": "https://app.pizzapremiada.com.br/consumidor/cadastro?preCadastro=1",
};

/* ── Templates de disparo ── */
const SYSTEM_EVENTS = new Set(["pre_cadastro_site", "1", "2", "3"]);

const TRIGGER_EVENTS = [
  { id: "pre_cadastro_site", label: "Pré-cadastro pelo site / QR" },
  { id: "1", label: "Cadastro completo" },
  { id: "2", label: "Novo cupom gerado" },
  { id: "3", label: "Resultado do sorteio" },
];

interface Template {
  id: string;
  evento: string | null;
  nome: string;
  descricao: string;
  mensagem: string;
  ativo: boolean;
  tipo: "automatico" | "manual";
  audiencia: "todos" | "especifico";
  disparosNoCiclo: number;
}

const DEFAULT_TEMPLATES: Record<string, { nome: string; descricao: string; mensagem: string }> = {
  pre_cadastro_site: {
    nome: "Boas-vindas pré-cadastro",
    descricao: "Consumidor faz pré-cadastro pelo site ou QR das embalagens",
    mensagem: "Olá, {nome}! Seja bem-vindo(a) à Pizza Premiada 🍕\n\nSeu pré-cadastro foi recebido com sucesso.\n\nPara concorrer e ser contemplado nos prêmios, você precisa completar seu cadastro no sistema antes do sorteio.\n\nAcesse: {link_cadastro}",
  },
  "1": {
    nome: "Bem-vindo ao Cadastro",
    descricao: "Consumidor completa o cadastro e aceita os termos",
    mensagem: "Olá, {nome}! 🍕 Seu cadastro na Pizza Premiada foi confirmado. A partir de agora, cada pizza que você pedir gera cupons para concorrer a prêmios incríveis. Boa sorte!",
  },
  "2": {
    nome: "Novo Cupom Gerado",
    descricao: "Cupom é gerado após um pedido",
    mensagem: "Oi, {nome}! Você ganhou {qtd_cupons} cupom(ns) novo(s) 🎟️ Agora você tem {total_cupons} cupons no total. Continue pedindo e aumente suas chances de ganhar {premio_1}!",
  },
  "3": {
    nome: "Resultado do Sorteio",
    descricao: "Gestor marca o sorteio como realizado",
    mensagem: "🎉 O sorteio da Pizza Premiada aconteceu! Os ganhadores foram anunciados. Acesse seu perfil para conferir o resultado. Obrigado por participar, {nome}!",
  },
};

/* ── Campanhas WhatsApp ── */
interface Campanha {
  id: string;
  nome: string;
  publicoAlvo: string;
  totalDestinatarios: number;
  dataEnvio: Date | null;
  status: "Rascunho" | "Agendada" | "Enviada" | "Falhou";
  mensagem: string;
}

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

function AgentStatusCard() {
  const [status, setStatus] = useState<WhatsAppAgentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = async () => {
    try {
      const next = await getWhatsAppAgentStatus();
      setStatus(next);
      setError("");
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Não foi possível conectar ao agente WhatsApp.");
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = window.setInterval(loadStatus, 4000);
    return () => window.clearInterval(interval);
  }, []);

  const runAction = async (action: "restart" | "logout" | "process") => {
    setLoading(true);
    try {
      if (action === "restart") setStatus(await restartWhatsAppAgent());
      if (action === "logout") setStatus(await logoutWhatsAppAgent());
      if (action === "process") {
        const result = await processPendingWhatsApp();
        toast.success(`${result.processed} disparo(s) processado(s).`);
        await loadStatus();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao executar ação no agente.");
    } finally {
      setLoading(false);
    }
  };

  const connected = status?.status === "ready";

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Canal WhatsApp Pizza Premiada</CardTitle>
            <CardDescription>Número principal: 62994844792. O agente processa automaticamente disparos pendentes.</CardDescription>
          </div>
          <Badge className={connected ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground border-border"} variant="outline">
            {status?.status ?? "offline"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {status?.qr && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <img src={status.qr} alt="QR Code para conectar WhatsApp" className="h-44 w-44 rounded-lg border border-border bg-white p-2" />
            <p className="text-sm text-muted-foreground">Escaneie este QR Code com o WhatsApp do número principal para ativar o canal exclusivo da Pizza Premiada.</p>
          </div>
        )}
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <div><span className="text-muted-foreground">Número conectado:</span><br />{status?.connectedNumber || "—"}</div>
          <div><span className="text-muted-foreground">Fila:</span><br />{status?.processingQueue ? "Processando" : "Aguardando"}</div>
          <div><span className="text-muted-foreground">Último erro:</span><br />{status?.lastError || "—"}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={loading} onClick={() => loadStatus()}>Atualizar</Button>
          <Button variant="outline" disabled={loading} onClick={() => runAction("restart")}>Reiniciar canal</Button>
          <Button variant="outline" disabled={loading || !connected} onClick={() => runAction("process")}>Processar fila agora</Button>
          <Button variant="destructive" disabled={loading} onClick={() => runAction("logout")}>Desconectar</Button>
        </div>
      </CardContent>
    </Card>
  );
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

      <AgentStatusCard />

      <Tabs defaultValue="disparos" className="space-y-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="disparos" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
            <ClipboardList className="h-4 w-4" /> Disparos
          </TabsTrigger>
          <TabsTrigger value="campanhas" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
            <Rocket className="h-4 w-4" /> Campanhas
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
            <BarChart3 className="h-4 w-4" /> Relatórios
          </TabsTrigger>
          <TabsTrigger value="chamados" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
            <Headphones className="h-4 w-4" /> Chamados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="disparos"><DisparosTab /></TabsContent>
        <TabsContent value="campanhas"><CampanhasTab /></TabsContent>
        <TabsContent value="relatorios"><RelatoriosTab /></TabsContent>
        <TabsContent value="chamados"><ChamadosTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ═══════════════════════════════════════
   TAB — Disparos Automáticos
   ═══════════════════════════════════════ */
function DisparosTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState<Template | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingTpl, setSendingTpl] = useState<Template | null>(null);

  // form state
  const [fNome, setFNome] = useState("");
  const [fTipo, setFTipo] = useState<"automatico" | "manual">("manual");
  const [fEvento, setFEvento] = useState("");
  const [fAudiencia, setFAudiencia] = useState<"todos" | "especifico">("especifico");
  const [fDescricao, setFDescricao] = useState("");
  const [fMensagem, setFMensagem] = useState("");
  const [fAtivo, setFAtivo] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: rows }, { data: counts }] = await Promise.all([
      supabase.from("whatsapp_templates").select("*").order("criado_em", { ascending: true }),
      supabase.from("disparos_whatsapp").select("evento"),
    ]);
    const countMap = new Map<string, number>();
    (counts || []).forEach((c: any) => countMap.set(c.evento, (countMap.get(c.evento) ?? 0) + 1));

    const dbByEvento = new Map((rows || []).filter((r: any) => r.evento).map((r: any) => [r.evento, r]));

    const systemTpls: Template[] = Object.entries(DEFAULT_TEMPLATES).map(([evId, def]) => {
      const row: any = dbByEvento.get(evId);
      return {
        id: row?.id ?? evId,
        evento: evId,
        nome: row?.nome ?? def.nome,
        descricao: row?.descricao ?? def.descricao,
        mensagem: row?.mensagem ?? def.mensagem,
        ativo: row?.ativo !== false,
        tipo: "automatico",
        audiencia: "todos",
        disparosNoCiclo: countMap.get(evId) ?? 0,
      };
    });

    const manualTpls: Template[] = (rows || [])
      .filter((r: any) => r.tipo === "manual")
      .map((r: any) => ({
        id: r.id,
        evento: r.evento ?? null,
        nome: r.nome,
        descricao: r.descricao ?? "",
        mensagem: r.mensagem,
        ativo: r.ativo,
        tipo: "manual" as const,
        audiencia: (r.audiencia ?? "especifico") as "todos" | "especifico",
        disparosNoCiclo: countMap.get(r.evento ?? r.id) ?? 0,
      }));

    setTemplates([...systemTpls, ...manualTpls]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingTpl(null);
    setFNome(""); setFTipo("manual"); setFEvento(""); setFAudiencia("especifico");
    setFDescricao(""); setFMensagem(""); setFAtivo(true);
    setDialogOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditingTpl(t);
    setFNome(t.nome); setFTipo(t.tipo); setFEvento(t.evento ?? "");
    setFAudiencia(t.audiencia); setFDescricao(t.descricao); setFMensagem(t.mensagem); setFAtivo(t.ativo);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!fNome.trim() || !fMensagem.trim()) return;
    setSaving(true);
    const isSystem = editingTpl?.tipo === "automatico" && SYSTEM_EVENTS.has(editingTpl.evento ?? "");
    if (editingTpl) {
      if (isSystem) {
        await supabase.from("whatsapp_templates").upsert({
          evento: editingTpl.evento!, nome: fNome, descricao: fDescricao, mensagem: fMensagem,
          ativo: fAtivo, tipo: "automatico", audiencia: "todos", atualizado_em: new Date().toISOString(),
        } as any, { onConflict: "evento" });
      } else {
        await supabase.from("whatsapp_templates").update({
          nome: fNome, descricao: fDescricao, mensagem: fMensagem, ativo: fAtivo,
          audiencia: fTipo === "manual" ? fAudiencia : "todos", atualizado_em: new Date().toISOString(),
        } as any).eq("id", editingTpl.id);
      }
    } else {
      const id = crypto.randomUUID();
      await supabase.from("whatsapp_templates").insert({
        id, evento: fTipo === "automatico" ? fEvento : id,
        nome: fNome, descricao: fDescricao || null, mensagem: fMensagem,
        ativo: fAtivo, tipo: fTipo, audiencia: fTipo === "manual" ? fAudiencia : "todos",
        atualizado_em: new Date().toISOString(),
      } as any);
    }
    setSaving(false);
    setDialogOpen(false);
    toast.success("Template salvo.");
    load();
  };

  const toggleAtivo = async (t: Template) => {
    setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, ativo: !x.ativo } : x));
    await supabase.from("whatsapp_templates").upsert({
      evento: t.evento ?? t.id, nome: t.nome, mensagem: t.mensagem,
      ativo: !t.ativo, tipo: t.tipo, audiencia: t.audiencia, atualizado_em: new Date().toISOString(),
    } as any, { onConflict: "evento" }).then(({ error }) => {
      if (error) toast.error("Erro ao salvar.");
    });
  };

  const deleteTpl = async (t: Template) => {
    if (SYSTEM_EVENTS.has(t.evento ?? "")) return;
    setTemplates(prev => prev.filter(x => x.id !== t.id));
    await supabase.from("whatsapp_templates").delete().eq("id", t.id);
    toast.success("Template excluído.");
  };

  if (loading) return <div className="flex justify-center py-20 text-muted-foreground text-sm">Carregando templates…</div>;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Templates de Disparo</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Gerencie disparos automáticos e manuais em um só lugar.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> Novo Template
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map(t => (
          <Card key={t.id} className="border-border bg-card flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base leading-tight">{t.nome}</CardTitle>
                  {t.descricao && <CardDescription className="text-xs mt-0.5 line-clamp-2">{t.descricao}</CardDescription>}
                </div>
                <div className="flex flex-col gap-1 shrink-0 items-end">
                  <Badge variant="outline" className={t.tipo === "automatico"
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs"
                    : "bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs"}>
                    {t.tipo === "automatico" ? "⚙️ Auto" : "⚡ Manual"}
                  </Badge>
                  {t.tipo === "manual" && (
                    <Badge variant="outline" className="bg-secondary text-muted-foreground border-border text-xs">
                      {t.audiencia === "todos" ? "👥 Todos" : "👤 Específico"}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 flex-1 flex flex-col justify-between">
              <p className="text-xs text-muted-foreground line-clamp-3 bg-secondary/50 rounded-md p-2 italic">
                {t.mensagem}
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    <Send className="inline h-3 w-3 mr-1" />{t.disparosNoCiclo} disparos
                  </span>
                  {t.tipo === "automatico"
                    ? <Switch checked={t.ativo} onCheckedChange={() => toggleAtivo(t)} />
                    : <Switch checked={t.ativo} onCheckedChange={() => toggleAtivo(t)} />
                  }
                </div>
                {t.tipo === "manual" && (
                  <Button size="sm" className="w-full" onClick={() => { setSendingTpl(t); setSendDialogOpen(true); }}>
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Disparar agora
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(t)}>
                    <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  {!SYSTEM_EVENTS.has(t.evento ?? "") && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteTpl(t)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={o => !o && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTpl ? "Editar template" : "Novo template"}</DialogTitle>
            <DialogDescription>Configure o tipo, audiência e mensagem.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={fNome} onChange={e => setFNome(e.target.value)} placeholder="Ex: Reativação de clientes" />
            </div>

            {/* Tipo — bloqueado na edição */}
            <div className="space-y-1.5">
              <Label>Tipo de disparo</Label>
              <div className="flex gap-2">
                {(["automatico", "manual"] as const).map(tipo => (
                  <Button key={tipo} size="sm"
                    variant={fTipo === tipo ? "default" : "outline"}
                    onClick={() => setFTipo(tipo)}
                    disabled={!!editingTpl}>
                    {tipo === "automatico" ? <><Clock className="h-3.5 w-3.5 mr-1.5" /> Automático</> : <><Zap className="h-3.5 w-3.5 mr-1.5" /> Manual</>}
                  </Button>
                ))}
              </div>
              {editingTpl && <p className="text-xs text-muted-foreground">O tipo não pode ser alterado após a criação.</p>}
            </div>

            {fTipo === "automatico" && !editingTpl && (
              <div className="space-y-1.5">
                <Label>Evento gatilho</Label>
                <Select value={fEvento} onValueChange={setFEvento}>
                  <SelectTrigger><SelectValue placeholder="Selecione o gatilho" /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_EVENTS.map(e => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {fTipo === "manual" && (
              <div className="space-y-1.5">
                <Label>Audiência</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant={fAudiencia === "todos" ? "default" : "outline"} onClick={() => setFAudiencia("todos")}>
                    <Users className="h-3.5 w-3.5 mr-1.5" /> Todos os clientes
                  </Button>
                  <Button size="sm" variant={fAudiencia === "especifico" ? "default" : "outline"} onClick={() => setFAudiencia("especifico")}>
                    <User className="h-3.5 w-3.5 mr-1.5" /> Cliente específico
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Descrição <span className="text-muted-foreground">(opcional)</span></Label>
              <Input value={fDescricao} onChange={e => setFDescricao(e.target.value)} placeholder="Descreva o objetivo deste template" />
            </div>

            <div className="space-y-1.5">
              <Label>Mensagem</Label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {VARIABLES.map(v => (
                  <Badge key={v} variant="secondary" className="cursor-pointer text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => setFMensagem(p => p + " " + v)}>{v}</Badge>
                ))}
              </div>
              <Textarea value={fMensagem} onChange={e => setFMensagem(e.target.value)} rows={4} placeholder="Escreva a mensagem…" />
              <p className="text-xs text-muted-foreground">{fMensagem.length} caracteres</p>
            </div>

            {fMensagem && (
              <div className="rounded-md border border-border bg-secondary/40 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Preview (dados de exemplo):</p>
                <p className="text-sm whitespace-pre-wrap">{replaceVars(fMensagem)}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch checked={fAtivo} onCheckedChange={setFAtivo} />
              <span className="text-sm">{fAtivo ? "Template ativo" : "Template inativo"}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !fNome.trim() || !fMensagem.trim()}>
              {saving ? "Salvando…" : "Salvar template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send dialog for manual templates */}
      {sendingTpl && (
        <ManualSendDialog
          open={sendDialogOpen}
          template={sendingTpl}
          onClose={() => { setSendDialogOpen(false); setSendingTpl(null); }}
          onSent={() => { setSendDialogOpen(false); setSendingTpl(null); load(); }}
        />
      )}
    </>
  );
}

type Recipient = { id: string; nome: string; telefone: string };

/* ═══════════════════════════════════════
   DIALOG — Disparar Template Manual
   ═══════════════════════════════════════ */
interface ManualSendDialogProps {
  open: boolean;
  template: Template;
  onClose: () => void;
  onSent: () => void;
}

function ManualSendDialog({ open, template, onClose, onSent }: ManualSendDialogProps) {
  const [recipientType, setRecipientType] = useState<"consumidor" | "pizzaria">("consumidor");
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selected, setSelected] = useState<Recipient | null>(null);
  const [pizzariasList, setPizzariasList] = useState<Recipient[]>([]);
  const [consumidoresList, setConsumidoresList] = useState<Recipient[]>([]);
  const [allConsumidores, setAllConsumidores] = useState<Recipient[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [cupomList, setCupomList] = useState("");
  const [loadingCupons, setLoadingCupons] = useState(false);
  const [consumerInfo, setConsumerInfo] = useState<{ pizzaria: string; totalCupons: number; cidade: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendTotal, setSendTotal] = useState(0);

  useEffect(() => {
    if (!open) {
      setSearch(""); setSelected(null); setConsumerInfo(null); setCupomList("");
      setConfirmOpen(false); setSendProgress(0); setSendTotal(0);
      return;
    }
    const load = async () => {
      setLoadingData(true);
      if (template.audiencia === "especifico") {
        const [{ data: pizzData }, { data: consData }] = await Promise.all([
          supabase.from("pizzarias").select("id, nome, telefone").not("telefone", "is", null).neq("telefone", ""),
          supabase.from("consumidores").select("id, usuarios(nome, telefone)"),
        ]);
        setPizzariasList((pizzData || []).map((p: any) => ({ id: p.id, nome: p.nome, telefone: p.telefone })));
        setConsumidoresList(
          (consData || [])
            .filter((c: any) => c.usuarios?.telefone)
            .map((c: any) => ({ id: c.id, nome: c.usuarios.nome || "—", telefone: c.usuarios.telefone })),
        );
      } else {
        const { data: consData } = await supabase.from("consumidores").select("id, usuarios(nome, telefone)");
        setAllConsumidores(
          (consData || [])
            .filter((c: any) => c.usuarios?.telefone)
            .map((c: any) => ({ id: c.id, nome: c.usuarios.nome || "—", telefone: c.usuarios.telefone })),
        );
      }
      setLoadingData(false);
    };
    load();
  }, [open, template.audiencia]);

  useEffect(() => {
    if (recipientType !== "consumidor" || !selected) {
      setCupomList(""); setConsumerInfo(null); return;
    }
    const fetchCupons = async () => {
      setLoadingCupons(true);
      const { data: consRow } = await supabase
        .from("consumidores").select("campanha_id, cidade, pizzarias(nome)").eq("id", selected.id).single();
      const cidade: string = (consRow as any)?.cidade ?? "";
      const pizzaria: string = (consRow as any)?.pizzarias?.nome ?? "";
      if (!consRow?.campanha_id) {
        setConsumerInfo({ pizzaria, totalCupons: 0, cidade });
        setCupomList("Nenhum cupom acumulado"); setLoadingCupons(false); return;
      }
      const campanhaId = consRow.campanha_id;
      const { data: campRow } = await supabase.from("campanhas").select("num_series").eq("id", campanhaId).single();
      const numSeries: number = campRow?.num_series ?? 5;
      const { data: todos } = await supabase
        .from("cupons").select("consumidor_id, quantidade")
        .eq("campanha_id", campanhaId).eq("status", "validado").order("criado_em", { ascending: true });
      if (!todos) {
        setConsumerInfo({ pizzaria, totalCupons: 0, cidade });
        setCupomList("Nenhum cupom acumulado"); setLoadingCupons(false); return;
      }
      let cur = 1;
      const luckyNums: string[] = [];
      for (const c of todos) {
        for (let i = 0; i < ((c as any).quantidade || 0); i++) {
          if ((c as any).consumidor_id === selected.id)
            luckyNums.push(seqToLuckyRandom(cur, numSeries, campanhaId));
          cur++;
        }
      }
      setConsumerInfo({ pizzaria, totalCupons: luckyNums.length, cidade });
      setCupomList(luckyNums.length > 0 ? luckyNums.join("\n") : "Nenhum cupom acumulado");
      setLoadingCupons(false);
    };
    fetchCupons();
  }, [selected, recipientType]);

  const list = recipientType === "pizzaria" ? pizzariasList : consumidoresList;
  const filtered = search.length >= 2
    ? list.filter(r => r.nome.toLowerCase().includes(search.toLowerCase()) || r.telefone.includes(search)).slice(0, 8)
    : [];

  const resolveMsg = (msg: string) =>
    msg
      .replace("{nome}", selected?.nome ?? "{nome}")
      .replace("{pizzaria}", consumerInfo?.pizzaria ?? "{pizzaria}")
      .replace("{total_cupons}", consumerInfo != null ? String(consumerInfo.totalCupons) : "{total_cupons}")
      .replace("{cidade}", consumerInfo?.cidade ?? "{cidade}")
      .replace("{lista_cupons}", cupomList || "{lista_cupons}");

  const handleSendEspecifico = async () => {
    if (!selected || sending) return;
    setSending(true);
    try {
      const raw = selected.telefone.replace(/\D/g, "");
      const phone = raw.startsWith("55") ? raw : "55" + raw;
      const finalMsg = resolveMsg(template.mensagem.trim());
      await sendWhatsAppMessage(phone, finalMsg);
      if (recipientType === "consumidor") {
        await supabase.from("disparos_whatsapp").insert({
          consumidor_id: selected.id, tipo: "campanha",
          evento: template.evento ?? template.id,
          mensagem: finalMsg, status: "enviado",
          enviado_em: new Date().toISOString(),
        });
      }
      toast.success(`Mensagem enviada para ${selected.nome}!`);
      setConfirmOpen(false);
      onSent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar mensagem.");
      setSending(false);
    }
  };

  const handleSendTodos = async () => {
    setSending(true);
    setSendTotal(allConsumidores.length);
    setSendProgress(0);
    let sent = 0;
    for (const consumer of allConsumidores) {
      try {
        const raw = consumer.telefone.replace(/\D/g, "");
        const phone = raw.startsWith("55") ? raw : "55" + raw;
        const finalMsg = template.mensagem.replace("{nome}", consumer.nome);
        await sendWhatsAppMessage(phone, finalMsg);
        await supabase.from("disparos_whatsapp").insert({
          consumidor_id: consumer.id, tipo: "campanha",
          evento: template.evento ?? template.id,
          mensagem: finalMsg, status: "enviado",
          enviado_em: new Date().toISOString(),
        });
        sent++;
      } catch { /* continue on per-message error */ }
      setSendProgress(p => p + 1);
    }
    toast.success(`${sent} de ${allConsumidores.length} mensagens enviadas.`);
    setSending(false);
    setConfirmOpen(false);
    onSent();
  };

  const needsCupons = template.mensagem.includes("{lista_cupons}");
  const canSend = template.audiencia === "todos"
    ? !loadingData && allConsumidores.length > 0
    : !!selected && !(needsCupons && loadingCupons);

  const bulkUnresolvable = template.audiencia === "todos"
    ? ["{pizzaria}", "{total_cupons}", "{cidade}", "{lista_cupons}"].filter(v => template.mensagem.includes(v))
    : [];

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !sending) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" /> Disparar: {template.nome}
          </DialogTitle>
          <DialogDescription>
            {template.audiencia === "todos"
              ? "Envio em massa para todos os consumidores com telefone"
              : "Selecione o destinatário e confirme o envio."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-md border border-border bg-secondary/40 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Preview{selected ? " (dados reais)" : " (dados de exemplo)"}:
            </p>
            <p className="text-sm whitespace-pre-wrap">
              {template.audiencia === "especifico" && selected
                ? resolveMsg(template.mensagem)
                : replaceVars(template.mensagem)}
            </p>
          </div>

          {template.audiencia === "especifico" && (
            <>
              <div className="space-y-1.5">
                <Label>Tipo de destinatário</Label>
                <div className="flex gap-2">
                  <Button variant={recipientType === "consumidor" ? "default" : "outline"} size="sm"
                    onClick={() => { setRecipientType("consumidor"); setSelected(null); setSearch(""); setConsumerInfo(null); }}>
                    <Users className="h-3.5 w-3.5 mr-1.5" /> Consumidor
                  </Button>
                  <Button variant={recipientType === "pizzaria" ? "default" : "outline"} size="sm"
                    onClick={() => { setRecipientType("pizzaria"); setSelected(null); setSearch(""); setConsumerInfo(null); }}>
                    <Building2 className="h-3.5 w-3.5 mr-1.5" /> Pizzaria
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Destinatário</Label>
                {selected ? (
                  <div className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{selected.nome}</p>
                      <p className="text-xs text-muted-foreground">{selected.telefone}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={() => { setSelected(null); setSearch(""); }}>
                      Trocar
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder={`Buscar ${recipientType === "consumidor" ? "consumidor" : "pizzaria"} por nome ou telefone…`}
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      onFocus={() => setShowResults(true)}
                      onBlur={() => setTimeout(() => setShowResults(false), 150)}
                      disabled={loadingData}
                    />
                    {showResults && search.length >= 2 && (
                      <div className="absolute z-20 top-full mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-52 overflow-y-auto">
                        {filtered.length > 0 ? filtered.map(r => (
                          <button key={r.id} className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors"
                            onMouseDown={() => { setSelected(r); setSearch(""); setShowResults(false); }}>
                            <p className="text-sm font-medium">{r.nome}</p>
                            <p className="text-xs text-muted-foreground">{r.telefone}</p>
                          </button>
                        )) : (
                          <p className="px-3 py-3 text-sm text-muted-foreground">Nenhum resultado encontrado.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {loadingCupons && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3 animate-spin" /> Carregando cupons…
                </p>
              )}
            </>
          )}

          {template.audiencia === "todos" && (
            <>
              <div className="rounded-md bg-primary/10 border border-primary/20 p-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {loadingData ? "Carregando…" : `${allConsumidores.length} consumidores receberão esta mensagem`}
                </span>
              </div>
              {bulkUnresolvable.length > 0 && (
                <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3">
                  <p className="text-xs font-medium text-amber-400 mb-1">⚠️ Variáveis não resolvidas no envio em massa:</p>
                  <p className="text-xs text-muted-foreground">
                    {bulkUnresolvable.join(", ")} — estas variáveis exigem dados individuais e não serão substituídas.
                  </p>
                </div>
              )}
              {sending && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Enviando mensagens…</span>
                    <span>{sendProgress} / {sendTotal}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: sendTotal > 0 ? `${(sendProgress / sendTotal) * 100}%` : "0%" }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancelar</Button>
          <Button onClick={() => setConfirmOpen(true)} disabled={!canSend || sending}>
            <Send className="h-3.5 w-3.5 mr-1.5" />
            {template.audiencia === "todos" ? `Disparar para ${allConsumidores.length}` : "Disparar"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <Dialog open={confirmOpen} onOpenChange={o => { if (!sending) setConfirmOpen(o); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" /> Confirmar disparo
            </DialogTitle>
            <DialogDescription>
              {template.audiencia === "todos"
                ? `Você está prestes a enviar para ${allConsumidores.length} consumidores. Esta ação não pode ser desfeita.`
                : `Confirmar envio para ${selected?.nome ?? "—"}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={sending}>Voltar</Button>
            <Button onClick={template.audiencia === "todos" ? handleSendTodos : handleSendEspecifico} disabled={sending}>
              {sending
                ? <><Clock className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Enviando…</>
                : <><Send className="h-3.5 w-3.5 mr-1.5" /> Confirmar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

/* ═══════════════════════════════════════
   TAB — Campanhas
   ═══════════════════════════════════════ */
function CampanhasTab() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
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

  const [estimativaCount, setEstimativaCount] = useState(0);
  const [loadingEstimativa, setLoadingEstimativa] = useState(false);
  const [cidades, setCidades] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from("usuarios")
      .select("cidade")
      .not("cidade", "is", null)
      .neq("cidade", "")
      .then(({ data }) => {
        const unicas = [...new Set((data || []).map((u: any) => u.cidade).filter(Boolean))].sort() as string[];
        setCidades(unicas);
      });
  }, []);

  useEffect(() => {
    const anyActive = filtroInativos || filtroCadastro || (filtroCidade && !!cidadeSel);
    if (!anyActive) { setEstimativaCount(0); return; }

    const timeout = setTimeout(async () => {
      setLoadingEstimativa(true);
      const matchingIds = new Set<string>();

      if (filtroInativos) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - diasInativos);
        const [{ data: allC }, { data: recentP }] = await Promise.all([
          supabase.from("consumidores").select("id"),
          supabase.from("pedidos").select("consumidor_id").gte("data_pedido", cutoff.toISOString()).neq("status", "cancelado"),
        ]);
        const recentIds = new Set((recentP || []).map((p: any) => p.consumidor_id).filter(Boolean));
        (allC || []).forEach((c: any) => { if (!recentIds.has(c.id)) matchingIds.add(c.id); });
      }

      if (filtroCadastro) {
        const [{ data: allC }, { data: comPedido }] = await Promise.all([
          supabase.from("consumidores").select("id"),
          supabase.from("pedidos").select("consumidor_id").neq("status", "cancelado"),
        ]);
        const comPedidoIds = new Set((comPedido || []).map((p: any) => p.consumidor_id).filter(Boolean));
        (allC || []).forEach((c: any) => { if (!comPedidoIds.has(c.id)) matchingIds.add(c.id); });
      }

      if (filtroCidade && cidadeSel) {
        const { data } = await supabase
          .from("consumidores")
          .select("id, usuarios!inner(cidade)")
          .eq("usuarios.cidade", cidadeSel);
        (data || []).forEach((c: any) => matchingIds.add(c.id));
      }

      setEstimativaCount(matchingIds.size);
      setLoadingEstimativa(false);
    }, 400);

    return () => clearTimeout(timeout);
  }, [filtroInativos, diasInativos, filtroCadastro, filtroCidade, cidadeSel]);

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
      totalDestinatarios: estimativaCount,
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
      totalDestinatarios: estimativaCount,
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
        <div className="flex gap-2">
          <ExportButton
            data={campanhas.map(c => ({
              nome: c.nome, publico: c.publicoAlvo, destinatarios: c.totalDestinatarios,
              data: c.dataEnvio ? format(c.dataEnvio, "dd/MM/yyyy HH:mm") : "—", status: c.status,
            }))}
            columns={[
              { key: "nome", label: "Nome" }, { key: "publico", label: "Público-alvo" },
              { key: "destinatarios", label: "Destinatários" }, { key: "data", label: "Data Envio" },
              { key: "status", label: "Status" },
            ]}
            fileName="whatsapp-campanhas"
          />
          <Button onClick={() => { resetWizard(); setWizardOpen(true); }}>
            <Rocket className="h-4 w-4 mr-1" /> Nova Campanha
          </Button>
        </div>
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
                        {cidades.length > 0
                          ? cidades.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)
                          : <SelectItem value="_none" disabled>Nenhuma cidade encontrada</SelectItem>
                        }
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="rounded-md bg-primary/10 border border-primary/20 p-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {loadingEstimativa ? "Calculando…" : `Estimativa: ${estimativaCount} consumidores`}
                </span>
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
                  <p><span className="text-muted-foreground">Destinatários:</span> {estimativaCount}</p>
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
              Você está prestes a enviar mensagem para <strong>{estimativaCount}</strong> consumidores. Confirmar?
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
   TAB — Chamados (Central de Atendimento)
   ═══════════════════════════════════════ */
function ChamadosTab() {
  const [chamados, setChamados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "aberto" | "fechado">("todos");
  const [selectedChamado, setSelectedChamado] = useState<any | null>(null);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [novoChamadoOpen, setNovoChamadoOpen] = useState(false);
  const [searchCons, setSearchCons] = useState("");
  const [showConsList, setShowConsList] = useState(false);
  const [todosCons, setTodosCons] = useState<{ id: string; nome: string; telefone: string }[]>([]);
  const [selectedCons, setSelectedCons] = useState<{ id: string; nome: string; telefone: string } | null>(null);
  const [assunto, setAssunto] = useState("");
  const [criando, setCriando] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchChamados = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("chamados_whatsapp")
      .select("*, consumidores(id, usuarios(nome, telefone))")
      .order("criado_em", { ascending: false });
    setChamados(data ?? []);
    setLoading(false);
  };

  const fetchMensagens = async (chamadoId: string) => {
    setLoadingMsgs(true);
    const { data } = await supabase
      .from("disparos_whatsapp")
      .select("*")
      .eq("chamado_id", chamadoId)
      .order("criado_em", { ascending: true });
    setMensagens(data ?? []);
    setLoadingMsgs(false);
  };

  useEffect(() => { fetchChamados(); }, []);

  useEffect(() => {
    if (!novoChamadoOpen) return;
    supabase.from("consumidores").select("id, usuarios(nome, telefone)").then(({ data }) => {
      setTodosCons(
        (data ?? [])
          .filter((c: any) => c.usuarios?.telefone)
          .map((c: any) => ({ id: c.id, nome: c.usuarios.nome ?? "—", telefone: c.usuarios.telefone }))
      );
    });
  }, [novoChamadoOpen]);

  useEffect(() => {
    if (selectedChamado) fetchMensagens(selectedChamado.id);
    else setMensagens([]);
  }, [selectedChamado]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  const chamadosFiltrados = chamados.filter(c => {
    const nome: string = c.consumidores?.usuarios?.nome ?? "";
    const proto: string = c.protocolo ?? "";
    const matchSearch = !search ||
      nome.toLowerCase().includes(search.toLowerCase()) ||
      proto.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === "todos" || c.status === filtroStatus;
    return matchSearch && matchStatus;
  });

  const consFiltrados = searchCons.length >= 2
    ? todosCons.filter(c =>
        c.nome.toLowerCase().includes(searchCons.toLowerCase()) ||
        c.telefone.includes(searchCons)
      ).slice(0, 8)
    : [];

  const gerarProtocolo = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return "PP-" + code;
  };

  const criarChamado = async () => {
    if (!selectedCons || criando) return;
    setCriando(true);
    const { data, error } = await supabase
      .from("chamados_whatsapp")
      .insert({
        consumidor_id: selectedCons.id,
        protocolo: gerarProtocolo(),
        status: "aberto",
        assunto: assunto.trim() || null,
      })
      .select("*, consumidores(id, usuarios(nome, telefone))")
      .single();
    setCriando(false);
    if (error) { toast.error("Erro ao criar chamado."); return; }
    setChamados(prev => [data, ...prev]);
    setSelectedChamado(data);
    setNovoChamadoOpen(false);
    setSearchCons(""); setSelectedCons(null); setAssunto("");
    toast.success(`Chamado ${data.protocolo} criado.`);
  };

  const enviarMensagem = async () => {
    if (!selectedChamado || !novaMensagem.trim() || enviando) return;
    setEnviando(true);
    try {
      const tel: string = selectedChamado.consumidores?.usuarios?.telefone ?? "";
      const raw = tel.replace(/\D/g, "");
      const phone = raw.startsWith("55") ? raw : "55" + raw;
      await sendWhatsAppMessage(phone, novaMensagem.trim());
      const { data: msg } = await supabase.from("disparos_whatsapp").insert({
        consumidor_id: selectedChamado.consumidor_id,
        chamado_id: selectedChamado.id,
        tipo: "manual",
        evento: "chamado",
        mensagem: novaMensagem.trim(),
        status: "enviado",
        direcao: "saida",
        enviado_em: new Date().toISOString(),
      }).select().single();
      if (msg) setMensagens(prev => [...prev, msg]);
      setNovaMensagem("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar mensagem.");
    }
    setEnviando(false);
  };

  const toggleStatus = async () => {
    if (!selectedChamado) return;
    const novoStatus = selectedChamado.status === "aberto" ? "fechado" : "aberto";
    const updates: any = {
      status: novoStatus,
      fechado_em: novoStatus === "fechado" ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("chamados_whatsapp").update(updates).eq("id", selectedChamado.id);
    if (error) { toast.error("Erro ao atualizar chamado."); return; }
    const updated = { ...selectedChamado, ...updates };
    setChamados(prev => prev.map(c => c.id === selectedChamado.id ? updated : c));
    setSelectedChamado(updated);
    toast.success(novoStatus === "fechado" ? "Chamado encerrado." : "Chamado reaberto.");
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Central de Atendimento</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Gerencie chamados e conversas com consumidores.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchChamados} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button size="sm" onClick={() => setNovoChamadoOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo Chamado
          </Button>
        </div>
      </div>

      <div className="flex gap-0 rounded-lg border border-border overflow-hidden" style={{ height: "calc(100vh - 360px)", minHeight: 500 }}>
        {/* Left panel — chamados list */}
        <div className="w-[30%] min-w-[220px] border-r border-border flex flex-col bg-card">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Protocolo ou cliente…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="flex gap-1">
              {(["todos", "aberto", "fechado"] as const).map(s => (
                <Button
                  key={s}
                  variant={filtroStatus === s ? "default" : "ghost"}
                  size="sm"
                  className="h-6 text-[11px] px-2 flex-1"
                  onClick={() => setFiltroStatus(s)}
                >
                  {s === "todos" ? "Todos" : s === "aberto" ? "Abertos" : "Fechados"}
                </Button>
              ))}
            </div>
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Carregando…</div>
            ) : chamadosFiltrados.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Nenhum chamado encontrado.</div>
            ) : (
              <div>
                {chamadosFiltrados.map(c => {
                  const nome: string = c.consumidores?.usuarios?.nome ?? "—";
                  const isSelected = selectedChamado?.id === c.id;
                  const isAberto = c.status === "aberto";
                  return (
                    <button
                      key={c.id}
                      className={`w-full text-left px-3 py-3 border-b border-border transition-colors ${
                        isSelected
                          ? "bg-primary/10 border-l-2 border-l-primary"
                          : "hover:bg-secondary/60"
                      }`}
                      onClick={() => setSelectedChamado(c)}
                    >
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-[11px] font-mono font-semibold text-primary truncate">{c.protocolo}</span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1 h-4 shrink-0 ${
                            isAberto
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {isAberto ? "aberto" : "fechado"}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium truncate">{nome}</p>
                      {c.assunto && (
                        <p className="text-xs text-muted-foreground truncate">{c.assunto}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {format(new Date(c.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Count */}
          <div className="px-3 py-2 border-t border-border text-[10px] text-muted-foreground">
            {chamadosFiltrados.length} chamado(s)
          </div>
        </div>

        {/* Right panel — chat */}
        <div className="flex-1 flex flex-col bg-background overflow-hidden">
          {!selectedChamado ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <Headphones className="h-12 w-12 opacity-20" />
              <p className="text-sm">Selecione um chamado para visualizar a conversa</p>
              <p className="text-xs">ou crie um novo chamado clicando em "Novo Chamado"</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between gap-3 shrink-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">
                      {selectedChamado.consumidores?.usuarios?.nome ?? "—"}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 h-4 shrink-0 ${
                        selectedChamado.status === "aberto"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {selectedChamado.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{selectedChamado.protocolo}</span>
                    {selectedChamado.consumidores?.usuarios?.telefone && (
                      <> · {selectedChamado.consumidores.usuarios.telefone}</>
                    )}
                    {selectedChamado.assunto && (
                      <> · <span className="italic">{selectedChamado.assunto}</span></>
                    )}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={toggleStatus}
                >
                  {selectedChamado.status === "aberto" ? (
                    <><XCircle className="h-3.5 w-3.5 mr-1" /> Encerrar</>
                  ) : (
                    <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Reabrir</>
                  )}
                </Button>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {loadingMsgs ? (
                  <div className="flex justify-center py-8">
                    <Clock className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : mensagens.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                    <MessageSquare className="h-8 w-8 opacity-20" />
                    <p className="text-xs">Nenhuma mensagem ainda. Inicie a conversa!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mensagens.map((m: any) => {
                      const isSaida = (m.direcao ?? "saida") === "saida";
                      const ts = m.enviado_em ?? m.criado_em;
                      return (
                        <div key={m.id} className={`flex ${isSaida ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-xl px-3 py-2 ${
                            isSaida
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-secondary text-foreground rounded-bl-sm"
                          }`}>
                            <p className="text-sm whitespace-pre-wrap">{m.mensagem}</p>
                            {ts && (
                              <p className={`text-[10px] mt-1 ${isSaida ? "text-primary-foreground/70 text-right" : "text-muted-foreground"}`}>
                                {format(new Date(ts), "dd/MM HH:mm", { locale: ptBR })}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Message input */}
              <div className={`p-3 border-t border-border bg-card flex gap-2 shrink-0 ${selectedChamado.status === "fechado" ? "opacity-50 pointer-events-none" : ""}`}>
                <Input
                  value={novaMensagem}
                  onChange={e => setNovaMensagem(e.target.value)}
                  placeholder={selectedChamado.status === "fechado" ? "Chamado encerrado" : "Escreva uma mensagem…"}
                  className="flex-1 text-sm"
                  disabled={selectedChamado.status === "fechado"}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviarMensagem();
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={enviarMensagem}
                  disabled={!novaMensagem.trim() || enviando || selectedChamado.status === "fechado"}
                >
                  {enviando
                    ? <Clock className="h-4 w-4 animate-spin" />
                    : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Novo Chamado Dialog */}
      <Dialog
        open={novoChamadoOpen}
        onOpenChange={o => {
          if (!o && !criando) {
            setNovoChamadoOpen(false);
            setSearchCons(""); setSelectedCons(null); setAssunto("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Novo Chamado
            </DialogTitle>
            <DialogDescription>Selecione o consumidor e inicie uma conversa de atendimento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Consumidor</Label>
              {selectedCons ? (
                <div className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{selectedCons.nome}</p>
                    <p className="text-xs text-muted-foreground">{selectedCons.telefone}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs"
                    onClick={() => { setSelectedCons(null); setSearchCons(""); }}>
                    Trocar
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    placeholder="Buscar por nome ou telefone…"
                    value={searchCons}
                    onChange={e => setSearchCons(e.target.value)}
                    onFocus={() => setShowConsList(true)}
                    onBlur={() => setTimeout(() => setShowConsList(false), 150)}
                  />
                  {showConsList && searchCons.length >= 2 && (
                    <div className="absolute z-20 top-full mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-52 overflow-y-auto">
                      {consFiltrados.length > 0 ? consFiltrados.map(c => (
                        <button
                          key={c.id}
                          className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors"
                          onMouseDown={() => { setSelectedCons(c); setSearchCons(""); setShowConsList(false); }}
                        >
                          <p className="text-sm font-medium">{c.nome}</p>
                          <p className="text-xs text-muted-foreground">{c.telefone}</p>
                        </button>
                      )) : (
                        <p className="px-3 py-3 text-sm text-muted-foreground">Nenhum resultado encontrado.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Assunto <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input
                value={assunto}
                onChange={e => setAssunto(e.target.value)}
                placeholder="Ex: Dúvida sobre cupons, reclamação de pedido…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoChamadoOpen(false)} disabled={criando}>Cancelar</Button>
            <Button onClick={criarChamado} disabled={!selectedCons || criando}>
              {criando ? "Criando…" : "Criar Chamado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ═══════════════════════════════════════
   TAB — Relatórios
   ═══════════════════════════════════════ */
function RelatoriosTab() {
  const [totalDisparos, setTotalDisparos] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { count } = await supabase
        .from("disparos_whatsapp")
        .select("*", { count: "exact", head: true });
      setTotalDisparos(count ?? 0);
      setLoading(false);
    };
    fetch();
  }, []);

  const stats = [
    { label: "Mensagens enviadas", value: loading ? "..." : totalDisparos.toLocaleString("pt-BR"), icon: Send, color: "text-primary" },
    { label: "Taxa de entrega", value: "—", icon: CheckCircle2, color: "text-emerald-400" },
    { label: "Disparo mais acionado", value: "—", icon: MessageSquare, color: "text-primary" },
    { label: "Campanhas enviadas", value: "0", icon: Rocket, color: "text-amber-400" },
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
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma campanha enviada ainda. Os relatórios serão preenchidos automaticamente após o primeiro envio.
        </CardContent>
      </Card>
    </div>
  );
}
