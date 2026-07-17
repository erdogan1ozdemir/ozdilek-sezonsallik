// scripts/lib/derive.js
// Shared math for prep/merge scripts (extracted from prep-ozdilekteyim.js).

function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function pct(a, b) { if (!b) return 0; return (a - b) / b; }
function mean(a) { if (!a.length) return 0; return a.reduce((s, x) => s + x, 0) / a.length; }
function std(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length);
}
function cv(a) { const m = mean(a); return m > 0 ? std(a) / m : 0; }

function peakIdx(arr) {
  let maxI = 0, maxV = -Infinity;
  for (let i = 0; i < arr.length; i++) if (arr[i] > maxV) { maxV = arr[i]; maxI = i; }
  return maxI;
}
function dipIdx(arr) {
  let minI = 0, minV = Infinity;
  for (let i = 0; i < arr.length; i++) if (arr[i] < minV) { minV = arr[i]; minI = i; }
  return minI;
}

function dominantQuarter(pq) {
  const idx = pq.indexOf(Math.max(...pq));
  return ['Q1', 'Q2', 'Q3', 'Q4'][idx];
}

// Quarter peak flags for a 12-month window whose index 0 corresponds to
// calendar month `startMonth` (0-based, e.g. 6 = July). Each month's volume is
// attributed to its CALENDAR quarter; a quarter is flagged if its sum is
// >= 75% of the max quarter (same rule as buildKatMonthly in prep).
function quarterFlags(m12, startMonth) {
  const q = [0, 0, 0, 0];
  for (let i = 0; i < 12; i++) {
    const calMonth = (i + (startMonth || 0)) % 12;
    q[Math.floor(calMonth / 3)] += m12[i];
  }
  const maxQ = Math.max(...q);
  return q.map(v => (maxQ > 0 && v >= maxQ * 0.75) ? 1 : 0);
}

function bucketOf(avg) {
  if (avg < 1000) return '0-1.000';
  if (avg < 2000) return '1.000-2.000';
  if (avg < 10000) return '2.000-10.000';
  if (avg < 50000) return '10.000-50.000';
  return '50.000+';
}

function quartileOf(avg, quartiles) {
  if (avg >= quartiles.q75) return 'Q1 (Top 25%)';
  if (avg >= quartiles.q50) return 'Q2 (50-75%)';
  if (avg >= quartiles.q25) return 'Q3 (25-50%)';
  return 'Q4 (Bottom 25%)';
}

function computeQuartiles(vols) {
  const sorted = [...vols].sort((a, b) => a - b);
  const qAt = (p) => {
    const i = Math.floor(sorted.length * p);
    return sorted[Math.min(i, sorted.length - 1)];
  };
  return { q25: qAt(0.25), q50: qAt(0.50), q75: qAt(0.75) };
}

module.exports = {
  num, numOrNull, pct, mean, std, cv,
  peakIdx, dipIdx, dominantQuarter, quarterFlags,
  bucketOf, quartileOf, computeQuartiles,
};
