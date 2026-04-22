// Main App
(function(){
  const { OzetTab, KategorilerTab, KeywordTab, TrendlerTab, FiyatTab, OutOfCatalogTab, BrandTab, KeywordModal } = window.TABS;
  const h = React.createElement;

  const B = window.BRAND || {};
  const BRAND_NAME = B.name || 'Dashboard';
  const BRAND_TITLE = B.title || 'Keyword Intelligence';
  const BRAND_SUBTITLE = B.subtitle || '';
  const BRAND_SLUG = (B.slug || 'dashboard').replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'dashboard';
  const AGENCY = B.agency || { name: '', label: '', show: false };
  const STORAGE_TAB = `${BRAND_SLUG}.tab`;
  const STORAGE_TWEAKS = `${BRAND_SLUG}.tweaks`;

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "theme": "light",
    "palette": "coral",
    "density": "comfortable"
  }/*EDITMODE-END*/;

  // URL state helpers - tab + global filter hash içinde yaşar; paylaşılabilir link
  function readHashState() {
    try {
      const m = location.hash.match(/^#?v=([^&]+)/);
      if (!m) return null;
      return JSON.parse(decodeURIComponent(atob(m[1])));
    } catch { return null; }
  }
  function writeHashState(state) {
    const empty = !state.tab && state.k1.length === 0 && state.k2.length === 0 && state.k3.length === 0;
    if (empty) {
      // Temiz hash - filtre yoksa URL de sade kalsın
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      return;
    }
    const encoded = btoa(encodeURIComponent(JSON.stringify(state)));
    const newHash = '#v=' + encoded;
    if (location.hash !== newHash) history.replaceState(null, '', location.pathname + location.search + newHash);
  }

  function App() {
    const D = window.DATA;
    const KAT1_COLORS = window.KAT1_COLORS || {};
    // İlk açılışta URL hash'inden state'i oku - yoksa localStorage'a düş
    const initialHash = readHashState();
    const [tab, setTab] = React.useState(() => (initialHash && initialHash.tab) || localStorage.getItem(STORAGE_TAB) || 'ozet');
    const [filter, setFilter] = React.useState({k1:null, k2:null});
    const [keywordInitFilter, setKeywordInitFilter] = React.useState(null);
    const [keywordModal, setKeywordModal] = React.useState(null);

    // Global 3-level category filter + Brand filter (lifted from OzetTab - lives above tabs)
    const [globalK1, setGlobalK1] = React.useState(() => (initialHash && initialHash.k1) || []);
    const [globalK2, setGlobalK2] = React.useState(() => (initialHash && initialHash.k2) || []);
    const [globalK3, setGlobalK3] = React.useState(() => (initialHash && initialHash.k3) || []);
    const [globalBrand, setGlobalBrand] = React.useState(() => (initialHash && initialHash.brand) || []);
    // Secondary analytical filters (used by Trendler + Keyword + OutOfCatalog + Fiyat tabs)
    const [globalPeakMonth, setGlobalPeakMonth] = React.useState([]);
    const [globalPeakQuarter, setGlobalPeakQuarter] = React.useState([]);
    const [globalSezType, setGlobalSezType] = React.useState([]);
    const [globalBucket, setGlobalBucket] = React.useState([]);
    const [globalTrend, setGlobalTrend] = React.useState('');  // 'rising'|'falling'|'stable'|''
    const hasGlobalFilter = globalK1.length > 0 || globalK2.length > 0 || globalK3.length > 0 || globalBrand.length > 0
      || globalPeakMonth.length > 0 || globalPeakQuarter.length > 0 || globalSezType.length > 0
      || globalBucket.length > 0 || !!globalTrend;
    const allKat1 = React.useMemo(() => D.kat1Summary.map(k => k.k1), []);
    const g_k1Set = globalK1.length ? new Set(globalK1) : null;
    const g_k2Set = globalK2.length ? new Set(globalK2) : null;
    const allKat2Filtered = React.useMemo(() =>
      [...new Set(D.keywords.filter(k => !g_k1Set || g_k1Set.has(k.k1)).map(k => k.k2))].sort()
    , [globalK1]);
    const allKat3Filtered = React.useMemo(() =>
      [...new Set(D.keywords.filter(k => (!g_k1Set || g_k1Set.has(k.k1)) && (!g_k2Set || g_k2Set.has(k.k2))).map(k => k.k3))].sort()
    , [globalK1, globalK2]);
    // Brand options = union of in-catalog + out-of-catalog brands, filtered by Kat 1 selection
    const allBrandsGlobal = React.useMemo(() => {
      const pool = (D.keywords || []).concat(D.outKeywords || []);
      const filtered = g_k1Set ? pool.filter(k => g_k1Set.has(k.k1)) : pool;
      return [...new Set(filtered.map(k => k.brand).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'tr'));
    }, [globalK1]);
    // Secondary filter options
    const TR_MONTHS_SHORT = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
    const monthOptions = React.useMemo(() => TR_MONTHS_SHORT, []);
    const quarterOptions = ['Q1 (Oca-Mar)','Q2 (Nis-Haz)','Q3 (Tem-Eyl)','Q4 (Eki-Ara)'];
    const sezTypeOptions = ['Evergreen','Orta Mevsimsellik','Yüksek Mevsimsellik'];
    const bucketOptions = React.useMemo(() =>
      [...new Set(D.keywords.map(k => k.bucket).filter(Boolean))].sort((a,b) => {
        // Sort by numeric range (0-1000 first etc)
        const numA = parseInt(String(a).replace(/[^\d]/g,'') || '0');
        const numB = parseInt(String(b).replace(/[^\d]/g,'') || '0');
        return numA - numB;
      })
    , []);

    // Sticky shadow state
    // Filter bar scroll davranışı:
    //  - 140px üzerinde shadow'lu (scrolled class)
    //  - Aşağı scroll -> gizle (hidden class, transform: translateY(-100%))
    //  - Yukarı scroll -> tekrar aç
    //  - Tepe noktasına yakın (< 140px) her zaman göster
    const [filterScrolled, setFilterScrolled] = React.useState(false);
    const [filterHidden, setFilterHidden] = React.useState(false);
    React.useEffect(() => {
      let lastY = window.scrollY;
      let ticking = false;
      const threshold = 8; // küçük jitter'ları yok say
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const y = window.scrollY;
          const delta = y - lastY;
          if (y < 140) {
            setFilterHidden(false);
          } else if (Math.abs(delta) > threshold) {
            if (delta > 0) setFilterHidden(true);
            else setFilterHidden(false);
          }
          setFilterScrolled(y > 140);
          lastY = y;
          ticking = false;
        });
      };
      window.addEventListener('scroll', onScroll, {passive:true});
      return () => window.removeEventListener('scroll', onScroll);
    }, []);
    const [tweaksOpen, setTweaksOpen] = React.useState(false);
    const [editMode, setEditMode] = React.useState(false);
    const [tweaks, setTweaks] = React.useState(() => {
      try { return { ...TWEAK_DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_TWEAKS) || '{}') }; }
      catch { return TWEAK_DEFAULTS; }
    });

    // Persist
    React.useEffect(() => { localStorage.setItem(STORAGE_TAB, tab); }, [tab]);
    // Inject brand accent color at mount from window.BRAND_ACCENT (populated by data/dashboard.js)
    React.useEffect(() => {
      if (window.BRAND_ACCENT) {
        document.documentElement.style.setProperty('--brand-accent', window.BRAND_ACCENT);
      }
    }, []);

    React.useEffect(() => {
      document.documentElement.dataset.theme = tweaks.theme;
      document.documentElement.dataset.palette = tweaks.palette;
      localStorage.setItem(STORAGE_TWEAKS, JSON.stringify(tweaks));
    }, [tweaks]);

    // URL hash sync - tab ve global filtre her değişimde URL'ye yazılır (paylaşılabilir link)
    React.useEffect(() => {
      writeHashState({ tab, k1: globalK1, k2: globalK2, k3: globalK3, brand: globalBrand });
    }, [tab, globalK1, globalK2, globalK3, globalBrand]);

    // Link kopyala - URL'yi clipboard'a kopyalar + "Kopyalandı" toast
    const [linkCopied, setLinkCopied] = React.useState(false);
    const copyShareLink = async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 1600);
      } catch {}
    };

    // Edit mode protocol
    React.useEffect(() => {
      const onMsg = e => {
        const d = e.data;
        if (!d || typeof d !== 'object') return;
        if (d.type === '__activate_edit_mode') { setEditMode(true); setTweaksOpen(true); }
        if (d.type === '__deactivate_edit_mode') { setEditMode(false); setTweaksOpen(false); }
      };
      window.addEventListener('message', onMsg);
      window.parent.postMessage({type:'__edit_mode_available'}, '*');
      return () => window.removeEventListener('message', onMsg);
    }, []);

    function applyTweak(patch) {
      const next = { ...tweaks, ...patch };
      setTweaks(next);
      window.parent.postMessage({type:'__edit_mode_set_keys', edits: patch}, '*');
    }

    const onNavigateCat = (k1) => {
      setFilter({k1, k2:null});
      setTab('kategoriler');
    };
    const onNavigateKw = (ctx) => {
      setKeywordInitFilter(ctx || null);
      setTab('keyword');
    };
    // Smart brand navigation: Var brands → Keyword tab (in-catalog list), Yok brands → OutOfCatalog tab
    const onNavigateBrand = (brandName, catalog) => {
      if (catalog === 'Yok') {
        setGlobalBrand([brandName]);
        setTab('out');
      } else {
        setGlobalBrand([brandName]);
        setTab('keyword');
      }
    };

    const tabs = [
      { id:'ozet', label:'Özet', badge:null },
      { id:'kategoriler', label:'Kategoriler', badge: (window.DATA.kat2Monthly.length + window.DATA.kat3Monthly.length).toString() },
      { id:'keyword', label:'Keyword', badge: window.DATA.keywords.length.toLocaleString('tr-TR') },
      { id:'trendler', label:'Trendler', badge:null },
      { id:'fiyat', label:'Fiyat Intent', badge:null },
      { id:'out', label:'Özdilekte Olmayan Markalar', badge: (window.DATA.outKeywords || []).length.toLocaleString('tr-TR') },
      { id:'brand', label:'Brand', badge: (window.DATA.brands || []).length.toLocaleString('tr-TR') },
    ];

    const activeTab = tab;

    const globalFilter = {
      globalK1, globalK2, globalK3, globalBrand,
      globalPeakMonth, globalPeakQuarter, globalSezType, globalBucket, globalTrend,
      setGlobalK1, setGlobalK2, setGlobalK3, setGlobalBrand,
      setGlobalPeakMonth, setGlobalPeakQuarter, setGlobalSezType, setGlobalBucket, setGlobalTrend,
      hasGlobalFilter
    };

    function renderTab(id) {
      switch (id) {
        case 'ozet': return h(OzetTab, {setKeywordModal, onNavigateCat, onNavigateKw, globalFilter});
        case 'kategoriler': return h(KategorilerTab, {filter, setFilter, onNavigateKw, globalFilter});
        case 'keyword': return h(KeywordTab, {setKeywordModal, initialFilter: keywordInitFilter, clearInitialFilter: () => setKeywordInitFilter(null), globalFilter});
        case 'trendler': return h(TrendlerTab, {setKeywordModal, onNavigateKw, globalFilter});
        case 'fiyat': return h(FiyatTab, {setKeywordModal, globalFilter});
        case 'out': return h(OutOfCatalogTab, {setKeywordModal, onNavigateKw, onNavigateBrand, globalFilter});
        case 'brand': return h(BrandTab, {setKeywordModal, onNavigateKw, onNavigateBrand, globalFilter});
      }
    }

    return h('div',{className:'app'},
      // Topbar
      h('div',{className:'topbar'},
        h('div',{className:'logo'},
          h('img',{src:'assets/brand-logo.svg', alt:BRAND_NAME, style:{height:28, marginRight:14, filter:'brightness(0) invert(1)', flexShrink:0},
            onError:(e)=>{ e.target.src='assets/brand-logo.png'; }}),
          h('div',{className:'title-block'},
            BRAND_SUBTITLE && h('div',{className:'subtitle'}, BRAND_SUBTITLE),
            h('div',{className:'title'}, BRAND_TITLE)
          )
        ),
        h('div',{className:'spacer'}),
        // Controls + Inbound brand block - right side, controls LEFT of logo
        h('div',{className:'inbound-brand'},
          h('div',{className:'inbound-ctrls'},
            h('button',{
              className:'ctrl inbound-ctrl' + (linkCopied?' active':''),
              onClick: copyShareLink,
              title: linkCopied ? 'Link panoya kopyalandı' : 'Bu görünümün paylaşılabilir link\'ini kopyala'
            },
              linkCopied
                ? h(React.Fragment, null,
                    h('svg',{width:12, height:12, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:2.2, strokeLinecap:'round', strokeLinejoin:'round', style:{marginRight:4}}, h('path',{d:'M5 12l5 5L20 7'})),
                    'Kopyalandı'
                  )
                : h(React.Fragment, null,
                    h('svg',{width:12, height:12, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round', style:{marginRight:4}},
                      h('circle',{cx:18,cy:5,r:3}), h('circle',{cx:6,cy:12,r:3}), h('circle',{cx:18,cy:19,r:3}),
                      h('line',{x1:8.59,y1:13.51,x2:15.42,y2:17.49}), h('line',{x1:15.41,y1:6.51,x2:8.59,y2:10.49})
                    ),
                    'Paylaş'
                  )
            ),
            h('button',{className:'ctrl inbound-ctrl', onClick:()=>applyTweak({theme: tweaks.theme==='dark'?'light':'dark'})},
              tweaks.theme==='dark' ? '☀ Light' : '☾ Dark'
            ),
            h('button',{className:'ctrl inbound-ctrl'+(tweaksOpen?' active':''), onClick:()=>setTweaksOpen(o=>!o)},
              '⚙ Tweaks'
            )
          ),
          AGENCY.show && h('div',{className:'inbound-logo-wrap'},
            h('img',{src:'assets/agency-logo.png', alt:AGENCY.label || '', style:{height:20, display:'block'}}),
            AGENCY.name && h('div',{style:{fontSize:8, letterSpacing:'0.18em', textTransform:'uppercase', color:'rgba(255,255,255,0.75)', marginTop:3, textAlign:'center', fontWeight:700}}, AGENCY.name)
          )
        )
      ),

      // Tabs
      h('div',{className:'tabs'},
        tabs.map(t => h('button',{
          key:t.id,
          className:'tab'+(tab===t.id?' active':''),
          onClick:()=>setTab(t.id)
        }, t.label, t.badge && h('span',{className:'badge'}, t.badge)))
      ),

      // Global category filter - sticky under tabs, visible across all tabs
      h('div',{className:'global-filter-wrap'+(filterScrolled?' scrolled':'')+(filterHidden?' hidden':'')},
        h('div',{className:'filter-panel'},
          h('div',{className:'filter-panel-label'},
            h('span',{className:'fp-icon'},
              h('svg',{width:16, height:16, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.8, strokeLinecap:'round', strokeLinejoin:'round', 'aria-hidden':true},
                h('circle',{cx:12, cy:12, r:9}),
                h('circle',{cx:12, cy:12, r:5}),
                h('circle',{cx:12, cy:12, r:1.5, fill:'currentColor'})
              )
            ),
            h('strong',null,'Kategori & Marka Filtresi')
          ),
          h(window.C.MultiSelect, {
            label: 'Kat 1',
            options: allKat1,
            selected: globalK1,
            onChange: (sel) => {
              setGlobalK1(sel);
              const s = sel.length ? new Set(sel) : null;
              if (s) {
                setGlobalK2(prev => prev.filter(k2 => D.keywords.some(kw => s.has(kw.k1) && kw.k2 === k2)));
                setGlobalK3(prev => prev.filter(k3 => D.keywords.some(kw => s.has(kw.k1) && kw.k3 === k3)));
              }
            },
            colorMap: KAT1_COLORS,
            width: 200
          }),
          h(window.C.MultiSelect, {
            label: 'Kat 2',
            options: allKat2Filtered,
            selected: globalK2,
            onChange: (sel) => {
              setGlobalK2(sel);
              const s = sel.length ? new Set(sel) : null;
              if (s) setGlobalK3(prev => prev.filter(k3 => D.keywords.some(kw => s.has(kw.k2) && kw.k3 === k3)));
            },
            width: 220
          }),
          h(window.C.MultiSelect, {
            label: 'Kat 3',
            options: allKat3Filtered,
            selected: globalK3,
            onChange: setGlobalK3,
            width: 220
          }),
          h(window.C.MultiSelect, {
            label: 'Marka',
            options: allBrandsGlobal,
            selected: globalBrand,
            onChange: setGlobalBrand,
            width: 220
          }),
          hasGlobalFilter && h('button',{
            className:'chip-btn',
            onClick:()=>{
              setGlobalK1([]); setGlobalK2([]); setGlobalK3([]); setGlobalBrand([]);
              setGlobalPeakMonth([]); setGlobalPeakQuarter([]); setGlobalSezType([]);
              setGlobalBucket([]); setGlobalTrend('');
            }
          }, '× Temizle')
        ),
        // Row 2: Secondary analytical filters
        h('div',{className:'filter-panel filter-panel-secondary', style:{marginTop:-6}},
          h('div',{className:'filter-panel-label', style:{minWidth:90}},
            h('span',{className:'txt-3', style:{fontSize:10, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase'}}, 'Ek Filtre')
          ),
          h(window.C.MultiSelect, {
            label: 'Peak Ay', options: monthOptions, selected: globalPeakMonth, onChange: setGlobalPeakMonth, width: 160, searchable: false
          }),
          h(window.C.MultiSelect, {
            label: 'Peak Çeyrek', options: quarterOptions, selected: globalPeakQuarter, onChange: setGlobalPeakQuarter, width: 180, searchable: false
          }),
          h(window.C.MultiSelect, {
            label: 'Mevsim Tipi', options: sezTypeOptions, selected: globalSezType, onChange: setGlobalSezType, width: 180, searchable: false
          }),
          h(window.C.MultiSelect, {
            label: 'Hacim Aralığı', options: bucketOptions, selected: globalBucket, onChange: setGlobalBucket, width: 170, searchable: false
          }),
          h('div',{className:'segmented', title:'Trend Yönü', style:{fontSize:11}},
            h('button',{className:globalTrend===''?'active':'', onClick:()=>setGlobalTrend('')}, 'Tüm Trend'),
            h('button',{className:globalTrend==='rising'?'active':'', onClick:()=>setGlobalTrend('rising')}, '↑ Yükselen'),
            h('button',{className:globalTrend==='stable'?'active':'', onClick:()=>setGlobalTrend('stable')}, '→ Stabil'),
            h('button',{className:globalTrend==='falling'?'active':'', onClick:()=>setGlobalTrend('falling')}, '↓ Düşen')
          )
        ),
        hasGlobalFilter && h('div',{className:'filter-chips', style:{marginBottom:6, marginTop:6}},
          h('span',{className:'lbl'}, 'Seçili:'),
          globalK1.map(k => h('button',{key:'1'+k, className:'filter-chip', onClick:()=>setGlobalK1(globalK1.filter(x=>x!==k))}, 'K1: '+k, h('span',{className:'x'},'×'))),
          globalK2.map(k => h('button',{key:'2'+k, className:'filter-chip', onClick:()=>setGlobalK2(globalK2.filter(x=>x!==k))}, 'K2: '+k, h('span',{className:'x'},'×'))),
          globalK3.map(k => h('button',{key:'3'+k, className:'filter-chip', onClick:()=>setGlobalK3(globalK3.filter(x=>x!==k))}, 'K3: '+k, h('span',{className:'x'},'×'))),
          globalBrand.map(b => h('button',{key:'b'+b, className:'filter-chip', onClick:()=>setGlobalBrand(globalBrand.filter(x=>x!==b))}, 'Marka: '+b, h('span',{className:'x'},'×'))),
          globalPeakMonth.map(m => h('button',{key:'pm'+m, className:'filter-chip', onClick:()=>setGlobalPeakMonth(globalPeakMonth.filter(x=>x!==m))}, 'Peak: '+m, h('span',{className:'x'},'×'))),
          globalPeakQuarter.map(q => h('button',{key:'pq'+q, className:'filter-chip', onClick:()=>setGlobalPeakQuarter(globalPeakQuarter.filter(x=>x!==q))}, 'Ç: '+q.split(' ')[0], h('span',{className:'x'},'×'))),
          globalSezType.map(t => h('button',{key:'st'+t, className:'filter-chip', onClick:()=>setGlobalSezType(globalSezType.filter(x=>x!==t))}, t, h('span',{className:'x'},'×'))),
          globalBucket.map(b => h('button',{key:'bk'+b, className:'filter-chip', onClick:()=>setGlobalBucket(globalBucket.filter(x=>x!==b))}, 'Hacim: '+b, h('span',{className:'x'},'×'))),
          globalTrend && h('button',{className:'filter-chip', onClick:()=>setGlobalTrend('')}, globalTrend==='rising'?'↑ Yükselen':globalTrend==='falling'?'↓ Düşen':'→ Stabil', h('span',{className:'x'},'×'))
        ),
        hasGlobalFilter && h('div',{
          className:'txt-3',
          style:{fontSize:10.5, marginBottom:10, paddingLeft:2, letterSpacing:'.02em', opacity:.75}
        }, 'Filtre aktif · Tüm sekmeleri dinamik olarak etkiler')
      ),

      // Content — tab değişince fade-in animasyon (key=tab)
      h('div',{
        key: 'tab-' + tab,
        className:'content tab-content-anim',
        'data-screen-label': `01 ${tabs.find(t=>t.id===tab)?.label}`
      },
        renderTab(tab)
      ),

      // Tweaks panel
      tweaksOpen && h('div',{className:'tweaks-panel'},
        h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}},
          h('h3',{style:{margin:0}},'Tweaks'),
          h('button',{className:'modal-close', style:{width:24,height:24,fontSize:16}, onClick:()=>setTweaksOpen(false)}, '×')
        ),

        h('div',{className:'tweaks-row'},
          h('label',null,'Tema'),
          h('div',{className:'chips'},
            [['light','Light'],['dark','Dark']].map(([v,l]) =>
              h('button',{key:v, className:'chip-btn'+(tweaks.theme===v?' active':''), onClick:()=>applyTweak({theme:v})}, l)
            )
          )
        ),

        h('div',{className:'tweaks-row'},
          h('label',null,'Renk paleti'),
          h('div',{className:'chips'},
            [['coral','Coral'],['neutral','Nötr']].map(([v,l]) =>
              h('button',{key:v, className:'chip-btn'+(tweaks.palette===v?' active':''), onClick:()=>applyTweak({palette:v})}, l)
            )
          )
        ),

        h('div',{style:{fontSize:10,color:'var(--ink-3)',marginTop:10,lineHeight:1.4}},
          'Tema: açık / koyu görünüm. Palette: accent rengi (coral veya nötr).'
        )
      ),

      // Footer - Inbound logo bottom-left (clickable → Özet), scroll-top bottom-right
      AGENCY.show && h('button',{
        className:'footer-logo-left',
        onClick:()=>{ setTab('ozet'); window.scrollTo({top:0,behavior:'smooth'}); },
        title:'Özet\'e dön'
      },
        h('img',{src:'assets/agency-logo-small.png', alt:AGENCY.label || '', style:{height:18, display:'block', opacity:0.85}})
      ),
      h('div',{className:'page-footer'},
        h('button',{
          className:'scroll-top-btn',
          onClick:()=>window.scrollTo({top:0,behavior:'smooth'}),
          title:'En üste çık'
        }, '↑')
      ),

      // Keyword modal
      keywordModal && h(KeywordModal, {kw: keywordModal, onClose:()=>setKeywordModal(null)})
    );
  }

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(h(App));
})();
