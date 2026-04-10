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

/** Inline SVG payment icons */
function VisaIcon() {
  return (
    <svg className="h-7 w-auto" viewBox="0 0 48 16" fill="none" aria-label="Visa">
      <rect width="48" height="16" rx="2.5" fill="#1A1F71" />
      <text x="24" y="11.5" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="sans-serif">VISA</text>
    </svg>
  );
}

function MastercardIcon() {
  return (
    <svg className="h-7 w-auto" viewBox="0 0 48 16" fill="none" aria-label="Mastercard">
      <rect width="48" height="16" rx="2.5" fill="#2D2D2D" />
      <circle cx="20" cy="8" r="5" fill="#EB001B" />
      <circle cx="28" cy="8" r="5" fill="#F79E1B" />
      <path d="M24 4.27a5 5 0 0 1 0 7.46 5 5 0 0 1 0-7.46z" fill="#FF5F00" />
    </svg>
  );
}

function ApplePayIcon() {
  return (
    <svg className="h-7 w-auto" viewBox="0 0 48 16" fill="none" aria-label="Apple Pay">
      <rect width="48" height="16" rx="2.5" fill="#000" />
      <text x="24" y="11" textAnchor="middle" fill="white" fontSize="7" fontWeight="600" fontFamily="sans-serif">Apple Pay</text>
    </svg>
  );
}

function GooglePayIcon() {
  return (
    <svg className="h-7 w-auto" viewBox="0 0 48 16" fill="none" aria-label="Google Pay">
      <rect width="48" height="16" rx="2.5" fill="#fff" stroke="#ddd" strokeWidth="0.5" />
      <text x="24" y="11" textAnchor="middle" fill="#5F6368" fontSize="6.5" fontWeight="500" fontFamily="sans-serif">G Pay</text>
    </svg>
  );
}

function BankTransferIcon() {
  return (
    <svg className="h-7 w-auto" viewBox="0 0 48 16" fill="none" aria-label="Bankovní převod">
      <rect width="48" height="16" rx="2.5" fill="#E8F0FE" stroke="#C4D7F2" strokeWidth="0.5" />
      <text x="24" y="11" textAnchor="middle" fill="#1A73E8" fontSize="6" fontWeight="500" fontFamily="sans-serif">QR Platba</text>
    </svg>
  );
}

