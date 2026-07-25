(function () {
  const root = Zotero.GBT2025Helper = {
    config: {
      addonID,
      addonVersion,
      rootURI,
      itemMenuElementID: "gbt2025helper-item-context-menu",
      itemMenuSeparatorID: "gbt2025helper-item-context-separator",
      legacyPaneID: "gbt-7714-2025-helper-pane",
      preferencePaneID: "gbt-7714-2025-helper-preferences",
      homepageURL: "https://github.com/WANGZFOF/GB-T-7714-2025-Helper"
    },
    services: {},
    api: {},
    hooks: {},
    state: {
      initialized: false,
      windowCleanups: new Map(),
      previewWindow: null,
      historyWindow: null,
      preferencePaneID: null
    }
  };

  root.isChinese = () => String(Zotero.locale || "").toLowerCase().startsWith("zh");
  root.t = (zh, en) => root.isChinese() ? zh : en;
  root.log = message => Zotero.debug(`[GBT 2025 Helper] ${message}`);
  root.warn = error => {
    Zotero.debug(`[GBT 2025 Helper] ${error?.stack || error}`, 1);
    Zotero.logError(error);
  };
})();
