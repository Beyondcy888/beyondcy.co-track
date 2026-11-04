// Tests for the small wording libraries: fields, errors, links, history.
import { describe, expect, it } from 'vitest';
import { joinWords, lockHint, requiredFields } from './fields.js';
import { friendlyError, labelMissing, loginError } from './errors.js';
import { firstLink, isInstagramUrl, linkifyLine, referenceLines, safeHref, shortUrl } from './links.js';
import { describeActivity, formatValue } from './history.js';

describe('fields', () => {
  it('joins words naturally', () => {
    expect(joinWords(['Notes'])).toBe('Notes');
    expect(joinWords(['Notes', 'Reference'])).toBe('Notes and Reference');
    expect(joinWords(['Brief', 'Notes', 'Reference'])).toBe('Brief, Notes and Reference');
  });
  it('names the missing fields in the Instagram lock hint', () => {
    expect(lockHint(['notes', 'reference'])).toBe('Fill in Notes and Reference first');
    expect(lockHint(['publish_date'])).toBe('Fill in Publish date first');
  });
  it('requires a content pillar only where pillars exist', () => {
    expect(requiredFields(false)).not.toContain('content_pillars');
    expect(requiredFields(true)).toContain('content_pillars');
  });
});

describe('errors', () => {
  it('swaps DB field names for labels in "Missing:" messages', () => {
    expect(friendlyError({ message: 'Fill in every field before adding the Instagram link. Missing: notes, reference' })).toBe(
      'Fill in every field before adding the Instagram link. Missing: Notes, Reference',
    );
    expect(labelMissing('This item is already uploaded, so every field must stay filled. Missing: caption')).toBe(
      'This item is already uploaded, so every field must stay filled. Missing: Caption',
    );
    expect(labelMissing('Missing: publish_date, content_pillars')).toBe('Missing: Publish date, Content pillar');
  });
  it('passes other database messages through', () => {
    const msg = 'Uploaded content must be an Instagram post link, e.g. https://www.instagram.com/p/...';
    expect(friendlyError({ message: msg })).toBe(msg);
    expect(friendlyError({ message: 'Only Admin can set targets.' })).toBe('Only Admin can set targets.');
  });
  it('turns RLS refusals into the access message', () => {
    expect(friendlyError({ code: '42501', message: 'new row violates row-level security policy for table "content_items"' })).toBe(
      "You don't have access to this tracker.",
    );
  });
  it('maps sign-in errors', () => {
    expect(loginError({ message: 'Invalid login credentials', status: 400 })).toBe('Email or password is incorrect.');
    expect(loginError({ message: 'Email rate limit exceeded', status: 429 })).toBe('Too many attempts. Wait a minute and try again.');
  });
});

describe('links', () => {
  it('only allows http(s) hrefs', () => {
    expect(safeHref('https://pin.it/abc')).toBe('https://pin.it/abc');
    expect(safeHref('www.pinterest.com/x')).toBe('https://www.pinterest.com/x');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,hi')).toBeNull();
  });
  it('splits reference text into lines and links', () => {
    const lines = referenceLines('https://pin.it/abc\n\n  Lokasi: https://maps.app.goo.gl/xyz.  \nnote only');
    expect(lines).toHaveLength(3);
    expect(lines[1].parts).toEqual([
      { type: 'text', value: 'Lokasi: ' },
      { type: 'link', value: 'https://maps.app.goo.gl/xyz', href: 'https://maps.app.goo.gl/xyz' },
      { type: 'text', value: '.' },
    ]);
    expect(lines[2].parts).toEqual([{ type: 'text', value: 'note only' }]);
    expect(firstLink('see\nhttps://a.com/1\nhttps://b.com')).toEqual({ type: 'link', value: 'https://a.com/1', href: 'https://a.com/1' });
  });
  it('never turns a javascript: URL into a link', () => {
    expect(linkifyLine('javascript:alert(1)')).toEqual([{ type: 'text', value: 'javascript:alert(1)' }]);
  });
  it('recognises Instagram links like the database does', () => {
    expect(isInstagramUrl('https://www.instagram.com/p/C1abc/')).toBe(true);
    expect(isInstagramUrl('https://instagram.com/reel/xyz')).toBe(true);
    expect(isInstagramUrl('https://tiktok.com/@x')).toBe(false);
    expect(shortUrl('https://www.instagram.com/p/C1abc/')).toBe('instagram.com/p/C1abc');
  });
});

