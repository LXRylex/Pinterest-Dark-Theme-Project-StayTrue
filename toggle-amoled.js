const CSS_ID = "pinterest-amoled-css-link";
const THEME_VARS_ID = "pinterest-theme-vars-xzen";
const DIM_ID = "pinterest-dim-overlay-xzen";

let enabledCache = false;
let dimCache = 0;

const KEY_VAULT_ENABLED = "pinterestVaultEnabled";
let vaultEnabledCache = true;

const KEY_THEME = "pinterestTheme";
let themeCache = "amoled";

const KEY_THEME_ACCENTS = "pinterestThemeAccentColors";
const KEY_THEME_ACCENT_PREVIEW = "pinterestThemeAccentPreview";
let themeAccentCache = {};
const appliedThemeVarNames = new Set();
let extensionContextStopped = false;
let reinjectObserver = null;

function stopExtensionContext() {
  extensionContextStopped = true;
  reinjectObserver?.disconnect();
}

function extensionContextIsActive() {
  if (extensionContextStopped) return false;
  if (globalThis.chrome?.runtime?.id) return true;
  stopExtensionContext();
  return false;
}

const FALLBACK_THEME_CATALOG = [
  { id: "amoled", cssFile: "amoled.css", customizableAccent: true, defaultAccent: "#B38AFF" },
  { id: "amoled-v2", cssFile: "amoled-v2.css", customizableAccent: true, defaultAccent: "#8E6BFF" },
  { id: "gray", cssFile: "gray.css" },
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

function getHeadOrRoot() {
  return document.head || document.documentElement;
}

function cssFileForTheme(t) {
  const theme = getThemeDef(normalizeTheme(t));
  return theme?.cssFile || "amoled.css";
}

function removeThemeVars() {
  const el = document.getElementById(THEME_VARS_ID);
  if (el) el.remove();

  for (const name of appliedThemeVarNames) {
    document.documentElement.style.removeProperty(name);
  }
  appliedThemeVarNames.clear();
}

function normalizeHexColor(value) {
  const match = String(value || "").trim().match(/^#?([0-9a-f]{6})$/i);
  return match ? `#${match[1].toUpperCase()}` : "";
}

function accentVarsForTheme(theme, overrideColor) {
  if (!theme || !["amoled", "amoled-v2"].includes(theme.id)) return {};

  const storedColor = arguments.length > 1 ? overrideColor : themeAccentCache[theme.id];
  const accent = normalizeHexColor(storedColor);
  if (!accent) return {};

  const red = parseInt(accent.slice(1, 3), 16);
  const green = parseInt(accent.slice(3, 5), 16);
  const blue = parseInt(accent.slice(5, 7), 16);
  const rgba = (alpha) => `rgba(${red}, ${green}, ${blue}, ${alpha})`;

  return {
    accent,
    "accent-rgb": `${red}, ${green}, ${blue}`,
    "accent-soft": rgba(0.18),
    "accent-soft-22": rgba(0.22),
    "accent-glow": rgba(0.55),
    "accent-dark-60": rgba(0.60),
    "accent-70": rgba(0.70),
    "accent-85": rgba(0.85),
    "accent-90": rgba(0.90),
    "accent-95": rgba(0.95),
  };
}

function applyThemeVars(theme, overrideColor) {
  const accentVars = arguments.length > 1
    ? accentVarsForTheme(theme, overrideColor)
    : accentVarsForTheme(theme);
  const vars = { ...(theme?.vars || {}), ...accentVars };

  if (!Object.keys(vars).length) {
    removeThemeVars();
    return;
  }

  const cssVars = Object.entries(vars)
    .map(([key, value]) => `--pdt-${key}: ${value} !important;`)
    .join("");

  for (const [key, value] of Object.entries(vars)) {
    const name = `--pdt-${key}`;
    document.documentElement.style.setProperty(name, value, "important");
    appliedThemeVarNames.add(name);
  }

  let style = document.getElementById(THEME_VARS_ID);

  if (!style) {
    style = document.createElement("style");
    style.id = THEME_VARS_ID;
    style.setAttribute("data-xzen", "theme-vars");
    getHeadOrRoot().appendChild(style);
  }

  style.textContent = `:root{${cssVars}}`;
}

function injectCss(theme = "amoled") {
  if (!extensionContextIsActive()) return false;
  const cleanTheme = normalizeTheme(theme);
  const themeDef = getThemeDef(cleanTheme);
  const file = cssFileForTheme(cleanTheme);
  let wantHref;
  try {
    wantHref = chrome.runtime.getURL(file);
  } catch (error) {
    // An open tab can outlive an extension reload/update.
    if (!/extension context invalidated/i.test(error?.message || "")) throw error;
    stopExtensionContext();
    return false;
  }

  let link = document.getElementById(CSS_ID);

  if (!link) {
    link = document.createElement("link");
    link.id = CSS_ID;
    link.rel = "stylesheet";
    link.setAttribute("data-xzen", "amoled");
    getHeadOrRoot().appendChild(link);
  }

  if (link.href !== wantHref) link.href = wantHref;
  applyThemeVars(themeDef);
  return true;
}

function removeCss() {
  const el = document.getElementById(CSS_ID);
  if (el) el.remove();
  removeThemeVars();
}

function ensureDimOverlay() {
  let el = document.getElementById(DIM_ID);
  if (el) return el;

  el = document.createElement("div");
  el.id = DIM_ID;

  el.style.position = "fixed";
  el.style.inset = "0";
  el.style.background = "#000";
  el.style.opacity = "0";
  el.style.pointerEvents = "none";
  el.style.zIndex = "2147483647";
  el.style.transition = "opacity 120ms linear";

  document.documentElement.appendChild(el);
  return el;
}

function setDim(level) {
  const el = ensureDimOverlay();
  const n = Math.max(0, Math.min(80, Number(level) || 0));
  el.style.opacity = String(n / 100);
}

/* ===================== XZEN CREDIT ===================== */
const CREDIT_ID = "xzen-amoled-credit-item";
const CREDIT_COLOR = "var(--pdt-accent, #B38AFF)";

function removeCredit() {
  const el = document.getElementById(CREDIT_ID);
  if (el) el.remove();
}

function ensureCreditInjected() {
  if (!enabledCache) return;
  if (document.getElementById(CREDIT_ID)) return;

  const resources = document.querySelector('[aria-label="Resources"]');
  if (!resources) return;

  let list =
    resources.querySelector('[role="listitem"]')?.parentElement ||
    resources.querySelector(".ADXRXN.Tjcf3c.gSktR2.rT2FEs.zEVE_X") ||
    resources;

  if (!list) return;

  const item = document.createElement("div");
  item.id = CREDIT_ID;
  item.setAttribute("role", "listitem");
  item.className = "ADXRXN";

  const a = document.createElement("a");
  a.href = "https://github.com/LXRylex/TrueAMOLED-Projext-Pinterest/issues";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.setAttribute("aria-label", "Report Bugs Here");
  a.textContent = "Report Bugs Here";

  a.style.display = "inline";
  a.style.padding = "0";
  a.style.margin = "0";
  a.style.border = "0";
  a.style.background = "transparent";
  a.style.boxShadow = "none";
  a.style.borderRadius = "0";
  a.style.textDecoration = "none";
  a.style.color = CREDIT_COLOR;
  a.style.fontSize = "12px";
  a.style.fontWeight = "600";
  a.style.lineHeight = "1.2";
  a.style.opacity = "0.9";

  a.addEventListener("mouseenter", () => {
    a.style.opacity = "1";
    a.style.textDecoration = "underline";
  });

  a.addEventListener("mouseleave", () => {
    a.style.opacity = "0.9";
    a.style.textDecoration = "none";
  });

  item.appendChild(a);
  list.appendChild(item);
}

let creditTicking = false;

function scheduleEnsureCredit() {
  if (!extensionContextIsActive()) return;
  if (creditTicking) return;

  creditTicking = true;
  requestAnimationFrame(() => {
    creditTicking = false;
    if (!extensionContextIsActive()) return;
    ensureCreditInjected();
  });
}

/* ===================== VAULT ===================== */
const VAULT_KEY = "xzenVaultItems";
const VAULT_BTN_CLASS = "xzen-vault-save-btn";
const VAULT_SAVED_CLASS = "xzen-vault-saved";
const VAULT_HOME_BTN_CLASS = "xzen-vault-home-save-btn";
const VAULT_PIN_BTN_CLASS = "xzen-vault-pin-save-btn";
const VAULT_CLOSEUP_BTN_CLASS = "xzen-vault-closeup-save-btn";
const VAULT_CLOSEUP_CONTAINER_CLASS = "xzen-vault-closeup-container";
const VAULT_CONTAINER_CLASS = "xzen-vault-container";
const VAULT_STYLE_ID = "xzen-vault-style";
const TOAST_ID = "xzen-vault-toast";

function removeVaultButtonIfExists() {
  document.querySelectorAll(`.${VAULT_CONTAINER_CLASS}, .${VAULT_BTN_CLASS}`).forEach((el) => {
    const wrapper =
      el.closest(`.${VAULT_CONTAINER_CLASS}`) ||
      el.closest('[data-xzen-vault-container="true"]') ||
      el;

    wrapper.remove();
  });
}

function ensureVaultStyles() {
  if (document.getElementById(VAULT_STYLE_ID)) return;

  const css = `
#${TOAST_ID}{
  position: fixed;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  z-index: 2147483647;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.78);
  color: #fff;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: .01em;
  box-shadow: 0 16px 38px rgba(0,0,0,.55);
  opacity: 0;
  pointer-events: none;
  transition: opacity .14s ease, transform .14s ease;
}

#${TOAST_ID}.show{
  opacity: 1;
  transform: translateX(-50%) translateY(-2px);
}

.${VAULT_CONTAINER_CLASS}{
  pointer-events: auto !important;
}

.${VAULT_BTN_CLASS}{
  z-index: 30 !important;
}

.${VAULT_BTN_CLASS} *{
  white-space: nowrap !important;
}

/* Saved state */
.${VAULT_BTN_CLASS}.${VAULT_SAVED_CLASS} .VHreRh,
.${VAULT_BTN_CLASS}.${VAULT_SAVED_CLASS} > div,
.${VAULT_BTN_CLASS}.${VAULT_SAVED_CLASS} .dBMCN4{
  background: rgba(0, 0, 0, 0.35) !important;
  box-shadow: inset 0 0 0 1px #000000, 0 0 10px rgba(0, 0, 0, 0.45) !important;
}

/* Homepage pin-card button */
.${VAULT_HOME_BTN_CLASS}{
  position: absolute !important;
  right: 60px !important;
  bottom: 10px !important;
  min-width: 74px !important;
  width: auto !important;
  max-width: 92px !important;
  height: 34px !important;
  padding: 0 12px !important;
  border-radius: 999px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  box-shadow: 0 10px 24px rgba(0,0,0,.38) !important;
  opacity: 0 !important;
  pointer-events: none !important;
  transition: opacity .15s ease, transform .15s ease !important;
}

[data-test-id="pin"]:hover .${VAULT_HOME_BTN_CLASS}{
  opacity: 1 !important;
  pointer-events: auto !important;
}

.${VAULT_HOME_BTN_CLASS}:hover{
  transform: translateY(-1px);
}

/* Hide homepage button if Pinterest reuses a pin card inside closeup */
[data-test-id="closeup-action-bar"] .${VAULT_HOME_BTN_CLASS},
[data-test-id="closeupActionBar"] .${VAULT_HOME_BTN_CLASS},
[data-test-id="closeup-visual-container"] .${VAULT_HOME_BTN_CLASS},
[data-test-id="pin-closeup"] .${VAULT_HOME_BTN_CLASS},
[data-test-id="closeup-container"] .${VAULT_HOME_BTN_CLASS}{
  display: none !important;
}

/* Regular opened pin fallback button */
.${VAULT_PIN_BTN_CLASS}{
  position: static !important;
  right: auto !important;
  bottom: auto !important;
  margin-left: 8px !important;
}

/* Closeup top action-bar Vault button */
.${VAULT_CLOSEUP_CONTAINER_CLASS}{
  display: flex !important;
  align-items: center !important;
  flex: 0 0 auto !important;
  margin-left: 8px !important;
}

.${VAULT_CLOSEUP_BTN_CLASS}{
  all: unset !important;
  cursor: pointer !important;
  display: inline-flex !important;
}

.${VAULT_CLOSEUP_BTN_CLASS} .VHreRh{
  background: #000000 !important;
  border-radius: 999px !important;
  height: 48px !important;
  width: 48px !important;
}

.${VAULT_CLOSEUP_BTN_CLASS}:hover .VHreRh{
  background: rgba(var(--pdt-accent-rgb, 142, 107, 255), 0.18) !important;
  box-shadow: inset 0 0 0 1px var(--pdt-accent, #8E6BFF) !important;
}

.${VAULT_CLOSEUP_BTN_CLASS}.${VAULT_SAVED_CLASS} .VHreRh{
  background: rgba(0, 0, 0, 0.35) !important;
  box-shadow: inset 0 0 0 1px #000000, 0 0 10px rgba(0, 0, 0, 0.45) !important;
}

.${VAULT_CLOSEUP_BTN_CLASS} svg,
.${VAULT_CLOSEUP_BTN_CLASS} svg *{
  fill: #ffffff !important;
  stroke: #ffffff !important;
}
`.trim();

  const style = document.createElement("style");
  style.id = VAULT_STYLE_ID;
  style.textContent = css;
  getHeadOrRoot().appendChild(style);
}

function showToast(text) {
  let t = document.getElementById(TOAST_ID);

  if (!t) {
    t = document.createElement("div");
    t.id = TOAST_ID;
    document.documentElement.appendChild(t);
  }

  t.textContent = text;
  t.classList.add("show");

  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(() => t.classList.remove("show"), 900);
}

function meta(nameOrProp) {
  const m1 = document.querySelector(`meta[property="${nameOrProp}"]`);
  if (m1?.content) return m1.content;

  const m2 = document.querySelector(`meta[name="${nameOrProp}"]`);
  if (m2?.content) return m2.content;

  return "";
}

function absUrl(href) {
  try {
    return new URL(href, location.origin).href;
  } catch {
    return "";
  }
}

function pickLargestFromSrcset(srcset) {
  const s = String(srcset || "").trim();
  if (!s) return "";

  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);

  let bestUrl = "";
  let bestScore = -1;

  for (const part of parts) {
    const [urlRaw, sizeRaw] = part.split(/\s+/);
    const url = (urlRaw || "").trim();
    const size = (sizeRaw || "").trim().toLowerCase();

    let score = 0;
    const mx = size.match(/^(\d+(?:\.\d+)?)x$/);
    const mw = size.match(/^(\d+(?:\.\d+)?)w$/);

    if (mx) score = Number(mx[1]) * 1000;
    else if (mw) score = Number(mw[1]);
    else score = 1;

    if (score > bestScore) {
      bestScore = score;
      bestUrl = url;
    }
  }

  return bestUrl;
}

function toOriginalPinImg(u) {
  const url = String(u || "").trim();
  // Keep the exact CDN URL that Pinterest already loaded successfully.
  // Not every /736x/ or /1200x/ image has a readable /originals/ variant.
  return url;
}

function cleanTitle(t) {
  let s = String(t || "").trim();
  if (!s) return "";

  s = s.replace(/^This contains an image of:\s*/i, "").trim();
  return s.slice(0, 180);
}

function getScopeFromButton(btn) {
  const pinCard = btn?.closest('[data-test-id="pin"]');
  if (pinCard) return pinCard;

  return (
    btn?.closest('[data-test-id="pin-closeup"]') ||
    btn?.closest('[data-test-id="closeup-container"]') ||
    btn?.closest('[data-test-id="closeup-body-image-container"]') ||
    btn?.closest('[data-test-id="visual-content-container"]') ||
    btn?.closest('[data-test-id="better-save"]') ||
    document
  );
}

function findPinUrlFromScope(scope) {
  const a = scope.querySelector('a[href*="/pin/"]');
  const href = a?.getAttribute("href") || "";

  if (href && href.includes("/pin/")) return absUrl(href);

  const og = meta("og:url");
  if (og && og.includes("/pin/")) return og;

  const canon = document.querySelector('link[rel="canonical"]')?.href || "";
  if (canon.includes("/pin/")) return canon;

  return "";
}

function persistableVideoUrl(...urls) {
  for (const raw of urls) {
    const url = String(raw || "").trim();
    if (/^https?:\/\//i.test(url)) return url;
  }
  return "";
}

function pickBestVideoFromScope(scope) {
  const vids = Array.from(scope.querySelectorAll("video")).filter((v) => {
    const r = v.getBoundingClientRect();
    return r.width >= 120 && r.height >= 120;
  });

  if (!vids.length) return "";

  let best = vids[0];
  let bestScore = 0;

  for (const v of vids) {
    const r = v.getBoundingClientRect();
    const score = r.width * r.height;

    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }

  const sourceUrls = Array.from(best.querySelectorAll("source")).flatMap((source) => [
    source.currentSrc,
    source.src,
    source.getAttribute("src"),
    source.getAttribute("data-src"),
  ]);

  return persistableVideoUrl(
    best.currentSrc,
    best.src,
    best.getAttribute("src"),
    best.getAttribute("data-src"),
    best.getAttribute("data-video-url"),
    ...sourceUrls
  );
}

function pickBestImageFromScope(scope) {
  const imgs = Array.from(scope.querySelectorAll("img")).filter((img) => {
    const src = img.currentSrc || img.src || "";
    if (!src) return false;

    const r = img.getBoundingClientRect();
    const w = Math.max(r.width, img.naturalWidth || 0);
    const h = Math.max(r.height, img.naturalHeight || 0);

    return w >= 80 && h >= 80;
  });

  let bestUrl = "";
  let bestScore = 0;

  for (const img of imgs) {
    const url =
      pickLargestFromSrcset(img.getAttribute("srcset")) ||
      (img.currentSrc || img.src || "").trim();

    const r = img.getBoundingClientRect();
    const w = Math.max(r.width, img.naturalWidth || 0);
    const h = Math.max(r.height, img.naturalHeight || 0);
    const score = w * h;

    if (score > bestScore) {
      bestScore = score;
      bestUrl = url;
    }
  }

  return bestUrl;
}

function guessTypeFromUrl(u) {
  const x = (u || "").toLowerCase();

  if (x.includes(".gif")) return "gif";
  if (x.includes(".mp4") || x.includes(".webm") || x.includes("video")) return "video";

  return "image";
}

function getTitleFromScope(scope) {
  const footerA =
    scope.querySelector('[data-test-id="pinrep-footer-organic-title"] a') ||
    scope.querySelector('a[aria-label*=" pin page"]');

  const t1 = footerA?.textContent?.trim() || "";
  if (t1) return cleanTitle(t1);

  const pinA = scope.querySelector('a[href*="/pin/"]');
  const t2 = pinA?.getAttribute("aria-label") || "";
  if (t2) return cleanTitle(t2.replace(/\s*pin page\s*$/i, ""));

  const img = scope.querySelector("img");
  const t3 = img?.getAttribute("alt") || "";
  if (t3) return cleanTitle(t3);

  return "";
}

function getPinPreviewFromButton(btn) {
  const scope = getScopeFromButton(btn);

  const pinUrl = findPinUrlFromScope(scope) || location.href;

  const title =
    getTitleFromScope(scope) ||
    cleanTitle(meta("og:title") || meta("twitter:title") || document.title || "Pinterest");

  const videoUrl =
    pickBestVideoFromScope(scope) ||
    persistableVideoUrl(
      meta("og:video:secure_url"),
      meta("og:video"),
      meta("twitter:player:stream")
    );

  const imageUrl =
    pickBestImageFromScope(scope) ||
    (meta("og:image") || meta("twitter:image") || "").trim();

  const mediaUrlRaw = (videoUrl || imageUrl || "").trim();
  const mediaType = videoUrl ? "video" : guessTypeFromUrl(mediaUrlRaw);

  const bestImage = toOriginalPinImg(imageUrl);
  const bestMedia = mediaType === "video" ? mediaUrlRaw : toOriginalPinImg(mediaUrlRaw);

  const thumb = bestImage || (mediaType !== "video" ? bestMedia : "");

  return {
    url: pinUrl,
    title,
    thumb,
    mediaUrl: bestMedia,
    mediaType,
    site: "pinterest.com",
    savedAt: Date.now(),
  };
}

function saveToVault(item) {
  chrome.storage.local.get({ [VAULT_KEY]: [] }, (data) => {
    const arr = Array.isArray(data[VAULT_KEY]) ? data[VAULT_KEY] : [];
    const i = arr.findIndex((x) => x && x.url === item.url);

    if (i >= 0) arr[i] = { ...arr[i], ...item, savedAt: Date.now() };
    else arr.unshift(item);

    chrome.storage.local.set({ [VAULT_KEY]: arr }, () => {
      if (chrome.runtime.lastError) {
        showToast("Vault save failed");
        return;
      }

      showToast("Saved to Vault");
    });
  });
}

function markVaultButtonSaved(btn) {
  if (!btn) return;
  btn.classList.add(VAULT_SAVED_CLASS);
  btn.setAttribute("aria-pressed", "true");
}

function makeVaultContainerFromNative(nativeContainer, mode) {
  const container = nativeContainer.cloneNode(true);

  container.removeAttribute("data-test-id");
  container.classList.add(VAULT_CONTAINER_CLASS);
  container.setAttribute("data-xzen-vault-container", "true");

  const btn = container.querySelector("button");
  if (!btn) return null;

  btn.removeAttribute("id");
  btn.classList.add(VAULT_BTN_CLASS);

  if (mode === "home") {
    btn.classList.add(VAULT_HOME_BTN_CLASS);
  } else if (mode === "closeup") {
    btn.classList.add(VAULT_CLOSEUP_BTN_CLASS);
  } else {
    btn.classList.add(VAULT_PIN_BTN_CLASS);
  }

  btn.type = "button";
  btn.setAttribute("aria-label", "Save to Vault");

  const labelEl =
    container.querySelector(".lIkAnG") ||
    (() => {
      const nodes = Array.from(container.querySelectorAll("div, span"));
      for (const n of nodes) {
        if (!n.children.length && (n.textContent || "").trim()) return n;
      }
      return null;
    })();

  if (labelEl) {
    labelEl.textContent = "Save";
    labelEl.style.whiteSpace = "nowrap";
  }

  btn.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      const item = getPinPreviewFromButton(btn);
      saveToVault(item);
      markVaultButtonSaved(btn);

      if (labelEl) {
        const old = labelEl.textContent;
        labelEl.textContent = "Saved ✓";
        setTimeout(() => (labelEl.textContent = old), 900);
      }
    },
    true
  );

  return container;
}

