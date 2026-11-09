# 03 · Design system (tracker + placeholders)

## The brief in the owner's words

> "I want the overall vibe of the tracker to be like this [the two references]. Make the 'dashboard' part more creative than the reference. Make it still appealing and easy to read, but I don't want it to be like a square template like AI usually builds. Make this unique but still appealing and useful."

**References** (in `references/`):
- `ref-1-dashboard-sidebar.jpg`: dark app shell, a left sidebar with logo, search, navigation and an active item on a raised pill, a greeting headline ("Good morning, Aman"), small stat cards with "+5 vs last month", and one bar highlighted in a bright accent among quiet grey bars.
- `ref-2-login-dot-grid.jpg`: split login. The left half is black with an evenly spaced grid of small coloured square dots; the right half is a dark form with small labels, underline-style inputs and a pill button.

**Take from them:** the dark, calm, layered greys; the sidebar shell; the greeting; one bright accent used only where it means something; the dot grid as a motif; underline inputs and pill buttons on login.

**Don't copy:** the grid of identical stat cards and the generic bar chart. That is exactly the "square template" the owner wants to avoid.

---

## 1. Concept: "the track"

The site is `track.beyondcy.co`. The team's month is a **track of dots**: one dot per post in the target. Posts that are uploaded fill in green, planned ones get a blue ring, and what's left stays a dim dot. The dot grid from the login reference becomes the main way progress is shown, so the motif means something instead of decorating. Everything else stays quiet and disciplined, so the track is the one memorable element.

## 2. Tokens

Define these as CSS custom properties in `styles/tokens.css`. The tracker is **dark only** in this release.

### Colour

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#131218` | Page background (graphite with a faint violet cast, tied to the brand colour) |
| `--panel` | `#1B1A21` | Sidebar, table surface, drawer |
| `--raised` | `#25242D` | Hovered rows, active nav pill, inputs |
| `--line` | `#2F2E39` | Hairlines and borders |
| `--text` | `#EEECF4` | Primary text |
| `--text-dim` | `#9A96AB` | Secondary text, labels |
| `--violet` | `#8F7CF7` | **Brand accent** (Beyondcy logo violet). Used for: today marker, pace marker, focus ring, primary button, active nav. **Replace with the exact hex from the official logo when the owner supplies it.** |
| `--status-not-started` | `#6F6C7D` | Grey |
| `--status-planned` | `#4D8DFF` | Blue |
| `--status-uploaded` | `#3FD69A` | Green (mint, echoing reference 2) |
| `--danger` | `#FF6B6B` | Errors, delete |

Status colours appear **only** for status, so people learn them fast. Text on a status-tinted background uses a lighter shade of the same hue, never plain white on a saturated fill.

### Type

- **Instrument Sans** (Google Fonts, weights 400/500/600) for all UI text and headings.
- **Martian Mono** (Google Fonts, 400/500) **only for numbers**: counts, dates, the clock, percentages. It makes figures line up, and turns the big progress numerals into a typographic feature. Don't use mono for labels or nav items.
- Fallbacks: `"Instrument Sans", system-ui, sans-serif` and `"Martian Mono", ui-monospace, monospace`.
- Scale (rem at 16px): 0.75 · 0.8125 · 0.875 (table body) · 1 · 1.25 · 1.75 (greeting) · 3.5 (progress numerals, mono).
- **Sentence case everywhere.** No all-caps labels or letter-spaced eyebrow text.

### Shape and space

- Radius has a hierarchy, not one value everywhere: app shell 20px, drawer/panels 14px, inputs and buttons 10px, chips and status pills fully round.
- Spacing scale: 4 · 8 · 12 · 16 · 24 · 32 · 48.
- Borders are 1px `--line`. **No drop shadows** on cards. Depth comes from the panel/raised/ink layering, as in reference 1.

---

## 3. App shell

```
┌───────────────┬────────────────────────────────────────────────────────────┐
│ ● beyondcy    │  Behomy · My work        ‹ November 2026 ›  Today   14:32:07 WIB │
│               │                                                            │
│ Tracker       │  Good afternoon, Arum                                      │
│ ▸ My work     │                                                            │
│   Master      │  ┌ the track ────────────────────────────────────────────┐ │
│               │  │  7 / 10      ●●●●●●●◎◎·  │ pace                        │ │
│               │  │  uploaded    On pace, 3 to go in 27 days             │ │
│               │  └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │  [+ New content]  search…  Status ▾  Type ▾  Brand ▾       │
│               │  ┌ table ─────────────────────────────────────────────────┐ │
│               │  │ Content │ Brand │ Status │ Type │ … │ Last edited │ 💬 │ │
│               │  └─────────────────────────────────────────────────────────┘ │
│               │                                                            │
│ ───────────── │  ┌ calendar ─────────────────────────┐ ┌ No date (3) ─┐   │
│ Arum          │  │ Mon Tue Wed Thu Fri Sat Sun        │ │ …            │   │
│ Behomy · Sign out │                                   │ └──────────────┘   │
└───────────────┴────────────────────────────────────────────────────────────┘
```

- Sidebar (from reference 1): wordmark/logo at top, then the role's pages; the active page sits on a `--raised` pill with a 2px violet marker. Admin also gets the tracker switcher and People. The footer shows the person's name and role and a Sign out link. The sidebar collapses to an icon rail at ≤1100px and becomes a top bar with a menu at ≤720px.
- The header row holds the page title, the **shared month switcher**, a Today button and the **live WIB clock** (mono).
- The greeting sits in a large size under the header, as in reference 1. Keep it to one line.
- Content is **left-aligned**. Max content width is around 1400px.

---

## 4. The track (signature progress module)

