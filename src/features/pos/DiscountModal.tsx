import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { useInvokeQuery } from "../../hooks/useInvokeQuery";
import { Discount } from "../../types";
import { useAuthStore } from "../../store/authStore";
import { useCartStore } from "../../store/cartStore";
import { formatRupiah } from "../../lib/currency";
import { ScrollArea } from "../../components/ui/scroll-area";

export function DiscountModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const { setDiscount, getSubtotal } = useCartStore();

  const { data: discounts, isLoading } = useInvokeQuery<Discount[]>(
    ["discounts"],
    "get_discounts",
    { sessionToken },
  );

  const subtotal = getSubtotal();

  const handleSelectDiscount = (discount: Discount) => {
    if (subtotal < discount.min_purchase) {
      alert(
        `Pemesanan minimum untuk diskon ini adalah ${formatRupiah(discount.min_purchase)}`,
      );
      return;
    }

    if (discount.type === "NOMINAL") {
      setDiscount(discount.id, discount.value);
    } else {
      setDiscount(discount.id, 0, discount.value);
    }
    onOpenChange(false);
  };

  const handleClearDiscount = () => {
    setDiscount(null, 0, null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply Discount</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          {isLoading ? (
            <div className="py-4 text-center">Loading...</div>
          ) : (
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="justify-start h-auto p-4"
                onClick={handleClearDiscount}
              >
                Clear Discount
              </Button>
              {discounts
                ?.filter((d) => d.is_active)
                .map((d) => (
                  <Button
                    key={d.id}
                    variant="outline"
                    className={`justify-start flex-col items-start h-auto p-4 ${subtotal < d.min_purchase ? "opacity-50" : ""}`}
                    onClick={() => handleSelectDiscount(d)}
                    disabled={subtotal < d.min_purchase}
                  >
                    <span className="font-bold">{d.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {d.type === "PERCENT"
                        ? `${d.value}% Off`
                        : formatRupiah(d.value)}{" "}
                      Off
                    </span>
                    {d.min_purchase > 0 && (
                      <span className="text-xs text-muted-foreground mt-1">
                        Min. {formatRupiah(d.min_purchase)}
                      </span>
                    )}
                  </Button>
                ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
