import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
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
  const [amountPaidStr, setAmountPaidStr] = useState("0");
  const [loading, setLoading] = useState(false);

  const { toast } = useToast();
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const {
    items,
    getTotal,
    discount_id,
    discount_amount,
    clearCart,
  } = useCartStore();

  const total = getTotal();
  const amountPaid = Number(amountPaidStr) || 0;
  const change = Math.max(0, amountPaid - total);

  // Set required amount paid string on mount or total change
  useState(() => {
    if (open) setAmountPaidStr(total.toString());
  });

  const handlePay = async () => {
    if (method === "CASH" && amountPaid < total) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description:
          "Amount paid cannot be less than the total for Cash payments.",
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
        discount_amount,
        payment_method: method,
        amount_paid: method === "CASH" ? amountPaid : total,
        notes: "",
      };

      const transaction = await invoke<Transaction>("create_transaction", {
        sessionToken,
        payload,
      });

      clearCart();
      onSuccess(transaction);
      onOpenChange(false);

      // Attempt to print (stubbed on backend)
      invoke("print_receipt", {
        sessionToken,
        transactionId: transaction.id,
      }).catch(console.error);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Transaction Failed",
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
          <DialogTitle>Complete Payment</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Summary & Method */}
          <div className="space-y-6">
            <div className="bg-primary/10 p-6 rounded-lg border border-primary/20 text-center">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                Total Due
              </div>
              <div className="text-4xl font-black text-primary">
                {formatRupiah(total)}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Payment Method</div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={method === "CASH" ? "default" : "outline"}
                  className="h-16 flex flex-col items-center justify-center gap-1"
                  onClick={() => setMethod("CASH")}
                >
                  <Banknote className="h-5 w-5" />
                  <span>Cash</span>
                </Button>
                <Button
                  variant={method === "DEBIT" ? "default" : "outline"}
                  className="h-16 flex flex-col items-center justify-center gap-1"
                  onClick={() => {
                    setMethod("DEBIT");
                    setAmountPaidStr(total.toString());
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
                    setAmountPaidStr(total.toString());
                  }}
                >
                  <QrCode className="h-5 w-5" />
                  <span>QRIS</span>
                </Button>
              </div>
            </div>

            {method === "CASH" && (
              <div className="bg-muted/50 p-4 rounded-lg flex justify-between items-center text-lg">
                <span className="font-medium">Change:</span>
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
                Amount Given
              </div>
              <Input
                type="text"
                autoFocus
                className={`text-right text-3xl font-mono h-14 p-3 rounded-md border bg-background ${method !== "CASH" ? "opacity-50" : ""}`}
                value={
                  method !== "CASH"
                    ? formatRupiah(total)
                    : amountPaidStr === "0"
                      ? ""
                      : amountPaidStr
                }
                disabled={method !== "CASH"}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, "");
                  setAmountPaidStr(val || "0");
                }}
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
                placeholder={formatRupiah(total)}
              />
            </div>

            <div
              className={
                method !== "CASH" ? "opacity-50 pointer-events-none" : ""
              }
            >
              <NumpadInput
                value={
                  amountPaidStr === "0" && method === "CASH"
                    ? ""
                    : amountPaidStr
                }
                onChange={(v) => setAmountPaidStr(v || "0")}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="lg"
            className="w-40 text-lg"
            onClick={handlePay}
            disabled={loading || (method === "CASH" && amountPaid < total)}
          >
            {loading ? "Processing..." : "Confirm Pay"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
