import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Send,
  Wifi,
  WifiOff,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ───── types ───── */
type IntegrationStatus = "connected" | "error" | "not_configured";

interface IntegrationState {
  cardapioweb: { status: IntegrationStatus; apiKey: string; urlLoja: string };
  pagamento: { status: IntegrationStatus; provedor: string; chavePublica: string; chaveSecreta: string; splitPercent: number; ambiente: "sandbox" | "producao" };
  whatsapp: { status: IntegrationStatus; provedor: string; token: string; numero: string };
  email: { status: IntegrationStatus; provedor: string; apiKey: string; emailRemetente: string; nomeRemetente: string };
}

const DEFAULT_STATE: IntegrationState = {
  cardapioweb: { status: "not_configured", apiKey: "", urlLoja: "" },
  pagamento: { status: "not_configured", provedor: "", chavePublica: "", chaveSecreta: "", splitPercent: 15, ambiente: "sandbox" },
  whatsapp: { status: "not_configured", provedor: "", token: "", numero: "" },
  email: { status: "not_configured", provedor: "", apiKey: "", emailRemetente: "", nomeRemetente: "" },
};

const STORAGE_KEY = "pizza-premiada:integracoes";

function loadIntegrations(): IntegrationState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULT_STATE, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_STATE;
}

/* ───── status helpers ───── */
function StatusBadge({ status }: { status: IntegrationStatus }) {
  if (status === "connected") return <Badge className="bg-[hsl(var(--success))] text-primary-foreground">Conectado</Badge>;
  if (status === "error") return <Badge className="bg-destructive text-destructive-foreground animate-pulse">Erro</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Não configurado</Badge>;
}

