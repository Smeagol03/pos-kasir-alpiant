import { useState, useEffect } from "react";
import { AlertTriangle, Package, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { ProductWithCategory } from "../types";
import { useAuthStore } from "../store/authStore";
import { invoke } from "../lib/tauri";
import { useNavigate } from "@tanstack/react-router";

export function LowStockAlert() {
  const [open, setOpen] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState<
    ProductWithCategory[]
  >([]);
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionToken) return;

    // Cek apakah sudah ditampilkan hari ini
    const today = new Date().toDateString();
    const dismissedDate = sessionStorage.getItem("lowStockDismissed");
    if (dismissedDate === today) return;

    const checkLowStock = async () => {
      try {
        const products = await invoke<ProductWithCategory[]>(
          "get_low_stock_products",
          { sessionToken },
        );
        if (products.length > 0) {
          setLowStockProducts(products);
          setOpen(true);
        }
      } catch (error) {
        console.error("Failed to check low stock:", error);
      }
    };

    // Delay sedikit agar UI utama sudah terender
    const timer = setTimeout(checkLowStock, 1500);
    return () => clearTimeout(timer);
  }, [sessionToken]);

  const handleDismiss = () => {
    sessionStorage.setItem("lowStockDismissed", new Date().toDateString());
    setOpen(false);
  };

  const handleGoToInventory = () => {
    setOpen(false);
    if (user?.role === "ADMIN") {
      navigate({ to: "/inventory" });
    }
  };

  if (lowStockProducts.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Peringatan Stok Kritis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {lowStockProducts.length} produk memiliki stok rendah dan perlu
            segera di-restock:
          </p>

          <ScrollArea className="max-h-[300px] pr-3">
            <div className="space-y-2">
              {lowStockProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                >
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-amber-600 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      {product.category_name && (
                        <p className="text-xs text-muted-foreground">
                          {product.category_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={product.stock === 0 ? "destructive" : "secondary"}
                    className="font-bold"
                  >
                    {product.stock === 0 ? "HABIS" : `Sisa ${product.stock}`}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleDismiss}>
            Tutup Hari Ini
          </Button>
          {user?.role === "ADMIN" && (
            <Button onClick={handleGoToInventory}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Buka Inventory
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
