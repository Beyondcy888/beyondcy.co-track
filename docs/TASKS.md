# Beyondcy build: task list

> **Resuming in a new session?** Read this file first.
> **Status (9 Nov 2026): splitting the monorepo into 3 repos** (spec `START-DEV-02/docs/10_SPLIT_INTO_3_REPOS.md`): see the first section below.
> **Status (4 Nov 2026): Update v2 is built and QA'd in mock mode** (spec `START-DEV-02/docs/09_UPDATE_V2.md`, which wins over 00–08). Remaining: the owner's items (real-login `/dev-check`, re-entering targets, Phase 14 deploy). v1 (Phases 0–14 further down) is done except deploy.
> Next change request? Add a new section here, keep ticking as you go.
> Tick boxes here as work lands. `[x]` done · `[ ]` to do · `[~]` in progress · `[!]` blocked (needs the owner).
> Spec v1: `START-DEV-01/` (01–08). SQL (already run by the owner, never re-run, never change the DB): `START-SUPABASE-01/` and `START-DEV-02/supabase/04_update_v2.sql` (+ optional `05_fix_display_names.sql`).
> Assets: `START-DEV-02/assets/`. Dashboard box style reference: `beyondcy-track/docs/references/ref-3-dashboard-boxes.jpg` (copied from `C:\Users\User\Downloads\dashboard-Reference.jpg`; dark boxes, soft gradient, light top-left edge, mono number, tilted illustration cut off bottom-right; the illustrations are ORIGINAL SVGs in `src/admin/illustrations.jsx`).

---

## Split into 3 repos (START-DEV-02/docs/10_SPLIT_INTO_3_REPOS.md) · started 9 Nov 2026

> `<OLD>` = `D:\BEHOMY\beyondcy.co` · `<WEB>` = `D:\BEHOMY\Beyondcy-Web` (plain folder, not a repo).
> **Where this list lives:** until S3 it is `<OLD>\TASKS.md`. From S3 on, the live copy is **`<WEB>\beyondcy.co-track\docs\TASKS.md`**, and the copy in `<OLD>` stops being updated.
> Rules (10): never force-push · never delete `<OLD>` (renamed to `beyondcy.co-OLD` at the end) · never commit `.env.local` or a secret · **no `CNAME` file in any repo yet** · OWNER ACTION = stop, tell the owner exactly what to do, wait.
> Targets: site `Beyondcy888/beyondcy.co` → https://beyondcy888.github.io/beyondcy.co/ · dash `Beyondcy888/beyondcy.co-dash` → https://beyondcy888.github.io/beyondcy.co-dash/ · track `Beyondcy888/beyondcy.co-track` → https://beyondcy888.github.io/beyondcy.co-track/

