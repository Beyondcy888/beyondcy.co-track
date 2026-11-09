# Beyondcy: GitHub Pages deployment plan

> **Superseded on 9 Nov 2026.** The owner chose to split into three source repos (option 1 below), named `beyondcy.co`, `beyondcy.co-dash` and `beyondcy.co-track` (not `beyondcy-dash` / `beyondcy-track`). See `10_SPLIT_INTO_3_REPOS.md` and `07_DECISIONS_AND_OPEN_ITEMS.md`. This file is kept for history.

Status as of 5 Nov 2026. This brief is for anyone advising on how the Beyondcy websites are deployed.

## 1. The project

There are three websites, all in one GitHub repository: **`github.com/Beyondcy888/beyondcy.co`**.

| Folder | What it is | Tech | Target address |
|---|---|---|---|
| `beyondcy-site/` | Portfolio ("stay tuned" placeholder for now) | Static HTML | `beyondcy.co` |
| `beyondcy-dash/` | Marketing dashboard (placeholder for now) | Static HTML | `dash.beyondcy.co` |
| `beyondcy-track/` | Content tracker (the real app) | React + Vite, Supabase backend | `track.beyondcy.co` |

The tracker needs two build-time values, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. They are stored as GitHub Actions secrets. The anon key is a public key by design, and access is protected by Supabase row-level security. The app doesn't start without these values.

The domain `beyondcy.co` is not live yet. Until it is, the sites should be reachable on `github.io` links.

## 2. Why nothing deployed at first

1. **The workflow was in the wrong place.** It lived at `beyondcy-track/.github/workflows/deploy.yml`. GitHub only runs workflows from `.github/workflows/` at the repository root, so it never ran. The Pages settings page showed "Workflow details will appear here once your site has been deployed."
2. **The apps assumed they were served from `/`.** A repo's Pages site is served from a sub-folder (`beyondcy888.github.io/<repo>/`), so the pages would have loaded blank even with a working workflow.

## 3. What has been done (local changes, not yet committed or pushed)

These changes make all three sites deploy as **one** Pages site from the single repo:

- A root workflow at `.github/workflows/deploy.yml`. It:
  1. checks that the secrets exist,
  2. runs the tracker's tests and build,
  3. checks the build for leaked secrets,
  4. combines the sites and deploys them.
- `scripts/build-pages.mjs` combines the three sites into `_site/`:
  - the portfolio at `/`
  - the dashboard at `/dash/`
  - the tracker at `/track/`
- Tracker changes so it works under any base path:
  - Vite `base` comes from the `BASE_PATH` environment variable.
  - React Router `basename` comes from the base path.
  - The password-reset link includes the base path.
  - Web-manifest paths are relative.
- The icon links in the site and dash pages are relative.
- The site-wide `404.html` boots the tracker for deep links (for example `/track/t/<id>/calendar`). Any other unknown path goes to the home page.
- The old nested workflow is removed, and the root `.gitignore` ignores `_site/`.

**Verified:**
- 54/54 tests pass.
- The production build succeeds.
- In headless Chrome, served the way GitHub serves it, these all render: the portfolio, `/dash/`, the tracker login, tracker deep links, and the fallback for unknown paths.

**Result if pushed as-is:** one link with three parts:
- `https://beyondcy888.github.io/beyondcy.co/`
- `https://beyondcy888.github.io/beyondcy.co/dash/`
- `https://beyondcy888.github.io/beyondcy.co/track/`

## 4. The constraint: one custom domain per repository

GitHub Pages allows **one custom domain per repository** (one Pages site per repo). Subdomains are not extra domains to buy: `dash.` and `track.` are free DNS records under the one domain the owner already has. But each address needs its own Pages site, and so its own repository.

The single-site setup in section 3 can therefore become `beyondcy.co/dash/` and `beyondcy.co/track/`, but **not** `dash.beyondcy.co` and `track.beyondcy.co`.

## 5. The options that were considered

| # | Option | Pros | Cons |
|---|---|---|---|
| 1 | **Split into 3 source repos**, each with its own deploy and domain | Simplest to understand | Owner works in and pushes to 3 repos |
| 2 | **One source repo, publishes to 3 Pages repos** (recommended) | Owner keeps working in one repo and pushes once | One access token to set up; two extra repos that only receive builds |
| 3 | **Another host** (Cloudflare Pages, Netlify or Vercel), with 3 projects reading folders of one repo | Native support for one repo and several domains | New account and service outside GitHub |
| — | Paths instead of subdomains (`beyondcy.co/track/`) | Works with what's already built | Not the addresses the owner wants |

## 6. The recommended option (2) in detail

### How it works
- The owner pushes **only** to `Beyondcy888/beyondcy.co`.
- On each push to `main`, one workflow builds all three sites. Then:
  - The **portfolio** deploys to the Pages site of `beyondcy.co`.
  - The **dashboard** build is pushed to `Beyondcy888/beyondcy-dash`, which serves it on Pages.
  - The **tracker** build is pushed to `Beyondcy888/beyondcy-track`, which serves it on Pages.
- The two extra repos only receive builds. Nobody edits them by hand.

### The github.io links (before the domain is ready)
- `https://beyondcy888.github.io/beyondcy.co/` (portfolio)
- `https://beyondcy888.github.io/beyondcy-dash/` (marketing dashboard)
- `https://beyondcy888.github.io/beyondcy-track/` (tracker)

### Switching to the domain later
The target addresses are `beyondcy.co`, `dash.beyondcy.co` and `track.beyondcy.co`.

1. **DNS at the domain provider:**
   - `beyondcy.co` (apex): four A records pointing at GitHub Pages: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. Optionally add the AAAA records too.
   - `www`: a CNAME to `beyondcy888.github.io` (optional).
   - `dash`: a CNAME to `beyondcy888.github.io`.
   - `track`: a CNAME to `beyondcy888.github.io`.
   - Recommended: verify the domain in the GitHub account settings, to prevent domain takeover.
2. **GitHub:** in each repo, set **Settings → Pages → Custom domain** to the matching address, then tick **Enforce HTTPS**.
3. **Base path:** the builds move from sub-folders (`/beyondcy-track/`) to `/`. This is planned as **one repository setting** that the workflow reads, so the switch needs no code edits.
4. **Supabase → Authentication → URL Configuration:**
   - Set the Site URL to `https://track.beyondcy.co`.
   - Add the Redirect URL `https://track.beyondcy.co/**`.

After the switch, GitHub redirects the old github.io links to the custom domains.

## 7. What the owner has to do for option 2

1. Create two **empty public** repos under `Beyondcy888`: `beyondcy-dash` and `beyondcy-track`, with no README.
2. Create a **fine-grained personal access token**:
   - Scope it to only those two repos.
   - Permission: **Contents: Read and write**.
   - Save it in the `beyondcy.co` repo as the Actions secret **`DEPLOY_TOKEN`**.
3. Add the Actions secrets **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_ANON_KEY`** to the `beyondcy.co` repo. The values are in `beyondcy-track/.env.local`, which is never committed.
4. Set Pages Source = **GitHub Actions** in `beyondcy.co`. This is already done. Each extra repo needs its Pages source set as well; the developer will specify which.
5. In Supabase, add the tracker's github.io Redirect URL: `https://beyondcy888.github.io/beyondcy-track/**`.

## 8. What is still open

- Option 2 is **not built yet**. The local changes in section 3 implement the single-site version. They'll be adapted for option 2 (publish to 3 repos) once the two repos and the token exist.
- None of the changes are committed or pushed.
- Before the tracker goes live: a Supabase Pro plan and custom SMTP for auth emails (these are separate from deployment).
