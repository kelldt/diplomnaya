(() => {
  const STORAGE_KEY = "aiApiBase";
  const HEALTH_PATH = "/api/health";
  const DEFAULT_PORTS = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];

  const isLocalHost = () =>
    location.hostname === "localhost" || location.hostname === "127.0.0.1";

  function configuredApiOrigin() {
    const meta = document.querySelector('meta[name="geoeco-api-origin"]');
    const fromMeta = meta?.getAttribute("content")?.trim() || "";
    const fromApp = String(
      window.__app?.geoecoApiOrigin ??
        window.__app?.apiBase ??
        window.__app?.aiApiBase ??
        ""
    ).trim();
    const chosen = fromMeta || fromApp;
    return chosen ? chosen.replace(/\/$/, "") : "";
  }

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
    const url = String(base).replace(/\/$/, "") + HEALTH_PATH;
    const res = await withTimeout(
      (signal) => fetch(url, { method: "GET", signal, cache: "no-store" }),
      1200
    );
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return !!data?.ok;
  };

  async function probeAndStore() {
    if (!isLocalHost()) {
      return configuredApiOrigin();
    }

    const fromGlobal =
      window.__app?.apiBase ??
      window.__app?.aiApiBase ??
      (typeof window.__app?.geoecoApiOrigin === "string" ? window.__app.geoecoApiOrigin : null);
    if (fromGlobal != null && String(fromGlobal).trim()) {
      const normalized = String(fromGlobal).trim().replace(/\/$/, "");
      try {
        if (normalized && (await tryHealth(normalized))) {
          localStorage.setItem(STORAGE_KEY, normalized);
          return normalized;
        }
      } catch {}
    }

    try {
      if (await tryHealth(location.origin)) {
        localStorage.setItem(STORAGE_KEY, location.origin);
        return "";
      }
    } catch {}

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (await tryHealth(stored))) {
      return String(stored).replace(/\/$/, "");
    }

    for (const port of DEFAULT_PORTS) {
      const base = `${location.protocol}//${location.hostname}:${port}`;
      try {
        if (await tryHealth(base)) {
          localStorage.setItem(STORAGE_KEY, base);
          return base.replace(/\/$/, "");
        }
      } catch {}
    }

    localStorage.removeItem(STORAGE_KEY);
    return "";
  }

  const RESOLVE_SENTINEL = Symbol("geoeco-resolve-pending");

  let cachedBase = RESOLVE_SENTINEL;

  let inflightProbe = null;

  async function resolve() {
    if (cachedBase !== RESOLVE_SENTINEL) return cachedBase;

    inflightProbe =
      inflightProbe ||
      probeAndStore().then((base) => {
        cachedBase = base;
        inflightProbe = null;
        return base;
      });

    return inflightProbe;
  }

  async function resolveUrl(apiPath) {
    const path = apiPath.startsWith("/") ? apiPath : "/" + apiPath;
    const base = await resolve();
    if (!base) return path;
    return `${base.replace(/\/$/, "")}${path}`;
  }

  window.__geoecoApi = Object.freeze({
    STORAGE_KEY,
    tryHealth,
    resolve,
    resolveUrl,
    prime: resolve,
  });
})();
