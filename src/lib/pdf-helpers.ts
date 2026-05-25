import jsPDF from "jspdf";
import { format } from "date-fns";

export const C = {
  slate900: [15,  23,  42]  as [number, number, number],
  slate700: [51,  65,  85]  as [number, number, number],
  slate500: [100, 116, 139] as [number, number, number],
  slate200: [226, 232, 240] as [number, number, number],
  slate50:  [248, 250, 252] as [number, number, number],
  white:    [255, 255, 255] as [number, number, number],
  orange:   [249, 115,  22] as [number, number, number],
};

export const TABLE_STYLES = {
  headStyles: { fillColor: C.slate900, textColor: C.white, fontStyle: "bold" as const, fontSize: 8, cellPadding: 6 },
  alternateRowStyles: { fillColor: C.slate50 },
  bodyStyles: { fontSize: 8, textColor: C.slate700, cellPadding: 5 },
  styles: { lineColor: C.slate200, lineWidth: 0.4 },
  margin: { left: 20, right: 20, bottom: 28 },
};

export async function loadLetteringDataUrl(): Promise<string | undefined> {
  try {
    const res = await fetch("/lettering-pizza-premiada.png");
    const blob = await res.blob();
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch { return undefined; }
}

export function buildPdfHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  filterLines: string[],
  letteringDataUrl?: string,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const availW = pageW - 40;
  const HEADER_H = 80;

  doc.setFillColor(250, 250, 252);
  doc.rect(0, 0, pageW, HEADER_H, "F");

  const col1W = availW * 0.25;
  const col1X = 20;
  if (letteringDataUrl) {
    const imgH = 44; const imgW = imgH * 2.2;
    const imgX = col1X + (col1W - imgW) / 2;
    const imgY = (HEADER_H - imgH) / 2;
    doc.addImage(letteringDataUrl, "PNG", imgX, imgY, imgW, imgH);
  }

  const div1X = col1X + col1W + 8;
  doc.setDrawColor(...C.slate200); doc.setLineWidth(0.6);
  doc.line(div1X, 12, div1X, HEADER_H - 12);

  const col2X = div1X + 12;
  const col2W = availW * 0.38;
  doc.setFillColor(...C.orange);
  doc.rect(col2X, 0, col2W, 3, "F");
  doc.setTextColor(...C.slate900);
  doc.setFontSize(14); doc.setFont("helvetica", "bold");
  doc.text(title, col2X, 24, { maxWidth: col2W });
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.slate500);
  doc.text(subtitle, col2X, 38);
  doc.setFontSize(7);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, col2X, 52);

  const div2X = col2X + col2W + 8;
  doc.line(div2X, 12, div2X, HEADER_H - 12);

  const col3X = div2X + 12;
  doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.slate500);
  doc.text("FILTROS APLICADOS", col3X, 20);
  doc.setFont("helvetica", "normal"); doc.setTextColor(...C.slate700);
  const col3W = pageW - col3X - 16;
  if (filterLines.length === 0) {
    doc.setTextColor(...C.slate500); doc.text("Sem filtros avançados", col3X, 32);
  } else {
    let lineY = 31;
    filterLines.forEach(line => {
      doc.setFontSize(7);
      doc.text(`• ${line}`, col3X, lineY, { maxWidth: col3W });
      lineY += 9;
    });
  }

  doc.setDrawColor(...C.slate200); doc.setLineWidth(0.5);
  doc.line(20, HEADER_H + 2, pageW - 20, HEADER_H + 2);
  return HEADER_H + 14;
}

export function addPdfFooter(doc: jsPDF, reportTitle: string) {
  const total = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.slate200); doc.setLineWidth(0.5);
    doc.line(20, pageH - 20, pageW - 20, pageH - 20);
    doc.setFontSize(7); doc.setTextColor(...C.slate500);
    doc.text(reportTitle, 20, pageH - 9);
    doc.text(`Página ${i} de ${total}`, pageW / 2, pageH - 9, { align: "center" });
    doc.text(format(new Date(), "dd/MM/yyyy"), pageW - 20, pageH - 9, { align: "right" });
  }
}

export function drawSectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFillColor(...C.orange);
  doc.rect(20, y, 2, 10, "F");
  doc.setTextColor(...C.slate900);
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text(text, 27, y + 8);
  return y + 18;
}
