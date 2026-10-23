/* ============================================================================
   NEXORA — INFINITE CLICKER · Game content configuration
   Single source of truth for upgrades, worlds, pets, eggs, resets, quests,
   achievements, shop items, daily rewards and event kinds.
   Pure data + pure functions only — safe to import from client bundles.
============================================================================ */

import { BigNumber, bn, fmt } from "@/lib/num";

/* ------------------------------- Rarities --------------------------------- */

export interface RarityDef {
  id: string;
  name: string;
  weight: number; // hatch probability %
  color: string;
  glow: string;
  pct: number; // base multiplier percentage contribution (world 1)
}

export const RARITIES: RarityDef[] = [
  { id: "common", name: "Common", weight: 40, color: "#9aa7b8", glow: "rgba(154,167,184,.35)", pct: 50 },
  { id: "uncommon", name: "Uncommon", weight: 25, color: "#4ade80", glow: "rgba(74,222,128,.35)", pct: 120 },
  { id: "rare", name: "Rare", weight: 15, color: "#38bdf8", glow: "rgba(56,189,248,.4)", pct: 300 },
  { id: "epic", name: "Epic", weight: 10, color: "#a78bfa", glow: "rgba(167,139,250,.45)", pct: 800 },
  { id: "legendary", name: "Legendary", weight: 6, color: "#f59e0b", glow: "rgba(245,158,11,.5)", pct: 2500 },
  { id: "mythic", name: "Mythic", weight: 2.5, color: "#fb7185", glow: "rgba(251,113,133,.5)", pct: 9000 },
  { id: "celestial", name: "Celestial", weight: 1.1, color: "#67e8f9", glow: "rgba(103,232,249,.55)", pct: 45000 },
  { id: "secret", name: "Secret", weight: 0.4, color: "#f0abfc", glow: "rgba(240,171,252,.6)", pct: 300000 },
];

export const rarityIndex = (id: string) => Math.max(0, RARITIES.findIndex((r) => r.id === id));

/** Weights must always total 100% — enforced by unit tests. */
export const totalWeight = () => RARITIES.reduce((a, r) => a + r.weight, 0);

export const PITY_THRESHOLD = 75; // hatches without Legendary+ guarantee one
export const GOLDEN_CHANCE = 0.03;
export const SHINY_CHANCE = 0.01;
export const VARIANT_MULT: Record<string, number> = { normal: 1, golden: 5, shiny: 10 };
export const BASE_MAX_EQUIPPED = 3;
export const BASE_INVENTORY_CAP = 120;
export const MAX_EQUIPPED_EXTRA = 3; // purchasable

/* --------------------------------- Worlds ---------------------------------- */

export interface WorldDef {
  id: number;
  name: string;
  tagline: string;
  unlockCost: string;
  eggCost: string;
  bonusPct: number; // global gain bonus while any world ≤ this unlocked
  theme: { from: string; via: string; to: string; accent: string };
  pets: string[]; // 8 pet names in rarity order
}

