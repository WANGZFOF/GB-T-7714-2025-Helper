(function () {
  const ns = Zotero.GBT2025Helper;

  class UIService {
    _window() {
      return Zotero.getMainWindow() || Services.wm.getMostRecentWindow("navigator:browser");
    }

    _alert(title, message, window = this._window()) {
      Services.prompt.alert(window, title, message);
    }

    _selectedItems() {
      return Zotero.getActiveZoteroPane()?.getSelectedItems?.() || [];
    }

    _regularItems(items) {
      return (items || []).filter(item => item?.isRegularItem?.());
    }

    _bringToFront(window) {
      if (!window || window.closed) return false;
      try {
        if (window.windowState === window.STATE_MINIMIZED) window.restore?.();
        window.focus();
        window.getAttention?.();
      } catch (error) {
        ns.warn(error);
      }
      return true;
    }

    async scanAndOpen(items, source, window = this._window()) {
      if (this._bringToFront(ns.state.previewWindow)) return;
      const regularItems = this._regularItems(await Promise.resolve(items));
      if (!regularItems.length) {
        this._alert(
          ns.t("国标 2025 文献助手", "GB/T 7714—2025 Helper"),
          ns.t("请先选择至少一篇文献条目。", "Select at least one bibliographic item."),
          window
        );
        return;
      }

      const scan = await ns.services.items.scan(regularItems);
      const args = {
        source,
        selectedCount: regularItems.length,
        scan,
        onClosed: () => {
          ns.state.previewWindow = null;
        },
        onApplied: result => {
          const detail = result.skipped?.length
            ? `；跳过 ${result.skipped.length} 个只读条目`
            : "";
          const pending = result.historyPending
            ? "；撤销记录将在下次启动时自动核对"
            : "";
          this._alert(
            "处理完成",
            `已更新 ${result.changed} 个条目${detail}${pending}。`,
            window
          );
        }
      };

      ns.state.previewWindow = window.openDialog(
        "chrome://gbt2025helper/content/batch-dialog.xhtml",
        "gbt2025helper-batch",
        "chrome,centerscreen,resizable,dialog=no",
        { wrappedJSObject: args }
      );
      this._bringToFront(ns.state.previewWindow);
    }

    async openHistory(batchID = "", window = this._window()) {
      if (this._bringToFront(ns.state.historyWindow)) {
        ns.state.historyWindow.GBT2025History?.selectBatch?.(batchID);
        return;
      }
      const args = {
        batchID,
        onClosed: () => {
          ns.state.historyWindow = null;
        },
        onUndone: result => {
          const pending = result.historyPending ? "；撤销审计记录将在下次打开时核对" : "";
          this._alert(
            "撤销完成",
            `已恢复 ${result.restored} 个条目；跳过 ${result.skipped.length} 个；强制恢复 ${result.forced} 个${pending}。`,
            window
          );
        }
      };
      ns.state.historyWindow = window.openDialog(
        "chrome://gbt2025helper/content/history-dialog.xhtml",
        "gbt2025helper-history",
        "chrome,centerscreen,resizable,dialog=no",
        { wrappedJSObject: args }
      );
      this._bringToFront(ns.state.historyWindow);
    }

    async openUndoLast(window = this._window()) {
      const latest = ns.services.storage.listBatches()
        .find(entry => entry.status === "committed" && entry.undoState !== "fully-undone");
      if (!latest) {
        this._alert("国标 2025 文献助手", "当前没有可以撤销的修改批次。", window);
        return;
      }
      await this.openHistory(latest.batchID, window);
    }

    async exportHistory(batchID = "", window = this._window()) {
      const nsIFilePicker = Components.interfaces.nsIFilePicker;
      const picker = Components.classes["@mozilla.org/filepicker;1"]
        .createInstance(nsIFilePicker);
      picker.init(
        window?.browsingContext || window?.docShell?.browsingContext || null,
        batchID ? "导出修改批次" : "导出全部修改记录",
        nsIFilePicker.modeSave
      );
      const date = new Date().toISOString().slice(0, 10);
      picker.defaultString = batchID
        ? `gbt7714-2025-${batchID}.json`
        : `gbt7714-2025-history-${date}.json`;
      picker.appendFilter("JSON", "*.json");
      const result = await new Promise(resolve => picker.open(resolve));
      if (result === nsIFilePicker.returnCancel || !picker.file?.path) return "";
      const payload = await ns.services.storage.exportSnapshot(batchID);
      await IOUtils.writeUTF8(
        picker.file.path,
        JSON.stringify(payload, null, 2) + "\n",
        { tmpPath: `${picker.file.path}.tmp` }
      );
      return picker.file.path;
    }

    _removeLegacyUI(window) {
      const doc = window.document;
      doc.getElementById(ns.config.itemMenuElementID)?.remove();
      doc.getElementById(ns.config.itemMenuSeparatorID)?.remove();
      doc.getElementById("gbt2025helper-item-context-submenu")?.remove();

      for (const elem of doc.querySelectorAll(".zotero-custom-menu-item")) {
        if (String(elem.className).includes("gbt7714-2025-helper")) elem.remove();
      }
      try {
        Zotero.ItemPaneManager.unregisterSection(ns.config.legacyPaneID);
      } catch (_) {}
    }

    _menuItem(doc, id, label, listener) {
      const item = doc.createXULElement("menuitem");
      item.id = id;
      item.setAttribute("label", label);
      item.addEventListener("command", listener);
      return item;
    }

    onMainWindowLoad(window) {
      if (ns.state.windowCleanups.has(window)) return;
      this._removeLegacyUI(window);
      const doc = window.document;
      const popup = doc.getElementById("zotero-itemmenu");
      if (!popup) {
        ns.warn(new Error("Cannot find Zotero item context menu"));
        return;
      }

      const separator = doc.createXULElement("menuseparator");
      separator.id = ns.config.itemMenuSeparatorID;
      const menu = doc.createXULElement("menu");
      menu.id = ns.config.itemMenuElementID;
      menu.setAttribute("label", "GB/T 7714—2025 文献助手");
      const submenu = doc.createXULElement("menupopup");
      submenu.id = "gbt2025helper-item-context-submenu";

      const normalize = this._menuItem(
        doc,
        "gbt2025helper-normalize",
        "规范化…",
        () => this.scanAndOpen(this._selectedItems(), "selection", window).catch(error => {
          ns.warn(error);
          this._alert("扫描失败", error.message || String(error), window);
        })
      );
      const undoLast = this._menuItem(
        doc,
        "gbt2025helper-undo-last",
        "撤销上一次修改…",
        () => this.openUndoLast(window).catch(error => {
          ns.warn(error);
          this._alert("撤销失败", error.message || String(error), window);
        })
      );
      const history = this._menuItem(
        doc,
        "gbt2025helper-history",
        "修改记录与撤销…",
        () => this.openHistory("", window).catch(error => {
          ns.warn(error);
          this._alert("打开记录失败", error.message || String(error), window);
        })
      );
      submenu.append(normalize, undoLast, history);
      menu.append(submenu);

      const updateVisibility = event => {
        if (event.target !== popup) return;
        const visible = this._regularItems(this._selectedItems()).length > 0;
        separator.hidden = !visible;
        menu.hidden = !visible;
        menu.disabled = !visible;
        undoLast.disabled = !ns.services.storage.listBatches()
          .some(entry =>
            entry.status === "committed" &&
            entry.undoState !== "fully-undone"
          );
      };
      popup.addEventListener("popupshowing", updateVisibility);
      popup.append(separator, menu);

      ns.state.windowCleanups.set(window, () => {
        popup.removeEventListener("popupshowing", updateVisibility);
        separator.remove();
        menu.remove();
      });
    }

    onMainWindowUnload(window) {
      ns.state.windowCleanups.get(window)?.();
      ns.state.windowCleanups.delete(window);
    }

    async registerPreferences() {
      try {
        Zotero.PreferencePanes.unregister(ns.config.preferencePaneID);
      } catch (_) {}
      ns.state.preferencePaneID = await Zotero.PreferencePanes.register({
        pluginID: ns.config.addonID,
        id: ns.config.preferencePaneID,
        label: "国标 2025 文献助手",
        image: `${ns.config.rootURI}content/icons/gbt-helper.svg`,
        src: "content/preferences.xhtml",
        scripts: ["content/preferences-ui.js"],
        stylesheets: ["content/preferences.css"],
        helpURL: ns.config.homepageURL
      });
    }

    async startup() {
      await ns.services.storage.init();
      await ns.services.items.reconcilePendingBatches();
      await this.registerPreferences();
      for (const window of Zotero.getMainWindows()) this.onMainWindowLoad(window);
    }

    shutdown() {
      ns.state.previewWindow?.close?.();
      ns.state.historyWindow?.close?.();
      ns.state.previewWindow = null;
      ns.state.historyWindow = null;
      for (const window of Zotero.getMainWindows()) {
        this.onMainWindowUnload(window);
        this._removeLegacyUI(window);
      }
      try {
        Zotero.PreferencePanes.unregister(ns.config.preferencePaneID);
      } catch (_) {}
      ns.state.preferencePaneID = null;
    }
  }

  ns.services.ui = new UIService();

  ns.hooks.onStartup = async () => {
    if (ns.state.initialized) return;
    await ns.services.ui.startup();
    ns.state.initialized = true;
  };
  ns.hooks.onMainWindowLoad = async window => ns.services.ui.onMainWindowLoad(window);
  ns.hooks.onMainWindowUnload = async window => ns.services.ui.onMainWindowUnload(window);
  ns.hooks.onShutdown = async () => {
    ns.services.ui.shutdown();
    ns.state.initialized = false;
  };
})();
