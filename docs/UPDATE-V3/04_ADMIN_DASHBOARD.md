# 04 · Admin Dashboard changes

New order of the Admin Dashboard, top to bottom:

1. Greeting + month switcher
2. **Four summary boxes**: bigger numbers and illustrations (§1)
3. **Brand cards**: NEW, 9 cards (§2)
4. **All-brands calendar**: now draggable and showing projects (§3)
5. Performance per PIC (now with photos, file 03)
6. Detail per PIC and brand (now with photos)
7. Trackers

The four boxes are **one shared component**. The same component is also added to every tracker page (file 05), so §1 applies there too.

---

## 1. Bigger numbers and illustrations in the four boxes

Reference: `references/make-bigger.png`. The owner circled the **big numbers** and the **illustrations**.

- **The boxes stay exactly the same size.** Don't change their height or width; the content inside gets bigger.
- **Big numbers** (137 / 0 / 137 / 0%):
  - clearly bigger, roughly 1.5× the current size (around `clamp(3.5rem, 4.5vw, 5.25rem)`, tuned so the longest realistic value, e.g. "1,250" or "100%", still fits)
  - **bolder**: Martian Mono at its heaviest available weight (800)
  - keep the label above and the Reels/Feed line below readable. Shrink spacing, not text.
- **Illustrations** (stacked cards, phone, hourglass, gauge):
  - **much bigger**, roughly 1.8–2× the current size
  - still anchored to the **bottom-right corner**, partly cut off by the box edge, as now
  - make sure they **never sit on top of the number or the text line**. Place the illustration behind the text (lower layer) and keep the text column clear. Check with long values like "1,250".
  - the Achievement gauge stays a real gauge showing the actual percentage.
- Check at 1440px, 1920px and 1024px (2×2 layout), and on mobile (stacked).

## 2. Brand cards (NEW, Admin Dashboard only)

Reference: `references/brand-display-references.jpg`. Dark cards, each with a soft **glow in that brand's colour** from one corner, a faint large logo or shape in the background, a small logo, and the title. **Recreate the style; don't copy the reference's content.** The design itself is up to you, within these rules:

**Cards and order**: 9 cards, **all exactly the same size**, in this order left to right:

> Behomy · Behomy Group · Homy8 · Beefix · Purnava · Hoteru · Corvel · Kedai Makmoer 88 · Lahap

- One row on wide screens. On narrower screens the row **scrolls sideways**, and the cards keep their size.
- Square-ish proportions.

**Text on each card: only these two things:**
1. **The brand name**
2. **Total content uploaded for that brand in the month selected** on the Dashboard: the number, big and in Martian Mono, with at most a short label like "uploaded". Reels and Feed both count.

No descriptions, toggles or links like in the reference.

**Data**: count `content_items` with `status = 'uploaded'`, that `brand_id`, and `publish_date` in the selected month. It updates live with the rest of the Dashboard.

**Clicking a card** opens that brand's tracker page:

| Card | Opens |
|---|---|
| Lahap | Lahap page of the `lahap_makmoer` tracker |
| Kedai Makmoer 88 | Kedai Makmoer 88 page of the `lahap_makmoer` tracker |
| Beefix | `beefix` tracker |
| Homy8 | `homy8` tracker |
| Behomy, Behomy Group, Corvel, Hoteru, Purnava | Behomy **Master**, with the Brand filter set to that brand |

### Choosing the logos

The owner put all logos in `Beyondcy-Web\tracker-brand-logo\`. It has one sub-folder per brand, each with many logo versions. **You choose the best one per brand.**

1. **Map the folders to the 9 brands.** Folder names may differ, e.g. "Homyeight", "KDM", "LAHAP". If a brand has no folder, or it's unclear which folder is which, ask the owner.
2. **Pick one logo per brand** using these criteria, in order:
   - looks good on a **dark background**: transparent background, and coloured or light artwork, not dark-on-transparent
   - **vector (SVG)** first, otherwise the highest-resolution transparent PNG
   - reads clearly at small size (a compact mark or icon for the small logo; the full wordmark only if that's all there is)
   - the official brand colour version, not a mock-up, photo, or one-off campaign variant
3. **Take the card colour from the chosen logo**: its main non-neutral colour, as a hex value. If the chosen logo is white or black only, take the colour from a coloured version in the same folder. If there's none, ask the owner.
4. **Show the owner your choices before finishing:** brand → chosen file → colour hex, ideally as a screenshot of the 9 cards. Swap any the owner doesn't like.
5. **Prepare for the web:**
   - copy each chosen logo to `beyondcy.co-track\public\brand-logos\<brand_id>.svg` (or `.webp`, max 512px wide). Brand ids: `behomy`, `behomy_group`, `homy8`, `beefix`, `purnava`, `hoteru`, `corvel`, `kedai_makmoer_88`, `lahap`.
   - keep the colours in one config file, e.g. `src\config\brandStyle.js`: `{ beefix: { logo: 'brand-logos/beefix.svg', color: '#…' }, … }`. Load logos via `import.meta.env.BASE_URL`.
6. **Tidy up:** move `Beyondcy-Web\tracker-brand-logo\` to `beyondcy.co-track\design-assets\tracker-brand-logo\`. That's inside the repo but **not** inside `public\`, so it isn't published.
   - Before committing, check the size. If the folder is over about 200 MB, or any file is over 50 MB, tell the owner first. It could be kept out of git (`.gitignore`) and stored locally only.

**Contrast:** the brand name and number must stay readable on every card whatever the brand colour. Keep text on the dark area and use the colour for the glow and logo only.

## 3. All-brands calendar

- **Dragging** works exactly as described in file 05 §3 (same rules, same toast with Undo). Admin can drag any brand's content (except Uploaded items) and any project.
- **Projects** appear on their deadline (file 06), with the project chip style. Add **"Projects"** to the Type filter so Admin can show only projects, or hide them.
- Chips show the PIC's photo (file 03) when there's room.
