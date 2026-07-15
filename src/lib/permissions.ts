// Pure, isomorphic permission matrix — imported by client Views for button
// gating and by server code for enforcement. Keep framework imports out.
//
// VIEWER is exactly "authenticated, read-only": every page, report, and CSV
// export is open to all roles; only mutations are gated.

export type Role = "ADMIN" | "PURCHASING" | "VIEWER";

export type Action =
  | "product.create"
  | "product.edit"
  | "product.delete"
  | "movement.create"
  | "transfer.create"
  | "warehouse.create"
  | "po.create"
  | "po.transition"
  | "so.create"
  | "so.transition"
  | "customer.create"
  | "advisor.run"
  | "user.manage"
  | "audit.view";

const MATRIX: Record<Action, Role[]> = {
  "product.create": ["ADMIN", "PURCHASING"],
  "product.edit": ["ADMIN", "PURCHASING"],
  "product.delete": ["ADMIN"],
  "movement.create": ["ADMIN", "PURCHASING"],
  "transfer.create": ["ADMIN", "PURCHASING"],
  "warehouse.create": ["ADMIN"],
  "po.create": ["ADMIN", "PURCHASING"],
  "po.transition": ["ADMIN", "PURCHASING"],
  "so.create": ["ADMIN", "PURCHASING"],
  "so.transition": ["ADMIN", "PURCHASING"],
  "customer.create": ["ADMIN", "PURCHASING"],
  "advisor.run": ["ADMIN", "PURCHASING"],
  "user.manage": ["ADMIN"],
  "audit.view": ["ADMIN"],
};

export function can(role: Role | undefined | null, action: Action): boolean {
  return !!role && MATRIX[action].includes(role);
}