This is where the creativity goes. It is **not** a row of stat cards. It's one wide, low band.

```
 7 / 10                        ● ● ● ● ● ● ● ◎ ◎ ·          ← one dot per target post
 uploaded this month                         ┊ pace          ← violet tick where you should be today
 On pace, 3 to go in 27 days     ● Uploaded 7   ◎ Planned 2   · Not started 1   No date 3
```

**Anatomy**
- **Numerals:** "7 / 10" in Martian Mono at 3.5rem. The "7" is in `--text` and "/ 10" in `--text-dim`. Below: "uploaded this month". If over target: "30 / 25", with "120%" in violet.
- **Dots:** one dot per unit of target, in order: uploaded (filled green) first, then planned (blue ring, i.e. hollow with a blue stroke), then remaining (small dim grey dot). Dots wrap to new rows; on desktop, max about 25 per row. If the count exceeds the target, extra dots continue after a small gap, filled **violet** (bonus).
- **Pace marker** (current month only): a thin violet vertical tick at the dot position where the person should be today, labelled "pace" in tiny dim text.
- **Status sentence:** one line in plain words: "On pace, 3 to go in 27 days" / "3 behind pace, 15 to go in 18 days" / "Target reached". Never vague.
- **Legend counts:** Uploaded, Planned, Not started (this month), and No date (all). The symbols in the legend match the dots, so meaning never relies on colour alone.
- **No target:** the dot row is replaced by a dashed outline row with "No target set for November yet. Admin Beyondcy sets targets." Admin sees "Set target" instead.

**Multiple lanes** (Excel's Master, Behomy Master): stack one lane per brand or person. Each lane is a name on the left, its dots, and "uploaded / target" on the right in mono. Above the lanes, the big numerals show the **total**. Lanes share a horizontal scale, so they can be compared at a glance.

```
 22 / 27   uploaded · Behomy team                 On pace
 Arum     ● ● ● ● ● ● ● ● ◎ ·            8 / 10
 Ilyas    ● ● ● ● ● ● ◎ ◎ ·              6 / 9
 Anne     ● ● ● ● ● ● ● ● ●               8 / 8   reached
 By brand   Behomy 9  ·  Behomy Group 4  ·  Corvel 3  ·  Hoteru 4  ·  Purnava 2
```

For the per-brand line, use small proportional segments in one hue at stepped opacities, with labels and numbers. Don't add new colours.

**Behomy My work:** one lane for the person, plus a quiet one-liner: "Team: 22 / 27".

**Motion** (the single orchestrated moment): on page load, the dots fill in sequence with a GSAP stagger, about 600ms in total. When an item becomes Uploaded, the next dot fills with one short pulse, which is a response to the user's action. Nothing else animates on its own. Under `prefers-reduced-motion`, everything renders final with no animation.

**Accessibility:** the dot row has `role="img"` and an `aria-label` like "7 of 10 uploaded, 2 planned, 1 not started, on pace". Dots are decorative inside it.

---

## 5. Components

- **Status pill:** fully round, with a tinted background of the status hue (about 16% opacity), text in the light shade of the same hue, and a 6px dot before the label. Labels: "Not started", "Planned", "Uploaded".
- **Table:** sits on `--panel` with a sticky header in `--text-dim` at 0.8125rem. Row height 48px, with hairline row dividers and a `--raised` hover. Status is the first thing the eye finds. No zebra striping.
- **Drawer:** 560px wide from the right, on `--panel`, with a 14px radius on the left corners. Labels sit above the fields in `--text-dim`. Inputs: `--raised` fill with a 10px radius, and a violet focus ring. The missing-fields checklist uses small status-grey dots that turn green as fields are filled.
- **Content pillar chips** (Homy8): toggle chips. When selected, they get a violet outline and light violet text.
- **Calendar:** the day grid uses hairlines, not boxes. Today's date number gets a violet ring. Chips are compact pills: a status dot, then type, then a truncated name. "+N more" is in dim text.
- **Buttons:** primary is a violet pill with dark text (as in reference 2). Secondary is a `--raised` pill. Destructive actions use danger-coloured text and always confirm.
- **Empty states give direction:** "No content planned for November yet. Add the first one with New content."
- **Copy:** plain verbs, sentence case. Action names stay consistent: "New content" creates, "Comment" posts, "Delete content" deletes and the toast says "Content deleted".

## 6. Login (from reference 2)

```
┌──────────────────────────┬───────────────────────────────┐
│ · · · · · · · · · · · ·   │  beyondcy                      │
│ · · ● · · · ◎ · · · · ·   │                                │
│ · · · · · · · · ● · · ·   │  Sign in to the tracker        │
│ · ● · · · · · · · · · ·   │  Email                         │
│ · · · · ◎ · · · · · · ·   │  ______________________        │
│ · · · · · · · · · · · ·   │  Password                      │
│                           │  ______________________        │
│                           │  Forgot password?   ( Sign in )│
└──────────────────────────┴───────────────────────────────┘
```
- Left: a black field with a dot grid in dim violet. A handful of dots are filled in the three status colours, like a tiny track: the same language as the app.
- Right: a form with underline inputs and the violet pill button. **No sign-up link.**
- On mobile, the dot panel shrinks to a short band above the form.

## 7. Before shipping, check against the brief

- Does any screen read as a grid of identical rounded cards? If yes, redesign it.
- Is violet used only where it means something (accent, today, pace, focus, primary action)?
- Can someone tell Uploaded / Planned / Not started apart without colour (filled / ring / small dot, plus labels)?
- Is mono used only for numbers?
- Take screenshots at 1440px, 1024px and 390px, and review them before calling it done.
