/* Client-safe shapes mirroring the server serializer. */

export interface ClientPet {
  id: string;
  defId: string;
  name: string;
  worldId: number;
  rarity: string;
  rarityIdx: number;
  variant: "normal" | "golden" | "shiny" | string;
  equipped: boolean;
  favorite: boolean;
  pct: number;
}

export interface ClientQuest {
  id: string;
  name: string;
  desc: string;
  kind: "daily" | "weekly";
  period: string;
  target: number;
  progress: string;
  claimed: boolean;
  rewardGems: number;
  rewardShards: number;
  metric: string;
}

export interface ClientAchievement {
  id: string;
  name: string;
  desc: string;
  points: number;
  tier: number;
  hidden: boolean;
  metric: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface ActiveEventInfo {
  id: string;
  kind: string;
  title: string;
  description: string;
  params: { energyMult?: number; clickMult?: number; luckBonus?: number };
  startsAt: number;
  endsAt: number;
  color: string;
}

export interface ClientBoost {
  id: string;
  name: string;
  mult: number;
  expiresAt: number;
}

export interface ClientState {
  user: { id: string; username: string; email: string; role: string; level: number };
  energy: string;
  lifetimeEarned: string;
  gems: number;
  shards: string;
  cores: string;
  prisms: string;
  voids: string;
  resets: Record<string, number>;
  totalClicks: number;
  combo: number;
  bestCombo: number;
  world: number;
  unlockedWorlds: number[];
  upgrades: Record<string, number>;
  level: number;
  pets: ClientPet[];
  quests: ClientQuest[];
  boosts: ClientBoost[];
  pity: Record<string, number>;
  settings: Record<string, unknown>;
  daily: { canClaim: boolean; streak: number; day: number };
  title: string | null;
  avatarSeed: string;
  codesRedeemed: number;
  hatchedTotal: number;
  secretHatches: number;
  upgradesBought: number;
  questsClaimed: number;
  playSeconds: number;
  stats: {
    clickPower: string;
    passivePerSec: string;
    critChance: number;
    critMult: number;
    globalMult: string;
    luck: number;
    comboCap: number;
    petPct: number;
  };
  offlineGained: string;
  achievements: ClientAchievement[];
  achievementPoints: number;
  unlockedAchievementCount: number;
  announcement: string | null;
  activeEvents: ActiveEventInfo[];
  maxEquipped: number;
  inventoryCap: number;
  serverNow: number;
}

export type GameTab =
  | "home" | "upgrades" | "pets" | "eggs" | "rebirth" | "worlds" | "quests"
  | "achievements" | "collection" | "shop" | "leaderboards" | "events"
  | "daily" | "codes" | "settings" | "profile";
