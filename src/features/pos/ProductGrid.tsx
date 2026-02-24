import { useState, useEffect } from "react";
import { useInvokeQuery, useInvoke } from "../../hooks/useInvokeQuery";
import { ProductWithCategory, CategoryWithCount } from "../../types";
import { useAuthStore } from "../../store/authStore";
import { useCartStore } from "../../store/cartStore";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Search, PackageX, Sparkles, TrendingUp, Plus } from "lucide-react";
import { ScrollArea } from "../../components/ui/scroll-area";
import { formatRupiah } from "../../lib/currency";

interface ProductImageProps {
  product: ProductWithCategory;
  hasImage: boolean;
  getProductColor: (name: string) => string;
  getProductInitial: (name: string) => string;
}

function ProductImage({ product, hasImage, getProductColor, getProductInitial }: ProductImageProps) {
  const [imageError, setImageError] = useState(false);
  const [imgSrc, setImgSrc] = useState<string>("");
  const [imageKey, setImageKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { invoke } = useInvoke();
  const sessionToken = useAuthStore((s) => s.sessionToken);

  // Reset image state when product changes
  useEffect(() => {
    setImageError(false);
    setImageKey((prev) => prev + 1);
    setImgSrc("");
    setIsLoading(false);
  }, [product.id]);

  // Load image as base64
  useEffect(() => {
    if (hasImage && product.image_path && sessionToken) {
      setIsLoading(true);
      invoke<string>("get_product_image", {
        sessionToken,
        productId: product.id,
      })
        .then((base64Data) => {
          setImgSrc(base64Data);
        })
        .catch(() => {
          setImageError(true);
        })
        .finally(() => setIsLoading(false));
    }
  }, [hasImage, product.image_path, product.id, sessionToken, imageKey]);

  if (isLoading) {
    return (
      <div className="h-24 w-full bg-muted/30 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-muted-foreground/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (hasImage && !imageError && imgSrc) {
    return (
      <div className="h-24 w-full bg-muted/20">
        <img
          key={imageKey}
          src={imgSrc}
          alt={product.name}
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`h-24 w-full flex items-center justify-center font-bold text-xl ${getProductColor(product.name)}`}>
      {getProductInitial(product.name)}
    </div>
  );
}

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

  const getStockStatus = (stock: number) => {
    if (stock <= 0)
      return {
        bg: "bg-red-500/10",
        text: "text-red-500",
        label: "Habis",
        dot: "bg-red-500",
        progress: 0,
      };
    if (stock < 10)
      return {
        bg: "bg-amber-500/10",
        text: "text-amber-500",
        label: `Sisa ${stock}`,
        dot: "bg-amber-500",
        progress: Math.min((stock / 10) * 100, 100),
      };
    if (stock < 50)
      return {
        bg: "bg-sky-500/10",
        text: "text-sky-500",
        label: `Stok ${stock}`,
        dot: "bg-sky-500",
        progress: Math.min((stock / 50) * 100, 100),
      };
    return {
      bg: "bg-emerald-500/10",
      text: "text-emerald-500",
      label: `Stok ${stock}`,
      dot: "bg-emerald-500",
      progress: 100,
    };
  };

  const getProductInitial = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getProductColor = (name: string) => {
    const gradients = [
      "bg-gradient-to-br from-rose-400 via-pink-500 to-fuchsia-600 text-white",
      "bg-gradient-to-br from-blue-400 via-indigo-500 to-violet-600 text-white",
      "bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 text-white",
      "bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 text-white",
      "bg-gradient-to-br from-violet-400 via-purple-500 to-indigo-600 text-white",
      "bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 text-white",
      "bg-gradient-to-br from-lime-400 via-green-500 to-emerald-600 text-white",
      "bg-gradient-to-br from-fuchsia-400 via-pink-500 to-rose-600 text-white",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Search & Filter Section */}
      <div className="flex-shrink-0 space-y-4 pb-4">
        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
          <Input
            placeholder="Cari produk..."
            className="pl-11 h-11 rounded-xl bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="text-xs font-medium">Clear</span>
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={categoryId === null ? "default" : "outline"}
            size="sm"
            className={`h-8 px-4 text-xs rounded-lg font-medium transition-all ${
              categoryId === null
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-transparent hover:bg-muted border-border"
            }`}
            onClick={() => setCategoryId(null)}
          >
            Semua
          </Button>
          {categories?.map((c) => (
            <Button
              key={c.id}
              variant={categoryId === c.id ? "default" : "outline"}
              size="sm"
              className={`h-8 px-4 text-xs rounded-lg font-medium transition-all ${
                categoryId === c.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-transparent hover:bg-muted border-border"
              }`}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <ScrollArea className="flex-1 -mx-4 px-4">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-card rounded-xl overflow-hidden border border-border/50">
                <div className="h-24 bg-muted/40 animate-pulse" />
                <div className="p-2.5 space-y-1.5">
                  <div className="h-3 bg-muted/40 rounded w-3/4 animate-pulse" />
                  <div className="h-3.5 bg-muted/40 rounded w-1/2 animate-pulse" />
                  <div className="h-2 bg-muted/40 rounded w-1/3 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 pb-6">
            {products?.map((p) => {
              const isOutOfStock = p.stock <= 0;
              const stock = getStockStatus(p.stock);
              const hasImage = !!(p.image_path && p.image_path.trim() !== "");
              const isLowStock = p.stock > 0 && p.stock < 10;
              const isBestSeller = p.stock >= 50;

              return (
                <Card
                  key={p.id}
                  className={`group cursor-pointer rounded-xl overflow-hidden border border-border/50 bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200 ${
                    isOutOfStock
                      ? "opacity-60 cursor-not-allowed hover:shadow-none hover:border-border/50"
                      : ""
                  }`}
                  onClick={() => !isOutOfStock && handleAddToCart(p)}
                >
                  {/* Image Section */}
                  <div className="relative">
                    <ProductImage
                      product={p}
                      hasImage={hasImage}
                      getProductColor={getProductColor}
                      getProductInitial={getProductInitial}
                    />
                    
                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {isBestSeller && !isOutOfStock && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500 text-white shadow-sm">
                          <TrendingUp className="w-2.5 h-2.5" />
                          Best
                        </span>
                      )}
                      {isLowStock && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-500 text-white shadow-sm">
                          <Sparkles className="w-2.5 h-2.5" />
                          Limited
                        </span>
                      )}
                    </div>

                    {/* Out of Stock Overlay */}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <span className="text-xs font-bold text-muted-foreground bg-background/80 px-3 py-1 rounded-full">
                          Habis
                        </span>
                      </div>
                    )}

                    {/* Add to Cart Button */}
                    {!isOutOfStock && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                          <Plus className="w-3.5 h-3.5" />
                          Tambah
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content Section */}
                  <CardContent className="p-2.5">
                    {/* Product Name */}
                    <h3 className="font-medium text-xs text-foreground line-clamp-2 leading-tight mb-1">
                      {p.name}
                    </h3>

                    {/* Price */}
                    <div className="font-bold text-sm text-primary mb-1.5">
                      {formatRupiah(p.price)}
                    </div>

                    {/* Stock Indicator */}
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${stock.dot}`}
                          style={{ width: `${stock.progress}%` }}
                        />
                      </div>
                      <span className={`text-[9px] font-medium ${stock.text}`}>
                        {stock.label}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Empty State */}
            {products?.length === 0 && (
              <div className="col-span-full py-16 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <PackageX className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">
                  Produk Tidak Ditemukan
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs mb-4">
                  Tidak ada produk yang sesuai dengan pencarian atau filter Anda.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => {
                    setSearch("");
                    setCategoryId(null);
                  }}
                >
                  Reset Filter
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
