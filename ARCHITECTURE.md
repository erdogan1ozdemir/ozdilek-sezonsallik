# Dashboard Architecture

Bu doküman Özdilekteyim (ve genel olarak seasonal-keyword-dashboard ailesi) dashboard'ının mimari yapısını, veri akışını ve kod prensiplerini özetler. Sonraki sezonsallık projelerinde aynı iskeleti kullanırken referans olması için hazırlanmıştır.

---

## 1. Genel Mimari

```
Excel (source.xlsx)          scripts/prep-*.js
       │                            │
       ▼                            ▼
  Raw keyword data    ────▶    data/source.xlsx  (brand-agnostic kanonik şema)
                                    │
                                    ▼
                          scripts/build-data.js
                                    │
                                    ▼
                         data/dashboard.js
                         (window.DATA, window.KAT1_COLORS, window.BRAND_ACCENT)
                                    │
                                    ▼
                    index.html ──▶ app.jsx ──▶ tabs.jsx ──▶ components.jsx
```

**Üç ayrı katman:**
1. **Preprocessing** (prep-*.js) — markaya özel Excel'den kanonik şemaya dönüştürme. Split (in/out), brand aggregate, pivot generation burada.
2. **Build** (build-data.js) — kanonik Excel'i DATA objesine dönüştüren static Node script. Çalışma zamanında koşmaz; build-time'da dashboard.js'i üretir.
3. **Runtime** (app.jsx / tabs.jsx / components.jsx) — tarayıcıda çalışan React UI. In-browser Babel ile JSX compile edilir (production için precompile önerilir).

---

## 2. Dosya Dağılımı

| Dosya | Görev |
|-------|-------|
| `index.html` | Shell: React/ReactDOM/Babel + utils.js + components.jsx + tabs.jsx + app.jsx yükler |
| `brand.config.js` | `window.BRAND` — marka adı, slug, subtitle, accent renk, agency bilgisi |
| `data/source.xlsx` | **Kanonik şema** — 13 sheet (Sezonsallık, Özet Dashboard, Kat N Sez., ...) |
| `data/dashboard.js` | Build çıktısı: `window.DATA = {...}`, `window.KAT1_COLORS`, `window.BRAND_ACCENT` |
| `scripts/prep-*.js` | Marka-spesifik Excel → kanonik şema. Özdilekteyim için in/out split + brand aggregate yapar. |
| `scripts/build-data.js` | Kanonik Excel → DATA objesi. 11 sheet parser + optional (outKeywords, brands). |
| `utils.js` | `fmtNum`, `fmtFull`, `fmtPct`, `aggregateMonthly`, `TR_MONTHS`, `trendClass`, `toCSV`, vs. |
| `components.jsx` | Shared bileşenler: `Kpi`, `YoYPill`, `Sparkline`, `Heatmap`, `ShareBars`, `LineChart`, `MultiSelect`, `SectionHeader`, `Modal`, `InfoIcon`, vs. |
| `tabs.jsx` | 7 tab componenti: OzetTab, KategorilerTab, KeywordTab, TrendlerTab, FiyatTab, OutOfCatalogTab, BrandTab + `applyGlobalFilter` / `recentTrendArrow` helpers |
| `app.jsx` | Root component: tab yönetimi, global filter state, URL hash sync, tweaks, keyword modal |
| `styles.css` | Dashboard'ın tüm stili (Bricolage Grotesque + dark mode + responsive) |
| `server.js` | Express static server (Railway deploy için) |

---

## 3. DATA Objesi Şeması

`window.DATA` build-data.js tarafından üretilir, tüm tab'ların ortak veri kaynağıdır.

