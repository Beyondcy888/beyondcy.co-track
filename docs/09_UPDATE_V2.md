# 09 · Tracker update v2

This update changes the tracker built from docs 00–08. **Where this file disagrees with an earlier doc, this file wins.** When you're done, update `07_DECISIONS_AND_OPEN_ITEMS.md` so it matches (see §12).

**The owner has already run** `supabase/04_update_v2.sql` (and possibly the optional `05_fix_display_names.sql`). The SQL was tested role by role before delivery. **Do not change the database**; adapt the app to it (§1).

New assets are in `assets/`: `logo-beyondcy.png`, `logo-mark.png`, `favicon.ico`, `favicon-32.png`, `favicon-16.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`.

## Summary of changes

1. Brand: Beyondcy logo + favicon, and the accent colour becomes the brand green `#9ECD59`
2. Layout: content fills the full page width; the table scrolls horizontally
3. Sidebar: collapsible like Notion (pin / hide / peek on hover at the left edge)
4. Banner: each tracker can have a full-width banner image (like Notion's cover)
5. Targets: set by Admin **per person × brand × month**, split into **Reels + Feed**
6. PIC: every item belongs to a person in charge, which decides whose target it counts toward
7. Progress module: a bigger, bolder number plus a ring chart (Reels / Feed)
8. Admin: "All trackers" becomes **Dashboard** (new content), plus a new **Targets** page

---

## 1. Database changes to adapt to

| Before | Now |
|---|---|
| `monthly_targets` table + `set_monthly_target()` | **Removed.** Use `content_targets` (below). |
| Item ownership = `owner_id` (creator) | `owner_id` is still the creator, but **`pic_id`** decides whose target an item counts toward and powers "My work" |
| — | `tracker_banners` table + private storage bucket `tracker-banners` |

### `content_targets`

| Column | Notes |
|---|---|
| `month` | first day of month, `YYYY-MM-01` (the DB rounds any date down to the 1st) |
| `brand_id`, `profile_id` | the brand and the person (PIC). Unique per `(month, brand_id, profile_id)`. |
| `role_id` | **set by the DB** from the person's tracker. Don't send it. |
| `target_reels`, `target_feed` | integers 0–500 |
| `target_total` | **generated** = reels + feed. Read-only. |
| `note` | Admin's free-text "Status & notes" |
| `set_by`, `updated_at` | set by the DB |

- Read: Admin sees all; staff see their own tracker's rows (Behomy staff see all three people's rows).
- Write: **Admin only** (RLS). Upsert:
  ```js
  await supabase.from('content_targets')
    .upsert({ month, brand_id, profile_id, target_reels, target_feed, note },
            { onConflict: 'month,brand_id,profile_id' })
    .select().single();
  ```
  Clear a target = `delete` the row. Edit just the note = `update({ note }).eq('id', id)`.
- The DB refuses a brand that isn't in that person's tracker: `Brand "beefix" is not in Arum's tracker.`
- Changes are logged in `activity_log` as `target_set` / `target_removed`, with `changes.reels`, `changes.feed` and `changes.note` (old/new), plus `brand_id` and `profile_id`.
- Realtime: subscribe to `content_targets` (filter `role_id=eq.<id>` on tracker pages; no filter on the Admin dashboard).

### `content_items.pic_id` (PIC rules, enforced by the DB)

| Who creates the item | PIC becomes |
|---|---|
| Staff | **always themselves** (anything else sent is ignored) |
| Admin, in a tracker with one person (Excel, Dika, Zaki) | **that person, automatically** |
| Admin, in Behomy (3 people) | **Admin must choose.** Inserting without `pic_id` fails with `Choose the PIC for this content.` |

