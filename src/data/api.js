// Every database call the app makes, behind one small interface.
// (The dev-only mock in src/dev/mock implements the same interface with fake data.)
//
// Rules from 04_DATABASE_GUIDE.md and 09_UPDATE_V2.md §1:
//   - never send status, missing_fields, uploaded_at, owner_id, created_at,
//     updated_at, updated_by, updated_by_name (items) or role_id, author_* (comments)
//   - content_targets: never send role_id, target_total, set_by, updated_at (the DB sets them)
//   - pic_id: staff can't set it (the DB uses them); Admin sends it only where a choice is needed
//   - banner files live at tracker-banners/<role_id>/<file>
//   - always use the row the database returns
import { supabase } from '../lib/supabase.js';

const ITEM_SELECT = '*, comments(count)';
const PERSON_SELECT = 'id, email, display_name, role_id, is_active, created_at';
const TARGET_SELECT =
  'id, month, role_id, brand_id, profile_id, target_reels, target_feed, target_total, note, set_by, updated_at';
const BANNER_SELECT = 'role_id, image_path, position_y, updated_by, updated_by_name, updated_at';
const BANNERS = 'tracker-banners';

/**
 * Flatten `comments: [{ count }]` into `comment_count`. Rows without the embed
 * (realtime payloads, already-normalized rows) keep their own or the previous count.
 * Safe to call more than once.
 */
export function normalizeItem(row, prev) {
  if (!row) return row;
  const { comments, ...rest } = row;
  const count = Array.isArray(comments) ? comments[0]?.count ?? 0 : rest.comment_count ?? prev?.comment_count ?? 0;
  return { ...rest, comment_count: count };
}

const notAllowed = (message) => ({ data: null, error: { message } });

async function one(query) {
  const result = await query;
  return { data: result.data ? normalizeItem(result.data) : null, error: result.error };
}

/** "dated in this month, or not dated yet" as a PostgREST filter */
const monthOrUndated = (startIso, endIso) => `publish_date.is.null,and(publish_date.gte.${startIso},publish_date.lte.${endIso})`;

