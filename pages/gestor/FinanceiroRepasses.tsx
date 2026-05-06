import { useMemo, useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { ArrowRightLeft, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ExportButton from "@/components/gestor/ExportButton";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

interface ContextType { selectedCampanha: string; periodo: string; }

const statusBadge = (s: string) => {
  if (s === "pago") return <Badge className="bg-success text-success-foreground">Pago</Badge>;
  if (s === "processando") return <Badge className="bg-amber-500 text-white">Processando</Badge>;
  return <Badge variant="secondary">Pendente</Badge>;
};

export default function FinanceiroRepasses() {
  const { selectedCampanha } = useOutletContext<ContextType>();
  const [repasses, setRepasses] = useState<any[]>([]);
  const [pizzarias, setPizzarias] = useState<any[]>([]);
  const [selectedPizzaria, setSelectedPizzaria] = useState("todas");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState<string | null>(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payObs, setPayObs] = useState("");

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      let rQ = supabase.from("repasses").select("*");
      if (selectedCampanha !== "todas") rQ = rQ.eq("campanha_id", selectedCampanha);
      const { data: r } = await rQ.order("periodo_inicio", { ascending: false });
      const { data: pz } = await supabase.from("pizzarias").select("id, nome");
      setRepasses(r ?? []);
      setPizzarias(pz ?? []);
      setLoading(false);
    };
    fetch();
  }, [selectedCampanha]);

  const pzName = (id: string) => pizzarias.find(p => p.id === id)?.nome ?? "—";

  const filtered = useMemo(() => {
    let r = repasses;
    if (selectedPizzaria !== "todas") r = r.filter(x => x.pizzaria_id === selectedPizzaria);
    if (statusFilter !== "todos") r = r.filter(x => x.status === statusFilter);
    return r;
  }, [repasses, selectedPizzaria, statusFilter]);

  const stats = useMemo(() => {
    const total = repasses.reduce((s, r) => s + Number(r.valor_repasse), 0);
    const pago = repasses.filter(r => r.status === "pago").reduce((s, r) => s + Number(r.valor_repasse), 0);
    const pendente = total - pago;
    return { total, pago, pendente };
  }, [repasses]);

  const markPaid = async () => {
    if (!payModal) return;
    const { error } = await supabase.from("repasses").update({ status: "pago", data_pagamento: payDate }).eq("id", payModal);
    if (error) { toast.error("Erro ao atualizar."); return; }
    setRepasses(prev => prev.map(r => r.id === payModal ? { ...r, status: "pago", data_pagamento: payDate } : r));
    setPayModal(null);
    toast.success("Repasse marcado como pago!");
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Repasses</h1>
        <div className="flex items-center gap-3">
          <Select value={selectedPizzaria} onValueChange={setSelectedPizzaria}>
            <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas pizzarias</SelectItem>
              {pizzarias.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="processando">Processando</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
            </SelectContent>
          </Select>
          <ExportButton
            data={filtered.map(r => ({ pizzaria: pzName(r.pizzaria_id), periodo: `${r.periodo_inicio} a ${r.periodo_fim}`, totalVendido: fmt(Number(r.valor_bruto)), repasse: fmt(Number(r.valor_repasse)), status: r.status, dataPagamento: r.data_pagamento || "—" }))}
            columns={[
              { key: "pizzaria", label: "Pizzaria" }, { key: "periodo", label: "Período" },
              { key: "totalVendido", label: "Total Vendido" }, { key: "repasse", label: "Repasse (85%)" },
              { key: "status", label: "Status" }, { key: "dataPagamento", label: "Data Pagamento" },
            ]}
            fileName="financeiro-repasses"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2"><ArrowRightLeft className="h-5 w-5 text-primary" /><CardTitle className="text-sm text-muted-foreground">Total a Repassar</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold">{fmt(stats.total)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2"><CheckCircle className="h-5 w-5 text-success" /><CardTitle className="text-sm text-muted-foreground">Já Repassado</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold text-success">{fmt(stats.pago)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2"><Clock className="h-5 w-5 text-amber-500" /><CardTitle className="text-sm text-muted-foreground">Pendente</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold text-amber-500">{fmt(stats.pendente)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2"><AlertCircle className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-sm text-muted-foreground">Próximo Repasse</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-heading font-bold">—</p></CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="font-heading">Repasses por Pizzaria</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pizzaria</TableHead><TableHead>Período</TableHead>
                <TableHead className="text-right">Total Vendido</TableHead><TableHead className="text-right">Repasse (85%)</TableHead>
                <TableHead>Status</TableHead><TableHead>Data Pagamento</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">Nenhum repasse encontrado.</TableCell></TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{pzName(r.pizzaria_id)}</TableCell>
                  <TableCell className="text-sm">{r.periodo_inicio} a {r.periodo_fim}</TableCell>
                  <TableCell className="text-right">{fmt(Number(r.valor_bruto))}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(Number(r.valor_repasse))}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell>{r.data_pagamento ? new Date(r.data_pagamento).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell className="text-right">
                    {r.status !== "pago" && (
                      <Button size="sm" variant="outline" onClick={() => { setPayModal(r.id); setPayDate(new Date().toISOString().slice(0, 10)); setPayObs(""); }}>
                        Marcar como pago
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!payModal} onOpenChange={o => !o && setPayModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Pago</DialogTitle>
            <DialogDescription>Informe a data do pagamento.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Data do Pagamento</Label>
              <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea value={payObs} onChange={e => setPayObs(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayModal(null)}>Cancelar</Button>
            <Button onClick={markPaid}>Confirmar Pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}