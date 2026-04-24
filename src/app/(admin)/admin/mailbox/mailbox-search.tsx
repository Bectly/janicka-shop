"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

const DEBOUNCE_MS = 300;

export function MailboxSearch({
  tab,
  initialQ,
}: {
  tab: "inbox" | "archived";
  initialQ: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastPushedRef = useRef<string>(initialQ);

  useEffect(() => {
    setValue(initialQ);
    lastPushedRef.current = initialQ;
  }, [initialQ]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const pushSearch = (q: string) => {
    if (q === lastPushedRef.current) return;
    lastPushedRef.current = q;
    const params = new URLSearchParams();
    if (tab === "archived") params.set("tab", "archived");
    if (q) params.set("q", q);
    const qs = params.toString();
    router.replace(qs ? `/admin/mailbox?${qs}` : "/admin/mailbox");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushSearch(next.trim()), DEBOUNCE_MS);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pushSearch(value.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          name="q"
          value={value}
          onChange={handleChange}
          placeholder="Hledat v konverzacích (předmět, odesílatel)…"
          className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      {value ? (
        <Link
          href={tab === "archived" ? "/admin/mailbox?tab=archived" : "/admin/mailbox"}
          className="rounded-lg border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            setValue("");
            lastPushedRef.current = "";
          }}
        >
          Vymazat
        </Link>
      ) : null}
    </form>
  );
}
