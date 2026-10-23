"use client";

/* Players management: search, paginated table, and a full detail drawer
   with moderated actions (all reason-gated and audit-logged server-side). */

import { useEffect, useState } from "react";
import { Search, ChevronLeft, ChevronRight, Coins, Cat, Ban, RotateCcw, StickyNote, ShieldAlert, X } from "lucide-react";
import { fmt, fmtDuration } from "@/lib/num";
import { Avatar, PetIcon } from "@/components/art";
import { Panel, Btn, Modal, Field, TextInput, Empty } from "@/components/ui";
import { adminCall } from "./admin-shared";
import type { Perm } from "@/server/permissions";
import type { ClientPet } from "@/types/client";

interface PlayerRow {
  id: string; email: string; username: string; role: string;
  createdAt: string; lastLoginAt: string | null; level: number | null;
  energy: number | null; clicks: number | null;
}

interface PlayerDetail {
  user: { id: string; email: string; username: string; role: string; createdAt: string; lastLoginAt: string | null };
  profile: { level: number; dailyStreak: number; title: string | null } | null;
  state: {
    energy: string; lifetimeEarned: string; gems: number; shards: string; cores: string;
    prisms: string; voids: string; resets: Record<string, number>; totalClicks: number;
    playSeconds: number; world: number; hatchedTotal: number;
  } | null;
  upgrades: { upgradeId: string; level: number }[];
  pets: (ClientPet & { createdAt: string })[];
  achievements: number;
  bans: { id: string; reason: string; expiresAt: string | null; revokedAt: string | null; createdAt: string }[];
  notes: { id: string; note: string; createdAt: string }[];
  redemptions: { code: string; at: string }[];
}

const CURRENCIES = ["energy", "gems", "shards", "cores", "prisms", "voids"] as const;
const VARIANTS = ["normal", "golden", "shiny"] as const;

