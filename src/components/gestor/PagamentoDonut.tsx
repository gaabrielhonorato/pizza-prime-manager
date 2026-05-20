import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = [
  "hsl(172 60% 45%)",
  "hsl(221 83% 58%)",
  "hsl(255 76% 62%)",
  "hsl(38 92% 50%)",
];

const LABELS: Record<string, string> = {
  pix: "Pix",
  cartao_debito: "Cartão Débito",
  cartao_credito: "Cartão Crédito",
  dinheiro: "Dinheiro",
};

interface Props {
  data: { name: string; value: number }[];
}

export default function PagamentoDonut({ data }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card>
      <CardHeader className="pb-0 pt-5 px-5">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Formas de Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-3">
        {data.length === 0 ? (
          <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
        ) : (
          <div className="flex items-center gap-5">
            <div className="w-[120px] h-[120px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%" cy="50%"
                    innerRadius={36} outerRadius={56}
                    dataKey="value"
                    paddingAngle={3}
                    strokeWidth={0}
                    cornerRadius={0.5}
                  >
                    {data.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [`${v} pedidos`, ""]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2.5 min-w-0">
              {data.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-muted-foreground truncate">{LABELS[item.name] ?? item.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-semibold">{((item.value / total) * 100).toFixed(0)}%</span>
                    <span className="text-muted-foreground">({item.value})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
