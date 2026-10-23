import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import GameApp from "@/components/game/GameApp";
import Ambient from "@/components/ambient";

export const dynamic = "force-dynamic";

export const metadata = { title: "NEXORA — Play" };

export default async function GamePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <>
      <Ambient density={50} />
      <GameApp />
    </>
  );
}