function makeCloseupActionVaultButton() {
  const item = document.createElement("div");
  item.className = `${VAULT_CONTAINER_CLASS} ${VAULT_CLOSEUP_CONTAINER_CLASS}`;
  item.setAttribute("data-xzen-vault-container", "true");

  item.innerHTML = `
    <div role="listitem" class="ADXRXN">
      <div class="ADXRXN DTsIgD">
        <div aria-label="Save to Vault" class="ADXRXN">
          <button aria-label="Save to Vault" class="euRXRl ${VAULT_BTN_CLASS} ${VAULT_CLOSEUP_BTN_CLASS}" type="button" aria-pressed="false">
            <div class="dVx3J_ Q3hcOU mm_g7v">
              <div class="VHreRh kHGn_J XjRT60" style="height:48px;width:48px;">
                <svg aria-hidden="true" class="aTSQd5 hL9n03 _ByyDT" height="24" role="img" viewBox="0 0 24 24" width="24">
                  <path d="M5 3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v20l-7-4-7 4z"></path>
                </svg>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  `;

  const btn = item.querySelector("button");

  btn.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      const dataBtn =
        document.querySelector('[data-test-id="closeup-action-bar"] [data-test-id="PinBetterSaveButton"] button') ||
        btn;

      const itemData = getPinPreviewFromButton(dataBtn);
      saveToVault(itemData);
      markVaultButtonSaved(btn);
    },
    true
  );

  return item;
}

