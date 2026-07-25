const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const required = [
  "manifest.json",
  "bootstrap.js",
  "LICENSE",
  "README.md",
  "README.en.md",
  "SERVICES.md",
  "PRIVACY.md",
  "updates.json",
  "scripts/build_xpi.py",
  "content/namespace.js",
  "content/core.js",
  "content/storage-service.js",
  "content/item-service.js",
  "content/ui-service.js",
  "content/batch-dialog.xhtml",
  "content/batch-dialog.js",
  "content/dialog.css",
  "content/history-dialog.xhtml",
  "content/history-dialog.js",
  "content/history-dialog.css",
  "content/preferences.xhtml",
  "content/preferences-ui.js",
  "content/preferences.css",
  "content/assets/wechat-contact.png",
  "docs/assets/wechat-support.png",
  "docs/assets/alipay-support.jpg",
  "styles/gb-t-7714-2025-numeric-bilingual.csl"
];

const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`Missing required files:\n${missing.join("\n")}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
if (manifest.manifest_version !== 2) throw new Error("Zotero bootstrap manifest must use manifest_version 2");
if (manifest.version !== "0.3.1") throw new Error("Expected release version 0.3.1");
if (manifest.applications?.zotero?.id !== "gbt7714-2025-helper@wangzfof.github.io") {
  throw new Error("Unexpected public add-on ID");
}

for (const file of required.filter(file => file.endsWith(".js"))) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  try {
    new Function(source);
  } catch (error) {
    throw new Error(`${file}: ${error.message}`);
  }
}

const ui = fs.readFileSync(path.join(root, "content/ui-service.js"), "utf8");
for (const forbidden of [
  "ItemPaneManager.registerSection(",
  "MenuManager.registerMenu(",
  'target: "main/menubar/tools"',
  "关于本插件"
]) {
  if (ui.includes(forbidden)) throw new Error(`Forbidden UI remains: ${forbidden}`);
}
for (const token of [
  'getElementById("zotero-itemmenu")',
  'createXULElement("menu")',
  "规范化…",
  "撤销上一次修改…",
  "修改记录与撤销…",
  "PreferencePanes.register"
]) {
  if (!ui.includes(token)) throw new Error(`Required UI missing: ${token}`);
}

const csl = fs.readFileSync(
  path.join(root, "styles/gb-t-7714-2025-numeric-bilingual.csl"),
  "utf8"
);
for (const token of [
  '<id>http://www.zotero.org/styles/gbt-7714-2025-helper-numeric-bilingual</id>',
  '<if variable="medium">',
  'prefix="https://doi.org/"',
  '<layout locale="en">'
]) {
  if (!csl.includes(token)) throw new Error(`CSL missing required token: ${token}`);
}

for (const xhtml of [
  "content/batch-dialog.xhtml",
  "content/history-dialog.xhtml",
  "content/preferences.xhtml"
]) {
  const source = fs.readFileSync(path.join(root, xhtml), "utf8");
  if (!source.includes("Zotero") && xhtml === "content/preferences.xhtml") {
    throw new Error(`${xhtml}: expected contact wording`);
  }
}

console.log(`Project check passed (${required.length} required files).`);