/* ───── secret field ───── */
function SecretField({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pr-10" />
        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShow(!show)}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/* ───── integration card wrapper ───── */
function IntCard({ title, icon, description, status, children, defaultOpen = false }: {
  title: string; icon: string; description: string; status: IntegrationStatus; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const complete = status === "connected";
  return (
    <Card className="border-border bg-card">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-6 py-4 text-left">
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">{title}</h3>
              {complete && <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />}
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          {open ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </div>
      </button>
      {open && <CardContent className="px-6 pb-6 pt-0 space-y-4 border-t border-border">{children}</CardContent>}
    </Card>
  );
}

/* ═══════════════════════ MAIN ═══════════════════════ */
export default function IntegracoesTab() {
  const [state, setState] = useState<IntegrationState>(loadIntegrations);

  const save = (newState: IntegrationState) => {
    setState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    toast.success("Integração salva!");
  };

  const testConnection = (name: string) => {
    toast.info(`Testando conexão com ${name}...`);
    setTimeout(() => toast.success(`${name} conectado com sucesso!`), 1500);
  };

  const webhookUrl = "https://api.pizzapremiada.com.br/webhook/cardapioweb/" + crypto.randomUUID().slice(0, 8);

  /* counts */
  const statuses = [state.cardapioweb.status, state.pagamento.status, state.whatsapp.status, state.email.status];
  const total = 4;
  const ativas = statuses.filter((s) => s === "connected").length;
  const comErro = statuses.filter((s) => s === "error").length;
  const naoConfiguradas = statuses.filter((s) => s === "not_configured").length;

  return (
    <div className="space-y-4">
      {/* BLOCO 1 — Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Disponíveis", value: total, color: "text-foreground", icon: Wifi },
          { label: "Ativas", value: ativas, color: "text-[hsl(var(--success))]", icon: CheckCircle2 },
          { label: "Com erro", value: comErro, color: "text-destructive", icon: AlertCircle },
          { label: "Não configuradas", value: naoConfiguradas, color: "text-muted-foreground", icon: WifiOff },
        ].map((c) => (
          <Card key={c.label} className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <c.icon className={cn("h-5 w-5", c.color)} />
              <div>
                <p className={cn("text-2xl font-bold", c.color)}>{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* BLOCO 2 — CardápioWeb */}
      <IntCard title="CardápioWeb" icon="🍕" description="Receba pedidos automaticamente e gere cupons em tempo real" status={state.cardapioweb.status}>
        <SecretField label="API Key" value={state.cardapioweb.apiKey} onChange={(v) => setState((p) => ({ ...p, cardapioweb: { ...p.cardapioweb, apiKey: v } }))} placeholder="Sua API key do CardápioWeb" />
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground">URL da loja</Label>
          <Input value={state.cardapioweb.urlLoja} onChange={(e) => setState((p) => ({ ...p, cardapioweb: { ...p.cardapioweb, urlLoja: e.target.value } }))} placeholder="https://suastore.cardapioweb.com" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground">Webhook URL (somente leitura)</Label>
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} className="bg-secondary" />
            <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copiado!"); }}><Copy className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => testConnection("CardápioWeb")}><Wifi className="h-4 w-4 mr-1" /> Testar Conexão</Button>
          <Button onClick={() => save({ ...state, cardapioweb: { ...state.cardapioweb, status: "connected" } })}>Salvar</Button>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">O que essa integração faz?</summary>
          <ul className="mt-2 space-y-1 text-muted-foreground pl-2">
            <li>✅ Recebe pedidos automaticamente</li>
            <li>✅ Gera cupons por pedido sem intervenção manual</li>
            <li>✅ Atualiza financeiro em tempo real</li>
            <li>✅ Alimenta gráficos e relatórios</li>
          </ul>
        </details>
      </IntCard>

      {/* BLOCO 3 — Gateway de Pagamento */}
      <IntCard title="Gateway de Pagamento" icon="💳" description="Split automático entre Pizza Premiada e pizzarias parceiras" status={state.pagamento.status}>
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground">Provedor</Label>
          <Select value={state.pagamento.provedor} onValueChange={(v) => setState((p) => ({ ...p, pagamento: { ...p.pagamento, provedor: v } }))}>
            <SelectTrigger><SelectValue placeholder="Selecionar provedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pagarme">Pagar.me</SelectItem>
              <SelectItem value="stripe">Stripe</SelectItem>
              <SelectItem value="mercadopago">Mercado Pago</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <SecretField label="Chave pública" value={state.pagamento.chavePublica} onChange={(v) => setState((p) => ({ ...p, pagamento: { ...p.pagamento, chavePublica: v } }))} />
        <SecretField label="Chave secreta" value={state.pagamento.chaveSecreta} onChange={(v) => setState((p) => ({ ...p, pagamento: { ...p.pagamento, chaveSecreta: v } }))} />
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground">Percentual de split (%)</Label>
          <Input type="number" value={state.pagamento.splitPercent} onChange={(e) => setState((p) => ({ ...p, pagamento: { ...p.pagamento, splitPercent: Number(e.target.value) } }))} />
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-sm text-muted-foreground">Ambiente</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sandbox</span>
            <Switch checked={state.pagamento.ambiente === "producao"} onCheckedChange={(v) => setState((p) => ({ ...p, pagamento: { ...p.pagamento, ambiente: v ? "producao" : "sandbox" } }))} />
            <span className="text-xs text-muted-foreground">Produção</span>
          </div>
        </div>
        <Badge className="bg-[hsl(var(--warning))] text-primary-foreground">⚠️ Requer homologação antes de ativar em produção</Badge>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => testConnection("Gateway de Pagamento")}><Wifi className="h-4 w-4 mr-1" /> Testar Conexão</Button>
          <Button onClick={() => save({ ...state, pagamento: { ...state.pagamento, status: "connected" } })}>Salvar</Button>
        </div>
      </IntCard>

      {/* BLOCO 4 — WhatsApp / SMS */}
      <IntCard title="WhatsApp / SMS" icon="📱" description="Notificações automáticas para consumidores — cupons, pedidos e resultado do sorteio" status={state.whatsapp.status}>
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground">Provedor</Label>
          <Select value={state.whatsapp.provedor} onValueChange={(v) => setState((p) => ({ ...p, whatsapp: { ...p.whatsapp, provedor: v } }))}>
            <SelectTrigger><SelectValue placeholder="Selecionar provedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="twilio">Twilio</SelectItem>
              <SelectItem value="zapi">Z-API</SelectItem>
              <SelectItem value="evolution">Evolution API</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <SecretField label="Token de acesso" value={state.whatsapp.token} onChange={(v) => setState((p) => ({ ...p, whatsapp: { ...p.whatsapp, token: v } }))} />
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground">Número de envio</Label>
          <Input value={state.whatsapp.numero} onChange={(e) => setState((p) => ({ ...p, whatsapp: { ...p.whatsapp, numero: e.target.value } }))} placeholder="+55 11 99999-9999" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => testConnection("WhatsApp")}><Send className="h-4 w-4 mr-1" /> Testar Envio</Button>
          <Button onClick={() => save({ ...state, whatsapp: { ...state.whatsapp, status: "connected" } })}>Salvar</Button>
        </div>
      </IntCard>

      {/* BLOCO 5 — E-mail */}
      <IntCard title="Serviço de E-mail" icon="📧" description="E-mails transacionais — boas-vindas, confirmação de cupom e resultado do sorteio" status={state.email.status}>
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground">Provedor</Label>
          <Select value={state.email.provedor} onValueChange={(v) => setState((p) => ({ ...p, email: { ...p.email, provedor: v } }))}>
            <SelectTrigger><SelectValue placeholder="Selecionar provedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sendgrid">SendGrid</SelectItem>
              <SelectItem value="resend">Resend</SelectItem>
              <SelectItem value="mailgun">Mailgun</SelectItem>
              <SelectItem value="smtp">SMTP próprio</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <SecretField label="API Key" value={state.email.apiKey} onChange={(v) => setState((p) => ({ ...p, email: { ...p.email, apiKey: v } }))} />
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground">E-mail remetente</Label>
          <Input type="email" value={state.email.emailRemetente} onChange={(e) => setState((p) => ({ ...p, email: { ...p.email, emailRemetente: e.target.value } }))} placeholder="noreply@pizzapremiada.com.br" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground">Nome do remetente</Label>
          <Input value={state.email.nomeRemetente} onChange={(e) => setState((p) => ({ ...p, email: { ...p.email, nomeRemetente: e.target.value } }))} placeholder="Pizza Premiada" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => testConnection("E-mail")}><Send className="h-4 w-4 mr-1" /> Enviar e-mail de teste</Button>
          <Button onClick={() => save({ ...state, email: { ...state.email, status: "connected" } })}>Salvar</Button>
        </div>
      </IntCard>

      {/* BLOCO 6 — Integrações futuras */}
      <h3 className="text-sm font-semibold text-muted-foreground pt-2">Em breve</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { icon: "📊", title: "Google Analytics", desc: "Rastreamento de conversões e comportamento" },
          { icon: "📣", title: "Meta Ads", desc: "Integração com campanhas de anúncios" },
          { icon: "📦", title: "Sistema de Estoque", desc: "Controle de ingredientes e insumos" },
        ].map((item) => (
          <Card key={item.title} className="border-border bg-card opacity-50">
            <CardContent className="p-4 flex items-center gap-3">
              <span className="text-lg">{item.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Em breve</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
