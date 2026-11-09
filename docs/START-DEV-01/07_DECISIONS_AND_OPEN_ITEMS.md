# 07 · Decisions and open items

This file records everything the owner has decided so far (including the dashboard, which is built later), the assumptions made to fill gaps, and what is still open. **If you change something listed here, update this file.**

## Tracker: decided by the owner

- The tracker and the dashboard are **completely separate**. The tracker is manual input by the Beyondcy team. The dashboard is Meta API data plus manual input by Admin.
- **Fields:** Content, Type (Feed/Reels), Brief, Caption, Notes, Publish Date, Reference, Uploaded content (the Instagram link). There is no content-file link. "Category" on the old whiteboard was a mistake; it means Type.
- **Status:** Not Started (grey) until every field is filled → Planned (blue) → Uploaded (green) only once the Instagram link is added. The link is locked until every field is filled.
- **Homy8 only:** Content Pillar column, multi-select (Design, Education, Portfolio, Interview, Comedy), filled by staff, and required for Planned.
- **Roles (hard lock):** Admin; Lahap & Kedai Makmoer 88 (Excel); Beefix (Dika); Homy8 (Zaki); Behomy (Arum, Ilyas, Anne). Access belongs to the role so people can rotate brands.
- **Excel:** a Master table with a Brand column, plus separate Lahap and Makmoer pages.
- **Behomy:** one combined list with a Brand column (Behomy, Behomy Group, Corvel, Hoteru, Purnava). Each person lands on My work (their own items) and can open Master (everyone's items plus light stats). The owner of an item = the person who created it.
- **Admin Beyondcy:** one account, one person. Chooses a tracker after login, sees the staff layout, and every edit is traced.
- **Login:** email + password. A display name is shown in the UI.
- **Progress module:** monthly targets set by **Admin only**. Excel has one target per brand with a total; Behomy has one per person with a team total. Done = Uploaded. An item counts in the month of its Publish Date. Each month starts empty, and past months stay viewable.
- **Comments:** yes, with no notifications and a count on each row. **Production cost:** no. **Board view:** no.
- **Calendar:** below the table, current month, today highlighted, live clock, items on their publish date (name + type), a No date list, and previous/next/today.
- **Notion data:** the owner migrates it manually. No import tool.
- **Sites:** `beyondcy.co` and `dash.beyondcy.co` are "Stay tuned" for now; `track.beyondcy.co` is the priority.
- **Design:** the dark vibe of the two references, with a more creative, non-template progress area.

## Assumptions made to fill gaps (owner: confirm or correct)

1. **Admin sets each Behomy person's individual target.** Staff can't edit targets, even their own. (The owner said both "let them edit their own goals" and "only Admin can change the target"; this reading was chosen.)
2. Teammates can **edit** each other's items (like Notion), but only the **owner or Admin can delete**.
3. Reference is one text field holding one or more links, one per line.
4. Behomy items created by Admin count toward the team total but not toward any person's lane.
5. Table month scope: the selected month plus undated items, with a "Show all months" toggle.
6. Clicking an empty calendar day starts a new item on that date.
7. The UI language is English. Greetings switch at 11:00 and 18:00 WIB.
8. The accent colour `#8F7CF7` approximates the Beyondcy logo violet until the real logo file arrives.
9. The placeholder copy in `05` is a draft.
10. The pillar is spelled "Portfolio" (written "Portofolio" in the owner's message).

## Tracker: still open

- [ ] Beyondcy logo file (SVG preferred) and the exact brand colour hex
- [ ] Final tracker visuals: the owner may send more UI direction later
- [ ] Real emails for the 7 accounts (for `03_assign_users.sql`)
- [ ] Supabase Pro plan and custom SMTP before go-live
- [ ] DNS access for beyondcy.co, and checking that company email and the old server aren't affected

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
