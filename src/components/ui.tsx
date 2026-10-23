"use client";

import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { fmt } from "@/lib/num";

/* --------------------------------- Buttons --------------------------------- */

type BtnVariant = "primary" | "ghost" | "danger" | "gold" | "success" | "outline";

export function Btn({
  variant = "ghost",
  size = "md",
  loading,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "xs" | "sm" | "md" | "lg"; loading?: boolean }) {
  const base = "btn-press inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-colors disabled:opacity-45 disabled:pointer-events-none cursor-pointer no-select";
  const sizes = {
    xs: "text-[11px] px-2 py-1 rounded-lg",
    sm: "text-xs px-3 py-1.5",
    md: "text-sm px-4 py-2",
    lg: "text-base px-6 py-3 rounded-2xl",
  }[size];
  const variants: Record<BtnVariant, string> = {
    primary: "bg-gradient-to-r from-cyan-500 to-violet-500 text-white shadow-[0_0_20px_rgba(34,211,238,.25)] hover:shadow-[0_0_28px_rgba(34,211,238,.45)] hover:brightness-110",
    ghost: "bg-white/5 text-slate-300 border border-line hover:bg-white/10 hover:text-white",
    outline: "bg-transparent text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/10",
    danger: "bg-rose-500/15 text-rose-300 border border-rose-500/40 hover:bg-rose-500/25",
    gold: "bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25",
    success: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25",
  };
  return (
    <button className={`${base} ${sizes} ${variants[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

/* ---------------------------------- Cards ---------------------------------- */

export function Panel({ title, right, children, className = "" }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`glass rounded-2xl p-4 sm:p-5 ${className}`}>
      {(title || right) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          <h2 className="panel-title">{title}</h2>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, sub, accent = "#22d3ee", icon }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string; icon?: ReactNode }) {
  return (
    <div className="glass-soft rounded-xl px-3.5 py-3 relative overflow-hidden">
      <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full blur-2xl opacity-30" style={{ background: accent }} />
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {icon}
        {label}
      </div>
      <div className="num mt-1 text-lg sm:text-xl font-bold text-white truncate" title={typeof value === "string" ? value : undefined}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

/* --------------------------------- Inputs ---------------------------------- */

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl bg-black/30 border border-line px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 transition-colors ${props.className ?? ""}`}
    />
  );
}

export function Field({ label, error, children }: { label: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="panel-title block mb-1.5">{label}</span>
      {children}
      {error && <span className="text-xs text-rose-400 mt-1 block">{error}</span>}
    </label>
  );
}

/* ---------------------------------- Modal ---------------------------------- */

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 anim-fade-in" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative glass rounded-2xl p-5 sm:p-6 w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[85dvh] overflow-y-auto anim-pop-in`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-white">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({
  open, onClose, onConfirm, title, body, confirmText = "Confirm", danger,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: ReactNode; confirmText?: string; danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-sm text-slate-300 mb-5">{body}</div>
      <div className="flex gap-2 justify-end">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant={danger ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }}>
          {confirmText}
        </Btn>
      </div>
    </Modal>
  );
}

/* --------------------------------- Progress -------------------------------- */

export function Progress({ value, max, className = "" }: { value: number; max: number; className?: string }) {
  const pct = Math.min(100, Math.max(0, (value / Math.max(max, 1)) * 100));
  return (
    <div className={`progress-track h-1.5 ${className}`}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ----------------------------------- Misc ---------------------------------- */

export function Empty({ icon, title, body }: { icon: ReactNode; title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
      <div className="w-12 h-12 rounded-2xl glass-soft flex items-center justify-center text-slate-500">{icon}</div>
      <div className="font-semibold text-slate-300">{title}</div>
      {body && <div className="text-xs text-slate-500 max-w-56">{body}</div>}
    </div>
  );
}

export function Price({ value, currency = "energy" }: { value: string; currency?: string }) {
  const color = currency === "gems" ? "text-fuchsia-300" : currency === "shards" ? "text-cyan-300" : "text-slate-200";
  return <span className={`num font-semibold ${color}`}>{currency === "gems" ? Number(value).toLocaleString() : fmt(value)}</span>;
}

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 size={18} className={`animate-spin text-cyan-300 ${className}`} />;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full py-2 cursor-pointer group"
    >
      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{label}</span>
      <span className={`w-10 h-5.5 h-[22px] rounded-full relative transition-colors ${checked ? "bg-cyan-500/80" : "bg-white/10"}`}>
        <span
          className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-[3px]"}`}
        />
      </span>
    </button>
  );
}
