import { currentUser } from "@/server/auth";
import { ROLE_PERMS, type Role, type Perm } from "@/server/permissions";
import AdminApp from "@/components/admin/AdminApp";

export const dynamic = "force-dynamic";
export const metadata = { title: "404", robots: "noindex, nofollow" };

/* Hidden operations console. Authorization is enforced server-side on every
   action; the URL is simply not linked anywhere in the player UI. */
export default async function SecretAdminPage() {
  const user = await currentUser();
  const perms = user ? ([...(ROLE_PERMS[user.role as Role] ?? [])] as Perm[]) : [];
  if (!user || perms.length === 0) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <div className="font-mono text-6xl font-bold text-slate-800">404</div>
          <p className="text-xs text-slate-600 mt-2 font-mono">nothing to see here</p>
        </div>
      </div>
    );
  }
  return <AdminApp role={user.role} perms={perms} username={user.username} avatarSeed={user.avatarSeed} />;
}
