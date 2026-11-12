// Brand logos and colours for the Admin Dashboard's brand cards (update v3, 04 §2).
// ONE place to change a logo or a colour.
//
//   logo   file in public/ (loaded via import.meta.env.BASE_URL), trimmed, max 512px, WebP
//   color  the brand's main non-neutral colour, taken from its logo. Where the chosen logo
//          is white/cream only, the colour comes from the coloured version in the same folder.
//   glow   only where `color` is too dark to glow on a dark card: the same hue, lifted.
//          The card's glow uses `glow ?? color`.
//   ratio  the logo's width ÷ height (wide wordmarks and compact marks get different slots)
//
// The source files (and the ones not chosen) are in design-assets/tracker-brand-logo/.
// Chosen by the criteria in 04 §2: reads on a dark background, highest resolution,
// clear at small size, the official colour version. See docs/07 for the table.
export const BRAND_STYLE = {
  behomy: { logo: 'brand-logos/behomy.webp', color: '#F47F1F', ratio: 1.85 },
  behomy_group: { logo: 'brand-logos/behomy_group.webp', color: '#3C507E', glow: '#6E8BDB', ratio: 3.28 },
  homy8: { logo: 'brand-logos/homy8.webp', color: '#F28106', ratio: 2.57 },
  beefix: { logo: 'brand-logos/beefix.webp', color: '#F2E70E', ratio: 2.61 },
  purnava: { logo: 'brand-logos/purnava.webp', color: '#4D674A', glow: '#8DB486', ratio: 0.99 },
  hoteru: { logo: 'brand-logos/hoteru.webp', color: '#4A4233', glow: '#BFA77A', ratio: 1.86 },
  corvel: { logo: 'brand-logos/corvel.webp', color: '#792C02', glow: '#D9652B', ratio: 0.85 },
  kedai_makmoer_88: { logo: 'brand-logos/kedai_makmoer_88.webp', color: '#2D4F2B', glow: '#4FAE55', ratio: 1.95 },
  lahap: { logo: 'brand-logos/lahap.webp', color: '#FFEC3D', ratio: 1.1 },
};

/** The owner's order for the nine cards, left to right. */
export const BRAND_ORDER = ['behomy', 'behomy_group', 'homy8', 'beefix', 'purnava', 'hoteru', 'corvel', 'kedai_makmoer_88', 'lahap'];

/** A brand added later has no entry yet: it gets its initial and the Beyondcy green. */
const FALLBACK = { logo: null, color: '#9ECD59', ratio: 1 };

export function brandStyle(brandId) {
  const style = BRAND_STYLE[brandId] ?? FALLBACK;
  return { ...style, glow: style.glow ?? style.color };
}

/** Brands in the owner's order; any brand not in the list follows, in the database's order. */
export function orderBrands(brands) {
  const byId = new Map(brands.map((b) => [b.id, b]));
  const listed = BRAND_ORDER.map((id) => byId.get(id)).filter(Boolean);
  const rest = brands.filter((b) => !BRAND_ORDER.includes(b.id)).sort((a, b) => a.sort_order - b.sort_order);
  return [...listed, ...rest];
}

/**
 * Where a brand's card goes (04 §2):
 *   single tracker       → the tracker            (Beefix, Homy8)
 *   several brand pages  → that brand's page      (Lahap, Kedai Makmoer 88)
 *   team tracker         → Master, Brand filter set to the brand (the Behomy brands)
 */
export function brandHref(brandId, role) {
  if (!role) return null;
  if (role.layout === 'multi_brand') return `/t/${role.id}/brand/${brandId}`;
  if (role.layout === 'team') return `/t/${role.id}/master?brand=${encodeURIComponent(brandId)}`;
  return `/t/${role.id}`;
}
