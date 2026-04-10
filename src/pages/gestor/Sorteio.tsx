import { useState, useEffect } from "react";
import { Trophy, Calendar, Ticket, Search as SearchIcon, CheckCircle2 } from "lucide-react";
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
import { usePizzarias } from "@/contexts/PizzariasContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import ExportButton from "@/components/gestor/ExportButton";

const trophyColors = ["text-yellow-400", "text-gray-400", "text-orange-600"];

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

  // Raffle state
  const [selectedPremio, setSelectedPremio] = useState("");
  const [numeroLoteria, setNumeroLoteria] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [logBusca, setLogBusca] = useState<string[]>([]);
  const [ganhadorEncontrado, setGanhadorEncontrado] = useState<{
    consumidorId: string; nome: string; telefone: string; pizzaria: string; cupons: number; numeroCupom: number;
  } | null>(null);
  const [confirmando, setConfirmando] = useState(false);

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

  const handleFindWinner = async () => {
    if (!selectedPremio || !numeroLoteria) {
      toast({ title: "Selecione o prêmio e informe o número", variant: "destructive" });
      return;
    }
    const num = Number(numeroLoteria);
    if (isNaN(num) || num < 1) {
      toast({ title: "Número inválido", variant: "destructive" });
      return;
    }

    setBuscando(true);
    setLogBusca([]);
    setGanhadorEncontrado(null);

    // Get all validated cupons for this campaign
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

    // Get already won consumer IDs
    const wonIds = premios
      .filter(p => p.ganhadorConsumidorId)
      .map(p => p.ganhadorConsumidorId!);

    // Build a set of valid coupon numbers (simplified: each coupon row = range of numbers)
    // For simplicity, we map consumidor_id to their coupon numbers
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

    // Build number -> consumidor map
    const numToConsumidor = new Map<number, string>();
    for (const [cid, nums] of consumidorCupons.entries()) {
      for (const n of nums) {
        numToConsumidor.set(n, cid);
      }
    }

    const totalNums = currentNum - 1;
    const logs: string[] = [];

    // Search: exact match first, then alternating +1, -1, +2, -2...
    const tryNumber = (n: number): string | null => {
      if (n < 1 || n > totalNums) return null;
      return numToConsumidor.get(n) ?? null;
    };

    let foundConsumidorId: string | null = null;
    let foundNum = num;

    // Try exact
    foundConsumidorId = tryNumber(num);
    if (foundConsumidorId) {
      logs.push(`Número ${num} encontrado!`);
      foundNum = num;
    } else {
      logs.push(`Número ${num} não encontrado.`);
      // Alternating search
      for (let delta = 1; delta <= totalNums; delta++) {
        // Try +delta
        const up = num + delta;
        const upResult = tryNumber(up);
        if (upResult) {
          logs.push(`Tentando ${up} → encontrado!`);
          foundConsumidorId = upResult;
          foundNum = up;
          break;
        } else if (up <= totalNums) {
          logs.push(`Tentando ${up} → não encontrado`);
        }
        // Try -delta
        const down = num - delta;
        const downResult = tryNumber(down);
        if (downResult) {
          logs.push(`Tentando ${down} → encontrado!`);
          foundConsumidorId = downResult;
          foundNum = down;
          break;
        } else if (down >= 1) {
          logs.push(`Tentando ${down} → não encontrado`);
        }
      }
    }

    setLogBusca(logs);

    if (foundConsumidorId) {
      // Fetch consumer details
      const { data: consData } = await supabase
        .from("consumidores")
        .select("id, usuario_id, pizzaria_id, usuarios(nome, telefone)")
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
      });
    }

    setBuscando(false);
  };

  const handleConfirmWinner = async () => {
    if (!ganhadorEncontrado || !selectedPremio) return;
    setConfirmando(true);
    const { error } = await supabase.from("premios").update({
      ganhador_consumidor_id: ganhadorEncontrado.consumidorId,
      numero_sorteado_loteria: Number(numeroLoteria),
      numero_cupom_contemplado: ganhadorEncontrado.numeroCupom,
      confirmado_em: new Date().toISOString(),
    } as any).eq("id", selectedPremio);

    if (error) {
      toast({ title: "Erro ao confirmar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ganhador confirmado com sucesso!" });
      // Refresh premios
      setPremios(prev => prev.map(p => p.id === selectedPremio ? {
        ...p,
        ganhadorConsumidorId: ganhadorEncontrado.consumidorId,
        numeroSorteadoLoteria: Number(numeroLoteria),
        numeroCupomContemplado: ganhadorEncontrado.numeroCupom,
        confirmadoEm: new Date().toISOString(),
      } : p));
      setGanhadorEncontrado(null);
      setLogBusca([]);
      setNumeroLoteria("");
      setSelectedPremio("");
    }
    setConfirmando(false);
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando dados do sorteio...</div>;

  const premiosDisponiveis = premios.filter(p => !p.ganhadorConsumidorId);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Sorteio</h1>
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

      {premios.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum prêmio configurado. Configure os prêmios nas Campanhas.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {premios.slice(0, 3).map((p, i) => (
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
                    <p className="text-muted-foreground">Cupom nº {p.numeroCupomContemplado} | Loteria nº {p.numeroSorteadoLoteria}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
        <CardContent className="space-y-4">
          {premiosDisponiveis.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos os prêmios já foram sorteados.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Prêmio a sortear</Label>
                  <Select value={selectedPremio} onValueChange={setSelectedPremio}>
                    <SelectTrigger><SelectValue placeholder="Selecione o prêmio" /></SelectTrigger>
                    <SelectContent>
                      {premiosDisponiveis.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.posicao}º — {p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Número sorteado na Loteria Federal</Label>
                  <Input type="number" placeholder="Ex: 45820" value={numeroLoteria} onChange={e => setNumeroLoteria(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleFindWinner} disabled={buscando}>
                <SearchIcon className="mr-2 h-4 w-4" />
                {buscando ? "Buscando..." : "Encontrar Ganhador"}
              </Button>

              {logBusca.length > 0 && (
                <div className="rounded-lg border border-border bg-secondary p-4 space-y-1 max-h-[200px] overflow-y-auto">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Log de busca:</p>
                  {logBusca.map((log, i) => (
                    <p key={i} className={`text-xs ${log.includes("encontrado!") ? "text-[hsl(var(--success))] font-medium" : "text-muted-foreground"}`}>{log}</p>
                  ))}
                </div>
              )}

              {ganhadorEncontrado && (
                <Card className="border-primary/40 bg-primary/5">
                  <CardContent className="p-4 space-y-3">
                    <p className="font-heading font-bold text-lg">🏆 Ganhador Encontrado!</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{ganhadorEncontrado.nome}</span></div>
                      <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{ganhadorEncontrado.telefone}</span></div>
                      <div><span className="text-muted-foreground">Pizzaria:</span> <span className="font-medium">{ganhadorEncontrado.pizzaria}</span></div>
                      <div><span className="text-muted-foreground">Total de cupons:</span> <span className="font-bold text-primary">{ganhadorEncontrado.cupons}</span></div>
                      <div><span className="text-muted-foreground">Cupom nº:</span> <span className="font-bold">{ganhadorEncontrado.numeroCupom}</span></div>
                    </div>
                    <Button onClick={handleConfirmWinner} disabled={confirmando} className="mt-2">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {confirmando ? "Confirmando..." : "Confirmar Ganhador"}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