export const WORLDS: WorldDef[] = [
  {
    id: 1, name: "Neon District", tagline: "Where the grid first hums", unlockCost: "0", eggCost: "1000", bonusPct: 0,
    theme: { from: "#0b1026", via: "#131a3a", to: "#1b1040", accent: "#22d3ee" },
    pets: ["Circuit Rat", "Holo Pigeon", "Neon Fox", "Chrome Panther", "Voltage Dragon", "Prism Wyvern", "Aurora Seraph", "Glitch Wraith"],
  },
  {
    id: 2, name: "Crystal Forest", tagline: "Refractions of ancient light", unlockCost: "50000", eggCost: "25000", bonusPct: 25,
    theme: { from: "#081a1f", via: "#0b2a33", to: "#123c36", accent: "#6ee7b7" },
    pets: ["Quartz Sprout", "Gem Toad", "Shard Owl", "Crystal Stag", "Amethyst Golem", "Opal Phoenix", "Diamond Kirin", "Prismatic Eternal"],
  },
  {
    id: 3, name: "Inferno Core", tagline: "Pressure makes stars", unlockCost: "2500000", eggCost: "600000", bonusPct: 60,
    theme: { from: "#1c0906", via: "#33100a", to: "#4a1508", accent: "#fb923c" },
    pets: ["Ember Imp", "Lava Slug", "Blaze Hound", "Magma Tortoise", "Inferno Drake", "Cinder Reaper", "Solar Ifrit", "Obsidian Titan"],
  },
  {
    id: 4, name: "Cyber City", tagline: "A skyline of pure signal", unlockCost: "100000000", eggCost: "15000000", bonusPct: 120,
    theme: { from: "#100a26", via: "#1e1347", to: "#2a0f4d", accent: "#e879f9" },
    pets: ["Data Sprite", "Drone Bee", "Mecha Cat", "Cyber Ninja", "Quantum AI", "Neon Samurai", "Chrome Overlord", "Singularity Core"],
  },
  {
    id: 5, name: "Frozen Dimension", tagline: "Time moves slower here", unlockCost: "5000000000", eggCost: "400000000", bonusPct: 250,
    theme: { from: "#061626", via: "#0a2540", to: "#0e3358", accent: "#7dd3fc" },
    pets: ["Snow Bit", "Ice Hare", "Frost Wolf", "Glacier Bear", "Blizzard Roc", "Permafrost Golem", "Aurora Valkyrie", "Absolute Zero"],
  },
  {
    id: 6, name: "Astral Kingdom", tagline: "Crown of the wandering stars", unlockCost: "250000000000", eggCost: "12000000000", bonusPct: 500,
    theme: { from: "#0d0b2a", via: "#1a1448", to: "#251d63", accent: "#a5b4fc" },
    pets: ["Star Mote", "Comet Pup", "Moon Rabbit", "Nova Lion", "Celestial Whale", "Galaxy Serpent", "Astral Emperor", "Nebula Deity"],
  },
  {
    id: 7, name: "Void Realm", tagline: "Listen to the silence", unlockCost: "1e13", eggCost: "3e11", bonusPct: 1000,
    theme: { from: "#050208", via: "#12081c", to: "#1d0b2e", accent: "#c084fc" },
    pets: ["Void Mite", "Shadow Bat", "Abyss Eel", "Null Golem", "Eclipse Dragon", "Void Reaver", "Entropy Lord", "Event Horizon"],
  },
  {
    id: 8, name: "Quantum Galaxy", tagline: "Every outcome at once", unlockCost: "5e14", eggCost: "8e12", bonusPct: 2200,
    theme: { from: "#02131a", via: "#052838", to: "#08364c", accent: "#2dd4bf" },
    pets: ["Quark", "Photon Finch", "Plasma Orb", "Tachyon Hawk", "Quasar Beast", "Dark Matter Rex", "Quantum Leviathan", "Omniverse Eye"],
  },
  {
    id: 9, name: "Celestial Empire", tagline: "Thrones beyond the veil", unlockCost: "2.5e16", eggCost: "2e14", bonusPct: 5000,
    theme: { from: "#1a1405", via: "#33260b", to: "#4d3a12", accent: "#fbbf24" },
    pets: ["Halo Chick", "Seraph Pup", "Archon Steed", "Dominion Griffin", "Virtue Unicorn", "Throne Archangel", "Empyrean Sovereign", "The Radiance"],
  },
  {
    id: 10, name: "Infinite Nexus", tagline: "The center of everything", unlockCost: "1e18", eggCost: "5e15", bonusPct: 12000,
    theme: { from: "#12041f", via: "#26093f", to: "#3a1160", accent: "#f0abfc" },
    pets: ["Nexus Bit", "Loop Runner", "Fractal Fox", "Paradox Owl", "Infinity Wyrm", "Eternity Weaver", "Nexus Architect", "The One"],
  },
];

export interface PetDef {
  defId: string;
  name: string;
  worldId: number;
  rarityIdx: number;
  rarity: string;
  pct: number; // percentage boost at normal variant
}

