# 10 · Split the project into 3 repositories (live on github.io)

## Goal

Today, one GitHub repo (`Beyondcy888/beyondcy.co`) holds the portfolio, the dashboard and the tracker. Split it into **three independent repos**, each published by its own GitHub Pages site on its **own github.io link**:

| Project | Current folder (in `beyondcy.co` repo) | New repo | Live link (now) | Later, with the domain (file 11) |
|---|---|---|---|---|
| Portfolio | `beyondcy-site/` | `Beyondcy888/beyondcy.co` (existing, cleaned up) | `https://beyondcy888.github.io/beyondcy.co/` | `https://beyondcy.co` |
| Marketing dashboard | `beyondcy-dash/` | `Beyondcy888/beyondcy.co-dash` (**new**) | `https://beyondcy888.github.io/beyondcy.co-dash/` | `https://dash.beyondcy.co` |
| Content tracker | `beyondcy-track/` | `Beyondcy888/beyondcy.co-track` (**new**) | `https://beyondcy888.github.io/beyondcy.co-track/` | `https://track.beyondcy.co` |

**The domain is NOT connected in this task.** Everything must work on the github.io links. Connecting `beyondcy.co` comes later with `11_CONNECT_DOMAIN.md`, so build everything so that switching takes only a few settings (described below).

Final layout on the owner's computer:
```
Beyondcy-Web\                 <- plain folder, NOT a git repo
├── beyondcy.co\              -> github.com/Beyondcy888/beyondcy.co
├── beyondcy.co-dash\         -> github.com/Beyondcy888/beyondcy.co-dash
├── beyondcy.co-track\        -> github.com/Beyondcy888/beyondcy.co-track
└── deploy.ps1                <- pushes each folder to its own repo
```

**Decisions (from the owner):**
- Three separate folders, side by side.
- Commit history is **kept** when splitting.
- The doc folders (`START-DEV-01`, `START-DEV-02`, `START-SUPABASE-01`, `DEPLOY-PLAN.md`, `TASKS.md`) move to `beyondcy.co-track\docs\`.
- Supabase is used by the tracker only. Repos are public (GitHub Free).

## Rules for this task

- **Steps marked OWNER ACTION need the owner** (on github.com or in Supabase). Stop, tell the owner exactly what to do (copy the instructions here), and wait for confirmation before continuing.
- **Never delete the old local folder** and **never force-push**. The old folder is renamed to `beyondcy.co-OLD` at the end; the owner deletes it later.
- **Never commit `.env.local`** or any secret. Only the Supabase **URL** and **publishable key** are used, and they live in `.env.local` and GitHub secrets.
- **No `CNAME` files in any repo yet.** A `CNAME` file makes GitHub redirect the github.io link to a domain that isn't connected, which breaks the site.
- Commands are for **PowerShell on Windows**. `<OLD>` = the full path of the current `beyondcy.co` folder; `<WEB>` = the full path of the new `Beyondcy-Web` folder, created next to it.

---

## Phase 0 · Inspect and report (no changes yet)

Read the current repo and **report to the owner before changing anything**:
1. What `.github\workflows\*` and `scripts\*` currently do. This is probably a combined deploy that builds everything into `_site\`.
2. In `beyondcy-track`: `vite.config.*` `base`, any React Router `basename`, any hard-coded absolute paths (`/track/...`, `/favicon.ico`, `/logo.png`), and how the password-reset `redirectTo` is built.
3. Whether `beyondcy-site` and `beyondcy-dash` are **plain static files** (an `index.html`, no `package.json` build) or need a build step.
4. Any links between the three projects (e.g. `href="/track"`).
5. Whether the current `beyondcy.co` repo has a **custom domain** set (Settings → Pages) or a `CNAME` file. Both must be removed for now.
6. Where the tracker is live right now and whether people use it. **Recommend doing the switch at a quiet time**, since the tracker's link changes.
7. Run `git status`: everything must be committed and pushed first.

## Phase 1 · Safety backup

```powershell
cd "<OLD>"
git pull
git tag pre-split-backup
git push origin pre-split-backup
git bundle create "..\beyondcy.co-backup-$(Get-Date -Format yyyyMMdd).bundle" --all
```
- The bundle is a complete copy of the whole repo history in one file, next to `<OLD>`.
- **Untracked local files don't travel with git.** Note them now, especially `beyondcy-track\.env.local`.

## Phase 2 · OWNER ACTION: create two empty repos

*(The owner may already have done this. Ask first.)* On github.com, signed in as **Beyondcy888**: **New repository** →
- `beyondcy.co-dash`: **Public**, with **no** README, .gitignore or license.
- `beyondcy.co-track`: same settings.

## Phase 3 · Split dash and track (keeping history)

```powershell
cd "<OLD>"
git subtree split --prefix=beyondcy-track -b split/track
git subtree split --prefix=beyondcy-dash  -b split/dash

