/* USI · AMS — Dashboard / Command Center.
   Home for directors and coaches; role-specific command views for physio, doctor, scientist, nutritionist and ops.
   Everything reacts to the org ladder (AMS.effectiveScope / AMS.scopedAthletes) and to the role (RBAC, medical privacy).
   Workflow logic lives in plain functions (AMS.dash.*) and registered actions so the UI, the copilot, AI insights
   and the self-tests all share one code path. */
(function () {
  'use strict';
  const AMS = window.AMS, UI = window.UI, React = window.React, html = AMS.html;
  const { useState, useMemo, useEffect } = React;
  const C = AMS.calc, D = AMS.date;

  /* ------------------------------------------------------------------ module-scoped CSS (theme tokens only) */
  const CSS = `
.db-scope { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 14px; }
.db-crumbs { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; min-width: 0; }
.db-crumb { border: 0; background: none; font: inherit; color: var(--fg-2); padding: 3px 6px; border-radius: var(--r-sm); cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-size: 13px; }
.db-crumb:hover:not(:disabled) { background: var(--surface-2); color: var(--fg); }
.db-crumb.cur { color: var(--fg); font-weight: 600; cursor: default; }
.db-crumb:disabled { cursor: default; color: var(--fg-3); }
.db-bandbar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: var(--surface-3); min-width: 64px; }
.db-bandbar > i { display: block; height: 100%; transition: width .4s; }
.db-board { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.db-col { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 10px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.db-col-h { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 600; font-size: 12.5px; padding: 0 2px; }
.db-acard { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 9px 10px; display: flex; flex-direction: column; gap: 8px; cursor: pointer; min-width: 0; animation: rise .25s ease-out; }
.db-acard:hover { border-color: var(--border-strong); box-shadow: var(--shadow); }
@media (max-width: 1180px) { .db-board { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .db-board { grid-template-columns: minmax(0, 1fr); } .db-big { font-size: 28px; } }
.db-progress { height: 10px; border-radius: 5px; background: var(--surface-3); overflow: hidden; }
.db-progress > i { display: block; height: 100%; background: var(--good); transition: width .6s cubic-bezier(.2,.8,.2,1); border-radius: 5px; }
.db-big { font: 600 34px/1 var(--font-display); font-variant-numeric: tabular-nums; }
.db-feed-item { display: flex; gap: 10px; padding: 8px 14px; border-bottom: 1px solid var(--border); align-items: flex-start; }
.db-feed-item:last-child { border-bottom: 0; }
.db-feed-item.fresh { background: var(--accent-weak); animation: rise .3s ease-out; }
.db-feed-ic { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; flex: none; background: var(--surface-3); color: var(--fg-2); }
.db-brief-head { font-size: 14px; line-height: 1.55; margin: 0; color: var(--fg); }
.db-brief-col { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.db-brief-item { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: var(--r); background: var(--surface); border: 1px solid var(--border); min-width: 0; }
.db-note { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--fg-3); }
.db-livebadge { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--fg-2); padding: 3px 10px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); white-space: nowrap; }
.db-stat { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.db-stat b { font: 600 20px/1.1 var(--font-display); font-variant-numeric: tabular-nums; }
.db-legend-btn { border: 0; background: none; font: inherit; display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: var(--r-sm); cursor: pointer; width: 100%; color: var(--fg); text-align: left; }
.db-legend-btn:hover { background: var(--surface-2); }
.db-thinking { opacity: .5; transition: opacity .2s; }
.db-mini { display: flex; gap: 3px; align-items: flex-end; height: 22px; }
.db-mini > i { display: block; width: 6px; border-radius: 2px 2px 0 0; background: var(--accent); opacity: .75; }
`;
  try {
    if (typeof document !== 'undefined' && document.createElement && !(document.getElementById && document.getElementById('style-dashboard'))) {
      const el = document.createElement('style'); el.id = 'style-dashboard'; el.textContent = CSS;
      if (document.head && document.head.appendChild) document.head.appendChild(el);
    }
  } catch (e) { /* style injection is cosmetic */ }

  /* ------------------------------------------------------------------ small utils */
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
  const toMin = (t) => { const p = String(t || '00:00').split(':').map(Number); return p[0] * 60 + (p[1] || 0); };
  const fmtMins = (m) => (m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min');
  const pctDelta = (now, prev) => (prev ? Math.round(((now - prev) / prev) * 100) : 0);
  const first = (name) => (name || '').split(' ')[0];
  const BANDS = [
    { id: 'bad', label: 'Red', tone: 'bad' },
    { id: 'warn', label: 'Amber', tone: 'warn' },
    { id: 'good', label: 'Green', tone: 'good' },
    { id: 'none', label: 'No check-in', tone: 'var(--border-strong)' },
  ];
  const STATUS_ORDER = ['Reported', 'Assessment', 'Rehab', 'Clearance', 'Monitoring'];
  const isMedRole = () => AMS.medicalFull();
  const canSeeReadiness = () => AMS.can('readiness', 'view');
  const canSeeMedical = () => AMS.can('medical', 'summary');
  const hasDrawer = (t) => !!(AMS.drawers && AMS.drawers[t]);

  /* ------------------------------------------------------------------ per-version caches (db is mutated in place) */
  let cacheV = -1, cacheDb = null, snap = new Map(), injIdx = null;
  function fresh() { if (cacheV !== AMS.version || cacheDb !== AMS.db) { cacheV = AMS.version; cacheDb = AMS.db; snap = new Map(); injIdx = null; } }
  /** Open injury per athlete (worst availability first). */
  function openInjOf(id) {
    fresh();
    if (!injIdx) {
      injIdx = {};
      const rank = { Unavailable: 0, Modified: 1, Available: 2 };
      AMS.db.injuries.forEach((i) => { if (i.status === 'Closed') return; const cur = injIdx[i.athleteId]; if (!cur || (rank[i.availability] || 2) < (rank[cur.availability] || 2)) injIdx[i.athleteId] = i; });
    }
    return injIdx[id] || null;
  }
  function wellDrop(a) { const r = C.wellnessAvg(a, 25, 28), b = C.wellnessBaseline(a); return r && b ? Math.round(r - b) : 0; }
  /** Snapshot of one athlete for today (cached until the next store change). */
  function S(a) {
    fresh();
    let s = snap.get(a.id);
    if (!s) {
      const rd = C.readiness(a);
      s = { rd, band: rd.checkedIn ? rd.band : 'none', acwr: C.acwr(a), drop: wellDrop(a), risk: C.risk(a), inj: openInjOf(a.id) };
      s.flag = s.acwr >= 1.5 || s.drop <= -14;
      snap.set(a.id, s);
    }
    return s;
  }
  /** One-line, role-safe reason for an athlete's state. */
  function topReason(a, role) {
    const s = S(a);
    if (s.inj && s.inj.status !== 'Monitoring') return { text: AMS.medicalLabel(s.inj, role), tone: s.inj.availability === 'Unavailable' ? 'bad' : 'warn' };
    const f = s.rd.factors.find((x) => x.tone === 'bad') || s.rd.factors.find((x) => x.tone === 'warn');
    if (f) return { text: f.label + ' ' + f.value, tone: f.tone };
    if (s.inj) return { text: AMS.medicalLabel(s.inj, role), tone: 'info' };
    return { text: s.rd.checkedIn ? 'In range vs own normal' : 'Awaiting check-in', tone: s.rd.checkedIn ? 'good' : '' };
  }

  /* ------------------------------------------------------------------ scope helpers (org ladder) */
  function eff() { return AMS.effectiveScope(); }
  /** Where an athlete sits for this scope: home, or the temporary (camp) assignment if that is what brings them into scope. */
  function placeOf(a, e) {
    const lock = e.lock || {};
    const t = a.tempAssignment && a.tempAssignment.active ? a.tempAssignment : null;
    const homeOk = (!e.stateId || a.stateId === e.stateId) && (!e.centreId || a.centreId === e.centreId) && (!e.squadId || a.squadId === e.squadId) && (!e.sport || a.sport === e.sport) && (!lock.squadIds || lock.squadIds.includes(a.squadId));
    if (homeOk || !t) return { stateId: a.stateId, centreId: a.centreId, squadId: a.squadId, temp: false };
    const c = AMS.org.centre(t.centreId);
    return { stateId: c ? c.stateId : a.stateId, centreId: t.centreId, squadId: t.squadId, temp: true };
  }
  function compareLevel(e) {
    const lock = e.lock || {};
    if (e.squadId) return 'athlete';
    if (e.centreId || lock.squadIds) return 'squad';
    if (e.stateId) return 'centre';
    return 'state';
  }
  const LEVEL_LABEL = { state: 'States', centre: 'Centres', squad: 'Squads', athlete: 'Athletes' };
  function squadsInScope(list, e) {
    const set = new Set();
    list.forEach((a) => set.add(placeOf(a, e).squadId));
    if (e.squadId) set.add(e.squadId);
    return set;
  }
  function appInScope(p, e) {
    const c = AMS.org.centre(p.centreId); if (!c) return false;
    const lock = e.lock || {};
    if (e.stateId && c.stateId !== e.stateId) return false;
    if (e.centreId && p.centreId !== e.centreId) return false;
    if (e.sport && p.sport !== e.sport) return false;
    if (e.squadId && p.squadId !== e.squadId) return false;
    if (lock.squadIds && !lock.squadIds.includes(p.squadId)) return false;
    return true;
  }
  /** Breadcrumb for drill-up. Locked levels (role ladder lock) cannot be left. */
  function crumbs(e) {
    const lock = e.lock || {}, lockedCentre = !!lock.centreId;
    const out = [{ id: 'fed', label: AMS.db.meta.tenantShort + ' · Federation', locked: lockedCentre, scope: {} }];
    if (e.stateId) out.push({ id: 'state', label: AMS.org.state(e.stateId).name, locked: lockedCentre, scope: { stateId: e.stateId } });
    if (e.centreId) out.push({ id: 'centre', label: AMS.org.centre(e.centreId).short + (lock.squadIds ? ' · your squads' : ''), locked: false, scope: { stateId: e.stateId, centreId: e.centreId } });
    if (e.sport) out.push({ id: 'sport', label: e.sport, locked: false, scope: { stateId: e.stateId, centreId: e.centreId, sport: e.sport } });
    if (e.squadId) out.push({ id: 'squad', label: AMS.org.squad(e.squadId).name, locked: false, scope: { stateId: e.stateId, centreId: e.centreId, sport: e.sport, squadId: e.squadId } });
    return out;
  }
  function setScope(scope) { AMS.setUI({ scope: { stateId: scope.stateId || null, centreId: scope.centreId || null, sport: scope.sport || null, squadId: scope.squadId || null } }); }
  function drillUp() {
    const cs = crumbs(eff());
    if (cs.length < 2) return false;
    const target = cs[cs.length - 2];
    if (target.locked) return false;
    setScope(target.scope);
    return true;
  }

  /* ------------------------------------------------------------------ participation (sessions, attendance, RPE) */
  /** Attendance, RPE submission and exposure hours for the last 14 completed days, restricted to `list`. */
  function participation(list) {
    const ids = new Set(list.map((a) => a.id));
    const from = D.add(AMS.TODAY, -14);
    const byAth = {}, bySquad = {}, byDate = {};
    AMS.db.sessions.forEach((s) => {
      if (s.date < from || s.date >= AMS.TODAY) return;
      Object.entries(s.attendance || {}).forEach(([id, st]) => {
        if (!ids.has(id)) return;
        const r = byAth[id] || (byAth[id] = { sess: 0, present: 0, missed: 0, excused: 0, rpeDue: 0, rpeGiven: 0, mins: 0 });
        const q = bySquad[s.squadId] || (bySquad[s.squadId] = { present: 0, denom: 0, rpeDue: 0, rpeGiven: 0, missedIds: {} });
        const d = byDate[s.date] || (byDate[s.date] = { present: 0, denom: 0, rpeDue: 0, rpeGiven: 0, noRpe: [] });
        r.sess++;
        if (st === 'excused') { r.excused++; return; }
        q.denom++; d.denom++;
        if (st === 'present' || st === 'late') {
          r.present++; q.present++; d.present++; r.rpeDue++; q.rpeDue++; d.rpeDue++; r.mins += s.duration || 0;
          if (s.rpe && s.rpe[id] != null) { r.rpeGiven++; q.rpeGiven++; d.rpeGiven++; } else d.noRpe.push(id);
        } else { r.missed++; q.missedIds[id] = (q.missedIds[id] || 0) + 1; }
      });
    });
    const hours14 = AMS.sum(Object.values(byAth).map((r) => r.mins)) / 60;
    return { byAth, bySquad, byDate, hours14 };
  }

  /* ------------------------------------------------------------------ aggregate stats */
  function groupStats(list, byAth) {
    const n = list.length, bands = { good: 0, warn: 0, bad: 0, none: 0 };
    let rsum = 0, checked = 0, avail = 0, modified = 0, unavail = 0, flags = 0, present = 0, denom = 0, rpeDue = 0, rpeGiven = 0, prof = 0;
    list.forEach((a) => {
      const s = S(a);
      bands[s.band]++; rsum += s.rd.score;
      if (s.rd.checkedIn) checked++;
      if (a.availability === 'Available') avail++; else if (a.availability === 'Modified') modified++; else unavail++;
      if (s.flag) flags++;
      prof += a.profileCompletion || 0;
      const r = byAth && byAth[a.id];
      if (r) { present += r.present; denom += r.sess - r.excused; rpeDue += r.rpeDue; rpeGiven += r.rpeGiven; }
    });
    const ids = new Set(list.map((a) => a.id));
    const inj = C.openInjuries(ids);
    return {
      n, bands, ids, readiness: n ? Math.round(rsum / n) : 0, checked, checkin: pct(checked, n), availN: avail, avail: pct(avail, n), modified, unavail,
      injuries: inj.length, injList: inj, attendance: pct(present, denom), rpe: pct(rpeGiven, rpeDue), flags, profile: n ? Math.round(prof / n) : 0,
    };
  }
  /** Per-day series over the 28-day wellness window: check-in share and wellness-based readiness. */
  function dailySeries(list) {
    const out = [];
    for (let i = 0; i < 28; i++) {
      let n = 0, sum = 0;
      list.forEach((a) => { const w = (a.wellness || [])[i]; if (w) { n++; sum += C.wellnessScore(w); } });
      out.push({ i, date: AMS.series.wellDate(i), checkin: pct(n, list.length), well: n ? Math.round(sum / n) : null, n });
    }
    return out;
  }
  /** Open-injury count and limited-availability share per day for the last `days` days (derived from the injury register). */
  function injurySeries(list, days) {
    const ids = new Set(list.map((a) => a.id));
    const inj = AMS.db.injuries.filter((i) => ids.has(i.athleteId));
    const out = [];
    for (let k = days - 1; k >= 0; k--) {
      const date = D.add(AMS.TODAY, -k);
      const open = inj.filter((i) => i.dateOfInjury <= date && (i.status !== 'Closed' ? true : (i.closedOn && i.closedOn > date)));
      const limited = new Set(open.filter((i) => i.path !== 'light' && i.status !== 'Monitoring').map((i) => i.athleteId));
      out.push({ date, open: open.length, availPct: 100 - pct(limited.size, list.length) });
    }
    return out;
  }
  /** Injuries per 1,000 training hours. Exposure = last-14-day attended session minutes, scaled to the window. */
  function incidence(list, P, windowDays, endOffset) {
    const ids = new Set(list.map((a) => a.id));
    const end = D.add(AMS.TODAY, -(endOffset || 0)), start = D.add(end, -windowDays);
    const n = AMS.db.injuries.filter((i) => ids.has(i.athleteId) && i.dateOfInjury > start && i.dateOfInjury <= end).length;
    const hours = (P.hours14 / 14) * windowDays;
    return { n, hours: Math.round(hours), rate: hours ? AMS.round((n / hours) * 1000, 2) : 0 };
  }
  function monthKeys(n) {
    const t = D.parse(AMS.TODAY); const out = [];
    for (let k = n - 1; k >= 0; k--) { const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - k, 1)); out.push({ key: D.toISO(d).slice(0, 7), label: D.MONTHS[d.getUTCMonth()] }); }
    return out;
  }
  function injuryTrend(list) {
    const ids = new Set(list.map((a) => a.id));
    const months = monthKeys(12);
    const rows = months.map((m) => ({ label: m.label, key: m.key, minor: [], moderate: [], severe: [] }));
    AMS.db.injuries.forEach((i) => { if (!ids.has(i.athleteId)) return; const r = rows.find((x) => x.key === i.dateOfInjury.slice(0, 7)); if (r) (r[i.severity] || r.minor).push(i); });
    return rows;
  }
  function daysLost(list) {
    const ids = new Set(list.map((a) => a.id));
    return AMS.sum(AMS.db.injuries.filter((i) => ids.has(i.athleteId) && i.status !== 'Closed' && i.path !== 'light' && i.status !== 'Monitoring').map((i) => Math.max(0, D.diff(AMS.TODAY, i.dateOfInjury))));
  }

  /* ------------------------------------------------------------------ compare one level down */
  function compareRows(list, e, P) {
    const level = compareLevel(e);
    if (level === 'athlete') return { level, rows: list.map((a) => ({ id: a.id, kind: 'athlete', label: a.name, athlete: a, st: groupStats([a], P.byAth) })) };
    const key = { state: 'stateId', centre: 'centreId', squad: 'squadId' }[level];
    const groups = {};
    list.forEach((a) => { const k = placeOf(a, e)[key]; (groups[k] = groups[k] || []).push(a); });
    const rows = Object.entries(groups).map(([id, members]) => {
      let label = id, sub = '';
      if (level === 'state') { const s = AMS.org.state(id); label = s ? s.name : id; sub = AMS.db.org.centres.filter((c) => c.stateId === id).length + ' centres'; }
      if (level === 'centre') { const c = AMS.org.centre(id); label = c ? c.short : id; sub = c ? c.type : ''; }
      if (level === 'squad') { const q = AMS.org.squad(id); const co = q && AMS.org.staff(q.coachId); label = q ? q.name : id; sub = (q ? AMS.org.centre(q.centreId).short : '') + (co ? ' · ' + co.name : ''); }
      return { id, kind: level, label, sub, members, st: groupStats(members, P.byAth) };
    });
    rows.sort((a, b) => b.st.n - a.st.n || a.label.localeCompare(b.label));
    return { level, rows };
  }
  function drillTo(row) {
    const s = Object.assign({}, AMS.ui.scope || {});
    if (row.kind === 'athlete') { AMS.openAthlete(row.id); return; }
    if (row.kind === 'state') setScope({ sport: s.sport, stateId: row.id });
    if (row.kind === 'centre') { const c = AMS.org.centre(row.id); setScope({ sport: s.sport, stateId: c.stateId, centreId: row.id }); }
    if (row.kind === 'squad') { const q = AMS.org.squad(row.id); const c = AMS.org.centre(q.centreId); setScope({ sport: s.sport, stateId: c.stateId, centreId: q.centreId, squadId: row.id }); }
  }

  /* ------------------------------------------------------------------ sessions today */
  function sessionState(s, clock) {
    const st = toMin(s.start), end = st + (s.duration || 60), now = toMin(clock || AMS.clockTime());
    if (s.status === 'Completed' || now >= end) return { id: 'done', label: 'Completed', tone: 'good', mins: 0 };
    if (s.status === 'Live' || now >= st) return { id: 'live', label: 'Live · ' + (now - st) + ' min in', tone: 'accent', mins: now - st };
    return { id: 'upcoming', label: 'Starts in ' + fmtMins(st - now), tone: st - now <= 30 ? 'warn' : 'info', mins: st - now };
  }
  function sessionsToday(list, e) {
    const sq = squadsInScope(list, e);
    return AMS.db.sessions.filter((s) => s.date === AMS.TODAY && sq.has(s.squadId)).sort((a, b) => a.start.localeCompare(b.start) || a.squadId.localeCompare(b.squadId));
  }
  function sessionMembers(sess) {
    return AMS.db.athletes.filter((a) => a.enrollment === 'Active' && ((a.squadId === sess.squadId && !(a.tempAssignment && a.tempAssignment.active)) || (a.tempAssignment && a.tempAssignment.active && a.tempAssignment.squadId === sess.squadId)));
  }

  /* ------------------------------------------------------------------ competitions: projected availability */
  function compRule(comp) {
    const n = comp.name || '';
    let ages = null;
    if (/U-17|Youth/.test(n)) ages = ['U-17']; else if (/U-20/.test(n)) ages = ['U-20']; else if (/Junior/.test(n)) ages = ['U-17', 'U-20']; else if (/Senior/.test(n)) ages = ['Senior'];
    let stateId = null;
    if (comp.level === 'State') { const c = AMS.db.org.centres.find((x) => x.name.includes(comp.location)); if (c) stateId = c.stateId; }
    return { ages, stateId };
  }
  function compEligible(comp, a, rule) {
    if (!(comp.sports || []).includes(a.sport)) return false;
    const sq = AMS.org.squad(a.squadId);
    if (rule.ages && sq && !rule.ages.includes(sq.ageGroup)) return false;
    if (rule.stateId && a.stateId !== rule.stateId) return false;
    return true;
  }
  /** Probability an athlete is fit to compete on `date` — from injury return dates (7-day buffer) and today's injury-risk band. */
  function availProb(a, date) {
    const s = S(a), inj = s.inj;
    let p = 1, why = null;
    if (inj) {
      if (inj.status === 'Monitoring' || inj.path === 'light') { p = 0.9; why = 'Monitoring'; }
      else if (!inj.expectedReturn) { p = 0.45; why = inj.status === 'Reported' ? 'Not yet assessed' : 'Return date not set'; }
      else {
        const gap = D.diff(date, inj.expectedReturn);
        if (gap >= 7) { p = 0.85; why = 'Back ' + D.fmt(inj.expectedReturn); }
        else if (gap >= 0) { p = 0.35; why = 'Back ' + D.fmt(inj.expectedReturn) + ' — under 7 days before'; }
        else { p = 0.05; why = 'Expected back after event'; }
      }
    }
    if (s.risk.band === 'bad') { p *= 0.75; why = why || 'High injury risk (' + s.risk.score + ')'; }
    else if (s.risk.band === 'warn') p *= 0.93;
    return { p, why };
  }
  function compProjection(comp, list) {
    const rule = compRule(comp);
    const rows = list.filter((a) => compEligible(comp, a, rule)).map((a) => Object.assign({ a }, availProb(a, comp.date)));
    const proj = AMS.sum(rows.map((r) => r.p));
    const bySq = AMS.groupBy(rows, (r) => r.a.squadId);
    const bySquad = Object.entries(bySq).map(([squadId, rs]) => { const pj = AMS.sum(rs.map((r) => r.p)); return { squadId, n: rs.length, projected: AMS.round(pj, 1), share: pct(pj, rs.length), atRisk: rs.filter((r) => r.p < 0.8) }; }).sort((a, b) => a.share - b.share);
    return { comp, rule, days: D.diff(comp.date, AMS.TODAY), eligible: rows.length, projected: AMS.round(proj, 1), share: pct(proj, rows.length), rows, bySquad, atRisk: rows.filter((r) => r.p < 0.8).sort((x, y) => x.p - y.p) };
  }
  function upcomingComps(list) {
    return AMS.db.competitions.filter((c) => D.diff(c.date, AMS.TODAY) >= 0).sort((a, b) => a.date.localeCompare(b.date)).map((c) => compProjection(c, list)).filter((p) => p.eligible > 0);
  }

  /* ------------------------------------------------------------------ director KPIs */
  function directorKpis(list, P, e) {
    const st = groupStats(list, P.byAth);
    const ds = dailySeries(list);
    const isr = injurySeries(list, 14);
    const thisWk = AMS.mean(ds.slice(21, 28).map((x) => x.well)), lastWk = AMS.mean(ds.slice(14, 21).map((x) => x.well));
    const ciThis = AMS.mean(ds.slice(20, 27).map((x) => x.checkin)), ciLast = AMS.mean(ds.slice(13, 20).map((x) => x.checkin));
    const inc90 = incidence(list, P, 90, 0), incPrev = incidence(list, P, 90, 90);
    const incSpark = [150, 120, 90, 60, 30, 0].map((o) => incidence(list, P, 30, o).rate);
    const sess = sessionsToday(list, e);
    const clock = AMS.clockTime();
    const done = sess.filter((s) => sessionState(s, clock).id === 'done').length, live = sess.filter((s) => sessionState(s, clock).id === 'live').length;
    const attSpark = Object.keys(P.byDate).sort().map((d) => pct(P.byDate[d].present, P.byDate[d].denom));
    const enrolledSpark = [7, 6, 5, 4, 3, 2, 1, 0].map((w) => list.filter((a) => a.enrolledOn <= D.add(AMS.TODAY, -7 * w)).length);
    const new30 = list.filter((a) => D.diff(AMS.TODAY, a.enrolledOn) <= 30).length;
    const ago30 = list.filter((a) => a.enrolledOn <= D.add(AMS.TODAY, -30)).length;
    const dl = daysLost(list);
    const missed = list.filter((a) => (P.byAth[a.id] || {}).missed >= 2).map((a) => a.id);
    const injured90 = [...new Set(AMS.db.injuries.filter((i) => st.ids.has(i.athleteId) && D.diff(AMS.TODAY, i.dateOfInjury) <= 90).map((i) => i.athleteId))];
    return {
      st, ds, active: st.n, new30, activeDelta: pctDelta(st.n, ago30), enrolledSpark,
      readiness: st.readiness, readinessDelta: pctDelta(thisWk, lastWk), readinessSpark: ds.slice(14).map((x) => x.well),
      avail: st.avail, availSpark: isr.map((x) => x.availPct), availDelta: pctDelta(isr[13].availPct, isr[6].availPct),
      checkin: st.checkin, checkinSpark: ds.slice(14).map((x) => x.checkin), checkinDelta: pctDelta(ciThis, ciLast),
      injuries: st.injuries, daysLost: dl, injSpark: isr.map((x) => x.open), injDelta: pctDelta(isr[13].open, isr[6].open),
      incidence: inc90.rate, incN: inc90.n, incHours: inc90.hours, incDelta: pctDelta(inc90.rate, incPrev.rate), incSpark,
      sessions: sess.length, sessDone: done, sessLive: live, attendance: st.attendance, attSpark, rpe: st.rpe,
      acted: AMS.ai.actedRate(), missed, injured90,
    };
  }

  /* ------------------------------------------------------------------ AI morning brief (generated from live data) */
  function morningBrief(list, P, e) {
    const db = AMS.db, role = AMS.ui.role, me = AMS.me();
    const k = directorKpis(list, P, e);
    const st = k.st;
    const ds = k.ds;
    const thisWk = Math.round(AMS.mean(ds.slice(21, 28).map((x) => x.well))), lastWk = Math.round(AMS.mean(ds.slice(14, 21).map((x) => x.well)));
    const ciThis = Math.round(AMS.mean(ds.slice(20, 27).map((x) => x.checkin))), ciLast = Math.round(AMS.mean(ds.slice(13, 20).map((x) => x.checkin)));
    const inj7 = db.injuries.filter((i) => st.ids.has(i.athleteId) && D.diff(AMS.TODAY, i.dateOfInjury) >= 0 && D.diff(AMS.TODAY, i.dateOfInjury) <= 6).length;
    const injPrev = db.injuries.filter((i) => st.ids.has(i.athleteId) && D.diff(AMS.TODAY, i.dateOfInjury) >= 7 && D.diff(AMS.TODAY, i.dateOfInjury) <= 13).length;
    const loadThis = AMS.sum(list.map((a) => C.weekLoad(a, 0))), loadLast = AMS.sum(list.map((a) => C.weekLoad(a, 1)));
    // top risks
    const risks = list.filter((a) => a.availability !== 'Unavailable').map((a) => ({ a, s: S(a) })).sort((x, y) => y.s.risk.score - x.s.risk.score || x.s.rd.score - y.s.rd.score).slice(0, 3).filter((r) => r.s.risk.score >= 35)
      .map(({ a, s }) => {
        const sess = AMS.todaySessionFor(a);
        const mod = sess && sess.mods && sess.mods[a.id];
        const sq = AMS.org.squad(a.squadId);
        return {
          athleteId: a.id, name: a.name, where: (sq ? sq.name : '') + ' · ' + AMS.org.centre(a.centreId).short,
          text: (s.acwr >= 1.5 ? 'Load ' + Math.round((s.acwr - 1) * 100) + '% above her 4-week normal' : s.acwr > 1.3 ? 'Load rising (ACWR ' + s.acwr.toFixed(2) + ')' : 'Risk driven by ' + (s.risk.factors[0] ? s.risk.factors[0].label.toLowerCase() : 'history')).replace('her', a.gender === 'M' ? 'his' : 'her') +
            (s.rd.checkedIn ? ', readiness ' + s.rd.score + ' (' + C.bandLabel(s.rd.band).toLowerCase() + ').' : ', not checked in yet.') +
            (mod ? ' Session already adjusted (' + mod.variant + ', ' + mod.at + ').' : sess ? ' No adjustment made to ' + sess.title + ' at ' + sess.start + ' yet.' : ''),
          chips: [{ label: 'Risk', value: String(s.risk.score), tone: s.risk.band }].concat(s.risk.factors.slice(0, 3)),
          handled: !!mod, sessionId: sess && sess.id,
        };
      });
    // changes vs last week
    const changes = [];
    changes.push({ icon: thisWk >= lastWk ? 'trend-up' : 'trend-down', tone: thisWk >= lastWk - 1 ? 'good' : 'warn', text: 'Wellness-based readiness ' + (thisWk === lastWk ? 'flat' : (thisWk > lastWk ? 'up ' : 'down ') + Math.abs(thisWk - lastWk) + ' pts') + ' week on week (' + lastWk + ' → ' + thisWk + ').', chips: [{ label: 'This week', value: String(thisWk), tone: 'info' }, { label: 'Last week', value: String(lastWk), tone: 'info' }] });
    changes.push({ icon: ciThis >= ciLast ? 'trend-up' : 'trend-down', tone: ciThis >= 80 ? 'good' : 'warn', text: 'Morning check-in compliance averaged ' + ciThis + '% (last week ' + ciLast + '%). Today ' + st.checkin + '% so far.', chips: [{ label: 'Target', value: '80%', tone: 'info' }, { label: 'Today', value: st.checkin + '%', tone: st.checkin >= 80 ? 'good' : 'warn' }] });
    changes.push({ icon: loadThis >= loadLast ? 'trend-up' : 'trend-down', tone: Math.abs(pctDelta(loadThis, loadLast)) > 15 ? 'warn' : 'good', text: 'Total training load ' + (loadThis >= loadLast ? 'up ' : 'down ') + Math.abs(pctDelta(loadThis, loadLast)) + '% (' + Math.round(loadLast / 1000) + 'k → ' + Math.round(loadThis / 1000) + 'k AU). ' + list.filter((a) => S(a).acwr >= 1.5).length + ' athletes in a load jump.', chips: [{ label: 'ACWR ≥ 1.5', value: String(list.filter((a) => S(a).acwr >= 1.5).length), tone: 'bad' }] });
    changes.push({ icon: inj7 > injPrev ? 'trend-up' : 'trend-down', tone: inj7 > injPrev ? 'bad' : 'good', text: inj7 + ' new injur' + (inj7 === 1 ? 'y' : 'ies') + ' in the last 7 days (previous week ' + injPrev + '). ' + st.injuries + ' open cases, ' + k.daysLost + ' training days lost.', chips: [{ label: 'Per 1,000 h (90d)', value: String(k.incidence), tone: k.incidence > 2 ? 'warn' : 'good' }] });
    // biggest centre drop (only when looking across centres)
    const byCentre = AMS.groupBy(list, (a) => placeOf(a, e).centreId);
    if (Object.keys(byCentre).length > 1) {
      const drops = Object.entries(byCentre).filter(([, m]) => m.length >= 5).map(([cid, m]) => { const s = dailySeries(m); return { cid, d: Math.round(AMS.mean(s.slice(21, 28).map((x) => x.well)) - AMS.mean(s.slice(14, 21).map((x) => x.well))) }; }).sort((a, b) => a.d - b.d);
      if (drops[0] && drops[0].d <= -2) changes.push({ icon: 'building', tone: 'warn', text: AMS.org.centre(drops[0].cid).short + ' shows the largest readiness drop: ' + drops[0].d + ' pts vs last week.', chips: [{ label: 'Centre', value: AMS.org.centre(drops[0].cid).short, tone: 'warn' }], drill: drops[0].cid });
    }
    // decisions needed
    const decisions = [];
    db.injuries.filter((i) => st.ids.has(i.athleteId) && i.status === 'Clearance').forEach((i) => {
      const a = AMS.org.athlete(i.athleteId);
      decisions.push({ tone: 'warn', icon: 'shield-check', text: a.name + ' — return-to-play clearance awaiting team doctor sign-off' + (i.expectedReturn ? ' (target ' + D.fmt(i.expectedReturn) + ')' : '') + '.', chips: [{ label: 'Status', value: AMS.medicalLabel(i, role), tone: 'warn' }], cta: { label: 'Open case', run: () => openInjury(i) } });
    });
    const reported = db.injuries.filter((i) => st.ids.has(i.athleteId) && i.status === 'Reported');
    if (reported.length) decisions.push({ tone: 'bad', icon: 'alert', text: reported.length + ' injury report' + (reported.length > 1 ? 's' : '') + ' awaiting physio assessment (oldest ' + D.rel(reported.map((i) => i.dateOfInjury).sort()[0]) + ').', chips: reported.slice(0, 2).map((i) => ({ label: first(AMS.org.athlete(i.athleteId).name), value: AMS.bodyZone(i.region), tone: 'bad' })), cta: { label: 'Injury inbox', run: () => AMS.go('medical') } });
    const apps = db.applications.filter((p) => appInScope(p, e));
    const late = apps.filter((p) => ['Applied', 'Verifying', 'Docs returned'].includes(p.stage) && D.diff(AMS.TODAY, p.submitted) > 5);
    if (late.length) decisions.push({ tone: 'warn', icon: 'clock', text: late.length + ' athlete application' + (late.length > 1 ? 's' : '') + ' past the 5-day verification target.', chips: late.slice(0, 2).map((p) => ({ label: p.name, value: D.diff(AMS.TODAY, p.submitted) + 'd', tone: 'warn' })), cta: { label: 'Verification queue', run: () => AMS.go('athletes', { tab: 'onboarding' }) } });
    const noCoach = apps.filter((p) => p.stage === 'Approved' && !p.coachId);
    if (noCoach.length) decisions.push({ tone: 'warn', icon: 'whistle', text: noCoach.map((p) => p.name).join(', ') + ' approved but not yet assigned to a coach.', chips: [{ label: 'Waiting', value: D.rel(noCoach[0].submitted), tone: 'warn' }], cta: { label: 'Assign coach', run: () => AMS.go('athletes', { tab: 'onboarding' }) } });
    upcomingComps(list).filter((p) => p.days <= 45).forEach((p) => {
      const worst = p.bySquad.find((q) => q.n >= 4 && q.share < 85);
      if (p.share < 85 || worst) decisions.push({ tone: 'warn', icon: 'flag', text: p.comp.name + ' in ' + p.days + ' days: ' + (worst ? AMS.org.squad(worst.squadId).name + ' projected ' + worst.share + '% available.' : p.share + '% of eligible athletes projected available.'), chips: [{ label: 'Eligible', value: String(p.eligible), tone: 'info' }, { label: 'At risk', value: String(p.atRisk.length), tone: 'warn' }], cta: { label: 'Review at-risk', run: () => openList(p.comp.name + ' — at-risk athletes', p.atRisk.map((r) => r.a.id), 'Projected availability under 80% on ' + D.fmt(p.comp.date) + ' (injury return dates + today\'s risk band).') } });
    });
    const overdue = db.injuries.filter((i) => st.ids.has(i.athleteId) && i.status === 'Rehab' && i.stageSince && D.diff(AMS.TODAY, i.stageSince) > (i.stageTargetDays || 7));
    if (overdue.length) decisions.push({ tone: 'info', icon: 'medical', text: overdue.length + ' rehab case' + (overdue.length > 1 ? 's' : '') + ' running past the planned stage length.', chips: overdue.slice(0, 2).map((i) => ({ label: first(AMS.org.athlete(i.athleteId).name), value: D.diff(AMS.TODAY, i.stageSince) + 'd in stage', tone: 'warn' })), cta: { label: 'Medical', run: () => AMS.go('medical') } });
    const name = me ? me.name.replace(/^Dr\.\s+/, 'Dr. ').split(' ').slice(0, 2).join(' ') : '';
    const headline = 'Good morning' + (name ? ', ' + name : '') + '. ' + st.n + ' active athletes in ' + AMS.scopeLabel() + ': readiness ' + st.readiness + ', ' + st.checkin + '% checked in, ' + st.injuries + ' open injur' + (st.injuries === 1 ? 'y' : 'ies') + '. ' +
      (risks.length ? risks.filter((r) => !r.handled).length + ' high-risk athlete' + (risks.filter((r) => !r.handled).length === 1 ? ' needs' : 's need') + ' a plan change before training, and ' : '') + decisions.length + ' decision' + (decisions.length === 1 ? '' : 's') + ' wait on leadership.';
    const summary = st.n + ' athletes · readiness ' + st.readiness + ' · check-in ' + st.checkin + '% · ' + st.injuries + ' open injuries · top risk: ' + (risks[0] ? risks[0].name : 'none') + ' · ' + decisions.length + ' decisions pending';
    return { headline, risks, changes, decisions, summary, sources: { checkins: st.checked, sessions: Object.keys(P.byDate).length, injuries: db.injuries.filter((i) => st.ids.has(i.athleteId)).length } };
  }

  /* ------------------------------------------------------------------ nutrition / weight-class context */
  function classKg(a) { const m = /(\d+(?:\.\d+)?)\s*kg/.exec(a.events || ''); return m ? parseFloat(m[1]) : null; }
  function weightWatch(list) {
    const comps = AMS.db.competitions.filter((c) => D.diff(c.date, AMS.TODAY) >= 0).sort((a, b) => a.date.localeCompare(b.date));
    return list.filter((a) => classKg(a) != null).map((a) => {
      const cls = classKg(a), over = AMS.round(((a.weightKg - cls) / cls) * 100, 1);
      const comp = comps.find((c) => compEligible(c, a, compRule(c)));
      const days = comp ? D.diff(comp.date, AMS.TODAY) : null;
      let flag = { label: 'On weight', tone: 'good' };
      if (over > 12) flag = { label: 'Category review', tone: 'info' };
      else if (over > 5 && days != null && days <= 60) flag = { label: 'Rapid-cut risk', tone: 'bad' };
      else if (over > 2) flag = { label: 'Gradual cut', tone: 'warn' };
      const w = C.todayWellness(a);
      return { id: a.id, a, cls, over, comp, days, flag, energy: w ? w.energy : null };
    }).sort((x, y) => ({ bad: 0, warn: 1, info: 2, good: 3 }[x.flag.tone] - { bad: 0, warn: 1, info: 2, good: 3 }[y.flag.tone]) || y.over - x.over);
  }
  function fuellingFlags(list) {
    return list.map((a) => {
      const w3 = (a.wellness || []).slice(25, 28).filter(Boolean);
      const e3 = w3.length ? AMS.mean(w3.map((w) => w.energy)) : null;
      const load = C.weekLoad(a, 0), prev = C.weekLoad(a, 1);
      return { id: a.id, a, e3, load, change: pctDelta(load, prev) };
    }).filter((r) => r.e3 != null && r.e3 <= 2.4).sort((x, y) => x.e3 - y.e3 || y.load - x.load);
  }

  /* ------------------------------------------------------------------ wearables (science) */
  function wearableStatus(list) {
    const types = {};
    list.forEach((a) => (a.devices || []).forEach((d) => {
      const t = types[d] || (types[d] = { device: d, n: 0, synced: 0, stale: [] });
      t.n++;
      const ok = AMS.rng('sync:' + a.id + ':' + d)() < 0.92;
      if (ok) t.synced++; else t.stale.push(a.id);
    }));
    return Object.values(types).sort((a, b) => b.n - a.n);
  }

  /* ------------------------------------------------------------------ navigation helpers */
  function openList(title, athleteIds, note) { AMS.openDrawer('athlete-list', { title, athleteIds, note }); }
  function openInjury(inj) { if (hasDrawer('injury')) AMS.openDrawer('injury', { injuryId: inj.id }); else AMS.openAthlete(inj.athleteId); }
  function openSession(s) { if (hasDrawer('session')) AMS.openDrawer('session', { sessionId: s.id }); else AMS.go('training', { sessionId: s.id }); }
  function spikeInsightFor(id) { return AMS.ai.insights().find((i) => i.id === 'spike:' + id + ':' + AMS.TODAY); }

  /* ================================================================== ACTIONS */
  AMS.registerAction('dashboard.athleteList', function (p) { openList(p.title || 'Athletes', p.athleteIds || [], p.note); return 'Opened list of ' + (p.athleteIds || []).length; });
  AMS.registerAction('dashboard.drill', function (p) {
    const cur = p.merge ? Object.assign({}, AMS.ui.scope || {}) : {};
    const scope = Object.assign(cur, { stateId: p.stateId || cur.stateId || null, centreId: p.centreId || cur.centreId || null, sport: p.sport || cur.sport || null, squadId: p.squadId || null });
    if (scope.squadId) { const q = AMS.org.squad(scope.squadId); if (q) scope.centreId = q.centreId; }
    if (scope.centreId) { const c = AMS.org.centre(scope.centreId); if (c) scope.stateId = c.stateId; }
    setScope(scope);
    if (p.go !== false && AMS.ui.route.module !== 'dashboard') AMS.go('dashboard');
    return 'Now viewing ' + AMS.scopeLabel();
  });
  AMS.registerAction('dashboard.drillUp', function () { return drillUp() ? 'Now viewing ' + AMS.scopeLabel() : 'Already at the top of your scope'; });
  /** One red athlete → recovery. Goes through the AI insight when one exists so the acted-on rate and insight state stay honest. */
  AMS.registerAction('dashboard.recoverOne', function (p) {
    const a = AMS.org.athlete(p.athleteId); if (!a) return null;
    const ins = spikeInsightFor(a.id);
    const act = ins && (ins.actions || []).find((x) => x.action === 'session.modifyForAthlete');
    if (ins && act) return AMS.ai.act(ins, act);
    return AMS.runAction('session.modifyForAthlete', { athleteId: a.id, sessionId: p.sessionId, variant: p.variant || 'recovery' });
  });
  AMS.registerAction('dashboard.recoverAllRed', function (p) {
    const ids = p.athleteIds || AMS.scopedAthletes().filter((a) => S(a).band === 'bad').map((a) => a.id);
    const todo = ids.map((id) => AMS.org.athlete(id)).filter((a) => a && a.availability !== 'Unavailable').map((a) => ({ a, sess: AMS.todaySessionFor(a) })).filter((x) => x.sess && !(x.sess.mods && x.sess.mods[x.a.id]));
    if (!todo.length) { AMS.toast('Every red athlete already has an adjusted session', 'info'); return 'Nothing to change'; }
    const names = todo.map((x) => first(x.a.name));
    const spikeIds = todo.map((x) => 'spike:' + x.a.id + ':' + AMS.TODAY);
    const open = new Set(AMS.ai.insights().map((i) => i.id));
    AMS.mutate((db) => {
      todo.forEach(({ a, sess }) => { const s = AMS.byId(db.sessions, sess.id); s.mods = s.mods || {}; s.mods[a.id] = { variant: 'recovery', by: AMS.ui.role, at: AMS.clockTime(), source: 'Command Center' }; });
      spikeIds.forEach((id) => { if (open.has(id)) { db.aiState.done[id] = { at: AMS.TODAY + 'T' + AMS.clockTime(), action: 'Switch to recovery (bulk)', by: AMS.ui.role }; db.aiState.acted++; } });
      AMS.notify({ toRole: 'physio', title: 'Recovery sessions assigned', text: names.join(', ') + ' moved to recovery for today (red readiness). Quick screen before 07:30 suggested.', module: 'dashboard' });
      AMS.notify({ toRole: 'scientist', title: 'Load plan changed', text: todo.length + ' athletes switched to recovery from the Command Center.', module: 'science' });
    }, { toast: todo.length + ' red athlete' + (todo.length > 1 ? 's' : '') + ' moved to recovery: ' + names.join(', '), toastKind: 'ai', log: { type: 'training', text: 'Recovery session assigned to ' + todo.length + ' red athletes (' + names.join(', ') + ')' } });
    return todo.length + ' adjusted';
  });
  AMS.registerAction('dashboard.undoSessionMod', function (p) {
    const a = AMS.org.athlete(p.athleteId), sess = p.sessionId ? AMS.byId(AMS.db.sessions, p.sessionId) : AMS.todaySessionFor(a);
    if (!a || !sess || !(sess.mods && sess.mods[a.id])) return null;
    AMS.mutate(() => { delete AMS.byId(AMS.db.sessions, sess.id).mods[a.id]; }, { toast: first(a.name) + ' back on the full ' + sess.title, toastKind: 'info', log: { type: 'training', text: a.name + ' returned to full session (' + sess.title + ')', athleteId: a.id } });
    return 'Undone';
  });
  AMS.registerAction('dashboard.shareBrief', function (p) {
    const me = AMS.me();
    const text = p.summary || 'Morning brief';
    AMS.mutate((db) => {
      db.dashboard = db.dashboard || { briefs: [] };
      db.dashboard.briefs = db.dashboard.briefs || [];
      db.dashboard.briefs.unshift({ id: AMS.uid('BRF'), at: AMS.TODAY + 'T' + AMS.clockTime(), by: me ? me.name : 'Director', scope: AMS.scopeLabel(), text, decisions: p.decisions || 0 });
      ['coach', 'physio', 'scientist'].forEach((r) => AMS.notify({ toRole: r, title: 'Morning brief from ' + (me ? me.name : 'the director'), text, module: 'dashboard' }));
    }, { toast: 'Morning brief shared with coaches, physios and sports science', log: { type: 'brief', text: 'Shared AI morning brief for ' + AMS.scopeLabel() + ' (' + (p.decisions || 0) + ' decisions flagged)' } });
    return 'Brief shared';
  });
  AMS.registerAction('dashboard.triageInjury', function (p) {
    const inj = AMS.byId(AMS.db.injuries, p.injuryId);
    if (!inj || inj.status !== 'Reported') return null;
    if (!AMS.medicalFull()) { AMS.toast('Only medical staff can start an assessment', 'bad'); return null; }
    const a = AMS.org.athlete(inj.athleteId), me = AMS.me();
    AMS.mutate((db) => {
      const x = AMS.byId(db.injuries, inj.id);
      x.status = 'Assessment';
      if (me && me.role === 'physio') x.physioId = me.id;
      x.timeline.unshift({ date: AMS.TODAY, type: 'assessment', by: me ? me.name : 'Physio', text: 'Triage started from Command Center at ' + AMS.clockTime() + ' — assessment booked before session' });
      db.tasks.forEach((t) => { if (t.status === 'Open' && t.athleteId === inj.athleteId && /Assess/i.test(t.title)) { t.status = 'Done'; t.doneOn = AMS.TODAY; } });
      AMS.notify({ toRole: 'coach', title: 'Injury report picked up', text: a.name + ': physio assessing now. ' + AMS.medicalLabel(x, 'coach') + ' until assessed.', athleteId: a.id, module: 'medical' });
    }, { toast: a.name + ' — assessment started', log: { type: 'medical', text: 'Assessment started for ' + a.name + ' (' + inj.regionLabel + ')', athleteId: a.id } });
    return 'Assessment started';
  });
  AMS.registerAction('dashboard.taskDone', function (p) {
    const t = AMS.byId(AMS.db.tasks, p.taskId); if (!t || t.status === 'Done') return null;
    AMS.mutate((db) => { const x = AMS.byId(db.tasks, p.taskId); x.status = 'Done'; x.doneOn = AMS.TODAY; x.doneBy = AMS.ui.role; }, { toast: 'Task done: ' + t.title, log: { type: 'task', text: 'Completed task: ' + t.title, athleteId: t.athleteId } });
    return 'Done';
  });
  AMS.registerAction('dashboard.requestDocRenewal', function (p) {
    const a = AMS.org.athlete(p.athleteId); const d = a && (a.docs || []).find((x) => x.id === p.docId);
    if (!d) return null;
    AMS.mutate((db) => {
      const x = AMS.byId(db.athletes, a.id).docs.find((y) => y.id === d.id); x.renewalRequested = AMS.TODAY;
      AMS.notify({ toRole: 'athlete', title: 'Document renewal needed', text: d.type + ' expires ' + D.fmt(d.expires) + '. Please upload a renewed copy.', athleteId: a.id, module: 'athlete-app' });
      db.tasks.unshift({ id: AMS.uid('TSK'), title: 'Collect renewed ' + d.type.toLowerCase() + ' — ' + a.name, ownerRole: 'ops', module: 'athletes', status: 'Open', due: d.expires || D.add(AMS.TODAY, 7), created: AMS.TODAY, athleteId: a.id, ref: d.id });
    }, { toast: 'Renewal requested from ' + a.name + (a.guardian ? ' (guardian copied)' : ''), log: { type: 'documents', text: 'Renewal requested: ' + d.type + ' for ' + a.name, athleteId: a.id } });
    return 'Renewal requested';
  });
  AMS.registerAction('dashboard.wearableResync', function () {
    const n = AMS.scopedAthletes().filter((a) => (a.devices || []).length).length;
    AMS.mutate((db) => { db.dashboard = db.dashboard || {}; db.dashboard.wearable = db.dashboard.wearable || { imported: 0, unmatched: [] }; db.dashboard.wearable.lastImport = AMS.clockTime(); db.dashboard.wearable.imported = (db.dashboard.wearable.imported || 0) + Math.round(n * 0.3); }, { toast: 'Wearable sync requested for ' + n + ' athletes', toastKind: 'info', log: { type: 'integration', text: 'Manual wearable sync triggered (' + n + ' athletes)' } });
    return 'Sync started';
  });
  AMS.registerAction('dashboard.matchDevice', function (p) {
    const w = AMS.db.dashboard && AMS.db.dashboard.wearable; const dev = w && (w.unmatched || []).find((x) => x.id === p.deviceId);
    const a = AMS.org.athlete(p.athleteId || (dev && dev.suggest));
    if (!dev || !a) return null;
    AMS.mutate((db) => { const x = AMS.byId(db.athletes, a.id); if (!x.devices.includes(dev.device)) x.devices.push(dev.device); db.dashboard.wearable.unmatched = db.dashboard.wearable.unmatched.filter((y) => y.id !== dev.id); db.dashboard.wearable.matched = (db.dashboard.wearable.matched || []).concat({ id: dev.id, athleteId: a.id, at: AMS.clockTime() }); },
      { toast: dev.device + ' ' + dev.serial + ' matched to ' + a.name, log: { type: 'integration', text: dev.device + ' ' + dev.serial + ' matched to ' + a.name + ' — session data imported', athleteId: a.id } });
    return 'Matched';
  });

  /* ------------------------------------------------------------------ seed: dashboard-owned state */
  AMS.registerSeed('dashboard', function (db) {
    const cv = db.athletes.find((a) => a.squadId === 'SQ-PUN-SPR20' && a.enrollment === 'Active' && !(a.devices || []).includes('Catapult Vector')) || db.athletes.find((a) => a.squadId === 'SQ-PUN-SPR20');
    const wh = db.athletes.find((a) => a.squadId === 'SQ-PUN-JMP20' && a.enrollment === 'Active' && !(a.devices || []).includes('WHOOP 4.0')) || db.athletes.find((a) => a.squadId === 'SQ-PUN-JMP20');
    db.dashboard = {
      briefs: [],
      wearable: {
        lastImport: '05:10', imported: 41, matched: [],
        unmatched: [
          { id: 'DEV-CV-2231', device: 'Catapult Vector', serial: 'CV-2231', session: 'U-20 Sprints · 12 Oct 07:30', suggest: cv && cv.id, confidence: 0.88, why: 'Only U-20 sprinter at that session without a paired Catapult; GPS trace starts on Track 1 at 07:31' },
          { id: 'DEV-WH-7810', device: 'WHOOP 4.0', serial: 'WH-7810', session: 'U-20 Jumps · 12 Oct 08:00', suggest: wh && wh.id, confidence: 0.79, why: 'Sleep data matches check-in times (06:10–06:20) and the U-20 Jumps session window' },
        ],
      },
    };
  });

  /* ================================================================== AI DETECTORS */
  AMS.registerDetector('dashboard.centreOutlier', function (ctx) {
    if (!['director', 'scientist', 'physio', 'doctor', 'nutritionist'].includes(ctx.role)) return [];
    const all = ctx.db.athletes.filter((a) => a.enrollment === 'Active');
    if (!all.length) return [];
    const fedReady = Math.round(AMS.mean(all.map((a) => S(a).rd.score))), fedCheck = C.checkinRate(all);
    const e = ctx.scope;
    const byCentre = AMS.groupBy(ctx.athletes, (a) => placeOf(a, e).centreId);
    const out = [];
    Object.entries(byCentre).forEach(([cid, m]) => {
      if (m.length < 5) return;
      const c = AMS.org.centre(cid); if (!c) return;
      const ready = Math.round(AMS.mean(m.map((a) => S(a).rd.score))), check = C.checkinRate(m);
      const dR = ready - fedReady, dC = check - fedCheck;
      if (dR > -10 && dC > -10) return;
      const missing = m.filter((a) => !C.todayWellness(a) && a.availability !== 'Unavailable').map((a) => a.id);
      const acts = [{ label: 'Drill into ' + c.short, action: 'dashboard.drill', payload: { centreId: cid }, primary: true }];
      if (dC <= -10 && missing.length) acts.push({ label: 'Remind ' + missing.length + ' to check in', action: 'checkin.remind', payload: { athleteIds: missing } });
      acts.push({ label: 'Ask centre scientist to review', action: 'notify', payload: { toRole: 'scientist', text: c.short + ': ' + (dR <= -10 ? 'readiness ' + ready + ' vs federation ' + fedReady : 'check-in ' + check + '% vs federation ' + fedCheck + '%') + '. Please review this week\'s plan.' } });
      out.push({
        id: 'outlier:' + cid + ':' + AMS.TODAY + ':' + (dR <= -10 ? 'r' : '') + (dC <= -10 ? 'c' : ''), kind: dR <= -10 ? 'risk' : 'ops', severity: (dR <= -15 || dC <= -20) ? 'high' : 'med', module: 'dashboard',
        title: c.short + ' is below the federation on ' + (dR <= -10 && dC <= -10 ? 'readiness and check-ins' : dR <= -10 ? 'readiness' : 'check-in compliance'),
        summary: c.short + ' (' + m.length + ' athletes) is ' + (dR <= -10 ? Math.abs(dR) + ' readiness points' : '') + (dR <= -10 && dC <= -10 ? ' and ' : '') + (dC <= -10 ? Math.abs(dC) + ' check-in points' : '') + ' under the federation average today. ' + (dC <= -10 ? 'Low check-in means readiness is partly estimated — fix the data first.' : 'Look for a shared cause: travel, a heavy block or a competition weekend.'),
        athleteIds: m.filter((a) => S(a).band === 'bad' || !S(a).rd.checkedIn).map((a) => a.id).slice(0, 30), confidence: dC <= -10 ? 0.86 : 0.74,
        evidence: [{ label: 'Readiness', value: ready + ' vs ' + fedReady, tone: dR <= -10 ? 'bad' : 'good' }, { label: 'Check-in', value: check + '% vs ' + fedCheck + '%', tone: dC <= -10 ? 'bad' : 'good' }, { label: 'Red', value: String(m.filter((a) => S(a).band === 'bad').length), tone: 'warn' }],
        actions: acts,
      });
    });
    return out;
  });
  AMS.registerDetector('dashboard.competitionAvailability', function (ctx) {
    if (!['director', 'coach', 'physio', 'doctor', 'scientist'].includes(ctx.role)) return [];
    const out = [];
    AMS.db.competitions.filter((c) => { const d = D.diff(c.date, AMS.TODAY); return d >= 0 && d <= 45; }).forEach((comp) => {
      const p = compProjection(comp, ctx.athletes);
      if (!p.eligible) return;
      const worst = p.bySquad.find((q) => q.n >= 4 && q.share < 85);
      if (p.share >= 85 && !worst) return;
      const focus = worst || { squadId: null, n: p.eligible, share: p.share, projected: p.projected, atRisk: p.atRisk };
      const sqName = focus.squadId ? AMS.org.squad(focus.squadId).name + ' (' + AMS.org.centre(AMS.org.squad(focus.squadId).centreId).short + ')' : 'eligible athletes';
      const risky = focus.atRisk.slice().sort((x, y) => x.p - y.p);
      const acts = [{ label: 'Review ' + risky.length + ' at-risk athletes', action: 'dashboard.athleteList', payload: { title: comp.name + ' — at-risk athletes', athleteIds: risky.map((r) => r.a.id), note: 'Projected availability under 80% on ' + D.fmt(comp.date) + '. Based on injury return dates (7-day buffer) and today\'s injury-risk band.' }, primary: true }];
      acts.push({ label: 'Create availability plan task', action: 'task.create', payload: { title: 'Availability plan for ' + comp.name + ' — ' + sqName, ownerRole: 'coach', module: 'training', due: D.add(comp.date, -14) } });
      if (ctx.role !== 'physio' && ctx.role !== 'doctor') acts.push({ label: 'Ask physio for return dates', action: 'notify', payload: { toRole: 'physio', text: comp.name + ' on ' + D.fmt(comp.date) + ': please confirm expected return dates for ' + risky.map((r) => first(r.a.name)).join(', ') + '.' } });
      out.push({
        id: 'compavail:' + comp.id + ':' + (focus.squadId || 'all') + ':' + AMS.TODAY, kind: 'training', severity: focus.share < 75 || p.days <= 21 ? 'high' : 'med', module: 'dashboard',
        title: comp.name + ' in ' + p.days + ' days — ' + sqName + ' projected ' + focus.share + '% available',
        summary: 'Of ' + focus.n + ' eligible, ' + AMS.round(focus.projected, 1) + ' are projected fit on ' + D.fmt(comp.date) + ' (target 85%). Main drags: ' + risky.slice(0, 3).map((r) => first(r.a.name) + ' (' + (ctx.role === 'physio' || ctx.role === 'doctor' ? r.why : r.why.replace(/^Back /, 'returns ')) + ')').join(', ') + '. Decide entries or adjust load now, not in race week.',
        athleteIds: risky.map((r) => r.a.id), confidence: 0.72,
        evidence: [{ label: 'Projected', value: focus.share + '%', tone: focus.share < 75 ? 'bad' : 'warn' }, { label: 'Target', value: '85%', tone: 'info' }, { label: 'Days to go', value: String(p.days), tone: p.days <= 21 ? 'warn' : 'info' }, { label: 'At risk', value: String(risky.length), tone: 'warn' }],
        actions: acts,
      });
    });
    return out;
  });

  /* ================================================================== SHARED COMPONENTS */
  const I = UI.Icon;
  function VisibleNote({ text, icon }) { return html`<span className="db-note" title="Role-based visibility"><${I} name=${icon || 'eye'} size=${12} />${text}</span>`; }
  function medNote() {
    if (AMS.ui.role === 'ops') return 'Medical data not visible to Operations';
    return isMedRole() ? 'Visible to you: full medical detail' : 'Visible to you: summary only — diagnoses hidden';
  }
  function LiveBadge() {
    const { ui } = AMS.useStore();
    return html`<span className="db-livebadge" title="Simulated live clock — check-ins and sessions update every few seconds">
      ${ui.live ? html`<span className="live-dot" />` : html`<${I} name="pause" size=${11} />`}
      <b className="tnum">${AMS.clockTime()}</b><span className="faint">${ui.live ? 'Live' : 'Paused'}</span>
      <button className="btn ghost xs" onClick=${() => AMS.setUI({ live: !ui.live })} aria-label=${ui.live ? 'Pause live simulation' : 'Resume live simulation'}>${ui.live ? 'Pause' : 'Resume'}</button>
    </span>`;
  }
  function BandBar({ bands, n, style }) {
    const tot = n || AMS.sum(Object.values(bands)) || 1;
    return html`<span className="db-bandbar" style=${style} title=${BANDS.map((b) => b.label + ': ' + bands[b.id]).join(' · ')}>${BANDS.map((b) => bands[b.id] ? html`<i key=${b.id} style=${{ width: (bands[b.id] / tot) * 100 + '%', background: UI.color(b.tone) }} />` : null)}</span>`;
  }
  function Progress({ value, max, tone }) { return html`<div className="db-progress"><i style=${{ width: AMS.clamp((value / (max || 1)) * 100, 0, 100) + '%', background: UI.color(tone || 'good') }} /></div>`; }

  /** Current scope, drill-up breadcrumb and role lock. */
  function ScopeBar({ list, compact }) {
    const e = eff();
    const cs = crumbs(e);
    const lock = e.lock || {};
    const all = AMS.scopedAthletes({ all: true });
    const centres = new Set(list.map((a) => placeOf(a, e).centreId)).size, squads = squadsInScope(list, e).size;
    const canUp = cs.length > 1 && !cs[cs.length - 2].locked;
    return html`<div className="card db-scope">
      <span style=${{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-weak)', color: 'var(--accent)', display: 'grid', placeItems: 'center', flex: 'none' }}><${I} name="layers" size=${16} /></span>
      <div className="col tight grow" style=${{ gap: 2, minWidth: 0 }}>
        <div className="db-crumbs" aria-label="Org ladder breadcrumb">
          ${cs.map((c, i) => html`<${React.Fragment} key=${c.id}>
            ${i > 0 && html`<${I} name="chev-r" size=${12} style=${{ color: 'var(--fg-3)' }} />`}
            <button className=${AMS.cx('db-crumb', i === cs.length - 1 && 'cur')} disabled=${c.locked || i === cs.length - 1} title=${c.locked ? 'Locked by your role' : i === cs.length - 1 ? 'Current scope' : 'Drill up to ' + c.label} onClick=${() => setScope(c.scope)}>${c.locked && html`<${I} name="lock" size=${11} />`}${c.label}</button>
          <//>`)}
        </div>
        <div className="tiny faint">${list.length} active athletes${all.length > list.length ? ' (+' + (all.length - list.length) + ' in pipeline / inactive)' : ''} · ${centres} centre${centres === 1 ? '' : 's'} · ${squads} squad${squads === 1 ? '' : 's'}${lock.label ? ' · Scope locked by role: ' + lock.label : ''}${list.some((a) => placeOf(a, e).temp) ? ' · includes athletes on temporary camp assignment' : ''}</div>
      </div>
      ${!compact && html`<button className="btn sm" disabled=${!canUp} onClick=${drillUp} title=${canUp ? 'Go one level up the org ladder' : 'Top of your scope'}><${I} name="arrow-up" size=${13} />Drill up</button>`}
      <${LiveBadge} />
    </div>`;
  }

  /** "Compare one level down" — the ladder roll-up, clickable to drill. */
  function CompareTable({ list, P }) {
    const { v, ui } = AMS.useStore();
    const e = eff();
    const data = useMemo(() => compareRows(list, e, P), [v, JSON.stringify(e)]);
    const ops = ui.role === 'ops';
    const fedAvg = groupStats(list, P.byAth);
    const tone = (val, base, higherBetter) => { const d = higherBetter === false ? base - val : val - base; return d <= -10 ? 'bad' : d <= -5 ? 'warn' : d >= 5 ? 'good' : ''; };
    const cell = (val, base, suffix, hb) => html`<span className=${tone(val, base, hb)} style=${{ fontWeight: 600 }}>${val}${suffix || ''}</span>`;
    let cols;
    if (data.level === 'athlete') {
      cols = [
        { key: 'label', label: 'Athlete', render: (r) => html`<${UI.AthleteCell} athlete=${r.athlete} sub=${r.athlete.events + (placeOf(r.athlete, e).temp ? ' · on camp' : '')} />`, sort: (r) => r.label },
        !ops && { key: 'ready', label: 'Readiness', render: (r) => html`<${UI.Readiness} athlete=${r.athlete} size=${30} showLabel=${true} />`, sort: (r) => S(r.athlete).rd.score },
        !ops && { key: 'acwr', label: 'ACWR', num: true, render: (r) => html`<${UI.AcwrPill} value=${S(r.athlete).acwr} />`, sort: (r) => S(r.athlete).acwr },
        { key: 'checkin', label: 'Check-in', render: (r) => { const w = C.todayWellness(r.athlete); return w ? html`<span className="good small"><${I} name="check" size=${12} /> ${w.at}</span>` : html`<span className="faint small">Pending</span>`; }, sort: (r) => (C.todayWellness(r.athlete) ? 1 : 0) },
        !ops && { key: 'avail', label: 'Availability', render: (r) => html`<${UI.AvailabilityPill} value=${r.athlete.availability} />`, sort: (r) => r.athlete.availability },
        { key: 'att', label: 'Attendance 14d', num: true, render: (r) => cell(r.st.attendance, fedAvg.attendance, '%'), sort: (r) => r.st.attendance, hideSm: true },
        !ops && { key: 'why', label: 'Why', render: (r) => { const t = topReason(r.athlete); return html`<span className=${AMS.cx('small', t.tone)}>${t.text}</span>`; }, sort: false, hideSm: true },
        ops && { key: 'prof', label: 'Profile', num: true, render: (r) => r.athlete.profileCompletion + '%', sort: (r) => r.athlete.profileCompletion },
        !ops && { key: 'flag', label: 'AI flag', render: (r) => (r.st.flags ? html`<${UI.Pill} tone="ai"><${I} name="sparkles" size=${11} />${S(r.athlete).acwr >= 1.5 ? 'Load jump' : 'Wellness drop'}<//>` : html`<span className="faint">—</span>`), sort: (r) => r.st.flags },
      ].filter(Boolean);
    } else {
      cols = [
        { key: 'label', label: LEVEL_LABEL[data.level].replace(/s$/, ''), render: (r) => html`<span className="col tight" style=${{ gap: 0 }}><b>${r.label}</b><span className="tiny faint">${r.sub}</span></span>`, sort: (r) => r.label },
        { key: 'n', label: 'Athletes', num: true, render: (r) => r.st.n, sort: (r) => r.st.n },
        !ops && { key: 'ready', label: 'Readiness', render: (r) => html`<span className="row tight" style=${{ gap: 8 }}>${cell(r.st.readiness, fedAvg.readiness)}<${BandBar} bands=${r.st.bands} n=${r.st.n} style=${{ width: 84 }} /></span>`, sort: (r) => r.st.readiness },
        { key: 'checkin', label: 'Check-in', num: true, render: (r) => cell(r.st.checkin, fedAvg.checkin, '%'), sort: (r) => r.st.checkin },
        !ops && { key: 'avail', label: 'Available', num: true, render: (r) => cell(r.st.avail, fedAvg.avail, '%'), sort: (r) => r.st.avail },
        !ops && { key: 'inj', label: 'Open inj.', num: true, render: (r) => (r.st.injuries ? html`<span className="bad" style=${{ fontWeight: 600 }}>${r.st.injuries}</span>` : html`<span className="faint">0</span>`), sort: (r) => r.st.injuries },
        { key: 'att', label: 'Attendance 14d', num: true, render: (r) => cell(r.st.attendance, fedAvg.attendance, '%'), sort: (r) => r.st.attendance, hideSm: true },
        ops && { key: 'prof', label: 'Profile complete', num: true, render: (r) => cell(r.st.profile, fedAvg.profile, '%'), sort: (r) => r.st.profile },
        !ops && { key: 'flags', label: 'AI flags', num: true, render: (r) => (r.st.flags ? html`<${UI.Pill} tone="ai"><${I} name="sparkles" size=${11} />${r.st.flags}<//>` : html`<span className="faint">0</span>`), sort: (r) => r.st.flags, hideSm: true },
        { key: 'go', label: '', render: () => html`<${I} name="chev-r" size=${14} style=${{ color: 'var(--fg-3)' }} />`, sort: false, width: 24 },
      ].filter(Boolean);
    }
    const title = 'Compare one level down · ' + LEVEL_LABEL[data.level] + ' in ' + AMS.scopeLabel();
    return html`<${UI.Card} title=${title} icon="layers" hint=${data.level === 'athlete' ? 'click a row to open the profile' : 'click a row to drill down'}
      actions=${html`${crumbs(e).length > 1 && !crumbs(e)[crumbs(e).length - 2].locked && html`<button className="btn ghost sm" onClick=${drillUp}><${I} name="arrow-up" size=${13} />Up a level</button>`}${ops && html`<${VisibleNote} icon="lock" text="Readiness & medical columns hidden for Operations" />`}`} flush>
      <${UI.Table} columns=${cols} rows=${data.rows} onRow=${drillTo} compact=${true} maxHeight=${data.level === 'athlete' ? 460 : null} initialSort=${data.level === 'athlete' && !ops ? { key: 'ready', dir: 'asc' } : null} empty="No athletes in this scope" />
      <div className="row between wrap tiny faint" style=${{ padding: '8px 14px', borderTop: '1px solid var(--border)' }}>
        <span>Scope average: ${!ops ? 'readiness ' + fedAvg.readiness + ' · available ' + fedAvg.avail + '% · ' : ''}check-in ${fedAvg.checkin}% · attendance ${fedAvg.attendance}%${ops ? ' · profile ' + fedAvg.profile + '%' : ''}</span>
        <span>Colour = gap vs scope average (±5 / ±10 pts)</span>
      </div>
    <//>`;
  }

  /** Readiness distribution donut + clickable legend → athlete-list drawer. */
  function ReadinessDist({ list }) {
    const st = groupStats(list);
    const ids = (band) => list.filter((a) => S(a).band === band).map((a) => a.id);
    const open = (b) => openList(b.label + ' readiness — ' + AMS.scopeLabel(), ids(b.id), b.id === 'none' ? 'Athletes who have not submitted this morning\'s check-in. Readiness is estimated from their 3-day average.' : 'Readiness today combines this morning\'s check-in vs the athlete\'s own 3-week normal, load jump (ACWR) and availability.');
    const data = BANDS.map((b) => ({ label: b.label, value: st.bands[b.id], tone: b.tone, id: b.id }));
    return html`<${UI.Card} title="Readiness today" icon="pulse" hint=${st.checked + ' of ' + st.n + ' checked in'}>
      <div className="row" style=${{ gap: 18, flexWrap: 'wrap' }}>
        <${UI.Donut} data=${data} size=${132} thickness=${16} onSlice=${(d) => open(BANDS.find((b) => b.id === d.id))} center=${html`<span className="col tight" style=${{ gap: 0, alignItems: 'center' }}><span className="num" style=${{ fontSize: 26, fontWeight: 600 }}>${st.readiness}</span><span className="tiny faint">avg score</span></span>`} />
        <div className="col tight grow" style=${{ gap: 2, minWidth: 160 }}>
          ${BANDS.map((b) => html`<button key=${b.id} className="db-legend-btn" onClick=${() => open(b)}>
            <span style=${{ width: 10, height: 10, borderRadius: 3, background: UI.color(b.tone), flex: 'none' }} /><span className="grow">${b.label}</span><b className="tnum">${st.bands[b.id]}</b><span className="tiny faint tnum" style=${{ width: 34, textAlign: 'right' }}>${pct(st.bands[b.id], st.n)}%</span><${I} name="chev-r" size=${12} style=${{ color: 'var(--fg-3)' }} />
          </button>`)}
        </div>
      </div>
    <//>`;
  }

  /** Participation analytics: attendance per squad, check-in compliance trend, RPE submission. */
  function Participation({ list, P }) {
    const [view, setView] = useState('attendance');
    const e = eff();
    const ds = useMemo(() => dailySeries(list), [AMS.version, list.length]);
    const sqRows = Object.entries(P.bySquad).map(([sid, q]) => ({ sid, q, sq: AMS.org.squad(sid) })).filter((r) => r.sq).sort((a, b) => pct(a.q.present, a.q.denom) - pct(b.q.present, b.q.denom));
    const dates = Object.keys(P.byDate).sort();
    const rpeData = dates.map((d) => ({ label: D.fmt(d).replace(' Oct', '').replace(' Sep', '/9'), date: d, value: pct(P.byDate[d].rpeGiven, P.byDate[d].rpeDue) }));
    const st = groupStats(list, P.byAth);
    const lockSq = (e.lock || {}).squadIds;
    return html`<${UI.Card} title="Participation analytics" icon="users" hint="last 14 days"
      actions=${html`<${UI.Seg} size="sm" value=${view} onChange=${setView} options=${[{ id: 'attendance', label: 'Attendance' }, { id: 'checkin', label: 'Check-in' }, { id: 'rpe', label: 'RPE' }]} />`}>
      <div className="row wrap" style=${{ gap: 20, marginBottom: 12 }}>
        <div className="db-stat"><span className="upper">Attendance</span><b className=${st.attendance >= 90 ? 'good' : st.attendance >= 80 ? 'warn' : 'bad'}>${st.attendance}%</b></div>
        <div className="db-stat"><span className="upper">Check-in today</span><b>${st.checkin}%</b></div>
        <div className="db-stat"><span className="upper">Check-in 28d</span><b>${Math.round(AMS.mean(ds.slice(0, 27).map((x) => x.checkin)))}%</b></div>
        <div className="db-stat"><span className="upper">RPE submitted</span><b className=${st.rpe >= 90 ? 'good' : 'warn'}>${st.rpe}%</b></div>
        <div className="db-stat"><span className="upper">Training hours</span><b>${Math.round(P.hours14).toLocaleString('en-IN')}</b></div>
      </div>
      ${view === 'attendance' && html`<div className="col" style=${{ gap: 6 }}>
        <${UI.HBars} labelWidth=${170} format=${(x) => x + '%'} max=${100} data=${sqRows.slice(0, 12).map((r) => { const val = pct(r.q.present, r.q.denom); const missedIds = Object.keys(r.q.missedIds); return { label: r.sq.name, sub: AMS.org.centre(r.sq.centreId).short, value: val, tone: val >= 90 ? 'good' : val >= 80 ? 'warn' : 'bad', onClick: () => (e.squadId === r.sid ? openList('Missed sessions — ' + r.sq.name, missedIds, 'Athletes with at least one unexcused absence in the last 14 days.') : (!lockSq || lockSq.includes(r.sid)) && drillTo({ kind: 'squad', id: r.sid })) }; })} />
        <span className="tiny faint">Attendance = present or late ÷ scheduled (excused absences excluded). ${e.squadId ? 'Click the bar to see who missed sessions.' : 'Click a squad to drill into it.'}${sqRows.length > 12 ? ' Showing the 12 lowest of ' + sqRows.length + '.' : ''}</span>
      </div>`}
      ${view === 'checkin' && html`<div className="col tight">
        <${UI.LineChart} height=${190} yMin=${0} yMax=${100} yFormat=${(x) => x + '%'} series=${[{ name: 'Check-in %', data: ds.map((x) => ({ x: D.fmt(x.date), y: x.checkin })), tone: 'accent', area: true }]} refs=${[{ y: 80, label: 'Target 80%', tone: 'good' }]} markers=${[{ i: 27, label: 'Today (live)', tone: 'info' }]} onPoint=${(i) => { const day = ds[i]; openList('No check-in on ' + D.fmt(day.date), list.filter((a) => !(a.wellness || [])[i]).map((a) => a.id), 'Athletes in ' + AMS.scopeLabel() + ' without a wellness check-in that morning.'); }} />
        <span className="tiny faint">Share of athletes with a morning wellness check-in, per day (28 days). Click a day to list the athletes who missed it.</span>
      </div>`}
      ${view === 'rpe' && html`<div className="col tight">
        <${UI.BarChart} height=${190} data=${rpeData} yFormat=${(x) => x + '%'} refY=${90} refLabel="Target 90%" tone="info" onBar=${(d) => openList('No session RPE — ' + D.fmt(d.date), [...new Set(P.byDate[d.date].noRpe)], 'Athletes who trained but did not submit their post-session effort rating (RPE). Without it, session load (RPE × minutes) is missing.')} />
        <span className="tiny faint">RPE submission = effort ratings ÷ athletes who trained. Click a bar for who is missing.</span>
      </div>`}
    <//>`;
  }

  /** Injury alerts — summary-only for non-medical roles. */
  function InjuryAlerts({ list }) {
    const { db, ui } = AMS.useStore();
    const ids = new Set(list.map((a) => a.id));
    const open = db.injuries.filter((i) => ids.has(i.athleteId) && i.status !== 'Closed');
    const today = open.filter((i) => i.dateOfInjury === AMS.TODAY || (i.timeline || []).some((t) => t.type === 'report' && t.date === AMS.TODAY) || (i.status === 'Reported' && D.diff(AMS.TODAY, i.dateOfInjury) <= 1));
    const byStatus = STATUS_ORDER.map((s) => ({ s, items: open.filter((i) => i.status === s) }));
    const unav = list.filter((a) => a.availability === 'Unavailable'), mod = list.filter((a) => a.availability === 'Modified');
    const recent = open.slice().sort((a, b) => b.dateOfInjury.localeCompare(a.dateOfInjury)).slice(0, 6);
    const full = isMedRole();
    return html`<${UI.Card} title="Injury alerts" icon="medical" hint=${open.length + ' open'} actions=${html`<${VisibleNote} text=${full ? 'Full detail' : 'Summary only'} icon=${full ? 'eye' : 'lock'} /><button className="btn sm" onClick=${() => AMS.go('medical')}>Medical<${I} name="arrow-r" size=${13} /></button>`}>
      <div className="grid g3 keep" style=${{ gap: 10, marginBottom: 12 }}>
        <div className="db-stat clickable" style=${{ padding: 6, borderRadius: 6 }} onClick=${() => openList('New injury reports (24 h)', today.map((i) => i.athleteId), 'Reported in the last 24 hours.')}><span className="upper">New (24 h)</span><b className=${today.length ? 'bad' : ''}>${today.length}</b></div>
        <div className="db-stat clickable" style=${{ padding: 6, borderRadius: 6 }} onClick=${() => openList('Unavailable athletes', unav.map((a) => a.id), 'Cannot train today.')}><span className="upper">Unavailable</span><b className="bad">${unav.length}</b></div>
        <div className="db-stat clickable" style=${{ padding: 6, borderRadius: 6 }} onClick=${() => openList('Modified training', mod.map((a) => a.id), 'Training with limits set by medical staff.')}><span className="upper">Modified</span><b className="warn">${mod.length}</b></div>
      </div>
      <div className="row wrap tight" style=${{ marginBottom: 10 }}>
        ${byStatus.map((x) => html`<button key=${x.s} className="btn xs" disabled=${!x.items.length} onClick=${() => openList(x.s + ' — open injuries', x.items.map((i) => i.athleteId), 'Injury cases currently in "' + x.s + '".')}>${x.s}<b className="tnum" style=${{ marginLeft: 4 }}>${x.items.length}</b></button>`)}
      </div>
      <div className="list" style=${{ margin: '0 -16px -14px' }}>
        ${recent.map((i) => { const a = AMS.org.athlete(i.athleteId); return html`<div key=${i.id} className="list-item clickable" onClick=${() => openInjury(i)}>
          <span className=${'dot ' + (i.availability === 'Unavailable' ? 'bad' : i.status === 'Monitoring' ? 'info' : 'warn')} />
          <span className="col tight grow" style=${{ gap: 0, minWidth: 0 }}><span className="ellipsis" style=${{ fontWeight: 600 }}>${a.name}</span><span className="tiny faint ellipsis">${AMS.medicalLabel(i, ui.role)}${full && i.grade ? ' · grade ' + i.grade : ''}</span></span>
          <${UI.Pill} tone=${i.status === 'Reported' ? 'bad' : i.status === 'Clearance' ? 'warn' : i.status === 'Monitoring' ? 'info' : ''}>${i.status}<//>
          <span className="tiny faint tnum" style=${{ width: 54, textAlign: 'right' }}>${D.rel(i.dateOfInjury)}</span>
        </div>`; })}
        ${!recent.length && html`<${UI.Empty} icon="shield-check" title="No open injuries in this scope" />`}
      </div>
    <//>`;
  }

  /** 12-month injury trend by severity, drill to the athletes behind a month. */
  function InjuryTrend({ list, P }) {
    const rows = useMemo(() => injuryTrend(list), [AMS.version, list.length]);
    const byZone = {};
    rows.forEach((r) => r.minor.concat(r.moderate, r.severe).forEach((i) => { const z = AMS.bodyZone(i.region); byZone[z] = (byZone[z] || 0) + 1; }));
    const inc = incidence(list, P, 90, 0);
    const total = AMS.sum(rows.map((r) => r.minor.length + r.moderate.length + r.severe.length));
    return html`<${UI.Card} title="Injury trend" icon="trend-up" hint=${total + ' injuries · 12 months'} actions=${html`<${UI.Pill} tone=${inc.rate > 2 ? 'warn' : 'good'} title=${inc.n + ' injuries over ~' + inc.hours.toLocaleString('en-IN') + ' training hours (90 days)'}>${inc.rate} / 1,000 h<//>`}>
      <${UI.BarChart} height=${180} stacked=${true} keys=${[{ name: 'Minor', tone: 'info' }, { name: 'Moderate', tone: 'warn' }, { name: 'Severe', tone: 'bad' }]} data=${rows.map((r) => ({ label: r.label, values: [r.minor.length, r.moderate.length, r.severe.length], key: r.key }))} onBar=${(d) => { const r = rows.find((x) => x.key === d.key); openList('Injuries reported in ' + d.label + ' ' + d.key.slice(0, 4), [...new Set(r.minor.concat(r.moderate, r.severe).map((i) => i.athleteId))], 'Athletes with an injury reported that month (any status).'); }} />
      <div className="row wrap tight" style=${{ marginTop: 8 }}>
        ${Object.entries(byZone).sort((a, b) => b[1] - a[1]).map(([z, n]) => html`<span key=${z} className="evidence">${z} <b>${n}</b></span>`)}
      </div>
    <//>`;
  }

  /** Upcoming competitions with projected available athletes. */
  function CompetitionReadiness({ list }) {
    const comps = useMemo(() => upcomingComps(list), [AMS.version, list.length]);
    return html`<${UI.Card} title="Competition readiness" icon="flag" hint="projected availability on event day" flush>
      <div className="list">
        ${comps.map((p) => html`<div key=${p.comp.id} className="list-item clickable" style=${{ alignItems: 'flex-start' }} onClick=${() => openList(p.comp.name + ' — eligible athletes', p.rows.slice().sort((x, y) => x.p - y.p).map((r) => r.a.id), 'Eligible for ' + p.comp.name + ' (' + D.fmt(p.comp.date) + ', ' + p.comp.location + '). Projection uses injury return dates with a 7-day buffer and today\'s injury-risk band.')}>
          <span className="col tight" style=${{ width: 54, flex: 'none', alignItems: 'center', gap: 0 }}><span className="num" style=${{ fontSize: 20, fontWeight: 600 }}>${p.days}</span><span className="tiny faint">days</span></span>
          <span className="col tight grow" style=${{ gap: 4, minWidth: 0 }}>
            <span className="row between" style=${{ gap: 8 }}><span className="ellipsis" style=${{ fontWeight: 600 }}>${p.comp.name}</span><${UI.Pill} tone=${p.share >= 90 ? 'good' : p.share >= 85 ? 'warn' : 'bad'}>${p.share}%<//></span>
            <span className="tiny faint">${D.fmt(p.comp.date)} · ${p.comp.location} · ${p.comp.level} · ${p.eligible} eligible → ${p.projected} projected fit</span>
            <${UI.Meter} value=${p.share} tone=${p.share >= 90 ? 'good' : p.share >= 85 ? 'warn' : 'bad'} />
            ${p.atRisk.length > 0 && html`<span className="row wrap tight">${p.atRisk.slice(0, 4).map((r) => html`<span key=${r.a.id} className="evidence" title=${r.why || ''}><span className="dot warn" style=${{ width: 6, height: 6 }} />${first(r.a.name)} ${r.a.name.split(' ')[1] ? r.a.name.split(' ')[1][0] + '.' : ''} <b>${Math.round(r.p * 100)}%</b></span>`)}${p.atRisk.length > 4 && html`<span className="tiny faint">+${p.atRisk.length - 4} more</span>`}</span>`}
          </span>
        </div>`)}
        ${!comps.length && html`<${UI.Empty} icon="flag" title="No upcoming competitions for this scope" />`}
      </div>
    <//>`;
  }

  /** Live activity feed — scope-filtered and masked by role. */
  function maskActivity(e, role, full, injFor) {
    const medical = /injur|medical|rehab|clearance|assess/i.test(e.type || '');
    if (role === 'ops') {
      if (medical) return null;
      if (e.type === 'checkin') return Object.assign({}, e, { text: (e.by || 'Athlete') + ' submitted morning check-in' });
      if (/readiness|wellness|training/.test(e.type || '')) return null;
      return e;
    }
    if (medical && !full) {
      const a = e.athleteId && AMS.org.athlete(e.athleteId);
      const inj = e.athleteId && injFor(e.athleteId);
      return Object.assign({}, e, { text: (a ? a.name + ' — ' : '') + (inj ? AMS.medicalLabel(inj, role) : 'medical update') + ' (details restricted)', masked: true });
    }
    return e;
  }
  const FEED_ICON = { checkin: 'check', injury: 'alert', medical: 'medical', training: 'whistle', integration: 'watch', onboarding: 'user', notify: 'send', availability: 'shield', brief: 'sparkles', task: 'clipboard', documents: 'file' };
  function LiveFeed({ limit, title }) {
    const { db, ui } = AMS.useStore();
    const [n, setN] = useState(limit || 10);
    const scoped = new Set(AMS.scopedAthletes({ all: true }).map((a) => a.id));
    const full = isMedRole();
    const now = toMin(AMS.clockTime());
    let hidden = 0;
    const items = [];
    for (const e of db.activity) {
      if (e.athleteId && !scoped.has(e.athleteId)) continue;
      const m = maskActivity(e, ui.role, full, openInjOf);
      if (!m) { hidden++; continue; }
      items.push(m);
      if (items.length >= n) break;
    }
    return html`<${UI.Card} title=${title || 'Live activity'} icon="pulse" hint=${AMS.scopeLabel()} actions=${html`<${LiveBadge} />`} flush
      footer=${html`<div className="row between wrap" style=${{ width: '100%', gap: 8 }}><span className="tiny faint">${!full ? (ui.role === 'ops' ? 'Medical and readiness events hidden for Operations' : 'Medical events shown as summary only') : 'Full medical detail visible to you'}${hidden ? ' · ' + hidden + ' hidden' : ''}</span>${items.length >= n && html`<button className="btn ghost xs" onClick=${() => setN(n + 10)}>Show more</button>`}</div>`}>
      <div style=${{ maxHeight: 420, overflowY: 'auto' }}>
        ${items.map((e) => { const t = e.at || ''; const isToday = t.slice(0, 10) === AMS.TODAY; const fresh = isToday && now - toMin(t.slice(11, 16)) <= 2 && now >= toMin(t.slice(11, 16)); return html`<div key=${e.id} className=${AMS.cx('db-feed-item', fresh && 'fresh', e.athleteId && 'clickable')} style=${{ cursor: e.athleteId ? 'pointer' : 'default' }} onClick=${e.athleteId ? () => AMS.openAthlete(e.athleteId) : undefined}>
          <span className="db-feed-ic" style=${e.type === 'injury' || e.masked ? { background: 'var(--bad-weak)', color: 'var(--bad)' } : e.type === 'checkin' ? { background: 'var(--good-weak)', color: 'var(--good)' } : e.type === 'brief' ? { background: 'var(--ai-weak)', color: 'var(--ai)' } : null}><${I} name=${e.masked ? 'lock' : FEED_ICON[e.type] || 'info'} size=${12} /></span>
          <span className="col tight grow" style=${{ gap: 1, minWidth: 0 }}><span className="small" style=${{ overflowWrap: 'anywhere' }}>${e.text}</span><span className="tiny faint">${e.by || 'System'}${e.role && e.role !== 'system' ? ' · ' + AMS.roleLabel(e.role) : ''}</span></span>
          <span className="tiny faint tnum" style=${{ whiteSpace: 'nowrap' }}>${fresh ? html`<span className="pill accent" style=${{ height: 16, fontSize: 10 }}>new</span>` : null} ${t.slice(11, 16)}${isToday ? '' : ' · ' + D.rel(t.slice(0, 10))}</span>
        </div>`; })}
        ${!items.length && html`<${UI.Empty} icon="pulse" title="No activity in this scope yet" />`}
      </div>
    <//>`;
  }

  /** AI recommendations for the role, with "view all" into the copilot. */
  const ROLE_KINDS = { physio: ['medical', 'risk', 'wellness', 'training'], doctor: ['medical', 'risk', 'wellness', 'training'], scientist: ['risk', 'wellness', 'ops', 'training'], nutritionist: ['nutrition', 'wellness', 'risk', 'ops'], ops: ['ops', 'talent'] };
  function AIRecs({ limit, title }) {
    const { ui } = AMS.useStore();
    const kinds = ROLE_KINDS[ui.role];
    const all = AMS.ai.insights().filter((i) => !kinds || kinds.includes(i.kind));
    const max = limit || 5;
    return html`<${UI.Card} ai title=${title || 'AI recommendations'} hint=${all.length + ' open'} actions=${html`<span className="tiny faint hide-sm">acted on ${AMS.ai.actedRate()}%</span><button className="btn ghost sm" onClick=${() => AMS.go('copilot')}>View all<${I} name="arrow-r" size=${13} /></button>`} flush
      footer=${html`<span className="tiny faint">Every warning shows its evidence. AI suggests and drafts; medical status only changes when a clinician confirms.</span>`}>
      <${UI.InsightList} insights=${all} max=${max} empty="No AI flags in this scope" />
      ${all.length > max && html`<div style=${{ padding: '8px 16px' }}><button className="btn ghost sm" onClick=${() => AMS.go('copilot')}>+${all.length - max} more in Copilot</button></div>`}
    <//>`;
  }

  /** Open tasks owned by the current role. */
  function TasksCard({ list }) {
    const { db, ui } = AMS.useStore();
    const ids = new Set(AMS.scopedAthletes({ all: true }).map((a) => a.id));
    const tasks = db.tasks.filter((t) => t.ownerRole === ui.role && t.status === 'Open' && (!t.athleteId || ids.has(t.athleteId))).sort((a, b) => (a.due || '').localeCompare(b.due || ''));
    return html`<${UI.Card} title="Your tasks" icon="clipboard" hint=${tasks.length + ' open'} flush>
      <div className="list">
        ${tasks.slice(0, 8).map((t) => { const overdue = t.due && t.due < AMS.TODAY, dueToday = t.due === AMS.TODAY; return html`<div key=${t.id} className="list-item">
          <span className=${'dot ' + (overdue ? 'bad' : dueToday ? 'warn' : 'neutral')} />
          <span className="col tight grow" style=${{ gap: 0, minWidth: 0 }}><span className="small ellipsis" style=${{ fontWeight: 600 }}>${t.title}</span><span className="tiny faint">Due ${t.due ? D.fmt(t.due) + ' (' + D.rel(t.due) + ')' : '—'} · ${t.module || 'general'}</span></span>
          ${t.athleteId && html`<button className="btn ghost xs" onClick=${() => AMS.openAthlete(t.athleteId)}>Athlete</button>`}
          <button className="btn xs" onClick=${() => AMS.runAction('dashboard.taskDone', { taskId: t.id })}><${I} name="check" size=${12} />Done</button>
        </div>`; })}
        ${!tasks.length && html`<${UI.Empty} icon="check" title="No open tasks" />`}
      </div>
    <//>`;
  }

  /* ================================================================== DIRECTOR */
  function MorningBrief({ list, P }) {
    const { v, db } = AMS.useStore();
    const e = eff();
    const [stamp, setStamp] = useState(null);
    const [thinking, setThinking] = useState(false);
    const b = useMemo(() => morningBrief(list, P, e), [v, JSON.stringify(e)]);
    const shared = ((db.dashboard && db.dashboard.briefs) || []).find((x) => x.scope === AMS.scopeLabel() && x.at.slice(0, 10) === AMS.TODAY);
    const regen = () => { setThinking(true); setTimeout(() => { setThinking(false); setStamp(AMS.clockTime()); }, 650); };
    return html`<${UI.Card} ai title="AI morning brief" hint=${'generated ' + (stamp || '07:05') + ' · ' + AMS.scopeLabel()}
      actions=${html`<button className="btn ghost sm" onClick=${regen} disabled=${thinking}><${I} name="refresh" size=${13} />${thinking ? 'Reading data…' : 'Regenerate'}</button>
        ${shared ? html`<${UI.Pill} tone="good"><${I} name="check" size=${11} />Shared ${shared.at.slice(11, 16)}<//>` : html`<button className="btn ai sm" onClick=${() => AMS.runAction('dashboard.shareBrief', { summary: b.summary, decisions: b.decisions.length })}><${I} name="send" size=${13} />Share with staff</button>`}`}
      footer=${html`<div className="row between wrap" style=${{ width: '100%', gap: 8 }}><span className="tiny faint">Sources: ${b.sources.checkins} check-ins today · ${b.sources.sessions} training days of attendance & RPE · ${b.sources.injuries} injury records. Medical detail is summarised to your access level.</span><${UI.AskCopilot} prompt="summarise the week" label="Ask a follow-up" /></div>`}>
      <div className=${AMS.cx('col', thinking && 'db-thinking')} style=${{ gap: 14 }}>
        <p className="db-brief-head">${b.headline}</p>
        <div className="grid g3" style=${{ gap: 12 }}>
          <div className="db-brief-col">
            <span className="upper">Top risks today</span>
            ${b.risks.map((r) => html`<div key=${r.athleteId} className="db-brief-item">
              <div className="row between" style=${{ gap: 6 }}><button className="btn ghost xs" style=${{ padding: 0, fontWeight: 600, fontSize: 13 }} onClick=${() => AMS.openAthlete(r.athleteId)}>${r.name}</button>${r.handled ? html`<${UI.Pill} tone="good">Adjusted<//>` : html`<${UI.Pill} tone="bad">Action<//>`}</div>
              <span className="tiny faint">${r.where}</span>
              <span className="small muted">${r.text}</span>
              <${UI.Evidence} items=${r.chips} />
              ${!r.handled && r.sessionId && html`<div className="row tight wrap"><button className="btn xs" onClick=${() => AMS.runAction('notify', { toRole: 'coach', athleteId: r.athleteId, text: r.name + ': high injury risk today (' + r.chips.map((c) => c.label + ' ' + c.value).join(', ') + '). Please adjust the session.' })}><${I} name="send" size=${12} />Ask coach to adjust</button></div>`}
            </div>`)}
            ${!b.risks.length && html`<div className="db-brief-item small muted">No athlete above the risk threshold in this scope.</div>`}
          </div>
          <div className="db-brief-col">
            <span className="upper">Changes vs last week</span>
            ${b.changes.map((c, i) => html`<div key=${i} className="db-brief-item">
              <span className="row top" style=${{ gap: 8 }}><${I} name=${c.icon} size=${15} style=${{ color: 'var(--' + c.tone + ')', flex: 'none', marginTop: 2 }} /><span className="small">${c.text}</span></span>
              <${UI.Evidence} items=${c.chips} />
              ${c.drill && html`<div><button className="btn ghost xs" onClick=${() => AMS.runAction('dashboard.drill', { centreId: c.drill, merge: true })}>Drill into centre<${I} name="arrow-r" size=${12} /></button></div>`}
            </div>`)}
          </div>
          <div className="db-brief-col">
            <span className="upper">Decisions needed (${b.decisions.length})</span>
            ${b.decisions.slice(0, 6).map((d, i) => html`<div key=${i} className=${'db-brief-item sev-stripe ' + d.tone}>
              <span className="row top" style=${{ gap: 8 }}><${I} name=${d.icon} size=${15} style=${{ color: 'var(--' + d.tone + ')', flex: 'none', marginTop: 2 }} /><span className="small">${d.text}</span></span>
              <${UI.Evidence} items=${d.chips} />
              ${d.cta && html`<div><button className="btn xs" onClick=${d.cta.run}>${d.cta.label}<${I} name="arrow-r" size=${12} /></button></div>`}
            </div>`)}
            ${!b.decisions.length && html`<div className="db-brief-item small muted">Nothing is waiting on leadership in this scope.</div>`}
          </div>
        </div>
      </div>
    <//>`;
  }

  function DirectorKpis({ list, P }) {
    const { v } = AMS.useStore();
    const e = eff();
    const k = useMemo(() => directorKpis(list, P, e), [v, JSON.stringify(e)]);
    const st = k.st;
    const notChecked = list.filter((a) => !S(a).rd.checkedIn).map((a) => a.id);
    return html`<div className="grid g4 keep">
      <${UI.KPI} label="Active athletes" icon="users" value=${k.active} delta=${k.activeDelta} foot=${'+' + k.new30 + ' enrolled in 30 days'} spark=${k.enrolledSpark} onClick=${() => openList('Active athletes — ' + AMS.scopeLabel(), list.map((a) => a.id), 'All athletes with enrollment status Active in this scope (home centre or current camp).')} />
      <${UI.KPI} label="Readiness avg" icon="pulse" value=${k.readiness} unit="/100" delta=${k.readinessDelta} foot=${st.bands.bad + ' red · ' + st.bands.warn + ' amber'} spark=${k.readinessSpark} sparkTone=${k.readiness >= 70 ? 'good' : 'warn'} tone=${k.readiness >= 70 ? '' : 'warn'} onClick=${() => openList('Red & amber readiness', list.filter((a) => ['bad', 'warn'].includes(S(a).rd.band)).map((a) => a.id), 'Readiness below 70 today. Sorted lowest first.')} />
      <${UI.KPI} label="Available to train" icon="shield-check" value=${k.avail} unit="%" delta=${k.availDelta} foot=${st.modified + ' modified · ' + st.unavail + ' unavailable'} spark=${k.availSpark} sparkTone="good" onClick=${() => openList('Not fully available', list.filter((a) => a.availability !== 'Available').map((a) => a.id), 'Modified or Unavailable today. Enrollment stays Active — availability is a separate daily status.')} />
      <${UI.KPI} label="Check-in rate" icon="check" value=${k.checkin} unit="%" delta=${k.checkinDelta} foot=${html`<span className="row tight" style=${{ gap: 5 }}><span className="live-dot" style=${{ width: 6, height: 6 }} />${st.checked} of ${st.n} · live</span>`} spark=${k.checkinSpark} sparkTone=${k.checkin >= 80 ? 'good' : 'warn'} onClick=${() => openList('No check-in yet today', notChecked, 'Athletes who have not submitted this morning\'s 30-second wellness check-in.')} />
      <${UI.KPI} label="Open injuries" icon="medical" value=${k.injuries} delta=${k.injDelta} deltaGood="down" foot=${k.daysLost + ' training days lost (open cases)'} spark=${k.injSpark} sparkTone="bad" onClick=${() => openList('Athletes with open injuries', [...new Set(st.injList.map((i) => i.athleteId))], 'Summary only for non-medical roles: availability and body zone, never the diagnosis.')} />
      <${UI.KPI} label="Injury incidence" icon="trend-down" value=${k.incidence} unit="/1,000 h" delta=${k.incDelta} deltaGood="down" foot=${k.incN + ' injuries · 90 days'} spark=${k.incSpark} sparkTone="warn" title=${'Injuries per 1,000 training hours. ' + k.incN + ' injuries over ~' + k.incHours.toLocaleString('en-IN') + ' h (exposure from attended session minutes).'} onClick=${() => openList('Injured in the last 90 days', k.injured90, 'Athletes with any injury reported in the last 90 days (open or closed). Incidence = injuries ÷ training hours × 1,000.')} />
      <${UI.KPI} label="Sessions today" icon="calendar" value=${k.sessDone + k.sessLive} unit=${'/' + k.sessions} foot=${(k.sessLive ? k.sessLive + ' live · ' : '') + 'attendance ' + k.attendance + '% (14d)'} spark=${k.attSpark} sparkTone="accent" onClick=${() => openList('Missed 2+ sessions (14 days)', k.missed, 'Unexcused absences in the last 14 days. Persistent absence is an early sign of illness, injury or disengagement.')} />
      <${UI.KPI} label="AI warnings acted on" icon="sparkles" value=${k.acted} unit="%" foot=${AMS.ai.insights().length + ' open AI warnings'} tone="" onClick=${() => AMS.go('copilot')} title="Share of AI warnings that staff acted on (vs dismissed). A product health metric: are warnings useful or noise?" />
    </div>`;
  }

  function CentreHeat({ list, P }) {
    const { v, db } = AMS.useStore();
    const e = eff();
    const data = useMemo(() => {
      const byC = AMS.groupBy(list, (a) => placeOf(a, e).centreId);
      const base = groupStats(list, P.byAth);
      const baseJump = pct(list.filter((a) => S(a).acwr >= 1.5).length, list.length);
      const baseInj = list.length ? AMS.round((base.injuries / list.length) * 100, 1) : 0;
      const rows = Object.entries(byC).map(([cid, m]) => {
        const st = groupStats(m, P.byAth);
        return { cid, c: AMS.org.centre(cid), st, jump: pct(m.filter((a) => S(a).acwr >= 1.5).length, m.length), inj100: AMS.round((st.injuries / m.length) * 100, 1) };
      }).filter((r) => r.c).sort((a, b) => a.st.readiness - b.st.readiness);
      return { rows, base, baseJump, baseInj };
    }, [v, JSON.stringify(e)]);
    const t = (val, base, hb) => { const d = hb === false ? base - val : val - base; return d <= -10 ? 'bad' : d <= -5 ? 'warn' : d >= 5 ? 'good' : null; };
    const cols = ['Athletes', 'Readiness', 'Check-in', 'Available', 'Load jump', 'Inj /100', 'Attend.', 'Profile'];
    const rows = data.rows.map((r) => ({
      label: html`<span title=${r.c.name}><b>${r.c.short}</b> <span className="faint">${AMS.org.state(r.c.stateId).name}</span></span>`,
      onClick: () => drillTo({ kind: 'centre', id: r.cid }),
      cells: [
        { label: r.st.n, title: r.st.n + ' active athletes' },
        { label: r.st.readiness, tone: t(r.st.readiness, data.base.readiness), title: 'Readiness avg ' + r.st.readiness + ' (scope ' + data.base.readiness + ')' },
        { label: r.st.checkin + '%', tone: t(r.st.checkin, data.base.checkin), title: 'Check-in ' + r.st.checkin + '% (scope ' + data.base.checkin + '%)' },
        { label: r.st.avail + '%', tone: t(r.st.avail, data.base.avail), title: 'Available ' + r.st.avail + '%' },
        { label: r.jump + '%', tone: t(r.jump * 2, data.baseJump * 2, false), title: 'Share with ACWR ≥ 1.5' },
        { label: r.inj100, tone: t(r.inj100, data.baseInj, false), title: 'Open injuries per 100 athletes' },
        { label: r.st.attendance + '%', tone: t(r.st.attendance, data.base.attendance), title: 'Attendance last 14 days' },
        { label: r.st.profile + '%', tone: t(r.st.profile, data.base.profile), title: 'Profile completion' },
      ],
    }));
    return html`<${UI.Card} title="Centre comparison" icon="building" hint="vs scope average · click a centre to drill in">
      ${data.rows.length > 1 ? html`<${UI.HeatGrid} rows=${rows} cols=${cols} cellW=${60} labelW=${190} />` : html`<${UI.Empty} icon="building" title="One centre in this scope">Drill up to compare centres.<//>`}
      <div className="legend" style=${{ marginTop: 8 }}><span><i style=${{ background: 'var(--good)' }} />5+ pts better</span><span><i style=${{ background: 'var(--warn)' }} />5–10 worse</span><span><i style=${{ background: 'var(--bad)' }} />10+ worse</span></div>
    <//>`;
  }

  function DirectorView({ list, P }) {
    return html`<${React.Fragment}>
      <${DirectorKpis} list=${list} P=${P} />
      <div className="grid g-main">
        <${MorningBrief} list=${list} P=${P} />
        <${AIRecs} limit=${4} />
      </div>
      <${CompareTable} list=${list} P=${P} />
      <div className="grid g-main">
        <${CentreHeat} list=${list} P=${P} />
        <${ReadinessDist} list=${list} />
      </div>
      <div className="grid g2">
        <div className="col" style=${{ gap: 16 }}><${InjuryTrend} list=${list} P=${P} /><${InjuryAlerts} list=${list} /></div>
        <${CompetitionReadiness} list=${list} />
      </div>
      <div className="grid g-main">
        <${Participation} list=${list} P=${P} />
        <${LiveFeed} limit=${12} />
      </div>
    <//>`;
  }

  /* ================================================================== COACH */
  function SessionHero({ list }) {
    const { db, ui } = AMS.useStore();
    const e = eff();
    const clock = AMS.clockTime();
    const sess = sessionsToday(list, e);
    const next = sess.find((s) => sessionState(s, clock).id !== 'done') || sess[sess.length - 1];
    const sameSlot = next ? sess.filter((s) => s.start === next.start) : [];
    const members = [];
    sameSlot.forEach((s) => sessionMembers(s).forEach((a) => { if (!members.find((x) => x.id === a.id)) members.push(a); }));
    const checked = members.filter((a) => C.todayWellness(a));
    const pending = members.filter((a) => !C.todayWellness(a) && a.availability !== 'Unavailable');
    const last = checked.slice().sort((a, b) => (C.todayWellness(b).at || '').localeCompare(C.todayWellness(a).at || ''))[0];
    const stt = next ? sessionState(next, clock) : null;
    const reds = members.filter((a) => S(a).band === 'bad');
    const redTodo = reds.filter((a) => { const s = AMS.todaySessionFor(a); return s && a.availability !== 'Unavailable' && !(s.mods && s.mods[a.id]); });
    const canTrain = AMS.canEdit('training');
    const remindedAt = db.meta.reminderAt;
    if (!next) return html`<${UI.Card} title="Before today's session" icon="whistle"><${UI.Empty} icon="calendar" title="No sessions scheduled today for your squads" /><//>`;
    return html`<${UI.Card} title="Before today's session" icon="whistle" hint=${sameSlot.map((s) => AMS.org.squad(s.squadId).name).join(' + ')} actions=${html`<${LiveBadge} />`}>
      <div className="grid g-main" style=${{ gap: 20, alignItems: 'center' }}>
        <div className="row wrap" style=${{ gap: 20 }}>
          <div className="col tight" style=${{ gap: 2 }}>
            <span className="upper">${stt.id === 'upcoming' ? 'Starts in' : stt.id === 'live' ? 'In progress' : 'Finished'}</span>
            <span className=${AMS.cx('db-big', stt.id === 'upcoming' && stt.mins <= 15 && 'warn')}>${stt.id === 'upcoming' ? fmtMins(stt.mins) : stt.id === 'live' ? stt.mins + ' min' : '—'}</span>
            <span className="tiny faint">${next.start} · ${next.duration} min · ${next.location}</span>
          </div>
          <div className="col tight grow" style=${{ gap: 4, minWidth: 200 }}>
            <span style=${{ fontWeight: 600, fontSize: 15 }}>${next.title}</span>
            <span className="row wrap tight"><${UI.Pill} tone=${next.intensity === 'High' ? 'bad' : next.intensity === 'Moderate' ? 'warn' : 'good'}>${next.intensity} intensity<//><${UI.Pill}>Planned RPE ${next.plannedRPE}<//><${UI.Pill} tone="info">${Object.keys(next.mods || {}).length} adjusted<//></span>
            <span className="row wrap tight" style=${{ marginTop: 4 }}>
              <button className="btn sm" onClick=${() => openSession(next)}><${I} name="calendar" size=${13} />Open session</button>
              ${canTrain && redTodo.length > 0 && html`<button className="btn ai sm" onClick=${() => AMS.runAction('dashboard.recoverAllRed', { athleteIds: redTodo.map((a) => a.id) })}><${I} name="zap" size=${13} />Move ${redTodo.length} red to recovery</button>`}
            </span>
          </div>
        </div>
        <div className="col" style=${{ gap: 8 }}>
          <div className="row between"><span className="small" style=${{ fontWeight: 600 }}>Check-ins for ${next.start}</span><span className="tnum"><b style=${{ fontSize: 18 }}>${checked.length}</b><span className="faint"> / ${members.length}</span></span></div>
          <${Progress} value=${checked.length} max=${members.length} tone=${pct(checked.length, members.length) >= 80 ? 'good' : 'warn'} />
          <div className="row between wrap tiny faint" style=${{ gap: 6 }}>
            <span>${last ? 'Latest: ' + last.name + ' at ' + C.todayWellness(last).at : 'Waiting for first check-in'}${remindedAt ? ' · reminder sent ' + remindedAt : ''}</span>
            ${pending.length > 0 && html`<button className="btn xs" onClick=${() => AMS.runAction('checkin.remind', { athleteIds: pending.map((a) => a.id) })}><${I} name="bell" size=${12} />Remind ${pending.length}</button>`}
          </div>
        </div>
      </div>
    <//>`;
  }

  function AthleteCard({ a }) {
    const { ui } = AMS.useStore();
    const s = S(a), rd = s.rd;
    const reason = topReason(a);
    const sess = AMS.todaySessionFor(a);
    const mod = sess && sess.mods && sess.mods[a.id];
    const canTrain = AMS.canEdit('training');
    const isRed = s.band === 'bad';
    return html`<div className=${'db-acard sev-stripe ' + (s.band === 'none' ? '' : s.band)} onClick=${() => AMS.openAthlete(a.id)} title=${rd.factors.map((f) => f.label + ': ' + f.value).join('\n') || 'No flags'}>
      <div className="row" style=${{ gap: 10, minWidth: 0 }}>
        <${UI.Ring} value=${rd.score} tone=${s.band === 'none' ? 'fg-3' : rd.band} size=${38} />
        <div className="col tight grow" style=${{ gap: 1, minWidth: 0 }}>
          <span className="ellipsis" style=${{ fontWeight: 600, fontSize: 13 }}>${a.name}</span>
          <span className=${AMS.cx('tiny ellipsis', reason.tone || 'faint')}>${reason.text}</span>
        </div>
        ${a.availability !== 'Available' && html`<${UI.AvailabilityPill} value=${a.availability} />`}
      </div>
      ${(isRed || mod) && a.availability !== 'Unavailable' && html`<div className="row between tight" style=${{ gap: 6 }} onClick=${(ev) => ev.stopPropagation()}>
        ${mod ? html`<span className="row tight" style=${{ gap: 6 }}><${UI.Pill} tone="ai"><${I} name="check" size=${11} />${mod.variant === 'recovery' ? 'Recovery' : mod.variant} · ${mod.at}<//>${canTrain && html`<button className="btn ghost xs" onClick=${() => AMS.runAction('dashboard.undoSessionMod', { athleteId: a.id, sessionId: sess.id })}>Undo</button>`}</span>`
          : sess ? (canTrain ? html`<button className="btn ai xs" onClick=${() => AMS.runAction('dashboard.recoverOne', { athleteId: a.id, sessionId: sess.id })}><${I} name="zap" size=${12} />Switch to recovery</button>` : html`<span className="tiny faint">Coach decides session changes</span>`)
          : html`<span className="tiny faint">No session today</span>`}
        <${UI.AcwrPill} value=${s.acwr} />
      </div>`}
    </div>`;
  }

  function ReadinessBoard({ list }) {
    const { ui } = AMS.useStore();
    const cols = [
      { id: 'bad', label: 'Red', tone: 'bad', hint: 'Adjust before training' },
      { id: 'warn', label: 'Amber', tone: 'warn', hint: 'Watch volume' },
      { id: 'good', label: 'Green', tone: 'good', hint: 'Train as planned' },
      { id: 'none', label: 'Awaiting check-in', tone: 'neutral', hint: 'Estimated from 3-day avg' },
    ];
    const groups = {}; cols.forEach((c) => { groups[c.id] = list.filter((a) => S(a).band === c.id).sort((x, y) => S(x).rd.score - S(y).rd.score); });
    const pending = groups.none.filter((a) => a.availability !== 'Unavailable');
    return html`<${UI.Card} title="Readiness board" icon="grid" hint=${list.length + ' athletes · compared with each athlete\'s own normal'} actions=${html`<${UI.AskCopilot} prompt="who is at risk today?" label="Who is at risk?" />`}>
      <div className="db-board">
        ${cols.map((c) => html`<div key=${c.id} className="db-col">
          <div className="db-col-h"><span className="row tight"><span className=${'dot ' + c.tone} />${c.label}<span className="faint" style=${{ fontWeight: 400 }}>${groups[c.id].length}</span></span>
            ${c.id === 'none' && pending.length > 0 ? html`<button className="btn xs" onClick=${() => AMS.runAction('checkin.remind', { athleteIds: pending.map((a) => a.id) })}><${I} name="bell" size=${11} />Nudge all</button>` : html`<span className="tiny faint" style=${{ fontWeight: 400 }}>${c.hint}</span>`}
          </div>
          ${groups[c.id].map((a) => html`<${AthleteCard} key=${a.id} a=${a} />`)}
          ${!groups[c.id].length && html`<div className="tiny faint" style=${{ padding: '10px 4px', textAlign: 'center' }}>None</div>`}
        </div>`)}
      </div>
    <//>`;
  }

  function TodaySessions({ list }) {
    const { v } = AMS.useStore();
    const e = eff();
    const sess = sessionsToday(list, e);
    const clock = AMS.clockTime();
    return html`<${UI.Card} title="Today's sessions" icon="calendar" hint=${sess.length + ' scheduled'} flush actions=${html`<button className="btn ghost sm" onClick=${() => AMS.go('training')}>Training<${I} name="arrow-r" size=${13} /></button>`}>
      <div className="list">
        ${sess.slice(0, 10).map((s) => { const stt = sessionState(s, clock); const n = sessionMembers(s).length; const mods = Object.keys(s.mods || {}).length; return html`<div key=${s.id} className="list-item clickable" onClick=${() => openSession(s)}>
          <span className="num tnum" style=${{ width: 46, fontSize: 16, fontWeight: 600 }}>${s.start}</span>
          <span className="col tight grow" style=${{ gap: 0, minWidth: 0 }}><span className="ellipsis" style=${{ fontWeight: 600 }}>${s.title}</span><span className="tiny faint ellipsis">${AMS.org.squad(s.squadId).name} · ${AMS.org.centre(AMS.org.squad(s.squadId).centreId).short} · ${s.location} · ${n} athletes${mods ? ' · ' + mods + ' adjusted' : ''}</span></span>
          <${UI.Pill} tone=${stt.tone}>${stt.id === 'live' && html`<span className="live-dot" style=${{ width: 6, height: 6 }} />`}${stt.label}<//>
        </div>`; })}
        ${!sess.length && html`<${UI.Empty} icon="calendar" title="No sessions today in this scope" />`}
      </div>
    <//>`;
  }

  function LimitedAthletes({ list }) {
    const { ui } = AMS.useStore();
    const rows = list.filter((a) => a.availability !== 'Available' || (S(a).inj && S(a).inj.status === 'Monitoring'));
    return html`<${UI.Card} title="Modified & unavailable" icon="shield" hint=${rows.length + ' athletes'} actions=${html`<${VisibleNote} icon=${isMedRole() ? 'eye' : 'lock'} text=${medNote()} />`} flush>
      <div className="list">
        ${rows.map((a) => { const inj = S(a).inj; const sess = AMS.todaySessionFor(a); const mod = sess && sess.mods && sess.mods[a.id]; return html`<div key=${a.id} className="list-item clickable" onClick=${() => AMS.openAthlete(a.id)}>
          <${UI.Avatar} name=${a.name} size=${28} />
          <span className="col tight grow" style=${{ gap: 0, minWidth: 0 }}><span className="ellipsis" style=${{ fontWeight: 600 }}>${a.name}</span><span className="tiny faint ellipsis">${inj ? AMS.medicalLabel(inj, ui.role) : a.availabilityReason || 'Availability set by staff'}${inj && inj.expectedReturn ? ' · expected back ' + D.fmt(inj.expectedReturn) : ''}</span></span>
          ${mod ? html`<${UI.Pill} tone="ai">${mod.variant}<//>` : null}
          <${UI.AvailabilityPill} value=${a.availability} />
        </div>`; })}
        ${!rows.length && html`<${UI.Empty} icon="shield-check" title="Everyone is fully available" />`}
      </div>
    <//>`;
  }

  function CoachView({ list, P }) {
    return html`<${React.Fragment}>
      <${SessionHero} list=${list} />
      <${ReadinessBoard} list=${list} />
      <div className="grid g-main">
        <div className="col" style=${{ gap: 16 }}>
          <${TodaySessions} list=${list} />
          <${LimitedAthletes} list=${list} />
        </div>
        <${AIRecs} limit=${5} />
      </div>
      <${CompareTable} list=${list} P=${P} />
      <div className="grid g-main">
        <${Participation} list=${list} P=${P} />
        <div className="col" style=${{ gap: 16 }}><${TasksCard} list=${list} /><${LiveFeed} limit=${8} /></div>
      </div>
    <//>`;
  }

  /* ================================================================== PHYSIO / DOCTOR */
  function MedicalKpis({ list }) {
    const { db } = AMS.useStore();
    const ids = new Set(list.map((a) => a.id));
    const open = db.injuries.filter((i) => ids.has(i.athleteId) && i.status !== 'Closed');
    const rep = open.filter((i) => i.status === 'Reported'), clr = open.filter((i) => i.status === 'Clearance');
    const overdue = open.filter((i) => i.status === 'Rehab' && i.stageSince && D.diff(AMS.TODAY, i.stageSince) > (i.stageTargetDays || 7));
    const soon = open.filter((i) => i.expectedReturn && D.diff(i.expectedReturn, AMS.TODAY) >= 0 && D.diff(i.expectedReturn, AMS.TODAY) <= 7);
    const highRisk = list.filter((a) => S(a).risk.band === 'bad');
    const L = (t, arr, note) => () => openList(t, [...new Set(arr.map((x) => x.athleteId || x.id))], note);
    return html`<div className="grid g6 keep">
      <${UI.KPI} label="Open cases" icon="medical" value=${open.length} foot=${open.filter((i) => i.path === 'light').length + ' light-path monitoring'} onClick=${L('Open injury cases', open, 'All open cases in your scope.')} />
      <${UI.KPI} label="Awaiting assessment" icon="alert" value=${rep.length} tone=${rep.length ? 'bad' : ''} foot=${rep.length ? 'oldest ' + D.rel(rep.map((i) => i.dateOfInjury).sort()[0]) : 'inbox clear'} onClick=${L('Awaiting assessment', rep, 'Reported injuries not yet assessed.')} />
      <${UI.KPI} label="Clearance requests" icon="shield-check" value=${clr.length} tone=${clr.length ? 'warn' : ''} foot="doctor sign-off" onClick=${L('Clearance requests', clr, 'Rehab complete — waiting for team doctor clearance.')} />
      <${UI.KPI} label="Rehab overdue" icon="clock" value=${overdue.length} tone=${overdue.length ? 'warn' : ''} foot="stage past plan" onClick=${L('Rehab stage overdue', overdue, 'Current return-to-play stage running longer than planned.')} />
      <${UI.KPI} label="Returning ≤ 7 days" icon="run" value=${soon.length} foot="expected return dates" onClick=${L('Expected back within 7 days', soon, 'Plan graded return-to-load with coaches.')} />
      <${UI.KPI} label="High injury risk" icon="zap" value=${highRisk.length} tone=${highRisk.length ? 'bad' : ''} foot="risk score ≥ 60" onClick=${L('High injury risk today', highRisk, 'Explainable risk: load jump, wellness vs own normal, sleep, history, monotony.')} />
    </div>`;
  }

  function InjuryInbox({ list, tab: initialTab }) {
    const { db, ui } = AMS.useStore();
    const [tab, setTab] = useState(initialTab || 'reported');
    const ids = new Set(list.map((a) => a.id));
    const open = db.injuries.filter((i) => ids.has(i.athleteId) && i.status !== 'Closed');
    const groups = { reported: open.filter((i) => i.status === 'Reported'), clearance: open.filter((i) => i.status === 'Clearance'), assessment: open.filter((i) => i.status === 'Assessment') };
    const items = groups[tab] || [];
    const isPhysio = ui.role === 'physio', isDoc = ui.role === 'doctor';
    return html`<${UI.Card} title="Injury inbox" icon="medical" actions=${html`<button className="btn ghost sm" onClick=${() => AMS.go('medical')}>Medical<${I} name="arrow-r" size=${13} /></button>`} flush>
      <div style=${{ padding: '0 16px' }}><${UI.Tabs} value=${tab} onChange=${setTab} tabs=${[{ id: 'reported', label: 'Awaiting assessment', count: groups.reported.length }, { id: 'clearance', label: 'Clearance requests', count: groups.clearance.length }, { id: 'assessment', label: 'In assessment', count: groups.assessment.length }]} /></div>
      <div className="list">
        ${items.map((i) => { const a = AMS.org.athlete(i.athleteId); const note = (i.notes || [])[0]; return html`<div key=${i.id} className="list-item" style=${{ alignItems: 'flex-start' }}>
          <${UI.Avatar} name=${a.name} size=${32} />
          <div className="col tight grow" style=${{ gap: 3, minWidth: 0 }}>
            <span className="row between wrap" style=${{ gap: 6 }}><b className="ellipsis">${a.name}</b><span className="tiny faint">${AMS.org.squad(a.squadId).name} · ${D.rel(i.dateOfInjury)}</span></span>
            <span className="small">${i.diagnosis}</span>
            <span className="tiny faint">${i.regionLabel} · ${i.mechanism || i.type} · reported by ${i.reportedBy}</span>
            ${note && html`<span className="tiny muted" style=${{ fontStyle: 'italic' }}>"${note.text}" — ${note.by}</span>`}
            <span className="row wrap tight" style=${{ marginTop: 2 }}>
              ${tab === 'reported' && isPhysio && html`<button className="btn primary xs" onClick=${() => AMS.runAction('dashboard.triageInjury', { injuryId: i.id })}><${I} name="clipboard" size=${12} />Start assessment</button>`}
              ${tab === 'clearance' && isDoc && html`<button className="btn primary xs" onClick=${() => openInjury(i)}><${I} name="shield-check" size=${12} />Review & sign clearance</button>`}
              <button className="btn xs" onClick=${() => openInjury(i)}>Open case</button>
              <${UI.AvailabilityPill} value=${i.availability} />
            </span>
          </div>
        </div>`; })}
        ${!items.length && html`<${UI.Empty} icon="check" title="Nothing waiting here" />`}
      </div>
    <//>`;
  }

  function RehabCaseload({ list }) {
    const { db } = AMS.useStore();
    const ids = new Set(list.map((a) => a.id));
    const rehab = db.injuries.filter((i) => ids.has(i.athleteId) && ['Rehab', 'Clearance'].includes(i.status));
    const byStage = [0, 1, 2, 3, 4, 5].map((k) => ({ k, items: rehab.filter((i) => i.rtpStage === k) }));
    return html`<${UI.Card} title="Rehab caseload by stage" icon="layers" hint=${rehab.length + ' active cases'}>
      <${UI.HBars} labelWidth=${150} max=${Math.max(1, ...byStage.map((s) => s.items.length))} data=${byStage.map((s) => ({ label: 'Stage ' + (s.k + 1) + ' · ' + (s.k === 5 ? 'Clearance' : ['Protect', 'Early load', 'Running / strength', 'High speed / sport', 'Full training'][s.k]), value: s.items.length, tone: s.k >= 4 ? 'good' : s.k >= 2 ? 'info' : 'warn', onClick: s.items.length ? () => openList('Rehab stage ' + (s.k + 1), s.items.map((i) => i.athleteId), 'Cases currently at this return-to-play stage.') : undefined }))} />
      <div className="tbl-wrap" style=${{ marginTop: 12 }}>
        <table className="tbl compact"><thead><tr><th>Athlete</th><th>Stage</th><th className="num">Days in stage</th><th className="hide-sm">Expected back</th></tr></thead>
          <tbody>${rehab.sort((a, b) => (D.diff(AMS.TODAY, b.stageSince || AMS.TODAY) - (b.stageTargetDays || 7)) - (D.diff(AMS.TODAY, a.stageSince || AMS.TODAY) - (a.stageTargetDays || 7))).map((i) => { const a = AMS.org.athlete(i.athleteId); const days = i.stageSince ? D.diff(AMS.TODAY, i.stageSince) : 0; const over = days > (i.stageTargetDays || 7); return html`<tr key=${i.id} className="clickable" onClick=${() => openInjury(i)}>
            <td><span className="col tight" style=${{ gap: 0 }}><b>${a.name}</b><span className="tiny faint">${i.regionLabel}</span></span></td>
            <td><span className="small">${(i.rtpStages[i.rtpStage] || {}).name || '—'}</span><span className="row" style=${{ gap: 3, marginTop: 3 }}>${i.rtpStages.map((s, k) => html`<span key=${k} style=${{ width: 12, height: 4, borderRadius: 2, background: k < i.rtpStage ? 'var(--good)' : k === i.rtpStage ? (over ? 'var(--warn)' : 'var(--accent)') : 'var(--surface-3)' }} />`)}</span></td>
            <td className="num"><span className=${over ? 'warn' : ''} style=${{ fontWeight: 600 }}>${days}</span><span className="faint"> / ${i.stageTargetDays || 7}</span></td>
            <td className="hide-sm small">${i.expectedReturn ? D.fmt(i.expectedReturn) : '—'}</td>
          </tr>`; })}</tbody></table>
      </div>
    <//>`;
  }

  function RiskList({ list }) {
    const rows = list.map((a) => ({ a, s: S(a) })).filter((r) => r.s.risk.score >= 35).sort((x, y) => y.s.risk.score - x.s.risk.score).slice(0, 8);
    return html`<${UI.Card} ai title="Predictive injury risk" hint="explainable · vs own normal" flush>
      <div className="list">
        ${rows.map(({ a, s }) => html`<div key=${a.id} className="list-item clickable" style=${{ alignItems: 'flex-start' }} onClick=${() => AMS.openAthlete(a.id)}>
          <${UI.Ring} value=${s.risk.score} tone=${s.risk.band} size=${36} />
          <div className="col tight grow" style=${{ gap: 4, minWidth: 0 }}>
            <span className="row between" style=${{ gap: 6 }}><b className="ellipsis">${a.name}</b><span className="tiny faint">${AMS.org.squad(a.squadId).name}</span></span>
            <${UI.Evidence} items=${s.risk.factors.slice(0, 4)} />
          </div>
        </div>`)}
        ${!rows.length && html`<${UI.Empty} icon="shield-check" title="No elevated risk in this scope" />`}
      </div>
    <//>`;
  }

  function WellnessFlags({ list }) {
    const rows = list.map((a) => { const w = C.todayWellness(a); const s = S(a); const flags = []; if (w && w.soreness <= 2) flags.push({ label: 'Soreness', value: w.soreness + '/5', tone: 'bad' }); if (w && w.sleep <= 2) flags.push({ label: 'Sleep', value: w.sleep + '/5 (' + w.sleepHrs + ' h)', tone: 'warn' }); if (s.drop <= -12) flags.push({ label: 'vs own normal', value: s.drop + ' pts', tone: 'bad' }); if (w && w.note) flags.push({ label: 'Note', value: '"' + w.note + '"', tone: 'info' }); return { a, w, flags }; }).filter((r) => r.flags.length).sort((x, y) => y.flags.length - x.flags.length).slice(0, 10);
    return html`<${UI.Card} title="Wellness red flags" icon="heart" hint="this morning's check-ins" flush>
      <div className="list">
        ${rows.map((r) => html`<div key=${r.a.id} className="list-item clickable" style=${{ alignItems: 'flex-start' }} onClick=${() => AMS.openAthlete(r.a.id, 'wellness')}>
          <${UI.Avatar} name=${r.a.name} size=${28} />
          <div className="col tight grow" style=${{ gap: 4, minWidth: 0 }}><span className="row between" style=${{ gap: 6 }}><b className="ellipsis">${r.a.name}</b><span className="tiny faint">${r.w ? 'checked in ' + r.w.at : 'no check-in'}</span></span><${UI.Evidence} items=${r.flags} /></div>
        </div>`)}
        ${!rows.length && html`<${UI.Empty} icon="heart" title="No wellness red flags" />`}
      </div>
    <//>`;
  }

  function MedicalView({ list, P, params }) {
    return html`<${React.Fragment}>
      <${MedicalKpis} list=${list} />
      <div className="grid g-main">
        <${InjuryInbox} list=${list} tab=${params && params.tab} />
        <${AIRecs} limit=${4} title="AI — medical & risk" />
      </div>
      <div className="grid g2">
        <${RehabCaseload} list=${list} />
        <${RiskList} list=${list} />
      </div>
      <div className="grid g2">
        <${WellnessFlags} list=${list} />
        <${ReadinessDist} list=${list} />
      </div>
      <${CompareTable} list=${list} P=${P} />
      <div className="grid g-main">
        <${InjuryTrend} list=${list} P=${P} />
        <div className="col" style=${{ gap: 16 }}><${TasksCard} list=${list} /><${LiveFeed} limit=${8} /></div>
      </div>
    <//>`;
  }

  /* ================================================================== SPORTS SCIENTIST */
  const ACWR_BINS = [
    { id: 'under', label: '< 0.8', test: (r) => r < 0.8, tone: 'info', note: 'Under-loaded — detraining or returning athletes' },
    { id: 'low', label: '0.8–1.0', test: (r) => r >= 0.8 && r < 1.0, tone: 'good', note: 'Sweet spot (lower half)' },
    { id: 'mid', label: '1.0–1.3', test: (r) => r >= 1.0 && r <= 1.3, tone: 'good', note: 'Sweet spot' },
    { id: 'rise', label: '1.3–1.5', test: (r) => r > 1.3 && r < 1.5, tone: 'warn', note: 'Rising load — watch closely' },
    { id: 'jump', label: '≥ 1.5', test: (r) => r >= 1.5, tone: 'bad', note: 'Load jump — highest injury risk' },
  ];
  function ScienceView({ list, P }) {
    const { db } = AMS.useStore();
    const bins = ACWR_BINS.map((b) => ({ ...b, ids: list.filter((a) => b.test(S(a).acwr)).map((a) => a.id) }));
    const jumps = list.filter((a) => S(a).acwr > 1.3).map((a) => ({ id: a.id, a, s: S(a), wk: C.weekLoad(a, 0), prev: C.weekLoad(a, 1), mono: C.monotony(a) })).sort((x, y) => y.s.acwr - x.s.acwr);
    const mono = list.filter((a) => C.monotony(a) > 2);
    const st = groupStats(list, P.byAth);
    const ws = wearableStatus(list);
    const w = (db.dashboard && db.dashboard.wearable) || { unmatched: [], imported: 0, lastImport: '—' };
    const devTotal = AMS.sum(ws.map((x) => x.n)), devSynced = AMS.sum(ws.map((x) => x.synced));
    const canEdit = AMS.canEdit('readiness');
    const ids = (k) => () => openList(ACWR_BINS.find((b) => b.id === k).label + ' ACWR', bins.find((b) => b.id === k).ids, ACWR_BINS.find((b) => b.id === k).note);
    return html`<${React.Fragment}>
      <div className="grid g6 keep">
        <${UI.KPI} label="Load jumps" icon="zap" value=${bins[4].ids.length} tone=${bins[4].ids.length ? 'bad' : ''} foot="ACWR ≥ 1.5" onClick=${ids('jump')} />
        <${UI.KPI} label="Rising load" icon="trend-up" value=${bins[3].ids.length} tone=${bins[3].ids.length ? 'warn' : ''} foot="ACWR 1.3–1.5" onClick=${ids('rise')} />
        <${UI.KPI} label="Under-loaded" icon="trend-down" value=${bins[0].ids.length} foot="ACWR below 0.8" onClick=${ids('under')} />
        <${UI.KPI} label="Check-in compliance" icon="check" value=${st.checkin} unit="%" foot=${st.checked + ' of ' + st.n + ' · live'} onClick=${() => openList('No check-in yet', list.filter((a) => !S(a).rd.checkedIn).map((a) => a.id), 'Readiness for these athletes is estimated from their 3-day average.')} />
        <${UI.KPI} label="High monotony" icon="sliders" value=${mono.length} foot="monotony > 2.0 (7d)" onClick=${() => openList('High training monotony', mono.map((a) => a.id), 'Same load every day (mean ÷ SD > 2). Add variation to reduce strain.')} />
        <${UI.KPI} label="Wearable sync" icon="watch" value=${pct(devSynced, devTotal)} unit="%" foot=${w.unmatched.length + ' unmatched devices'} tone=${w.unmatched.length ? 'warn' : ''} />
      </div>
      <div className="grid g-main">
        <${UI.Card} title="Load distribution (ACWR)" icon="chart" hint="acute 7d ÷ chronic 28d · click a bar">
          <${UI.BarChart} height=${180} data=${bins.map((b) => ({ label: b.label, value: b.ids.length, tone: b.tone, id: b.id }))} onBar=${(d) => ids(d.id)()} />
          <div className="tbl-wrap" style=${{ marginTop: 12 }}>
            <table className="tbl compact"><thead><tr><th>Athlete</th><th className="num">ACWR</th><th className="num">This week</th><th className="num hide-sm">Last week</th><th className="num">Change</th><th>Readiness</th><th className="hide-sm">Session</th></tr></thead>
              <tbody>${jumps.slice(0, 10).map((r) => { const sess = AMS.todaySessionFor(r.a); const mod = sess && sess.mods && sess.mods[r.id]; return html`<tr key=${r.id} className="clickable" onClick=${() => AMS.openAthlete(r.id, 'load')}>
                <td><${UI.AthleteCell} athlete=${r.a} size=${26} /></td>
                <td className="num"><${UI.AcwrPill} value=${r.s.acwr} /></td>
                <td className="num">${r.wk.toLocaleString('en-IN')} AU</td>
                <td className="num hide-sm faint">${r.prev.toLocaleString('en-IN')}</td>
                <td className="num"><span className=${r.wk > r.prev * 1.15 ? 'bad' : ''} style=${{ fontWeight: 600 }}>${r.prev ? (r.wk >= r.prev ? '+' : '') + pctDelta(r.wk, r.prev) + '%' : '—'}</span></td>
                <td><${UI.Readiness} athlete=${r.a} size=${26} /></td>
                <td className="hide-sm">${mod ? html`<${UI.Pill} tone="ai">${mod.variant}<//>` : sess ? html`<button className="btn xs" onClick=${(ev) => { ev.stopPropagation(); AMS.runAction('notify', { toRole: 'coach', athleteId: r.id, text: r.a.name + ': ACWR ' + r.s.acwr.toFixed(2) + ' (' + r.wk + ' AU this week vs ' + r.prev + '). Suggest reduced volume for ' + sess.title + '.' }); }}><${I} name="send" size=${11} />Advise coach</button>` : html`<span className="faint small">—</span>`}</td>
              </tr>`; })}</tbody></table>
          </div>
          ${!jumps.length && html`<${UI.Empty} icon="check" title="No athletes above ACWR 1.3" />`}
        <//>
        <${AIRecs} limit=${4} title="AI — load & readiness" />
      </div>
      <div className="grid g2">
        <${ReadinessDist} list=${list} />
        <${UI.Card} title="Wearable sync status" icon="watch" hint=${'last import ' + w.lastImport + ' · ' + w.imported + ' sessions'} actions=${html`<button className="btn sm" disabled=${!canEdit} title=${canEdit ? 'Pull latest device data' : 'Sports science only'} onClick=${() => AMS.runAction('dashboard.wearableResync')}><${I} name="refresh" size=${13} />Sync now</button>`}>
          <${UI.HBars} labelWidth=${130} max=${100} format=${(x) => x + '%'} data=${ws.map((x) => ({ label: x.device, sub: x.synced + '/' + x.n, value: pct(x.synced, x.n), tone: pct(x.synced, x.n) >= 90 ? 'good' : 'warn', onClick: x.stale.length ? () => openList(x.device + ' — not synced in 24 h', x.stale, 'Ask the athlete to open the device app or check the charger.') : undefined }))} />
          ${w.unmatched.length > 0 && html`<div className="col" style=${{ gap: 8, marginTop: 14 }}>
            <span className="upper">Unmatched devices · AI suggested owner</span>
            ${w.unmatched.map((d) => { const a = AMS.org.athlete(d.suggest); return html`<div key=${d.id} className="ai-box col tight" style=${{ gap: 6 }}>
              <span className="row between wrap" style=${{ gap: 6 }}><b className="small">${d.device} · ${d.serial}</b><span className="tiny faint">${d.session}</span></span>
              <span className="small">Suggested: <b>${a ? a.name : '—'}</b> <span className="faint">(${Math.round(d.confidence * 100)}% confidence)</span></span>
              <span className="tiny muted">${d.why}</span>
              <span className="row tight"><button className="btn ai xs" disabled=${!canEdit || !a} onClick=${() => AMS.runAction('dashboard.matchDevice', { deviceId: d.id, athleteId: d.suggest })}><${I} name="link" size=${11} />Confirm match</button>${a && html`<button className="btn ghost xs" onClick=${() => AMS.openAthlete(a.id)}>View athlete</button>`}</span>
            </div>`; })}
          </div>`}
        <//>
      </div>
      <${CompareTable} list=${list} P=${P} />
      <div className="grid g-main">
        <${Participation} list=${list} P=${P} />
        <${LiveFeed} limit=${10} />
      </div>
    <//>`;
  }

  /* ================================================================== NUTRITIONIST */
  function NutritionView({ list, P }) {
    const ww = weightWatch(list);
    const ff = fuellingFlags(list);
    const st = groupStats(list, P.byAth);
    const cut = ww.filter((r) => r.flag.tone === 'bad' || r.flag.tone === 'warn');
    const lowSleep = list.filter((a) => { const w = C.todayWellness(a); return w && w.sleepHrs < 6.5; });
    return html`<${React.Fragment}>
      <div className="grid g6 keep">
        <${UI.KPI} label="Check-in compliance" icon="check" value=${st.checkin} unit="%" foot=${st.checked + ' of ' + st.n + ' · live'} onClick=${() => openList('No check-in yet', list.filter((a) => !S(a).rd.checkedIn).map((a) => a.id), 'Energy and sleep data missing for these athletes today.')} />
        <${UI.KPI} label="Low energy (3d)" icon="bolt" value=${ff.length} tone=${ff.length ? 'warn' : ''} foot="avg energy ≤ 2.4 / 5" onClick=${() => openList('Low energy — fuelling review', ff.map((r) => r.id), 'Energy low for 3 days; check intake against this week\'s load (low energy availability).')} />
        <${UI.KPI} label="Weight-class athletes" icon="scale" value=${ww.length} foot="boxing, wrestling, lifting" onClick=${() => openList('Weight-class athletes', ww.map((r) => r.id), 'Athletes competing in a weight category.')} />
        <${UI.KPI} label="Weight-cut watch" icon="alert" value=${cut.length} tone=${cut.filter((r) => r.flag.tone === 'bad').length ? 'bad' : ''} foot=${cut.filter((r) => r.flag.tone === 'bad').length + ' rapid-cut risk'} onClick=${() => openList('Weight-cut watch', cut.map((r) => r.id), 'Above category limit. Rapid-cut risk = more than 5% to lose within 60 days of competition.')} />
        <${UI.KPI} label="Short sleep" icon="moon" value=${lowSleep.length} foot="under 6.5 h last night" onClick=${() => openList('Short sleep last night', lowSleep.map((a) => a.id), 'Under 6.5 hours. Recovery nutrition and evening routine review.')} />
        <${UI.KPI} label="Readiness avg" icon="pulse" value=${st.readiness} unit="/100" foot=${st.bands.bad + ' red today'} onClick=${() => openList('Red readiness', list.filter((a) => S(a).band === 'bad').map((a) => a.id), 'Context for fuelling and recovery plans.')} />
      </div>
      <div className="grid g-main">
        <${UI.Card} title="Weight-class watch" icon="scale" hint="current weight vs category · next competition" actions=${html`<button className="btn ghost sm" onClick=${() => AMS.go('nutrition')}>Nutrition<${I} name="arrow-r" size=${13} /></button>`} flush>
          <${UI.Table} compact=${true} maxHeight=${380} rows=${ww} onRow=${(r) => AMS.openAthlete(r.id)} empty="No weight-class athletes in this scope" columns=${[
            { key: 'a', label: 'Athlete', render: (r) => html`<${UI.AthleteCell} athlete=${r.a} size=${26} />`, sort: (r) => r.a.name },
            { key: 'cls', label: 'Category', render: (r) => r.cls + ' kg', sort: (r) => r.cls },
            { key: 'w', label: 'Weight', num: true, render: (r) => r.a.weightKg + ' kg', sort: (r) => r.a.weightKg },
            { key: 'over', label: 'Above limit', num: true, render: (r) => html`<span className=${r.over > 5 ? 'bad' : r.over > 2 ? 'warn' : 'good'} style=${{ fontWeight: 600 }}>${r.over > 0 ? '+' + r.over + '%' : r.over + '%'}</span>`, sort: (r) => r.over },
            { key: 'comp', label: 'Next event', hideSm: true, render: (r) => (r.comp ? html`<span className="small">${r.comp.name.replace(/Championships/, 'Champs')} <span className="faint">· ${r.days}d</span></span>` : html`<span className="faint">—</span>`), sort: (r) => (r.days == null ? 999 : r.days) },
            { key: 'flag', label: 'Flag', render: (r) => html`<${UI.Pill} tone=${r.flag.tone}>${r.flag.label}<//>`, sort: (r) => ({ bad: 0, warn: 1, info: 2, good: 3 }[r.flag.tone]) },
          ]} />
        <//>
        <${AIRecs} limit=${4} title="AI — fuelling & recovery" />
      </div>
      <div className="grid g2">
        <${UI.Card} title="Fuelling flags" icon="bolt" hint="low energy vs training load" flush>
          <div className="list">
            ${ff.slice(0, 8).map((r) => html`<div key=${r.id} className="list-item clickable" onClick=${() => AMS.openAthlete(r.id)}>
              <${UI.Avatar} name=${r.a.name} size=${28} />
              <span className="col tight grow" style=${{ gap: 0, minWidth: 0 }}><b className="ellipsis">${r.a.name}</b><span className="tiny faint">${AMS.org.squad(r.a.squadId).name}</span></span>
              <${UI.Evidence} items=${[{ label: 'Energy 3d', value: r.e3.toFixed(1) + '/5', tone: 'warn' }, { label: 'Load', value: r.load + ' AU', tone: r.change > 15 ? 'bad' : 'info' }]} />
            </div>`)}
            ${!ff.length && html`<${UI.Empty} icon="bolt" title="No low-energy flags" />`}
          </div>
        <//>
        <${ReadinessDist} list=${list} />
      </div>
      <${CompareTable} list=${list} P=${P} />
      <div className="grid g-main">
        <${Participation} list=${list} P=${P} />
        <${LiveFeed} limit=${8} />
      </div>
    <//>`;
  }

  /* ================================================================== OPERATIONS */
  function OpsView({ list, P }) {
    const { db } = AMS.useStore();
    const e = eff();
    const apps = db.applications.filter((p) => appInScope(p, e));
    const queue = apps.filter((p) => ['Applied', 'Verifying', 'Docs returned'].includes(p.stage)).map((p) => ({ ...p, age: D.diff(AMS.TODAY, p.submitted) })).sort((a, b) => b.age - a.age);
    const late = queue.filter((p) => p.age > 5);
    const noCoach = apps.filter((p) => p.stage === 'Approved' && !p.coachId);
    const allAth = AMS.scopedAthletes({ all: true });
    const docs = [];
    allAth.forEach((a) => (a.docs || []).forEach((d) => { if (d.expires && (d.status === 'Expiring' || D.diff(d.expires, AMS.TODAY) <= 30)) docs.push({ id: d.id, a, d, days: D.diff(d.expires, AMS.TODAY) }); }));
    docs.sort((x, y) => x.days - y.days);
    const profAvg = Math.round(AMS.mean(allAth.map((a) => a.profileCompletion || 0)));
    const complete = allAth.filter((a) => (a.profileCompletion || 0) >= 100 && a.verification && a.verification.status === 'Verified').length;
    const lowest = allAth.filter((a) => (a.profileCompletion || 0) < 100).sort((x, y) => x.profileCompletion - y.profileCompletion).slice(0, 6);
    const byC = AMS.groupBy(list, (a) => placeOf(a, e).centreId);
    const centreRows = Object.entries(byC).map(([cid, m]) => { const st = groupStats(m, P.byAth); return { cid, c: AMS.org.centre(cid), st, prof: Math.round(AMS.mean(m.map((a) => a.profileCompletion || 0))) }; }).filter((r) => r.c).sort((a, b) => a.st.checkin - b.st.checkin);
    const st = groupStats(list, P.byAth);
    const goQueue = () => AMS.go('athletes', { tab: 'onboarding' });
    return html`<${React.Fragment}>
      <div className="grid g6 keep">
        <${UI.KPI} label="Verification queue" icon="clipboard" value=${queue.length} foot=${queue.filter((p) => p.docs.some((d) => d.ai && !d.ai.ok)).length + ' with AI-flagged docs'} onClick=${goQueue} />
        <${UI.KPI} label="Past 5-day SLA" icon="clock" value=${late.length} tone=${late.length ? 'warn' : ''} foot=${late[0] ? 'oldest ' + late[0].age + ' days' : 'all within SLA'} onClick=${goQueue} />
        <${UI.KPI} label="Approved, no coach" icon="whistle" value=${noCoach.length} tone=${noCoach.length ? 'warn' : ''} foot="hand-off to coach pending" onClick=${goQueue} />
        <${UI.KPI} label="Docs expiring ≤ 30d" icon="file" value=${docs.length} tone=${docs.filter((x) => x.days <= 7).length ? 'bad' : ''} foot=${docs.filter((x) => x.d.renewalRequested).length + ' renewals requested'} onClick=${() => openList('Documents expiring within 30 days', [...new Set(docs.map((x) => x.a.id))], 'Medical fitness certificates and other dated documents.')} />
        <${UI.KPI} label="Profile completeness" icon="user" value=${profAvg} unit="%" foot=${pct(complete, allAth.length) + '% complete & verified'} onClick=${() => openList('Incomplete profiles', allAth.filter((a) => a.profileCompletion < 100).map((a) => a.id), 'Missing fields block reports and selection paperwork.')} />
        <${UI.KPI} label="Check-in data" icon="check" value=${st.checkin} unit="%" foot="submission rate only · live" onClick=${() => openList('No check-in submitted', list.filter((a) => !C.todayWellness(a)).map((a) => a.id), 'Data completeness: submission only. Readiness values are not visible to Operations.')} />
      </div>
      <div className="grid g-main">
        <${UI.Card} title="Verification queue & SLA" icon="clipboard" hint="5-day target" actions=${html`<button className="btn sm primary" onClick=${goQueue}>Open queue<${I} name="arrow-r" size=${13} /></button>`} flush>
          <${UI.Table} compact=${true} rows=${queue} onRow=${goQueue} empty="Queue is clear" columns=${[
            { key: 'name', label: 'Applicant', render: (p) => html`<span className="col tight" style=${{ gap: 0 }}><b>${p.name}</b><span className="tiny faint">${p.sport} · ${p.events} · ${AMS.org.centre(p.centreId).short}</span></span>`, sort: (p) => p.name },
            { key: 'stage', label: 'Stage', render: (p) => html`<${UI.Pill} tone=${p.stage === 'Docs returned' ? 'warn' : 'info'}>${p.stage}<//>`, sort: (p) => p.stage },
            { key: 'docs', label: 'AI doc check', hideSm: true, render: (p) => { const bad = p.docs.filter((d) => d.ai && !d.ai.ok), miss = p.docs.filter((d) => d.status === 'Missing'); return bad.length ? html`<span className="bad small" title=${bad.map((d) => d.type + ': ' + d.ai.note).join('\n')}><${I} name="alert" size=${12} /> ${bad.length} flagged</span>` : miss.length ? html`<span className="warn small">${miss.length} missing</span>` : html`<span className="good small"><${I} name="check" size=${12} /> clean</span>`; }, sort: false },
            { key: 'dup', label: 'Duplicate', hideSm: true, render: (p) => (p.duplicateOf ? html`<${UI.Pill} tone="bad">${Math.round(p.duplicateOf.score * 100)}% match<//>` : html`<span className="faint">—</span>`), sort: (p) => (p.duplicateOf ? 1 : 0) },
            { key: 'age', label: 'Age vs SLA', render: (p) => html`<span className="row tight" style=${{ gap: 8, minWidth: 110 }}><${UI.Meter} value=${Math.min(p.age, 10)} max=${10} tone=${p.age > 5 ? 'bad' : p.age >= 4 ? 'warn' : 'good'} style=${{ width: 60 }} /><span className=${AMS.cx('small tnum', p.age > 5 && 'bad')}>${p.age}d</span></span>`, sort: (p) => p.age },
          ]} />
        <//>
        <${AIRecs} limit=${4} title="AI — operations" />
      </div>
      <div className="grid g2">
        <div className="col" style=${{ gap: 16 }}>
          <${UI.Card} title="Approved without a coach" icon="whistle" hint="onboarding → coach hand-off" flush>
            <div className="list">${noCoach.map((p) => html`<div key=${p.id} className="list-item"><${UI.Avatar} name=${p.name} size=${28} /><span className="col tight grow" style=${{ gap: 0 }}><b>${p.name}</b><span className="tiny faint">${p.sport} · ${AMS.org.squad(p.squadId) ? AMS.org.squad(p.squadId).name : ''} · ${AMS.org.centre(p.centreId).short} · approved ${D.rel((p.history[p.history.length - 1] || {}).date || p.submitted)}</span></span><button className="btn xs primary" onClick=${goQueue}>Assign coach</button></div>`)}
              ${!noCoach.length && html`<${UI.Empty} icon="check" title="Every approved athlete has a coach" />`}</div>
          <//>
          <${TasksCard} list=${list} />
        </div>
        <${UI.Card} title="Expiring documents" icon="file" hint="next 30 days" flush>
          <${UI.Table} compact=${true} maxHeight=${420} rows=${docs} empty="No documents expiring" columns=${[
            { key: 'a', label: 'Athlete', render: (r) => html`<${UI.AthleteCell} athlete=${r.a} size=${26} />`, sort: (r) => r.a.name },
            { key: 'type', label: 'Document', render: (r) => html`<span className="small">${r.d.type}</span>`, sort: (r) => r.d.type },
            { key: 'exp', label: 'Expires', render: (r) => html`<span className=${AMS.cx('small', r.days <= 7 ? 'bad' : r.days <= 14 ? 'warn' : '')}>${D.fmt(r.d.expires)} · ${r.days < 0 ? 'expired' : r.days + 'd'}</span>`, sort: (r) => r.days },
            { key: 'act', label: '', sort: false, render: (r) => (r.d.renewalRequested ? html`<${UI.Pill} tone="good">Requested ${D.fmt(r.d.renewalRequested)}<//>` : html`<button className="btn xs" disabled=${!AMS.canEdit('documents')} onClick=${(ev) => { ev.stopPropagation(); AMS.runAction('dashboard.requestDocRenewal', { athleteId: r.a.id, docId: r.d.id }); }}><${I} name="send" size=${11} />Request renewal</button>`) },
          ]} />
        <//>
      </div>
      <div className="grid g2">
        <${UI.Card} title="Profile completeness" icon="user" hint=${profAvg + '% average · ' + complete + ' complete & verified'}>
          <${UI.HBars} labelWidth=${140} max=${100} format=${(x) => x + '%'} data=${centreRows.slice().sort((a, b) => a.prof - b.prof).map((r) => ({ label: r.c.short, value: r.prof, tone: r.prof >= 92 ? 'good' : r.prof >= 85 ? 'warn' : 'bad', onClick: () => drillTo({ kind: 'centre', id: r.cid }) }))} />
          <div className="col" style=${{ gap: 0, marginTop: 12 }}>
            <span className="upper" style=${{ marginBottom: 4 }}>Lowest profiles</span>
            ${lowest.map((a) => html`<div key=${a.id} className="row between" style=${{ padding: '6px 0', borderBottom: '1px solid var(--border)', gap: 8 }}>
              <${UI.AthleteCell} athlete=${a} size=${24} sub=${(a.missingFields || []).join(', ') || 'Fields missing'} />
              <span className="row tight"><span className="small tnum" style=${{ fontWeight: 600 }}>${a.profileCompletion}%</span><button className="btn ghost xs" onClick=${() => AMS.runAction('notify', { toRole: 'athlete', athleteId: a.id, title: 'Complete your profile', text: 'Please add: ' + (a.missingFields || []).join(', ') + '.' })}><${I} name="bell" size=${11} />Nudge</button></span>
            </div>`)}
          </div>
        <//>
        <${UI.Card} title="Data completeness by centre" icon="grid" hint="morning check-in & RPE submission" actions=${html`<${VisibleNote} icon="lock" text="Submission only — values hidden" />`}>
          <${UI.HeatGrid} cols=${['Athletes', 'Check-in', 'RPE 14d', 'Attend.']} cellW=${66} labelW=${150} rows=${centreRows.map((r) => ({ label: r.c.short, onClick: () => drillTo({ kind: 'centre', id: r.cid }), cells: [{ label: r.st.n }, { label: r.st.checkin + '%', tone: r.st.checkin >= 80 ? 'good' : r.st.checkin >= 65 ? 'warn' : 'bad' }, { label: r.st.rpe + '%', tone: r.st.rpe >= 90 ? 'good' : r.st.rpe >= 80 ? 'warn' : 'bad' }, { label: r.st.attendance + '%', tone: r.st.attendance >= 90 ? 'good' : r.st.attendance >= 80 ? 'warn' : 'bad' }] }))} />
          <div className="row between wrap" style=${{ marginTop: 10, gap: 8 }}>
            <span className="tiny faint">Low submission = poor data for coaches and the AI. Reminders bring ~60% in within 10 min.</span>
            <button className="btn sm" onClick=${() => AMS.runAction('checkin.remind', { athleteIds: list.filter((a) => !C.todayWellness(a) && a.availability !== 'Unavailable').map((a) => a.id) })}><${I} name="bell" size=${13} />Remind all missing</button>
          </div>
        <//>
      </div>
      <${CompareTable} list=${list} P=${P} />
      <${LiveFeed} limit=${10} title="Live operations feed" />
    <//>`;
  }

  /* ================================================================== PAGE */
  const ROLE_SUB = {
    director: 'Executive overview — readiness, availability, injuries and decisions across the ladder',
    coach: 'Your squads before today\'s session — readiness, check-ins and one-tap adjustments',
    physio: 'Medical-first view — injury inbox, rehab caseload and risk',
    doctor: 'Medical-first view — clearances, assessments and risk',
    scientist: 'Readiness and load — ACWR, compliance and wearable data',
    nutritionist: 'Fuelling and body-composition context alongside readiness',
    ops: 'Operations — verification, documents and data completeness',
  };
  function Page({ params }) {
    const { db, ui, v } = AMS.useStore();
    const list = AMS.scopedAthletes();
    const e = eff();
    const key = v + '|' + JSON.stringify(e) + '|' + ui.role;
    const P = useMemo(() => participation(list), [key]);
    const me = AMS.me();
    const role = ui.role;
    let body;
    if (role === 'coach') body = html`<${CoachView} list=${list} P=${P} />`;
    else if (role === 'physio' || role === 'doctor') body = html`<${MedicalView} list=${list} P=${P} params=${params} />`;
    else if (role === 'scientist') body = html`<${ScienceView} list=${list} P=${P} />`;
    else if (role === 'nutritionist') body = html`<${NutritionView} list=${list} P=${P} />`;
    else if (role === 'ops') body = html`<${OpsView} list=${list} P=${P} />`;
    else body = html`<${DirectorView} list=${list} P=${P} />`;
    return html`<div className="page">
      <${UI.PageHead} title="Command Center" sub=${(me ? me.name + ' · ' : '') + AMS.roleLabel(role) + ' — ' + ROLE_SUB[role] + ' · ' + D.fmtLong(AMS.TODAY)}
        actions=${html`<${VisibleNote} icon=${role === 'ops' ? 'lock' : isMedRole() ? 'eye' : 'shield'} text=${medNote()} />
          ${role !== 'ops' && html`<${UI.AskCopilot} prompt=${role === 'coach' ? 'move red athletes to recovery' : role === 'director' ? 'compare centres' : 'who is at risk today?'} label=${role === 'coach' ? 'Ask Copilot' : 'Ask Copilot'} />`}`} />
      <${ScopeBar} list=${list} />
      ${list.length === 0 ? html`<div className="card"><${UI.Empty} icon="users" title="No active athletes in this scope">Drill up or clear a filter in the org ladder.<//></div>` : body}
    </div>`;
  }

  /* ------------------------------------------------------------------ athlete-list drawer (reusable by other modules) */
  function listRows(ids) { return (ids || []).map((id) => AMS.org.athlete(id)).filter(Boolean); }
  function AthleteListDrawer({ title, athleteIds, note, sub }) {
    const { ui } = AMS.useStore();
    const rows = listRows(athleteIds);
    const ready = canSeeReadiness();
    const full = isMedRole();
    const pending = rows.filter((a) => !C.todayWellness(a) && a.enrollment === 'Active' && a.availability !== 'Unavailable');
    const bands = { good: 0, warn: 0, bad: 0, none: 0 }; rows.forEach((a) => { bands[S(a).band]++; });
    const columns = [
      { key: 'name', label: 'Athlete', render: (a) => html`<${UI.AthleteCell} athlete=${a} size=${28} />`, sort: (a) => a.name },
      ready && { key: 'ready', label: 'Readiness', render: (a) => html`<${UI.Readiness} athlete=${a} size=${28} showLabel=${true} />`, sort: (a) => S(a).rd.score },
      ready && { key: 'acwr', label: 'ACWR', num: true, render: (a) => html`<${UI.AcwrPill} value=${S(a).acwr} />`, sort: (a) => S(a).acwr },
      ui.role !== 'ops' && { key: 'avail', label: 'Availability', render: (a) => html`<${UI.AvailabilityPill} value=${a.availability} />`, sort: (a) => a.availability },
      ui.role === 'ops' && { key: 'prof', label: 'Profile', num: true, render: (a) => a.profileCompletion + '%', sort: (a) => a.profileCompletion },
      ui.role === 'ops' && { key: 'chk', label: 'Check-in', render: (a) => (C.todayWellness(a) ? html`<span className="good small">Submitted</span>` : html`<span className="faint small">Pending</span>`), sort: (a) => (C.todayWellness(a) ? 1 : 0) },
      ui.role !== 'ops' && { key: 'why', label: 'Reason', hideSm: true, render: (a) => { const t = topReason(a); return html`<span className=${AMS.cx('small', t.tone)}>${t.text}</span>`; }, sort: false },
    ].filter(Boolean);
    const copy = () => {
      const head = ['id', 'name', 'squad', 'centre'].concat(ready ? ['readiness', 'band', 'acwr'] : []).concat(ui.role !== 'ops' ? ['availability', 'reason'] : ['profile']);
      const lines = rows.map((a) => [a.id, a.name, (AMS.org.squad(a.squadId) || {}).name, AMS.org.centre(a.centreId).short].concat(ready ? [S(a).rd.score, C.bandLabel(S(a).rd.band), S(a).acwr] : []).concat(ui.role !== 'ops' ? [a.availability, topReason(a).text] : [a.profileCompletion]).map((x) => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"').join(','));
      try { navigator.clipboard.writeText([head.join(',')].concat(lines).join('\n')).then(() => AMS.toast('Copied ' + rows.length + ' rows as CSV', 'info')).catch(() => AMS.toast('Clipboard blocked by the browser', 'bad')); } catch (err) { AMS.toast('Clipboard not available', 'bad'); }
    };
    return html`<${React.Fragment}>
      <${UI.DrawerHead} title=${title || 'Athletes'} sub=${sub || rows.length + ' athletes · ' + AMS.scopeLabel()} />
      <div className="drawer-b">
        ${note && html`<div className="ai-box small"><${I} name="info" size=${13} style=${{ color: 'var(--ai)', verticalAlign: -2, marginRight: 6 }} />${note}</div>`}
        ${ready && rows.length > 0 && html`<div className="row wrap" style=${{ gap: 12 }}><${BandBar} bands=${bands} n=${rows.length} style=${{ width: 180 }} />${BANDS.map((b) => html`<span key=${b.id} className="tiny faint">${b.label} <b className="tnum" style=${{ color: 'var(--fg)' }}>${bands[b.id]}</b></span>`)}</div>`}
        ${!ready && html`<${VisibleNote} icon="lock" text="Readiness and medical columns are not visible to your role" />`}
        ${ready && !full && html`<${VisibleNote} icon="lock" text="Medical reasons shown as summary only — diagnoses hidden" />`}
        <${UI.Table} columns=${columns} rows=${rows} onRow=${(a) => AMS.openAthlete(a.id)} compact=${true} initialSort=${ready ? { key: 'ready', dir: 'asc' } : null} empty="No athletes match" />
      </div>
      <div className="drawer-f">
        ${pending.length > 0 && ui.role !== 'athlete' && html`<button className="btn" onClick=${() => AMS.runAction('checkin.remind', { athleteIds: pending.map((a) => a.id) })}><${I} name="bell" size=${14} />Remind ${pending.length} to check in</button>`}
        <button className="btn" onClick=${copy} disabled=${!rows.length}><${I} name="copy" size=${14} />Copy CSV</button>
        ${ui.role !== 'ops' && html`<${UI.AskCopilot} prompt=${'who is at risk today?'} label="Ask Copilot" />`}
        <button className="btn primary" onClick=${AMS.closeDrawer}>Done</button>
      </div>
    <//>`;
  }
  AMS.registerDrawer('athlete-list', AthleteListDrawer, {
    wide: true,
    sample: () => {
      const ids = [AMS.db.meta.heroAthleteId].concat(AMS.db.injuries.filter((i) => i.status !== 'Closed').slice(0, 3).map((i) => i.athleteId));
      return [{ title: 'Red readiness today', athleteIds: ids, note: 'Sample list for smoke test.' }, { title: 'Empty', athleteIds: [] }];
    },
  });

  /* ------------------------------------------------------------------ public helpers (for other modules, copilot, tests) */
  AMS.dash = { snapshot: S, groupStats, participation, compareRows, compareLevel, crumbs, drillUp, directorKpis, morningBrief, compProjection, upcomingComps, incidence, injuryTrend, weightWatch, listRows, topReason, openList,
    kpis: () => { const list = AMS.scopedAthletes(); const P = participation(list); return directorKpis(list, P, eff()); } };

  /* ------------------------------------------------------------------ registration */
  AMS.registerModule({
    id: 'dashboard', label: 'Command Center', icon: 'dashboard', group: 'command', order: 1, roles: ['director', 'coach', 'physio', 'doctor', 'scientist', 'nutritionist', 'ops'], component: Page, short: 'Home',
    badge: () => {
      if (!AMS.db || !['director', 'coach'].includes(AMS.ui.role)) return null;
      const n = AMS.scopedAthletes().filter((a) => S(a).band === 'bad').length;
      return n ? { n, tone: 'bad' } : null;
    },
    sampleParams: [{}, { tab: 'clearance' }],
  });
  AMS.registerCommand({ id: 'dashboard.red', label: 'Show red-readiness athletes', group: 'Command Center', icon: 'pulse', keywords: 'readiness red risk today', roles: ['director', 'coach', 'physio', 'doctor', 'scientist', 'nutritionist'], run: () => openList('Red readiness — ' + AMS.scopeLabel(), AMS.scopedAthletes().filter((a) => S(a).band === 'bad').map((a) => a.id), 'Readiness below 50 today.') });
  AMS.registerCommand({ id: 'dashboard.missing', label: 'Who has not checked in?', group: 'Command Center', icon: 'check', keywords: 'check-in wellness missing remind', run: () => openList('No check-in yet', AMS.scopedAthletes().filter((a) => !C.todayWellness(a)).map((a) => a.id), 'Athletes without this morning\'s check-in.') });
  AMS.registerCommand({ id: 'dashboard.up', label: 'Drill up one level', group: 'Command Center', icon: 'arrow-up', keywords: 'scope ladder federation up', run: () => { AMS.runAction('dashboard.drillUp'); AMS.go('dashboard'); } });
  AMS.registerCommand({ id: 'dashboard.recoverRed', label: 'Move all red athletes to recovery', group: 'Command Center', icon: 'zap', keywords: 'recovery red session adjust', roles: ['coach'], run: () => AMS.runAction('dashboard.recoverAllRed', {}) });

  /* ------------------------------------------------------------------ self-tests (workflow assertions on fresh data) */
  const assert = (c, m) => { if (!c) throw new Error(m); };
  AMS.selfTests.push({
    name: 'dashboard: drilling federation → Pune HPC changes KPI totals and compare level', role: 'director', fn: () => {
      const fed = AMS.dash.kpis();
      assert(compareLevel(eff()) === 'state', 'federation should compare states, got ' + compareLevel(eff()));
      AMS.runAction('dashboard.drill', { centreId: 'PUN' });
      const pun = AMS.dash.kpis();
      const expected = AMS.db.athletes.filter((a) => a.enrollment === 'Active' && (a.centreId === 'PUN' || (a.tempAssignment && a.tempAssignment.active && a.tempAssignment.centreId === 'PUN'))).length;
      assert(pun.active === expected, 'Pune active should be ' + expected + ', got ' + pun.active);
      assert(pun.active < fed.active, 'drill-down did not reduce the athlete total');
      assert(compareLevel(eff()) === 'squad', 'centre scope should compare squads');
      AMS.runAction('dashboard.drill', { squadId: 'SQ-PUN-SPR17' });
      assert(compareLevel(eff()) === 'athlete', 'squad scope should list athletes');
      AMS.runAction('dashboard.drillUp');
      assert(!AMS.ui.scope.squadId && AMS.ui.scope.centreId === 'PUN', 'drill up should return to the centre');
    },
  });
  AMS.selfTests.push({
    name: 'dashboard: coach acting on Priya\'s load-spike insight records the session change and closes the insight', role: 'coach', fn: () => {
      const id = 'spike:ATH-10421:' + AMS.TODAY;
      assert(AMS.ai.insights().some((i) => i.id === id), 'Priya spike insight missing for coach');
      const before = AMS.db.aiState.acted;
      AMS.runAction('dashboard.recoverOne', { athleteId: 'ATH-10421' });
      const sess = AMS.todaySessionFor(AMS.org.athlete('ATH-10421'));
      assert(sess && sess.mods && sess.mods['ATH-10421'] && sess.mods['ATH-10421'].variant === 'recovery', 'session not modified to recovery');
      assert(AMS.db.aiState.done[id], 'insight not marked done');
      assert(AMS.db.aiState.acted === before + 1, 'acted-on counter not incremented');
      assert(!AMS.ai.insights().some((i) => i.id === id), 'insight still listed after acting');
      assert(/Priya/.test(AMS.db.activity[0].text), 'activity feed not updated');
    },
  });
  AMS.selfTests.push({
    name: 'dashboard: athlete-list drawer opens with exactly the requested athletes', role: 'director', fn: () => {
      const ids = ['ATH-10421'].concat(AMS.db.athletes.filter((a) => a.squadId === 'SQ-PUN-SPR20').slice(0, 3).map((a) => a.id));
      AMS.runAction('dashboard.athleteList', { title: 'Test list', athleteIds: ids, note: 'n' });
      const d = AMS.ui.drawers[AMS.ui.drawers.length - 1];
      assert(d && d.type === 'athlete-list', 'drawer not opened');
      assert(JSON.stringify(d.props.athleteIds) === JSON.stringify(ids), 'drawer ids differ');
      assert(listRows(d.props.athleteIds).map((a) => a.id).join() === ids.join(), 'rows do not match ids');
      assert(AMS.drawers['athlete-list'], 'athlete-list drawer not registered');
    },
  });
  AMS.selfTests.push({
    name: 'dashboard: "move all red to recovery" adjusts every red athlete with a session and notifies the physio', role: 'coach', fn: () => {
      const reds = AMS.scopedAthletes().filter((a) => S(a).band === 'bad' && a.availability !== 'Unavailable' && AMS.todaySessionFor(a));
      assert(reds.length >= 1, 'expected at least one red athlete for the coach');
      const nBefore = AMS.db.notifications.filter((n) => n.toRole === 'physio').length;
      AMS.runAction('dashboard.recoverAllRed', {});
      reds.forEach((a) => { const s = AMS.todaySessionFor(a); assert(s.mods && s.mods[a.id], a.name + ' not adjusted'); });
      assert(AMS.db.notifications.filter((n) => n.toRole === 'physio').length === nBefore + 1, 'physio not notified');
      AMS.runAction('dashboard.undoSessionMod', { athleteId: reds[0].id });
      assert(!(AMS.todaySessionFor(reds[0]).mods || {})[reds[0].id], 'undo did not remove the modification');
    },
  });
  AMS.selfTests.push({
    name: 'dashboard: sharing the AI morning brief stores it and notifies coach, physio and science', role: 'director', fn: () => {
      const list = AMS.scopedAthletes(); const P = participation(list);
      const b = morningBrief(list, P, eff());
      assert(b.headline && b.risks.length >= 1 && b.changes.length >= 3, 'brief incomplete');
      assert(b.risks[0].name === 'Priya Deshmukh', 'expected Priya as top risk, got ' + (b.risks[0] && b.risks[0].name));
      const n0 = AMS.db.notifications.length;
      AMS.runAction('dashboard.shareBrief', { summary: b.summary, decisions: b.decisions.length });
      assert(AMS.db.dashboard.briefs.length === 1, 'brief not stored');
      assert(AMS.db.notifications.length === n0 + 3, 'expected 3 notifications');
      assert(AMS.db.activity[0].type === 'brief', 'activity not logged');
    },
  });
  AMS.selfTests.push({
    name: 'dashboard: physio triage moves Yash\'s report to Assessment, closes the task and tells the coach (summary only)', role: 'physio', fn: () => {
      const inj = AMS.db.injuries.find((i) => i.status === 'Reported' && AMS.org.athlete(i.athleteId).name === 'Yash More');
      assert(inj, 'Yash report missing');
      AMS.runAction('dashboard.triageInjury', { injuryId: inj.id });
      assert(AMS.byId(AMS.db.injuries, inj.id).status === 'Assessment', 'status not changed');
      assert(AMS.db.tasks.find((t) => t.id === 'TSK-3').status === 'Done', 'assessment task not closed');
      const n = AMS.db.notifications.find((x) => x.toRole === 'coach' && x.athleteId === inj.athleteId && /physio assessing/.test(x.text));
      assert(n && !/adductor|strain/i.test(n.text), 'coach notification missing or leaks diagnosis');
    },
  });
  AMS.selfTests.push({
    name: 'dashboard: competition projection and detectors produce well-formed, actionable insights', role: 'director', fn: () => {
      const list = AMS.scopedAthletes();
      const meet = AMS.db.competitions.find((c) => c.id === 'CMP-4');
      const p = compProjection(meet, list);
      assert(p.eligible > 20 && p.share > 0 && p.share <= 100, 'bad projection ' + p.eligible + '/' + p.share);
      const mine = AMS.ai.insights().filter((i) => /^(compavail|outlier):/.test(i.id));
      mine.forEach((i) => { assert(i.evidence.length >= 2, 'insight without evidence'); i.actions.forEach((a) => assert(AMS.actions[a.action], 'unregistered action ' + a.action)); });
      if (p.share < 85 || (p.bySquad || []).some((q) => q.n >= 4 && q.share < 85)) assert(mine.some((i) => i.id.startsWith('compavail:CMP-4')), 'State Open Meet availability warning expected');
    },
  });
  AMS.selfTests.push({
    name: 'dashboard: ops can request a document renewal and complete a task', role: 'ops', fn: () => {
      const a = AMS.db.athletes.find((x) => x.enrollment === 'Active' && x.docs.some((d) => d.expires && D.diff(d.expires, AMS.TODAY) <= 30));
      assert(a, 'no expiring document in seed');
      const d = a.docs.find((x) => x.expires && D.diff(x.expires, AMS.TODAY) <= 30);
      const t0 = AMS.db.tasks.length;
      AMS.runAction('dashboard.requestDocRenewal', { athleteId: a.id, docId: d.id });
      assert(d.renewalRequested === AMS.TODAY, 'renewal not recorded');
      assert(AMS.db.tasks.length === t0 + 1 && AMS.db.notifications[0].toRole === 'athlete', 'follow-up task/notification missing');
      AMS.runAction('dashboard.taskDone', { taskId: 'TSK-1' });
      assert(AMS.db.tasks.find((t) => t.id === 'TSK-1').status === 'Done', 'task not completed');
    },
  });
})();
