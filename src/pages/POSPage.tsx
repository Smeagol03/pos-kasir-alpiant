import { useState, useEffect } from "react";
import { ProductGrid } from "../features/pos/ProductGrid";
import { CartPanel } from "../features/pos/CartPanel";
import { DiscountModal } from "../features/pos/DiscountModal";
import { PaymentModal } from "../features/pos/PaymentModal";
import { ReceiptDialog } from "../features/pos/ReceiptDialog";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import {
  ProductWithCategory,
  AppSettings,
  Discount,
  Transaction,
} from "../types";
import { useAuthStore } from "../store/authStore";
import { useCartStore } from "../store/cartStore";
import { invoke } from "../lib/tauri";
import { useToast } from "../hooks/use-toast";
import { Clock, User as UserIcon, Calendar } from "lucide-react";

export default function POSPage() {
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(
    null,
  );
  const [currentTime, setCurrentTime] = useState(new Date());

  const sessionToken = useAuthStore((s) => s.sessionToken);
  const user = useAuthStore((s) => s.user);
  const {
    items,
    addItem,
    setTaxConfig,
    getSubtotal,
    setDiscount,
    manual_discount_applied,
  } = useCartStore();
  const { toast } = useToast();

  // Clock update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load Settings (Tax)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await invoke<AppSettings>("get_settings", {
          sessionToken,
        });
        setTaxConfig(
          settings.tax.rate,
          settings.tax.is_included,
          settings.tax.label,
          settings.tax.is_enabled,
        );
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };
    loadSettings();
  }, [sessionToken, setTaxConfig]);

  // Automatic Discount Logic
  useEffect(() => {
    if (manual_discount_applied || items.length === 0) return;

    const applyAutoDiscount = async () => {
      try {
        const discounts = await invoke<Discount[]>("get_discounts", {
          sessionToken,
        });
        const subtotal = getSubtotal();

        // Filter automatic and active discounts that meet min_purchase
        const validAutoDiscounts = discounts.filter(
          (d) => d.is_active && d.is_automatic && subtotal >= d.min_purchase,
        );

        if (validAutoDiscounts.length > 0) {
          const bestDiscount = validAutoDiscounts.reduce((prev, current) => {
            const prevVal =
              prev.type === "PERCENT"
                ? subtotal * (prev.value / 100)
                : prev.value;
            const currVal =
              current.type === "PERCENT"
                ? subtotal * (current.value / 100)
                : current.value;
            return currVal > prevVal ? current : prev;
          });

          setDiscount(
            bestDiscount.id,
            bestDiscount.name,
            bestDiscount.type === "NOMINAL" ? bestDiscount.value : 0,
            bestDiscount.type === "PERCENT" ? bestDiscount.value : null,
            false,
          );
        } else {
          setDiscount(null, null, 0, null, false);
        }
      } catch (error) {
        console.error("Failed to fetch discounts:", error);
      }
    };

    applyAutoDiscount();
  }, [items, getSubtotal, sessionToken, manual_discount_applied, setDiscount]);

  useBarcodeScanner({
    onScan: async (barcode) => {
      try {
        const product = await invoke<ProductWithCategory>(
          "get_product_by_barcode",
          {
            sessionToken,
            barcode,
          },
        );

        // Check stock before adding
        const cartItem = items.find((item) => item.product_id === product.id);
        const currentQuantity = cartItem ? cartItem.quantity : 0;

        if (product.stock > 0 && currentQuantity < product.stock) {
          addItem({
            product_id: product.id,
            product_name: product.name,
            price: product.price,
            quantity: 1,
            discount_amount: 0,
          });
          toast({
            title: "Berhasil Menambahkan",
            description: `${product.name} telah ditambahkan ke keranjang.`,
          });
        } else {
          toast({
            variant: "destructive",
            title: "Stok Tidak Mencukupi",
            description: `${product.name} habis atau mencapai batas stok yang tersedia (${product.stock}).`,
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Produk Tidak Ditemukan",
          description: `Barcode ${barcode} tidak terdaftar.`,
        });
      }
    },
  });

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-950/20">
      {/* Modern Top Header */}
      <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <UserIcon className="h-4 w-4" />
            <span className="text-sm font-medium">{user?.name}</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] uppercase tracking-wider font-bold">
              {user?.role}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 border-r pr-6 dark:border-slate-800">
            <Calendar className="h-4 w-4" />
            <span className="text-sm font-medium">
              {currentTime.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-primary font-mono font-bold">
            <Clock className="h-4 w-4" />
            <span className="text-sm">
              {currentTime.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Left Side: Product Grid */}
        <div className="flex-1 min-w-0 bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 flex-1 overflow-hidden">
            <ProductGrid />
          </div>
        </div>

        {/* Right Side: Cart Panel */}
        <div className="w-[420px] flex-shrink-0 flex flex-col h-full">
          <div className="flex-1 bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <CartPanel
              onDiscount={() => setDiscountModalOpen(true)}
              onCheckout={() => setPaymentModalOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <DiscountModal
        open={discountModalOpen}
        onOpenChange={setDiscountModalOpen}
      />

      <PaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        onSuccess={(tx) => {
          setLastTransaction(tx);
          setReceiptOpen(true);
          toast({
            title: "Transaksi Berhasil",
            description: `Pembayaran selesai. ID: ${tx.id.split("-")[0]}`,
          });
        }}
      />

      <ReceiptDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        transaction={lastTransaction}
      />
    </div>
  );
}
