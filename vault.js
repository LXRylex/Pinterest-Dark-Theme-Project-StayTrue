


const VAULT_KEY  = "xzenVaultItems";
const TAGS_KEY   = "xzenVaultTags";
const FILTER_KEY = "xzenVaultTagFilter";
const HELP_KEY   = "xzenVaultHelp"; 


const vaultGrid   = document.getElementById("vaultGrid");
const emptyState  = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");


const deleteMenuBtn      = document.getElementById("deleteMenuBtn");
const deleteMenu         = document.getElementById("deleteMenu");
const menuBulkToggle     = document.getElementById("menuBulkToggle");
const menuDeleteSelected = document.getElementById("menuDeleteSelected");
const menuClearAll       = document.getElementById("menuClearAll");

const tagsMenuBtn       = document.getElementById("tagsMenuBtn");
const tagsMenu          = document.getElementById("tagsMenu");
const menuCreateTag     = document.getElementById("menuCreateTag");
const menuTagBulkToggle = document.getElementById("menuTagBulkToggle");
const menuManageTags    = document.getElementById("menuManageTags");

const filterMenuBtn = document.getElementById("filterMenuBtn");
const filterMenu    = document.getElementById("filterMenu");
const filterTags    = document.getElementById("filterTags");


const dataMenuBtn      = document.getElementById("dataMenuBtn");
const dataMenu         = document.getElementById("dataMenu");
const menuExport       = document.getElementById("menuExport");
const menuImport       = document.getElementById("menuImport");
const menuZip          = document.getElementById("menuZip");
const fileImportInput  = document.getElementById("fileImportInput");


const tagModal    = document.getElementById("tagModal");
const tagBackdrop = document.getElementById("tagBackdrop");
const tagX        = document.getElementById("tagX");
const tagInput    = document.getElementById("tagInput");
const tagList     = document.getElementById("tagList");
const tagDoneBtn  = document.getElementById("tagDoneBtn");

const helpBtn      = document.getElementById("helpBtn");
const helpModal    = document.getElementById("helpModal");
const helpBackdrop = document.getElementById("helpBackdrop");
const helpX        = document.getElementById("helpX");


const viewer         = document.getElementById("viewer");
const viewerClose    = document.getElementById("viewerClose");
const viewerX        = document.getElementById("viewerX");
const viewerTitle    = document.getElementById("viewerTitle");
const viewerMedia    = document.getElementById("viewerMedia");
const viewerOpen     = document.getElementById("viewerOpen");
const viewerCopy     = document.getElementById("viewerCopy");
const viewerDownload = document.getElementById("viewerDownload");


let items = [];
let tags  = [];
let activeFilter = "__all";

let editingUrls = new Set();

let activeItem = null;
let activeResolved = null;

let bulkMode = false;
let bulkModeKind = "delete"; 
let selectedUrls = new Set();


let filteredView = [];
let hoveredIndex = -1;
let spaceDown = false;
let qpToken = 0;


function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function niceHost(u) {
  try { return new URL(u).hostname; } catch { return ""; }
}

function hasExt(u, exts) {
  const x = String(u || "").toLowerCase();
  return exts.some((e) => new RegExp(`\\.${e}(?:$|[?#])`, "i").test(x));
}

function guessTypeFromUrl(u) {
  const x = (u || "").toLowerCase();
  if (hasExt(x, ["gif"])) return "gif";
  if (hasExt(x, ["mp4", "webm"])) return "video";
  return "image";
}

function extFromUrl(u, type) {
  const x = (u || "").toLowerCase();

  if (type === "video") return hasExt(x, ["webm"]) ? "webm" : "mp4";

  if (type === "gif") {
    if (hasExt(x, ["webm"])) return "webm";
    if (hasExt(x, ["mp4"])) return "mp4";
    return "gif";
  }

  if (hasExt(x, ["png"]))  return "png";
  if (hasExt(x, ["webp"])) return "webp";
  if (hasExt(x, ["gif"]))  return "gif";
  return "jpg";
}

function safeName(s) {
  return String(s || "vault")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "vault";
}

function preloadImage(url) {
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error("no url"));
    const img = new Image();
    img.referrerPolicy = "no-referrer-when-downgrade";
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error("load fail"));
    img.src = url;
  });
}

function getMetaFromHtml(html, propOrName) {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const a = doc.querySelector(`meta[property="${propOrName}"]`)?.content;
    if (a) return a;
    const b = doc.querySelector(`meta[name="${propOrName}"]`)?.content;
    if (b) return b;
  } catch {}
  return "";
}

function isGifHint(it, probeUrl) {
  const p = String(probeUrl || "");
  return it?.mediaType === "gif" || hasExt(p, ["gif"]) || hasExt(it?.url, ["gif"]);
}

function isRealVideo(it, probeUrl) {
  const p = String(probeUrl || "");
  return (it?.mediaType === "video" || hasExt(p, ["mp4", "webm"])) && !isGifHint(it, p);
}

