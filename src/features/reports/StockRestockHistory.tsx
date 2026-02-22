import { useInvokeQuery } from "../../hooks/useInvokeQuery";
import { useAuthStore } from "../../store/authStore";
import { StockAdjustment } from "../../types";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Box, ArrowUpRight, ArrowDownRight } from "lucide-react";

export function StockRestockHistory() {
  const sessionToken = useAuthStore((s) => s.sessionToken);

  const { data: history, isLoading } = useInvokeQuery<StockAdjustment[]>(
    ["stock_history"],
    "get_stock_history",
    { sessionToken, product_id: null, limit: 100 },
  );

  return (
    <Card className="shadow-sm border-slate-200 dark:border-slate-800">
      <CardHeader className="p-5">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Box className="h-4 w-4" /> Log Pergerakan Stok (Inventory)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-t max-h-[500px] overflow-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-[180px] font-bold text-[10px] uppercase">Waktu</TableHead>
                <TableHead className="font-bold text-[10px] uppercase">Produk</TableHead>
                <TableHead className="w-[100px] font-bold text-[10px] uppercase text-center">Tipe</TableHead>
                <TableHead className="w-[100px] font-bold text-[10px] uppercase text-right">Jumlah</TableHead>
                <TableHead className="w-[120px] font-bold text-[10px] uppercase">Alasan</TableHead>
                <TableHead className="w-[150px] font-bold text-[10px] uppercase">Oleh</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6} className="h-12 animate-pulse bg-muted/20" />
                  </TableRow>
                ))
              ) : history?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">
                    Belum ada riwayat pergerakan stok.
                  </TableCell>
                </TableRow>
              ) : (
                history?.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <TableCell className="text-[11px] font-medium text-muted-foreground">
                      {item.created_at ? format(new Date(item.created_at), "dd MMM yyyy, HH:mm") : "-"}
                    </TableCell>
                    <TableCell className="text-xs font-bold">
                      {item.product_name}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className={`flex items-center justify-center gap-1 font-black text-[10px] ${item.type === "IN" ? "text-emerald-600" : "text-rose-600"}`}>
                        {item.type === "IN" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {item.type}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-black text-sm">
                      {item.quantity}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] font-bold uppercase">
                        {item.reason}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.user_name}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