- Only **Admin can change** the PIC later. Staff updates to `pic_id` are ignored.
- The PIC must be an **active member** of the item's tracker.
- Delete is now allowed for the **creator, the PIC, or Admin**.
- `pic_id` changes appear in `activity_log` (`changes.pic_id`, holding old/new ids; resolve them to names, with "Former member" as the fallback).
- Existing items were backfilled. Items Admin created in Behomy before this update have `pic_id = null`. Show a **"Needs a PIC"** badge, which only Admin can fix.
- Inserting into another tracker now fails with `You don't have access to this tracker.`

### `tracker_banners` + bucket `tracker-banners`

- One row per tracker: `role_id` (primary key), `image_path`, `position_y` (0–100, default 50), `updated_by_name`, `updated_at`.
- Members of the tracker and Admin can read, add, change and remove it.
- Bucket: private, **5 MB max**, JPG / PNG / WebP. Files **must** be stored at `<role_id>/<file>`, e.g. `behomy/3f2a….webp`. The DB refuses `image_path` values outside the tracker's folder, and storage refuses uploads into another tracker's folder.
- Realtime: subscribe to `tracker_banners` with `role_id=eq.<id>`.

---

## 2. Brand: logo, favicon, colours

**Logo**
- Sidebar top (pinned): `logo-beyondcy.png` at about 26px tall, `alt="Beyondcy"`. The logo is made for dark backgrounds (green "beyond", white "cy" and ring); never place it on a light surface.
- Collapsed / top bar / small spaces: `logo-mark.png`.
- Login page: the full logo above the form.
- **All three sites** (tracker and both placeholders): add the favicons to `<head>`:
  ```html
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  ```
  Replace the text wordmark on the placeholder pages with the logo image.

**Colour tokens** (replace the violet accent everywhere)

| Token | Hex | Use |
|---|---|---|
| `--accent` (replaces `--violet`) | `#9ECD59` | Primary buttons, focus ring, active nav marker, links, toggles |
| `--accent-ink` | `#131218` | Text/icons on green buttons |
| `--status-uploaded` | `#9ECD59` | **Same as the brand green on purpose: green = done** |
| `--status-planned` | `#4D8DFF` | unchanged |
| `--status-not-started` | `#6F6C7D` | unchanged |
| `--type-reels` | `#FF8A3D` | Reels, always with a **▶ play icon** |
| `--type-feed` | `#8F7CF7` | Feed, always with a **grid icon** (2×2 squares) |
| pace marker, today ring | `--text` (`#EEECF4`) | No longer violet |

- **Reels vs Feed must be recognisable everywhere** (type pills, table, calendar chips, charts, dashboard columns): the icon plus the colour, never the colour alone.
- Bonus dots (over target) are green with a thin outer ring.
- Placeholder sites: the dot motif uses dim green, with a few dots in the status colours.

---

## 3. Full-width layout and horizontal scroll

The owner's screenshot shows a large empty area beside the content: the main column was capped at about 1,400px.

- **Remove the max-width.** The main column fills all space next to the sidebar. Side padding is 32px (24px under 1,100px, 16px under 720px).
- **Content table:** wrap it in a container with `overflow-x: auto` and a **visible, styled horizontal scrollbar** (thin, `--raised` track, `--text-dim` thumb, still usable by mouse and touch). Minimum column widths:

  | Column | Min width |
  |---|---|
  | Content | 260px |
  | Brief, Caption, Notes | 280px |
  | Reference, Uploaded content | 220px |
  | everything else | 110–160px |

- Make the **Content column sticky** on the left while scrolling sideways, with a subtle edge shadow when content is scrolled under it. Keep the header row sticky.
- Calendar: full width. The **No date** panel is 280px on the right, and moves below the grid under 1,100px.

---

## 4. Sidebar: collapsible like Notion

Three behaviours:
1. **Pinned:** the sidebar is part of the layout and the content sits beside it (as now).
2. **Hidden:** clicking the toggle hides it, and the content takes the full width.
3. **Peek:** while hidden, moving the cursor to the **far left edge** (within about 12px, held about 120ms) slides the sidebar in as a **floating overlay** above the content. The layout does not shift. It stays while the cursor is over it, and slides away about 300ms after the cursor leaves. Clicking the toggle inside the peeking sidebar pins it again.

