/* ============================================================================
   NEXORA — admin operations. Every action flows through runAdminAction,
   which enforces RBAC permissions and writes an audit record for mutations.
============================================================================ */

import { db } from "@/db";
import {
  users, profiles, gameStates, upgradeStates, pets, sessions, bans, adminNotes,
  auditLogs, gameConfig, configHistory, events, codes, redemptions, announcements,
  metricsDaily, playerAchievements,
} from "@/db/schema";
import { and, asc, desc, eq, gt, gte, ilike, or, sql, count, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { BigNumber, bn } from "@/lib/num";
import { PETS, petByDefId, VARIANT_MULT } from "@/config/game";
import { hasPerm, canAffectRole, type Perm, type Role, ROLE_PERMS } from "./permissions";
import { ActionError, AuthError, type SessionUser } from "./auth";
import { requestId } from "./security";

export { hasPerm };

const reasonSchema = z.string().min(3, "A reason (min 3 chars) is required").max(300);
const amountSchema = z.string().regex(/^\d+(\.\d+)?([eE][+-]?\d+)?$/, "Invalid amount");

const CURRENCY_FIELDS = ["energy", "gems", "shards", "cores", "prisms", "voids"] as const;
type CurrencyField = (typeof CURRENCY_FIELDS)[number];

/* ------------------------------ Audit helper ------------------------------- */

async function audit(
  admin: SessionUser,
  action: string,
  opts: { targetType?: string; targetId?: string; reason?: string; before?: unknown; after?: unknown; result?: string; reqId?: string },
) {
  await db.insert(auditLogs).values({
    adminId: admin.id,
    adminName: admin.username,
    action,
    targetType: opts.targetType ?? null,
    targetId: opts.targetId ?? null,
    reason: opts.reason ?? null,
    before: opts.before === undefined ? null : JSON.parse(JSON.stringify(opts.before)),
    after: opts.after === undefined ? null : JSON.parse(JSON.stringify(opts.after)),
    result: opts.result ?? "ok",
    requestId: opts.reqId ?? requestId(),
  });
}

/* ------------------------------- Queries ----------------------------------- */

async function overview() {
  const [userCount] = await db.select({ n: count() }).from(users);
  const day = new Date(Date.now() - 86400_000);
  const week = new Date(Date.now() - 7 * 86400_000);
  const [newToday] = await db.select({ n: count() }).from(users).where(gte(users.createdAt, day));
  const [newWeek] = await db.select({ n: count() }).from(users).where(gte(users.createdAt, week));
  const [activePlayers] = await db.select({ n: count() }).from(users).where(gte(users.lastLoginAt, day));
  const [activeSessions] = await db.select({ n: count() }).from(sessions).where(gt(sessions.expiresAt, new Date()));
  const [agg] = await db
    .select({
      clicks: sql<string>`COALESCE(SUM(${gameStates.totalClicks}), 0)`,
      earned: sql<string>`COALESCE(SUM(${gameStates.lifetimeEarned}::numeric)::text, '0')`,
      rebirths: sql<string>`COALESCE(SUM(COALESCE((${gameStates.resets} ->> 'rebirth')::int, 0)), 0)`,
      gems: sql<string>`COALESCE(SUM(${gameStates.gems}), 0)`,
    })
    .from(gameStates);
  const [petCount] = await db.select({ n: count() }).from(pets);
  const [achCount] = await db.select({ n: count() }).from(playerAchievements);
  const [activeEvents] = await db.select({ n: count() }).from(events).where(eq(events.status, "active"));
  const [bannedCount] = await db.select({ n: count() }).from(bans).where(and(isNull(bans.revokedAt), or(isNull(bans.expiresAt), gt(bans.expiresAt, new Date()))));
  const series = await db.select().from(metricsDaily).orderBy(desc(metricsDaily.day)).limit(14);
  const recentAudit = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(12);

  const dbStart = Date.now();
  await db.execute(sql`SELECT 1`);
  const dbMs = Date.now() - dbStart;

  // Economy distribution: top currencies held
  const topEnergy = await db
    .select({ username: users.username, energy: gameStates.energyNum })
    .from(gameStates)
    .innerJoin(users, eq(users.id, gameStates.userId))
    .orderBy(desc(gameStates.energyNum))
    .limit(8);

  return {
    totals: {
      accounts: userCount?.n ?? 0,
      activeSessions: activeSessions?.n ?? 0,
      activePlayers24h: activePlayers?.n ?? 0,
      newRegistrations24h: newToday?.n ?? 0,
      newRegistrations7d: newWeek?.n ?? 0,
      totalClicks: agg?.clicks ?? "0",
      totalEarned: agg?.earned ?? "0",
      totalRebirths: agg?.rebirths ?? "0",
      totalGemsHeld: agg?.gems ?? "0",
      petsHatched: petCount?.n ?? 0,
      achievementsUnlocked: achCount?.n ?? 0,
      activeEvents: activeEvents?.n ?? 0,
      bannedAccounts: bannedCount?.n ?? 0,
    },
    series: series.reverse(),
    recentAudit,
    topEnergy,
    health: { database: "ok", dbLatencyMs: dbMs, serverTime: new Date().toISOString() },
  };
}

async function playersList(params: Record<string, unknown>) {
  const q = z.object({ q: z.string().max(64).optional(), page: z.number().int().min(1).default(1) }).parse(params);
  const perPage = 20;
  const where = q.q
    ? or(ilike(users.username, `%${q.q}%`), ilike(users.email, `%${q.q}%`), sql`${users.id}::text = ${q.q}`)
    : undefined;
  const rows = await db
    .select({
      id: users.id, email: users.email, username: users.username, role: users.role,
      createdAt: users.createdAt, lastLoginAt: users.lastLoginAt,
      level: profiles.level, energy: gameStates.energyNum, clicks: gameStates.totalClicks,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(gameStates, eq(gameStates.userId, users.id))
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(perPage)
    .offset((q.page - 1) * perPage);
  const [total] = await db.select({ n: count() }).from(users).where(where);
  return { players: rows, total: total?.n ?? 0, page: q.page, perPage };
}

async function playerDetail(params: Record<string, unknown>) {
  const { id } = z.object({ id: z.string().uuid() }).parse(params);
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw new ActionError("Player not found", 404);
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, id)).limit(1);
  const [state] = await db.select().from(gameStates).where(eq(gameStates.userId, id)).limit(1);
  const ups = await db.select().from(upgradeStates).where(eq(upgradeStates.userId, id));
  const petRows = await db.select().from(pets).where(eq(pets.userId, id)).limit(400);
  const achs = await db.select().from(playerAchievements).where(eq(playerAchievements.userId, id));
  const banRows = await db.select().from(bans).where(eq(bans.userId, id)).orderBy(desc(bans.createdAt)).limit(20);
  const notes = await db.select().from(adminNotes).where(eq(adminNotes.userId, id)).orderBy(desc(adminNotes.createdAt)).limit(50);
  const redems = await db.select({ code: codes.code, at: redemptions.createdAt }).from(redemptions).innerJoin(codes, eq(codes.id, redemptions.codeId)).where(eq(redemptions.userId, id)).orderBy(desc(redemptions.createdAt)).limit(10);
  return {
    user: { id: user.id, email: user.email, username: user.username, role: user.role, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt },
    profile, state: state ? { ...state, unlockedWorlds: state.unlockedWorlds, pity: undefined } : null,
    upgrades: ups,
    pets: petRows.map((p) => ({ ...p, name: petByDefId.get(p.defId)?.name ?? p.defId })),
    achievements: achs.length,
    bans: banRows,
    notes,
    redemptions: redems,
  };
}

/* ------------------------------- Mutations --------------------------------- */

async function grantCurrency(admin: SessionUser, params: Record<string, unknown>, sign: 1 | -1) {
  const p = z.object({ targetId: z.string().uuid(), field: z.enum(CURRENCY_FIELDS), amount: amountSchema, reason: reasonSchema }).parse(params);
  const result = await db.transaction(async (tx) => {
    const [state] = await tx.select().from(gameStates).where(eq(gameStates.userId, p.targetId)).for("update").limit(1);
    if (!state) throw new ActionError("Player has no game state");
    const before = state[p.field] as string | number;
    let after: string;
    if (p.field === "gems") {
      after = String(Math.max(0, Number(before) + sign * Math.min(Math.floor(Number(p.amount)), 1_000_000)));
    } else {
      const next = sign === 1 ? bn(before as string).plus(p.amount) : BigNumber.maximum(bn(before as string).minus(p.amount), 0);
      if (!next.isFinite() || next.gt("1e308")) throw new ActionError("Amount exceeds safe bounds");
      after = next.toFixed(0);
    }
    const patch: Record<string, unknown> = { [p.field]: after, version: state.version + 1 };
    if (p.field === "energy") patch.energyNum = Math.min(Number(after), 1e300);
    await tx.update(gameStates).set(patch).where(eq(gameStates.userId, p.targetId));
    return { before: String(before), after };
  });
  await audit(admin, sign === 1 ? "player.grant_currency" : "player.take_currency", {
    targetType: "user", targetId: p.targetId, reason: p.reason,
    before: { [p.field]: result.before }, after: { [p.field]: result.after },
  });
  return result;
}

async function givePet(admin: SessionUser, params: Record<string, unknown>) {
  const p = z.object({ targetId: z.string().uuid(), defId: z.string(), variant: z.enum(["normal", "golden", "shiny"]).default("normal"), reason: reasonSchema }).parse(params);
  const def = petByDefId.get(p.defId);
  if (!def) throw new ActionError("Unknown pet definition");
  const [row] = await db
    .insert(pets)
    .values({ userId: p.targetId, defId: def.defId, worldId: def.worldId, rarity: def.rarity, variant: p.variant })
    .returning({ id: pets.id });
  await audit(admin, "player.give_pet", { targetType: "user", targetId: p.targetId, reason: p.reason, after: { defId: p.defId, variant: p.variant, petRow: row.id } });
  return { petId: row.id };
}

async function removePet(admin: SessionUser, params: Record<string, unknown>) {
  const p = z.object({ targetId: z.string().uuid(), petId: z.string().uuid(), reason: reasonSchema }).parse(params);
  const [pet] = await db.select().from(pets).where(eq(pets.id, p.petId)).limit(1);
  if (!pet || pet.userId !== p.targetId) throw new ActionError("Pet not found", 404);
  await db.delete(pets).where(eq(pets.id, pet.id));
  await audit(admin, "player.remove_pet", { targetType: "user", targetId: p.targetId, reason: p.reason, before: pet });
  return { removed: pet.id };
}

async function resetProgress(admin: SessionUser, params: Record<string, unknown>) {
  const p = z.object({ targetId: z.string().uuid(), reason: reasonSchema, confirm: z.literal("RESET") }).parse(params);
  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(gameStates).where(eq(gameStates.userId, p.targetId)).for("update").limit(1);
    await tx.update(gameStates).set({
      energy: "0", energyNum: 0, lifetimeEarned: "0", lifetimeEarnedNum: 0, gems: 0,
      shards: "0", cores: "0", prisms: "0", voids: "0", resets: {}, totalClicks: 0,
      combo: 0, bestCombo: 0, world: 1, unlockedWorlds: [1], pity: {}, boosts: [],
      hatchedTotal: 0, secretHatches: 0, upgradesBought: 0, questsClaimed: 0,
      codesRedeemed: 0, playSeconds: 0, version: (before?.version ?? 0) + 1,
    }).where(eq(gameStates.userId, p.targetId));
    await tx.delete(upgradeStates).where(eq(upgradeStates.userId, p.targetId));
    await tx.delete(pets).where(eq(pets.userId, p.targetId));
    await tx.update(profiles).set({ level: 1, dailyStreak: 0, lastDailyDate: null }).where(eq(profiles.userId, p.targetId));
    return before;
  });
  await audit(admin, "player.reset_progress", {
    targetType: "user", targetId: p.targetId, reason: p.reason,
    before: result ? { energy: result.energy, lifetimeEarned: result.lifetimeEarned, totalClicks: result.totalClicks } : null,
    after: { energy: "0" },
  });
  return { reset: true };
}

