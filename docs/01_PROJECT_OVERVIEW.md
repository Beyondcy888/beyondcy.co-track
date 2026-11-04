# 01 · Project overview

## Repositories and hosting

Hosting is **GitHub Pages**, chosen by the owner. GitHub Pages serves **one custom domain per repository**, so there are **three repos**:

| Repo (suggested name) | Domain | Contents |
|---|---|---|
| `beyondcy-site` | `beyondcy.co` (+ `www.beyondcy.co` redirect) | Static "Stay tuned" page |
| `beyondcy-dash` | `dash.beyondcy.co` | Static "Stay tuned" page |
| `beyondcy-track` | `track.beyondcy.co` | The tracker app (React + Vite + Supabase) |

Notes:
- On the free GitHub plan, Pages requires **public** repos. That is acceptable **only because nothing secret is ever committed**. The anon/publishable key is public by design; RLS protects the data.
- The tracker is a single-page app. GitHub Pages has no server rewrites, so the build must **copy `dist/index.html` to `dist/404.html`**. Deep links and refreshes then load the app, and React Router (`BrowserRouter`) takes over. Do not use hash routing; it clashes with Supabase auth redirects.
- Each repo needs a `CNAME` file containing its domain, which goes into the built output (`public/CNAME` in Vite).
- Deploy the tracker with a **GitHub Actions** workflow (build on push to `main`, publish `dist/`). The two placeholder repos can be served straight from the branch with no build.

## Stack

- **Tracker:** React + Vite, **JavaScript (JSX)**, plain CSS with CSS custom properties (no Tailwind), GSAP for the few motion moments, `@supabase/supabase-js` v2, `react-router-dom`, `@tanstack/react-table` v8 for the table, and `date-fns` with time-zone support (`@date-fns/tz` or `date-fns-tz`) for WIB dates. Use the current stable versions.
- **Backend:** Supabase (Postgres, Auth, Realtime). No Edge Functions are needed in this release.
- **Placeholders:** one `index.html` each with inline CSS and no framework.

The owner's original stack note: "React, Vite, HTML, CSS, JS, GSAP, Supabase; code written in Antigravity, stored in GitHub, deployed on GitHub Pages."

## Environment variables (tracker)

`.env.example` (commit this file):
```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-OR-PUBLISHABLE-KEY
```
- Local development: `.env.local` (git-ignored).
- Production: store both as **GitHub Actions repository secrets** and pass them into `vite build`.
- Never add any other Supabase key.

## Suggested tracker structure

```
beyondcy-track/
  public/CNAME                      track.beyondcy.co
  src/
    lib/supabase.js                 client from env vars
    lib/time.js                     WIB helpers: now, today, month range, greeting
    lib/progress.js                 target/progress/pace calculations (pure functions + tests)
    auth/                           session provider, login, forgot/reset password
    data/                           hooks: useProfile, useTracker, useItems, useTargets, useRealtime
    layout/                         Shell (sidebar + header), TrackerPicker (admin)
    track/                          TrackModule (signature progress), Lane, Dots
    table/                          ContentTable, columns per layout, filters
    drawer/                         ItemDrawer, FieldEditors, Comments, History
    calendar/                       MonthCalendar, DayCell, NoDateList
    admin/                          People page, TargetEditor
    styles/                         tokens.css, base.css, components
  docs/                             this documentation pack
  supabase/                         the SQL files (reference only; run by the owner)
```

## Security rules (non-negotiable)

1. RLS is the lock. The frontend may hide what a user can't use, but it must still work correctly when the database refuses something. Show the database's error message.
2. No `service_role` key, database password or any other secret in code, repo, `.env.example` or build logs.
3. **No public sign-up.** Accounts are created by the owner in the Supabase dashboard. The login page has **no** "create account" link.
4. A signed-in user with **no role**, or whose account is **inactive**, sees a clear message ("Your account doesn't have a tracker yet. Ask Admin Beyondcy.") and nothing else.
5. `dash.beyondcy.co` and `track.beyondcy.co` include `<meta name="robots" content="noindex, nofollow">`.

## What is explicitly NOT in this release

- The marketing dashboard (Meta API data). Its research and decisions are recorded in `07` for later.
- The portfolio site content and its GSAP design.
- Notion import (the owner migrates data manually through the UI).
- Notifications, board/kanban view, production cost fields.
