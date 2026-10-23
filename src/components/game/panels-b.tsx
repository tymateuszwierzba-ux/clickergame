"use client";

import { useMemo, useState } from "react";
import { Search, Star, ArrowUpDown, Merge, CheckCircle2, Lock, ChevronRight, Egg as EggIcon, Sparkles } from "lucide-react";
import { bn, fmt, fmtInt, BigNumber } from "@/lib/num";
import { WORLDS, RARITIES, PITY_THRESHOLD, worldById, VARIANT_MULT } from "@/config/game";
import { adjustedWeights, log10Big } from "@/lib/engine";
import { Panel, Btn, Modal, Progress, Empty, TextInput } from "@/components/ui";
import { PetIcon, EggIcon as EggArt } from "@/components/art";
import { useGame } from "./context";
import type { ClientPet } from "@/types/client";
import { sfxHatch, sfxRebirth } from "./sound";

/* --------------------------------- HELPERS ---------------------------------- */

export function RarityChip({ rarity }: { rarity: string }) {
  return (
    <span className={`rarity-${rarity} rarity-text text-[9px] font-bold uppercase tracking-widest`}>
      {rarity}
    </span>
  );
}

export function VariantBadge({ variant }: { variant: string }) {
  if (variant === "normal") return null;
  return (
    <span className={`text-[9px] font-bold uppercase tracking-widest ${variant === "golden" ? "text-amber-300" : "text-fuchsia-300"}`}>
      {variant === "golden" ? "★ Golden" : "✦ Shiny"}
    </span>
  );
}

/* ---------------------------------- PETS ------------------------------------ */

