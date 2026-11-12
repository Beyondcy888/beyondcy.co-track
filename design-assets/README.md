# design-assets

Source files that are **not published** (they are outside `public/`, so they never reach the website).

## tracker-brand-logo/

The owner's logo folders, one per brand, with every version they supplied. The Admin Dashboard's brand cards use one logo per brand, chosen from here.

- **Which file was chosen, and each brand's colour:** the table in `docs/07_DECISIONS_AND_OPEN_ITEMS.md` (Update v3).
- **Where the website's copies are:** `public/brand-logos/<brand_id>.webp`.
- **Where to change a logo or a colour:** `src/config/brandStyle.js` (one entry per brand: `logo`, `color`, an optional `glow`, and `ratio` = width ÷ height of the logo).

To swap a logo: take the new source file, trim the transparent padding around the artwork, scale it to at most 512px on its long side, save it as WebP (or SVG) to `public/brand-logos/<brand_id>.webp`, and update that brand's `ratio` (and `color`) in `brandStyle.js`.

Folder → brand: `behomy&behomyGroup` (Behomy and Behomy Group), `H8` (Homy8), `beefix`, `purnava`, `hoteru`, `corvel`, `makmoer` (Kedai Makmoer 88), `lahap`.
