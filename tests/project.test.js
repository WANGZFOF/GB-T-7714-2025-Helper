const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("manifest targets Zotero 9 with the stable public identity", () => {
  const manifest = JSON.parse(read("manifest.json"));
  assert.equal(manifest.version, "0.3.1");
  assert.equal(
    manifest.applications.zotero.id,
    "gbt7714-2025-helper@wangzfof.github.io"
  );
  assert.equal(manifest.applications.zotero.strict_min_version, "9.0.0");
  assert.equal(manifest.applications.zotero.strict_max_version, "9.0.*");
  assert.equal(manifest.author, "Zotero金牌讲师");
  assert.match(manifest.homepage_url, /WANGZFOF\/GB-T-7714-2025-Helper/);
});

test("update manifest publishes the signed 0.3.1 release asset", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const updateManifest = JSON.parse(read("updates.json"));
  const updates = updateManifest.addons[manifest.applications.zotero.id].updates;
  assert.equal(updates.length, 1);
  assert.equal(updates[0].version, manifest.version);
  assert.equal(
    updates[0].update_link,
    "https://github.com/WANGZFOF/GB-T-7714-2025-Helper/releases/download/v0.3.1/gbt7714-2025-helper-0.3.1.xpi"
  );
  assert.equal(
    updates[0].update_hash,
    "sha256:bc250b34600eb6b66bef760353c86f7db80947a0468994c663dfdfb582bc38aa"
  );
  assert.deepEqual(updates[0].applications.zotero, {
    strict_min_version: "9.0.0",
    strict_max_version: "9.0.*"
  });
});

test("CSL uses Medium as the only OL gate and prefers DOI", () => {
  const csl = read("styles/gb-t-7714-2025-numeric-bilingual.csl");
  const mediumMacro = csl.match(/<macro name="entry-medium-id">([\s\S]*?)<\/macro>/)?.[1] || "";
  const accessMacro = csl.match(/<macro name="access">([\s\S]*?)<\/macro>/)?.[1] || "";
  assert.match(mediumMacro, /variable="medium"/);
  assert.doesNotMatch(mediumMacro, /variable="URL DOI"|value="OL"/);
  assert.match(accessMacro, /<if variable="medium">/);
  assert.ok(accessMacro.indexOf('variable="DOI"') < accessMacro.indexOf('variable="URL"'));
  assert.match(accessMacro, /prefix="https:\/\/doi\.org\/"/);
  assert.match(accessMacro, /variable="accessed"/);
});

test("CSL is independently identified and Zotero-specific bilingual CSL-M", () => {
  const csl = read("styles/gb-t-7714-2025-numeric-bilingual.csl");
  assert.match(csl, /gbt-7714-2025-helper-numeric-bilingual/);
  assert.match(csl, /Zotero 专用/);
  assert.equal((csl.match(/<layout(?:\s|>)/g) || []).length, 3);
  assert.match(csl, /<layout locale="en">/);
});

test("plugin uses official creator APIs, transactions, and two-phase history", () => {
  const items = read("content/item-service.js");
  const storage = read("content/storage-service.js");
  assert.match(items, /getCreators\(\)/);
  assert.match(items, /setCreators\(/);
  assert.match(items, /Zotero\.DB\.executeTransaction/);
  assert.match(items, /fieldMode:\s*1/);
  assert.match(items, /beginBatch/);
  assert.match(items, /commitBatch/);
  assert.match(items, /prepareUndo/);
  assert.match(items, /async undo/);
  assert.match(storage, /historyDirectory/);
  assert.match(storage, /status:\s*"pending"/);
  assert.match(storage, /recordUndo/);
  assert.match(storage, /rebuildHistoryIndex/);
});

test("context menu exposes operations only and keeps singleton windows", () => {
  const ui = read("content/ui-service.js");
  assert.match(ui, /getElementById\("zotero-itemmenu"\)/);
  assert.match(ui, /createXULElement\("menu"\)/);
  assert.match(ui, /GB\/T 7714—2025/);
  assert.match(ui, /规范化…/);
  assert.match(ui, /撤销上一次修改…/);
  assert.match(ui, /修改记录与撤销…/);
  assert.doesNotMatch(ui, /关于本插件/);
  assert.match(ui, /previewWindow/);
  assert.match(ui, /historyWindow/);
  assert.match(ui, /getAttention/);
  assert.doesNotMatch(ui, /ItemPaneManager\.registerSection|MenuManager\.registerMenu|main\/menubar\/tools/);
});

test("batch dialog groups creators and constrains scrolling", () => {
  const dialog = read("content/batch-dialog.js");
  const xhtml = read("content/batch-dialog.xhtml");
  const css = read("content/dialog.css");
  assert.match(dialog, /groupedNames/);
  assert.match(dialog, /setAllNames/);
  assert.match(dialog, /setAllExpanded/);
  assert.match(dialog, /setAllClearExtra/);
  assert.match(xhtml, /gbt-scroll-body/);
  assert.match(css, /min-height:\s*0/);
  assert.match(css, /overflow:\s*auto/);
  assert.match(css, /gbt-footer/);
});

test("settings page is functional and contains the approved contact wording", () => {
  const ui = read("content/ui-service.js");
  const prefs = read("content/preferences.xhtml");
  const prefsJS = read("content/preferences-ui.js");
  assert.match(ui, /PreferencePanes\.register/);
  assert.match(prefs, /本地撤销数据/);
  assert.match(
    prefs,
    /若使用Zotero过程中遇到问题，可以联系作者远程协助，可提供全流程Zotero专业服务。/
  );
  assert.match(prefs, /ZoteroGL/);
  assert.match(prefsJS, /copyTextToClipboard\("ZoteroGL"\)/);
  assert.match(prefsJS, /clearHistory/);
  assert.doesNotMatch(prefs, /支付宝|微信赞助|价格/);
});

test("GitHub docs contain services without prices and separate contact from support", () => {
  const readme = read("README.md");
  const services = read("SERVICES.md");
  assert.match(readme, /欢迎点亮 Star/);
  assert.match(readme, /ZoteroGL/);
  assert.match(readme, /自愿请作者喝杯咖啡/);
  assert.match(services, /不公开具体价格/);
  assert.match(services, /微信自愿赞助二维码/);
  assert.doesNotMatch(readme + services, /15\.99|19\.99|29\.99|价格表1/);
  assert.equal(fs.existsSync(path.join(root, "content/assets/wechat-contact.png")), true);
  assert.equal(fs.existsSync(path.join(root, "docs/assets/wechat-support.png")), true);
  assert.equal(fs.existsSync(path.join(root, "docs/assets/alipay-support.jpg")), true);
});

test("project license is AGPL-3.0", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.license, "AGPL-3.0-only");
  assert.match(read("LICENSE"), /GNU AFFERO GENERAL PUBLIC LICENSE/);
});
