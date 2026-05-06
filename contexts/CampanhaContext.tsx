import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  nome: "Aguardando próxima campanha",
  descricao: "",
  logo: null,
  status: "pausada",
  dataInicio: null,
  dataEncerramento: null,
  dataSorteio: null,
  horaSorteio: "20:00",
  fusoHorario: "America/Sao_Paulo",
  valorCupom: 50,
  cuponsPorValor: 1,
  valorMinimoPedido: 30,
  limiteCuponsPorCiclo: "",
  totalCuponsCiclo: 0,
  arredondamento: "baixo",
  exigirCadastro: true,
  camposObrigatorios: { nome: true, cpf: true, email: true, telefone: true, endereco: false },
  exigirTermos: true,
  textoTermos: "https://pizzapremiada.com.br/termos",
  textoPolitica: "https://pizzapremiada.com.br/privacidade",
  enviarEmailConfirmacao: true,
  premios: [],
};

interface CampanhaContextValue {
  config: CampanhaConfig;
  setConfig: React.Dispatch<React.SetStateAction<CampanhaConfig>>;
  saveConfig: (cfg: CampanhaConfig) => void;
  loading: boolean;
}

const CampanhaContext = createContext<CampanhaContextValue | undefined>(undefined);

export function CampanhaProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<CampanhaConfig>(DEFAULT_CAMPANHA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCampanha = async () => {
      try {
        const { data: camp } = await supabase
          .from("campanhas")
          .select("*")
          .eq("is_principal", true)
          .limit(1)
          .single();

        if (camp) {
          // Fetch premios
          const { data: premiosData } = await supabase
            .from("premios")
            .select("*")
            .eq("campanha_id", camp.id)
            .order("posicao");

          setConfig({
            nome: camp.nome,
            descricao: camp.descricao ?? "",
            logo: null,
            status: camp.status as "ativa" | "pausada" | "encerrada",
            dataInicio: camp.data_inicio,
            dataEncerramento: camp.data_encerramento,
            dataSorteio: camp.data_sorteio,
            horaSorteio: camp.data_sorteio ? new Date(camp.data_sorteio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "20:00",
            fusoHorario: "America/Sao_Paulo",
            valorCupom: Number(camp.valor_por_cupom),
            cuponsPorValor: camp.cupons_por_valor,
            valorMinimoPedido: Number(camp.valor_minimo_pedido),
            limiteCuponsPorCiclo: camp.limite_cupons_ciclo?.toString() ?? "",
            totalCuponsCiclo: 0,
            arredondamento: camp.arredondamento as "baixo" | "acumular",
            exigirCadastro: true,
            camposObrigatorios: { nome: true, cpf: true, email: true, telefone: true, endereco: false },
            exigirTermos: true,
            textoTermos: "https://pizzapremiada.com.br/termos",
            textoPolitica: "https://pizzapremiada.com.br/privacidade",
            enviarEmailConfirmacao: true,
            premios: (premiosData ?? []).map((p) => ({
              id: p.id,
              nome: p.nome,
              descricao: p.descricao ?? "",
              valor: Number(p.valor),
              foto: null,
              ganhadores: p.quantidade_ganhadores,
            })),
          });
        }
      } catch (err) {
        console.error("Error fetching campanha principal:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCampanha();
  }, []);

  const saveConfig = (cfg: CampanhaConfig) => {
    setConfig(cfg);
  };

  const value = useMemo(() => ({ config, setConfig, saveConfig, loading }), [config, loading]);

  return <CampanhaContext.Provider value={value}>{children}</CampanhaContext.Provider>;
}

export function useCampanha() {
  const ctx = useContext(CampanhaContext);
  if (!ctx) throw new Error("useCampanha must be used within CampanhaProvider");
  return ctx;
}
