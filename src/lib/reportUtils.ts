import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Document, Packer, Paragraph, TextRun, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType, PageBreak, Header, Footer, PageNumber } from "docx";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PP_ORANGE = "#F97316";
const PP_DARK = "#1F2937";
const PP_ORANGE_RGB: [number, number, number] = [249, 115, 22];
const PP_DARK_RGB: [number, number, number] = [31, 41, 55];
const WHITE_RGB: [number, number, number] = [255, 255, 255];
const LIGHT_GRAY_RGB: [number, number, number] = [249, 250, 251];

export function formatCurrency(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(d: string | Date) {
  return format(new Date(d), "dd/MM/yyyy", { locale: ptBR });
}

export function formatDateTime(d: string | Date) {
  return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

// =================== PDF ===================

export interface PDFReportConfig {
  title: string;
  subtitle?: string;
  period?: string;
  logoUrl?: string | null;
  pizzariaLogoUrl?: string | null;
  pizzariaName?: string;
  responsavel?: string;
  confidential?: string;
}

async function loadImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

export async function createPDFReport(config: PDFReportConfig): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Cover page
  doc.setFillColor(...PP_DARK_RGB);
  doc.rect(0, 0, w, h, "F");

  // Orange accent bar
  doc.setFillColor(...PP_ORANGE_RGB);
  doc.rect(0, 0, w, 8, "F");
  doc.rect(0, h - 8, w, 8, "F");

  // Logos
  let logoY = 60;
  if (config.logoUrl) {
    const img = await loadImage(config.logoUrl);
    if (img) { doc.addImage(img, "PNG", w / 2 - 35, 30, 30, 30); logoY = 70; }
  }
  if (config.pizzariaLogoUrl) {
    const img = await loadImage(config.pizzariaLogoUrl);
    if (img) { doc.addImage(img, "PNG", w / 2 + 5, 30, 30, 30); logoY = 70; }
  }

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text(config.title, w / 2, logoY + 30, { align: "center" });

  if (config.subtitle) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text(config.subtitle, w / 2, logoY + 42, { align: "center" });
  }

  if (config.pizzariaName) {
    doc.setFontSize(16);
    doc.setTextColor(...PP_ORANGE_RGB);
    doc.text(config.pizzariaName, w / 2, logoY + 56, { align: "center" });
  }

  if (config.period) {
    doc.setFontSize(11);
    doc.setTextColor(200, 200, 200);
    doc.text(`Período: ${config.period}`, w / 2, logoY + 70, { align: "center" });
  }

  if (config.responsavel) {
    doc.setFontSize(10);
    doc.text(`Responsável: ${config.responsavel}`, w / 2, logoY + 80, { align: "center" });
  }

  if (config.confidential) {
    doc.setFontSize(10);
    doc.setTextColor(...PP_ORANGE_RGB);
    doc.text(`Confidencial — ${config.confidential}`, w / 2, logoY + 94, { align: "center" });
  }

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Gerado em ${formatDateTime(new Date())}`, w / 2, h - 15, { align: "center" });
  doc.text(`Pizza Premiada © ${new Date().getFullYear()}`, w / 2, h - 20, { align: "center" });

  return doc;
}

export function addPDFSection(doc: jsPDF, title: string) {
  doc.addPage();
  const w = doc.internal.pageSize.getWidth();
  // Section header
  doc.setFillColor(...PP_ORANGE_RGB);
  doc.rect(15, 12, w - 30, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title, 20, 19);

  // Reset
  doc.setTextColor(...PP_DARK_RGB);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  return 30;
}

export function addPDFCards(doc: jsPDF, cards: { label: string; value: string }[], startY: number) {
  const w = doc.internal.pageSize.getWidth();
  const margin = 15;
  const cardW = (w - 2 * margin - (cards.length - 1) * 4) / cards.length;
  cards.forEach((card, i) => {
    const x = margin + i * (cardW + 4);
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(x, startY, cardW, 22, 2, 2, "F");
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(x, startY, cardW, 22, 2, 2, "S");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(card.label, x + cardW / 2, startY + 8, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PP_DARK_RGB);
    doc.text(card.value, x + cardW / 2, startY + 18, { align: "center" });
    doc.setFont("helvetica", "normal");
  });
  return startY + 28;
}

export function addPDFText(doc: jsPDF, text: string, y: number, opts?: { size?: number; bold?: boolean; color?: [number, number, number]; maxWidth?: number }) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFontSize(opts?.size || 10);
  doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
  doc.setTextColor(...(opts?.color || PP_DARK_RGB));
  const lines = doc.splitTextToSize(text, opts?.maxWidth || w - 30);
  doc.text(lines, 15, y);
  return y + lines.length * (opts?.size || 10) * 0.4 + 4;
}

export function addPDFTable(doc: jsPDF, head: string[][], body: string[][], startY: number, opts?: { footRow?: string[] }) {
  const allBody = opts?.footRow ? [...body, opts.footRow] : body;
  autoTable(doc, {
    head,
    body: allBody,
    startY,
    margin: { left: 15, right: 15 },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: PP_DARK_RGB },
    headStyles: { fillColor: PP_ORANGE_RGB, textColor: WHITE_RGB, fontStyle: "bold" },
    alternateRowStyles: { fillColor: LIGHT_GRAY_RGB },
    didParseCell: (data: any) => {
      if (opts?.footRow && data.section === "body" && data.row.index === allBody.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [229, 231, 235];
      }
    },
  });
  return (doc as any).lastAutoTable.finalY + 5;
}

export function addPDFFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 2; i <= pages; i++) {
    doc.setPage(i);
    // Watermark
    doc.setFontSize(50);
    doc.setTextColor(245, 245, 245);
    doc.text("Pizza Premiada", w / 2, h / 2, { align: "center", angle: 45 });
    // Page number
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i - 1} de ${pages - 1}`, w / 2, h - 8, { align: "center" });
    doc.text(`Pizza Premiada © ${new Date().getFullYear()}`, w - 15, h - 8, { align: "right" });
  }
}

