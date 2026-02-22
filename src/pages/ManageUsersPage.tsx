import { useState, useMemo } from "react";
import { useInvokeQuery, useInvokeMutation } from "../hooks/useInvokeQuery";
import { User } from "../types";
import { useAuthStore } from "../store/authStore";
import { DataTable, Column } from "../components/DataTable";
import { Button } from "../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";
import { RoleBadge } from "../components/RoleBadge";
import {
  UserPlus,
  Pencil,
  KeyRound,
  ShieldBan,
  ShieldCheck,
} from "lucide-react";
import { UserForm } from "../features/users/UserForm";
import { ResetPasswordForm } from "../features/users/ResetPasswordForm";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../hooks/use-toast";
import { format } from "date-fns";

export default function ManageUsersPage() {
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const currentUser = useAuthStore((s) => s.user);

  const [formOpen, setFormOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: users, isLoading } = useInvokeQuery<User[]>(
    ["users"],
    "get_all_users",
    { sessionToken },
  );

  const toggleMutation = useInvokeMutation<boolean>("toggle_user_status", {
    onSuccess: (status) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "Status Updated",
        description: `Account is now ${status ? "Active" : "Inactive"}`,
      });
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Error", description: String(e) }),
  });

  const handleEdit = (u: User) => {
    setEditingUser(u);
    setFormOpen(true);
  };

  const handleResetPassword = (u: User) => {
    setEditingUser(u);
    setResetOpen(true);
  };

  const handleToggleStatus = (u: User) => {
    if (u.id === currentUser?.id) {
      toast({
        variant: "destructive",
        title: "Action Denied",
        description: "You cannot disable your own account.",
      });
      return;
    }
    toggleMutation.mutate({ sessionToken, userId: u.id });
  };

  const columns = useMemo<Column<User>[]>(
    () => [
      {
        header: "Status",
        cell: (u) => (
          <div className="flex items-center gap-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-destructive"}`}
            />
            <span className="text-sm font-medium">
              {u.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        ),
      },
      {
        header: "Name",
        accessorKey: "name",
        className: "font-bold",
      },
      {
        header: "Username",
        accessorKey: "username",
      },
      {
        header: "Role",
        cell: (u) => <RoleBadge role={u.role} />,
      },
      {
        header: "Last Login",
        cell: (u) =>
          u.last_login_at ? (
            format(new Date(u.last_login_at), "dd MMM yyyy, HH:mm")
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        header: "Actions",
        cell: (u) => (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => handleEdit(u)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleResetPassword(u)}
            >
              <KeyRound className="h-4 w-4 mr-1" /> Reset Pwd
            </Button>
            <Button
              variant={u.is_active ? "ghost" : "default"}
              size="sm"
              onClick={() => handleToggleStatus(u)}
              disabled={u.id === currentUser?.id}
              className={
                u.is_active && u.id !== currentUser?.id
                  ? "text-destructive"
                  : ""
              }
            >
              {u.is_active ? (
                <ShieldBan className="h-4 w-4 mr-1" />
              ) : (
                <ShieldCheck className="h-4 w-4 mr-1" />
              )}
              {u.is_active ? "Disable" : "Enable"}
            </Button>
          </div>
        ),
      },
    ],
    [currentUser],
  );

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff & Users</h1>
          <p className="text-muted-foreground">
            Manage cashier accounts and access permissions.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingUser(null);
            setFormOpen(true);
          }}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Create Kasir Account
        </Button>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardHeader className="py-4 border-b">
          <CardTitle className="text-lg">User Accounts Directory</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading accounts...
            </div>
          ) : (
            <DataTable
              data={users || []}
              columns={columns}
              keyExtractor={(u) => u.id}
            />
          )}
        </CardContent>
      </Card>

      <UserForm open={formOpen} onOpenChange={setFormOpen} user={editingUser} />

      <ResetPasswordForm
        open={resetOpen}
        onOpenChange={setResetOpen}
        user={editingUser}
      />
    </div>
  );
}
