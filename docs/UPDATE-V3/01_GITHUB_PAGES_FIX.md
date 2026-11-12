# 01 · Fix GitHub Pages ("404 · There isn't a GitHub Pages site here")

The owner reports that the github.io links show GitHub's 404 page. That message means **GitHub Pages is not switched on for that repo** (or it is on but has never deployed anything). It is not a code bug.

Target links (no domain yet):
- Portfolio: `https://beyondcy888.github.io/beyondcy.co/`
- Dashboard: `https://beyondcy888.github.io/beyondcy.co-dash/`
- Tracker: `https://beyondcy888.github.io/beyondcy.co-track/`

## Step 1 · Check what's there (agent)

For each repo, report to the owner:
- Is the latest code pushed? (`git status`, `git log origin/main -1`)
- Does the published content exist?
  - **dash**: `index.html` at the repo root, plus `.nojekyll`
  - **track**: `.github\workflows\deploy.yml` at the repo root
  - **portfolio**: wait for file 02, since its publishing method depends on what the portfolio is built with
- Is there any `CNAME` file? There must be **none** yet.

## Step 2 · OWNER ACTION: turn on Pages (per repo)

github.com → repo → **Settings → Pages → Build and deployment → Source**:

| Repo | Source |
|---|---|
| `beyondcy.co-dash` | **Deploy from a branch** → Branch `main`, folder `/ (root)` → Save |
| `beyondcy.co-track` | **GitHub Actions** |
| `beyondcy.co` | Set **after** file 02: "Deploy from a branch → `main` / `(root)`" if the portfolio is plain files, or "GitHub Actions" if it needs a build |

**Custom domain** stays **empty** on all three.

The tracker also needs its two secrets (Settings → Secrets and variables → Actions):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (the publishable key)

Check that they exist. They were part of Phase 7 of `10_SPLIT_INTO_3_REPOS.md`.

## Step 3 · Trigger a deploy

- **dash:** saving the Pages setting starts a deploy by itself. If not, push any small change with `.\deploy.ps1 dash`.
- **track:** Actions tab → "Deploy tracker" → **Run workflow**. If the run fails, open it and read the failing step. Usually it's missing secrets, or Pages not set to "GitHub Actions".
- First deployments can take a few minutes. The Pages settings page shows "Your site is live at …" when it's done.

## Step 4 · Verify

- [ ] All three links open their real page, not the GitHub 404.
- [ ] Tracker: styles and logo load, login works, and refreshing a deep page works.
- [ ] Password reset: the email link opens `…/beyondcy.co-track/reset-password`. Supabase Site URL and Redirect URLs must include the github.io tracker link (Phase 8 of file 10).
