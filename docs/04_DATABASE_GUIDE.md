# 04 · Database guide (how the app uses Supabase)

> **Update v2:** `monthly_targets` (replaced by `content_targets`), `content_items.pic_id` and `tracker_banners` + the `tracker-banners` bucket changed in `09_UPDATE_V2.md`. Where this file disagrees with 09, 09 wins.

The schema is in `../supabase/01_schema.sql` (already run by the owner). It has been tested role by role. **Read it once**; this file explains how the frontend should use it.

## Tables at a glance

| Table | What it holds | App can |
|---|---|---|
| `brands` | 9 brands (`lahap`, `kedai_makmoer_88`, `beefix`, `homy8`, `behomy`, `behomy_group`, `corvel`, `hoteru`, `purnava`) | read |
| `roles` | `admin`, `lahap_makmoer`, `beefix`, `homy8`, `behomy`, with `layout` and `is_admin` | read (Admin may write) |
| `role_brands` | which brands are in which tracker | read |
| `brand_pillars` | Homy8 pillar options | read |
| `profiles` | one per login: `display_name`, `role_id`, `is_active` | read self, teammates and Admin; Admin updates |
| `content_items` | tracker rows | read/insert/update in own tracker; delete if owner or Admin |
| `comments` | comment threads | read/insert in own tracker; delete own (Admin: any) |
| `activity_log` | edit history (written by triggers) | read only |
| `monthly_targets` | targets | read only; Admin writes through `set_monthly_target()` |

## Values the app must never send

On `content_items`: `status`, `missing_fields`, `uploaded_at`, `owner_id`, `created_at`, `updated_at`, `updated_by`, `updated_by_name`. On `comments`: `role_id`, `author_id`, `author_name`. The database sets or protects these, and changing `role_id` or `owner_id` on update is silently ignored. Always use the row the database returns (`.select()` after insert/update).

## Common queries (supabase-js v2)

```js
// current user's profile + role
const { data: me } = await supabase
  .from('profiles')
  .select('id, display_name, role_id, is_active, role:roles(id, name, is_admin, layout)')
  .eq('id', session.user.id)
  .single();

// brands in a tracker (for brand pages and the Brand dropdown)
const { data: brands } = await supabase
  .from('role_brands')
  .select('brand:brands(id, name, sort_order)')
  .eq('role_id', roleId);

// trackers list for Admin's "Choose a tracker"
await supabase.from('roles').select('*').eq('is_admin', false).order('sort_order');

// people in a team tracker (Behomy lanes)
await supabase.from('profiles').select('id, display_name')
  .eq('role_id', 'behomy').eq('is_active', true).order('display_name');

// items for a tracker (all months; filter per page in the client)
const { data: items } = await supabase
  .from('content_items')
  .select('*, comments(count)')
  .eq('role_id', roleId)
  .order('publish_date', { ascending: true, nullsFirst: false });

// create an item (brand required)
const { data, error } = await supabase
  .from('content_items')
  .insert({ role_id: roleId, brand_id: brandId, content: '' , publish_date: dateOrNull })
  .select('*, comments(count)').single();

// save one field
await supabase.from('content_items').update({ caption }).eq('id', id).select('*, comments(count)').single();

// Homy8 pillars
await supabase.from('brand_pillars').select('name').eq('brand_id', 'homy8').order('sort_order');

// targets for a tracker and month (month = first day, 'YYYY-MM-01')
await supabase.from('monthly_targets').select('*').eq('role_id', roleId).eq('month', '2026-11-01');

// Admin sets a target (null = remove)
await supabase.rpc('set_monthly_target', {
  p_role_id: 'lahap_makmoer', p_month: '2026-11-01', p_target: 12,
  p_brand_id: 'kedai_makmoer_88',   // single / multi_brand trackers
  p_profile_id: null                // team tracker: person's id instead, brand null
});

// comments
await supabase.from('comments').select('*').eq('item_id', id).order('created_at');
await supabase.from('comments').insert({ item_id: id, body }).select().single();

// history for one item
await supabase.from('activity_log').select('*').eq('item_id', id).order('created_at', { ascending: false });

// Admin People page
await supabase.from('profiles').select('id, email, display_name, role_id, is_active').order('display_name');
await supabase.from('profiles').update({ role_id, display_name, is_active }).eq('id', personId);
```

## Target lookup rules

| Layout | Rows in `monthly_targets` for a month |
|---|---|
| `single` | `brand_id` = the brand, `profile_id` null |
| `multi_brand` | one per brand (`brand_id` set, `profile_id` null). Total = sum. |
| `team` | one per person (`profile_id` set, `brand_id` null). Team total = sum. |

## Activity log format

`action` is one of `item_created`, `item_updated`, `item_deleted`, `comment_added`, `comment_deleted`, `target_set`.

`changes` examples:
```json
{"caption": {"old": "Promo lama", "new": "Promo baru"}, "status": {"old": "not_started", "new": "planned"}}
{"deleted_row": { ...full item... }}
{"brand_id": "lahap", "profile_id": null, "target": {"old": 10, "new": 12}}
```
Render using `actor_name` (stored at the time of the change, so it stays correct after people move roles). A status change appears alongside the field change that caused it. Show it as one history line: "Dika added the Instagram link · status → Uploaded".

## Realtime

The `content_items`, `comments` and `monthly_targets` tables are in the `supabase_realtime` publication. Subscribe per open tracker:

```js
supabase.channel(`tracker-${roleId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'content_items', filter: `role_id=eq.${roleId}` }, onItem)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `role_id=eq.${roleId}` }, onComment)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_targets', filter: `role_id=eq.${roleId}` }, onTarget)
  .subscribe();
```
RLS applies to realtime, so users only receive their own tracker's changes. Unsubscribe when leaving the tracker or signing out. If realtime drops, refetch when the tab regains focus.

## Errors to show as-is (they are written for users)

- "Fill in every field before adding the Instagram link. Missing: notes, reference"
- "This item is already uploaded, so every field must stay filled. Missing: caption"
- "Uploaded content must be an Instagram post link, e.g. https://www.instagram.com/p/..."
- "Unknown content pillar(s): …"
- "Only Admin can set targets."
- "Brand "…" is not part of this tracker."

In the "Missing:" messages, swap DB field names for labels (see `02` §3). A `new row violates row-level security policy` error means the user tried something outside their tracker. Show "You don't have access to this tracker."

## Things to know

- Deleting a user in Supabase would fail if they own items (by design). **Deactivate people instead** (`is_active = false`, People page).
- Dates: `publish_date` is a plain date (no time zone). Compute "today" and month ranges in WIB with the date-fns tz helpers, and send dates as `YYYY-MM-DD`.
- `reference` is plain text. Split it on new lines and turn each URL into a link (`target="_blank" rel="noopener noreferrer"`).
- Never render user text as HTML.
