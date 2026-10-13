/* USI · AMS — application shell: sidebar, top bar (org ladder, role, search, alerts), overlays, live simulation, copilot host. */
(function () {
  'use strict';
  const AMS = window.AMS, UI = window.UI, React = window.React, html = AMS.html;
  const { useState, useEffect, useRef, useMemo } = React;
  const I = UI.Icon;

  const NAV_GROUPS = [
    { id: 'command', label: 'Command' },
    { id: 'people', label: 'Athletes' },
    { id: 'performance', label: 'Performance' },
    { id: 'health', label: 'Health' },
    { id: 'intelligence', label: 'Intelligence' },
    { id: 'mobile', label: 'Mobile' },
  ];
  const ROLE_HOME = { director: 'dashboard', coach: 'dashboard', physio: 'medical', doctor: 'medical', scientist: 'science', nutritionist: 'nutrition', ops: 'athletes', athlete: 'athlete-app' };

  /* ------------------------------------------------------------------ copilot API */
  AMS.copilot = {
    open: () => AMS.setUI({ copilot: Object.assign({}, AMS.ui.copilot, { open: true }) }),
    close: () => AMS.setUI({ copilot: Object.assign({}, AMS.ui.copilot, { open: false }) }),
    toggle: () => AMS.setUI({ copilot: Object.assign({}, AMS.ui.copilot, { open: !AMS.ui.copilot.open }) }),
    /** Open the copilot and submit a question on the user's behalf. */
    ask: (text) => AMS.setUI({ copilot: Object.assign({}, AMS.ui.copilot, { open: true, pending: { text, id: AMS.uid('Q') } }) }),
  };

  AMS.switchRole = function (role) {
    AMS.ui.role = role; AMS.ui.scope = {}; AMS.ui.drawers = []; AMS.ui.modal = null; AMS.ui.focus = {};
    AMS.go(ROLE_HOME[role] || 'dashboard');
    const me = AMS.me();
    AMS.toast('Now viewing as ' + (me ? me.name + ' · ' : '') + AMS.roleLabel(role), 'info');
  };

  /* ------------------------------------------------------------------ live simulation */
  let tickN = 0;
  function tick() {
    if (!AMS.ui.live || !AMS.db) return;
    tickN++;
    // clock: one simulated minute per tick
    const [h, m] = (AMS.ui.clock || AMS.NOW_TIME).split(':').map(Number);
    const t = h * 60 + m + 1;
    AMS.ui.clock = String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
    // check-ins trickle in (faster after a reminder)
    const R = AMS.rng(tickN * 7919);
    const pending = AMS.db.athletes.filter((a) => a.enrollment === 'Active' && !a.wellness[27]);
    const rate = AMS.db.meta.remindersSent ? 4 : 1;
    const done = AMS.db.athletes.filter((a) => a.enrollment === 'Active').length - pending.length;
    const total = AMS.db.athletes.filter((a) => a.enrollment === 'Active').length;
    if (pending.length && done / total < 0.93) {
      for (let k = 0; k < rate && pending.length; k++) {
        const a = pending.splice(Math.floor(R() * pending.length), 1)[0];
        const v = () => AMS.clamp(Math.round(a.wellBase + R.norm(0, 0.6)), 1, 5);
        a.wellness[27] = { sleep: v(), soreness: v(), mood: v(), stress: v(), energy: v(), sleepHrs: AMS.round(AMS.clamp(R.norm(7.5, 0.6), 5.5, 9.5), 1), at: AMS.ui.clock };
        if (k === 0 && tickN % 2 === 0) AMS.db.activity.unshift({ id: AMS.uid('ACT'), at: AMS.TODAY + 'T' + AMS.ui.clock, text: a.name + ' checked in — readiness ' + AMS.calc.readiness(a).score, by: a.name, role: 'athlete', athleteId: a.id, type: 'checkin' });
      }
    }
    AMS.tickFns.forEach((fn) => { try { fn(tickN); } catch (e) { console.error(e); } });
    AMS.setUI({});
  }

  /* ------------------------------------------------------------------ sidebar */
  function Sidebar() {
    const { ui } = AMS.useStore();
    const role = ui.role;
    const mods = AMS.modules.filter((m) => !m.roles || m.roles.includes(role));
    return html`<nav className="nav" aria-label="Modules">
      <div className="nav-brand"><div className="nav-logo">USI</div><div className="nav-brand-t"><b>Unified Sports Interface</b><span>Athlete Management</span></div></div>
      <div className="nav-scroll">
        ${NAV_GROUPS.map((g) => { const items = mods.filter((m) => (m.group || 'command') === g.id); if (!items.length) return null; return html`<div key=${g.id}>
          <div className="nav-group">${g.label}</div>
          ${items.map((m) => { let b = null; try { b = m.badge ? m.badge() : null; } catch (e) { b = null; } const bn = b && typeof b === 'object' ? b.n : b; return html`<button key=${m.id} className=${AMS.cx('nav-item', ui.route.module === m.id && 'active')} onClick=${() => AMS.go(m.id)} title=${m.label}>
            <${I} name=${m.icon || 'grid'} size=${17} /><span>${m.label}</span>${bn ? html`<span className=${AMS.cx('nav-badge', b && b.tone === 'bad' && 'bad')}>${bn}</span>` : null}
          </button>`; })}
        </div>`; })}
      </div>
      <div className="nav-foot">
        <button className="nav-item" onClick=${() => AMS.setUI({ navCollapsed: !ui.navCollapsed })} title="Collapse"><${I} name=${ui.navCollapsed ? 'chev-r' : 'chev-l'} size=${17} /><span>Collapse</span></button>
      </div>
    </nav>`;
  }

  /* ------------------------------------------------------------------ org ladder (scope) picker */
  function ScopePicker() {
    const { db, ui } = AMS.useStore();
    const [open, setOpen] = useState(null); // level being edited
    const ref = useRef(null);
    UI.useClickOutside(ref, () => setOpen(null), !!open);
    const eff = AMS.effectiveScope();
    const lock = eff.lock || {};
    if (lock.athleteId) return html`<div className="scope"><span className="scope-seg"><span className="scope-lock"><${I} name="lock" size=${12} /></span><b>${AMS.me().name}</b></span></div>`;
    const set = (patch) => { AMS.setUI({ scope: Object.assign({}, ui.scope, patch) }); setOpen(null); };
    const centres = db.org.centres.filter((c) => !eff.stateId || c.stateId === eff.stateId);
    const squadsAll = db.org.squads.filter((s) => (!eff.centreId || s.centreId === eff.centreId) && (!eff.stateId || AMS.org.centre(s.centreId).stateId === eff.stateId) && (!eff.sport || s.sport === eff.sport) && (!lock.squadIds || lock.squadIds.includes(s.id)));
    const sports = [...new Set(db.org.squads.filter((s) => (!eff.centreId || s.centreId === eff.centreId) && (!eff.stateId || AMS.org.centre(s.centreId).stateId === eff.stateId) && (!lock.squadIds || lock.squadIds.includes(s.id))).map((s) => s.sport))];
    const lockedCentre = !!lock.centreId;
    const segs = [
      { lvl: 'Federation', label: db.meta.tenantShort, locked: lockedCentre, clear: () => set({ stateId: null, centreId: null, sport: null, squadId: null }) },
      { lvl: 'State', key: 'stateId', label: eff.stateId ? AMS.org.state(eff.stateId).name : 'All states', locked: lockedCentre, options: [{ v: null, l: 'All states' }].concat(db.org.states.map((s) => ({ v: s.id, l: s.name, n: db.org.centres.filter((c) => c.stateId === s.id).length + ' centres' }))), on: (v) => set({ stateId: v, centreId: null, squadId: null }) },
      { lvl: 'Centre', key: 'centreId', label: eff.centreId ? AMS.org.centre(eff.centreId).short : 'All centres', locked: lockedCentre, options: [{ v: null, l: 'All centres' }].concat(centres.map((c) => ({ v: c.id, l: c.name, n: c.type }))), on: (v) => set({ centreId: v, stateId: v ? AMS.org.centre(v).stateId : ui.scope.stateId, squadId: null }) },
      { lvl: 'Sport', key: 'sport', label: eff.sport || 'All sports', options: [{ v: null, l: 'All sports' }].concat(sports.map((s) => ({ v: s, l: s }))), on: (v) => set({ sport: v, squadId: null }) },
      { lvl: 'Squad', key: 'squadId', label: eff.squadId ? AMS.org.squad(eff.squadId).name : (lock.squadIds ? 'Your squads' : 'All squads'), options: [{ v: null, l: lock.squadIds ? 'All your squads' : 'All squads' }].concat(squadsAll.map((s) => ({ v: s.id, l: s.name, n: AMS.org.centre(s.centreId).short }))), on: (v) => set({ squadId: v }) },
    ];
    return html`<div className="scope" ref=${ref} aria-label="Organisation filter">
      ${segs.map((s, i) => html`<span key=${s.lvl} style=${{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} className=${i > 0 && i < 3 ? 'hide-sm' : ''}>
        ${i > 0 && html`<span className="scope-sep"><${I} name="chev-r" size=${12} /></span>`}
        <button className="scope-seg" disabled=${s.locked} style=${s.locked ? { cursor: 'default' } : null} onClick=${() => (s.options ? setOpen(open === s.lvl ? null : s.lvl) : s.clear && s.clear())} title=${s.locked ? 'Locked by your role' : 'Filter by ' + s.lvl.toLowerCase()}>
          <span className="lvl">${s.lvl}</span><b>${s.label}</b>${s.locked ? html`<span className="scope-lock"><${I} name="lock" size=${11} /></span>` : s.options && html`<${I} name="chev-d" size=${12} />`}
        </button>
        ${open === s.lvl && html`<div className="popover" style=${{ top: '100%', left: 0, marginTop: 6, maxHeight: 360, overflowY: 'auto', minWidth: 260 }}>
          <div className="upper" style=${{ padding: '6px 10px' }}>${s.lvl}</div>
          ${s.options.map((o) => html`<button key=${o.v || 'all'} className=${AMS.cx('menu-item', (eff[s.key] || null) === o.v && 'active')} onClick=${() => s.on(o.v)}>${o.l}${o.n && html`<span className="faint small">${o.n}</span>`}</button>`)}
        </div>`}
      </span>`)}
    </div>`;
  }

  /* ------------------------------------------------------------------ role switcher */
  function RolePicker() {
    const { ui } = AMS.useStore();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    UI.useClickOutside(ref, () => setOpen(false), open);
    const me = AMS.me();
    return html`<div ref=${ref} style=${{ position: 'relative' }}>
      <button className="btn ghost" style=${{ height: 38, padding: '0 8px', gap: 8 }} onClick=${() => setOpen(!open)} aria-label="Switch role">
        <${UI.Avatar} name=${me ? me.name : '?'} size=${28} />
        <span className="col tight hide-sm" style=${{ gap: 0, alignItems: 'flex-start', lineHeight: 1.2 }}><span style=${{ fontWeight: 600, fontSize: 12.5 }}>${me ? me.name : ''}</span><span className="tiny faint">${AMS.roleLabel(ui.role)}</span></span>
        <${I} name="chev-d" size=${13} />
      </button>
      ${open && html`<div className="popover" style=${{ top: '100%', right: 0, marginTop: 6, width: 300 }}>
        <div className="upper" style=${{ padding: '6px 10px' }}>View the product as</div>
        ${AMS.ROLES.map((r) => { const p = r.id === 'athlete' ? AMS.org.athlete(AMS.db.meta.heroAthleteId) : AMS.db.staff.find((s) => s.role === r.id && s.persona); return html`<button key=${r.id} className=${AMS.cx('menu-item', ui.role === r.id && 'active')} onClick=${() => { setOpen(false); AMS.switchRole(r.id); }}>
          <${UI.Avatar} name=${p ? p.name : r.label} size=${24} /><span className="col tight" style=${{ gap: 0 }}><span>${r.label}</span><span className="tiny faint">${p ? p.name : ''}${p && p.centreId ? ' · ' + AMS.org.centre(p.centreId).short : ''}</span></span>${ui.role === r.id && html`<${I} name="check" size=${14} style=${{ marginLeft: 'auto', color: 'var(--accent)' }} />`}
        </button>`; })}
        <hr className="divider" style=${{ margin: '6px 0' }} />
        <div style=${{ padding: '4px 10px 6px' }}><${UI.Toggle} id="live-toggle" checked=${ui.live} onChange=${(v) => AMS.setUI({ live: v })} label="Live simulation (check-ins, sessions)" /></div>
        <button className="menu-item" onClick=${() => { setOpen(false); AMS.resetData(); }}><${I} name="refresh" size=${14} />Reset demo data</button>
      </div>`}
    </div>`;
  }

  /* ------------------------------------------------------------------ notifications */
  function Bell() {
    const { db, ui } = AMS.useStore();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    UI.useClickOutside(ref, () => setOpen(false), open);
    const list = db.notifications.filter((n) => n.toRole === ui.role || n.toRole === 'all');
    const unread = list.filter((n) => !n.read).length;
    return html`<div ref=${ref} style=${{ position: 'relative' }}>
      <button className="btn ghost icon" onClick=${() => setOpen(!open)} aria-label="Notifications" style=${{ position: 'relative' }}><${I} name="bell" size=${18} />${unread > 0 && html`<span style=${{ position: 'absolute', top: 3, right: 3, minWidth: 16, height: 16, borderRadius: 8, background: 'var(--bad)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', padding: '0 4px' }}>${unread}</span>`}</button>
      ${open && html`<div className="popover" style=${{ top: '100%', right: 0, marginTop: 6, width: 360, padding: 0 }}>
        <div className="row between" style=${{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}><b>Notifications</b>${unread > 0 && html`<button className="btn ghost xs" onClick=${() => AMS.mutate((d) => d.notifications.forEach((n) => { if (n.toRole === ui.role) n.read = true; }))}>Mark all read</button>`}</div>
        <div style=${{ maxHeight: 400, overflowY: 'auto' }}>
          ${list.length === 0 && html`<${UI.Empty} icon="bell" title="You're all caught up" />`}
          ${list.slice(0, 20).map((n) => html`<div key=${n.id} className="list-item clickable" style=${{ alignItems: 'flex-start', cursor: 'pointer', background: n.read ? 'transparent' : 'var(--accent-weak)' }} onClick=${() => { AMS.mutate((d) => { const x = AMS.byId(d.notifications, n.id); if (x) x.read = true; }); setOpen(false); if (n.athleteId) AMS.openAthlete(n.athleteId); else if (n.module) AMS.go(n.module); }}>
            <span className=${'dot ' + (n.read ? 'neutral' : 'info')} style=${{ marginTop: 6 }} />
            <div className="col tight grow" style=${{ gap: 2 }}><span style=${{ fontWeight: 600, fontSize: 12.5 }}>${n.title}</span><span className="small muted">${n.text}</span><span className="tiny faint">${(n.at || '').slice(11, 16)} · ${AMS.date.rel((n.at || AMS.TODAY).slice(0, 10))}</span></div>
          </div>`)}
        </div>
      </div>`}
    </div>`;
  }

  /* ------------------------------------------------------------------ command palette */
  function Palette() {
    const { db, ui } = AMS.useStore();
    const [q, setQ] = useState('');
    const [sel, setSel] = useState(0);
    const inputRef = useRef(null);
    useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);
    const ql = q.trim().toLowerCase();
    const items = useMemo(() => {
      const out = [];
      const scoped = new Set(AMS.scopedAthletes({ all: true }).map((a) => a.id));
      const aths = db.athletes.filter((a) => scoped.has(a.id) && (!ql || a.name.toLowerCase().includes(ql) || a.id.toLowerCase().includes(ql))).slice(0, ql ? 8 : 4);
      aths.forEach((a) => out.push({ group: 'Athletes', label: a.name, sub: AMS.org.squad(a.squadId).name + ' · ' + a.id, icon: 'user', run: () => AMS.openAthlete(a.id) }));
      AMS.modules.filter((m) => (!m.roles || m.roles.includes(ui.role)) && (!ql || m.label.toLowerCase().includes(ql))).forEach((m) => out.push({ group: 'Go to', label: m.label, icon: m.icon, run: () => AMS.go(m.id) }));
      AMS.commands.filter((c) => (!c.roles || c.roles.includes(ui.role)) && (!ql || (c.label + ' ' + (c.keywords || '')).toLowerCase().includes(ql))).forEach((c) => out.push({ group: c.group || 'Actions', label: c.label, icon: c.icon || 'zap', run: c.run }));
      if (ql) out.push({ group: 'Ask AI', label: 'Ask Copilot: "' + q + '"', icon: 'sparkles', run: () => AMS.copilot.ask(q) });
      return out;
    }, [ql, ui.role, AMS.version]);
    const run = (it) => { AMS.setUI({ palette: false }); setTimeout(() => it.run(), 0); };
    const onKey = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
      else if (e.key === 'Enter' && items[sel]) run(items[sel]);
      else if (e.key === 'Escape') AMS.setUI({ palette: false });
    };
    let lastGroup = null;
    return html`<div className="modal-wrap" style=${{ alignItems: 'flex-start', paddingTop: '12vh' }} onClick=${() => AMS.setUI({ palette: false })}>
      <div className="modal" style=${{ width: 'min(620px, 100%)' }} onClick=${(e) => e.stopPropagation()}>
        <div className="row" style=${{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}><${I} name="search" size=${17} style=${{ color: 'var(--fg-3)' }} /><input id="palette-input" ref=${inputRef} value=${q} onChange=${(e) => { setQ(e.target.value); setSel(0); }} onKeyDown=${onKey} placeholder="Search athletes, jump to a module, run an action, or ask AI…" style=${{ border: 0, outline: 0, background: 'none', flex: 1, fontSize: 15 }} /><${UI.Kbd}>Esc<//></div>
        <div style=${{ maxHeight: 420, overflowY: 'auto', padding: 6 }}>
          ${items.map((it, i) => { const head = it.group !== lastGroup; lastGroup = it.group; return html`<div key=${i}>${head && html`<div className="upper" style=${{ padding: '8px 10px 4px' }}>${it.group}</div>`}<button className=${AMS.cx('menu-item', i === sel && 'active')} onMouseEnter=${() => setSel(i)} onClick=${() => run(it)}><${I} name=${it.icon || 'arrow-r'} size=${15} style=${{ color: it.group === 'Ask AI' ? 'var(--ai)' : 'var(--fg-3)' }} />${it.label}${it.sub && html`<span className="faint small">${it.sub}</span>`}</button></div>`; })}
          ${items.length === 0 && html`<${UI.Empty} icon="search" title="No matches" />`}
        </div>
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------------ top bar */
  function Topbar() {
    const { ui } = AMS.useStore();
    return html`<header className="topbar">
      <${ScopePicker} />
      <div className="grow" />
      <span className="row tight hide-sm small muted" title="Simulated live clock" style=${{ whiteSpace: 'nowrap' }}>${ui.live && html`<span className="live-dot" />`}<span className="tnum">${AMS.date.fmtLong(AMS.TODAY).slice(0, 10)} · ${AMS.clockTime()}</span></span>
      <button className="btn hide-sm" style=${{ width: 220, justifyContent: 'flex-start', color: 'var(--fg-3)' }} onClick=${() => AMS.setUI({ palette: true })}><${I} name="search" size=${14} />Search or jump to…<span style=${{ marginLeft: 'auto' }}><${UI.Kbd}>Ctrl K<//></span></button>
      <button className="btn ghost icon show-sm" onClick=${() => AMS.setUI({ palette: true })} aria-label="Search" id="search-sm"><${I} name="search" size=${18} /></button>
      <${Bell} />
      <button className=${AMS.cx('btn', ui.copilot.open ? 'ai' : '')} style=${ui.copilot.open ? null : { borderColor: 'var(--ai-border)', color: 'var(--ai)' }} onClick=${AMS.copilot.toggle}><${I} name="sparkles" size=${15} /><span className="hide-sm">Copilot</span></button>
      <${RolePicker} />
    </header>`;
  }

  /* ------------------------------------------------------------------ overlays */
  function DrawerHost() {
    const { ui } = AMS.useStore();
    if (!ui.drawers.length) return null;
    return html`<${React.Fragment}>${ui.drawers.map((d, i) => {
      const reg = AMS.drawers[d.type];
      const top = i === ui.drawers.length - 1;
      return html`<${React.Fragment} key=${d.key}>
        ${top && html`<div className="overlay" onClick=${AMS.closeDrawer} />`}
        <aside className=${AMS.cx('drawer', reg && reg.wide && 'wide')} style=${top ? null : { display: 'none' }} role="dialog" aria-modal="true">
          ${reg ? html`<${ErrorBoundary} name=${'drawer:' + d.type}><${reg.component} ...${d.props} /><//>` : html`<${UI.DrawerHead} title="Not available" /><div className="drawer-b"><${UI.Empty} title=${'No drawer registered for ' + d.type} /></div>`}
        </aside>
      <//>`;
    })}<//>`;
  }
  function ModalHost() {
    const { ui } = AMS.useStore();
    if (!ui.modal) return null;
    const reg = AMS.modals[ui.modal.type];
    return html`<div className="modal-wrap" onClick=${AMS.closeModal}>${reg ? html`<${ErrorBoundary} name=${'modal:' + ui.modal.type}><${reg.component} ...${ui.modal.props} /><//>` : html`<${UI.ModalFrame} title="Not available">No modal registered for ${ui.modal.type}<//>`}</div>`;
  }
  function Toasts() {
    const { ui } = AMS.useStore();
    return html`<div className="toasts" aria-live="polite">${ui.toasts.map((t) => html`<div key=${t.id} className=${'toast ' + t.kind}><span className="t-ic"><${I} name=${{ good: 'check', bad: 'alert', info: 'info', ai: 'sparkles' }[t.kind] || 'info'} size=${16} /></span><span>${t.text}</span>${t.action && html`<button onClick=${t.action.run}>${t.action.label}</button>`}</div>`)}</div>`;
  }
  function CopilotPane() {
    const { ui } = AMS.useStore();
    if (!ui.copilot.open) return null;
    const Panel = AMS.panels.copilot;
    return html`<aside className="copilot-pane" aria-label="AI Copilot">${Panel ? html`<${ErrorBoundary} name="copilot"><${Panel} /><//>` : html`<div className="card-h"><h3><${I} name="sparkles" size=${15} />Copilot</h3><button className="btn ghost icon" onClick=${AMS.copilot.close}><${I} name="x" /></button></div><${UI.Empty} icon="sparkles" title="Copilot is loading" />`}</aside>`;
  }
  function BottomNav() {
    const { ui } = AMS.useStore();
    const ids = ui.role === 'athlete' ? [] : ['dashboard', 'athletes', 'training', 'medical'];
    const mods = ids.map((id) => AMS.modules.find((m) => m.id === id)).filter((m) => m && (!m.roles || m.roles.includes(ui.role)));
    if (!mods.length) return null;
    return html`<nav className="bottom-nav">${mods.map((m) => html`<button key=${m.id} className=${ui.route.module === m.id ? 'active' : ''} onClick=${() => AMS.go(m.id)}><${I} name=${m.icon} size=${20} />${m.short || m.label.split(' ')[0]}</button>`)}<button onClick=${() => AMS.setUI({ palette: true })}><${I} name="menu" size=${20} />More</button></nav>`;
  }

  class ErrorBoundary extends React.Component {
    constructor(p) { super(p); this.state = { err: null }; }
    static getDerivedStateFromError(err) { return { err }; }
    componentDidCatch(err, info) { console.error('[' + this.props.name + ']', err, info); }
    render() {
      if (this.state.err) return html`<div className="card" style=${{ margin: 16, padding: 16, borderColor: 'var(--bad)' }}><b className="bad">This view hit an error</b><div className="small muted mono" style=${{ marginTop: 6 }}>${String(this.state.err && this.state.err.message)}</div><button className="btn sm" style=${{ marginTop: 10 }} onClick=${() => this.setState({ err: null })}>Retry</button></div>`;
      return this.props.children;
    }
  }
  AMS.ErrorBoundary = ErrorBoundary;

  /* ------------------------------------------------------------------ app */
  function App() {
    const { ui } = AMS.useStore();
    useEffect(() => {
      const iv = setInterval(tick, 5000);
      const onKey = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); AMS.setUI({ palette: !AMS.ui.palette }); }
        else if (e.key === 'Escape') { if (AMS.ui.palette) AMS.setUI({ palette: false }); else if (AMS.ui.modal) AMS.closeModal(); else if (AMS.ui.drawers.length) AMS.closeDrawer(); }
      };
      window.addEventListener('keydown', onKey);
      const onHash = () => { const h = location.hash.slice(1); if (h && h !== AMS.ui.route.module && AMS.modules.some((m) => m.id === h)) AMS.go(h); };
      window.addEventListener('hashchange', onHash);
      return () => { clearInterval(iv); window.removeEventListener('keydown', onKey); window.removeEventListener('hashchange', onHash); };
    }, []);
    let mod = AMS.modules.find((m) => m.id === ui.route.module && (!m.roles || m.roles.includes(ui.role)));
    if (!mod) mod = AMS.modules.find((m) => m.id === (ROLE_HOME[ui.role] || 'dashboard')) || AMS.modules[0];
    const Comp = mod ? mod.component : () => html`<${UI.Empty} title="No modules loaded" />`;
    return html`<div className=${AMS.cx('shell', ui.navCollapsed && 'nav-collapsed')}>
      <${Sidebar} />
      <div className="main">
        <${Topbar} />
        <main className="content" id="content"><${ErrorBoundary} key=${mod ? mod.id + ui.role : 'none'} name=${mod ? mod.id : 'none'}><${Comp} params=${ui.route.params} /><//></main>
      </div>
      <${CopilotPane} />
      <${BottomNav} />
      <${DrawerHost} />
      <${ModalHost} />
      ${ui.palette && html`<${Palette} />`}
      <${Toasts} />
    </div>`;
  }
  AMS.App = App;

  /* Standard page header used by modules. */
  UI.PageHead = function ({ title, sub, crumbs, actions, children }) {
    return html`<div className="page-head">
      <div className="col tight" style=${{ gap: 2, minWidth: 0 }}>
        <div className="crumbs">${crumbs || AMS.scopeLabel()}</div>
        <h1>${title}</h1>
        ${sub && html`<div className="sub">${sub}</div>`}
        ${children}
      </div>
      ${actions && html`<div className="page-actions">${actions}</div>`}
    </div>`;
  };

  AMS.mount = function () {
    AMS.boot();
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(html`<${App} />`);
  };
})();
