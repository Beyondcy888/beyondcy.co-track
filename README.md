# beyondcy.co-track

The Beyondcy content tracker: React + Vite + Supabase, deployed to GitHub Pages.

- **Live:** https://beyondcy888.github.io/beyondcy.co-track/ (later **https://track.beyondcy.co**, see [`docs/11_CONNECT_DOMAIN.md`](docs/11_CONNECT_DOMAIN.md))
- **Repo:** `github.com/Beyondcy888/beyondcy.co-track`. The portfolio (`Beyondcy888/beyondcy.co`) and the dashboard (`Beyondcy888/beyondcy.co-dash`) have their own repos; [`src/siteLinks.js`](src/siteLinks.js) holds the three addresses.

The full spec is in [`docs/`](docs/) (start with `docs/00_START_HERE.md`; **update v2** is `docs/09_UPDATE_V2.md`, which wins over 01–08; the split into three repos is `docs/10_SPLIT_INTO_3_REPOS.md`). The build's task list is [`docs/TASKS.md`](docs/TASKS.md). The database SQL is in [`supabase/`](supabase/) (reference only; the owner runs it, including `04_update_v2.sql`).

**v3 at a glance (`docs/UPDATE-V3/`, wins over everything before it):** profile photos for everyone (upload, round crop, remove; the first letter until then), **Projects** (Admin assigns one-off jobs to staff; they appear on the deadline in calendars and open in a centred popup), the four summary boxes on every tracker page, a **this-week reminder** beside the progress module, **dragging** content to another day in every calendar (Uploaded is locked; Undo in the toast), a **status board** under the calendar, and nine **brand cards** with logos on Admin's Dashboard. Database: `supabase/06_update_v3.sql`.

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
  track/        the progress module: big number, Reels/Feed ring (TypeRing), legend + mix note, dots, lanes;
                the four summary boxes (SummaryBoxes, shared with the Dashboard) and the this-week reminder
  banner/       the tracker banner: upload (WebP, ≤1500px), reposition, signed URLs, "⋯" page menu
  table/        content table (TanStack Table v8): filters, sorting, inline Type + Publish date
  drawer/       item drawer: details (save on blur, live conflicts), comments, history
  calendar/     month grid (Monday first, WIB today), chips, +N more, No date list; drag a chip to
                another day (@dnd-kit/core; useCalendarMoves = the save, toast and Undo); project chips
  board/        the status board: Not started / Planned / Uploaded (display only)
  people/       profile photos: Avatar (photo or first letter), the photo menu + round crop, PersonSelect
  projects/     Projects: provider (data + realtime), Admin page, the form, the centred popup
  config/       brandStyle.js: each brand's logo and colour for the Dashboard's brand cards
  admin/        Dashboard (boxes, brand cards, all-brands calendar, per-PIC + detail tables, trackers),
                Targets page, People
  pages/        tracker routes and per-layout page config
  ui/           toasts (with an action, e.g. Undo), confirm dialog, modal, popover, date input, icons
  dev/          DEV ONLY: /dev-check and the mock (not in production builds)
  styles/       tokens.css (design tokens) + one stylesheet per area
public/brand-logos/   the nine brand logos used on the Dashboard (WebP)
design-assets/        source files that are NOT published (the owner's logo folders)
```

## Deploy (GitHub Pages)

**Push:** from the parent folder `Beyondcy-Web`, run `.\deploy.ps1 track` (or `.\deploy.ps1` for every project with changes). It commits, refuses secret files and keys, pushes to this repo, and prints the live link. A copy of the script is in [`docs/deploy.ps1`](docs/deploy.ps1).

On every push to `main`, `.github/workflows/deploy.yml` ("Deploy tracker") checks the Supabase secrets exist, runs the tests, builds with `VITE_BASE_PATH=/beyondcy.co-track/`, copies `index.html` to `404.html` (so deep links and refreshes work), checks the build has no secret key, and publishes `dist/`. It's live in about 1–2 minutes.

One-time setup (owner):
1. Repo → Settings → Secrets and variables → Actions → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Settings → Pages → Source: **GitHub Actions**. Custom domain: **leave empty** for now.
3. Supabase → Authentication → URL Configuration: Site URL `https://beyondcy888.github.io/beyondcy.co-track/`; Redirect URLs `https://beyondcy888.github.io/beyondcy.co-track/**`, `https://track.beyondcy.co/**` and `http://localhost:5173/**`.

**The base path is one value.** `VITE_BASE_PATH` (set only in the workflow) → Vite `base` → `import.meta.env.BASE_URL`, which the router `basename`, the logos and the password-reset link use. Locally it is `/`. Never type `/beyondcy.co-track/` in the code. To try the github.io version locally:

```powershell
$env:VITE_BASE_PATH='/beyondcy.co-track/'; npm run build; npx vite preview --base /beyondcy.co-track/
```

**No `public/CNAME` yet:** it would make GitHub redirect the github.io link to a domain that isn't connected. When the domain is connected (`docs/11_CONNECT_DOMAIN.md`): delete the `VITE_BASE_PATH` line in the workflow, add `public/CNAME` with `track.beyondcy.co`, update `src/siteLinks.js`, then set the custom domain and **Enforce HTTPS** in Settings → Pages.
