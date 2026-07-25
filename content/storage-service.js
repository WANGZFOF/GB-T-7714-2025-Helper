(function () {
  const ns = Zotero.GBT2025Helper;
  const clone = value => JSON.parse(JSON.stringify(value));

  class StorageService {
    constructor() {
      this.directory = PathUtils.join(
        Zotero.DataDirectory?.dir || PathUtils.profileDir,
        "gbt7714-2025-helper"
      );
      this.decisionsPath = PathUtils.join(this.directory, "decisions.json");
      this.historyDirectory = PathUtils.join(this.directory, "history");
      this.batchDirectory = PathUtils.join(this.historyDirectory, "batches");
      this.historyPath = PathUtils.join(this.historyDirectory, "index.json");
      this.decisions = { version: 1, names: {} };
      this.history = { version: 1, batches: [] };
      this._writeQueue = Promise.resolve();
    }

    async init() {
      await IOUtils.makeDirectory(this.directory, { ignoreExisting: true });
      await IOUtils.makeDirectory(this.historyDirectory, { ignoreExisting: true });
      await IOUtils.makeDirectory(this.batchDirectory, { ignoreExisting: true });
      this.decisions = await this._readJSON(this.decisionsPath, this.decisions);
      if (!this.decisions.names || typeof this.decisions.names !== "object") {
        this.decisions.names = {};
      }
      let rebuild = false;
      if (await IOUtils.exists(this.historyPath)) {
        try {
          const parsed = JSON.parse(await IOUtils.readUTF8(this.historyPath));
          if (!parsed || !Array.isArray(parsed.batches)) throw new Error("Invalid history index");
          this.history = parsed;
        } catch (error) {
          ns.warn(error);
          rebuild = true;
        }
      }
      if (rebuild) {
        await this.rebuildHistoryIndex();
      } else {
        await this._writeJSON(this.historyPath, this.history);
      }
    }

    async _readJSON(path, fallback) {
      try {
        if (!(await IOUtils.exists(path))) return clone(fallback);
        const value = JSON.parse(await IOUtils.readUTF8(path));
        return value && typeof value === "object" ? value : clone(fallback);
      } catch (error) {
        ns.warn(error);
        return clone(fallback);
      }
    }

    _writeJSON(path, value) {
      const text = JSON.stringify(value, null, 2) + "\n";
      const write = this._writeQueue.catch(error => ns.warn(error)).then(() =>
        IOUtils.writeUTF8(path, text, { tmpPath: `${path}.tmp` })
      );
      this._writeQueue = write.catch(() => {});
      return write;
    }

    _batchPath(batchID) {
      return PathUtils.join(this.batchDirectory, `${batchID}.json`);
    }

    _summary(batch) {
      return {
        batchID: batch.batchID,
        status: batch.status,
        operation: batch.operation || "normalize",
        createdAt: batch.createdAt,
        committedAt: batch.committedAt || "",
        pluginVersion: batch.pluginVersion,
        source: batch.source || "",
        itemCount: batch.items?.length || 0,
        changedFields: Array.from(new Set(
          (batch.items || []).flatMap(item => item.changedFields || [])
        )),
        undoEvents: batch.undoEvents || [],
        undoState: batch.undoState || "not-undone"
      };
    }

    async _saveIndex() {
      this.history.batches.sort((a, b) =>
        String(b.committedAt || b.createdAt).localeCompare(String(a.committedAt || a.createdAt))
      );
      await this._writeJSON(this.historyPath, this.history);
    }

    async rebuildHistoryIndex() {
      const summaries = [];
      let children = [];
      try {
        children = await IOUtils.getChildren(this.batchDirectory);
      } catch (error) {
        ns.warn(error);
      }
      for (const path of children.filter(path => path.endsWith(".json"))) {
        const batch = await this._readJSON(path, null);
        if (batch?.batchID) summaries.push(this._summary(batch));
      }
      this.history = { version: 1, batches: summaries };
      await this._saveIndex();
      return clone(this.history);
    }

    async beginBatch(data) {
      const batchID = data.batchID ||
        `${new Date().toISOString().replace(/[:.]/gu, "-")}-${Math.random().toString(16).slice(2, 10)}`;
      const batch = {
        version: 1,
        batchID,
        status: "pending",
        operation: data.operation || "normalize",
        createdAt: new Date().toISOString(),
        pluginVersion: ns.config.addonVersion,
        source: data.source || "",
        items: clone(data.items || []),
        skipped: clone(data.skipped || []),
        undoEvents: []
      };
      await this._writeJSON(this._batchPath(batchID), batch);
      this.history.batches = this.history.batches.filter(entry => entry.batchID !== batchID);
      this.history.batches.unshift(this._summary(batch));
      await this._saveIndex();
      return clone(batch);
    }

    async commitBatch(batchID, extra = {}) {
      const batch = await this.getBatch(batchID);
      if (!batch) throw new Error(`Missing history batch: ${batchID}`);
      Object.assign(batch, clone(extra), {
        status: "committed",
        committedAt: new Date().toISOString()
      });
      await this._writeJSON(this._batchPath(batchID), batch);
      this.history.batches = this.history.batches.filter(entry => entry.batchID !== batchID);
      this.history.batches.unshift(this._summary(batch));
      await this._saveIndex();
      return clone(batch);
    }

    async abortBatch(batchID, error) {
      const batch = await this.getBatch(batchID);
      if (!batch) return;
      batch.status = "aborted";
      batch.abortedAt = new Date().toISOString();
      batch.error = String(error?.message || error || "");
      await this._writeJSON(this._batchPath(batchID), batch);
      this.history.batches = this.history.batches.filter(entry => entry.batchID !== batchID);
      this.history.batches.unshift(this._summary(batch));
      await this._saveIndex();
    }

    async getBatch(batchID) {
      if (!batchID) return null;
      return this._readJSON(this._batchPath(batchID), null);
    }

    listBatches() {
      return clone(this.history.batches);
    }

    async recordUndo(batchID, event) {
      const batch = await this.getBatch(batchID);
      if (!batch) throw new Error(`Missing history batch: ${batchID}`);
      batch.undoEvents = Array.isArray(batch.undoEvents) ? batch.undoEvents : [];
      batch.undoEvents.push({
        ...clone(event),
        undoneAt: new Date().toISOString()
      });
      batch.undoState = event.complete ? "fully-undone" : "partly-undone";
      await this._writeJSON(this._batchPath(batchID), batch);
      this.history.batches = this.history.batches.map(entry =>
        entry.batchID === batchID ? this._summary(batch) : entry
      );
      await this._saveIndex();
      return clone(batch);
    }

    async getHistoryStats() {
      let bytes = 0;
      let fileCount = 0;
      for (const entry of this.history.batches) {
        try {
          const stat = await IOUtils.stat(this._batchPath(entry.batchID));
          bytes += Number(stat.size || 0);
          fileCount++;
        } catch (_) {}
      }
      return {
        directory: this.directory,
        historyDirectory: this.historyDirectory,
        batches: this.history.batches.length,
        fileCount,
        bytes
      };
    }

    async exportSnapshot(batchID = "") {
      if (batchID) return this.getBatch(batchID);
      const batches = [];
      for (const entry of this.history.batches) {
        const batch = await this.getBatch(entry.batchID);
        if (batch) batches.push(batch);
      }
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        pluginVersion: ns.config.addonVersion,
        batches
      };
    }

    async clearHistory() {
      const children = await IOUtils.getChildren(this.batchDirectory);
      for (const path of children) {
        if (path.endsWith(".json")) await IOUtils.remove(path);
      }
      this.history = { version: 1, batches: [] };
      await this._saveIndex();
    }

    getDecision(key) {
      return this.decisions.names[key]?.target || "";
    }

    async rememberDecisions(entries) {
      const confirmedAt = new Date().toISOString();
      for (const { key, target } of entries) {
        if (key && target) this.decisions.names[key] = { target, confirmedAt };
      }
      await this._writeJSON(this.decisionsPath, this.decisions);
    }
  }

  ns.services.storage = new StorageService();
})();