```js
window.DATA = {
  // Aylar (string labels)
  months2024: ['2024-01', ..., '2024-12'],
  months2025: ['2025-01', ..., '2025-12'],

  // Ana keyword evreni — en ayrıntılı veri seviyesi
  keywords: [{
    k1, k2, k3,              // kategori hiyerarşisi (Kat 1/2/3)
    brand,                   // opsiyonel — marka adı (varsa)
    catalog,                 // opsiyonel — 'Var' / 'Yok' / '' (Özdilek'e özel)
    kw,                      // keyword string
    a24, a25,                // aylık ortalama arama hacmi (2024, 2025)
    yoy,                     // YoY change oran (0.15 = +%15)
    pq: [q1,q2,q3,q4],       // peak quarter flag'leri (0/1)
    peakSerial,              // peak ayın Excel serial numarası
    m24, m25,                // 12-aylık array'ler
    bucket                   // hacim bandı ('0-1.000', '1.000-2.000', ...)
  }, ...],

  // Kat 1 özet (OzetTab için önceden agregate)
  kat1Summary: [{k1, kwCount, tot24, tot25, yoy, share, peakQ, top3, topGain, topLoss}, ...],

  // Aylık aggregate (Kat 1/2/3 seviyesinde)
  kat1Monthly / kat2Monthly / kat3Monthly: [{
    labels: [k1, k2?, k3?], a24, a25, yoy, pq, m25
  }, ...],

  // Analizler (TrendlerTab için)
  trendRows: [{k1, k2, k3, kw, a24, a25, yoy, trend:'YÜKSELEN'/'DÜŞEN'}, ...],
  sezType: [{k1, k2, kw, a25, cv, type:'Evergreen'/..., peakMonth, dipMonth, pdRatio}, ...],
  peakQ: [{k1, k2, count, vol, q1, q2, q3, q4, dominant}, ...],
  smart: [{k1, k2, kw, a24, a25, yoy, peakMonth, tag:'Yıldız'/...}, ...],
  price: [{k1, k2, kw, a24, a25, yoy, peakMonth}, ...],
  volQ, volQKws, ...,

  // Brand-specific (opsiyonel, Özdilekteyim için eklendi)
  outKeywords: [...],        // Özdilek dışı markalara ait keyword'ler (Yok flag'li)
  brands: [{brand, catalog, sum24, sum25, yoy, pq, peakSerial, m25}, ...]
};
```

`window.KAT1_COLORS` ve `window.BRAND_ACCENT` — build-data.js'in ürettiği renk paleti (Tableau 10 colorblind-friendly, 2025 hacmine göre sırayla atanır).

---

## 4. Global Filter (Kritik)

Filter state **app.jsx'te** tutulur ve `globalFilter` prop'u olarak tab'lara geçer.

```js
// app.jsx
const [globalK1, setGlobalK1] = useState([]);       // string[] — seçili Kat 1'ler
const [globalK2, setGlobalK2] = useState([]);
const [globalK3, setGlobalK3] = useState([]);
const [globalBrand, setGlobalBrand] = useState([]);
const [globalPeakMonth, setGlobalPeakMonth] = useState([]);  // ['Oca', 'Şub', ...]
const [globalPeakQuarter, setGlobalPeakQuarter] = useState([]);  // ['Q1 (Oca-Mar)', ...]
const [globalSezType, setGlobalSezType] = useState([]);      // ['Evergreen', ...]
const [globalBucket, setGlobalBucket] = useState([]);        // ['0-1.000', ...]
const [globalTrend, setGlobalTrend] = useState('');          // 'rising' | 'falling' | 'stable' | ''
const hasGlobalFilter = globalK1.length || ... || globalTrend;

const globalFilter = { ...all above, ...all setters..., hasGlobalFilter };
```

**Kullanım (tab içinde):**
```js
function SomeTab({globalFilter}) {
  const filtered = useMemo(() =>
    applyGlobalFilter(D.keywords, globalFilter, sezTypeMap)
  , [globalFilter, sezTypeMap]);
  // ...
}
```

### `applyGlobalFilter` helper (tabs.jsx)

Tüm tab'ların ortak filtreleme noktasıdır. `sezTypeMap` opsiyonel — Mevsim Tipi filtresi için gerekir.

```js
function applyGlobalFilter(keywords, globalFilter, sezTypeMap) {
  // Build sets from globalFilter.globalK1/K2/K3/Brand/PeakMonth/PeakQuarter/SezType/Bucket
  // Filter keywords by: k1/k2/k3/brand/bucket/trend/peak month/peak quarter/sez type
  return filtered;
}
```

**Prensipler:**
- Set'ler memo callback'i **içinde** yaratılır, dep array'de **raw array'ler** (`globalK1`, `globalBrand` vs) kullanılır. Aksi halde fresh Set ref her render'da yeni referans üretir ve memoization çalışmaz.
- Tab-level filter bar yok — sadece global filter. Keyword arama (tek input) ve sort (tablo başlıklarına tıklama) tab-level kalmıştır.

### URL hash sync

`writeHashState({ tab, k1, k2, k3, brand })` ile paylaşılabilir link üretilir. Secondary filtreler şu an hash'e yazılmaz (istenirse kolayca eklenir).

---

