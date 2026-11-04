// Field names, labels and the small wording rules around them (02_TRACKER_SPEC.md §2–3).

export const FIELD_LABELS = {
  content: 'Content',
  brand_id: 'Brand',
  status: 'Status',
  type: 'Type',
  brief: 'Brief',
  caption: 'Caption',
  notes: 'Notes',
  publish_date: 'Publish date',
  reference: 'Reference',
  content_pillars: 'Content pillar',
  instagram_url: 'Instagram link',
  pic_id: 'PIC',
};

/** The fields that must all be filled for "Planned", in display order. */
export const BASE_REQUIRED = ['content', 'type', 'brief', 'caption', 'notes', 'publish_date', 'reference'];

export function requiredFields(hasPillars) {
  return hasPillars ? [...BASE_REQUIRED, 'content_pillars'] : BASE_REQUIRED;
}

export const STATUS_LABELS = {
  not_started: 'Not started',
  planned: 'Planned',
  uploaded: 'Uploaded',
};

export const STATUS_ORDER = ['not_started', 'planned', 'uploaded'];

export const TYPE_LABELS = {
  feed: 'Feed',
  reels: 'Reels',
};

/** Reels first, everywhere (pills, legends, dashboard columns). */
export const TYPE_ORDER = ['reels', 'feed'];

/** Short brand names for tight places (calendar chips). */
const BRAND_SHORT = { kedai_makmoer_88: 'Makmoer' };

export function brandShort(brand) {
  if (!brand) return '';
  return BRAND_SHORT[brand.id] ?? brand.name;
}

export function fieldLabel(field) {
  return FIELD_LABELS[field] ?? field;
}

/** ['A'] → 'A'; ['A','B'] → 'A and B'; ['A','B','C'] → 'A, B and C' */
export function joinWords(words) {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** The hint under the locked Instagram input: 'Fill in Notes and Reference first' */
export function lockHint(missing) {
  return `Fill in ${joinWords(missing.map(fieldLabel))} first`;
}
