// scripts/build-data.test.js
// Run: npm test

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { loadWorkbook, parseSezonsallik, parseOzetDashboard,
        parseKatMonthly, parseTrendRows, parseSezType, parsePeakQ,
        parseSmart, parsePrice, parseVolQ, parseVolQKws,
        computeKat1Colors, computeBrandAccent, buildMonths,
        PALETTE } = require('./build-data.js');

const sheets = loadWorkbook();

test('parseSezonsallik returns 9384 keyword rows with correct shape', () => {
  const out = parseSezonsallik(sheets['Sezonsallık']);
  assert.equal(out.length, 9384);
  const k = out[0];
  assert.ok(k.k1 && k.k2 && k.k3 && k.kw, 'cat fields + keyword');
  assert.equal(typeof k.a24, 'number');
  assert.equal(typeof k.a25, 'number');
  assert.equal(typeof k.yoy, 'number');
  assert.equal(k.pq.length, 4);
  assert.equal(k.m24.length, 12);
  assert.equal(k.m25.length, 12);
  assert.equal(typeof k.bucket, 'string');
});

test('parseSezonsallik carries rolling fields (m26, r12, p12, ryoy, rpq, rpeakSerial)', () => {
  const out = parseSezonsallik(sheets['Sezonsallık']);
  const k = out[0];
  assert.equal(k.m26.length, 6);
  assert.equal(typeof k.r12, 'number');
  assert.equal(typeof k.p12, 'number');
  assert.equal(k.rpq.length, 4);
  // rolling peak must be inside the Jul 2025 – Jun 2026 window
  assert.ok(k.rpeakSerial >= 45839 && k.rpeakSerial <= 46174,
    `rpeakSerial ${k.rpeakSerial} outside rolling window`);
});

test('r12 equals mean of m25[6..11] + m26[0..5] (merge/parser parity)', () => {
  const out = parseSezonsallik(sheets['Sezonsallık']);
  const k = out[0];
  const window = [...k.m25.slice(6), ...k.m26].map(v => v || 0);
  const expected = window.reduce((s, x) => s + x, 0) / 12;
  assert.ok(Math.abs(k.r12 - expected) < 1e-6, `r12=${k.r12} expected=${expected}`);
});

test('outKeywords sheet also carries rolling fields', () => {
  const out = parseSezonsallik(sheets['Sezonsallık_Out'], 'Sezonsallık_Out');
  assert.equal(out.length, 1722);
  assert.equal(out[0].m26.length, 6);
  assert.equal(typeof out[0].r12, 'number');
});

test('parseOzetDashboard returns one row per Kat 1 with calendar + rolling totals', () => {
  const out = parseOzetDashboard(sheets['Özet Dashboard']);
  assert.ok(out.length >= 1);
  const r = out[0];
  assert.ok(r.k1);
  assert.equal(typeof r.kwCount, 'number');
  assert.equal(typeof r.tot24, 'number');
  assert.equal(typeof r.tot25, 'number');
  assert.equal(typeof r.totR12, 'number');
  assert.equal(typeof r.totP12, 'number');
  assert.equal(typeof r.share, 'number');
  assert.ok(['Q1','Q2','Q3','Q4'].includes(r.peakQ));
});

test('parseKatMonthly handles Kat 1 Sez. (1-level label) with rolling fields', () => {
  const out = parseKatMonthly(sheets['Kat 1 Sez.'], 1);
  assert.ok(out.length >= 1);
  assert.equal(out[0].labels.length, 1);
  assert.equal(out[0].pq.length, 4);
  assert.equal(out[0].m25.length, 12);
  assert.equal(out[0].m26.length, 6);
  assert.equal(typeof out[0].r12, 'number');
  assert.equal(out[0].rpq.length, 4);
});

test('parseKatMonthly handles Kat 3 Sez. (3-level label)', () => {
  const out = parseKatMonthly(sheets['Kat 3 Sez.'], 3);
  assert.ok(out.length >= 1);
  assert.equal(out[0].labels.length, 3);
});

test('parseTrendRows extracts rising/falling keywords with rolling fields', () => {
  const out = parseTrendRows(sheets['Top Yükselen & Düşenler']);
  assert.ok(out.length > 0);
  const r = out[0];
  assert.ok(r.k1 && r.kw);
  assert.equal(typeof r.prev, 'number');
  assert.equal(typeof r.last, 'number');
  assert.equal(typeof r.ryoy, 'number');
  assert.ok(['YÜKSELEN', 'DÜŞEN'].includes(r.trend));
});

