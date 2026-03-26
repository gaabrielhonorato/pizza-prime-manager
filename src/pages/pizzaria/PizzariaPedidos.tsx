import { useState, useMemo } from "react";
import { Search, Download, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface Pedido {
  id: string;
  numero: string;
  data: Date;
  cliente: string;
  itens: string;
  valor: number;
  canal: string;
  cupons: number;
  status: "Concluído" | "Cancelado";
}

const CANAIS = ["CardápioWeb", "WhatsApp", "Balcão"];
const CLIENTES = ["Lucas Mendes", "Camila Ribeiro", "Rafael Torres", "Juliana Martins", "Thiago Barbosa", "Amanda Lopes", "Bruno Cardoso"];
const ITENS_LIST = ["2x Margherita + 1x Calabresa", "1x Pepperoni G + Refrigerante", "3x Pizza Portuguesa", "1x 4 Queijos + Suco", "2x Frango c/ Catupiry"];

function genPedidos(): Pedido[] {
  const arr: Pedido[] = [];
  for (let i = 0; i < 60; i++) {
    const d = new Date(2026, 2, Math.floor(Math.random() * 26) + 1, Math.floor(Math.random() * 14) + 8, Math.floor(Math.random() * 60));
    const valor = Math.floor(Math.random() * 120) + 30;
    arr.push({
      id: crypto.randomUUID(),
      numero: `#${(4000 + i).toString()}`,
      data: d,
      cliente: CLIENTES[i % CLIENTES.length],
      itens: ITENS_LIST[i % ITENS_LIST.length],
      valor,
      canal: CANAIS[i % 3],
      cupons: Math.floor(valor / 30),
      status: Math.random() > 0.1 ? "Concluído" : "Cancelado",
    });
  }
  return arr.sort((a, b) => b.data.getTime() - a.data.getTime());
}

const pedidosMock = genPedidos();

export default function PizzariaPedidos() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterCanal, setFilterCanal] = useState("Todos");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let list = [...pedidosMock];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.numero.toLowerCase().includes(q) || p.cliente.toLowerCase().includes(q));
    }
    if (filterStatus !== "Todos") list = list.filter((p) => p.status === filterStatus);
    if (filterCanal !== "Todos") list = list.filter((p) => p.canal === filterCanal);
    if (dateFrom) list = list.filter((p) => p.data >= dateFrom);
    if (dateTo) {
      const end = new Date(dateTo); end.setHours(23, 59, 59);
      list = list.filter((p) => p.data <= end);
    }
    return list;
  }, [search, filterStatus, filterCanal, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const totalValor = filtered.reduce((s, p) => s + p.valor, 0);
  const media = filtered.length > 0 ? Math.round(totalValor / filtered.length) : 0;

  const exportCSV = () => {
    const header = "Número,Data,Cliente,Itens,Valor,Canal,Cupons,Status";
    const rows = filtered.map((p) =>
      [p.numero, format(p.data, "dd/MM/yyyy HH:mm"), p.cliente, `"${p.itens}"`, `R$ ${p.valor}`, p.canal, p.cupons, p.status].join(",")
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "pedidos.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const DatePicker = ({ label, value, onChange }: { label: string; value?: Date; onChange: (d: Date | undefined) => void }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("text-xs h-8 w-[130px] justify-start", !value && "text-muted-foreground")}>
          <CalendarIcon className="mr-1 h-3 w-3" />
          {value ? format(value, "dd/MM/yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">📋 Pedidos</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie os pedidos da sua pizzaria.</p>
      </div>

      {/* Filters */}
      <Card className="border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nº ou cliente..." className="pl-8 h-8 text-xs" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <DatePicker label="De" value={dateFrom} onChange={(d) => { setDateFrom(d); setPage(1); }} />
          <DatePicker label="Até" value={dateTo} onChange={(d) => { setDateTo(d); setPage(1); }} />
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              <SelectItem value="Concluído">Concluído</SelectItem>
              <SelectItem value="Cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCanal} onValueChange={(v) => { setFilterCanal(v); setPage(1); }}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              {CANAIS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="text-xs" onClick={exportCSV}>
            <Download className="mr-1 h-3 w-3" /> CSV
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead className="text-right">Cupons</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-xs">{p.numero}</TableCell>
                  <TableCell className="text-xs">{format(p.data, "dd/MM/yy HH:mm")}</TableCell>
                  <TableCell className="text-xs">{p.cliente}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{p.itens}</TableCell>
                  <TableCell className="text-right text-xs">R$ {p.valor}</TableCell>
                  <TableCell className="text-xs">{p.canal}</TableCell>
                  <TableCell className="text-right text-xs font-bold text-primary">{p.cupons}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={p.status === "Concluído" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                      {p.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Footer totals */}
          <div className="border-t border-border px-4 py-3 flex flex-wrap gap-6 text-sm">
            <span><span className="text-muted-foreground">Pedidos:</span> <strong>{filtered.length}</strong></span>
            <span><span className="text-muted-foreground">Total:</span> <strong>R$ {totalValor.toLocaleString("pt-BR")}</strong></span>
            <span><span className="text-muted-foreground">Média:</span> <strong>R$ {media}</strong></span>
          </div>

          {/* Pagination */}
          <div className="border-t border-border px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-7 w-[80px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 30, 50].map((n) => <SelectItem key={n} value={String(n)}>{n} / pág</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Próxima</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
