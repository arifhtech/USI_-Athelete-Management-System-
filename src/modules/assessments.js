/* USI · AMS — Assessments & Talent Identification (TID).
   Testing calendar, mobile-friendly field-testing workflow with an AI plausibility check, national benchmarks (P25–P90 by
   age group × gender, editable national standards), composite talent score with relative-age correction, progression
   analysis with trend projection, side-by-side comparison, and the National U-18 Sprint Camp shortlist workflow.
   Exposes AMS.tid so the dashboard, analytics and copilot can reuse the same numbers. */
(function () {
  'use strict';
  const AMS = window.AMS, UI = window.UI, React = window.React, html = AMS.html;
  const { useState, useMemo, useEffect, useRef } = React;
  const I = UI.Icon, D = AMS.date;
  const MOD = 'assessments';
  const HERO = 'ATH-10421';

  /* ------------------------------------------------------------------ module-scoped CSS (theme tokens only) */
  (function injectCss() {
    try {
      if (typeof document === 'undefined' || !document.createElement || document.getElementById('style-assessments')) return;
      const s = document.createElement('style');
      s.id = 'style-assessments';
      s.textContent = [
        '.tid-grid td { padding: 6px 8px; vertical-align: top; }',
        '.tid-grid th { padding: 7px 8px; }',
        '.tid-in { width: 78px; height: 30px; text-align: right; font-variant-numeric: tabular-nums; padding: 0 8px; }',
        '.tid-in.ok { border-color: color-mix(in srgb, var(--good) 55%, var(--border-strong)); }',
        '.tid-in.flag-warn { border-color: var(--warn); box-shadow: 0 0 0 2px var(--warn-weak); }',
        '.tid-in.flag-bad { border-color: var(--bad); box-shadow: 0 0 0 2px var(--bad-weak); }',
        '.tid-in:disabled { background: var(--surface-3); color: var(--fg-3); }',
        '.tid-cell { display: flex; flex-direction: column; gap: 3px; align-items: flex-end; min-width: 84px; }',
        '.tid-badge { display: inline-flex; align-items: center; gap: 3px; height: 17px; padding: 0 6px; border-radius: 9px; font-size: 10.5px; font-weight: 600; background: var(--surface-3); color: var(--fg-2); white-space: nowrap; }',
        '.tid-badge.good { background: var(--good-weak); color: var(--good); } .tid-badge.warn { background: var(--warn-weak); color: var(--warn); }',
        '.tid-badge.bad { background: var(--bad-weak); color: var(--bad); } .tid-badge.info { background: var(--info-weak); color: var(--info); } .tid-badge.accent { background: var(--accent-weak); color: var(--accent); } .tid-badge.ai { background: var(--ai-weak); color: var(--ai); }',
        '.tid-big { height: 46px; font-size: 20px; width: 100%; text-align: right; font-variant-numeric: tabular-nums; }',
        '.tid-cal { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; }',
        '.tid-cal .d { min-height: 46px; border: 1px solid var(--border); border-radius: var(--r-sm); padding: 3px 4px; font-size: 10.5px; background: var(--surface); display: flex; flex-direction: column; gap: 2px; min-width: 0; }',
        '.tid-cal .d.today { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }',
        '.tid-cal .d.past { background: var(--surface-2); color: var(--fg-3); }',
        '.tid-cal .ev { font-size: 9.5px; border-radius: 3px; padding: 0 3px; background: var(--info-weak); color: var(--info); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }',
        '.tid-cal .ev.done { background: var(--good-weak); color: var(--good); } .tid-cal .ev.pp { background: var(--warn-weak); color: var(--warn); }',
        '.tid-datebox { width: 46px; flex: none; text-align: center; border-radius: var(--r); background: var(--surface-3); padding: 4px 0; line-height: 1.1; }',
        '.tid-datebox b { display: block; font: 600 20px/1 var(--font-display); }',
        '.tid-rank { font: 600 16px/1 var(--font-display); color: var(--fg-3); }',
      ].join('\n');
      document.head.appendChild(s);
    } catch (e) { /* no DOM */ }
  })();

  /* ------------------------------------------------------------------ constants */
  const BATTERIES = [
    { id: 'Full', label: 'Full battery', tests: null },
    { id: 'Speed', label: 'Speed', tests: ['sprint30', 'flying20'] },
    { id: 'Power', label: 'Power', tests: ['slj', 'cmj', 'mbt'] },
    { id: 'Speed+Power', label: 'Speed + Power', tests: ['sprint30', 'flying20', 'slj', 'cmj'] },
    { id: 'Endurance', label: 'Endurance', tests: ['yoyo'] },
  ];
  const BATTERY_OF = { sprint30: 'Speed', flying20: 'Speed', slj: 'Power', cmj: 'Power', mbt: 'Power', yoyo: 'Endurance' };
  /** Physiologically plausible ranges for youth–senior athletes. Outside = almost certainly an entry error. */
  const LIMITS = { sprint30: [3.75, 6.8], flying20: [1.75, 3.7], slj: [110, 345], cmj: [12, 85], yoyo: [80, 3400], mbt: [2, 22] };
  /** Largest believable change vs the athlete's own last result. */
  const MAXCHG = { sprint30: 0.06, flying20: 0.07, slj: 0.12, cmj: 0.18, yoyo: 0.3, mbt: 0.18 };
  const PRESETS = {
    sprint: { label: 'Sprint & power', w: { Speed: 0.5, Power: 0.35, Endurance: 0.15 } },
    balanced: { label: 'Balanced', w: { Speed: 0.34, Power: 0.33, Endurance: 0.33 } },
    endurance: { label: 'Endurance', w: { Speed: 0.15, Power: 0.3, Endurance: 0.55 } },
  };
  const PROG_W = 0.25;
  const RAE_POINTS = { 1: -3, 2: -1, 3: 1, 4: 3 };
  const STATUS_TONE = { Completed: 'good', Scheduled: 'info', Planned: '', Postponed: 'warn', Cancelled: 'bad' };
  const ROW_STATUS = [{ value: 'present', label: 'Present' }, { value: 'absent', label: 'Absent' }, { value: 'injured', label: 'Injured' }, { value: 'deferred', label: 'Deferred' }];

  /* ------------------------------------------------------------------ helpers */
  const def = (id, db) => AMS.byId((db || AMS.db).testDefs, id);
  const testsFor = (sport, db) => (db || AMS.db).testDefs.filter((t) => !sport || t.sports.includes(sport));
  const batteryTests = (bid, sport) => { const b = BATTERIES.find((x) => x.id === bid) || BATTERIES[0]; return testsFor(sport).filter((t) => !b.tests || b.tests.includes(t.id)); };
  const fmtNum = (t, v) => (v == null || isNaN(v) ? '—' : t.unit === 's' ? (+v).toFixed(2) : t.id === 'yoyo' ? String(Math.round(v)) : (+v).toFixed(1));
  const fmtVal = (t, v) => (v == null || isNaN(v) ? '—' : fmtNum(t, v) + ' ' + t.unit);
  const roundFor = (t, v) => (t.unit === 's' ? AMS.round(v, 2) : t.id === 'yoyo' ? Math.round(v) : AMS.round(v, 1));
  const better = (t, a, b) => (t.lowerBetter ? a < b : a > b);
  const quarterOf = (dob) => Math.floor((+String(dob).slice(5, 7) - 1) / 3) + 1;
  const ageGroupOf = (a, on) => AMS.calc.ageGroup(D.ageOn(a.dob, on));
  const cohortKey = (a) => ageGroupOf(a) + '|' + a.gender;
  const cohortLabel = (key) => { const [ag, g] = key.split('|'); return (ag === '*' ? 'All ages' : ag) + ' ' + (g === 'F' ? 'women' : 'men'); };
  const pctTone = (p) => (p == null ? '' : p >= 90 ? 'good' : p >= 75 ? 'accent' : p >= 40 ? 'info' : p >= 20 ? '' : 'warn');
  const sign = (n, d) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(d != null ? AMS.round(n, d) : n);
  const firstName = (a) => (a ? a.name.split(' ')[0] : '');
  const meName = () => { const me = AMS.me(); return me ? me.name : 'Field testing team'; };

  function pctRank(sorted, v, lowerBetter) {
    const n = sorted ? sorted.length : 0;
    if (!n || v == null) return null;
    let below = 0, eq = 0;
    for (let i = 0; i < n; i++) { if (sorted[i] < v) below++; else if (sorted[i] === v) eq++; }
    const p = ((below + eq * 0.5) / n) * 100;
    return AMS.clamp(Math.round(lowerBetter ? 100 - p : p), 0, 100);
  }
  function quantile(sorted, q) {
    if (!sorted || !sorted.length) return null;
    const pos = (sorted.length - 1) * AMS.clamp(q, 0, 1); const lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  /** Performance quantile: P90 always means "better than 90%" (faster for timed tests). */
  const perfQ = (sorted, p, lowerBetter) => quantile(sorted, lowerBetter ? 1 - p / 100 : p / 100);
  function linFit(pts) { // [{x, y}] → { slope, intercept }
    if (pts.length < 2) return null;
    const mx = AMS.mean(pts.map((p) => p.x)), my = AMS.mean(pts.map((p) => p.y));
    let num = 0, den = 0; pts.forEach((p) => { num += (p.x - mx) * (p.y - my); den += (p.x - mx) * (p.x - mx); });
    if (!den) return null;
    const slope = num / den; return { slope, intercept: my - slope * mx };
  }

  /* ------------------------------------------------------------------ the model (pure; cached per store version) */
  function cohortValues(m, key, tid) {
    const c = m.cohorts[key]; const arr = c && c[tid];
    if (arr && arr.length >= 6) return arr;
    const g = m.cohorts['*|' + key.split('|')[1]];
    return (g && g[tid]) || arr || [];
  }
  function talentFor(a, m, defs) {
    const L = m.latest[a.id]; if (!L) return null;
    const key = cohortKey(a); const pcts = {}; const byB = {};
    Object.keys(L).forEach((tid) => {
      const t = defs[tid]; if (!t) return;
      const p = pctRank(cohortValues(m, key, tid), L[tid].value, t.lowerBetter); if (p == null) return;
      pcts[tid] = p; (byB[BATTERY_OF[tid]] = byB[BATTERY_OF[tid]] || []).push(p);
    });
    let wsum = 0, acc = 0; const batteries = {};
    Object.keys(byB).forEach((b) => { const avg = AMS.mean(byB[b]); batteries[b] = Math.round(avg); const w = m.preset.w[b] || 0; wsum += w; acc += w * avg; });
    if (!wsum) return null;
    const perf = acc / wsum;
    const pr = m.prog[a.id];
    const progPct = pr ? pctRank(m.progCohort[key] || [], pr.annual, false) : null;
    const raw = progPct == null ? perf : (1 - PROG_W) * perf + PROG_W * progPct;
    const ag = ageGroupOf(a), q = quarterOf(a.dob), age = D.ageOn(a.dob);
    const raeAdj = AMS.round(RAE_POINTS[q] * (ag === 'U-17' ? 1 : ag === 'U-20' ? 0.5 : 0), 1);
    const nTests = (m.hist[a.id] || []).length;
    return {
      athleteId: a.id, key, ag, q, age, pcts, batteries, perf: Math.round(perf), progPct, prog: pr || null,
      raw: AMS.clamp(Math.round(raw), 0, 100), raeAdj, score: AMS.clamp(Math.round(raw + raeAdj), 0, 100),
      active: a.enrollment === 'Active', nTests,
      earlyMat: age <= 15 && perf >= 75, rising: progPct != null && progPct >= 90 && nTests >= 2, rank: null, of: null, rawRank: null,
    };
  }
  function buildModel(db) {
    const preset = PRESETS[(db.tid && db.tid.preset) || 'sprint'] || PRESETS.sprint;
    const defs = {}; db.testDefs.forEach((t) => { defs[t.id] = t; });
    const m = { hist: {}, latest: {}, first: {}, best: {}, pending: [], cohorts: {}, progCohort: {}, prog: {}, talent: {}, lastDate: {}, preset, defs };
    const rows = db.tests.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    rows.forEach((r) => {
      const aid = r.athleteId;
      (m.hist[aid] = m.hist[aid] || []).push(r);
      m.lastDate[aid] = r.date;
      const L = (m.latest[aid] = m.latest[aid] || {}), F = (m.first[aid] = m.first[aid] || {}), B = (m.best[aid] = m.best[aid] || {});
      Object.keys(r.results || {}).forEach((tid) => {
        const v = r.results[tid], t = defs[tid];
        if (v == null || isNaN(v) || !t) return;
        const fl = r.flags && r.flags[tid];
        if (fl && fl.status === 'Pending') { m.pending.push({ rowId: r.id, athleteId: aid, testId: tid, value: v, date: r.date, flag: fl }); return; }
        L[tid] = { value: v, date: r.date, rowId: r.id };
        if (!F[tid]) F[tid] = { value: v, date: r.date };
        if (!B[tid] || better(t, v, B[tid].value)) B[tid] = { value: v, date: r.date };
      });
    });
    const push = (key, tid, v) => { const c = (m.cohorts[key] = m.cohorts[key] || {}); (c[tid] = c[tid] || []).push(v); };
    db.athletes.forEach((a) => {
      if (a.enrollment !== 'Active') return;
      const L = m.latest[a.id]; if (!L) return;
      const k = cohortKey(a);
      Object.keys(L).forEach((tid) => { push(k, tid, L[tid].value); push('*|' + a.gender, tid, L[tid].value); });
    });
    Object.keys(m.cohorts).forEach((k) => Object.keys(m.cohorts[k]).forEach((tid) => m.cohorts[k][tid].sort((x, y) => x - y)));
    db.athletes.forEach((a) => {
      const L = m.latest[a.id], F = m.first[a.id]; if (!L) return;
      const tests = {}; const ann = [];
      Object.keys(L).forEach((tid) => {
        const f = F[tid], l = L[tid], t = defs[tid]; const days = D.diff(l.date, f.date); if (days < 60) return;
        const imp = (t.lowerBetter ? f.value - l.value : l.value - f.value) / f.value * 100;
        tests[tid] = { imp: AMS.round(imp, 1), days, from: f, to: l }; ann.push((imp / days) * 365);
      });
      if (!ann.length) return;
      m.prog[a.id] = { annual: AMS.round(AMS.mean(ann), 1), total: AMS.round(AMS.mean(Object.values(tests).map((x) => x.imp)), 1), tests, n: ann.length };
      if (a.enrollment === 'Active') (m.progCohort[cohortKey(a)] = m.progCohort[cohortKey(a)] || []).push(m.prog[a.id].annual);
    });
    Object.values(m.progCohort).forEach((arr) => arr.sort((x, y) => x - y));
    db.athletes.forEach((a) => { const t = talentFor(a, m, defs); if (t) m.talent[a.id] = t; });
    const byK = AMS.groupBy(Object.values(m.talent).filter((t) => t.active), 'key');
    Object.values(byK).forEach((list) => {
      list.sort((x, y) => y.score - x.score || y.raw - x.raw); list.forEach((t, i) => { t.rank = i + 1; t.of = list.length; });
      list.slice().sort((x, y) => y.raw - x.raw).forEach((t, i) => { t.rawRank = i + 1; });
    });
    return m;
  }
  const cache = { db: null, v: -1, m: null };
  function model() {
    const db = AMS.db;
    if (cache.m && cache.db === db && cache.v === AMS.version) return cache.m;
    cache.m = buildModel(db); cache.db = db; cache.v = AMS.version;
    return cache.m;
  }
  function pctFor(a, tid, v, m) { const t = def(tid); m = m || model(); return t ? pctRank(cohortValues(m, cohortKey(a), tid), v, t.lowerBetter) : null; }
  function standardFor(tid, ag, g) { const s = AMS.db.tid && AMS.db.tid.standards; return s ? s[tid + '|' + ag + '|' + g] : null; }
  function standardForAthlete(a, tid) { return standardFor(tid, ageGroupOf(a), a.gender); }
  function retest(a, m) {
    m = m || model();
    const last = m.lastDate[a.id]; const days = last ? D.diff(AMS.TODAY, last) : null;
    const due = last ? days > 90 : D.diff(AMS.TODAY, a.enrolledOn) > 30;
    return { last, days, due, never: !last };
  }
  function upcomingFor(squadId, within) {
    return (AMS.db.tid.sessions || []).filter((s) => s.squadIds.includes(squadId) && ['Scheduled', 'Planned'].includes(s.status) && s.date >= AMS.TODAY && (!within || D.diff(s.date, AMS.TODAY) <= within)).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  }
  function openInjury(a) { return AMS.db.injuries.find((i) => i.athleteId === a.id && i.status !== 'Closed'); }
  function defaultStatus(a) { return a.availability === 'Unavailable' || a.availability === 'Modified' ? 'injured' : 'present'; }
  function eligibleForCamp(a) {
    const sl = AMS.db.tid.shortlist;
    if (a.sport !== 'Athletics') return { ok: false, why: 'Camp is for athletics sprinters & jumpers' };
    if (!['Sprints', 'Jumps'].includes(a.discipline)) return { ok: false, why: a.discipline + ' not in camp scope' };
    if (D.ageOn(a.dob, sl.from) >= 18) return { ok: false, why: 'Over 18 on ' + D.fmt(sl.from) };
    if (a.enrollment !== 'Active') return { ok: false, why: 'Not an active athlete' };
    return { ok: true, why: '' };
  }
  const inShortlist = (aid) => !!(AMS.db.tid.shortlist.entries || []).find((e) => e.athleteId === aid);

  /** AI plausibility check. Returns null when the value looks fine, else { level, reason, expected, suggestion }. */
  function check(a, tid, v, m) {
    m = m || model();
    const t = def(tid); if (!t || v == null || isNaN(v)) return null;
    const lim = LIMITS[tid];
    const last = m.latest[a.id] && m.latest[a.id][tid];
    let level = null, reason = '';
    if (lim && (v < lim[0] || v > lim[1])) { level = 'implausible'; reason = fmtVal(t, v) + ' is outside the physiological range for ' + t.name + ' (' + fmtNum(t, lim[0]) + '–' + fmtNum(t, lim[1]) + ' ' + t.unit + ').'; }
    else if (last) {
      const chg = (v - last.value) / last.value; const lc = MAXCHG[tid] || 0.15;
      if (Math.abs(chg) > lc) { level = 'outlier'; reason = Math.round(Math.abs(chg) * 100) + '% ' + (better(t, v, last.value) ? 'better' : 'worse') + ' than ' + firstName(a) + '\'s own last result (' + fmtVal(t, last.value) + ', ' + D.fmt(last.date) + '). Real change between tests is usually under ' + Math.round(lc * 100) + '%.'; }
    }
    if (!level) return null;
    let expected = '';
    if (last) { const lo = last.value * (1 - MAXCHG[tid]), hi = last.value * (1 + MAXCHG[tid]); expected = fmtNum(t, lo) + '–' + fmtNum(t, hi) + ' ' + t.unit; }
    else { const vals = cohortValues(m, cohortKey(a), tid); if (vals.length) expected = fmtNum(t, quantile(vals, 0.1)) + '–' + fmtNum(t, quantile(vals, 0.9)) + ' ' + t.unit + ' (cohort P10–P90)'; }
    let suggestion = null;
    if (last && lim) {
      const cands = [v * 10, v / 10].concat(t.unit === 's' ? [v + 1, v - 1] : t.unit === 'cm' ? [v + 100, v - 100] : []);
      const best = cands.filter((c) => c >= lim[0] && c <= lim[1]).map((c) => ({ c, d: Math.abs(c - last.value) / last.value })).filter((x) => x.d <= MAXCHG[tid]).sort((x, y) => x.d - y.d)[0];
      if (best) suggestion = roundFor(t, best.c);
    }
    return { level, reason, expected, suggestion, last };
  }
  function projection(a, tid, m) {
    m = m || model();
    const t = def(tid); const std = standardForAthlete(a, tid);
    const pts = (m.hist[a.id] || []).filter((r) => r.results[tid] != null && !(r.flags && r.flags[tid] && r.flags[tid].status === 'Pending'));
    if (pts.length < 3 || std == null) return null;
    const x0 = pts[0].date;
    const fit = linFit(pts.map((r) => ({ x: D.diff(r.date, x0), y: r.results[tid] })));
    if (!fit) return null;
    const latest = pts[pts.length - 1];
    if (!better(t, std, latest.results[tid])) return { met: true, std, latest: latest.results[tid] };
    const improving = t.lowerBetter ? fit.slope < 0 : fit.slope > 0;
    if (!improving) return { met: false, std, stalled: true };
    const days = Math.round((std - latest.results[tid]) / fit.slope);
    if (days <= 0 || days > 540) return { met: false, std, far: true, perMonth: fit.slope * 30 };
    return { met: false, std, date: D.add(latest.date, days), days, perMonth: fit.slope * 30 };
  }

  function sessionInScope(s) {
    const sc = AMS.effectiveScope(); const lock = sc.lock || {};
    if (lock.athleteId) { const a = AMS.org.athlete(lock.athleteId); return !!a && s.squadIds.includes(a.squadId); }
    const c = AMS.org.centre(s.centreId); if (!c) return false;
    if (sc.stateId && c.stateId !== sc.stateId) return false;
    if (sc.centreId && s.centreId !== sc.centreId) return false;
    const sqs = s.squadIds.map((id) => AMS.org.squad(id)).filter(Boolean);
    if (lock.squadIds) { if (sqs.length ? !sqs.some((q) => lock.squadIds.includes(q.id)) : s.centreId !== lock.centreId) return false; }
    if (sc.squadId && sqs.length && !s.squadIds.includes(sc.squadId)) return false;
    if (sc.sport && sqs.length && !sqs.some((q) => q.sport === sc.sport)) return false;
    return true;
  }
  function scopedSquads() {
    const ids = new Set();
    AMS.scopedAthletes().forEach((a) => { ids.add(a.squadId); if (a.tempAssignment && a.tempAssignment.active) ids.add(a.tempAssignment.squadId); });
    const lock = AMS.effectiveScope().lock || {};
    return AMS.db.org.squads.filter((s) => ids.has(s.id) && (!lock.squadIds || lock.squadIds.includes(s.id)));
  }
  const rosterOf = (squadId) => AMS.scopedAthletes().filter((a) => a.squadId === squadId || (a.tempAssignment && a.tempAssignment.active && a.tempAssignment.squadId === squadId)).sort((x, y) => x.name.localeCompare(y.name));

  AMS.tid = { model, buildModel, check, pctFor, percentile: pctFor, talent: (id) => model().talent[id] || null, latest: (id) => model().latest[id] || {}, retest, projection, standardFor, standardForAthlete, fmtVal, fmtNum, def, BATTERIES, testsFor, batteryTests, quarterOf, eligibleForCamp, inShortlist, PRESETS, RAE_POINTS };

  /* ------------------------------------------------------------------ seed: testing calendar, standards, shortlist, one pending outlier */
  AMS.registerSeed('tid', function (db) {
    const ath = (id) => db.athletes.find((a) => a.id === id);
    const postponed = { GUW: 'Postponed — Sarusajai track waterlogged after heavy rain', BBS: 'Postponed — Kalinga turf resurfacing' };
    // 1. September testing did not happen at two centres → their athletes are now > 90 days without a test.
    db.tests = db.tests.filter((t) => { if (t.date !== '2026-09-26') return true; const a = ath(t.athleteId); return !(a && postponed[a.centreId]); });
    // 2. A typo from the Mumbai September entry, caught by the AI check but never confirmed.
    const mumbai = db.athletes.filter((a) => a.squadId === 'SQ-MUM-SPR17');
    const typoA = mumbai[3] || mumbai[0];
    const typoRow = typoA && db.tests.find((t) => t.athleteId === typoA.id && t.date === '2026-09-26');
    if (typoRow && typoRow.results.sprint30) {
      const real = typoRow.results.sprint30; typoRow.results.sprint30 = AMS.round(real - 1, 2);
      typoRow.flags = { sprint30: { status: 'Pending', check: 'implausible', reason: typoRow.results.sprint30.toFixed(2) + ' s is outside the physiological range for 30 m sprint (3.75–6.80 s).', by: 'AI plausibility check', at: '2026-09-26', enteredBy: 'Mumbai Academy field team' } };
      typoRow.enteredBy = 'Mumbai Academy field team';
    }
    const lead = (cid) => { const s = db.staff.find((x) => x.role === 'scientist' && x.centreId === cid); return s ? s.name : 'Field testing team'; };
    const squadsOf = (cid) => db.org.squads.filter((s) => s.centreId === cid).map((s) => s.id);
    const sessions = [{ id: 'TS-HUNT-PUN', kind: 'Talent hunt', centreId: 'PUN', squadIds: [], date: '2026-01-18', title: 'District Talent Hunt, Pune', battery: 'Speed+Power', status: 'Completed', lead: 'Mahesh Jadhav (talent scout)', location: 'Balewadi stadium', tested: 212, absent: 0, notes: '212 school athletes screened, 9 referred to Pune HPC trials — including Priya Deshmukh (30 m 4.61 s at 15).' }];
    const Q = { '2026-03-14': 'Q1', '2026-06-20': 'Q2', '2026-09-26': 'Q3' };
    db.org.centres.forEach((c) => {
      Object.keys(Q).forEach((d) => {
        const tested = db.tests.filter((t) => t.date === d && (ath(t.athleteId) || {}).centreId === c.id).length;
        const pp = d === '2026-09-26' && postponed[c.id];
        sessions.push({ id: 'TS-' + c.id + '-' + Q[d], kind: 'Quarterly testing', centreId: c.id, squadIds: squadsOf(c.id), date: d, title: Q[d] + ' quarterly field testing', battery: 'Full', status: pp ? 'Postponed' : 'Completed', lead: lead(c.id), location: c.short + ' — track & S&C gym', tested, absent: pp ? 0 : Math.max(0, db.athletes.filter((a) => a.centreId === c.id).length - tested), notes: pp || '' });
      });
      sessions.push({ id: 'TS-' + c.id + '-Q4', kind: 'Quarterly testing', centreId: c.id, squadIds: squadsOf(c.id), date: '2026-12-19', title: 'Q4 quarterly field testing', battery: 'Full', status: 'Planned', lead: lead(c.id), location: c.short, tested: 0, absent: 0, notes: '' });
    });
    [
      ['TS-PUN-1015', 'PUN', ['SQ-PUN-SPR17', 'SQ-PUN-SPR20'], '2026-10-15', 'Pre-State Open speed check', 'Speed+Power', 'Track 1'],
      ['TS-GUW-1021', 'GUW', squadsOf('GUW'), '2026-10-21', 'Make-up Q3 testing (postponed from 26 Sep)', 'Full', 'Sarusajai indoor hall'],
      ['TS-BLR-1027', 'BLR', squadsOf('BLR'), '2026-10-27', 'Pre-season power profile', 'Power', 'S&C gym'],
      ['TS-PAT-1103', 'PAT', ['SQ-PAT-CAMP'], '2026-11-03', 'National U-18 Sprint Camp — entry testing', 'Speed+Power', 'Patiala NTC track'],
    ].forEach(([id, cid, sq, d, title, battery, loc]) => sessions.push({ id, kind: 'Field testing', centreId: cid, squadIds: sq, date: d, title, battery, status: 'Scheduled', lead: lead(cid), location: loc, tested: 0, absent: 0, notes: '' }));
    db.tid = { preset: 'sprint', sessions, standards: {}, shortlist: null, standardsLog: [] };
    // 3. National standards — top-10% of the national cohort, rounded the way federations publish them.
    const m = buildModel(db);
    const nice = (t, v) => (t.unit === 's' ? Math.round(v * 20) / 20 : t.id === 'yoyo' ? Math.round(v / 40) * 40 : t.unit === 'cm' ? Math.round(v) : Math.round(v * 2) / 2);
    db.testDefs.forEach((t) => ['U-17', 'U-20', 'Senior'].forEach((ag) => ['F', 'M'].forEach((g) => {
      const vals = (m.cohorts[ag + '|' + g] || {})[t.id];
      if (vals && vals.length >= 4) db.tid.standards[t.id + '|' + ag + '|' + g] = nice(t, perfQ(vals, 90, t.lowerBetter));
    })));
    db.tid.standards['sprint30|U-17|F'] = 4.3; db.tid.standards['flying20|U-17|F'] = 2.18; // National U-18 camp standards (published)
    // 4. National U-18 Sprint Camp shortlist (draft, opened by the director)
    const elig = (a) => a.sport === 'Athletics' && ['Sprints', 'Jumps'].includes(a.discipline) && a.enrollment === 'Active' && D.ageOn(a.dob, '2026-11-02') < 18;
    const cands = db.athletes.filter((a) => elig(a) && a.id !== HERO && a.centreId !== 'PUN' && m.talent[a.id]).sort((x, y) => m.talent[y.id].score - m.talent[x.id].score);
    const entries = [{ athleteId: HERO, note: '30 m 4.37 s (Sep) — fastest U-17 woman at Pune; +5.2% since the talent hunt. Physio screen before camp: load jump this week.', addedBy: 'Rakesh Patil', addedAt: '2026-10-05' }];
    cands.slice(0, 2).forEach((a, i) => {
      const t = m.talent[a.id]; const top = Object.keys(t.pcts).sort((x, y) => t.pcts[y] - t.pcts[x])[0];
      entries.push({ athleteId: a.id, note: 'Talent score ' + t.score + ' — ' + def(top, db).name + ' P' + t.pcts[top] + ' in ' + cohortLabel(t.key) + '.', addedBy: lead(a.centreId), addedAt: '2026-10-0' + (7 + i) });
    });
    db.tid.shortlist = {
      id: 'SL-U18-SPR', name: 'National U-18 Sprint Camp', centreId: 'PAT', squadId: 'SQ-PAT-CAMP', venue: 'Patiala NTC', from: '2026-11-02', to: '2026-12-13', quota: 12, deadline: '2026-10-20',
      status: 'Draft', entries, submittedAt: null, submittedBy: null, decidedAt: null, decidedBy: null, decisionNote: null,
      history: [{ date: '2026-10-05', text: 'Shortlist opened by the Performance Director (quota 12, deadline 20 Oct)', by: 'Dr. Anjali Rao' }].concat(entries.map((e) => ({ date: e.addedAt, text: 'Nominated ' + (ath(e.athleteId) || {}).name, by: e.addedBy }))),
    };
  });

  /* ------------------------------------------------------------------ actions (single code path for UI, AI insights, copilot, self-tests) */
  AMS.registerAction('tests.submitBatch', function (p) {
    const m = model();
    const date = p.date || AMS.TODAY;
    const sq = p.squadId && AMS.org.squad(p.squadId);
    const sess = p.sessionId && AMS.byId(AMS.db.tid.sessions, p.sessionId);
    const rows = p.rows || [];
    const present = rows.filter((r) => r.status === 'present' && r.results && Object.keys(r.results).some((k) => r.results[k] != null && !isNaN(r.results[k])));
    if (!present.length) { AMS.toast('Nothing to submit — enter at least one result', 'bad'); return null; }
    const pbs = []; let pending = 0;
    present.forEach((r) => Object.keys(r.results).forEach((tid) => {
      const v = r.results[tid]; const t = def(tid); if (v == null || isNaN(v) || !t) return;
      const fl = r.flags && r.flags[tid];
      if (fl && fl.status === 'Pending') { pending++; return; }
      const b = m.best[r.athleteId] && m.best[r.athleteId][tid];
      if (b && better(t, v, b.value)) pbs.push({ athleteId: r.athleteId, testId: tid, value: v, prev: b.value });
    }));
    const label = sess ? sess.title : (sq ? sq.name + ' — field test' : 'Field test');
    const where = sq ? AMS.org.centre(sq.centreId).short : (sess ? AMS.org.centre(sess.centreId).short : '');
    const notPresent = rows.filter((r) => r.status !== 'present').length;
    const by = meName();
    const role = AMS.ui.role;
    const summary = present.length + ' athletes tested' + (notPresent ? ', ' + notPresent + ' absent/injured/deferred' : '') + ', ' + pbs.length + ' PB' + (pbs.length === 1 ? '' : 's') + (pending ? ', ' + pending + ' value' + (pending === 1 ? '' : 's') + ' awaiting confirmation' : '');
    const pbText = pbs.slice(0, 3).map((x) => AMS.org.athlete(x.athleteId).name + ' ' + def(x.testId).name + ' ' + fmtVal(def(x.testId), x.value)).join('; ');
    AMS.mutate((db) => {
      present.forEach((r) => {
        const results = {}; const flags = {};
        Object.keys(r.results).forEach((tid) => { const v = r.results[tid]; if (v == null || isNaN(v)) return; results[tid] = +v; const fl = r.flags && r.flags[tid]; if (fl) flags[tid] = Object.assign({ by: 'AI plausibility check', at: date, enteredBy: by }, fl, fl.status === 'Confirmed' ? { confirmedBy: by, confirmedAt: date } : {}); });
        const row = { id: AMS.uid('TST'), athleteId: r.athleteId, date, results, enteredBy: by, event: label, sessionId: p.sessionId || null };
        if (Object.keys(flags).length) row.flags = flags;
        db.tests.push(row);
      });
      const absentIds = rows.filter((r) => r.status !== 'present').map((r) => ({ athleteId: r.athleteId, status: r.status }));
      if (sess) { const s = AMS.byId(db.tid.sessions, sess.id); Object.assign(s, { status: 'Completed', completedOn: date, tested: present.length, absent: notPresent, absentees: absentIds }); }
      else db.tid.sessions.push({ id: AMS.uid('TS'), kind: 'Ad hoc', centreId: sq ? sq.centreId : null, squadIds: sq ? [sq.id] : [], date, title: label, battery: p.battery || 'Full', status: 'Completed', lead: by, location: '', tested: present.length, absent: notPresent, absentees: absentIds, completedOn: date, notes: '' });
      pbs.forEach((pb) => { const a = AMS.org.athlete(pb.athleteId); const t = def(pb.testId); AMS.log({ type: 'assessment', text: a.name + ' — new PB in ' + t.name + ': ' + fmtVal(t, pb.value) + ' (was ' + fmtVal(t, pb.prev) + ')', athleteId: a.id }); });
      if (role !== 'coach') AMS.notify({ toRole: 'coach', title: 'Field test results recorded', text: label + ': ' + summary + '.', module: MOD });
      if (role !== 'scientist') AMS.notify({ toRole: 'scientist', title: 'Field test results recorded', text: label + ' (' + where + '): ' + summary + '.', module: MOD });
      if (pending) AMS.notify({ toRole: 'scientist', title: pending + ' test value' + (pending === 1 ? '' : 's') + ' need confirmation', text: 'AI plausibility check flagged ' + pending + ' entr' + (pending === 1 ? 'y' : 'ies') + ' from ' + label + '. They are excluded from benchmarks until confirmed or corrected.', module: MOD });
      if (pbs.length) AMS.notify({ toRole: 'director', title: 'Field testing: ' + pbs.length + ' PB' + (pbs.length === 1 ? '' : 's') + ' at ' + where, text: pbText + (pbs.length > 3 ? ' and ' + (pbs.length - 3) + ' more' : '') + '.', module: MOD, athleteId: pbs[0].athleteId });
    }, { toast: 'Results saved — ' + summary, log: { type: 'assessment', text: 'Field test results submitted: ' + label + ' — ' + summary } });
    lastSubmit = { at: AMS.clockTime(), label, n: present.length, pbs, pending, absent: notPresent, squadId: p.squadId };
    return present.length + ' athletes recorded, ' + pbs.length + ' PBs';
  });
  let lastSubmit = null;

  AMS.registerAction('tests.scheduleDay', function (p) {
    const c = AMS.org.centre(p.centreId);
    if (!c || !p.date) { AMS.toast('Pick a centre and a date', 'bad'); return null; }
    const squads = (p.squadIds || []).map((id) => AMS.org.squad(id)).filter(Boolean);
    const title = p.title || (squads.length === 1 ? squads[0].name + ' — field testing' : 'Field testing');
    const by = meName();
    AMS.mutate((db) => {
      db.tid.sessions.push({ id: AMS.uid('TS'), kind: p.kind || 'Field testing', centreId: p.centreId, squadIds: p.squadIds || [], date: p.date, title, battery: p.battery || 'Full', status: 'Scheduled', lead: p.lead || by, location: p.location || c.short, tested: 0, absent: 0, notes: p.notes || '', createdBy: by });
      const txt = title + ' at ' + c.short + ' on ' + D.fmtLong(p.date) + ' (' + p.battery + ' battery' + (squads.length ? ', ' + squads.map((s) => s.name).join(', ') : '') + ').';
      if (AMS.ui.role !== 'coach') AMS.notify({ toRole: 'coach', title: 'Field testing scheduled', text: txt + ' Please plan a lighter session the day before.', module: MOD });
      if (AMS.ui.role !== 'scientist') AMS.notify({ toRole: 'scientist', title: 'Field testing scheduled', text: txt, module: MOD });
    }, { toast: 'Testing day scheduled for ' + D.fmt(p.date), log: { type: 'assessment', text: 'Scheduled ' + title + ' at ' + c.short + ' on ' + D.fmt(p.date) } });
    return 'Scheduled for ' + D.fmt(p.date);
  });

  AMS.registerAction('tests.confirmValue', function (p) {
    const row = AMS.byId(AMS.db.tests, p.rowId); if (!row || !row.flags || !row.flags[p.testId]) return null;
    const a = AMS.org.athlete(row.athleteId), t = def(p.testId);
    AMS.mutate((db) => { const r = AMS.byId(db.tests, p.rowId); Object.assign(r.flags[p.testId], { status: 'Confirmed', confirmedBy: meName(), confirmedAt: AMS.TODAY }); },
      { toast: 'Confirmed ' + fmtVal(t, row.results[p.testId]) + ' for ' + a.name + ' — now counts in benchmarks', log: { type: 'assessment', text: 'Confirmed flagged ' + t.name + ' value ' + fmtVal(t, row.results[p.testId]) + ' for ' + a.name, athleteId: a.id } });
    return 'Confirmed';
  });
  AMS.registerAction('tests.correctValue', function (p) {
    const row = AMS.byId(AMS.db.tests, p.rowId); const t = def(p.testId); const v = parseFloat(p.value);
    if (!row || !t || isNaN(v)) { AMS.toast('Enter a valid number', 'bad'); return null; }
    const a = AMS.org.athlete(row.athleteId); const old = row.results[p.testId];
    AMS.mutate((db) => { const r = AMS.byId(db.tests, p.rowId); r.results[p.testId] = roundFor(t, v); r.flags = r.flags || {}; r.flags[p.testId] = Object.assign({}, r.flags[p.testId], { status: 'Corrected', from: old, correctedBy: meName(), correctedAt: AMS.TODAY }); },
      { toast: a.name + ': ' + t.name + ' corrected to ' + fmtVal(t, v), log: { type: 'assessment', text: 'Corrected ' + t.name + ' for ' + a.name + ': ' + fmtVal(t, old) + ' → ' + fmtVal(t, v), athleteId: a.id } });
    return 'Corrected';
  });
  AMS.registerAction('tests.setStandard', function (p) {
    const t = def(p.testId); const v = parseFloat(p.value);
    if (!t || isNaN(v)) { AMS.toast('Enter a valid number', 'bad'); return null; }
    const key = p.testId + '|' + p.ageGroup + '|' + p.gender; const old = AMS.db.tid.standards[key];
    AMS.mutate((db) => { db.tid.standards[key] = roundFor(t, v); db.tid.standardsLog.unshift({ at: AMS.TODAY + 'T' + AMS.clockTime(), key, from: old, to: roundFor(t, v), by: meName() }); },
      { toast: 'National standard updated: ' + t.name + ' ' + p.ageGroup + ' ' + p.gender + ' → ' + fmtVal(t, v), log: { type: 'assessment', text: 'National standard ' + t.name + ' (' + p.ageGroup + ' ' + (p.gender === 'F' ? 'women' : 'men') + ') changed ' + fmtVal(t, old) + ' → ' + fmtVal(t, v) } });
    return 'Standard updated';
  });
  AMS.registerAction('talent.setWeights', function (p) {
    if (!PRESETS[p.preset]) return null;
    AMS.mutate((db) => { db.tid.preset = p.preset; }, { toast: 'Talent model weights: ' + PRESETS[p.preset].label, toastKind: 'info', log: { type: 'assessment', text: 'Talent score weighting set to "' + PRESETS[p.preset].label + '"' } });
    return 'Weights set';
  });
  AMS.registerAction('talent.shortlistAdd', function (p) {
    const sl = AMS.db.tid.shortlist; const a = AMS.org.athlete(p.athleteId);
    if (!a) return null;
    if (inShortlist(a.id)) { AMS.toast(a.name + ' is already on the shortlist', 'info'); return 'Already shortlisted'; }
    if (sl.status === 'Submitted' || sl.status === 'Approved') { AMS.toast('Shortlist is ' + sl.status.toLowerCase() + ' — the director must return it before changes', 'bad'); return null; }
    const el = eligibleForCamp(a); if (!el.ok) { AMS.toast(a.name + ': ' + el.why, 'bad'); return null; }
    const t = model().talent[a.id];
    const note = p.note || (t ? 'Talent score ' + t.score + ' (cohort rank ' + t.rank + '/' + t.of + ')' + (t.prog ? ', improving ' + t.prog.annual + '%/yr' : '') + '.' : '');
    const by = meName();
    AMS.mutate((db) => { const s = db.tid.shortlist; s.entries.push({ athleteId: a.id, note, addedBy: by, addedAt: AMS.TODAY }); s.history.unshift({ date: AMS.TODAY, text: 'Nominated ' + a.name, by }); },
      { toast: a.name + ' added to the ' + sl.name + ' shortlist (' + (sl.entries.length + 1) + '/' + sl.quota + ')', log: { type: 'talent', text: a.name + ' nominated for the ' + sl.name, athleteId: a.id } });
    return 'Shortlisted';
  });
  AMS.registerAction('talent.shortlistRemove', function (p) {
    const sl = AMS.db.tid.shortlist; const a = AMS.org.athlete(p.athleteId);
    if (!a || !inShortlist(a.id)) return null;
    if (sl.status !== 'Draft') { AMS.toast('Shortlist is locked while with the director', 'bad'); return null; }
    AMS.mutate((db) => { const s = db.tid.shortlist; s.entries = s.entries.filter((e) => e.athleteId !== a.id); s.history.unshift({ date: AMS.TODAY, text: 'Removed ' + a.name, by: meName() }); },
      { toast: a.name + ' removed from the shortlist', toastKind: 'info', log: { type: 'talent', text: a.name + ' removed from the ' + sl.name + ' shortlist', athleteId: a.id } });
    return 'Removed';
  });
  AMS.registerAction('talent.shortlistNote', function (p) {
    if (!inShortlist(p.athleteId)) return null;
    AMS.mutate((db) => { const e = db.tid.shortlist.entries.find((x) => x.athleteId === p.athleteId); e.note = String(p.note || '').slice(0, 400); e.noteBy = meName(); }, { toast: 'Note saved', toastKind: 'info' });
    return 'Saved';
  });
  AMS.registerAction('talent.shortlistSubmit', function () {
    const sl = AMS.db.tid.shortlist;
    if (sl.status !== 'Draft' || !sl.entries.length) { AMS.toast(sl.entries.length ? 'Shortlist already ' + sl.status.toLowerCase() : 'Add at least one athlete first', 'bad'); return null; }
    const by = meName();
    AMS.mutate((db) => {
      const s = db.tid.shortlist;
      Object.assign(s, { status: 'Submitted', submittedAt: AMS.TODAY + 'T' + AMS.clockTime(), submittedBy: by, decisionNote: null });
      s.history.unshift({ date: AMS.TODAY, text: 'Submitted to the Performance Director (' + s.entries.length + ' athletes)', by });
      AMS.notify({ toRole: 'director', title: s.name + ' shortlist submitted', text: by + ' submitted ' + s.entries.length + ' athletes for review (quota ' + s.quota + ', deadline ' + D.fmt(s.deadline) + ').', module: MOD });
      db.tasks.unshift({ id: AMS.uid('TSK'), title: 'Review ' + s.name + ' shortlist (' + s.entries.length + ' athletes)', ownerRole: 'director', module: MOD, status: 'Open', due: s.deadline, created: AMS.TODAY, ref: s.id });
    }, { toast: 'Shortlist sent to the Performance Director', log: { type: 'talent', text: sl.name + ' shortlist submitted to the director (' + sl.entries.length + ' athletes)' } });
    return 'Submitted';
  });
  AMS.registerAction('talent.shortlistDecide', function (p) {
    const sl = AMS.db.tid.shortlist;
    if (sl.status !== 'Submitted') { AMS.toast('Nothing awaiting a decision', 'bad'); return null; }
    const approve = p.decision === 'Approved'; const by = meName();
    AMS.mutate((db) => {
      const s = db.tid.shortlist;
      Object.assign(s, { status: approve ? 'Approved' : 'Draft', decidedAt: AMS.TODAY + 'T' + AMS.clockTime(), decidedBy: by, decisionNote: p.note || null });
      s.history.unshift({ date: AMS.TODAY, text: approve ? 'Approved — camp invitations issued' : 'Returned for changes' + (p.note ? ': ' + p.note : ''), by });
      db.tasks.filter((t) => t.ref === s.id && t.status === 'Open' && t.ownerRole === 'director').forEach((t) => { t.status = 'Done'; });
      if (approve) {
        s.entries.forEach((e) => {
          const a = AMS.byId(db.athletes, e.athleteId); if (!a) return;
          if (!a.tempAssignment || a.tempAssignment.label !== s.name) a.tempAssignment = { centreId: s.centreId, squadId: s.squadId, label: s.name, from: s.from, to: s.to, active: false };
          if (!a.tags.includes('National camp selection')) a.tags = a.tags.concat(['National camp selection']);
          AMS.log({ type: 'talent', text: a.name + ' selected for the ' + s.name + ' (' + D.fmt(s.from) + '–' + D.fmt(s.to) + ')', athleteId: a.id });
        });
        AMS.notify({ toRole: 'coach', title: s.name + ': selection approved', text: s.entries.length + ' athletes selected. Temporary assignment to ' + s.venue + ' from ' + D.fmt(s.from) + ' is now on their profiles.', module: MOD });
        AMS.notify({ toRole: 'ops', title: 'Camp travel needed', text: 'Arrange travel and accommodation to ' + s.venue + ' for ' + s.entries.length + ' athletes by ' + D.fmt(D.add(s.from, -1)) + '.', module: 'athletes' });
        db.tasks.unshift({ id: AMS.uid('TSK'), title: 'Book travel to ' + s.venue + ' — ' + s.entries.length + ' camp athletes', ownerRole: 'ops', module: 'athletes', status: 'Open', due: D.add(s.from, -7), created: AMS.TODAY, ref: s.id });
      } else {
        AMS.notify({ toRole: 'coach', title: s.name + ' shortlist returned', text: 'Director note: ' + (p.note || 'please review the nominations') + '.', module: MOD });
        AMS.notify({ toRole: 'scientist', title: s.name + ' shortlist returned', text: 'Director note: ' + (p.note || 'please review the nominations') + '.', module: MOD });
      }
    }, { toast: approve ? 'Shortlist approved — coaches and ops notified' : 'Shortlist returned to the nominating staff', toastKind: approve ? 'good' : 'info', log: { type: 'talent', text: sl.name + ' shortlist ' + (approve ? 'approved' : 'returned') + ' by ' + by } });
    return approve ? 'Approved' : 'Returned';
  });

  /* ------------------------------------------------------------------ AI detectors */
  AMS.registerDetector('talent.risingStar', function (ctx) {
    if (!['director', 'coach', 'scientist'].includes(ctx.role)) return [];
    const m = model();
    const list = ctx.athletes.map((a) => ({ a, t: m.talent[a.id] })).filter((x) => x.t && x.t.rising && x.t.score >= 65)
      .sort((x, y) => y.t.progPct - x.t.progPct || y.t.score - x.t.score).slice(0, 3);
    return list.map(({ a, t }) => {
      const cohortMed = quantile(m.progCohort[t.key] || [], 0.5) || 0;
      const shortlisted = inShortlist(a.id); const el = eligibleForCamp(a);
      const acts = [];
      if (!shortlisted && el.ok && AMS.canEdit('assessments', ctx.role) && AMS.db.tid.shortlist.status === 'Draft') acts.push({ label: 'Nominate for ' + AMS.db.tid.shortlist.name, action: 'talent.shortlistAdd', payload: { athleteId: a.id }, primary: true });
      acts.push({ label: 'Open tests & talent', action: 'open.athlete', payload: { athleteId: a.id, tab: 'tests' }, primary: !acts.length });
      const since = (m.hist[a.id] || [])[0];
      return {
        id: 'tid-rising:' + a.id + ':' + (m.lastDate[a.id] || ''), kind: 'talent', severity: t.score >= 85 ? 'med' : 'low', module: MOD,
        title: a.name + ' — rising star: ' + sign(t.prog.total, 1) + '% across ' + t.prog.n + ' tests' + (since ? ' since ' + D.fmt(since.date) : ''),
        summary: 'Improving ' + t.prog.annual + '%/yr, ' + (cohortMed > 0 ? AMS.round(t.prog.annual / cohortMed, 1) + '× ' : 'well above ') + 'the ' + cohortLabel(t.key) + ' median (' + AMS.round(cohortMed, 1) + '%/yr). Talent score ' + t.score + ', cohort rank ' + t.rank + ' of ' + t.of + '.' + (shortlisted ? ' Already on the ' + AMS.db.tid.shortlist.name + ' shortlist.' : el.ok ? ' Eligible for the ' + AMS.db.tid.shortlist.name + '.' : ''),
        athleteIds: [a.id], confidence: AMS.round(Math.min(0.92, 0.55 + t.prog.n * 0.08), 2),
        evidence: [{ label: 'Progression', value: t.prog.annual + '%/yr', tone: 'good' }, { label: 'Progression pct', value: 'P' + t.progPct, tone: 'good' }, { label: 'Talent', value: String(t.score), tone: t.score >= 80 ? 'good' : 'info' }, { label: 'Tests', value: String(t.nTests), tone: 'info' }],
        actions: acts,
      };
    });
  });
  AMS.registerDetector('talent.retestDue', function (ctx) {
    if (!['director', 'coach', 'scientist'].includes(ctx.role)) return [];
    const m = model();
    const by = AMS.groupBy(ctx.athletes.filter((a) => retest(a, m).due), 'squadId');
    return Object.keys(by).map((sqId) => {
      const sq = AMS.org.squad(sqId); if (!sq) return null;
      if (upcomingFor(sqId, 21)) return null;
      const list = by[sqId]; const days = list.map((a) => retest(a, m).days).filter((x) => x != null);
      const never = list.filter((a) => retest(a, m).never).length;
      const next = upcomingFor(sqId);
      const c = AMS.org.centre(sq.centreId);
      const date = D.add(AMS.TODAY, D.dowIndex(AMS.TODAY) === 2 ? 7 : 8);
      const canEdit = AMS.canEdit('assessments', ctx.role);
      return {
        id: 'tid-retest:' + sqId + ':' + list.length + ':' + AMS.TODAY, kind: 'talent', severity: list.length >= 5 ? 'med' : 'low', module: MOD,
        title: sq.name + ' (' + c.short + ') — ' + list.length + ' athlete' + (list.length === 1 ? '' : 's') + ' overdue for testing',
        summary: (days.length ? 'Last tested ' + Math.max.apply(null, days) + ' days ago (target ≤ 90). ' : '') + (never ? never + ' never tested since enrolment. ' : '') + (next ? 'Next planned testing is ' + D.fmt(next.date) + ' — ' + D.diff(next.date, AMS.TODAY) + ' days away, too late for selection decisions.' : 'No testing day is scheduled.') + ' Without fresh results their talent scores are stale.',
        athleteIds: list.map((a) => a.id), confidence: 0.93,
        evidence: [{ label: 'Overdue', value: String(list.length), tone: 'warn' }, { label: 'Days since test', value: days.length ? String(Math.max.apply(null, days)) : 'never', tone: 'warn' }, { label: 'Target', value: '≤ 90 d', tone: 'info' }],
        actions: canEdit
          ? [{ label: 'Schedule re-test ' + D.fmt(date), action: 'tests.scheduleDay', payload: { centreId: sq.centreId, squadIds: [sqId], date, battery: 'Full', title: 'Re-test — ' + sq.name }, primary: true }]
          : [{ label: 'Ask centre scientist to schedule', action: 'notify', payload: { toRole: 'scientist', text: sq.name + ' at ' + c.short + ': ' + list.length + ' athletes are over 90 days without a field test. Please schedule a re-test before ' + D.fmt(D.add(AMS.TODAY, 14)) + '.' }, primary: true }],
      };
    }).filter(Boolean);
  });
  AMS.registerDetector('talent.outlierEntry', function (ctx) {
    if (!['director', 'coach', 'scientist'].includes(ctx.role)) return [];
    const m = model();
    return m.pending.filter((p) => ctx.ids.has(p.athleteId)).map((p) => {
      const a = AMS.org.athlete(p.athleteId); const t = def(p.testId);
      const chk = check(a, p.testId, p.value, m) || {};
      const canEdit = AMS.canEdit('assessments', ctx.role);
      const acts = [];
      if (canEdit && chk.suggestion != null) acts.push({ label: 'Correct to ' + fmtVal(t, chk.suggestion), action: 'tests.correctValue', payload: { rowId: p.rowId, testId: p.testId, value: chk.suggestion }, primary: true });
      if (canEdit) acts.push({ label: 'Confirm ' + fmtVal(t, p.value), action: 'tests.confirmValue', payload: { rowId: p.rowId, testId: p.testId } });
      acts.push({ label: 'Review in field testing', action: 'go', payload: { module: MOD, params: { tab: 'field' } }, primary: !acts.length });
      return {
        id: 'tid-outlier:' + p.rowId + ':' + p.testId, kind: 'talent', severity: chk.level === 'implausible' ? 'med' : 'low', module: MOD,
        title: a.name + ' — ' + t.name + ' of ' + fmtVal(t, p.value) + ' looks like an entry error',
        summary: (chk.reason || p.flag.reason || 'Outside expected range.') + ' Entered ' + D.fmt(p.date) + ' by ' + (p.flag.enteredBy || 'field team') + '. Excluded from benchmarks and talent scores until confirmed or corrected.' + (chk.suggestion != null ? ' Likely intended: ' + fmtVal(t, chk.suggestion) + '.' : ''),
        athleteIds: [a.id], confidence: chk.level === 'implausible' ? 0.94 : 0.72,
        evidence: [{ label: 'Entered', value: fmtVal(t, p.value), tone: 'bad' }, chk.last ? { label: 'Own last', value: fmtVal(t, chk.last.value), tone: 'info' } : null, chk.expected ? { label: 'Expected', value: chk.expected, tone: 'good' } : null].filter(Boolean),
        actions: acts,
      };
    });
  });

  /* ------------------------------------------------------------------ small shared components */
  function PctBadge({ p, title }) {
    if (p == null) return null;
    return html`<span className=${'tid-badge ' + pctTone(p)} title=${title || 'Percentile vs national cohort'}>P${p}</span>`;
  }
  function StatusPill({ s }) { return html`<${UI.Pill} tone=${STATUS_TONE[s] || ''} dot>${s}<//>`; }
  function NoEdit({ why }) { return html`<span className="row tight tiny faint" title=${why}><${I} name="lock" size=${12} />${why}</span>`; }
  function LastSubmitCard({ onClose }) {
    if (!lastSubmit) return null;
    const s = lastSubmit;
    return html`<div className="ai-box col tight anim-in">
      <div className="row between"><b className="row tight"><${I} name="check" size=${15} style=${{ color: 'var(--good)' }} />Saved at ${s.at}: ${s.label}</b><button className="btn ghost xs" onClick=${onClose}>Dismiss</button></div>
      <div className="small muted">${s.n} athletes recorded${s.absent ? ', ' + s.absent + ' absent / injured / deferred' : ''}. Progression charts, benchmarks and talent scores are already updated${s.pending ? '; ' + s.pending + ' flagged value' + (s.pending === 1 ? '' : 's') + ' wait for confirmation' : ''}.</div>
      ${s.pbs.length > 0 && html`<div className="row tight wrap">${s.pbs.slice(0, 8).map((pb, i) => { const a = AMS.org.athlete(pb.athleteId), t = def(pb.testId); return html`<span key=${i} className="evidence" style=${{ cursor: 'pointer' }} onClick=${() => AMS.openAthlete(a.id, 'tests')}><span className="dot good" style=${{ width: 6, height: 6 }} />${a.name.split(' ')[0]} PB ${t.name} <b>${fmtVal(t, pb.value)}</b></span>`; })}</div>`}
      <div className="row tight wrap"><button className="btn sm" onClick=${() => AMS.go(MOD, { tab: 'talent' })}><${I} name="target" size=${13} />Talent ranking</button><button className="btn sm" onClick=${() => AMS.go(MOD, { tab: 'progression', athleteId: s.pbs[0] ? s.pbs[0].athleteId : undefined })}><${I} name="trend-up" size=${13} />Progression</button></div>
    </div>`;
  }

  /* ------------------------------------------------------------------ TAB: testing calendar */
  function ScheduleForm({ onClose }) {
    const { db } = AMS.useStore();
    const squads = scopedSquads();
    const centres = [...new Set(squads.map((s) => s.centreId))].map((id) => AMS.org.centre(id));
    const [centreId, setCentre] = useState(centres[0] ? centres[0].id : '');
    const cSquads = squads.filter((s) => s.centreId === centreId);
    const [picked, setPicked] = useState(cSquads.slice(0, 1).map((s) => s.id));
    const [date, setDate] = useState(D.add(AMS.TODAY, 7));
    const [battery, setBattery] = useState('Full');
    const [title, setTitle] = useState('');
    const staff = db.staff.filter((s) => s.centreId === centreId && ['scientist', 'coach'].includes(s.role));
    const [lead, setLead] = useState('');
    const pickedSq = picked.map((id) => AMS.org.squad(id)).filter(Boolean);
    const sports = [...new Set(pickedSq.map((s) => s.sport))];
    const tests = batteryTests(battery, sports.length === 1 ? sports[0] : null);
    const nAth = pickedSq.reduce((n, s) => n + rosterOf(s.id).length, 0);
    const clash = db.tid.sessions.find((s) => s.date === date && s.centreId === centreId && s.status !== 'Completed');
    const comp = db.competitions.find((c) => Math.abs(D.diff(c.date, date)) <= 3 && sports.some((sp) => c.sports.includes(sp)));
    const valid = centreId && picked.length && date >= AMS.TODAY;
    const toggle = (id) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : picked.concat(id));
    return html`<div className="col" style=${{ padding: 14, border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-lg)', background: 'var(--surface-2)' }}>
      <div className="grid g3" style=${{ gap: 12 }}>
        <${UI.Field} label="Centre"><${UI.Select} value=${centreId} onChange=${(v) => { setCentre(v); setPicked(squads.filter((s) => s.centreId === v).slice(0, 1).map((s) => s.id)); setLead(''); }} options=${centres.map((c) => ({ value: c.id, label: c.short }))} /><//>
        <${UI.Field} label="Date" help=${D.fmtLong(date)}><input type="date" className="input" value=${date} min=${AMS.TODAY} onChange=${(e) => setDate(e.target.value)} /><//>
        <${UI.Field} label="Battery"><${UI.Select} value=${battery} onChange=${setBattery} options=${BATTERIES.map((b) => ({ value: b.id, label: b.label }))} /><//>
      </div>
      <${UI.Field} label=${'Squads (' + nAth + ' athletes)'}>
        <div className="row tight wrap">${cSquads.map((s) => html`<label key=${s.id} className="tag" style=${{ cursor: 'pointer', height: 26, background: picked.includes(s.id) ? 'var(--accent-weak)' : null }}><input type="checkbox" checked=${picked.includes(s.id)} onChange=${() => toggle(s.id)} />${s.name}</label>`)}</div>
      <//>
      <div className="grid g2" style=${{ gap: 12 }}>
        <${UI.Field} label="Title (optional)"><input className="input" value=${title} placeholder=${pickedSq.length === 1 ? pickedSq[0].name + ' — field testing' : 'Field testing'} onChange=${(e) => setTitle(e.target.value)} /><//>
        <${UI.Field} label="Lead"><${UI.Select} value=${lead} onChange=${setLead} placeholder=${'Me (' + meName() + ')'} options=${staff.map((s) => ({ value: s.name, label: s.name + ' · ' + s.title }))} /><//>
      </div>
      <div className="small muted">Tests: ${tests.map((t) => t.name).join(' · ') || '—'}</div>
      ${(clash || comp) && html`<div className="ai-box small"><${UI.AIChip} label="Scheduling check" /> ${clash ? html`<div>${AMS.org.centre(clash.centreId).short} already has "${clash.title}" on ${D.fmt(clash.date)}.</div>` : null}${comp ? html`<div>${comp.name} is on ${D.fmt(comp.date)} — maximal testing within 3 days of competition skews results and adds load. Consider ${D.fmt(D.add(comp.date, -7))}.</div>` : null}</div>`}
      <div className="row tight" style=${{ justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick=${onClose}>Cancel</button>
        <button className="btn primary" disabled=${!valid} onClick=${() => { const r = AMS.runAction('tests.scheduleDay', { centreId, squadIds: picked, date, battery, title: title || undefined, lead: lead || undefined }); if (r) onClose(); }}><${I} name="calendar" size=${14} />Schedule testing day</button>
      </div>
    </div>`;
  }
  function MiniCalendar({ sessions, onPick }) {
    const start = D.add(AMS.TODAY, -((D.dowIndex(AMS.TODAY) + 6) % 7));
    const days = D.range(start, 42);
    const byDate = AMS.groupBy(sessions, 'date');
    return html`<div className="col tight">
      <div className="tid-cal">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => html`<div key=${d} className="upper" style=${{ textAlign: 'center', fontSize: 9.5 }}>${d}</div>`)}</div>
      <div className="tid-cal">${days.map((d) => html`<div key=${d} className=${AMS.cx('d', d === AMS.TODAY && 'today', d < AMS.TODAY && 'past')}>
        <span className="tnum" style=${{ fontWeight: d === AMS.TODAY ? 700 : 500 }}>${+d.slice(8)}${+d.slice(8) === 1 || d === start ? ' ' + D.month(d) : ''}</span>
        ${(byDate[d] || []).slice(0, 2).map((s) => html`<span key=${s.id} className=${AMS.cx('ev', s.status === 'Completed' && 'done', s.status === 'Postponed' && 'pp')} title=${s.title + ' · ' + AMS.org.centre(s.centreId).short} onClick=${() => onPick && onPick(s)}>${AMS.org.centre(s.centreId).short.split(' ')[0]}</span>`)}
      </div>`)}</div>
    </div>`;
  }
  function SessionsTab({ openField }) {
    const { db, ui, v } = AMS.useStore();
    const m = model();
    const canEdit = AMS.canEdit('assessments');
    const [form, setForm] = useState(false);
    const [sel, setSel] = useState(null);
    const all = db.tid.sessions.filter(sessionInScope);
    const upcoming = all.filter((s) => s.date >= AMS.TODAY && ['Scheduled', 'Planned'].includes(s.status)).sort((a, b) => a.date.localeCompare(b.date));
    const past = all.filter((s) => upcoming.indexOf(s) < 0).sort((a, b) => b.date.localeCompare(a.date));
    const athletes = AMS.scopedAthletes();
    const overdue = athletes.filter((a) => retest(a, m).due);
    const testedRecent = athletes.filter((a) => m.lastDate[a.id] && D.diff(AMS.TODAY, m.lastDate[a.id]) <= 90).length;
    const pendingN = m.pending.filter((p) => athletes.some((a) => a.id === p.athleteId)).length;
    const insights = AMS.ai.insights({ module: MOD }).filter((i) => /tid-retest|tid-outlier/.test(i.id));
    const bySquad = AMS.groupBy(overdue, 'squadId');
    const selS = sel && AMS.byId(db.tid.sessions, sel);
    return html`<div className="col loose">
      <div className="grid g4">
        <${UI.KPI} label="Upcoming testing days" icon="calendar" value=${upcoming.length} foot=${upcoming[0] ? 'Next: ' + D.fmt(upcoming[0].date) + ' · ' + AMS.org.centre(upcoming[0].centreId).short : 'None scheduled'} />
        <${UI.KPI} label="Tested in last 90 days" icon="clipboard" value=${athletes.length ? Math.round((testedRecent / athletes.length) * 100) : 0} unit="%" foot=${testedRecent + ' of ' + athletes.length + ' athletes'} tone=${testedRecent / Math.max(1, athletes.length) < 0.85 ? 'warn' : ''} />
        <${UI.KPI} label="Re-test overdue" icon="clock" value=${overdue.length} tone=${overdue.length ? 'warn' : ''} foot=${'> 90 days or never tested'} onClick=${overdue.length ? () => AMS.ai.insights && setSel(null) : undefined} />
        <${UI.KPI} label="Values awaiting review" icon="alert" value=${pendingN} tone=${pendingN ? 'bad' : ''} foot="flagged by AI plausibility check" onClick=${pendingN ? () => AMS.go(MOD, { tab: 'field' }) : undefined} />
      </div>
      <div className="grid g-main">
        <div className="col">
          <${UI.Card} title="Upcoming testing days" icon="calendar" hint=${upcoming.length + ' in ' + AMS.scopeLabel()} actions=${canEdit ? html`<button className="btn sm primary" onClick=${() => setForm(!form)}><${I} name=${form ? 'x' : 'plus'} size=${13} />${form ? 'Close' : 'Schedule testing day'}</button>` : html`<${NoEdit} why="Coaches & scientists schedule testing" />`} flush>
            ${form && html`<div style=${{ padding: 14 }}><${ScheduleForm} onClose=${() => setForm(false)} /></div>`}
            <div className="list">
              ${upcoming.length === 0 && html`<${UI.Empty} icon="calendar" title="No testing days scheduled in this scope" />`}
              ${upcoming.map((s) => { const sq = s.squadIds.map((id) => AMS.org.squad(id)).filter(Boolean); const n = sq.reduce((k, q) => k + rosterOf(q.id).length, 0); const dd = D.diff(s.date, AMS.TODAY); const comp = db.competitions.find((c) => c.date >= s.date && D.diff(c.date, s.date) <= 21 && sq.some((q) => c.sports.includes(q.sport))); return html`<div key=${s.id} className=${AMS.cx('list-item', sel === s.id && 'clickable')} style=${{ alignItems: 'flex-start', background: sel === s.id ? 'var(--accent-weak)' : null }}>
                <div className="tid-datebox"><span className="tiny faint">${D.month(s.date)}</span><b>${+s.date.slice(8)}</b><span className="tiny faint">${D.dow(s.date)}</span></div>
                <div className="col tight grow" style=${{ gap: 3 }}>
                  <div className="row tight wrap"><b>${s.title}</b><${StatusPill} s=${s.status} /><span className="tag">${s.battery}</span></div>
                  <div className="small muted">${AMS.org.centre(s.centreId).short} · ${sq.map((q) => q.name).join(', ') || 'Open event'} · ${n} athletes · lead ${s.lead}</div>
                  <div className="tiny faint">${dd === 0 ? 'Today' : 'In ' + dd + ' days'}${s.location ? ' · ' + s.location : ''}${comp ? ' · ' + D.diff(comp.date, s.date) + ' days before ' + comp.name : ''}</div>
                </div>
                <div className="row tight">${canEdit && s.status === 'Scheduled' ? html`<button className="btn sm" onClick=${() => openField(s.id)}><${I} name="clipboard" size=${13} />Enter results</button>` : null}</div>
              </div>`; })}
            </div>
          <//>
          <${UI.Card} title="Testing history" icon="clock" hint=${past.length + ' days'} flush>
            <${UI.Table} compact maxHeight=${380} rows=${past} onRow=${(s) => setSel(s.id === sel ? null : s.id)} selectedId=${sel} columns=${[
              { key: 'date', label: 'Date', render: (s) => html`<span className="tnum">${D.fmt(s.date)}</span>`, sort: (s) => s.date },
              { key: 'title', label: 'Testing day', render: (s) => html`<span className="col tight" style=${{ gap: 0 }}><b className="small">${s.title}</b><span className="tiny faint">${s.kind}${s.notes ? ' · ' + s.notes : ''}</span></span>` },
              { key: 'centre', label: 'Centre', render: (s) => AMS.org.centre(s.centreId).short, sort: (s) => s.centreId, hideSm: true },
              { key: 'battery', label: 'Battery', render: (s) => html`<span className="tag">${s.battery}</span>`, hideSm: true },
              { key: 'tested', label: 'Tested', num: true, render: (s) => s.tested || '—' },
              { key: 'status', label: 'Status', render: (s) => html`<${StatusPill} s=${s.status} />`, sort: (s) => s.status },
            ]} />
          <//>
          ${selS && html`<${UI.Card} title=${selS.title} hint=${D.fmtLong(selS.date)} actions=${html`<button className="btn ghost xs" onClick=${() => setSel(null)}>Close</button>`}>
            <${UI.DL} cols=${3} items=${[['Centre', AMS.org.centre(selS.centreId).name], ['Battery', selS.battery + ' — ' + batteryTests(selS.battery).map((t) => t.name).join(', ')], ['Lead', selS.lead], ['Athletes tested', String(selS.tested || 0)], ['Absent / injured', String(selS.absent || 0)], ['Status', selS.status], selS.notes ? ['Notes', selS.notes] : null]} />
            ${selS.kind === 'Talent hunt' && html`<div className="ai-box small" style=${{ marginTop: 12 }}><${UI.AIChip} label="Talent pathway" /> Priya Deshmukh was first measured here (30 m 4.61 s, standing long jump 211 cm). Every result since sits on one record, so her progression is visible from day one. <button className="btn xs" onClick=${() => AMS.go(MOD, { tab: 'progression', athleteId: HERO })}>See her progression</button></div>`}
          <//>`}
        </div>
        <div className="col">
          <${UI.Card} ai title="Testing assistant" hint="retests & data quality">
            <${UI.InsightList} insights=${insights} max=${4} compact empty="Testing is on schedule" />
          <//>
          <${UI.Card} title="Next 6 weeks" icon="calendar"><${MiniCalendar} sessions=${all} onPick=${(s) => setSel(s.id)} /><//>
          <${UI.Card} title="Re-test overdue by squad" icon="clock" hint="target ≤ 90 days">
            ${Object.keys(bySquad).length === 0 ? html`<${UI.Empty} icon="check" title="Everyone tested in the last 90 days" />` : html`<${UI.HBars} labelWidth=${150} data=${Object.keys(bySquad).map((id) => { const q = AMS.org.squad(id); const nx = upcomingFor(id); return { label: q.name, sub: AMS.org.centre(q.centreId).short.split(' ')[0] + (nx ? ' · next ' + D.fmt(nx.date) : ''), value: bySquad[id].length, tone: nx && D.diff(nx.date, AMS.TODAY) <= 21 ? 'info' : 'warn' }; }).sort((a, b) => b.value - a.value)} />`}
          <//>
        </div>
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------------ TAB: field testing workflow */
  function PendingRow({ p, canEdit }) {
    const a = AMS.org.athlete(p.athleteId), t = def(p.testId);
    const chk = check(a, p.testId, p.value) || {};
    const [val, setVal] = useState(chk.suggestion != null ? String(chk.suggestion) : '');
    return html`<div className="list-item sev-stripe warn" style=${{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div className="col tight grow" style=${{ gap: 3, minWidth: 220 }}>
        <div className="row tight wrap"><${UI.AthleteCell} athlete=${a} size=${24} /><span className="pill bad">${t.name}: ${fmtVal(t, p.value)}</span><span className="tiny faint">${D.fmt(p.date)} · ${p.flag.enteredBy || 'field team'}</span></div>
        <div className="small muted">${chk.reason || p.flag.reason}${chk.expected ? ' Expected ' + chk.expected + '.' : ''}</div>
      </div>
      ${canEdit ? html`<div className="row tight wrap">
        <input className="input tid-in" value=${val} placeholder="Correct" inputMode="decimal" onChange=${(e) => setVal(e.target.value)} aria-label="Corrected value" />
        <button className="btn sm primary" disabled=${!val || isNaN(parseFloat(val))} onClick=${() => AMS.runAction('tests.correctValue', { rowId: p.rowId, testId: p.testId, value: val })}>Correct</button>
        <button className="btn sm" onClick=${() => AMS.runAction('tests.confirmValue', { rowId: p.rowId, testId: p.testId })}>Confirm as entered</button>
      </div>` : html`<${NoEdit} why="View only" />`}
    </div>`;
  }
  function FieldTab({ params }) {
    const { db, ui, v } = AMS.useStore();
    const m = model();
    const canEdit = AMS.canEdit('assessments');
    const squads = scopedSquads();
    const open = db.tid.sessions.filter((s) => sessionInScope(s) && s.status === 'Scheduled' && s.date >= AMS.TODAY).sort((a, b) => a.date.localeCompare(b.date));
    const [cfg, setCfg] = UI.useLocal('tid-field-cfg', { sessionId: '', squadId: '', battery: 'Full', mode: 'auto' });
    const [draft, setDraft] = UI.useLocal('tid-field-draft', {});
    const [idx, setIdx] = useState(0);
    const [, bump] = useState(0);
    const wrapRef = useRef(null);
    const width = UI.useWidth(wrapRef, 900);
    useEffect(() => {
      if (!params || !params.sessionId) return;
      const s = AMS.byId(AMS.db.tid.sessions, params.sessionId); if (!s) return;
      const sqId = s.squadIds.find((id) => squads.some((q) => q.id === id)) || cfg.squadId;
      setCfg(Object.assign({}, cfg, { sessionId: s.id, squadId: sqId, battery: s.battery }));
    }, [params && params.sessionId]);
    const sess = cfg.sessionId ? open.find((s) => s.id === cfg.sessionId) : null;
    const sessSquads = sess ? squads.filter((q) => sess.squadIds.includes(q.id)) : squads;
    const squadId = sessSquads.some((q) => q.id === cfg.squadId) ? cfg.squadId : (sessSquads[0] || squads[0] || {}).id;
    const sq = squadId && AMS.org.squad(squadId);
    const tests = sq ? batteryTests(cfg.battery, sq.sport) : [];
    const roster = sq ? rosterOf(sq.id) : [];
    const mode = cfg.mode === 'auto' ? (width < 640 ? 'one' : 'grid') : cfg.mode;
    if (!squads.length) return html`<${UI.Empty} icon="users" title="No squads in this scope" />`;

    const rows = roster.map((a) => {
      const d = draft[a.id] || {};
      const st = d.status || defaultStatus(a);
      const cells = tests.map((t) => {
        const raw = (d.vals || {})[t.id];
        const num = raw != null && String(raw).trim() !== '' ? parseFloat(String(raw).replace(',', '.')) : null;
        const ok = num != null && !isNaN(num);
        const chk = ok ? check(a, t.id, num, m) : null;
        const best = m.best[a.id] && m.best[a.id][t.id];
        return { t, raw: raw == null ? '' : raw, num: ok ? num : null, invalid: raw != null && String(raw).trim() !== '' && !ok, chk, conf: !!(d.conf || {})[t.id], pct: ok ? pctFor(a, t.id, num, m) : null, pb: ok && !chk && best && better(t, num, best.value), best };
      });
      return { a, st, cells, rd: AMS.calc.readiness(a), inj: openInjury(a), d };
    });
    const present = rows.filter((r) => r.st === 'present');
    const entered = present.reduce((n, r) => n + r.cells.filter((c) => c.num != null).length, 0);
    const expected = present.length * tests.length;
    const flags = present.flatMap((r) => r.cells.filter((c) => c.chk && !c.conf).map((c) => ({ r, c })));
    const pbs = present.flatMap((r) => r.cells.filter((c) => c.pb).map((c) => ({ r, c })));
    const injured = rows.filter((r) => r.st === 'injured');
    const reds = present.filter((r) => r.rd.band === 'bad' && tests.some((t) => t.battery === 'Speed'));
    const pendingHere = m.pending.filter((p) => AMS.scopedAthletes().some((a) => a.id === p.athleteId));

    const upd = (aid, patch) => setDraft(Object.assign({}, draft, { [aid]: Object.assign({ vals: {}, conf: {} }, draft[aid], patch) }));
    const setVal = (a, tid, s) => { const d = draft[a.id] || {}; const conf = Object.assign({}, d.conf); delete conf[tid]; upd(a.id, { vals: Object.assign({}, d.vals, { [tid]: s }), conf }); };
    const confirm = (a, tid) => { const d = draft[a.id] || {}; upd(a.id, { conf: Object.assign({}, d.conf, { [tid]: true }) }); };
    const setStatus = (a, s) => upd(a.id, { status: s });
    const focusCell = (ri, ci) => { if (typeof document === 'undefined') return; const el = document.getElementById('tid-c-' + ri + '-' + ci); if (el) { el.focus(); if (el.select) el.select(); } };
    const nextPresent = (ri, dir) => { let k = ri + dir; while (k >= 0 && k < rows.length && rows[k].st !== 'present') k += dir; return k >= 0 && k < rows.length ? k : null; };
    const onKey = (e, ri, ci) => {
      if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); const k = nextPresent(ri, 1); if (k != null) focusCell(k, ci); else if (ci + 1 < tests.length) { const f = nextPresent(-1, 1); if (f != null) focusCell(f, ci + 1); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); const k = nextPresent(ri, -1); if (k != null) focusCell(k, ci); }
    };
    const clearDraft = () => { const nd = Object.assign({}, draft); roster.forEach((a) => { delete nd[a.id]; }); setDraft(nd); };
    const submit = () => {
      const payload = rows.map((r) => {
        const results = {}, fl = {};
        if (r.st === 'present') r.cells.forEach((c) => { if (c.num == null) return; results[c.t.id] = roundFor(c.t, c.num); if (c.chk) fl[c.t.id] = { status: c.conf ? 'Confirmed' : 'Pending', check: c.chk.level, reason: c.chk.reason }; });
        return { athleteId: r.a.id, status: r.st, results, flags: fl };
      });
      const res = AMS.runAction('tests.submitBatch', { squadId: sq.id, sessionId: sess ? sess.id : null, battery: cfg.battery, rows: payload });
      if (res) { clearDraft(); if (sess) setCfg(Object.assign({}, cfg, { sessionId: '' })); setIdx(0); }
    };

    const cellView = (r, c, ri, ci, big) => {
      const disabled = !canEdit || r.st !== 'present';
      const tone = c.invalid ? 'flag-bad' : c.chk && !c.conf ? (c.chk.level === 'implausible' ? 'flag-bad' : 'flag-warn') : c.num != null ? 'ok' : '';
      return html`<div className=${big ? 'col tight' : 'tid-cell'} style=${big ? { gap: 4 } : null}>
        <input id=${(big ? 'tid-m-' : 'tid-c-') + ri + '-' + ci} className=${AMS.cx('input', big ? 'tid-big' : 'tid-in', tone)} inputMode="decimal" autoComplete="off" value=${c.raw} disabled=${disabled} placeholder=${r.st !== 'present' ? '—' : c.best ? fmtNum(c.t, c.best.value) : c.t.unit} aria-label=${r.a.name + ' ' + c.t.name}
          onChange=${(e) => setVal(r.a, c.t.id, e.target.value)} onKeyDown=${(e) => (big ? (e.key === 'Enter' && (e.preventDefault(), ci + 1 < tests.length ? focusCell2(ci + 1) : setIdx(Math.min(idx + 1, rows.length - 1)))) : onKey(e, ri, ci))} />
        <span className="row tight" style=${{ gap: 3, justifyContent: big ? 'flex-start' : 'flex-end', minHeight: 17 }}>
          ${c.invalid ? html`<span className="tid-badge bad">not a number</span>` : null}
          ${c.num != null && !c.invalid ? html`<${PctBadge} p=${c.pct} title=${'Percentile vs ' + cohortLabel(cohortKey(r.a)) + ' national cohort'} />` : null}
          ${c.pb ? html`<span className="tid-badge good" title=${'Previous best ' + fmtVal(c.t, c.best.value)}>PB</span>` : null}
          ${c.chk && !c.conf ? html`<span className=${'tid-badge ' + (c.chk.level === 'implausible' ? 'bad' : 'warn')} title=${c.chk.reason}><${I} name="alert" size=${10} />${c.chk.level === 'implausible' ? 'check' : 'outlier'}</span>` : null}
          ${c.chk && c.conf ? html`<span className="tid-badge info" title="Confirmed by you"><${I} name="check" size=${10} />ok</span>` : null}
        </span>
        ${big && c.chk && !c.conf ? html`<div className="small muted">${c.chk.reason}${c.chk.suggestion != null ? html` <button className="btn xs" onClick=${() => setVal(r.a, c.t.id, String(c.chk.suggestion))}>Use ${fmtVal(c.t, c.chk.suggestion)}</button>` : null} <button className="btn xs" onClick=${() => confirm(r.a, c.t.id)}>Confirm</button></div>` : null}
      </div>`;
    };
    const focusCell2 = (ci) => { if (typeof document === 'undefined') return; const el = document.getElementById('tid-m-' + Math.min(idx, rows.length - 1) + '-' + ci); if (el) el.focus(); };
    const statusLabel = (r) => (r.st === 'injured' ? (r.inj ? AMS.medicalLabel(r.inj) : 'Availability: ' + r.a.availability) : r.st === 'deferred' ? 'Deferred — retest within 7 days' : r.st === 'absent' ? 'Absent' : null);

    const cur = rows[Math.min(idx, Math.max(0, rows.length - 1))];
    return html`<div className="col loose" ref=${wrapRef}>
      ${lastSubmit && lastSubmit.squadId === squadId ? html`<${LastSubmitCard} onClose=${() => { lastSubmit = null; bump((x) => x + 1); }} />` : null}
      <${UI.Card} title="Field testing session" icon="clipboard" hint=${'results dated ' + D.fmtLong(AMS.TODAY)}>
        <div className="grid g4" style=${{ gap: 12 }}>
          <${UI.Field} label="Testing day"><${UI.Select} value=${sess ? sess.id : ''} placeholder="Ad hoc (not scheduled)" onChange=${(val) => { const s = open.find((x) => x.id === val); setCfg(Object.assign({}, cfg, { sessionId: val, battery: s ? s.battery : cfg.battery, squadId: s ? (s.squadIds.find((id) => squads.some((q) => q.id === id)) || cfg.squadId) : cfg.squadId })); }} options=${open.map((s) => ({ value: s.id, label: D.fmt(s.date) + ' · ' + s.title }))} /><//>
          <${UI.Field} label="Squad"><${UI.Select} value=${squadId} onChange=${(val) => setCfg(Object.assign({}, cfg, { squadId: val }))} options=${sessSquads.map((q) => ({ value: q.id, label: q.name + ' · ' + AMS.org.centre(q.centreId).short }))} /><//>
          <${UI.Field} label="Battery"><${UI.Select} value=${cfg.battery} onChange=${(val) => setCfg(Object.assign({}, cfg, { battery: val }))} options=${BATTERIES.map((b) => ({ value: b.id, label: b.label }))} /><//>
          <${UI.Field} label="Entry mode"><${UI.Seg} size="sm" value=${cfg.mode} onChange=${(val) => setCfg(Object.assign({}, cfg, { mode: val }))} options=${[{ id: 'auto', label: 'Auto' }, { id: 'grid', label: 'Grid' }, { id: 'one', label: 'One by one' }]} /><//>
        </div>
        <div className="row wrap small muted" style=${{ marginTop: 10, gap: 14 }}>
          <span><b>${roster.length}</b> athletes · <b>${tests.length}</b> tests (${tests.map((t) => t.name + ' ' + t.unit).join(', ')})</span>
          <span>Progress <b>${entered}/${expected}</b></span>
          <span className="grow"><${UI.Meter} value=${entered} max=${Math.max(1, expected)} tone=${entered === expected && expected ? 'good' : ''} /></span>
          ${!canEdit && html`<${NoEdit} why=${'Your role (' + AMS.roleLabel(ui.role) + ') can view results but not enter them'} />`}
        </div>
      <//>

      <div className="ai-box col tight">
        <div className="row tight wrap"><${UI.AIChip} label="Field assistant" /><span className="tiny faint">checks every value against the athlete's own history and physiological limits as you type</span></div>
        <div className="col tight small" style=${{ gap: 4 }}>
          ${injured.length > 0 && html`<div><${I} name="medical" size=${13} /> <b>${injured.length}</b> pre-marked injured from today's availability: ${injured.map((r) => r.a.name.split(' ')[0] + ' (' + statusLabel(r) + ')').join(', ')}. Change the status if the physio clears them for some tests.</div>`}
          ${reds.map((r) => html`<div key=${r.a.id}><${I} name="alert" size=${13} style=${{ color: 'var(--bad)' }} /> <b>${r.a.name}</b> is red today (readiness ${r.rd.score}${r.rd.factors.find((f) => /ACWR/.test(f.label)) ? ', ACWR ' + r.rd.factors.find((f) => /ACWR/.test(f.label)).value : ''}). Maximal sprint testing on a red day under-reports ability and raises hamstring risk. ${canEdit ? html`<button className="btn xs" onClick=${() => setStatus(r.a, 'deferred')}>Defer ${r.a.name.split(' ')[0]}</button>` : null}</div>`)}
          ${flags.length > 0 ? html`<div><${I} name="alert" size=${13} style=${{ color: 'var(--warn)' }} /> <b>${flags.length}</b> value${flags.length === 1 ? '' : 's'} to check before submitting — see the list below the grid.</div>` : entered > 0 ? html`<div><${I} name="check" size=${13} style=${{ color: 'var(--good)' }} /> All ${entered} values look plausible${pbs.length ? ' · ' + pbs.length + ' personal best' + (pbs.length === 1 ? '' : 's') + ' so far' : ''}.</div>` : html`<div>Percentile badges compare each value with the national ${sq ? sq.ageGroup : ''} cohort of the same gender. Use Enter / arrow keys to move down a column.</div>`}
        </div>
      </div>

      ${mode === 'grid' ? html`<${UI.Card} title=${sq ? sq.name + ' · ' + AMS.org.centre(sq.centreId).short : 'Squad'} icon="grid" flush hint="Enter ↓ moves down a column">
        <div className="tbl-wrap"><table className="tbl compact tid-grid">
          <thead><tr><th style=${{ minWidth: 190 }}>Athlete</th><th>Status</th>${tests.map((t) => html`<th key=${t.id} className="num" title=${t.lowerBetter ? 'Lower is better' : 'Higher is better'}>${t.name}<div className="tiny faint" style=${{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>${t.unit}${t.lowerBetter ? ' · lower better' : ''}</div></th>`)}</tr></thead>
          <tbody>${rows.map((r, ri) => html`<tr key=${r.a.id} style=${r.st !== 'present' ? { opacity: 0.62 } : null}>
            <td><div className="col tight" style=${{ gap: 3 }}><${UI.AthleteCell} athlete=${r.a} size=${26} sub=${D.ageOn(r.a.dob) + ' y · ' + r.a.events} /><span className="row tight"><${UI.Ring} value=${r.rd.score} tone=${r.rd.band} size=${20} thickness=${3} /><span className="tiny faint">${statusLabel(r) || 'readiness ' + AMS.calc.bandLabel(r.rd.band).toLowerCase()}</span></span></div></td>
            <td><select className="select" style=${{ height: 28, fontSize: 12 }} value=${r.st} disabled=${!canEdit} onChange=${(e) => setStatus(r.a, e.target.value)} aria-label=${'Status ' + r.a.name}>${ROW_STATUS.map((o) => html`<option key=${o.value} value=${o.value}>${o.label}</option>`)}</select></td>
            ${r.cells.map((c, ci) => html`<td key=${c.t.id} className="num">${cellView(r, c, ri, ci, false)}</td>`)}
          </tr>`)}</tbody>
        </table></div>
      <//>` : cur ? html`<${UI.Card} title=${(Math.min(idx, rows.length - 1) + 1) + ' of ' + rows.length} icon="user" hint=${sq ? sq.name : ''} actions=${html`<button className="btn sm icon" disabled=${idx <= 0} onClick=${() => setIdx(Math.max(0, idx - 1))} aria-label="Previous athlete"><${I} name="chev-l" /></button><button className="btn sm icon" disabled=${idx >= rows.length - 1} onClick=${() => setIdx(Math.min(rows.length - 1, idx + 1))} aria-label="Next athlete"><${I} name="chev-r" /></button>`}>
        <div className="col">
          <div className="row between wrap"><${UI.AthleteCell} athlete=${cur.a} size=${36} sub=${D.ageOn(cur.a.dob) + ' y · ' + cur.a.events} /><${UI.Readiness} athlete=${cur.a} showLabel size=${34} /></div>
          ${statusLabel(cur) && html`<div className="small warn">${statusLabel(cur)}</div>`}
          <${UI.Seg} value=${cur.st} onChange=${(s) => canEdit && setStatus(cur.a, s)} options=${ROW_STATUS.map((o) => ({ id: o.value, label: o.label }))} />
          ${cur.cells.map((c, ci) => html`<${UI.Field} key=${c.t.id} label=${c.t.name + ' (' + c.t.unit + (c.t.lowerBetter ? ', lower better' : '') + ')'} help=${c.best ? 'Best ' + fmtVal(c.t, c.best.value) + ' · ' + D.fmt(c.best.date) : 'No previous result'}>${cellView(cur, c, Math.min(idx, rows.length - 1), ci, true)}<//>`)}
          <div className="row tight"><div className="row tight wrap grow">${rows.map((r, i) => html`<span key=${r.a.id} onClick=${() => setIdx(i)} title=${r.a.name} style=${{ width: 10, height: 10, borderRadius: 5, cursor: 'pointer', background: i === idx ? 'var(--accent)' : r.st !== 'present' ? 'var(--border-strong)' : r.cells.every((c) => c.num != null) ? 'var(--good)' : r.cells.some((c) => c.num != null) ? 'var(--warn)' : 'var(--surface-3)', border: '1px solid var(--border)' }} />`)}</div>
          <button className="btn primary" disabled=${idx >= rows.length - 1} onClick=${() => setIdx(Math.min(rows.length - 1, idx + 1))}>Next athlete<${I} name="arrow-r" size=${14} /></button></div>
        </div>
      <//>` : html`<${UI.Empty} icon="users" title="No athletes in this squad" />`}

      ${flags.length > 0 && html`<${UI.Card} title="Check before submitting" icon="alert" hint=${flags.length + ' flagged by the AI plausibility check'} flush>
        <div className="list">${flags.map(({ r, c }) => html`<div key=${r.a.id + c.t.id} className=${'list-item sev-stripe ' + (c.chk.level === 'implausible' ? 'bad' : 'warn')} style=${{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="col tight grow" style=${{ gap: 2, minWidth: 220 }}><div className="row tight wrap"><b>${r.a.name}</b><span className=${'pill ' + (c.chk.level === 'implausible' ? 'bad' : 'warn')}>${c.t.name}: ${fmtVal(c.t, c.num)}</span><span className="tiny faint">${c.chk.level === 'implausible' ? 'physiologically implausible' : 'outside own history'}</span></div><div className="small muted">${c.chk.reason}${c.chk.expected ? ' Expected ' + c.chk.expected + '.' : ''}</div></div>
          <div className="row tight wrap">${c.chk.suggestion != null && html`<button className="btn sm primary" onClick=${() => setVal(r.a, c.t.id, String(c.chk.suggestion))}>Use ${fmtVal(c.t, c.chk.suggestion)}</button>`}<button className="btn sm" onClick=${() => confirm(r.a, c.t.id)}>Value is correct</button><button className="btn sm ghost" onClick=${() => setVal(r.a, c.t.id, '')}>Clear</button></div>
        </div>`)}</div>
      <//>`}

      <div className="card" style=${{ position: 'sticky', bottom: 8, zIndex: 3, boxShadow: 'var(--shadow-lg)' }}>
        <div className="card-b row wrap between" style=${{ gap: 10 }}>
          <div className="small muted">${present.length} present · ${rows.length - present.length} absent/injured/deferred · ${entered} values${pbs.length ? ' · ' + pbs.length + ' PBs' : ''}${flags.length ? html` · <span className="warn">${flags.length} unconfirmed flag${flags.length === 1 ? '' : 's'} will be saved as "pending review" and kept out of benchmarks</span>` : ''}</div>
          <div className="row tight">
            <${UI.ConfirmButton} label="Clear" confirmLabel="Clear all entries?" className="ghost sm" disabled=${!canEdit || !entered} onConfirm=${clearDraft} />
            <button className="btn primary" disabled=${!canEdit || !entered} onClick=${submit}><${I} name="upload" size=${14} />Submit ${entered || ''} result${entered === 1 ? '' : 's'}</button>
          </div>
        </div>
      </div>

      <${UI.Card} title="Values awaiting review" icon="flag" hint="saved earlier, excluded from benchmarks until resolved" flush>
        ${pendingHere.length ? html`<div className="list">${pendingHere.map((p) => html`<${PendingRow} key=${p.rowId + p.testId} p=${p} canEdit=${canEdit} />`)}</div>` : html`<${UI.Empty} icon="check" title="No flagged values waiting" />`}
      <//>
    </div>`;
  }

  /* ------------------------------------------------------------------ TAB: benchmarks */
  function cohortValuesFor(ag, g, tid, sport, m, ids) {
    const out = [];
    AMS.db.athletes.forEach((a) => {
      if (a.enrollment !== 'Active' || a.gender !== g || (sport && a.sport !== sport) || (ids && !ids.has(a.id))) return;
      if (ageGroupOf(a) !== ag) return;
      const L = m.latest[a.id]; if (L && L[tid]) out.push(L[tid].value);
    });
    return out.sort((x, y) => x - y);
  }
  function StdInput({ t, ag, g, value, canEdit }) {
    const [s, setS] = useState(value != null ? fmtNum(t, value) : '');
    useEffect(() => { setS(value != null ? fmtNum(t, value) : ''); }, [value, t.id]);
    if (!canEdit) return html`<b className="tnum">${value != null ? fmtNum(t, value) : '—'}</b>`;
    const commit = () => { const n = parseFloat(s); if (!isNaN(n) && roundFor(t, n) !== value) AMS.runAction('tests.setStandard', { testId: t.id, ageGroup: ag, gender: g, value: n }); };
    return html`<input className="input tid-in" value=${s} inputMode="decimal" onClick=${(e) => e.stopPropagation()} onChange=${(e) => setS(e.target.value)} onBlur=${commit} onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} aria-label=${'National standard ' + t.name + ' ' + ag + ' ' + g} />`;
  }
  function BenchmarksTab() {
    const { db, ui, v } = AMS.useStore();
    const m = model();
    const [tid, setTid] = UI.useLocal('tid-bm-test', 'sprint30');
    const [sport, setSport] = useState('');
    const [sel, setSel] = useState('U-17|F');
    const scoped = AMS.scopedAthletes();
    const ids = new Set(scoped.map((a) => a.id));
    const heroIn = ids.has(HERO);
    const [overlay, setOverlay] = useState(heroIn ? HERO : '');
    const t = def(tid) || db.testDefs[0];
    const canStd = ['director', 'scientist'].includes(ui.role);
    const sports = [...new Set(db.org.squads.map((s) => s.sport))].filter((s) => t.sports.includes(s));
    const isFed = !AMS.effectiveScope().centreId && !AMS.effectiveScope().stateId && !(AMS.effectiveScope().lock || {}).squadIds && !AMS.effectiveScope().squadId;
    const rows = ['U-17', 'U-20', 'Senior'].flatMap((ag) => ['F', 'M'].map((g) => {
      const vals = cohortValuesFor(ag, g, t.id, sport, m);
      const mine = isFed ? [] : cohortValuesFor(ag, g, t.id, sport, m, ids);
      const std = standardFor(t.id, ag, g);
      const meet = std != null && vals.length ? vals.filter((x) => !better(t, std, x)).length : null;
      return { id: ag + '|' + g, ag, g, n: vals.length, vals, p25: perfQ(vals, 25, t.lowerBetter), p50: perfQ(vals, 50, t.lowerBetter), p75: perfQ(vals, 75, t.lowerBetter), p90: perfQ(vals, 90, t.lowerBetter), std, meetPct: meet != null ? Math.round((meet / vals.length) * 100) : null, mineMed: mine.length ? perfQ(mine, 50, t.lowerBetter) : null, mineN: mine.length };
    })).filter((r) => r.n > 0);
    const cur = rows.find((r) => r.id === sel) || rows[0];
    const ov = overlay && AMS.org.athlete(overlay);
    const ovVal = ov && m.latest[ov.id] && m.latest[ov.id][t.id];
    const curve = cur ? [5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95].map((p) => ({ x: 'P' + p, y: AMS.round(perfQ(cur.vals, p, t.lowerBetter), 2) })) : [];
    const refs = [];
    if (cur && cur.std != null) refs.push({ y: cur.std, label: 'National standard ' + fmtNum(t, cur.std), tone: 'accent' });
    if (cur && cur.mineMed != null) refs.push({ y: cur.mineMed, label: AMS.scopeLabel() + ' median', tone: 'cat-2' });
    if (ovVal) refs.push({ y: ovVal.value, label: ov.name.split(' ')[0] + ' ' + fmtNum(t, ovVal.value), tone: 'ai' });
    const top = cur ? AMS.db.athletes.filter((a) => a.enrollment === 'Active' && cohortKey(a) === cur.id && (!sport || a.sport === sport) && m.latest[a.id] && m.latest[a.id][t.id]).sort((a, b) => (t.lowerBetter ? 1 : -1) * (m.latest[a.id][t.id].value - m.latest[b.id][t.id].value)).slice(0, 6) : [];
    const sd = cur && cur.vals.length > 1 ? Math.sqrt(AMS.mean(cur.vals.map((x) => (x - AMS.mean(cur.vals)) ** 2))) : 0;
    const log = (db.tid.standardsLog || []).slice(0, 4);
    return html`<div className="col loose">
      <div className="row wrap between">
        <${UI.Seg} value=${t.id} onChange=${setTid} options=${db.testDefs.map((d) => ({ id: d.id, label: d.name }))} />
        <div className="row tight"><span className="small muted">Sport</span><${UI.Select} value=${sport} onChange=${setSport} placeholder="All sports" options=${sports} /></div>
      </div>
      <${UI.Card} title=${t.name + ' — national norms'} icon="chart" hint=${t.unit + ' · ' + (t.lowerBetter ? 'lower is better, so P90 = faster than 90%' : 'higher is better') + ' · ' + t.battery + ' battery'} flush>
        <${UI.Table} compact rows=${rows} selectedId=${cur && cur.id} onRow=${(r) => setSel(r.id)} columns=${[
          { key: 'cohort', label: 'Cohort', render: (r) => html`<b>${r.ag} ${r.g === 'F' ? 'women' : 'men'}</b>`, sort: (r) => r.id },
          { key: 'n', label: 'n', num: true },
          { key: 'p25', label: 'P25', num: true, render: (r) => fmtNum(t, r.p25) },
          { key: 'p50', label: 'P50', num: true, render: (r) => html`<b>${fmtNum(t, r.p50)}</b>` },
          { key: 'p75', label: 'P75', num: true, render: (r) => fmtNum(t, r.p75) },
          { key: 'p90', label: 'P90', num: true, render: (r) => fmtNum(t, r.p90) },
          !isFed && { key: 'mine', label: AMS.scopeLabel() + ' P50', num: true, hideSm: true, render: (r) => r.mineMed != null ? html`<span className=${better(t, r.mineMed, r.p50) ? 'good' : 'warn'}>${fmtNum(t, r.mineMed)}</span>` : html`<span className="faint">—</span>`, sort: (r) => r.mineMed || 0 },
          { key: 'std', label: 'National standard', num: true, render: (r) => html`<${StdInput} t=${t} ag=${r.ag} g=${r.g} value=${r.std} canEdit=${canStd} />`, sort: (r) => r.std || 0 },
          { key: 'meet', label: 'At standard', render: (r) => r.meetPct == null ? '—' : html`<span className="row tight" style=${{ minWidth: 90 }}><${UI.Meter} value=${r.meetPct} style=${{ width: 50 }} tone=${r.meetPct >= 15 ? 'good' : 'warn'} /><span className="tnum small">${r.meetPct}%</span></span>`, sort: (r) => r.meetPct || 0 },
        ].filter(Boolean)} />
        <div className="card-f" style=${{ justifyContent: 'space-between' }}><span className="tiny faint">Computed live from each active athlete's latest valid result (pending-review values excluded). ${canStd ? 'Edit a national standard and press Enter — talent views and progression targets update immediately.' : 'National standards are set by the Performance Director and sports science.'}</span>${!canStd && html`<${I} name="lock" size=${13} />`}</div>
      <//>
      ${cur && html`<div className="grid g-main">
        <${UI.Card} title=${'Percentile curve · ' + cur.ag + ' ' + (cur.g === 'F' ? 'women' : 'men')} icon="trend-up" hint=${'n = ' + cur.n + (sport ? ' · ' + sport : '')} actions=${html`<${UI.Select} value=${overlay} onChange=${setOverlay} placeholder="Overlay athlete…" options=${scoped.filter((a) => cohortKey(a) === cur.id && m.latest[a.id] && m.latest[a.id][t.id]).sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ value: a.id, label: a.name }))} />`}>
          <${UI.LineChart} height=${240} series=${[{ name: t.name, data: curve, tone: 'accent', area: true }]} refs=${refs} yFormat=${(y) => fmtNum(t, y)} />
          <div className="small muted" style=${{ marginTop: 8 }}>${ovVal ? html`<b>${ov.name}</b>: ${fmtVal(t, ovVal.value)} (${D.fmt(ovVal.date)}) = <b>P${pctFor(ov, t.id, ovVal.value, m)}</b> nationally${cur.std != null ? (better(t, cur.std, ovVal.value) ? ', ' + fmtNum(t, Math.abs(ovVal.value - cur.std)) + ' ' + t.unit + ' short of the national standard' : ', meets the national standard') : ''}.` : 'Pick an athlete to see where they sit on the national curve.'}</div>
        <//>
        <div className="col">
          <${UI.Card} title="Cohort summary" icon="info">
            <${UI.DL} cols=${2} items=${[['Athletes', String(cur.n)], ['Mean ± SD', fmtNum(t, AMS.mean(cur.vals)) + ' ± ' + fmtNum(t, sd)], ['Best', fmtVal(t, t.lowerBetter ? cur.vals[0] : cur.vals[cur.vals.length - 1])], ['National standard', cur.std != null ? fmtVal(t, cur.std) : '—'], ['At standard', cur.meetPct != null ? cur.meetPct + '%' : '—'], ['Sports', t.sports.join(', ')]]} />
          <//>
          <${UI.Card} title="Top of the cohort" icon="flag" flush>
            <div className="list">${top.map((a, i) => html`<div key=${a.id} className="list-item clickable" onClick=${() => AMS.openDrawer('tid-talent', { athleteId: a.id })}><span className="tid-rank">${i + 1}</span><${UI.AthleteCell} athlete=${a} size=${26} /><span className="grow" /><b className="tnum">${fmtVal(t, m.latest[a.id][t.id].value)}</b>${!ids.has(a.id) && html`<span className="tag">other centre</span>`}</div>`)}</div>
          <//>
          ${log.length > 0 && html`<${UI.Card} title="Standard changes" icon="edit"><div className="col tight small">${log.map((l, i) => { const [tid2, ag, g] = l.key.split('|'); const td = def(tid2); return html`<div key=${i}>${td.name} ${ag} ${g}: ${fmtNum(td, l.from)} → <b>${fmtNum(td, l.to)}</b> <span className="faint">· ${l.by} · ${l.at.slice(11)}</span></div>`; })}</div><//>`}
        </div>
      </div>`}
    </div>`;
  }

  /* ------------------------------------------------------------------ TAB: talent ID */
  function NoteEditor({ entry, editable }) {
    const [s, setS] = useState(entry.note || '');
    useEffect(() => { setS(entry.note || ''); }, [entry.note]);
    if (!editable) return html`<div className="small muted">${entry.note || '—'}</div>`;
    const dirty = s !== (entry.note || '');
    return html`<div className="row tight" style=${{ alignItems: 'flex-start' }}><textarea className="textarea grow" style=${{ minHeight: 44, fontSize: 12 }} value=${s} onChange=${(e) => setS(e.target.value)} aria-label="Nomination note" />${dirty && html`<button className="btn xs primary" onClick=${() => AMS.runAction('talent.shortlistNote', { athleteId: entry.athleteId, note: s })}>Save</button>`}</div>`;
  }
  function ShortlistCard() {
    const { db, ui } = AMS.useStore();
    const sl = db.tid.shortlist; const m = model();
    const canEdit = AMS.canEdit('assessments'); const isDir = ui.role === 'director';
    const [note, setNote] = useState('');
    const [returning, setReturning] = useState(false);
    const editable = canEdit && sl.status === 'Draft';
    const ids = new Set(AMS.scopedAthletes().map((a) => a.id));
    const tone = { Draft: 'info', Submitted: 'warn', Approved: 'good' }[sl.status];
    return html`<${UI.Card} title=${sl.name} icon="flag" hint=${sl.venue + ' · ' + D.fmt(sl.from) + '–' + D.fmt(sl.to)} actions=${html`<${UI.Pill} tone=${tone} dot>${sl.status}<//>`} flush
      footer=${html`<div className="row wrap between" style=${{ width: '100%', gap: 8 }}>
        <span className="tiny faint">${sl.entries.length}/${sl.quota} places · deadline ${D.fmt(sl.deadline)}${sl.decisionNote ? ' · Director: "' + sl.decisionNote + '"' : ''}</span>
        <span className="row tight wrap">
          ${sl.status === 'Draft' && (canEdit ? html`<${UI.ConfirmButton} className="primary sm" icon="send" label="Submit to director" confirmLabel=${'Send ' + sl.entries.length + ' nominations?'} disabled=${!sl.entries.length} onConfirm=${() => AMS.runAction('talent.shortlistSubmit', {})} />` : html`<${NoEdit} why="Coaches & scientists nominate" />`)}
          ${sl.status === 'Submitted' && (isDir ? (returning ? html`<input className="input" style=${{ width: 180 }} placeholder="Reason for returning" value=${note} onChange=${(e) => setNote(e.target.value)} /><button className="btn sm" onClick=${() => { AMS.runAction('talent.shortlistDecide', { decision: 'Returned', note }); setReturning(false); setNote(''); }}>Return</button><button className="btn sm ghost" onClick=${() => setReturning(false)}>Cancel</button>` : html`<button className="btn sm" onClick=${() => setReturning(true)}>Return…</button><${UI.ConfirmButton} className="good sm" icon="check" label="Approve selection" confirmLabel=${'Approve ' + sl.entries.length + ' athletes?'} onConfirm=${() => AMS.runAction('talent.shortlistDecide', { decision: 'Approved' })} />`) : html`<span className="small muted">Awaiting the Performance Director since ${D.fmt((sl.submittedAt || AMS.TODAY).slice(0, 10))}</span>`)}
          ${sl.status === 'Approved' && html`<span className="small good">Approved by ${sl.decidedBy} · camp assignment on each profile · travel task with Ops</span>`}
        </span>
      </div>`}>
      <div className="list">
        ${sl.entries.length === 0 && html`<${UI.Empty} icon="users" title="No nominations yet" />`}
        ${sl.entries.map((e) => { const a = AMS.org.athlete(e.athleteId); if (!a) return null; const t = m.talent[a.id]; const rd = AMS.calc.readiness(a); return html`<div key=${e.athleteId} className="list-item" style=${{ alignItems: 'flex-start' }}>
          <div className="col tight grow" style=${{ gap: 4 }}>
            <div className="row tight wrap"><${UI.AthleteCell} athlete=${a} size=${26} />${t && html`<span className="pill accent">Talent ${t.score}</span>`}${!ids.has(a.id) && html`<span className="tag">other centre</span>`}${a.availability !== 'Available' && html`<${UI.AvailabilityPill} value=${a.availability} />`}${rd.band === 'bad' && html`<span className="pill bad">Red today</span>`}</div>
            <${NoteEditor} entry=${e} editable=${editable} />
            <span className="tiny faint">Nominated by ${e.addedBy} · ${D.fmt(e.addedAt)}</span>
          </div>
          ${editable && html`<button className="btn ghost sm icon" title="Remove" aria-label=${'Remove ' + a.name} onClick=${() => AMS.runAction('talent.shortlistRemove', { athleteId: a.id })}><${I} name="x" size=${14} /></button>`}
        </div>`; })}
      </div>
      <div style=${{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}><${UI.Timeline} items=${sl.history.slice(0, 3).map((h) => ({ date: D.fmt(h.date), title: h.text, by: h.by, icon: /Approved/.test(h.text) ? 'check' : /Submitted/.test(h.text) ? 'send' : /Returned/.test(h.text) ? 'arrow-r' : 'plus', tone: /Approved/.test(h.text) ? 'good' : /Returned/.test(h.text) ? 'warn' : null }))} /></div>
    <//>`;
  }
  function TalentTab() {
    const { db, ui, v } = AMS.useStore();
    const m = model();
    const [ag, setAg] = UI.useLocal('tid-ag', 'youth');
    const [g, setG] = useState('all');
    const athletes = AMS.scopedAthletes();
    const sports = [...new Set(athletes.map((a) => a.sport))].sort();
    const [sport, setSport] = useState(sports.includes('Athletics') ? 'Athletics' : '');
    const [rae, setRae] = useState(true);
    const [all, setAll] = useState(false);
    const canEdit = AMS.canEdit('assessments');
    const canW = ['director', 'scientist'].includes(ui.role);
    const sl = db.tid.shortlist;
    const rows = athletes.map((a) => ({ id: a.id, a, t: m.talent[a.id] })).filter((r) => r.t
      && (ag === 'all' || (ag === 'youth' ? r.t.ag !== 'Senior' : r.t.ag === ag)) && (g === 'all' || r.a.gender === g) && (!sport || r.a.sport === sport))
      .map((r) => Object.assign(r, { s: rae ? r.t.score : r.t.raw })).sort((x, y) => y.s - x.s || y.t.perf - x.t.perf);
    rows.forEach((r, i) => { r.rank = i + 1; });
    const shown = all ? rows : rows.slice(0, 40);
    // Relative age effect evidence: share of each birth quarter in the pool vs in the top quartile, before/after correction.
    const qShare = (list) => [1, 2, 3, 4].map((q) => (list.length ? Math.round((list.filter((r) => r.t.q === q).length / list.length) * 100) : 0));
    const youth = rows.filter((r) => r.t.ag !== 'Senior');
    const topN = Math.max(1, Math.round(youth.length / 4));
    const topRaw = youth.slice().sort((x, y) => y.t.raw - x.t.raw).slice(0, topN);
    const topAdj = youth.slice().sort((x, y) => y.t.score - x.t.score).slice(0, topN);
    const pool = qShare(youth), sRaw = qShare(topRaw), sAdj = qShare(topAdj);
    const moved = youth.filter((r) => r.t.rank !== r.t.rawRank).length;
    const earlyMat = rows.filter((r) => r.t.earlyMat).length;
    const cols = [
      { key: 'rank', label: '#', width: 34, render: (r) => html`<span className="tid-rank">${r.rank}</span>`, sort: (r) => r.rank },
      { key: 'name', label: 'Athlete', render: (r) => html`<${UI.AthleteCell} athlete=${r.a} size=${28} />`, sort: (r) => r.a.name },
      { key: 'age', label: 'Age · Q', render: (r) => html`<span className="tnum small">${r.t.age} · <span className=${r.t.q === 1 ? 'warn' : r.t.q === 4 ? 'info' : ''} title=${'Born ' + D.fmt(r.a.dob) + ' — birth quarter ' + r.t.q}>Q${r.t.q}</span></span>`, sort: (r) => r.t.age * 10 + r.t.q, hideSm: true },
      { key: 'perf', label: 'Tests', num: true, render: (r) => html`<span title=${Object.keys(r.t.batteries).map((b) => b + ' P' + r.t.batteries[b]).join(' · ')}>P${r.t.perf}</span>`, sort: (r) => r.t.perf },
      { key: 'prog', label: 'Progress', num: true, hideSm: true, render: (r) => r.t.prog ? html`<span className=${r.t.prog.annual > 0 ? 'good' : 'bad'}>${sign(r.t.prog.annual, 1)}%/yr</span>` : html`<span className="faint" title="Single test — no progression yet">—</span>`, sort: (r) => (r.t.prog ? r.t.prog.annual : -99) },
      { key: 'rae', label: 'RAE', num: true, hideSm: true, render: (r) => html`<span className=${r.t.raeAdj > 0 ? 'good' : r.t.raeAdj < 0 ? 'warn' : 'faint'}>${r.t.raeAdj ? sign(r.t.raeAdj, 1) : '0'}</span>`, sort: (r) => r.t.raeAdj },
      { key: 'score', label: 'Talent', render: (r) => html`<span className="row tight" style=${{ minWidth: 92 }}><b className="num" style=${{ fontSize: 18, width: 26 }}>${r.s}</b><${UI.Meter} value=${r.s} tone=${r.s >= 80 ? 'good' : r.s >= 60 ? '' : 'warn'} style=${{ width: 50 }} /></span>`, sort: (r) => r.s },
      { key: 'crank', label: 'Cohort rank', num: true, hideSm: true, render: (r) => html`<span className="small" title=${'Rank among all ' + cohortLabel(r.t.key) + ' in the federation'}>${rae ? r.t.rank : r.t.rawRank}/${r.t.of}</span>`, sort: (r) => r.t.rank },
      { key: 'flags', label: 'Flags', render: (r) => html`<span className="row tight wrap">${r.t.rising && html`<span className="pill good" title="Progression in the top 10% of cohort">Rising</span>`}${r.t.earlyMat && html`<span className="pill warn" title="Aged ≤ 15 with top-quartile results: may reflect early maturation. Measure maturity offset before selection.">Maturation?</span>`}${inShortlist(r.a.id) && html`<span className="pill accent">Shortlisted</span>`}${retest(r.a, m).due && html`<span className="pill" title="No test in > 90 days">Stale</span>`}</span>`, sort: false },
      { key: 'act', label: '', sort: false, render: (r) => { if (!canEdit || inShortlist(r.a.id) || sl.status !== 'Draft') return null; const el = eligibleForCamp(r.a); return el.ok ? html`<button className="btn xs" onClick=${(e) => { e.stopPropagation(); AMS.runAction('talent.shortlistAdd', { athleteId: r.a.id }); }} title=${'Nominate for ' + sl.name}><${I} name="plus" size=${12} />Nominate</button>` : null; } },
    ];
    return html`<div className="col loose">
      <div className="row wrap" style=${{ gap: 10 }}>
        <${UI.Seg} value=${ag} onChange=${setAg} options=${[{ id: 'youth', label: 'Youth' }, { id: 'U-17', label: 'U-17' }, { id: 'U-20', label: 'U-20' }, { id: 'Senior', label: 'Senior' }, { id: 'all', label: 'All' }]} />
        <${UI.Seg} value=${g} onChange=${setG} options=${[{ id: 'all', label: 'All' }, { id: 'F', label: 'Women' }, { id: 'M', label: 'Men' }]} />
        <${UI.Select} value=${sport} onChange=${setSport} placeholder="All sports" options=${sports} />
        <span className="grow" />
        <${UI.Toggle} id="tid-rae" checked=${rae} onChange=${setRae} label="Relative-age correction" />
      </div>
      <div className="grid g-main">
        <${UI.Card} title="Talent ranking" icon="target" hint=${rows.length + ' athletes · ' + AMS.scopeLabel()} flush footer=${rows.length > 40 ? html`<button className="btn ghost sm" onClick=${() => setAll(!all)}>${all ? 'Show top 40' : 'Show all ' + rows.length}</button>` : null}>
          <${UI.Table} compact rows=${shown} columns=${cols} onRow=${(r) => AMS.openDrawer('tid-talent', { athleteId: r.a.id })} empty="No tested athletes match these filters" />
        <//>
        <div className="col">
          <${ShortlistCard} />
          <${UI.Card} ai title="Relative age effect" hint="why Q1-born athletes get over-selected">
            <div className="col tight">
              <div className="small muted">In one selection year a January-born athlete can be almost 12 months older than a December-born team-mate — taller, stronger, faster for now. Raw test scores therefore over-select early-born (Q1) athletes, and late-born talent drops out before it matures. The correction adds ${RAE_POINTS[4]} points for Q4 and removes ${-RAE_POINTS[1]} for Q1 in U-17 (half that in U-20, none for seniors).</div>
              <${UI.BarChart} height=${150} data=${[1, 2, 3, 4].map((q, i) => ({ label: 'Q' + q, values: [pool[i], sRaw[i], sAdj[i]] }))} keys=${[{ name: 'All youth', tone: 'fg-3' }, { name: 'Top 25% raw', tone: 'warn' }, { name: 'Top 25% corrected', tone: 'ai' }]} yFormat=${(x) => x + '%'} />
              <${UI.Evidence} items=${[{ label: 'Q1 share of top 25% (raw)', value: sRaw[0] + '%', tone: sRaw[0] > pool[0] ? 'warn' : 'good' }, { label: 'corrected', value: sAdj[0] + '%', tone: 'good' }, { label: 'Q1 share of pool', value: pool[0] + '%', tone: 'info' }, { label: 'Ranks changed', value: String(moved), tone: 'info' }]} />
            </div>
          <//>
          <${UI.Card} title="How the talent score works" icon="info">
            <div className="col tight small">
              <div><b>Talent = ${Math.round((1 - PROG_W) * 100)}% test percentile + ${Math.round(PROG_W * 100)}% progression percentile + relative-age correction.</b> Percentiles are against the national cohort of the same age group and gender.</div>
              <div className="row tight wrap"><span className="muted">Battery weights</span><${UI.Seg} size="sm" value=${db.tid.preset} onChange=${(p) => canW && AMS.runAction('talent.setWeights', { preset: p })} options=${Object.keys(PRESETS).map((k) => ({ id: k, label: PRESETS[k].label }))} />${!canW && html`<${NoEdit} why="Set by director / sports science" />`}</div>
              <div className="faint">Speed ${Math.round(m.preset.w.Speed * 100)}% · Power ${Math.round(m.preset.w.Power * 100)}% · Endurance ${Math.round(m.preset.w.Endurance * 100)}%</div>
              <div className="ai-box" style=${{ padding: '8px 10px' }}><b>Maturation caveat.</b> ${earlyMat} athlete${earlyMat === 1 ? '' : 's'} aged 15 or under score in the top quartile. Early maturers look like talent at 14 and often regress by 17. No maturity offset (sitting height, PHV) is recorded yet — treat their scores as provisional and re-test in 6 months.</div>
            </div>
          <//>
        </div>
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------------ TAB: progression */
  function progressionNarrative(a, m) {
    const t = m.talent[a.id]; const pr = m.prog[a.id]; const hist = m.hist[a.id] || [];
    if (!hist.length) return null;
    const parts = []; const first = hist[0];
    if (pr) {
      const tests = Object.keys(pr.tests); const improved = tests.filter((k) => pr.tests[k].imp > 0);
      parts.push(firstName(a) + ' has improved in ' + improved.length + ' of ' + tests.length + ' tests since ' + (first.event ? 'the ' + first.event + ' (' + D.fmt(first.date) + ')' : D.fmt(first.date)) + ': ' + tests.slice(0, 4).map((k) => { const x = pr.tests[k]; const td = def(k); return td.name + ' ' + fmtNum(td, x.from.value) + ' → ' + fmtNum(td, x.to.value) + ' ' + td.unit + ' (' + sign(x.imp, 1) + '%)'; }).join(', ') + '.');
      const med = quantile(m.progCohort[t.key] || [], 0.5);
      if (t.progPct != null) parts.push('That rate (' + pr.annual + '%/yr) is faster than ' + t.progPct + '% of ' + cohortLabel(t.key) + (med ? ' — cohort median ' + AMS.round(med, 1) + '%/yr' : '') + '.');
    } else parts.push('Only one test so far (' + D.fmt(first.date) + ') — progression needs a second test at least 60 days later.');
    const proj = Object.keys(m.latest[a.id] || {}).map((tid) => ({ tid, p: projection(a, tid, m) })).filter((x) => x.p);
    const reach = proj.filter((x) => x.p.date).sort((x, y) => x.p.days - y.p.days)[0];
    const met = proj.filter((x) => x.p.met);
    if (met.length) parts.push('Already at national standard in ' + met.map((x) => def(x.tid).name).join(', ') + '.');
    if (reach) { const td = def(reach.tid); const sl = AMS.db.tid.shortlist; const inCamp = reach.p.date >= sl.from && reach.p.date <= sl.to && inShortlist(a.id); parts.push('On the current trend ' + firstName(a) + ' reaches the national ' + td.name + ' standard (' + fmtVal(td, reach.p.std) + ') around ' + D.fmt(reach.p.date) + (inCamp ? ' — during the ' + sl.name : '') + '.'); }
    const rd = AMS.calc.readiness(a);
    if (rd.band === 'bad') parts.push('Today readiness is red (' + rd.score + ') — no maximal testing this week.');
    return { text: parts.join(' '), caveat: 'Linear trend over ' + hist.length + ' tests; gains usually slow after the first year of structured training, and timing gates differ between venues (±0.03 s).' };
  }
  function ProgressionTab({ params }) {
    const { db, ui, v } = AMS.useStore();
    const m = model();
    const list = AMS.scopedAthletes().filter((a) => m.hist[a.id]).sort((a, b) => a.name.localeCompare(b.name));
    const dflt = (params && params.athleteId) || (list.some((a) => a.id === HERO) ? HERO : list[0] && list[0].id);
    const [aid, setAid] = useState(dflt);
    useEffect(() => { if (params && params.athleteId) setAid(params.athleteId); }, [params && params.athleteId]);
    const a = list.find((x) => x.id === aid) || list.find((x) => x.id === dflt) || list[0];
    if (!a) return html`<${UI.Empty} icon="trend-up" title="No tested athletes in this scope" />`;
    AMS.setFocus({ athleteId: a.id });
    const hist = (m.hist[a.id] || []);
    const t = m.talent[a.id];
    const tests = db.testDefs.filter((td) => hist.some((r) => r.results[td.id] != null));
    const nar = progressionNarrative(a, m);
    const rt = retest(a, m);
    return html`<div className="col loose">
      <div className="row wrap between">
        <div className="row tight"><span className="small muted">Athlete</span><${UI.Select} value=${a.id} onChange=${setAid} options=${list.map((x) => ({ value: x.id, label: x.name + ' · ' + AMS.org.squad(x.squadId).name }))} /></div>
        <div className="row tight"><button className="btn sm" onClick=${() => AMS.go(MOD, { tab: 'compare', athleteId: a.id })}><${I} name="swap" size=${13} />Compare</button><button className="btn sm" onClick=${() => AMS.openAthlete(a.id, 'tests')}><${I} name="user" size=${13} />Profile</button></div>
      </div>
      <div className="grid g-main">
        <${UI.Card} title=${a.name} icon="user" hint=${AMS.org.squad(a.squadId).name + ' · ' + AMS.org.centre(a.centreId).short}>
          <div className="row wrap" style=${{ gap: 18 }}>
            ${t && html`<div className="col tight" style=${{ alignItems: 'center', gap: 2 }}><${UI.Ring} value=${t.score} size=${64} thickness=${6} tone=${t.score >= 80 ? 'good' : 'accent'} /><span className="tiny faint">talent</span></div>`}
            <div className="grow"><${UI.DL} cols=${3} items=${[['Tests on record', String(hist.length)], ['First tested', D.fmt(hist[0].date) + (hist[0].event ? ' · ' + hist[0].event : '')], ['Last tested', rt.last ? D.fmt(rt.last) + ' (' + rt.days + ' d)' : '—'], ['Progression', t && t.prog ? sign(t.prog.annual, 1) + '%/yr' : '—'], ['Cohort rank', t ? t.rank + ' of ' + t.of + ' ' + cohortLabel(t.key) : '—'], ['Re-test', rt.due ? 'Overdue' : 'Due ' + D.fmt(D.add(rt.last || AMS.TODAY, 90))]]} /></div>
          </div>
          ${a.discoveredAt && html`<div className="small muted" style=${{ marginTop: 10 }}><${I} name="flag" size=${12} /> Discovered at ${a.discoveredAt.event} on ${D.fmt(a.discoveredAt.date)} by ${a.discoveredAt.by}.</div>`}
        <//>
        <${UI.Card} ai title="Progression read-out" hint="AI summary">
          ${nar && html`<div className="col tight"><div className="small">${nar.text}</div><div className="tiny faint">${nar.caveat}</div><${UI.AskCopilot} prompt=${'How is ' + a.name.split(' ')[0] + ' progressing in testing?'} label="Ask Copilot" /></div>`}
        <//>
      </div>
      <div className="grid g3">
        ${tests.map((td) => {
          const pts = hist.filter((r) => r.results[td.id] != null);
          const pend = (r) => r.flags && r.flags[td.id] && r.flags[td.id].status === 'Pending';
          const valid = pts.filter((r) => !pend(r));
          const std = standardForAthlete(a, td.id);
          const vals = cohortValues(m, cohortKey(a), td.id);
          const med = perfQ(vals, 50, td.lowerBetter);
          const pr = m.prog[a.id] && m.prog[a.id].tests[td.id];
          const last = valid[valid.length - 1];
          const proj = projection(a, td.id, m);
          const refs = [];
          if (std != null) refs.push({ y: std, label: 'Std ' + fmtNum(td, std), tone: 'accent' });
          if (med != null) refs.push({ y: med, label: 'Cohort P50', tone: 'fg-3' });
          return html`<${UI.Card} key=${td.id} title=${td.name} hint=${td.unit + (td.lowerBetter ? ' · lower better' : '')} actions=${pr ? html`<span className=${'pill ' + (pr.imp > 0 ? 'good' : 'bad')}>${sign(pr.imp, 1)}%</span>` : null}>
            <${UI.LineChart} height=${150} series=${[{ name: a.name.split(' ')[0], data: valid.map((r) => ({ x: D.fmt(r.date), y: r.results[td.id] })), tone: 'accent', area: false }]} refs=${refs} yFormat=${(y) => fmtNum(td, y)} markers=${valid[0] && valid[0].event ? [{ i: 0, label: valid[0].event.split(',')[0].split(' ').slice(0, 2).join(' '), tone: 'ai' }] : []} />
            <div className="row between small" style=${{ marginTop: 6 }}><span>Latest <b>${last ? fmtVal(td, last.results[td.id]) : '—'}</b> ${last ? html`<${PctBadge} p=${pctFor(a, td.id, last.results[td.id], m)} />` : null}</span><span className="faint">${proj ? (proj.met ? 'At standard' : proj.date ? 'Std ~' + D.fmt(proj.date) : proj.stalled ? 'Not improving' : '—') : ''}</span></div>
            ${pts.some(pend) ? html`<div className="tiny warn">1 value pending review is hidden from this chart</div>` : null}
          <//>`;
        })}
      </div>
      <${UI.Card} title="All test sessions" icon="list" flush>
        <${UI.Table} compact rows=${hist.slice().reverse()} columns=${[{ key: 'date', label: 'Date', render: (r) => html`<span className="tnum">${D.fmt(r.date)}</span>`, sort: (r) => r.date }, { key: 'event', label: 'Event', render: (r) => r.event || 'Quarterly testing', hideSm: true }].concat(tests.map((td) => ({ key: td.id, label: td.name, num: true, sort: (r) => r.results[td.id] || 0, render: (r) => { const val = r.results[td.id]; if (val == null) return html`<span className="faint">—</span>`; const b = m.best[a.id] && m.best[a.id][td.id]; const fl = r.flags && r.flags[td.id]; return html`<span className=${fl && fl.status === 'Pending' ? 'bad' : b && b.date === r.date && b.value === val ? 'good' : ''} title=${fl ? 'Flag: ' + fl.status : ''}>${fmtNum(td, val)}${b && b.date === r.date && b.value === val ? ' PB' : ''}${fl && fl.status === 'Pending' ? ' ?' : ''}</span>`; } }))).concat([{ key: 'by', label: 'Entered by', render: (r) => html`<span className="tiny faint">${r.enteredBy}</span>`, hideSm: true }])} />
      <//>
    </div>`;
  }

  /* ------------------------------------------------------------------ TAB: compare */
  function CompareTab({ params }) {
    const { db, v } = AMS.useStore();
    const m = model();
    const list = AMS.scopedAthletes().filter((a) => m.talent[a.id]).sort((a, b) => m.talent[b.id].score - m.talent[a.id].score);
    const first = (params && params.athleteId && list.some((a) => a.id === params.athleteId)) ? params.athleteId : list.some((a) => a.id === HERO) ? HERO : list[0] && list[0].id;
    const f0 = first && m.talent[first];
    const rest = list.filter((a) => a.id !== first && (!f0 || m.talent[a.id].key === f0.key)).slice(0, 2).map((a) => a.id);
    const [sel, setSel] = useState([first, rest[0] || '', rest[1] || '']);
    const [basis, setBasis] = useState('squad');
    useEffect(() => { if (params && params.athleteId) setSel([params.athleteId, sel[1] === params.athleteId ? '' : sel[1], sel[2] === params.athleteId ? '' : sel[2]]); }, [params && params.athleteId]);
    const chosen = sel.filter(Boolean).map((id) => list.find((a) => a.id === id)).filter(Boolean);
    if (!list.length) return html`<${UI.Empty} icon="swap" title="No tested athletes in this scope" />`;
    const tests = db.testDefs.filter((td) => chosen.some((a) => m.latest[a.id] && m.latest[a.id][td.id]));
    const opts = list.map((a) => ({ value: a.id, label: a.name + ' · ' + m.talent[a.id].score }));
    const setSlot = (i, val) => { const n = sel.slice(); n[i] = val; setSel(n); };
    const bestOf = (td) => { const vals = chosen.map((a) => m.latest[a.id] && m.latest[a.id][td.id] ? m.latest[a.id][td.id].value : null).filter((x) => x != null); if (vals.length < 2) return null; return td.lowerBetter ? Math.min.apply(null, vals) : Math.max.apply(null, vals); };
    const squadMedPct = (a, td) => { const mates = AMS.db.athletes.filter((x) => x.squadId === a.squadId && x.enrollment === 'Active' && m.latest[x.id] && m.latest[x.id][td.id]).map((x) => m.latest[x.id][td.id].value).sort((x, y) => x - y); if (!mates.length) return null; return pctFor(a, td.id, quantile(mates, 0.5), m); };
    const rowsT = tests.map((td) => ({ id: td.id, td }));
    const metaRows = [
      ['Talent score', (a) => html`<b className="num" style=${{ fontSize: 18 }}>${m.talent[a.id].score}</b>`],
      ['Test percentile', (a) => 'P' + m.talent[a.id].perf],
      ['Progression', (a) => (m.prog[a.id] ? sign(m.prog[a.id].annual, 1) + '%/yr' : '—')],
      ['Age · birth quarter', (a) => D.ageOn(a.dob) + ' · Q' + quarterOf(a.dob) + ' (' + sign(m.talent[a.id].raeAdj, 1) + ')'],
      ['Cohort rank', (a) => m.talent[a.id].rank + '/' + m.talent[a.id].of + ' ' + cohortLabel(m.talent[a.id].key)],
      ['Last tested', (a) => (m.lastDate[a.id] ? D.fmt(m.lastDate[a.id]) : '—')],
      ['Readiness today', (a) => html`<${UI.Readiness} athlete=${a} size=${24} showLabel />`],
      ['Camp shortlist', (a) => (inShortlist(a.id) ? html`<span className="pill accent">Shortlisted</span>` : eligibleForCamp(a).ok ? 'Eligible' : eligibleForCamp(a).why)],
    ];
    // AI head-to-head
    let h2h = null;
    if (chosen.length >= 2) {
      const lead = {}; tests.forEach((td) => { const b = bestOf(td); const w = chosen.find((a) => m.latest[a.id][td.id] && m.latest[a.id][td.id].value === b); if (w) (lead[w.id] = lead[w.id] || []).push(td.name); });
      const top = chosen.slice().sort((x, y) => m.talent[y.id].score - m.talent[x.id].score);
      const fast = chosen.filter((a) => m.prog[a.id]).sort((x, y) => m.prog[y.id].annual - m.prog[x.id].annual)[0];
      const crossCohort = new Set(chosen.map((a) => m.talent[a.id].key)).size > 1;
      h2h = top[0].name.split(' ')[0] + ' leads on talent score (' + m.talent[top[0].id].score + ' vs ' + top.slice(1).map((a) => m.talent[a.id].score).join(' / ') + ')' + (lead[top[0].id] ? ', best in ' + lead[top[0].id].join(', ') : '') + '. ' + (fast ? fast.name.split(' ')[0] + ' is improving fastest (' + m.prog[fast.id].annual + '%/yr). ' : '') + (crossCohort ? 'Different age/gender cohorts — compare percentiles, not raw values.' : 'Same cohort, so raw values are directly comparable.');
    }
    return html`<div className="col loose">
      <div className="row wrap" style=${{ gap: 10 }}>
        ${[0, 1, 2].map((i) => html`<${UI.Select} key=${i} value=${sel[i] || ''} onChange=${(val) => setSlot(i, val)} placeholder=${i === 2 ? 'Add a third athlete (optional)' : 'Pick athlete'} options=${opts.filter((o) => !sel.includes(o.value) || o.value === sel[i])} />`)}
        <span className="grow" />
        <span className="small muted">Radar benchmark</span><${UI.Seg} size="sm" value=${basis} onChange=${setBasis} options=${[{ id: 'squad', label: 'Squad median' }, { id: 'national', label: 'National standard' }]} />
      </div>
      ${h2h && html`<div className="ai-box small"><${UI.AIChip} label="Head-to-head" /> ${h2h}</div>`}
      <${UI.Card} title="Side by side" icon="swap" flush>
        <div className="tbl-wrap"><table className="tbl compact">
          <thead><tr><th>Measure</th>${chosen.map((a) => html`<th key=${a.id}><${UI.AthleteCell} athlete=${a} size=${24} /></th>`)}</tr></thead>
          <tbody>
            ${rowsT.map(({ td }) => { const b = bestOf(td); return html`<tr key=${td.id}><td><b className="small">${td.name}</b> <span className="tiny faint">${td.unit}${td.lowerBetter ? ' ↓' : ' ↑'}</span></td>${chosen.map((a) => { const L = m.latest[a.id] && m.latest[a.id][td.id]; return html`<td key=${a.id}>${L ? html`<span className="row tight"><b className=${AMS.cx('tnum', b != null && L.value === b && 'good')}>${fmtNum(td, L.value)}</b><${PctBadge} p=${pctFor(a, td.id, L.value, m)} /></span>` : html`<span className="faint">not tested</span>`}</td>`; })}</tr>`; })}
            ${metaRows.map(([label, fn]) => html`<tr key=${label}><td className="small muted">${label}</td>${chosen.map((a) => html`<td key=${a.id} className="small">${fn(a)}</td>`)}</tr>`)}
          </tbody>
        </table></div>
      <//>
      <div className="grid g3">
        ${chosen.map((a, i) => html`<${UI.Card} key=${a.id} title=${a.name} hint=${'percentiles · ' + cohortLabel(m.talent[a.id].key)}>
          <${UI.Radar} size=${240} tone=${['accent', 'cat-2', 'cat-3'][i]} label=${a.name.split(' ')[0]} compareLabel=${basis === 'squad' ? 'Squad median' : 'National standard'}
            axes=${tests.filter((td) => m.latest[a.id] && m.latest[a.id][td.id]).map((td) => { const std = standardForAthlete(a, td.id); return { label: td.name.replace('Countermovement jump', 'CMJ').replace('Standing long jump', 'SLJ').replace('Medicine ball throw (3 kg)', 'Med ball'), value: pctFor(a, td.id, m.latest[a.id][td.id].value, m), compare: basis === 'squad' ? squadMedPct(a, td) : std != null ? pctFor(a, td.id, std, m) : null }; })} />
        <//>`)}
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------------ athlete profile tab + talent drawer */
  function TalentPanel({ athlete, inDrawer }) {
    const { db, ui, v } = AMS.useStore();
    const m = model(); const a = athlete;
    if (!a) return null;
    const hist = m.hist[a.id] || [];
    const t = m.talent[a.id];
    const canEdit = AMS.canEdit('assessments');
    const rt = retest(a, m);
    if (!hist.length) return html`<div className="col"><${UI.Empty} icon="clipboard" title="No field tests yet">${rt.due ? 'Baseline test overdue — enrolled ' + D.fmt(a.enrolledOn) + '.' : 'Baseline test due within 30 days of enrolment.'}<//>${canEdit && html`<button className="btn sm" style=${{ alignSelf: 'center' }} onClick=${() => { AMS.closeAllDrawers(); AMS.go(MOD, { tab: 'sessions' }); }}>Schedule a testing day</button>`}</div>`;
    const L = m.latest[a.id] || {};
    const tests = db.testDefs.filter((td) => L[td.id]);
    const sl = db.tid.shortlist; const el = eligibleForCamp(a);
    const pend = m.pending.filter((p) => p.athleteId === a.id);
    const nar = progressionNarrative(a, m);
    return html`<div className="col">
      <div className="row wrap" style=${{ gap: 16, alignItems: 'stretch' }}>
        ${t && html`<div className="card" style=${{ padding: 14, display: 'flex', gap: 14, alignItems: 'center', flex: '1 1 260px' }}>
          <${UI.Ring} value=${t.score} size=${70} thickness=${7} tone=${t.score >= 80 ? 'good' : t.score >= 60 ? 'accent' : 'warn'} label="Talent score" />
          <div className="col tight grow" style=${{ gap: 4 }}>
            <span className="upper">Talent score</span>
            <span className="small">Tests <b>P${t.perf}</b> × ${Math.round((1 - PROG_W) * 100)}% + progression <b>${t.progPct != null ? 'P' + t.progPct : 'n/a'}</b> × ${Math.round(PROG_W * 100)}% ${t.raeAdj ? html`<span className=${t.raeAdj > 0 ? 'good' : 'warn'}>${sign(t.raeAdj, 1)} RAE (Q${t.q})</span>` : ''}</span>
            <span className="tiny faint">Cohort rank ${t.rank}/${t.of} · ${cohortLabel(t.key)}</span>
            <div className="row tight wrap">${t.rising && html`<span className="pill good">Rising star</span>`}${t.earlyMat && html`<span className="pill warn">Maturation caveat</span>`}${Object.keys(t.batteries).map((b) => html`<span key=${b} className="tag">${b} P${t.batteries[b]}</span>`)}</div>
          </div>
        </div>`}
        <div className="card" style=${{ padding: 14, flex: '1 1 220px' }}>
          <span className="upper">${sl.name}</span>
          <div className="small" style=${{ marginTop: 4 }}>${inShortlist(a.id) ? html`<span className="pill accent">${sl.status === 'Approved' ? 'Selected' : 'Shortlisted · ' + sl.status}</span>` : el.ok ? 'Eligible — not nominated' : html`<span className="faint">${el.why}</span>`}</div>
          ${!inShortlist(a.id) && el.ok && canEdit && sl.status === 'Draft' && html`<button className="btn sm" style=${{ marginTop: 8 }} onClick=${() => AMS.runAction('talent.shortlistAdd', { athleteId: a.id })}><${I} name="plus" size=${13} />Nominate</button>`}
          <div className="tiny faint" style=${{ marginTop: 8 }}>${rt.due ? html`<span className="warn">Re-test overdue (${rt.days} d)</span>` : 'Next re-test by ' + D.fmt(D.add(rt.last, 90))}</div>
        </div>
      </div>
      ${a.discoveredAt && html`<div className="small muted"><${I} name="flag" size=${12} /> Discovered at ${a.discoveredAt.event}, ${D.fmt(a.discoveredAt.date)} · ${a.discoveredAt.by}</div>`}
      ${nar && html`<div className="ai-box small"><${UI.AIChip} label="Progression" /> ${nar.text}</div>`}
      ${pend.length > 0 && html`<div className="small warn"><${I} name="alert" size=${12} /> ${pend.length} value${pend.length === 1 ? '' : 's'} awaiting confirmation (${pend.map((p) => def(p.testId).name + ' ' + fmtVal(def(p.testId), p.value)).join(', ')}) — not counted.</div>`}
      <div className="tbl-wrap"><table className="tbl compact">
        <thead><tr><th>Test</th><th className="num">Latest</th><th>Pct</th><th className="num hide-sm">Standard</th><th className="num">Since first</th><th className="hide-sm">Trend</th></tr></thead>
        <tbody>${tests.map((td) => { const l = L[td.id]; const std = standardForAthlete(a, td.id); const pr = m.prog[a.id] && m.prog[a.id].tests[td.id]; const series = hist.filter((r) => r.results[td.id] != null && !(r.flags && r.flags[td.id] && r.flags[td.id].status === 'Pending')).map((r) => (td.lowerBetter ? -r.results[td.id] : r.results[td.id])); return html`<tr key=${td.id}>
          <td><b className="small">${td.name}</b><div className="tiny faint">${D.fmt(l.date)}</div></td>
          <td className="num"><b>${fmtVal(td, l.value)}</b></td>
          <td><${PctBadge} p=${pctFor(a, td.id, l.value, m)} /></td>
          <td className="num hide-sm">${std != null ? html`<span className=${better(td, std, l.value) ? 'faint' : 'good'}>${fmtNum(td, std)}${better(td, std, l.value) ? '' : ' ✓'}</span>` : '—'}</td>
          <td className="num">${pr ? html`<span className=${pr.imp > 0 ? 'good' : 'bad'}>${sign(pr.imp, 1)}%</span>` : '—'}</td>
          <td className="hide-sm"><${UI.Sparkline} data=${series} width=${80} height=${22} tone=${pr && pr.imp > 0 ? 'good' : 'accent'} /></td>
        </tr>`; })}</tbody>
      </table></div>
      ${!inDrawer && html`<div className="row tight wrap"><button className="btn sm" onClick=${() => { AMS.closeAllDrawers(); AMS.go(MOD, { tab: 'progression', athleteId: a.id }); }}><${I} name="trend-up" size=${13} />Full progression</button><button className="btn sm" onClick=${() => { AMS.closeAllDrawers(); AMS.go(MOD, { tab: 'compare', athleteId: a.id }); }}><${I} name="swap" size=${13} />Compare</button></div>`}
    </div>`;
  }
  function TalentDrawer({ athleteId }) {
    const { v } = AMS.useStore();
    const a = AMS.org.athlete(athleteId);
    if (!a) return html`<${UI.DrawerHead} title="Athlete not found" /><div className="drawer-b"><${UI.Empty} title="No such athlete" /></div>`;
    AMS.setFocus({ athleteId: a.id });
    const m = model(); const t = m.talent[a.id];
    const L = m.latest[a.id] || {};
    const axes = AMS.db.testDefs.filter((td) => L[td.id]).map((td) => { const std = standardForAthlete(a, td.id); return { label: td.name.replace('Countermovement jump', 'CMJ').replace('Standing long jump', 'SLJ').replace('Medicine ball throw (3 kg)', 'Med ball'), value: pctFor(a, td.id, L[td.id].value, m), compare: std != null ? pctFor(a, td.id, std, m) : 50 }; });
    return html`<${React.Fragment}>
      <${UI.DrawerHead} title=${a.name} sub=${AMS.org.squad(a.squadId).name + ' · ' + AMS.org.centre(a.centreId).short + ' · ' + D.ageOn(a.dob) + ' y · born ' + D.fmt(a.dob)} avatar=${html`<${UI.Avatar} name=${a.name} size=${40} />`} />
      <div className="drawer-b">
        <${TalentPanel} athlete=${a} inDrawer />
        ${axes.length >= 3 && html`<${UI.Card} title="Profile vs national standard" hint=${t ? cohortLabel(t.key) : ''}><${UI.Radar} axes=${axes} size=${260} label=${a.name.split(' ')[0]} compareLabel="National standard" /><//>`}
      </div>
      <div className="drawer-f">
        <button className="btn" onClick=${() => { AMS.closeAllDrawers(); AMS.openAthlete(a.id, 'tests'); }}><${I} name="user" size=${14} />Full profile</button>
        <button className="btn" onClick=${() => { AMS.closeAllDrawers(); AMS.go(MOD, { tab: 'compare', athleteId: a.id }); }}><${I} name="swap" size=${14} />Compare</button>
        <button className="btn primary" onClick=${() => { AMS.closeAllDrawers(); AMS.go(MOD, { tab: 'progression', athleteId: a.id }); }}><${I} name="trend-up" size=${14} />Progression</button>
      </div>
    <//>`;
  }
  AMS.registerDrawer('tid-talent', TalentDrawer, { wide: true, sample: () => [{ athleteId: HERO }] });
  AMS.registerAthleteTab({ id: 'tests', label: 'Tests & talent', order: 35, roles: ['director', 'coach', 'physio', 'doctor', 'scientist', 'nutritionist', 'athlete'], component: ({ athlete }) => html`<${TalentPanel} athlete=${athlete} />` });

  /* ------------------------------------------------------------------ page */
  const TABS = [
    { id: 'sessions', label: 'Testing calendar', icon: 'calendar' },
    { id: 'field', label: 'Field testing', icon: 'clipboard' },
    { id: 'benchmarks', label: 'Benchmarks', icon: 'chart' },
    { id: 'talent', label: 'Talent ID', icon: 'target' },
    { id: 'progression', label: 'Progression', icon: 'trend-up' },
    { id: 'compare', label: 'Compare', icon: 'swap' },
  ];
  function Page({ params }) {
    const { db, ui, v } = AMS.useStore();
    params = params || {};
    const role = ui.role;
    const [tab, setTab] = useState(params.tab || (role === 'director' ? 'talent' : role === 'coach' ? 'field' : 'sessions'));
    useEffect(() => { if (params.tab) setTab(params.tab); }, [params.tab, params.athleteId, params.sessionId]);
    const m = model();
    const athletes = AMS.scopedAthletes();
    const ids = new Set(athletes.map((a) => a.id));
    const pend = m.pending.filter((p) => ids.has(p.athleteId)).length;
    const tested = athletes.filter((a) => m.hist[a.id]).length;
    const results = db.tests.filter((t) => ids.has(t.athleteId)).length;
    const sl = db.tid.shortlist;
    const canEdit = AMS.canEdit('assessments');
    const openField = (sessionId) => AMS.go(MOD, { tab: 'field', sessionId });
    const tabs = TABS.map((t) => Object.assign({}, t, t.id === 'field' && pend ? { count: pend } : t.id === 'talent' ? { count: sl.entries.length + '/' + sl.quota } : {}));
    return html`<div className="page">
      <${UI.PageHead} title="Assessments & Talent ID" sub=${tested + ' of ' + athletes.length + ' athletes tested · ' + results + ' results on record · ' + sl.name + ' shortlist ' + sl.status.toLowerCase()}
        actions=${html`<${UI.AskCopilot} prompt="Who are our top U-17 sprint prospects?" label="Top prospects" />${canEdit ? html`<button className="btn primary" onClick=${() => setTab('field')}><${I} name="clipboard" size=${14} />Enter field results</button>` : null}`} />
      <${UI.Tabs} tabs=${tabs} value=${tab} onChange=${setTab} style=${{ marginBottom: 16 }} />
      ${tab === 'sessions' && html`<${SessionsTab} openField=${openField} />`}
      ${tab === 'field' && html`<${FieldTab} params=${params} />`}
      ${tab === 'benchmarks' && html`<${BenchmarksTab} />`}
      ${tab === 'talent' && html`<${TalentTab} />`}
      ${tab === 'progression' && html`<${ProgressionTab} params=${params} />`}
      ${tab === 'compare' && html`<${CompareTab} params=${params} />`}
    </div>`;
  }

  AMS.registerModule({
    id: 'assessments', label: 'Assessments & TID', icon: 'target', group: 'performance', order: 6, roles: ['director', 'coach', 'scientist', 'physio'], component: Page, short: 'Tests',
    badge: () => { try { const ids = new Set(AMS.scopedAthletes().map((a) => a.id)); const n = model().pending.filter((p) => ids.has(p.athleteId)).length; return n ? { n, tone: 'bad' } : null; } catch (e) { return null; } },
    sampleParams: [{}, { tab: 'sessions' }, { tab: 'field' }, { tab: 'field', sessionId: 'TS-PUN-1015' }, { tab: 'benchmarks' }, { tab: 'talent' }, { tab: 'progression' }, { tab: 'progression', athleteId: HERO }, { tab: 'compare' }],
  });

  AMS.registerCommand({ id: 'tid.field', label: 'Enter field test results', group: 'Assessments', icon: 'clipboard', keywords: 'test testing sprint jump battery field', roles: ['coach', 'scientist'], run: () => AMS.go(MOD, { tab: 'field' }) });
  AMS.registerCommand({ id: 'tid.talent', label: 'Talent ranking & camp shortlist', group: 'Assessments', icon: 'target', keywords: 'talent tid prospects shortlist camp selection', roles: ['director', 'coach', 'scientist', 'physio'], run: () => AMS.go(MOD, { tab: 'talent' }) });
  AMS.registerCommand({ id: 'tid.priya', label: 'Priya Deshmukh — test progression', group: 'Assessments', icon: 'trend-up', keywords: 'priya progression tests', roles: ['director', 'coach', 'scientist', 'physio'], run: () => AMS.go(MOD, { tab: 'progression', athleteId: HERO }) });
  AMS.registerCommand({ id: 'tid.schedule', label: 'Schedule a testing day', group: 'Assessments', icon: 'calendar', keywords: 'testing day schedule retest', roles: ['coach', 'scientist'], run: () => AMS.go(MOD, { tab: 'sessions' }) });

  /* ------------------------------------------------------------------ self-tests (workflow assertions on fresh seed data) */
  const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
  AMS.selfTests.push({ name: 'field test submission creates today-dated results, PB activity and notifications', role: 'coach', fn: () => {
    const before = AMS.db.tests.length;
    const other = AMS.db.athletes.find((a) => a.squadId === 'SQ-PUN-SPR17' && a.id !== HERO);
    const res = AMS.runAction('tests.submitBatch', { squadId: 'SQ-PUN-SPR17', battery: 'Speed', rows: [{ athleteId: HERO, status: 'present', results: { sprint30: 4.31, flying20: 2.2 } }, { athleteId: other.id, status: 'absent', results: {} }] });
    expect(res, 'submitBatch returned nothing');
    expect(AMS.db.tests.length === before + 1, 'expected exactly one new test row, got ' + (AMS.db.tests.length - before));
    const row = AMS.db.tests[AMS.db.tests.length - 1];
    expect(row.date === AMS.TODAY && row.athleteId === HERO, 'row not dated today for Priya');
    expect(AMS.tid.latest(HERO).sprint30.value === 4.31, 'latest sprint30 not updated');
    expect(AMS.db.activity.some((x) => x.athleteId === HERO && /new PB/.test(x.text)), 'no PB activity logged');
    expect(AMS.db.notifications.some((n) => n.toRole === 'director' && /PB/.test(n.title)), 'director not notified of PBs');
    expect(AMS.db.tid.sessions.some((s) => s.kind === 'Ad hoc' && s.date === AMS.TODAY && s.tested === 1 && s.absent === 1), 'ad hoc testing day not recorded');
  } });
  AMS.selfTests.push({ name: 'AI plausibility check flags an implausible sprint and confirm/correct resolves it', role: 'scientist', fn: () => {
    const a = AMS.org.athlete(HERO);
    const bad = AMS.tid.check(a, 'sprint30', 3.37);
    expect(bad && bad.level === 'implausible', 'implausible value not flagged');
    expect(bad.suggestion === 4.37, 'expected typo suggestion 4.37, got ' + bad.suggestion);
    expect(!AMS.tid.check(a, 'sprint30', 4.35), 'false positive on a normal value');
    expect((AMS.tid.check(a, 'slj', 290) || {}).level === 'outlier', 'big jump vs own history not flagged');
    AMS.runAction('tests.submitBatch', { squadId: 'SQ-PUN-SPR17', rows: [{ athleteId: HERO, status: 'present', results: { sprint30: 3.37 }, flags: { sprint30: { status: 'Pending', check: 'implausible', reason: bad.reason } } }] });
    const pend = AMS.tid.model().pending.filter((p) => p.athleteId === HERO);
    expect(pend.length === 1, 'pending flag not stored');
    expect(AMS.tid.latest(HERO).sprint30.value === 4.37, 'pending value leaked into latest results');
    expect(AMS.ai.insights({ module: 'assessments' }).some((i) => i.id.indexOf('tid-outlier:' + pend[0].rowId) === 0), 'outlier detector missed the pending value');
    AMS.runAction('tests.correctValue', { rowId: pend[0].rowId, testId: 'sprint30', value: 4.37 });
    expect(AMS.tid.model().pending.filter((p) => p.athleteId === HERO).length === 0, 'correction did not clear pending');
    const seeded = AMS.tid.model().pending[0];
    expect(seeded, 'seeded Mumbai outlier missing');
    AMS.runAction('tests.confirmValue', { rowId: seeded.rowId, testId: seeded.testId });
    expect(!AMS.tid.model().pending.some((p) => p.rowId === seeded.rowId), 'confirm did not clear pending');
  } });
  AMS.selfTests.push({ name: 'camp shortlist: nominate → submit to director → approve assigns camp and tasks ops', role: 'coach', fn: () => {
    const sl = AMS.db.tid.shortlist; const n0 = sl.entries.length;
    const cand = AMS.scopedAthletes().find((a) => !AMS.tid.inShortlist(a.id) && AMS.tid.eligibleForCamp(a).ok && AMS.tid.talent(a.id));
    expect(cand, 'no eligible candidate in coach scope');
    AMS.runAction('talent.shortlistAdd', { athleteId: cand.id });
    expect(AMS.db.tid.shortlist.entries.length === n0 + 1, 'nomination not added');
    AMS.runAction('talent.shortlistSubmit', {});
    expect(AMS.db.tid.shortlist.status === 'Submitted', 'shortlist not submitted');
    expect(AMS.db.notifications.some((n) => n.toRole === 'director' && /shortlist submitted/.test(n.title)), 'director not notified');
    expect(AMS.db.tasks.some((t) => t.ownerRole === 'director' && t.status === 'Open' && t.ref === sl.id), 'director task missing');
    expect(AMS.runAction('talent.shortlistAdd', { athleteId: AMS.db.athletes.find((a) => a.id !== cand.id && AMS.tid.eligibleForCamp(a).ok && !AMS.tid.inShortlist(a.id)).id }) === null, 'edits allowed while submitted');
    AMS.ui.role = 'director';
    AMS.runAction('talent.shortlistDecide', { decision: 'Approved' });
    expect(AMS.db.tid.shortlist.status === 'Approved', 'not approved');
    const x = AMS.org.athlete(cand.id);
    expect(x.tempAssignment && x.tempAssignment.label === sl.name && x.tempAssignment.centreId === 'PAT', 'camp temporary assignment not set');
    expect(AMS.db.tasks.some((t) => t.ownerRole === 'ops' && /travel/i.test(t.title)), 'ops travel task missing');
    expect(!AMS.db.tasks.some((t) => t.ownerRole === 'director' && t.status === 'Open' && t.ref === sl.id), 'director task not closed');
  } });
  AMS.selfTests.push({ name: 're-test detector fires for Bhubaneswar and clears once a testing day is scheduled', role: 'director', fn: () => {
    const has = () => AMS.ai.insights({ module: 'assessments' }).some((i) => i.id.indexOf('tid-retest:SQ-BBS-HOCSR') === 0);
    expect(has(), 'retest insight missing for Bhubaneswar hockey');
    const n0 = AMS.db.tid.sessions.length;
    AMS.runAction('tests.scheduleDay', { centreId: 'BBS', squadIds: ['SQ-BBS-HOCSR'], date: AMS.date.add(AMS.TODAY, 6), battery: 'Full' });
    expect(AMS.db.tid.sessions.length === n0 + 1 && AMS.db.tid.sessions[n0].status === 'Scheduled', 'testing day not created');
    expect(!has(), 'retest insight still showing after scheduling');
  } });
  AMS.selfTests.push({ name: 'talent score applies relative-age correction and ranks Priya near the top', role: 'director', fn: () => {
    const m = AMS.tid.model();
    const list = Object.values(m.talent);
    expect(list.length > 100, 'too few talent scores: ' + list.length);
    list.forEach((t) => expect(t.score >= 0 && t.score <= 100, 'score out of range'));
    const q1 = list.find((t) => t.ag === 'U-17' && t.q === 1), q4 = list.find((t) => t.ag === 'U-17' && t.q === 4), sr = list.find((t) => t.ag === 'Senior');
    expect(q1 && q1.raeAdj < 0 && q4 && q4.raeAdj > 0 && sr.raeAdj === 0, 'RAE adjustment wrong');
    const p = m.talent[HERO];
    expect(p && p.rank <= 10 && p.rising, 'Priya should be a top-10 rising star, got rank ' + (p && p.rank));
    const before = p.score;
    AMS.runAction('talent.setWeights', { preset: 'endurance' });
    expect(AMS.db.tid.preset === 'endurance' && AMS.tid.talent(HERO).score !== undefined, 'weights not applied');
    void before;
  } });
  AMS.selfTests.push({ name: 'editing a national standard updates benchmarks and projection', role: 'scientist', fn: () => {
    AMS.runAction('tests.setStandard', { testId: 'sprint30', ageGroup: 'U-17', gender: 'F', value: 4.25 });
    expect(AMS.tid.standardFor('sprint30', 'U-17', 'F') === 4.25, 'standard not saved');
    expect(AMS.db.tid.standardsLog[0].to === 4.25, 'standard change not logged');
    const pr = AMS.tid.projection(AMS.org.athlete(HERO), 'sprint30');
    expect(pr && !pr.met && pr.date && pr.date > AMS.TODAY, 'projection to new standard missing');
  } });
})();