export function PetsPanel() {
  const { state } = useGame();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"power" | "rarity" | "newest" | "name">("power");
  const [filter, setFilter] = useState<"all" | "equipped" | "favorites">("all");

  const petScore = (p: ClientPet) => p.pct * (VARIANT_MULT[p.variant] ?? 1);
  const dupes = useMemo(() => {
    const map = new Map<string, ClientPet[]>();
    for (const p of state.pets) {
      const k = `${p.defId}:${p.variant}`;
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    return map;
  }, [state.pets]);

  const filtered = useMemo(() => {
    const list = state.pets.filter((p) => {
      if (filter === "equipped" && !p.equipped) return false;
      if (filter === "favorites" && !p.favorite) return false;
      if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
    return list.sort((a, b) => {
      switch (sort) {
        case "power": return petScore(b) - petScore(a);
        case "rarity": return b.rarityIdx - a.rarityIdx || petScore(b) - petScore(a);
        case "name": return a.name.localeCompare(b.name);
        default: return 0;
      }
    }).sort((a, b) => (b.equipped ? 1 : 0) - (a.equipped ? 1 : 0));
  }, [state.pets, query, sort, filter]);

  const equippedPct = state.pets.filter((p) => p.equipped).reduce((a, p) => a + petScore(p), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Pets</h1>
          <p className="text-xs text-slate-500">
            {state.pets.length}/{state.inventoryCap} stored · {state.pets.filter((p) => p.equipped).length}/{state.maxEquipped} equipped ·{" "}
            <span className="text-emerald-300 font-semibold">+{fmtInt(equippedPct)}% gains from pets</span>
          </p>
        </div>
        <EquipBestButton />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <TextInput placeholder="Search pets…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 !py-2 w-52" />
        </div>
        <div className="flex gap-1.5">
          {(["all", "equipped", "favorites"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize cursor-pointer ${filter === f ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40" : "glass-soft text-slate-400"}`}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={() => setSort(sort === "power" ? "rarity" : sort === "rarity" ? "newest" : sort === "newest" ? "name" : "power")} className="glass-soft rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-300 inline-flex items-center gap-1.5 cursor-pointer hover:text-white">
          <ArrowUpDown size={12} /> Sort: {sort}
        </button>
      </div>

      {filtered.length === 0 ? (
        <Empty icon={<EggIcon size={22} />} title="No companions yet" body="Hatch eggs in the Eggs tab to discover companions from every world." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
          {filtered.map((p) => {
            const k = `${p.defId}:${p.variant}`;
            const fuseReady = p.variant !== "shiny" && (dupes.get(k)?.filter((d) => !d.favorite).length ?? 0) >= 3;
            return <PetCard key={p.id} pet={p} fuseReady={fuseReady} />;
          })}
        </div>
      )}
    </div>
  );
}

function EquipBestButton() {
  const { act, refresh, toast } = useGame();
  const [busy, setBusy] = useState(false);
  return (
    <Btn
      variant="outline"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const res = await act("petAction", { op: "equip-best" });
        setBusy(false);
        if (res) {
          toast({ title: "Best pets equipped" });
          await refresh();
        }
      }}
    >
      <Sparkles size={14} /> Equip Best
    </Btn>
  );
}

function PetCard({ pet, fuseReady }: { pet: ClientPet; fuseReady: boolean }) {
  const { act, refresh } = useGame();
  const [busy, setBusy] = useState(false);
  const world = worldById.get(pet.worldId);

  const doAction = async (op: string) => {
    setBusy(true);
    const res = await act("petAction", { op, petId: pet.id });
    setBusy(false);
    if (res) await refresh();
  };

  return (
    <div className={`rarity-${pet.rarity} rarity-card rounded-2xl p-3 relative group`}>
      <div className="flex items-start justify-between">
        <RarityChip rarity={pet.rarity} />
        <button
          onClick={() => doAction("favorite")}
          className={`p-1 rounded-lg transition-colors cursor-pointer ${pet.favorite ? "text-amber-300" : "text-slate-600 hover:text-slate-400"}`}
          title={pet.favorite ? "Unfavorite" : "Favorite (protected from fusion)"}
          aria-label="Toggle favorite"
        >
          <Star size={13} fill={pet.favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="flex justify-center py-1 transition-transform duration-300 group-hover:scale-110">
        <PetIcon defId={pet.defId} size={58} />
      </div>
      <div className="text-center">
        <div className="font-bold text-white text-xs truncate">{pet.name}</div>
        <VariantBadge variant={pet.variant} />
        <div className="num text-[11px] text-emerald-300 font-semibold mt-0.5">+{fmtInt(pet.pct * (VARIANT_MULT[pet.variant] ?? 1))}%</div>
        <div className="text-[9px] text-slate-500">{world?.name}</div>
      </div>
      <div className="flex gap-1 mt-2">
        <Btn size="xs" variant={pet.equipped ? "ghost" : "primary"} loading={busy} onClick={() => doAction(pet.equipped ? "unequip" : "equip")} className="flex-1">
          {pet.equipped ? "Equipped" : "Equip"}
        </Btn>
        {fuseReady && (
          <Btn size="xs" variant="gold" loading={busy} onClick={() => doAction("fuse")} title="Fuse 3 identical copies → stronger variant">
            <Merge size={11} />
          </Btn>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- EGGS ------------------------------------ */

interface HatchResult {
  id: string; defId: string; name: string; rarity: string; rarityIdx: number; variant: string; pct: number; pityUsed: boolean;
}

export function EggsPanel() {
  const { state, act, refresh, toast } = useGame();
  const [worldId, setWorldId] = useState(state.world);
  const [busy, setBusy] = useState<false | 1 | 3>(false);
  const [results, setResults] = useState<HatchResult[] | null>(null);

  const world = worldById.get(worldId) ?? WORLDS[0];
  const unlocked = state.unlockedWorlds.includes(worldId);
  const weights = adjustedWeights(state.stats.luck);
  const pityCount = (state.pity ?? {})[String(worldId)] ?? 0;
  const eggCost = bn(world.eggCost);
  const canOne = unlocked && bn(state.energy).gte(eggCost);
  const canThree = unlocked && bn(state.energy).gte(eggCost.times(3));

  const hatch = async (count: 1 | 3) => {
    setBusy(count);
    const res = await act("hatch", { worldId, count });
    setBusy(false);
    if (res) {
      const hatched = res.hatched as HatchResult[];
      setResults(hatched);
      const best = Math.max(...hatched.map((h) => h.rarityIdx));
      sfxHatch(best);
      if (best >= 4) {
        const rare = hatched.filter((h) => h.rarityIdx >= 4)[0];
        toast({ title: `${RARITIES[best].name} discovered!`, body: rare?.name, kind: "rare" });
      }
      await refresh();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Eggs</h1>
          <p className="text-xs text-slate-500">Every roll is performed server-side. Probabilities are published below and total 100%.</p>
        </div>
        <div className="glass-soft rounded-full px-4 py-1.5 num text-sm font-bold text-cyan-200">{fmt(state.energy)} energy</div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {WORLDS.map((w) => {
          const u = state.unlockedWorlds.includes(w.id);
          return (
            <button
              key={w.id}
              onClick={() => u && setWorldId(w.id)}
              className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer border ${
                worldId === w.id ? "text-white border-transparent" : u ? "glass-soft text-slate-300 border-transparent" : "text-slate-600 border-line"
              }`}
              style={worldId === w.id ? { background: `linear-gradient(135deg, ${w.theme.accent}55, ${w.theme.accent}22)`, borderColor: `${w.theme.accent}66` } : undefined}
              disabled={!u}
            >
              <span className="inline-flex items-center gap-1.5">{!u && <Lock size={11} />}{w.name}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        {/* Egg showcase */}
        <Panel className="relative overflow-hidden">
          <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: `radial-gradient(420px 260px at 50% 30%, ${world.theme.accent}26, transparent 70%)` }} />
          <div className="relative flex flex-col items-center py-6">
            <div className="animate-float">
              <EggArt size={150} worldId={worldId} />
            </div>
            <h2 className="text-lg font-bold text-white mt-4">{world.name} Egg</h2>
            <p className="text-xs text-slate-400 italic">{world.tagline}</p>
            <div className="mt-2 num text-cyan-200 font-bold">{fmt(eggCost)} energy each</div>

            {/* Pity */}
            <div className="w-64 mt-4">
              <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                <span>Pity: guaranteed Legendary+</span>
                <span className="num">{Math.min(pityCount, PITY_THRESHOLD)}/{PITY_THRESHOLD}</span>
              </div>
              <Progress value={Math.min(pityCount, PITY_THRESHOLD)} max={PITY_THRESHOLD} />
            </div>

            <div className="flex gap-2 mt-5">
              <Btn variant="primary" size="lg" loading={busy === 1} disabled={!canOne} onClick={() => hatch(1)}>
                <EggIcon size={17} /> Hatch 1
              </Btn>
              <Btn variant="gold" size="lg" loading={busy === 3} disabled={!canThree} onClick={() => hatch(3)}>
                Hatch 3
              </Btn>
            </div>
            {!unlocked && <p className="text-xs text-rose-300 mt-3">Unlock this world first (Worlds tab).</p>}
            {!unlocked || canOne ? null : <p className="text-xs text-slate-500 mt-3">Not enough energy — keep clicking.</p>}
          </div>
        </Panel>

        {/* Probability table */}
        <Panel title="Hatch Probabilities" right={<span className="text-[10px] text-slate-500 num">luck +{state.stats.luck}</span>}>
          <div className="space-y-1.5">
            {RARITIES.map((r, i) => (
              <div key={r.id} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                <span className="text-xs text-slate-300 w-20">{r.name}</span>
                <div className="flex-1 progress-track h-1.5">
                  <div className="h-full rounded-full" style={{ width: `${weights[i]}%`, background: r.color }} />
                </div>
                <span className="num text-[10px] text-slate-400 w-12 text-right">{weights[i].toFixed(2)}%</span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-[10px] text-slate-500 leading-relaxed border-t border-line pt-3">
            Variant rolls after rarity: 3% Golden (×5 power), 1% Shiny (×10 power). After {PITY_THRESHOLD} hatches without a Legendary+ from this egg, one is guaranteed.
          </div>
        </Panel>
      </div>

      {/* Results overlay */}
      <Modal open={!!results} onClose={() => setResults(null)} title="Hatch Results" wide>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {results?.map((h, idx) => (
            <div key={h.id} className={`rarity-${h.rarity} rarity-card rounded-2xl p-4 text-center anim-hatch`} style={{ animationDelay: `${idx * 0.15}s` }}>
              <RarityChip rarity={h.rarity} />
              <div className="flex justify-center py-2"><PetIcon defId={h.defId} size={72} /></div>
              <div className="font-bold text-white text-sm">{h.name}</div>
              <VariantBadge variant={h.variant} />
              <div className="num text-xs text-emerald-300 font-semibold mt-1">+{fmtInt(h.pct * (VARIANT_MULT[h.variant] ?? 1))}% gains</div>
              {h.pityUsed && <div className="text-[9px] text-amber-300 mt-1">PITY TRIGGERED</div>}
            </div>
          ))}
        </div>
        <Btn variant="primary" className="w-full mt-4" onClick={() => setResults(null)}>Collect</Btn>
      </Modal>
    </div>
  );
}

/* --------------------------------- REBIRTH ---------------------------------- */

export function RebirthPanel() {
  const { state, act, refresh, toast } = useGame();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tiers = [
    { id: "rebirth", name: "Rebirth", currency: "Neon Shards", field: "shards", color: "#22d3ee", owned: state.resets.rebirth ?? 0, balance: state.shards, mult: 5, threshold: bn("1e6").times(bn(8).pow(state.resets.rebirth ?? 0)), minPrev: { tier: null as string | null, count: 0 }, clears: ["Energy balance", "All upgrade levels"] },
    { id: "prestige", name: "Prestige", currency: "Star Cores", field: "cores", color: "#a78bfa", owned: state.resets.prestige ?? 0, balance: state.cores, mult: 25, threshold: bn("1e12").times(bn(16).pow(state.resets.prestige ?? 0)), minPrev: { tier: "rebirth" as const, count: 3 }, clears: ["Energy & upgrades", "Rebirth count", "Neon Shards"] },
    { id: "ascension", name: "Ascension", currency: "Void Prisms", field: "prisms", color: "#f472b6", owned: state.resets.ascension ?? 0, balance: state.prisms, mult: 150, threshold: bn("1e24").times(bn(32).pow(state.resets.ascension ?? 0)), minPrev: { tier: "prestige" as const, count: 2 }, clears: ["Lower resets & currencies", "Energy & upgrades"] },
    { id: "galaxy", name: "Galaxy Reset", currency: "Nova Voids", field: "voids", color: "#fbbf24", owned: state.resets.galaxy ?? 0, balance: state.voids, mult: 1000, threshold: bn("1e40").times(bn(64).pow(state.resets.galaxy ?? 0)), minPrev: { tier: "ascension" as const, count: 2 }, clears: ["Everything below this tier"] },
  ];

  const lifetime = bn(state.lifetimeEarned);

  const gainFor = (t: (typeof tiers)[number]) => {
    // Mirror server formulas (sqrt / cbrt / sqrt / log10)
    if (lifetime.lt(t.threshold)) return bn(0);
    const ratio = lifetime.div(t.threshold);
    let g: BigNumber;
    if (t.id === "prestige") g = ratio.pow(1 / 3);
    else if (t.id === "galaxy") g = bn(Math.max(1, Math.floor(log10Big(ratio)) + 1));
    else g = ratio.sqrt();
    if (t.id === "rebirth") g = g.times(1 + (state.upgrades["neon-resonance"] ?? 0) * 0.05);
    return BigNumber.maximum(g.integerValue(1), bn(1));
  };

  const confirmed = async () => {
    if (!confirm) return;
    setBusy(true);
    const res = await act("reset", { tier: confirm });
    setBusy(false);
    if (res) {
      sfxRebirth();
      toast({ title: `${tiers.find((t) => t.id === confirm)?.name} complete!`, body: `+${fmt(String(res.gained))} gained`, kind: "rare" });
      await refresh();
    }
  };

  const sel = tiers.find((t) => t.id === confirm);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Transcendence</h1>
        <p className="text-xs text-slate-500">Reset shallow progress for permanent multipliers. Pets, worlds, achievements and gems are never lost.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tiers.map((t) => {
          const prevOk = !t.minPrev.tier || (state.resets[t.minPrev.tier] ?? 0) >= t.minPrev.count;
          const ready = prevOk && lifetime.gte(t.threshold);
          const pct = Math.min(100, lifetime.div(t.threshold).times(100).toNumber());
          const gain = gainFor(t);
          return (
            <Panel key={t.id} className="relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-25" style={{ background: t.color }} />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-white">{t.name}</h2>
                  <span className="num text-xs px-2 py-0.5 rounded-full" style={{ background: `${t.color}1f`, color: t.color }}>
                    {t.owned} done
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  You hold <span className="num font-bold" style={{ color: t.color }}>{fmt(t.balance)}</span> {t.currency} · <span className="text-emerald-300">+{t.mult}% gains each</span>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>Lifetime energy: {fmt(lifetime)}</span>
                    <span>Need {fmt(t.threshold)}</span>
                  </div>
                  <Progress value={pct} max={100} />
                </div>
                {!prevOk && (
                  <p className="text-[11px] text-amber-300/90 mt-2">Requires {t.minPrev.count} {t.minPrev.tier}{t.minPrev.count === 1 ? "" : "s"} first.</p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <div className="text-[11px] text-slate-400">
                    Gain preview: <span className="num font-bold text-emerald-300">+{fmt(gain)}</span>
                  </div>
                  <Btn size="sm" variant={ready ? "primary" : "ghost"} disabled={!ready} onClick={() => setConfirm(t.id)}>
                    {t.name}
                  </Btn>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={`Perform ${sel?.name}?`}>
        {sel && (
          <div className="space-y-4">
            <div className="rounded-xl bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-500/25 p-4 text-center">
              <div className="text-[11px] text-slate-400">You will gain</div>
              <div className="num text-3xl font-bold mt-1" style={{ color: sel.color }}>+{fmt(gainFor(sel))} {sel.currency}</div>
              <div className="text-[11px] text-emerald-300 mt-1">≈ +{(Number(gainFor(sel).toString()) * sel.mult).toFixed(0)}% permanent global gains</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="glass-soft rounded-xl p-3">
                <div className="font-bold text-rose-300 mb-1.5">Resets</div>
                {sel.clears.map((c) => (
                  <div key={c} className="text-slate-400 flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-rose-400" />{c}</div>
                ))}
              </div>
              <div className="glass-soft rounded-xl p-3">
                <div className="font-bold text-emerald-300 mb-1.5">Kept forever</div>
                {["Pets & variants", "Worlds unlocked", "Achievements & titles", "Gems & boosts", "Higher-tier currencies"].map((c) => (
                  <div key={c} className="text-slate-400 flex items-center gap-1.5"><CheckCircle2 size={10} className="text-emerald-400" />{c}</div>
                ))}
              </div>
            </div>
            <Btn variant="primary" className="w-full" loading={busy} onClick={confirmed}>
              Confirm {sel.name}
            </Btn>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------------------------------- WORLDS ---------------------------------- */

export function WorldsPanel() {
  const { state, act, refresh, toast } = useGame();
  const [busy, setBusy] = useState<number | null>(null);

  const enter = async (worldId: number) => {
    setBusy(worldId);
    const res = await act("unlockWorld", { worldId });
    setBusy(null);
    if (res) {
      toast(res.alreadyUnlocked ? { title: `Entered ${worldById.get(worldId)?.name}` } : { title: "Portal opened!", body: `Welcome to ${worldById.get(worldId)?.name}`, kind: "rare" });
      await refresh();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Worlds</h1>
        <p className="text-xs text-slate-500">Each unlocked world adds its bonus to all gains and opens a dedicated egg. Your current world: <span className="text-cyan-300 font-semibold">{worldById.get(state.world)?.name}</span></p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {WORLDS.map((w) => {
          const unlocked = state.unlockedWorlds.includes(w.id);
          const current = state.world === w.id;
          const afford = bn(state.energy).gte(w.unlockCost);
          const ownedPets = state.pets.filter((p) => p.worldId === w.id).length;
          return (
            <div key={w.id} className="glass rounded-2xl overflow-hidden relative group">
              <div className="h-20 relative" style={{ background: `linear-gradient(140deg, ${w.theme.from}, ${w.theme.to})` }}>
                <div className="absolute inset-0 opacity-60" style={{ background: `radial-gradient(220px 90px at 80% 20%, ${w.theme.accent}40, transparent 70%)` }} />
                <div className="absolute bottom-2 left-3">
                  <div className="text-[9px] font-mono tracking-widest" style={{ color: w.theme.accent }}>WORLD {String(w.id).padStart(2, "0")}</div>
                  <div className="font-bold text-white leading-tight">{w.name}</div>
                </div>
                {current && <span className="absolute top-2 right-2 text-[9px] font-bold tracking-widest text-white bg-white/15 rounded-full px-2 py-0.5">CURRENT</span>}
              </div>
              <div className="p-3.5">
                <div className="text-[11px] text-slate-400 italic">{w.tagline}</div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div className="glass-soft rounded-lg py-1.5"><div className="text-[9px] text-slate-500">Bonus</div><div className="num text-[11px] font-bold" style={{ color: w.theme.accent }}>+{w.bonusPct}%</div></div>
                  <div className="glass-soft rounded-lg py-1.5"><div className="text-[9px] text-slate-500">Egg</div><div className="num text-[11px] font-bold text-slate-200">{fmt(w.eggCost)}</div></div>
                  <div className="glass-soft rounded-lg py-1.5"><div className="text-[9px] text-slate-500">Dex</div><div className="num text-[11px] font-bold text-slate-200">{ownedPets > 0 ? `${ownedPets}` : "0"}/8</div></div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  {unlocked ? (
                    <Btn size="sm" variant={current ? "ghost" : "primary"} disabled={current} loading={busy === w.id} onClick={() => enter(w.id)} className="flex-1">
                      {current ? "Exploring" : "Enter World"} {!current && <ChevronRight size={13} />}
                    </Btn>
                  ) : (
                    <Btn size="sm" variant={afford ? "gold" : "ghost"} disabled={!afford} loading={busy === w.id} onClick={() => enter(w.id)} className="flex-1">
                      <Lock size={12} /> Unlock — <span className="num">{fmt(w.unlockCost)}</span>
                    </Btn>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
