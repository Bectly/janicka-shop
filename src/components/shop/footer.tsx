import Link from "next/link";
import { CookieSettingsButton } from "@/components/shop/cookie-settings-button";
import { NewsletterForm } from "@/components/shop/newsletter-form";

const footerLinks = {
  nakupovani: {
    title: "Nakupování",
    links: [
      { name: "Všechny produkty", href: "/products" },
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
      { name: "Sledování objednávky", href: "/order/lookup" },
    ],
  },
};

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-muted/30" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="font-heading text-xl font-bold text-primary"
            >
              Janička
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
