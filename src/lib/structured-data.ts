/**
 * JSON-LD structured data helpers for SEO.
 *
 * Google AI Mode uses Schema.org to find/compare/purchase products.
 * Pages with complete structured data get cited 3.1x more often by AI search.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://janicka-shop.vercel.app";

const CONDITION_TO_SCHEMA: Record<string, string> = {
  new_with_tags: "https://schema.org/NewCondition",
  excellent: "https://schema.org/UsedCondition",
  good: "https://schema.org/UsedCondition",
  visible_wear: "https://schema.org/UsedCondition",
};

const SELLER = {
  "@type": "Organization" as const,
  name: "Janička",
  url: BASE_URL,
};

const SHIPPING_DETAILS = {
  "@type": "OfferShippingDetails" as const,
  shippingRate: {
    "@type": "DeliveryChargeSpecification" as const,
    price: "69",
    priceCurrency: "CZK",
  },
  // freeShippingThreshold is a property of OfferShippingDetails, NOT DeliveryChargeSpecification
  freeShippingThreshold: {
    "@type": "DeliveryChargeSpecification" as const,
    price: "0",
    priceCurrency: "CZK",
    eligibleTransactionVolume: {
      "@type": "PriceSpecification" as const,
      price: "1500",
      priceCurrency: "CZK",
    },
  },
  shippingDestination: {
    "@type": "DefinedRegion" as const,
    addressCountry: "CZ",
  },
  deliveryTime: {
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
  },
};

const RETURN_POLICY = {
  "@type": "MerchantReturnPolicy" as const,
  applicableCountry: "CZ",
  returnPolicyCategory:
    "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 14,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/ReturnShippingFees",
};

interface ProductForSchema {
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
}

/** Build a single Product schema object (for use standalone or inside ItemList). */
export function buildProductSchema(product: ProductForSchema) {
  let productImages: string[] = [];
  try {
    productImages = JSON.parse(product.images);
  } catch {
    /* corrupted data fallback */
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
    itemCondition:
      CONDITION_TO_SCHEMA[product.condition] ??
      "https://schema.org/UsedCondition",
    offers: {
      "@type": "Offer",
      url: `${BASE_URL}/products/${product.slug}`,
      priceCurrency: "CZK",
      price: product.price,
      availability: product.sold
        ? "https://schema.org/SoldOut"
        : "https://schema.org/InStock",
      seller: SELLER,
      shippingDetails: SHIPPING_DETAILS,
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
