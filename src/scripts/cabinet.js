window.addEventListener("geoeco-auth-change", () => {
  const p = location.pathname || "";
  if (/cabinet\.html$/i.test(p)) location.reload();
});

(() => {
  const TOKEN_KEY = "geoeco_auth_token";

  const $ = (sel, root = document) => root.querySelector(sel);

  const reduceMotion =
    window.__app?.prefersReducedMotion ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const els = {
    load: document.querySelector('[data-el="cabinet-load"]'),
    err: document.querySelector('[data-el="cabinet-err"]'),
    gate: document.querySelector('[data-el="cabinet-gate"]'),
    dash: document.querySelector('[data-el="cabinet-dash"]'),
  };

  const visitCount = () => {
    try {
      const a = JSON.parse(localStorage.getItem("geoeco_visited_pages"));
      return Array.isArray(a) ? a.length : 0;
    } catch {
      return 0;
    }
  };

  const aiUserTurns = () => {
    try {
      const a = JSON.parse(localStorage.getItem("geoeco_ai_chat_v1"));
      if (!Array.isArray(a)) return 0;
      return a.filter((m) => m?.role === "user").length;
    } catch {
      return 0;
    }
  };

  function initials(user) {
    const n = String(user?.name || "").trim();
    if (n) {
      const p = n.split(/\s+/).filter(Boolean).slice(0, 2);
      const s = p.map((x) => x[0]).join("").toUpperCase().slice(0, 2);
      return s || "–";
    }
    const em = String(user?.email || "??");
    return em.slice(0, 2).toUpperCase();
  }

  function formatMemberSince(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }

  function tweenNumber(el, target, formatter) {
    if (!el) return;
    const end = Number(target);
    if (!Number.isFinite(end)) {
      el.textContent = formatter ? formatter(end) : String(target);
      return;
    }

    if (reduceMotion) {
      el.textContent = formatter ? formatter(Math.round(end)) : String(Math.round(end));
      return;
    }

    const start = performance.now();
    const from = 0;
    const ms = Math.min(1200, 420 + Math.abs(end) * 12);

    const tick = (now) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (end - from) * eased);
      el.textContent = formatter ? formatter(v) : String(v);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function revealStatCards() {
    if (!els.dash) return;
    const cards = els.dash.querySelectorAll(".cabinet-stat");
    cards.forEach((card, i) => {
      card.style.setProperty("--cabinet-delay", `${40 + i * 75}ms`);
      card.classList.add("is-visible");
    });
  }

  async function apiDashboard(token) {
    const path = "/api/auth/dashboard";
    const url =
      window.__geoecoApi != null ? await window.__geoecoApi.resolveUrl(path) : path;
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "REQUEST_FAILED");
    return data;
  }

  function readToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  }

  function showGuest(message) {
    document.body.classList.add("cabinet-guest-view");
    if (els.load) els.load.hidden = true;
    if (els.dash) els.dash.hidden = true;
    if (els.gate) els.gate.hidden = false;
    if (els.err) {
      if (message) {
        els.err.textContent = message;
        els.err.hidden = false;
      } else {
        els.err.hidden = true;
        els.err.textContent = "";
      }
    }
  }

  function renderDashboard(data) {
    document.body.classList.remove("cabinet-guest-view");
    if (els.load) els.load.hidden = true;
    if (els.err) {
      els.err.hidden = true;
      els.err.textContent = "";
    }
    if (els.gate) els.gate.hidden = true;
    if (els.dash) els.dash.hidden = false;

    const { user, stats } = data;

    const av = $('[data-bind="avatar"]', els.dash);
    if (av) av.textContent = initials(user);

    const nm = $('[data-bind="name"]', els.dash);
    if (nm) nm.textContent = user?.name || "Участник";

    const em = $('[data-bind="email"]', els.dash);
    if (em) em.textContent = user?.email || "";

    const since = $('[data-bind="since"]', els.dash);
    if (since)
      since.textContent = formatMemberSince(user?.created_at) || "Дата будет позже";

    const vPosts = els.dash?.querySelector("#stat-posts");
    const vDays = els.dash?.querySelector("#stat-days");
    const vVisits = els.dash?.querySelector("#stat-visits");
    const vAi = els.dash?.querySelector("#stat-ai");

    requestAnimationFrame(() => {
      tweenNumber(vPosts, stats?.postsInFeed ?? 0, (n) => String(Math.round(n)));
      tweenNumber(vDays, stats?.accountAgeDays ?? 0);
      tweenNumber(vVisits, visitCount(), (n) => String(Math.round(n)));
      tweenNumber(vAi, aiUserTurns(), (n) => String(Math.round(n)));
    });

    revealStatCards();
  }

  function boot() {
    $("[data-cabinet-login]")?.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("[data-auth-open]")?.click();
    });

    const token = readToken();
    if (!token) {
      showGuest(null);
      return;
    }

    apiDashboard(token).then(renderDashboard).catch(() => {
      showGuest(
        "Не удалось загрузить кабинет. Войди снова или проверь, что сервер запущен."
      );
    });
  }

  boot();
})();
