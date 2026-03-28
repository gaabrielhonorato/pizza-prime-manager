import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

export interface Premio {
  id: string;
  nome: string;
  descricao: string;
  valor: number;
  foto: string | null;
  ganhadores: number;
}

export interface CampanhaConfig {
  nome: string;
  descricao: string;
  logo: string | null;
  status: "ativa" | "pausada" | "encerrada";
  dataInicio: string | null;
  dataEncerramento: string | null;
  dataSorteio: string | null;
  horaSorteio: string;
  fusoHorario: string;
  valorCupom: number;
  cuponsPorValor: number;
  valorMinimoPedido: number;
  limiteCuponsPorCiclo: string;
  totalCuponsCiclo: number;
  arredondamento: "baixo" | "acumular";
  exigirCadastro: boolean;
  camposObrigatorios: { nome: boolean; cpf: boolean; email: boolean; telefone: boolean; endereco: boolean };
  exigirTermos: boolean;
  textoTermos: string;
  textoPolitica: string;
  enviarEmailConfirmacao: boolean;
  premios: Premio[];
}

export const DEFAULT_CAMPANHA: CampanhaConfig = {
  nome: "Pizza Premiada — Ciclo 1",
  descricao: "Compre pizzas, acumule cupons e concorra a prêmios incríveis!",
  logo: null,
  status: "ativa",
  dataInicio: new Date(2025, 9, 1).toISOString(),
  dataEncerramento: new Date(2026, 0, 31).toISOString(),
  dataSorteio: new Date(2026, 1, 5).toISOString(),
  horaSorteio: "20:00",
  fusoHorario: "America/Sao_Paulo",
  valorCupom: 50,
  cuponsPorValor: 1,
  valorMinimoPedido: 30,
  limiteCuponsPorCiclo: "",
  arredondamento: "baixo",
  exigirCadastro: true,
  camposObrigatorios: { nome: true, cpf: true, email: true, telefone: true, endereco: false },
  exigirTermos: true,
  textoTermos: "https://pizzapremiada.com.br/termos",
  textoPolitica: "https://pizzapremiada.com.br/privacidade",
  enviarEmailConfirmacao: true,
  premios: [
    { id: "1", nome: "iPhone 17 Pro Max", descricao: "128GB, Titânio Natural", valor: 10499, foto: null, ganhadores: 1 },
    { id: "2", nome: "Viagem Rio Quente", descricao: "5 diárias com acompanhante", valor: 5000, foto: null, ganhadores: 1 },
    { id: "3", nome: "Pix R$1.000", descricao: "Prêmio em dinheiro via Pix", valor: 1000, foto: null, ganhadores: 3 },
  ],
};

const STORAGE_KEY = "pizza-premiada:campanha";

interface CampanhaContextValue {
  config: CampanhaConfig;
  setConfig: React.Dispatch<React.SetStateAction<CampanhaConfig>>;
  saveConfig: (cfg: CampanhaConfig) => void;
}

const CampanhaContext = createContext<CampanhaContextValue | undefined>(undefined);

function loadConfig(): CampanhaConfig {
  if (typeof window === "undefined") return DEFAULT_CAMPANHA;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return DEFAULT_CAMPANHA;
  try {
    const parsed = JSON.parse(saved);
    return { ...DEFAULT_CAMPANHA, ...parsed };
  } catch {
    return DEFAULT_CAMPANHA;
  }
}

export function CampanhaProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<CampanhaConfig>(loadConfig);

  const saveConfig = (cfg: CampanhaConfig) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    setConfig(cfg);
  };

  const value = useMemo(() => ({ config, setConfig, saveConfig }), [config]);

  return <CampanhaContext.Provider value={value}>{children}</CampanhaContext.Provider>;
}

export function useCampanha() {
  const ctx = useContext(CampanhaContext);
  if (!ctx) throw new Error("useCampanha must be used within CampanhaProvider");
  return ctx;
}
