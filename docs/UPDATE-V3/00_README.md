# Beyondcy update v3: start here

This folder holds the next update for the Beyondcy web suite. Read the files in this order:

| File | What it covers |
|---|---|
| `00_README.md` | This file: order of work, rules, defaults |
| `01_GITHUB_PAGES_FIX.md` | The github.io links show "404 · There isn't a GitHub Pages site here". Fix publishing for all three repos. |
| `02_PORTFOLIO_MIGRATION.md` | Move the team's portfolio (`beyondcy-website`) into the `beyondcy.co` repo and make it run |
| `03_PROFILE_PHOTOS.md` | Profile photos for everyone (upload, adjust, remove; first-letter fallback) |
| `04_ADMIN_DASHBOARD.md` | Bigger numbers and illustrations in the 4 boxes, 9 brand cards with logos, draggable all-brands calendar |
| `05_TRACKER_BRAND_PAGES.md` | Every tracker page: the 4 boxes, the "this week" reminder, a draggable calendar, a status board |
| `06_PROJECTS.md` | New Admin "Projects" page: assign one-off projects to staff, shown in calendars and popups |
| `07_DATABASE_V3.md` | What the v3 SQL added and how the app uses it |
| `supabase/06_update_v3.sql` | The database change, run by the owner in Supabase |
| `references/` | The owner's screenshots and design references, named as mentioned in these files |

Earlier docs (00–11, 09_UPDATE_V2, 10_SPLIT…) still apply. **Where this update disagrees with them, this update wins.**

## The project layout

```
Beyondcy-Web\
├── beyondcy.co\          -> github.com/Beyondcy888/beyondcy.co        (portfolio)
├── beyondcy.co-dash\     -> github.com/Beyondcy888/beyondcy.co-dash   (dashboard, "Stay tuned")
├── beyondcy.co-track\    -> github.com/Beyondcy888/beyondcy.co-track  (tracker)
├── deploy.ps1
├── beyondcy-website\     <- the portfolio from the team; TEMPORARY, moved in by file 02
└── tracker-brand-logo\   <- brand logo folders; TEMPORARY, moved in by file 04
```

When this update is finished, **nothing is left outside the three repo folders except `deploy.ps1`.** `beyondcy-website` becomes the `beyondcy.co` repo's content, and `tracker-brand-logo` moves into `beyondcy.co-track\design-assets\`.

## Order of work

1. **Database.** The owner runs `supabase/06_update_v3.sql` (file 07 explains it). Confirm the final check lists `avatar_path`, `people`, `projects`, `project_assignees` and `bucket: avatars` before you start on the tracker work.
2. **File 01:** find out why the github.io links are 404, and fix dash and track.
3. **File 02:** migrate the portfolio, then set up its publishing.
4. **File 03:** profile photos. Do this before 04–06, because later features show photos.
5. **File 04:** Admin Dashboard changes.
6. **File 05:** tracker page changes.
7. **File 06:** Projects.
8. **Test everything on localhost** (Admin plus at least one staff account per layout: Dika, Excel and Arum). Show the owner, and only then run `.\deploy.ps1`.
9. Update `docs\07_DECISIONS_AND_OPEN_ITEMS.md` in the tracker repo with everything decided here.

## Rules (unchanged from earlier updates)

- **Steps marked OWNER ACTION need the owner** (github.com, Supabase). Stop, explain exactly what to do, and wait.
- **The domain is not connected yet.** Everything runs on github.io links: **no `CNAME` files**, and base paths come from `VITE_BASE_PATH` (see `10_SPLIT_INTO_3_REPOS.md` §4), so connecting the domain later (file 11) stays a small switch.
- **Never commit secrets** (`.env*` except `.env.example`, Supabase secret keys). `deploy.ps1` blocks them.
- **Never delete the owner's folders without an explicit OK**, and only after the result has been checked.
- Database rules are enforced by Supabase (row level security). The UI may hide actions, but must also show the database's error message if something is refused.
- Jakarta time (WIB) for "today", "this week" and the month.
- Keep the existing design language: dark surfaces, Beyondcy green `#9ECD59` accent, Reels = orange ▶, Feed = violet grid, status grey/blue/green, Instrument Sans + Martian Mono for numbers.

## Decisions by the owner for this update

- **This-week reminder:** Monday–Sunday of the current week. It shows only **Not started** and **Planned** items (never Uploaded). If this week had content but everything is uploaded, it says so warmly. It includes **projects** due this week for the people involved.
- **Calendar drag:** staff in their tracker, and Admin everywhere including the Dashboard. **Uploaded items are locked.** You can drag into and out of "No date". The toast shows the new date with **Undo**. **Only Admin drags projects.**
- **Status board:** display only. Clicking a card opens the item. Each column shows a **big total count** (Reels and Feed both count as content) with the **Reels / Feed split** below it.
- **Brand page boxes:** the same scope as the page's progress module. Keep both the boxes and the big progress module.
- **Projects:** visible to the **assigned staff and Admin only**. Shown on the deadline in their calendars. **Admin and assigned staff can mark one done.** Any active staff member can be assigned. The description is plain text with clickable links.
- **Profile photos:** people change their own; Admin can change or remove anyone's. Round crop with zoom. Everyone signed in sees everyone's **name and photo** (never emails).
- **Brand cards:** count for the **month selected** on the Dashboard. Clicking a card opens that brand's tracker. 9 equal cards in one row, scrolling sideways on narrow screens. **The agent picks the logos** (criteria in file 04).
- **Portfolio:** the agent inspects and adapts it. The **login page stays in the code but is not linked or used yet**. The portfolio replaces the "Stay tuned" page. `beyondcy-website` is a plain folder (not a git repo).

## Default chosen by Claude (owner may change)

- The reminder also shows **overdue** items (earlier dates, still Not started or Planned) in a small group at the top, so nothing slips. Remove this if the owner prefers only this week.
