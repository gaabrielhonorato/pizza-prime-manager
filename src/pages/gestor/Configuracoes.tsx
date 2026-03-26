import { useState, useMemo, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Pencil,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, differenceInDays, differenceInHours, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ───── types ───── */
interface Premio {
  id: string;
  nome: string;
  descricao: string;
  valor: number;
  foto: string | null;
  ganhadores: number;
}

interface CampanhaConfig {
  nome: string;
  descricao: string;
  logo: string | null;
  status: "ativa" | "pausada" | "encerrada";
  dataInicio: Date | undefined;
  dataEncerramento: Date | undefined;
  dataSorteio: Date | undefined;
  horaSorteio: string;
  fusoHorario: string;
  valorCupom: number;
  cuponsPorValor: number;
  valorMinimoPedido: number;
  limiteCuponsPorCiclo: string;
  arredondamento: "baixo" | "acumular";
  exigirCadastro: boolean;
  camposObrigatorios: { nome: boolean; cpf: boolean; email: boolean; telefone: boolean; endereco: boolean };
  exigirTermos: boolean;
  textoTermos: string;
  textoPolitica: string;
  enviarEmailConfirmacao: boolean;
  premios: Premio[];
}

const DEFAULT_CONFIG: CampanhaConfig = {
  nome: "Pizza Premiada — Ciclo 1",
  descricao: "Compre pizzas, acumule cupons e concorra a prêmios incríveis!",
  logo: null,
  status: "ativa",
  dataInicio: new Date(2025, 9, 1),
  dataEncerramento: new Date(2026, 0, 31),
  dataSorteio: new Date(2026, 1, 5),
  horaSorteio: "20:00",
  fusoHorario: "America/Sao_Paulo",
  valorCupom: 50,
  cuponsPorValor: 1,
  valorMinimoPedido: 30,
  limiteCuponsPorCiclo: "",
  arredondamento: "baixo",
  exigirCadastro: true,
  camposObrigatorios: { nome: true, cpf: true, email: true, telefone: true, endereco: false },
  exigirTermos: true,
  textoTermos: "https://pizzapremiada.com.br/termos",
  textoPolitica: "https://pizzapremiada.com.br/privacidade",
  enviarEmailConfirmacao: true,
  premios: [
    { id: "1", nome: "iPhone 17 Pro Max", descricao: "128GB, Titânio Natural", valor: 10499, foto: null, ganhadores: 1 },
    { id: "2", nome: "Viagem Rio Quente", descricao: "5 diárias com acompanhante", valor: 5000, foto: null, ganhadores: 1 },
    { id: "3", nome: "Pix R$1.000", descricao: "Prêmio em dinheiro via Pix", valor: 1000, foto: null, ganhadores: 3 },
  ],
};

/* ───── collapsible section ───── */
function Section({
  title,
  icon,
  complete,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: string;
  complete: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border-border bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {complete && <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" />}
        </div>
        {open ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
      </button>
      {open && <CardContent className="px-6 pb-6 pt-0 space-y-5 border-t border-border">{children}</CardContent>}
    </Card>
  );
}

/* ───── date picker helper ───── */
function DatePicker({ value, onChange, label }: { value: Date | undefined; onChange: (d: Date | undefined) => void; label: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}>
            {value ? format(value, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ───── image upload placeholder ───── */
function ImageUpload({ value, onChange, label }: { value: string | null; onChange: (v: string | null) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onChange(url);
    }
  };
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <input type="file" accept="image/*" className="hidden" ref={ref} onChange={handleFile} />
      {value ? (
        <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border">
          <img src={value} alt={label} className="w-full h-full object-cover" />
          <button onClick={() => onChange(null)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <Button variant="outline" className="gap-2" onClick={() => ref.current?.click()}>
          <Upload className="h-4 w-4" /> Enviar imagem
        </Button>
      )}
    </div>
  );
}

/* ═══════════════════════════════ MAIN ═══════════════════════════════ */
export default function Configuracoes() {
  const [config, setConfig] = useState<CampanhaConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(true);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<CampanhaConfig["status"]>("ativa");
  const [editPremioId, setEditPremioId] = useState<string | null>(null);

  const upd = <K extends keyof CampanhaConfig>(key: K, val: CampanhaConfig[K]) => {
    setConfig((p) => ({ ...p, [key]: val }));
    setSaved(false);
  };

  /* computed */
  const sorteioAlert = config.dataSorteio && config.dataEncerramento && isBefore(config.dataSorteio, config.dataEncerramento);
  const diasRestantes = config.dataSorteio ? Math.max(0, differenceInDays(config.dataSorteio, new Date())) : null;
  const horasRestantes = config.dataSorteio ? Math.max(0, differenceInHours(config.dataSorteio, new Date()) % 24) : null;
  const totalPremios = config.premios.reduce((s, p) => s + p.valor * p.ganhadores, 0);

  const previewCupom = useMemo(() => {
    const pedido = 70;
    if (config.valorCupom <= 0) return null;
    const raw = pedido / config.valorCupom;
    const cupons = config.arredondamento === "baixo" ? Math.floor(raw) : Math.floor(raw);
    const saldo = config.arredondamento === "acumular" ? (pedido % config.valorCupom) : 0;
    return { pedido, cupons: cupons * config.cuponsPorValor, saldo };
  }, [config.valorCupom, config.cuponsPorValor, config.arredondamento]);

  const bloco1Ok = config.nome.trim().length > 0 && config.descricao.trim().length > 0;
  const bloco2Ok = !!config.dataInicio && !!config.dataEncerramento && !!config.dataSorteio && !sorteioAlert;
  const bloco3Ok = config.valorCupom > 0 && config.cuponsPorValor > 0;
  const bloco4Ok = true;
  const bloco5Ok = config.premios.length > 0;

  /* status change */
  const requestStatusChange = (newStatus: CampanhaConfig["status"]) => {
    setPendingStatus(newStatus);
    setStatusConfirmOpen(true);
  };
  const confirmStatusChange = () => {
    upd("status", pendingStatus);
    setStatusConfirmOpen(false);
    toast.success(`Status alterado para "${pendingStatus}".`);
  };

  /* premios */
  const addPremio = () => {
    const next: Premio = {
      id: crypto.randomUUID(),
      nome: "",
      descricao: "",
      valor: 0,
      foto: null,
      ganhadores: 1,
    };
    upd("premios", [...config.premios, next]);
    setEditPremioId(next.id);
  };
  const updatePremio = (id: string, patch: Partial<Premio>) => {
    upd("premios", config.premios.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const removePremio = (id: string) => {
    upd("premios", config.premios.filter((p) => p.id !== id));
  };

  const handleSave = () => {
    setSaved(true);
    toast.success("Configurações salvas com sucesso!");
  };

  const statusColor = { ativa: "bg-[hsl(var(--success))]", pausada: "bg-[hsl(var(--warning))]", encerrada: "bg-destructive" }[config.status];
  const statusLabel = { ativa: "Ativa", pausada: "Pausada", encerrada: "Encerrada" }[config.status];

  return (
    <div className="flex gap-6 relative min-h-[calc(100vh-4rem)]">
      {/* LEFT — main form */}
      <div className="flex-1 space-y-4 pb-24">
        <h1 className="text-2xl font-bold text-foreground">Configurações da Campanha</h1>

        {/* BLOCO 1 */}
        <Section title="Identidade da Campanha" icon="🎨" complete={bloco1Ok} defaultOpen>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome da campanha</Label>
              <Input value={config.nome} onChange={(e) => upd("nome", e.target.value)} placeholder="Pizza Premiada — Ciclo 1" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição curta</Label>
              <Textarea value={config.descricao} onChange={(e) => upd("descricao", e.target.value)} rows={3} />
            </div>
            <ImageUpload value={config.logo} onChange={(v) => upd("logo", v)} label="Logo ou imagem de capa" />
            <div className="space-y-2">
              <Label>Status da campanha</Label>
              <div className="flex gap-2">
                {(["ativa", "pausada", "encerrada"] as const).map((s) => (
                  <Button
                    key={s}
                    variant={config.status === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => { if (config.status !== s) requestStatusChange(s); }}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* BLOCO 2 */}
        <Section title="Período da Campanha" icon="📅" complete={bloco2Ok}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DatePicker value={config.dataInicio} onChange={(d) => upd("dataInicio", d)} label="Data de início" />
            <DatePicker value={config.dataEncerramento} onChange={(d) => upd("dataEncerramento", d)} label="Data de encerramento" />
            <DatePicker value={config.dataSorteio} onChange={(d) => upd("dataSorteio", d)} label="Data do sorteio" />
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Hora do sorteio</Label>
              <Input type="time" value={config.horaSorteio} onChange={(e) => upd("horaSorteio", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Fuso horário</Label>
            <Select value={config.fusoHorario} onValueChange={(v) => upd("fusoHorario", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Sao_Paulo">GMT-3 Brasília</SelectItem>
                <SelectItem value="America/Manaus">GMT-4 Manaus</SelectItem>
                <SelectItem value="America/Rio_Branco">GMT-5 Rio Branco</SelectItem>
                <SelectItem value="America/Noronha">GMT-2 Fernando de Noronha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {diasRestantes !== null && (
            <div className="flex items-center gap-2 text-foreground">
              <span className="text-2xl font-bold text-primary">{diasRestantes}d {horasRestantes}h</span>
              <span className="text-sm text-muted-foreground">restantes para o sorteio</span>
            </div>
          )}
          {sorteioAlert && (
            <div className="flex items-center gap-2 text-destructive bg-destructive/10 rounded-lg px-4 py-2">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm">A data do sorteio é anterior à data de encerramento da campanha!</span>
            </div>
          )}
        </Section>

        {/* BLOCO 3 */}
        <Section title="Regras de Geração de Cupons" icon="🎟️" complete={bloco3Ok}>
          <div className="flex flex-wrap items-end gap-2">
            <span className="text-sm text-muted-foreground self-center">A cada R$</span>
            <Input type="number" className="w-24" value={config.valorCupom} onChange={(e) => upd("valorCupom", Number(e.target.value))} />
            <span className="text-sm text-muted-foreground self-center">gastos, o consumidor ganha</span>
            <Input type="number" className="w-20" value={config.cuponsPorValor} onChange={(e) => upd("cuponsPorValor", Number(e.target.value))} />
            <span className="text-sm text-muted-foreground self-center">cupom(ns)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Valor mínimo do pedido (R$)</Label>
              <Input type="number" value={config.valorMinimoPedido} onChange={(e) => upd("valorMinimoPedido", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Limite de cupons por ciclo</Label>
              <Input placeholder="Ilimitado" value={config.limiteCuponsPorCiclo} onChange={(e) => upd("limiteCuponsPorCiclo", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Arredondamento</Label>
            <div className="flex gap-3">
              {([
                ["baixo", "Arredondar para baixo"],
                ["acumular", "Acumular saldo"],
              ] as const).map(([val, label]) => (
                <Button key={val} variant={config.arredondamento === val ? "default" : "outline"} size="sm" onClick={() => upd("arredondamento", val)}>
                  {label}
                </Button>
              ))}
            </div>
          </div>
          {previewCupom && (
            <div className="bg-secondary rounded-lg px-4 py-3 text-sm text-foreground">
              <strong>Preview:</strong> Um pedido de R${previewCupom.pedido.toFixed(2)} gera <span className="text-primary font-bold">{previewCupom.cupons} cupom(ns)</span>
              {config.arredondamento === "acumular" && previewCupom.saldo > 0 && (
                <span> + R${previewCupom.saldo.toFixed(2)} de saldo acumulado</span>
              )}
            </div>
          )}
        </Section>

        {/* BLOCO 4 */}
        <Section title="Regras de Participação do Consumidor" icon="👤" complete={bloco4Ok}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Exigir cadastro completo para validar cupons</Label>
              <Switch checked={config.exigirCadastro} onCheckedChange={(v) => upd("exigirCadastro", v)} />
            </div>
            {config.exigirCadastro && (
              <div className="space-y-2 pl-2">
                <Label className="text-sm text-muted-foreground">Campos obrigatórios:</Label>
                {(["nome", "cpf", "email", "telefone", "endereco"] as const).map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <Checkbox
                      checked={config.camposObrigatorios[field]}
                      onCheckedChange={(v) =>
                        upd("camposObrigatorios", { ...config.camposObrigatorios, [field]: !!v })
                      }
                    />
                    <span className="text-sm text-foreground capitalize">{field === "nome" ? "Nome completo" : field === "cpf" ? "CPF" : field === "email" ? "E-mail" : field === "telefone" ? "Telefone" : "Endereço"}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>Exigir aceite dos termos e política de privacidade</Label>
              <Switch checked={config.exigirTermos} onCheckedChange={(v) => upd("exigirTermos", v)} />
            </div>
            {config.exigirTermos && (
              <div className="space-y-3 pl-2">
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Link ou texto dos Termos de Participação</Label>
                  <Textarea value={config.textoTermos} onChange={(e) => upd("textoTermos", e.target.value)} rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Link ou texto da Política de Privacidade</Label>
                  <Textarea value={config.textoPolitica} onChange={(e) => upd("textoPolitica", e.target.value)} rows={2} />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>Enviar e-mail de confirmação de cadastro</Label>
              <Switch checked={config.enviarEmailConfirmacao} onCheckedChange={(v) => upd("enviarEmailConfirmacao", v)} />
            </div>
            <div className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
              ⚠️ Cupons gerados antes do cadastro completo ficam pendentes e são validados automaticamente após o consumidor completar o cadastro e aceitar os termos.
            </div>
          </div>
        </Section>

        {/* BLOCO 5 */}
        <Section title="Prêmios" icon="🏆" complete={bloco5Ok}>
          <div className="space-y-3">
            {config.premios.map((premio, idx) => (
              <div key={premio.id} className="flex items-start gap-3 bg-secondary rounded-lg p-4">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
                  {idx + 1}º
                </div>
                <div className="flex-1 space-y-2">
                  {editPremioId === premio.id ? (
                    <>
                      <Input placeholder="Nome do prêmio" value={premio.nome} onChange={(e) => updatePremio(premio.id, { nome: e.target.value })} />
                      <Input placeholder="Descrição" value={premio.descricao} onChange={(e) => updatePremio(premio.id, { descricao: e.target.value })} />
                      <div className="flex gap-2">
                        <Input type="number" placeholder="Valor R$" className="w-32" value={premio.valor || ""} onChange={(e) => updatePremio(premio.id, { valor: Number(e.target.value) })} />
                        <Input type="number" placeholder="Ganhadores" className="w-28" value={premio.ganhadores} onChange={(e) => updatePremio(premio.id, { ganhadores: Number(e.target.value) })} />
                      </div>
                      <ImageUpload value={premio.foto} onChange={(v) => updatePremio(premio.id, { foto: v })} label="Foto do prêmio" />
                      <Button size="sm" onClick={() => setEditPremioId(null)}>Concluir</Button>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-foreground">{premio.nome || <span className="italic text-muted-foreground">Sem nome</span>}</p>
                      <p className="text-sm text-muted-foreground">{premio.descricao}</p>
                      <p className="text-sm text-foreground">R$ {premio.valor.toLocaleString("pt-BR")} — {premio.ganhadores} ganhador(es)</p>
                    </>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditPremioId(editPremioId === premio.id ? null : premio.id)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removePremio(premio.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" className="gap-2" onClick={addPremio}>
              <Plus className="h-4 w-4" /> Adicionar Prêmio
            </Button>
            <div className="text-right text-sm text-foreground">
              Total em prêmios: <span className="font-bold text-primary">R$ {totalPremios.toLocaleString("pt-BR")}</span>
            </div>
          </div>
        </Section>
      </div>

      {/* RIGHT — summary sidebar (BLOCO 6) */}
      <div className="hidden lg:block w-80 shrink-0">
        <div className="sticky top-6 space-y-4">
          <Card className="border-border bg-card">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Resumo da Campanha</h3>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Campanha</span>
                  <p className="font-medium text-foreground truncate">{config.nome || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Período</span>
                  <p className="font-medium text-foreground">
                    {config.dataInicio ? format(config.dataInicio, "dd/MM/yyyy") : "—"} até {config.dataEncerramento ? format(config.dataEncerramento, "dd/MM/yyyy") : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Dias restantes</span>
                  <p className="font-medium text-primary text-lg">{diasRestantes !== null ? `${diasRestantes}d ${horasRestantes}h` : "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total em prêmios</span>
                  <p className="font-medium text-foreground">R$ {totalPremios.toLocaleString("pt-BR")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Regra de cupom</span>
                  <p className="font-medium text-foreground">{config.cuponsPorValor} cupom a cada R${config.valorCupom}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={cn("mt-1", statusColor, "text-primary-foreground")}>{statusLabel}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {!saved && (
            <div className="text-center text-sm text-[hsl(var(--warning))] font-medium">⚠️ Alterações não salvas</div>
          )}

          <Button className="w-full" onClick={handleSave}>
            Salvar Configurações
          </Button>
        </div>
      </div>

      {/* mobile save button */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-card border-t border-border p-4 z-50 flex items-center gap-3">
        {!saved && <span className="text-sm text-[hsl(var(--warning))]">⚠️ Não salvo</span>}
        <Button className="flex-1" onClick={handleSave}>Salvar Configurações</Button>
      </div>

      {/* status confirm dialog */}
      <AlertDialog open={statusConfirmOpen} onOpenChange={setStatusConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar status da campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Isso afeta todas as pizzarias participantes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
