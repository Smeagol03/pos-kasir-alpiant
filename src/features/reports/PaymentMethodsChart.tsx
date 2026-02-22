import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { formatRupiah } from "../../lib/currency";
import { useInvokeQuery } from "../../hooks/useInvokeQuery";
import { useAuthStore } from "../../store/authStore";
import { FinancialSummary } from "../../types";
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from "recharts";
import { CreditCard } from "lucide-react";

export function PaymentMethodsChart({ startDate, endDate }: { startDate: string, endDate: string }) {
  const sessionToken = useAuthStore((s) => s.sessionToken);

  const { data: summary, isLoading } = useInvokeQuery<FinancialSummary>(
    ["financial_summary", startDate, endDate],
    "get_financial_summary",
    { sessionToken, startDate, endDate },
  );

  if (isLoading || !summary) return null;

  const data = [
    { name: "CASH", value: summary.cash_total, color: "#10b981" }, // Emerald
    { name: "DEBIT", value: summary.debit_total, color: "#3b82f6" }, // Blue
    { name: "QRIS", value: summary.qris_total, color: "#8b5cf6" }, // Violet
  ].filter(d => d.value > 0);

  return (
    <Card className="shadow-sm border-slate-200 dark:border-slate-800">
      <CardHeader className="p-5 pb-2">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <CreditCard className="h-4 w-4" /> Distribusi Pembayaran
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="h-[250px] w-full">
          {data.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground italic">
              Tidak ada data pembayaran
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => formatRupiah(Number(value))}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        
        <div className="grid grid-cols-3 gap-2 mt-4">
          {data.map((item) => (
            <div key={item.name} className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg text-center border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black uppercase text-muted-foreground mb-0.5">{item.name}</p>
              <p className="text-xs font-black">{formatRupiah(item.value)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
