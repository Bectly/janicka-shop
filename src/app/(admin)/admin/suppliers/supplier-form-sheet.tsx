"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createSupplier, updateSupplier } from "./actions";

export interface SupplierFormValues {
  id: string;
  name: string;
  url: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
}

interface Props {
  supplier?: SupplierFormValues;
  trigger?: "primary" | "icon";
}

export function SupplierFormSheet({ supplier, trigger = "primary" }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEditing = !!supplier;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (isEditing && supplier) {
          await updateSupplier(supplier.id, formData);
        } else {
          await createSupplier(formData);
        }
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Něco se pokazilo");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          trigger === "primary" ? (
            <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-95" />
          ) : (
            <button
              className="rounded-lg p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
              title="Upravit"
              aria-label="Upravit dodavatele"
            />
          )
        }
      >
        {trigger === "primary" ? (
          <>
            <Plus className="size-4" />
            Přidat dodavatele
          </>
        ) : (
          <Pencil className="size-4" />
        )}
      </SheetTrigger>

      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>
            {isEditing ? "Upravit dodavatele" : "Nový dodavatel"}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {isEditing
              ? "Změny se projeví okamžitě."
              : "Přidejte nového dodavatele second-hand zboží."}
          </SheetDescription>
        </SheetHeader>

        <form
          action={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-foreground"
              >
                Název *
              </label>
              <Input
                id="name"
                name="name"
                required
                maxLength={200}
                defaultValue={supplier?.name ?? ""}
                placeholder="např. OPATEX"
                className="mt-1"
              />
            </div>

            <div>
              <label
                htmlFor="url"
                className="block text-sm font-medium text-foreground"
              >
                Web
              </label>
              <Input
                id="url"
                name="url"
                type="url"
                maxLength={2048}
                defaultValue={supplier?.url ?? ""}
                placeholder="https://..."
                className="mt-1"
              />
            </div>

            <div>
              <label
                htmlFor="contactEmail"
                className="block text-sm font-medium text-foreground"
              >
                Kontaktní e-mail
              </label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                maxLength={320}
                defaultValue={supplier?.contactEmail ?? ""}
                placeholder="kontakt@..."
                className="mt-1"
              />
            </div>

            <div>
              <label
                htmlFor="contactPhone"
                className="block text-sm font-medium text-foreground"
              >
                Kontaktní telefon
              </label>
              <Input
                id="contactPhone"
                name="contactPhone"
                type="tel"
                maxLength={50}
                defaultValue={supplier?.contactPhone ?? ""}
                placeholder="+420 ..."
                className="mt-1"
              />
            </div>

            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-foreground"
              >
                Poznámky
              </label>
              <Textarea
                id="notes"
                name="notes"
                rows={6}
                maxLength={8000}
                defaultValue={supplier?.notes ?? ""}
                placeholder="Platební podmínky, specifika vyzvednutí, kontaktní osoby... (markdown)"
                className="mt-1 font-mono text-xs"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Podporuje markdown. Max 8 000 znaků.
              </p>
            </div>
          </div>

          <SheetFooter className="border-t px-6 py-4">
            <div className="flex items-center justify-end gap-2">
              <SheetClose
                render={
                  <Button type="button" variant="outline" disabled={isPending}>
                    Zrušit
                  </Button>
                }
              />
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "Ukládám..."
                  : isEditing
                    ? "Uložit změny"
                    : "Vytvořit dodavatele"}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
