
const CANAIS = [
  "Anúncios Meta",
  "Google Ads",
  "WhatsApp",
  "CardápioWeb Orgânico",
  "Indicação",
  "Direto na loja",
  "Outros",
] as const;

export type CanalVenda = (typeof CANAIS)[number];
export const CANAIS_VENDA: CanalVenda[] = [...CANAIS];

// Generate daily sales mock data for 31 days, split by channel
function seed() {
  const data: { dia: number; canal: CanalVenda; vendas: number }[] = [];
  for (let dia = 1; dia <= 31; dia++) {
    for (const canal of CANAIS) {
      const base =
        canal === "Anúncios Meta" ? 40 :
        canal === "Google Ads" ? 25 :
        canal === "WhatsApp" ? 18 :
        canal === "CardápioWeb Orgânico" ? 15 :
        canal === "Indicação" ? 10 :
        canal === "Direto na loja" ? 30 : 5;
      const vendas = Math.round(base + Math.random() * base * 0.6 - base * 0.3);
      data.push({ dia, canal, vendas: Math.max(0, vendas) });
    }
  }
  return data;
}

export const vendasDiarias = seed();
