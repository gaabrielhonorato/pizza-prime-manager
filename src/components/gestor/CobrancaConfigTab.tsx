import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, CalendarClock, Clock } from "lucide-react";

const DIAS = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
];

const PRAZOS = Array.from({ length: 14 }, (_, i) => i + 1).map(n => ({
  value: String(n),
  label: n === 1 ? "1 dia" : `${n} dias`,
}));

export default function CobrancaConfigTab() {
  const [configId, setConfigId] = useState<string | null>(null);
  const [diaSemana, setDiaSemana] = useState("1");
  const [prazoDias, setPrazoDias] = useState("3");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("configuracoes_cobranca")
      .select("id, dia_semana, prazo_dias")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setConfigId(data.id);
          setDiaSemana(String(data.dia_semana));
          setPrazoDias(String(data.prazo_dias));
        }
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const payload = {
      dia_semana: Number(diaSemana),
      prazo_dias: Number(prazoDias),
      atualizado_em: new Date().toISOString(),
    };
    const { error } = configId
      ? await supabase.from("configuracoes_cobranca").update(payload).eq("id", configId)
      : await supabase.from("configuracoes_cobranca").insert(payload);

    setSaving(false);
    if (error) toast.error(`Erro ao salvar: ${error.message}`);
    else toast.success("Configurações de cobrança salvas!");
  };

  const diaLabel = DIAS.find(d => d.value === diaSemana)?.label ?? "";
  const prazoNum = Number(prazoDias);
  const exemploVenc = (() => {
    const hoje = new Date();
    const result = new Date(hoje);
    result.setDate(hoje.getDate() + prazoNum);
    return result.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  })();

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h3 className="text-base font-semibold font-heading">Configuração de Cobrança</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Define o dia padrão de emissão de boletos e o prazo de vencimento. Essas configurações
          são aplicadas automaticamente ao emitir boletos via Asaas.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="pt-5 pb-5 space-y-5">

          {/* Dia da semana para emissão */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <CalendarClock className="h-4 w-4 text-primary" />
              Dia da semana para emitir boletos
            </Label>
            <Select value={diaSemana} onValueChange={setDiaSemana}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIAS.map(d => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Referência para o operador saber qual dia emitir os boletos semanalmente.
            </p>
          </div>

          {/* Prazo de vencimento */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-primary" />
              Prazo de vencimento após emissão
            </Label>
            <Select value={prazoDias} onValueChange={setPrazoDias}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRAZOS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O boleto gerado hoje vencerá em{" "}
              <span className="font-medium text-foreground">{prazoNum} dia{prazoNum !== 1 ? "s" : ""}</span>.
            </p>
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Exemplo com as configurações atuais</p>
            <p className="text-sm">
              Boletos emitidos toda{" "}
              <span className="font-semibold text-foreground">{diaLabel}</span>{" "}
              vencem em{" "}
              <span className="font-semibold text-foreground">{exemploVenc}</span>
              {" "}({prazoNum} dia{prazoNum !== 1 ? "s" : ""} após a emissão).
            </p>
          </div>

        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="gap-2">
        <Save className="h-4 w-4" />
        {saving ? "Salvando…" : "Salvar configurações"}
      </Button>
    </div>
  );
}
