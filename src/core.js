/* USI · AMS — core runtime: store, UI state, navigation, RBAC, org ladder scope, calculations, AI engine, registries.
   Every module talks to the app only through window.AMS. */
(function () {
  'use strict';
  const React = window.React;
  const { useState, useEffect } = React;
  const html = window.htm.bind(React.createElement);

  const AMS = (window.AMS = window.AMS || {});
  Object.assign(AMS, {
    html, React,
    TODAY: '2026-10-13',
    NOW_TIME: '07:05',
    DATA_VERSION: 'usi-ams-v9',
    modules: [], drawers: {}, modals: {}, panels: {}, actions: {}, detectors: [], commands: [], seeds: [], tickFns: [], selfTests: [],
  });

  /* ------------------------------------------------------------------ store */
  const listeners = new Set();
  AMS.db = null;
  AMS.version = 0;
  AMS.ui = {
    route: { module: 'dashboard', params: {} },
    role: 'director',
    scope: {},                 // { stateId, centreId, sport, squadId }
    drawers: [],               // [{ type, props, key }]
    modal: null,               // { type, props }
    toasts: [],
    copilot: { open: false, messages: [], pending: null },
    focus: {},                 // { athleteId, injuryId, sessionId, ... } — what the user is looking at (copilot context)
    live: true,
    navCollapsed: false,
    palette: false,
  };
  function emit() { AMS.version++; listeners.forEach((l) => { try { l(); } catch (e) { console.error(e); } }); }
  AMS.subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  AMS.useStore = function () {
    const [, force] = useState(0);
    useEffect(() => AMS.subscribe(() => force((v) => v + 1)), []);
    return { db: AMS.db, ui: AMS.ui, v: AMS.version };
  };
  AMS.useDB = () => AMS.useStore().db;
  AMS.useUI = () => AMS.useStore().ui;

  let persistTimer = null;
  function persist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try { localStorage.setItem(AMS.DATA_VERSION, JSON.stringify(AMS.db)); } catch (e) { /* storage unavailable */ }
      try { localStorage.setItem(AMS.DATA_VERSION + ':ui', JSON.stringify({ role: AMS.ui.role, scope: AMS.ui.scope, live: AMS.ui.live, module: AMS.ui.route.module })); } catch (e) { }
    }, 400);
  }
  /** Mutate the shared database. fn receives the live db object; mutate it in place. */
  AMS.mutate = function (fn, opts) {
    opts = opts || {};
    try { fn(AMS.db); } catch (e) { console.error('mutate failed', e); AMS.toast('Something went wrong: ' + e.message, 'bad'); return; }
    if (opts.log) AMS.log(opts.log);
    persist();
    emit();
    if (opts.toast) AMS.toast(opts.toast, opts.toastKind || 'good', opts.toastAction);
  };
  /** Patch UI state (shallow merge). */
  AMS.setUI = function (patch) { Object.assign(AMS.ui, typeof patch === 'function' ? patch(AMS.ui) : patch); persist(); emit(); };
  AMS.resetData = function () {
    try { localStorage.removeItem(AMS.DATA_VERSION); localStorage.removeItem(AMS.DATA_VERSION + ':ui'); } catch (e) { }
    AMS.db = AMS.buildSeed();
    AMS.ui.drawers = []; AMS.ui.modal = null; AMS.ui.copilot = { open: false, messages: [], pending: null };
    emit();
    AMS.toast('Demo data reset to 13 Oct 2026, 07:05', 'info');
  };

  /* ------------------------------------------------------------------ ids, utils */
  let idc = 1000;
  AMS.uid = (prefix) => (prefix || 'ID') + '-' + (Date.now() % 100000).toString(36).toUpperCase() + (idc++).toString(36).toUpperCase();
  AMS.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  AMS.round = (v, d) => { const m = Math.pow(10, d || 0); return Math.round(v * m) / m; };
  AMS.sum = (arr) => arr.reduce((s, x) => s + (+x || 0), 0);
  AMS.mean = (arr) => { const a = arr.filter((x) => x != null && !isNaN(x)); return a.length ? AMS.sum(a) / a.length : 0; };
  AMS.groupBy = (arr, f) => arr.reduce((m, x) => { const k = typeof f === 'function' ? f(x) : x[f]; (m[k] = m[k] || []).push(x); return m; }, {});
  AMS.byId = (list, id) => (list || []).find((x) => x.id === id);
  AMS.cx = (...a) => a.filter(Boolean).join(' ');
  AMS.initials = (name) => (name || '?').replace(/^(Dr\.|Coach)\s+/, '').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  AMS.hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  AMS.rng = function (seed) { // mulberry32
    let a = typeof seed === 'string' ? [...seed].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381) : seed >>> 0;
    const r = function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.int = (lo, hi) => Math.floor(r() * (hi - lo + 1)) + lo;
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.norm = (mu, sd) => { const u = 1 - r(), v = r(); return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    r.chance = (p) => r() < p;
    return r;
  };

  /* ------------------------------------------------------------------ dates */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const parse = (iso) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const toISO = (dt) => dt.toISOString().slice(0, 10);
  AMS.date = {
    parse, toISO,
    add: (iso, n) => { const d = parse(iso); d.setUTCDate(d.getUTCDate() + n); return toISO(d); },
    diff: (a, b) => Math.round((parse(a) - parse(b)) / 86400000), // a - b in days
    fmt: (iso) => { if (!iso) return '—'; const d = parse(iso); return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + (d.getUTCFullYear() !== 2026 ? ' ' + d.getUTCFullYear() : ''); },
    fmtLong: (iso) => { const d = parse(iso); return DOW[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); },
    dow: (iso) => DOW[parse(iso).getUTCDay()],
    dowIndex: (iso) => parse(iso).getUTCDay(),
    month: (iso) => MONTHS[parse(iso).getUTCMonth()],
    rel: (iso) => { const n = AMS.date.diff(AMS.TODAY, iso); if (n === 0) return 'today'; if (n === 1) return 'yesterday'; if (n === -1) return 'tomorrow'; return n > 0 ? n + 'd ago' : 'in ' + -n + 'd'; },
    ageOn: (dob, on) => { const a = parse(dob), b = parse(on || AMS.TODAY); let y = b.getUTCFullYear() - a.getUTCFullYear(); if (b.getUTCMonth() < a.getUTCMonth() || (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate())) y--; return y; },
    range: (start, n) => Array.from({ length: n }, (_, i) => AMS.date.add(start, i)),
    MONTHS, DOW,
  };
  /** Day index helpers for per-athlete series. loads: 42 entries (index 41 = today). wellness: 28 entries (index 27 = today). */
  AMS.series = {
    LOAD_DAYS: 42, WELL_DAYS: 28,
    loadDate: (i) => AMS.date.add(AMS.TODAY, i - 41),
    wellDate: (i) => AMS.date.add(AMS.TODAY, i - 27),
  };

  /* ------------------------------------------------------------------ roles & RBAC */
  AMS.ROLES = [
    { id: 'director', label: 'Performance Director', short: 'Director', group: 'Leaders' },
    { id: 'coach', label: 'Coach', short: 'Coach', group: 'Practitioners' },
    { id: 'physio', label: 'Physiotherapist', short: 'Physio', group: 'Practitioners' },
    { id: 'doctor', label: 'Team Doctor', short: 'Doctor', group: 'Practitioners' },
    { id: 'scientist', label: 'Sports Scientist', short: 'Sci', group: 'Practitioners' },
    { id: 'nutritionist', label: 'Nutritionist', short: 'Nutrition', group: 'Practitioners' },
    { id: 'ops', label: 'Operations Admin', short: 'Ops', group: 'Operations' },
    { id: 'athlete', label: 'Athlete (mobile)', short: 'Athlete', group: 'Athletes' },
  ];
  // Access per data domain (from Product Thinking doc §5). Levels: none < own < summary < view < edit < full
  AMS.RBAC = {
    director: { training: 'view', readiness: 'view', medical: 'summary', nutrition: 'view', documents: 'none', reports: 'all', athletes: 'view', assessments: 'view' },
    coach: { training: 'edit', readiness: 'view', medical: 'summary', nutrition: 'view', documents: 'none', reports: 'squad', athletes: 'view', assessments: 'edit' },
    physio: { training: 'view', readiness: 'view', medical: 'full', nutrition: 'view', documents: 'medical', reports: 'centre', athletes: 'view', assessments: 'view' },
    doctor: { training: 'view', readiness: 'view', medical: 'full', nutrition: 'view', documents: 'medical', reports: 'centre', athletes: 'view', assessments: 'view' },
    scientist: { training: 'view', readiness: 'edit', medical: 'summary', nutrition: 'view', documents: 'none', reports: 'centre', athletes: 'view', assessments: 'edit' },
    nutritionist: { training: 'view', readiness: 'view', medical: 'summary', nutrition: 'edit', documents: 'none', reports: 'centre', athletes: 'view', assessments: 'view' },
    ops: { training: 'none', readiness: 'none', medical: 'none', nutrition: 'none', documents: 'edit', reports: 'operational', athletes: 'edit', assessments: 'none' },
    athlete: { training: 'own', readiness: 'own', medical: 'own', nutrition: 'own', documents: 'own', reports: 'none', athletes: 'own', assessments: 'own' },
  };
  const LEVEL = { none: 0, own: 1, summary: 2, medical: 3, squad: 3, centre: 3, operational: 3, view: 3, all: 4, edit: 4, full: 5 };
  AMS.access = (domain, role) => (AMS.RBAC[role || AMS.ui.role] || {})[domain] || 'none';
  AMS.can = (domain, min, role) => (LEVEL[AMS.access(domain, role)] || 0) >= (LEVEL[min || 'view'] || 0);
  AMS.canEdit = (domain, role) => { const a = AMS.access(domain, role); return a === 'edit' || a === 'full'; };
  AMS.medicalFull = (role) => AMS.access('medical', role) === 'full';
  AMS.roleLabel = (id) => (AMS.ROLES.find((r) => r.id === id) || {}).label || id;
  /** The staff member the current role is acting as. */
  AMS.me = function () {
    const db = AMS.db, role = AMS.ui.role;
    if (role === 'athlete') return db.athletes.find((a) => a.id === db.meta.heroAthleteId);
    return db.staff.find((s) => s.role === role && s.persona) || db.staff.find((s) => s.role === role);
  };
  /** Medical text as the current role may see it. Coaches etc. get "Modified training: lower leg", never the diagnosis. */
  AMS.medicalLabel = function (inj, role) {
    if (!inj) return '';
    if (AMS.medicalFull(role) || (role || AMS.ui.role) === 'athlete') return inj.diagnosis || inj.regionLabel;
    const zone = AMS.bodyZone(inj.region);
    const av = inj.status === 'Monitoring' ? 'Monitoring' : (inj.availability === 'Unavailable' ? 'Unavailable' : 'Modified training');
    return av + ': ' + zone;
  };
  AMS.bodyZone = function (region) {
    const r = region || '';
    if (/hamstring|quad|thigh|groin|adductor|hip_flexor/.test(r)) return 'upper leg';
    if (/calf|shin|achilles|ankle|foot|knee/.test(r)) return 'lower leg';
    if (/shoulder|elbow|wrist|hand|arm|bicep|tricep|forearm/.test(r)) return 'upper limb';
    if (/back|lumbar|spine|neck|glute|hip/.test(r)) return 'back / hip';
    if (/head|face|concussion/.test(r)) return 'head';
    return 'trunk';
  };

  /* ------------------------------------------------------------------ org ladder & scope */
  // Federation → State → Centre → Sport → Squad → Athlete
  AMS.LADDER = ['Federation', 'State', 'Centre', 'Sport', 'Squad', 'Athlete'];
  AMS.org = {
    state: (id) => AMS.byId(AMS.db.org.states, id),
    centre: (id) => AMS.byId(AMS.db.org.centres, id),
    squad: (id) => AMS.byId(AMS.db.org.squads, id),
    staff: (id) => AMS.byId(AMS.db.staff, id),
    athlete: (id) => AMS.byId(AMS.db.athletes, id),
    sports: () => [...new Set(AMS.db.org.squads.map((s) => s.sport))],
  };
  /** Scope locks imposed by the role (a coach only sees their squads, centre staff see their centre). */
  AMS.roleScopeLock = function (role) {
    role = role || AMS.ui.role;
    const me = AMS.db && AMS.me();
    if (!me) return {};
    if (role === 'coach') return { squadIds: me.squads || [], centreId: me.centreId, label: 'Your squads' };
    if (['physio', 'doctor', 'scientist', 'nutritionist'].includes(role)) return { centreId: me.centreId, label: AMS.org.centre(me.centreId).short };
    if (role === 'athlete') return { athleteId: me.id, label: 'Just you' };
    return {};
  };
  /** Effective scope = role lock ∩ user's ladder filter. */
  AMS.effectiveScope = function () {
    const lock = AMS.roleScopeLock();
    const s = Object.assign({}, AMS.ui.scope);
    if (lock.centreId) { s.centreId = lock.centreId; s.stateId = AMS.org.centre(lock.centreId).stateId; }
    return { ...s, lock };
  };
  /** Does an athlete fall inside a given scope? Temporary camp assignments count for the camp centre/squad too. */
  AMS.inScope = function (a, scope) {
    scope = scope || AMS.effectiveScope();
    const lock = scope.lock || {};
    if (lock.athleteId && a.id !== lock.athleteId) return false;
    const sq = AMS.org.squad(a.squadId);
    const temp = a.tempAssignment && a.tempAssignment.active ? a.tempAssignment : null;
    const matches = (centreId, squadId) => {
      const sqx = AMS.org.squad(squadId);
      if (!sqx) return false;
      const c = AMS.org.centre(centreId);
      if (scope.stateId && c.stateId !== scope.stateId) return false;
      if (scope.centreId && centreId !== scope.centreId) return false;
      if (scope.sport && sqx.sport !== scope.sport) return false;
      if (scope.squadId && squadId !== scope.squadId) return false;
      if (lock.squadIds && !lock.squadIds.includes(squadId)) return false;
      return true;
    };
    if (sq && matches(a.centreId, a.squadId)) return true;
    if (temp && matches(temp.centreId, temp.squadId)) return true;
    return false;
  };
  /** Athletes visible right now (role lock + ladder filter). opts.all = include non-active enrollment states. */
  AMS.scopedAthletes = function (opts) {
    opts = opts || {};
    const scope = AMS.effectiveScope();
    return AMS.db.athletes.filter((a) => (opts.all || a.enrollment === 'Active') && AMS.inScope(a, scope));
  };
  AMS.scopeLabel = function () {
    const s = AMS.effectiveScope();
    if (s.lock && s.lock.athleteId) return 'My profile';
    if (s.squadId) return AMS.org.squad(s.squadId).name;
    const parts = [];
    if (s.sport) parts.push(s.sport);
    if (s.centreId) parts.push(AMS.org.centre(s.centreId).short);
    else if (s.stateId) parts.push(AMS.org.state(s.stateId).name);
    if (s.lock && s.lock.squadIds && !s.squadId) return 'Your squads';
    return parts.length ? parts.join(' · ') : 'Whole federation';
  };

  /* ------------------------------------------------------------------ calculations */
  const C = (AMS.calc = {});
  /** ACWR (rolling-average model), as of this morning: acute = last 7 completed days, chronic = last 28 completed days. */
  C.acwr = function (a, endIdx) {
    const L = a.loads || [];
    const e = endIdx == null ? 40 : endIdx; // 40 = yesterday
    const acute = AMS.mean(L.slice(e - 6, e + 1));
    const chronic = AMS.mean(L.slice(e - 27, e + 1));
    return chronic > 0 ? AMS.round(acute / chronic, 2) : 1;
  };
  C.acwrSeries = (a, days) => { const out = []; for (let i = 41 - (days || 21); i <= 40; i++) out.push({ date: AMS.series.loadDate(i), value: C.acwr(a, i) }); return out; };
  C.acwrBand = (r) => (r >= 1.5 ? 'bad' : r > 1.3 ? 'warn' : r < 0.8 ? 'info' : 'good');
  C.acwrLabel = (r) => (r >= 1.5 ? 'Load jump' : r > 1.3 ? 'Rising load' : r < 0.8 ? 'Under-loaded' : 'In range');
  C.weekLoad = (a, weeksAgo) => { const e = 40 - 7 * (weeksAgo || 0); return AMS.sum((a.loads || []).slice(e - 6, e + 1)); };
  C.monotony = (a) => { const w = (a.loads || []).slice(34, 41); const m = AMS.mean(w); const sd = Math.sqrt(AMS.mean(w.map((x) => (x - m) ** 2))); return sd ? AMS.round(m / sd, 2) : 0; };
  C.strain = (a) => AMS.round(C.weekLoad(a) * C.monotony(a));
  C.todayWellness = (a) => (a.wellness || [])[27] || null;
  C.wellnessScore = (w) => (w ? Math.round(((w.sleep + w.soreness + w.mood + w.stress + w.energy - 5) / 20) * 100) : null);
  C.wellnessAvg = (a, from, to) => AMS.mean((a.wellness || []).slice(from, to).filter(Boolean).map(C.wellnessScore));
  /** Personal baseline: athlete's own 21-day wellness norm (compare to own normal, not a fixed rule). */
  C.wellnessBaseline = (a) => C.wellnessAvg(a, 6, 27);
  /** Readiness 0–100 for today. Returns { score, band, checkedIn, factors[] }. */
  C.readiness = function (a) {
    const w = C.todayWellness(a);
    const factors = [];
    let score;
    if (w) score = C.wellnessScore(w);
    else { score = Math.round(C.wellnessAvg(a, 24, 27) || 65); factors.push({ label: 'No check-in today', value: 'using 3-day avg', tone: 'warn' }); }
    const base = C.wellnessBaseline(a);
    if (w && base && score < base - 12) factors.push({ label: 'Wellness vs own normal', value: (score - Math.round(base)) + ' pts', tone: 'bad' });
    const r = C.acwr(a);
    if (r >= 1.5) { score -= 15; factors.push({ label: 'Load jump (ACWR)', value: r.toFixed(2), tone: 'bad' }); }
    else if (r > 1.3) { score -= 7; factors.push({ label: 'Rising load (ACWR)', value: r.toFixed(2), tone: 'warn' }); }
    if (w && w.soreness <= 2) factors.push({ label: 'Soreness', value: w.soreness + '/5', tone: 'bad' });
    if (w && w.sleep <= 2) factors.push({ label: 'Sleep quality', value: w.sleep + '/5', tone: 'warn' });
    if (a.availability === 'Modified') { score = Math.min(score, 62); factors.push({ label: 'Availability', value: 'Modified', tone: 'warn' }); }
    if (a.availability === 'Unavailable') { score = Math.min(score, 35); factors.push({ label: 'Availability', value: 'Unavailable', tone: 'bad' }); }
    score = AMS.clamp(Math.round(score), 0, 100);
    const band = score >= 70 ? 'good' : score >= 50 ? 'warn' : 'bad';
    return { score, band, checkedIn: !!w, factors };
  };
  C.bandLabel = (b) => ({ good: 'Green', warn: 'Amber', bad: 'Red' }[b] || '—');
  /** Injury risk 0–100 with contributing factors (explainable). */
  C.risk = function (a) {
    const f = [];
    let s = 10;
    const r = C.acwr(a);
    if (r >= 1.5) { s += 35; f.push({ label: 'ACWR', value: r.toFixed(2), tone: 'bad' }); } else if (r > 1.3) { s += 18; f.push({ label: 'ACWR', value: r.toFixed(2), tone: 'warn' }); }
    const recent = C.wellnessAvg(a, 25, 28), base = C.wellnessBaseline(a);
    if (base && recent && recent < base - 10) { s += 20; f.push({ label: '3-day wellness vs normal', value: Math.round(recent - base) + ' pts', tone: 'bad' }); }
    const sleep3 = (a.wellness || []).slice(25, 28).filter(Boolean).map((w) => w.sleep);
    if (sleep3.length >= 2 && AMS.mean(sleep3) <= 2.4) { s += 10; f.push({ label: 'Sleep (3 nights)', value: AMS.mean(sleep3).toFixed(1) + '/5', tone: 'warn' }); }
    const prior = AMS.db.injuries.filter((i) => i.athleteId === a.id && i.status === 'Closed').length;
    if (prior) { s += 8 * Math.min(prior, 2); f.push({ label: 'Previous injuries', value: String(prior), tone: 'warn' }); }
    const mono = C.monotony(a);
    if (mono > 2) { s += 8; f.push({ label: 'Training monotony', value: mono.toFixed(1), tone: 'warn' }); }
    if (a.returnedOn && AMS.date.diff(AMS.TODAY, a.returnedOn) < 28) { s += 12; f.push({ label: 'Returned from injury', value: AMS.date.rel(a.returnedOn), tone: 'warn' }); }
    s = AMS.clamp(Math.round(s), 0, 99);
    return { score: s, band: s >= 60 ? 'bad' : s >= 35 ? 'warn' : 'good', factors: f };
  };
  C.checkinRate = (list) => { const l = list.filter((a) => a.availability !== 'Unavailable' || true); return l.length ? Math.round((l.filter((a) => C.todayWellness(a)).length / l.length) * 100) : 0; };
  C.openInjuries = (athleteIds) => AMS.db.injuries.filter((i) => i.status !== 'Closed' && (!athleteIds || athleteIds.has(i.athleteId)));
  /** Record session load (sRPE = RPE × minutes) into today's (or a given day's) slot. */
  C.recordLoad = function (db, athleteId, load, dayIdx) {
    const a = AMS.byId(db.athletes, athleteId);
    if (!a) return;
    const i = dayIdx == null ? 41 : dayIdx;
    a.loads[i] = (a.loads[i] || 0) + Math.round(load);
  };
  C.ageGroup = (age) => (age < 18 ? 'U-17' : age < 20 ? 'U-20' : 'Senior');

  /* ------------------------------------------------------------------ logging, notifications, tasks */
  AMS.log = function (entry) {
    const me = AMS.me();
    AMS.db.activity.unshift(Object.assign({ id: AMS.uid('ACT'), at: AMS.TODAY + 'T' + AMS.clockTime(), by: me ? me.name : 'System', role: AMS.ui.role }, entry));
    if (AMS.db.activity.length > 300) AMS.db.activity.length = 300;
  };
  AMS.notify = function (n) {
    AMS.db.notifications.unshift(Object.assign({ id: AMS.uid('NTF'), at: AMS.TODAY + 'T' + AMS.clockTime(), read: false }, n));
  };
  AMS.clockTime = function () { return AMS.ui.clock || AMS.NOW_TIME; };

  /* ------------------------------------------------------------------ navigation, overlays, toasts */
  AMS.go = function (module, params) {
    AMS.ui.route = { module, params: params || {} };
    AMS.ui.palette = false;
    try { if (location.hash.slice(1) !== module) history.replaceState(null, '', '#' + module); } catch (e) { }
    const c = document.querySelector('.content'); if (c) c.scrollTop = 0;
    AMS.setUI({});
  };
  AMS.openDrawer = (type, props) => AMS.setUI({ drawers: [...AMS.ui.drawers, { type, props: props || {}, key: AMS.uid('DRW') }] });
  AMS.closeDrawer = () => AMS.setUI({ drawers: AMS.ui.drawers.slice(0, -1) });
  AMS.closeAllDrawers = () => AMS.setUI({ drawers: [] });
  AMS.openModal = (type, props) => AMS.setUI({ modal: { type, props: props || {} } });
  AMS.closeModal = () => AMS.setUI({ modal: null });
  AMS.openAthlete = (id, tab) => AMS.openDrawer('athlete', { athleteId: id, tab });
  AMS.setFocus = (focus) => { const f = focus || {}; const cur = AMS.ui.focus || {}; if (Object.keys(f).length === Object.keys(cur).length && Object.keys(f).every((k) => cur[k] === f[k])) return; AMS.ui.focus = f; };
  AMS.toast = function (text, kind, action) {
    const t = { id: AMS.uid('T'), text, kind: kind || 'good', action };
    AMS.ui.toasts = [...AMS.ui.toasts, t].slice(-4);
    emit();
    setTimeout(() => { AMS.ui.toasts = AMS.ui.toasts.filter((x) => x.id !== t.id); emit(); }, action ? 6500 : 3800);
  };

  /* ------------------------------------------------------------------ registries */
  /** Module: { id, label, icon, group, order, roles?: [roleIds], component, badge?: () => number|{n,tone} } */
  AMS.registerModule = (m) => { AMS.modules = AMS.modules.filter((x) => x.id !== m.id).concat(m).sort((a, b) => (a.order || 99) - (b.order || 99)); };
  AMS.registerDrawer = (type, component, opts) => { AMS.drawers[type] = Object.assign({ component }, opts || {}); };
  AMS.registerModal = (type, component, opts) => { AMS.modals[type] = Object.assign({ component }, opts || {}); };
  AMS.registerPanel = (type, component) => { AMS.panels[type] = component; };
  /** Action: id → fn(payload) — callable from AI insights, copilot, commands. Should call AMS.mutate. Return a short result string. */
  AMS.registerAction = (id, fn) => { AMS.actions[id] = fn; };
  AMS.runAction = function (id, payload) {
    const fn = AMS.actions[id];
    if (!fn) { AMS.toast('Action not available: ' + id, 'bad'); return null; }
    return fn(payload || {});
  };
  /** Command palette entry: { id, label, group, keywords, roles?, run } */
  AMS.registerCommand = (c) => { AMS.commands = AMS.commands.filter((x) => x.id !== c.id).concat(c); };
  /** Seed extension: fn(db, rng) runs once when fresh demo data is built. Own a namespace: db[key]. */
  AMS.registerSeed = (key, fn) => { AMS.seeds.push({ key, fn }); };
  /** Athlete profile tab contributed by a module: { id, label, order, roles?: [roleIds], component: ({ athlete }) => node } */
  AMS.athleteTabs = [];
  AMS.registerAthleteTab = (t) => { AMS.athleteTabs = AMS.athleteTabs.filter((x) => x.id !== t.id).concat(t).sort((a, b) => (a.order || 50) - (b.order || 50)); };
  /** Live tick: fn(tickCount) every ~5s when live simulation is on. Use AMS.mutate inside. */
  AMS.onTick = (fn) => { AMS.tickFns.push(fn); };

  /* ------------------------------------------------------------------ AI engine */
  /* Detectors: fn(ctx) → insights[]. ctx = { db, athletes (scoped, active), ids:Set, role, me, scope }
     Insight: { id (stable!), kind: 'risk'|'medical'|'ops'|'training'|'nutrition'|'talent'|'wellness',
                severity: 'high'|'med'|'low', title, summary, athleteIds:[], evidence:[{label, value, tone}],
                confidence: 0..1, module, actions:[{ label, action, payload, primary?, confirm? }], roles?: [] } */
  AMS.registerDetector = (id, fn) => { AMS.detectors = AMS.detectors.filter((d) => d.id !== id).concat({ id, fn }); };
  AMS.ai = {
    insights: function (opts) {
      opts = opts || {};
      const athletes = AMS.scopedAthletes();
      const ctx = { db: AMS.db, athletes, ids: new Set(athletes.map((a) => a.id)), role: AMS.ui.role, me: AMS.me(), scope: AMS.effectiveScope() };
      let out = [];
      AMS.detectors.forEach((d) => { try { out = out.concat(d.fn(ctx) || []); } catch (e) { console.error('detector ' + d.id, e); } });
      const st = AMS.db.aiState;
      out = out.filter((i) => !st.dismissed[i.id] && !st.done[i.id] && (!i.roles || i.roles.includes(ctx.role)));
      if (opts.module) out = out.filter((i) => i.module === opts.module || (opts.kinds && opts.kinds.includes(i.kind)));
      if (opts.athleteId) out = out.filter((i) => (i.athleteIds || []).includes(opts.athleteId));
      const rank = { high: 0, med: 1, low: 2 };
      out.sort((a, b) => rank[a.severity] - rank[b.severity] || (b.confidence || 0) - (a.confidence || 0));
      return opts.limit ? out.slice(0, opts.limit) : out;
    },
    /** Execute an insight's action, record that staff acted on the AI warning. */
    act: function (insight, action) {
      const res = AMS.runAction(action.action, action.payload);
      AMS.mutate((db) => { db.aiState.done[insight.id] = { at: AMS.TODAY + 'T' + AMS.clockTime(), action: action.label, by: AMS.ui.role }; db.aiState.acted++; });
      return res;
    },
    dismiss: function (insight, reason) {
      AMS.mutate((db) => { db.aiState.dismissed[insight.id] = { reason: reason || 'Not relevant', by: AMS.ui.role }; db.aiState.dismissedCount++; }, { toast: 'Dismissed. The model will learn from this.', toastKind: 'info' });
    },
    actedRate: () => { const s = AMS.db.aiState; const t = s.acted + s.dismissedCount + s.baselineShown; return t ? Math.round(((s.acted + s.baselineActed) / (t + s.baselineActed)) * 100) : 0; },
  };

  /* Core detectors — load spikes, wellness drops vs own normal, missed check-ins, rehab overdue, verification SLA. */
  AMS.registerDetector('core.loadSpike', function (ctx) {
    const list = ctx.athletes.filter((a) => a.availability !== 'Unavailable' && AMS.calc.acwr(a) >= 1.5);
    return list.map((a) => {
      const r = AMS.calc.acwr(a), rd = AMS.calc.readiness(a);
      const sess = AMS.todaySessionFor(a);
      const acts = [];
      if (sess && !(sess.mods && sess.mods[a.id])) acts.push({ label: 'Switch to recovery session', action: 'session.modifyForAthlete', payload: { athleteId: a.id, sessionId: sess.id, variant: 'recovery' }, primary: true });
      if (ctx.role === 'coach') acts.push({ label: 'Ask physio to screen', action: 'notify', payload: { toRole: 'physio', athleteId: a.id, text: a.name + ': load jump (ACWR ' + r.toFixed(2) + ') and low readiness. Quick screen before session please.' } });
      else acts.push({ label: 'Notify coach', action: 'notify', payload: { toRole: 'coach', athleteId: a.id, text: a.name + ': load jump (ACWR ' + r.toFixed(2) + '). Consider reducing volume today.' } });
      return {
        id: 'spike:' + a.id + ':' + AMS.TODAY, kind: 'risk', severity: rd.band === 'bad' ? 'high' : 'med', module: 'science',
        title: a.name + ' — load jump, elevated injury risk',
        summary: 'Training load this week is ' + Math.round((r - 1) * 100) + '% above their 4-week normal' + (rd.band === 'bad' ? ' and readiness is red.' : '.') + (sess ? ' Suggest a lighter version of ' + sess.title + '.' : ''),
        athleteIds: [a.id], confidence: 0.82,
        evidence: [{ label: 'ACWR', value: r.toFixed(2), tone: 'bad' }, { label: 'This week', value: AMS.calc.weekLoad(a) + ' AU', tone: 'warn' }, { label: 'Readiness', value: String(rd.score), tone: rd.band }].concat(rd.factors.filter((f) => /Soreness|Sleep/.test(f.label)).slice(0, 1)),
        actions: acts,
      };
    });
  });
  AMS.registerDetector('core.wellnessDrop', function (ctx) {
    return ctx.athletes.filter((a) => AMS.calc.acwr(a) < 1.5 && a.availability === 'Available').map((a) => {
      const recent = AMS.calc.wellnessAvg(a, 25, 28), base = AMS.calc.wellnessBaseline(a);
      if (!recent || !base || recent > base - 14) return null;
      return {
        id: 'well:' + a.id + ':' + AMS.TODAY, kind: 'wellness', severity: 'med', module: 'science',
        title: a.name + ' — wellness falling for 3 days',
        summary: 'Check-ins are ' + Math.round(base - recent) + ' points below their own 3-week normal. Worth a conversation before training.',
        athleteIds: [a.id], confidence: 0.7,
        evidence: [{ label: '3-day avg', value: Math.round(recent) + '', tone: 'bad' }, { label: 'Own normal', value: Math.round(base) + '', tone: 'good' }],
        actions: [{ label: 'Ask coach to check in', action: 'notify', payload: { toRole: 'coach', athleteId: a.id, text: 'Please check in with ' + a.name + ': wellness down 3 days running.' }, primary: true }, { label: 'Flag for physio', action: 'notify', payload: { toRole: 'physio', athleteId: a.id, text: a.name + ' wellness trending down — quick screen suggested.' } }],
      };
    }).filter(Boolean);
  });
  AMS.registerDetector('core.missedCheckins', function (ctx) {
    const missing = ctx.athletes.filter((a) => !AMS.calc.todayWellness(a) && a.availability !== 'Unavailable');
    if (!missing.length || ctx.role === 'ops') return [];
    const sq = AMS.groupBy(missing, 'squadId');
    const worst = Object.entries(sq).sort((a, b) => b[1].length - a[1].length)[0];
    return [{
      id: 'checkin:' + AMS.TODAY + ':' + missing.length, kind: 'ops', severity: missing.length > 12 ? 'med' : 'low', module: 'dashboard',
      title: missing.length + ' athletes have not checked in yet',
      summary: 'Session starts 07:30. Biggest gap: ' + AMS.org.squad(worst[0]).name + ' (' + worst[1].length + '). A push reminder usually brings 60% in within 10 minutes.',
      athleteIds: missing.map((a) => a.id), confidence: 0.9,
      evidence: [{ label: 'Check-in rate', value: AMS.calc.checkinRate(ctx.athletes) + '%', tone: 'warn' }],
      actions: [{ label: 'Send reminder to ' + missing.length, action: 'checkin.remind', payload: { athleteIds: missing.map((a) => a.id) }, primary: true }],
    }];
  });
  AMS.registerDetector('core.rehabOverdue', function (ctx) {
    if (!['physio', 'doctor', 'director', 'coach'].includes(ctx.role)) return [];
    return AMS.db.injuries.filter((i) => ctx.ids.has(i.athleteId) && i.status === 'Rehab' && i.stageSince && AMS.date.diff(AMS.TODAY, i.stageSince) > (i.stageTargetDays || 7)).map((i) => {
      const a = AMS.org.athlete(i.athleteId);
      const st = (i.rtpStages || [])[i.rtpStage] || {};
      return {
        id: 'rehab:' + i.id + ':' + i.rtpStage, kind: 'medical', severity: 'med', module: 'medical',
        title: a.name + ' — rehab stage running long',
        summary: 'In "' + (st.name || 'current stage') + '" for ' + AMS.date.diff(AMS.TODAY, i.stageSince) + ' days (plan: ' + (i.stageTargetDays || 7) + '). Review criteria or adjust the plan.',
        athleteIds: [a.id], confidence: 0.75,
        evidence: [{ label: 'Days in stage', value: String(AMS.date.diff(AMS.TODAY, i.stageSince)), tone: 'warn' }, { label: 'Plan', value: (i.stageTargetDays || 7) + 'd', tone: 'info' }],
        actions: [{ label: 'Open rehab case', action: 'open.injury', payload: { injuryId: i.id }, primary: true }],
      };
    });
  });
  AMS.registerDetector('core.verificationSla', function (ctx) {
    if (!['ops', 'director'].includes(ctx.role)) return [];
    const late = AMS.db.applications.filter((p) => ['Applied', 'Verifying', 'Docs returned'].includes(p.stage) && AMS.date.diff(AMS.TODAY, p.submitted) > 5);
    if (!late.length) return [];
    return [{
      id: 'sla:' + AMS.TODAY + ':' + late.length, kind: 'ops', severity: late.length > 3 ? 'med' : 'low', module: 'athletes',
      title: late.length + ' applications past the 5-day verification target',
      summary: 'Oldest: ' + late.sort((a, b) => a.submitted.localeCompare(b.submitted))[0].name + ' (' + AMS.date.rel(late[0].submitted) + '). AI pre-checked documents on ' + late.filter((p) => p.docs.every((d) => d.ai)).length + ' of them.',
      athleteIds: [], confidence: 0.95,
      evidence: [{ label: 'Over SLA', value: String(late.length), tone: 'warn' }],
      actions: [{ label: 'Open verification queue', action: 'go', payload: { module: 'athletes', params: { tab: 'onboarding' } }, primary: true }],
    }];
  });

  /* Core actions */
  AMS.todaySessionFor = function (a) {
    const sq = a.tempAssignment && a.tempAssignment.active ? a.tempAssignment.squadId : a.squadId;
    return AMS.db.sessions.find((s) => s.date === AMS.TODAY && s.squadId === sq && s.status !== 'Completed') || AMS.db.sessions.find((s) => s.date === AMS.TODAY && s.squadId === sq);
  };
  AMS.registerAction('go', (p) => { AMS.go(p.module, p.params); return 'Opened'; });
  AMS.registerAction('open.athlete', (p) => { AMS.openAthlete(p.athleteId, p.tab); return 'Opened'; });
  AMS.registerAction('open.injury', (p) => { AMS.openDrawer('injury', { injuryId: p.injuryId }); return 'Opened'; });
  AMS.registerAction('notify', function (p) {
    const a = p.athleteId && AMS.org.athlete(p.athleteId);
    AMS.mutate((db) => { AMS.notify({ toRole: p.toRole, title: p.title || 'Message from ' + AMS.roleLabel(AMS.ui.role), text: p.text, athleteId: p.athleteId, from: AMS.ui.role }); },
      { toast: 'Sent to ' + AMS.roleLabel(p.toRole).toLowerCase() + (a ? ' about ' + a.name.split(' ')[0] : ''), log: { type: 'notify', text: 'Notified ' + AMS.roleLabel(p.toRole) + ': ' + p.text, athleteId: p.athleteId } });
    return 'Notified';
  });
  AMS.registerAction('checkin.remind', function (p) {
    AMS.mutate((db) => { db.meta.remindersSent = (db.meta.remindersSent || 0) + p.athleteIds.length; db.meta.reminderAt = AMS.clockTime(); },
      { toast: 'Push reminder sent to ' + p.athleteIds.length + ' athletes', log: { type: 'checkin', text: 'Check-in reminder sent to ' + p.athleteIds.length + ' athletes' } });
    return 'Reminder sent';
  });
  AMS.registerAction('availability.set', function (p) {
    const a = AMS.org.athlete(p.athleteId);
    AMS.mutate((db) => { const x = AMS.byId(db.athletes, p.athleteId); x.availability = p.value; x.availabilityReason = p.reason || x.availabilityReason; },
      { toast: a.name + ' is now ' + p.value, log: { type: 'availability', text: a.name + ' set to ' + p.value + (p.reason ? ' (' + p.reason + ')' : ''), athleteId: p.athleteId } });
    return 'Updated';
  });
  /** Give one athlete an adjusted version of a session. variant: 'recovery' | 'reduced' | 'excluded' | 'rehab' */
  AMS.registerAction('session.modifyForAthlete', function (p) {
    const a = AMS.org.athlete(p.athleteId);
    const sess = p.sessionId ? AMS.byId(AMS.db.sessions, p.sessionId) : AMS.todaySessionFor(a);
    if (!sess) { AMS.toast('No session today for ' + a.name, 'bad'); return null; }
    const label = { recovery: 'recovery session', reduced: 'reduced volume (-40%)', excluded: 'excluded', rehab: 'rehab programme' }[p.variant] || p.variant;
    AMS.mutate((db) => { const s = AMS.byId(db.sessions, sess.id); s.mods = s.mods || {}; s.mods[a.id] = { variant: p.variant, by: AMS.ui.role, at: AMS.clockTime() }; },
      { toast: a.name.split(' ')[0] + ' moved to ' + label + ' for ' + sess.title, log: { type: 'training', text: a.name + ' → ' + label + ' (' + sess.title + ')', athleteId: a.id } });
    return 'Session adjusted';
  });
  AMS.registerAction('task.create', function (p) {
    AMS.mutate((db) => { db.tasks.unshift(Object.assign({ id: AMS.uid('TSK'), status: 'Open', created: AMS.TODAY, due: AMS.date.add(AMS.TODAY, 2) }, p)); }, { toast: 'Task created for ' + AMS.roleLabel(p.ownerRole || 'ops') });
    return 'Task created';
  });

  /* ------------------------------------------------------------------ bootstrap */
  AMS.boot = function () {
    let db = null;
    try { const raw = localStorage.getItem(AMS.DATA_VERSION); if (raw) db = JSON.parse(raw); } catch (e) { db = null; }
    AMS.db = db || AMS.buildSeed();
    if (db) AMS.seeds.forEach((s) => { if (!(s.key in AMS.db)) { try { s.fn(AMS.db, AMS.rng('seed:' + s.key)); } catch (e) { console.error('seed ' + s.key, e); } } }); // module data added after the save
    try {
      const u = JSON.parse(localStorage.getItem(AMS.DATA_VERSION + ':ui') || 'null');
      if (u) { AMS.ui.role = u.role || AMS.ui.role; AMS.ui.scope = u.scope || {}; AMS.ui.live = u.live !== false; if (u.module) AMS.ui.route = { module: u.module, params: {} }; }
    } catch (e) { }
    const h = (location.hash || '').slice(1);
    if (h && AMS.modules.some((m) => m.id === h)) AMS.ui.route = { module: h, params: {} };
    if (AMS.ui.role === 'athlete') AMS.ui.route = { module: 'athlete-app', params: {} };
  };
  /** Build fresh seed: base data (data.js) then every registered module seed in order. */
  AMS.buildSeed = function () {
    const db = AMS.baseSeed();
    AMS.seeds.forEach((s) => { try { s.fn(db, AMS.rng('seed:' + s.key)); } catch (e) { console.error('seed ' + s.key, e); } });
    return db;
  };
})();
