/**
 * Minimal logger. error/warn always emit. info/debug emit only in dev or when DEBUG_LOG=1.
 * Single chokepoint so we can add redaction/timestamps/aggregation later without touching call sites.
 */

const verbose =
  process.env.NODE_ENV !== "production" || process.env.DEBUG_LOG === "1";

type LogArgs = unknown[];

export const logger = {
  error: (...args: LogArgs) => {
    console.error(...args);
  },
  warn: (...args: LogArgs) => {
    console.warn(...args);
  },
  info: (...args: LogArgs) => {
    if (verbose) console.info(...args);
  },
  debug: (...args: LogArgs) => {
    if (verbose) console.debug(...args);
  },
};
