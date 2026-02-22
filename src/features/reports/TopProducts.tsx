import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/card";
import { formatRupiah } from "../../lib/currency";
import { useInvokeQuery } from "../../hooks/useInvokeQuery";
import { useAuthStore } from "../../store/authStore";
import { ProductStat } from "../../types";
import { Star } from "lucide-react";

export function TopProducts({ startDate, endDate }: { startDate: string, endDate: string }) {
  const sessionToken = useAuthStore((s) => s.sessionToken);

  const { data: topProducts, isLoading } = useInvokeQuery<ProductStat[]>(
    ["top_products", startDate, endDate],
    "get_top_products",
    { sessionToken, startDate, endDate, limit: 10 },
  );

  return (
    <Card className="h-full shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <CardHeader className="p-5 pb-2">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Star className="h-4 w-4" /> 10 Produk Terlaris
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {topProducts?.map((p, i) => (
              <div key={p.product_id} className="group flex items-center p-3 rounded-xl border border-slate-50 dark:border-slate-800 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-sm">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm mr-4 shrink-0 shadow-sm ${
                  i === 0 ? "bg-amber-100 text-amber-600" : 
                  i === 1 ? "bg-slate-100 text-slate-600" :
                  i === 2 ? "bg-orange-100 text-orange-600" :
                  "bg-slate-50 text-slate-400 dark:bg-slate-800"
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">
                    {p.name}
                  </div>
                  <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-0.5">
                    {p.total_sold} UNIT TERJUAL
                  </div>
                </div>
                <div className="font-black text-sm text-right ml-2 text-slate-900 dark:text-white">
                  {formatRupiah(p.total_revenue)}
                </div>
              </div>
            ))}
            {topProducts?.length === 0 && (
              <div className="text-center text-muted-foreground py-20 flex flex-col items-center">
                <Star className="h-10 w-10 mb-4 opacity-10" />
                <p className="text-sm font-medium">Data penjualan belum tersedia</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
