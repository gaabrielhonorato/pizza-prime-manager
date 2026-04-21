import { useState } from "react";
import { Save, Upload, Shield, Monitor } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMinhaPizzaria } from "@/contexts/MinhaPizzariaContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export default function MinhaPizzaria() {
  const { pizzaria, loading, refetch } = useMinhaPizzaria();
  const { usuario } = useAuth();

  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [cep, setCep] = useState("");
  const [telefone, setTelefone] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Sync form with loaded data
  if (pizzaria && !initialized) {
    setNome(pizzaria.nome);
    setCnpj(pizzaria.cnpj);
    setEndereco(pizzaria.endereco);
    setCidade(pizzaria.cidade);
    setBairro(pizzaria.bairro);
    setCep(pizzaria.cep);
    setTelefone(pizzaria.telefone);
    setInitialized(true);
  }

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
  if (!pizzaria) return <div className="flex items-center justify-center h-64 text-muted-foreground">Nenhuma pizzaria vinculada.</div>;

  const handleSave = async () => {
    const { error } = await supabase.from("pizzarias").update({
      nome, cnpj: cnpj || null, endereco: endereco || null,
      cidade, bairro, cep: cep || null, telefone,
    }).eq("id", pizzaria.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Dados salvos com sucesso!" });
      refetch();
    }
  };

  const handleChangePassword = async () => {
    if (novaSenha !== confirmarSenha) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    if (novaSenha.length < 6) {
      toast({ title: "A senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) {
      toast({ title: "Erro ao alterar senha", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha alterada com sucesso!" });
      setSenhaAtual(""); setNovaSenha(""); setConfirmarSenha("");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">🏪 Minha Pizzaria</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie os dados da sua pizzaria e segurança da conta.</p>
      </div>

      <Tabs defaultValue="cadastrais" className="space-y-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="cadastrais" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Dados Cadastrais</TabsTrigger>
          <TabsTrigger value="seguranca" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Acesso e Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="cadastrais" className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base">Informações da Pizzaria</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Nome da pizzaria</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>CNPJ</Label><Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Endereço completo</Label><Input value={endereco} onChange={(e) => setEndereco(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Cidade</Label><Input value={cidade} onChange={(e) => setCidade(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Bairro</Label><Input value={bairro} onChange={(e) => setBairro(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>CEP</Label><Input value={cep} onChange={(e) => setCep(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
              </div>
              <Button className="mt-6" onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" /> Salvar alterações
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base text-muted-foreground">Campos gerenciados pelo Gestor</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Status na promoção</p>
                  <Badge className="mt-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{pizzaria.status}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data de entrada</p>
                  <p className="font-medium mt-1">{pizzaria.dataEntrada ? new Date(pizzaria.dataEntrada + "T12:00:00").toLocaleDateString("pt-BR") : "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Meta mensal de vendas</p>
                  <p className="font-medium mt-1">R$ {pizzaria.metaMensal.toLocaleString("pt-BR")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seguranca" className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Informações da Conta</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm"><span className="text-muted-foreground">E-mail:</span> {usuario?.email}</p>
              <p className="text-sm"><span className="text-muted-foreground">Nome:</span> {usuario?.nome}</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base">Alterar Senha</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5"><Label>Senha atual</Label><Input type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Nova senha</Label><Input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Confirmar nova senha</Label><Input type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} /></div>
              </div>
              <Button className="mt-4" size="sm" onClick={handleChangePassword}>
                Salvar nova senha
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
