(() => {
  const app = window.__app;
  if (!app || app.prefersReducedMotion) return;

  const clamp = app.clamp;
  const frames = Array.from(document.querySelectorAll("[data-parallax]"));
  if (!frames.length) return;

  let rafId = 0;

  const tick = () => {
    rafId = 0;
    const viewportH = window.innerHeight || 1;
    const vcy = viewportH * 0.5;
    const pad = 100;

    for (const frame of frames) {
      const img = frame.querySelector(".media-frame__img, img");
      if (!img) continue;

      const rect = frame.getBoundingClientRect();
      if (rect.bottom < -pad || rect.top > viewportH + pad) continue;

      const midY = rect.top + rect.height * 0.5;
      const dist = midY - vcy;

      const depth = clamp(
        parseFloat(frame.getAttribute("data-parallax-depth") || "0.26") || 0.26,
        0.08,
        0.48
      );
      const offset = -dist * depth;

      let baseScale = 1.26;
      const scaleAttr = frame.getAttribute("data-parallax-scale");
      if (scaleAttr != null && scaleAttr !== "") {
        const s = parseFloat(scaleAttr);
        if (Number.isFinite(s)) baseScale = clamp(s, 1.08, 1.48);
      }

      img.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0) scale(${baseScale})`;
    }
  };

  const onScroll = () => {
    if (!rafId) rafId = window.requestAnimationFrame(tick);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  tick();
})();
