import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_BRAND_NAME = "Pizza Premiada";

interface EmpresaBrandingContextValue {
  nome: string;
  logoUrl: string | null;
  loading: boolean;
  refreshBranding: () => Promise<void>;
}

const EmpresaBrandingContext = createContext<EmpresaBrandingContextValue | undefined>(undefined);

export function EmpresaBrandingProvider({ children }: { children: ReactNode }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [nome, setNome] = useState(DEFAULT_BRAND_NAME);
  const [loading, setLoading] = useState(true);

  const refreshBranding = useCallback(async () => {
    setLoading(true);
    try {
      // Primary source: integracoes.config (always written by EmpresaTab)
      const { data: intData } = await supabase
        .from("integracoes")
        .select("config")
        .eq("nome", "empresa")
        .maybeSingle();

      const config = intData?.config as Record<string, unknown> | null;
      const logoFromIntegracoes = typeof config?.logoUrl === "string" && config.logoUrl ? config.logoUrl : null;
      const nomeFromIntegracoes = typeof config?.nomeFantasia === "string" && config.nomeFantasia ? config.nomeFantasia : DEFAULT_BRAND_NAME;

      setNome(nomeFromIntegracoes);

      // Fallback: campanha logo if no logo in integracoes
      if (logoFromIntegracoes) {
        setLogoUrl(logoFromIntegracoes);
      } else {
        const { data: campanhaData } = await supabase.rpc("get_campanha_principal");
        setLogoUrl(campanhaData?.[0]?.logo_pp_url ?? null);
      }
    } catch {
      setLogoUrl(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBranding();
  }, [refreshBranding]);

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = logoUrl || "/favicon.ico";
  }, [logoUrl]);

  return (
    <EmpresaBrandingContext.Provider value={{ nome, logoUrl, loading, refreshBranding }}>
      {children}
    </EmpresaBrandingContext.Provider>
  );
}

export function useEmpresaBranding() {
  const ctx = useContext(EmpresaBrandingContext);
  if (!ctx) throw new Error("useEmpresaBranding must be used within EmpresaBrandingProvider");
  return ctx;
}
