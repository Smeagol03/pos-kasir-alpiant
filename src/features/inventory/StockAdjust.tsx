import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { ProductWithCategory } from "../../types";
import { useInvokeMutation } from "../../hooks/useInvokeQuery";
import { useAuthStore } from "../../store/authStore";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../hooks/use-toast";
import { NumericInput } from "../../components/NumericInput";

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

  const getStockColor = (stock: number) => {
    if (stock <= 0) return "text-red-600 font-black";
    if (stock < 10) return "text-red-500 font-bold";
    if (stock < 50) return "text-amber-500 font-bold";
    return "text-emerald-600 font-bold";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
        </DialogHeader>

        {product && (
          <div className="space-y-4 py-4">
            <div className="flex justify-between items-center text-sm p-3 bg-muted rounded-md mb-4 border border-border">
              <span className="font-bold text-slate-700 dark:text-slate-300">{product.name}</span>
              <span className="flex items-center gap-2">
                Stok Saat Ini:{" "}
                <strong className={`text-xl ${getStockColor(product.stock)}`}>
                  {product.stock}
                </strong>
              </span>
            </div>

            <div className="space-y-2">
              <Label>Adjustment (+/-)</Label>
              <NumericInput
                placeholder="Misal: 5 untuk tambah, -3 untuk kurang"
                value={deltaStr === "" ? 0 : Number(deltaStr)}
                onChange={(val: number) => setDeltaStr(val.toString())}
              />
              <p className="text-[10px] text-muted-foreground pt-1 leading-tight uppercase font-bold">
                Angka akan ditambahkan ke stok saat ini. Gunakan angka negatif untuk mengurangi.
              </p>
            </div>

            {deltaStr !== "" && deltaStr !== "0" && (
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 text-center">
                <span className="text-xs font-bold text-muted-foreground uppercase">Estimasi Stok Baru:</span>
                <div className={`text-2xl font-black ${getStockColor(Math.max(0, product.stock + Number(deltaStr)))}`}>
                  {Math.max(0, product.stock + Number(deltaStr))}
                </div>
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
