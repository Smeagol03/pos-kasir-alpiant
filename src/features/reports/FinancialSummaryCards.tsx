import { Card, CardContent } from "../../components/ui/card";
import { formatRupiah } from "../../lib/currency";
import { useInvokeQuery } from "../../hooks/useInvokeQuery";
import { useAuthStore } from "../../store/authStore";
import { FinancialSummary, ProfitReport } from "../../types";
import {
  TrendingUp,
  Wallet,
  Coins,
  Receipt,
  Percent,
  CreditCard,
  QrCode,
  Banknote,
  AlertTriangle,
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
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 bg-muted/30 animate-pulse rounded-lg"
            />
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-20 bg-muted/30 animate-pulse rounded-lg"
            />
          ))}
        </div>
      </div>
    );
  }

  // Compute derived values
  const avgTransaction =
    summary.transaction_count > 0
      ? summary.gross_revenue / summary.transaction_count
      : 0;

  return (
    <div className="space-y-4">
      {/* Row 1: Primary Financial KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Pendapatan Kotor */}
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-blue-500/10">
                <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">
                Pendapatan Kotor
              </span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {formatRupiah(summary.gross_revenue)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {summary.transaction_count} transaksi • Rata-rata{" "}
              {formatRupiah(avgTransaction)}
            </p>
          </CardContent>
        </Card>

        {/* Pendapatan Bersih */}
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-emerald-500/10">
                <Wallet className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">
                Pendapatan Bersih
              </span>
            </div>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatRupiah(summary.net_revenue)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Pendapatan kotor − pajak ({formatRupiah(summary.tax_total)})
            </p>
          </CardContent>
        </Card>

        {/* Laba Kotor */}
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-violet-500/10">
                <Coins className="w-3.5 h-3.5 text-violet-500" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">
                Laba Kotor
              </span>
            </div>
            <p className="text-xl font-bold text-violet-600 dark:text-violet-400">
              {profit ? formatRupiah(profit.gross_profit) : "−"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {profit
                ? `Margin ${profit.profit_margin.toFixed(1)}% • HPP ${formatRupiah(profit.total_cost)}`
                : "Data HPP tidak tersedia"}
            </p>
          </CardContent>
        </Card>

        {/* Void / Pembatalan */}
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-red-500/10">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">
                Pembatalan (Void)
              </span>
            </div>
            <p className="text-xl font-bold text-red-500">
              {formatRupiah(summary.void_total)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {summary.void_count} transaksi dibatalkan
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Breakdown — Payment Methods + Tax + Discount */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Cash */}
        <Card className="border-border/40">
          <CardContent className="px-3 py-3">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="w-3.5 h-3.5 text-green-500" />
              <span className="text-[11px] font-medium text-muted-foreground">
                Tunai
              </span>
            </div>
            <p className="text-sm font-bold">
              {formatRupiah(summary.cash_total)}
            </p>
            {summary.gross_revenue > 0 && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{
                      width: `${(summary.cash_total / summary.gross_revenue) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground">
                  {((summary.cash_total / summary.gross_revenue) * 100).toFixed(
                    0,
                  )}
                  %
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Debit */}
        <Card className="border-border/40">
          <CardContent className="px-3 py-3">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[11px] font-medium text-muted-foreground">
                Debit
              </span>
            </div>
            <p className="text-sm font-bold">
              {formatRupiah(summary.debit_total)}
            </p>
            {summary.gross_revenue > 0 && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{
                      width: `${(summary.debit_total / summary.gross_revenue) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground">
                  {(
                    (summary.debit_total / summary.gross_revenue) *
                    100
                  ).toFixed(0)}
                  %
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* QRIS */}
        <Card className="border-border/40">
          <CardContent className="px-3 py-3">
            <div className="flex items-center gap-2 mb-1">
              <QrCode className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-[11px] font-medium text-muted-foreground">
                QRIS
              </span>
            </div>
            <p className="text-sm font-bold">
              {formatRupiah(summary.qris_total)}
            </p>
            {summary.gross_revenue > 0 && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{
                      width: `${(summary.qris_total / summary.gross_revenue) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground">
                  {((summary.qris_total / summary.gross_revenue) * 100).toFixed(
                    0,
                  )}
                  %
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total Pajak */}
        <Card className="border-border/40">
          <CardContent className="px-3 py-3">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] font-medium text-muted-foreground">
                Total Pajak
              </span>
            </div>
            <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
              {formatRupiah(summary.tax_total)}
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              PPN dari transaksi
            </p>
          </CardContent>
        </Card>

        {/* Total Diskon */}
        <Card className="border-border/40">
          <CardContent className="px-3 py-3">
            <div className="flex items-center gap-2 mb-1">
              <Percent className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-[11px] font-medium text-muted-foreground">
                Total Diskon
              </span>
            </div>
            <p className="text-sm font-bold text-rose-500">
              −{formatRupiah(summary.discount_total)}
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              Potongan transaksi + item
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
