"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { createBundle } from "../actions";

interface Props {
  supplierId: string;
}

export function BundleFormSheet({ supplierId }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createBundle(supplierId, formData);
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
          <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-95" />
        }
      >
        <Plus className="size-4" />
        Nový balík
      </SheetTrigger>

      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Nový balík</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Zaznamenejte objednávku — položky doplníte při rozbalování.
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
                htmlFor="orderDate"
                className="block text-sm font-medium text-foreground"
              >
                Datum objednávky *
              </label>
              <Input
                id="orderDate"
                name="orderDate"
                type="date"
                required
                defaultValue={today}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="totalKg"
                  className="block text-sm font-medium text-foreground"
                >
                  Hmotnost (kg) *
                </label>
                <Input
                  id="totalKg"
                  name="totalKg"
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  placeholder="20"
                  className="mt-1"
                />
              </div>
              <div>
                <label
                  htmlFor="totalPrice"
                  className="block text-sm font-medium text-foreground"
                >
                  Celková cena (Kč) *
                </label>
                <Input
                  id="totalPrice"
                  name="totalPrice"
                  type="number"
                  step="1"
                  min="0"
                  required
                  placeholder="5324"
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">vč. DPH</p>
              </div>
            </div>

            <div>
              <label
                htmlFor="invoiceNumber"
                className="block text-sm font-medium text-foreground"
              >
                Číslo faktury
              </label>
              <Input
                id="invoiceNumber"
                name="invoiceNumber"
                maxLength={100}
                placeholder="FV-2025-..."
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
                rows={4}
                maxLength={8000}
                placeholder="Co bylo v balíku, kondice..."
                className="mt-1 font-mono text-xs"
              />
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
                {isPending ? "Ukládám..." : "Vytvořit balík"}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
