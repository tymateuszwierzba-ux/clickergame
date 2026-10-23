"use client";

import Link from "next/link";
import { MousePointerClick, Egg, Sparkles, Trophy, Globe2, Swords, Calendar, ShieldCheck, Zap, ArrowRight, Gem } from "lucide-react";
import { WORLDS } from "@/config/game";
import Ambient from "@/components/ambient";
import HeroCore from "@/components/hero-core";

const FEATURES = [
  { icon: MousePointerClick, t: "Satisfying Core Loop", d: "Crits, combos, particle bursts and floating numbers. Every click lands with weight.", c: "#22d3ee" },
  { icon: Zap, t: "Deep Upgrade Web", d: "Twelve interlocking upgrade tracks with exponential pricing and buy-max planning.", c: "#a78bfa" },
  { icon: Egg, t: "Pets & Eggs", d: "80 companions across 8 rarities, golden & shiny variants, fusion, pity timers.", c: "#f472b6" },
  { icon: Sparkles, t: "Four Reset Tiers", d: "Rebirth, Prestige, Ascension, Galaxy — each one rewrites your multiplier stack.", c: "#fbbf24" },
  { icon: Globe2, t: "Ten Worlds", d: "From Neon District to the Infinite Nexus, each with its own egg, pets and bonus.", c: "#34d399" },
  { icon: Trophy, t: "Live Leaderboards", d: "Seven categories, ranked server-side in real time. Your name up in lights.", c: "#38bdf8" },
  { icon: Calendar, t: "Quests & Daily Rewards", d: "Daily + weekly quests, streak calendars and a vault of achievements.", c: "#e879f9" },
  { icon: Swords, t: "Live Events", d: "Double Energy, Meteor Showers, Golden Hours — live-ops events run by real admins.", c: "#fb923c" },
];

