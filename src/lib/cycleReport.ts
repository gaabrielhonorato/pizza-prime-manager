import { supabase } from "@/integrations/supabase/client";
import {
  createPDFReport, addPDFSection, addPDFCards, addPDFText, addPDFTable, savePDF,
  createDocxReport, docxHeading, docxText, docxTable, docxCards, saveDocx,
  formatCurrency, formatDate, formatDateTime, type PDFReportConfig,
} from "@/lib/reportUtils";

interface CycleReportParams {
  campanhaId: string;
  campanhaNome: string;
  dataInicio: string;
  dataEncerramento: string;
  confidential?: string;
  format: "pdf" | "docx";
}

async function fetchCycleData(params: CycleReportParams) {
  const { campanhaId, dataInicio, dataEncerramento } = params;

  const { data: camp } = await supabase.from("campanhas").select("*").eq("id", campanhaId).single();
  const taxaDel = camp?.taxa_delivery ?? 15;
  const taxaRet = camp?.taxa_retirada ?? 15;
  const taxaLoc = camp?.taxa_local ?? 12;

  // All pedidos for this campaign — RPC bypasses max-rows=1000
  const { data: pedidosRaw } = await supabase.rpc("rpc_pedidos_todos_full");
  const ped = (pedidosRaw ?? []).filter((p: any) => p.campanha_id === campanhaId);
  const totalVendas = ped.reduce((s, p) => s + Number(p.valor_total), 0);

  // PP revenue by type
  let ppTotal = 0;
  ped.forEach(p => {
    const tipo = p.tipo_pedido || "delivery";
    const taxa = tipo === "retirada" ? taxaRet : tipo === "local" ? taxaLoc : taxaDel;
    ppTotal += Number(p.valor_total) * taxa / 100;
  });

  // Custos
  const { data: custos } = await supabase.from("custos_operacionais").select("*").eq("campanha_id", campanhaId);
  const totalCustos = custos?.reduce((s, c) => s + Number(c.valor_total_calculado || c.valor), 0) ?? 0;
  const lucro = ppTotal - totalCustos;
  const margem = ppTotal > 0 ? (lucro / ppTotal) * 100 : 0;

  // Pizzarias
  const { data: pizzarias } = await supabase.from("pizzarias").select("id, nome, cidade").eq("status", "ativa");
  const pizzMap = new Map((pizzarias ?? []).map(p => [p.id, p]));

  // Ranking
  const vendasPorPizzaria = new Map<string, number>();
  ped.forEach(p => vendasPorPizzaria.set(p.pizzaria_id, (vendasPorPizzaria.get(p.pizzaria_id) ?? 0) + Number(p.valor_total)));
  const ranking = [...vendasPorPizzaria.entries()]
    .map(([id, total]) => ({ id, nome: pizzMap.get(id)?.nome || "—", cidade: pizzMap.get(id)?.cidade || "—", total, pct: totalVendas > 0 ? (total / totalVendas * 100) : 0 }))
    .sort((a, b) => b.total - a.total);

  // Cupons
  const { data: cuponsData } = await supabase.from("cupons").select("quantidade").eq("campanha_id", campanhaId);
  const totalCupons = cuponsData?.reduce((s, c) => s + c.quantidade, 0) ?? 0;

  // Consumidores — RPC bypasses max-rows=1000
  const { data: consRaw } = await supabase.rpc("rpc_consumidores_lista");
  const consWithPhone = (consRaw ?? []).filter((c: any) => c.campanha_id === campanhaId && c.usuarios?.telefone);
  const completos = consWithPhone.filter(c => c.cadastro_completo).length;
  const pendentes = consWithPhone.length - completos;

  // Monthly evolution
  const monthlyMap = new Map<string, { pedidos: number; vendas: number; consumidores: number }>();
  ped.forEach(p => {
    const m = p.data_pedido.slice(0, 7);
    const e = monthlyMap.get(m) || { pedidos: 0, vendas: 0, consumidores: 0 };
    e.pedidos++;
    e.vendas += Number(p.valor_total);
    monthlyMap.set(m, e);
  });
  consWithPhone.forEach((c: any) => {
    const m = c.criado_em.slice(0, 7);
    const e = monthlyMap.get(m) || { pedidos: 0, vendas: 0, consumidores: 0 };
    e.consumidores++;
    monthlyMap.set(m, e);
  });

  // Projeções
  const { data: projecoes } = await supabase.from("projecoes_vendas").select("*").eq("campanha_id", campanhaId);

  return {
    camp, ped, totalVendas, ppTotal, totalCustos, lucro, margem,
    pizzarias: pizzarias ?? [], ranking, totalCupons,
    consWithPhone, completos, pendentes,
    monthlyMap, projecoes: projecoes ?? [],
    taxaDel, taxaRet, taxaLoc,
  };
}

