import { handler, ok } from "@/server/http";
import { destroySession } from "@/server/auth";

export const POST = handler(async () => {
  await destroySession();
  return ok({ loggedOut: true });
});
