import { useState, useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CampanhaRow } from "@/pages/gestor/Campanhas";

interface PizzariaOption { id: string; nome: string; }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campanha: CampanhaRow | null;
  campanhasPrincipais: CampanhaRow[];
  onSaved: () => void;
}

export default function SubcampanhaFormDialog({ open, onOpenChange, campanha, campanhasPrincipais, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [campanhaPaiId, setCampanhaPaiId] = useState("");
  const [status, setStatus] = useState("ativa");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [multiplicador, setMultiplicador] = useState(1);
  const [cuponsExtras, setCuponsExtras] = useState(0);
  const [descontoMinimo, setDescontoMinimo] = useState(0);
  const [bonusIndicacao, setBonusIndicacao] = useState(0);
  const [todasPizzarias, setTodasPizzarias] = useState(true);
  const [pizzariasSelecionadas, setPizzariasSelecionadas] = useState<string[]>([]);
  const [pizzariasList, setPizzariasList] = useState<PizzariaOption[]>([]);

  const [useMultiplicador, setUseMultiplicador] = useState(false);
  const [useCuponsExtras, setUseCuponsExtras] = useState(false);
  const [useDesconto, setUseDesconto] = useState(false);
  const [useBonus, setUseBonus] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from("pizzarias").select("id, nome").eq("status", "ativa").then(({ data }) => {
      setPizzariasList((data ?? []) as PizzariaOption[]);
    });

    if (campanha && campanha.tipo === "subcampanha") {
      setNome(campanha.nome);
      setCampanhaPaiId(campanha.campanha_pai_id || "");
      setStatus(campanha.status);
      setPeriodoInicio(campanha.periodo_inicio ? campanha.periodo_inicio.slice(0, 16) : "");
      setPeriodoFim(campanha.periodo_fim ? campanha.periodo_fim.slice(0, 16) : "");
      setMultiplicador(campanha.multiplicador_cupons);
      setCuponsExtras(campanha.cupons_fixos_extras);
      setDescontoMinimo(campanha.desconto_valor_minimo);
      setBonusIndicacao(campanha.bonus_indicacao);
      setTodasPizzarias(!campanha.pizzarias_permitidas);
      setPizzariasSelecionadas(campanha.pizzarias_permitidas || []);
      setUseMultiplicador(campanha.multiplicador_cupons > 1);
      setUseCuponsExtras(campanha.cupons_fixos_extras > 0);
      setUseDesconto(campanha.desconto_valor_minimo > 0);
      setUseBonus(campanha.bonus_indicacao > 0);
    } else {
      setNome(""); setCampanhaPaiId(campanhasPrincipais[0]?.id || ""); setStatus("ativa");
      setPeriodoInicio(""); setPeriodoFim(""); setMultiplicador(2); setCuponsExtras(0);
      setDescontoMinimo(0); setBonusIndicacao(0); setTodasPizzarias(true);
      setPizzariasSelecionadas([]); setUseMultiplicador(true); setUseCuponsExtras(false);
      setUseDesconto(false); setUseBonus(false);
    }
  }, [open, campanha, campanhasPrincipais]);

  const parentCamp = campanhasPrincipais.find(c => c.id === campanhaPaiId);

  const preview = useMemo(() => {
    if (!parentCamp) return null;
    const pedido = 70;
    const valorCupom = parentCamp.valor_por_cupom;
    if (valorCupom <= 0) return null;
    let cuponsBase = Math.floor(pedido / valorCupom);
    let extras = 0;
    if (useMultiplicador && multiplicador > 1) cuponsBase = Math.ceil(cuponsBase * multiplicador);
    if (useCuponsExtras) extras = cuponsExtras;
    return { pedido, base: Math.floor(pedido / valorCupom), extras, total: cuponsBase + extras };
  }, [parentCamp, useMultiplicador, multiplicador, useCuponsExtras, cuponsExtras]);

  const handleSave = async () => {
    if (!nome.trim() || !campanhaPaiId) {
      toast.error("Preencha o nome e selecione a campanha principal.");
      return;
    }
    setSaving(true);
    try {
      // Need data_inicio and data_encerramento from parent
      const parent = campanhasPrincipais.find(c => c.id === campanhaPaiId);
      const payload: any = {
        nome,
        tipo: "subcampanha",
        status,
        campanha_pai_id: campanhaPaiId,
        data_inicio: parent?.data_inicio || new Date().toISOString().slice(0, 10),
        data_encerramento: parent?.data_encerramento || new Date().toISOString().slice(0, 10),
        data_sorteio: parent?.data_sorteio || new Date().toISOString(),
        valor_por_cupom: parent?.valor_por_cupom || 50,
        valor_minimo_pedido: parent?.valor_minimo_pedido || 0,
        periodo_inicio: periodoInicio ? new Date(periodoInicio).toISOString() : null,
        periodo_fim: periodoFim ? new Date(periodoFim).toISOString() : null,
        multiplicador_cupons: useMultiplicador ? multiplicador : 1,
        cupons_fixos_extras: useCuponsExtras ? cuponsExtras : 0,
        desconto_valor_minimo: useDesconto ? descontoMinimo : 0,
        bonus_indicacao: useBonus ? bonusIndicacao : 0,
        pizzarias_permitidas: todasPizzarias ? null : pizzariasSelecionadas,
        is_principal: false,
      };

      if (campanha && campanha.tipo === "subcampanha") {
        const { error } = await supabase.from("campanhas").update(payload).eq("id", campanha.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("campanhas").insert(payload);
        if (error) throw error;
      }

      toast.success(campanha ? "Subcampanha atualizada!" : "Subcampanha criada!");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const togglePizzaria = (id: string) => {
    setPizzariasSelecionadas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campanha?.tipo === "subcampanha" ? "Editar Subcampanha" : "Nova Subcampanha"}</DialogTitle>
          <DialogDescription>Configure uma promoção especial vinculada a uma campanha principal.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-1.5"><Label>Nome da subcampanha</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Dobro de Cupons — Fim de Semana" /></div>

          <div className="space-y-1.5">
            <Label>Campanha principal vinculada</Label>
            <Select value={campanhaPaiId} onValueChange={setCampanhaPaiId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {campanhasPrincipais.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <div className="flex gap-2">
              {(["ativa", "pausada"] as const).map(s => (
                <Button key={s} variant={status === s ? "default" : "outline"} size="sm" onClick={() => setStatus(s)}>{s.charAt(0).toUpperCase() + s.slice(1)}</Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Início do período</Label><Input type="datetime-local" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Fim do período</Label><Input type="datetime-local" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} /></div>
          </div>

          {/* Benefits */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Benefícios</Label>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Multiplicador de cupons</Label>
                <Switch checked={useMultiplicador} onCheckedChange={setUseMultiplicador} />
              </div>
              {useMultiplicador && (
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} step={0.5} className="w-24" value={multiplicador} onChange={e => setMultiplicador(Number(e.target.value))} />
                  <span className="text-sm text-muted-foreground">× cupons (ex: 2 = dobro)</span>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Cupons fixos extras por pedido</Label>
                <Switch checked={useCuponsExtras} onCheckedChange={setUseCuponsExtras} />
              </div>
              {useCuponsExtras && (
                <Input type="number" min={0} className="w-24" value={cuponsExtras} onChange={e => setCuponsExtras(Number(e.target.value))} />
              )}
            </div>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Desconto no valor mínimo (R$)</Label>
                <Switch checked={useDesconto} onCheckedChange={setUseDesconto} />
              </div>
              {useDesconto && (
                <Input type="number" min={0} step={0.01} className="w-32" value={descontoMinimo} onChange={e => setDescontoMinimo(Number(e.target.value))} />
              )}
            </div>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Bônus por indicação</Label>
                <Switch checked={useBonus} onCheckedChange={setUseBonus} />
              </div>
              {useBonus && (
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} className="w-24" value={bonusIndicacao} onChange={e => setBonusIndicacao(Number(e.target.value))} />
                  <span className="text-sm text-muted-foreground">cupons extras por indicação</span>
                </div>
              )}
            </div>
          </div>

          {/* Pizzarias */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Pizzarias participantes</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Todas</span>
                <Switch checked={todasPizzarias} onCheckedChange={setTodasPizzarias} />
              </div>
            </div>
            {!todasPizzarias && (
              <div className="max-h-40 overflow-y-auto space-y-2 rounded-lg border border-border p-3">
                {pizzariasList.map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    <Checkbox checked={pizzariasSelecionadas.includes(p.id)} onCheckedChange={() => togglePizzaria(p.id)} />
                    <span className="text-sm">{p.nome}</span>
                  </div>
                ))}
                {pizzariasList.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pizzaria ativa.</p>}
              </div>
            )}
          </div>

          {/* Preview */}
          {preview && (
            <div className="bg-secondary rounded-lg px-4 py-3 text-sm">
              <strong>Preview:</strong> Um pedido de R${preview.pedido} gera{" "}
              <span className="text-primary font-bold">{preview.base} cupons (base)</span>
              {preview.extras > 0 && <> + <span className="text-blue-500 font-bold">{preview.extras} extras</span></>}
              {" "}= <span className="font-bold text-primary">{preview.total} total</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
