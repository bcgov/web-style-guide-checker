"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const requireBrowserTests = process.env.REQUIRE_BROWSER_TESTS === "1";

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  if (requireBrowserTests) {
    console.error("Highlight tests require Playwright in strict test mode.");
    console.error(error);
    process.exit(1);
  }
  console.log("Highlight tests skipped: Playwright package is not installed.");
  process.exit(0);
}

const source = fs.readFileSync(path.join(__dirname, "..", "sidepanel.js"), "utf8");
const start = source.indexOf("async function revealFindingElements");
const end = source.indexOf("async function highlightSelector", start);
assert.ok(start >= 0 && end > start, "Reveal helper must be testable");
const revealSource = source.slice(start, end).trim();

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setContent(`
    <section class="accordion panel-group">
      <div class="panel">
        <div class="panel-heading"><a id="trigger" data-toggle="collapse" href="#answer" aria-expanded="false">View disclaimer</a></div>
        <div id="answer" class="panel-collapse collapse" aria-hidden="true" style="display:none">
          <p id="target">It is provided as is.</p>
        </div>
      </div>
    </section>
  `);
  const fallback = await page.evaluate(async ({ revealSource }) => {
    const reveal = eval(`(${revealSource})`);
    const result = await reveal(["#target"]);
    const panel = document.querySelector("#answer");
    const target = document.querySelector("#target");
    return {
      result,
      display: getComputedStyle(panel).display,
      hidden: panel.getAttribute("aria-hidden"),
      show: panel.classList.contains("show") || panel.classList.contains("in"),
      highlighted: target.dataset.bcStyleCheckerHighlight === "true"
    };
  }, { revealSource });
  assert.equal(fallback.result, true);
  assert.notEqual(fallback.display, "none");
  assert.equal(fallback.hidden, null);
  assert.equal(fallback.show, true);
  assert.equal(fallback.highlighted, true);

  await page.setContent(`
    <details id="outer"><summary>Outer</summary>
      <details id="inner"><summary>Inner</summary><p id="nested">Nested finding</p></details>
    </details>
  `);
  const nested = await page.evaluate(async ({ revealSource }) => {
    const reveal = eval(`(${revealSource})`);
    const result = await reveal(["#nested"]);
    return { result, outer: document.querySelector("#outer").open, inner: document.querySelector("#inner").open };
  }, { revealSource });
  assert.equal(nested.result, true);
  assert.equal(nested.outer, true);
  assert.equal(nested.inner, true);

  await page.setContent(`
    <section class="accordion panel-group">
      <button id="button" aria-controls="controlled" aria-expanded="false">Open</button>
      <div id="controlled" class="collapse" style="display:none"><p id="clicked">Finding</p></div>
    </section>
    <script>
      document.querySelector('#button').addEventListener('click', () => {
        const panel = document.querySelector('#controlled');
        panel.style.display = 'block';
        panel.classList.add('show');
        document.querySelector('#button').setAttribute('aria-expanded', 'true');
      });
    </script>
  `);
  const clickPath = await page.evaluate(async ({ revealSource }) => {
    const reveal = eval(`(${revealSource})`);
    const result = await reveal(["#clicked"]);
    return { result, expanded: document.querySelector("#button").getAttribute("aria-expanded"), display: getComputedStyle(document.querySelector("#controlled")).display };
  }, { revealSource });
  assert.equal(clickPath.result, true);
  assert.equal(clickPath.expanded, "true");
  assert.notEqual(clickPath.display, "none");

  await page.setContent(`
    <section class="accordion panel-group">
      <div class="panel">
        <div class="panel-heading"><a id="stuck-trigger" class="collapsed" data-toggle="collapse" href="#stuck-panel" aria-expanded="false">View disclaimer</a></div>
        <div id="stuck-panel" class="panel-collapse collapse collapsing" aria-hidden="true" style="display:block;height:0;max-height:0;overflow:hidden;visibility:hidden">
          <p id="stuck-target">Finding inside a panel whose page script never finishes opening.</p>
        </div>
      </div>
    </section>
  `);
  const stuck = await page.evaluate(async ({ revealSource }) => {
    const reveal = eval(`(${revealSource})`);
    const result = await reveal(["#stuck-target"]);
    const panel = document.querySelector("#stuck-panel");
    const trigger = document.querySelector("#stuck-trigger");
    const style = getComputedStyle(panel);
    return {
      result,
      height: panel.getBoundingClientRect().height,
      display: style.display,
      visibility: style.visibility,
      overflow: style.overflow,
      ariaHidden: panel.getAttribute("aria-hidden"),
      expanded: trigger.getAttribute("aria-expanded"),
      collapsedClass: trigger.classList.contains("collapsed"),
      highlighted: document.querySelector("#stuck-target").dataset.bcStyleCheckerHighlight === "true"
    };
  }, { revealSource });
  assert.equal(stuck.result, true);
  assert.ok(stuck.height > 1, "Fallback reveal must restore a usable panel height");
  assert.equal(stuck.display, "block");
  assert.equal(stuck.visibility, "visible");
  assert.equal(stuck.overflow, "visible");
  assert.equal(stuck.ariaHidden, null);
  assert.equal(stuck.expanded, "true");
  assert.equal(stuck.collapsedClass, false);
  assert.equal(stuck.highlighted, true);

  await page.setContent(`
    <ul><li id="empty-link-container"><a id="empty-link" href="/old.pdf"></a><a href="/current.pdf">Current document</a></li></ul>
  `);
  const invisible = await page.evaluate(async ({ revealSource }) => {
    const reveal = eval(`(${revealSource})`);
    const result = await reveal(["#empty-link"]);
    return {
      result,
      containerHighlighted: document.querySelector("#empty-link-container").dataset.bcStyleCheckerHighlight === "true",
      emptyHighlighted: document.querySelector("#empty-link").dataset.bcStyleCheckerHighlight === "true"
    };
  }, { revealSource });
  assert.equal(invisible.result, "container", "Zero-size findings should report that a visible container was highlighted");
  assert.equal(invisible.containerHighlighted, true);
  assert.equal(invisible.emptyHighlighted, false);

  await browser.close();
  console.log("Highlight tests passed");
})().catch(error => {
  if (!requireBrowserTests && /Executable doesn't exist/i.test(String(error && error.message))) {
    console.log("Highlight tests skipped: Playwright Chromium is not installed.");
    return;
  }
  console.error(error);
  process.exitCode = 1;
});
