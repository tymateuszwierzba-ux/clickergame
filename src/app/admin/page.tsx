import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { ROLE_PERMS, type Role, type Perm } from "@/server/permissions";
import AdminApp from "@/components/admin/AdminApp";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEXORA — Admin Console" };

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const perms = [...(ROLE_PERMS[user.role as Role] ?? [])] as Perm[];
  if (perms.length === 0) redirect("/game");
  return <AdminApp role={user.role} perms={perms} username={user.username} avatarSeed={user.avatarSeed} />;
}
