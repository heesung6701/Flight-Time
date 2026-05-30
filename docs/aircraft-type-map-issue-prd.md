# Aircraft Type Map Issue Automation PRD

## 1. Overview

Flight Time uses `data/aircraft-types.json` as the shared aircraft registration to aircraft type database. The browser loads this JSON as the default config, then applies browser-local overrides from the Config popup or uploaded workbook `config` sheet when present.

This document defines the GitHub Issue based workflow for adding, updating, and deleting entries in `data/aircraft-types.json` without requiring non-developers to edit JSON or run Git commands.

Current implementation:

- `.github/ISSUE_TEMPLATE/aircraft-type-map-add-update.yml`
- `.github/ISSUE_TEMPLATE/aircraft-type-map-delete.yml`
- `.github/workflows/apply-aircraft-type-issue.yml`
- `scripts/apply-aircraft-type-issue.mjs`
- `data/aircraft-types.json`

## 2. Problem

Aircraft type mappings need occasional manual maintenance:

- New aircraft registrations appear in CPS original data.
- Existing mappings may need correction.
- Old or incorrect registrations may need removal.

Directly editing `data/aircraft-types.json` is error-prone for non-developers because it requires JSON syntax, Git commits, and version synchronization. The update flow should be simple, auditable, and visible in GitHub.

## 3. Goals

- Let users request map changes through a GitHub Issue Form.
- Support add, update, and delete operations.
- Automatically commit valid changes to `data/aircraft-types.json`.
- Bump the app patch version whenever the automation creates a repository commit.
- Resolve the issue with a comment that includes the commit link, added/updated/deleted rows, and final map.
- Keep private flight data out of the repository.

## 4. Non-Goals

- No RapidAPI, AeroDataBox, or external aircraft lookup.
- No automatic extraction from private original spreadsheets.
- No manual JSON editing requirement for normal users.
- No client-side write access to GitHub.

## 5. Issue Form

Users create an issue from one of two purpose-specific templates:

- **Aircraft type map add/update** for adding new registrations or changing aircraft types.
- **Aircraft type map delete** for removing registrations.

Fields:

| Template | Field | Purpose |
|---|---|---|
| Aircraft type map add/update | Registrations and aircraft types | Contains `registration type` rows to add/update. |
| Aircraft type map delete | Registrations to delete | Contains registration-only rows to remove. |

The templates apply the `aircraft-type-map` label. The workflow also recognizes matching issues by title prefix `[aircraft-type-map]` / `[aircraft-type-map-delete]` or known row section headings, so the automation can still run if GitHub does not attach the label immediately.

## 6. Input Format

### 6.1 Add or Update

Enter one `registration type` pair per row.

```tsv
HL8513 B73M
HL8737 B738
HL8211 A332
```

Accepted separators:

- tab
- comma
- whitespace

### 6.2 Delete

Enter one registration per row. Do not include aircraft types.

```tsv
HL8513
HL8514
HL8579
HL8580
```

## 7. Normalization Rules

| Value | Rule |
|---|---|
| Registration | Trim, uppercase, keep only `A-Z`, `0-9`, and `-`. |
| Aircraft type | Trim, uppercase, keep only `A-Z` and `0-9`. |

For add/update, each row must include both registration and aircraft type. For delete, registration-only rows are valid.

## 8. Automation Flow

1. A matching issue is opened, edited, or reopened.
2. The workflow detects whether the issue is an aircraft type map request.
3. If needed, the workflow creates and attaches the `aircraft-type-map` label.
4. The script parses the issue body.
5. The script applies the requested add/update/delete operations to `data/aircraft-types.json`.
6. If no data changed, the workflow comments that the map is already up to date and does not close the issue.
7. If data changed, the script bumps the app patch version and syncs:
   - `package.json`
   - `package-lock.json`
   - `index.html`
8. The workflow commits and pushes the changed files.
9. The workflow comments with the commit link, change summary, and final map.
10. The workflow closes the issue with `completed` state reason.

## 9. Commit Scope

The workflow commits only:

- `data/aircraft-types.json`
- `package.json`
- `package-lock.json`
- `index.html`

The workflow must not commit private flight data, original spreadsheets, fixtures, or ignored files.

## 10. Resolve Comment

When a change is committed, the issue receives a comment in this shape:

````md
Aircraft type map was applied in commit abc1234: https://github.com/heesung6701/Flight-Time/commit/...

### Added
- HL8737: B738

### Updated
- HL8513: B738 -> B73M

### Deleted
- HL8580: B73M

### Final map
```tsv
HL8513	B73M
HL8737	B738
```

Resolving this issue.
````

Then the issue is closed as completed.

## 11. Validation

Expected verification:

- `npm test` passes.
- `scripts/apply-aircraft-type-issue.mjs` parses add/update rows.
- `scripts/apply-aircraft-type-issue.mjs` parses delete rows with registration-only input.
- The workflow is wired to issue events and writes a resolve comment with final map.
- Version badge and module cache-busting strings match `package.json`.

## 12. Future Improvements

- Add an issue form field for a short reason or source note.
- Add duplicate-row warnings in the resolve comment.
- Add stricter aircraft type validation if the accepted type list becomes fixed.
- Optionally close unchanged issues after an explicit no-op confirmation policy is decided.
