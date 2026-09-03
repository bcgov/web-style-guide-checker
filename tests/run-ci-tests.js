"use strict";

const { spawnSync } = require("node:child_process");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCommand, ["test"], {
  stdio: "inherit",
  env: { ...process.env, REQUIRE_BROWSER_TESTS: "1" }
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(Number.isInteger(result.status) ? result.status : 1);
