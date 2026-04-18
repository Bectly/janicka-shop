"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MessageCircle, X, Send, Loader2, Lock } from "lucide-react";

interface Message {
  id: string;
  message: string;
  pagePath: string | null;
  pageTitle: string | null;
  sender: "owner" | "lead";
  status: string;
  priority: string;
  response: string | null;
  createdAt: string;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

const LS_AUTH_FLAG = "devchat_authed";

function buildContextFooter(pathname: string, search: string): string {
  if (typeof window === "undefined") return "";
  const w = window.innerWidth;
  const h = window.innerHeight;
  const device = w < 768 ? "mobile" : "desktop";
  const scroll = Math.round(window.scrollY);
  const parts: string[] = [];

  const fullPath = pathname + (search ? `?${search}` : "");
  parts.push(`📍 ${fullPath}`);
  parts.push(`📱 ${device} ${w}×${h}`);
  if (scroll > 0) parts.push(`↕ ${scroll}px`);

  const productMatch = pathname.match(/^\/products\/([^/?#]+)/);
  if (productMatch) {
    const h1 = document.querySelector("h1")?.textContent?.trim();
    parts.push(`🛍 produkt: ${h1 || productMatch[1]} (${productMatch[1]})`);
  } else if (pathname.startsWith("/admin/")) {
    const adminSection = pathname.split("/").filter(Boolean)[1] ?? "dashboard";
    parts.push(`🛠 admin: ${adminSection}`);
  }

  return parts.join(" · ");
}

export function DevChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/dev-chat/widget-login", {
        cache: "no-store",
      });
      if (!res.ok) {
        setAuthStatus("unauthenticated");
        return;
      }
      const data = await res.json();
      if (data.authenticated) {
        setAuthStatus("authenticated");
        try {
          localStorage.setItem(LS_AUTH_FLAG, "1");
        } catch {}
      } else {
        setAuthStatus("unauthenticated");
        try {
          localStorage.removeItem(LS_AUTH_FLAG);
        } catch {}
      }
    } catch {
      setAuthStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(LS_AUTH_FLAG);
      if (cached === "1") setAuthStatus("authenticated");
    } catch {}
    checkAuth();
  }, [checkAuth]);

  // Lock body scroll on mobile when open (prevents background scroll)
  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 640) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/dev-chat?limit=100", { cache: "no-store" });
      if (res.status === 401) {
        setAuthStatus("unauthenticated");
        try {
          localStorage.removeItem(LS_AUTH_FLAG);
        } catch {}
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      const msgs: Message[] = (data.messages ?? []).sort(
        (a: Message, b: Message) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setMessages(msgs);
    } catch {}
  }, []);

  const markAsRead = useCallback(async (msgs: Message[]) => {
    const unread = msgs.filter(
      (m) => m.sender === "lead" && m.status === "new",
    );
    if (unread.length > 0) {
      setUnreadCount(0);
      for (const m of unread) {
        fetch(`/api/dev-chat/${m.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "read" }),
        }).catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen || authStatus !== "authenticated") return;

    const checkUnread = async () => {
      try {
        const res = await fetch(
          "/api/dev-chat?sender=lead&status=new&limit=100",
          { cache: "no-store" },
        );
        if (res.status === 401) {
          setAuthStatus("unauthenticated");
          try {
            localStorage.removeItem(LS_AUTH_FLAG);
          } catch {}
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setUnreadCount(data.count ?? 0);
      } catch {}
    };

    checkUnread();
    const interval = setInterval(checkUnread, 30_000);
    return () => clearInterval(interval);
  }, [isOpen, authStatus]);

  useEffect(() => {
    if (!isOpen || authStatus !== "authenticated") return;

    setLoading(true);
    fetchMessages().then(() => {
      setLoading(false);
      setTimeout(() => {
        setMessages((prev) => {
          markAsRead(prev);
          return prev;
        });
      }, 100);
    });

    const interval = setInterval(fetchMessages, 15_000);
    return () => clearInterval(interval);
  }, [isOpen, authStatus, fetchMessages, markAsRead]);

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen, scrollToBottom]);

  useEffect(() => {
    if (!isOpen) return;
    const delay = setTimeout(() => {
      if (authStatus === "authenticated") {
        textareaRef.current?.focus();
      } else if (authStatus === "unauthenticated") {
        passwordRef.current?.focus();
      }
    }, 250);
    return () => clearTimeout(delay);
  }, [isOpen, authStatus]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggingIn || !password) return;
    setLoggingIn(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/dev-chat/widget-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "janicka", password }),
      });
      if (res.ok) {
        setPassword("");
        setAuthStatus("authenticated");
        try {
          localStorage.setItem(LS_AUTH_FLAG, "1");
        } catch {}
      } else {
        const data = await res.json().catch(() => ({}));
        setLoginError(data?.error ?? "Špatné heslo");
      }
    } catch {
      setLoginError("Připojení selhalo, zkus to znovu");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput("");

    const search = searchParams?.toString() ?? "";
    const contextFooter = buildContextFooter(pathname, search);
    const fullMessage = contextFooter
      ? `${text}\n\n—\n${contextFooter}`
      : text;
    const fullPath = pathname + (search ? `?${search}` : "");

    try {
      const res = await fetch("/api/dev-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: fullMessage,
          pagePath: fullPath,
          pageTitle: typeof document !== "undefined" ? document.title : null,
        }),
      });

      if (res.status === 401) {
        setAuthStatus("unauthenticated");
        try {
          localStorage.removeItem(LS_AUTH_FLAG);
        } catch {}
        setInput(text);
        return;
      }

      if (res.ok) {
        await fetchMessages();
      } else {
        setInput(text);
      }
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("cs-CZ", {
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Split message body from auto-appended context footer for display
  const splitBody = (msg: string): { body: string; footer: string | null } => {
    const sep = "\n\n—\n";
    const idx = msg.lastIndexOf(sep);
    if (idx === -1) return { body: msg, footer: null };
    return { body: msg.slice(0, idx), footer: msg.slice(idx + sep.length) };
  };

  return (
    <>
      {isOpen && (
        <div
          className={
            "fixed z-50 flex flex-col overflow-hidden bg-background shadow-2xl " +
            // Mobile: fullscreen w/ dvh to handle virtual keyboard gracefully
            "inset-0 h-[100dvh] w-full rounded-none " +
            // Desktop: floating panel bottom-right
            "sm:inset-auto sm:right-6 sm:bottom-20 sm:h-[560px] sm:max-h-[78vh] sm:w-[400px] sm:rounded-2xl sm:border " +
            "animate-in fade-in slide-in-from-bottom-4 duration-200"
          }
        >
          {/* Header — taller on mobile for thumb reach */}
          <div
            className="flex shrink-0 items-center justify-between border-b bg-rose-50 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top,_0px))] dark:bg-rose-950/30"
          >
            <div>
              <h3 className="text-sm font-semibold text-foreground">DevChat</h3>
              <p className="text-xs text-muted-foreground">
                Napiš cokoliv — tým to uvidí
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground active:bg-muted"
              aria-label="Zavřít chat"
            >
              <X className="size-5" />
            </button>
          </div>

          {authStatus === "loading" ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : authStatus === "unauthenticated" ? (
            <form
              onSubmit={handleLogin}
              className="flex flex-1 flex-col px-6 pt-8 pb-6"
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/50">
                  <Lock className="size-6 text-rose-500" />
                </div>
                <p className="text-base font-semibold text-foreground">
                  Ahoj Janičko 👋
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Zadej heslo pro otevření chatu.
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <input
                  ref={passwordRef}
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (loginError) setLoginError(null);
                  }}
                  placeholder="Heslo"
                  autoComplete="current-password"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  inputMode="text"
                  className="h-12 w-full rounded-xl border bg-muted/40 px-4 text-base outline-none transition-colors duration-150 focus:border-rose-300 focus:ring-2 focus:ring-rose-200"
                />
                {loginError && (
                  <p className="text-sm text-red-600" role="alert">
                    {loginError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loggingIn || !password}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-500 text-base font-medium text-white transition-colors duration-150 hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loggingIn ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    "Přihlásit se"
                  )}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    <MessageCircle className="mx-auto mb-2 size-8 text-muted-foreground/40" />
                    <p>Zatím žádné zprávy.</p>
                    <p className="mt-1 text-xs">
                      Napiš požadavek, feedback, nebo cokoliv.
                    </p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => {
                      const { body, footer } = splitBody(msg.message);
                      return (
                        <div key={msg.id} className="mb-3">
                          {msg.sender === "owner" && (
                            <div className="flex flex-col items-end">
                              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-rose-500 px-3.5 py-2 text-sm text-white">
                                {body}
                              </div>
                              {footer && (
                                <span className="mt-0.5 max-w-[85%] text-right text-[10px] text-muted-foreground/80">
                                  {footer}
                                </span>
                              )}
                              <span className="mt-0.5 text-[10px] text-muted-foreground">
                                {formatTime(msg.createdAt)}
                              </span>
                              {msg.response && (
                                <div className="mt-1.5 mr-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-muted px-3.5 py-2 text-sm">
                                  {msg.response}
                                </div>
                              )}
                            </div>
                          )}
                          {msg.sender === "lead" && (
                            <div className="flex flex-col items-start">
                              <div className="text-[10px] font-medium text-rose-600 dark:text-rose-400">
                                Lead
                              </div>
                              <div className="mt-0.5 max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-muted px-3.5 py-2 text-sm">
                                {body}
                              </div>
                              <span className="mt-0.5 text-[10px] text-muted-foreground">
                                {formatTime(msg.createdAt)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              <div
                className="shrink-0 border-t bg-background p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,_0px))]"
              >
                <div className="flex gap-2">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value.slice(0, 500))}
                    onKeyDown={handleKeyDown}
                    placeholder="Napiš zprávu..."
                    rows={2}
                    enterKeyHint="send"
                    className="flex-1 resize-none rounded-xl border bg-muted/50 px-3 py-2 text-base outline-none transition-colors duration-150 placeholder:text-muted-foreground/60 focus:border-rose-300 focus:ring-1 focus:ring-rose-300 sm:text-sm"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className="flex size-11 shrink-0 items-center justify-center self-end rounded-xl bg-rose-500 text-white transition-colors duration-150 hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Odeslat zprávu"
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  {input.length}/500 · Ctrl+Enter odešle
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="devchat-bubble-pos fixed right-6 z-50 flex size-14 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg transition-all hover:bg-rose-600 hover:shadow-xl active:scale-95 bottom-[calc(1.5rem+env(safe-area-inset-bottom,_0px))]"
        aria-label={isOpen ? "Zavřít chat" : "Otevřít DevChat"}
      >
        {!isOpen && unreadCount > 0 && (
          <span className="absolute inset-0 animate-ping rounded-full bg-rose-400 opacity-30" />
        )}
        {isOpen ? <X className="size-6" /> : <MessageCircle className="size-6" />}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 py-0.5 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </>
  );
}
