import { useState } from "react";
import { User, Shield, Truck, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const ultimasEntregas = [
  { data: "26/03/2026", hora: "14:35", endereco: "Rua das Palmeiras, 320 - Centro", status: "Concluído" },
  { data: "26/03/2026", hora: "13:50", endereco: "Av. Rebouças, 1200 - Pinheiros", status: "Concluído" },
  { data: "26/03/2026", hora: "13:15", endereco: "Rua Oscar Freire, 780 - Jardins", status: "Concluído" },
  { data: "25/03/2026", hora: "19:40", endereco: "Rua Haddock Lobo, 595 - Cerqueira César", status: "Concluído" },
  { data: "25/03/2026", hora: "18:20", endereco: "Av. Brasil, 1500 - Jardim América", status: "Concluído" },
  { data: "25/03/2026", hora: "17:05", endereco: "Rua Consolação, 2300 - Consolação", status: "Concluído" },
  { data: "24/03/2026", hora: "20:10", endereco: "Av. Faria Lima, 800 - Itaim Bibi", status: "Concluído" },
  { data: "24/03/2026", hora: "19:00", endereco: "Rua Pamplona, 450 - Jardins", status: "Concluído" },
  { data: "24/03/2026", hora: "14:30", endereco: "Rua Bela Cintra, 1100 - Consolação", status: "Concluído" },
  { data: "23/03/2026", hora: "21:15", endereco: "Av. Angélica, 2000 - Higienópolis", status: "Concluído" },
];

export default function EntregadorPerfil() {
  const [nome, setNome] = useState("João Entregador");
  const [telefone, setTelefone] = useState("(11) 99999-1234");
  const [email, setEmail] = useState("joao@email.com");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const salvarDados = () => toast.success("Dados atualizados com sucesso!");
  const salvarSenha = () => {
    if (novaSenha !== confirmarSenha) { toast.error("As senhas não coincidem."); return; }
    toast.success("Senha alterada com sucesso!");
    setSenhaAtual(""); setNovaSenha(""); setConfirmarSenha("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Perfil</h1>
        <p className="text-muted-foreground text-sm">Seus dados e histórico de entregas</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna esquerda */}
        <div className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Dados pessoais</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 mb-2">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <Button variant="outline" size="sm">Alterar foto</Button>
              </div>
              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Pizzaria vinculada</Label>
                <Input value="Pizzaria do Zé" disabled className="opacity-60" />
              </div>
              <div className="flex items-center gap-2">
                <Label>Status da conta:</Label>
                <Badge className="bg-green-500/20 text-green-400">Ativo</Badge>
              </div>
              <Button onClick={salvarDados} className="w-full">Salvar alterações</Button>
            </CardContent>
          </Card>
        </div>

        {/* Coluna direita */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Truck className="h-5 w-5 text-primary" /></div>
                <div><p className="text-2xl font-bold">87</p><p className="text-xs text-muted-foreground">Entregas no ciclo</p></div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Package className="h-5 w-5 text-primary" /></div>
                <div><p className="text-2xl font-bold">5</p><p className="text-xs text-muted-foreground">Entregas hoje</p></div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-lg">Últimas entregas</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[280px] overflow-auto">
                {ultimasEntregas.map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                    <div>
                      <p className="text-xs text-muted-foreground">{e.data} às {e.hora}</p>
                      <p className="text-xs">{e.endereco}</p>
                    </div>
                    <Badge variant="secondary" className="bg-green-500/20 text-green-400 text-xs">{e.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Segurança</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5"><Label>Senha atual</Label><Input type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Nova senha</Label><Input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Confirmar nova senha</Label><Input type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} /></div>
              <Button onClick={salvarSenha} className="w-full">Salvar nova senha</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
