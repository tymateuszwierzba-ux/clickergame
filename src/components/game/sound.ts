"use client";

/* Synthesized WebAudio sound effects — no asset downloads required. */

let ctx: AudioContext | null = null;
let sfxEnabled = true;
let musicEnabled = false;
let masterGain: GainNode | null = null;
let ambienceNodes: { osc: OscillatorNode[]; gain: GainNode } | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setSfxEnabled(v: boolean) {
  sfxEnabled = v;
}
export function setMusicEnabled(v: boolean) {
  musicEnabled = v;
  if (v) startAmbience();
  else stopAmbience();
}
export function setVolume(v: number) {
  if (masterGain && ctx) masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime);
}

function blip(freq: number, dur: number, type: OscillatorType, vol: number, glide = 1.35) {
  const c = ensureCtx();
  if (!c || !masterGain || !sfxEnabled) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freq * glide, c.currentTime + dur);
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  osc.connect(g).connect(masterGain);
  osc.start();
  osc.stop(c.currentTime + dur + 0.02);
}

let lastClick = 0;
export function sfxClick() {
  const now = performance.now();
  if (now - lastClick < 45) return; // avoid clipping at very high cps
  lastClick = now;
  blip(340 + Math.random() * 120, 0.07, "triangle", 0.16, 1.6);
}
export function sfxCrit() {
  blip(720, 0.16, "sawtooth", 0.14, 1.9);
  blip(1080, 0.12, "triangle", 0.12, 1.5);
}
export function sfxPurchase() {
  blip(520, 0.12, "sine", 0.18, 1.35);
  setTimeout(() => blip(780, 0.14, "sine", 0.16, 1.3), 70);
}
export function sfxHatch(rarityIdx: number) {
  blip(440, 0.2, "sine", 0.16, 1.8);
  if (rarityIdx >= 4) {
    setTimeout(() => blip(660, 0.24, "triangle", 0.16, 1.7), 120);
    setTimeout(() => blip(990, 0.3, "triangle", 0.14, 1.6), 260);
  }
}
export function sfxAchievement() {
  [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.18, "sine", 0.14, 1.15), i * 90));
}
export function sfxRebirth() {
  [220, 330, 440, 660, 880].forEach((f, i) => setTimeout(() => blip(f, 0.34, "sine", 0.12, 1.25), i * 110));
}

function startAmbience() {
  const c = ensureCtx();
  if (!c || !masterGain || ambienceNodes) return;
  const gain = c.createGain();
  gain.gain.value = 0.05;
  gain.connect(masterGain);
  const oscs = [55, 55 * 1.5, 110.3].map((f) => {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    o.connect(gain);
    o.start();
    return o;
  });
  ambienceNodes = { osc: oscs, gain };
}

function stopAmbience() {
  if (!ambienceNodes) return;
  ambienceNodes.osc.forEach((o) => o.stop());
  ambienceNodes.gain.disconnect();
  ambienceNodes = null;
}
