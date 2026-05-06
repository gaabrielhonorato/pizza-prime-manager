import { useState, useEffect } from "react";
import { Trophy, Calendar, Ticket, Search as SearchIcon, CheckCircle2, RotateCcw, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePizzarias } from "@/contexts/PizzariasContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import ExportButton from "@/components/gestor/ExportButton";

const NUM_SERIES = 5;
const ELEMENTOS_POR_SERIE = 100000;

const trophyColors = ["text-yellow-400", "text-gray-400", "text-orange-600"];

// Recalcula a série de um número sequencial de cupom
const serieDoNumero = (n: number | null): number =>
  n !== null && n > 0 ? Math.floor((n - 1) / ELEMENTOS_POR_SERIE) : 0;

interface PremioData {
  id: string;
  posicao: number;
  nome: string;
  descricao: string | null;
  valor: number;
  ganhadores: number;
  ganhadorConsumidorId: string | null;
  numeroSorteadoLoteria: number | null;
  numeroCupomContemplado: number | null;
  confirmadoEm: string | null;
}

interface CampanhaData {
  id: string;
  nome: string;
  dataInicio: string;
  dataEncerramento: string;
  dataSorteio: string;
}

interface PizzariaCupons {
  pizzariaId: string;
  nome: string;
  cidade: string;
  cupons: number;
}

