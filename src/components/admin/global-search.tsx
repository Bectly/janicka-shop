"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Package, ShoppingCart, User, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/format";

type Results = {
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    customer: string;
    email: string;
  }>;
  products: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
    active: boolean;
    sold: boolean;
  }>;
  customers: Array<{
    id: string;
    email: string;
    name: string;
    orderCount: number;
  }>;
};

const EMPTY: Results = { orders: [], products: [], customers: [] };

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Cmd/Ctrl+K to toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 20);
    } else {
      setQ("");
      setResults(EMPTY);
    }
  }, [open]);

  // Debounced fetch
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/search?q=${encodeURIComponent(term)}`,
          { signal: ctrl.signal, credentials: "same-origin" },
        );
        if (res.ok) {
          setResults(await res.json());
        }
      } catch {
        // swallow abort
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q, open]);

  const total =
    results.orders.length + results.products.length + results.customers.length;

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted sm:min-w-[260px]"
        aria-label="Hledat"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Hledat…</span>
        <kbd className="ml-auto hidden items-center gap-1 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-4 pt-[10vh]"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Globální vyhledávání"
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-xl border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b px-4">
              <Search className="size-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Hledat objednávky, produkty, zákazníky…"
                className="flex-1 bg-transparent py-3 text-sm outline-none"
              />
              {loading && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {q.trim().length < 2 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Začni psát — min. 2 znaky
                </p>
              ) : total === 0 && !loading ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nic nenalezeno pro „{q}"
                </p>
              ) : (
                <div className="py-2">
                  {results.orders.length > 0 && (
                    <Group label="Objednávky" icon={ShoppingCart}>
                      {results.orders.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => go(`/admin/orders/${o.id}`)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-muted"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                              {o.orderNumber}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {o.customer} · {o.email}
                            </div>
                          </div>
                          <div className="shrink-0 text-right text-xs">
                            <div>{formatPrice(o.total)}</div>
                            <div className="text-muted-foreground">
                              {o.status}
                            </div>
                          </div>
                        </button>
                      ))}
                    </Group>
                  )}
                  {results.products.length > 0 && (
                    <Group label="Produkty" icon={Package}>
                      {results.products.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => go(`/admin/products/${p.id}/edit`)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-muted"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                              {p.name}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {p.sku}
                              {p.sold
                                ? " · Prodáno"
                                : p.active
                                  ? ""
                                  : " · Skryto"}
                            </div>
                          </div>
                          <div className="shrink-0 text-xs">
                            {formatPrice(p.price)}
                          </div>
                        </button>
                      ))}
                    </Group>
                  )}
                  {results.customers.length > 0 && (
                    <Group label="Zákaznice" icon={User}>
                      {results.customers.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => go(`/admin/customers/${c.id}`)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-muted"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                              {c.name || c.email}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {c.email}
                            </div>
                          </div>
                          <div className="shrink-0 text-xs text-muted-foreground">
                            {c.orderCount}{" "}
                            {c.orderCount === 1 ? "objednávka" : "objednávek"}
                          </div>
                        </button>
                      ))}
                    </Group>
                  )}
                </div>
              )}
            </div>

            <div className="hidden items-center justify-end gap-3 border-t px-4 py-2 text-[10px] text-muted-foreground sm:flex">
              <span>↵ otevřít</span>
              <span>Esc zavřít</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Group({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}