export const PETS: PetDef[] = WORLDS.flatMap((w) =>
  w.pets.map((name, i) => ({
    defId: `w${w.id}p${i}`,
    name,
    worldId: w.id,
    rarityIdx: i,
    rarity: RARITIES[i].id,
    pct: Math.round(RARITIES[i].pct * (1 + (w.id - 1) * 0.9)),
  })),
);

export const petByDefId = new Map(PETS.map((p) => [p.defId, p]));
export const worldById = new Map(WORLDS.map((w) => [w.id, w]));

/* -------------------------------- Upgrades --------------------------------- */

export type UpgradeCategory =
  | "click"
  | "automation"
  | "critical"
  | "passive"
  | "multiplier"
  | "luck"
  | "combo"
  | "pets"
  | "rebirth"
  | "offline"
  | "special";

export interface UpgradeDef {
  id: string;
  name: string;
  category: UpgradeCategory;
  description: string;
  baseCost: string;
  growth: number;
  maxLevel: number;
  effectText: (level: number) => string;
}

export const UPGRADES: UpgradeDef[] = [
  { id: "tap-core", name: "Tap Core", category: "click", description: "Reinforces your cursor with condensed neon. +1 base click power per level.", baseCost: "15", growth: 1.15, maxLevel: 10000, effectText: (l) => `+${l} base click power` },
  { id: "auto-clicker", name: "Auto Clicker", category: "automation", description: "A loyal micro-drone clicks for you. +1 auto click per second per level.", baseCost: "100", growth: 1.18, maxLevel: 5000, effectText: (l) => `+${l}/s auto clicks` },
  { id: "crit-chance", name: "Critical Matrix", category: "critical", description: "Overclocks probability itself. +1% critical chance per level.", baseCost: "250", growth: 1.35, maxLevel: 40, effectText: (l) => `${5 + l}% crit chance` },
  { id: "crit-power", name: "Critical Amplifier", category: "critical", description: "Critical hits strike even harder. +0.5× crit multiplier per level.", baseCost: "500", growth: 1.4, maxLevel: 200, effectText: (l) => `×${(5 + l * 0.5).toFixed(1)} crit damage` },
  { id: "passive-amp", name: "Passive Amplifier", category: "passive", description: "Harvest ambient grid energy. +5 energy/s per level.", baseCost: "300", growth: 1.22, maxLevel: 5000, effectText: (l) => `+${5 * l}/s base passive` },
  { id: "energy-matrix", name: "Energy Matrix", category: "multiplier", description: "A lattice that magnifies every gain. +10% all energy per level.", baseCost: "1000", growth: 1.6, maxLevel: 500, effectText: (l) => `+${10 * l}% all gains` },
  { id: "luck-core", name: "Luck Core", category: "luck", description: "Bends fortune toward rarer finds. +2 luck per level.", baseCost: "2000", growth: 1.5, maxLevel: 100, effectText: (l) => `+${2 * l} luck` },
  { id: "combo-drive", name: "Combo Drive", category: "combo", description: "Chains resonate further. Stronger and longer combo bonus per level.", baseCost: "750", growth: 1.3, maxLevel: 300, effectText: (l) => `+${(5 * l).toFixed(0)}% max combo bonus` },
  { id: "pet-amplifier", name: "Pet Amplifier", category: "pets", description: "Your companions sync with your grid. +10% pet power per level.", baseCost: "1500", growth: 1.45, maxLevel: 300, effectText: (l) => `+${10 * l}% pet power` },
  { id: "neon-resonance", name: "Neon Resonance", category: "rebirth", description: "Echoes persist through rebirth. +5% shard gain per level.", baseCost: "50000", growth: 1.8, maxLevel: 100, effectText: (l) => `+${5 * l}% shards` },
  { id: "offline-capacitor", name: "Offline Capacitor", category: "offline", description: "Stores energy while you are away. +1h offline cap per level.", baseCost: "400", growth: 1.5, maxLevel: 23, effectText: (l) => `${1 + l}h offline cap` },
  { id: "overclock-efficiency", name: "Overclock Efficiency", category: "special", description: "Boosts last 25% longer per level.", baseCost: "25000", growth: 2.0, maxLevel: 20, effectText: (l) => `+${25 * l}% boost duration` },
];

