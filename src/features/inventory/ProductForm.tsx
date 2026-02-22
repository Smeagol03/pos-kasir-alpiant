import { useState, useEffect } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { RefreshCw, Upload, Image as ImageIcon } from "lucide-react";
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
import { Product } from "../../types";
import { NumericInput } from "../../components/NumericInput";

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
    price: 0,
    cost_price: 0,
    stock: 0,
    is_active: true,
  });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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
        price: product.price,
        cost_price: product.cost_price || 0,
        stock: product.stock,
        is_active: product.is_active,
      });
    } else {
      setFormData({
        name: "",
        sku: "",
        barcode: "",
        category_id: "none",
        price: 0,
        cost_price: 0,
        stock: 0,
        is_active: true,
      });
    }
    setSelectedImage(null);
  }, [product, open]);

  const saveImageMutation = useInvokeMutation<string, any>(
    "save_product_image",
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["products"] });
        toast({ title: "Success", description: "Product image saved" });
        onOpenChange(false);
      },
      onError: (e) => {
        queryClient.invalidateQueries({ queryKey: ["products"] });
        toast({
          variant: "destructive",
          title: "Warning",
          description:
            "Product saved, but failed to upload image: " + String(e),
        });
        onOpenChange(false);
      },
    },
  );

  const generateBarcodeMutation = useInvokeMutation<string, any>(
    "generate_barcode",
    {
      onSuccess: (newBarcode) => {
        setFormData((prev) => ({ ...prev, barcode: newBarcode }));
        queryClient.invalidateQueries({ queryKey: ["products"] });
        toast({
          title: "Success",
          description: "Barcode generated: " + newBarcode,
        });
      },
      onError: (e) =>
        toast({
          variant: "destructive",
          title: "Error",
          description: String(e),
        }),
    },
  );

  const handleImageSelect = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [
          {
            name: "Image",
            extensions: ["png", "jpg", "jpeg", "webp"],
          },
        ],
      });
      if (selected) {
        setSelectedImage(selected as string);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateSuccess = (newProduct: Product) => {
    if (selectedImage) {
      saveImageMutation.mutate({
        sessionToken,
        productId: newProduct.id,
        filePath: selectedImage,
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Success", description: "Product created" });
      onOpenChange(false);
    }
  };

  const handleUpdateSuccess = (updatedProduct: Product) => {
    if (selectedImage) {
      saveImageMutation.mutate({
        sessionToken,
        productId: updatedProduct.id,
        filePath: selectedImage,
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Success", description: "Product updated" });
      onOpenChange(false);
    }
  };

  const createMutation = useInvokeMutation<Product, any>("create_product", {
    onSuccess: handleCreateSuccess,
    onError: (e) =>
      toast({ variant: "destructive", title: "Error", description: String(e) }),
  });

  const updateMutation = useInvokeMutation<Product, any>("update_product", {
    onSuccess: handleUpdateSuccess,
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
      price: formData.price,
      cost_price: formData.cost_price,
      stock: product ? product.stock : formData.stock,
      is_active: formData.is_active,
    };

    if (product) {
      updateMutation.mutate({ sessionToken, id: product.id, payload });
    } else {
      createMutation.mutate({ sessionToken, payload });
    }
  };

  const handleGenerateBarcode = () => {
    if (product) {
      generateBarcodeMutation.mutate({ sessionToken, productId: product.id });
    }
  };

  const loading =
    createMutation.isPending ||
    updateMutation.isPending ||
    saveImageMutation.isPending ||
    generateBarcodeMutation.isPending;

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
              <div className="flex gap-2">
                <Input
                  value={formData.barcode}
                  onChange={(e) =>
                    setFormData({ ...formData, barcode: e.target.value })
                  }
                />
                {product && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleGenerateBarcode}
                    disabled={generateBarcodeMutation.isPending}
                    title="Generate Barcode (EAN-13)"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${generateBarcodeMutation.isPending ? "animate-spin" : ""}`}
                    />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Product Image</Label>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleImageSelect}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {selectedImage ? "Change Image" : "Select Image"}
              </Button>
              {(selectedImage || (product as any)?.image_path) && (
                <div className="flex-shrink-0 text-xs text-muted-foreground flex items-center gap-1 bg-muted px-2 py-1 rounded">
                  <ImageIcon className="h-4 w-4" />
                  <span className="truncate max-w-[150px]">
                    {selectedImage
                      ? selectedImage.split(/[\\/]/).pop()
                      : "Current Image Set"}
                  </span>
                </div>
              )}
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
              <Label>Harga Jual *</Label>
              <NumericInput
                required
                value={formData.price}
                onChange={(val) => setFormData({ ...formData, price: val })}
                prefix="Rp"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Harga Modal (HPP)</Label>
              <NumericInput
                value={formData.cost_price}
                onChange={(val) =>
                  setFormData({ ...formData, cost_price: val })
                }
                prefix="Rp"
              />
            </div>

            {!product && (
              <div className="space-y-2">
                <Label>Stok Awal *</Label>
                <NumericInput
                  required
                  value={formData.stock}
                  onChange={(val) => setFormData({ ...formData, stock: val })}
                />
              </div>
            )}
          </div>

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
