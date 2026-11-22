# Publish Sudoku with GitHub Pages

This repository publishes the contents of `src/` as a static site through GitHub Actions. The workflow is at `.github/workflows/deploy.yml`; no build or package installation is needed.

1. Push the repository, including `src/` and `.github/workflows/deploy.yml`, to the `main` branch on GitHub.
2. In the repository, open **Settings → Pages**. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Open **Actions** and wait for the **Deploy Sudoku to GitHub Pages** workflow to succeed. You can also run it manually from **Actions → Deploy Sudoku to GitHub Pages → Run workflow**.
4. Return to **Settings → Pages** and open the published site link. For the current `mbnholo/sudoku` repository, the expected project-site URL is `https://mbnholo.github.io/sudoku/` unless a custom domain is configured.
5. Check that the game loads, the icons appear, and the status changes to offline ready. Then test a reload without a network connection. On a phone, open the published HTTPS URL before installing the PWA.

Future pushes to `main` deploy automatically. If the workflow is disabled or the Pages source is set to **Deploy from a branch**, switch the source back to **GitHub Actions** and rerun the workflow. A project site is served below the repository name (`/sudoku/`); the app's relative URLs and manifest scope are designed for that path.

Repository visibility and Pages availability depend on the GitHub account or organization plan. If the **Pages** setting is unavailable, check the repository's visibility and the plan's current Pages eligibility.
