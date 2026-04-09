import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Trash2, Pencil, Upload, Loader2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CampanhaRow } from "@/pages/gestor/Campanhas";

interface Premio { id: string; nome: string; descricao: string; valor: number; ganhadores: number; }

function DatePicker({ value, onChange, label }: { value: Date | undefined; onChange: (d: Date | undefined) => void; label: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}>
            {value ? format(value, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campanha: CampanhaRow | null;
  onSaved: () => void;
}

export default function CampanhaFormDialog({ open, onOpenChange, campanha, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [isPrincipal, setIsPrincipal] = useState(false);
  const [status, setStatus] = useState("ativa");
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataEncerramento, setDataEncerramento] = useState<Date | undefined>();
  const [dataSorteio, setDataSorteio] = useState<Date | undefined>();
  const [horaSorteio, setHoraSorteio] = useState("20:00");
  const [valorCupom, setValorCupom] = useState(50);
  const [valorMinimo, setValorMinimo] = useState(30);
  const [limiteCuponsConsumidor, setLimiteCuponsConsumidor] = useState("");
  const [arredondamento, setArredondamento] = useState("baixo");
  const [premios, setPremios] = useState<Premio[]>([]);
  const [editPremioId, setEditPremioId] = useState<string | null>(null);
  const [totalCuponsSorteio, setTotalCuponsSorteio] = useState<number | "">("");
  const [bonusCadastroAtivo, setBonusCadastroAtivo] = useState(false);
  const [bonusCadastroCupons, setBonusCadastroCupons] = useState(10);
  const [bonusAniversarioAtivo, setBonusAniversarioAtivo] = useState(false);
  const [bonusAniversarioMultiplicador, setBonusAniversarioMultiplicador] = useState(2);
  const [bonusAniversarioTipoPedido, setBonusAniversarioTipoPedido] = useState<string | null>(null);
  const [percentualComissao, setPercentualComissao] = useState(15);
  const [tipoPrecificacao, setTipoPrecificacao] = useState("valor_fixo");
  const [adesaoPaga, setAdesaoPaga] = useState(false);
  const [valorAdesao, setValorAdesao] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (campanha) {
      setNome(campanha.nome);
      setDescricao(campanha.descricao || "");
      setIsPrincipal(campanha.is_principal);
      setStatus(campanha.status);
      setDataInicio(new Date(campanha.data_inicio));
      setDataEncerramento(new Date(campanha.data_encerramento));
      setDataSorteio(new Date(campanha.data_sorteio));
      setHoraSorteio(format(new Date(campanha.data_sorteio), "HH:mm"));
      setValorCupom(campanha.valor_por_cupom);
      setValorMinimo(campanha.valor_minimo_pedido);
      setLimiteCuponsConsumidor(campanha.limite_cupons_consumidor?.toString() || "");
      setArredondamento(campanha.arredondamento);
      // Load total cupons from sequencia_cupons
      const seq = (campanha as any).sequencia_cupons;
      setTotalCuponsSorteio(Array.isArray(seq) ? seq.length : "");
      setBonusCadastroAtivo((campanha as any).bonus_cadastro_ativo ?? false);
      setBonusCadastroCupons((campanha as any).bonus_cadastro_cupons ?? 10);
      setBonusAniversarioAtivo((campanha as any).bonus_aniversario_ativo ?? false);
      setBonusAniversarioMultiplicador((campanha as any).bonus_aniversario_multiplicador ?? 2);
      setBonusAniversarioTipoPedido((campanha as any).bonus_aniversario_tipo_pedido ?? null);
      setPercentualComissao((campanha as any).percentual_comissao ?? 15);
      setTipoPrecificacao((campanha as any).tipo_precificacao ?? "valor_fixo");
      setAdesaoPaga((campanha as any).adesao_paga ?? false);
      setValorAdesao((campanha as any).valor_adesao ?? 0);
      // Load premios
      supabase.from("premios").select("*").eq("campanha_id", campanha.id).order("posicao").then(({ data }) => {
        setPremios((data ?? []).map((p: any) => ({ id: p.id, nome: p.nome, descricao: p.descricao || "", valor: p.valor, ganhadores: p.quantidade_ganhadores })));
      });
    } else {
      setNome(""); setDescricao(""); setIsPrincipal(false); setStatus("ativa");
      setDataInicio(undefined); setDataEncerramento(undefined); setDataSorteio(undefined);
      setHoraSorteio("20:00"); setValorCupom(50); setValorMinimo(30);
      setLimiteCuponsConsumidor(""); setArredondamento("baixo"); setPremios([]);
      setTotalCuponsSorteio("");
      setBonusCadastroAtivo(false); setBonusCadastroCupons(10);
      setBonusAniversarioAtivo(false); setBonusAniversarioMultiplicador(2); setBonusAniversarioTipoPedido(null);
      setPercentualComissao(15); setTipoPrecificacao("valor_fixo"); setAdesaoPaga(false); setValorAdesao(0);
    }
  }, [open, campanha]);

  const addPremio = () => {
    const p: Premio = { id: crypto.randomUUID(), nome: "", descricao: "", valor: 0, ganhadores: 1 };
    setPremios(prev => [...prev, p]);
    setEditPremioId(p.id);
  };

  const handleSave = async () => {
    if (!nome.trim() || !dataInicio || !dataEncerramento || !dataSorteio) {
      toast.error("Preencha nome, datas de início, encerramento e sorteio.");
      return;
    }
    setSaving(true);
    try {
      const sorteioFull = new Date(dataSorteio);
      const [h, m] = horaSorteio.split(":").map(Number);
      sorteioFull.setHours(h, m, 0, 0);

      const payload: any = {
        nome,
        descricao: descricao || null,
        status,
        tipo: "principal",
        is_principal: isPrincipal,
        data_inicio: dataInicio.toISOString().slice(0, 10),
        data_encerramento: dataEncerramento.toISOString().slice(0, 10),
        data_sorteio: sorteioFull.toISOString(),
        valor_por_cupom: valorCupom,
        cupons_por_valor: 1,
        valor_minimo_pedido: valorMinimo,
        limite_cupons_consumidor: limiteCuponsConsumidor ? Number(limiteCuponsConsumidor) : null,
        arredondamento,
        bonus_cadastro_ativo: bonusCadastroAtivo,
        bonus_cadastro_cupons: bonusCadastroCupons,
        bonus_aniversario_ativo: bonusAniversarioAtivo,
        bonus_aniversario_multiplicador: bonusAniversarioMultiplicador,
        bonus_aniversario_tipo_pedido: bonusAniversarioTipoPedido,
        percentual_comissao: percentualComissao,
        tipo_precificacao: tipoPrecificacao,
        adesao_paga: adesaoPaga,
        valor_adesao: adesaoPaga ? valorAdesao : 0,
      };

      // Generate shuffled raffle sequence (Fisher-Yates) if totalCuponsSorteio is set
      if (totalCuponsSorteio && Number(totalCuponsSorteio) > 0) {
        const n = Number(totalCuponsSorteio);
        const arr = Array.from({ length: n }, (_, i) => i + 1);
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        payload.sequencia_cupons = arr;
      }

      let campanhaId: string;
      if (campanha) {
        const { error } = await supabase.from("campanhas").update(payload).eq("id", campanha.id);
        if (error) throw error;
        campanhaId = campanha.id;
      } else {
        const { data: newC, error } = await supabase.from("campanhas").insert(payload).select("id").single();
        if (error) throw error;
        campanhaId = newC.id;
      }

      // Sync premios
      await supabase.from("premios").delete().eq("campanha_id", campanhaId);
      if (premios.length > 0) {
        await supabase.from("premios").insert(premios.map((p, i) => ({
          campanha_id: campanhaId,
          nome: p.nome,
          descricao: p.descricao || null,
          valor: p.valor,
          quantidade_ganhadores: p.ganhadores,
          posicao: i + 1,
        })));
      }

      toast.success(campanha ? "Campanha atualizada!" : "Campanha criada!");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const previewCupom = useMemo(() => {
    if (valorCupom <= 0) return null;
    const pedido = 70;
    const cuponsExatos = pedido / valorCupom;
    const cupons = Math.floor(cuponsExatos);
    const saldo = (pedido - cupons * valorCupom);
    return { pedido, cupons, saldo, arredondamento };
  }, [valorCupom, arredondamento]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campanha ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
          <DialogDescription>Configure os dados da campanha principal.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Identity */}
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Pizza Premiada — Ciclo 1" /></div>
            <div className="space-y-1.5"><Label>Descrição</Label><Textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} /></div>
            <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/10 px-4 py-3">
              <div>
                <Label>Definir como Campanha Principal</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Todos os pedidos, cupons e usuários serão vinculados a esta campanha</p>
              </div>
              <Switch checked={isPrincipal} onCheckedChange={setIsPrincipal} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <div className="flex gap-2">
                {(["ativa", "pausada"] as const).map(s => (
                  <Button key={s} variant={status === s ? "default" : "outline"} size="sm" onClick={() => setStatus(s)}>{s.charAt(0).toUpperCase() + s.slice(1)}</Button>
                ))}
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <DatePicker value={dataInicio} onChange={setDataInicio} label="Data de início" />
            <DatePicker value={dataEncerramento} onChange={setDataEncerramento} label="Data de encerramento" />
            <DatePicker value={dataSorteio} onChange={setDataSorteio} label="Data do sorteio" />
            <div className="space-y-1.5"><Label className="text-sm text-muted-foreground">Hora do sorteio</Label><Input type="time" value={horaSorteio} onChange={e => setHoraSorteio(e.target.value)} /></div>
          </div>

          {/* Pricing & Commission */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tipo de precificação</Label>
              <div className="flex gap-2">
                <Button variant={tipoPrecificacao === "valor_fixo" ? "default" : "outline"} size="sm" onClick={() => setTipoPrecificacao("valor_fixo")}>Valor fixo (R$)</Button>
                <Button variant={tipoPrecificacao === "percentual" ? "default" : "outline"} size="sm" onClick={() => setTipoPrecificacao("percentual")}>Percentual (%)</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{tipoPrecificacao === "percentual" ? "Valor por cupom (%)" : "Valor por cupom (R$)"}</Label>
                <Input type="number" value={valorCupom} onChange={e => setValorCupom(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5"><Label>Valor mínimo do pedido (R$)</Label><Input type="number" value={valorMinimo} onChange={e => setValorMinimo(Number(e.target.value))} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Percentual de comissão da operação (%)</Label>
              <Input type="number" min="0" max="100" step="0.5" value={percentualComissao} onChange={e => setPercentualComissao(Number(e.target.value))} className="w-32" />
              <p className="text-xs text-muted-foreground">Percentual retido pela operação sobre as vendas (usado nos cálculos financeiros)</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-4 py-3">
              <div>
                <Label>Adesão paga</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Cobrar taxa de adesão das pizzarias participantes</p>
              </div>
              <Switch checked={adesaoPaga} onCheckedChange={setAdesaoPaga} />
            </div>
            {adesaoPaga && (
              <div className="space-y-1.5">
                <Label>Valor da adesão (R$)</Label>
                <Input type="number" min="0" step="0.01" value={valorAdesao} onChange={e => setValorAdesao(Number(e.target.value))} className="w-40" />
              </div>
            )}
            <div className="space-y-1.5"><Label>Limite de cupons por consumidor</Label><Input placeholder="Ilimitado" value={limiteCuponsConsumidor} onChange={e => setLimiteCuponsConsumidor(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Arredondamento</Label>
              <div className="flex gap-2">
                <Button variant={arredondamento === "baixo" ? "default" : "outline"} size="sm" onClick={() => setArredondamento("baixo")}>Para baixo</Button>
                <Button variant={arredondamento === "acumular" ? "default" : "outline"} size="sm" onClick={() => setArredondamento("acumular")}>Acumular saldo</Button>
              </div>
            </div>
            {previewCupom && (
              <div className="bg-secondary rounded-lg px-4 py-3 text-sm space-y-1">
                <p><strong>Preview:</strong> Um pedido de R${previewCupom.pedido} gera <span className="text-primary font-bold">{previewCupom.cupons} cupom(ns)</span></p>
                {previewCupom.saldo > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {previewCupom.arredondamento === "acumular"
                      ? `💰 Saldo de R$ ${previewCupom.saldo.toFixed(2)} será acumulado para o próximo pedido`
                      : `⬇️ Saldo de R$ ${previewCupom.saldo.toFixed(2)} será descartado (arredondamento para baixo)`}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Premios */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Prêmios</Label>
            {premios.map((p, idx) => (
              <div key={p.id} className="flex items-start gap-3 bg-secondary rounded-lg p-3">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">{idx + 1}º</div>
                <div className="flex-1 space-y-2">
                  {editPremioId === p.id ? (
                    <>
                      <Input placeholder="Nome do prêmio" value={p.nome} onChange={e => setPremios(prev => prev.map(x => x.id === p.id ? { ...x, nome: e.target.value } : x))} />
                      <Input placeholder="Descrição" value={p.descricao} onChange={e => setPremios(prev => prev.map(x => x.id === p.id ? { ...x, descricao: e.target.value } : x))} />
                      <div className="flex gap-2">
                        <Input type="number" placeholder="Valor R$" className="w-32" value={p.valor || ""} onChange={e => setPremios(prev => prev.map(x => x.id === p.id ? { ...x, valor: Number(e.target.value) } : x))} />
                        <Input type="number" placeholder="Ganhadores" className="w-28" value={p.ganhadores} onChange={e => setPremios(prev => prev.map(x => x.id === p.id ? { ...x, ganhadores: Number(e.target.value) } : x))} />
                      </div>
                      <Button size="sm" onClick={() => setEditPremioId(null)}>Concluir</Button>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">{p.nome || <span className="italic text-muted-foreground">Sem nome</span>}</p>
                      <p className="text-sm text-muted-foreground">R$ {p.valor.toLocaleString("pt-BR")} — {p.ganhadores} ganhador(es)</p>
                    </>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditPremioId(editPremioId === p.id ? null : p.id)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setPremios(prev => prev.filter(x => x.id !== p.id))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addPremio}><Plus className="mr-1 h-4 w-4" />Adicionar Prêmio</Button>
          </div>
          </div>

          {/* Subcampanhas Automáticas */}
          <div className="space-y-4 border-t border-border pt-4">
            <Label className="text-base font-semibold">Subcampanhas Automáticas</Label>

            {/* Bônus de Cadastro Completo */}
            <Card className="border-border bg-secondary/50">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">🎁 Bônus de Cadastro Completo</p>
                    <p className="text-xs text-muted-foreground">Concedido uma única vez quando o consumidor completa o cadastro</p>
                  </div>
                  <Switch checked={bonusCadastroAtivo} onCheckedChange={setBonusCadastroAtivo} />
                </div>
                {bonusCadastroAtivo && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cupons de bônus</Label>
                    <Input type="number" value={bonusCadastroCupons} onChange={e => setBonusCadastroCupons(Number(e.target.value))} className="w-32" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bônus de Aniversário */}
            <Card className="border-border bg-secondary/50">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">🎂 Bônus de Aniversário</p>
                    <p className="text-xs text-muted-foreground">Válido durante todo o mês de aniversário do consumidor</p>
                  </div>
                  <Switch checked={bonusAniversarioAtivo} onCheckedChange={setBonusAniversarioAtivo} />
                </div>
                {bonusAniversarioAtivo && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Multiplicador de cupons</Label>
                      <Input type="number" step="0.5" value={bonusAniversarioMultiplicador} onChange={e => setBonusAniversarioMultiplicador(Number(e.target.value))} className="w-32" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={!!bonusAniversarioTipoPedido} onCheckedChange={v => setBonusAniversarioTipoPedido(v ? "delivery" : null)} />
                      <Label className="text-xs">Restringir tipo de pedido</Label>
                    </div>
                    {bonusAniversarioTipoPedido && (
                      <Select value={bonusAniversarioTipoPedido} onValueChange={setBonusAniversarioTipoPedido}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="delivery">Delivery</SelectItem>
                          <SelectItem value="retirada">Retirada</SelectItem>
                          <SelectItem value="local">No local</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Raffle Config */}
          <div className="space-y-3 border-t border-border pt-4">
            <Label className="text-base font-semibold">Configurações do Sorteio</Label>
            <div className="space-y-1.5">
              <Label>Total de cupons disponíveis</Label>
              <Input
                type="number"
                placeholder="Ex: 200000"
                value={totalCuponsSorteio}
                onChange={e => setTotalCuponsSorteio(e.target.value ? Number(e.target.value) : "")}
              />
              <p className="text-xs text-muted-foreground">Ao salvar, o sistema gera uma sequência embaralhada (Fisher-Yates) de 1 até o total. Cada cupom recebe o próximo número disponível.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Regra de busca quando número não contemplado</Label>
              <div className="rounded-lg border border-border bg-secondary px-4 py-3 text-sm">
                <p className="font-medium">Alterna sobe/desce (+1, -1, +2, -2...)</p>
                <p className="text-xs text-muted-foreground mt-1">Se o número sorteado não corresponder a nenhum cupom ativo, o sistema busca alternadamente: +1, -1, +2, -2... até encontrar um cupom válido.</p>
              </div>
            </div>
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