const newId = () =>
  globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export const supabaseApi = {
  // ------------------------------------------------------------ setup data
  listRoles: () => supabase.from('roles').select('id, name, is_admin, layout, sort_order').order('sort_order'),
  listBrands: () => supabase.from('brands').select('id, name, instagram_handle, sort_order').order('sort_order'),
  listRoleBrands: () => supabase.from('role_brands').select('role_id, brand_id'),
  listPillars: () => supabase.from('brand_pillars').select('brand_id, name, sort_order').order('sort_order'),
  /** Profiles this person may see (self, teammates, Admin; Admin sees all). No emails. */
  listProfiles: () => supabase.from('profiles').select('id, display_name, role_id, is_active').order('display_name'),

  // ------------------------------------------------------------ items
  async listItems(roleId) {
    const result = await supabase
      .from('content_items')
      .select(ITEM_SELECT)
      .eq('role_id', roleId)
      .order('publish_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });
    return { data: result.data?.map((row) => normalizeItem(row)) ?? null, error: result.error };
  },

  /** Admin dashboard: every tracker's items dated in the month, plus the undated ones. */
  async listItemsForMonth(startIso, endIso) {
    const result = await supabase
      .from('content_items')
      .select(ITEM_SELECT)
      .or(monthOrUndated(startIso, endIso))
      .order('publish_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });
    return { data: result.data?.map((row) => normalizeItem(row)) ?? null, error: result.error };
  },

  /** Comment counts for one tracker, or (roleId null) for a month across trackers. */
  listCommentCounts(roleId, range) {
    let query = supabase.from('content_items').select('id, comments(count)');
    if (roleId) query = query.eq('role_id', roleId);
    else if (range) query = query.or(monthOrUndated(range.start, range.end));
    return query;
  },

  /** pic_id only when Admin must choose one (Behomy); otherwise the database decides. */
  createItem: ({ roleId, brandId, publishDate = null, picId = null }) =>
    one(
      supabase
        .from('content_items')
        .insert({ role_id: roleId, brand_id: brandId, content: '', publish_date: publishDate, ...(picId ? { pic_id: picId } : {}) })
        .select(ITEM_SELECT)
        .single(),
    ),

  updateItem: (id, patch) =>
    one(supabase.from('content_items').update(patch).eq('id', id).select(ITEM_SELECT).single()),

  async deleteItem(id) {
    // RLS turns a refused delete into "0 rows", so ask for the deleted row back.
    const { data, error } = await supabase.from('content_items').delete().eq('id', id).select('id');
    if (error) return { data: null, error };
    if (!data?.length) return notAllowed('Only the person who created this item, its PIC or Admin can delete it.');
    return { data: data[0], error: null };
  },

  // ------------------------------------------------------------ targets (content_targets)
  listTargets: (roleId) => supabase.from('content_targets').select(TARGET_SELECT).eq('role_id', roleId),
  /** Admin: every tracker's targets. */
  listAllTargets: () => supabase.from('content_targets').select(TARGET_SELECT),
  listTargetsForMonths: (monthStarts) => supabase.from('content_targets').select(TARGET_SELECT).in('month', monthStarts),

  /** Admin only (RLS). Set or change one person × brand × month. `note` is left alone when undefined. */
  saveTarget: ({ month, brandId, profileId, reels, feed, note }) =>
    supabase
      .from('content_targets')
      .upsert(
        {
          month,
          brand_id: brandId,
          profile_id: profileId,
          target_reels: reels,
          target_feed: feed,
          ...(note !== undefined ? { note } : {}),
        },
        { onConflict: 'month,brand_id,profile_id' },
      )
      .select(TARGET_SELECT)
      .single(),

  /** Admin only: several rows at once (Copy from last month). Reels and Feed only, never notes. */
  saveTargets: (rows) =>
    supabase
      .from('content_targets')
      .upsert(
        rows.map((r) => ({
          month: r.month,
          brand_id: r.brandId,
          profile_id: r.profileId,
          target_reels: r.reels,
          target_feed: r.feed,
        })),
        { onConflict: 'month,brand_id,profile_id' },
      )
      .select(TARGET_SELECT),

  /** Admin only: just the "Status & notes" text. */
  updateTargetNote: (id, note) =>
    supabase.from('content_targets').update({ note }).eq('id', id).select(TARGET_SELECT).single(),

  async deleteTarget(id) {
    const { data, error } = await supabase.from('content_targets').delete().eq('id', id).select('id');
    if (error) return { data: null, error };
    if (!data?.length) return notAllowed('Only Admin can change targets.');
    return { data: data[0], error: null };
  },

  // ------------------------------------------------------------ banners
  getBanner: (roleId) => supabase.from('tracker_banners').select(BANNER_SELECT).eq('role_id', roleId).maybeSingle(),

  /** Upload to tracker-banners/<roleId>/<uuid>.<ext>; returns { data: { path } }. */
  async uploadBannerFile(roleId, blob, ext) {
    const path = `${roleId}/${newId()}.${ext}`;
    const { error } = await supabase.storage
      .from(BANNERS)
      .upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '3600' });
    return { data: error ? null : { path }, error };
  },

  saveBanner: ({ roleId, imagePath, positionY = 50 }) =>
    supabase
      .from('tracker_banners')
      .upsert({ role_id: roleId, image_path: imagePath, position_y: positionY }, { onConflict: 'role_id' })
      .select(BANNER_SELECT)
      .single(),

  setBannerPosition: (roleId, positionY) =>
    supabase.from('tracker_banners').update({ position_y: positionY }).eq('role_id', roleId).select(BANNER_SELECT).single(),

  async deleteBanner(roleId) {
    const { data, error } = await supabase.from('tracker_banners').delete().eq('role_id', roleId).select('role_id');
    if (error) return { data: null, error };
    if (!data?.length) return notAllowed("You don't have access to this tracker.");
    return { data: data[0], error: null };
  },

  removeBannerFile: (path) => supabase.storage.from(BANNERS).remove([path]),

  /** A private file's URL for one hour. */
  async bannerUrl(path) {
    const { data, error } = await supabase.storage.from(BANNERS).createSignedUrl(path, 3600);
    return { data: data?.signedUrl ?? null, error };
  },

  // ------------------------------------------------------------ comments
  listComments: (itemId) => supabase.from('comments').select('*').eq('item_id', itemId).order('created_at'),
  addComment: (itemId, body) => supabase.from('comments').insert({ item_id: itemId, body }).select().single(),
  async deleteComment(id) {
    const { data, error } = await supabase.from('comments').delete().eq('id', id).select('id');
    if (error) return { data: null, error };
    if (!data?.length) return notAllowed('Only the author, or Admin, can delete this comment.');
    return { data: data[0], error: null };
  },

  // ------------------------------------------------------------ history
  listHistory: (itemId) =>
    supabase.from('activity_log').select('*').eq('item_id', itemId).order('created_at', { ascending: false }).limit(300),

  // ------------------------------------------------------------ people (Admin)
  listPeople: () => supabase.from('profiles').select(PERSON_SELECT).order('display_name'),
  async updatePerson(id, patch) {
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', id).select(PERSON_SELECT);
    if (error) return { data: null, error };
    if (!data?.length) return notAllowed('Only Admin can change people.');
    return { data: data[0], error: null };
  },

  // ------------------------------------------------------------ realtime
  /**
   * Live updates for one tracker (roleId), or for every tracker (roleId null: the Admin
   * dashboard). RLS applies, so only rows this person may read arrive. DELETE events can't
   * be filtered (they carry only the primary key), so they are subscribed unfiltered and
   * matched locally.
   * handlers: { onItem, onComment, onTarget, onBanner (tracker only), onStatus } — each (event, row)
   * Returns an unsubscribe function.
   */
  subscribeTracker(roleId, handlers) {
    const filter = roleId ? `role_id=eq.${roleId}` : null;
    const spec = (table, event) => ({ event, schema: 'public', table, ...(filter && event !== 'DELETE' ? { filter } : {}) });
    const name = `tracker-${roleId ?? 'all'}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase.channel(name);
    const watch = (table, handler) => {
      for (const event of ['INSERT', 'UPDATE', 'DELETE']) {
        channel.on('postgres_changes', spec(table, event), (p) => handler?.(event, event === 'DELETE' ? p.old : p.new));
      }
    };
    watch('content_items', handlers.onItem);
    watch('content_targets', handlers.onTarget);
    channel
      .on('postgres_changes', spec('comments', 'INSERT'), (p) => handlers.onComment?.('INSERT', p.new))
      .on('postgres_changes', spec('comments', 'DELETE'), (p) => handlers.onComment?.('DELETE', p.old));
    if (roleId) watch('tracker_banners', handlers.onBanner);
    channel.subscribe((status) => handlers.onStatus?.(status));
    return () => {
      supabase.removeChannel(channel);
    };
  },
};
