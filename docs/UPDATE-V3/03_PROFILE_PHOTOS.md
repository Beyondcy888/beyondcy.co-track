# 03 · Profile photos

Every person in the tracker gets a profile photo, including people who join later.

## Behaviour

- **No photo yet:** show the **first letter of the display name**, uppercase, on a coloured circle (like most apps). The colour comes from a small fixed palette of muted tones, chosen by the person's id, so it's always the same for the same person. Don't use the status colours (grey/blue/green) or the Reels/Feed colours.
- **People change their own photo:** click your own photo (sidebar footer). A small menu opens with **Upload photo**, **Adjust** (when a photo exists) and **Remove** (when a photo exists).
- **Admin can change or remove anyone's photo** from the People page, using the same menu on each person's row.
- **Upload / Adjust** open a centred dialog:
  - round crop preview, with a **zoom slider** and **drag to reposition**
  - **Save** and **Cancel**
  - the result is a **512 × 512 WebP** (quality 0.85), made in the browser
  - accepted input: JPG, PNG or WebP up to 10 MB before cropping
  - "Adjust" re-opens the crop on the current photo; to reframe from scratch, upload again.
- **Remove:** confirm, then go back to the letter.
- Changes show up for everyone within a short time (see "Loading" below).

## Where photos appear

Anywhere a person is shown, use one shared `<Avatar>` component (sizes about 20 / 28 / 40 / 64px):
- sidebar footer (yourself)
- comments and history entries
- PIC column, PIC filters and PIC dropdowns
- Behomy lanes and "My work"
- status board cards (file 05) and the this-week reminder on team pages
- projects: list, calendar chips and popup (file 06)
- Admin Dashboard tables (Performance per PIC, Detail per PIC and brand)
- People page
- Targets page rows

Put the name next to the photo wherever space allows. When only photos fit (e.g. a stack on a calendar chip), give each a tooltip and `aria-label` with the display name.

## Data (see file 07)

- Read names and photos from the **`people`** view: `id, display_name, avatar_path, avatar_updated_at, role_id, role_name, is_admin, is_active`. Every signed-in user can read it. It has **no emails**.
  - Use it for *everyone else*.
  - Keep using `profiles` for your own profile and for the Admin People page (which needs emails).
- **Storage:** private bucket `avatars`. Path: `<profile_id>/<uuid>.webp`. The owner or Admin may write; everyone signed in may read.
- **Saving a photo:**
  1. Upload the file to `avatars/<profile_id>/<uuid>.webp`.
  2. `rpc('set_profile_avatar', { p_profile_id, p_path })`.
  3. Delete the previous file.
- **Removing:** `rpc('set_profile_avatar', { p_profile_id, p_path: null })`, then delete the file.
- People can't edit their own profile row directly (that would let them change their role). The `set_profile_avatar` function is the only way to change a photo.

## Loading photos efficiently

- Load `people` once after sign-in and keep it in a shared store. Refresh it when the tab regains focus and after any photo change.
- Get display URLs in **one batch**: `supabase.storage.from('avatars').createSignedUrls(paths, 3600)`. Cache them by `avatar_path + avatar_updated_at`, and refresh them before they expire.
- While a photo loads (or if it fails), show the letter. Never show a broken image.

## Done when

- [ ] Someone without a photo shows their initial everywhere.
- [ ] Upload → crop → save works, and the photo appears in every place listed above.
- [ ] Adjust and Remove work.
- [ ] Admin can change or remove anyone's photo. Staff can only change their own (the database refuses anything else; show its message).
- [ ] A new user created later automatically gets the initial, with no setup.
