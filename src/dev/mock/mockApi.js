// DEV ONLY: the data API (same interface as data/api.js) over an in-memory store,
// with the same access rules as the RLS policies and triggers, so every screen can be exercised.
import { addLog, blankItem, computeItem, isAdminPerson, uid } from './store.js';

const RLS = { message: 'new row violates row-level security policy for table "content_items"', code: '42501' };
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
// ?slow=1500 on the mock URL adds that many ms to every answer (to see the skeletons, v4 file 11)
const wait = (ms = 90) => new Promise((r) => setTimeout(r, ms + (globalThis.__mockDelay ?? 0)));
const TRACKED = ['content', 'type', 'brief', 'caption', 'notes', 'note_images', 'publish_date', 'reference', 'content_pillars', 'links', 'self_posted', 'review_state', 'revision_note', 'brand_id', 'status', 'pic_id'];
const BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const NOTE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const RLS_PROJECTS = { code: '42501', message: 'new row violates row-level security policy for table "projects"' };
const RLS_ASSIGNEES = { code: '42501', message: 'new row violates row-level security policy for table "project_assignees"' };
const RLS_STORAGE = { statusCode: '403', message: 'new row violates row-level security policy' };
const TOO_BIG = { statusCode: '413', message: 'The object exceeded the maximum allowed size' };
const inRange = (d, r) => !d || (d >= r.start && d <= r.end);
const PAGE_NAME = { dashboard: 'Dashboard', tracker: 'Tracker' };

