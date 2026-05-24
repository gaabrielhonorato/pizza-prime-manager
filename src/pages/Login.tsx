import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, AlertCircle, UtensilsCrossed, User } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { BrandLogo } from "@/components/BrandLogo";
import { useEmpresaBranding } from "@/contexts/EmpresaBrandingContext";
import { cn } from "@/lib/utils";

type Modo = "consumidor" | "parceiro";

function formatCPF(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatCNPJ(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function detectInput(value: string): "email" | "cpf" | "cnpj" {
  if (value.includes("@")) return "email";
  const digits = value.replace(/\D/g, "");
  if (digits.length > 11) return "cnpj";
  if (digits.length > 0) return "cpf";
  return "email";
}

const ROLE_REDIRECTS: Record<string, string> = {
  gestor: "/gestor",
  pizzaria: "/pizzaria/dashboard",
  entregador: "/entregador/app",
  consumidor: "/consumidor/dashboard",
};

export default function Login() {
  const navigate = useNavigate();
  const { signIn, signInWithCpf, signInWithCnpj, usuario, loading: authLoading } = useAuth();
  const { nome: brandName } = useEmpresaBranding();

  const [modo, setModo] = useState<Modo>("consumidor");
  const [identifier, setIdentifier] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [lockCountdown, setLockCountdown] = useState(0);

  useEffect(() => {
    if (usuario && !authLoading) {
      navigate(ROLE_REDIRECTS[usuario.perfil] || "/");
    }
  }, [usuario, authLoading, navigate]);

  useEffect(() => {
    if (!lockUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.ceil((lockUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockUntil(null);
        setLockCountdown(0);
        setAttempts(0);
        clearInterval(interval);
      } else {
        setLockCountdown(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockUntil]);

  const handleModoChange = (m: Modo) => {
    setModo(m);
    setIdentifier("");
    setError("");
  };

  const handleIdentifierChange = (value: string) => {
    if (value.includes("@")) {
      setIdentifier(value);
    } else {
      const digits = value.replace(/\D/g, "");
      if (modo === "parceiro" && digits.length > 11) {
        setIdentifier(formatCNPJ(value));
      } else if (digits.length > 0) {
        setIdentifier(formatCPF(value));
      } else {
        setIdentifier(value);
      }
    }
    setError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockUntil && Date.now() < lockUntil) return;

    setLoading(true);
    setError("");

    const trimmed = identifier.trim();
    const type = detectInput(trimmed);

    let result;
    if (type === "email") {
      result = await signIn(trimmed.toLowerCase(), senha);
    } else if (type === "cnpj" && modo === "parceiro") {
      result = await signInWithCnpj(trimmed, senha);
    } else {
      result = await signInWithCpf(trimmed.replace(/\D/g, ""), senha);
    }

    if (result.error) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 5) {
        setLockUntil(Date.now() + 30000);
        setLockCountdown(30);
        setError("Muitas tentativas. Aguarde 30 segundos para tentar novamente.");
      } else {
        setError(result.error);
      }
    } else if (result.perfil) {
      setAttempts(0);
      navigate(ROLE_REDIRECTS[result.perfil] || "/");
    } else {
      setError("Não foi possível carregar seu perfil. Tente novamente.");
    }

    setLoading(false);
  };

  const isLocked = lockUntil !== null && Date.now() < lockUntil;
  const fieldLabel = modo === "parceiro" ? "E-mail ou CNPJ" : "E-mail ou CPF";
  const fieldPlaceholder = modo === "parceiro"
    ? "email@pizzaria.com ou 00.000.000/0001-00"
    : "email@exemplo.com ou 000.000.000-00";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="items-center pb-2 pt-8">
          <BrandLogo className="h-14 w-14 mb-3" />
          <h1 className="font-heading text-3xl font-bold tracking-tight">{brandName}</h1>
          <p className="text-muted-foreground text-sm mt-2">Acesse sua conta</p>
        </CardHeader>

        <CardContent>
          {/* Toggle Consumidor / Parceiro */}
          <div className="flex rounded-lg border border-border overflow-hidden mb-5">
            <button
              type="button"
              onClick={() => handleModoChange("consumidor")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors",
                modo === "consumidor"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              <User className="h-4 w-4" />
              Consumidor
            </button>
            <button
              type="button"
              onClick={() => handleModoChange("parceiro")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors",
                modo === "parceiro"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              <UtensilsCrossed className="h-4 w-4" />
              Parceiro (Pizzaria)
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">{fieldLabel}</Label>
              <Input
                id="identifier"
                placeholder={fieldPlaceholder}
                value={identifier}
                onChange={(e) => handleIdentifierChange(e.target.value)}
                required
                disabled={isLocked}
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={showSenha ? "text" : "password"}
                  placeholder="Sua senha"
                  value={senha}
                  onChange={(e) => { setSenha(e.target.value); setError(""); }}
                  required
                  disabled={isLocked}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSenha(!showSenha)}
                >
                  {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isLocked && (
              <div className="text-center text-sm text-muted-foreground">
                Tente novamente em <span className="font-bold text-primary">{lockCountdown}s</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || isLocked}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>

            <div className="flex flex-col items-center gap-2">
              <Link to="/esqueci-senha" className="text-sm text-primary hover:underline">
                Esqueci minha senha
              </Link>
              {modo === "consumidor" && (
                <Link to="/cadastro" className="text-sm text-muted-foreground hover:text-primary">
                  Ainda não tenho cadastro? Cadastre-se
                </Link>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-8">
        {brandName} © 2025 — Todos os direitos reservados
      </p>
    </div>
  );
}
