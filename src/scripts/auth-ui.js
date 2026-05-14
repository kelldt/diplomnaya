(() => {
  const TOKEN_KEY = "geoeco_auth_token";
  const DISPLAY_HINT_KEY = "geoeco_auth_display_hint";
  const ADMIN_HINT_KEY = "geoeco_auth_is_admin";

  function ensureAuthMarkup() {
    if (document.querySelector("[data-auth-modal]")) return;
    const tpl = document.createElement("template");
    tpl.innerHTML = `
<div class="auth-modal" data-auth-modal aria-hidden="true" inert>
  <div class="auth-modal__panel" role="dialog" aria-modal="true" aria-label="Вход и регистрация">
    <div class="auth-modal__top">
      <h2 class="auth-modal__title">Вход</h2>
      <button class="auth-close" type="button" data-auth-close aria-label="Закрыть">×</button>
    </div>
    <div class="auth-tabs" role="tablist" aria-label="Авторизация">
      <button class="auth-tab" type="button" role="tab" aria-selected="true" data-auth-tab="login">Вход</button>
      <button class="auth-tab" type="button" role="tab" aria-selected="false" data-auth-tab="register">Регистрация</button>
    </div>
    <div class="auth-alert" data-auth-alert role="alert" aria-live="polite"></div>
    <div data-auth-panel="login">
      <form class="auth-form" data-auth-form="login">
        <label class="field">
          <span class="field__label">Email</span>
          <input class="field__input" name="email" type="email" autocomplete="email" required />
        </label>
        <label class="field">
          <span class="field__label">Пароль</span>
          <input class="field__input" name="password" type="password" autocomplete="current-password" required />
        </label>
        <div class="form__actions"><button class="btn" type="submit">Войти</button></div>
      </form>
    </div>
    <div data-auth-panel="register" hidden>
      <form class="auth-form" data-auth-form="register">
        <label class="field">
          <span class="field__label">Имя</span>
          <input class="field__input" name="name" type="text" autocomplete="name" required />
        </label>
        <label class="field">
          <span class="field__label">Email</span>
          <input class="field__input" name="email" type="email" autocomplete="email" required />
        </label>
        <label class="field">
          <span class="field__label">Пароль</span>
          <input class="field__input" name="password" type="password" autocomplete="new-password" required />
        </label>
        <div class="form__actions">
          <button class="btn" type="submit">Создать аккаунт</button>
          <span class="muted">мин. 6 символов</span>
        </div>
      </form>
    </div>
  </div>
</div>`.trim();
    document.body.appendChild(tpl.content);
  }

  ensureAuthMarkup();

  window.__app = window.__app || {};

  const q = (sel) => document.querySelector(sel);
  const modal = q("[data-auth-modal]");
  const openBtn = q("[data-auth-open]");
  const logoutBtn = q("[data-auth-logout]");
  const userEl = q("[data-auth-user]");

  const tabLogin = q("[data-auth-tab='login']");
  const tabRegister = q("[data-auth-tab='register']");
  const panelLogin = q("[data-auth-panel='login']");
  const panelRegister = q("[data-auth-panel='register']");

  const alertEl = q("[data-auth-alert]");
  const closeBtn = q("[data-auth-close]");

  function polishAccountControls() {
    if (openBtn) {
      openBtn.classList.remove("nav__link");
      openBtn.classList.add("nav__acct-link", "nav__acct-link--login");
      openBtn.setAttribute("aria-label", "Вход в личный кабинет");
    }
    if (logoutBtn) {
      logoutBtn.classList.remove("nav__link");
      logoutBtn.classList.add("nav__acct-link", "nav__acct-link--logout");
      logoutBtn.setAttribute("aria-label", "Выйти из аккаунта");
    }
    if (userEl) userEl.classList.add("nav__acct-user-chip");
  }

  polishAccountControls();

  let memToken = "";

  try {
    memToken = localStorage.getItem(TOKEN_KEY) || "";
  } catch {}

  function readDisplayHint() {
    try {
      const v = localStorage.getItem(DISPLAY_HINT_KEY);
      return v ? String(v).trim().slice(0, 120) : "";
    } catch {
      return "";
    }
  }

  function saveDisplayHint(user) {
    try {
      if (!user) {
        localStorage.removeItem(DISPLAY_HINT_KEY);
        return;
      }
      const hint = user.name || user.email || "";
      if (hint) localStorage.setItem(DISPLAY_HINT_KEY, hint);
    } catch {}
  }

  function decodeJwtPayload(tokenStr) {
    if (!tokenStr) return null;
    const parts = String(tokenStr).split(".");
    if (parts.length < 2) return null;
    try {
      const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
      const binary = atob(b64 + pad);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const json = new TextDecoder().decode(bytes);
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function saveAdminHint(user) {
    try {
      if (!user) {
        localStorage.removeItem(ADMIN_HINT_KEY);
        return;
      }
      localStorage.setItem(ADMIN_HINT_KEY, user.is_admin ? "1" : "0");
    } catch {}
  }

  function readAdminVisibilityHint() {
    try {
      const v = localStorage.getItem(ADMIN_HINT_KEY);
      if (v === "1") return true;
      if (v === "0") return false;
    } catch {}
    const payload = decodeJwtPayload(memToken);
    return payload?.admin === true;
  }

  const token = () => memToken;

  function syncAuthSessionHtmlClass() {
    document.documentElement.classList.toggle("auth-session", !!memToken);
  }

  const setToken = (t) => {
    memToken = String(t || "");
    try {
      if (memToken) localStorage.setItem(TOKEN_KEY, memToken);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
    syncAuthSessionHtmlClass();
  };
  const clearToken = () => {
    memToken = "";
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ADMIN_HINT_KEY);
    } catch {}
    syncAuthSessionHtmlClass();
  };

  syncAuthSessionHtmlClass();

  function setAlert(msg) {
    if (!alertEl) return;
    alertEl.textContent = msg || "";
  }

  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let hideModalUnlockTimer = 0;

  function pulseIncomingPanel(panelEl, revealHint) {
    if (!panelEl || reduceMotion) return;
    panelEl.dataset.sheetReveal = revealHint === "register" ? "right" : "left";
    panelEl.classList.remove("auth-sheet-anim");
    void panelEl.offsetWidth;
    panelEl.classList.add("auth-sheet-anim");
    panelEl.addEventListener(
      "animationend",
      () => panelEl.classList.remove("auth-sheet-anim"),
      { once: true }
    );
  }

  function showModal() {
    if (!modal) return;
    if ("inert" in modal) modal.inert = false;
    modal.removeAttribute("hidden");
    setAlert("");
    document.body.style.overflow = "hidden";
    modal.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => modal.classList.add("auth-modal--open"));
  }

  function hideModal() {
    if (!modal || !modal.classList.contains("auth-modal--open")) return;

    if ("inert" in modal) modal.inert = true;

    clearTimeout(hideModalUnlockTimer);
    modal.classList.remove("auth-modal--open");
    modal.setAttribute("aria-hidden", "true");
    setAlert("");

    if (reduceMotion) {
      document.body.style.overflow = "";
      hideModalUnlockTimer = 0;
      return;
    }

    const cleanup = () => {
      modal.removeEventListener("transitionend", onEnd);
      document.body.style.overflow = "";
      hideModalUnlockTimer = 0;
    };

    let finalized = false;
    const finalize = () => {
      if (finalized) return;
      finalized = true;
      cleanup();
    };

    function onEnd(e) {
      if (e.target !== modal) return;
      if (e.propertyName !== "opacity") return;
      finalize();
    }

    modal.addEventListener("transitionend", onEnd);
    hideModalUnlockTimer = setTimeout(finalize, 480);
  }

  function selectTab(which, opts = {}) {
    const { animated = true } = opts;
    const isLogin = which === "login";
    if (tabLogin) tabLogin.setAttribute("aria-selected", String(isLogin));
    if (tabRegister) tabRegister.setAttribute("aria-selected", String(!isLogin));
    const outgoing = isLogin ? panelRegister : panelLogin;
    const incoming = isLogin ? panelLogin : panelRegister;
    if (outgoing) outgoing.hidden = true;
    if (incoming) incoming.hidden = false;
    setAlert("");
    if (incoming && animated) {
      pulseIncomingPanel(incoming, isLogin ? "login" : "register");
    }
  }

  async function api(path, opts = {}) {
    const url =
      window.__geoecoApi != null ? await window.__geoecoApi.resolveUrl(path) : path;
    const headers = {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    };
    const t = token();
    if (t) headers.Authorization = `Bearer ${t}`;

    const res = await fetch(url, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = data?.error || "REQUEST_FAILED";
      throw new Error(code);
    }
    return data;
  }

  function setAuthedUI(user) {
    saveDisplayHint(user || null);
    saveAdminHint(user || null);
    if (userEl) {
      userEl.hidden = !user;
      userEl.textContent = user ? user.name || user.email : "";
      userEl.title = user ? user.name || user.email || "" : "";
      userEl.classList.remove("nav__acct-user-chip--pending");
      userEl.removeAttribute("aria-busy");
    }
    if (openBtn) openBtn.hidden = !!user;
    if (logoutBtn) logoutBtn.hidden = !user;
    setCabinetNavVisible(!!user);
    setAdminNavVisible(!!user?.is_admin);
  }

  function hydrateAuthFromStoredTokenSync() {
    if (!token()) return;
    const hint = readDisplayHint();
    if (userEl) {
      userEl.hidden = false;
      userEl.textContent = hint || "\u2060";
      userEl.title = hint || "";
      if (!hint) userEl.setAttribute("aria-busy", "true");
      else userEl.removeAttribute("aria-busy");
      userEl.classList.toggle("nav__acct-user-chip--pending", !hint);
    }
    if (openBtn) openBtn.hidden = true;
    if (logoutBtn) logoutBtn.hidden = false;
    setCabinetNavVisible(true);
    setAdminNavVisible(readAdminVisibilityHint());
  }

  function emitAuthChange() {
    try {
      window.dispatchEvent(new CustomEvent("geoeco-auth-change"));
    } catch {}
  }

  function ensureCabinetNavLink() {
    let link = q("[data-auth-cabinet]");
    if (!link) {
      const trigger = q(".auth-trigger");
      const ob = q("[data-auth-open]");
      if (!trigger || !ob) return null;
      link = document.createElement("a");
      link.className = "nav__acct-link nav__acct-link--cabinet";
      link.href = "./cabinet.html";
      link.textContent = "Кабинет";
      link.dataset.authCabinet = "";
      link.setAttribute("aria-label", "Перейти в личный кабинет");
      ob.before(link);
    }
    return link;
  }

  function setCabinetNavVisible(visible) {
    const link = ensureCabinetNavLink();
    if (!link) return;
    link.hidden = !visible;
    const onCabinet = /cabinet\.html$/i.test(location.pathname);
    link.classList.toggle("is-active", Boolean(visible && onCabinet));
    if (visible && onCabinet) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }

  function ensureAdminNavLink() {
    let link = q("[data-auth-admin]");
    if (!link) {
      const cabinet = q("[data-auth-cabinet]");
      const ob = q("[data-auth-open]");
      const trigger = q(".auth-trigger");
      if (!trigger || !ob) return null;
      link = document.createElement("a");
      link.className = "nav__acct-link nav__acct-link--admin";
      link.href = "./admin.html";
      link.textContent = "Админ";
      link.dataset.authAdmin = "";
      link.setAttribute("aria-label", "Панель администратора");
      if (cabinet) cabinet.after(link);
      else ob.before(link);
    }
    return link;
  }

  function setAdminNavVisible(visible) {
    const link = ensureAdminNavLink();
    if (!link) return;
    link.hidden = !visible;
    const onAdmin = /admin\.html$/i.test(location.pathname);
    link.classList.toggle("is-active", Boolean(visible && onAdmin));
    if (visible && onAdmin) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }

  async function refreshMe() {
    const t = token();
    if (!t) {
      setAuthedUI(null);
      return;
    }
    try {
      const data = await api("/api/auth/me", { method: "GET" });
      setAuthedUI(data.user);
    } catch {
      clearToken();
      saveDisplayHint(null);
      setAuthedUI(null);
    }
  }

  function wireForm(formSel, endpoint, mapBody) {
    const form = q(formSel);
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setAlert("");

      try {
        const body = mapBody(new FormData(form));
        const data = await api(endpoint, {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (data?.token) setToken(data.token);
        await refreshMe();
        hideModal();
        form.reset();
        emitAuthChange();
      } catch (err) {
        const code = String(err?.message || "REQUEST_FAILED");
        const map = {
          BAD_REQUEST: "Заполни все поля.",
          PASSWORD_TOO_SHORT: "Пароль должен быть минимум 6 символов.",
          EMAIL_TAKEN: "Этот email уже зарегистрирован.",
          INVALID_CREDENTIALS: "Неверный email или пароль.",
          REQUEST_FAILED: "Не удалось выполнить запрос.",
        };
        setAlert(map[code] || "Ошибка. Проверь данные и повтори.");
      }
    });
  }

  if (openBtn) openBtn.addEventListener("click", (e) => (e.preventDefault(), showModal()));
  if (logoutBtn)
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      clearToken();
      setAuthedUI(null);
      emitAuthChange();
    });

  if (closeBtn) closeBtn.addEventListener("click", hideModal);
  if (modal)
    modal.addEventListener("click", (e) => {
      if (e.target === modal) hideModal();
    });

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!modal || !modal.classList.contains("auth-modal--open")) return;
    hideModal();
  });

  if (tabLogin) tabLogin.addEventListener("click", () => selectTab("login", { animated: true }));
  if (tabRegister) tabRegister.addEventListener("click", () => selectTab("register", { animated: true }));

  wireForm("[data-auth-form='login']", "/api/auth/login", (fd) => ({
    email: String(fd.get("email") || ""),
    password: String(fd.get("password") || ""),
  }));
  wireForm("[data-auth-form='register']", "/api/auth/register", (fd) => ({
    name: String(fd.get("name") || ""),
    email: String(fd.get("email") || ""),
    password: String(fd.get("password") || ""),
  }));

  selectTab("login", { animated: false });

  hydrateAuthFromStoredTokenSync();

  if (window.__geoecoApi?.prime) {
    window.__geoecoApi.prime().finally(() => refreshMe());
  } else {
    refreshMe();
  }
})();

