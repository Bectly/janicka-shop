/**
 * Next.js instrumentation entry — runs once per server boot.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkR2Env, checkSiteUrlEnv } = await import("./lib/env-check");
    checkR2Env();
    checkSiteUrlEnv();
  }
}
