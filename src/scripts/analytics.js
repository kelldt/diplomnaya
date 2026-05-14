(() => {
  const cardsEl = document.getElementById("ml-cards");
  const metaEl = document.getElementById("ml-meta");
  const svg = document.getElementById("ml-chart");
  if (!cardsEl || !metaEl || !svg) return;

  const form = document.querySelector("[data-ml-import]");
  const waterSel = document.querySelector("[data-ml-water]");
  const metricSel = document.querySelector("[data-ml-metric]");
  const sourceNameEl = document.querySelector("[data-ml-source-name]");
  const sourceUrlEl = document.querySelector("[data-ml-source-url]");
  const methodEl = document.querySelector("[data-ml-method]");
  const fileEl = document.querySelector("[data-ml-file]");
  const fileBtn = document.querySelector("[data-ml-file-btn]");
  const fileNameEl = document.querySelector("[data-ml-file-name]");
  const alertEl = document.querySelector("[data-ml-alert]");
  const statusEl = document.querySelector("[data-ml-status]");

  const TOKEN_KEY = "geoeco_auth_token";

  const getToken = () => {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  };

  const clamp =
    window.__app?.clamp || ((n, min, max) => Math.min(max, Math.max(min, n)));

  function setAlert(msg) {
    if (!alertEl) return;
    alertEl.textContent = msg || "";
  }
  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
  }

  async function api(path, opts = {}) {
    const url =
      window.__geoecoApi != null ? await window.__geoecoApi.resolveUrl(path) : path;
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    const res = await fetch(url, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "REQUEST_FAILED");
    return data;
  }

  async function loadMeta() {
    const data = await api("/api/meta", { method: "GET" });
    return data;
  }

  async function pickFirstSeriesWithData(meta) {
    const waterBodies = Array.isArray(meta?.waterBodies) ? meta.waterBodies : [];
    const metrics = Array.isArray(meta?.metrics) ? meta.metrics : [];
    if (!waterBodies.length || !metrics.length) return null;

    if (meta?.bestSeries?.waterBodyId && meta?.bestSeries?.metricCode) {
      return {
        waterBodyId: Number(meta.bestSeries.waterBodyId),
        metricCode: String(meta.bestSeries.metricCode),
      };
    }

    const preferredWbs = waterBodies.filter((w) =>
      /росгидромет|rcsi/i.test(String(w?.name || ""))
    );
    const fallbackWbs = preferredWbs.length ? preferredWbs : [waterBodies[0]];

    const preferredMetricOrder = [
      "nitrites",
      "ammonium",
      "oil",
      "copper",
      "zinc",
      "manganese",
      "arsenic",
      "ph",
      "bod5",
      "nitrates",
    ];

    const metricByCode = new Map(metrics.map((m) => [String(m.code), m]));
    const candidates = preferredMetricOrder
      .map((c) => metricByCode.get(c))
      .filter(Boolean);

    const allMetrics = [
      ...candidates,
      ...metrics.filter((m) => !preferredMetricOrder.includes(String(m.code))),
    ];

    const avail = meta?.availability && typeof meta.availability === "object" ? meta.availability : null;
    if (avail) {
      for (const wb of fallbackWbs.slice(0, 6)) {
        const wbAvail = avail[String(wb.id)] || {};
        for (const m of allMetrics.slice(0, 20)) {
          const n = Number(wbAvail[String(m.code)] || 0);
          if (n >= 3) return { waterBodyId: Number(wb.id), metricCode: String(m.code) };
        }
      }
    }

    const wb = fallbackWbs[0];
    return { waterBodyId: Number(wb?.id || 0), metricCode: String(allMetrics[0]?.code || "") };
  }

  function parseCsv(text) {
    const lines = String(text || "")
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!lines.length) return [];

    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0 && /date\s*,\s*value/i.test(line)) continue;
      const parts = line.split(",").map((x) => x.trim());
      if (parts.length < 2) continue;
      const collectedAt = parts[0];
      const value = Number(String(parts[1]).replace(",", "."));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(collectedAt)) continue;
      if (!Number.isFinite(value)) continue;
      out.push({ collectedAt, value });
    }
    return out;
  }

  function fmt(n) {
    return Number(n).toLocaleString("ru-RU", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  }

  async function renderFor(waterBodyId, metricCode) {
    const seriesData = await api(
      `/api/monitoring/series?waterBodyId=${encodeURIComponent(
        waterBodyId
      )}&metricCode=${encodeURIComponent(metricCode)}`,
      { method: "GET" }
    );

    const REGION = seriesData?.waterBody?.region || window.__app?.siteRegion || "";
    const UPDATED_AT = window.__app?.dataFreshness?.updatedAt || "";

    const series = (seriesData.items || []).map((p) => ({ t: p.t, v: Number(p.v) }));
    const enough = series.length >= 3;
    let trend = null;
    let forecast = null;
    let anomalies = [];
    if (enough) {
      const ana = await api(
        `/api/analytics?waterBodyId=${encodeURIComponent(
          waterBodyId
        )}&metricCode=${encodeURIComponent(metricCode)}&horizon=1`,
        { method: "GET" }
      );
      trend = ana?.trend || {};
      forecast = ana?.forecast?.items?.[0]?.v;
      anomalies = Array.isArray(ana?.anomalies)
        ? ana.anomalies.map((a) => ({ t: a.t, i: a.i, z: a.z }))
        : [];
    }

    const cards = [
      { k: "Регион", v: REGION },
      {
        k: "Объект",
        v: `${seriesData?.waterBody?.name || "—"}`,
      },
      {
        k: "Показатель",
        v: `${seriesData?.metric?.title || metricCode} (${seriesData?.metric?.unit || ""})`,
      },
      {
        k: "Тренд (ML)",
        v: enough
          ? `${trend?.slopeDir || "—"} • наклон ${fmt(trend?.a ?? 0)} / шаг`
          : "недостаточно данных (нужно ≥ 3 точки)",
      },
      {
        k: "Качество аппроксимации",
        v: enough ? `R² = ${fmt(trend?.r2 ?? 0)}` : "—",
      },
      {
        k: "Прогноз (1 шаг)",
        v: enough ? `${fmt(forecast ?? 0)}` : "—",
      },
    ];

    cardsEl.innerHTML = "";
    for (const c of cards) {
      const node = document.createElement("div");
      node.className = "fact";
      node.innerHTML = `
        <div class="fact__k">${c.k}</div>
        <div class="fact__v">${c.v}</div>
      `.trim();
      cardsEl.appendChild(node);
    }

    metaEl.textContent = `Источник: база мониторинга • ${
      UPDATED_AT ? `обновление данных: ${UPDATED_AT} • ` : ""
    }${
      enough
        ? "методы: линейная регрессия, z-score (аномалии)."
        : "показан ряд; для расчёта ML нужны ≥ 3 измерения."
    }`;

  const W = 920;
  const H = 440;
  const pad = { l: 56, r: 18, t: 20, b: 46 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const ys = series.map((p) => p.v);
  const f = Number(forecast);
  const minY = Math.min(...ys, Number.isFinite(f) ? f : ys[0]) - 0.2;
  const maxY = Math.max(...ys, Number.isFinite(f) ? f : ys[0]) + 0.2;
  const xToPx = (x) => pad.l + (x / (series.length)) * plotW;
  const yToPx = (y) =>
    pad.t + (1 - (y - minY) / (maxY - minY || 1)) * plotH;

  const mk = (name, attrs = {}, children = []) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    for (const ch of children) el.appendChild(ch);
    return el;
  };

  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const grid = mk("g", { opacity: "0.9" });
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const yy = pad.t + (i / gridLines) * plotH;
    grid.appendChild(
      mk("line", {
        x1: pad.l,
        y1: yy,
        x2: W - pad.r,
        y2: yy,
        stroke: "rgba(11,19,43,0.10)",
        "stroke-width": "1",
      })
    );
    const val = maxY - (i / gridLines) * (maxY - minY);
    grid.appendChild(
      mk("text", {
        x: pad.l - 10,
        y: yy + 4,
        "text-anchor": "end",
        fill: "rgba(11,19,43,0.55)",
        "font-size": "12",
        "font-family": "Inter,system-ui,Arial",
      }, [document.createTextNode(fmt(val))])
    );
  }
  svg.appendChild(grid);

  const pts = series
    .map((p, i) => `${xToPx(i).toFixed(2)},${yToPx(p.v).toFixed(2)}`)
    .join(" ");
  svg.appendChild(
    mk("polyline", {
      points: pts,
      fill: "none",
      stroke: "rgba(42,157,143,0.98)",
      "stroke-width": "3.8",
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    })
  );

  if (enough) {
    const a = Number(trend?.a ?? 0);
    const b = Number(trend?.b ?? 0);
    const x0 = 0;
    const x1 = series.length;
    const y0 = a * x0 + b;
    const y1 = a * x1 + b;
    svg.appendChild(
      mk("line", {
        x1: xToPx(x0),
        y1: yToPx(y0),
        x2: xToPx(x1),
        y2: yToPx(y1),
        stroke: "rgba(11,19,43,0.82)",
        "stroke-width": "2.6",
        "stroke-dasharray": "7 6",
      })
    );
  }

  const dotGroup = mk("g");
  for (let i = 0; i < series.length; i++) {
    const p = series[i];
    const isAnom = anomalies.some((a) => a.i === i);
    dotGroup.appendChild(
      mk("circle", {
        cx: xToPx(i),
        cy: yToPx(p.v),
        r: isAnom ? "6.4" : "5.2",
        fill: isAnom ? "rgba(231,111,81,0.95)" : "white",
        stroke: isAnom ? "rgba(231,111,81,0.95)" : "rgba(42,157,143,0.95)",
        "stroke-width": isAnom ? "2.6" : "2.4",
      })
    );
  }

  if (enough && Number.isFinite(f)) {
    dotGroup.appendChild(
      mk("circle", {
        cx: xToPx(series.length),
        cy: yToPx(f),
        r: "7",
        fill: "rgba(11,19,43,0.92)",
        stroke: "rgba(11,19,43,0.92)",
        "stroke-width": "2.6",
      })
    );
  }
  svg.appendChild(dotGroup);

  const xLab = mk("g");
  const lastIdx = Math.max(0, series.length - 1);
  let lastYearLabelX = null;
  for (let i = 0; i < series.length; i++) {
    const t = String(series[i].t || "");
    const year = t.slice(0, 4);
    const month = t.slice(5, 7);

    const isFirst = i === 0;
    const isLast = i === lastIdx;
    const isJan = month === "01";

    if (!isFirst && !isLast && !isJan) continue;

    const labelX = xToPx(i);
    xLab.appendChild(
      mk(
        "text",
        {
          x: labelX,
          y: H - 12,
          "text-anchor": "middle",
          fill: "rgba(11,19,43,0.6)",
          "font-size": "12",
          "font-family": "Inter,system-ui,Arial",
        },
        [document.createTextNode(year || t)]
      )
    );
    lastYearLabelX = labelX;
  }

  if (enough) {
    const forecastX = W - pad.r;
    const overlap =
      lastYearLabelX != null && Math.abs(forecastX - lastYearLabelX) < 26;
    xLab.appendChild(
      mk(
        "text",
        {
          x: W - pad.r,
          y: overlap ? H - 26 : H - 12,
          "text-anchor": "end",
          fill: "rgba(11,19,43,0.85)",
          "font-size": "12",
          "font-family": "Inter,system-ui,Arial",
        },
        [document.createTextNode("прогноз")]
      )
    );
  }
  svg.appendChild(xLab);

  const legend = mk("g");
  legend.appendChild(
    mk("rect", {
      x: pad.l,
      y: pad.t,
      width: enough ? "330" : "210",
      height: enough ? "54" : "32",
      rx: "8",
      fill: "rgba(255,255,255,0.9)",
      stroke: "rgba(11,19,43,0.10)",
    })
  );
  legend.appendChild(
    mk("circle", {
      cx: pad.l + 14,
      cy: pad.t + 18,
      r: "4",
      fill: "white",
      stroke: "rgba(42,157,143,0.95)",
      "stroke-width": "2",
    })
  );
  legend.appendChild(
    mk("text", {
      x: pad.l + 26,
      y: pad.t + 22,
      fill: "rgba(11,19,43,0.75)",
      "font-size": "12",
      "font-family": "Inter,system-ui,Arial",
    }, [document.createTextNode("наблюдения")])
  );
  if (enough) {
    legend.appendChild(
      mk("line", {
        x1: pad.l + 120,
        y1: pad.t + 18,
        x2: pad.l + 150,
        y2: pad.t + 18,
        stroke: "rgba(11,19,43,0.75)",
        "stroke-width": "2.2",
        "stroke-dasharray": "7 6",
      })
    );
    legend.appendChild(
      mk("text", {
        x: pad.l + 158,
        y: pad.t + 22,
        fill: "rgba(11,19,43,0.75)",
        "font-size": "12",
        "font-family": "Inter,system-ui,Arial",
      }, [document.createTextNode("тренд")])
    );
    legend.appendChild(
      mk("circle", {
        cx: pad.l + 220,
        cy: pad.t + 18,
        r: "5.2",
        fill: "rgba(231,111,81,0.95)",
      })
    );
    legend.appendChild(
      mk("text", {
        x: pad.l + 236,
        y: pad.t + 22,
        fill: "rgba(11,19,43,0.75)",
        "font-size": "12",
        "font-family": "Inter,system-ui,Arial",
      }, [document.createTextNode("аномалии")])
    );
    legend.appendChild(
      mk("circle", {
        cx: pad.l + 14,
        cy: pad.t + 38,
        r: "5.2",
        fill: "rgba(11,19,43,0.92)",
      })
    );
    legend.appendChild(
      mk("text", {
        x: pad.l + 26,
        y: pad.t + 42,
        fill: "rgba(11,19,43,0.75)",
        "font-size": "12",
        "font-family": "Inter,system-ui,Arial",
      }, [document.createTextNode("прогноз (1 шаг)")])
    );
  }
  svg.appendChild(legend);

    if (enough && anomalies.length) {
      const a0 = anomalies[0];
      const msg = `Обнаружено аномалий: ${anomalies.length} (например, ${a0.t}, z=${fmt(
        a0.z
      )}).`;
      const note = document.createElement("div");
      note.className = "muted";
      note.style.marginTop = "8px";
      note.textContent = msg;
      metaEl.appendChild(document.createElement("br"));
      metaEl.appendChild(note);
    }
  }

  async function boot() {
    setAlert("");
    setStatus("Загрузка справочников…");
    const meta = await loadMeta();

    if (waterSel) {
      waterSel.innerHTML = "";
      for (const w of meta.waterBodies || []) {
        const opt = document.createElement("option");
        opt.value = String(w.id);
        opt.textContent = `${w.name}`;
        waterSel.appendChild(opt);
      }
    }
    if (metricSel) {
      metricSel.innerHTML = "";
      for (const m of meta.metrics || []) {
        const opt = document.createElement("option");
        opt.value = String(m.code);
        opt.textContent = `${m.title} (${m.unit})`;
        metricSel.appendChild(opt);
      }
    }

    const picked = await pickFirstSeriesWithData(meta);
    const wbId = Number(picked?.waterBodyId || waterSel?.value || meta.waterBodies?.[0]?.id || 0);
    const metricCode = String(picked?.metricCode || metricSel?.value || meta.metrics?.[0]?.code || "");

    if (waterSel && wbId) waterSel.value = String(wbId);
    if (metricSel && metricCode) metricSel.value = String(metricCode);

    setStatus("");
    if (!wbId || !metricCode) {
      setAlert("Не настроены водные объекты/показатели в базе. Запустите db:init.");
      return;
    }

    try {
      setStatus("Загружаем данные…");
      await renderFor(wbId, metricCode);
      setStatus("");
    } catch {
      setStatus("");
      setAlert("Не удалось загрузить данные. Проверьте, что сервер запущен.");
    }

    const rerender = async () => {
      setAlert("");
      setStatus("Загружаем данные…");
      try {
        await renderFor(Number(waterSel?.value || 0), String(metricSel?.value || ""));
        setStatus("");
      } catch {
        setStatus("");
        setAlert("Не удалось загрузить данные. Проверьте, что сервер запущен.");
      }
    };
    waterSel?.addEventListener("change", rerender);
    metricSel?.addEventListener("change", rerender);

    if (fileBtn && fileEl) {
      fileBtn.addEventListener("click", (e) => {
        e.preventDefault();
        fileEl.click();
      });
    }

    if (fileEl) {
      fileEl.addEventListener("change", () => {
        const f = fileEl.files?.[0];
        if (!fileNameEl) return;
        fileNameEl.textContent = f ? f.name : "Файл не выбран";
      });
    }

    form?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      setAlert("");
      setStatus("");

      const token = getToken();
      if (!token) {
        setAlert("Нужно войти в аккаунт, чтобы загружать данные.");
        return;
      }

      const file = fileEl?.files?.[0];
      if (!file) {
        setAlert("Выберите CSV файл.");
        return;
      }
      const srcName = String(sourceNameEl?.value || "").trim();
      if (!srcName) {
        setAlert("Укажите источник данных.");
        return;
      }

      setStatus("Читаем файл…");
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 3) {
        setStatus("");
        setAlert("В файле должно быть минимум 3 строки измерений (YYYY-MM-DD,value).");
        return;
      }

      setStatus("Загружаем в базу…");
      try {
        await api("/api/monitoring/import", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            waterBodyId: Number(waterSel?.value || 0),
            metricCode: String(metricSel?.value || ""),
            sourceName: srcName,
            sourceUrl: String(sourceUrlEl?.value || "").trim(),
            method: String(methodEl?.value || "").trim(),
            rows,
          }),
        });
        setStatus("Загружено. Пересчитываем…");
        await rerender();
        setStatus("Готово");
      } catch (e) {
        setStatus("");
        setAlert("Не удалось загрузить. Проверьте формат CSV и работу сервера.");
        console.error(e);
      }
    });
  }

  boot().catch((e) => {
    console.error(e);
    setStatus("");
    setAlert("Ошибка инициализации аналитики. Проверьте, что сервер запущен.");
  });
})();

