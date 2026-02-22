import { useInvokeQuery } from "../../hooks/useInvokeQuery";
import { useAuthStore } from "../../store/authStore";
import { PaginatedTransactions } from "../../types";
import { formatRupiah } from "../../lib/currency";
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
import { ReceiptText, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";

export function TransactionHistory({ startDate, endDate }: { startDate: string, endDate: string }) {
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useInvokeQuery<PaginatedTransactions>(
    ["transactions_report", startDate, endDate, page],
    "get_transactions",
    { sessionToken, startDate, endDate, page },
  );

  return (
    <Card className="shadow-sm border-slate-200 dark:border-slate-800">
      <CardHeader className="p-5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <ReceiptText className="h-4 w-4" /> Riwayat Transaksi Lengkap
        </CardTitle>
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Cari ID Transaksi..." 
            className="pl-8 h-9 text-xs" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-t">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="w-[150px] font-bold text-[10px] uppercase">Waktu</TableHead>
                <TableHead className="font-bold text-[10px] uppercase">ID Transaksi</TableHead>
                <TableHead className="font-bold text-[10px] uppercase">Kasir</TableHead>
                <TableHead className="font-bold text-[10px] uppercase text-center">Metode</TableHead>
                <TableHead className="font-bold text-[10px] uppercase text-right">Total</TableHead>
                <TableHead className="font-bold text-[10px] uppercase text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6} className="h-12 animate-pulse bg-muted/20" />
                  </TableRow>
                ))
              ) : data?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">
                    Tidak ada transaksi dalam periode ini.
                  </TableCell>
                </TableRow>
              ) : (
                data?.data
                  .filter(t => !search || t.id.toLowerCase().includes(search.toLowerCase()))
                  .map((t) => (
                  <TableRow key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <TableCell className="text-xs font-medium">
                      {t.timestamp ? format(new Date(t.timestamp), "dd/MM/yy HH:mm") : "-"}
                    </TableCell>
                    <TableCell className="text-xs font-mono font-bold text-primary">
                      {t.id.split("-")[0].toUpperCase()}
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.cashier_name}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[9px] font-black tracking-tighter">
                        {t.payment_method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-black text-xs">
                      {formatRupiah(t.total_amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={t.status === "COMPLETED" ? "default" : "destructive"} className="text-[9px] font-black">
                        {t.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {data && data.total > data.per_page && (
          <div className="p-4 border-t flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Menampilkan {data.data.length} dari {data.total} transaksi
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => p + 1)}
                disabled={page * data.per_page >= data.total}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
