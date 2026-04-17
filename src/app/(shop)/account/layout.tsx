import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { AccountNav } from "./account-nav";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const session = await auth();

  if (!session?.user || session.user.role !== "customer") {
    redirect("/login?redirect=/account");
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
          Můj účet
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Přihlášena jako {session.user.email}
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <AccountNav />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
