import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { startUnpackBatch } from "./actions";

export default async function UnpackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const { id } = await params;
  const db = await getDb();

  const bundle = await db.supplierBundle.findUnique({
    where: { id },
    select: {
      id: true,
      supplier: { select: { name: true } },
      lines: {
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true, kg: true, pricePerKg: true },
      },
    },
  });

  if (!bundle) notFound();

  const action = startUnpackBatch.bind(null, id);

  return (
    <>
      <div className="mb-4">
        <Link
          href={`/admin/bundles/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {bundle.supplier.name}
        </Link>
      </div>

      <h1 className="font-heading text-2xl font-bold text-foreground">
        Rozbalit balík: {bundle.supplier.name}
      </h1>

      <form action={action} className="mt-8 max-w-lg space-y-8">
        {/* Bundle line radio group */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-foreground">
            Kategorie
          </legend>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input
              type="radio"
              name="bundleLineId"
              value=""
              defaultChecked
              className="accent-primary"
            />
            <span className="text-sm font-medium text-foreground">Všechno</span>
          </label>

          {bundle.lines.map((line) => (
            <label
              key={line.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                name="bundleLineId"
                value={line.id}
                className="accent-primary"
              />
              <span className="text-sm text-foreground">
                <span className="font-mono font-medium">{line.code}</span>{" "}
                {line.name}{" "}
                <span className="text-muted-foreground">
                  ({line.kg} kg, {line.pricePerKg} Kč/kg)
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {/* Weight input */}
        <div className="space-y-2">
          <label
            htmlFor="defaultWeightG"
            className="block text-sm font-medium text-foreground"
          >
            Hmotnost kousku (g)
          </label>
          <input
            id="defaultWeightG"
            name="defaultWeightG"
            type="number"
            min={1}
            max={9999}
            placeholder="200"
            className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">
            Typicky 150–300 g. Slouží pro výpočet ceny nákladu.
          </p>
        </div>

        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
        >
          Spustit QR batch →
        </button>
      </form>
    </>
  );
}