function injectVaultButton() {
  if (!vaultEnabledCache) return;

  ensureVaultStyles();

  const saveBlocks = document.querySelectorAll('[data-test-id="pin-better-save-button"]');
  if (!saveBlocks.length) return;

  saveBlocks.forEach((saveBlock) => {
    const nativeContainer = saveBlock.querySelector('[data-test-id="PinBetterSaveButton"]');
    if (!nativeContainer) return;

    const closeup =
      saveBlock.closest('[data-test-id="closeup-action-bar"]') ||
      saveBlock.closest('[data-test-id="closeupActionBar"]') ||
      saveBlock.closest('[data-test-id="pin-closeup"]') ||
      saveBlock.closest('[data-test-id="closeup-container"]');

    const pinCard = saveBlock.closest('[data-test-id="pin"]');

    const isCloseup = !!closeup;
    const isHomeCard = !!pinCard && !isCloseup;

    if (isHomeCard) {
      if (pinCard.querySelector(`.${VAULT_HOME_BTN_CLASS}`)) return;

      const imageWrapper =
        pinCard.querySelector(".PinCard__imageWrapper") ||
        pinCard.querySelector('[data-test-id="pinWrapper"]');

      if (!imageWrapper) return;

      imageWrapper.style.position = "relative";

      const vaultContainer = makeVaultContainerFromNative(nativeContainer, "home");
      if (!vaultContainer) return;

      imageWrapper.appendChild(vaultContainer);
      return;
    }

    if (isCloseup) {
      if (document.querySelector(`.${VAULT_CLOSEUP_BTN_CLASS}`)) return;

      const moreOptions =
        closeup.querySelector('[data-test-id="closeup-more-options"]') ||
        document.querySelector('[data-test-id="closeup-more-options"]');
      if (!moreOptions) return;

      const moreButtonWrap = moreOptions.closest(".FlexItem_x") || moreOptions;
      if (!moreButtonWrap.parentElement) return;

      const vaultButton = makeCloseupActionVaultButton();
      moreButtonWrap.insertAdjacentElement("afterend", vaultButton);

      return;
    }

    if (saveBlock.querySelector(`.${VAULT_PIN_BTN_CLASS}`)) return;

    const parent = nativeContainer.parentElement;
    if (!parent) return;

    const vaultContainer = makeVaultContainerFromNative(nativeContainer, "pin");
    if (!vaultContainer) return;

    parent.appendChild(vaultContainer);
  });
}

