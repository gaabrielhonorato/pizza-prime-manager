import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText } from "lucide-react";
import { generateCycleReport } from "@/lib/cycleReport";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campanhaId: string;
  campanhaNome: string;
  dataInicio: string;
  dataEncerramento: string;
}

export default function CycleReportDialog({ open, onOpenChange, campanhaId, campanhaNome, dataInicio, dataEncerramento }: Props) {
  const [loading, setLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState<"pdf" | "docx">("pdf");
  const [investorName, setInvestorName] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await generateCycleReport({
        campanhaId, campanhaNome, dataInicio, dataEncerramento,
        confidential: investorName || undefined, format: exportFormat,
      });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Relatório do Ciclo</DialogTitle>
          <DialogDescription>{campanhaNome}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Nome do destinatário (opcional)</Label>
            <Input placeholder="Ex: João Silva — Investidor" value={investorName} onChange={e => setInvestorName(e.target.value)} />
            <p className="text-xs text-muted-foreground">Aparecerá como "Confidencial — gerado para [nome]" na capa</p>
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
