# 05 · Tracker pages: boxes, this-week reminder, draggable calendar, status board

These changes apply to **every tracker page**: Dika's and Zaki's pages, Excel's Master and brand pages, Behomy's My work and Master, and the same pages when Admin opens a tracker.

New order of a tracker page, top to bottom:

1. Banner (if set)
2. Greeting ("Good afternoon, Arum")
3. **Four summary boxes** (NEW, §1)
4. Progress module (big "0 / 71", ring, legend), with the **This-week reminder** (NEW, §2) in the empty right-hand area
5. Lanes
6. Content table
7. **Calendar**, now draggable (§3)
8. **Status board** (NEW, §4)

**Scope rule:** every new section on a page uses the **same items as that page**:
- **My work** (Behomy): items where I'm the PIC
- **Master**: everything in that tracker
- **Excel's brand pages**: that brand only
- **Dika / Zaki**: their tracker

---

## 1. Four summary boxes (between greeting and progress module)

Reference: `references/new-4DATA.png`. Add the **same four boxes as the Admin Dashboard**: Total target, Uploaded, Remaining, Achievement. Use the shared component, including the bigger numbers and illustrations from file 04 §1.

- The values use the page's scope and the selected month, with the same calculation rules as the progress module (`src/lib/progress.js`). The two must always agree.
- **Keep the big progress module below as it is.** The owner wants both: the boxes give the quick overview, and the module gives the detail.
- The "Remaining" box's "days left" and the Achievement box's pace use the same pace logic.

## 2. This-week reminder (right side of the progress module)

Reference: `references/this-week-reminder.png`, the blue rectangle to the right of the legend.

**What it must contain:**
- **A personal line using the viewer's display name.** Draft copy, which you may polish:
  - My work / single-person trackers: *"Hi Dika, here's what to finish before the week ends."*
  - Master (team): *"Hi Arum, here's what the Behomy team still has this week."*
  - Admin viewing a tracker: *"Hi Admin Beyondcy, here's what's still open in Beefix this week."*
- **The week:** Monday–Sunday of the **current** week (WIB), labelled e.g. "This week · 9–15 Nov". It covers exactly one week, even across a month boundary.
- **The list:** this week's content with status **Not started** or **Planned** only. **Uploaded items never appear.** Each row shows:
  - day (e.g. "Wed 11")
  - Reels/Feed icon and title
  - status (Not started / Planned)
  - brand (on multi-brand pages)
  - PIC photo (on team pages)

  Sort by date, then Not started before Planned. Today's items are highlighted, and past days still open stand out.
- **Projects due this week** that are still open (file 06), for the people on this page:
  - the viewer's own projects on My work and single-person pages
  - team members' projects on Master
  - for Admin, the projects of that tracker's people

  Mark them clearly as projects (project icon, label "Project").
- **Overdue (default chosen by Claude):** items from **before** this week that are still Not started or Planned go in a small "Overdue" group at the top, in a warning tone. Projects past their deadline and still open go here too.
- **A small counter**, e.g. "4 to go".
- **Clicking a row** opens the item drawer; clicking a project opens its popup (file 06).

**Empty and finished states (make these feel good):**
- **Nothing scheduled this week:** e.g. *"Nothing planned for this week yet."* with a quiet hint to add content in the calendar.
- **There was content this week, all uploaded:** e.g. *"All done for this week. Everything is uploaded."* This should feel like a small win (a check mark, the brand green).
- Overdue items still show even when this week is otherwise empty or done.

**It's linked to the calendar and table:** it updates immediately when an item is moved (§3), filled in, or uploaded, and live when a teammate changes something (realtime).

**Layout:** it must fit the progress module's height. If the list is long, it scrolls inside, or shows the first ~6 rows plus "+N more", which scrolls to the calendar and highlights this week. On narrow screens it moves below the legend at full width.

**Design:** full creative freedom within the existing design language. It should read in two seconds: who it's for, how many are left, and which is next.

## 3. Drag content in the calendar to change its date

Reference: `references/draggable-content-in-calender.png`. Dragging the Beefix item from Tue 3 to Wed 4 (or Wed 11) **changes its Publish date** to that day.

**Who and what:**
- Staff can drag items in their own tracker's calendars. Admin can drag in every calendar, including the Dashboard's all-brands calendar.
- **Draggable:** content that is **Not started** or **Planned**.
- **Locked:** **Uploaded** content. It shows a not-allowed cursor and the tooltip "Uploaded content can't be moved".
- **Projects:** only Admin can drag them (it changes the deadline). For staff, project chips aren't draggable.

**Drop targets:**
- any day of the visible month
- the **"No date"** list: removes the date. The item becomes Not started automatically, because a date is required for Planned. Say this in the toast.
- dragging **from** "No date" onto a day sets that date
- items in the "+N more" popover are draggable too
- dropping on the same day does nothing
- to move to another month, use the date field in the drawer. Optional nice-to-have: hovering over the ‹ › month arrows while dragging switches the month.

**Feedback:**
- While dragging: a lifted chip, and the target day highlighted.
- On drop: the chip moves instantly (optimistic update), then saves with `update({ publish_date })`.
- **Toast at the bottom:** e.g. *"Moved "Deep Clean E…" to Wed, 4 Nov"*, with an **Undo** button (about 8 seconds). Undo puts the old date back.
  - For projects: *"Project deadline moved to Fri, 20 Nov"*.
  - For No date: *"Removed the date from "…". It's back to Not started."*
- **If saving fails:** move the chip back and show the database's message in the toast.
- Everything else follows immediately: table, progress numbers, boxes, reminder and status board. History records the change (the database does this).

**Implementation:**
- Use a well-maintained drag-and-drop library that supports mouse, touch and keyboard, e.g. `@dnd-kit/core`.
- Touch: long-press (about 250ms) to start dragging, so normal scrolling still works.
- Keyboard users can still change dates in the drawer.
- Respect reduced motion.

## 4. Status board (below the calendar)

Reference: `references/board-references.jpg` (a kanban board). **Display only**: it shows where every piece of content stands.

**Columns:** **Not started** (grey) · **Planned** (blue) · **Uploaded** (green). Each column header has:
- the colour marker and name
- a **big count** of all content in the column (Reels and Feed both count as content)
- **below it, the split**: "▶ 4 Reels · ▦ 3 Feed"

**Cards (one per content item):**
- brand (on multi-brand pages)
- **title**
- Reels/Feed icon and label
- **PIC photo + name** (file 03)
- publish date (or "No date")
- Not started cards: how many fields are missing (e.g. "3 fields left")
- comment count, if any
- Uploaded cards: a small link icon to the Instagram post
- an **"Overdue"** tag when the date has passed and the item isn't uploaded

**Behaviour:**
- **No dragging between columns.** Status changes by itself when fields and the Instagram link are filled.
- **Clicking a card** opens the item drawer.
- Shows the **same items as the table on that page** (same month scope, same filters), sorted by publish date (no-date items last).
- Long columns scroll inside, or show the first ~8 cards plus "Show all".
- Updates live (realtime), like the table.
- On mobile, the columns scroll sideways.

**Extras you may add if they stay simple:** a small per-column progress hint (e.g. Uploaded vs this month's target), or a "Mine only" toggle on team Master pages.