New-Item -ItemType Directory "<WEB>" | Out-Null

git clone --branch split/track --single-branch "<OLD>" "<WEB>\beyondcy.co-track"
cd "<WEB>\beyondcy.co-track"
git branch -m main
git remote set-url origin https://github.com/Beyondcy888/beyondcy.co-track.git

git clone --branch split/dash --single-branch "<OLD>" "<WEB>\beyondcy.co-dash"
cd "<WEB>\beyondcy.co-dash"
git branch -m main
git remote set-url origin https://github.com/Beyondcy888/beyondcy.co-dash.git
```
Check each with `git log --oneline`: the project's earlier commits must be there.

**Copy what git didn't carry:**
```powershell
Copy-Item "<OLD>\beyondcy-track\.env.local" "<WEB>\beyondcy.co-track\.env.local"
New-Item -ItemType Directory "<WEB>\beyondcy.co-track\docs" -Force | Out-Null
"START-DEV-01","START-DEV-02","START-SUPABASE-01","DEPLOY-PLAN.md","TASKS.md" |
  ForEach-Object { Copy-Item "<OLD>\$_" "<WEB>\beyondcy.co-track\docs\" -Recurse }
```
Then run `npm install` in `beyondcy.co-track` (`node_modules` isn't copied).

## Phase 4 · Make each project stand on its own (github.io-ready, domain-ready)

### beyondcy.co-track (Vite app, published by GitHub Actions)

It must work at `https://beyondcy888.github.io/beyondcy.co-track/` now, and at `https://track.beyondcy.co/` later **by changing one value**.

- **Base path from one variable.** In `vite.config.js`:
  ```js
  base: process.env.VITE_BASE_PATH || '/',
  ```
  - The GitHub workflow sets `VITE_BASE_PATH: /beyondcy.co-track/`. File 11 later removes it, so the base becomes `/`.
  - Local `npm run dev` keeps working at `/`.
- **Router:** `<BrowserRouter basename={import.meta.env.BASE_URL}>`. In-app links use router paths; never hard-code `/beyondcy.co-track/`.
- **No absolute root paths** for files in `public/` (favicons, logo):
  - in JSX: `${import.meta.env.BASE_URL}logo-beyondcy.png`
  - in `index.html`: use paths Vite rewrites with the base, then **open `dist/index.html` after building and check** that every icon/asset URL starts with `/beyondcy.co-track/` when `VITE_BASE_PATH` is set.
- **Password reset `redirectTo`:** `window.location.origin + import.meta.env.BASE_URL + 'reset-password'`. This works on both addresses.
- **Deep links on github.io:** GitHub serves the repo's `404.html` for unknown paths under `/beyondcy.co-track/`, so keep copying `dist\index.html` → `dist\404.html`.
- **No `public\CNAME`** for now. Delete one if it exists.
- Its own `.gitignore`: `node_modules/`, `dist/`, `.env`, `.env.local`, `.env.*.local`. (The old root `.gitignore` did not come along.)
- `.github\workflows\deploy.yml` at the **root of this repo**: the workflow from `08_CONNECT_TO_SUPABASE.md` §4, with one addition in the build step:
  ```yaml
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_BASE_PATH: /beyondcy.co-track/   # remove when the domain is connected (file 11)
  ```
- Update paths in `docs\` (repo names, `beyondcy-track` → `beyondcy.co-track`) where they describe the setup.
- Check `npm run build` and `npm run dev` locally. To check the github.io version, build with `$env:VITE_BASE_PATH='/beyondcy.co-track/'; npm run build; npx vite preview --base /beyondcy.co-track/`, then open the printed link, log in and refresh a deep page.

### beyondcy.co-dash and beyondcy.co (portfolio)

- **If plain static** (Phase 0, item 3): publish from branch `main`, folder `/ (root)`. The repo root must contain `index.html`, an empty `.nojekyll` file, and the favicons.
- **If they need a build:** use a GitHub Actions workflow like the tracker's, with the same `VITE_BASE_PATH` approach (`/beyondcy.co/` or `/beyondcy.co-dash/`), but without Supabase secrets and without the 404 copy.
- **Use relative paths only** (`favicon.ico`, `logo-beyondcy.png`, with no leading `/`), so each page works at its github.io sub-path now and at the domain root later.
- **No `CNAME` file** for now.
- Dash keeps `<meta name="robots" content="noindex, nofollow">`.
- **Links between the three sites:** put each site's address in one obvious place at the top of each project. A small `SITE_LINKS` constant (or a comment block in static HTML) holds the three github.io links, so file 11 only has to change that one place.

### Clean up the portfolio repo

Work in a **fresh clone**; the old folder stays untouched as a backup.
```powershell
git clone https://github.com/Beyondcy888/beyondcy.co.git "<WEB>\beyondcy.co"
cd "<WEB>\beyondcy.co"
git rm -r -q --ignore-unmatch beyondcy-dash beyondcy-track START-DEV-01 START-DEV-02 START-SUPABASE-01 DEPLOY-PLAN.md TASKS.md scripts _site CNAME
Get-ChildItem -Force beyondcy-site | ForEach-Object { git mv $_.FullName . }
Remove-Item beyondcy-site -Recurse -ErrorAction SilentlyContinue
```
- Remove the old combined workflow in `.github\workflows\`. Keep a workflow **only** if the portfolio itself needs a build.
- Root must have `index.html`, `.nojekyll`, the favicons, and a `.gitignore`. **No `CNAME`.**
- Commit as **"Split: this repo now holds only the portfolio"**. Don't push yet (Phase 6 does it).

## Phase 5 · deploy.ps1

Create `<WEB>\deploy.ps1` with the exact content in the appendix. Also save a copy at `beyondcy.co-track\docs\deploy.ps1`, since the parent folder isn't backed up by git.

- At the top of the script, `$UseCustomDomains = $false` makes it show the github.io links. File 11 switches it to `$true`.
- It has been tested:
  - it pushes only folders with changes, each to its own repo
  - it refuses a wrong remote or a branch other than `main`
  - it blocks `.env*` files (except `.env.example`), and Supabase secret or `service_role` keys
  - it retries a push that failed before
  - it prints a summary

**OWNER ACTION (one time):** if Windows refuses to run scripts, open PowerShell and run:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
Unblock-File "<WEB>\deploy.ps1"     # only needed if the file was downloaded
```

**Usage:**
```powershell
cd "<WEB>"
.\deploy.ps1                         # all projects that have changes
.\deploy.ps1 track                   # only the tracker   (also: site, dash)
.\deploy.ps1 site dash -Message "Update stay tuned copy"
```

## Phase 6 · First push

```powershell
cd "<WEB>"
.\deploy.ps1 -Message "Split into three repositories"
```
All three should report `pushed`.

## Phase 7 · OWNER ACTION: GitHub settings

**a) Tracker secrets**: `beyondcy.co-track` → Settings → Secrets and variables → Actions → New repository secret:
- `VITE_SUPABASE_URL` = `https://hedinugzhxyssgxlkzfj.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = the publishable key (`sb_publishable_…`)

**b) Pages source**: each repo → Settings → Pages → Build and deployment:

| Repo | Source |
|---|---|
| `beyondcy.co` | Deploy from a branch → `main` / `(root)` (or **GitHub Actions** if it needs a build) |
| `beyondcy.co-dash` | Deploy from a branch → `main` / `(root)` (or GitHub Actions if it needs a build) |
| `beyondcy.co-track` | **GitHub Actions** |

Then re-run the tracker's workflow (Actions tab → Deploy tracker → Run workflow) so it builds with the secrets.

**c) Custom domain: leave EMPTY** on all three repos for now. If `beyondcy.co` had one from before, remove it.

## Phase 8 · OWNER ACTION: Supabase (login links must point to github.io for now)

Authentication → URL Configuration:
- Site URL = `https://beyondcy888.github.io/beyondcy.co-track/`
- Redirect URLs:
  - `https://beyondcy888.github.io/beyondcy.co-track/**`
  - `https://track.beyondcy.co/**` (ready for later; harmless now)
  - `http://localhost:5173/**`

