"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

const STORAGE_KEY = "janicka_referral_code";

/**
 * Captures ?ref= query param into sessionStorage so the referral code
 * survives navigation through products → cart → checkout.
 * Mounted in the shop layout — runs on every page.
 */
export function ReferralTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref")?.trim().toUpperCase();
    if (ref) {
      try {
        sessionStorage.setItem(STORAGE_KEY, ref);
      } catch {
        // sessionStorage unavailable (private browsing edge cases)
      }
    }
  }, [searchParams]);

  return null;
}

/** Read persisted referral code (used by checkout page). */
export function getPersistedReferralCode(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