export const upgradeById = new Map(UPGRADES.map((u) => [u.id, u]));

/* --------------------------------- Resets ---------------------------------- */

export interface ResetTier {
  id: string;
  name: string;
  currency: string;
  currencyField: "shards" | "cores" | "prisms" | "voids";
  color: string;
  threshold: string; // lifetime earned needed for first reset
  scaleBase: number; // threshold multiplier per owned reset count
  minPrevResets: number; // required count of previous tier resets
  multPerUnit: number; // +X% global per currency unit
  desc: string;
}

export const RESET_TIERS: ResetTier[] = [
  { id: "rebirth", name: "Rebirth", currency: "Neon Shards", currencyField: "shards", color: "#22d3ee", threshold: "1e6", scaleBase: 8, minPrevResets: 0, multPerUnit: 5, desc: "Reset energy & upgrades. Keep pets, worlds and achievements. Gain Neon Shards: each grants +5% all gains, forever." },
  { id: "prestige", name: "Prestige", currency: "Star Cores", currencyField: "cores", color: "#a78bfa", threshold: "1e12", scaleBase: 16, minPrevResets: 3, multPerUnit: 25, desc: "A deeper reset: also clears shards and rebirth count. Requires 3 rebirths. Star Cores grant +25% each." },
  { id: "ascension", name: "Ascension", currency: "Void Prisms", currencyField: "prisms", color: "#f472b6", threshold: "1e24", scaleBase: 32, minPrevResets: 2, multPerUnit: 150, desc: "Transcend the grid. Requires 2 prestiges. Clears cores and prestige count. Prisms grant +150% each." },
  { id: "galaxy", name: "Galaxy Reset", currency: "Nova Voids", currencyField: "voids", color: "#fbbf24", threshold: "1e40", scaleBase: 64, minPrevResets: 2, multPerUnit: 1000, desc: "Collapse a galaxy into pure potential. Requires 2 ascensions. Voids grant +1000% each." },
];

/* --------------------------------- Quests ---------------------------------- */

export type QuestMetric = "clicks" | "earned" | "hatches" | "upgrades" | "rebirths" | "pets";

export interface QuestDef {
  id: string;
  name: string;
  desc: string;
  metric: QuestMetric;
  base: number; // target at level 1
  perLevel: number; // multiplicative scaling per account level
  rewardGems: number;
  rewardShards: number;
  pool: "daily" | "weekly";
}

export const DAILY_QUESTS: QuestDef[] = [
  { id: "d-clicks", name: "Grid Tapper", desc: "Click the core {t} times", metric: "clicks", base: 300, perLevel: 0.25, rewardGems: 8, rewardShards: 0, pool: "daily" },
  { id: "d-earn", name: "Energy Harvest", desc: "Earn {t} energy from clicks", metric: "earned", base: 5000, perLevel: 0.5, rewardGems: 10, rewardShards: 0, pool: "daily" },
  { id: "d-hatch", name: "Egg Hunt", desc: "Hatch {t} eggs", metric: "hatches", base: 2, perLevel: 0.1, rewardGems: 12, rewardShards: 0, pool: "daily" },
  { id: "d-upgrade", name: "Self Improvement", desc: "Buy {t} upgrade levels", metric: "upgrades", base: 5, perLevel: 0.15, rewardGems: 8, rewardShards: 0, pool: "daily" },
  { id: "d-clicks2", name: "Momentum", desc: "Click the core {t} times", metric: "clicks", base: 1200, perLevel: 0.25, rewardGems: 14, rewardShards: 1, pool: "daily" },
  { id: "d-pets", name: "Collector's Eye", desc: "Own {t} pets", metric: "pets", base: 3, perLevel: 0.2, rewardGems: 10, rewardShards: 0, pool: "daily" },
  { id: "d-earn2", name: "Power Surge", desc: "Earn {t} energy total", metric: "earned", base: 50000, perLevel: 0.5, rewardGems: 15, rewardShards: 1, pool: "daily" },
  { id: "d-rebirth", name: "Cycle Breaker", desc: "Perform {t} rebirth", metric: "rebirths", base: 1, perLevel: 0, rewardGems: 20, rewardShards: 2, pool: "daily" },
];