async function resolveMediaForItem(it) {
  const stored = (it?.mediaUrl || "").trim();
  if (stored) {
    let t = it.mediaType || guessTypeFromUrl(stored);
    if (t === "video" && isGifHint(it, stored)) t = "gif";
    const thumb = (it.thumb || "").trim() || (t !== "video" ? stored : "");
    return { url: stored, type: t, thumb };
  }

  try {
    const res = await fetch(it.url, { credentials: "include" });
    const html = await res.text();

    const v = (
      getMetaFromHtml(html, "og:video:secure_url") ||
      getMetaFromHtml(html, "og:video") ||
      getMetaFromHtml(html, "twitter:player:stream") ||
      ""
    ).trim();

    const img = (
      getMetaFromHtml(html, "og:image") ||
      getMetaFromHtml(html, "twitter:image") ||
      ""
    ).trim();

    const url = v || img || it.url;

    let type = v ? "video" : guessTypeFromUrl(img || url);
    if (type === "video" && isGifHint(it, img || it.url || url)) type = "gif";

    const thumb = img || (type !== "video" ? url : "");
    return { url, type, thumb };
  } catch {
    let t = it.mediaType || guessTypeFromUrl(it.thumb || it.url);
    const u = (it.mediaUrl || it.thumb || it.url || "").trim();
    if (t === "video" && isGifHint(it, u)) t = "gif";
    return { url: u, type: t, thumb: it.thumb || "" };
  }
}

function normalizeTagName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").slice(0, 32);
}

function tagKey(name) {
  return String(name || "").trim().toLowerCase();
}

function ensureItemTags() {
  items.forEach((it) => {
    if (!it) return;
    if (!Array.isArray(it.tags)) it.tags = [];
  });
}


function menuOpen(btn, menu) {
  if (!btn || !menu) return;
  menu.hidden = false;
  btn.setAttribute("aria-expanded", "true");
}
function menuClose(btn, menu) {
  if (!btn || !menu) return;
  menu.hidden = true;
  btn.setAttribute("aria-expanded", "false");
}
function closeAllMenus() {
  menuClose(deleteMenuBtn, deleteMenu);
  menuClose(tagsMenuBtn, tagsMenu);
  menuClose(filterMenuBtn, filterMenu);
  menuClose(dataMenuBtn, dataMenu);
}
function toggleMenuExclusive(btn, menu) {
  if (!menu) return;
  const wasOpen = !menu.hidden;
  closeAllMenus();
  if (!wasOpen) menuOpen(btn, menu);
}

document.addEventListener("click", (e) => {
  const t = e.target;
  if (t?.closest?.(".tag-ctx-menu")) return;

  const hDel = (deleteMenuBtn && (t === deleteMenuBtn || deleteMenuBtn.contains(t))) || (deleteMenu && deleteMenu.contains(t));
  const hTag = (tagsMenuBtn && (t === tagsMenuBtn || tagsMenuBtn.contains(t))) || (tagsMenu && tagsMenu.contains(t));
  const hFil = (filterMenuBtn && (t === filterMenuBtn || filterMenuBtn.contains(t))) || (filterMenu && filterMenu.contains(t));
  const hDat = (dataMenuBtn && (t === dataMenuBtn || dataMenuBtn.contains(t))) || (dataMenu && dataMenu.contains(t));

  if (hDel || hTag || hFil || hDat) return;

  closeAllMenus();
  closeCtxMenu();
});

window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  closeAllMenus();
  closeCtxMenu();
  if (tagModal?.classList.contains("show")) hideTagModal();
  if (helpModal?.classList.contains("show")) closeHelp();
  if (viewer?.classList.contains("show")) hideViewer();
});

deleteMenuBtn?.addEventListener("click", (e) => { e.preventDefault(); toggleMenuExclusive(deleteMenuBtn, deleteMenu); });
tagsMenuBtn?.addEventListener("click",   (e) => { e.preventDefault(); toggleMenuExclusive(tagsMenuBtn, tagsMenu); });
filterMenuBtn?.addEventListener("click", (e) => { e.preventDefault(); toggleMenuExclusive(filterMenuBtn, filterMenu); });
dataMenuBtn?.addEventListener("click",   (e) => { e.preventDefault(); toggleMenuExclusive(dataMenuBtn, dataMenu); });


function saveItems()  { chrome.storage.local.set({ [VAULT_KEY]: items }); }
function saveTags()   { chrome.storage.local.set({ [TAGS_KEY]: tags }); }
function saveFilter() { chrome.storage.local.set({ [FILTER_KEY]: activeFilter }); }
function saveAll()    { chrome.storage.local.set({ [VAULT_KEY]: items, [TAGS_KEY]: tags, [FILTER_KEY]: activeFilter }); }


menuExport?.addEventListener("click", () => {
  const payload = { version: 1, exportedAt: new Date().toISOString(), items, tags };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);

  chrome.downloads.download({
    url,
    filename: `vault_backup_${dateStr}.pinvault`,
    saveAs: true
  });

  closeAllMenus();
});

menuImport?.addEventListener("click", () => {
  fileImportInput?.click();
  closeAllMenus();
});

fileImportInput?.addEventListener("change", (e) => {
  const file = e.target?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!Array.isArray(data.items)) throw new Error("Invalid .pinvault file format (missing items)");

      const newItems = data.items;
      const newTags  = Array.isArray(data.tags) ? data.tags : [];

      const doMerge = confirm(
        `Found ${newItems.length} items and ${newTags.length} tags.\n\nClick OK to MERGE.\nClick CANCEL to REPLACE.`
      );

      if (doMerge) {
        const currentUrls = new Set(items.map(i => i?.url).filter(Boolean));
        let addedCount = 0;

        newItems.forEach(it => {
          if (!it?.url) return;
          if (!currentUrls.has(it.url)) {
            items.push(it);
            currentUrls.add(it.url);
            addedCount++;
          }
        });

        const currentTagKeys = new Set(tags.map(t => tagKey(t)));
        newTags.forEach(t => {
          const clean = normalizeTagName(t);
          const k = tagKey(clean);
          if (!clean) return;
          if (!currentTagKeys.has(k)) {
            tags.push(clean);
            currentTagKeys.add(k);
          }
        });

        alert(`Merged successfully! Added ${addedCount} new items.`);
      } else {
        items = newItems;
        tags  = newTags.map(t => normalizeTagName(t)).filter(Boolean);
        alert("Vault replaced successfully.");
      }

      ensureItemTags();
      saveAll();
      rebuildTagMenus();
      render();
    } catch (err) {
      alert("Error importing file: " + (err?.message || err));
    }
    fileImportInput.value = "";
  };

  reader.readAsText(file);
});


