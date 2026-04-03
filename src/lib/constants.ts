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
