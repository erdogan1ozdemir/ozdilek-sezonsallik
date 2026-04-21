// brand.config.js — customize this file for your brand
//
// All fields are optional; sensible defaults apply when omitted.
// See README.md for full documentation.

window.BRAND = {
  // ——— Identity ———
  name: "Özdilekteyim",                           // Short brand name shown in header
  title: "Sezonsallık & Keyword Intelligence",    // Main dashboard title
  subtitle: "Türkiye · Özdilekteyim Portföyü",    // Secondary line under the logo
  lang: "tr",                                     // <html lang> attribute

  // ——— Colors ———
  // accent: main UI accent color. null → auto (top-volume Kat 1 color from palette).
  //         string "#RRGGBB" → override (e.g. brand primary color).
  accent: "#F15B2A",                              // Özdilekteyim brand orange (logo gradient)

  // kat1ColorOverrides: per-category color override map. Empty → full auto-palette.
  kat1ColorOverrides: {},

  // ——— Export & storage ———
  slug: "ozdilekteyim",                           // CSV + localStorage prefix (lowercase)

  // ——— Agency (optional) ———
  agency: {
    name: "Inbound SEO",
    label: "Inbound",
    show: true
  }
};