function getFilteredItemsNow() {
  const q = (searchInput?.value || "").trim().toLowerCase();
  let out = items;

  if (activeFilter && activeFilter !== "__all") {
    const fk = tagKey(activeFilter);
    out = out.filter((it) => Array.isArray(it?.tags) && it.tags.some((t) => tagKey(t) === fk));
  }

  if (q) {
    out = out.filter((it) =>
      (it.title || "").toLowerCase().includes(q) ||
      (it.url || "").toLowerCase().includes(q) ||
      (Array.isArray(it.tags) ? it.tags.join(" ").toLowerCase().includes(q) : false)
    );
  }

  return out;
}

async function fetchBlobBestEffort(url) {
  const tries = [
    () => fetch(url, { credentials: "omit" }),
    () => fetch(url, { credentials: "include" }),
  ];

  let lastErr = null;
  for (const t of tries) {
    try {
      const r = await t();
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.blob();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("fetch failed");
}

async function downloadZipMedia() {
  closeAllMenus();

  if (typeof JSZip === "undefined") {
    alert("JSZip not found. Add jszip.min.js before vault.js.");
    return;
  }

  const list = getFilteredItemsNow();
  if (!list.length) {
    alert("No items to zip.");
    return;
  }

  const ok = confirm(`ZIP ${list.length} item(s) media?\n\nNote: some media may fail if blocked by the host.`);
  if (!ok) return;

  const btn = menuZip;
  const oldText = btn?.textContent || "";
  if (btn) { btn.disabled = true; btn.textContent = "Zipping…"; }

  const zip = new JSZip();
  const folder = zip.folder("XzenVaultMedia");
  const meta = [];

  let added = 0;
  let failed = 0;

  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    try {
      if (btn) btn.textContent = `Zipping… (${i + 1}/${list.length})`;

      const resolved = await resolveMediaForItem(it);
      const mediaUrl = (resolved?.url || "").trim();
      if (!mediaUrl) throw new Error("no media url");

      let type = resolved.type || guessTypeFromUrl(mediaUrl);
      if (type === "video" && isGifHint(it, mediaUrl)) type = "gif";
      const ext = extFromUrl(mediaUrl, type);

      const host = safeName(niceHost(it.url || "")) || "site";
      const base = safeName(it.title || "item");
      const filename = `${String(i + 1).padStart(3, "0")}_${host}_${base}.${ext}`;

      const blob = await fetchBlobBestEffort(mediaUrl);
      folder.file(filename, blob);

      meta.push({
        title: it.title || "",
        pageUrl: it.url || "",
        mediaUrl,
        mediaType: type,
        filename
      });

      added++;
    } catch {
      failed++;
    }
  }

  zip.file("vault_media_index.json", JSON.stringify({
    exportedAt: new Date().toISOString(),
    filter: activeFilter,
    query: (searchInput?.value || "").trim(),
    totalRequested: list.length,
    added,
    failed,
    items: meta
  }, null, 2));

  try {
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);

    chrome.downloads.download({
      url,
      filename: `XzenVaultMedia_${dateStr}.zip`,
      saveAs: true
    });

    if (failed) alert(`ZIP done.\nAdded: ${added}\nFailed: ${failed}`);
  } catch (e) {
    alert("ZIP failed: " + (e?.message || e));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = oldText || "Download ZIP (media)"; }
  }
}

menuZip?.addEventListener("click", downloadZipMedia);


function updateCardSelectedUI(card, url) {
  if (!card || !url) return;
  const on = selectedUrls.has(url);
  card.classList.toggle("selected", on);
  const cb = card.querySelector(".select-checkbox");
  if (cb) cb.checked = on;
}

function setBulkMode(on, kind = bulkModeKind) {
  bulkMode = !!on;
  bulkModeKind = kind || "delete";

  document.body.classList.toggle("bulk-mode", bulkMode);
  document.body.dataset.bulk = bulkMode ? bulkModeKind : "";

  if (!bulkMode) selectedUrls.clear();

  if (menuBulkToggle) {
    menuBulkToggle.textContent =
      (bulkMode && bulkModeKind === "delete") ? "Exit bulk delete" : "Enter bulk delete";
  }

  if (menuTagBulkToggle) {
    menuTagBulkToggle.textContent =
      (bulkMode && bulkModeKind === "tag") ? "Exit bulk tag mode" : "Enter bulk tag mode";
  }

  updateSelectedUI();
  render();
}

function updateSelectedUI() {
  const n = selectedUrls.size;

  if (menuDeleteSelected) {
    menuDeleteSelected.disabled = n === 0;
    menuDeleteSelected.textContent = n === 0 ? "Delete selected" : `Delete selected (${n})`;
  }

  if (menuManageTags) {
    if (bulkModeKind === "tag" && n > 0) menuManageTags.textContent = `Apply to selected (${n})`;
    else menuManageTags.textContent = "Apply to selected";
  }
}

function toggleSelected(url) {
  if (!url) return;
  if (selectedUrls.has(url)) selectedUrls.delete(url);
  else selectedUrls.add(url);
  updateSelectedUI();
}


