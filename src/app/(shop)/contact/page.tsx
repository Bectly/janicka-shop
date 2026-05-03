import type { Metadata } from "next";
import { Mail, Share2, Clock } from "lucide-react";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Kontakt | Janička",
  description:
    "Kontaktujte nás — Janička second hand eshop. Rádi vám pomůžeme s objednávkou.",
};

const contactInfo = [
  {
    icon: Mail,
    label: "E-mail",
    value: "info@jvsatnik.cz",
    gradient: "from-brand/[0.06] to-champagne-light/30",
    iconGradient: "from-brand/20 to-blush",
  },
  {
    icon: Share2,
    label: "Sociální sítě",
    value: "Sledujte nás na Instagramu pro novinky a inspiraci.",
    gradient: "from-blush-light/50 to-brand/[0.04]",
    iconGradient: "from-blush to-brand/20",
  },
  {
    icon: Clock,
    label: "Doba odezvy",
    value: "Na e-maily odpovídáme obvykle do 24 hodin v pracovní dny.",
    gradient: "from-sage-light/20 to-champagne-light/20",
    iconGradient: "from-sage-light/60 to-champagne-light/40",
  },
] as const;

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Editorial header */}
      <div className="mb-10 flex flex-col items-start gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold tracking-wide text-primary">
          <Mail className="size-3" />
          Jsme tu pro vás
        </span>
        <h1 className="font-heading text-[1.75rem] font-bold text-foreground sm:text-3xl">
          Kontaktujte nás
        </h1>
        <p className="text-muted-foreground">
          Máte dotaz k objednávce nebo potřebujete poradit s výběrem? Napište
          nám!
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Contact info — branded cards */}
        <div className="space-y-3">
          {contactInfo.map(({ icon: Icon, label, value, gradient, iconGradient }) => (
            <div
              key={label}
              className={`flex items-start gap-4 rounded-xl border border-border/60 bg-gradient-to-br ${gradient} p-4`}
            >
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${iconGradient} ring-1 ring-inset ring-black/[0.06]`}
              >
                <Icon className="size-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">{label}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Contact form */}
        <ContactForm />
      </div>
    </div>
  );
}