let vaultTick = false;

function scheduleVaultInject() {
  if (!extensionContextIsActive()) return;
  if (!vaultEnabledCache) return;
  if (vaultTick) return;

  vaultTick = true;
  requestAnimationFrame(() => {
    vaultTick = false;
    if (!extensionContextIsActive()) return;
    injectVaultButton();
  });
}

/* ===================== /VAULT ===================== */

function apply() {
  if (!extensionContextIsActive()) return;
  if (enabledCache) {
    if (!injectCss(themeCache)) return;
    scheduleEnsureCredit();
  } else {
    removeCss();
    removeCredit();
  }

  setDim(enabledCache ? dimCache : 0);
}

function loadStateAndApply() {
  chrome.storage.sync.get(
    {
      pinterestAmoledEnabled: false,
      pinterestDimLevel: 0,
      [KEY_VAULT_ENABLED]: true,
      [KEY_THEME]: "amoled",
      [KEY_THEME_ACCENTS]: {},
    },
    (data) => {
      if (!extensionContextIsActive()) return;
      enabledCache = !!data.pinterestAmoledEnabled;
      dimCache = Number(data.pinterestDimLevel) || 0;
      vaultEnabledCache = !!data[KEY_VAULT_ENABLED];
      themeCache = normalizeTheme(data[KEY_THEME]);
      themeAccentCache = data[KEY_THEME_ACCENTS] && typeof data[KEY_THEME_ACCENTS] === "object"
        ? data[KEY_THEME_ACCENTS]
        : {};

      apply();

      if (vaultEnabledCache) scheduleVaultInject();
      else removeVaultButtonIfExists();
    }
  );
}

