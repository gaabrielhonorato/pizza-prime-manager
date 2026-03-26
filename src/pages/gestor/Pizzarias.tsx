import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Pizzaria, pizzarias as initialData } from "@/data/mockData";

const statusVariant = (s: string) =>
  s === "Ativa" ? "default" : s === "Prospectada" ? "secondary" : "outline";

const emptyForm: Omit<Pizzaria, "id"> = {
  nome: "", responsavel: "", telefone: "", cidade: "", bairro: "",
  status: "Prospectada", matriculaPaga: false, dataEntrada: new Date().toISOString().slice(0, 10),
};

export default function Pizzarias() {
  const [data, setData] = useState<Pizzaria[]>(initialData);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<Pizzaria, "id">>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const openNew = () => { setForm(emptyForm); setEditId(null); setOpen(true); };
  const openEdit = (p: Pizzaria) => {
    const { id, ...rest } = p;
    setForm(rest); setEditId(id); setOpen(true);
  };
  const handleDelete = (id: string) => setData((d) => d.filter((p) => p.id !== id));

  const handleSave = () => {
    if (editId) {
      setData((d) => d.map((p) => (p.id === editId ? { ...p, ...form } : p)));
    } else {
      setData((d) => [...d, { ...form, id: crypto.randomUUID() }]);
    }
    setOpen(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">Pizzarias</h1>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Nova Pizzaria</Button>
      </div>

      <div className="rounded-lg border bg-card overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Bairro</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell>{p.responsavel}</TableCell>
                <TableCell>{p.cidade}</TableCell>
                <TableCell>{p.bairro}</TableCell>
                <TableCell>{p.telefone}</TableCell>
                <TableCell><Badge variant={statusVariant(p.status)}>{p.status}</Badge></TableCell>
                <TableCell>{p.matriculaPaga ? <span className="text-success font-medium">Sim</span> : <span className="text-muted-foreground">Não</span>}</TableCell>
                <TableCell>{new Date(p.dataEntrada).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">{editId ? "Editar Pizzaria" : "Nova Pizzaria"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {(["nome", "responsavel", "telefone", "cidade", "bairro"] as const).map((field) => (
              <div key={field} className="grid gap-1.5">
                <Label className="capitalize">{field === "responsavel" ? "Responsável" : field}</Label>
                <Input value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
              </div>
            ))}
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Pizzaria["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Prospectada">Prospectada</SelectItem>
                  <SelectItem value="Ativa">Ativa</SelectItem>
                  <SelectItem value="Inativa">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.matriculaPaga} onCheckedChange={(v) => setForm({ ...form, matriculaPaga: v })} />
              <Label>Matrícula Paga</Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
