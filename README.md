# beyondcy-track

The Beyondcy content tracker at **track.beyondcy.co**: React + Vite + Supabase, deployed to GitHub Pages.
The full spec is in [`docs/`](docs/) (start with `docs/00_START_HERE.md`; **update v2** is `docs/09_UPDATE_V2.md`, which wins over 01–08). The database SQL is in [`supabase/`](supabase/) (reference only; the owner runs it, including `04_update_v2.sql`).

**v2 at a glance:** Beyondcy logo + green accent, full-width pages, a Notion-like sidebar (pin / hide / peek at the left edge, Ctrl/Cmd+\), a banner per tracker, targets per person × brand split into Reels + Feed (Admin's Targets page), a PIC on every item, the ring chart next to the dots, and Admin's Dashboard.

## Run it

```bash
npm install
cp .env.example .env.local     # then fill in the project URL and the publishable key
npm run dev                    # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | The real app on http://localhost:5173 (must be 5173: it's in Supabase's redirect URLs) |
| `npm run mock` | **Dev only.** The real UI on fake data at http://localhost:5174, no Supabase needed. Pick a person with `?as=admin`, `excel`, `dika`, `zaki`, `arum`, `ilyas`, `anne`, `rina` (no role), `bagas` (inactive) or `out` (signed out). `?bar=0` hides the persona bar. |
| `npm test` | Unit tests for the pure logic in `src/lib` (targets, mix rule, statuses, pace, WIB time, wording, links, history) |
| `npm run build` | Production build into `dist/` |

`/dev-check` (only on `npm run dev`) runs the connection test from `docs/08` §5. Sign in as Admin Beyondcy and as Dika, then run it. Neither `/dev-check` nor the mock exists in production builds.

## Security model

- **Row Level Security is the lock.** The app hides what a person can't use, but the database refuses it anyway, and the app shows the database's message.
- The only Supabase values the app uses are the **project URL** and the **publishable (anon) key**. Never add the `service_role` / secret key or the database password anywhere.
- The app never writes `status`, `missing_fields`, `uploaded_at`, `owner_id`, `updated_*` or `created_at`: database triggers own them.
- No public sign-up: accounts are created in the Supabase dashboard ("Allow new users to sign up" is off; keep it off).
- Targets are written by Admin only (RLS); staff can read their tracker's targets. The PIC rules are enforced by a trigger (staff → themselves; only Admin changes it).
- Banners live in the **private** bucket `tracker-banners` at `<role_id>/<file>` (5 MB max, JPG/PNG/WebP). The app shows them through 1-hour signed URLs; storage policies keep each tracker's folder to its members and Admin.

## Code map

```
src/
  lib/          pure logic: supabase client, WIB time, progress/pace, fields, errors, links, history (+ tests)
  auth/         session provider, login, reset password, route guards, blocked screens
  data/         API (every query in one place), app data, tracker provider (realtime), month, timers
  layout/       shell, sidebar (pinned / hidden / peek, rail ≤1100px, drawer ≤720px; state in sidebarState.js), page header
  track/        the progress module: big number, Reels/Feed ring (TypeRing), legend + mix note, dots, lanes
  banner/       the tracker banner: upload (WebP, ≤1500px), reposition, signed URLs, "⋯" page menu
  table/        content table (TanStack Table v8): filters, sorting, inline Type + Publish date
  drawer/       item drawer: details (save on blur, live conflicts), comments, history
  calendar/     month grid (Monday first, WIB today), chips, +N more, No date list
  admin/        Dashboard (boxes, all-brands calendar, per-PIC + detail tables, trackers), Targets page, People
  pages/        tracker routes and per-layout page config
  ui/           toasts, confirm dialog, popover, date input, icons
  dev/          DEV ONLY: /dev-check and the mock (not in production builds)
  styles/       tokens.css (design tokens) + one stylesheet per area
```

## Deploy (GitHub Pages)

1. Repo → Settings → Secrets and variables → Actions → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Settings → Pages → Source: **GitHub Actions**.
3. Push to `main`. `.github/workflows/deploy.yml` tests, builds, copies `index.html` to `404.html` (so deep links work), checks the build has no `service_role`, and publishes.
4. Settings → Pages → custom domain `track.beyondcy.co` (also in `public/CNAME`) → tick **Enforce HTTPS** once the certificate is issued.
