import { useState, useEffect } from "react";
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
import { Checkbox } from "../../components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { ProductWithCategory, CategoryWithCount } from "../../types";
import { useInvokeMutation, useInvokeQuery } from "../../hooks/useInvokeQuery";
import { useAuthStore } from "../../store/authStore";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../hooks/use-toast";

export function ProductForm({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductWithCategory | null; // null for create, object for edit
}) {
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    barcode: "",
    category_id: "none",
    price: "",
    stock: "",
    is_active: true,
  });

  const sessionToken = useAuthStore((s) => s.sessionToken);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: categories } = useInvokeQuery<CategoryWithCount[]>(
    ["categories"],
    "get_categories",
    { sessionToken },
  );

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        sku: product.sku || "",
        barcode: product.barcode || "",
        category_id: product.category_id?.toString() || "none",
        price: product.price.toString(),
        stock: product.stock.toString(),
        is_active: product.is_active,
      });
    } else {
      setFormData({
        name: "",
        sku: "",
        barcode: "",
        category_id: "none",
        price: "",
        stock: "",
        is_active: true,
      });
    }
  }, [product, open]);

  const createMutation = useInvokeMutation("create_product", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Success", description: "Product created" });
      onOpenChange(false);
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Error", description: String(e) }),
  });

  const updateMutation = useInvokeMutation("update_product", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Success", description: "Product updated" });
      onOpenChange(false);
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Error", description: String(e) }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      sku: formData.sku || null,
      barcode: formData.barcode || null,
      category_id:
        formData.category_id === "none" ? null : Number(formData.category_id),
      price: Number(formData.price),
      stock: product ? product.stock : Number(formData.stock), // Stock only on create via payload
      is_active: formData.is_active,
    };

    if (product) {
      updateMutation.mutate({ sessionToken, id: product.id, payload });
    } else {
      createMutation.mutate({ sessionToken, payload });
    }
  };

  const loading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input
                value={formData.sku}
                onChange={(e) =>
                  setFormData({ ...formData, sku: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Barcode</Label>
              <Input
                value={formData.barcode}
                onChange={(e) =>
                  setFormData({ ...formData, barcode: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category_id}
                onValueChange={(val) =>
                  setFormData({ ...formData, category_id: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- No Category --</SelectItem>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Price *</Label>
              <Input
                required
                type="number"
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: e.target.value })
                }
              />
            </div>
          </div>

          {!product && (
            <div className="space-y-2">
              <Label>Initial Stock *</Label>
              <Input
                required
                type="number"
                value={formData.stock}
                onChange={(e) =>
                  setFormData({ ...formData, stock: e.target.value })
                }
              />
            </div>
          )}

          {product && (
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="active"
                checked={formData.is_active}
                onCheckedChange={(c) =>
                  setFormData({ ...formData, is_active: c as boolean })
                }
              />
              <Label htmlFor="active" className="cursor-pointer">
                Active / Sellable
              </Label>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {product ? "Save Changes" : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
