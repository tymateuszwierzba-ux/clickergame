/* Role-based access control. Every protected server action calls requirePerm. */

export type Role = "player" | "support" | "moderator" | "admin" | "super_admin" | "owner";

export type Perm =
  | "metrics.view"
  | "players.view"
  | "players.edit"
  | "players.grant"
  | "moderation.manage"
  | "economy.manage"
  | "events.manage"
  | "content.manage"
  | "codes.manage"
  | "config.manage"
  | "logs.view"
  | "roles.manage"
  | "console.use";

const P = (list: Perm[]): Set<Perm> => new Set(list);

export const ROLE_PERMS: Record<Role, Set<Perm>> = {
  player: P([]),
  support: P(["players.view"]),
  moderator: P(["players.view", "moderation.manage", "logs.view"]),
  admin: P([
    "metrics.view",
    "players.view",
    "players.grant",
    "events.manage",
    "content.manage",
    "codes.manage",
    "logs.view",
    "console.use",
  ]),
  super_admin: P([
    "metrics.view",
    "players.view",
    "players.edit",
    "players.grant",
    "moderation.manage",
    "economy.manage",
    "events.manage",
    "content.manage",
    "codes.manage",
    "config.manage",
    "logs.view",
    "console.use",
  ]),
  owner: P([
    "metrics.view",
    "players.view",
    "players.edit",
    "players.grant",
    "moderation.manage",
    "economy.manage",
    "events.manage",
    "content.manage",
    "codes.manage",
    "config.manage",
    "logs.view",
    "roles.manage",
    "console.use",
  ]),
};

export const ROLE_LABELS: Record<Role, string> = {
  player: "Player",
  support: "Support",
  moderator: "Moderator",
  admin: "Admin",
  super_admin: "Super Admin",
  owner: "Owner",
};

export function hasPerm(role: string, perm: Perm): boolean {
  const set = ROLE_PERMS[role as Role];
  return !!set && set.has(perm);
}

export function roleLevel(role: string): number {
  return { player: 0, support: 1, moderator: 2, admin: 3, super_admin: 4, owner: 5 }[role as Role] ?? 0;
}

/** Returns true when role can manage/assign/ban the target role. */
export function canAffectRole(actorRole: string, targetRole: string): boolean {
  return roleLevel(actorRole) > roleLevel(targetRole);
}
