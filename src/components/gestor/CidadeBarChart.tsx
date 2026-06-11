import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  data: { cidade: string; faturamento: number }[];
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function CidadeBarChart({ data }: Props) {
  const barHeight = 36;
  const chartHeight = Math.max(data.length * barHeight + 16, 180);

  return (
    <Card>
      <CardHeader className="pb-0 pt-5 px-5">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Faturamento por Cidade
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-3">
        {data.length === 0 ? (
          <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="4 8"
                stroke="hsl(var(--border))"
                strokeWidth={0.8}
                horizontal={false}
              />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                hide
              />
              <YAxis
                type="category"
                dataKey="cidade"
                axisLine={false}
                tickLine={false}
                width={88}
                fontSize={11}
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                formatter={(v: number) => [fmt(v), "Faturamento"]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar animationDuration={3000} animationEasing="linear" dataKey="faturamento" radius={[0, 6, 6, 0]} maxBarSize={22}>
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={i === 0 ? "hsl(25 95% 53%)" : `hsl(25 80% ${58 + i * 3}%)`}
                    fillOpacity={1 - i * 0.07}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