/** Cherry blossom SVG pattern — subtle, decorative */
function CherryBlossomPattern() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.04]" aria-hidden="true">
      {/* Top-right large blossom */}
      <svg className="footer-blossom absolute -right-10 -top-10 size-56 text-brand" viewBox="0 0 200 200" fill="currentColor">
        <g>
          <ellipse cx="100" cy="80" rx="12" ry="24" transform="rotate(0 100 100)" />
          <ellipse cx="100" cy="80" rx="12" ry="24" transform="rotate(72 100 100)" />
          <ellipse cx="100" cy="80" rx="12" ry="24" transform="rotate(144 100 100)" />
          <ellipse cx="100" cy="80" rx="12" ry="24" transform="rotate(216 100 100)" />
          <ellipse cx="100" cy="80" rx="12" ry="24" transform="rotate(288 100 100)" />
          <circle cx="100" cy="100" r="6" />
        </g>
      </svg>
      {/* Bottom-left medium blossom */}
      <svg className="footer-blossom absolute -bottom-6 -left-6 size-44 text-brand-light" viewBox="0 0 200 200" fill="currentColor">
        <g>
          <ellipse cx="100" cy="82" rx="10" ry="20" transform="rotate(15 100 100)" />
          <ellipse cx="100" cy="82" rx="10" ry="20" transform="rotate(87 100 100)" />
          <ellipse cx="100" cy="82" rx="10" ry="20" transform="rotate(159 100 100)" />
          <ellipse cx="100" cy="82" rx="10" ry="20" transform="rotate(231 100 100)" />
          <ellipse cx="100" cy="82" rx="10" ry="20" transform="rotate(303 100 100)" />
          <circle cx="100" cy="100" r="5" />
        </g>
      </svg>
      {/* Center-right small blossom */}
      <svg className="footer-blossom absolute right-1/4 top-1/2 size-28 text-brand" viewBox="0 0 200 200" fill="currentColor">
        <g>
          <ellipse cx="100" cy="84" rx="8" ry="16" transform="rotate(30 100 100)" />
          <ellipse cx="100" cy="84" rx="8" ry="16" transform="rotate(102 100 100)" />
          <ellipse cx="100" cy="84" rx="8" ry="16" transform="rotate(174 100 100)" />
          <ellipse cx="100" cy="84" rx="8" ry="16" transform="rotate(246 100 100)" />
          <ellipse cx="100" cy="84" rx="8" ry="16" transform="rotate(318 100 100)" />
          <circle cx="100" cy="100" r="4" />
        </g>
      </svg>
      {/* Bottom-right tiny accent blossom */}
      <svg className="footer-blossom absolute bottom-1/4 right-1/6 size-20 text-brand-light" viewBox="0 0 200 200" fill="currentColor">
        <g>
          <ellipse cx="100" cy="85" rx="7" ry="14" transform="rotate(10 100 100)" />
          <ellipse cx="100" cy="85" rx="7" ry="14" transform="rotate(82 100 100)" />
          <ellipse cx="100" cy="85" rx="7" ry="14" transform="rotate(154 100 100)" />
          <ellipse cx="100" cy="85" rx="7" ry="14" transform="rotate(226 100 100)" />
          <ellipse cx="100" cy="85" rx="7" ry="14" transform="rotate(298 100 100)" />
          <circle cx="100" cy="100" r="3.5" />
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
    <footer className="relative mt-auto bg-charcoal text-white" role="contentinfo">
      {/* Decorative brand gradient accent */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-brand/40 to-transparent" aria-hidden="true" />
      <CherryBlossomPattern />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top section — centered logo + tagline */}
        <div className="flex flex-col items-center pb-10 pt-16 sm:pb-12 sm:pt-20">
          <Link href="/" className="group inline-block">
            <Image
              src="/logo/logo-header-lg.png"
              alt="Janička"
              width={160}
              height={64}
              className="h-10 w-auto brightness-0 invert transition-opacity group-hover:opacity-80 sm:h-12"
            />
          </Link>
          <p className="mt-5 max-w-xs text-center text-sm leading-relaxed text-white/40">
            Každý kousek je unikát.
            <br />
            Kvalita, elegance a&nbsp;udržitelnost.
          </p>
        </div>

        {/* Newsletter section */}
        <div className="mx-auto max-w-md pb-10">
          <div className="text-center">
            <h3 className="font-heading text-lg font-semibold tracking-tight text-white sm:text-xl">
              Novinky do e-mailu
            </h3>
            <p className="mt-1.5 text-sm text-white/40">
              Buďte první, kdo uvidí nové kousky a výhodné nabídky.
            </p>
          </div>
          <NewsletterForm variant="footer" />
        </div>

        {/* Gradient divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />

        {/* Link columns + social */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 py-10 sm:grid-cols-3 md:grid-cols-4 md:gap-x-8">
          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">
                {section.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="footer-link text-sm text-white/55 transition-colors duration-200 hover:text-white"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Social column */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">
              Sledujte nás
            </h3>
            <div className="mt-4 flex gap-2.5">
              {instagram ? (
                <a
                  href={instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-social-icon inline-flex size-10 items-center justify-center rounded-full bg-white/[0.06] text-white/50 transition-all duration-300 hover:bg-brand/20 hover:text-brand-light hover:shadow-[0_0_12px_rgba(var(--color-brand),0.15)]"
                  aria-label="Instagram"
                >
                  <InstagramIcon className="size-[18px]" />
                </a>
              ) : (
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-white/[0.04] text-white/30">
                  <InstagramIcon className="size-[18px]" />
                </span>
              )}
              {facebook ? (
                <a
                  href={facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-social-icon inline-flex size-10 items-center justify-center rounded-full bg-white/[0.06] text-white/50 transition-all duration-300 hover:bg-brand/20 hover:text-brand-light hover:shadow-[0_0_12px_rgba(var(--color-brand),0.15)]"
                  aria-label="Facebook"
                >
                  <FacebookIcon className="size-[18px]" />
                </a>
              ) : (
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-white/[0.04] text-white/30">
                  <FacebookIcon className="size-[18px]" />
                </span>
              )}
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-white/[0.04] text-white/30">
                <TikTokIcon className="size-[18px]" />
              </span>
            </div>
          </div>
        </div>

        {/* Gradient divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />

        {/* Payment badges */}
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/20">Platební metody</p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 opacity-50 grayscale transition-all duration-500 hover:opacity-75 hover:grayscale-0">
            <VisaIcon />
            <MastercardIcon />
            <ApplePayIcon />
            <GooglePayIcon />
            <BankTransferIcon />
          </div>
        </div>

        {/* Gradient divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

        {/* Bottom bar — legal */}
        <div className="space-y-2.5 py-6">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-white/25">
            <CookieSettingsButton className="transition-colors duration-200 hover:text-white/50" />
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors duration-200 hover:text-white/50"
            >
              Řešení sporů online (ODR)
            </a>
            <span>
              Dozorový úřad: ČOI
            </span>
          </div>
          <p className="text-center text-xs text-white/20">
            &copy; {new Date().getFullYear()} Janička. Všechna práva vyhrazena.
          </p>
        </div>
      </div>
    </footer>
  );
}
