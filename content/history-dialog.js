var GBT2025History = {
  args: null,
  current: null,

  init() {
    this.args = window.arguments[0].wrappedJSObject;
    window.addEventListener("unload", () => this.args.onClosed?.(), { once: true });
    this.refresh(this.args.batchID || "");
  },

  service() {
    return window.opener.Zotero.GBT2025Helper;
  },

  label(entry) {
    const time = entry.committedAt || entry.createdAt || "";
    const state = entry.status === "committed" ? "已完成" :
      entry.status === "pending" ? "待核对" : entry.status;
    const undone = entry.undoState === "fully-undone" ? " · 已全部撤销" :
      entry.undoState === "partly-undone" ? " · 已部分撤销" : "";
    return `${time.replace("T", " ").slice(0, 19)} · ${entry.itemCount} 个条目 · ${state}${undone}`;
  },

  async refresh(preferred = "") {
    const select = document.getElementById("gbt-history-batches");
    const entries = this.service().services.storage.listBatches();
    select.replaceChildren();
    for (const entry of entries) {
      const option = document.createElementNS("http://www.w3.org/1999/xhtml", "option");
      option.value = entry.batchID;
      option.textContent = this.label(entry);
      option.disabled = entry.status !== "committed";
      select.append(option);
    }
    const target = preferred || select.querySelector("option:not([disabled])")?.value || "";
    if (target) select.value = target;
    await this.loadSelected();
  },

  async selectBatch(batchID) {
    if (!batchID) return;
    const select = document.getElementById("gbt-history-batches");
    if (!Array.from(select.options).some(option => option.value === batchID)) {
      await this.refresh(batchID);
    } else {
      select.value = batchID;
      await this.loadSelected();
    }
  },

  statusLabel(item) {
    if (item.status === "safe") return "可安全撤销";
    if (item.status === "conflict") return `存在后续修改：${item.conflicts.join("、")}`;
    if (item.status === "already-undone") return "已经恢复为原值";
    if (item.status === "read-only") return "只读条目";
    return "条目不存在";
  },

  async loadSelected() {
    const batchID = document.getElementById("gbt-history-batches").value;
    const panel = document.getElementById("gbt-history-items");
    const summary = document.getElementById("gbt-history-summary");
    const undo = document.getElementById("gbt-history-undo");
    panel.replaceChildren();
    document.getElementById("gbt-history-error").textContent = "";
    if (!batchID) {
      summary.textContent = "暂无可撤销的修改记录。";
      undo.disabled = true;
      this.current = null;
      return;
    }
    this.current = await this.service().services.items.prepareUndo(batchID);
    summary.textContent =
      `批次 ${batchID} · ${this.current.items.length} 个条目。冲突项默认不选择；强制恢复会覆盖对应字段的后续修改。`;

    for (const item of this.current.items) {
      const row = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
      row.className = `gbt-history-row status-${item.status}`;
      row.dataset.libraryId = item.libraryID;
      row.dataset.itemKey = item.itemKey;
      const select = document.createElementNS("http://www.w3.org/1999/xhtml", "input");
      select.type = "checkbox";
      select.className = "gbt-history-select";
      select.checked = item.selected;
      select.disabled = ["missing", "read-only", "already-undone"].includes(item.status);
      const title = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
      title.className = "gbt-history-title";
      title.textContent = item.title;
      const meta = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
      meta.className = "gbt-history-meta";
      meta.textContent = `${this.statusLabel(item)} · 字段：${(item.changedFields || []).join("、")}`;
      const forceLabel = document.createElementNS("http://www.w3.org/1999/xhtml", "label");
      forceLabel.className = "gbt-history-force";
      const force = document.createElementNS("http://www.w3.org/1999/xhtml", "input");
      force.type = "checkbox";
      force.className = "gbt-history-force-check";
      force.disabled = item.status !== "conflict";
      force.addEventListener("change", () => {
        if (force.checked) select.checked = true;
      });
      forceLabel.append(force, document.createTextNode(" 强制恢复"));
      row.append(select, title, meta, forceLabel);
      panel.append(row);
    }
    undo.disabled = !this.current.items.some(item =>
      item.status === "safe" || item.status === "conflict"
    );
  },

  collect() {
    return {
      batchID: this.current.batchID,
      items: this.current.items.map(item => {
        const row = document.querySelector(
          `.gbt-history-row[data-library-id="${item.libraryID}"][data-item-key="${item.itemKey}"]`
        );
        return {
          ...item,
          selected: !!row?.querySelector(".gbt-history-select")?.checked,
          force: !!row?.querySelector(".gbt-history-force-check")?.checked
        };
      })
    };
  },

  async undoSelected() {
    const error = document.getElementById("gbt-history-error");
    error.textContent = "";
    const payload = this.collect();
    const forced = payload.items.filter(item => item.selected && item.force).length;
    if (forced && !window.confirm(
      `将强制恢复 ${forced} 个存在后续修改的条目，可能覆盖人工编辑。是否继续？`
    )) return;
    const button = document.getElementById("gbt-history-undo");
    button.disabled = true;
    try {
      const result = await this.service().services.items.undo(payload);
      this.args.onUndone?.(result);
      await this.refresh(payload.batchID);
    } catch (cause) {
      error.textContent = cause.message || String(cause);
    } finally {
      button.disabled = !this.current?.items?.some(item =>
        item.status === "safe" || item.status === "conflict"
      );
    }
  },

  async exportSelected() {
    const batchID = document.getElementById("gbt-history-batches").value;
    if (!batchID) return;
    await this.service().services.ui.exportHistory(batchID, window);
  }
};
