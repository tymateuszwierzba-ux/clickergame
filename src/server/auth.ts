import { cache } from "react";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, sessions, profiles, gameStates, bans, metricsDaily } from "@/db/schema";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { newToken, hashToken } from "./security";
import { utcDay } from "@/config/game";

export const SESSION_COOKIE = "nxs";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
  username: string;
  role: string;
  avatarSeed: string;
  title: string | null;
  level: number;
}

/* ------------------------------ Session core ------------------------------- */

export async function createSession(userId: string, ip?: string | null, userAgent?: string | null) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, ip: ip ?? null, userAgent: userAgent ?? null, expiresAt });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  store.delete(SESSION_COOKIE);
}

/** Current signed-in user — memoized per request via React cache. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      avatarSeed: profiles.avatarSeed,
      title: profiles.title,
      level: profiles.level,
      sessionId: sessions.id,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const u = rows[0];
  if (!u) return null;
  // Active ban check
  const activeBan = await db
    .select({ id: bans.id })
    .from(bans)
    .where(and(eq(bans.userId, u.id), isNull(bans.revokedAt), or(isNull(bans.expiresAt), gt(bans.expiresAt, new Date()))))
    .limit(1);
  if (activeBan.length > 0) return null;
  return { id: u.id, email: u.email, username: u.username, role: u.role, avatarSeed: u.avatarSeed, title: u.title, level: u.level };
});

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new AuthError("Sign in required", 401);
  return u;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export class ActionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/* ------------------------------- Registration ------------------------------ */

export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function createAccount(email: string, username: string, password: string, ip?: string | null, ua?: string | null) {
  const emailNorm = email.toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);
  const role = ownerEmails().includes(emailNorm) ? "owner" : "player";

  const created = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email: emailNorm, username, passwordHash, role })
      .returning({ id: users.id });
    await tx.insert(profiles).values({ userId: user.id, avatarSeed: pickAvatarSeed(username) });
    await tx.insert(gameStates).values({ userId: user.id });
    await tx
      .insert(metricsDaily)
      .values({ day: utcDay(), registrations: 1 })
      .onConflictDoUpdate({ target: metricsDaily.day, set: { registrations: sql`${metricsDaily.registrations} + 1` } });
    return user;
  });

  await createSession(created.id, ip, ua);
  return created.id;
}

export async function verifyLogin(identifier: string, password: string, ip?: string | null, ua?: string | null): Promise<SessionUser> {
  const idNorm = identifier.toLowerCase();
  const rows = await db
    .select({ id: users.id, email: users.email, username: users.username, passwordHash: users.passwordHash })
    .from(users)
    .where(or(eq(users.email, idNorm), eq(sql`lower(${users.username})`, idNorm)))
    .limit(1);
  const row = rows[0];
  const dummyHash = "$2a$10$C6UzMDM.H6dfI/f/IKcEeO7ZB8b2qGXhpqZbH6hHqQK0R6Xf0qS6a";
  const hash = row?.passwordHash ?? dummyHash;
  const ok = await bcrypt.compare(password, hash);
  if (!row || !ok) throw new AuthError("Invalid credentials", 401);

  const activeBan = await db
    .select({ id: bans.id, reason: bans.reason, expiresAt: bans.expiresAt })
    .from(bans)
    .where(and(eq(bans.userId, row.id), isNull(bans.revokedAt), or(isNull(bans.expiresAt), gt(bans.expiresAt, new Date()))))
    .limit(1);
  if (activeBan.length > 0) {
    const b = activeBan[0];
    throw new AuthError(`Account suspended${b.expiresAt ? ` until ${b.expiresAt.toISOString().slice(0, 10)}` : " permanently"}: ${b.reason}`, 403);
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, row.id));
  await createSession(row.id, ip, ua);
  const u = await currentUser();
  return u!;
}

export function pickAvatarSeed(username: string): string {
  const seeds = ["nova", "pulse", "orbit", "quasar", "vex", "lyra", "ion", "rune", "flux", "echo"];
  let h = 0;
  for (const c of username) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return seeds[h % seeds.length];
}
