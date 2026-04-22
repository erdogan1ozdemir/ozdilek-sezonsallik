// Reusable components
window.C = (function(){
  const { fmtNum, fmtFull, fmtPct, TR_MONTHS, TR_MONTHS_LONG, hmColor, hmText, sparkPath, serialToMonthIdx } = U;
  const h = React.createElement;
  const BRAND_SLUG = ((window.BRAND && window.BRAND.slug) || 'dashboard').replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'dashboard';

  // ======== FloatingTooltip ========
  // Portal-rendered, viewport-positioned tooltip. Escapes overflow:auto/hidden parents
  // and sits above sticky headers via high z-index. Used by all chart hovers.
  //
  // Props:
  //   x, y        - viewport coords of the anchor (use getBoundingClientRect on the cell/point)
  //   placement   - 'top' | 'bottom' | 'right' (default 'top'); auto-flips if it would clip
  //   className   - wrapper class (default 'chart-tip')
  function FloatingTooltip({ x, y, placement = 'top', offset = 10, className = 'chart-tip', children }) {
    const ref = React.useRef(null);
    React.useLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;
      const w = el.offsetWidth;
      const hh = el.offsetHeight;
      const pad = 12;
      let left = x - w / 2;
      let top = placement === 'bottom' ? y + offset : y - hh - offset;
      // If placement 'top' would clip above viewport, flip to bottom of anchor
      if (top < pad) top = y + offset;
      // If placement 'bottom' would clip below viewport, flip up
      if (top + hh + pad > window.innerHeight) top = Math.max(pad, y - hh - offset);
      // Horizontal clamping
      if (left + w + pad > window.innerWidth) left = window.innerWidth - w - pad;
      if (left < pad) left = pad;
      el.style.left = left + 'px';
      el.style.top = top + 'px';
    });
    return ReactDOM.createPortal(
      h('div', {
        ref, className,
        style: { position: 'fixed', left: -9999, top: -9999, zIndex: 2000, pointerEvents: 'none' }
      }, children),
      document.body
    );
  }

  // ======== Tooltip singleton ========
  function useTooltip() {
    const [tip, setTip] = React.useState(null);
    const tipRef = React.useRef(null);
    const showTip = (e, content) => {
      setTip({ x: e.clientX, y: e.clientY, content });
    };
    const moveTip = (e) => {
      setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null);
    };
    const hideTip = () => setTip(null);

    // Adjust position after render to keep tip on-screen
    React.useLayoutEffect(() => {
      const el = tipRef.current;
      if (!el || !tip) return;
      const w = el.offsetWidth, hh = el.offsetHeight;
      const pad = 12;
      let left = tip.x + 14;
      let top  = tip.y - 10;
      if (left + w + pad > window.innerWidth)  left = tip.x - w - 14;
      if (top  + hh + pad > window.innerHeight) top  = tip.y - hh - 14;
      if (left < pad) left = pad;
      if (top  < pad) top  = pad;
      el.style.left = left + 'px';
      el.style.top  = top  + 'px';
    });

    const tipEl = tip && h('div', {
      ref: tipRef,
      className:'chart-tip',
      style:{ left: -9999, top: -9999 }
    }, tip.content);
    return { tipEl, showTip, moveTip, hideTip };
  }

  function Kpi({label, value, sub, chip, chipClass='neu', accent=false}) {
    // Detect text-like values (long strings, non-numeric) and scale font down
    const v = value == null ? '–' : value;
    const isTexty = typeof v === 'string' && v.length > 10 && !/^[\d\s\-+.,%MKB]+$/.test(v);
    return h('div', {className:'kpi', title: typeof v === 'string' ? v : undefined},
      accent && h('div',{className:'bar'}),
      h('div',{className:'label'}, label),
      h('div',{className:'value' + (isTexty ? ' kpi-text' : '')}, v),
      sub && h('div',{className:'sub'},
        chip && h('span',{className:'chip '+chipClass}, chip),
        sub
      )
    );
  }

  function YoYPill({yoy, type='YoY', tip}) {
    if (yoy == null || isNaN(yoy)) return h('span',{className:'pill neu', title: tip || type}, '–');
    const cls = yoy > 0.02 ? 'pos' : yoy < -0.02 ? 'neg' : 'neu';
    const icon = yoy > 0.02 ? '↑' : yoy < -0.02 ? '↓' : '→';
    const title = tip || `${type}: ${fmtPct(yoy, 1)} ${type === 'YoY' ? '(2024 → 2025)' : type === 'MoM' ? '(önceki aya göre)' : ''}`.trim();
    return h('span',{className:'pill '+cls, title}, icon+' '+fmtPct(yoy, 0));
  }

  function Sparkline({values, w=90, h:height=26, color}) {
    if (!values || values.length < 2) return h('svg',{width:w,height:height});
    const {line, area} = sparkPath(values, w, height, 2);
    const stroke = color || 'var(--accent)';
    return h('svg',{className:'spark', width:w, height:height, viewBox:`0 0 ${w} ${height}`, preserveAspectRatio:'none'},
      h('path',{className:'area', d:area, fill:stroke, fillOpacity:.15}),
      h('path',{d:line, stroke, strokeWidth:1.4, fill:'none', strokeLinecap:'round', strokeLinejoin:'round'})
    );
  }

  // Heatmap with hover-value label
  function Heatmap({rows, monthsLabels=TR_MONTHS, onClickCell, showPeakDot=true, showValues=true, year=null, showYoY=false}) {
    const [hover, setHover] = React.useState(null); // { ri, i, x, y, row, v, prev, yoy, isPeak }
    const hostRef = React.useRef(null);
    const grid = [];
    // Corner - show year label if provided
    grid.push(h('div',{className:'hm-head hm-corner', key:'corner'},
      year != null && h('span',{className:'hm-year'}, year)
    ));
    monthsLabels.forEach((m,i) => grid.push(h('div',{key:'h'+i, className:'hm-head'}, m)));
    rows.forEach((row, ri) => {
      const max = Math.max(...row.values);
      const min = Math.min(...row.values);
      const range = max - min || 1;
      grid.push(h('div',{key:'l'+ri, className:'hm-row-label', title:row.label},
        h('span',{style:{fontWeight:500, lineHeight:1.2}}, row.label),
        row.sub && h('span',{className:'txt-3', style:{fontSize:9, lineHeight:1.2, marginTop:2}}, row.sub)
      ));
      row.values.forEach((v,i) => {
        const t = (v - min) / range;
        const isPeak = row.peakIdx === i || (row.peakIdx==null && i === row.values.indexOf(max));
        const prev = row.prevValues ? row.prevValues[i] : null;
        const yoy = (showYoY && prev != null && prev > 0) ? (v - prev) / prev : null;
        const yoyCls = yoy == null ? '' : (yoy > 0.02 ? 'yoy-pos' : yoy < -0.02 ? 'yoy-neg' : 'yoy-neu');
        grid.push(h('div',{
          key:`c${ri}-${i}`,
          className:'hm-cell'+(isPeak&&showPeakDot?' peak':'')+(showYoY?' with-yoy':''),
          style:{ background: hmColor(t), color: hmText(t) },
          onMouseEnter: (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setHover({
              ri, i, row, v,
              prev: row.prevValues ? row.prevValues[i] : null,
              yoy,
              isPeak,
              month: monthsLabels[i],
              x: rect.left + rect.width/2,
              y: rect.top
            });
          },
          onMouseLeave: () => setHover(null),
          onClick: onClickCell ? () => onClickCell(row, i) : undefined
        },
          showValues && h('span',{className:'hm-val'}, fmtNum(v)),
          showYoY && yoy != null && h('span',{className:'hm-yoy '+yoyCls}, (yoy>=0?'+':'') + fmtPct(yoy, 0).replace('+',''))
        ));
      });
    });
    return h('div',{className:'heatmap-host', ref:hostRef, style:{position:'relative'}},
      h('div',{className:'heatmap'+(showYoY?' with-yoy':'')}, grid),
      hover && h(FloatingTooltip, { x: hover.x, y: hover.y, placement: 'top', className: 'hm-tooltip' },
        h('div',{className:'hm-tt-header'},
          hover.isPeak && h('span',{className:'hm-tt-peak-dot'}),
          h('span',{className:'hm-tt-title'}, hover.row.label),
          h('span',{className:'hm-tt-sub'}, ' · ', hover.month)
        ),
        h('div',{className:'hm-tt-metrics'},
          h('div',{className:'hm-tt-metric'},
            h('div',{className:'hm-tt-m-label'}, year || '2025'),
            h('div',{className:'hm-tt-m-val'}, fmtFull(hover.v))
          ),
          hover.prev != null && h('div',{className:'hm-tt-metric'},
            h('div',{className:'hm-tt-m-label'}, (year ? year-1 : 2024)),
            h('div',{className:'hm-tt-m-val', style:{color:'var(--ink-3)'}}, fmtFull(hover.prev))
          ),
          hover.yoy != null && h('div',{className:'hm-tt-metric'},
            h('div',{className:'hm-tt-m-label'}, 'YoY'),
            h('div',{className:'hm-tt-m-val', style:{color: hover.yoy > 0 ? 'var(--green)' : hover.yoy < 0 ? 'var(--red)' : 'var(--ink-2)'}},
              (hover.yoy >= 0 ? '+' : '') + fmtPct(hover.yoy, 1)
            )
          )
        ),
        hover.isPeak && h('div',{className:'hm-tt-footer'}, '★ Yılın peak ayı')
      )
    );
  }

  function ShareBars({rows, onClickRow, activeLabels}) {
    const sorted = [...rows].sort((a,b) => b.value - a.value);
    const max = sorted[0]?.value || 1;
    const activeSet = activeLabels ? new Set(activeLabels) : null;
    return h('div',{style:{display:'flex',flexDirection:'column',gap:10}},
      sorted.map((r,i) => {
        const isActive = activeSet ? activeSet.has(r.label) : false;
        const canClick = typeof onClickRow === 'function';
        return h('div',{
          key:i,
          className: canClick ? 'share-row clickable' : 'share-row',
          onClick: canClick ? () => onClickRow(r.label) : undefined,
          style: {
            cursor: canClick ? 'pointer' : 'default',
            padding: canClick ? '4px 6px' : 0,
            margin: canClick ? '-4px -6px' : 0,
            borderRadius: 6,
            background: isActive ? 'color-mix(in srgb, var(--coral) 10%, transparent)' : 'transparent',
            transition: 'background .15s'
          }
        },
          h('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:12}},
            h('div',null,
              isActive && h('span',{style:{marginRight:4,color:'var(--coral-deep)',fontSize:10}}, '●'),
              h('span',{style:{fontWeight:600}}, r.label),
              r.share != null && h('span',{className:'txt-3', style:{marginLeft:6}}, ' ' + (r.share*100).toFixed(1).replace('.',',')+'%')
            ),
            h('div',{className:'num', style:{fontWeight:600}, title: fmtFull(r.value)}, fmtNum(r.value),
              r.yoy != null && h('span',{style:{marginLeft:8}}, h(YoYPill,{yoy:r.yoy}))
            )
          ),
          h('div',{className:'tree-bar'},
            h('div',{className:'fill', style:{width:(r.value/max*100)+'%', background: r.color || 'var(--accent)'}})
          )
        );
      })
    );
  }

  function QStack({q1, q2, q3, q4}) {
    const colors = ['#3B82F6','#EF4444','#F59E0B','#10B981'];
    const parts = [q1,q2,q3,q4];
    const sum = parts.reduce((a,b)=>a+b,0) || 1;
    return h('div',{className:'q-stack'},
      parts.map((v,i) => v > 0 && h('div',{
        key:i, className:'seg',
        style:{ width:(v/sum*100)+'%', background: colors[i] },
        title: `Q${i+1}: ${(v*100).toFixed(0)}%`
      }, (v*100>8) ? (v*100).toFixed(0)+'%' : ''))
    );
  }

  function Modal({children, onClose}) {
    React.useEffect(() => {
      const onK = e => e.key === 'Escape' && onClose();
      window.addEventListener('keydown', onK);
      document.body.style.overflow = 'hidden';
      return () => { window.removeEventListener('keydown', onK); document.body.style.overflow=''; };
    }, []);
    return h('div',{className:'modal-backdrop', onClick:e => e.target===e.currentTarget && onClose()},
      h('div',{className:'modal'},
        h('div',{style:{display:'flex',justifyContent:'flex-end',marginBottom:4}},
          h('button',{className:'modal-close', onClick:onClose}, '×')
        ),
        children
      )
    );
  }

  // === Zoomable - chart'ı "Büyüt" butonu ile fullscreen modal'da açar.
  // Mobilde her chart'ın yanına genişletme butonu: tıklayınca modal açılır,
  // chart modal içinde belli ölçüde rescale edilir. Pinch-zoom da serbest.
  function Zoomable({title, children, aspect='wide'}) {
    const [open, setOpen] = React.useState(false);
    return h(React.Fragment, null,
      h('button',{
        className:'zoom-btn',
        onClick: () => setOpen(true),
        title: 'Büyüt / odakla',
        'aria-label': 'Büyüt'
      },
        h('svg',{width:14, height:14, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round'},
          h('path',{d:'M15 3h6v6'}),
          h('path',{d:'M9 21H3v-6'}),
          h('path',{d:'M21 3l-7 7'}),
          h('path',{d:'M3 21l7-7'})
        )
      ),
      open && ReactDOM.createPortal(
        h('div',{className:'zoom-overlay', onClick: e => e.target === e.currentTarget && setOpen(false)},
          h('div',{className:'zoom-content zoom-' + aspect},
            h('div',{className:'zoom-head'},
              h('div',{className:'zoom-title'}, title || 'Grafik'),
              h('button',{className:'zoom-close', onClick:()=>setOpen(false), 'aria-label':'Kapat'}, '×')
            ),
            h('div',{className:'zoom-body'}, children)
          )
        ),
        document.body
      )
    );
  }

  // === LineChart with crosshair tooltip ===
  // Responsive: ResizeObserver ile container genişliğini ölçer, viewBox buna göre
  // kurulur. SVG fixed height prop ile çizilir, aspect ratio bozulmaz, taşma olmaz.
  function LineChart({series, height=220, labels=TR_MONTHS, yFormat=fmtNum, legend}) {
    const [hoverI, setHoverI] = React.useState(null);
    const wrapRef = React.useRef(null);
    const svgRef = React.useRef(null);
    const [containerW, setContainerW] = React.useState(720);

    React.useLayoutEffect(() => {
      const el = wrapRef.current;
      if (!el || typeof ResizeObserver === 'undefined') return;
      const set = () => { const cw = el.clientWidth; if (cw > 0) setContainerW(cw); };
      set();
      const ro = new ResizeObserver(set);
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    const w = Math.max(320, containerW), pad = {t:16, r:16, b:28, l:48};
    const cw = w - pad.l - pad.r;
    const ch = height - pad.t - pad.b;
    const all = series.flatMap(s => s.values || []).filter(v => v != null);
    const max = Math.max(...all, 1);
    const range = max || 1;
    const n = labels.length;
    const xs = Array.from({length:n}, (_,i) => pad.l + (i*cw)/(n-1));
    const yAt = v => pad.t + ch - (v/range)*ch;
    const ticks = 4;
    const tickVals = Array.from({length:ticks+1}, (_,i) => (range*i)/ticks);

    function onMove(e) {
      const svg = svgRef.current;
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * w;
      // nearest index
      let best = 0, bestD = Infinity;
      for (let i=0;i<n;i++) { const d = Math.abs(xs[i]-x); if (d < bestD) { bestD = d; best = i; } }
      setHoverI(best);
    }
    function onLeave() { setHoverI(null); }

    return h('div',{ref: wrapRef, className:'chart-wrap', style:{position:'relative', width:'100%'}},
      legend && h('div',{className:'legend', style:{marginBottom:8}},
        series.map((s,i) => h('div',{key:i,className:'li'},
          h('div',{className:'swatch', style:{background:s.color}}),
          h('span', null, s.name)
        ))
      ),
      h('svg',{
        ref: svgRef,
        viewBox:`0 0 ${w} ${height}`,
        width: w, height,
        style:{width:'100%', height, display:'block', cursor:'crosshair'},
        onMouseMove: onMove, onMouseLeave: onLeave
      },
        tickVals.map((t,i) => h('g',{key:'t'+i},
          h('line',{x1:pad.l, x2:pad.l+cw, y1:yAt(t), y2:yAt(t), stroke:'var(--line)', strokeDasharray:i===0?'':'2 3'}),
          h('text',{x:pad.l-6, y:yAt(t)+3, fontSize:10, fill:'var(--ink-3)', textAnchor:'end'}, yFormat(t))
        )),
        labels.map((l,i) => h('text',{key:'x'+i, x:xs[i], y:height-8, fontSize:10, fill:'var(--ink-3)', textAnchor:'middle'}, l)),
        series.map((s,si) => {
          if (!s.values) return null;
          const path = 'M' + s.values.map((v,i) => v==null?null:`${xs[i]},${yAt(v)}`).filter(Boolean).join(' L');
          return h('g',{key:'s'+si},
            h('path',{d:path, fill:'none', stroke:s.color||'var(--accent)', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round'}),
            s.values.map((v,i) => v==null?null:h('circle',{
              key:'d'+i, cx:xs[i], cy:yAt(v), r: hoverI===i ? 5 : (s.peakIdx===i?4:3),
              fill: s.peakIdx===i ? '#E85F36' : (s.color||'var(--accent)'),
              stroke:'white', strokeWidth:1.5
            }))
          );
        }),
        hoverI != null && h('line',{x1:xs[hoverI], x2:xs[hoverI], y1:pad.t, y2:pad.t+ch, stroke:'var(--ink-3)', strokeDasharray:'3 3'})
      ),
      // Tooltip panel - portal to body so it escapes chart clipping and sticky headers
      hoverI != null && (() => {
        const r = svgRef.current?.getBoundingClientRect();
        if (!r) return null;
        const anchorX = r.left + (xs[hoverI] / w) * r.width;
        const anchorY = r.top + (pad.t / height) * r.height;
        return h(FloatingTooltip, { x: anchorX, y: anchorY, placement: 'top' },
          h('div',{style:{fontWeight:600, marginBottom:2}}, labels[hoverI]),
          series.map((s,i) => h('div',{key:i, style:{display:'flex',alignItems:'center',gap:6,fontSize:11}},
            h('div',{style:{width:8,height:8,borderRadius:2,background:s.color||'var(--accent)'}}),
            h('span',{style:{color:'var(--ink-2)'}}, s.name+': '),
            h('span',{className:'num',style:{fontWeight:600}}, yFormat(s.values?.[hoverI]))
          ))
        );
      })()
    );
  }

  // === BarChart with hover tooltip ===
  // Responsive: observes container width via ResizeObserver and redraws at that width
  // (so aspect ratio doesn't squash the chart in narrow cards).
  function BarChart({data, height=220, yFormat=fmtPct, colorBy='yoy', onBarClick}) {
    const [hoverI, setHoverI] = React.useState(null);
    const wrapRef = React.useRef(null);
    const svgRef = React.useRef(null);
    const [containerW, setContainerW] = React.useState(720);

    React.useLayoutEffect(() => {
      const el = wrapRef.current;
      if (!el || typeof ResizeObserver === 'undefined') return;
      const set = () => { const cw = el.clientWidth; if (cw > 0) setContainerW(cw); };
      set();
      const ro = new ResizeObserver(set);
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    const w = Math.max(320, containerW);
    const pad = {t:20, r:16, b:56, l:44};
    const cw = w - pad.l - pad.r, ch = height - pad.t - pad.b;
    const vals = data.map(d=>d.value);
    const maxV = Math.max(...vals, 0), minV = Math.min(...vals, 0);
    const range = maxV - minV || 1;
    const yAt = v => pad.t + ch - ((v-minV)/range)*ch;
    const n = data.length;
    const bw = cw / n * .7;
    const step = cw / n;
    const zero = yAt(0);
    return h('div',{ref: wrapRef, style:{position:'relative', width:'100%'}},
      h('svg',{
        ref: svgRef,
        viewBox:`0 0 ${w} ${height}`,
        width: w, height,
        style:{width:'100%', height, display:'block'}
      },
        h('line',{x1:pad.l, x2:pad.l+cw, y1:zero, y2:zero, stroke:'var(--line)'}),
        data.map((d,i) => {
          const x = pad.l + i*step + (step-bw)/2;
          const y = Math.min(zero, yAt(d.value));
          const hh = Math.abs(yAt(d.value) - zero);
          const color = d.color || (colorBy==='yoy' ? (d.value > 0 ? '#2E7D32' : '#D32F2F') : 'var(--accent)');
          return h('g',{key:i, onMouseEnter:()=>setHoverI(i), onMouseLeave:()=>setHoverI(null), onClick:()=>onBarClick && onBarClick(d), style:{cursor:onBarClick?'pointer':'default'}},
            h('rect',{x, y, width:bw, height:hh, fill:color, opacity: hoverI===i ? 1 : .85, rx:3}),
            h('text',{x:x+bw/2, y:d.value>=0 ? y-6 : y+hh+14, fontSize:10, fill:'var(--ink-2)', textAnchor:'middle', fontFamily:'Bricolage Grotesque', fontWeight:600}, yFormat(d.value)),
            h('text',{x:x+bw/2, y:height-32, fontSize:9, fill:'var(--ink-3)', textAnchor:'middle', transform:`rotate(-28 ${x+bw/2} ${height-32})`}, d.label.length>22?d.label.slice(0,22)+'…':d.label)
          );
        })
      ),
      hoverI != null && (() => {
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (!svgRect) return null;
        const barCenterX = pad.l + hoverI*step + step/2;
        const barTopY = Math.min(zero, yAt(data[hoverI].value));
        const anchorX = svgRect.left + (barCenterX / w) * svgRect.width;
        const anchorY = svgRect.top + (barTopY / height) * svgRect.height;
        return h(FloatingTooltip, { x: anchorX, y: anchorY, placement: 'top' },
          h('div',{style:{fontWeight:600, whiteSpace:'normal'}}, data[hoverI].label),
          h('div',{className:'num'}, yFormat(data[hoverI].value))
        );
      })()
    );
  }

  // === Interactive Donut with hover tooltip ===
  function Donut({data, size=180, innerRatio=.6, onSliceClick}) {
    const [hoverI, setHoverI] = React.useState(null);
    const total = data.reduce((a,b)=>a+b.value,0) || 1;
    const cx = size/2, cy = size/2, r = size/2-2, ir = r*innerRatio;
    let acc = 0;
    const slicePaths = data.map((d,i) => {
      const a0 = acc/total * Math.PI*2 - Math.PI/2;
      acc += d.value;
      const a1 = acc/total * Math.PI*2 - Math.PI/2;
      const large = (a1-a0) > Math.PI ? 1 : 0;
      const mid = (a0+a1)/2;
      const offset = hoverI===i ? 4 : 0;
      const ox = Math.cos(mid)*offset, oy = Math.sin(mid)*offset;
      const x0 = cx + ox + Math.cos(a0)*r, y0 = cy + oy + Math.sin(a0)*r;
      const x1 = cx + ox + Math.cos(a1)*r, y1 = cy + oy + Math.sin(a1)*r;
      const xi1 = cx + ox + Math.cos(a1)*ir, yi1 = cy + oy + Math.sin(a1)*ir;
      const xi0 = cx + ox + Math.cos(a0)*ir, yi0 = cy + oy + Math.sin(a0)*ir;
      return {
        i, label: d.label, value: d.value, color: d.color, pct: d.value/total,
        d: `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${xi1},${yi1} A${ir},${ir} 0 ${large} 0 ${xi0},${yi0} Z`
      };
    });
    const hovered = hoverI!=null ? slicePaths[hoverI] : null;
    const svgRef = React.useRef(null);
    return h('div',{style:{position:'relative', width:size, height:size}},
      h('svg',{ref: svgRef, viewBox:`0 0 ${size} ${size}`, style:{width:size, height:size, display:'block'}},
        slicePaths.map(s => h('path',{
          key:s.i, d:s.d, fill:s.color, stroke:'var(--bg-card)', strokeWidth:1.5,
          style:{cursor: onSliceClick?'pointer':'default', transition:'opacity .15s'},
          opacity: hoverI==null || hoverI===s.i ? 1 : 0.4,
          onMouseEnter:()=>setHoverI(s.i),
          onMouseLeave:()=>setHoverI(null),
          onClick: onSliceClick ? () => onSliceClick(data[s.i]) : undefined
        })),
        // center label
        hovered ? h('g',null,
          h('text',{x:cx, y:cy-6, fontSize:14, fontFamily:'Bricolage Grotesque', fontWeight:600, fill:'var(--ink)', textAnchor:'middle'}, (hovered.pct*100).toFixed(1).replace('.',',')+'%'),
          h('text',{x:cx, y:cy+10, fontSize:10, fill:'var(--ink-3)', textAnchor:'middle'}, fmtNum(hovered.value))
        ) : h('g',null,
          h('text',{x:cx, y:cy-2, fontSize:11, fill:'var(--ink-3)', textAnchor:'middle'}, 'Toplam'),
          h('text',{x:cx, y:cy+13, fontSize:14, fontFamily:'Bricolage Grotesque', fontWeight:600, fill:'var(--ink)', textAnchor:'middle'}, fmtNum(total))
        )
      ),
      hovered && (() => {
        const r = svgRef.current?.getBoundingClientRect();
        if (!r) return null;
        const anchorX = r.left + r.width / 2;
        const anchorY = r.bottom;
        return h(FloatingTooltip, { x: anchorX, y: anchorY, placement: 'bottom' },
          h('div',{style:{display:'flex',alignItems:'center',gap:6}},
            h('div',{style:{width:8,height:8,borderRadius:2,background:hovered.color}}),
            h('span',{style:{fontWeight:600}}, hovered.label)
          ),
          h('div',{className:'num',style:{fontSize:11,color:'var(--ink-2)'}},
            fmtFull(hovered.value) + ' · ' + (hovered.pct*100).toFixed(1).replace('.',',') + '%'
          )
        );
      })()
    );
  }

  // === Info icon with centered modal popover ===
  function InfoIcon({children, title='Bilgi', className}) {
    const [open, setOpen] = React.useState(false);
    React.useEffect(() => {
      if (!open) return;
      const onKey = e => { if (e.key === 'Escape') setOpen(false); };
      document.addEventListener('keydown', onKey);
      // Prevent body scroll
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', onKey);
        document.body.style.overflow = prev;
      };
    }, [open]);
    return h(React.Fragment, null,
      h('button',{
        className: className || 'info-icon',
        onClick:(e)=>{e.stopPropagation(); setOpen(o=>!o);},
        'aria-label':'Bilgi'
      }, '?'),
      open && ReactDOM.createPortal(
        h('div',{className:'info-overlay', onClick:()=>setOpen(false)},
          h('div',{className:'info-modal', onClick:e=>e.stopPropagation()},
            h('div',{className:'info-modal-head'},
              h('span',{className:'info-modal-icon'},'ⓘ'),
              h('span',{className:'info-modal-title'}, title),
              h('button',{className:'info-modal-close', onClick:()=>setOpen(false), 'aria-label':'Kapat'}, '×')
            ),
            h('div',{className:'info-modal-body'}, children)
          )
        ),
        document.body
      )
    );
  }

  // === Expandable explainer ===
  // `icon` prop takes priority over `emoji` (emoji kept for backward compat);
  // pass a React SVG node via `icon` for distinctive visuals
  function Explainer({title, sub, emoji='📊', icon, children, defaultOpen=false}) {
    const [open, setOpen] = React.useState(() => {
      const saved = localStorage.getItem(`${BRAND_SLUG}.explainer.open`);
      return saved == null ? defaultOpen : saved === '1';
    });
    React.useEffect(() => { localStorage.setItem(`${BRAND_SLUG}.explainer.open`, open ? '1':'0'); }, [open]);
    return h('div',{className:'explainer'+(open?' open':'')},
      h('button',{className:'explainer-head', onClick:()=>setOpen(o=>!o)},
        icon
          ? h('span',{className:'explainer-icon'}, icon)
          : h('span',{className:'emoji'}, emoji),
        h('div',{className:'title-part'},
          h('div',{className:'main-title'}, title),
          sub && h('div',{className:'sub-title'}, sub)
        ),
        h('span',{className:'chevron'}, '▾')
      ),
      open && h('div',{className:'explainer-body'}, children)
    );
  }

  // MultiSelect - dropdown with checkboxes for multi-category selection
  function MultiSelect({label, options, selected, onChange, colorMap, maxDisplay=2, width=180, searchable=true}) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const ref = React.useRef(null);
    const inputRef = React.useRef(null);
    React.useEffect(() => {
      const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQuery(''); } };
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }, []);
    React.useEffect(() => {
      if (open && inputRef.current) { setTimeout(() => inputRef.current?.focus(), 10); }
    }, [open]);

    const toggle = (opt) => {
      if (selected.includes(opt)) onChange(selected.filter(o => o !== opt));
      else onChange([...selected, opt]);
    };
    const displayText = selected.length === 0 ? `Tüm ${label}` :
      selected.length === 1 ? selected[0] :
      selected.length <= maxDisplay ? selected.join(', ') :
      `${selected.length} seçili`;

    // Filter options by search query (case-insensitive, Turkish-friendly)
    const filteredOptions = React.useMemo(() => {
      if (!query.trim()) return options;
      const q = query.toLowerCase().trim();
      return options.filter(o => String(o).toLowerCase().includes(q));
    }, [options, query]);

    return h('div',{ref, className:'multiselect', style:{width}},
      h('button',{
        className:'multiselect-trigger' + (open?' open':''),
        onClick:()=>setOpen(!open)
      },
        h('span',{className:'ms-text'}, displayText),
        selected.length > 0 && h('span',{
          className:'ms-count',
          style:{marginLeft:'auto',marginRight:6,fontSize:10,padding:'1px 6px',borderRadius:8,background:'var(--coral-soft,rgba(255,123,83,.15))',color:'var(--coral-deep)',fontWeight:700}
        }, selected.length),
        h('span',{className:'ms-caret'}, '▾')
      ),
      open && h('div',{className:'multiselect-panel'},
        searchable && h('div',{className:'ms-search-wrap', style:{padding:'8px 10px 6px', borderBottom:'1px solid var(--line)'}},
          h('input',{
            ref: inputRef,
            type:'text',
            className:'ms-search',
            placeholder: `${label} ara…`,
            value: query,
            onChange: e => setQuery(e.target.value),
            style:{
              width:'100%', padding:'6px 10px', fontSize:12,
              border:'1px solid var(--line)', borderRadius:6,
              background:'var(--bg)', color:'var(--ink)', outline:'none'
            }
          })
        ),
        h('div',{className:'ms-actions'},
          h('button',{className:'ms-action', onClick:()=>onChange([])}, 'Hiçbiri'),
          h('button',{className:'ms-action', onClick:()=>onChange([...options])}, 'Hepsi'),
          query && h('span',{style:{fontSize:10,color:'var(--ink-3)',marginLeft:'auto',paddingRight:4}}, filteredOptions.length + '/' + options.length)
        ),
        h('div',{className:'ms-options'},
          filteredOptions.length === 0
            ? h('div',{className:'ms-empty', style:{padding:'14px 10px', fontSize:12, color:'var(--ink-3)', textAlign:'center'}}, 'Sonuç yok')
            : filteredOptions.map(opt => {
                const isChecked = selected.length === 0 ? false : selected.includes(opt);
                return h('label',{key:opt, className:'ms-option'},
                  h('input',{type:'checkbox', checked:isChecked, onChange:()=>toggle(opt)}),
                  colorMap && h('span',{className:'ms-swatch', style:{background:colorMap[opt]||'#888'}}),
                  h('span',{className:'ms-label'}, opt)
                );
              })
        )
      )
    );
  }

  // ======== Section Header ========
  // Visual: gradient bar on left + icon + title stack (big title + subtle desc)
  function SectionHeader({ icon, title, desc, accent = 'coral', actions }) {
    const accentColor = accent === 'coral' ? 'var(--coral)' :
                        accent === 'teal' ? 'var(--teal)' :
                        accent === 'blue' ? 'var(--brand-accent)' :
                        accent;
    return h('div',{className:'section-header'},
      h('div',{className:'sh-bar', style:{background:`linear-gradient(180deg, ${accentColor} 0%, color-mix(in srgb, ${accentColor} 60%, transparent) 100%)`}}),
      icon && h('div',{className:'sh-icon', style:{background:`color-mix(in srgb, ${accentColor} 14%, transparent)`, color: accentColor}}, icon),
      h('div',{className:'sh-text'},
        h('h2',{className:'sh-title'}, title),
        desc && h('div',{className:'sh-desc'}, desc)
      ),
      actions && h('div',{className:'sh-actions'}, actions)
    );
  }

  // ======== Small Multiples Grid ========
  // Grid of mini line/bar charts - one per category, all on same y-scale optional
  // items: [{label, color, values, sub}]
  function SmallMultiples({ items, height=56, monthsLabels=TR_MONTHS, yScale='shared', onClick }) {
    const globalMax = yScale === 'shared' ? Math.max(1, ...items.flatMap(it => it.values)) : null;
    return h('div',{className:'small-mults'},
      items.map((it, idx) => h(SmallMultipleItem, {
        key: it.label, item: it, idx,
        max: yScale === 'shared' ? globalMax : Math.max(1, ...it.values),
        height, monthsLabels, onClick
      }))
    );
  }

  function SmallMultipleItem({ item: it, max, height, monthsLabels, onClick }) {
    const [hoverI, setHoverI] = React.useState(null);
    const svgRef = React.useRef(null);
    const peakI = it.values.indexOf(Math.max(...it.values));
    const total = it.values.reduce((a,b)=>a+b,0);
    const color = it.color || 'var(--accent)';
    const activeI = hoverI != null ? hoverI : peakI;
    const activeValue = it.values[activeI];

    return h('div',{
      className:'sm-item'+(onClick?' clickable':''),
      onClick: onClick ? () => onClick(it) : undefined
    },
      h('div',{className:'sm-header'},
        h('div',{className:'sm-dot', style:{background: color}}),
        h('div',{className:'sm-label'}, it.label),
        it.yoy != null && h('span',{className:'pill '+(it.yoy>0.02?'pos':it.yoy<-0.02?'neg':'neu'),style:{marginLeft:'auto',fontSize:10,padding:'1px 6px'}}, fmtPct(it.yoy,0))
      ),
      h('div',{className:'sm-body', style:{position:'relative'}},
        h('svg',{
          ref: svgRef,
          viewBox:`0 0 ${12*8} ${height}`, preserveAspectRatio:'none',
          style:{width:'100%', height, cursor:'crosshair'},
          onMouseMove: (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const rel = (e.clientX - rect.left) / rect.width;
            const i = Math.max(0, Math.min(11, Math.floor(rel * 12)));
            setHoverI(i);
          },
          onMouseLeave: () => setHoverI(null)
        },
          it.values.map((v,i) => {
            const barH = (v / max) * (height - 6);
            const x = i * 8 + 1;
            const y = height - barH;
            const isPeak = i === peakI;
            const isHover = i === hoverI;
            return h('rect',{
              key:i, x, y, width:6, height: Math.max(1, barH),
              rx:1,
              fill: (isHover || isPeak) ? color : `color-mix(in srgb, ${color} 35%, transparent)`,
              style:{transition: 'fill .08s'}
            });
          })
        ),
        hoverI != null && (() => {
          const r = svgRef.current?.getBoundingClientRect();
          if (!r) return null;
          const anchorX = r.left + ((hoverI + 0.5) / 12) * r.width;
          const anchorY = r.top;
          return h(FloatingTooltip, { x: anchorX, y: anchorY, placement: 'top', className: 'sm-tip chart-tip' },
            h('div',{style:{fontWeight:700}}, monthsLabels[hoverI]),
            h('div',{style:{fontFamily:'Bricolage Grotesque', fontWeight:700}}, fmtFull(it.values[hoverI]))
          );
        })()
      ),
      h('div',{className:'sm-footer'},
        h('span',{className:'sm-peak'},
          hoverI != null ? monthsLabels[hoverI] + ': ' : 'Peak: ',
          h('strong',null, hoverI != null ? fmtFull(activeValue) : monthsLabels[peakI])
        ),
        h('span',{className:'sm-total'}, hoverI != null ? ('Toplam ' + fmtNum(total)) : fmtNum(total))
      )
    );
  }

  // ======== Radial/Polar Peak Chart ========
  // Shows 12 months as wedges, length = normalized monthly volume
  function PolarPeak({ values, monthsLabels=TR_MONTHS, size=280, color='var(--coral)', year=2025 }) {
    const cx = size/2, cy = size/2;
    const r_inner = size*0.18;
    const r_outer = size*0.44;
    const max = Math.max(...values) || 1;
    const peakIdx = values.indexOf(max);
    const total = values.reduce((a,b)=>a+b,0);

    // 12 wedges, starting at top (12 o'clock = -PI/2), going clockwise
    const wedgeAngle = (Math.PI * 2) / 12;
    const [hoverI, setHoverI] = React.useState(null);

    const wedges = values.map((v,i) => {
      const a0 = -Math.PI/2 + i * wedgeAngle;
      const a1 = a0 + wedgeAngle;
      const t = v / max;
      const r = r_inner + t * (r_outer - r_inner);
      // wedge path
      const x0a = cx + Math.cos(a0) * r_inner, y0a = cy + Math.sin(a0) * r_inner;
      const x1a = cx + Math.cos(a1) * r_inner, y1a = cy + Math.sin(a1) * r_inner;
      const x0b = cx + Math.cos(a0) * r,       y0b = cy + Math.sin(a0) * r;
      const x1b = cx + Math.cos(a1) * r,       y1b = cy + Math.sin(a1) * r;
      const path = `M ${x0a} ${y0a} L ${x0b} ${y0b} A ${r} ${r} 0 0 1 ${x1b} ${y1b} L ${x1a} ${y1a} A ${r_inner} ${r_inner} 0 0 0 ${x0a} ${y0a} Z`;
      const isPeak = i === peakIdx;
      const isHover = i === hoverI;
      return h('path',{
        key:i, d:path,
        fill: isPeak ? color : `color-mix(in srgb, ${color} ${30 + t*40}%, var(--bg-card))`,
        stroke: 'var(--bg-card)', strokeWidth: 1.5,
        style:{cursor:'pointer', opacity: isHover && hoverI != null ? 1 : (hoverI == null ? 1 : 0.45), transition:'opacity .1s'},
        onMouseEnter: () => setHoverI(i),
        onMouseLeave: () => setHoverI(null)
      });
    });

    // Month labels on outer ring
    const labels = monthsLabels.map((m,i) => {
      const a = -Math.PI/2 + (i + 0.5) * wedgeAngle;
      const r = r_outer + 14;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const isPeak = i === peakIdx;
      return h('text',{
        key:i, x, y,
        textAnchor:'middle', dominantBaseline:'middle',
        style:{
          fontSize: 10,
          fontFamily:'Bricolage Grotesque',
          fontWeight: isPeak ? 700 : 500,
          fill: isPeak ? color : 'var(--ink-2)'
        }
      }, m);
    });

    // Concentric reference rings
    const rings = [0.33, 0.66, 1.0].map((f,idx) => h('circle',{
      key:'ring'+idx, cx, cy, r: r_inner + f*(r_outer - r_inner),
      fill:'none', stroke:'var(--line)', strokeWidth:1, strokeDasharray:'2 3', opacity:0.5
    }));

    const activeI = hoverI != null ? hoverI : peakIdx;
    const activeV = values[activeI];

    return h('div',{className:'polar-peak'},
      h('svg',{viewBox:`0 0 ${size} ${size}`, style:{width:'100%',height:'auto',maxWidth:size}},
        rings,
        wedges,
        labels,
        // Center label
        h('text',{x:cx, y:cy-8, textAnchor:'middle', style:{fontSize:10,fontFamily:'Outfit',fill:'var(--ink-3)',textTransform:'uppercase',letterSpacing:'.06em',fontWeight:600}}, monthsLabels[activeI]),
        h('text',{x:cx, y:cy+12, textAnchor:'middle', style:{fontSize:18,fontFamily:'Bricolage Grotesque',fontWeight:700,fill:'var(--ink)'}}, fmtNum(activeV)),
        h('text',{x:cx, y:cy+28, textAnchor:'middle', style:{fontSize:9,fontFamily:'Outfit',fill:'var(--ink-3)'}}, activeI === peakIdx ? '★ Peak ayı' : `${((activeV/total)*100).toFixed(1).replace('.',',')}%`)
      )
    );
  }

  // ======== Empty State ========
  function EmptyState({ icon, title, desc, cta, onCta }) {
    return h('div',{className:'empty-state'},
      icon && h('div',{className:'es-icon'}, icon),
      title && h('div',{className:'es-title'}, title),
      desc && h('div',{className:'es-desc'}, desc),
      cta && h('div',{className:'es-cta'}, h('button',{onClick:onCta}, cta))
    );
  }

  // ======== Skeleton ========
  function Skeleton({ lines = 3, type='line', style }) {
    if (type === 'block') return h('div',{className:'skeleton sk-block', style});
    return h('div',{style},
      Array.from({length:lines}).map((_,i) => h('div',{key:i, className:'skeleton sk-line'+(i===0?' lg':''), style:{width: (100 - i*8) + '%'}}))
    );
  }

  // ======== Chart Action Bar ========
  // Standardized export affordance: CSV | Copy table | Share URL (hash)
  function ChartActions({ csv, onCsv, tableHtml, onTable, shareKey, shareData, onShare }) {
    const [copied, setCopied] = React.useState(null);
    const doDownload = (filename, content, mime='text/csv;charset=utf-8;') => {
      const blob = new Blob([content], {type:mime});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    };
    const flash = (which) => { setCopied(which); setTimeout(()=>setCopied(null), 1400); };
    const copyTable = async () => {
      try {
        await navigator.clipboard.writeText(csv || '');
        flash('table');
      } catch(e) {}
    };
    const share = async () => {
      if (shareData && shareKey) {
        // Encode state into URL hash
        const state = btoa(encodeURIComponent(JSON.stringify(shareData)));
        const url = location.origin + location.pathname + '#' + shareKey + '=' + state;
        try {
          await navigator.clipboard.writeText(url);
          flash('share');
        } catch(e) {}
        if (onShare) onShare(url);
      } else if (onShare) {
        onShare();
      }
    };
    return h('div',{className:'chart-actions'},
      csv && h('button',{
        className:'chart-action-btn',
        title:'CSV olarak indir',
        onClick: (e) => {
          e.stopPropagation();
          if (onCsv) onCsv();
          else doDownload((shareKey || 'chart') + '.csv', csv);
        }
      },
        h('svg',{width:13,height:13,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'},
          h('path',{d:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'}),
          h('polyline',{points:'7 10 12 15 17 10'}),
          h('line',{x1:12,y1:15,x2:12,y2:3})
        )
      ),
      csv && h('button',{
        className:'chart-action-btn',
        title:'Tabloyu panoya kopyala',
        onClick: (e) => { e.stopPropagation(); copyTable(); },
        style:{position:'relative'}
      },
        copied === 'table' && h('span',{className:'copied'}, '✓ Kopyalandı'),
        h('svg',{width:13,height:13,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'},
          h('rect',{x:9,y:9,width:13,height:13,rx:2}),
          h('path',{d:'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'})
        )
      ),
      shareKey && h('button',{
        className:'chart-action-btn',
        title:'Bu görünüm için link kopyala',
        onClick: (e) => { e.stopPropagation(); share(); },
        style:{position:'relative'}
      },
        copied === 'share' && h('span',{className:'copied'}, '✓ Link kopyalandı'),
        h('svg',{width:13,height:13,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'},
          h('circle',{cx:18,cy:5,r:3}),h('circle',{cx:6,cy:12,r:3}),h('circle',{cx:18,cy:19,r:3}),
          h('line',{x1:8.59,y1:13.51,x2:15.42,y2:17.49}),h('line',{x1:15.41,y1:6.51,x2:8.59,y2:10.49})
        )
      )
    );
  }

  // ======== Bump Chart ========
  // Shows rank of each category over 2 time points (2024 → 2025)
  // items: [{label, color, rank24, rank25, value24, value25}]
  function BumpChart({ items, height=320, width=680, onClick }) {
    const [hover, setHover] = React.useState(null);
    const n = items.length;
    if (!n) return null;
    // Normalize
    const pad = { t: 20, b: 24, l: 80, r: 140 };
    const innerW = width - pad.l - pad.r;
    const innerH = height - pad.t - pad.b;
    // 2 x columns: 2024 on left, 2025 on right
    const x0 = pad.l, x1 = pad.l + innerW;
    const rowH = innerH / n;
    // Sort by 2024 rank for drawing order
    const sorted = items;

    return h('svg',{viewBox:`0 0 ${width} ${height}`, style:{width:'100%',height:'auto',fontFamily:'Outfit',overflow:'visible'}},
      // Column headers
      h('text',{x:x0, y:10, style:{fontSize:11,fontWeight:700,fill:'var(--ink-3)',letterSpacing:'.06em'}}, '2024'),
      h('text',{x:x1, y:10, textAnchor:'end', style:{fontSize:11,fontWeight:700,fill:'var(--ink-3)',letterSpacing:'.06em'}}, '2025'),
      // Lines
      sorted.map((it, i) => {
        const y24 = pad.t + (it.rank24 - 0.5) * rowH;
        const y25 = pad.t + (it.rank25 - 0.5) * rowH;
        const diff = it.rank24 - it.rank25;
        const isHover = hover === it.label;
        const isUp = diff > 0, isDown = diff < 0, isSame = diff === 0;
        const stroke = isHover ? it.color : `color-mix(in srgb, ${it.color} ${hover ? 20 : 85}%, transparent)`;
        // Bezier
        const midX = (x0 + x1) / 2;
        const path = `M ${x0} ${y24} C ${midX} ${y24} ${midX} ${y25} ${x1} ${y25}`;
        return h('g',{
          key:it.label,
          onMouseEnter:()=>setHover(it.label),
          onMouseLeave:()=>setHover(null),
          onClick: onClick ? ()=>onClick(it) : undefined,
          style:{cursor: onClick ? 'pointer' : 'default'}
        },
          h('path',{d:path, fill:'none', stroke, strokeWidth: isHover ? 3.5 : 2.2, style:{transition:'stroke-width .15s'}}),
          h('circle',{cx:x0, cy:y24, r:isHover?7:5, fill:it.color, stroke:'var(--bg-card)', strokeWidth:2}),
          h('circle',{cx:x1, cy:y25, r:isHover?7:5, fill:it.color, stroke:'var(--bg-card)', strokeWidth:2}),
          // Left label (rank #)
          h('text',{x:x0-10, y:y24+4, textAnchor:'end', style:{fontSize:11,fontWeight:600,fill:'var(--ink-3)'}}, '#' + it.rank24),
          // Right label (category name)
          h('text',{x:x1+12, y:y25+4, style:{fontSize:12,fontWeight: isHover ? 700 : 600, fill: isHover ? it.color : 'var(--ink)'}}, it.label),
          // Rank change badge
          diff !== 0 && h('text',{
            x: x1 + 12, y: y25 + 18,
            style:{
              fontSize:10, fontWeight:700,
              fill: isUp ? '#10B981' : '#EF4444'
            }
          }, isUp ? `↑ ${diff}` : `↓ ${Math.abs(diff)}`)
        );
      })
    );
  }

  // ======== Stream Graph (stacked area, centered) ========
  // series: [{label, color, values}] - 12 monthly values each
  function StreamGraph({ series, height=260, width=720, monthsLabels=TR_MONTHS }) {
    if (!series || !series.length) return null;
    const n = series[0].values.length;
    const pad = { t: 10, b: 28, l: 10, r: 10 };
    const innerW = width - pad.l - pad.r;
    const innerH = height - pad.t - pad.b;
    // Monthly totals
    const totals = Array.from({length:n}, (_,i) => series.reduce((s, ser) => s + (ser.values[i] || 0), 0));
    const maxTotal = Math.max(...totals) || 1;

    // For each month, compute stacked positions (centered baseline - stream layout)
    // Offset each month so that series are stacked symmetrically around the middle
    const positions = series.map(() => Array(n).fill({ y0: 0, y1: 0 }));
    for (let i = 0; i < n; i++) {
      // Sort by value descending for this month? No - keep consistent order for smooth bands
      let cumul = 0;
      const monthTotal = totals[i];
      const monthH = (monthTotal / maxTotal) * innerH;
      const baseline = pad.t + (innerH - monthH) / 2;
      for (let s = 0; s < series.length; s++) {
        const v = series[s].values[i] || 0;
        const h_ = (v / maxTotal) * innerH;
        positions[s][i] = { y0: baseline + cumul, y1: baseline + cumul + h_ };
        cumul += h_;
      }
    }

    const xFor = (i) => pad.l + (i / (n - 1)) * innerW;

    const [hoverI, setHoverI] = React.useState(null);

    const bands = series.map((ser, s) => {
      // Top path (y0, left→right)
      const top = Array.from({length:n}, (_,i) => `${i===0?'M':'L'} ${xFor(i)} ${positions[s][i].y0}`).join(' ');
      // Bottom path (y1, right→left)
      const bot = Array.from({length:n}, (_,i) => `L ${xFor(n-1-i)} ${positions[s][n-1-i].y1}`).join(' ');
      return h('path',{
        key:ser.label,
        d: top + ' ' + bot + ' Z',
        fill: ser.color,
        opacity: hoverI == null ? 0.85 : 0.55,
        style:{transition:'opacity .15s'}
      });
    });

    return h('div',{style:{position:'relative'}},
      h('svg',{viewBox:`0 0 ${width} ${height}`, style:{width:'100%',height:'auto'},
        onMouseMove:(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const rel = (e.clientX - rect.left) / rect.width;
          const xSvg = rel * width;
          const i = Math.round(((xSvg - pad.l) / innerW) * (n - 1));
          setHoverI(Math.max(0, Math.min(n - 1, i)));
        },
        onMouseLeave:()=>setHoverI(null)
      },
        bands,
        // Month ticks
        monthsLabels.map((m,i) => h('text',{
          key:m, x:xFor(i), y:height-6,
          textAnchor:'middle',
          style:{fontSize:10, fontFamily:'Outfit', fill: i === hoverI ? 'var(--ink)' : 'var(--ink-3)', fontWeight: i === hoverI ? 700 : 500}
        }, m)),
        // Hover vertical line
        hoverI != null && h('line',{
          x1:xFor(hoverI), x2:xFor(hoverI), y1:pad.t, y2:height - pad.b,
          stroke:'var(--ink)', strokeWidth:1, strokeDasharray:'3 3', opacity:0.35
        })
      ),
      // Legend
      h('div',{style:{display:'flex',flexWrap:'wrap',gap:'4px 12px',marginTop:8,fontSize:11}},
        series.map(ser => h('div',{key:ser.label, style:{display:'flex',alignItems:'center',gap:4}},
          h('div',{style:{width:10,height:10,borderRadius:2,background:ser.color}}),
          h('span',null, ser.label),
          hoverI != null && h('span',{style:{color:'var(--ink-3)',marginLeft:4,fontFamily:'Bricolage Grotesque',fontWeight:700}},
            fmtNum(ser.values[hoverI])
          )
        ))
      )
    );
  }

  return { Kpi, YoYPill, Sparkline, Heatmap, ShareBars, QStack, Modal, LineChart, BarChart, Donut, InfoIcon, Explainer, MultiSelect, SectionHeader, SmallMultiples, PolarPeak, EmptyState, Skeleton, ChartActions, BumpChart, StreamGraph, Zoomable };
})();