### S0 · Inspect and report (no changes)
- [x] Workflow + script: root `.github/workflows/deploy.yml` builds the tracker with `BASE_PATH=/beyondcy.co/track/`, then `scripts/build-pages.mjs` combines the 3 sites into `_site/` (site `/`, `/dash/`, `/track/`). Both runs (7 Nov, 9 Nov) failed at "Check the Supabase secrets are set", so **nothing was ever deployed**
- [x] Tracker: Vite `base` from `BASE_PATH` (rename to `VITE_BASE_PATH`); router `basename` from `BASE_URL`; reset link `origin + BASE_URL + 'reset-password'`; `index.html` icons are `/favicon.ico`-style, which Vite rewrites with the base (checked in `dist/`); logos in JSX use `BASE_URL`; manifest paths relative; `public/CNAME` exists (must go)
- [x] site + dash are plain static (one `index.html`, no `package.json`), icon paths already relative; both have a `CNAME` and tracked junk `.vite/deps/` (from running vite there)
- [x] No links between the three projects (only Google Fonts links)
- [x] `CNAME` files: `beyondcy-site/CNAME`, `beyondcy-dash/CNAME`, `beyondcy-track/public/CNAME` (never deployed: the build skipped them). The Pages custom-domain *setting* can't be read without a login → owner checks it (S7c)
- [x] Live? Every github.io link returns 404 (never deployed), so nobody uses the tracker online: no quiet time needed
- [x] `git status`: only `START-DEV-02/docs/10_SPLIT_INTO_3_REPOS.md` untracked; `main` = `origin/main` (447a635)
- [x] Found: `START-DEV-01/08_CONNECT_TO_SUPABASE.md` holds the real publishable key (the tracker's `docs/08` copy was redacted in v1) → redact it in the copy that moves to the tracker docs
- [x] Found: `deploy.ps1`'s content check matches its own pattern text, which also appears in `docs/deploy.ps1` and the 10 doc → the tracker's first commit is made by hand after a manual secret scan; `deploy.ps1` then pushes it (script kept exactly as given)
- [x] Report given to the owner + go-ahead (9 Nov: "Go ahead" with Phases 1–6, stop at Phase 7)

### S1 · Safety backup
- [x] Commit the 10 doc + this list in `<OLD>` (6ef62a0), push `main` (the old workflow will fail at the secrets check again: harmless)
- [x] `git pull` · tag `pre-split-backup` (= 6ef62a0) · tag pushed to GitHub
- [x] Bundle `D:\BEHOMY\beyondcy.co-backup-20261109.bundle` (469 KB, `git bundle verify`: complete history, OK)
- [x] Untracked files noted: `beyondcy-track/.env.local` (copied in S3); `_site/`, `beyondcy-track/dist/`, `node_modules/` are build output

### S2 · OWNER: two empty repos
- [x] `beyondcy.co-dash` and `beyondcy.co-track` exist, public, empty (checked via the GitHub API, 9 Nov)

### S3 · Split dash + track (history kept)
- [x] `git subtree split` → `split/track` (808daef), `split/dash` (7ee6b5b) in `<OLD>`
- [x] `<WEB>` created; cloned into `beyondcy.co-track` / `beyondcy.co-dash`; branch `main`; `origin` = GitHub repo (upstream still `origin/split/*` until the first `push -u`)
- [x] `git log --oneline` shows the earlier commits (track 4, dash 2)
- [x] `.env.local` copied (git-ignored); `START-DEV-01`, `START-DEV-02`, `START-SUPABASE-01`, `DEPLOY-PLAN.md`, `TASKS.md` copied into `beyondcy.co-track\docs\`; key redacted in `docs/START-DEV-01/08` (2 places)
- [x] `npm install` (57 packages; the lockfile lost one `"peer": true` line: npm version difference, kept)
- **From here on, THIS file (`<WEB>\beyondcy.co-track\docs\TASKS.md`) is the live list.**

### S4a · beyondcy.co-track stands alone
- [x] `vite.config.js`: `base: process.env.VITE_BASE_PATH || '/'`
- [x] Router: `<BrowserRouter basename={import.meta.env.BASE_URL}>` exactly as specced (React Router 7.18.5 handles the trailing slash; checked its `stripBasename`); the dev mock router + its `replaceState` use `BASE_URL` too. Reset link + logos already used `BASE_URL`; nothing hard-codes `/beyondcy.co-track/`
- [x] `public/CNAME` deleted (`git rm`)
- [x] `.gitignore`: `node_modules/`, `dist/`, `.env`, `.env.local`, `.env.*.local` (+ logs, .DS_Store, .vite/)
- [x] `.github/workflows/deploy.yml` "Deploy tracker": checkout v7, setup-node v7 (Node 24), secrets check, `npm ci`, `npm test`, build with `VITE_BASE_PATH: /beyondcy.co-track/`, 404 copy, secret scan (`service_role` or a key-shaped `sb_secret_…`; the bare word is inside supabase-js), upload-pages-artifact v5, deploy-pages v5 (all latest majors, checked 9 Nov)
- [x] `SITE_LINKS` constant: `src/siteLinks.js` (github.io links; nothing links between the sites yet)
- [x] README (live link, repos, deploy.ps1, base path, no CNAME yet) + docs updated: 00 (github.io table, 10 + 11 in the reading order), 01 (repo names + github.io links, no CNAME, base path, SITE_LINKS), 06 (repo names, github.io links, Supabase URLs for now, DNS → file 11), 07 (split recorded: owner decisions + build decisions), 08 (repo name, redirectTo, CNAME later), DEPLOY-PLAN (superseded note); `docs/10_SPLIT_INTO_3_REPOS.md` + `docs/11_CONNECT_DOMAIN.md` (from Downloads) added, byte-identical
- [x] `npm test` (54 pass), `npm run build` (base `/`), `npm run dev` (6 checks: login at `/`, styles, `/logo-beyondcy.png`, `/favicon.ico`, deep link, no errors)
- [x] Fixed on the way (pre-existing, from v2): `src/dev/DevCheck.jsx:73` had `'…item's…'` (syntax error) → dev scan failed and `/dev-check` couldn't load in `npm run dev`. Now double quotes; `/dev-check` loads. Production was never affected (dev-only file)
- [x] github.io build (`$env:VITE_BASE_PATH='/beyondcy.co-track/'; npm run build`): all 11 icon/asset URLs in `dist/index.html` start with `/beyondcy.co-track/` and exist; no `CNAME`, no secret in `dist/`
- [x] `npx vite preview --base /beyondcy.co-track/` (headless Chrome, 24 checks): login styled, logo + favicon + manifest + its icon load, deep link `t/lahap_makmoer/brand/lahap` boots and keeps the target for after login, `/reset-password` renders, reset `redirectTo` = `origin + /beyondcy.co-track/reset-password` (request intercepted, nothing sent to Supabase), no errors
- [x] GitHub-style server (unknown paths → `404.html` with status 404, `/beyondcy.co-track` → 301): same 24 + the slash-less URL (25/25). (vite preview doesn't redirect the slash-less URL; GitHub does)
- [x] Signed-in deep links on a mock-mode build of the same code with the github.io base, served GitHub-style (14/14): sidebar links all under the base, refresh on a brand page and on `/admin/targets` keeps the page (via `404.html`), logo → base root, unknown path → the app's own "Not found". Real-login check stays with the owner (S9)
- QA tools (outside the repo): session scratchpad `qa/` (gh-pages-server.mjs, cdp.mjs, qa-track.mjs)

### S4b · beyondcy.co-dash
- [x] `CNAME` + `.vite/` removed · `.nojekyll` (empty) · `.gitignore` · SITE LINKS comment block at the top of `<head>` · `noindex` kept · README (live link, deploy, no CNAME yet). Left uncommitted on purpose: `deploy.ps1` commits it in S6

### S4c · beyondcy.co (portfolio), fresh clone in `<WEB>`
- [x] Fresh clone in `<WEB>\beyondcy.co`; `git rm` the other projects/docs/scripts; `beyondcy-site/*` moved to the root; the moved `CNAME` and `.vite/` removed (`git rm -f`: they were staged renames)
- [x] Old combined workflow removed (no workflow: no build needed) · `.nojekyll` · `.gitignore` · SITE LINKS block + `og:url` → github.io address · README
- [x] Static QA at `/beyondcy.co/` and `/beyondcy.co-dash/` (GitHub-style server, 9 + 8 checks): page, styles, logo + 4 favicons load from the sub-path, no root-absolute path, portfolio indexable, dash `noindex, nofollow`, no errors
- [x] Commit 64ff9e0 "Split: this repo now holds only the portfolio" (not pushed). Tree: `.gitignore`, `.nojekyll`, `README.md`, `index.html`, `logo-beyondcy.png`, 4 favicons

### S5 · deploy.ps1
- [x] `<WEB>\deploy.ps1` = the appendix exactly (extracted from the 10 doc by script: 165 lines, ASCII only, parses with 0 errors); identical copy at `beyondcy.co-track\docs\deploy.ps1`
- [x] Execution policy: CurrentUser is already `RemoteSigned` (no owner action needed)
- [x] Sandbox test (scratchpad repo whose push URL is a dead local path, so nothing can reach GitHub): `.env.production` BLOCKED · pattern text BLOCKED (confirms the S0 finding) · `.env.example` allowed · wrong remote FAILED · branch `feature` FAILED · failed push retried on the next run · up to date → skipped

### S6 · First push
- [ ] `.\deploy.ps1 -Message "Split into three repositories"` → all three `pushed`

### S7 · OWNER: GitHub settings
- [ ] a) `beyondcy.co-track` secrets `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [ ] b) Pages: site + dash = Deploy from a branch `main` / `(root)`; track = GitHub Actions; re-run "Deploy tracker"
- [ ] c) Custom domain empty on all three

### S8 · OWNER: Supabase URL configuration
- [ ] Site URL `https://beyondcy888.github.io/beyondcy.co-track/`; Redirect URLs `…/beyondcy.co-track/**`, `https://track.beyondcy.co/**`, `http://localhost:5173/**`

### S9 · Verify (all must pass)
- [ ] Portfolio page with logo + favicon
- [ ] Dash page with `noindex`
- [ ] Tracker loads with styles, logo, favicon
- [ ] Tracker login works; refreshing a deep page doesn't 404 or lose styles (owner logs in)
- [ ] Password-reset email opens `…/beyondcy.co-track/reset-password` (owner)
- [ ] Links between the sites = github.io addresses
- [ ] A small change in one folder + `.\deploy.ps1` pushes only that repo; live in ~1–2 min
- [ ] `git log` in dash + track shows the earlier history
- [ ] No `.env.local` and no `CNAME` in any GitHub repo

### S10 · Finish
- [ ] Rename `<OLD>` → `D:\BEHOMY\beyondcy.co-OLD` (owner deletes it after a week; close VS Code on it first if Windows refuses)
- [ ] Memory + this list updated with the final state

---

## Update v2 (START-DEV-02)

### V0 · Read and plan
- [x] Read `09_UPDATE_V2.md`, `04_update_v2.sql`, `05_fix_display_names.sql`, the assets and the dashboard reference image
- [x] Read the existing tracker code (all of `beyondcy-track/src`)
- [x] Check the live DB signed-out: `content_targets`, `tracker_banners`, `content_items.pic_id` exist (42501); `monthly_targets` + `set_monthly_target` are gone (PGRST205/202). Sign-ups are now OFF (`disable_signup: true`)
- [x] Copy `09_UPDATE_V2.md` into `beyondcy-track/docs/`, the SQL 04/05 into `beyondcy-track/supabase/`, the dashboard reference into `docs/references/ref-3-dashboard-boxes.jpg`; assets copied into `beyondcy-track/public/` and both placeholder folders (old `favicon.svg` removed)
- Logo notes: `logo-beyondcy.png` 993×209 (26px tall ≈ 124px wide), `logo-mark.png` 1024×668 (ringed "b"); both need a dark background (white ring and "cy")

### V1 · Brand (§2)
- [x] Assets into `beyondcy-track/public/`, `beyondcy-site/`, `beyondcy-dash/`; favicon `<head>` links on all 3 sites (drop old `favicon.svg`)
- [x] Tokens: `--accent #9ECD59`, `--accent-ink #131218`, `--status-uploaded #9ECD59`, `--type-reels #FF8A3D`, `--type-feed #8F7CF7`; pace marker + today ring use `--text`; remove every violet accent use
- [x] Type icons everywhere: Reels = ▶ play + orange, Feed = 2×2 grid + violet (pills, table, calendar chips, ring, legends, dashboard headers, filters use ▶/▦ glyphs)
- [x] Bonus dots green with thin outer ring
- [x] Logo: sidebar (26px, dark only), logo mark when collapsed / top bar, full logo above the login form
- [x] Placeholder sites: logo image instead of the text wordmark; dot motif dim green + a few status-colour dots

### V2 · Full-width layout (§3)
- [x] Remove the main max-width; side padding 32 / 24 (<1100) / 16 (<720)
- [x] Table: `overflow-x: auto` wrapper, visible styled scrollbar, min column widths (Content 260, Brief/Caption/Notes 280, Reference/Uploaded 220, others 110–160)
- [x] Sticky Content column with edge shadow when scrolled; header row stays sticky
- [x] Calendar full width; No date panel 280px right, below the grid under 1100px

### V3 · Sidebar like Notion (§4)
- [x] Pinned / hidden / peek (left edge ≤12px held ~120ms → floating overlay; leaves ~300ms after cursor leaves; toggle in peek pins)
- [x] Toggle (panel icon) in sidebar header; while hidden, toggle + logo mark top-left of the page header
- [x] Ctrl+\ / Cmd+\ ; `localStorage` key `byc.sidebar` (try/catch); 200ms transform animation, none under reduced motion
- [x] ≤720px / touch: header button opens overlay drawer + backdrop, tap outside or Esc closes
- [x] a11y: `aria-expanded` + `aria-controls`; focus moves in when opened by keyboard; Esc closes peek / drawer

### V4 · Data layer for v2 (§1)
- [x] `api.js`: `monthly_targets` / `set_monthly_target` removed; `content_targets` (`listTargets`, `listAllTargets`, `listTargetsForMonths`, `saveTarget` upsert, `saveTargets`, `updateTargetNote`, `deleteTarget`), realtime on targets
- [x] Items: `pic_id` on insert (`createItem({ picId })`), `listItemsForMonth` (dashboard), delete message "creator, PIC or Admin"
- [x] Banners: `getBanner`, `uploadBannerFile`, `saveBanner`, `setBannerPosition`, `deleteBanner`, `removeBannerFile`, `bannerUrl` (signed 3600s), realtime `tracker_banners`
- [x] `TrackerProvider`: tracker mode (as before + targets + banner) and all-trackers mode (`<TrackerProvider month>` for the Admin dashboard); `membersOf(roleId)`, `updateTargetNote`
- [x] Error texts: DB messages pass through; storage size/type → banner messages; 23514 → "0 to 500"; history shows PIC changes by name ("Former member")
- [x] Mock mode (`src/dev/mock`) rewritten for v2: PIC rules, content_targets (upsert fires the INSERT trigger first, like Postgres), banners + storage (Behomy has a demo banner), "needs a PIC" item, uploads without a target, mix-note cases. Dev hooks: `__mock.api.remoteEdit`, `__mock.api.remoteBanner`
- Note (DB behaviour): upserting a target for someone who moved trackers fails ("Brand … is not in X's tracker") because the INSERT trigger runs first; so former members' rows are read-only on the Targets page (Clear = delete by id still works), and notes are edited with `update().eq('id')`

### V5 · Targets and progress rules (§7)
- [x] Pure functions in `lib/progress.js`: `groupStats` (target/uploaded per type, remaining, over, achievement 1 dp, mix note, status, pace), `mixNote`, `progressStatus`, `paceExpected/paceInfo`, `brandLanes`, `personLanes` (by PIC), `myBrandLanes`, `brandSplit`, `performance` (dashboard cells/pics/total/needPic), `needPicCount`. A 0 total counts as "no target".
- [x] Unit tests with the three mix examples from §7 and every status (28 tests in `progress.test.js`)

### V6 · PIC in the UI (§6)
- [x] Behomy My work filters `pic_id = me`; Behomy Master "Owner" → **PIC** column + PIC filter
- [x] Drawer: PIC (Admin dropdown of active members, staff read-only); "Needs a PIC" badge (table, drawer); Delete for creator / PIC / Admin
- [x] New content (Admin in Behomy): Brand **and** PIC; pre-select when exactly one person has a target for that brand this month
- [x] History: `pic_id` changes as names ("Former member" fallback)

### V7 · Progress module v2 (§8)
- [x] Headline: Martian Mono 700, `clamp(3.5rem, 6vw, 6rem)`, "/ target" dim, % bold ~40% size; over: "30 / 25 · 120%" with green %
- [x] Hand-made SVG double ring (~168px): outer Reels, inner Feed, faint track, centre total %, "+N" badge over 100%, dashed "no Reels target" when 0
- [x] Legend (▶ Reels a/b, ▦ Feed c/d, Planned, Not started) + mix note
- [x] GSAP ring draw ~700ms once; reduced motion = final
- [x] Lanes per page (Dika/Zaki, Excel Master, Excel brand, Behomy My work, Behomy Master + "By brand" line); each lane: name · dots vs lane target · uploaded/target · ▶ a/b ▦ c/d · pace · mix-note icon + small text
- [x] No target text; remove the "Set target" pencils; Admin lanes link to Targets

### V8 · Banner UI (§5)
- [x] No banner: hover top → "Add banner", also in the page "⋯" menu
- [x] With banner: edge to edge above greeting, height `min(width × 0.4, 40vh)`, min 160px, `object-position: 50% <y>%`; hover → Change / Reposition / Remove
- [x] Reposition drag + Save position / Cancel
- [x] Upload: type + 5 MB checks, scale to 1500px wide, WebP 0.85, `<role_id>/<uuid>.webp`, upsert row (`position_y: 50`), delete the old file
- [x] Signed URL (3600s) cached and refreshed before expiry; Remove with confirm; live for teammates

### V9 · Admin Dashboard (§9)
- [x] Sidebar "All trackers" → **Dashboard** (Admin landing); header greeting + month switcher + clock; no banner
- [x] 9.1 Four summary boxes (reference style, original SVG illustrations, real half-gauge from the %)
- [x] 9.2 All-brands calendar (filters Tracker / Brand / PIC / Type / Status, legend, chip → same drawer)
- [x] 9.3 Performance per PIC table (+ Total row, bar, mix note)
- [x] 9.4 Detail per PIC and brand (inline notes save on blur, "Set a target first", warning row for items needing a PIC, sort tracker → PIC → brand, Total row, sticky PIC + Brand)
- [x] 9.5 Trackers list at the bottom with new totals

### V10 · Admin Targets page (§10)
- [x] Sidebar order Dashboard · Targets · Trackers · People; route + month switcher
- [x] Rows: active staff × brands in their tracker, grouped tracker → person; empty rows dimmed; former members read-only "No longer in this tracker"
- [x] Reels / Feed / Total inputs with the total rule; save on blur (upsert) + Saved tick; Clear (confirm → delete); errors next to row
- [x] Subtotals per tracker + grand total with the split; "Copy from <previous month>" (empty rows only, Reels/Feed only, confirm)

### V11 · Docs
- [x] `docs/07_DECISIONS_AND_OPEN_ITEMS.md` updated per §12 (old target/ownership/accent decisions replaced, Claude's defaults listed, v2 build decisions recorded); 00_START_HERE lists 09; 02/03/04 carry a one-line "09 wins" note
- [x] READMEs (tracker, placeholders) mention the v2 changes

### V12 · QA
- [x] `npm test` green (54 tests), `npm run build` clean; `dist/` has no mock code, no dev-check, no `service_role`; favicons, logos and `site.webmanifest` are in `dist/`. App chunk 44 kB gzip (v1: 28 kB; v2 added the dashboard, targets, banner, ring)
- [x] Screenshots 1920 / 1440 / 1024 (rail) / 390 reviewed: every layout (Dika, Excel Master + brand, Behomy My work + Master), dashboard, targets, banner states, sidebar hidden/peek/drawer, drawer (Admin + staff PIC), calendar, login, placeholders. Fixed: duplicate no-target message; phone lane "pace" label overlap
- [x] Keyboard + reduced motion: Ctrl+\ toggles with focus moving in/out, Esc closes peek/drawer, type radios and banner reposition work by keyboard; reduced motion = no sidebar slide, no GSAP (rings/dots render final)
- [x] Every acceptance check in §11 walked through (mock mode; the live DB was checked signed-out only, see V0). 92 scripted checks pass: 82 in `qa.mjs` (sidebar/peek/shortcut/phone 25, PIC 15, Targets 12, banner 20, dashboard 10) + 10 in `qa2.mjs` (7+12=19, Add banner, sticky Content + shadow, styled scrollbar)
- QA tooling lives outside the repo (session scratchpad): a dependency-free Chrome DevTools driver. Fixed on the way: banner shrank to 900px wide at short windows (aspect-ratio + max-height on an auto width) → definite width; brand names removed from tracker calendar chips (hid the title; kept on the dashboard calendar as specced); dashboard box text/illustration sizing (container query), Performance table widths, Detail headers wrap, gauge kept whole.

### §11 acceptance results (4 Nov 2026, mock mode)
- [x] Logo in the sidebar (full / mark in the rail and top bar), login and both placeholders; favicons on all three sites
- [x] No violet accent left (only `--type-feed`); buttons, focus, links, toggles green; Reels ▶ orange / Feed ▦ violet everywhere, with icons (not colour alone)
- [x] No empty area beside the content at 1440 and 1920; the table scrolls sideways with a styled scrollbar; Content stays sticky with an edge shadow
- [x] Sidebar pin → hide → peek → pin from the peek; Ctrl/Cmd+\; persists after reload; phone drawer; reduced motion respected
- [x] Banner add, reposition, change, remove; a teammate's change shows live; >5 MB and GIF refused with the exact messages; Dika can't load Behomy's banner (row or file)
- [x] Admin in Excel's tracker → PIC = Excel (counts toward Excel); Admin in Behomy must choose a PIC (pre-selected when one person has the brand's target); staff can't change a PIC
- [x] Targets page: Arum × Behomy 7 Reels + 12 Feed → total 19; staff can't edit targets (RLS 42501, no link)
- [x] Mix example 10+10 with 14 Reels + 6 Feed → 100% + "Reels 14/10 (+4 over) · Feed 6/10 (4 short). Total target met with extra Reels." (unit test; same wording in the UI, e.g. Anne × Hoteru)
- [x] Dashboard order exactly boxes → calendar → per PIC → detail → trackers; calendar shows all brands; notes save; totals match the Targets page (134 = 134 = 134 = 134)
- [x] Behomy My work = items where I'm the PIC (incl. one Admin created); Master's PIC filter works (incl. "Needs a PIC")
- [x] Progress modules match the dashboard for the same person/brand/month (same functions; spot-checked Arum 11/30, Behomy 29/74, Excel 12/25, Dika 9/20, Zaki 6/15)
- [!] With real logins (owner): run `/dev-check` as Admin and as Dika (v2 checks added: PIC = Dika on insert, targets refused for staff, Behomy banner row/files invisible to Dika)

---

## v1 build (done; kept for reference)

## Folder layout (this workspace)

| Folder | Becomes GitHub repo | Domain |
|---|---|---|
| `beyondcy-site/` | `beyondcy-site` | `beyondcy.co` (+ `www`) |
| `beyondcy-dash/` | `beyondcy-dash` | `dash.beyondcy.co` |
| `beyondcy-track/` | `beyondcy-track` | `track.beyondcy.co` |

Each folder is self-contained, so it can be pushed as its own repo (GitHub Pages serves one custom domain per repo).

## Useful commands (run inside `beyondcy-track/`)

- `npm run dev`: real app at http://localhost:5173 (uses `.env.local`)
- `npm run mock`: **dev-only** preview with fake data at http://localhost:5174 (`?as=admin|excel|dika|zaki|arum`). No Supabase needed. Never part of the production build.
- `npm test`: unit tests (progress, time, fields, errors, history, links)
- `npm run build`: production build into `dist/`
- `/dev-check` (only in `npm run dev`): the connection test from `08` §5. Sign in first.

---

## Phase 0 · Setup and verification
- [x] Read all docs (00–08), the 3 SQL files and both reference images
- [x] Supabase URL + publishable key work (auth settings respond 200)
- [x] Signed-out check: every table refuses the anon key (`42501 permission denied`)
- [x] Sign-ups: were enabled on 3 Nov; **off** since 4 Nov (`disable_signup: true`, checked during v2)
- [x] Package versions checked (React 19, Vite 8, react-router-dom 7, supabase-js 2, TanStack Table **v8** as the spec asks, date-fns 4 + @date-fns/tz, GSAP 3)

## Phase 1 · Placeholder sites
- [x] `beyondcy-site/index.html` (Stay tuned, indexable) + `CNAME` = `beyondcy.co`
- [x] `beyondcy-dash/index.html` (Stay tuned, `noindex`) + `CNAME` = `dash.beyondcy.co`

## Phase 2 · Tracker scaffold (`beyondcy-track/`)
- [x] `package.json`, `vite.config.js`, `index.html` (noindex, fonts, favicon)
- [x] `.env.local` (git-ignored, real values), `.env.example` (placeholders), `.gitignore`
- [x] `public/CNAME` = `track.beyondcy.co`
- [x] `.github/workflows/deploy.yml` (checkout v7, setup-node v7, upload-pages-artifact v5, deploy-pages v5; copies 404.html)
- [x] `docs/` (copy of START-DEV-01, with the key redacted from 08) and `supabase/` (SQL copies)
- [x] `styles/tokens.css`, `styles/base.css`

## Phase 3 · Core libraries (pure functions + tests)
- [x] `lib/supabase.js`: one client from env vars, PKCE
- [x] `lib/time.js`: WIB now/today/month, greeting, clock, relative time, calendar weeks
- [x] `lib/progress.js`: lane stats, dot plan, pace sentence, team/brand totals
- [x] `lib/fields.js`: labels, required fields, "Fill in X and Y first"
- [x] `lib/errors.js`: DB errors → user text (labels in "Missing:", RLS → "You don't have access…")
- [x] `lib/links.js`: reference lines → safe http(s) links only
- [x] `lib/history.js`: activity_log → sentences ("Dika added the Instagram link · status → Uploaded")
- [x] Unit tests pass (`npm test`): 51 tests

## Phase 4 · Auth
- [x] AuthProvider (getSession + onAuthStateChange, profile load, sign out clears data and channels)
- [x] Login page (split dot-grid design, underline inputs, pill button, no sign-up, specific errors)
- [x] Forgot password (in-page) + `/reset-password`
- [x] No-access screens: no role / inactive / not your tracker
- [x] Route guards (signed out → `/login`)

## Phase 5 · Data layer
- [x] `data/api.js`: every query from `04` behind one interface (real Supabase)
- [x] App-wide data: roles, brands, role_brands, pillars, visible profiles
- [x] TrackerProvider: items (+comment counts), targets, people; create/update/delete; realtime (items, comments, targets; unfiltered DELETE events); refetch on tab focus

## Phase 6 · Shell
- [x] Sidebar: wordmark, pages per layout, admin tracker switcher + People, footer (name, role, Sign out)
- [x] Responsive: icon rail ≤1100px, top bar + menu ≤720px
- [x] Header: page title, shared month switcher, Today, live WIB clock (ticks every second)
- [x] Greeting (WIB: morning 04–10:59, afternoon 11–17:59, evening 18–03:59)

## Phase 7 · The track (progress module)
- [x] Single lane: big numerals, dots (filled/ring/dim + violet bonus), pace tick, sentence, legend
- [x] Multi-lane (Excel master, Behomy master) with shared scale + totals
- [x] Behomy My work: own lane + "Team: 22 / 27"
- [x] Behomy Master extras: team planned/not started, per-brand proportional split
- [x] No-target state; Admin "Set target" per lane (empty = remove)
- [x] GSAP stagger on load (~600ms) + pulse on new upload; reduced motion = no animation
- [x] `role="img"` + aria-label

## Phase 8 · Content table
- [x] Columns per layout (Brand on masters + Behomy pages, Owner on Behomy Master, Pillar on Homy8)
- [x] Filters: search, Status, Type, Brand, Owner; month scope + "Show all months"
- [x] Sort: publish date asc, no-date last; header sorting
- [x] Inline edit: Type + Publish date only
- [x] New content (brand picker on masters) → opens drawer
- [x] Empty state, truncation, sticky header, 48px rows, horizontal scroll on small screens

## Phase 9 · Item drawer
- [x] Details: all fields, save on blur (text) / immediately (selects, date, chips), saved state
- [x] Missing-fields checklist; Instagram link lock + hint; field-level DB errors
- [x] Footer: "Created by X on date" + Delete content (owner/Admin, confirm, toast)
- [x] Comments: thread, post, delete own (Admin any), count on row
- [x] History: sentences, expandable old → new
- [x] Live updates: refresh untouched fields; "X just changed Caption. Load their version?"

## Phase 10 · Calendar
- [x] Month grid (Mon start), today ring, chips (status dot + type + name), max 3 + "+N more" popover
- [x] No date (N) list beside (below on mobile)
- [x] Chip → drawer; empty day → New content with date
- [x] Mobile: compact day cells, tap a day for its list

## Phase 11 · Admin
- [x] Choose a tracker (rows: name, people, mini progress line for current month)
- [x] People page: display name (edit), email (read-only), role (dropdown), active (toggle); warn on own role/active

## Phase 12 · Dev tools (never in production)
- [x] `/dev-check` connection test page (dev server only)
- [x] Mock mode (`npm run mock`) with fixture data for visual QA

## Phase 13 · QA
- [x] `npm test` green (51 tests)
- [x] `npm run build` clean; `dist/` contains no `service_role`, no mock code, no dev-check (vendor chunks split: app code 28 kB gzip)
- [x] Screenshots at 1440 / 1024 / 390 reviewed (login, choose tracker, each layout, drawer, calendar, People). Fixed: calendar chip overflow, numeral spacing, rail nav, select chevron on hover, legend wrap, phone column width
- [x] Keyboard pass (visible focus everywhere, Esc returns focus, arrow keys on tabs), reduced motion pass (GSAP off), motion on (stagger + pulse)
- [x] Brief check (`03` §7): no grid of identical cards; violet only where meaningful; status readable without colour (filled / ring / small dot + labels); mono only for numbers
- [x] Interaction QA on mock data: 42 + 11 + 13 scripted checks pass (status flow, Instagram lock, DB errors, comments, history, live conflict, targets, access lock, filters, calendar)
- [x] Real app against the live Supabase: signed-out redirect, "Email or password is incorrect.", expired reset link, `/dev-check` signed-out check PASS

## Phase 14 · Deploy (outward-facing: needs the owner's go-ahead)
> **5 Nov 2026: the owner pushed everything as ONE repo** (`github.com/Beyondcy888/beyondcy.co`), not 3. Pages runs as one site:
> `https://beyondcy888.github.io/beyondcy.co/` (site) · `/dash/` · `/track/` (tracker). Workflow: root `.github/workflows/deploy.yml`
> (the old one in `beyondcy-track/.github/` never ran: GitHub only reads the root `.github/`). `scripts/build-pages.mjs` puts the 3 sites into `_site/`.
> Tracker: `BASE_PATH` env → Vite `base`, router `basename`, reset-password link. Root `404.html` = tracker shell + guard (deep links).
- [x] Root workflow + assemble script; paths work under `/beyondcy.co/` (QA'd in headless Chrome, 54 tests pass)
- [!] Owner: add repo secrets `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (workflow stops with a clear error without them)
- [!] Owner: commit + push, then check the Actions tab
- [!] Owner: Supabase Auth redirect URLs add `https://beyondcy888.github.io/beyondcy.co/track/**`
- [ ] Later, custom domains: subdomains (track./dash.) need separate repos, or move to `beyondcy.co/track/` with `PAGES_ROOT=/`
- [!] DNS records at the domain provider (owner, `06` §C) + verify the domain in GitHub
- [ ] Run the acceptance checks in `06` §D with real logins (owner provides them)

---

## Owner action items (cannot be done by the agent)
1. ~~Turn off public sign-ups~~ done (checked 4 Nov).
2. Supabase Auth → URL Configuration: Site URL `https://track.beyondcy.co`; Redirect URLs `https://track.beyondcy.co/**` and `http://localhost:5173/**`.
3. Provide test logins (never stored in the repo) or run `/dev-check` yourself.
4. GitHub: account/org to own the 3 repos; add the two Actions secrets.
5. DNS records (`06` §C) and domain verification in GitHub.
6. Before go-live: Supabase Pro plan + custom SMTP.
7. ~~Logo + brand colour~~ delivered in v2 (green `#9ECD59`). An SVG logo would still be sharper on high-density screens, if one exists.
8. **v2:** re-enter this month's targets on the Targets page (v1 targets were deleted by `04_update_v2.sql`); "Copy from <last month>" helps from the second month on.
9. **v2:** Behomy items Admin created before v2 show "Needs a PIC": open each (Dashboard calendar → PIC filter "Needs a PIC") and choose one.
10. **v2:** review Claude's defaults in `docs/07` (one shared banner per tracker, ring next to the dots, display names, Reels orange / Feed violet).

## Decisions made during the build
All recorded in `beyondcy-track/docs/07_DECISIONS_AND_OPEN_ITEMS.md` → "Build decisions". The main ones:
- Admin in the Behomy tracker sees Master only (Admin has no lane of their own).
- Team totals count every uploaded item (Admin's too); team target = sum of the people's targets.
- TanStack Table pinned to v8 as specced; CI on Node 24 with the latest GitHub Action majors.
- Esc saves the field being typed in, unless a teammate changed it and no choice was made (then nothing is overwritten, and a toast explains).

## How to deploy (Phase 14), step by step
Needs: a GitHub account or organisation (below: `<org>`), and either the GitHub website or the `gh` CLI signed in.

```bash
# from D:/BEHOMY/beyondcy.co: make each folder its own repo
cd beyondcy-site  && git init -b main && git add -A && git commit -m "Stay tuned page" && cd ..
cd beyondcy-dash  && git init -b main && git add -A && git commit -m "Stay tuned page" && cd ..
cd beyondcy-track && git init -b main && git add -A && git commit -m "Tracker first release" && cd ..

# with gh (or create 3 empty public repos on github.com and git push to them)
gh repo create <org>/beyondcy-site  --public --source beyondcy-site  --push
gh repo create <org>/beyondcy-dash  --public --source beyondcy-dash  --push
gh repo create <org>/beyondcy-track --public --source beyondcy-track --push
gh secret set VITE_SUPABASE_URL      -R <org>/beyondcy-track   # paste the project URL
gh secret set VITE_SUPABASE_ANON_KEY -R <org>/beyondcy-track   # paste the publishable key
```

Then on github.com, in each repo → Settings → Pages:
- `beyondcy-track`: Source **GitHub Actions** (re-run the workflow once the secrets exist), custom domain `track.beyondcy.co`.
- `beyondcy-site`: Source **Deploy from a branch** → `main` / root, custom domain `beyondcy.co`.
- `beyondcy-dash`: the same, custom domain `dash.beyondcy.co`.
- Tick **Enforce HTTPS** once each certificate is issued. DNS records: `06` §C.

Note: `D:/BEHOMY/beyondcy.co` itself is also a git repo (no commits yet). If you keep it, make the three folders separate repos as above and don't commit them into the outer one too (or delete the outer `.git`).
