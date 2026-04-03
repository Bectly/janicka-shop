/** Condition values and their Czech labels */
export const CONDITION_LABELS: Record<string, string> = {
  new_with_tags: "Nové s visačkou",
  excellent: "Výborný stav",
  good: "Dobrý stav",
  visible_wear: "Viditelné opotřebení",
};

/** Condition → badge color class */
export const CONDITION_COLORS: Record<string, string> = {
  new_with_tags: "bg-emerald-100 text-emerald-800",
  excellent: "bg-sky-100 text-sky-800",
  good: "bg-amber-100 text-amber-800",
  visible_wear: "bg-orange-100 text-orange-800",
};

/** Order status labels */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Čeká na zpracování",
  confirmed: "Potvrzeno",
  paid: "Zaplaceno",
  shipped: "Odesláno",
  delivered: "Doručeno",
  cancelled: "Zrušeno",
};

/** Payment method labels */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  comgate: "Online platba",
  cod: "Dobírka",
  card: "Kartou",
  bank_transfer: "Bankovní převod",
};

/** Shipping method labels */
export const SHIPPING_METHOD_LABELS: Record<string, string> = {
  packeta_pickup: "Zásilkovna — výdejní místo",
  packeta_home: "Zásilkovna — na adresu",
  czech_post: "Česká pošta",
};

/** Order status → badge color class */
export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-sky-100 text-sky-800",
  paid: "bg-emerald-100 text-emerald-800",
  shipped: "bg-violet-100 text-violet-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
};

// ---------------------------------------------------------------------------
// Checkout / shipping / payment constants (shared between client + server)
// ---------------------------------------------------------------------------

export const PAYMENT_METHODS = ["card", "bank_transfer", "cod"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SHIPPING_METHODS = ["packeta_pickup", "packeta_home", "czech_post"] as const;
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

/** Shipping costs in CZK by method */
export const SHIPPING_PRICES: Record<ShippingMethod, number> = {
  packeta_pickup: 69,
  packeta_home: 99,
  czech_post: 89,
};

/** Free shipping threshold in CZK */
export const FREE_SHIPPING_THRESHOLD = 1500;

/** Cash on delivery surcharge in CZK */
export const COD_SURCHARGE = 39;
