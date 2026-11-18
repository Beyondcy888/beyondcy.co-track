// Every database call the app makes, behind one small interface.
// (The dev-only mock in src/dev/mock implements the same interface with fake data.)
//
// Rules from 04_DATABASE_GUIDE.md and 09_UPDATE_V2.md §1:
//   - never send status, missing_fields, uploaded_at, owner_id, created_at,
//     updated_at, updated_by, updated_by_name (items) or role_id, author_* (comments)
//   - content_targets: never send role_id, target_total, set_by, updated_at (the DB sets them)
//   - pic_id: staff can't set it (the DB uses them); Admin sends it only where a choice is needed
//   - always use the row the database returns
// Update v3 (07_DATABASE_V3.md):
//   - names and photos of everyone come from the `people` view (no emails)
//   - a photo changes only through set_profile_avatar(); files live at avatars/<profile_id>/<file>
//   - projects: never send status-derived or name columns (completed_*, created_*, updated_*)
// Update v4 (09_DATABASE_V4.md):
//   - never send status; send links / self_posted, and review_state only to trigger a review step
//   - never read or write instagram_url (kept only so old app versions don't break)
//   - note pictures live at note-images/<role_id>/<item_id>/<file> (≤ 3 per item, ≤ 2 MB each)
//   - banners belong to people: user_banners + user-banners/<profile_id>/<file>
//   - site_maintenance is readable by everyone (even signed out); it changes only through the RPCs
import { supabase } from '../lib/supabase.js';

const ITEM_SELECT = '*, comments(count)';
const PERSON_SELECT = 'id, email, display_name, role_id, is_active, created_at';
const TARGET_SELECT =
  'id, month, role_id, brand_id, profile_id, target_reels, target_feed, target_total, note, set_by, updated_at';
const USER_BANNER_SELECT = 'profile_id, image_path, position_y, updated_at';
const USER_BANNERS = 'user-banners';
const NOTE_IMAGES = 'note-images';
const MAINTENANCE_SELECT = 'site, is_on, starts_at, ends_at, set_by_name, ended_reason, updated_at';
const PEOPLE_SELECT = 'id, display_name, avatar_path, avatar_updated_at, role_id, role_name, is_admin, is_active';
const AVATARS = 'avatars';
const PROJECT_SELECT = '*, project_assignees(profile_id)';
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

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

/**
 * Flatten `project_assignees: [{ profile_id }]` into `assignees: [id]`. Rows without the
 * embed (realtime payloads, already-normalized rows) keep their own or the previous list.
 */
