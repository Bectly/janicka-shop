/**
 * JSON-LD structured data helpers for SEO.
 *
 * Google AI Mode uses Schema.org to find/compare/purchase products.
 * Pages with complete structured data get cited 3.1x more often by AI search.
 * "Golden Record" (99.9% attribute completion) = 3-4x higher AI visibility.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://janicka-shop.vercel.app";

const CONDITION_TO_SCHEMA: Record<string, string> = {
  new_with_tags: "https://schema.org/NewCondition",
  excellent: "https://schema.org/UsedCondition",
  good: "https://schema.org/UsedCondition",
  visible_wear: "https://schema.org/UsedCondition",
};

/** Czech condition labels for structured data descriptions */
const CONDITION_DESCRIPTION: Record<string, string> = {
  new_with_tags: "Nové s visačkou — nepoužité zboží v původním stavu",
  excellent: "Výborný stav — minimální známky nošení",
  good: "Dobrý stav — lehké známky nošení",
  visible_wear: "Viditelné opotřebení — popsáno v detailu produktu",
};

const SELLER = {
  "@type": "Organization" as const,
  name: "Janička",
  url: BASE_URL,
};

const SHIPPING_DESTINATION = {
  "@type": "DefinedRegion" as const,
  addressCountry: "CZ",
};

const DELIVERY_TIME = {
  "@type": "ShippingDeliveryTime" as const,
  handlingTime: {
    "@type": "QuantitativeValue" as const,
    minValue: 1,
    maxValue: 2,
    unitCode: "DAY",
  },
  transitTime: {
    "@type": "QuantitativeValue" as const,
    minValue: 1,
    maxValue: 3,
    unitCode: "DAY",
  },
};

/** Free shipping threshold — MonetaryAmount per Schema.org spec for freeShippingThreshold */
const FREE_SHIPPING_THRESHOLD = {
  "@type": "MonetaryAmount" as const,
  value: "1500",
  currency: "CZK",
};

/** All 3 shipping methods — Google Shopping needs each listed separately */
const ALL_SHIPPING_OPTIONS = [
  {
    "@type": "OfferShippingDetails" as const,
    shippingLabel: "Zásilkovna — výdejní místo",
    shippingRate: {
      "@type": "DeliveryChargeSpecification" as const,
      price: "69",
      priceCurrency: "CZK",
    },
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    shippingDestination: SHIPPING_DESTINATION,
    deliveryTime: DELIVERY_TIME,
  },
  {
    "@type": "OfferShippingDetails" as const,
    shippingLabel: "Česká pošta",
    shippingRate: {
      "@type": "DeliveryChargeSpecification" as const,
      price: "89",
      priceCurrency: "CZK",
    },
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    shippingDestination: SHIPPING_DESTINATION,
    deliveryTime: DELIVERY_TIME,
  },
  {
    "@type": "OfferShippingDetails" as const,
    shippingLabel: "Zásilkovna — na adresu",
    shippingRate: {
      "@type": "DeliveryChargeSpecification" as const,
      price: "99",
      priceCurrency: "CZK",
    },
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    shippingDestination: SHIPPING_DESTINATION,
    deliveryTime: DELIVERY_TIME,
  },
];

const RETURN_POLICY = {
  "@type": "MerchantReturnPolicy" as const,
  applicableCountry: "CZ",
  returnPolicyCategory:
    "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 14,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
};

export interface ProductForSchema {
  slug: string;
  name: string;
  description: string;
  images: string;
  sku: string;
  brand: string | null;
  condition: string;
  price: number;
  sold: boolean;
  categoryName: string;
  colors?: string;
  sizes?: string;
  compareAt?: number | null;
}

/** Build a single Product schema object (for use standalone or inside ItemList). */
export function buildProductSchema(product: ProductForSchema) {
  let productImages: string[] = [];
  try {
    productImages = JSON.parse(product.images);
  } catch {
    /* corrupted data fallback */
  }

  // Parse colors and sizes for structured attributes
  let colors: string[] = [];
  let sizes: string[] = [];
  try { if (product.colors) colors = JSON.parse(product.colors); } catch { /* */ }
  try { if (product.sizes) sizes = JSON.parse(product.sizes); } catch { /* */ }

  // Additional properties for AI search enrichment
  const additionalProperty: Record<string, unknown>[] = [];
  if (colors.length > 0) {
    additionalProperty.push({
      "@type": "PropertyValue",
      propertyID: "color",
      name: "Barva",
      value: colors.join(", "),
    });
  }
  if (sizes.length > 0) {
    additionalProperty.push({
      "@type": "PropertyValue",
      propertyID: "size",
      name: "Velikost",
      value: sizes.join(", "),
    });
  }
  const conditionDesc = CONDITION_DESCRIPTION[product.condition];
  if (conditionDesc) {
    additionalProperty.push({
      "@type": "PropertyValue",
      propertyID: "itemConditionDescription",
      name: "Stav zboží",
      value: conditionDesc,
    });
  }

  return {
    "@type": "Product",
    name: product.name,
    description: product.description,
    url: `${BASE_URL}/products/${product.slug}`,
    image: productImages.length > 0 ? productImages : undefined,
    sku: product.sku,
    brand: product.brand
      ? { "@type": "Brand", name: product.brand }
      : undefined,
    category: product.categoryName,
    color: colors.length > 0 ? colors.join(", ") : undefined,
    size: sizes.length > 0 ? sizes.join(", ") : undefined,
    additionalProperty:
      additionalProperty.length > 0 ? additionalProperty : undefined,
    offers: {
      "@type": "Offer",
      url: `${BASE_URL}/products/${product.slug}`,
      priceCurrency: "CZK",
      itemCondition:
        CONDITION_TO_SCHEMA[product.condition] ??
        "https://schema.org/UsedCondition",
      price: product.price,
      ...(product.compareAt && product.compareAt > product.price
        ? { priceValidUntil: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0] }
        : {}),
      availability: product.sold
        ? "https://schema.org/SoldOut"
        : "https://schema.org/InStock",
      seller: SELLER,
      shippingDetails: ALL_SHIPPING_OPTIONS,
      hasMerchantReturnPolicy: RETURN_POLICY,
    },
  };
}

/** Build an ItemList JSON-LD object wrapping multiple products. */
export function buildItemListSchema(
  products: ProductForSchema[],
  listName: string,
  listUrl: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    url: `${BASE_URL}${listUrl}`,
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: buildProductSchema(product),
    })),
  };
}

/** Build a BreadcrumbList JSON-LD schema for navigation breadcrumbs. */
export function buildBreadcrumbSchema(
  items: { name: string; url: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${BASE_URL}${item.url}`,
    })),
  };
}

/** Build a WebSite schema with SearchAction for sitelinks search box. */
export function buildWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Janička",
    url: BASE_URL,
    description:
      "Second hand oblečení pro moderní ženy. Unikátní kousky za zlomek ceny.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** Build an Organization schema for Google Knowledge Panel. */
export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Janička",
    url: BASE_URL,
    description:
      "Second hand eshop s oblečením pro moderní ženy. Ověřená kvalita, rychlé doručení, 14denní vrácení.",
  };
}

/** Build a FAQPage schema from question/answer pairs. */
export function buildFaqSchema(
  items: { question: string; answer: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

/** Render a JSON-LD script tag string (safe for dangerouslySetInnerHTML). */
export function jsonLdString(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
