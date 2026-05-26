# Agent Rules

- After completing any repository task, run the relevant verification command when practical.
- Before committing, bump the app patch version in `package.json` for every repository commit and keep the visible `version-badge` text in `index.html` in sync with that version.
- Before committing, run `npm run build`, `npm test`, and the lint check when a lint script is available.
- After verification, commit the finished changes.
- After committing, push the commit to the configured remote branch and check the GitHub Actions result; if it fails, analyze the reason, fix it, verify again, and repeat until the action passes.
- Do not commit or push private flight data, original spreadsheets, local fixtures, or ignored files.
- Keep GitHub Pages deployable from committed static source files only.
