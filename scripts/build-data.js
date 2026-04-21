// scripts/build-data.js
// Converts data/source.xlsx + brand.config.js → data/dashboard.js
//
// Run: npm run build

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const SRC_XLSX = path.join(ROOT, 'data', 'source.xlsx');
const OUT_JS = path.join(ROOT, 'data', 'dashboard.js');
const BRAND_CONFIG = path.join(ROOT, 'brand.config.js');

// Tableau 10 colorblind-friendly palette — auto-assigned to Kat 1s by 2025 volume.
const PALETTE = [
  '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
  '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
];

function loadBrandConfig() {
  if (!fs.existsSync(BRAND_CONFIG)) {
    throw new Error(`brand.config.js not found at ${BRAND_CONFIG}`);
  }
  global.window = {};
  // Clear require cache so re-runs pick up edits
  delete require.cache[require.resolve(BRAND_CONFIG)];
  require(BRAND_CONFIG);
  const b = global.window.BRAND || {};
  return {
    name: b.name || 'Dashboard',
    title: b.title || 'Keyword Intelligence',
    subtitle: b.subtitle || '',
    lang: b.lang || 'tr',
    accent: b.accent || null,
    kat1ColorOverrides: b.kat1ColorOverrides || {},
    slug: b.slug || 'dashboard',
    agency: b.agency || { name: '', label: '', show: false },
  };
}

function loadWorkbook() {
  if (!fs.existsSync(SRC_XLSX)) {
    throw new Error(`Source Excel not found at ${SRC_XLSX}. Place your keyword Excel there.`);
  }
  const wb = XLSX.readFile(SRC_XLSX);
  const sheets = {};
  for (const name of wb.SheetNames) {
    sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null });
  }
  return sheets;
}

// ——————————————————————————————————————————————————————————
// Helpers
// ——————————————————————————————————————————————————————————

// Safely coerce to number (null/undefined/NaN → null)
function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Extract n-element window from row starting at given col index
function slice(row, start, count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(num(row[start + i]));
  return out;
}

// Find column index by header name (exact match). Returns -1 if not found.
function col(headerRow, name) {
  for (let i = 0; i < headerRow.length; i++) {
    if (headerRow[i] === name) return i;
  }
  return -1;
}

// Require a column; throws with a clear message if missing.
function mustCol(headerRow, name, sheetName) {
  const i = col(headerRow, name);
  if (i < 0) throw new Error(`Sheet "${sheetName}": required column "${name}" not found`);
  return i;
}

// Is row effectively blank (all null/empty)?
function blank(row) {
  if (!row || !row.length) return true;
  return row.every(v => v === null || v === undefined || v === '');
}

// ——————————————————————————————————————————————————————————
// Sheet parsers
// ——————————————————————————————————————————————————————————

