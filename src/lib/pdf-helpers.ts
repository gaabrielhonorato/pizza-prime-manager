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
  headStyles: { fillColor: C.white, textColor: C.slate500, fontStyle: "normal" as const, fontSize: 7.5, cellPadding: { top: 4, bottom: 4, left: 5, right: 5 } },
  bodyStyles: { fontSize: 8, textColor: C.slate900, cellPadding: { top: 5, bottom: 5, left: 5, right: 5 } },
  styles: { lineColor: [209, 213, 219] as [number, number, number], lineWidth: 0.25 },
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
  const MAX_LINES = 6;
  const HEADER_H = 120;

  doc.setFillColor(250, 250, 252);
  doc.rect(0, 0, pageW, HEADER_H, "F");

  const col1W = availW * 0.24;
  const col3W = col1W;
  const col2W = availW - 40 - 2 * col1W;

  const col1X = 20;
  if (letteringDataUrl) {
    const imgH = 40; const imgW = imgH * 2.2;
    const imgY = (HEADER_H - imgH) / 2;
    doc.addImage(letteringDataUrl, "PNG", col1X, imgY, imgW, imgH);
  }

  const div1X = col1X + col1W + 8;
  doc.setDrawColor(...C.slate200); doc.setLineWidth(0.6);
  doc.line(div1X, 16, div1X, HEADER_H - 16);

  const col2X = div1X + 12;
  const col2CX = col2X + col2W / 2;

  doc.setTextColor(...C.slate900);
  doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text(title, col2CX, 36, { align: "center", maxWidth: col2W });
  doc.setFontSize(12); doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.slate500);
  doc.text(`${subtitle}  ·  Gerado em ${format(new Date(), "dd/MM/yyyy 'as' HH:mm")}`, col2CX, 56, { align: "center", maxWidth: col2W });

  const div2X = col2X + col2W + 8;
  doc.setDrawColor(...C.slate200); doc.setLineWidth(0.6);
  doc.line(div2X, 16, div2X, HEADER_H - 16);

  const col3RightX = pageW - 20;
  doc.setFontSize(12); doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.slate900);
  doc.text("FILTROS APLICADOS", col3RightX, 22, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setTextColor(...C.slate700);
  if (filterLines.length === 0) {
    doc.setTextColor(...C.slate500); doc.setFontSize(12);
    doc.text("Sem filtros avancados", col3RightX, 38, { align: "right" });
  } else {
    const visible = filterLines.slice(0, MAX_LINES);
    const overflow = filterLines.length - MAX_LINES;
    let lineY = 38;
    visible.forEach(line => {
      doc.setFontSize(12);
      const colonIdx = line.indexOf(":");
      if (colonIdx > -1) {
        const label = line.slice(0, colonIdx + 2);
        const value = line.slice(colonIdx + 2);
        doc.setFont("helvetica", "bold");
        doc.text(value, col3RightX, lineY, { align: "right" });
        doc.setFont("helvetica", "normal");
        doc.text(label, col3RightX - doc.getTextWidth(value), lineY, { align: "right" });
      } else {
        doc.setFont("helvetica", "normal");
        doc.text(line, col3RightX, lineY, { align: "right" });
      }
      lineY += 14;
    });
    if (overflow > 0) {
      doc.setFontSize(10); doc.setTextColor(...C.slate500);
      doc.text(`+ ${overflow} mais`, col3RightX, lineY, { align: "right" });
    }
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
  doc.setFillColor(...C.slate700);
  doc.rect(20, y, 2, 10, "F");
  doc.setTextColor(...C.slate900);
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text(text, 27, y + 8);
  return y + 18;
}
