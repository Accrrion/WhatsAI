// Central brand config. The product name is intentionally NOT hard-coded across
// the app; change it here (or drive it from the business record) to rebrand.
export const BRAND = {
  name: "WhatsAI",
  tagline: "Turn WhatsApp conversations into customers — automatically.",
  supportEmail: "hello@whatsai.app",
} as const;

export const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: "₦", USD: "$", GBP: "£", EUR: "€", GHS: "₵", KES: "KSh",
};

export function formatMoney(minor: number | null | undefined, currency = "NGN"): string {
  const symbol = CURRENCY_SYMBOLS[currency] || `${currency} `;
  const value = Number.isFinite(Number(minor)) ? Number(minor) / 100 : 0;
  return `${symbol}${value.toLocaleString("en-NG", {
    minimumFractionDigits: value % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function timeOfDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export const titleCase = (s: string) =>
  (s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const STOCK_LABELS: Record<string, string> = {
  in_stock: "In stock", low_stock: "Low stock", out_of_stock: "Out of stock", preorder: "Pre-order",
};
export const LEAD_STATUS: Record<string, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified", converted: "Converted", lost: "Lost",
};
export const ORDER_STATUS: Record<string, string> = {
  pending: "Pending", confirmed: "Confirmed", processing: "Processing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled",
};
export const CONV_STATUS: Record<string, string> = {
  open: "Open", human_handoff: "Human handoff", resolved: "Resolved",
};
