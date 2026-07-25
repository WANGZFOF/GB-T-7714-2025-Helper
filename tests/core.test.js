const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../content/core.js");

test("normalizes approved pinyin name examples", () => {
  assert.equal(core.normalizePinyinName("Wu", "Sai Xuan"), "Wu Saixuan");
  assert.equal(core.normalizePinyinName("WANG", "SEN"), "Wang Sen");
  assert.equal(core.normalizePinyinName("Bai", "Hui Cong"), "Bai Huicong");
  assert.equal(core.normalizePinyinName("Zhang", "Jing Yan Tong"), "Zhang Jingyantong");
});

test("preserves separators, apostrophes, and diacritics", () => {
  assert.equal(core.normalizePinyinName("Ouyang", "Xi-An"), "Ouyang Xi-An");
  assert.equal(core.normalizePinyinName("Lü", "Shi Wen"), "Lü Shiwen");
  assert.equal(core.normalizePinyinName("Li", "Xi’An"), "Li Xi’An");
});

test("skips institutions, Han names, foreign surnames, and existing single fields", () => {
  const context = { language: "en", title: "A title" };
  assert.equal(core.analyzeCreator({ fieldMode: 1, lastName: "World Health Organization" }, context).candidate, false);
  assert.equal(core.analyzeCreator({ fieldMode: 0, lastName: "王", firstName: "森" }, context).candidate, false);
  assert.equal(core.analyzeCreator({ fieldMode: 0, lastName: "Smith", firstName: "John" }, context).candidate, false);
});

test("confirmed decisions are reusable but remain preview candidates", () => {
  const result = core.analyzeCreator(
    { fieldMode: 0, lastName: "Wu", firstName: "Sai Xuan" },
    {},
    "Wu Saixuan"
  );
  assert.equal(result.candidate, true);
  assert.equal(result.confidence, "confirmed");
  assert.equal(result.defaultSelected, true);
  assert.equal(result.target, "Wu Saixuan");
});

test("normalizes DOI prefixes", () => {
  assert.equal(core.normalizeDOI("doi: 10.1000/ABC.1"), "10.1000/ABC.1");
  assert.equal(core.normalizeDOI("https://doi.org/10.1000/abc"), "10.1000/abc");
  assert.equal(core.normalizeDOI("http://dx.doi.org/10.1000/abc"), "10.1000/abc");
});

test("replaces all conflicting Medium lines and preserves unrelated Extra text", () => {
  const original = "Original Date: 2025-01-01\r\nMedium: Print\r\nCustom: A\r\n";
  const added = core.setMediumOL(original, true);
  assert.equal(
    added,
    "Medium: OL\r\nOriginal Date: 2025-01-01\r\nCustom: A\r\n"
  );
  assert.equal(core.hasMediumOL(added), true);
  assert.equal(
    core.setMediumOL(added, false),
    "Original Date: 2025-01-01\r\nCustom: A\r\n"
  );
  assert.equal(core.setMediumOL(original, false), original);
});

test("optional full Extra cleanup leaves only the authoritative OL marker", () => {
  assert.equal(core.setMediumOL("Custom: A\nMedium: Print", true, true), "Medium: OL");
  assert.equal(core.setMediumOL("Custom: A\nMedium: OL", false, true), "");
});

test("detects exactly which snapshot fields changed", () => {
  const before = { creators: [{ lastName: "Wu" }], extra: "A", DOI: "10/a", url: "" };
  const after = { creators: [{ lastName: "Wu Saixuan" }], extra: "A", DOI: "10/a", url: "x" };
  assert.deepEqual(core.changedSnapshotFields(before, after), ["creators", "url"]);
});

test("DOI alone does not make an OL candidate", () => {
  const result = core.analyzeOnlineResource({
    itemType: "journalArticle",
    extra: "",
    DOI: "10.1000/example",
    url: "",
    accessDate: ""
  });
  assert.equal(result.candidate, false);
});

test("URL, access date, electronic type, or explicit marker makes a candidate", () => {
  assert.equal(core.analyzeOnlineResource({ url: "https://example.com" }).candidate, true);
  assert.equal(core.analyzeOnlineResource({ accessDate: "2026-07-25" }).candidate, true);
  assert.equal(core.analyzeOnlineResource({ itemType: "dataset" }).candidate, true);
  assert.equal(core.analyzeOnlineResource({ extra: "Medium: OL" }).candidate, true);
});

test("explicit OL requires DOI or URL for application", () => {
  const result = core.analyzeOnlineResource({ extra: "Medium: OL" });
  assert.equal(result.explicit, true);
  assert.equal(result.hasAccessPath, false);
});
