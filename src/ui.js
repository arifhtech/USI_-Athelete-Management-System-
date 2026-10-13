/* USI · AMS — shared UI kit (window.UI). Pure presentational components + small hooks. */
(function () {
  'use strict';
  const AMS = window.AMS, React = window.React, html = AMS.html;
  const { useState, useEffect, useRef, useMemo, useCallback } = React;
  const UI = (window.UI = {});

  /* ------------------------------------------------------------------ hooks */
  UI.useWidth = function (ref, fallback) {
    const [w, setW] = useState(fallback || 600);
    useEffect(() => {
      if (!ref.current) return;
      const update = () => { if (ref.current) setW(ref.current.clientWidth || fallback || 600); };
      update();
      if (typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(update); ro.observe(ref.current);
      return () => ro.disconnect();
    }, []);
    return w;
  };
  UI.useClickOutside = function (ref, fn, active) {
    useEffect(() => {
      if (active === false) return;
      const h = (e) => { if (ref.current && !ref.current.contains(e.target)) fn(e); };
      document.addEventListener('mousedown', h);
      return () => document.removeEventListener('mousedown', h);
    }, [active]);
  };
  UI.useLocal = function (key, init) { // per-viewer remembered UI choice (tab, filter)
    const [v, setV] = useState(() => { try { const s = localStorage.getItem('ams-ui:' + key); return s != null ? JSON.parse(s) : init; } catch (e) { return init; } });
    const set = (x) => { setV(x); try { localStorage.setItem('ams-ui:' + key, JSON.stringify(x)); } catch (e) { } };
    return [v, set];
  };

  /* ------------------------------------------------------------------ icons (24×24 stroke) */
  const P = {
    dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    medical: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
    pulse: 'M22 12h-4l-3 9L9 3l-3 9H2',
    flask: 'M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3M7 15h10',
    apple: 'M12 7c-1.5-1-4-1.2-5.5.3C4.8 9 5 12.5 6.5 15.5 7.7 18 9.5 21 12 20c2.5 1 4.3-2 5.5-4.5 1.5-3 1.7-6.5 0-8.2-1.5-1.5-4-1.3-5.5-.3zM12 7c0-2 1-4 3-4',
    target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    chart: 'M3 3v18h18M7 16v-4M11 16V8M15 16v-6M19 16V5',
    sparkles: 'M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 2l.6 1.4L7 4l-1.4.6L5 6l-.6-1.4L3 4l1.4-.6z',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
    'chev-r': 'M9 18l6-6-6-6', 'chev-l': 'M15 18l-6-6 6-6', 'chev-d': 'M6 9l6 6 6-6', 'chev-u': 'M18 15l-6-6-6 6',
    x: 'M18 6L6 18M6 6l12 12', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', check: 'M20 6L9 17l-5-5',
    alert: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
    info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
    filter: 'M22 3H2l8 9.46V19l4 2v-8.54z',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
    tag: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'shield-check': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    more: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    'arrow-up': 'M12 19V5M5 12l7-7 7 7', 'arrow-down': 'M12 5v14M19 12l-7 7-7-7', 'arrow-r': 'M5 12h14M12 5l7 7-7 7',
    'trend-up': 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6', 'trend-down': 'M23 18l-9.5-9.5-5 5L1 6M17 18h6v-6',
    refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
    send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
    mic: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8',
    phone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 18h.01',
    pin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    droplet: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z',
    pill: 'M10.5 20.5a5 5 0 0 1-7-7l10-10a5 5 0 0 1 7 7zM8.5 8.5l7 7',
    scale: 'M12 3v18M5 21h14M6 8l-3 7a3 3 0 0 0 6 0zM18 8l-3 7a3 3 0 0 0 6 0zM6 8h12M12 3l-6 5M12 3l6 5',
    zap: 'M13 2L3 14h9l-1 8 10-12h-9z',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
    trash: 'M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-2.82-1.17l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.17l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
    layers: 'M12 2L2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
    watch: 'M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM12 9v3l1.5 1.5M16.51 17.35l-.35 3.83a2 2 0 0 1-2 1.82H9.83a2 2 0 0 1-2-1.82l-.35-3.83M7.49 6.65l.35-3.83A2 2 0 0 1 9.83 1h4.35a2 2 0 0 1 2 1.82l.35 3.83',
    run: 'M13 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 21l3-6 3 2v5M9 15l1-6 4 2 3 3M7 9l3-2 4 1',
    dumbbell: 'M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11',
    moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
    heart: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z',
    clipboard: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6v4H9zM9 12l2 2 4-4',
    external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    menu: 'M3 12h18M3 6h18M3 18h18',
    sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
    flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
    copy: 'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
    play: 'M5 3l14 9-14 9z', pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
    bolt: 'M13 2L3 14h9l-1 8 10-12h-9z',
    bed: 'M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9',
    gps: 'M12 2v3M12 19v3M2 12h3M19 12h3M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    building: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1',
    merge: 'M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21V9a9 9 0 0 0 9 9',
    swap: 'M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16',
    book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
    message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    whistle: 'M2 12a6 6 0 1 0 12 0 6 6 0 0 0-12 0zM14 12h8V8h-9M8 12h.01',
  };
  UI.Icon = function ({ name, size, stroke, style, className }) {
    const d = P[name] || P.info;
    const s = size || 16;
    return html`<svg width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth=${stroke || 1.8} strokeLinecap="round" strokeLinejoin="round" style=${style} className=${className} aria-hidden="true">${d.split('M').filter(Boolean).map((seg, i) => html`<path key=${i} d=${'M' + seg} />`)}</svg>`;
  };
  UI.ICONS = Object.keys(P);

  /* ------------------------------------------------------------------ basics */
  UI.Pill = ({ tone, dot, children, title, className }) => html`<span className=${AMS.cx('pill', tone, className)} title=${title}>${dot && html`<span className="dot" />`}${children}</span>`;
  UI.Tag = ({ children, onRemove }) => html`<span className="tag">${children}${onRemove && html`<button className="btn ghost xs icon" style=${{ height: 16, width: 16, marginRight: -4 }} onClick=${onRemove} aria-label="Remove tag"><${UI.Icon} name="x" size=${11} /></button>`}</span>`;
  UI.Dot = ({ tone }) => html`<span className=${'dot ' + (tone || 'neutral')} />`;
  UI.Avatar = function ({ name, size, hue }) {
    const s = size || 28;
    const h = hue != null ? hue : AMS.hue(name || '');
    return html`<span className="avatar" style=${{ width: s, height: s, fontSize: Math.round(s * 0.38), background: 'hsl(' + h + ' 42% 46%)' }} title=${name}>${AMS.initials(name)}</span>`;
  };
  UI.Meter = ({ value, max, tone, style }) => html`<div className=${'meter ' + (tone || '')} style=${style}><i style=${{ width: AMS.clamp(((value || 0) / (max || 100)) * 100, 0, 100) + '%' }} /></div>`;
  UI.Kbd = ({ children }) => html`<kbd style=${{ fontFamily: 'var(--font-mono)', fontSize: 10.5, padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border-strong)', color: 'var(--fg-3)', background: 'var(--surface-2)' }}>${children}</kbd>`;
  UI.Empty = ({ icon, title, children }) => html`<div className="empty"><${UI.Icon} name=${icon || 'info'} size=${22} /><div style=${{ fontWeight: 600, color: 'var(--fg-2)' }}>${title}</div>${children && html`<div className="small">${children}</div>`}</div>`;
  UI.Section = ({ title, hint, actions, children }) => html`<div className="col"><div className="row between"><h3>${title}${hint && html` <span className="faint small" style=${{ fontWeight: 400 }}>${hint}</span>`}</h3>${actions}</div>${children}</div>`;
  /** Card with header. props: title, icon, hint, actions, flush, ai, footer, className, style, id */
  UI.Card = function ({ title, icon, hint, actions, children, flush, ai, footer, className, style, bodyStyle }) {
    return html`<section className=${AMS.cx('card', ai && 'ai', className)} style=${style}>
      ${(title || actions) && html`<header className="card-h"><h3>${ai && html`<${UI.Icon} name="sparkles" size=${15} style=${{ color: 'var(--ai)' }} />`}${icon && !ai && html`<${UI.Icon} name=${icon} size=${15} style=${{ color: 'var(--fg-3)' }} />`}${title}${hint && html`<span className="hint">${hint}</span>`}</h3><div className="row tight">${actions}</div></header>`}
      <div className=${AMS.cx('card-b', flush && 'flush')} style=${bodyStyle}>${children}</div>
      ${footer && html`<footer className="card-f">${footer}</footer>`}
    </section>`;
  };
  /** KPI tile. props: label, value, unit, delta (number, %), deltaGood ('up'|'down'), foot, spark (number[]), sparkTone, onClick, icon, tone */
  UI.KPI = function ({ label, value, unit, delta, deltaGood, foot, spark, sparkTone, onClick, icon, tone, title }) {
    const dTone = delta == null ? null : (delta === 0 ? 'faint' : ((delta > 0) === ((deltaGood || 'up') === 'up') ? 'good' : 'bad'));
    return html`<div className=${AMS.cx('card kpi', onClick && 'clickable')} onClick=${onClick} role=${onClick ? 'button' : undefined} tabIndex=${onClick ? 0 : undefined} title=${title}>
      <div className="k-label">${icon && html`<${UI.Icon} name=${icon} size=${14} />`}${label}${onClick && html`<${UI.Icon} name="chev-r" size=${13} style=${{ marginLeft: 'auto', color: 'var(--fg-3)' }} />`}</div>
      <div className="row between" style=${{ alignItems: 'flex-end' }}>
        <div className=${AMS.cx('k-value', tone)}>${value}${unit && html`<small>${unit}</small>`}</div>
        ${spark && html`<${UI.Sparkline} data=${spark} width=${86} height=${30} tone=${sparkTone || 'accent'} />`}
      </div>
      <div className="k-foot">${delta != null && html`<span className=${dTone} style=${{ display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 600 }}><${UI.Icon} name=${delta >= 0 ? 'arrow-up' : 'arrow-down'} size=${11} />${Math.abs(delta)}%</span>`}${foot}</div>
    </div>`;
  };
  UI.Tabs = function ({ tabs, value, onChange, style }) {
    return html`<div className="tabs" role="tablist" style=${style}>${tabs.map((t) => html`<button key=${t.id} role="tab" aria-selected=${value === t.id} className=${AMS.cx('tab', value === t.id && 'active')} onClick=${() => onChange(t.id)}>${t.icon && html`<${UI.Icon} name=${t.icon} size=${14} />`}${t.label}${t.count != null && html`<span className="count">${t.count}</span>`}</button>`)}</div>`;
  };
  UI.Seg = function ({ options, value, onChange, size }) {
    return html`<div className="seg" role="group">${options.map((o) => { const id = typeof o === 'string' ? o : o.id; const label = typeof o === 'string' ? o : o.label; return html`<button key=${id} className=${value === id ? 'active' : ''} onClick=${() => onChange(id)} style=${size === 'sm' ? { padding: '3px 8px', fontSize: 11.5 } : null}>${label}</button>`; })}</div>`;
  };
  UI.Toggle = function ({ checked, onChange, label, id }) {
    return html`<label className="row tight clickable" style=${{ cursor: 'pointer', userSelect: 'none', background: 'none' }} htmlFor=${id}>
      <span style=${{ position: 'relative', width: 32, height: 18, borderRadius: 10, background: checked ? 'var(--accent)' : 'var(--border-strong)', transition: 'background .15s', flex: 'none' }}>
        <span style=${{ position: 'absolute', top: 2, left: checked ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.3)' }} />
      </span>
      <input id=${id} type="checkbox" checked=${!!checked} onChange=${(e) => onChange(e.target.checked)} style=${{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
      ${label && html`<span className="small">${label}</span>`}
    </label>`;
  };
  UI.Field = ({ label, help, children, style }) => html`<div className="field" style=${style}>${label && html`<label>${label}</label>`}${children}${help && html`<span className="help">${help}</span>`}</div>`;
  UI.Select = function ({ value, onChange, options, id, style, placeholder }) {
    return html`<select id=${id} className="select" value=${value == null ? '' : value} onChange=${(e) => onChange(e.target.value)} style=${style}>
      ${placeholder && html`<option value="">${placeholder}</option>`}
      ${options.map((o) => { const v = typeof o === 'object' ? o.value : o; const l = typeof o === 'object' ? o.label : o; return html`<option key=${v} value=${v}>${l}</option>`; })}
    </select>`;
  };
  UI.Search = ({ value, onChange, placeholder, id, style }) => html`<div className="search" style=${style}><${UI.Icon} name="search" size=${14} /><input id=${id} className="input" value=${value} onChange=${(e) => onChange(e.target.value)} placeholder=${placeholder || 'Search'} /></div>`;
  /** Label/value list. items: [[label, value], ...] */
  UI.DL = ({ items, cols }) => html`<div className="grid" style=${{ gridTemplateColumns: 'repeat(' + (cols || 2) + ', minmax(0,1fr))', gap: '10px 16px' }}>${items.filter(Boolean).map(([k, v], i) => html`<div key=${i} className="col tight" style=${{ gap: 2 }}><span className="upper">${k}</span><span style=${{ minWidth: 0, overflowWrap: 'anywhere' }}>${v == null || v === '' ? '—' : v}</span></div>`)}</div>`;
  UI.Stepper = function ({ steps, current, blocked, onStep }) {
    return html`<div className="stepper">${steps.map((s, i) => { const st = i < current ? 'done' : i === current ? (blocked ? 'blocked' : 'current') : ''; const label = typeof s === 'string' ? s : s.label; return html`<div key=${i} className=${'step ' + st} onClick=${onStep ? () => onStep(i) : undefined} style=${onStep ? { cursor: 'pointer' } : null}><span className="s-dot">${i < current ? html`<${UI.Icon} name="check" size=${13} stroke=${3} />` : i + 1}</span><span>${label}</span>${s.sub && html`<span className="tiny faint" style=${{ fontWeight: 400 }}>${s.sub}</span>`}</div>`; })}</div>`;
  };
  /** Vertical timeline. items: [{ date, title, text, tone, icon, by }] */
  UI.Timeline = function ({ items }) {
    return html`<div className="col" style=${{ gap: 0 }}>${items.map((it, i) => html`<div key=${i} className="row top" style=${{ gap: 12, paddingBottom: 14, position: 'relative' }}>
      <div style=${{ position: 'relative', flex: 'none', width: 26, display: 'flex', justifyContent: 'center' }}>
        ${i < items.length - 1 && html`<span style=${{ position: 'absolute', top: 24, bottom: -14, width: 2, background: 'var(--border)' }} />`}
        <span style=${{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', background: it.tone ? 'var(--' + it.tone + '-weak)' : 'var(--surface-3)', color: it.tone ? 'var(--' + it.tone + ')' : 'var(--fg-2)', zIndex: 1 }}><${UI.Icon} name=${it.icon || 'clock'} size=${13} /></span>
      </div>
      <div className="col tight grow" style=${{ gap: 2, paddingTop: 3 }}>
        <div className="row between" style=${{ gap: 8 }}><span style=${{ fontWeight: 600, fontSize: 13 }}>${it.title}</span><span className="tiny faint" style=${{ whiteSpace: 'nowrap' }}>${it.date}</span></div>
        ${it.text && html`<div className="small muted">${it.text}</div>`}
        ${it.by && html`<div className="tiny faint">${it.by}</div>`}
      </div>
    </div>`)}</div>`;
  };

  /* ------------------------------------------------------------------ athlete-specific */
  UI.Ring = function ({ value, size, tone, label, thickness }) {
    const s = size || 40, t = thickness || 4, r = (s - t) / 2, c = 2 * Math.PI * r;
    const v = AMS.clamp(value || 0, 0, 100);
    return html`<span style=${{ position: 'relative', width: s, height: s, display: 'inline-grid', placeItems: 'center', flex: 'none' }} title=${label}>
      <svg width=${s} height=${s} style=${{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}><circle cx=${s / 2} cy=${s / 2} r=${r} fill="none" stroke="var(--surface-3)" strokeWidth=${t} /><circle cx=${s / 2} cy=${s / 2} r=${r} fill="none" stroke=${'var(--' + (tone || 'accent') + ')'} strokeWidth=${t} strokeDasharray=${c} strokeDashoffset=${c * (1 - v / 100)} strokeLinecap="round" style=${{ transition: 'stroke-dashoffset .5s' }} /></svg>
      <span className="num" style=${{ fontSize: Math.round(s * 0.36), fontWeight: 600, lineHeight: 1 }}>${value == null ? '—' : value}</span>
    </span>`;
  };
  UI.Readiness = function ({ athlete, size, showLabel }) {
    const r = AMS.calc.readiness(athlete);
    return html`<span className="row tight" style=${{ gap: 8 }} title=${r.factors.map((f) => f.label + ': ' + f.value).join('\n') || 'No flags'}>
      <${UI.Ring} value=${r.score} tone=${r.band} size=${size || 34} />
      ${showLabel && html`<span className="col tight" style=${{ gap: 0 }}><span className=${r.band} style=${{ fontWeight: 600, fontSize: 12 }}>${AMS.calc.bandLabel(r.band)}</span><span className="tiny faint">${r.checkedIn ? 'checked in' : 'no check-in'}</span></span>`}
    </span>`;
  };
  UI.AvailabilityPill = function ({ value }) {
    const tone = { Available: 'good', Modified: 'warn', Unavailable: 'bad' }[value] || 'neutral';
    return html`<${UI.Pill} tone=${tone} dot>${value}<//>`;
  };
  UI.EnrollmentPill = function ({ value }) {
    const tone = { Active: 'accent', Prospect: 'info', Applied: 'info', Verifying: 'warn', Transferred: '', Inactive: '', Retired: '' }[value];
    return html`<${UI.Pill} tone=${tone} className=${tone ? '' : 'outline'}>${value}<//>`;
  };
  /** Name + squad cell; clicking opens the athlete drawer. */
  UI.AthleteCell = function ({ athlete, sub, size, noLink }) {
    const a = athlete; if (!a) return null;
    const sq = AMS.org.squad(a.squadId);
    return html`<span className="row tight" style=${{ gap: 10, minWidth: 0, cursor: noLink ? 'default' : 'pointer' }} onClick=${noLink ? undefined : (e) => { e.stopPropagation(); AMS.openAthlete(a.id); }}>
      <${UI.Avatar} name=${a.name} size=${size || 30} />
      <span className="col tight" style=${{ gap: 0, minWidth: 0 }}><span className="ellipsis" style=${{ fontWeight: 600 }}>${a.name}</span><span className="tiny faint ellipsis">${sub != null ? sub : (sq ? sq.name + ' · ' + AMS.org.centre(a.centreId).short : '')}</span></span>
    </span>`;
  };
  UI.AcwrPill = function ({ athlete, value }) {
    const r = value != null ? value : AMS.calc.acwr(athlete);
    return html`<${UI.Pill} tone=${AMS.calc.acwrBand(r)} title=${AMS.calc.acwrLabel(r) + ' — acute:chronic workload ratio'}>${r.toFixed(2)}<//>`;
  };

  /* ------------------------------------------------------------------ table */
  /** columns: [{ key, label, render(row), num, width, sort(row)→value, hideSm }] */
  UI.Table = function ({ columns, rows, onRow, selectedId, empty, compact, maxHeight, rowKey, initialSort }) {
    const [sort, setSort] = useState(initialSort || null);
    const sorted = useMemo(() => {
      if (!sort) return rows;
      const col = columns.find((c) => c.key === sort.key);
      if (!col) return rows;
      const f = col.sort || ((r) => r[col.key]);
      return rows.slice().sort((a, b) => { const x = f(a), y = f(b); return (x > y ? 1 : x < y ? -1 : 0) * (sort.dir === 'desc' ? -1 : 1); });
    }, [rows, sort]);
    return html`<div className="tbl-wrap" style=${maxHeight ? { maxHeight, overflowY: 'auto' } : null}>
      <table className=${AMS.cx('tbl', compact && 'compact')}>
        <thead><tr>${columns.map((c) => html`<th key=${c.key} className=${AMS.cx(c.num && 'num', c.hideSm && 'hide-sm')} style=${{ width: c.width, cursor: c.sort !== false ? 'pointer' : 'default' }} onClick=${() => c.sort !== false && setSort((s) => ({ key: c.key, dir: s && s.key === c.key && s.dir === 'asc' ? 'desc' : 'asc' }))}>${c.label}${sort && sort.key === c.key && html` <${UI.Icon} name=${sort.dir === 'asc' ? 'arrow-up' : 'arrow-down'} size=${10} />`}</th>`)}</tr></thead>
        <tbody>
          ${sorted.length === 0 && html`<tr><td colSpan=${columns.length}><${UI.Empty} icon="search" title=${empty || 'Nothing here'} /></td></tr>`}
          ${sorted.map((r, i) => html`<tr key=${rowKey ? rowKey(r) : r.id || i} className=${AMS.cx(onRow && 'clickable', selectedId && r.id === selectedId && 'selected')} onClick=${onRow ? () => onRow(r) : undefined} style=${onRow ? { cursor: 'pointer' } : null}>
            ${columns.map((c) => html`<td key=${c.key} className=${AMS.cx(c.num && 'num', c.hideSm && 'hide-sm')}>${c.render ? c.render(r) : r[c.key]}</td>`)}
          </tr>`)}
        </tbody>
      </table>
    </div>`;
  };

  /* ------------------------------------------------------------------ overlays */
  UI.DrawerHead = function ({ title, sub, avatar, actions, children }) {
    return html`<header className="drawer-h">
      ${avatar}
      <div className="col tight grow" style=${{ gap: 2 }}><h2 style=${{ fontSize: 17 }}>${title}</h2>${sub && html`<div className="small muted">${sub}</div>`}${children}</div>
      <div className="row tight">${actions}<button className="btn ghost icon" onClick=${AMS.closeDrawer} aria-label="Close"><${UI.Icon} name="x" /></button></div>
    </header>`;
  };
  UI.ModalFrame = function ({ title, sub, children, footer, wide, icon }) {
    return html`<div className=${AMS.cx('modal', wide && 'wide')} role="dialog" aria-modal="true" onClick=${(e) => e.stopPropagation()}>
      <header className="modal-h">${icon && html`<span style=${{ width: 34, height: 34, borderRadius: 8, background: 'var(--accent-weak)', color: 'var(--accent)', display: 'grid', placeItems: 'center', flex: 'none' }}><${UI.Icon} name=${icon} size=${17} /></span>`}<div className="col tight grow" style=${{ gap: 2 }}><h2>${title}</h2>${sub && html`<div className="small muted">${sub}</div>`}</div><button className="btn ghost icon" onClick=${AMS.closeModal} aria-label="Close"><${UI.Icon} name="x" /></button></header>
      <div className="modal-b">${children}</div>
      ${footer && html`<footer className="modal-f">${footer}</footer>`}
    </div>`;
  };
  /** Inline two-step confirm (window.confirm is unavailable in the viewer). */
  UI.ConfirmButton = function ({ label, confirmLabel, onConfirm, className, icon, disabled }) {
    const [armed, setArmed] = useState(false);
    useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3500); return () => clearTimeout(t); }, [armed]);
    return html`<button className=${AMS.cx('btn', armed ? 'danger' : '', className)} disabled=${disabled} onClick=${() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>${icon && html`<${UI.Icon} name=${icon} size=${14} />`}${armed ? (confirmLabel || 'Click again to confirm') : label}</button>`;
  };
  /** Small dropdown menu. items: [{ label, icon, onClick, danger, sub }] */
  UI.Menu = function ({ trigger, items, align }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    UI.useClickOutside(ref, () => setOpen(false), open);
    return html`<span ref=${ref} style=${{ position: 'relative', display: 'inline-flex' }}>
      <span onClick=${() => setOpen(!open)}>${trigger || html`<button className="btn ghost sm icon" aria-label="More"><${UI.Icon} name="more" /></button>`}</span>
      ${open && html`<div className="popover" style=${{ top: '100%', marginTop: 4, [align === 'left' ? 'left' : 'right']: 0 }}>${items.filter(Boolean).map((it, i) => html`<button key=${i} className="menu-item" style=${it.danger ? { color: 'var(--bad)' } : null} onClick=${() => { setOpen(false); it.onClick && it.onClick(); }}>${it.icon && html`<${UI.Icon} name=${it.icon} size=${14} />`}${it.label}${it.sub && html`<span className="faint small">${it.sub}</span>`}</button>`)}</div>`}
    </span>`;
  };

  /* ------------------------------------------------------------------ AI surfaces */
  UI.AIChip = ({ label }) => html`<span className="ai-chip"><${UI.Icon} name="sparkles" size=${12} />${label || 'AI'}</span>`;
  UI.Evidence = ({ items }) => html`<div className="i-why">${(items || []).map((e, i) => html`<span key=${i} className="evidence"><span className=${'dot ' + (e.tone || 'neutral')} style=${{ width: 6, height: 6 }} />${e.label} <b>${e.value}</b></span>`)}</div>`;
  /** One AI insight with explainable evidence and one-tap actions. */
  UI.Insight = function ({ insight, compact, onDone }) {
    const i = insight;
    const [busy, setBusy] = useState(false);
    const tone = { high: 'bad', med: 'warn', low: 'info' }[i.severity];
    const sevLabel = { high: 'High', med: 'Medium', low: 'Low' }[i.severity];
    return html`<div className=${'insight sev-stripe ' + tone}>
      <div className="row between top" style=${{ gap: 8 }}>
        <div className="col tight" style=${{ gap: 3, minWidth: 0 }}>
          <div className="row tight wrap"><${UI.AIChip} label=${({ risk: 'Predictive risk', medical: 'Medical', ops: 'Operations', training: 'Training', nutrition: 'Nutrition', talent: 'Talent', wellness: 'Wellness' }[i.kind] || 'Insight')} /><span className=${'pill ' + tone} style=${{ height: 18, fontSize: 10.5 }}>${sevLabel}</span>${i.confidence != null && html`<span className="tiny faint">${Math.round(i.confidence * 100)}% confidence</span>`}</div>
          <div className="i-title">${i.title}</div>
        </div>
        <${UI.Menu} items=${[{ label: 'Not relevant — dismiss', icon: 'x', onClick: () => AMS.ai.dismiss(i, 'Not relevant') }, { label: 'Snooze until tomorrow', icon: 'clock', onClick: () => AMS.ai.dismiss(i, 'Snoozed') }, (i.athleteIds || []).length === 1 && { label: 'Open athlete', icon: 'user', onClick: () => AMS.openAthlete(i.athleteIds[0]) }]} />
      </div>
      ${!compact && html`<div className="small muted">${i.summary}</div>`}
      <${UI.Evidence} items=${i.evidence} />
      ${(i.actions || []).length > 0 && html`<div className="row tight wrap">${i.actions.map((a, k) => html`<button key=${k} disabled=${busy} className=${AMS.cx('btn sm', a.primary ? 'ai' : '')} onClick=${() => { setBusy(true); AMS.ai.act(i, a); onDone && onDone(a); }}>${a.primary && html`<${UI.Icon} name="zap" size=${13} />`}${a.label}</button>`)}</div>`}
    </div>`;
  };
  UI.InsightList = function ({ insights, empty, compact, max }) {
    const list = max ? insights.slice(0, max) : insights;
    if (!list.length) return html`<${UI.Empty} icon="sparkles" title=${empty || 'All clear'}>No AI flags need attention in this view.<//>`;
    return html`<div className="list">${list.map((i) => html`<${UI.Insight} key=${i.id} insight=${i} compact=${compact} />`)}</div>`;
  };
  /** "Ask Copilot" chip that opens the copilot with a prompt. */
  UI.AskCopilot = ({ prompt, label }) => html`<button className="btn sm" style=${{ borderColor: 'var(--ai-border)', color: 'var(--ai)' }} onClick=${() => AMS.copilot && AMS.copilot.ask(prompt)}><${UI.Icon} name="sparkles" size=${13} />${label || prompt}</button>`;

  /* ------------------------------------------------------------------ charts (SVG, theme-token coloured) */
  const col = (tone) => (!tone ? 'var(--accent)' : tone.startsWith('#') || tone.startsWith('var(') || tone.startsWith('hsl') ? tone : 'var(--' + tone + ')');
  UI.color = col;
  UI.CAT = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)', 'var(--cat-5)', 'var(--cat-6)'];
  const niceTicks = (min, max, n) => {
    const span = max - min || 1; const step0 = span / (n || 4); const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0;
    const out = []; for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(AMS.round(v, 6));
    return out;
  };
  UI.niceTicks = niceTicks;
  UI.Sparkline = function ({ data, width, height, tone, area, showLast }) {
    const w = width || 100, h = height || 28, d = (data || []).map((v) => (v == null ? null : +v));
    const vals = d.filter((v) => v != null); if (vals.length < 2) return html`<svg width=${w} height=${h} />`;
    const mn = Math.min(...vals), mx = Math.max(...vals), span = mx - mn || 1;
    const pts = d.map((v, i) => (v == null ? null : [(i / (d.length - 1)) * (w - 4) + 2, h - 3 - ((v - mn) / span) * (h - 6)])).filter(Boolean);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const last = pts[pts.length - 1];
    return html`<svg width=${w} height=${h} className="chart" style=${{ overflow: 'visible', flex: 'none' }}>
      ${area !== false && html`<path d=${line + ' L' + last[0] + ' ' + h + ' L' + pts[0][0] + ' ' + h + ' Z'} fill=${col(tone)} opacity="0.12" />`}
      <path d=${line} fill="none" stroke=${col(tone)} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      ${showLast !== false && html`<circle cx=${last[0]} cy=${last[1]} r="2.6" fill=${col(tone)} />`}
    </svg>`;
  };
  /** Multi-series line chart.
      series: [{ name, data: [{ x (label/string), y }], tone, dashed, area, width }]
      bands: [{ from, to, tone, label }]  refs: [{ y, label, tone }]  yMin/yMax optional, height, yFormat(v) */
  UI.LineChart = function ({ series, height, yMin, yMax, bands, refs, yFormat, xEvery, legend, onPoint, markers }) {
    const ref = useRef(null);
    const W = UI.useWidth(ref, 560), H = height || 200;
    const [hover, setHover] = useState(null);
    const pad = { l: 38, r: 12, t: 10, b: 24 };
    const n = Math.max(...series.map((s) => s.data.length), 1);
    const all = series.flatMap((s) => s.data.map((p) => p.y)).filter((v) => v != null);
    let lo = yMin != null ? yMin : Math.min(...all, ...(bands || []).map((b) => b.from), ...(refs || []).map((r) => r.y));
    let hi = yMax != null ? yMax : Math.max(...all, ...(bands || []).map((b) => b.to), ...(refs || []).map((r) => r.y));
    if (yMin == null) lo = lo - (hi - lo) * 0.08; if (yMax == null) hi = hi + (hi - lo) * 0.08; if (hi === lo) hi = lo + 1;
    const ticks = niceTicks(lo, hi, 4).filter((t) => t >= lo && t <= hi);
    const X = (i) => pad.l + (n === 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r));
    const Y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
    const xs = series[0] ? series[0].data.map((p) => p.x) : [];
    const every = xEvery || Math.ceil(n / Math.max(2, Math.floor((W - 60) / 64)));
    const fmt = yFormat || ((v) => (Math.abs(v) >= 1000 ? AMS.round(v / 1000, 1) + 'k' : AMS.round(v, 2)));
    const onMove = (e) => { const r = ref.current.getBoundingClientRect(); const x = e.clientX - r.left; const i = AMS.clamp(Math.round(((x - pad.l) / (W - pad.l - pad.r)) * (n - 1)), 0, n - 1); setHover(i); };
    return html`<div className="col tight" style=${{ gap: 6 }}>
      ${legend !== false && series.length > 1 && html`<div className="legend">${series.map((s, i) => html`<span key=${i}><i style=${{ background: col(s.tone || UI.CAT[i]) }} />${s.name}</span>`)}${(bands || []).filter((b) => b.label).map((b, i) => html`<span key=${'b' + i}><i style=${{ background: col(b.tone), opacity: 0.25 }} />${b.label}</span>`)}</div>`}
      <div ref=${ref} style=${{ position: 'relative', width: '100%' }} onMouseMove=${onMove} onMouseLeave=${() => setHover(null)} onClick=${() => hover != null && onPoint && onPoint(hover)}>
        <svg width=${W} height=${H} className="chart" style=${{ display: 'block' }}>
          ${(bands || []).map((b, i) => html`<rect key=${'band' + i} x=${pad.l} width=${Math.max(0, W - pad.l - pad.r)} y=${Y(Math.min(b.to, hi))} height=${Math.max(0, Y(Math.max(b.from, lo)) - Y(Math.min(b.to, hi)))} fill=${col(b.tone)} opacity="0.09" />`)}
          ${ticks.map((t) => html`<g key=${'t' + t}><line className="grid-line" x1=${pad.l} x2=${W - pad.r} y1=${Y(t)} y2=${Y(t)} /><text x=${pad.l - 6} y=${Y(t) + 3.5} textAnchor="end">${fmt(t)}</text></g>`)}
          ${xs.map((x, i) => (i % every === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= every * 0.6) ? html`<text key=${'x' + i} x=${X(i)} y=${H - 6} textAnchor=${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>${x}</text>` : null)}
          ${(refs || []).map((r, i) => html`<g key=${'r' + i}><line x1=${pad.l} x2=${W - pad.r} y1=${Y(r.y)} y2=${Y(r.y)} stroke=${col(r.tone || 'fg-3')} strokeDasharray="4 4" strokeWidth="1" /><text x=${W - pad.r} y=${Y(r.y) - 4} textAnchor="end" style=${{ fill: col(r.tone || 'fg-3') }}>${r.label}</text></g>`)}
          ${(markers || []).map((m, i) => html`<g key=${'m' + i}><line x1=${X(m.i)} x2=${X(m.i)} y1=${pad.t} y2=${H - pad.b} stroke=${col(m.tone || 'fg-3')} strokeDasharray="2 3" /><text x=${X(m.i) + 4} y=${pad.t + 9} style=${{ fill: col(m.tone || 'fg-3') }}>${m.label}</text></g>`)}
          ${series.map((s, si) => {
            const c = col(s.tone || UI.CAT[si]);
            const pts = s.data.map((p, i) => (p.y == null ? null : [X(i), Y(p.y)]));
            let d = ''; pts.forEach((p, i) => { if (!p) return; d += (i && pts[i - 1] ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ' '; });
            const valid = pts.filter(Boolean);
            return html`<g key=${'s' + si}>
              ${s.area && valid.length > 1 && html`<path d=${d + 'L' + valid[valid.length - 1][0] + ' ' + (H - pad.b) + ' L' + valid[0][0] + ' ' + (H - pad.b) + ' Z'} fill=${c} opacity="0.1" />`}
              <path d=${d} fill="none" stroke=${c} strokeWidth=${s.width || 2} strokeDasharray=${s.dashed ? '5 4' : null} strokeLinejoin="round" strokeLinecap="round" />
              ${valid.length > 0 && html`<circle cx=${valid[valid.length - 1][0]} cy=${valid[valid.length - 1][1]} r="3.2" fill=${c} />`}
              ${hover != null && pts[hover] && html`<circle cx=${pts[hover][0]} cy=${pts[hover][1]} r="4" fill="var(--surface)" stroke=${c} strokeWidth="2" />`}
            </g>`;
          })}
          ${hover != null && html`<line x1=${X(hover)} x2=${X(hover)} y1=${pad.t} y2=${H - pad.b} stroke="var(--border-strong)" strokeWidth="1" />`}
        </svg>
        ${hover != null && html`<div className="chart-tip" style=${{ left: AMS.clamp(X(hover), 70, W - 70), top: pad.t + 8 }}><b>${xs[hover]}</b>${series.map((s, i) => s.data[hover] && s.data[hover].y != null ? html`<div key=${i}>${s.name}: ${typeof s.data[hover].y === 'number' ? fmt(s.data[hover].y) : s.data[hover].y}</div>` : null)}</div>`}
      </div>
    </div>`;
  };
  /** Vertical bar chart. data: [{ label, value } | { label, values:[..] }], keys: [{ name, tone }] for stacked/grouped. */
  UI.BarChart = function ({ data, keys, height, stacked, onBar, yFormat, highlight, refY, refLabel, tone }) {
    const ref = useRef(null);
    const W = UI.useWidth(ref, 560), H = height || 200;
    const [hover, setHover] = useState(null);
    const pad = { l: 38, r: 8, t: 10, b: 26 };
    const ks = keys || [{ name: 'Value', tone: tone || 'accent' }];
    const vals = data.map((d) => d.values || [d.value]);
    const hi0 = Math.max(...vals.map((v) => (stacked ? AMS.sum(v) : Math.max(...v))), refY || 0, 1);
    const ticks = niceTicks(0, hi0 * 1.05, 4); const hi = Math.max(ticks[ticks.length - 1], hi0);
    const bw = (W - pad.l - pad.r) / data.length;
    const Y = (v) => pad.t + (1 - v / hi) * (H - pad.t - pad.b);
    const fmt = yFormat || ((v) => (v >= 1000 ? AMS.round(v / 1000, 1) + 'k' : AMS.round(v, 1)));
    const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor((W - 50) / 52)));
    return html`<div className="col tight" style=${{ gap: 6 }}>
      ${ks.length > 1 && html`<div className="legend">${ks.map((k, i) => html`<span key=${i}><i style=${{ background: col(k.tone || UI.CAT[i]) }} />${k.name}</span>`)}</div>`}
      <div ref=${ref} style=${{ position: 'relative' }}>
        <svg width=${W} height=${H} className="chart" style=${{ display: 'block' }}>
          ${ticks.map((t) => html`<g key=${t}><line className="grid-line" x1=${pad.l} x2=${W - pad.r} y1=${Y(t)} y2=${Y(t)} /><text x=${pad.l - 6} y=${Y(t) + 3.5} textAnchor="end">${fmt(t)}</text></g>`)}
          ${data.map((d, i) => {
            const v = vals[i]; const x0 = pad.l + i * bw; const inner = Math.min(bw * 0.68, 46); const gx = x0 + (bw - inner) / 2;
            let acc = 0;
            const dim = highlight != null && highlight !== i;
            return html`<g key=${i} onMouseEnter=${() => setHover(i)} onMouseLeave=${() => setHover(null)} onClick=${() => onBar && onBar(d, i)} style=${{ cursor: onBar ? 'pointer' : 'default' }} opacity=${dim ? 0.45 : 1}>
              <rect x=${x0} y=${pad.t} width=${bw} height=${H - pad.t - pad.b} fill="transparent" />
              ${v.map((val, k) => {
                if (stacked) { const y1 = Y(acc + val), y0 = Y(acc); acc += val; return html`<rect key=${k} x=${gx} y=${y1} width=${inner} height=${Math.max(0, y0 - y1)} fill=${col(d.tones ? d.tones[k] : ks[k] && ks[k].tone || UI.CAT[k])} rx=${k === v.length - 1 ? 2 : 0} />`; }
                const w2 = inner / v.length; return html`<rect key=${k} x=${gx + k * w2} y=${Y(val)} width=${Math.max(1, w2 - 1)} height=${Math.max(0, H - pad.b - Y(val))} fill=${col(d.tone || (ks[k] && ks[k].tone) || UI.CAT[k])} rx="2" />`;
              })}
              ${(i % labelEvery === 0) && html`<text x=${x0 + bw / 2} y=${H - 8} textAnchor="middle">${d.label}</text>`}
            </g>`;
          })}
          ${refY != null && html`<g><line x1=${pad.l} x2=${W - pad.r} y1=${Y(refY)} y2=${Y(refY)} stroke="var(--fg-3)" strokeDasharray="4 4" /><text x=${W - pad.r} y=${Y(refY) - 4} textAnchor="end">${refLabel}</text></g>`}
        </svg>
        ${hover != null && html`<div className="chart-tip" style=${{ left: AMS.clamp(pad.l + hover * bw + bw / 2, 60, W - 60), top: Y(stacked ? AMS.sum(vals[hover]) : Math.max(...vals[hover])) }}><b>${data[hover].label}</b>${vals[hover].map((v, k) => html`<div key=${k}>${ks[k] ? ks[k].name : ''}: ${fmt(v)}</div>`)}</div>`}
      </div>
    </div>`;
  };
  /** Horizontal bars — ranked lists. data: [{ label, value, tone, sub, onClick }] */
  UI.HBars = function ({ data, max, format, labelWidth }) {
    const m = max || Math.max(...data.map((d) => d.value), 1);
    return html`<div className="col" style=${{ gap: 8 }}>${data.map((d, i) => html`<div key=${i} className=${AMS.cx('row', d.onClick && 'clickable')} style=${{ gap: 10, borderRadius: 4, padding: '2px 0' }} onClick=${d.onClick}>
      <span className="ellipsis small" style=${{ width: labelWidth || 130, flex: 'none' }} title=${d.label}>${d.label}${d.sub && html`<span className="faint"> · ${d.sub}</span>`}</span>
      <span className="grow" style=${{ height: 10, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}><span style=${{ display: 'block', height: '100%', width: (d.value / m) * 100 + '%', background: col(d.tone), borderRadius: 3, transition: 'width .4s' }} /></span>
      <span className="small tnum" style=${{ width: 54, textAlign: 'right', fontWeight: 600 }}>${format ? format(d.value) : d.value}</span>
    </div>`)}</div>`;
  };
  /** Donut. data: [{ label, value, tone }], center: node */
  UI.Donut = function ({ data, size, thickness, center, onSlice }) {
    const s = size || 120, t = thickness || 16, r = (s - t) / 2, c = 2 * Math.PI * r;
    const total = AMS.sum(data.map((d) => d.value)) || 1;
    let acc = 0;
    return html`<span style=${{ position: 'relative', width: s, height: s, display: 'inline-grid', placeItems: 'center', flex: 'none' }}>
      <svg width=${s} height=${s} style=${{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx=${s / 2} cy=${s / 2} r=${r} fill="none" stroke="var(--surface-3)" strokeWidth=${t} />
        ${data.map((d, i) => { const len = (d.value / total) * c; const el = html`<circle key=${i} cx=${s / 2} cy=${s / 2} r=${r} fill="none" stroke=${col(d.tone || UI.CAT[i])} strokeWidth=${t} strokeDasharray=${Math.max(0, len - 1.5) + ' ' + c} strokeDashoffset=${-acc} style=${{ cursor: onSlice ? 'pointer' : 'default' }} onClick=${() => onSlice && onSlice(d)}><title>${d.label}: ${d.value}</title></circle>`; acc += len; return el; })}
      </svg>
      <span style=${{ textAlign: 'center', lineHeight: 1.1 }}>${center}</span>
    </span>`;
  };
  /** Radar (talent profile). axes: [{ label, value 0–100, compare? 0–100 }] */
  UI.Radar = function ({ axes, size, tone, compareTone, compareLabel, label }) {
    const s = size || 240, cx = s / 2, cy = s / 2, R0 = s / 2 - 34, n = axes.length;
    const pt = (i, v) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2; return [cx + Math.cos(a) * R0 * (v / 100), cy + Math.sin(a) * R0 * (v / 100)]; };
    const poly = (key) => axes.map((ax, i) => pt(i, ax[key] || 0).map((v) => v.toFixed(1)).join(',')).join(' ');
    const hasCmp = axes.some((a) => a.compare != null);
    return html`<div className="col tight" style=${{ alignItems: 'center', gap: 4 }}>
      <svg width=${s} height=${s} className="chart" style=${{ maxWidth: '100%' }} viewBox=${'0 0 ' + s + ' ' + s}>
        ${[25, 50, 75, 100].map((g) => html`<polygon key=${g} points=${axes.map((_, i) => pt(i, g).join(',')).join(' ')} fill="none" stroke="var(--chart-grid)" />`)}
        ${axes.map((ax, i) => { const [x, y] = pt(i, 100); const [lx, ly] = pt(i, 118); return html`<g key=${i}><line x1=${cx} y1=${cy} x2=${x} y2=${y} stroke="var(--chart-grid)" /><text x=${lx} y=${ly + 3} textAnchor="middle">${ax.label}</text></g>`; })}
        ${hasCmp && html`<polygon points=${poly('compare')} fill=${col(compareTone || 'fg-3')} fillOpacity="0.08" stroke=${col(compareTone || 'fg-3')} strokeDasharray="4 3" />`}
        <polygon points=${poly('value')} fill=${col(tone || 'accent')} fillOpacity="0.2" stroke=${col(tone || 'accent')} strokeWidth="2" />
        ${axes.map((ax, i) => { const [x, y] = pt(i, ax.value || 0); return html`<circle key=${i} cx=${x} cy=${y} r="3" fill=${col(tone || 'accent')}><title>${ax.label}: ${Math.round(ax.value)}</title></circle>`; })}
      </svg>
      ${(label || hasCmp) && html`<div className="legend"><span><i style=${{ background: col(tone || 'accent') }} />${label || 'Athlete'}</span>${hasCmp && html`<span><i style=${{ background: col(compareTone || 'fg-3'), opacity: 0.5 }} />${compareLabel || 'Benchmark'}</span>`}</div>`}
    </div>`;
  };
  /** Heat grid. rows: [{ label, onClick, cells: [{ v, tone, title, label }] }], cols: [labels] */
  UI.HeatGrid = function ({ rows, cols, cellW, labelW }) {
    const cw = cellW || 26;
    return html`<div className="tbl-wrap"><table style=${{ borderCollapse: 'separate', borderSpacing: 3, fontSize: 11.5 }}>
      <thead><tr><th style=${{ width: labelW || 150 }} />${cols.map((c, i) => html`<th key=${i} className="faint" style=${{ fontWeight: 500, fontSize: 10.5, width: cw, textAlign: 'center', whiteSpace: 'nowrap' }}>${c}</th>`)}</tr></thead>
      <tbody>${rows.map((r, ri) => html`<tr key=${ri}><td className=${AMS.cx('ellipsis', r.onClick && 'clickable')} style=${{ maxWidth: labelW || 150, paddingRight: 8, cursor: r.onClick ? 'pointer' : 'default' }} onClick=${r.onClick}>${r.label}</td>${r.cells.map((c, ci) => html`<td key=${ci} title=${c.title} style=${{ width: cw, height: 22, borderRadius: 3, textAlign: 'center', fontSize: 10.5, fontWeight: 600, background: c.tone ? 'var(--' + c.tone + '-weak)' : 'var(--surface-3)', color: c.tone ? 'var(--' + c.tone + ')' : 'var(--fg-3)', boxShadow: c.tone ? 'inset 0 0 0 1px color-mix(in srgb, var(--' + c.tone + ') 25%, transparent)' : 'none' }}>${c.label != null ? c.label : ''}</td>`)}</tr>`)}</tbody>
    </table></div>`;
  };
})();
