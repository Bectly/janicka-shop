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
      { name: "Tvoje soukromí", href: "/soukromi" },
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
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

/** Inline SVG payment icons — small, crisp, no external deps */
function VisaIcon() {
  return (
    <svg className="h-6 w-auto" viewBox="0 0 48 16" fill="none" aria-label="Visa">
      <rect width="48" height="16" rx="2" fill="#1A1F71" />
      <text x="24" y="11.5" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="sans-serif">VISA</text>
    </svg>
  );
}

function MastercardIcon() {
  return (
    <svg className="h-6 w-auto" viewBox="0 0 48 16" fill="none" aria-label="Mastercard">
      <rect width="48" height="16" rx="2" fill="#2D2D2D" />
      <circle cx="20" cy="8" r="5" fill="#EB001B" />
      <circle cx="28" cy="8" r="5" fill="#F79E1B" />
      <path d="M24 4.27a5 5 0 0 1 0 7.46 5 5 0 0 1 0-7.46z" fill="#FF5F00" />
    </svg>
  );
}

function ApplePayIcon() {
  return (
    <svg className="h-6 w-auto" viewBox="0 0 48 16" fill="none" aria-label="Apple Pay">
      <rect width="48" height="16" rx="2" fill="#000" />
      <text x="24" y="11" textAnchor="middle" fill="white" fontSize="7" fontWeight="600" fontFamily="sans-serif">Apple Pay</text>
    </svg>
  );
}

function GooglePayIcon() {
  return (
    <svg className="h-6 w-auto" viewBox="0 0 48 16" fill="none" aria-label="Google Pay">
      <rect width="48" height="16" rx="2" fill="#fff" stroke="#ddd" strokeWidth="0.5" />
      <text x="24" y="11" textAnchor="middle" fill="#5F6368" fontSize="6.5" fontWeight="500" fontFamily="sans-serif">G Pay</text>
    </svg>
  );
}

function BankTransferIcon() {
  return (
    <svg className="h-6 w-auto" viewBox="0 0 48 16" fill="none" aria-label="Bankovní převod">
      <rect width="48" height="16" rx="2" fill="#E8F0FE" stroke="#C4D7F2" strokeWidth="0.5" />
      <text x="24" y="11" textAnchor="middle" fill="#1A73E8" fontSize="6" fontWeight="500" fontFamily="sans-serif">QR Platba</text>
    </svg>
  );
}

/** Cherry blossom SVG pattern — subtle, decorative */
function CherryBlossomPattern() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.04]" aria-hidden="true">
      <svg className="absolute -right-12 -top-12 size-64 text-brand" viewBox="0 0 200 200" fill="currentColor">
        <g>
          {/* Petal cluster 1 */}
          <ellipse cx="100" cy="80" rx="12" ry="24" transform="rotate(0 100 100)" />
          <ellipse cx="100" cy="80" rx="12" ry="24" transform="rotate(72 100 100)" />
          <ellipse cx="100" cy="80" rx="12" ry="24" transform="rotate(144 100 100)" />
          <ellipse cx="100" cy="80" rx="12" ry="24" transform="rotate(216 100 100)" />
          <ellipse cx="100" cy="80" rx="12" ry="24" transform="rotate(288 100 100)" />
          <circle cx="100" cy="100" r="6" />
        </g>
      </svg>
      <svg className="absolute -bottom-8 -left-8 size-48 text-brand-light" viewBox="0 0 200 200" fill="currentColor">
        <g>
          <ellipse cx="100" cy="82" rx="10" ry="20" transform="rotate(15 100 100)" />
          <ellipse cx="100" cy="82" rx="10" ry="20" transform="rotate(87 100 100)" />
          <ellipse cx="100" cy="82" rx="10" ry="20" transform="rotate(159 100 100)" />
          <ellipse cx="100" cy="82" rx="10" ry="20" transform="rotate(231 100 100)" />
          <ellipse cx="100" cy="82" rx="10" ry="20" transform="rotate(303 100 100)" />
          <circle cx="100" cy="100" r="5" />
        </g>
      </svg>
      <svg className="absolute right-1/3 top-1/2 size-32 text-brand" viewBox="0 0 200 200" fill="currentColor">
        <g>
          <ellipse cx="100" cy="84" rx="8" ry="16" transform="rotate(30 100 100)" />
          <ellipse cx="100" cy="84" rx="8" ry="16" transform="rotate(102 100 100)" />
          <ellipse cx="100" cy="84" rx="8" ry="16" transform="rotate(174 100 100)" />
          <ellipse cx="100" cy="84" rx="8" ry="16" transform="rotate(246 100 100)" />
          <ellipse cx="100" cy="84" rx="8" ry="16" transform="rotate(318 100 100)" />
          <circle cx="100" cy="100" r="4" />
        </g>
      </svg>
    </div>
  );
}

