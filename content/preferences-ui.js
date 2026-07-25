var GBT2025Preferences = {
  service() {
    return Zotero.GBT2025Helper;
  },

  formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  },

  async refresh() {
    const stats = await this.service().services.storage.getHistoryStats();
    document.getElementById("gbt-pref-history-count").textContent = `${stats.batches} 个批次`;
    document.getElementById("gbt-pref-history-size").textContent = this.formatBytes(stats.bytes);
    document.getElementById("gbt-pref-history-path").textContent = stats.historyDirectory;
    return stats;
  },

  setStatus(message) {
    document.getElementById("gbt-pref-status").textContent = message;
  },

  async init() {
    const root = document.getElementById("gbt2025helper-prefpane-root");
    if (!root || root.dataset.ready) return;
    root.dataset.ready = "true";
    await this.refresh();

    document.getElementById("gbt-pref-open-folder").addEventListener("click", async () => {
      const stats = await this.refresh();
      await IOUtils.makeDirectory(stats.historyDirectory, {
        createAncestors: true,
        ignoreExisting: true
      });
      Zotero.File.reveal(stats.historyDirectory);
    });
    document.getElementById("gbt-pref-export-history").addEventListener("click", async () => {
      const path = await this.service().services.ui.exportHistory("", window);
      if (path) this.setStatus(`已导出：${path}`);
    });
    document.getElementById("gbt-pref-clear-history").addEventListener("click", async () => {
      const stats = await this.refresh();
      if (!stats.batches) {
        this.setStatus("当前没有历史记录。");
        return;
      }
      const confirmed = Services.prompt.confirm(
        window,
        "清理历史记录",
        `将永久删除 ${stats.batches} 个修改批次（${this.formatBytes(stats.bytes)}）。此操作不能撤销，是否继续？`
      );
      if (!confirmed) return;
      await this.service().services.storage.clearHistory();
      await this.refresh();
      this.setStatus("历史记录已清理。姓名判断缓存未删除。");
    });
    document.getElementById("gbt-pref-copy-wechat").addEventListener("click", () => {
      Zotero.Utilities.Internal.copyTextToClipboard("ZoteroGL");
      this.setStatus("微信号 ZoteroGL 已复制。");
    });
    document.getElementById("gbt-pref-open-github").addEventListener("click", () => {
      Zotero.launchURL(this.service().config.homepageURL);
    });
  },

  boot() {
    const tryInit = () => this.init().catch(error => Zotero.GBT2025Helper.warn(error));
    tryInit();
    if (!document.getElementById("gbt2025helper-prefpane-root")) {
      this.observer = new MutationObserver(() => {
        if (document.getElementById("gbt2025helper-prefpane-root")) {
          this.observer.disconnect();
          tryInit();
        }
      });
      this.observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }
};

GBT2025Preferences.boot();
