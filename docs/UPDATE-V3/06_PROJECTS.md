# 06 · Projects (new Admin page)

Projects are **one-off jobs** Admin assigns to one or more staff members, separate from the regular monthly content. A project has a name, a description, a **deadline** and the assigned staff. Assigned staff see it in their calendar and open it in a **centred popup**.

## Sidebar

Admin sidebar order: **Dashboard · Targets · Projects · Trackers · People**.

## Who can do what (enforced by the database)

| Action | Admin | Assigned staff | Other staff |
|---|---|---|---|
| See the project | ✓ all | ✓ their own | ✗ invisible |
| Create / edit / delete | ✓ | ✗ | ✗ |
| Assign / unassign staff | ✓ | ✗ | ✗ |
| Mark done / reopen | ✓ | ✓ | ✗ |
| Move the deadline (drag or edit) | ✓ | ✗ | ✗ |

Only **active staff** can be assigned (not Admin, and they must have a tracker). Any staff member from any tracker can be assigned.

## Projects page (Admin)

- **New project** button, which opens a **centred dialog**:
  - **Project name** (required, max 200 characters)
  - **Description**: multi-line plain text. Links are clickable when viewed and line breaks are kept.
  - **Deadline**: date (required)
  - **Assign staff**: a multi-select showing **photo + display name**, grouped by tracker (e.g. "Behomy: Arum, Ilyas, Anne"), with search. At least one person is required.
  - Save / Cancel
- **The list:** one row per project, showing:
  - name
  - deadline (with "in 3 days" / "today" / "2 days overdue")
  - **assigned staff as photos + names** (a photo stack with names on hover if there are many)
  - status (Open / Done)
  - Edit · Delete (with confirmation)

  Sections or tabs: **Upcoming**, **Overdue** (open, deadline passed) and **Done**. Upcoming is sorted by nearest deadline.
- Edit opens the same dialog. When the assignees change, add and remove the differences.
- Realtime: the list updates if a staff member marks a project done.

## In the calendars

- A project appears on its **deadline date**:
  - in the tracker calendars of **each assigned staff member** (all pages of their tracker)
  - in the Admin Dashboard's all-brands calendar
  - when Admin opens a tracker, its people's projects
- **The chip looks different from content chips**, so nobody confuses them: e.g. an outlined chip with a flag/briefcase icon, "Project ·" and the name, plus small assignee photos when there's room. **Done projects** look dimmed with a check mark.
- **Clicking the chip** opens the project popup (below).
- Only Admin can drag a project to another date (file 05 §3).
- Projects also appear in the **This-week reminder** (file 05 §2) and in its Overdue group.

## Project popup (Admin and staff)

A **centred modal dialog**, **not** the right-side drawer used for content. It has a dimmed backdrop and closes with Esc, the close button, or clicking outside. Contents:
- **Project name** (large)
- **Deadline** with a relative hint ("in 3 days", "overdue by 2 days")
- **Status** (Open / Done). When done: "Done by Dika · 12 Nov".
- **Description** in full, readable (comfortable line length, links clickable)
- **Assigned:** each person's **photo + display name**, clearly listed
- "Created by Admin Beyondcy · 10 Nov"
- Buttons:
  - **Mark as done** / **Reopen**, for assigned staff and Admin
  - **Edit** and **Delete**, for Admin only

Accessibility: focus moves into the dialog and is kept inside it while open, with `role="dialog"` and `aria-modal`. On mobile it becomes a full-screen sheet.

## Data (see file 07 for queries)

- `projects`: `id, name, description, due_date, status ('open' | 'done'), completed_at, completed_by_name, created_by_name, created_at, updated_at, updated_by_name`
- `project_assignees`: `project_id, profile_id`
- Names and photos come from the `people` view (file 03).
- When staff update a project, the database ignores every change except `status`.
- History goes to `activity_log` with `role_id = 'projects'` (Admin can read it). The actions are `project_created`, `project_updated`, `project_completed`, `project_reopened` and `project_deleted`. An optional "History" section in the popup for Admin is a nice-to-have.

## Done when

- [ ] Admin creates a project with 2 assignees from different trackers. It appears on the deadline in both people's calendars, in their reminders (if due this week), and on the Admin calendar.
- [ ] A staff member who isn't assigned can't see it anywhere.
- [ ] An assigned staff member opens the popup, reads everything, sees both assignees with photos, and marks it done. Admin sees it as done right away.
- [ ] Staff can't edit, delete, drag or reassign. Admin can do all of these.
