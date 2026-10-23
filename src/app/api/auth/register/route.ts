import { z } from "zod";
import { handler, ok, fail, clientInfo } from "@/server/http";
import { createAccount } from "@/server/auth";
import { rateLimit } from "@/server/security";

const schema = z.object({
  email: z.string().email("Enter a valid email address").max(120),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(16, "Username must be 16 characters or fewer")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only use letters, numbers and _"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
});

export const POST = handler(async (req) => {
  const { ip, ua } = clientInfo(req);
  if (!rateLimit(`register:${ip ?? "anon"}`, 5, 0.05)) return fail("Too many attempts — wait a moment", 429);
  const body = schema.parse(await req.json());
  try {
    await createAccount(body.email, body.username, body.password, ip, ua);
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "23505") {
      const detail = String((err as { detail?: string })?.detail ?? "");
      if (detail.includes("email")) return fail("An account with this email already exists", 409);
      return fail("This username is already taken", 409);
    }
    throw err;
  }
  return ok({ registered: true });
});
