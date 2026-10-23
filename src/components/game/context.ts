"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ClientState, GameTab } from "@/types/client";

export interface GameApi {
  state: ClientState;
  act: (action: string, params?: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  refresh: () => Promise<ClientState>;
  toast: (t: { title: string; body?: string; kind?: "ok" | "rare" | "error" }) => void;
  selectTab: (t: GameTab) => void;
  setState: (fn: (s: ClientState) => ClientState) => void;
}

export const GameCtx = createContext<GameApi | null>(null);

export function useGame(): GameApi {
  const ctx = useContext(GameCtx);
  if (!ctx) throw new Error("useGame must be used inside GameApp");
  return ctx;
}

export type { ClientState, ClientPet, ClientQuest, GameTab } from "@/types/client";

/** Ticking clock hook — all writes happen behind async boundaries. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    const iv = setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, [intervalMs]);
  return now;
}
