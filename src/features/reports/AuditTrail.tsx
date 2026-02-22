import { useInvokeQuery } from "../../hooks/useInvokeQuery";
import { useAuthStore } from "../../store/authStore";
import { ActivityLog } from "../../types";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Activity, ShieldAlert, LogIn, ShoppingBag, Trash2 } from "lucide-react";

export function AuditTrail() {
  const sessionToken = useAuthStore((s) => s.sessionToken);

  const { data: logs, isLoading } = useInvokeQuery<ActivityLog[]>(
    ["activity_logs"],
    "get_activity_logs",
    { sessionToken, limit: 100 },
  );

  const getActionIcon = (action: string) => {
    switch (action) {
      case "LOGIN": return <LogIn className="h-3 w-3" />;
      case "CREATE_TRANSACTION": return <ShoppingBag className="h-3 w-3" />;
      case "VOID_TRANSACTION": return <ShieldAlert className="h-3 w-3 text-destructive" />;
      case "DELETE_PRODUCT": return <Trash2 className="h-3 w-3" />;
      default: return <Activity className="h-3 w-3" />;
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes("VOID") || action.includes("DELETE")) return "destructive";
    if (action.includes("CREATE")) return "default";
    if (action.includes("LOGIN")) return "outline";
    return "secondary";
  };

  return (
    <Card className="shadow-sm border-slate-200 dark:border-slate-800">
      <CardHeader className="p-5">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Activity className="h-4 w-4" /> Audit Trail (Aktivitas Sistem)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-t max-h-[500px] overflow-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-[180px] font-bold text-[10px] uppercase">Waktu</TableHead>
                <TableHead className="w-[120px] font-bold text-[10px] uppercase">Aksi</TableHead>
                <TableHead className="w-[150px] font-bold text-[10px] uppercase">User</TableHead>
                <TableHead className="font-bold text-[10px] uppercase">Deskripsi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4} className="h-12 animate-pulse bg-muted/20" />
                  </TableRow>
                ))
              ) : logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground italic">
                    Belum ada riwayat aktivitas.
                  </TableCell>
                </TableRow>
              ) : (
                logs?.map((log) => (
                  <TableRow key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <TableCell className="text-[11px] font-medium text-muted-foreground">
                      {log.created_at ? format(new Date(log.created_at), "dd MMM yyyy, HH:mm:ss") : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionColor(log.action) as any} className="text-[9px] font-black gap-1 uppercase">
                        {getActionIcon(log.action)}
                        {log.action.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-bold">
                      {log.user_name || "System"}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                      {log.description}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
