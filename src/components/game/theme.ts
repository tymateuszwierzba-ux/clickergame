import { WORLDS } from "@/config/game";

/** Per-world ambient background styles for the game shell. */
export const WORLD_THEME_BG: Record<number, string> = Object.fromEntries(
  WORLDS.map((w) => [
    w.id,
    `radial-gradient(900px 500px at 80% -10%, ${w.theme.accent}14, transparent 60%), radial-gradient(700px 600px at 10% 110%, ${w.theme.accent}0d, transparent 55%)`,
  ]),
);
