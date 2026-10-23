/* ----------------------------------------------------------------------------
   NEXORA development seed.
   Creates clearly-labelled development accounts and starter content.
   NEVER use these credentials in production — override via environment.
   Run: npx tsx src/db/seed.ts
---------------------------------------------------------------------------- */

import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, profiles, gameStates, codes, events, announcements } from "@/db/schema";
import { eq } from "drizzle-orm";

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "Nexora#Dev2026";

const SEED_USERS: { email: string; username: string; role: string; gems?: number }[] = [
  { email: "owner@nexora.dev", username: "owner", role: "owner" },
  { email: "admin@nexora.dev", username: "admin", role: "admin" },
  { email: "mod@nexora.dev", username: "moderator", role: "moderator" },
  { email: "support@nexora.dev", username: "support", role: "support" },
  { email: "nova@nexora.dev", username: "NovaPilot", role: "player", gems: 150 },
  { email: "vex@nexora.dev", username: "VexRunner", role: "player", gems: 40 },
  { email: "lyra@nexora.dev", username: "LyraStark", role: "player" },
  { email: "ion@nexora.dev", username: "IonDrift", role: "player" },
];

async function main() {
  const hash = await bcrypt.hash(SEED_PASSWORD, 10);
  for (const u of SEED_USERS) {
    const existing = await db.select().from(users).where(eq(users.email, u.email)).limit(1);
    if (existing.length > 0) {
      console.log(`• ${u.username} already exists — skipping`);
      continue;
    }
    const [row] = await db.insert(users).values({ email: u.email, username: u.username, passwordHash: hash, role: u.role }).returning({ id: users.id });
    await db.insert(profiles).values({ userId: row.id, avatarSeed: u.username.toLowerCase().slice(0, 8) });
    await db.insert(gameStates).values({ userId: row.id, gems: u.gems ?? 0 });
    console.log(`✓ created ${u.role.padEnd(10)} ${u.username} <${u.email}>`);
  }

  const existingCodes = await db.select().from(codes);
  if (existingCodes.length === 0) {
    await db.insert(codes).values([
      { code: "NEXORA2026", reward: { gems: 100, energy: "25000" }, maxRedemptions: 0 },
      { code: "LAUNCHDAY", reward: { gems: 50, shards: "5" }, maxRedemptions: 0 },
      { code: "FIRSTCLICK", reward: { energy: "5000" }, maxRedemptions: 10000 },
    ]);
    console.log("✓ seeded promotional codes: NEXORA2026, LAUNCHDAY, FIRSTCLICK");
  }

  const existingEvents = await db.select().from(events);
  if (existingEvents.length === 0) {
    const start = new Date(Date.now() + 60_000);
    const end = new Date(Date.now() + 6 * 3600_000);
    await db.insert(events).values({
      kind: "double-energy",
      title: "Double Energy — Launch Surge",
      description: "Celebrating launch: all energy gains doubled for 6 hours.",
      params: { energyMult: 2 },
      startsAt: start,
      endsAt: end,
      status: "scheduled",
    });
    console.log("✓ seeded launch event (starts in 1 minute)");
  }

  const anns = await db.select().from(announcements);
  if (anns.length === 0) {
    await db.insert(announcements).values({ message: "Welcome to NEXORA — the grid is live. Type a code in the Codes tab for a head start!" });
    console.log("✓ seeded welcome announcement");
  }

  console.log("\nSeed complete. Development password for all seeded accounts:", SEED_PASSWORD);
  console.log("(Override with SEED_PASSWORD env var. Never reuse in production.)");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
