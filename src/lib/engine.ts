/* ============================================================================
   NEXORA — pure game engine. Deterministic formulas shared by client
   (for instant predictions) and server (authoritative validation).
   No DB or I/O imports allowed here.
============================================================================ */

import { BigNumber, bn, clamp } from "@/lib/num";
import {
  RARITIES,
  UPGRADES,
  RESET_TIERS,
  type ResetTier,
  bulkPrice,
  upgradePrice,
  BASE_MAX_EQUIPPED,
} from "@/config/game";

/* ------------------------------ Derived stats ------------------------------ */

export interface Stats {
  clickPower: BigNumber; // per click (already includes global multiplier)
  baseClickPower: BigNumber;
  passivePerSec: BigNumber;
  critChance: number; // 0..1
  critMult: number;
  globalMult: BigNumber;
  luck: number;
  comboCap: number; // max combo count
  comboBonusPer: number; // bonus fraction per combo count
  comboMaxBonus: number; // max bonus fraction
  petPct: number; // summed pet percentage boost
}

export interface Boost {
  id: string;
  name: string;
  mult: number;
  expiresAt: number; // epoch ms
}

export interface EventParams {
  energyMult?: number;
  clickMult?: number;
  luckBonus?: number;
}

export interface StatsInput {
  levels: Record<string, number>;
  resets: Record<string, number>;
  currencies: { shards: string; cores: string; prisms: string; voids: string };
  petPct: number; // total equipped pet percentage (variant-adjusted, before amplifier)
  worldBonusPct: number;
  boosts: Boost[];
  event: EventParams | null;
  now?: number;
}

const lvl = (levels: Record<string, number>, id: string) => levels[id] ?? 0;

export function activeBoostMult(boosts: Boost[], now = Date.now()): number {
  return boosts
    .filter((b) => b.expiresAt > now)
    .reduce((acc, b) => acc * b.mult, 1);
}

export function deriveStats(input: StatsInput): Stats {
  const { levels, resets, currencies, petPct, worldBonusPct, boosts, event } = input;
  const now = input.now ?? Date.now();

  const tapCore = lvl(levels, "tap-core");
  const autoClicker = lvl(levels, "auto-clicker");
  const critChanceLvl = lvl(levels, "crit-chance");
  const critPowerLvl = lvl(levels, "crit-power");
  const passiveAmp = lvl(levels, "passive-amp");
  const energyMatrix = lvl(levels, "energy-matrix");
  const luckCore = lvl(levels, "luck-core");
  const comboDrive = lvl(levels, "combo-drive");
  const petAmp = lvl(levels, "pet-amplifier");

  // Permanent reset currencies
  let resetMult = new BigNumber(1);
  for (const tier of RESET_TIERS) {
    const units = bn(currencies[tier.currencyField]);
    resetMult = resetMult.times(units.times(tier.multPerUnit / 100).plus(1));
  }

  const worldMult = new BigNumber(1 + worldBonusPct / 100);
  const matrixMult = new BigNumber(1 + energyMatrix * 0.1);
  const boostMult = new BigNumber(activeBoostMult(boosts, now));
  const eventEnergyMult = new BigNumber(event?.energyMult ?? 1);
  const eventClickMult = new BigNumber(event?.clickMult ?? 1);
  const petMult = new BigNumber(1 + (petPct * (1 + petAmp * 0.1)) / 100);

  const globalMult = resetMult
    .times(worldMult)
    .times(matrixMult)
    .times(boostMult)
    .times(eventEnergyMult)
    .times(petMult);

  const baseClickPower = new BigNumber(1 + tapCore);
  const clickPower = baseClickPower.times(globalMult).times(eventClickMult);

  const critChance = clamp(0.05 + critChanceLvl * 0.01, 0, 0.85);
  const critMult = 5 + critPowerLvl * 0.5;

  const autoClicks = autoClicker;
  const passiveBase = new BigNumber(5 * passiveAmp);
  const passivePerSec = passiveBase.plus(baseClickPower.times(autoClicks)).times(globalMult);

  const luck = luckCore * 2 + (event?.luckBonus ?? 0);

  const comboCap = 100 + comboDrive * 10;
  const comboBonusPer = 0.005 + comboDrive * 0.0005;
  const comboMaxBonus = 0.5 + comboDrive * 0.05;

  return {
    clickPower,
    baseClickPower,
    passivePerSec,
    critChance,
    critMult,
    globalMult,
    luck,
    comboCap,
    comboBonusPer,
    comboMaxBonus,
    petPct,
  };
}

