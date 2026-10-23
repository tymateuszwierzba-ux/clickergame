import { describe, it, expect } from "vitest";
import { fmt, bn, BigNumber, seededRng } from "@/lib/num";
import {
  upgradePrice, bulkPrice, maxAffordable, questTarget, levelFromClicks,
  totalWeight, RARITIES, UPGRADES, RESET_TIERS, WORLDS, PETS,
} from "@/config/game";
import {
  deriveStats, simulateClicks, planPurchase, resetGain, resetThreshold,
  rollRarity, adjustedWeights, offlineGain, activeBoostMult,
} from "@/lib/engine";
import { hasPerm, canAffectRole } from "@/server/permissions";

describe("number formatting", () => {
  it("formats small numbers plainly", () => {
    expect(fmt(0)).toBe("0");
    expect(fmt(999)).toBe("999");
  });
  it("formats magnitude suffixes", () => {
    expect(fmt(1500)).toBe("1.50K");
    expect(fmt(2_500_000)).toBe("2.50M");
    expect(fmt(3.2e9)).toBe("3.20B");
    expect(fmt(1e12)).toBe("1.00T");
    expect(fmt(1e15)).toBe("1.00Qa");
    expect(fmt(1e18)).toBe("1.00Qi");
  });
  it("uses the deepest suffix, then scientific notation", () => {
    expect(fmt("1e50")).toBe("100QiDc");
    expect(fmt("1e51")).toContain("e");
  });
  it("handles huge values without Infinity", () => {
    expect(fmt("5e300")).toContain("e");
    expect(bn("1e308").isFinite()).toBe(true);
  });
});

describe("upgrade pricing", () => {
  it("grows exponentially", () => {
    expect(upgradePrice("100", 2, 0).toFixed(0)).toBe("100");
    expect(upgradePrice("100", 2, 3).toFixed(0)).toBe("800");
  });
  it("bulk price equals sum of individual prices", () => {
    let total = bn(0);
    for (let i = 0; i < 7; i++) total = total.plus(upgradePrice("1000", 1.5, i));
    expect(bulkPrice("1000", 1.5, 0, 7).toFixed(0)).toBe(total.toFixed(0));
  });
  it("maxAffordable never overbuys", () => {
    const n = maxAffordable("15", 1.15, 0, 100000, 10000);
    expect(bulkPrice("15", 1.15, 0, n).lte(100000)).toBe(true);
    expect(bulkPrice("15", 1.15, 0, n + 1).gt(100000)).toBe(true);
  });
  it("planPurchase respects balance and max level", () => {
    const def = UPGRADES[0];
    const poor = planPurchase(def.id, 0, 1, "1");
    expect(poor.levels).toBe(0);
    const maxed = planPurchase(def.id, def.maxLevel, "1e30", "1");
    expect(maxed.levels).toBe(0);
    const rich = planPurchase(def.id, 0, "1e30", "max");
    expect(rich.levels).toBeGreaterThan(10);
    expect(rich.cost.lte("1e30")).toBe(true);
  });
});

describe("derived stats", () => {
  const base = {
    levels: {} as Record<string, number>,
    resets: {},
    currencies: { shards: "0", cores: "0", prisms: "0", voids: "0" },
    petPct: 0,
    worldBonusPct: 0,
    boosts: [],
    event: null,
  };
  it("base click power is 1", () => {
    const s = deriveStats(base);
    expect(s.clickPower.toFixed(0)).toBe("1");
    expect(s.critChance).toBeCloseTo(0.05);
  });
  it("upgrades stack multiplicatively and additively", () => {
    const s = deriveStats({ ...base, levels: { "tap-core": 10, "energy-matrix": 2 }, currencies: { shards: "10", cores: "0", prisms: "0", voids: "0" } });
    // (1+10) base × 1.2 matrix × 1.5 shards = 19.8
    expect(s.clickPower.toNumber()).toBeCloseTo(19.8);
  });
  it("events and boosts multiply", () => {
    const now = Date.now();
    const s = deriveStats({ ...base, boosts: [{ id: "x", name: "x", mult: 5, expiresAt: now + 60000 }], event: { energyMult: 2 }, now });
    expect(s.clickPower.toNumber()).toBeCloseTo(10);
  });
  it("expired boosts do not apply", () => {
    expect(activeBoostMult([{ id: "x", name: "x", mult: 5, expiresAt: Date.now() - 1000 }])).toBe(1);
  });
});

