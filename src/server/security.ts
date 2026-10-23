import { createHash, randomBytes } from "crypto";

/* ------------------------------ Token helpers ------------------------------ */

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const requestId = () => randomBytes(8).toString("hex");

/* --------------------------- In-memory rate limit -------------------------- */
/* Suitable for a single-instance deployment. For multi-instance deployments,
   back this with Redis or a Postgres advisory bucket. */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

/** Token-bucket rate limiter. Returns true when allowed. */
export function rateLimit(key: string, maxTokens: number, refillPerSec: number): boolean {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: maxTokens, updatedAt: now };
    buckets.set(key, b);
  }
  const elapsed = (now - b.updatedAt) / 1000;
  b.tokens = Math.min(maxTokens, b.tokens + elapsed * refillPerSec);
  b.updatedAt = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

// Periodic cleanup to avoid unbounded growth
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = 0;
export function cleanupBuckets() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [k, v] of buckets) {
    if (now - v.updatedAt > 10 * 60_000) buckets.delete(k);
  }
}
