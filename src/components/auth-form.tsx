"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, Mail, User, Lock, ArrowRight, AlertCircle } from "lucide-react";
import Ambient from "@/components/ambient";
import { Btn, Field, TextInput } from "@/components/ui";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", username: "", identifier: "", password: "" });

  const isRegister = mode === "register";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        const res = await fetch(`/api/auth/${mode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isRegister
              ? { email: form.email.trim(), username: form.username.trim(), password: form.password }
              : { identifier: form.identifier.trim(), password: form.password },
          ),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Something went wrong");
          return;
        }
        router.push("/game");
        router.refresh();
      } catch {
        setError("Network error — please try again");
      }
    });
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4 relative">
      <Ambient density={70} />
      <Link href="/" className="flex items-center gap-2.5 mb-8 anim-pop-in">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center shadow-[0_0_28px_rgba(34,211,238,.45)]">
          <Zap size={20} className="text-white" strokeWidth={2.6} />
        </div>
        <span className="font-bold text-2xl tracking-tight text-white">NEXORA</span>
      </Link>

      <div className="glass rounded-3xl p-7 sm:p-9 w-full max-w-md anim-pop-in relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <h1 className="text-2xl font-bold text-white">{isRegister ? "Create your account" : "Welcome back, operator"}</h1>
        <p className="text-sm text-slate-400 mt-1 mb-7">
          {isRegister ? "The grid records everything. Make it count." : "The grid kept your progress safe."}
        </p>

        <form onSubmit={submit} className="space-y-4 relative">
          {isRegister && (
            <Field label="Email">
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <TextInput type="email" required autoComplete="email" placeholder="you@grid.io" className="pl-10" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </Field>
          )}
          <Field label={isRegister ? "Username" : "Email or username"}>
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <TextInput
                required
                autoComplete="username"
                placeholder={isRegister ? "NovaPilot" : "you@grid.io or username"}
                className="pl-10"
                value={isRegister ? form.username : form.identifier}
                onChange={(e) => setForm(isRegister ? { ...form, username: e.target.value } : { ...form, identifier: e.target.value })}
              />
            </div>
          </Field>
          <Field label="Password">
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <TextInput
                type="password"
                required
                minLength={isRegister ? 8 : 1}
                autoComplete={isRegister ? "new-password" : "current-password"}
                placeholder={isRegister ? "8+ characters" : "••••••••"}
                className="pl-10"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          </Field>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-sm text-rose-300 anim-pop-in" role="alert">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <Btn variant="primary" size="lg" className="w-full" loading={pending} type="submit">
            {isRegister ? "Enter the Grid" : "Sign In"} <ArrowRight size={17} />
          </Btn>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          {isRegister ? (
            <>Already registered? <Link href="/login" className="text-cyan-300 hover:text-cyan-200 font-semibold">Sign in</Link></>
          ) : (
            <>New to NEXORA? <Link href="/register" className="text-cyan-300 hover:text-cyan-200 font-semibold">Create an account</Link></>
          )}
        </div>
      </div>
      <p className="mt-6 text-[11px] text-slate-600 max-w-xs text-center">
        Passwords are hashed with bcrypt. Sessions use secure httpOnly cookies.
      </p>
    </div>
  );
}
