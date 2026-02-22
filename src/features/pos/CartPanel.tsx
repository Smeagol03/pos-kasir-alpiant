import { useCartStore } from "../../store/cartStore";
import { formatRupiah } from "../../lib/currency";
import { Button } from "../../components/ui/button";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Trash2, Plus, Minus, Tag, Banknote, Percent } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useState } from "react";

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
    setItemDiscount,
  } = useCartStore();

  const [discountItemOpen, setDiscountItemOpen] = useState<{
    id: number;
    name: string;
    amount: number;
  } | null>(null);
  const [discountItemInput, setDiscountItemInput] = useState("");

  const handleApplyItemDiscount = () => {
    if (discountItemOpen) {
      setItemDiscount(discountItemOpen.id, Number(discountItemInput) || 0);
      setDiscountItemOpen(null);
    }
  };

  const subtotal = getSubtotal();
  const discountTotal = getDiscountAmount();
  const tax = getTaxAmount();
  const total = getTotal();

  let formattedDiscount = formatRupiah(discountTotal);
  if (discount_percent !== null) {
    formattedDiscount = `${discount_percent}% (-${formatRupiah(discountTotal)})`;
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-md border border-border">
      <div className="p-4 border-b border-border font-bold text-lg">
        Current Order
      </div>

      <ScrollArea className="flex-1 p-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 py-10">
            <ShoppingCartIcon className="h-16 w-16 mb-4" />
            <p>Cart is empty</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.product_id}
                className="flex flex-col space-y-2 pb-4 border-b border-border/50 last:border-0 last:pb-0"
              >
                <div className="flex justify-between items-start">
                  <span className="font-medium text-sm line-clamp-2 pr-2">
                    {item.product_name}
                  </span>
                  <div className="flex flex-col items-end">
                    <span className="font-bold whitespace-nowrap">
                      {formatRupiah(
                        item.price * item.quantity -
                          (item.discount_amount || 0),
                      )}
                    </span>
                    {(item.discount_amount || 0) > 0 && (
                      <span className="text-xs font-normal text-emerald-500">
                        -{formatRupiah(item.discount_amount)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-muted-foreground text-xs">
                    {formatRupiah(item.price)} x {item.quantity}
                  </span>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 mr-2"
                      onClick={() => {
                        setDiscountItemOpen({
                          id: item.product_id,
                          name: item.product_name,
                          amount: item.discount_amount || 0,
                        });
                        setDiscountItemInput(
                          (item.discount_amount || 0).toString(),
                        );
                      }}
                      title="Item discount"
                    >
                      <Percent className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.product_id, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.product_id, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-7 w-7 ml-2"
                      onClick={() => removeItem(item.product_id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-border bg-muted/10 space-y-3">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatRupiah(subtotal)}</span>
          </div>
          {discountTotal > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span className="flex items-center gap-1">
                Discount {discount_name && `(${discount_name})`}
              </span>
              <span>-{formattedDiscount}</span>
            </div>
          )}
          {tax_enabled && tax_rate > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>
                {tax_label} ({tax_rate}%{tax_included ? " Incl." : ""})
              </span>
              <span>{formatRupiah(tax)}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between items-end border-t border-border/50 pt-2">
          <span className="font-bold text-lg">Total</span>
          <span className="font-black text-2xl text-primary">
            {formatRupiah(total)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button
            variant="outline"
            className="w-full flex gap-2"
            onClick={onDiscount}
            disabled={items.length === 0}
          >
            <Tag className="h-4 w-4" /> Add Discount
          </Button>
          <Button
            variant="destructive"
            className="w-full"
            onClick={clearCart}
            disabled={items.length === 0}
          >
            Void Cart
          </Button>
        </div>
        <Button
          size="lg"
          className="w-full mt-2 h-14 text-xl flex items-center justify-center gap-2"
          onClick={onCheckout}
          disabled={items.length === 0}
        >
          <Banknote className="h-6 w-6" /> Pay
        </Button>
      </div>

      {discountItemOpen && (
        <Dialog
          open={!!discountItemOpen}
          onOpenChange={(open) => !open && setDiscountItemOpen(null)}
        >
          <DialogContent className="sm:max-w-[300px]">
            <DialogHeader>
              <DialogTitle>Discount for {discountItemOpen.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nominal Discount (Rp)</Label>
                <Input
                  type="number"
                  autoFocus
                  value={discountItemInput}
                  onChange={(e) => setDiscountItemInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleApplyItemDiscount();
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDiscountItemOpen(null)}>
                Cancel
              </Button>
              <Button onClick={handleApplyItemDiscount}>Apply</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
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
