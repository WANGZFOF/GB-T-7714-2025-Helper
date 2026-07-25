(function () {
  const ns = Zotero.GBT2025Helper;
  const core = ns.core;
  const clone = value => JSON.parse(JSON.stringify(value));

  class ItemService {
    _field(item, field) {
      try {
        return item.getField(field) || "";
      } catch (_) {
        return "";
      }
    }

    _snapshot(item) {
      return {
        creators: clone(item.getCreators()),
        extra: this._field(item, "extra"),
        DOI: this._field(item, "DOI"),
        url: this._field(item, "url")
      };
    }

    _isEditable(item) {
      try {
        if (!item?.isRegularItem?.() || item.deleted) return false;
        if (typeof item.isEditable === "function" && !item.isEditable()) return false;
        const library = Zotero.Libraries.get(item.libraryID);
        return library?.editable !== false;
      } catch (_) {
        return false;
      }
    }

    _itemLabel(item) {
      return this._field(item, "title") || item.getDisplayTitle?.() || item.key;
    }

    _creatorRole(creator) {
      try {
        const type = Zotero.CreatorTypes.getName(creator.creatorTypeID);
        return Zotero.CreatorTypes.getLocalizedString(type);
      } catch (_) {
        return String(creator.creatorType || creator.creatorTypeID || "");
      }
    }

    async _getItem(record) {
      try {
        if (typeof Zotero.Items.getByLibraryAndKeyAsync === "function") {
          const item = await Zotero.Items.getByLibraryAndKeyAsync(
            Number(record.libraryID),
            record.itemKey
          );
          if (item) return item;
        }
        if (typeof Zotero.Items.getByLibraryAndKey === "function") {
          const item = Zotero.Items.getByLibraryAndKey(
            Number(record.libraryID),
            record.itemKey
          );
          if (item) return item;
        }
      } catch (_) {}
      return record.itemID ? Zotero.Items.getAsync(Number(record.itemID)) : null;
    }

    _setSnapshotFields(item, snapshot, fields) {
      if (fields.includes("creators")) item.setCreators(clone(snapshot.creators || []));
      if (fields.includes("extra")) item.setField("extra", String(snapshot.extra || ""));
      if (fields.includes("DOI")) item.setField("DOI", String(snapshot.DOI || ""));
      if (fields.includes("url")) item.setField("url", String(snapshot.url || ""));
    }

    async scan(items) {
      const names = [];
      const online = [];
      const skipped = [];
      const seen = new Set();

      for (const item of items || []) {
        if (!item || seen.has(item.id)) continue;
        seen.add(item.id);
        if (!item.isRegularItem?.()) continue;
        if (!this._isEditable(item)) {
          skipped.push({ itemID: item.id, title: this._itemLabel(item), reason: "read-only" });
          continue;
        }

        const itemLabel = this._itemLabel(item);
        const creators = item.getCreators();
        const context = {
          language: this._field(item, "language"),
          title: this._field(item, "title"),
          containerTitle: this._field(item, "publicationTitle")
        };
        creators.forEach((creator, creatorIndex) => {
          const decisionKey = core.creatorDecisionKey(creator.lastName, creator.firstName);
          const analysis = core.analyzeCreator(
            creator,
            context,
            ns.services.storage.getDecision(decisionKey)
          );
          if (!analysis.candidate) return;
          names.push({
            itemID: item.id,
            itemKey: item.key,
            libraryID: item.libraryID,
            itemTitle: itemLabel,
            creatorIndex,
            role: this._creatorRole(creator),
            original: [creator.lastName, creator.firstName].filter(Boolean).join(" | "),
            originalLastName: creator.lastName || "",
            originalFirstName: creator.firstName || "",
            decisionKey,
            target: analysis.target,
            selected: analysis.defaultSelected,
            confidence: analysis.confidence,
            reasons: analysis.reasons
          });
        });

        const DOI = this._field(item, "DOI");
        const url = this._field(item, "url");
        const extra = this._field(item, "extra");
        const itemType = Zotero.ItemTypes.getName(item.itemTypeID);
        const analysis = core.analyzeOnlineResource({
          itemType,
          extra,
          DOI,
          url,
          accessDate: this._field(item, "accessDate")
        });
        if (analysis.candidate) {
          online.push({
            itemID: item.id,
            itemKey: item.key,
            libraryID: item.libraryID,
            itemTitle: itemLabel,
            itemType,
            explicit: analysis.explicit,
            desiredOnline: analysis.explicit,
            DOI,
            normalizedDOI: core.normalizeDOI(DOI),
            url,
            extra,
            clearExtra: false,
            accessDate: this._field(item, "accessDate"),
            reasons: analysis.reasons,
            hasAccessPath: analysis.hasAccessPath
          });
        }
      }
      return { names, online, skipped };
    }

    _stageItem(item, work) {
      const before = this._snapshot(item);
      const after = clone(before);
      const decisions = [];

      for (const row of work.names) {
        if (!after.creators[row.creatorIndex]) continue;
        const target = core.cleanSpaces(row.target);
        after.creators[row.creatorIndex] = {
          ...after.creators[row.creatorIndex],
          firstName: "",
          lastName: target,
          fieldMode: 1
        };
        decisions.push({ key: row.decisionKey, target });
      }

      if (work.online) {
        const row = work.online;
        after.extra = core.setMediumOL(
          before.extra,
          !!row.desiredOnline,
          !!row.clearExtra
        );
        after.DOI = core.normalizeDOI(row.DOI);
        after.url = core.cleanSpaces(row.url);
      }

      return {
        libraryID: item.libraryID,
        itemKey: item.key,
        itemID: item.id,
        title: this._itemLabel(item),
        changedFields: core.changedSnapshotFields(before, after),
        before,
        after,
        decisions
      };
    }

    async apply(payload) {
      const selectedNames = (payload.names || []).filter(row => row.selected);
      const onlineRows = payload.online || [];
      const byItem = new Map();
      const add = row => {
        if (!byItem.has(row.itemID)) byItem.set(row.itemID, { names: [], online: null });
        return byItem.get(row.itemID);
      };
      selectedNames.forEach(row => add(row).names.push(row));
      onlineRows.forEach(row => { add(row).online = row; });

      const validationErrors = [];
      for (const row of onlineRows) {
        if (row.desiredOnline && !core.normalizeDOI(row.DOI) && !core.cleanSpaces(row.url)) {
          validationErrors.push(`${row.itemTitle}：标记 OL 前必须填写 DOI 或网址`);
        }
      }
      if (validationErrors.length) {
        const error = new Error(validationErrors.join("\n"));
        error.name = "ValidationError";
        throw error;
      }

      const staged = [];
      const skipped = [];
      for (const [itemID, work] of byItem) {
        const item = await Zotero.Items.getAsync(Number(itemID));
        if (!this._isEditable(item)) {
          skipped.push({ itemID, title: this._itemLabel(item), reason: "read-only" });
          continue;
        }
        const record = this._stageItem(item, work);
        if (record.changedFields.length) staged.push(record);
      }

      if (!staged.length) return { changed: 0, skipped, batchID: "" };

      const batch = await ns.services.storage.beginBatch({
        operation: "normalize",
        source: payload.source || "",
        items: staged.map(({ decisions, ...record }) => record),
        skipped
      });

      try {
        await Zotero.DB.executeTransaction(async () => {
          for (const record of staged) {
            const item = await this._getItem(record);
            if (!this._isEditable(item)) {
              throw new Error(`条目不可编辑：${record.title}`);
            }
            if (core.snapshotFingerprint(this._snapshot(item)) !==
                core.snapshotFingerprint(record.before)) {
              throw new Error(`条目在预览后发生变化，请重新扫描：${record.title}`);
            }
            this._setSnapshotFields(item, record.after, record.changedFields);
            await item.save({ skipDateModifiedUpdate: false });
          }
        });
      } catch (error) {
        try {
          await ns.services.storage.abortBatch(batch.batchID, error);
        } catch (historyError) {
          ns.warn(historyError);
        }
        throw error;
      }

      let historyPending = false;
      try {
        await ns.services.storage.commitBatch(batch.batchID);
      } catch (error) {
        historyPending = true;
        ns.warn(error);
      }

      const decisionEntries = staged.flatMap(record => record.decisions);
      if (decisionEntries.length) {
        try {
          await ns.services.storage.rememberDecisions(decisionEntries);
        } catch (error) {
          ns.warn(error);
        }
      }
      return {
        changed: staged.length,
        skipped,
        batchID: batch.batchID,
        historyPending
      };
    }

    async prepareUndo(batchID) {
      const batch = await ns.services.storage.getBatch(batchID);
      if (!batch) throw new Error("找不到该修改批次。");
      const items = [];

      for (const record of batch.items || []) {
        const item = await this._getItem(record);
        if (!item) {
          items.push({ ...record, status: "missing", selected: false, conflicts: ["条目不存在"] });
          continue;
        }
        if (!this._isEditable(item)) {
          items.push({ ...record, status: "read-only", selected: false, conflicts: ["条目只读"] });
          continue;
        }

        const current = this._snapshot(item);
        const details = (record.changedFields || []).map(field => {
          const currentValue = core.snapshotFieldFingerprint(current[field]);
          const beforeValue = core.snapshotFieldFingerprint(record.before[field]);
          const afterValue = core.snapshotFieldFingerprint(record.after[field]);
          return {
            field,
            state: currentValue === afterValue
              ? "after"
              : currentValue === beforeValue ? "before" : "conflict"
          };
        });
        const conflicts = details.filter(detail => detail.state === "conflict").map(detail => detail.field);
        const status = conflicts.length
          ? "conflict"
          : details.every(detail => detail.state === "before") ? "already-undone" : "safe";
        items.push({
          libraryID: record.libraryID,
          itemKey: record.itemKey,
          itemID: record.itemID,
          title: record.title,
          changedFields: record.changedFields,
          status,
          selected: status === "safe",
          force: false,
          conflicts
        });
      }

      return {
        batchID: batch.batchID,
        createdAt: batch.createdAt,
        committedAt: batch.committedAt,
        status: batch.status,
        items
      };
    }

    async undo(payload) {
      const batch = await ns.services.storage.getBatch(payload.batchID);
      if (!batch) throw new Error("找不到该修改批次。");
      const byKey = new Map((batch.items || []).map(record =>
        [`${record.libraryID}/${record.itemKey}`, record]
      ));
      const selected = (payload.items || []).filter(row => row.selected);
      const restored = [];
      const skipped = [];
      const forced = [];

      await Zotero.DB.executeTransaction(async () => {
        for (const row of selected) {
          const record = byKey.get(`${row.libraryID}/${row.itemKey}`);
          if (!record) continue;
          const item = await this._getItem(record);
          if (!this._isEditable(item)) {
            skipped.push({ title: record.title, reason: "missing-or-read-only" });
            continue;
          }

          const current = this._snapshot(item);
          const conflictFields = (record.changedFields || []).filter(field => {
            const value = core.snapshotFieldFingerprint(current[field]);
            return value !== core.snapshotFieldFingerprint(record.after[field]) &&
              value !== core.snapshotFieldFingerprint(record.before[field]);
          });
          if (conflictFields.length && !row.force) {
            skipped.push({ title: record.title, reason: "conflict", fields: conflictFields });
            continue;
          }

          const fieldsToRestore = (record.changedFields || []).filter(field =>
            core.snapshotFieldFingerprint(current[field]) !==
              core.snapshotFieldFingerprint(record.before[field])
          );
          if (!fieldsToRestore.length) {
            skipped.push({ title: record.title, reason: "already-undone" });
            continue;
          }
          this._setSnapshotFields(item, record.before, fieldsToRestore);
          await item.save({ skipDateModifiedUpdate: false });
          restored.push({ title: record.title, fields: fieldsToRestore });
          if (conflictFields.length) forced.push({ title: record.title, fields: conflictFields });
        }
      });

      const remainingPreview = await this.prepareUndo(batch.batchID);
      const remaining = remainingPreview.items.filter(item =>
        item.status === "safe" || item.status === "conflict"
      ).length;
      let historyPending = false;
      try {
        await ns.services.storage.recordUndo(batch.batchID, {
          restored,
          skipped,
          forced,
          remaining,
          complete: remaining === 0
        });
      } catch (error) {
        historyPending = true;
        ns.warn(error);
      }
      return {
        restored: restored.length,
        skipped,
        forced: forced.length,
        historyPending
      };
    }

    async reconcilePendingBatches() {
      for (const summary of ns.services.storage.listBatches()) {
        if (summary.status !== "pending") continue;
        const batch = await ns.services.storage.getBatch(summary.batchID);
        const states = [];
        for (const record of batch?.items || []) {
          const item = await this._getItem(record);
          if (!item) {
            states.push("missing");
            continue;
          }
          const current = core.snapshotFingerprint(this._snapshot(item));
          states.push(
            current === core.snapshotFingerprint(record.after)
              ? "after"
              : current === core.snapshotFingerprint(record.before) ? "before" : "conflict"
          );
        }
        if (states.length && states.every(state => state === "after")) {
          await ns.services.storage.commitBatch(summary.batchID, { recoveredAt: new Date().toISOString() });
        } else if (!states.length || states.every(state => state === "before")) {
          await ns.services.storage.abortBatch(summary.batchID, "未检测到已应用的修改");
        }
      }
    }
  }

  ns.services.items = new ItemService();
})();
