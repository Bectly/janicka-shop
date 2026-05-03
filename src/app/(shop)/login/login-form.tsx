"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useWishlistStore } from "@/lib/wishlist-store";

async function mergeAnonWishlist() {
  // SSoT shift: when an anon visitor signs in, push their localStorage wishlist
  // to DB and replace Zustand with the canonical merged set so DB === Zustand
  // from this point forward.
  const local = useWishlistStore.getState().items;
  try {
    const res = await fetch("/api/wishlist/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: local.slice(0, 200) }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { ok: boolean; all?: string[] };
    if (Array.isArray(data.all)) {
      useWishlistStore.getState().setItems(data.all);
    }
  } catch {
    // Offline — Zustand stays as-is; next /oblibene visit retries via merge-client.
  }
}

type Tab = "login" | "register";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect");
  // Open-redirect guard: only allow same-origin relative paths.
  const redirect =
    rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/account";
  const [tab, setTab] = useState<Tab>("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    const result = await signIn("customer", {
      email: fd.get("email") as string,
      password: fd.get("password") as string,
      redirect: false,
    });

    if (result?.error) {
      setLoading(false);
      setError("Nesprávný email nebo heslo.");
      return;
    }
    await mergeAnonWishlist();
    setLoading(false);
    router.push(redirect);
    router.refresh();
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      email: fd.get("email") as string,
      password: fd.get("password") as string,
      firstName: fd.get("firstName") as string,
      lastName: fd.get("lastName") as string,
    };

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      setLoading(false);
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Registrace se nezdařila.");
      return;
    }

    const signInResult = await signIn("customer", {
      email: payload.email,
      password: payload.password,
      redirect: false,
    });

    if (signInResult?.error) {
      setLoading(false);
      setError("Registrace proběhla, ale přihlášení selhalo. Zkuste se přihlásit.");
      setTab("login");
      return;
    }
    await mergeAnonWishlist();
    setLoading(false);
    router.push(redirect);
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        Můj účet
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {tab === "login"
          ? "Přihlas se ke svému účtu."
          : "Vytvoř si účet a nakupuj rychleji."}
      </p>

      <div
        role="tablist"
        aria-label="Přihlášení / Registrace"
        className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "login"}
          onClick={() => {
            setTab("login");
            setError(null);
          }}
          className={cn(
            "rounded-md py-2 font-medium transition-colors",
            tab === "login"
              ? "bg-background text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Přihlášení
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "register"}
          onClick={() => {
            setTab("register");
            setError(null);
          }}
          className={cn(
            "rounded-md py-2 font-medium transition-colors",
            tab === "register"
              ? "bg-background text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Registrace
        </button>
      </div>

      {tab === "login" ? (
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              name="email"
              type="email"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Heslo</Label>
            <Input
              id="login-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Přihlašuji…" : "Přihlásit se"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="reg-firstName">Jméno</Label>
              <Input
                id="reg-firstName"
                name="firstName"
                required
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-lastName">Příjmení</Label>
              <Input
                id="reg-lastName"
                name="lastName"
                required
                autoComplete="family-name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-email">Email</Label>
            <Input
              id="reg-email"
              name="email"
              type="email"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-password">Heslo</Label>
            <Input
              id="reg-password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Minimálně 8 znaků"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Vytvářím účet…" : "Vytvořit účet"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Registrací souhlasíš s{" "}
            <a href="/terms" className="underline">
              obchodními podmínkami
            </a>{" "}
            a{" "}
            <a href="/privacy" className="underline">
              zpracováním údajů
            </a>
            .
          </p>
        </form>
      )}
    </div>
  );
}
