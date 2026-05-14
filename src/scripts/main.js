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

const prefersReducedMotion = window.matchMedia?.(
  "(prefers-reduced-motion: reduce)"
);

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function setupParallax() {
  if (prefersReducedMotion?.matches) return;

  const frames = Array.from(document.querySelectorAll("[data-parallax]"));
  if (!frames.length) return;

  let rafId = 0;

  const onScroll = () => {
    if (rafId) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      const viewportH = window.innerHeight || 1;

      for (const frame of frames) {
        const img = frame.querySelector(".media-frame__img");
        if (!img) continue;

        const rect = frame.getBoundingClientRect();
        const isVisible = rect.bottom > 0 && rect.top < viewportH;
        if (!isVisible) continue;

        const progress = (viewportH - rect.top) / (viewportH + rect.height);
        const t = clamp(progress, 0, 1);
        const offset = (t - 0.5) * 46;
        img.style.transform = `translate3d(0, ${offset}px, 0) scale(1.22)`;
      }
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();
}

setupParallax();

function setupWideParallax() {
  if (prefersReducedMotion?.matches) return;

  const bg = document.querySelector("[data-wide-parallax]");
  if (!bg) return;

  let rafId = 0;

  const onScroll = () => {
    if (rafId) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      const viewportH = window.innerHeight || 1;
      const section = bg.parentElement;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const isVisible = rect.bottom > 0 && rect.top < viewportH;
      if (!isVisible) return;

      const progress = (viewportH - rect.top) / (viewportH + rect.height);
      const t = clamp(progress, 0, 1);
      const offset = (t - 0.5) * 90;
      bg.style.transform = `translate3d(0, ${offset}px, 0) scale(1.12)`;
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();
}

setupWideParallax();

function setupCarousel() {
  const root = document.querySelector("[data-carousel]");
  if (!root) return;

  const img = root.querySelector("img");
  const caption = root.querySelector("[data-caption]");
  const prevBtn = root.querySelector("[data-prev]");
  const nextBtn = root.querySelector("[data-next]");
  if (!img || !caption || !prevBtn || !nextBtn) return;

  const slides = [
      {
        src: "./src/assets/photos/05.jpg",
        alt: "Высохшее русло озера и аридный ландшафт — утрата поверхностного стока",
        note: "Обмеление и усыхание акваторий: климат, отбор воды и перераспределение стока.",
      },
      {
        src: "./src/assets/photos/06.jpg",
        alt: "Трещины на высохшем грунте — дефицит влаги в почвенном и поверхностном контуре",
        note: "Засуха и почвенно-растительный слой: маркеры стресса водного баланса в бассейне.",
      },
      {
        src: "./src/assets/photos/07.jpg",
        alt: "Вид сверху на круговые поля орошения — интенсивное водопотребление",
        note: "Орошаемые системы как крупный стабильный отбор поверхностных и подземных вод.",
      },
  ];

  let idx = 0;

  const render = () => {
    const s = slides[idx];
    img.src = s.src;
    img.alt = s.alt;
    caption.textContent = `${idx + 1}/${slides.length} — ${s.note}`;
  };

  const go = (dir) => {
    idx = (idx + dir + slides.length) % slides.length;
    render();
  };

  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") go(-1);
    if (e.key === "ArrowRight") go(1);
  });

  render();
}

function setupCounters() {
  const root = document.querySelector("[data-counters]");
  if (!root) return;

  const nodes = Array.from(root.querySelectorAll("[data-count-to]"));
  if (!nodes.length) return;

  const animate = (el) => {
    const targetRaw = el.getAttribute("data-count-to") || "0";
    const suffix = el.getAttribute("data-suffix") || "";
    const target = Number(targetRaw);
    if (!Number.isFinite(target)) return;

    const renderedTarget = `${target.toLocaleString("ru-RU")}${suffix}`;
    if (renderedTarget.length >= 10) el.classList.add("is-long");

    if (prefersReducedMotion?.matches) {
      el.textContent = renderedTarget;
      return;
    }

    const start = performance.now();
    const duration = 1200;

    const tick = (now) => {
      const t = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(target * eased);
      el.textContent = `${value.toLocaleString("ru-RU")}${suffix}`;
      if (t < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  };

  const seen = new WeakSet();

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        if (seen.has(el)) continue;
        seen.add(el);
        animate(el);
      }
    },
    { threshold: 0.35 }
  );

  for (const el of nodes) io.observe(el);
}

setupCarousel();
setupCounters();

function setupBeforeAfter() {
  const root = document.querySelector("[data-before-after]");
  if (!root) return;

  const clip = root.querySelector("[data-clip]");
  const handle = root.querySelector("[data-handle]");
  const range = root.querySelector("input[type='range']");
  if (!clip || !handle || !range) return;

  const set = (value) => {
    const v = clamp(Number(value), 0, 100);
    clip.style.width = `${v}%`;
    handle.style.left = `${v}%`;
  };

  range.addEventListener("input", (e) => set(e.target.value));
  set(range.value);
}

setupBeforeAfter();

function setupAccordion() {
  const root = document.querySelector("[data-accordion]");
  if (!root) return;

  const items = Array.from(root.querySelectorAll(".accordion__item"));
  if (!items.length) return;

  for (const item of items) {
    const btn = item.querySelector("[data-acc-btn]");
    const panel = item.querySelector("[data-acc-panel]");
    const icon = item.querySelector(".accordion__icon");
    if (!btn || !panel || !icon) continue;

    const setOpen = (open) => {
      item.classList.toggle("is-open", open);
      icon.textContent = open ? "−" : "+";

      if (prefersReducedMotion?.matches) return;
      if (open) {
        panel.style.maxHeight = `${panel.scrollHeight}px`;
      } else {
        panel.style.maxHeight = "0px";
      }
    };

    setOpen(false);

    btn.addEventListener("click", () => {
      const open = !item.classList.contains("is-open");
      setOpen(open);
    });
  }
}

setupAccordion();

function setupContactForm() {
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

    statusEl.textContent = "Данные отправлены";
    form.reset();
  });
}

setupContactForm();
