(() => {
  const app = window.__app;
  if (!app) return;

  const carouselRoot = document.querySelector("[data-carousel]");
  if (carouselRoot) {
    const img = carouselRoot.querySelector("img");
    const caption = carouselRoot.querySelector("[data-caption]");
    const prevBtn = carouselRoot.querySelector("[data-prev]");
    const nextBtn = carouselRoot.querySelector("[data-next]");

    if (img && caption && prevBtn && nextBtn) {
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
  }

  const countersRoot = document.querySelector("[data-counters]");
  if (!countersRoot) return;

  const clamp = app.clamp;
  const nodes = Array.from(countersRoot.querySelectorAll("[data-count-to]"));
  if (!nodes.length) return;

  const prefersReducedMotion = !!app.prefersReducedMotion;

  const animate = (el) => {
    const targetRaw = el.getAttribute("data-count-to") || "0";
    const suffix = el.getAttribute("data-suffix") || "";
    const target = Number(targetRaw);
    if (!Number.isFinite(target)) return;

    const renderedTarget = `${target.toLocaleString("ru-RU")}${suffix}`;
    if (renderedTarget.length >= 10) el.classList.add("is-long");

    if (prefersReducedMotion) {
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
})();

