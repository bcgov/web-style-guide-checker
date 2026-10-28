"use strict";

const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const begin = "  // BEGIN GENERATED INDIGENOUS NAME CATALOGUE";
const end = "  // END GENERATED INDIGENOUS NAME CATALOGUE";
const recordFields = new Set(["id", "workbookRow", "lookupLabel", "verificationBasis", "evidenceUrls", "forms", "holdReason"]);
const formFields = new Set(["text", "sourceColumn", "recognize", "role", "reason"]);
const formRoles = new Set(["observed-website-name", "other-observed-form", "historical-or-administrative-name", "acronym", "context-dependent-short-form"]);

function generatedNames(catalogue) {
  if (catalogue.schemaVersion !== 1 || !Array.isArray(catalogue.records)) throw new Error("Unsupported Indigenous-name catalogue.");
  const names = new Map();
  const ids = new Set();
  for (const record of catalogue.records) {
    if (Object.keys(record).some(key => !recordFields.has(key))) throw new Error("Only name-recognition metadata is permitted in a catalogue record.");
    if (record.holdReason !== undefined && record.holdReason !== "additional-verification-required") throw new Error("Unknown record hold reason.");
    if (!record.id || ids.has(record.id)) throw new Error("Catalogue record IDs must be unique.");
    ids.add(record.id);
    for (const form of record.forms || []) {
      if (Object.keys(form).some(key => !formFields.has(key)) || !formRoles.has(form.role)) throw new Error(`Unsupported name-form metadata in ${record.id}.`);
      if (form.reason !== undefined && !["definition-required", "context-required"].includes(form.reason)) throw new Error(`Unknown name-form hold reason in ${record.id}.`);
      if (form.recognize !== true) continue;
      if (record.verificationBasis !== "Official page read") throw new Error(`Unreviewed automatic name in ${record.id}.`);
      if (!Array.isArray(record.evidenceUrls) || !record.evidenceUrls.some(value => {
        try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; }
        catch (_) { return false; }
      })) throw new Error(`Missing naming evidence in ${record.id}.`);
      if (typeof form.text !== "string" || !form.text.trim() || form.text !== form.text.trim()
        || /[\u0000-\u001f\u007f\u2028\u2029]/u.test(form.text)) throw new Error(`Invalid literal name in ${record.id}.`);
      if (["acronym", "context-dependent-short-form"].includes(form.role)) throw new Error(`Unscoped short form in ${record.id}.`);
      const key = form.text.normalize("NFC").replace(/[‘’]/g, "'").replace(/\s+/gu, " ");
      if (!names.has(key)) names.set(key, form.text);
    }
  }
  return Array.from(names.values());
}

function generatedBlock(catalogue) {
  const names = generatedNames(catalogue);
  return `${begin}\n  // Recognition forms only. Source records and decisions live in data/indigenous-name-catalogue.json.\n  const REVIEWED_INDIGENOUS_NAMES = [\n${names.map(name => "    " + JSON.stringify(name)).join(",\n")}\n  ];\n${end}`;
}

function sync(check = false) {
  const catalogue = JSON.parse(fs.readFileSync(path.join(root, "data", "indigenous-name-catalogue.json"), "utf8"));
  const file = path.join(root, "checker-core.js");
  const source = fs.readFileSync(file, "utf8");
  const start = source.indexOf(begin);
  const stop = source.indexOf(end, start);
  if (start < 0 || stop < 0) throw new Error("Generated Indigenous-name markers are missing.");
  const updated = source.slice(0, start) + generatedBlock(catalogue) + source.slice(stop + end.length);
  if (check && updated !== source) throw new Error("The Indigenous-name snapshot is stale. Run npm run sync:indigenous-names.");
  if (!check) fs.writeFileSync(file, updated);
  return generatedNames(catalogue).length;
}

if (require.main === module) {
  try { console.log(`${sync(process.argv.includes("--check"))} reviewed Indigenous-name forms ${process.argv.includes("--check") ? "verified" : "synced"}.`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { generatedNames, generatedBlock, sync };