// Sezonsallık → keywords[]
// Row 0: description; row 1: header; rows 2+: data.
// Header includes: Kat 1, Kat 2, Kat 3, [optional brand-specific col like "VitrA Not"],
// Keyword, 2024 Avg. Search Volume, 2025 Avg. Search Volume, YoY change,
// 2025 Q1 Peak..Q4 Peak, En Yuksek Ay?, <12 serial dates for 2024>, Bucket, <12 serials for 2025>
function parseSezonsallik(sheet) {
  if (!sheet || sheet.length < 2) throw new Error('Sheet "Sezonsallık": empty or missing header');
  // Header is at row 0 (no description row); data starts at row 1.
  const H = sheet[0];
  const iK1 = mustCol(H, 'Kat 1', 'Sezonsallık');
  const iK2 = mustCol(H, 'Kat 2', 'Sezonsallık');
  const iK3 = mustCol(H, 'Kat 3', 'Sezonsallık');
  const iKw = mustCol(H, 'Keyword', 'Sezonsallık');
  const iA24 = mustCol(H, '2024 Avg. Search Volume', 'Sezonsallık');
  const iA25 = mustCol(H, '2025 Avg. Search Volume', 'Sezonsallık');
  const iYoY = mustCol(H, 'YoY change', 'Sezonsallık');
  const iQ1 = mustCol(H, '2025 \nQ1 Peak', 'Sezonsallık');
  const iQ2 = mustCol(H, '2025 \nQ2 Peak', 'Sezonsallık');
  const iQ3 = mustCol(H, '2025 \nQ3 Peak', 'Sezonsallık');
  const iQ4 = mustCol(H, '2025 \nQ4 Peak', 'Sezonsallık');
  const iPeak = mustCol(H, 'En Yuksek Ay?', 'Sezonsallık');
  const iBucket = mustCol(H, 'Bucket', 'Sezonsallık');
  // 2024 months: 12 numeric headers immediately after iPeak up to (but not including) iBucket
  const m24Start = iPeak + 1;
  const m24End = iBucket; // exclusive
  if (m24End - m24Start !== 12) {
    throw new Error(`Sezonsallık: expected 12 month columns between "En Yuksek Ay?" and "Bucket", got ${m24End - m24Start}`);
  }
  // 2025 months: 12 numeric headers after iBucket to end of row
  const m25Start = iBucket + 1;

  const out = [];
  for (let r = 1; r < sheet.length; r++) {
    const row = sheet[r];
    if (blank(row)) continue;
    if (!row[iKw]) continue;
    out.push({
      k1: String(row[iK1] || ''),
      k2: String(row[iK2] || ''),
      k3: String(row[iK3] || ''),
      kw: String(row[iKw]),
      a24: num(row[iA24]),
      a25: num(row[iA25]),
      yoy: num(row[iYoY]),
      pq: [num(row[iQ1]) || 0, num(row[iQ2]) || 0, num(row[iQ3]) || 0, num(row[iQ4]) || 0],
      peakSerial: num(row[iPeak]),
      m24: slice(row, m24Start, 12),
      bucket: String(row[iBucket] || ''),
      m25: slice(row, m25Start, 12),
    });
  }
  return out;
}

// Özet Dashboard → kat1Summary[]
// Row 0: description; row 1: header; rows 2+: data (one per Kat 1).
function parseOzetDashboard(sheet) {
  if (!sheet || sheet.length < 3) return [];
  const H = sheet[1];
  const iK1 = mustCol(H, 'Kat 1', 'Özet Dashboard');
  const iCnt = mustCol(H, 'Keyword Sayısı', 'Özet Dashboard');
  const iT24 = mustCol(H, '2024 Toplam Hacim', 'Özet Dashboard');
  const iT25 = mustCol(H, '2025 Toplam Hacim', 'Özet Dashboard');
  const iYoY = mustCol(H, 'YoY Değişim', 'Özet Dashboard');
  const iShr = mustCol(H, 'Pazar Payı (2025)', 'Özet Dashboard');
  const iPq  = mustCol(H, 'Peak Çeyrek', 'Özet Dashboard');
  const iTop = mustCol(H, 'En Yüksek Hacimli 3 Keyword', 'Özet Dashboard');
  const iGain = mustCol(H, 'En Çok Artan Keyword', 'Özet Dashboard');
  const iLoss = mustCol(H, 'En Çok Düşen Keyword', 'Özet Dashboard');

  const out = [];
  for (let r = 2; r < sheet.length; r++) {
    const row = sheet[r];
    if (blank(row) || !row[iK1]) continue;
    out.push({
      k1: String(row[iK1]),
      kwCount: num(row[iCnt]),
      tot24: num(row[iT24]),
      tot25: num(row[iT25]),
      yoy: num(row[iYoY]),
      share: num(row[iShr]),
      peakQ: String(row[iPq] || ''),
      top3: String(row[iTop] || ''),
      topGain: String(row[iGain] || ''),
      topLoss: String(row[iLoss] || ''),
    });
  }
  return out;
}

