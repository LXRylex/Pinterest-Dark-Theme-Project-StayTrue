
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggleAmoled");
  const statusLabel = document.getElementById("statusLabel");

  const dimSlider = document.getElementById("dimSlider");
  const dimValue = document.getElementById("dimValue");

  const githubLink = document.getElementById("githubLink");
  const reviewLink = document.getElementById("reviewLink");
  const customLink = document.getElementById("customLink");

  
  const KEY_VAULT_ENABLED = "pinterestVaultEnabled";

  
  const KEY_THEME_TIP_SEEN = "pinterestSeenThemeTip";

  
  const privatePinsBtn = document.getElementById("privatePinsBtn");

  
  const settingsBtn =
    document.getElementById("settingsBtn") ||
    document.getElementById("settingsIcon") ||
    document.getElementById("settings") ||
    document.querySelector("[data-open-settings]");

  
  const modalReview = document.getElementById("modalReview");
  const modalReviewGit = document.getElementById("modalReviewGit");
  const modalReviewGo = document.getElementById("modalReviewGo");

  const REVIEW_URL =
    "https://addons.mozilla.org/tr/firefox/addon/pinterest-amoled-theme/";
  const GITHUB_ISSUES_URL =
    "https://github.com/LXRylex/TrueAMOLED-Projext-Pinterest/issues";

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
  if (customLink) customLink.href = "https://amoled-pinterest.xzentosia.com";

  
  chrome.storage.sync.get({ [KEY_VAULT_ENABLED]: true }, (d) => {
    setVaultButtonVisible(!!d[KEY_VAULT_ENABLED]);
  });

  
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes[KEY_VAULT_ENABLED]) {
      setVaultButtonVisible(!!changes[KEY_VAULT_ENABLED].newValue);
    }
  });

  
  
  
  function showModal(el) {
    if (!el) return;
    el.classList.add("show");
    el.setAttribute("aria-hidden", "false");
  }

  function hideModal(el) {
    if (!el) return;
    el.classList.remove("show");
    el.setAttribute("aria-hidden", "true");
  }

  
  function bindBackdropClose(el) {
    if (!el) return;
    el.addEventListener("mousedown", (e) => {
      if (e.target === el) hideModal(el);
    });
  }

  bindBackdropClose(modalReview);

  
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

  
  const modal500 = document.getElementById("modal500");
  const modalFix = document.getElementById("modalFix");
  const modal500Ok = document.getElementById("modal500Ok");
  const modalFixOk = document.getElementById("modalFixOk");

  
  const modalTheme = document.getElementById("modalTheme");
  const modalThemeOk = document.getElementById("modalThemeOk");
  const modalThemeDont = document.getElementById("modalThemeDont");

  function openNextOncePopups() {
    chrome.storage.sync.get(
      {
        pinterestSeen500Celebration: false,
        pinterestSeenFixTip: false,
        [KEY_THEME_TIP_SEEN]: false,
      },
      (d) => {
        const seen500 = !!d.pinterestSeen500Celebration;
        const seenFix = !!d.pinterestSeenFixTip;
        const seenTheme = !!d[KEY_THEME_TIP_SEEN];

        if (!seen500 && modal500) showModal(modal500);
        else if (!seenFix && modalFix) showModal(modalFix);
        else if (!seenTheme && modalTheme) showModal(modalTheme);
      }
    );
  }

  if (modal500Ok) {
    modal500Ok.addEventListener("click", () => {
      chrome.storage.sync.set({ pinterestSeen500Celebration: true }, () => {
        hideModal(modal500);
        chrome.storage.sync.get({ pinterestSeenFixTip: false }, (d) => {
          if (!d.pinterestSeenFixTip && modalFix) showModal(modalFix);
          else {
            chrome.storage.sync.get({ [KEY_THEME_TIP_SEEN]: false }, (x) => {
              if (!x[KEY_THEME_TIP_SEEN] && modalTheme) showModal(modalTheme);
            });
          }
        });
      });
    });
  }

  if (modalFixOk) {
    modalFixOk.addEventListener("click", () => {
      chrome.storage.sync.set({ pinterestSeenFixTip: true }, () => {
        hideModal(modalFix);

        
        chrome.storage.sync.get({ [KEY_THEME_TIP_SEEN]: false }, (d) => {
          if (!d[KEY_THEME_TIP_SEEN] && modalTheme) showModal(modalTheme);
        });
      });
    });
  }

  
  if (modalThemeOk) {
    modalThemeOk.addEventListener("click", () => {
      const dont = !!modalThemeDont?.checked;

      if (dont) {
        chrome.storage.sync.set({ [KEY_THEME_TIP_SEEN]: true }, () => {
          hideModal(modalTheme);
        });
      } else {
        hideModal(modalTheme);
      }
    });
  }

  
  chrome.storage.sync.get(
    { pinterestAmoledEnabled: false, pinterestDimLevel: 0 },
    (data) => {
      const enabled = !!data.pinterestAmoledEnabled;
      const dimLevel = Number(data.pinterestDimLevel) || 0;

      applyState(enabled);
      setDimUI(enabled ? dimLevel : 0);

      openNextOncePopups();
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