loadStateAndApply();

chrome.storage.onChanged.addListener((changes, area) => {
  if (!extensionContextIsActive()) return;
  if (area === "local" && changes[KEY_THEME_ACCENT_PREVIEW]) {
    const preview = changes[KEY_THEME_ACCENT_PREVIEW].newValue;
    const previewTheme = normalizeTheme(preview?.theme);
    if (enabledCache && ["amoled", "amoled-v2"].includes(previewTheme)) {
      themeCache = previewTheme;
      if (!injectCss(themeCache)) return;
      applyThemeVars(getThemeDef(themeCache), preview.color);
    }
    return;
  }

  if (area !== "sync") return;

  let shouldReapply = false;

  if (changes.pinterestAmoledEnabled) {
    enabledCache = !!changes.pinterestAmoledEnabled.newValue;
    shouldReapply = true;
  }

  if (changes.pinterestDimLevel) {
    dimCache = Number(changes.pinterestDimLevel.newValue) || 0;
    shouldReapply = true;
  }

  if (changes[KEY_THEME]) {
    themeCache = normalizeTheme(changes[KEY_THEME].newValue);
    if (enabledCache) injectCss(themeCache);
  }

  if (changes[KEY_THEME_ACCENTS]) {
    const next = changes[KEY_THEME_ACCENTS].newValue;
    themeAccentCache = next && typeof next === "object" ? next : {};
    if (enabledCache) injectCss(themeCache);
  }

  if (changes[KEY_VAULT_ENABLED]) {
    vaultEnabledCache = !!changes[KEY_VAULT_ENABLED].newValue;

    if (!vaultEnabledCache) removeVaultButtonIfExists();
    else scheduleVaultInject();
  }

  if (shouldReapply) apply();
});