/* ------------------------------ Click simulation --------------------------- */

export interface ClickSimResult {
  total: BigNumber;
  crits: number;
  finalCombo: number;
  bestCombo: number;
  perClickAvg: BigNumber;
}

export function simulateClicks(
  count: number,
  stats: Stats,
  startCombo: number,
  startBestCombo: number,
  rng: () => number,
): ClickSimResult {
  let combo = startCombo;
  let best = Math.max(startBestCombo, startCombo);
  let total = new BigNumber(0);
  let crits = 0;
  for (let i = 0; i < count; i++) {
    combo = Math.min(combo + 1, Math.floor(stats.comboCap));
    if (combo > best) best = combo;
    const comboBonus = Math.min(combo * stats.comboBonusPer, stats.comboMaxBonus);
    let gain = stats.clickPower.times(1 + comboBonus);
    if (rng() < stats.critChance) {
      gain = gain.times(stats.critMult);
      crits++;
    }
    total = total.plus(gain);
  }
  return {
    total,
    crits,
    finalCombo: combo,
    bestCombo: best,
    perClickAvg: count > 0 ? total.div(count) : new BigNumber(0),
  };
}

/* ------------------------------ Reset formulas ----------------------------- */

export function resetThreshold(tier: ResetTier, owned: number): BigNumber {
  return bn(tier.threshold).times(new BigNumber(tier.scaleBase).pow(owned));
}

/** log10 of an arbitrarily large BigNumber, via exponential decomposition. */
export function log10Big(x: BigNumber): number {
  if (x.lte(0)) return 0;
  const [m, e] = x.toExponential(8).split("e");
  return Math.log10(Number(m)) + Number(e);
}

export function resetGain(tier: ResetTier, lifetimeEarned: BigNumber.Value, resonanceLevel: number): BigNumber {
  const life = bn(lifetimeEarned);
  const threshold = bn(tier.threshold);
  if (life.lt(threshold)) return new BigNumber(0);
  const ratio = life.div(threshold);
  let gain: BigNumber;
  switch (tier.id) {
    case "rebirth":
      gain = ratio.sqrt();
      break;
    case "prestige":
      gain = ratio.pow(new BigNumber(1).div(3));
      break;
    case "ascension":
      gain = ratio.sqrt();
      break;
    default:
      gain = new BigNumber(Math.max(1, Math.floor(log10Big(ratio)) + 1));
  }
  const floor1 = BigNumber.maximum(gain.integerValue(BigNumber.ROUND_FLOOR), 1);
  const resonanceMult = tier.id === "rebirth" ? 1 + resonanceLevel * 0.05 : 1;
  return BigNumber.maximum(floor1.times(resonanceMult).integerValue(BigNumber.ROUND_FLOOR), 1);
}

/* ------------------------------- Economy checks ---------------------------- */

export interface BuyPlan {
  levels: number;
  cost: BigNumber;
}

