import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Pizza, Eye, EyeOff, CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

function formatCPF(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

async function concederBonusCadastro(consumidorId: string) {
  try {
    // Get active principal campaign
    const { data: camp } = await supabase
      .from("campanhas")
      .select("id, bonus_cadastro_ativo, bonus_cadastro_cupons")
      .eq("is_principal", true)
      .limit(1)
      .single();

    if (!camp || !(camp as any).bonus_cadastro_ativo) return;

    // Check if already granted
    const { data: consumidor } = await supabase
      .from("consumidores")
      .select("cadastro_bonus_concedido")
      .eq("id", consumidorId)
      .single();

    if (!consumidor || (consumidor as any).cadastro_bonus_concedido) return;

    // Insert bonus cupons
    await supabase.from("cupons_bonus" as any).insert({
      consumidor_id: consumidorId,
      campanha_id: camp.id,
      tipo: "cadastro_completo",
      quantidade: (camp as any).bonus_cadastro_cupons,
      motivo: "Bônus por cadastro completo",
      status: "validado",
    });

    // Mark as granted
    await supabase
      .from("consumidores")
      .update({ cadastro_bonus_concedido: true } as any)
      .eq("id", consumidorId);

    toast.success(`🎉 Você ganhou ${(camp as any).bonus_cadastro_cupons} cupons bônus por completar seu cadastro! Boa sorte no sorteio!`);
  } catch (err) {
    console.error("Erro ao conceder bônus de cadastro:", err);
  }
}

export default function ConsumidorCadastro() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [form, setForm] = useState({
    nome: "", cpf: "", email: "", telefone: "", cidade: "", bairro: "", senha: "", confirmarSenha: "",
  });
  const [dataNascimento, setDataNascimento] = useState<Date | undefined>();
  const [aceitoTermos, setAceitoTermos] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aceitoTermos) return;
    if (form.senha !== form.confirmarSenha) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    setError("");

    const result = await signUp({
      email: form.email,
      password: form.senha,
      nome: form.nome,
      cpf: form.cpf.replace(/\D/g, ""),
      telefone: form.telefone,
      perfil: "consumidor",
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      // After signup, try to update data_nascimento on the consumidor record and grant bonus
      setTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: cons } = await supabase
            .from("consumidores")
            .select("id")
            .eq("usuario_id", user.id)
            .maybeSingle();
          if (cons) {
            if (dataNascimento) {
              await supabase.from("consumidores").update({
                data_nascimento: format(dataNascimento, "yyyy-MM-dd"),
                cidade: form.cidade || null,
                bairro: form.bairro || null,
                cadastro_completo: true,
                termos_aceitos: true,
              } as any).eq("id", cons.id);
            }
            await concederBonusCadastro(cons.id);
          }
        }
      }, 1500);
      navigate("/consumidor/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-lg border-border bg-card">
        <CardHeader className="items-center pb-2 pt-8">
          <Pizza className="h-12 w-12 text-primary mb-2" />
          <h1 className="font-heading text-2xl font-bold tracking-tight">Pizza Premiada</h1>
          <p className="text-lg font-semibold text-foreground mt-3">Criar conta</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input placeholder="Seu nome" value={form.nome} onChange={(e) => update("nome", e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <Input placeholder="000.000.000-00" value={form.cpf} onChange={(e) => update("cpf", formatCPF(e.target.value))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone / WhatsApp</Label>
                <Input placeholder="(11) 99999-9999" value={form.telefone} onChange={(e) => update("telefone", e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" placeholder="seu@email.com" value={form.email} onChange={(e) => update("email", e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input placeholder="Sua cidade" value={form.cidade} onChange={(e) => update("cidade", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Bairro</Label>
                <Input placeholder="Seu bairro" value={form.bairro} onChange={(e) => update("bairro", e.target.value)} required />
              </div>
            </div>

            {/* Data de nascimento */}
            <div className="space-y-1.5">
              <Label>Data de nascimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataNascimento && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataNascimento ? format(dataNascimento, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataNascimento}
                    onSelect={setDataNascimento}
                    captionLayout="dropdown-buttons"
                    fromYear={1930}
                    toYear={new Date().getFullYear() - 10}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <p className="text-[10px] text-primary">🎂 Informe seu aniversário e ganhe cupons em dobro no seu mês especial!</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Senha</Label>
                <div className="relative">
                  <Input type={showSenha ? "text" : "password"} placeholder="Sua senha" value={form.senha} onChange={(e) => update("senha", e.target.value)} required />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowSenha(!showSenha)}>
                    {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Confirmar senha</Label>
                <Input type={showSenha ? "text" : "password"} placeholder="Confirme" value={form.confirmarSenha} onChange={(e) => update("confirmarSenha", e.target.value)} required />
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>
            )}

            <div className="flex items-start gap-2 pt-2">
              <Checkbox id="termos" checked={aceitoTermos} onCheckedChange={(v) => setAceitoTermos(v === true)} />
              <label htmlFor="termos" className="text-xs text-muted-foreground leading-tight cursor-pointer">
                Li e aceito os{" "}
                <a href="#" className="text-primary hover:underline">Termos de Participação</a>{" "}e a{" "}
                <a href="#" className="text-primary hover:underline">Política de Privacidade</a>
              </label>
            </div>
            <Button type="submit" className="w-full" disabled={loading || !aceitoTermos}>
              {loading ? "Criando conta..." : "Criar minha conta"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Seus cupons gerados antes do cadastro serão validados automaticamente após a confirmação.
            </p>
            <div className="text-center text-sm pt-1">
              <Link to="/" className="text-muted-foreground hover:text-primary">
                Já tenho cadastro → Entrar
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
