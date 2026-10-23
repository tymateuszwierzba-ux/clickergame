# NEXORA — INFINITE CLICKER

A premium, server-authoritative web clicker game built with **Next.js 16 (App Router)**, **React 19**, **TypeScript (strict)**, **Tailwind CSS v4**, **Drizzle ORM + PostgreSQL**, **BigNumber.js** (arbitrary-precision economy), **Zod** (request validation), **Recharts** (admin analytics) and **Vitest**.

Charge the core. Hatch 80 companions across ten worlds. Rebirth, prestige, ascend, reset galaxies. Everything you earn is computed, validated and stored on the server.

---

## Quick start

```bash
npm install
# configure .env (see Environment below)
npx drizzle-kit push     # create/update tables
npx tsx src/db/seed.ts   # seed dev accounts + starter content
npm run dev              # http://localhost:3000
```

### Development accounts (created by the seed — never use in production)

| Role       | Email               | Password         |
|------------|---------------------|------------------|
| Owner      | `owner@nexora.dev`  | `Nexora#Dev2026` |
| Admin      | `admin@nexora.dev`  | `Nexora#Dev2026` |
| Moderator  | `mod@nexora.dev`    | `Nexora#Dev2026` |
| Support    | `support@nexora.dev`| `Nexora#Dev2026` |
| Player     | `nova@nexora.dev`   | `Nexora#Dev2026` |

The seed also creates promo codes (`NEXORA2026`, `LAUNCHDAY`, `FIRSTCLICK`) and a launch event.

## Environment

Copy `.env.example` → `.env`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `OWNER_EMAILS` | Comma-separated emails promoted to **owner** role at registration — the secure owner bootstrap. Roles are only ever decided server-side. |
| `SEED_PASSWORD` | Password for seeded dev accounts only. Never commit real credentials. |

Secrets are only read in server code. No `NEXT_PUBLIC_*` secrets exist; the browser never sees credentials or internal data beyond its own state.

## Architecture

```
src/
  config/game.ts     All content definitions (worlds, 80 pets, 12 upgrades,
                     4 reset tiers, quests, 60+ achievements, shop, events, daily rewards)
  lib/num.ts         BigNumber helpers + K/M/B/T/Qa…/scientific formatting
  lib/engine.ts      Pure game math (shared client/server): stats, click sim,
                     pricing, reset gains, egg rolls, offline earnings
  db/schema.ts       Drizzle schema (users, sessions, game_states, pets, quests,
                     achievements, codes, events, bans, audit_logs, config, metrics…)
  server/            auth (bcrypt + hashed session tokens), permissions (RBAC),
                     game (authoritative transactions), admin (ops actions), http (errors)
  app/               Landing, login/register, /game, /admin, /api/*
  components/        Design system, game shell & panels, admin console
  tests/             Vitest unit suite (29 tests)
```

### Server authority & anti-cheat
- Click batches carry an **idempotency key** (`batch_keys` table) — replays are acknowledged without reward.
- All mutations (`buyUpgrade`, `hatchEggs`, resets, daily claims, quest claims, code redemptions, shop purchases, world unlocks) run in **DB transactions with row locks**.
- **Token-bucket rate limits** for clicks, hatches, auth and admin calls.
- Egg probabilities are rolled **server-side with a CSPRNG**; published weights are validated to total 100% by tests; pity state persists per egg.
- Code redemption is atomic with a **unique (code, user) constraint**.
- Passwords: **bcrypt(10)**. Sessions: random 256-bit tokens, **sha256-hashed at rest**, httpOnly + SameSite=Lax cookies (Secure in production), 30-day expiry.
- Bans are enforced on every request; banning drops all sessions (kick).
- Leaderboard ordering uses indexed numeric shadow columns; rankings never read browser storage.

### Admin platform (`/admin`)
Owner → Super Admin → Admin → Moderator → Support, with granular permissions enforced on every action:

- **Overview** — live aggregates, 14-day activity charts, db health, recent ops, economy leaders.
- **Players** — search/detail drawer, grant/take currency, give/remove pets, ban/unban (kicks sessions), full progression reset (typed confirm), internal notes, role management (owner only).
- **Economy** — multiplier/price/luck overrides with bounds-checked validation, versioning and **rollback**.
- **Events**, **Codes** (create/limits/expiry/redemption log), **Pets & Content** (disable definitions, egg price override, quest toggles), **Moderation** center, **Audit Log** (filterable, expandable, CSV export, append-only), **Config** center (feature flags incl. maintenance mode), and a **Command Console** (`/give`, `/ban`, `/event start`, `/announce`, `/logs`, `/config validate`…) that routes through the same permission layer.
- Every privileged action requires a **reason** and writes an audit record with before/after values.

### Numbers
All currency is arbitrary-precision (BigNumber, stored as decimal strings). Formatting: K, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc, UDc, DDc, TDc, QaDc, QiDc, then scientific notation. Upgrade costs are charged as the exact sum of each level's displayed (ceiled) price — the button price is always what you pay.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / start |
| `npm run typecheck` | Strict TypeScript check |
| `npx vitest run` | Unit tests (engine, pricing, probabilities, permissions) |
| `npx drizzle-kit push` | Apply schema to the database |
| `npx tsx src/db/seed.ts` | Seed dev data |

## Testing status

- **29/29 unit tests pass** (formatting, pricing parity, max-affordable solver, stats stacking, reset math, weight normalization, pity, content integrity, RBAC).
- Type check, production build and DB migrations verified in CI-style local runs.

## Intentionally out of scope (for now)

- Real-money payments (shop uses earnable gems only — no card data anywhere).
- Player-to-player trading (sidebar omits it until a safe design ships).
- Guest-mode progress transfer (accounts are free and instant instead).
- Playwright E2E runner (unit + integration paths are covered; browser harness not installed in this sandbox).

## Deployment (Vercel / Node)

1. Provision PostgreSQL (Neon, Supabase, RDS…), set `DATABASE_URL`.
2. Set `OWNER_EMAILS` to your real admin email(s).
3. Run `npx drizzle-kit push` against the production database.
4. Deploy with `npm run build && npm start` (or Vercel auto-detect).
5. Register your owner account with a whitelisted email — owner powers activate automatically.
