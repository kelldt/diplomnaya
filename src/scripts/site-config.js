(() => {
  window.__app = window.__app || {};
  const GEOECO_API_ORIGIN_FOR_STATIC_HOSTING = "";
  if (GEOECO_API_ORIGIN_FOR_STATIC_HOSTING) {
    window.__app.geoecoApiOrigin = String(GEOECO_API_ORIGIN_FOR_STATIC_HOSTING).replace(
      /\/$/,
      ""
    );
  }
})();
