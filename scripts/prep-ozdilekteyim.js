// scripts/prep-ozdilekteyim.js
// Transforms the raw Özdilekteyim Excel into the template's canonical schema,
// synthesizing all analysis sheets from raw keyword data.
//
// Input:  --in <path-to-original-xlsx>
// Output: data/source.xlsx  (ready for `npm run build`)

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const OUT_XLSX = path.join(ROOT, 'data', 'source.xlsx');

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_SERIALS_2024 = [45292,45323,45352,45383,45413,45444,45474,45505,45536,45566,45597,45627];
const MONTH_SERIALS_2025 = [45658,45689,45717,45748,45778,45809,45839,45870,45901,45931,45962,45992];

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
function mean(a) { if (!a.length) return 0; return a.reduce((s,x)=>s+x,0) / a.length; }
function std(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0) / a.length);
}
function cv(a) { const m = mean(a); return m > 0 ? std(a) / m : 0; }

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--in' && args[i+1]) { out.in = args[i+1]; i++; }
  }
  if (!out.in) {
    console.error('Usage: node scripts/prep-ozdilekteyim.js --in <path-to-original.xlsx>');
    process.exit(1);
  }
  return out;
}

function loadRawKeywords(src) {
  const wb = XLSX.readFile(src);
  const sh = wb.Sheets['Sezonsallık'];
  if (!sh) throw new Error('Sezonsallık sheet not found in source');
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: true });

  const H = rows[0];
  const idx = {};
  for (let i = 0; i < H.length; i++) {
    const h = H[i] == null ? '' : String(H[i]);
    if (h === 'Main Cat.') idx.k1 = i;
    else if (h === 'Keyword Cat. 1') idx.k2 = i;
    else if (h === 'Keyword Cat. 2') idx.k3 = i;
    else if (h === 'Keyword') idx.kw = i;
    else if (h === 'Prev. 12 Month\nSearch vol') idx.a24 = i;
    else if (h === 'Last 12 Month\nSearch vol') idx.a25 = i;
    else if (h === 'YoY change') idx.yoy = i;
    else if (h === '2025 \nQ1 Peak') idx.q1 = i;
    else if (h === '2025 \nQ2 Peak') idx.q2 = i;
    else if (h === '2025 \nQ3 Peak') idx.q3 = i;
    else if (h === '2025 \nQ4 Peak') idx.q4 = i;
    else if (h === 'En Yüksek Ay? ' || h === 'En Yüksek Ay?') idx.peak = i;
    else if (h === 'Bucket') idx.bucket = i;
  }
  const required = ['k1','k2','k3','kw','a24','a25','yoy','q1','q2','q3','q4','peak','bucket'];
  for (const k of required) {
    if (idx[k] === undefined) throw new Error(`Column mapping missing: ${k}`);
  }
  const m24Start = idx.peak + 1;
  const m25Start = idx.bucket + 1;

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row[idx.kw]) continue;
    const k1 = String(row[idx.k1] || '').trim();
    const k2 = String(row[idx.k2] || '').trim();
    const k3 = String(row[idx.k3] || '').trim();
    if (!k1 && !k2 && !k3) continue;
    const m24 = [], m25 = [];
    for (let i = 0; i < 12; i++) m24.push(num(row[m24Start + i]));
    for (let i = 0; i < 12; i++) m25.push(num(row[m25Start + i]));
    out.push({
      k1, k2, k3,
      kw: String(row[idx.kw]).trim(),
      a24: num(row[idx.a24]),
      a25: num(row[idx.a25]),
      yoy: num(row[idx.yoy]),
      pq: [num(row[idx.q1]), num(row[idx.q2]), num(row[idx.q3]), num(row[idx.q4])],
      peakSerial: numOrNull(row[idx.peak]),
      bucket: String(row[idx.bucket] || '').trim(),
      m24, m25,
    });
  }
  return out;
}

function peakMonthSerial2025(m25) {
  let maxI = 0, maxV = -1;
  for (let i = 0; i < 12; i++) if (m25[i] > maxV) { maxV = m25[i]; maxI = i; }
  return MONTH_SERIALS_2025[maxI];
}
function peakMonthIdx(m25) {
  let maxI = 0, maxV = -1;
  for (let i = 0; i < 12; i++) if (m25[i] > maxV) { maxV = m25[i]; maxI = i; }
  return maxI;
}
function dipMonthIdx(m25) {
  let minI = 0, minV = Infinity;
  for (let i = 0; i < 12; i++) if (m25[i] < minV) { minV = m25[i]; minI = i; }
  return minI;
}

