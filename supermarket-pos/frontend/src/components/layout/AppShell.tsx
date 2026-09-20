import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { fetchSettings } from "../../lib/posApi";

const NAV_ACCESS: Record<string, string> = {
  "/pos": "sales.create",
  "/products": "products.view",
  "/inventory": "inventory.manage",
  "/purchases": "purchases.manage",
  "/customers": "customers.manage",
  "/expenses": "expenses.manage",
  "/reports": "reports.view",
  "/backups": "backup.manage",
  "/users": "users.manage",
  "/settings": "settings.manage",
};
const NAV_ITEMS = [
  { to: "/", label: "Dashboard" },
  { to: "/pos", label: "POS" },
  { to: "/products", label: "Products" },
  { to: "/inventory", label: "Inventory" },
  { to: "/purchases", label: "Purchases" },
  { to: "/customers", label: "Customers" },
  { to: "/expenses", label: "Expenses" },
  { to: "/reports", label: "Reports" },
  { to: "/backups", label: "Backups" },
  { to: "/users", label: "Team" },
  { to: "/settings", label: "Settings" },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const [storeName, setStoreName] = useState("Supermarket POS");

  useEffect(() => {
    let active = true;
    let latestRequest = 0;
    const refresh = () => {
      const request = ++latestRequest;
      fetchSettings().then((settings) => {
        if (active && request === latestRequest) {
          setStoreName(settings["store.name"]?.trim() || "Supermarket POS");
        }
      }).catch(() => {});
    };
    refresh();
    window.addEventListener("pos:settings-updated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("pos:settings-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return (
    <div className="flex h-screen bg-paper">
      <aside className="flex w-60 flex-col border-r border-ink/10 bg-white">
        <div className="flex items-center gap-2.5 border-b border-ink/10 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ledger-600 font-display font-semibold text-white">
            {Array.from(storeName)[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="break-words font-display text-sm font-semibold text-ink" title={storeName}>
              {storeName}
            </p>
            <p className="text-xs text-ink/50">Store Management</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV_ITEMS.filter(
            (item) =>
              !NAV_ACCESS[item.to] ||
              user?.permissions.includes(NAV_ACCESS[item.to]),
          ).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-ledger-50 text-ledger-700"
                    : "text-ink/60 hover:bg-paper hover:text-ink"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-ink/10 p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-medium text-ink">
              {user?.name}
            </p>
            <p className="text-xs text-ink/50">{user?.role}</p>
          </div>
          <button
            onClick={() => logout()}
            className="w-full rounded-md border border-ink/15 px-3 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-paper"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
