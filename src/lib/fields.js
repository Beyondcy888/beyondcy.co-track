// Field names, labels and the small wording rules around them (02_TRACKER_SPEC.md §2–3,
// update v4 files 01 and 02).

export const FIELD_LABELS = {
  content: 'Content',
  brand_id: 'Brand',
  status: 'Status',
  type: 'Type',
  brief: 'Brief',
  caption: 'Caption',
  notes: 'Notes',
  note_images: 'Notes pictures',
  publish_date: 'Publish date',
  reference: 'Reference',
  content_pillars: 'Content pillar',
  links: 'Links',
  self_posted: 'Posted myself',
  review_state: 'Review',
  revision_note: 'Revision note',
  instagram_url: 'Instagram link', // only in old history entries (v4 stopped using it)
  pic_id: 'PIC',
};

/** The fields that must all be filled for "Planned", in display order. */
export const BASE_REQUIRED = ['content', 'type', 'brief', 'caption', 'notes', 'publish_date', 'reference'];

export function requiredFields(hasPillars) {
  return hasPillars ? [...BASE_REQUIRED, 'content_pillars'] : BASE_REQUIRED;
}

// ------------------------------------------------------------------ statuses (v4, file 01)
// Not started → Planned → Done (waiting for Admin) → Revision (Admin asked for changes) → Uploaded.
// The database calculates the status; the app only shows it.
export const STATUS_LABELS = {
  not_started: 'Not started',
  planned: 'Planned',
  done: 'Done',
  revision: 'Revision',
  uploaded: 'Uploaded',
};

export const STATUS_ORDER = ['not_started', 'planned', 'done', 'revision', 'uploaded'];

/**
 * "Unfinished" (reminders, overdue, notifications): still the staff member's job.
 * Done is with Admin, and Uploaded is finished.
 */
export const UNFINISHED = ['not_started', 'planned', 'revision'];

export function isUnfinished(status) {
  return UNFINISHED.includes(status || 'not_started');
}

/** How Done reads wherever progress is shown (legend, boxes, board). */
export const REVIEW_TEXT = 'waiting for review';

// ------------------------------------------------------------------ links and pictures
export const MAX_LINKS = 5;
export const MAX_NOTE_IMAGES = 3;
export const NOTE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const NOTE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const NOTE_IMAGE_TOO_BIG = 'Pictures must be 2 MB or smaller.';
export const NOTE_IMAGE_TOO_MANY = 'A Notes cell can hold up to 3 pictures.';
export const NOTE_IMAGE_WRONG_TYPE = 'Use a JPG, PNG, WebP or GIF picture.';
export const LINK_INVALID = 'Each link must be a web address starting with http:// or https://';
export const LINKS_TOO_MANY = 'You can add up to 5 links.';

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

/** The hint under the locked Links inputs: 'Fill in Notes and Reference first' */
export function lockHint(missing) {
  return `Fill in ${joinWords(missing.map(fieldLabel))} first`;
}
