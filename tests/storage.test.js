const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gbt-helper-storage-"));
const servicePath = require.resolve("../content/storage-service.js");

global.PathUtils = {
  join: path.join,
  profileDir: tempRoot
};
global.IOUtils = {
  makeDirectory: (target) => fsp.mkdir(target, { recursive: true }),
  exists: async target => {
    try {
      await fsp.access(target);
      return true;
    } catch (_) {
      return false;
    }
  },
  readUTF8: target => fsp.readFile(target, "utf8"),
  writeUTF8: async (target, text, options = {}) => {
    if (options.tmpPath) {
      await fsp.rm(options.tmpPath, { force: true });
      await fsp.writeFile(options.tmpPath, text, "utf8");
      await fsp.rename(options.tmpPath, target);
    } else {
      await fsp.writeFile(target, text, "utf8");
    }
  },
  getChildren: async target =>
    (await fsp.readdir(target)).map(name => path.join(target, name)),
  stat: target => fsp.stat(target),
  remove: target => fsp.rm(target, { force: true })
};
global.Zotero = {
  DataDirectory: { dir: tempRoot },
  GBT2025Helper: {
    config: { addonVersion: "0.3.0" },
    services: {},
    warn() {}
  }
};

function loadStorage() {
  delete require.cache[servicePath];
  require(servicePath);
  return Zotero.GBT2025Helper.services.storage;
}

test("persists batches, exports snapshots, and rebuilds a corrupt index", async () => {
  let storage = loadStorage();
  await storage.init();
  await storage.rememberDecisions([{ key: "wu\u0000sai xuan", target: "Wu Saixuan" }]);
  assert.equal(storage.getDecision("wu\u0000sai xuan"), "Wu Saixuan");

  const pending = await storage.beginBatch({
    source: "test",
    items: [{
      libraryID: 1,
      itemKey: "ABCDEFGH",
      itemID: 1,
      title: "Temporary",
      changedFields: ["creators"],
      before: { creators: [{ lastName: "Wu", firstName: "Sai Xuan" }], extra: "", DOI: "", url: "" },
      after: { creators: [{ lastName: "Wu Saixuan", firstName: "" }], extra: "", DOI: "", url: "" }
    }]
  });
  assert.equal(pending.status, "pending");
  await storage.commitBatch(pending.batchID);
  assert.equal(storage.listBatches()[0].status, "committed");

  const exported = await storage.exportSnapshot();
  assert.equal(exported.batches.length, 1);
  assert.equal(exported.batches[0].items[0].before.creators[0].firstName, "Sai Xuan");

  await fsp.writeFile(storage.historyPath, "{broken", "utf8");
  Zotero.GBT2025Helper.services = {};
  storage = loadStorage();
  await storage.init();
  assert.equal(storage.listBatches().length, 1);
  assert.equal(storage.listBatches()[0].batchID, pending.batchID);

  await storage.recordUndo(pending.batchID, {
    restored: [{ title: "Temporary", fields: ["creators"] }],
    skipped: [],
    forced: [],
    remaining: 0,
    complete: true
  });
  assert.equal(storage.listBatches()[0].undoState, "fully-undone");

  const stats = await storage.getHistoryStats();
  assert.equal(stats.batches, 1);
  assert.ok(stats.bytes > 0);
  await storage.clearHistory();
  assert.equal(storage.listBatches().length, 0);
});

test.after(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});
