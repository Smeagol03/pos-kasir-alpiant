import { Badge } from "./ui/badge";
import { Role } from "../types";

export function RoleBadge({ role }: { role: Role }) {
  if (role === "ADMIN") {
    return <Badge variant="destructive">Admin</Badge>;
  }
  return <Badge variant="secondary">Kasir</Badge>;
}
