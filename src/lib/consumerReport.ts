import { supabase } from "@/integrations/supabase/client";
import {
  createPDFReport, addPDFSection, addPDFCards, addPDFText, addPDFTable, savePDF,
  createDocxReport, docxHeading, docxText, docxTable, docxCards, saveDocx,
  formatCurrency, formatDate, formatDateTime, type PDFReportConfig,
} from "@/lib/reportUtils";

interface ConsumerReportParams {
  campanhaId: string;
  campanhaNome: string;
  format: "pdf" | "docx";
}

export async function generateConsumerReport(params: ConsumerReportParams) {
  const { campanhaId } = params;

  const { data: consumidores } = await supabase.from("consumidores")
    .select("id, cadastro_completo, cidade, criado_em, usuario_id, usuarios(nome, telefone, email)")
    .eq("campanha_id", campanhaId);
  
  const all = (consumidores ?? []).filter((c: any) => c.usuarios?.telefone);

  const consIds = all.map(c => c.id);
  const { data: pedidos } = await supabase.from("pedidos").select("consumidor_id, data_pedido, valor_total").eq("campanha_id", campanhaId);
  const ped = pedidos ?? [];

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const consStats = new Map<string, { pedidos: number; total: number; ultimoPedido: string }>();
  ped.forEach(p => {
    if (!p.consumidor_id) return;
    const e = consStats.get(p.consumidor_id) || { pedidos: 0, total: 0, ultimoPedido: "" };
    e.pedidos++;
    e.total += Number(p.valor_total);
    if (p.data_pedido > e.ultimoPedido) e.ultimoPedido = p.data_pedido;
    consStats.set(p.consumidor_id, e);
  });

  const enriched = all.map((c: any) => ({
    id: c.id,
    nome: c.usuarios?.nome || c.usuarios?.telefone || "—",
    telefone: c.usuarios?.telefone || "",
    email: c.usuarios?.email || "",
    cidade: c.cidade || "",
    cadastroCompleto: c.cadastro_completo,
    ...(consStats.get(c.id) || { pedidos: 0, total: 0, ultimoPedido: "" }),
  }));

  const ativos = enriched.filter(c => c.ultimoPedido >= thirtyDaysAgo);
  const inativos = enriched.filter(c => c.ultimoPedido && c.ultimoPedido < sixtyDaysAgo);
  const topCompradores = [...enriched].sort((a, b) => b.total - a.total).slice(0, 20);
  const semCadastro = enriched.filter(c => !c.cadastroCompleto);

  const config: PDFReportConfig = {
    title: "Relatório de Consumidores",
    subtitle: params.campanhaNome,
    period: `Gerado em ${formatDate(new Date())}`,
  };

  const segmentTable = (items: typeof enriched) => items.slice(0, 50).map((c, i) => [
    String(i + 1), c.nome, c.telefone, c.email, c.cidade, String(c.pedidos), formatCurrency(c.total),
  ]);
  const segHeaders = ["#", "Nome", "Telefone", "Email", "Cidade", "Pedidos", "Total"];

  if (params.format === "pdf") {
    const doc = await createPDFReport(config);

    let y = addPDFSection(doc, "Visão Geral");
    y = addPDFCards(doc, [
      { label: "Total Consumidores", value: String(enriched.length) },
      { label: "Ativos (30d)", value: String(ativos.length) },
      { label: "Inativos (60d+)", value: String(inativos.length) },
    ], y);
    y = addPDFCards(doc, [
      { label: "Cadastro Completo", value: String(enriched.filter(c => c.cadastroCompleto).length) },
      { label: "Pendentes", value: String(semCadastro.length) },
    ], y);

    y = addPDFSection(doc, `Ativos — Pedido nos últimos 30 dias (${ativos.length})`);
    if (ativos.length > 0) y = addPDFTable(doc, [segHeaders], segmentTable(ativos), y);
    else y = addPDFText(doc, "Nenhum consumidor ativo.", y);

    y = addPDFSection(doc, `Inativos — Sem pedido há 60+ dias (${inativos.length})`);
    if (inativos.length > 0) y = addPDFTable(doc, [segHeaders], segmentTable(inativos), y);
    else y = addPDFText(doc, "Nenhum consumidor inativo.", y);

    y = addPDFSection(doc, `Top Compradores (${topCompradores.length})`);
    y = addPDFTable(doc, [segHeaders], segmentTable(topCompradores), y);

    y = addPDFSection(doc, `Sem Cadastro Completo (${semCadastro.length})`);
    if (semCadastro.length > 0) y = addPDFTable(doc, [segHeaders], segmentTable(semCadastro), y);
    else y = addPDFText(doc, "Todos com cadastro completo.", y);

    savePDF(doc, "relatorio-consumidores");
  } else {
    const segDocx = (items: typeof enriched) => items.length > 0
      ? docxTable(segHeaders, segmentTable(items))
      : docxText("Nenhum registro.");

    const sections = [
      docxHeading("Visão Geral"),
      docxCards([
        { label: "Total", value: String(enriched.length) },
        { label: "Ativos (30d)", value: String(ativos.length) },
        { label: "Inativos (60d+)", value: String(inativos.length) },
      ]),
      docxHeading(`Ativos — Pedido nos últimos 30 dias (${ativos.length})`),
      segDocx(ativos),
      docxHeading(`Inativos — Sem pedido há 60+ dias (${inativos.length})`),
      segDocx(inativos),
      docxHeading(`Top Compradores (${topCompradores.length})`),
      segDocx(topCompradores),
      docxHeading(`Sem Cadastro Completo (${semCadastro.length})`),
      segDocx(semCadastro),
    ];

    const docx = createDocxReport(config, sections as any);
    await saveDocx(docx, "relatorio-consumidores");
  }
}
