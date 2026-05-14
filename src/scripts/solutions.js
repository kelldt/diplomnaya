(() => {
  const app = window.__app;
  if (!app) return;

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

      if (app.prefersReducedMotion) return;
      panel.style.maxHeight = open ? `${panel.scrollHeight}px` : "0px";
    };

    setOpen(false);
    btn.addEventListener("click", () => {
      setOpen(!item.classList.contains("is-open"));
    });
  }
})();

