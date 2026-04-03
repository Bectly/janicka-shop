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
    "@type": "MonetaryAmount" as const,
    value: "69",
    currency: "CZK",
  },
  freeShippingThreshold: {
    "@type": "MonetaryAmount" as const,
    value: "1500",
    currency: "CZK",
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

/** Render a JSON-LD script tag string (safe for dangerouslySetInnerHTML). */
export function jsonLdString(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