export async function Footer() {
  let instagram = "";
  let facebook = "";

  try {
    const db = await getDb();
    const settings = await db.shopSettings.findUnique({
      where: { id: "singleton" },
      select: { instagram: true, facebook: true },
    });
    instagram = settings?.instagram || "";
    facebook = settings?.facebook || "";
  } catch {
    // DB unavailable during build — render with defaults
  }

  return (
    <footer className="relative mt-auto border-t border-border/50 bg-charcoal text-white" role="contentinfo">
      <CherryBlossomPattern />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top section — centered logo + tagline */}
        <div className="flex flex-col items-center pb-10 pt-14">
          <Link href="/" className="inline-block transition-opacity hover:opacity-80">
            <Image
              src="/logo/logo-header-lg.png"
              alt="Janička"
              width={160}
              height={64}
              className="h-10 w-auto brightness-0 invert sm:h-12"
            />
          </Link>
          <p className="mt-3 max-w-md text-center text-sm leading-relaxed text-white/60">
            Stylové oblečení pro moderní ženy. Kvalita, elegance a udržitelnost
            v&nbsp;každém kousku.
          </p>
        </div>

        {/* Newsletter section */}
        <div className="mx-auto max-w-lg pb-10">
          <div className="text-center">
            <h3 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
              Novinky do e-mailu
            </h3>
            <p className="mt-1 text-sm text-white/50">
              Buďte první, kdo uvidí nové kousky a výhodné nabídky.
            </p>
          </div>
          <NewsletterForm variant="footer" />
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        {/* Link columns + social */}
        <div className="grid grid-cols-2 gap-8 py-10 sm:grid-cols-3 md:grid-cols-4">
          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-white/60">
                {section.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/60 transition-colors hover:text-white"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Social + contact column */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">
              Sledujte nás
            </h3>
            <div className="mt-4 flex gap-3">
              {instagram ? (
                <a
                  href={instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex size-10 items-center justify-center rounded-full bg-white/5 text-white/60 transition-all hover:bg-white/10 hover:text-white"
                  aria-label="Instagram"
                >
                  <InstagramIcon className="size-4.5" />
                </a>
              ) : (
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-white/5 text-white/40">
                  <InstagramIcon className="size-4.5" />
                </span>
              )}
              {facebook ? (
                <a
                  href={facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex size-10 items-center justify-center rounded-full bg-white/5 text-white/60 transition-all hover:bg-white/10 hover:text-white"
                  aria-label="Facebook"
                >
                  <FacebookIcon className="size-4.5" />
                </a>
              ) : (
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-white/5 text-white/40">
                  <FacebookIcon className="size-4.5" />
                </span>
              )}
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-white/5 text-white/40">
                <TikTokIcon className="size-4.5" />
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        {/* Payment badges */}
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-xs text-white/30">Bezpečné platební metody</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <VisaIcon />
            <MastercardIcon />
            <ApplePayIcon />
            <GooglePayIcon />
            <BankTransferIcon />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Bottom bar — legal */}
        <div className="space-y-3 py-6">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-white/30">
            <CookieSettingsButton className="transition-colors hover:text-white/60" />
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white/60"
            >
              Řešení sporů online (ODR)
            </a>
            <span>
              Dozorový úřad: ČOI (Česká obchodní inspekce)
            </span>
          </div>
          <p className="text-center text-xs text-white/25">
            &copy; {new Date().getFullYear()} Janička. Všechna práva vyhrazena.
          </p>
        </div>
      </div>
    </footer>
  );
}
