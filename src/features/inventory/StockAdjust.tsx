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
import { Label } from "../../components/ui/label";
import { ProductWithCategory } from "../../types";
import { useInvokeMutation } from "../../hooks/useInvokeQuery";
import { useAuthStore } from "../../store/authStore";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../hooks/use-toast";

export function StockAdjust({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductWithCategory | null;
}) {
  const [deltaStr, setDeltaStr] = useState("");
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const adjustMutation = useInvokeMutation<number>("adjust_stock", {
    onSuccess: (newStock) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "Stock Adjusted",
        description: `New stock is ${newStock}`,
      });
      onOpenChange(false);
      setDeltaStr("");
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Error", description: String(e) }),
  });

  const handleAdjust = () => {
    const delta = Number(deltaStr);
    if (!product || isNaN(delta) || delta === 0) return;
    adjustMutation.mutate({ sessionToken, productId: product.id, delta });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
        </DialogHeader>

        {product && (
          <div className="space-y-4 py-4">
            <div className="flex justify-between items-center text-sm p-3 bg-muted rounded-md mb-4">
              <span className="font-medium">{product.name}</span>
              <span>
                Current Stock:{" "}
                <strong className="text-lg">{product.stock}</strong>
              </span>
            </div>

            <div className="space-y-2">
              <Label>Adjustment (+/-)</Label>
              <Input
                type="number"
                placeholder="e.g. 5 to add, -3 to reduce"
                value={deltaStr}
                onChange={(e) => setDeltaStr(e.target.value)}
              />
              <p className="text-xs text-muted-foreground pt-1">
                Amount will be added to the current stock. Use negative numbers
                to decrease.
              </p>
            </div>

            {deltaStr && !isNaN(Number(deltaStr)) && (
              <div className="p-3 bg-primary/10 rounded-md border border-primary/20 text-center">
                Expected new stock:{" "}
                <strong className="text-primary">
                  {Math.max(0, product.stock + Number(deltaStr))}
                </strong>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdjust}
            disabled={
              adjustMutation.isPending ||
              !deltaStr ||
              isNaN(Number(deltaStr)) ||
              Number(deltaStr) === 0
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
