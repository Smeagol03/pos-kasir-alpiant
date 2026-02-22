import { useCartStore } from "../../store/cartStore";
import { formatRupiah } from "../../lib/currency";
import { Button } from "../../components/ui/button";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Trash2, Plus, Minus, Tag, Banknote, ShoppingCart, Info, Percent } from "lucide-react";
import { Separator } from "../../components/ui/separator";

export function CartPanel({
  onCheckout,
  onDiscount,
}: {
  onCheckout: () => void;
  onDiscount: () => void;
}) {
  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    getSubtotal,
    getDiscountAmount,
    getTaxAmount,
    getTotal,
    discount_name,
    discount_percent,
    tax_rate,
    tax_included,
    tax_label,
    tax_enabled,
  } = useCartStore();

  const subtotal = getSubtotal();
  const discountTotal = getDiscountAmount();
  const tax = getTaxAmount();
  const total = getTotal();

  let formattedDiscount = formatRupiah(discountTotal);
  if (discount_percent !== null) {
    formattedDiscount = `${discount_percent}% (-${formatRupiah(discountTotal)})`;
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
      {/* Receipt Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-black text-lg text-slate-900 dark:text-white leading-tight uppercase tracking-tight">
              Pesanan
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {items.length} Item Ditambahkan
            </p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-destructive hover:bg-destructive/10 h-8 w-8 rounded-lg"
          onClick={clearCart}
          disabled={items.length === 0}
          title="Kosongkan Keranjang"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-5 pt-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-16 text-center space-y-4">
            <div className="p-6 bg-slate-50 dark:bg-slate-800/30 rounded-full border-2 border-dashed border-slate-100 dark:border-slate-800">
              <ShoppingCartIcon className="h-12 w-12 opacity-10" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-slate-500 dark:text-slate-400">Keranjang Kosong</p>
              <p className="text-xs">Silahkan pilih produk di sebelah kiri</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {items.map((item) => (
              <div
                key={item.product_id}
                className="group flex flex-col space-y-3 pb-4 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 space-y-1">
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200 leading-tight block truncate">
                      {item.product_name}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {formatRupiah(item.price)} x {item.quantity}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-black text-slate-900 dark:text-white">
                      {formatRupiah(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-lg p-1 border border-slate-100 dark:border-slate-700">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm"
                      onClick={() => updateQuantity(item.product_id, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-xs font-black text-slate-900 dark:text-white">
                      {item.quantity}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm"
                      onClick={() => updateQuantity(item.product_id, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive/50 hover:text-destructive hover:bg-destructive/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeItem(item.product_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Receipt Footer / Totals */}
      <div className="p-6 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 space-y-5">
        <div className="space-y-2.5">
          <div className="flex justify-between items-center text-sm font-medium">
            <span className="text-slate-500">Subtotal</span>
            <span className="text-slate-900 dark:text-white font-bold">{formatRupiah(subtotal)}</span>
          </div>
          
          {discountTotal > 0 && (
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <Tag className="h-3.5 w-3.5" />
                <span>Diskon {discount_name && `(${discount_name})`}</span>
              </div>
              <span className="text-emerald-600 dark:text-emerald-400 font-black">-{formattedDiscount}</span>
            </div>
          )}
          
          {tax_enabled && tax_rate > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium">
                {tax_label} ({tax_rate}%{tax_included ? " Incl." : ""})
              </span>
              <span className="text-slate-900 dark:text-white font-bold">{formatRupiah(tax)}</span>
            </div>
          )}
          
          <Separator className="bg-slate-200 dark:bg-slate-800" />
          
          <div className="flex justify-between items-end pt-1">
            <span className="font-black text-slate-500 uppercase tracking-widest text-xs mb-1">Total Bayar</span>
            <span className="font-black text-3xl text-primary tracking-tight">
              {formatRupiah(total)}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="w-full flex gap-2 h-11 font-bold border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-95"
              onClick={onDiscount}
              disabled={items.length === 0}
            >
              <Percent className="h-4 w-4" /> Diskon
            </Button>
            <Button
              variant="outline"
              className="w-full flex gap-2 h-11 font-bold border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 text-destructive hover:text-destructive active:scale-95"
              onClick={clearCart}
              disabled={items.length === 0}
            >
              <Info className="h-4 w-4" /> Void
            </Button>
          </div>
          
          <Button
            size="lg"
            className="w-full h-16 text-xl font-black uppercase tracking-wider flex items-center justify-center gap-3 shadow-lg shadow-primary/20 active:scale-[0.98] transition-all rounded-xl"
            onClick={onCheckout}
            disabled={items.length === 0}
          >
            <Banknote className="h-6 w-6" /> BAYAR
          </Button>
        </div>
      </div>
    </div>
  );
}

function ShoppingCartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}
