import { useState, useMemo } from "react";
import { useInvokeQuery } from "../hooks/useInvokeQuery";
import { ProductWithCategory } from "../types";
import { useAuthStore } from "../store/authStore";
import { DataTable, Column } from "../components/DataTable";
import { CurrencyDisplay } from "../components/CurrencyDisplay";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Plus, Settings2, Pencil, PackagePlus } from "lucide-react";
import { ProductForm } from "../features/inventory/ProductForm";
import { CategoryManager } from "../features/inventory/CategoryManager";
import { StockAdjust } from "../features/inventory/StockAdjust";

export default function InventoryPage() {
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [stockAdjustOpen, setStockAdjustOpen] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<ProductWithCategory | null>(null);

  const { data: products, isLoading } = useInvokeQuery<ProductWithCategory[]>(
    ["products", search, showInactive],
    "get_products",
    { sessionToken, search, categoryId: null, showInactive },
  );

  const handleEdit = (p: ProductWithCategory) => {
    setEditingProduct(p);
    setFormOpen(true);
  };

  const handleNewProduct = () => {
    setEditingProduct(null);
    setFormOpen(true);
  };

  const handleAdjustStock = (p: ProductWithCategory) => {
    setEditingProduct(p);
    setStockAdjustOpen(true);
  };

  const columns = useMemo<Column<ProductWithCategory>[]>(
    () => [
      {
        header: "Status",
        cell: (p) => (
          <Badge variant={p.is_active ? "default" : "secondary"}>
            {p.is_active ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        header: "Name",
        accessorKey: "name",
        className: "font-medium",
      },
      {
        header: "Category",
        cell: (p) => p.category_name || "-",
      },
      {
        header: "SKU/Barcode",
        cell: (p) => (
          <div className="text-xs text-muted-foreground">
            {p.sku && <div>SKU: {p.sku}</div>}
            {p.barcode && <div>BC: {p.barcode}</div>}
          </div>
        ),
      },
      {
        header: "Price",
        cell: (p) => <CurrencyDisplay amount={p.price} />,
      },
      {
        header: "Stock",
        cell: (p) => (
          <div className="flex items-center gap-2">
            <span
              className={`font-bold ${p.stock <= 5 ? "text-destructive" : ""}`}
            >
              {p.stock}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6 ml-2"
              onClick={() => handleAdjustStock(p)}
            >
              <PackagePlus className="h-3 w-3" />
            </Button>
          </div>
        ),
      },
      {
        header: "Actions",
        cell: (p) => (
          <Button variant="ghost" size="sm" onClick={() => handleEdit(p)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">
            Manage your products, stock, and categories.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCatManagerOpen(true)}>
            <Settings2 className="mr-2 h-4 w-4" />
            Categories
          </Button>
          <Button onClick={handleNewProduct}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardHeader className="py-4 border-b">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Product List</CardTitle>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInactive(!showInactive)}
                className={
                  showInactive ? "text-primary" : "text-muted-foreground"
                }
              >
                {showInactive ? "Hide Inactive" : "Show Inactive"}
              </Button>
              <Input
                placeholder="Search products..."
                className="w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading products...
            </div>
          ) : (
            <DataTable
              data={products || []}
              columns={columns}
              keyExtractor={(p) => p.id}
            />
          )}
        </CardContent>
      </Card>

      <ProductForm
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editingProduct}
      />

      <CategoryManager open={catManagerOpen} onOpenChange={setCatManagerOpen} />

      <StockAdjust
        open={stockAdjustOpen}
        onOpenChange={setStockAdjustOpen}
        product={editingProduct}
      />
    </div>
  );
}