Details:
- Toggle button in the sidebar header (a "panel" icon, like reference 1). While hidden, a small toggle and the logo mark show at the top-left of the page header.
- Keyboard shortcut: **Ctrl+\\** (Cmd+\\ on Mac) toggles pin/hide.
- Remember the choice per browser (`localStorage`, key `byc.sidebar`, wrapped in try/catch).
- Animation is about 200ms, transform only. Under `prefers-reduced-motion`, it appears and disappears without sliding.
- Touch / under 720px: there's no hover. The header button opens the sidebar as an overlay drawer with a backdrop, closed by tapping outside or Esc.
- Accessibility: the toggle has `aria-expanded` and `aria-controls`. When the sidebar opens by keyboard, focus moves into it; Esc closes the peek or drawer.

---

## 5. Banner (Notion-style cover)

- **One banner per tracker**, shared by everyone in it and Admin. It shows at the top of all that tracker's pages (Master, brand pages, My work). The Admin Dashboard has no banner.
- **No banner:** hovering over the top of the page reveals a quiet "Add banner" button, which is also always available in the page's "⋯" menu for touch users.
- **With a banner:** it spans **edge to edge** of the main column (no side padding), above the greeting.
  - Aspect: designed for **1500 × 600**. Display height = `min(width × 0.4, 40vh)`, at least 160px. `object-fit: cover`; `object-position: 50% <position_y>%`.
  - The height cap keeps the table visible on wide screens; at full 1500:600 ratio a banner on a 1,700px-wide main column would be 680px tall.
  - Hovering shows **Change banner**, **Reposition** and **Remove**.
  - **Reposition:** drag the image up or down, then "Save position" / "Cancel". This saves `position_y`.
- **Upload flow:**
  1. File picker: JPG, PNG or WebP, max 5 MB. Hint: "Best size: 1500 × 600 px".
  2. In the browser, scale down to 1500px wide if larger and encode as WebP (quality 0.85).
  3. Upload to `tracker-banners/<role_id>/<uuid>.webp`.
  4. Upsert the `tracker_banners` row (`image_path`, `position_y: 50`).
  5. Delete the previous file.
- **Display:** `createSignedUrl(path, 3600)`. Cache it, and refresh it before it expires.
- Errors: "Banner must be 5 MB or smaller." / "Use a JPG, PNG or WebP image."
- Remove = delete the row and the file (confirm first).

---

## 6. PIC in the tracker UI