## Phase 9 · Verify (all must pass)

- [ ] `https://beyondcy888.github.io/beyondcy.co/` shows the portfolio "Stay tuned" page, with logo and favicon.
- [ ] `https://beyondcy888.github.io/beyondcy.co-dash/` shows the dashboard "Stay tuned" page and has `noindex`.
- [ ] `https://beyondcy888.github.io/beyondcy.co-track/` loads the tracker with all styles, logo and favicon.
- [ ] Tracker login works, and refreshing a deep page (e.g. a brand page) doesn't 404 or lose styles.
- [ ] The password-reset email link opens `…/beyondcy.co-track/reset-password`.
- [ ] Links between the sites point to the github.io addresses.
- [ ] A small change in one folder, then `.\deploy.ps1`, pushes only that repo, and the link updates in about 1–2 minutes.
- [ ] `git log` in the dash and track repos shows their earlier history.
- [ ] No `.env.local` and no `CNAME` file exists in any GitHub repo (check on github.com).

## Phase 10 · Finish

- Rename `<OLD>` to `beyondcy.co-OLD`. **The owner deletes it later**, after a week of everything working.
- Update `docs\01_PROJECT_OVERVIEW.md` and `docs\06_SETUP_DEPLOY_CHECKLIST.md` with the new repo names and the github.io links. Record the split in `docs\07_DECISIONS_AND_OPEN_ITEMS.md`.
- Save `11_CONNECT_DOMAIN.md` in `beyondcy.co-track\docs\` for later.

## If something goes wrong

- **Code:** nothing is lost. The old folder, the `pre-split-backup` tag on GitHub and the `.bundle` file all hold the full original repo.
- **A page is blank or has no styles on github.io:** it's almost always an absolute path (`/something`) or a missing `VITE_BASE_PATH`. See Phase 4.

---

## Appendix · deploy.ps1 (use exactly)

```powershell
<#
.SYNOPSIS
  Pushes each Beyondcy project folder to its own GitHub repository.

