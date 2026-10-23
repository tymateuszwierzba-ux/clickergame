import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError, ActionError } from "./auth";

export function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/** Wrap a route handler with consistent error mapping. */
export function handler<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof AuthError) return fail(err.message, err.status);
      if (err instanceof ActionError) return fail(err.message, err.status);
      if (err instanceof ZodError) {
        return fail(err.issues[0]?.message ?? "Invalid request", 422);
      }
      if (err instanceof SyntaxError) return fail("Malformed JSON body", 400);
      console.error("[api:error]", err);
      return fail("Something went wrong on our side. Please try again.", 500);
    }
  };
}

export function clientInfo(req: Request): { ip: string | null; ua: string | null } {
  const fwd = req.headers.get("x-forwarded-for");
  return {
    ip: fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip"),
    ua: req.headers.get("user-agent"),
  };
}
