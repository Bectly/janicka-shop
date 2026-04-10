"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";

const ALL_LOGOS = [
  { id: "v1", src: "/logos/logo_v1_elegant.png", name: "Rose Gold Serif" },
  { id: "v2", src: "/logos/logo_v2_modern.png", name: "Bold Modern" },
  { id: "v3", src: "/logos/logo_v3_boutique.png", name: "Boutique s Ramínkem" },
  { id: "r2_v1", src: "/logos/logo_r2_v1.png", name: "Dark Elegance" },
  { id: "r2_v2", src: "/logos/logo_r2_v2.png", name: "Vzdušný Dvojkruh" },
  { id: "r2_v3", src: "/logos/logo_r2_v3.png", name: "Pivoňka Two-Tone" },
  { id: "r3_v1", src: "/logos/logo_r3_v1.png", name: "Hairline Serif" },
  { id: "r3_v2", src: "/logos/logo_r3_v2.png", name: "Brush & Blossom" },
  { id: "r3_v3", src: "/logos/logo_r3_v3.png", name: "Art Deco Glam" },
  { id: "r3_v4", src: "/logos/logo_r3_v4.png", name: "Romantic Copperplate" },
  { id: "r3_v5", src: "/logos/logo_r3_v5.png", name: "Sans Meets Script" },
  { id: "r3_v6", src: "/logos/logo_r3_v6.png", name: "Watercolor Dream" },
  { id: "r3_v7", src: "/logos/logo_r3_v7.png", name: "Didot Editorial" },
  { id: "r3_v8", src: "/logos/logo_r3_v8.png", name: "Hravý Podpis" },
  { id: "r3_v9", src: "/logos/logo_r3_v9.png", name: "Plynulé Tažení" },
  { id: "r3_v10", src: "/logos/logo_r3_v10.png", name: "Heritage & Bloom" },
  { id: "r4_v1", src: "/logos/logo_r4_v1.png", name: "Pivoňka v Akvarelu" },
  { id: "r4_v2", src: "/logos/logo_r4_v2.png", name: "Srdíčko & Pivoňka" },
  { id: "r4_v3", src: "/logos/logo_r4_v3.png", name: "Růže & Levandule" },
  { id: "r4_v4", src: "/logos/logo_r4_v4.png", name: "Třešňový Sen" },
  { id: "r4_v5", src: "/logos/logo_r4_v5.png", name: "Luční Kytice" },
  { id: "r4_v6", src: "/logos/logo_r4_v6.png", name: "Rose Gold Dream" },
  { id: "r5_v1", src: "/logos/logo_r5_v1.png", name: "Sakura Gold" },
  { id: "r5_v2", src: "/logos/logo_r5_v2.png", name: "Čistá Elegance" },
  { id: "r5_v3", src: "/logos/logo_r5_v3.png", name: "Třešňové Sny" },
  { id: "r5_v4", src: "/logos/logo_r5_v4.png", name: "Dvojitý Rose Gold" },
  { id: "r6_v1", src: "/logos/logo_r6_v1.png", name: "Odvážná Pivoňka" },
  { id: "r6_v2", src: "/logos/logo_r6_v2.png", name: "Pivoňka v Kruhu" },
  { id: "r6_v3", src: "/logos/logo_r6_v3.png", name: "Mokrý Papír" },
  { id: "r6_v4", src: "/logos/logo_r6_v4.png", name: "Čistý Šepot" },
  { id: "r7_v1", src: "/logos/logo_r7_v1.png", name: "Prorostlá Zahrada" },
  { id: "r7_v2", src: "/logos/logo_r7_v2.png", name: "Sedmikrásky v Kruhu" },
  { id: "r7_v3", src: "/logos/logo_r7_v3.png", name: "Květinový Rám" },
  { id: "r7_v4", src: "/logos/logo_r7_v4.png", name: "Věrný Originál" },
  { id: "r8_v1", src: "/logos/logo_r8_v1.png", name: "Třešňová Větvička" },
  { id: "r8_v2", src: "/logos/logo_r8_v2.png", name: "Tři Tulipánky" },
  { id: "r8_v3", src: "/logos/logo_r8_v3.png", name: "Jedna Větvička" },
  { id: "final_v1", src: "/logos/logo_final_v1.png", name: "Květinový Oblouk" },
  { id: "final_v2", src: "/logos/logo_final_v2.png", name: "Růžový Kruh" },
  { id: "final_v3", src: "/logos/logo_final_v3.png", name: "Třešňový Šepot" },
  { id: "final_v4", src: "/logos/logo_final_v4.png", name: "Dva Tulipány 🌷" },
  { id: "final_v5", src: "/logos/logo_final_v5.png", name: "Samotná Pivoňka" },
  { id: "final_v6", src: "/logos/logo_final_v6.png", name: "Levandulový Sen" },
  { id: "final_v7", src: "/logos/logo_final_v7.png", name: "Kresba Růže" },
  { id: "final_v8", src: "/logos/logo_final_v8.png", name: "Sakura na Kruhu" },
  { id: "final_v9", src: "/logos/logo_final_v9.png", name: "Křížené Kvítky" },
  { id: "final_v10", src: "/logos/logo_final_v10.png", name: "Pomněnky" },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function PickLogoClient() {
  const [remaining, setRemaining] = useState(ALL_LOGOS);
  const [shuffled, setShuffled] = useState(false);
  useEffect(() => { if (!shuffled) { setRemaining(shuffle(ALL_LOGOS)); setShuffled(true); } }, [shuffled]);
  const [nextRound, setNextRound] = useState<typeof ALL_LOGOS>([]);
  const [round, setRound] = useState(1);
  const [matchIndex, setMatchIndex] = useState(0);
  const [winner, setWinner] = useState<(typeof ALL_LOGOS)[0] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [eliminated, setEliminated] = useState<typeof ALL_LOGOS>([]);

  const totalInRound = Math.floor(remaining.length / 2);
  const leftover = remaining.length % 2 === 1 ? remaining[remaining.length - 1] : null;

  const left = remaining[matchIndex * 2];
  const right = remaining[matchIndex * 2 + 1];

  const pick = useCallback(
    (chosen: (typeof ALL_LOGOS)[0], loser: (typeof ALL_LOGOS)[0]) => {
      setPicked(chosen.id);
      setEliminated((prev) => [...prev, loser]);

      setTimeout(() => {
        const updated = [...nextRound, chosen];

        if (matchIndex + 1 < totalInRound) {
          setNextRound(updated);
          setMatchIndex(matchIndex + 1);
          setPicked(null);
        } else {
          // Round complete
          const nextRemaining = leftover ? [...updated, leftover] : updated;

          if (nextRemaining.length === 1) {
            setWinner(nextRemaining[0]);
          } else {
            setRemaining(shuffle(nextRemaining));
            setNextRound([]);
            setMatchIndex(0);
            setRound(round + 1);
            setPicked(null);
          }
        }
      }, 400);
    },
    [matchIndex, totalInRound, nextRound, leftover, round]
  );

  if (winner) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-pink-50 to-white px-4 py-12">
        <div className="animate-bounce text-4xl">🎉</div>
        <h1 className="mt-4 text-center font-serif text-3xl font-light text-pink-700">
          Máme vítěze!
        </h1>
        <p className="mt-2 text-center text-gray-500">
          Janičko, tohle je tvoje logo 💕
        </p>
        <div className="mt-8 overflow-hidden rounded-2xl bg-white p-6 shadow-xl ring-2 ring-pink-200">
          <Image
            src={winner.src}
            alt={winner.name}
            width={400}
            height={400}
            className="object-contain"
            unoptimized
          />
        </div>
        <p className="mt-6 text-xl font-medium text-pink-600">{winner.name}</p>
        <p className="mt-2 text-sm text-gray-400">
          Vyřadila jsi {eliminated.length} variant v {round} kolech
        </p>
        <button
          onClick={() => {
            setRemaining(shuffle(ALL_LOGOS));
            setNextRound([]);
            setMatchIndex(0);
            setRound(1);
            setWinner(null);
            setEliminated([]);
            setPicked(null);
          }}
          className="mt-8 rounded-full bg-pink-100 px-6 py-2.5 text-sm font-medium text-pink-700 transition-colors hover:bg-pink-200"
        >
          Zkusit znovu?
        </button>
        <p className="mt-12 text-xs italic text-gray-300">
          S láskou od JARVIS 🐱
        </p>
      </div>
    );
  }

  if (!left || !right) return null;

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-pink-50 to-white">
      {/* Header */}
      <div className="px-4 pb-3 pt-8 text-center">
        <h1 className="font-serif text-2xl font-light text-pink-700">
          Vyber si logo 💕
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Kolo {round} · Zbývá {remaining.length} variant
        </p>
        <div className="mx-auto mt-3 flex max-w-xs gap-1">
          {Array.from({ length: totalInRound }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < matchIndex
                  ? "bg-pink-400"
                  : i === matchIndex
                    ? "bg-pink-300"
                    : "bg-pink-100"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Match */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-4 sm:flex-row sm:gap-8">
        {[
          { logo: left, other: right },
          { logo: right, other: left },
        ].map(({ logo, other }) => (
          <button
            key={logo.id}
            onClick={() => pick(logo, other)}
            disabled={picked !== null}
            className={`group relative w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-md transition-all duration-300 sm:max-w-sm ${
              picked === logo.id
                ? "scale-105 ring-4 ring-pink-400 shadow-xl"
                : picked !== null
                  ? "scale-90 opacity-30"
                  : "active:scale-95 hover:shadow-xl hover:ring-2 hover:ring-pink-200"
            }`}
          >
            <div className="aspect-square p-4">
              <Image
                src={logo.src}
                alt={logo.name}
                width={400}
                height={400}
                className="size-full object-contain"
                unoptimized
              />
            </div>
            <div className="border-t px-4 py-3">
              <p className="text-sm font-medium text-gray-700">{logo.name}</p>
            </div>
            {picked === logo.id && (
              <div className="absolute inset-0 flex items-center justify-center bg-pink-500/10">
                <span className="text-4xl">💕</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 pb-6 pt-2 text-center">
        <p className="text-xs text-gray-300">
          Klikni na to, které se ti líbí víc · JARVIS 🐱
        </p>
      </div>
    </div>
  );
}
