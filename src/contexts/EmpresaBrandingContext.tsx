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
  const [loading, setLoading] = useState(true);

  const refreshBranding = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_campanha_principal");
      if (error) throw error;
      setLogoUrl(data?.[0]?.logo_pp_url ?? null);
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
    <EmpresaBrandingContext.Provider value={{ nome: DEFAULT_BRAND_NAME, logoUrl, loading, refreshBranding }}>
      {children}
    </EmpresaBrandingContext.Provider>
  );
}

export function useEmpresaBranding() {
  const ctx = useContext(EmpresaBrandingContext);
  if (!ctx) throw new Error("useEmpresaBranding must be used within EmpresaBrandingProvider");
  return ctx;
}