## 5. Tab Component Paterni

Her tab aynı kontratı uygular:

```js
function SomeTab({setKeywordModal, onNavigateKw, onNavigateCat, globalFilter}) {
  // 1. Scope the data via applyGlobalFilter
  const scoped = useMemo(() =>
    applyGlobalFilter(D.keywords, globalFilter, sezTypeMap)
  , [globalFilter, sezTypeMap]);

  // 2. Tab-level UI state (search, sort, pagination, expand)
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({k:'a25', d:-1});
  const [page, setPage] = useState(0);

  // 3. Derive filtered + sorted rows
  const filtered = useMemo(() => {
    let rows = scoped;
    if (q) rows = rows.filter(...);
    return [...rows].sort(...);
  }, [scoped, q, sort]);

  // 4. Reset page on scope/filter change
  useEffect(() => setPage(0), [q, scoped]);

  // 5. Render SectionHeader → KPIs → Charts → Tables (in that order)
  return h('div', null, ...);
}
```

### Shared UI primitives

- **SectionHeader**: başlık + ikon + description. Her tab'ın başında.
- **Kpi**: `label / value / chip / sub / accent`. `grid-kpi kpi-5` layout ile 5'li strip.
- **LineChart**: ResizeObserver ile responsive. `series`, `legend`, `height`, `peakIdx`.
- **Sparkline**: satır-içi mini çizgi. `values, w, h`.
- **ShareBars**: kategori dağılımı bar'ları. Opsiyonel `onClickRow` + `activeLabels` ile filtre-toggle.
- **Heatmap**: satır-normalize 12-ay heatmap. `rows: [{label, values, prevValues, peakIdx}]`.
- **MultiSelect**: çok-seçim dropdown. `label, options, selected, onChange, searchable`. "Hepsi" / "Hiçbiri" action butonları ve search bar.
- **YoYPill**: `↑ +12%` / `↓ -8%` renkli pill.

---

## 6. Insight Paternleri

### 6.1 Brand × Kategori Matrix (BrandTab, OzetTab, OutOfCatalogTab)

Top N markanın Kat 1 dağılımını göstern satır-normalize heatmap. Her hücrenin rengi o markanın kendi içinde en yüksek kategoriye göre normalize edilir. Koyu hücre = markanın lider kategorisi.

- CSS grid (`grid-template-columns: minmax(140, 180) repeat(N, 1fr) minmax(70, 90)`)
- İlk sütun `position: sticky; left: 0` ile yatay scroll'da sabit kalır
- Renk: `color-mix(in srgb, var(--kat1-color) N%, var(--bg-card))` — dark mode uyumlu
- Intensity > 0.55 → beyaz text, aksi halde ink-2

### 6.2 Pivot Expand-on-Click (Brand + OutOfCatalog tabloları)

Bir satıra tıklandığında **aşağıya** alt-tablo açılır (scroll yerine inline pivot). Her brand için Kat 2 kırılımı + top 3 keyword chip'i.

```js
const [expanded, setExpanded] = useState(new Set());
// ...
rows.flatMap((r, i) => {
  const isOpen = expanded.has(r.brand);
  const mainRow = h('tr', {onClick: () => toggle(r.brand)}, ...);
  if (!isOpen) return [mainRow];
  const subRow = h('tr', {key:'s'+i}, h('td', {colSpan:N, style:{background:'var(--line-soft)'}},
    /* alt tablo */
  ));
  return [mainRow, subRow];
})
```

### 6.3 Yıldız / Eriyen Stripe (OutOfCatalog)

