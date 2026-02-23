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
import { Printer, X, CheckCircle2, Store } from "lucide-react";
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
                font-size: 11px;
                width: ${width};
                margin: 0;
                padding: 10px;
                color: #000;
              }
              .header { text-align: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px dashed #000; }
              .store-name { font-size: 16px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; }
              .store-info { font-size: 10px; }
              
              .meta { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #000; font-size: 10px; }
              .meta-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
              
              .items { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #000; }
              .item-row { margin-bottom: 6px; }
              .item-name { font-weight: bold; margin-bottom: 2px; }
              .item-details { display: flex; justify-content: space-between; font-size: 10px; }
              
              .totals { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px dashed #000; }
              .total-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
              .grand-total { font-size: 14px; font-weight: 900; margin-top: 6px; border-top: 1px dashed #000; padding-top: 6px; }
              
              .payment { margin-bottom: 15px; }
              
              .footer { text-align: center; font-size: 10px; margin-top: 10px; }
              .thank-you { font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
              .brand { font-size: 9px; opacity: 0.7; margin-top: 10px; }
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
    CASH: "TUNAI",
    DEBIT: "DEBIT",
    QRIS: "QRIS",
  };

  const subtotalItems = detail.items.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
        <div className="bg-slate-900 dark:bg-slate-950 p-6 text-white flex items-center justify-between relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-2xl" />
          <div className="absolute top-10 -left-10 w-24 h-24 bg-blue-500/20 rounded-full blur-xl" />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">
              <CheckCircle2 className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-black leading-tight tracking-tight">Transaksi Sukses</h2>
              <p className="text-slate-400 text-xs font-medium mt-0.5">#{transaction.id.split("-")[0].toUpperCase()}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/10 relative z-10 rounded-full"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-8 bg-slate-100 dark:bg-slate-900 flex justify-center overflow-y-auto max-h-[70vh]">
          {/* Paper Receipt Preview */}
          <div
            ref={receiptRef}
            className="bg-white text-black p-5 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.1)] w-full max-w-[300px] relative receipt-paper"
            style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '12px' }}
          >
            {/* Torn paper effect top */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-[linear-gradient(45deg,transparent_33.333%,#fff_33.333%,#fff_66.667%,transparent_66.667%),linear-gradient(-45deg,transparent_33.333%,#fff_33.333%,#fff_66.667%,transparent_66.667%)] bg-[length:10px_20px] bg-[position:0_-10px] transform rotate-180 -mt-2"></div>
            
            {/* Header */}
            <div className="header" style={{ textAlign: 'center', marginBottom: '15px', paddingBottom: '15px', borderBottom: '2px dashed #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                <Store size={24} strokeWidth={2.5} />
              </div>
              <div className="store-name" style={{ fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '-0.5px' }}>{settings.company.store_name}</div>
              <div className="store-info" style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                {settings.company.address}<br/>
                {settings.company.phone && `Telp: ${settings.company.phone}`}
              </div>
            </div>

            {/* Meta Info */}
            <div className="meta" style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px dashed #e2e8f0', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>No. Struk</span>
                <span style={{ fontWeight: 'bold' }}>#{transaction.id.split("-")[0].toUpperCase()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>Tanggal</span>
                <span style={{ fontWeight: 'bold' }}>{format(txDate, "dd/MM/yy")} <span style={{ fontWeight: 'normal', color: '#94a3b8' }}>{format(txDate, "HH:mm")}</span></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Kasir</span>
                <span style={{ fontWeight: 'bold' }}>{detail.transaction.cashier_name}</span>
              </div>
            </div>

            {/* Items */}
            <div className="items" style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px dashed #e2e8f0' }}>
              {detail.items.map((item, idx) => (
                <div key={idx} style={{ marginBottom: '10px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '12px' }}>{item.product_name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#334155' }}>
                    <span>
                      {item.quantity} x {formatRupiah(item.price_at_time).replace("Rp", "").trim()}
                    </span>
                    <span style={{ fontWeight: 'bold', color: '#000' }}>{formatRupiah(item.subtotal).replace("Rp", "").trim()}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Financial Totals */}
            <div className="totals" style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '2px dashed #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
                <span style={{ color: '#64748b' }}>Subtotal</span>
                <span>{formatRupiah(subtotalItems)}</span>
              </div>

              {transaction.discount_amount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px', color: '#ef4444' }}>
                  <span>Diskon</span>
                  <span>-{formatRupiah(transaction.discount_amount)}</span>
                </div>
              )}

              {transaction.tax_amount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px', color: '#64748b' }}>
                  <span>{settings.tax.label} ({settings.tax.rate}%)</span>
                  <span>{formatRupiah(transaction.tax_amount)}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0', fontSize: '16px', fontWeight: '900' }}>
                <span>TOTAL</span>
                <span>{formatRupiah(transaction.total_amount)}</span>
              </div>
            </div>

            <div className="payment" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
                <span style={{ fontWeight: 'bold' }}>{paymentMethodLabels[transaction.payment_method] || transaction.payment_method}</span>
                <span>{formatRupiah(transaction.amount_paid)}</span>
              </div>

              {transaction.payment_method === "CASH" && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: '#64748b' }}>Kembali</span>
                  <span style={{ fontWeight: 'bold' }}>{formatRupiah(transaction.change_given)}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="footer" style={{ textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
              <div style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px', color: '#000' }}>{settings.receipt.footer_text || "TERIMA KASIH"}</div>
              <div style={{ fontSize: '10px' }}>Simpan struk ini sebagai bukti pembayaran yang sah</div>
              
              <div style={{ marginTop: '20px', fontSize: '10px', opacity: 0.5, letterSpacing: '2px' }}>*** LUNAS ***</div>
            </div>

            {/* Torn paper effect bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-[linear-gradient(45deg,transparent_33.333%,#fff_33.333%,#fff_66.667%,transparent_66.667%),linear-gradient(-45deg,transparent_33.333%,#fff_33.333%,#fff_66.667%,transparent_66.667%)] bg-[length:10px_20px] bg-[position:0_-10px] -mb-2"></div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border-t flex gap-3 z-20 relative">
          <Button 
            variant="outline" 
            className="flex-1 h-12 font-bold rounded-xl border-slate-200 dark:border-slate-800" 
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
          <Button 
            className="flex-[2] h-12 font-black bg-slate-900 dark:bg-white dark:text-slate-900 gap-2 shadow-lg shadow-slate-200 dark:shadow-none rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all" 
            onClick={handlePrint}
          >
            <Printer className="h-5 w-5" /> CETAK SEKARANG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
