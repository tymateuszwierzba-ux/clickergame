"use client";

import { type ReactNode, useState } from "react";
import { ArrowUpCircle, Sparkles, Target, Zap, Lock, ChevronRight, Gauge } from "lucide-react";
import { bn, fmt, fmtDuration } from "@/lib/num";
import { UPGRADES, upgradePrice, bulkPrice, maxAffordable, levelFromClicks, ACHIEVEMENTS } from "@/config/game";
import { maxLevelsAffordable } from "@/lib/engine";
import { Panel, StatTile, Btn, Progress, Empty } from "@/components/ui";
import { useGame } from "./context";
import { sfxPurchase } from "./sound";

/* ---------------------------------- HOME ----------------------------------- */

export function HomePanel({ stage }: { stage: ReactNode }) {
  const { state, selectTab } = useGame();

  // Next achievement milestone
  const metricValue = (m: string): number => {
    switch (m) {
      case "clicks": return state.totalClicks;
      case "hatches": return state.hatchedTotal;
      case "pets": return state.pets.length;
      case "quests": return state.questsClaimed;
      case "codes": return state.codesRedeemed;
      case "streak": return state.daily.streak;
      case "secrets": return state.secretHatches;
      case "rebirths": return state.resets.rebirth ?? 0;
      default: return 0;
    }
  };
  const nextAch = state.achievements
    .filter((a) => !a.unlocked && !a.hidden)
    .map((a) => ({ a, v: a.metric === "earned" ? bn(state.lifetimeEarned).toNumber() : metricValue(a.metric), t: Number((ACHIEVEMENTS.find(x => x.id === a.id)?.target) ?? 1) }))
    .filter((x) => x.t > 0)
    .sort((x, y) => x.v / x.t - y.v / y.t)
    .map((x) => ({ ...x }))[0];

  const nextDaily = state.quests.filter((q) => q.kind === "daily" && !q.claimed)[0];

  // First affordable upgrade
  const affordable = UPGRADES.filter((u) =>
    bn(state.energy).gte(upgradePrice(u.baseCost, u.growth, state.upgrades[u.id] ?? 0)),
  )
    .sort((a, b) => (upgradePrice(a.baseCost, a.growth, state.upgrades[a.id] ?? 0).comparedTo(upgradePrice(b.baseCost, b.growth, state.upgrades[b.id] ?? 0)) ?? 0));

  // Level progress
  const clicksNow = state.totalClicks;
  const lvl = levelFromClicks(clicksNow);
  const prevReq = 40 * Math.pow(lvl, 2.4);
  const nextReq = 40 * Math.pow(lvl + 1, 2.4);
  const lvlPct = ((clicksNow - prevReq) / Math.max(1, nextReq - prevReq)) * 100;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
      <Panel className="relative overflow-hidden">
        {stage}
      </Panel>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 xl:grid-cols-1 gap-3">
          <StatTile label="Global Multiplier" value={`×${Number(state.stats.globalMult).toLocaleString("en-US", { maximumFractionDigits: 2 })}`} accent="#a78bfa" icon={<Sparkles size={12} />} sub={`from resets, worlds, pets & boosts`} />
          <StatTile label="Lifetime Earned" value={fmt(state.lifetimeEarned)} accent="#22d3ee" icon={<Zap size={12} />} sub={`Best combo ×${state.bestCombo}`} />
        </div>

        <Panel title="Account Level" right={<span className="num text-xs text-cyan-300 font-bold">Lv {state.level}</span>}>
          <Progress value={lvlPct} max={100} />
          <p className="text-[11px] text-slate-500 mt-2">{fmt(Math.max(0, nextReq - clicksNow))} more clicks to level {state.level + 1}. Levels scale your daily quest rewards.</p>
        </Panel>

        {nextAch && (
          <Panel title="Next Milestone" right={<Target size={14} className="text-amber-300" />}>
            <div className="text-sm font-bold text-white">{nextAch.a.name}</div>
            <div className="text-[11px] text-slate-400 mb-2">{nextAch.a.desc}</div>
            <Progress value={Math.min(nextAch.v, nextAch.t)} max={nextAch.t} />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1.5 num">
              <span>{fmt(nextAch.v)}</span>
              <span>{fmt(nextAch.t)}</span>
            </div>
          </Panel>
        )}

        {nextDaily && (
          <Panel title="Featured Quest" right={<button onClick={() => selectTab("quests")} className="text-[10px] text-cyan-300 hover:text-cyan-200 font-semibold inline-flex items-center gap-0.5 cursor-pointer">All quests <ChevronRight size={11} /></button>}>
            <div className="text-sm font-bold text-white">{nextDaily.name}</div>
            <div className="text-[11px] text-slate-400 mb-2">{nextDaily.desc}</div>
            <Progress value={Math.min(bn(nextDaily.progress).toNumber(), nextDaily.target)} max={nextDaily.target} />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1.5 num">
              <span>{fmt(nextDaily.progress)}</span>
              <span>{nextDaily.target.toLocaleString()}</span>
            </div>
            <div className="mt-2 text-[10px] text-fuchsia-300 font-semibold">Reward: {nextDaily.rewardGems} gems{nextDaily.rewardShards > 0 ? ` + ${nextDaily.rewardShards} shards` : ""}</div>
          </Panel>
        )}

        {affordable[0] && (
          <Panel title="Recommended Upgrade" right={<button onClick={() => selectTab("upgrades")} className="text-[10px] text-cyan-300 hover:text-cyan-200 font-semibold inline-flex items-center gap-0.5 cursor-pointer">Open <ChevronRight size={11} /></button>}>
            <div className="text-sm font-bold text-white">{affordable[0].name}</div>
            <div className="text-[11px] text-slate-400">{affordable[0].effectText((state.upgrades[affordable[0].id] ?? 0) + 1)}</div>
            <UpgradeBuyRow defId={affordable[0].id} compact />
          </Panel>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- UPGRADES ---------------------------------- */

const PREREQS: Record<string, { text: string; ok: (s: { resets: Record<string, number>; upgrades: Record<string, number> }) => boolean }> = {
  "neon-resonance": { text: "Complete 1 rebirth to unlock", ok: (s) => (s.resets.rebirth ?? 0) >= 1 },
  "overclock-efficiency": { text: "Reach account level 5 (via stat)", ok: () => true },
};

export function UpgradesPanel() {
  const { state } = useGame();
  const [filter, setFilter] = useState<string>("all");
  const cats = ["all", ...new Set(UPGRADES.map((u) => u.category))];
  const list = UPGRADES.filter((u) => filter === "all" || u.category === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Upgrades</h1>
          <p className="text-xs text-slate-500">Power is purchased with energy. Prices rise exponentially — buy in bulk to save clicks, not energy.</p>
        </div>
        <div className="glass-soft rounded-full px-4 py-1.5 num text-sm font-bold text-cyan-200">{fmt(state.energy)} energy</div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-colors cursor-pointer ${filter === c ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40" : "glass-soft text-slate-400 hover:text-white"}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {list.map((u) => {
          const pre = PREREQS[u.id];
          const locked = pre ? !pre.ok(state) : false;
          return (
            <div key={u.id} className={`glass rounded-2xl p-4 flex flex-col gap-2.5 relative overflow-hidden ${locked ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    {u.name}
                    {locked && <Lock size={12} className="text-slate-500" />}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">{u.category}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500">Level</div>
                  <div className="num font-bold text-cyan-300">{state.upgrades[u.id] ?? 0}<span className="text-slate-600 text-[10px]">/{u.maxLevel >= 1000 ? "∞" : u.maxLevel}</span></div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed min-h-8">{locked ? pre!.text : u.description}</p>
              <div className="text-[11px] glass-soft rounded-lg px-2.5 py-1.5 text-emerald-300 font-medium">{u.effectText(state.upgrades[u.id] ?? 0)}</div>
              {locked ? (
                <Btn disabled size="sm"><Lock size={12} /> Locked</Btn>
              ) : (
                <UpgradeBuyRow defId={u.id} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function UpgradeBuyRow({ defId, compact }: { defId: string; compact?: boolean }) {
  const { state, act, refresh, toast } = useGame();
  const [busy, setBusy] = useState<string | null>(null);
  const def = UPGRADES.find((u) => u.id === defId)!;
  const level = state.upgrades[defId] ?? 0;
  const energy = bn(state.energy);

  const p1 = upgradePrice(def.baseCost, def.growth, level);
  const p10 = bulkPrice(def.baseCost, def.growth, level, 10);
  const maxN = maxLevelsAffordable(defId, level, energy.toFixed(0));
  const pMax = maxN > 0 ? bulkPrice(def.baseCost, def.growth, level, maxN) : bn(0);
  const maxed = level >= def.maxLevel;

  const buy = async (mode: "1" | "10" | "max") => {
    setBusy(mode);
    const res = await act("buyUpgrade", { upgradeId: defId, mode });
    setBusy(null);
    if (res) {
      sfxPurchase();
      toast({ title: `${def.name} → Lv ${res.newLevel}`, body: `Bought ${res.bought} level${res.bought === 1 ? "" : "s"}` });
      await refresh();
    }
  };

  if (maxed) return <Btn disabled size="sm" variant="success">Maxed out</Btn>;

  const size = compact ? "xs" : "sm";
  return (
    <div className="flex gap-1.5 flex-wrap">
      <Btn size={size} variant="primary" loading={busy === "1"} disabled={energy.lt(p1)} onClick={() => buy("1")} title={`Buy 1 level for ${fmt(p1)}`}>
        Buy 1 · <span className="num">{fmt(p1)}</span>
      </Btn>
      <Btn size={size} loading={busy === "10"} disabled={energy.lt(upgradePrice(def.baseCost, def.growth, level))} onClick={() => buy("10")} title={`Cost for 10 levels: ${fmt(p10)}`}>
        ×10 · <span className="num">{fmt(p10)}</span>
      </Btn>
      <Btn size={size} variant="outline" loading={busy === "max"} disabled={maxN <= 0} onClick={() => buy("max")} title={maxN > 0 ? `${maxN} levels for ${fmt(pMax)}` : "Cannot afford any level"}>
        Max {maxN > 0 ? `(${maxN > 999 ? "999+" : maxN})` : ""}
      </Btn>
    </div>
  );
}
