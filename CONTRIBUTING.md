# Contributing

This repository contains a browser extension built with HTML, CSS and JavaScript. It has no build step.

## Make a change

1. Create a branch from `main`.
2. Make the smallest change that addresses the issue.
3. Keep interface wording in plain language.
4. Check keyboard access, focus behaviour and narrow side-panel layouts.
5. Run the automated checks.
6. Open a pull request describing the change and how it was verified.

## Run the checks

Use Node.js 20 or later. From the repository folder:

```bash
npm ci
npx playwright install chromium
npm test
```

`npm test` is the complete local suite. The browser regression, style-guide rule and highlight checks use Playwright Chromium. When Chromium is unavailable locally, those suites report that they were skipped.

Pull-request checks run `npm run test:ci`. Strict test mode requires all browser suites to run and fails when Playwright or Chromium is unavailable.

## Maintain name recognition

Edit approved literal forms in `data/indigenous-name-catalogue.json`, retaining their source references and recognition decisions. Only entries marked `Official page read` can contribute new automatic forms. Keep standalone acronyms and ambiguous short forms held for normal contextual checks. Store research commentary separately from extension files.

Regenerate the embedded snapshot and run its checks:

```bash
npm run sync:indigenous-names
node scripts/sync-indigenous-names.js --check
node tests/indigenous-name-catalogue.test.js
```

The generator validates the metadata fields and embeds approved forms in `checker-core.js`. Scans do not load the source JSON or visit its URLs. See [recognition boundaries](docs/design-decisions.md#name-and-language-recognition) before changing the matching behaviour.

## Test the extension manually

1. Open `chrome://extensions` or `edge://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked** and choose the repository folder.
4. After changing a file, return to the extensions page and reload the extension.
5. Test the side panel, full-page workspace and any affected scan profiles.

Do not commit generated ZIP files. Release packages are created from reviewed repository files.

## Maintain documentation

Keep repository documentation focused on current usage, design and maintenance. Put patch ordering, working-session summaries and one-off verification reports in pull-request descriptions or delivery messages.
