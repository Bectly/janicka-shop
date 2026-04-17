const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Čeká na platbu",
    className: "border-champagne-dark/30 bg-champagne-light/50 text-charcoal",
  },
  paid: {
    label: "Zaplaceno",
    className: "border-sage/30 bg-sage-light/50 text-sage-dark",
  },
  processing: {
    label: "Připravuje se",
    className: "border-blue-300 bg-blue-50 text-blue-800",
  },
  shipped: {
    label: "Odesláno",
    className: "border-blue-300 bg-blue-50 text-blue-800",
  },
  delivered: {
    label: "Doručeno",
    className: "border-sage/30 bg-sage-light/50 text-sage-dark",
  },
  cancelled: {
    label: "Zrušeno",
    className: "border-muted-foreground/30 bg-muted text-muted-foreground",
  },
  refunded: {
    label: "Vráceno",
    className: "border-muted-foreground/30 bg-muted text-muted-foreground",
  },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "border-muted-foreground/30 bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
