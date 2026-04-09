import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Eye, EyeOff, Shield, Bell, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function ConsumidorPerfil() {
  const { toast } = useToast();
  const [showSenha, setShowSenha] = useState(false);
  const [perfil, setPerfil] = useState({
    nome: "Maria Silva", cpf: "123.456.789-00", email: "maria.silva@email.com",
    telefone: "(11) 98765-4321", cidade: "São Paulo", bairro: "Vila Mariana",
    pizzariaFavorita: "ze",
  });
  const [dataNascimento, setDataNascimento] = useState<Date | undefined>();
  const [senhas, setSenhas] = useState({ atual: "", nova: "", confirmar: "" });
  const [notifs, setNotifs] = useState({ cupom: true, novidades: true, resumo: false });

  const salvarPerfil = () => {
    toast({ title: "Perfil atualizado", description: "Suas alterações foram salvas com sucesso." });
  };

  const salvarSenha = () => {
    toast({ title: "Senha alterada", description: "Sua nova senha foi salva com sucesso." });
    setSenhas({ atual: "", nova: "", confirmar: "" });
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
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">MS</AvatarFallback>
              </Avatar>
              <Button variant="outline" size="sm">Alterar foto</Button>
            </div>

            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input value={perfil.nome} onChange={(e) => setPerfil({ ...perfil, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>CPF</Label>
              <Input value={perfil.cpf} disabled className="opacity-60" />
              <p className="text-[10px] text-muted-foreground">CPF não pode ser alterado após o cadastro</p>
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input value={perfil.email} onChange={(e) => setPerfil({ ...perfil, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone / WhatsApp</Label>
              <Input value={perfil.telefone} onChange={(e) => setPerfil({ ...perfil, telefone: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input value={perfil.cidade} onChange={(e) => setPerfil({ ...perfil, cidade: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Bairro</Label>
                <Input value={perfil.bairro} onChange={(e) => setPerfil({ ...perfil, bairro: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Data de nascimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataNascimento && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataNascimento ? format(dataNascimento, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataNascimento} onSelect={setDataNascimento} captionLayout="dropdown-buttons" fromYear={1930} toYear={new Date().getFullYear() - 10} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <p className="text-[10px] text-primary">🎂 Informe seu aniversário e ganhe cupons em dobro no seu mês especial!</p>
            </div>
            <div className="space-y-1.5">
              <Label>Pizzaria favorita</Label>
              <Select value={perfil.pizzariaFavorita} onValueChange={(v) => setPerfil({ ...perfil, pizzariaFavorita: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ze">Pizzaria do Zé</SelectItem>
                  <SelectItem value="roma">Pizzaria Roma</SelectItem>
                  <SelectItem value="mega">Mega Pizza</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Badge className="bg-green-600/20 text-green-400 border-green-600/30">✓ Cadastro completo</Badge>

            <Button className="w-full" onClick={salvarPerfil}>Salvar alterações</Button>
          </CardContent>
        </Card>

        {/* Segurança e notificações */}
        <div className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" /> Segurança
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Senha atual</Label>
                <div className="relative">
                  <Input type={showSenha ? "text" : "password"} value={senhas.atual} onChange={(e) => setSenhas({ ...senhas, atual: e.target.value })} />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowSenha(!showSenha)}>
                    {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Nova senha</Label>
                <Input type={showSenha ? "text" : "password"} value={senhas.nova} onChange={(e) => setSenhas({ ...senhas, nova: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Confirmar nova senha</Label>
                <Input type={showSenha ? "text" : "password"} value={senhas.confirmar} onChange={(e) => setSenhas({ ...senhas, confirmar: e.target.value })} />
              </div>
              <Button variant="outline" className="w-full" onClick={salvarSenha}>Salvar nova senha</Button>
            </CardContent>
          </Card>

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
                <Switch checked={notifs.cupom} onCheckedChange={(v) => setNotifs({ ...notifs, cupom: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Novidades da campanha</p>
                  <p className="text-xs text-muted-foreground">Fique por dentro de novos prêmios e promoções</p>
                </div>
                <Switch checked={notifs.novidades} onCheckedChange={(v) => setNotifs({ ...notifs, novidades: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Resumo mensal por e-mail</p>
                  <p className="text-xs text-muted-foreground">Receba um resumo dos seus cupons todo mês</p>
                </div>
                <Switch checked={notifs.resumo} onCheckedChange={(v) => setNotifs({ ...notifs, resumo: v })} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Data de cadastro</p>
                  <p className="font-medium">15/10/2025</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Último acesso</p>
                  <p className="font-medium">26/03/2026 14:32</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
