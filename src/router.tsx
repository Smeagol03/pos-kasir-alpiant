import {
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { useAuthStore } from "./store/authStore";
import { Sidebar } from "./components/Sidebar";

import LoginPage from "./pages/LoginPage";
import FirstSetupPage from "./pages/FirstSetupPage";
import POSPage from "./pages/POSPage";
import InventoryPage from "./pages/InventoryPage";
import ManageUsersPage from "./pages/ManageUsersPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/setup",
  component: FirstSetupPage,
});

const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_protected",
  beforeLoad: () => {
    const sessionToken = useAuthStore.getState().sessionToken;
    if (!sessionToken) {
      throw redirect({
        to: "/login",
      });
    }
  },
  component: () => (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto border-l border-border bg-muted/20">
        <Outlet />
      </main>
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/",
  beforeLoad: () => {
    const isAdmin = useAuthStore.getState().isAdmin();
    throw redirect({
      to: isAdmin ? "/inventory" : "/pos",
    });
  },
});

const posRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/pos",
  component: POSPage,
});

const adminProtectedRoute = createRoute({
  getParentRoute: () => protectedRoute,
  id: "_admin",
  beforeLoad: () => {
    const isAdmin = useAuthStore.getState().isAdmin();
    if (!isAdmin) {
      throw redirect({
        to: "/pos",
      });
    }
  },
  component: () => <Outlet />,
});

const inventoryRoute = createRoute({
  getParentRoute: () => adminProtectedRoute,
  path: "/inventory",
  component: InventoryPage,
});

const usersRoute = createRoute({
  getParentRoute: () => adminProtectedRoute,
  path: "/users",
  component: ManageUsersPage,
});

const reportsRoute = createRoute({
  getParentRoute: () => adminProtectedRoute,
  path: "/reports",
  component: ReportsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => adminProtectedRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  setupRoute,
  protectedRoute.addChildren([
    indexRoute,
    posRoute,
    adminProtectedRoute.addChildren([
      inventoryRoute,
      usersRoute,
      reportsRoute,
      settingsRoute,
    ]),
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
