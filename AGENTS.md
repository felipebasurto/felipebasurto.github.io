## Learned User Preferences

- Public portfolio copy is English-only.
- Copy is aimed at startup and tech hiring: clear, credible, and professional; avoid cringe, hype, LinkedIn-style clichés, and flashy lifestyle marketing on product pages.
- Use the label "Details" instead of "Inside" for links to long-form experience pages.
- Keep the official wording "SpaceXAI Europe Regional Lead & Madrid Ambassador" when describing the community role (Cursor Community until 2026; started as Madrid Ambassador in May 2025). Do not write as if the ambassador role ended. Do not rebrand past Café Cursor events.
- "Pokémon-style" is acceptable when describing HabitDex's gamified habit loop.
- Preserve the intentional raw-markdown and terminal aesthetic; avoid generic marketing-card treatments the user has rejected (for example circular profile photo with accent ring, or boxed card grids for parallel activities).
- Encore belongs under Experience; HabitDex and Musatro are not listed as parallel experience and stay in Projects only.
- Prefer evergreen portfolio copy over ephemeral operational details such as per-event thank-yous, surveys, or mass emails to attendees.
- Use the X (Twitter) handle @fildotai in site links.
- On Projects, differentiate major shipped work from minor coursework and repositories (for example with progressive disclosure), rather than one undifferentiated list.
- When crediting collaborators, include explicit visible link text such as "LinkedIn" because link destinations are not obvious in the markdown-styled UI.

## Learned Workspace Facts

- The live personal site is at https://felipebasurto.com/ on Cloudflare Workers (`felipebasurto-com`). Deploy with `npm run deploy`.
- Cloudflare Workers static assets are configured in `wrangler.jsonc` (assets from `dist/`). Preview with `npm run preview`.
- Static HTML is generated with `npm run build` via `scripts/build.mjs`; `npm run build:dist` also copies public files into `dist/` via `scripts/prepare-dist.mjs`.
- Local preview: `npm run preview` (Wrangler) or serve the repo root as static files after a build.
- Primary editable sources include `content/cv.md`, `content/projects.md`, and `content/experience/*.md`, with shared chrome in `scripts/template.html` and `css/styles.css`.
- GEO and AI-discoverability assets include a root `llms.txt`, an expanded `robots.txt` with explicit Allow rules for common AI crawlers, and enriched JSON-LD on the home page emitted by the build.
