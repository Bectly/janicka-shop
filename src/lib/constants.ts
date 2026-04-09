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

/** Return status labels */
export const RETURN_STATUS_LABELS: Record<string, string> = {
  pending: "Čeká na posouzení",
  approved: "Schváleno",
  rejected: "Zamítnuto",
  completed: "Dokončeno",
};

/** Return status → badge color class */
export const RETURN_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-sky-100 text-sky-800",
  rejected: "bg-red-100 text-red-800",
  completed: "bg-emerald-100 text-emerald-800",
};

/** Return reason labels */
export const RETURN_REASON_LABELS: Record<string, string> = {
  withdrawal_14d: "Odstoupení do 14 dnů",
  defect: "Vada zboží",
  wrong_item: "Špatné zboží",
  other: "Jiný důvod",
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

// ---------------------------------------------------------------------------
// Referral & store credit constants
// ---------------------------------------------------------------------------

/** Referral credit for the referrer in CZK */
export const REFERRAL_CREDIT_CZK = 150;

/** Referral discount for the friend (new customer) in CZK */
export const REFERRAL_DISCOUNT_CZK = 100;

/** Minimum order subtotal (CZK) to use a referral code */
export const REFERRAL_MIN_ORDER_CZK = 400;

/** Referral code validity in days */
export const REFERRAL_CODE_EXPIRY_DAYS = 90;

/** Store credit validity in days */
export const STORE_CREDIT_EXPIRY_DAYS = 180;

/** Czech color names → hex values for visual swatches */
export const COLOR_MAP: Record<string, string> = {
  "Černá": "#000000",
  "Bílá": "#FFFFFF",
  "Červená": "#DC2626",
  "Modrá": "#2563EB",
  "Zelená": "#16A34A",
  "Žlutá": "#EAB308",
  "Růžová": "#EC4899",
  "Fialová": "#8B5CF6",
  "Oranžová": "#EA580C",
  "Šedá": "#6B7280",
  "Hnědá": "#92400E",
  "Béžová": "#D2B48C",
  "Krémová": "#FFFDD0",
  "Zlatá": "#D4A017",
  "Stříbrná": "#C0C0C0",
  "Tyrkysová": "#06B6D4",
  "Bordó": "#800020",
  "Korálová": "#FF7F50",
  "Khaki": "#BDB76B",
  "Námořnická": "#000080",
};
