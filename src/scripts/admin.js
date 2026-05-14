window.addEventListener("geoeco-auth-change", () => {
  const p = location.pathname || "";
  if (/admin\.html$/i.test(p)) location.reload();
});

(() => {
  const TOKEN_KEY = "geoeco_auth_token";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const els = {
    load: $('[data-el="admin-load"]'),
    err: $('[data-el="admin-err"]'),
    gate: $('[data-el="admin-gate"]'),
    forbidden: $('[data-el="admin-forbidden"]'),
    dash: $('[data-el="admin-dash"]'),
    feedbackBody: $("[data-admin-feedback-body]"),
    usersBody: $("[data-admin-users-body]"),
    monitoringBody: $("[data-admin-monitoring-body]"),
    sourcesBody: $("[data-admin-sources-body]"),
  };

  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function readToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  }

  async function api(path, opts = {}) {
    const url =
      window.__geoecoApi != null ? await window.__geoecoApi.resolveUrl(path) : path;
    const headers = {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    };
    const t = readToken();
    if (t) headers.Authorization = `Bearer ${t}`;

    const res = await fetch(url, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  function showErr(msg) {
    if (!els.err) return;
    els.err.hidden = !msg;
    els.err.textContent = msg || "";
  }

  function setView(which) {
    if (els.load) els.load.hidden = which !== "load";
    if (els.gate) els.gate.hidden = which !== "gate";
    if (els.forbidden) els.forbidden.hidden = which !== "forbidden";
    if (els.dash) els.dash.hidden = which !== "dash";
    showErr("");
  }

  function formatDt(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(iso);
    }
  }

  function formatSampleDate(iso) {
    if (!iso) return "—";
    const s = String(iso);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      try {
        return new Date(s + "T12:00:00").toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      } catch {
        return s;
      }
    }
    return formatDt(iso);
  }

  function tweenNumber(el, target) {
    if (!el) return;
    const end = Number(target);
    if (!Number.isFinite(end)) {
      el.textContent = String(target);
      return;
    }
    if (reduceMotion) {
      el.textContent = String(Math.round(end));
      return;
    }
    const start = performance.now();
    const from = 0;
    const ms = Math.min(1100, 400 + Math.abs(end) * 10);
    const tick = (now) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(from + (end - from) * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function revealStats() {
    if (!els.dash) return;
    const cards = els.dash.querySelectorAll(".admin-stat");
    cards.forEach((card, i) => {
      card.style.setProperty("--admin-delay", `${45 + i * 70}ms`);
      card.classList.add("is-visible");
    });
  }

  const statKeys = ["users", "feedback", "measurements", "waterBodies", "metrics", "dataSources"];

  async function loadOverview() {
    const { res, data } = await api("/api/admin/overview", { method: "GET" });
    if (!res.ok) throw new Error(data?.error || "REQUEST_FAILED");
    const counts = data.counts || {};
    for (const key of statKeys) {
      const card = $(`[data-stat="${key}"]`);
      const el = card?.querySelector('[data-bind="count"]');
      tweenNumber(el, counts[key] ?? 0);
    }
    requestAnimationFrame(() => revealStats());
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function loadFeedback() {
    const { res, data } = await api("/api/admin/feedback?limit=80", {
      method: "GET",
    });
    if (!res.ok) throw new Error(data?.error || "REQUEST_FAILED");
    const items = data.items || [];
    if (!els.feedbackBody) return;
    els.feedbackBody.innerHTML = items.length
      ? items
          .map(
            (r) => `
      <tr data-feedback-id="${r.id}">
        <td>${esc(formatDt(r.created_at))}</td>
        <td><strong>${esc(r.name)}</strong><br /><code>${esc(r.email)}</code></td>
        <td><div class="admin-msg-preview">${esc(r.message)}</div></td>
        <td>
          <button type="button" class="btn btn--danger btn--sm" data-del-feedback="${r.id}">
            Удалить
          </button>
        </td>
      </tr>`
          )
          .join("")
      : `<tr><td colspan="4" class="muted">Пока нет обращений.</td></tr>`;
  }

  async function loadUsers() {
    const { res, data } = await api("/api/admin/users?limit=120", {
      method: "GET",
    });
    if (!res.ok) throw new Error(data?.error || "REQUEST_FAILED");
    const items = data.items || [];
    if (!els.usersBody) return;
    els.usersBody.innerHTML = items.length
      ? items
          .map(
            (r) => `
      <tr>
        <td><code>${esc(r.id)}</code></td>
        <td>${esc(r.name)}</td>
        <td><code>${esc(r.email)}</code></td>
        <td>${
          r.is_admin
            ? '<span class="admin-pill admin-pill--admin">Админ</span>'
            : '<span class="admin-pill">Пользователь</span>'
        }</td>
        <td>${esc(formatDt(r.created_at))}</td>
      </tr>`
          )
          .join("")
      : `<tr><td colspan="5" class="muted">Нет пользователей.</td></tr>`;
  }

  async function loadMonitoring() {
    const { res, data } = await api("/api/admin/monitoring-recent?limit=100", {
      method: "GET",
    });
    if (!res.ok) throw new Error(data?.error || "REQUEST_FAILED");
    const items = data.items || [];
    if (!els.monitoringBody) return;
    els.monitoringBody.innerHTML = items.length
      ? items
          .map((r) => {
            const unit = r.metric_unit ? ` ${esc(r.metric_unit)}` : "";
            const v =
              r.value != null && Number.isFinite(Number(r.value))
                ? String(Number(r.value))
                : esc(r.value);
            const src = r.source_name ? esc(r.source_name) : "—";
            const meth = r.method
              ? `<div class="muted" style="font-size:11px">${esc(r.method)}</div>`
              : "";
            return `
      <tr>
        <td>${esc(formatSampleDate(r.collected_at))}</td>
        <td><strong>${esc(r.water_body)}</strong></td>
        <td>
          <code>${esc(r.metric_code)}</code>
          <div class="muted" style="font-size:12px">${esc(r.metric_title || "")}</div>
        </td>
        <td>${v}${unit}${meth}</td>
        <td>${src}</td>
      </tr>`;
          })
          .join("")
      : `<tr><td colspan="5" class="muted">Нет строк измерений. Импортируйте данные через API или скрипты.</td></tr>`;
  }

  async function loadSources() {
    const { res, data } = await api("/api/admin/data-sources", { method: "GET" });
    if (!res.ok) throw new Error(data?.error || "REQUEST_FAILED");
    const items = data.items || [];
    if (!els.sourcesBody) return;
    els.sourcesBody.innerHTML = items.length
      ? items
          .map((r) => {
            const url = r.url
              ? `<a href="${esc(r.url)}" rel="noopener noreferrer" target="_blank">ссылка</a>`
              : "—";
            const notesVal = r.notes != null ? String(r.notes) : "";
            return `
      <tr data-source-row="${r.id}">
        <td><code>${esc(r.id)}</code></td>
        <td><strong>${esc(r.name)}</strong></td>
        <td>${url}</td>
        <td><code>${esc(String(r.measurement_count ?? 0))}</code></td>
        <td>
          <textarea class="admin-source-notes" data-source-notes rows="3" maxlength="2000">${esc(notesVal)}</textarea>
        </td>
        <td>
          <button type="button" class="btn btn--accent btn--sm" data-save-source="${r.id}">
            Сохранить
          </button>
        </td>
      </tr>`;
          })
          .join("")
      : `<tr><td colspan="6" class="muted">Источники не заведены.</td></tr>`;
  }

  async function loadDataPanels() {
    await Promise.all([loadMonitoring(), loadSources()]);
  }

  const loaded = {
    overview: false,
    feedback: false,
    users: false,
    data: false,
  };

  async function ensurePanel(id) {
    if (id === "overview" && !loaded.overview) {
      await loadOverview();
      loaded.overview = true;
    }
    if (id === "feedback" && !loaded.feedback) {
      await loadFeedback();
      loaded.feedback = true;
    }
    if (id === "users" && !loaded.users) {
      await loadUsers();
      loaded.users = true;
    }
    if (id === "data" && !loaded.data) {
      await loadDataPanels();
      loaded.data = true;
    }
  }

  function selectTab(id) {
    $$(".admin-tab").forEach((btn) => {
      const active = btn.dataset.adminTab === id;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    $$(".admin-panel").forEach((panel) => {
      const match = panel.dataset.adminPanel === id;
      panel.hidden = !match;
    });
    ensurePanel(id).catch((e) => {
      showErr("Не удалось загрузить раздел. Попробуйте ещё раз.");
      console.error(e);
    });
  }

  async function init() {
    const token = readToken();
    if (!token) {
      setView("gate");
      return;
    }

    const meRes = await api("/api/auth/me", { method: "GET" });
    if (!meRes.res.ok) {
      setView("gate");
      return;
    }
    if (!meRes.data?.user?.is_admin) {
      setView("forbidden");
      return;
    }

    setView("dash");
    selectTab("overview");

    const loginBtn = $("[data-admin-login]");
    if (loginBtn) {
      loginBtn.addEventListener("click", () => {
        const open = $("[data-auth-open]");
        if (open) open.click();
      });
    }

    $$(".admin-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.adminTab;
        if (id) selectTab(id);
      });
    });

    document.addEventListener("click", async (e) => {
      const fbId = e.target?.closest?.("[data-del-feedback]")?.dataset?.delFeedback;
      if (fbId) {
        if (!confirm("Удалить это обращение?")) return;
        const { res } = await api(`/api/admin/feedback/${fbId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          showErr("Не удалось удалить обращение.");
          return;
        }
        loaded.feedback = false;
        await ensurePanel("feedback");
        loaded.overview = false;
        await ensurePanel("overview");
        return;
      }

      const srcId = e.target?.closest?.("[data-save-source]")?.dataset?.saveSource;
      if (srcId) {
        const row = e.target.closest("[data-source-row]");
        const ta = row?.querySelector("[data-source-notes]");
        const notes = ta ? String(ta.value || "").trim() : "";
        const { res } = await api(`/api/admin/data-sources/${srcId}`, {
          method: "PATCH",
          body: JSON.stringify({ notes }),
        });
        if (!res.ok) {
          showErr("Не удалось сохранить примечание.");
          return;
        }
        showErr("");
        const btn = e.target.closest("[data-save-source]");
        if (btn) {
          const t = btn.textContent;
          btn.textContent = "Сохранено";
          setTimeout(() => {
            btn.textContent = t;
          }, 1600);
        }
        loaded.overview = false;
        await ensurePanel("overview");
        await loadSources();
      }
    });
  }

  if (window.__geoecoApi?.prime) {
    window.__geoecoApi.prime().finally(() => {
      init().catch((e) => {
        console.error(e);
        setView("gate");
        showErr("Ошибка инициализации. Проверьте, что API запущен.");
      });
    });
  } else {
    init().catch((e) => {
      console.error(e);
      setView("gate");
      showErr("Ошибка инициализации.");
    });
  }
})();
