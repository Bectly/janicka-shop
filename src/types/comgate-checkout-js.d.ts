/**
 * Minimal type declaration for @comgate/checkout-js v2.0.15
 * The package's exports field is missing a "types" condition, so TypeScript
 * can't resolve types automatically despite types existing at dist/src/types.d.ts.
 * This shim exposes only what comgate-sdk.ts actually uses.
 */
declare module "@comgate/checkout-js" {
  export const VERSION_2: "2";

  export interface TLoadComgateCheckoutConfig {
    checkoutId: string;
    version?: string;
    modules?: string[];
    timeout?: number;
    defer?: boolean;
    async?: boolean;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function loadComgateCheckout(config: TLoadComgateCheckoutConfig): Promise<any>;
}