describe('history', () => {
  const ctx = { brandName: (id) => ({ behomy_group: 'Behomy Group' })[id] ?? id };
  it('describes an upload with its status change on one line', () => {
    const d = describeActivity(
      {
        action: 'item_updated',
        actor_name: 'Dika',
        changes: {
          instagram_url: { old: null, new: 'https://www.instagram.com/p/abc/' },
          status: { old: 'planned', new: 'uploaded' },
        },
      },
      ctx,
    );
    expect(`${d.actor} ${d.text}`).toBe('Dika added the Instagram link · status → Uploaded');
    expect(d.details[0]).toEqual({ field: 'instagram_url', label: 'Instagram link', old: '—', new: 'https://www.instagram.com/p/abc/' });
  });
  it('describes field changes', () => {
    const d = describeActivity({ action: 'item_updated', actor_name: 'Admin Beyondcy', changes: { caption: { old: 'Promo lama', new: 'Promo baru' } } });
    expect(`${d.actor} ${d.text}`).toBe('Admin Beyondcy changed Caption');
    expect(describeActivity({ action: 'item_updated', actor_name: 'Arum', changes: { brand_id: { old: 'behomy', new: 'behomy_group' } } }, ctx).text).toBe(
      'moved it to Behomy Group',
    );
    expect(describeActivity({ action: 'item_updated', actor_name: 'Arum', changes: { type: { old: null, new: 'reels' }, brief: { old: 'a', new: null } } }).text).toBe(
      'set Type and cleared Brief',
    );
  });
  it('describes PIC changes with names, "Former member" as the fallback', () => {
    const names = { ...ctx, personName: (id) => ({ 'u-arum': 'Arum', 'u-anne': 'Anne' })[id] };
    expect(describeActivity({ action: 'item_updated', actor_name: 'Admin Beyondcy', changes: { pic_id: { old: null, new: 'u-arum' } } }, names).text).toBe(
      'set the PIC to Arum',
    );
    const d = describeActivity({ action: 'item_updated', actor_name: 'Admin Beyondcy', changes: { pic_id: { old: 'u-gone', new: 'u-anne' } } }, names);
    expect(d.text).toBe('changed the PIC to Anne');
    expect(d.details[0]).toEqual({ field: 'pic_id', label: 'PIC', old: 'Former member', new: 'Anne' });
  });
  it('maps storage and target errors', () => {
    expect(friendlyError({ message: 'The object exceeded the maximum allowed size', statusCode: '413' })).toBe('Banner must be 5 MB or smaller.');
    expect(friendlyError({ message: 'mime type image/gif is not supported' })).toBe('Use a JPG, PNG or WebP image.');
    expect(friendlyError({ message: 'Choose the PIC for this content.' })).toBe('Choose the PIC for this content.');
    expect(friendlyError({ message: 'Brand "beefix" is not in Arum\'s tracker.' })).toBe('Brand "beefix" is not in Arum\'s tracker.');
  });
  it('describes creation and comments', () => {
    expect(describeActivity({ action: 'item_created', actor_name: 'Arum', changes: {} }).text).toBe('created this item');
    expect(describeActivity({ action: 'comment_added', actor_name: 'Zaki', changes: { body: 'Siap' } }).quote).toBe('Siap');
  });
  it('formats values', () => {
    expect(formatValue('type', 'feed')).toBe('Feed');
    expect(formatValue('publish_date', '2026-11-05')).toBe('5 Nov 2026');
    expect(formatValue('content_pillars', ['Design', 'Comedy'])).toBe('Design, Comedy');
    expect(formatValue('caption', '')).toBe('—');
    expect(formatValue('caption', 'x'.repeat(200)).endsWith('…')).toBe(true);
  });
});
