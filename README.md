# Flight-Time

Flight Time Logbook is a static web app that converts CPS `original` flight log data into a paged logbook output.

## Local Run

```bash
python3 -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173
```

## Test

```bash
npm test
```

## GitHub Pages Deployment

This repo includes a GitHub Actions workflow at `.github/workflows/pages.yml`.

To deploy:

1. Push to the `main` branch.
2. In GitHub, open `Settings -> Pages`.
3. Set `Source` to `GitHub Actions`.
4. The workflow runs tests and deploys the static site.

Expected Pages URL:

```text
https://heesung6701.github.io/Flight-Time/
```

## Notes

- The app is static and runs in the browser.
- Uploaded flight data is parsed locally in the browser.
- Aircraft config is stored in the browser's `localStorage`.
- `original` is the only expected input sheet/data source.