function addTag(name) {
  const clean = normalizeTagName(name);
  if (!clean) return;

  const key = tagKey(clean);
  if (tags.some((x) => tagKey(x) === key)) return;

  tags.push(clean);
  saveTags();
  rebuildTagMenus();
}

function setFilter(tag) {
  activeFilter = tag === "__all" ? "__all" : tag;
  saveFilter();
  rebuildTagMenus();
  render();
}

function rebuildTagMenus() {
  if (!filterTags) return;

  filterTags.textContent = "";

  const allBtn = document.createElement("button");
  allBtn.className = `menu-tag-btn ${activeFilter === "__all" ? "on" : ""}`;
  allBtn.type = "button";
  allBtn.dataset.filtertag = "__all";
  allBtn.textContent = "All";
  allBtn.addEventListener("click", () => setFilter("__all"));
  filterTags.appendChild(allBtn);

  if (tags.length > 0) {
    const sorted = [...tags].sort((a, b) => a.localeCompare(b));
    sorted.forEach((t) => {
      const btn = document.createElement("button");
      btn.className = `menu-tag-btn ${activeFilter === t ? "on" : ""}`;
      btn.type = "button";
      btn.dataset.filtertag = t;
      btn.textContent = t;
      btn.addEventListener("click", () => setFilter(t));
      filterTags.appendChild(btn);
    });
  } else {
    const div = document.createElement("div");
    div.style.color = "rgba(255,255,255,.4)";
    div.style.fontSize = "11px";
    div.style.padding = "6px";
    div.textContent = "No tags yet.";
    filterTags.appendChild(div);
  }
}


function openTagPicker(urlArray) {
  editingUrls = new Set(urlArray || []);

  const title = document.getElementById("tagModalTitle");
  if (title) {
    if (editingUrls.size === 0) title.textContent = "Manage Tags";
    else title.textContent = editingUrls.size > 1 ? `Edit tags (${editingUrls.size} items)` : "Edit tags";
  }

  renderTagPickerCloud();

  if (tagModal) {
    tagModal.classList.add("show");
    tagModal.setAttribute("aria-hidden", "false");
  }

  if (tagInput) {
    tagInput.value = "";
    setTimeout(() => tagInput?.focus(), 50);
  }
}

function hideTagModal() {
  if (!tagModal) return;
  tagModal.classList.remove("show");
  tagModal.setAttribute("aria-hidden", "true");
  closeCtxMenu();
}

function renderTagPickerCloud() {
  if (!tagList) return;
  tagList.innerHTML = "";

  const sortedTags = [...tags].sort((a, b) => a.localeCompare(b));
  sortedTags.forEach(t => {
    const btn = document.createElement("button");
    btn.className = "tag-chip-btn";
    btn.type = "button";
    btn.textContent = t;

    
    if (editingUrls.size > 0) {
      const firstUrl = editingUrls.values().next().value;
      const firstItem = items.find(it => it?.url === firstUrl);
      if (firstItem && Array.isArray(firstItem.tags) && firstItem.tags.some(x => tagKey(x) === tagKey(t))) {
        btn.classList.add("active");
      }
    }

    btn.onclick = () => toggleTagForEditing(t, btn);
    btn.oncontextmenu = (e) => { e.preventDefault(); showTagContext(e, t); };
    tagList.appendChild(btn);
  });
}

function toggleTagForEditing(tagName, btnElement) {
  if (editingUrls.size === 0) return;

  const isAdding = !btnElement.classList.contains("active");
  btnElement.classList.toggle("active", isAdding);

  const k = tagKey(tagName);

  items.forEach(it => {
    if (!it?.url) return;
    if (!editingUrls.has(it.url)) return;

    if (!Array.isArray(it.tags)) it.tags = [];
    const hasIt = it.tags.some(x => tagKey(x) === k);

    if (isAdding && !hasIt) it.tags.push(tagName);
    else if (!isAdding && hasIt) it.tags = it.tags.filter(x => tagKey(x) !== k);
  });

  saveAll();
  render();
}

let ctxMenuEl = null;

function closeCtxMenu() {
  if (ctxMenuEl) {
    ctxMenuEl.remove();
    ctxMenuEl = null;
  }
}

function showTagContext(e, tagName) {
  closeCtxMenu();

  ctxMenuEl = document.createElement("div");
  ctxMenuEl.className = "tag-ctx-menu";
  ctxMenuEl.style.left = e.clientX + "px";
  ctxMenuEl.style.top  = e.clientY + "px";

  const ren = document.createElement("button");
  ren.className = "tag-ctx-item";
  ren.textContent = "Rename Tag";
  ren.onclick = () => { closeCtxMenu(); renameTagGlobal(tagName); };

  const del = document.createElement("button");
  del.className = "tag-ctx-item danger";
  del.textContent = "Delete Tag (Global)";
  del.onclick = () => { closeCtxMenu(); deleteTagGlobal(tagName); };

  ctxMenuEl.appendChild(ren);
  ctxMenuEl.appendChild(del);
  document.body.appendChild(ctxMenuEl);
}

