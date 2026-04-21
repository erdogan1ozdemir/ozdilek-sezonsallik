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

test('parseSezonsallik returns 2420 keyword rows with correct shape', () => {
  const out = parseSezonsallik(sheets['Sezonsallık']);
  assert.equal(out.length, 2420);
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

test('parseOzetDashboard returns one row per Kat 1 with 10 fields', () => {
  const out = parseOzetDashboard(sheets['Özet Dashboard']);
  assert.ok(out.length >= 1);
  const r = out[0];
  assert.ok(r.k1);
  assert.equal(typeof r.kwCount, 'number');
  assert.equal(typeof r.tot24, 'number');
  assert.equal(typeof r.tot25, 'number');
  assert.equal(typeof r.share, 'number');
  assert.ok(['Q1','Q2','Q3','Q4'].includes(r.peakQ));
});

test('parseKatMonthly handles Kat 1 Sez. (1-level label)', () => {
  const out = parseKatMonthly(sheets['Kat 1 Sez.'], 1);
  assert.ok(out.length >= 1);
  assert.equal(out[0].labels.length, 1);
  assert.equal(out[0].pq.length, 4);
  assert.equal(out[0].m25.length, 12);
});

test('parseKatMonthly handles Kat 3 Sez. (3-level label)', () => {
  const out = parseKatMonthly(sheets['Kat 3 Sez.'], 3);
  assert.ok(out.length >= 1);
  assert.equal(out[0].labels.length, 3);
});

test('parseTrendRows extracts rising/falling keywords', () => {
  const out = parseTrendRows(sheets['Top Yükselen & Düşenler']);
  assert.ok(out.length > 0);
  const r = out[0];
  assert.ok(r.k1 && r.kw);
  assert.ok(['YÜKSELEN', 'DÜŞEN'].includes(r.trend));
});

test('parseSezType computes CV + type', () => {
  const out = parseSezType(sheets['Sezonsallık Tipi']);
  assert.ok(out.length > 0);
  const r = out[0];
  assert.ok(r.k1 && r.kw);
  assert.equal(typeof r.cv, 'number');
  assert.ok(['Evergreen','Orta Mevsimsellik','Yüksek Mevsimsellik'].includes(r.type));
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
});

test('parsePrice extracts price-intent keywords', () => {
  const out = parsePrice(sheets['Fiyat Intent']);
  assert.ok(out.length > 0);
  assert.ok(out[0].k1 && out[0].kw);
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
  assert.ok(['Artan','Azalan','Sabit'].includes(r.dir));
});

test('buildMonths generates 12-month arrays for 2024 and 2025', () => {
  const { months2024, months2025 } = buildMonths();
  assert.equal(months2024.length, 12);
  assert.equal(months2025.length, 12);
  assert.equal(months2024[0], '2024-01');
  assert.equal(months2025[11], '2025-12');
});

test('computeKat1Colors sorts by 2025 volume and assigns palette', () => {
  const kat1Summary = [
    { k1: 'Small', tot25: 100 },
    { k1: 'Big',   tot25: 1000 },
    { k1: 'Mid',   tot25: 500 },
  ];
  const colors = computeKat1Colors(kat1Summary, {});
  assert.equal(colors['Big'], PALETTE[0]);
  assert.equal(colors['Mid'], PALETTE[1]);
  assert.equal(colors['Small'], PALETTE[2]);
});

test('computeKat1Colors respects overrides', () => {
  const kat1Summary = [
    { k1: 'Big', tot25: 1000 },
    { k1: 'Mid', tot25: 500 },
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
