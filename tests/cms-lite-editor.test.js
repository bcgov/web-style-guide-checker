"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = { globalThis: null };
context.globalThis = context;
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "..", "cms-lite-editor.js"), "utf8"),
  context
);

function control({ classes = [], pressed = "", title = "" } = {}) {
  let clicks = 0;
  return {
    classList: { contains: name => classes.includes(name) },
    getAttribute: name => name === "aria-pressed" ? pressed : name === "title" ? title : "",
    click: () => { clicks += 1; },
    clicks: () => clicks
  };
}

const classActive = control({ classes: ["cke_button_on"] });
const ariaActive = control({ pressed: "true" });
const titleActive = control({ title: "Minimize" });
const inactive = control({ classes: ["cke_button_off"], pressed: "false", title: "Maximize" });
const controls = [classActive, ariaActive, titleActive, inactive];
const doc = {
  querySelectorAll: selector => {
    assert.equal(selector, ".cke_button__bcgovmaximize");
    return controls;
  }
};

assert.equal(context.BCWebStyleGuideCmsLite.minimizeMaximizedEditors(doc), 3);
assert.deepEqual(controls.map(item => item.clicks()), [1, 1, 1, 0]);
assert.equal(context.BCWebStyleGuideCmsLite.minimizeMaximizedEditors(null), 0);

console.log("CMS Lite editor tests passed.");
