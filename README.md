# A-Group · Financial Dashboard

A live, login-protected financial dashboard for A-Group: subscriptions, revenue, expenses, profit/loss and payables. All figures come from a real Postgres database.

**Live:** https://agroup-dashboard.YOUR-SUBDOMAIN.workers.dev  <!-- replace after your first deploy -->

| Sign-in | Dashboard |
| --- | --- |
| ![Sign-in](docs/screenshots/sign-in.png) | ![Dashboard](docs/screenshots/dashboard.png) |

| Mobile | Support role (money hidden) | Team & roles |
| --- | --- | --- |
| <img src="docs/screenshots/mobile.png" width="220"> | ![Support](docs/screenshots/support-role.png) | ![Team](docs/screenshots/team.png) |

## Stack (all free tiers, no credit card)

| Piece | Tool | What it does here |
| --- | --- | --- |
| Hosting | **Cloudflare Workers** (with static assets) | One worker serves the React app **and** the `/api` routes |
| Database | **Neon** Postgres | Companies, plans, subscriptions, payments, expenses, payables, users |
| Auth | **Clerk** | Sign-up / sign-in UI and session tokens |
| UI | React 19 + Vite + Tailwind CSS 4 | The dashboard itself (light/dark, mobile-friendly) |
| CI/CD | GitHub Actions | Build check on every PR, auto-deploy on push to `main` |

## How it works

```
Browser ──► Cloudflare Worker ──► /api/*  ── verify Clerk token ── check role ──► Neon (SQL over HTTPS)
                │
                └──► everything else: the built React app (dist/)
```

1. Anyone opening the link without a session is sent to **/sign-in** (Clerk).
2. After sign-in, the app calls `/api/...` with the Clerk **session token** (`Authorization: Bearer …`).
3. The worker verifies the token's RS256 signature against Clerk's public keys, checks expiry and which site it was issued for (`azp`), then loads the user's **role** from Neon.
4. Queries run on Neon. Money stays as exact decimals: totals are added up in integer cents, never floats.

### API

| Route | Who | Returns |
| --- | --- | --- |
| `GET /api/health` | public | `{ ok, database }` (used by the CI smoke test) |
| `GET /api/me` | signed in | your profile, role and permissions |
| `GET /api/dashboard/summary?period=monthly\|weekly` | signed in | counts, recent subscriptions; finance figures only if allowed |
| `GET /api/team` | Super admin | all users |
| `PATCH /api/team/:id` `{ role?, isActive? }` | Super admin | updated user |

### Permissions (bonus)

Roles live in the `admin_users` table and are enforced **on the server** for every request. The UI only hides what the API would refuse anyway.

| | See subscriptions | See money figures | Export CSV | Manage team |
| --- | :-: | :-: | :-: | :-: |
| **Super admin** | ✅ | ✅ | ✅ | ✅ |
| **Finance** | ✅ | ✅ | ✅ | |
| **Support** | ✅ | | | |

- The **first** person to sign in, and anyone listed in `ADMIN_EMAILS`, becomes Super admin.
- Everyone else starts as **Support** (least access) until a Super admin changes their role on **Team & roles**.
- Super admins can also **disable** someone's access. You can't change your own role, and there is always at least one Super admin.
- For Support users the API returns `finance: null` and blanks out amounts, so the numbers never reach their browser.

### What changed from the original version

- The NestJS + MySQL backend was replaced by a Cloudflare Worker + Neon Postgres. The calculation rules are the same: successful payments by `paid_at`, expenses by `expense_date`, payables = `amount − amount_paid`, and currencies are never mixed.
- Period boundaries are now computed in **Africa/Tripoli** time, so "this month" is the Tripoli month, not the server's UTC month.
- **Fixed:** the profit chart and the profit % were always empty or N/A, because the API never returned `profitHistory`, `profitLYD` or `profitUSD`. They now come from the database (12 months or 8 weeks).
- **Fixed:** `vite.config.ts` used Tailwind, but `tailwindcss` / `@tailwindcss/vite` were missing from `package.json`, so a fresh clone couldn't build.
- **New:** latest-subscriptions table, status breakdown, Team & roles page, brand fonts (Montserrat + Hanken Grotesk), and a phone layout.