.DESCRIPTION
  Lives in the parent folder (Beyondcy-Web). For each project it:
    1. checks the folder is connected to the RIGHT GitHub repo and on 'main'
    2. skips it when there is nothing to commit or push
    3. blocks the push if a secret file or secret key is about to be committed
    4. commits, pushes, and prints the live link
  GitHub then publishes each site automatically.

.EXAMPLE
  .\deploy.ps1                      # every project that has changes
.EXAMPLE
  .\deploy.ps1 track                # only the tracker
.EXAMPLE
  .\deploy.ps1 site dash -Message "Update stay tuned copy"
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
  [ValidateSet('site', 'dash', 'track')]
  [string[]]$Only,

  [string]$Message
)

# ---- SETTINGS --------------------------------------------------------------
# $false = sites live on github.io links (now)
# $true  = sites live on beyondcy.co, dash.beyondcy.co, track.beyondcy.co
#          (switch this when the domain is connected - see 11_CONNECT_DOMAIN.md)
$UseCustomDomains = $false
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Continue'   # git writes progress to stderr; we check exit codes ourselves
$Root = $PSScriptRoot
$GitHubUser = 'Beyondcy888'

$Projects = @(
  [pscustomobject]@{ Key = 'site';  Folder = 'beyondcy.co';       Repo = 'beyondcy.co';       Domain = 'https://beyondcy.co' }
  [pscustomobject]@{ Key = 'dash';  Folder = 'beyondcy.co-dash';  Repo = 'beyondcy.co-dash';  Domain = 'https://dash.beyondcy.co' }
  [pscustomobject]@{ Key = 'track'; Folder = 'beyondcy.co-track'; Repo = 'beyondcy.co-track'; Domain = 'https://track.beyondcy.co' }
)
foreach ($p in $Projects) {
  $pagesUrl = 'https://{0}.github.io/{1}/' -f $GitHubUser.ToLower(), $p.Repo
  $live = $pagesUrl
  if ($UseCustomDomains) { $live = $p.Domain }
  $p | Add-Member -NotePropertyName Live -NotePropertyValue $live
}
if ($Only) { $Projects = $Projects | Where-Object { $Only -contains $_.Key } }

