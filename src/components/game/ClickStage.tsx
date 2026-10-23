"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { fmt, bn } from "@/lib/num";
import { useGame } from "./context";
import { sfxClick, sfxCrit } from "./sound";

interface FloatNum {
  id: number;
  x: number;
  y: number;
  text: string;
  crit: boolean;
}

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string;
}

const PARTICLE_COLORS = ["#22d3ee", "#a78bfa", "#67e8f9", "#e879f9", "#7dd3fc"];

export default function ClickStage() {
  const { state, setState } = useGame();
  const [floats, setFloats] = useState<FloatNum[]>([]);
  const [pressed, setPressed] = useState(false);
  const [critFlash, setCritFlash] = useState(false);
  const [shake, setShake] = useState(false);
  const floatId = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const rafRef = useRef(0);
  const pending = useRef<{ count: number; crits: number }>({ count: 0, crits: 0 });
  const reducedMotion = useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(prefers-reduced-motion: reduce)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );

  // Register pending clicks into the shared batch counter on window (GameApp flushes)
  useEffect(() => {
    const flush = () => {
      if (pending.current.count > 0) {
        window.dispatchEvent(new CustomEvent("nexora:clicks", { detail: { count: pending.current.count } }));
        pending.current = { count: 0, crits: 0 };
      }
    };
    const iv = setInterval(flush, 150);
    return () => clearInterval(iv);
  }, []);

  // Particle renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = () => {
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      particles.current = particles.current.filter((p) => p.life > 0);
      for (const p of particles.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.vx *= 0.985;
        p.life -= 1;
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha + 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const spawnBurst = useCallback((x: number, y: number, crit: boolean) => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const n = crit ? 26 : 10;
    for (let i = 0; i < n && particles.current.length < 420; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (crit ? 3.4 : 2.2) + Math.random() * 2.4;
      particles.current.push({
        x: x - rect.left,
        y: y - rect.top,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        life: 34 + Math.random() * 22,
        maxLife: 56,
        size: crit ? 2.4 + Math.random() * 2.2 : 1.4 + Math.random() * 1.6,
        color: crit ? "#fbbf24" : PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      });
    }
  }, [reducedMotion]);

  const onClick = useCallback(
    (e: React.MouseEvent | React.Touch) => {
      const crit = Math.random() < state.stats.critChance;
      const comboNext = Math.min(state.combo + pending.current.count + 1, state.stats.comboCap);
      const gain = bn(state.stats.clickPower).times(crit ? state.stats.critMult : 1);
      pending.current.count += 1;
      if (crit) pending.current.crits += 1;

      // Optimistic update
      setState((s) => ({
        ...s,
        energy: bn(s.energy).plus(gain).toFixed(0),
        lifetimeEarned: bn(s.lifetimeEarned).plus(gain).toFixed(0),
        totalClicks: s.totalClicks + 1,
        combo: Math.min(s.combo + 1, s.stats.comboCap),
        bestCombo: Math.max(s.bestCombo, comboNext),
      }));

      setPressed(true);
      setTimeout(() => setPressed(false), 90);
      if (crit) {
        setCritFlash(true);
        setShake(true);
        setTimeout(() => { setCritFlash(false); setShake(false); }, 200);
        if (Math.random() < 0.5) sfxCrit();
      }
      sfxClick();

      const id = ++floatId.current;
      const jitter = 14;
      const fx = e.clientX - 20 + (Math.random() - 0.5) * jitter * 2;
      const fy = e.clientY - 34;
      const host = document.getElementById("click-stage");
      const hostRect = host?.getBoundingClientRect();
      const lx = hostRect ? fx - hostRect.left : fx;
      const ly = hostRect ? fy - hostRect.top : fy;
      setFloats((f) => [...f.slice(-24), { id, x: lx, y: ly, text: `${crit ? "CRIT +" : "+"}${fmt(gain)}`, crit }]);
      setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 950);
      spawnBurst(e.clientX, e.clientY, crit);
    },
    [state.combo, state.stats.critChance, state.stats.critMult, state.stats.clickPower, state.stats.comboCap, setState, spawnBurst],
  );

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        const el = document.getElementById("click-core");
        const r = el?.getBoundingClientRect();
        if (r) onClick({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 } as React.MouseEvent);
        e.preventDefault();
      }
    },
    [onClick],
  );

  const comboPct = Math.min(100, (state.combo / state.stats.comboCap) * 100);

  return (
    <div id="click-stage" className={`relative flex flex-col items-center justify-center py-6 sm:py-10 no-select ${shake && !reducedMotion ? "anim-shake" : ""}`} onKeyDown={onKey}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden />
      {/* crit flash ring */}
      {critFlash && !reducedMotion && (
        <div className="absolute w-64 h-64 rounded-full pointer-events-none" style={{ border: "3px solid rgba(251,191,36,.9)", boxShadow: "0 0 60px rgba(251,191,36,.5)", animation: "crit-flash .28s ease-out forwards", left: "50%", top: "50%", marginLeft: "-128px", marginTop: "-128px" }} aria-hidden />
      )}

      {/* Floating numbers */}
      {floats.map((f) => (
        <span key={f.id} className="float-num" style={{ left: f.x, top: f.y, color: f.crit ? "#fbbf24" : "#67e8f9", fontSize: f.crit ? 20 : 14 }}>
          {f.text}
        </span>
      ))}

      {/* Combo indicator */}
      <div className="mb-5 h-8 flex items-center gap-2">
        {state.combo > 4 && (
          <div className="anim-pop-in flex items-center gap-2 rounded-full glass-soft px-4 py-1.5">
            <span className="text-[10px] font-bold tracking-widest text-cyan-300 uppercase">Combo</span>
            <span className="num text-sm font-bold text-white">×{state.combo}</span>
            <div className="w-16 progress-track h-1">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 transition-all duration-200" style={{ width: `${comboPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* The Core */}
      <button
        id="click-core"
        onClick={(e) => onClick(e)}
        aria-label="Click the energy core"
        className="relative cursor-pointer no-select outline-none group"
        style={{ touchAction: "manipulation" }}
      >
        {/* ambient glow */}
        <div className="absolute -inset-10 rounded-full bg-cyan-500/12 blur-3xl group-active:bg-cyan-400/20 transition-colors" />
        {/* orbit rings — slow clockwise dashed + counter-rotating dot ring */}
        <div className="absolute -inset-5 rounded-full border border-cyan-400/20 animate-spin-slow" style={{ borderStyle: "dashed" }} />
        <div className="absolute -inset-12 rounded-full border border-violet-400/10" style={{ animation: "counter-rotate 22s linear infinite" }}>
          <span className="absolute top-1/2 -left-1 w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,.9)]" />
          <span className="absolute top-0 left-1/2 w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,.9)]" />
        </div>

        <div
          className={`relative w-44 h-44 sm:w-56 sm:h-56 rounded-full transition-transform duration-75 ${pressed ? "scale-[0.93]" : "scale-100 group-hover:scale-[1.02]"}`}
          style={{
            background: "radial-gradient(circle at 35% 28%, rgba(165,243,252,.95) 0%, rgba(34,211,238,.9) 18%, rgba(129,90,246,.85) 55%, rgba(30,16,72,.95) 100%)",
            boxShadow: "0 0 60px rgba(34,211,238,.45), 0 0 120px rgba(124,58,237,.25), inset 0 -18px 50px rgba(8,6,32,.7)",
          }}
        >
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute -left-1/2 top-0 w-[200%] h-full opacity-30" style={{ background: "conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,.35) 40deg, transparent 90deg)", animation: "core-sheen 6s linear infinite" }} />
            <div className="absolute inset-[14%] rounded-full opacity-40" style={{ background: "radial-gradient(circle at 60% 65%, rgba(240,171,252,.5), transparent 60%)", animation: "pulse-soft 2.6s ease-in-out infinite" }} />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-cyan-100/90">Nexus Core</span>
            <span className="num text-xl sm:text-2xl font-bold mt-1 drop-shadow-lg">+{fmt(state.stats.clickPower)}</span>
            <span className="text-[10px] text-cyan-100/70 mt-0.5">per click</span>
          </div>
        </div>
      </button>

      <div className="mt-8 text-center">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Energy</div>
        <div className="num text-4xl sm:text-5xl font-bold text-white text-glow mt-1" aria-live="off">
          <span key={fmt(state.energy)} className="anim-num-pop">{fmt(state.energy)}</span>
        </div>
        <div className="mt-2 flex items-center justify-center gap-4 text-xs text-slate-400">
          <span className="num">+{fmt(state.stats.passivePerSec)}/s passive</span>
          <span className="text-slate-600">·</span>
          <span className="num">{state.totalClicks.toLocaleString()} clicks</span>
          <span className="text-slate-600">·</span>
          <span className="num text-amber-300">{(state.stats.critChance * 100).toFixed(0)}% crit ×{state.stats.critMult.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}