export function planPurchase(
  defId: string,
  currentLevel: number,
  balance: BigNumber.Value,
  mode: "1" | "10" | "max",
): BuyPlan {
  const def = UPGRADES.find((u) => u.id === defId);
  if (!def) return { levels: 0, cost: new BigNumber(0) };
  const remaining = Math.max(0, def.maxLevel - currentLevel);
  if (remaining === 0) return { levels: 0, cost: new BigNumber(0) };
  let count = mode === "1" ? 1 : mode === "10" ? 10 : 0;
  if (mode === "max") {
    count = maxLevelsAffordable(defId, currentLevel, balance);
  }
  count = Math.min(count, remaining);
  if (count <= 0) return { levels: 0, cost: new BigNumber(0) };
  const cost = bulkPrice(def.baseCost, def.growth, currentLevel, count);
  if (cost.gt(bn(balance))) return { levels: 0, cost: new BigNumber(0) };
  return { levels: count, cost };
}

export function maxLevelsAffordable(defId: string, currentLevel: number, balance: BigNumber.Value): number {
  const def = UPGRADES.find((u) => u.id === defId);
  if (!def) return 0;
  const remaining = def.maxLevel - currentLevel;
  if (remaining <= 0) return 0;
  // Exponential upper bound then refine (duplicated here to avoid circular import cost)
  const bal = bn(balance);
  if (bal.lt(upgradePrice(def.baseCost, def.growth, currentLevel))) return 0;
  const first = bn(def.baseCost).times(new BigNumber(def.growth).pow(currentLevel));
  const ratio = bal.times(def.growth - 1).div(first).plus(1).toNumber();
  let n = Math.min(Math.floor(Math.log(ratio) / Math.log(def.growth)), remaining);
  while (n > 0 && bulkPrice(def.baseCost, def.growth, currentLevel, n).gt(bal)) n--;
  while (n < remaining && bulkPrice(def.baseCost, def.growth, currentLevel, n + 1).lte(bal)) n++;
  return n;
}

/* -------------------------------- Hatch rolls ------------------------------- */

/** Adjusted rarity weights after luck, normalized to 100. Luck shifts mass from Common upward. */
export function adjustedWeights(luck: number): number[] {
  const w = RARITIES.map((r) => r.weight);
  const shift = Math.min(luck * 0.5, w[0] - 5); // never drop common below 5%
  if (shift > 0) {
    w[0] -= shift;
    w[4] += shift * 0.45; // legendary
    w[5] += shift * 0.28; // mythic
    w[6] += shift * 0.19; // celestial
    w[7] += shift * 0.08; // secret
  }
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => (x / sum) * 100);
}

/** Roll a rarity index. If pityCounter >= threshold, force Legendary or better. */
export function rollRarity(luck: number, pityCounter: number, pityThreshold: number, rng: () => number): number {
  const weights = adjustedWeights(luck);
  const forced = pityCounter >= pityThreshold;
  let roll = rng() * 100;
  let start = forced ? 4 : 0; // force legendary+ when pity triggers
  if (forced) {
    const top = weights.slice(4);
    const topSum = top.reduce((a, b) => a + b, 0);
    roll = rng() * topSum;
    let acc = 0;
    for (let i = 0; i < top.length; i++) {
      acc += top[i];
      if (roll < acc) return 4 + i;
    }
    return 4;
  }
  let acc = 0;
  for (let i = start; i < weights.length; i++) {
    acc += weights[i];
    if (roll < acc) return i;
  }
  return 0;
}

/* ------------------------------ Offline earnings ---------------------------- */

export function offlineGain(passivePerSec: BigNumber, elapsedSec: number, capacitorLevel: number): BigNumber {
  if (passivePerSec.lte(0) || elapsedSec <= 0) return new BigNumber(0);
  const capSec = (1 + capacitorLevel) * 3600;
  const effective = Math.min(elapsedSec, capSec);
  // Offline efficiency: 50%
  return passivePerSec.times(effective * 0.5).integerValue(BigNumber.ROUND_FLOOR);
}

/* ------------------------------- Misc format -------------------------------- */

export function maxEquipped(slotItemsOwned: number): number {
  return BASE_MAX_EQUIPPED + Math.min(slotItemsOwned, 3);
}
