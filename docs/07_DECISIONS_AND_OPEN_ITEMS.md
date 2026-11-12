# 07 · Decisions and open items

This file records everything the owner has decided so far (including the dashboard, which is built later), the assumptions made to fill gaps, and what is still open. **If you change something listed here, update this file.**

Update v2 (`09_UPDATE_V2.md`, 4 Nov 2026) replaced the target, ownership and accent decisions below. Where an older doc (01–08) disagrees with 09, 09 wins. The split into three repos (`10_SPLIT_INTO_3_REPOS.md`, 9 Nov 2026) decides repos, hosting and links; connecting the domain comes later with `11_CONNECT_DOMAIN.md`.

## Update v3 (12 Nov 2026): photos, projects, this week, drag, status board, brand cards, portfolio

Spec: `docs/UPDATE-V3/` (files 00–07, the owner's reference images, and the SQL the owner ran: `supabase/06_update_v3.sql`). **Where v3 disagrees with 00–11, v3 wins.** The database was not changed by the build; the app was adapted to it.

**Decided by the owner**
- **This-week reminder:** Monday–Sunday of the current week (WIB). Only Not started and Planned content (never Uploaded), plus open projects due this week. A warm "all done" state when the week's content is all uploaded.
- **Calendar drag:** staff in their own tracker, Admin everywhere including the Dashboard. Uploaded content is locked. Drag into and out of "No date". A toast with **Undo**. Only Admin drags projects.
- **Status board:** display only (no dragging between columns). A big total per column with the Reels / Feed split below it. Clicking a card opens the item.
- **Boxes on tracker pages:** the same scope as the page's progress module; both the boxes and the big module stay.
- **Projects:** visible to the assigned staff and Admin only; shown on the deadline in their calendars; Admin and assigned staff can mark one done; any active staff member can be assigned; the description is plain text with clickable links.
- **Profile photos:** people change their own, Admin anyone's. Round crop with zoom. Everyone signed in sees everyone's name and photo, never emails.
- **Brand cards:** count for the month selected on the Dashboard; a card opens that brand's tracker page; nine equal cards in one row that scrolls sideways on narrow screens.
- **Portfolio:** the team's website replaces the "Stay tuned" page. The login page stays in the code but is not linked or published.
- **Publishing (12 Nov):** nothing is pushed until the owner has looked at localhost and says "push".

**Defaults chosen by Claude in v3 (change them any time)**
- The reminder also shows **overdue** work (dated before this week, still Not started or Planned, and open projects past their deadline) in a small group on top. To remove it: drop the `overdue` group in `src/track/WeekReminder.jsx`.
- The reminder's counter ("4 to go") counts this week only; overdue has its own count in its group.
- In the calendar, **projects sit above content** in a day, so a deadline is never hidden behind "+N more".
- A Planned item dropped on "No date" becomes Not started (the database does this: a date is required for Planned). The toast says so, and Undo brings both back.
- Status board extras: "x of y target" under Uploaded (the page's month target), and a "Mine only" switch on a team Master page for staff.
- Letter avatars use six muted tones (rose, teal, ochre, magenta, brick, sand): none of the status colours and neither type colour. The tone is picked from the person's id, so it never changes.
- The big achievement number shows the decimals and the % sign smaller ("41" + ".8%"): the digits that matter stay big and the gauge keeps its room.
- On the Dashboard calendar, projects follow the Tracker and PIC filters through the people they're assigned to; they hide when a Brand or Status filter is set (projects have neither), and the Type filter has "Projects".
- While dragging, holding the chip over the previous / next month name (they appear in the calendar's header) turns the page.
- The project popup has a History section for Admin (from `activity_log`).

**Brand logos and colours (owner: swap any you don't like)**
One place to change them: `src/config/brandStyle.js`. Files are in `public/brand-logos/` (trimmed, max 512px, WebP). Sources, including the ones not chosen: `design-assets/tracker-brand-logo/` (in the repo, not published). No SVGs were supplied, so each is the highest-resolution transparent PNG that reads on a dark background.

| Brand | Chosen file (folder / file) | Colour | Where the colour comes from |
|---|---|---|---|
| Behomy | `behomy&behomyGroup/Behomy Teks Putih.png` | `#F47F1F` | the logo (orange) |
| Behomy Group | `behomy&behomyGroup/Logo Behomy 1.png` (white) | `#3C507E` | `Logo Behomy 2.png` (navy), same folder |
| Homy8 | `H8/1. Logo Utama H8.png` | `#F28106` | the logo (orange). "Logo Utama" is also the mark the team's portfolio uses |
| Beefix | `beefix/Logo Beefix Putih.png` | `#F2E70E` | the logo (yellow) |
| Purnava | `purnava/logo purnava-22.png` (white emblem) | `#4D674A` | `logo purnava-14.png` (green), same folder |
| Hoteru | `hoteru/Frame 48.png` (white) | `#4A4233` | `Frame 49.png` (brown), same folder |
| Corvel | `corvel/Lettermark Logo Corvel_Cream.png` | `#792C02` | `Lettermark Logo Corvel_Maroon.png`, same folder |
| Kedai Makmoer 88 | `makmoer/LOGO---KEDAI-MAKMOER-88--PUTIH.png` (white) | `#2D4F2B` | `LOGO---KEDAI-MAKMOER-88.png` (green; its accent is red `#BC0016`) |
| Lahap | `lahap/Frame 38.png` | `#FFEC3D` | the logo (yellow) |

- Five of these colours are too dark to glow on a dark card, so `brandStyle.js` also holds a `glow` for them: the same hue, lifted (Behomy Group, Purnava, Hoteru, Corvel, Kedai Makmoer 88).
- Things the owner may want to change: **Lahap and Beefix are both yellow**, and **Behomy and Homy8 are both orange** (their real colours). Lahap also has a red wordmark (`lahap/Frame 16.png`, `#DA2017`); Kedai Makmoer 88 could take its red accent instead of green (Purnava is green too).

**Build decisions (v3)**
- **People directory:** `AppDataProvider` now reads the `people` view (everyone, no emails) instead of `profiles`. Photo URLs are signed in one batch, cached by path + "updated at", renewed five minutes before they expire, and refreshed with the directory when the tab regains focus or a photo changes. `profiles` is still used for your own profile and the Admin People page.
- **One `<Avatar>`** (`src/people/Avatar.jsx`) everywhere a person is shown. The letter stays under the photo until it has loaded, so there is never a broken image.
- **PIC filters and the PIC field** are a custom dropdown (`PersonSelect`), because a native `<select>` can't show photos. New content in a team tracker picks the PIC from a short list with photos.
- **Projects are loaded once for the whole app** (`ProjectsProvider`): the database returns what this person may see. Any realtime event on `projects` or `project_assignees` re-reads the (small) list. The popup is `?project=<id>` in the address, like `?item=<id>` for content.
- **Drag and drop:** `@dnd-kit/core` with a mouse sensor (6px) and a touch sensor (press and hold 250ms). No keyboard dragging: Enter and Space open the item, and the date can be changed in the drawer. The chip moves at once and is put back if saving fails, with the database's message.
- **The table's filters live on the page** (`useContentFilters`), so the status board shows exactly what the table shows. The Brand filter is `?brand=<id>` in the address: that is how a brand card opens Behomy Master with the brand already chosen.
- **The four boxes are one component** (`src/track/SummaryBoxes.jsx`) fed by `pageStats()` in `lib/progress.js`, the same function the progress module uses.
- **Boxes keep their size** (172px). The number is as big as fits; the illustration takes the room the number leaves (measured), so it never sits on the number or the line below.
- **Errors:** `friendlyError(err, { refused })` lets projects and photos show "Only Admin can do this." where the tracker shows "You don't have access to this tracker.". The database's own messages pass through unchanged.
- **Mock mode** (`npm run mock`) mirrors the v3 rules: the people view, the avatars bucket and `set_profile_avatar`, projects with their row-level rules, and demo projects and photos.
- **`/dev-check`** has v3 checks (people view without emails, projects, avatars bucket, `set_profile_avatar` refusal). Nothing is written, except one project insert as staff that must be refused.
- **Portfolio (`beyondcy.co` repo):** Next.js 15 static export. The base path comes from one variable (`BASE_PATH`, set only in its workflow). The login page is kept in `app/_login/`, which Next.js does not publish. Because the repo name contains a dot, Next.js would treat `.co` as a file extension and break the Home link; `skipTrailingSlashRedirect` plus `pageHref()` fix that. Its Pages source must be **GitHub Actions**.
- **Tests:** run npm from an upper-case drive path (`D:\…`). From `d:\` vitest fails before the first test.

**Still open after v3 (owner)**
- Look at localhost, then say "push" (`.\deploy.ps1`).
- After the push: `beyondcy.co` → Settings → Pages → Source = **GitHub Actions**, then check https://beyondcy888.github.io/beyondcy.co/.
- With real logins: run `/dev-check` as Admin and as a staff member; upload a photo; create a project for two people in different trackers.
- Delete `beyondcy.co\.original-from-team\` (the team's folder as delivered, kept locally and git-ignored) once the live portfolio has been checked.

## Repos and hosting: the split into three repos (10, 9 Nov 2026)

**Decided by the owner**
- Three separate repos under **Beyondcy888**, in three folders side by side in `Beyondcy-Web\` (a plain folder, not a repo), pushed by `deploy.ps1` from that folder:
  - `beyondcy.co` (portfolio): https://beyondcy888.github.io/beyondcy.co/
  - `beyondcy.co-dash` (marketing dashboard): https://beyondcy888.github.io/beyondcy.co-dash/
  - `beyondcy.co-track` (tracker): https://beyondcy888.github.io/beyondcy.co-track/
- Commit history is kept: dash and track were split out with `git subtree split`; the portfolio repo is the old monorepo, cleaned up.
- The doc folders (`START-DEV-01`, `START-DEV-02`, `START-SUPABASE-01`, `DEPLOY-PLAN.md`, `TASKS.md`) moved to the tracker's `docs/`.
- Supabase is used by the tracker only. The repos are public (GitHub Free).
- The domain is connected later (`11`). Until then there is **no `CNAME` file in any repo and no custom domain** in Settings → Pages (a `CNAME` would redirect the github.io link to a domain that isn't connected).
- This replaces the single-site setup of 5–7 Nov (one repo published as `/`, `/dash/` and `/track/` by a combined workflow). That workflow never deployed, because the Supabase secrets were never added, and it was removed.

**Why the switch to the domain stays small**
- Tracker: one line. The workflow sets `VITE_BASE_PATH: /beyondcy.co-track/`; deleting it makes the base `/`. Everything else follows `import.meta.env.BASE_URL` (router basename, logos, password-reset link).
- Portfolio and dash: relative paths only, so only the `SITE LINKS` block at the top of `index.html` changes (plus the portfolio's `og:url`, which sits right under it).
- `deploy.ps1`: `$UseCustomDomains = $true` makes it print the domain links.
- Safety nets until everything has worked for a week: the old folder `D:\BEHOMY\beyondcy.co-OLD` (the owner deletes it), the `pre-split-backup` tag on GitHub, and `D:\BEHOMY\beyondcy.co-backup-20261109.bundle`.

**Build decisions made during the split (owner: confirm or correct)**
- The router uses `basename={import.meta.env.BASE_URL}` exactly as 10 says, trailing slash included (React Router 7 supports it). GitHub redirects the slash-less `/beyondcy.co-track` to `/beyondcy.co-track/`.
- `SITE_LINKS` lives in `src/siteLinks.js`. Nothing links between the sites yet, so nothing imports it until a link is added.
- The tracker workflow kept the first release's extras: a check that the two secrets exist (a clear error instead of a blank page), `npm test`, and a secret scan of `dist/`, which now also catches a real `sb_secret_…` key. (The scan looks for a key-shaped value, because the bare prefix appears inside supabase-js.)
- The real publishable key in the archived `docs/START-DEV-01/08_CONNECT_TO_SUPABASE.md` was replaced by a placeholder, like the working copy `08`. It is still in the old monorepo's history (the `beyondcy.co` repo); the key is public by design, so nothing else is needed.
- The portfolio's `og:url` now points at its github.io address (before, it pointed at `beyondcy.co`, which doesn't serve the site yet).
- `deploy.ps1` is used exactly as given. Its secret check also matches its own pattern text, which appears in `docs/deploy.ps1` and in `10`. So the tracker's first commit after the split was made by hand after a manual secret scan, and `deploy.ps1` then pushed it. Later edits are fine unless a changed line contains that pattern.
- Fixed on the way: a typo in the dev-only `/dev-check` page (an apostrophe inside a single-quoted string) stopped it loading in `npm run dev`. Production builds never contained that page.

## Tracker: decided by the owner

- The tracker and the dashboard are **completely separate**. The tracker is manual input by the Beyondcy team. The dashboard is Meta API data plus manual input by Admin.
- **Fields:** Content, Type (Feed/Reels), Brief, Caption, Notes, Publish Date, Reference, Uploaded content (the Instagram link). There is no content-file link. "Category" on the old whiteboard was a mistake; it means Type.
- **Status:** Not Started (grey) until every field is filled → Planned (blue) → Uploaded (green) only once the Instagram link is added. The link is locked until every field is filled.
- **Homy8 only:** Content Pillar column, multi-select (Design, Education, Portfolio, Interview, Comedy), filled by staff, and required for Planned.
- **Roles (hard lock):** Admin; Lahap & Kedai Makmoer 88 (Excel); Beefix (Dika); Homy8 (Zaki); Behomy (Arum, Ilyas, Anne). Access belongs to the role so people can rotate brands.
- **Excel:** a Master table with a Brand column, plus separate Lahap and Makmoer pages.
- **Behomy:** one combined list with a Brand column (Behomy, Behomy Group, Corvel, Hoteru, Purnava). Each person lands on My work (the items where they are the PIC) and can open Master (everyone's items plus stats).
- **Admin Beyondcy:** one account, one person. Lands on the Admin Dashboard, can open every tracker with the staff layout, and every edit is traced.
- **Login:** email + password. A display name is shown in the UI.
- **Targets (v2):** set by **Admin only**, per **person × brand × month**, split into **Reels + Feed**; total = Reels + Feed. The old (v1) targets were deleted when `04_update_v2.sql` ran; the owner re-enters them on the Targets page. Done = Uploaded. An item counts in the month of its Publish Date, toward its **PIC × brand × type**. Each month starts empty, and past months stay viewable.
- **PIC (v2):** every item has a person in charge, who decides whose target it counts toward (the creator is still recorded). Staff → always themselves. Admin → the tracker's only person (Excel, Dika, Zaki), or chosen in Behomy. **Only Admin changes the PIC.** Delete is allowed for the creator, the PIC or Admin.
- **The mix rule (v2):** achievement uses the **totals**, so extra items of one type do count (the % can reach 100%), with a short explanatory note whenever the type mix differs from the target.
- **Admin Dashboard and Targets page (v2):** as described in 09 §9 and §10. English labels. "Status & notes" are typed by Admin.
- **Brand (v2):** accent `#9ECD59` (Beyondcy green, from the logo). Uploaded uses the same green on purpose (green = done). **Reels are orange with a ▶ play icon; Feed is violet with a 2×2 grid icon**, never colour alone.
- **Comments:** yes, with no notifications and a count on each row. **Production cost:** no. **Board view:** no.
- **Calendar:** below the table, current month, today highlighted, live clock, items on their publish date (name + type), a No date list, and previous/next/today.
- **Notion data:** the owner migrates it manually. No import tool.
- **Sites:** `beyondcy.co` and `dash.beyondcy.co` are "Stay tuned" for now; `track.beyondcy.co` is the priority.
- **Design:** the dark vibe of the references, with a more creative, non-template progress area; the Admin Dashboard's summary boxes follow the owner's `references/ref-3-dashboard-boxes.jpg` (with original illustrations).

## Defaults chosen by Claude in v2 (the owner didn't answer these; change them any time)

- **One banner per tracker** (shared by its members and Admin), with reposition.
- The **ring chart is added next to the dot lanes**, not replacing them.
- Display names: Admin Beyondcy, Dika, Zaki, Arum, Ilyas, Anne (if `05_fix_display_names.sql` was run; otherwise edit them on the People page).
- Reels = orange, Feed = violet.

## Assumptions made to fill gaps (owner: confirm or correct)

1. **Admin sets every target**, including each Behomy person's per-brand targets. Staff can't edit targets, even their own. (The owner said both "let them edit their own goals" and "only Admin can change the target"; this reading was chosen, and v2 confirmed it.)
2. Teammates can **edit** each other's items (like Notion), but only the **creator, the PIC or Admin can delete**.
3. Reference is one text field holding one or more links, one per line.
4. ~~Behomy items created by Admin count toward the team total but not toward any person's lane.~~ Replaced in v2: Admin chooses a PIC for Behomy items. Items Admin made in Behomy before v2 have no PIC, show **"Needs a PIC"** and count toward no one until Admin picks one.
5. Table month scope: the selected month plus undated items, with a "Show all months" toggle.
6. Clicking an empty calendar day starts a new item on that date (tracker calendars; not the dashboard's all-brands calendar).
7. The UI language is English. Greetings switch at 11:00 and 18:00 WIB.
8. ~~The accent colour `#8F7CF7` approximates the Beyondcy logo violet.~~ Replaced in v2 by the logo green `#9ECD59`; violet now means Feed.
9. The placeholder copy in `05` is a draft.
10. The pillar is spelled "Portfolio" (written "Portofolio" in the owner's message).

## Tracker: still open

- [x] Beyondcy logo and brand colour: delivered in v2 (`logo-beyondcy.png`, `logo-mark.png`, favicons; green `#9ECD59`). An SVG version of the logo would stay sharper on high-density screens, if one exists.
- [ ] Final tracker visuals: the owner may send more UI direction later
- [ ] Real emails for the 7 accounts (for `03_assign_users.sql`)
- [ ] Supabase Pro plan and custom SMTP before go-live
- [ ] Connect the domain with `11_CONNECT_DOMAIN.md`: DNS access for beyondcy.co (Hostinger), and checking that company email and the old server aren't affected
- [ ] Re-enter this month's targets on the Targets page (v1 targets were deleted by the v2 SQL)

---

## Dashboard (dash.beyondcy.co): for a later release, NOT this build

**Data sources:** two Meta APIs. The **Instagram API** provides organic data (posts, views, reach, interactions, followers, demographics). The **Marketing API** provides ads data (spend, results, CPM, CPC, CTR; boosts are ads too). **Meta Business Suite is only a viewing screen, not a data source.** Instagram only (no TikTok, no Facebook Page metrics for now). Monthly view with a month switcher. One dashboard per Instagram account. Admin (Beyondcy) sees all; each brand login sees only its own.

**Setup:** one Meta developer app (Business type), one System User and one read-only token stored only in Supabase secrets, with every brand's Instagram account, linked Facebook Page and ad account assigned to it. Accounts the business owns or manages should only need **Standard Access** (no App Review). This must be confirmed by a test pull from one brand. The Facebook Page gives almost no data itself but is the required bridge to the Instagram account. The data sync runs on a schedule in Supabase and stores history; the dashboard reads only from Supabase.

**Key limitations found:**
- Per-post likes, comments, views and interactions from the Instagram API are mostly organic only. Show organic and paid side by side.
- Account-level profile visits were removed by Meta (January 2025). Per-post profile visits and follows exist only for feed posts and stories, not Reels. Ads report their own profile visits.
- History: ads go back about 37 months and per-post data about 2 years, but **past follower totals and past demographics can't be backfilled**. Start the sync early, and import old monthly reports as history.
- Instagram organic data can be up to 48 hours behind.
- Top-up history can't be read via the API, so it is entered manually. Targets, budgets, benchmarks, executive summary, audience observation and content pillar per post are all entered by Admin.
- Boosts made outside the brand's business ad account are invisible to the API.

**Dashboard open items (TBC):**
- [ ] Meta asset map: which portfolio owns each brand's Instagram account, Page and ad account, and whether each Instagram account is a Business account linked to a Page
- [ ] Ad accounts: one per brand, or shared (check the Behomy sub-brands)
- [ ] Where boosts are made (Instagram app / Business Suite / Ads Manager), and whether they appear in Ads Manager. **Blocker for ads data.**
- [ ] The meaning of "Ads Result Type" in the old template (ask the template maker)
- [ ] Lahap: does it get a dashboard, and does it run ads?
- [ ] Brand stakeholder logins: shared per brand, or personal?
- [ ] Content pillar list per brand for dashboard tagging
- [ ] Short topic title per post: typed by Admin, or the start of the caption?
- [ ] Engagement rate formula (reach-based vs follower-based). The old template's 1,033% TikTok ER was a formula bug.
- [ ] Organic vs paid presentation, and whether to show Facebook ad placements

**Reminders for the owner:** set up the Meta Pixel later; send the file with executive summaries, targets and audience observations; import old monthly reports as history; replace any passwords that appeared on the whiteboard photo with unique ones, plus a password manager and two-factor login.

---

## Build decisions (update v2, 4 Nov 2026)

Made while building v2, where 09 left room. Owner: confirm or correct.

**Counting**
- Items without a PIC count toward **no one**, including tracker and dashboard totals, so every total equals the sum of its rows. A warning shows how many items need a PIC (and how many of them are already uploaded).
- Uploads for a brand with no target still count in that person's and tracker's totals (extra items count, as in the mix rule), and appear as their own row with target "–" and status "No target".
- A target whose total is 0 counts as **no target** (achievement "–", status "No target"). On the Targets page, emptying both numbers of a saved row clears it (after a confirmation).
- The mix note appears whenever a type is **over its own target** (the case where a healthy total can hide a shortfall), worded exactly like 09 §7's examples. When every type is at or under its target, the per-type counts (▶ a/b ▦ c/d) already tell the story.
- Achievement shows one decimal, dropping ".0" (80.3%, 100%), everywhere: modules, dashboard, tracker list.
- Pace for statuses and sentences uses the WIB date, as before.

**Tracker pages**
- Behomy My work shows one lane per brand where I have a target or **uploads** this month (09 §8's wording); planned items alone don't add a lane.
- The single-lane pages (Dika, Zaki, an Excel brand page) keep one big dot row under the number and ring; the masters keep stacked lanes.
- Calendar chips on tracker pages show type icon + title (adding the brand name hid the title in narrow cells). The dashboard's all-brands calendar shows the brand short name as specced (Kedai Makmoer 88 → "Makmoer").
- New content (Admin in Behomy): the PIC pre-selection looks at the month of the clicked calendar day, otherwise the month on screen.
- The PIC appears in the drawer on every tracker (read-only for staff). If an item's PIC has left the tracker, Admin sees them as "(no longer in this tracker)" and can choose an active member.
- "Needs a PIC" uses the danger tint, not orange (orange means Reels).

**Banner**
- Encoded as WebP (quality 0.85, max 1500px wide); where a browser can't encode WebP (older Safari), JPEG at the same quality. The bucket accepts both.
- Signed URLs (1 hour) are cached and refreshed 5 minutes before they expire.
- Touch screens have no hover, so "Add banner" and the hover actions live in the page's "⋯" menu there. Reposition also works by keyboard (↑/↓, Enter saves, Esc cancels).
- A banner that exactly fits its box (5:2 on a tall window) has nothing to reposition; dragging then does nothing.

**Sidebar**
- The icon rail stays for 721–1100px when the sidebar is pinned; hiding it gives the full width, and a peek always shows the full sidebar.
- Tablets with touch (no hover): the toggle pins and hides; there is no peek. Phones (≤720px): the top bar's menu button opens the drawer.

**Targets page**
- A row saves when focus leaves the row (one history entry per row edit, not per keystroke). Enter saves, Esc undoes.
- Typing in Total uses the Reels value from when the Total box was focused, so typing "25" isn't cut short by the "2" on the way.
- Notes need a target in that row (the dashboard shows "Set a target first" too).
- People who left a tracker but still have a target that month are read-only (an upsert would fail in the database: its INSERT trigger checks the person's current tracker); their row can still be cleared.
- "Copy from <previous month>" fills only rows of active people that are empty this month and had a non-zero target last month. Notes are never copied.

**Other**
- `site.webmanifest` added so `icon-192.png` and `icon-512.png` are used (Add to Home Screen). Martian Mono now loads weight 700 for the headline.
- On phones the sticky Content column is 180px wide (the 260px minimum applies from 721px), so the rest of the table can scroll beside it.
- The dashboard's Detail table shows Admin's "Status & notes" (09 §9.4); the computed status is in "Performance per PIC".

## Build decisions (first release, 3 Nov 2026)

Made while building, where the docs left room. Owner: confirm or correct. Items marked (v2) changed in the update.

**Structure and tooling**
- The three sites were built as three folders in one workspace (`beyondcy-site`, `beyondcy-dash`, `beyondcy-track`), each ready to push as its own repo. (On 5 Nov the owner pushed them as one monorepo; on 9 Nov they were split into `beyondcy.co`, `beyondcy.co-dash` and `beyondcy.co-track`: see "Repos and hosting" at the top.)
- `@tanstack/react-table` is pinned to **v8** as the spec says (v9 exists).
- CI uses **Node 24** (Node 20 is end-of-life, and Vite 8 needs 20.19+). The workflow uses the latest action majors (checkout v7, setup-node v7, upload-pages-artifact v5, deploy-pages v5), runs the unit tests, and fails if `service_role` appears in the build.
- Library code is split into its own cached chunks (react, supabase, vendor).

**Tracker behaviour**
- Admin in the Behomy (team) tracker sees **Master only**. Admin has no lane, so "My work" would be empty.
- (v2) The Behomy team total counts every uploaded item **that has a PIC**; the team target is the sum of the people's targets.
- Someone who left a team still gets a lane in months where they had a target or items as PIC, so past months stay readable. It shows their name while they're still in the tracker (e.g. deactivated), and "Former member" once they've moved to another tracker.
- Pace wording: on the last day "3 to go today"; past months "Target reached" or "Ended 3 short of the target"; future months "This month hasn't started yet".
- (v2) The percentage always shows next to the big number, in green from 100%.
- (v2) "By brand" (Behomy Master) shows each brand's uploaded / target with a small meter in the Uploaded green.
- The drawer is a modal panel. Esc closes it and still saves a text field being typed in. If a teammate changed that same field and the person hasn't chosen "Load their version" or "Keep mine", nothing is overwritten and a toast says so.
- Date fields save once a full date is picked or typed (after a short pause), or on blur/Enter, so half-typed years never reach the database.
- Errors from quick edits in the table (Type, Publish date) appear as a toast, since there's no field beside them.
- Calendar: days outside the month aren't clickable. On phones, days show status dots, and a tap opens that day's list with "New content on this day".
- "Sign out" signs out this browser only.
- Password reset uses PKCE, so the email link must be opened in the same browser that asked for it (the page says so). New passwords need at least 8 characters.
- Realtime: delete events can't be filtered in Supabase, so they're received unfiltered (they carry only an id) and matched locally. Comment counts are re-read after comment events. The tracker also refetches when the tab regains focus.
- The login page has a Show/Hide password toggle. There is no sign-up link.

**Found during setup (owner action)**
- Public sign-ups were enabled on 3 Nov; on 4 Nov they are **off** (`disable_signup: true`, checked from the app). Keep it that way.
