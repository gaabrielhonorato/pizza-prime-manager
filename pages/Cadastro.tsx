import { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Pizza, Eye, EyeOff, AlertCircle, PartyPopper } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function formatCPF(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatTelefone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatCEP(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

interface PreExistente {
  consumidorId: string;
  cupons: number;
}

export default function Cadastro() {
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [form, setForm] = useState({
    nome: "", cpf: "", telefone: "", email: "", senha: "", confirmarSenha: "",
    cep: "", rua: "", numero: "", bairro: "", cidade: "",
  });
  const [aceitoTermos, setAceitoTermos] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preExistente, setPreExistente] = useState<PreExistente | null>(null);
  const [checking, setChecking] = useState(false);

  const update = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  };

  const checkPreExistente = useCallback(async (cpf: string, telefone: string) => {
    const cpfDigits = cpf.replace(/\D/g, "");
    const telDigits = telefone.replace(/\D/g, "");
    if (cpfDigits.length < 11 && telDigits.length < 10) return;

    setChecking(true);
    try {
      // Look up by CPF or phone in usuarios table (pre-created consumers)
      let consumidorId: string | null = null;

      if (cpfDigits.length === 11) {
        const { data } = await supabase
          .from("usuarios")
          .select("id")
          .eq("cpf", cpfDigits)
          .eq("perfil", "consumidor")
          .maybeSingle();
        if (data) {
          // Find linked consumidor
          const { data: cons } = await supabase
            .from("consumidores")
            .select("id, cadastro_completo")
            .eq("usuario_id", data.id)
            .maybeSingle();
          if (cons && !cons.cadastro_completo) {
            consumidorId = cons.id;
          }
        }
      }

      if (!consumidorId && telDigits.length >= 10) {
        const { data } = await supabase
          .from("usuarios")
          .select("id")
          .eq("telefone", telDigits)
          .eq("perfil", "consumidor")
          .maybeSingle();
        if (data) {
          const { data: cons } = await supabase
            .from("consumidores")
            .select("id, cadastro_completo")
            .eq("usuario_id", data.id)
            .maybeSingle();
          if (cons && !cons.cadastro_completo) {
            consumidorId = cons.id;
          }
        }
      }

      if (consumidorId) {
        // Count pending coupons
        const { count } = await supabase
          .from("cupons")
          .select("*", { count: "exact", head: true })
          .eq("consumidor_id", consumidorId)
          .eq("status", "pendente");
        setPreExistente({ consumidorId, cupons: count || 0 });
      } else {
        setPreExistente(null);
      }
    } catch {
      // silently fail lookup
    }
    setChecking(false);
  }, []);

  const handleCpfChange = (value: string) => {
    const formatted = formatCPF(value);
    update("cpf", formatted);
    if (formatted.replace(/\D/g, "").length === 11) {
      checkPreExistente(formatted, form.telefone);
    }
  };

  const handleTelefoneChange = (value: string) => {
    const formatted = formatTelefone(value);
    update("telefone", formatted);
    if (formatted.replace(/\D/g, "").length >= 10) {
      checkPreExistente(form.cpf, formatted);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aceitoTermos) return;
    if (form.senha !== form.confirmarSenha) {
      setError("As senhas não coincidem.");
      return;
    }
    if (form.senha.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    setError("");

    const result = await signUp({
      email: form.email,
      password: form.senha,
      nome: form.nome,
      cpf: form.cpf.replace(/\D/g, ""),
      telefone: form.telefone.replace(/\D/g, ""),
      perfil: "consumidor",
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // If pre-existing consumer, link and activate coupons
    if (preExistente) {
      try {
        // Update consumidor
        await supabase
          .from("consumidores")
          .update({
            cadastro_completo: true,
            termos_aceitos: true,
            cidade: form.cidade,
            bairro: form.bairro,
          })
          .eq("id", preExistente.consumidorId);

        // Activate pending coupons
        if (preExistente.cupons > 0) {
          await supabase
            .from("cupons")
            .update({ status: "validado" })
            .eq("consumidor_id", preExistente.consumidorId)
            .eq("status", "pendente");
        }

        toast.success(
          `Cadastro concluído! Seus ${preExistente.cupons} cupons foram ativados. Boa sorte no sorteio!`,
          { duration: 5000, icon: <PartyPopper className="h-5 w-5" /> }
        );
      } catch {
        // Non-critical, continue
      }
    } else {
      toast.success("Cadastro realizado com sucesso! Bem-vindo ao Pizza Premiada!");
    }

    navigate("/consumidor/dashboard");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-lg border-border bg-card">
        <CardHeader className="items-center pb-2 pt-8">
          <Pizza className="h-14 w-14 text-primary mb-3" />
          <h1 className="font-heading text-3xl font-bold tracking-tight">Pizza Premiada</h1>
          <p className="text-muted-foreground text-sm mt-2">Criar sua conta</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input placeholder="Seu nome completo" value={form.nome} onChange={(e) => update("nome", e.target.value)} required />
            </div>

            {/* CPF + Telefone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <Input placeholder="000.000.000-00" value={form.cpf} onChange={(e) => handleCpfChange(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone / WhatsApp</Label>
                <Input placeholder="(00) 00000-0000" value={form.telefone} onChange={(e) => handleTelefoneChange(e.target.value)} required />
              </div>
            </div>

            {/* Pre-existing consumer alert */}
            {preExistente && (
              <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm text-foreground">
                <PartyPopper className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>
                  Encontramos um cadastro com seus dados! Você já possui{" "}
                  <strong className="text-primary">{preExistente.cupons} cupons</strong> acumulados de pedidos anteriores.
                  Complete seu cadastro para ativá-los.
                </span>
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" placeholder="seu@email.com" value={form.email} onChange={(e) => update("email", e.target.value)} required />
            </div>

            {/* Senha */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Senha</Label>
                <div className="relative">
                  <Input
                    type={showSenha ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={form.senha}
                    onChange={(e) => update("senha", e.target.value)}
                    required
                    minLength={6}
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowSenha(!showSenha)}>
                    {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Confirmar senha</Label>
                <Input type={showSenha ? "text" : "password"} placeholder="Confirme" value={form.confirmarSenha} onChange={(e) => update("confirmarSenha", e.target.value)} required minLength={6} />
              </div>
            </div>

            {/* Endereço */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>CEP</Label>
                <Input placeholder="00000-000" value={form.cep} onChange={(e) => update("cep", formatCEP(e.target.value))} required />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Rua</Label>
                <Input placeholder="Nome da rua" value={form.rua} onChange={(e) => update("rua", e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Número</Label>
                <Input placeholder="Nº" value={form.numero} onChange={(e) => update("numero", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Bairro</Label>
                <Input placeholder="Bairro" value={form.bairro} onChange={(e) => update("bairro", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input placeholder="Cidade" value={form.cidade} onChange={(e) => update("cidade", e.target.value)} required />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Terms */}
            <div className="flex items-start gap-2 pt-1">
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

      <p className="text-xs text-muted-foreground mt-8">
        Pizza Premiada © 2025 — Todos os direitos reservados
      </p>
    </div>
  );
}
