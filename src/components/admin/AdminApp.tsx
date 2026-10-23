"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard, Users, Coins, CalendarClock, PawPrint, ScrollText, Ticket,
  ShieldAlert, Scroll, Settings2, TerminalSquare, Zap, LogOut, Activity,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { fmt, fmtDuration } from "@/lib/num";
import { Avatar } from "@/components/art";
import { Panel, StatTile, Spinner } from "@/components/ui";
import { useAdminAction } from "./admin-shared";
import type { Perm, Role } from "@/server/permissions";
import { ROLE_LABELS } from "@/server/permissions";
import { PlayersTab } from "./admin-players";
import { EconomyTab, EventsTab, ContentTab, CodesTab, ModerationTab, AuditTab, ConfigTab, ConsoleTab } from "./admin-ops";

export type AdminTab = "overview" | "players" | "economy" | "events" | "content" | "codes" | "moderation" | "audit" | "config" | "console";

const TABS: { id: AdminTab; label: string; icon: typeof LayoutDashboard; perm: Perm }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, perm: "metrics.view" },
  { id: "players", label: "Players", icon: Users, perm: "players.view" },
  { id: "economy", label: "Economy", icon: Coins, perm: "economy.manage" },
  { id: "events", label: "Events", icon: CalendarClock, perm: "events.manage" },
  { id: "content", label: "Pets & Content", icon: PawPrint, perm: "content.manage" },
  { id: "codes", label: "Codes", icon: Ticket, perm: "codes.manage" },
  { id: "moderation", label: "Moderation", icon: ShieldAlert, perm: "moderation.manage" },
  { id: "audit", label: "Audit Log", icon: Scroll, perm: "logs.view" },
  { id: "config", label: "Config", icon: Settings2, perm: "config.manage" },
  { id: "console", label: "Console", icon: TerminalSquare, perm: "console.use" },
];