describe("click simulation", () => {
  it("simulates deterministically with seeded rng", () => {
    const stats = deriveStats({
      levels: { "tap-core": 5 }, resets: {}, currencies: { shards: "0", cores: "0", prisms: "0", voids: "0" },
      petPct: 0, worldBonusPct: 0, boosts: [], event: null,
    });
    const a = simulateClicks(25, stats, 0, 0, seededRng(123));
    const b = simulateClicks(25, stats, 0, 0, seededRng(123));
    expect(a.total.toFixed(0)).toBe(b.total.toFixed(0));
    expect(a.finalCombo).toBe(25);
  });
});

describe("reset math", () => {
  const rebirth = RESET_TIERS[0];
  it("requires the threshold", () => {
    expect(resetGain(rebirth, "999999", 0).toFixed(0)).toBe("0");
  });
  it("grants sqrt-based shards", () => {
    // 1e12 lifetime / 1e6 → ratio 1e6 → sqrt = 1000
    expect(resetGain(rebirth, "1e12", 0).toFixed(0)).toBe("1000");
  });
  it("scales threshold with owned resets", () => {
    expect(resetThreshold(rebirth, 0).toFixed(0)).toBe("1000000");
    expect(resetThreshold(rebirth, 2).toFixed(0)).toBe("64000000");
  });
});

describe("egg probabilities", () => {
  it("published weights total 100%", () => {
    expect(Math.abs(totalWeight() - 100)).toBeLessThan(0.001);
  });
  it("luck-adjusted weights stay normalized", () => {
    const w = adjustedWeights(200);
    expect(Math.abs(w.reduce((a, b) => a + b, 0) - 100)).toBeLessThan(0.001);
    expect(w[0]).toBeLessThan(RARITIES[0].weight); // common reduced
    expect(w[7]).toBeGreaterThan(RARITIES[7].weight); // secret increased
  });
  it("pity forces legendary or better", () => {
    for (let i = 0; i < 50; i++) {
      expect(rollRarity(0, 999, 75, seededRng(i))).toBeGreaterThanOrEqual(4);
    }
  });
  it("without pity, rolls respect ranges", () => {
    for (let i = 0; i < 50; i++) {
      const idx = rollRarity(0, 0, 75, seededRng(1000 + i));
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(8);
    }
  });
});

describe("content integrity", () => {
  it("all worlds have 8 pets and valid costs", () => {
    expect(WORLDS).toHaveLength(10);
    for (const w of WORLDS) {
      expect(w.pets).toHaveLength(8);
      expect(bn(w.unlockCost).gte(0)).toBe(true);
      expect(bn(w.eggCost).gt(0)).toBe(true);
    }
    expect(PETS).toHaveLength(80);
  });
  it("pet rarities map to the rarity ladder order", () => {
    for (const p of PETS) {
      expect(RARITIES[p.rarityIdx].id).toBe(p.rarity);
    }
  });
});

describe("level & quests", () => {
  it("level rises with clicks", () => {
    expect(levelFromClicks(0)).toBe(1);
    expect(levelFromClicks(500)).toBeGreaterThanOrEqual(3);
  });
  it("quest targets scale with level", () => {
    expect(questTarget({ base: 100, perLevel: 0.5 } as never, 1)).toBe(100);
    expect(questTarget({ base: 100, perLevel: 0.5 } as never, 5)).toBe(300);
  });
});

describe("offline earnings", () => {
  it("caps at the capacitor window and 50% efficiency", () => {
    const g = offlineGain(bn(100), 10 * 3600, 0); // 1h cap, 50%
    expect(g.toFixed(0)).toBe(String(100 * 3600 * 0.5));
  });
});

describe("permissions", () => {
  it("moderators cannot touch the economy", () => {
    expect(hasPerm("moderator", "moderation.manage")).toBe(true);
    expect(hasPerm("moderator", "economy.manage")).toBe(false);
  });
  it("support is read-only", () => {
    expect(hasPerm("support", "players.view")).toBe(true);
    expect(hasPerm("support", "players.grant")).toBe(false);
    expect(hasPerm("support", "codes.manage")).toBe(false);
  });
  it("roles cannot affect equals or superiors", () => {
    expect(canAffectRole("owner", "super_admin")).toBe(true);
    expect(canAffectRole("admin", "super_admin")).toBe(false);
    expect(canAffectRole("admin", "admin")).toBe(false);
    expect(canAffectRole("player", "player")).toBe(false);
  });
  it("players have no admin permissions", () => {
    expect(hasPerm("player", "players.view")).toBe(false);
  });
});
