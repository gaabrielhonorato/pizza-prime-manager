import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Eye, EyeOff, Shield, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useConsumidorData } from "@/contexts/ConsumidorDataContext";
import { supabase } from "@/integrations/supabase/client";

export default function ConsumidorPerfil() {
  const { toast } = useToast();
  const { usuario, refreshUsuario } = useAuth();
  const { consumidorId, cidade: cidadeInicial, bairro: bairroInicial, aceitaWhatsapp: aceitaInicial, refresh } = useConsumidorData();

  const [showSenha, setShowSenha] = useState(false);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [savingSenha, setSavingSenha] = useState(false);

  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [telefone, setTelefone] = useState(usuario?.telefone ?? "");
  const [cidade, setCidade] = useState(cidadeInicial);
  const [bairro, setBairro] = useState(bairroInicial);
  const [aceitaWhatsapp, setAceitaWhatsapp] = useState(aceitaInicial);

  const [senhas, setSenhas] = useState({ nova: "", confirmar: "" });

  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");

  const salvarPerfil = async () => {
    if (!usuario?.id) return;
    setSavingPerfil(true);
    try {
      await Promise.all([
        supabase.from("usuarios").update({ nome, telefone }).eq("id", usuario.id),
        consumidorId
          ? supabase.from("consumidores").update({ cidade, bairro, aceita_whatsapp: aceitaWhatsapp }).eq("id", consumidorId)
          : Promise.resolve(),
      ]);
      await refreshUsuario();
      refresh();
      toast({ title: "Perfil atualizado", description: "Suas alterações foram salvas com sucesso." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    } finally {
      setSavingPerfil(false);
    }
  };

  const salvarSenha = async () => {
    if (!senhas.nova || senhas.nova !== senhas.confirmar) {
      toast({ title: "Senhas não coincidem", description: "Confirme a nova senha corretamente.", variant: "destructive" });
      return;
    }
    setSavingSenha(true);
    const { error } = await supabase.auth.updateUser({ password: senhas.nova });
    if (error) {
      toast({ title: "Erro ao alterar senha", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha alterada", description: "Sua nova senha foi salva com sucesso." });
      setSenhas({ nova: "", confirmar: "" });
    }
    setSavingSenha(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground">Gerencie seus dados pessoais e configurações</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dados pessoais */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Dados pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <Avatar className="h-16 w-16 border-2 border-primary/30">
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">{iniciais || "?"}</AvatarFallback>
              </Avatar>
            </div>

            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>CPF</Label>
              <Input value={usuario?.cpf ?? "—"} disabled className="opacity-60" />
              <p className="text-[10px] text-muted-foreground">CPF não pode ser alterado após o cadastro</p>
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input value={usuario?.email ?? "—"} disabled className="opacity-60" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone / WhatsApp</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Bairro</Label>
                <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
              </div>
            </div>

            <Badge className="bg-green-600/20 text-green-400 border-green-600/30">✓ Cadastro completo</Badge>

            <Button className="w-full" onClick={salvarPerfil} disabled={savingPerfil}>
              {savingPerfil ? "Salvando..." : "Salvar alterações"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Segurança */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" /> Segurança
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nova senha</Label>
                <div className="relative">
                  <Input
                    type={showSenha ? "text" : "password"}
                    value={senhas.nova}
                    onChange={(e) => setSenhas({ ...senhas, nova: e.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowSenha(!showSenha)}
                  >
                    {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Confirmar nova senha</Label>
                <Input
                  type={showSenha ? "text" : "password"}
                  value={senhas.confirmar}
                  onChange={(e) => setSenhas({ ...senhas, confirmar: e.target.value })}
                />
              </div>
              <Button variant="outline" className="w-full" onClick={salvarSenha} disabled={savingSenha}>
                {savingSenha ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </CardContent>
          </Card>

          {/* Notificações */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" /> Notificações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">WhatsApp ao ganhar cupom</p>
                  <p className="text-xs text-muted-foreground">Receba uma notificação a cada cupom gerado</p>
                </div>
                <Switch checked={aceitaWhatsapp} onCheckedChange={setAceitaWhatsapp} />
              </div>
            </CardContent>
          </Card>

          {/* Datas */}
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Data de cadastro</p>
                  <p className="font-medium">
                    {usuario?.criado_em
                      ? format(new Date(usuario.criado_em), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Último acesso</p>
                  <p className="font-medium">
                    {usuario?.ultimo_acesso
                      ? format(new Date(usuario.ultimo_acesso), "dd/MM/yyyy HH:mm", { locale: ptBR })
                      : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
