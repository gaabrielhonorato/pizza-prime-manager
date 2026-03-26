import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Calendar } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useCampanha } from "@/contexts/CampanhaContext";

const posicaoBadges: Record<number, string> = { 0: "🥇 1º Lugar", 1: "🥈 2º Lugar", 2: "🥉 3º Lugar" };

const regulamento = [
  { titulo: "Como participar", conteudo: "Para participar, basta realizar pedidos nas pizzarias parceiras da campanha Pizza Premiada. A cada R$50 em compras, você ganha 1 cupom para concorrer aos prêmios. É necessário ter cadastro completo com CPF, e-mail e telefone válidos." },
  { titulo: "Regras de geração de cupons", conteudo: "Os cupons são gerados automaticamente com base no valor do pedido. A cada R$50 gastos, 1 cupom é gerado. Valores abaixo de R$50 não geram cupons, mas o saldo pode ser acumulado conforme configuração da campanha. Pedidos cancelados não geram cupons." },
  { titulo: "Critérios do sorteio", conteudo: "O sorteio será realizado na data definida pela campanha. Quanto mais cupons acumulados, maiores as chances de ganhar. O sorteio é auditado e os resultados publicados no sistema e comunicados via WhatsApp." },
  { titulo: "Entrega dos prêmios", conteudo: "Os ganhadores serão contatados via WhatsApp e e-mail em até 48 horas após o sorteio. Os prêmios em dinheiro (Pix) serão transferidos em até 5 dias úteis. Prêmios físicos serão entregues em até 30 dias." },
  { titulo: "Disposições gerais", conteudo: "A campanha pode ser alterada ou encerrada a qualquer momento pela organização. Participantes que violarem os termos serão desclassificados. Dúvidas podem ser esclarecidas pelo WhatsApp oficial da Pizza Premiada." },
];

export default function ConsumidorPremios() {
  const { config } = useCampanha();

  const meses = ["Out/25", "Nov/25", "Dez/25", "Jan/26"];
  const mesAtual = 3;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Prêmios e Regulamento</h1>
        <p className="text-sm text-muted-foreground">Conheça os prêmios e as regras da campanha</p>
      </div>

      {/* Prêmios */}
      <div>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" /> Prêmios
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {config.premios.map((premio, i) => (
            <Card key={premio.id} className="border-border bg-card hover:border-primary/30 transition-colors">
              <CardContent className="pt-6 text-center">
                <div className="h-20 w-20 rounded-full bg-primary/10 mx-auto flex items-center justify-center text-3xl mb-4">
                  {i === 0 ? "📱" : i === 1 ? "✈️" : "💰"}
                </div>
                <Badge className="mb-2">{posicaoBadges[i] || `${i + 1}º Lugar`}</Badge>
                <h3 className="font-heading font-bold text-lg mt-2">{premio.nome}</h3>
                <p className="text-sm text-muted-foreground mt-1">{premio.descricao}</p>
                <p className="text-primary font-bold mt-2">R$ {premio.valor.toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground mt-1">{premio.ganhadores} ganhador{premio.ganhadores > 1 ? "es" : ""}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Regulamento */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">📜 Regulamento</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {regulamento.map((r, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-sm">{r.titulo}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                  {r.conteudo}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Cronograma */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Cronograma da Campanha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative flex items-start">
            {/* Connector line behind dots */}
            <div className="absolute top-1.5 left-0 right-0 mx-[calc(100%/(4*2))] h-0.5 bg-muted" />
            <div
              className="absolute top-1.5 left-0 h-0.5 bg-primary"
              style={{
                marginLeft: `calc(100% / ${meses.length * 2})`,
                width: `calc(${mesAtual} / ${meses.length - 1} * (100% - 100% / ${meses.length}))`,
              }}
            />
            {meses.map((mes, i) => (
              <div key={mes} className="flex-1 flex flex-col items-center relative z-10">
                <div className={`h-3 w-3 rounded-full border-2 ${i <= mesAtual ? "bg-primary border-primary" : "bg-muted border-muted"}`} />
                <p className={`text-xs mt-2 font-medium ${i === mesAtual ? "text-primary" : "text-muted-foreground"}`}>
                  {mes}
                </p>
                {i === 0 && <p className="text-[10px] text-muted-foreground">Início</p>}
                {i === meses.length - 1 && <p className="text-[10px] text-muted-foreground">Sorteio</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