function renameTagGlobal(oldName) {
  const newName = prompt("Rename tag:", oldName);
  if (!newName || newName.trim() === "") return;

  const clean = normalizeTagName(newName);
  if (!clean) return;

  const kOld = tagKey(oldName);

  
  if (tags.some(t => tagKey(t) === tagKey(clean) && tagKey(t) !== kOld)) {
    alert("A tag with that name already exists.");
    return;
  }

  const idx = tags.findIndex(t => tagKey(t) === kOld);
  if (idx !== -1) tags[idx] = clean;

  items.forEach(it => {
    if (!Array.isArray(it.tags)) return;
    it.tags = it.tags.map(t => (tagKey(t) === kOld ? clean : t));
    
    const seen = new Set();
    it.tags = it.tags.filter(t => {
      const k = tagKey(t);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  });

  
  if (activeFilter !== "__all" && tagKey(activeFilter) === kOld) {
    activeFilter = clean;
  }

  saveAll();
  rebuildTagMenus();
  render();
  renderTagPickerCloud();
}

function deleteTagGlobal(tagName) {
  if (!confirm(`Permanently delete "${tagName}" from ALL items?`)) return;

  const k = tagKey(tagName);

  tags = tags.filter(t => tagKey(t) !== k);

  items.forEach(it => {
    if (!Array.isArray(it.tags)) return;
    it.tags = it.tags.filter(t => tagKey(t) !== k);
  });

  if (activeFilter !== "__all" && tagKey(activeFilter) === k) {
    activeFilter = "__all";
  }

  saveAll();
  rebuildTagMenus();
  render();
  renderTagPickerCloud();
}

tagInput?.addEventListener("input", (e) => {
  const val = (e.target.value || "").toLowerCase();
  tagList?.querySelectorAll?.(".tag-chip-btn")?.forEach?.(chip => {
    chip.classList.toggle("hidden", !chip.textContent.toLowerCase().includes(val));
  });
});

tagInput?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;

  e.preventDefault();
  const val = (tagInput.value || "").trim();
  if (!val) return;

  const clean = normalizeTagName(val);
  if (!clean) return;

  const existing = tags.find(t => tagKey(t) === tagKey(clean));

  if (existing) {
    
    if (editingUrls.size > 0) {
      const chips = Array.from(tagList.querySelectorAll(".tag-chip-btn"));
      const target = chips.find(c => tagKey(c.textContent) === tagKey(existing));
      if (target) target.click();
    }
  } else {
    
    addTag(clean);
    renderTagPickerCloud();

    
    if (editingUrls.size > 0) {
      const chips = Array.from(tagList.querySelectorAll(".tag-chip-btn"));
      const newBtn = chips.find(c => tagKey(c.textContent) === tagKey(clean));
      if (newBtn) toggleTagForEditing(clean, newBtn);
    }
  }

  tagInput.value = "";
  tagList?.querySelectorAll?.(".tag-chip-btn")?.forEach?.(c => c.classList.remove("hidden"));
});

tagBackdrop?.addEventListener("click", hideTagModal);
tagX?.addEventListener("click", hideTagModal);

tagDoneBtn?.addEventListener("click", () => {
  const v = (tagInput?.value || "").trim();

  
  if (v) {
    const clean = normalizeTagName(v);
    if (clean) {
      const existing = tags.find(t => tagKey(t) === tagKey(clean));
      if (!existing) addTag(clean);

      if (editingUrls.size) {
        const t = existing || clean;
        const k = tagKey(t);
        items.forEach(i => {
          if (!i?.url) return;
          if (!editingUrls.has(i.url)) return;
          i.tags = Array.isArray(i.tags) ? i.tags : [];
          if (!i.tags.some(x => tagKey(x) === k)) i.tags.push(t);
        });
        saveAll();
        render();
      }
    }
  }

  if (bulkMode && bulkModeKind === "tag") setBulkMode(false);
  hideTagModal();
});


function openHelp() {
  if (!helpModal) return;
  helpModal.classList.add("show");
  helpModal.setAttribute("aria-hidden", "false");
}
function closeHelp() {
  if (!helpModal) return;
  helpModal.classList.remove("show");
  helpModal.setAttribute("aria-hidden", "true");
}

helpBtn?.addEventListener("click", openHelp);
helpBackdrop?.addEventListener("click", closeHelp);
helpX?.addEventListener("click", closeHelp);


