import { supabase } from "@/integrations/supabase/client";
import {
  createPDFReport, addPDFSection, addPDFCards, addPDFText, addPDFTable, savePDF,
  createDocxReport, docxHeading, docxText, docxTable, docxCards, saveDocx,
  formatCurrency, formatDate, formatDateTime, getTaxaByTipo, type PDFReportConfig,
} from "@/lib/reportUtils";
import { HeadingLevel } from "docx";

interface ReportParams {
  pizzariaId: string;
  pizzariaNome: string;
  responsavel: string;
  pizzariaLogoUrl?: string | null;
  dateFrom: string;
  dateTo: string;
  format: "pdf" | "docx";
}

async function fetchReportData(params: ReportParams) {
  const { pizzariaId, dateFrom, dateTo } = params;

  // Campanha principal
  const { data: camp } = await supabase.from("campanhas").select("*").eq("is_principal", true).limit(1).single();
  const taxaDel = camp?.taxa_delivery ?? 15;
  const taxaRet = camp?.taxa_retirada ?? 15;
  const taxaLoc = camp?.taxa_local ?? 12;
  const campId = camp?.id;

  // Pedidos
  let q = supabase.from("pedidos").select("*").eq("pizzaria_id", pizzariaId)
    .gte("data_pedido", `${dateFrom}T00:00:00`).lte("data_pedido", `${dateTo}T23:59:59`);
  if (campId) q = q.eq("campanha_id", campId);
  const { data: pedidos } = await q;
  const ped = pedidos ?? [];

  // Cupons
  const pedidoIds = ped.map(p => p.id);
  let totalCupons = 0;
  if (pedidoIds.length > 0) {
    const { data: cuponsData } = await supabase.from("cupons").select("quantidade").in("pedido_id", pedidoIds);
    totalCupons = cuponsData?.reduce((s, c) => s + c.quantidade, 0) ?? 0;
  }

  // Consumidores únicos
  const consIds = [...new Set(ped.filter(p => p.consumidor_id).map(p => p.consumidor_id!))];
  let consCompletos = 0, consPendentes = 0;
  const topConsumers: { nome: string; pedidos: number; total: number; cupons: number; ultimoPedido: string }[] = [];
  if (consIds.length > 0) {
    const { data: consData } = await supabase.from("consumidores")
      .select("id, cadastro_completo, usuario_id, usuarios(nome, telefone)").in("id", consIds);
    consData?.forEach((c: any) => {
      if (c.cadastro_completo) consCompletos++;
      else consPendentes++;
    });

    // Top consumers
    const consMap = new Map<string, { nome: string; pedidos: number; total: number; ultimoPedido: string }>();
    ped.forEach(p => {
      if (!p.consumidor_id) return;
      const e = consMap.get(p.consumidor_id) || { nome: "", pedidos: 0, total: 0, ultimoPedido: "" };
      e.pedidos++;
      e.total += Number(p.valor_total);
      if (p.data_pedido > e.ultimoPedido) e.ultimoPedido = p.data_pedido;
      consMap.set(p.consumidor_id, e);
    });
    consData?.forEach((c: any) => {
      const e = consMap.get(c.id);
      if (e) e.nome = c.usuarios?.nome || c.usuarios?.telefone || "—";
    });

    // Get cupons per consumer
    if (pedidoIds.length > 0) {
      const { data: cuponsDetail } = await supabase.from("cupons")
        .select("consumidor_id, quantidade").in("pedido_id", pedidoIds);
      const cuponsPerCons = new Map<string, number>();
      cuponsDetail?.forEach(c => cuponsPerCons.set(c.consumidor_id, (cuponsPerCons.get(c.consumidor_id) ?? 0) + c.quantidade));
      
      [...consMap.entries()].forEach(([id, e]) => {
        topConsumers.push({ ...e, cupons: cuponsPerCons.get(id) ?? 0 });
      });
      topConsumers.sort((a, b) => b.total - a.total);
    }
  }

  // Cobranças/repasses
  const { data: cobrancas } = await supabase.from("cobrancas_repasse")
    .select("*").eq("pizzaria_id", pizzariaId).order("periodo_inicio");

  // Group by type
  const byType = { delivery: { qtd: 0, total: 0 }, retirada: { qtd: 0, total: 0 }, local: { qtd: 0, total: 0 } };
  const byPayment = new Map<string, { qtd: number; total: number; canal: string }>();
  const byDay = new Map<string, { pedidos: number; delivery: number; retirada: number; local: number; total: number }>();
  
  ped.forEach(p => {
    const tipo = p.tipo_pedido || "delivery";
    const key = tipo === "retirada" ? "retirada" : tipo === "local" ? "local" : "delivery";
    byType[key].qtd++;
    byType[key].total += Number(p.valor_total);

    const pagamento = p.forma_pagamento || "Não informado";
    const canal = p.canal === "cardapioweb" ? "Automático" : "Manual";
    const pEntry = byPayment.get(pagamento) || { qtd: 0, total: 0, canal };
    pEntry.qtd++;
    pEntry.total += Number(p.valor_total);
    byPayment.set(pagamento, pEntry);

    const day = p.data_pedido.slice(0, 10);
    const dEntry = byDay.get(day) || { pedidos: 0, delivery: 0, retirada: 0, local: 0, total: 0 };
    dEntry.pedidos++;
    dEntry.total += Number(p.valor_total);
    if (key === "delivery") dEntry.delivery += Number(p.valor_total);
    else if (key === "retirada") dEntry.retirada += Number(p.valor_total);
    else dEntry.local += Number(p.valor_total);
    byDay.set(day, dEntry);
  });

  const totalVendas = ped.reduce((s, p) => s + Number(p.valor_total), 0);
  const ppDel = byType.delivery.total * taxaDel / 100;
  const ppRet = byType.retirada.total * taxaRet / 100;
  const ppLoc = byType.local.total * taxaLoc / 100;
  const totalPP = ppDel + ppRet + ppLoc;
  const repasse = totalVendas - totalPP;
  const ticketMedio = ped.length > 0 ? totalVendas / ped.length : 0;
  const taxaMedia = totalVendas > 0 ? (totalPP / totalVendas) * 100 : 0;

  const autoTotal = ped.filter(p => p.canal === "cardapioweb").reduce((s, p) => s + Number(p.valor_total), 0);
  const manualTotal = totalVendas - autoTotal;

  return {
    taxaDel, taxaRet, taxaLoc, campId, ped, totalCupons,
    consIds, consCompletos, consPendentes, topConsumers,
    cobrancas: cobrancas ?? [], byType, byPayment, byDay,
    totalVendas, ppDel, ppRet, ppLoc, totalPP, repasse,
    ticketMedio, taxaMedia, autoTotal, manualTotal,
  };
}