function dominantQuarter(pq) {
  const idx = pq.indexOf(Math.max(...pq));
  return ['Q1','Q2','Q3','Q4'][idx];
}

function bucketOf(a25) {
  if (a25 < 1000) return '0-1.000';
  if (a25 < 2000) return '1.000-2.000';
  if (a25 < 10000) return '2.000-10.000';
  if (a25 < 50000) return '10.000-50.000';
  return '50.000+';
}

function quartileOf(a25, quartiles) {
  if (a25 >= quartiles.q75) return 'Q1 (Top 25%)';
  if (a25 >= quartiles.q50) return 'Q2 (50-75%)';
  if (a25 >= quartiles.q25) return 'Q3 (25-50%)';
  return 'Q4 (Bottom 25%)';
}

// ———————————————————————————————————————————————————————————
// Build sheets
// ———————————————————————————————————————————————————————————

function buildSezonsallik(kws) {
  const header = [
    'Kat 1','Kat 2','Kat 3','Keyword',
    '2024 Avg. Search Volume','2025 Avg. Search Volume','YoY change',
    '2025 \nQ1 Peak','2025 \nQ2 Peak','2025 \nQ3 Peak','2025 \nQ4 Peak',
    'En Yuksek Ay?',
    ...MONTH_SERIALS_2024,
    'Bucket',
    ...MONTH_SERIALS_2025,
  ];
  const rows = [header];
  for (const k of kws) {
    rows.push([
      k.k1, k.k2, k.k3, k.kw,
      k.a24, k.a25, k.yoy,
      k.pq[0], k.pq[1], k.pq[2], k.pq[3],
      k.peakSerial || peakMonthSerial2025(k.m25),
      ...k.m24,
      k.bucket || bucketOf(k.a25),
      ...k.m25,
    ]);
  }
  return rows;
}

function buildOzet(kws) {
  // group by k1
  const groups = new Map();
  for (const k of kws) {
    if (!groups.has(k.k1)) groups.set(k.k1, []);
    groups.get(k.k1).push(k);
  }
  const totalSum25 = kws.reduce((s,k) => s + k.a25 * 12, 0);
  const desc = ["Kat 1 bazında portföy özeti. Her üst kategori için toplam hacim, YoY değişim, pazar payı ve öne çıkan keyword'ler özetlenir."];
  const header = ['Kat 1','Keyword Sayısı','2024 Toplam Hacim','2025 Toplam Hacim','YoY Değişim','Pazar Payı (2025)','Peak Çeyrek','En Yüksek Hacimli 3 Keyword','En Çok Artan Keyword','En Çok Düşen Keyword'];
  const rows = [desc, header];

  for (const [k1, list] of groups) {
    const tot24 = list.reduce((s,k) => s + k.a24 * 12, 0);
    const tot25 = list.reduce((s,k) => s + k.a25 * 12, 0);
    const yoy = pct(tot25, tot24);
    const share = totalSum25 > 0 ? tot25 / totalSum25 : 0;
    const pq = [0,0,0,0];
    for (const k of list) for (let i = 0; i < 4; i++) pq[i] += k.pq[i] * k.a25;
    const peakQ = dominantQuarter(pq);
    const top3 = [...list].sort((a,b) => b.a25 - a.a25).slice(0,3).map(k => k.kw).join(', ');
    const minVol = 100;
    const relevant = list.filter(k => k.a25 >= minVol && k.a24 >= minVol);
    const topGain = relevant.length ? [...relevant].sort((a,b)=>b.yoy-a.yoy)[0].kw : '';
    const topLoss = relevant.length ? [...relevant].sort((a,b)=>a.yoy-b.yoy)[0].kw : '';
    rows.push([k1, list.length, tot24, tot25, yoy, share, peakQ, top3, topGain, topLoss]);
  }
  return rows;
}

