const KEY_VAULT_ENABLED = "pinterestVaultEnabled"; 
const KEY_THEME = "pinterestTheme"; 
const VAULT_KEY = "xzenVaultItems"; 

function flashSaved(text){
  const saved = document.getElementById("savedHint");
  if (!saved) return;
  saved.textContent = text;
  clearTimeout(saved._t);
  saved._t = setTimeout(() => (saved.textContent = ""), 900);
}

function setStatus(on){
  const el = document.getElementById("settingsStatus");
  if (!el) return;
  el.textContent = on ? "Vault enabled" : "Vault disabled";
}

function setSwitch(btn, on){
  if (!btn) return;
  btn.classList.toggle("on", !!on);
  btn.setAttribute("aria-checked", String(!!on));
}

function applyVaultUi(on){
  const openVault = document.getElementById("openVault");
  if (openVault) openVault.disabled = !on;
  setStatus(on);
}

function setThemeHint(theme){
  const el = document.getElementById("themeHint");
  if (!el) return;
  el.textContent = (theme === "gray") ? "Current: Gray" : "Current: AMOLED";
}

document.addEventListener("DOMContentLoaded", () => {
  const vaultSwitch = document.getElementById("vaultSwitch");
  const themeSwitch = document.getElementById("themeSwitch");

  const openVault = document.getElementById("openVault");
  const resetVault = document.getElementById("resetVault");
  const closeTab = document.getElementById("closeTab");

  
  chrome.storage.sync.get(
    {
      [KEY_VAULT_ENABLED]: true,
      [KEY_THEME]: "amoled",
    },
    (d) => {
      const vaultOn = !!d[KEY_VAULT_ENABLED];
      const theme = (d[KEY_THEME] === "gray") ? "gray" : "amoled";

      setSwitch(vaultSwitch, vaultOn);
      applyVaultUi(vaultOn);

      
      setSwitch(themeSwitch, theme === "gray");
      setThemeHint(theme);
    }
  );

  
  if (vaultSwitch) {
    function saveVault(on){
      chrome.storage.sync.set({ [KEY_VAULT_ENABLED]: !!on }, () => {
        flashSaved("Saved");
        applyVaultUi(!!on);
      });
    }

    function setVaultAll(on){
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

  
  if (themeSwitch) {
    function saveTheme(isGray){
      const theme = isGray ? "gray" : "amoled";
      chrome.storage.sync.set({ [KEY_THEME]: theme }, () => {
        flashSaved("Saved");
        setThemeHint(theme);
      });
    }

    function setThemeAll(isGray){
      setSwitch(themeSwitch, isGray);
      setThemeHint(isGray ? "gray" : "amoled");
    }

    themeSwitch.addEventListener("click", () => {
      const nextGray = themeSwitch.getAttribute("aria-checked") !== "true";
      setThemeAll(nextGray);
      saveTheme(nextGray);
    });

    themeSwitch.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      themeSwitch.click();
    });
  }

  
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;

    if (changes[KEY_VAULT_ENABLED]) {
      const on = !!changes[KEY_VAULT_ENABLED].newValue;
      setSwitch(vaultSwitch, on);
      applyVaultUi(on);
    }

    if (changes[KEY_THEME]) {
      const theme = (changes[KEY_THEME].newValue === "gray") ? "gray" : "amoled";
      setSwitch(themeSwitch, theme === "gray");
      setThemeHint(theme);
    }
  });

  if (openVault) {
    openVault.addEventListener("click", () => {
      const url = chrome.runtime.getURL("vault.html");
      window.open(url, "_blank");
    });
  }

  if (resetVault) {
    resetVault.addEventListener("click", () => {
      const ok = confirm("Clear ALL Vault items? This cannot be undone.");
      if (!ok) return;
      chrome.storage.local.set({ [VAULT_KEY]: [] }, () => flashSaved("Vault cleared"));
    });
  }

  if (closeTab) closeTab.addEventListener("click", () => window.close());
});
