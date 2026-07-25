var GBT2025Batch = {
  args: null,

  init() {
    this.args = window.arguments[0].wrappedJSObject;
    document.getElementById("gbt-selection-summary").textContent =
      `当前范围：已选择 ${this.args.selectedCount || 0} 个条目。`;
    this.renderNames();
    this.renderOnline();
    const skipped = this.args.scan.skipped || [];
    document.getElementById("gbt-skipped").textContent = skipped.length
      ? `已跳过 ${skipped.length} 个只读或无编辑权限条目。`
      : "";
    this.resizeLayout();
    window.requestAnimationFrame(() => this.resizeLayout());
    window.addEventListener("resize", () => this.resizeLayout());
    window.addEventListener("unload", () => this.args.onClosed?.(), { once: true });
  },

  resizeLayout() {
    const dialog = document.querySelector(".gbt-dialog");
    const deck = document.getElementById("gbt-view-deck");
    const footer = document.querySelector(".gbt-footer");
    if (!dialog || !deck || !footer) return;

    const windowHeight = Math.max(320, window.innerHeight || 720);
    const deckTop = deck.getBoundingClientRect().top;
    const footerHeight = footer.getBoundingClientRect().height || 60;
    const deckHeight = Math.max(
      150,
      Math.floor(windowHeight - deckTop - footerHeight - 36)
    );
    const setHeight = (element, height) => {
      element.style.setProperty("height", `${height}px`, "important");
      element.style.setProperty("max-height", `${height}px`, "important");
      element.style.setProperty("min-height", "0px", "important");
    };

    setHeight(dialog, windowHeight);
    setHeight(deck, deckHeight);
    deck.style.setProperty("flex", `0 0 ${deckHeight}px`, "important");
    deck.setAttribute("height", String(deckHeight));

    for (const view of document.querySelectorAll(".gbt-tab-view")) {
      setHeight(view, deckHeight);
      const toolbar = view.querySelector(".gbt-toolbar");
      const listHead = view.querySelector(".gbt-list-head");
      const scrollbox = view.querySelector(".gbt-scrollbox");
      const body = view.querySelector(".gbt-scroll-body");
      const scrollHeight = Math.max(
        100,
        Math.floor(
          deckHeight -
          (toolbar?.getBoundingClientRect().height || 40) -
          (listHead?.getBoundingClientRect().height || 34)
        )
      );
      setHeight(scrollbox, scrollHeight);
      scrollbox.style.setProperty("overflow", "auto", "important");
      scrollbox.setAttribute("height", String(scrollHeight));
      setHeight(body, scrollHeight);
      body.style.setProperty("overflow", "auto", "important");
    }
  },

  showTab(name) {
    const online = name === "online";
    document.getElementById("gbt-view-deck").selectedIndex = online ? 1 : 0;
    document.getElementById("gbt-name-tab").classList.toggle("is-active", !online);
    document.getElementById("gbt-online-tab").classList.toggle("is-active", online);
    document.getElementById("gbt-name-tab").setAttribute("aria-selected", String(!online));
    document.getElementById("gbt-online-tab").setAttribute("aria-selected", String(online));
  },

  el(name, attrs = {}, text = "") {
    const node = document.createElementNS("http://www.w3.org/1999/xhtml", name);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "class") node.className = value;
      else if (key === "checked") node.checked = !!value;
      else if (key === "open") node.open = !!value;
      else node.setAttribute(key, value);
    }
    if (text) node.textContent = text;
    return node;
  },

  reasonLabel(reason) {
    const labels = {
      confirmed: "已确认缓存",
      "compound-surname": "常见复姓",
      "common-surname": "常见中国姓氏",
      "ambiguous-surname": "姓氏有歧义",
      "given-tokens-1": "单音节名",
      "given-tokens-2": "双音节名",
      "given-tokens-3": "三音节名",
      "zh-language": "条目语言为中文",
      "cjk-context": "中文标题环境",
      "medium-ol": "已有 Medium: OL",
      url: "已有网址",
      accessed: "已有访问日期",
      "electronic-type": "电子型条目"
    };
    return labels[reason] || reason;
  },

  groupedNames() {
    const groups = new Map();
    (this.args.scan.names || []).forEach((row, index) => {
      const key = `${row.libraryID}/${row.itemKey}`;
      if (!groups.has(key)) groups.set(key, { title: row.itemTitle, rows: [] });
      groups.get(key).rows.push({ ...row, index });
    });
    return Array.from(groups.values());
  },

  renderNames() {
    const panel = document.getElementById("gbt-name-panel");
    const groups = this.groupedNames();
    if (!groups.length) {
      panel.append(this.el("p", { class: "gbt-empty" }, "未发现拼音姓名候选。"));
      return;
    }

    for (const group of groups) {
      const details = this.el("details", { class: "gbt-item-card" });
      const summary = this.el("summary", { class: "gbt-item-summary" });
      const itemCheck = this.el("input", {
        type: "checkbox",
        class: "gbt-item-name-check",
        checked: group.rows.every(row => row.selected)
      });
      itemCheck.addEventListener("click", event => event.stopPropagation());
      itemCheck.addEventListener("change", () => {
        details.querySelectorAll(".gbt-name-check").forEach(input => {
          input.checked = itemCheck.checked;
        });
        this.updateCounts();
      });
      summary.append(
        itemCheck,
        this.el("span", { class: "gbt-item-title" }, group.title),
        this.el("span", { class: "gbt-badge" }, `${group.rows.length} 名候选`)
      );
      const creators = this.el("div", { class: "gbt-creator-list" });

      for (const data of group.rows) {
        const row = this.el("div", { class: "gbt-creator-row" });
        row.dataset.index = data.index;
        const checkbox = this.el("input", {
          type: "checkbox",
          class: "gbt-name-check",
          checked: data.selected
        });
        checkbox.addEventListener("change", () => {
          const checks = Array.from(details.querySelectorAll(".gbt-name-check"));
          itemCheck.checked = checks.every(input => input.checked);
          itemCheck.indeterminate = !itemCheck.checked && checks.some(input => input.checked);
          this.updateCounts();
        });
        const target = this.el("input", {
          type: "text",
          class: "gbt-name-target",
          value: data.target
        });
        target.value = data.target;
        const reason = `${data.confidence} · ${(data.reasons || [])
          .map(value => this.reasonLabel(value)).join("、")}`;
        row.append(
          checkbox,
          this.el("span", { class: "gbt-original-name" }, data.original),
          this.el("span", { class: "gbt-arrow" }, "→"),
          target,
          this.el("span", { class: "gbt-role" }, data.role || "责任者"),
          this.el("span", { class: "gbt-reason" }, reason)
        );
        creators.append(row);
      }
      details.append(summary, creators);
      panel.append(details);
    }
    this.updateCounts();
  },

  renderOnline() {
    const panel = document.getElementById("gbt-online-panel");
    const rows = this.args.scan.online || [];
    if (!rows.length) {
      panel.append(this.el("p", { class: "gbt-empty" }, "未发现电子资源候选。"));
      return;
    }
    rows.forEach((data, index) => {
      const card = this.el("article", { class: "gbt-online-card" });
      card.dataset.index = index;
      const checkbox = this.el("input", {
        type: "checkbox",
        class: "gbt-online-check",
        checked: data.desiredOnline
      });
      checkbox.addEventListener("change", () => this.updateCounts());

      const controls = this.el("div", { class: "gbt-online-controls" });
      const fields = this.el("div", { class: "gbt-online-fields" });
      const doi = this.el("input", {
        type: "text",
        class: "gbt-online-doi",
        value: data.normalizedDOI,
        placeholder: "10.xxxx/xxxxx"
      });
      doi.value = data.normalizedDOI;
      const url = this.el("input", {
        type: "url",
        class: "gbt-online-url",
        value: data.url,
        placeholder: "https://…"
      });
      url.value = data.url;
      fields.append(
        this.el("label", {}, "DOI"),
        doi,
        this.el("label", {}, "网址"),
        url
      );

      const options = this.el("div", { class: "gbt-online-options" });
      const clearExtra = this.el("input", {
        type: "checkbox",
        class: "gbt-clear-extra",
        checked: false
      });
      clearExtra.disabled = !data.desiredOnline;
      checkbox.addEventListener("change", () => {
        if (!checkbox.checked) clearExtra.checked = false;
        clearExtra.disabled = !checkbox.checked;
      });
      const clearLabel = this.el("label", { class: "gbt-danger-option" });
      clearLabel.append(clearExtra, document.createTextNode(" 清空整个 Extra 后写入 OL"));
      const reason = `${data.accessDate || "无访问日期"} · ${(data.reasons || [])
        .map(value => this.reasonLabel(value)).join("、")}`;
      options.append(clearLabel, this.el("span", { class: "gbt-reason" }, reason));
      controls.append(fields, options);
      card.append(
        checkbox,
        this.el("strong", { class: "gbt-online-item-title" }, data.itemTitle),
        this.el("span", { class: "gbt-badge" }, data.itemType || "条目"),
        controls
      );
      panel.append(card);
    });
    this.updateCounts();
  },

  updateCounts() {
    const nameChecks = Array.from(document.querySelectorAll(".gbt-name-check"));
    const onlineChecks = Array.from(document.querySelectorAll(".gbt-online-check"));
    document.getElementById("gbt-name-count").textContent =
      `已选择 ${nameChecks.filter(input => input.checked).length}/${nameChecks.length} 个姓名`;
    document.getElementById("gbt-online-count").textContent =
      `已选择 ${onlineChecks.filter(input => input.checked).length}/${onlineChecks.length} 个 OL 条目`;
  },

  setAllNames(value) {
    document.querySelectorAll(".gbt-name-check, .gbt-item-name-check").forEach(input => {
      input.checked = value;
      input.indeterminate = false;
    });
    this.updateCounts();
  },

  setAllExpanded(value) {
    document.querySelectorAll(".gbt-item-card").forEach(details => {
      details.open = value;
    });
  },

  setAllOnline(value) {
    document.querySelectorAll(".gbt-online-card").forEach(card => {
      const input = card.querySelector(".gbt-online-check");
      const clear = card.querySelector(".gbt-clear-extra");
      input.checked = value;
      if (!value) clear.checked = false;
      clear.disabled = !value;
    });
    this.updateCounts();
  },

  setAllClearExtra(value) {
    document.querySelectorAll(".gbt-online-card").forEach(card => {
      const online = card.querySelector(".gbt-online-check");
      const clear = card.querySelector(".gbt-clear-extra");
      clear.checked = value && online.checked;
    });
  },

  collect() {
    const names = (this.args.scan.names || []).map((row, index) => {
      const container = document.querySelector(
        `#gbt-name-panel .gbt-creator-row[data-index="${index}"]`
      );
      if (!container) return row;
      return {
        ...row,
        selected: container.querySelector(".gbt-name-check").checked,
        target: container.querySelector(".gbt-name-target").value.trim()
      };
    });
    const online = (this.args.scan.online || []).map((row, index) => {
      const card = document.querySelector(
        `#gbt-online-panel .gbt-online-card[data-index="${index}"]`
      );
      if (!card) return row;
      return {
        ...row,
        desiredOnline: card.querySelector(".gbt-online-check").checked,
        DOI: card.querySelector(".gbt-online-doi").value.trim(),
        url: card.querySelector(".gbt-online-url").value.trim(),
        clearExtra: card.querySelector(".gbt-online-check").checked &&
          card.querySelector(".gbt-clear-extra").checked
      };
    });
    return { names, online, source: this.args.source };
  },

  async apply() {
    const button = document.getElementById("gbt-apply");
    const errorBox = document.getElementById("gbt-error");
    errorBox.textContent = "";
    const payload = this.collect();
    const emptyName = payload.names.find(row => row.selected && !row.target);
    if (emptyName) {
      errorBox.textContent = `“${emptyName.itemTitle}”的目标姓名不能为空。`;
      return;
    }
    const clearCount = payload.online.filter(row => row.clearExtra).length;
    if (clearCount && !window.confirm(
      `将清空 ${clearCount} 个条目的整个 Extra 字段，并仅写入 Medium: OL。是否继续？`
    )) {
      return;
    }
    button.disabled = true;
    try {
      const result = await window.opener.Zotero.GBT2025Helper.services.items.apply(payload);
      this.args.onApplied(result);
      window.close();
    } catch (error) {
      errorBox.textContent = error.message || String(error);
      button.disabled = false;
    }
  }
};
