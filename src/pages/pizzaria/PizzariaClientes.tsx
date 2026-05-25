import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMinhaPizzaria } from "@/contexts/MinhaPizzariaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, UserCheck, UserX, UserPlus, Search, Download, BarChart2, List, FileSpreadsheet, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { C, TABLE_STYLES, loadLetteringDataUrl, buildPdfHeader, addPdfFooter } from "@/lib/pdf-helpers";
import TablePagination from "@/components/gestor/TablePagination";

interface ClienteRow {
  consumidorId: string;
  nome: string;
  telefone: string;
  totalPedidos: number;
  totalGasto: number;
  cuponsGerados: number;
  primeiroPedido: string | null;
  ultimoPedido: string | null;
  cadastroCompleto: boolean;
  criadoEm: string;
}

export default function PizzariaClientes() {
  const { pizzaria } = useMinhaPizzaria();
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [sortBy, setSortBy] = useState("ultimoPedido");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    if (!pizzaria) return;
    const fetchClientes = async () => {
      setLoading(true);
      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("consumidor_id, valor_total, cupons_gerados, data_pedido")
        .eq("pizzaria_id", pizzaria.id);

      if (!pedidos || pedidos.length === 0) { setClientes([]); setLoading(false); return; }

      const map = new Map<string, { total: number; gasto: number; cupons: number; primeiro: string; ultimo: string }>();
      for (const p of pedidos) {
        if (!p.consumidor_id) continue;
        const curr = map.get(p.consumidor_id) ?? { total: 0, gasto: 0, cupons: 0, primeiro: p.data_pedido, ultimo: p.data_pedido };
        curr.total++;
        curr.gasto += Number(p.valor_total);
        curr.cupons += p.cupons_gerados;
        if (p.data_pedido < curr.primeiro) curr.primeiro = p.data_pedido;
        if (p.data_pedido > curr.ultimo) curr.ultimo = p.data_pedido;
        map.set(p.consumidor_id, curr);
      }

      const consIds = [...map.keys()];
      if (consIds.length === 0) { setClientes([]); setLoading(false); return; }

      const { data: consumidores } = await supabase
        .from("consumidores")
        .select("id, cadastro_completo, criado_em, usuario_id, usuarios(nome, telefone)")
        .in("id", consIds);

      const rows: ClienteRow[] = (consumidores ?? []).map((c: any) => {
        const agg = map.get(c.id);
        return {
          consumidorId: c.id,
          nome: c.usuarios?.nome ?? "—",
          telefone: c.usuarios?.telefone ?? "—",
          totalPedidos: agg?.total ?? 0,
          totalGasto: agg?.gasto ?? 0,
          cuponsGerados: agg?.cupons ?? 0,
          primeiroPedido: agg?.primeiro ?? null,
          ultimoPedido: agg?.ultimo ?? null,
          cadastroCompleto: c.cadastro_completo,
          criadoEm: c.criado_em,
        };
      });

      setClientes(rows);
      setLoading(false);
    };
    fetchClientes();
  }, [pizzaria]);

  const now = new Date();
  const mesAtual = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const totalClientes = clientes.length;
  const completos = clientes.filter(c => c.cadastroCompleto).length;
  const pendentes = totalClientes - completos;
  const novosMes = clientes.filter(c => c.criadoEm >= mesAtual).length;

  const filtered = useMemo(() => {
    let r = [...clientes];
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(c => c.nome.toLowerCase().includes(q) || c.telefone.includes(q));
    }
    if (statusFilter === "completo") r = r.filter(c => c.cadastroCompleto);
    if (statusFilter === "pendente") r = r.filter(c => !c.cadastroCompleto);
    if (sortBy === "ultimoPedido") r.sort((a, b) => (b.ultimoPedido ?? "").localeCompare(a.ultimoPedido ?? ""));
    if (sortBy === "totalGasto") r.sort((a, b) => b.totalGasto - a.totalGasto);
    if (sortBy === "totalPedidos") r.sort((a, b) => b.totalPedidos - a.totalPedidos);
    if (sortBy === "cupons") r.sort((a, b) => b.cuponsGerados - a.cuponsGerados);
    return r;
  }, [clientes, search, statusFilter, sortBy]);

  const paged = pageSize === 0 ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize);

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
  const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  async function exportSinteticoPDF() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const lettering = await loadLetteringDataUrl();
    let y = buildPdfHeader(doc, "Clientes — Relatório Sintético", pizzaria?.nome ?? "", [], lettering);

    const kpis = [
      { label: "Total de clientes", value: String(totalClientes) },
      { label: "Cadastros completos", value: String(completos) },
      { label: "Cadastros pendentes", value: String(pendentes) },
      { label: "Novos este mês", value: String(novosMes) },
    ];
    const boxW = 42; const boxH = 22; const gap = 4; const startX = 20;
    kpis.forEach((k, i) => {
      const bx = startX + i * (boxW + gap);
      doc.setFillColor(...C.slate50); doc.setDrawColor(...C.slate200); doc.setLineWidth(0.4);
      doc.rect(bx, y, boxW, boxH, "FD");
      doc.setFontSize(6); doc.setTextColor(...C.slate500); doc.setFont("helvetica", "normal");
      doc.text(k.label, bx + 3, y + 7, { maxWidth: boxW - 6 });
      doc.setFontSize(11); doc.setTextColor(...C.slate900); doc.setFont("helvetica", "bold");
      doc.text(k.value, bx + 3, y + 17);
    });
    y += boxH + 10;

    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.slate900);
    doc.text("Resumo por Status", 20, y); y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Status", "Qtd", "%"]],
      body: [
        ["Completo", String(completos), totalClientes > 0 ? `${((completos / totalClientes) * 100).toFixed(1)}%` : "0%"],
        ["Pendente", String(pendentes), totalClientes > 0 ? `${((pendentes / totalClientes) * 100).toFixed(1)}%` : "0%"],
      ],
      ...TABLE_STYLES,
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.slate900);
    doc.text(`Top 10 Clientes por Gasto`, 20, y); y += 6;

    const top10 = [...clientes].sort((a, b) => b.totalGasto - a.totalGasto).slice(0, 10);
    autoTable(doc, {
      startY: y,
      head: [["Nome", "Pedidos", "Total Gasto", "Cupons", "Status"]],
      body: top10.map(c => [c.nome, String(c.totalPedidos), fmtMoney(c.totalGasto), String(c.cuponsGerados), c.cadastroCompleto ? "Completo" : "Pendente"]),
      ...TABLE_STYLES,
    });

    addPdfFooter(doc, "Clientes — Relatório Sintético");
    doc.save(`clientes-sintetico-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.pdf`);
  }

  async function exportAnaliticoPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const lettering = await loadLetteringDataUrl();
    const y = buildPdfHeader(doc, "Clientes — Relatório Analítico", pizzaria?.nome ?? "", [], lettering);

    autoTable(doc, {
      startY: y,
      head: [["Nome", "Telefone", "Pedidos", "Total Gasto", "Cupons", "Primeiro Pedido", "Último Pedido", "Status"]],
      body: filtered.map(c => [
        c.nome, c.telefone, String(c.totalPedidos), fmtMoney(c.totalGasto),
        String(c.cuponsGerados), fmtDate(c.primeiroPedido), fmtDate(c.ultimoPedido),
        c.cadastroCompleto ? "Completo" : "Pendente",
      ]),
      ...TABLE_STYLES,
    });

    addPdfFooter(doc, "Clientes — Relatório Analítico");
    doc.save(`clientes-analitico-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.pdf`);
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filtered.map(c => ({
      "Nome": c.nome,
      "Telefone": c.telefone,
      "Total Pedidos": c.totalPedidos,
      "Total Gasto (R$)": c.totalGasto,
      "Cupons": c.cuponsGerados,
      "Primeiro Pedido": fmtDate(c.primeiroPedido),
      "Último Pedido": fmtDate(c.ultimoPedido),
      "Status": c.cadastroCompleto ? "Completo" : "Pendente",
    })));
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, `clientes-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.xlsx`);
  }

  function exportCSV() {
    const header = "Nome,Telefone,Total Pedidos,Total Gasto,Cupons,Primeiro Pedido,Último Pedido,Status";
    const rows = filtered.map(c =>
      [`"${c.nome}"`, `"${c.telefone}"`, c.totalPedidos, c.totalGasto, c.cuponsGerados,
        fmtDate(c.primeiroPedido), fmtDate(c.ultimoPedido),
        c.cadastroCompleto ? "Completo" : "Pendente"].join(",")
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">Clientes</h1>
        <p className="text-muted-foreground text-sm mt-1">Consumidores que fizeram pedidos na sua pizzaria.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border bg-card">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary/60" />
            <div><p className="text-xs text-muted-foreground">Total de clientes</p><p className="text-2xl font-bold font-heading">{totalClientes}</p></div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <UserCheck className="h-8 w-8 text-emerald-500/60" />
            <div><p className="text-xs text-muted-foreground">Completos</p><p className="text-2xl font-bold font-heading">{completos}</p></div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <UserX className="h-8 w-8 text-amber-500/60" />
            <div><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-2xl font-bold font-heading">{pendentes}</p></div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <UserPlus className="h-8 w-8 text-blue-500/60" />
            <div><p className="text-xs text-muted-foreground">Novos este mês</p><p className="text-2xl font-bold font-heading">{novosMes}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou telefone..." className="pl-9" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="completo">Completos</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ultimoPedido">Último pedido</SelectItem>
            <SelectItem value="totalGasto">Maior gasto</SelectItem>
            <SelectItem value="totalPedidos">Mais pedidos</SelectItem>
            <SelectItem value="cupons">Mais cupons</SelectItem>
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wide">Relatórios PDF</DropdownMenuLabel>
            <DropdownMenuItem onClick={exportSinteticoPDF} className="gap-2 text-xs">
              <BarChart2 className="h-3.5 w-3.5" /> Relatório Sintético
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportAnaliticoPDF} className="gap-2 text-xs">
              <List className="h-3.5 w-3.5" /> Relatório Analítico
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wide">Dados</DropdownMenuLabel>
            <DropdownMenuItem onClick={exportExcel} className="gap-2 text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportCSV} className="gap-2 text-xs">
              <FileText className="h-3.5 w-3.5" /> CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 pb-3">
          <CardTitle className="text-sm text-muted-foreground">{filtered.length} cliente{filtered.length !== 1 ? "s" : ""}</CardTitle>
          <TablePagination
            total={filtered.length}
            pageSize={pageSize}
            currentPage={page}
            onPageSizeChange={setPageSize}
            onPageChange={setPage}
          />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-center">Pedidos</TableHead>
                <TableHead className="text-right">Total gasto</TableHead>
                <TableHead className="text-center">Cupons</TableHead>
                <TableHead>Primeiro pedido</TableHead>
                <TableHead>Último pedido</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(c => (
                <TableRow key={c.consumidorId}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{c.telefone}</TableCell>
                  <TableCell className="text-center">{c.totalPedidos}</TableCell>
                  <TableCell className="text-right">{fmtMoney(c.totalGasto)}</TableCell>
                  <TableCell className="text-center">{c.cuponsGerados}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(c.primeiroPedido)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(c.ultimoPedido)}</TableCell>
                  <TableCell>
                    <Badge variant={c.cadastroCompleto ? "default" : "secondary"}>
                      {c.cadastroCompleto ? "Completo" : "Pendente"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {paged.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum cliente encontrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
