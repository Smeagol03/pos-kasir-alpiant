import { useState } from "react";
import { useInvokeQuery } from "../../hooks/useInvokeQuery";
import { ProductWithCategory, CategoryWithCount } from "../../types";
import { useAuthStore } from "../../store/authStore";
import { useCartStore } from "../../store/cartStore";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Search, ShoppingCart, Info } from "lucide-react";
import { ScrollArea } from "../../components/ui/scroll-area";
import { formatRupiah } from "../../lib/currency";
import { Badge } from "../../components/ui/badge";

export function ProductGrid() {
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const addItem = useCartStore((s) => s.addItem);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  const { data: categories } = useInvokeQuery<CategoryWithCount[]>(
    ["categories"],
    "get_categories",
    { sessionToken },
  );

  const { data: products, isLoading } = useInvokeQuery<ProductWithCategory[]>(
    ["products", search, categoryId],
    "get_products",
    { sessionToken, search, categoryId, showInactive: false },
  );

  const handleAddToCart = (p: ProductWithCategory) => {
    addItem({
      product_id: p.id,
      product_name: p.name,
      price: p.price,
      quantity: 1,
      discount_amount: 0,
    });
  };

  // Function to get initials or placeholder for product
  const getProductInitial = (name: string) => {
    return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  };

  // Generate a consistent color based on product name
  const getProductColor = (name: string) => {
    const colors = [
      "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
      "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
      "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
      "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
      "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex flex-col space-y-4">
        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 transition-colors group-focus-within:text-primary" />
          <Input
            placeholder="Cari produk berdasarkan nama atau barcode (scan)..."
            className="pl-11 h-12 bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-800 rounded-xl transition-all focus:ring-2 focus:ring-primary/20 focus:bg-white dark:focus:bg-slate-900"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={categoryId === null ? "default" : "outline"}
            className={`rounded-full px-5 h-9 text-xs font-bold transition-all ${
              categoryId === null 
              ? "bg-slate-900 dark:bg-white dark:text-slate-900 shadow-md" 
              : "bg-white dark:bg-slate-900/50 hover:bg-slate-50 border-slate-200 dark:border-slate-800"
            }`}
            onClick={() => setCategoryId(null)}
          >
            Semua
          </Button>
          {categories?.map((c) => (
            <Button
              key={c.id}
              variant={categoryId === c.id ? "default" : "outline"}
              className={`rounded-full px-5 h-9 text-xs font-bold transition-all ${
                categoryId === c.id 
                ? "bg-slate-900 dark:bg-white dark:text-slate-900 shadow-md" 
                : "bg-white dark:bg-slate-900/50 hover:bg-slate-50 border-slate-200 dark:border-slate-800"
              }`}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1 -mx-4 px-4 h-full">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pt-1">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="h-44 bg-slate-100 dark:bg-slate-800/50 animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pt-1 pb-8">
            {products?.map((p) => (
              <Card
                key={p.id}
                className={`group relative overflow-hidden border-slate-200 dark:border-slate-800 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:scale-95 cursor-pointer rounded-2xl bg-white dark:bg-slate-900/50 ${
                  p.stock <= 0 ? "opacity-60 grayscale cursor-not-allowed" : ""
                }`}
                onClick={() => p.stock > 0 && handleAddToCart(p)}
              >
                {/* Product Image/Initial Placeholder */}
                <div className={`h-24 flex items-center justify-center font-black text-2xl tracking-tighter transition-transform group-hover:scale-110 ${getProductColor(p.name)}`}>
                  {getProductInitial(p.name)}
                </div>

                <CardContent className="p-3">
                  <div className="flex flex-col space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-primary/70 truncate">
                      {p.category_name || "Tanpa Kategori"}
                    </div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 min-h-[2.5rem] leading-tight group-hover:text-primary transition-colors">
                      {p.name}
                    </div>
                    
                    <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 mt-2">
                      <div className="font-black text-slate-900 dark:text-white">
                        {formatRupiah(p.price)}
                      </div>
                      <Badge variant={p.stock <= 5 ? "destructive" : "secondary"} className="text-[10px] h-5 font-bold rounded-md px-1.5">
                        {p.stock}
                      </Badge>
                    </div>
                  </div>
                </CardContent>

                {/* Hover Action Overlay */}
                {p.stock > 0 && (
                  <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <div className="bg-white dark:bg-slate-900 text-primary p-2 rounded-full shadow-lg transform scale-50 group-hover:scale-100 transition-transform duration-300">
                      <ShoppingCart className="h-5 w-5 fill-primary/20" />
                    </div>
                  </div>
                )}
              </Card>
            ))}
            {products?.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-muted-foreground bg-slate-50 dark:bg-slate-900/20 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                <Info className="h-10 w-10 mb-4 opacity-20" />
                <p className="font-medium">Tidak ada produk ditemukan.</p>
                <Button variant="link" onClick={() => { setSearch(""); setCategoryId(null); }}>
                  Reset filter
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
