import type { Metadata } from "next";
import { ShuffleClient } from "./shuffle-client";

export const metadata: Metadata = {
  title: "Objevuj — náhodné kousky | Janička Shop",
  description:
    "Objevuj náhodné second-hand kousky. Jedním klikem další unikát — nikdy nevíš, na co narazíš.",
};

export default function ObjevujPage() {
  return <ShuffleClient />;
}
