"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
import { lookupOrder, type LookupState } from "./actions";

const initialState: LookupState = { error: null };

export function OrderLookupForm() {
  const [state, action, isPending] = useActionState(lookupOrder, initialState);

  return (
    <form action={action} className="mt-8 space-y-4">
      <div>
        <Label htmlFor="orderNumber">Číslo objednávky</Label>
        <Input
          id="orderNumber"
          name="orderNumber"
          type="text"
          placeholder="JN-260404-XXXXXXXX"
          required
          autoComplete="off"
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="váš@email.cz"
          required
          autoComplete="email"
          className="mt-1.5"
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        <Search className="mr-2 size-4" />
        {isPending ? "Hledám…" : "Najít objednávku"}
      </Button>
    </form>
  );
}
