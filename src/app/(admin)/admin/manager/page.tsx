import { redirect } from "next/navigation";

// Manager Framework — interactive strategic agent runs in JARVIS Tauri app on
// bectly's local machine, not in this Vercel-hosted admin. Janička reaches it
// via the existing /admin/jarvis tunnel (jarvis-janicka.jvsatnik.cz) iframe →
// Managers tab in JARVIS sidebar.
export default function AdminManagerPage(): never {
  redirect("/admin/jarvis");
}
