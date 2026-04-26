import type { Metadata } from "next";
import { StyleQuiz } from "./style-quiz";
import { getSiteUrl } from "@/lib/site-url";

const BASE_URL = getSiteUrl();

export const metadata: Metadata = {
  title: "Kvíz: Najdi svůj styl | Janička",
  description:
    "Pět otázek a osobní výběr second hand kousků jen pro vás. Velikost, styl, stav, barvy a cena — my vybereme.",
  alternates: { canonical: `${BASE_URL}/kviz/styl` },
  openGraph: {
    title: "Kvíz: Najdi svůj styl",
    description:
      "Pět otázek a osobní výběr second hand kousků jen pro vás. Velikost, styl, stav, barvy a cena — my vybereme.",
    url: `${BASE_URL}/kviz/styl`,
    type: "website",
    siteName: "Janička",
    locale: "cs_CZ",
  },
  robots: { index: true, follow: true },
};

export default function StyleQuizPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <StyleQuiz />
    </div>
  );
}