export const WEEKLY_QUESTS: QuestDef[] = [
  { id: "w-clicks", name: "Relentless", desc: "Click the core {t} times this week", metric: "clicks", base: 10000, perLevel: 0.3, rewardGems: 60, rewardShards: 5, pool: "weekly" },
  { id: "w-earn", name: "Tycoon", desc: "Earn {t} energy this week", metric: "earned", base: 500000, perLevel: 0.6, rewardGems: 80, rewardShards: 6, pool: "weekly" },
  { id: "w-hatch", name: "Breeding Season", desc: "Hatch {t} eggs this week", metric: "hatches", base: 25, perLevel: 0.15, rewardGems: 70, rewardShards: 4, pool: "weekly" },
  { id: "w-upgrade", name: "Arms Race", desc: "Buy {t} upgrade levels this week", metric: "upgrades", base: 60, perLevel: 0.2, rewardGems: 60, rewardShards: 5, pool: "weekly" },
  { id: "w-rebirth", name: "Phoenix Protocol", desc: "Rebirth {t} times this week", metric: "rebirths", base: 3, perLevel: 0, rewardGems: 100, rewardShards: 8, pool: "weekly" },
  { id: "w-pets", name: "Menagerie", desc: "Own {t} pets", metric: "pets", base: 15, perLevel: 0.25, rewardGems: 60, rewardShards: 5, pool: "weekly" },
];

/* ------------------------------ Achievements ------------------------------- */

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  metric: "clicks" | "earned" | "rebirths" | "hatches" | "pets" | "quests" | "streak" | "codes" | "secrets";
  target: string;
  points: number;
  hidden: boolean;
  tier: number;
}

const VERBS: Record<AchievementDef["metric"], string> = {
  clicks: "Click the core",
  earned: "Earn",
  rebirths: "Complete rebirths:",
  hatches: "Hatch eggs:",
  pets: "Own pets:",
  quests: "Claim quests:",
  streak: "Reach login streak:",
  codes: "Redeem codes:",
  secrets: "Hatch secrets:",
};

function ladder(prefix: string, name: string, metric: AchievementDef["metric"], targets: number[], unit: string, points: number): AchievementDef[] {
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return targets.map((t, i) => {
    const verb = VERBS[metric];
    const amount = metric === "clicks" || metric === "earned" ? fmt(t) : String(t);
    return {
      id: `${prefix}-${i + 1}`,
      name: `${name} ${roman[i]}`,
      desc: `${verb} ${amount}${unit ? ` ${unit}` : ""}`.replace(":", ","),
      metric,
      target: String(t),
      points: points * (i + 1),
      hidden: false,
      tier: i + 1,
    };
  });
}

export const ACHIEVEMENTS: AchievementDef[] = [
  ...ladder("a-click", "Initiate", "clicks", [100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e12], "clicks", 10),
  ...ladder("a-earn", "Magnate", "earned", [1e3, 1e5, 1e7, 1e9, 1e11, 1e14, 1e18, 1e24, 1e30, 1e40], "energy", 10),
  ...ladder("a-rebirth", "Phoenix", "rebirths", [1, 3, 10, 25, 60, 150], "", 40),
  ...ladder("a-hatch", "Breeder", "hatches", [1, 10, 50, 200, 1000, 5000], "", 25),
  ...ladder("a-pets", "Keeper", "pets", [5, 15, 40, 80, 200, 500], "", 30),
  ...ladder("a-quest", "Deed Doer", "quests", [1, 10, 50, 150, 500], "", 30),
  ...ladder("a-streak", "Devoted", "streak", [2, 4, 7, 14, 30], "day streak", 35),
  ...ladder("a-codes", "Insider", "codes", [1, 5, 15], "", 40),
  { id: "a-secret", name: "Beyond the Veil", desc: "Hatch a Secret rarity pet.", metric: "secrets", target: "1", points: 500, hidden: true, tier: 1 },
  { id: "a-secret-5", name: "Whisper Collector", desc: "Hatch 5 Secret rarity pets.", metric: "secrets", target: "5", points: 1500, hidden: true, tier: 2 },
];