chrome.runtime.onMessage.addListener((message) => {
  if (!extensionContextIsActive()) return;
  if (message?.type !== "xzen-preview-theme-accent") return;
  if (!enabledCache) return;

  const previewTheme = normalizeTheme(message.theme);
  if (!["amoled", "amoled-v2"].includes(previewTheme)) return;

  themeCache = previewTheme;
  if (!injectCss(themeCache)) return;
  applyThemeVars(getThemeDef(themeCache), message.color);
});

reinjectObserver = new MutationObserver(() => {
  if (!extensionContextIsActive()) return;
  const needsThemeVars =
    !!getThemeDef(themeCache)?.vars || !!normalizeHexColor(themeAccentCache[themeCache]);
  if (
    enabledCache &&
    (!document.getElementById(CSS_ID) ||
      (needsThemeVars && !document.getElementById(THEME_VARS_ID)))
  ) {
    if (!injectCss(themeCache)) return;
  }

  if ((enabledCache || dimCache > 0) && !document.getElementById(DIM_ID)) {
    ensureDimOverlay();
    setDim(enabledCache ? dimCache : 0);
  }

  if (enabledCache && !document.getElementById(CREDIT_ID)) scheduleEnsureCredit();

  if (vaultEnabledCache) {
    scheduleVaultInject();
  } else {
    removeVaultButtonIfExists();
  }
});

reinjectObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    apply();

    if (vaultEnabledCache) scheduleVaultInject();
    else removeVaultButtonIfExists();
  }
});

window.addEventListener("pageshow", () => {
  apply();

  if (vaultEnabledCache) scheduleVaultInject();
  else removeVaultButtonIfExists();
});
