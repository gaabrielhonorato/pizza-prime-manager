import { useEffect, useState } from "react";
import { Loader2, Save, Shield, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

export default function MinhaConta() {
  const { usuario, refreshUsuario } = useAuth();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    setNome(usuario.nome || "");
    setTelefone(usuario.telefone || "");
  }, [usuario]);

  const handleSave = async () => {
    if (!usuario) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("usuarios")
        .update({ nome: nome.trim(), telefone: telefone.trim() || null })
        .eq("id", usuario.id);
      if (error) throw error;
      await refreshUsuario();
      toast.success("Minha conta atualizada com sucesso.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao salvar conta: " + message);
    } finally {
      setSaving(false);
    }
  };

  if (!usuario) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Carregando conta...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Minha Conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gerencie seus dados de usuário do painel gestor.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-primary" /> Dados cadastrais do usuário
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone / WhatsApp</Label>
                <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input value={usuario.email} disabled className="opacity-70" />
              </div>
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <Input value={usuario.cpf || "-"} disabled className="opacity-70" />
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving || !nome.trim()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar alterações
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" /> Segurança e acesso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground">Perfil</p>
              <Badge className="mt-1 capitalize">{usuario.perfil}</Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <Badge variant={usuario.ativo ? "default" : "destructive"} className="mt-1">
                {usuario.ativo ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Cadastro</p>
              <p className="font-medium text-foreground">{formatDate(usuario.criado_em)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Último acesso</p>
              <p className="font-medium text-foreground">{formatDate(usuario.ultimo_acesso)}</p>
            </div>
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Esta página não possui foto de perfil. A imagem da marca fica em Configurações, aba Empresa.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