async function banPlayer(admin: SessionUser, params: Record<string, unknown>) {
  const p = z.object({ targetId: z.string().uuid(), hours: z.coerce.number().min(0).max(24 * 365), reason: reasonSchema }).parse(params);
  const [target] = await db.select().from(users).where(eq(users.id, p.targetId)).limit(1);
  if (!target) throw new ActionError("Player not found", 404);
  if (!canAffectRole(admin.role, target.role)) throw new ActionError("You cannot moderate an account with equal or higher role");
  const expiresAt = p.hours === 0 ? null : new Date(Date.now() + p.hours * 3600_000);
  const [ban] = await db.insert(bans).values({ userId: p.targetId, reason: p.reason, issuedBy: admin.id, expiresAt }).returning({ id: bans.id });
  await db.delete(sessions).where(eq(sessions.userId, p.targetId)); // kick: drop sessions
  await audit(admin, p.hours === 0 ? "moderation.ban_permanent" : "moderation.ban_temporary", {
    targetType: "user", targetId: p.targetId, reason: p.reason, after: { hours: p.hours, expiresAt },
  });
  return { banId: ban.id, expiresAt };
}

async function unbanPlayer(admin: SessionUser, params: Record<string, unknown>) {
  const p = z.object({ targetId: z.string().uuid(), reason: reasonSchema }).parse(params);
  const updated = await db
    .update(bans)
    .set({ revokedAt: new Date(), revokedBy: admin.id })
    .where(and(eq(bans.userId, p.targetId), isNull(bans.revokedAt)))
    .returning({ id: bans.id });
  if (updated.length === 0) throw new ActionError("No active ban found for this player");
  await audit(admin, "moderation.unban", { targetType: "user", targetId: p.targetId, reason: p.reason, after: { revoked: updated.length } });
  return { revoked: updated.length };
}

