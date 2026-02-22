import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useInvokeQuery, useInvokeMutation } from "../../hooks/useInvokeQuery";
import { CategoryWithCount, Category } from "../../types";
import { useAuthStore } from "../../store/authStore";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../hooks/use-toast";

export function CategoryManager({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [newCatName, setNewCatName] = useState("");
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: categories, isLoading } = useInvokeQuery<CategoryWithCount[]>(
    ["categories"],
    "get_categories",
    { sessionToken },
  );

  const createMutation = useInvokeMutation<Category>("create_category", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setNewCatName("");
      toast({ title: "Success", description: "Category created" });
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Error", description: String(e) }),
  });

  const handleAdd = () => {
    if (!newCatName.trim()) return;
    createMutation.mutate({ sessionToken, name: newCatName });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          <Input
            placeholder="New Category Name"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={createMutation.isPending}>
            Add
          </Button>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-auto">
          {isLoading ? (
            <p>Loading...</p>
          ) : categories?.length === 0 ? (
            <p className="text-muted-foreground text-center">
              No categories found.
            </p>
          ) : (
            categories?.map((c) => (
              <div
                key={c.id}
                className="flex justify-between items-center p-3 border rounded-md"
              >
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.product_count} Products
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
