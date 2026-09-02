# McRae Social — Deployment Architecture

## How It Works

The site is split across two services:

| What            | Where                              | Project            |
|-----------------|------------------------------------|--------------------|
| Site pages      | Vercel → `mcraesocial.com`         | `socialsite`       |
| Political Gravity | Vercel → `mcraesocial.com/gravity/` | `socialsite`     |
| Slide decks     | Firebase → `mcraesocial-slides.web.app` | `project-7910201586224417193` |

## Political Gravity

The React app lives in `political-gravity/`. It is served from
`mcraesocial.com/gravity/` as a **static build committed to `gravity/`** — the
root Vercel project deploys that folder as-is and does not build the app.

After changing anything under `political-gravity/src/`, rebuild that folder or
the live site will not change:

```
cd political-gravity
npx vite build --base=/gravity/ --outDir ../gravity --emptyOutDir
```

Then commit both `political-gravity/src/` and `gravity/`. The root project
auto-deploys from `main`, so pushing is enough — no `deploy.ps1` run needed.

`political-gravity.vercel.app` is **retired**. That project now serves only a
redirect to `mcraesocial.com/gravity/` (see `political-gravity/vercel.json`).
It is not connected to GitHub, so it needs one `deploy.ps1` run to pick the
redirect up; after that, use `.\deploy.ps1 -SkipGravityRedirect`.

All `<iframe>` tags in the HTML pages point to `https://mcraesocial-slides.web.app/...`.
Vercel does **not** serve any slides (they're excluded via `.vercelignore`).

## Your Workflow

### Adding/updating slide decks
1. Export from Keynote on your Mac
2. Let OneDrive sync to: `C:\Users\Owner\OneDrive - Rocky View Schools\McRae Dropzone`
3. Run `sync-slides.ps1` — it copies from OneDrive → `assets/slides/` → deploys to Firebase

### Editing site pages
1. Edit the HTML files in `social-9/`, `social-10/`, `social-20/`, `social-30/`
2. Run `deploy.ps1` — it deploys to Vercel (`mcraesocial.com`)

## Firestore rules

The rules live **only in the Firebase console** — there is no copy in this
repo, deliberately:
https://console.firebase.google.com/project/mcrae-assignments-ca/firestore/rules

A `firestore.rules` file used to sit here and had drifted out of date; anything
that reintroduces one risks a deploy overwriting the live rules with an older
version. `firebase.json` declares hosting only, so `firebase deploy` from this
folder can only publish slides.

## ⚠️ Do NOT

- **Do NOT relink** `.vercel/` to a different project. It must stay linked to `socialsite`.
- **Do NOT use `/assets/slides/` paths** in iframe src attributes. Always use `https://mcraesocial-slides.web.app/...`.
- **Do NOT remove `assets/slides/` from `.vercelignore`**. The slides folder is too large for Vercel.

## Key Files

| File              | Purpose                                              |
|-------------------|------------------------------------------------------|
| `.vercelignore`   | Excludes slides + scripts from Vercel deploys        |
| `firebase.json`   | Firebase Hosting config (serves `assets/slides/`)    |
| `sync-slides.ps1` | Syncs OneDrive → local → Firebase                   |
| `deploy.ps1`      | Deploys site pages to Vercel (`mcraesocial.com`)     |
| `.vercel/repo.json`| Links this folder to Vercel project `socialsite`    |
