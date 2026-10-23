"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home, ArrowUpCircle, Cat, Egg, RotateCcw, Globe2, ScrollText, Medal, LibraryBig,
  Gem, Trophy, CalendarClock, Gift, Ticket, Settings, UserRound, LogOut, Zap, Bell,
  Menu, X, Timer, Moon,
} from "lucide-react";
import { bn, fmt, fmtClock, fmtDuration } from "@/lib/num";
import { WORLD_THEME_BG } from "@/components/game/theme";
import { worldById } from "@/config/game";
import { Avatar } from "@/components/art";
import { Btn, Modal, Spinner } from "@/components/ui";
import { GameCtx, type GameApi } from "./context";
import type { ClientState, GameTab } from "@/types/client";
import ClickStage from "./ClickStage";
import { sfxAchievement, sfxRebirth, setMusicEnabled, setSfxEnabled } from "./sound";
import { HomePanel, UpgradesPanel } from "./panels-a";
import { PetsPanel, EggsPanel, RebirthPanel, WorldsPanel } from "./panels-b";
import {
  QuestsPanel, AchievementsPanel, CollectionPanel, ShopPanel, LeaderboardsPanel,
  EventsPanel, DailyPanel, CodesPanel, SettingsPanel, ProfilePanel,
} from "./panels-c";

interface Toast {
  id: number;
  title: string;
  body?: string;
  kind: "ok" | "rare" | "error";
}

const NAV_GROUPS: { group: string; items: { id: GameTab; label: string; icon: typeof Home }[] }[] = [
  {
    group: "Play",
    items: [
      { id: "home", label: "Home", icon: Home },
      { id: "upgrades", label: "Upgrades", icon: ArrowUpCircle },
      { id: "pets", label: "Pets", icon: Cat },
      { id: "eggs", label: "Eggs", icon: Egg },
      { id: "rebirth", label: "Rebirth", icon: RotateCcw },
      { id: "worlds", label: "Worlds", icon: Globe2 },
    ],
  },
  {
    group: "Progress",
    items: [
      { id: "quests", label: "Quests", icon: ScrollText },
      { id: "achievements", label: "Achievements", icon: Medal },
      { id: "collection", label: "Collection", icon: LibraryBig },
      { id: "leaderboards", label: "Leaderboards", icon: Trophy },
      { id: "events", label: "Events", icon: CalendarClock },
    ],
  },
  {
    group: "Account",
    items: [
      { id: "shop", label: "Shop", icon: Gem },
      { id: "daily", label: "Daily", icon: Gift },
      { id: "codes", label: "Codes", icon: Ticket },
      { id: "settings", label: "Settings", icon: Settings },
      { id: "profile", label: "Profile", icon: UserRound },
    ],
  },
];
const NAV = NAV_GROUPS.flatMap((g) => g.items);