# Files that must never be committed (.env.example is allowed)
$SecretFilePattern = '(^|/)\.env(\.(?!example$)[^/]+)?$|\.pem$|\.key$|(^|/)id_rsa'
# Supabase secret keys: new format, or a legacy service_role JWT (base64 of "service_role")
$SecretContentPattern = 'sb_secret_[A-Za-z0-9_\-]{10,}|c2VydmljZV9yb2xl'

function Invoke-Git {
  param([string]$Path, [Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
  $out = & git -C $Path @GitArgs 2>&1
  [pscustomobject]@{
    Code = $LASTEXITCODE
    Out  = (@($out) | ForEach-Object { "$_" }) -join "`n"
  }
}

function Get-RepoSlug([string]$Url) {
  # https://github.com/Owner/repo(.git)  or  git@github.com:Owner/repo(.git)  ->  owner/repo
  $u = $Url.Trim()
  if ($u -match 'github\.com[:/](.+?)(\.git)?/?$') { return $Matches[1].ToLower() }
  return $u.ToLower()
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host 'Git is not installed or not on PATH.' -ForegroundColor Red
  exit 1
}

$results = @()

foreach ($p in $Projects) {
  $path = Join-Path $Root $p.Folder
  $expected = ("$GitHubUser/$($p.Repo)").ToLower()
  Write-Host ''
  Write-Host ('== {0}  ({1})' -f $p.Folder, $p.Live) -ForegroundColor Cyan

  if (-not (Test-Path (Join-Path $path '.git'))) {
    Write-Host "   Folder not found or not a git repo: $path" -ForegroundColor Red
    $results += [pscustomobject]@{ Project = $p.Folder; Result = 'FAILED'; Detail = 'missing folder/repo' }
    continue
  }

  # 1. right repo, right branch
  $remote = Invoke-Git $path remote get-url origin
  if ($remote.Code -ne 0 -or (Get-RepoSlug $remote.Out) -ne $expected) {
    Write-Host "   Wrong or missing remote. Expected github.com/$GitHubUser/$($p.Repo), found: $($remote.Out)" -ForegroundColor Red
    $results += [pscustomobject]@{ Project = $p.Folder; Result = 'FAILED'; Detail = 'wrong remote' }
    continue
  }
  $branch = (Invoke-Git $path rev-parse --abbrev-ref HEAD).Out.Trim()
  if ($branch -ne 'main') {
    Write-Host "   On branch '$branch'. Switch to 'main' first." -ForegroundColor Red
    $results += [pscustomobject]@{ Project = $p.Folder; Result = 'FAILED'; Detail = "on branch $branch" }
    continue
  }

  # 2. anything to do?
  $dirty = (Invoke-Git $path status --porcelain).Out.Trim()
  $ahead = 0
  $aheadCheck = Invoke-Git $path rev-list --count '@{u}..HEAD'
  if ($aheadCheck.Code -eq 0) { $ahead = [int]$aheadCheck.Out.Trim() } else { $ahead = 1 }  # no upstream yet: push needed
  if (-not $dirty -and $ahead -eq 0) {
    Write-Host '   No changes. Skipped.' -ForegroundColor DarkGray
    $results += [pscustomobject]@{ Project = $p.Folder; Result = 'skipped'; Detail = 'no changes' }
    continue
  }

  if ($dirty) {
    # 3. stage and check for secrets
    $null = Invoke-Git $path add -A
    $staged = (Invoke-Git $path diff --cached --name-only).Out -split "`n" | Where-Object { $_ }
    $badFiles = $staged | Where-Object { $_ -match $SecretFilePattern }
    $diffText = (Invoke-Git $path diff --cached -U0).Out
    if ($badFiles -or ($diffText -match $SecretContentPattern)) {
      $null = Invoke-Git $path reset -q
      Write-Host '   BLOCKED: a secret is about to be committed. Nothing was pushed.' -ForegroundColor Red
      if ($badFiles) { $badFiles | ForEach-Object { Write-Host "     file: $_" -ForegroundColor Red } }
      if ($diffText -match $SecretContentPattern) { Write-Host '     a Supabase secret / service_role key appears in the changes' -ForegroundColor Red }
      Write-Host '   Add the file to .gitignore or remove the key, then run again.' -ForegroundColor Yellow
      $results += [pscustomobject]@{ Project = $p.Folder; Result = 'BLOCKED'; Detail = 'secret detected' }
      continue
    }

    if (-not $Message) {
      $Message = Read-Host 'Commit message (Enter = automatic)'
      if ([string]::IsNullOrWhiteSpace($Message)) { $Message = 'Update ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') }
    }
    $commit = Invoke-Git $path commit -m $Message
    if ($commit.Code -ne 0) {
      Write-Host "   Commit failed:`n$($commit.Out)" -ForegroundColor Red
      $results += [pscustomobject]@{ Project = $p.Folder; Result = 'FAILED'; Detail = 'commit failed' }
      continue
    }
    Write-Host "   Committed: $Message" -ForegroundColor Gray
  }

  # 4. push
  $push = Invoke-Git $path push -u origin main
  if ($push.Code -ne 0) {
    Write-Host "   Push failed:`n$($push.Out)" -ForegroundColor Red
    Write-Host '   Tip: if GitHub has newer commits, run  git pull --rebase  in this folder, then deploy again.' -ForegroundColor Yellow
    $results += [pscustomobject]@{ Project = $p.Folder; Result = 'FAILED'; Detail = 'push failed' }
    continue
  }
  Write-Host "   Pushed. Live in ~1-2 min: $($p.Live)" -ForegroundColor Green
  $results += [pscustomobject]@{ Project = $p.Folder; Result = 'pushed'; Detail = $p.Live }
}

Write-Host ''
Write-Host 'Summary' -ForegroundColor Cyan
foreach ($r in $results) {
  $color = switch ($r.Result) { 'pushed' { 'Green' } 'skipped' { 'DarkGray' } default { 'Red' } }
  Write-Host ('  {0,-20} {1,-8} {2}' -f $r.Project, $r.Result, $r.Detail) -ForegroundColor $color
}
if ($results | Where-Object { $_.Result -in @('FAILED', 'BLOCKED') }) { exit 1 } else { exit 0 }
```
