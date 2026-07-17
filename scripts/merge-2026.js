// scripts/merge-2026.js
// Merges new Google Keyword Planner exports (2026 monthly volumes) into
// data/source.xlsx and recomputes all derived analysis sheets on a rolling
// "Son 12 Ay vs Önceki 12 Ay" window. Old calendar columns (2024/2025) are
// preserved untouched.
//
// Usage:
//   node scripts/merge-2026.js \
//     --in-catalog  <GKP xlsx for the main Keyword set> \
//     --out-catalog <GKP xlsx for the Özdilekte Olmayan Markalar set> \
//     [--out <output xlsx, default data/source.xlsx>] [--dry-run]
//
// The GKP month columns ("Searches: Jan 2026" ...) are discovered dynamically,
// so the same script can be re-run when 2026 H2 data arrives.

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const D = require('./lib/derive');

const ROOT = path.resolve(__dirname, '..');
const SRC_XLSX = path.join(ROOT, 'data', 'source.xlsx');

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SERIALS_2024 = [45292,45323,45352,45383,45413,45444,45474,45505,45536,45566,45597,45627];
const SERIALS_2025 = [45658,45689,45717,45748,45778,45809,45839,45870,45901,45931,45962,45992];

function serialOf(year, monthIdx) {
  // Excel 1900 date system: days since 1899-12-30
  return Math.round(Date.UTC(year, monthIdx, 1) / 86400000) + 25569;
}
function serialToDate(serial) {
  return new Date((serial - 25569) * 86400000);
}

function norm(s) {
  return String(s).trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { out: SRC_XLSX, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--in-catalog' && args[i+1]) { out.inCatalog = args[++i]; }
    else if (args[i] === '--out-catalog' && args[i+1]) { out.outCatalog = args[++i]; }
    else if (args[i] === '--out' && args[i+1]) { out.out = args[++i]; }
    else if (args[i] === '--dry-run') { out.dryRun = true; }
  }
  if (!out.inCatalog || !out.outCatalog) {
    console.error('Usage: node scripts/merge-2026.js --in-catalog <xlsx> --out-catalog <xlsx> [--out <xlsx>] [--dry-run]');
    process.exit(1);
  }
  return out;
}

// ———————————————————————————————————————————————————————————
// Load existing source.xlsx keyword sheets
// ———————————————————————————————————————————————————————————

function col(H, name) { for (let i = 0; i < H.length; i++) if (H[i] === name) return i; return -1; }
function mustCol(H, name, sheet) {
  const i = col(H, name);
  if (i < 0) throw new Error(`Sheet "${sheet}": required column "${name}" not found`);
  return i;
}

function loadSezSheet(sheet, sheetName) {
  if (!sheet || sheet.length < 2) throw new Error(`Sheet "${sheetName}" empty`);
  const H = sheet[0];
  const idx = {
    k1: mustCol(H, 'Kat 1', sheetName),
    k2: mustCol(H, 'Kat 2', sheetName),
    k3: mustCol(H, 'Kat 3', sheetName),
    brand: col(H, 'Marka'),
    cat: col(H, 'Katalog'),
    kw: mustCol(H, 'Keyword', sheetName),
    a24: mustCol(H, '2024 Avg. Search Volume', sheetName),
    a25: mustCol(H, '2025 Avg. Search Volume', sheetName),
    yoy: mustCol(H, 'YoY change', sheetName),
    q1: mustCol(H, '2025 \nQ1 Peak', sheetName),
    q2: mustCol(H, '2025 \nQ2 Peak', sheetName),
    q3: mustCol(H, '2025 \nQ3 Peak', sheetName),
    q4: mustCol(H, '2025 \nQ4 Peak', sheetName),
    peak: mustCol(H, 'En Yuksek Ay?', sheetName),
    bucket: mustCol(H, 'Bucket', sheetName),
  };
  const m24Start = idx.peak + 1;
  if (idx.bucket - m24Start !== 12) {
    throw new Error(`${sheetName}: expected 12 month columns between "En Yuksek Ay?" and "Bucket"`);
  }
  const m25Start = idx.bucket + 1;
  // Existing 2026 serial columns (numeric headers after the 2025 block) — present on re-runs
  const existing26 = [];
  for (let i = m25Start + 12; i < H.length; i++) {
    const h = Number(H[i]);
    if (Number.isFinite(h) && h > 46000 && h < 46400) existing26.push({ serial: h, col: i });
    else break;
  }

  const out = [];
  for (let r = 1; r < sheet.length; r++) {
    const row = sheet[r];
    if (!row || !row[idx.kw]) continue;
    const m24 = [], m25 = [];
    for (let i = 0; i < 12; i++) m24.push(D.num(row[m24Start + i]));
    for (let i = 0; i < 12; i++) m25.push(D.num(row[m25Start + i]));
    const m26bySerial = new Map();
    for (const { serial, col: c } of existing26) m26bySerial.set(serial, D.num(row[c]));
    out.push({
      k1: String(row[idx.k1] || '').trim(),
      k2: String(row[idx.k2] || '').trim(),
      k3: String(row[idx.k3] || '').trim(),
      brand: idx.brand >= 0 ? String(row[idx.brand] || '').trim() : '',
      catalog: idx.cat >= 0 ? String(row[idx.cat] || '').trim() : '',
      kw: String(row[idx.kw]).trim(),
      a24: D.num(row[idx.a24]),
      a25: D.num(row[idx.a25]),
      yoy: D.num(row[idx.yoy]),
      pq: [D.num(row[idx.q1]), D.num(row[idx.q2]), D.num(row[idx.q3]), D.num(row[idx.q4])],
      peakSerial: D.numOrNull(row[idx.peak]),
      bucket: String(row[idx.bucket] || '').trim(),
      m24, m25, m26bySerial,
    });
  }
  return out;
}

