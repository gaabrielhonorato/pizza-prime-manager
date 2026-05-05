import { useEffect, useState } from "react";
import { Building2, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import LogoUpload from "@/components/gestor/LogoUpload";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaBranding } from "@/contexts/EmpresaBrandingContext";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

interface EmpresaConfig {
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  email: string;
  telefone: string;
  endereco: string;
  logoUrl: string | null;
}

const EMPTY_EMPRESA: EmpresaConfig = {
  nomeFantasia: "Pizza Premiada",
  razaoSocial: "",
  cnpj: "",
  email: "",
  telefone: "",
  endereco: "",
  logoUrl: null,
};

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseEmpresaConfig(config: Json | null): EmpresaConfig {
  if (!config || typeof config !== "object" || Array.isArray(config)) return EMPTY_EMPRESA;
  const data = config as Record<string, unknown>;
  const logoUrl = data.logoUrl;

  return {
    nomeFantasia: readString(data.nomeFantasia) || EMPTY_EMPRESA.nomeFantasia,
    razaoSocial: readString(data.razaoSocial),
    cnpj: readString(data.cnpj),
    email: readString(data.email),
    telefone: readString(data.telefone),
    endereco: readString(data.endereco),
    logoUrl: typeof logoUrl === "string" && logoUrl ? logoUrl : null,
  };
}

export default function EmpresaTab() {
  const { refreshBranding } = useEmpresaBranding();
  const [empresa, setEmpresa] = useState<EmpresaConfig>(EMPTY_EMPRESA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadEmpresa = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("integracoes")
        .select("config")
        .eq("nome", "empresa")
        .maybeSingle();

      if (mounted) {
        if (error) toast.error("Erro ao carregar dados da empresa: " + error.message);
        setEmpresa(parseEmpresaConfig(data?.config ?? null));
        setLoading(false);
      }
    };

    loadEmpresa();
    return () => { mounted = false; };
  }, []);

  const updateEmpresa = <K extends keyof EmpresaConfig>(key: K, value: EmpresaConfig[K]) => {
    setEmpresa((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        nome: "empresa",
        provedor: "interno",
        status: "configured",
        atualizado_em: new Date().toISOString(),
        config: empresa as unknown as Json,
      };

      const { error: upsertError } = await supabase
        .from("integracoes")
        .upsert(payload, { onConflict: "nome" });
      if (upsertError) throw upsertError;

      const { data: campanhas, error: campanhaError } = await supabase.rpc("get_campanha_principal");
      if (campanhaError) throw campanhaError;

      const campanhaId = campanhas?.[0]?.id;
      if (campanhaId) {
        const { error: logoError } = await supabase
          .from("campanhas")
          .update({ logo_pp_url: empresa.logoUrl })
          .eq("id", campanhaId);
        if (logoError) throw logoError;
      }

      await refreshBranding();
      toast.success("Dados da empresa salvos com sucesso.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao salvar empresa: " + message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Carregando dados da empresa...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" /> Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <LogoUpload label="Foto de perfil / logo da empresa" value={empresa.logoUrl} onChange={(value) => updateEmpresa("logoUrl", value)} folder="empresa" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome fantasia</Label>
              <Input value={empresa.nomeFantasia} onChange={(e) => updateEmpresa("nomeFantasia", e.target.value)} placeholder="Pizza Premiada" />
            </div>
            <div className="space-y-1.5">
              <Label>Razão social</Label>
              <Input value={empresa.razaoSocial} onChange={(e) => updateEmpresa("razaoSocial", e.target.value)} placeholder="Razão social da empresa" />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <Input value={empresa.cnpj} onChange={(e) => updateEmpresa("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail comercial</Label>
              <Input type="email" value={empresa.email} onChange={(e) => updateEmpresa("email", e.target.value)} placeholder="contato@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone / WhatsApp</Label>
              <Input value={empresa.telefone} onChange={(e) => updateEmpresa("telefone", e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Endereço</Label>
              <Textarea value={empresa.endereco} onChange={(e) => updateEmpresa("endereco", e.target.value)} rows={3} placeholder="Endereço cadastral da empresa" />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar empresa
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
