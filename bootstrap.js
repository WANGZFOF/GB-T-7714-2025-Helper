var rootURI;
var pluginContext;
var chromeHandle;

function install(data, reason) {}

async function startup(data, reason) {
  rootURI = data.rootURI || data.resourceURI.spec;
  await Zotero.initializationPromise;
  await Zotero.uiReadyPromise;

  const addonManagerStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  chromeHandle = addonManagerStartup.registerChrome(
    Services.io.newURI(rootURI + "manifest.json"),
    [
      ["content", "gbt2025helper", "content/", "contentaccessible=yes"]
    ]
  );

  pluginContext = {
    rootURI,
    addonID: data.id || "gbt7714-2025-helper@wangzfof.github.io",
    addonVersion: data.version || "0.3.1",
    Zotero,
    Services,
    Components,
    ChromeUtils,
    IOUtils,
    PathUtils,
    Cc,
    Ci
  };
  pluginContext._globalThis = pluginContext;

  for (const script of [
    "content/namespace.js",
    "content/core.js",
    "content/storage-service.js",
    "content/item-service.js",
    "content/ui-service.js"
  ]) {
    Services.scriptloader.loadSubScript(rootURI + script, pluginContext);
  }

  await Zotero.GBT2025Helper.hooks.onStartup();
  for (const window of Zotero.getMainWindows()) {
    await Zotero.GBT2025Helper.hooks.onMainWindowLoad(window);
  }
  Zotero.debug("[GBT 2025 Helper] startup complete");
}

async function onMainWindowLoad({ window }, reason) {
  await Zotero.GBT2025Helper?.hooks.onMainWindowLoad(window);
}

async function onMainWindowUnload({ window }, reason) {
  await Zotero.GBT2025Helper?.hooks.onMainWindowUnload(window);
}

async function shutdown(data, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }
  await Zotero.GBT2025Helper?.hooks.onShutdown();
  chromeHandle?.destruct?.();
  chromeHandle = null;
  delete Zotero.GBT2025Helper;
  pluginContext = null;
}

function uninstall(data, reason) {}