// Kat 1/2/3 Sez. → kat{N}Monthly[]
// level: 1 → labels=[k1]; 2 → labels=[k1,k2]; 3 → labels=[k1,k2,k3]
function parseKatMonthly(sheet, level) {
  if (!sheet || sheet.length < 2) return [];
  // Header is at row 0 (no description row); data starts at row 1.
  const H = sheet[0];
  const sheetName = `Kat ${level} Sez.`;
  const iKs = [];
  for (let i = 1; i <= level; i++) iKs.push(mustCol(H, `Kat ${i}`, sheetName));
  const iA24 = mustCol(H, '2024 Avg. Search Volume', sheetName);
  const iA25 = mustCol(H, '2025 Avg. Search Volume', sheetName);
  const iYoY = mustCol(H, 'YoY Change', sheetName);
  const iQ1 = mustCol(H, '2025 \nQ1 Peak', sheetName);
  const iQ2 = mustCol(H, '2025 \nQ2 Peak', sheetName);
  const iQ3 = mustCol(H, '2025 \nQ3 Peak', sheetName);
  const iQ4 = mustCol(H, '2025 \nQ4 Peak', sheetName);
  const iPeak = mustCol(H, 'En Yuksek Ay?', sheetName);
  // 12 monthly columns immediately after iPeak (SUM of Jan/Feb/.../Dec 2025)
  const mStart = iPeak + 1;

  const out = [];
  for (let r = 1; r < sheet.length; r++) {
    const row = sheet[r];
    if (blank(row) || !row[iKs[0]]) continue;
    const labels = iKs.map(i => String(row[i] || ''));
    out.push({
      labels,
      a24: num(row[iA24]),
      a25: num(row[iA25]),
      yoy: num(row[iYoY]),
      pq: [num(row[iQ1]) || 0, num(row[iQ2]) || 0, num(row[iQ3]) || 0, num(row[iQ4]) || 0],
      m25: slice(row, mStart, 12),
    });
  }
  return out;
}

// Top Yükselen & Düşenler → trendRows[]
function parseTrendRows(sheet) {
  if (!sheet || sheet.length < 3) return [];
  const H = sheet[1];
  const iK1 = mustCol(H, 'Kat 1', 'Top Yükselen & Düşenler');
  const iK2 = mustCol(H, 'Kat 2', 'Top Yükselen & Düşenler');
  const iK3 = mustCol(H, 'Kat 3', 'Top Yükselen & Düşenler');
  const iKw = mustCol(H, 'Keyword', 'Top Yükselen & Düşenler');
  const iA24 = mustCol(H, '2024 Avg', 'Top Yükselen & Düşenler');
  const iA25 = mustCol(H, '2025 Avg', 'Top Yükselen & Düşenler');
  const iYoY = mustCol(H, 'YoY Değişim', 'Top Yükselen & Düşenler');
  const iTrend = mustCol(H, 'Trend', 'Top Yükselen & Düşenler');

  const out = [];
  for (let r = 2; r < sheet.length; r++) {
    const row = sheet[r];
    if (blank(row) || !row[iKw]) continue;
    out.push({
      k1: String(row[iK1] || ''),
      k2: String(row[iK2] || ''),
      k3: String(row[iK3] || ''),
      kw: String(row[iKw]),
      a24: num(row[iA24]),
      a25: num(row[iA25]),
      yoy: num(row[iYoY]),
      trend: String(row[iTrend] || ''),
    });
  }
  return out;
}

// Sezonsallık Tipi → sezType[]
function parseSezType(sheet) {
  if (!sheet || sheet.length < 3) return [];
  const H = sheet[1];
  const iK1 = mustCol(H, 'Kat 1', 'Sezonsallık Tipi');
  const iK2 = mustCol(H, 'Kat 2', 'Sezonsallık Tipi');
  const iKw = mustCol(H, 'Keyword', 'Sezonsallık Tipi');
  const iA25 = mustCol(H, '2025 Avg', 'Sezonsallık Tipi');
  const iCv = mustCol(H, 'CV Skoru', 'Sezonsallık Tipi');
  const iType = mustCol(H, 'Mevsimsellik Tipi', 'Sezonsallık Tipi');
  const iPeak = mustCol(H, 'Peak Ay', 'Sezonsallık Tipi');
  const iDip = mustCol(H, 'Dip Ay', 'Sezonsallık Tipi');
  const iPdr = mustCol(H, 'Peak/Dip Oranı', 'Sezonsallık Tipi');

  const out = [];
  for (let r = 2; r < sheet.length; r++) {
    const row = sheet[r];
    if (blank(row) || !row[iKw]) continue;
    out.push({
      k1: String(row[iK1] || ''),
      k2: String(row[iK2] || ''),
      kw: String(row[iKw]),
      a25: num(row[iA25]),
      cv: num(row[iCv]),
      type: String(row[iType] || ''),
      peakMonth: num(row[iPeak]),
      dipMonth: num(row[iDip]),
      pdRatio: num(row[iPdr]),
    });
  }
  return out;
}

