## Learned User Preferences

- Public portfolio copy is English-only.
- Copy is aimed at startup and tech hiring: clear, credible, and professional; avoid cringe, hype, LinkedIn-style clichés, and flashy lifestyle marketing on product pages.
- Use the label "Details" instead of "Inside" for links to long-form experience pages.
- Keep the official wording "SpaceXAI Europe Regional Lead & Madrid Ambassador" when describing the community role (started as Cursor Madrid Ambassador in May 2025, then Europe Regional Lead). After Cursor was acquired by SpaceX, the community continues as SpaceXAI Ambassadors. Public source: https://cursor.com/blog/joining-spacex. Do not use Slack names, Sunita, Ben Lang, or 14 Aug / 2 Sep chronology. Do not write as if the ambassador role ended. Do not rebrand past Café Cursor events. Do not mix iOS, Mac, Encore, or Triple Check into the SpaceXAI paragraph: those stay on their own Details pages. Each experience page talks only about itself.
- "Pokémon-style" is acceptable when describing HabitDex's gamified habit loop.
- Preserve the intentional raw-markdown and terminal aesthetic; avoid generic marketing-card treatments the user has rejected (for example circular profile photo with accent ring, or boxed card grids for parallel activities).
- Encore belongs under Experience; HabitDex and Musatro are not listed as parallel experience and stay in Projects only.
- Prefer evergreen portfolio copy over ephemeral operational details such as per-event thank-yous, surveys, or mass emails to attendees.
- Use the X (Twitter) handle @fildotai in site links.
- On Projects, differentiate major shipped work from minor coursework and repositories (for example with progressive disclosure), rather than one undifferentiated list.
- Felipe is deciding between a full-time role (AI Solutions Architect, Solutions Engineer, Forward Deployed Engineer) and starting his own AI company. Keep positioning neutral: "Open to full-time roles and project work." Do not frame the site as a job hunt or as an agency.
- Public client facts that are approved for the site: AILY LABS work was for a Fortune 500 pharmaceutical company; Multiverse work included AWS, NVIDIA, and Dell, and an on-premises GPU deployment for a defense-sector customer. Do not publish Encore revenue, MRR, or subscriber counts. Use accounts (over 2,700) and concerts logged (over 15,000). Do not name the marketing accounts or say how many there are.
- When crediting collaborators, include explicit visible link text such as "LinkedIn" because link destinations are not obvious in the markdown-styled UI.

## Learned Workspace Facts

- The live personal site is at https://felipebasurto.com/ on Cloudflare Workers (`felipebasurto-com`). Deploy with `npm run deploy`.
- Cloudflare Workers static assets are configured in `wrangler.jsonc` (assets from `dist/`). Preview with `npm run preview`.
- `npm run build` generates the complete site directly in `dist/`. `npm run build:dist` is an alias retained for Wrangler. Generated output is not committed.
- Local preview: `npm run preview` (Wrangler), or `python3 -m http.server 8080 --directory dist` after a build.
- Editable copy lives in `content/`: `cv.md`, `experience/`, `projects/` (`index.md` and `catalog.json` plus Details pages), `education/`, `community/`, `music/`, `pages/`, and `blog/`.
- Shared presentation lives in `src/template.html`, `src/styles.css`, and `src/diagrams/`. Static files live in `public/`.
- Source categories are independent of public URLs. `scripts/lib/routes.mjs` preserves the established `/experience/<slug>/` routes for employment, product, education, and community Details pages.
- GEO and AI-discoverability sources include `content/llms.txt` and `public/robots.txt`; enriched JSON-LD is emitted by the build. Project and blog blocks in `llms.txt` are generated only in `dist/`.
- Run `npm run verify` after build or routing changes to check the generated artifact.
