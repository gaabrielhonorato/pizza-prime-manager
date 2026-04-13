import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText } from "lucide-react";
import { generatePizzariaReport } from "@/lib/pizzariaReport";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pizzariaId: string;
  pizzariaNome: string;
  responsavel: string;
  pizzariaLogoUrl?: string | null;
}

export default function PizzariaReportDialog({ open, onOpenChange, pizzariaId, pizzariaNome, responsavel, pizzariaLogoUrl }: Props) {
  const [loading, setLoading] = useState(false);
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(today, "yyyy-MM-dd"));
  const [exportFormat, setExportFormat] = useState<"pdf" | "docx">("pdf");

  const shortcuts = [
    { label: "Este mês", from: format(startOfMonth(today), "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") },
    { label: "Mês passado", from: format(startOfMonth(subMonths(today, 1)), "yyyy-MM-dd"), to: format(endOfMonth(subMonths(today, 1)), "yyyy-MM-dd") },
    { label: "Últimos 90 dias", from: format(subMonths(today, 3), "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") },
  ];

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await generatePizzariaReport({
        pizzariaId, pizzariaNome, responsavel,
        pizzariaLogoUrl, dateFrom, dateTo, format: exportFormat,
      });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar Relatório Financeiro</DialogTitle>
          <DialogDescription>{pizzariaNome}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            {shortcuts.map(s => (
              <Button key={s.label} variant="outline" size="sm" className="text-xs"
                onClick={() => { setDateFrom(s.from); setDateTo(s.to); }}>
                {s.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Data início</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Data fim</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Formato</Label>
            <Select value={exportFormat} onValueChange={v => setExportFormat(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="docx">Word (.docx)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Gerando...</> : <><FileText className="h-4 w-4 mr-1" />Gerar Relatório</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