function loadBrandsSheet(sheet) {
  if (!sheet || sheet.length < 2) return { header: [], rows: [] };
  const H = sheet[0];
  const iBrand = mustCol(H, 'Marka', 'Brands');
  const iPeak = mustCol(H, 'En Yuksek Ay?', 'Brands');
  const m25Start = iPeak + 1;
  const rows = [];
  for (let r = 1; r < sheet.length; r++) {
    const row = sheet[r];
    if (!row || !row[iBrand]) continue;
    const m25 = [];
    for (let i = 0; i < 12; i++) m25.push(D.num(row[m25Start + i]));
    rows.push({ raw: row.slice(0, m25Start + 12), brand: String(row[iBrand]).trim(), m25 });
  }
  return { header: H.slice(0, m25Start + 12), rows };
}

// ———————————————————————————————————————————————————————————
// Load GKP export (dynamic "Searches: <Mon> <Year>" discovery)
// ———————————————————————————————————————————————————————————

function loadGkp(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`GKP file not found: ${filePath}`);
  const wb = XLSX.readFile(filePath);
  const sheet = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, raw: true });
  // Find header row: first row whose first cell is exactly "Keyword"
  let hRow = -1;
  for (let r = 0; r < Math.min(sheet.length, 10); r++) {
    if (sheet[r] && sheet[r][0] === 'Keyword') { hRow = r; break; }
  }
  if (hRow < 0) throw new Error(`${path.basename(filePath)}: "Keyword" header row not found`);
  const H = sheet[hRow];
  const monthCols = [];
  const re = /^Searches:\s+(\w{3})\s+(\d{4})$/;
  for (let i = 0; i < H.length; i++) {
    const m = H[i] != null && re.exec(String(H[i]));
    if (m) {
      const monthIdx = MONTH_NAMES.indexOf(m[1]);
      if (monthIdx < 0) continue;
      monthCols.push({ col: i, serial: serialOf(Number(m[2]), monthIdx), year: Number(m[2]), monthIdx });
    }
  }
  if (!monthCols.length) throw new Error(`${path.basename(filePath)}: no "Searches: <Mon> <Year>" columns found`);
  monthCols.sort((a, b) => a.serial - b.serial);

  const map = new Map();
  for (let r = hRow + 1; r < sheet.length; r++) {
    const row = sheet[r];
    if (!row || !row[0]) continue; // skips "All"/"Turkiye" summary rows (empty Keyword cell)
    const values = new Map();
    for (const mc of monthCols) values.set(mc.serial, D.num(row[mc.col]));
    map.set(norm(row[0]), { kw: String(row[0]).trim(), values });
  }
  return { map, monthCols };
}

// ———————————————————————————————————————————————————————————
// Merge + rolling computation
// ———————————————————————————————————————————————————————————

