# Felipe Basurto — Personal portfolio

[![Website](https://img.shields.io/website?url=https%3A%2F%2Ffelipebasurto.com)](https://felipebasurto.com)
[![GitHub last commit](https://img.shields.io/github/last-commit/felipebasurto/felipebasurto.github.io)](https://github.com/felipebasurto/felipebasurto.github.io/commits/main)

Static site for my CV, service pages, and longer **Details** pages per role. Built from Markdown with a small Node script.

## Live site

[https://felipebasurto.com](https://felipebasurto.com) on Cloudflare Workers. Deploy with `npm run deploy`.

## Editing and structure

- `content/cv.md`: home page.
- `content/experience/`: employment and Encore.
- `content/projects/`: project Details pages, `index.md`, and `catalog.json`.
- `content/education/`: education Details pages.
- `content/community/cursor.json`: SpaceXAI community timeline.
- `content/music/triplecheck.md`: Triple Check.
- `content/pages/`: general landing pages.
- `content/blog/`: articles; `draft: true` hides an article from production.
- `content/llms.txt`: professional summary for AI assistants. Project and blog blocks are filled in during the build, in the output only.
- `src/template.html`, `src/styles.css`, `src/diagrams/`: shared presentation.
- `public/`: static assets and files copied to the site, including the standalone Musatro embed.
- `scripts/build.mjs`: build entry point. Shared paths and routes live in `scripts/lib/`; `scripts/prepare-dist.mjs` prepares the output directory.
- `dist/`: complete generated site, ignored by Git. Never edit it directly.

Source folders do not determine public URLs. The Details pages retain their existing `/experience/<slug>/` URLs; routes are defined in `scripts/lib/routes.mjs`. Static asset URLs remain `/assets/…`, and styles remain at `/css/styles.css`.

## Build, verify, and preview

```bash
npm ci
npm run build
npm run verify
npm run preview
```

`npm run build` creates the complete site directly in `dist/`, including HTML, RSS, public Markdown, `sitemap.xml`, and `llms.txt`. `npm run build:dist` is an alias for the same build, retained for Wrangler. The build cleans `dist/` first so removed pages cannot survive from an earlier build.

`npm run verify` builds and checks generated routes, internal links, assets, and publication boundaries. For a draft preview, use `BLOG_DRAFTS=1 npm run preview`. Drafts stay out of RSS, the sitemap, and AI-discovery listings.

`npm run preview` runs Wrangler locally. Alternatively, serve **dist**, not the repository root:

```bash
python3 -m http.server 8080 --directory dist
```

The community timeline uses images from `public/assets/experience/cursor/`. An image entry can use `{ "static": "filename.jpg", "alt": "Description" }`, or a remote URL with a stable name. The build downloads remote images only when missing; new downloads go into `dist/`. Copy any image you want to retain into `public/assets/experience/cursor/` and commit it. Do not reuse a remote image URL for different events.

## Deploy

```bash
npm run deploy
```

Wrangler runs the build and publishes `dist/` to the `felipebasurto-com` Cloudflare Worker. Custom domains and static asset handling are configured in `wrangler.jsonc`.

## Contact

- Email: [hello@felipebasurto.com](mailto:hello@felipebasurto.com)
- LinkedIn: [felipe-basurto-barrio](https://www.linkedin.com/in/felipe-basurto-barrio/)
- Twitter / X: [@fildotai](https://x.com/fildotai)

## Rights

Personal portfolio: **all rights reserved**. No license is granted to copy or redistribute the content or branding. The build tooling (e.g. marked) remains under its respective licenses.

```
       __________________
      |  ________________|
      | |                |
      | |   Hello,       |
      | |   World! :)    |
      | |   _________    |
      | |  |    |  |    |
      | |  |    |  |    |
      | |  |    |  |    |
      | |  |____|__|    |
      | |                |
      | |________________|
      |                  |
      |    [_________]   |
      |__________________|

```
