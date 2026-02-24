import { useState, useEffect } from "react";
import { useInvokeQuery, useInvoke } from "../../hooks/useInvokeQuery";
import { ProductWithCategory, CategoryWithCount } from "../../types";
import { useAuthStore } from "../../store/authStore";
import { useCartStore } from "../../store/cartStore";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Search, PackageX } from "lucide-react";
import { ScrollArea } from "../../components/ui/scroll-area";
import { formatRupiah } from "../../lib/currency";

// === Product Image Component ===
function ProductImage({
  product,
  getProductColor,
  getProductInitial,
}: {
  product: ProductWithCategory;
  getProductColor: (name: string) => string;
  getProductInitial: (name: string) => string;
}) {
  const [imageError, setImageError] = useState(false);
  const [imgSrc, setImgSrc] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { invoke } = useInvoke();
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const hasImage = !!(product.image_path && product.image_path.trim() !== "");

  useEffect(() => {
    setImageError(false);
    setImgSrc("");
    setIsLoading(false);
  }, [product.id]);

  useEffect(() => {
    if (hasImage && product.image_path && sessionToken) {
      setIsLoading(true);
      invoke<string>("get_product_image", {
        sessionToken,
        productId: product.id,
      })
        .then((base64Data) => setImgSrc(base64Data))
        .catch(() => setImageError(true))
        .finally(() => setIsLoading(false));
    }
  }, [hasImage, product.image_path, product.id, sessionToken]);

  if (isLoading) {
    return (
      <div className="aspect-square w-full bg-muted/30 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-muted-foreground/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (hasImage && !imageError && imgSrc) {
    return (
      <div className="aspect-square w-full bg-muted/10 overflow-hidden">
        <img
          src={imgSrc}
          alt={product.name}
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`aspect-square w-full flex items-center justify-center text-xl font-bold ${getProductColor(product.name)}`}
    >
      {getProductInitial(product.name)}
    </div>
  );
}

// === Main Component ===
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

  const { items } = useCartStore();

  const handleAddToCart = (p: ProductWithCategory) => {
    const cartItem = items.find((item) => item.product_id === p.id);
    const currentQuantity = cartItem ? cartItem.quantity : 0;

    if (currentQuantity >= p.stock) {
      alert(`Stok tidak mencukupi. Stok tersedia: ${p.stock}`);
      return;
    }

    addItem({
      product_id: p.id,
      product_name: p.name,
      price: p.price,
      quantity: 1,
      discount_amount: 0,
    });
  };

  const getProductInitial = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  const getProductColor = (name: string) => {
    const colors = [
      "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
      "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400",
      "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
      "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
      "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400",
      "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400",
      "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getStockLabel = (stock: number) => {
    if (stock <= 0) return { text: "Habis", className: "text-red-500" };
    if (stock < 10)
      return { text: `Sisa ${stock}`, className: "text-amber-500" };
    return { text: `${stock}`, className: "text-muted-foreground" };
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Search & Filter */}
      <div className="flex-shrink-0 space-y-3 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari produk..."
            className="pl-10 h-10 rounded-lg bg-muted/40 border-border/50 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={categoryId === null ? "default" : "ghost"}
            size="sm"
            className="h-7 px-3 text-xs rounded-md"
            onClick={() => setCategoryId(null)}
          >
            Semua
          </Button>
          {categories?.map((c) => (
            <Button
              key={c.id}
              variant={categoryId === c.id ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs rounded-md"
              onClick={() => setCategoryId(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <ScrollArea className="flex-1 -mx-4 px-4">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2.5">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className="rounded-lg overflow-hidden border border-border/40 bg-card"
              >
                <div className="aspect-square bg-muted/30 animate-pulse" />
                <div className="p-2.5 space-y-1.5">
                  <div className="h-3 bg-muted/40 rounded w-3/4 animate-pulse" />
                  <div className="h-3.5 bg-muted/40 rounded w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 pb-6">
            {products?.map((p) => {
              const isOutOfStock = p.stock <= 0;
              const stock = getStockLabel(p.stock);

              return (
                <div
                  key={p.id}
                  className={`
                    rounded-lg overflow-hidden border border-border/40 bg-card
                    transition-transform duration-150 ease-out
                    ${
                      isOutOfStock
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer hover:scale-[1.03] active:scale-[0.98]"
                    }
                  `}
                  onClick={() => !isOutOfStock && handleAddToCart(p)}
                >
                  {/* Image */}
                  <div className="relative">
                    <ProductImage
                      product={p}
                      getProductColor={getProductColor}
                      getProductInitial={getProductInitial}
                    />
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                        <span className="text-[10px] font-semibold text-muted-foreground bg-background/80 px-2 py-0.5 rounded-full">
                          Habis
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2.5">
                    <h3 className="text-xs font-medium text-foreground line-clamp-2 leading-snug mb-1">
                      {p.name}
                    </h3>
                    <div className="flex items-end justify-between gap-1">
                      <span className="text-sm font-bold text-primary">
                        {formatRupiah(p.price)}
                      </span>
                      <span
                        className={`text-[10px] font-medium ${stock.className}`}
                      >
                        {stock.text}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Empty State */}
            {products?.length === 0 && (
              <div className="col-span-full py-16 flex flex-col items-center text-center">
                <PackageX className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">
                  Produk Tidak Ditemukan
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Coba ubah kata kunci atau reset filter.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    setSearch("");
                    setCategoryId(null);
                  }}
                >
                  Reset
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