async function addNote(admin: SessionUser, params: Record<string, unknown>) {
  const p = z.object({ targetId: z.string().uuid(), note: z.string().min(1).max(1000) }).parse(params);
  await db.insert(adminNotes).values({ userId: p.targetId, adminId: admin.id, note: p.note });
  if (admin.role !== "support") await audit(admin, "player.add_note", { targetType: "user", targetId: p.targetId, after: { note: p.note } });
  return { added: true };
}

async function setRole(admin: SessionUser, params: Record<string, unknown>) {
  const p = z.object({ targetId: z.string().uuid(), role: z.enum(["player", "support", "moderator", "admin", "super_admin"] satisfies Role[] as never), reason: reasonSchema }).parse(params);
  if (!canAffectRole(admin.role, p.role)) throw new ActionError("You cannot grant a role equal or above your own");
  const [target] = await db.select().from(users).where(eq(users.id, p.targetId)).limit(1);
  if (!target) throw new ActionError("Player not found", 404);
  if (!canAffectRole(admin.role, target.role)) throw new ActionError("You cannot modify an account with equal or higher role");
  await db.update(users).set({ role: p.role }).where(eq(users.id, p.targetId));
  await audit(admin, "roles.set", { targetType: "user", targetId: p.targetId, reason: p.reason, before: { role: target.role }, after: { role: p.role } });
  return { role: p.role };
}

