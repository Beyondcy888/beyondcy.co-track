# 11 · Connect beyondcy.co (do this LATER, after file 10 is done)

## Goal

Move the three sites from their github.io links to the Beyondcy domain:

| Repo | Now | After this file |
|---|---|---|
| `Beyondcy888/beyondcy.co` | `https://beyondcy888.github.io/beyondcy.co/` | `https://beyondcy.co` (+ `www`) |
| `Beyondcy888/beyondcy.co-dash` | `https://beyondcy888.github.io/beyondcy.co-dash/` | `https://dash.beyondcy.co` |
| `Beyondcy888/beyondcy.co-track` | `https://beyondcy888.github.io/beyondcy.co-track/` | `https://track.beyondcy.co` |

Once a site is connected, its github.io link forwards to the domain automatically.

**Rules:**
- Steps marked **OWNER ACTION** need the owner (Hostinger, github.com, Supabase). Stop, explain exactly what to do, and wait for confirmation.
- Do it at a quiet time: the tracker is unreachable for a short while (usually under an hour) while DNS and HTTPS settle.
- Before starting, the owner takes a **screenshot of the current Hostinger DNS records**, so they can be restored if needed.

---

## Step 1 · OWNER ACTION: verify the domain on GitHub

This stops anyone else from claiming `beyondcy.co` subdomains on GitHub Pages.

On github.com: profile picture → **Settings** → **Pages** → **Add a domain** → `beyondcy.co`. GitHub shows a **TXT record**. Keep the page open; you'll add the record in Step 2, then come back and click **Verify**.

## Step 2 · OWNER ACTION: Hostinger DNS

Go to hPanel → Domains → `beyondcy.co` → **DNS / Nameservers**. The domain must use Hostinger's nameservers.

**Delete** existing records named `@`, `www`, `dash` or `track` of type A, AAAA, CNAME or ALIAS (e.g. Hostinger's parking record). Leave every other record alone.

**Add:**

| Type | Name | Points to |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA (optional) | `@` | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
| CNAME | `www` | `beyondcy888.github.io` |
| CNAME | `dash` | `beyondcy888.github.io` |
| CNAME | `track` | `beyondcy888.github.io` |
| TXT | from Step 1, e.g. `_github-pages-challenge-beyondcy888` | the code GitHub shows |

- **Never put a path in a CNAME** (`beyondcy888.github.io/beyondcy.co-dash` is invalid). GitHub picks the right repo from each repo's custom domain setting.
- Confirm the IP addresses against GitHub's docs ("Managing a custom domain for your GitHub Pages site") before saving.
- Then return to Step 1's page and click **Verify**. It can take some time for DNS to update; retry if it fails at first.

## Step 3 · Agent: switch the code to domain mode

**Tracker (`beyondcy.co-track`):**
- In `.github\workflows\deploy.yml`, **delete the `VITE_BASE_PATH` line**, so the base becomes `/`.
- Add `public\CNAME` containing exactly `track.beyondcy.co`.
- Update `SITE_LINKS` (or wherever the other sites' addresses are kept) to the domain addresses.

**Dashboard (`beyondcy.co-dash`):**
- Add a root `CNAME` file containing exactly `dash.beyondcy.co`.
- Update the site links. If it uses a build with `VITE_BASE_PATH`, remove that line too.

**Portfolio (`beyondcy.co`):**
- Add a root `CNAME` file containing exactly `beyondcy.co`.
- Update the site links. Remove `VITE_BASE_PATH` if used.

**`deploy.ps1`** (in `Beyondcy-Web\` and the copy in `beyondcy.co-track\docs\`): change `$UseCustomDomains = $false` to `$UseCustomDomains = $true`.

Then push everything:
```powershell
cd "<WEB>"
.\deploy.ps1 -Message "Connect beyondcy.co domain"
```

## Step 4 · OWNER ACTION: custom domains and HTTPS on GitHub

In each repo → Settings → Pages → **Custom domain**, enter and Save:
- `beyondcy.co` → `beyondcy.co` (GitHub also redirects `www.beyondcy.co` here)
- `beyondcy.co-dash` → `dash.beyondcy.co`
- `beyondcy.co-track` → `track.beyondcy.co`

Wait for "DNS check successful" (minutes to a few hours; rarely up to 24h). Then tick **Enforce HTTPS** in each repo once the option is available.

## Step 5 · OWNER ACTION: Supabase

Authentication → URL Configuration:
- Site URL = `https://track.beyondcy.co`
- Redirect URLs: keep `https://track.beyondcy.co/**` and `http://localhost:5173/**`. **Remove** `https://beyondcy888.github.io/beyondcy.co-track/**` once track.beyondcy.co works.

## Step 6 · Verify (all must pass)

- [ ] `https://beyondcy.co` and `https://www.beyondcy.co` show the portfolio, with a padlock (HTTPS).
- [ ] `https://dash.beyondcy.co` shows the dashboard page, with HTTPS.
- [ ] `https://track.beyondcy.co` loads the tracker with styles, logo and favicon. Login works, and refreshing a deep page doesn't 404.
- [ ] The password-reset email link opens `https://track.beyondcy.co/reset-password`.
- [ ] Each old github.io link forwards to its domain.
- [ ] Links between the sites use the domain addresses.
- [ ] `.\deploy.ps1` prints the domain links.
- [ ] Update `docs\01`, `docs\06` and `docs\07` with the connected domain.

## If something goes wrong

- **"Domain already taken" or the DNS check fails on GitHub:** make sure no other repo has that custom domain set, the domain is verified (Step 1), and the DNS records match Step 2 exactly. Then wait and retry.
- **To roll back:** remove the custom domains in GitHub, delete the `CNAME` files, restore `VITE_BASE_PATH` in the tracker workflow, set `$UseCustomDomains = $false`, set Supabase's Site URL back to the github.io link, and restore the DNS screenshot. Everything works on github.io again.
