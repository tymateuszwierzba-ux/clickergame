/* ============================================================================
   NEXORA — authoritative game service. All gameplay mutations run in
   transactions with row-level locks. The client only ever receives
   server-computed results.
============================================================================ */

import { db } from "@/db";
import {
  users, profiles, gameStates, upgradeStates, pets, batchKeys, playerQuests,
  playerAchievements, codes, redemptions, events, announcements, metricsDaily,
  shopOrders, gameConfig,
} from "@/db/schema";
import { and, eq, sql, desc, asc, count, inArray, gt } from "drizzle-orm";
import { randomInt, randomBytes } from "crypto";
import { BigNumber, bn, hashStr, seededRng } from "@/lib/num";
import {
  UPGRADES, RESET_TIERS, WORLDS, PETS, RARITIES, PITY_THRESHOLD,
  GOLDEN_CHANCE, SHINY_CHANCE, VARIANT_MULT, BASE_INVENTORY_CAP,
  DAILY_QUESTS, WEEKLY_QUESTS, ACHIEVEMENTS, DAILY_REWARDS, SHOP_ITEMS,
  upgradeById, petByDefId, worldById, questTarget, utcDay, utcWeek,
  levelFromClicks, bulkPrice, type QuestDef,
} from "@/config/game";
import {
  deriveStats, simulateClicks, planPurchase, resetThreshold, resetGain,
  rollRarity, adjustedWeights, offlineGain, type Boost, type EventParams,
} from "@/lib/engine";
import { ActionError } from "./auth";
import { rateLimit, cleanupBuckets } from "./security";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/* ---------------------------------- Events --------------------------------- */

let eventCache: { at: number; mods: EventParams; active: EventInfo[] } | null = null;

export interface EventInfo {
  id: string;
  kind: string;
  title: string;
  description: string;
  params: EventParams;
  startsAt: number;
  endsAt: number;
  color: string;
}

async function maybeTransitionEvents() {
  // Idempotent status transitions driven by the clock.
  const now = new Date();
  await db.execute(sql`
    UPDATE events SET status = 'active'
    WHERE status = 'scheduled' AND starts_at <= ${now} AND ends_at > ${now}
  `);
  await db.execute(sql`
    UPDATE events SET status = 'ended'
    WHERE status IN ('scheduled','active') AND ends_at <= ${now}
  `);
}

export async function getActiveEvents(): Promise<{ mods: EventParams; active: EventInfo[] }> {
  if (eventCache && Date.now() - eventCache.at < 8000) return eventCache;
  await maybeTransitionEvents();
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.status, "active"), gt(events.endsAt, new Date())));
  const mods: EventParams = {};
  const active: EventInfo[] = rows.map((r) => {
    const p = (r.params ?? {}) as EventParams;
    if (p.energyMult) mods.energyMult = (mods.energyMult ?? 1) * p.energyMult;
    if (p.clickMult) mods.clickMult = (mods.clickMult ?? 1) * p.clickMult;
    if (p.luckBonus) mods.luckBonus = (mods.luckBonus ?? 0) + p.luckBonus;
    return {
      id: r.id, kind: r.kind, title: r.title, description: r.description,
      params: p, startsAt: r.startsAt.getTime(), endsAt: r.endsAt.getTime(),
      color: "#22d3ee",
    };
  });
  eventCache = { at: Date.now(), mods, active };
  return eventCache;
}

/** Economy overrides published from the admin panel (key: "economy"). */
export async function getEconomyOverrides(): Promise<{ energyMult?: number; petMult?: number; priceMult?: number; luckBonus?: number }> {
  const rows = await db.select().from(gameConfig).where(eq(gameConfig.key, "economy")).limit(1);
  return (rows[0]?.value ?? {}) as { energyMult?: number; petMult?: number; priceMult?: number; luckBonus?: number };
}

/* ------------------------------- Data loading ------------------------------ */

export async function loadPlayerBundle(userId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const [state] = await db.select().from(gameStates).where(eq(gameStates.userId, userId)).limit(1);
  const ups = await db.select().from(upgradeStates).where(eq(upgradeStates.userId, userId));
  const petRows = await db.select().from(pets).where(eq(pets.userId, userId)).orderBy(asc(pets.createdAt));
  const achRows = await db.select().from(playerAchievements).where(eq(playerAchievements.userId, userId));
  const questRows = await db.select().from(playerQuests).where(eq(playerQuests.userId, userId));
  const orders = await db.select().from(shopOrders).where(eq(shopOrders.userId, userId));
  return { profile, state, ups, petRows, achRows, questRows, orders };
}

export function computeLevels(ups: { upgradeId: string; level: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const u of ups) out[u.upgradeId] = u.level;
  return out;
}

export function worldBonusPct(unlockedWorlds: number[], currentWorld: number): number {
  const w = worldById.get(currentWorld);
  return w && unlockedWorlds.includes(currentWorld) ? w.bonusPct : 0;
}

export function equippedPetPct(petRows: typeof pets.$inferSelect[]): number {
  return petRows
    .filter((p) => p.equipped)
    .reduce((acc, p) => {
      const def = petByDefId.get(p.defId);
      if (!def) return acc;
      return acc + def.pct * (VARIANT_MULT[p.variant] ?? 1);
    }, 0);
}

export function slotCount(orders: { itemId: string }[]): number {
  return orders.filter((o) => o.itemId === "slot-extra").length;
}
export function inventoryCap(orders: { itemId: string }[]): number {
  return BASE_INVENTORY_CAP + 50 * orders.filter((o) => o.itemId === "inventory-expand").length;
}

export async function buildStats(userId: string, at = Date.now()) {
  const bundle = await loadPlayerBundle(userId);
  const { mods } = await getActiveEvents();
  const eco = await getEconomyOverrides();
  const levels = computeLevels(bundle.ups);
  const resets = (bundle.state?.resets ?? {}) as Record<string, number>;
  const boosts = ((bundle.state?.boosts ?? []) as Boost[]).filter((b) => b.expiresAt > at);
  const stats = deriveStats({
    levels,
    resets,
    currencies: {
      shards: bundle.state?.shards ?? "0",
      cores: bundle.state?.cores ?? "0",
      prisms: bundle.state?.prisms ?? "0",
      voids: bundle.state?.voids ?? "0",
    },
    petPct: equippedPetPct(bundle.petRows) * (eco.petMult ?? 1),
    worldBonusPct: worldBonusPct((bundle.state?.unlockedWorlds as number[]) ?? [1], bundle.state?.world ?? 1),
    boosts,
    event: { ...mods, energyMult: (mods.energyMult ?? 1) * (eco.energyMult ?? 1), luckBonus: (mods.luckBonus ?? 0) + (eco.luckBonus ?? 0) },
    now: at,
  });
  return { bundle, stats, levels, resets, boosts, mods, eco };
}

