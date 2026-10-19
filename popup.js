// popup.js
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggleAmoled");
  const statusLabel = document.getElementById("statusLabel");

  const dimSlider = document.getElementById("dimSlider");
  const dimValue = document.getElementById("dimValue");

  const githubLink = document.getElementById("githubLink");
  const reviewLink = document.getElementById("reviewLink");
  const customLink = document.getElementById("customLink");

  // Vault toggle key (sync)
  const KEY_VAULT_ENABLED = "pinterestVaultEnabled";

  // Theme selector key (sync): "amoled" | "amoled-v2" | "gray"
  const KEY_THEME = "pinterestTheme";
  const KEY_SETTINGS_THEMES_TIP_SEEN = "pinterestSeenSettingsThemesTip";
  const KEY_DISCORD_ANNOUNCEMENT_SEEN = "pinterestSeenDiscordAnnouncement113Themes";

  // Buttons
  const privatePinsBtn = document.getElementById("privatePinsBtn");

  // Settings button
  const settingsBtn =
    document.getElementById("settingsBtn") ||
    document.getElementById("settingsIcon") ||
    document.getElementById("settings") ||
    document.querySelector("[data-open-settings]");

  // Review helper modal
  const modalReview = document.getElementById("modalReview");
  const modalReviewGit = document.getElementById("modalReviewGit");
  const modalReviewGo = document.getElementById("modalReviewGo");

  const REVIEW_URL =
    "https://chromewebstore.google.com/detail/kdgobbjebmemhbllcgplpnolhoaniegn/reviews";
  const GITHUB_ISSUES_URL =
    "https://github.com/LXRylex/TrueAMOLED-Projext-Pinterest/issues";
  const DISCORD_INVITE_URL = "https://discord.gg/mC8bZKUU6N";

  function openExternal(url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openExtensionPage(file) {
    const url = chrome.runtime.getURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => openExtensionPage("settings.html"));
  }

  function setVaultButtonVisible(visible) {
    document.body.classList.toggle("vault-off", !visible);

    if (!privatePinsBtn) return;

    privatePinsBtn.style.display = visible ? "" : "none";
    privatePinsBtn.disabled = !visible;
  }

  if (privatePinsBtn) {
    privatePinsBtn.addEventListener("click", () => {
      if (privatePinsBtn.disabled) return;
      openExtensionPage("vault.html");
    });
  }

  if (githubLink) {
    githubLink.href = "https://github.com/LXRylex/TrueAMOLED-Projext-Pinterest/releases";
  }

  if (reviewLink) {
    reviewLink.href = REVIEW_URL;
  }

  if (customLink) {
    customLink.href = "https://projects.xzentosia.com/xzentosia_projects.html";
  }

  chrome.storage.sync.get({ [KEY_VAULT_ENABLED]: true }, (d) => {
    setVaultButtonVisible(!!d[KEY_VAULT_ENABLED]);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;

    if (changes[KEY_VAULT_ENABLED]) {
      setVaultButtonVisible(!!changes[KEY_VAULT_ENABLED].newValue);
    }
  });

  // --------------------------
  // Modal helpers
  // --------------------------
  function showModal(el) {
    if (!el) return;
    el.classList.add("show");
    el.setAttribute("aria-hidden", "false");
    if (el.id === "modalDiscordAnnouncement") {
      document.body.classList.add("discord-announcement-open");
    }
  }

  function hideModal(el) {
    if (!el) return;
    el.classList.remove("show");
    el.setAttribute("aria-hidden", "true");
    if (el.id === "modalDiscordAnnouncement") {
      document.body.classList.remove("discord-announcement-open");
    }
  }

  function bindBackdropClose(el) {
    if (!el) return;

    el.addEventListener("mousedown", (e) => {
      if (e.target === el) hideModal(el);
    });
  }

  bindBackdropClose(modalReview);

  const modalDiscordAnnouncement = document.getElementById("modalDiscordAnnouncement");
  const modalDiscordAnnouncementOk = document.getElementById("modalDiscordAnnouncementOk");
  const modalDiscordJoin = document.getElementById("modalDiscordJoin");
  const modalSettingsThemes = document.getElementById("modalSettingsThemes");
  const modalSettingsThemesOk = document.getElementById("modalSettingsThemesOk");
  const modalSettingsThemesDont = document.getElementById("modalSettingsThemesDont");

  function showSettingsThemesTipIfNeeded() {
    chrome.storage.sync.get({ [KEY_SETTINGS_THEMES_TIP_SEEN]: false }, (data) => {
      if (!data[KEY_SETTINGS_THEMES_TIP_SEEN]) showModal(modalSettingsThemes);
    });
  }

  function dismissDiscordAnnouncement() {
    chrome.storage.sync.set({ [KEY_DISCORD_ANNOUNCEMENT_SEEN]: true }, () => {
      hideModal(modalDiscordAnnouncement);
      showSettingsThemesTipIfNeeded();
    });
  }

  function showStartupNotices() {
    chrome.storage.sync.get({ [KEY_DISCORD_ANNOUNCEMENT_SEEN]: false }, (data) => {
      if (!data[KEY_DISCORD_ANNOUNCEMENT_SEEN]) showModal(modalDiscordAnnouncement);
      else showSettingsThemesTipIfNeeded();
    });
  }

  modalDiscordAnnouncementOk?.addEventListener("click", dismissDiscordAnnouncement);
  modalDiscordJoin?.addEventListener("click", () => {
    openExternal(DISCORD_INVITE_URL);
    dismissDiscordAnnouncement();
  });
  modalSettingsThemesOk?.addEventListener("click", () => {
    if (modalSettingsThemesDont?.checked) {
      chrome.storage.sync.set({ [KEY_SETTINGS_THEMES_TIP_SEEN]: true }, () => {
        hideModal(modalSettingsThemes);
      });
      return;
    }
    hideModal(modalSettingsThemes);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalReview?.classList.contains("show")) {
      hideModal(modalReview);
    }
  });

  if (reviewLink && modalReview) {
    reviewLink.addEventListener("click", (e) => {
      e.preventDefault();
      showModal(modalReview);
    });
  }

  if (modalReviewGit) {
    modalReviewGit.addEventListener("click", () => {
      openExternal(GITHUB_ISSUES_URL);
      hideModal(modalReview);
    });
  }

  if (modalReviewGo) {
    modalReviewGo.addEventListener("click", () => {
      openExternal(REVIEW_URL);
      hideModal(modalReview);
    });
  }

  if (!toggle || !statusLabel || !dimSlider || !dimValue) return;

  function setLabel(enabled) {
    statusLabel.textContent = enabled ? "Enabled on Pinterest" : "Disabled on Pinterest";
  }

  function applyState(enabled) {
    document.body.classList.toggle("on", enabled);
    toggle.checked = enabled;
    setLabel(enabled);
  }

  function setDimUI(level) {
    const n = Math.max(0, Math.min(80, Number(level) || 0));

    dimSlider.value = String(n);
    dimValue.textContent = `${n}%`;

    const max = Number(dimSlider.max) || 80;
    const percentage = (n / max) * 100;

    dimSlider.style.setProperty("--slider-fill", `${percentage}%`);
  }

  chrome.storage.sync.get(
    {
      pinterestAmoledEnabled: false,
      pinterestDimLevel: 0,
      [KEY_THEME]: "amoled",
    },
    (data) => {
      const enabled = !!data.pinterestAmoledEnabled;
      const dimLevel = Number(data.pinterestDimLevel) || 0;

      applyState(enabled);
      setDimUI(enabled ? dimLevel : 0);

      showStartupNotices();

    }
  );

  toggle.addEventListener("change", () => {
    const enabled = toggle.checked;

    chrome.storage.sync.get({ pinterestDimLevel: 0 }, (d) => {
      const dimLevel = Number(d.pinterestDimLevel) || 0;

      chrome.storage.sync.set({
        pinterestAmoledEnabled: enabled,
        pinterestDimLevel: enabled ? dimLevel : 0,
      });

      applyState(enabled);
      setDimUI(enabled ? dimLevel : 0);
    });
  });

  dimSlider.addEventListener("input", () => {
    const level = Number(dimSlider.value) || 0;

    setDimUI(level);

    chrome.storage.sync.set({ pinterestDimLevel: level });
  });
});
