# 02 · Tracker spec (track.beyondcy.co)

The tracker replaces the team's scattered Notion content plans with one central system. Each staff member plans content for the brand(s) they hold, at about 25–75 posts per brand per month. **The tracker is fully manual and has no connection to the marketing dashboard or the Meta API.**

---

## 1. People, roles and access

Access is attached to a **role**, not to a person. A role = access to one tracker. When someone moves to another brand, Admin changes their role, and their access changes with it. This is a **hard lock**: a person can never open another tracker, and the database enforces it.

| Role (`roles.id`) | Layout | Brands in it | Person (now) |
|---|---|---|---|
| `admin` | — | all trackers | Admin Beyondcy |
| `lahap_makmoer` | `multi_brand` | Lahap, Kedai Makmoer 88 | Excel |
| `beefix` | `single` | Beefix | Dika |
| `homy8` | `single` | Homy8 | Zaki |
| `behomy` | `team` | Behomy, Behomy Group, Corvel, Hoteru, Purnava | Arum, Ilyas, Anne |

- **Login is by email + password.** Everywhere in the UI, show the person's **display name** (e.g. "Dika", "Admin Beyondcy"), never their email.
- Admin Beyondcy is one account used by one person.

### What each person sees after login

| Who | Lands on | Navigation |
|---|---|---|
| Dika / Zaki (`single`) | Their brand's tracker | Just that page |
| Excel (`multi_brand`) | **Master** (Lahap + Makmoer) | Master · Lahap · Kedai Makmoer 88 |
| Arum / Ilyas / Anne (`team`) | **My work** (only items they created) | My work · Master (all Behomy items + team stats) |
| Admin Beyondcy | **Choose a tracker** screen | After choosing: the same pages that tracker's staff see, plus a tracker switcher, target editing and **People** |

Every tracker page has the same three stacked parts:
1. **Progress module**: the target and what has been achieved (section 4)
2. **Content table** (section 2)
3. **Calendar** (section 6)

