const fs = require("fs");
const path = require("path");

const source = path.join(
  __dirname,
  "..",
  "node_modules",
  "@bcgov",
  "design-tokens",
  "css-prefixed",
  "variables.css"
);

const destination = path.join(
  __dirname,
  "..",
  "vendor",
  "bcgov-design-tokens.css"
);

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.copyFileSync(source, destination);

console.log("B.C. Design System tokens synced.");