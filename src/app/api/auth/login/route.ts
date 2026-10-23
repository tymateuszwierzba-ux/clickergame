import { z } from "zod";
import { handler, ok, fail, clientInfo } from "@/server/http";
import { verifyLogin } from "@/server/auth";
import { rateLimit } from "@/server/security";

const schema = z.object({
  identifier: z.string().min(3).max(120),
  password: z.string().min(1).max(100),
});

export const POST = handler(async (req) => {
  const { ip, ua } = clientInfo(req);
  if (!rateLimit(`login:${ip ?? "anon"}`, 10, 0.1)) return fail("Too many attempts — wait a moment", 429);
  const body = schema.parse(await req.json());
  const user = await verifyLogin(body.identifier, body.password, ip, ua);
  return ok({ user: { id: user.id, username: user.username, role: user.role, level: user.level } });
});
