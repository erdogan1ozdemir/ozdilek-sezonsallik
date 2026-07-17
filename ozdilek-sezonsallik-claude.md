# ozdilek-sezonsallik — Proje Gidişat Kaydı

**Proje:** Özdilekteyim Sezonsallık & Keyword Intelligence Dashboard (build-less React SPA, GitHub: erdogan1ozdemir/ozdilek-sezonsallik)
**Amaç:** Özdilekteyim kategori/keyword arama hacmi sezonsallık analizi; GKP exportlarından beslenen çok sekmeli dashboard.
**Durum:** 2026 H1 verisi eklendi, karşılaştırmalar rolling "Son 12 Ay vs Önceki 12 Ay" modeline geçirildi. Localde doğrulandı; push kullanıcı onayı bekliyor.

## 2026-07-17

- **Talep:** İki yeni GKP exportu (Keyword seti 9.382 kw + Özdilekte Olmayan Markalar 1.722 kw, 2026 Oca–Haz aylıkları) repoya işlensin; karşılaştırmalar "son 12 ay vs önceki 12 ay" olsun; eski hacim verileri silinmesin; 2026 eklensin. Önce plan, onay sonrası aksiyon; önce localde önizleme, sonra push.
- **Kullanıcı kararları:** Planned tab bu turda dokunulmadı. Grafiklere "Rolling 12 Ay / Takvim Yılı" görünüm toggle'ı eklendi (KPI/YoY her zaman rolling). Mevsimsellik hesapları (peak, CV, quartile, trend) son 12 aya göre yenilendi; ay etiketleri yıllı ("Tem 25", "Oca 26").
- **Yapılanlar:**
  - `scripts/lib/derive.js` (yeni): ortak matematik (mean/cv/bucket/quartile/peak/quarter flags).
  - `scripts/merge-2026.js` (yeni, `npm run merge`): source.xlsx + 2 GKP exportu → 2026 serial kolonları + R12/P12 rolling metrik kolonları eklenir, tüm türetilmiş sheet'ler rolling pencereye göre yeniden üretilir. Ay kolonları dinamik keşfedilir → 2026 H2 gelince aynı script tekrar çalıştırılır. Eşleşme TR-locale normalize; eksik 2 keyword ("kamp çadırı fiyatları", "yüzme kolluk") 2026'da 0 dolduruldu (loglanır).
  - `scripts/build-data.js`: m26/r12/p12/ryoy/rpq/rpeakSerial alanları; türetilmiş satırlarda alan rename (a24→prev, a25→last, yoy→ryoy); months2026/monthsR12/monthsP12; Kat 1 renkleri totR12'ye göre.
  - `scripts/build-data.test.js`: eskiden kırık sayım testi (2420→9384) düzeltildi + rolling assertion'lar; 20/20 yeşil.
  - `utils.js`: rollingOf/prevRollingOf/aggregateRolling/ROLLING_LABELS/serialToRollingLabel/rollingIdxToCalMonth.
  - `app.jsx`: viewMode state + segmented control (filtre barında), localStorage persist, globalFilter üzerinden tab'lara geçer.
  - `components.jsx`: YoYPill tooltip rolling; Heatmap periodLabel/prevLabel prop'ları.
  - `tabs.jsx`: PlannedTab hariç tüm tab'lar (Özet, Kategoriler, Keyword, Trendler, Fiyat, Out, Brand, KeywordModal) rolling metriklere + toggle'lı grafiklere geçirildi; CSV/Copy exportları rolling kolonlara güncellendi.
  - `README.md` + `ARCHITECTURE.md`: şema ve merge akışı dokümante edildi.
- **Doğrulama:** merge log (9.382+1.722 eşleşme, 0 bilinmeyen, marka parite sapması yok), `npm run build` temiz, `npm test` 20/20, localhost:3000'de tüm tab'lar + toggle + modal göz kontrolü, console hatasız, PlannedTab regresyonsuz.
- **Veri notu:** Rolling pencere Tem 2025–Haz 2026 (544,8M) vs Tem 2024–Haz 2025 (651,7M) → toplam pazar -%16.4. Düşüş verinin kendisinden (2024 H2 351,7M >> 2025 H2 283,0M; 2026 H1 261,7M < 2025 H1 300,0M). Bucket/quartile popülasyonları r12'ye göre yeniden hesaplandığı için filtre sonuçları eski görünümden farklı.

### Local inceleme sonrası revizyonlar (aynı gün)

