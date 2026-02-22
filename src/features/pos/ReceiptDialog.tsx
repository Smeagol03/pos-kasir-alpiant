import { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { formatRupiah } from "../../lib/currency";
import { Transaction, TransactionDetail, AppSettings } from "../../types";
import { invoke } from "../../lib/tauri";
import { useAuthStore } from "../../store/authStore";
import { Printer, X, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

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
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && transaction) {
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
        .catch(console.error);
    }
  }, [open, transaction, sessionToken]);

  const handlePrint = () => {
    if (!transaction || !settings) return;
    
    // Log Activity for printing
    invoke("print_receipt", {
      sessionToken,
      transactionId: transaction.id,
    }).catch(console.error);

    // Thermal Printer Optimized Printing
    if (receiptRef.current) {
      const printWindow = window.open("", "_blank", "width=300,height=600");
      if (printWindow) {
        const is58mm = settings.receipt.paper_width === "58mm";
        const width = is58mm ? "200px" : "280px";
        
        printWindow.document.write(`
          <html>
          <head>
            <title>Struk_${transaction.id.split('-')[0]}</title>
            <style>
              @page { margin: 0; }
              body {
                font-family: 'Courier New', Courier, monospace;
                font-size: 12px;
                width: ${width};
                margin: 0;
                padding: 10px;
                color: #000;
              }
              .center { text-align: center; }
              .right { text-align: right; }
              .bold { font-weight: bold; }
              .dashed-line { border-top: 1px dashed #000; margin: 8px 0; }
              .flex { display: flex; justify-content: space-between; }
              .item-row { margin-bottom: 4px; }
              .total-row { font-weight: bold; margin-top: 2px; }
              .footer { margin-top: 15px; font-size: 10px; }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            ${receiptRef.current.innerHTML}
          </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  };

  if (!transaction || !detail || !settings) {
    return null;
  }

  // Parse date safely
  const txDate = transaction.timestamp ? new Date(transaction.timestamp) : new Date();

  const paymentMethodLabels: Record<string, string> = {
    CASH: "Tunai",
    DEBIT: "Debit",
    QRIS: "QRIS",
  };

  const subtotalItems = detail.items.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-emerald-600 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black leading-tight">Pembayaran Berhasil</h2>
              <p className="text-emerald-100 text-xs font-medium">Transaksi #{transaction.id.split("-")[0].toUpperCase()}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/10"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-900">
          {/* Paper Receipt Preview */}
          <div
            ref={receiptRef}
            className="bg-white text-black p-6 shadow-sm mx-auto w-full max-w-[300px] border border-slate-200"
            style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '12px' }}
          >
            {/* Header */}
            <div className="center">
              <div className="bold" style={{ fontSize: '14px' }}>{settings.company.store_name.toUpperCase()}</div>
              <div>{settings.company.address}</div>
              {settings.company.phone && <div>Telp: {settings.company.phone}</div>}
            </div>

            <div className="dashed-line" />

            {/* Meta Info */}
            <div style={{ lineHeight: '1.4' }}>
              <div className="flex">
                <span>No:</span>
                <span>{transaction.id.split("-")[0].toUpperCase()}</span>
              </div>
              <div className="flex">
                <span>Tgl:</span>
                <span>{format(txDate, "dd/MM/yyyy HH:mm:ss")}</span>
              </div>
              <div className="flex">
                <span>Kasir:</span>
                <span>{detail.transaction.cashier_name}</span>
              </div>
            </div>

            <div className="dashed-line" />

            {/* Items */}
            <div style={{ margin: '10px 0' }}>
              {detail.items.map((item, idx) => (
                <div key={idx} className="item-row">
                  <div>{item.product_name}</div>
                  <div className="flex">
                    <span style={{ paddingLeft: '10px' }}>
                      {item.quantity} x {formatRupiah(item.price_at_time).replace("Rp", "").trim()}
                    </span>
                    <span>{formatRupiah(item.subtotal).replace("Rp", "").trim()}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="dashed-line" />

            {/* Financial Totals */}
            <div style={{ lineHeight: '1.6' }}>
              <div className="flex">
                <span>Subtotal</span>
                <span>{formatRupiah(subtotalItems)}</span>
              </div>

              {transaction.discount_amount > 0 && (
                <div className="flex bold">
                  <span>Diskon</span>
                  <span>-{formatRupiah(transaction.discount_amount)}</span>
                </div>
              )}

              {transaction.tax_amount > 0 && (
                <div className="flex">
                  <span>{settings.tax.label} ({settings.tax.rate}%)</span>
                  <span>{formatRupiah(transaction.tax_amount)}</span>
                </div>
              )}

              <div className="flex bold" style={{ fontSize: '14px', marginTop: '4px' }}>
                <span>TOTAL</span>
                <span>{formatRupiah(transaction.total_amount)}</span>
              </div>

              <div className="dashed-line" />

              <div className="flex">
                <span>Bayar ({paymentMethodLabels[transaction.payment_method] || transaction.payment_method})</span>
                <span>{formatRupiah(transaction.amount_paid)}</span>
              </div>

              {transaction.payment_method === "CASH" && (
                <div className="flex bold">
                  <span>Kembalian</span>
                  <span>{formatRupiah(transaction.change_given)}</span>
                </div>
              )}
            </div>

            <div className="dashed-line" />

            {/* Footer */}
            <div className="center footer">
              <div>{settings.receipt.footer_text || "Terima Kasih Atas Kunjungan Anda"}</div>
              <div style={{ marginTop: '5px' }}>*** LUNAS ***</div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border-t flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1 h-12 font-bold" 
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
          <Button 
            className="flex-[2] h-12 font-black bg-slate-900 dark:bg-white dark:text-slate-900 gap-2 shadow-lg shadow-slate-200 dark:shadow-none" 
            onClick={handlePrint}
          >
            <Printer className="h-5 w-5" /> CETAK STRUK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
