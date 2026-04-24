import { revalidateTag } from "next/cache";

export const CUSTOMER_CACHE_SCOPES = [
  "dashboard",
  "orders",
  "wishlist",
  "profile",
  "addresses",
  "settings",
] as const;

export type CustomerCacheScope = (typeof CUSTOMER_CACHE_SCOPES)[number];

export function customerTag(customerId: string, scope: CustomerCacheScope): string {
  return `customer:${customerId}:${scope}`;
}

export function invalidateCustomerScope(customerId: string, scope: CustomerCacheScope) {
  revalidateTag(customerTag(customerId, scope), "max");
}

export function invalidateCustomerAll(customerId: string) {
  for (const scope of CUSTOMER_CACHE_SCOPES) {
    revalidateTag(customerTag(customerId, scope), "max");
  }
}
