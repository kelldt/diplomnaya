function mean(xs) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, x) => a + (x - m) * (x - m), 0) / (xs.length - 1);
  return Math.sqrt(v);
}

export function linearRegression(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return { a: 0, b: ys[0] ?? 0, r2: 0 };

  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    num += dx * (ys[i] - my);
    den += dx * dx;
  }
  const a = den ? num / den : 0;
  const b = my - a * mx;

  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const y = ys[i];
    const yHat = a * xs[i] + b;
    ssTot += (y - my) * (y - my);
    ssRes += (y - yHat) * (y - yHat);
  }
  const r2 = ssTot ? 1 - ssRes / ssTot : 0;
  return { a, b, r2 };
}

export function zScoreAnomalies(values, threshold = 2) {
  const ys = values.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  const m = mean(ys);
  const sd = stdev(ys);
  if (!sd) return [];
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const v = Number(values[i]);
    if (!Number.isFinite(v)) continue;
    const z = (v - m) / sd;
    if (Math.abs(z) >= threshold) out.push({ i, z });
  }
  return out;
}

