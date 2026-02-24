import { Card, CardContent } from "../../components/ui/card";
import { formatRupiah } from "../../lib/currency";
import { useInvokeQuery } from "../../hooks/useInvokeQuery";
import { useAuthStore } from "../../store/authStore";
import { FinancialSummary, ProfitReport } from "../../types";
import {
  TrendingUp,
  Receipt,
  Calculator,
  Coins,
  Percent,
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 bg-muted/50 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Pendapatan Kotor",
      value: formatRupiah(summary.gross_revenue),
      subtitle: `${summary.transaction_count} transaksi`,
      icon: TrendingUp,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      valueColor: "text-foreground",
    },
    {
      title: "Pendapatan Bersih",
      value: formatRupiah(summary.net_revenue),
      subtitle: "Setelah pajak",
      icon: Calculator,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-500",
      valueColor: "text-emerald-500",
    },
    {
      title: "Laba Kotor",
      value: profit ? formatRupiah(profit.gross_profit) : "-",
      subtitle: profit ? `Margin ${profit.profit_margin.toFixed(1)}%` : "HPP: -",
      icon: Coins,
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-500",
      valueColor: "text-violet-500",
    },
    {
      title: "Total Pajak",
      value: formatRupiah(summary.tax_total),
      subtitle: "PPN",
      icon: Receipt,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-500",
      valueColor: "text-amber-500",
    },
    {
      title: "Total Diskon",
      value: formatRupiah(summary.discount_total),
      subtitle: "Potongan harga",
      icon: Percent,
      iconBg: "bg-rose-500/10",
      iconColor: "text-rose-500",
      valueColor: "text-rose-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {cards.map((card, index) => (
        <Card
          key={index}
          className="bg-card border border-border/50 hover:border-border transition-colors"
        >
          <CardContent className="p-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg ${card.iconBg}`}>
                <card.icon className={`w-4 h-4 ${card.iconColor}`} />
              </div>
            </div>

            {/* Content */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">
                {card.title}
              </p>
              <p className={`text-lg font-bold ${card.valueColor} truncate`}>
                {card.value}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {card.subtitle}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
