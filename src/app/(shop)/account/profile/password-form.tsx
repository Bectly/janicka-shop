"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword, type ChangePasswordState } from "./actions";

const INITIAL: ChangePasswordState = { error: null, success: false };

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, INITIAL);

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border bg-card p-6 shadow-sm"
      key={state.success ? "done" : "idle"}
    >
      <div>
        <h3 className="font-heading text-lg font-semibold">Změna hesla</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Minimálně 10 znaků, malé i velké písmeno a číslice.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="currentPassword">Aktuální heslo</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="newPassword">Nové heslo</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Potvrzení nového hesla</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
          />
        </div>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-sage-dark">
          Heslo bylo změněno.
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Měním…" : "Změnit heslo"}
      </Button>
    </form>
  );
}
