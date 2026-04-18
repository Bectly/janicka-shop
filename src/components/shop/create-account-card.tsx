"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, UserPlus, CheckCircle2 } from "lucide-react";
import { createAccountFromOrder } from "@/app/(shop)/order/[orderNumber]/actions";

interface CreateAccountCardProps {
  orderNumber: string;
  accessToken: string;
}

export function CreateAccountCard({ orderNumber, accessToken }: CreateAccountCardProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (dismissed || created) {
    if (created) {
      return (
        <div className="mt-6 rounded-xl border border-sage bg-sage-light p-5 text-left">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-sage-dark" />
            <p className="text-sm font-medium text-sage-dark">
              Účet vytvořen! Příště se přihlásíte pomocí svého emailu a hesla.
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Heslo musí mít alespoň 8 znaků");
      return;
    }

    startTransition(async () => {
      const result = await createAccountFromOrder(orderNumber, accessToken, password);
      if (result.success) {
        setCreated(true);
      } else {
        setError(result.error ?? "Něco se pokazilo");
      }
    });
  }

  return (
    <div className="mt-6 rounded-xl border bg-card p-6 text-left shadow-sm">
      <div className="flex items-start gap-3">
        <UserPlus className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="flex-1">
          <h3 className="font-heading text-base font-semibold text-foreground">
            Nakupuj příště rychleji
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Nastav si heslo a příště se přihlásíš — adresa i historie objednávek se uloží.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="create-password" className="text-sm">
                Heslo
              </Label>
              <div className="relative">
                <Input
                  id="create-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="Minimálně 8 znaků"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  disabled={isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  aria-label={showPassword ? "Skrýt heslo" : "Zobrazit heslo"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={isPending || password.length < 8}>
                {isPending ? "Vytvářím účet…" : "Uložit a vytvořit účet"}
              </Button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                Pokračovat bez účtu →
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
