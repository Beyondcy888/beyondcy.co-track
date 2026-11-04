// Turn database / auth errors into the sentences people should read.
// The database's own messages are already written for users (04_DATABASE_GUIDE.md),
// so most pass straight through; only field names are swapped for labels.
import { fieldLabel } from './fields.js';

const NO_ACCESS = "You don't have access to this tracker.";
const OFFLINE = "Can't reach the server. Check your connection and try again.";
export const BANNER_TOO_BIG = 'Banner must be 5 MB or smaller.';
export const BANNER_WRONG_TYPE = 'Use a JPG, PNG or WebP image.';

function messageOf(err) {
  if (!err) return '';
  if (typeof err === 'string') return err;
  return err.message || err.error_description || err.msg || '';
}

/** Swap DB field names in "Missing: notes, reference" for labels. */
export function labelMissing(message) {
  return message.replace(/Missing: ([a-z_, ]+)\s*$/, (_, list) =>
    `Missing: ${list.split(',').map((f) => fieldLabel(f.trim())).filter(Boolean).join(', ')}`,
  );
}

export function friendlyError(err) {
  if (!err) return null;
  const message = messageOf(err);
  const code = typeof err === 'object' ? err.code : undefined;

  if (code === '42501' || /row-level security|permission denied/i.test(message)) return NO_ACCESS;
  if (code === 'PGRST116') return 'This item is no longer available. It may have been deleted.';
  // storage (banner uploads)
  if (/exceeded the maximum allowed size|payload too large|entity too large/i.test(message)) return BANNER_TOO_BIG;
  if (/mime type .* is not supported|invalid mime/i.test(message)) return BANNER_WRONG_TYPE;
  // content_targets: Reels and Feed are 0–500
  if (code === '23514' && /target_(reels|feed)/.test(message)) return 'Use a whole number from 0 to 500 for Reels and Feed.';
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(message)) return OFFLINE;
  if (/jwt expired|invalid jwt|refresh token/i.test(message)) return 'Your session expired. Sign in again.';
  if (code === '22P02' || /invalid input syntax/i.test(message)) return 'That value is not valid for this field.';
  if (code === '22008' || /date\/time field value out of range/i.test(message)) return 'That date is not valid.';
  if (!message) return 'Something went wrong. Try again.';
  return labelMissing(message);
}

/** Sign-in errors, specific as the spec asks (02 §8). */
export function loginError(err) {
  const message = messageOf(err);
  const status = typeof err === 'object' ? err.status : undefined;
  if (/invalid login credentials/i.test(message)) return 'Email or password is incorrect.';
  if (/email not confirmed/i.test(message)) return "This account isn't confirmed yet. Ask Admin Beyondcy.";
  if (status === 429 || /rate limit|too many/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(message)) return OFFLINE;
  return message || 'Sign-in failed. Try again.';
}

export const MESSAGES = { NO_ACCESS, OFFLINE };
