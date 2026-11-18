// The mock's computeItem() must behave like content_items_before_write() in
// 07_update_v4.sql: every local check of the review flow runs against it.
import { describe, expect, it } from 'vitest';
import { blankItem, computeItem, createStore } from './store.js';

const store = createStore();
const admin = store.people.find((p) => p.id === 'u-admin');
const dika = store.people.find((p) => p.id === 'u-dika');

const FILLED = {
  content: 'Deep Clean Ep. 2',
  type: 'reels',
  brief: 'b',
  caption: 'c',
  notes: 'n',
  publish_date: '2026-11-20',
  reference: 'https://pin.it/x',
};

/** A fresh Beefix item as Dika, then any number of updates [actor, patch]. Returns the last result. */
function run(steps, base = FILLED) {
  let { row, error } = computeItem(store, { ...blankItem(), id: 'item-1', role_id: 'beefix', brand_id: 'beefix', ...base }, null, dika);
  if (error) return { error };
  for (const [actor, patch] of steps) {
    const r = computeItem(store, { ...row, ...patch }, row, actor);
    if (r.error) return { error: r.error, row };
    row = r.row;
  }
  return { row };
}

describe('mock status trigger (mirrors 07_update_v4.sql)', () => {
  it('Not started → Planned → Done (links) → Uploaded (Admin approves)', () => {
    expect(run([], { content: 'x' }).row.status).toBe('not_started');
    expect(run([]).row.status).toBe('planned');
    const done = run([[dika, { links: ['https://drive.google.com/x'], self_posted: false }]]).row;
    expect(done).toMatchObject({ status: 'done', review_state: 'done', self_posted: false, instagram_url: 'https://drive.google.com/x' });
    const up = run([[dika, { links: ['https://drive.google.com/x'] }], [admin, { review_state: 'approved' }]]).row;
    expect(up).toMatchObject({ status: 'uploaded', review_state: 'approved', reviewed_by_name: 'Admin Beyondcy' });
    expect(up.uploaded_at).toBeTruthy();
  });

  it('"I posted this myself" makes it Uploaded straight away', () => {
    const r = run([[dika, { links: ['https://www.instagram.com/p/1/'], self_posted: true }]]).row;
    expect(r).toMatchObject({ status: 'uploaded', review_state: 'done', self_posted: true });
  });

  it('revision: Admin only, from Done only, note required; staff send it back with Mark as Done', () => {
    const links = [dika, { links: ['https://drive.google.com/x'] }];
    expect(run([links, [dika, { review_state: 'revision', revision_note: 'x' }]]).error).toBe('Only Admin can ask for a revision.');
    expect(run([links, [admin, { review_state: 'revision' }]]).error).toBe('Write what needs to change before asking for a revision.');
    expect(run([links, [admin, { review_state: 'approved' }], [admin, { review_state: 'revision', revision_note: 'x' }]]).error).toBe(
      'A revision can only be requested for Done content.',
    );
    const rev = run([links, [admin, { review_state: 'revision', revision_note: '  Cut the first 3 seconds ' }]]).row;
    expect(rev).toMatchObject({ status: 'revision', revision_note: 'Cut the first 3 seconds', revision_requested_by_name: 'Admin Beyondcy' });
    // staff can't change Admin's note (silently kept), but can mark it Done
    const kept = run([links, [admin, { review_state: 'revision', revision_note: 'Fix it' }], [dika, { revision_note: 'nope', caption: 'new' }]]).row;
    expect(kept).toMatchObject({ status: 'revision', revision_note: 'Fix it', caption: 'new' });
    const back = run([links, [admin, { review_state: 'revision', revision_note: 'Fix it' }], [dika, { review_state: 'done' }]]).row;
    expect(back).toMatchObject({ status: 'done', review_state: 'done' });
  });

  it('only Admin marks Uploaded or moves it back to Done', () => {
    const links = [dika, { links: ['https://drive.google.com/x'] }];
    expect(run([links, [dika, { review_state: 'approved' }]]).error).toBe('Only Admin can mark content as Uploaded.');
    const approved = [admin, { review_state: 'approved' }];
    expect(run([links, approved, [dika, { review_state: 'done' }]]).error).toBe('Only Admin can move Uploaded content back to Done.');
    expect(run([links, approved, [admin, { review_state: 'done' }]]).row.status).toBe('done');
  });

  it('links: up to 5, http(s) only, blanks and duplicates removed, locked until every field is filled', () => {
    const six = Array.from({ length: 6 }, (_, i) => `https://a.com/${i}`);
    expect(run([[dika, { links: six }]]).error).toBe('You can add up to 5 links.');
    expect(run([[dika, { links: ['ftp://a.com'] }]]).error).toBe('Each link must be a web address starting with http:// or https://');
    expect(run([[dika, { links: [' https://a.com ', '', 'https://a.com', 'https://b.com'] }]]).row.links).toEqual(['https://a.com', 'https://b.com']);
    expect(run([[dika, { links: ['https://a.com'] }]], { ...FILLED, notes: null }).error).toBe('Fill in every field before adding links. Missing: notes');
    expect(run([[dika, { links: ['https://a.com'] }], [dika, { caption: '' }]]).error).toBe(
      'This content already has links, so every field must stay filled. Missing: caption',
    );
    const cleared = run([[dika, { links: ['https://a.com'], self_posted: true }], [dika, { links: [] }]]).row;
    expect(cleared).toMatchObject({ status: 'planned', review_state: null, self_posted: false, instagram_url: null });
  });

  it('Notes: a picture alone counts as filled; up to 3, in the item’s own folder', () => {
    const pic = (n) => `beefix/item-1/${n}.png`;
    expect(run([[dika, { notes: null, note_images: [pic(1)] }]]).row.status).toBe('planned');
    expect(run([[dika, { note_images: [pic(1), pic(2), pic(3), pic(4)] }]]).error).toBe('A Notes cell can hold up to 3 pictures.');
    expect(run([[dika, { note_images: ['beefix/other-item/1.png'] }]]).error).toBe("Note pictures must be stored in this content's folder.");
  });

  it('maintenance: a locked tracker refuses every change', () => {
    const { row } = run([]);
    expect(computeItem(store, { ...row, caption: 'x' }, row, dika, { locked: true }).error).toBe("You don't have access to this tracker.");
  });
});
