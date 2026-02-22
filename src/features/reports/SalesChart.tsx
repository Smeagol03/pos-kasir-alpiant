import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/card";
import { formatRupiah } from "../../lib/currency";
import { format } from "date-fns";
import { useInvokeQuery } from "../../hooks/useInvokeQuery";
import { useAuthStore } from "../../store/authStore";
import { ChartPoint } from "../../types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";

export function SalesChart({ startDate, endDate }: { startDate: string, endDate: string }) {
  const sessionToken = useAuthStore((s) => s.sessionToken);

  const { data: points, isLoading } = useInvokeQuery<ChartPoint[]>(
    ["sales_chart", startDate, endDate],
    "get_sales_chart",
    { sessionToken, startDate, endDate },
  );

  return (
    <Card className="shadow-sm border-slate-200 dark:border-slate-800">
      <CardHeader className="p-5 pb-2">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Tren Pendapatan Harian
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="animate-pulse bg-muted h-full w-full rounded-xl" />
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={points || []}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="#3b82f6"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="#3b82f6"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  opacity={0.1}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => format(new Date(val), "dd MMM")}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  fontWeight="bold"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(val) => `Rp${(val / 1000).toFixed(0)}k`}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  fontWeight="bold"
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                  formatter={(value: any) => [formatRupiah(Number(value)), "Pendapatan"]}
                  labelFormatter={(label) =>
                    format(new Date(label), "EEEE, dd MMM yyyy")
                  }
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