function mergeSet(kws, gkp, label) {
  const missing = [];
  const matchedNorms = new Set();
  for (const k of kws) {
    const n = norm(k.kw);
    const hit = gkp.map.get(n);
    if (hit) {
      matchedNorms.add(n);
      for (const [serial, v] of hit.values) k.m26bySerial.set(serial, v);
    } else {
      missing.push(k.kw);
      for (const mc of gkp.monthCols) {
        if (!k.m26bySerial.has(mc.serial)) k.m26bySerial.set(mc.serial, 0);
      }
    }
  }
  const unknown = [...gkp.map.keys()].filter(n => !matchedNorms.has(n));
  console.log(`[merge] ${label}: ${kws.length - missing.length}/${kws.length} matched; ${missing.length} zero-filled; ${unknown.length} unknown in export`);
  if (missing.length) console.log(`        zero-filled: ${missing.join(', ')}`);
  if (unknown.length > 20) {
    console.error(`[merge] ERROR: ${unknown.length} keywords in the export are not in the source set — wrong file?`);
    console.error('        sample:', unknown.slice(0, 10).join(' | '));
    process.exit(1);
  } else if (unknown.length) {
    console.log(`        unmatched in export (ignored): ${unknown.map(n => gkp.map.get(n).kw).join(', ')}`);
  }
}

// Window context computed once from the union of 2026 serials.
function buildWindow(serials26) {
  const allSerials = [...SERIALS_2024, ...SERIALS_2025, ...serials26];
  const rollingSerials = allSerials.slice(-12);
  const prevSerials = allSerials.slice(-24, -12);
  const startDate = serialToDate(rollingSerials[0]);
  return {
    serials26, allSerials, rollingSerials, prevSerials,
    startCalMonth: startDate.getUTCMonth(), // 0-based calendar month of rolling[0]
  };
}

function m26Of(k, W) { return W.serials26.map(s => k.m26bySerial.get(s) || 0); }
function allMonthsOf(k, W) { return [...k.m24, ...k.m25, ...m26Of(k, W)]; }
function rollingOf(k, W) { return allMonthsOf(k, W).slice(-12); }
function prevOf(k, W) { const a = allMonthsOf(k, W); return a.slice(-24, -12); }

function enrich(k, W) {
  const roll = rollingOf(k, W);
  const prev = prevOf(k, W);
  k.r12 = D.mean(roll);
  k.p12 = D.mean(prev);
  k.ryoy = k.p12 > 0 ? D.pct(k.r12, k.p12) : null;
  k.rpq = D.quarterFlags(roll, W.startCalMonth);
  k.rpeakSerial = W.rollingSerials[D.peakIdx(roll)];
  k.bucket = D.bucketOf(k.r12);
  k.roll = roll;
  k.prev = prev;
}

// ———————————————————————————————————————————————————————————
// Sheet builders (calendar columns preserved, rolling columns appended)
// ———————————————————————————————————————————————————————————

const R12_COLS = ['R12 Avg','P12 Avg','R12 YoY','R12 \nQ1 Peak','R12 \nQ2 Peak','R12 \nQ3 Peak','R12 \nQ4 Peak','R12 En Yuksek Ay?'];

function ryoyCell(v) { return v === null || v === undefined ? '' : v; }

function buildSezonsallik(kws, W) {
  const header = [
    'Kat 1','Kat 2','Kat 3','Marka','Katalog','Keyword',
    '2024 Avg. Search Volume','2025 Avg. Search Volume','YoY change',
    '2025 \nQ1 Peak','2025 \nQ2 Peak','2025 \nQ3 Peak','2025 \nQ4 Peak',
    'En Yuksek Ay?',
    ...SERIALS_2024,
    'Bucket',
    ...SERIALS_2025,
    ...W.serials26,
    ...R12_COLS,
  ];
  const rows = [header];
  for (const k of kws) {
    rows.push([
      k.k1, k.k2, k.k3, k.brand || '', k.catalog || '', k.kw,
      k.a24, k.a25, k.yoy,
      k.pq[0], k.pq[1], k.pq[2], k.pq[3],
      k.peakSerial || SERIALS_2025[D.peakIdx(k.m25)],
      ...k.m24,
      k.bucket,
      ...k.m25,
      ...m26Of(k, W),
      k.r12, k.p12, ryoyCell(k.ryoy),
      k.rpq[0], k.rpq[1], k.rpq[2], k.rpq[3],
      k.rpeakSerial,
    ]);
  }
  return rows;
}

