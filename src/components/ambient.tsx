"use client";

import { useEffect, useRef } from "react";

/** Layered ambient background: gradient nebulas + animated starfield canvas + grid. */
export default function Ambient({ density = 90 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    interface Star { x: number; y: number; z: number; tw: number }
    let stars: Star[] = [];

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: Math.round((density * w) / 900) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: 0.3 + Math.random() * 0.7,
        tw: Math.random() * Math.PI * 2,
      }));
      if (reduced) draw(0);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const alpha = 0.25 + 0.55 * Math.abs(Math.sin(t / 1600 + s.tw));
        ctx.fillStyle = `rgba(165, 220, 255, ${alpha * s.z})`;
        ctx.fillRect(s.x, s.y, s.z < 0.6 ? 1 : 1.6, s.z < 0.6 ? 1 : 1.6);
      }
    };

    const loop = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener("resize", resize);
    if (!reduced) raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [density]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 15% -10%, rgba(34,211,238,.10), transparent 60%), radial-gradient(1000px 700px at 85% 0%, rgba(167,139,250,.12), transparent 55%), radial-gradient(900px 900px at 50% 115%, rgba(244,114,182,.07), transparent 60%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.14) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 75%)",
        }}
      />
      <canvas ref={ref} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
