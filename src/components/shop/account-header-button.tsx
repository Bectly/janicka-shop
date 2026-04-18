import Link from "next/link";
import { User } from "lucide-react";
import { auth } from "@/lib/auth";
import { UserMenuDropdown } from "./user-menu-dropdown";

export async function AccountHeaderButton() {
  const session = await auth();
  const isCustomer = session?.user?.role === "customer";

  if (!isCustomer) {
    return (
      <Link
        href="/login"
        aria-label="Přihlásit se"
        className="inline-flex size-11 items-center justify-center rounded-lg text-foreground/80 transition-colors duration-150 hover:bg-muted hover:text-foreground"
      >
        <User className="size-5" />
      </Link>
    );
  }

  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? email;
  return <UserMenuDropdown name={name} email={email} />;
}