export function PlayersTab({ run, busy, can }: {
  run: <T = unknown>(action: string, params?: Record<string, unknown>, okMsg?: string) => Promise<T | null>;
  busy: string | null;
  can: (p: Perm) => boolean;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ players: PlayerRow[]; total: number } | null>(null);
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = () => {
    adminCall<{ players: PlayerRow[]; total: number }>("players.list", { q: q || undefined, page })
      .then(setData)
      .catch(() => setData({ players: [], total: 0 }));
  };
  useEffect(load, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (id: string) => {
    setLoadingDetail(true);
    setDetail(null);
    try {
      const d = await adminCall<PlayerDetail>("players.get", { id });
      setDetail(d);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Players</h1>
          <p className="text-xs text-slate-500">{data ? `${data.total} accounts` : "…"}</p>
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <TextInput placeholder="Username, email or UUID…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 !py-2 w-64" />
          </div>
          <Btn type="submit" variant="primary" size="sm">Search</Btn>
        </form>
      </div>

      <Panel>
        {!data ? (
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />)}</div>
        ) : data.players.length === 0 ? (
          <Empty icon={<Search size={20} />} title="No players found" />
        ) : (
          <>
            <div className="table-scroll">
              <table className="w-full text-left text-sm min-w-[640px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-slate-500 border-b border-line">
                    <th className="py-2 pr-3 font-semibold">Player</th>
                    <th className="py-2 pr-3 font-semibold">Role</th>
                    <th className="py-2 pr-3 font-semibold">Level</th>
                    <th className="py-2 pr-3 font-semibold">Energy</th>
                    <th className="py-2 pr-3 font-semibold">Clicks</th>
                    <th className="py-2 pr-3 font-semibold">Joined</th>
                    <th className="py-2 font-semibold text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {data.players.map((p) => (
                    <tr key={p.id} className="border-b border-line/50 hover:bg-white/[0.03] transition-colors">
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar seed={p.username} size={26} />
                          <div>
                            <div className="font-semibold text-white text-xs">{p.username}</div>
                            <div className="text-[10px] text-slate-500">{p.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${p.role === "player" ? "text-slate-500" : "text-violet-300"}`}>{p.role}</span>
                      </td>
                      <td className="py-2.5 pr-3 num text-xs text-slate-300">{p.level ?? 1}</td>
                      <td className="py-2.5 pr-3 num text-xs text-cyan-200">{fmt(p.energy ?? 0)}</td>
                      <td className="py-2.5 pr-3 num text-xs text-slate-300">{(p.clicks ?? 0).toLocaleString()}</td>
                      <td className="py-2.5 pr-3 text-[10px] text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td className="py-2.5 text-right"><Btn size="xs" onClick={() => openDetail(p.id)}>Manage</Btn></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-3">
              <Btn size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={13} /> Prev</Btn>
              <span className="text-[11px] text-slate-500">Page {page} · {data.total} total</span>
              <Btn size="sm" disabled={page * 20 >= data.total} onClick={() => setPage(page + 1)}>Next <ChevronRight size={13} /></Btn>
            </div>
          </>
        )}
      </Panel>

      {/* Detail drawer */}
      {(loadingDetail || detail) && (
        <div className="fixed inset-0 z-[85] anim-fade-in">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-ink border-l border-line overflow-y-auto anim-pop-in">
            {loadingDetail || !detail ? (
              <div className="flex justify-center py-20"><span className="w-8 h-8 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin" /></div>
            ) : (
              <DetailContent detail={detail} onClose={() => setDetail(null)} run={run} busy={busy} can={can} reload={() => openDetail(detail.user.id)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ReasonAction({
  label, icon, danger, children, onSubmit, busy, disabled,
}: {
  label: string; icon?: React.ReactNode; danger?: boolean; busy?: boolean; disabled?: boolean;
  children: React.ReactNode;
  onSubmit: (reason: string, extras: Record<string, string>) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [extras, setExtras] = useState<Record<string, string>>({});
  return (
    <>
      <Btn size="xs" variant={danger ? "danger" : "ghost"} onClick={() => setOpen(true)} disabled={disabled}>{icon}{label}</Btn>
      <Modal open={open} onClose={() => setOpen(false)} title={label}>
        <div className="space-y-3">
          {children && (
            <div onChange={(e) => {
              const t = e.target as HTMLInputElement;
              if (t.name) setExtras((x) => ({ ...x, [t.name]: t.value }));
            }}>
              {children}
            </div>
          )}
          <Field label="Reason (required, audit-logged)">
            <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this action taken?" />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn size="sm" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn size="sm" variant={danger ? "danger" : "primary"} loading={busy} disabled={reason.trim().length < 3}
              onClick={async () => { const okDone = await onSubmit(reason, extras); if (okDone) { setOpen(false); setReason(""); setExtras({}); } }}>
              Confirm
            </Btn>
          </div>
        </div>
      </Modal>
    </>
  );
}

function DetailContent({ detail, onClose, run, busy, can, reload }: {
  detail: PlayerDetail; onClose: () => void;
  run: PlayersTabRun; busy: string | null; can: (p: Perm) => boolean; reload: () => void;
}) {
  const { user, state } = detail;
  const activeBan = detail.bans.find((b) => !b.revokedAt && (!b.expiresAt || new Date(b.expiresAt) > new Date()));

  const act = async (action: string, params: Record<string, unknown>, okMsg: string) => {
    const res = await run(action, params, okMsg);
    if (res) reload();
    return !!res;
  };

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar seed={user.username} size={44} />
          <div>
            <div className="font-bold text-white flex items-center gap-2">{user.username}
              <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${user.role === "player" ? "bg-white/10 text-slate-400" : "bg-violet-500/20 text-violet-300"}`}>{user.role}</span>
            </div>
            <div className="text-[11px] text-slate-500">{user.email}</div>
            <div className="text-[10px] text-slate-600 font-mono mt-0.5">{user.id}</div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 cursor-pointer" aria-label="Close"><X size={17} /></button>
      </div>

      {activeBan && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
          <span className="font-bold inline-flex items-center gap-1.5"><Ban size={12} /> {activeBan.expiresAt ? `Banned until ${new Date(activeBan.expiresAt).toLocaleString()}` : "Permanently banned"}</span>
          <div className="text-rose-300/80 mt-0.5">{activeBan.reason}</div>
        </div>
      )}

      {state && (
        <div className="grid grid-cols-3 gap-2">
          {([
            ["Energy", fmt(state.energy)], ["Lifetime", fmt(state.lifetimeEarned)], ["Gems", state.gems],
            ["Shards", fmt(state.shards)], ["Cores", fmt(state.cores)], ["Clicks", fmt(state.totalClicks)],
            ["Rebirths", String(state.resets?.rebirth ?? 0)], ["World", String(state.world)], ["Playtime", fmtDuration(state.playSeconds)],
          ] as [string, string | number][]).map(([k, v]) => (
            <div key={k} className="glass-soft rounded-lg px-2.5 py-2">
              <div className="text-[9px] uppercase tracking-widest text-slate-500">{k}</div>
              <div className="num text-xs font-bold text-white">{v}</div>
            </div>
          ))}
        </div>
      )}

      {can("players.grant") && (
        <Panel title="Currency operations">
          <div className="flex flex-wrap gap-1.5">
            <ReasonAction label="Grant" icon={<Coins size={12} />} busy={busy === "players.grantCurrency"}
              onSubmit={(reason, x) => act("players.grantCurrency", { targetId: user.id, field: x.currency ?? "energy", amount: x.amount ?? "0", reason }, "Currency granted")}>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Currency">
                  <select name="currency" className="w-full rounded-xl bg-black/30 border border-line px-3 py-2 text-sm" defaultValue="energy">
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Amount"><TextInput name="amount" placeholder="1000 or 1e6" /></Field>
              </div>
            </ReasonAction>
            <ReasonAction label="Take" icon={<Coins size={12} />} danger busy={busy === "players.takeCurrency"}
              onSubmit={(reason, x) => act("players.takeCurrency", { targetId: user.id, field: x.currency ?? "energy", amount: x.amount ?? "0", reason }, "Currency removed")}>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Currency">
                  <select name="currency" className="w-full rounded-xl bg-black/30 border border-line px-3 py-2 text-sm" defaultValue="energy">
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Amount"><TextInput name="amount" placeholder="1000 or 1e6" /></Field>
              </div>
            </ReasonAction>
          </div>
        </Panel>
      )}

      {can("content.manage") && (
        <Panel title={`Pets (${detail.pets.length})`}>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <ReasonAction label="Grant pet" icon={<Cat size={12} />} busy={busy === "players.givePet"}
              onSubmit={(reason, x) => act("players.givePet", { targetId: user.id, defId: x.defId, variant: x.variant ?? "normal", reason }, "Pet granted")}>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Pet definition ID"><TextInput name="defId" placeholder="w1p7" /></Field>
                <Field label="Variant">
                  <select name="variant" className="w-full rounded-xl bg-black/30 border border-line px-3 py-2 text-sm" defaultValue="normal">
                    {VARIANTS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Field>
              </div>
            </ReasonAction>
          </div>
          <div className="grid grid-cols-6 gap-1.5 max-h-44 overflow-y-auto">
            {detail.pets.map((p) => (
              <button key={p.id} className={`rarity-${p.rarity} rarity-card rounded-lg p-1.5 relative group cursor-pointer`} title={`${p.name} (${p.variant})`}>
                <PetIcon defId={p.defId} size={28} glow={false} />
                <span
                  onClick={async () => {
                    const reason = prompt("Reason for removing this pet (audit-logged):");
                    if (reason && reason.length >= 3) await act("players.removePet", { targetId: user.id, petId: p.id, reason }, "Pet removed");
                  }}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] items-center justify-center hidden group-hover:flex cursor-pointer"
                >×</span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      <div className="flex flex-wrap gap-1.5">
        {can("players.view") && (
          <ReasonAction label="Add note" icon={<StickyNote size={12} />} busy={busy === "players.note"}
            onSubmit={async (reason) => {
              const note = prompt("Note text (internal, not visible to player):");
              if (!note) return false;
              return act("players.note", { targetId: user.id, note: `[${reason}] ${note}` }, "Note added");
            }}>
            <p className="text-xs text-slate-500">A dialog will ask for the note text.</p>
          </ReasonAction>
        )}
        {can("moderation.manage") && !activeBan && (
          <ReasonAction label="Ban" icon={<Ban size={12} />} danger busy={busy === "players.ban"}
            onSubmit={(reason, x) => act("players.ban", { targetId: user.id, hours: Number(x.hours ?? 24), reason }, "Player banned")}>
            <Field label="Duration in hours (0 = permanent)"><TextInput name="hours" type="number" defaultValue={24} /></Field>
          </ReasonAction>
        )}
        {can("moderation.manage") && activeBan && (
          <ReasonAction label="Unban" icon={<ShieldAlert size={12} />} busy={busy === "players.unban"}
            onSubmit={(reason) => act("players.unban", { targetId: user.id, reason }, "Ban revoked")}>
            <p className="text-xs text-slate-500">Revoke the active ban immediately.</p>
          </ReasonAction>
        )}
        {can("players.edit") && (
          <ReasonAction label="Reset progression" icon={<RotateCcw size={12} />} danger busy={busy === "players.resetProgress"}
            onSubmit={(reason, x) => (x.confirm === "RESET" ? act("players.resetProgress", { targetId: user.id, reason, confirm: "RESET" }, "Progression wiped") : Promise.resolve(false))}>
            <Field label='Type RESET to confirm'><TextInput name="confirm" placeholder="RESET" /></Field>
            <p className="text-[11px] text-rose-300/80">Wipes energy, currencies, upgrades, pets and quest progress.</p>
          </ReasonAction>
        )}
        {can("roles.manage") && (
          <ReasonAction label="Set role" icon={<ShieldAlert size={12} />} busy={busy === "players.setRole"}
            onSubmit={(reason, x) => act("players.setRole", { targetId: user.id, role: x.role ?? "player", reason }, "Role updated")}>
            <Field label="New role">
              <select name="role" className="w-full rounded-xl bg-black/30 border border-line px-3 py-2 text-sm" defaultValue="support">
                {["player", "support", "moderator", "admin", "super_admin"].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </ReasonAction>
        )}
      </div>

      {detail.notes.length > 0 && (
        <Panel title="Internal notes">
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {detail.notes.map((n) => (
              <div key={n.id} className="text-[11px] text-slate-400 glass-soft rounded-lg px-2.5 py-1.5">{n.note}<span className="text-slate-600 ml-2 num">{new Date(n.createdAt).toLocaleDateString()}</span></div>
            ))}
          </div>
        </Panel>
      )}
      {detail.redemptions.length > 0 && (
        <Panel title="Recent code redemptions">
          <div className="space-y-1">
            {detail.redemptions.map((r, i) => (
              <div key={i} className="text-[11px] text-slate-400 flex justify-between"><span className="font-mono text-fuchsia-300">{r.code}</span><span className="num text-slate-600">{new Date(r.at).toLocaleDateString()}</span></div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

type PlayersTabRun = <T = unknown>(action: string, params?: Record<string, unknown>, okMsg?: string) => Promise<T | null>;
