import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import FinanceiroRelatorio from "@/components/gestor/FinanceiroRelatorio";

export default function FinanceiroRelatorioPage() {
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [pizzarias, setPizzarias] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("cobrancas_repasse").select("*").order("criado_em", { ascending: false }),
      supabase.from("pizzarias").select("id, nome"),
    ]).then(([{ data: c }, { data: p }]) => {
      setCobrancas(c ?? []);
      setPizzarias(p ?? []);
      setLoading(false);
    });
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Carregando...
      </div>
    );

  return <FinanceiroRelatorio cobrancas={cobrancas} pizzarias={pizzarias} />;
}
