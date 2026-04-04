"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, AlertCircle } from "lucide-react";
import { lookupOrder, type LookupResult } from "./actions";

export function OrderLookupForm() {
  const [state, action, isPending] = useActionState<LookupResult | null, FormData>(
    lookupOrder,
    null,
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.success && state.redirectUrl) {
      router.push(state.redirectUrl);
    }
  }, [state, router]);

  return (
    <form action={action} className="mt-8 space-y-4">
      <div>
        <Label htmlFor="orderNumber">Číslo objednávky</Label>
        <Input
          id="orderNumber"
          name="orderNumber"
          type="text"
          placeholder="např. JN-260404-XXXXXXXX"
          required
          className="mt-1.5"
          autoComplete="off"
        />
      </div>

      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="vas@email.cz"
          required
          className="mt-1.5"
          autoComplete="email"
        />
      </div>

      {state && !state.success && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.message}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        <Search className="size-4" data-icon="inline-start" />
        {isPending ? "Hledám..." : "Najít objednávku"}
      </Button>
    </form>
  );
}
