## Learned User Preferences

- Public portfolio copy is English-only.
- Copy is aimed at startup and tech hiring: clear, credible, and professional; avoid cringe, hype, LinkedIn-style clichés, and flashy lifestyle marketing on product pages.
- Use the label "Details" instead of "Inside" for links to long-form experience pages.
- Keep the official wording "Cursor Madrid Ambassador" when describing the Cursor community role.
- "Pokémon-style" is acceptable when describing HabitDex's gamified habit loop.
- Preserve the intentional raw-markdown and terminal aesthetic; avoid generic marketing-card treatments the user has rejected (for example circular profile photo with accent ring, or boxed card grids for parallel activities).
- Encore belongs under Experience; HabitDex is not listed as parallel experience and stays in Projects only.
- Prefer evergreen portfolio copy over ephemeral operational details such as per-event thank-yous, surveys, or mass emails to attendees.
- Use the X (Twitter) handle @fildotai in site links.
- On Projects, differentiate major shipped work from minor coursework and repositories (for example with progressive disclosure), rather than one undifferentiated list.
- When crediting collaborators, include explicit visible link text such as "LinkedIn" because link destinations are not obvious in the markdown-styled UI.

## Learned Workspace Facts

- The live personal site is at https://felipebasurto.com/ and is deployed from the GitHub Pages repository felipebasurto.github.io.
- Static HTML is generated with `npm run build` via `scripts/build.mjs`, compiling Markdown under `content/` plus `content/experience/cursor.json` for the Cursor Madrid timeline.
- There is no `npm run dev` script; local preview is done by serving the repo root as static files (for example `python3 -m http.server` on a chosen port) after a build.
- Primary editable sources include `content/cv.md`, `content/projects.md`, and `content/experience/*.md`, with shared chrome in `scripts/template.html` and `css/styles.css`.
- GEO and AI-discoverability assets include a root `llms.txt`, an expanded `robots.txt` with explicit Allow rules for common AI crawlers, and enriched JSON-LD on the home page emitted by the build.
