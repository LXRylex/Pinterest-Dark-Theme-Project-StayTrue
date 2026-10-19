const KEY_VAULT_ENABLED = "pinterestVaultEnabled"; // sync
const KEY_THEME = "pinterestTheme"; // sync
const KEY_THEME_ACCENTS = "pinterestThemeAccentColors"; // sync
const KEY_THEME_ACCENT_PREVIEW = "pinterestThemeAccentPreview"; // local
const VAULT_KEY = "xzenVaultItems"; // local
const IS_FIREFOX = typeof globalThis.browser?.runtime?.getBrowserInfo === "function";

const DEFAULT_THEME_ACCENTS = {
  amoled: "#B38AFF",
  "amoled-v2": "#8E6BFF",
};

const ACCENT_FIELDS = {
  amoled: { picker: "accentAmoled", hex: "accentAmoledHex" },
  "amoled-v2": { picker: "accentAmoledV2", hex: "accentAmoledV2Hex" },
};

let accentColors = {};
let accentPreviewTheme = "amoled";
let selectedTheme = "amoled";
const pendingAccentSaves = {};

const VALID_TABS = ["dashboard", "themes", "plugins", "info", "donation"];
const PINS_BOARDS_ADDON_ID = "dckeachmifeldpanciikcopepeiiblkj";
const PINS_BOARDS_ADDON_URL =
  "https://chromewebstore.google.com/detail/download-pinsboards-add-o/dckeachmifeldpanciikcopepeiiblkj?authuser=0&hl=en";
const FALLBACK_THEME_CATALOG = [
  {
    id: "amoled",
    name: "AMOLED Theme",
    description: "Original v1 Version",
    cssFile: "amoled.css",
    customizableAccent: true,
    defaultAccent: "#B38AFF",
  },
  {
    id: "amoled-v2",
    name: "AMOLED V2 Theme",
    description: "New experimental AMOLED Project that uses new algorithm.",
    cssFile: "amoled-v2.css",
    customizableAccent: true,
    defaultAccent: "#8E6BFF",
    badge: "NEW",
    highlight: true,
  },
  {
    id: "gray",
    name: "Gray Theme",
    description: "Original gray Theme, based on AMOLED v1",
    cssFile: "gray.css",
  },
];

function getThemeCatalog() {
  const catalog = window.XZEN_THEME_CATALOG;
  return Array.isArray(catalog) && catalog.length ? catalog : FALLBACK_THEME_CATALOG;
}

function getThemeDef(theme) {
  return getThemeCatalog().find((item) => item.id === theme);
}

function normalizeTheme(theme) {
  return getThemeDef(theme) ? theme : "amoled";
}

function normalizeTab(tab) {
  return VALID_TABS.includes(tab) ? tab : "dashboard";
}

function themeLabel(theme) {
  return getThemeDef(theme)?.name || "AMOLED";
}