export default function GameApp() {
  const router = useRouter();
  const [state, setStateRaw] = useState<ClientState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<GameTab>("home");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [offlineModal, setOfflineModal] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const toastId = useRef(0);
  const pendingClicks = useRef(0);
  const batchTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendingRef = useRef(false);

  const toast = useCallback((t: { title: string; body?: string; kind?: "ok" | "rare" | "error" }) => {
    const id = ++toastId.current;
    setToasts((ts) => [...ts.slice(-4), { id, kind: t.kind ?? "ok", title: t.title, body: t.body }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4200);
  }, []);

  const setState = useCallback((fn: (s: ClientState) => ClientState) => {
    setStateRaw((s) => (s ? fn(s) : s));
  }, []);

  /* ------------------------------ State loading ----------------------------- */
  const refresh = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error ?? "Failed to load");
    setStateRaw(data.data);
    return data.data as ClientState;
  }, []);

  useEffect(() => {
    refresh()
      .then((s) => {
        if (bn(s.offlineGained).gt(0)) setOfflineModal(s.offlineGained);
        const settings = (s.settings ?? {}) as { sfx?: boolean; music?: boolean };
        setSfxEnabled(settings.sfx !== false);
        if (settings.music) setMusicEnabled(true);
      })
      .catch((e) => setLoadError(e.message));
  }, [refresh]);

  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, []);

  /* ---------------------------- Click batching ------------------------------ */
  useEffect(() => {
    const onClicks = (e: Event) => {
      pendingClicks.current += (e as CustomEvent).detail.count;
    };
    window.addEventListener("nexora:clicks", onClicks);

    const flush = async (beacon = false) => {
      const count = pendingClicks.current;
      if (count <= 0 || sendingRef.current) return;
      sendingRef.current = true;
      pendingClicks.current = 0;
      const key = crypto.randomUUID();
      const payload = JSON.stringify({ action: "clickBatch", params: { count, key } });
      try {
        if (beacon) {
          navigator.sendBeacon("/api/action", new Blob([payload], { type: "application/json" }));
          sendingRef.current = false;
          return;
        }
        const res = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
        const data = await res.json();
        if (data.ok && !data.data.duplicate) {
          const d = data.data;
          setStateRaw((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              energy: d.energy,
              lifetimeEarned: d.lifetimeEarned,
              totalClicks: d.totalClicks,
              combo: d.combo,
              bestCombo: d.bestCombo,
              level: d.level,
              stats: { ...prev.stats, passivePerSec: d.passivePerSec },
            };
          });
          if (data.data.newAchievements?.length) {
            sfxAchievement();
            for (const id of data.data.newAchievements) {
              toast({ title: "Achievement unlocked!", body: id, kind: "rare" });
            }
          }
        } else if (!data.ok && res.status === 401) {
          router.push("/login");
        }
      } catch {
        // network hiccup — clicks already reflected optimistically; next flush syncs
        pendingClicks.current += 0;
      } finally {
        sendingRef.current = false;
      }
    };

    batchTimer.current = setInterval(() => void flush(false), 2500);
    const onHide = () => { if (document.visibilityState === "hidden") void flush(true); };
    const onUnload = () => void flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("nexora:clicks", onClicks);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
      if (batchTimer.current) clearInterval(batchTimer.current);
    };
  }, [toast, router]);

  // Passive income visual tick (server applies the real accrual on each action)
  useEffect(() => {
    const iv = setInterval(() => {
      setStateRaw((s) => {
        if (!s) return s;
        const tick = bn(s.stats.passivePerSec).div(4);
        if (tick.lte(0)) return s;
        return { ...s, energy: bn(s.energy).plus(tick).toFixed(0) };
      });
    }, 250);
    return () => clearInterval(iv);
  }, []);

  /* ------------------------------ Action caller ------------------------------ */
  const act = useCallback(
    async (action: string, params: Record<string, unknown> = {}) => {
      try {
        const res = await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, params }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          toast({ title: data.error ?? "Action failed", kind: "error" });
          return null;
        }
        return data.data as Record<string, unknown>;
      } catch {
        toast({ title: "Network error — please try again", kind: "error" });
        return null;
      }
    },
    [toast],
  );

  const api: GameApi | null = useMemo(
    () => (state ? { state, act, refresh, toast, selectTab: setTab, setState } : null),
    [state, act, refresh, toast, setState],
  );

  /* --------------------------------- Rendering ------------------------------- */

  if (loadError) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center"><Zap className="text-cyan-300" /></div>
        <h1 className="text-xl font-bold text-white">Connection to the grid failed</h1>
        <p className="text-sm text-slate-400 max-w-sm">{loadError}</p>
        <Btn variant="primary" onClick={() => { setLoadError(null); refresh().catch((e) => setLoadError(e.message)); }}>
          Retry
        </Btn>
      </div>
    );
  }

  if (!state || !api) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
        <p className="text-sm text-slate-500 font-mono">attuning to the grid…</p>
      </div>
    );
  }

  const world = worldById.get(state.world);
  const activeBoosts = state.boosts.filter((b) => b.expiresAt > now);

  const NavItems = ({ onPick }: { onPick?: () => void }) => (
    <>
      {NAV_GROUPS.map((g) => (
        <div key={g.group} className="mb-1">
          {!collapsed && (
            <div className="px-3 pt-2.5 pb-1 text-[9px] font-bold uppercase tracking-[0.22em] text-slate-600">{g.group}</div>
          )}
          {collapsed && <div className="h-2" />}
          {g.items.map((n) => {
            const active = tab === n.id;
            const badge = (n.id === "daily" && state.daily.canClaim) || (n.id === "quests" && state.quests.some((q) => !q.claimed && bn(q.progress).gte(q.target)));
            return (
              <button
                key={n.id}
                onClick={() => { setTab(n.id); onPick?.(); }}
                className={`relative w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer group/nav ${
                  active
                    ? "text-white border border-cyan-400/30 bg-gradient-to-r from-cyan-500/[0.16] via-violet-500/[0.10] to-transparent shadow-[inset_0_0_24px_rgba(34,211,238,.06)]"
                    : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent"
                } ${collapsed ? "justify-center px-2" : ""}`}
                title={n.label}
              >
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-gradient-to-b from-cyan-300 to-violet-400 shadow-[0_0_10px_rgba(34,211,238,.8)]" />}
                <n.icon size={17} className={`${active ? "text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,.6)]" : "group-hover/nav:text-slate-300"} transition-colors`} />
                {!collapsed && <span>{n.label}</span>}
                {badge && <span className={`w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,.8)] animate-pulse ${collapsed ? "absolute top-1 right-1" : "ml-auto"}`} />}
              </button>
            );
          })}
        </div>
      ))}
    </>
  );

  return (
    <GameCtx.Provider value={api}>
      <div className="relative min-h-dvh flex flex-col">
        {/* aurora backdrop tinted by current world */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="aurora-blob aurora-a" style={{ background: world?.theme.accent ?? "#22d3ee" }} />
          <div className="aurora-blob aurora-b" style={{ background: "#7c3aed" }} />
          <div className="absolute inset-0" style={{ background: world ? WORLD_THEME_BG[world.id] ?? undefined : undefined }} />
        </div>
        {/* Top bar */}
        <header className="sticky top-0 z-50 border-b border-line bg-abyss/80 backdrop-blur-xl">
          <div className="h-14 px-3 sm:px-5 flex items-center gap-3 max-w-[1600px] mx-auto w-full">
            <button className="lg:hidden p-2 rounded-lg hover:bg-white/5 cursor-pointer" onClick={() => setMobileNav(true)} aria-label="Open menu">
              <Menu size={19} />
            </button>
            <button className="hidden lg:flex p-2 rounded-lg hover:bg-white/5 cursor-pointer" onClick={() => setCollapsed(!collapsed)} aria-label="Collapse navigation">
              <Menu size={17} />
            </button>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setTab("home")}>
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center">
                <Zap size={14} className="text-white" strokeWidth={2.6} />
              </div>
              <span className="font-bold text-white hidden sm:block">NEXORA</span>
            </div>

            <div className="flex-1" />

            {/* currencies */}
            <div className="hidden md:flex items-center gap-2">
              <span className="glass-soft rounded-full px-3 py-1.5 text-xs num font-semibold text-cyan-200" title="Energy">{fmt(state.energy)} ⚡</span>
              <span className="glass-soft rounded-full px-3 py-1.5 text-xs num font-semibold text-fuchsia-300" title="Gems">{state.gems.toLocaleString()} ◆</span>
              {bn(state.shards).gt(0) && <span className="glass-soft rounded-full px-3 py-1.5 text-xs num font-semibold text-cyan-300" title="Neon Shards">{fmt(state.shards)} ✦</span>}
            </div>

            {/* daily shortcut */}
            <button
              onClick={() => setTab("daily")}
              className="relative p-2 rounded-xl hover:bg-white/5 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Daily rewards"
            >
              <Gift size={18} />
              {state.daily.canClaim && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
            </button>

            {/* notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-2 rounded-xl hover:bg-white/5 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Notifications"
                aria-expanded={notifOpen}
              >
                <Bell size={18} />
                {(state.announcement || state.activeEvents.length > 0) && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400" />}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-12 w-80 glass rounded-2xl p-4 anim-pop-in z-50" role="menu">
                  <h3 className="panel-title mb-3">Signals</h3>
                  {state.announcement && (
                    <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/25 p-3 text-xs text-cyan-100 mb-2">{state.announcement}</div>
                  )}
                  {state.activeEvents.map((e) => (
                    <div key={e.id} className="rounded-xl glass-soft p-3 mb-2">
                      <div className="text-xs font-bold text-white">{e.title}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5"><Timer size={11} /> ends in {fmtDuration((e.endsAt - now) / 1000)}</div>
                    </div>
                  ))}
                  {!state.announcement && state.activeEvents.length === 0 && (
                    <p className="text-xs text-slate-500 py-3 text-center">All quiet on the grid.</p>
                  )}
                </div>
              )}
            </div>

            {/* profile chip */}
            <button onClick={() => setTab("profile")} className="flex items-center gap-2.5 rounded-xl pl-1.5 pr-2.5 py-1.5 hover:bg-white/5 transition-colors cursor-pointer">
              <Avatar seed={state.avatarSeed} size={30} />
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-white leading-tight">{state.user.username}</div>
                <div className="text-[10px] text-slate-400 leading-tight">Lv {state.level} · {state.title ?? "Newcomer"}</div>
              </div>
            </button>
            <LogoutButton />
          </div>

          {/* Active boosts + event strip */}
          {now > 0 && (activeBoosts.length > 0 || state.activeEvents.length > 0) && (
            <div className="border-t border-line/60 px-3 sm:px-5 py-1.5 flex items-center gap-3 overflow-x-auto max-w-[1600px] mx-auto w-full">
              {state.activeEvents.map((e) => (
                <span key={e.id} className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold text-cyan-200 bg-cyan-500/10 border border-cyan-500/25 rounded-full px-2.5 py-0.5">
                  <CalendarClock size={11} /> {e.title} · <span className="num">{fmtClock((e.endsAt - now) / 1000)}</span>
                </span>
              ))}
              {activeBoosts.map((b) => (
                <span key={b.id} className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold text-fuchsia-200 bg-fuchsia-500/10 border border-fuchsia-500/25 rounded-full px-2.5 py-0.5">
                  <Zap size={11} /> {b.name} ×{b.mult} · <span className="num">{fmtClock((b.expiresAt - now) / 1000)}</span>
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="flex-1 flex max-w-[1600px] mx-auto w-full">
          {/* Sidebar (desktop) */}
          <aside className={`hidden lg:flex flex-col gap-1 p-3 border-r border-line shrink-0 sticky top-14 self-start h-[calc(100dvh-3.5rem)] overflow-y-auto transition-all ${collapsed ? "w-[68px]" : "w-52"}`}>
            <NavItems />
          </aside>

          {/* Mobile nav drawer */}
          {mobileNav && (
            <div className="fixed inset-0 z-[80] lg:hidden anim-fade-in">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileNav(false)} />
              <div className="absolute left-0 top-0 bottom-0 w-72 bg-ink border-r border-line p-3 flex flex-col gap-1 overflow-y-auto anim-pop-in">
                <div className="flex items-center justify-between px-2 py-2 mb-1">
                  <span className="font-bold text-white flex items-center gap-2"><Zap size={16} className="text-cyan-300" /> NEXORA</span>
                  <button onClick={() => setMobileNav(false)} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer" aria-label="Close menu"><X size={17} /></button>
                </div>
                <NavItems onPick={() => setMobileNav(false)} />
              </div>
            </div>
          )}

          {/* Main */}
          <main className="flex-1 min-w-0 p-3 sm:p-5 pb-24 lg:pb-8">
            <TabContent tab={tab} />
          </main>
        </div>

        {/* Mobile bottom bar */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-[60] border-t border-line bg-ink/90 backdrop-blur-xl">
          <div className="grid grid-cols-5">
            {(["home", "upgrades", "pets", "quests", "shop"] as GameTab[]).map((id) => {
              const n = NAV.find((x) => x.id === id)!;
              const active = tab === id;
              return (
                <button key={id} onClick={() => setTab(id)} className={`flex flex-col items-center gap-0.5 py-2.5 cursor-pointer ${active ? "text-cyan-300" : "text-slate-500"}`}>
                  <n.icon size={18} />
                  <span className="text-[9px] font-semibold">{n.label}</span>
                </button>
              );
            })}
            <button onClick={() => setMobileNav(true)} className="flex flex-col items-center gap-0.5 py-2.5 text-slate-500 cursor-pointer absolute" style={{ display: "none" }}>
              <Menu size={18} />
            </button>
          </div>
        </nav>

        {/* Toasts */}
        <div className="fixed bottom-20 lg:bottom-6 right-4 z-[95] flex flex-col gap-2 items-end pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`anim-toast pointer-events-auto glass rounded-2xl px-4 py-3 max-w-xs border ${
                t.kind === "error" ? "border-rose-500/40" : t.kind === "rare" ? "border-amber-400/40" : "border-cyan-500/30"
              }`}
              role="status"
            >
              <div className={`text-sm font-bold ${t.kind === "error" ? "text-rose-300" : t.kind === "rare" ? "text-amber-300" : "text-white"}`}>{t.title}</div>
              {t.body && <div className="text-[11px] text-slate-400 mt-0.5">{t.body}</div>}
            </div>
          ))}
        </div>

        {/* Offline earnings modal */}
        <Modal open={!!offlineModal} onClose={() => setOfflineModal(null)} title="Welcome back, operator">
          <div className="text-center py-4">
            <Moon size={36} className="mx-auto text-violet-300 mb-3" />
            <p className="text-sm text-slate-300">While you were away, your grid kept harvesting:</p>
            <div className="num text-3xl font-bold text-cyan-300 text-glow mt-3">+{fmt(offlineModal ?? "0")}</div>
            <p className="text-[11px] text-slate-500 mt-2">Offline earnings run at 50% efficiency. Upgrade the Offline Capacitor to extend the window.</p>
          </div>
          <Btn variant="primary" className="w-full" onClick={() => setOfflineModal(null)}>Collect</Btn>
        </Modal>
      </div>
    </GameCtx.Provider>
  );
}

function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
      className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
      title="Sign out"
    >
      <LogOut size={17} />
    </button>
  );
}

function TabContent({ tab }: { tab: GameTab }) {
  switch (tab) {
    case "home": return <HomePanel stage={<ClickStage />} />;
    case "upgrades": return <UpgradesPanel />;
    case "pets": return <PetsPanel />;
    case "eggs": return <EggsPanel />;
    case "rebirth": return <RebirthPanel />;
    case "worlds": return <WorldsPanel />;
    case "quests": return <QuestsPanel />;
    case "achievements": return <AchievementsPanel />;
    case "collection": return <CollectionPanel />;
    case "shop": return <ShopPanel />;
    case "leaderboards": return <LeaderboardsPanel />;
    case "events": return <EventsPanel />;
    case "daily": return <DailyPanel />;
    case "codes": return <CodesPanel />;
    case "settings": return <SettingsPanel />;
    case "profile": return <ProfilePanel />;
  }
}

export { sfxRebirth };