export default function Landing({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="min-h-dvh relative">
      <Ambient density={120} />

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-line bg-abyss/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center shadow-[0_0_24px_rgba(34,211,238,.4)]">
              <Zap size={18} className="text-white" strokeWidth={2.6} />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">NEXORA</span>
            <span className="text-[10px] font-mono text-cyan-400/80 border border-cyan-500/30 rounded px-1.5 py-0.5 mt-0.5">INFINITE CLICKER</span>
          </div>
          <nav className="flex items-center gap-2">
            {loggedIn ? (
              <Link href="/game" className="btn-press inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(34,211,238,.3)] hover:brightness-110">
                Continue Playing <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn-press rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
                  Sign in
                </Link>
                <Link href="/register" className="btn-press inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(34,211,238,.3)] hover:brightness-110">
                  Play Free <ArrowRight size={16} />
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] items-center gap-6">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 glass-soft rounded-full px-4 py-1.5 text-xs text-cyan-300 mb-7 anim-pop-in">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              The grid is live — seasons running now
            </div>
            <h1 className="anim-pop-in font-bold tracking-tight text-white leading-[0.98] text-5xl sm:text-7xl">
              CLICK<span className="text-neon text-glow">.</span>
              <br />
              ASCEND<span className="text-pulse text-glow-violet">.</span>
              <br />
              <span className="bg-gradient-to-r from-cyan-300 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                REPEAT FOREVER.
              </span>
            </h1>
            <p className="anim-pop-in mt-6 max-w-lg mx-auto lg:mx-0 text-slate-400 text-base sm:text-lg leading-relaxed">
              An infinite clicker forged in neon. Charge the core, hatch companions from ten
              worlds, and transcend through four tiers of rebirth — every number earned,
              verified and remembered by the server.
            </p>
            <div className="anim-pop-in mt-8 flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3">
              <Link
                href={loggedIn ? "/game" : "/register"}
                className="btn-press inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-500 px-8 py-4 text-base font-bold text-white shadow-[0_0_36px_rgba(34,211,238,.35)] hover:shadow-[0_0_48px_rgba(34,211,238,.5)] hover:brightness-110"
                style={{ animation: "ticker-glow 3.4s ease-in-out infinite" }}
              >
                <Zap size={19} strokeWidth={2.6} /> {loggedIn ? "Enter the Grid" : "Start Clicking — Free"}
              </Link>
              <a href="#features" className="btn-press inline-flex items-center gap-2 rounded-2xl glass-soft px-8 py-4 text-base font-semibold text-slate-200 hover:bg-white/10">
                Explore the systems
              </a>
            </div>
            <div className="mt-7 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-400" /> Server-authoritative</span>
              <span className="inline-flex items-center gap-1.5"><Gem size={14} className="text-fuchsia-400" /> No pay-to-win</span>
              <span className="inline-flex items-center gap-1.5"><Sparkles size={14} className="text-cyan-300" /> 60+ achievements</span>
            </div>
          </div>
          <div className="anim-pop-in">
            <HeroCore />
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ["10", "Worlds to unlock", "#22d3ee"],
            ["80", "Companions to hatch", "#f472b6"],
            ["4", "Tiers of transcendence", "#a78bfa"],
            ["∞", "Multipliers to stack", "#fbbf24"],
          ].map(([v, l, c]) => (
            <div key={l} className="glass-soft rounded-2xl px-4 py-3.5 text-center relative overflow-hidden group hover:border-white/15 transition-colors">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `radial-gradient(120px 60px at 50% 0%, ${c}18, transparent)` }} />
              <div className="num text-2xl font-bold relative" style={{ color: c }}>{v}</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 mt-0.5 relative">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-2">Built like a real live game</h2>
        <p className="text-slate-500 text-center text-sm mb-10">Clicker depth, platform polish, operations-grade backend.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <div key={f.t} className="glass rounded-2xl p-5 group hover:border-white/20 transition-all hover:-translate-y-1 duration-300 relative overflow-hidden">
              <div className="absolute -top-6 -right-2 font-mono text-[64px] font-bold opacity-[0.055] select-none pointer-events-none" style={{ color: f.c }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3" style={{ background: `${f.c}1f`, color: f.c, boxShadow: `0 0 0px ${f.c}00`, transitionProperty: "transform, box-shadow" }}>
                <f.icon size={19} />
              </div>
              <h3 className="font-bold text-white mb-1.5 relative">{f.t}</h3>
              <p className="text-[13px] text-slate-400 leading-relaxed relative">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Worlds marquee */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 overflow-hidden">
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-2">Ten worlds to conquer</h2>
        <p className="text-slate-500 text-center text-sm mb-10">Each world unlocks a new egg, new companions, and a permanent bonus.</p>
        <div className="relative">
          <div className="flex gap-4 w-max" style={{ animation: "scroll-x 42s linear infinite" }}>
            {[...WORLDS, ...WORLDS].map((w, i) => (
              <div
                key={`${w.id}-${i}`}
                className="glass rounded-2xl p-4 w-56 shrink-0 relative overflow-hidden"
                style={{ borderColor: `${w.theme.accent}33` }}
              >
                <div className="absolute inset-0 opacity-25" style={{ background: `linear-gradient(135deg, ${w.theme.accent}40, transparent 60%)` }} />
                <div className="relative">
                  <div className="text-[10px] font-mono" style={{ color: w.theme.accent }}>WORLD {String(w.id).padStart(2, "0")}</div>
                  <div className="font-bold text-white mt-0.5">{w.name}</div>
                  <div className="text-[11px] text-slate-400 mt-1 italic">{w.tagline}</div>
                  <div className="text-[10px] text-slate-500 mt-2">+{w.bonusPct}% world bonus</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-24 text-center">
        <div className="glass rounded-3xl p-10 relative overflow-hidden">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-cyan-500/15 blur-3xl" />
          <h2 className="relative text-3xl sm:text-4xl font-bold text-white">The core is waiting.</h2>
          <p className="relative text-slate-400 mt-3 text-sm sm:text-base">Free account. Thirty seconds in, your first thousand energy. Where it ends is up to you.</p>
          <Link
            href={loggedIn ? "/game" : "/register"}
            className="relative btn-press mt-7 inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-500 px-9 py-4 text-base font-bold text-white shadow-[0_0_36px_rgba(34,211,238,.35)] hover:brightness-110"
          >
            {loggedIn ? "Back to the Grid" : "Create Your Account"} <ArrowRight size={18} />
          </Link>
        </div>
        <footer className="mt-10 text-[11px] text-slate-600">
          NEXORA — INFINITE CLICKER · Server-authoritative incremental game · No downloads, no pay-to-win
        </footer>
      </section>
    </div>
  );
}
