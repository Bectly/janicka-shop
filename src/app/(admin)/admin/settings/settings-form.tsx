"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, CheckCircle2, AlertCircle } from "lucide-react";
import { updateShopSettings, type SettingsResult } from "./actions";

interface SettingsFormProps {
  settings: {
    shopName: string;
    description: string;
    contactEmail: string;
    contactPhone: string;
    street: string;
    city: string;
    zip: string;
    ico: string;
    dic: string;
    instagram: string;
    facebook: string;
    notifyOnNewOrder: boolean;
    notifyOnReturn: boolean;
    notifyOnReviewFailed: boolean;
    soundNotifications: boolean;
  };
}

export function SettingsForm({ settings }: SettingsFormProps) {
  const [state, action, isPending] = useActionState<SettingsResult | null, FormData>(
    updateShopSettings,
    null,
  );

  return (
    <form action={action} className="space-y-8">
      {state && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            state.success
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {state.success ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : (
            <AlertCircle className="size-4 shrink-0" />
          )}
          {state.message}
        </div>
      )}

      {/* Základní info */}
      <section>
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Základní informace
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Název a popis obchodu zobrazený na webu.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="shopName">Název obchodu *</Label>
            <Input
              id="shopName"
              name="shopName"
              defaultValue={settings.shopName}
              required
              className="mt-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description">Popis</Label>
            <textarea
              id="description"
              name="description"
              defaultValue={settings.description}
              rows={3}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Krátký popis obchodu..."
            />
          </div>
        </div>
      </section>

      {/* Kontakt */}
      <section>
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Kontaktní údaje
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Kontaktní informace zobrazené v patičce a na stránce kontaktů.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="contactEmail">E-mail</Label>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={settings.contactEmail}
              placeholder="info@janicka.cz"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="contactPhone">Telefon</Label>
            <Input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              defaultValue={settings.contactPhone}
              placeholder="+420 xxx xxx xxx"
              className="mt-1.5"
            />
          </div>
        </div>
      </section>

      {/* Adresa */}
      <section>
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Fakturační adresa
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Adresa obchodu pro faktury a obchodní podmínky.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="street">Ulice a číslo</Label>
            <Input
              id="street"
              name="street"
              defaultValue={settings.street}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="city">Město</Label>
            <Input
              id="city"
              name="city"
              defaultValue={settings.city}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="zip">PSČ</Label>
            <Input
              id="zip"
              name="zip"
              defaultValue={settings.zip}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="ico">IČO</Label>
            <Input
              id="ico"
              name="ico"
              defaultValue={settings.ico}
              placeholder="12345678"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="dic">DIČ</Label>
            <Input
              id="dic"
              name="dic"
              defaultValue={settings.dic}
              placeholder="CZ12345678"
              className="mt-1.5"
            />
          </div>
        </div>
      </section>

      {/* Sociální sítě */}
      <section>
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Sociální sítě
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Odkazy na sociální sítě zobrazené v patičce webu.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="instagram">Instagram</Label>
            <Input
              id="instagram"
              name="instagram"
              defaultValue={settings.instagram}
              placeholder="https://instagram.com/janicka.shop"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="facebook">Facebook</Label>
            <Input
              id="facebook"
              name="facebook"
              defaultValue={settings.facebook}
              placeholder="https://facebook.com/janicka.shop"
              className="mt-1.5"
            />
          </div>
        </div>
      </section>

      {/* Notifikace */}
      <section>
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Notifikace
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          E-mailové upozornění se pošle na{" "}
          <strong>
            {settings.contactEmail || "(není nastaven e-mail v kontaktních údajích)"}
          </strong>
          . Zvuková notifikace hraje krátký tón při nové objednávce, dokud máš admin otevřený.
        </p>
        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="notifyOnNewOrder"
              defaultChecked={settings.notifyOnNewOrder}
              className="mt-0.5 size-4 rounded border-input"
            />
            <span>
              <span className="font-medium text-foreground">Poslat mi e-mail při nové objednávce</span>
              <span className="block text-xs text-muted-foreground">
                Po zaplacení online platby nebo při dobírce dorazí shrnutí objednávky.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="notifyOnReturn"
              defaultChecked={settings.notifyOnReturn}
              className="mt-0.5 size-4 rounded border-input"
            />
            <span>
              <span className="font-medium text-foreground">Poslat mi e-mail při vrácení zboží</span>
              <span className="block text-xs text-muted-foreground">
                Když zákaznice odešle žádost o vratku (14 dní).
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="notifyOnReviewFailed"
              defaultChecked={settings.notifyOnReviewFailed}
              className="mt-0.5 size-4 rounded border-input"
            />
            <span>
              <span className="font-medium text-foreground">Poslat mi e-mail, když se nepodaří odeslat žádost o recenzi</span>
              <span className="block text-xs text-muted-foreground">
                Dozvíš se o selhání automatické pošty do Heureky.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="soundNotifications"
              defaultChecked={settings.soundNotifications}
              className="mt-0.5 size-4 rounded border-input"
            />
            <span>
              <span className="font-medium text-foreground">Zvuková notifikace v administraci</span>
              <span className="block text-xs text-muted-foreground">
                Krátký tón zahraje při příchodu nové objednávky, pokud máš otevřený admin.
              </span>
            </span>
          </label>
        </div>
      </section>

      <div className="flex justify-end border-t pt-6">
        <Button type="submit" disabled={isPending}>
          <Save className="size-4" data-icon="inline-start" />
          {isPending ? "Ukládám..." : "Uložit nastavení"}
        </Button>
      </div>
    </form>
  );
}
