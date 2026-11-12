// DEV ONLY: the data API (same interface as data/api.js) over an in-memory store,
// with the same access rules as the RLS policies and triggers, so every screen can be exercised.
import { computeItem, uid } from './store.js';

const RLS = { message: 'new row violates row-level security policy for table "content_items"', code: '42501' };
const clone = (v) => JSON.parse(JSON.stringify(v));
const wait = (ms = 90) => new Promise((r) => setTimeout(r, ms));
const TRACKED = ['content', 'type', 'brief', 'caption', 'notes', 'publish_date', 'reference', 'content_pillars', 'instagram_url', 'brand_id', 'status', 'pic_id'];
const BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const RLS_PROJECTS = { code: '42501', message: 'new row violates row-level security policy for table "projects"' };
const RLS_ASSIGNEES = { code: '42501', message: 'new row violates row-level security policy for table "project_assignees"' };
const RLS_STORAGE = { statusCode: '403', message: 'new row violates row-level security policy' };
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

  // ---------------------------------------------------------------- v3: projects (06_update_v3.sql §3)
  const projectSubs = new Set();
  const emitProject = (table, event, row) => projectSubs.forEach((fn) => fn(table, event, clone(row)));
  const assigneesOf = (projectId) => store.projectAssignees.filter((a) => a.project_id === projectId).map((a) => a.profile_id);
  const isMember = (projectId) => store.projectAssignees.some((a) => a.project_id === projectId && a.profile_id === me()?.id);
  const canSeeProject = (p) => Boolean(me()?.is_active) && (isAdmin() || isMember(p.id));
  const withAssignees = (p) => ({ ...p, project_assignees: assigneesOf(p.id).map((profile_id) => ({ profile_id })) });
  const logProject = (action, project, changes, actor = me()) =>
    log({ role_id: 'projects', item_id: null, actor_id: actor.id, actor_name: actor.display_name, action, summary: project.name, changes });

  /** Mirror of projects_before_write(): staff may only change the status. */
  function applyProjectUpdate(project, patch, actor) {
    const admin = actor.role_id === 'admin' && actor.is_active;
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
      if (blob.size > 2 * 1024 * 1024) return fail({ statusCode: '413', message: 'The object exceeded the maximum allowed size' });
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
      if (!isAdmin()) return fail(RLS_PROJECTS);
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
      if (!project || !isAdmin()) return fail('Only Admin can do this.');
      store.projects.splice(store.projects.indexOf(project), 1);
      store.projectAssignees = store.projectAssignees.filter((a) => a.project_id !== id);
      logProject('project_deleted', project, { deleted_row: clone(project) });
      emitProject('projects', 'DELETE', { id });
      return ok({ id });
    },
    async addProjectAssignees(projectId, profileIds) {
      if (!profileIds.length) return ok([]);
      if (!isAdmin()) return fail(RLS_ASSIGNEES);
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
        isAdmin()
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
  /** Someone else changes a project (e.g. an assigned staff member marks it done). */
  api.remoteProject = (projectId, patch, personId = 'u-dika') => {
    const project = store.projects.find((p) => p.id === projectId);
    const actor = store.people.find((p) => p.id === personId);
    return project ? applyProjectUpdate(project, patch, actor) : null;
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
