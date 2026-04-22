# Felipe Basurto - Personal Portfolio Website

[![Website](https://img.shields.io/website?url=https%3A%2F%2Ffelipebasurto.github.io)](https://felipebasurto.github.io)
[![GitHub last commit](https://img.shields.io/github/last-commit/felipebasurto/felipebasurto.github.io)](https://github.com/felipebasurto/felipebasurto.github.io/commits/main)

Welcome to my personal portfolio website repository! This site showcases my professional journey, projects, and skills as a Data Scientist and ML Engineer.

## 🌐 Live Website

Visit the site at [felipebasurto.com](https://felipebasurto.com) (GitHub Pages).

## 🛠️ Built With

- Markdown source (`content/cv.md`)
- Node + [marked](https://marked.js.org/) build step
- Static HTML + CSS (terminal / raw-markdown look)

## ✨ Features

- Single source of truth: edit `content/cv.md`, run `npm run build`
- Raw-markdown-style links and visible `##` headings in the UI
- Dark terminal layout with a very subtle navy tint
- GitHub Actions workflow publishes the `_site/` output to Pages

## 🏗️ Project Structure

```
├── content/cv.md       # Portfolio copy (edit this)
├── scripts/
│   ├── build.mjs       # Markdown → HTML
│   └── template.html   # HTML shell
├── css/styles.css
├── assets/
├── index.html          # Generated (also written for branch deploys)
└── _site/              # Generated publish folder (gitignored)
```

## 🚀 Getting Started

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/felipebasurto/felipebasurto.github.io.git
   cd felipebasurto.github.io
   npm install
   ```

2. Edit `content/cv.md`, then build:

   ```bash
   npm run build
   ```

3. Preview locally (paths are root-absolute, so use a static server):

   ```bash
   python3 -m http.server 8080
   ```

   Open `http://localhost:8080`.

**GitHub Pages:** either commit the generated `index.html` and deploy from the `main` branch root, or enable **Actions** as the Pages source and use `.github/workflows/pages.yml` (build runs on every push to `main`).

## 📝 Custom Domain Setup

If you'd like to set up a custom domain for your GitHub Pages site, feel free to reach out to me for guidance. I'm happy to help with:
- Domain purchase and configuration
- DNS settings
- GitHub Pages setup
- SSL certificate setup

## 📫 Contact

Feel free to reach out if you have any questions:
- Email: [felipeasurtobarrio@gmail.com](mailto:felipeasurtobarrio@gmail.com)
- LinkedIn: [felipe-basurto-barrio](https://www.linkedin.com/in/felipe-basurto-barrio/)
- Twitter: [@BasurtoBarrio](https://twitter.com/BasurtoBarrio)

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

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
