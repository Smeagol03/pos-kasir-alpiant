import { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { formatRupiah } from "../../lib/currency";
import { Transaction, TransactionDetail, AppSettings } from "../../types";
import { invoke } from "../../lib/tauri";
import { useAuthStore } from "../../store/authStore";
import { Printer, X, Receipt } from "lucide-react";

export function ReceiptDialog({
  open,
  onOpenChange,
  transaction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
}) {
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && transaction) {
      setLoading(true);
      Promise.all([
        invoke<TransactionDetail>("get_transaction_detail", {
          sessionToken,
          transactionId: transaction.id,
        }),
        invoke<AppSettings>("get_settings", { sessionToken }),
      ])
        .then(([txDetail, appSettings]) => {
          setDetail(txDetail);
          setSettings(appSettings);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, transaction, sessionToken]);

  const handlePrint = () => {
    if (!transaction) return;
    invoke("print_receipt", {
      sessionToken,
      transactionId: transaction.id,
    }).catch(console.error);

    // Also try browser print of the receipt content
    if (receiptRef.current) {
      const printWindow = window.open("", "_blank", "width=300,height=600");
      if (printWindow) {
        printWindow.document.write(`
          <html>
          <head>
            <title>Receipt</title>
            <style>
              body {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                width: ${settings?.receipt.paper_width === "58mm" ? "200px" : "280px"};
                margin: 0 auto;
                padding: 10px;
              }
              .center { text-align: center; }
              .right { text-align: right; }
              .bold { font-weight: bold; }
              .separator { border-top: 1px dashed #000; margin: 5px 0; }
              .row { display: flex; justify-content: space-between; }
              .item-name { margin-bottom: 2px; }
              .item-detail { display: flex; justify-content: space-between; padding-left: 10px; color: #555; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            ${receiptRef.current.innerHTML}
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        setTimeout(() => printWindow.close(), 500);
      }
    }
  };

  if (!transaction || !detail || !settings) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <div className="py-10 text-center text-muted-foreground">
            {loading ? "Loading receipt..." : "No receipt data"}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const txDate = transaction.timestamp
    ? new Date(transaction.timestamp + "Z")
    : new Date();

  const paymentMethodLabels: Record<string, string> = {
    CASH: "Tunai",
    DEBIT: "Debit",
    QRIS: "QRIS",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Struk Pembelian
          </DialogTitle>
        </DialogHeader>

        <div
          ref={receiptRef}
          className="bg-white text-black rounded-md p-6 font-mono text-xs overflow-auto max-h-[60vh] border"
          style={{ fontFamily: "'Courier New', monospace" }}
        >
          {/* Header */}
          <div className="text-center mb-3">
            <div className="font-bold text-sm">
              {settings.company.store_name || "My Store"}
            </div>
            {settings.company.address && <div>{settings.company.address}</div>}
            {settings.company.phone && (
              <div>Telp: {settings.company.phone}</div>
            )}
            {settings.receipt.header_text && (
              <div className="mt-1">{settings.receipt.header_text}</div>
            )}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Transaction Info */}
          <div className="space-y-0.5 mb-2">
            <div className="flex justify-between">
              <span>No:</span>
              <span>{transaction.id.split("-")[0].toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span>Tanggal:</span>
              <span>
                {txDate.toLocaleDateString("id-ID", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Jam:</span>
              <span>
                {txDate.toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
            {settings.receipt.show_cashier_name &&
              detail.transaction.cashier_name && (
                <div className="flex justify-between">
                  <span>Kasir:</span>
                  <span>{detail.transaction.cashier_name}</span>
                </div>
              )}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Items */}
          <div className="space-y-1.5 mb-2">
            {detail.items.map((item, idx) => (
              <div key={idx}>
                <div className="font-medium">{item.product_name}</div>
                <div className="flex justify-between pl-2 text-gray-600">
                  <span>
                    {item.quantity} x {formatRupiah(item.price_at_time)}
                  </span>
                  <span>{formatRupiah(item.subtotal)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Totals */}
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>
                {formatRupiah(detail.items.reduce((s, i) => s + i.subtotal, 0))}
              </span>
            </div>

            {settings.receipt.show_discount_detail &&
              transaction.discount_amount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Diskon</span>
                  <span>-{formatRupiah(transaction.discount_amount)}</span>
                </div>
              )}

            {settings.receipt.show_tax_detail && transaction.tax_amount > 0 && (
              <div className="flex justify-between">
                <span>
                  {settings.tax.label} ({settings.tax.rate}%
                  {settings.tax.is_included ? " Incl." : ""})
                </span>
                <span>{formatRupiah(transaction.tax_amount)}</span>
              </div>
            )}

            <div className="border-t border-dashed border-gray-400 my-1" />

            <div className="flex justify-between font-bold text-sm">
              <span>TOTAL</span>
              <span>{formatRupiah(transaction.total_amount)}</span>
            </div>

            <div className="border-t border-dashed border-gray-400 my-1" />

            <div className="flex justify-between">
              <span>
                Bayar (
                {paymentMethodLabels[transaction.payment_method] ||
                  transaction.payment_method}
                )
              </span>
              <span>{formatRupiah(transaction.amount_paid)}</span>
            </div>

            {transaction.payment_method === "CASH" &&
              transaction.change_given > 0 && (
                <div className="flex justify-between font-medium">
                  <span>Kembalian</span>
                  <span>{formatRupiah(transaction.change_given)}</span>
                </div>
              )}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Footer */}
          <div className="text-center mt-2">
            {settings.receipt.footer_text ? (
              <div>{settings.receipt.footer_text}</div>
            ) : (
              <div>Terima Kasih atas kunjungan Anda!</div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Tutup
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Cetak Struk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
