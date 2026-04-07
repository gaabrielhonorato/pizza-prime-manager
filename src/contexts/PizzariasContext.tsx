import { createContext, ReactNode, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Pizzaria {
  id: string;
  nome: string;
  responsavel: string;
  cnpj: string;
  telefone: string;
  endereco: string;
  cidade: string;
  bairro: string;
  cep: string;
  status: "Prospectada" | "Ativa" | "Inativa";
  matriculaPaga: boolean;
  dataEntrada: string;
  vendas: number;
  cardapiowebMerchantId: string;
  cardapiowebApiKey: string;
}

interface PizzariasContextValue {
  pizzarias: Pizzaria[];
  loading: boolean;
  refetch: () => Promise<void>;
  addPizzaria: (pizzaria: Omit<Pizzaria, "id">) => void;
  updatePizzaria: (id: string, pizzaria: Omit<Pizzaria, "id">) => void;
  removePizzaria: (id: string) => void;
}

const PizzariasContext = createContext<PizzariasContextValue | undefined>(undefined);

function capitalizeStatus(s: string): "Ativa" | "Prospectada" | "Inativa" {
  const map: Record<string, "Ativa" | "Prospectada" | "Inativa"> = {
    ativa: "Ativa",
    prospectada: "Prospectada",
    inativa: "Inativa",
  };
  return map[s?.toLowerCase()] ?? "Ativa";
}

export function PizzariasProvider({ children }: { children: ReactNode }) {
  const [pizzarias, setPizzarias] = useState<Pizzaria[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPizzarias = useCallback(async () => {
    setLoading(true);
    try {
      const { data: pizzariasData, error } = await supabase
        .from("pizzarias")
        .select("*, usuarios(nome)");

      if (error) {
        console.error("Error fetching pizzarias:", error);
        setLoading(false);
        return;
      }

      // Count pedidos per pizzaria for vendas
      const { data: pedidosData } = await supabase
        .from("pedidos")
        .select("pizzaria_id");

      const vendasMap = new Map<string, number>();
      pedidosData?.forEach((p) => {
        vendasMap.set(p.pizzaria_id, (vendasMap.get(p.pizzaria_id) ?? 0) + 1);
      });

      const mapped: Pizzaria[] = (pizzariasData ?? []).map((p: any) => ({
        id: p.id,
        nome: p.nome,
        responsavel: p.usuarios?.nome ?? "",
        cnpj: p.cnpj ?? "",
        telefone: p.telefone,
        endereco: p.endereco ?? "",
        cidade: p.cidade,
        bairro: p.bairro,
        cep: p.cep ?? "",
        status: capitalizeStatus(p.status),
        matriculaPaga: p.matricula_paga,
        dataEntrada: typeof p.data_entrada === "string" ? p.data_entrada.slice(0, 10) : "",
        vendas: vendasMap.get(p.id) ?? 0,
        cardapiowebMerchantId: p.cardapioweb_merchant_id ?? "",
        cardapiowebApiKey: p.cardapioweb_api_key ?? "",
      }));

      setPizzarias(mapped);
    } catch (err) {
      console.error("Error fetching pizzarias:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPizzarias();
  }, [fetchPizzarias]);

  const value = useMemo<PizzariasContextValue>(() => ({
    pizzarias,
    loading,
    refetch: fetchPizzarias,
    addPizzaria: async (pizzaria) => {
      // Optimistically add locally; real insert requires usuario_id
      setPizzarias((current) => [...current, { ...pizzaria, id: crypto.randomUUID() }]);
    },
    updatePizzaria: async (id, pizzaria) => {
      const { error } = await supabase.from("pizzarias").update({
        nome: pizzaria.nome,
        cnpj: pizzaria.cnpj || null,
        telefone: pizzaria.telefone,
        endereco: pizzaria.endereco || null,
        cidade: pizzaria.cidade,
        bairro: pizzaria.bairro,
        cep: pizzaria.cep || null,
        status: pizzaria.status?.toLowerCase(),
        matricula_paga: pizzaria.matriculaPaga,
        cardapioweb_merchant_id: pizzaria.cardapiowebMerchantId || null,
        cardapioweb_api_key: pizzaria.cardapiowebApiKey || null,
      }).eq("id", id);
      if (!error) fetchPizzarias();
      else console.error("Error updating pizzaria:", error);
    },
    removePizzaria: async (id) => {
      const { error } = await supabase.from("pizzarias").delete().eq("id", id);
      if (!error) setPizzarias((current) => current.filter((item) => item.id !== id));
      else console.error("Error removing pizzaria:", error);
    },
  }), [pizzarias, loading, fetchPizzarias]);

  return <PizzariasContext.Provider value={value}>{children}</PizzariasContext.Provider>;
}

export function usePizzarias() {
  const context = useContext(PizzariasContext);
  if (!context) {
    throw new Error("usePizzarias must be used within PizzariasProvider");
  }
  return context;
}