Min hacim + min YoY threshold ile outlier markaları yan yana kartlarda gösterir. `.grid-2` class (mobile'da tek sütuna döner). Her kart bir `Sparkline` + YoY pill + kategori chip içerir.

### 6.4 Recent Trend Arrow

Yıllık YoY'a ek olarak son 3 ay momentum'u gösteren ok (↗ / → / ↘). `recentTrendArrow(m25)` helper son 3 ay sum / önceki 3 ay sum oranını hesaplar.

### 6.5 Cross-Tab Navigation

`onNavigateKw(ctx)` prop'u ile OutOfCatalog / Brand tab'ından Keyword tab'ına zıplama. Global brand filtresi set edilir ve Keyword tab'ı açılır.

---

## 7. Yeni Bir Marka için Dashboard Kurmak

```bash
# 1. Template'i klonla
git clone https://github.com/erdogan1ozdemir/seasonal-keyword-dashboard acme-dashboard
cd acme-dashboard && rm -rf .git && git init

# 2. Prep script (marka Excel şeması standartsa buna gerek yok; sadece source.xlsx'i yerleştir)
cp /path/to/brand-keywords.xlsx data/source.xlsx

# 3. Marka bilgisini ayarla
# brand.config.js düzenle:
#   name, title, subtitle, slug, accent, agency

# 4. Logo
cp /path/to/brand-logo.svg assets/brand-logo.svg
# SVG'de beyaz arka plan <rect> varsa sil (filter:brightness(0) invert(1) header'da çalışsın)

# 5. Build
npm install
npm run build

# 6. Test
npm start  # http://localhost:3000
```

### Marka-spesifik özellik eklemek (Özdilekteyim örneği)

Özdilekteyim'de Excel'de `Marka` ve `Özdilekte Olan Markalar` (Var/Yok) kolonları vardı — bu marka-özel bilgi. `scripts/prep-ozdilekteyim.js` yazıldı:

1. **loadRawKeywords** — Marka + catalog kolonlarını okur
2. **loadBrands** — Brand Pivot Tablo sheet'inden aggregate brand verisi çıkarır
3. **main** — keyword'leri Yok flag'ine göre `kwsIn` (9384) ve `kwsOut` (1722) ikiye böler, iki ayrı Sezonsallık sheet'i + bir Brands sheet üretir
4. **build-data.js** — yeni sheet'leri parse edip `DATA.outKeywords` ve `DATA.brands` olarak bağlar
5. **tabs.jsx** — iki yeni tab (OutOfCatalogTab, BrandTab) ekler

Benzer bir genişletme her marka için yapılabilir (brand catalog info yoksa bu tab'lar gizlenir — `DATA.outKeywords?.length` kontrolü).

---

## 8. Performance Notları

- ~10K keyword ölçeğinde filtre memo'ları her render'da çalışır. Büyük datasetler için `filteredKws` gibi memo'ları set-inside-callback patterni ile koruyun.
- LineChart `ResizeObserver` ile container genişliğini ölçer. Container'ı olmayan parent'a koymayın.
- Matrix'te 15 marka × 9 kat = 135 hücre × 2 render. Daha büyükse top N limit'i azaltın.
- Preview tool'un headless browser'ı screenshot'larda zaman zaman 30s timeout verir — DOM evaluation (`preview_eval`) ile doğrulama yapın.

---

## 9. Formatting Konvansiyonları

| Durum | Format | Kullanım |
|-------|--------|----------|
| Tablo hücresinde hacim | `fmtNum` (1,2K / 3,4M) | compact, hover'da `title={fmtFull(v)}` |
| KPI büyük sayı | `fmtNum` | compact okunabilirlik |
| Tooltip / export CSV | `fmtFull` (1.234.567) | tam değer |
| YoY, peak, share % | `fmtPct` | `+12,5%` / `-8,0%` |
| Peak Ay | `TR_MONTHS_LONG[idx]` (Ocak) veya `TR_MONTHS[idx]` (Oca) | uzun / kısa |

**Tutarlılık:** ShareBars, Kpi, tüm tablolar fmtNum kullanır. fmtFull sadece tooltip ve CSV export'ta.

---

## 10. Prensipler Özeti

1. **Single source of truth**: Filter state app.jsx'te, `globalFilter` prop olarak dağıtılır
2. **Helper over duplication**: `applyGlobalFilter`, `recentTrendArrow` gibi helper'lar tekrar edilen filtreleme/hesap işlerini toplar
3. **Stable memo deps**: Set'ler memo içinde yaratılır, dep array'de raw array'ler bulunur
4. **Progressive disclosure**: Ana görünüm özet, pivot expand ile detay. Cross-tab nav ile ilgili data'ya sıçrama.
5. **Compact-by-default numbers**: fmtNum ana görünümde, fmtFull tooltip'te
6. **Filter layout**: Hepsi/Hiçbiri + search bar + MultiSelect patterni tutarlı, secondary filtreler ikinci satırda
7. **Brand-agnostic core**: Marka-spesifik logic prep-*.js'e taşınır, template'e dokunmadan genişletilir
8. **Dark mode**: `color-mix(... var(--bg-card))` kullanımı ile otomatik uyum

---

_Bu doküman Özdilekteyim dashboard'unun `76ab3ef` sonrası durumu temel alır. Yeni insight ekleyen her PR bu dosyayı günceller._