function buildOzet(kws) {
  const groups = new Map();
  for (const k of kws) {
    if (!groups.has(k.k1)) groups.set(k.k1, []);
    groups.get(k.k1).push(k);
  }
  const totalR12 = kws.reduce((s, k) => s + k.r12 * 12, 0);
  const desc = ["Kat 1 bazında portföy özeti. Her üst kategori için toplam hacim (takvim yılları + rolling 12 ay), rolling YoY değişim, pazar payı ve öne çıkan keyword'ler özetlenir. Rolling karşılaştırma: Son 12 Ay vs Önceki 12 Ay."];
  const header = ['Kat 1','Keyword Sayısı','2024 Toplam Hacim','2025 Toplam Hacim','YoY Değişim','Son 12 Ay Toplam','Önceki 12 Ay Toplam','Rolling YoY','Pazar Payı (Son 12 Ay)','Peak Çeyrek','En Yüksek Hacimli 3 Keyword','En Çok Artan Keyword','En Çok Düşen Keyword'];
  const rows = [desc, header];
  for (const [k1, list] of groups) {
    const tot24 = list.reduce((s, k) => s + k.a24 * 12, 0);
    const tot25 = list.reduce((s, k) => s + k.a25 * 12, 0);
    const yoy = D.pct(tot25, tot24);
    const totR12 = list.reduce((s, k) => s + k.r12 * 12, 0);
    const totP12 = list.reduce((s, k) => s + k.p12 * 12, 0);
    const ryoy = totP12 > 0 ? D.pct(totR12, totP12) : '';
    const share = totalR12 > 0 ? totR12 / totalR12 : 0;
    const pq = [0, 0, 0, 0];
    for (const k of list) for (let i = 0; i < 4; i++) pq[i] += k.rpq[i] * k.r12;
    const peakQ = D.dominantQuarter(pq);
    const top3 = [...list].sort((a, b) => b.r12 - a.r12).slice(0, 3).map(k => k.kw).join(', ');
    const minVol = 100;
    const relevant = list.filter(k => k.r12 >= minVol && k.p12 >= minVol && k.ryoy !== null);
    const topGain = relevant.length ? [...relevant].sort((a, b) => b.ryoy - a.ryoy)[0].kw : '';
    const topLoss = relevant.length ? [...relevant].sort((a, b) => a.ryoy - b.ryoy)[0].kw : '';
    rows.push([k1, list.length, tot24, tot25, yoy, totR12, totP12, ryoy, share, peakQ, top3, topGain, topLoss]);
  }
  return rows;
}

