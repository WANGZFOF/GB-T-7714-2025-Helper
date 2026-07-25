(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.GBT2025Core = api;
    if (root.Zotero?.GBT2025Helper) {
      root.Zotero.GBT2025Helper.core = api;
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const COMMON_SURNAMES = new Set((
    "ai an ao bai ban bao bei bi bian bian bo bu cai cao cen chai chang chao chen " +
    "cheng chi chong chou chu chuai chun cong cui dai dan dang dao deng di diao ding " +
    "dong dou du duan duanmu fan fang fei feng fu gai gan gao ge geng gong gou gu guan " +
    "guo han hao he hei heng hong hou hu hua huan huang hui huo ji jia jian jiang jiao " +
    "jie jin jing ju kang ke kong kuang kui lai lan lang lao lei leng li lian liang liao " +
    "lin ling liu long lou lu luan luo ma mai man mao mei meng mi miao min ming mo mou " +
    "mu murong na nan nang ni nie ning niu nong ou ouyang pan pang pei peng pi pian piao " +
    "pu qi qian qiang qiao qin qiu qu quan ran ren rong ruan rui sang shan shang shao " +
    "she shen sheng shi shu shui si sima situ song su sun suo tan tang tao teng tian " +
    "tong tu wan wang wei wen weng wo wu xi xia xian xiang xiao xie xin xing xiong xu " +
    "xuan xue xun yan yang yao ye yi yin ying you yu yuan yue yun zai zan zang zeng zha " +
    "zhai zhan zhang zhao zhen zheng zhi zhong zhou zhu zhuang zi zong zou zu zuo"
  ).split(/\s+/));

  const COMPOUND_SURNAMES = new Set([
    "baili", "duanmu", "dongfang", "dongguo", "gongliang", "gongsun", "helian",
    "huangfu", "linghu", "murong", "nangong", "ouyang", "shangguan", "sima",
    "situ", "taishu", "ximen", "xiahou", "zhangsun", "zhuge"
  ]);

  const AMBIGUOUS_SURNAMES = new Set([
    "an", "ban", "fan", "ho", "hu", "kim", "lee", "lim", "lin", "ma", "mo",
    "pan", "tan", "wan", "wen", "yi"
  ]);

  const ELECTRONIC_ITEM_TYPES = new Set([
    "blogPost", "computerProgram", "dataset", "forumPost", "podcast", "preprint",
    "radioBroadcast", "tvBroadcast", "videoRecording", "webpage"
  ]);

  function cleanSpaces(value) {
    return String(value || "").normalize("NFC").trim().replace(/\s+/gu, " ");
  }

  function containsCJK(value) {
    return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(
      String(value || "")
    );
  }

  function isRomanizedPart(value) {
    const text = cleanSpaces(value);
    return !!text && /^[\p{L}\p{M}'’\-‐‑‒–—.\s]+$/u.test(text);
  }

  function upperFirst(value) {
    const chars = Array.from(String(value || ""));
    if (!chars.length) return "";
    return chars[0].toLocaleUpperCase("en-US") +
      chars.slice(1).join("").toLocaleLowerCase("en-US");
  }

  function normalizeSeparatedWord(value) {
    return String(value || "")
      .split(/([\-‐‑‒–—'’])/u)
      .map(part => /^[\-‐‑‒–—'’]$/u.test(part) ? part : upperFirst(part))
      .join("");
  }

  function lowerFirst(value) {
    const chars = Array.from(String(value || ""));
    if (!chars.length) return "";
    return chars[0].toLocaleLowerCase("en-US") + chars.slice(1).join("");
  }

  function compactSurname(value) {
    return cleanSpaces(value).replace(/\s+/gu, "").replace(/[.'’\-‐‑‒–—]/gu, "").toLocaleLowerCase("en-US");
  }

  function normalizeFamilyName(value) {
    const text = cleanSpaces(value);
    const compact = compactSurname(text);
    if (COMPOUND_SURNAMES.has(compact) || text.includes(" ")) {
      return normalizeSeparatedWord(text.replace(/\s+/gu, ""));
    }
    return normalizeSeparatedWord(text);
  }

  function normalizeGivenName(value) {
    const tokens = cleanSpaces(value).split(" ").filter(Boolean);
    return tokens.map((token, index) => {
      const normalized = normalizeSeparatedWord(token);
      return index === 0 ? normalized : lowerFirst(normalized);
    }).join("");
  }

  function normalizePinyinName(lastName, firstName) {
    const family = normalizeFamilyName(lastName);
    const given = normalizeGivenName(firstName);
    return [family, given].filter(Boolean).join(" ");
  }

  function creatorDecisionKey(lastName, firstName) {
    return `${cleanSpaces(lastName).toLocaleLowerCase("en-US")}\u0000` +
      cleanSpaces(firstName).toLocaleLowerCase("en-US");
  }

  function analyzeCreator(creator, context = {}, confirmedTarget = "") {
    const firstName = cleanSpaces(creator?.firstName);
    const lastName = cleanSpaces(creator?.lastName);
    const tokenCount = firstName ? firstName.split(" ").length : 0;
    const compact = compactSurname(lastName);

    if (
      Number(creator?.fieldMode || 0) !== 0 ||
      !firstName ||
      !lastName ||
      containsCJK(firstName) ||
      containsCJK(lastName) ||
      !isRomanizedPart(firstName) ||
      !isRomanizedPart(lastName)
    ) {
      return { candidate: false };
    }

    if (confirmedTarget) {
      return {
        candidate: true,
        confidence: "confirmed",
        defaultSelected: true,
        target: confirmedTarget,
        reasons: ["confirmed"]
      };
    }

    let score = 0;
    const reasons = [];
    if (COMPOUND_SURNAMES.has(compact)) {
      score += 3;
      reasons.push("compound-surname");
    } else if (COMMON_SURNAMES.has(compact)) {
      score += 2;
      reasons.push("common-surname");
    }
    if (AMBIGUOUS_SURNAMES.has(compact)) {
      score -= 1;
      reasons.push("ambiguous-surname");
    }
    if (tokenCount >= 1 && tokenCount <= 3) {
      score += 2;
      reasons.push(`given-tokens-${tokenCount}`);
    }
    const language = String(context.language || "").toLocaleLowerCase("en-US");
    if (language === "zh" || language.startsWith("zh-")) {
      score += 1;
      reasons.push("zh-language");
    }
    if (containsCJK(context.title) || containsCJK(context.containerTitle)) {
      score += 1;
      reasons.push("cjk-context");
    }

    if (score < 3) {
      return { candidate: false };
    }
    const unusual = tokenCount > 2 || AMBIGUOUS_SURNAMES.has(compact);
    const confidence = score >= 5 && !unusual ? "high" : score >= 4 && !unusual ? "medium" : "low";
    return {
      candidate: true,
      confidence,
      defaultSelected: confidence === "high",
      target: normalizePinyinName(lastName, firstName),
      reasons
    };
  }

  function normalizeDOI(value) {
    return cleanSpaces(value)
      .replace(/^doi\s*:\s*/iu, "")
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, "")
      .replace(/\s+/gu, "");
  }

  function mediumValue(extra) {
    const match = String(extra || "").match(/^Medium\s*:\s*(.*?)\s*$/imu);
    return match ? match[1] : "";
  }

  function hasMediumOL(extra) {
    return /^Medium\s*:\s*OL\s*$/imu.test(String(extra || ""));
  }

  function setMediumOL(extra, enabled, clearAll = false) {
    const original = String(extra || "");
    const newline = original.includes("\r\n") ? "\r\n" : "\n";
    if (clearAll) {
      return enabled ? "Medium: OL" : "";
    }
    const lines = original ? original.split(/\r?\n/u) : [];
    const next = lines.filter(line => enabled
      ? !/^Medium\s*:/iu.test(line)
      : !/^Medium\s*:\s*OL\s*$/iu.test(line)
    );
    if (enabled) next.unshift("Medium: OL");
    return next.join(newline);
  }

  function analyzeOnlineResource(data) {
    const explicit = hasMediumOL(data.extra);
    const hasURL = !!cleanSpaces(data.url);
    const hasAccessed = !!cleanSpaces(data.accessDate);
    const electronicType = ELECTRONIC_ITEM_TYPES.has(String(data.itemType || ""));
    const candidate = explicit || hasURL || hasAccessed || electronicType;
    const reasons = [];
    if (explicit) reasons.push("medium-ol");
    if (hasURL) reasons.push("url");
    if (hasAccessed) reasons.push("accessed");
    if (electronicType) reasons.push("electronic-type");
    return {
      candidate,
      explicit,
      defaultSelected: explicit,
      reasons,
      hasAccessPath: !!normalizeDOI(data.DOI) || hasURL
    };
  }

  function snapshotFingerprint(snapshot) {
    return JSON.stringify({
      creators: snapshot?.creators || [],
      extra: String(snapshot?.extra || ""),
      DOI: String(snapshot?.DOI || ""),
      url: String(snapshot?.url || "")
    });
  }

  function changedSnapshotFields(before, after) {
    return ["creators", "extra", "DOI", "url"].filter(field =>
      JSON.stringify(before?.[field] ?? "") !== JSON.stringify(after?.[field] ?? "")
    );
  }

  function snapshotFieldFingerprint(value) {
    return JSON.stringify(value ?? "");
  }

  return Object.freeze({
    COMMON_SURNAMES,
    COMPOUND_SURNAMES,
    cleanSpaces,
    containsCJK,
    isRomanizedPart,
    normalizeFamilyName,
    normalizeGivenName,
    normalizePinyinName,
    creatorDecisionKey,
    analyzeCreator,
    normalizeDOI,
    mediumValue,
    hasMediumOL,
    setMediumOL,
    analyzeOnlineResource,
    snapshotFingerprint,
    changedSnapshotFields,
    snapshotFieldFingerprint
  });
});
