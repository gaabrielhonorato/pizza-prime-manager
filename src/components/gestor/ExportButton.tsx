import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Facebook, File } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import * as XLSX from "xlsx";
import { format } from "date-fns";

export interface ExportColumn {
  key: string;
  label: string;
}

export interface MetaAdsMapping {
  phone?: string;
  email?: string;
  fn?: string;
  ln?: string;
  zip?: string;
  ct?: string;
  st?: string;
  country?: string;
}

interface ExportButtonProps {
  data: Record<string, any>[];
  columns: ExportColumn[];
  fileName: string;
  metaAds?: {
    enabled: boolean;
    mapping: MetaAdsMapping;
    getData?: () => Record<string, any>[];
  };
  chartData?: {
    data: Record<string, any>[];
    columns: ExportColumn[];
    sheetName: string;
  }[];
  filtersApplied?: string[];
  reportTitle?: string;
}

const HEADER_COLOR = "F97316";
const ALT_ROW_COLOR = "F9FAFB";

function autoWidth(data: any[][], header: string[]) {
  return header.map((h, i) => {
    let max = h.length;
    data.forEach(row => {
      const v = row[i] != null ? String(row[i]) : "";
      if (v.length > max) max = v.length;
    });
    return { wch: Math.min(max + 2, 50) };
  });
}

function buildSheet(rows: Record<string, any>[], columns: ExportColumn[]) {
  const header = columns.map(c => c.label);
  const body = rows.map(r => columns.map(c => r[c.key] ?? ""));
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);

  // Styles (SheetJS community doesn't support styles, but we set column widths)
  ws["!cols"] = autoWidth(body, header);
  return ws;
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return "55" + digits;
}

function splitName(nome: string): { fn: string; ln: string } {
  const parts = (nome || "").trim().split(/\s+/);
  return { fn: parts[0] || "", ln: parts.slice(1).join(" ") || "" };
}

export default function ExportButton({ data, columns, fileName, metaAds, chartData, filtersApplied, reportTitle }: ExportButtonProps) {
  const [metaModal, setMetaModal] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const ws = buildSheet(data, columns);
    XLSX.utils.book_append_sheet(wb, ws, "Dados");

    // Chart data sheets
    if (chartData) {
      chartData.forEach(cd => {
        const cws = buildSheet(cd.data, cd.columns);
        XLSX.utils.book_append_sheet(wb, cws, cd.sheetName.substring(0, 31));
      });
    }

    // Metadata sheet
    const meta = [
      ["Data de exportação", format(new Date(), "dd/MM/yyyy HH:mm")],
      ["Total de registros", String(data.length)],
      ...(filtersApplied ? [["Filtros aplicados", filtersApplied.join(", ")]] : []),
    ];
    const metaWs = XLSX.utils.aoa_to_sheet(meta);
    XLSX.utils.book_append_sheet(wb, metaWs, "Metadados");

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(new Blob([buf], { type: "application/octet-stream" }), `${fileName}-${today}.xlsx`);
  };

  const exportCSV = () => {
    const header = columns.map(c => c.label).join(",");
    const rows = data.map(r =>
      columns.map(c => {
        const v = r[c.key] ?? "";
        return typeof v === "string" && v.includes(",") ? `"${v}"` : String(v);
      }).join(",")
    );
    const csv = [header, ...rows].join("\n");
    downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), `${fileName}-${today}.csv`);
  };

  const exportPDF = () => {
    const isLandscape = columns.length > 5;
    const doc = new jsPDF({ orientation: isLandscape ? "landscape" : "portrait", unit: "pt" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const title = reportTitle ?? fileName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const hasFilters = filtersApplied && filtersApplied.length > 0;
    const headerH = hasFilters ? 52 : 38;

    doc.setFillColor(249, 115, 22);
    doc.rect(0, 0, pageW, headerH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(title, 20, 23);
    if (hasFilters) {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(filtersApplied!.join("  ·  "), 20, 38, { maxWidth: pageW - 120 });
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(format(new Date(), "dd/MM/yyyy HH:mm"), pageW - 20, 23, { align: "right" });

    autoTable(doc, {
      head: [columns.map((c) => c.label)],
      body: data.map((r) => columns.map((c) => String(r[c.key] ?? ""))),
      startY: headerH + 10,
      headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      bodyStyles: { fontSize: 7, textColor: [30, 30, 30] },
      styles: { cellPadding: 4, lineColor: [230, 230, 230], lineWidth: 0.3 },
      margin: { left: 20, right: 20, bottom: 24 },
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${totalPages}`, pageW / 2, pageH - 10, { align: "center" });
    }

    doc.save(`${fileName}-${today}.pdf`);
  };

  const exportMetaAds = () => {
    if (!metaAds) return;
    const source = metaAds.getData ? metaAds.getData() : data;
    const m = metaAds.mapping;
    const header = "phone,email,fn,ln,zip,ct,st,country";
    const rows = source.map(r => {
      const { fn, ln } = splitName(r[m.fn || "nome"] || "");
      return [
        formatPhone(r[m.phone || "telefone"]),
        r[m.email || "email"] || "",
        fn, ln,
        (r[m.zip || "cep"] || "").replace(/\D/g, ""),
        r[m.ct || "cidade"] || "",
        r[m.st || "estado"] || "",
        "BR",
      ].join(",");
    });
    const csv = [header, ...rows].join("\n");
    downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), `meta-ads-${fileName}-${today}.csv`);
    setMetaModal(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Exportar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={exportExcel} className="gap-2 text-xs">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportCSV} className="gap-2 text-xs">
            <FileText className="h-3.5 w-3.5" /> CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportPDF} className="gap-2 text-xs">
            <File className="h-3.5 w-3.5" /> PDF
          </DropdownMenuItem>
          {metaAds?.enabled && (
            <DropdownMenuItem onClick={() => setMetaModal(true)} className="gap-2 text-xs">
              <Facebook className="h-3.5 w-3.5" /> Meta Ads
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={metaModal} onOpenChange={setMetaModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar para Meta Ads</DialogTitle>
            <DialogDescription>
              Este arquivo está formatado para upload no Meta Ads → Gerenciador de Anúncios → Públicos → Criar Público Personalizado → Lista de Clientes. Os dados serão hasheados pelo Meta antes do uso.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMetaModal(false)}>Cancelar</Button>
            <Button onClick={exportMetaAds} className="bg-primary">Entendi, exportar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
