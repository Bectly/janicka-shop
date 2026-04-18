import { auth } from "@/lib/auth";
import { JarvisTerminal } from "@/components/admin/jarvis-terminal";

export const metadata = {
  title: "JARVIS — Admin",
};

export default async function JarvisPage() {
  const session = await auth();
  const userName = session?.user?.name ?? "admin";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold">JARVIS</h1>
        <p className="text-sm text-muted-foreground">
          Terminál pro rychlé dotazy na obchod. Napiš{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">help</code> pro
          seznam příkazů.
        </p>
      </div>
      <JarvisTerminal userName={userName} />
    </div>
  );
}
