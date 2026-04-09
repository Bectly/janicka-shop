import Link from "next/link";
import Image from "next/image";
import { CookieSettingsButton } from "@/components/shop/cookie-settings-button";
import { NewsletterForm } from "@/components/shop/newsletter-form";
import { getDb } from "@/lib/db";

const footerLinks = {
  nakupovani: {
    title: "Nakupování",
    links: [
      { name: "Všechny produkty", href: "/products" },
      { name: "Kolekce", href: "/collections" },
      { name: "Novinky", href: "/products?sort=newest" },
      { name: "Výprodej", href: "/products?sale=true" },
    ],
  },
  informace: {
    title: "Informace",
    links: [
      { name: "O nás", href: "/about" },
      { name: "Doprava a platba", href: "/shipping" },
      { name: "Obchodní podmínky", href: "/terms" },
      { name: "Ochrana osobních údajů", href: "/privacy" },
    ],
  },
  kontakt: {
    title: "Kontakt",
    links: [
      { name: "Kontaktujte nás", href: "/contact" },
      { name: "Reklamace", href: "/returns" },
      { name: "Sledování objednávky", href: "/objednavka" },
    ],
  },
};

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

export async function Footer() {
  const db = await getDb();
  const settings = await db.shopSettings.findUnique({
    where: { id: "singleton" },
    select: { instagram: true, facebook: true },
  });

  const instagram = settings?.instagram || "";
  const facebook = settings?.facebook || "";
  const hasSocial = instagram || facebook;

  return (
    <footer className="mt-auto border-t bg-muted/30" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-block">
              <Image
                src="/logo/logo-header.png"
                alt="Janička"
                width={120}
                height={48}
                className="h-8 w-auto"
              />
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Stylové oblečení pro moderní ženy. Kvalita, elegance a pohodlí v
              každém kousku.
            </p>
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-foreground">
                Novinky do e-mailu
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Buďte první, kdo uvidí nové kousky.
              </p>
              <NewsletterForm />
            </div>
            {hasSocial && (
              <div className="mt-4 flex gap-3">
                {instagram && (
                  <a
                    href={instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground transition-colors hover:text-primary"
                    aria-label="Instagram"
                  >
                    <InstagramIcon className="size-5" />
                  </a>
                )}
                {facebook && (
                  <a
                    href={facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground transition-colors hover:text-primary"
                    aria-label="Facebook"
                  >
                    <FacebookIcon className="size-5" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Link columns */}
          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-foreground">
                {section.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 border-t pt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <CookieSettingsButton />
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Řešení sporů online (ODR)
            </a>
            <span>
              Dozorový úřad: ČOI (Česká obchodní inspekce)
            </span>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Janička. Všechna práva vyhrazena.
          </p>
        </div>
      </div>
    </footer>
  );
}
