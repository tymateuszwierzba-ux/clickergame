import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import AuthForm from "@/components/auth-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await currentUser()) redirect("/game");
  return <AuthForm mode="register" />;
}
