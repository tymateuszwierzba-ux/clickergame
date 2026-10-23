import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/* Baseline security headers on every response. Route-level authorization is
   enforced inside server components / API handlers (session + permission checks);
   middleware does not trust client-supplied identity. */
export function middleware(_req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