export async function generateCycleReport(params: CycleReportParams) {
  const d = await fetchCycleData(params);
  const config: PDFReportConfig = {
    title: "Relatório de Desempenho do Ciclo",
    subtitle: params.campanhaNome,
    period: `${formatDate(params.dataInicio)} a ${formatDate(params.dataEncerramento)}`,
    confidential: params.confidential || undefined,
  };

  if (params.format === "pdf") {
    const doc = await createPDFReport(config);

    // Section 1
    let y = addPDFSection(doc, "1. Visão Geral do Ciclo");
    y = addPDFCards(doc, [
      { label: "Pizzarias Ativas", value: String(d.pizzarias.length) },
      { label: "Total Pedidos", value: String(d.ped.length) },
      { label: "Faturamento Total", value: formatCurrency(d.totalVendas) },
      { label: "Receita PP", value: formatCurrency(d.ppTotal) },
    ], y);
    y = addPDFCards(doc, [
      { label: "Custos Totais", value: formatCurrency(d.totalCustos) },
      { label: "Lucro Líquido", value: formatCurrency(d.lucro) },
      { label: "Margem", value: `${d.margem.toFixed(1)}%` },
      { label: "Consumidores", value: String(d.consWithPhone.length) },
    ], y);
    y = addPDFCards(doc, [{ label: "Total Cupons", value: String(d.totalCupons) }], y);

    // Section 2
    y = addPDFSection(doc, "2. Evolução Mensal");
    const monthRows = [...d.monthlyMap.entries()].sort().map(([m, v]) => [m, String(v.pedidos), formatCurrency(v.vendas), String(v.consumidores)]);
    y = addPDFTable(doc, [["Mês", "Pedidos", "Vendas", "Novos Consumidores"]], monthRows, y);

    // Section 3
    y = addPDFSection(doc, "3. Ranking de Pizzarias");
    const rankRows = d.ranking.slice(0, 20).map((r, i) => [`${i + 1}º`, r.nome, r.cidade, formatCurrency(r.total), `${r.pct.toFixed(1)}%`]);
    y = addPDFTable(doc, [["#", "Pizzaria", "Cidade", "Total Vendido", "Contribuição %"]], rankRows, y);

    // Section 4
    y = addPDFSection(doc, "4. Base de Consumidores");
    y = addPDFCards(doc, [
      { label: "Total Consumidores", value: String(d.consWithPhone.length) },
      { label: "Cadastros Completos", value: String(d.completos) },
      { label: "Pendentes", value: String(d.pendentes) },
    ], y);

    // Section 5
    y = addPDFSection(doc, "5. Financeiro Detalhado");
    y = addPDFCards(doc, [
      { label: "Receita PP", value: formatCurrency(d.ppTotal) },
      { label: "Custos", value: formatCurrency(d.totalCustos) },
      { label: "Lucro", value: formatCurrency(d.lucro) },
      { label: "Margem", value: `${d.margem.toFixed(1)}%` },
    ], y);

    // Section 6
    if (d.projecoes.length > 0) {
      y = addPDFSection(doc, "6. Projeções - Próximo Ciclo");
      const projRows = d.projecoes.map(p => [p.nome_cenario, String(p.pizzarias_mes1), String(p.vendas_por_pizzaria_mes), formatCurrency(Number(p.ticket_medio)), `${p.percentual_pp}%`]);
      y = addPDFTable(doc, [["Cenário", "Pizzarias M1", "Vendas/Pizza/Mês", "Ticket Médio", "% PP"]], projRows, y);
    }

    savePDF(doc, `relatorio-ciclo-${params.campanhaNome.replace(/\s+/g, "-").toLowerCase()}`);
  } else {
    const sections = [
      docxHeading("1. Visão Geral do Ciclo"),
      docxCards([
        { label: "Pizzarias Ativas", value: String(d.pizzarias.length) },
        { label: "Total Pedidos", value: String(d.ped.length) },
        { label: "Faturamento Total", value: formatCurrency(d.totalVendas) },
        { label: "Receita PP", value: formatCurrency(d.ppTotal) },
      ]),
      docxCards([
        { label: "Custos Totais", value: formatCurrency(d.totalCustos) },
        { label: "Lucro Líquido", value: formatCurrency(d.lucro) },
        { label: "Margem", value: `${d.margem.toFixed(1)}%` },
        { label: "Cupons Distribuídos", value: String(d.totalCupons) },
      ]),

      docxHeading("2. Evolução Mensal"),
      docxTable(["Mês", "Pedidos", "Vendas", "Novos Consumidores"], [...d.monthlyMap.entries()].sort().map(([m, v]) => [m, String(v.pedidos), formatCurrency(v.vendas), String(v.consumidores)])),

      docxHeading("3. Ranking de Pizzarias"),
      docxTable(["#", "Pizzaria", "Cidade", "Total Vendido", "Contribuição %"], d.ranking.slice(0, 20).map((r, i) => [`${i + 1}º`, r.nome, r.cidade, formatCurrency(r.total), `${r.pct.toFixed(1)}%`])),

      docxHeading("4. Base de Consumidores"),
      docxCards([
        { label: "Total", value: String(d.consWithPhone.length) },
        { label: "Completos", value: String(d.completos) },
        { label: "Pendentes", value: String(d.pendentes) },
      ]),

      docxHeading("5. Financeiro Detalhado"),
      docxCards([
        { label: "Receita PP", value: formatCurrency(d.ppTotal) },
        { label: "Custos", value: formatCurrency(d.totalCustos) },
        { label: "Lucro", value: formatCurrency(d.lucro) },
        { label: "Margem", value: `${d.margem.toFixed(1)}%` },
      ]),

      ...(d.projecoes.length > 0 ? [
        docxHeading("6. Projeções - Próximo Ciclo"),
        docxTable(["Cenário", "Pizzarias M1", "Vendas/Pizza/Mês", "Ticket Médio", "% PP"],
          d.projecoes.map(p => [p.nome_cenario, String(p.pizzarias_mes1), String(p.vendas_por_pizzaria_mes), formatCurrency(Number(p.ticket_medio)), `${p.percentual_pp}%`])),
      ] : []),
    ];

    const docx = createDocxReport(config, sections as any);
    await saveDocx(docx, `relatorio-ciclo-${params.campanhaNome.replace(/\s+/g, "-").toLowerCase()}`);
  }
}
