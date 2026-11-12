# Beyondcy web build: start here

You are building the first release of three websites for **Beyondcy** (Beyondcy Kreatif Global), an Indonesian creative and digital marketing agency.

| Site | Purpose | This release |
|---|---|---|
| `beyondcy.co` | Agency portfolio (public) | **"Stay tuned" placeholder only** |
| `dash.beyondcy.co` | Marketing dashboard for brand stakeholders (private) | **"Stay tuned" placeholder only** |
| `track.beyondcy.co` | Internal content tracker for the Beyondcy team | **Full build: the priority** |

**Since 9 Nov 2026 (`10_SPLIT_INTO_3_REPOS.md`)** each site has its own repo, and until the domain is connected (`11_CONNECT_DOMAIN.md`) they live on github.io links:

| Site | Repo | Live now | Later (file 11) |
|---|---|---|---|
| Portfolio | `Beyondcy888/beyondcy.co` | https://beyondcy888.github.io/beyondcy.co/ | https://beyondcy.co |
| Dashboard | `Beyondcy888/beyondcy.co-dash` | https://beyondcy888.github.io/beyondcy.co-dash/ | https://dash.beyondcy.co |
| Tracker | `Beyondcy888/beyondcy.co-track` (this repo) | https://beyondcy888.github.io/beyondcy.co-track/ | https://track.beyondcy.co |

## Read in this order

1. `01_PROJECT_OVERVIEW.md`: repos, stack, hosting, security rules
2. `02_TRACKER_SPEC.md`: what the tracker does (roles, pages, fields, status, targets, comments, history, calendar)
3. `03_DESIGN_SYSTEM.md`: look and feel, tokens, the signature progress module, screen layouts
4. `04_DATABASE_GUIDE.md`: how the app talks to Supabase (tables, queries, realtime, errors)
5. `05_PLACEHOLDER_SITES.md`: the two "Stay tuned" pages
6. `06_SETUP_DEPLOY_CHECKLIST.md`: Supabase settings, deployment, DNS, acceptance tests
7. `07_DECISIONS_AND_OPEN_ITEMS.md`: every decision made so far, assumptions, and what is still open
8. `references/`: reference images for the visual vibe (`ref-1-dashboard-sidebar.jpg`, `ref-2-login-dot-grid.jpg`) and, for the v2 Admin Dashboard boxes, `ref-3-dashboard-boxes.jpg`
9. `09_UPDATE_V2.md`: **update v2** (brand green + logo, full-width layout, Notion-like sidebar, banners, targets per person × brand split into Reels + Feed, PIC, ring chart, Admin Dashboard and Targets page). **Where it disagrees with 01–08, 09 wins.**
10. `10_SPLIT_INTO_3_REPOS.md`: the split into three repos on github.io links (done 9 Nov 2026). **Where it disagrees with 01–09 about repos, hosting or links, 10 wins.**
11. `11_CONNECT_DOMAIN.md`: **later**: connecting `beyondcy.co`, `dash.` and `track.` (DNS at Hostinger, `CNAME` files, base path back to `/`).
12. `UPDATE-V3/` (files 00–07 + `references/`): **update v3** (12 Nov 2026): profile photos, projects, the four boxes on every page, the this-week reminder, dragging in the calendar, the status board, brand cards, and the team's portfolio moving into the `beyondcy.co` repo. **Where it disagrees with 00–11, v3 wins.** Its SQL is `supabase/06_update_v3.sql` (the owner ran it).

Also in `docs/`: `TASKS.md` (the build's task list, newest work first), `deploy.ps1` (a copy of the push script that lives in the parent `Beyondcy-Web` folder), `DEPLOY-PLAN.md` (an earlier deploy plan, superseded by 10), and the owner's original spec folders `START-DEV-01/`, `START-DEV-02/`, `START-SUPABASE-01/` (archive; the numbered files above are the working copies).

The database is **already designed and tested**. The SQL lives in `../supabase/` (`01`–`03` first release, `04_update_v2.sql` and the optional `05_fix_display_names.sql` for v2). The owner runs it in Supabase before you start. **Do not change the database design** without asking. If something seems missing, ask the owner first.

## Ground rules

- **Security lives in the database.** The tracker's access rules are enforced by Supabase Row Level Security (RLS). Hiding buttons or routes in React is only for convenience; never rely on it.
- **Never put a secret in the code or the repo.** The only Supabase values the frontend may use are the **Project URL** and the **anon / publishable key**. Never use the `service_role` / secret key, or the database password, anywhere in this project.
- **The status column is calculated by the database.** The app never writes `status`, `missing_fields`, `uploaded_at`, `updated_by`, `owner_id` or `updated_at`.
- **Time zone is Jakarta (WIB, `Asia/Jakarta`)** for "today", the live clock, greetings and the default month.
- **Language:** the UI is in English. Content typed by staff will often be in Indonesian. Handle long Indonesian text gracefully.
- Build to a quality floor without being asked: responsive down to mobile, keyboard accessible with visible focus, `prefers-reduced-motion` respected, and good contrast.
- When something in these docs is unclear or conflicts, **stop and ask** rather than guessing.

## Definition of done (this release)

- `track.beyondcy.co` is live with login, every role's pages, the progress module, the table, the item drawer (fields, comments, history), the calendar, the Admin Dashboard and Targets page (v2) and the admin People page. Every check in `06_SETUP_DEPLOY_CHECKLIST.md` passes.
- `beyondcy.co` and `dash.beyondcy.co` show the "Stay tuned" pages.
- All three are deployed over HTTPS: on their github.io links now (10), on their domains once 11 is done.
