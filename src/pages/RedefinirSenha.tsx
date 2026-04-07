import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Pizza, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Supabase handles the token exchange automatically via the URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get("type");
    if (type !== "recovery") {
      // Also check for access_token which indicates valid recovery flow
      const accessToken = hashParams.get("access_token");
      if (!accessToken) {
        // No valid recovery token, but let's not redirect immediately
        // as the session might already be set by Supabase client
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    setError("");

    const { error } = await supabase.auth.updateUser({ password: senha });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => navigate("/"), 3000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="items-center pb-2 pt-8">
          <Pizza className="h-14 w-14 text-primary mb-3" />
          <h1 className="font-heading text-3xl font-bold tracking-tight">Pizza Premiada</h1>
          <p className="text-muted-foreground text-sm mt-2">Redefinir senha</p>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4 text-center py-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-foreground">Senha redefinida com sucesso!</p>
              <p className="text-xs text-muted-foreground">Redirecionando para o login...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="nova-senha">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="nova-senha"
                    type={showSenha ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={senha}
                    onChange={(e) => { setSenha(e.target.value); setError(""); }}
                    required
                    minLength={6}
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
              <div className="space-y-2">
                <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
                <Input
                  id="confirmar-senha"
                  type={showSenha ? "text" : "password"}
                  placeholder="Repita a senha"
                  value={confirmar}
                  onChange={(e) => { setConfirmar(e.target.value); setError(""); }}
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-8">
        Pizza Premiada © 2025 — Todos os direitos reservados
      </p>
    </div>
  );
}
