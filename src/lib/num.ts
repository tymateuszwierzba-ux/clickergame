import BigNumber from "bignumber.js";

BigNumber.config({ DECIMAL_PLACES: 40, EXPONENTIAL_AT: 1e9, RANGE: 1e9 });

export { BigNumber };
export type BN = BigNumber;

export const bn = (v: BigNumber.Value | null | undefined): BigNumber =>
  new BigNumber(v == null || v === "" ? 0 : v);

export const SUFFIXES = [
  "",
  "K",
  "M",
  "B",
  "T",
  "Qa",
  "Qi",
  "Sx",
  "Sp",
  "Oc",
  "No",
  "Dc",
  "UDc",
  "DDc",
  "TDc",
  "QaDc",
  "QiDc",
];

/** Format an arbitrarily large number with K/M/B/T/Qa... suffixes, then scientific notation. */
export function fmt(v: BigNumber.Value | null | undefined): string {
  const n = bn(v);
  if (!n.isFinite()) return "∞";
  if (n.isNegative()) return "-" + fmt(n.abs());
  if (n.lt(1000)) {
    if (n.decimalPlaces() && n.decimalPlaces()! > 0 && n.lt(100)) return n.toFixed(1);
    return n.integerValue(BigNumber.ROUND_FLOOR).toFixed(0);
  }
  let tier = Math.floor((n.e ?? 0) / 3);
  if (tier >= SUFFIXES.length) {
    return n.toExponential(2).replace("e+", "e");
  }
  if (tier < 1) tier = 1;
  const scaled = n.shiftedBy(-3 * tier);
  const digits = scaled.gte(100) ? 0 : scaled.gte(10) ? 1 : 2;
  return `${scaled.toFixed(digits)}${SUFFIXES[tier]}`;
}

/** Format with thousands separators for smaller precise numbers. */
export function fmtInt(v: BigNumber.Value | null | undefined): string {
  const n = bn(v).integerValue(BigNumber.ROUND_FLOOR);
  if (n.abs().gte(1e15)) return fmt(n);
  return n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function fmtPct(v: number, digits = 1): string {
  return `${v.toFixed(digits)}%`;
}

export function fmtDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** Clamp helper */
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Deterministic 32-bit hash for strings (used for seeded daily quest picks). */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 seeded PRNG for deterministic client previews. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
