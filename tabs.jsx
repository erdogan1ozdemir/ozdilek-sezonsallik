// Tab implementations
window.TABS = (function(){
  const B = window.BRAND || {};
  const BRAND_NAME = B.name || 'Dashboard';
  const BRAND_SLUG = (B.slug || 'dashboard').replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'dashboard';
  const { fmtNum, fmtFull, fmtPct, TR_MONTHS, TR_MONTHS_LONG, serialToMonthIdx, aggregateMonthly, trendClass, toCSV, downloadCSV } = U;
  const { Kpi, YoYPill, Sparkline, Heatmap, ShareBars, QStack, Modal, LineChart, BarChart, Donut, InfoIcon, Explainer, SectionHeader, SmallMultiples, PolarPeak, EmptyState, Skeleton, ChartActions, BumpChart, StreamGraph, Zoomable, CopyButton } = C;
  const h = React.createElement;
  const D = window.DATA;

  // ===== Shared helper: apply global filter to a keyword list =====
  // All tabs use this to respect the top Kategori & Marka Filtresi consistently.
  // gf = globalFilter prop; optional sezTypeMap (kw+k1 → type) for Mevsim Tipi filter.
  function applyGlobalFilter(keywords, gf, sezTypeMap) {
    if (!gf) return keywords;
    const k1S = (gf.globalK1 || []).length ? new Set(gf.globalK1) : null;
    const k2S = (gf.globalK2 || []).length ? new Set(gf.globalK2) : null;
    const k3S = (gf.globalK3 || []).length ? new Set(gf.globalK3) : null;
    const brS = (gf.globalBrand || []).length ? new Set(gf.globalBrand) : null;
    const catF = gf.globalCatalog || '';  // '' | 'Var' | 'Yok'
    const mS = (gf.globalPeakMonth || []).length ? new Set(gf.globalPeakMonth) : null;
    const qS = (gf.globalPeakQuarter || []).length ? new Set(gf.globalPeakQuarter) : null;
    const stS = (gf.globalSezType || []).length ? new Set(gf.globalSezType) : null;
    const bkS = (gf.globalBucket || []).length ? new Set(gf.globalBucket) : null;
    const tr = gf.globalTrend || '';
    if (!k1S && !k2S && !k3S && !brS && !catF && !mS && !qS && !stS && !bkS && !tr) return keywords;
    const TR_MO_SHORT = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
    return keywords.filter(k => {
      if (k1S && !k1S.has(k.k1)) return false;
      if (k2S && !k2S.has(k.k2)) return false;
      if (k3S && !k3S.has(k.k3)) return false;
      if (brS && !brS.has(k.brand)) return false;
      if (catF && k.catalog !== catF) return false;
      if (bkS && !bkS.has(k.bucket)) return false;
      if (tr === 'rising' && !(k.yoy > 0.05)) return false;
      if (tr === 'falling' && !(k.yoy < -0.05)) return false;
      if (tr === 'stable' && !(k.yoy >= -0.05 && k.yoy <= 0.05)) return false;
      if (mS || qS) {
        if (!k.m25) return false;
        const pi = k.m25.indexOf(Math.max(...k.m25));
        if (mS && !mS.has(TR_MO_SHORT[pi])) return false;
        if (qS) {
          const qIdx = Math.floor(pi / 3);
          const qLabel = ['Q1 (Oca-Mar)','Q2 (Nis-Haz)','Q3 (Tem-Eyl)','Q4 (Eki-Ara)'][qIdx];
          if (!qS.has(qLabel)) return false;
        }
      }
      if (stS && sezTypeMap) {
        const t = sezTypeMap.get(k.kw + '|' + k.k1);
        if (!stS.has(t)) return false;
      }
      return true;
    });
  }
  // Returns a trend arrow character + color based on last-3-month slope vs avg.
  // Used to complement YoY (which is annual) with a recent momentum indicator.
  function recentTrendArrow(m25) {
    if (!m25 || m25.length < 3) return null;
    const avg = m25.reduce((s,v)=>s+v,0) / m25.length;
    if (avg <= 0) return null;
    const last3 = m25.slice(-3);
    const prev3 = m25.slice(-6, -3);
    const sumLast = last3.reduce((s,v)=>s+v,0);
    const sumPrev = prev3.reduce((s,v)=>s+v,0) || 1;
    const mom = (sumLast - sumPrev) / sumPrev;
    if (mom > 0.1) return { char: '↗', color: 'var(--green, #059669)', title: `Son 3 ay momentum: +${(mom*100).toFixed(0)}%` };
    if (mom < -0.1) return { char: '↘', color: 'var(--red, #DC2626)', title: `Son 3 ay momentum: ${(mom*100).toFixed(0)}%` };
    return { char: '→', color: 'var(--ink-3)', title: `Son 3 ay momentum: ${(mom*100).toFixed(0)}%` };
  }

  // Monthly average from an annual-sum value. Brand aggregates store yearly sums;
  // UI prefers monthly avg for comparability with keyword a24/a25.
  const toMonthlyAvg = v => (v || 0) / 12;

  // Smooth scroll into view — used by cross-tab nav + click-to-filter interactions.
  function smoothScrollTo(el, opts) {
    if (!el) return;
    try {
      el.scrollIntoView({behavior:'smooth', block:'start', ...(opts||{})});
    } catch { el.scrollIntoView(opts || {block:'start'}); }
  }

  window.TABS_HELPERS = { applyGlobalFilter, recentTrendArrow, toMonthlyAvg, smoothScrollTo };

  // ===== Icon helpers (emoji'ler yerine) - stroke SVG, currentColor ile renklenir =====
  const Svg = (size, children) => h('svg', {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': true
  }, children);
  const I = {
    Book: (s=20) => Svg(s, [
      h('path',{key:1,d:'M4 4.5A1.5 1.5 0 0 1 5.5 3H18v18H5.5A1.5 1.5 0 0 1 4 19.5v-15z'}),
      h('path',{key:2,d:'M4 18h14'}),
      h('path',{key:3,d:'M8 7h6M8 10h6M8 13h4'})
    ]),
    Search: (s=14) => Svg(s, [
      h('circle',{key:1, cx:11, cy:11, r:7}),
      h('path',{key:2, d:'M20 20l-3.5-3.5'})
    ]),
    TrendUp: (s=14) => Svg(s, [
      h('path',{key:1, d:'M3 17l6-6 4 4 7-7'}),
      h('path',{key:2, d:'M14 8h6v6'})
    ]),
    Calendar: (s=14) => Svg(s, [
      h('rect',{key:1, x:3, y:4, width:18, height:17, rx:2}),
      h('path',{key:2, d:'M3 9h18M8 3v4M16 3v4'})
    ]),
    Target: (s=14) => Svg(s, [
      h('circle',{key:1, cx:12, cy:12, r:9}),
      h('circle',{key:2, cx:12, cy:12, r:5}),
      h('circle',{key:3, cx:12, cy:12, r:1.5, fill:'currentColor'})
    ]),
    Bulb: (s=14) => Svg(s, [
      h('path',{key:1, d:'M9 18h6'}),
      h('path',{key:2, d:'M10 22h4'}),
      h('path',{key:3, d:'M12 2a7 7 0 0 0-4 12.7c.7.6 1 1.4 1 2.3v1h6v-1c0-.9.3-1.7 1-2.3A7 7 0 0 0 12 2z'})
    ]),
    Spark: (s=14) => Svg(s, [
      h('path',{key:1, d:'M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M5 19l4-4M15 9l4-4'})
    ]),
    ArrowRight: (s=14) => Svg(s, [
      h('path',{key:1, d:'M5 12h14M13 5l7 7-7 7'})
    ])
  };
  window.ICONS = I;

  // KAT1_COLORS is populated by data/dashboard.js (generated by scripts/build-data.js).
  // It's already attached to window by the time this file runs.
  const KAT1_COLORS = window.KAT1_COLORS || {};
  const katColor = k => KAT1_COLORS[k] || '#8A8A8A';

  // Globals
  const TOTAL_KW = D.keywords.length;
  const TOTAL_2025 = D.keywords.reduce((a,k)=>a+(k.a25||0),0) * 12;
  const TOTAL_2024 = D.keywords.reduce((a,k)=>a+(k.a24||0),0) * 12;
  const TOTAL_YOY = (TOTAL_2025 - TOTAL_2024) / TOTAL_2024;
  const MONTHLY_TOTAL = aggregateMonthly(D.keywords, 'm25');
  const MONTHLY_TOTAL_24 = aggregateMonthly(D.keywords, 'm24');
  const RISING = D.trendRows.filter(r=>r.trend==='YÜKSELEN');
  const FALLING = D.trendRows.filter(r=>r.trend==='DÜŞEN' || r.trend==='AZALAN');
  const PRICE_TOTAL = D.price.reduce((a,k)=>a+(k.a25||0),0) * 12;
  const PRICE_TOTAL_24 = D.price.reduce((a,k)=>a+(k.a24||0),0) * 12;
  const PRICE_YOY = (PRICE_TOTAL - PRICE_TOTAL_24) / (PRICE_TOTAL_24||1);
  const PEAK_MONTH_IDX = MONTHLY_TOTAL.indexOf(Math.max(...MONTHLY_TOTAL));

  function kat2InK1(k1) { return [...new Set(D.keywords.filter(k => !k1 || k.k1===k1).map(k => k.k2))].sort(); }
  function kat3InK1K2(k1, k2) { return [...new Set(D.keywords.filter(k => (!k1||k.k1===k1) && (!k2||k.k2===k2)).map(k => k.k3))].sort(); }

  // Build 2024 monthly array (12) by aggregating matching keywords
  function m24ForLabels(level, labels) {
    const items = D.keywords.filter(k => {
      if (k.k1 !== labels[0]) return false;
      if (level !== 'kat1' && k.k2 !== labels[1]) return false;
      if (level === 'kat3' && k.k3 !== labels[2]) return false;
      return true;
    });
    const out = new Array(12).fill(0);
    for (const k of items) {
      if (!k.m24) continue;
      for (let i=0; i<12; i++) out[i] += (k.m24[i] || 0);
    }
    return out;
  }

  function cv(values) {
    const mean = values.reduce((a,b)=>a+b,0)/values.length;
    if (!mean) return 0;
    const variance = values.reduce((a,b)=>a+(b-mean)**2,0)/values.length;
    return Math.sqrt(variance)/mean;
  }

  // Build list of categories at a level for YoY/peak aggregation
  function categoriesAt(level) {
    if (level === 'kat1') return D.kat1Monthly.map(r => ({key:r.labels[0], label:r.labels[0], k1:r.labels[0], row:r}));
    if (level === 'kat2') return D.kat2Monthly.map(r => ({key:r.labels.join('>'), label:r.labels[1], k1:r.labels[0], k2:r.labels[1], sub:r.labels[0], row:r}));
    return D.kat3Monthly.map(r => ({key:r.labels.join('>'), label:r.labels[2], k1:r.labels[0], k2:r.labels[1], k3:r.labels[2], sub:r.labels.slice(0,2).join(' > '), row:r}));
  }

  // === Özet Tab ===
  function OzetTab({setKeywordModal, onNavigateCat, onNavigateKw, globalFilter}) {
    const [heatLevel, setHeatLevel] = React.useState('kat1');
    const [heatFilter, setHeatFilter] = React.useState({k1:'', k2:''});
    const [heatSort, setHeatSort] = React.useState('vol');  // vol | yoyDesc | yoyAsc | alpha
    const [qLevel, setQLevel] = React.useState('kat1');
    const [qFilter, setQFilter] = React.useState({k1:'', k2:''});
    const [yoyLevel, setYoyLevel] = React.useState('kat1');
    const [yoyFilter, setYoyFilter] = React.useState({k1:'', k2:''});

    // Global filter from props (lifted to app.jsx - panel now sits under the tabs)
    const {globalK1, globalK2, globalK3, globalBrand = [], setGlobalK1, setGlobalK2, setGlobalK3, hasGlobalFilter} = globalFilter;

    // SezType map for applyGlobalFilter's Mevsim Tipi filter support
    const sezTypeMapForFilter = React.useMemo(() => {
      const m = new Map();
      for (const r of D.sezType || []) m.set(r.kw + '|' + r.k1, r.type);
      return m;
    }, []);

    // Apply global filter to keyword universe used by KPIs, donut, line, top10/gainers/losers
    const fKeywords = React.useMemo(() =>
      applyGlobalFilter(D.keywords, globalFilter, sezTypeMapForFilter)
    , [globalFilter, sezTypeMapForFilter]);

    // keep legacy set refs used elsewhere (below for f_PRICE scoping)
    const g_k1Set = globalK1.length ? new Set(globalK1) : null;
    const g_k2Set = globalK2.length ? new Set(globalK2) : null;
    const g_k3Set = globalK3.length ? new Set(globalK3) : null;

    const f_TOTAL_KW = fKeywords.length;
    const f_TOTAL_2025 = fKeywords.reduce((a,k)=>a+(k.a25||0),0) * 12;
    const f_TOTAL_2024 = fKeywords.reduce((a,k)=>a+(k.a24||0),0) * 12;
    const f_TOTAL_YOY = f_TOTAL_2024 ? (f_TOTAL_2025 - f_TOTAL_2024) / f_TOTAL_2024 : 0;
    const f_MONTHLY_25 = aggregateMonthly(fKeywords, 'm25');
    const f_MONTHLY_24 = aggregateMonthly(fKeywords, 'm24');
    const f_PEAK_IDX = f_MONTHLY_25.indexOf(Math.max(...f_MONTHLY_25));
    const f_PRICE = hasGlobalFilter ? D.price.filter(k => {
      if (g_k1Set && !g_k1Set.has(k.k1)) return false;
      if (g_k2Set && !g_k2Set.has(k.k2)) return false;
      if (g_k3Set && !g_k3Set.has(k.k3)) return false;
      return true;
    }) : D.price;
    const f_PRICE_TOTAL = f_PRICE.reduce((a,k)=>a+(k.a25||0),0) * 12;
    const f_PRICE_24 = f_PRICE.reduce((a,k)=>a+(k.a24||0),0) * 12;
    const f_PRICE_YOY = f_PRICE_24 ? (f_PRICE_TOTAL - f_PRICE_24) / f_PRICE_24 : 0;

    const risingCnt = fKeywords.filter(k=>k.yoy>0.05).length;
    const fallingCnt = fKeywords.filter(k=>k.yoy<-0.05).length;
    const top10 = [...fKeywords].sort((a,b)=>b.a25-a.a25).slice(0,10);

    const contributors = fKeywords.map(k => ({...k, delta: (k.a25 - k.a24) * 12})).filter(k => !isNaN(k.delta));
    const topGainers = [...contributors].sort((a,b) => b.delta - a.delta).slice(0, 10);
    const topLosers = [...contributors].sort((a,b) => a.delta - b.delta).slice(0, 10);

    // Donut data - global filter derinliğine göre drill-down:
    //   hiç filtre yok            → Kat 1 pay dağılımı
    //   sadece K1 seçili          → Kat 2 alt kırılımı (seçili K1'ler içinde)
    //   K2 seçili                 → Kat 3 alt kırılımı (seçili K2'ler içinde)
    //   K3 seçili                 → Kat 3 (sadece seçili K3 item'ları)
    const donutLevel = globalK2.length || (globalK3.length && !globalK1.length && !globalK2.length)
      ? 'kat3'
      : globalK1.length ? 'kat2' : 'kat1';
    const donutData = React.useMemo(() => {
      let items;
      if (donutLevel === 'kat1') {
        items = D.kat1Summary.map(k => ({
          label: k.k1, key: k.k1, parentK1: k.k1, value: k.tot25, sub: null
        }));
      } else if (donutLevel === 'kat2') {
        items = D.kat2Monthly
          .filter(r => !g_k1Set || g_k1Set.has(r.labels[0]))
          .map(r => ({
            label: r.labels[1],
            key: r.labels[0] + '>' + r.labels[1],
            parentK1: r.labels[0],
            value: (r.m25 || []).reduce((a,b)=>a+b, 0),
            sub: r.labels[0]
          }));
      } else {
        items = D.kat3Monthly
          .filter(r => {
            if (g_k1Set && !g_k1Set.has(r.labels[0])) return false;
            if (g_k2Set && !g_k2Set.has(r.labels[1])) return false;
            if (g_k3Set && !g_k3Set.has(r.labels[2])) return false;
            return true;
          })
          .map(r => ({
            label: r.labels[2],
            key: r.labels.join('>'),
            parentK1: r.labels[0],
            value: (r.m25 || []).reduce((a,b)=>a+b, 0),
            sub: r.labels.slice(0, 2).join(' > ')
          }));
      }
      return items.filter(x => x.value > 0).sort((a, b) => b.value - a.value);
    }, [donutLevel, globalK1, globalK2, globalK3]);
    const donutTotal = donutData.reduce((a,k)=>a+k.value, 0);

    // YoY bars (level selector)
    const yoyData = React.useMemo(() => {
      let cats = categoriesAt(yoyLevel);
      if (yoyLevel !== 'kat1' && yoyFilter.k1) cats = cats.filter(c => c.k1 === yoyFilter.k1);
      if (yoyLevel === 'kat3' && yoyFilter.k2) cats = cats.filter(c => c.k2 === yoyFilter.k2);
      return cats.map(c => ({
        label: c.label, value: c.row.yoy || 0,
        color: katColor(c.k1),
        ctx: c
      })).sort((a,b) => b.value - a.value).slice(0, 15);
    }, [yoyLevel, yoyFilter]);

    // Quarterly distribution rows (level selector)
    const qData = React.useMemo(() => {
      let cats = categoriesAt(qLevel);
      if (qLevel !== 'kat1' && qFilter.k1) cats = cats.filter(c => c.k1 === qFilter.k1);
      if (qLevel === 'kat3' && qFilter.k2) cats = cats.filter(c => c.k2 === qFilter.k2);
      return cats.map(c => {
        const m = c.row.m25;
        const q1 = m[0]+m[1]+m[2], q2 = m[3]+m[4]+m[5], q3 = m[6]+m[7]+m[8], q4 = m[9]+m[10]+m[11];
        const tot = q1+q2+q3+q4;
        const qs = [q1,q2,q3,q4];
        const peakQ = qs.indexOf(Math.max(...qs)) + 1;
        return { label: c.label, sub: c.sub, q1, q2, q3, q4, tot, peakQ, ctx: c };
      }).sort((a,b)=>b.tot-a.tot);
    }, [qLevel, qFilter]);

    // Heatmap rows
    const heatRows = React.useMemo(() => {
      let rows;
      if (heatLevel === 'kat1') rows = D.kat1Monthly;
      else if (heatLevel === 'kat2') rows = D.kat2Monthly.filter(r => !heatFilter.k1 || r.labels[0] === heatFilter.k1);
      else rows = D.kat3Monthly.filter(r => (!heatFilter.k1 || r.labels[0] === heatFilter.k1) && (!heatFilter.k2 || r.labels[1] === heatFilter.k2));
      rows = [...rows];
      if (heatSort === 'vol') rows.sort((a,b) => (b.m25||[]).reduce((s,x)=>s+x,0) - (a.m25||[]).reduce((s,x)=>s+x,0));
      else if (heatSort === 'yoyDesc') rows.sort((a,b) => (b.yoy||0) - (a.yoy||0));
      else if (heatSort === 'yoyAsc') rows.sort((a,b) => (a.yoy||0) - (b.yoy||0));
      else if (heatSort === 'alpha') rows.sort((a,b) => (a.labels[a.labels.length-1]||'').localeCompare(b.labels[b.labels.length-1]||'', 'tr'));
      return rows.map(r => {
        const peakIdx = r.m25.indexOf(Math.max(...r.m25));
        return {
          label: heatLevel==='kat1' ? r.labels[0] : r.labels.slice(-1)[0],
          sub: heatLevel==='kat1' ? null : r.labels.slice(0,-1).join(' > '),
          values: r.m25, prevValues: r.m24 || m24ForLabels(heatLevel, r.labels), peakIdx,
          ctx: {k1:r.labels[0], k2:r.labels[1], k3:r.labels[2]}
        };
      });
    }, [heatLevel, heatFilter, heatSort]);

    return h('div',null,
      // Report explainer at top
      h(Explainer,{
        icon: I.Book(22),
        title:'Bu rapor ne anlatıyor?',
        sub:'Arama hacmi, sezonsallık, YoY nedir, neye bakmalıyız?',
        defaultOpen:false
      },
        h('p',null,
          'Bu panel, ', h('strong',null,`${BRAND_NAME} kategorilerinde Google'da aranan kelimeleri`),
          ' analiz eder. 2024 ve 2025 verilerini karşılaştırarak, hangi ürün ve kategorilere ilgi arttığını, hangilerinin düştüğünü ve yıl içinde hangi aylarda ne çok arandığını gösterir.'
        ),
        h('div',{className:'explainer-grid'},
          h('div',null,
            h('h4',{className:'h4-icon'}, h('span',{className:'h4i'}, I.Search(16)), 'Arama Hacmi Nedir?'),
            h('p',null,
              'Bir kelimenin ayda kaç kere Google\'da arandığı. Örneğin bir anahtar kelime için ', h('strong',null,'8.100 / ay'),
              ' demek, her ay yaklaşık ', h('strong',null,'8.100 farklı arama'),
              ' bu konuda yapılıyor demektir. Bu sayı büyüdükçe ilgi & potansiyel müşteri havuzu büyür.'
            ),
            h('h4',{className:'h4-icon'}, h('span',{className:'h4i'}, I.TrendUp(16)), 'YoY (Year over Year) Nedir?'),
            h('p',null,
              'Bu yıl ile geçen yıl arasındaki büyüme / düşüş oranı. ', h('strong',null,'+45%'),
              ' = geçen yıla göre %45 arttı. ', h('strong',null,'-20%'), ' = %20 düştü.',
              ' Yükselen trendler içerik yatırımı için fırsat oluşturabilir; düşenler için rakip analizi veya önceliği azaltma değerlendirilebilir.'
            )
          ),
          h('div',null,
            h('h4',{className:'h4-icon'}, h('span',{className:'h4i'}, I.Calendar(16)), 'Sezon Takvimi (Heatmap)'),
            h('p',null,
              'Her satır bir kategori, her sütun bir ay. ', h('span',{style:{color:'#e67c73',fontWeight:600}},'Kırmızı'),
              ' = düşük arama, ', h('span',{style:{color:'#fbbc04',fontWeight:600}},'sarı'), ' = orta, ',
              h('span',{style:{color:'#57bb8a',fontWeight:600}},'yeşil'), ' = peak (o satırın en yüksek ayı). Pazarlama ve SEO takvimi için bu ritım referans alınabilir.'
            ),
            h('h4',{className:'h4-icon'}, h('span',{className:'h4i'}, I.Target(16)), 'Nasıl Kullanılır?'),
            h('ul',null,
              h('li',null, h('strong',null,'Özet'),': kuşbakışı trend & kazanan/kaybeden ürünler.'),
              h('li',null, h('strong',null,'Kategoriler'),': Kat1 > Kat2 > Kat3 drill-down ile detay.'),
              h('li',null, h('strong',null,'Keyword'),': 2.400+ kelimeyi filtrele, ara, sırala.'),
              h('li',null, h('strong',null,'Trendler'),': en çok yükselen/düşen kelimeler, içerik önceliği.'),
              h('li',null, h('strong',null,'Fiyat Intent'),': "fiyat", "ne kadar" gibi satın alma niyetli aramalar.')
            )
          )
        ),
          h('p',{className:'tip-row', style:{marginTop:12,paddingTop:12,borderTop:'1px solid var(--line)',color:'var(--ink-3)',fontSize:12, display:'flex', alignItems:'flex-start', gap:8}},
          h('span',{className:'tip-icon'}, I.Bulb(14)),
          h('span',null, h('strong',null,'İpucu: '), 'Grafik başlıklarının yanındaki "?" ikonlarına mouse ile gelindiğinde o grafiğin ne anlattığı ve nasıl okunacağı görülebilir. Grafik çubuklarına / dilimlerine tıklandığında ilgili keyword listesine filtreli şekilde inilebilir.')
        )
      ),

      // KPIs (filter panel now lives in app.jsx, sticky under tabs)
      // SectionHeader: Pazar özeti
      h(SectionHeader, {
        accent:'coral',
        icon: h('svg',{width:22,height:22,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'},
          h('path',{d:'M3 3v18h18'}),
          h('path',{d:'M7 14l4-4 4 4 5-5'})
        ),
        title: hasGlobalFilter ? 'Seçili Pazar Dilimi' : 'Pazar Özeti',
        desc: hasGlobalFilter ? 'Aktif filtrelere göre ana metrikler, yıllık trend ve peak sezon.' : `${BRAND_NAME} kategorilerinin 2025 genel görünümü, yıllık karşılaştırma ve sezonsallık.`
      }),

      // Hero KPI: Toplam 2025
      h('div',{className:'hero-kpi'},
        h('div',{className:'hk-left'},
          h('div',{className:'hk-label'}, hasGlobalFilter ? 'Filtreli Toplam 2025 Arama' : 'Toplam 2025 Arama'),
          h('div',{className:'hk-value'}, fmtNum(f_TOTAL_2025)),
          h('div',{className:'hk-sub'},
            h('span',{className:'pill '+trendClass(f_TOTAL_YOY), style:{fontWeight:700}}, (f_TOTAL_YOY>=0?'↑ ':'↓ '), fmtPct(f_TOTAL_YOY)),
            h('span',{style:{color:'var(--ink-3)'}},'vs. 2024 · ', fmtFull(f_TOTAL_KW), ' KW')
          )
        ),
        h('div',{className:'hk-spark'},
          // Legend kartın subtitle bölgesinde zaten söyleniyor; chart konteynere
          // tam oturması için legend:false. Renk kodu 2024 gri / 2025 coral.
          h(LineChart,{
            series:[
              {name:'2024', values:f_MONTHLY_24, color:'color-mix(in srgb, var(--ink-3) 80%, transparent)'},
              {name:'2025', values:f_MONTHLY_25, color:'var(--coral)', peakIdx:f_PEAK_IDX}
            ], legend:false, height:140
          })
        ),
        h('div',{className:'hk-right'},
          h('div',{className:'hk-peak-label'}, 'Peak Ay'),
          h('div',{className:'hk-peak'}, TR_MONTHS_LONG[f_PEAK_IDX]),
          h('div',{style:{fontSize:11,color:'var(--ink-3)',marginTop:2}}, fmtFull(f_MONTHLY_25[f_PEAK_IDX]), ' arama')
        )
      ),

      // KPI mini strip
      h('div',{className:'kpi-strip'},
        h('div',{className:'kpi-mini'},
          h('div',{className:'km-label'},'Keyword'),
          h('div',{className:'km-value'}, fmtFull(f_TOTAL_KW)),
          h('div',{className:'km-sub'}, hasGlobalFilter ? `${globalK1.length + globalK2.length + globalK3.length} filtre` : `${D.kat1Summary.length} K1 · ${D.kat2Monthly.length} K2`),
          h(InfoIcon,{className:'kpi-info', title:'Keyword Sayısı'},
            h('strong',null,'Ne? '),'Filtrelenmiş keyword sayısı. 2024 VEYA 2025 hacmi > 0 olanlar sayılır.'
          )
        ),
        h('div',{className:'kpi-mini'},
          h('div',{className:'km-label'},'Yükselen'),
          h('div',{className:'km-value', style:{color:'var(--green)'}}, fmtFull(risingCnt)),
          h(InfoIcon,{className:'kpi-info', title:'Yükselen Keyword'},
            h('strong',null,'Ne? '),'2025 hacmi 2024\'e göre %5 veya daha fazla artan keyword sayısı.'
          )
        ),
        h('div',{className:'kpi-mini'},
          h('div',{className:'km-label'},'Düşen'),
          h('div',{className:'km-value', style:{color:'var(--red)'}}, fmtFull(fallingCnt)),
          h(InfoIcon,{className:'kpi-info', title:'Düşen Keyword'},
            h('strong',null,'Ne? '),'2025 hacmi 2024\'e göre %5 veya daha fazla düşen keyword sayısı.'
          )
        ),
        h('div',{className:'kpi-mini'},
          h('div',{className:'km-label'},'Peak Ay'),
          h('div',{className:'km-value'}, TR_MONTHS[f_PEAK_IDX]),
          h('div',{className:'km-sub'}, fmtFull(f_MONTHLY_25[f_PEAK_IDX]), ' arama'),
          h(InfoIcon,{className:'kpi-info', title:'Peak Ay'},
            h('strong',null,'Ne? '),'Seçili filtrede en yüksek toplam arama hacmine sahip ay. Global kategori filtresini değiştirdikçe bu değer seçilen kategorilere göre güncellenir.'
          )
        ),
        h('div',{className:'kpi-mini'},
          h('div',{className:'km-label'},'Fiyat Intent'),
          h('div',{className:'km-value'}, fmtNum(f_PRICE_TOTAL)),
          h('div',{className:'km-sub'}, h('span',{className:'pill '+trendClass(f_PRICE_YOY),style:{fontSize:10,padding:'1px 5px'}}, fmtPct(f_PRICE_YOY)), `${f_PRICE.length} KW`),
          h(InfoIcon,{className:'kpi-info', title:'Fiyat Intent'},
            h('strong',null,'Ne? '),'İçinde "fiyat/fiyatı/ucuz/kaç para" geçen keywordlerin toplam hacmi. Satın alma niyeti göstergesi.'
          )
        )
      ),

      h('div',{className:'insight-strip'},
        h('span',{className:'arrow'}, I.ArrowRight(14)),
        h('div',null,
          hasGlobalFilter ? `Seçili filtrede toplam arama 2024'e kıyasla ` : `2024'e kıyasla toplam arama `,
          h('strong',null, fmtPct(f_TOTAL_YOY)),
          `. Pazar `, (f_TOTAL_YOY<0?'erimekte':'büyümekte'), ` olarak görünüyor. `,
          h('strong',null, fmtFull(risingCnt)), ` keyword yükselişte - içerik yatırımı ve güncelleme fırsatı olarak değerlendirilebilir. Peak dönem: `,
          h('strong',null, TR_MONTHS_LONG[f_PEAK_IDX]), `.`
        )
      ),

      // === Aksiyon Kartları (B1) ===
      // Peak-based content timing + rising KW opportunity → concrete next steps
      (() => {
        const peakIdx = f_PEAK_IDX;
        // İçerik peak'ten 6 hafta önce canlıda olsun: ~1.5 ay öncesi
        const targetIdx = (peakIdx - 2 + 12) % 12;
        return h('div',{className:'action-strip'},
          h('div',{className:'action-card action-calendar'},
            h('div',{className:'action-icon'}, I.Calendar(20)),
            h('div',{className:'action-body'},
              h('div',{className:'action-title'}, 'Peak için içerik takvimi'),
              h('div',{className:'action-text'},
                'Peak ay ', h('strong',null, TR_MONTHS_LONG[peakIdx]),
                ' · ranking için ', h('strong',null, TR_MONTHS_LONG[targetIdx]),
                ' ortasına kadar içeriğin canlıda olması önerilir (4–6 hafta index süresi).'
              )
            )
          ),
          risingCnt > 0 && h('button',{
            className:'action-card action-opportunity',
            onClick: () => onNavigateKw({trend:'rising'})
          },
            h('div',{className:'action-icon'}, I.TrendUp(20)),
            h('div',{className:'action-body'},
              h('div',{className:'action-title'}, 'İçerik fırsatı'),
              h('div',{className:'action-text'},
                h('strong',null, fmtFull(risingCnt)),
                ' keyword YoY +%5 üzerinde. Yükselen listeyi keyword tab\'ında filtreli aç →'
              )
            )
          ),
          fallingCnt > 0 && h('button',{
            className:'action-card action-risk',
            onClick: () => onNavigateKw({trend:'falling'})
          },
            h('div',{className:'action-icon'}, I.Bulb(20)),
            h('div',{className:'action-body'},
              h('div',{className:'action-title'}, 'Risk taraması'),
              h('div',{className:'action-text'},
                h('strong',null, fmtFull(fallingCnt)),
                " keyword'de arama hacmi düşüş eğilimi gösteriyor. İlgili kelimeleri incele →"
              )
            )
          )
        );
      })(),

      // Trend + Donut row
      h(SectionHeader, {
        accent:'teal',
        icon: h('svg',{width:22,height:22,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'},
          h('circle',{cx:12,cy:12,r:9}),
          h('path',{d:'M12 7v5l3 2'})
        ),
        title:'Aylık Ritim & Kategori Dağılımı',
        desc:'12 aylık arama hacmi trendi ve pazar payının kategorilere dağılımı.'
      }),
      h('div',{className:'grid grid-main', style:{marginBottom:18, alignItems:'stretch'}},
        h('div',{className:'card', style:{display:'flex', flexDirection:'column', position:'relative'}},
          h('div',{className:'card-header'},
            h('h3',null,'12 Aylık Toplam Arama Hacmi',
              h(InfoIcon,null,
                h('strong',null,'Ne gösterir? '),'Seçili kategorilerdeki tüm keywordlerin ayda toplam kaç kere arandığı.',
                h('br'),h('br'),h('strong',null,'Nasıl okunur? '),'Gri çizgi 2024, coral çizgi 2025. İkisi arasındaki fark büyüme / erime göstergesidir. Kırmızı nokta peak ayı.',
                h('br'),h('br'),h('strong',null,'Ne için kullanılır? '),'Genel pazar ritmini ve yıllık karşılaştırmayı görmek için kullanılabilir. Peak aydan 4-6 hafta önce içeriğin hazır olması planlanabilir.'
              )
            ),
            h('div',{className:'hint'}, hasGlobalFilter ? `${globalK1.length} kat. · 2024 & 2025` : '2024 (gri) & 2025 (coral)'),
            h(Zoomable, {title:'12 Aylık Toplam Arama Hacmi', aspect:'wide'},
              h(LineChart,{
                series:[
                  {name:'2024', values:f_MONTHLY_24, color:'#8A8A8A'},
                  {name:'2025', values:f_MONTHLY_25, color:'#FF7B52', peakIdx:f_PEAK_IDX}
                ], legend:true, height:520
              })
            )
          ),
          h('div',{style:{flex:1, display:'flex', alignItems:'center', justifyContent:'center', minHeight:420, width:'100%'}},
            h('div',{style:{width:'100%'}},
              h(LineChart,{
                series:[
                  {name:'2024', values:f_MONTHLY_24, color:'#8A8A8A'},
                  {name:'2025', values:f_MONTHLY_25, color:'#FF7B52', peakIdx:f_PEAK_IDX}
                ], legend:true, height:400
              })
            )
          )
        ),
        h('div',{className:'card'},
          h('div',{className:'card-header'},
            h('h3',null,'Kategori Pazar Payı',
              h(InfoIcon,null,
                h('strong',null,'Ne gösterir? '),'Seçili kategoriler arasında toplam aramanın ne kadarını kim alıyor. Global filtre derinliğine göre otomatik drill-down: filtresiz Kat 1, Kat 1 seçildiğinde o Kat 1\'in Kat 2 alt kırılımı, Kat 2 seçildiğinde Kat 3 alt kırılımı.',
                h('br'),h('br'),h('strong',null,'Nasıl okunur? '),'Büyük dilim = çok aranan kategori. Aynı Kat 1 altındaki alt kategoriler aynı renkten türetilir. Dilime tıklayınca o seviyedeki filtre toggle olur.',
                h('br'),h('br'),h('strong',null,'Ne için kullanılır? '),'Pazar ağırlığı & yatırım önceliğine dair içgörü çıkarmak için kullanılabilir.'
              )
            ),
            h('div',{className:'hint'},
              donutLevel === 'kat1' ? '2025 · Kat 1 dağılımı · tıkla & filtrele'
              : donutLevel === 'kat2' ? `2025 · Kat 2 alt kırılımı · ${donutData.length} kategori`
              : `2025 · Kat 3 alt kırılımı · ${donutData.length} ürün`
            )
          ),
          h('div',{style:{display:'flex',alignItems:'center',justifyContent:'center',gap:12,marginBottom:12, flexWrap:'wrap'}},
            h(Donut,{
              size: donutLevel === 'kat1' ? 180 : 200,
              data: donutData.map((k, idx) => {
                const base = katColor(k.parentK1);
                // Alt seviyelerde: aynı K1 içindeki dilimleri birbirinden ayırmak için opacity varyasyonu
                const color = donutLevel === 'kat1'
                  ? base
                  : `color-mix(in srgb, ${base} ${Math.max(55, 100 - (idx % 5) * 10)}%, var(--bg-card))`;
                return { label: k.label, value: k.value, color };
              }),
              onSliceClick: (d) => {
                const k = donutData.find(x => x.label === d.label);
                if (!k) return;
                if (donutLevel === 'kat1') {
                  setGlobalK1(prev => prev.includes(k.label) ? prev.filter(x => x !== k.label) : [...prev, k.label]);
                  setGlobalK2([]); setGlobalK3([]);
                } else if (donutLevel === 'kat2') {
                  setGlobalK2(prev => prev.includes(k.label) ? prev.filter(x => x !== k.label) : [...prev, k.label]);
                  setGlobalK3([]);
                } else {
                  setGlobalK3(prev => prev.includes(k.label) ? prev.filter(x => x !== k.label) : [...prev, k.label]);
                }
                window.scrollTo({top:0, behavior:'smooth'});
              }
            })
          ),
          h('div',{className:'legend donut-legend', style:{flexDirection:'column',alignItems:'flex-start', maxHeight:260, overflowY:'auto', width:'100%'}},
            donutData.map((k, idx) => {
              const share = donutTotal ? k.value / donutTotal : 0;
              const base = katColor(k.parentK1);
              const swatchColor = donutLevel === 'kat1'
                ? base
                : `color-mix(in srgb, ${base} ${Math.max(55, 100 - (idx % 5) * 10)}%, var(--bg-card))`;
              const isActive =
                  (donutLevel === 'kat1' && globalK1.includes(k.label))
                || (donutLevel === 'kat2' && globalK2.includes(k.label))
                || (donutLevel === 'kat3' && globalK3.includes(k.label));
              return h('div',{
                key: k.key,
                className: 'li' + (isActive ? ' active' : ''),
                style: {cursor:'pointer', width:'100%', justifyContent:'space-between', padding:'3px 6px', borderRadius:4, background: isActive ? 'var(--accent-wash)' : 'transparent', flexShrink: 0},
                onClick: () => {
                  if (donutLevel === 'kat1') {
                    setGlobalK1(prev => prev.includes(k.label) ? prev.filter(x => x !== k.label) : [...prev, k.label]);
                    setGlobalK2([]); setGlobalK3([]);
                  } else if (donutLevel === 'kat2') {
                    setGlobalK2(prev => prev.includes(k.label) ? prev.filter(x => x !== k.label) : [...prev, k.label]);
                    setGlobalK3([]);
                  } else {
                    setGlobalK3(prev => prev.includes(k.label) ? prev.filter(x => x !== k.label) : [...prev, k.label]);
                  }
                  window.scrollTo({top:0, behavior:'smooth'});
                }
              },
                h('div',{style:{display:'flex',alignItems:'center',gap:6, minWidth:0, flex:1}},
                  h('div',{className:'swatch', style:{background: swatchColor, flexShrink:0}}),
                  h('div',{style:{minWidth:0, overflow:'hidden'}},
                    h('div',{style:{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}, k.label),
                    k.sub && h('div',{className:'txt-3', style:{fontSize:9.5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}, k.sub)
                  )
                ),
                h('span',{className:'txt-3', style:{fontSize:11, flexShrink:0, marginLeft:8}}, (share*100).toFixed(1).replace('.',',')+'%')
              );
            })
          )
        )
      ),

      // Heatmap
      h(SectionHeader, {
        accent:'blue',
        icon: h('svg',{width:22,height:22,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'},
          h('rect',{x:3,y:3,width:7,height:7}),h('rect',{x:14,y:3,width:7,height:7}),h('rect',{x:3,y:14,width:7,height:7}),h('rect',{x:14,y:14,width:7,height:7})
        ),
        title:'Sezon Takvimi & Mevsimsel Ritim',
        desc:'Kategorilerin aylık arama ritmi, 2024↔2025 YoY karşılaştırması ve çeyreklik peak dağılımı.'
      }),
      h('div',{className:'card', style:{marginBottom:18}},
        h('div',{className:'card-header', style:{flexWrap:'wrap',gap:10}},
          h('h3',{style:{flex:1,minWidth:180}},'Kategori Sezon Takvimi',
            h(InfoIcon,null,
              h('strong',null,'Ne gösterir? '),'Her satır bir kategori, sütunlar aylar. Üst değer o ayın 2025 arama hacmi, alt rozet ise 2024\'e kıyasla % değişim (YoY).',
              h('br'),h('br'),h('strong',null,'Renk skalası: '),'Satır içinde normalize edilir - ',h('span',{style:{color:'#e67c73',fontWeight:600}},'kırmızı'),' = o satırın dibi, ',h('span',{style:{color:'#fbbc04',fontWeight:600}},'sarı'),' = orta, ',h('span',{style:{color:'#57bb8a',fontWeight:600}},'yeşil'),' = peak ay.',
              h('br'),h('br'),h('strong',null,'YoY rozeti: '), h('span',{style:{color:'#065F46',fontWeight:600}},'Yeşil +%'),' 2024\'ten büyüdü, ', h('span',{style:{color:'#991B1B',fontWeight:600}},'kırmızı -%'),' daraldı.',
              h('br'),h('br'),h('strong',null,'Nasıl okunur? '),'Yeşil renk o ay o kategorinin peak dönemi demektir. Hücreye tıklandığında o kategori drill-down olur.',
              h('br'),h('br'),h('strong',null,'Ne için? '),'SEO & pazarlama takvimi kategoriye özel olarak bu ritim dikkate alınarak kurgulanabilir; peak\'ten 4-6 hafta önce içeriğin yayında olması hedeflenebilir.'
            )
          ),
          h('div',{className:'segmented'},
            h('button',{className:heatLevel==='kat1'?'active':'', onClick:()=>{setHeatLevel('kat1'); setHeatFilter({k1:'',k2:''});}}, 'Kat 1'),
            h('button',{className:heatLevel==='kat2'?'active':'', onClick:()=>{setHeatLevel('kat2');}}, 'Kat 2'),
            h('button',{className:heatLevel==='kat3'?'active':'', onClick:()=>{setHeatLevel('kat3');}}, 'Kat 3')
          ),
          h('div',{className:'segmented', title:'Sıralama'},
            h('button',{className:heatSort==='vol'?'active':'', onClick:()=>setHeatSort('vol')}, 'Hacim ↓'),
            h('button',{className:heatSort==='yoyDesc'?'active':'', onClick:()=>setHeatSort('yoyDesc')}, 'YoY ↑'),
            h('button',{className:heatSort==='yoyAsc'?'active':'', onClick:()=>setHeatSort('yoyAsc')}, 'YoY ↓'),
            h('button',{className:heatSort==='alpha'?'active':'', onClick:()=>setHeatSort('alpha')}, 'A-Z')
          ),
          heatLevel !== 'kat1' && h('select',{className:'select', value:heatFilter.k1, onChange:e=>setHeatFilter({k1:e.target.value,k2:''})},
            h('option',{value:''}, 'Tüm Kat 1'),
            D.kat1Summary.map(k => h('option',{key:k.k1, value:k.k1}, k.k1))
          ),
          heatLevel === 'kat3' && h('select',{className:'select', value:heatFilter.k2, onChange:e=>setHeatFilter({...heatFilter, k2:e.target.value})},
            h('option',{value:''}, 'Tüm Kat 2'),
            kat2InK1(heatFilter.k1).map(k => h('option',{key:k, value:k}, k))
          ),
          heatRows.length > 0 && h(Zoomable, {title:'Kategori Sezon Takvimi', aspect:'wide'},
            h('div',{style:{minWidth:720}},
              h(Heatmap,{rows:heatRows, year:2025, showYoY:true})
            )
          )
        ),
        h('div',{className:'heatmap-scroll', style:{overflow:'auto', maxHeight: heatLevel === 'kat1' ? 'none' : 560}},
          h('div',{style:{minWidth:720}},
            heatRows.length > 0 ? h(Heatmap,{rows:heatRows, year:2025, showYoY:true, onClickCell:(r,i)=>{
              if (r.ctx.k3) onNavigateKw({k1:r.ctx.k1, k2:r.ctx.k2, k3:r.ctx.k3});
              else if (r.ctx.k2) onNavigateKw({k1:r.ctx.k1, k2:r.ctx.k2});
              else onNavigateCat(r.ctx.k1);
            }})
            : h(EmptyState, {
                icon: h('svg',{width:28,height:28,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'},h('circle',{cx:11,cy:11,r:8}),h('line',{x1:21,y1:21,x2:16.65,y2:16.65})),
                title:'Filtreye uyan kategori yok',
                desc:'Aktif filtre bu seviyede kategori göstermiyor. Üst seviyeye dönüp filtreyi genişletmeyi veya kaldırmayı deneyebilirsiniz.',
                cta:'Filtreleri Temizle',
                onCta:()=>{ setGlobalK1([]); setGlobalK2([]); setGlobalK3([]); setHeatFilter({k1:'',k2:''}); }
              })
          )
        ),
        h('div',{className:'txt-3',style:{fontSize:11,marginTop:10}},
          'Her hücrede ', h('strong',null,'üst:'), ' 2025 arama hacmi, ', h('strong',null,'alt rozet:'), ' 2024\'e kıyasla ', h('strong',null,'YoY%'),' değişim. ',
          'Renk: ', h('span',{style:{color:'#e67c73'}},'kırmızı (dip) '), '& ',
          h('span',{style:{color:'#fbbc04'}},'sarı (orta) '), '& ',
          h('span',{style:{color:'#57bb8a'}},'yeşil (peak)'), ' · hücreye tıkla & detay.'
        )
      ),

      // ==== Marka × Kategori Matrix — Portföy İçi (drill-down Kat1→Kat2→Kat3) ====
      (() => {
        const gK1 = globalK1 || [];
        const gK2 = globalK2 || [];
        let level = 'k1', levelLabel = 'Kategori (Kat 1)';
        if (gK2.length >= 1) { level = 'k3'; levelLabel = 'Alt Alt Kategori (Kat 3)'; }
        else if (gK1.length >= 1) { level = 'k2'; levelLabel = 'Alt Kategori (Kat 2)'; }

        const pool = fKeywords.filter(k => !!k.brand);
        if (pool.length === 0) return null;

        const brandMap = {}; const colSet = new Set(); const colParentK1 = {};
        for (const k of pool) {
          const col = level === 'k1' ? k.k1 : level === 'k2' ? k.k2 : k.k3;
          if (!col) continue;
          colSet.add(col);
          if (!colParentK1[col]) colParentK1[col] = k.k1;
          if (!brandMap[k.brand]) brandMap[k.brand] = { brand: k.brand, total: 0, cells: {} };
          brandMap[k.brand].total += (k.a25 || 0) * 12;
          brandMap[k.brand].cells[col] = (brandMap[k.brand].cells[col] || 0) + (k.a25 || 0) * 12;
        }
        const brands = Object.values(brandMap).sort((a,b) => b.total - a.total);
        const colList = Array.from(colSet).sort();
        if (brands.length === 0 || colList.length === 0) return null;
        const rowMaxes = brands.map(b => Math.max(...colList.map(c => b.cells[c] || 0), 1));

        const copyData = () => ({
          headers: ['#', 'Marka', ...colList, 'Toplam Avg'],
          rows: brands.map((b, i) => [
            i+1, b.brand,
            ...colList.map(c => toMonthlyAvg(b.cells[c] || 0)),
            toMonthlyAvg(b.total)
          ])
        });

        return h('div',{className:'card', style:{marginBottom:18}},
          h('div',{className:'card-header', style:{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}},
            h('h3',{style:{flex:1,minWidth:240}},'Marka × ' + levelLabel + ' Matris · Portföy İçi',
              h(InfoIcon,null,
                h('strong',null,'Ne gösterir? '),'Özdilek portföyündeki tüm markaların seçili kategori seviyesinde aylık ortalama hacim dağılımı.',
                h('br'),h('br'),h('strong',null,'Drill-down: '),'Global filtreden Kat 1 seç → Kat 2 kolonları gelir. Kat 2 seç → Kat 3 kolonları. Marka ismi tıkla → filter.'
              )
            ),
            h('span',{className:'txt-3', style:{fontSize:11}}, brands.length + ' marka × ' + colList.length + ' kolon'),
            h(CopyButton, {getData: copyData})
          ),
          h('div',{className:'bkm-scroll', style:{overflow:'auto', padding:'0 14px 14px', position:'relative', maxHeight: 520}},
            h('div',{className:'bkm-grid', style:{
              display:'grid',
              gridTemplateColumns: `minmax(160px, 200px) repeat(${colList.length}, minmax(70px, 1fr)) minmax(80px, 100px)`,
              gap:2, minWidth: (160 + colList.length*70 + 80) + 'px'
            }},
              h('div',{style:{padding:'8px 6px', fontSize:10, fontWeight:700, color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'.08em', position:'sticky', top:0, left:0, background:'var(--bg-card)', zIndex:3}}, 'Marka'),
              ...colList.map(col => h('div',{
                key:'h'+col,
                style:{
                  padding:'8px 4px', fontSize:10, fontWeight:700, textAlign:'center',
                  borderBottom:`2px solid ${katColor(colParentK1[col] || col)}`, color:'var(--ink-2)',
                  lineHeight:1.15, wordBreak:'break-word',
                  position:'sticky', top:0, background:'var(--bg-card)', zIndex:2
                }, title:col
              }, col)),
              h('div',{style:{padding:'8px 4px', fontSize:10, fontWeight:700, textAlign:'right', color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'.08em', position:'sticky', top:0, background:'var(--bg-card)', zIndex:2}}, 'Toplam Avg'),
              ...brands.flatMap((r, ri) => [
                h('div',{
                  key:'b'+ri,
                  style:{
                    padding:'6px 8px', fontSize:12, fontWeight:600, cursor:'pointer',
                    display:'flex', alignItems:'center', gap:6, minWidth:0,
                    borderTop: ri>0 ? '1px solid var(--line)' : 'none',
                    position:'sticky', left:0, background:'var(--bg-card)', zIndex:1
                  },
                  onClick: () => globalFilter?.setGlobalBrand && globalFilter.setGlobalBrand([r.brand])
                },
                  h('span',{style:{color:'var(--ink-3)',fontSize:10,fontWeight:500,flexShrink:0,minWidth:16}}, (ri+1)+'.'),
                  h('span',{style:{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,minWidth:0}, title:r.brand}, r.brand)
                ),
                ...colList.map((col, ci) => {
                  const v = r.cells[col] || 0;
                  const intensity = rowMaxes[ri] ? v / rowMaxes[ri] : 0;
                  const bg = intensity > 0
                    ? `color-mix(in srgb, ${katColor(colParentK1[col] || col)} ${Math.round(intensity*82+8)}%, var(--bg-card))`
                    : 'var(--bg-card)';
                  const txtColor = intensity > 0.55 ? '#fff' : 'var(--ink-2)';
                  const avgV = toMonthlyAvg(v);
                  return h('div',{
                    key:'c'+ri+'_'+ci,
                    style:{
                      padding:'8px 4px', fontSize:10, fontWeight:600, textAlign:'center',
                      background: bg, color: txtColor, borderRadius:3,
                      borderTop: ri>0 ? '1px solid var(--line)' : 'none',
                      minHeight:28, display:'flex', alignItems:'center', justifyContent:'center'
                    }, title: `${r.brand} · ${col}: ${fmtFull(avgV)} /ay`
                  }, v > 0 ? fmtNum(avgV) : '·');
                }),
                h('div',{
                  key:'t'+ri,
                  style:{
                    padding:'8px 6px', fontSize:11, fontWeight:700, textAlign:'right',
                    color:'var(--ink)', borderTop: ri>0 ? '1px solid var(--line)' : 'none'
                  },
                  title: fmtFull(toMonthlyAvg(r.total))
                }, fmtNum(toMonthlyAvg(r.total)))
              ])
            )
          )
        );
      })(),

      // ==== Small multiples + Polar peak ====
      h('div',{className:'grid grid-karne-saat', style:{gridTemplateColumns:'1fr 340px', gap:18, marginBottom:18}},
        h('div',{className:'card'},
          h('div',{className:'card-header'},
            h('h3',null,'Kategori Karnesi · 8 Kat 1 Bir Arada',
              h(InfoIcon,null,
                h('strong',null,'Ne gösterir? '),'Her mini grafik bir Kat 1 kategorisinin 12 aylık ritmini barlarla gösterir. Tek ekranda 8 kategoriyi karşılaştırma imkanı sunar.',
                h('br'),h('br'),h('strong',null,'Nasıl okunur? '),'Koyu bar o kategorinin peak ayı. Sağ üstteki rozet yıllık değişim. Karta tıklandığında Kategoriler sekmesine o kategori ile inilir.',
                h('br'),h('br'),h('strong',null,'Ne için? '),'Kategoriler arası ritim farkını bir bakışta görmek için kullanılabilir.'
              )
            ),
            h('div',{className:'hint'},'2025 aylık · tıkla & detay')
          ),
          h(SmallMultiples, {
            items: D.kat1Summary.map(k1 => {
              const row = D.kat1Monthly.find(x => (x.labels && x.labels[0] === k1.k1) || x.k1 === k1.k1);
              if (!row) return null;
              const values = row.m25 || row.val25 || row.val || [];
              if (!values.length) return null;
              return { label: k1.k1, values, color: KAT1_COLORS[k1.k1] || 'var(--accent)', yoy: k1.yoy };
            }).filter(Boolean),
            onClick: (it) => onNavigateCat(it.label)
          })
        ),
        h('div',{className:'card'},
          h('div',{className:'card-header'},
            h('h3',null,'Aylık Hacim Dağılım Grafiği',
              h(InfoIcon,null,
                h('strong',null,'Ne gösterir? '),'12 ayı bir saat kadranı gibi gösterir; her dilimin uzunluğu o ayın arama hacmine göredir.',
                h('br'),h('br'),h('strong',null,'Nasıl okunur? '),'En uzun dilim peak aydır. Üzerine gelindiğinde merkez o ayın hacmini gösterir.',
                h('br'),h('br'),h('strong',null,'Ne için? '),'12 aylık dağılımı doğrusal bir çizgi yerine mevsimsel bir daire olarak görmek için kullanılabilir.'
              )
            ),
            h('div',{className:'hint'},'2025 · hover & ay detayı')
          ),
          h(PolarPeak, { values: f_MONTHLY_25, color:'var(--coral)', size: 260, year: 2025 })
        )
      ),

      // YoY + Quarterly
      h('div',{className:'grid grid-2', style:{marginBottom:18}},
        h('div',{className:'card'},
          h('div',{className:'card-header',style:{flexWrap:'wrap',gap:8}},
            h('h3',{style:{flex:1,minWidth:160}},'Kategori YoY & Kazanan / Kaybeden',
              h(InfoIcon,null,
                h('strong',null,'Ne gösterir? '),'Her kategorinin 2024\'e kıyasla 2025\'teki % büyüme/düşüşü.',
                h('br'),h('br'),h('strong',null,'Nasıl okunur? '),h('span',{style:{color:'#2E7D32',fontWeight:600}},'Yeşil'),' = büyüdü, ',h('span',{style:{color:'#D32F2F',fontWeight:600}},'kırmızı'),' = daralıyor. Çubuğa tıklandığında o kategorinin keywordlerine filtreli şekilde inilebilir.',
                h('br'),h('br'),h('strong',null,'Ne için? '),'Yatırım önceliği değerlendirmesi için kullanılabilir. Büyüyen kategoride içerik + reklam önerilebilir; daralan için rakip analizi faydalı olabilir.'
              )
            ),
            h('div',{className:'segmented'},
              h('button',{className:yoyLevel==='kat1'?'active':'', onClick:()=>{setYoyLevel('kat1'); setYoyFilter({k1:'',k2:''});}}, 'Kat 1'),
              h('button',{className:yoyLevel==='kat2'?'active':'', onClick:()=>setYoyLevel('kat2')}, 'Kat 2'),
              h('button',{className:yoyLevel==='kat3'?'active':'', onClick:()=>setYoyLevel('kat3')}, 'Kat 3')
            )
          ),
          yoyLevel !== 'kat1' && h('div',{style:{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}},
            h('select',{className:'select', value:yoyFilter.k1, onChange:e=>setYoyFilter({k1:e.target.value,k2:''})},
              h('option',{value:''}, 'Tüm Kat 1'),
              D.kat1Summary.map(k => h('option',{key:k.k1, value:k.k1}, k.k1))
            ),
            yoyLevel === 'kat3' && h('select',{className:'select', value:yoyFilter.k2, onChange:e=>setYoyFilter({...yoyFilter,k2:e.target.value})},
              h('option',{value:''}, 'Tüm Kat 2'),
              kat2InK1(yoyFilter.k1).map(k => h('option',{key:k, value:k}, k))
            )
          ),
          h('div',{style:{display:'flex',alignItems:'center',justifyContent:'center',width:'100%'}},
            h(BarChart,{
              data:yoyData, height:260, yFormat:v=>fmtPct(v,0),
              onBarClick: d => {
                const c = d.ctx;
                if (c.k3) onNavigateKw({k1:c.k1, k2:c.k2, k3:c.k3});
                else if (c.k2) onNavigateKw({k1:c.k1, k2:c.k2});
                else onNavigateCat(c.k1);
              }
            })
          )
        ),
        h('div',{className:'card'},
          h('div',{className:'card-header',style:{flexWrap:'wrap',gap:8}},
            h('h3',{style:{flex:1,minWidth:160}},'Çeyreklik Peak Dağılımı',
              h(InfoIcon,null,
                h('strong',null,'Ne gösterir? '),'Her kategorinin yıllık aramasının Q1/Q2/Q3/Q4\'e nasıl dağıldığı.',
                h('br'),h('br'),h('strong',null,'Nasıl okunur? '),'Her renkli dilim bir çeyrek. En büyük dilim o kategorinin peak çeyreği.',
                h('br'),h('br'),h('strong',null,'Ne için? '),'Kampanya & stok planlama. "Duş kabini Q2\'de patlar" gibi ritmi görürsün.'
              )
            ),
            h('div',{className:'segmented'},
              h('button',{className:qLevel==='kat1'?'active':'', onClick:()=>{setQLevel('kat1'); setQFilter({k1:'',k2:''});}}, 'Kat 1'),
              h('button',{className:qLevel==='kat2'?'active':'', onClick:()=>setQLevel('kat2')}, 'Kat 2'),
              h('button',{className:qLevel==='kat3'?'active':'', onClick:()=>setQLevel('kat3')}, 'Kat 3')
            )
          ),
          qLevel !== 'kat1' && h('div',{style:{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}},
            h('select',{className:'select', value:qFilter.k1, onChange:e=>setQFilter({k1:e.target.value,k2:''})},
              h('option',{value:''}, 'Tüm Kat 1'),
              D.kat1Summary.map(k => h('option',{key:k.k1, value:k.k1}, k.k1))
            ),
            qLevel === 'kat3' && h('select',{className:'select', value:qFilter.k2, onChange:e=>setQFilter({...qFilter,k2:e.target.value})},
              h('option',{value:''}, 'Tüm Kat 2'),
              kat2InK1(qFilter.k1).map(k => h('option',{key:k, value:k}, k))
            )
          ),
          h('div',{className:'q-list', style:{display:'flex',flexDirection:'column',gap:10, maxHeight:440, overflowY:'auto', paddingRight:6}},
            qData.map(q => h('div',{key:q.label+q.sub, style:{cursor:'pointer'}, onClick:()=>{
              const c = q.ctx;
              if (c.k3) onNavigateKw({k1:c.k1, k2:c.k2, k3:c.k3});
              else if (c.k2) onNavigateKw({k1:c.k1, k2:c.k2});
              else onNavigateCat(c.k1);
            }},
              h('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:3,fontSize:12,gap:8}},
                h('div',{style:{overflow:'hidden'}},
                  h('span',{style:{fontWeight:500}}, q.label),
                  q.sub && h('span',{className:'txt-3', style:{fontSize:10,marginLeft:6}}, q.sub)
                ),
                h('span',{className:'pill q'+q.peakQ, style:{flexShrink:0}}, 'Q'+q.peakQ)
              ),
              h(QStack,{q1:q.q1/q.tot, q2:q.q2/q.tot, q3:q.q3/q.tot, q4:q.q4/q.tot})
            ))
          ),
          h('div',{className:'legend', style:{marginTop:14}},
            ['#3B82F6','#EF4444','#F59E0B','#10B981'].map((c,i) =>
              h('div',{key:i,className:'li'}, h('div',{className:'swatch',style:{background:c}}), 'Q'+(i+1))
            )
          )
        )
      ),

      // Top Gainers / Losers / Top10
      h('div',{className:'grid grid-3', style:{marginBottom:18}},
        h('div',{className:'card flush'},
          h('div',{className:'card-title-row', style:{display:'flex',alignItems:'center',justifyContent:'space-between'}},
            h('h3',null,'Top 10 Hacim Lideri',
              h(InfoIcon,null,h('strong',null,'Ne? '),'2025\'te en çok aranan 10 kelime. Satıra tıkla → 12 aylık trend grafiği.')
            ),
            h('span',{className:'hint'},'2025 ort.')
          ),
          h('table',{className:'tbl'},
            h('tbody',null,
              top10.map((k,i) => h('tr',{key:i, className:'clickable', onClick:()=>setKeywordModal(k)},
                h('td',{style:{width:20}}, h('span',{className:'txt-3 num'}, (i+1))),
                h('td',null,
                  h('div',{className:'kw-cell'}, k.kw),
                  h('div',{className:'cat-cell'}, k.k1)
                ),
                h('td',{className:'num', style:{width:70}}, fmtNum(k.a25)),
                h('td',{style:{width:60,textAlign:'right'}}, h(YoYPill,{yoy:k.yoy}))
              ))
            )
          )
        ),
        h('div',{className:'card flush'},
          h('div',{className:'card-title-row', style:{display:'flex',alignItems:'center',justifyContent:'space-between'}},
            h('h3',null,'En Çok Büyüyen',
              h(InfoIcon,null,h('strong',null,'Ne? '),'2024\'ten 2025\'e mutlak hacim artışı en yüksek kelimeler. % değil, toplam arama sayısında artış.')
            ),
            h('span',{className:'hint pill pos', style:{fontSize:10}},'↑ Kazanan')
          ),
          h('table',{className:'tbl'},
            h('tbody',null,
              topGainers.map((k,i) => h('tr',{key:i, className:'clickable', onClick:()=>setKeywordModal(k)},
                h('td',null,
                  h('div',{className:'kw-cell'}, k.kw),
                  h('div',{className:'cat-cell'}, k.k1)
                ),
                h('td',{className:'num', style:{width:80, color:'var(--green)'}}, '+'+fmtNum(k.delta)),
                h('td',{style:{width:50,textAlign:'right'}}, h(YoYPill,{yoy:k.yoy}))
              ))
            )
          )
        ),
        h('div',{className:'card flush'},
          h('div',{className:'card-title-row', style:{display:'flex',alignItems:'center',justifyContent:'space-between'}},
            h('h3',null,'En Çok Daralan',
              h(InfoIcon,null,h('strong',null,'Ne? '),'2024\'ten 2025\'e mutlak hacim düşüşü en yüksek kelimeler. Büyük hacimli kelimelerde küçük % bile büyük düşüş demek.')
            ),
            h('span',{className:'hint pill neg', style:{fontSize:10}},'↓ Kaybeden')
          ),
          h('table',{className:'tbl'},
            h('tbody',null,
              topLosers.map((k,i) => h('tr',{key:i, className:'clickable', onClick:()=>setKeywordModal(k)},
                h('td',null,
                  h('div',{className:'kw-cell'}, k.kw),
                  h('div',{className:'cat-cell'}, k.k1)
                ),
                h('td',{className:'num', style:{width:80, color:'var(--red)'}}, fmtNum(k.delta)),
                h('td',{style:{width:50,textAlign:'right'}}, h(YoYPill,{yoy:k.yoy}))
              ))
            )
          )
        )
      )
    );
  }

  // === Kategoriler Tab ===
  function KategorilerTab({filter, setFilter, onNavigateKw}) {
    const [level, setLevel] = React.useState('kat1');
    const [catSort, setCatSort] = React.useState('vol');  // vol | yoyDesc | yoyAsc | alpha
    // Multi-selects - independent per level
    const [multiK1, setMultiK1] = React.useState(() => filter.k1 ? [filter.k1] : []);
    const [multiK2, setMultiK2] = React.useState(() => filter.k2 ? [filter.k2] : []);
    const [multiK3, setMultiK3] = React.useState([]);
    // Keep multiK1 in sync with incoming filter.k1 (when navigated from Özet)
    React.useEffect(() => {
      if (filter.k1 && !multiK1.includes(filter.k1)) setMultiK1([filter.k1]);
    }, [filter.k1]);
    React.useEffect(() => {
      if (filter.k2 && !multiK2.includes(filter.k2)) setMultiK2([filter.k2]);
    }, [filter.k2]);

    const allKat1 = D.kat1Summary.map(k => k.k1);
    const activeK1Set = multiK1.length ? new Set(multiK1) : null;
    const activeK2Set = multiK2.length ? new Set(multiK2) : null;
    const activeK3Set = multiK3.length ? new Set(multiK3) : null;

    // Available Kat2/Kat3 for MultiSelect, narrowed by upstream selections
    const allKat2 = React.useMemo(() =>
      [...new Set(D.keywords
        .filter(k => !activeK1Set || activeK1Set.has(k.k1))
        .map(k => k.k2))].sort()
    , [multiK1]);
    const allKat3 = React.useMemo(() =>
      [...new Set(D.keywords
        .filter(k => (!activeK1Set || activeK1Set.has(k.k1)) && (!activeK2Set || activeK2Set.has(k.k2)))
        .map(k => k.k3))].sort()
    , [multiK1, multiK2]);

    const rows = level==='kat1' ? D.kat1Monthly : level==='kat2' ? D.kat2Monthly : D.kat3Monthly;

    const scoped = rows.filter(r => {
      if (activeK1Set && !activeK1Set.has(r.labels[0])) return false;
      if (level !== 'kat1' && activeK2Set && !activeK2Set.has(r.labels[1])) return false;
      if (level === 'kat3' && activeK3Set && !activeK3Set.has(r.labels[2])) return false;
      return true;
    });
    const sorted = React.useMemo(() => {
      const s = [...scoped];
      if (catSort === 'vol') return s.sort((a,b) => (b.a25||0) - (a.a25||0));
      if (catSort === 'yoyDesc') return s.sort((a,b) => (b.yoy||0) - (a.yoy||0));
      if (catSort === 'yoyAsc') return s.sort((a,b) => (a.yoy||0) - (b.yoy||0));
      if (catSort === 'alpha') return s.sort((a,b) => (a.labels[a.labels.length-1]||'').localeCompare(b.labels[b.labels.length-1]||'', 'tr'));
      return s;
    }, [scoped, catSort]);

    // Line chart data - filtered by whatever is selected
    const lineKeywords = React.useMemo(() => {
      return D.keywords.filter(k => {
        if (activeK1Set && !activeK1Set.has(k.k1)) return false;
        if (activeK2Set && !activeK2Set.has(k.k2)) return false;
        if (activeK3Set && !activeK3Set.has(k.k3)) return false;
        return true;
      });
    }, [multiK1, multiK2, multiK3]);
    const line25 = aggregateMonthly(lineKeywords, 'm25');
    const line24 = aggregateMonthly(lineKeywords, 'm24');
    const linePeak = line25.indexOf(Math.max(...line25));
    const lineTotal25 = line25.reduce((a,b)=>a+b,0);
    const lineTotal24 = line24.reduce((a,b)=>a+b,0);
    const lineYoY = lineTotal24 ? (lineTotal25 - lineTotal24) / lineTotal24 : 0;

    // Multi-series when multiple Kat1s are selected (and no deeper filter)
    const multiLineSeries = React.useMemo(() => {
      if (multiK1.length < 2 || activeK2Set || activeK3Set) return null;
      return multiK1.slice(0, 8).map(k1 => {
        const kws = D.keywords.filter(k => k.k1 === k1);
        return { name:k1, values: aggregateMonthly(kws, 'm25'), color: katColor(k1) };
      });
    }, [multiK1, multiK2, multiK3]);

    const clearAll = () => { setMultiK1([]); setMultiK2([]); setMultiK3([]); setFilter({}); };

    return h('div',null,
      h('div',{className:'toolbar'},
        h('div',{className:'segmented'},
          h('button',{className:level==='kat1'?'active':'', onClick:()=>setLevel('kat1')}, `Kat 1 (${D.kat1Monthly.length})`),
          h('button',{className:level==='kat2'?'active':'', onClick:()=>setLevel('kat2')}, `Kat 2 (${D.kat2Monthly.length})`),
          h('button',{className:level==='kat3'?'active':'', onClick:()=>setLevel('kat3')}, `Kat 3 (${D.kat3Monthly.length})`)
        ),
        h(window.C.MultiSelect, {
          label: 'Kat 1',
          options: allKat1,
          selected: multiK1,
          onChange: (sel) => {
            setMultiK1(sel);
            // Clear sub-levels if their values no longer belong
            const kat1Set = sel.length ? new Set(sel) : null;
            if (kat1Set) {
              setMultiK2(prev => prev.filter(k2 => D.keywords.some(kw => kat1Set.has(kw.k1) && kw.k2 === k2)));
              setMultiK3(prev => prev.filter(k3 => D.keywords.some(kw => kat1Set.has(kw.k1) && kw.k3 === k3)));
            }
            setFilter({k1: sel.length === 1 ? sel[0] : null, k2: null});
          },
          colorMap: KAT1_COLORS,
          width: 200
        }),
        h(window.C.MultiSelect, {
          label: 'Kat 2',
          options: allKat2,
          selected: multiK2,
          onChange: (sel) => {
            setMultiK2(sel);
            const kat2Set = sel.length ? new Set(sel) : null;
            if (kat2Set) setMultiK3(prev => prev.filter(k3 => D.keywords.some(kw => kat2Set.has(kw.k2) && kw.k3 === k3)));
            setFilter({...filter, k2: sel.length === 1 ? sel[0] : null});
          },
          width: 200
        }),
        level === 'kat3' && h(window.C.MultiSelect, {
          label: 'Kat 3',
          options: allKat3,
          selected: multiK3,
          onChange: setMultiK3,
          width: 200
        }),
        h('div',{style:{flex:1}}),
        h('div',{className:'segmented', title:'Sıralama'},
          h('button',{className:catSort==='vol'?'active':'', onClick:()=>setCatSort('vol')}, 'Hacim ↓'),
          h('button',{className:catSort==='yoyDesc'?'active':'', onClick:()=>setCatSort('yoyDesc')}, 'YoY ↑'),
          h('button',{className:catSort==='yoyAsc'?'active':'', onClick:()=>setCatSort('yoyAsc')}, 'YoY ↓'),
          h('button',{className:catSort==='alpha'?'active':'', onClick:()=>setCatSort('alpha')}, 'A-Z')
        ),
        h('span',{className:'txt-3', style:{fontSize:12}}, fmtFull(sorted.length)+' kategori'),
        h('button',{className:'chip-btn', style:{padding:'6px 12px',borderRadius:999}, onClick:()=>{
          const csv = toCSV(sorted, [
            {label:'Kategori', get:r=>r.labels.join(' > ')},
            {label:'2024 Ort', key:'a24'},
            {label:'2025 Ort', key:'a25'},
            {label:'YoY', get:r=>r.yoy?.toFixed(4)},
            ...TR_MONTHS.map((m,i)=>({label:m+' 2025', get:r=>r.m25[i]}))
          ]);
          downloadCSV(`${BRAND_SLUG}-${level}.csv`, csv);
        }}, '↓ CSV'),
      ),

      (multiK1.length + multiK2.length + multiK3.length) > 0 && h('div',{className:'filter-chips'},
        h('span',{className:'lbl'}, 'Filtre:'),
        multiK1.map(k => h('button',{key:'1'+k, className:'filter-chip', onClick:()=>{
          const next = multiK1.filter(x => x !== k);
          setMultiK1(next); setFilter({k1: next.length === 1 ? next[0] : null, k2: null});
        }}, 'K1: '+k, h('span',{className:'x'},'×'))),
        multiK2.map(k => h('button',{key:'2'+k, className:'filter-chip', onClick:()=>{
          const next = multiK2.filter(x => x !== k);
          setMultiK2(next); setFilter({...filter, k2: next.length === 1 ? next[0] : null});
        }}, 'K2: '+k, h('span',{className:'x'},'×'))),
        multiK3.map(k => h('button',{key:'3'+k, className:'filter-chip', onClick:()=>{
          setMultiK3(multiK3.filter(x => x !== k));
        }}, 'K3: '+k, h('span',{className:'x'},'×'))),
        h('button',{className:'chip-btn', onClick: clearAll}, 'Temizle')
      ),

      // 12 Aylık Toplam Arama Hacmi (filtered)
      h('div',{className:'card', style:{marginBottom:18}},
        h('div',{className:'card-header'},
          h('h3',null,'12 Aylık Toplam Arama Hacmi',
            h(InfoIcon,{title:'12 Aylık Toplam Arama Hacmi'},
              h('p',null,h('strong',null,'Ne gösterir? '),'Üstteki filtrelere göre, seçili kategorilerdeki aylık toplam arama hacmi.'),
              h('p',null,h('strong',null,'Nasıl okunur? '), multiK1.length > 1 && !activeK2Set && !activeK3Set ? 'Her çizgi bir Kat 1 kategorisini temsil eder; renkler legend üzerinden takip edilebilir.' : 'Gri çizgi 2024 toplam hacmini, coral çizgi 2025 toplam hacmini gösterir. Kırmızı nokta yılın peak ayıdır.'),
              h('p',null,h('strong',null,'Hangi veriler? '),'Y ekseni: aylık ', h('strong',null,'arama hacmi'),' (toplam arama sayısı). X ekseni: 12 ay (Ocak–Aralık).'),
              h('div',{className:'info-note'},h('strong',null,'Ne için? '),'Seçili kategorilerin 12 aylık ritmi izlenerek içerik & kampanya takvimi planlanabilir; peak aydan 4-6 hafta önce içeriğin yayında olması hedeflenebilir.')
            )
          ),
          h('div',{className:'hint'},
            !multiK1.length && !multiK2.length && !multiK3.length ? 'Tüm kategoriler · 2024 & 2025' :
            multiLineSeries ? `${multiK1.length} kategori karşılaştırması · 2025` :
            'Filtreli · 2024 & 2025'
          )
        ),
        h('div',{style:{display:'flex',justifyContent:'center',width:'100%'}},
          h('div',{style:{width:'100%',maxWidth:1000}},
            multiLineSeries
              ? h(LineChart,{ series: multiLineSeries, legend:true, height:200 })
              : h(LineChart,{
                  series:[
                    {name:'2024', values:line24, color:'#8A8A8A'},
                    {name:'2025', values:line25, color:'#FF7B52', peakIdx:linePeak}
                  ], legend:true, height:200
                })
          )
        ),
        h('div',{style:{display:'flex',gap:20,marginTop:10,flexWrap:'wrap',fontSize:12,color:'var(--ink-2)'}},
          h('div',null, 'Toplam 2025: ', h('strong',{className:'num'}, fmtNum(lineTotal25))),
          !multiLineSeries && h('div',null, 'YoY: ', h(YoYPill, {yoy: lineYoY, type:'YoY'})),
          h('div',null, 'Peak ay: ', h('strong',null, TR_MONTHS_LONG[linePeak]))
        )
      ),

      h('div',{className:'card', style:{marginBottom:18}},
        h('div',{className:'card-header'},
          h('h3',null, `${level==='kat1'?'Kat 1':level==='kat2'?'Kat 2':'Kat 3'} Sezon Takvimi`,
            h(InfoIcon,{title:'Sezon Takvimi (Heatmap)'},
              h('p',null,h('strong',null,'Ne gösterir? '),'Her satır bir kategori, her sütun bir aydır. Hücrenin üst kısmında 2025 arama hacmi, alt rozetinde ise 2024\'e kıyasla değişim (YoY%) yer alır.'),
              h('p',null,h('strong',null,'Renk skalası: '),
                h('span',{style:{color:'#e67c73',fontWeight:600}},'kırmızı'), ' = o satırın en düşük ayı, ',
                h('span',{style:{color:'#fbbc04',fontWeight:600}},'sarı'), ' = orta, ',
                h('span',{style:{color:'#57bb8a',fontWeight:600}},'yeşil'), ' = peak ay.'
              ),
              h('p',null,h('strong',null,'YoY rozeti: '),
                h('span',{style:{color:'#065F46',fontWeight:600}},'Yeşil +%'), ' 2024\'ten büyüdüğünü, ',
                h('span',{style:{color:'#991B1B',fontWeight:600}},'kırmızı −%'), ' daraldığını gösterir.'
              ),
              h('p',null,h('strong',null,'Hangi veriler? '),'Üst değer: aylık ', h('strong',null,'arama hacmi'),'. Alt rozet: ', h('strong',null,'YoY% değişim'),' (2024 → 2025 aynı ay).'),
              h('div',{className:'info-note'},h('strong',null,'Ne için? '),'Pazarlama & SEO takvimi için ay bazlı ritim okunabilir. Hücreye tıklandığında alt kategori veya keyword detayına geçilir.')
            )
          ),
          h('div',{className:'hint'}, `${sorted.length} kategori`)
        ),
        h('div',{className:'heatmap-scroll', style:{overflow:'auto', maxHeight: level === 'kat1' ? 'none' : 600}},
          h('div',{style:{minWidth:720}},
            sorted.length > 0 ? h(Heatmap,{
              rows: sorted.map(r => {
                const peakIdx = r.m25.indexOf(Math.max(...r.m25));
                return {
                  label: level==='kat1' ? r.labels[0] : r.labels.slice(-1)[0],
                  sub: level!=='kat1' ? r.labels.slice(0,-1).join(' > ') : null,
                  values: r.m25, prevValues: r.m24 || m24ForLabels(level, r.labels), peakIdx
                };
              }),
              showValues: true, year: 2025, showYoY: true,
            }) : h('div',{className:'empty'}, 'Sonuç yok')
          )
        ),
        h('div',{className:'txt-3',style:{fontSize:11,marginTop:10}},
          'Her hücrede ', h('strong',null,'üst:'), ' 2025 arama hacmi, ', h('strong',null,'alt rozet:'), ' 2024\'e kıyasla ', h('strong',null,'YoY%'),' değişim. ',
          'Renk: ', h('span',{style:{color:'#e67c73'}},'kırmızı (dip) '), '& ',
          h('span',{style:{color:'#fbbc04'}},'sarı (orta) '), '& ',
          h('span',{style:{color:'#57bb8a'}},'yeşil (peak)'), '.',
          sorted.length > 15 && h('span',{style:{marginLeft:8}}, ` · Toplam ${sorted.length} kategori - kart içinde dikey kaydırılabilir.`)
        )
      ),

      h('div',{className:'card flush'},
        h('div',{className:'card-title-row'}, h('h3',null,'Kategori Detayları')),
        h('div',{className:'tbl-wrap'},
          h('table',{className:'tbl tbl-kat-detay'},
            h('thead',null,
              h('tr',null,
                h('th',null,'Kategori'),
                h('th',{className:'num col-hide-sm'}, '2024'),
                h('th',{className:'num'}, '2025'),
                h('th',{className:'num'}, 'YoY'),
                h('th',{className:'col-hide-sm'},'12 Ay Trend'),
                h('th',{className:'col-hide-sm'},'Peak Ç.'),
                h('th',{className:'col-hide-sm'},'En yüksek ay')
              )
            ),
            h('tbody',null,
              sorted.map((r,i) => {
                const peakIdx = r.m25.indexOf(Math.max(...r.m25));
                const peakQIdx = r.pq?.indexOf(1);
                return h('tr',{key:i, className:'clickable', onClick:() => {
                  if (level==='kat1') { setFilter({k1:r.labels[0]}); setLevel('kat2'); }
                  else if (level==='kat2') { setFilter({k1:r.labels[0], k2:r.labels[1]}); setLevel('kat3'); }
                  else { onNavigateKw({k1:r.labels[0], k2:r.labels[1], k3:r.labels[2]}); }
                }},
                  h('td',null,
                    h('div',{style:{display:'flex',alignItems:'center',gap:8}},
                      h('div',{style:{width:10,height:10,borderRadius:2,background:katColor(r.labels[0]), flexShrink:0}}),
                      h('div',{style:{minWidth:0}},
                        h('div',{className:'kw-cell'}, r.labels.slice(-1)[0]),
                        level!=='kat1' && h('div',{className:'cat-cell'}, r.labels.slice(0,-1).join(' > ')),
                        // Mobilde gizlenmiş metrikler buraya meta-satır olarak düşer
                        h('div',{className:'kw-mobile-meta'},
                          h('span',null, fmtNum(r.m25[peakIdx]), ' · ', TR_MONTHS[peakIdx]),
                          peakQIdx>=0 && h('span',{className:'pill q'+(peakQIdx+1), style:{fontSize:9, padding:'1px 5px', marginLeft:6}}, 'Q'+(peakQIdx+1))
                        )
                      )
                    )
                  ),
                  h('td',{className:'num col-hide-sm'}, fmtFull(r.a24)),
                  h('td',{className:'num'}, fmtFull(r.a25)),
                  h('td',{className:'num'}, h(YoYPill,{yoy:r.yoy})),
                  h('td',{className:'col-hide-sm', style:{width:110}}, h(Sparkline,{values:r.m25, w:100, h:28})),
                  h('td',{className:'col-hide-sm'}, peakQIdx>=0 ? h('span',{className:'pill q'+(peakQIdx+1)}, 'Q'+(peakQIdx+1)) : '-'),
                  h('td',{className:'col-hide-sm', style:{fontSize:12,color:'var(--ink-2)'}}, TR_MONTHS[peakIdx]+' · '+fmtNum(r.m25[peakIdx]))
                );
              })
            )
          )
        )
      )
    );
  }

  // === Keyword Tab ===
  function KeywordTab({setKeywordModal, initialFilter, clearInitialFilter, globalFilter}) {
    // Filter state: sadece keyword arama + sort tab-level, Kat/Marka/Peak/Çeyrek/Bucket/Trend globalde.
    const [q, setQ] = React.useState('');
    const [sort, setSort] = React.useState({k:'a25', d:-1});
    const [page, setPage] = React.useState(0);
    const perPage = 50;

    // initialFilter (cross-tab drill-down) artık global'e yazılıyor
    React.useEffect(() => {
      if (initialFilter && globalFilter) {
        if (initialFilter.k1 && globalFilter.setGlobalK1) {
          globalFilter.setGlobalK1(initialFilter.k1 ? [initialFilter.k1] : []);
        }
        if (initialFilter.k2 && globalFilter.setGlobalK2) {
          globalFilter.setGlobalK2(initialFilter.k2 ? [initialFilter.k2] : []);
        }
        if (initialFilter.k3 && globalFilter.setGlobalK3) {
          globalFilter.setGlobalK3(initialFilter.k3 ? [initialFilter.k3] : []);
        }
        if (initialFilter.trend && globalFilter.setGlobalTrend) {
          globalFilter.setGlobalTrend(initialFilter.trend);
        }
        if (clearInitialFilter) clearInitialFilter();
      }
    }, [initialFilter]);

    const filtered = React.useMemo(() => {
      let rows = applyGlobalFilter(D.keywords, globalFilter);
      const qq = q.trim().toLowerCase();
      if (qq) rows = rows.filter(r => r.kw.toLowerCase().includes(qq));
      const s = sort.k, d = sort.d;
      rows = [...rows].sort((a,b) => {
        const av = a[s], bv = b[s];
        if (av == null) return 1; if (bv == null) return -1;
        return (av > bv ? 1 : av < bv ? -1 : 0) * d;
      });
      return rows;
    }, [q, sort, globalFilter]);

    React.useEffect(() => setPage(0), [q, globalFilter]);
    const pageRows = filtered.slice(page*perPage, (page+1)*perPage);
    const totalPages = Math.ceil(filtered.length/perPage);

    const sumVol = filtered.reduce((a,k)=>a+(k.a25||0),0)*12;
    const sumVol24 = filtered.reduce((a,k)=>a+(k.a24||0),0)*12;
    const sumYoY = sumVol24 ? (sumVol - sumVol24) / sumVol24 : 0;
    const risingInView = filtered.filter(k=>k.yoy>0.05).length;
    const fallingInView = filtered.filter(k=>k.yoy<-0.05).length;

    const th = (label, k, numCol=false) => h('th', {
      className:numCol?'num':'',
      style:{cursor:'pointer', userSelect:'none'},
      onClick:()=>setSort({k, d: sort.k===k ? -sort.d : -1})
    }, label, sort.k===k ? (sort.d>0?' ↑':' ↓') : '');

    return h('div',null,
      // Sadece keyword arama + CopyButton + CSV export — diğer filtreler üst globalde
      h('div',{className:'toolbar'},
        h('input',{className:'input input-search', placeholder:'Keyword ara…', value:q, onChange:e=>setQ(e.target.value), style:{flex:1, minWidth:200}}),
        h('span',{className:'txt-3', style:{fontSize:12}}, fmtNum(filtered.length)+' keyword'),
        h(CopyButton, {
          getData: () => ({
            headers: ['Keyword','Marka','Kat 1','Kat 2','Kat 3','2024 Avg','2025 Avg','YoY %','Bucket','Peak Ay','Peak Çeyrek'],
            rows: filtered.map(r => [
              r.kw, r.brand||'', r.k1, r.k2, r.k3,
              r.a24, r.a25, (r.yoy*100).toFixed(2)+'%', r.bucket||'',
              r.m25 ? TR_MONTHS[r.m25.indexOf(Math.max(...r.m25))] : '',
              r.m25 ? 'Q'+(Math.floor(r.m25.indexOf(Math.max(...r.m25))/3)+1) : ''
            ])
          })
        }),
        h('button',{className:'chip-btn', style:{padding:'6px 12px',borderRadius:999}, onClick:()=>{
          const csv = toCSV(filtered, [
            {label:'Keyword',key:'kw'}, {label:'Marka',key:'brand'}, {label:'Kat 1',key:'k1'}, {label:'Kat 2',key:'k2'}, {label:'Kat 3',key:'k3'},
            {label:'2024 Avg',key:'a24'}, {label:'2025 Avg',key:'a25'}, {label:'YoY',key:'yoy'}, {label:'Bucket',key:'bucket'},
            {label:'Peak Ay', get:r=>TR_MONTHS[r.m25.indexOf(Math.max(...r.m25))]},
            {label:'Peak Çeyrek', get:r=>'Q'+(Math.floor(r.m25.indexOf(Math.max(...r.m25))/3)+1)},
            ...TR_MONTHS.map((m,i)=>({label:m+' 2025', get:r=>r.m25[i]}))
          ]);
          downloadCSV(`${BRAND_SLUG}-keywords.csv`, csv);
        }}, '↓ CSV'),
      ),

      h('div',{className:'grid grid-kpi kpi-5', style:{marginBottom:14}},
        h(Kpi,{label:'Filtrelenen KW', value:fmtNum(filtered.length), sub:`${TOTAL_KW} toplam içinden`, accent:true}),
        h(Kpi,{label:'Toplam Hacim', value:fmtNum(sumVol), chip:fmtPct(sumYoY), chipClass:trendClass(sumYoY), sub:'2025 toplam'}),
        h(Kpi,{label:'Yükselen', value:fmtNum(risingInView), chip:'↑', chipClass:'pos', sub:'görünen içinde'}),
        h(Kpi,{label:'Düşen', value:fmtNum(fallingInView), chip:'↓', chipClass:'neg', sub:'görünen içinde'}),
      ),

      h('div',{className:'card flush'},
        h('div',{className:'tbl-wrap'},
          h('table',{className:'tbl'},
            h('thead',null,
              h('tr',null,
                th('Keyword','kw'),
                th('Kat 1','k1'),
                th('Kat 2','k2'),
                th('Kat 3','k3'),
                th('2024','a24',true),
                th('2025','a25',true),
                th('YoY','yoy',true),
                h('th',null,'12 Ay Trend'),
                h('th',null,'Peak Ay'),
                h('th',null,'Peak Ç.'),
                h('th',null,'Bucket')
              )
            ),
            h('tbody',null,
              pageRows.length === 0 && h('tr',null, h('td',{colSpan:11, className:'empty'}, 'Sonuç bulunamadı')),
              pageRows.map((r,i) => {
                const peakIdx = r.m25.indexOf(Math.max(...r.m25));
                const peakQ = Math.floor(peakIdx / 3) + 1;
                return h('tr',{key:page*perPage+i, className:'clickable', onClick:()=>setKeywordModal(r)},
                  h('td',{className:'kw-cell', style:{maxWidth:220}}, r.kw),
                  h('td',{style:{fontSize:11}},
                    h('div',{style:{display:'flex',alignItems:'center',gap:5}},
                      h('div',{style:{width:7,height:7,borderRadius:2,background:katColor(r.k1),flexShrink:0}}),
                      h('span',null, r.k1)
                    )
                  ),
                  h('td',{style:{fontSize:11,color:'var(--ink-2)'}}, r.k2),
                  h('td',{style:{fontSize:11,color:'var(--ink-3)'}}, r.k3),
                  h('td',{className:'num'}, fmtFull(r.a24)),
                  h('td',{className:'num'}, fmtFull(r.a25)),
                  h('td',{className:'num'}, h(YoYPill,{yoy:r.yoy})),
                  h('td',{style:{width:110}}, h(Sparkline,{values:r.m25, w:100, h:26})),
                  h('td',null, h('span',{className:'pill neu'}, TR_MONTHS[peakIdx])),
                  h('td',null, h('span',{className:'pill q'+peakQ}, 'Q'+peakQ)),
                  h('td',null, h('span',{className:'cat-pill'}, r.bucket))
                );
              })
            )
          )
        ),
        totalPages > 1 && h('div',{style:{display:'flex',justifyContent:'center',gap:8,padding:14,borderTop:'1px solid var(--line)'}},
          h('button',{className:'chip-btn', style:{padding:'6px 12px',borderRadius:999}, disabled:page===0, onClick:()=>setPage(p=>Math.max(0,p-1))}, '← Önceki'),
          h('span',{style:{padding:'6px 12px',fontSize:12,color:'var(--ink-2)'}}, `Sayfa ${page+1}/${totalPages}`),
          h('button',{className:'chip-btn', style:{padding:'6px 12px',borderRadius:999}, disabled:page>=totalPages-1, onClick:()=>setPage(p=>Math.min(totalPages-1, p+1))}, 'Sonraki →')
        )
      )
    );
  }

  // === Trendler Tab ===
  function TrendlerTab({setKeywordModal, onNavigateKw, globalFilter}) {
    // All filters live in the global bar — tab-level filter row was removed.
    const [tab, setTab] = React.useState('rising');
    const [limit, setLimit] = React.useState(20);

    const [trendCatLevel, setTrendCatLevel] = React.useState('kat1');
    const [trendCatFilter, setTrendCatFilter] = React.useState({k1:'',k2:''});

    // sezType map (keyword -> type)
    const sezTypeMap = React.useMemo(() => {
      const m = new Map();
      for (const r of D.sezType) m.set(r.kw + '|' + r.k1, r.type);
      return m;
    }, []);

    // filteredKws = D.keywords scoped by global filter (Kat1/2/3/Marka/PeakAy/PeakÇ/SezTipi/Bucket/Trend)
    const filteredKws = React.useMemo(() =>
      applyGlobalFilter(D.keywords, globalFilter, sezTypeMap)
    , [globalFilter, sezTypeMap]);

    const risingAll = React.useMemo(() => filteredKws.filter(k => k.yoy > 0.05), [filteredKws]);
    const fallingAll = React.useMemo(() => filteredKws.filter(k => k.yoy < -0.05), [filteredKws]);

    // Most changed
    const topRising = React.useMemo(() => [...risingAll].sort((a,b) => b.yoy - a.yoy), [risingAll]);
    const topFalling = React.useMemo(() => [...fallingAll].sort((a,b) => a.yoy - b.yoy), [fallingAll]);

    const activeRows = tab === 'rising' ? topRising : topFalling;
    const safeLimit = Math.min(limit, activeRows.length);
    const top = activeRows.slice(0, safeLimit);

    // Seasonality type counts - filtered by category filter
    const typeRows = React.useMemo(() => {
      const typeCount = {};
      for (const k of filteredKws) {
        const t = sezTypeMap.get(k.kw + '|' + k.k1) || 'Bilinmiyor';
        typeCount[t] = (typeCount[t] || 0) + 1;
      }
      const order = ['Evergreen', 'Orta Mevsimsellik', 'Yüksek Mevsimsellik', 'Bilinmiyor'];
      const colorOf = t => t==='Evergreen'?'#2E7D32': t==='Orta Mevsimsellik'?'#F59E0B': t==='Yüksek Mevsimsellik' ? '#FF7B52' : '#B8B0A3';
      return order.filter(t => typeCount[t] > 0).map(t => ({ label:t, value:typeCount[t], color: colorOf(t) }));
    }, [filteredKws, sezTypeMap]);

    // Volume-quartile recomputed on the filtered set
    const quartileRows = React.useMemo(() => {
      const sorted = [...filteredKws].sort((a,b) => (b.a25||0) - (a.a25||0));
      const n = sorted.length;
      if (n === 0) return [];
      const labels = ['Head (En Yüksek 25%)','Üst Orta','Alt Orta','Tail (En Düşük 25%)'];
      const out = [];
      for (let i=0;i<4;i++) {
        const from = Math.floor((i*n)/4);
        const to = Math.floor(((i+1)*n)/4);
        const slice = sorted.slice(from, to);
        const total = slice.reduce((a,b)=>a+(b.a25||0),0) * 12;
        const total24 = slice.reduce((a,b)=>a+(b.a24||0),0) * 12;
        const yoy = total24 ? (total-total24)/total24 : 0;
        out.push({ quartile: labels[i], count: slice.length, total, yoy });
      }
      return out;
    }, [filteredKws]);

    // Category-level trend distribution (respects global filter via filteredKws)
    const perCat = React.useMemo(() => {
      let cats;
      if (trendCatLevel === 'kat1') {
        const uniq = new Map();
        for (const k of filteredKws) uniq.set(k.k1, {label:k.k1, k1:k.k1, sub:null});
        cats = [...uniq.values()];
      } else if (trendCatLevel === 'kat2') {
        const uniq = new Map();
        for (const k of filteredKws) {
          const key = k.k1+'>'+k.k2;
          if (!trendCatFilter.k1 || k.k1 === trendCatFilter.k1) {
            uniq.set(key, {label:k.k2, k1:k.k1, k2:k.k2, sub:k.k1});
          }
        }
        cats = [...uniq.values()];
      } else {
        const uniq = new Map();
        for (const k of filteredKws) {
          const key = k.k1+'>'+k.k2+'>'+k.k3;
          if ((!trendCatFilter.k1 || k.k1 === trendCatFilter.k1) && (!trendCatFilter.k2 || k.k2 === trendCatFilter.k2)) {
            uniq.set(key, {label:k.k3, k1:k.k1, k2:k.k2, k3:k.k3, sub:`${k.k1} > ${k.k2}`});
          }
        }
        cats = [...uniq.values()];
      }
      return cats.map(c => {
        const items = filteredKws.filter(x =>
          x.k1 === c.k1 &&
          (!c.k2 || x.k2 === c.k2) &&
          (!c.k3 || x.k3 === c.k3)
        );
        const ri = items.filter(x=>x.yoy>0.05).length;
        const fa = items.filter(x=>x.yoy<-0.05).length;
        const st = items.length - ri - fa;
        const totVol = items.reduce((a,b)=>a+(b.a25||0),0)*12;
        const totVol24 = items.reduce((a,b)=>a+(b.a24||0),0)*12;
        const yoy = totVol24 ? (totVol-totVol24)/totVol24 : 0;
        return {...c, rising:ri, stable:st, falling:fa, total:items.length, yoy, color:katColor(c.k1), totVol};
      }).filter(c => c.total > 0).sort((a,b) => b.total - a.total).slice(0, 20);
    }, [trendCatLevel, trendCatFilter, filteredKws]);

    // Sample percentile for "en çok artan / düşen" KPIs on filtered set
    const topChangedUp = topRising[0];
    const topChangedDown = topFalling[0];

    return h('div',null,
      (() => {
        // Dynamic YoY stats on the FILTERED set
        const nFil = filteredKws.length || 1;
        const avgYoY = filteredKws.reduce((a,b)=>a+(b.yoy||0),0) / nFil;
        const totVol25 = filteredKws.reduce((a,b)=>a+(b.a25||0),0) * 12;
        const totVol24 = filteredKws.reduce((a,b)=>a+(b.a24||0),0) * 12;
        const filYoY = totVol24 ? (totVol25-totVol24)/totVol24 : 0;
        return h('div',{className:'grid grid-kpi kpi-5', style:{marginBottom:18}},
          h(Kpi,{label:'Yükselen KW', value:fmtFull(risingAll.length), chip:'↑', chipClass:'pos', sub:'YoY > +5%', accent:true}),
          h(Kpi,{label:'Düşen KW', value:fmtFull(fallingAll.length), chip:'↓', chipClass:'neg', sub:'YoY < -5%'}),
          h(Kpi,{label:'Filtrelenen', value:fmtFull(filteredKws.length), chip: fmtPct(avgYoY,0), chipClass: trendClass(avgYoY), sub: 'ortalama YoY'}),
          h(Kpi,{label:'Filtrelenen YoY', value: fmtPct(filYoY,1), chip: filYoY>=0?'↑':'↓', chipClass: trendClass(filYoY), sub: 'hacim: ' + fmtNum(totVol25)}),
          h(Kpi,{label:'En Çok Artan', value: topChangedUp?.kw || '–', chip: topChangedUp ? fmtPct(topChangedUp.yoy, 0) : null, chipClass: topChangedUp ? 'pos' : 'neu', sub: topChangedUp ? '2025 ort. ' + fmtNum(topChangedUp.a25 || 0) : ''}),
          h(Kpi,{label:'En Çok Düşen', value: topChangedDown?.kw || '–', chip: topChangedDown ? fmtPct(topChangedDown.yoy, 0) : null, chipClass: topChangedDown ? 'neg' : 'neu', sub: topChangedDown ? '2025 ort. ' + fmtNum(topChangedDown.a25 || 0) : ''}),
        );
      })(),

      // === Yıldız Yükselişler (B3) ===
      // Filtrelenen evrende YoY >= 100% (2x) olan outlier'lar - olağanüstü
      // büyüyen keyword'ler için dikkat çeken compact strip.
      (() => {
        const stars = filteredKws
          .filter(k => k.yoy >= 1.0 && (k.a25 || 0) >= 100)  // min hacim 100/ay - gürültüyü keser
          .sort((a, b) => b.yoy - a.yoy)
          .slice(0, 8);
        if (stars.length === 0) return null;
        const topYoY = stars[0].yoy;
        return h('div',{className:'card card-stars', style:{marginBottom:18, position:'relative', overflow:'hidden'}},
          h('div',{className:'card-title-row', style:{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap'}},
            h('div',{style:{display:'flex', alignItems:'center', gap:10, minWidth:0}},
              h('span',{className:'stars-badge'}, I.Spark(18)),
              h('div',null,
                h('h3',{style:{margin:0}},'Yıldız Yükselişler',
                  h(InfoIcon,null,
                    h('strong',null,'Ne gösterir? '),'Filtrelenen keyword evreninde YoY ≥ %100 (yani 2 katı büyümüş) ve aylık ortalama ≥ 100 arama olan outlier\'lar.',
                    h('br'),h('br'),h('strong',null,'Ne için? '),'"Birden patlayan" sorguları öne çıkarır. Pazarda oluşan yeni bir ihtiyaç ya da kampanya/ürün dalgasına işaret edebilir - içerik stratejisi için hızlı fırsat kanalı.'
                  )
                ),
                h('div',{className:'txt-3', style:{fontSize:11, marginTop:2}}, stars.length, ' outlier · en yüksek ', h('strong',{style:{color:'var(--coral-deep)'}}, '+', fmtPct(topYoY, 0).replace('+','')))
              )
            ),
            h('span',{className:'hint'}, 'YoY ≥ +100% · min 100/ay')
          ),
          h('div',{className:'stars-grid'},
            stars.map((k, i) => {
              const peakIdx = k.m25.indexOf(Math.max(...k.m25));
              return h('button',{
                key: i, className:'star-item', onClick: () => setKeywordModal(k)
              },
                h('div',{className:'star-head'},
                  h('div',{style:{width:6, height:6, borderRadius:2, background: katColor(k.k1), flexShrink:0}}),
                  h('div',{className:'star-kw'}, k.kw),
                  h('span',{className:'star-yoy'}, '+', fmtPct(k.yoy, 0).replace('+',''))
                ),
                h('div',{className:'star-meta'},
                  h('span',{className:'star-cat'}, k.k1, k.k2 ? ' > ' + k.k2 : ''),
                  h('span',{className:'star-vol'}, fmtNum(k.a25), '/ay'),
                  h('span',{className:'star-peak'}, 'Peak: ', TR_MONTHS[peakIdx])
                ),
                h(Sparkline, {values: k.m25, w: 110, h: 22})
              );
            })
          )
        );
      })(),

      h('div',{className:'grid grid-main', style:{marginBottom:18}},
        h('div',{className:'card flush'},
          h('div',{className:'card-title-row', style:{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}},
            h('h3',null,'Top ' + safeLimit + ' ' + (tab==='rising'?'Yükselen':'Düşen'),
              h(InfoIcon,null,
                h('strong',null,'Ne gösterir? '),'Filtrelenen keyword evreninde YoY\'ye göre en çok artan veya düşen kelimeler.',h('br'),h('br'),
                h('strong',null,'Not: '), 'Gösterilen sayı filtrelenen havuzdaki yükselen/düşen keyword sayısını aşmaz; havuz küçükse seçilen Top N yerine mevcut sayı kullanılır.'
              )
            ),
            h('div',{style:{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}},
              h('div',{className:'segmented'},
                h('button',{className:tab==='rising'?'active':'', onClick:()=>setTab('rising')}, '↑ Yükselen (' + fmtFull(risingAll.length) + ')'),
                h('button',{className:tab==='falling'?'active':'', onClick:()=>setTab('falling')}, '↓ Düşen (' + fmtFull(fallingAll.length) + ')')
              ),
              h('select',{className:'select', value:limit, onChange:e=>setLimit(+e.target.value)},
                [10,20,50,100,500].map(n => h('option',{key:n,value:n}, 'Top '+n))
              )
            )
          ),
          h('div',{className:'tbl-wrap', style:{maxHeight:560, overflow:'auto'}},
            h('table',{className:'tbl'},
              h('thead',null,
                h('tr',null,
                  h('th',{style:{width:34}}, '#'),
                  h('th',null,'Keyword'),
                  h('th',null,'Kategori'),
                  h('th',{className:'num'}, '2025 ort.'),
                  h('th',{className:'num'}, 'YoY')
                )
              ),
              h('tbody',null,
                top.length === 0 && h('tr',null, h('td',{colSpan:5, className:'empty'}, tab==='rising' ? 'Filtreye uyan yükselen keyword yok' : 'Filtreye uyan düşen keyword yok')),
                top.map((r,i) => h('tr',{key:i, className:'clickable', onClick:()=>setKeywordModal(r)},
                  h('td',null, h('span',{className:'txt-3 num'}, (i+1))),
                  h('td',{className:'kw-cell'}, r.kw),
                  h('td',{style:{fontSize:11,color:'var(--ink-3)'}},
                    h('div',{style:{display:'flex',alignItems:'center',gap:5}},
                      h('div',{style:{width:7,height:7,borderRadius:2,background:katColor(r.k1),flexShrink:0}}),
                      h('span',null, r.k1 + (r.k2 ? ' > ' + r.k2 : ''))
                    )
                  ),
                  h('td',{className:'num'}, fmtFull(r.a25)),
                  h('td',null, h(YoYPill,{yoy:r.yoy}))
                ))
              )
            )
          )
        ),

        h('div',null,
          h('div',{className:'card', style:{marginBottom:18}},
            h('div',{className:'card-header'}, h('h3',null,'Mevsimsellik Tipi',
              h(InfoIcon,null,
                h('strong',null,'Evergreen'),': yıl boyu sabit hacim.',h('br'),
                h('strong',null,'Orta'),': peak var ancak taban hacim yüksek.',h('br'),
                h('strong',null,'Yüksek'),': keskin peak/dip - zamanlama kritik; kampanyanın peak ayına 4-6 hafta önceden hazırlanması önerilebilir.',h('br'),h('br'),
                h('strong',null,'Not: '),'Dağılım üstteki filtrelere göre güncellenir.'
              )
            )),
            typeRows.length === 0 ? h('div',{className:'empty'}, 'Filtreye uyan veri yok') :
            h('div',{style:{display:'flex',alignItems:'center',justifyContent:'center',marginBottom:10}},
              h(Donut,{size:160, data:typeRows})
            ),
            typeRows.length > 0 && h('div',{className:'legend',style:{flexDirection:'column',alignItems:'flex-start'}},
              typeRows.map(t => h('div',{key:t.label,className:'li',style:{width:'100%',justifyContent:'space-between'}},
                h('div',{style:{display:'flex',alignItems:'center',gap:6}},
                  h('div',{className:'swatch',style:{background:t.color}}),
                  h('span',null, t.label)
                ),
                h('span',{className:'num',style:{fontWeight:600}}, fmtFull(t.value))
              ))
            )
          ),
          h('div',{className:'card'},
            h('div',{className:'card-header'}, h('h3',null,'Hacim Quartile',
              h(InfoIcon,null,'Filtrelenen keywordler hacimlerine göre 4 eşit dilime bölünür. En üst %25 = en çok aranan kelimeler. Her dilim toplam hacmin ne kadarını tutuyor ve YoY\'si.'))),
            quartileRows.length === 0 ? h('div',{className:'empty'}, 'Veri yok') :
            h('div',{style:{display:'flex',flexDirection:'column',gap:12}},
              quartileRows.map((q,i) => h('div',{key:i},
                h('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:3,fontSize:12}},
                  h('span',{style:{fontWeight:600}}, q.quartile),
                  h('span',{className:'num'}, fmtFull(q.count), ' KW')
                ),
                h('div',{style:{display:'flex',gap:8,fontSize:11,color:'var(--ink-3)',flexWrap:'wrap'}},
                  h('span',null,'Vol: ', h('strong',{className:'num',style:{color:'var(--ink)'}}, fmtNum(q.total))),
                  h('span',null,'YoY: ', h(YoYPill,{yoy:q.yoy})),
                )
              ))
            )
          )
        )
      ),

      // Category trend distribution - with level selector
      h('div',{className:'card'},
        h('div',{className:'card-header',style:{flexWrap:'wrap',gap:8}},
          h('h3',{style:{flex:1,minWidth:160}},'Kategori Bazında Trend Dağılımı',
            h(InfoIcon,null,
              h('strong',null,'Ne gösterir? '),'Her kategorideki keywordlerin kaçı yükseliyor / stabil / düşüyor.',h('br'),h('br'),
              h('strong',null,'Nasıl okunur? '),h('span',{style:{color:'#2E7D32',fontWeight:600}},'Yeşil'),' = yükselen, gri = stabil, ',h('span',{style:{color:'#D32F2F',fontWeight:600}},'kırmızı'),' = düşen. Renkli segmente tıklanarak o kategorideki o trenddeki keywordlere filtreli şekilde inilebilir.',h('br'),h('br'),
              h('strong',null,'Ne için? '),'Hangi kategoride momentum var, hangisinde düşüş eğilimi görüldüğünü tespit etmek ve yatırım yönünü değerlendirmek için kullanılabilir.'
            )
          ),
          h('div',{className:'segmented'},
            h('button',{className:trendCatLevel==='kat1'?'active':'', onClick:()=>{setTrendCatLevel('kat1'); setTrendCatFilter({k1:'',k2:''});}}, 'Kat 1'),
            h('button',{className:trendCatLevel==='kat2'?'active':'', onClick:()=>setTrendCatLevel('kat2')}, 'Kat 2'),
            h('button',{className:trendCatLevel==='kat3'?'active':'', onClick:()=>setTrendCatLevel('kat3')}, 'Kat 3')
          )
        ),
        trendCatLevel !== 'kat1' && h('div',{style:{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}},
          h('select',{className:'select', value:trendCatFilter.k1, onChange:e=>setTrendCatFilter({k1:e.target.value,k2:''})},
            h('option',{value:''}, 'Tüm Kat 1'),
            D.kat1Summary.map(k => h('option',{key:k.k1, value:k.k1}, k.k1))
          ),
          trendCatLevel === 'kat3' && h('select',{className:'select', value:trendCatFilter.k2, onChange:e=>setTrendCatFilter({...trendCatFilter,k2:e.target.value})},
            h('option',{value:''}, 'Tüm Kat 2'),
            kat2InK1(trendCatFilter.k1).map(k => h('option',{key:k, value:k}, k))
          )
        ),
        h('div',{style:{display:'flex',flexDirection:'column',gap:10}},
          perCat.map(k => {
            const navTo = (trend) => onNavigateKw({k1:k.k1, k2:k.k2, k3:k.k3, trend});
            return h('div',{key:k.label + (k.sub || '')},
              h('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:12,gap:8,flexWrap:'wrap'}},
                h('div',{style:{minWidth:0}},
                  h('span',{style:{fontWeight:600}}, k.label),
                  k.sub && h('span',{className:'txt-3',style:{fontSize:10,marginLeft:6}}, k.sub),
                  h('span',{className:'txt-3',style:{marginLeft:8}}, fmtFull(k.total)+' KW')
                ),
                h('div',{style:{display:'flex',gap:4,alignItems:'center',flexShrink:0,flexWrap:'wrap'}},
                  h('span',{className:'pill pos',style:{cursor:'pointer'},onClick:()=>navTo('rising')}, '↑ '+k.rising),
                  h('span',{className:'pill neu',style:{cursor:'pointer'},onClick:()=>navTo('stable')}, '→ '+k.stable),
                  h('span',{className:'pill neg',style:{cursor:'pointer'},onClick:()=>navTo('falling')}, '↓ '+k.falling),
                  h('span',{style:{marginLeft:4}}, h(YoYPill,{yoy:k.yoy}))
                )
              ),
              h('div',{className:'q-stack'},
                k.rising>0 && h('div',{className:'seg', style:{width:(k.rising/k.total*100)+'%', background:'#2E7D32',cursor:'pointer'}, title:`Yükselen: ${k.rising} (tıklayarak keyword filtresine inilir)`, onClick:()=>navTo('rising')},
                  k.rising/k.total > 0.08 ? k.rising : ''),
                k.stable>0 && h('div',{className:'seg', style:{width:(k.stable/k.total*100)+'%', background:'#B8B0A3',cursor:'pointer'}, title:`Stabil: ${k.stable}`, onClick:()=>navTo('stable')},
                  k.stable/k.total > 0.08 ? k.stable : ''),
                k.falling>0 && h('div',{className:'seg', style:{width:(k.falling/k.total*100)+'%', background:'#D32F2F',cursor:'pointer'}, title:`Düşen: ${k.falling} (tıklayarak keyword filtresine inilir)`, onClick:()=>navTo('falling')},
                  k.falling/k.total > 0.08 ? k.falling : '')
              )
            );
          })
        )
      )
    );
  }


  // === Fiyat Tab ===
  function FiyatTab({setKeywordModal, globalFilter}) {
    const gK1Set = (globalFilter?.globalK1 || []).length ? new Set(globalFilter.globalK1) : null;
    const gK2Set = (globalFilter?.globalK2 || []).length ? new Set(globalFilter.globalK2) : null;
    const gK3Set = (globalFilter?.globalK3 || []).length ? new Set(globalFilter.globalK3) : null;
    const gBrandSet = (globalFilter?.globalBrand || []).length ? new Set(globalFilter.globalBrand) : null;
    const hasGlobal = gK1Set || gK2Set || gK3Set || gBrandSet;

    // Filter D.price by global filter (D.price items have k1/k2 but not brand; use keyword lookup for brand check)
    const kwByKw = React.useMemo(() => {
      const m = new Map();
      for (const k of D.keywords) m.set(k.kw, k);
      return m;
    }, []);

    const gK1Arr = globalFilter?.globalK1 || [];
    const gK2Arr = globalFilter?.globalK2 || [];
    const gK3Arr = globalFilter?.globalK3 || [];
    const gBrandArr = globalFilter?.globalBrand || [];
    const scopedPrice = React.useMemo(() => {
      if (!hasGlobal) return D.price;
      const k1S = gK1Arr.length ? new Set(gK1Arr) : null;
      const k2S = gK2Arr.length ? new Set(gK2Arr) : null;
      const k3S = gK3Arr.length ? new Set(gK3Arr) : null;
      const brS = gBrandArr.length ? new Set(gBrandArr) : null;
      return D.price.filter(p => {
        if (k1S && !k1S.has(p.k1)) return false;
        if (k2S && !k2S.has(p.k2)) return false;
        if (k3S) {
          const full = kwByKw.get(p.kw);
          if (!full || !k3S.has(full.k3)) return false;
        }
        if (brS) {
          const full = kwByKw.get(p.kw);
          if (!full || !brS.has(full.brand)) return false;
        }
        return true;
      });
    }, [gK1Arr, gK2Arr, gK3Arr, gBrandArr, kwByKw]);

    const sorted = [...scopedPrice].sort((a,b)=>b.a25-a.a25);
    const monthly = aggregateMonthly(scopedPrice.map(p => {
      const full = kwByKw.get(p.kw);
      return full || {m25:new Array(12).fill(p.a25)};
    }), 'm25');

    const priceTotal = scopedPrice.reduce((s,p)=>s+(p.a25||0),0) * 12;
    const priceTotal24 = scopedPrice.reduce((s,p)=>s+(p.a24||0),0) * 12;
    const priceYoy = priceTotal24 ? (priceTotal - priceTotal24) / priceTotal24 : 0;

    const byK1 = {};
    for (const p of scopedPrice) byK1[p.k1] = (byK1[p.k1]||0) + (p.a25||0)*12;
    const byK1Rows = Object.entries(byK1).map(([k,v]) => ({label:k, value:v, color:katColor(k)})).sort((a,b)=>b.value-a.value);

    return h('div',null,
      h('div',{className:'grid grid-kpi kpi-5', style:{marginBottom:18}},
        h(Kpi,{label:'Fiyat Intent Hacmi', value:fmtNum(priceTotal), chip:fmtPct(priceYoy), chipClass:trendClass(priceYoy), sub: hasGlobal ? 'filtreli · 2025' : '2025 · dönüşüm sinyali', accent:true}),
        h(Kpi,{label:'Fiyat KW', value:fmtNum(scopedPrice.length)}),
        h(Kpi,{label:'Pazar İçi Pay', value: TOTAL_2025 ? (priceTotal/TOTAL_2025*100).toFixed(1).replace('.',',')+'%' : '—', sub:'toplam aramanın'}),
        h(Kpi,{label:'Peak Ay', value: monthly.reduce((s,v)=>s+v,0) > 0 ? TR_MONTHS[monthly.indexOf(Math.max(...monthly))] : '-'}),
      ),
      h('div',{className:'insight-strip'},
        h('span',{className:'arrow'}, I.ArrowRight(14)),
        h('div',null,'"Fiyat", "ne kadar", "ucuz" gibi satın alma niyeti (purchase intent) keywordleri. Bu keywordlerde sıralama & direkt dönüşüm sinyali.')
      ),
      h('div',{className:'grid grid-main', style:{marginBottom:18}},
        h('div',{className:'card flush'},
          h('div',{className:'card-title-row', style:{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}},
            h('h3',{style:{flex:1}}, 'Fiyat Intent Keywordleri',
              h(InfoIcon,null,h('strong',null,'Ne? '),'İçinde fiyat/ne kadar/ucuz/maliyet geçen kelimeler. Bu tür kelimeler direkt satın alma niyeti gösterir - organik sıralama burada dönüşüme en yakın olanıdır.')
            ),
            h(CopyButton, {
              getData: () => ({
                headers: ['Keyword','Marka','Kat 1','Kat 2','2024 Avg','2025 Avg','YoY %','Peak Ay'],
                rows: sorted.map(r => {
                  const full = kwByKw.get(r.kw) || {};
                  const mi = serialToMonthIdx(r.peakMonth);
                  return [r.kw, full.brand||'', r.k1, r.k2, r.a24, r.a25, (r.yoy*100).toFixed(2)+'%', mi!=null ? TR_MONTHS[mi] : ''];
                })
              })
            })
          ),
          h('div',{className:'tbl-wrap'},
            h('table',{className:'tbl'},
              h('thead',null,
                h('tr',null,
                  h('th',null,'Keyword'),
                  h('th',null,'Marka'),
                  h('th',null,'Kategori'),
                  h('th',{className:'num'},'2025'),
                  h('th',{className:'num'},'YoY'),
                  h('th',null,'Peak')
                )
              ),
              h('tbody',null,
                sorted.length === 0 && h('tr',null, h('td',{colSpan:6, className:'empty'}, 'Filtreye uyan fiyat intent keyword yok')),
                sorted.map((r,i) => {
                  const mi = serialToMonthIdx(r.peakMonth);
                  const full = kwByKw.get(r.kw);
                  const brand = full?.brand || '';
                  return h('tr',{key:i, className:'clickable', onClick:()=>full && setKeywordModal(full)},
                    h('td',{className:'kw-cell'}, r.kw),
                    h('td',{style:{fontSize:11, fontWeight: brand ? 500 : 400, color: brand ? 'var(--ink)' : 'var(--ink-3)'}}, brand || '—'),
                    h('td',{style:{fontSize:11,color:'var(--ink-2)'}}, r.k1),
                    h('td',{className:'num', title: fmtFull(r.a25)}, fmtNum(r.a25)),
                    h('td',{className:'num'}, h(YoYPill,{yoy:r.yoy})),
                    h('td',null, mi!=null ? h('span',{className:'pill neu'}, TR_MONTHS[mi]) : '-')
                  );
                })
              )
            )
          )
        ),
        h('div',null,
          h('div',{className:'card',style:{marginBottom:18}},
            h('div',{className:'card-header'},h('h3',null,'Aylık Dağılım')),
            h(LineChart,{series:[{name:'Fiyat Intent', values:monthly, color:'#FF7B52', peakIdx:monthly.indexOf(Math.max(...monthly))}], height:200})
          ),
          h('div',{className:'card'},
            h('div',{className:'card-header'}, h('h3',null,'Kategori Bazında')),
            h(ShareBars,{rows: byK1Rows})
          )
        )
      )
    );
  }

  // === Out-of-Catalog Tab — Özdilekte Olmayan Markalar ===
  function OutOfCatalogTab({setKeywordModal, onNavigateKw, onNavigateBrand, globalFilter}) {
    const OUT = D.outKeywords || [];

    const [q, setQ] = React.useState('');
    const [sort, setSort] = React.useState({k:'a25', d:-1});
    const [brandSort, setBrandSort] = React.useState({k:'sum25', d:-1});
    const [brandQ, setBrandQ] = React.useState('');
    const [expandedBrands, setExpandedBrands] = React.useState(() => new Set());
    const [page, setPage] = React.useState(0);
    const [brandPage, setBrandPage] = React.useState(0);
    const perPage = 50;
    const brandsPerPage = 25;

    const toggleExpand = (b) => {
      setExpandedBrands(prev => {
        const next = new Set(prev);
        if (next.has(b)) next.delete(b); else next.add(b);
        return next;
      });
    };

    // Scope = all OUT filtered by global filter (tab-level filters removed)
    const scopedKws = React.useMemo(() =>
      applyGlobalFilter(OUT, globalFilter)
    , [globalFilter]);

    // Aggregates (filter-aware)
    const agg = React.useMemo(() => {
      const total25 = scopedKws.reduce((s,k) => s + (k.a25 || 0) * 12, 0);
      const total24 = scopedKws.reduce((s,k) => s + (k.a24 || 0) * 12, 0);
      const yoy = total24 ? (total25 - total24) / total24 : 0;
      const monthly25 = aggregateMonthly(scopedKws, 'm25');
      const monthly24 = aggregateMonthly(scopedKws, 'm24');
      const peakIdx = monthly25.indexOf(Math.max(...monthly25));
      const rising = scopedKws.filter(k => k.yoy > 0.05).length;
      const falling = scopedKws.filter(k => k.yoy < -0.05).length;
      const brands = new Set(scopedKws.map(k => k.brand).filter(Boolean)).size;
      return { total25, total24, yoy, monthly25, monthly24, peakIdx, rising, falling, brands, count: scopedKws.length };
    }, [scopedKws]);

    // Kategori Dağılımı (Kat 1 — brand-aware)
    const byK1 = React.useMemo(() => {
      const m = {};
      for (const k of scopedKws) m[k.k1] = (m[k.k1] || 0) + (k.a25 || 0) * 12;
      return Object.entries(m).map(([k,v]) => ({label:k, value:v, color:katColor(k)})).sort((a,b)=>b.value-a.value);
    }, [scopedKws]);

    // NEW: Alt Kategori Dağılımı (Kat 2 — 12-aylık trendin altında gösterilir)
    const byK2 = React.useMemo(() => {
      const m = {};
      for (const k of scopedKws) {
        const key = k.k2 || '(boş)';
        m[key] = (m[key] || 0) + (k.a25 || 0) * 12;
      }
      return Object.entries(m).map(([k,v]) => ({label:k, value:v, color:'var(--coral)'})).sort((a,b)=>b.value-a.value).slice(0, 10);
    }, [scopedKws]);

    // All brands (from scoped keywords)
    const allBrands = React.useMemo(() => {
      const m = {};
      for (const k of scopedKws) {
        if (!k.brand) continue;
        const key = k.brand;
        if (!m[key]) m[key] = {
          brand: key, count: 0, sum24: 0, sum25: 0,
          m24: new Array(12).fill(0), m25: new Array(12).fill(0),
          k1vol: {}, k2vol: {}, kws: []
        };
        const b = m[key];
        b.count += 1;
        b.sum24 += (k.a24 || 0) * 12;
        b.sum25 += (k.a25 || 0) * 12;
        for (let i = 0; i < 12; i++) {
          b.m24[i] += k.m24[i] || 0;
          b.m25[i] += k.m25[i] || 0;
        }
        b.k1vol[k.k1] = (b.k1vol[k.k1] || 0) + (k.a25 || 0) * 12;
        const k2key = k.k2 || '(boş)';
        if (!b.k2vol[k2key]) b.k2vol[k2key] = { vol: 0, count: 0, sum24: 0, sum25: 0, m25: new Array(12).fill(0), yoyNum: 0, yoyDen: 0, kws: [] };
        b.k2vol[k2key].vol += (k.a25 || 0) * 12;
        b.k2vol[k2key].count += 1;
        b.k2vol[k2key].sum24 += (k.a24 || 0) * 12;
        b.k2vol[k2key].sum25 += (k.a25 || 0) * 12;
        for (let i = 0; i < 12; i++) b.k2vol[k2key].m25[i] += k.m25[i] || 0;
        b.k2vol[k2key].kws.push(k);
        b.kws.push(k);
      }
      return Object.values(m).map(b => {
        const yoy = b.sum24 ? (b.sum25 - b.sum24) / b.sum24 : 0;
        const peakI = b.m25.indexOf(Math.max(...b.m25));
        const topK1Entries = Object.entries(b.k1vol).sort((a,b) => b[1] - a[1]);
        const topK1 = topK1Entries[0]?.[0] || '';
        const topK1Share = b.sum25 && topK1Entries[0] ? topK1Entries[0][1] / b.sum25 : 0;
        // Build k2 rows sorted
        const k2Rows = Object.entries(b.k2vol).map(([k2, v]) => ({
          k2,
          count: v.count,
          sum24: v.sum24,
          sum25: v.sum25,
          yoy: v.sum24 ? (v.sum25 - v.sum24) / v.sum24 : 0,
          m25: v.m25,
          topKws: [...v.kws].sort((a,b) => (b.a25||0) - (a.a25||0)).slice(0, 3)
        })).sort((a,b) => b.sum25 - a.sum25);
        return { ...b, yoy, peakI, topK1, topK1Share, k2Rows };
      });
    }, [scopedKws]);

    const brandRows = React.useMemo(() => {
      let rows = allBrands;
      const qq = brandQ.trim().toLowerCase();
      if (qq) rows = rows.filter(r => r.brand.toLowerCase().includes(qq));
      const s = brandSort.k, d = brandSort.d;
      rows = [...rows].sort((a,b) => {
        const av = a[s], bv = b[s];
        if (typeof av === 'string') return av.localeCompare(bv || '', 'tr') * d;
        if (av == null) return 1; if (bv == null) return -1;
        return (av > bv ? 1 : av < bv ? -1 : 0) * d;
      });
      return rows;
    }, [allBrands, brandQ, brandSort]);

    React.useEffect(() => setBrandPage(0), [brandQ, brandSort, scopedKws]);
    const brandPageRows = brandRows.slice(brandPage*brandsPerPage, (brandPage+1)*brandsPerPage);
    const brandTotalPages = Math.ceil(brandRows.length/brandsPerPage);

    // Keyword filter (tab-level search)
    const filtered = React.useMemo(() => {
      let rows = scopedKws;
      const qq = q.trim().toLowerCase();
      if (qq) rows = rows.filter(r => r.kw.toLowerCase().includes(qq));
      const s = sort.k, d = sort.d;
      rows = [...rows].sort((a,b) => {
        const av = a[s], bv = b[s];
        if (av == null) return 1; if (bv == null) return -1;
        return (av > bv ? 1 : av < bv ? -1 : 0) * d;
      });
      return rows;
    }, [scopedKws, q, sort]);

    React.useEffect(() => setPage(0), [q, scopedKws]);
    const pageRows = filtered.slice(page*perPage, (page+1)*perPage);
    const totalPages = Math.ceil(filtered.length/perPage);

    const th = (label, k, numCol=false) => h('th', {
      className:numCol?'num':'',
      style:{cursor:'pointer', userSelect:'none'},
      onClick:()=>setSort({k, d: sort.k===k ? -sort.d : -1})
    }, label, sort.k===k ? (sort.d>0?' ↑':' ↓') : '');

    const bth = (label, k, numCol=false) => h('th', {
      className:numCol?'num':'',
      style:{cursor:'pointer', userSelect:'none'},
      onClick:()=>setBrandSort({k, d: brandSort.k===k ? -brandSort.d : -1})
    }, label, brandSort.k===k ? (brandSort.d>0?' ↑':' ↓') : '');

    const gBrand = globalFilter?.globalBrand || [];
    const hasFilterActive = !!globalFilter?.hasGlobalFilter;
    const singleBrand = gBrand.length === 1 ? gBrand[0] : null;

    return h('div',null,
      h(SectionHeader, {
        accent:'coral',
        icon: h('svg',{width:22,height:22,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'},
          h('circle',{cx:12,cy:12,r:10}), h('line',{x1:4.93,y1:4.93,x2:19.07,y2:19.07})
        ),
        title:'Özdilekte Olmayan Markalar',
        desc: hasFilterActive
          ? `Filtre aktif · ${fmtNum(scopedKws.length)} keyword · ${fmtNum(agg.brands)} marka · ${fmtNum(agg.total25)} 2025 hacim`
          : `Özdilek portföyünde bulunmayan markalara ait ${fmtNum(OUT.length)} keyword. Pazar payı fırsatı ve marka genişleme potansiyeli analizi.`
      }),

      // KPI strip (filter-aware)
      h('div',{className:'grid grid-kpi kpi-5', style:{marginBottom:18}},
        h(Kpi,{
          label: singleBrand ? 'Seçili Marka Hacmi' : (hasFilterActive ? 'Filtreli 2025 Hacim' : 'Toplam 2025 Hacim'),
          value: fmtNum(agg.total25),
          chip: fmtPct(agg.yoy), chipClass: trendClass(agg.yoy),
          sub: `${fmtNum(agg.count)} KW`, accent: true
        }),
        h(Kpi,{label:'Marka Sayısı', value:fmtNum(agg.brands), sub: singleBrand ? 'seçili' : 'farklı marka'}),
        h(Kpi,{label:'Yükselen', value:fmtNum(agg.rising), chip:'↑', chipClass:'pos', sub:'YoY > +5%'}),
        h(Kpi,{label:'Düşen', value:fmtNum(agg.falling), chip:'↓', chipClass:'neg', sub:'YoY < -5%'}),
        h(Kpi,{
          label:'Peak Ay',
          value: agg.peakIdx >= 0 ? TR_MONTHS_LONG[agg.peakIdx] : '-',
          sub: agg.peakIdx >= 0 ? fmtNum(agg.monthly25[agg.peakIdx]) + ' arama' : ''
        }),
      ),

      // Grid-main: left column (12 aylık trend), right column (drill-down Kategori Pazar Payı)
      h('div',{className:'grid grid-main', style:{marginBottom:18}},
        h('div',{className:'card'},
          h('div',{className:'card-header'}, h('h3',null,
            singleBrand ? `12 Aylık Trend · ${singleBrand}` : '12 Aylık Hacim Trendi',
            h(InfoIcon,null, singleBrand
              ? `${singleBrand} markasının aylık toplam arama hacmi. Gri: 2024, coral: 2025.`
              : 'Özdilekte olmayan markaların aylık arama hacmi. Gri: 2024, coral: 2025. Filtreye göre dinamik güncellenir.'
            )
          )),
          agg.total25 > 0
            ? h(LineChart,{series:[
                {name:'2024', values:agg.monthly24, color:'#8A8A8A'},
                {name:'2025', values:agg.monthly25, color:'#FF7B52', peakIdx:agg.peakIdx}
              ], legend:true, height:260})
            : h('div',{className:'empty', style:{padding:30}}, 'Veri yok')
        ),
        // Kategori Pazar Payı — drill-down (Kat1→Kat2→Kat3), global filter ile entegre
        (() => {
          const gK1 = globalFilter?.globalK1 || [];
          const gK2 = globalFilter?.globalK2 || [];
          let level = 'k1';
          if (gK2.length >= 1) level = 'k3';
          else if (gK1.length >= 1) level = 'k2';
          const title = level === 'k1' ? 'Kategori Pazar Payı (Kat 1)'
            : level === 'k2' ? `Alt Kategori Pazar Payı (Kat 2) · ${gK1.join(', ')}`
            : `Alt Alt Kategori Pazar Payı (Kat 3) · ${gK2.join(', ')}`;
          // Compute share for current level from scopedKws (filter-aware)
          const m = {};
          for (const k of scopedKws) {
            const key = level === 'k1' ? k.k1 : level === 'k2' ? k.k2 : k.k3;
            if (!key) continue;
            m[key] = (m[key] || 0) + (k.a25 || 0);  // monthly avg per keyword sum = level's monthly avg
          }
          const totalAvg = Object.values(m).reduce((s,v)=>s+v,0);
          const rows = Object.entries(m)
            .map(([label, value]) => ({
              label, value,
              share: totalAvg ? value/totalAvg : 0,
              color: level === 'k1' ? katColor(label) : (level === 'k2' ? 'var(--coral)' : 'var(--teal)')
            }))
            .sort((a,b) => b.value - a.value);
          const activeState = level === 'k1' ? gK1 : level === 'k2' ? gK2 : (globalFilter?.globalK3 || []);
          const setter = level === 'k1' ? globalFilter?.setGlobalK1 : level === 'k2' ? globalFilter?.setGlobalK2 : globalFilter?.setGlobalK3;
          const onClickRow = setter ? (label) => {
            const cur = activeState;
            if (cur.includes(label)) setter(cur.filter(x => x !== label));
            else setter([...cur, label]);
          } : undefined;
          const copyData = () => ({
            headers: ['Kategori', 'Avg Hacim', 'Pazar Payı %'],
            rows: rows.map(r => [r.label, r.value, (r.share*100).toFixed(2)+'%'])
          });
          return h('div',{className:'card'},
            h('div',{className:'card-header', style:{display:'flex',alignItems:'center',gap:10, flexWrap:'wrap'}},
              h('h3',{style:{flex:1,minWidth:180}}, title,
                h(InfoIcon,null,
                  h('strong',null,'Drill-down: '),'Kat 1 → tıkla (filtre ekler) → aynı alan Kat 2 dağılımına döner. Kat 2 → Kat 3. Filter chip ile geri açılır.',
                  h('br'),h('br'),h('strong',null,'Ne gösterir? '),'Seçili seviyedeki kategori/alt-kategorilerin aylık ortalama arama hacmi ve pazar payı yüzdesi.'
                )
              ),
              h(CopyButton, {getData: copyData})
            ),
            rows.length > 0
              ? h('div',{style:{maxHeight:360, overflow:'auto'}}, h(ShareBars,{
                  rows,
                  activeLabels: activeState,
                  onClickRow
                }))
              : h('div',{className:'empty', style:{padding:30}}, 'Veri yok')
          );
        })()
      ),

      // === Yıldız Markalar + Eriyen Markalar (side-by-side stripe) ===
      (() => {
        const withVol = allBrands.filter(b => b.sum25 >= 50_000);  // anlamlılık için min ~50k/yıl
        const rising = [...withVol].filter(b => b.yoy >= 0.25).sort((a,b) => b.yoy - a.yoy).slice(0, 6);
        const falling = [...withVol].filter(b => b.yoy <= -0.25).sort((a,b) => a.yoy - b.yoy).slice(0, 6);
        if (rising.length === 0 && falling.length === 0) return null;
        const renderList = (items, accent, emptyMsg, label, desc) => h('div',{
          className:'card', style:{minWidth:0, borderLeft:`3px solid ${accent}`}
        },
          h('div',{className:'card-header'}, h('h3',null, label,
            h(InfoIcon,null,desc)
          )),
          items.length === 0
            ? h('div',{className:'empty', style:{padding:20}}, emptyMsg)
            : h('div',{style:{display:'flex', flexDirection:'column', gap:8, padding:'10px 14px 14px'}},
                items.map((b, i) => h('button',{
                  key:i, className:'star-item clickable',
                  onClick:()=>toggleExpand(b.brand),
                  style:{
                    width:'100%', textAlign:'left', padding:'10px 12px',
                    background:'var(--bg)', border:'1px solid var(--line)', borderRadius:8,
                    cursor:'pointer', display:'flex', flexDirection:'column', gap:4
                  }
                },
                  h('div',{style:{display:'flex',alignItems:'center',gap:8}},
                    h('span',{style:{fontSize:11, color:'var(--ink-3)', fontWeight:500, minWidth:14}}, (i+1)+'.'),
                    h('strong',{style:{flex:1, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}, b.brand),
                    h('span',{
                      className:'pill ' + (b.yoy > 0 ? 'pos' : 'neg'),
                      style:{fontSize:11, fontWeight:700, padding:'2px 7px'}
                    }, (b.yoy > 0 ? '↑ +' : '↓ ') + fmtPct(b.yoy, 0).replace(/[+-]/,''))
                  ),
                  h('div',{style:{display:'flex',alignItems:'center',gap:10,fontSize:11,color:'var(--ink-3)', flexWrap:'wrap'}},
                    h('span',{title: fmtFull(toMonthlyAvg(b.sum25)) + ' /ay'}, fmtNum(toMonthlyAvg(b.sum25)), ' /ay 2025'),
                    h('span',{style:{width:3,height:3,borderRadius:'50%',background:'var(--ink-3)',opacity:.5}}),
                    h('span',null, b.count, ' KW'),
                    h('span',{style:{width:3,height:3,borderRadius:'50%',background:'var(--ink-3)',opacity:.5}}),
                    h('span',{style:{display:'flex',alignItems:'center',gap:4}},
                      h('div',{style:{width:7,height:7,borderRadius:2,background:katColor(b.topK1),flexShrink:0}}),
                      b.topK1
                    )
                  ),
                  h(Sparkline, {values: b.m25, w: 260, h: 22})
                ))
              )
        );
        return h('div',{className:'grid grid-2', style:{marginBottom:18, gap:14}},
          renderList(rising, 'var(--green)', 'Yükselen marka yok', '⭐ Yıldız Markalar', 'YoY ≥ +%25 büyüyen & yıllık hacmi ≥ 50K olan markalar. Portföy dışı olan bu markalar en yüksek büyüme ivmesiyle pazar fırsatı sinyali veriyor.'),
          renderList(falling, 'var(--red)', 'Düşen marka yok', '📉 Eriyen Markalar', 'YoY ≤ -%25 küçülen markalar. Pazardaki ilginin azaldığı markalar — portföye alınması halinde risk oluşturabilir.')
        );
      })(),

      // Tüm Markalar (all brands, sortable, paginated, expandable)
      h('div',{className:'card flush', style:{marginBottom:18}},
        h('div',{className:'card-title-row', style:{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}},
          h('h3',{style:{flex:1,minWidth:200}},
            'Tüm Markalar · Detaylı Analiz',
            h(InfoIcon,null,
              h('strong',null,'Ne gösterir? '),'Özdilek portföyünde bulunmayan markaların keyword sayısı, 2024/2025 hacim, YoY, peak ay ve ana kategori bilgisi.',
              h('br'),h('br'),h('strong',null,'Nasıl kullanılır? '),'Satıra tıkla → alt kategori (Kat 2) kırılımı pivot gibi açılır. Başlıklara tıklayarak sırala. Üstten Marka filtresi ile birden fazla marka seçilebilir.'
            ),
            h('span',{className:'txt-3', style:{fontSize:11, marginLeft:8}}, fmtNum(brandRows.length)+' marka')
          ),
          h('input',{
            className:'input input-search', placeholder:'Marka ara…',
            value:brandQ, onChange:e=>setBrandQ(e.target.value),
            style:{width:200}
          }),
          h(CopyButton, {
            getData: () => {
              const hdr = ['#', 'Marka', 'KW', '2024 Avg', '2025 Avg', 'YoY %', 'Peak Ay', 'Ana Kategori', 'Kat Payı %'];
              const rows = [];
              brandRows.forEach((b, i) => {
                rows.push([
                  i+1, b.brand, b.count,
                  toMonthlyAvg(b.sum24), toMonthlyAvg(b.sum25),
                  (b.yoy*100).toFixed(2)+'%',
                  b.peakI >= 0 ? TR_MONTHS[b.peakI] : '',
                  b.topK1,
                  (b.topK1Share*100).toFixed(1)+'%'
                ]);
                // If expanded, include Kat 2 sub-rows (indented)
                if (expandedBrands.has(b.brand) && b.k2Rows) {
                  b.k2Rows.forEach(r => {
                    rows.push({indent:1, cells:[
                      '', '↳ ' + r.k2, r.count,
                      toMonthlyAvg(r.sum24), toMonthlyAvg(r.sum25),
                      (r.yoy*100).toFixed(2)+'%',
                      '', '', ''
                    ]});
                  });
                }
              });
              return { headers: hdr, rows };
            }
          }),
          h('button',{
            className:'chip-btn', style:{padding:'6px 12px',borderRadius:999},
            onClick:()=>{
              const csv = toCSV(brandRows, [
                {label:'Marka',key:'brand'},
                {label:'KW Sayısı',key:'count'},
                {label:'2024 Avg', get:r=>toMonthlyAvg(r.sum24)},
                {label:'2025 Avg', get:r=>toMonthlyAvg(r.sum25)},
                {label:'YoY',key:'yoy'},
                {label:'Peak Ay', get:r => r.peakI >= 0 ? TR_MONTHS[r.peakI] : ''},
                {label:'Ana Kategori',key:'topK1'},
                {label:'Kat Payı %', get:r => (r.topK1Share*100).toFixed(1)},
              ]);
              downloadCSV(`${BRAND_SLUG}-out-brands.csv`, csv);
            }
          }, '↓ CSV')
        ),
        h('div',{className:'tbl-wrap', style:{maxHeight:600, overflow:'auto'}},
          h('table',{className:'tbl'},
            h('thead',null, h('tr',null,
              h('th',{style:{width:26}}, ''),
              h('th',null,'#'),
              bth('Marka','brand'),
              bth('KW','count',true),
              bth('2024 Avg','sum24',true),
              bth('2025 Avg','sum25',true),
              bth('YoY','yoy',true),
              h('th',null,'12 Ay'),
              bth('Peak Ay','peakI'),
              bth('Ana Kategori','topK1'),
              h('th',{className:'num'},'Kat Payı')
            )),
            h('tbody',null,
              brandRows.length === 0 && h('tr',null, h('td',{colSpan:11, className:'empty'}, 'Sonuç bulunamadı')),
              brandRows.flatMap((b,i) => {
                const isOpen = expandedBrands.has(b.brand);
                const mainRow = h('tr',{key:'b'+i, className:'clickable', onClick:()=>toggleExpand(b.brand)},
                  h('td',{style:{width:26, color:'var(--ink-3)', fontSize:10, textAlign:'center'}}, isOpen ? '▾' : '▸'),
                  h('td',{style:{width:40, color:'var(--ink-3)', fontSize:11}}, i + 1),
                  h('td',null, h('strong',null, b.brand)),
                  h('td',{className:'num'}, fmtNum(b.count)),
                  h('td',{className:'num', title:fmtFull(toMonthlyAvg(b.sum24))}, fmtNum(toMonthlyAvg(b.sum24))),
                  h('td',{className:'num', title:fmtFull(toMonthlyAvg(b.sum25))}, fmtNum(toMonthlyAvg(b.sum25))),
                  h('td',{className:'num'}, h(YoYPill,{yoy:b.yoy})),
                  h('td',{style:{width:130}},
                    h('div',{style:{display:'flex',alignItems:'center',gap:6}},
                      h(Sparkline,{values:b.m25, w:90, h:26}),
                      (() => { const arr = recentTrendArrow(b.m25); return arr ? h('span',{
                        title: arr.title,
                        style:{fontSize:14, fontWeight:700, color: arr.color, lineHeight:1}
                      }, arr.char) : null; })()
                    )
                  ),
                  h('td',null, b.peakI >= 0 ? h('span',{className:'pill neu'}, TR_MONTHS[b.peakI]) : '-'),
                  h('td',{style:{fontSize:11}},
                    h('div',{style:{display:'flex',alignItems:'center',gap:5}},
                      h('div',{style:{width:7,height:7,borderRadius:2,background:katColor(b.topK1),flexShrink:0}}),
                      h('span',null, b.topK1)
                    )
                  ),
                  h('td',{className:'num', style:{fontSize:11}}, (b.topK1Share*100).toFixed(0)+'%')
                );

                if (!isOpen) return [mainRow];

                // Expanded: sub-table showing Kat 2 breakdown + top keywords for each
                const subRow = h('tr',{key:'s'+i},
                  h('td',{colSpan:11, style:{padding:0, background:'var(--line-soft)'}},
                    h('div',{style:{padding:'12px 16px 14px'}},
                      h('div',{style:{display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:8}},
                        h('div',{style:{fontSize:11, color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700}},
                          `${b.brand} · Alt Kategori Kırılımı (${b.k2Rows.length} Kat 2)`
                        ),
                        onNavigateBrand && h('button',{
                          className:'chip-btn',
                          style:{padding:'4px 10px', borderRadius:999, fontSize:11, cursor:'pointer'},
                          onClick: (e) => {
                            e.stopPropagation();
                            onNavigateBrand(b.brand, b.catalog);
                          },
                          title: b.catalog === 'Yok' ? 'Özdilekte Olmayan Markalar tab\'ında aç' : 'Keyword tab\'ında aç'
                        }, (b.catalog === 'Yok' ? 'Özdilekte Olmayan Markalar tab\'ında aç →' : 'Keyword tab\'ında aç →'))
                      ),
                      h('table',{className:'tbl', style:{background:'var(--bg-card)', marginBottom:0}},
                        h('thead',null, h('tr',null,
                          h('th',null,'Kat 2'),
                          h('th',{className:'num'},'KW'),
                          h('th',{className:'num'},'2024 Avg'),
                          h('th',{className:'num'},'2025 Avg'),
                          h('th',{className:'num'},'YoY'),
                          h('th',null,'12 Ay'),
                          h('th',null,'Top Keyword\'ler')
                        )),
                        h('tbody',null,
                          b.k2Rows.map((r, ri) => h('tr',{key:ri},
                            h('td',null, h('strong',null, r.k2)),
                            h('td',{className:'num'}, fmtNum(r.count)),
                            h('td',{className:'num', title: fmtFull(toMonthlyAvg(r.sum24))}, fmtNum(toMonthlyAvg(r.sum24))),
                            h('td',{className:'num', title: fmtFull(toMonthlyAvg(r.sum25))}, fmtNum(toMonthlyAvg(r.sum25))),
                            h('td',{className:'num'}, h(YoYPill,{yoy:r.yoy})),
                            h('td',{style:{width:110}}, h(Sparkline,{values:r.m25, w:100, h:26})),
                            h('td',{style:{fontSize:11, color:'var(--ink-2)'}},
                              r.topKws.map((k, ki) => h('span',{
                                key:ki, className:'clickable',
                                onClick:(e)=>{ e.stopPropagation(); setKeywordModal(k); },
                                style:{
                                  display:'inline-block', marginRight:6, marginBottom:2,
                                  padding:'2px 7px', background:'var(--bg)',
                                  border:'1px solid var(--line)', borderRadius:12,
                                  fontSize:11, cursor:'pointer'
                                }
                              }, k.kw, h('span',{style:{color:'var(--ink-3)',marginLeft:4,fontSize:10}}, fmtNum(k.a25))))
                            )
                          ))
                        )
                      )
                    )
                  )
                );
                return [mainRow, subRow];
              })
            )
          )
        ),
        h('div',{style:{padding:'8px 14px', borderTop:'1px solid var(--line)', fontSize:11, color:'var(--ink-3)', display:'flex', alignItems:'center', justifyContent:'space-between'}},
          h('span',null, fmtNum(brandRows.length) + ' marka · scrollable (tek sayfa)'),
          brandRows.length > 0 && h('span',{className:'txt-3'}, 'Satıra tıkla → alt kategori kırılımı açılır')
        )
      ),

      // Keyword table (filtrelerle sınırlı)
      h('div',{className:'toolbar'},
        h('input',{className:'input input-search', placeholder:'Keyword ara…', value:q, onChange:e=>setQ(e.target.value), style:{flex:1, minWidth:200}}),
        h('span',{className:'txt-3', style:{fontSize:12}}, fmtNum(filtered.length)+' keyword'),
        h(CopyButton, {
          getData: () => ({
            headers: ['Keyword','Marka','Kat 1','Kat 2','Kat 3','2024 Avg','2025 Avg','YoY %','Peak Ay'],
            rows: filtered.map(r => [
              r.kw, r.brand||'', r.k1, r.k2, r.k3,
              r.a24, r.a25, (r.yoy*100).toFixed(2)+'%',
              r.m25 ? TR_MONTHS[r.m25.indexOf(Math.max(...r.m25))] : ''
            ])
          })
        }),
        h('button',{className:'chip-btn', style:{padding:'6px 12px',borderRadius:999}, onClick:()=>{
          const csv = toCSV(filtered, [
            {label:'Keyword',key:'kw'}, {label:'Marka',key:'brand'}, {label:'Kat 1',key:'k1'}, {label:'Kat 2',key:'k2'}, {label:'Kat 3',key:'k3'},
            {label:'2024 Avg',key:'a24'}, {label:'2025 Avg',key:'a25'}, {label:'YoY',key:'yoy'},
            ...TR_MONTHS.map((m,i)=>({label:m+' 2025', get:r=>r.m25[i]}))
          ]);
          downloadCSV(`${BRAND_SLUG}-out-of-catalog.csv`, csv);
        }}, '↓ CSV'),
      ),

      h('div',{className:'card flush'},
        h('div',{className:'tbl-wrap'},
          h('table',{className:'tbl'},
            h('thead',null, h('tr',null,
              th('Keyword','kw'),
              th('Marka','brand'),
              th('Kat 1','k1'),
              th('Kat 2','k2'),
              th('2024','a24',true),
              th('2025','a25',true),
              th('YoY','yoy',true),
              h('th',null,'12 Ay'),
              h('th',null,'Peak')
            )),
            h('tbody',null,
              pageRows.length === 0 && h('tr',null, h('td',{colSpan:9, className:'empty'}, 'Sonuç bulunamadı')),
              pageRows.map((r,i) => {
                const pi = r.m25 ? r.m25.indexOf(Math.max(...r.m25)) : -1;
                return h('tr',{key:page*perPage+i, className:'clickable', onClick:()=>setKeywordModal(r)},
                  h('td',{className:'kw-cell', style:{maxWidth:200}}, r.kw),
                  h('td',{style:{fontSize:11, fontWeight:500}}, r.brand || '-'),
                  h('td',{style:{fontSize:11}},
                    h('div',{style:{display:'flex',alignItems:'center',gap:5}},
                      h('div',{style:{width:7,height:7,borderRadius:2,background:katColor(r.k1),flexShrink:0}}),
                      h('span',null, r.k1)
                    )
                  ),
                  h('td',{style:{fontSize:11,color:'var(--ink-2)'}}, r.k2),
                  h('td',{className:'num'}, fmtNum(r.a24)),
                  h('td',{className:'num'}, fmtNum(r.a25)),
                  h('td',{className:'num'}, h(YoYPill,{yoy:r.yoy})),
                  h('td',{style:{width:110}}, h(Sparkline,{values:r.m25, w:100, h:26})),
                  h('td',null, pi>=0 ? h('span',{className:'pill neu'}, TR_MONTHS[pi]) : '-')
                );
              })
            )
          )
        ),
        totalPages > 1 && h('div',{style:{display:'flex',justifyContent:'center',gap:8,padding:14,borderTop:'1px solid var(--line)'}},
          h('button',{className:'chip-btn', style:{padding:'6px 12px',borderRadius:999}, disabled:page===0, onClick:()=>setPage(p=>Math.max(0,p-1))}, '← Önceki'),
          h('span',{style:{padding:'6px 12px',fontSize:12,color:'var(--ink-2)'}}, `Sayfa ${page+1}/${totalPages} · ${fmtNum(filtered.length)} KW`),
          h('button',{className:'chip-btn', style:{padding:'6px 12px',borderRadius:999}, disabled:page>=totalPages-1, onClick:()=>setPage(p=>Math.min(totalPages-1, p+1))}, 'Sonraki →')
        )
      )
    );
  }

  // === Brand Tab ===
  function BrandTab({setKeywordModal, onNavigateKw, onNavigateBrand, globalFilter}) {
    const [q, setQ] = React.useState('');
    // catFilter mirrors globalFilter.globalCatalog — reads from global (single source of truth)
    const catFilter = globalFilter?.globalCatalog || '';
    const [sort, setSort] = React.useState({k:'sum25', d:-1});
    const [expandedBrands, setExpandedBrands] = React.useState(() => new Set());
    const [page, setPage] = React.useState(0);
    const perPage = 50;

    // Brand-tab keyword list (alttaki tablo)
    const [brandKwQuery, setBrandKwQuery] = React.useState('');
    const [brandKwPage, setBrandKwPage] = React.useState(0);
    const [brandKwSort, setBrandKwSort] = React.useState({k:'a25', d:-1});
    React.useEffect(() => setBrandKwPage(0), [brandKwQuery, brandKwSort, catFilter, globalFilter]);

    // Refs for smooth-scroll on matrix / chart click
    const kwListRef = React.useRef(null);
    const brandTableRef = React.useRef(null);
    const scrollAndFlash = (ref) => {
      if (!ref?.current) return;
      smoothScrollTo(ref.current);
      // Brief flash outline to draw attention
      const el = ref.current;
      el.classList.add('flash-target');
      setTimeout(() => el.classList.remove('flash-target'), 1200);
    };

    const toggleExpand = (b) => {
      setExpandedBrands(prev => {
        const next = new Set(prev);
        if (next.has(b)) next.delete(b); else next.add(b);
        return next;
      });
    };

    // Pool = all keywords (in + out), respecting global filter
    const scopedKws = React.useMemo(() => {
      const pool = (D.keywords || []).concat(D.outKeywords || []);
      return applyGlobalFilter(pool.filter(k => !!k.brand), globalFilter);
    }, [globalFilter]);

    // Build brands from scoped keywords (filter-aware)
    const allBrands = React.useMemo(() => {
      const m = {};
      for (const k of scopedKws) {
        const key = k.brand;
        if (!m[key]) m[key] = {
          brand: key, catalog: k.catalog || '', count: 0,
          sum24: 0, sum25: 0,
          m24: new Array(12).fill(0), m25: new Array(12).fill(0),
          k1vol: {}, k2vol: {}
        };
        const b = m[key];
        b.count += 1;
        b.sum24 += (k.a24 || 0) * 12;
        b.sum25 += (k.a25 || 0) * 12;
        for (let i = 0; i < 12; i++) {
          b.m24[i] += k.m24[i] || 0;
          b.m25[i] += k.m25[i] || 0;
        }
        b.k1vol[k.k1] = (b.k1vol[k.k1] || 0) + (k.a25 || 0) * 12;
        const k2key = k.k2 || '(boş)';
        if (!b.k2vol[k2key]) b.k2vol[k2key] = { k2: k2key, count: 0, sum24: 0, sum25: 0, m25: new Array(12).fill(0), kws: [] };
        b.k2vol[k2key].count += 1;
        b.k2vol[k2key].sum24 += (k.a24 || 0) * 12;
        b.k2vol[k2key].sum25 += (k.a25 || 0) * 12;
        for (let i = 0; i < 12; i++) b.k2vol[k2key].m25[i] += k.m25[i] || 0;
        b.k2vol[k2key].kws.push(k);
        // Set catalog flag: prefer definite Var/Yok over empty
        if (!b.catalog && k.catalog) b.catalog = k.catalog;
        if (b.catalog !== 'Yok' && k.catalog === 'Yok') b.catalog = 'Yok';
        else if (!b.catalog && k.catalog === 'Var') b.catalog = 'Var';
      }
      return Object.values(m).map(b => {
        const yoy = b.sum24 ? (b.sum25 - b.sum24) / b.sum24 : 0;
        const peakI = b.m25.indexOf(Math.max(...b.m25));
        const topK1Entries = Object.entries(b.k1vol).sort((a,b) => b[1] - a[1]);
        const topK1 = topK1Entries[0]?.[0] || '';
        const topK1Share = b.sum25 && topK1Entries[0] ? topK1Entries[0][1] / b.sum25 : 0;
        const k2Rows = Object.values(b.k2vol).map(v => ({
          ...v,
          yoy: v.sum24 ? (v.sum25 - v.sum24) / v.sum24 : 0,
          topKws: [...v.kws].sort((a,b) => (b.a25||0) - (a.a25||0)).slice(0, 3)
        })).sort((a,b) => b.sum25 - a.sum25);
        return { ...b, yoy, peakI, topK1, topK1Share, k2Rows };
      });
    }, [scopedKws]);

    const filtered = React.useMemo(() => {
      let rows = allBrands;
      const qq = q.trim().toLowerCase();
      if (qq) rows = rows.filter(r => r.brand.toLowerCase().includes(qq));
      if (catFilter) rows = rows.filter(r => r.catalog === catFilter);
      const s = sort.k, d = sort.d;
      rows = [...rows].sort((a,b) => {
        const av = a[s], bv = b[s];
        if (typeof av === 'string') return (av || '').localeCompare(bv || '', 'tr') * d;
        if (av == null) return 1; if (bv == null) return -1;
        return (av > bv ? 1 : av < bv ? -1 : 0) * d;
      });
      return rows;
    }, [allBrands, q, catFilter, sort]);

    React.useEffect(() => setPage(0), [q, catFilter, scopedKws]);
    const pageRows = filtered.slice(page*perPage, (page+1)*perPage);
    const totalPages = Math.ceil(filtered.length/perPage);

    // KPIs (filter-aware)
    const varCount = allBrands.filter(b => b.catalog === 'Var').length;
    const yokCount = allBrands.filter(b => b.catalog === 'Yok').length;
    const totalVol25 = allBrands.reduce((s,b) => s + b.sum25, 0);
    const topBrand = allBrands.length ? [...allBrands].sort((a,b)=>b.sum25-a.sum25)[0] : null;
    const avgYoY = allBrands.length ? allBrands.reduce((s,b)=>s+(b.yoy||0),0) / allBrands.length : 0;

    // Top 10 for bar chart
    const top10 = React.useMemo(() => {
      const src = catFilter ? allBrands.filter(b => b.catalog === catFilter) : allBrands;
      return [...src].sort((a,b)=>b.sum25-a.sum25).slice(0, 10);
    }, [allBrands, catFilter]);
    const top10Max = top10.length ? Math.max(...top10.map(b => b.sum25)) : 1;

    const th = (label, k, numCol=false) => h('th', {
      className:numCol?'num':'',
      style:{cursor:'pointer', userSelect:'none'},
      onClick:()=>setSort({k, d: sort.k===k ? -sort.d : -1})
    }, label, sort.k===k ? (sort.d>0?' ↑':' ↓') : '');

    const hasFilterActive = !!globalFilter?.hasGlobalFilter;

    return h('div',null,
      h(SectionHeader, {
        accent:'blue',
        icon: h('svg',{width:22,height:22,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'},
          h('path',{d:'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z'}),
          h('line',{x1:7,y1:7,x2:7.01,y2:7})
        ),
        title:'Brand Intelligence',
        desc: hasFilterActive
          ? `Filtre aktif · ${fmtNum(allBrands.length)} marka · ${fmtNum(totalVol25)} 2025 hacim · ${fmtNum(scopedKws.length)} keyword`
          : `${fmtNum(allBrands.length)} marka · ${fmtNum(varCount)} Özdilek portföyünde · ${fmtNum(yokCount)} portföy dışı. Hacim ve büyüme bazında marka karşılaştırması.`
      }),

      h('div',{className:'grid grid-kpi kpi-5', style:{marginBottom:18}},
        h(Kpi,{label:'Toplam Marka', value:fmtNum(allBrands.length), sub:`${varCount} Var · ${yokCount} Yok`, accent:true}),
        h(Kpi,{label:'Toplam 2025 Hacim', value:fmtNum(totalVol25), chip:fmtPct(avgYoY), chipClass:trendClass(avgYoY), sub:'markaların toplamı'}),
        h(Kpi,{label:'Özdilek Portföyü', value:fmtNum(varCount), sub:allBrands.length ? (varCount/allBrands.length*100).toFixed(0)+'% kapsama' : '—'}),
        h(Kpi,{label:'Portföy Dışı', value:fmtNum(yokCount), sub:allBrands.length ? (yokCount/allBrands.length*100).toFixed(0)+'% fırsat' : '—'}),
        topBrand && h(Kpi,{label:'En Büyük Marka', value:topBrand.brand, sub:fmtNum(topBrand.sum25)+' / 2025'}),
      ),

      // Filter bar — catFilter artık global'de (Kategori & Marka Filtresi > Özdilekte Var/Yok)
      h('div',{className:'toolbar', style:{marginBottom:14}},
        h('input',{className:'input input-search', placeholder:'Marka ara…', value:q, onChange:e=>setQ(e.target.value), style:{flex:1, minWidth:220}}),
        h('div',{style:{flex:1}}),
        h('span',{className:'txt-3', style:{fontSize:12}}, fmtNum(filtered.length)+' marka'),
        h('button',{className:'chip-btn', style:{padding:'6px 12px',borderRadius:999}, onClick:()=>{
          const csv = toCSV(filtered, [
            {label:'Marka',key:'brand'}, {label:'Katalog',key:'catalog'},
            {label:'KW Sayısı',key:'count'},
            {label:'2024 Avg', get:r=>toMonthlyAvg(r.sum24)}, {label:'2025 Avg', get:r=>toMonthlyAvg(r.sum25)}, {label:'YoY',key:'yoy'},
            {label:'Peak Ay', get:r => r.peakI >= 0 ? TR_MONTHS[r.peakI] : ''},
            {label:'Ana Kategori',key:'topK1'},
            ...TR_MONTHS.map((m,i)=>({label:m+' 2025', get:r=>r.m25 ? r.m25[i] : ''}))
          ]);
          downloadCSV(`${BRAND_SLUG}-brands.csv`, csv);
        }}, '↓ CSV'),
      ),

      // === Kategori Pazar Payı — drill-down (Kat1→Kat2→Kat3) ===
      (() => {
        const gK1 = globalFilter?.globalK1 || [];
        const gK2 = globalFilter?.globalK2 || [];
        let level = 'k1';
        if (gK2.length >= 1) level = 'k3';
        else if (gK1.length >= 1) level = 'k2';
        const title = level === 'k1' ? 'Kategori Pazar Payı (Kat 1)'
          : level === 'k2' ? `Alt Kategori Pazar Payı (Kat 2) · ${gK1.join(', ')}`
          : `Alt Alt Kategori Pazar Payı (Kat 3) · ${gK2.join(', ')}`;
        const pool = catFilter ? scopedKws.filter(k => k.catalog === catFilter) : scopedKws;
        const m = {};
        for (const k of pool) {
          const key = level === 'k1' ? k.k1 : level === 'k2' ? k.k2 : k.k3;
          if (!key) continue;
          m[key] = (m[key] || 0) + (k.a25 || 0);
        }
        const totalAvg = Object.values(m).reduce((s,v)=>s+v,0);
        const rows = Object.entries(m)
          .map(([label, value]) => ({
            label, value,
            share: totalAvg ? value/totalAvg : 0,
            color: level === 'k1' ? katColor(label) : (level === 'k2' ? 'var(--coral)' : 'var(--teal)')
          }))
          .sort((a,b) => b.value - a.value);
        if (rows.length === 0) return null;
        const activeState = level === 'k1' ? gK1 : level === 'k2' ? gK2 : (globalFilter?.globalK3 || []);
        const setter = level === 'k1' ? globalFilter?.setGlobalK1 : level === 'k2' ? globalFilter?.setGlobalK2 : globalFilter?.setGlobalK3;
        const onClickRow = setter ? (label) => {
          const cur = activeState;
          if (cur.includes(label)) setter(cur.filter(x => x !== label));
          else setter([...cur, label]);
          // Smooth scroll to keyword list when filter changes
          setTimeout(() => scrollAndFlash(kwListRef), 80);
        } : undefined;
        const copyData = () => ({
          headers: ['Kategori', 'Avg Hacim', 'Pazar Payı %'],
          rows: rows.map(r => [r.label, r.value, (r.share*100).toFixed(2)+'%'])
        });
        return h('div',{className:'card', style:{marginBottom:18}},
          h('div',{className:'card-header', style:{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}},
            h('h3',{style:{flex:1, minWidth:200}}, title,
              h(InfoIcon,null,
                h('strong',null,'Drill-down: '),'Kat 1 satırına tıkla → filter ekler ve aynı alan Kat 2\'ye iner. Kat 2 → Kat 3. Global filter chip\'ten temizleyebilirsin.',
                h('br'),h('br'),h('strong',null,'Ne için? '),'Brand tab markalarının toplu kategori payını gösterir; markayı seçerek drill-down kategorisiyle de açılabilir.'
              )
            ),
            h(CopyButton, {getData: copyData})
          ),
          h('div',{style:{maxHeight:360, overflow:'auto', padding:'6px 14px 14px'}},
            h(ShareBars, { rows, activeLabels: activeState, onClickRow })
          )
        );
      })(),

      // === Keyword Tablosu (Brand tab'ın alt kısmında filtrelenebilir keyword listesi) ===
      (() => {
        // Scoped keywords + catFilter (Var/Yok) uygulanır
        const poolKws = catFilter ? scopedKws.filter(k => k.catalog === catFilter) : scopedKws;
        const qq = brandKwQuery.trim().toLowerCase();
        let rows = poolKws;
        if (qq) rows = rows.filter(r => r.kw.toLowerCase().includes(qq) || (r.brand||'').toLowerCase().includes(qq));
        // Sort
        const sk = brandKwSort.k, sd = brandKwSort.d;
        rows = [...rows].sort((a,b) => {
          const av = a[sk], bv = b[sk];
          if (av == null) return 1; if (bv == null) return -1;
          if (typeof av === 'string') return (av||'').localeCompare(bv||'', 'tr') * sd;
          return (av > bv ? 1 : av < bv ? -1 : 0) * sd;
        });
        const perK = 50;
        const kwPageRows = rows.slice(brandKwPage*perK, (brandKwPage+1)*perK);
        const kwTotalPages = Math.ceil(rows.length/perK);
        const tth = (label, k, numCol=false) => h('th', {
          className:numCol?'num':'',
          style:{cursor:'pointer', userSelect:'none'},
          onClick:()=>setBrandKwSort({k, d: brandKwSort.k===k ? -brandKwSort.d : -1})
        }, label, brandKwSort.k===k ? (brandKwSort.d>0?' ↑':' ↓') : '');
        const copyData = () => ({
          headers: ['Keyword', 'Marka', 'Katalog', 'Kat 1', 'Kat 2', 'Kat 3', '2024 Avg', '2025 Avg', 'YoY %', 'Peak Ay', 'Peak Çeyrek'],
          rows: rows.map(r => [
            r.kw, r.brand || '', r.catalog || '', r.k1, r.k2, r.k3,
            r.a24, r.a25, (r.yoy*100).toFixed(2)+'%',
            r.m25 ? TR_MONTHS[r.m25.indexOf(Math.max(...r.m25))] : '',
            r.m25 ? 'Q'+(Math.floor(r.m25.indexOf(Math.max(...r.m25))/3)+1) : ''
          ])
        });
        return h('div',{className:'card flush', ref: kwListRef, style:{marginBottom:18, scrollMarginTop:170}},
          h('div',{className:'card-title-row', style:{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}},
            h('h3',{style:{flex:1,minWidth:200}}, 'Keyword Listesi · Marka Filtreli',
              h(InfoIcon,null,
                h('strong',null,'Ne gösterir? '),'Markaları, kategorileri, brand filtreleriyle daraltabildiğiniz, seçili scope\'daki tüm keyword\'lerin tek-tablo görünümü.',
                h('br'),h('br'),h('strong',null,'Filtre: '),'Üstte global (Kat 1/2/3/Marka/Peak Ay/Trend...) + toolbar\'da tab-level arama + katalog segmented.',
                h('br'),h('br'),h('strong',null,'Sort: '),'Kolon başlıklarına tıkla. Satır tıkla → keyword modal.'
              ),
              h('span',{className:'txt-3', style:{fontSize:11, marginLeft:8}}, fmtNum(rows.length)+' keyword')
            ),
            h('input',{
              className:'input input-search', placeholder:'Keyword veya marka ara…',
              value:brandKwQuery, onChange:e=>setBrandKwQuery(e.target.value),
              style:{width:240}
            }),
            h(CopyButton, {getData: copyData}),
            h('button',{
              className:'chip-btn', style:{padding:'6px 12px',borderRadius:999},
              onClick:()=>{
                const csv = toCSV(rows, [
                  {label:'Keyword',key:'kw'}, {label:'Marka',key:'brand'}, {label:'Katalog',key:'catalog'},
                  {label:'Kat 1',key:'k1'}, {label:'Kat 2',key:'k2'}, {label:'Kat 3',key:'k3'},
                  {label:'2024 Avg',key:'a24'}, {label:'2025 Avg',key:'a25'}, {label:'YoY',key:'yoy'},
                  {label:'Peak Ay', get:r => r.m25 ? TR_MONTHS[r.m25.indexOf(Math.max(...r.m25))] : ''},
                  ...TR_MONTHS.map((m,i)=>({label:m+' 2025', get:r=>r.m25[i]}))
                ]);
                downloadCSV(`${BRAND_SLUG}-brand-keywords.csv`, csv);
              }
            }, '↓ CSV')
          ),
          h('div',{className:'tbl-wrap'},
            h('table',{className:'tbl'},
              h('thead',null, h('tr',null,
                tth('Keyword','kw'),
                tth('Marka','brand'),
                h('th',null,'Katalog'),
                tth('Kat 1','k1'),
                tth('Kat 2','k2'),
                tth('2024 Avg','a24',true),
                tth('2025 Avg','a25',true),
                tth('YoY','yoy',true),
                h('th',null,'12 Ay'),
                h('th',null,'Peak')
              )),
              h('tbody',null,
                kwPageRows.length === 0 && h('tr',null, h('td',{colSpan:10, className:'empty'}, 'Filtreye uyan keyword yok')),
                kwPageRows.map((r,i) => {
                  const pi = r.m25 ? r.m25.indexOf(Math.max(...r.m25)) : -1;
                  return h('tr',{key:brandKwPage*perK+i, className:'clickable', onClick:()=>setKeywordModal(r)},
                    h('td',{className:'kw-cell', style:{maxWidth:200}}, r.kw),
                    h('td',{style:{fontSize:11, fontWeight:500}}, r.brand || '-'),
                    h('td',null, h('span',{className:'pill '+(r.catalog==='Var'?'pos':r.catalog==='Yok'?'neg':'neu'), style:{fontSize:10}}, r.catalog || '-')),
                    h('td',{style:{fontSize:11}},
                      h('div',{style:{display:'flex',alignItems:'center',gap:5}},
                        h('div',{style:{width:7,height:7,borderRadius:2,background:katColor(r.k1),flexShrink:0}}),
                        h('span',null, r.k1)
                      )
                    ),
                    h('td',{style:{fontSize:11,color:'var(--ink-2)'}}, r.k2),
                    h('td',{className:'num', title:fmtFull(r.a24)}, fmtNum(r.a24)),
                    h('td',{className:'num', title:fmtFull(r.a25)}, fmtNum(r.a25)),
                    h('td',{className:'num'}, h(YoYPill,{yoy:r.yoy})),
                    h('td',{style:{width:110}}, h(Sparkline,{values:r.m25, w:100, h:26})),
                    h('td',null, pi>=0 ? h('span',{className:'pill neu'}, TR_MONTHS[pi]) : '-')
                  );
                })
              )
            )
          ),
          kwTotalPages > 1 && h('div',{style:{display:'flex',justifyContent:'center',gap:8,padding:14,borderTop:'1px solid var(--line)'}},
            h('button',{className:'chip-btn', style:{padding:'6px 12px',borderRadius:999}, disabled:brandKwPage===0, onClick:()=>setBrandKwPage(p=>Math.max(0,p-1))}, '← Önceki'),
            h('span',{style:{padding:'6px 12px',fontSize:12,color:'var(--ink-2)'}}, `Sayfa ${brandKwPage+1}/${kwTotalPages} · ${fmtNum(rows.length)} KW`),
            h('button',{className:'chip-btn', style:{padding:'6px 12px',borderRadius:999}, disabled:brandKwPage>=kwTotalPages-1, onClick:()=>setBrandKwPage(p=>Math.min(kwTotalPages-1, p+1))}, 'Sonraki →')
          )
        );
      })(),

      // === Brand × Kategori Matrix — tüm markalar, drill-down (Kat1→Kat2→Kat3), vertical scroll ===
      (() => {
        // Drill level driven by global filter:
        //   Kat 3: globalK2 has 1+ selection (filter already shows only keywords in that k1+k2)
        //   Kat 2: globalK1 has 1+ selection, no k2 picked
        //   Kat 1: default
        const gK1 = globalFilter?.globalK1 || [];
        const gK2 = globalFilter?.globalK2 || [];
        let level = 'k1', levelLabel = 'Kategori (Kat 1)';
        if (gK2.length >= 1) { level = 'k3'; levelLabel = 'Alt Alt Kategori (Kat 3)'; }
        else if (gK1.length >= 1) { level = 'k2'; levelLabel = 'Alt Kategori (Kat 2)'; }

        // Build brand × level cell values from scopedKws (filter-aware already)
        const catFilteredKws = catFilter
          ? scopedKws.filter(k => k.catalog === catFilter)
          : scopedKws;
        if (catFilteredKws.length === 0) return null;

        const brandMap = {};
        const colSet = new Set();
        for (const k of catFilteredKws) {
          const b = k.brand;
          if (!b) continue;
          const col = level === 'k1' ? k.k1 : level === 'k2' ? k.k2 : k.k3;
          if (!col) continue;
          colSet.add(col);
          if (!brandMap[b]) brandMap[b] = { brand: b, catalog: k.catalog || '', total: 0, cells: {} };
          brandMap[b].total += (k.a25 || 0) * 12;
          brandMap[b].cells[col] = (brandMap[b].cells[col] || 0) + (k.a25 || 0) * 12;
        }
        const brands = Object.values(brandMap).sort((a,b) => b.total - a.total);
        // When at Kat 1 level columns are categories; use katColor lookup. For K2/K3 use parent K1 color via mapping.
        const colList = Array.from(colSet).sort();
        if (brands.length === 0 || colList.length === 0) return null;
        // col → parent k1 (for coloring); build from first keyword in each col
        const colParentK1 = {};
        for (const k of catFilteredKws) {
          const col = level === 'k1' ? k.k1 : level === 'k2' ? k.k2 : k.k3;
          if (col && !colParentK1[col]) colParentK1[col] = k.k1;
        }
        const rowMaxes = brands.map(b => Math.max(...colList.map(c => b.cells[c] || 0), 1));
        const totalMax = Math.max(...brands.map(b => b.total), 1);

        const copyData = () => ({
          headers: ['#', 'Marka', 'Katalog', ...colList, 'Toplam Avg'],
          rows: brands.map((b, i) => [
            i+1, b.brand, b.catalog,
            ...colList.map(c => toMonthlyAvg(b.cells[c] || 0)),
            toMonthlyAvg(b.total)
          ])
        });

        return h('div',{className:'card', style:{marginBottom:18}},
          h('div',{className:'card-header', style:{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}},
            h('h3',{style:{flex:1,minWidth:240}},'Marka × ' + levelLabel + ' Matris',
              h(InfoIcon,null,
                h('strong',null,'Ne gösterir? '),'Tüm markaların (',fmtNum(brands.length),') seçili kategori seviyesinde aylık ortalama arama hacmi dağılımı. Satır-normalize renk ile her markanın en güçlü kolonu vurgulanır.',
                h('br'),h('br'),h('strong',null,'Drill-down: '),'Global filtreden Kat 1 seç → Kat 2 kolonları gelir. Kat 2 seç → Kat 3 kolonları. Tekrar açmak için filter chip\'i sil.',
                h('br'),h('br'),h('strong',null,'Scroll: '),'Yatay (kolonlar) ve dikey (markalar) scroll mevcut. İlk kolon yatay scroll\'da sabit.'
              )
            ),
            h('span',{className:'txt-3', style:{fontSize:11}}, brands.length + ' marka × ' + colList.length + ' kolon'),
            h(CopyButton, {getData: copyData})
          ),
          h('div',{className:'bkm-scroll', style:{overflow:'auto', padding:'0 14px 14px', position:'relative', maxHeight: 520}},
            h('div',{className:'bkm-grid', style:{
              display:'grid',
              gridTemplateColumns: `minmax(160px, 200px) repeat(${colList.length}, minmax(70px, 1fr)) minmax(80px, 100px)`,
              gap:2, minWidth: (160 + colList.length*70 + 80) + 'px'
            }},
              // Header row — first column sticky
              h('div',{style:{padding:'8px 6px', fontSize:10, fontWeight:700, color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'.08em', position:'sticky', top:0, left:0, background:'var(--bg-card)', zIndex:3}}, 'Marka'),
              ...colList.map(col => h('div',{
                key:'h'+col,
                style:{
                  padding:'8px 4px', fontSize:10, fontWeight:700, textAlign:'center',
                  borderBottom:`2px solid ${katColor(colParentK1[col] || col)}`, color:'var(--ink-2)',
                  lineHeight:1.15, wordBreak:'break-word',
                  position:'sticky', top:0, background:'var(--bg-card)', zIndex:2
                },
                title: col
              }, col)),
              h('div',{style:{padding:'8px 4px', fontSize:10, fontWeight:700, textAlign:'right', color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'.08em', position:'sticky', top:0, background:'var(--bg-card)', zIndex:2}}, 'Toplam Avg'),
              // Body
              ...brands.flatMap((r, ri) => [
                h('div',{
                  key:'b'+ri, className:'clickable',
                  onClick:()=>{
                    // Set globalBrand filter + smooth scroll to keyword list below
                    if (globalFilter?.setGlobalBrand) globalFilter.setGlobalBrand([r.brand]);
                    setTimeout(() => scrollAndFlash(kwListRef), 50);
                  },
                  title: `${r.brand} markasını filtreye ekle ve keyword listesine scroll`,
                  style:{
                    padding:'6px 8px', fontSize:12, fontWeight:600, cursor:'pointer',
                    display:'flex', alignItems:'center', gap:6, minWidth:0,
                    borderTop: ri>0 ? '1px solid var(--line)' : 'none',
                    position:'sticky', left:0, background:'var(--bg-card)', zIndex:1
                  }
                },
                  h('span',{style:{color:'var(--ink-3)',fontSize:10,fontWeight:500,flexShrink:0,minWidth:16}}, (ri+1)+'.'),
                  h('span',{style:{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,minWidth:0}, title:r.brand}, r.brand),
                  h('span',{className:'pill '+(r.catalog==='Var'?'pos':r.catalog==='Yok'?'neg':'neu'), style:{fontSize:9, padding:'1px 5px'}}, r.catalog || '-')
                ),
                ...colList.map((col, ci) => {
                  const v = r.cells[col] || 0;
                  const intensity = rowMaxes[ri] ? v / rowMaxes[ri] : 0;
                  const parentK1 = colParentK1[col] || col;
                  const bg = intensity > 0
                    ? `color-mix(in srgb, ${katColor(parentK1)} ${Math.round(intensity*82+8)}%, var(--bg-card))`
                    : 'var(--bg-card)';
                  const txtColor = intensity > 0.55 ? '#fff' : 'var(--ink-2)';
                  const avgV = toMonthlyAvg(v);
                  return h('div',{
                    key:'c'+ri+'_'+ci,
                    className:'clickable',
                    onClick:()=>{
                      // Set brand + col-level filter, then scroll to keyword list
                      if (globalFilter?.setGlobalBrand) globalFilter.setGlobalBrand([r.brand]);
                      if (level === 'k1' && globalFilter?.setGlobalK1) globalFilter.setGlobalK1([col]);
                      else if (level === 'k2' && globalFilter?.setGlobalK2) globalFilter.setGlobalK2([col]);
                      else if (level === 'k3' && globalFilter?.setGlobalK3) globalFilter.setGlobalK3([col]);
                      setTimeout(() => scrollAndFlash(kwListRef), 80);
                    },
                    style:{
                      padding:'8px 4px', fontSize:10, fontWeight:600, textAlign:'center',
                      background: bg, color: txtColor, borderRadius:3,
                      borderTop: ri>0 ? '1px solid var(--line)' : 'none',
                      minHeight:28, display:'flex', alignItems:'center', justifyContent:'center',
                      cursor: 'pointer'
                    },
                    title: `${r.brand} · ${col}: ${fmtFull(avgV)} /ay — tıkla: marka+kategori filtrele + keyword listesine scroll`
                  }, v > 0 ? fmtNum(avgV) : '·');
                }),
                h('div',{
                  key:'t'+ri,
                  style:{
                    padding:'8px 6px', fontSize:11, fontWeight:700, textAlign:'right',
                    color:'var(--ink)', borderTop: ri>0 ? '1px solid var(--line)' : 'none'
                  },
                  title: fmtFull(toMonthlyAvg(r.total)) + ' /ay'
                }, fmtNum(toMonthlyAvg(r.total)))
              ])
            )
          )
        );
      })(),

      // Brand table with expand-on-click pivot
      h('div',{className:'card flush', style:{marginBottom:18}},
        h('div',{className:'tbl-wrap'},
          h('table',{className:'tbl'},
            h('thead',null, h('tr',null,
              h('th',{style:{width:26}}, ''),
              th('Marka','brand'),
              h('th',null,'Katalog'),
              th('KW','count',true),
              th('2024 Avg','sum24',true),
              th('2025 Avg','sum25',true),
              th('YoY','yoy',true),
              h('th',null,'12 Ay'),
              th('Peak','peakI'),
              th('Ana Kat','topK1')
            )),
            h('tbody',null,
              pageRows.length === 0 && h('tr',null, h('td',{colSpan:10, className:'empty'}, 'Sonuç bulunamadı')),
              pageRows.flatMap((b,i) => {
                const isOpen = expandedBrands.has(b.brand);
                const mainRow = h('tr',{key:'b'+i, className:'clickable', onClick:()=>toggleExpand(b.brand)},
                  h('td',{style:{width:26, color:'var(--ink-3)', fontSize:10, textAlign:'center'}}, isOpen ? '▾' : '▸'),
                  h('td',null, h('strong',null, b.brand)),
                  h('td',null, h('span',{className:'pill '+(b.catalog==='Var'?'pos':b.catalog==='Yok'?'neg':'neu'), style:{fontSize:10}}, b.catalog || '-')),
                  h('td',{className:'num'}, fmtNum(b.count)),
                  h('td',{className:'num', title: fmtFull(toMonthlyAvg(b.sum24))}, fmtNum(toMonthlyAvg(b.sum24))),
                  h('td',{className:'num', title: fmtFull(toMonthlyAvg(b.sum25))}, fmtNum(toMonthlyAvg(b.sum25))),
                  h('td',{className:'num'}, h(YoYPill,{yoy:b.yoy})),
                  h('td',{style:{width:130}},
                    h('div',{style:{display:'flex',alignItems:'center',gap:6}},
                      h(Sparkline,{values:b.m25, w:90, h:26}),
                      (() => { const arr = recentTrendArrow(b.m25); return arr ? h('span',{
                        title: arr.title,
                        style:{fontSize:14, fontWeight:700, color: arr.color, lineHeight:1}
                      }, arr.char) : null; })()
                    )
                  ),
                  h('td',null, b.peakI >= 0 ? h('span',{className:'pill neu'}, TR_MONTHS[b.peakI]) : '-'),
                  h('td',{style:{fontSize:11}},
                    h('div',{style:{display:'flex',alignItems:'center',gap:5}},
                      h('div',{style:{width:7,height:7,borderRadius:2,background:katColor(b.topK1),flexShrink:0}}),
                      h('span',null, b.topK1)
                    )
                  )
                );

                if (!isOpen) return [mainRow];

                const subRow = h('tr',{key:'s'+i},
                  h('td',{colSpan:10, style:{padding:0, background:'var(--line-soft)'}},
                    h('div',{style:{padding:'12px 16px 14px'}},
                      h('div',{style:{display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:8}},
                        h('div',{style:{fontSize:11, color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700}},
                          `${b.brand} · Alt Kategori Kırılımı (${b.k2Rows.length} Kat 2)`
                        ),
                        onNavigateBrand && h('button',{
                          className:'chip-btn',
                          style:{padding:'4px 10px', borderRadius:999, fontSize:11, cursor:'pointer'},
                          onClick: (e) => {
                            e.stopPropagation();
                            onNavigateBrand(b.brand, b.catalog);
                          },
                          title: b.catalog === 'Yok' ? 'Özdilekte Olmayan Markalar tab\'ında aç' : 'Keyword tab\'ında aç'
                        }, (b.catalog === 'Yok' ? 'Özdilekte Olmayan Markalar tab\'ında aç →' : 'Keyword tab\'ında aç →'))
                      ),
                      h('table',{className:'tbl', style:{background:'var(--bg-card)', marginBottom:0}},
                        h('thead',null, h('tr',null,
                          h('th',null,'Kat 2'),
                          h('th',{className:'num'},'KW'),
                          h('th',{className:'num'},'2024 Avg'),
                          h('th',{className:'num'},'2025 Avg'),
                          h('th',{className:'num'},'YoY'),
                          h('th',null,'12 Ay'),
                          h('th',null,'Top Keyword\'ler')
                        )),
                        h('tbody',null,
                          b.k2Rows.map((r, ri) => h('tr',{key:ri},
                            h('td',null, h('strong',null, r.k2)),
                            h('td',{className:'num'}, fmtNum(r.count)),
                            h('td',{className:'num', title: fmtFull(toMonthlyAvg(r.sum24))}, fmtNum(toMonthlyAvg(r.sum24))),
                            h('td',{className:'num', title: fmtFull(toMonthlyAvg(r.sum25))}, fmtNum(toMonthlyAvg(r.sum25))),
                            h('td',{className:'num'}, h(YoYPill,{yoy:r.yoy})),
                            h('td',{style:{width:110}}, h(Sparkline,{values:r.m25, w:100, h:26})),
                            h('td',{style:{fontSize:11, color:'var(--ink-2)'}},
                              r.topKws.map((k, ki) => h('span',{
                                key:ki, className:'clickable',
                                onClick:(e)=>{ e.stopPropagation(); setKeywordModal(k); },
                                style:{
                                  display:'inline-block', marginRight:6, marginBottom:2,
                                  padding:'2px 7px', background:'var(--bg)',
                                  border:'1px solid var(--line)', borderRadius:12,
                                  fontSize:11, cursor:'pointer'
                                }
                              }, k.kw, h('span',{style:{color:'var(--ink-3)',marginLeft:4,fontSize:10}}, fmtNum(k.a25))))
                            )
                          ))
                        )
                      )
                    )
                  )
                );
                return [mainRow, subRow];
              })
            )
          )
        ),
        totalPages > 1 && h('div',{style:{display:'flex',justifyContent:'center',gap:8,padding:14,borderTop:'1px solid var(--line)'}},
          h('button',{className:'chip-btn', style:{padding:'6px 12px',borderRadius:999}, disabled:page===0, onClick:()=>setPage(p=>Math.max(0,p-1))}, '← Önceki'),
          h('span',{style:{padding:'6px 12px',fontSize:12,color:'var(--ink-2)'}}, `Sayfa ${page+1}/${totalPages} · ${fmtNum(filtered.length)} marka`),
          h('button',{className:'chip-btn', style:{padding:'6px 12px',borderRadius:999}, disabled:page>=totalPages-1, onClick:()=>setPage(p=>Math.min(totalPages-1, p+1))}, 'Sonraki →')
        )
      )
    );
  }

  // === Keyword Modal ===
  function KeywordModal({kw, onClose}) {
    const peakIdx = kw.m25 ? kw.m25.indexOf(Math.max(...kw.m25)) : -1;
    const dipIdx = kw.m25 ? kw.m25.indexOf(Math.min(...kw.m25)) : -1;
    const cvVal = kw.m25 ? cv(kw.m25) : null;

    return h(Modal,{onClose},
      h('div',null,
        h('div',{className:'lbl-cat'}, (kw.k1 || '') + (kw.k2 ? ' > '+kw.k2 : '') + (kw.k3 ? ' > '+kw.k3 : '')),
        h('h1',{style:{fontSize:26,marginBottom:16}}, kw.kw),
        h('div',{style:{display:'flex',gap:20,marginBottom:20,flexWrap:'wrap'}},
          h('div',null,
            h('div',{className:'lbl-cat'},'2024 Ort.'),
            h('div',{className:'num', style:{fontSize:20,fontWeight:600}}, fmtFull(kw.a24))
          ),
          h('div',null,
            h('div',{className:'lbl-cat'},'2025 Ort.'),
            h('div',{className:'num', style:{fontSize:20,fontWeight:600}}, fmtFull(kw.a25))
          ),
          h('div',null,
            h('div',{className:'lbl-cat'},'YoY Değişim'),
            h('div',{style:{fontSize:20}}, h(YoYPill,{yoy:kw.yoy}))
          ),
          kw.bucket && h('div',null,
            h('div',{className:'lbl-cat'},'Hacim Kova'),
            h('div',{style:{fontSize:14,fontWeight:500}}, kw.bucket)
          ),
          cvVal != null && h('div',null,
            h('div',{className:'lbl-cat'},'CV (Mevsimsellik)'),
            h('div',{className:'num', style:{fontSize:20,fontWeight:600}}, cvVal.toFixed(2).replace('.',','))
          )
        ),

        kw.m25 && h('div',{style:{marginBottom:20}},
          h('h3',{style:{marginBottom:10}},'12 Aylık Trend'),
          h(LineChart,{
            series:[
              kw.m24 && {name:'2024', values:kw.m24, color:'#8A8A8A'},
              {name:'2025', values:kw.m25, color:'#FF7B52', peakIdx}
            ].filter(Boolean),
            legend:true, height:240
          })
        ),

        kw.m25 && h('div',{className:'grid grid-2', style:{marginBottom:16}},
          h('div',null,
            h('div',{className:'lbl-cat'},'Peak ay'),
            h('div',{style:{fontSize:15,fontWeight:600}},
              TR_MONTHS_LONG[peakIdx], ' · ', h('span',{className:'num'}, fmtFull(kw.m25[peakIdx]))
            )
          ),
          h('div',null,
            h('div',{className:'lbl-cat'},'Dip ay'),
            h('div',{style:{fontSize:15,fontWeight:600}},
              TR_MONTHS_LONG[dipIdx], ' · ', h('span',{className:'num'}, fmtFull(kw.m25[dipIdx]))
            )
          )
        ),

        kw.m25 && h('div',{style:{fontSize:13,color:'var(--ink-2)',lineHeight:1.6,background:'var(--line-soft)',padding:14,borderRadius:8, display:'flex', gap:10, alignItems:'flex-start'}},
          h('span',{style:{color:'var(--coral)', paddingTop:2, flexShrink:0}}, I.Bulb(16)),
          h('div',null,
            h('strong',null,'Aksiyon: '),
            cvVal > 0.3 ?
              `Yüksek mevsimsel bir keyword. İçeriğin ${TR_MONTHS_LONG[peakIdx]} peak'inden 4-6 hafta önce güncellenmesi; ranking takviminin bu ritim üzerinden kurgulanması önerilebilir.` :
              cvVal > 0.15 ?
              `Orta mevsimsel. ${TR_MONTHS_LONG[peakIdx]} civarı öne çıkıyor; ancak yıl boyu hacim olduğundan evergreen içerik + sezonsal boost kombinasyonu değerlendirilebilir.` :
              `Evergreen bir keyword. Sıralamanın sürekli korunması önerilir; ${kw.yoy>0?'hacim büyüyor, fırsat değerlendirilebilir':'erime var, rakip analizi faydalı olabilir'}.`
          )
        )
      )
    );
  }

  return { OzetTab, KategorilerTab, KeywordTab, TrendlerTab, FiyatTab, OutOfCatalogTab, BrandTab, KeywordModal, KAT1_COLORS };
})();