/* --------------------------- Config with versioning ------------------------ */

const CONFIG_SCHEMAS: Record<string, z.ZodTypeAny> = {
  economy: z.object({
    energyMult: z.number().min(0.1).max(100).optional(),
    petMult: z.number().min(0.1).max(100).optional(),
    priceMult: z.number().min(0.1).max(100).optional(),
    luckBonus: z.number().min(0).max(500).optional(),
  }),
  features: z.object({
    maintenance: z.boolean().optional(),
    disableHatching: z.boolean().optional(),
    disableCodes: z.boolean().optional(),
    disableShop: z.boolean().optional(),
    bannerMessage: z.string().max(200).optional(),
  }),
  content: z.object({
    disabledQuestIds: z.array(z.string()).max(200).optional(),
    disabledPetDefIds: z.array(z.string()).max(500).optional(),
    eggPriceMult: z.number().min(0.1).max(10).optional(),
    eventDefaults: z.record(z.string(), z.any()).optional(),
  }),
};

async function configGet() {
  const rows = await db.select().from(gameConfig);
  const history = await db.select().from(configHistory).orderBy(desc(configHistory.createdAt)).limit(25);
  return { config: rows, history };
}

async function configSet(admin: SessionUser, params: Record<string, unknown>) {
  const p = z.object({ key: z.enum(["economy", "features", "content"]), value: z.unknown(), reason: reasonSchema }).parse(params);
  const schema = CONFIG_SCHEMAS[p.key];
  const parsed = schema.parse(p.value); // throws ZodError with details
  const prevRows = await db.select().from(gameConfig).where(eq(gameConfig.key, p.key)).limit(1);
  const prev = prevRows[0];
  const version = (prev?.version ?? 0) + 1;
  await db
    .insert(gameConfig)
    .values({ key: p.key, value: parsed, version, updatedBy: admin.id })
    .onConflictDoUpdate({ target: gameConfig.key, set: { value: parsed, version, updatedBy: admin.id, updatedAt: new Date() } });
  await db.insert(configHistory).values({ key: p.key, value: parsed, version, createdBy: admin.id });
  await audit(admin, `config.set.${p.key}`, { reason: p.reason, before: prev?.value ?? null, after: parsed });
  return { key: p.key, version };
}

