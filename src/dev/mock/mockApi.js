// DEV ONLY: the data API (same interface as data/api.js) over an in-memory store,
// with the same access rules as the RLS policies and triggers, so every screen can be exercised.
import { computeItem, uid } from './store.js';

const RLS = { message: 'new row violates row-level security policy for table "content_items"', code: '42501' };
const clone = (v) => JSON.parse(JSON.stringify(v));
const wait = (ms = 90) => new Promise((r) => setTimeout(r, ms));
const TRACKED = ['content', 'type', 'brief', 'caption', 'notes', 'publish_date', 'reference', 'content_pillars', 'instagram_url', 'brand_id', 'status', 'pic_id'];
const BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const inRange = (d, r) => !d || (d >= r.start && d <= r.end);

export function createMockApi(store, personaRef) {
  const me = () => store.people.find((p) => p.id === personaRef.current) ?? null;
  const myRole = () => (me()?.is_active ? me().role_id : null);
  const isAdmin = () => myRole() === 'admin';
  const canAccess = (roleId) => isAdmin() || (roleId != null && roleId === myRole());
  const ok = async (data) => {
    await wait();
    return { data: data == null ? null : clone(data), error: null };
  };
  const fail = async (error) => {
    await wait();
    return { data: null, error: typeof error === 'string' ? { message: error } : error };
  };
  const withCount = (item) => ({ ...item, comments: [{ count: store.comments.filter((c) => c.item_id === item.id).length }] });
  const subs = new Set();
  /** kind: item | comment | target | banner. DELETE events go to everyone (they carry only the key). */
  const emit = (kind, event, row) =>
    subs.forEach((s) => {
      if (event !== 'DELETE' && s.roleId && row.role_id !== s.roleId) return;
      if (event !== 'DELETE' && !s.roleId && !s.admin) return;
      const payload = event === 'DELETE' ? (kind === 'banner' ? { role_id: row.role_id } : { id: row.id }) : clone(row);
      if (kind === 'item') s.h.onItem?.(event, payload);
      if (kind === 'comment') s.h.onComment?.(event, payload);
      if (kind === 'target') s.h.onTarget?.(event, payload);
      if (kind === 'banner' && s.roleId) s.h.onBanner?.(event, payload);
    });
  const log = (entry) =>
    store.activity.push({ id: store.activity.length + 1, created_at: new Date().toISOString(), ...entry });

  function applyUpdate(id, patch, actor) {
    const old = store.items.find((i) => i.id === id);
    if (!old) return { error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } };
    const { row, error } = computeItem(store, { ...old, ...patch, id: old.id, role_id: old.role_id, owner_id: old.owner_id }, old, actor);
    if (error) return { error: { message: error } };
    const changes = {};
    for (const f of TRACKED) {
      if (JSON.stringify(old[f] ?? null) !== JSON.stringify(row[f] ?? null)) changes[f] = { old: old[f] ?? null, new: row[f] ?? null };
    }
    Object.assign(old, row);
    if (Object.keys(changes).length) {
      log({ role_id: old.role_id, item_id: old.id, actor_id: actor.id, actor_name: actor.display_name, action: 'item_updated', summary: old.content, changes });
    }
    emit('item', 'UPDATE', old);
    return { row: old };
  }

  // ---------------------------------------------------------------- targets (content_targets_before_write)
  function upsertTarget({ month, brandId, profileId, reels, feed, note }) {
    const person = store.people.find((p) => p.id === profileId);
    if (!person?.role_id) return { error: 'Choose a person who has a tracker.' };
    const existing = store.targets.find((t) => t.month === month && t.brand_id === brandId && t.profile_id === profileId);
    // an upsert fires the BEFORE INSERT trigger first, so the person's current tracker always decides
    if (!store.roleBrands.some((rb) => rb.role_id === person.role_id && rb.brand_id === brandId)) {
      return { error: `Brand "${brandId}" is not in ${person.display_name}'s tracker.` };
    }
    const roleId = existing?.role_id ?? person.role_id;
    for (const [field, v] of [['target_reels', reels], ['target_feed', feed]]) {
      if (!Number.isInteger(v) || v < 0 || v > 500) {
        return { error: { code: '23514', message: `new row for relation "content_targets" violates check constraint "content_targets_${field}_check"` } };
      }
    }
    const before = existing ? { ...existing } : null;
    const row = existing ?? { id: uid(), month, role_id: roleId, brand_id: brandId, profile_id: profileId, note: null };
    row.target_reels = reels;
    row.target_feed = feed;
    row.target_total = reels + feed;
    if (note !== undefined) row.note = note == null ? null : String(note).trim() || null;
    row.set_by = me().id;
    row.updated_at = new Date().toISOString();
    if (!existing) store.targets.push(row);
    log({
      role_id: row.role_id, actor_id: me().id, actor_name: me().display_name, action: 'target_set', summary: month,
      changes: { brand_id: brandId, profile_id: profileId, reels: { old: before?.target_reels ?? null, new: reels }, feed: { old: before?.target_feed ?? null, new: feed }, note: { old: before?.note ?? null, new: row.note } },
    });
    emit('target', existing ? 'UPDATE' : 'INSERT', row);
    return { row };
  }

  const api = {
    listRoles: () => ok(store.roles),
    listBrands: () => ok(store.brands),
    listRoleBrands: () => ok(store.roleBrands),
    listPillars: () => ok(store.pillars),
    listProfiles: () =>
      ok(
        store.people
          .filter((p) => isAdmin() || p.id === me()?.id || p.role_id === myRole() || p.role_id === 'admin')
          .map(({ id, display_name, role_id, is_active }) => ({ id, display_name, role_id, is_active })),
      ),

    // -------------------------------------------------------------- items
    listItems: (roleId) => ok(canAccess(roleId) ? store.items.filter((i) => i.role_id === roleId).map(withCount) : []),
    listItemsForMonth: (start, end) =>
      ok(store.items.filter((i) => canAccess(i.role_id) && inRange(i.publish_date, { start, end })).map(withCount)),
    listCommentCounts: (roleId, range) =>
      ok(
        store.items
          .filter((i) => canAccess(i.role_id) && (roleId ? i.role_id === roleId : !range || inRange(i.publish_date, range)))
          .map((i) => ({ id: i.id, comments: withCount(i).comments })),
      ),

    async createItem({ roleId, brandId, publishDate = null, picId = null }) {
      if (!canAccess(roleId)) return fail("You don't have access to this tracker.");
      const actor = me();
      const { row, error } = computeItem(
        store,
        { id: uid(), role_id: roleId, brand_id: brandId, owner_id: actor.id, pic_id: picId, content: '', publish_date: publishDate, content_pillars: [], created_at: new Date().toISOString() },
        null,
        actor,
      );
      if (error) return fail(error);
      store.items.push(row);
      log({ role_id: roleId, item_id: row.id, actor_id: actor.id, actor_name: actor.display_name, action: 'item_created', summary: null, changes: { brand_id: brandId, pic_id: row.pic_id } });
      emit('item', 'INSERT', row);
      return ok(withCount(row));
    },

    async updateItem(id, patch) {
      const item = store.items.find((i) => i.id === id);
      if (!item || !canAccess(item.role_id)) return fail({ message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' });
      const result = applyUpdate(id, patch, me());
      if (result.error) return fail(result.error);
      return ok(withCount(result.row));
    },

    async deleteItem(id) {
      const item = store.items.find((i) => i.id === id);
      const mine = item && item.role_id === myRole() && (item.owner_id === me()?.id || item.pic_id === me()?.id);
      if (!item || !(isAdmin() || mine)) return fail('Only the person who created this item, its PIC or Admin can delete it.');
      store.items.splice(store.items.indexOf(item), 1);
      store.comments = store.comments.filter((c) => c.item_id !== id);
      log({ role_id: item.role_id, item_id: id, actor_id: me().id, actor_name: me().display_name, action: 'item_deleted', summary: item.content, changes: { deleted_row: clone(item) } });
      emit('item', 'DELETE', item);
      return ok({ id });
    },

    // -------------------------------------------------------------- targets
    listTargets: (roleId) => ok(canAccess(roleId) ? store.targets.filter((t) => t.role_id === roleId) : []),
    listAllTargets: () => ok(store.targets.filter((t) => canAccess(t.role_id))),
    listTargetsForMonths: (months) => ok(store.targets.filter((t) => months.includes(t.month) && canAccess(t.role_id))),
    async saveTarget(input) {
      if (!isAdmin()) return fail({ code: '42501', message: 'new row violates row-level security policy for table "content_targets"' });
      const r = upsertTarget(input);
      return r.error ? fail(r.error) : ok(r.row);
    },
    async saveTargets(rows) {
      if (!isAdmin()) return fail({ code: '42501', message: 'new row violates row-level security policy for table "content_targets"' });
      const out = [];
      for (const input of rows) {
        const r = upsertTarget(input);
        if (r.error) return fail(r.error);
        out.push(r.row);
      }
      return ok(out);
    },
    async updateTargetNote(id, note) {
      const row = store.targets.find((t) => t.id === id);
      if (!isAdmin() || !row) return fail({ message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' });
      const old = row.note;
      row.note = note == null ? null : String(note).trim() || null;
      row.updated_at = new Date().toISOString();
      log({ role_id: row.role_id, actor_id: me().id, actor_name: me().display_name, action: 'target_set', summary: row.month, changes: { brand_id: row.brand_id, profile_id: row.profile_id, note: { old, new: row.note } } });
      emit('target', 'UPDATE', row);
      return ok(row);
    },
    async deleteTarget(id) {
      const row = store.targets.find((t) => t.id === id);
      if (!isAdmin() || !row) return fail('Only Admin can change targets.');
      store.targets.splice(store.targets.indexOf(row), 1);
      log({ role_id: row.role_id, actor_id: me().id, actor_name: me().display_name, action: 'target_removed', summary: row.month, changes: { brand_id: row.brand_id, profile_id: row.profile_id } });
      emit('target', 'DELETE', row);
      return ok({ id });
    },

    // -------------------------------------------------------------- banners
    getBanner: (roleId) => ok(canAccess(roleId) ? store.banners.find((b) => b.role_id === roleId) ?? null : null),
    async uploadBannerFile(roleId, blob, ext) {
      if (!canAccess(roleId)) return fail({ code: '42501', message: 'new row violates row-level security policy' });
      if (!BANNER_TYPES.includes(blob.type)) return fail(`mime type ${blob.type || 'unknown'} is not supported`);
      if (blob.size > 5 * 1024 * 1024) return fail({ statusCode: '413', message: 'The object exceeded the maximum allowed size' });
      const path = `${roleId}/${uid()}.${ext}`;
      store.files.set(path, URL.createObjectURL(blob));
      return ok({ path });
    },
    async saveBanner({ roleId, imagePath, positionY = 50 }) {
      if (!canAccess(roleId)) return fail({ code: '42501', message: 'new row violates row-level security policy for table "tracker_banners"' });
      if (imagePath.split('/')[0] !== roleId) return fail(`Banner image must be stored in the "${roleId}" folder.`);
      let row = store.banners.find((b) => b.role_id === roleId);
      const event = row ? 'UPDATE' : 'INSERT';
      if (!row) {
        row = { role_id: roleId };
        store.banners.push(row);
      }
      Object.assign(row, { image_path: imagePath, position_y: positionY, updated_by: me().id, updated_by_name: me().display_name, updated_at: new Date().toISOString() });
      emit('banner', event, row);
      return ok(row);
    },
    async setBannerPosition(roleId, positionY) {
      const row = store.banners.find((b) => b.role_id === roleId);
      if (!row || !canAccess(roleId)) return fail({ message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' });
      Object.assign(row, { position_y: positionY, updated_by: me().id, updated_by_name: me().display_name, updated_at: new Date().toISOString() });
      emit('banner', 'UPDATE', row);
      return ok(row);
    },
    async deleteBanner(roleId) {
      const row = store.banners.find((b) => b.role_id === roleId);
      if (!row || !canAccess(roleId)) return fail("You don't have access to this tracker.");
      store.banners.splice(store.banners.indexOf(row), 1);
      emit('banner', 'DELETE', row);
      return ok({ role_id: roleId });
    },
    async removeBannerFile(path) {
      const url = store.files.get(path);
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
      store.files.delete(path);
      return ok([]);
    },
    async bannerUrl(path) {
      if (!canAccess(path.split('/')[0])) return fail({ statusCode: '400', message: 'Object not found' });
      const url = store.files.get(path);
      await wait(40);
      return url ? { data: url, error: null } : { data: null, error: { message: 'Object not found' } };
    },

    // -------------------------------------------------------------- comments
    listComments: (itemId) => ok(store.comments.filter((c) => c.item_id === itemId).sort((a, b) => (a.created_at < b.created_at ? -1 : 1))),
    async addComment(itemId, body) {
      const item = store.items.find((i) => i.id === itemId);
      if (!item || !canAccess(item.role_id)) return fail(RLS);
      const actor = me();
      const row = { id: uid(), item_id: itemId, role_id: item.role_id, author_id: actor.id, author_name: actor.display_name, body: body.trim(), created_at: new Date().toISOString() };
      store.comments.push(row);
      log({ role_id: item.role_id, item_id: itemId, actor_id: actor.id, actor_name: actor.display_name, action: 'comment_added', summary: item.content, changes: { comment_id: row.id, body: row.body } });
      emit('comment', 'INSERT', row);
      return ok(row);
    },
    async deleteComment(id) {
      const c = store.comments.find((x) => x.id === id);
      if (!c || !(isAdmin() || c.author_id === me()?.id)) return fail('Only the author, or Admin, can delete this comment.');
      store.comments.splice(store.comments.indexOf(c), 1);
      log({ role_id: c.role_id, item_id: c.item_id, actor_id: me().id, actor_name: me().display_name, action: 'comment_deleted', summary: null, changes: { comment_id: id, body: c.body } });
      emit('comment', 'DELETE', c);
      return ok({ id });
    },

    listHistory: (itemId) =>
      ok(
        store.activity
          .filter((a) => a.item_id === itemId)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id)),
      ),

    listPeople: () => (isAdmin() ? ok(store.people) : ok(store.people.filter((p) => p.id === me()?.id))),
    async updatePerson(id, patch) {
      if (!isAdmin()) return fail('Only Admin can change people.');
      const person = store.people.find((p) => p.id === id);
      Object.assign(person, patch);
      return ok(person);
    },

    subscribeTracker(roleId, h) {
      const s = { roleId, h, admin: isAdmin() };
      subs.add(s);
      setTimeout(() => h.onStatus?.('SUBSCRIBED'), 30);
      return () => subs.delete(s);
    },
  };

  // ---------------------------------------------------------------- dev hooks (window.__mock.api)
  /** A teammate edits an item (live updates and the "Load their version?" prompt). */
  api.remoteEdit = (itemId, patch, personId = 'u-ilyas') => {
    const actor = store.people.find((p) => p.id === personId);
    return applyUpdate(itemId, patch, actor);
  };
  /** A teammate moves or removes their tracker's banner. */
  api.remoteBanner = (roleId, positionY, personId = 'u-ilyas') => {
    const row = store.banners.find((b) => b.role_id === roleId);
    const actor = store.people.find((p) => p.id === personId);
    if (!row) return null;
    if (positionY == null) {
      store.banners.splice(store.banners.indexOf(row), 1);
      emit('banner', 'DELETE', row);
      return null;
    }
    Object.assign(row, { position_y: positionY, updated_by: actor.id, updated_by_name: actor.display_name, updated_at: new Date().toISOString() });
    emit('banner', 'UPDATE', row);
    return row;
  };

  return api;
}
