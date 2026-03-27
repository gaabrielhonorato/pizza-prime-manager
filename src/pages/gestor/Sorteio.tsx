import { useState, useEffect } from "react";
import { Trophy, Calendar, Ticket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { usePizzarias } from "@/contexts/PizzariasContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const trophyColors = ["text-yellow-400", "text-gray-400", "text-orange-600"];

interface PremioData {
  id: string;
  posicao: number;
  nome: string;
  descricao: string | null;
  valor: number;
  ganhadores: number;
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
  const [pizzariaCupons, setPizzariaCupons] = useState<PizzariaCupons[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch active campaign
      const { data: campData } = await supabase
        .from("campanhas")
        .select("*")
        .eq("status", "ativa")
        .limit(1)
        .single();

      if (campData) {
        setCampanha({
          id: campData.id,
          nome: campData.nome,
          dataInicio: campData.data_inicio,
          dataEncerramento: campData.data_encerramento,
          dataSorteio: typeof campData.data_sorteio === "string" ? campData.data_sorteio : "",
        });

        // Fetch premios for this campaign
        const { data: premiosData } = await supabase
          .from("premios")
          .select("*")
          .eq("campanha_id", campData.id)
          .order("posicao", { ascending: true });

        setPremios((premiosData ?? []).map(p => ({
          id: p.id,
          posicao: p.posicao,
          nome: p.nome,
          descricao: p.descricao,
          valor: Number(p.valor),
          ganhadores: p.quantidade_ganhadores,
        })));

        // Fetch cupons per pizzaria
        const { data: cuponsData } = await supabase
          .from("cupons")
          .select("quantidade, pedido_id, pedidos!inner(pizzaria_id)")
          .eq("campanha_id", campData.id);

        const cuponsMap = new Map<string, number>();
        cuponsData?.forEach((c: any) => {
          const pid = c.pedidos?.pizzaria_id;
          if (pid) cuponsMap.set(pid, (cuponsMap.get(pid) ?? 0) + c.quantidade);
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

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando dados do sorteio...</div>;

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-bold">Sorteio</h1>

      {premios.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum prêmio configurado. Configure os prêmios nas Configurações da campanha.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {premios.slice(0, 3).map((p, i) => (
            <Card key={p.id} className="border-border bg-card">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Trophy className={`h-6 w-6 ${trophyColors[i] ?? "text-primary"}`} />
                <CardTitle className="text-lg font-heading">{p.posicao}º Prêmio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{p.nome}</p>
                {p.descricao && <p className="text-sm text-muted-foreground mt-1">{p.descricao}</p>}
                <p className="mt-1 font-heading text-lg text-primary">R$ {p.valor.toLocaleString("pt-BR")}</p>
                {p.ganhadores > 1 && <p className="text-xs text-muted-foreground">{p.ganhadores} ganhadores</p>}
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
              <div>
                <span className="text-muted-foreground">Início:</span>{" "}
                <span className="font-medium">{format(new Date(campanha.dataInicio), "dd/MM/yyyy")}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Encerramento:</span>{" "}
                <span className="font-medium">{format(new Date(campanha.dataEncerramento), "dd/MM/yyyy")}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Sorteio:</span>{" "}
                <span className="font-medium">{format(new Date(campanha.dataSorteio), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
