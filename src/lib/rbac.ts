import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { getSession } from "./session";
import { can, type Action } from "./permissions";

type Denied = { ok: false; response: NextResponse };
type Granted = { ok: true; session: Session };

// Route-handler guard. Usage:
//   const auth = await requirePermission("movement.create");
//   if (!auth.ok) return auth.response;
//   const { session } = auth;
export async function requirePermission(action: Action): Promise<Denied | Granted> {
  const session = await getSession();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!can(session.user.role, action)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "You don't have permission to do that." }, { status: 403 }),
    };
  }
  return { ok: true, session };
}

// Same shape without an action check — for authenticated read endpoints.
export async function requireAuth(): Promise<Denied | Granted> {
  const session = await getSession();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, session };
}