export default function AdminApp({ role, perms, username, avatarSeed }: { role: string; perms: Perm[]; username: string; avatarSeed: string }) {
  const allowed = TABS.filter((t) => perms.includes(t.perm));
  const [tab, setTab] = useState<AdminTab>(allowed[0]?.id ?? "overview");
  const { run, flash, busy, can } = useAdminAction(perms);

  // Derive the effective tab without effects: fall back to the first allowed tab.
  const activeTab = allowed.some((t) => t.id === tab) ? tab : allowed[0]?.id ?? "overview";

  return (
    <div className="min-h-dvh flex bg-abyss relative">
      {/* scanline texture */}
      <div className="pointer-events-none fixed inset-0 z-[70] opacity-[0.05]" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent 0 2px, rgba(167,139,250,.5) 2px 3px)" }} aria-hidden />
      {/* side rail */}
      <aside className="w-52 shrink-0 border-r border-line p-3 hidden md:flex flex-col gap-1 sticky top-0 h-dvh overflow-y-auto">
        <Link href="/game" className="flex items-center gap-2 px-2 py-2.5 mb-1">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-[0_0_18px_rgba(167,139,250,.35)]">
            <Zap size={14} className="text-white" strokeWidth={2.6} />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-none">NEXORA</div>
            <div className="text-[9px] text-violet-300 font-semibold tracking-widest">OPERATIONS</div>
          </div>
        </Link>
        <div className="mx-2 mb-2 rounded-lg border border-violet-500/25 bg-violet-500/[0.07] px-2.5 py-1.5 font-mono text-[9px] tracking-[0.18em] text-violet-300/90">
          RESTRICTED // /tajnyadmin
        </div>
        {allowed.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors cursor-pointer text-left ${
              activeTab === t.id ? "bg-violet-500/15 text-white border border-violet-500/30" : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
          >
            <t.icon size={15} className={activeTab === t.id ? "text-violet-300" : ""} />
            {t.label}
          </button>
        ))}
        <div className="mt-auto pt-3 border-t border-line">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <Avatar seed={avatarSeed} size={30} />
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">{username}</div>
              <div className="text-[10px] text-violet-300">{ROLE_LABELS[role as Role] ?? role}</div>
            </div>
          </div>
          <Link href="/game" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer">
            <LogOut size={13} /> Back to game
          </Link>
        </div>
      </aside>

      {/* mobile tab bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-ink/95 border-t border-line backdrop-blur-xl">
        <div className="flex overflow-x-auto px-2 py-1.5 gap-1">
          {allowed.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-semibold cursor-pointer ${activeTab === t.id ? "bg-violet-500/20 text-white" : "text-slate-400"}`}>
              {t.label}
            </button>
          ))}
          <Link href="/game" className="shrink-0 rounded-lg px-3 py-2 text-[11px] font-semibold text-slate-400">Game</Link>
        </div>
      </div>

      <main className="flex-1 min-w-0 p-4 sm:p-6 pb-24 md:pb-8 max-w-[1400px]">
        {flash && (
          <div className={`fixed top-4 right-4 z-[90] anim-toast glass rounded-xl px-4 py-3 text-sm font-semibold border ${flash.kind === "ok" ? "border-emerald-500/40 text-emerald-300" : "border-rose-500/40 text-rose-300"}`}>
            {flash.text}
          </div>
        )}
        {activeTab === "overview" && can("metrics.view") && <OverviewTab />}
        {activeTab === "players" && can("players.view") && <PlayersTab run={run} busy={busy} can={can} />}
        {activeTab === "economy" && can("economy.manage") && <EconomyTab run={run} busy={busy} />}
        {activeTab === "events" && can("events.manage") && <EventsTab run={run} busy={busy} />}
        {activeTab === "content" && can("content.manage") && <ContentTab run={run} busy={busy} />}
        {activeTab === "codes" && can("codes.manage") && <CodesTab run={run} busy={busy} />}
        {activeTab === "moderation" && can("moderation.manage") && <ModerationTab run={run} busy={busy} />}
        {activeTab === "audit" && can("logs.view") && <AuditTab />}
        {activeTab === "config" && can("config.manage") && <ConfigTab run={run} busy={busy} />}
        {activeTab === "console" && can("console.use") && <ConsoleTab run={run} />}
      </main>
    </div>
  );
}

/* --------------------------------- OVERVIEW ---------------------------------- */

interface OverviewData {
  totals: Record<string, number | string>;
  series: { day: string; clicks: number; registrations: number; hatches: number; rebirths: number }[];
  recentAudit: { id: string; adminName: string | null; action: string; createdAt: string; result: string }[];
  topEnergy: { username: string; energy: number }[];
  health: { database: string; dbLatencyMs: number; serverTime: string };
}

export function OverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "overview" }) })
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d.data) : setErr(d.error)))
      .catch(() => setErr("Failed to load"));
  }, []);

  if (err) return <Panel><p className="text-sm text-rose-300">{err}</p></Panel>;
  if (!data) return <div className="flex justify-center py-20"><Spinner /></div>;

  const t = data.totals;
  const stats = [
    { label: "Accounts", value: fmt(t.accounts), accent: "#22d3ee" },
    { label: "Active (24h)", value: fmt(t.activePlayers24h), accent: "#34d399", sub: `${fmt(t.activeSessions)} sessions` },
    { label: "New (24h)", value: fmt(t.newRegistrations24h), accent: "#a78bfa", sub: `${fmt(t.newRegistrations7d)} this week` },
    { label: "Total Clicks", value: fmt(t.totalClicks), accent: "#fbbf24" },
    { label: "Energy Earned", value: fmt(t.totalEarned), accent: "#38bdf8" },
    { label: "Rebirths", value: fmt(t.totalRebirths), accent: "#f472b6" },
    { label: "Pets in Circulation", value: fmt(t.petsHatched), accent: "#4ade80" },
    { label: "Achievements", value: fmt(t.achievementsUnlocked), accent: "#e879f9" },
    { label: "Active Events", value: fmt(t.activeEvents), accent: "#fb923c" },
    { label: "Banned Accounts", value: fmt(t.bannedAccounts), accent: "#fb7185" },
  ];

  const chartData = data.series.map((s) => ({ day: s.day.slice(5), clicks: s.clicks, signups: s.registrations, hatches: s.hatches, rebirths: s.rebirths }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Operations Overview</h1>
          <p className="text-xs text-slate-500">Live database aggregates — no synthetic data.</p>
        </div>
        <div className="glass-soft rounded-full px-3.5 py-1.5 text-[11px] font-semibold text-emerald-300 inline-flex items-center gap-1.5">
          <Activity size={12} /> DB {data.health.database} · {data.health.dbLatencyMs}ms
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {stats.map((s) => (
          <StatTile key={s.label} label={s.label} value={s.value} sub={s.sub} accent={s.accent} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title="Activity — last 14 days">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => fmt(v)} />
                <Tooltip contentStyle={{ background: "#0d1025", border: "1px solid rgba(148,163,184,.2)", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "#e2e8f0" }} />
                <Area type="monotone" dataKey="clicks" stroke="#22d3ee" fill="url(#gClicks)" strokeWidth={2} name="Clicks" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Registrations & hatches — last 14 days">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={{ background: "#0d1025", border: "1px solid rgba(148,163,184,.2)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="signups" fill="#a78bfa" radius={[4, 4, 0, 0]} name="Signups" />
                <Bar dataKey="hatches" fill="#f472b6" radius={[4, 4, 0, 0]} name="Hatches" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title="Recent administrative operations">
          {data.recentAudit.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No administrative operations yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {data.recentAudit.map((a) => (
                <div key={a.id} className="flex items-center gap-3 glass-soft rounded-xl px-3 py-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.result === "ok" ? "bg-emerald-400" : "bg-rose-400"}`} />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-white">{a.adminName ?? "system"}</span>
                    <span className="text-[11px] text-slate-400"> · {a.action}</span>
                  </div>
                  <span className="text-[10px] text-slate-600 num">{new Date(a.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Richest grids (held energy)">
          {data.topEnergy.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No players yet.</p>
          ) : (
            <div className="space-y-1.5">
              {data.topEnergy.map((p, i) => (
                <div key={p.username} className="flex items-center gap-3 glass-soft rounded-xl px-3 py-2">
                  <span className="num text-xs text-slate-500 w-5">#{i + 1}</span>
                  <span className="text-xs font-semibold text-white flex-1 truncate">{p.username}</span>
                  <span className="num text-xs font-bold text-cyan-200">{fmt(p.energy)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
