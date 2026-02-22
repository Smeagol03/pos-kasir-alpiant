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
import { User } from "../../types";
import { useInvokeMutation } from "../../hooks/useInvokeQuery";
import { useAuthStore } from "../../store/authStore";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../hooks/use-toast";

export function UserForm({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null; // null for create, object for edit
}) {
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    password: "",
  });

  const sessionToken = useAuthStore((s) => s.sessionToken);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        username: user.username,
        password: "", // Not editable directly
      });
    } else {
      setFormData({
        name: "",
        username: "",
        password: "",
      });
    }
  }, [user, open]);

  const createMutation = useInvokeMutation("create_user", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Success", description: "Kasir account created" });
      onOpenChange(false);
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Error", description: String(e) }),
  });

  const updateMutation = useInvokeMutation("update_user", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Success", description: "Account updated" });
      onOpenChange(false);
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Error", description: String(e) }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (user) {
      updateMutation.mutate({
        sessionToken,
        id: user.id,
        payload: { name: formData.name, username: formData.username },
      });
    } else {
      createMutation.mutate({
        sessionToken,
        payload: {
          name: formData.name,
          username: formData.username,
          password: formData.password,
        },
      });
    }
  };

  const loading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {user ? "Edit User Details" : "Create Kasir Account"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Username *</Label>
            <Input
              required
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
            />
          </div>

          {!user && (
            <div className="space-y-2">
              <Label>Password * (min 6 chars)</Label>
              <Input
                required
                type="password"
                minLength={6}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
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
              {user ? "Save Changes" : "Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
