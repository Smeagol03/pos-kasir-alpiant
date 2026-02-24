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
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  ReceiptText,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Ban,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { ReceiptDialog } from "../pos/ReceiptDialog";
import { invoke } from "../../lib/tauri";
import { useToast } from "../../hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";

export function TransactionHistory({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const userRole = useAuthStore((s) => s.user?.role);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTx, setSelectedTx] = useState<TransactionWithCashier | null>(
    null,
  );
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<TransactionWithCashier | null>(
    null,
  );
  const [isVoiding, setIsVoiding] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
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

  const handleVoid = async () => {
    if (!voidTarget || !sessionToken) return;

    setIsVoiding(true);
    try {
      await invoke("void_transaction", {
        sessionToken,
        transactionId: voidTarget.id,
      });
      toast({
        title: "Transaksi Dibatalkan",
        description: `Transaksi ${voidTarget.id.split("-")[0].toUpperCase()} berhasil di-void. Stok telah dikembalikan.`,
      });
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["transactions_report"] });
      queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
      queryClient.invalidateQueries({ queryKey: ["profit_report"] });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gagal Void",
        description: String(error),
      });
    } finally {
      setIsVoiding(false);
      setVoidTarget(null);
    }
  };

  const isAdmin = userRole === "ADMIN";

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
            <ReceiptText className="h-4 w-4" /> Riwayat Transaksi
          </CardTitle>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari ID Struk atau Nama Kasir..."
              className="pl-10 h-10 text-xs rounded-lg"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[140px] text-[10px] font-semibold uppercase">
                    Waktu
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase">
                    ID Struk
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase">
                    Kasir
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase text-center">
                    Metode
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase text-right">
                    Total
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase text-center">
                    Status
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase text-center">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell
                        colSpan={7}
                        className="h-12 animate-pulse bg-muted/20"
                      />
                    </TableRow>
                  ))
                ) : !data || data.data.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-muted-foreground italic"
                    >
                      Tidak ada transaksi dalam periode ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.data.map((t) => (
                    <TableRow
                      key={t.id}
                      className={`hover:bg-muted/30 transition-colors ${t.status === "VOID" ? "opacity-60" : ""}`}
                    >
                      <TableCell className="text-xs font-medium">
                        {t.timestamp
                          ? format(new Date(t.timestamp), "dd/MM/yy HH:mm")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-xs font-mono font-bold text-primary">
                        {t.id.split("-")[0].toUpperCase()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {t.cashier_name}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="text-[9px] font-semibold"
                        >
                          {t.payment_method}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-bold text-xs ${t.status === "VOID" ? "line-through text-muted-foreground" : ""}`}
                      >
                        {formatRupiah(t.total_amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            t.status === "COMPLETED" ? "default" : "destructive"
                          }
                          className="text-[9px] font-semibold"
                        >
                          {t.status === "VOID" ? "VOID" : t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-primary hover:bg-primary/10"
                            onClick={() => handleShowDetail(t)}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            <span className="text-[10px] font-medium">
                              Detail
                            </span>
                          </Button>
                          {isAdmin && t.status === "COMPLETED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                              onClick={() => setVoidTarget(t)}
                            >
                              <Ban className="h-3.5 w-3.5 mr-1" />
                              <span className="text-[10px] font-medium">
                                Void
                              </span>
                            </Button>
                          )}
                        </div>
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
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
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

      {/* Void Confirmation Dialog */}
      <AlertDialog
        open={!!voidTarget}
        onOpenChange={(open: boolean) => !open && setVoidTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Pembatalan</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Apakah Anda yakin ingin membatalkan (void) transaksi ini?</p>
              {voidTarget && (
                <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1 not-italic">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID Struk</span>
                    <span className="font-mono font-bold">
                      {voidTarget.id.split("-")[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-bold text-red-500">
                      {formatRupiah(voidTarget.total_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Metode</span>
                    <span className="font-medium">
                      {voidTarget.payment_method}
                    </span>
                  </div>
                </div>
              )}
              <p className="text-amber-600 font-medium text-xs">
                ⚠ Tindakan ini akan mengembalikan stok produk dan tidak dapat
                dibatalkan.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVoiding}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoid}
              disabled={isVoiding}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isVoiding ? "Memproses..." : "Ya, Void Transaksi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