test('parseSezType computes CV + type on rolling window', () => {
  const out = parseSezType(sheets['Sezonsallık Tipi']);
  assert.ok(out.length > 0);
  const r = out[0];
  assert.ok(r.k1 && r.kw);
  assert.equal(typeof r.last, 'number');
  assert.equal(typeof r.cv, 'number');
  assert.ok(['Evergreen','Orta Mevsimsellik','Yüksek Mevsimsellik'].includes(r.type));
  // peak month serial must be inside the rolling window
  assert.ok(r.peakMonth >= 45839 && r.peakMonth <= 46174);
});

test('parsePeakQ returns Kat 2 quarter distribution', () => {
  const out = parsePeakQ(sheets['Peak Quarter Analizi']);
  assert.ok(out.length > 0);
  const r = out[0];
  assert.ok(r.k1 && r.k2);
  assert.equal(typeof r.q1, 'number');
  assert.equal(typeof r.q2, 'number');
  assert.equal(typeof r.q3, 'number');
  assert.equal(typeof r.q4, 'number');
  assert.ok(['Q1','Q2','Q3','Q4'].includes(r.dominant));
});

test('parseSmart extracts smart-product keywords with tags', () => {
  const out = parseSmart(sheets['Akıllı Ürün Trendi']);
  assert.ok(out.length > 0);
  assert.ok(out[0].tag);
  assert.equal(typeof out[0].last, 'number');
  assert.equal(typeof out[0].ryoy, 'number');
});

test('parsePrice extracts price-intent keywords', () => {
  const out = parsePrice(sheets['Fiyat Intent']);
  assert.ok(out.length > 0);
  assert.ok(out[0].k1 && out[0].kw);
  assert.equal(typeof out[0].last, 'number');
});

test('parseVolQ returns 4 quartile rows', () => {
  const out = parseVolQ(sheets['Hacme Göre Top KWs']);
  assert.equal(out.length, 4);
  assert.ok(out[0].quartile);
  assert.equal(typeof out[0].count, 'number');
});

test('parseVolQKws returns top keywords per quartile', () => {
  const out = parseVolQKws(sheets['Hacme Göre Top KWs']);
  assert.ok(out.length >= 100);
  const r = out[0];
  assert.ok(r.quartile && r.kw);
  assert.equal(typeof r.last, 'number');
  assert.ok(['Artan','Azalan','Sabit'].includes(r.dir));
});

test('buildMonths generates calendar arrays + rolling windows', () => {
  const { months2024, months2025, months2026, monthsR12, monthsP12 } = buildMonths(6);
  assert.equal(months2024.length, 12);
  assert.equal(months2025.length, 12);
  assert.equal(months2026.length, 6);
  assert.equal(months2024[0], '2024-01');
  assert.equal(months2025[11], '2025-12');
  assert.equal(months2026[5], '2026-06');
  assert.equal(monthsR12.length, 12);
  assert.equal(monthsR12[0], '2025-07');
  assert.equal(monthsR12[11], '2026-06');
  assert.equal(monthsP12[0], '2024-07');
  assert.equal(monthsP12[11], '2025-06');
});

test('computeKat1Colors sorts by rolling volume and assigns palette', () => {
  const kat1Summary = [
    { k1: 'Small', totR12: 100 },
    { k1: 'Big',   totR12: 1000 },
    { k1: 'Mid',   totR12: 500 },
  ];
  const colors = computeKat1Colors(kat1Summary, {});
  assert.equal(colors['Big'], PALETTE[0]);
  assert.equal(colors['Mid'], PALETTE[1]);
  assert.equal(colors['Small'], PALETTE[2]);
});

test('computeKat1Colors respects overrides', () => {
  const kat1Summary = [
    { k1: 'Big', totR12: 1000 },
    { k1: 'Mid', totR12: 500 },
  ];
  const colors = computeKat1Colors(kat1Summary, { 'Big': '#FF0000' });
  assert.equal(colors['Big'], '#FF0000');
  assert.equal(colors['Mid'], PALETTE[1]);
});

test('computeBrandAccent prefers config accent when set', () => {
  const colors = { 'A': '#111111', 'B': '#222222' };
  assert.equal(computeBrandAccent({ accent: '#FF5733' }, colors, ['A','B']), '#FF5733');
});

test('computeBrandAccent falls back to top Kat1 color', () => {
  const colors = { 'A': '#111111', 'B': '#222222' };
  assert.equal(computeBrandAccent({ accent: null }, colors, ['A','B']), '#111111');
});

test('computeBrandAccent falls back to palette[0] if no kat1 colors', () => {
  assert.equal(computeBrandAccent({ accent: null }, {}, []), PALETTE[0]);
});
