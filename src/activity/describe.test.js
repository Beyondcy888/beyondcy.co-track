// Activity Logs wording (update v4, files 05 and 10 §5): the spec's own example sentences.
import { describe, expect, it } from 'vitest';
import { describeLogEntry, kindOf, minutesText, whoOf } from './describe.js';

const ctx = {
  brandName: (id) => ({ behomy: 'Behomy', beefix: 'Beefix' })[id] ?? id,
  personName: (id) => ({ 'u-arum': 'Arum', 'u-dika': 'Dika' })[id],
  roleName: (id) => ({ beefix: 'Beefix', homy8: 'Homy8' })[id] ?? id,
  deletedItems: new Set(['gone']),
};
const sentence = (d) => d.parts.map((p) => p.text ?? p.strong).join('');
const entry = (action, changes = {}, extra = {}) => ({ id: 1, action, changes, summary: 'Deep Clean Ep. 2', item_id: 'i1', role_id: 'beefix', source: 'app', actor_id: 'u-dika', actor_name: 'Dika', ...extra });

describe('Activity Logs wording', () => {
  it('content: "edited Caption on Deep Clean Ep. 2", review steps, comments', () => {
    expect(sentence(describeLogEntry(entry('item_updated', { caption: { old: 'a', new: 'b' } }), ctx))).toBe('edited Caption on Deep Clean Ep. 2');
    const rev = describeLogEntry(entry('item_updated', { review_state: { old: 'done', new: 'revision' }, revision_note: { old: null, new: 'Cut it' }, status: { old: 'done', new: 'revision' } }), ctx);
    expect(sentence(rev)).toBe('requested a revision on Deep Clean Ep. 2');
    expect(rev.quote).toBe('Cut it');
    expect(sentence(describeLogEntry(entry('item_updated', { review_state: { old: 'done', new: 'approved' } }), ctx))).toBe('marked Deep Clean Ep. 2 as Uploaded');
    expect(sentence(describeLogEntry(entry('item_updated', { links: { old: [], new: ['https://a.com'] }, self_posted: { old: false, new: true }, review_state: { old: null, new: 'done' }, status: { old: 'planned', new: 'uploaded' } }), ctx))).toBe(
      'added links to Deep Clean Ep. 2 and posted it themselves',
    );
    expect(sentence(describeLogEntry(entry('item_updated', { pic_id: { old: 'u-arum', new: 'u-dika' } }), ctx))).toBe('changed the PIC to Dika on Deep Clean Ep. 2');
    expect(sentence(describeLogEntry(entry('comment_added', { body: 'Siap' }), ctx))).toBe('commented on Deep Clean Ep. 2');
  });

  it('only titles of content that still exists open the drawer', () => {
    const open = describeLogEntry(entry('item_created'), ctx).parts.find((p) => p.strong);
    expect(open).toMatchObject({ itemId: 'i1', roleId: 'beefix' });
    const gone = describeLogEntry(entry('item_created', {}, { item_id: 'gone' }), ctx).parts.find((p) => p.strong);
    expect(gone.itemId).toBeUndefined();
    expect(describeLogEntry(entry('item_deleted', { deleted_row: { content: 'X', brand_id: 'beefix', status: 'planned' } }), ctx).details.find((d) => d.label === 'Brand').value).toBe('Beefix');
  });

  it('people and targets, in plain words', () => {
    const role = describeLogEntry(entry('person_updated', { role_id: { old: 'beefix', new: 'homy8' }, profile_id: 'u-dika' }, { summary: 'Dika', actor_name: 'Admin Beyondcy' }), ctx);
    expect(sentence(role)).toBe("changed Dika's role from Beefix to Homy8");
    const target = describeLogEntry(
      entry('target_set', { brand_id: 'behomy', profile_id: 'u-arum', reels: { old: null, new: 7 }, feed: { old: null, new: 12 }, note: { old: null, new: null } }, { summary: 'November 2026', item_id: null }),
      ctx,
    );
    expect(sentence(target)).toBe("set Arum's Behomy target to 7 Reels + 12 Feed (Nov 2026)");
  });

  it('maintenance (10 §5), with the timer as its own actor', () => {
    expect(sentence(describeLogEntry(entry('maintenance_started', { site: 'tracker', minutes: 60 }), ctx))).toBe('turned on Tracker maintenance for 1 hour');
    expect(sentence(describeLogEntry(entry('maintenance_extended', { site: 'tracker', added_minutes: 30 }), ctx))).toBe('added 30 min to Tracker maintenance');
    expect(sentence(describeLogEntry(entry('maintenance_ended', { site: 'tracker', reason: 'ended early' }), ctx))).toBe('ended Tracker maintenance early');
    const timer = entry('maintenance_ended', { site: 'tracker', reason: 'timer finished' }, { source: 'supabase', actor_id: null, actor_name: 'Maintenance timer' });
    expect(sentence(describeLogEntry(timer, ctx))).toBe('Tracker maintenance ended: timer finished');
    expect(whoOf(timer)).toEqual({ kind: 'timer' });
    expect(minutesText(180)).toBe('3 hours');
  });

  it('marks direct edits in Supabase', () => {
    expect(whoOf(entry('item_updated', {}, { source: 'supabase', actor_id: null, actor_name: null }))).toEqual({ kind: 'supabase' });
    expect(whoOf(entry('item_updated'))).toMatchObject({ kind: 'person', name: 'Dika' });
    expect([kindOf('item_created'), kindOf('target_set'), kindOf('item_updated'), kindOf('project_deleted'), kindOf('target_removed')]).toEqual(['created', 'created', 'edited', 'deleted', 'deleted']);
  });
});
