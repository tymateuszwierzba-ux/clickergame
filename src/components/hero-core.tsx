"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Float { id: number; x: number; y: number; v: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string }

const COLORS = ["#22d3ee", "#a78bfa", "#e879f9", "#67e8f9"];

/** Interactive hero demo — a tiny self-contained taste of the game feel. */
export default function HeroCore() {
  const [count, setCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [floats, setFloats] = useState<Float[]>([]);
  const [pressed, setPressed] = useState(false);
  const idRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const parts = useRef<Particle[]>([]);
  const lastClick = useRef(0);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const loop = () => {
      ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
      parts.current = parts.current.filter((p) => p.life > 0);
      for (const p of parts.current) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 1.4;
        ctx.globalAlpha = Math.max(0, p.life / 40);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduced) raf = requestAnimationFrame(loop);
    };
    if (!reduced) raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  const click = useCallback((e: React.MouseEvent) => {
    const now = performance.now();
    setCombo((c) => (now - lastClick.current < 2500 ? c + 1 : 1));
    lastClick.current = now;
    setCount((c) => c + 1);
    setPressed(true);
    setTimeout(() => setPressed(false), 90);

    const id = ++idRef.current;
    const host = document.getElementById("hero-core")!.getBoundingClientRect();
    const fx = e.clientX - host.left - 25 + (Math.random() - 0.5) * 30;
    const fy = e.clientY - host.top - 30;
    const v = combo >= 10 ? Math.round(3 + combo * 0.4) : 1;
    setFloats((f) => [...f.slice(-16), { id, x: fx, y: fy, v }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 900);

    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      for (let i = 0; i < 8 && parts.current.length < 200; i++) {
        const a = Math.random() * Math.PI * 2;
        parts.current.push({
          x: e.clientX - rect.left, y: e.clientY - rect.top,
          vx: Math.cos(a) * (1.5 + Math.random() * 2), vy: Math.sin(a) * (1.5 + Math.random() * 2) - 1,
          life: 40, color: COLORS[Math.floor(Math.random() * COLORS.length)],
        });
      }
    }
  }, [combo]);

  return (
    <div id="hero-core" className="relative flex flex-col items-center justify-center py-10 no-select">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden />
      {floats.map((f) => (
        <span key={f.id} className="float-num" style={{ left: f.x, top: f.y, color: "#67e8f9", fontSize: 13 }}>
          +{f.v}
        </span>
      ))}
      <div className="mb-4 h-6">
        {combo > 2 && (
          <span className="anim-pop-in rounded-full glass-soft px-3 py-1 text-[11px] font-bold text-cyan-300">COMBO ×{combo}</span>
        )}
      </div>
      <button onClick={click} aria-label="Try the core" className="relative cursor-pointer group" style={{ touchAction: "manipulation" }}>
        <div className="absolute -inset-8 rounded-full bg-cyan-500/10 blur-3xl group-active:bg-cyan-400/25 transition-colors" />
        <div className="absolute -inset-4 rounded-full border border-cyan-400/25 animate-spin-slow" style={{ borderStyle: "dashed" }} />
        <div className="absolute -inset-10 rounded-full border border-violet-400/10" style={{ animation: "counter-rotate 20s linear infinite" }}>
          <span className="absolute -left-1 top-1/2 w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,.9)]" />
        </div>
        <div
          className={`relative w-40 h-40 sm:w-48 sm:h-48 rounded-full transition-transform duration-75 ${pressed ? "scale-[0.93]" : "group-hover:scale-[1.03]"}`}
          style={{
            background: "radial-gradient(circle at 35% 28%, rgba(165,243,252,.95) 0%, rgba(34,211,238,.9) 18%, rgba(129,90,246,.85) 55%, rgba(30,16,72,.95) 100%)",
            boxShadow: "0 0 50px rgba(34,211,238,.45), 0 0 110px rgba(124,58,237,.3), inset 0 -16px 44px rgba(8,6,32,.7)",
          }}
        >
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute -left-1/2 top-0 w-[200%] h-full opacity-30" style={{ background: "conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,.4) 40deg, transparent 90deg)", animation: "core-sheen 5s linear infinite" }} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-cyan-100/90">Tap me</span>
          </div>
        </div>
      </button>
      <div className="mt-5 text-center">
        <div className="num text-2xl font-bold text-white" aria-live="off"><span key={count} className="anim-num-pop">{count.toLocaleString()}</span></div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">demo energy — a taste of the real thing</div>
      </div>
    </div>
  );
}
