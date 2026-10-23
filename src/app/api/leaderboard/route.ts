import { handler, ok, fail } from "@/server/http";
import { currentUser } from "@/server/auth";
import { leaderboard, type LeaderboardCategory } from "@/server/game";

const CATS: LeaderboardCategory[] = ["clicks", "earned", "rebirths", "gems", "pets", "achievements", "playtime"];

export const GET = handler(async (req) => {
  const url = new URL(req.url);
  const category = (url.searchParams.get("category") ?? "clicks") as LeaderboardCategory;
  if (!CATS.includes(category)) return fail("Unknown category");
  const page = Math.max(1, Math.min(1000, Number(url.searchParams.get("page")) || 1));
  const user = await currentUser();
  const data = await leaderboard(category, page, 25, user?.id);
  return ok(data);
});

export const dynamic = "force-dynamic";
