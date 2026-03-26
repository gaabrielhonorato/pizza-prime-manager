import { addDays, subDays, startOfDay } from "date-fns";

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

export interface VendaDiaria {
  data: Date;
  canal: CanalVenda;
  vendas: number;
}

// Generate 6 months of daily sales mock data per channel
function seed(): VendaDiaria[] {
  const data: VendaDiaria[] = [];
  const today = startOfDay(new Date());
  const start = subDays(today, 180); // 6 months back

  for (let d = start; d <= today; d = addDays(d, 1)) {
    for (const canal of CANAIS) {
      const base =
        canal === "Anúncios Meta" ? 40 :
        canal === "Google Ads" ? 25 :
        canal === "WhatsApp" ? 18 :
        canal === "CardápioWeb Orgânico" ? 15 :
        canal === "Indicação" ? 10 :
        canal === "Direto na loja" ? 30 : 5;
      const vendas = Math.round(base + Math.random() * base * 0.6 - base * 0.3);
      data.push({ data: new Date(d), canal, vendas: Math.max(0, vendas) });
    }
  }
  return data;
}

export const vendasDiarias = seed();
