import { useState, useEffect } from "react";
import { FlaskConical, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TestStats {
  pedidos: number;
  cupons: number;
  repasses: number;
  geradoEm: string | null;
}

export default function DadosTesteTab() {
  const [stats, setStats] = useState<TestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("integracoes")
      .select("config")
      .eq("nome", "seed_test_data")
      .maybeSingle();

    if (data?.config) {
      const c = data.config as any;
      setStats({
        pedidos:  (c.pedido_ids  ?? []).length,
        cupons:   (c.cupom_ids   ?? []).length,
        repasses: (c.repasse_ids ?? []).length,
        geradoEm: c.gerado_em ?? null,
      });
    } else {
      setStats(null);
    }
    setLoading(false);
  };

  useEffect(() => { loadStats(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await supabase.functions.invoke("seed-test-data", { body: {} });
      if (res.error || res.data?.error) {
        toast.error("Erro ao gerar dados: " + (res.data?.error ?? res.error?.message));
      } else {
        toast.success(`Dados gerados: ${res.data.pedidos} pedidos, ${res.data.cupons} cupons, ${res.data.repasses} repasses`);
        await loadStats();
      }
    } catch (err: any) {
      toast.error("Erro inesperado: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      const res = await supabase.functions.invoke("clear-test-data", { body: {} });
      if (res.error || res.data?.error) {
        toast.error("Erro ao limpar dados: " + (res.data?.error ?? res.error?.message));
      } else {
        const d = res.data.deleted;
        toast.success(`Dados removidos: ${d.pedidos} pedidos, ${d.cupons} cupons, ${d.repasses} repasses`);
        setStats(null);
      }
    } catch (err: any) {
      toast.error("Erro inesperado: " + err.message);
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  };

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleString("pt-BR") : "—";

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4 text-primary" /> Dados de Teste
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Gera pedidos, cupons e repasses fictícios dos últimos 60 dias para que você possa
            navegar e testar todas as telas do sistema. Os dados são rastreados por ID e podem
            ser removidos com um clique — sem afetar dados reais.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando...
            </div>
          ) : stats ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Gerado em: <span className="font-medium text-foreground">{fmtDate(stats.geradoEm)}</span>
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Pedidos", value: stats.pedidos },
                  { label: "Cupons", value: stats.cupons },
                  { label: "Repasses", value: stats.repasses },
                ].map(k => (
                  <div key={k.label} className="rounded-md bg-card border border-border p-3">
                    <p className="text-2xl font-bold font-heading">{k.value}</p>
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum dado de teste no banco.
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleGenerate} disabled={generating || clearing}>
              {generating
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</>
                : <><RefreshCw className="mr-2 h-4 w-4" />Gerar dados de teste</>}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setConfirmClear(true)}
              disabled={clearing || generating || !stats}
            >
              {clearing
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Limpando...</>
                : <><Trash2 className="mr-2 h-4 w-4" />Limpar dados de teste</>}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Os dados de teste têm datas nos últimos 60 dias e não se misturam com pedidos reais.
            Lembre-se de limpar antes do lançamento oficial.
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar dados de teste?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá remover {stats?.pedidos} pedidos, {stats?.cupons} cupons e{" "}
              {stats?.repasses} repasses de teste. A ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sim, limpar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