- **Behomy My work** now filters by `pic_id = me` (previously the creator).
- **Behomy Master:** the "Owner" column becomes **PIC**, and the person filter filters by PIC.
- Excel / Dika / Zaki pages: no PIC column (it's always them).
- **Item drawer:** shows the PIC. Admin gets a dropdown of the tracker's active members; staff see it read-only.
- **Admin creating an item in Behomy:** the New content flow asks for Brand **and PIC**. If exactly one person has a target for that brand in the current month, pre-select them; otherwise PIC is empty and required.
- "Needs a PIC" badge on items with `pic_id = null`. Admin can fix it from the drawer.
- Delete is shown to the creator, the PIC and Admin.

---

## 7. Targets and progress: calculation rules

Put these in pure functions in `src/lib/progress.js`, with unit tests that include the examples below.

**What counts:** an item counts when `status = 'uploaded'` and its `publish_date` is in the month. It counts toward its **PIC × brand × type** (`reels` or `feed`). Items without a PIC count toward no one; show "N items need a PIC".

For any group (a person × brand cell, a person, a brand, a tracker, or everything):

| Value | Formula |
|---|---|
| Target | Σ `target_reels`, Σ `target_feed`, total = Σ `target_total` |
| Uploaded | counts of uploaded Reels and Feed; total = both |
| Remaining | max(target total − uploaded total, 0) |
| Over | max(uploaded total − target total, 0) |
| Achievement | uploaded total ÷ target total (one decimal). With no target: "–". |

**Mix rule (the owner's decision):** achievement uses the **totals**. Extra items of one type **do count**, so the percentage can still reach 100%. But whenever the type mix differs from the target, **show a short note explaining it**.
- Target 10 Reels + 10 Feed, uploaded 14 Reels + 6 Feed → **100%**, note: "Reels 14/10 (+4 over) · Feed 6/10 (4 short). Total target met with extra Reels."
- Target 10 + 10, uploaded 12 Reels + 3 Feed → **75%**, note: "Reels +2 over · Feed 7 short."
- Target 10 + 10, uploaded 30 total (20 + 10) → **150%**, note: "Reels +10 over."

**Status** (computed):

| Status | When |
|---|---|
| Done | uploaded total ≥ target total |
| On track | current month, uploaded ≥ pace |
| Behind | current month, uploaded < pace |
| Not reached | past month, below target |
| Upcoming | future month |
| No target | no target set |

Pace = round(target total × today's day ÷ days in month), in WIB.

**Uploads with no target** (a person uploaded for a brand with no target that month): still show them as a row with target "–", achievement "–" and status "No target".

---

## 8. Progress module v2 (tracker pages)

The owner wants the target number **bigger, bold and more noticeable**, with a **chart**.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  12 / 25          ◎◎  ← double ring          On pace, 13 to go in 26 days      │
│  48% uploaded      ◎     outer: ▶ Reels 5/8   ▶ Reels 5 / 8     ▦ Feed 7 / 17  │
│                          inner: ▦ Feed 7/17   Reels +0 · Feed 10 short (note)  │
│ ─────────────────────────────────────────────────────────────────────────────  │
│  Lanes (dots) as before, each with ▶ 3/7  ▦ 5/12                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Headline number:** Martian Mono **700**, `clamp(3.5rem, 6vw, 6rem)`, uploaded in `--text` and "/ target" in `--text-dim`. The percentage sits next to it in bold, at about 40% of the headline size. Over target, it shows like "30 / 25 · 120%" with the % in green.
- **Ring chart:** about 168px. Draw it in hand-made SVG (no chart library needed).
  - **Outer ring = Reels** (orange), **inner ring = Feed** (violet). Each ring shows uploaded ÷ that type's target, over a faint track.
  - The centre shows the total % in bold mono.
  - Above 100%, a ring is full and gets a small "+N" badge.
  - If a type has a target of 0, that ring shows as a dashed track labelled "no Reels target" (or Feed).
- **Legend** next to the ring: "▶ Reels 5 / 8" and "▦ Feed 7 / 17", in the type colours, plus Planned and Not started counts. The **mix note** (§7) goes under the legend when needed.
- **On load:** the rings draw once with GSAP (about 700ms), and the dots fill as before. Under reduced motion, everything renders final.
- **No target:** "No target set for November yet. Admin Beyondcy sets targets."
- **Lanes by page:**

  | Page | Headline | Lanes |
  |---|---|---|
  | Dika / Zaki | person total | one lane (their brand) |
  | Excel Master | Excel total | one lane per brand |
  | Excel brand page | that brand | that brand only |
  | Behomy My work | my total | one lane per brand I have a target or uploads for |
  | Behomy Master | team total | one lane per person, plus the "By brand" line (target and uploaded per brand) |

  Each lane: name · dots (now sized against that lane's total target) · "uploaded / target" · "▶ a/b ▦ c/d" · pace · a mix-note icon (with tooltip and visible small text) when relevant.
- Admin's per-lane "Set target" pencils are **removed**. Targets are only set on the Targets page (§10), and each lane links there for Admin.

---

## 9. Admin Dashboard (replaces "All trackers")

Rename the sidebar item "All trackers" to **Dashboard**. It is Admin's landing page. It has a header (greeting + month switcher + clock), then these sections **from top to bottom**:

**1 → Four summary boxes → 2 → All-brands calendar → 3 → Performance per PIC → 4 → Detail per PIC and brand → 5 → Trackers**

All data is for the selected month and comes from `content_targets` + `content_items` (Admin can read everything). All labels are in **English**.

### 9.1 Four summary boxes (styled like the owner's `dashboard-Reference` image)

The style to follow: dark boxes with a soft inner gradient and a subtle light edge on the top-left border. A sentence-case label is at top-left, a large mono number below it, a small secondary line under that, and an **illustration in the bottom-right corner**, tilted and partly cut off by the box edge, as in the reference. **Draw original SVG illustrations**; don't copy the reference artwork. Illustrations use the panel greys with a touch of the type or accent colour. The four boxes sit in one row (2×2 under 1,100px, stacked on mobile).

| Box | Big number | Secondary line (our parameters) | Illustration |
|---|---|---|---|
| Total target | e.g. 122 | ▶ 67 Reels · ▦ 55 Feed | stacked content cards |
| Uploaded | e.g. 98 | ▶ 50/67 Reels · ▦ 48/55 Feed | a phone with a play button and a feed grid |
| Remaining | e.g. 24 (or "+6 over") | 17 Reels · 7 Feed to go · 26 days left | an hourglass |
| Achievement | e.g. 80.3% | On pace / 3 behind pace / Done | **a real half-gauge drawn from the actual %** |

Don't add "vs last month" lines. The owner wants only the parameters this dashboard actually has.

### 9.2 All-brands calendar

- The same month grid as the tracker calendar (Mon-first, today ring, prev/next/Today, "+N more", No date list), but with **every brand's content**. It is synced to the dashboard month.
- Chip: type icon (▶ orange / grid violet) · brand short name · title, plus a status dot. Example: "▶ Beefix · Promo video".
- Filters: Tracker, Brand, PIC, Type, Status. Plus a legend.
- Clicking a chip opens the **same item drawer** (Admin can edit).

### 9.3 Performance per PIC (was "Ringkasan performa per PIC")

| PIC | Tracker | Target (▶ / ▦ / total) | Uploaded (▶ / ▦ / total) | Remaining | Achievement | Status |
|---|---|---|---|---|---|---|

- Achievement is shown as a number plus a thin progress bar, with the mix note as an icon and small text when relevant.
- There's a **Total** row at the bottom.
- Shows every active staff member with a target or uploads this month.
- Example row: "Ilyas · Behomy · 17 (▶17 / ▦0) · 17 · 0 · 100% · Done".

### 9.4 Detail per PIC and brand (was "Detail pelacakan konten per PIC & brand")

| Period | PIC | Brand | ▶ Target Reels | ▦ Target Feed | ▶ Uploaded Reels | ▦ Uploaded Feed | Total target | Total uploaded | Remaining | Achievement | Status & notes |
|---|---|---|---|---|---|---|---|---|---|---|---|

- **Period** = the month, e.g. "November 2026".
- Reels and Feed column headers carry their icon and colour, so types are obvious.
- **Status & notes:** Admin's own text, stored in `content_targets.note`. It's an inline text box that saves on blur ("Saved"). Rows without a target show "Set a target first" and are read-only.
- The mix note appears under Achievement when relevant. Rows with uploads but no target are included (§7). Items needing a PIC are summarised in one warning row.
- Sorted by tracker → PIC → brand, with a **Total** row. It scrolls horizontally on small screens, with sticky PIC and Brand columns.

### 9.5 Trackers

Move the existing tracker list here, to the bottom, unchanged except that it uses the new totals.

---

## 10. Admin Targets page (new sidebar item)

Admin sidebar order: **Dashboard · Targets · Trackers** (the list of the 4 trackers) **· People**.

```
Targets                          ‹ November 2026 ›     [Copy from October]
Total 122 · ▶ 67 Reels · ▦ 55 Feed

Behomy                                                     Subtotal 75
  Person  Brand          ▶ Reels  ▦ Feed  Total   Status & notes
  Arum    Behomy           [ 7]    [12]   [19]    [ ...........  ]   Clear
  Arum    Behomy Group     [ 0]    [ 5]   [ 5]    [              ]
  Arum    Corvel           [ 3]    [ 3]   [ 6]
  Arum    Hoteru           [  ]    [  ]   [  ]    (no target)
  ...
```

- A month switcher defaults to the current month.
- **"Copy from <previous month>"** fills Reels/Feed only into rows that are empty this month (not notes), after confirmation.
- Grouped by tracker, then person. Rows = each **active staff member × each brand in their tracker**. Behomy therefore has 3 people × 5 brands = 15 rows. Empty rows are dimmed.
- **Total always equals Reels + Feed.** Typing Reels or Feed updates Total. Typing Total sets Feed = Total − Reels; if Reels is bigger than Total, Reels becomes Total and Feed becomes 0. Only Reels and Feed are saved (`target_total` is generated).
- **Saves on blur** per row (upsert), with a "Saved" tick. "Clear" deletes the row after confirmation.
- Subtotals per tracker plus a grand total at the top, always with the Reels/Feed split.
- A person who left a tracker but still has targets this month appears read-only, marked "No longer in this tracker".
- Database errors show next to the row.

---

## 11. Acceptance checks for this update

- [ ] Logo shows in the sidebar, login and placeholders, and favicons appear on all three sites.
- [ ] No violet remains as accent; buttons, focus and links are green. Reels (▶ orange) and Feed (grid violet) are distinguishable everywhere, including without colour.
- [ ] No empty area beside the content at 1440px and 1920px. The table scrolls sideways with a visible scrollbar, and Content stays sticky.
- [ ] Sidebar: pin → hide → peek on the left edge, then pin again from the peek. Ctrl/Cmd+\\ works, the choice persists after reload, mobile uses a drawer, and reduced motion is respected.
- [ ] Banner: add, reposition, change and remove. A teammate sees changes live. A file over 5 MB or of the wrong type is refused with a clear message. Dika cannot load Behomy's banner.
- [ ] Admin adds content in Excel's tracker → PIC = Excel and it counts toward Excel. Admin adds content in Behomy → must choose a PIC. Staff can't change a PIC.
- [ ] Targets page: set Arum Behomy 7 Reels + 12 Feed → total 19. Staff cannot edit targets.
- [ ] Mix example: target 10+10, uploaded 14 Reels + 6 Feed → 100% with the explanatory note.
- [ ] Dashboard order is exactly: boxes → calendar → per PIC → detail → trackers. The calendar shows all brands, the notes save, and the totals match the Targets page.
- [ ] Behomy My work shows items where I am the PIC. Master's PIC filter works.
- [ ] Every number in the progress modules matches the Dashboard for the same person, brand and month.

## 12. Decisions to record in `07_DECISIONS_AND_OPEN_ITEMS.md`

Replace the old target and accent decisions with:
- Targets: Admin only, per person × brand × month, Reels + Feed, total = sum. Old targets were deleted when this update ran; the owner re-enters them.
- Each item has a PIC. Staff → themselves. Admin → the tracker's only person, or chosen in Behomy. Only Admin changes the PIC.
- The mix rule: the total counts, with an explanatory note when the type mix differs.
- Admin Dashboard and Targets page as described in §9 and §10. English labels. Notes are typed by Admin.
- Accent `#9ECD59` (Beyondcy green). Uploaded uses the same green. Reels are orange ▶ and Feed is violet grid.

**Defaults chosen by Claude because the owner didn't answer these. The owner may change them:**
- One banner per tracker (shared), with reposition.
- The ring chart is added **next to** the dot lanes, not replacing them.
- Display names were changed to Admin Beyondcy, Dika, Zaki, Arum, Ilyas, Anne (if `05_fix_display_names.sql` was run; otherwise edit them on the People page).
- Reels = orange, Feed = violet.
