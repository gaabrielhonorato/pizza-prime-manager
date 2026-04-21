import { useState } from "react";
import { Link } from "react-router-dom";
import { Pizza, ArrowLeft, Mail } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
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
          <p className="text-muted-foreground text-sm mt-2">Recuperar senha</p>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center py-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-foreground">
                Enviamos um link para <strong>{email}</strong>. Verifique sua caixa de entrada e spam.
              </p>
              <Link to="/">
                <Button variant="outline" className="w-full mt-4">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail cadastrado</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  required
                />
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link de redefinição"}
              </Button>

              <div className="text-center">
                <Link to="/" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" /> Voltar ao login
                </Link>
              </div>
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
