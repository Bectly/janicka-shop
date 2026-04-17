"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}
