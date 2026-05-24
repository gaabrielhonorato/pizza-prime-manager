// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const NOMES_M = [
  "João","Pedro","Carlos","Lucas","Marcos","Rafael","Diego","Bruno",
  "Eduardo","Gustavo","Felipe","Thiago","Roberto","Ricardo","Fernando",
  "Vinícius","Mateus","Gabriel","André","Henrique","Alexandre","Daniel",
  "Rodrigo","Paulo","Leandro","Renato","Fábio","Leonardo","Marcelo","Igor",
];
const NOMES_F = [
  "Ana","Maria","Juliana","Amanda","Fernanda","Beatriz","Camila","Larissa",
  "Letícia","Mariana","Patrícia","Cristina","Sandra","Vanessa","Priscila",
  "Aline","Carla","Cláudia","Débora","Elaine","Flávia","Gabriela","Helena",
  "Isabela","Jéssica","Karen","Luana","Michele","Natália","Paula",
];
const SOBRENOMES = [
  "Silva","Santos","Oliveira","Souza","Costa","Pereira","Ferreira","Alves",
  "Pinto","Ribeiro","Rodrigues","Almeida","Nascimento","Lima","Araújo",
  "Melo","Barbosa","Cardoso","Martins","Rocha","Nunes","Carvalho","Freitas",
  "Gomes","Lopes","Mendes","Campos","Teixeira","Correia","Dias",
];
const BAIRROS_DF = [
  "Asa Norte","Asa Sul","Lago Norte","Lago Sul","Águas Claras","Taguatinga",
  "Ceilândia","Samambaia","Sobradinho","Guará","Cruzeiro","Sudoeste",
  "Octogonal","Noroeste","Planaltina","Gama","Santa Maria","Vicente Pires",
  "Riacho Fundo","Brazlândia","Park Way","Jardim Botânico","São Sebastião",
  "Recanto das Emas","Núcleo Bandeirante",
];
const CANAIS = [
  "cardapioweb","cardapioweb","cardapioweb","cardapioweb",
  "whatsapp","whatsapp","whatsapp",
  "balcao","balcao",
  "anuncios","outros",
];
const PAGAMENTOS = [
  "pix","pix","pix","pix",
  "cartao_credito","cartao_credito",
  "cartao_debito","cartao_debito",
  "dinheiro","dinheiro",
];
const TIPOS = [
  "delivery","delivery","delivery","delivery","delivery","delivery",
  "retirada","retirada","retirada",
  "local",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function gerarCPF(): string {
  const d = Array.from({ length: 9 }, () => rand(0, 9));
  const s1 = d.reduce((a, x, i) => a + x * (10 - i), 0);
  const c1 = s1 % 11 < 2 ? 0 : 11 - (s1 % 11);
  d.push(c1);
  const s2 = d.reduce((a, x, i) => a + x * (11 - i), 0);
  const c2 = s2 % 11 < 2 ? 0 : 11 - (s2 % 11);
  d.push(c2);
  const s = d.join("");
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`;
}
function gerarTelefone(): string {
  return `(61) 9${rand(6000, 9999)}-${rand(1000, 9999)}`;
}

function buildPedido(campanha_id: string, pizzaria_id: string, consumidor_id: string, valorPorCupom: number, dias: number) {
  const now = new Date();
  const daysAgo = rand(0, dias);
  const dataPedido = new Date(now);
  dataPedido.setDate(dataPedido.getDate() - daysAgo);
  dataPedido.setHours(rand(10, 23), rand(0, 59), 0, 0);
  const tipo = pick(TIPOS);
  const valorBase = 35 + rand(0, 245);
  const taxaEntrega = tipo === "delivery" ? rand(5, 15) : 0;
  const desconto = Math.random() < 0.15 ? rand(5, 20) : 0;
  const valorTotal = Math.max(valorBase + taxaEntrega - desconto, 15);
  const cuponsGerados = Math.max(Math.floor(valorTotal / valorPorCupom), 0);
  return {
    campanha_id,
    pizzaria_id,
    consumidor_id,
    valor_total: valorTotal,
    canal: pick(CANAIS),
    status: "entregue",
    cupons_gerados: cuponsGerados,
    forma_pagamento: pick(PAGAMENTOS),
    tipo_pedido: tipo,
    taxa_entrega: taxaEntrega,
    desconto,
    bairro_entrega: tipo === "delivery" ? pick(BAIRROS_DF) : null,
    data_pedido: dataPedido.toISOString(),
    horario_pedido: dataPedido.toISOString(),
    data_entrega: new Date(dataPedido.getTime() + rand(20, 90) * 60000).toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const body = await req.json().catch(() => ({}));
    const N_CONSUMIDORES: number = body.consumidores ?? 20;
    const N_PEDIDOS: number = body.pedidos ?? 300;
    const DIAS: number = body.dias ?? 60;
    const SENHA: string = body.senha ?? "Consumidor@123";

    // ── Campanha principal ────────────────────────────────────────────────────
    const { data: campanha, error: campanhaErr } = await supabase
      .from("campanhas")
      .select("id, nome, valor_por_cupom")
      .eq("status", "ativa")
      .limit(1)
      .single();
    if (campanhaErr || !campanha) {
      return jsonResponse({ error: "Nenhuma campanha ativa", detalhes: campanhaErr?.message }, 400);
    }
    const valorPorCupom = Number(campanha.valor_por_cupom ?? 50);

    // ── Pizzarias de Brasília (todas ativas) ──────────────────────────────────
    const { data: pizzarias } = await supabase
      .from("pizzarias")
      .select("id")
      .eq("status", "ativa")
      .eq("cidade", "Brasília")
      .order("nome");

    if (!pizzarias?.length) {
      return jsonResponse({ error: "Nenhuma pizzaria ativa em Brasília" }, 400);
    }
    const pizzariaIds = pizzarias.map((p: any) => p.id);

    // ── Detectar índice inicial dos novos consumidores ────────────────────────
    const { count: existingCount } = await supabase
      .from("usuarios")
      .select("id", { count: "exact", head: true })
      .like("email", "consumidor%@pizza-prime.test");
    const startIndex = (existingCount ?? 0) + 1;

    // ── Buscar consumidores existentes para pool de pedidos ───────────────────
    const { data: consumidoresExistentes } = await supabase
      .from("consumidores")
      .select("id")
      .eq("campanha_id", campanha.id);
    const poolExistente: string[] = (consumidoresExistentes ?? []).map((c: any) => c.id);

    // ─────────────────────────────────────────────────────────────────────────
    // 1. CRIAR CONSUMIDORES (com senha fixa e cadastro completo)
    // ─────────────────────────────────────────────────────────────────────────
    const consumidorIdsNovos: string[] = [];
    const authUserIds: string[] = [];
    const errosConsumidor: string[] = [];

    for (let i = 0; i < N_CONSUMIDORES; i++) {
      const genero = Math.random() > 0.45 ? "F" : "M";
      const primeiroNome = genero === "F" ? pick(NOMES_F) : pick(NOMES_M);
      const nome = `${primeiroNome} ${pick(SOBRENOMES)}`;
      const idx = startIndex + i;
      const email = `consumidor${String(idx).padStart(2, "0")}@pizza-prime.test`;
      const cpf = gerarCPF();
      const telefone = gerarTelefone();
      const bairro = pick(BAIRROS_DF);
      const anoNasc = rand(1964, 2005);
      const dataNasc = `${anoNasc}-${String(rand(1, 12)).padStart(2, "0")}-${String(rand(1, 28)).padStart(2, "0")}`;

      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password: SENHA,
        email_confirm: true,
        user_metadata: { nome, cpf, telefone, perfil: "consumidor" },
      });

      if (authErr || !authData.user) {
        errosConsumidor.push(`${nome} (${email}): ${authErr?.message ?? "erro desconhecido"}`);
        continue;
      }

      authUserIds.push(authData.user.id);
      await new Promise((r) => setTimeout(r, 150));

      // Garantir nome e telefone no registro usuarios (trigger pode não setar tudo)
      await supabase.from("usuarios").upsert(
        { id: authData.user.id, nome, email, cpf, telefone, perfil: "consumidor", ativo: true },
        { onConflict: "id" },
      );

      const { data: cons, error: consErr } = await supabase
        .from("consumidores")
        .insert({
          usuario_id: authData.user.id,
          campanha_id: campanha.id,
          cidade: "Brasília",
          bairro,
          genero,
          data_nascimento: dataNasc,
          cadastro_completo: true,
          termos_aceitos: true,
          termos_versao: "1.0",
          aceita_whatsapp: Math.random() > 0.25,
          consentimento_origem: "seed_test",
        })
        .select("id")
        .single();

      if (consErr || !cons) {
        errosConsumidor.push(`Consumidor de ${nome}: ${consErr?.message ?? "erro desconhecido"}`);
        continue;
      }

      consumidorIdsNovos.push(cons.id);
    }

    // Pool completo: existentes + novos
    const todoConsumidorIds = [...poolExistente, ...consumidorIdsNovos];
    if (todoConsumidorIds.length === 0) {
      return jsonResponse({ error: "Sem consumidores disponíveis para criar pedidos" }, 500);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. CRIAR PEDIDOS
    //    - 1 pedido garantido por pizzaria de Brasília (cobre todas as 180)
    //    - pedidos restantes distribuídos aleatoriamente
    // ─────────────────────────────────────────────────────────────────────────
    const pedidoInserts: any[] = [];

    // Garantir 1 pedido por pizzaria
    for (const pizzaria_id of pizzariaIds) {
      pedidoInserts.push(
        buildPedido(campanha.id, pizzaria_id, pick(todoConsumidorIds), valorPorCupom, DIAS),
      );
    }

    // Pedidos aleatórios restantes
    const restantes = Math.max(N_PEDIDOS - pizzariaIds.length, 0);
    for (let i = 0; i < restantes; i++) {
      pedidoInserts.push(
        buildPedido(campanha.id, pick(pizzariaIds), pick(todoConsumidorIds), valorPorCupom, DIAS),
      );
    }

    // Inserir em lotes de 100
    const pedidoIds: string[] = [];
    for (let i = 0; i < pedidoInserts.length; i += 100) {
      const { data: inseridos, error: pe } = await supabase
        .from("pedidos")
        .insert(pedidoInserts.slice(i, i + 100))
        .select("id");
      if (pe) console.error("Pedidos lote erro:", pe.message);
      else inseridos?.forEach((p: any) => pedidoIds.push(p.id));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. CRIAR CUPONS
    // ─────────────────────────────────────────────────────────────────────────
    const cupomInserts = pedidoIds
      .map((id, idx) => ({
        id,
        consumidor_id: pedidoInserts[idx]?.consumidor_id,
        cupons_gerados: pedidoInserts[idx]?.cupons_gerados ?? 0,
      }))
      .filter((p) => p.cupons_gerados > 0)
      .map((p) => ({
        campanha_id: campanha.id,
        consumidor_id: p.consumidor_id,
        pedido_id: p.id,
        quantidade: p.cupons_gerados,
        status: "validado",
      }));

    const cupomIds: string[] = [];
    for (let i = 0; i < cupomInserts.length; i += 100) {
      const { data: inseridos, error: ce } = await supabase
        .from("cupons")
        .insert(cupomInserts.slice(i, i + 100))
        .select("id");
      if (ce) console.error("Cupons lote erro:", ce.message);
      else inseridos?.forEach((c: any) => cupomIds.push(c.id));
    }

    // ── Salvar IDs para limpeza ───────────────────────────────────────────────
    const { data: existing } = await supabase
      .from("integracoes")
      .select("config")
      .eq("nome", "seed_consumidores_pedidos")
      .maybeSingle();

    const prev = (existing?.config as any) ?? {};
    await supabase.from("integracoes").upsert(
      {
        nome: "seed_consumidores_pedidos",
        provedor: "interno",
        status: "configured",
        config: {
          auth_user_ids: [...(prev.auth_user_ids ?? []), ...authUserIds],
          consumidor_ids: [...(prev.consumidor_ids ?? []), ...consumidorIdsNovos],
          pedido_ids: [...(prev.pedido_ids ?? []), ...pedidoIds],
          cupom_ids: [...(prev.cupom_ids ?? []), ...cupomIds],
          gerado_em: new Date().toISOString(),
        },
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "nome" },
    );

    return jsonResponse({
      success: true,
      consumidores_criados: consumidorIdsNovos.length,
      pedidos_criados: pedidoIds.length,
      cupons_criados: cupomIds.length,
      pizzarias_cobertas: pizzariaIds.length,
      pedidos_garantidos_por_pizzaria: pizzariaIds.length,
      logins_disponiveis: Array.from({ length: N_CONSUMIDORES }, (_, i) =>
        `consumidor${String(startIndex + i).padStart(2, "0")}@pizza-prime.test`
      ),
      senha: SENHA,
      erros_consumidor: errosConsumidor.length > 0 ? errosConsumidor : undefined,
    });
  } catch (err: any) {
    return jsonResponse({ error: err.message }, 500);
  }
});
