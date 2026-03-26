import { useState } from "react";
import { Save, Upload, Shield, Monitor } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

const loginHistory = [
  { data: "25/03/2026 14:32", dispositivo: "Chrome — Windows 11" },
  { data: "24/03/2026 09:15", dispositivo: "Chrome — Windows 11" },
  { data: "22/03/2026 18:45", dispositivo: "Safari — iPhone 15" },
  { data: "20/03/2026 10:02", dispositivo: "Chrome — macOS" },
  { data: "18/03/2026 08:30", dispositivo: "Chrome — Windows 11" },
];

export default function MinhaPizzaria() {
  /* Cadastrais */
  const [nome, setNome] = useState("Pizzaria do Zé");
  const [cnpj, setCnpj] = useState("12.345.678/0001-99");
  const [endereco, setEndereco] = useState("Rua das Pizzas, 123");
  const [cidade, setCidade] = useState("São Paulo");
  const [bairro, setBairro] = useState("Vila Madalena");
  const [cep, setCep] = useState("01234-567");
  const [telefone, setTelefone] = useState("(11) 3456-7890");
  const [whatsapp, setWhatsapp] = useState("(11) 91234-5678");
  const [emailContato, setEmailContato] = useState("contato@pizzariadoze.com.br");

  /* Segurança */
  const [novoEmail, setNovoEmail] = useState("ze@pizzariadoze.com.br");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

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

        {/* ── Dados Cadastrais ── */}
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
                <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>E-mail de contato</Label><Input type="email" value={emailContato} onChange={(e) => setEmailContato(e.target.value)} /></div>
              </div>

              {/* Logo upload */}
              <div className="mt-4 space-y-1.5">
                <Label>Logo da pizzaria</Label>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-lg border border-dashed border-border bg-secondary/50 flex items-center justify-center text-muted-foreground text-xs">Logo</div>
                  <Button variant="outline" size="sm"><Upload className="h-3.5 w-3.5 mr-1" /> Upload</Button>
                </div>
              </div>

              <Button className="mt-6" onClick={() => toast({ title: "Dados salvos", description: "Alterações salvas com sucesso." })}>
                <Save className="h-4 w-4 mr-1" /> Salvar alterações
              </Button>
            </CardContent>
          </Card>

          {/* Read-only fields */}
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base text-muted-foreground">Campos gerenciados pelo Gestor</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Status na promoção</p>
                  <Badge className="mt-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Ativa</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data de entrada</p>
                  <p className="font-medium mt-1">15/12/2025</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Meta mensal de vendas</p>
                  <p className="font-medium mt-1">R$ 20.000</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Acesso e Segurança ── */}
        <TabsContent value="seguranca" className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Alterar E-mail de Acesso</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5"><Label>Novo e-mail</Label><Input type="email" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} /></div>
              <Button size="sm" onClick={() => toast({ title: "E-mail atualizado" })}>Salvar e-mail</Button>
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
              <Button className="mt-4" size="sm" onClick={() => toast({ title: "Senha alterada com sucesso" })}>
                Salvar nova senha
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Monitor className="h-4 w-4" /> Últimos Acessos</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data e Hora</TableHead>
                    <TableHead>Dispositivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loginHistory.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{l.data}</TableCell>
                      <TableCell className="text-xs">{l.dispositivo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