function buildKatMonthly(kws, level) {
  const groups = new Map();
  for (const k of kws) {
    const labels = level === 1 ? [k.k1] : level === 2 ? [k.k1, k.k2] : [k.k1, k.k2, k.k3];
    const key = labels.join('|||');
    if (!groups.has(key)) groups.set(key, { labels, list: [] });
    groups.get(key).list.push(k);
  }
  const katCols = [];
  for (let i = 1; i <= level; i++) katCols.push(`Kat ${i}`);
  const header = [
    ...katCols,
    '2024 Avg. Search Volume','2025 Avg. Search Volume','YoY Change',
    '2025 \nQ1 Peak','2025 \nQ2 Peak','2025 \nQ3 Peak','2025 \nQ4 Peak',
    'En Yuksek Ay?',
    ...MONTH_NAMES.map(m => `SUM of ${m} 2025`),
  ];
  const rows = [header];
  for (const { labels, list } of groups.values()) {
    const tot24 = list.reduce((s,k) => s + k.a24 * 12, 0);
    const tot25 = list.reduce((s,k) => s + k.a25 * 12, 0);
    const a24 = tot24 / 12;
    const a25 = tot25 / 12;
    const yoy = pct(a25, a24);
    const m25Sum = new Array(12).fill(0);
    for (const k of list) for (let i = 0; i < 12; i++) m25Sum[i] += k.m25[i];
    const pq = [0,0,0,0];
    for (let i = 0; i < 12; i++) pq[Math.floor(i/3)] += m25Sum[i];
    const maxPq = Math.max(...pq);
    const pqFlags = pq.map(v => v >= maxPq * 0.75 ? 1 : 0);
    const peakIdx = m25Sum.indexOf(Math.max(...m25Sum));
    rows.push([
      ...labels, a24, a25, yoy,
      ...pqFlags,
      MONTH_SERIALS_2025[peakIdx],
      ...m25Sum,
    ]);
  }
  return rows;
}

function buildTrend(kws) {
  const minVol = 100;
  const relevant = kws.filter(k => (k.a25 >= minVol || k.a24 >= minVol));
  const sorted = [...relevant].sort((a,b) => b.yoy - a.yoy);
  const top = sorted.slice(0, 500);
  const bot = sorted.slice(-500).reverse();
  const desc = ["Yükselen ve düşen keyword trendleri. Min. 100 ortalama arama hacmine sahip keyword'ler arasında YoY bazda en çok büyüyen ve eriyen terimleri gösterir. Yükselen keyword'ler yeni içerik ve landing page fırsatlarını, düşenler ise mevcut içeriklerde güncelleme ihtiyacını işaret eder."];
  const header = ['Kat 1','Kat 2','Kat 3','Keyword','2024 Avg','2025 Avg','YoY Değişim','Trend'];
  const rows = [desc, header];
  for (const k of top) rows.push([k.k1, k.k2, k.k3, k.kw, k.a24, k.a25, k.yoy, 'YÜKSELEN']);
  for (const k of bot) rows.push([k.k1, k.k2, k.k3, k.kw, k.a24, k.a25, k.yoy, 'DÜŞEN']);
  return rows;
}