// Peak Quarter Analizi → peakQ[]
function parsePeakQ(sheet) {
  if (!sheet || sheet.length < 3) return [];
  const H = sheet[1];
  const iK1 = mustCol(H, 'Kat 1', 'Peak Quarter Analizi');
  const iK2 = mustCol(H, 'Kat 2', 'Peak Quarter Analizi');
  const iCnt = mustCol(H, 'KW Sayısı', 'Peak Quarter Analizi');
  const iVol = mustCol(H, 'Toplam Hacim', 'Peak Quarter Analizi');
  const iQ1 = mustCol(H, 'Q1 Peak %', 'Peak Quarter Analizi');
  const iQ2 = mustCol(H, 'Q2 Peak %', 'Peak Quarter Analizi');
  const iQ3 = mustCol(H, 'Q3 Peak %', 'Peak Quarter Analizi');
  const iQ4 = mustCol(H, 'Q4 Peak %', 'Peak Quarter Analizi');
  const iDom = mustCol(H, 'Baskın Çeyrek', 'Peak Quarter Analizi');

  const out = [];
  for (let r = 2; r < sheet.length; r++) {
    const row = sheet[r];
    if (blank(row) || !row[iK1]) continue;
    out.push({
      k1: String(row[iK1]),
      k2: String(row[iK2] || ''),
      count: num(row[iCnt]),
      vol: num(row[iVol]),
      q1: num(row[iQ1]),
      q2: num(row[iQ2]),
      q3: num(row[iQ3]),
      q4: num(row[iQ4]),
      dominant: String(row[iDom] || ''),
    });
  }
  return out;
}

// Akıllı Ürün Trendi → smart[]
function parseSmart(sheet) {
  if (!sheet || sheet.length < 3) return [];
  const H = sheet[1];
  const iK1 = mustCol(H, 'Kat 1', 'Akıllı Ürün Trendi');
  const iK2 = mustCol(H, 'Kat 2', 'Akıllı Ürün Trendi');
  const iKw = mustCol(H, 'Keyword', 'Akıllı Ürün Trendi');
  const iA24 = mustCol(H, '2024 Avg', 'Akıllı Ürün Trendi');
  const iA25 = mustCol(H, '2025 Avg', 'Akıllı Ürün Trendi');
  const iYoY = mustCol(H, 'YoY Değişim', 'Akıllı Ürün Trendi');
  const iPeak = mustCol(H, 'Peak Ay', 'Akıllı Ürün Trendi');
  const iTag = mustCol(H, 'Segment Tag', 'Akıllı Ürün Trendi');

  const out = [];
  for (let r = 2; r < sheet.length; r++) {
    const row = sheet[r];
    if (blank(row) || !row[iKw]) continue;
    out.push({
      k1: String(row[iK1] || ''),
      k2: String(row[iK2] || ''),
      kw: String(row[iKw]),
      a24: num(row[iA24]),
      a25: num(row[iA25]),
      yoy: num(row[iYoY]),
      peakMonth: num(row[iPeak]),
      tag: String(row[iTag] || ''),
    });
  }
  return out;
}

// Fiyat Intent → price[]
function parsePrice(sheet) {
  if (!sheet || sheet.length < 3) return [];
  const H = sheet[1];
  const iK1 = mustCol(H, 'Kat 1', 'Fiyat Intent');
  const iK2 = mustCol(H, 'Kat 2', 'Fiyat Intent');
  const iKw = mustCol(H, 'Keyword', 'Fiyat Intent');
  const iA24 = mustCol(H, '2024 Avg', 'Fiyat Intent');
  const iA25 = mustCol(H, '2025 Avg', 'Fiyat Intent');
  const iYoY = mustCol(H, 'YoY Değişim', 'Fiyat Intent');
  const iPeak = mustCol(H, 'Peak Ay', 'Fiyat Intent');

  const out = [];
  for (let r = 2; r < sheet.length; r++) {
    const row = sheet[r];
    if (blank(row) || !row[iKw]) continue;
    out.push({
      k1: String(row[iK1] || ''),
      k2: String(row[iK2] || ''),
      kw: String(row[iKw]),
      a24: num(row[iA24]),
      a25: num(row[iA25]),
      yoy: num(row[iYoY]),
      peakMonth: num(row[iPeak]),
    });
  }
  return out;
}

