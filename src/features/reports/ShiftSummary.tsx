import { Card, CardContent } from "../../components/ui/card";
import { formatRupiah } from "../../lib/currency";
import { useInvokeQuery } from "../../hooks/useInvokeQuery";
import { useAuthStore } from "../../store/authStore";
import { ShiftSummary as TShiftSummary } from "../../types";
import { format } from "date-fns";
import { Clock, Receipt, Banknote } from "lucide-react";

export function ShiftSummary() {
  const sessionToken = useAuthStore((s) => s.sessionToken);

  const { data: summary, isLoading } = useInvokeQuery<TShiftSummary>(
    ["shift_summary"],
    "get_shift_summary",
    { sessionToken },
  );

  if (isLoading || !summary) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="p-3 bg-primary/20 rounded-lg text-primary">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Current Shift
            </p>
            <h3 className="text-xl font-bold">{summary.cashier_name}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Logged in: {format(new Date(summary.login_at), "HH:mm")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-accent/5 border-accent/20">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="p-3 bg-accent/20 rounded-lg text-accent">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Transactions
            </p>
            <h3 className="text-2xl font-black">{summary.transaction_count}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              completed in this shift
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-emerald-500/5 border-emerald-500/20">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400">
            <Banknote className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Shift Revenue
            </p>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 relative -top-1">
              {formatRupiah(summary.total_revenue)}
            </h3>
            <p className="text-xs text-muted-foreground">gross revenue</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
