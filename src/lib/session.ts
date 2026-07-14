import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

// Convenience wrapper for reading the session in server components / route handlers.
export function getSession() {
  return getServerSession(authOptions);
}
