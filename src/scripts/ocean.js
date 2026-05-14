(() => {
  const app = window.__app;
  if (!app) return;

  const root = document.querySelector("[data-before-after]");
  if (!root) return;

  const clip = root.querySelector("[data-clip]");
  const handle = root.querySelector("[data-handle]");
  const range = root.querySelector("input[type='range']");
  if (!clip || !handle || !range) return;

  const clamp = app.clamp;

  const set = (value) => {
    const v = clamp(Number(value), 0, 100);
    clip.style.clipPath = `inset(0 ${100 - v}% 0 0)`;
    handle.style.left = `${v}%`;
  };

  range.addEventListener("input", (e) => set(e.target.value));
  set(range.value);
})();