/* --------------------------- Quest progress helpers ------------------------ */

export function activeDailyQuests(userId: string, day = utcDay()): QuestDef[] {
  const rng = seededRng(hashStr(`${day}:${userId}`));
  const pool = [...DAILY_QUESTS];
  const picked: QuestDef[] = [];
  while (picked.length < 3 && pool.length > 0) {
    const i = Math.floor(rng() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

export function activeWeeklyQuests(userId: string, week = utcWeek()): QuestDef[] {
  const rng = seededRng(hashStr(`${week}:${userId}`));
  const pool = [...WEEKLY_QUESTS];
  const picked: QuestDef[] = [];
  while (picked.length < 3 && pool.length > 0) {
    const i = Math.floor(rng() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

async function bumpQuests(tx: Tx, userId: string, metric: string, amount: string) {
  const today = utcDay();
  const week = utcWeek();
  const quests = [
    ...activeDailyQuests(userId, today).map((q) => ({ q, period: today })),
    ...activeWeeklyQuests(userId, week).map((q) => ({ q, period: week })),
  ].filter(({ q }) => q.metric === metric);
  for (const { q, period } of quests) {
    await tx
      .insert(playerQuests)
      .values({ userId, questId: q.id, period, progress: amount })
      .onConflictDoUpdate({
        target: [playerQuests.userId, playerQuests.questId, playerQuests.period],
        set: { progress: sql`${playerQuests.progress}::numeric + ${amount}` },
      });
  }
}

/* ---------------------------- Achievement checks --------------------------- */

async function checkAchievements(
  tx: Tx,
  userId: string,
  metrics: Record<string, BigNumber | number>,
): Promise<string[]> {
  const unlocked: string[] = [];
  for (const a of ACHIEVEMENTS) {
    const value = metrics[a.metric];
    if (value === undefined) continue;
    const reached = typeof value === "number" ? value >= Number(a.target) : bn(value).gte(a.target);
    if (!reached) continue;
    const res = await tx
      .insert(playerAchievements)
      .values({ userId, achievementId: a.id })
      .onConflictDoNothing()
      .returning({ id: playerAchievements.achievementId });
    if (res.length > 0) unlocked.push(a.id);
  }
  return unlocked;
}

/* --------------------------------- Metrics --------------------------------- */

async function bumpMetrics(tx: Tx, patch: { clicks?: number; hatches?: number; rebirths?: number; energy?: string }) {
  const day = utcDay();
  await tx
    .insert(metricsDaily)
    .values({
      day,
      clicks: patch.clicks ?? 0,
      hatches: patch.hatches ?? 0,
      rebirths: patch.rebirths ?? 0,
      energyEarned: patch.energy ?? "0",
    })
    .onConflictDoUpdate({
      target: metricsDaily.day,
      set: {
        clicks: sql`${metricsDaily.clicks} + ${patch.clicks ?? 0}`,
        hatches: sql`${metricsDaily.hatches} + ${patch.hatches ?? 0}`,
        rebirths: sql`${metricsDaily.rebirths} + ${patch.rebirths ?? 0}`,
        energyEarned: sql`${metricsDaily.energyEarned}::numeric + ${patch.energy ?? "0"}`,
      },
    });
}

/* ------------------------------ Passive tick ------------------------------- */

function applyPassiveTick(state: typeof gameStates.$inferSelect, passivePerSec: BigNumber, now: Date) {
  const last = state.lastSavedAt.getTime();
  const elapsed = Math.min(Math.max(0, now.getTime() - last) / 1000, 3600);
  if (elapsed < 1 || passivePerSec.lte(0)) return { gain: new BigNumber(0), elapsed };
  return { gain: passivePerSec.times(elapsed).integerValue(BigNumber.ROUND_FLOOR), elapsed };
}

/* ---------------------------------------------------------------------------
   CLICK BATCH — the core loop. Server-authoritative with idempotency keys.
--------------------------------------------------------------------------- */

export async function clickBatch(userId: string, count: number, key: string) {
  cleanupBuckets();
  if (!Number.isInteger(count) || count < 1 || count > 400) throw new ActionError("Invalid click batch size");
  if (!/^[a-zA-Z0-9_-]{8,72}$/.test(key)) throw new ActionError("Invalid batch key");
  if (!rateLimit(`clicks:${userId}`, 500, 24)) throw new ActionError("Slow down — the grid needs a breath", 429);

  // Idempotency: first writer wins; duplicates are acknowledged without reward.
  const inserted = await db.insert(batchKeys).values({ key, userId }).onConflictDoNothing().returning({ key: batchKeys.key });
  if (inserted.length === 0) {
    const { bundle } = await buildStats(userId);
    return { duplicate: true as const, energy: bundle.state?.energy ?? "0", totalClicks: bundle.state?.totalClicks ?? 0 };
  }

  const now = new Date();
  return await db.transaction(async (tx) => {
    const [state] = await tx.select().from(gameStates).where(eq(gameStates.userId, userId)).for("update").limit(1);
    if (!state) throw new ActionError("No game state", 400);

    const { stats } = await buildStats(userId, now.getTime());

    // Passive accrual since last save
    const tick = applyPassiveTick(state, stats.passivePerSec, now);

    // Simulate the clicks with a crypto-seeded RNG
    const rng = () => randomBytes(4).readUInt32BE(0) / 0xffffffff;
    const comboAlive = state.lastClickAt && now.getTime() - state.lastClickAt.getTime() < 4000 ? state.combo : 0;
    const sim = simulateClicks(count, stats, comboAlive, state.bestCombo, rng);

    const gained = sim.total.plus(tick.gain);
    const energy = bn(state.energy).plus(gained);
    const lifetime = bn(state.lifetimeEarned).plus(gained);
    const totalClicks = state.totalClicks + count;
    const playSeconds = state.playSeconds + Math.min(30, Math.ceil(tick.elapsed || 1));

    await tx
      .update(gameStates)
      .set({
        energy: energy.toFixed(0),
        energyNum: Math.min(energy.toNumber(), 1e300),
        lifetimeEarned: lifetime.toFixed(0),
        lifetimeEarnedNum: Math.min(lifetime.toNumber(), 1e300),
        totalClicks,
        combo: sim.finalCombo,
        bestCombo: sim.bestCombo,
        lastClickAt: now,
        lastSavedAt: now,
        playSeconds,
        version: state.version + 1,
      })
      .where(eq(gameStates.userId, userId));

    await bumpQuests(tx, userId, "clicks", String(count));
    await bumpQuests(tx, userId, "earned", gained.toFixed(0));

    const newLevel = levelFromClicks(totalClicks);
    await tx.update(profiles).set({ level: newLevel, updatedAt: now }).where(eq(profiles.userId, userId));

    await bumpMetrics(tx, { clicks: count, energy: gained.toFixed(0) });

    const unlocked = await checkAchievements(tx, userId, {
      clicks: totalClicks,
      earned: lifetime,
      streak: 0,
    });

    return {
      duplicate: false as const,
      gained: gained.toFixed(0),
      energy: energy.toFixed(0),
      lifetimeEarned: lifetime.toFixed(0),
      totalClicks,
      combo: sim.finalCombo,
      bestCombo: sim.bestCombo,
      crits: sim.crits,
      level: newLevel,
      newAchievements: unlocked,
      passivePerSec: stats.passivePerSec.toFixed(2),
    };
  });
}

/* --------------------------------- Upgrades --------------------------------- */

export async function buyUpgrade(userId: string, upgradeId: string, mode: "1" | "10" | "max" | number) {
  const def = upgradeById.get(upgradeId);
  if (!def) throw new ActionError("Unknown upgrade", 404);
  const now = new Date();

  return await db.transaction(async (tx) => {
    const [state] = await tx.select().from(gameStates).where(eq(gameStates.userId, userId)).for("update").limit(1);
    if (!state) throw new ActionError("No game state");

    // passive tick first so displayed balance matches server
    const { stats } = await buildStats(userId);
    const tick = applyPassiveTick(state, stats.passivePerSec, now);
    const balance = bn(state.energy).plus(tick.gain);

    const [upRow] = await tx
      .select()
      .from(upgradeStates)
      .where(and(eq(upgradeStates.userId, userId), eq(upgradeStates.upgradeId, upgradeId)))
      .limit(1);
    const level = upRow?.level ?? 0;

    const eco = await getEconomyOverrides();
    const priceMult = eco.priceMult ?? 1;
    let wantMode: "1" | "10" | "max" = "1";
    if (mode === "10" || mode === "max") wantMode = mode;
    if (typeof mode === "number") wantMode = "max";
    const plan = planPurchase(upgradeId, level, balance.div(priceMult).integerValue(BigNumber.ROUND_FLOOR).toFixed(0), wantMode);
    let levels = plan.levels;
    if (typeof mode === "number") {
      if (!Number.isInteger(mode) || mode < 1 || mode > 100000) throw new ActionError("Invalid amount");
      levels = Math.min(mode, plan.levels);
    }
    const cost = bulkPrice(def.baseCost, def.growth, level, levels).times(priceMult).integerValue(BigNumber.ROUND_CEIL);
    if (levels <= 0) throw new ActionError(level >= def.maxLevel ? "Upgrade is maxed out" : "Not enough energy");
    if (cost.gt(balance)) throw new ActionError("Not enough energy");

    const newEnergy = balance.minus(cost);
    await tx
      .update(gameStates)
      .set({
        energy: newEnergy.toFixed(0),
        energyNum: Math.min(newEnergy.toNumber(), 1e300),
        upgradesBought: state.upgradesBought + levels,
        lastSavedAt: now,
        version: state.version + 1,
      })
      .where(eq(gameStates.userId, userId));

    await tx
      .insert(upgradeStates)
      .values({ userId, upgradeId, level: level + levels })
      .onConflictDoUpdate({ target: [upgradeStates.userId, upgradeStates.upgradeId], set: { level: level + levels } });

    await bumpQuests(tx, userId, "upgrades", String(levels));

    return {
      upgradeId,
      newLevel: level + levels,
      bought: levels,
      cost: cost.toFixed(0),
      energy: newEnergy.toFixed(0),
    };
  });
}

/* ---------------------------------- Resets ---------------------------------- */

export async function performReset(userId: string, tierId: string) {
  const tier = RESET_TIERS.find((t) => t.id === tierId);
  if (!tier) throw new ActionError("Unknown reset tier", 404);

  return await db.transaction(async (tx) => {
    const [state] = await tx.select().from(gameStates).where(eq(gameStates.userId, userId)).for("update").limit(1);
    if (!state) throw new ActionError("No game state");
    const resets = (state.resets ?? {}) as Record<string, number>;
    const owned = resets[tierId] ?? 0;

    const idx = RESET_TIERS.findIndex((t) => t.id === tierId);
    const prevResets = idx > 0 ? resets[RESET_TIERS[idx - 1].id] ?? 0 : 0;
    if (tier.minPrevResets > 0 && prevResets < tier.minPrevResets) {
      throw new ActionError(`Requires ${tier.minPrevResets} ${RESET_TIERS[idx - 1].name.toLowerCase()}s first`);
    }

    const threshold = resetThreshold(tier, owned);
    const lifetime = bn(state.lifetimeEarned);
    if (lifetime.lt(threshold)) throw new ActionError(`Requires ${threshold.toExponential(2)} lifetime energy`);

    const levelRows = await tx.select().from(upgradeStates).where(eq(upgradeStates.userId, userId));
    const resonance = levelRows.find((l) => l.upgradeId === "neon-resonance")?.level ?? 0;
    const gain = resetGain(tier, lifetime, resonance);

    // Build reset patch — deeper tiers also clear shallower progress
    const patch: Record<string, unknown> = {
      energy: "0",
      energyNum: 0,
      resets: { ...resets, [tierId]: owned + 1 },
      combo: 0,
      lastSavedAt: new Date(),
      version: state.version + 1,
    };
    patch[tier.currencyField] = bn(state[tier.currencyField]).plus(gain).toFixed(0);
    if (idx >= 1) {
      patch.shards = "0";
    }
    if (idx >= 2) {
      patch.cores = "0";
    }
    if (idx >= 3) {
      patch.prisms = "0";
    }
    // Clear upgrades on every reset
    await tx.delete(upgradeStates).where(eq(upgradeStates.userId, userId));
    await tx.update(gameStates).set(patch).where(eq(gameStates.userId, userId));

    await bumpQuests(tx, userId, "rebirths", "1");
    await bumpMetrics(tx, { rebirths: 1 });
    const unlocked = await checkAchievements(tx, userId, { rebirths: owned + 1 });

    return { tier: tierId, gained: gain.toFixed(0), owned: owned + 1, newAchievements: unlocked };
  });
}

/* ----------------------------------- Eggs ----------------------------------- */

export interface HatchedPet {
  id: string;
  defId: string;
  name: string;
  worldId: number;
  rarity: string;
  rarityIdx: number;
  variant: string;
  pct: number;
  pityUsed: boolean;
}

export async function hatchEggs(userId: string, worldId: number, hatchCount: number) {
  const world = worldById.get(worldId);
  if (!world) throw new ActionError("Unknown world", 404);
  if (!Number.isInteger(hatchCount) || ![1, 3].includes(hatchCount)) throw new ActionError("Hatch 1 or 3 eggs");
  if (!rateLimit(`hatch:${userId}`, 30, 1)) throw new ActionError("Too fast — take a breath", 429);

  return await db.transaction(async (tx) => {
    const [state] = await tx.select().from(gameStates).where(eq(gameStates.userId, userId)).for("update").limit(1);
    if (!state) throw new ActionError("No game state");

    const unlockedWorlds = (state.unlockedWorlds as number[]) ?? [1];
    if (!unlockedWorlds.includes(worldId)) throw new ActionError("Unlock this world first");

    const petRows = await tx.select({ id: pets.id }).from(pets).where(eq(pets.userId, userId));
    const orders = await tx.select({ itemId: shopOrders.itemId }).from(shopOrders).where(eq(shopOrders.userId, userId));
    const cap = inventoryCap(orders);
    if (petRows.length + hatchCount > cap) throw new ActionError(`Pet storage full (${cap}). Fuse pets or expand storage.`);

    const cost = bn(world.eggCost).times(hatchCount);
    const { stats } = await buildStats(userId);
    const tick = applyPassiveTick(state, stats.passivePerSec, new Date());
    const balance = bn(state.energy).plus(tick.gain);
    if (balance.lt(cost)) throw new ActionError("Not enough energy");

    const pity = { ...((state.pity ?? {}) as Record<string, number>) };
    const weightScale = await getEconomyOverrides().then((e) => (e.luckBonus ?? 0));
    const luck = stats.luck + weightScale;

    const hatched: HatchedPet[] = [];
    for (let i = 0; i < hatchCount; i++) {
      const pityCount = pity[String(worldId)] ?? 0;
      const rarityIdx = rollRarity(luck, pityCount, PITY_THRESHOLD, () => randomInt(0, 1_000_000) / 1_000_000);
      const pityUsed = pityCount >= PITY_THRESHOLD && rarityIdx >= 4;
      pity[String(worldId)] = rarityIdx >= 4 ? 0 : pityCount + 1;

      const def = PETS.find((p) => p.worldId === worldId && p.rarityIdx === rarityIdx)!;
      const roll = randomInt(0, 1_000_000) / 1_000_000;
      const variant = roll < SHINY_CHANCE ? "shiny" : roll < GOLDEN_CHANCE ? "golden" : "normal";

      const [row] = await tx
        .insert(pets)
        .values({ userId, defId: def.defId, worldId, rarity: def.rarity, variant })
        .returning({ id: pets.id });
      hatched.push({
        id: row.id, defId: def.defId, name: def.name, worldId,
        rarity: def.rarity, rarityIdx, variant, pct: def.pct, pityUsed,
      });
    }

    const newEnergy = balance.minus(cost);
    const secrets = hatched.filter((h) => h.rarity === "secret").length;
    await tx
      .update(gameStates)
      .set({
        energy: newEnergy.toFixed(0),
        energyNum: Math.min(newEnergy.toNumber(), 1e300),
        hatchedTotal: state.hatchedTotal + hatchCount,
        secretHatches: state.secretHatches + secrets,
        pity,
        lastSavedAt: new Date(),
        version: state.version + 1,
      })
      .where(eq(gameStates.userId, userId));

    await bumpQuests(tx, userId, "hatches", String(hatchCount));
    await bumpMetrics(tx, { hatches: hatchCount });
    const unlocked = await checkAchievements(tx, userId, {
      hatches: state.hatchedTotal + hatchCount,
      secrets: state.secretHatches + secrets,
      pets: petRows.length + hatchCount,
    });

    return { hatched, energy: newEnergy.toFixed(0), newAchievements: unlocked };
  });
}

/* ----------------------------------- Pets ----------------------------------- */

export async function petAction(userId: string, action: string, petId?: string) {
  const slotOrders = await db.select({ itemId: shopOrders.itemId }).from(shopOrders).where(and(eq(shopOrders.userId, userId), eq(shopOrders.itemId, "slot-extra")));
  const maxEq = 3 + Math.min(slotOrders.length, 3);

  return await db.transaction(async (tx) => {
    if (action === "equip" || action === "unequip" || action === "favorite") {
      if (!petId) throw new ActionError("Missing pet id");
      const [pet] = await tx.select().from(pets).where(eq(pets.id, petId)).limit(1);
      if (!pet || pet.userId !== userId) throw new ActionError("Pet not found", 404);
      if (action === "favorite") {
        await tx.update(pets).set({ favorite: !pet.favorite }).where(eq(pets.id, petId));
        return { ok: true, favorite: !pet.favorite };
      }
      if (action === "equip") {
        if (pet.equipped) return { ok: true, equipped: true };
        const eqCount = await tx.select({ n: count() }).from(pets).where(and(eq(pets.userId, userId), eq(pets.equipped, true)));
        if ((eqCount[0]?.n ?? 0) >= maxEq) throw new ActionError(`Max ${maxEq} pets equipped`);
        await tx.update(pets).set({ equipped: true }).where(eq(pets.id, petId));
        return { ok: true, equipped: true };
      }
      await tx.update(pets).set({ equipped: false }).where(eq(pets.id, petId));
      return { ok: true, equipped: false };
    }

    if (action === "equip-best") {
      const rows = await tx.select().from(pets).where(eq(pets.userId, userId));
      const scored = rows
        .map((p) => {
          const def = petByDefId.get(p.defId);
          return { p, score: (def?.pct ?? 0) * (VARIANT_MULT[p.variant] ?? 1) };
        })
        .sort((a, b) => b.score - a.score);
      const best = new Set(scored.slice(0, maxEq).map((s) => s.p.id));
      for (const s of scored) {
        const should = best.has(s.p.id);
        if (s.p.equipped !== should) {
          await tx.update(pets).set({ equipped: should }).where(eq(pets.id, s.p.id));
        }
      }
      return { ok: true, equippedCount: Math.min(best.size, scored.length) };
    }

    if (action === "fuse") {
      if (!petId) throw new ActionError("Missing pet id");
      const [base] = await tx.select().from(pets).where(eq(pets.id, petId)).limit(1);
      if (!base || base.userId !== userId) throw new ActionError("Pet not found", 404);
      if (base.variant === "shiny") throw new ActionError("Already at max fusion tier");
      const nextVariant = base.variant === "golden" ? "shiny" : "golden";
      const dupes = await tx
        .select()
        .from(pets)
        .where(and(eq(pets.userId, userId), eq(pets.defId, base.defId), eq(pets.variant, base.variant), eq(pets.favorite, false)))
        .limit(3);
      if (dupes.length < 3) throw new ActionError(`Fusion requires 3 identical ${base.variant} pets (favorites are protected)`);
      await tx.delete(pets).where(inArray(pets.id, dupes.map((d) => d.id)));
      const [row] = await tx
        .insert(pets)
        .values({ userId, defId: base.defId, worldId: base.worldId, rarity: base.rarity, variant: nextVariant, favorite: base.favorite })
        .returning({ id: pets.id });
      return { ok: true, fused: row.id, variant: nextVariant };
    }

    throw new ActionError("Unknown pet action");
  });
}

/* ------------------------------ Daily rewards ------------------------------- */

export async function claimDailyReward(userId: string) {
  return await db.transaction(async (tx) => {
    const [profile] = await tx.select().from(profiles).where(eq(profiles.userId, userId)).for("update").limit(1);
    const [state] = await tx.select().from(gameStates).where(eq(gameStates.userId, userId)).for("update").limit(1);
    if (!profile || !state) throw new ActionError("No profile");

    const today = utcDay();
    if (profile.lastDailyDate === today) throw new ActionError("Already claimed today — come back tomorrow");

    const yesterday = utcDay(new Date(Date.now() - 86400_000));
    const streak = profile.lastDailyDate === yesterday ? profile.dailyStreak + 1 : 1;
    const reward = DAILY_REWARDS[(streak - 1) % 7];

    const energyReward = BigNumber.maximum(
      bn(reward.flatEnergy),
      bn(state.lifetimeEarned).times(reward.energyPctOfLifetime),
    ).integerValue(BigNumber.ROUND_FLOOR);

    const newEnergy = bn(state.energy).plus(energyReward);
    await tx
      .update(gameStates)
      .set({
        energy: newEnergy.toFixed(0),
        energyNum: Math.min(newEnergy.toNumber(), 1e300),
        gems: state.gems + reward.gems,
        shards: bn(state.shards).plus(reward.shards).toFixed(0),
        lastSavedAt: new Date(),
        version: state.version + 1,
      })
      .where(eq(gameStates.userId, userId));
    await tx
      .update(profiles)
      .set({ lastDailyDate: today, dailyStreak: streak, updatedAt: new Date() })
      .where(eq(profiles.userId, userId));

    const unlocked = await checkAchievements(tx, userId, { streak });

    return { day: reward.day, streak, gems: reward.gems, shards: reward.shards, energy: energyReward.toFixed(0), newAchievements: unlocked };
  });
}

/* ------------------------------ Quest claiming ------------------------------ */

export async function claimQuest(userId: string, questId: string, period: string) {
  const def = [...DAILY_QUESTS, ...WEEKLY_QUESTS].find((q) => q.id === questId);
  if (!def) throw new ActionError("Unknown quest", 404);
  if (!/^[\d\-W]+$/.test(period) || period.length > 12) throw new ActionError("Invalid period");

  return await db.transaction(async (tx) => {
    const [profile] = await tx.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
    const [state] = await tx.select().from(gameStates).where(eq(gameStates.userId, userId)).for("update").limit(1);
    if (!state || !profile) throw new ActionError("No state");

    const [row] = await tx
      .select()
      .from(playerQuests)
      .where(and(eq(playerQuests.userId, userId), eq(playerQuests.questId, questId), eq(playerQuests.period, period)))
      .limit(1);

    const target = questTarget(def, profile.level);
    let progress = bn(row?.progress ?? "0");
    if (def.metric === "pets") {
      const c = await tx.select({ n: count() }).from(pets).where(eq(pets.userId, userId));
      progress = bn(c[0]?.n ?? 0);
    }
    if (def.metric === "rebirths") {
      // handled by bump at reset; also allow current total
    }
    if (row?.claimed) throw new ActionError("Quest reward already claimed");
    if (progress.lt(target)) throw new ActionError("Quest not complete yet");

    await tx
      .insert(playerQuests)
      .values({ userId, questId, period, progress: progress.toFixed(0), claimed: true })
      .onConflictDoUpdate({
        target: [playerQuests.userId, playerQuests.questId, playerQuests.period],
        set: { claimed: true, progress: progress.toFixed(0) },
      });

    const energyReward = BigNumber.maximum(bn("1000"), bn(state.lifetimeEarned).times(0.04)).integerValue(BigNumber.ROUND_FLOOR);
    const newEnergy = bn(state.energy).plus(energyReward);
    await tx
      .update(gameStates)
      .set({
        energy: newEnergy.toFixed(0),
        energyNum: Math.min(newEnergy.toNumber(), 1e300),
        gems: state.gems + def.rewardGems,
        shards: bn(state.shards).plus(def.rewardShards).toFixed(0),
        questsClaimed: state.questsClaimed + 1,
        lastSavedAt: new Date(),
        version: state.version + 1,
      })
      .where(eq(gameStates.userId, userId));

    const unlocked = await checkAchievements(tx, userId, { quests: state.questsClaimed + 1 });

    return { questId, gems: def.rewardGems, shards: def.rewardShards, energy: energyReward.toFixed(0), newAchievements: unlocked };
  });
}

/* ---------------------------------- Codes ----------------------------------- */

export async function redeemCode(userId: string, codeStr: string) {
  const clean = codeStr.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(clean)) throw new ActionError("Invalid code format");

  return await db.transaction(async (tx) => {
    const [code] = await tx.select().from(codes).where(eq(codes.code, clean)).for("update").limit(1);
    if (!code || !code.active) throw new ActionError("This code is not valid");
    const now = new Date();
    if (code.startsAt > now) throw new ActionError("This code is not active yet");
    if (code.expiresAt && code.expiresAt < now) throw new ActionError("This code has expired");
    if (code.maxRedemptions > 0 && code.redemptionCount >= code.maxRedemptions) throw new ActionError("This code has been fully redeemed");

    const [state] = await tx.select().from(gameStates).where(eq(gameStates.userId, userId)).for("update").limit(1);
    if (!state) throw new ActionError("No state");

    try {
      await tx.insert(redemptions).values({ codeId: code.id, userId });
    } catch {
      throw new ActionError("You already redeemed this code");
    }

    await tx.update(codes).set({ redemptionCount: code.redemptionCount + 1 }).where(eq(codes.id, code.id));

    const reward = code.reward as { energy?: string; gems?: number; shards?: number; boost?: { name: string; mult: number; durationSec: number } };
    const boosts = [...((state.boosts ?? []) as Boost[])];
    if (reward.boost) {
      boosts.push({ id: `code-${clean}`, name: reward.boost.name, mult: reward.boost.mult, expiresAt: now.getTime() + reward.boost.durationSec * 1000 });
    }
    const newEnergy = bn(state.energy).plus(reward.energy ?? 0);
    await tx
      .update(gameStates)
      .set({
        energy: newEnergy.toFixed(0),
        energyNum: Math.min(newEnergy.toNumber(), 1e300),
        gems: state.gems + (reward.gems ?? 0),
        shards: bn(state.shards).plus(reward.shards ?? 0).toFixed(0),
        boosts,
        codesRedeemed: state.codesRedeemed + 1,
        lastSavedAt: now,
        version: state.version + 1,
      })
      .where(eq(gameStates.userId, userId));

    const unlocked = await checkAchievements(tx, userId, { codes: state.codesRedeemed + 1 });

    return { code: clean, reward, newAchievements: unlocked };
  });
}

/* ----------------------------------- Shop ----------------------------------- */

export async function buyShopItem(userId: string, itemId: string) {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) throw new ActionError("Unknown item", 404);

  return await db.transaction(async (tx) => {
    const [state] = await tx.select().from(gameStates).where(eq(gameStates.userId, userId)).for("update").limit(1);
    if (!state) throw new ActionError("No state");
    if (state.gems < item.gemCost) throw new ActionError("Not enough gems");

    if (item.type === "slot") {
      const owned = await tx.select({ n: count() }).from(shopOrders).where(and(eq(shopOrders.userId, userId), eq(shopOrders.itemId, "slot-extra")));
      if ((owned[0]?.n ?? 0) >= 3) throw new ActionError("All extra slots already owned");
    }

    await tx.insert(shopOrders).values({ userId, itemId, costGems: item.gemCost });

    let boosts = [...((state.boosts ?? []) as Boost[])];
    if (item.type === "boost" && item.boostMult && item.durationSec) {
      const levelRows = await tx.select().from(upgradeStates).where(and(eq(upgradeStates.userId, userId), eq(upgradeStates.upgradeId, "overclock-efficiency")));
      const ext = 1 + 0.25 * (levelRows[0]?.level ?? 0);
      boosts = boosts.filter((b) => b.id !== item.id); // replace same boost instead of stacking silently
      boosts.push({ id: item.id, name: item.name, mult: item.boostMult, expiresAt: Date.now() + Math.round(item.durationSec * ext * 1000) });
    }

    await tx
      .update(gameStates)
      .set({ gems: state.gems - item.gemCost, boosts, lastSavedAt: new Date(), version: state.version + 1 })
      .where(eq(gameStates.userId, userId));

    return { itemId, gemsLeft: state.gems - item.gemCost };
  });
}

/* ---------------------------------- Worlds ---------------------------------- */

export async function unlockWorld(userId: string, worldId: number) {
  const world = worldById.get(worldId);
  if (!world) throw new ActionError("Unknown world", 404);

  return await db.transaction(async (tx) => {
    const [state] = await tx.select().from(gameStates).where(eq(gameStates.userId, userId)).for("update").limit(1);
    if (!state) throw new ActionError("No state");
    const unlockedWorlds = [...((state.unlockedWorlds as number[]) ?? [1])];
    if (unlockedWorlds.includes(worldId)) {
      await tx.update(gameStates).set({ world: worldId, version: state.version + 1 }).where(eq(gameStates.userId, userId));
      return { worldId, alreadyUnlocked: true, energy: state.energy };
    }
    const { stats } = await buildStats(userId);
    const tick = applyPassiveTick(state, stats.passivePerSec, new Date());
    const balance = bn(state.energy).plus(tick.gain);
    const cost = bn(world.unlockCost);
    if (balance.lt(cost)) throw new ActionError("Not enough energy to open this portal");

    const newEnergy = balance.minus(cost);
    unlockedWorlds.push(worldId);
    await tx
      .update(gameStates)
      .set({
        energy: newEnergy.toFixed(0),
        energyNum: Math.min(newEnergy.toNumber(), 1e300),
        unlockedWorlds,
        world: worldId,
        lastSavedAt: new Date(),
        version: state.version + 1,
      })
      .where(eq(gameStates.userId, userId));
    return { worldId, alreadyUnlocked: false, energy: newEnergy.toFixed(0) };
  });
}

/* --------------------------------- Settings --------------------------------- */

export async function saveSettings(userId: string, settings: Record<string, unknown>, avatarSeed?: string, title?: string | null) {
  const allowed = ["music", "sfx", "volume", "compact", "reducedMotion", "particles", "notation"];
  const [row] = await db.select({ settings: profiles.settings }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const merged: Record<string, unknown> = { ...((row?.settings ?? {}) as Record<string, unknown>) };
  for (const k of allowed) if (k in settings) merged[k] = settings[k];
  const patch: Record<string, unknown> = { settings: merged, updatedAt: new Date() };
  if (avatarSeed && /^[a-z0-9-]{2,24}$/.test(avatarSeed)) patch.avatarSeed = avatarSeed;
  await db.update(profiles).set(patch).where(eq(profiles.userId, userId));
  return { settings: merged };
}

/* ------------------------------ State serializer ---------------------------- */

export async function serializeState(userId: string) {
  const at = Date.now();
  const { bundle, stats, levels, resets, boosts, mods } = await buildStats(userId, at);
  if (!bundle.state || !bundle.profile) throw new ActionError("State missing");

  const st = bundle.state;
  const prof = bundle.profile;

  // Offline earnings on load (only when away > 5 min)
  let offlineGained = "0";
  const elapsed = (at - st.lastSavedAt.getTime()) / 1000;
  if (elapsed > 300 && stats.passivePerSec.gt(0)) {
    const g = offlineGain(stats.passivePerSec, elapsed, levels["offline-capacitor"] ?? 0);
    if (g.gt(0)) {
      offlineGained = g.toFixed(0);
      const newEnergy = bn(st.energy).plus(g);
      const newLife = bn(st.lifetimeEarned).plus(g);
      await db
        .update(gameStates)
        .set({
          energy: newEnergy.toFixed(0),
          energyNum: Math.min(newEnergy.toNumber(), 1e300),
          lifetimeEarned: newLife.toFixed(0),
          lifetimeEarnedNum: Math.min(newLife.toNumber(), 1e300),
          lastSavedAt: new Date(at),
          version: st.version + 1,
        })
        .where(eq(gameStates.userId, userId));
      st.energy = newEnergy.toFixed(0);
      st.lifetimeEarned = newLife.toFixed(0);
    }
  } else {
    await db.update(gameStates).set({ lastSavedAt: new Date(at) }).where(eq(gameStates.userId, userId));
  }

  const petRows = bundle.petRows.map((p) => {
    const def = petByDefId.get(p.defId);
    return {
      id: p.id, defId: p.defId, name: def?.name ?? "Unknown", worldId: p.worldId,
      rarity: p.rarity, rarityIdx: def?.rarityIdx ?? 0, variant: p.variant,
      equipped: p.equipped, favorite: p.favorite, pct: def?.pct ?? 0,
    };
  });

  // Quests with progress
  const [profileRow] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const level = profileRow?.level ?? 1;
  const day = utcDay();
  const week = utcWeek();
  const questDefs = [
    ...activeDailyQuests(userId, day).map((q) => ({ q, period: day, kind: "daily" as const })),
    ...activeWeeklyQuests(userId, week).map((q) => ({ q, period: week, kind: "weekly" as const })),
  ];
  const petCount = petRows.length;
  const quests = questDefs.map(({ q, period, kind }) => {
    const row = bundle.questRows.find((r) => r.questId === q.id && r.period === period);
    const target = questTarget(q, level);
    let progress = row?.progress ?? "0";
    if (q.metric === "pets") progress = String(petCount);
    return {
      id: q.id, name: q.name, desc: q.desc.replace("{t}", target.toLocaleString("en-US")),
      kind, period, target, progress, claimed: row?.claimed ?? false,
      rewardGems: q.rewardGems, rewardShards: q.rewardShards, metric: q.metric,
    };
  });

  const achUnlocked = new Map(bundle.achRows.map((a) => [a.achievementId, a.unlockedAt]));
  const achPoints = bundle.achRows.reduce((acc, a) => acc + (ACHIEVEMENTS.find((x) => x.id === a.achievementId)?.points ?? 0), 0);

  const [latestAnnouncement] = await db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(1);
  const { active } = await getActiveEvents();

  const today = utcDay();
  const daily = {
    canClaim: prof.lastDailyDate !== today,
    streak: prof.lastDailyDate === today ? prof.dailyStreak : prof.lastDailyDate === utcDay(new Date(at - 86400_000)) ? prof.dailyStreak : 0,
    day: prof.lastDailyDate === today ? prof.dailyStreak % 7 + 1 : (prof.dailyStreak % 7) + 1,
  };

  return {
    energy: st.energy,
    lifetimeEarned: st.lifetimeEarned,
    gems: st.gems,
    shards: st.shards,
    cores: st.cores,
    prisms: st.prisms,
    voids: st.voids,
    resets,
    totalClicks: st.totalClicks,
    combo: st.combo,
    bestCombo: st.bestCombo,
    world: st.world,
    unlockedWorlds: st.unlockedWorlds,
    levels,
    level,
    upgrades: levels,
    pets: petRows,
    quests,
    boosts,
    pity: st.pity,
    settings: prof.settings,
    daily,
    title: prof.title,
    avatarSeed: prof.avatarSeed,
    codesRedeemed: st.codesRedeemed,
    hatchedTotal: st.hatchedTotal,
    secretHatches: st.secretHatches,
    upgradesBought: st.upgradesBought,
    questsClaimed: st.questsClaimed,
    playSeconds: st.playSeconds,
    versions: st.version,
    stats: {
      clickPower: stats.clickPower.toFixed(2),
      passivePerSec: stats.passivePerSec.toFixed(2),
      critChance: stats.critChance,
      critMult: stats.critMult,
      globalMult: stats.globalMult.toFixed(4),
      luck: stats.luck,
      comboCap: stats.comboCap,
      petPct: stats.petPct,
    },
    offlineGained,
    achievements: ACHIEVEMENTS.map((a) => ({
      id: a.id, name: a.hidden && !achUnlocked.has(a.id) ? "???" : a.name,
      desc: a.hidden && !achUnlocked.has(a.id) ? "Hidden achievement" : a.desc,
      points: a.points, tier: a.tier, hidden: a.hidden, metric: a.metric,
      unlocked: achUnlocked.has(a.id), unlockedAt: achUnlocked.get(a.id) ?? null,
    })),
    achievementPoints: achPoints,
    unlockedAchievementCount: bundle.achRows.length,
    announcement: latestAnnouncement && at - latestAnnouncement.createdAt.getTime() < 6 * 3600_000 ? latestAnnouncement.message : null,
    activeEvents: active,
    eventMods: mods,
    maxEquipped: 3 + Math.min(slotCount(bundle.orders), 3),
    inventoryCap: inventoryCap(bundle.orders),
    serverNow: at,
  };
}

/* ------------------------------- Leaderboards ------------------------------- */

export type LeaderboardCategory = "clicks" | "earned" | "rebirths" | "gems" | "pets" | "achievements" | "playtime";

export async function leaderboard(category: LeaderboardCategory, page: number, perPage: number, userId?: string) {
  const offset = Math.max(0, (page - 1) * perPage);
  const base = db
    .select({
      userId: users.id,
      username: users.username,
      role: users.role,
      avatarSeed: profiles.avatarSeed,
      title: profiles.title,
      level: profiles.level,
      clicks: gameStates.totalClicks,
      earned: gameStates.lifetimeEarnedNum,
      gems: gameStates.gems,
      resets: gameStates.resets,
      playSeconds: gameStates.playSeconds,
    })
    .from(gameStates)
    .innerJoin(users, eq(users.id, gameStates.userId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.role, "player"));

  let rows;
  let valueFor: (r: { clicks: number; earned: number; gems: number; resets: unknown; playSeconds: number }) => number;
  switch (category) {
    case "clicks":
      rows = await base.orderBy(desc(gameStates.totalClicks)).limit(perPage).offset(offset);
      valueFor = (r) => r.clicks;
      break;
    case "earned":
      rows = await base.orderBy(desc(gameStates.lifetimeEarnedNum)).limit(perPage).offset(offset);
      valueFor = (r) => r.earned;
      break;
    case "gems":
      rows = await base.orderBy(desc(gameStates.gems)).limit(perPage).offset(offset);
      valueFor = (r) => r.gems;
      break;
    case "playtime":
      rows = await base.orderBy(desc(gameStates.playSeconds)).limit(perPage).offset(offset);
      valueFor = (r) => r.playSeconds;
      break;
    case "rebirths":
      rows = await base
        .orderBy(sql`COALESCE((${gameStates.resets} ->> 'rebirth')::int, 0) + COALESCE((${gameStates.resets} ->> 'prestige')::int, 0) + COALESCE((${gameStates.resets} ->> 'ascension')::int, 0) + COALESCE((${gameStates.resets} ->> 'galaxy')::int, 0) DESC`)
        .limit(perPage)
        .offset(offset);
      valueFor = (r) => Object.values((r.resets ?? {}) as Record<string, number>).reduce((a, b) => a + b, 0);
      break;
    case "pets": {
      const sub = db.select({ userId: pets.userId, n: count().as("n") }).from(pets).groupBy(pets.userId).as("pet_counts");
      const joined = await db
        .select({
          userId: users.id, username: users.username, role: users.role, avatarSeed: profiles.avatarSeed,
          title: profiles.title, level: profiles.level, value: sql<number>`COALESCE(${sub.n}, 0)`,
        })
        .from(users)
        .innerJoin(profiles, eq(profiles.userId, users.id))
        .leftJoin(sub, eq(sub.userId, users.id))
        .where(eq(users.role, "player"))
        .orderBy(sql`value DESC`)
        .limit(perPage)
        .offset(offset);
      return finalizeSimple(joined.map((r, i) => ({ ...r, value: Number(r.value) })), perPage, userId);
    }
    case "achievements": {
      const sub = db
        .select({ userId: playerAchievements.userId, n: count().as("n") })
        .from(playerAchievements)
        .groupBy(playerAchievements.userId)
        .as("ach_counts");
      const joined = await db
        .select({
          userId: users.id, username: users.username, role: users.role, avatarSeed: profiles.avatarSeed,
          title: profiles.title, level: profiles.level, value: sql<number>`COALESCE(${sub.n}, 0)`,
        })
        .from(users)
        .innerJoin(profiles, eq(profiles.userId, users.id))
        .leftJoin(sub, eq(sub.userId, users.id))
        .where(eq(users.role, "player"))
        .orderBy(sql`value DESC`)
        .limit(perPage)
        .offset(offset);
      return finalizeSimple(joined.map((r, i) => ({ ...r, value: Number(r.value) })), perPage, userId);
    }
    default:
      throw new ActionError("Unknown leaderboard category");
  }

  const entries = rows.map((r, i) => ({
    rank: offset + i + 1,
    userId: r.userId,
    username: r.username,
    title: r.title,
    level: r.level,
    avatarSeed: r.avatarSeed,
    value: valueFor(r),
    isYou: r.userId === userId,
  }));

  let yourRank: number | null = null;
  if (userId) {
    const all = await db
      .select({
        userId: gameStates.userId,
        clicks: gameStates.totalClicks,
        earned: gameStates.lifetimeEarnedNum,
        gems: gameStates.gems,
        resets: gameStates.resets,
        playSeconds: gameStates.playSeconds,
      })
      .from(gameStates)
      .innerJoin(users, eq(users.id, gameStates.userId))
      .where(eq(users.role, "player"));
    const sorted = all
      .map((r) => ({ userId: r.userId, value: valueFor({ ...r, resets: r.resets }) }))
      .sort((a, b) => b.value - a.value);
    yourRank = sorted.findIndex((r) => r.userId === userId) + 1 || null;
  }

  return { entries, yourRank, page, perPage };

  function finalizeSimple(joinedRows: { userId: string; username: string; role: string; avatarSeed: string; title: string | null; level: number; value: number }[], pp: number, uid?: string) {
    return {
      entries: joinedRows.map((r, i) => ({
        rank: offset + i + 1, userId: r.userId, username: r.username, title: r.title,
        level: r.level, avatarSeed: r.avatarSeed, value: r.value, isYou: r.userId === uid,
      })),
      yourRank: null as number | null,
      page,
      perPage: pp,
    };
  }
}
