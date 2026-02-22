import { Card, CardContent } from "../../components/ui/card";
import { formatRupiah } from "../../lib/currency";
import { useInvokeQuery } from "../../hooks/useInvokeQuery";
import { useAuthStore } from "../../store/authStore";
import { FinancialSummary, ProfitReport } from "../../types";
import {
  TrendingUp,
  TrendingDown,
  Receipt,
  Percent,
  Calculator,
  Info,
  Coins,
} from "lucide-react";

export function FinancialSummaryCards({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const sessionToken = useAuthStore((s) => s.sessionToken);

  const { data: summary, isLoading } = useInvokeQuery<FinancialSummary>(
    ["financial_summary", startDate, endDate],
    "get_financial_summary",
    { sessionToken, startDate, endDate },
  );

  const { data: profit } = useInvokeQuery<ProfitReport>(
    ["profit_report", startDate, endDate],
    "get_profit_report",
    { sessionToken, startDate, endDate },
  );

  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Gross Revenue Card */}
      <Card className="border-l-4 border-l-primary shadow-sm overflow-hidden bg-white dark:bg-slate-900 transition-all hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                Pendapatan Kotor{" "}
                <TrendingUp className="h-3 w-3 text-emerald-500" />
              </p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                {formatRupiah(summary.gross_revenue)}
              </h3>
            </div>
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              {summary.transaction_count} TRANSAKSI
            </span>
            <span className="text-[10px] font-black text-primary uppercase bg-primary/5 px-2 py-0.5 rounded-full">
              TOTAL
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Net Revenue Card */}
      <Card className="border-l-4 border-l-emerald-500 shadow-sm overflow-hidden bg-white dark:bg-slate-900 transition-all hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Pendapatan Bersih (Net)
              </p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                {formatRupiah(summary.net_revenue)}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600">
              <Calculator className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              SETELAH PAJAK <Info className="h-3 w-3 opacity-50" />
            </span>
            <span className="text-[10px] font-black text-emerald-600 uppercase bg-emerald-500/5 px-2 py-0.5 rounded-full">
              NET
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Gross Profit Card (HPP) */}
      <Card className="border-l-4 border-l-violet-500 shadow-sm overflow-hidden bg-white dark:bg-slate-900 transition-all hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Laba Kotor
              </p>
              <h3 className="text-2xl font-black text-violet-600 dark:text-violet-400 leading-tight">
                {profit ? formatRupiah(profit.gross_profit) : "-"}
              </h3>
            </div>
            <div className="p-2.5 bg-violet-500/10 rounded-xl text-violet-600">
              <Coins className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              HPP: {profit ? formatRupiah(profit.total_cost) : "-"}
            </span>
            <span className="text-[10px] font-black text-violet-600 uppercase bg-violet-500/5 px-2 py-0.5 rounded-full">
              {profit ? `${profit.profit_margin.toFixed(1)}%` : "-"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Tax Card */}
      <Card className="border-l-4 border-l-amber-500 shadow-sm overflow-hidden bg-white dark:bg-slate-900 transition-all hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Total Pajak (PPN)
              </p>
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 leading-tight">
                {formatRupiah(summary.tax_total)}
              </h3>
            </div>
            <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-600">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              KEWAJIBAN PAJAK
            </span>
            <span className="text-[10px] font-black text-amber-600 uppercase bg-amber-500/5 px-2 py-0.5 rounded-full">
              LIABILITAS
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Discounts Card */}
      <Card className="border-l-4 border-l-rose-500 shadow-sm overflow-hidden bg-white dark:bg-slate-900 transition-all hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Potongan Harga (Diskon)
              </p>
              <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 leading-tight">
                {formatRupiah(summary.discount_total)}
              </h3>
            </div>
            <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-600">
              <Percent className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              TOTAL POTONGAN <TrendingDown className="h-3 w-3 text-rose-500" />
            </span>
            <span className="text-[10px] font-black text-rose-600 uppercase bg-rose-500/5 px-2 py-0.5 rounded-full">
              MARKETING
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