export function savePDF(doc: jsPDF, name: string) {
  addPDFFooter(doc);
  doc.save(`${name}.pdf`);
}

// =================== DOCX ===================

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

export function docxHeading(text: string, level: typeof HeadingLevel.HEADING_1 = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, color: "F97316", font: "Arial", size: level === HeadingLevel.HEADING_1 ? 32 : 26 })],
  });
}

export function docxText(text: string, opts?: { bold?: boolean; size?: number; color?: string }) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, font: "Arial", size: opts?.size || 22, bold: opts?.bold, color: opts?.color || "1F2937" })],
  });
}

export function docxTable(headers: string[], rows: string[][], footRow?: string[]) {
  const colWidth = Math.floor(9360 / headers.length);
  const allRows = footRow ? [...rows, footRow] : rows;

  const headerRow = new DocxTableRow({
    children: headers.map(h => new DocxTableCell({
      borders: cellBorders,
      width: { size: colWidth, type: WidthType.DXA },
      shading: { fill: "F97316", type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", font: "Arial", size: 18 })] })],
    })),
  });

  const dataRows = allRows.map((row, ri) => new DocxTableRow({
    children: row.map(cell => new DocxTableCell({
      borders: cellBorders,
      width: { size: colWidth, type: WidthType.DXA },
      shading: footRow && ri === allRows.length - 1
        ? { fill: "E5E7EB", type: ShadingType.CLEAR }
        : ri % 2 === 1 ? { fill: "F9FAFB", type: ShadingType.CLEAR } : undefined,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [new Paragraph({ children: [new TextRun({
        text: cell,
        font: "Arial",
        size: 18,
        bold: footRow && ri === allRows.length - 1,
        color: "1F2937",
      })] })],
    })),
  }));

  return new DocxTable({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: headers.map(() => colWidth),
    rows: [headerRow, ...dataRows],
  });
}

export function docxCards(cards: { label: string; value: string }[]) {
  const colWidth = Math.floor(9360 / cards.length);
  return new DocxTable({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: cards.map(() => colWidth),
    rows: [new DocxTableRow({
      children: cards.map(c => new DocxTableCell({
        borders: cellBorders,
        width: { size: colWidth, type: WidthType.DXA },
        shading: { fill: "F9FAFB", type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.label, font: "Arial", size: 16, color: "6B7280" })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60 }, children: [new TextRun({ text: c.value, font: "Arial", size: 28, bold: true, color: "1F2937" })] }),
        ],
      })),
    })],
  });
}

export async function saveDocx(doc: Document, name: string) {
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${name}.docx`);
}

export function createDocxReport(config: PDFReportConfig, sections: Paragraph[]) {
  return new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 32, bold: true, font: "Arial", color: "F97316" },
          paragraph: { spacing: { before: 240, after: 120 } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 26, bold: true, font: "Arial", color: "F97316" },
          paragraph: { spacing: { before: 180, after: 100 } } },
      ],
    },
    sections: [
      {
        properties: {
          page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } },
        },
        headers: {
          default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Pizza Premiada", font: "Arial", size: 16, color: "9CA3AF", italics: true })] })] }),
        },
        footers: {
          default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
            new TextRun({ text: `Pizza Premiada © ${new Date().getFullYear()} — Página `, font: "Arial", size: 16, color: "9CA3AF" }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "9CA3AF" }),
          ] })] }),
        },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: config.title, bold: true, font: "Arial", size: 40, color: "F97316" })] }),
          ...(config.subtitle ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: config.subtitle, font: "Arial", size: 24, color: "1F2937" })] })] : []),
          ...(config.pizzariaName ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: config.pizzariaName, font: "Arial", size: 26, bold: true, color: "1F2937" })] })] : []),
          ...(config.period ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: `Período: ${config.period}`, font: "Arial", size: 20, color: "6B7280" })] })] : []),
          ...(config.confidential ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: `Confidencial — ${config.confidential}`, font: "Arial", size: 20, color: "F97316", italics: true })] })] : []),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: `Gerado em ${formatDateTime(new Date())}`, font: "Arial", size: 18, color: "9CA3AF" })] }),
          new Paragraph({ children: [new PageBreak()] }),
          ...sections,
          new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: `Relatório gerado em ${formatDateTime(new Date())} pelo sistema Pizza Premiada.`, font: "Arial", size: 16, color: "9CA3AF", italics: true })] }),
        ],
      },
    ],
  });
}

export function getTaxaByTipo(tipo: string | null, taxaDel: number, taxaRet: number, taxaLoc: number) {
  if (tipo === "retirada") return taxaRet;
  if (tipo === "local") return taxaLoc;
  return taxaDel;
}
