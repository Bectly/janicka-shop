"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { updateAdminPassword, type PasswordResult } from "./actions";

export function PasswordChangeForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, isPending] = useActionState<PasswordResult | null, FormData>(
    async (prev, formData) => {
      const result = await updateAdminPassword(prev, formData);
      if (result.success) {
        formRef.current?.reset();
      }
      return result;
    },
    null,
  );

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {state && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            state.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-destructive/20 bg-destructive/5 text-destructive"
          }`}
        >
          {state.success ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : (
            <AlertCircle className="size-4 shrink-0" />
          )}
          {state.message}
        </div>
      )}

      <div>
        <Label htmlFor="currentPassword">Aktuální heslo</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="newPassword">Nové heslo</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1.5"
        />
        <p className="mt-1 text-xs text-muted-foreground">Minimálně 8 znaků</p>
      </div>

      <div>
        <Label htmlFor="confirmPassword">Potvrzení nového hesla</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1.5"
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isPending}>
          <Lock className="size-4" data-icon="inline-start" />
          {isPending ? "Měním heslo..." : "Změnit heslo"}
        </Button>
      </div>
    </form>
  );
}
