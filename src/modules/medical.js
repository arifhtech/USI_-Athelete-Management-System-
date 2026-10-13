/* USI · AMS — Medical & Injury Intelligence (priority module).
   Interactive anatomical body map (UI.BodyMap, reused by the athlete app), injury reporting with AI assist, caseload board
   (Reported → Assessment → Rehab → Clearance, plus the light path), return-to-play stages with physio sign-off, setbacks,
   doctor-decided disagreements and doctor-only clearance with a graded return-to-load plan, wellness monitoring against each
   athlete's own normal, injury analytics and predictive injury warnings. Every state change goes through registered
   actions → AMS.mutate → activity feed + bell + copilot. AI drafts and suggests; a human always confirms medical status. */
(function () {
  'use strict';
  const AMS = window.AMS, UI = window.UI, React = window.React, html = AMS.html;
  const { useState, useMemo, useEffect, useRef } = React;
  const D = AMS.date, C = AMS.calc;
  const I = UI.Icon;
  const Frag = React.Fragment;
  const MOD = 'medical';

  /* ================================================================== module CSS (theme tokens only) */
  (function injectStyle() {
    try {
      if (document.getElementById('style-medical')) return;
      const el = document.createElement('style');
      el.id = 'style-medical';
      el.textContent = [
        '.bm-wrap{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;min-width:0}',
        '.bm-stage{position:relative;display:inline-block;max-width:100%}',
        '.bm-svg{display:block;max-width:100%;overflow:visible}',
        '.bm-region{fill:var(--body-map-skin);stroke:var(--body-map-line);stroke-width:.8;cursor:pointer;transition:fill .15s,stroke .15s;outline:none}',
        '.bm-region:hover,.bm-region:focus-visible{stroke:var(--accent);stroke-width:1.6}',
        '.bm-region.plain:hover,.bm-region.plain:focus-visible{fill:color-mix(in srgb,var(--accent) 22%,var(--body-map-skin))}',
        '.bm-region.sel{stroke:var(--accent);stroke-width:2.4}',
        '.bm-region.static{cursor:default}',
        '.bm-pulse{transform-box:fill-box;transform-origin:center;animation:bm-pulse 1.9s ease-out infinite;fill:none;stroke-width:1.6;pointer-events:none}',
        '@keyframes bm-pulse{0%{transform:scale(.55);opacity:.95}100%{transform:scale(1.9);opacity:0}}',
        '.bm-tip{position:absolute;pointer-events:none;transform:translate(-50%,calc(-100% - 10px));background:var(--surface);border:1px solid var(--border-strong);box-shadow:var(--shadow);border-radius:6px;padding:6px 8px;font-size:11.5px;line-height:1.35;white-space:nowrap;z-index:5;color:var(--fg)}',
        '.bm-side{font:600 11px var(--font-ui);fill:var(--fg-3)}',
        '.bm-badge{pointer-events:none}',
        '.bm-badge text{font:700 7.5px var(--font-ui);fill:var(--surface)}',
        '.bm-legend{display:flex;flex-wrap:wrap;gap:6px 12px;justify-content:center;font-size:11px;color:var(--fg-2)}',
        '.bm-legend span{display:inline-flex;align-items:center;gap:5px}',
        '.bm-legend i{display:inline-block;width:10px;height:10px;border-radius:3px}',
        '.med-board{display:grid;grid-template-columns:repeat(5,minmax(210px,1fr));gap:12px;overflow-x:auto;padding-bottom:6px;min-width:0}',
        '.med-col{background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-lg);display:flex;flex-direction:column;min-height:220px;min-width:0}',
        '.med-col-h{padding:10px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:6px;font-weight:600;font-size:12.5px}',
        '.med-col-b{padding:8px;display:flex;flex-direction:column;gap:8px}',
        '.med-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:10px;display:flex;flex-direction:column;gap:6px;cursor:pointer;min-width:0}',
        '.med-card:hover{border-color:var(--border-strong);box-shadow:var(--shadow)}',
        '.med-card.overdue{box-shadow:inset 3px 0 0 var(--bad)}',
        '.med-crit{display:flex;align-items:flex-start;gap:9px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface);text-align:left;color:var(--fg);width:100%;font:inherit}',
        '.med-crit.can{cursor:pointer}',
        '.med-crit.met{background:var(--good-weak);border-color:color-mix(in srgb,var(--good) 35%,transparent)}',
        '.med-box{width:16px;height:16px;border-radius:4px;border:1.5px solid var(--border-strong);display:grid;place-items:center;flex:none;margin-top:1px;color:var(--surface)}',
        '.med-crit.met .med-box{background:var(--good);border-color:var(--good)}',
        '.med-choice{border:1px solid var(--border);border-radius:var(--r);padding:10px 12px;cursor:pointer;background:var(--surface);text-align:left;display:flex;flex-direction:column;gap:3px;color:var(--fg);font:inherit;min-width:0}',
        '.med-choice.on{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent);background:var(--accent-weak)}',
        '.med-range{width:100%;accent-color:var(--accent)}',
        '.med-split{display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:16px;align-items:start}',
        '.med-head{display:grid;grid-template-columns:150px minmax(0,1fr);gap:16px;align-items:start}',
        '.med-chip{border:1px solid var(--border);background:var(--surface-2);border-radius:12px;padding:2px 9px;font-size:11.5px;cursor:pointer;color:var(--fg-2);font-family:inherit}',
        '.med-chip.on{background:var(--accent-weak);border-color:var(--accent);color:var(--accent)}',
        '.med-lock{display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-radius:var(--r);background:var(--surface-2);border:1px dashed var(--border-strong);font-size:12px;color:var(--fg-2)}',
        '.med-pain{display:grid;grid-template-columns:repeat(11,minmax(0,1fr));gap:4px}',
        '.med-pain button{height:30px;border-radius:6px;border:1px solid var(--border);background:var(--surface);font:600 12px var(--font-ui);color:var(--fg-2);cursor:pointer}',
        '.med-pain button.on{background:var(--accent);border-color:var(--accent);color:var(--surface)}',
        '@media (max-width:760px){.med-split,.med-head{grid-template-columns:minmax(0,1fr)}.med-board{grid-template-columns:repeat(5,minmax(230px,80vw))}}',
      ].join('\n');
      (document.head || document.body).appendChild(el);
    } catch (e) { /* style injection unavailable (server render) */ }
  })();

  /* ================================================================== body map geometry
     viewBox 0 0 200 440. Each bilateral region is drawn once for the viewer's left half (x < 100) and mirrored.
     Anatomical convention: in the FRONT view the athlete's RIGHT side is on the viewer's left; in the BACK view the athlete's LEFT is on the viewer's left. */
  const REGION_NAMES = {
    head: 'Head', neck: 'Neck', shoulder: 'Shoulder', chest: 'Chest', upper_arm: 'Upper arm', elbow: 'Elbow', forearm: 'Forearm', wrist: 'Wrist', hand: 'Hand',
    abdomen: 'Abdomen', hip_flexor: 'Hip flexor', groin: 'Groin / adductor', quad: 'Quadriceps', knee: 'Knee', shin: 'Shin', ankle: 'Ankle', foot: 'Foot',
    upper_back: 'Upper back', lower_back: 'Lower back', glute: 'Glute', hamstring: 'Hamstring', calf: 'Calf', achilles: 'Achilles',
  };
  const BACK_NAMES = { shoulder: 'Rear shoulder', upper_arm: 'Triceps', elbow: 'Elbow (posterior)', knee: 'Back of knee', foot: 'Heel', hand: 'Hand (back)' };
  const CENTER = new Set(['head', 'neck', 'abdomen', 'lower_back']);
  const SHARED = {
    head: { c: 1, d: 'M100,10 C112,10 118,20 118,33 C118,46 110,54 100,54 C90,54 82,46 82,33 C82,20 88,10 100,10 Z', x: 100, y: 32 },
    neck: { c: 1, d: 'M91,53 L109,53 L111,66 L89,66 Z', x: 100, y: 60 },
    shoulder: { d: 'M89,66 C77,66 65,69 59,78 C55,85 55,94 57,102 L66,102 C66,92 69,83 76,77 L88,71 Z', x: 66, y: 84 },
    upper_arm: { d: 'M57,103 L66,103 L67,112 C66,126 64,138 62,150 L48,150 C48,134 51,118 57,103 Z', x: 57, y: 126 },
    elbow: { d: 'M48,151 L62,151 C61,156 60,161 59,166 L45,166 C46,161 47,156 48,151 Z', x: 54, y: 158 },
    forearm: { d: 'M45,167 L59,167 C58,182 56,198 54,213 L42,213 C41,198 42,182 45,167 Z', x: 50, y: 190 },
    wrist: { d: 'M42,214 L54,214 L53,224 L40,224 Z', x: 47, y: 219 },
    hand: { d: 'M40,225 L53,225 C55,233 55,243 52,252 C48,256 42,256 38,250 C35,242 36,232 40,225 Z', x: 45, y: 239 },
  };
  const FRONT = [
    Object.assign({ id: 'head' }, SHARED.head), Object.assign({ id: 'neck' }, SHARED.neck), Object.assign({ id: 'shoulder' }, SHARED.shoulder),
    { id: 'chest', d: 'M88,71 L76,77 C69,83 66,92 66,102 L68,112 C80,116 92,116 99.5,113 L99.5,67 L89,66 Z', x: 84, y: 94 },
    { id: 'abdomen', c: 1, d: 'M69,113 C82,118 118,118 131,113 L129,140 C128,152 129,162 130,170 L70,170 C71,162 72,152 71,140 Z', x: 100, y: 142 },
    Object.assign({ id: 'upper_arm' }, SHARED.upper_arm), Object.assign({ id: 'elbow' }, SHARED.elbow), Object.assign({ id: 'forearm' }, SHARED.forearm),
    Object.assign({ id: 'wrist' }, SHARED.wrist), Object.assign({ id: 'hand' }, SHARED.hand),
    { id: 'hip_flexor', d: 'M70,171 L99.5,171 L99.5,182 L88,198 L69,198 C68,189 68,180 70,171 Z', x: 81, y: 184 },
    { id: 'groin', d: 'M99.5,183 L99.5,214 C97,222 95,228 92,234 L88.5,199 Z', x: 95, y: 206 },
    { id: 'quad', d: 'M69,199 L88,199 L92,235 C94,251 94,270 93,290 L73,290 C70,270 67,240 67,220 C67,212 68,205 69,199 Z', x: 80, y: 248 },
    { id: 'knee', d: 'M73,291 L93,291 C94,300 94,310 92,318 L75,318 C73,310 72,300 73,291 Z', x: 83, y: 304 },
    { id: 'shin', d: 'M75,319 L92,319 C92,345 91,370 89,394 L79,394 C77,370 75,345 75,319 Z', x: 84, y: 356 },
    { id: 'ankle', d: 'M79,395 L89,395 L90,407 L78,407 Z', x: 84, y: 401 },
    { id: 'foot', d: 'M78,408 L90,408 C92,414 93,420 92,427 L71,427 C69,422 72,415 78,408 Z', x: 82, y: 418 },
  ];
  const BACK = [
    Object.assign({ id: 'head' }, SHARED.head), Object.assign({ id: 'neck' }, SHARED.neck), Object.assign({ id: 'shoulder' }, SHARED.shoulder),
    { id: 'upper_back', d: 'M89,66 L99.5,66 L99.5,130 L69,130 C67,120 66,110 66,102 C66,92 69,83 76,77 L88,71 Z', x: 84, y: 100 },
    { id: 'lower_back', c: 1, d: 'M69,131 L131,131 C129,145 129,158 130,170 L70,170 C71,158 71,145 69,131 Z', x: 100, y: 150 },
    Object.assign({ id: 'upper_arm' }, SHARED.upper_arm), Object.assign({ id: 'elbow' }, SHARED.elbow), Object.assign({ id: 'forearm' }, SHARED.forearm),
    Object.assign({ id: 'wrist' }, SHARED.wrist), Object.assign({ id: 'hand' }, SHARED.hand),
    { id: 'glute', d: 'M70,171 L99.5,171 L99.5,212 C90,216 78,214 69,208 C68,196 68,183 70,171 Z', x: 84, y: 192 },
    { id: 'hamstring', d: 'M69,209 C78,215 90,217 99.5,213 L97,240 C95,256 94,274 93,292 L73,292 C70,270 68,240 69,209 Z', x: 83, y: 250 },
    { id: 'knee', d: 'M73,293 L93,293 C93,300 93,306 92,312 L74,312 C73,306 73,300 73,293 Z', x: 83, y: 302 },
    { id: 'calf', d: 'M74,313 L92,313 C95,330 94,350 90,378 L80,378 C75,355 72,330 74,313 Z', x: 84, y: 342 },
    { id: 'achilles', d: 'M80,379 L90,379 L89,400 L81,400 Z', x: 85, y: 390 },
    { id: 'foot', d: 'M79,401 L91,401 C93,410 93,418 91,427 L77,427 C75,418 76,410 79,401 Z', x: 84, y: 414 },
  ];
  const FRONT_IDS = new Set(FRONT.map((g) => g.id)), BACK_IDS = new Set(BACK.map((g) => g.id));
  const viewFor = (region) => (FRONT_IDS.has(region) && !BACK_IDS.has(region) ? 'front' : BACK_IDS.has(region) && !FRONT_IDS.has(region) ? 'back' : 'front');
  /** Which athlete side a half of the figure represents. mirrored = viewer's right half. */
  const sideOf = (view, mirrored) => (view === 'front' ? (mirrored ? 'L' : 'R') : (mirrored ? 'R' : 'L'));
  const regionName = (region, view) => (view === 'back' && BACK_NAMES[region]) || REGION_NAMES[region] || region;
  function regionLabel(region, side) {
    const n = REGION_NAMES[region] || region;
    if (CENTER.has(region)) return n;
    if (side === 'L') return 'Left ' + n.toLowerCase();
    if (side === 'R') return 'Right ' + n.toLowerCase();
    const plural = { groin: 'groins', foot: 'feet', quad: 'quadriceps', achilles: 'Achilles tendons' }[region] || n.toLowerCase().replace(/s?$/, 's');
    return 'Both ' + plural + ' (bilateral)';
  }
  const SEV_RANK = { minor: 1, moderate: 2, severe: 3 };
  const sevColor = (s) => (s === 'severe' ? 'var(--bad)' : s === 'moderate' ? 'color-mix(in srgb, var(--bad) 55%, var(--warn))' : 'var(--warn)');
  const sevTone = (s) => (s === 'severe' || s === 'moderate' ? 'bad' : 'warn');
  const ACTIVE_CARE = ['Reported', 'Assessment', 'Rehab', 'Clearance'];

  let bmSeq = 0;
  /** Reusable interactive body map. See docs/specs/medical.md §1 for the prop contract. */
  function BodyMap(props) {
    const { marks, selected, onSelect, layer, heat, compact, height, showToggle, showLegend, onViewChange } = props;
    const [pid] = useState(() => 'bm' + (++bmSeq));
    const autoView = useMemo(() => {
      if (props.view) return props.view;
      if (selected && selected.region) return viewFor(selected.region);
      const cur = (marks || []).filter((m) => !m.faded);
      const pool = cur.length ? cur : (marks || []);
      const back = pool.filter((m) => viewFor(m.region) === 'back' || m.view === 'back').length;
      return back > pool.length / 2 ? 'back' : 'front';
    }, []);
    const [inner, setInner] = useState(autoView);
    const view = onViewChange && props.view ? props.view : inner;
    const setView = (v) => { setInner(v); if (onViewChange) onViewChange(v); };
    const [hover, setHover] = useState(null);
    const lay = layer || 'history';
    const geo = view === 'front' ? FRONT : BACK;
    const ids = view === 'front' ? FRONT_IDS : BACK_IDS;
    const shownMarks = lay === 'heat' ? [] : (marks || []).filter((m) => lay !== 'current' || !m.faded);
    const heatOf = (region, side, center) => {
      if (!heat) return 0;
      if (center) return Object.keys(heat).filter((k) => k.split(':')[0] === region).reduce((s, k) => s + (heat[k] || 0), 0);
      return (heat[region + ':' + side] || 0) + (heat[region + ':C'] || 0);
    };
    const heatMax = Math.max(1, ...geo.flatMap((g) => (g.c ? [heatOf(g.id, 'C', true)] : [heatOf(g.id, 'L'), heatOf(g.id, 'R')])));
    const H = height || (compact ? 260 : 430);
    const viewCount = (vw) => (marks || []).filter((m) => !m.faded && (vw === 'front' ? FRONT_IDS : BACK_IDS).has(m.region)).length;

    const shapes = [];
    geo.forEach((g) => {
      const halves = g.c ? [false] : [false, true];
      halves.forEach((mir) => {
        const side = g.c ? 'C' : sideOf(view, mir);
        // Regions present in both views (shoulder, arm, knee, foot…) show their marks on both figures.
        const match = shownMarks.filter((m) => m.region === g.id && (g.c || !m.side || m.side === side || m.side === 'C'));
        const cur = match.filter((m) => !m.faded).sort((a, b) => (SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0));
        const hist = match.filter((m) => m.faded);
        const hc = lay === 'heat' ? heatOf(g.id, side, g.c) : 0;
        const x = mir ? 200 - g.x : g.x, y = g.y;
        let fill = null, fillOpacity = 1;
        if (lay === 'heat' && hc > 0) fill = 'color-mix(in srgb, var(--bad) ' + Math.round(18 + 70 * (hc / heatMax)) + '%, var(--body-map-skin))';
        else if (cur.length) fill = sevColor(cur[0].severity);
        else if (hist.length) { fill = 'url(#' + pid + '-h)'; fillOpacity = 1; }
        const isSel = !!(selected && selected.region === g.id && (g.c || !selected.side || selected.side === side || selected.side === 'C'));
        const label = regionName(g.id, view) + (g.c ? '' : ' · ' + (side === 'L' ? 'Left' : 'Right'));
        const count = lay === 'heat' ? hc : match.length;
        shapes.push({ key: g.id + ':' + side, g, mir, side, x, y, fill, fillOpacity, cur, hist, isSel, label, count, rehab: cur.some((m) => ACTIVE_CARE.includes(m.status)), light: cur.some((m) => m.status === 'Monitoring') });
      });
    });
    const tipFor = (s) => {
      const lines = [];
      if (lay === 'heat') lines.push(s.count ? s.count + ' injur' + (s.count === 1 ? 'y' : 'ies') + ' in scope' : 'No injuries recorded');
      else {
        s.cur.slice(0, 3).forEach((m) => lines.push((m.label || 'Current') + (m.status ? ' — ' + m.status : '')));
        if (s.hist.length) lines.push(s.hist.length + ' past injur' + (s.hist.length === 1 ? 'y' : 'ies') + (s.hist[0].label ? ': ' + s.hist[0].label : ''));
        if (!s.cur.length && !s.hist.length) lines.push(onSelect ? 'No injuries · click to select' : 'No injuries');
      }
      return lines;
    };
    const choose = (s) => { if (onSelect) onSelect(s.g.id, s.side, regionLabel(s.g.id, s.side)); };
    return html`<div className="bm-wrap">
      ${showToggle !== false && html`<div className="row between" style=${{ width: '100%', gap: 8 }}>
        <${UI.Seg} size="sm" value=${view} onChange=${setView} options=${[{ id: 'front', label: 'Front' + (viewCount('front') ? ' · ' + viewCount('front') : '') }, { id: 'back', label: 'Back' + (viewCount('back') ? ' · ' + viewCount('back') : '') }]} />
        <span className="tiny faint">${lay === 'heat' ? 'Heat: injuries per region' : onSelect ? 'Click or Tab + Enter a region' : 'Hover a region for detail'}</span>
      </div>`}
      <div className="bm-stage">
        <svg className="bm-svg" viewBox="0 0 200 440" style=${{ height: H, width: (H * 200) / 440 }} role="group" aria-label=${'Body map, ' + view + ' view'}>
          <defs>
            <pattern id=${pid + '-h'} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="4" height="4" fill="var(--body-map-skin)" />
              <line x1="0" y1="0" x2="0" y2="4" stroke="var(--fg-3)" strokeWidth="1.5" strokeOpacity="0.55" />
            </pattern>
          </defs>
          <text className="bm-side" x="10" y="20">${view === 'front' ? 'R' : 'L'}</text>
          <text className="bm-side" x="184" y="20">${view === 'front' ? 'L' : 'R'}</text>
          <text className="bm-side" x="100" y="438" textAnchor="middle" style=${{ fontSize: 9, fontWeight: 500 }}>${view === 'front' ? 'FRONT' : 'BACK'}</text>
          ${shapes.map((s) => html`<path key=${s.key} d=${s.g.d} transform=${s.mir ? 'translate(200 0) scale(-1 1)' : undefined}
              className=${AMS.cx('bm-region', !s.fill && 'plain', s.isSel && 'sel', !onSelect && 'static')}
              style=${s.fill ? { fill: s.fill, fillOpacity: s.fillOpacity } : undefined}
              tabIndex=${onSelect ? 0 : -1} role=${onSelect ? 'button' : undefined} aria-label=${s.label + (s.count ? ', ' + s.count + ' injuries' : '')}
              onMouseEnter=${() => setHover(s)} onMouseLeave=${() => setHover(null)} onFocus=${() => setHover(s)} onBlur=${() => setHover(null)}
              onClick=${() => choose(s)} onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(s); } }} />`)}
          ${shapes.filter((s) => s.isSel).map((s) => html`<path key=${'sel' + s.key} d=${s.g.d} transform=${s.mir ? 'translate(200 0) scale(-1 1)' : undefined} fill="none" stroke="var(--accent)" strokeWidth="2.4" style=${{ pointerEvents: 'none' }} />`)}
          ${shapes.filter((s) => s.rehab && lay !== 'heat').map((s) => html`<circle key=${'p' + s.key} className="bm-pulse" cx=${s.x} cy=${s.y} r="9" stroke=${sevColor(s.cur[0].severity)} />`)}
          ${shapes.filter((s) => s.light && !s.rehab && lay !== 'heat').map((s) => html`<circle key=${'l' + s.key} cx=${s.x} cy=${s.y} r="8.5" fill="none" stroke="var(--warn)" strokeWidth="1.6" strokeDasharray="2.5 2" style=${{ pointerEvents: 'none' }} />`)}
          ${shapes.filter((s) => s.count > 1 || (lay === 'heat' && s.count > 0)).map((s) => html`<g key=${'b' + s.key} className="bm-badge">
            <circle cx=${s.x + 7} cy=${s.y - 8} r="6" fill=${lay === 'heat' ? 'var(--fg-2)' : 'var(--fg)'} />
            <text x=${s.x + 7} y=${s.y - 5.4} textAnchor="middle">${s.count > 99 ? '99' : s.count}</text>
          </g>`)}
        </svg>
        ${hover && html`<div className="bm-tip" style=${{ left: (hover.x / 200) * 100 + '%', top: (hover.y / 440) * 100 + '%' }}>
          <b>${hover.label}</b>${tipFor(hover).map((t, i) => html`<div key=${i} className="muted">${t}</div>`)}
        </div>`}
      </div>
      ${showLegend !== false && html`<div className="bm-legend">
        ${lay === 'heat' ? html`<${Frag}>
          <span><i style=${{ background: 'color-mix(in srgb, var(--bad) 20%, var(--body-map-skin))' }} />Few</span>
          <span><i style=${{ background: 'color-mix(in srgb, var(--bad) 55%, var(--body-map-skin))' }} />Some</span>
          <span><i style=${{ background: 'var(--bad)' }} />Most</span>
          <span className="faint">Badge = count</span>
        <//>` : html`<${Frag}>
          <span><i style=${{ background: sevColor('minor') }} />Minor</span>
          <span><i style=${{ background: sevColor('moderate') }} />Moderate</span>
          <span><i style=${{ background: sevColor('severe') }} />Severe</span>
          <span><i style=${{ background: 'transparent', border: '1.6px solid var(--fg-2)', borderRadius: '50%' }} />In rehab (pulse)</span>
          <span><i style=${{ background: 'transparent', border: '1.6px dashed var(--warn)', borderRadius: '50%' }} />Light path</span>
          ${lay !== 'current' && html`<span><i style=${{ background: 'repeating-linear-gradient(45deg, var(--fg-3) 0 1.5px, var(--body-map-skin) 1.5px 4px)' }} />Past</span>`}
        <//>`}
      </div>`}
    </div>`;
  }
  UI.BodyMap = BodyMap;

  /* ================================================================== helpers */
  const ath = (id) => AMS.org.athlete(id);
  const staffName = (id) => (AMS.org.staff(id) || {}).name || '—';
  const firstName = (n) => String(n || '').split(' ')[0];
  const nowStamp = () => AMS.TODAY + 'T' + AMS.clockTime();
  const minutesOf = (t) => { const p = String(t || '00:00').split(':').map(Number); return p[0] * 60 + (p[1] || 0); };
  const hoursSince = (ts) => (D.diff(AMS.TODAY, ts.slice(0, 10)) * 1440 + minutesOf(AMS.clockTime()) - minutesOf(ts.slice(11, 16) || '08:00')) / 60;
  function agoText(ts) { const h = hoursSince(ts); if (h < 1) return Math.max(1, Math.round(h * 60)) + ' min ago'; if (h < 24) return Math.round(h) + ' h ago'; return Math.round(h / 24) + ' d ago'; }
  const isOpen = (i) => i.status !== 'Closed';
  const daysSince = (inj) => D.diff(AMS.TODAY, inj.dateOfInjury);
  const stageOf = (inj) => (inj.rtpStages || [])[inj.rtpStage] || null;
  const daysInStage = (inj) => (inj.stageSince ? D.diff(AMS.TODAY, inj.stageSince) : 0);
  const isOverdue = (inj) => inj.status === 'Rehab' && !!inj.stageSince && daysInStage(inj) > (inj.stageTargetDays || 7);
  const returnLate = (inj) => isOpen(inj) && !!inj.expectedReturn && D.diff(AMS.TODAY, inj.expectedReturn) > 0;
  const lastIdx = (inj) => Math.max(0, (inj.rtpStages || []).length - 1);
  const STATUS_TONE = { Reported: 'bad', Assessment: 'warn', Rehab: 'info', Clearance: 'ai', Monitoring: 'warn', Closed: 'good' };
  const BOARD = [
    { id: 'Reported', label: 'Reported', hint: 'Awaiting physio', icon: 'flag' },
    { id: 'Assessment', label: 'Assessment', hint: 'Diagnosis & plan', icon: 'clipboard' },
    { id: 'Rehab', label: 'Rehab', hint: 'RTP stages', icon: 'run' },
    { id: 'Clearance', label: 'Clearance', hint: 'Doctor sign-off', icon: 'shield-check' },
    { id: 'Monitoring', label: 'Monitoring', hint: 'Light path', icon: 'eye' },
  ];
  const TYPES = ['Muscle strain', 'Tightness / niggle', 'Ligament sprain', 'Tendinopathy', 'Contusion', 'Bone stress', 'Joint irritation', 'Concussion', 'Ligament rupture', 'Other'];
  const MECHS = ['Max-velocity sprinting', 'Acceleration', 'Landing', 'Change of direction', 'Contact / collision', 'Gradual onset', 'Overload — volume', 'Lifting'];
  const isMed = () => AMS.medicalFull();
  const isDoctor = () => AMS.ui.role === 'doctor';
  const meName = () => { const m = AMS.me(); return m ? m.name : AMS.roleLabel(AMS.ui.role); };
  function reportedAt(inj) {
    if (inj.reportedAt) return inj.reportedAt;
    const act = (AMS.db.activity || []).find((x) => x.athleteId === inj.athleteId && x.type === 'injury' && x.at && x.at.slice(0, 10) >= inj.dateOfInjury);
    return act ? act.at : inj.dateOfInjury + 'T08:00';
  }
  /** Region text the current role may see. */
  const whereText = (inj) => (isMed() || AMS.ui.role === 'athlete' ? inj.regionLabel : AMS.bodyZone(inj.region));
  const ALLOWED = [
    'Rehab programme only — no squad running or jumping',
    'Low-intensity conditioning; no sprinting, jumping or max lifts',
    'Technical work and running up to ~70%; no maximal efforts',
    'Near-full intensity with physio present; no competition',
    'Full squad training; not yet cleared to compete',
    'Awaiting team doctor clearance',
  ];
  function allowedTraining(inj) {
    if (inj.status === 'Closed') return inj.gradedReturn ? 'Graded return: capped at ' + inj.gradedReturn.weeks.map((w) => w.pct + '%').join(' → ') + ' of normal load' : 'Full training';
    if (inj.status === 'Monitoring') return 'Full training with monitoring — report any increase in symptoms';
    if (inj.status === 'Reported' || inj.status === 'Assessment') return inj.availability === 'Unavailable' ? 'No training until assessed' : 'Modified training until the physio has assessed';
    if (inj.rtpTemplate === 'concussion') return ['Rest; symptom-limited daily activity', 'Light aerobic only (bike)', 'Shadow drills, no head impact', 'Non-contact drills', 'Full contact practice', 'Awaiting team doctor clearance'][inj.rtpStage] || ALLOWED[0];
    return ALLOWED[Math.min(inj.rtpStage, ALLOWED.length - 1)];
  }
  function quantile(sorted, p) { if (!sorted.length) return null; const pos = (sorted.length - 1) * p; const lo = Math.floor(pos), hi = Math.ceil(pos); return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)); }
  /** Expected days out from similar closed cases in the federation (same region & type, else same region). */
  function similarCases(region, type, excludeId) {
    const closed = AMS.db.injuries.filter((i) => i.status === 'Closed' && i.region === region && i.daysLost > 0 && i.id !== excludeId);
    let pool = type ? closed.filter((i) => i.type === type) : closed, basis = 'same region & type';
    if (pool.length < 3) { pool = closed; basis = 'same region'; }
    const ds = pool.map((i) => i.daysLost).sort((a, b) => a - b);
    return { n: ds.length, median: quantile(ds, 0.5), p25: quantile(ds, 0.25), p75: quantile(ds, 0.75), basis, min: ds[0], max: ds[ds.length - 1] };
  }
  const priorSameRegion = (athleteId, region, excludeId) => AMS.db.injuries.filter((i) => i.athleteId === athleteId && i.region === region && i.id !== excludeId);
  const loadIdxOf = (iso) => 41 - D.diff(AMS.TODAY, iso);
  function acwrBefore(a, iso) { const i = loadIdxOf(iso) - 1; return i >= 27 && i <= 40 ? C.acwr(a, i) : null; }
  /** Pre-injury weekly load (AU) — the athlete's own chronic load before the injury, else squad peers' median chronic. */
  function preInjuryWeekly(a, inj) {
    const idx = loadIdxOf(inj.dateOfInjury);
    const win = (a.loads || []).slice(Math.max(0, idx - 28), Math.max(0, idx));
    if (win.length >= 7 && AMS.mean(win) > 0) return { weekly: Math.round(AMS.mean(win) * 7), basis: 'own ' + win.length + '-day load before injury' };
    const peers = AMS.db.athletes.filter((x) => x.squadId === a.squadId && x.id !== a.id && x.availability === 'Available').map((x) => AMS.mean((x.loads || []).slice(13, 41)) * 7).filter((x) => x > 0).sort((p, q) => p - q);
    const med = peers.length ? peers[Math.floor(peers.length / 2)] : 2200;
    return { weekly: Math.round(med), basis: 'squad median chronic load (injury pre-dates the 42-day load record)' };
  }
  /** Graded return-to-load plan: weeks 1–3 at 60 / 75 / 90 % of the pre-injury chronic load. */
  function gradedPlan(a, inj, start) {
    const w = preInjuryWeekly(a, inj);
    const from = start || inj.closedOn || AMS.TODAY;
    return {
      basis: w.basis, chronicWeekly: w.weekly, start: from,
      weeks: [60, 75, 90].map((pct, k) => ({ week: k + 1, pct, from: D.add(from, 7 * k), to: D.add(from, 7 * k + 6), capAU: Math.round((w.weekly * pct) / 100), perSession: Math.round((w.weekly * pct) / 100 / 5) })),
      applied: null,
    };
  }
  /** AI path suggestion for the report flow: light path (flag & monitor) vs a full rehab case. */
  function aiPathFor(f, prior) {
    const reasons = [];
    let light = true;
    if (f.severity !== 'minor') { light = false; reasons.push(f.severity + ' severity'); }
    if ((f.pain || 0) >= 4) { light = false; reasons.push('pain ' + f.pain + '/10'); }
    if (/Concussion|rupture|Bone stress/i.test(f.type || '')) { light = false; reasons.push((f.type || '').toLowerCase() + ' always needs a case'); }
    if (prior.length) { light = false; reasons.push(prior.length + ' previous ' + (REGION_NAMES[f.region] || '').toLowerCase() + ' injur' + (prior.length === 1 ? 'y' : 'ies')); }
    if (light) return { path: 'light', confidence: 0.78, rationale: 'Minor, pain ' + (f.pain || 0) + '/10, no previous injury in this region — flag & monitor for 72 h rather than opening a full rehab case. Escalate if pain rises.' };
    return { path: 'case', confidence: 0.84, rationale: 'Open a rehab case: ' + reasons.join(', ') + '. A physio assessment and staged return-to-play are recommended.' };
  }
  /** AI draft assessment note — specific, from data. The physio edits it before saving. */
  function aiDraftNote(inj) {
    const a = ath(inj.athleteId);
    const pl = inj.painLog || [];
    const p0 = pl[0], p1 = pl[pl.length - 1];
    const ac = acwrBefore(a, inj.dateOfInjury);
    const prior = priorSameRegion(a.id, inj.region, inj.id).filter((x) => x.dateOfInjury < inj.dateOfInjury);
    const sim = similarCases(inj.region, inj.type, inj.id);
    const w = C.todayWellness(a);
    const parts = [];
    parts.push(a.name + ' (' + D.ageOn(a.dob) + ' y, ' + a.discipline + '). ' + inj.regionLabel + ' — ' + (inj.mechanism || 'mechanism not recorded') + ' on ' + D.fmt(inj.dateOfInjury) + ' (' + (inj.context || 'Training').toLowerCase() + ').');
    if (p0 && p1) parts.push('Pain ' + p0.pain + '/10 at onset → ' + p1.pain + '/10 on ' + D.fmt(p1.date) + (p1.pain < p0.pain ? ' (settling).' : p1.pain > p0.pain ? ' (rising — re-check).' : ' (unchanged).'));
    if (ac != null) parts.push('Load context: ACWR ' + ac.toFixed(2) + ' the day before injury' + (ac >= 1.5 ? ' — load jump, likely contributor.' : ac > 1.3 ? ' — rising load.' : ' — within normal range.'));
    if (prior.length) parts.push('History: ' + prior.length + ' previous ' + (REGION_NAMES[inj.region] || '').toLowerCase() + ' injur' + (prior.length === 1 ? 'y' : 'ies') + ' (last ' + D.fmt(prior[prior.length - 1].dateOfInjury) + ') — re-injury risk; protect end-stage loading.');
    else parts.push('No previous injury in this region.');
    if (w) parts.push('Today\'s check-in: sleep ' + w.sleep + '/5, soreness ' + w.soreness + '/5' + (w.note ? ', note "' + w.note + '"' : '') + '.');
    parts.push('Findings: [palpation / ROM / strength — physio to complete]. Working diagnosis: ' + (inj.type || 'injury').toLowerCase() + ', ' + (inj.grade ? 'grade ' + inj.grade : 'grade to confirm') + '.');
    if (sim.n) parts.push('Plan: ' + AMS.RTP_TEMPLATES[inj.rtpTemplate || AMS.rtpTemplateFor(inj.region, inj.type)].length + '-stage ' + (inj.rtpTemplate || AMS.rtpTemplateFor(inj.region, inj.type)) + ' protocol; similar cases (' + sim.basis + ', n=' + sim.n + ') returned in a median ' + sim.median + ' days (IQR ' + sim.p25 + '–' + sim.p75 + ').');
    return parts.join(' ');
  }
  /** Best-guess body region from a free-text check-in note. */
  function guessRegion(note) {
    const t = String(note || '').toLowerCase();
    const map = [[/hamstring/, 'hamstring'], [/calf|calves/, 'calf'], [/groin|adductor/, 'groin'], [/quad/, 'quad'], [/knee|patell/, 'knee'], [/shin/, 'shin'], [/ankle/, 'ankle'], [/achilles/, 'achilles'], [/lower back|back/, 'lower_back'], [/shoulder/, 'shoulder'], [/hip/, 'hip_flexor'], [/foot|heel/, 'foot'], [/neck/, 'neck'], [/wrist/, 'wrist'], [/elbow/, 'elbow']];
    const hit = map.find(([re]) => re.test(t));
    const region = hit ? hit[1] : null;
    const side = !region || CENTER.has(region) ? 'C' : /both|bilateral|hamstrings|calves|quads/.test(t) ? 'C' : /left|\bl\b/.test(t) ? 'L' : /right|\br\b/.test(t) ? 'R' : 'C';
    return { region, side };
  }
  const PAIN_RE = /pain|tight|sore|ache|niggle|hurt|strain|pull|swell|stiff/i;
  const nextInjId = (db) => 'INJ-' + (Math.max(2100, ...db.injuries.map((i) => +String(i.id).replace(/\D/g, '') || 0)) + 1);
  const closeTasks = (db, athleteId, re) => db.tasks.forEach((t) => { if (t.status === 'Open' && t.athleteId === athleteId && t.module === MOD && re.test(t.title)) { t.status = 'Done'; t.doneOn = AMS.TODAY; } });
  const marksFor = (list) => list.map((i) => ({ id: i.id, region: i.region, side: i.side, view: i.view, severity: i.severity, status: i.status, faded: i.status === 'Closed', label: (isMed() || AMS.ui.role === 'athlete' ? i.regionLabel : AMS.bodyZone(i.region)) + (i.status === 'Closed' ? ' (' + D.fmt(i.dateOfInjury) + ')' : '') }));
  function denied(msg) { AMS.toast(msg, 'bad'); return null; }

  /* ================================================================== workflow logic (actions) */
  function submitInjury(p) {
    const a = ath(p.athleteId);
    if (!a) return denied('Pick an athlete first');
    if (!p.region) return denied('Pick a body region on the map');
    if (AMS.ui.role === 'ops' || !AMS.can('medical', 'own')) return denied('Operations cannot record medical information');
    const side = CENTER.has(p.region) ? 'C' : (p.side || 'C');
    const path = p.path === 'light' ? 'light' : 'case';
    const type = p.type || (path === 'light' ? 'Tightness / niggle' : 'Muscle strain');
    const tpl = p.rtpTemplate || AMS.rtpTemplateFor(p.region, type);
    const rl = regionLabel(p.region, side);
    const by = meName();
    let id = null;
    AMS.mutate((db) => {
      id = nextInjId(db);
      const physio = db.staff.find((s) => s.role === 'physio' && s.centreId === a.centreId) || db.staff.find((s) => s.role === 'physio');
      const doctor = db.staff.find((s) => s.role === 'doctor' && s.centreId === a.centreId) || db.staff.find((s) => s.id === 'S-DOC01');
      const stages = AMS.makeRtpStages(tpl);
      const inj = {
        id, athleteId: a.id, region: p.region, side, view: p.view || viewFor(p.region), regionLabel: rl,
        diagnosis: p.diagnosis || (path === 'light' ? 'Light-path flag: ' + type.toLowerCase() + ', ' + rl.toLowerCase() : 'Suspected ' + type.toLowerCase() + ', ' + rl.toLowerCase() + ' — awaiting assessment'),
        type, grade: p.grade || null, severity: p.severity || 'minor', mechanism: p.mechanism || '', context: p.context || 'Training',
        dateOfInjury: p.dateOfInjury || AMS.TODAY, status: path === 'light' ? 'Monitoring' : 'Reported', path,
        availability: p.availability || a.availability, reportedBy: by, reportedAt: nowStamp(), reporterRole: AMS.ui.role,
        physioId: physio ? physio.id : null, doctorId: doctor ? doctor.id : null,
        rtpTemplate: tpl, rtpStages: stages, rtpStage: 0, stageSince: null, stageTargetDays: stages[0].targetDays,
        expectedReturn: p.expectedReturn || null,
        timeline: [{ date: AMS.TODAY, type: 'report', by, text: (path === 'light' ? 'Light-path flag opened: ' : 'Injury reported: ') + rl + (p.mechanism ? ' — ' + p.mechanism : '') + (p.pain != null ? ' · pain ' + p.pain + '/10' : '') }],
        notes: p.note ? [{ date: AMS.TODAY, by, role: AMS.ui.role, text: p.note }] : [],
        painLog: p.pain != null ? [{ date: AMS.TODAY, pain: +p.pain }] : [],
        clearance: null, setbacks: 0, aiSuggested: p.aiSuggested || null, source: p.source || 'report',
      };
      db.injuries.push(inj);
      const x = AMS.byId(db.athletes, a.id);
      if (p.availability && p.availability !== x.availability) {
        x.availability = p.availability; x.availabilityReason = AMS.bodyZone(p.region);
        inj.timeline.unshift({ date: AMS.TODAY, type: 'decision', by, text: 'Availability set to ' + p.availability + ' by ' + by + ' (human decision at report)' });
      }
      db.tasks.unshift(path === 'light'
        ? { id: AMS.uid('TSK'), title: 'Review light-path flag — ' + a.name + ' (' + rl.toLowerCase() + ')', ownerRole: 'physio', module: MOD, status: 'Open', created: AMS.TODAY, due: D.add(AMS.TODAY, 3), athleteId: a.id, ref: id }
        : { id: AMS.uid('TSK'), title: 'Assess ' + a.name + ' — ' + rl.toLowerCase(), ownerRole: 'physio', module: MOD, status: 'Open', created: AMS.TODAY, due: AMS.TODAY, athleteId: a.id, ref: id });
      AMS.notify({ toRole: 'physio', title: path === 'light' ? 'Light-path flag' : 'New injury to assess', text: a.name + ' — ' + rl + (p.pain != null ? ', pain ' + p.pain + '/10' : '') + '. Reported by ' + by + ' at ' + AMS.clockTime() + '.', athleteId: a.id, module: MOD });
      if (AMS.ui.role !== 'coach') AMS.notify({ toRole: 'coach', title: path === 'light' ? 'Athlete being monitored' : 'Injury reported', text: a.name + ': ' + AMS.medicalLabel(inj, 'coach') + '. Physio will update availability.', athleteId: a.id, module: MOD });
      AMS.log({ type: 'injury', text: (path === 'light' ? 'Light-path flag: ' : 'Injury reported: ') + a.name + ' — ' + (isMed() ? rl : AMS.bodyZone(p.region)), athleteId: a.id });
    }, { toast: (path === 'light' ? 'Light-path flag opened for ' : 'Injury reported for ') + a.name, toastAction: isMed() ? { label: 'Open case', run: () => AMS.openDrawer('injury', { injuryId: id }) } : undefined });
    return id;
  }

  function startAssessment(p) {
    const inj = AMS.byId(AMS.db.injuries, p.injuryId);
    if (!inj) return null;
    if (!isMed()) return denied('Only medical staff can start an assessment');
    if (inj.status !== 'Reported') return denied('Already ' + inj.status.toLowerCase());
    const a = ath(inj.athleteId), me = AMS.me();
    AMS.mutate((db) => {
      const x = AMS.byId(db.injuries, inj.id);
      x.status = 'Assessment';
      if (me && me.role === 'physio') x.physioId = me.id;
      x.timeline.unshift({ date: AMS.TODAY, type: 'assessment', by: meName(), text: 'Assessment started at ' + AMS.clockTime() + ' (' + agoText(reportedAt(x)) + ' after report)' });
      AMS.notify({ toRole: 'coach', title: 'Injury report picked up', text: a.name + ': physio assessing now. ' + AMS.medicalLabel(x, 'coach') + ' until assessed.', athleteId: a.id, module: MOD });
    }, { toast: a.name + ' moved to Assessment', log: { type: 'medical', text: 'Assessment started — ' + a.name, athleteId: a.id } });
    return 'Assessment started';
  }

  function assessInjury(p) {
    const inj = AMS.byId(AMS.db.injuries, p.injuryId);
    if (!inj) return null;
    if (!isMed()) return denied('Only physio or doctor can record an assessment');
    if (!['Reported', 'Assessment', 'Monitoring'].includes(inj.status)) return denied('Case is already in ' + inj.status);
    const a = ath(inj.athleteId), by = meName(), me = AMS.me();
    const tpl = p.rtpTemplate || inj.rtpTemplate || AMS.rtpTemplateFor(inj.region, inj.type);
    AMS.mutate((db) => {
      const x = AMS.byId(db.injuries, inj.id);
      if (p.diagnosis) x.diagnosis = p.diagnosis;
      if (p.grade != null && p.grade !== '') x.grade = +p.grade || null;
      if (p.severity) x.severity = p.severity;
      if (p.type) x.type = p.type;
      if (tpl !== x.rtpTemplate || x.status === 'Monitoring' || !x.rtpStages || !x.rtpStages.length) { x.rtpTemplate = tpl; x.rtpStages = AMS.makeRtpStages(tpl); }
      x.status = 'Rehab'; x.path = 'case'; x.rtpStage = 0; x.stageSince = AMS.TODAY; x.stageTargetDays = x.rtpStages[0].targetDays;
      x.expectedReturn = p.expectedReturn || x.expectedReturn || D.add(x.dateOfInjury, similarCases(x.region, x.type, x.id).median || 14);
      if (me && me.role === 'physio') x.physioId = me.id;
      x.timeline.unshift({ date: AMS.TODAY, type: 'assessment', by, text: 'Assessment: ' + x.diagnosis + (x.grade ? ' (grade ' + x.grade + ')' : '') + ' · ' + x.rtpStages.length + '-stage ' + tpl + ' RTP · expected return ' + D.fmt(x.expectedReturn) });
      if (p.note) x.notes.unshift({ date: AMS.TODAY, by, role: AMS.ui.role, text: p.note, kind: 'assessment' });
      const xa = AMS.byId(db.athletes, a.id);
      if (p.availability && p.availability !== xa.availability) {
        xa.availability = p.availability; xa.availabilityReason = AMS.bodyZone(x.region); x.availability = p.availability;
        x.timeline.unshift({ date: AMS.TODAY, type: 'decision', by, text: 'Availability set to ' + p.availability + ' by ' + by });
      } else if (p.availability) x.availability = p.availability;
      closeTasks(db, a.id, /Assess|light-path/i);
      db.tasks.unshift({ id: AMS.uid('TSK'), title: 'RTP stage 1 review — ' + a.name + ' (' + x.rtpStages[0].name + ')', ownerRole: 'physio', module: MOD, status: 'Open', created: AMS.TODAY, due: D.add(AMS.TODAY, x.rtpStages[0].targetDays), athleteId: a.id, ref: x.id });
      AMS.notify({ toRole: 'coach', title: 'Rehab plan in place', text: a.name + ': ' + AMS.medicalLabel(x, 'coach') + '. Expected back ' + D.fmt(x.expectedReturn) + '. Allowed: ' + allowedTraining(x) + '.', athleteId: a.id, module: MOD });
      if (x.severity === 'severe') AMS.notify({ toRole: 'doctor', title: 'Severe injury assessed', text: a.name + ' — ' + x.diagnosis + '. Please review.', athleteId: a.id, module: MOD });
    }, { toast: a.name + ' — assessed, rehab stage 1 started', log: { type: 'medical', text: 'Physio assessment recorded — ' + a.name + ' (' + inj.regionLabel + ') → Rehab', athleteId: a.id } });
    return 'Assessment saved';
  }

  function toggleCriterion(p) {
    const inj = AMS.byId(AMS.db.injuries, p.injuryId);
    if (!inj) return null;
    if (!isMed()) return denied('Only medical staff can tick RTP criteria');
    const st = stageOf(inj); if (!st || !st.criteria[p.index]) return null;
    const met = p.met != null ? !!p.met : !st.criteria[p.index].met;
    AMS.mutate((db) => {
      const x = AMS.byId(db.injuries, inj.id);
      x.rtpStages[x.rtpStage].criteria[p.index].met = met;
    }, { log: { type: 'medical', text: (met ? 'Criterion met: ' : 'Criterion un-ticked: ') + st.criteria[p.index].text + ' — ' + ath(inj.athleteId).name, athleteId: inj.athleteId } });
    return met ? 'Criterion met' : 'Criterion cleared';
  }

  function signStage(p) {
    const inj = AMS.byId(AMS.db.injuries, p.injuryId);
    if (!inj) return null;
    if (!isMed()) return denied('Only physio or doctor can sign off a stage');
    if (inj.status !== 'Rehab') return denied('Stage sign-off needs an active rehab case');
    const st = stageOf(inj);
    if (!st) return null;
    if (inj.rtpStage >= lastIdx(inj)) return denied('The final stage is signed by the team doctor via clearance');
    if (!st.criteria.every((c) => c.met)) return denied('All criteria for "' + st.name + '" must be met first');
    const a = ath(inj.athleteId), by = meName();
    let toClearance = false;
    AMS.mutate((db) => {
      const x = AMS.byId(db.injuries, inj.id);
      const cur = x.rtpStages[x.rtpStage];
      cur.signedBy = by; cur.signedAt = AMS.TODAY;
      x.timeline.unshift({ date: AMS.TODAY, type: 'stage', by, text: 'Stage ' + (x.rtpStage + 1) + ' signed off: ' + cur.name + ' (' + daysInStage(x) + ' d, plan ' + (x.stageTargetDays || cur.targetDays) + ' d)' });
      x.rtpStage += 1; x.stageSince = AMS.TODAY;
      const nx = x.rtpStages[x.rtpStage];
      x.stageTargetDays = nx.targetDays || 2;
      closeTasks(db, a.id, /stage|Review/i);
      if (x.rtpStage >= lastIdx(x)) {
        toClearance = true;
        x.status = 'Clearance';
        x.timeline.unshift({ date: AMS.TODAY, type: 'clearance', by, text: 'Clearance requested from ' + staffName(x.doctorId) });
        db.tasks.unshift({ id: AMS.uid('TSK'), title: 'Doctor clearance — ' + a.name + ' (' + AMS.bodyZone(x.region) + ')', ownerRole: 'doctor', module: MOD, status: 'Open', created: AMS.TODAY, due: D.add(AMS.TODAY, 1), athleteId: a.id, ref: x.id });
        AMS.notify({ toRole: 'doctor', title: 'Clearance requested', text: by + ' requested return-to-play clearance for ' + a.name + ' (' + x.regionLabel + ').', athleteId: a.id, module: MOD });
        AMS.notify({ toRole: 'coach', title: 'Awaiting clearance', text: a.name + ' completed full training stage. Awaiting team doctor clearance before competition.', athleteId: a.id, module: MOD });
      } else {
        db.tasks.unshift({ id: AMS.uid('TSK'), title: 'RTP stage ' + (x.rtpStage + 1) + ' review — ' + a.name + ' (' + nx.name + ')', ownerRole: 'physio', module: MOD, status: 'Open', created: AMS.TODAY, due: D.add(AMS.TODAY, nx.targetDays || 2), athleteId: a.id, ref: x.id });
        AMS.notify({ toRole: 'coach', title: 'Rehab progressed', text: a.name + ' moved to stage ' + (x.rtpStage + 1) + ' of ' + x.rtpStages.length + '. Allowed: ' + allowedTraining(x) + '.', athleteId: a.id, module: MOD });
      }
    }, { toast: toClearance ? a.name + ' — all rehab stages done, clearance requested' : a.name + ' — stage signed off', log: { type: 'medical', text: 'RTP stage signed off — ' + a.name + ': ' + st.name, athleteId: a.id } });
    return toClearance ? 'Clearance requested' : 'Stage signed off';
  }

  function logSetback(p) {
    const inj = AMS.byId(AMS.db.injuries, p.injuryId);
    if (!inj) return null;
    if (!isMed()) return denied('Only medical staff can log a setback');
    if (!['Rehab', 'Clearance'].includes(inj.status)) return denied('Setbacks apply to active rehab cases');
    const a = ath(inj.athleteId), by = meName();
    const reason = (p.reason || '').trim() || 'Symptoms recurred during stage';
    AMS.mutate((db) => {
      const x = AMS.byId(db.injuries, inj.id);
      const from = x.rtpStages[x.rtpStage];
      const to = Math.max(0, x.rtpStage - 1);
      for (let k = to; k < x.rtpStages.length; k++) { x.rtpStages[k].signedBy = null; x.rtpStages[k].signedAt = null; x.rtpStages[k].criteria.forEach((c) => { c.met = false; }); }
      x.rtpStage = to; x.status = 'Rehab'; x.stageSince = AMS.TODAY; x.stageTargetDays = x.rtpStages[to].targetDays;
      x.setbacks = (x.setbacks || 0) + 1;
      if (x.expectedReturn) x.expectedReturn = D.add(x.expectedReturn < AMS.TODAY ? AMS.TODAY : x.expectedReturn, x.rtpStages[to].targetDays || 5);
      x.timeline.unshift({ date: AMS.TODAY, type: 'setback', by, text: 'Setback: ' + reason + '. Moved back from "' + (from ? from.name : '') + '" to "' + x.rtpStages[to].name + '". Expected return now ' + D.fmt(x.expectedReturn) });
      closeTasks(db, a.id, /clearance/i);
      AMS.notify({ toRole: 'coach', title: 'Rehab setback', text: a.name + ': moved back to stage ' + (to + 1) + '. Allowed: ' + allowedTraining(x) + '. Expected back ' + D.fmt(x.expectedReturn) + '.', athleteId: a.id, module: MOD });
    }, { toast: 'Setback logged — ' + a.name + ' back one stage', toastKind: 'info', log: { type: 'medical', text: 'Rehab setback — ' + a.name + ': ' + reason, athleteId: a.id } });
    return 'Setback logged';
  }

  function escalate(p) {
    const inj = AMS.byId(AMS.db.injuries, p.injuryId);
    if (!inj) return null;
    if (!(isMed() || AMS.ui.role === 'coach')) return denied('Only physio, doctor or coach can escalate');
    const a = ath(inj.athleteId), by = meName();
    AMS.mutate((db) => {
      const x = AMS.byId(db.injuries, inj.id);
      x.decision = { status: 'Pending', question: p.question || 'Is ' + firstName(a.name) + ' ready to progress?', physioView: p.physioView || '', coachView: p.coachView || '', raisedBy: by, raisedRole: AMS.ui.role, at: nowStamp() };
      x.timeline.unshift({ date: AMS.TODAY, type: 'decision', by, text: 'Disagreement escalated to ' + staffName(x.doctorId) + ': ' + x.decision.question });
      db.tasks.unshift({ id: AMS.uid('TSK'), title: 'Decide physio/coach disagreement — ' + a.name, ownerRole: 'doctor', module: MOD, status: 'Open', created: AMS.TODAY, due: AMS.TODAY, athleteId: a.id, ref: x.id });
      AMS.notify({ toRole: 'doctor', title: 'Decision needed', text: by + ' escalated a readiness disagreement for ' + a.name + ': ' + x.decision.question, athleteId: a.id, module: MOD });
    }, { toast: 'Escalated to the team doctor', toastKind: 'info', log: { type: 'medical', text: 'Readiness disagreement escalated to doctor — ' + a.name, athleteId: a.id } });
    return 'Escalated';
  }

  function decide(p) {
    const inj = AMS.byId(AMS.db.injuries, p.injuryId);
    if (!inj || !inj.decision) return null;
    if (!isDoctor()) return denied('Only the team doctor records the decision');
    const a = ath(inj.athleteId), by = meName();
    const label = { physio: 'Physio view upheld', coach: 'Coach view upheld', other: 'Doctor\'s alternative plan' }[p.outcome] || 'Decision recorded';
    AMS.mutate((db) => {
      const x = AMS.byId(db.injuries, inj.id);
      Object.assign(x.decision, { status: 'Decided', outcome: p.outcome, rationale: p.rationale || '', decidedBy: by, decidedAt: nowStamp() });
      x.timeline.unshift({ date: AMS.TODAY, type: 'decision', by, text: label + (p.rationale ? ': ' + p.rationale : '') });
      closeTasks(db, a.id, /disagreement/i);
      ['physio', 'coach'].forEach((r) => AMS.notify({ toRole: r, title: 'Doctor decision', text: a.name + ': ' + label + (r === 'physio' && p.rationale ? ' — ' + p.rationale : '') + '.', athleteId: a.id, module: MOD }));
    }, { toast: label, log: { type: 'medical', text: 'Doctor decision — ' + a.name + ': ' + label, athleteId: a.id } });
    return label;
  }

  function clearInjury(p) {
    const inj = AMS.byId(AMS.db.injuries, p.injuryId);
    if (!inj) return null;
    if (!isDoctor()) return denied('Only the team doctor can sign return-to-play clearance');
    if (inj.status !== 'Clearance') return denied('Case must complete all rehab stages before clearance');
    const a = ath(inj.athleteId), by = meName();
    const conditions = (p.conditions || '').trim() || 'Graded return over 3 weeks; physio review after week 1';
    AMS.mutate((db) => {
      const x = AMS.byId(db.injuries, inj.id);
      const fin = x.rtpStages[lastIdx(x)];
      fin.criteria.forEach((c) => { c.met = true; }); fin.signedBy = by; fin.signedAt = AMS.TODAY;
      x.rtpStage = lastIdx(x); x.status = 'Closed'; x.closedOn = AMS.TODAY; x.daysLost = Math.max(1, D.diff(AMS.TODAY, x.dateOfInjury));
      x.clearance = { by, date: AMS.TODAY, conditions }; x.availability = 'Available';
      const xa = AMS.byId(db.athletes, a.id);
      x.gradedReturn = gradedPlan(xa, x, AMS.TODAY);
      x.timeline.unshift({ date: AMS.TODAY, type: 'clearance', by, text: 'Cleared to return to play. Conditions: ' + conditions + '. Graded load: ' + x.gradedReturn.weeks.map((w) => 'wk' + w.week + ' ' + w.pct + '%').join(', ') });
      const others = db.injuries.filter((o) => o.athleteId === a.id && o.id !== x.id && o.status !== 'Closed' && o.path === 'case');
      if (!others.length) { xa.availability = 'Available'; xa.availabilityReason = ''; }
      xa.returnedOn = AMS.TODAY;
      closeTasks(db, a.id, /clearance|stage|Review/i);
      AMS.notify({ toRole: 'coach', title: 'Cleared to return', text: a.name + ' cleared by ' + by + '. Graded return: week 1 ' + x.gradedReturn.weeks[0].capAU + ' AU (60%), week 2 75%, week 3 90% of normal load.', athleteId: a.id, module: MOD });
      AMS.notify({ toRole: 'physio', title: 'Clearance signed', text: a.name + ' — ' + x.regionLabel + ' closed after ' + x.daysLost + ' days. Conditions: ' + conditions, athleteId: a.id, module: MOD });
      AMS.notify({ toRole: 'scientist', title: 'Graded return-to-load', text: a.name + ' returns today; cap weekly load at ' + x.gradedReturn.weeks[0].capAU + ' AU in week 1.', athleteId: a.id, module: MOD });
    }, { toast: a.name + ' cleared to return — graded load plan ready', log: { type: 'medical', text: 'Return-to-play clearance signed — ' + a.name + ' (' + inj.regionLabel + ')', athleteId: a.id } });
    return 'Cleared';
  }

  function applyGraded(p) {
    const inj = AMS.byId(AMS.db.injuries, p.injuryId);
    if (!inj) return null;
    if (!(isMed() || AMS.canEdit('training') || AMS.canEdit('readiness'))) return denied('Coach, sports scientist or medical staff apply load plans');
    const a = ath(inj.athleteId), by = meName();
    const sess = AMS.todaySessionFor(a);
    AMS.mutate((db) => {
      const x = AMS.byId(db.injuries, inj.id);
      const xa = AMS.byId(db.athletes, a.id);
      if (!x.gradedReturn) x.gradedReturn = gradedPlan(xa, x, x.closedOn || AMS.TODAY);
      x.gradedReturn.applied = { by, at: nowStamp() };
      xa.loadPlan = { source: x.id, label: 'Graded return after ' + AMS.bodyZone(x.region) + ' injury', start: x.gradedReturn.start, weeks: x.gradedReturn.weeks.map((w) => Object.assign({}, w)), setBy: by };
      xa.tags = xa.tags || [];
      if (!xa.tags.includes('Graded return')) xa.tags.push('Graded return');
      if (sess) { const s = AMS.byId(db.sessions, sess.id); s.mods = s.mods || {}; s.mods[a.id] = { variant: 'reduced', by: AMS.ui.role, at: AMS.clockTime() }; }
      x.timeline.unshift({ date: AMS.TODAY, type: 'decision', by, text: 'Graded return-to-load applied: weekly caps ' + x.gradedReturn.weeks.map((w) => w.capAU + ' AU').join(' → ') + (sess ? '; today: reduced volume in ' + sess.title : '') });
      ['coach', 'scientist'].forEach((r) => AMS.notify({ toRole: r, title: 'Load cap applied', text: a.name + ': week 1 cap ' + x.gradedReturn.weeks[0].capAU + ' AU (~' + x.gradedReturn.weeks[0].perSession + ' AU/session).', athleteId: a.id, module: 'training' }));
    }, { toast: 'Graded return plan applied for ' + a.name, log: { type: 'training', text: 'Graded return-to-load applied — ' + a.name, athleteId: a.id } });
    return 'Plan applied';
  }

  function addNote(p) {
    const inj = AMS.byId(AMS.db.injuries, p.injuryId);
    if (!inj) return null;
    if (!isMed()) return denied('Medical notes are restricted to medical staff');
    const text = (p.text || '').trim();
    if (!text) return denied('Write a note first');
    const a = ath(inj.athleteId), by = meName();
    AMS.mutate((db) => {
      const x = AMS.byId(db.injuries, inj.id);
      x.notes.unshift({ date: AMS.TODAY, by, role: AMS.ui.role, text, at: AMS.clockTime() });
      x.timeline.unshift({ date: AMS.TODAY, type: 'note', by, text: 'Medical note: ' + (text.length > 90 ? text.slice(0, 88) + '…' : text) });
    }, { toast: 'Note saved (medical staff only)', log: { type: 'medical', text: 'Medical note added — ' + a.name, athleteId: a.id } });
    return 'Note added';
  }

  function logPain(p) {
    const inj = AMS.byId(AMS.db.injuries, p.injuryId);
    if (!inj) return null;
    const own = AMS.ui.role === 'athlete' && AMS.me() && AMS.me().id === inj.athleteId;
    if (!isMed() && !own) return denied('Pain scores are recorded by medical staff or the athlete');
    const pain = AMS.clamp(Math.round(+p.pain || 0), 0, 10);
    const a = ath(inj.athleteId);
    AMS.mutate((db) => {
      const x = AMS.byId(db.injuries, inj.id);
      const prev = x.painLog.filter((e) => e.date !== AMS.TODAY).slice(-1)[0];
      x.painLog = x.painLog.filter((e) => e.date !== AMS.TODAY).concat({ date: AMS.TODAY, pain });
      if (prev && pain - prev.pain >= 2) x.timeline.unshift({ date: AMS.TODAY, type: 'note', by: meName(), text: 'Pain up ' + prev.pain + ' → ' + pain + '/10 — review stage progression' });
    }, { toast: 'Pain ' + pain + '/10 recorded', log: { type: 'medical', text: 'Pain score recorded — ' + a.name, athleteId: a.id } });
    return 'Pain recorded';
  }

  function flagLight(p) {
    if (AMS.ui.role === 'ops') return denied('Operations cannot record medical information');
    const a = ath(p.athleteId);
    if (!a) return null;
    const g = p.region ? { region: p.region, side: p.side } : guessRegion(p.note);
    if (!g.region) return denied('Could not tell the body region — use Report injury');
    return submitInjury({ athleteId: a.id, region: g.region, side: p.side || g.side, type: p.type || 'Tightness / niggle', severity: 'minor', mechanism: p.note || 'Flagged from wellness check-in', pain: p.pain, path: 'light', source: p.source || 'wellness', note: p.note ? 'Check-in note: "' + p.note + '"' : '' });
  }

  function escalateLight(p) {
    const inj = AMS.byId(AMS.db.injuries, p.injuryId);
    if (!inj) return null;
    if (!isMed()) return denied('Only medical staff can open a rehab case');
    if (inj.status !== 'Monitoring') return null;
    const a = ath(inj.athleteId);
    AMS.mutate((db) => {
      const x = AMS.byId(db.injuries, inj.id);
      x.status = 'Assessment'; x.path = 'case';
      x.timeline.unshift({ date: AMS.TODAY, type: 'assessment', by: meName(), text: 'Light path escalated to a full case — assessment booked' });
      closeTasks(db, a.id, /light-path/i);
      db.tasks.unshift({ id: AMS.uid('TSK'), title: 'Assess ' + a.name + ' — ' + x.regionLabel.toLowerCase(), ownerRole: 'physio', module: MOD, status: 'Open', created: AMS.TODAY, due: AMS.TODAY, athleteId: a.id, ref: x.id });
      AMS.notify({ toRole: 'coach', title: 'Monitoring escalated', text: a.name + ': now ' + AMS.medicalLabel(x, 'coach') + ' pending assessment.', athleteId: a.id, module: MOD });
    }, { toast: a.name + ' escalated to a rehab case', toastKind: 'info', log: { type: 'medical', text: 'Light-path flag escalated to case — ' + a.name, athleteId: a.id } });
    return 'Escalated to case';
  }

  function resolveLight(p) {
    const inj = AMS.byId(AMS.db.injuries, p.injuryId);
    if (!inj) return null;
    if (!isMed()) return denied('Only medical staff can resolve a monitoring flag');
    if (inj.status !== 'Monitoring') return null;
    const a = ath(inj.athleteId);
    AMS.mutate((db) => {
      const x = AMS.byId(db.injuries, inj.id);
      x.status = 'Closed'; x.closedOn = AMS.TODAY; x.daysLost = 0; x.availability = 'Available';
      x.timeline.unshift({ date: AMS.TODAY, type: 'clearance', by: meName(), text: 'Monitoring resolved — symptoms settled' + (p.note ? ': ' + p.note : '') });
      closeTasks(db, a.id, /light-path/i);
    }, { toast: 'Monitoring closed for ' + a.name, log: { type: 'medical', text: 'Light-path flag resolved — ' + a.name, athleteId: a.id } });
    return 'Resolved';
  }

  function setAvailability(p) {
    const inj = AMS.byId(AMS.db.injuries, p.injuryId);
    if (!inj) return null;
    if (!isMed()) return denied('Availability for injured athletes is set by medical staff');
    const a = ath(inj.athleteId), by = meName();
    AMS.mutate((db) => {
      const x = AMS.byId(db.injuries, inj.id);
      const xa = AMS.byId(db.athletes, a.id);
      x.availability = p.value; xa.availability = p.value; xa.availabilityReason = p.value === 'Available' ? '' : AMS.bodyZone(x.region);
      x.timeline.unshift({ date: AMS.TODAY, type: 'decision', by, text: 'Availability set to ' + p.value + ' by ' + by });
      AMS.notify({ toRole: 'coach', title: 'Availability changed', text: a.name + ' is now ' + p.value + (p.value !== 'Available' ? ' (' + AMS.bodyZone(x.region) + ')' : '') + '.', athleteId: a.id, module: MOD });
    }, { toast: a.name + ' is now ' + p.value, log: { type: 'availability', text: a.name + ' set to ' + p.value + ' (medical)', athleteId: a.id } });
    return 'Availability updated';
  }

  function screen(p) {
    const a = ath(p.athleteId);
    if (!a) return null;
    if (AMS.ui.role === 'ops') return denied('Not available for operations');
    AMS.mutate((db) => {
      db.tasks.unshift({ id: AMS.uid('TSK'), title: 'Pre-session screen — ' + a.name + (p.reason ? ' (' + p.reason + ')' : ''), ownerRole: 'physio', module: MOD, status: 'Open', created: AMS.TODAY, due: AMS.TODAY, athleteId: a.id, kind: 'screen' });
      AMS.notify({ toRole: 'physio', title: 'Screening requested', text: a.name + ': ' + (p.reason || 'elevated injury risk') + '. Please screen before training.', athleteId: a.id, module: MOD });
    }, { toast: 'Screening task created for physio', log: { type: 'medical', text: 'Preventive screen requested — ' + a.name, athleteId: a.id } });
    return 'Screening task created';
  }

  function loadCap(p) {
    const a = ath(p.athleteId);
    if (!a) return null;
    let inj = AMS.db.injuries.filter((i) => i.athleteId === a.id && i.status === 'Closed').sort((x, y) => String(y.closedOn).localeCompare(String(x.closedOn)))[0];
    if (!inj) return denied('No closed injury to base a return plan on');
    if (a.returnedOn && inj.closedOn !== a.returnedOn) {
      AMS.mutate((db) => { const x = AMS.byId(db.injuries, inj.id); const xa = AMS.byId(db.athletes, a.id); x.gradedReturn = gradedPlan(xa, x, a.returnedOn); });
    }
    return applyGraded({ injuryId: inj.id });
  }

  AMS.registerAction('injury.report', (p) => { if (AMS.ui.role === 'ops') return denied('Operations cannot record medical information'); AMS.openModal('injury-report', { athleteId: p.athleteId, region: p.region, side: p.side }); return 'Injury report opened'; });
  AMS.registerAction('injury.submit', submitInjury);
  AMS.registerAction('injury.open', (p) => { AMS.openDrawer('injury', { injuryId: p.injuryId, tab: p.tab }); return 'Opened'; });
  AMS.registerAction('injury.startAssessment', startAssessment);
  AMS.registerAction('injury.assess', assessInjury);
  AMS.registerAction('injury.toggleCriterion', toggleCriterion);
  AMS.registerAction('injury.signStage', signStage);
  AMS.registerAction('injury.setback', logSetback);
  AMS.registerAction('injury.escalate', escalate);
  AMS.registerAction('injury.decide', decide);
  AMS.registerAction('injury.clear', clearInjury);
  AMS.registerAction('injury.applyGradedReturn', applyGraded);
  AMS.registerAction('injury.addNote', addNote);
  AMS.registerAction('injury.logPain', logPain);
  AMS.registerAction('injury.flagLight', flagLight);
  AMS.registerAction('injury.escalateLight', escalateLight);
  AMS.registerAction('injury.resolveLight', resolveLight);
  AMS.registerAction('injury.setAvailability', setAvailability);
  AMS.registerAction('medical.screen', screen);
  AMS.registerAction('medical.loadCap', loadCap);

  /* ================================================================== AI detectors */
  AMS.registerDetector('medical.unassessed', function (ctx) {
    if (!['physio', 'doctor', 'director', 'coach'].includes(ctx.role)) return [];
    return ctx.db.injuries.filter((i) => i.status === 'Reported' && ctx.ids.has(i.athleteId)).map((i) => {
      const a = AMS.org.athlete(i.athleteId);
      const ts = reportedAt(i), h = hoursSince(ts);
      const sess = AMS.todaySessionFor(a);
      const late = h > 1;
      const med = AMS.medicalFull(ctx.role);
      const acts = med
        ? [{ label: 'Start assessment', action: 'injury.startAssessment', payload: { injuryId: i.id }, primary: true }, { label: 'Open case', action: 'injury.open', payload: { injuryId: i.id, tab: 'case' } }]
        : [{ label: 'Ask physio to assess', action: 'notify', payload: { toRole: 'physio', athleteId: a.id, text: a.name + ' reported ' + AMS.bodyZone(i.region) + ' pain ' + agoText(ts) + ' — still unassessed.' }, primary: true }];
      if (sess && !(sess.mods && sess.mods[a.id]) && a.availability !== 'Unavailable') acts.push({ label: 'Rehab programme for ' + sess.start, action: 'session.modifyForAthlete', payload: { athleteId: a.id, sessionId: sess.id, variant: 'rehab' } });
      return {
        id: 'unassessed:' + i.id, kind: 'medical', severity: late ? 'high' : 'med', module: MOD,
        title: a.name + ' — injury report ' + (late ? 'unassessed for ' + agoText(ts).replace(' ago', '') : 'waiting for a physio'),
        summary: (med ? i.regionLabel : AMS.bodyZone(i.region)) + ' reported ' + agoText(ts) + (sess ? '; ' + sess.title + ' starts ' + sess.start + '.' : '.') + ' Target: assessed within 1 h of report so the coach knows what is allowed.',
        athleteIds: [a.id], confidence: 0.93,
        evidence: [{ label: 'Reported', value: ts.slice(11, 16), tone: late ? 'bad' : 'warn' }, { label: 'Waiting', value: agoText(ts).replace(' ago', ''), tone: late ? 'bad' : 'warn' }, { label: 'Status', value: 'Unassessed', tone: 'bad' }].concat((i.painLog || []).length ? [{ label: 'Pain', value: i.painLog[i.painLog.length - 1].pain + '/10', tone: 'warn' }] : []),
        actions: acts,
      };
    });
  });
  AMS.registerDetector('medical.clearanceDue', function (ctx) {
    if (!['doctor', 'physio', 'director'].includes(ctx.role)) return [];
    return ctx.db.injuries.filter((i) => i.status === 'Clearance' && ctx.ids.has(i.athleteId)).map((i) => {
      const a = AMS.org.athlete(i.athleteId);
      const waiting = daysInStage(i);
      const prev = (i.rtpStages || [])[lastIdx(i) - 1];
      return {
        id: 'clearance:' + i.id, kind: 'medical', severity: waiting >= 1 ? 'high' : 'med', module: MOD, roles: ['doctor', 'physio', 'director'],
        title: a.name + ' — return-to-play clearance waiting' + (ctx.role === 'doctor' ? ' for you' : ' on ' + staffName(i.doctorId)),
        summary: 'All ' + lastIdx(i) + ' rehab stages signed off' + (prev && prev.signedAt ? ' (last on ' + D.fmt(prev.signedAt) + ')' : '') + '. Expected return ' + D.fmt(i.expectedReturn) + '. Only the team doctor can clear; a graded return-to-load plan is generated on clearance.',
        athleteIds: [a.id], confidence: 0.9,
        evidence: [{ label: 'Stages done', value: lastIdx(i) + '/' + lastIdx(i), tone: 'good' }, { label: 'Waiting', value: waiting + ' d', tone: waiting >= 1 ? 'warn' : 'info' }, { label: 'Setbacks', value: String(i.setbacks || 0), tone: i.setbacks ? 'warn' : 'good' }, { label: 'Days out', value: String(daysSince(i)), tone: 'info' }],
        actions: [{ label: ctx.role === 'doctor' ? 'Review & clear' : 'Open case', action: 'injury.open', payload: { injuryId: i.id, tab: 'rtp' }, primary: true }].concat(ctx.role !== 'doctor' ? [{ label: 'Nudge doctor', action: 'notify', payload: { toRole: 'doctor', athleteId: a.id, text: 'Clearance pending for ' + a.name + ' — all rehab stages complete.' } }] : []),
      };
    });
  });
  AMS.registerDetector('medical.preventive', function (ctx) {
    if (['ops', 'athlete', 'nutritionist'].includes(ctx.role)) return [];
    const open = new Set(ctx.db.injuries.filter((i) => i.status !== 'Closed').map((i) => i.athleteId));
    return ctx.athletes.filter((a) => !open.has(a.id)).map((a) => ({ a, r: C.risk(a) })).filter((x) => x.r.score >= 70).map(({ a, r }) => {
      const sess = AMS.todaySessionFor(a);
      const w = C.todayWellness(a);
      const g = w && w.note && PAIN_RE.test(w.note) ? guessRegion(w.note) : null;
      const screened = ctx.db.tasks.some((t) => t.status === 'Open' && t.athleteId === a.id && t.kind === 'screen');
      const acts = [];
      if (!screened) acts.push({ label: 'Create screening task', action: 'medical.screen', payload: { athleteId: a.id, reason: 'risk ' + r.score + '/100' }, primary: true });
      if (sess && !(sess.mods && sess.mods[a.id])) acts.push({ label: 'Modify ' + sess.title, action: 'session.modifyForAthlete', payload: { athleteId: a.id, sessionId: sess.id, variant: 'reduced' }, primary: screened });
      if (g && g.region && ['physio', 'doctor', 'coach'].includes(ctx.role)) acts.push({ label: 'Flag ' + regionLabel(g.region, g.side).toLowerCase() + ' (light path)', action: 'injury.flagLight', payload: { athleteId: a.id, region: g.region, side: g.side, note: w.note } });
      return {
        id: 'preventive:' + a.id + ':' + AMS.TODAY, kind: 'risk', severity: r.score >= 80 ? 'high' : 'med', module: MOD,
        title: a.name + ' — predicted injury risk ' + r.score + '/100',
        summary: 'No open injury, but ' + r.factors.slice(0, 3).map((f) => f.label.toLowerCase() + ' ' + f.value).join(', ') + (w && w.note ? '. Check-in note: "' + w.note + '"' : '') + '. Suggest a physio screen and a lighter session today.',
        athleteIds: [a.id], confidence: AMS.round(0.6 + Math.min(0.3, r.factors.length * 0.06), 2),
        evidence: r.factors.slice(0, 5).map((f) => ({ label: f.label, value: f.value, tone: f.tone })),
        actions: acts.length ? acts : [{ label: 'Open athlete', action: 'open.athlete', payload: { athleteId: a.id, tab: 'medical' }, primary: true }],
      };
    });
  });
  AMS.registerDetector('medical.reinjuryWindow', function (ctx) {
    if (['ops', 'athlete', 'nutritionist'].includes(ctx.role)) return [];
    return ctx.athletes.filter((a) => a.returnedOn && D.diff(AMS.TODAY, a.returnedOn) <= 28 && D.diff(AMS.TODAY, a.returnedOn) >= 0).map((a) => {
      const now = C.acwr(a), wk = C.acwr(a, 33);
      if (!(now > 1.2 || now - wk >= 0.12)) return null;
      const capped = !!a.loadPlan;
      return {
        id: 'reinjury:' + a.id + ':' + AMS.TODAY, kind: 'risk', severity: now >= 1.4 ? 'high' : 'med', module: MOD,
        title: a.name + ' — re-injury window, load rising',
        summary: 'Returned from injury ' + D.rel(a.returnedOn) + ' (day ' + D.diff(AMS.TODAY, a.returnedOn) + ' of the 28-day re-injury window). ACWR ' + wk.toFixed(2) + ' → ' + now.toFixed(2) + ' in a week' + (capped ? ' despite the graded plan.' : ' and no graded return-to-load plan is applied.'),
        athleteIds: [a.id], confidence: 0.77,
        evidence: [{ label: 'Returned', value: D.fmt(a.returnedOn), tone: 'info' }, { label: 'ACWR now', value: now.toFixed(2), tone: C.acwrBand(now) }, { label: 'A week ago', value: wk.toFixed(2), tone: 'info' }, { label: 'This week', value: C.weekLoad(a) + ' AU', tone: 'warn' }],
        actions: [!capped && { label: 'Apply graded load cap', action: 'medical.loadCap', payload: { athleteId: a.id }, primary: true }, { label: 'Notify coach', action: 'notify', payload: { toRole: 'coach', athleteId: a.id, text: a.name + ' is ' + D.diff(AMS.TODAY, a.returnedOn) + ' days back from injury and load is rising (ACWR ' + now.toFixed(2) + '). Please hold volume this week.' }, primary: capped }].filter(Boolean),
      };
    }).filter(Boolean);
  });

  /* ================================================================== shared view pieces */
  const StatusPill = ({ inj }) => html`<${UI.Pill} tone=${STATUS_TONE[inj.status]} dot>${inj.status === 'Monitoring' ? 'Monitoring · light path' : inj.status}<//>`;
  function PrivacyNote({ text }) {
    return html`<div className="med-lock"><${I} name="lock" size=${14} /><span>${text || 'Medical details (diagnosis, notes, pain scores) are visible to medical staff only. You see availability, body zone, rehab stage and what training is allowed.'}</span></div>`;
  }
  function openInjury(inj, tab) { AMS.openDrawer('injury', { injuryId: inj.id, tab }); }
  /** Monthly calendar helpers for analytics. */
  const monthKey = (iso) => iso.slice(0, 7);
  function lastMonths(n) { const out = []; let d = AMS.TODAY.slice(0, 7) + '-01'; for (let k = 0; k < n; k++) { out.unshift(d.slice(0, 7)); const prev = D.add(d, -1); d = prev.slice(0, 7) + '-01'; } return out; }
  const monthLabel = (key) => D.MONTHS[+key.slice(5, 7) - 1] + (key.slice(0, 4) !== '2026' ? ' ' + key.slice(2, 4) : '');
  function daysLostInMonth(inj, key) {
    if (inj.path === 'light' || inj.daysLost === 0) return 0;
    const start = key + '-01';
    const end = D.add(lastMonths(1)[0] === key ? AMS.TODAY : D.add(D.add(start, 31).slice(0, 7) + '-01', -1), 0);
    const from = inj.dateOfInjury > start ? inj.dateOfInjury : start;
    const to0 = inj.closedOn || AMS.TODAY;
    const to = to0 < end ? to0 : end;
    return Math.max(0, D.diff(to, from) + (to >= from ? 1 : 0));
  }
  /** Re-injury = same athlete, same region, a previous injury already closed before this one started. */
  function isReinjury(inj, all) { return all.some((o) => o.id !== inj.id && o.athleteId === inj.athleteId && o.region === inj.region && o.closedOn && o.closedOn <= inj.dateOfInjury); }
  /** Training hours from sRPE loads (AU ÷ mean session RPE 6 ÷ 60). */
  const TRAINING_RPE = 6;
  function trainingHours(athletes, days) { return athletes.reduce((s, a) => s + AMS.sum((a.loads || []).slice(41 - days, 41)), 0) / TRAINING_RPE / 60; }

  /* ================================================================== page */
  function Page({ params }) {
    const { db, v } = AMS.useStore();
    const role = AMS.ui.role;
    const full = isMed();
    const [tab, setTab] = useState((params && params.tab) || 'overview');
    useEffect(() => { if (params && params.tab) setTab(params.tab); }, [params && params.tab]);
    const athletes = AMS.scopedAthletes();
    const ids = new Set(athletes.map((a) => a.id));
    const injuries = db.injuries.filter((i) => ids.has(i.athleteId));
    const open = injuries.filter(isOpen);
    const reported = open.filter((i) => i.status === 'Reported').length;
    const tabs = [
      { id: 'overview', label: 'Overview', icon: 'grid' },
      { id: 'caseload', label: 'Caseload', icon: 'clipboard', count: open.length },
      { id: 'wellness', label: 'Wellness monitoring', icon: 'pulse' },
      { id: 'analytics', label: 'Injury analytics', icon: 'chart' },
    ];
    const cur = tabs.some((t) => t.id === tab) ? tab : 'overview';
    return html`<div className="page">
      <${UI.PageHead} title="Medical & Injury" sub=${AMS.scopeLabel() + ' · ' + open.length + ' open cases · ' + reported + ' awaiting assessment · ' + (full ? 'full clinical view' : 'summary view')}
        actions=${html`<${Frag}>
          <${UI.AskCopilot} prompt="Who is at injury risk this week and why?" label="Ask Copilot" />
          ${role !== 'ops' && html`<button className="btn primary" onClick=${() => AMS.runAction('injury.report', {})}><${I} name="plus" size=${14} />Report injury</button>`}
        <//>`} />
      ${!full && html`<${PrivacyNote} />`}
      <${UI.Tabs} tabs=${tabs} value=${cur} onChange=${setTab} />
      ${cur === 'overview' && html`<${Overview} athletes=${athletes} injuries=${injuries} v=${v} setTab=${setTab} />`}
      ${cur === 'caseload' && html`<${Caseload} injuries=${injuries} v=${v} />`}
      ${cur === 'wellness' && html`<${Wellness} athletes=${athletes} v=${v} />`}
      ${cur === 'analytics' && html`<${Analytics} athletes=${athletes} injuries=${injuries} v=${v} />`}
    </div>`;
  }

  /* ------------------------------------------------------------------ overview */
  function CaseRow({ inj, compact }) {
    const a = ath(inj.athleteId);
    const st = stageOf(inj);
    return html`<div className="list-item clickable" style=${{ cursor: 'pointer', padding: compact ? '8px 12px' : undefined }} onClick=${() => openInjury(inj)}>
      <${UI.Avatar} name=${a.name} size=${28} />
      <div className="col tight grow" style=${{ gap: 1, minWidth: 0 }}>
        <div className="row tight" style=${{ minWidth: 0 }}><span className="ellipsis" style=${{ fontWeight: 600 }}>${a.name}</span>${isOverdue(inj) && html`<${UI.Pill} tone="bad">Stage overdue<//>`}${(inj.setbacks || 0) > 0 && html`<${UI.Pill} tone="warn">${inj.setbacks} setback${inj.setbacks > 1 ? 's' : ''}<//>`}</div>
        <span className="tiny faint ellipsis">${whereText(inj)} · day ${daysSince(inj)}${inj.status === 'Rehab' && st ? ' · stage ' + (inj.rtpStage + 1) + '/' + inj.rtpStages.length + ' ' + st.name : ''}${inj.expectedReturn ? ' · back ' + D.fmt(inj.expectedReturn) : ''}</span>
      </div>
      <${StatusPill} inj=${inj} />
    </div>`;
  }

  function Overview({ athletes, injuries, v, setTab }) {
    const full = isMed();
    const role = AMS.ui.role;
    const [heatMode, setHeatMode] = useState('open');
    const [sel, setSel] = useState(null);
    const [view, setView] = useState('front');
    const open = injuries.filter(isOpen);
    const monthStart = AMS.TODAY.slice(0, 8) + '01';
    const k = useMemo(() => {
      const unavailable = athletes.filter((a) => a.availability === 'Unavailable');
      const modified = athletes.filter((a) => a.availability === 'Modified');
      const daysLost = AMS.sum(injuries.map((i) => daysLostInMonth(i, AMS.TODAY.slice(0, 7))));
      const daysLostPrev = AMS.sum(injuries.map((i) => daysLostInMonth(i, lastMonths(2)[0])));
      const hours = trainingHours(athletes, 28);
      const recent = injuries.filter((i) => D.diff(AMS.TODAY, i.dateOfInjury) < 28);
      const incidence = hours ? (recent.length / hours) * 1000 : 0;
      const yr = injuries.filter((i) => D.diff(AMS.TODAY, i.dateOfInjury) <= 365);
      const re = yr.filter((i) => isReinjury(i, injuries));
      const weekly = [3, 2, 1, 0].map((w) => injuries.filter((i) => { const d = D.diff(AMS.TODAY, i.dateOfInjury); return d >= w * 7 && d < (w + 1) * 7; }).length);
      return { unavailable, modified, daysLost, daysLostPrev, hours, recent, incidence, yr, re, reRate: yr.length ? Math.round((re.length / yr.length) * 100) : 0, weekly };
    }, [v, athletes.length]);
    const heat = useMemo(() => {
      const pool = heatMode === 'open' ? open : injuries.filter((i) => D.diff(AMS.TODAY, i.dateOfInjury) <= 365);
      const h = {}; pool.forEach((i) => { const key = i.region + ':' + (CENTER.has(i.region) ? 'C' : i.side); h[key] = (h[key] || 0) + 1; });
      return { h, pool };
    }, [v, heatMode, athletes.length]);
    const list = heat.pool.filter((i) => !sel || (i.region === sel.region && (CENTER.has(i.region) || i.side === sel.side || i.side === 'C' || sel.side === 'C')))
      .sort((a, b) => (isOpen(b) - isOpen(a)) || b.dateOfInjury.localeCompare(a.dateOfInjury));
    const warnings = useMemo(() => {
      const openIds = new Set(open.map((i) => i.athleteId));
      return athletes.filter((a) => !openIds.has(a.id)).map((a) => ({ a, r: C.risk(a) })).filter((x) => x.r.score >= 35).sort((x, y) => y.r.score - x.r.score).slice(0, 6);
    }, [v, athletes.length]);
    const inbox = useMemo(() => {
      const items = [];
      open.filter((i) => i.status === 'Reported').forEach((i) => items.push({ id: 'r' + i.id, inj: i, icon: 'flag', tone: 'bad', title: ath(i.athleteId).name + ' — ' + whereText(i), sub: 'Reported ' + reportedAt(i).slice(11, 16) + ' · ' + agoText(reportedAt(i)) + ' · by ' + i.reportedBy, action: full ? { label: 'Start assessment', run: () => AMS.runAction('injury.startAssessment', { injuryId: i.id }) } : null }));
      open.filter((i) => i.status === 'Clearance').forEach((i) => items.push({ id: 'c' + i.id, inj: i, icon: 'shield-check', tone: 'ai', title: ath(i.athleteId).name + ' — clearance requested', sub: 'All stages signed · waiting ' + daysInStage(i) + ' d on ' + staffName(i.doctorId), action: role === 'doctor' ? { label: 'Review & clear', run: () => openInjury(i, 'rtp') } : null }));
      open.filter((i) => i.decision && i.decision.status === 'Pending').forEach((i) => items.push({ id: 'd' + i.id, inj: i, icon: 'scale', tone: 'warn', title: ath(i.athleteId).name + ' — decision needed', sub: i.decision.question + ' · raised by ' + i.decision.raisedBy, action: role === 'doctor' ? { label: 'Decide', run: () => openInjury(i, 'rtp') } : null }));
      open.filter((i) => i.status === 'Assessment').forEach((i) => items.push({ id: 'a' + i.id, inj: i, icon: 'clipboard', tone: 'warn', title: ath(i.athleteId).name + ' — assessment in progress', sub: whereText(i) + ' · since ' + D.rel(i.timeline[0] ? i.timeline[0].date : i.dateOfInjury), action: full ? { label: 'Complete', run: () => openInjury(i, 'case') } : null }));
      return items;
    }, [v, athletes.length, role]);
    const myTasks = AMS.db.tasks.filter((t) => t.status === 'Open' && t.module === MOD && t.ownerRole === role && (!t.athleteId || athletes.some((a) => a.id === t.athleteId)));
    const insights = AMS.ai.insights({ module: MOD });
    const onRegion = (region, side) => { setSel(sel && sel.region === region && sel.side === side ? null : { region, side }); };
    return html`<div className="col loose">
      <div className="grid g6">
        <${UI.KPI} label="Open cases" icon="clipboard" value=${open.length} foot=${open.filter((i) => i.status === 'Reported').length + ' unassessed · ' + open.filter((i) => i.path === 'light').length + ' light path'} spark=${k.weekly} sparkTone="bad" onClick=${() => setTab('caseload')} />
        <${UI.KPI} label="Unavailable" icon="alert" value=${k.unavailable.length} tone=${k.unavailable.length ? 'bad' : ''} foot=${'of ' + athletes.length + ' active athletes'} onClick=${() => AMS.openDrawer('athlete-list', { title: 'Unavailable athletes', athleteIds: k.unavailable.map((a) => a.id), note: 'Medical availability set by physio/doctor.' })} />
        <${UI.KPI} label="Modified training" icon="sliders" value=${k.modified.length} tone=${k.modified.length ? 'warn' : ''} foot="train with limits" onClick=${() => AMS.openDrawer('athlete-list', { title: 'Modified training', athleteIds: k.modified.map((a) => a.id), note: 'Allowed training is shown on each case.' })} />
        <${UI.KPI} label=${'Days lost · ' + D.month(AMS.TODAY)} icon="calendar" value=${k.daysLost} unit="d" foot=${k.daysLostPrev + ' d in ' + monthLabel(lastMonths(2)[0]) + ' (full month)'} onClick=${() => setTab('analytics')} />
        <${UI.KPI} label="Incidence / 1000 h" icon="pulse" value=${AMS.round(k.incidence, 1)} foot=${k.recent.length + ' injuries · ' + Math.round(k.hours).toLocaleString('en-IN') + ' training h (28 d, from sRPE)'} title="Injuries in the last 28 days per 1,000 training hours. Hours = sRPE load ÷ mean session RPE 6 ÷ 60." onClick=${() => setTab('analytics')} />
        <${UI.KPI} label="Re-injury rate" icon="refresh" value=${k.reRate} unit="%" tone=${k.reRate > 15 ? 'bad' : k.reRate > 8 ? 'warn' : 'good'} foot=${k.re.length + ' of ' + k.yr.length + ' injuries in 12 months'} onClick=${() => setTab('analytics')} />
      </div>
      <div className="grid g-main">
        <div className="col loose" style=${{ minWidth: 0 }}>
          <${UI.Card} title=${'Injury map — ' + AMS.scopeLabel()} icon="medical" hint=${heat.pool.length + (heatMode === 'open' ? ' open' : ' in 12 months')}
            actions=${html`<${UI.Seg} size="sm" value=${heatMode} onChange=${(m) => { setHeatMode(m); setSel(null); }} options=${[{ id: 'open', label: 'Open cases' }, { id: 'year', label: '12 months' }]} />`}>
            <div className="med-split">
              <${BodyMap} layer="heat" heat=${heat.h} view=${view} onViewChange=${setView} selected=${sel} onSelect=${onRegion} height=${400} />
              <div className="col tight" style=${{ minWidth: 0 }}>
                <div className="row between">
                  <span className="small" style=${{ fontWeight: 600 }}>${sel ? regionLabel(sel.region, CENTER.has(sel.region) ? 'C' : sel.side) : 'All regions'} <span className="faint">· ${list.length} case${list.length === 1 ? '' : 's'}</span></span>
                  ${sel && html`<button className="btn xs ghost" onClick=${() => setSel(null)}><${I} name="x" size=${12} />Clear filter</button>`}
                </div>
                <div className="list" style=${{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
                  ${list.length === 0 && html`<${UI.Empty} icon="medical" title="No cases in this region">Click another region or clear the filter.<//>`}
                  ${list.slice(0, 40).map((i) => html`<${CaseRow} key=${i.id} inj=${i} compact=${true} />`)}
                </div>
              </div>
            </div>
          <//>
          <${UI.Card} ai=${true} title="Predictive injury warnings" hint="risk model · explainable factors · no open injury"
            actions=${html`<${UI.AIChip} label=${warnings.length + ' flagged'} />`} flush=${true}>
            ${warnings.length === 0 && html`<${UI.Empty} icon="sparkles" title="No elevated risk in this scope" />`}
            <div className="list">
              ${warnings.map(({ a, r }) => html`<${WarningRow} key=${a.id} a=${a} r=${r} />`)}
            </div>
          <//>
        </div>
        <div className="col loose" style=${{ minWidth: 0 }}>
          <${UI.Card} title="Today's medical inbox" icon="bell" hint=${inbox.length + ' items'} flush=${true}>
            <div className="list">
              ${inbox.length === 0 && html`<${UI.Empty} icon="check" title="Inbox clear" />`}
              ${inbox.map((it) => html`<div key=${it.id} className="list-item clickable" style=${{ cursor: 'pointer', alignItems: 'flex-start' }} onClick=${() => openInjury(it.inj)}>
                <span style=${{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--' + it.tone + '-weak)', color: 'var(--' + it.tone + ')', flex: 'none' }}><${I} name=${it.icon} size=${14} /></span>
                <div className="col tight grow" style=${{ gap: 2, minWidth: 0 }}><span style=${{ fontWeight: 600, fontSize: 13 }}>${it.title}</span><span className="tiny faint">${it.sub}</span></div>
                ${it.action && html`<button className="btn xs primary" onClick=${(e) => { e.stopPropagation(); it.action.run(); }}>${it.action.label}</button>`}
              </div>`)}
            </div>
          <//>
          <${UI.Card} ai=${true} title="AI — medical" hint="detectors run on live data">
            <${UI.InsightList} insights=${insights} max=${4} compact=${false} empty="No medical flags right now" />
          <//>
          <${UI.Card} title=${'My medical tasks'} icon="check" hint=${myTasks.length + ' open'} flush=${true}>
            <div className="list">
              ${myTasks.length === 0 && html`<div className="list-item"><span className="small faint">${full ? 'Nothing assigned to you.' : 'Medical tasks are owned by physio and doctor.'}</span></div>`}
              ${myTasks.slice(0, 6).map((t) => html`<div key=${t.id} className="list-item">
                <${I} name="clipboard" size=${14} />
                <div className="col tight grow" style=${{ gap: 1, minWidth: 0 }}><span className="small ellipsis" style=${{ fontWeight: 600 }}>${t.title}</span><span className="tiny faint">Due ${D.fmt(t.due)}${t.due < AMS.TODAY ? ' · overdue' : ''}</span></div>
                ${t.ref && html`<button className="btn xs" onClick=${() => AMS.openDrawer('injury', { injuryId: t.ref })}>Open</button>`}
              </div>`)}
            </div>
          <//>
        </div>
      </div>
    </div>`;
  }

  function WarningRow({ a, r }) {
    const role = AMS.ui.role;
    const sess = AMS.todaySessionFor(a);
    const modded = sess && sess.mods && sess.mods[a.id];
    const screened = AMS.db.tasks.some((t) => t.status === 'Open' && t.athleteId === a.id && t.kind === 'screen');
    const w = C.todayWellness(a);
    const g = w && w.note && PAIN_RE.test(w.note) ? guessRegion(w.note) : null;
    const canAct = role !== 'ops' && role !== 'nutritionist';
    return html`<div className="list-item" style=${{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <${UI.Ring} value=${r.score} size=${38} tone=${r.band} label="Injury risk" />
      <div className="col tight grow" style=${{ gap: 4, minWidth: 220 }}>
        <div className="row tight wrap"><${UI.AthleteCell} athlete=${a} size=${24} /><${UI.AcwrPill} athlete=${a} /></div>
        <${UI.Evidence} items=${r.factors} />
        ${w && w.note && html`<span className="tiny muted">Check-in ${w.at || ''}: “${w.note}”</span>`}
        ${canAct && html`<div className="row tight wrap">
          <button className="btn xs ai" disabled=${screened} onClick=${() => AMS.runAction('medical.screen', { athleteId: a.id, reason: 'risk ' + r.score + '/100' })}><${I} name=${screened ? 'check' : 'clipboard'} size=${12} />${screened ? 'Screen booked' : 'Screening task'}</button>
          <button className="btn xs" disabled=${!sess || !!modded} title=${!sess ? 'No session today' : modded ? 'Already ' + modded.variant : ''} onClick=${() => AMS.runAction('session.modifyForAthlete', { athleteId: a.id, sessionId: sess.id, variant: 'reduced' })}><${I} name="sliders" size=${12} />${modded ? 'Session ' + modded.variant : 'Modify session'}</button>
          ${g && g.region && ['physio', 'doctor', 'coach'].includes(role) && html`<button className="btn xs" onClick=${() => AMS.runAction('injury.report', { athleteId: a.id, region: g.region, side: g.side })}><${I} name="medical" size=${12} />Report ${regionLabel(g.region, g.side).toLowerCase()}</button>`}
        </div>`}
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------------ caseload board */
  function Caseload({ injuries, v }) {
    const full = isMed();
    const role = AMS.ui.role;
    const [q, setQ] = useState('');
    const [only, setOnly] = useState('all');
    const open = injuries.filter(isOpen);
    const match = (i) => {
      const a = ath(i.athleteId);
      if (q && !(a.name + ' ' + whereText(i)).toLowerCase().includes(q.toLowerCase())) return false;
      if (only === 'overdue' && !(isOverdue(i) || returnLate(i))) return false;
      if (only === 'mine' && !(full && AMS.me() && (i.physioId === AMS.me().id || i.doctorId === AMS.me().id))) return false;
      return true;
    };
    const closed30 = injuries.filter((i) => i.status === 'Closed' && i.closedOn && D.diff(AMS.TODAY, i.closedOn) <= 30);
    const med = open.filter((i) => i.status !== 'Monitoring');
    const avgDays = med.length ? Math.round(AMS.mean(med.map(daysSince))) : 0;
    return html`<div className="col loose">
      <div className="row between wrap" style=${{ gap: 10 }}>
        <div className="row tight wrap">
          <${UI.Search} value=${q} onChange=${setQ} placeholder="Search athlete or region" />
          <${UI.Seg} size="sm" value=${only} onChange=${setOnly} options=${[{ id: 'all', label: 'All' }, { id: 'overdue', label: 'Overdue' }].concat(full ? [{ id: 'mine', label: 'Mine' }] : [])} />
        </div>
        <span className="small muted">${open.length} open · avg ${avgDays} d since injury · ${closed30.length} closed in 30 d · ${open.filter((i) => isOverdue(i) || returnLate(i)).length} overdue</span>
      </div>
      <div className="med-board">
        ${BOARD.map((col) => {
          const cards = open.filter((i) => i.status === col.id && match(i)).sort((a, b) => (isOverdue(b) - isOverdue(a)) || a.dateOfInjury.localeCompare(b.dateOfInjury));
          return html`<div key=${col.id} className="med-col">
            <div className="med-col-h"><span className="row tight"><${I} name=${col.icon} size=${14} />${col.label}<span className="tiny faint" style=${{ fontWeight: 400 }}>${col.hint}</span></span><${UI.Pill} tone=${cards.length ? STATUS_TONE[col.id] : ''}>${cards.length}<//></div>
            <div className="med-col-b">
              ${cards.length === 0 && html`<div className="tiny faint" style=${{ padding: 8, textAlign: 'center' }}>No cases</div>`}
              ${cards.map((i) => html`<${BoardCard} key=${i.id} inj=${i} full=${full} role=${role} />`)}
            </div>
          </div>`;
        })}
      </div>
      <div className="small faint">Flow: Reported → Assessment (physio) → Rehab stages (physio sign-off each) → Clearance (team doctor only) → Closed with a graded return. Light-path flags sit in Monitoring and can be escalated or resolved.</div>
    </div>`;
  }

  function BoardCard({ inj, full, role }) {
    const a = ath(inj.athleteId);
    const st = stageOf(inj);
    const over = isOverdue(inj), late = returnLate(inj);
    const met = st ? st.criteria.filter((c) => c.met).length : 0;
    const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
    let actions = null;
    if (full) {
      if (inj.status === 'Reported') actions = html`<button className="btn xs primary" onClick=${stop(() => AMS.runAction('injury.startAssessment', { injuryId: inj.id }))}>Start assessment<${I} name="arrow-r" size=${12} /></button>`;
      else if (inj.status === 'Assessment') actions = html`<button className="btn xs primary" onClick=${stop(() => openInjury(inj, 'case'))}>Record assessment<${I} name="arrow-r" size=${12} /></button>`;
      else if (inj.status === 'Rehab') actions = html`<button className="btn xs" onClick=${stop(() => openInjury(inj, 'rtp'))}>${met === (st ? st.criteria.length : 0) ? 'Sign off stage' : 'Criteria ' + met + '/' + (st ? st.criteria.length : 0)}<${I} name="arrow-r" size=${12} /></button>`;
      else if (inj.status === 'Clearance') actions = role === 'doctor' ? html`<button className="btn xs primary" onClick=${stop(() => openInjury(inj, 'rtp'))}>Review & clear<${I} name="shield-check" size=${12} /></button>` : html`<span className="tiny faint">Awaiting ${staffName(inj.doctorId)}</span>`;
      else if (inj.status === 'Monitoring') actions = html`<${Frag}><button className="btn xs" onClick=${stop(() => AMS.runAction('injury.escalateLight', { injuryId: inj.id }))}>Escalate to case</button><button className="btn xs ghost" onClick=${stop(() => AMS.runAction('injury.resolveLight', { injuryId: inj.id }))}>Resolve</button><//>`;
    }
    return html`<div className=${AMS.cx('med-card', (over || late) && 'overdue')} onClick=${() => openInjury(inj)} role="button" tabIndex=${0} onKeyDown=${(e) => { if (e.key === 'Enter') openInjury(inj); }}>
      <div className="row between" style=${{ gap: 6, minWidth: 0 }}>
        <span className="row tight" style=${{ minWidth: 0 }}><${UI.Avatar} name=${a.name} size=${24} /><span className="ellipsis" style=${{ fontWeight: 600, fontSize: 12.5 }}>${a.name}</span></span>
        <${UI.AvailabilityPill} value=${a.availability} />
      </div>
      <div className="row tight wrap"><span className="dot" style=${{ background: sevColor(inj.severity), width: 8, height: 8 }} /><span className="small">${whereText(inj)}</span></div>
      <div className="tiny faint">${AMS.org.squad(a.squadId) ? AMS.org.squad(a.squadId).name : ''} · day ${daysSince(inj)}${inj.status === 'Reported' ? ' · reported ' + agoText(reportedAt(inj)) : ''}</div>
      ${inj.status === 'Rehab' && st && html`<div className="col tight" style=${{ gap: 3 }}>
        <div className="row between tiny"><span>Stage ${inj.rtpStage + 1}/${inj.rtpStages.length} · ${st.name}</span><span className=${over ? 'bad' : 'faint'}>${daysInStage(inj)}/${inj.stageTargetDays || st.targetDays} d</span></div>
        <${UI.Meter} value=${inj.rtpStage + 1} max=${inj.rtpStages.length} tone=${over ? 'bad' : 'accent'} />
      </div>`}
      <div className="row tight wrap">
        ${inj.expectedReturn && html`<span className=${AMS.cx('tiny', late ? 'bad' : 'muted')}>Back ${D.fmt(inj.expectedReturn)}${late ? ' (passed)' : ''}</span>`}
        ${over && html`<${UI.Pill} tone="bad">Stage overdue<//>`}
        ${(inj.setbacks || 0) > 0 && html`<${UI.Pill} tone="warn">${inj.setbacks} setback${inj.setbacks > 1 ? 's' : ''}<//>`}
        ${inj.decision && inj.decision.status === 'Pending' && html`<${UI.Pill} tone="ai">Doctor decision<//>`}
      </div>
      ${actions && html`<div className="row tight wrap">${actions}</div>`}
    </div>`;
  }

  /* ------------------------------------------------------------------ wellness monitoring */
  function Wellness({ athletes, v }) {
    const role = AMS.ui.role;
    const full = isMed();
    const [squad, setSquad] = useState('');
    const [mode, setMode] = useState('flagged');
    const [q, setQ] = useState('');
    const squads = [...new Set(athletes.map((a) => a.squadId))].map((id) => AMS.org.squad(id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
    const rows = useMemo(() => athletes.map((a) => {
      const base = C.wellnessBaseline(a);
      const recent = C.wellnessAvg(a, 25, 28);
      const notes = (a.wellness || []).slice(24, 28).map((w, k) => (w && w.note && PAIN_RE.test(w.note) ? { note: w.note, date: AMS.series.wellDate(24 + k) } : null)).filter(Boolean);
      const drop = base && recent ? Math.round(recent - base) : 0;
      const openInj = AMS.db.injuries.find((i) => i.athleteId === a.id && isOpen(i));
      return { a, base, recent, drop, notes, openInj, flagged: drop <= -10 || notes.length > 0 };
    }), [v, athletes.length]);
    const shown = rows.filter((r) => (!squad || r.a.squadId === squad) && (mode === 'all' || r.flagged) && (!q || r.a.name.toLowerCase().includes(q.toLowerCase())))
      .sort((x, y) => x.drop - y.drop).slice(0, 40);
    const cols = Array.from({ length: 14 }, (_, k) => { const iso = AMS.series.wellDate(14 + k); return k === 13 ? 'Today' : D.dow(iso).slice(0, 1) + iso.slice(8); });
    const grid = shown.map((r) => ({
      label: r.a.name + (r.openInj ? ' ●' : ''),
      onClick: () => AMS.openAthlete(r.a.id, 'medical'),
      cells: Array.from({ length: 14 }, (_, k) => {
        const w = (r.a.wellness || [])[14 + k];
        if (!w) return { label: '·', title: AMS.series.wellDate(14 + k) + ': no check-in' };
        const s = C.wellnessScore(w);
        const d = r.base ? s - r.base : 0;
        return { label: s, tone: d <= -12 ? 'bad' : d <= -5 ? 'warn' : 'good', title: D.fmt(AMS.series.wellDate(14 + k)) + ': ' + s + ' (own normal ' + Math.round(r.base || 0) + ')' + (w.note ? ' — “' + w.note + '”' : '') };
      }),
    }));
    const flags = rows.filter((r) => r.flagged && (!squad || r.a.squadId === squad)).sort((x, y) => (y.notes.length - x.notes.length) || (x.drop - y.drop)).slice(0, 10);
    const checkedIn = athletes.filter((a) => C.todayWellness(a)).length;
    return html`<div className="col loose">
      <div className="grid g4">
        <${UI.KPI} label="Checked in today" icon="pulse" value=${checkedIn} unit=${'/' + athletes.length} foot=${C.checkinRate(athletes) + '% check-in rate'} />
        <${UI.KPI} label="Below own normal" icon="trend-down" value=${rows.filter((r) => r.drop <= -10).length} tone="warn" foot="3-day avg ≥10 pts under 3-week baseline" onClick=${() => setMode('flagged')} />
        <${UI.KPI} label="Pain / tightness notes" icon="message" value=${rows.filter((r) => r.notes.length).length} tone="bad" foot="last 4 days of check-ins" />
        <${UI.KPI} label="Flagged without a case" icon="flag" value=${rows.filter((r) => r.flagged && !r.openInj).length} foot="candidates for the light path" />
      </div>
      <div className="grid g-main">
        <${UI.Card} title="Wellness — last 14 days vs own normal" icon="grid" hint=${shown.length + ' athletes'}
          actions=${html`<div className="row tight wrap">
            <${UI.Select} value=${squad} onChange=${setSquad} placeholder="All squads" options=${squads.map((s) => ({ value: s.id, label: s.name }))} />
            <${UI.Seg} size="sm" value=${mode} onChange=${setMode} options=${[{ id: 'flagged', label: 'Flagged' }, { id: 'all', label: 'All' }]} />
          </div>`}>
          <div className="col tight">
            <${UI.Search} value=${q} onChange=${setQ} placeholder="Filter athletes" />
            ${grid.length === 0 ? html`<${UI.Empty} icon="check" title="No wellness flags in this view" />` : html`<${UI.HeatGrid} rows=${grid} cols=${cols} cellW=${28} labelW=${160} />`}
            <div className="legend tiny"><span><i style=${{ background: 'var(--good)' }} />At/above own normal</span><span><i style=${{ background: 'var(--warn)' }} />5–12 pts below</span><span><i style=${{ background: 'var(--bad)' }} />>12 pts below</span><span>● open injury</span><span>Score = sleep, soreness, mood, stress, energy (0–100)</span></div>
          </div>
        <//>
        <${UI.Card} ai=${true} title="Flags to act on" hint="compared with each athlete's own 3-week normal" flush=${true}>
          <div className="list">
            ${flags.length === 0 && html`<${UI.Empty} icon="check" title="No flags" />`}
            ${flags.map((r) => {
              const n = r.notes[r.notes.length - 1];
              const g = n ? guessRegion(n.note) : { region: null };
              return html`<div key=${r.a.id} className="list-item" style=${{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div className="col tight grow" style=${{ gap: 4, minWidth: 200 }}>
                  <${UI.AthleteCell} athlete=${r.a} size=${26} />
                  <${UI.Evidence} items=${[{ label: '3-day', value: Math.round(r.recent || 0), tone: r.drop <= -10 ? 'bad' : 'warn' }, { label: 'Own normal', value: Math.round(r.base || 0), tone: 'good' }, { label: 'Δ', value: (r.drop > 0 ? '+' : '') + r.drop + ' pts', tone: r.drop <= -10 ? 'bad' : 'info' }, { label: 'ACWR', value: C.acwr(r.a).toFixed(2), tone: C.acwrBand(C.acwr(r.a)) }]} />
                  ${n && html`<span className="tiny muted">${D.fmt(n.date)}: “${n.note}”</span>`}
                  ${r.openInj ? html`<span className="tiny"><${UI.Pill} tone=${STATUS_TONE[r.openInj.status]}>${r.openInj.status}<//> <a className="clickable" style=${{ cursor: 'pointer', color: 'var(--accent)' }} onClick=${() => openInjury(r.openInj)}>${whereText(r.openInj)}</a></span>` : role !== 'ops' && html`<div className="row tight wrap">
                    ${g.region && html`<button className="btn xs ai" onClick=${() => AMS.runAction('injury.flagLight', { athleteId: r.a.id, region: g.region, side: g.side, note: n.note })}><${I} name="flag" size=${12} />Light-path flag: ${regionLabel(g.region, g.side).toLowerCase()}</button>`}
                    <button className="btn xs" onClick=${() => AMS.runAction('medical.screen', { athleteId: r.a.id, reason: 'wellness ' + r.drop + ' pts vs normal' })}>Ask physio to screen</button>
                    <button className="btn xs ghost" onClick=${() => AMS.runAction('injury.report', { athleteId: r.a.id, region: g.region, side: g.side })}>Report…</button>
                  </div>`}
                </div>
              </div>`;
            })}
          </div>
        <//>
      </div>
      ${!full && html`<div className="small faint">Light-path flags record a niggle for the physio to watch without opening a rehab case or changing availability.</div>`}
    </div>`;
  }

  /* ------------------------------------------------------------------ analytics */
  function Analytics({ athletes, injuries, v }) {
    const [period, setPeriod] = useState('365');
    const [drill, setDrill] = useState(null); // { label, test }
    const [view, setView] = useState('front');
    const days = +period;
    const pool = useMemo(() => injuries.filter((i) => D.diff(AMS.TODAY, i.dateOfInjury) <= days), [v, days, athletes.length]);
    const data = useMemo(() => {
      const byRegion = AMS.groupBy(pool, 'region');
      const heat = {}; pool.forEach((i) => { const key = i.region + ':' + (CENTER.has(i.region) ? 'C' : i.side); heat[key] = (heat[key] || 0) + 1; });
      const byType = AMS.groupBy(pool, (i) => i.type || 'Other');
      const byCtx = AMS.groupBy(pool, (i) => i.context || 'Training');
      const months = lastMonths(12);
      const trend = months.map((m) => {
        const inM = injuries.filter((i) => monthKey(i.dateOfInjury) === m);
        return { key: m, label: monthLabel(m), values: [inM.filter((i) => (i.context || 'Training') !== 'Competition').length, inM.filter((i) => i.context === 'Competition').length], lost: AMS.sum(injuries.map((i) => daysLostInMonth(i, m))) };
      });
      const re = pool.filter((i) => isReinjury(i, injuries));
      const lostTotal = AMS.sum(pool.filter((i) => i.daysLost != null).map((i) => i.daysLost)) + AMS.sum(pool.filter((i) => isOpen(i) && i.path === 'case').map(daysSince));
      return { byRegion, heat, byType, byCtx, trend, re, lostTotal };
    }, [v, days, athletes.length]);
    const set = (label, test) => setDrill({ label, test });
    const regionBars = Object.entries(data.byRegion).sort((a, b) => b[1].length - a[1].length).slice(0, 10).map(([r, l]) => ({ label: REGION_NAMES[r] || r, value: l.length, sub: Math.round(AMS.mean(l.map((i) => i.daysLost || daysSince(i)))) + ' d avg', tone: 'bad', onClick: () => set('Region: ' + (REGION_NAMES[r] || r), (i) => i.region === r) }));
    const typeData = Object.entries(data.byType).sort((a, b) => b[1].length - a[1].length).map(([t, l], k) => ({ label: t, value: l.length, tone: UI.CAT[k % 6] }));
    const ctxBars = ['Training', 'Competition'].map((c) => { const l = data.byCtx[c] || []; return { label: c, value: l.length, sub: AMS.round(pool.length ? (l.length / pool.length) * 100 : 0, 0) + '%', tone: c === 'Competition' ? 'cat-2' : 'cat-1', onClick: () => set('Context: ' + c, (i) => (i.context || 'Training') === c) }; });
    const drillRows = drill ? pool.filter(drill.test) : [];
    const columns = [
      { key: 'athlete', label: 'Athlete', render: (i) => html`<${UI.AthleteCell} athlete=${ath(i.athleteId)} size=${24} />`, sort: (i) => ath(i.athleteId).name },
      { key: 'where', label: isMed() ? 'Injury' : 'Body zone', render: (i) => whereText(i), sort: (i) => i.region },
      { key: 'type', label: 'Type', render: (i) => (isMed() ? i.type : '—'), hideSm: true },
      { key: 'date', label: 'Date', render: (i) => D.fmt(i.dateOfInjury), sort: (i) => i.dateOfInjury },
      { key: 'ctx', label: 'Context', render: (i) => i.context || 'Training', hideSm: true },
      { key: 'status', label: 'Status', render: (i) => html`<${StatusPill} inj=${i} />`, sort: (i) => i.status },
      { key: 'lost', label: 'Days lost', num: true, render: (i) => (i.daysLost != null ? i.daysLost : isOpen(i) ? daysSince(i) + '+' : '—'), sort: (i) => (i.daysLost != null ? i.daysLost : daysSince(i)) },
    ];
    return html`<div className="col loose">
      <div className="row between wrap">
        <${UI.Seg} value=${period} onChange=${(p) => { setPeriod(p); setDrill(null); }} options=${[{ id: '90', label: '90 days' }, { id: '182', label: '6 months' }, { id: '365', label: '12 months' }]} />
        <span className="small muted">${AMS.scopeLabel()} · ${athletes.length} active athletes · click any bar, slice or region to drill down</span>
      </div>
      <div className="grid g4">
        <${UI.KPI} label="Injuries" icon="medical" value=${pool.length} foot=${pool.filter(isOpen).length + ' still open'} onClick=${() => set('All injuries', () => true)} />
        <${UI.KPI} label="Days lost" icon="calendar" value=${data.lostTotal.toLocaleString('en-IN')} unit="d" foot=${pool.length ? AMS.round(data.lostTotal / pool.length, 1) + ' d per injury' : '—'} />
        <${UI.KPI} label="Competition share" icon="target" value=${pool.length ? Math.round(((data.byCtx.Competition || []).length / pool.length) * 100) : 0} unit="%" foot=${(data.byCtx.Competition || []).length + ' in competition'} onClick=${() => set('Context: Competition', (i) => i.context === 'Competition')} />
        <${UI.KPI} label="Re-injuries after return" icon="refresh" value=${data.re.length} tone=${data.re.length ? 'warn' : 'good'} foot=${pool.length ? Math.round((data.re.length / pool.length) * 100) + '% of injuries' : '—'} onClick=${() => set('Re-injuries', (i) => isReinjury(i, injuries))} />
      </div>
      <div className="grid g2">
        <${UI.Card} title="By body region" icon="medical" hint="heat = count; click to drill">
          <div className="med-split" style=${{ gridTemplateColumns: 'minmax(0,220px) minmax(0,1fr)' }}>
            <${BodyMap} layer="heat" heat=${data.heat} compact=${true} height=${300} view=${view} onViewChange=${setView} showLegend=${false}
              onSelect=${(region, side) => set(regionLabel(region, CENTER.has(region) ? 'C' : side), (i) => i.region === region && (CENTER.has(region) || i.side === side || i.side === 'C'))} />
            <${UI.HBars} data=${regionBars} labelWidth=${96} />
          </div>
        <//>
        <${UI.Card} title="By type & context" icon="layers">
          <div className="row wrap" style=${{ gap: 18, alignItems: 'flex-start' }}>
            <${UI.Donut} data=${typeData} size=${150} thickness=${18} center=${html`<div><div className="num" style=${{ fontSize: 22, fontWeight: 600 }}>${pool.length}</div><div className="tiny faint">injuries</div></div>`} onSlice=${(d) => set('Type: ' + d.label, (i) => (i.type || 'Other') === d.label)} />
            <div className="col tight grow" style=${{ minWidth: 160 }}>
              ${typeData.slice(0, 7).map((d) => html`<div key=${d.label} className="row between small clickable" style=${{ cursor: 'pointer' }} onClick=${() => set('Type: ' + d.label, (i) => (i.type || 'Other') === d.label)}><span className="row tight"><span className="dot" style=${{ background: UI.color(d.tone) }} />${d.label}</span><b className="tnum">${d.value}</b></div>`)}
              <div className="divider" />
              <${UI.HBars} data=${ctxBars} labelWidth=${86} />
            </div>
          </div>
        <//>
      </div>
      <div className="grid g2">
        <${UI.Card} title="Monthly trend — new injuries" icon="trend-up" hint="training vs competition">
          <${UI.BarChart} data=${data.trend} keys=${[{ name: 'Training', tone: 'cat-1' }, { name: 'Competition', tone: 'cat-2' }]} stacked=${true} height=${200} onBar=${(d) => set('Month: ' + d.label, (i) => monthKey(i.dateOfInjury) === d.key)} />
        <//>
        <${UI.Card} title="Days lost per month" icon="calendar" hint="case path only">
          <${UI.BarChart} data=${data.trend.map((t) => ({ label: t.label, value: t.lost, key: t.key }))} tone="bad" height=${200} onBar=${(d) => set('Month: ' + d.label, (i) => monthKey(i.dateOfInjury) === d.key || (i.closedOn && monthKey(i.closedOn) === d.key))} />
        <//>
      </div>
      <${UI.Card} title=${drill ? drill.label : 'Re-injury after return'} icon=${drill ? 'filter' : 'refresh'} hint=${(drill ? drillRows.length : data.re.length) + ' cases'}
        actions=${drill && html`<button className="btn xs ghost" onClick=${() => setDrill(null)}><${I} name="x" size=${12} />Clear drill-down</button>`} flush=${true}>
        <${UI.Table} columns=${columns} rows=${drill ? drillRows : data.re} onRow=${(i) => openInjury(i)} compact=${true} maxHeight=${360} initialSort=${{ key: 'date', dir: 'desc' }} empty="No cases" />
      <//>
    </div>`;
  }

  /* ================================================================== injury report modal */
  function InjuryReportModal(props) {
    const { db } = AMS.useStore();
    const role = AMS.ui.role;
    const full = isMed();
    const [athleteId, setAthleteId] = useState(props.athleteId || '');
    const [region, setRegion] = useState(props.region || null);
    const [side, setSide] = useState(props.region ? (CENTER.has(props.region) ? 'C' : props.side || 'C') : null);
    const [view, setView] = useState(props.region ? viewFor(props.region) : 'front');
    const [type, setType] = useState(props.type || 'Muscle strain');
    const [severity, setSeverity] = useState('minor');
    const [grade, setGrade] = useState('');
    const [mechanism, setMechanism] = useState('');
    const [context, setContext] = useState('Training');
    const [pain, setPain] = useState(3);
    const [onset, setOnset] = useState(AMS.TODAY);
    const [path, setPath] = useState(null);
    const [avail, setAvail] = useState('');
    const [note, setNote] = useState('');
    if (role === 'ops') return html`<${UI.ModalFrame} title="Report an injury" icon="lock"><${PrivacyNote} text="Operations staff cannot record or view medical information." /><//>`;
    const scoped = AMS.scopedAthletes().slice().sort((x, y) => x.name.localeCompare(y.name));
    const a = athleteId ? ath(athleteId) : null;
    const opts = scoped.map((x) => ({ value: x.id, label: x.name + ' — ' + (AMS.org.squad(x.squadId) ? AMS.org.squad(x.squadId).name : x.sport) }));
    if (a && !scoped.some((x) => x.id === a.id)) opts.unshift({ value: a.id, label: a.name });
    const w = a ? C.todayWellness(a) : null;
    const hint = w && w.note && PAIN_RE.test(w.note) ? guessRegion(w.note) : null;
    const prior = a && region ? priorSameRegion(a.id, region).sort((x, y) => y.dateOfInjury.localeCompare(x.dateOfInjury)) : [];
    const sim = region ? similarCases(region, type) : null;
    const tpl = region ? AMS.rtpTemplateFor(region, type) : null;
    const ai = region ? aiPathFor({ severity, pain, type, region }, prior) : null;
    const effPath = path || (ai ? ai.path : 'case');
    const ac = a ? C.acwr(a) : null, rd = a ? C.readiness(a) : null;
    const marks = a ? marksFor(db.injuries.filter((i) => i.athleteId === a.id)) : [];
    const pick = (r, s) => { setRegion(r); setSide(CENTER.has(r) ? 'C' : s); };
    const useHint = () => { if (!hint || !hint.region) return; setRegion(hint.region); setSide(hint.side); setView(viewFor(hint.region)); if (!mechanism) setMechanism(w.note); if (/tight/i.test(w.note)) setType('Tightness / niggle'); };
    const can = !!(a && region);
    const submit = () => {
      const id = AMS.runAction('injury.submit', { athleteId, region, side, view, type, severity, grade: grade ? +grade : null, mechanism, context, pain, dateOfInjury: onset, path: effPath, availability: avail || null, note: note.trim(), aiSuggested: ai ? { path: ai.path, accepted: effPath === ai.path, confidence: ai.confidence } : null });
      if (id) AMS.closeModal();
    };
    const footer = html`<${Frag}>
      <span className="tiny faint grow">${effPath === 'light' ? 'Creates a Monitoring flag for the physio; no rehab case.' : 'Creates a Reported case; physio is notified and a task is created.'} Availability changes only if you set it.</span>
      <button className="btn" onClick=${AMS.closeModal}>Cancel</button>
      <button className="btn primary" disabled=${!can} title=${!a ? 'Pick an athlete' : !region ? 'Pick a body region' : ''} onClick=${submit}><${I} name="send" size=${14} />${effPath === 'light' ? 'Open light-path flag' : 'Submit injury report'}</button>
    <//>`;
    return html`<${UI.ModalFrame} wide=${true} icon="medical" title="Report an injury" sub=${'Tap the injured area. ' + (full ? 'You can open a rehab case or flag & monitor.' : 'The physio is notified immediately and owns the next step.')} footer=${footer}>
      <div className="col loose">
        <div className="grid g2">
          <${UI.Field} label="Athlete"><${UI.Select} value=${athleteId} onChange=${(x) => { setAthleteId(x); setRegion(null); setSide(null); }} placeholder="Select athlete in your scope…" options=${opts} /><//>
          <${UI.Field} label="Onset date"><input className="input" type="date" value=${onset} max=${AMS.TODAY} onChange=${(e) => setOnset(e.target.value || AMS.TODAY)} /><//>
        </div>
        ${hint && hint.region && html`<div className="ai-box row between wrap" style=${{ gap: 8 }}>
          <span className="small"><${UI.AIChip} label="From today's check-in" /> ${w.at || ''} “${w.note}” → ${regionLabel(hint.region, hint.side)}</span>
          <button className="btn xs ai" onClick=${useHint}>Use this</button>
        </div>`}
        <div className="med-split" style=${{ gridTemplateColumns: 'minmax(0,260px) minmax(0,1fr)' }}>
          <div className="col tight" style=${{ alignItems: 'center' }}>
            <${BodyMap} view=${view} onViewChange=${setView} marks=${marks} selected=${region ? { region, side } : null} onSelect=${pick} height=${440} showLegend=${false} />
            <span className="tiny faint">Hatched = past injuries. Athlete's left/right shown on the figure.</span>
          </div>
          <div className="col" style=${{ minWidth: 0 }}>
            <div className="card" style=${{ padding: 12 }}>
              <div className="row between wrap" style=${{ gap: 8 }}>
                <div className="col tight" style=${{ gap: 2 }}><span className="upper">Region</span><b>${region ? regionLabel(region, side) : 'Not selected — tap the body map'}</b></div>
                ${region && !CENTER.has(region) && html`<${UI.Seg} size="sm" value=${side} onChange=${setSide} options=${[{ id: 'L', label: 'Left' }, { id: 'R', label: 'Right' }, { id: 'C', label: 'Both' }]} />`}
              </div>
            </div>
            <div className="grid g2">
              <${UI.Field} label="Injury type"><${UI.Select} value=${type} onChange=${setType} options=${TYPES} /><//>
              <${UI.Field} label="Context"><${UI.Seg} size="sm" value=${context} onChange=${setContext} options=${['Training', 'Competition', 'Other']} /><//>
              <${UI.Field} label="Severity"><${UI.Seg} size="sm" value=${severity} onChange=${setSeverity} options=${[{ id: 'minor', label: 'Minor' }, { id: 'moderate', label: 'Moderate' }, { id: 'severe', label: 'Severe' }]} /><//>
              <${UI.Field} label="Grade" help=${full ? '' : 'Physio confirms grade at assessment'}><${UI.Seg} size="sm" value=${grade} onChange=${setGrade} options=${[{ id: '', label: 'Unknown' }, { id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }]} /><//>
            </div>
            <${UI.Field} label="Mechanism">
              <input className="input" value=${mechanism} onChange=${(e) => setMechanism(e.target.value)} placeholder="e.g. felt a pull at 50 m of a flying 30" />
              <div className="row tight wrap" style=${{ marginTop: 6 }}>${MECHS.map((m) => html`<button key=${m} className=${AMS.cx('med-chip', mechanism === m && 'on')} onClick=${() => setMechanism(m)}>${m}</button>`)}</div>
            <//>
            <${UI.Field} label=${'Pain now: ' + pain + '/10'}>
              <input className="med-range" type="range" min="0" max="10" step="1" value=${pain} onChange=${(e) => setPain(+e.target.value)} />
              <div className="row between tiny faint"><span>0 none</span><span>5 moderate</span><span>10 worst</span></div>
            <//>
            <${UI.Field} label="Next step">
              <div className="grid g2">
                <button className=${AMS.cx('med-choice', effPath === 'light' && 'on')} onClick=${() => setPath('light')}><b className="row tight"><${I} name="eye" size=${14} />Light path — flag & monitor</b><span className="tiny muted">Niggle or soreness. Physio watches it for 72 h; no rehab case, availability unchanged.</span>${ai && ai.path === 'light' && html`<span><${UI.AIChip} label="AI suggests" /></span>`}</button>
                <button className=${AMS.cx('med-choice', effPath === 'case' && 'on')} onClick=${() => setPath('case')}><b className="row tight"><${I} name="clipboard" size=${14} />Open rehab case</b><span className="tiny muted">Physio assessment, staged return-to-play, doctor clearance.</span>${ai && ai.path === 'case' && html`<span><${UI.AIChip} label="AI suggests" /></span>`}</button>
              </div>
            <//>
            <${UI.Field} label="Availability (your decision — AI never sets this)">
              <${UI.Seg} size="sm" value=${avail} onChange=${setAvail} options=${[{ id: '', label: 'No change' + (a ? ' (' + a.availability + ')' : '') }, { id: 'Modified', label: 'Modified' }, { id: 'Unavailable', label: 'Unavailable' }]} />
            <//>
            <${UI.Field} label="Notes (optional)"><textarea className="textarea" rows="2" value=${note} onChange=${(e) => setNote(e.target.value)} placeholder=${full ? 'Clinical observations' : 'What you saw — the physio will assess'} /><//>
          </div>
        </div>
        <div className="ai-box col tight">
          <div className="row between wrap"><span className="row tight" style=${{ fontWeight: 600 }}><${I} name="sparkles" size=${15} style=${{ color: 'var(--ai)' }} />AI assist</span>${ai && html`<span className="tiny faint">${Math.round(ai.confidence * 100)}% confidence · suggestion only</span>`}</div>
          ${!region || !a ? html`<span className="small muted">Pick an athlete and a body region to see the suggested pathway, expected time out from similar cases and re-injury warnings.</span>` : html`<div className="grid g2" style=${{ gap: 10 }}>
            <div className="col tight">
              <span className="small"><b>Pathway:</b> ${ai.path === 'light' ? 'Light path' : 'Rehab case'} — ${ai.rationale}</span>
              ${effPath !== ai.path && html`<span className="tiny warn">You chose differently from the suggestion — that's fine, it is logged with the report.</span>`}
              <span className="small"><b>RTP template:</b> ${tpl} · ${AMS.RTP_TEMPLATES[tpl].map((s) => s.name).join(' → ')}</span>
            </div>
            <div className="col tight">
              <span className="small"><b>Expected days out:</b> ${sim.n ? html`median <b>${sim.median} d</b> (IQR ${sim.p25}–${sim.p75}) from n=${sim.n} closed ${REGION_NAMES[region].toLowerCase()} cases (${sim.basis}) → back around <b>${D.fmt(D.add(onset, sim.median))}</b>` : 'no similar closed cases in the federation yet'}</span>
              ${prior.length > 0 ? html`<span className="small bad"><${I} name="alert" size=${13} /> Re-injury warning: ${prior.length} previous ${REGION_NAMES[region].toLowerCase()} injur${prior.length === 1 ? 'y' : 'ies'} (${prior.map((p) => (full ? p.regionLabel + ' ' : '') + D.fmt(p.dateOfInjury) + (p.status !== 'Closed' ? ' — still open' : '')).join('; ')}).</span>` : html`<span className="small muted">No previous injury in this region.</span>`}
              <${UI.Evidence} items=${[{ label: 'ACWR', value: ac.toFixed(2), tone: C.acwrBand(ac) }, { label: 'Readiness', value: rd.score + ' ' + C.bandLabel(rd.band), tone: rd.band }, { label: 'Risk', value: C.risk(a).score + '/100', tone: C.risk(a).band }].concat(w ? [{ label: 'Soreness', value: w.soreness + '/5', tone: w.soreness <= 2 ? 'bad' : 'good' }] : [])} />
            </div>
          </div>`}
        </div>
      </div>
    <//>`;
  }

  /* ================================================================== injury case drawer */
  const TL = { report: ['flag', 'bad'], assessment: ['clipboard', 'warn'], stage: ['check', 'good'], setback: ['arrow-down', 'bad'], note: ['edit', 'info'], clearance: ['shield-check', 'good'], decision: ['scale', 'ai'] };
  function InjuryDrawer({ injuryId, tab }) {
    const { db, v } = AMS.useStore();
    const role = AMS.ui.role;
    const [t, setT] = useState(tab || 'case');
    useEffect(() => { if (tab) setT(tab); }, [tab, injuryId]);
    const inj = AMS.byId(db.injuries, injuryId);
    if (!inj) return html`<${Frag}><${UI.DrawerHead} title="Injury case" /><div className="drawer-b"><${UI.Empty} icon="medical" title="Case not found" /></div><//>`;
    const a = ath(inj.athleteId);
    AMS.setFocus({ athleteId: a.id, injuryId: inj.id });
    if (role === 'ops') return html`<${Frag}><${UI.DrawerHead} title="Medical record" sub=${a.name} /><div className="drawer-b"><${PrivacyNote} text="Operations staff have no access to medical records. Ask the centre physio for availability information." /></div><//>`;
    const own = role === 'athlete' && AMS.me() && AMS.me().id === a.id;
    const full = isMed();
    if (!full && !own) return html`<${SummaryDrawer} inj=${inj} a=${a} />`;
    const st = stageOf(inj);
    const tabs = [
      { id: 'case', label: 'Case & assessment', icon: 'clipboard' },
      { id: 'rtp', label: 'Return to play', icon: 'run', count: inj.path === 'case' && inj.status !== 'Closed' ? inj.rtpStage + 1 + '/' + inj.rtpStages.length : null },
      { id: 'timeline', label: 'Timeline', icon: 'clock', count: inj.timeline.length },
      { id: 'notes', label: 'Medical notes', icon: 'lock', count: inj.notes.length || null },
      { id: 'pain', label: 'Pain & wellness', icon: 'pulse' },
    ];
    const cur = tabs.some((x) => x.id === t) ? t : 'case';
    const others = db.injuries.filter((i) => i.athleteId === a.id);
    return html`<${Frag}>
      <${UI.DrawerHead} avatar=${html`<${UI.Avatar} name=${a.name} size=${44} />`} title=${a.name + ' — ' + inj.regionLabel}
        sub=${html`<span><span className="mono">${inj.id}</span> · ${inj.diagnosis}</span>`}
        actions=${html`<button className="btn sm ghost hide-sm" onClick=${() => AMS.openAthlete(a.id, 'medical')}><${I} name="user" size=${14} />Profile</button>`}>
        <div className="row wrap tight" style=${{ marginTop: 4 }}>
          <${StatusPill} inj=${inj} />
          <${UI.AvailabilityPill} value=${a.availability} />
          <${UI.Pill} tone=${sevTone(inj.severity)}>${inj.severity}${inj.grade ? ' · grade ' + inj.grade : ''}<//>
          <span className="tiny muted">Day ${daysSince(inj)} · ${inj.context || 'Training'} · ${AMS.org.squad(a.squadId) ? AMS.org.squad(a.squadId).name : ''}</span>
          ${(inj.setbacks || 0) > 0 && html`<${UI.Pill} tone="warn">${inj.setbacks} setback${inj.setbacks > 1 ? 's' : ''}<//>`}
        </div>
      <//>
      <div className="drawer-b">
        <div className="med-head">
          <${BodyMap} compact=${true} height=${230} showToggle=${false} showLegend=${false} view=${inj.view || viewFor(inj.region)} marks=${marksFor(others)} selected=${{ region: inj.region, side: inj.side }} />
          <div className="col" style=${{ minWidth: 0 }}>
            <${UI.DL} cols=${3} items=${[
              ['Reported', D.fmt(reportedAt(inj).slice(0, 10)) + ' ' + reportedAt(inj).slice(11, 16) + ' · ' + inj.reportedBy],
              ['Physio', staffName(inj.physioId)], ['Doctor', staffName(inj.doctorId)],
              ['Mechanism', inj.mechanism || '—'], ['Expected return', inj.expectedReturn ? D.fmt(inj.expectedReturn) + (returnLate(inj) ? ' (passed)' : '') : '—'],
              ['Allowed training', allowedTraining(inj)],
            ]} />
            ${inj.path === 'case' && html`<${UI.Stepper} steps=${inj.rtpStages.map((s, k) => ({ label: s.name, sub: s.signedAt ? '✓ ' + D.fmt(s.signedAt) : k === inj.rtpStage && inj.status !== 'Closed' ? daysInStage(inj) + '/' + (inj.stageTargetDays || s.targetDays) + ' d' : s.targetDays ? s.targetDays + ' d' : 'Doctor' }))} current=${inj.status === 'Closed' ? inj.rtpStages.length : ['Reported', 'Assessment'].includes(inj.status) ? -1 : inj.rtpStage} blocked=${isOverdue(inj)} />`}
            ${inj.path === 'light' && inj.status === 'Monitoring' && html`<div className="med-lock"><${I} name="eye" size=${14} /><span>Light path: flagged and monitored without a rehab case. Escalate if pain rises or the niggle persists beyond 72 h.</span></div>`}
          </div>
        </div>
        <${UI.Tabs} tabs=${tabs} value=${cur} onChange=${setT} />
        ${cur === 'case' && html`<${CaseTab} inj=${inj} a=${a} own=${own} />`}
        ${cur === 'rtp' && html`<${RtpTab} inj=${inj} a=${a} own=${own} />`}
        ${cur === 'timeline' && html`<${UI.Timeline} items=${inj.timeline.map((e) => ({ date: D.fmt(e.date), title: ({ report: 'Reported', assessment: 'Assessment', stage: 'Stage signed off', setback: 'Setback', note: 'Note', clearance: 'Clearance', decision: 'Decision' })[e.type] || e.type, text: e.text, by: e.by, icon: (TL[e.type] || TL.note)[0], tone: (TL[e.type] || TL.note)[1] }))} />`}
        ${cur === 'notes' && html`<${NotesTab} inj=${inj} own=${own} />`}
        ${cur === 'pain' && html`<${PainTab} inj=${inj} a=${a} own=${own} />`}
      </div>
    <//>`;
  }

  function SummaryDrawer({ inj, a }) {
    const role = AMS.ui.role;
    const st = stageOf(inj);
    const [coachView, setCoachView] = useState('');
    const canEscalate = role === 'coach' && ['Rehab', 'Clearance'].includes(inj.status) && !(inj.decision && inj.decision.status === 'Pending');
    return html`<${Frag}>
      <${UI.DrawerHead} avatar=${html`<${UI.Avatar} name=${a.name} size=${44} />`} title=${a.name} sub=${AMS.medicalLabel(inj)}>
        <div className="row wrap tight" style=${{ marginTop: 4 }}><${UI.AvailabilityPill} value=${a.availability} /><${UI.Pill} tone=${STATUS_TONE[inj.status]}>${inj.status}<//></div>
      <//>
      <div className="drawer-b">
        <${PrivacyNote} text="Medical details are visible to medical staff only. You see availability, body zone, rehab stage, expected return and what training is allowed." />
        <${UI.DL} cols=${2} items=${[
          ['Availability', a.availability], ['Body zone', AMS.bodyZone(inj.region)],
          ['Rehab stage', inj.path === 'light' ? 'Monitoring (light path)' : inj.status === 'Closed' ? 'Completed' : ['Reported', 'Assessment'].includes(inj.status) ? 'Awaiting physio assessment' : 'Stage ' + (inj.rtpStage + 1) + ' of ' + inj.rtpStages.length + (st ? ' — ' + st.name : '')],
          ['Expected return', inj.expectedReturn ? D.fmt(inj.expectedReturn) : 'After assessment'],
          ['Training allowed today', allowedTraining(inj)], ['Physio', staffName(inj.physioId)],
        ]} />
        ${inj.path === 'case' && !['Reported', 'Assessment'].includes(inj.status) && html`<${UI.Stepper} steps=${inj.rtpStages.map((s) => ({ label: s.name }))} current=${inj.status === 'Closed' ? inj.rtpStages.length : inj.rtpStage} />`}
        ${inj.status === 'Closed' && inj.gradedReturn && html`<${GradedCard} inj=${inj} a=${a} />`}
        ${inj.decision && html`<div className="card" style=${{ padding: 12 }}><div className="small"><b>Readiness decision:</b> ${inj.decision.status === 'Pending' ? 'Pending with ' + staffName(inj.doctorId) : (({ physio: 'Physio view upheld', coach: 'Coach view upheld', other: 'Doctor\'s alternative plan' })[inj.decision.outcome] || 'Decided') + ' by ' + inj.decision.decidedBy}</div></div>`}
        ${canEscalate && html`<${UI.Card} title="Disagree on readiness?" icon="scale" hint="the team doctor decides and the decision is recorded">
          <div className="col tight">
            <textarea className="textarea" rows="2" value=${coachView} onChange=${(e) => setCoachView(e.target.value)} placeholder="e.g. She ran 3 × 60 m at 90% on Friday without symptoms — I think stage 4 is appropriate" />
            <div className="row" style=${{ justifyContent: 'flex-end' }}><button className="btn sm" disabled=${!coachView.trim()} onClick=${() => { AMS.runAction('injury.escalate', { injuryId: inj.id, question: 'Coach asks to progress ' + firstName(a.name) + ' beyond the current stage', coachView: coachView.trim() }); setCoachView(''); }}><${I} name="send" size=${13} />Escalate to team doctor</button></div>
          </div>
        <//>`}
      </div>
    <//>`;
  }

  function CaseTab({ inj, a, own }) {
    const full = isMed();
    const editable = full && ['Reported', 'Assessment', 'Monitoring'].includes(inj.status);
    const sim = similarCases(inj.region, inj.type, inj.id);
    const clean = (s) => String(s || '').replace(/^Suspected\s+/i, '').replace(/\s+—\s+awaiting assessment$/i, '').replace(/^Light-path flag:\s*/i, '');
    const [dx, setDx] = useState(clean(inj.diagnosis));
    const [type, setType] = useState(inj.type || 'Muscle strain');
    const [grade, setGrade] = useState(inj.grade ? String(inj.grade) : '1');
    const [severity, setSeverity] = useState(inj.severity || 'minor');
    const [tpl, setTpl] = useState(inj.rtpTemplate || AMS.rtpTemplateFor(inj.region, inj.type));
    const [ret, setRet] = useState(inj.expectedReturn || D.add(inj.dateOfInjury, sim.median || 14));
    const [avail, setAvail] = useState(inj.availability || a.availability);
    const [note, setNote] = useState('');
    const [drafted, setDrafted] = useState(false);
    const prior = priorSameRegion(a.id, inj.region, inj.id);
    const ac = acwrBefore(a, inj.dateOfInjury);
    const aiBox = html`<div className="ai-box col tight">
      <span className="row tight" style=${{ fontWeight: 600 }}><${I} name="sparkles" size=${14} style=${{ color: 'var(--ai)' }} />Context the AI used</span>
      <${UI.Evidence} items=${[
        { label: 'Similar cases', value: sim.n ? 'n=' + sim.n + ', median ' + sim.median + ' d' : 'none', tone: 'info' },
        { label: 'ACWR day before', value: ac != null ? ac.toFixed(2) : 'n/a', tone: ac != null ? C.acwrBand(ac) : 'info' },
        { label: 'Prior same region', value: String(prior.length), tone: prior.length ? 'bad' : 'good' },
        { label: 'Pain trend', value: (inj.painLog || []).length ? inj.painLog[0].pain + '→' + inj.painLog[inj.painLog.length - 1].pain + '/10' : '—', tone: 'warn' },
      ]} />
      ${inj.aiSuggested && html`<span className="tiny muted">At report the AI suggested the ${inj.aiSuggested.path === 'light' ? 'light path' : 'rehab case path'} (${Math.round((inj.aiSuggested.confidence || 0) * 100)}%) — ${inj.aiSuggested.accepted ? 'accepted' : 'overridden'} by the reporter.</span>`}
    </div>`;
    if (!editable) {
      return html`<div className="col loose">
        <${UI.DL} cols=${3} items=${[['Diagnosis', inj.diagnosis], ['Type', inj.type], ['Grade', inj.grade || '—'], ['Severity', inj.severity], ['RTP template', inj.rtpTemplate + ' (' + inj.rtpStages.length + ' stages)'], ['Path', inj.path === 'light' ? 'Light path' : 'Rehab case'], ['Onset', D.fmtLong(inj.dateOfInjury)], ['Context', inj.context || 'Training'], ['Days lost', inj.daysLost != null ? inj.daysLost + ' d' : daysSince(inj) + ' d so far']]} />
        ${full && inj.status !== 'Closed' && html`<${UI.Card} title="Availability" icon="flag" hint="a human decision — the AI never changes this">
          <div className="row between wrap" style=${{ gap: 8 }}>
            <${UI.Seg} value=${a.availability} onChange=${(val) => AMS.runAction('injury.setAvailability', { injuryId: inj.id, value: val })} options=${['Available', 'Modified', 'Unavailable']} />
            <span className="small muted">Coach sees: “${AMS.medicalLabel(inj, 'coach')}”</span>
          </div>
        <//>`}
        ${aiBox}
        ${inj.notes.filter((n) => n.kind === 'assessment').slice(0, 1).map((n, k) => html`<${UI.Card} key=${k} title="Assessment note" icon="clipboard" hint=${n.by + ' · ' + D.fmt(n.date)}><div className="small" style=${{ whiteSpace: 'pre-wrap' }}>${n.text}</div><//>`)}
        ${!full && own && html`<${PrivacyNote} text="This is your own record. Your physio updates the assessment and stages." />`}
      </div>`;
    }
    const tplOpts = Object.keys(AMS.RTP_TEMPLATES).map((k) => ({ value: k, label: k + ' — ' + AMS.RTP_TEMPLATES[k].map((s) => s.name).slice(0, 3).join(', ') + '…' }));
    return html`<div className="col loose">
      ${inj.status === 'Monitoring' && html`<div className="row between wrap ai-box" style=${{ gap: 8 }}>
        <span className="small">Light-path flag since ${D.fmt(inj.dateOfInjury)} (${daysSince(inj)} d). Record an assessment below to convert it into a rehab case, or resolve it.</span>
        <div className="row tight"><button className="btn xs" onClick=${() => AMS.runAction('injury.escalateLight', { injuryId: inj.id })}>Escalate to case</button><button className="btn xs ghost" onClick=${() => AMS.runAction('injury.resolveLight', { injuryId: inj.id })}>Resolve — symptoms settled</button></div>
      </div>`}
      ${inj.status === 'Reported' && html`<div className="row between wrap" style=${{ gap: 8, padding: '8px 12px', background: 'var(--bad-weak)', borderRadius: 'var(--r)' }}>
        <span className="small">Reported ${agoText(reportedAt(inj))} by ${inj.reportedBy}. Not yet picked up.</span>
        <button className="btn xs primary" onClick=${() => AMS.runAction('injury.startAssessment', { injuryId: inj.id })}>Start assessment</button>
      </div>`}
      <${UI.Card} title="Physio assessment" icon="clipboard" hint="saving moves the case to Rehab stage 1">
        <div className="col">
          <${UI.Field} label="Confirmed diagnosis"><input className="input" value=${dx} onChange=${(e) => setDx(e.target.value)} /><//>
          <div className="grid g3">
            <${UI.Field} label="Type"><${UI.Select} value=${type} onChange=${setType} options=${TYPES} /><//>
            <${UI.Field} label="Grade"><${UI.Seg} size="sm" value=${grade} onChange=${setGrade} options=${['1', '2', '3']} /><//>
            <${UI.Field} label="Severity"><${UI.Seg} size="sm" value=${severity} onChange=${setSeverity} options=${[{ id: 'minor', label: 'Minor' }, { id: 'moderate', label: 'Mod.' }, { id: 'severe', label: 'Severe' }]} /><//>
          </div>
          <div className="grid g3">
            <${UI.Field} label="RTP template" help=${'AI default: ' + AMS.rtpTemplateFor(inj.region, type)}><${UI.Select} value=${tpl} onChange=${setTpl} options=${tplOpts} /><//>
            <${UI.Field} label="Expected return" help=${sim.n ? 'Similar cases: median ' + sim.median + ' d → ' + D.fmt(D.add(inj.dateOfInjury, sim.median)) : ''}><input className="input" type="date" value=${ret} min=${AMS.TODAY} onChange=${(e) => setRet(e.target.value)} /><//>
            <${UI.Field} label="Availability"><${UI.Select} value=${avail} onChange=${setAvail} options=${['Available', 'Modified', 'Unavailable']} /><//>
          </div>
          <${UI.Field} label="Assessment note">
            <textarea className="textarea" rows="6" value=${note} onChange=${(e) => setNote(e.target.value)} placeholder="Findings, working diagnosis, plan…" />
          <//>
          <div className="row between wrap" style=${{ gap: 8 }}>
            <div className="row tight wrap">
              <button className="btn sm ai" onClick=${() => { setNote(aiDraftNote(Object.assign({}, inj, { type, grade: +grade, rtpTemplate: tpl }))); setDrafted(true); }}><${I} name="sparkles" size=${13} />AI draft assessment note</button>
              ${drafted && html`<span className="tiny ai-c">Draft from case data — edit before saving. Nothing is saved until you click Save.</span>`}
            </div>
            <button className="btn primary" disabled=${!dx.trim()} onClick=${() => AMS.runAction('injury.assess', { injuryId: inj.id, diagnosis: dx.trim(), type, grade, severity, rtpTemplate: tpl, expectedReturn: ret, availability: avail, note: note.trim() })}><${I} name="check" size=${14} />Save assessment → Rehab</button>
          </div>
        </div>
      <//>
      ${aiBox}
    </div>`;
  }

  function GradedCard({ inj, a }) {
    const role = AMS.ui.role;
    const plan = inj.gradedReturn || gradedPlan(a, inj, inj.closedOn || AMS.TODAY);
    const can = isMed() || AMS.canEdit('training') || AMS.canEdit('readiness');
    const applied = plan.applied;
    const thisWeek = C.weekLoad(a);
    return html`<${UI.Card} title="Graded return-to-load" icon="trend-up" hint=${'based on ' + plan.basis}
      actions=${applied ? html`<${UI.Pill} tone="good"><${I} name="check" size=${11} />Applied by ${applied.by}<//>` : inj.status === 'Closed' && html`<button className="btn sm primary" disabled=${!can} title=${can ? '' : 'Coach, scientist or medical staff apply load plans'} onClick=${() => AMS.runAction('injury.applyGradedReturn', { injuryId: inj.id })}><${I} name="zap" size=${13} />Apply plan</button>`}>
      <div className="col tight">
        <span className="small muted">Fitness drops during time off — jumping straight back to full load is when re-injury happens. Pre-injury chronic load ≈ <b>${plan.chronicWeekly.toLocaleString('en-IN')} AU/week</b>.</span>
        <div className="grid g3">
          ${plan.weeks.map((w) => html`<div key=${w.week} className="card" style=${{ padding: 10 }}>
            <div className="row between"><b>Week ${w.week}</b><${UI.Pill} tone=${w.pct < 70 ? 'warn' : w.pct < 85 ? 'info' : 'good'}>${w.pct}%<//></div>
            <div className="num" style=${{ fontSize: 20, fontWeight: 600 }}>${w.capAU.toLocaleString('en-IN')} <span className="tiny faint">AU cap</span></div>
            <div className="tiny faint">${D.fmt(w.from)} – ${D.fmt(w.to)} · ~${w.perSession} AU/session × 5</div>
          </div>`)}
        </div>
        ${applied && html`<span className="tiny muted">Current week so far: ${thisWeek.toLocaleString('en-IN')} AU (last 7 days). The load cap is visible to the coach in Training and to the sports scientist.</span>`}
        ${role === 'coach' && !applied && html`<span className="tiny muted">Applying sets today's session to reduced volume and tags the athlete “Graded return”.</span>`}
      </div>
    <//>`;
  }

  function RtpTab({ inj, a, own }) {
    const role = AMS.ui.role;
    const full = isMed();
    const [reason, setReason] = useState('');
    const [showSetback, setShowSetback] = useState(false);
    const [esc, setEsc] = useState({ open: false, question: '', physioView: '', coachView: '' });
    const [rationale, setRationale] = useState('');
    const [conditions, setConditions] = useState('Graded return over 3 weeks (60 → 75 → 90% of pre-injury load); physio review after week 1; no competition before ' + D.fmt(D.add(AMS.TODAY, 14)) + '.');
    const st = stageOf(inj);
    if (inj.path === 'light' && inj.status === 'Monitoring') return html`<${UI.Empty} icon="eye" title="Light path — no return-to-play stages">Escalate to a rehab case from the Case tab if symptoms persist.<//>`;
    if (['Reported', 'Assessment'].includes(inj.status)) return html`<${UI.Empty} icon="clipboard" title="Return-to-play starts after the physio assessment">${inj.rtpStages.length}-stage ${inj.rtpTemplate} protocol pre-selected: ${inj.rtpStages.map((s) => s.name).join(' → ')}.<//>`;
    const decisionBlock = inj.decision && html`<${UI.Card} title="Physio / coach disagreement" icon="scale" hint=${inj.decision.status === 'Pending' ? 'waiting for ' + staffName(inj.doctorId) : 'decided'}>
      <div className="col tight">
        <span className="small"><b>Question:</b> ${inj.decision.question}</span>
        ${inj.decision.physioView && html`<span className="small"><b>Physio:</b> ${inj.decision.physioView}</span>`}
        ${inj.decision.coachView && html`<span className="small"><b>Coach:</b> ${inj.decision.coachView}</span>`}
        <span className="tiny faint">Raised by ${inj.decision.raisedBy} · ${inj.decision.at.replace('T', ' ')}</span>
        ${inj.decision.status === 'Decided' ? html`<div className="small" style=${{ padding: 8, background: 'var(--ai-weak)', borderRadius: 'var(--r)' }}><b>${({ physio: 'Physio view upheld', coach: 'Coach view upheld', other: 'Doctor\'s alternative plan' })[inj.decision.outcome]}</b> — ${inj.decision.decidedBy}${inj.decision.rationale ? ': ' + inj.decision.rationale : ''}</div>`
          : role === 'doctor' ? html`<div className="col tight">
            <textarea className="textarea" rows="2" value=${rationale} onChange=${(e) => setRationale(e.target.value)} placeholder="Rationale (recorded on the case)" />
            <div className="row tight wrap">
              <button className="btn sm" onClick=${() => AMS.runAction('injury.decide', { injuryId: inj.id, outcome: 'physio', rationale })}>Uphold physio</button>
              <button className="btn sm" onClick=${() => AMS.runAction('injury.decide', { injuryId: inj.id, outcome: 'coach', rationale })}>Uphold coach</button>
              <button className="btn sm" onClick=${() => AMS.runAction('injury.decide', { injuryId: inj.id, outcome: 'other', rationale })}>Alternative plan</button>
            </div>
          </div>` : html`<span className="tiny faint"><${I} name="lock" size=${11} /> Only the team doctor can record the decision.</span>`}
      </div>
    <//>`;
    if (inj.status === 'Closed') {
      return html`<div className="col loose">
        <${UI.Card} title="Cleared to return" icon="shield-check" hint=${inj.clearance ? inj.clearance.by + ' · ' + D.fmt(inj.clearance.date) : ''}>
          <div className="col tight"><span className="small">${inj.clearance ? inj.clearance.conditions : 'Closed'}</span><span className="tiny faint">${inj.daysLost != null ? inj.daysLost + ' days lost' : ''}${inj.setbacks ? ' · ' + inj.setbacks + ' setback(s)' : ''}</span></div>
        <//>
        ${inj.path === 'case' && html`<${GradedCard} inj=${inj} a=${a} />`}
        ${decisionBlock}
      </div>`;
    }
    const allMet = st && st.criteria.every((c) => c.met);
    const final = inj.status === 'Clearance';
    const signReason = !full ? 'Only physio or doctor can sign off' : !allMet ? 'Tick every criterion first (' + st.criteria.filter((c) => c.met).length + '/' + st.criteria.length + ' met)' : '';
    const clearReason = role !== 'doctor' ? 'Only the team doctor (' + staffName(inj.doctorId) + ') can sign clearance — you are signed in as ' + AMS.roleLabel(role) + '.' : '';
    const preview = final ? gradedPlan(a, inj, AMS.TODAY) : null;
    return html`<div className="col loose">
      <${UI.Card} title=${(final ? 'Final stage · ' : 'Stage ' + (inj.rtpStage + 1) + ' of ' + inj.rtpStages.length + ' · ') + st.name} icon=${final ? 'shield-check' : 'run'}
        hint=${daysInStage(inj) + ' of ' + (inj.stageTargetDays || st.targetDays || 1) + ' planned days' + (isOverdue(inj) ? ' — running long' : '')}>
        <div className="col tight">
          ${isOverdue(inj) && html`<div className="small bad"><${I} name="alert" size=${13} /> In this stage ${daysInStage(inj) - (inj.stageTargetDays || 0)} days longer than planned. Review the criteria — sign off what is met, or log a setback with the reason.</div>`}
          ${st.criteria.map((c, k) => html`<button key=${k} className=${AMS.cx('med-crit', c.met && 'met', full && !final && 'can')} disabled=${!full || final} onClick=${() => AMS.runAction('injury.toggleCriterion', { injuryId: inj.id, index: k })}>
            <span className="med-box">${c.met && html`<${I} name="check" size=${11} stroke=${3} />`}</span>
            <span className="col tight" style=${{ gap: 1 }}><span className="small" style=${{ fontWeight: 500 }}>${c.text}</span>${final && html`<span className="tiny faint">Signed by the team doctor through clearance</span>`}</span>
          </button>`)}
          ${!final && html`<div className="row between wrap" style=${{ gap: 8, marginTop: 4 }}>
            <span className="tiny faint">${signReason || 'All criteria met — ready to progress to ' + (inj.rtpStages[inj.rtpStage + 1] || {}).name + '.'}</span>
            <div className="row tight">
              <button className="btn sm danger" disabled=${!full} onClick=${() => setShowSetback(!showSetback)}><${I} name="arrow-down" size=${13} />Log setback</button>
              <button className="btn sm primary" disabled=${!!signReason} title=${signReason} onClick=${() => AMS.runAction('injury.signStage', { injuryId: inj.id })}><${I} name="check" size=${13} />Sign off stage</button>
            </div>
          </div>`}
          ${showSetback && html`<div className="col tight" style=${{ padding: 10, border: '1px solid var(--bad)', borderRadius: 'var(--r)' }}>
            <span className="small">Moves ${firstName(a.name)} back one stage (to “${inj.rtpStages[Math.max(0, inj.rtpStage - 1)].name}”), resets its criteria and pushes the expected return.</span>
            <input className="input" value=${reason} onChange=${(e) => setReason(e.target.value)} placeholder="Reason, e.g. tightness at 80% strides, pain 4/10" />
            <div className="row" style=${{ justifyContent: 'flex-end' }}><button className="btn sm danger" onClick=${() => { AMS.runAction('injury.setback', { injuryId: inj.id, reason }); setReason(''); setShowSetback(false); }}>Confirm setback</button></div>
          </div>`}
        </div>
      <//>
      ${final && html`<${UI.Card} title="Return-to-play clearance" icon="shield-check" hint="team doctor only">
        <div className="col tight">
          <${UI.Field} label="Clearance conditions"><textarea className="textarea" rows="3" value=${conditions} onChange=${(e) => setConditions(e.target.value)} disabled=${role !== 'doctor'} /><//>
          ${preview && html`<div className="small muted">On clearance the system creates a graded return: ${preview.weeks.map((w) => 'week ' + w.week + ' ≤ ' + w.capAU.toLocaleString('en-IN') + ' AU (' + w.pct + '%)').join(' · ')} — from ${preview.basis}.</div>`}
          ${clearReason && html`<div className="med-lock"><${I} name="lock" size=${14} /><span>${clearReason}</span></div>`}
          <div className="row between wrap" style=${{ gap: 8 }}>
            <button className="btn sm danger" disabled=${!full} onClick=${() => AMS.runAction('injury.setback', { injuryId: inj.id, reason: 'Not ready at clearance review' })}><${I} name="arrow-down" size=${13} />Not ready — back one stage</button>
            <button className="btn primary" disabled=${!!clearReason} title=${clearReason} onClick=${() => AMS.runAction('injury.clear', { injuryId: inj.id, conditions })}><${I} name="shield-check" size=${14} />Sign clearance & close case</button>
          </div>
        </div>
      <//>`}
      ${decisionBlock}
      ${!(inj.decision && inj.decision.status === 'Pending') && (full || role === 'coach') && html`<${UI.Card} title="Escalate a disagreement to the doctor" icon="scale" hint="physio and coach disagree on readiness">
        ${!esc.open ? html`<button className="btn sm" onClick=${() => setEsc(Object.assign({}, esc, { open: true, question: 'Is ' + firstName(a.name) + ' ready to progress beyond "' + st.name + '"?' }))}><${I} name="scale" size=${13} />Escalate to ${staffName(inj.doctorId)}</button>` : html`<div className="col tight">
          <input className="input" value=${esc.question} onChange=${(e) => setEsc(Object.assign({}, esc, { question: e.target.value }))} />
          <div className="grid g2">
            <textarea className="textarea" rows="2" value=${esc.physioView} onChange=${(e) => setEsc(Object.assign({}, esc, { physioView: e.target.value }))} placeholder="Physio view" />
            <textarea className="textarea" rows="2" value=${esc.coachView} onChange=${(e) => setEsc(Object.assign({}, esc, { coachView: e.target.value }))} placeholder="Coach view" />
          </div>
          <div className="row tight" style=${{ justifyContent: 'flex-end' }}><button className="btn sm ghost" onClick=${() => setEsc({ open: false, question: '', physioView: '', coachView: '' })}>Cancel</button><button className="btn sm primary" onClick=${() => { AMS.runAction('injury.escalate', { injuryId: inj.id, question: esc.question, physioView: esc.physioView, coachView: esc.coachView }); setEsc({ open: false, question: '', physioView: '', coachView: '' }); }}>Send to doctor</button></div>
        </div>`}
      <//>`}
    </div>`;
  }

  function NotesTab({ inj, own }) {
    const full = isMed();
    const [text, setText] = useState('');
    return html`<div className="col loose">
      <div className="med-lock"><${I} name="lock" size=${14} /><span>Medical notes are private to physio and doctor. Coaches and directors never see them.</span></div>
      ${full && html`<div className="col tight">
        <textarea className="textarea" rows="3" value=${text} onChange=${(e) => setText(e.target.value)} placeholder="Add a clinical note…" />
        <div className="row between wrap"><button className="btn xs ai" onClick=${() => setText(aiDraftNote(inj))}><${I} name="sparkles" size=${12} />AI draft from case data</button><button className="btn sm primary" disabled=${!text.trim()} onClick=${() => { if (AMS.runAction('injury.addNote', { injuryId: inj.id, text })) setText(''); }}><${I} name="plus" size=${13} />Add note</button></div>
      </div>`}
      <div className="list" style=${{ border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
        ${inj.notes.length === 0 && html`<${UI.Empty} icon="edit" title="No notes yet" />`}
        ${inj.notes.map((n, k) => html`<div key=${k} className="list-item" style=${{ alignItems: 'flex-start' }}>
          <${UI.Avatar} name=${n.by} size=${26} />
          <div className="col tight grow" style=${{ gap: 2, minWidth: 0 }}><div className="row between"><span className="small" style=${{ fontWeight: 600 }}>${n.by} <span className="faint" style=${{ fontWeight: 400 }}>· ${AMS.roleLabel(n.role)}${n.kind === 'assessment' ? ' · assessment' : ''}</span></span><span className="tiny faint">${D.fmt(n.date)}${n.at ? ' ' + n.at : ''}</span></div><div className="small" style=${{ whiteSpace: 'pre-wrap' }}>${n.text}</div></div>
        </div>`)}
      </div>
    </div>`;
  }

  function PainTab({ inj, a, own }) {
    const full = isMed();
    const today = (inj.painLog || []).find((p) => p.date === AMS.TODAY);
    const [pain, setPain] = useState(today ? today.pain : null);
    const log = (inj.painLog || []).slice(-30);
    const well = (a.wellness || []).map((w, k) => ({ x: D.fmt(AMS.series.wellDate(k)), y: w ? C.wellnessScore(w) : null }));
    const base = C.wellnessBaseline(a);
    const trend = log.length >= 2 ? log[log.length - 1].pain - log[Math.max(0, log.length - 4)].pain : 0;
    return html`<div className="col loose">
      <${UI.Card} title="Pain log" icon="pulse" hint=${log.length + ' entries · ' + (trend < 0 ? 'falling' : trend > 0 ? 'rising' : 'flat') + ' over last 3 entries'}>
        ${log.length ? html`<${UI.LineChart} series=${[{ name: 'Pain (0–10)', data: log.map((p) => ({ x: D.fmt(p.date), y: p.pain })), tone: 'bad', area: true }]} yMin=${0} yMax=${10} height=${180} refs=${[{ y: 3, label: 'Progression threshold 3/10', tone: 'warn' }]} />` : html`<${UI.Empty} icon="pulse" title="No pain scores yet" />`}
      <//>
      ${(full || own) && inj.status !== 'Closed' && html`<${UI.Card} title="Today's pain score" icon="plus">
        <div className="col tight">
          <div className="med-pain">${Array.from({ length: 11 }, (_, k) => html`<button key=${k} className=${pain === k ? 'on' : ''} onClick=${() => setPain(k)}>${k}</button>`)}</div>
          <div className="row between"><span className="tiny faint">${today ? 'Recorded today: ' + today.pain + '/10 — saving replaces it' : 'Not yet recorded today'}</span><button className="btn sm primary" disabled=${pain == null} onClick=${() => AMS.runAction('injury.logPain', { injuryId: inj.id, pain })}>Save ${pain != null ? pain + '/10' : ''}</button></div>
        </div>
      <//>`}
      <${UI.Card} title="Wellness — last 28 days" icon="heart" hint=${'own normal ' + Math.round(base || 0)}>
        <${UI.LineChart} series=${[{ name: 'Wellness', data: well, tone: 'accent' }]} yMin=${0} yMax=${100} height=${170} refs=${base ? [{ y: Math.round(base), label: 'Own normal', tone: 'good' }] : []} markers=${D.diff(inj.dateOfInjury, AMS.series.wellDate(0)) >= 0 ? [{ i: D.diff(inj.dateOfInjury, AMS.series.wellDate(0)), label: 'Injury', tone: 'bad' }] : []} />
      <//>
    </div>`;
  }

  /* ================================================================== athlete profile tab */
  function AthleteMedicalTab({ athlete }) {
    const { db, v } = AMS.useStore();
    const role = AMS.ui.role;
    const a = athlete;
    const full = isMed();
    const own = role === 'athlete' && AMS.me() && AMS.me().id === a.id;
    const list = db.injuries.filter((i) => i.athleteId === a.id).sort((x, y) => (isOpen(y) - isOpen(x)) || y.dateOfInjury.localeCompare(x.dateOfInjury));
    const openList = list.filter(isOpen), hist = list.filter((i) => !isOpen(i));
    if (role === 'ops') return html`<${PrivacyNote} text="Operations staff have no access to medical information." />`;
    const risk = C.risk(a);
    const lastClosed = hist.find((i) => i.gradedReturn);
    const report = (region, side) => AMS.runAction('injury.report', { athleteId: a.id, region, side });
    if (!full && !own) {
      return html`<div className="col loose">
        <${PrivacyNote} />
        <div className="grid g3">
          <${UI.KPI} label="Availability" value=${a.availability} tone=${{ Available: 'good', Modified: 'warn', Unavailable: 'bad' }[a.availability]} foot=${a.availabilityReason || 'set by medical staff'} />
          <${UI.KPI} label="Open medical items" value=${openList.length} foot=${openList.map((i) => AMS.bodyZone(i.region)).join(', ') || 'none'} />
          <${UI.KPI} label="Injury risk" value=${risk.score} unit="/100" tone=${risk.band} foot=${risk.factors.slice(0, 2).map((f) => f.label).join(', ') || 'no flags'} />
        </div>
        ${openList.map((i) => html`<div key=${i.id} className="card clickable" style=${{ padding: 12, cursor: 'pointer' }} onClick=${() => openInjury(i)}>
          <div className="row between wrap"><b>${AMS.medicalLabel(i)}</b><${UI.Pill} tone=${STATUS_TONE[i.status]}>${i.status}<//></div>
          <div className="small muted">${i.path === 'light' ? 'Monitoring' : ['Reported', 'Assessment'].includes(i.status) ? 'Awaiting physio assessment' : 'Rehab stage ' + (i.rtpStage + 1) + ' of ' + i.rtpStages.length}${i.expectedReturn ? ' · expected back ' + D.fmt(i.expectedReturn) : ''}</div>
          <div className="small">Allowed: ${allowedTraining(i)}</div>
        </div>`)}
        ${lastClosed && a.returnedOn && D.diff(AMS.TODAY, a.returnedOn) <= 28 && html`<${GradedCard} inj=${lastClosed} a=${a} />`}
        <div className="row tight wrap">
          <button className="btn sm" onClick=${() => report()}><${I} name="medical" size=${14} />Report injury</button>
          <span className="tiny faint">${hist.length} past injur${hist.length === 1 ? 'y' : 'ies'} on record (details with medical staff).</span>
        </div>
      </div>`;
    }
    return html`<div className="col loose">
      <div className="med-split">
        <div className="col tight" style=${{ alignItems: 'center' }}>
          <${BodyMap} marks=${marksFor(list)} onSelect=${own ? undefined : report} height=${380} />
          ${!own && html`<span className="tiny faint">Click a region to report a new injury there.</span>`}
        </div>
        <div className="col" style=${{ minWidth: 0 }}>
          <div className="row between wrap">
            <h3 style=${{ margin: 0 }}>Current (${openList.length})</h3>
            ${!own && html`<button className="btn sm primary" onClick=${() => report()}><${I} name="plus" size=${13} />Report injury</button>`}
          </div>
          <div className="list" style=${{ border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
            ${openList.length === 0 && html`<div className="list-item"><span className="small faint">No open injuries.</span></div>`}
            ${openList.map((i) => html`<${CaseRow} key=${i.id} inj=${i} />`)}
          </div>
          <div className="ai-box col tight">
            <span className="row tight small" style=${{ fontWeight: 600 }}><${I} name="sparkles" size=${14} style=${{ color: 'var(--ai)' }} />Injury risk ${risk.score}/100 · ${C.bandLabel(risk.band)}</span>
            <${UI.Evidence} items=${risk.factors.length ? risk.factors : [{ label: 'No risk factors', value: '—', tone: 'good' }]} />
            ${hist.length > 0 && html`<span className="tiny muted">Repeat regions: ${Object.entries(AMS.groupBy(list, 'region')).filter(([, l]) => l.length > 1).map(([r, l]) => REGION_NAMES[r] + ' ×' + l.length).join(', ') || 'none'}</span>`}
          </div>
          <h3 style=${{ margin: 0 }}>History (${hist.length})</h3>
          <div className="list" style=${{ border: '1px solid var(--border)', borderRadius: 'var(--r)', maxHeight: 220, overflowY: 'auto' }}>
            ${hist.length === 0 && html`<div className="list-item"><span className="small faint">No past injuries.</span></div>`}
            ${hist.map((i) => html`<div key=${i.id} className="list-item clickable" style=${{ cursor: 'pointer' }} onClick=${() => openInjury(i)}>
              <span className="dot" style=${{ background: 'var(--fg-3)' }} />
              <div className="col tight grow" style=${{ gap: 1, minWidth: 0 }}><span className="small ellipsis" style=${{ fontWeight: 600 }}>${i.diagnosis}</span><span className="tiny faint">${D.fmt(i.dateOfInjury)} → ${D.fmt(i.closedOn)} · ${i.daysLost != null ? i.daysLost + ' d lost' : ''}${i.setbacks ? ' · ' + i.setbacks + ' setback' : ''}</span></div>
            </div>`)}
          </div>
        </div>
      </div>
      ${lastClosed && a.returnedOn && D.diff(AMS.TODAY, a.returnedOn) <= 28 && html`<${GradedCard} inj=${lastClosed} a=${a} />`}
    </div>`;
  }

  /* ================================================================== registrations */
  const MED_ROLES = ['director', 'coach', 'physio', 'doctor', 'scientist', 'nutritionist'];
  AMS.registerModule({
    id: 'medical', label: 'Medical & Injury', icon: 'medical', group: 'health', order: 7, roles: MED_ROLES, component: Page, short: 'Medical',
    badge: () => {
      try {
        const ids = new Set(AMS.scopedAthletes().map((a) => a.id));
        const role = AMS.ui.role;
        const n = AMS.db.injuries.filter((i) => ids.has(i.athleteId) && (i.status === 'Reported' || (role === 'doctor' && (i.status === 'Clearance' || (i.decision && i.decision.status === 'Pending'))))).length;
        return n ? { n, tone: 'bad' } : null;
      } catch (e) { return null; }
    },
    sampleParams: [{}, { tab: 'caseload' }, { tab: 'wellness' }, { tab: 'analytics' }],
  });
  AMS.registerModal('injury-report', InjuryReportModal, {
    sample: () => [{}, { athleteId: AMS.db.meta.heroAthleteId, region: 'hamstring', side: 'C' }, { athleteId: (AMS.db.athletes.find((a) => a.name === 'Yash More') || {}).id, region: 'groin', side: 'L' }],
  });
  AMS.registerDrawer('injury', InjuryDrawer, {
    wide: true,
    sample: () => AMS.db.injuries.filter((i) => i.status !== 'Closed').slice(0, 6).map((i) => ({ injuryId: i.id }))
      .concat(AMS.db.injuries.filter((i) => i.status !== 'Closed').slice(0, 6).map((i) => ({ injuryId: i.id, tab: 'rtp' })))
      .concat(AMS.db.injuries.filter((i) => i.status === 'Closed').slice(0, 1).map((i) => ({ injuryId: i.id, tab: 'rtp' })))
      .concat(AMS.db.injuries.slice(0, 2).map((i) => ({ injuryId: i.id, tab: 'pain' })), AMS.db.injuries.slice(0, 2).map((i) => ({ injuryId: i.id, tab: 'notes' })), AMS.db.injuries.slice(0, 2).map((i) => ({ injuryId: i.id, tab: 'timeline' }))),
  });
  AMS.registerAthleteTab({ id: 'medical', label: 'Medical', order: 30, roles: ['director', 'coach', 'physio', 'doctor', 'scientist', 'nutritionist', 'athlete'], component: AthleteMedicalTab });
  AMS.registerCommand({ id: 'medical.report', label: 'Report an injury', group: 'Medical', icon: 'medical', keywords: 'injury report hurt pain body map niggle', roles: MED_ROLES, run: () => AMS.runAction('injury.report', {}) });
  AMS.registerCommand({ id: 'medical.caseload', label: 'Open medical caseload board', group: 'Medical', icon: 'clipboard', keywords: 'rehab cases physio board return to play', roles: MED_ROLES, run: () => AMS.go('medical', { tab: 'caseload' }) });
  AMS.registerCommand({ id: 'medical.wellness', label: 'Wellness monitoring (vs own normal)', group: 'Medical', icon: 'pulse', keywords: 'wellness check-in soreness sleep', roles: MED_ROLES, run: () => AMS.go('medical', { tab: 'wellness' }) });

  /* exported pure helpers (other modules / copilot) */
  AMS.medical = { regionLabel, viewFor, similarCases, gradedPlan, aiPathFor, aiDraftNote, allowedTraining, guessRegion, REGION_NAMES };

  /* ================================================================== self-tests (workflow assertions on fresh seed data) */
  const byName = (n) => AMS.db.athletes.find((a) => a.name === n);
  const openInjOf = (n) => { const a = byName(n); return a && AMS.db.injuries.find((i) => i.athleteId === a.id && i.status !== 'Closed'); };
  const must = (c, m) => { if (!c) throw new Error(m); };
  AMS.selfTests.push({
    name: 'physio assesses Yash More: Reported → Assessment → Rehab stage 1', role: 'physio', fn: () => {
      const inj = openInjOf('Yash More'); must(inj && inj.status === 'Reported', 'Yash not Reported in seed');
      AMS.runAction('injury.startAssessment', { injuryId: inj.id });
      must(inj.status === 'Assessment', 'not moved to Assessment');
      AMS.runAction('injury.assess', { injuryId: inj.id, diagnosis: 'Grade 1 adductor longus strain', grade: 1, severity: 'minor', rtpTemplate: 'lower-muscle', expectedReturn: D.add(AMS.TODAY, 10), availability: 'Modified', note: 'Squeeze test 80% of other side.' });
      must(inj.status === 'Rehab' && inj.rtpStage === 0 && inj.stageSince === AMS.TODAY, 'assessment did not start rehab stage 1');
      must(!AMS.db.tasks.some((t) => t.status === 'Open' && t.athleteId === inj.athleteId && /^Assess/.test(t.title)), 'assess task still open');
      must(AMS.db.notifications.some((n) => n.toRole === 'coach' && n.athleteId === inj.athleteId && !/adductor longus/i.test(n.text)), 'coach notification missing or leaks diagnosis');
    },
  });
  AMS.selfTests.push({
    name: 'Rohan stage sign-off requires all criteria, then advances', role: 'physio', fn: () => {
      const inj = openInjOf('Rohan Gaikwad'); must(inj && inj.status === 'Rehab', 'Rohan not in rehab');
      const s0 = inj.rtpStage;
      AMS.runAction('injury.signStage', { injuryId: inj.id });
      must(inj.rtpStage === s0, 'signed without criteria');
      inj.rtpStages[s0].criteria.forEach((c, k) => { if (!c.met) AMS.runAction('injury.toggleCriterion', { injuryId: inj.id, index: k }); });
      AMS.runAction('injury.signStage', { injuryId: inj.id });
      must(inj.rtpStage === s0 + 1 && inj.stageSince === AMS.TODAY && inj.rtpStages[s0].signedBy, 'stage not advanced');
      must(inj.timeline[0].type === 'stage', 'timeline missing stage entry');
    },
  });
  AMS.selfTests.push({
    name: 'only the doctor can clear Kavya; clearance closes case with graded return', role: 'physio', fn: () => {
      const inj = openInjOf('Kavya Nair'); must(inj && inj.status === 'Clearance', 'Kavya not awaiting clearance');
      AMS.runAction('injury.clear', { injuryId: inj.id, conditions: 'test' });
      must(inj.status === 'Clearance', 'physio was able to clear');
      AMS.ui.role = 'doctor';
      AMS.runAction('injury.clear', { injuryId: inj.id, conditions: 'Graded return 3 weeks' });
      const a = ath(inj.athleteId);
      must(inj.status === 'Closed' && inj.closedOn === AMS.TODAY && inj.clearance && inj.clearance.by, 'not closed');
      must(a.availability === 'Available' && a.returnedOn === AMS.TODAY, 'athlete not returned');
      must(inj.gradedReturn && inj.gradedReturn.weeks.length === 3 && inj.gradedReturn.weeks[0].capAU < inj.gradedReturn.weeks[2].capAU, 'graded plan wrong');
      AMS.ui.role = 'coach';
      AMS.runAction('injury.applyGradedReturn', { injuryId: inj.id });
      must(inj.gradedReturn.applied && a.loadPlan && a.loadPlan.weeks.length === 3, 'graded plan not applied');
    },
  });
  AMS.selfTests.push({
    name: 'setback moves Aman back a stage and counts it', role: 'physio', fn: () => {
      const inj = openInjOf('Aman Shinde'); must(inj && inj.status === 'Rehab', 'Aman not in rehab');
      const s0 = inj.rtpStage, sb = inj.setbacks || 0;
      AMS.runAction('injury.setback', { injuryId: inj.id, reason: 'Calf tightness on jog, pain 4/10' });
      must(inj.rtpStage === Math.max(0, s0 - 1) && inj.setbacks === sb + 1 && inj.timeline[0].type === 'setback', 'setback not recorded');
    },
  });
  AMS.selfTests.push({
    name: 'coach reports Priya bilateral hamstring without changing availability', role: 'coach', fn: () => {
      const a = byName('Priya Deshmukh'); must(a, 'Priya missing');
      const before = a.availability, n = AMS.db.injuries.length;
      const id = AMS.runAction('injury.submit', { athleteId: a.id, region: 'hamstring', side: 'C', type: 'Tightness / niggle', severity: 'minor', mechanism: 'Both hamstrings tight after Sunday trial', pain: 3, path: 'case' });
      const inj = AMS.byId(AMS.db.injuries, id);
      must(AMS.db.injuries.length === n + 1 && inj && inj.status === 'Reported' && inj.side === 'C' && inj.view === 'back', 'report not created');
      must(a.availability === before, 'AI/report changed availability without a human choice');
      must(AMS.db.tasks.some((t) => t.ref === id && t.ownerRole === 'physio'), 'no physio task');
      must(AMS.db.notifications.some((x) => x.toRole === 'physio' && x.athleteId === a.id), 'physio not notified');
    },
  });
  AMS.selfTests.push({
    name: 'light-path flag → note → escalate to case', role: 'physio', fn: () => {
      const a = byName('Priya Deshmukh');
      const id = AMS.runAction('injury.flagLight', { athleteId: a.id, note: 'Both hamstrings tight after Sunday trial' });
      const inj = AMS.byId(AMS.db.injuries, id);
      must(inj && inj.status === 'Monitoring' && inj.path === 'light' && inj.region === 'hamstring', 'light flag not created');
      AMS.runAction('injury.addNote', { injuryId: id, text: 'Palpation: mild tone bilaterally, no focal tenderness.' });
      must(inj.notes[0].text.includes('Palpation'), 'note not saved');
      AMS.runAction('injury.escalateLight', { injuryId: id });
      must(inj.status === 'Assessment' && inj.path === 'case', 'not escalated');
    },
  });
  AMS.selfTests.push({
    name: 'disagreement escalated by physio is decided by the doctor', role: 'physio', fn: () => {
      const inj = openInjOf('Rohan Gaikwad');
      AMS.runAction('injury.escalate', { injuryId: inj.id, question: 'Progress to sprinting?', physioView: 'Nordic 0.81 < 0.85', coachView: 'Looked fine at 70%' });
      must(inj.decision && inj.decision.status === 'Pending', 'not escalated');
      AMS.runAction('injury.decide', { injuryId: inj.id, outcome: 'physio', rationale: 'no' });
      must(inj.decision.status === 'Pending', 'physio could decide');
      AMS.ui.role = 'doctor';
      AMS.runAction('injury.decide', { injuryId: inj.id, outcome: 'physio', rationale: 'Hold until Nordic ratio ≥ 0.85' });
      must(inj.decision.status === 'Decided' && inj.timeline[0].type === 'decision', 'decision not recorded');
    },
  });
  AMS.selfTests.push({
    name: 'detectors flag Yash unassessed, Kavya clearance and Priya preventive', role: 'physio', fn: () => {
      const ins = AMS.ai.insights();
      const yash = openInjOf('Yash More'), kav = openInjOf('Kavya Nair'), pr = byName('Priya Deshmukh');
      must(ins.some((i) => i.id === 'unassessed:' + yash.id), 'unassessed detector missing');
      must(ins.some((i) => i.id === 'clearance:' + kav.id), 'clearance detector missing');
      must(ins.some((i) => i.id === 'preventive:' + pr.id + ':' + AMS.TODAY), 'preventive detector missing for Priya (risk ' + C.risk(pr).score + ')');
    },
  });
})();