export async function generatePizzariaReport(params: ReportParams) {
  const d = await fetchReportData(params);
  const config: PDFReportConfig = {
    title: "Relatório Financeiro",
    pizzariaName: params.pizzariaNome,
    period: `${formatDate(params.dateFrom)} a ${formatDate(params.dateTo)}`,
    responsavel: params.responsavel,
    pizzariaLogoUrl: params.pizzariaLogoUrl,
  };

  if (params.format === "pdf") {
    const doc = await createPDFReport(config);
    
    // Section 1 - Resumo
    let y = addPDFSection(doc, "1. Resumo Executivo");
    y = addPDFCards(doc, [
      { label: "Total de Vendas", value: formatCurrency(d.totalVendas) },
      { label: "Total de Pedidos", value: String(d.ped.length) },
      { label: "Ticket Médio", value: formatCurrency(d.ticketMedio) },
      { label: "Repasse Recebido", value: formatCurrency(d.repasse) },
    ], y);
    y = addPDFText(doc, `No período de ${formatDate(params.dateFrom)} a ${formatDate(params.dateTo)}, a ${params.pizzariaNome} registrou ${d.ped.length} pedidos totalizando ${formatCurrency(d.totalVendas)} em vendas. A Pizza Premiada reteve ${formatCurrency(d.totalPP)} (${d.taxaMedia.toFixed(1)}%) e o repasse líquido foi de ${formatCurrency(d.repasse)}.`, y + 4);

    // Section 2 - Vendas por tipo
    y = addPDFSection(doc, "2. Vendas por Tipo de Pedido");
    const tipoRows = [
      ["Delivery", String(d.byType.delivery.qtd), formatCurrency(d.byType.delivery.total), `${d.taxaDel}%`, formatCurrency(d.ppDel), formatCurrency(d.byType.delivery.total - d.ppDel), d.totalVendas > 0 ? `${(d.byType.delivery.total / d.totalVendas * 100).toFixed(1)}%` : "0%"],
      ["Retirada", String(d.byType.retirada.qtd), formatCurrency(d.byType.retirada.total), `${d.taxaRet}%`, formatCurrency(d.ppRet), formatCurrency(d.byType.retirada.total - d.ppRet), d.totalVendas > 0 ? `${(d.byType.retirada.total / d.totalVendas * 100).toFixed(1)}%` : "0%"],
      ["Consumo local", String(d.byType.local.qtd), formatCurrency(d.byType.local.total), `${d.taxaLoc}%`, formatCurrency(d.ppLoc), formatCurrency(d.byType.local.total - d.ppLoc), d.totalVendas > 0 ? `${(d.byType.local.total / d.totalVendas * 100).toFixed(1)}%` : "0%"],
    ];
    y = addPDFTable(doc, [["Tipo", "Qtd", "Total vendido", "Taxa PP", "Valor PP", "Repasse", "% total"]], tipoRows, y,
      { footRow: ["Total", String(d.ped.length), formatCurrency(d.totalVendas), `${d.taxaMedia.toFixed(1)}%`, formatCurrency(d.totalPP), formatCurrency(d.repasse), "100%"] });

    // Section 3 - Pagamento
    y = addPDFSection(doc, "3. Vendas por Forma de Pagamento");
    const pagRows = [...d.byPayment.entries()].map(([forma, v]) => [
      forma, String(v.qtd), formatCurrency(v.total),
      d.totalVendas > 0 ? `${(v.total / d.totalVendas * 100).toFixed(1)}%` : "0%",
      v.canal,
    ]);
    y = addPDFTable(doc, [["Forma", "Qtd", "Total", "% total", "Canal"]], pagRows, y);
    y = addPDFCards(doc, [
      { label: "Total Automático (CardápioWeb)", value: formatCurrency(d.autoTotal) },
      { label: "Total Manual", value: formatCurrency(d.manualTotal) },
    ], y);

    // Section 4 - Diário
    y = addPDFSection(doc, "4. Histórico Diário de Vendas");
    const avgDay = d.byDay.size > 0 ? d.totalVendas / d.byDay.size : 0;
    const dayRows = [...d.byDay.entries()].sort().map(([day, v]) => {
      const pp = (v.delivery * d.taxaDel / 100) + (v.retirada * d.taxaRet / 100) + (v.local * d.taxaLoc / 100);
      return [formatDate(day), String(v.pedidos), formatCurrency(v.delivery), formatCurrency(v.retirada), formatCurrency(v.local), formatCurrency(v.total), formatCurrency(pp), formatCurrency(v.total - pp)];
    });
    y = addPDFTable(doc, [["Data", "Pedidos", "Delivery", "Retirada", "Salão", "Total", "PP (R$)", "Repasse (R$)"]], dayRows, y);

    // Section 5 - Cobranças
    y = addPDFSection(doc, "5. Histórico de Repasses");
    const cobRows = d.cobrancas.map(c => [
      `${formatDate(c.periodo_inicio)} — ${formatDate(c.periodo_fim)}`,
      formatCurrency(Number(c.valor_total_devido)),
      c.data_envio ? formatDate(c.data_envio) : "—",
      c.data_pagamento ? formatDate(c.data_pagamento) : "—",
      c.status.charAt(0).toUpperCase() + c.status.slice(1),
    ]);
    if (cobRows.length > 0) {
      y = addPDFTable(doc, [["Período", "Valor devido", "Data envio", "Data pgto", "Status"]], cobRows, y);
    } else {
      y = addPDFText(doc, "Nenhuma cobrança registrada para esta pizzaria.", y);
    }

    // Section 6 - Cupons e Consumidores
    y = addPDFSection(doc, "6. Cupons e Consumidores");
    y = addPDFCards(doc, [
      { label: "Cupons Gerados", value: String(d.totalCupons) },
      { label: "Consumidores Únicos", value: String(d.consIds.length) },
      { label: "Cadastro Completo", value: String(d.consCompletos) },
      { label: "Pendentes", value: String(d.consPendentes) },
    ], y);

    if (d.topConsumers.length > 0) {
      y = addPDFText(doc, "Top 10 consumidores:", y + 2, { bold: true });
      const topRows = d.topConsumers.slice(0, 10).map((c, i) => [
        `${i + 1}º`, c.nome, String(c.pedidos), formatCurrency(c.total), String(c.cupons), c.ultimoPedido ? formatDate(c.ultimoPedido) : "—",
      ]);
      y = addPDFTable(doc, [["#", "Nome/Tel", "Pedidos", "Total gasto", "Cupons", "Último pedido"]], topRows, y);
    }

    // Footer text
    addPDFText(doc, `Relatório gerado em ${formatDateTime(new Date())} pelo sistema Pizza Premiada. Dados referentes ao período ${formatDate(params.dateFrom)} a ${formatDate(params.dateTo)}.`, y + 5, { size: 8, color: [150, 150, 150] });

    savePDF(doc, `relatorio-${params.pizzariaNome.replace(/\s+/g, "-").toLowerCase()}`);
  } else {
    // DOCX
    const sections = [
      docxHeading("1. Resumo Executivo"),
      docxCards([
        { label: "Total de Vendas", value: formatCurrency(d.totalVendas) },
        { label: "Total de Pedidos", value: String(d.ped.length) },
        { label: "Ticket Médio", value: formatCurrency(d.ticketMedio) },
        { label: "Repasse Recebido", value: formatCurrency(d.repasse) },
      ]),
      docxText(`No período de ${formatDate(params.dateFrom)} a ${formatDate(params.dateTo)}, a ${params.pizzariaNome} registrou ${d.ped.length} pedidos totalizando ${formatCurrency(d.totalVendas)} em vendas. A Pizza Premiada reteve ${formatCurrency(d.totalPP)} (${d.taxaMedia.toFixed(1)}%) e o repasse líquido foi de ${formatCurrency(d.repasse)}.`),

      docxHeading("2. Vendas por Tipo de Pedido"),
      docxTable(
        ["Tipo", "Qtd", "Total", "Taxa PP", "Valor PP", "Repasse", "% total"],
        [
          ["Delivery", String(d.byType.delivery.qtd), formatCurrency(d.byType.delivery.total), `${d.taxaDel}%`, formatCurrency(d.ppDel), formatCurrency(d.byType.delivery.total - d.ppDel), d.totalVendas > 0 ? `${(d.byType.delivery.total / d.totalVendas * 100).toFixed(1)}%` : "0%"],
          ["Retirada", String(d.byType.retirada.qtd), formatCurrency(d.byType.retirada.total), `${d.taxaRet}%`, formatCurrency(d.ppRet), formatCurrency(d.byType.retirada.total - d.ppRet), d.totalVendas > 0 ? `${(d.byType.retirada.total / d.totalVendas * 100).toFixed(1)}%` : "0%"],
          ["Consumo local", String(d.byType.local.qtd), formatCurrency(d.byType.local.total), `${d.taxaLoc}%`, formatCurrency(d.ppLoc), formatCurrency(d.byType.local.total - d.ppLoc), d.totalVendas > 0 ? `${(d.byType.local.total / d.totalVendas * 100).toFixed(1)}%` : "0%"],
        ],
        ["Total", String(d.ped.length), formatCurrency(d.totalVendas), `${d.taxaMedia.toFixed(1)}%`, formatCurrency(d.totalPP), formatCurrency(d.repasse), "100%"],
      ),

      docxHeading("3. Vendas por Forma de Pagamento"),
      docxTable(
        ["Forma", "Qtd", "Total", "% total", "Canal"],
        [...d.byPayment.entries()].map(([forma, v]) => [forma, String(v.qtd), formatCurrency(v.total), d.totalVendas > 0 ? `${(v.total / d.totalVendas * 100).toFixed(1)}%` : "0%", v.canal]),
      ),
      docxCards([
        { label: "Total Automático (CardápioWeb)", value: formatCurrency(d.autoTotal) },
        { label: "Total Manual", value: formatCurrency(d.manualTotal) },
      ]),

      docxHeading("4. Histórico Diário de Vendas"),
      docxTable(
        ["Data", "Pedidos", "Delivery", "Retirada", "Salão", "Total", "PP (R$)", "Repasse (R$)"],
        [...d.byDay.entries()].sort().map(([day, v]) => {
          const pp = (v.delivery * d.taxaDel / 100) + (v.retirada * d.taxaRet / 100) + (v.local * d.taxaLoc / 100);
          return [formatDate(day), String(v.pedidos), formatCurrency(v.delivery), formatCurrency(v.retirada), formatCurrency(v.local), formatCurrency(v.total), formatCurrency(pp), formatCurrency(v.total - pp)];
        }),
      ),

      docxHeading("5. Histórico de Repasses"),
      ...(d.cobrancas.length > 0
        ? [docxTable(
          ["Período", "Valor devido", "Data envio", "Data pgto", "Status"],
          d.cobrancas.map(c => [`${formatDate(c.periodo_inicio)} — ${formatDate(c.periodo_fim)}`, formatCurrency(Number(c.valor_total_devido)), c.data_envio ? formatDate(c.data_envio) : "—", c.data_pagamento ? formatDate(c.data_pagamento) : "—", c.status.charAt(0).toUpperCase() + c.status.slice(1)]),
        )]
        : [docxText("Nenhuma cobrança registrada para esta pizzaria.")]),

      docxHeading("6. Cupons e Consumidores"),
      docxCards([
        { label: "Cupons Gerados", value: String(d.totalCupons) },
        { label: "Consumidores Únicos", value: String(d.consIds.length) },
        { label: "Cadastro Completo", value: String(d.consCompletos) },
        { label: "Pendentes", value: String(d.consPendentes) },
      ]),
      ...(d.topConsumers.length > 0 ? [
        docxText("Top 10 consumidores:", { bold: true }),
        docxTable(
          ["#", "Nome/Tel", "Pedidos", "Total gasto", "Cupons", "Último pedido"],
          d.topConsumers.slice(0, 10).map((c, i) => [`${i + 1}º`, c.nome, String(c.pedidos), formatCurrency(c.total), String(c.cupons), c.ultimoPedido ? formatDate(c.ultimoPedido) : "—"]),
        ),
      ] : []),
    ];

    const docx = createDocxReport(config, sections as any);
    await saveDocx(docx, `relatorio-${params.pizzariaNome.replace(/\s+/g, "-").toLowerCase()}`);
  }
}