Suggested routes: `/login`, `/reset-password`, `/` (redirects by role), `/t/:roleId` (main page), `/t/:roleId/brand/:brandId` (Excel's per-brand pages), `/t/:roleId/master` (Behomy master), `/admin/people`. Routes are convenience only; RLS decides what data loads.

---

## 2. Content table

### Fields (in this order)

| Column | DB column | Input | Rules |
|---|---|---|---|
| Content | `content` | text (title) | required |
| Brand | `brand_id` | dropdown | **Only on master tables.** Excel's Master: Lahap / Kedai Makmoer 88. Behomy (both pages): Behomy / Behomy Group / Corvel / Hoteru / Purnava. On single-brand pages, it is set automatically and hidden. |
| Status | `status` | read-only pill | automatic (section 3) |
| Type | `type` | dropdown: Feed / Reels | required. DB values `feed` / `reels`. |
| Brief | `brief` | long text | required |
| Caption | `caption` | long text | required |
| Notes | `notes` | long text | required |
| Publish Date | `publish_date` | date picker | required for "Planned". Can be empty while drafting; then the item sits in the calendar's **No date** list. |
| Reference | `reference` | long text, one link per line | required. Usually Pinterest or Google Maps links; render each line as a clickable link. |
| Content Pillar | `content_pillars` | **multi-select chips**: Design, Education, Portfolio, Interview, Comedy | **Homy8 only.** Required there (at least one). Hidden for every other brand. Load the options from `brand_pillars`, not hard-coded. |
| Uploaded content | `instagram_url` | URL | The Instagram post link, added after posting. **Locked until every field above is filled** (section 3). Must be an `instagram.com` link. |
| Owner | `owner_id` | read-only | Shown on the **Behomy Master** only (whose work it is). |
| Last edited | `updated_by_name`, `updated_at` | read-only | "Edited by Arum · 3 min ago", relative time updating live |
| Comments | count | read-only | Small count badge, e.g. 2 |

There is **no** content-file/Drive link field. The owner removed it.

### Table behaviour

- **New content** button: creates a row in the current tracker (and the current brand page, if any), then opens the item drawer. On master tables, ask for Brand first (a small inline choice) because the database needs it.
- Clicking a row opens the **item drawer** on the right (section 5). Quick inline editing in the table is allowed for Type and Publish Date only; everything else is edited in the drawer.
- Long text cells show one truncated line.
- **Filters:** search (content/caption), Status, Type, Brand (master tables), Owner (Behomy Master). **Sort** by Publish Date ascending by default, with no-date items last.
- **Month scope:** the table shows items whose Publish Date falls in the selected month, plus all no-date items (marked "No date"). A toggle "Show all months" lists everything.
- **Delete:** allowed for the item's **owner** or **Admin** (enforced by the database). Always confirm first. Teammates cannot delete each other's items; hide the action for them.
- Deleted items stay recoverable in `activity_log` (a full copy of the row). No restore UI is needed now.
- Expected volume: up to roughly 600 rows a month across all trackers. Client-side filtering is fine, with no pagination needed in this release.

---

## 3. Status rules (calculated by the database)

| Status | Colour | When |
|---|---|---|
| **Not Started** | Grey | Any required field is empty |
| **Planned** | Blue | Every required field is filled (Content, Type, Brief, Caption, Notes, Publish Date, Reference, and for Homy8 also Content Pillar), and there is no Instagram link yet |
| **Uploaded** | Green | Every required field is filled **and** the Instagram link is added. Uploaded = done. |

- The database recalculates status on every save and returns the fresh row. The app just displays `status`.
- `missing_fields` (returned by the DB) lists what is still empty. DB names map to labels: `content` Content, `type` Type, `brief` Brief, `caption` Caption, `notes` Notes, `publish_date` Publish date, `reference` Reference, `content_pillars` Content pillar.
- **Instagram link lock:** while `missing_fields` is not empty, the Uploaded content input is **disabled**, with the hint "Fill in Notes and Reference first" (naming the actual missing fields). The database enforces this too.
- On an Uploaded item, **no required field can be emptied**. The database refuses and the drawer shows its message. To "un-upload", the user removes the link first.

---

## 4. Progress module (top of every tracker page)

A compact area showing the month's **content target** and progress toward it. It is the signature visual of the tracker; see `03_DESIGN_SYSTEM.md` §4 for the design.

### Targets

- Targets are **monthly** and set by **Admin only** (via the `set_monthly_target` function). Staff can see their target but not edit it.
- Each month starts with no target. Past months keep their targets and results, viewable through the month switcher.
- What a target is attached to:

| Layout | Target per month | Total shown |
|---|---|---|
| `single` (Beefix, Homy8) | one, for the brand | that number |
| `multi_brand` (Excel) | **one per brand**, e.g. Makmoer 12 + Lahap 13 | Master shows each brand's lane **plus the total (25)**. Each brand page shows its own lane. |
| `team` (Behomy) | **one per person** (Arum, Ilyas, Anne) | My work shows the person's own lane (plus a one-line team total). Master shows all three lanes **plus the Behomy team total**. |

- With no target set, staff see "No target set for November yet. Admin Beyondcy sets targets." Admin sees a "Set target" control in the same place.

### What counts

- An item counts toward the month of its **Publish Date**. Items without a date don't count.
- **Done = Uploaded** (Instagram link added). Only Uploaded items move the target forward.
- **Planned** items are shown separately ("ready, not posted yet") so people see what's coming.
- Counting scope:
  - `single` / `multi_brand` lanes count **all items of that brand** in the tracker, whoever created them.
  - `team` lanes count items **owned by that person**. The team total = the sum of the people's lanes. Items Admin created in the Behomy tracker count only in the team totals on Master, not in any person's lane.
- **Over target** is allowed: show it like "30 / 25 · 120%".
- **Pace** (current month only): expected uploaded by today = target × (today's day of month ÷ days in month), rounded. Show one plain sentence: "On pace, 3 to go in 27 days", "3 behind pace, 15 to go in 18 days", or "Target reached". Past months show the final result; future months show no pace.

### Behomy Master: small extra stats

Next to or under the lanes, keep it light:
- **Team:** total Uploaded / team target and %, plus counts of Planned and Not Started
- **Per person:** each person's Uploaded / target (these are the lanes themselves)
- **Per brand:** how many items were uploaded this month for Behomy, Behomy Group, Corvel, Hoteru and Purnava

Put the calculations in pure functions (`src/lib/progress.js`) with unit tests.

---

## 5. Item drawer

Opens from the right (full screen on mobile). It has three tabs or sections: **Details**, **Comments**, **History**.

**Details**
- All fields from section 2, editable for anyone with access to the tracker (teammates can edit each other's items, as in Notion).
- **Save on blur** for text fields and immediately for dropdowns, dates and chips. **Never save on every keystroke**, because each save writes a history entry. Show a quiet saved state: "Saved · Edited by you just now".
- A small checklist shows what's still missing for "Planned" (from `missing_fields`).
- The Instagram link input follows the lock rule in §3.
- Show any database error message right next to the field it concerns.
- Footer: "Created by Arum on 3 Nov 2026" and the Delete action (owner/Admin only).

**Comments**
- A thread: name, relative time, text. Newest at the bottom. A text box with a "Comment" button.
- Authors can delete their own comments, and Admin can delete any. There is no editing.
- **No notifications.** The comment count shows on the table row.

**History**
- From `activity_log` for this item, newest first: "Admin Beyondcy changed Caption · 2 h ago", "Dika added the Instagram link · yesterday", "Arum created this item".
- Expandable old → new values. For long text, show a short preview of both.

**Live updates:** if a teammate changes the open item, refresh the fields the user isn't currently editing. If the field being edited changed remotely, show "Arum just changed Caption. Load their version?" Never silently overwrite the user's typing.

---

## 6. Calendar (below the table)

- A month grid with weeks starting **Monday**, synced to the real current date in WIB. **Today is highlighted.**
- A **live clock** (WIB, updates every second) sits in the page header, e.g. "Tue 3 Nov · 14:32:07 WIB".
- Navigation: previous / next / **Today**. The calendar month and the progress module month are **one shared month state**.
- Each item appears on its Publish Date as a short chip: **type + content name**, e.g. "Reels · Promo video", with its status colour as a small marker.
- Show up to 3 chips per day, then "+N more" (opens a popover with the full list). On master pages a day can hold 20+ items, so this must stay tidy.
- **No date (N):** a list beside the grid (below it on mobile) of items without a Publish Date.
- Clicking a chip opens the item drawer. Clicking an empty day opens "New content" with that date filled in.
- The calendar shows the same items as the page it's on: My work → mine, Master → all, Lahap page → Lahap.

---

## 7. Admin

- **Choose a tracker** (landing page): one row per tracker with its name, people, and a mini progress line for the current month. Clicking a row opens that tracker.
- Inside a tracker, Admin sees exactly what the staff see, plus:
  - **Set target** controls on each lane (calls `set_monthly_target`; empty input = remove target)
  - A tracker switcher in the sidebar
- Admin's edits are recorded like anyone's, appearing as "Admin Beyondcy" in history and "Last edited".
- **People** page (`/admin/people`): list of everyone with display name (editable), email (read-only), role (dropdown) and active (toggle). Changing a role is how "rolling" brands works. Warn before Admin changes their own role.
  - New accounts are created by the owner in the **Supabase dashboard** (`06` explains how). New people appear here automatically, without a role, until Admin assigns one.

---

## 8. Login and account

- Login page: email, password, "Sign in", "Forgot password?". **No sign-up.**
- Forgot password → Supabase reset email → `/reset-password` page to set a new password.
- Errors are specific: "Email or password is incorrect.", "Your account is inactive. Ask Admin Beyondcy."
- Sidebar footer: display name, role name, Sign out.
- Greeting in the header uses WIB time: "Good morning, Dika" (04:00–10:59), "Good afternoon, Dika" (11:00–17:59), "Good evening, Dika" (18:00–03:59).