## Project structure

```
db/schema.sql          tables + enums (run once)
db/seed.sql            12 months of demo data ending today (re-runnable)
worker/                Cloudflare Worker: API, Clerk verification, SQL
shared/                types, roles/permissions, money helpers (used by both sides)
src/                   React app (pages/, components/, lib/)
tests/                 unit tests (auth, money, permissions)
.github/workflows/     CI/CD
wrangler.jsonc         Cloudflare config (no secrets in it)
.env.example           every variable the app needs
```

## Set it up yourself (about 15 minutes)

### 1. Neon (database)
1. Create a free project at [neon.tech](https://neon.tech) and copy the **connection string** (Dashboard → Connect).
2. Open the **SQL Editor** and run `db/schema.sql`, then `db/seed.sql`.
   (Or put `DATABASE_URL` in `.env` and run `npm run db:setup`.)

### 2. Clerk (login)
1. Create a free application at [clerk.com](https://clerk.com) and choose the sign-in methods you want (email, Google, ...).
2. Copy the **Publishable key** (`pk_test_…`) and **Secret key** (`sk_test_…`) from *Configure → API keys*.

### 3. Run locally
```bash
npm install
cp .env.example .env        # fill in the values
cp .env .dev.vars           # Wrangler reads .dev.vars
npm run preview             # builds the app and serves everything on http://localhost:8787
```
To work on the UI with hot reload, run `npm run dev:api` in one terminal and `npm run dev` in another (http://localhost:5173).

### 4. Deploy to Cloudflare
```bash
npx wrangler login
npx wrangler secret put DATABASE_URL
npx wrangler secret put CLERK_SECRET_KEY
npx wrangler secret put CLERK_PUBLISHABLE_KEY
npx wrangler secret put ADMIN_EMAILS          # your email
npm run deploy                                # build + deploy
```
The deploy prints your URL (`https://agroup-dashboard.<you>.workers.dev`). Add that domain in **Clerk → Domains** if you use a production instance.

### 5. CI/CD (GitHub Actions)
In the GitHub repo, go to **Settings → Secrets and variables → Actions** and add:

| Name | Type | Value |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | secret | Cloudflare → My Profile → API Tokens → "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | secret | Cloudflare dashboard → Workers & Pages (right sidebar) |
| `VITE_CLERK_PUBLISHABLE_KEY` | secret | your `pk_test_…` key |
| `PRODUCTION_URL` | variable | your workers.dev URL (turns on the smoke test) |

- **Every pull request:** typecheck → lint → unit tests → production build → worker bundle dry-run.
- **Every push to `main`:** the same checks, then `wrangler deploy`, then a smoke test (`/api/health` must be up, `/api/me` must return 401 for anonymous visitors).

### 6. Test in incognito
1. Open the live URL in a private window. You should land on **/sign-in**, and `/api/me` should return `401`.
2. Sign up. The first account (or one in `ADMIN_EMAILS`) is Super admin and sees everything.
3. Sign up a second account in another private window. It's **Support**: no money figures, no Export, no Team tab.
4. In the first window, open **Team & roles** and promote that account to **Finance**, then refresh the second window.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `npm run dev:api` | UI with hot reload / local worker on :8787 |
| `npm run preview` | Build, then run the full app locally like production |
| `npm run check` | Typecheck + lint + tests + build (same as CI) |
| `npm test` | Unit tests (token verification, money maths, permissions) |
| `npm run deploy` | Build and deploy to Cloudflare |
| `npm run db:setup` / `npm run db:seed` | Create tables + demo data / refresh demo data to end today |

## Security notes

- No keys in the code: everything comes from env variables (`.env.example` lists them). `.env` and `.dev.vars` are git-ignored.
- Every `/api` route except `/api/health` needs a valid Clerk session. Roles are checked on the server, not just hidden in the UI.
- All SQL uses parameters (`$1`, `$2`), never string concatenation.
- API responses are `Cache-Control: no-store`.