export function createMockApi(store, personaRef) {
  const me = () => store.people.find((p) => p.id === personaRef.current) ?? null;
  const myRole = () => (me()?.is_active ? me().role_id : null);
  const isAdmin = () => isAdminPerson(store, me());
  const isExempt = () => Boolean(me() && store.exempt.includes(me().id));
  const maint = (site) => store.maintenance.find((m) => m.site === site);
  /** tracker_locked(): tracker maintenance runs (after a 60 s grace) and this person isn't exempt. */
  const trackerLocked = () => {
    const m = maint('tracker');
    const now = Date.now();
    return Boolean(me() && !isExempt() && m.is_on && now >= Date.parse(m.starts_at) + 60000 && now < Date.parse(m.ends_at));
  };
  const canAccess = (roleId) => !trackerLocked() && (isAdmin() || (roleId != null && roleId === myRole()));
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
  /** kind: item | comment | target. DELETE events go to everyone (they carry only the key). */
  const emit = (kind, event, row) =>
    subs.forEach((s) => {
      if (event !== 'DELETE' && s.roleId && row.role_id !== s.roleId) return;
      if (event !== 'DELETE' && !s.roleId && !s.admin) return;
      const payload = event === 'DELETE' ? { id: row.id } : clone(row);
      if (kind === 'item') s.h.onItem?.(event, payload);
      if (kind === 'comment') s.h.onComment?.(event, payload);
      if (kind === 'target') s.h.onTarget?.(event, payload);
    });
  const log = (entry) => addLog(store, entry);

  // ---------------------------------------------------------------- v3: projects (06_update_v3.sql §3)
  const projectSubs = new Set();
  const emitProject = (table, event, row) => projectSubs.forEach((fn) => fn(table, event, clone(row)));
  const assigneesOf = (projectId) => store.projectAssignees.filter((a) => a.project_id === projectId).map((a) => a.profile_id);
  const isMember = (projectId) => !trackerLocked() && store.projectAssignees.some((a) => a.project_id === projectId && a.profile_id === me()?.id);
  const canSeeProject = (p) => Boolean(me()?.is_active) && ((isAdmin() && !trackerLocked()) || isMember(p.id));
  const withAssignees = (p) => ({ ...p, project_assignees: assigneesOf(p.id).map((profile_id) => ({ profile_id })) });
  const logProject = (action, project, changes, actor = me()) =>
    log({ role_id: 'projects', item_id: null, actor_id: actor.id, actor_name: actor.display_name, action, summary: project.name, changes });

  /** Mirror of projects_before_write(): staff may only change the status. */
  function applyProjectUpdate(project, patch, actor) {
    const admin = isAdminPerson(store, actor);
    const before = { ...project };
    if (admin) {
      if ('name' in patch) {
        const name = String(patch.name ?? '').trim();
        if (!name || name.length > 200) return { error: { code: '23514', message: 'new row for relation "projects" violates check constraint "projects_name_check"' } };
        project.name = name;
      }
      if ('description' in patch) project.description = patch.description == null ? null : String(patch.description).trim() || null;
      if ('due_date' in patch) {
        if (!patch.due_date) return { error: { code: '23502', message: 'null value in column "due_date" of relation "projects" violates not-null constraint' } };
        project.due_date = patch.due_date;
      }
    }
    if ('status' in patch && patch.status !== project.status) {
      project.status = patch.status;
      if (patch.status === 'done') {
        project.completed_at = new Date().toISOString();
        project.completed_by = actor.id;
        project.completed_by_name = actor.display_name;
      } else {
        project.completed_at = null;
        project.completed_by = null;
        project.completed_by_name = null;
      }
    }
    project.updated_at = new Date().toISOString();
    project.updated_by = actor.id;
    project.updated_by_name = actor.display_name;
    const changes = {};
    for (const f of ['name', 'description', 'due_date', 'status']) {
      if (before[f] !== project[f]) changes[f] = { old: before[f] ?? null, new: project[f] ?? null };
    }
    if (Object.keys(changes).length) {
      const action = changes.status ? (project.status === 'done' ? 'project_completed' : 'project_reopened') : 'project_updated';
      logProject(action, project, { ...changes, project_id: project.id }, actor);
    }
    emitProject('projects', 'UPDATE', project);
    return { row: project };
  }

  function applyUpdate(id, patch, actor, { locked = false } = {}) {
    const old = store.items.find((i) => i.id === id);
    if (!old) return { error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } };
    const { row, error } = computeItem(store, { ...old, ...clone(patch), id: old.id, role_id: old.role_id, owner_id: old.owner_id }, old, actor, { locked });
    if (error) return { error: { message: error } };
    const changes = {};
    for (const f of TRACKED) {
      if (JSON.stringify(old[f] ?? null) !== JSON.stringify(row[f] ?? null)) changes[f] = { old: clone(old[f]) ?? null, new: clone(row[f]) ?? null };
    }
    Object.assign(old, row);
    if (Object.keys(changes).length) {
      log({ role_id: old.role_id, item_id: old.id, actor_id: actor?.id ?? null, actor_name: actor?.display_name ?? null, action: 'item_updated', summary: old.content, changes });
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
    const [y, mo] = month.split('-').map(Number);
    const label = new Date(Date.UTC(y, mo - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    log({
      role_id: row.role_id, actor_id: me().id, actor_name: me().display_name, action: 'target_set', summary: label,
      changes: { brand_id: brandId, profile_id: profileId, reels: { old: before?.target_reels ?? null, new: reels }, feed: { old: before?.target_feed ?? null, new: feed }, note: { old: before?.note ?? null, new: row.note } },
    });
    emit('target', existing ? 'UPDATE' : 'INSERT', row);
    return { row };
  }

  // ---------------------------------------------------------------- v4: per-person banners (user_banners)
  const bannerSubs = new Set();
  const emitBanner = (event, row) => bannerSubs.forEach((fn) => fn(event, event === 'DELETE' ? { profile_id: row.profile_id } : clone(row)));

  // ---------------------------------------------------------------- v4: maintenance (09_maintenance.sql)
  const maintSubs = new Set();
  const emitMaint = (row) => maintSubs.forEach((fn) => fn(clone(row)));
  const isActive = (m) => m.is_on && Date.now() < Date.parse(m.ends_at);
  const logMaint = (action, site, changes, actor = me()) =>
    addLog(store, { role_id: 'maintenance', actor_id: actor?.id ?? null, actor_name: actor?.display_name ?? 'Maintenance timer', action, summary: PAGE_NAME[site], changes }, actor ? {} : { source: 'supabase' });
  // the pg_cron timer: here every 5 s instead of every minute, so QA doesn't wait as long
  const timer = setInterval(() => {
    for (const m of store.maintenance) {
      if (m.is_on && Date.parse(m.ends_at) <= Date.now()) {
        Object.assign(m, { is_on: false, ended_reason: 'timer', updated_at: new Date().toISOString() });
        logMaint('maintenance_ended', m.site, { site: m.site, reason: 'timer finished' }, null);
        emitMaint(m);
      }
    }
  }, 5000);
  if (typeof window !== 'undefined') window.addEventListener('beforeunload', () => clearInterval(timer));

  const api = {
    listRoles: () => ok(store.roles),
    listBrands: () => ok(store.brands),
    listRoleBrands: () => ok(store.roleBrands),
    listPillars: () => ok(store.pillars),
    /** The `people` view: everyone's name, tracker and photo for every signed-in person. No emails. */
    listProfiles: () =>
      ok(
        me()
          ? store.people.map(({ id, display_name, avatar_path, avatar_updated_at, role_id, is_active }) => {
              const role = store.roles.find((r) => r.id === role_id);
              return { id, display_name, avatar_path, avatar_updated_at, role_id, role_name: role?.name ?? null, is_admin: Boolean(role?.is_admin), is_active };
            })
          : [],
      ),

    // -------------------------------------------------------------- profile photos (bucket avatars)
    async avatarUrls(paths) {
      await wait(40);
      if (!me()) return { data: null, error: { message: 'Unauthorized' } };
      const urls = {};
      for (const path of paths) if (store.files.has(path)) urls[path] = store.files.get(path);
      return { data: urls, error: null };
    },
    async uploadAvatar(profileId, blob, ext = 'webp') {
      if (!me() || (profileId !== me().id && !isAdmin())) return fail(RLS_STORAGE);
      if (!BANNER_TYPES.includes(blob.type)) return fail(`mime type ${blob.type || 'unknown'} is not supported`);
      if (blob.size > 2 * 1024 * 1024) return fail(TOO_BIG);
      const path = `${profileId}/${uid()}.${ext}`;
      store.files.set(path, URL.createObjectURL(blob));
      store.blobs.set(path, blob);
      return ok({ path });
    },
    /** Mirror of set_profile_avatar(): yourself, or Admin for anyone; the file must be in that person's folder. */
    async setAvatar(profileId, path) {
      if (!me() || (me().id !== profileId && !isAdmin())) return fail('You can only change your own photo.');
      if (path != null && path.split('/')[0] !== profileId) return fail("The photo must be stored in that person's folder.");
      const person = store.people.find((p) => p.id === profileId);
      if (!person) return fail('Person not found.');
      person.avatar_path = path ? path.trim() || null : null;
      person.avatar_updated_at = new Date().toISOString();
      return ok(null);
    },
    async removeAvatarFile(path) {
      if (!me() || (path.split('/')[0] !== me().id && !isAdmin())) return ok([]); // RLS: nothing deleted
      const url = store.files.get(path);
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
      store.files.delete(path);
      store.blobs.delete(path);
      return ok([]);
    },
    async downloadAvatar(path) {
      await wait(60);
      if (store.blobs.has(path)) return { data: store.blobs.get(path), error: null };
      const url = store.files.get(path);
      if (!url) return { data: null, error: { message: 'Object not found' } };
      const blob = await (await fetch(url)).blob();
      return { data: blob, error: null };
    },

    // -------------------------------------------------------------- projects
    listProjects: () =>
      ok(
        store.projects
          .filter(canSeeProject)
          .sort((a, b) => (a.due_date === b.due_date ? (a.created_at < b.created_at ? -1 : 1) : a.due_date < b.due_date ? -1 : 1))
          .map(withAssignees),
      ),
    async createProject({ name, description, dueDate }) {
      if (!isAdmin() || trackerLocked()) return fail(RLS_PROJECTS);
      const trimmed = String(name ?? '').trim();
      if (!trimmed || trimmed.length > 200) return fail({ code: '23514', message: 'new row for relation "projects" violates check constraint "projects_name_check"' });
      if (!dueDate) return fail({ code: '23502', message: 'null value in column "due_date" of relation "projects" violates not-null constraint' });
      const now = new Date().toISOString();
      const row = {
        id: uid(), name: trimmed, description: description == null ? null : String(description).trim() || null, due_date: dueDate, status: 'open',
        completed_at: null, completed_by: null, completed_by_name: null,
        created_by: me().id, created_by_name: me().display_name, created_at: now,
        updated_at: now, updated_by: me().id, updated_by_name: me().display_name,
      };
      store.projects.push(row);
      logProject('project_created', row, { project_id: row.id, due_date: row.due_date });
      emitProject('projects', 'INSERT', row);
      return ok(withAssignees(row));
    },
    async updateProject(id, patch) {
      const project = store.projects.find((p) => p.id === id);
      if (!project || !canSeeProject(project)) return fail('This project is no longer available to you.');
      const r = applyProjectUpdate(project, patch, me());
      return r.error ? fail(r.error) : ok(withAssignees(r.row));
    },
    async deleteProject(id) {
      const project = store.projects.find((p) => p.id === id);
      if (!project || !isAdmin() || trackerLocked()) return fail('Only Admin can do this.');
      store.projects.splice(store.projects.indexOf(project), 1);
      store.projectAssignees = store.projectAssignees.filter((a) => a.project_id !== id);
      logProject('project_deleted', project, { deleted_row: clone(project) });
      emitProject('projects', 'DELETE', { id });
      return ok({ id });
    },
    async addProjectAssignees(projectId, profileIds) {
      if (!profileIds.length) return ok([]);
      if (!isAdmin() || trackerLocked()) return fail(RLS_ASSIGNEES);
      for (const pid of profileIds) {
        const person = store.people.find((p) => p.id === pid);
        const role = store.roles.find((r) => r.id === person?.role_id);
        if (!person?.is_active || !role || role.is_admin) return fail('Only active staff members can be assigned to a project.');
      }
      const added = [];
      for (const pid of profileIds) {
        if (store.projectAssignees.some((a) => a.project_id === projectId && a.profile_id === pid)) {
          return fail({ code: '23505', message: 'duplicate key value violates unique constraint "project_assignees_pkey"' });
        }
        const row = { project_id: projectId, profile_id: pid, added_at: new Date().toISOString() };
        store.projectAssignees.push(row);
        added.push({ profile_id: pid });
        emitProject('project_assignees', 'INSERT', row);
      }
      return ok(added);
    },
    async removeProjectAssignees(projectId, profileIds) {
      if (!profileIds.length || !isAdmin()) return ok([]); // RLS: nothing deleted for staff
      const removed = store.projectAssignees.filter((a) => a.project_id === projectId && profileIds.includes(a.profile_id));
      store.projectAssignees = store.projectAssignees.filter((a) => !removed.includes(a));
      removed.forEach((a) => emitProject('project_assignees', 'DELETE', { project_id: a.project_id, profile_id: a.profile_id }));
      return ok(removed.map((a) => ({ profile_id: a.profile_id })));
    },
    listProjectHistory: (projectId) =>
      ok(
        isAdmin() && !trackerLocked()
          ? store.activity
              .filter((a) => a.role_id === 'projects' && a.changes?.project_id === projectId)
              .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id))
          : [],
      ),
    subscribeProjects(onChange) {
      projectSubs.add(onChange);
      return () => projectSubs.delete(onChange);
    },

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
        { ...blankItem(), id: uid(), role_id: roleId, brand_id: brandId, owner_id: actor.id, pic_id: picId, content: '', publish_date: publishDate, content_pillars: [], created_at: new Date().toISOString() },
        null,
        actor,
        { locked: trackerLocked() },
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
      const result = applyUpdate(id, patch, me(), { locked: trackerLocked() });
      if (result.error) return fail(result.error);
      return ok(withCount(result.row));
    },

    async deleteItem(id) {
      const item = store.items.find((i) => i.id === id);
      const mine = item && item.role_id === myRole() && (item.owner_id === me()?.id || item.pic_id === me()?.id);
      if (!item || trackerLocked() || !(isAdmin() || mine)) return fail('Only the person who created this item, its PIC or Admin can delete it.');
      store.items.splice(store.items.indexOf(item), 1);
      store.comments = store.comments.filter((c) => c.item_id !== id);
      log({ role_id: item.role_id, item_id: id, actor_id: me().id, actor_name: me().display_name, action: 'item_deleted', summary: item.content, changes: { deleted_row: clone(item) } });
      emit('item', 'DELETE', item);
      return ok({ id });
    },

    // -------------------------------------------------------------- v4: Notes pictures (bucket note-images)
    async noteImageUrls(paths) {
      await wait(50);
      if (!me()) return { data: null, error: { message: 'Unauthorized' } };
      const urls = {};
      for (const path of paths) {
        if (!canAccess(path.split('/')[0])) continue;
        const url = store.files.get(`note-images/${path}`);
        if (url) urls[path] = url;
      }
      return { data: urls, error: null };
    },
    async uploadNoteImage(roleId, itemId, file) {
      if (!me() || !canAccess(roleId)) return fail(RLS_STORAGE);
      if (!NOTE_TYPES.includes(file.type)) return fail(`mime type ${file.type || 'unknown'} is not supported`);
      if (file.size > 2 * 1024 * 1024) return fail(TOO_BIG);
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[file.type];
      const path = `${roleId}/${itemId}/${uid()}.${ext}`;
      store.files.set(`note-images/${path}`, URL.createObjectURL(file));
      await wait(250);
      return { data: { path }, error: null };
    },
    async removeNoteImages(paths) {
      for (const path of paths ?? []) {
        if (!canAccess(path.split('/')[0])) continue; // RLS: nothing deleted
        const url = store.files.get(`note-images/${path}`);
        if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
        store.files.delete(`note-images/${path}`);
      }
      return ok([]);
    },

    // -------------------------------------------------------------- targets
    listTargets: (roleId) => ok(canAccess(roleId) ? store.targets.filter((t) => t.role_id === roleId) : []),
    listAllTargets: () => ok(store.targets.filter((t) => canAccess(t.role_id))),
    listTargetsForMonths: (months) => ok(store.targets.filter((t) => months.includes(t.month) && canAccess(t.role_id))),
    async saveTarget(input) {
      if (!isAdmin() || trackerLocked()) return fail({ code: '42501', message: 'new row violates row-level security policy for table "content_targets"' });
      const r = upsertTarget(input);
      return r.error ? fail(r.error) : ok(r.row);
    },
    async saveTargets(rows) {
      if (!isAdmin() || trackerLocked()) return fail({ code: '42501', message: 'new row violates row-level security policy for table "content_targets"' });
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
      if (!isAdmin() || trackerLocked() || !row) return fail({ message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' });
      const old = row.note;
      row.note = note == null ? null : String(note).trim() || null;
      row.updated_at = new Date().toISOString();
      log({ role_id: row.role_id, actor_id: me().id, actor_name: me().display_name, action: 'target_set', summary: row.month, changes: { brand_id: row.brand_id, profile_id: row.profile_id, note: { old, new: row.note } } });
      emit('target', 'UPDATE', row);
      return ok(row);
    },
    async deleteTarget(id) {
      const row = store.targets.find((t) => t.id === id);
      if (!isAdmin() || trackerLocked() || !row) return fail('Only Admin can change targets.');
      store.targets.splice(store.targets.indexOf(row), 1);
      log({ role_id: row.role_id, actor_id: me().id, actor_name: me().display_name, action: 'target_removed', summary: row.month, changes: { brand_id: row.brand_id, profile_id: row.profile_id } });
      emit('target', 'DELETE', row);
      return ok({ id });
    },

    // -------------------------------------------------------------- v4: banners belong to people (user_banners)
    getUserBanner: (profileId) => ok(me() ? store.userBanners.find((b) => b.profile_id === profileId) ?? null : null),
    async uploadUserBannerFile(profileId, blob, ext) {
      if (!me() || profileId !== me().id) return fail(RLS_STORAGE);
      if (!BANNER_TYPES.includes(blob.type)) return fail(`mime type ${blob.type || 'unknown'} is not supported`);
      if (blob.size > 5 * 1024 * 1024) return fail(TOO_BIG);
      const path = `${profileId}/${uid()}.${ext}`;
      store.files.set(`user-banners/${path}`, URL.createObjectURL(blob));
      return ok({ path });
    },
    async saveUserBanner({ profileId, imagePath, positionY = 50 }) {
      if (!me() || profileId !== me().id) return fail({ code: '42501', message: 'new row violates row-level security policy for table "user_banners"' });
      if (imagePath.split('/')[0] !== profileId) return fail('The banner must be stored in your own folder.');
      let row = store.userBanners.find((b) => b.profile_id === profileId);
      const event = row ? 'UPDATE' : 'INSERT';
      if (!row) {
        row = { profile_id: profileId };
        store.userBanners.push(row);
      }
      Object.assign(row, { image_path: imagePath, position_y: positionY, updated_at: new Date().toISOString() });
      emitBanner(event, row);
      return ok(row);
    },
    async setUserBannerPosition(profileId, positionY) {
      const row = store.userBanners.find((b) => b.profile_id === profileId);
      if (!row || profileId !== me()?.id) return fail({ message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' });
      Object.assign(row, { position_y: positionY, updated_at: new Date().toISOString() });
      emitBanner('UPDATE', row);
      return ok(row);
    },
    async deleteUserBanner(profileId) {
      const row = store.userBanners.find((b) => b.profile_id === profileId);
      if (!row || !(profileId === me()?.id || isAdmin())) return fail("You can't remove this banner.");
      store.userBanners.splice(store.userBanners.indexOf(row), 1);
      emitBanner('DELETE', row);
      return ok({ profile_id: profileId });
    },
    async removeUserBannerFile(path) {
      if (!me() || !(path.split('/')[0] === me().id || isAdmin())) return ok([]);
      const url = store.files.get(`user-banners/${path}`);
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
      store.files.delete(`user-banners/${path}`);
      return ok([]);
    },
    async userBannerUrl(path) {
      await wait(40);
      if (!me()) return { data: null, error: { message: 'Unauthorized' } };
      const url = store.files.get(`user-banners/${path}`);
      return url ? { data: url, error: null } : { data: null, error: { message: 'Object not found' } };
    },
    /** onChange(event, row) for every user_banners change (DELETE rows carry only profile_id). */
    subscribeUserBanners(onChange) {
      bannerSubs.add(onChange);
      return () => bannerSubs.delete(onChange);
    },

    // -------------------------------------------------------------- comments
    listComments: (itemId) => {
      const item = store.items.find((i) => i.id === itemId);
      return ok(item && canAccess(item.role_id) ? store.comments.filter((c) => c.item_id === itemId).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)) : []);
    },
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
      if (!c || trackerLocked() || !(isAdmin() || c.author_id === me()?.id)) return fail('Only the author, or Admin, can delete this comment.');
      store.comments.splice(store.comments.indexOf(c), 1);
      log({ role_id: c.role_id, item_id: c.item_id, actor_id: me().id, actor_name: me().display_name, action: 'comment_deleted', summary: store.items.find((i) => i.id === c.item_id)?.content ?? null, changes: { comment_id: id, body: c.body } });
      emit('comment', 'DELETE', c);
      return ok({ id });
    },

    listHistory: (itemId) =>
      ok(
        store.activity
          .filter((a) => a.item_id === itemId && canAccess(a.role_id))
          .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id)),
      ),

    // -------------------------------------------------------------- v4: Activity Logs (search_activity)
    async searchActivity({ query = null, brand = null, category = null, before = null, limit = 100 } = {}) {
      await wait(160);
      if (!me()) return { data: [], error: null };
      const q = (query ?? '').trim().toLowerCase();
      const visible = (a) => !trackerLocked() && (isAdmin() || (a.role_id && a.role_id === myRole()));
      const rows = store.activity
        .filter(visible)
        .filter((a) => !brand || a.brand_id === brand)
        .filter((a) => !category || a.category === category)
        .filter((a) => !before || a.created_at < before)
        .filter((a) => !q || [a.summary, a.actor_name, a.action, JSON.stringify(a.changes)].some((v) => String(v ?? '').toLowerCase().includes(q)))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id))
        .slice(0, Math.min(Math.max(limit ?? 100, 1), 500));
      return { data: clone(rows), error: null };
    },

    // -------------------------------------------------------------- v4: push notification subscriptions
    async savePushSubscription({ endpoint, p256dh, auth, userAgent }) {
      if (!me()) return fail('Sign in first.');
      if (!/^https:\/\//.test(endpoint ?? '') || !p256dh || !auth) return fail('Invalid notification subscription.');
      store.pushSubs = store.pushSubs.filter((s) => s.endpoint !== endpoint);
      store.pushSubs.push({ profile_id: me().id, endpoint, p256dh, auth, user_agent: userAgent?.slice(0, 300) ?? null, created_at: new Date().toISOString() });
      return ok(null);
    },
    async removePushSubscription(endpoint) {
      store.pushSubs = store.pushSubs.filter((s) => !(s.endpoint === endpoint && s.profile_id === me()?.id));
      return ok(null);
    },

    // -------------------------------------------------------------- v4: maintenance
    /** Both rows of site_maintenance (readable by everyone, even signed out). */
    getMaintenance: () => ok(store.maintenance),
    /** onChange(row) on every change of either row. */
    subscribeMaintenance(onChange) {
      maintSubs.add(onChange);
      return () => maintSubs.delete(onChange);
    },
    async isMaintenanceExempt() {
      await wait(60);
      if (!me()) return { data: null, error: { code: '42501', message: 'permission denied for function is_maintenance_exempt' } };
      return { data: isExempt(), error: null };
    },
    async startMaintenance(site, minutes) {
      if (!isExempt()) return fail('Only Admin Beyondcy can turn on maintenance.');
      if (![30, 60, 120, 180].includes(minutes)) return fail('Choose 30 minutes, 1 hour, 2 hours or 3 hours.');
      const m = maint(site);
      if (!m) return fail('Choose Dashboard or Tracker.');
      if (isActive(m)) return fail(`${PAGE_NAME[site]} maintenance is already on. Use "Add time" or "End now".`);
      const now = Date.now();
      Object.assign(m, { is_on: true, starts_at: new Date(now).toISOString(), ends_at: new Date(now + minutes * 60000).toISOString(), set_by_name: me().display_name, ended_reason: null, updated_at: new Date(now).toISOString() });
      logMaint('maintenance_started', site, { site, minutes, ends_at: m.ends_at });
      emitMaint(m);
      return ok(m);
    },
    async extendMaintenance(site, minutes) {
      if (!isExempt()) return fail('Only Admin Beyondcy can change maintenance.');
      if (![30, 60, 120, 180].includes(minutes)) return fail('Choose 30 minutes, 1 hour, 2 hours or 3 hours.');
      const m = maint(site);
      if (!m || !isActive(m)) return fail(`${PAGE_NAME[site] ?? site} maintenance is not on.`);
      Object.assign(m, { ends_at: new Date(Date.parse(m.ends_at) + minutes * 60000).toISOString(), updated_at: new Date().toISOString() });
      logMaint('maintenance_extended', site, { site, added_minutes: minutes, ends_at: m.ends_at });
      emitMaint(m);
      return ok(m);
    },
    async endMaintenance(site) {
      if (!isExempt()) return fail('Only Admin Beyondcy can change maintenance.');
      const m = maint(site);
      if (!m || !m.is_on) return fail(`${PAGE_NAME[site] ?? site} maintenance is not on.`);
      const now = new Date().toISOString();
      Object.assign(m, { is_on: false, ends_at: now < m.ends_at ? now : m.ends_at, ended_reason: 'ended_early', updated_at: now });
      logMaint('maintenance_ended', site, { site, reason: 'ended early' });
      emitMaint(m);
      return ok(m);
    },

    // -------------------------------------------------------------- people (Admin)
    listPeople: () => (isAdmin() ? ok(store.people) : ok(store.people.filter((p) => p.id === me()?.id))),
    async updatePerson(id, patch) {
      if (!isAdmin()) return fail('Only Admin can change people.');
      const person = store.people.find((p) => p.id === id);
      const changes = {};
      for (const f of ['display_name', 'role_id', 'is_active', 'email']) {
        if (f in patch && patch[f] !== person[f]) changes[f] = { old: person[f] ?? null, new: patch[f] ?? null };
      }
      Object.assign(person, patch);
      if (Object.keys(changes).length) {
        log({ role_id: 'people', actor_id: me().id, actor_name: me().display_name, action: 'person_updated', summary: person.display_name, changes: { ...changes, profile_id: id } });
      }
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
  /** Someone else changes a project (e.g. an assigned staff member marks it done). */
  api.remoteProject = (projectId, patch, personId = 'u-dika') => {
    const project = store.projects.find((p) => p.id === projectId);
    const actor = store.people.find((p) => p.id === personId);
    return project ? applyProjectUpdate(project, patch, actor) : null;
  };
  /** Another tab of the same person moves or removes their banner (positionY null = remove). */
  api.remoteBanner = (profileId, positionY) => {
    const row = store.userBanners.find((b) => b.profile_id === profileId);
    if (!row) return null;
    if (positionY == null) {
      store.userBanners.splice(store.userBanners.indexOf(row), 1);
      emitBanner('DELETE', row);
      return null;
    }
    Object.assign(row, { position_y: positionY, updated_at: new Date().toISOString() });
    emitBanner('UPDATE', row);
    return row;
  };
  /** Admin Beyondcy switches maintenance from "another tab": remoteMaintenance('tracker', 30) / ('tracker', 0) ends it. */
  api.remoteMaintenance = (site, minutes) => {
    const m = maint(site);
    const now = Date.now();
    if (minutes > 0) Object.assign(m, { is_on: true, starts_at: new Date(now).toISOString(), ends_at: new Date(now + minutes * 60000).toISOString(), set_by_name: 'Admin Beyondcy', ended_reason: null });
    else Object.assign(m, { is_on: false, ended_reason: 'ended_early', ends_at: new Date(now).toISOString() });
    m.updated_at = new Date(now).toISOString();
    emitMaint(m);
    return clone(m);
  };

  return api;
}
