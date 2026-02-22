import { useState } from "react";
import { ProductGrid } from "../features/pos/ProductGrid";
import { CartPanel } from "../features/pos/CartPanel";
import { DiscountModal } from "../features/pos/DiscountModal";
import { PaymentModal } from "../features/pos/PaymentModal";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { ProductWithCategory } from "../types";
import { useAuthStore } from "../store/authStore";
import { useCartStore } from "../store/cartStore";
import { invoke } from "../lib/tauri";
import { useToast } from "../hooks/use-toast";

export default function POSPage() {
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const addItem = useCartStore((s) => s.addItem);
  const { toast } = useToast();

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