async function configRollback(admin: SessionUser, params: Record<string, unknown>) {
  const p = z.object({ key: z.enum(["economy", "features", "content"]), reason: reasonSchema }).parse(params);
  const hist = await db.select().from(configHistory).where(eq(configHistory.key, p.key)).orderBy(desc(configHistory.createdAt)).limit(2);
  if (hist.length < 2) throw new ActionError("No earlier version to roll back to");
  const target = hist[1];
  await db
    .insert(gameConfig)
    .values({ key: p.key, value: target.value, version: target.version + 100, updatedBy: admin.id })
    .onConflictDoUpdate({ target: gameConfig.key, set: { value: target.value, version: target.version + 100, updatedBy: admin.id, updatedAt: new Date() } });
  await db.insert(configHistory).values({ key: p.key, value: target.value, version: target.version + 100, createdBy: admin.id });
  await audit(admin, `config.rollback.${p.key}`, { reason: p.reason, after: target.value });
  return { key: p.key, rolledBackTo: target.version };
}

/* --------------------------------- Events ---------------------------------- */

async function eventsList() {
  return db.select().from(events).orderBy(desc(events.startsAt)).limit(100);
}

async function eventCreate(admin: SessionUser, params: Record<string, unknown>) {
  const p = z.object({
    kind: z.string().min(2).max(40),
    title: z.string().min(3).max(80),
    description: z.string().max(500).default(""),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    energyMult: z.number().min(1).max(100).optional(),
    clickMult: z.number().min(1).max(100).optional(),
    luckBonus: z.number().min(0).max(500).optional(),
  }).parse(params);
  const start = new Date(p.startsAt);
  const end = new Date(p.endsAt);
  if (end <= start) throw new ActionError("End time must be after start time");
  if (end.getTime() - start.getTime() > 30 * 86400_000) throw new ActionError("Events are capped at 30 days");
  const paramObj: Record<string, number> = {};
  if (p.energyMult) paramObj.energyMult = p.energyMult;
  if (p.clickMult) paramObj.clickMult = p.clickMult;
  if (p.luckBonus) paramObj.luckBonus = p.luckBonus;
  const [row] = await db
    .insert(events)
    .values({ kind: p.kind, title: p.title, description: p.description, startsAt: start, endsAt: end, params: paramObj, createdBy: admin.id })
    .returning({ id: events.id });
  await audit(admin, "event.create", { targetType: "event", targetId: row.id, after: { kind: p.kind, title: p.title, startsAt: start, endsAt: end, params: paramObj } });
  return { id: row.id };
}

