import { JarvisRemoteFrame } from "@/components/admin/jarvis-remote-frame";

export const metadata = {
  title: "JARVIS — Admin",
};

export default function JarvisPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">JARVIS</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vzdálený Claude Code terminál s přístupem k eshopu. Chráněno Cloudflare Access + basic auth.
        </p>
      </div>
      <JarvisRemoteFrame />
    </div>
  );
}