export function normalizeProject(row, prev) {
  if (!row) return row;
  const { project_assignees, ...rest } = row;
  const assignees = Array.isArray(project_assignees) ? project_assignees.map((a) => a.profile_id) : rest.assignees ?? prev?.assignees ?? [];
  return { ...rest, assignees };
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
  /** Everyone's name, photo and tracker (the `people` view: every signed-in person may read it; no emails). */
  listProfiles: () => supabase.from('people').select(PEOPLE_SELECT).order('display_name'),

  // ------------------------------------------------------------ profile photos (private bucket `avatars`)
  /** Signed URLs (1 hour) for many photos in one request → { data: { [path]: url } }. */
  async avatarUrls(paths) {
    if (!paths.length) return { data: {}, error: null };
    const { data, error } = await supabase.storage.from(AVATARS).createSignedUrls(paths, 3600);
    if (error) return { data: null, error };
    const urls = {};
    for (const row of data ?? []) if (row.signedUrl && !row.error) urls[row.path] = row.signedUrl;
    return { data: urls, error: null };
  },

  /** Upload to avatars/<profileId>/<uuid>.<ext>; returns { data: { path } }. */
  async uploadAvatar(profileId, blob, ext = 'webp') {
    const path = `${profileId}/${newId()}.${ext}`;
    const { error } = await supabase.storage
      .from(AVATARS)
      .upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '3600' });
    return { data: error ? null : { path }, error };
  },

  /** The only way to set (path) or remove (null) a photo: yourself, or Admin for anyone. */
  setAvatar: (profileId, path) => supabase.rpc('set_profile_avatar', { p_profile_id: profileId, p_path: path }),

  removeAvatarFile: (path) => supabase.storage.from(AVATARS).remove([path]),

  /** The stored photo as a Blob (for "Adjust": no cross-origin canvas trouble). */
  async downloadAvatar(path) {
    const { data, error } = await supabase.storage.from(AVATARS).download(path);
    return { data: data ?? null, error };
  },

  // ------------------------------------------------------------ projects
  /** Projects this person may see (staff: the ones they're assigned to; Admin: all), with assignees. */
  async listProjects() {
    const result = await supabase.from('projects').select(PROJECT_SELECT).order('due_date').order('created_at');
    return { data: result.data?.map((row) => normalizeProject(row)) ?? null, error: result.error };
  },

  /** Admin only (RLS). Assignees are added separately with addProjectAssignees. */
  async createProject({ name, description, dueDate }) {
    const result = await supabase
      .from('projects')
      .insert({ name, description: description || null, due_date: dueDate })
      .select(PROJECT_SELECT)
      .single();
    return { data: result.data ? normalizeProject(result.data) : null, error: result.error };
  },

  /**
   * Admin: name, description, due_date and status. Assigned staff: status only (the
   * database silently keeps everything else). RLS turns a refused update into "0 rows".
   */
  async updateProject(id, patch) {
    const { data, error } = await supabase.from('projects').update(patch).eq('id', id).select(PROJECT_SELECT);
    if (error) return { data: null, error };
    if (!data?.length) return notAllowed('This project is no longer available to you.');
    return { data: normalizeProject(data[0]), error: null };
  },

  async deleteProject(id) {
    const { data, error } = await supabase.from('projects').delete().eq('id', id).select('id');
    if (error) return { data: null, error };
    if (!data?.length) return notAllowed('Only Admin can do this.');
    return { data: data[0], error: null };
  },

  /** Admin only. Only active staff can be assigned (the database says so in words). */
  async addProjectAssignees(projectId, profileIds) {
    if (!profileIds.length) return { data: [], error: null };
    return supabase
      .from('project_assignees')
      .insert(profileIds.map((id) => ({ project_id: projectId, profile_id: id })))
      .select('profile_id');
  },

  async removeProjectAssignees(projectId, profileIds) {
    if (!profileIds.length) return { data: [], error: null };
    return supabase.from('project_assignees').delete().eq('project_id', projectId).in('profile_id', profileIds).select('profile_id');
  },

  /** A project's history (activity_log, role_id 'projects'): Admin can read it. */
  listProjectHistory: (projectId) =>
    supabase
      .from('activity_log')
      .select('*')
      .eq('role_id', 'projects')
      .eq('changes->>project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(100),

  /**
   * Live updates for projects and their assignees (no filter: RLS decides what arrives).
   * `onChange(table, event, row)`; returns an unsubscribe function.
   */
  subscribeProjects(onChange) {
    const channel = supabase.channel(`projects-${Math.random().toString(36).slice(2, 8)}`);
    for (const table of ['projects', 'project_assignees']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, (p) =>
        onChange(table, p.eventType, p.eventType === 'DELETE' ? p.old : p.new),
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },

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

  // ------------------------------------------------------------ Notes pictures (v4, private bucket note-images)
  /** Signed URLs (1 hour) for many pictures in one request → { data: { [path]: url } }. */
  async noteImageUrls(paths) {
    if (!paths.length) return { data: {}, error: null };
    const { data, error } = await supabase.storage.from(NOTE_IMAGES).createSignedUrls(paths, 3600);
    if (error) return { data: null, error };
    const urls = {};
    for (const row of data ?? []) if (row.signedUrl && !row.error) urls[row.path] = row.signedUrl;
    return { data: urls, error: null };
  },

  /** Upload as-is (never compressed: the owner's decision) to note-images/<roleId>/<itemId>/<uuid>.<ext>. */
  async uploadNoteImage(roleId, itemId, file) {
    const path = `${roleId}/${itemId}/${newId()}.${EXT[file.type] ?? 'jpg'}`;
    const { error } = await supabase.storage
      .from(NOTE_IMAGES)
      .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' });
    return { data: error ? null : { path }, error };
  },

  removeNoteImages: (paths) =>
    paths?.length ? supabase.storage.from(NOTE_IMAGES).remove(paths) : Promise.resolve({ data: [], error: null }),

  // ------------------------------------------------------------ banners (v4: one per person, user_banners)
  getUserBanner: (profileId) =>
    supabase.from('user_banners').select(USER_BANNER_SELECT).eq('profile_id', profileId).maybeSingle(),

  /** Upload to user-banners/<profileId>/<uuid>.<ext>; returns { data: { path } }. */
  async uploadUserBannerFile(profileId, blob, ext) {
    const path = `${profileId}/${newId()}.${ext}`;
    const { error } = await supabase.storage
      .from(USER_BANNERS)
      .upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '3600' });
    return { data: error ? null : { path }, error };
  },

  saveUserBanner: ({ profileId, imagePath, positionY = 50 }) =>
    supabase
      .from('user_banners')
      .upsert({ profile_id: profileId, image_path: imagePath, position_y: positionY }, { onConflict: 'profile_id' })
      .select(USER_BANNER_SELECT)
      .single(),

  setUserBannerPosition: (profileId, positionY) =>
    supabase.from('user_banners').update({ position_y: positionY }).eq('profile_id', profileId).select(USER_BANNER_SELECT).single(),

  /** Your own banner, or (Admin) anyone's. */
  async deleteUserBanner(profileId) {
    const { data, error } = await supabase.from('user_banners').delete().eq('profile_id', profileId).select('profile_id');
    if (error) return { data: null, error };
    if (!data?.length) return notAllowed("You can't remove this banner.");
    return { data: data[0], error: null };
  },

  removeUserBannerFile: (path) => supabase.storage.from(USER_BANNERS).remove([path]),

  /** A private banner file's URL for one hour. */
  async userBannerUrl(path) {
    const { data, error } = await supabase.storage.from(USER_BANNERS).createSignedUrl(path, 3600);
    return { data: data?.signedUrl ?? null, error };
  },

  /** Live banner changes (anyone signed in may read them). onChange(event, row); DELETE rows carry only profile_id. */
  subscribeUserBanners(onChange) {
    const channel = supabase
      .channel(`user-banners-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_banners' }, (p) =>
        onChange(p.eventType, p.eventType === 'DELETE' ? p.old : p.new),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
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

  /** Activity Logs (v4, file 05): newest first, 100 at a time; `before` = the last row's created_at. */
  searchActivity: ({ query = null, brand = null, category = null, before = null, limit = 100 } = {}) =>
    supabase.rpc('search_activity', {
      p_query: query || null,
      p_brand: brand || null,
      p_category: category || null,
      p_before: before || null,
      p_limit: limit,
    }),

  // ------------------------------------------------------------ push notifications (v4, file 06)
  savePushSubscription: ({ endpoint, p256dh, auth, userAgent = null }) =>
    supabase.rpc('save_push_subscription', { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth, p_user_agent: userAgent }),

  removePushSubscription: (endpoint) => supabase.rpc('remove_push_subscription', { p_endpoint: endpoint }),

  // ------------------------------------------------------------ maintenance (v4, file 10)
  /** Both rows of site_maintenance ('dashboard', 'tracker'): readable by everyone, even signed out. */
  getMaintenance: () => supabase.from('site_maintenance').select(MAINTENANCE_SELECT),

  /** Live changes to either row; onChange(row). Returns an unsubscribe function. */
  subscribeMaintenance(onChange) {
    const channel = supabase
      .channel(`maintenance-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_maintenance' }, (p) =>
        onChange(p.new && Object.keys(p.new).length ? p.new : p.old),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },

  /** True only for the Admin Beyondcy account (stored by account id). Signed-in only. */
  isMaintenanceExempt: () => supabase.rpc('is_maintenance_exempt'),
  startMaintenance: (site, minutes) => supabase.rpc('start_maintenance', { p_site: site, p_minutes: minutes }),
  extendMaintenance: (site, minutes) => supabase.rpc('extend_maintenance', { p_site: site, p_minutes: minutes }),
  endMaintenance: (site) => supabase.rpc('end_maintenance', { p_site: site }),

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
   * handlers: { onItem, onComment, onTarget, onStatus } — each (event, row)
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
    channel.subscribe((status) => handlers.onStatus?.(status));
    return () => {
      supabase.removeChannel(channel);
    };
  },
};
