(() => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const todayEl = document.querySelector("[data-today]");
  if (todayEl) {
    const d = new Date();
    todayEl.textContent = d.toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  window.__app = window.__app || {};

  window.__app.prefersReducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)"
  )?.matches;

  window.__app.clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  window.__app.siteRegion =
    window.__app.siteRegion || "Оренбургская область • Уральский регион";
  window.__app.dataFreshness = window.__app.dataFreshness || {
    updatedAt: "",
    sources: [],
  };

  (async () => {
    try {
      const path = "/api/meta";
      const url =
        window.__geoecoApi != null ? await window.__geoecoApi.resolveUrl(path) : path;
      const res = await fetch(url, { method: "GET" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) return;
      if (data.region) window.__app.siteRegion = String(data.region);
      if (data.updatedAt) window.__app.dataFreshness.updatedAt = String(data.updatedAt);
      if (Array.isArray(data.sources)) {
        window.__app.dataFreshness.sources = data.sources
          .map((s) => s?.name)
          .filter(Boolean)
          .slice(0, 6);
      }

      const footerMeta = document.querySelector(".footer__meta");
      const node = footerMeta?.querySelector("[data-site-meta]");
      if (node) {
        const updatedAt = window.__app?.dataFreshness?.updatedAt || "";
        const region = window.__app?.siteRegion || "";
        node.textContent = `${region}${updatedAt ? ` • обновление данных: ${updatedAt}` : ""}`;
      }
    } catch {}
  })();

  try {
    const key = "geoeco_visited_pages";
    const page =
      location.pathname.split("/").filter(Boolean).pop() || "index.html";
    const raw = localStorage.getItem(key);
    const pages = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(pages)) throw new Error("bad");
    if (!pages.includes(page)) {
      pages.push(page);
      localStorage.setItem(key, JSON.stringify(pages.slice(-48)));
    }
  } catch {}

  const nav = document.querySelector("[data-nav]");

  function closeAllNavDropdowns() {
    document.querySelectorAll("[data-nav-dropdown]").forEach((root) => {
      root.classList.remove("nav-dropdown--open");
      const btn = root.querySelector("[data-nav-dropdown-btn]");
      const panel = root.querySelector("[data-nav-dropdown-panel]");
      if (btn) btn.setAttribute("aria-expanded", "false");
      if (panel) panel.hidden = true;
    });
  }

  function setupNavDropdowns() {
    if (!nav) return;
    document.querySelectorAll("[data-nav-dropdown]").forEach((root) => {
      const btn = root.querySelector("[data-nav-dropdown-btn]");
      const panel = root.querySelector("[data-nav-dropdown-panel]");
      if (!btn || !panel) return;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const willOpen = panel.hidden;
        closeAllNavDropdowns();
        if (willOpen) {
          root.classList.add("nav-dropdown--open");
          btn.setAttribute("aria-expanded", "true");
          panel.hidden = false;
        }
      });
      panel.querySelectorAll("a").forEach((a) => {
        a.addEventListener("click", () => closeAllNavDropdowns());
      });
    });

    document.addEventListener("click", () => closeAllNavDropdowns());
  }

  function syncNavActive() {
    if (!nav) return;
    const page = location.pathname.split("/").filter(Boolean).pop() || "index.html";
    const norm = (s) => String(s || "").replace(/^\.\//, "").split("#")[0].toLowerCase();

    nav.querySelectorAll(".nav__link[href], .nav-dropdown__item[href]").forEach((a) => {
      const href = norm(a.getAttribute("href"));
      if (!href || href.startsWith("#")) return;
      const on = page.toLowerCase() === href;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    document.querySelectorAll("[data-nav-dropdown]").forEach((dd) => {
      const any = dd.querySelector(".nav-dropdown__item.is-active");
      dd.classList.toggle("nav-dropdown--current", !!any);
    });
  }

  const toggle = document.querySelector("[data-nav-toggle]");
  const backdrop = document.querySelector("[data-nav-backdrop]");
  if (nav && toggle && backdrop) {
    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      backdrop.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.documentElement.classList.toggle("nav-open", open);
      document.body.classList.toggle("nav-open", open);
      if (!open) closeAllNavDropdowns();
    };

    toggle.addEventListener("click", () => {
      setOpen(!nav.classList.contains("is-open"));
    });

    backdrop.addEventListener("click", () => setOpen(false));

    nav.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (a) setOpen(false);
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeAllNavDropdowns();
        setOpen(false);
      }
    });

    window.addEventListener("resize", () => {
      if (window.matchMedia("(min-width: 821px)").matches) setOpen(false);
    });
  }

  if (nav) {
    const ocean = nav.querySelector(".nav-dropdown__item[href*='ocean.html']");
    if (ocean) {
      ocean.textContent = "Регион";
      ocean.setAttribute("aria-label", "Уральский регион: водные объекты и данные");
    }
    setupNavDropdowns();
    syncNavActive();
  }

  try {
    const footerMeta = document.querySelector(".footer__meta");
    if (footerMeta && !footerMeta.querySelector("[data-site-meta]")) {
      const wrap = document.createElement("div");
      wrap.className = "muted";
      wrap.dataset.siteMeta = "";
      wrap.style.marginTop = "6px";
      const updatedAt = window.__app?.dataFreshness?.updatedAt || "";
      const region = window.__app?.siteRegion || "";
      wrap.textContent = `${region}${updatedAt ? ` • обновление данных: ${updatedAt}` : ""}`;
      footerMeta.appendChild(wrap);
    }
  } catch {}
})();