- **Line chart tooltip:** Artık her satır kendi dönem etiketini taşıyor; en yeni seri üstte. Rolling'de "Haz 26: 43,6M / Son 12 Ay" üstte, "Haz 25: 46,5M / Önceki 12 Ay" altta; takvim görünümünde 2026 → 2025 → 2024 sırası. `LineChart` yeni `series[].pointLabels` + `shortName` prop'larıyla generic kaldı; tüm line chart'lar (Özet, Kategoriler, Fiyat, Out, KeywordModal) bu etiketleri geçiriyor.
- **Peak çeyrek yıllandı:** Rolling pencere tam 4 takvim çeyreğini kapsadığı için her çeyrek tek bir yıla düşüyor → "Q3 25", "Q4 25", "Q1 26", "Q2 26". `utils.js`e `ROLLING_Q_LABELS`, `qLabel()`, `quarterSums()`, `peakQuarterIdx()`, `QUARTER_OPTIONS` eklendi. Peak çeyrek artık **son 12 ayın en yüksek hacimli çeyreği** (eskiden peak ayın çeyreği / ≥%75 flag'i). Pill'ler, QStack legend'ı, Kategori Detayları, Keyword tablosu, CSV/Copy exportları ve global "Peak Çeyrek" filtresi + chip'i aynı tanımı kullanıyor (filtre-tablo tutarlılığı).
- **Parantez tipi süslemeler kaldırıldı** (İçerik Dili Rehberi Bölüm 15.1): yuvarlak kart kenarındaki 3px accent şeritleri (`.insight-strip`, `.info-note`, `.explainer-head`, `.card-stars`, `.kpi .bar`, OutOfCatalog Yıldız/Eriyen kartları) yerine ince soluk çerçeve (`color-mix` accent %26-34) + hafif zemin tonu (%4-6). Dark tema karşılıkları da güncellendi.
- **Doğrulama:** `npm test` 20/20, esbuild sözdizimi temiz, light + dark tema göz kontrolü, Peak Çeyrek filtresi (Q1 26 → 1,9K kw, tablodaki Peak Ç. ile birebir), console hatasız.
- **Durum:** main'e pushlandı (032b0fe).

### İkinci revizyon turu (aynı gün)

- **"Grafik Mart 2026'da bitiyor" bulgusu — kök neden:** Veri eksik değil; iki çizgi birebir çakışıyordu. Örnek: `stanley termos` Nis/May/Haz 26'da hem Son 12 Ay hem Önceki 12 Ay = 550.000. GKP hacimleri bucketlanmış olduğu için (450K/550K/673K/823K gibi sabit basamaklar) çakışma sık; üstte çizilen coral çizgi griyi tamamen örtüyor ve grafik erken bitiyormuş gibi görünüyordu.
  - **Çözüm:** `LineChart`e `series[].dashed` + `series[].overlay` eklendi. Karşılaştırma serileri (rolling'de Önceki 12 Ay; takvimde 2024 & 2025) kesikli çizilir ve `drawSeries` sıralamasıyla en üstte kalır → çakışmada alttaki solid çizgi kesik aralarından görünür. Legend swatch'ları da kesikli. Overlay serilerin noktaları küçültüldü (r=2) ki primary seri gizlenmesin.
- **Sezon takvimi tooltip'i:** "SON 12 AY / ÖNCEKİ 12 AY" yerine artık hücrenin kendi ayı yılıyla: **TEM 25 / TEM 24** (yanında soluk dönem ipucu). `Heatmap`e `tipLabels` + `prevTipLabels` prop'ları eklendi; `heatmapLabelProps(viewMode)` helper'ı rolling'de ROLLING_LABELS/P12_LABELS, takvimde "Oca 25"/"Oca 24" geçirir. Ay bilgisi metriklerde olduğu için tooltip başlığından kaldırıldı. Line chart tooltip'iyle aynı okuma.
- **Doğrulama:** stanley termos modalinde gri kesikli çizgi Haz 26'ya kadar net; Özet + Kategoriler heatmap tooltip'leri her iki görünümde doğru; `npm test` 20/20; console hatasız.

### Üçüncü tur (aynı gün)

- **Tweaks butonu topbar'dan kaldırıldı** (app.jsx): ön yüzde görünmesine gerek yok. Panel kodu (`.tweaks-panel`, tema/palet seçicileri) duruyor ve edit mode entegrasyonu (`__activate_edit_mode` postMessage) üzerinden hâlâ açılabiliyor. Topbar'da Paylaş + tema (Dark/Light) düğmeleri kaldı; tema toggle'ı doğrulandı.