async function eventSetStatus(admin: SessionUser, params: Record<string, unknown>, status: "active" | "ended" | "cancelled" | "scheduled") {
  const p = z.object({ id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(params);
  const [ev] = await db.select().from(events).where(eq(events.id, p.id)).limit(1);
  if (!ev) throw new ActionError("Event not found", 404);
  const patch: Record<string, unknown> = { status };
  if (status === "ended" || status === "cancelled") patch.endsAt = new Date();
  await db.update(events).set(patch).where(eq(events.id, p.id));
  await audit(admin, `event.${status === "active" ? "start" : status === "ended" ? "stop" : status}`, {
    targetType: "event", targetId: p.id, reason: p.reason, before: { status: ev.status }, after: { status },
  });
  return { id: p.id, status };
}

async function eventDelete(admin: SessionUser, params: Record<string, unknown>) {
  const p = z.object({ id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(params);
  await db.delete(events).where(eq(events.id, p.id));
  await audit(admin, "event.delete", { targetType: "event", targetId: p.id, reason: p.reason });
  return { deleted: p.id };
}

/* ---------------------------------- Codes ---------------------------------- */

async function codesList() {
  const rows = await db.select().from(codes).orderBy(desc(codes.createdAt)).limit(200);
  return rows;
}

async function codeCreate(admin: SessionUser, params: Record<string, unknown>) {
  const p = z.object({
    code: z.string().min(3).max(32).regex(/^[A-Z0-9_-]+$/i, "Letters, numbers, - and _ only"),
    energy: amountSchema.optional(),
    gems: z.coerce.number().int().min(0).max(100000).optional(),
    shards: amountSchema.optional(),
    maxRedemptions: z.coerce.number().int().min(0).max(1_000_000).default(0),
    expiresAt: z.string().datetime().optional(),
  }).parse(params);
  const reward: Record<string, unknown> = {};
  if (p.energy) reward.energy = p.energy;
  if (p.gems) reward.gems = p.gems;
  if (p.shards) reward.shards = p.shards;
  if (Object.keys(reward).length === 0) throw new ActionError("Give the code at least one reward");
  const clean = p.code.toUpperCase();
  const existing = await db.select().from(codes).where(eq(codes.code, clean)).limit(1);
  if (existing.length > 0) throw new ActionError("A code with this name already exists");
  const [row] = await db
    .insert(codes)
    .values({ code: clean, reward, maxRedemptions: p.maxRedemptions, expiresAt: p.expiresAt ? new Date(p.expiresAt) : null, createdBy: admin.id })
    .returning({ id: codes.id });
  await audit(admin, "code.create", { targetType: "code", targetId: row.id, after: { code: clean, reward, maxRedemptions: p.maxRedemptions } });
  return { id: row.id, code: clean };
}

async function codeToggle(admin: SessionUser, params: Record<string, unknown>) {
  const p = z.object({ id: z.string().uuid(), active: z.boolean(), reason: z.string().max(300).optional() }).parse(params);
  const [row] = await db.select().from(codes).where(eq(codes.id, p.id)).limit(1);
  if (!row) throw new ActionError("Code not found", 404);
  await db.update(codes).set({ active: p.active }).where(eq(codes.id, p.id));
  await audit(admin, p.active ? "code.enable" : "code.disable", { targetType: "code", targetId: p.id, reason: p.reason, before: { active: row.active }, after: { active: p.active } });
  return { id: p.id, active: p.active };
}

async function codeRedemptions(params: Record<string, unknown>) {
  const p = z.object({ id: z.string().uuid() }).parse(params);
  const rows = await db
    .select({ username: users.username, at: redemptions.createdAt })
    .from(redemptions)
    .innerJoin(users, eq(users.id, redemptions.userId))
    .where(eq(redemptions.codeId, p.id))
    .orderBy(desc(redemptions.createdAt))
    .limit(200);
  return rows;
}

/* ------------------------------- Moderation -------------------------------- */

async function moderationList(params: Record<string, unknown>) {
  const p = z.object({ page: z.number().int().min(1).default(1), active: z.boolean().default(true) }).parse(params);
  const perPage = 20;
  const where = p.active ? and(isNull(bans.revokedAt), or(isNull(bans.expiresAt), gt(bans.expiresAt, new Date()))) : undefined;
  const rows = await db
    .select({ id: bans.id, userId: bans.userId, username: users.username, reason: bans.reason, expiresAt: bans.expiresAt, createdAt: bans.createdAt, revokedAt: bans.revokedAt, issuedBy: bans.issuedBy })
    .from(bans)
    .innerJoin(users, eq(users.id, bans.userId))
    .where(where)
    .orderBy(desc(bans.createdAt))
    .limit(perPage)
    .offset((p.page - 1) * perPage);
  return { cases: rows, page: p.page };
}

/* -------------------------------- Audit logs ------------------------------- */

async function auditList(params: Record<string, unknown>) {
  const p = z.object({
    page: z.number().int().min(1).default(1),
    action: z.string().max(60).optional(),
    admin: z.string().max(40).optional(),
    target: z.string().max(64).optional(),
  }).parse(params);
  const perPage = 25;
  const where = and(
    p.action ? ilike(auditLogs.action, `%${p.action}%`) : undefined,
    p.admin ? ilike(auditLogs.adminName, `%${p.admin}%`) : undefined,
    p.target ? ilike(auditLogs.targetId, `%${p.target}%`) : undefined,
  );
  const rows = await db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(perPage).offset((p.page - 1) * perPage);
  const [total] = await db.select({ n: count() }).from(auditLogs).where(where);
  return { logs: rows, total: total?.n ?? 0, page: p.page };
}

/* ------------------------------- Announcement ------------------------------ */

async function announce(admin: SessionUser, params: Record<string, unknown>) {
  const p = z.object({ message: z.string().min(3).max(240) }).parse(params);
  await db.insert(announcements).values({ message: p.message, createdBy: admin.id });
  await audit(admin, "announce.create", { after: { message: p.message } });
  return { announced: true };
}

/* ------------------------------ Command console ---------------------------- */

export const CONSOLE_HELP = [
  "/help — list commands",
  "/player <username|id> — open player summary",
  "/give <username|id> <currency> <amount> <reason>",
  "/take <username|id> <currency> <amount> <reason>",
  "/pet give <username|id> <defId> [variant] <reason>",
  "/event start|stop <eventId>",
  "/announce <message>",
  "/ban <username|id> <hours|0=perm> <reason>",
  "/unban <username|id> <reason>",
  "/logs — recent audit entries",
  "/config validate — validate current config drafts",
];

async function findUserRef(ref: string) {
  const rows = await db
    .select({ id: users.id, username: users.username, role: users.role })
    .from(users)
    .where(z.string().uuid().safeParse(ref).success ? eq(users.id, ref) : ilike(users.username, ref))
    .limit(1);
  if (!rows[0]) throw new ActionError(`No player found for "${ref}"`);
  return rows[0];
}

async function consoleRun(admin: SessionUser, params: Record<string, unknown>): Promise<unknown> {
  const { line } = z.object({ line: z.string().min(1).max(500) }).parse(params);
  const parts = line.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();

  switch (cmd) {
    case "/help":
      return { help: CONSOLE_HELP };
    case "/player": {
      const u = await findUserRef(parts[1] ?? "");
      return playerDetail({ id: u.id });
    }
    case "/give":
    case "/take": {
      const [, ref, field, amount, ...reasonParts] = parts;
      const u = await findUserRef(ref);
      return grantCurrency(admin, { targetId: u.id, field, amount, reason: reasonParts.join(" ") || "console" }, cmd === "/give" ? 1 : -1);
    }
    case "/pet": {
      if (parts[1] !== "give") throw new ActionError("Usage: /pet give <user> <defId> [variant] <reason>");
      const [, , ref, defId, variantOrReason, ...rest] = parts;
      const u = await findUserRef(ref);
      const variant = ["normal", "golden", "shiny"].includes(variantOrReason ?? "") ? variantOrReason : "normal";
      const reason = ["normal", "golden", "shiny"].includes(variantOrReason ?? "") ? rest.join(" ") : [variantOrReason, ...rest].join(" ");
      return givePet(admin, { targetId: u.id, defId, variant: variant as "normal", reason: reason || "console" });
    }
    case "/event": {
      const sub = parts[1];
      const id = parts[2];
      if (sub === "start") return eventSetStatus(admin, { id, reason: "console" }, "active");
      if (sub === "stop") return eventSetStatus(admin, { id, reason: "console" }, "ended");
      throw new ActionError("Usage: /event start|stop <eventId>");
    }
    case "/announce":
      return announce(admin, { message: parts.slice(1).join(" ") });
    case "/ban": {
      const [, ref, hours, ...reasonParts] = parts;
      const u = await findUserRef(ref);
      return banPlayer(admin, { targetId: u.id, hours: Number(hours), reason: reasonParts.join(" ") || "console" });
    }
    case "/unban": {
      const [, ref, ...reasonParts] = parts;
      const u = await findUserRef(ref);
      return unbanPlayer(admin, { targetId: u.id, reason: reasonParts.join(" ") || "console" });
    }
    case "/logs":
      return auditList({ page: 1 });
    case "/config": {
      if (parts[1] === "validate") {
        const rows = await db.select().from(gameConfig);
        const results = rows.map((r) => {
          const schema = CONFIG_SCHEMAS[r.key];
          const res = schema ? schema.safeParse(r.value) : { success: true as const };
          return { key: r.key, version: r.version, valid: res.success };
        });
        return { results };
      }
      throw new ActionError("Usage: /config validate");
    }
    default:
      throw new ActionError(`Unknown command "${cmd}". Try /help`);
  }
}

/* ------------------------------- Dispatcher -------------------------------- */

interface ActionDef {
  perm: Perm;
  handler: (admin: SessionUser, params: Record<string, unknown>) => Promise<unknown>;
  mutation?: boolean;
}

const ACTIONS: Record<string, ActionDef> = {
  overview: { perm: "metrics.view", handler: async (_a) => overview() },
  "players.list": { perm: "players.view", handler: async (_a, p) => playersList(p) },
  "players.get": { perm: "players.view", handler: async (_a, p) => playerDetail(p) },
  "players.grantCurrency": { perm: "players.grant", handler: async (a, p) => grantCurrency(a, p, 1), mutation: true },
  "players.takeCurrency": { perm: "players.grant", handler: async (a, p) => grantCurrency(a, p, -1), mutation: true },
  "players.givePet": { perm: "content.manage", handler: givePet, mutation: true },
  "players.removePet": { perm: "content.manage", handler: removePet, mutation: true },
  "players.resetProgress": { perm: "players.edit", handler: resetProgress, mutation: true },
  "players.ban": { perm: "moderation.manage", handler: banPlayer, mutation: true },
  "players.unban": { perm: "moderation.manage", handler: unbanPlayer, mutation: true },
  "players.note": { perm: "players.view", handler: addNote, mutation: true },
  "players.setRole": { perm: "roles.manage", handler: setRole, mutation: true },
  "pets.catalog": { perm: "content.manage", handler: async () => PETS.map((p) => ({ ...p, variantMult: VARIANT_MULT })) },
  "config.get": { perm: "config.manage", handler: configGet },
  "config.set": { perm: "config.manage", handler: configSet, mutation: true },
  "config.rollback": { perm: "config.manage", handler: configRollback, mutation: true },
  "economy.get": { perm: "economy.manage", handler: configGet },
  "events.list": { perm: "events.manage", handler: eventsList },
  "events.create": { perm: "events.manage", handler: eventCreate, mutation: true },
  "events.start": { perm: "events.manage", handler: (a, p) => eventSetStatus(a, p, "active"), mutation: true },
  "events.stop": { perm: "events.manage", handler: (a, p) => eventSetStatus(a, p, "ended"), mutation: true },
  "events.delete": { perm: "events.manage", handler: eventDelete, mutation: true },
  "codes.list": { perm: "codes.manage", handler: codesList },
  "codes.create": { perm: "codes.manage", handler: codeCreate, mutation: true },
  "codes.toggle": { perm: "codes.manage", handler: codeToggle, mutation: true },
  "codes.redemptions": { perm: "codes.manage", handler: (_a, p) => codeRedemptions(p) },
  "moderation.list": { perm: "moderation.manage", handler: (_a, p) => moderationList(p) },
  "audit.list": { perm: "logs.view", handler: (_a, p) => auditList(p) },
  "announce": { perm: "events.manage", handler: announce, mutation: true },
  "console.run": { perm: "console.use", handler: consoleRun, mutation: true },
};

export async function runAdminAction(admin: SessionUser, action: string, params: Record<string, unknown>) {
  const def = ACTIONS[action];
  if (!def) throw new ActionError(`Unknown admin action "${action}"`, 404);
  if (!hasPerm(admin.role, def.perm)) {
    await audit(admin, `denied.${action}`, { result: "denied", reason: `Missing permission: ${def.perm}` }).catch(() => {});
    throw new AuthError("You do not have permission for this action", 403);
  }
  return def.handler(admin, params ?? {});
}
