const CSS_ID = "pinterest-amoled-css-link";
const DIM_ID = "pinterest-dim-overlay-xzen";

let enabledCache = false;
let dimCache = 0;


const KEY_VAULT_ENABLED = "pinterestVaultEnabled";
let vaultEnabledCache = true;


const KEY_THEME = "pinterestTheme";
let themeCache = "amoled";

function getHeadOrRoot() {
  return document.head || document.documentElement;
}

function cssFileForTheme(t) {
  return t === "gray" ? "gray.css" : "amoled.css";
}

function injectCss(theme = "amoled") {
  const file = cssFileForTheme(theme);
  const wantHref = chrome.runtime.getURL(file);

  let link = document.getElementById(CSS_ID);

  
  if (!link) {
    link = document.createElement("link");
    link.id = CSS_ID;
    link.rel = "stylesheet";
    link.setAttribute("data-xzen", "amoled");
    getHeadOrRoot().appendChild(link);
  }

  
  if (link.href !== wantHref) link.href = wantHref;
}

function removeCss() {
  const el = document.getElementById(CSS_ID);
  if (el) el.remove();
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


const CREDIT_ID = "xzen-amoled-credit-item";
const CREDIT_COLOR = "#B38AFF"; 

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
  if (creditTicking) return;
  creditTicking = true;
  requestAnimationFrame(() => {
    creditTicking = false;
    ensureCreditInjected();
  });
}



const VAULT_KEY = "xzenVaultItems";
const VAULT_BTN_ID = "xzen-vault-save-btn";
const VAULT_STYLE_ID = "xzen-vault-style";
const TOAST_ID = "xzen-vault-toast";

function removeVaultButtonIfExists() {
  const el = document.getElementById(VAULT_BTN_ID);
  if (!el) return;

  const wrapper =
    el.closest('[data-test-id="PinBetterSaveButton"]') ||
    el.closest(".C6J6UC") ||
    el.closest(".ADXRXN") ||
    el;
  wrapper.remove();
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
}`.trim();

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
  if (!url) return "";

  if (url.includes("/originals/")) return url;

  const m = url.match(/^https?:\/\/i\.pinimg\.com\/\d+x\/(.+)$/i);
  if (m && m[1]) {
    return `https://i.pinimg.com/originals/${m[1]}`;
  }

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

  return (
    (best.currentSrc || best.src || "").trim() ||
    (best.querySelector("source")?.src || "").trim()
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
    (meta("og:video:secure_url") || meta("og:video") || meta("twitter:player:stream") || "").trim() ||
    pickBestVideoFromScope(scope);

  const imageUrl =
    pickBestImageFromScope(scope) ||
    (meta("og:image") || meta("twitter:image") || "").trim();

  const mediaUrlRaw = (videoUrl || imageUrl || "").trim();
  const mediaType = guessTypeFromUrl(mediaUrlRaw);

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

function makeVaultContainerFromNative(nativeContainer) {
  const container = nativeContainer.cloneNode(true);
  container.removeAttribute("data-test-id");

  const btn = container.querySelector("button");
  if (!btn) return null;

  btn.id = VAULT_BTN_ID;
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
    labelEl.textContent = "Save to Vault";
    labelEl.style.whiteSpace = "nowrap";
  }

  btn.style.whiteSpace = "nowrap";
  btn.style.minWidth = "132px";

  btn.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      const item = getPinPreviewFromButton(btn);
      saveToVault(item);

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

function injectVaultButton() {
  if (!vaultEnabledCache) return;

  ensureVaultStyles();
  if (document.getElementById(VAULT_BTN_ID)) return;

  const saveBlock = document.querySelector('[data-test-id="pin-better-save-button"]');
  if (!saveBlock) return;

  const nativeContainer = saveBlock.querySelector('[data-test-id="PinBetterSaveButton"]');
  if (!nativeContainer) return;

  const parent = nativeContainer.parentElement;
  if (!parent) return;

  const vaultContainer = makeVaultContainerFromNative(nativeContainer);
  if (!vaultContainer) return;

  parent.appendChild(vaultContainer);
}

let vaultTick = false;
function scheduleVaultInject() {
  if (!vaultEnabledCache) return;
  if (vaultTick) return;
  vaultTick = true;
  requestAnimationFrame(() => {
    vaultTick = false;
    injectVaultButton();
  });
}


function apply() {
  if (enabledCache) {
    injectCss(themeCache);
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
    },
    (data) => {
      enabledCache = !!data.pinterestAmoledEnabled;
      dimCache = Number(data.pinterestDimLevel) || 0;
      vaultEnabledCache = !!data[KEY_VAULT_ENABLED];
      themeCache = data[KEY_THEME] === "gray" ? "gray" : "amoled";

      apply();

      if (vaultEnabledCache) scheduleVaultInject();
      else removeVaultButtonIfExists();
    }
  );
}

loadStateAndApply();

chrome.storage.onChanged.addListener((changes, area) => {
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
    themeCache = changes[KEY_THEME].newValue === "gray" ? "gray" : "amoled";
    if (enabledCache) injectCss(themeCache); 
  }

  if (changes[KEY_VAULT_ENABLED]) {
    vaultEnabledCache = !!changes[KEY_VAULT_ENABLED].newValue;
    if (!vaultEnabledCache) removeVaultButtonIfExists();
    else scheduleVaultInject();
  }

  if (shouldReapply) apply();
});

const reinjectObserver = new MutationObserver(() => {
  if (enabledCache && !document.getElementById(CSS_ID)) injectCss(themeCache);

  if ((enabledCache || dimCache > 0) && !document.getElementById(DIM_ID)) {
    ensureDimOverlay();
    setDim(enabledCache ? dimCache : 0);
  }

  if (enabledCache && !document.getElementById(CREDIT_ID)) scheduleEnsureCredit();

  if (vaultEnabledCache) {
    if (!document.getElementById(VAULT_BTN_ID)) scheduleVaultInject();
  } else {
    if (document.getElementById(VAULT_BTN_ID)) removeVaultButtonIfExists();
  }
});

reinjectObserver.observe(document.documentElement, { childList: true, subtree: true });

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
