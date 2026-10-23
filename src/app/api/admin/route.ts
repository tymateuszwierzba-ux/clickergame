import { handler, ok, fail } from "@/server/http";
import { requireUser } from "@/server/auth";
import { runAdminAction } from "@/server/admin";
import { rateLimit } from "@/server/security";
import { ROLE_PERMS, type Role } from "@/server/permissions";

export const POST = handler(async (req) => {
  const user = await requireUser();
  if (!rateLimit(`admin:${user.id}`, 120, 10)) return fail("Too many admin requests", 429);
  const body = (await req.json()) as { action?: string; params?: Record<string, unknown> };
  if (body.action === "whoami") {
    return ok({ role: user.role, permissions: [...(ROLE_PERMS[user.role as Role] ?? [])] });
  }
  if (!body.action) return fail("Missing action");
  const data = await runAdminAction(user, body.action, body.params ?? {});
  return ok(data);
});
