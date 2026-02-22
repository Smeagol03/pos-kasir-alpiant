import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/card";
import { formatRupiah } from "../../lib/currency";
import { format, subDays } from "date-fns";
import { useInvokeQuery } from "../../hooks/useInvokeQuery";
import { useAuthStore } from "../../store/authStore";
import { ProductStat } from "../../types";

export function TopProducts() {
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const endDate = format(new Date(), "yyyy-MM-dd");
  const startDate = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const { data: topProducts, isLoading } = useInvokeQuery<ProductStat[]>(
    ["top_products", startDate, endDate],
    "get_top_products",
    { sessionToken, startDate, endDate, limit: 5 },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Items Sold (Last 30 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Loading...
          </div>
        ) : (
          <div className="space-y-4">
            {topProducts?.map((p, i) => (
              <div key={p.product_id} className="flex items-center">
                <div className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="font-bold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.total_sold} units sold
                  </div>
                </div>
                <div className="font-medium text-right">
                  {formatRupiah(p.total_revenue)}
                </div>
              </div>
            ))}
            {topProducts?.length === 0 && (
              <div className="text-center text-muted-foreground py-10">
                No sales data found.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
