const fs = require("node:fs");
const path = require("node:path");

const [, , sourceArg, outputArg] = process.argv;
if (!sourceArg) {
  throw new Error("Usage: node scripts/derive-companion-style.js <source.csl> [output.csl]");
}

const sourcePath = path.resolve(sourceArg);
const outputPath = path.resolve(
  outputArg || path.join(__dirname, "..", "styles", "gb-t-7714-2025-numeric-bilingual.csl")
);
let csl = fs.readFileSync(sourcePath, "utf8");

function replaceOnce(pattern, replacement, description) {
  const matches = csl.match(new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`)) || [];
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${description}; found ${matches.length}`);
  }
  csl = csl.replace(pattern, replacement);
}

replaceOnce(
  /<title>[^<]*<\/title>/,
  "<title>GB/T 7714—2025（顺序编码，双语，Zotero 专用）</title>",
  "style title"
);
replaceOnce(
  /<id>[^<]*<\/id>/,
  "<id>http://www.zotero.org/styles/gbt-7714-2025-helper-numeric-bilingual</id>",
  "style ID"
);
replaceOnce(
  /<link href="[^"]+" rel="self"\/>/,
  '<link href="http://www.zotero.org/styles/gbt-7714-2025-helper-numeric-bilingual" rel="self"/>',
  "self link"
);
replaceOnce(
  /<link href="[^"]+" rel="template"\/>/,
  '<link href="https://zotero-chinese.com/styles/GB-T-7714—2025（顺序编码，双语）" rel="template"/>',
  "template link"
);
replaceOnce(
  /<author>[\s\S]*?<\/author>/,
  `<author>
      <name>Zotero金牌讲师</name>
      <email>929459880@qq.com</email>
    </author>`,
  "author block"
);
replaceOnce(
  /<summary>[^<]*<\/summary>/,
  "<summary>基于原 GB/T 7714—2025 双语样式；电子载体仅由 Medium 字段控制，DOI 优先于 URL。Zotero/citeproc-js 专用 CSL-M。</summary>",
  "summary"
);
replaceOnce(
  /<updated>[^<]*<\/updated>/,
  "<updated>2026-07-25T12:00:00+08:00</updated>",
  "updated timestamp"
);

replaceOnce(
  /  <macro name="entry-medium-id">[\s\S]*?  <\/macro>/,
  `  <macro name="entry-medium-id">
    <choose>
      <if variable="medium">
        <text variable="medium"/>
      </if>
    </choose>
  </macro>`,
  "entry-medium-id macro"
);

replaceOnce(
  /  <macro name="creation-accessed-date">[\s\S]*?  <\/macro>/,
  `  <macro name="creation-accessed-date">
    <date variable="issued" form="numeric" prefix="（" suffix="）"/>
  </macro>`,
  "creation-accessed-date macro"
);

replaceOnce(
  /  <macro name="access">[\s\S]*?  <\/macro>/,
  `  <macro name="access">
    <choose>
      <if variable="medium">
        <group delimiter=". ">
          <date variable="accessed" form="numeric" prefix="[" suffix="]"/>
          <choose>
            <if variable="DOI">
              <text variable="DOI" prefix="https://doi.org/"/>
            </if>
            <else-if variable="URL">
              <text variable="URL"/>
            </else-if>
          </choose>
        </group>
      </if>
    </choose>
  </macro>`,
  "access macro"
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, csl);
console.log(`Derived companion CSL: ${outputPath}`);