// Hacme Göre Top KWs — two sub-tables in one sheet.
// Rows 2-5: volQ (4 quartile summary rows). Header at row 1.
// Row 6: blank. Row 7: sub-header text. Row 8: volQKws header. Rows 9+: volQKws.
function parseVolQ(sheet) {
  if (!sheet || sheet.length < 6) return [];
  const H = sheet[1];
  const iQ = mustCol(H, 'Quartile', 'Hacme Göre Top KWs');
  const iCnt = mustCol(H, 'KW Sayısı', 'Hacme Göre Top KWs');
  const iTot = mustCol(H, 'Toplam 2025 Hacim', 'Hacme Göre Top KWs');
  const iAvg = mustCol(H, 'Ort. 2025 Avg', 'Hacme Göre Top KWs');
  const iRng = mustCol(H, 'Min-Max Hacim Aralığı', 'Hacme Göre Top KWs');
  const iYoY = mustCol(H, 'Ort. YoY Değişim', 'Hacme Göre Top KWs');
  const iGain = mustCol(H, 'Artan KW %', 'Hacme Göre Top KWs');
  const iLoss = mustCol(H, 'Azalan KW %', 'Hacme Göre Top KWs');
  const iCv = mustCol(H, 'Ort. CV (Mevsimsellik)', 'Hacme Göre Top KWs');

  const out = [];
  for (let r = 2; r <= 5; r++) {
    const row = sheet[r];
    if (!row || blank(row) || !row[iQ]) continue;
    out.push({
      quartile: String(row[iQ]),
      count: num(row[iCnt]),
      total: num(row[iTot]),
      avg: num(row[iAvg]),
      range: String(row[iRng] || ''),
      yoy: num(row[iYoY]),
      pctGain: num(row[iGain]),
      pctLoss: num(row[iLoss]),
      cv: num(row[iCv]),
    });
  }
  return out;
}

function parseVolQKws(sheet) {
  if (!sheet || sheet.length < 10) return [];
  // Find the sub-header row starting from row 6 that has "Quartile" + "Keyword" columns
  let headerRow = -1;
  for (let r = 6; r < Math.min(sheet.length, 20); r++) {
    const row = sheet[r];
    if (row && row[0] === 'Quartile' && row[1] === 'Keyword') { headerRow = r; break; }
  }
  if (headerRow < 0) return [];
  const H = sheet[headerRow];
  const iQ = mustCol(H, 'Quartile', 'Hacme Göre Top KWs (sub)');
  const iKw = mustCol(H, 'Keyword', 'Hacme Göre Top KWs (sub)');
  const iK1 = mustCol(H, 'Kat 1', 'Hacme Göre Top KWs (sub)');
  const iK2 = mustCol(H, 'Kat 2', 'Hacme Göre Top KWs (sub)');
  const iA25 = mustCol(H, '2025 Avg', 'Hacme Göre Top KWs (sub)');
  const iYoY = mustCol(H, 'YoY Değişim', 'Hacme Göre Top KWs (sub)');
  const iCv = mustCol(H, 'CV', 'Hacme Göre Top KWs (sub)');
  const iPeak = mustCol(H, 'Peak Ay', 'Hacme Göre Top KWs (sub)');
  const iDir = mustCol(H, 'Trend Yönü', 'Hacme Göre Top KWs (sub)');

  const out = [];
  for (let r = headerRow + 1; r < sheet.length; r++) {
    const row = sheet[r];
    if (blank(row) || !row[iKw]) continue;
    out.push({
      quartile: String(row[iQ] || ''),
      kw: String(row[iKw]),
      k1: String(row[iK1] || ''),
      k2: String(row[iK2] || ''),
      a25: num(row[iA25]),
      yoy: num(row[iYoY]),
      cv: num(row[iCv]),
      peakMonth: num(row[iPeak]),
      dir: String(row[iDir] || ''),
    });
  }
  return out;
}

// ——————————————————————————————————————————————————————————
// Derived outputs
// ——————————————————————————————————————————————————————————

function buildMonths() {
  const months2024 = [];
  const months2025 = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    months2024.push(`2024-${mm}`);
    months2025.push(`2025-${mm}`);
  }
  return { months2024, months2025 };
}

function computeKat1Colors(kat1Summary, overrides) {
  const sorted = [...kat1Summary].sort((a, b) => (b.tot25 || 0) - (a.tot25 || 0));
  const out = {};
  sorted.forEach((row, i) => {
    out[row.k1] = PALETTE[i % PALETTE.length];
  });
  for (const [k, v] of Object.entries(overrides || {})) {
    if (v && typeof v === 'string') out[k] = v;
  }
  return out;
}

