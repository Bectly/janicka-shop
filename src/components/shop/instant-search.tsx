"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import MiniSearch from "minisearch";
import { Search, X, Clock, ArrowRight, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { CONDITION_LABELS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchProduct {
  id: string;
  name: string;
  slug: string;
  brand: string;
  price: number;
  compareAt: number | null;
  condition: string;
  category: string;
  image: string;
  sizes: string;
  colors: string;
}

interface SearchResult extends SearchProduct {
  score: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECENT_SEARCHES_KEY = "janicka-recent-searches";
const MAX_RECENT = 5;
const DEBOUNCE_MS = 150;

const CATEGORIES = [
  { name: "Šaty", href: "/products?category=saty" },
  { name: "Topy & Halenky", href: "/products?category=topy-halenky" },
  { name: "Kalhoty & Sukně", href: "/products?category=kalhoty-sukne" },
  { name: "Bundy & Kabáty", href: "/products?category=bundy-kabaty" },
  { name: "Boty", href: "/products?category=boty" },
  { name: "Doplňky", href: "/products?category=doplnky" },
];

// ---------------------------------------------------------------------------
// Recent searches (localStorage)
// ---------------------------------------------------------------------------

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  if (typeof window === "undefined" || query.length < 2) return;
  try {
    const prev = getRecentSearches().filter((s) => s !== query);
    localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify([query, ...prev].slice(0, MAX_RECENT)),
    );
  } catch { /* quota exceeded, ignore */ }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface InstantSearchProps {
  /** "icon" = compact square icon button (header default).
   *  "bar"  = full-width search-bar styled trigger (mobile nav). */
  variant?: "icon" | "bar";
  /** When true, open the dialog immediately on mount. Used by the lazy
   *  wrapper to auto-open after it finishes dynamic-importing this module. */
  defaultOpen?: boolean;
}

export function InstantSearch({ variant = "icon", defaultOpen = false }: InstantSearchProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const miniSearchRef = useRef<MiniSearch<SearchProduct> | null>(null);
  const productsRef = useRef<SearchProduct[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // -----------------------------------------------------------------------
  // Load product index on first open
  // -----------------------------------------------------------------------
  const loadIndex = useCallback(async () => {
    if (miniSearchRef.current) return; // already loaded
    setLoading(true);
    try {
      const res = await fetch("/api/search/products");
      if (!res.ok) throw new Error("fetch failed");
      const data: SearchProduct[] = await res.json();
      productsRef.current = data;

      const ms = new MiniSearch<SearchProduct>({
        fields: ["name", "brand", "category"],
        storeFields: [
          "id", "name", "slug", "brand", "price", "compareAt",
          "condition", "category", "image", "sizes", "colors",
        ],
        searchOptions: {
          boost: { name: 3, brand: 2, category: 1 },
          fuzzy: 0.2,
          prefix: true,
        },
        // Czech diacritics: normalize to ASCII for index + queries
        processTerm: (term) =>
          term
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, ""),
      });
      // Yield to event loop so React can paint the loading spinner before
      // ms.addAll() blocks the main thread (INP fix — ~100-300ms blocking work)
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      ms.addAll(data);
      miniSearchRef.current = ms;
    } catch {
      // silently fail — search falls back to full page /search
    } finally {
      setLoading(false);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Open / close
  // -----------------------------------------------------------------------
  const openSearch = useCallback(() => {
    setOpen(true);
    setQuery("");
    setResults([]);
    setActiveIdx(-1);
    setRecentSearches(getRecentSearches());
    loadIndex();
  }, [loadIndex]);

  const closeSearch = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActiveIdx(-1);
  }, []);

  // -----------------------------------------------------------------------
  // Keyboard shortcut: Ctrl+K / Cmd+K
  // -----------------------------------------------------------------------
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) closeSearch();
        else openSearch();
      }
      if (e.key === "Escape" && open) {
        closeSearch();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, openSearch, closeSearch]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Auto-open on mount when the lazy wrapper requests it (post-hydration)
  useEffect(() => {
    if (defaultOpen) openSearch();
    // openSearch is stable via useCallback; run exactly once per mount intent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lock body scroll when open — snapshot previous value so we don't clobber
  // any outer scroll lock (e.g. base-ui Sheet/Dialog already active).
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------
  const doSearch = useCallback((q: string) => {
    if (!miniSearchRef.current || q.length < 1) {
      setResults([]);
      setActiveIdx(-1);
      return;
    }
    const raw = miniSearchRef.current.search(q).slice(0, 8);
    setResults(raw as unknown as SearchResult[]);
    setActiveIdx(-1);
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(val), DEBOUNCE_MS);
    },
    [doSearch],
  );

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------
  const navigateTo = useCallback(
    (href: string, searchQuery?: string) => {
      if (searchQuery) saveRecentSearch(searchQuery);
      closeSearch();
      router.push(href);
    },
    [router, closeSearch],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const maxIdx = results.length - 1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, maxIdx));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeIdx >= 0 && results[activeIdx]) {
          navigateTo(`/products/${results[activeIdx].slug}`, query);
        } else if (query.length > 0) {
          navigateTo(`/search?q=${encodeURIComponent(query)}`, query);
        }
      }
    },
    [results, activeIdx, query, navigateTo],
  );

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-search-item]");
    items[activeIdx]?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  const showRecent = query.length === 0 && recentSearches.length > 0;
  const showCategories = query.length === 0;
  const showNoResults = query.length > 0 && results.length === 0 && !loading;

  return (
    <>
      {/* Trigger button */}
      {variant === "bar" ? (
        <button
          onClick={openSearch}
          className="flex w-full items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
          aria-label="Hledat produkty"
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 text-left">Hledat produkty...</span>
          <kbd className="hidden rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] sm:inline-flex">
            ⌘K
          </kbd>
        </button>
      ) : (
        <button
          onClick={openSearch}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-foreground/80 transition-colors duration-150 hover:bg-muted hover:text-foreground"
          aria-label="Hledat (Ctrl+K)"
        >
          <Search className="size-5" />
        </button>
      )}

      {/* Overlay */}
      {!open ? null : (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={closeSearch}
        aria-hidden
      />

      {/* Dialog */}
      <div className="relative mx-auto mt-[10vh] flex w-full max-w-lg flex-col overflow-hidden rounded-xl border bg-background shadow-2xl sm:mt-[15vh] max-sm:mt-0 max-sm:h-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0">
        {/* Input */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            placeholder="Hledejte podle názvu, značky..."
            className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          <button
            onClick={closeSearch}
            className="rounded-md p-1 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
            aria-label="Zavřít vyhledávání"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Results area */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto overscroll-contain p-2"
          role="listbox"
        >
          {/* Search results */}
          {results.length > 0 &&
            results.map((r, idx) => {
              const hasDiscount = r.compareAt && r.compareAt > r.price;
              return (
                <button
                  key={r.id}
                  data-search-item
                  role="option"
                  aria-selected={idx === activeIdx}
                  onClick={() => navigateTo(`/products/${r.slug}`, query)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 ${
                    idx === activeIdx
                      ? "bg-primary/10 text-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {r.image ? (
                    <Image
                      src={r.image}
                      alt={r.name}
                      width={48}
                      height={48}
                      className="size-12 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="size-12 shrink-0 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.brand && `${r.brand} · `}
                      {r.category}
                      {" · "}
                      {CONDITION_LABELS[r.condition] ?? r.condition}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">{formatPrice(r.price)}</p>
                    {hasDiscount && (
                      <p className="text-xs text-muted-foreground line-through">
                        {formatPrice(r.compareAt!)}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}

          {/* "View all results" link */}
          {query.length > 0 && results.length > 0 && (
            <button
              onClick={() =>
                navigateTo(`/search?q=${encodeURIComponent(query)}`, query)
              }
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm text-primary transition-colors duration-150 hover:bg-muted"
            >
              Zobrazit všechny výsledky
              <ArrowRight className="size-3.5" />
            </button>
          )}

          {/* No results */}
          {showNoResults && (
            <div className="px-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nic jsme nenašli pro &ldquo;{query}&rdquo;
              </p>
              <button
                onClick={() =>
                  navigateTo(`/search?q=${encodeURIComponent(query)}`, query)
                }
                className="mt-2 text-sm text-primary hover:underline"
              >
                Zkusit rozšířené vyhledávání
              </button>
            </div>
          )}

          {/* Recent searches */}
          {showRecent && (
            <div className="px-1">
              <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Nedávno hledáno
              </p>
              {recentSearches.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setQuery(s);
                    doSearch(s);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors duration-150 hover:bg-muted"
                >
                  <Clock className="size-3.5 text-muted-foreground" />
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Category quick links */}
          {showCategories && (
            <div className="mt-2 px-1">
              <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Kategorie
              </p>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.href}
                  onClick={() => navigateTo(cat.href)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors duration-150 hover:bg-muted"
                >
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t px-4 py-2 text-xs text-muted-foreground max-sm:hidden">
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            &uarr;&darr;
          </kbd>{" "}
          navigace{" "}
          <kbd className="ml-2 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            Enter
          </kbd>{" "}
          otevřít{" "}
          <kbd className="ml-2 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            Esc
          </kbd>{" "}
          zavřít
        </div>
      </div>
    </div>
      )}
    </>
  );
}
