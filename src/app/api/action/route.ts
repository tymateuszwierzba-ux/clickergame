import { handler, ok, fail } from "@/server/http";
import { requireUser, ActionError } from "@/server/auth";
import {
  clickBatch, buyUpgrade, performReset, hatchEggs, petAction,
  claimDailyReward, claimQuest, redeemCode, buyShopItem, unlockWorld,
  saveSettings,
} from "@/server/game";
import { db } from "@/db";
import { gameConfig } from "@/db/schema";
import { eq } from "drizzle-orm";

type Handler = (userId: string, p: Record<string, unknown>) => Promise<unknown>;

async function featureDisabled(key: string): Promise<boolean> {
  const rows = await db.select().from(gameConfig).where(eq(gameConfig.key, "features")).limit(1);
  const v = (rows[0]?.value ?? {}) as Record<string, unknown>;
  return v[key] === true;
}

const ACTIONS: Record<string, Handler> = {
  clickBatch: (uid, p) => clickBatch(uid, Number(p.count), String(p.key ?? "")),
  buyUpgrade: (uid, p) => buyUpgrade(uid, String(p.upgradeId), p.mode as "1" | "10" | "max"),
  reset: (uid, p) => performReset(uid, String(p.tier)),
  hatch: async (uid, p) => {
    if (await featureDisabled("disableHatching")) throw new ActionError("Hatching is temporarily disabled", 503);
    return hatchEggs(uid, Number(p.worldId), Number(p.count));
  },
  petAction: (uid, p) => petAction(uid, String(p.op), p.petId ? String(p.petId) : undefined),
  claimDaily: (uid) => claimDailyReward(uid),
  claimQuest: (uid, p) => claimQuest(uid, String(p.questId), String(p.period)),
  redeemCode: async (uid, p) => {
    if (await featureDisabled("disableCodes")) throw new ActionError("Codes are temporarily disabled", 503);
    return redeemCode(uid, String(p.code));
  },
  buyShop: async (uid, p) => {
    if (await featureDisabled("disableShop")) throw new ActionError("Shop is temporarily closed", 503);
    return buyShopItem(uid, String(p.itemId));
  },
  unlockWorld: (uid, p) => unlockWorld(uid, Number(p.worldId)),
  saveSettings: (uid, p) => saveSettings(uid, (p.settings ?? {}) as Record<string, unknown>, p.avatarSeed ? String(p.avatarSeed) : undefined),
};

export const POST = handler(async (req) => {
  const user = await requireUser();
  const body = (await req.json()) as { action?: string; params?: Record<string, unknown> };
  const fn = body.action ? ACTIONS[body.action] : undefined;
  if (!fn) return fail(`Unknown action "${body.action ?? ""}"`, 404);
  const data = await fn(user.id, body.params ?? {});
  return ok(data);
});
