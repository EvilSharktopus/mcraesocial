# McRae Social — Deployment Architecture

## How It Works

The site is split across two services:

| What            | Where                              | Project            |
|-----------------|------------------------------------|--------------------|
| Site pages      | Vercel → `mcraesocial.com`         | `socialsite`       |
| Slide decks     | Firebase → `mcraesocial-slides.web.app` | `project-7910201586224417193` |

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
