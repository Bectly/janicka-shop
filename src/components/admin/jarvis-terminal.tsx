"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import "@xterm/xterm/css/xterm.css";

type JarvisReply = {
  lines: string[];
  kind?: "info" | "ok" | "warn" | "err";
};

const BANNER = [
  "",
  "     ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗",
  "     ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝",
  "     ██║███████║██████╔╝██║   ██║██║███████╗",
  "██   ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║",
  "╚█████╔╝██║  ██║██║  ██║ ╚████╔╝ ██║███████║",
  " ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝",
  "",
  "         Janička Shop — admin console",
  '         Napiš "help" pro seznam příkazů.',
  "",
];

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  rose: "\x1b[38;5;211m",
  pink: "\x1b[38;5;219m",
  green: "\x1b[38;5;114m",
  red: "\x1b[38;5;203m",
  yellow: "\x1b[38;5;222m",
  cyan: "\x1b[38;5;117m",
};

function colorize(line: string, kind: JarvisReply["kind"]): string {
  switch (kind) {
    case "ok":
      return `${C.green}${line}${C.reset}`;
    case "err":
      return `${C.red}${line}${C.reset}`;
    case "warn":
      return `${C.yellow}${line}${C.reset}`;
    case "info":
      return `${C.cyan}${line}${C.reset}`;
    default:
      return line;
  }
}

export function JarvisTerminal({ userName }: { userName: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed) return;

      const term = new Terminal({
        cursorBlink: true,
        fontFamily:
          '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 13,
        lineHeight: 1.3,
        theme: {
          background: "#0f0a12",
          foreground: "#f5e8ef",
          cursor: "#f5a9c7",
          cursorAccent: "#0f0a12",
          selectionBackground: "#3a2a3f",
          black: "#1a1020",
          red: "#ff8094",
          green: "#a8e6a8",
          yellow: "#f4d08a",
          blue: "#9ccbe8",
          magenta: "#f0a8d0",
          cyan: "#9cd8d8",
          white: "#f5e8ef",
        },
      });

      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(host);
      fit.fit();

      const prompt = `${C.rose}${userName}${C.reset}@${C.pink}janicka${C.reset} ${C.dim}$${C.reset} `;
      const writeBanner = () => {
        BANNER.forEach((l) => term.writeln(`${C.rose}${l}${C.reset}`));
      };
      const writePrompt = () => term.write(prompt);
      const clearInputLine = () => {
        term.write("\r\x1b[K");
        writePrompt();
      };

      writeBanner();
      writePrompt();

      let buffer = "";
      const history: string[] = [];
      let histIdx = -1;
      let busy = false;

      const execCommand = async (cmd: string) => {
        busy = true;
        try {
          const res = await fetch("/api/admin/jarvis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command: cmd }),
          });
          if (!res.ok) {
            term.writeln(`${C.red}Chyba serveru (${res.status})${C.reset}`);
            return;
          }
          const data: JarvisReply = await res.json();
          for (const line of data.lines) {
            if (line === "__CLEAR__") {
              term.clear();
              writeBanner();
              continue;
            }
            if (line === "__EXIT__") {
              term.writeln(`${C.cyan}Odcházím na dashboard…${C.reset}`);
              setTimeout(() => router.push("/admin/dashboard"), 400);
              continue;
            }
            term.writeln(colorize(line, data.kind));
          }
        } catch {
          term.writeln(`${C.red}Síťová chyba.${C.reset}`);
        } finally {
          busy = false;
        }
      };

      const onData = term.onData(async (data: string) => {
        if (busy) return;

        // Handle arrow-key escape sequences as whole strings
        if (data === "\x1b[A") {
          if (history.length === 0) return;
          histIdx = Math.max(0, histIdx - 1);
          buffer = history[histIdx] ?? "";
          clearInputLine();
          term.write(buffer);
          return;
        }
        if (data === "\x1b[B") {
          if (history.length === 0) return;
          histIdx = Math.min(history.length, histIdx + 1);
          buffer = histIdx === history.length ? "" : (history[histIdx] ?? "");
          clearInputLine();
          term.write(buffer);
          return;
        }
        // Ignore left/right arrow & other escape seqs
        if (data.startsWith("\x1b")) return;

        for (const char of data) {
          const code = char.charCodeAt(0);

          if (char === "\r") {
            term.write("\r\n");
            const cmd = buffer.trim();
            buffer = "";
            if (cmd) {
              history.push(cmd);
              histIdx = history.length;
              await execCommand(cmd);
            }
            writePrompt();
            continue;
          }

          if (code === 0x7f || code === 0x08) {
            if (buffer.length > 0) {
              buffer = buffer.slice(0, -1);
              term.write("\b \b");
            }
            continue;
          }

          if (code === 0x03) {
            term.write("^C\r\n");
            buffer = "";
            writePrompt();
            continue;
          }

          if (code === 0x0c) {
            term.clear();
            writeBanner();
            writePrompt();
            term.write(buffer);
            continue;
          }

          if (code >= 0x20) {
            buffer += char;
            term.write(char);
          }
        }
      });

      const onResize = () => {
        try {
          fit.fit();
        } catch {
          // ignore
        }
      };
      window.addEventListener("resize", onResize);

      cleanup = () => {
        window.removeEventListener("resize", onResize);
        onData.dispose();
        term.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [userName, router]);

  return (
    <div
      ref={hostRef}
      className="h-[calc(100vh-10rem)] min-h-[420px] w-full overflow-hidden rounded-xl border bg-[#0f0a12] p-3 shadow-sm"
      aria-label="JARVIS terminál"
    />
  );
}
