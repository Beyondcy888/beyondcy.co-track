# 06 · Setup, deployment and acceptance checklist

Supabase menu names change from time to time. If a label below doesn't match exactly, look for the closest equivalent.

> **Now (10, 9 Nov 2026):** three repos under **Beyondcy888**, live on github.io links until the domain is connected (`11_CONNECT_DOMAIN.md`):
> - Portfolio `Beyondcy888/beyondcy.co` → https://beyondcy888.github.io/beyondcy.co/
> - Dashboard `Beyondcy888/beyondcy.co-dash` → https://beyondcy888.github.io/beyondcy.co-dash/
> - Tracker `Beyondcy888/beyondcy.co-track` → https://beyondcy888.github.io/beyondcy.co-track/
>
> The steps below that mention `track.beyondcy.co`, custom domains, `CNAME` files or DNS are for **later** (file 11). Until then: no `CNAME` file anywhere and no custom domain in Settings → Pages.

## A. Owner: Supabase (do this before the agent starts)

1. Create a Supabase project (region: **Southeast Asia (Singapore)**). Store the database password in a password manager. **Never** put it in the repo or give it to the agent.
2. **SQL Editor → New query**: paste and run `supabase/01_schema.sql`. It should finish with "Success". Run it **only once**.
3. Run `supabase/02_seed.sql` (safe to run again).
4. **Authentication → Sign In / Providers:** keep Email enabled and **turn off "Allow new users to sign up"**.
5. **Authentication → URL Configuration** (now, on github.io; file 11 switches the Site URL to `https://track.beyondcy.co` later):
   - Site URL: `https://beyondcy888.github.io/beyondcy.co-track/`
   - Redirect URLs: `https://beyondcy888.github.io/beyondcy.co-track/**`, `https://track.beyondcy.co/**` (ready for later) and `http://localhost:5173/**`
6. **Authentication → Users → Add user → Create new user**, 7 times (Admin Beyondcy, Excel, Dika, Zaki, Arum, Ilyas, Anne). Enter the email and a strong temporary password, and tick **Auto Confirm User**.
7. Open `supabase/03_assign_users.sql`, replace the 7 placeholder emails with the real ones, and run it. The result table must show all 7 people with a name and a role.
8. Copy the **Project URL** and the **anon public key** (newer projects call it the **publishable key**) from Project Settings → API, or the **Connect** button. Give these two values to the agent. **Never share the `service_role` / secret key.**

Before go-live:
- Upgrade to the **Pro plan**, so backups exist (the tracker replaces Notion) and the project never auto-pauses.
- Set up a **custom SMTP** sender (Authentication → Emails → SMTP), because the built-in sender only allows a few emails per hour. It's fine for testing password resets, not for daily use.

## B. Agent: build and deploy

1. The three repos (`01`): `Beyondcy888/beyondcy.co`, `Beyondcy888/beyondcy.co-dash`, `Beyondcy888/beyondcy.co-track`. **No `CNAME` file yet** (file 11 adds them).
2. Tracker: `.env.example` committed, `.env.local` git-ignored. Add GitHub Actions secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `beyondcy.co-track`.
3. GitHub Actions workflow for `beyondcy.co-track` ("Deploy tracker"): secrets check → `npm ci` → `npm test` → `npm run build` with `VITE_BASE_PATH: /beyondcy.co-track/` → copy `dist/index.html` to `dist/404.html` → secret scan → deploy `dist/` to Pages (Source: **GitHub Actions**).
4. Placeholder repos (`beyondcy.co`, `beyondcy.co-dash`): Pages serves from `main` / `(root)`, which holds `index.html`, an empty `.nojekyll` and the favicons.
5. Custom domain: **leave empty for now.** Later (file 11): in each repo, Settings → Pages → set the custom domain → **Enforce HTTPS** once the certificate is issued.
6. Push with `deploy.ps1` from the parent `Beyondcy-Web` folder (`.\deploy.ps1`, or `.\deploy.ps1 track` for one project).
7. Run every acceptance check in section D.

## C. Owner: DNS at the domain provider for beyondcy.co (later: file 11)

Do this with `11_CONNECT_DOMAIN.md`, which has the exact Hostinger steps. The account that owns the repos is **Beyondcy888**. **Confirm these values against GitHub's current "Managing a custom domain for your GitHub Pages site" docs before saving.**

| Type | Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `beyondcy888.github.io` |
| CNAME | `dash` | `beyondcy888.github.io` |
| CNAME | `track` | `beyondcy888.github.io` |

- Also **verify the domain** in GitHub (account/organisation settings → Pages → verified domains). This prevents anyone else from claiming your subdomains.
- **Before changing DNS:** make sure company email (MX records) and anything else on the old server keeps working. Don't delete records you don't recognise without checking.

## D. Acceptance checks (all must pass)

**Access (hard lock)**: log in as each person:
- [ ] Dika sees only Beefix. Typing another tracker's URL shows "You don't have access to this tracker" and loads no data.
- [ ] Zaki sees only Homy8, with the Content Pillar column. No other tracker shows that column.
- [ ] Excel lands on Master (Lahap + Makmoer, with a Brand column), and the Lahap and Makmoer pages each show only their brand.
- [ ] Arum lands on My work (only her items), and Master shows Arum + Ilyas + Anne items with Brand and Owner columns.
- [ ] Admin lands on Choose a tracker, can open each one, sees the same layout as staff, and has People.
- [ ] Signed out, every page redirects to login. A direct API call with only the anon key returns no tracker data.
- [ ] A user with no role, or an inactive user, sees the "no tracker" message only.

**Status and lock**
- [ ] A new item is Not Started (grey). Filling every required field turns it Planned (blue). For Homy8, a pillar is needed too.
- [ ] The Instagram link input is disabled until everything is filled, and the hint names the missing fields.
- [ ] Adding a non-Instagram link is refused with the database message.
- [ ] Adding the Instagram link turns it Uploaded (green), and the track gains a filled dot.
- [ ] Emptying a field on an Uploaded item is refused with the database message.

**Targets and progress**
- [ ] Staff can't edit targets; Admin can, per brand (Excel), per person (Behomy) and per brand (single).
- [ ] Excel's Master total = Makmoer + Lahap. Behomy's team total = Arum + Ilyas + Anne.
- [ ] Only Uploaded items with a Publish Date in the month count. The pace sentence is correct today, and past months show final results.
- [ ] Over target shows like "30 / 25 · 120%".

**History, comments, live updates**
- [ ] Every field change appears in History with the person's display name. Admin's edits show "Admin Beyondcy".
- [ ] Comments post and show the count on the row. Authors can delete their own comments; teammates cannot delete them.
- [ ] Two browsers on the Behomy tracker: an edit in one appears in the other within a few seconds.

**Calendar**
- [ ] The current month opens with today highlighted. The live WIB clock ticks. Previous / next / Today work and stay in sync with the track month.
- [ ] Chips show type + name with a status marker. "+N more" appears on busy days, and No date lists undated items.

**Quality**
- [ ] It works at 390px, 1024px and 1440px. Keyboard navigation works with visible focus. Reduced motion disables the dot animation.
- [ ] No secret appears in the repo or the built JS (search the output for `service_role`).
- [ ] The portfolio and the dashboard show their Stay tuned pages over HTTPS (now https://beyondcy888.github.io/beyondcy.co/ and https://beyondcy888.github.io/beyondcy.co-dash/; `beyondcy.co` and `dash.beyondcy.co` after file 11). Dash and track have `noindex`.
