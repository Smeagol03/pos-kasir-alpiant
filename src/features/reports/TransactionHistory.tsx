import { useInvokeQuery } from "../../hooks/useInvokeQuery";
import { useAuthStore } from "../../store/authStore";
import { PaginatedTransactions, TransactionWithCashier } from "../../types";
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
import { ReceiptText, Search, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { ReceiptDialog } from "../pos/ReceiptDialog";

export function TransactionHistory({ startDate, endDate }: { startDate: string, endDate: string }) {
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTx, setSelectedTx] = useState<TransactionWithCashier | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Debounce search to avoid too many requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on new search
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useInvokeQuery<PaginatedTransactions>(
    ["transactions_report", startDate, endDate, page, debouncedSearch],
    "get_transactions",
    { sessionToken, startDate, endDate, page, search: debouncedSearch },
  );

  const handleShowDetail = (tx: TransactionWithCashier) => {
    setSelectedTx(tx);
    setIsReceiptOpen(true);
  };

  return (
    <>
      <Card className="shadow-sm border-slate-200 dark:border-slate-800">
        <CardHeader className="p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <ReceiptText className="h-4 w-4" /> Riwayat Transaksi Lengkap
          </CardTitle>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Cari ID Struk atau Nama Kasir..." 
              className="pl-10 h-10 text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg" 
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
                  <TableHead className="font-bold text-[10px] uppercase">ID Struk</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase">Kasir</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-center">Metode</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-right">Total</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-center">Status</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="h-12 animate-pulse bg-muted/20" />
                    </TableRow>
                  ))
                ) : !data || data.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground italic">
                      Tidak ada transaksi dalam periode ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.data.map((t) => (
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
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => handleShowDetail(t)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          <span className="text-[10px] font-bold uppercase">Detail</span>
                        </Button>
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

      <ReceiptDialog 
        open={isReceiptOpen} 
        onOpenChange={setIsReceiptOpen} 
        transaction={selectedTx} 
      />
    </>
  );
}
