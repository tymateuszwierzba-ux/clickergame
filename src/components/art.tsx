"use client";

import { useMemo } from "react";
import { seededRng, hashStr } from "@/lib/num";

/* Procedural SVG artwork — original generative art, no external assets. */

const PALETTES: Record<string, [string, string, string]> = {
  nova: ["#22d3ee", "#818cf8", "#0ea5e9"],
  pulse: ["#a78bfa", "#f472b6", "#7c3aed"],
  orbit: ["#34d399", "#22d3ee", "#059669"],
  quasar: ["#fbbf24", "#fb923c", "#f59e0b"],
  vex: ["#fb7185", "#f472b6", "#e11d48"],
  lyra: ["#67e8f9", "#38bdf8", "#0369a1"],
  ion: ["#c084fc", "#818cf8", "#6d28d9"],
  rune: ["#4ade80", "#a3e635", "#15803d"],
  flux: ["#f472b6", "#fb7185", "#be185d"],
  echo: ["#93c5fd", "#a5b4fc", "#4f46e5"],
  novapilot: ["#22d3ee", "#818cf8", "#0ea5e9"],
};

export function Avatar({ seed, size = 36, className = "" }: { seed: string; size?: number; className?: string }) {
  const pal = PALETTES[seed.toLowerCase()] ?? PALETTES[Object.keys(PALETTES)[hashStr(seed) % Object.keys(PALETTES).length]];
  const rng = useMemo(() => seededRng(hashStr(seed)), [seed]);
  const shapes = useMemo(() => {
    const r = rng;
    const pts: { cx: number; cy: number; rad: number; c: string; o: number }[] = [];
    for (let i = 0; i < 5; i++) pts.push({ cx: r() * 40, cy: r() * 40, rad: 4 + r() * 9, c: pal[i % 3], o: 0.25 + r() * 0.4 });
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);
  const gid = `ag-${seed.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={`rounded-full ${className}`} aria-hidden>
      <defs>
        <radialGradient id={gid} cx="35%" cy="30%">
          <stop offset="0%" stopColor={pal[0]} />
          <stop offset="100%" stopColor={pal[2]} />
        </radialGradient>
      </defs>
      <rect width="40" height="40" fill="#0a0d1f" />
      <rect width="40" height="40" fill={`url(#${gid})`} opacity="0.25" />
      {shapes.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={s.rad} fill={s.c} opacity={s.o} />
      ))}
      <circle cx="20" cy="20" r="7" fill={`url(#${gid})`} opacity="0.95" />
      <circle cx="20" cy="20" r="10.5" fill="none" stroke={pal[1]} strokeWidth="0.8" opacity="0.5" />
    </svg>
  );
}

export function PetIcon({ defId, size = 56, glow = true }: { defId: string; size?: number; glow?: boolean }) {
  const { body, spikes, hue } = useMemo(() => {
    const r = seededRng(hashStr(defId));
    const spikesCount = 3 + Math.floor(r() * 5);
    const sp: { angle: number; len: number; w: number }[] = [];
    for (let i = 0; i < spikesCount; i++) sp.push({ angle: (Math.PI * 2 * i) / spikesCount + r() * 0.5, len: 10 + r() * 12, w: 2.5 + r() * 2.5 });
    return { body: 14 + r() * 5, spikes: sp, hue: r() };
  }, [defId]);

  const gid = `pg-${defId}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="drop-shadow-lg">
      <defs>
        <radialGradient id={gid} cx="38%" cy="32%">
          <stop offset="0%" stopColor="var(--r, #22d3ee)" stopOpacity="1" />
          <stop offset="100%" stopColor="#0a0d1f" stopOpacity="0.9" />
        </radialGradient>
      </defs>
      {glow && <circle cx="32" cy="32" r="26" fill="var(--r, #22d3ee)" opacity="0.08" />}
      {spikes.map((s, i) => {
        const x1 = 32 + Math.cos(s.angle) * (body - 2);
        const y1 = 32 + Math.sin(s.angle) * (body - 2);
        const x2 = 32 + Math.cos(s.angle) * (body + s.len);
        const y2 = 32 + Math.sin(s.angle) * (body + s.len);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--r, #22d3ee)" strokeWidth={s.w} strokeLinecap="round" opacity="0.75" />;
      })}
      <circle cx="32" cy="32" r={body} fill={`url(#${gid})`} stroke="var(--r, #22d3ee)" strokeWidth="1.4" />
      <ellipse cx="27" cy="27" rx={body * 0.28} ry={body * 0.18} fill="#fff" opacity={0.28 + hue * 0.2} transform={`rotate(-30 27 27)`} />
      <circle cx="26.5" cy="30" r="2.4" fill="#060814" opacity="0.85" />
      <circle cx="37.5" cy="30" r="2.4" fill="#060814" opacity="0.85" />
      <circle cx="27.2" cy="29.3" r="0.8" fill="#fff" opacity="0.9" />
      <circle cx="38.2" cy="29.3" r="0.8" fill="#fff" opacity="0.9" />
    </svg>
  );
}

export function EggIcon({ size = 56, worldId = 1 }: { size?: number; worldId?: number }) {
  const gid = `eg-${worldId}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <radialGradient id={gid} cx="40%" cy="30%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="55%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </radialGradient>
      </defs>
      <ellipse cx="32" cy="58" rx="16" ry="3.5" fill="#000" opacity="0.45" />
      <path d="M32 6 C44 6 52 24 52 38 C52 50 43 58 32 58 C21 58 12 50 12 38 C12 24 20 6 32 6 Z" fill={`url(#${gid})`} stroke="#67e8f9" strokeWidth="1.2" opacity="0.98" />
      <path d="M22 26 L30 32 L24 40 M38 20 L34 30 L42 36" stroke="#a5f3fc" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.8" />
      <ellipse cx="26" cy="20" rx="5" ry="8" fill="#fff" opacity="0.14" transform="rotate(-16 26 20)" />
    </svg>
  );
}
