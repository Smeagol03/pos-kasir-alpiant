import { useState, useEffect } from "react";
import { ProductGrid } from "../features/pos/ProductGrid";
import { CartPanel } from "../features/pos/CartPanel";
import { DiscountModal } from "../features/pos/DiscountModal";
import { PaymentModal } from "../features/pos/PaymentModal";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { ProductWithCategory, AppSettings, Discount } from "../types";
import { useAuthStore } from "../store/authStore";
import { useCartStore } from "../store/cartStore";
import { invoke } from "../lib/tauri";
import { useToast } from "../hooks/use-toast";

export default function POSPage() {
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const { 
    addItem, 
    setTaxConfig, 
    getSubtotal, 
    setDiscount, 
    manual_discount_applied,
    items 
  } = useCartStore();
  const { toast } = useToast();

  // Load Settings (Tax)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await invoke<AppSettings>("get_settings", { sessionToken });
        setTaxConfig(
          settings.tax.rate,
          settings.tax.is_included,
          settings.tax.label,
          settings.tax.is_enabled
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
        const discounts = await invoke<Discount[]>("get_discounts", { sessionToken });
        const subtotal = getSubtotal();
        
        // Filter automatic and active discounts that meet min_purchase
        const validAutoDiscounts = discounts.filter(d => 
          d.is_active && d.is_automatic && subtotal >= d.min_purchase
        );

        if (validAutoDiscounts.length > 0) {
          // Find the one with most benefit
          // For simplicity, let's pick the one with highest value (if same type)
          // or just the first one for now, or you can implement complex logic
          const bestDiscount = validAutoDiscounts.reduce((prev, current) => {
            const prevVal = prev.type === 'PERCENT' ? subtotal * (prev.value / 100) : prev.value;
            const currVal = current.type === 'PERCENT' ? subtotal * (current.value / 100) : current.value;
            return currVal > prevVal ? current : prev;
          });

          setDiscount(
            bestDiscount.id, 
            bestDiscount.name, 
            bestDiscount.type === 'NOMINAL' ? bestDiscount.value : 0,
            bestDiscount.type === 'PERCENT' ? bestDiscount.value : null,
            false // not manual
          );
        } else {
          // Clear auto discount if no longer valid
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

        if (product.stock > 0) {
          addItem({
            product_id: product.id,
            product_name: product.name,
            price: product.price,
            quantity: 1,
            discount_amount: 0,
          });
          toast({
            title: "Added to Cart",
            description: `${product.name} scanned successfully.`,
          });
        } else {
          toast({
            variant: "destructive",
            title: "Out of Stock",
            description: `${product.name} is out of stock.`,
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Product Not Found",
          description: `No product found for barcode: ${barcode}`,
        });
      }
    },
  });

  return (
    <div className="flex h-full p-4 gap-4 bg-muted/20">
      <div className="flex-1 min-w-0">
        <ProductGrid />
      </div>

      <div className="w-[400px] flex-shrink-0">
        <CartPanel
          onDiscount={() => setDiscountModalOpen(true)}
          onCheckout={() => setPaymentModalOpen(true)}
        />
      </div>

      <DiscountModal
        open={discountModalOpen}
        onOpenChange={setDiscountModalOpen}
      />

      <PaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        onSuccess={(tx) => {
          toast({
            title: "Transaction Successful",
            description: `Payment processing complete. ID: ${tx.id.split("-")[0]}`,
          });
        }}
      />
    </div>
  );
}
