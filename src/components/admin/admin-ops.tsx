"use client";

/* Economy / Events / Content / Codes / Moderation / Audit / Config / Console tabs. */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Coins, CalendarClock, Play, Square, Trash2, Ticket, ShieldAlert, Scroll, Settings2,
  TerminalSquare, RotateCcw, Plus, Megaphone, Download, ChevronLeft, ChevronRight, Cat, Search,
} from "lucide-react";
import { fmt } from "@/lib/num";
import { PETS, EVENT_KINDS, DAILY_QUESTS, WEEKLY_QUESTS, RARITIES, worldById, type PetDef } from "@/config/game";
import { Panel, Btn, Field, TextInput, Empty, Toggle, ConfirmModal, Modal } from "@/components/ui";
import { PetIcon } from "@/components/art";
import { adminCall } from "./admin-shared";

type Run = <T = unknown>(action: string, params?: Record<string, unknown>, okMsg?: string) => Promise<T | null>;

/* ---------------------------------- ECONOMY ---------------------------------- */

interface ConfigRow { key: string; value: Record<string, unknown>; version: number; updatedAt: string }
interface ConfigBundle { config: ConfigRow[]; history: { id: string; key: string; version: number; createdAt: string; value: unknown }[] }

export function EconomyTab({ run, busy }: { run: Run; busy: string | null }) {
  const [bundle, setBundle] = useState<ConfigBundle | null>(null);
  const [form, setForm] = useState({ energyMult: "1", petMult: "1", priceMult: "1", luckBonus: "0" });
  const [reason, setReason] = useState("");
  const [rollback, setRollback] = useState(false);

  const reload = () => adminCall<ConfigBundle>("economy.get").then((b) => {
    setBundle(b);
    const eco = b.config.find((c) => c.key === "economy")?.value ?? {};
    setForm({
      energyMult: String(eco.energyMult ?? 1),
      petMult: String(eco.petMult ?? 1),
      priceMult: String(eco.priceMult ?? 1),
      luckBonus: String(eco.luckBonus ?? 0),
    });
  }).catch(() => setBundle({ config: [], history: [] }));
  useEffect(() => { void reload(); }, []);  

  const ecoRow = bundle?.config.find((c) => c.key === "economy");
  const parsed = {
    energyMult: Number(form.energyMult), petMult: Number(form.petMult),
    priceMult: Number(form.priceMult), luckBonus: Number(form.luckBonus),
  };
  const invalid =
    isNaN(parsed.energyMult) || parsed.energyMult < 0.1 || parsed.energyMult > 100 ||
    isNaN(parsed.petMult) || parsed.petMult < 0.1 || parsed.petMult > 100 ||
    isNaN(parsed.priceMult) || parsed.priceMult < 0.1 || parsed.priceMult > 100 ||
    isNaN(parsed.luckBonus) || parsed.luckBonus < 0 || parsed.luckBonus > 500;

  const fields: { key: keyof typeof form; label: string; desc: string; min: number; max: number }[] = [
    { key: "energyMult", label: "Global energy multiplier", desc: "Scales every energy gain game-wide. 0.1–100.", min: 0.1, max: 100 },
    { key: "petMult", label: "Pet power multiplier", desc: "Scales all pet contributions. 0.1–100.", min: 0.1, max: 100 },
    { key: "priceMult", label: "Upgrade price multiplier", desc: "Scales every upgrade price. 0.1–100.", min: 0.1, max: 100 },
    { key: "luckBonus", label: "Global luck bonus", desc: "Flat luck added for all hatches. 0–500.", min: 0, max: 500 },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Coins className="text-amber-300" size={22} /> Economy Manager</h1>
        <p className="text-xs text-slate-500">Overrides apply instantly to server calculations. Current version: <span className="num text-amber-300">v{ecoRow?.version ?? 0}</span></p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <Panel title="Live overrides">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((f) => (
              <Field key={f.key} label={f.label}>
                <TextInput type="number" step="0.1" min={f.min} max={f.max} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                <span className="text-[10px] text-slate-500 mt-1 block">{f.desc}</span>
              </Field>
            ))}
          </div>
          <Field label="Reason (audit-logged)">
            <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Weekend balance tuning" className="mt-3" />
          </Field>
          <div className="flex gap-2 mt-3">
            <Btn variant="primary" disabled={invalid || reason.trim().length < 3} loading={busy === "config.set"}
              onClick={async () => { const r = await run("config.set", { key: "economy", value: parsed, reason }, "Economy overrides published"); if (r) reload(); }}>
              Publish overrides
            </Btn>
            <Btn variant="gold" disabled={busy === "config.rollback"} onClick={() => setRollback(true)}><RotateCcw size={13} /> Rollback</Btn>
          </div>
          {invalid && <p className="text-[11px] text-rose-300 mt-2">Values outside safe bounds — publishing is blocked.</p>}
        </Panel>

        <Panel title="Version history">
          {(bundle?.history ?? []).filter((h) => h.key === "economy").length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No overrides published yet — defaults are live.</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {(bundle?.history ?? []).filter((h) => h.key === "economy").map((h) => (
                <div key={h.id} className="glass-soft rounded-lg px-3 py-2 text-[11px]">
                  <div className="flex justify-between"><span className="num font-bold text-amber-300">v{h.version}</span><span className="text-slate-600 num">{new Date(h.createdAt).toLocaleString()}</span></div>
                  <code className="text-[10px] text-slate-400 block mt-0.5 truncate">{JSON.stringify(h.value)}</code>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <ConfirmModal open={rollback} onClose={() => setRollback(false)} danger
        title="Roll back economy config?"
        body={<>This restores the previous published version server-side. All current players will immediately use the old multipliers.</>}
        confirmText="Roll back"
        onConfirm={async () => { await run("config.rollback", { key: "economy", reason: reason || "rollback via dashboard" }, "Rolled back"); reload(); }} />
    </div>
  );
}

/* ---------------------------------- EVENTS ----------------------------------- */

interface EventRow { id: string; kind: string; title: string; description: string; status: string; startsAt: string; endsAt: string; params: Record<string, number> }

export function EventsTab({ run, busy }: { run: Run; busy: string | null }) {
  const [list, setList] = useState<EventRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [announceMsg, setAnnounceMsg] = useState("");
  const [form, setForm] = useState({ kind: "double-energy", title: "", description: "", startsAt: "", endsAt: "", energyMult: "1", clickMult: "1", luckBonus: "0" });

  const reload = () => adminCall<EventRow[]>("events.list").then(setList).catch(() => setList([]));
  useEffect(() => { void reload(); }, []);  

  const pickKind = (kind: string) => {
    const k = EVENT_KINDS.find((x) => x.id === kind);
    if (!k) return;
    setForm({
      ...form, kind,
      title: k.name,
      description: k.desc,
      energyMult: String(k.defaults.energyMult ?? 1),
      clickMult: String(k.defaults.clickMult ?? 1),
      luckBonus: String(k.defaults.luckBonus ?? 0),
      startsAt: new Date().toISOString().slice(0, 16),
      endsAt: new Date(Date.now() + k.defaults.durationHours * 3600_000).toISOString().slice(0, 16),
    });
  };

  const statusColor: Record<string, string> = { scheduled: "text-amber-300 bg-amber-500/10 border-amber-500/30", active: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30", ended: "text-slate-400 bg-white/5 border-line", cancelled: "text-rose-300 bg-rose-500/10 border-rose-500/30" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><CalendarClock className="text-cyan-300" size={22} /> Live Events</h1>
          <p className="text-xs text-slate-500">Status transitions are handled server-side by the clock — starting/stopping here is immediate and idempotent.</p>
        </div>
        <Btn variant="primary" onClick={() => setCreating(true)}><Plus size={15} /> New event</Btn>
      </div>

      <Panel title="Global announcement">
        <div className="flex gap-2">
          <TextInput value={announceMsg} onChange={(e) => setAnnounceMsg(e.target.value)} placeholder="Broadcast to all players (visible for 6h)…" maxLength={240} />
          <Btn variant="outline" disabled={announceMsg.trim().length < 3} loading={busy === "announce"}
            onClick={async () => { const r = await run("announce", { message: announceMsg.trim() }, "Announcement broadcast"); if (r) setAnnounceMsg(""); }}>
            <Megaphone size={14} /> Broadcast
          </Btn>
        </div>
      </Panel>

      {!list ? <div className="flex justify-center py-16"><span className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" /></div> : list.length === 0 ? (
        <Empty icon={<CalendarClock size={22} />} title="No events" body="Create your first event to light up the grid." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {list.map((e) => (
            <Panel key={e.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-white">{e.title}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{e.kind}</div>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${statusColor[e.status]}`}>{e.status}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">{e.description}</p>
              <div className="flex gap-3 text-[11px] mt-2 num">
                {e.params.energyMult && <span className="text-cyan-300">×{e.params.energyMult} energy</span>}
                {e.params.clickMult && <span className="text-violet-300">×{e.params.clickMult} clicks</span>}
                {e.params.luckBonus ? <span className="text-emerald-300">+{e.params.luckBonus} luck</span> : null}
              </div>
              <div className="text-[10px] text-slate-500 mt-1.5 num">{new Date(e.startsAt).toLocaleString()} → {new Date(e.endsAt).toLocaleString()}</div>
              <div className="flex gap-1.5 mt-3">
                {e.status !== "active" && e.status !== "ended" && <Btn size="xs" variant="success" loading={busy === "events.start"} onClick={async () => { await run("events.start", { id: e.id }, "Event started"); reload(); }}><Play size={11} /> Start</Btn>}
                {e.status === "active" && <Btn size="xs" variant="gold" loading={busy === "events.stop"} onClick={async () => { await run("events.stop", { id: e.id }, "Event stopped"); reload(); }}><Square size={11} /> Stop</Btn>}
                {e.status !== "active" && <Btn size="xs" variant="danger" loading={busy === "events.delete"} onClick={async () => { await run("events.delete", { id: e.id }, "Event deleted"); reload(); }}><Trash2 size={11} /></Btn>}
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Create live event" wide>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Event kind">
            <select className="w-full rounded-xl bg-black/30 border border-line px-3 py-2.5 text-sm" value={form.kind} onChange={(e) => pickKind(e.target.value)}>
              {EVENT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </Field>
          <Field label="Title"><TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Description"><TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
          <Field label="Starts at"><TextInput type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></Field>
          <Field label="Ends at"><TextInput type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></Field>
          <Field label="Energy multiplier (1 = none)"><TextInput type="number" min={1} max={100} value={form.energyMult} onChange={(e) => setForm({ ...form, energyMult: e.target.value })} /></Field>
          <Field label="Click multiplier (1 = none)"><TextInput type="number" min={1} max={100} value={form.clickMult} onChange={(e) => setForm({ ...form, clickMult: e.target.value })} /></Field>
          <Field label="Luck bonus"><TextInput type="number" min={0} max={500} value={form.luckBonus} onChange={(e) => setForm({ ...form, luckBonus: e.target.value })} /></Field>
        </div>
        <Btn variant="primary" className="w-full mt-4" loading={busy === "events.create"}
          onClick={async () => {
            const r = await run("events.create", {
              kind: form.kind, title: form.title, description: form.description,
              startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(),
              energyMult: Number(form.energyMult) > 1 ? Number(form.energyMult) : undefined,
              clickMult: Number(form.clickMult) > 1 ? Number(form.clickMult) : undefined,
              luckBonus: Number(form.luckBonus) > 0 ? Number(form.luckBonus) : undefined,
            }, "Event created");
            if (r) { setCreating(false); reload(); }
          }}>
          Create event
        </Btn>
      </Modal>
    </div>
  );
}

/* ------------------------------ PETS & CONTENT ------------------------------- */

export function ContentTab({ run, busy }: { run: Run; busy: string | null }) {
  const [query, setQuery] = useState("");
  const [bundle, setBundle] = useState<ConfigBundle | null>(null);
  const [reason, setReason] = useState("");
  const [eggPriceMult, setEggPriceMult] = useState("1");
  const [disabledPets, setDisabledPets] = useState<Set<string>>(new Set());
  const [disabledQuests, setDisabledQuests] = useState<Set<string>>(new Set());

  const reload = () => adminCall<ConfigBundle>("config.get").then((b) => {
    setBundle(b);
    const content = (b.config.find((c) => c.key === "content")?.value ?? {}) as { disabledPetDefIds?: string[]; disabledQuestIds?: string[]; eggPriceMult?: number };
    setDisabledPets(new Set(content.disabledPetDefIds ?? []));
    setDisabledQuests(new Set(content.disabledQuestIds ?? []));
    setEggPriceMult(String(content.eggPriceMult ?? 1));
  }).catch(() => {});
  useEffect(() => { void reload(); }, []);  

  const filtered = PETS.filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.rarity.includes(query.toLowerCase()));

  const publish = async () => {
    const r = await run("config.set", {
      key: "content",
      value: { disabledPetDefIds: [...disabledPets], disabledQuestIds: [...disabledQuests], eggPriceMult: Number(eggPriceMult) },
      reason: reason || "content update",
    }, "Content configuration published");
    if (r) reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Cat className="text-emerald-300" size={22} /> Pets & Content</h1>
          <p className="text-xs text-slate-500">Enable/disable definitions and tune egg pricing. Changes are versioned and applied server-side.</p>
        </div>
        <div className="flex items-center gap-2">
          <TextInput placeholder="Reason…" value={reason} onChange={(e) => setReason(e.target.value)} className="!py-2 w-44" />
          <Btn variant="primary" disabled={busy === "config.set"} onClick={publish}>Publish</Btn>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title={`Pet catalog (${PETS.length})`} right={
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <TextInput placeholder="Filter…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8 !py-1.5 !text-xs w-40" />
          </div>
        }>
          <div className="max-h-[520px] overflow-y-auto space-y-1 pr-1">
            {filtered.map((p: PetDef) => {
              const off = disabledPets.has(p.defId);
              return (
                <div key={p.defId} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 ${off ? "opacity-45 glass-soft" : "glass-soft"}`}>
                  <PetIcon defId={p.defId} size={30} glow={false} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{p.name} <span className="text-[9px] text-slate-500 font-mono">{p.defId}</span></div>
                    <div className="text-[10px]" style={{ color: RARITIES[p.rarityIdx].color }}>{RARITIES[p.rarityIdx].name} · {worldById.get(p.worldId)?.name} · +{p.pct}%</div>
                  </div>
                  <button
                    onClick={() => setDisabledPets((s) => { const n = new Set(s); n.has(p.defId) ? n.delete(p.defId) : n.add(p.defId); return n; })}
                    className={`text-[10px] font-bold rounded-full px-2.5 py-1 cursor-pointer ${off ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/10 text-emerald-300"}`}
                  >
                    {off ? "DISABLED" : "LIVE"}
                  </button>
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Egg pricing override">
            <Field label="Global egg price multiplier (0.1 – 10)">
              <TextInput type="number" step="0.1" min={0.1} max={10} value={eggPriceMult} onChange={(e) => setEggPriceMult(e.target.value)} />
            </Field>
            <p className="text-[10px] text-slate-500 mt-2">Applies at hatch-time for every world egg. Current hatch weights are fixed and always total 100%.</p>
          </Panel>
          <Panel title="Quest toggles">
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
              {[...DAILY_QUESTS, ...WEEKLY_QUESTS].map((q) => {
                const off = disabledQuests.has(q.id);
                return (
                  <div key={q.id} className="flex items-center justify-between glass-soft rounded-lg px-3 py-2">
                    <div>
                      <div className="text-xs font-semibold text-white">{q.name} <span className="text-[9px] text-slate-500 font-mono">{q.id}</span></div>
                      <div className="text-[10px] text-slate-500">{q.pool} · {q.rewardGems} gems</div>
                    </div>
                    <Toggle checked={!off} onChange={(v) => setDisabledQuests((s) => { const n = new Set(s); v ? n.delete(q.id) : n.add(q.id); return n; })} label="" />
                  </div>
                );
              })}
            </div>
          </Panel>
          <p className="text-[10px] text-slate-600">Config version: v{bundle?.config.find((c) => c.key === "content")?.version ?? 0}</p>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------- CODES ------------------------------------ */

interface CodeRow { id: string; code: string; reward: Record<string, unknown>; maxRedemptions: number; redemptionCount: number; active: boolean; expiresAt: string | null; createdAt: string }

export function CodesTab({ run, busy }: { run: Run; busy: string | null }) {
  const [list, setList] = useState<CodeRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<{ id: string; code: string } | null>(null);
  const [redemptions, setRedemptions] = useState<{ username: string; at: string }[] | null>(null);
  const [form, setForm] = useState({ code: "", energy: "", gems: "", shards: "", maxRedemptions: "0", expiresAt: "" });

  const reload = () => adminCall<CodeRow[]>("codes.list").then(setList).catch(() => setList([]));
  useEffect(() => { void reload(); }, []);  

  const openRedemptions = async (c: CodeRow) => {
    setViewing(c);
    setRedemptions(null);
    const rows = await adminCall<{ username: string; at: string }[]>("codes.redemptions", { id: c.id }).catch(() => []);
    setRedemptions(rows);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Ticket className="text-fuchsia-300" size={22} /> Codes Manager</h1>
          <p className="text-xs text-slate-500">Redemption is atomic server-side — one claim per account, enforced by a unique constraint.</p>
        </div>
        <Btn variant="primary" onClick={() => setCreating(true)}><Plus size={15} /> New code</Btn>
      </div>

      <Panel>
        {!list ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 rounded-xl bg-white/5 animate-pulse" />)}</div> : list.length === 0 ? (
          <Empty icon={<Ticket size={20} />} title="No codes yet" />
        ) : (
          <div className="space-y-1.5">
            {list.map((c) => (
              <div key={c.id} className="glass-soft rounded-xl px-3.5 py-2.5 flex items-center gap-3 flex-wrap">
                <span className="font-mono text-sm font-bold text-fuchsia-300">{c.code}</span>
                <span className="text-[11px] text-slate-400">{JSON.stringify(c.reward)}</span>
                <span className="text-[10px] text-slate-500 num">{c.redemptionCount}{c.maxRedemptions > 0 ? `/${c.maxRedemptions}` : ""} redeemed</span>
                {c.expiresAt && <span className="text-[10px] text-slate-500">expires {new Date(c.expiresAt).toLocaleDateString()}</span>}
                <div className="ml-auto flex gap-1.5">
                  <Btn size="xs" onClick={() => openRedemptions(c)}>Log</Btn>
                  <Btn size="xs" variant={c.active ? "gold" : "success"} loading={busy === "codes.toggle"}
                    onClick={async () => { await run("codes.toggle", { id: c.id, active: !c.active }, c.active ? "Code disabled" : "Code enabled"); reload(); }}>
                    {c.active ? "Disable" : "Enable"}
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Modal open={creating} onClose={() => setCreating(false)} title="Create promotional code" wide>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Code"><TextInput value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SUMMER2026" /></Field>
          <Field label="Max redemptions (0 = unlimited)"><TextInput type="number" min={0} value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} /></Field>
          <Field label="Energy reward"><TextInput value={form.energy} onChange={(e) => setForm({ ...form, energy: e.target.value })} placeholder="25000 or 2.5e4" /></Field>
          <Field label="Gem reward"><TextInput type="number" min={0} value={form.gems} onChange={(e) => setForm({ ...form, gems: e.target.value })} placeholder="100" /></Field>
          <Field label="Shard reward"><TextInput value={form.shards} onChange={(e) => setForm({ ...form, shards: e.target.value })} placeholder="5" /></Field>
          <Field label="Expires at (optional)"><TextInput type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></Field>
        </div>
        <Btn variant="primary" className="w-full mt-4" loading={busy === "codes.create"}
          onClick={async () => {
            const r = await run("codes.create", {
              code: form.code,
              energy: form.energy || undefined,
              gems: form.gems ? Number(form.gems) : undefined,
              shards: form.shards || undefined,
              maxRedemptions: Number(form.maxRedemptions) || 0,
              expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
            }, "Code created");
            if (r) { setCreating(false); reload(); }
          }}>
          Create code
        </Btn>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Redemptions — ${viewing?.code}`}>
        {!redemptions ? <div className="flex justify-center py-8"><span className="w-6 h-6 rounded-full border-2 border-fuchsia-500/30 border-t-fuchsia-400 animate-spin" /></div> : redemptions.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">No redemptions yet.</p>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {redemptions.map((r, i) => (
              <div key={i} className="flex justify-between text-xs glass-soft rounded-lg px-3 py-1.5">
                <span className="text-white font-semibold">{r.username}</span>
                <span className="text-slate-500 num">{new Date(r.at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* -------------------------------- MODERATION ---------------------------------- */

export function ModerationTab({ run, busy }: { run: Run; busy: string | null }) {
  const [cases, setCases] = useState<{ id: string; username: string; userId: string; reason: string; expiresAt: string | null; createdAt: string }[] | null>(null);

  const reload = () => adminCall<{ cases: never[] }>("moderation.list", { page: 1, active: true }).then((d) => setCases(d.cases as never[])).catch(() => setCases([]));
  useEffect(() => { void reload(); }, []);  

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><ShieldAlert className="text-rose-300" size={22} /> Moderation Center</h1>
        <p className="text-xs text-slate-500">Active bans. New bans and unbans are issued from Players → Manage.</p>
      </div>
      <Panel title="Active bans">
        {!cases ? <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 rounded-xl bg-white/5 animate-pulse" />)}</div> : cases.length === 0 ? (
          <Empty icon={<ShieldAlert size={20} />} title="No active bans" body="The grid is peaceful." />
        ) : (
          <div className="space-y-1.5">
            {cases.map((c) => (
              <div key={c.id} className="glass-soft rounded-xl px-3.5 py-2.5 flex items-center gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-bold text-white">{c.username}</div>
                  <div className="text-[10px] text-slate-500">{c.expiresAt ? `until ${new Date(c.expiresAt).toLocaleString()}` : "PERMANENT"} · issued {new Date(c.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="text-[11px] text-rose-200/80 flex-1 min-w-40">{c.reason}</div>
                <Btn size="xs" variant="success" loading={busy === "players.unban"}
                  onClick={async () => {
                    const reason = prompt("Reason for unban (audit-logged):") ?? "";
                    if (reason.length < 3) return;
                    await run("players.unban", { targetId: c.userId, reason }, "Ban revoked");
                    reload();
                  }}>
                  Unban
                </Btn>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* --------------------------------- AUDIT LOG ---------------------------------- */

interface AuditRow { id: string; adminName: string | null; action: string; targetType: string | null; targetId: string | null; reason: string | null; before: unknown; after: unknown; result: string; requestId: string | null; createdAt: string }

export function AuditTab() {
  const [data, setData] = useState<{ logs: AuditRow[]; total: number } | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ action: "", admin: "", target: "" });
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => adminCall<{ logs: AuditRow[]; total: number }>("audit.list", { page, action: filters.action || undefined, admin: filters.admin || undefined, target: filters.target || undefined }).then(setData).catch(() => setData({ logs: [], total: 0 }));
  useEffect(() => { void load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = () => {
    if (!data) return;
    const rows = [["time", "admin", "action", "targetType", "targetId", "reason", "result", "requestId"], ...data.logs.map((l) => [l.createdAt, l.adminName ?? "", l.action, l.targetType ?? "", l.targetId ?? "", (l.reason ?? "").replaceAll('"', '""'), l.result, l.requestId ?? ""])];
    const csv = rows.map((r) => r.map((c) => `"${String(c)}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexora-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Scroll className="text-violet-300" size={22} /> Audit Log</h1>
          <p className="text-xs text-slate-500">Append-only. Every privileged operation lands here with before/after values.</p>
        </div>
        <Btn size="sm" onClick={exportCsv} disabled={!data?.logs.length}><Download size={13} /> Export page as CSV</Btn>
      </div>
      <Panel>
        <div className="flex gap-2 flex-wrap mb-3">
          <TextInput placeholder="Action…" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} className="!py-2 w-40" />
          <TextInput placeholder="Admin…" value={filters.admin} onChange={(e) => setFilters({ ...filters, admin: e.target.value })} className="!py-2 w-40" />
          <TextInput placeholder="Target…" value={filters.target} onChange={(e) => setFilters({ ...filters, target: e.target.value })} className="!py-2 w-40" />
          <Btn size="sm" variant="primary" onClick={() => { setPage(1); load(); }}><Search size={13} /> Filter</Btn>
        </div>
        {!data ? <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-9 rounded-xl bg-white/5 animate-pulse" />)}</div> : data.logs.length === 0 ? (
          <Empty icon={<Scroll size={20} />} title="No entries" />
        ) : (
          <div className="space-y-1">
            {data.logs.map((l) => (
              <div key={l.id}>
                <button onClick={() => setExpanded(expanded === l.id ? null : l.id)} className="w-full text-left glass-soft rounded-lg px-3 py-2 flex items-center gap-3 cursor-pointer hover:bg-white/[0.06]">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${l.result === "ok" ? "bg-emerald-400" : l.result === "denied" ? "bg-amber-400" : "bg-rose-400"}`} />
                  <span className="text-xs font-semibold text-violet-300 w-28 truncate">{l.adminName ?? "system"}</span>
                  <span className="text-xs text-white font-medium flex-1 truncate">{l.action}</span>
                  {l.targetId && <span className="text-[10px] text-slate-500 font-mono hidden sm:block truncate max-w-32">{l.targetId}</span>}
                  <span className="text-[10px] text-slate-600 num shrink-0">{new Date(l.createdAt).toLocaleString()}</span>
                </button>
                {expanded === l.id && (
                  <div className="mt-1 mb-2 rounded-lg bg-black/30 border border-line p-3 text-[10px] font-mono text-slate-400 space-y-1 anim-fade-in">
                    {l.reason && <div><span className="text-slate-600">reason:</span> {l.reason}</div>}
                    {l.requestId && <div><span className="text-slate-600">request:</span> {l.requestId}</div>}
                    {l.before != null && <div><span className="text-slate-600">before:</span> {JSON.stringify(l.before)}</div>}
                    {l.after != null && <div><span className="text-slate-600">after:</span> {JSON.stringify(l.after)}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {data && data.total > 25 && (
          <div className="flex items-center justify-between mt-3">
            <Btn size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={13} /> Prev</Btn>
            <span className="text-[11px] text-slate-500">{data.total} entries</span>
            <Btn size="sm" disabled={page * 25 >= data.total} onClick={() => setPage(page + 1)}>Next <ChevronRight size={13} /></Btn>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ----------------------------------- CONFIG ----------------------------------- */

export function ConfigTab({ run, busy }: { run: Run; busy: string | null }) {
  const [bundle, setBundle] = useState<ConfigBundle | null>(null);
  const [reason, setReason] = useState("");
  const [features, setFeatures] = useState({ maintenance: false, disableHatching: false, disableCodes: false, disableShop: false, bannerMessage: "" });

  const reload = () => adminCall<ConfigBundle>("config.get").then((b) => {
    setBundle(b);
    const f = (b.config.find((c) => c.key === "features")?.value ?? {}) as typeof features;
    setFeatures({ maintenance: !!f.maintenance, disableHatching: !!f.disableHatching, disableCodes: !!f.disableCodes, disableShop: !!f.disableShop, bannerMessage: f.bannerMessage ?? "" });
  }).catch(() => {});
  useEffect(() => { void reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Settings2 className="text-cyan-300" size={22} /> Configuration Center</h1>
        <p className="text-xs text-slate-500">Server-validated, versioned, publishable & rollback-safe feature flags.</p>
      </div>
      <Panel title={`Feature flags (v${bundle?.config.find((c) => c.key === "features")?.version ?? 0})`}>
        <Toggle label="Maintenance mode (blocks gameplay actions)" checked={features.maintenance} onChange={(v) => setFeatures({ ...features, maintenance: v })} />
        <Toggle label="Disable egg hatching" checked={features.disableHatching} onChange={(v) => setFeatures({ ...features, disableHatching: v })} />
        <Toggle label="Disable code redemption" checked={features.disableCodes} onChange={(v) => setFeatures({ ...features, disableCodes: v })} />
        <Toggle label="Disable shop" checked={features.disableShop} onChange={(v) => setFeatures({ ...features, disableShop: v })} />
        <Field label="Banner message"><TextInput value={features.bannerMessage} onChange={(e) => setFeatures({ ...features, bannerMessage: e.target.value })} maxLength={200} /></Field>
        <Field label="Reason (audit-logged)"><TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this change?" /></Field>
        <div className="flex gap-2 mt-3">
          <Btn variant="primary" disabled={reason.trim().length < 3} loading={busy === "config.set"}
            onClick={async () => { const r = await run("config.set", { key: "features", value: features, reason }, "Feature flags published"); if (r) reload(); }}>
            Publish flags
          </Btn>
          <Btn variant="gold" loading={busy === "config.rollback"}
            onClick={async () => { await run("config.rollback", { key: "features", reason: reason || "rollback" }, "Rolled back"); reload(); }}>
            <RotateCcw size={13} /> Rollback
          </Btn>
        </div>
      </Panel>
      <Panel title="Recent config history">
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {(bundle?.history ?? []).map((h) => (
            <div key={h.id} className="glass-soft rounded-lg px-3 py-2 text-[11px]">
              <div className="flex justify-between"><span className="font-bold text-cyan-300">{h.key} · v{h.version}</span><span className="text-slate-600 num">{new Date(h.createdAt).toLocaleString()}</span></div>
              <code className="text-[10px] text-slate-500 block truncate">{JSON.stringify(h.value)}</code>
            </div>
          ))}
          {bundle && bundle.history.length === 0 && <p className="text-xs text-slate-500 text-center py-3">No configuration changes published yet.</p>}
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------------- CONSOLE ----------------------------------- */

const SUGGESTIONS = ["/help", "/player ", "/give ", "/take ", "/pet give ", "/event start ", "/event stop ", "/announce ", "/ban ", "/unban ", "/logs", "/config validate"];

export function ConsoleTab({ run }: { run: Run }) {
  const [line, setLine] = useState("");
  const [history, setHistory] = useState<{ cmd: string; out: string; ok: boolean }[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [cmds, setCmds] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);

  const exec = async () => {
    const cmd = line.trim();
    if (!cmd) return;
    setCmds((c) => [cmd, ...c].slice(0, 30));
    setHistIdx(-1);
    setLine("");
    const res = await run("console.run", { line: cmd });
    setHistory((h) => [...h, { cmd, out: res ? JSON.stringify(res, null, 0).slice(0, 600) : "✕ command failed (permission or validation error)", ok: !!res }]);
  };

  const matching = line.startsWith("/") ? SUGGESTIONS.filter((s) => s.startsWith(line) && s !== line) : [];

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><TerminalSquare className="text-emerald-300" size={22} /> Command Console</h1>
        <p className="text-xs text-slate-500">Every command routes through the same permission + validation layer as the dashboard. History with ↑/↓.</p>
      </div>
      <div className="glass rounded-2xl overflow-hidden">
        <div className="h-[420px] overflow-y-auto p-4 font-mono text-xs space-y-1.5">
          <div className="text-slate-500">nexora ops console — type /help for commands</div>
          {history.map((h, i) => (
            <div key={i}>
              <div className="text-cyan-300"><span className="text-slate-600">❯</span> {h.cmd}</div>
              <pre className={`whitespace-pre-wrap break-all ${h.ok ? "text-slate-300" : "text-rose-300"}`}>{h.out}</pre>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="relative border-t border-line">
          {matching.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 bg-panel border border-line rounded-t-xl p-2 flex flex-wrap gap-1 anim-fade-in">
              {matching.map((m) => (
                <button key={m} className="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 rounded px-2 py-0.5 cursor-pointer hover:bg-cyan-500/20" onClick={() => setLine(m)}>
                  {m}
                </button>
              ))}
            </div>
          )}
          <input
            className="w-full bg-transparent px-4 py-3.5 font-mono text-sm text-emerald-200 placeholder:text-slate-600 border-0"
            style={{ outline: "none", boxShadow: "none" }}
            placeholder="❯ /help"
            value={line}
            onChange={(e) => setLine(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") exec();
              if (e.key === "ArrowUp") { e.preventDefault(); const next = Math.min(histIdx + 1, cmds.length - 1); if (cmds[next]) { setHistIdx(next); setLine(cmds[next]); } }
              if (e.key === "ArrowDown") { e.preventDefault(); const next = histIdx - 1; setHistIdx(next); setLine(next >= 0 ? cmds[next] : ""); }
            }}
            aria-label="Console input"
          />
        </div>
      </div>
    </div>
  );
}
