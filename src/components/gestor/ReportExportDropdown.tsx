import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

interface Props {
  onExportPDF: () => Promise<void>;
  onExportDocx: () => Promise<void>;
  label?: string;
}

export default function ReportExportDropdown({ onExportPDF, onExportDocx, label = "Gerar Relatório" }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const handle = async (type: string, fn: () => Promise<void>) => {
    setLoading(type);
    try { await fn(); } finally { setLoading(null); }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={!!loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handle("pdf", onExportPDF)} className="gap-2 text-xs">
          <FileText className="h-3.5 w-3.5" /> Exportar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handle("docx", onExportDocx)} className="gap-2 text-xs">
          <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar Word (.docx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
