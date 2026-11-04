# 05 · Placeholder sites (beyondcy.co and dash.beyondcy.co)

Both sites exist now but show only a **"Stay tuned"** page. Their real build comes in a later update with its own instructions. Keep them tiny: a single `index.html` with inline CSS, the Google Fonts link, and no JavaScript framework.

## Shared look

Use the same tokens as the tracker (`03` §2): `--ink` background, Instrument Sans for text, and the **dot grid** motif in dim violet, with a few dots filled in the status colours. This way the three sites read as one family.

```
┌──────────────────────────────────────────────────────────┐
│  beyondcy                                                │
│                                                          │
│                                                          │
│  Stay tuned                                              │
│  <one or two lines of description>                       │
│                                                          │
│  · · · · · · · · · · · · · · · · · · · · · · · · · · ·  │
│  · · ● · · · · ◎ · · · · · · · · ● · · · · · · · · · ·  │
│  · · · · · · · · · · · · · · · · · · · · · · · · · · ·  │
│                                                          │
│  © 2026 Beyondcy Kreatif Global                          │
└──────────────────────────────────────────────────────────┘
```
- Content is left-aligned, with generous margins. "Stay tuned" is large: Instrument Sans 600 at about 3.5–5rem, with tight letter-spacing.
- The dot band is pure CSS (`radial-gradient` background or a small inline SVG). No animation, or a very slow and subtle one that is disabled under reduced motion.
- Responsive, with good contrast. Page title and meta description are set.
- Wordmark: plain text "beyondcy" in Instrument Sans until the owner supplies the logo file (see `07`).

## beyondcy.co

- `<title>`: Beyondcy
- Headline: **Stay tuned**
- Description: "Beyondcy's new website is on its way. A closer look at the work we create for the brands we grow is coming soon."
- Indexable (no `noindex`).
- Also make `www.beyondcy.co` redirect here (handled by GitHub Pages once both DNS records exist).

## dash.beyondcy.co

- `<title>`: Beyondcy Dashboard
- Headline: **Stay tuned**
- Description: "The Beyondcy marketing dashboard is being built. Each brand's performance reports will live here."
- `<meta name="robots" content="noindex, nofollow">`
- **No login form and no fake data.** Nothing about any brand's numbers appears here.

The owner may change the copy later. Keep the text in one obvious place in each file.
