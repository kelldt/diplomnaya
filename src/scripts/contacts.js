(() => {
  const app = window.__app;
  if (!app) return;

  const form = document.querySelector("[data-contact-form]");
  if (!form) return;

  const nameEl = form.querySelector("input[name='name']");
  const emailEl = form.querySelector("input[name='email']");
  const msgEl = form.querySelector("textarea[name='message']");
  const alertEl = form.querySelector(".form__alert");
  const statusEl = form.querySelector("[data-form-status]");

  if (!nameEl || !emailEl || !msgEl || !alertEl || !statusEl) return;

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const clearUI = () => {
    alertEl.textContent = "";
    statusEl.textContent = "";
    nameEl.closest(".field")?.classList.remove("is-error");
    emailEl.closest(".field")?.classList.remove("is-error");
    msgEl.closest(".field")?.classList.remove("is-error");
  };

  const setError = (el, message) => {
    el.closest(".field")?.classList.add("is-error");
    alertEl.textContent = message;
  };

  const onInput = (e) => {
    const field = e.target?.closest?.(".field");
    if (field) field.classList.remove("is-error");
    if (alertEl.textContent) alertEl.textContent = "";
    if (statusEl.textContent) statusEl.textContent = "";
  };

  nameEl.addEventListener("input", onInput);
  emailEl.addEventListener("input", onInput);
  msgEl.addEventListener("input", onInput);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearUI();

    const name = String(nameEl.value || "").trim();
    const email = String(emailEl.value || "").trim();
    const message = String(msgEl.value || "").trim();

    if (!name) {
      setError(nameEl, "Укажите имя.");
      return;
    }

    if (!email || !emailRe.test(email)) {
      setError(emailEl, "Укажите корректный email.");
      return;
    }

    if (!message) {
      setError(msgEl, "Введите сообщение.");
      return;
    }

    statusEl.textContent = "Отправляем…";

    (async () => {
      try {
        const path = "/api/feedback";
        const url =
          window.__geoecoApi != null ? await window.__geoecoApi.resolveUrl(path) : path;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, message }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const code = data?.error || "REQUEST_FAILED";
          throw new Error(code);
        }
        statusEl.textContent = "Сообщение отправлено";
        form.reset();
      } catch {
        statusEl.textContent = "";
        setError(msgEl, "Не удалось отправить сообщение. Проверь, что сервер запущен.");
      }
    })();
  });
})();

