"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ScrollText, Medal, LibraryBig, Gem, Trophy, CalendarClock, Gift, Ticket, Settings as SettingsIcon,
  Check, Clock, Search, ChevronLeft, ChevronRight, CalendarDays, Timer, Volume2, VolumeX, Music, UserRound,
} from "lucide-react";
import { bn, fmt, fmtDuration, fmtClock } from "@/lib/num";
import { WORLDS, RARITIES, DAILY_REWARDS, SHOP_ITEMS, EVENT_KINDS, TITLES, PETS } from "@/config/game";
import { Panel, Btn, Progress, Empty, TextInput, Field, Toggle, Modal } from "@/components/ui";
import { PetIcon, Avatar } from "@/components/art";
import { useGame, useNow } from "./context";
import { setSfxEnabled, setMusicEnabled, setVolume, sfxAchievement } from "./sound";

/* --------------------------------- QUESTS ----------------------------------- */

export function QuestsPanel() {
  const { state, act, refresh, toast } = useGame();
  const [busy, setBusy] = useState<string | null>(null);

  const claim = async (qid: string, period: string) => {
    setBusy(qid);
    const res = await act("claimQuest", { questId: qid, period });
    setBusy(null);
    if (res) {
      sfxAchievement();
      toast({ title: "Quest complete!", body: `+${res.gems} gems${Number(res.shards) > 0 ? ` · +${res.shards} shards` : ""} · +${fmt(String(res.energy))} energy`, kind: "rare" });
      await refresh();
    }
  };

  const groups = [
    { title: "Daily quests", kind: "daily" as const, note: "Reset every day at 00:00 UTC" },
    { title: "Weekly quests", kind: "weekly" as const, note: "Reset every Monday" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Quests</h1>
        <p className="text-xs text-slate-500">Objectives tuned to your account level. {state.questsClaimed} claimed lifetime.</p>
      </div>
      {groups.map((g) => (
        <Panel key={g.kind} title={g.title} right={<span className="text-[10px] text-slate-500">{g.note}</span>}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {state.quests.filter((q) => q.kind === g.kind).map((q) => {
              const prog = bn(q.progress);
              const done = prog.gte(q.target);
              return (
                <div key={`${q.id}-${q.period}`} className={`glass-soft rounded-xl p-3.5 border ${done && !q.claimed ? "border-emerald-500/40" : "border-transparent"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-white text-sm">{q.name}</div>
                    {q.claimed ? <Check size={15} className="text-emerald-400" /> : done ? <span className="text-[9px] font-bold text-emerald-300 tracking-widest">READY</span> : <Clock size={13} className="text-slate-500" />}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 min-h-8">{q.desc}</div>
                  <Progress value={Math.min(prog.toNumber(), q.target)} max={q.target} />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 num">
                    <span>{fmt(q.progress)}</span><span>{q.target.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-[10px] text-fuchsia-300 font-semibold num">◆ {q.rewardGems}{q.rewardShards > 0 ? ` · ✦ ${q.rewardShards}` : ""}</span>
                    {q.claimed ? (
                      <span className="text-[10px] text-slate-600 font-semibold">CLAIMED</span>
                    ) : (
                      <Btn size="xs" variant={done ? "primary" : "ghost"} disabled={!done} loading={busy === q.id} onClick={() => claim(q.id, q.period)}>
                        Claim
                      </Btn>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      ))}
    </div>
  );
}

/* ------------------------------- ACHIEVEMENTS -------------------------------- */

export function AchievementsPanel() {
  const { state } = useGame();
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");
  const [query, setQuery] = useState("");
  const list = state.achievements.filter((a) => {
    if (filter === "unlocked" && !a.unlocked) return false;
    if (filter === "locked" && a.unlocked) return false;
    if (query && !a.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });
  const total = state.achievements.length;
  const unlocked = state.unlockedAchievementCount;
  const title = [...TITLES].reverse().find((t) => state.achievementPoints >= t.points) ?? TITLES[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Achievements</h1>
          <p className="text-xs text-slate-500">{unlocked}/{total} unlocked · <span className="text-amber-300 font-semibold">{state.achievementPoints} points</span> · Title: <span className="text-cyan-300">{title.title}</span></p>
        </div>
        <div className="w-52"><Progress value={unlocked} max={total} /></div>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <TextInput placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 !py-2 w-48" />
        </div>
        {(["all", "unlocked", "locked"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize cursor-pointer ${filter === f ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40" : "glass-soft text-slate-400"}`}>{f}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((a) => (
          <div key={a.id} className={`glass-soft rounded-xl p-3.5 flex gap-3 items-start border ${a.unlocked ? "border-amber-400/30" : "border-transparent"} ${!a.unlocked && a.hidden ? "opacity-70" : ""}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${a.unlocked ? "bg-amber-400/15 text-amber-300" : "bg-white/5 text-slate-600"}`}>
              <Medal size={16} />
            </div>
            <div className="min-w-0">
              <div className={`text-sm font-bold ${a.unlocked ? "text-white" : "text-slate-300"}`}>{a.name}</div>
              <div className="text-[11px] text-slate-500 leading-snug">{a.desc}</div>
              <div className="text-[10px] text-amber-300/90 font-semibold mt-1">{a.points} pts{a.unlocked && a.unlockedAt ? ` · ${new Date(a.unlockedAt).toLocaleDateString()}` : ""}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- COLLECTION --------------------------------- */

export function CollectionPanel() {
  const { state } = useGame();
  const owned = useMemo(() => new Map(state.pets.map((p) => [p.defId, p.variant])), [state.pets]);
  const totalOwned = owned.size;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Collection</h1>
          <p className="text-xs text-slate-500">{totalOwned}/{PETS.length} unique companions discovered.</p>
        </div>
        <div className="w-52"><Progress value={totalOwned} max={PETS.length} /></div>
      </div>
      {WORLDS.map((w) => {
        const worldPets = PETS.filter((p) => p.worldId === w.id);
        const got = worldPets.filter((p) => owned.has(p.defId)).length;
        return (
          <Panel key={w.id} title={`${w.name} — ${got}/8`} right={<span className="num text-[10px]" style={{ color: w.theme.accent }}>+{w.bonusPct}% world bonus</span>}>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {worldPets.map((p) => {
                const variant = owned.get(p.defId);
                return (
                  <div key={p.defId} className={`rounded-xl p-2 text-center ${variant ? `rarity-${p.rarity} rarity-card` : "glass-soft opacity-45"}`} title={`${p.name} — ${p.rarity}`}>
                    <div className="flex justify-center"><PetIcon defId={p.defId} size={40} /></div>
                    <div className={`text-[9px] font-semibold truncate mt-1 ${variant ? "text-white" : "text-slate-500"}`}>{p.name}</div>
                    {variant && variant !== "normal" && <div className={`text-[8px] font-bold ${variant === "golden" ? "text-amber-300" : "text-fuchsia-300"}`}>{variant.toUpperCase()}</div>}
                  </div>
                );
              })}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

/* ----------------------------------- SHOP ------------------------------------ */

export function ShopPanel() {
  const { state, act, refresh, toast } = useGame();
  const [busy, setBusy] = useState<string | null>(null);

  const buy = async (itemId: string) => {
    setBusy(itemId);
    const res = await act("buyShop", { itemId });
    setBusy(null);
    if (res) {
      toast({ title: "Purchased!", kind: "rare" });
      await refresh();
    }
  };

  const slotOrders = 0; // derived server-side; display purchased via maxEquipped

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Shop</h1>
          <p className="text-xs text-slate-500">Boosters and quality-of-life upgrades. Gems are earned in-game — quests, dailies, achievements, codes.</p>
        </div>
        <div className="glass-soft rounded-full px-4 py-1.5 num text-sm font-bold text-fuchsia-300">◆ {state.gems.toLocaleString()} gems</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SHOP_ITEMS.map((item) => {
          const afford = state.gems >= item.gemCost;
          const active = item.type === "boost" && state.boosts.some((b) => b.id === item.id && b.expiresAt > Date.now());
          return (
            <div key={item.id} className="glass rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-fuchsia-500/10 blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm">{item.name}</span>
                {active && <span className="text-[9px] font-bold text-emerald-300 tracking-widest">ACTIVE</span>}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed flex-1">{item.desc}</p>
              {item.type === "boost" && (
                <div className="text-[10px] text-slate-500">Duration extends +25%/level with Overclock Efficiency upgrade.</div>
              )}
              <Btn variant={afford ? "primary" : "ghost"} disabled={!afford} loading={busy === item.id} onClick={() => buy(item.id)}>
                <Gem size={13} /> {item.gemCost} gems
              </Btn>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------- LEADERBOARDS -------------------------------- */

const LB_CATS = [
  { id: "clicks", label: "Total Clicks" },
  { id: "earned", label: "Energy Earned" },
  { id: "rebirths", label: "Rebirths" },
  { id: "gems", label: "Gems" },
  { id: "pets", label: "Pets Owned" },
  { id: "achievements", label: "Achievements" },
  { id: "playtime", label: "Playtime" },
] as const;

interface LBEntry { rank: number; userId: string; username: string; title: string | null; level: number; avatarSeed: string; value: number; isYou: boolean }

export function LeaderboardsPanel() {
  const [cat, setCat] = useState<(typeof LB_CATS)[number]["id"]>("clicks");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ entries: LBEntry[]; yourRank: number | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => { if (!cancelled) setLoading(true); }, 0);
    fetch(`/api/leaderboard?category=${cat}&page=${page}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d.ok ? d.data : null); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { clearTimeout(t); if (!cancelled) setLoading(false); });
    return () => { cancelled = true; clearTimeout(t); };
  }, [cat, page]);

  const fmtVal = (v: number) => (cat === "playtime" ? fmtDuration(v) : fmt(v));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Leaderboards</h1>
          <p className="text-xs text-slate-500">Ranked live from the server. Staff accounts are excluded.</p>
        </div>
        {data?.yourRank && (
          <div className="glass-soft rounded-full px-4 py-1.5 text-xs font-bold text-amber-300">Your rank: #{data.yourRank}</div>
        )}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {LB_CATS.map((c) => (
          <button key={c.id} onClick={() => { setCat(c.id); setPage(1); }} className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold cursor-pointer ${cat === c.id ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40" : "glass-soft text-slate-400 hover:text-white"}`}>
            {c.label}
          </button>
        ))}
      </div>
      <Panel>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-11 rounded-xl bg-white/5 animate-pulse" />)}</div>
        ) : !data || data.entries.length === 0 ? (
          <Empty icon={<Trophy size={22} />} title="No scores yet" body="Be the first to etch your name into the grid." />
        ) : (
          <>
            <div className="space-y-1.5">
              {data.entries.map((e) => (
                <div key={e.userId} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${e.isYou ? "bg-cyan-500/10 border border-cyan-500/30" : e.rank <= 3 ? "glass-soft border border-amber-400/15" : "glass-soft"}`}>
                  <span className={`num w-8 text-center text-sm font-bold ${e.rank === 1 ? "text-amber-300" : e.rank === 2 ? "text-slate-200" : e.rank === 3 ? "text-amber-600" : "text-slate-500"}`}>
                    {e.rank}
                  </span>
                  <Avatar seed={e.avatarSeed} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white truncate">{e.username}{e.isYou && <span className="text-[9px] text-cyan-300 font-bold ml-1.5">YOU</span>}</div>
                    <div className="text-[10px] text-slate-500">Lv {e.level} · {e.title ?? "Newcomer"}</div>
                  </div>
                  <span className="num text-sm font-bold text-cyan-200">{fmtVal(e.value)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4">
              <Btn size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={14} /> Prev</Btn>
              <span className="text-[11px] text-slate-500 num">Page {page}</span>
              <Btn size="sm" disabled={data.entries.length < 25} onClick={() => setPage(page + 1)}>Next <ChevronRight size={14} /></Btn>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

/* ---------------------------------- EVENTS ----------------------------------- */

export function EventsPanel() {
  const { state } = useGame();
  const now = useNow(1000);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Live Events</h1>
        <p className="text-xs text-slate-500">Global modifiers activated by the operations team. Effects apply to all players instantly.</p>
      </div>
      <Panel title="Active now">
        {state.activeEvents.length === 0 ? (
          <Empty icon={<CalendarClock size={22} />} title="No events running" body="Check back soon — events launch regularly. Watch the signal bar up top." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {state.activeEvents.map((e) => (
              <div key={e.id} className="rounded-2xl p-4 border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-violet-500/10 relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-cyan-400/15 blur-2xl animate-pulse-soft" />
                <div className="font-bold text-white">{e.title}</div>
                <p className="text-[11px] text-slate-300 mt-1">{e.description}</p>
                <div className="mt-2 flex items-center gap-3 text-[11px]">
                  {e.params.energyMult && <span className="text-cyan-300 font-semibold">×{e.params.energyMult} energy</span>}
                  {e.params.clickMult && <span className="text-violet-300 font-semibold">×{e.params.clickMult} clicks</span>}
                  {e.params.luckBonus && <span className="text-emerald-300 font-semibold">+{e.params.luckBonus} luck</span>}
                </div>
                <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-amber-300 num"><Timer size={12} /> {fmtClock((e.endsAt - now) / 1000)} remaining</div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Event catalogue">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {EVENT_KINDS.map((k) => (
            <div key={k.id} className="glass-soft rounded-xl p-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: k.color }} />
                <span className="text-xs font-bold text-white">{k.name}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{k.desc}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ----------------------------------- DAILY ----------------------------------- */

export function DailyPanel() {
  const { state, act, refresh, toast } = useGame();
  const [busy, setBusy] = useState(false);

  const claimDay = state.daily.day;

  const claim = async () => {
    setBusy(true);
    const res = await act("claimDaily");
    setBusy(false);
    if (res) {
      sfxAchievement();
      toast({ title: `Day ${res.day} reward claimed!`, body: `+${res.gems} gems · +${fmt(String(res.energy))} energy${Number(res.shards) > 0 ? ` · +${res.shards} shards` : ""}`, kind: "rare" });
      await refresh();
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-white">Daily Rewards</h1>
        <p className="text-xs text-slate-500">Claim once per day (UTC). Streak: <span className="text-amber-300 font-bold">{state.daily.streak} day{state.daily.streak === 1 ? "" : "s"}</span> — miss a day and the cycle restarts.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {DAILY_REWARDS.map((r) => {
          const isToday = r.day === claimDay;
          const claimedBefore = state.daily.streak > 0 && r.day < claimDay;
          const claimable = isToday && state.daily.canClaim;
          return (
            <div key={r.day} className={`rounded-2xl p-3 text-center border relative overflow-hidden ${
              claimable ? "border-amber-400/50 bg-gradient-to-b from-amber-400/15 to-transparent shadow-[0_0_24px_rgba(251,191,36,.15)]" : claimedBefore ? "border-emerald-500/30 glass-soft" : "glass"
            }`}>
              {r.day === 7 && <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-300 to-transparent" />}
              <div className="text-[9px] font-bold tracking-widest text-slate-500">DAY {r.day}</div>
              <div className="my-1.5"><Gift size={20} className={`mx-auto ${claimable ? "text-amber-300" : claimedBefore ? "text-emerald-400" : "text-slate-400"}`} /></div>
              <div className="text-[10px] font-bold text-white truncate">{r.label}</div>
              <div className="text-[9px] text-slate-400 mt-0.5 leading-snug">
                ◆{r.gems}{r.shards > 0 ? <><br />✦{r.shards} shards</> : null}<br />+{Math.round(r.energyPctOfLifetime * 100)}% of lifetime
              </div>
              {claimedBefore && <div className="text-[9px] font-bold text-emerald-400 mt-1">CLAIMED</div>}
              {claimable && <div className="text-[9px] font-bold text-amber-300 mt-1 animate-pulse">TODAY</div>}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <Btn variant="primary" size="lg" disabled={!state.daily.canClaim} loading={busy} onClick={claim}>
          <CalendarDays size={17} /> {state.daily.canClaim ? `Claim Day ${claimDay}` : "Claimed — come back tomorrow"}
        </Btn>
      </div>
    </div>
  );
}

/* ----------------------------------- CODES ----------------------------------- */

export function CodesPanel() {
  const { state, act, refresh, toast } = useGame();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const redeem = async () => {
    if (!code.trim()) return;
    setBusy(true);
    const res = await act("redeemCode", { code });
    setBusy(false);
    if (res) {
      sfxAchievement();
      const r = res.reward as { energy?: string; gems?: number; shards?: number };
      toast({
        title: `Code ${res.code} redeemed!`,
        body: [r.energy ? `+${fmt(r.energy)} energy` : null, r.gems ? `+${r.gems} gems` : null, r.shards ? `+${r.shards} shards` : null].filter(Boolean).join(" · "),
        kind: "rare",
      });
      setCode("");
      await refresh();
    }
  };

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <h1 className="text-xl font-bold text-white">Codes</h1>
        <p className="text-xs text-slate-500">Promotional codes are dropped during events and in announcements. Redeemed: {state.codesRedeemed}.</p>
      </div>
      <Panel>
        <Field label="Enter code">
          <div className="flex gap-2">
            <TextInput placeholder="e.g. NEXORA2026" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && redeem()} maxLength={32} />
            <Btn variant="primary" loading={busy} onClick={redeem}>Redeem</Btn>
          </div>
        </Field>
        <p className="text-[11px] text-slate-500 mt-3">One redemption per account per code. Codes can expire or run out of global claims.</p>
      </Panel>
    </div>
  );
}

/* --------------------------------- SETTINGS ---------------------------------- */

export function SettingsPanel() {
  const { state, act, refresh, toast } = useGame();
  const settings = state.settings as { sfx?: boolean; music?: boolean; volume?: number; particles?: boolean };
  const [busy, setBusy] = useState(false);

  const save = async (patch: Record<string, unknown>) => {
    setBusy(true);
    await act("saveSettings", { settings: patch });
    await refresh();
    setBusy(false);
    toast({ title: "Settings saved" });
  };

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-xs text-slate-500">Saved to your account — they follow you across devices.</p>
      </div>
      <Panel title="Audio">
        <Toggle label="Sound effects" checked={settings.sfx !== false} onChange={(v) => { setSfxEnabled(v); void save({ sfx: v }); }} />
        <Toggle label="Ambient drone" checked={!!settings.music} onChange={(v) => { setMusicEnabled(v); void save({ music: v }); }} />
        <div className="py-2">
          <div className="flex items-center justify-between text-sm text-slate-300 mb-2">
            <span className="inline-flex items-center gap-2">{settings.volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />} Master volume</span>
            <span className="num text-xs text-slate-500">{Math.round((settings.volume ?? 0.5) * 100)}%</span>
          </div>
          <input
            type="range" min={0} max={100} value={Math.round((settings.volume ?? 0.5) * 100)}
            onChange={(e) => { setVolume(Number(e.target.value) / 100); }}
            onMouseUp={() => void save({ volume: Number((document.querySelector<HTMLInputElement>("input[type=range]")?.value ?? 50)) / 100 })}
            onTouchEnd={() => void save({ volume: Number((document.querySelector<HTMLInputElement>("input[type=range]")?.value ?? 50)) / 100 })}
            className="w-full accent-cyan-400"
            aria-label="Master volume"
          />
        </div>
      </Panel>
      <Panel title="Accessibility">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Motion automatically respects your system reduced-motion preference. All interactions work with keyboard (Tab to navigate, Space/Enter on the core to click).
        </p>
      </Panel>
      {busy && <p className="text-[11px] text-slate-600">Saving…</p>}
    </div>
  );
}

/* ---------------------------------- PROFILE ---------------------------------- */

export function ProfilePanel() {
  const { state } = useGame();
  const title = [...TITLES].reverse().find((t) => state.achievementPoints >= t.points) ?? TITLES[0];
  const rows: [string, string][] = [
    ["Lifetime energy", fmt(state.lifetimeEarned)],
    ["Total clicks", state.totalClicks.toLocaleString()],
    ["Best combo", `×${state.bestCombo}`],
    ["Rebirths", String(state.resets.rebirth ?? 0)],
    ["Prestiges", String(state.resets.prestige ?? 0)],
    ["Ascensions", String(state.resets.ascension ?? 0)],
    ["Galaxy resets", String(state.resets.galaxy ?? 0)],
    ["Pets owned", String(state.pets.length)],
    ["Eggs hatched", state.hatchedTotal.toLocaleString()],
    ["Secret pets", String(state.secretHatches)],
    ["Quests claimed", String(state.questsClaimed)],
    ["Codes redeemed", String(state.codesRedeemed)],
    ["Play time", fmtDuration(state.playSeconds)],
  ];
  return (
    <div className="space-y-4 max-w-2xl">
      <Panel>
        <div className="flex items-center gap-4">
          <Avatar seed={state.avatarSeed} size={64} />
          <div>
            <h1 className="text-xl font-bold text-white">{state.user.username}</h1>
            <div className="text-xs text-slate-400">Level {state.level} · <span className="text-cyan-300 font-semibold">{title.title}</span></div>
            <div className="text-[11px] text-slate-500 mt-0.5">{state.achievementPoints} achievement points · {state.unlockedAchievementCount} unlocked</div>
          </div>
        </div>
      </Panel>
      <Panel title="Lifetime statistics">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {rows.map(([k, v]) => (
            <div key={k} className="glass-soft rounded-xl px-3 py-2.5">
              <div className="text-[9px] uppercase tracking-widest text-slate-500">{k}</div>
              <div className="num text-sm font-bold text-white mt-0.5">{v}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
