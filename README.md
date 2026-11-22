# Sudoku

Sudoku is a free, ad-free Sudoku game designed to work on phones, tablets, and desktop computers. It runs in the browser, needs no account, and can be installed as a Progressive Web App (PWA) for offline play after the first online visit.

The game offers four difficulty levels, notes, hints, undo, a timer, and local progress and statistics. The interface is in English. Game data stays in the browser on each device; it does not sync between devices and can be lost if site data is cleared.

## Project structure

```text
src/                     Complete static website published to GitHub Pages
  index.html              Game page and interface
  app.js                  UI, interactions, local saves, and PWA registration
  engine.js               Sudoku rules and puzzle transformations
  puzzles.js              Puzzle seeds
  style.css               Responsive styling
  manifest.webmanifest    PWA metadata and icons
  sw.js                   Offline asset cache
  assets/                 App icons and favicon
  .nojekyll               Keeps GitHub Pages from running Jekyll
docs/                    Hosting and device installation guides
.github/workflows/        GitHub Pages deployment workflow
LICENSE                  MIT license
```

The website uses plain HTML, CSS, and JavaScript. It has no build step, runtime dependencies, API calls, ads, or analytics. Keep the files in `src/` together: the page, manifest, and service worker use relative paths, and the service worker controls the published site root.

## Run locally

With Python 3 installed, run this from the repository root:

```sh
python -m http.server 8000 --directory src
```

Open `http://localhost:8000/`. Use a local HTTP server rather than opening `index.html` as a file so the service worker can register. To check offline play, load the page once while online, wait for the offline-ready message, then reload with the browser's network disabled.

## Publish and install

- [Publish with GitHub Pages](docs/github-pages.md)
- [Install on iPhone](docs/pwa-iphone.md)
- [Install on Android](docs/pwa-android.md)

## License

MIT; see [LICENSE](LICENSE).
