import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Pizza, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";

function formatCPF(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function isCPF(value: string) {
  return /^\d/.test(value.replace(/\D/g, "")) && value.replace(/\D/g, "").length > 0;
}

const ROLE_REDIRECTS: Record<string, string> = {
  gestor: "/gestor",
  pizzaria: "/pizzaria/dashboard",
  entregador: "/entregador/app",
  consumidor: "/consumidor/dashboard",
};

export default function Login() {
  const navigate = useNavigate();
  const { signIn, signInWithCpf, usuario, loading: authLoading } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [lockCountdown, setLockCountdown] = useState(0);

  // Redirect if already logged in
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

  const handleIdentifierChange = (value: string) => {
    if (isCPF(value) && !value.includes("@")) {
      setIdentifier(formatCPF(value));
    } else {
      setIdentifier(value);
    }
    setError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockUntil && Date.now() < lockUntil) return;

    setLoading(true);
    setError("");

    const trimmedId = identifier.trim();
    const isCpfInput = isCPF(trimmedId) && !trimmedId.includes("@");

    let result;
    if (isCpfInput) {
      const cpfDigits = trimmedId.replace(/\D/g, "");
      result = await signInWithCpf(cpfDigits, senha);
    } else {
      result = await signIn(trimmedId.toLowerCase(), senha);
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
    }

    setLoading(false);
  };

  const isLocked = lockUntil !== null && Date.now() < lockUntil;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="items-center pb-2 pt-8">
          <Pizza className="h-14 w-14 text-primary mb-3" />
          <h1 className="font-heading text-3xl font-bold tracking-tight">Pizza Premiada</h1>
          <p className="text-muted-foreground text-sm mt-2">Acesse sua conta</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="identifier">E-mail ou CPF</Label>
              <Input
                id="identifier"
                placeholder="email@exemplo.com ou 000.000.000-00"
                value={identifier}
                onChange={(e) => handleIdentifierChange(e.target.value)}
                required
                disabled={isLocked}
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

            <div className="text-center">
              <button type="button" className="text-sm text-primary hover:underline">
                Esqueci minha senha
              </button>
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