function normalizeHexColor(value) {
  const raw = String(value || "").trim();
  const short = raw.match(/^#?([0-9a-f]{3})$/i);

  if (short) {
    return `#${short[1]
      .split("")
      .map((char) => char + char)
      .join("")}`.toUpperCase();
  }

  const full = raw.match(/^#?([0-9a-f]{6})$/i);
  return full ? `#${full[1].toUpperCase()}` : "";
}

function getAccentColor(theme) {
  return normalizeHexColor(accentColors[theme]) || DEFAULT_THEME_ACCENTS[theme] || "#B38AFF";
}

function setAccentStatus(text) {
  const el = document.getElementById("accentSaveStatus");
  if (!el) return;

  el.textContent = text;
  clearTimeout(el._clearTimer);
  el._clearTimer = setTimeout(() => (el.textContent = ""), 1300);
}

function updateAccentPreview(theme, color) {
  const cleanTheme = DEFAULT_THEME_ACCENTS[theme] ? theme : "amoled";
  const cleanColor = normalizeHexColor(color) || getAccentColor(cleanTheme);
  const preview = document.getElementById("accentPreview");
  const label = document.getElementById("accentPreviewLabel");

  accentPreviewTheme = cleanTheme;
  preview?.style.setProperty("--preview-accent", cleanColor);
  document.documentElement.style.setProperty("--preview-accent", cleanColor);

  if (label) label.textContent = `${themeLabel(cleanTheme)} · ${cleanColor}`;

  document.querySelectorAll(".accent-control[data-accent-theme]").forEach((row) => {
    row.classList.toggle("previewing", row.dataset.accentTheme === cleanTheme);
  });
}

function updateAccentFields(theme) {
  const fields = ACCENT_FIELDS[theme];
  if (!fields) return;

  const color = getAccentColor(theme);
  const picker = document.getElementById(fields.picker);
  const hex = document.getElementById(fields.hex);

  if (picker) picker.value = color;
  if (hex) {
    hex.value = color;
    hex.classList.remove("invalid");
  }
}

function broadcastAccentPreview(theme, color) {
  chrome.storage.local.set({
    [KEY_THEME_ACCENT_PREVIEW]: {
      theme,
      color: normalizeHexColor(color) || null,
      updatedAt: Date.now(),
    },
  });

  if (!chrome.tabs?.query || !chrome.tabs?.sendMessage) return;

  chrome.tabs.query({ url: ["*://*.pinterest.com/*"] }, (tabs) => {
    if (chrome.runtime.lastError || !Array.isArray(tabs)) return;

    tabs.forEach((tab) => {
      if (!Number.isInteger(tab.id)) return;
      chrome.tabs.sendMessage(
        tab.id,
        { type: "xzen-preview-theme-accent", theme, color },
        () => void chrome.runtime.lastError
      );
    });
  });
}

function previewAccent(theme, color) {
  const cleanColor = normalizeHexColor(color);
  if (!cleanColor) return false;

  if (selectedTheme !== theme) {
    setThemeOptions(theme);
    chrome.storage.sync.set({ [KEY_THEME]: theme });
  }

  updateAccentPreview(theme, cleanColor);
  broadcastAccentPreview(theme, cleanColor);
  return true;
}

function saveAccent(theme, color) {
  const cleanColor = normalizeHexColor(color);
  if (!DEFAULT_THEME_ACCENTS[theme] || !cleanColor) return;

  clearTimeout(pendingAccentSaves[theme]);
  delete pendingAccentSaves[theme];

  accentColors = { ...accentColors, [theme]: cleanColor };
  updateAccentFields(theme);
  updateAccentPreview(theme, cleanColor);

  chrome.storage.sync.set({ [KEY_THEME]: theme, [KEY_THEME_ACCENTS]: accentColors }, () => {
    if (chrome.runtime.lastError) {
      setAccentStatus("Could not save color");
      return;
    }

    setAccentStatus("Color saved · Pinterest updated live");
  });
}

function queueAccentSave(theme, color) {
  const cleanColor = normalizeHexColor(color);
  if (!DEFAULT_THEME_ACCENTS[theme] || !cleanColor) return;

  clearTimeout(pendingAccentSaves[theme]);
  pendingAccentSaves[theme] = setTimeout(() => saveAccent(theme, cleanColor), 250);
}

function resetAccent(theme) {
  if (!DEFAULT_THEME_ACCENTS[theme]) return;

  clearTimeout(pendingAccentSaves[theme]);
  delete pendingAccentSaves[theme];

  const next = { ...accentColors };
  delete next[theme];
  accentColors = next;

  updateAccentFields(theme);
  updateAccentPreview(theme, DEFAULT_THEME_ACCENTS[theme]);
  broadcastAccentPreview(theme, null);

  chrome.storage.sync.set({ [KEY_THEME_ACCENTS]: next }, () => {
    setAccentStatus(chrome.runtime.lastError ? "Could not reset color" : "Default color restored");
  });
}

function createThemeButton(theme) {
  const btn = document.createElement("button");
  btn.className = "theme-option";
  if (theme.highlight) btn.classList.add("theme-option-new");
  btn.type = "button";
  btn.dataset.theme = theme.id;
  btn.setAttribute("role", "radio");
  btn.setAttribute("aria-checked", "false");

  const top = document.createElement("span");
  top.className = "theme-top";

  const name = document.createElement("span");
  name.className = "theme-name";
  name.textContent = theme.name;
  top.appendChild(name);

  if (theme.badge) {
    const badge = document.createElement("span");
    badge.className = theme.highlight ? "theme-badge-new" : "theme-badge";
    badge.textContent = theme.badge;
    top.appendChild(badge);
  }

  const desc = document.createElement("span");
  desc.className = theme.highlight ? "theme-desc theme-desc-green" : "theme-desc";
  desc.textContent = theme.description || "";

  btn.append(top, desc);
  return btn;
}

function createThemeSection(title, themes) {
  const section = document.createElement("section");
  section.className = "theme-section";

  const heading = document.createElement("div");
  heading.className = "theme-section-title";
  heading.textContent = title;

  const grid = document.createElement("div");
  grid.className = "theme-options-grid";

  themes.forEach((theme) => grid.appendChild(createThemeButton(theme)));
  section.append(heading, grid);

  return section;
}

function renderThemeOptions(selectedTheme) {
  const el = document.getElementById("themeOptions");
  if (!el || el.dataset.rendered === "true") return;

  const catalog = getThemeCatalog();
  const currentThemes = catalog.filter((theme) => !theme.legacy);
  const legacyThemes = catalog.filter((theme) => theme.legacy);
  const fragment = document.createDocumentFragment();

  if (currentThemes.length) {
    fragment.appendChild(createThemeSection("Current Themes", currentThemes));
  }

  if (legacyThemes.length) {
    fragment.appendChild(createThemeSection("Unused Themes", legacyThemes));
  }

  el.replaceChildren(fragment);
  el.dataset.rendered = "true";
  setThemeOptions(selectedTheme);
}

function flashSaved(text) {
  const saved = document.getElementById("savedHint");
  if (!saved) return;

  saved.textContent = text;
  clearTimeout(saved._t);
  saved._t = setTimeout(() => (saved.textContent = ""), 900);
}

function setStatus(on) {
  const el = document.getElementById("settingsStatus");
  if (!el) return;

  el.textContent = on ? "Vault enabled" : "Vault disabled";
}

function setSwitch(btn, on) {
  if (!btn) return;

  btn.classList.toggle("on", !!on);
  btn.setAttribute("aria-checked", String(!!on));
}

function applyVaultUi(on) {
  const openVault = document.getElementById("openVault");
  if (openVault) openVault.disabled = !on;

  setStatus(on);
}

function setThemeHint(theme) {
  const el = document.getElementById("themeHint");
  if (!el) return;

  el.textContent = `Current: ${themeLabel(theme)}`;
}

function setThemeOptions(theme) {
  const cleanTheme = normalizeTheme(theme);
  selectedTheme = cleanTheme;
  const buttons = document.querySelectorAll(".theme-option[data-theme]");

  buttons.forEach((btn) => {
    const on = btn.dataset.theme === cleanTheme;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-checked", String(on));
  });

  setThemeHint(cleanTheme);

  if (DEFAULT_THEME_ACCENTS[cleanTheme]) {
    updateAccentPreview(cleanTheme, getAccentColor(cleanTheme));
  }
}

function setActiveTab(tabName) {
  const clean = normalizeTab(tabName);

  document.querySelectorAll(".tab[data-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === clean);
  });

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  const page = document.getElementById(`page-${clean}`);
  if (page) page.classList.add("active");

  if (clean === "plugins") checkPinsBoardsPlugin();
}

function setPluginState(text, state) {
  const el = document.getElementById("pinsBoardsPluginState");
  const installBtn = document.getElementById("installPinsBoardsPlugin");
  const toggleBtn = document.getElementById("togglePinsBoardsPlugin");
  if (!el) return;

  el.textContent = text;
  el.dataset.state = state || "unknown";

  if (installBtn) {
    installBtn.hidden = IS_FIREFOX || state === "installed" || state === "disabled";
  }

  if (toggleBtn) {
    const canToggle = state === "installed" || state === "disabled";
    toggleBtn.hidden = !canToggle;
    toggleBtn.disabled = false;
    toggleBtn.dataset.nextEnabled = state === "disabled" ? "true" : "false";
    toggleBtn.textContent = state === "disabled" ? "Enable add-on" : "Disable add-on";
  }
}

function checkPinsBoardsPlugin() {
  if (IS_FIREFOX) {
    setPluginState("This optional add-on is Chromium-only. Themes and Vault work without it.", "unsupported");
    return;
  }
  if (!chrome.management?.get) {
    setPluginState("Install detection is not available in this browser.", "unknown");
    return;
  }

  setPluginState("Checking install status...", "checking");

  chrome.management.get(PINS_BOARDS_ADDON_ID, (info) => {
    const err = chrome.runtime.lastError;

    if (err || !info) {
      setPluginState("Not installed. Open the official Chrome Web Store page to add it.", "missing");
      return;
    }

    if (info.enabled === false) {
      setPluginState("Installed, but currently disabled in Chrome extensions.", "disabled");
      return;
    }

    setPluginState("Installed and enabled.", "installed");
  });
}

function setPinsBoardsPluginEnabled(enabled) {
  if (IS_FIREFOX) return;
  if (!chrome.management?.setEnabled) {
    setPluginState("Enable/disable is not available in this browser.", "unknown");
    return;
  }

  const toggleBtn = document.getElementById("togglePinsBoardsPlugin");
  if (toggleBtn) {
    toggleBtn.disabled = true;
    toggleBtn.textContent = enabled ? "Enabling..." : "Disabling...";
  }

  chrome.management.setEnabled(PINS_BOARDS_ADDON_ID, !!enabled, () => {
    const err = chrome.runtime.lastError;

    if (err) {
      setPluginState(`Could not update add-on: ${err.message}`, "unknown");
      return;
    }

    checkPinsBoardsPlugin();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const vaultSwitch = document.getElementById("vaultSwitch");
  const themeOptions = document.getElementById("themeOptions");

  const openVault = document.getElementById("openVault");
  const resetVault = document.getElementById("resetVault");
  const closeTab = document.getElementById("closeTab");
  const checkPinsBoardsPluginBtn = document.getElementById("checkPinsBoardsPlugin");
  const togglePinsBoardsPluginBtn = document.getElementById("togglePinsBoardsPlugin");
  const installPinsBoardsPluginBtn = document.getElementById("installPinsBoardsPlugin");
  const openPinterestPreview = document.getElementById("openPinterestPreview");

  // Tabs
  document.querySelectorAll(".tab[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveTab(btn.dataset.tab);
    });

    btn.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      setActiveTab(btn.dataset.tab);
    });
  });

  chrome.storage.sync.get(
    {
      [KEY_VAULT_ENABLED]: true,
      [KEY_THEME]: "amoled",
      [KEY_THEME_ACCENTS]: {},
    },
    (d) => {
      const vaultOn = !!d[KEY_VAULT_ENABLED];
      const theme = normalizeTheme(d[KEY_THEME]);
      accentColors = d[KEY_THEME_ACCENTS] && typeof d[KEY_THEME_ACCENTS] === "object"
        ? d[KEY_THEME_ACCENTS]
        : {};

      setSwitch(vaultSwitch, vaultOn);
      applyVaultUi(vaultOn);
      Object.keys(ACCENT_FIELDS).forEach(updateAccentFields);
      renderThemeOptions(theme);
    }
  );

  Object.entries(ACCENT_FIELDS).forEach(([theme, fields]) => {
    const picker = document.getElementById(fields.picker);
    const hex = document.getElementById(fields.hex);

    picker?.addEventListener("input", () => {
      hex.value = picker.value.toUpperCase();
      hex.classList.remove("invalid");
      previewAccent(theme, picker.value);
      queueAccentSave(theme, picker.value);
    });

    picker?.addEventListener("change", () => saveAccent(theme, picker.value));

    hex?.addEventListener("input", () => {
      const color = normalizeHexColor(hex.value);
      hex.classList.toggle("invalid", !color);
      if (!color) return;

      picker.value = color;
      previewAccent(theme, color);
      queueAccentSave(theme, color);
    });

    const commitHex = () => {
      const color = normalizeHexColor(hex.value);
      if (!color) {
        updateAccentFields(theme);
        updateAccentPreview(theme, getAccentColor(theme));
        broadcastAccentPreview(theme, accentColors[theme] || null);
        return;
      }

      saveAccent(theme, color);
    };

    hex?.addEventListener("change", commitHex);
    hex?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      commitHex();
      hex.blur();
    });
  });

  document.querySelectorAll("[data-reset-accent]").forEach((btn) => {
    btn.addEventListener("click", () => resetAccent(btn.dataset.resetAccent));
  });

  openPinterestPreview?.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.pinterest.com/", active: true });
  });

  // Vault toggle
  if (vaultSwitch) {
    function saveVault(on) {
      chrome.storage.sync.set({ [KEY_VAULT_ENABLED]: !!on }, () => {
        flashSaved("Saved");
        applyVaultUi(!!on);
      });
    }

    function setVaultAll(on) {
      setSwitch(vaultSwitch, on);
      applyVaultUi(on);
    }

    vaultSwitch.addEventListener("click", () => {
      const next = vaultSwitch.getAttribute("aria-checked") !== "true";
      setVaultAll(next);
      saveVault(next);
    });

    vaultSwitch.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      vaultSwitch.click();
    });
  }

  // Theme buttons
  if (themeOptions) {
    themeOptions.addEventListener("click", (e) => {
      const btn = e.target.closest(".theme-option[data-theme]");
      if (!btn) return;

      const theme = normalizeTheme(btn.dataset.theme);
      setThemeOptions(theme);

      chrome.storage.sync.set({ [KEY_THEME]: theme }, () => {
        flashSaved("Saved");
        setThemeHint(theme);
      });
    });

    themeOptions.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;

      const btn = e.target.closest(".theme-option[data-theme]");
      if (!btn) return;

      e.preventDefault();
      btn.click();
    });
  }

  // Live sync updates
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;

    if (changes[KEY_VAULT_ENABLED]) {
      const on = !!changes[KEY_VAULT_ENABLED].newValue;
      setSwitch(vaultSwitch, on);
      applyVaultUi(on);
    }

    if (changes[KEY_THEME]) {
      const theme = normalizeTheme(changes[KEY_THEME].newValue);
      setThemeOptions(theme);
    }

    if (changes[KEY_THEME_ACCENTS]) {
      const next = changes[KEY_THEME_ACCENTS].newValue;
      accentColors = next && typeof next === "object" ? next : {};
      Object.keys(ACCENT_FIELDS).forEach(updateAccentFields);
      updateAccentPreview(accentPreviewTheme, getAccentColor(accentPreviewTheme));
    }
  });

  if (openVault) {
    openVault.addEventListener("click", () => {
      const url = chrome.runtime.getURL("vault.html");
      window.open(url, "_blank");
    });
  }

  if (checkPinsBoardsPluginBtn) {
    checkPinsBoardsPluginBtn.addEventListener("click", checkPinsBoardsPlugin);
  }

  if (togglePinsBoardsPluginBtn) {
    togglePinsBoardsPluginBtn.addEventListener("click", () => {
      setPinsBoardsPluginEnabled(togglePinsBoardsPluginBtn.dataset.nextEnabled === "true");
    });
  }

  if (installPinsBoardsPluginBtn) {
    installPinsBoardsPluginBtn.addEventListener("click", () => {
      if (IS_FIREFOX) return;
      window.open(PINS_BOARDS_ADDON_URL, "_blank", "noopener,noreferrer");
    });
  }

  if (resetVault) {
    resetVault.addEventListener("click", () => {
      const ok = confirm("Clear ALL Vault items? This cannot be undone.");
      if (!ok) return;

      chrome.storage.local.set({ [VAULT_KEY]: [] }, () => flashSaved("Vault cleared"));
    });
  }

  if (closeTab) {
    closeTab.addEventListener("click", () => window.close());
  }
});
