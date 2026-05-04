# mcraesocial.com — Site Plan

## What We're Building

Porting `mcraesocial.weebly.com` into a clean, fast, self-hosted static site at `mcraesocial.com`. The new site will look far more polished than Weebly, deploy automatically via GitHub → Vercel, and house all your course resources, external links, and classroom tools in one place.

---

## Current State

| Item | Status |
|---|---|
| Domain (`mcraesocial.com`) | ✅ Live, pointing at a Vercel project |
| GitHub repo (`EvilSharktopus/mcraesocial`) | ✅ Created, temporary landing page pushed |
| Other apps (Workbook, Nationalism Game) | ✅ Already on separate Vercel projects |
| Weebly site | ✅ Still live — will stay up during transition |

---

## Site Architecture (Proposed)

The new site will be a **pure HTML + CSS + vanilla JS** static site (no framework needed). Vercel serves it instantly with no build step.

```
mcraesocial.com/
├── index.html                  ← Hub landing page (DONE — temp version)
├── social-9/index.html         ← Social 9 hub
├── social-10/index.html        ← Social 10 hub
├── social-20/index.html        ← Social 20 hub
├── social-30/index.html        ← Social 30 hub
├── contact/index.html          ← Ask A Question form
├── workbooks/10-2/             ← Proxied via vercel.json → mcraesocial.vercel.app
├── css/
│   └── style.css               ← Shared design system
└── assets/
    └── images/                 ← Banner art
```

Each **course hub page** will have:
- Thematic hero banner image
- Short course question/tagline
- Cards for each subtopic (links to Google Docs, Drive, Forms, etc.)
- Embedded tools where applicable (e.g., Nationalism Game, Calendar)

---

## Pages to Build

### Phase 1 — Foundation (Priority)
- [x] `index.html` — Hub landing (temporary done, will upgrade)
- [x] `vercel.json` — Rewrite rules (workbook proxy done)
- [ ] Shared `css/style.css` — Design tokens, cards, nav, layout
- [ ] Global nav component (same nav on every page)

### Phase 2 — Course Hubs
- [ ] `social-9/index.html` — Social 9 hub (11 subtopics)
- [ ] `social-10/index.html` — Social 10 hub (9 subtopics)
- [ ] `social-20/index.html` — Social 20 hub (8 subtopics)
- [ ] `social-30/index.html` — Social 30 hub (9 subtopics)

### Phase 3 — Resource Subtopic Pages (optional, or just link externally)
Each hub card will link directly to Google Docs/Drive by default. If you want full pages
for each subtopic, we can build those too.

### Phase 4 — Utilities
- [ ] `contact/index.html` — Ask A Question form (Formspree or Google Form embed)
- [ ] Update `index.html` hub with final links to all 4 courses + apps

---

## Design System

Matching existing dark aesthetic from current `mcraesocial.com`:

| Token | Value |
|---|---|
| Background | `#090c14` |
| Surface | `#111827` |
| Accent Blue | `#6c8cff` (SS 10 / workbook) |
| Accent Red | `#ff6b6b` (Nationalism / SS 20) |
| Accent Green | `#56d48b` (SS 9) |
| Accent Gold | `#f5c842` (SS 30) |
| Font | Inter (Google Fonts) |

Each course gets its own accent color for visual identity.

---

## Weebly Content Inventory Summary

| Course | Subtopic Pages | Key Resources |
|---|---|---|
| Social 9 | 11 | YCJA, CCRF, Mock Election, PAT Prep, Textbook (Ch 1–9) |
| Social 10 | 9 | Identity, Historical/Modern Globalization, Socratic Seminars, Textbooks |
| Social 20 | 8 | Nationalism, Create a Country, Ultranationalism, Internationalism |
| Social 30 | 9 | Ideologies, Dictatorships, Cold War Sim, Diploma Prep |

All external resources (Google Docs, Drive, YouTube embeds) will be preserved as-is via links/embeds.

---

## Vercel Setup (action required)

Before the new site can go live at `mcraesocial.com`, you need to:

1. Go to your **Vercel dashboard**
2. Create a **New Project** → Import `EvilSharktopus/mcraesocial` from GitHub
3. Framework: **Other** (static HTML, no build step needed)
4. Deploy it, then go to **Settings → Domains** and add `mcraesocial.com`
5. Remove `mcraesocial.com` from whichever old Vercel project currently has it

Once that's done, every push to GitHub auto-deploys. 🚀

---

## Open Questions

1. **Subtopic pages**: Full pages per subtopic (e.g., `/social-9/ycja/`), or just hub cards linking straight to Google Drive?
2. **Contact form**: Embed the existing Google Form, or build a native form via Formspree?
3. **Google Calendar**: Embed on homepage like Weebly did?
4. **Nationalism Game link**: What is the real Vercel URL for the Nationalism Game?
