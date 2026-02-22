import { useState } from "react";
import { useInvokeQuery } from "../../hooks/useInvokeQuery";
import { ProductWithCategory, CategoryWithCount } from "../../types";
import { useAuthStore } from "../../store/authStore";
import { useCartStore } from "../../store/cartStore";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Search } from "lucide-react";
import { ScrollArea } from "../../components/ui/scroll-area";
import { formatRupiah } from "../../lib/currency";

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

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products by name or barcode..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="w-full whitespace-nowrap pb-2">
        <div className="flex space-x-2">
          <Button
            variant={categoryId === null ? "default" : "outline"}
            onClick={() => setCategoryId(null)}
          >
            All Categories
          </Button>
          {categories?.map((c) => (
            <Button
              key={c.id}
              variant={categoryId === c.id ? "default" : "outline"}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name} ({c.product_count})
            </Button>
          ))}
        </div>
      </ScrollArea>

      <ScrollArea className="flex-1 -mx-4 px-4">
        {isLoading ? (
          <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {[...Array(15)].map((_, i) => (
              <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 pb-4">
            {products?.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary ${
                  p.stock <= 0 ? "opacity-50 grayscale" : ""
                }`}
                onClick={() => p.stock > 0 && handleAddToCart(p)}
              >
                <CardContent className="p-3 flex flex-col h-full justify-between items-center text-center">
                  <div className="font-medium line-clamp-2 min-h-[2.5rem] leading-tight text-sm mb-2">
                    {p.name}
                  </div>
                  <div className="w-full flex items-center justify-between text-xs mt-auto">
                    <span className="font-bold text-accent">
                      {formatRupiah(p.price)}
                    </span>
                    <span className="text-muted-foreground">
                      Stk: {p.stock}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {products?.length === 0 && (
              <div className="col-span-full py-10 text-center text-muted-foreground">
                No products found.
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
