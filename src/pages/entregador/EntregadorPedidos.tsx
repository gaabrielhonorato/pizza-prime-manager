import { useState } from "react";
import { Package, CheckCircle2, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface Pedido {
  id: string;
  horario: string;
  cliente: string;
  endereco: string;
  valor: number;
  status: "Pendente" | "Em andamento" | "Concluído";
  horarioSaida?: string;
  horarioEntrega?: string;
}

const initialPedidos: Pedido[] = [
  { id: "#1245", horario: "11:20", cliente: "Carlos Oliveira", endereco: "Av. Paulista, 1000 - Bela Vista", valor: 65.9, status: "Concluído", horarioSaida: "11:25", horarioEntrega: "11:48" },
  { id: "#1246", horario: "12:05", cliente: "Ana Santos", endereco: "Rua Augusta, 450 - Consolação", valor: 42.5, status: "Concluído", horarioSaida: "12:10", horarioEntrega: "12:32" },
  { id: "#1247", horario: "13:15", cliente: "Pedro Lima", endereco: "Rua Oscar Freire, 780 - Jardins", valor: 89.0, status: "Concluído", horarioSaida: "13:20", horarioEntrega: "13:45" },
  { id: "#1248", horario: "13:50", cliente: "Juliana Costa", endereco: "Av. Rebouças, 1200 - Pinheiros", valor: 55.0, status: "Em andamento", horarioSaida: "13:55" },
  { id: "#1249", horario: "14:35", cliente: "Maria Silva", endereco: "Rua das Palmeiras, 320 - Centro", valor: 78.9, status: "Pendente" },
  { id: "#1250", horario: "15:00", cliente: "Roberto Almeida", endereco: "Rua Haddock Lobo, 595 - Cerqueira César", valor: 120.0, status: "Pendente" },
];

const statusColor: Record<string, string> = {
  Pendente: "bg-muted text-muted-foreground",
  "Em andamento": "bg-yellow-500/20 text-yellow-400",
  Concluído: "bg-green-500/20 text-green-400",
};

export default function EntregadorPedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>(initialPedidos);
  const [periodo, setPeriodo] = useState("hoje");
  const [confirmModal, setConfirmModal] = useState<string | null>(null);

  const sairParaEntrega = (id: string) => {
    setPedidos((prev) =>
      prev.map((p) => p.id === id ? { ...p, status: "Em andamento" as const, horarioSaida: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) } : p)
    );
  };

  const confirmarEntrega = (id: string) => {
    setPedidos((prev) =>
      prev.map((p) => p.id === id ? { ...p, status: "Concluído" as const, horarioEntrega: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) } : p)
    );
    setConfirmModal(null);
  };

  const renderTable = (filtered: Pedido[]) => {
    const total = filtered.reduce((s, p) => s + p.valor, 0);
    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Horário</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum pedido nesta categoria.</TableCell></TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono font-semibold">{p.id}</TableCell>
                  <TableCell>{p.horario}</TableCell>
                  <TableCell className="font-medium">{p.cliente}</TableCell>
                  <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">{p.endereco}</TableCell>
                  <TableCell className="text-right">R$ {p.valor.toFixed(2)}</TableCell>
                  <TableCell><Badge variant="secondary" className={statusColor[p.status]}>{p.status}</Badge></TableCell>
                  <TableCell>
                    {p.status === "Pendente" && (
                      <Button size="sm" onClick={() => sairParaEntrega(p.id)}>
                        <Truck className="mr-1 h-3 w-3" /> Sair para entrega
                      </Button>
                    )}
                    {p.status === "Em andamento" && (
                      <Button size="sm" variant="outline" className="border-green-500/50 text-green-400 hover:bg-green-500/10" onClick={() => setConfirmModal(p.id)}>
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Confirmar entrega
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {filtered.length > 0 && (
          <div className="flex justify-between items-center pt-3 border-t border-border text-sm text-muted-foreground">
            <span>{filtered.length} pedido(s)</span>
            <span className="font-semibold text-foreground">Total: R$ {total.toFixed(2)}</span>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <p className="text-muted-foreground text-sm">Gerencie suas entregas</p>
        </div>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="7dias">Últimos 7 dias</SelectItem>
            <SelectItem value="mes">Este mês</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="pendentes">
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
          <TabsTrigger value="andamento">Em andamento</TabsTrigger>
          <TabsTrigger value="concluidos">Concluídos</TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes">
          <Card className="border-border bg-card"><CardContent className="p-4">{renderTable(pedidos.filter((p) => p.status === "Pendente"))}</CardContent></Card>
        </TabsContent>
        <TabsContent value="andamento">
          <Card className="border-border bg-card"><CardContent className="p-4">{renderTable(pedidos.filter((p) => p.status === "Em andamento"))}</CardContent></Card>
        </TabsContent>
        <TabsContent value="concluidos">
          <Card className="border-border bg-card"><CardContent className="p-4">{renderTable(pedidos.filter((p) => p.status === "Concluído"))}</CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Modal de confirmação */}
      <Dialog open={!!confirmModal} onOpenChange={() => setConfirmModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar entrega</DialogTitle>
            <DialogDescription>Confirmar que o pedido {confirmModal} foi entregue?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmModal(null)}>Cancelar</Button>
            <Button className="border-green-500/50 text-green-400 hover:bg-green-500/10" variant="outline" onClick={() => confirmModal && confirmarEntrega(confirmModal)}>Confirmar entrega</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
