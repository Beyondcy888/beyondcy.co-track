# 07 · Database v3: what changed and how to use it

The owner runs `supabase/06_update_v3.sql` once. It was tested role by role before delivery. **Don't change the database**; adapt the app. Nothing existing was removed or changed. It only adds:

| Added | Purpose |
|---|---|
| `profiles.avatar_path`, `profiles.avatar_updated_at` | profile photo |
| function `set_profile_avatar(p_profile_id, p_path)` | the **only** way to set or remove a photo (self, or Admin for anyone) |
| bucket `avatars` (private, 2 MB, JPG/PNG/WebP) | photo files at `<profile_id>/<file>` |
| view `people` | names + photos of **everyone**, readable by every signed-in user. **No emails.** |
| type `project_status` (`open`, `done`) | |
| table `projects` | one-off projects |
| table `project_assignees` | who's assigned |
| function `is_project_member(project_id)` | used by the security rules |
| realtime on `projects`, `project_assignees` | live updates |

## Queries (supabase-js v2)

```js
// everyone's name + photo (no emails)
const { data: people } = await supabase
  .from('people')
  .select('id, display_name, avatar_path, avatar_updated_at, role_id, role_name, is_admin, is_active');

// photo URLs in one batch (private bucket)
const paths = people.filter(p => p.avatar_path).map(p => p.avatar_path);
const { data: urls } = await supabase.storage.from('avatars').createSignedUrls(paths, 3600);

// set my photo
const path = `${me.id}/${crypto.randomUUID()}.webp`;
await supabase.storage.from('avatars').upload(path, webpBlob, { contentType: 'image/webp' });
await supabase.rpc('set_profile_avatar', { p_profile_id: me.id, p_path: path });
await supabase.storage.from('avatars').remove([oldPath]);          // if there was one

// remove a photo
await supabase.rpc('set_profile_avatar', { p_profile_id: personId, p_path: null });

// projects I can see (staff: only mine; Admin: all) with assignees
const { data: projects } = await supabase
  .from('projects')
  .select('*, project_assignees(profile_id)')
  .order('due_date');

// create (Admin)
const { data: project } = await supabase
  .from('projects').insert({ name, description, due_date }).select().single();
await supabase.from('project_assignees')
  .insert(assigneeIds.map(id => ({ project_id: project.id, profile_id: id })));

// edit (Admin): update fields, then add/remove assignee differences
await supabase.from('projects').update({ name, description, due_date }).eq('id', id);
await supabase.from('project_assignees').delete().eq('project_id', id).in('profile_id', removedIds);

// mark done / reopen (Admin or assigned staff)
await supabase.from('projects').update({ status: 'done' }).eq('id', id).select().single();

// delete (Admin)
await supabase.from('projects').delete().eq('id', id);

// drag content to another day (staff in own tracker, Admin anywhere)
await supabase.from('content_items').update({ publish_date: '2026-11-04' }).eq('id', itemId).select().single();
// drag to "No date"
await supabase.from('content_items').update({ publish_date: null }).eq('id', itemId).select().single();

// drag a project (Admin only)
await supabase.from('projects').update({ due_date: '2026-11-20' }).eq('id', projectId);
```

When creating a project, if adding assignees fails after the project was created, show the error and keep the dialog open, so Admin can fix it and save again (assignees only).

## Realtime

Subscribe to `projects` and `project_assignees` (no filter; the security rules decide what each person receives), alongside the existing tracker subscriptions. Refresh `people` on tab focus and after photo changes. Views can't be subscribed to.

## Messages from the database (show them as-is)

| Message | When |
|---|---|
| "You can only change your own photo." | Staff trying to change someone else's photo |
| "The photo must be stored in that person's folder." | Wrong storage path |
| "Only active staff members can be assigned to a project." | Assigning Admin or an inactive person |
| `new row violates row-level security policy …` | Staff trying something only Admin may do. Show "Only Admin can do this." |

Staff edits to a project's name, description or deadline are **silently ignored** by the database; only `status` changes. Hide those controls for staff.

## Security notes

- `people` deliberately shows every person's name and photo to all signed-in users, because projects mix people from different trackers. It **never** includes email. Keep using `profiles` for anything needing email (Admin People page) or your own role.
- Staff can't update their own `profiles` row (that would let them change their role). The photo goes through `set_profile_avatar`.