function render() {
  if (!vaultGrid || !emptyState) return;

  const q = (searchInput?.value || "").trim().toLowerCase();
  let filtered = items;

  if (activeFilter && activeFilter !== "__all") {
    const fk = tagKey(activeFilter);
    filtered = filtered.filter((it) => Array.isArray(it?.tags) && it.tags.some((t) => tagKey(t) === fk));
  }

  if (q) {
    filtered = filtered.filter((it) =>
      (it.title || "").toLowerCase().includes(q) ||
      (it.url || "").toLowerCase().includes(q) ||
      (Array.isArray(it.tags) ? it.tags.join(" ").toLowerCase().includes(q) : false)
    );
  }

  filteredView = filtered;
  emptyState.classList.toggle("show", filtered.length === 0);

  vaultGrid.textContent = "";
  const frag = document.createDocumentFragment();

  filtered.forEach((it, idx) => {
    const card = document.createElement("div");
    card.className = `card ${selectedUrls.has(it.url) ? "selected" : ""}`;
    card.dataset.i = idx;

    
    const cb = document.createElement("input");
    cb.className = "select-checkbox";
    cb.type = "checkbox";
    cb.dataset.sel = idx;
    cb.checked = selectedUrls.has(it.url);

    cb.addEventListener("click", e => e.stopPropagation());
    cb.addEventListener("change", () => {
      if (cb.checked) selectedUrls.add(it.url);
      else selectedUrls.delete(it.url);
      updateSelectedUI();
      updateCardSelectedUI(card, it.url);
    });

    card.appendChild(cb);

    
    const thumbWrap = document.createElement("div");
    thumbWrap.className = "thumb-wrapper";
    thumbWrap.dataset.openviewer = idx;

    const img = document.createElement("img");
    img.dataset.thumb = idx;
    img.alt = "";
    img.decoding = "async";
    img.loading = "lazy";
    img.draggable = false;
    thumbWrap.appendChild(img);

    const fallback = document.createElement("div");
    fallback.className = "thumb-fallback";
    fallback.dataset.fallback = idx;
    fallback.textContent = "Loading…";
    thumbWrap.appendChild(fallback);

    const probe = it.mediaUrl || it.thumb || it.url || "";
    if (isRealVideo(it, probe)) {
      const overlay = document.createElement("div");
      overlay.className = "play-overlay";
      overlay.innerHTML = '<div class="play-icon-circle">▶</div>';
      thumbWrap.appendChild(overlay);
    }

    thumbWrap.addEventListener("click", async (e) => {
      if (bulkMode) {
        e.preventDefault();
        e.stopPropagation();
        toggleSelected(it.url);
        updateCardSelectedUI(card, it.url);
      } else {
        await openViewer(it);
      }
    });

    card.appendChild(thumbWrap);

    
    const body = document.createElement("div");
    body.className = "card-body";

    const titleDiv = document.createElement("div");
    titleDiv.className = "card-title";
    titleDiv.textContent = it.title || "Pinterest";
    body.appendChild(titleDiv);

    
    if (Array.isArray(it.tags) && it.tags.length > 0) {
      const tagDiv = document.createElement("div");
      tagDiv.className = "card-tags";

      it.tags.slice(0, 3).forEach(t => {
        const chip = document.createElement("span");
        chip.className = "tag-chip";
        chip.textContent = t;
        tagDiv.appendChild(chip);
      });

      if (it.tags.length > 3) {
        const more = document.createElement("span");
        more.className = "tag-more";
        more.textContent = `+${it.tags.length - 3}`;
        tagDiv.appendChild(more);
      }

      body.appendChild(tagDiv);
    }

    const metaDiv = document.createElement("div");
    metaDiv.className = "card-meta";
    metaDiv.textContent = niceHost(it.url || "") || it.site || "";
    body.appendChild(metaDiv);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "card-actions";

    const mkBtn = (cls, txt, onclick) => {
      const b = document.createElement("button");
      b.className = `card-btn ${cls}`;
      b.type = "button";
      b.textContent = txt;
      b.addEventListener("click", onclick);
      return b;
    };

    actionsDiv.appendChild(
      mkBtn("open-btn", "Open", (e) => {
        e.stopPropagation();
        if (it?.url) window.open(it.url, "_blank", "noopener,noreferrer");
      })
    );

    actionsDiv.appendChild(
      mkBtn("tag-btn", "Tag", (e) => {
        e.stopPropagation();
        openTagPicker([it.url]);
      })
    );

    actionsDiv.appendChild(
      mkBtn("copy-btn", "Copy", async (e) => {
        e.stopPropagation();
        const b = e.currentTarget;
        try {
          await navigator.clipboard.writeText(it?.url || "");
          b.textContent = "Copied";
          setTimeout(() => (b.textContent = "Copy"), 700);
        } catch {}
      })
    );

    actionsDiv.appendChild(
      mkBtn("delete-btn", "Delete", (e) => {
        e.stopPropagation();
        if (!confirm("Delete this item?")) return;

        const r = items.findIndex((x) => x && x.url === it.url);
        if (r >= 0) items.splice(r, 1);

        selectedUrls.delete(it.url);
        saveItems();
        render();
        updateSelectedUI();
      })
    );

    body.appendChild(actionsDiv);
    card.appendChild(body);
    frag.appendChild(card);
  });

  vaultGrid.appendChild(frag);

  
  filtered.forEach(async (it, i) => {
    const imgEl = vaultGrid.querySelector(`[data-thumb="${i}"]`);
    const fbEl  = vaultGrid.querySelector(`[data-fallback="${i}"]`);
    const wrap  = imgEl?.closest(".thumb-wrapper");
    if (!imgEl || !fbEl || !wrap) return;

    const thumb = (it.thumb || "").trim() || (it.mediaType !== "video" ? (it.mediaUrl || "").trim() : "");
    if (!thumb) { fbEl.textContent = "No thumbnail"; return; }

    try {
      await preloadImage(thumb);
      imgEl.src = thumb;
      wrap.classList.add("loaded");
      fbEl.style.display = "none";
    } catch {
      fbEl.textContent = "Thumb blocked";
    }
  });

  updateSelectedUI();
}


searchInput?.addEventListener("input", () => render());


menuBulkToggle?.addEventListener("click", () => {
  setBulkMode(!(bulkMode && bulkModeKind === "delete"), "delete");
});

menuDeleteSelected?.addEventListener("click", () => {
  if (selectedUrls.size === 0) return;

  if (!confirm(`Delete ${selectedUrls.size} selected item(s)?`)) return;

  const k = new Set(selectedUrls);
  items = items.filter((it) => !k.has(it.url));
  selectedUrls.clear();

  saveItems();
  render();
  updateSelectedUI();
});

menuClearAll?.addEventListener("click", () => {
  if (!confirm("Delete ALL Vault items?")) return;

  items = [];
  selectedUrls.clear();

  saveItems();
  render();
  updateSelectedUI();
});

menuTagBulkToggle?.addEventListener("click", () => {
  setBulkMode(!(bulkMode && bulkModeKind === "tag"), "tag");
});

menuManageTags?.addEventListener("click", () => {
  if (selectedUrls.size > 0) openTagPicker(Array.from(selectedUrls));
  else alert("Select items first!");
});

menuCreateTag?.addEventListener("click", () => {
  openTagPicker([]); 
});


