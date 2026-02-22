import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { useCartStore } from "../../store/cartStore";
import { formatRupiah } from "../../lib/currency";
import { NumpadInput } from "./NumpadInput";
import {
  PaymentMethod,
  CreateTransactionPayload,
  Transaction,
} from "../../types";
import { invoke } from "../../lib/tauri";
import { useAuthStore } from "../../store/authStore";
import { useToast } from "../../hooks/use-toast";
import { Banknote, CreditCard, QrCode } from "lucide-react";
import { NumericInput } from "../../components/NumericInput";

export function PaymentModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (transaction: Transaction) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [amountPaid, setAmountPaid] = useState(0);
  const [loading, setLoading] = useState(false);

  const { toast } = useToast();
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const { 
    items, 
    getTotal, 
    discount_id, 
    getDiscountAmount, 
    clearCart 
  } = useCartStore();

  const total = getTotal();
  const change = Math.max(0, amountPaid - total);

  // Initialize amount when modal opens
  useEffect(() => {
    if (open) {
      setAmountPaid(total);
      setMethod("CASH");
    }
  }, [open, total]);

  const handlePay = async () => {
    // Rounding safety for IDR
    const roundedTotal = Math.round(total);
    const roundedAmountPaid = Math.round(amountPaid);

    if (method === "CASH" && roundedAmountPaid < roundedTotal) {
      toast({
        variant: "destructive",
        title: "Jumlah Tidak Valid",
        description:
          "Uang yang dibayarkan tidak boleh kurang dari total untuk pembayaran tunai.",
      });
      return;
    }

    setLoading(true);
    try {
      const payload: CreateTransactionPayload = {
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          price_at_time: i.price,
          discount_amount: i.discount_amount || 0,
        })),
        discount_id,
        discount_amount: getDiscountAmount(), // Use calculated amount (handles percentage)
        payment_method: method,
        amount_paid: method === "CASH" ? roundedAmountPaid : roundedTotal,
        notes: "",
      };

      const transaction = await invoke<Transaction>("create_transaction", {
        sessionToken,
        payload,
      });

      clearCart();
      onSuccess(transaction);
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Transaksi Gagal",
        description: String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Selesaikan Pembayaran</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Summary & Method */}
          <div className="space-y-6">
            <div className="bg-primary/10 p-6 rounded-lg border border-primary/20 text-center">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                Total Tagihan
              </div>
              <div className="text-4xl font-black text-primary">
                {formatRupiah(total)}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Metode Pembayaran</div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={method === "CASH" ? "default" : "outline"}
                  className="h-16 flex flex-col items-center justify-center gap-1"
                  onClick={() => setMethod("CASH")}
                >
                  <Banknote className="h-5 w-5" />
                  <span>Tunai</span>
                </Button>
                <Button
                  variant={method === "DEBIT" ? "default" : "outline"}
                  className="h-16 flex flex-col items-center justify-center gap-1"
                  onClick={() => {
                    setMethod("DEBIT");
                    setAmountPaid(total);
                  }}
                >
                  <CreditCard className="h-5 w-5" />
                  <span>Debit</span>
                </Button>
                <Button
                  variant={method === "QRIS" ? "default" : "outline"}
                  className="h-16 flex flex-col items-center justify-center gap-1"
                  onClick={() => {
                    setMethod("QRIS");
                    setAmountPaid(total);
                  }}
                >
                  <QrCode className="h-5 w-5" />
                  <span>QRIS</span>
                </Button>
              </div>
            </div>

            {method === "CASH" && (
              <div className="bg-muted/50 p-4 rounded-lg flex justify-between items-center text-lg">
                <span className="font-medium">Kembalian:</span>
                <span
                  className={`font-bold ${change > 0 ? "text-emerald-500" : ""}`}
                >
                  {formatRupiah(change)}
                </span>
              </div>
            )}
          </div>

          {/* Right Column: Keypad (only for cash) */}
          <div className="border border-border rounded-lg p-4 bg-card shadow-sm">
            <div className="mb-4">
              <div className="text-sm text-muted-foreground mb-1">
                Uang Diberikan
              </div>
              <NumericInput
                autoFocus
                className={`text-right text-3xl font-mono h-14 p-3 rounded-md border bg-background ${method !== "CASH" ? "opacity-50" : ""}`}
                value={method !== "CASH" ? total : amountPaid}
                disabled={method !== "CASH"}
                onChange={(val) => setAmountPaid(val)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !loading &&
                    method === "CASH" &&
                    amountPaid >= total
                  ) {
                    handlePay();
                  }
                }}
                prefix="Rp"
                placeholder={formatRupiah(total)}
              />
            </div>

            <div
              className={
                method !== "CASH" ? "opacity-50 pointer-events-none" : ""
              }
            >
              <NumpadInput
                value={amountPaid === 0 && method === "CASH" ? "" : amountPaid.toString()}
                onChange={(v) => setAmountPaid(Number(v) || 0)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            size="lg"
            className="w-40 text-lg"
            onClick={handlePay}
            disabled={loading || (method === "CASH" && amountPaid < total)}
          >
            {loading ? "Memproses..." : "Konfirmasi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
