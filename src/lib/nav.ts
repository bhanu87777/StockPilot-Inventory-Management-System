import type { Action } from "./permissions";

// Single source of truth for app navigation — consumed by the Shell sidebar,
// the mobile top bar, and the command palette. Entries with an `action` are
// hidden from roles that can't perform it.
export type NavItem = {
  href: string;
  label: string;
  icon: string;
  action?: Action;
};

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/inventory", label: "Inventory", icon: "▤" },
  { href: "/movements", label: "Movements", icon: "⇅" },
  { href: "/warehouses", label: "Warehouses", icon: "⌂" },
  { href: "/purchase-orders", label: "Purchase orders", icon: "⎙" },
  { href: "/sales-orders", label: "Sales orders", icon: "⇈" },
  { href: "/suppliers", label: "Suppliers", icon: "◫" },
  { href: "/customers", label: "Customers", icon: "◉" },
  { href: "/advisor", label: "Reorder advisor", icon: "✦" },
  { href: "/reports", label: "Reports", icon: "▥" },
  { href: "/audit", label: "Audit log", icon: "≡", action: "audit.view" },
  { href: "/settings/users", label: "Users", icon: "⚙", action: "user.manage" },
];
