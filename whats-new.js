(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  api.initWhatsNew({ chrome: root.chrome, document: root.document });
})(globalThis, function () {
  "use strict";

  const DISMISSED_VERSION_KEY = "pinterestWhatsNewDismissedVersion";
  const NOTICE_ID = "xzen-whats-new";

  function createNotice(document, onDismiss) {
    const overlay = document.createElement("div");
    overlay.id = NOTICE_ID;
    overlay.className = "xzen-whats-new-overlay";
    overlay.setAttribute("role", "presentation");

    const dialog = document.createElement("section");
    dialog.className = "xzen-whats-new-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "xzen-whats-new-title");

    const eyebrow = document.createElement("div");
    eyebrow.className = "xzen-whats-new-eyebrow";
    eyebrow.textContent = "୨୧  A LITTLE UPDATE  ୨୧";

    const title = document.createElement("h2");
    title.id = "xzen-whats-new-title";
    title.textContent = "AMOLED V2 is becoming our main theme";

    const intro = document.createElement("p");
    intro.textContent =
      "From now on, I’ll be focusing on AMOLED V2. I’m really sorry, but maintaining every theme by myself has become too much.";

    const plan = document.createElement("p");
    plan.textContent =
      "I’m slowly bringing the best parts of the other themes into AMOLED V2, just like the color picker we already have. Thanks a lot to everyone who’s been patient with this project. For now, the other theme colors are available, and in the next update I hope to bring what I promised ♡";

    const future = document.createElement("div");
    future.className = "xzen-whats-new-future";
    future.textContent =
      "⋆｡°✩ Later, AMOLED V2 will have even more customization, including choosing a background color instead of pure black. ✩°｡⋆";

    const vaultNote = document.createElement("p");
    vaultNote.className = "xzen-whats-new-vault-note";
    vaultNote.textContent =
      "Psst, hey! I also fixed a few Private Vault bugs and an issue where saved pins would appear as ‘thumb blocked.’ Have fun -w-";

    const dismiss = document.createElement("button");
    dismiss.id = "xzen-whats-new-dismiss";
    dismiss.className = "xzen-whats-new-dismiss";
    dismiss.type = "button";
    dismiss.textContent = "Don't show again until the next update";
    dismiss.addEventListener("click", onDismiss);

    dialog.append(eyebrow, title, intro, plan, future, vaultNote, dismiss);
    overlay.append(dialog);
    document.body.append(overlay);
    dismiss.focus();

    return overlay;
  }

  function initWhatsNew(environment) {
    const chrome = environment?.chrome;
    const document = environment?.document;
    if (!chrome?.runtime?.id || !chrome.storage?.local || !document) return;

    const version = String(chrome.runtime.getManifest?.().version || "");
    if (!version) return;

    chrome.storage.local.get({ [DISMISSED_VERSION_KEY]: "" }, (data) => {
      if (chrome.runtime.lastError) return;
      if (data[DISMISSED_VERSION_KEY] === version) return;

      const mount = () => {
        if (!document.body || document.getElementById(NOTICE_ID)) return;

        let notice;
        const dismiss = () => {
          chrome.storage.local.set({ [DISMISSED_VERSION_KEY]: version }, () => {
            if (!chrome.runtime.lastError) notice?.remove();
          });
        };

        notice = createNotice(document, dismiss);
      };

      if (document.body) mount();
      else document.addEventListener("DOMContentLoaded", mount, { once: true });
    });
  }

  return { initWhatsNew };
});
