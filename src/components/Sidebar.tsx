import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "../store/authStore";
import {
  ShoppingCart,
  Users,
  Settings,
  Package,
  LogOut,
  BarChart,
} from "lucide-react";
import { invoke } from "../lib/tauri";
import { ThemeToggle } from "./ThemeToggle";

export function Sidebar() {
  const { user, isAdmin, clearSession, sessionToken } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = async () => {
    if (sessionToken) {
      try {
        await invoke("logout", { sessionToken });
      } catch (e) {
        console.error("Logout failed", e);
      }
    }
    clearSession();
    navigate({ to: "/login" });
  };

  const navItems = [
    { name: "POS", path: "/pos", icon: ShoppingCart },
    ...(isAdmin()
      ? [
          { name: "Inventory", path: "/inventory", icon: Package },
          { name: "Reports", path: "/reports", icon: BarChart },
          { name: "Users", path: "/users", icon: Users },
          { name: "Settings", path: "/settings", icon: Settings },
        ]
      : []),
  ];

  return (
    <aside className="w-64 bg-card border-r border-border h-full flex flex-col">
      <div className="p-6 h-20 flex items-center justify-between border-b border-border">
        <h1 className="text-xl font-bold mb-0 flex items-center">
          <span className="text-primary">Kasir</span>
          <span className="text-accent">Pro</span>
          <span className="text-muted-foreground text-[10px] ml-1 px-1.5 py-0.5 rounded-full bg-muted">
            v3.1
          </span>
        </h1>
        <ThemeToggle />
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border bg-muted/10">
        <div className="mb-4 px-2">
          <p className="text-sm font-bold text-foreground truncate">
            {user.name}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isAdmin() ? "Administrator" : "Kasir"}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-md text-destructive hover:bg-destructive/10 transition-colors font-medium"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </aside>
  );
}
