import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ProfileForm } from "./profile-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profil — Janička",
};

export default async function AccountProfilePage() {
  await connection();
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    redirect("/login?redirect=/account/profile");
  }

  const db = await getDb();
  const customer = await db.customer.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      street: true,
      city: true,
      zip: true,
    },
  });

  if (!customer) redirect("/login");

  return (
    <div className="space-y-4">
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
    </div>
  );
}