function computeBrandAccent(brand, kat1Colors, sortedKat1s) {
  if (brand.accent && typeof brand.accent === 'string' && brand.accent.length > 0) {
    return brand.accent;
  }
  if (sortedKat1s.length > 0 && kat1Colors[sortedKat1s[0]]) {
    return kat1Colors[sortedKat1s[0]];
  }
  return PALETTE[0];
}

function main() {
  console.log('[build-data] Loading brand config...');
  const brand = loadBrandConfig();
  console.log(`  brand: ${brand.name} (slug: ${brand.slug})`);

  console.log('[build-data] Reading source.xlsx...');
  const sheets = loadWorkbook();
  console.log(`  sheets: ${Object.keys(sheets).join(', ')}`);

  console.log('[build-data] Parsing sheets...');
  const { months2024, months2025 } = buildMonths();
  const keywords = parseSezonsallik(sheets['Sezonsallık']);
  const kat1Summary = parseOzetDashboard(sheets['Özet Dashboard'] || []);
  const kat1Monthly = parseKatMonthly(sheets['Kat 1 Sez.'] || [], 1);
  const kat2Monthly = parseKatMonthly(sheets['Kat 2 Sez.'] || [], 2);
  const kat3Monthly = parseKatMonthly(sheets['Kat 3 Sez.'] || [], 3);
  const trendRows = parseTrendRows(sheets['Top Yükselen & Düşenler'] || []);
  const sezType = parseSezType(sheets['Sezonsallık Tipi'] || []);
  const peakQ = parsePeakQ(sheets['Peak Quarter Analizi'] || []);
  const smart = parseSmart(sheets['Akıllı Ürün Trendi'] || []);
  const price = parsePrice(sheets['Fiyat Intent'] || []);
  const volQ = parseVolQ(sheets['Hacme Göre Top KWs'] || []);
  const volQKws = parseVolQKws(sheets['Hacme Göre Top KWs'] || []);

  console.log(`  keywords: ${keywords.length}`);
  console.log(`  kat1Summary: ${kat1Summary.length}, kat1Monthly: ${kat1Monthly.length}, kat2Monthly: ${kat2Monthly.length}, kat3Monthly: ${kat3Monthly.length}`);
  console.log(`  trendRows: ${trendRows.length}, sezType: ${sezType.length}, peakQ: ${peakQ.length}`);
  console.log(`  smart: ${smart.length}, price: ${price.length}, volQ: ${volQ.length}, volQKws: ${volQKws.length}`);

  // Compute colors
  const kat1Colors = computeKat1Colors(kat1Summary, brand.kat1ColorOverrides);
  const sortedKat1s = [...kat1Summary].sort((a, b) => (b.tot25 || 0) - (a.tot25 || 0)).map(r => r.k1);
  const brandAccent = computeBrandAccent(brand, kat1Colors, sortedKat1s);
  console.log(`  kat1Colors: ${Object.keys(kat1Colors).length} categories, accent: ${brandAccent}`);

  // Assemble DATA object
  const DATA = {
    months2024, months2025,
    keywords,
    kat1Summary,
    kat1Monthly, kat2Monthly, kat3Monthly,
    trendRows, sezType, peakQ,
    smart, price, volQ, volQKws,
  };

  // Write dashboard.js
  const body =
    `// Generated by scripts/build-data.js — do not edit by hand.\n` +
    `// Source: data/source.xlsx | Brand: ${brand.name}\n` +
    `window.DATA = ${JSON.stringify(DATA)};\n` +
    `window.KAT1_COLORS = ${JSON.stringify(kat1Colors)};\n` +
    `window.BRAND_ACCENT = ${JSON.stringify(brandAccent)};\n`;
  fs.writeFileSync(OUT_JS, body, 'utf8');
  console.log(`[build-data] Wrote ${OUT_JS} (${(body.length / 1024).toFixed(1)} KB)`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('[build-data] ERROR:', err.message);
    process.exit(1);
  }
}

module.exports = {
  loadBrandConfig, loadWorkbook, PALETTE,
  parseSezonsallik, parseOzetDashboard, parseKatMonthly,
  parseTrendRows, parseSezType, parsePeakQ,
  parseSmart, parsePrice, parseVolQ, parseVolQKws,
  buildMonths, computeKat1Colors, computeBrandAccent,
};
