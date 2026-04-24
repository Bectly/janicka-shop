import { redirect } from "next/navigation";
import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { MapPin, ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { customerTag } from "@/lib/customer-cache";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profil — Janička",
};

async function getProfileData(customerId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(customerTag(customerId, "profile"));
  cacheTag(customerTag(customerId, "addresses"));

  const db = await getDb();
  const [customer, addressCount, defaultAddress] = await Promise.all([
    db.customer.findUnique({
      where: { id: customerId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        street: true,
        city: true,
        zip: true,
      },
    }),
    db.customerAddress.count({ where: { customerId } }),
    db.customerAddress.findFirst({
      where: { customerId, isDefault: true },
      select: { label: true, street: true, city: true, zip: true },
    }),
  ]);

  return { customer, addressCount, defaultAddress };
}

export default async function AccountProfilePage() {
  await connection();
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    redirect("/login?redirect=/account/profile");
  }

  const { customer, addressCount, defaultAddress } = await getProfileData(session.user.id);
  if (!customer) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">Profil</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Údaje se předvyplní při dalším nákupu.
        </p>
      </div>

      <ProfileForm
        initial={{
          email: customer.email,
          firstName: customer.firstName ?? "",
          lastName: customer.lastName ?? "",
          phone: customer.phone ?? "",
          street: customer.street ?? "",
          city: customer.city ?? "",
          zip: customer.zip ?? "",
        }}
      />

      <Link
        href="/account/adresy"
        className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40 hover:border-primary/30"
      >
        <MapPin className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">Doručovací adresy</p>
          {addressCount === 0 ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Ještě nemáš uloženou žádnou adresu — přidej si ji.
            </p>
          ) : defaultAddress ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Výchozí: {defaultAddress.label} — {defaultAddress.street}, {defaultAddress.zip}{" "}
              {defaultAddress.city}
              {addressCount > 1 ? ` (+ ${addressCount - 1} dalších)` : ""}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {addressCount} uložených adres
            </p>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>

      <PasswordForm />
    </div>
  );
}
