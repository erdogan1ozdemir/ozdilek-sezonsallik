// Utilities
window.U = (function(){
  const TR_MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const TR_MONTHS_LONG = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

  function fmtNum(n) {
    if (n == null || isNaN(n)) return '–';
    n = Math.round(n);
    if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(n%1e6===0?0:1).replace('.',',') + 'M';
    if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(n%1e3===0?0:1).replace('.',',') + 'K';
    return n.toLocaleString('tr-TR');
  }
  function fmtFull(n) {
    if (n == null || isNaN(n)) return '–';
    return Math.round(n).toLocaleString('tr-TR');
  }
  function fmtPct(n, digits=1) {
    if (n == null || isNaN(n)) return '–';
    const v = (n*100);
    return (v>0?'+':'') + v.toFixed(digits).replace('.',',') + '%';
  }
  function serialToMonthIdx(serial) {
    // Excel serial -> month index (0-11) within 2025
    if (!serial || typeof serial !== 'number') return null;
    const d = new Date((serial - 25569) * 86400000);
    return d.getUTCMonth();
  }
  function trendClass(yoy) { return yoy > 0 ? 'pos' : yoy < 0 ? 'neg' : 'neu'; }

  // Build monthly totals aggregation for a set of keywords
  function aggregateMonthly(kws, field='m25') {
    const out = new Array(12).fill(0);
    for (const k of kws) {
      for (let i=0;i<12;i++) out[i] += (k[field]?.[i] || 0);
    }
    return out;
  }

  // Heatmap color scale — Google Sheets style: red (low) → yellow (mid) → green (high)
  // #e67c73 → #fbbc04 → #57bb8a
  function lerp(a, b, t) { return Math.round(a + (b-a)*t); }
  function hmColor(t, palette='coral') {
    t = Math.max(0, Math.min(1, t));
    // red e67c73 = (230,124,115), yellow fbbc04 = (251,188,4), green 57bb8a = (87,187,138)
    if (t < 0.5) {
      const k = t*2;
      const r = lerp(230, 251, k);
      const g = lerp(124, 188, k);
      const b = lerp(115, 4, k);
      return `rgb(${r},${g},${b})`;
    } else {
      const k = (t-0.5)*2;
      const r = lerp(251, 87, k);
      const g = lerp(188, 187, k);
      const b = lerp(4, 138, k);
      return `rgb(${r},${g},${b})`;
    }
  }
  function hmText(t) {
    // Red/green ends are dark enough for white; yellow midband needs dark text
    return (t > 0.75 || t < 0.25) ? 'white' : '#10332F';
  }

  // CSV export
  function toCSV(rows, headers) {
    const esc = v => {
      if (v == null) return '';
      const s = String(v);
      if (/[,"\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
      return s;
    };
    const lines = [headers.map(h=>h.label).join(',')];
    for (const r of rows) lines.push(headers.map(h => esc(typeof h.get==='function'?h.get(r):r[h.key])).join(','));
    return lines.join('\n');
  }
  function downloadCSV(name, csv) {
    const blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 500);
  }

  // Simple debounce
  function debounce(fn, ms=150) {
    let t; return (...a) => { clearTimeout(t); t=setTimeout(()=>fn(...a), ms); };
  }

  // Sparkline SVG path
  function sparkPath(values, w, h, pad=1) {
    if (!values || !values.length) return {line:'', area:'', min:0, max:0};
    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;
    const n = values.length;
    const xs = values.map((_,i) => pad + (i * (w - 2*pad)) / (n-1));
    const ys = values.map(v => pad + (h - 2*pad) - ((v - min) / range) * (h - 2*pad));
    let line = 'M' + xs.map((x,i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' L');
    let area = line + ` L${xs[n-1].toFixed(1)},${h-pad} L${xs[0].toFixed(1)},${h-pad} Z`;
    return {line, area, min, max};
  }

  // Quartile bucket
  function quarterName(i) { return 'Q' + (Math.floor(i/3)+1); }

  return {
    TR_MONTHS, TR_MONTHS_LONG,
    fmtNum, fmtFull, fmtPct, serialToMonthIdx, trendClass,
    aggregateMonthly, hmColor, hmText,
    toCSV, downloadCSV, debounce, sparkPath, quarterName,
  };
})();
