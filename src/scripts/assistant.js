(() => {
  const apiPath = "/api/ai/chat";
  const healthPath = "/api/health";
  const DEFAULT_PORTS = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];
  const CHAT_STORAGE_KEY = "geoeco_ai_chat_v1";

  const isLocalHost = () =>
    location.hostname === "localhost" || location.hostname === "127.0.0.1";

  const withTimeout = async (factory, ms) => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    try {
      return await factory(c.signal);
    } finally {
      clearTimeout(t);
    }
  };

  const tryHealth = async (base) => {
    const url = String(base).replace(/\/$/, "") + healthPath;
    const res = await withTimeout(
      (signal) => fetch(url, { method: "GET", signal, cache: "no-store" }),
      1000
    );
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return !!data?.ok;
  };

  const discoverApiBase = async () => {
    if (window.__geoecoApi?.resolve) return window.__geoecoApi.resolve();

    if (!isLocalHost()) return null;

    const fromGlobal = window.__app?.aiApiBase ? String(window.__app.aiApiBase) : null;
    if (fromGlobal) return fromGlobal;

    const fromStorage = localStorage.getItem("aiApiBase");
    if (fromStorage) return fromStorage;

    try {
      if (await tryHealth(location.origin)) {
        localStorage.setItem("aiApiBase", location.origin);
        return location.origin;
      }
    } catch {}

    for (const port of DEFAULT_PORTS) {
      const base = `${location.protocol}//${location.hostname}:${port}`;
      try {
        if (await tryHealth(base)) {
          localStorage.setItem("aiApiBase", base);
          return base;
        }
      } catch {}
    }

    return null;
  };

  let apiBasePromise = null;
  const resolveChatUrl = async () => {
    if (window.__geoecoApi?.resolveUrl)
      return window.__geoecoApi.resolveUrl(apiPath);

    if (window.__app?.aiApiBase) {
      return String(window.__app.aiApiBase).replace(/\/$/, "") + apiPath;
    }

    apiBasePromise = apiBasePromise || discoverApiBase();
    const base = await apiBasePromise;
    if (base != null && String(base).trim()) {
      return String(base).replace(/\/$/, "") + apiPath;
    }

    return `http://localhost:3001${apiPath}`;
  };

  function normalizeHistory(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.text === "string"
    );
  }

  function loadHistory() {
    try {
      const raw = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || "null");
      return normalizeHistory(raw);
    } catch {
      return [];
    }
  }

  function saveHistory(history) {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(history));
    } catch {}
  }

  let history = loadHistory();

  const root = document.createElement("div");
  root.className = "ai-assistant";
  root.setAttribute("data-ai-widget", "");

  const fab = document.createElement("button");
  fab.className = "ai-assistant__fab";
  fab.type = "button";
  fab.setAttribute("aria-label", "Открыть чат помощника");
  fab.setAttribute("aria-expanded", "false");
  fab.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 7h10M7 11h6M7 15h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M6 4h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H11l-4 3v-3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"
        stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>
  `.trim();

  const panel = document.createElement("section");
  panel.className = "ai-assistant__panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Чат помощника");

  const top = document.createElement("div");
  top.className = "ai-assistant__top";
  top.innerHTML = `
    <div>
      <div class="ai-assistant__title">Помощник по воде</div>
      <div class="ai-assistant__subtitle">Контекст сайта, текущая страница и последние реплики учитываются на сервере</div>
    </div>
  `.trim();

  const closeBtn = document.createElement("button");
  closeBtn.className = "ai-assistant__close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Свернуть чат");
  closeBtn.title = "Свернуть (чат сохранится; открыть снова — круглая кнопка)";
  closeBtn.textContent = "×";
  top.appendChild(closeBtn);

  const messages = document.createElement("div");
  messages.className = "ai-assistant__messages";

  const composer = document.createElement("form");
  composer.className = "ai-assistant__composer";
  composer.autocomplete = "off";

  const input = document.createElement("textarea");
  input.className = "ai-assistant__input";
  input.name = "message";
  input.placeholder =
    "Например: «Сделай краткий вывод по разделу про кризис пресных вод»";
  input.rows = 2;

  const actions = document.createElement("div");
  actions.className = "ai-assistant__actions";

  const hint = document.createElement("div");
  hint.className = "ai-assistant__hint";
  hint.textContent = "Enter — отправить, Shift+Enter — новая строка";

  const send = document.createElement("button");
  send.className = "ai-assistant__send";
  send.type = "submit";
  send.textContent = "Спросить";

  actions.appendChild(hint);
  actions.appendChild(send);

  composer.appendChild(input);
  composer.appendChild(actions);

  panel.appendChild(top);
  panel.appendChild(messages);
  panel.appendChild(composer);

  root.appendChild(panel);
  root.appendChild(fab);
  document.body.appendChild(root);

  const MSG_HELLO =
    "Привет! Помогаю в рамках проекта по геоэкологии и водным ресурсам — объяснения по разделам (основы, кризис пресной воды, океан, фактор, решения), структура текста и формулировки.";

  const renderBubble = (role, text) => {
    const msg = document.createElement("div");
    msg.className = "ai-msg" + (role === "user" ? " ai-msg--user" : "");

    const meta = document.createElement("div");
    meta.className = "ai-msg__meta";
    meta.textContent = role === "user" ? "Вы" : "Помощник";

    const body = document.createElement("div");
    body.textContent = String(text ?? "");

    msg.appendChild(meta);
    msg.appendChild(body);
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  };

  const appendMessage = (role, text) => {
    const t = String(text ?? "");
    history.push({ role, text: t });
    saveHistory(history);
    renderBubble(role, t);
  };

  for (const m of history) renderBubble(m.role, m.text);

  const prefersReduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function cancelPanelAnim() {
    try {
      panel.getAnimations()?.forEach((a) => a.cancel());
    } catch {}
  }

  let panelUserOpen = false;

  const syncFabAria = () => {
    fab.setAttribute("aria-expanded", panelUserOpen ? "true" : "false");
    fab.setAttribute(
      "aria-label",
      panelUserOpen ? "Свернуть чат помощника" : "Открыть чат помощника"
    );
  };

  const setOpen = (wantOpen) => {
    cancelPanelAnim();

    panelUserOpen = wantOpen;
    syncFabAria();

    if (wantOpen) {
      panel.hidden = false;

      if (prefersReduceMotion) {
        setTimeout(() => input.focus(), 0);
        return;
      }

      const anim = panel.animate(
        [
          { opacity: 0, transform: "translateY(18px) scale(0.985)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        {
          duration: 300,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "forwards",
        }
      );

      anim.finished
        .catch(() => {})
        .finally(() => {
          try {
            anim.cancel();
          } catch {}
          input.focus();
        });
      return;
    }

    if (prefersReduceMotion || panel.hidden) {
      panel.hidden = true;
      return;
    }

    const anim = panel.animate(
      [
        { opacity: 1, transform: "translateY(0) scale(1)" },
        { opacity: 0, transform: "translateY(24px) scale(0.97)" },
      ],
      { duration: 240, easing: "ease-in", fill: "forwards" }
    );

    anim.finished
      .catch(() => {})
      .finally(() => {
        try {
          anim.cancel();
        } catch {}
        panel.hidden = true;
      });
  };

  fab.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const opening = !panelUserOpen;
    if (opening && history.length === 0) appendMessage("assistant", MSG_HELLO);
    setOpen(opening);
  });

  closeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
  });

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape") return;
      const auth = document.querySelector("[data-auth-modal]");
      if (auth && auth.classList.contains("auth-modal--open")) return;
      if (panelUserOpen) setOpen(false);
    },
    true
  );

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      composer.requestSubmit();
    }
  });

  const CHAT_TURNS_CAP = 20;

  composer.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = String(input.value || "").trim();
    if (!text) return;

    if (history.length === 0) appendMessage("assistant", MSG_HELLO);
    appendMessage("user", text);
    input.value = "";
    send.disabled = true;

    try {
      const url = await resolveChatUrl();
      const messages = history
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-CHAT_TURNS_CAP)
        .map((m) => ({ role: m.role, content: m.text }));
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          pagePath: `${location.pathname || ""}`
            .replace(/\\/g, "/")
            .slice(0, 140),
        }),
      });

      const raw = await res.text();
      let data = null;
      try {
        data = JSON.parse(raw);
      } catch {
        data = { content: raw };
      }

      if (!res.ok) {
        const code = data?.error || "AI_ERROR";
        if (code === "AI_NOT_CONFIGURED") {
          appendMessage(
            "assistant",
            "AI на сервере не настроен. Укажи GIGACHAT_CREDENTIALS в server/.env (или gigachat.credentials в config.local.json) и перезапусти сервер."
          );
        } else {
          appendMessage("assistant", "Не получилось получить ответ от AI. Код: " + code);
        }
        return;
      }

      appendMessage("assistant", data?.content ?? "");
    } catch (err) {
      appendMessage(
        "assistant",
        "Ошибка сети. Проверь, что сервер запущен и страница открыта через http://localhost:PORT (не file://)."
      );
      console.error(err);
    } finally {
      send.disabled = false;
    }
  });

  syncFabAria();
})();
