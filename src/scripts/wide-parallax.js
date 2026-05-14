(() => {
  const app = window.__app;
  if (!app || app.prefersReducedMotion) return;

  const clamp = app.clamp;
  const bg = document.querySelector("[data-wide-parallax]");
  if (!bg) return;

  const section = bg.closest(".wide-parallax") || bg.parentElement;
  if (!section) return;

  const fg = section.querySelector("[data-parallax-float]");

  let rafId = 0;

  const tick = () => {
    rafId = 0;
    const viewportH = window.innerHeight || 1;
    const vcy = viewportH * 0.5;

    const rect = section.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > viewportH) {
      bg.style.transform = "";
      if (fg) fg.style.transform = "";
      return;
    }

    const midY = rect.top + rect.height * 0.5;
    const dist = midY - vcy;

    const bgDepth = clamp(
      parseFloat(bg.getAttribute("data-wide-parallax-depth") || "0.4") || 0.4,
      0.18,
      0.58
    );
    let bgScale = 1.26;
    const scAttr = bg.getAttribute("data-wide-parallax-scale");
    if (scAttr != null && scAttr !== "") {
      const s = parseFloat(scAttr);
      if (Number.isFinite(s)) bgScale = clamp(s, 1.12, 1.45);
    }

    const offBg = -dist * bgDepth;
    bg.style.transform = `translate3d(0, ${offBg.toFixed(2)}px, 0) scale(${bgScale})`;

    if (fg) {
      const fgDepth = clamp(
        parseFloat(fg.getAttribute("data-parallax-float-depth") || "0.12") || 0.12,
        0.02,
        0.3
      );
      const offFg = -dist * fgDepth;
      fg.style.transform = `translate3d(0, ${offFg.toFixed(2)}px, 0)`;
    }
  };

  const onScroll = () => {
    if (!rafId) rafId = window.requestAnimationFrame(tick);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  tick();
})();
