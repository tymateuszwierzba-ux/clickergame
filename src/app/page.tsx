import { currentUser } from "@/server/auth";
import Landing from "@/components/landing";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  return <Landing loggedIn={!!user} />;
}
