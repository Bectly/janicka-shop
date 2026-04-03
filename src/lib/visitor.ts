import { cookies } from "next/headers";

const VISITOR_COOKIE = "janicka-visitor";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Get or create a visitor ID from cookies (server-side).
 * Used to track cart reservations for anonymous visitors.
 */
export async function getVisitorId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(VISITOR_COOKIE)?.value;
  if (existing) return existing;

  const id = crypto.randomUUID();
  store.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: VISITOR_MAX_AGE,
    path: "/",
  });
  return id;
}

/** Reservation duration in minutes */
export const RESERVATION_MINUTES = 15;

/** Reservation duration in milliseconds */
export const RESERVATION_MS = RESERVATION_MINUTES * 60 * 1000;