function buildKatMonthly(kws, level, W) {
  const groups = new Map();
  for (const k of kws) {
    const labels = level === 1 ? [k.k1] : level === 2 ? [k.k1, k.k2] : [k.k1, k.k2, k.k3];
    const key = labels.join('|||');
    if (!groups.has(key)) groups.set(key, { labels, list: [] });
    groups.get(key).list.push(k);
  }
  const katCols = [];
  for (let i = 1; i <= level; i++) katCols.push(`Kat ${i}`);
  const monthLabel26 = W.serials26.map(s => {
    const d = serialToDate(s);
    return `SUM of ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  });
  const header = [
    ...katCols,
    '2024 Avg. Search Volume','2025 Avg. Search Volume','YoY Change',
    '2025 \nQ1 Peak','2025 \nQ2 Peak','2025 \nQ3 Peak','2025 \nQ4 Peak',
    'En Yuksek Ay?',
    ...MONTH_NAMES.map(m => `SUM of ${m} 2025`),
    ...monthLabel26,
    ...R12_COLS,
  ];
  const rows = [header];
  for (const { labels, list } of groups.values()) {
    const a24 = list.reduce((s, k) => s + k.a24, 0);
    const a25 = list.reduce((s, k) => s + k.a25, 0);
    const yoy = D.pct(a25, a24);
    const m25Sum = new Array(12).fill(0);
    for (const k of list) for (let i = 0; i < 12; i++) m25Sum[i] += k.m25[i];
    const pq = [0, 0, 0, 0];
    for (let i = 0; i < 12; i++) pq[Math.floor(i / 3)] += m25Sum[i];
    const maxPq = Math.max(...pq);
    const pqFlags = pq.map(v => v >= maxPq * 0.75 ? 1 : 0);
    const peakIdx25 = D.peakIdx(m25Sum);
    // 2026 monthly sums + rolling metrics
    const m26Sum = new Array(W.serials26.length).fill(0);
    for (const k of list) {
      const m26 = m26Of(k, W);
      for (let i = 0; i < m26.length; i++) m26Sum[i] += m26[i];
    }
    const rollSum = new Array(12).fill(0);
    const prevSum = new Array(12).fill(0);
    for (const k of list) {
      for (let i = 0; i < 12; i++) { rollSum[i] += k.roll[i]; prevSum[i] += k.prev[i]; }
    }
    const r12 = D.mean(rollSum);
    const p12 = D.mean(prevSum);
    const ryoy = p12 > 0 ? D.pct(r12, p12) : '';
    const rpq = D.quarterFlags(rollSum, W.startCalMonth);
    const rpeak = W.rollingSerials[D.peakIdx(rollSum)];
    rows.push([
      ...labels, a24, a25, yoy,
      ...pqFlags,
      SERIALS_2025[peakIdx25],
      ...m25Sum,
      ...m26Sum,
      r12, p12, ryoy,
      ...rpq,
      rpeak,
    ]);
  }
  return rows;
}

function buildTrend(kws) {
  const minVol = 100;
  const relevant = kws.filter(k => (k.r12 >= minVol || k.p12 >= minVol) && k.ryoy !== null);
  const sorted = [...relevant].sort((a, b) => b.ryoy - a.ryoy);
  const top = sorted.slice(0, 500);
  const bot = sorted.slice(-500).reverse();
  const desc = ["Yükselen ve düşen keyword trendleri. Min. 100 ortalama arama hacmine sahip keyword'ler arasında Son 12 Ay vs Önceki 12 Ay bazında en çok büyüyen ve eriyen terimleri gösterir. Yükselen keyword'ler yeni içerik ve landing page fırsatlarını, düşenler ise mevcut içeriklerde güncelleme ihtiyacını işaret eder."];
  const header = ['Kat 1','Kat 2','Kat 3','Keyword','Önceki 12 Ay Ort','Son 12 Ay Ort','YoY Değişim','Trend'];
  const rows = [desc, header];
  for (const k of top) rows.push([k.k1, k.k2, k.k3, k.kw, k.p12, k.r12, k.ryoy, 'YÜKSELEN']);
  for (const k of bot) rows.push([k.k1, k.k2, k.k3, k.kw, k.p12, k.r12, k.ryoy, 'DÜŞEN']);
  return rows;
}

function buildSezType(kws, W) {
  const minVol = 50;
  const desc = ["Keyword'lerin mevsimsellik profili. Coefficient of Variation (CV) ile son 12 ayın (rolling) aylık hacim değişkenliği ölçülür; düşük CV evergreen (yıl boyu stabil), yüksek CV yüksek mevsimsellik demektir. Peak / dip oranı kampanya takvimini şekillendirmek için kullanılır."];
  const header = ['Kat 1','Kat 2','Keyword','Son 12 Ay Ort','CV Skoru','Mevsimsellik Tipi','Peak Ay','Dip Ay','Peak/Dip Oranı'];
  const rows = [desc, header];
  for (const k of kws) {
    if (k.r12 < minVol) continue;
    const cvScore = D.cv(k.roll);
    let type;
    if (cvScore < 0.3) type = 'Evergreen';
    else if (cvScore < 0.7) type = 'Orta Mevsimsellik';
    else type = 'Yüksek Mevsimsellik';
    const peakI = D.peakIdx(k.roll);
    const dipI = D.dipIdx(k.roll);
    const peakV = k.roll[peakI];
    const dipV = Math.max(k.roll[dipI], 1);
    rows.push([k.k1, k.k2, k.kw, k.r12, cvScore, type, W.rollingSerials[peakI], W.rollingSerials[dipI], peakV / dipV]);
  }
  return rows;
}

function buildPeakQ(kws) {
  const groups = new Map();
  for (const k of kws) {
    const key = `${k.k1}|||${k.k2}`;
    if (!groups.has(key)) groups.set(key, { k1: k.k1, k2: k.k2, list: [] });
    groups.get(key).list.push(k);
  }
  const desc = ["Kat 2 bazında peak çeyrek dağılımı (Son 12 Ay penceresi, takvim çeyreği atfıyla). Her alt kategorinin hangi çeyreklerde pik yaptığı yüzde olarak gösterilir; baskın çeyrek kampanya takvimi ve buyer guide planlaması için yol gösterir."];
  const header = ['Kat 1','Kat 2','KW Sayısı','Toplam Hacim','Q1 Peak %','Q2 Peak %','Q3 Peak %','Q4 Peak %','Baskın Çeyrek'];
  const rows = [desc, header];
  for (const { k1, k2, list } of groups.values()) {
    const count = list.length;
    const vol = list.reduce((s, k) => s + k.r12 * 12, 0);
    const pq = [0, 0, 0, 0];
    for (const k of list) for (let i = 0; i < 4; i++) pq[i] += k.rpq[i];
    const totalFlags = pq.reduce((s, x) => s + x, 0) || 1;
    const pctQ = pq.map(v => v / totalFlags);
    const dom = D.dominantQuarter(pq);
    rows.push([k1, k2, count, vol, pctQ[0], pctQ[1], pctQ[2], pctQ[3], dom]);
  }
  return rows;
}

function buildSmart(kws) {
  const minVol = 300;
  const desc = ["Akıllı ürün trendleri. Hacim ve büyüme kombinasyonuna göre keyword'ler 4 segmente ayrılır: Yıldız (yüksek hacim + büyüme), Büyüyen Star (hızlı artan), Stabil (evergreen), Erken Sinyal (düşük hacim + agresif büyüme). Hacim = Son 12 Ay ortalaması, büyüme = rolling YoY."];
  const header = ['Kat 1','Kat 2','Keyword','Önceki 12 Ay Ort','Son 12 Ay Ort','YoY Değişim','Peak Ay','Segment Tag'];
  const rows = [desc, header];
  const meanVol = D.mean(kws.map(k => k.r12));
  for (const k of kws) {
    if (k.r12 < minVol || k.ryoy === null) continue;
    let tag;
    if (k.r12 >= meanVol * 3 && k.ryoy > 0.2) tag = 'Yıldız';
    else if (k.ryoy > 0.5) tag = 'Büyüyen Star';
    else if (k.r12 >= meanVol && Math.abs(k.ryoy) < 0.15) tag = 'Stabil';
    else if (k.r12 < meanVol && k.ryoy > 0.3) tag = 'Erken Sinyal';
    else continue;
    rows.push([k.k1, k.k2, k.kw, k.p12, k.r12, k.ryoy, k.rpeakSerial, tag]);
  }
  return rows;
}

function buildPrice(kws) {
  const priceTerms = ['fiyat','fiyatlar','fiyatı','ucuz','indirim','kampanya','taksit','ne kadar','kac para','kaç para'];
  const desc = ["Fiyat intent keyword'leri. Kullanıcının satın alma niyeti gösteren 'fiyat', 'ucuz', 'indirim', 'taksit', 'ne kadar' gibi terimlerle yapılan aramalar; conversion oranı yüksek segment için ayrı strateji gerektirir."];
  const header = ['Kat 1','Kat 2','Keyword','Önceki 12 Ay Ort','Son 12 Ay Ort','YoY Değişim','Peak Ay'];
  const rows = [desc, header];
  for (const k of kws) {
    const kwLower = k.kw.toLocaleLowerCase('tr-TR');
    if (!priceTerms.some(t => kwLower.includes(t))) continue;
    if (k.r12 < 50) continue;
    rows.push([k.k1, k.k2, k.kw, k.p12, k.r12, ryoyCell(k.ryoy), k.rpeakSerial]);
  }
  return rows;
}

function buildVolQ(kws) {
  const withVol = kws.filter(k => k.r12 > 0);
  if (withVol.length < 4) return [];
  const quartiles = D.computeQuartiles(withVol.map(k => k.r12));
  const buckets = {
    'Q1 (Top 25%)': [],
    'Q2 (50-75%)': [],
    'Q3 (25-50%)': [],
    'Q4 (Bottom 25%)': [],
  };
  for (const k of withVol) buckets[D.quartileOf(k.r12, quartiles)].push(k);

  const desc = ["Hacim bazlı kartil analizi. Keyword portföyü Son 12 Ay aylık ortalama hacmine göre dörde bölünür; her kartilin toplam hacim, ortalama rolling YoY değişim ve mevsimsellik skorları özetlenir. Top 25% genellikle brand + genel kategori terimlerini, Bottom 25% ise long-tail arama niyetlerini kapsar."];
  const header1 = ['Quartile','KW Sayısı','Toplam Son 12 Ay Hacim','Ort. Son 12 Ay','Min-Max Hacim Aralığı','Ort. YoY Değişim','Artan KW %','Azalan KW %','Ort. CV (Mevsimsellik)'];
  const rows = [desc, header1];
  for (const qName of Object.keys(buckets)) {
    const list = buckets[qName];
    if (!list.length) { rows.push([qName, 0, 0, 0, '', 0, 0, 0, 0]); continue; }
    const withYoy = list.filter(k => k.ryoy !== null);
    const total = list.reduce((s, k) => s + k.r12 * 12, 0);
    const avg = D.mean(list.map(k => k.r12));
    const min = Math.min(...list.map(k => k.r12));
    const max = Math.max(...list.map(k => k.r12));
    const yoy = D.mean(withYoy.map(k => k.ryoy));
    const gain = withYoy.filter(k => k.ryoy > 0.05).length / list.length;
    const loss = withYoy.filter(k => k.ryoy < -0.05).length / list.length;
    const cvAvg = D.mean(list.map(k => D.cv(k.roll)));
    rows.push([qName, list.length, total, avg, `${Math.round(min)} - ${Math.round(max)}`, yoy, gain, loss, cvAvg]);
  }
  rows.push([]);
  rows.push(["Her kartilin en yüksek hacimli keyword'leri. Trend yönü (Artan/Azalan/Sabit) ±5% rolling YoY eşiği ile belirlenir."]);
  const header2 = ['Quartile','Keyword','Kat 1','Kat 2','Son 12 Ay Ort','YoY Değişim','CV','Peak Ay','Trend Yönü'];
  rows.push(header2);
  for (const qName of Object.keys(buckets)) {
    const top = [...buckets[qName]].sort((a, b) => b.r12 - a.r12).slice(0, 25);
    for (const k of top) {
      let dir;
      if (k.ryoy !== null && k.ryoy > 0.05) dir = 'Artan';
      else if (k.ryoy !== null && k.ryoy < -0.05) dir = 'Azalan';
      else dir = 'Sabit';
      rows.push([qName, k.kw, k.k1, k.k2, k.r12, ryoyCell(k.ryoy), D.cv(k.roll), k.rpeakSerial, dir]);
    }
  }
  return rows;
}

function buildBrands(brandSheet, allKws, W) {
  // Group all keywords (in + out) by brand for rolling metrics
  const byBrand = new Map();
  for (const k of allKws) {
    if (!k.brand) continue;
    if (!byBrand.has(k.brand)) byBrand.set(k.brand, []);
    byBrand.get(k.brand).push(k);
  }
  const monthLabel26 = W.serials26.map(s => 'Sum 2026 ' + s);
  const header = [...brandSheet.header, ...monthLabel26, ...R12_COLS];
  const rows = [header];
  let parityWarns = 0;
  for (const b of brandSheet.rows) {
    const list = byBrand.get(b.brand) || [];
    const m26Sum = new Array(W.serials26.length).fill(0);
    const rollSum = new Array(12).fill(0);
    const prevSum = new Array(12).fill(0);
    for (const k of list) {
      const m26 = m26Of(k, W);
      for (let i = 0; i < m26.length; i++) m26Sum[i] += m26[i];
      for (let i = 0; i < 12; i++) { rollSum[i] += k.roll[i]; prevSum[i] += k.prev[i]; }
    }
    // Parity check: keyword-aggregated 2025 sums vs pivot sheet m25
    if (list.length) {
      const aggS25 = list.reduce((s, k) => s + k.m25.reduce((x, y) => x + y, 0), 0);
      const sheetS25 = b.m25.reduce((x, y) => x + y, 0);
      if (sheetS25 > 0 && Math.abs(aggS25 - sheetS25) / sheetS25 > 0.02) {
        parityWarns++;
        if (parityWarns <= 10) {
          console.log(`        [brands parity] ${b.brand}: sheet 2025=${sheetS25} vs kw-agg=${aggS25} (${((aggS25 - sheetS25) / sheetS25 * 100).toFixed(1)}%)`);
        }
      }
    }
    const r12 = D.mean(rollSum);
    const p12 = D.mean(prevSum);
    const ryoy = p12 > 0 ? D.pct(r12, p12) : '';
    const rpq = D.quarterFlags(rollSum, W.startCalMonth);
    const rpeak = W.rollingSerials[D.peakIdx(rollSum)];
    rows.push([...b.raw, ...m26Sum, r12, p12, ryoy, ...rpq, rpeak]);
  }
  if (parityWarns) console.log(`[merge] Brands parity: ${parityWarns} brand(s) deviate >2% between pivot sheet and keyword aggregation (rolling metrics use keyword aggregation)`);
  return rows;
}

// ———————————————————————————————————————————————————————————
// Main
// ———————————————————————————————————————————————————————————

function main() {
  const args = parseArgs();
  console.log(`[merge] Reading ${SRC_XLSX}`);
  const wb = XLSX.readFile(SRC_XLSX);
  const sheets = {};
  for (const name of wb.SheetNames) {
    sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true });
  }

  const kwsIn = loadSezSheet(sheets['Sezonsallık'], 'Sezonsallık');
  const kwsOut = loadSezSheet(sheets['Sezonsallık_Out'], 'Sezonsallık_Out');
  console.log(`[merge] Source: ${kwsIn.length} in-catalog, ${kwsOut.length} out-of-catalog keywords`);

  console.log(`[merge] Reading GKP exports`);
  const gkpIn = loadGkp(args.inCatalog);
  const gkpOut = loadGkp(args.outCatalog);
  const fmtMonths = (mc) => mc.map(m => `${MONTH_NAMES[m.monthIdx]} ${m.year}`).join(', ');
  console.log(`        in-catalog export: ${gkpIn.map.size} kws | months: ${fmtMonths(gkpIn.monthCols)}`);
  console.log(`        out-catalog export: ${gkpOut.map.size} kws | months: ${fmtMonths(gkpOut.monthCols)}`);

  mergeSet(kwsIn, gkpIn, 'in-catalog');
  mergeSet(kwsOut, gkpOut, 'out-of-catalog');

  // Union of all 2026 serials present on keywords (existing + newly merged)
  const serialSet = new Set();
  for (const k of [...kwsIn, ...kwsOut]) for (const s of k.m26bySerial.keys()) serialSet.add(s);
  const serials26 = [...serialSet].sort((a, b) => a - b);
  const W = buildWindow(serials26);
  const fmtSerial = (s) => {
    const d = serialToDate(s);
    return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };
  console.log(`[merge] 2026 months in data: ${serials26.map(fmtSerial).join(', ')}`);
  console.log(`[merge] Rolling window: ${fmtSerial(W.rollingSerials[0])} – ${fmtSerial(W.rollingSerials[11])}`);
  console.log(`[merge] Previous window: ${fmtSerial(W.prevSerials[0])} – ${fmtSerial(W.prevSerials[11])}`);

  for (const k of kwsIn) enrich(k, W);
  for (const k of kwsOut) enrich(k, W);

  const brandSheet = loadBrandsSheet(sheets['Brands']);
  console.log(`[merge] Brands sheet: ${brandSheet.rows.length} brands`);

  console.log('[merge] Rebuilding sheets...');
  const out = XLSX.utils.book_new();
  const add = (name, data) => {
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(out, ws, name);
    console.log(`  + ${name}: ${data.length} rows`);
  };

  add('Sezonsallık', buildSezonsallik(kwsIn, W));
  add('Özet Dashboard', buildOzet(kwsIn));
  add('Kat 1 Sez.', buildKatMonthly(kwsIn, 1, W));
  add('Kat 2 Sez.', buildKatMonthly(kwsIn, 2, W));
  add('Kat 3 Sez.', buildKatMonthly(kwsIn, 3, W));
  add('Top Yükselen & Düşenler', buildTrend(kwsIn));
  add('Sezonsallık Tipi', buildSezType(kwsIn, W));
  add('Peak Quarter Analizi', buildPeakQ(kwsIn));
  add('Akıllı Ürün Trendi', buildSmart(kwsIn));
  add('Fiyat Intent', buildPrice(kwsIn));
  add('Hacme Göre Top KWs', buildVolQ(kwsIn));
  add('Sezonsallık_Out', buildSezonsallik(kwsOut, W));
  add('Brands', buildBrands(brandSheet, [...kwsIn, ...kwsOut], W));

  if (args.dryRun) {
    console.log('[merge] Dry run — not writing output.');
    return;
  }
  XLSX.writeFile(out, args.out);
  const size = fs.statSync(args.out).size;
  console.log(`[merge] Wrote ${args.out} (${(size / 1024).toFixed(0)} KB)`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('[merge] ERROR:', e.message); process.exit(1); }
}

module.exports = { norm, serialOf, buildWindow };
