import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MinhaPizzariaData {
  id: string;
  nome: string;
  cnpj: string;
  telefone: string;
  endereco: string;
  cidade: string;
  bairro: string;
  cep: string;
  status: string;
  matriculaPaga: boolean;
  metaMensal: number;
  dataEntrada: string;
  observacoes: string;
}

export interface PizzariaStats {
  vendasMes: number;
  pedidosMes: number;
  cuponsCiclo: number;
}

interface MinhaPizzariaContextValue {
  pizzaria: MinhaPizzariaData | null;
  stats: PizzariaStats;
  loading: boolean;
  refetch: () => Promise<void>;
}

const MinhaPizzariaContext = createContext<MinhaPizzariaContextValue | undefined>(undefined);

export function MinhaPizzariaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [pizzaria, setPizzaria] = useState<MinhaPizzariaData | null>(null);
  const [stats, setStats] = useState<PizzariaStats>({ vendasMes: 0, pedidosMes: 0, cuponsCiclo: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    setLoading(true);
    try {
      // Fetch pizzaria for current user
      const { data: pData, error } = await supabase
        .from("pizzarias")
        .select("*")
        .eq("usuario_id", user.id)
        .single();

      if (error || !pData) {
        console.error("Pizzaria not found for user:", error);
        setPizzaria(null);
        setLoading(false);
        return;
      }

      setPizzaria({
        id: pData.id,
        nome: pData.nome,
        cnpj: pData.cnpj ?? "",
        telefone: pData.telefone,
        endereco: pData.endereco ?? "",
        cidade: pData.cidade,
        bairro: pData.bairro,
        cep: pData.cep ?? "",
        status: pData.status,
        matriculaPaga: pData.matricula_paga,
        metaMensal: pData.meta_mensal,
        dataEntrada: typeof pData.data_entrada === "string" ? pData.data_entrada.slice(0, 10) : "",
        observacoes: pData.observacoes ?? "",
      });

      // Fetch stats: pedidos this month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("valor_total, cupons_gerados")
        .eq("pizzaria_id", pData.id)
        .gte("data_pedido", monthStart);

      const vendasMes = pedidos?.reduce((s, p) => s + Number(p.valor_total), 0) ?? 0;
      const pedidosMes = pedidos?.length ?? 0;

      // Cupons in current cycle (validado or pendente)
      const { data: cupons } = await supabase
        .from("cupons")
        .select("quantidade, status, pedido_id")
        .in("pedido_id", (
          await supabase.from("pedidos").select("id").eq("pizzaria_id", pData.id)
        ).data?.map(p => p.id) ?? []);

      const cuponsCiclo = cupons?.filter(c => c.status === "validado" || c.status === "pendente").reduce((s, c) => s + c.quantidade, 0) ?? 0;

      setStats({ vendasMes, pedidosMes, cuponsCiclo });
    } catch (err) {
      console.error("Error fetching pizzaria data:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <MinhaPizzariaContext.Provider value={{ pizzaria, stats, loading, refetch: fetchData }}>
      {children}
    </MinhaPizzariaContext.Provider>
  );
}

export function useMinhaPizzaria() {
  const ctx = useContext(MinhaPizzariaContext);
  if (!ctx) throw new Error("useMinhaPizzaria must be used within MinhaPizzariaProvider");
  return ctx;
}