export const achievementById = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export const TITLES: { points: number; title: string }[] = [
  { points: 0, title: "Newcomer" },
  { points: 100, title: "Grid Runner" },
  { points: 300, title: "Neon Adept" },
  { points: 700, title: "Voidwalker" },
  { points: 1500, title: "Starforged" },
  { points: 3000, title: "Nexus Legend" },
];

/* ---------------------------- Daily login rewards --------------------------- */

export interface DailyReward {
  day: number;
  label: string;
  gems: number;
  shards: number;
  energyPctOfLifetime: number; // % of lifetime earned granted as energy
  flatEnergy: string;
}

export const DAILY_REWARDS: DailyReward[] = [
  { day: 1, label: "Welcome Surge", gems: 10, shards: 0, energyPctOfLifetime: 0.02, flatEnergy: "500" },
  { day: 2, label: "Charge Pack", gems: 15, shards: 0, energyPctOfLifetime: 0.03, flatEnergy: "2000" },
  { day: 3, label: "Shard Cache", gems: 20, shards: 2, energyPctOfLifetime: 0.04, flatEnergy: "8000" },
  { day: 4, label: "Overdrive", gems: 25, shards: 3, energyPctOfLifetime: 0.05, flatEnergy: "30000" },
  { day: 5, label: "Gem Vault", gems: 40, shards: 4, energyPctOfLifetime: 0.07, flatEnergy: "120000" },
  { day: 6, label: "Lucky Six", gems: 60, shards: 6, energyPctOfLifetime: 0.1, flatEnergy: "500000" },
  { day: 7, label: "Jackpot Protocol", gems: 150, shards: 12, energyPctOfLifetime: 0.2, flatEnergy: "2500000" },
];

/* ---------------------------------- Shop ----------------------------------- */

export interface ShopItem {
  id: string;
  name: string;
  desc: string;
  gemCost: number;
  type: "boost" | "slot" | "inventory";
  boostMult?: number;
  durationSec?: number;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: "boost-overclock", name: "Overclock", desc: "×5 all energy gains for 60 seconds.", gemCost: 25, type: "boost", boostMult: 5, durationSec: 60 },
  { id: "boost-warp", name: "Warp Field", desc: "×3 all energy gains for 1 hour.", gemCost: 60, type: "boost", boostMult: 3, durationSec: 3600 },
  { id: "boost-singularity", name: "Singularity", desc: "×10 all energy gains for 30 seconds.", gemCost: 90, type: "boost", boostMult: 10, durationSec: 30 },
  { id: "slot-extra", name: "Pet Slot +1", desc: "Permanently equip one more pet (max +3).", gemCost: 300, type: "slot" },
  { id: "inventory-expand", name: "Storage Bay +50", desc: "Expand pet inventory by 50.", gemCost: 50, type: "inventory" },
];

/* --------------------------------- Events ---------------------------------- */

export interface EventKind {
  id: string;
  name: string;
  desc: string;
  color: string;
  defaults: { energyMult?: number; clickMult?: number; luckBonus?: number; durationHours: number };
}