chrome.storage.onChanged.addListener((c, a) => {
  if (a !== "local") return;

  if (c[VAULT_KEY])  items = c[VAULT_KEY].newValue || [];
  if (c[TAGS_KEY])   tags  = c[TAGS_KEY].newValue || [];
  if (c[FILTER_KEY]) activeFilter = c[FILTER_KEY].newValue || "__all";

  ensureItemTags();
  rebuildTagMenus();
  render();
});


function showViewer() {
  if (!viewer) return;
  viewer.classList.add("show");
  viewer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function hideViewer() {
  if (!viewer) return;
  viewer.classList.remove("show");
  viewer.setAttribute("aria-hidden", "true");
  if (viewerMedia) viewerMedia.innerHTML = "";
  activeItem = null;
  activeResolved = null;
  document.body.style.overflow = "";
}

viewerClose?.addEventListener("click", hideViewer);
viewerX?.addEventListener("click", hideViewer);

async function openViewer(it) {
  if (!viewerTitle || !viewerOpen || !viewerMedia) return;

  activeItem = it;
  viewerTitle.textContent = it.title || "Preview";
  viewerOpen.href = it.url || "#";

  viewerMedia.innerHTML = `<div style="color:#777; font-weight:600; padding: 40px;">Loading…</div>`;
  showViewer();

  const resolved = await resolveMediaForItem(it);
  activeResolved = resolved;

  
  if (resolved.type === "video") {
    const v = document.createElement("video");
    v.controls = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.referrerPolicy = "no-referrer-when-downgrade";
    v.src = resolved.url;
    viewerMedia.innerHTML = "";
    viewerMedia.appendChild(v);
    return;
  }

  
  if (resolved.type === "gif") {
    const u = resolved.url || resolved.thumb || "";
    const isVid = hasExt(u, ["mp4", "webm"]);

    viewerMedia.innerHTML = "";

    if (isVid) {
      const v = document.createElement("video");
      v.controls = false;
      v.autoplay = true;
      v.loop = true;
      v.muted = true;
      v.playsInline = true;
      v.preload = "metadata";
      v.referrerPolicy = "no-referrer-when-downgrade";
      v.src = u;
      viewerMedia.appendChild(v);
    } else {
      const img = document.createElement("img");
      img.decoding = "async";
      img.loading = "eager";
      img.referrerPolicy = "no-referrer-when-downgrade";
      img.draggable = false;
      img.src = u;
      viewerMedia.appendChild(img);
    }
    return;
  }

  
  const img = document.createElement("img");
  img.decoding = "async";
  img.loading = "eager";
  img.referrerPolicy = "no-referrer-when-downgrade";
  img.draggable = false;
  img.src = resolved.url || resolved.thumb || "";
  viewerMedia.innerHTML = "";
  viewerMedia.appendChild(img);
}

viewerCopy?.addEventListener("click", async () => {
  const u = activeItem?.url || "";
  if (!u) return;

  try {
    await navigator.clipboard.writeText(u);
    viewerCopy.textContent = "Copied";
    setTimeout(() => (viewerCopy.textContent = "Copy"), 700);
  } catch {}
});


viewerDownload?.addEventListener("click", () => {
  if (!activeItem || !activeResolved?.url) return;

  const type = activeResolved.type || guessTypeFromUrl(activeResolved.url);
  const ext  = extFromUrl(activeResolved.url, type);
  const name = safeName(activeItem.title) + "." + ext;

  chrome.downloads.download({
    url: activeResolved.url,
    filename: `XzenVault/${name}`,
    conflictAction: "uniquify",
    saveAs: false
  });
});


function load() {
  chrome.storage.local.get(
    { [VAULT_KEY]: [], [TAGS_KEY]: [], [FILTER_KEY]: "__all" },
    (d) => {
      items = Array.isArray(d[VAULT_KEY]) ? d[VAULT_KEY] : [];
      tags  = Array.isArray(d[TAGS_KEY])  ? d[TAGS_KEY]  : [];
      activeFilter = d[FILTER_KEY] || "__all";

      ensureItemTags();
      rebuildTagMenus();
      render();
    }
  );
}

load();


function qpEnsure() {
  let el = document.getElementById("quickPreview");
  if (el) return el;

  el = document.createElement("div");
  el.id = "quickPreview";
  el.className = "quick-preview";
  el.innerHTML = `
    <div class="qp-backdrop"></div>
    <div class="qp-card" role="dialog" aria-label="Quick preview">
      <div class="qp-head" id="qpTitle">Preview</div>
      <div class="qp-body" id="qpBody"></div>
    </div>
  `;
  document.body.appendChild(el);
  return el;
}

function qpShow() { qpEnsure().classList.add("show"); }
function qpHide() {
  const el = document.getElementById("quickPreview");
  if (!el) return;
  el.classList.remove("show");
  const body = el.querySelector("#qpBody");
  if (body) body.innerHTML = "";
}

function qpActiveElementIsTyping() {
  const a = document.activeElement;
  return !!(a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable));
}

