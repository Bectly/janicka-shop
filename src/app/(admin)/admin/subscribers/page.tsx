import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { Mail } from "lucide-react";
import type { Metadata } from "next";
import { SubscriberToggle } from "./subscriber-toggle";
import { ExportCsvButton } from "./export-csv-button";

export const metadata: Metadata = {
  title: "Newsletter odběratelé",
};

export default async function AdminSubscribersPage() {
  const subscribers = await prisma.newsletterSubscriber.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const activeCount = subscribers.filter((s) => s.active).length;

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Newsletter odběratelé
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeCount} aktivních z {subscribers.length} celkem
          </p>
        </div>
        <ExportCsvButton />
      </div>

      {subscribers.length === 0 ? (
        <div className="mt-12 rounded-xl border bg-card p-12 text-center shadow-sm">
          <Mail className="mx-auto size-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">
            Zatím žádní odběratelé
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Odběratelé se přidají přes newsletter formulář na webu.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    E-mail
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Přihlášen
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    Stav
                  </th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((sub) => (
                  <tr
                    key={sub.id}
                    className="border-b last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">
                        {sub.email}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(sub.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <SubscriberToggle id={sub.id} active={sub.active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
