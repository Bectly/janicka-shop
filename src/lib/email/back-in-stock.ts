import { signUnsubscribeToken } from "@/lib/unsubscribe-token";
import { CONDITION_LABELS } from "@/lib/constants";
import {
  escapeHtml,
  getBaseUrl,
  renderButton,
  renderDisplayHeading,
  renderEyebrow,
  renderLayout,
  renderProductGrid,
  BRAND,
  FONTS,
} from "@/lib/email/layout";

interface MatchedProduct {
  name: string;
  slug: string;
  price: number;
  compareAt: number | null;
  brand: string | null;
  condition: string;
  images: string;
  sizes: string;
}

interface SubscriptionCriteria {
  brand: string | null;
  size: string | null;
  condition: string | null;
}

function firstImage(images: string): string | null {
  try {
    const imgs: string[] = JSON.parse(images);
    return imgs[0] ?? null;
  } catch {
    return null;
  }
}

function parseSizes(sizes: string): string[] {
  try {
    const arr: string[] = JSON.parse(sizes);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function productMeta(p: MatchedProduct): string {
  const conditionLabel = CONDITION_LABELS[p.condition] ?? p.condition;
  const sizes = parseSizes(p.sizes);
  return sizes.length > 0
    ? `${conditionLabel} · vel. ${sizes.join(", ")}`
    : conditionLabel;
}

export function buildBackInStockHtml(
  product: MatchedProduct,
  criteria: SubscriptionCriteria,
  recipientEmail: string,
): string {
  const baseUrl = getBaseUrl();
  const unsubscribeUrl = `${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(recipientEmail))}`;

  const conditionLabel = criteria.condition
    ? CONDITION_LABELS[criteria.condition] ?? criteria.condition
    : null;
  const criteriaParts = [criteria.brand, criteria.size, conditionLabel].filter(
    Boolean,
  ) as string[];
  const criteriaLine =
    criteriaParts.length > 0 ? criteriaParts.join(" · ") : "podle tvého filtru";

  const productTitle = `${product.brand ? `${product.brand} ` : ""}${product.name}`;

  const contentHtml = `
    ${renderEyebrow("Právě přidáno")}
    ${renderDisplayHeading("Tvůj kousek je zpátky")}
    <p style="margin: 0 0 20px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Přidala jsem kousek, který odpovídá tomu, na co jsi čekala (${escapeHtml(criteriaLine)}).
      Každý kus je unikát &mdash; jakmile bude pryč, nevrátí se.
    </p>

    ${renderProductGrid(
      [
        {
          name: product.name,
          brand: product.brand,
          meta: productMeta(product),
          url: `${baseUrl}/products/${product.slug}`,
          image: firstImage(product.images),
          price: product.price,
          compareAt: product.compareAt,
        },
      ],
      2,
    )}

    <div style="margin: 28px 0 4px;">
      ${renderButton({ href: `${baseUrl}/products/${product.slug}`, label: "Prohlédnout kousek", variant: "primary" })}
    </div>
  `;

  return renderLayout({
    preheader: `${escapeHtml(productTitle)} — přesně podle tvého filtru.`,
    contentHtml,
    unsubscribeUrl,
    unsubscribeText:
      "Tenhle email ti chodí, protože sis nechala hlídat podobný kousek.",
  });
}
