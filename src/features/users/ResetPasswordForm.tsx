import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { User } from "../../types";
import { useInvokeMutation } from "../../hooks/useInvokeQuery";
import { useAuthStore } from "../../store/authStore";
import { useToast } from "../../hooks/use-toast";

export function ResetPasswordForm({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}) {
  const [password, setPassword] = useState("");
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const { toast } = useToast();

  const resetMutation = useInvokeMutation("reset_user_password", {
    onSuccess: () => {
      toast({ title: "Success", description: "Password reset successful" });
      onOpenChange(false);
      setPassword("");
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Error", description: String(e) }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || password.length < 6) return;

    resetMutation.mutate({
      sessionToken,
      userId: user.id,
      newPassword: password,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for <strong>{user?.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>New Password (min 6 chars)</Label>
            <Input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={resetMutation.isPending || password.length < 6}
            >
              Reset Password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