function buildSezType(kws) {
  const minVol = 50;
  const desc = ["Keyword'lerin mevsimsellik profili. Coefficient of Variation (CV) ile 2025 aylık hacimlerin değişkenliği ölçülür; düşük CV evergreen (yıl boyu stabil), yüksek CV yüksek mevsimsellik demektir. Peak / dip oranı kampanya takvimini şekillendirmek için kullanılır."];
  const header = ['Kat 1','Kat 2','Keyword','2025 Avg','CV Skoru','Mevsimsellik Tipi','Peak Ay','Dip Ay','Peak/Dip Oranı'];
  const rows = [desc, header];
  for (const k of kws) {
    if (k.a25 < minVol) continue;
    const cvScore = cv(k.m25);
    let type;
    if (cvScore < 0.3) type = 'Evergreen';
    else if (cvScore < 0.7) type = 'Orta Mevsimsellik';
    else type = 'Yüksek Mevsimsellik';
    const peakI = peakMonthIdx(k.m25);
    const dipI = dipMonthIdx(k.m25);
    const peakV = k.m25[peakI];
    const dipV = Math.max(k.m25[dipI], 1);
    rows.push([k.k1, k.k2, k.kw, k.a25, cvScore, type, MONTH_SERIALS_2025[peakI], MONTH_SERIALS_2025[dipI], peakV / dipV]);
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
  const desc = ["Kat 2 bazında peak çeyrek dağılımı. Her alt kategorinin hangi çeyreklerde pik yaptığı yüzde olarak gösterilir; baskın çeyrek kampanya takvimi ve buyer guide planlaması için yol gösterir."];
  const header = ['Kat 1','Kat 2','KW Sayısı','Toplam Hacim','Q1 Peak %','Q2 Peak %','Q3 Peak %','Q4 Peak %','Baskın Çeyrek'];
  const rows = [desc, header];
  for (const { k1, k2, list } of groups.values()) {
    const count = list.length;
    const vol = list.reduce((s,k) => s + k.a25 * 12, 0);
    const pq = [0,0,0,0];
    for (const k of list) for (let i = 0; i < 4; i++) pq[i] += k.pq[i];
    const totalFlags = pq.reduce((s,x)=>s+x,0) || 1;
    const pct = pq.map(v => v / totalFlags);
    const dom = dominantQuarter(pq);
    rows.push([k1, k2, count, vol, pct[0], pct[1], pct[2], pct[3], dom]);
  }
  return rows;
}

function buildSmart(kws) {
  // Tag keywords as "Yıldız", "Büyüyen Star", "Erken Sinyal", "Stabil"
  const minVol = 300;
  const desc = ["Akıllı ürün trendleri. Hacim ve büyüme kombinasyonuna göre keyword'ler 4 segmente ayrılır: Yıldız (yüksek hacim + büyüme), Büyüyen Star (hızlı artan), Stabil (evergreen), Erken Sinyal (düşük hacim + agresif büyüme)."];
  const header = ['Kat 1','Kat 2','Keyword','2024 Avg','2025 Avg','YoY Değişim','Peak Ay','Segment Tag'];
  const rows = [desc, header];
  const meanVol = mean(kws.map(k => k.a25));
  for (const k of kws) {
    if (k.a25 < minVol) continue;
    let tag;
    if (k.a25 >= meanVol * 3 && k.yoy > 0.2) tag = 'Yıldız';
    else if (k.yoy > 0.5) tag = 'Büyüyen Star';
    else if (k.a25 >= meanVol && Math.abs(k.yoy) < 0.15) tag = 'Stabil';
    else if (k.a25 < meanVol && k.yoy > 0.3) tag = 'Erken Sinyal';
    else continue;
    rows.push([k.k1, k.k2, k.kw, k.a24, k.a25, k.yoy, MONTH_SERIALS_2025[peakMonthIdx(k.m25)], tag]);
  }
  return rows;
}

function buildPrice(kws) {
  const priceTerms = ['fiyat','fiyatlar','fiyatı','ucuz','indirim','kampanya','taksit','ne kadar','kac para','kaç para'];
  const desc = ["Fiyat intent keyword'leri. Kullanıcının satın alma niyeti gösteren 'fiyat', 'ucuz', 'indirim', 'taksit', 'ne kadar' gibi terimlerle yapılan aramalar; conversion oranı yüksek segment için ayrı strateji gerektirir."];
  const header = ['Kat 1','Kat 2','Keyword','2024 Avg','2025 Avg','YoY Değişim','Peak Ay'];
  const rows = [desc, header];
  for (const k of kws) {
    const kwLower = k.kw.toLowerCase();
    const match = priceTerms.some(t => kwLower.includes(t));
    if (!match) continue;
    if (k.a25 < 50) continue;
    rows.push([k.k1, k.k2, k.kw, k.a24, k.a25, k.yoy, MONTH_SERIALS_2025[peakMonthIdx(k.m25)]]);
  }
  return rows;
}

function buildVolQ(kws) {
  const withVol = kws.filter(k => k.a25 > 0).sort((a,b) => a.a25 - b.a25);
  if (withVol.length < 4) return [];
  const vols = withVol.map(k => k.a25);
  const qAt = (p) => {
    const i = Math.floor(vols.length * p);
    return vols[Math.min(i, vols.length - 1)];
  };
  const quartiles = { q25: qAt(0.25), q50: qAt(0.50), q75: qAt(0.75) };

  const buckets = {
    'Q1 (Top 25%)': [],
    'Q2 (50-75%)': [],
    'Q3 (25-50%)': [],
    'Q4 (Bottom 25%)': [],
  };
  for (const k of kws) {
    if (k.a25 <= 0) continue;
    buckets[quartileOf(k.a25, quartiles)].push(k);
  }

  const desc = ["Hacim bazlı kartil analizi. Keyword portföyü 2025 aylık ortalama hacmine göre dörde bölünür; her kartilin toplam hacim, ortalama YoY değişim ve mevsimsellik skorları özetlenir. Top 25% genellikle brand + genel kategori terimlerini, Bottom 25% ise long-tail arama niyetlerini kapsar."];
  const header1 = ['Quartile','KW Sayısı','Toplam 2025 Hacim','Ort. 2025 Avg','Min-Max Hacim Aralığı','Ort. YoY Değişim','Artan KW %','Azalan KW %','Ort. CV (Mevsimsellik)'];
  const rows = [desc, header1];
  for (const qName of ['Q1 (Top 25%)','Q2 (50-75%)','Q3 (25-50%)','Q4 (Bottom 25%)']) {
    const list = buckets[qName];
    if (!list.length) { rows.push([qName, 0, 0, 0, '', 0, 0, 0, 0]); continue; }
    const total = list.reduce((s,k) => s + k.a25 * 12, 0);
    const avg = mean(list.map(k => k.a25));
    const min = Math.min(...list.map(k => k.a25));
    const max = Math.max(...list.map(k => k.a25));
    const yoy = mean(list.map(k => k.yoy));
    const gain = list.filter(k => k.yoy > 0.05).length / list.length;
    const loss = list.filter(k => k.yoy < -0.05).length / list.length;
    const cvAvg = mean(list.map(k => cv(k.m25)));
    rows.push([qName, list.length, total, avg, `${Math.round(min)} - ${Math.round(max)}`, yoy, gain, loss, cvAvg]);
  }
  // gap row
  rows.push([]);
  rows.push(["Her kartilin en yüksek hacimli keyword'leri. Trend yönü (Artan/Azalan/Sabit) ±5% YoY eşiği ile belirlenir."]);
  const header2 = ['Quartile','Keyword','Kat 1','Kat 2','2025 Avg','YoY Değişim','CV','Peak Ay','Trend Yönü'];
  rows.push(header2);
  for (const qName of ['Q1 (Top 25%)','Q2 (50-75%)','Q3 (25-50%)','Q4 (Bottom 25%)']) {
    const list = buckets[qName] || [];
    const top = [...list].sort((a,b) => b.a25 - a.a25).slice(0, 25);
    for (const k of top) {
      let dir;
      if (k.yoy > 0.05) dir = 'Artan';
      else if (k.yoy < -0.05) dir = 'Azalan';
      else dir = 'Sabit';
      rows.push([qName, k.kw, k.k1, k.k2, k.a25, k.yoy, cv(k.m25), MONTH_SERIALS_2025[peakMonthIdx(k.m25)], dir]);
    }
  }
  return rows;
}

// ———————————————————————————————————————————————————————————
// Main
// ———————————————————————————————————————————————————————————

function main() {
  const args = parseArgs();
  console.log(`[prep] Reading ${args.in}`);
  const kws = loadRawKeywords(args.in);
  console.log(`[prep] Loaded ${kws.length} keywords`);

  const wb = XLSX.utils.book_new();
  const add = (name, data) => {
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name);
    console.log(`  + ${name}: ${data.length} rows`);
  };

  add('Sezonsallık', buildSezonsallik(kws));
  add('Özet Dashboard', buildOzet(kws));
  add('Kat 1 Sez.', buildKatMonthly(kws, 1));
  add('Kat 2 Sez.', buildKatMonthly(kws, 2));
  add('Kat 3 Sez.', buildKatMonthly(kws, 3));
  add('Top Yükselen & Düşenler', buildTrend(kws));
  add('Sezonsallık Tipi', buildSezType(kws));
  add('Peak Quarter Analizi', buildPeakQ(kws));
  add('Akıllı Ürün Trendi', buildSmart(kws));
  add('Fiyat Intent', buildPrice(kws));
  add('Hacme Göre Top KWs', buildVolQ(kws));

  XLSX.writeFile(wb, OUT_XLSX);
  const size = fs.statSync(OUT_XLSX).size;
  console.log(`[prep] Wrote ${OUT_XLSX} (${(size/1024).toFixed(0)} KB)`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('[prep] ERROR:', e.message); process.exit(1); }
}
