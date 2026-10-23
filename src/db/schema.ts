import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
  doublePrecision,
} from "drizzle-orm/pg-core";

/* ----------------------------- Auth / Accounts ---------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("player"), // player | support | moderator | admin | super_admin | owner
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email), uniqueIndex("users_username_key").on(t.username)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("sessions_token_key").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

/* ------------------------------ Player data ------------------------------- */

export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title"),
  avatarSeed: text("avatar_seed").notNull().default("nova"),
  level: integer("level").notNull().default(1),
  lastDailyDate: text("last_daily_date"), // yyyy-mm-dd UTC
  dailyStreak: integer("daily_streak").notNull().default(0),
  settings: jsonb("settings").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameStates = pgTable(
  "game_states",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    energy: text("energy").notNull().default("0"),
    lifetimeEarned: text("lifetime_earned").notNull().default("0"),
    // Approximate numeric shadows for indexed leaderboard ordering
    energyNum: doublePrecision("energy_num").notNull().default(0),
    lifetimeEarnedNum: doublePrecision("lifetime_earned_num").notNull().default(0),
    gems: integer("gems").notNull().default(0),
    shards: text("shards").notNull().default("0"),
    cores: text("cores").notNull().default("0"),
    prisms: text("prisms").notNull().default("0"),
    voids: text("voids").notNull().default("0"),
    resets: jsonb("resets").notNull().default({}), // { rebirth: n, prestige: n, ascension: n, galaxy: n }
    totalClicks: bigint("total_clicks", { mode: "number" }).notNull().default(0),
    combo: integer("combo").notNull().default(0),
    bestCombo: integer("best_combo").notNull().default(0),
    lastClickAt: timestamp("last_click_at", { withTimezone: true }),
    world: integer("world").notNull().default(1),
    unlockedWorlds: jsonb("unlocked_worlds").notNull().default([1]),
    pity: jsonb("pity").notNull().default({}),
    boosts: jsonb("boosts").notNull().default([]), // [{id,name,mult,expiresAt}]
    hatchedTotal: integer("hatched_total").notNull().default(0),
    secretHatches: integer("secret_hatches").notNull().default(0),
    upgradesBought: integer("upgrades_bought").notNull().default(0),
    questsClaimed: integer("quests_claimed").notNull().default(0),
    codesRedeemed: integer("codes_redeemed").notNull().default(0),
    playSeconds: integer("play_seconds").notNull().default(0),
    lastSavedAt: timestamp("last_saved_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(0),
  },
  (t) => [
    index("states_clicks_idx").on(t.totalClicks),
    index("states_lifetime_idx").on(t.lifetimeEarnedNum),
  ],
);

export const upgradeStates = pgTable(
  "upgrade_states",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    upgradeId: text("upgrade_id").notNull(),
    level: integer("level").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.upgradeId] })],
);

export const pets = pgTable(
  "pets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    defId: text("def_id").notNull(),
    worldId: integer("world_id").notNull(),
    rarity: text("rarity").notNull(),
    variant: text("variant").notNull().default("normal"), // normal | golden | shiny
    equipped: boolean("equipped").notNull().default(false),
    favorite: boolean("favorite").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pets_user_idx").on(t.userId)],
);

export const batchKeys = pgTable("batch_keys", {
  key: text("key").primaryKey(),
  userId: uuid("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playerQuests = pgTable(
  "player_quests",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questId: text("quest_id").notNull(),
    period: text("period").notNull(), // e.g. "2026-01-01" (daily), "2026-W01" (weekly), "all"
    progress: text("progress").notNull().default("0"),
    claimed: boolean("claimed").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.questId, t.period] })],
);

export const playerAchievements = pgTable(
  "player_achievements",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id").notNull(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.achievementId] })],
);

/* ------------------------------- Live ops --------------------------------- */

export const codes = pgTable(
  "codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    reward: jsonb("reward").notNull(), // {energy?, gems?, shards?, boost?}
    maxRedemptions: integer("max_redemptions").notNull().default(0), // 0 = unlimited
    redemptionCount: integer("redemption_count").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("codes_code_key").on(t.code)],
);

export const redemptions = pgTable(
  "redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    codeId: uuid("code_id")
      .notNull()
      .references(() => codes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("redemptions_code_user_key").on(t.codeId, t.userId), index("redemptions_user_idx").on(t.userId)],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").notNull(), // double-energy | triple-clicks | super-luck | golden-hour | ...
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    params: jsonb("params").notNull().default({}), // {energyMult, clickMult, luckBonus}
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("scheduled"), // scheduled | active | ended | cancelled
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_window_idx").on(t.startsAt, t.endsAt)],
);

export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  message: text("message").notNull(),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ----------------------------- Administration ----------------------------- */

export const bans = pgTable(
  "bans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    issuedBy: uuid("issued_by"),
    expiresAt: timestamp("expires_at", { withTimezone: true }), // null = permanent
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bans_user_idx").on(t.userId)],
);

export const adminNotes = pgTable(
  "admin_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    adminId: uuid("admin_id"),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notes_user_idx").on(t.userId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminId: uuid("admin_id"),
    adminName: text("admin_name"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    reason: text("reason"),
    before: jsonb("before"),
    after: jsonb("after"),
    result: text("result").notNull().default("ok"),
    requestId: text("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt), index("audit_admin_idx").on(t.adminId)],
);

export const gameConfig = pgTable("game_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  version: integer("version").notNull().default(1),
  updatedBy: uuid("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const configHistory = pgTable("config_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  version: integer("version").notNull(),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------- Metrics --------------------------------- */

export const metricsDaily = pgTable("metrics_daily", {
  day: text("day").primaryKey(), // yyyy-mm-dd UTC
  clicks: bigint("clicks", { mode: "number" }).notNull().default(0),
  registrations: integer("registrations").notNull().default(0),
  hatches: integer("hatches").notNull().default(0),
  rebirths: integer("rebirths").notNull().default(0),
  energyEarned: text("energy_earned").notNull().default("0"),
});

export const shopOrders = pgTable(
  "shop_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    costGems: integer("cost_gems").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("orders_user_idx").on(t.userId)],
);
