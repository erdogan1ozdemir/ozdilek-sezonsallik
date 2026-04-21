# Seasonal Keyword Dashboard — Template

Brand-agnostic, Turkish-language keyword seasonality dashboard. Ships with an example VitrA dataset so it runs out of the box; drop in your own Excel, logo, and brand config to produce a new brand's dashboard.

---

## Ne işe yarar?

- 2024 ↔ 2025 YoY keyword arama hacmi karşılaştırması
- Kat 1 / Kat 2 / Kat 3 3-seviyeli kategori hiyerarşisi
- Sezonsallık heatmap (12 ay × kategori)
- Yükselen / düşen keyword trendleri
- Fiyat intent analizi
- Hacim kartili (top 25% → tail) segmentasyonu

Vercel (statik) veya Railway (Node/Express) üzerinden deploy edilebilir.

---

## Hızlı başlangıç — Claude Code ile (önerilen)

Ekip üyesi Claude Code'a şu prompt'u verir:

```
Şu template'i kullan: https://github.com/<org>/seasonal-keyword-dashboard

Yeni marka dashboard'u kurmak istiyorum:
- Excel: /path/to/brand-keywords.xlsx
- Logo: /path/to/brand-logo.svg   (veya .png)
- Marka adı: "Acme"
- Başlık: "Acme · Keyword Intelligence"
- Altyazı: "Türkiye · Acme Portföyü"
- Agency göster: evet / hayır

Hedef klasör: ~/Projects/acme-dashboard
Build al, hazır hale getir.
```

Claude Code otomatik olarak:
1. Template repo'yu klonlar (`git clone ... acme-dashboard`)
2. Excel'i `data/source.xlsx` olarak kopyalar
3. Logoyu `assets/brand-logo.*` olarak kopyalar
4. `brand.config.js`'i düzenler (name, title, subtitle, slug)
5. `npm install && npm run build` çalıştırır
6. `git init` + ilk commit atar

Sonra siz GitHub'da yeni repo oluşturup push edin, Vercel'e import edin.

---

## Manuel kurulum (7 adım)

1. **Klonla**
   ```bash
   git clone https://github.com/<org>/seasonal-keyword-dashboard my-brand-dashboard
   cd my-brand-dashboard
   rm -rf .git && git init
   ```

2. **Excel'i yerleştir** — `data/source.xlsx` olarak kopyala. [Excel şeması](#excel-şeması) bölümüne uygun olmalı.

3. **Logoları değiştir** — dosya adları sabit kalmalı:
   - `assets/brand-logo.svg` (veya `.png`) — ana marka logosu
   - `assets/agency-logo.png` — opsiyonel, ajans/partner logosu
   - `assets/agency-logo-small.png` — opsiyonel, footer'da görünür

4. **`brand.config.js`'i düzenle** — marka adı, başlık, renkler. [Full reference](#brandconfigjs-reference) aşağıda.

5. **Build al**
   ```bash
   npm install
   npm run build
   ```
   `data/dashboard.js` oluşacak (~1.3 MB). Bu dosya git'e commit'lenmeli.

6. **Test et**
   ```bash
   npm start
   # open http://localhost:3000
   ```
   Tüm 5 tab (Özet, Kategoriler, Keyword, Trendler, Fiyat Intent) açılıyor, console'da hata yok → hazır.

7. **Commit + push + Vercel import**
   ```bash
   git add .
   git commit -m "init: my-brand dashboard"
   gh repo create <org>/my-brand-dashboard --public --source=. --push
   ```
   Vercel → Add New → Project → GitHub repo seç → Deploy. Ek config gerekmez (`vercel.json` hazır).

---

## Excel şeması

Source dosyası 11 sheet içermeli. Sheet'lere göre header konumları değişir:

- **`Sezonsallık`**, **`Kat 1 Sez.`**, **`Kat 2 Sez.`**, **`Kat 3 Sez.`** — row 0 header, rows 1+ data (açıklama satırı YOK)
- **Diğer 7 sheet** — row 0 açıklama metni, row 1 header, rows 2+ data

### 1. `Sezonsallık` (zorunlu)

Tüm keyword'leri içeren ana sheet. Kolonlar:

| Kolon | Tip | Açıklama |
|---|---|---|
| Kat 1 | string | Üst kategori (en fazla 10 farklı değer önerilir) |
| Kat 2 | string | Alt kategori |
| Kat 3 | string | En alt kategori |
| Keyword | string | Arama terimi |
| 2024 Avg. Search Volume | number | Aylık ortalama 2024 |
| 2025 Avg. Search Volume | number | Aylık ortalama 2025 |
| YoY change | number | Oran (0.15 = +%15) |
| 2025 \nQ1 Peak / \nQ2 / \nQ3 / \nQ4 Peak | 0/1 | Peak bu çeyrekte mi (header'da embedded newline var) |
| En Yuksek Ay? | serial | Excel tarih serial (en yüksek ay) |
| \<12 × Excel serial\> | number | 2024 Jan–Dec aylık hacim |
| Bucket | string | Hacim bandı ("0-1.000", "1.000-2.000", vs.) |
| \<12 × Excel serial\> | number | 2025 Jan–Dec aylık hacim |

"VitrA Not" gibi brand-specific kolonlar varsa yok sayılır — zarar vermez.

### 2. `Özet Dashboard`

Kat 1 özeti. Kolonlar: `Kat 1`, `Keyword Sayısı`, `2024 Toplam Hacim`, `2025 Toplam Hacim`, `YoY Değişim`, `Pazar Payı (2025)`, `Peak Çeyrek`, `En Yüksek Hacimli 3 Keyword`, `En Çok Artan Keyword`, `En Çok Düşen Keyword`.

### 3. `Kat 1 Sez.` / `Kat 2 Sez.` / `Kat 3 Sez.`

Kat bazında aylık aggregate. Kolonlar: (Kat N × N), `2024 Avg. Search Volume`, `2025 Avg. Search Volume`, `YoY Change`, `Q1-Q4 Peak` (header'da \n var), `En Yuksek Ay?`, 12 aylık SUM (`SUM of Jan 2025` ... `SUM of Dec 2025`).

### 4. `Top Yükselen & Düşenler`

Kolonlar: `Kat 1`, `Kat 2`, `Kat 3`, `Keyword`, `2024 Avg`, `2025 Avg`, `YoY Değişim`, `Trend` (YÜKSELEN/DÜŞEN).

### 5. `Sezonsallık Tipi`

Kolonlar: `Kat 1`, `Kat 2`, `Keyword`, `2025 Avg`, `CV Skoru`, `Mevsimsellik Tipi` (Evergreen / Orta Mevsimsellik / Yüksek Mevsimsellik), `Peak Ay`, `Dip Ay`, `Peak/Dip Oranı`.

### 6. `Peak Quarter Analizi`

Kolonlar: `Kat 1`, `Kat 2`, `KW Sayısı`, `Toplam Hacim`, `Q1 Peak %`, `Q2 Peak %`, `Q3 Peak %`, `Q4 Peak %`, `Baskın Çeyrek`.

### 7. `Akıllı Ürün Trendi`

Kolonlar: `Kat 1`, `Kat 2`, `Keyword`, `2024 Avg`, `2025 Avg`, `YoY Değişim`, `Peak Ay`, `Segment Tag`.

### 8. `Fiyat Intent`

Kolonlar: `Kat 1`, `Kat 2`, `Keyword`, `2024 Avg`, `2025 Avg`, `YoY Değişim`, `Peak Ay`.

### 9. `Hacme Göre Top KWs`

İki bölümlü sheet:
- **Rows 2-5:** Quartile özeti. Kolonlar: `Quartile`, `KW Sayısı`, `Toplam 2025 Hacim`, `Ort. 2025 Avg`, `Min-Max Hacim Aralığı`, `Ort. YoY Değişim`, `Artan KW %`, `Azalan KW %`, `Ort. CV (Mevsimsellik)`.
- **Row 8 header, rows 9+:** Quartile başına top keyword'ler. Kolonlar: `Quartile`, `Keyword`, `Kat 1`, `Kat 2`, `2025 Avg`, `YoY Değişim`, `CV`, `Peak Ay`, `Trend Yönü` (Artan/Azalan/Sabit).

---

## `brand.config.js` reference

```js
window.BRAND = {
  // ——— Identity ———
  name: "VitrA",                              // Header marka adı (kısa)
  title: "Sezonsallık & Keyword Intelligence", // Ana dashboard başlığı
  subtitle: "Türkiye · Banyo Pazarı",          // Logo altı ikinci satır
  lang: "tr",                                  // <html lang>

  // ——— Colors ———
  accent: null,                                // null → palette[0]; "#RRGGBB" override
  kat1ColorOverrides: {                        // Kat 1 renk override'ları
    // "Armatürler": "#0054A6"                 // sadece override istenen Kat1
  },

  // ——— Export / storage ———
  slug: "vitra",                               // CSV + localStorage prefix (lowercase)

  // ——— Agency (optional) ———
  agency: {
    name: "Inbound SEO",
    label: "Inbound",
    show: true                                 // false = ajans bloğunu gizle
  }
};
```

**Default'lar (alan boşsa):**
- `name` → `"Dashboard"`
- `title` → `"Keyword Intelligence"`
- `subtitle` → `""` (gizlenir)
- `lang` → `"tr"`
- `accent` → Kat 1 palette'inin ilk rengi
- `slug` → `"dashboard"`
- `agency.show` → `false`

**Auto palette** (Tableau 10 colorblind-friendly): `#4E79A7 #F28E2B #E15759 #76B7B2 #59A14F #EDC948 #B07AA1 #FF9DA7 #9C755F #BAB0AC`. Kat 1'ler 2025 toplam hacmine göre sıralanır, palette sırayla atanır.

---

## Geliştirme

### Lokal çalıştırma
```bash
npm install
npm run build        # xlsx → dashboard.js
npm start            # http://localhost:3000
```

### Testler
```bash
npm test             # node --test scripts/build-data.test.js
```

---

## Deploy

### Vercel (önerilen, statik)
1. github.com/\<org\>/\<your-repo\> → Vercel Import
2. Framework Preset: "Other" (otomatik algılar, `vercel.json` zaten ayarlı)
3. Deploy

### Railway (Node)
1. railway.app → New Project → Deploy from GitHub
2. Nixpacks Node.js buildpack otomatik
3. Healthcheck `/health` (300s timeout, `railway.json`'da tanımlı)

---

## Troubleshooting

**`Sezonsallık sheet not found`** — Excel'de sheet ismi tam olarak `Sezonsallık` olmalı (Türkçe karakterler önemli).

**`required column X not found`** — Sheet header kolonları README'deki şemaya uymalı. Mesajdaki kolon adını kontrol et. Bazı header'larda embedded newline vardır (örn. `2025 \nQ1 Peak`) — Excel'de Alt+Enter ile yazılmış olabilir.

**Tab boş görünüyor** — İlgili sheet Excel'de yoksa tab içeriği boşalır. Build sırasında warn log'u kontrol et.

**Accent color gözükmüyor** — `npm run build` çalıştırmayı unuttun mu? `data/dashboard.js` sonunda `window.BRAND_ACCENT = ...` satırı olmalı.

**Logo gözükmüyor** — `assets/brand-logo.svg` veya `.png` dosyası yerinde mi? SVG monochrome ise CSS `filter: brightness(0) invert(1)` ile beyaz yapılır.

---

© Seasonal Keyword Dashboard — brand-agnostic template
