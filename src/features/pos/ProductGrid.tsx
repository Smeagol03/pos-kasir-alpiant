import { useState, useEffect } from "react";
import { useInvokeQuery, useInvoke } from "../../hooks/useInvokeQuery";
import { ProductWithCategory, CategoryWithCount } from "../../types";
import { useAuthStore } from "../../store/authStore";
import { useCartStore } from "../../store/cartStore";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Search, PackageX } from "lucide-react";
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
  const { invoke } = useInvoke();
  const sessionToken = useAuthStore((s) => s.sessionToken);

  // Debug log
  useEffect(() => {
    console.log(`ProductImage: id=${product.id}, hasImage=${hasImage}, image_path=${product.image_path}`);
  }, [product.id, hasImage, product.image_path]);

  // Reset image state when product changes
  useEffect(() => {
    setImageError(false);
    setImageKey((prev) => prev + 1);
    setImgSrc("");
  }, [product.id]);

  // Load image as base64
  useEffect(() => {
    if (hasImage && product.image_path && sessionToken) {
      invoke<string>("get_product_image", {
        sessionToken,
        productId: product.id,
      })
        .then((base64Data) => {
          console.log(`ProductImage: Loaded image for product ${product.id}`);
          setImgSrc(base64Data);
        })
        .catch((err) => {
          console.error(`ProductImage: Failed to load image: ${err}`);
          setImageError(true);
        });
    }
  }, [hasImage, product.image_path, product.id, sessionToken, imageKey]);

  if (hasImage && !imageError && imgSrc) {
    return (
      <div className="h-24 w-full overflow-hidden bg-muted">
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
    <div
      className={`h-24 flex items-center justify-center font-bold text-3xl tracking-tight shadow-inner ${getProductColor(product.name)}`}
    >
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
        bg: "bg-destructive/10",
        text: "text-destructive",
        label: "Habis",
      };
    if (stock < 10)
      return {
        bg: "bg-orange-500/10",
        text: "text-orange-600 dark:text-orange-400",
        label: `Sisa ${stock}`,
      };
    if (stock < 50)
      return {
        bg: "bg-blue-500/10",
        text: "text-blue-600 dark:text-blue-400",
        label: `Sisa ${stock}`,
      };
    return {
      bg: "bg-emerald-500/10",
      text: "text-emerald-600 dark:text-emerald-400",
      label: `Stok ${stock}`,
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
      "bg-gradient-to-br from-red-500 to-rose-600 text-white",
      "bg-gradient-to-br from-blue-500 to-indigo-600 text-white",
      "bg-gradient-to-br from-emerald-400 to-teal-600 text-white",
      "bg-gradient-to-br from-amber-400 to-orange-500 text-white",
      "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white",
      "bg-gradient-to-br from-cyan-400 to-blue-500 text-white",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  };

  return (
    <div className="flex flex-col h-full space-y-4 bg-background">
      {/* Search & Filter */}
      <div className="space-y-4 pb-2">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary" />
          </div>
          <Input
            placeholder="Cari produk..."
            className="pl-10 h-11 rounded-xl bg-muted/40 border-transparent focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:bg-background focus-visible:border-primary/30 shadow-sm text-base"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={categoryId === null ? "default" : "secondary"}
            className={`h-8 px-4 text-xs rounded-full font-medium shadow-sm ${categoryId === null ? "" : "bg-muted/60 hover:bg-muted"}`}
            onClick={() => setCategoryId(null)}
          >
            Semua
          </Button>
          {categories?.map((c) => (
            <Button
              key={c.id}
              variant={categoryId === c.id ? "default" : "secondary"}
              className={`h-8 px-4 text-xs rounded-full font-medium shadow-sm ${categoryId === c.id ? "" : "bg-muted/60 hover:bg-muted"}`}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <ScrollArea className="flex-1 -mx-4 px-4 h-full">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {[...Array(15)].map((_, i) => (
              <div key={i} className="h-44 bg-muted/40 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 pb-8">
            {products?.map((p) => {
              const isOutOfStock = p.stock <= 0;
              const stock = getStockStatus(p.stock);
              const hasImage = !!(p.image_path && p.image_path.trim() !== "");

              return (
                <Card
                  key={p.id}
                  className={`cursor-pointer rounded-2xl overflow-hidden border border-border/40 shadow-sm hover:shadow-md hover:border-primary/30 bg-card ${
                    isOutOfStock
                      ? "opacity-60 cursor-not-allowed grayscale-[0.8]"
                      : ""
                  }`}
                  onClick={() => !isOutOfStock && handleAddToCart(p)}
                >
                  <ProductImage
                    product={p}
                    hasImage={hasImage}
                    getProductColor={getProductColor}
                    getProductInitial={getProductInitial}
                  />

                  <CardContent className="p-3.5 space-y-2.5">
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        {p.category_name || "Umum"}
                      </div>
                      <div className="font-semibold text-sm text-foreground line-clamp-2 leading-snug">
                        {p.name}
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col items-center gap-2 border-t border-border/40">
                      <div className="font-bold text-primary text-sm">
                        {formatRupiah(p.price)}
                      </div>
                      <div
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${stock.bg} ${stock.text}`}
                      >
                        {stock.label}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {products?.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border/50">
                <PackageX className="h-12 w-12 mb-3 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  Produk Tidak Ditemukan
                </h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                  Kami tidak dapat menemukan produk yang sesuai dengan pencarian
                  atau filter Anda.
                </p>
                <Button
                  variant="outline"
                  className="rounded-full shadow-sm"
                  onClick={() => {
                    setSearch("");
                    setCategoryId(null);
                  }}
                >
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
