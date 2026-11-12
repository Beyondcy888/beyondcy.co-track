# 02 · Move the portfolio into the `beyondcy.co` repo

A team member built the Beyondcy portfolio. The owner placed her project folder at:

```
Beyondcy-Web\beyondcy-website\      <- outside the three repos; plain folder, not a git repo
```

**Goal:**
- Its content becomes the `beyondcy.co` repo, replacing the "Stay tuned" page.
- It runs on `https://beyondcy888.github.io/beyondcy.co/` now, and on `https://beyondcy.co` later (file 11).
- **Don't rebuild the site.** Move what exists and fix only what's needed for it to run and publish.
- When it's finished, `beyondcy-website` no longer exists outside the repo.

## Phase A · Inspect and report (no changes yet)

Report to the owner:
1. **What it's built with.** Look for `package.json` and its scripts (Vite, React, Next.js, Astro…), or plain `.html` + `.js` + `.css` files. The owner saw JS files, so check whether they are plain browser scripts or a framework.
2. **How to run it locally** (`npm install` + `npm run dev`, or opening `index.html`), and whether it actually runs right now.
3. **Pages and routing:** a list of pages and their entry files. Is it one page, several `.html` pages, or a single-page app with a router?
4. **Paths that break under `/beyondcy.co/`:** absolute paths like `/images/…`, `/assets/…`, `href="/about"`, and CSS `url(/…)`.
5. **The login page:** which files, and whether it calls any service (Supabase, Firebase, an API). List every link, button or route that leads to it.
6. **External services and keys:** any API keys, form services, analytics, or `.env` files. **Flag any secret key**; it must not go into a public repo.
7. **Size:** total size without `node_modules`/build output, and any single file over 50 MB (GitHub refuses files over 100 MB). Note heavy images or videos.
8. **Can GitHub Pages host it?** Pages serves static files only. If it needs a server (e.g. Next.js API routes or server rendering), say so and propose the static option (e.g. Next.js `output: 'export'`).

Wait for the owner's OK before Phase B.

## Phase B · Move it in

1. In `Beyondcy-Web\beyondcy.co\`, remove the "Stay tuned" page files. Keep `.gitignore`, and keep the favicons unless the portfolio has its own.
2. **Move** the portfolio's content into `beyondcy.co\`, at the root of the repo. **Don't move**: `node_modules\`, build output (`dist\`, `build\`, `.next\`, `out\`), `.git\`, or any `.env*` (set those values up properly instead, see step 5).
3. Make sure `.gitignore` covers `node_modules/`, build output and `.env*` (except `.env.example`).
4. **No `CNAME` file.**
5. If the site needs public config values (e.g. a form endpoint), use a `.env.example` plus GitHub secrets, the same way as the tracker. **Never commit secret keys.**

## Phase C · Make it run on github.io (and later on the domain)

Pick the matching case:

| The portfolio is… | Do this |
|---|---|
| **Plain HTML/CSS/JS** | Make every path **relative** (`images/x.jpg`, `about.html`), with no leading `/`. Add an empty `.nojekyll`. Publish: Deploy from a branch → `main` / `(root)`. |
| **Vite (React/Vue/vanilla)** | `base: process.env.VITE_BASE_PATH \|\| '/'` in `vite.config`. GitHub Actions workflow like the tracker's, with `VITE_BASE_PATH: /beyondcy.co/` (no Supabase secrets). If it uses a client router, set `basename` from `import.meta.env.BASE_URL` and copy `index.html` → `404.html`. Publish: GitHub Actions. |
| **Next.js** | Static export: `output: 'export'`, `basePath: process.env.BASE_PATH \|\| ''`, `images: { unoptimized: true }`, `trailingSlash: true`. Actions workflow builds and uploads `out/` with `BASE_PATH=/beyondcy.co`. Publish: GitHub Actions. |
| **Something else** | Explain it to the owner and propose the simplest static setup. |

In every case:
- Keep the base path in **one variable**, so file 11 (connect domain) only removes it.
- Images, fonts, videos and CSS backgrounds must all load under `/beyondcy.co/`.
- Favicons and the page title should be there, using the Beyondcy favicon set from the tracker if the portfolio has none.

## Phase D · The login page: keep it, don't use it

- **Keep its files** in the repo, unchanged where possible, with a short comment at the top: `Login page - not connected yet. Will be linked in a later update.`
- **Remove every way to reach it from the site:** nav items, buttons, footer links, router routes. Comment routes out rather than deleting them.
- **Leave it out of the published site** if the build allows it (e.g. not registered as a route or build entry). If it's a plain `.html` file that can't be excluded, add `<meta name="robots" content="noindex, nofollow">` so search engines skip it.
- **Don't connect it to anything** (no Supabase, no auth).

## Phase E · Test, publish, tidy up

1. **Test locally:** the dev server, plus a production build served under `/beyondcy.co/` (e.g. `vite preview --base /beyondcy.co/`, or for static files a simple local server opened at `/beyondcy.co/`). Click through every page and check images, fonts and links. The login page must not be reachable from the site.
2. **Show the owner** the local result.
3. `.\deploy.ps1 site -Message "Portfolio: move in the team's website"`
4. **OWNER ACTION:** Settings → Pages → Source, following the case table above.
5. Verify `https://beyondcy888.github.io/beyondcy.co/` against the same checklist as step 1.
6. **With the owner's OK:** delete `Beyondcy-Web\beyondcy-website\`. Its content now lives in `beyondcy.co\`, and nothing should remain outside the three repo folders.

## Done when

- [ ] The portfolio works at `https://beyondcy888.github.io/beyondcy.co/`: all pages, images and fonts load, with no console errors.
- [ ] The login page code is in the repo but not linked, routed or connected.
- [ ] No `CNAME`, no secrets, nothing over 100 MB in the repo.
- [ ] `Beyondcy-Web\beyondcy-website\` is removed (after the owner's OK).
- [ ] The base path is in one place, ready for file 11.