export default function Sorteio() {
  const { pizzarias } = usePizzarias();
  const [premios, setPremios] = useState<PremioData[]>([]);
  const [campanha, setCampanha] = useState<CampanhaData | null>(null);
  const [campanhaId, setCampanhaId] = useState<string>("");
  const [pizzariaCupons, setPizzariaCupons] = useState<PizzariaCupons[]>([]);
  const [loading, setLoading] = useState(true);

  // Seleção de prêmio
  const [selectedPremio, setSelectedPremio] = useState("");

  // Calculadora da Loteria Federal (5 campos, um por prêmio da extração)
  const [loteriaPremios, setLoteriaPremios] = useState(["", "", "", "", ""]);
  const [serieConfirmada, setSerieConfirmada] = useState<number | null>(null);
  const [elementoConfirmado, setElementoConfirmado] = useState<number | null>(null);

  // Sorteio
  const [buscando, setBuscando] = useState(false);
  const [logBusca, setLogBusca] = useState<string[]>([]);
  const [ganhadorEncontrado, setGanhadorEncontrado] = useState<{
    consumidorId: string; nome: string; telefone: string; pizzaria: string;
    cupons: number; numeroCupom: number; cadastroCompleto: boolean;
  } | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  // Reset de ciclo
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: campData } = await supabase
        .from("campanhas")
        .select("*")
        .eq("is_principal", true)
        .limit(1)
        .single();

      if (campData) {
        setCampanhaId(campData.id);
        setCampanha({
          id: campData.id,
          nome: campData.nome,
          dataInicio: campData.data_inicio,
          dataEncerramento: campData.data_encerramento,
          dataSorteio: typeof campData.data_sorteio === "string" ? campData.data_sorteio : "",
        });

        const { data: premiosData } = await supabase
          .from("premios")
          .select("*")
          .eq("campanha_id", campData.id)
          .order("posicao", { ascending: true });

        setPremios((premiosData ?? []).map((p: any) => ({
          id: p.id,
          posicao: p.posicao,
          nome: p.nome,
          descricao: p.descricao,
          valor: Number(p.valor),
          ganhadores: p.quantidade_ganhadores,
          ganhadorConsumidorId: p.ganhador_consumidor_id,
          numeroSorteadoLoteria: p.numero_sorteado_loteria,
          numeroCupomContemplado: p.numero_cupom_contemplado,
          confirmadoEm: p.confirmado_em,
        })));

        const { data: cuponsData } = await supabase
          .from("cupons")
          .select("quantidade, status, pedido_id, pedidos!inner(pizzaria_id)")
          .eq("campanha_id", campData.id);

        const cuponsMap = new Map<string, number>();
        cuponsData?.forEach((c: any) => {
          if (c.status === "validado" || c.status === "pendente") {
            const pid = c.pedidos?.pizzaria_id;
            if (pid) cuponsMap.set(pid, (cuponsMap.get(pid) ?? 0) + c.quantidade);
          }
        });

        const ativas = pizzarias.filter(p => p.status === "Ativa");
        setPizzariaCupons(ativas.map(p => ({
          pizzariaId: p.id,
          nome: p.nome,
          cidade: p.cidade,
          cupons: cuponsMap.get(p.id) ?? 0,
        })).sort((a, b) => b.cupons - a.cupons));
      }
      setLoading(false);
    };
    fetchData();
  }, [pizzarias]);

  // ─── Cálculo automático da calculadora SCPC ───────────────────────────────
  const loteiraDigits = loteriaPremios.map(v => {
    const n = parseInt(v.replace(/\D/g, ""), 10);
    return isNaN(n) ? null : n;
  });
  const dezenaP1 = loteiraDigits[0] !== null ? Math.floor(loteiraDigits[0] / 10) % 10 : null;
  const serieCalculada = dezenaP1 !== null ? dezenaP1 % NUM_SERIES : null;
  const elementoDigits = loteiraDigits.map(n => n !== null ? n % 10 : null);
  const elementoStr = elementoDigits.every(d => d !== null) ? elementoDigits.join("") : null;
  const elementoCalculado = elementoStr !== null
    ? (parseInt(elementoStr, 10) === 0 ? ELEMENTOS_POR_SERIE : parseInt(elementoStr, 10))
    : null;
  const calculadoraValida = serieCalculada !== null && elementoCalculado !== null;

  // ─── Buscar ganhador usando série + elemento ──────────────────────────────
  const handleFindWinner = async () => {
    if (!selectedPremio) {
      toast({ title: "Selecione o prêmio a sortear", variant: "destructive" });
      return;
    }
    if (serieConfirmada === null || elementoConfirmado === null) {
      toast({ title: "Confirme os números da Loteria Federal primeiro", variant: "destructive" });
      return;
    }

    setBuscando(true);
    setLogBusca([]);
    setGanhadorEncontrado(null);

    const { data: cuponsValidados } = await supabase
      .from("cupons")
      .select("id, quantidade, consumidor_id")
      .eq("campanha_id", campanhaId)
      .eq("status", "validado");

    if (!cuponsValidados || cuponsValidados.length === 0) {
      setLogBusca(["Nenhum cupom validado encontrado na campanha."]);
      setBuscando(false);
      return;
    }

    // Exclui consumidores que já ganharam e monta mapa sequencial
    const wonIds = premios
      .filter(p => p.ganhadorConsumidorId)
      .map(p => p.ganhadorConsumidorId!);

    const consumidorCupons = new Map<string, number[]>();
    let currentNum = 1;
    for (const c of cuponsValidados) {
      if (wonIds.includes(c.consumidor_id)) continue;
      const nums: number[] = [];
      for (let i = 0; i < c.quantidade; i++) {
        nums.push(currentNum++);
      }
      const existing = consumidorCupons.get(c.consumidor_id) ?? [];
      consumidorCupons.set(c.consumidor_id, [...existing, ...nums]);
    }

    const numToConsumidor = new Map<number, string>();
    for (const [cid, nums] of consumidorCupons.entries()) {
      for (const n of nums) {
        numToConsumidor.set(n, cid);
      }
    }

    // Limites da série ganhadora no espaço sequencial
    const serieStart = serieConfirmada * ELEMENTOS_POR_SERIE + 1;
    const serieEnd = (serieConfirmada + 1) * ELEMENTOS_POR_SERIE;
    const targetSeq = serieConfirmada * ELEMENTOS_POR_SERIE + elementoConfirmado;

    const logs: string[] = [
      `Série ganhadora: ${serieConfirmada} (cupons ${serieStart.toLocaleString("pt-BR")} a ${serieEnd.toLocaleString("pt-BR")})`,
      `Elemento na série: ${elementoConfirmado.toLocaleString("pt-BR")} → cupom alvo: ${targetSeq.toLocaleString("pt-BR")}`,
    ];

    // Busca restrita à série ganhadora
    const tryNumber = (n: number): string | null => {
      if (n < serieStart || n > serieEnd) return null;
      return numToConsumidor.get(n) ?? null;
    };

    let foundConsumidorId: string | null = null;
    let foundNum = targetSeq;

    foundConsumidorId = tryNumber(targetSeq);
    if (foundConsumidorId) {
      logs.push(`Cupom ${targetSeq} encontrado!`);
    } else {
      logs.push(`Cupom ${targetSeq} não distribuído. Buscando mais próximo na série ${serieConfirmada}...`);
      for (let delta = 1; delta <= ELEMENTOS_POR_SERIE; delta++) {
        const up = targetSeq + delta;
        const upResult = tryNumber(up);
        if (upResult) {
          logs.push(`Tentando ${up} → encontrado!`);
          foundConsumidorId = upResult;
          foundNum = up;
          break;
        } else if (up <= serieEnd) {
          logs.push(`Tentando ${up} → não distribuído`);
        }
        const down = targetSeq - delta;
        const downResult = tryNumber(down);
        if (downResult) {
          logs.push(`Tentando ${down} → encontrado!`);
          foundConsumidorId = downResult;
          foundNum = down;
          break;
        } else if (down >= serieStart) {
          logs.push(`Tentando ${down} → não distribuído`);
        }
      }
    }

    setLogBusca(logs);

    if (foundConsumidorId) {
      const { data: consData } = await supabase
        .from("consumidores")
        .select("id, usuario_id, pizzaria_id, cadastro_completo, usuarios(nome, telefone)")
        .eq("id", foundConsumidorId)
        .single();

      const { data: cuponsCount } = await supabase
        .from("cupons")
        .select("quantidade")
        .eq("consumidor_id", foundConsumidorId)
        .eq("campanha_id", campanhaId);

      const totalCupons = cuponsCount?.reduce((s, c) => s + c.quantidade, 0) ?? 0;
      const pizzNome = pizzarias.find(p => p.id === (consData as any)?.pizzaria_id)?.nome ?? "—";

      setGanhadorEncontrado({
        consumidorId: foundConsumidorId,
        nome: (consData as any)?.usuarios?.nome ?? "Desconhecido",
        telefone: (consData as any)?.usuarios?.telefone ?? "—",
        pizzaria: pizzNome,
        cupons: totalCupons,
        numeroCupom: foundNum,
        cadastroCompleto: (consData as any)?.cadastro_completo ?? false,
      });
    }

    setBuscando(false);
  };

  const handleConfirmWinner = async () => {
    if (!ganhadorEncontrado || !selectedPremio) return;
    setConfirmando(true);
    const { error } = await supabase.from("premios").update({
      ganhador_consumidor_id: ganhadorEncontrado.consumidorId,
      numero_sorteado_loteria: elementoConfirmado ?? ganhadorEncontrado.numeroCupom,
      numero_cupom_contemplado: ganhadorEncontrado.numeroCupom,
      confirmado_em: new Date().toISOString(),
    } as any).eq("id", selectedPremio);

    if (error) {
      toast({ title: "Erro ao confirmar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ganhador confirmado com sucesso!" });
      setPremios(prev => prev.map(p => p.id === selectedPremio ? {
        ...p,
        ganhadorConsumidorId: ganhadorEncontrado.consumidorId,
        numeroSorteadoLoteria: elementoConfirmado ?? ganhadorEncontrado.numeroCupom,
        numeroCupomContemplado: ganhadorEncontrado.numeroCupom,
        confirmadoEm: new Date().toISOString(),
      } : p));
      setGanhadorEncontrado(null);
      setLogBusca([]);
      setLoteriaPremios(["", "", "", "", ""]);
      setSerieConfirmada(null);
      setElementoConfirmado(null);
      setSelectedPremio("");
    }
    setConfirmando(false);
  };

  const handleCycleReset = async () => {
    if (!campanhaId || !campanha) return;
    setResetting(true);
    try {
      await supabase.from("campanhas").update({ status: "encerrada" } as any).eq("id", campanhaId);
      await supabase.from("cupons").update({ status: "expirado" } as any).eq("campanha_id", campanhaId);

      const { count: consCount } = await supabase.from("consumidores").select("id", { count: "exact", head: true }).eq("campanha_id", campanhaId).eq("cadastro_completo", true);
      const { count: pizzCount } = await supabase.from("pizzarias").select("id", { count: "exact", head: true }).eq("status", "ativa");

      const { data: oldCamp } = await supabase.from("campanhas").select("*").eq("id", campanhaId).single();
      if (oldCamp) {
        const newPayload: any = {
          nome: `${oldCamp.nome} — Novo Ciclo`,
          descricao: oldCamp.descricao,
          status: "pausada",
          tipo: "principal",
          is_principal: false,
          data_inicio: new Date().toISOString().slice(0, 10),
          data_encerramento: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          data_sorteio: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
          valor_por_cupom: oldCamp.valor_por_cupom,
          cupons_por_valor: oldCamp.cupons_por_valor,
          valor_minimo_pedido: oldCamp.valor_minimo_pedido,
          arredondamento: oldCamp.arredondamento,
          taxa_delivery: oldCamp.taxa_delivery,
          taxa_retirada: oldCamp.taxa_retirada,
          taxa_local: oldCamp.taxa_local,
          percentual_comissao: oldCamp.percentual_comissao,
          tipo_precificacao: oldCamp.tipo_precificacao,
        };
        await supabase.from("campanhas").insert(newPayload);
      }

      toast({
        title: "Ciclo encerrado com sucesso!",
        description: `${consCount ?? 0} consumidores mantidos. ${pizzCount ?? 0} pizzarias mantidas. Nova campanha criada como rascunho.`,
      });

      window.location.reload();
    } catch (err: any) {
      toast({ title: "Erro ao encerrar ciclo", description: err.message, variant: "destructive" });
    }
    setResetting(false);
    setShowResetDialog(false);
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando dados do sorteio...</div>;

  const premiosDisponiveis = premios.filter(p => !p.ganhadorConsumidorId);
  const todosPremiados = premios.length > 0 && premiosDisponiveis.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Sorteio</h1>
        <div className="flex gap-2">
          {todosPremiados && (
            <Button variant="destructive" onClick={() => setShowResetDialog(true)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Encerrar ciclo e iniciar próximo
            </Button>
          )}
          <ExportButton
            data={pizzariaCupons.map((p, i) => ({
              posicao: i + 1, nome: p.nome, cidade: p.cidade, cupons: p.cupons,
            }))}
            columns={[
              { key: "posicao", label: "#" }, { key: "nome", label: "Pizzaria" },
              { key: "cidade", label: "Cidade" }, { key: "cupons", label: "Total Cupons" },
            ]}
            fileName="sorteio-participantes"
          />
        </div>
      </div>

      {/* Cards de prêmios — grid adaptativo */}
      {premios.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum prêmio configurado. Configure os prêmios nas Campanhas.
          </CardContent>
        </Card>
      ) : (
        <div className={`grid gap-4 ${premios.length <= 3 ? "sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
          {premios.map((p, i) => (
            <Card key={p.id} className="border-border bg-card">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Trophy className={`h-6 w-6 ${trophyColors[i] ?? "text-primary"}`} />
                <CardTitle className="text-lg font-heading">{p.posicao}º Prêmio</CardTitle>
                {p.confirmadoEm && <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))] ml-auto" />}
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{p.nome}</p>
                {p.descricao && <p className="text-sm text-muted-foreground mt-1">{p.descricao}</p>}
                <p className="mt-1 font-heading text-lg text-primary">R$ {p.valor.toLocaleString("pt-BR")}</p>
                {p.ganhadores > 1 && <p className="text-xs text-muted-foreground">{p.ganhadores} ganhadores</p>}
                {p.confirmadoEm && (
                  <div className="mt-2 rounded-md bg-[hsl(var(--success))]/10 border border-[hsl(var(--success))]/30 px-3 py-2 text-xs">
                    <p className="font-medium text-[hsl(var(--success))]">🏆 Ganhador confirmado</p>
                    <p className="text-muted-foreground">
                      Série {serieDoNumero(p.numeroCupomContemplado)} | Cupom nº {p.numeroCupomContemplado} | Loteria nº {p.numeroSorteadoLoteria}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cronograma */}
      {campanha && (
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="font-heading">Cronograma — {campanha.nome}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-sm">
              <div><span className="text-muted-foreground">Início:</span>{" "}<span className="font-medium">{format(new Date(campanha.dataInicio), "dd/MM/yyyy")}</span></div>
              <div><span className="text-muted-foreground">Encerramento:</span>{" "}<span className="font-medium">{format(new Date(campanha.dataEncerramento), "dd/MM/yyyy")}</span></div>
              <div><span className="text-muted-foreground">Sorteio:</span>{" "}<span className="font-medium">{format(new Date(campanha.dataSorteio), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Realizar Sorteio */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center gap-3">
          <Trophy className="h-5 w-5 text-primary" />
          <CardTitle className="font-heading">Realizar Sorteio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {premiosDisponiveis.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos os prêmios já foram sorteados.</p>
          ) : (
            <>
              {/* ── Calculadora SCPC ── */}
              <div className="space-y-3 rounded-lg border border-border bg-secondary/40 p-4">
                <div className="flex items-start gap-2 text-sm">
                  <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Regra SCPC — Assemelhado a Sorteio ({NUM_SERIES} séries de {ELEMENTOS_POR_SERIE.toLocaleString("pt-BR")} cada)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Insira os 5 prêmios do concurso da Loteria Federal (Caixa Econômica Federal).
                      A <strong>série ganhadora</strong> é a dezena do 1º prêmio mod {NUM_SERIES}.
                      O <strong>número na série</strong> é o último dígito de cada prêmio do 1º ao 5º, concatenados.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {["1º", "2º", "3º", "4º", "5º"].map((label, idx) => (
                    <div key={idx} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{label} Prêmio</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="Ex: 54201"
                        value={loteriaPremios[idx]}
                        onChange={e => {
                          const next = [...loteriaPremios];
                          next[idx] = e.target.value;
                          setLoteriaPremios(next);
                          // Resetar confirmação se os valores mudarem
                          setSerieConfirmada(null);
                          setElementoConfirmado(null);
                          setGanhadorEncontrado(null);
                          setLogBusca([]);
                        }}
                        className="text-center text-sm"
                      />
                    </div>
                  ))}
                </div>

                {calculadoraValida && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/30 bg-background px-3 py-2">
                    <div className="flex gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">Série ganhadora:</span>{" "}
                        <span className="font-heading font-bold text-primary text-base">{serieCalculada}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Número na série:</span>{" "}
                        <span className="font-heading font-bold text-primary text-base">
                          {elementoCalculado?.toLocaleString("pt-BR")}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-primary/50 text-primary hover:bg-primary/10"
                      onClick={() => {
                        setSerieConfirmada(serieCalculada);
                        setElementoConfirmado(elementoCalculado);
                      }}
                    >
                      Confirmar e usar estes dados →
                    </Button>
                  </div>
                )}

                {serieConfirmada !== null && elementoConfirmado !== null && (
                  <div className="flex items-center gap-2 text-xs font-medium text-[hsl(var(--success))]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Confirmado: Série {serieConfirmada}, elemento {elementoConfirmado.toLocaleString("pt-BR")}
                  </div>
                )}
              </div>

              {/* ── Seleção de prêmio e busca ── */}
              <div className="space-y-1.5">
                <Label>Prêmio a sortear</Label>
                <Select value={selectedPremio} onValueChange={setSelectedPremio}>
                  <SelectTrigger className="max-w-sm">
                    <SelectValue placeholder="Selecione o prêmio" />
                  </SelectTrigger>
                  <SelectContent>
                    {premiosDisponiveis.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.posicao}º — {p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleFindWinner}
                disabled={buscando || serieConfirmada === null || !selectedPremio}
              >
                <SearchIcon className="mr-2 h-4 w-4" />
                {buscando ? "Buscando..." : "Buscar Ganhador"}
              </Button>

              {/* Log de busca */}
              {logBusca.length > 0 && (
                <div className="rounded-lg border border-border bg-secondary p-4 space-y-1 max-h-[200px] overflow-y-auto">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Log de busca:</p>
                  {logBusca.map((log, i) => (
                    <p
                      key={i}
                      className={`text-xs ${log.includes("encontrado!") ? "text-[hsl(var(--success))] font-medium" : "text-muted-foreground"}`}
                    >
                      {log}
                    </p>
                  ))}
                </div>
              )}

              {/* Card do ganhador */}
              {ganhadorEncontrado && (
                <Card className={`border-primary/40 ${ganhadorEncontrado.cadastroCompleto ? "bg-primary/5" : "bg-[hsl(var(--warning))]/10 border-[hsl(var(--warning))]/40"}`}>
                  <CardContent className="p-4 space-y-3">
                    <p className="font-heading font-bold text-lg">
                      {ganhadorEncontrado.cadastroCompleto ? "🏆 Ganhador Encontrado!" : "⚠️ Ganhador Encontrado — Cadastro Incompleto"}
                    </p>
                    {!ganhadorEncontrado.cadastroCompleto && (
                      <div className="rounded-md bg-[hsl(var(--warning))]/20 border border-[hsl(var(--warning))]/30 px-3 py-2 text-sm flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))] mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">Consumidor sem cadastro completo.</p>
                          <p className="text-xs text-muted-foreground mt-1">O prêmio fica retido até o consumidor completar o cadastro em até 30 dias. Após esse prazo, o sistema passa automaticamente para o próximo número.</p>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{ganhadorEncontrado.nome}</span></div>
                      <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{ganhadorEncontrado.telefone}</span></div>
                      <div><span className="text-muted-foreground">Pizzaria:</span> <span className="font-medium">{ganhadorEncontrado.pizzaria}</span></div>
                      <div><span className="text-muted-foreground">Total de cupons:</span> <span className="font-bold text-primary">{ganhadorEncontrado.cupons}</span></div>
                      <div><span className="text-muted-foreground">Cupom nº:</span> <span className="font-bold">{ganhadorEncontrado.numeroCupom}</span></div>
                      <div>
                        <span className="text-muted-foreground">Série:</span>{" "}
                        <span className="font-bold">{serieDoNumero(ganhadorEncontrado.numeroCupom)}</span>
                      </div>
                      <div><span className="text-muted-foreground">Cadastro:</span> <Badge variant={ganhadorEncontrado.cadastroCompleto ? "default" : "secondary"}>{ganhadorEncontrado.cadastroCompleto ? "Completo" : "Pendente"}</Badge></div>
                    </div>
                    <Button onClick={handleConfirmWinner} disabled={confirmando} className="mt-2">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {confirmando ? "Confirmando..." : ganhadorEncontrado.cadastroCompleto ? "Confirmar Ganhador" : "Confirmar (prêmio retido até cadastro)"}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Pizzarias Participantes */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center gap-3">
          <Ticket className="h-5 w-5 text-primary" />
          <CardTitle className="font-heading">Pizzarias Participantes</CardTitle>
          <Badge variant="secondary" className="ml-auto">{pizzariaCupons.length} ativas</Badge>
        </CardHeader>
        <CardContent>
          {pizzariaCupons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pizzaria ativa.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pizzaria</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead className="text-right">Cupons Acumulados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pizzariaCupons.map((p) => (
                  <TableRow key={p.pizzariaId}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>{p.cidade}</TableCell>
                    <TableCell className="text-right font-heading font-bold text-primary">{p.cupons}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de encerramento de ciclo */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar ciclo e iniciar próximo?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Esta ação irá:</p>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>Marcar a campanha atual como <strong>encerrada</strong></li>
                <li>Expirar todos os cupons (mantendo o histórico)</li>
                <li>Manter todos os consumidores com cadastro completo</li>
                <li>Manter todas as pizzarias ativas</li>
                <li>Criar uma nova campanha como rascunho</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-3">O banco de dados histórico é preservado integralmente — nada é deletado.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCycleReset} disabled={resetting}>
              {resetting ? "Encerrando..." : "Confirmar encerramento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
