# 08 · Connect the tracker to Supabase

The owner has already run `01_schema.sql`, `02_seed.sql` and `03_assign_users.sql` in this project. The database is ready. **Do not run any SQL** unless the owner asks.

## Project values

> The real values are kept out of this public repo. They live in `.env.local` (local, git-ignored) and in the GitHub Actions secrets.

| Name | Value |
|---|---|
| Project URL | `https://YOUR-PROJECT-REF.supabase.co` |
| Publishable key | `YOUR-PUBLISHABLE-KEY` |

- The publishable key is **meant to be public**: it ships inside the website's JavaScript anyway, and Row Level Security protects the data. Even so, keep it in environment variables, not hard-coded, so it can be rotated in one place.
- These are the **only** two Supabase values this project may use. If any task seems to need the secret / `service_role` key or the database password, stop and ask the owner. The answer is no.

## 1. Environment files (repo `beyondcy-track`)

`.env.local` (create locally; **git-ignored**):
```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-KEY
```

`.env.example` (committed, placeholders only):
```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-KEY
```

`.gitignore` must include `.env.local` and `.env*.local`.

## 2. Client (`src/lib/supabase.js`)

Install the latest `@supabase/supabase-js` v2 (recent versions accept the `sb_publishable_…` key format).

```js
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check .env.local or the GitHub secrets.');
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // needed for the password-reset link
    flowType: 'pkce',
  },
});
```

Create exactly one client and import it everywhere.

## 3. Session handling

- On app start: `supabase.auth.getSession()`, then listen with `supabase.auth.onAuthStateChange`.
- Sign in: `supabase.auth.signInWithPassword({ email, password })`.
- Sign out: `supabase.auth.signOut()`, then clear cached data and realtime channels.
- Forgot password: `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://track.beyondcy.co/reset-password' })`. Use `http://localhost:5173/reset-password` in development, derived from `window.location.origin`. On `/reset-password`, call `supabase.auth.updateUser({ password })`.
- After sign-in, load the profile (see `04_DATABASE_GUIDE.md`). If there's no profile, no `role_id`, or `is_active = false`, show the "no tracker" message from `01`.

## 4. GitHub deployment

1. In the repo: **Settings → Secrets and variables → Actions → New repository secret**, twice:
   - `VITE_SUPABASE_URL` = the Project URL above
   - `VITE_SUPABASE_ANON_KEY` = the publishable key above
2. **Settings → Pages → Source: GitHub Actions.**
3. Add `public/CNAME` containing `track.beyondcy.co`.
4. Add `.github/workflows/deploy.yml`:

```yaml
name: Deploy tracker
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - run: cp dist/index.html dist/404.html   # SPA deep links on GitHub Pages
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```
Use the latest major versions of these actions if newer ones exist.

## 5. Connection test (do this first, before building screens)

Build a temporary `/dev-check` page (remove it before release) that shows:

1. **Signed out:** `supabase.from('content_items').select('id').limit(1)` must return an **error** (permission denied), not rows. This proves visitors get nothing.
2. **Signed in as Admin Beyondcy:**
   - profile → `display_name = 'Admin Beyondcy'`, role `admin`, `is_admin = true`
   - `roles` → 5 rows; `brands` → 9 rows; `brand_pillars` → 5 rows (Homy8)
3. **Signed in as Dika:** profile role `beefix`; inserting `{ role_id: 'beefix', brand_id: 'beefix', content: 'Connection test' }` returns a row with `status = 'not_started'`; then delete it.
4. **Signed in as Dika:** inserting into `role_id: 'behomy'` must fail with a row-level security error.

Report the results to the owner. The owner provides the test logins; never store passwords in the repo or the docs.

## 6. Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Invalid API key" | Wrong or truncated key in env/secrets, or an old `@supabase/supabase-js` |
| Login works but profile is `null` or has no role | `03_assign_users.sql` didn't match that email. Ask the owner to check Authentication → Users and re-run the line. |
| "Email not confirmed" | The user was created without **Auto Confirm User**. The owner confirms them in Authentication → Users. |
| Password-reset link opens the wrong site | Supabase **URL Configuration** (Site URL / Redirect URLs) not set as in `06` §A.5 |
| Works locally, blank page online | GitHub secrets missing, or the build ran without the `env:` block |
| Refreshing a page gives a 404 | The `404.html` copy step is missing |
| Realtime events don't arrive | Subscribed before sign-in, or the filter `role_id=eq.<id>` is wrong. Subscribe after the session exists. |