export const EVENT_KINDS: EventKind[] = [
  { id: "double-energy", name: "Double Energy", desc: "All energy gains are doubled.", color: "#22d3ee", defaults: { energyMult: 2, durationHours: 6 } },
  { id: "triple-clicks", name: "Triple Clicks", desc: "Click power tripled for everyone.", color: "#a78bfa", defaults: { clickMult: 3, durationHours: 4 } },
  { id: "super-luck", name: "Super Luck", desc: "Greatly increased rare pet odds.", color: "#4ade80", defaults: { luckBonus: 40, durationHours: 6 } },
  { id: "golden-hour", name: "Golden Hour", desc: "×2 energy and +20 luck.", color: "#fbbf24", defaults: { energyMult: 2, luckBonus: 20, durationHours: 1 } },
  { id: "meteor-shower", name: "Meteor Shower", desc: "×3 energy from the skies.", color: "#fb7185", defaults: { energyMult: 3, durationHours: 2 } },
  { id: "click-race", name: "Global Click Race", desc: "Tripled click power. Race to the top.", color: "#38bdf8", defaults: { clickMult: 3, durationHours: 12 } },
  { id: "weekend-festival", name: "Weekend Festival", desc: "×2 energy, ×2 clicks, +25 luck all weekend.", color: "#e879f9", defaults: { energyMult: 2, clickMult: 2, luckBonus: 25, durationHours: 48 } },
  { id: "seasonal-eclipse", name: "Seasonal Eclipse", desc: "A rare eclipse: ×5 energy, ×2 clicks.", color: "#c084fc", defaults: { energyMult: 5, clickMult: 2, durationHours: 24 } },
];

/* --------------------------- Pricing pure helpers --------------------------- */

const GROWTH_CAP = new BigNumber("1e308");

export function upgradePrice(base: string, growth: number, level: number): BigNumber {
  const price = bn(base).times(new BigNumber(growth).pow(level)).integerValue(BigNumber.ROUND_CEIL);
  return price.gt(GROWTH_CAP) ? GROWTH_CAP : price;
}

/** Total cost to buy `count` levels starting at `level`.
 *  Exact: the displayed (ceiled) price of each individual level, summed — so the
 *  number on a ×10 button always equals exactly what the server charges. */
export function bulkPrice(base: string, growth: number, level: number, count: number): BigNumber {
  let total = new BigNumber(0);
  for (let i = 0; i < count; i++) total = total.plus(upgradePrice(base, growth, level + i));
  return total.gt(GROWTH_CAP) ? GROWTH_CAP : total;
}

/** Fast fractional estimate of cost (no per-level ceiling) — used only as a solver hint. */
function bulkPriceEstimate(base: string, growth: number, level: number, count: number): BigNumber {
  const g = new BigNumber(growth);
  return bn(base).times(g.pow(level)).times(g.pow(count).minus(1).div(g.minus(1)));
}

/** How many levels can `balance` afford starting at `level`? */
export function maxAffordable(base: string, growth: number, level: number, balance: BigNumber.Value, cap: number): number {
  const bal = bn(balance);
  if (bal.lt(upgradePrice(base, growth, level))) return 0;
  const est = bulkPriceEstimate(base, growth, level, 1);
  const ratio = bal.times(growth - 1).div(est).plus(1).toNumber();
  let n = Math.min(Math.floor(Math.log(ratio) / Math.log(growth)) + 1, cap);
  while (n > 0 && bulkPrice(base, growth, level, n).gt(bal)) n--;
  while (n < cap && bulkPrice(base, growth, level, n + 1).lte(bal)) n++;
  return Math.max(0, Math.min(n, cap));
}

/* ------------------------------ Misc helpers -------------------------------- */

export function levelFromClicks(totalClicks: number): number {
  // level n requires 40 * n^2.2 cumulative clicks
  let lvl = 1;
  while (lvl < 999 && 40 * Math.pow(lvl + 1, 2.2) <= totalClicks) lvl++;
  return lvl;
}

export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);
export function utcWeek(d = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function questTarget(q: QuestDef, level: number): number {
  return Math.max(1, Math.round(q.base * (1 + q.perLevel * Math.max(0, level - 1))));
}

export type ClientSafeConfig = typeof import("./game");