async function qpRenderForItem(it) {
  if (!it) return;

  const el = qpEnsure();
  const head = el.querySelector("#qpTitle");
  const body = el.querySelector("#qpBody");
  if (!head || !body) return;

  head.textContent = it.title || "Preview";
  body.innerHTML = `<div style="color:#777; font-weight:600; padding: 40px;">Loading…</div>`;
  qpShow();

  
  const qt = (it.thumb || "").trim() || (it.mediaType !== "video" ? (it.mediaUrl || "").trim() : "") || "";
  if (qt) {
    body.innerHTML = "";
    const img = document.createElement("img");
    img.decoding = "async";
    img.loading = "eager";
    img.referrerPolicy = "no-referrer-when-downgrade";
    img.draggable = false;
    img.src = qt;
    body.appendChild(img);
  }

  const my = ++qpToken;
  let res;
  try { res = await resolveMediaForItem(it); } catch { return; }

  if (my !== qpToken || !spaceDown) return;

  body.innerHTML = "";

  const u = res.url || res.thumb || "";
  const isVid = res.type === "video" || (res.type === "gif" && hasExt(u, ["mp4", "webm"]));

  if (isVid) {
    const v = document.createElement("video");
    v.controls = false;
    v.autoplay = true;
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.referrerPolicy = "no-referrer-when-downgrade";
    v.src = u;
    body.appendChild(v);
  } else {
    const img = document.createElement("img");
    img.decoding = "async";
    img.loading = "eager";
    img.referrerPolicy = "no-referrer-when-downgrade";
    img.draggable = false;
    img.src = u;
    body.appendChild(img);
  }
}

vaultGrid?.addEventListener("pointerover", (e) => {
  const w = e.target?.closest?.(".thumb-wrapper");
  if (!w) return;
  const i = Number(w.getAttribute("data-openviewer"));
  if (!Number.isFinite(i)) return;

  hoveredIndex = i;
  if (spaceDown) qpRenderForItem(filteredView[hoveredIndex]);
});

vaultGrid?.addEventListener("pointerout", (e) => {
  const f = e.target?.closest?.(".thumb-wrapper");
  const t = e.relatedTarget?.closest?.(".thumb-wrapper");
  if (f && !t) {
    hoveredIndex = -1;
    if (spaceDown) qpHide();
  }
});

window.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || e.repeat || qpActiveElementIsTyping()) return;
  spaceDown = true;
  e.preventDefault();
  const it = filteredView[hoveredIndex];
  if (it) qpRenderForItem(it);
});

window.addEventListener("keyup", (e) => {
  if (e.code !== "Space") return;
  spaceDown = false;
  qpHide();
});

window.addEventListener("blur", () => {
  if (!spaceDown) return;
  spaceDown = false;
  qpHide();
});

(function() {
  const INTRO_KEY = "xzenVaultIntroSeen";
  const modal = document.getElementById("introModal");
  if (!modal) return;

  const backdrop = document.getElementById("introBackdrop");
  const xBtn = document.getElementById("introX");
  const okBtn = document.getElementById("introOk");
  const textEl = document.getElementById("introText");
  const imgEl = document.getElementById("introShotImg");
  const countEl = document.getElementById("introCount");
  const dotsWrap = document.getElementById("introDots");
  const prevBtn = document.getElementById("introPrev");
  const nextBtn = document.getElementById("introNext");
  const dontShow = document.getElementById("introDontShow");

  
  const shots = [
    {
      txt: "Welcome to your Pinterest Vault. This is a private space for your saved pins.",
      img: "vault-preview-1.png"
    },
    {
      txt: "This feature is built in natively in pinterest site and the saved pins can also be saved inthis vault as well! you'll see a new button for that as is shown, optionally oyu can disable this feature completely in settings",
      img: "vault-preview-2.png"
    },
    {
      txt: "Feel free to enjoy this feature and avoid your potantial unfair bans. Please read the button that says read here for the features. Side Note: This screen was actually accidentally removed by a mistake, that's why you see it again if you ever pressed *dont show again* lol, sorry",
      img: "vault-preview-3.png"
    }
  ];

  let idx = 0;

  function setSlide(n) {
    if (n < 0) n = shots.length - 1;
    if (n >= shots.length) n = 0;
    idx = n;

    const s = shots[idx];
    if (textEl) textEl.innerHTML = s.txt;
    if (imgEl) imgEl.src = s.img;
    if (countEl) countEl.textContent = `${idx + 1} / ${shots.length}`;

    
    const dots = dotsWrap.querySelectorAll(".intro-dot");
    dots.forEach((d, i) => {
      d.classList.toggle("active", i === idx);
    });
  }

  function hide() {
    modal.classList.remove("show");
    setTimeout(() => { modal.style.display = "none"; }, 200);
  }

  
  dotsWrap.innerHTML = shots.map((_, i) =>
    `<button type="button" class="intro-dot" aria-label="Slide ${i + 1}"></button>`
  ).join("");

  dotsWrap.querySelectorAll(".intro-dot").forEach((b, i) => {
    b.addEventListener("click", () => setSlide(i));
  });

  prevBtn.addEventListener("click", () => setSlide(idx - 1));
  nextBtn.addEventListener("click", () => setSlide(idx + 1));

  function closeAndMaybeSave() {
    const never = !!dontShow?.checked;
    if (never) {
      
      localStorage.setItem(INTRO_KEY, "true");
      hide();
    } else {
      hide();
    }
  }

  okBtn?.addEventListener("click", closeAndMaybeSave);
  xBtn?.addEventListener("click", closeAndMaybeSave);
  backdrop?.addEventListener("click", closeAndMaybeSave);

  window.addEventListener("keydown", (e) => {
    if (!modal.classList.contains("show")) return;
    if (e.key === "Escape") closeAndMaybeSave();
    if (e.key === "ArrowLeft") setSlide(idx - 1);
    if (e.key === "ArrowRight") setSlide(idx + 1);
  });

  
  const isDismissed = localStorage.getItem(INTRO_KEY);
  if (!isDismissed) {
    modal.style.display = "flex";
    
    setTimeout(() => {
      modal.classList.add("show");
      setSlide(0);
    }, 10);
  } else {
    modal.style.display = "none";
  }
})();
