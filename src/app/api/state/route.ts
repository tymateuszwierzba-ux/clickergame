import { handler, ok } from "@/server/http";
import { requireUser } from "@/server/auth";
import { serializeState } from "@/server/game";

export const GET = handler(async () => {
  const user = await requireUser();
  const data = await serializeState(user.id);
  return ok({ user: { id: user.id, username: user.username, email: user.email, role: user.role, level: user.level }, ...data });
});

export const dynamic = "force-dynamic";
