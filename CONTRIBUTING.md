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

From the repository folder:

```bash
node tests/helpers.test.js
node tests/rules.test.js
node tests/static-build.test.js
node tests/workbook.test.js
node tests/feedback.test.js
node tests/browser-regression.test.js
```

The browser regression and style-guide rule checks use Playwright Chromium when it is installed. The other checks use Node.js built-in modules.

## Test the extension manually

1. Open `chrome://extensions` or `edge://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked** and choose the repository folder.
4. After changing a file, return to the extensions page and reload the extension.
5. Test the side panel, full-page workspace and any affected scan profiles.

Do not commit generated ZIP files. Release packages are created from reviewed repository files.
