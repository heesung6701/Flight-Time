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

## Aircraft Type Map Updates

The app loads the default aircraft registration to type map from:

```text
data/aircraft-types.json
```

Non-developers should update this map by creating a GitHub issue, not by editing JSON.

### Add or update aircraft types

1. Open the repository on GitHub.
2. Go to `Issues`.
3. Click `New issue`.
4. Choose `Aircraft type map update`.
5. Set `Change type` to `Add or update registrations`.
6. Enter one registration and type per row.

Example:

```tsv
HL8513 B73M
HL8737 B738
HL8211 A332
```

7. Submit the issue.

The automation will update `data/aircraft-types.json`, commit the change, leave a summary comment, and close the issue when complete.

### Delete aircraft types

1. Create the same `Aircraft type map update` issue.
2. Set `Change type` to `Delete registrations`.
3. Enter one registration per row. Do not include aircraft types.

Example:

```tsv
HL8513
HL8514
HL8579
HL8580
```

4. Submit the issue.

The automation will remove those registrations if they exist, commit the change, leave a summary comment with the final map, and close the issue.

### How to check the result

After the automation runs, check the issue comment. It shows:

- the commit that changed the map
- added registrations
- updated registrations
- deleted registrations
- the final aircraft type map

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
- `original` is the primary flight log input.
- `data/aircraft-types.json` provides the shared default aircraft type config.
- Browser-local config overrides can still be entered from the app's Config popup.
