"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Send, Loader2, LogIn } from "lucide-react";
import Link from "next/link";

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

export function DevChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();

  // Check auth status on mount
  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/session");
        if (cancelled) return;
        if (!res.ok) {
          setAuthStatus("unauthenticated");
          return;
        }
        const data = await res.json();
        setAuthStatus(data?.user ? "authenticated" : "unauthenticated");
      } catch {
        if (!cancelled) setAuthStatus("unauthenticated");
      }
    }
    checkAuth();
    return () => { cancelled = true; };
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Fetch all messages
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/dev-chat?limit=100");
      if (res.status === 401) {
        setAuthStatus("unauthenticated");
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      const msgs: Message[] = (data.messages ?? []).sort(
        (a: Message, b: Message) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setMessages(msgs);
    } catch {
      // Silently fail — don't block UI
    }
  }, []);

  // Mark Lead messages as read
  const markAsRead = useCallback(async (msgs: Message[]) => {
    const unread = msgs.filter(
      (m) => m.sender === "lead" && m.status === "new",
    );
    // Optimistically mark locally
    if (unread.length > 0) {
      setUnreadCount(0);
      // Fire-and-forget PATCH calls
      for (const m of unread) {
        fetch(`/api/dev-chat/${m.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "read" }),
        }).catch(() => {});
      }
    }
  }, []);

  // Poll for unread count when panel is closed (skip if unauthenticated)
  useEffect(() => {
    if (isOpen || authStatus !== "authenticated") return;

    const checkUnread = async () => {
      try {
        const res = await fetch("/api/dev-chat?sender=lead&status=new&limit=100");
        if (res.status === 401) {
          setAuthStatus("unauthenticated");
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setUnreadCount(data.count ?? 0);
      } catch {
        // Silently fail
      }
    };

    checkUnread();
    const interval = setInterval(checkUnread, 30_000);
    return () => clearInterval(interval);
  }, [isOpen, authStatus]);

  // Fetch messages + mark read when panel opens (skip if unauthenticated)
  useEffect(() => {
    if (!isOpen || authStatus !== "authenticated") return;

    setLoading(true);
    fetchMessages().then(() => {
      setLoading(false);
      // Mark read after state update
      setTimeout(() => {
        setMessages((prev) => {
          markAsRead(prev);
          return prev;
        });
      }, 100);
    });

    // Poll for new messages while open
    const interval = setInterval(fetchMessages, 15_000);
    return () => clearInterval(interval);
  }, [isOpen, authStatus, fetchMessages, markAsRead]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen, scrollToBottom]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput("");

    try {
      const res = await fetch("/api/dev-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          pagePath: pathname,
          pageTitle: document.title,
        }),
      });

      if (res.ok) {
        // Refetch to get the new message with server ID
        await fetchMessages();
      }
    } catch {
      // Restore input on failure
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

  return (
    <>
      {/* Chat panel */}
      {isOpen && (
        <div
          className={
            // Desktop: positioned above bubble. Mobile: full-screen below top bar.
            "fixed z-50 flex flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl " +
            "inset-x-0 bottom-0 top-16 sm:inset-auto sm:right-6 sm:bottom-20 sm:h-[520px] sm:max-h-[70vh] sm:w-[380px] " +
            "animate-in fade-in slide-in-from-bottom-4 duration-200"
          }
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b bg-rose-50 px-4 py-3 dark:bg-rose-950/30">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                DevChat
              </h3>
              <p className="text-xs text-muted-foreground">
                Napište cokoliv — tým to uvidí
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Zavřít chat"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Content — depends on auth status */}
          {authStatus === "loading" ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : authStatus === "unauthenticated" ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
              <LogIn className="mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">
                Přihlas se pro komunikaci s týmem
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                DevChat je dostupný pouze pro přihlášené administrátory.
              </p>
              <Link
                href="/admin/login"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-600"
              >
                <LogIn className="size-4" />
                Přihlásit se
              </Link>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    <MessageCircle className="mx-auto mb-2 size-8 text-muted-foreground/40" />
                    <p>Zatím žádné zprávy.</p>
                    <p className="mt-1 text-xs">
                      Napište požadavek, feedback, nebo cokoliv.
                    </p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <div key={msg.id} className="mb-3">
                        {/* Owner message */}
                        {msg.sender === "owner" && (
                          <div className="flex flex-col items-end">
                            <div className="max-w-[85%] rounded-2xl rounded-br-md bg-rose-500 px-3.5 py-2 text-sm text-white">
                              {msg.message}
                            </div>
                            <span className="mt-0.5 text-[10px] text-muted-foreground">
                              {formatTime(msg.createdAt)}
                              {msg.pagePath && (
                                <span className="ml-1 opacity-60">
                                  z {msg.pagePath}
                                </span>
                              )}
                            </span>
                            {/* Lead's inline response */}
                            {msg.response && (
                              <div className="mt-1.5 mr-auto max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-3.5 py-2 text-sm">
                                {msg.response}
                              </div>
                            )}
                          </div>
                        )}
                        {/* Lead message */}
                        {msg.sender === "lead" && (
                          <div className="flex flex-col items-start">
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <span className="font-medium text-rose-600 dark:text-rose-400">
                                Lead
                              </span>
                            </div>
                            <div className="mt-0.5 max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-3.5 py-2 text-sm">
                              {msg.message}
                            </div>
                            <span className="mt-0.5 text-[10px] text-muted-foreground">
                              {formatTime(msg.createdAt)}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input — pb accounts for iPhone home indicator on mobile fullscreen panel; 0px safe area on desktop */}
              <div className="border-t bg-background p-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
                <div className="flex gap-2">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) =>
                      setInput(e.target.value.slice(0, 500))
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="Napište zprávu..."
                    rows={2}
                    className="flex-1 resize-none rounded-xl border bg-muted/50 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-rose-300 focus:ring-1 focus:ring-rose-300"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className="flex size-10 shrink-0 items-center justify-center self-end rounded-xl bg-rose-500 text-white transition-colors hover:bg-rose-600 disabled:opacity-50"
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
                  {input.length}/500 &middot; Ctrl+Enter odešle
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating bubble */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="devchat-bubble-pos fixed right-6 z-50 flex size-14 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg transition-all hover:bg-rose-600 hover:shadow-xl active:scale-95"
        aria-label={isOpen ? "Zavřít chat" : "Otevřít DevChat"}
      >
        {/* Pulse ring when unread */}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute inset-0 animate-ping rounded-full bg-rose-400 opacity-30" />
        )}
        {isOpen ? (
          <X className="size-6" />
        ) : (
          <MessageCircle className="size-6" />
        )}
        {/* Unread badge */}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 py-0.5 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </>
  );
}
