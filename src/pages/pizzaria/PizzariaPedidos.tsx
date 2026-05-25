import { useState, useMemo, useEffect } from "react";
import { Search, CalendarIcon, Download, BarChart2, List, FileSpreadsheet, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useMinhaPizzaria } from "@/contexts/MinhaPizzariaContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { C, TABLE_STYLES, loadLetteringDataUrl, buildPdfHeader, addPdfFooter } from "@/lib/pdf-helpers";
import TablePagination from "@/components/gestor/TablePagination";

interface Pedido {
  id: string;
  numero: string;
  data: Date;
  cliente: string;
  valor: number;
  canal: string;
  cupons: number;
  status: string;
}

export default function PizzariaPedidos() {
  const { pizzaria } = useMinhaPizzaria();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterCanal, setFilterCanal] = useState("Todos");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [perPage, setPerPage] = useState(25);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!pizzaria) return;
    const fetchPedidos = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("pedidos")
        .select("id, data_pedido, valor_total, canal, cupons_gerados, status, consumidor_id, consumidores(usuario_id, usuarios:usuario_id(nome))")
        .eq("pizzaria_id", pizzaria.id)
        .order("data_pedido", { ascending: false });

      if (error) {
        console.error("Error fetching pedidos:", error);
        setLoading(false);
        return;
      }

      const mapped: Pedido[] = (data ?? []).map((p: any, i: number) => ({
        id: p.id,
        numero: `#${(4000 + i).toString()}`,
        data: new Date(p.data_pedido),
        cliente: p.consumidores?.usuarios?.nome ?? "Cliente avulso",
        valor: Number(p.valor_total),
        canal: p.canal,
        cupons: p.cupons_gerados,
        status: p.status === "cancelado" ? "Cancelado" : "Concluído",
      }));

      setPedidos(mapped);
      setLoading(false);
    };
    fetchPedidos();
  }, [pizzaria]);

  const canais = useMemo(() => [...new Set(pedidos.map(p => p.canal))], [pedidos]);

  const filtered = useMemo(() => {
    let list = [...pedidos];
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
  }, [pedidos, search, filterStatus, filterCanal, dateFrom, dateTo]);

  const paged = perPage === 0 ? filtered : filtered.slice((page - 1) * perPage, page * perPage);
  const totalValor = filtered.reduce((s, p) => s + p.valor, 0);
  const media = filtered.length > 0 ? Math.round(totalValor / filtered.length) : 0;

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

  async function exportSinteticoPDF() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const lettering = await loadLetteringDataUrl();
    const filterLines: string[] = [];
    if (dateFrom) filterLines.push(`De: ${format(dateFrom, "dd/MM/yyyy")}`);
    if (dateTo) filterLines.push(`Até: ${format(dateTo, "dd/MM/yyyy")}`);
    if (filterStatus !== "Todos") filterLines.push(`Status: ${filterStatus}`);
    if (filterCanal !== "Todos") filterLines.push(`Canal: ${filterCanal}`);

    let y = buildPdfHeader(doc, "Pedidos — Relatório Sintético", pizzaria?.nome ?? "", filterLines, lettering);

    const kpisData = [
      { label: "Total de pedidos", value: String(filtered.length) },
      { label: "Valor total", value: `R$ ${totalValor.toLocaleString("pt-BR")}` },
      { label: "Ticket médio", value: `R$ ${media.toLocaleString("pt-BR")}` },
    ];
    const boxW = 56; const boxH = 22; const gap = 6; const startX = 20;
    kpisData.forEach((k, i) => {
      const bx = startX + i * (boxW + gap);
      doc.setFillColor(...C.slate50); doc.setDrawColor(...C.slate200); doc.setLineWidth(0.4);
      doc.rect(bx, y, boxW, boxH, "FD");
      doc.setFontSize(6); doc.setTextColor(...C.slate500); doc.setFont("helvetica", "normal");
      doc.text(k.label, bx + 3, y + 7, { maxWidth: boxW - 6 });
      doc.setFontSize(9); doc.setTextColor(...C.slate900); doc.setFont("helvetica", "bold");
      doc.text(k.value, bx + 3, y + 17, { maxWidth: boxW - 6 });
    });
    y += boxH + 10;

    const byCanal: Record<string, { count: number; total: number }> = {};
    filtered.forEach(p => {
      if (!byCanal[p.canal]) byCanal[p.canal] = { count: 0, total: 0 };
      byCanal[p.canal].count++;
      byCanal[p.canal].total += p.valor;
    });

    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.slate900);
    doc.text("Pedidos por Canal", 20, y); y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Canal", "Qtd", "Total (R$)"]],
      body: Object.entries(byCanal).map(([c, v]) => [c, String(v.count), `R$ ${v.total.toLocaleString("pt-BR")}`]),
      ...TABLE_STYLES,
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    const byStatus: Record<string, number> = {};
    filtered.forEach(p => { byStatus[p.status] = (byStatus[p.status] ?? 0) + 1; });
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.slate900);
    doc.text("Pedidos por Status", 20, y); y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Status", "Qtd", "%"]],
      body: Object.entries(byStatus).map(([s, n]) => [s, String(n), `${((n / filtered.length) * 100).toFixed(1)}%`]),
      ...TABLE_STYLES,
    });

    addPdfFooter(doc, "Pedidos — Relatório Sintético");
    doc.save(`pedidos-sintetico-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.pdf`);
  }

  async function exportAnaliticoPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const lettering = await loadLetteringDataUrl();
    const filterLines: string[] = [];
    if (dateFrom) filterLines.push(`De: ${format(dateFrom, "dd/MM/yyyy")}`);
    if (dateTo) filterLines.push(`Até: ${format(dateTo, "dd/MM/yyyy")}`);
    if (filterStatus !== "Todos") filterLines.push(`Status: ${filterStatus}`);
    if (filterCanal !== "Todos") filterLines.push(`Canal: ${filterCanal}`);
    const y = buildPdfHeader(doc, "Pedidos — Relatório Analítico", pizzaria?.nome ?? "", filterLines, lettering);

    autoTable(doc, {
      startY: y,
      head: [["Nº", "Data/Hora", "Cliente", "Valor (R$)", "Canal", "Cupons", "Status"]],
      body: filtered.map(p => [
        p.numero,
        format(p.data, "dd/MM/yy HH:mm"),
        p.cliente,
        `R$ ${p.valor.toLocaleString("pt-BR")}`,
        p.canal,
        String(p.cupons),
        p.status,
      ]),
      ...TABLE_STYLES,
    });

    addPdfFooter(doc, "Pedidos — Relatório Analítico");
    doc.save(`pedidos-analitico-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.pdf`);
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filtered.map(p => ({
      "Número": p.numero,
      "Data": format(p.data, "dd/MM/yyyy HH:mm"),
      "Cliente": p.cliente,
      "Valor (R$)": p.valor,
      "Canal": p.canal,
      "Cupons": p.cupons,
      "Status": p.status,
    })));
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
    XLSX.writeFile(wb, `pedidos-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.xlsx`);
  }

  function doExportCSV() {
    const header = "Número,Data,Cliente,Valor,Canal,Cupons,Status";
    const rows = filtered.map(p =>
      [p.numero, format(p.data, "dd/MM/yyyy HH:mm"), `"${p.cliente}"`, `R$ ${p.valor}`, p.canal, p.cupons, p.status].join(",")
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">Pedidos</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie os pedidos da sua pizzaria.</p>
      </div>

      <Card className="border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nº ou cliente..." className="pl-8 h-8 text-xs" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
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
              {canais.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
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
              <DropdownMenuItem onClick={doExportCSV} className="gap-2 text-xs">
                <FileText className="h-3.5 w-3.5" /> CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando pedidos...</div>
          ) : pedidos.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">Nenhum pedido registrado ainda.</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Cliente</TableHead>
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
                      <TableCell className="text-right text-xs">R$ {p.valor.toLocaleString("pt-BR")}</TableCell>
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

              <div className="border-t border-border px-4 py-3 flex flex-wrap gap-6 text-sm">
                <span><span className="text-muted-foreground">Pedidos:</span> <strong>{filtered.length}</strong></span>
                <span><span className="text-muted-foreground">Total:</span> <strong>R$ {totalValor.toLocaleString("pt-BR")}</strong></span>
                <span><span className="text-muted-foreground">Média:</span> <strong>R$ {media}</strong></span>
              </div>

              <div className="border-t border-border px-4 py-3 flex items-center justify-end">
                <TablePagination
                  total={filtered.length}
                  pageSize={perPage}
                  currentPage={page}
                  onPageSizeChange={setPerPage}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
