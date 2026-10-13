/* USI · AMS — Training & Periodisation.
   "The heartbeat of the product": season plan (macro → meso → micro), session builder with live projected ACWR,
   exercise library, the daily coach loop (readiness pre-check → start → attendance → RPE → load), workload/ACWR and
   attendance analytics. Every state change goes through registered actions so the UI, the AI insights and the copilot
   share one code path. */
(function () {
  'use strict';
  const AMS = window.AMS, UI = window.UI, React = window.React, html = AMS.html;
  const { useState, useMemo, useEffect } = React;
  const D = AMS.date;

  /* ================================================================== constants */
  const WEEK_START = '2026-10-12';           // Mon of ISO week 42 (today is Tue 13 Oct)
  const SEASON_START = '2026-09-07';         // Mon of ISO week 37
  const SEASON_WEEKS = 29;                   // → Sun 28 Mar 2027
  const VARIANTS = {
    none: { label: 'Full session', short: 'Full', scale: 1, tone: '' },
    reduced: { label: 'Reduced volume (−40%)', short: 'Reduced', scale: 0.6, tone: 'warn' },
    recovery: { label: 'Recovery session', short: 'Recovery', scale: 0.35, tone: 'info' },
    rehab: { label: 'Rehab programme', short: 'Rehab', scale: 0.4, tone: 'accent' },
    excluded: { label: 'Excluded (rest)', short: 'Excluded', scale: 0, tone: 'bad' },
  };
  const VARIANT_ORDER = ['none', 'reduced', 'recovery', 'rehab', 'excluded'];
  const TYPES = ['Speed', 'Strength', 'Power', 'Endurance', 'Technical', 'Tactical', 'Sparring', 'Recovery'];
  const TYPE_TONE = { Speed: 'cat-1', Strength: 'cat-3', Endurance: 'cat-2', Power: 'cat-4', Technical: 'cat-5', Tactical: 'cat-6', Sparring: 'bad', Recovery: 'good' };
  const typeColor = (t) => 'var(--' + (TYPE_TONE[t] || 'cat-5') + ')';
  const INTENSITY_RPE = { High: 7, Moderate: 6, Low: 3 };
  const INT_TONE = { High: 'bad', Moderate: 'warn', Low: 'good' };
  const BORG = ['Rest', 'Very, very easy', 'Easy', 'Moderate', 'Somewhat hard', 'Hard', 'Hard+', 'Very hard', 'Very hard+', 'Near maximal', 'Maximal'];
  const ATT = {
    present: { label: 'Present', short: 'P', tone: 'good' },
    late: { label: 'Late', short: 'L', tone: 'warn' },
    absent: { label: 'Absent', short: 'A', tone: 'bad' },
    excused: { label: 'Excused', short: 'E', tone: 'info' },
  };
  const STATUS_TONE = { Planned: 'info', Live: 'good', Completed: 'accent' };
  const GP = 'General preparation', SP = 'Specific preparation', PC = 'Pre-competition', CO = 'Competition', TR = 'Transition';
  const PHASE_TONE = { [GP]: 'cat-2', [SP]: 'cat-1', [PC]: 'cat-3', [CO]: 'cat-6', [TR]: 'cat-5' };
  const PHASE_SHORT = { [GP]: 'GP', [SP]: 'SP', [PC]: 'Pre-comp', [CO]: 'Comp', [TR]: 'Trans' };
  // Season templates: [phase, weeks, focusKey]. A = U-17 (peak: National Youth Games, 24 Jan), B = U-20 double peak (21 Nov, 6 Mar), C = Senior (8 Dec + spring).
  const TEMPLATES = {
    A: [[GP, 4, 'base'], [SP, 4, 'dev'], [SP, 3, 'peak'], [PC, 4, 'end'], [PC, 3, 'race'], [CO, 3, 'taper'], [TR, 3, 'rec'], [GP, 5, 'regen']],
    B: [[GP, 4, 'base'], [SP, 4, 'dev'], [PC, 2, 'race'], [CO, 2, 'taper'], [TR, 2, 'rec'], [GP, 5, 'winter'], [SP, 4, 'peak'], [PC, 2, 'end'], [CO, 2, 'taper2'], [TR, 2, 'rec']],
    C: [[GP, 4, 'base'], [SP, 4, 'dev'], [PC, 3, 'peak'], [CO, 3, 'taper'], [TR, 2, 'rec'], [GP, 4, 'winter'], [SP, 5, 'end'], [PC, 4, 'race']],
  };
  const FOCUS = {
    Sprints: { base: 'General strength & base', dev: 'Speed development', peak: 'Max velocity', end: 'Speed endurance', race: 'Race modelling' },
    Jumps: { base: 'General strength & base', dev: 'Approach speed & take-off', peak: 'Reactive power', end: 'Jump-specific endurance', race: 'Competition rehearsal' },
    'Middle distance': { base: 'Aerobic base', dev: 'Threshold development', peak: 'VO2max intervals', end: 'Speed endurance', race: 'Race modelling' },
    Throws: { base: 'General strength', dev: 'Max strength', peak: 'Power conversion', end: 'Throw-specific volume', race: 'Competition rehearsal' },
    Boxing: { base: 'Aerobic base & strength', dev: 'Technical volume', peak: 'Power & hand speed', end: 'Sparring intensity', race: 'Bout simulation' },
    Hockey: { base: 'Aerobic base', dev: 'Repeated-sprint ability', peak: 'Game speed', end: 'Tactical intensity', race: 'Match simulation' },
    default: { base: 'General preparation', dev: 'Strength development', peak: 'Power conversion', end: 'Sport-specific intensity', race: 'Competition modelling', taper: 'Taper & compete', taper2: 'Taper & trials', rec: 'Active recovery', regen: 'Regeneration & testing', winter: 'Winter strength block' },
  };
  const LOADF = { base: 0.95, dev: 1.0, peak: 1.02, end: 1.06, race: 0.95, taper: 1, taper2: 1, rec: 0.5, regen: 0.85, winter: 1.0 };
  const PATTERN = { 2: [1, 1.04], 3: [1, 1.06, 0.78], 4: [0.96, 1.03, 1.08, 0.76], 5: [0.94, 1, 1.05, 1.1, 0.76] };
  const KPIS = {
    base: ['Squat 1RM +5% vs September test', 'Tempo / aerobic volume completed ≥ 90%', 'Morning check-in compliance ≥ 85%'],
    dev: ['30 m sprint −0.05 s vs 26 Sep field test', 'Nordic hamstring ratio ≥ 0.85', 'Squad ACWR held in 0.8–1.3'],
    peak: ['Flying 20 m within 1% of PB', 'GPS top speed ≥ 95% of season best', 'Zero hamstring flags in block'],
    end: ['Repeat-effort drop-off < 4%', 'Session-RPE compliance ≥ 85%', 'ACWR ≤ 1.3 for 90% of squad'],
    race: ['Race-model splits within 2% of plan', 'Two time trials completed'],
    taper: ['Volume −40–60%, intensity held', 'Readiness green for ≥ 85% on race week'],
    taper2: ['Volume −40–60%, intensity held', 'Selection-trial readiness green ≥ 85%'],
    rec: ['Wellness back to own normal', 'Injury screen for 100% of squad'],
    regen: ['Full field-test battery', 'Season review signed off by director'],
    winter: ['Strength +5–8% vs October', 'Body mass stable (±1 kg)'],
  };
  const LOCATIONS = { Athletics: ['Track 1', 'Track 2', 'Gym A', 'Indoor hall'], Hockey: ['Turf 1', 'Gym A'], Boxing: ['Ring hall', 'Gym A'], Wrestling: ['Mat hall', 'Gym A'], Weightlifting: ['Lifting platform', 'Gym A'] };
  const STORY_NAMES = ['Priya Deshmukh', 'Rohan Gaikwad', 'Aman Shinde', 'Kavya Nair', 'Sneha Patil', 'Yash More', 'Ananya Joshi'];

  /* ================================================================== small helpers */
  const toMin = (t) => { const p = String(t || '0:00').split(':').map(Number); return (p[0] || 0) * 60 + (p[1] || 0); };
  const fromMin = (m) => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const fmtAU = (n) => (n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('en-IN'));
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
  const dayIdx = (iso) => 41 + D.diff(iso, AMS.TODAY);     // loads[] index of a date
  const mondayOf = (iso) => D.add(iso, -((D.dowIndex(iso) + 6) % 7));
  function isoWeek(iso) {
    const d = D.parse(iso); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3);
    const ft = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); ft.setUTCDate(ft.getUTCDate() - ((ft.getUTCDay() + 6) % 7) + 3);
    return 1 + Math.round((d - ft) / (7 * 86400000));
  }
  const weekLabel = (iso) => 'W' + isoWeek(iso);
  const seasonWeekOf = (iso) => Math.floor(D.diff(iso, SEASON_START) / 7);
  const CUR_W = seasonWeekOf(WEEK_START); // 5
  const homeSquadId = (a) => (a.tempAssignment && a.tempAssignment.active ? a.tempAssignment.squadId : a.squadId);
  const squadMembers = (squadId) => AMS.db.athletes.filter((a) => a.enrollment === 'Active' && homeSquadId(a) === squadId);
  const squadLabel = (id) => { const sq = AMS.org.squad(id); if (!sq) return id || '—'; const c = AMS.org.centre(sq.centreId); return sq.name + ' · ' + (c ? c.short : ''); };
  const openInjury = (a) => AMS.db.injuries.find((i) => i.athleteId === a.id && i.status !== 'Closed');
  const firstName = (a) => (a && a.name ? a.name.split(' ')[0] : '');
  const variantOf = (s, aid) => (s && s.mods && s.mods[aid] && s.mods[aid].variant) || 'none';
  const sessRPE = (s) => s.plannedRPE || INTENSITY_RPE[s.intensity] || 5;
  const sessLoad = (s) => Math.round(sessRPE(s) * (s.duration || 0));
  const plannedLoad = (s, aid) => Math.round(sessLoad(s) * VARIANTS[variantOf(s, aid)].scale);
  const endTime = (s) => fromMin(toMin(s.start) + (s.duration || 0));
  /** What a Modified / Unavailable athlete automatically gets (product doc §4.2). */
  function defaultVariant(a) {
    const inj = openInjury(a);
    if (a.availability === 'Unavailable') return inj && ['Rehab', 'Clearance'].includes(inj.status) ? 'rehab' : 'excluded';
    if (a.availability === 'Modified') return inj && inj.status === 'Rehab' ? 'rehab' : 'reduced';
    return null;
  }
  function availabilityNote(a) {
    const inj = openInjury(a);
    if (inj) return AMS.medicalLabel(inj);
    return a.availabilityReason ? a.availability + ': ' + a.availabilityReason : '';
  }
  function scopedSquadIds() {
    const set = new Set(AMS.scopedAthletes().map(homeSquadId));
    const lock = AMS.effectiveScope().lock || {};
    (lock.squadIds || []).forEach((id) => set.add(id));
    return AMS.db.org.squads.map((s) => s.id).filter((id) => set.has(id));
  }
  function defaultSquad(squads) {
    const scope = AMS.ui.scope || {};
    if (scope.squadId && squads.includes(scope.squadId)) return scope.squadId;
    const me = AMS.me();
    if (me && me.squads && me.squads.length && squads.includes(me.squads[0])) return me.squads[0];
    if (squads.includes('SQ-PUN-SPR17')) return 'SQ-PUN-SPR17';
    return squads[0] || null;
  }
  function canEditSquad(squadId) {
    if (!AMS.canEdit('training')) return false;
    const lock = AMS.effectiveScope().lock || {};
    return !lock.squadIds || lock.squadIds.includes(squadId);
  }
  function editReason(squadId) {
    const role = AMS.ui.role;
    if (role === 'coach') return 'This squad belongs to another coach — you can view it but not change it.';
    const sq = AMS.org.squad(squadId); const coach = sq && AMS.org.staff(sq.coachId);
    return AMS.roleLabel(role) + ' view — training plans are owned by the squad coach' + (coach ? ' (' + coach.name + ')' : '') + '. You can see plans, loads, variants and attendance, and flag concerns to the coach.';
  }
  function guard(squadId) {
    if (canEditSquad(squadId)) return true;
    AMS.toast('Only the squad coach can change this session', 'bad');
    return false;
  }
  function attendedIds(s) {
    return Object.keys(s.attendance || {}).filter((id) => ['present', 'late'].includes(s.attendance[id]) && variantOf(s, id) !== 'excluded');
  }
  function rpeStats(s) {
    const att = attendedIds(s);
    const got = att.filter((id) => s.rpe && s.rpe[id] != null);
    return { attended: att.length, submitted: got.length, missing: att.filter((id) => !(s.rpe && s.rpe[id] != null)), share: att.length ? got.length / att.length : 1 };
  }
  function outstandingRpe(squadIds, days) {
    const from = D.add(AMS.TODAY, -(days || 3));
    return AMS.db.sessions.filter((s) => s.status === 'Completed' && squadIds.includes(s.squadId) && s.date >= from && s.date <= AMS.TODAY)
      .map((s) => Object.assign({ s }, rpeStats(s))).filter((x) => x.missing.length > 0)
      .sort((a, b) => b.s.date.localeCompare(a.s.date) || a.s.start.localeCompare(b.s.start));
  }
  /** Last n sessions that have already happened (or are running) for a squad, oldest first. */
  function recentSessions(squadId, n) {
    return AMS.db.sessions.filter((s) => s.squadId === squadId && (s.date < AMS.TODAY || (s.date === AMS.TODAY && s.status !== 'Planned')))
      .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)).slice(-(n || 14));
  }
  function attendanceStats(a, sessions) {
    let total = 0, attended = 0, late = 0, absent = 0;
    sessions.forEach((s) => { const v = (s.attendance || {})[a.id]; if (!v || v === 'excused') return; total++; if (v === 'present' || v === 'late') attended++; if (v === 'late') late++; if (v === 'absent') absent++; });
    return { total, attended, late, absent, pct: total ? Math.round((attended / total) * 100) : null };
  }
  function suggestVariant(a, r) {
    const dv = defaultVariant(a);
    if (dv) return dv;
    if (r.band === 'bad') return 'recovery';
    if (AMS.calc.acwr(a) > 1.3 || r.band === 'warn') return 'reduced';
    return null;
  }

  /* ================================================================== projection maths (pure) */
  let upCache = { db: null, v: -1, map: {} };
  function upcomingBySquad() {
    if (upCache.db === AMS.db && upCache.v === AMS.version) return upCache.map;
    const map = {};
    AMS.db.sessions.forEach((s) => {
      const idx = dayIdx(s.date);
      if (idx < 41 || idx > 48 || s.status === 'Completed') return;
      (map[s.squadId] = map[s.squadId] || []).push({ s, idx });
    });
    upCache = { db: AMS.db, v: AMS.version, map };
    return map;
  }
  /** Athlete's daily loads extended 7 days into the future with planned (not yet completed) sessions. idx 41 = today … 48. */
  function extLoads(a, extra) {
    const ext = (a.loads || []).slice(0, 42);
    while (ext.length < 49) ext.push(0);
    (upcomingBySquad()[homeSquadId(a)] || []).forEach(({ s, idx }) => { ext[idx] += plannedLoad(s, a.id); });
    (extra || []).forEach((e) => { if (e.idx >= 0 && e.idx < 49) ext[e.idx] += e.load; });
    return ext;
  }
  function acwrAt(ext, idx) {
    const acute = AMS.mean(ext.slice(Math.max(0, idx - 6), idx + 1));
    const chronic = AMS.mean(ext.slice(Math.max(0, idx - 27), idx + 1));
    return chronic > 0 ? AMS.round(acute / chronic, 2) : 1;
  }
  function project(a, extra) {
    const ext = extLoads(a, extra);
    const days = [];
    for (let i = 41; i <= 47; i++) days.push({ idx: i, date: D.add(AMS.TODAY, i - 41), acwr: acwrAt(ext, i) });
    const peak = days.slice(1).reduce((m, d) => (d.acwr > m.acwr ? d : m), days[1]);
    return { ext, days, peak, end: days[6].acwr, next7: Math.round(AMS.sum(ext.slice(41, 48))) };
  }
  function weekActual(members, w) {
    const st = 5 + 7 * w;
    if (st > 41 || st < 0) return null;
    const en = Math.min(st + 6, 41);
    return Math.round(AMS.mean(members.map((a) => AMS.sum((a.loads || []).slice(st, en + 1)))));
  }
  function weekPlanned(members, squadId, monday) {
    const days = D.range(monday, 7);
    const ss = AMS.db.sessions.filter((s) => s.squadId === squadId && days.includes(s.date));
    if (!ss.length) return null;
    return Math.round(AMS.mean(members.map((a) => AMS.sum(ss.map((s) => plannedLoad(s, a.id))))));
  }
  function mesoAt(plan, w) { return plan ? plan.mesos.find((m) => w >= m.startWeek && w < m.startWeek + m.weeks) : null; }
  function targetForWeek(plan, w) { const m = mesoAt(plan, w); return m ? m.targets[w - m.startWeek] : null; }
  function phasesOf(plan) {
    const out = [];
    plan.mesos.forEach((m) => { const last = out[out.length - 1]; if (last && last.phase === m.phase) last.weeks += m.weeks; else out.push({ phase: m.phase, startWeek: m.startWeek, weeks: m.weeks }); });
    return out;
  }
  AMS.training = { project, extLoads, acwrAt, defaultVariant, squadMembers, plannedLoad, sessLoad, outstandingRpe, attendanceStats, recentSessions, VARIANTS, isoWeek, scopedSquadIds };

  /* ================================================================== seed: season plans (+ realism tweaks) */
  function templateFor(sq) { return sq.ageGroup === 'U-17' ? 'A' : sq.ageGroup === 'U-20' ? 'B' : 'C'; }
  function focusFor(sq, key) { return (FOCUS[sq.discipline] || FOCUS[sq.sport] || {})[key] || FOCUS.default[key]; }
  function compsFor(db, sq) {
    const end = D.add(SEASON_START, SEASON_WEEKS * 7 - 1);
    return db.competitions.filter((c) => {
      if (!c.sports.includes(sq.sport) || c.date < SEASON_START || c.date > end) return false;
      if (/U-17/.test(c.name)) return sq.ageGroup === 'U-17';
      if (/Junior|U-20/.test(c.name)) return sq.ageGroup === 'U-20';
      if (/Senior/.test(c.name)) return sq.ageGroup === 'Senior';
      return true;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }
  AMS.registerSeed('plans', function (db, rng) {
    const squads = {};
    db.org.squads.forEach((sq) => {
      const members = db.athletes.filter((a) => a.squadId === sq.id && a.enrollment === 'Active');
      const wk = (w) => AMS.mean(members.map((a) => AMS.sum((a.loads || []).slice(5 + 7 * w, 12 + 7 * w))));
      const base = Math.round(AMS.mean([0, 1, 2, 3, 4].map(wk)) / 10) * 10 || 2400;
      const coach = db.staff.find((s) => s.id === sq.coachId);
      let w0 = 0;
      const mesos = TEMPLATES[templateFor(sq)].map(([phase, weeks, key], k) => {
        const taper = key === 'taper' || key === 'taper2';
        const pat = taper ? (weeks === 2 ? [0.8, 0.6] : [0.85, 0.68, 0.52]) : key === 'rec' ? new Array(weeks).fill(0.5) : PATTERN[weeks];
        const m = {
          id: sq.id + '-M' + (k + 1), phase, key, focus: focusFor(sq, key), startWeek: w0, weeks,
          targets: pat.map((p) => Math.round((base * LOADF[key] * p * (0.98 + rng() * 0.04)) / 10) * 10),
          deload: pat.map((p) => p < 0.8 && !taper && key !== 'rec'),
          kpis: (KPIS[key] || []).slice(), notes: '',
        };
        w0 += weeks;
        return m;
      });
      squads[sq.id] = { squadId: sq.id, template: templateFor(sq), base, mesos, comps: compsFor(db, sq).map((c) => c.id), updatedBy: coach ? coach.name : '—', updatedOn: '2026-09-01' };
    });
    db.plans = { seasonStart: SEASON_START, weeks: SEASON_WEEKS, squads };

    // Realism: yesterday's RPE not yet in for part of some squads (their load is unknown until it is), and a few athletes with patchy attendance.
    const named = new Set(db.athletes.filter((a) => STORY_NAMES.includes(a.name)).map((a) => a.id));
    const yday = D.add(AMS.TODAY, -1);
    ['SQ-PUN-SPR17', 'SQ-PUN-SPR20', 'SQ-BLR-SPRSR', 'SQ-SNP-WR20', 'SQ-BPL-HOC20'].forEach((sqid) => {
      const s = db.sessions.find((x) => x.squadId === sqid && x.date === yday);
      if (!s) return;
      const ids = Object.keys(s.rpe || {}).filter((id) => !named.has(id));
      const drop = ids.filter((_, i) => i % 2 === 0).slice(0, Math.ceil(ids.length * 0.45));
      drop.forEach((id) => { delete s.rpe[id]; const a = db.athletes.find((x) => x.id === id); if (a) a.loads[40] = 0; });
    });
    [['SQ-PUN-SPR17', 6, 4], ['SQ-PUN-SPR20', 4, 3], ['SQ-MUM-SPR17', 2, 4], ['SQ-SNP-BOXSR', 3, 3], ['SQ-PUN-JMP20', 5, 3]].forEach(([sqid, idx, n]) => {
      const a = db.athletes.filter((x) => x.squadId === sqid)[idx];
      if (!a || named.has(a.id)) return;
      const past = db.sessions.filter((s) => s.squadId === sqid && s.date < AMS.TODAY).sort((x, y) => x.date.localeCompare(y.date)).slice(-14);
      [1, 4, 8, 11].slice(0, n).forEach((j) => {
        const s = past[j]; if (!s) return;
        s.attendance[a.id] = 'absent'; delete s.rpe[a.id];
        const li = 41 + D.diff(s.date, AMS.TODAY); if (li >= 0 && li <= 41) a.loads[li] = 0;
      });
    });
  });

  /* ================================================================== actions */
  const nowAt = () => AMS.clockTime();
  AMS.registerAction('session.open', function (p) {
    const s = AMS.byId(AMS.db.sessions, p.sessionId);
    if (!s) { AMS.toast('Session not found', 'bad'); return null; }
    AMS.openDrawer('session', { sessionId: s.id });
    return 'Opened ' + s.title;
  });
  AMS.registerAction('training.openRpe', function (p) { AMS.openModal('rpe-collect', { sessionId: p.sessionId }); return 'RPE collection opened'; });
  AMS.registerAction('session.start', function (p) {
    const s = AMS.byId(AMS.db.sessions, p.sessionId);
    if (!s || !guard(s.squadId)) return null;
    if (s.status !== 'Planned') { AMS.toast(s.title + ' is already ' + s.status.toLowerCase(), 'info'); return s.status; }
    const members = squadMembers(s.squadId);
    let devices = 0;
    AMS.mutate((db) => {
      const x = AMS.byId(db.sessions, s.id);
      x.status = 'Live'; x.startedAt = nowAt(); x.attendance = x.attendance || {}; x.recording = [];
      members.forEach((a) => {
        if (variantOf(x, a.id) === 'excluded' || a.availability === 'Unavailable') { x.attendance[a.id] = 'excused'; return; }
        if ((a.devices || []).length) { x.recording.push(a.id); devices += a.devices.length; }
      });
      AMS.notify({ toRole: 'scientist', title: 'Session live — devices recording', text: squadLabel(s.squadId) + ': ' + s.title + ' started ' + x.startedAt + '. ' + x.recording.length + ' athletes streaming GPS/HR.', module: 'training' });
    }, { toast: s.title + ' is live — take attendance', toastKind: 'good', log: { type: 'training', text: 'Started ' + s.title + ' (' + squadLabel(s.squadId) + ')' } });
    return 'Session live, ' + devices + ' devices recording';
  });
  AMS.registerAction('session.markAttendance', function (p) {
    const s = AMS.byId(AMS.db.sessions, p.sessionId);
    if (!s || !guard(s.squadId)) return null;
    const members = squadMembers(s.squadId);
    let n = 0;
    AMS.mutate((db) => {
      const x = AMS.byId(db.sessions, s.id); x.attendance = x.attendance || {};
      if (p.all) members.forEach((a) => { if (!x.attendance[a.id]) { x.attendance[a.id] = 'present'; n++; } });
      else if (p.athleteId) { if (p.value) x.attendance[p.athleteId] = p.value; else delete x.attendance[p.athleteId]; n = 1; }
    }, p.all ? { toast: n + ' marked present', log: { type: 'training', text: 'Attendance taken for ' + s.title + ' — ' + n + ' marked present' } } : undefined);
    return n + ' updated';
  });
  /** Complete a session: merge RPE, record sRPE load (RPE × minutes × variant scale) into the athletes' load series. Idempotent (records deltas). */
  AMS.registerAction('session.complete', function (p) {
    const s = AMS.byId(AMS.db.sessions, p.sessionId);
    if (!s || !guard(s.squadId)) return null;
    const members = squadMembers(s.squadId);
    const idx = dayIdx(s.date);
    const summary = { rated: 0, imputed: 0, total: 0, flagged: [] };
    AMS.mutate((db) => {
      const x = AMS.byId(db.sessions, s.id);
      const wasCompleted = x.status === 'Completed';
      const prevRpe = Object.assign({}, x.rpe || {});
      x.rpe = x.rpe || {}; x.attendance = x.attendance || {}; x.mods = x.mods || {};
      Object.keys(p.rpe || {}).forEach((aid) => { const v = +p.rpe[aid]; if (v >= 0 && v <= 10 && p.rpe[aid] !== '' && p.rpe[aid] != null) x.rpe[aid] = Math.round(v); });
      members.forEach((a) => {
        if (x.attendance[a.id]) return;
        x.attendance[a.id] = variantOf(x, a.id) === 'excluded' || a.availability === 'Unavailable' ? 'excused' : 'present';
      });
      x.imputed = x.imputed || {};
      if (p.impute) attendedIds(x).forEach((aid) => { if (x.rpe[aid] == null) { x.rpe[aid] = sessRPE(x); x.imputed[aid] = true; summary.imputed++; } });
      const rec = x.loadRecorded || (x.loadRecorded = {});
      attendedIds(x).forEach((aid) => {
        if (x.rpe[aid] == null) return;
        const load = Math.round(x.rpe[aid] * x.duration * VARIANTS[variantOf(x, aid)].scale);
        if (rec[aid] == null && wasCompleted && prevRpe[aid] != null) { rec[aid] = load; return; } // historical — already in the series
        const delta = load - (rec[aid] || 0);
        if (delta && idx >= 0 && idx <= 41) AMS.calc.recordLoad(db, aid, delta, idx);
        rec[aid] = load;
        summary.rated++; summary.total += load;
      });
      x.status = 'Completed'; x.completedAt = x.completedAt || nowAt(); x.recording = [];
      members.forEach((a) => { const live = AMS.byId(db.athletes, a.id); const r = acwrAt(extLoads(live), Math.min(Math.max(idx, 40), 41)); if (r >= 1.5) summary.flagged.push(a.name + ' ' + r.toFixed(2)); });
      const st = rpeStats(x);
      AMS.notify({ toRole: 'scientist', title: 'Session load recorded', text: squadLabel(x.squadId) + ' · ' + x.title + ': ' + st.submitted + '/' + st.attended + ' RPE in, avg ' + fmtAU(st.submitted ? AMS.mean(st.attended ? attendedIds(x).map((id) => rec[id]).filter((v) => v != null) : []) : 0) + ' AU.' + (summary.flagged.length ? ' Load jump: ' + summary.flagged.slice(0, 3).join(', ') + '.' : ''), module: 'training' });
      if (AMS.ui.role !== 'coach') AMS.notify({ toRole: 'coach', title: 'RPE recorded', text: x.title + ' — ' + st.submitted + ' RPE ratings saved.', module: 'training' });
    }, { toast: s.title + ' completed — ' + 'load recorded for ' + Object.keys(p.rpe || {}).length + ' athletes', log: { type: 'training', text: 'Completed ' + s.title + ' (' + squadLabel(s.squadId) + ') — session RPE recorded' } });
    return 'Completed · ' + summary.rated + ' loads recorded' + (summary.flagged.length ? ' · ' + summary.flagged.length + ' above 1.5' : '');
  });
  /** Publish a new session (one per selected squad). Modified / Unavailable athletes automatically get an adjusted version. */
  AMS.registerAction('session.create', function (p) {
    const squadIds = [].concat(p.squadIds || p.squadId || []).filter(Boolean);
    if (!squadIds.length) { AMS.toast('Pick at least one squad', 'bad'); return null; }
    if (!squadIds.every((id) => guard(id))) return null;
    const ids = [];
    let autoN = 0;
    AMS.mutate((db) => {
      squadIds.forEach((sqid) => {
        const sq = AMS.org.squad(sqid);
        const s = {
          id: AMS.uid('SES'), squadId: sqid, date: p.date || D.add(AMS.TODAY, 1), start: p.start || (sq && sq.slot) || '07:30', duration: +p.duration || 60,
          title: p.title || 'Training session', type: p.type || 'Speed', intensity: p.intensity || 'Moderate', plannedRPE: +p.plannedRPE || INTENSITY_RPE[p.intensity] || 5,
          location: p.location || ((LOCATIONS[sq && sq.sport] || ['Gym A'])[0]), coachId: (AMS.me() || {}).id || (sq && sq.coachId),
          blocks: (p.blocks || []).map((b) => ({ exerciseId: b.exerciseId, dose: b.dose })), status: 'Planned', attendance: {}, rpe: {}, mods: {}, notes: p.notes || '', createdBy: AMS.ui.role, createdAt: AMS.TODAY + 'T' + nowAt(),
        };
        squadMembers(sqid).forEach((a) => {
          const chosen = p.mods && p.mods[a.id];
          const v = chosen ? (chosen.variant || chosen) : defaultVariant(a);
          if (v && v !== 'none') { s.mods[a.id] = { variant: v, by: chosen ? AMS.ui.role : 'auto', at: nowAt(), source: chosen ? (chosen.source || 'coach') : 'auto' }; if (!chosen) autoN++; }
        });
        db.sessions.push(s);
        ids.push(s.id);
        AMS.notify({ toRole: 'athlete', title: 'New session: ' + s.title, text: D.fmtLong(s.date) + ' ' + s.start + ' at ' + s.location + ' (' + s.duration + ' min, ' + s.intensity.toLowerCase() + ').' + (Object.keys(s.mods).length ? ' ' + Object.keys(s.mods).length + ' athletes have an adjusted version.' : ''), module: 'training' });
        const rehab = Object.keys(s.mods).filter((id) => s.mods[id].variant === 'rehab');
        if (rehab.length) AMS.notify({ toRole: 'physio', title: 'Rehab variants scheduled', text: rehab.length + ' athlete(s) on rehab programme during ' + s.title + ' (' + D.fmt(s.date) + ').', module: 'training' });
      });
    }, { toast: 'Published ' + (p.title || 'session') + ' to ' + squadIds.length + ' squad' + (squadIds.length > 1 ? 's' : ''), log: { type: 'training', text: 'Published session "' + (p.title || 'Training session') + '" for ' + squadIds.map(squadLabel).join(', ') + ' on ' + D.fmt(p.date || D.add(AMS.TODAY, 1)) } });
    AMS.training.lastCreated = ids;
    return 'Published ' + ids.length + ' session(s)' + (autoN ? ', ' + autoN + ' auto-adjusted' : '');
  });
  AMS.registerAction('session.applyVariants', function (p) {
    const s = AMS.byId(AMS.db.sessions, p.sessionId);
    if (!s || !guard(s.squadId)) return null;
    const todo = squadMembers(s.squadId).filter((a) => defaultVariant(a) && !(s.mods || {})[a.id]);
    if (!todo.length) { AMS.toast('All Modified / Unavailable athletes already have their version', 'info'); return '0 applied'; }
    AMS.mutate((db) => {
      const x = AMS.byId(db.sessions, s.id); x.mods = x.mods || {};
      todo.forEach((a) => { x.mods[a.id] = { variant: defaultVariant(a), by: AMS.ui.role, at: nowAt(), source: 'auto' }; });
    }, { toast: 'Adjusted versions applied for ' + todo.length + ' athlete' + (todo.length > 1 ? 's' : ''), log: { type: 'training', text: 'Variants applied to ' + s.title + ': ' + todo.map((a) => a.name + ' → ' + VARIANTS[defaultVariant(a)].short).join(', ') } });
    return todo.length + ' applied';
  });
  AMS.registerAction('training.setVariant', function (p) {
    const s = AMS.byId(AMS.db.sessions, p.sessionId);
    if (!s || !guard(s.squadId)) return null;
    if (p.variant && p.variant !== 'none') return AMS.runAction('session.modifyForAthlete', { athleteId: p.athleteId, sessionId: s.id, variant: p.variant });
    const a = AMS.org.athlete(p.athleteId);
    AMS.mutate((db) => { const x = AMS.byId(db.sessions, s.id); if (x.mods) delete x.mods[p.athleteId]; }, { toast: firstName(a) + ' back on the full session', toastKind: 'info', log: { type: 'training', text: a.name + ' → full session (' + s.title + ')', athleteId: a.id } });
    return 'Variant cleared';
  });
  AMS.registerAction('session.duplicate', function (p) {
    const s = AMS.byId(AMS.db.sessions, p.sessionId);
    if (!s || !guard(s.squadId)) return null;
    const id = AMS.uid('SES');
    AMS.mutate((db) => {
      const copy = JSON.parse(JSON.stringify(s));
      Object.assign(copy, { id, date: p.date || D.add(s.date, 1), status: 'Planned', attendance: {}, rpe: {}, loadRecorded: undefined, imputed: undefined, recording: undefined, startedAt: undefined, completedAt: undefined, rpeReminded: undefined, rpeApp: undefined });
      db.sessions.push(copy);
    }, { toast: s.title + ' duplicated to ' + D.fmtLong(p.date || D.add(s.date, 1)), log: { type: 'training', text: 'Duplicated ' + s.title + ' to ' + D.fmt(p.date || D.add(s.date, 1)) } });
    AMS.training.lastCreated = [id];
    return 'Duplicated';
  });
  AMS.registerAction('session.move', function (p) {
    const s = AMS.byId(AMS.db.sessions, p.sessionId);
    if (!s || !guard(s.squadId)) return null;
    if (s.status !== 'Planned') { AMS.toast('Only planned sessions can be moved', 'bad'); return null; }
    const from = s.date;
    AMS.mutate((db) => {
      const x = AMS.byId(db.sessions, s.id); x.date = p.date; if (p.start) x.start = p.start;
      AMS.notify({ toRole: 'athlete', title: 'Session moved', text: x.title + ' moved from ' + D.fmt(from) + ' to ' + D.fmtLong(p.date) + ' ' + x.start + '.', module: 'training' });
    }, { toast: s.title + ' moved to ' + D.fmtLong(p.date), log: { type: 'training', text: 'Moved ' + s.title + ' from ' + D.fmt(from) + ' to ' + D.fmt(p.date) } });
    return 'Moved';
  });
  /** Demo helper: athletes submit RPE from the app (deterministic per athlete). */
  AMS.registerAction('session.simulateRpe', function (p) {
    const s = AMS.byId(AMS.db.sessions, p.sessionId);
    if (!s) return null;
    const members = squadMembers(s.squadId);
    let n = 0;
    AMS.mutate((db) => {
      const x = AMS.byId(db.sessions, s.id); x.rpe = x.rpe || {}; x.rpeApp = x.rpeApp || {};
      members.forEach((a) => {
        const att = (x.attendance || {})[a.id];
        if (att === 'absent' || att === 'excused' || variantOf(x, a.id) === 'excluded' || x.rpe[a.id] != null) return;
        const r = AMS.rng(x.id + ':' + a.id);
        if (r() > 0.78) return; // some never submit
        const v = variantOf(x, a.id);
        const base = v === 'recovery' || v === 'rehab' ? 3 : v === 'reduced' ? sessRPE(x) - 2 : sessRPE(x);
        x.rpe[a.id] = AMS.clamp(Math.round(base + (a.baseRPE || 0) + (r() - 0.5) * 2), 1, 10);
        x.rpeApp[a.id] = nowAt(); n++;
      });
    }, { toast: n + ' athletes submitted RPE from the app', toastKind: 'info', log: { type: 'training', text: n + ' RPE ratings received from the athlete app for ' + s.title } });
    return n + ' submissions';
  });
  AMS.registerAction('training.rpeRemind', function (p) {
    const s = AMS.byId(AMS.db.sessions, p.sessionId);
    if (!s) return null;
    const missing = p.athleteIds || rpeStats(s).missing;
    if (!missing.length) { AMS.toast('Everyone has rated this session', 'info'); return '0'; }
    AMS.mutate((db) => {
      const x = AMS.byId(db.sessions, s.id); x.rpeReminded = { at: nowAt(), n: missing.length };
      db.meta.remindersSent = (db.meta.remindersSent || 0) + missing.length;
      AMS.notify({ toRole: 'athlete', title: 'Rate yesterday\'s session', text: 'How hard was "' + s.title + '" (' + D.fmt(s.date) + ')? One tap, 1–10.', module: 'athlete-app' });
    }, { toast: 'RPE reminder sent to ' + missing.length + ' athlete' + (missing.length > 1 ? 's' : ''), log: { type: 'training', text: 'RPE reminder sent to ' + missing.length + ' athletes for ' + s.title + ' (' + D.fmt(s.date) + ')' } });
    return 'Reminder sent to ' + missing.length;
  });
  /** Put an athlete on an adjusted version for every planned session in the next 7 days (AI projected-spike fix). */
  AMS.registerAction('training.protectUpcoming', function (p) {
    const a = AMS.org.athlete(p.athleteId);
    if (!a) return null;
    const sq = homeSquadId(a);
    if (!guard(sq)) return null;
    const variant = p.variant || defaultVariant(a) || 'reduced';
    const list = (upcomingBySquad()[sq] || []).filter(({ s }) => !(s.mods || {})[a.id]).map(({ s }) => s.id);
    if (!list.length) { AMS.toast(firstName(a) + ' already has adjusted sessions all week', 'info'); return '0'; }
    AMS.mutate((db) => { list.forEach((id) => { const x = AMS.byId(db.sessions, id); x.mods = x.mods || {}; x.mods[a.id] = { variant, by: AMS.ui.role, at: nowAt(), source: 'ai' }; }); },
      { toast: firstName(a) + ': ' + VARIANTS[variant].short.toLowerCase() + ' version on ' + list.length + ' upcoming sessions', toastKind: 'ai', log: { type: 'training', text: a.name + ' → ' + VARIANTS[variant].label + ' for ' + list.length + ' sessions (next 7 days, projected load jump)', athleteId: a.id } });
    return list.length + ' sessions adjusted';
  });
  AMS.registerAction('plan.updateMeso', function (p) {
    const plan = AMS.db.plans && AMS.db.plans.squads[p.squadId];
    const m = plan && plan.mesos.find((x) => x.id === p.mesoId);
    if (!m || !guard(p.squadId)) return null;
    AMS.mutate(() => {
      if (p.focus) m.focus = p.focus;
      if (p.scalePct && p.scalePct !== 100) m.targets = m.targets.map((t) => Math.round((t * p.scalePct) / 100 / 10) * 10);
      if (p.targets) m.targets = p.targets.map((t) => Math.max(0, Math.round(+t || 0)));
      if (p.notes != null) m.notes = p.notes;
      plan.updatedBy = (AMS.me() || {}).name || AMS.roleLabel(AMS.ui.role); plan.updatedOn = AMS.TODAY;
      AMS.notify({ toRole: 'scientist', title: 'Mesocycle updated', text: squadLabel(p.squadId) + ': "' + m.focus + '" ' + (p.scalePct && p.scalePct !== 100 ? 'targets ' + (p.scalePct > 100 ? '+' : '') + (p.scalePct - 100) + '%' : 'edited') + '.', module: 'training' });
    }, { toast: 'Mesocycle "' + (p.focus || m.focus) + '" saved', log: { type: 'training', text: 'Mesocycle updated for ' + squadLabel(p.squadId) + ': ' + (p.focus || m.focus) + (p.scalePct && p.scalePct !== 100 ? ' (targets ' + p.scalePct + '%)' : '') } });
    return 'Mesocycle saved';
  });
  AMS.registerAction('exercise.create', function (p) {
    if (!AMS.canEdit('training')) { AMS.toast('Only coaches can add exercises', 'bad'); return null; }
    if (!p.name) { AMS.toast('Give the exercise a name', 'bad'); return null; }
    const n = AMS.db.exercises.reduce((m, e) => Math.max(m, +String(e.id).replace(/\D/g, '') || 0), 0) + 1;
    const id = 'EX-' + String(n).padStart(3, '0');
    AMS.mutate((db) => { db.exercises.push({ id, name: p.name, category: p.category || 'Strength', focus: p.focus || '—', dose: p.dose || '3 × 8', createdBy: (AMS.me() || {}).name }); },
      { toast: p.name + ' added to the library', log: { type: 'training', text: 'Exercise added to library: ' + p.name + ' (' + (p.category || 'Strength') + ')' } });
    return id;
  });

  /* ================================================================== AI detectors */
  AMS.registerDetector('training.projectedSpike', function (ctx) {
    if (!['coach', 'director', 'scientist', 'physio'].includes(ctx.role)) return [];
    const out = [];
    ctx.athletes.forEach((a) => {
      if (a.availability === 'Unavailable') return;
      const now = AMS.calc.acwr(a);
      if (now >= 1.5) return; // already a load jump — core detector owns it
      const p = project(a);
      if (p.peak.acwr < 1.5) return;
      const sqid = homeSquadId(a);
      const up = (upcomingBySquad()[sqid] || []).filter(({ s }) => !(s.mods || {})[a.id]);
      const dv = defaultVariant(a);
      const acts = [];
      if (canEditSquad(sqid)) acts.push({ label: 'Use ' + VARIANTS[dv || 'reduced'].short.toLowerCase() + ' version all week', action: 'training.protectUpcoming', payload: { athleteId: a.id, variant: dv || 'reduced' }, primary: true });
      else acts.push({ label: 'Flag to coach', action: 'notify', payload: { toRole: 'coach', athleteId: a.id, text: a.name + ': planned week would push ACWR to ' + p.peak.acwr.toFixed(2) + ' by ' + D.dow(p.peak.date) + '. Consider ' + VARIANTS[dv || 'reduced'].short.toLowerCase() + ' sessions.' }, primary: true });
      acts.push({ label: 'Open week plan', action: 'go', payload: { module: 'training', params: { tab: 'week', squadId: sqid } } });
      out.push({
        id: 'trn-proj:' + a.id + ':' + AMS.TODAY + ':' + Math.round(p.peak.acwr * 10), kind: 'training', severity: p.peak.acwr >= 1.7 ? 'high' : 'med', module: 'training',
        title: a.name + ' — next week\'s plan would cause a load jump',
        summary: 'If ' + firstName(a) + ' completes the ' + up.length + ' planned session' + (up.length === 1 ? '' : 's') + ' as written, ACWR reaches ' + p.peak.acwr.toFixed(2) + ' by ' + D.dow(p.peak.date) + ' ' + D.fmt(p.peak.date) + ' (today ' + now.toFixed(2) + ').' + (a.availability === 'Modified' ? ' ' + firstName(a) + ' is Modified (' + availabilityNote(a) + ') but has no adjusted version yet.' : ' Recent weeks were light, so the planned volume is a big step up.'),
        athleteIds: [a.id], confidence: 0.78,
        evidence: [{ label: 'ACWR now', value: now.toFixed(2), tone: AMS.calc.acwrBand(now) }, { label: 'Projected peak', value: p.peak.acwr.toFixed(2), tone: 'bad' }, { label: 'Planned 7 days', value: fmtAU(p.next7) + ' AU', tone: 'warn' }, { label: 'Availability', value: a.availability, tone: a.availability === 'Available' ? 'good' : 'warn' }],
        actions: acts,
      });
    });
    return out.sort((x, y) => (y.evidence[1].value > x.evidence[1].value ? 1 : -1)).slice(0, 8);
  });
  AMS.registerDetector('training.rpeMissing', function (ctx) {
    if (!['coach', 'director', 'scientist'].includes(ctx.role)) return [];
    const squads = [...new Set(ctx.athletes.map(homeSquadId))];
    return outstandingRpe(squads, 3).filter((x) => x.attended >= 3 && x.share < 0.7).slice(0, 6).map((x) => {
      const s = x.s, names = x.missing.map((id) => (AMS.org.athlete(id) || {}).name).filter(Boolean);
      const acts = [{ label: 'Remind ' + x.missing.length + ' athletes', action: 'training.rpeRemind', payload: { sessionId: s.id }, primary: true }];
      if (canEditSquad(s.squadId)) acts.push({ label: 'Enter RPE now', action: 'training.openRpe', payload: { sessionId: s.id } });
      return {
        id: 'trn-rpe:' + s.id + ':' + x.submitted, kind: 'training', severity: x.share < 0.5 ? 'med' : 'low', module: 'training',
        title: squadLabel(s.squadId) + ' — ' + Math.round(x.share * 100) + '% RPE for ' + D.dow(s.date) + '\'s ' + s.title,
        summary: x.missing.length + ' athletes have not rated the session, so their load (and ACWR) is under-counted: ' + names.slice(0, 4).join(', ') + (names.length > 4 ? ' +' + (names.length - 4) : '') + '. Ratings older than 48 h are much less reliable.',
        athleteIds: x.missing, confidence: 0.92,
        evidence: [{ label: 'Submitted', value: x.submitted + '/' + x.attended, tone: 'warn' }, { label: 'Target', value: '≥ 70%', tone: 'info' }, { label: 'Session', value: D.fmt(s.date) + ' ' + s.start, tone: 'info' }],
        actions: acts,
      };
    });
  });
  AMS.registerDetector('training.lowAttendance', function (ctx) {
    if (!['coach', 'director', 'scientist', 'physio'].includes(ctx.role)) return [];
    const bySq = {};
    const out = [];
    ctx.athletes.forEach((a) => {
      const sq = homeSquadId(a);
      const ss = bySq[sq] || (bySq[sq] = recentSessions(sq, 14));
      const st = attendanceStats(a, ss);
      if (st.pct == null || st.total < 6 || st.pct >= 80) return;
      const acts = ctx.role === 'coach'
        ? [{ label: 'Create follow-up task', action: 'task.create', payload: { title: 'Talk to ' + a.name + ' about attendance (' + st.pct + '% in 14 sessions)', ownerRole: 'coach', module: 'training', athleteId: a.id }, primary: true }, { label: 'Open profile', action: 'open.athlete', payload: { athleteId: a.id, tab: 'training' } }]
        : [{ label: 'Ask coach to follow up', action: 'notify', payload: { toRole: 'coach', athleteId: a.id, text: a.name + ' attended ' + st.attended + ' of ' + st.total + ' sessions (' + st.pct + '%). Worth a check-in.' }, primary: true }, { label: 'Open profile', action: 'open.athlete', payload: { athleteId: a.id, tab: 'training' } }];
      out.push({
        id: 'trn-att:' + a.id + ':' + AMS.TODAY, kind: 'training', severity: st.pct < 65 ? 'med' : 'low', module: 'training',
        title: a.name + ' — attendance ' + st.pct + '% over the last 14 sessions',
        summary: 'Missed ' + st.absent + ' session' + (st.absent === 1 ? '' : 's') + (st.late ? ' and late ' + st.late + ' time' + (st.late === 1 ? '' : 's') : '') + '. Squad norm is above 90%. Missed sessions also break the chronic-load base, so the next full session is a bigger jump.',
        athleteIds: [a.id], confidence: 0.86,
        evidence: [{ label: 'Attended', value: st.attended + '/' + st.total, tone: 'warn' }, { label: 'Absences', value: String(st.absent), tone: 'bad' }, { label: 'ACWR', value: AMS.calc.acwr(a).toFixed(2), tone: AMS.calc.acwrBand(AMS.calc.acwr(a)) }],
        actions: acts,
      });
    });
    return out.slice(0, 6);
  });

  /* ================================================================== module CSS (theme tokens only) */
  (function injectCSS() {
    if (typeof document === 'undefined' || !document.createElement || (document.getElementById && document.getElementById('style-training'))) return;
    const css = `
.trn-gantt{position:relative;min-width:940px}
.trn-g-row{display:grid;grid-template-columns:120px minmax(0,1fr);border-bottom:1px solid var(--border)}
.trn-g-row:last-child{border-bottom:0}
.trn-g-lab{padding:6px 10px;font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--fg-3);border-right:1px solid var(--border);display:flex;align-items:center;background:var(--surface-2)}
.trn-g-track{position:relative;min-height:32px}
.trn-g-blk{position:absolute;top:4px;bottom:4px;border-radius:5px;padding:2px 7px;font-size:11.5px;overflow:hidden;white-space:nowrap;border:1px solid transparent;display:flex;flex-direction:column;justify-content:center;line-height:1.2;min-width:0}
.trn-g-blk b,.trn-g-blk span{overflow:hidden;text-overflow:ellipsis}
.trn-g-blk.click{cursor:pointer}
.trn-g-blk.click:hover{border-color:var(--border-strong)}
.trn-g-blk.sel{box-shadow:0 0 0 2px var(--accent)}
.trn-today{position:absolute;top:0;bottom:0;width:0;border-left:2px solid var(--bad);z-index:3;pointer-events:none}
.trn-today-lab{position:absolute;top:1px;left:4px;font-size:9.5px;font-weight:700;color:var(--bad);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;background:var(--surface);padding:0 2px;border-radius:2px}
.trn-wk{position:absolute;top:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--fg-3);border-left:1px solid var(--chart-grid)}
.trn-wk.deload{background:var(--surface-3);font-style:italic}
.trn-wk.cur{color:var(--accent);font-weight:700;background:var(--accent-weak)}
.trn-comp{position:absolute;top:2px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;font-size:10px;color:var(--bad);white-space:nowrap;z-index:2;cursor:default}
.trn-comp i{display:block;width:10px;height:10px;transform:rotate(45deg);background:var(--bad);border-radius:2px;margin-bottom:2px}
.trn-bar-col{position:absolute;bottom:0;top:6px;display:flex;align-items:flex-end;justify-content:center;gap:1px}
.trn-bar-p{width:36%;border:1px dashed var(--fg-3);border-bottom:0;border-radius:2px 2px 0 0}
.trn-bar-a{width:36%;border-radius:2px 2px 0 0;background:var(--accent)}
.trn-bar-a.partial{background:color-mix(in srgb,var(--accent) 45%,transparent)}
.trn-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}
.trn-day{background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-lg);display:flex;flex-direction:column;min-height:210px;min-width:0}
.trn-day.today{border-color:var(--accent);box-shadow:inset 0 2px 0 var(--accent)}
.trn-day-h{padding:8px 10px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:baseline;gap:6px}
.trn-day-b{padding:8px;display:flex;flex-direction:column;gap:8px;flex:1}
.trn-day-f{padding:6px 10px;border-top:1px solid var(--border);font-size:11px;color:var(--fg-3);display:flex;justify-content:space-between;align-items:center;gap:4px}
.trn-sess{background:var(--surface);border:1px solid var(--border);border-left:4px solid var(--accent);border-radius:var(--r);padding:7px 9px;display:flex;flex-direction:column;gap:4px;cursor:pointer;min-width:0;text-align:left}
.trn-sess:hover{border-color:var(--border-strong);box-shadow:var(--shadow)}
.trn-sess .t{font-weight:600;font-size:12.5px;line-height:1.25}
@media (max-width:1180px){.trn-week{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (max-width:640px){.trn-week{grid-template-columns:minmax(0,1fr)}.trn-day{min-height:0}}
.trn-rpe{display:flex;gap:3px;flex-wrap:wrap}
.trn-rpe button{width:27px;height:27px;border-radius:6px;border:1px solid var(--border-strong);background:var(--surface);cursor:pointer;font-weight:600;font-size:12px;color:var(--fg-2);padding:0}
.trn-rpe button:hover{border-color:var(--fg-3)}
.trn-rpe button.on.z1{background:var(--good-weak);color:var(--good);border-color:var(--good)}
.trn-rpe button.on.z2{background:var(--warn-weak);color:var(--warn);border-color:var(--warn)}
.trn-rpe button.on.z3{background:var(--bad-weak);color:var(--bad);border-color:var(--bad)}
.trn-att{display:inline-flex;gap:2px}
.trn-att button{height:24px;min-width:26px;padding:0 6px;border-radius:5px;border:1px solid var(--border-strong);background:var(--surface);font-size:11px;font-weight:600;cursor:pointer;color:var(--fg-3)}
.trn-att button.on.present{background:var(--good-weak);color:var(--good);border-color:var(--good)}
.trn-att button.on.late{background:var(--warn-weak);color:var(--warn);border-color:var(--warn)}
.trn-att button.on.absent{background:var(--bad-weak);color:var(--bad);border-color:var(--bad)}
.trn-att button.on.excused{background:var(--info-weak);color:var(--info);border-color:var(--info)}
.trn-strip{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--surface-3)}
.trn-strip>i{display:block;height:100%}
.trn-cell{width:24px;height:22px;border-radius:4px;display:inline-grid;place-items:center;font-size:10.5px;font-weight:700;background:var(--surface-3);color:var(--fg-3)}
.trn-cell.present{background:var(--good-weak);color:var(--good)}
.trn-cell.late{background:var(--warn-weak);color:var(--warn)}
.trn-cell.absent{background:var(--bad-weak);color:var(--bad)}
.trn-cell.excused{background:var(--info-weak);color:var(--info)}
.trn-matrix{border-collapse:separate;border-spacing:2px;font-size:12px}
.trn-matrix th{font-size:10px;font-weight:500;color:var(--fg-3);text-align:center;white-space:nowrap;padding:2px}
.trn-matrix td{padding:0;text-align:center}
.trn-matrix td.nm{text-align:left;padding-right:8px;white-space:nowrap;position:sticky;left:0;background:var(--surface);z-index:1}
.trn-ex-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.trn-ex{border:1px solid var(--border);border-radius:var(--r-lg);padding:10px 12px;display:flex;flex-direction:column;gap:6px;background:var(--surface);min-width:0}
.trn-lock{display:flex;gap:10px;align-items:flex-start;padding:10px 14px;border:1px solid var(--border);background:var(--surface-2);border-radius:var(--r-lg);font-size:12.5px;color:var(--fg-2)}
.trn-rec{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--good);font-weight:600;white-space:nowrap}
.trn-blk{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);min-width:0}
.trn-blk:last-child{border-bottom:0}
.trn-n{width:22px;height:22px;border-radius:50%;background:var(--surface-3);display:grid;place-items:center;font-size:11px;font-weight:600;color:var(--fg-2);flex:none}
.trn-big{font:600 26px/1 var(--font-display);font-variant-numeric:tabular-nums}
`;
    try { const el = document.createElement('style'); el.id = 'style-training'; el.textContent = css; (document.head || document.body).appendChild(el); } catch (e) { /* no DOM */ }
  })();

  /* ================================================================== shared small components */
  function LockNotice({ text }) { return html`<div className="trn-lock"><${UI.Icon} name="lock" size=${15} style=${{ flex: 'none', marginTop: 1 }} /><div>${text}</div></div>`; }
  function VariantPill({ variant, source }) {
    if (!variant || variant === 'none') return html`<span className="faint small">Full</span>`;
    const v = VARIANTS[variant];
    return html`<${UI.Pill} tone=${v.tone} title=${v.label + (source ? ' · ' + source : '')}>${v.short}${source === 'ai' ? html` <${UI.Icon} name="sparkles" size=${10} />` : null}<//>`;
  }
  function StatusPill({ s }) { return html`<${UI.Pill} tone=${STATUS_TONE[s.status]} dot=${s.status === 'Live'}>${s.status}<//>`; }
  function AttCell({ value, title }) { const m = ATT[value]; return html`<span className=${'trn-cell ' + (value || '')} title=${title}>${m ? m.short : '·'}</span>`; }
  function ReadinessStrip({ counts, total }) {
    const t = total || 1;
    return html`<div className="trn-strip" title=${counts.good + ' green · ' + counts.warn + ' amber · ' + counts.bad + ' red'}>
      <i style=${{ width: (counts.good / t) * 100 + '%', background: 'var(--good)' }} /><i style=${{ width: (counts.warn / t) * 100 + '%', background: 'var(--warn)' }} /><i style=${{ width: (counts.bad / t) * 100 + '%', background: 'var(--bad)' }} />
    </div>`;
  }
  function squadReadiness(members) {
    const list = members.map((a) => ({ a, r: AMS.calc.readiness(a) }));
    const counts = { good: 0, warn: 0, bad: 0 };
    list.forEach((x) => { counts[x.r.band]++; });
    return { list, counts, checked: list.filter((x) => x.r.checkedIn).length };
  }
  /** ACWR chart with sweet-spot band, 1.5 danger line and the plan's projection (dashed). */
  function AcwrChart({ athlete, height }) {
    const { v } = AMS.useStore();
    const a = athlete;
    const pts = useMemo(() => {
      const ext = extLoads(a);
      const last = (a.loads[41] || 0) > 0 ? 41 : 40;
      const out = [];
      for (let i = 27; i <= 47; i++) { const r = acwrAt(ext, i); out.push({ x: D.fmt(D.add(AMS.TODAY, i - 41)), actual: i <= last ? r : null, proj: i >= last ? r : null }); }
      return out;
    }, [v, a.id]);
    const mx = Math.max(1.8, ...pts.map((p) => Math.max(p.actual || 0, p.proj || 0)) + 0.1);
    return html`<${UI.LineChart} height=${height || 200} yMin=${0.4} yMax=${AMS.round(mx, 1)}
      series=${[{ name: 'ACWR', data: pts.map((p) => ({ x: p.x, y: p.actual })), tone: 'accent', width: 2.2 }, { name: 'Projected from plan', data: pts.map((p) => ({ x: p.x, y: p.proj })), tone: 'ai', dashed: true }]}
      bands=${[{ from: 0.8, to: 1.3, tone: 'good', label: 'Sweet spot 0.8–1.3' }, { from: 1.3, to: 1.5, tone: 'warn' }, { from: 1.5, to: AMS.round(mx, 1), tone: 'bad', label: 'Load jump ≥ 1.5' }]}
      refs=${[{ y: 1.5, label: '1.5 load jump', tone: 'bad' }]} markers=${[{ i: 14, label: 'Today', tone: 'fg-3' }]} yFormat=${(x) => AMS.round(x, 2)} />`;
  }
  function AcuteChronicChart({ athlete }) {
    const { v } = AMS.useStore();
    const a = athlete;
    const pts = useMemo(() => {
      const L = a.loads || [];
      const last = (L[41] || 0) > 0 ? 41 : 40;
      const out = [];
      for (let i = 27; i <= last; i++) out.push({ x: D.fmt(D.add(AMS.TODAY, i - 41)), acute: Math.round(AMS.mean(L.slice(i - 6, i + 1))), chronic: Math.round(AMS.mean(L.slice(i - 27, i + 1))) });
      return out;
    }, [v, a.id]);
    return html`<${UI.LineChart} height=${170} series=${[{ name: 'Acute (7-day avg, AU/day)', data: pts.map((p) => ({ x: p.x, y: p.acute })), tone: 'warn', area: true }, { name: 'Chronic (28-day avg)', data: pts.map((p) => ({ x: p.x, y: p.chronic })), tone: 'cat-2' }]} yFormat=${(x) => Math.round(x)} />`;
  }
  function AcwrExplainer() {
    return html`<div className="ai-box small" style=${{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
      <div className="row tight" style=${{ marginBottom: 4 }}><${UI.Icon} name="info" size=${14} /><b>What is ACWR?</b></div>
      <div className="muted">Acute:chronic workload ratio compares this week's training load (7-day average of RPE × minutes) with the athlete's own 4-week average.
      Around 1.0 means "same as usual". <b className="good">0.8–1.3</b> is the sweet spot; <b className="bad">above 1.5 is a "load jump"</b> — the strongest early warning of soft-tissue injury; below 0.8 means under-loaded (fitness drifting, next hard session is risky).</div>
    </div>`;
  }

  /* ================================================================== TODAY */
  function TodayTab({ squadId, squads, setSquad, setTab }) {
    const { db, v } = AMS.useStore();
    const key = squads.join(',');
    const todays = useMemo(() => db.sessions.filter((s) => s.date === AMS.TODAY && squads.includes(s.squadId)).sort((a, b) => a.start.localeCompare(b.start) || a.squadId.localeCompare(b.squadId)), [v, key]);
    const focus = todays.find((s) => s.squadId === squadId) || null;
    const members = useMemo(() => squadMembers(squadId), [v, squadId]);
    const sr = useMemo(() => squadReadiness(members), [v, squadId]);
    const flagged = sr.list.filter((x) => x.r.band !== 'good').sort((x, y) => x.r.score - y.r.score);
    const notIn = sr.list.filter((x) => !x.r.checkedIn).map((x) => x.a);
    const editable = canEditSquad(squadId);
    const outstanding = useMemo(() => outstandingRpe(squads, 3), [v, key]);
    const rows = useMemo(() => todays.map((s) => { const m = squadMembers(s.squadId); const q = squadReadiness(m); return { id: s.id, s, n: m.length, q, mods: Object.keys(s.mods || {}).length }; }), [v, key]);
    const insights = AMS.ai.insights({ module: 'training', kinds: ['risk'] }).filter((i) => (i.athleteIds || []).some((id) => members.some((m) => m.id === id)) || (i.module === 'training' && !(i.athleteIds || []).length)).slice(0, 4);
    const role = AMS.ui.role;
    const live = todays.filter((s) => s.status === 'Live').length, done = todays.filter((s) => s.status === 'Completed').length;
    const outN = AMS.sum(outstanding.map((x) => x.missing.length));
    const actOn = (a, variant) => {
      if (!focus) return;
      if (editable) AMS.runAction('session.modifyForAthlete', { athleteId: a.id, sessionId: focus.id, variant });
      else AMS.runAction('notify', { toRole: 'coach', athleteId: a.id, text: 'Suggest ' + VARIANTS[variant].label.toLowerCase() + ' for ' + a.name + ' in ' + focus.title + ' today (' + AMS.roleLabel(role) + ').' });
    };
    return html`<div className="col loose">
      <div className="grid g4">
        <${UI.KPI} label="Sessions today" icon="calendar" value=${todays.length} foot=${live + ' live · ' + done + ' completed · ' + (todays.length - live - done) + ' planned'} onClick=${() => setTab('week')} />
        <${UI.KPI} label=${'Checked in · ' + (AMS.org.squad(squadId) || {}).name} icon="phone" value=${pct(sr.checked, members.length)} unit="%" foot=${sr.checked + ' of ' + members.length + ' athletes · target 85%'} tone=${pct(sr.checked, members.length) < 85 ? 'warn' : ''} />
        <${UI.KPI} label="Red / amber readiness" icon="pulse" value=${sr.counts.bad + ' / ' + sr.counts.warn} foot=${sr.counts.good + ' green · ' + flagged.filter((x) => focus && (focus.mods || {})[x.a.id]).length + ' already adjusted'} tone=${sr.counts.bad ? 'bad' : ''} />
        <${UI.KPI} label="RPE outstanding (3 days)" icon="clipboard" value=${outN} foot=${outstanding.length + ' session' + (outstanding.length === 1 ? '' : 's') + ' below 100%'} tone=${outN ? 'warn' : ''} onClick=${() => setTab('attendance')} />
      </div>
      <div className="grid g-main">
        <div className="col loose">
          ${focus ? html`<${UI.Card} title=${'Pre-session check · ' + focus.title} icon="whistle" hint=${focus.start + ' · ' + squadLabel(focus.squadId)}
              actions=${html`<${StatusPill} s=${focus} /><button className="btn sm" onClick=${() => AMS.runAction('session.open', { sessionId: focus.id })}>Open session</button>
                ${editable && focus.status === 'Planned' && html`<button className="btn sm primary" onClick=${() => { AMS.runAction('session.start', { sessionId: focus.id }); AMS.runAction('session.open', { sessionId: focus.id }); }}><${UI.Icon} name="play" size=${13} />Start session</button>`}
                ${editable && focus.status === 'Live' && html`<button className="btn sm primary" onClick=${() => AMS.openModal('rpe-collect', { sessionId: focus.id })}><${UI.Icon} name="check" size=${13} />Complete & collect RPE</button>`}`}>
              <div className="col">
                <div className="row wrap" style=${{ gap: 18 }}>
                  <div className="col tight" style=${{ gap: 0 }}><span className="upper">Session</span><span style=${{ fontWeight: 600 }}>${focus.type} · ${focus.intensity}</span></div>
                  <div className="col tight" style=${{ gap: 0 }}><span className="upper">Time</span><span className="tnum">${focus.start}–${endTime(focus)} (${focus.duration} min)</span></div>
                  <div className="col tight" style=${{ gap: 0 }}><span className="upper">Location</span><span>${focus.location}</span></div>
                  <div className="col tight" style=${{ gap: 0 }}><span className="upper">Planned load</span><span className="tnum">RPE ${sessRPE(focus)} × ${focus.duration}′ = ${fmtAU(sessLoad(focus))} AU</span></div>
                  <div className="col tight" style=${{ gap: 0 }}><span className="upper">Variants</span><span>${Object.keys(focus.mods || {}).length} adjusted</span></div>
                </div>
                <div className="col tight">
                  <div className="row between small"><span><b className="good">${sr.counts.good} green</b> · <b className="warn">${sr.counts.warn} amber</b> · <b className="bad">${sr.counts.bad} red</b></span><span className="faint">${members.length} athletes</span></div>
                  <${ReadinessStrip} counts=${sr.counts} total=${members.length} />
                </div>
                <div className="row wrap between" style=${{ gap: 10 }}>
                  <div className="col tight grow" style=${{ minWidth: 200 }}>
                    <div className="row between small"><span>Morning check-in</span><b className="tnum">${sr.checked}/${members.length}</b></div>
                    <${UI.Meter} value=${sr.checked} max=${members.length || 1} tone=${pct(sr.checked, members.length) >= 85 ? 'good' : 'warn'} />
                    ${notIn.length > 0 && html`<span className="tiny faint">Not in yet: ${notIn.map((a) => a.name).join(', ')}</span>`}
                  </div>
                  ${notIn.length > 0 && role !== 'director' && html`<button className="btn sm" onClick=${() => AMS.runAction('checkin.remind', { athleteIds: notIn.map((a) => a.id) })}><${UI.Icon} name="bell" size=${13} />Nudge ${notIn.length}</button>`}
                </div>
              </div>
            <//>` : html`<${UI.Card} title="Pre-session check"><${UI.Empty} icon="calendar" title=${'No session today for ' + squadLabel(squadId)}>Sunday is a rest day; pick another squad or open the week plan.<//><//>`}
          <${UI.Card} title="Who needs attention before the session" icon="alert" hint="red and amber readiness, with the reasons" flush
            actions=${focus && editable && squadMembers(focus.squadId).some((a) => defaultVariant(a) && !(focus.mods || {})[a.id]) ? html`<button className="btn sm" onClick=${() => AMS.runAction('session.applyVariants', { sessionId: focus.id })}>Apply Modified / Unavailable versions</button>` : null}>
            ${flagged.length === 0 ? html`<${UI.Empty} icon="check" title="Everyone is green">No adjustments suggested.<//>` : html`<div className="list">${flagged.map(({ a, r }) => {
              const mod = focus && (focus.mods || {})[a.id];
              const sug = suggestVariant(a, r);
              return html`<div key=${a.id} className=${'list-item sev-stripe ' + r.band} style=${{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style=${{ minWidth: 170, flex: '1 1 170px' }}><${UI.AthleteCell} athlete=${a} sub=${a.availability + (availabilityNote(a) ? ' · ' + availabilityNote(a) : '')} /></div>
                <${UI.Readiness} athlete=${a} size=${32} showLabel=${true} />
                <div className="col tight" style=${{ flex: '2 1 220px', minWidth: 0 }}>
                  <${UI.Evidence} items=${r.factors.slice(0, 4)} />
                  ${(a.wellness[27] || {}).note && html`<span className="tiny muted">"${a.wellness[27].note}"</span>`}
                </div>
                <div className="col tight" style=${{ alignItems: 'flex-end', flex: '1 1 180px' }}>
                  ${mod ? html`<div className="row tight"><${VariantPill} variant=${mod.variant} source=${mod.source} />${editable && html`<button className="btn xs ghost" onClick=${() => AMS.runAction('training.setVariant', { sessionId: focus.id, athleteId: a.id, variant: 'none' })}>Undo</button>`}</div><span className="tiny faint">by ${mod.by} · ${mod.at}</span>`
                    : sug && focus ? html`<button className=${AMS.cx('btn sm', editable ? 'ai' : '')} disabled=${role === 'director' || role === 'nutritionist'} title=${role === 'director' ? 'Directors view only' : ''} onClick=${() => actOn(a, sug)}><${UI.Icon} name=${editable ? 'zap' : 'send'} size=${12} />${editable ? firstName(a) + ': switch to ' + VARIANTS[sug].short.toLowerCase() : 'Suggest ' + VARIANTS[sug].short.toLowerCase() + ' to coach'}</button><span className="tiny ai-c">AI · ${r.band === 'bad' ? 'red readiness' : 'amber'}${AMS.calc.acwr(a) >= 1.5 ? ' + load jump ' + AMS.calc.acwr(a).toFixed(2) : ''}</span>` : html`<span className="tiny faint">Monitor</span>`}
                </div>
              </div>`;
            })}</div>`}
          <//>
          ${rows.length > 1 && html`<${UI.Card} title="All sessions today in your scope" icon="list" hint=${AMS.scopeLabel()} flush>
            <${UI.Table} compact rows=${rows} onRow=${(r) => setSquad(r.s.squadId)} selectedId=${focus && focus.id} maxHeight=${420}
              columns=${[
                { key: 'time', label: 'Time', render: (r) => html`<span className="tnum">${r.s.start}</span>`, sort: (r) => r.s.start, width: 60 },
                { key: 'title', label: 'Session', render: (r) => html`<div className="col tight" style=${{ gap: 0 }}><b>${r.s.title}</b><span className="tiny faint">${squadLabel(r.s.squadId)}</span></div>`, sort: (r) => r.s.title },
                { key: 'status', label: 'Status', render: (r) => html`<${StatusPill} s=${r.s} />`, sort: (r) => r.s.status },
                { key: 'rd', label: 'Readiness', render: (r) => html`<div className="col tight" style=${{ gap: 3, minWidth: 90 }}><${ReadinessStrip} counts=${r.q.counts} total=${r.n} /><span className="tiny faint">${r.q.counts.bad} red · ${r.q.counts.warn} amber</span></div>`, sort: (r) => -r.q.counts.bad, hideSm: true },
                { key: 'ci', label: 'Check-in', num: true, render: (r) => pct(r.q.checked, r.n) + '%', sort: (r) => r.q.checked / (r.n || 1) },
                { key: 'mods', label: 'Variants', num: true, render: (r) => r.mods || '—', sort: (r) => r.mods, hideSm: true },
                { key: 'go', label: '', sort: false, render: (r) => html`<button className="btn xs" onClick=${(e) => { e.stopPropagation(); AMS.runAction('session.open', { sessionId: r.s.id }); }}>Open</button>` },
              ]} />
          <//>`}
        </div>
        <div className="col loose">
          <${UI.Card} ai title="Training copilot" hint="for this squad, today" actions=${html`<${UI.AskCopilot} prompt=${'Who in ' + ((AMS.org.squad(squadId) || {}).name || 'my squad') + ' should train lighter today, and why?'} label="Ask" />`} flush>
            ${focus && flagged.filter((x) => x.r.band === 'bad' && !(focus.mods || {})[x.a.id]).length > 0 && html`<div className="insight sev-stripe ai">
              <div className="row tight"><${UI.AIChip} label="Session plan" /><span className="tiny faint">88% confidence</span></div>
              <div className="i-title">${flagged.filter((x) => x.r.band === 'bad').map((x) => firstName(x.a)).join(', ')} ${flagged.filter((x) => x.r.band === 'bad').length === 1 ? 'is' : 'are'} red for ${focus.title}</div>
              <div className="small muted">${flagged.filter((x) => x.r.band === 'bad').map((x) => firstName(x.a) + ': ' + x.r.factors.slice(0, 2).map((f) => f.label.toLowerCase() + ' ' + f.value).join(', ')).join(' · ')}. Suggest a lighter version — readiness, ACWR and soreness all point the same way.</div>
              ${editable && html`<div className="row tight wrap">${flagged.filter((x) => x.r.band === 'bad' && !(focus.mods || {})[x.a.id]).map((x) => html`<button key=${x.a.id} className="btn sm ai" onClick=${() => actOn(x.a, suggestVariant(x.a, x.r) || 'recovery')}><${UI.Icon} name="zap" size=${12} />${firstName(x.a)}: ${VARIANTS[suggestVariant(x.a, x.r) || 'recovery'].short.toLowerCase()}</button>`)}</div>`}
            </div>`}
            <${UI.InsightList} insights=${insights} compact=${false} empty="No training flags for this squad" />
          <//>
          <${UI.Card} title="RPE still to collect" icon="clipboard" hint="last 3 days" flush>
            ${outstanding.length === 0 ? html`<${UI.Empty} icon="check" title="All sessions rated" />` : html`<div className="list">${outstanding.slice(0, 6).map((x) => html`<div key=${x.s.id} className="list-item" style=${{ flexWrap: 'wrap' }}>
              <div className="col tight grow" style=${{ gap: 0, minWidth: 140 }}><b className="small">${x.s.title}</b><span className="tiny faint">${D.dow(x.s.date)} ${D.fmt(x.s.date)} · ${squadLabel(x.s.squadId)}</span></div>
              <${UI.Pill} tone=${x.share < 0.7 ? 'bad' : 'warn'}>${x.submitted}/${x.attended} rated<//>
              <button className="btn xs" disabled=${role === 'director'} onClick=${() => AMS.runAction('training.rpeRemind', { sessionId: x.s.id })}>${x.s.rpeReminded ? 'Reminded ' + x.s.rpeReminded.at : 'Remind'}</button>
              ${canEditSquad(x.s.squadId) && html`<button className="btn xs primary" onClick=${() => AMS.openModal('rpe-collect', { sessionId: x.s.id })}>Enter</button>`}
            </div>`)}</div>`}
          <//>
        </div>
      </div>
    </div>`;
  }

  /* ================================================================== PLAN (periodisation Gantt) */
  function PlanTab({ squadId }) {
    const { db, v } = AMS.useStore();
    const plan = db.plans && db.plans.squads[squadId];
    const curMeso = plan ? mesoAt(plan, CUR_W) : null;
    const [selId, setSel] = useState(curMeso ? curMeso.id : null);
    useEffect(() => { setSel(curMeso ? curMeso.id : null); }, [squadId]);
    const members = useMemo(() => squadMembers(squadId), [v, squadId]);
    const actual = useMemo(() => Array.from({ length: SEASON_WEEKS }, (_, w) => weekActual(members, w)), [v, squadId]);
    const curPlanned = useMemo(() => weekPlanned(members, squadId, WEEK_START), [v, squadId]);
    if (!plan) return html`<${UI.Empty} icon="calendar" title="No season plan for this squad yet" />`;
    const sq = AMS.org.squad(squadId);
    const W = SEASON_WEEKS;
    const L = (w) => (w / W) * 100 + '%';
    const todayPct = ((D.diff(AMS.TODAY, SEASON_START) + 0.5) / (W * 7)) * 100 + '%';
    const comps = plan.comps.map((id) => AMS.byId(db.competitions, id)).filter(Boolean);
    const phases = phasesOf(plan);
    const sel = plan.mesos.find((m) => m.id === selId) || curMeso || plan.mesos[0];
    const targets = Array.from({ length: W }, (_, w) => targetForWeek(plan, w));
    const maxV = Math.max(...targets.filter(Boolean), ...actual.filter(Boolean), curPlanned || 0, 1);
    const months = [];
    for (let d = '2026-09-01'; d <= '2027-03-01'; d = D.add(d, 32).slice(0, 8) + '01') months.push(d);
    const Today = () => html`<div className="trn-today" style=${{ left: todayPct }} />`;
    const editable = canEditSquad(squadId);
    return html`<div className="col loose">
      <${UI.Card} title=${'Season plan 2026–27 · ' + sq.name} icon="layers" hint=${'Macrocycle Sep → Mar · ' + plan.mesos.length + ' mesocycles · updated by ' + plan.updatedBy + ' ' + D.fmt(plan.updatedOn)} flush
        actions=${html`<span className="legend hide-sm">${Object.keys(PHASE_TONE).map((p) => html`<span key=${p}><i style=${{ background: 'var(--' + PHASE_TONE[p] + ')' }} />${PHASE_SHORT[p]}</span>`)}</span>`}>
        <div className="tbl-wrap">
          <div className="trn-gantt">
            <div className="trn-g-row"><div className="trn-g-lab">Month</div><div className="trn-g-track" style=${{ minHeight: 24 }}>
              ${months.map((m) => { const off = D.diff(m, SEASON_START); if (off < -20) return null; return html`<span key=${m} className="tiny faint" style=${{ position: 'absolute', left: Math.max(0, (off / (W * 7)) * 100) + '%', top: 5, paddingLeft: 4, borderLeft: '1px solid var(--border)' }}>${D.month(m)} ${m.slice(2, 4)}</span>`; })}
              <${Today} /><span className="trn-today-lab" style=${{ left: 'calc(' + todayPct + ' + 2px)' }}>Today</span>
            </div></div>
            <div className="trn-g-row"><div className="trn-g-lab">Macro phase</div><div className="trn-g-track">
              ${phases.map((p, i) => html`<div key=${i} className="trn-g-blk" title=${p.phase + ' · ' + p.weeks + ' weeks'} style=${{ left: L(p.startWeek), width: 'calc(' + L(p.weeks) + ' - 2px)', background: 'color-mix(in srgb, var(--' + PHASE_TONE[p.phase] + ') 20%, transparent)', borderColor: 'color-mix(in srgb, var(--' + PHASE_TONE[p.phase] + ') 45%, transparent)' }}><b className="tiny">${p.weeks >= 3 ? p.phase : PHASE_SHORT[p.phase]}</b></div>`)}
              <${Today} />
            </div></div>
            <div className="trn-g-row"><div className="trn-g-lab">Mesocycle</div><div className="trn-g-track" style=${{ minHeight: 44 }}>
              ${plan.mesos.map((m) => html`<div key=${m.id} className=${AMS.cx('trn-g-blk click', sel && sel.id === m.id && 'sel')} title=${m.focus + ' · ' + m.weeks + ' weeks · click for details'} onClick=${() => setSel(m.id)}
                  style=${{ left: L(m.startWeek), width: 'calc(' + L(m.weeks) + ' - 3px)', background: 'var(--surface)', borderColor: 'var(--border-strong)', borderLeft: '4px solid var(--' + PHASE_TONE[m.phase] + ')' }}>
                <b style=${{ fontSize: 11.5 }}>${m.focus}</b><span className="tiny faint">${m.weeks} wk · ${fmtAU(AMS.mean(m.targets))} AU/wk</span>
              </div>`)}
              <${Today} />
            </div></div>
            <div className="trn-g-row"><div className="trn-g-lab">Week</div><div className="trn-g-track" style=${{ minHeight: 24 }}>
              ${targets.map((_, w) => { const m = mesoAt(plan, w); const dl = m && m.deload[w - m.startWeek]; return html`<span key=${w} className=${AMS.cx('trn-wk', dl && 'deload', w === CUR_W && 'cur')} style=${{ left: L(w), width: L(1) }} title=${weekLabel(D.add(SEASON_START, 7 * w)) + ' · ' + D.fmt(D.add(SEASON_START, 7 * w)) + (dl ? ' · deload' : '')}>${isoWeek(D.add(SEASON_START, 7 * w))}</span>`; })}
            </div></div>
            <div className="trn-g-row"><div className="trn-g-lab">Competitions</div><div className="trn-g-track" style=${{ minHeight: 40 }}>
              ${comps.map((c) => html`<div key=${c.id} className="trn-comp" style=${{ left: ((D.diff(c.date, SEASON_START) + 0.5) / (W * 7)) * 100 + '%' }} title=${c.name + ' · ' + D.fmtLong(c.date) + ' · ' + c.location + ' (' + c.level + ')'}><i /><span>${c.name.replace(/ — .*/, '').replace('National ', '').slice(0, 22)}</span><span className="faint">${D.fmt(c.date)}</span></div>`)}
              <${Today} />
            </div></div>
            <div className="trn-g-row"><div className="trn-g-lab">Load AU / athlete<br /><span style=${{ textTransform: 'none', fontWeight: 400 }}>planned vs actual</span></div><div className="trn-g-track" style=${{ minHeight: 96 }}>
              ${targets.map((t, w) => { const a = w === CUR_W ? (curPlanned != null ? curPlanned : actual[w]) : actual[w]; const partial = w === CUR_W; return html`<div key=${w} className="trn-bar-col" style=${{ left: L(w), width: L(1) }} title=${weekLabel(D.add(SEASON_START, 7 * w)) + ' — planned ' + fmtAU(t) + ' AU' + (a != null ? ' · ' + (partial ? 'this week (done + scheduled) ' : 'actual ') + fmtAU(a) + ' AU' : '')}>
                <span className="trn-bar-p" style=${{ height: ((t || 0) / maxV) * 80 + 'px' }} />${a != null && html`<span className=${AMS.cx('trn-bar-a', partial && 'partial')} style=${{ height: (a / maxV) * 80 + 'px' }} />`}
              </div>`; })}
              <${Today} />
            </div></div>
          </div>
        </div>
        <div className="row wrap small faint" style=${{ padding: '8px 16px', gap: 14 }}>
          <span className="row tight"><span style=${{ width: 10, height: 10, border: '1px dashed var(--fg-3)', display: 'inline-block' }} />Planned target</span>
          <span className="row tight"><span style=${{ width: 10, height: 10, background: 'var(--accent)', display: 'inline-block', borderRadius: 2 }} />Actual (squad average)</span>
          <span className="row tight"><span style=${{ width: 10, height: 10, background: 'var(--surface-3)', display: 'inline-block' }} />Deload week</span>
          <span className="row tight"><span style=${{ width: 2, height: 10, background: 'var(--bad)', display: 'inline-block' }} />Today · W42</span>
        </div>
      <//>
      <div className="grid g-main">
        <${MesoDetail} plan=${plan} meso=${sel} squadId=${squadId} actual=${actual} curPlanned=${curPlanned} editable=${editable} />
        <div className="col loose">
          <${UI.Card} title="Competitions this season" icon="flag" flush>
            ${comps.length === 0 ? html`<${UI.Empty} title="No target competitions" />` : html`<div className="list">${comps.map((c) => { const w = seasonWeekOf(c.date); const m = mesoAt(plan, w); return html`<div key=${c.id} className="list-item">
              <div className="col tight grow" style=${{ gap: 0 }}><b className="small">${c.name}</b><span className="tiny faint">${D.fmtLong(c.date)} · ${c.location} · ${c.level}</span></div>
              <div className="col tight" style=${{ gap: 2, alignItems: 'flex-end' }}><${UI.Pill} tone=${D.diff(c.date, AMS.TODAY) < 30 ? 'warn' : 'info'}>${D.rel(c.date)}<//>${m && html`<span className="tiny faint">${m.focus}</span>`}</div>
            </div>`; })}</div>`}
          <//>
          ${!editable && html`<${LockNotice} text=${editReason(squadId)} />`}
        </div>
      </div>
    </div>`;
  }
  function MesoDetail({ plan, meso, squadId, actual, curPlanned, editable }) {
    const m = meso;
    const [focus, setFocus] = useState(m.focus);
    const [scale, setScale] = useState(100);
    const [notes, setNotes] = useState(m.notes || '');
    useEffect(() => { setFocus(m.focus); setScale(100); setNotes(m.notes || ''); }, [m.id, m.focus]);
    const weeks = m.targets.map((t, i) => {
      const w = m.startWeek + i; const mon = D.add(SEASON_START, 7 * w);
      const act = w === CUR_W ? curPlanned : (w < CUR_W ? actual[w] : null);
      return { id: m.id + ':' + i, w, mon, t, act, deload: m.deload[i], cur: w === CUR_W, past: w < CUR_W };
    });
    const pastW = weeks.filter((x) => x.past && x.act != null);
    const members = squadMembers(squadId);
    const chronicWeekly = AMS.mean(members.map((a) => AMS.sum((a.loads || []).slice(13, 41)) / 4));
    const next = weeks.find((x) => x.w === CUR_W + 1) || weeks.find((x) => !x.past && !x.cur);
    const nextRatio = next && chronicWeekly ? next.t / chronicWeekly : null;
    const first = D.add(SEASON_START, 7 * m.startWeek), last = D.add(SEASON_START, 7 * (m.startWeek + m.weeks) - 1);
    return html`<${UI.Card} title=${'Mesocycle · ' + m.focus} icon="target" hint=${m.phase + ' · ' + weekLabel(first) + '–' + weekLabel(last) + ' · ' + D.fmt(first) + ' – ' + D.fmt(last)}>
      <div className="col">
        <${UI.DL} cols=${3} items=${[['Focus', m.focus], ['Weeks', m.weeks + (m.deload.some(Boolean) ? ' (incl. 1 deload)' : '')], ['Avg target', fmtAU(AMS.mean(m.targets)) + ' AU / athlete / week']]} />
        <div className="tbl-wrap"><table className="tbl compact">
          <thead><tr><th>Week</th><th>Dates</th><th className="num">Target AU</th><th className="num">Actual AU</th><th className="num">vs target</th><th></th></tr></thead>
          <tbody>${weeks.map((x) => { const d = x.act != null && x.t ? Math.round(((x.act - x.t) / x.t) * 100) : null; return html`<tr key=${x.id} className=${x.cur ? 'selected' : ''}>
            <td><b>${weekLabel(x.mon)}</b></td><td className="small">${D.fmt(x.mon)} – ${D.fmt(D.add(x.mon, 6))}</td>
            <td className="num">${fmtAU(scale !== 100 ? (x.t * scale) / 100 : x.t)}</td><td className="num">${x.act != null ? fmtAU(x.act) : '—'}${x.cur ? html`<span className="tiny faint"> (plan)</span>` : null}</td>
            <td className="num">${d == null ? '—' : html`<span className=${Math.abs(d) > 15 ? 'bad' : Math.abs(d) > 8 ? 'warn' : 'good'}>${d > 0 ? '+' : ''}${d}%</span>`}</td>
            <td>${x.deload ? html`<${UI.Pill}>Deload<//>` : x.cur ? html`<${UI.Pill} tone="accent">Current<//>` : null}</td>
          </tr>`; })}</tbody>
        </table></div>
        <div className="col tight"><span className="upper">KPIs for this block</span>${m.kpis.map((k, i) => html`<div key=${i} className="row tight small"><${UI.Icon} name=${weeks.every((x) => x.past) ? 'check' : 'target'} size=${13} style=${{ color: 'var(--fg-3)' }} />${k}</div>`)}</div>
        <div className="ai-box small">
          <div className="row tight" style=${{ marginBottom: 4 }}><${UI.AIChip} label="Plan check" /><span className="tiny faint">based on ${members.length} athletes' recorded loads</span></div>
          ${pastW.length ? html`<div>${pastW.map((x) => weekLabel(x.mon) + ' ran ' + (x.act >= x.t ? '+' : '') + Math.round(((x.act - x.t) / (x.t || 1)) * 100) + '% vs target').join('; ')}.</div>` : null}
          ${next && nextRatio != null ? html`<div>${weekLabel(next.mon)} target (${fmtAU(next.t)} AU) is <b className=${nextRatio > 1.3 ? 'bad' : nextRatio > 1.15 ? 'warn' : 'good'}>${nextRatio.toFixed(2)}×</b> the squad's 4-week weekly average (${fmtAU(chronicWeekly)} AU) — ${nextRatio > 1.3 ? 'expect ACWR above 1.3 for most athletes; consider trimming 10%.' : nextRatio > 1.15 ? 'a firm but safe step; keep the planned deload after it.' : 'within the safe progression range.'}</div>` : html`<div>Block is complete — review KPIs before the next block.</div>`}
        </div>
        ${editable ? html`<div className="col" style=${{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <span className="upper">Edit mesocycle</span>
          <div className="grid g2">
            <${UI.Field} label="Focus"><input className="input" value=${focus} onChange=${(e) => setFocus(e.target.value)} /><//>
            <${UI.Field} label=${'Weekly targets ' + (scale > 100 ? '+' : '') + (scale - 100) + '%'} help="Scales every week of this block"><input type="range" min="70" max="130" step="5" value=${scale} onChange=${(e) => setScale(+e.target.value)} /><//>
          </div>
          <${UI.Field} label="Coach notes"><textarea className="textarea" style=${{ minHeight: 56 }} value=${notes} onChange=${(e) => setNotes(e.target.value)} placeholder="e.g. Keep max-velocity work ≤ 60 m while Priya's hamstrings settle" /><//>
          <div className="row tight" style=${{ justifyContent: 'flex-end' }}>
            <button className="btn sm ghost" onClick=${() => { setFocus(m.focus); setScale(100); setNotes(m.notes || ''); }}>Reset</button>
            <button className="btn sm primary" disabled=${!focus || (focus === m.focus && scale === 100 && notes === (m.notes || ''))} onClick=${() => { AMS.runAction('plan.updateMeso', { squadId, mesoId: m.id, focus, scalePct: scale, notes }); setScale(100); }}>Save mesocycle</button>
          </div>
        </div>` : (m.notes ? html`<div className="small muted">Coach notes: ${m.notes}</div>` : null)}
      </div>
    <//>`;
  }

  /* ================================================================== WEEK (microcycle) */
  const WEEKS = ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'];
  function WeekTab({ squadId, squads, setTab, setDraft }) {
    const { db, v } = AMS.useStore();
    const [weekStart, setWeekStart] = useState(WEEK_START);
    const days = D.range(weekStart, 7);
    const editable = canEditSquad(squadId);
    const plan = db.plans && db.plans.squads[squadId];
    const w = seasonWeekOf(weekStart);
    const meso = plan ? mesoAt(plan, w) : null;
    const target = plan ? targetForWeek(plan, w) : null;
    const members = useMemo(() => squadMembers(squadId), [v, squadId]);
    const sessions = useMemo(() => db.sessions.filter((s) => s.squadId === squadId && days.includes(s.date)).sort((a, b) => a.start.localeCompare(b.start)), [v, squadId, weekStart]);
    const plannedAvg = useMemo(() => weekPlanned(members, squadId, weekStart) || 0, [v, squadId, weekStart]);
    const dayLoad = days.map((d) => AMS.sum(sessions.filter((s) => s.date === d).map(sessLoad)));
    const proj = useMemo(() => {
      const endIdx = Math.min(dayIdx(D.add(weekStart, 6)), 47);
      if (endIdx < 41) return null;
      const list = members.filter((a) => a.availability !== 'Unavailable').map((a) => { const ext = extLoads(a); let peak = 0, peakIdx = 41; for (let i = Math.max(41, dayIdx(weekStart)); i <= endIdx; i++) { const r = acwrAt(ext, i); if (r > peak) { peak = r; peakIdx = i; } } return { a, peak, peakIdx, end: acwrAt(ext, endIdx) }; });
      return { list, mean: AMS.round(AMS.mean(list.map((x) => x.end)), 2), over: list.filter((x) => x.peak >= 1.5).sort((x, y) => y.peak - x.peak), endIdx };
    }, [v, squadId, weekStart]);
    const types = AMS.groupBy(sessions, 'type');
    const futureDays = D.range(AMS.TODAY, 8);
    const sessMenu = (s) => [
      { label: 'Open session', icon: 'external', onClick: () => AMS.runAction('session.open', { sessionId: s.id }) },
      ...(editable ? futureDays.filter((d) => d !== s.date).slice(0, 7).map((d) => ({ label: 'Duplicate to ' + D.dow(d) + ' ' + D.fmt(d), icon: 'copy', onClick: () => AMS.runAction('session.duplicate', { sessionId: s.id, date: d }) })) : []),
      ...(editable && s.status === 'Planned' && s.date >= AMS.TODAY ? futureDays.filter((d) => d !== s.date).slice(0, 7).map((d) => ({ label: 'Move to ' + D.dow(d) + ' ' + D.fmt(d), icon: 'arrow-r', onClick: () => AMS.runAction('session.move', { sessionId: s.id, date: d }) })) : []),
    ];
    const diff = target ? Math.round(((plannedAvg - target) / target) * 100) : null;
    return html`<div className="col loose">
      <div className="row wrap between">
        <div className="row wrap tight">
          <${UI.Seg} options=${WEEKS.map((d) => ({ id: d, label: weekLabel(d) + (d === WEEK_START ? ' · this week' : '') }))} value=${weekStart} onChange=${setWeekStart} />
          <span className="small muted">${D.fmt(weekStart)} – ${D.fmt(D.add(weekStart, 6))} · ${squadLabel(squadId)}${meso ? ' · ' + meso.focus + ' (week ' + (w - meso.startWeek + 1) + ' of ' + meso.weeks + (meso.deload[w - meso.startWeek] ? ', deload' : '') + ')' : ''}</span>
        </div>
        ${editable && html`<button className="btn sm primary" onClick=${() => setTab('builder')}><${UI.Icon} name="plus" size=${13} />New session</button>`}
      </div>
      ${!editable && html`<${LockNotice} text=${editReason(squadId)} />`}
      <div className="trn-week">
        ${days.map((d, i) => {
          const list = sessions.filter((s) => s.date === d);
          const isToday = d === AMS.TODAY;
          return html`<div key=${d} className=${AMS.cx('trn-day', isToday && 'today')}>
            <div className="trn-day-h"><b className="small">${D.dow(d)} ${D.fmt(d)}</b>${isToday ? html`<${UI.Pill} tone="accent">Today<//>` : d < AMS.TODAY ? html`<span className="tiny faint">done</span>` : null}</div>
            <div className="trn-day-b">
              ${list.length === 0 && html`<div className="tiny faint" style=${{ padding: '6px 2px' }}>${D.dowIndex(d) === 0 ? 'Rest day' : 'No session'}</div>`}
              ${list.map((s) => { const nm = Object.keys(s.mods || {}).length; return html`<div key=${s.id} className="trn-sess" style=${{ borderLeftColor: typeColor(s.type) }} onClick=${() => AMS.runAction('session.open', { sessionId: s.id })} role="button" tabIndex=${0}>
                <div className="row between" style=${{ gap: 4 }}><span className="tiny mono">${s.start} · ${s.duration}′</span><span onClick=${(e) => e.stopPropagation()}><${UI.Menu} items=${sessMenu(s)} trigger=${html`<button className="btn ghost xs icon" aria-label="Session actions"><${UI.Icon} name="more" size=${13} /></button>`} /></span></div>
                <span className="t">${s.title}</span>
                <div className="row tight wrap"><${UI.Pill} tone=${INT_TONE[s.intensity]}>${s.intensity}<//><span className="tiny faint">${s.type}</span></div>
                <span className="tiny muted tnum">RPE ${sessRPE(s)} · ${fmtAU(sessLoad(s))} AU</span>
                <div className="row between tight"><${StatusPill} s=${s} />${nm > 0 && html`<span className="tiny warn" title=${Object.keys(s.mods).map((id) => (AMS.org.athlete(id) || {}).name + ': ' + VARIANTS[s.mods[id].variant].short).join('\n')}>${nm} variant${nm > 1 ? 's' : ''}</span>`}</div>
              </div>`; })}
            </div>
            <div className="trn-day-f"><span className="tnum">${dayLoad[i] ? fmtAU(dayLoad[i]) + ' AU' : '—'}</span>${editable && d >= AMS.TODAY && html`<button className="btn ghost xs" onClick=${() => { setDraft((dr) => Object.assign({}, dr, { date: d, squadIds: [squadId] })); setTab('builder'); }}><${UI.Icon} name="plus" size=${12} />Add</button>`}</div>
          </div>`;
        })}
      </div>
      <div className="grid g3">
        <${UI.Card} title="Planned load vs target" icon="target" hint="per athlete, this week">
          <div className="col">
            <div className="row between" style=${{ alignItems: 'flex-end' }}><span className="trn-big">${fmtAU(plannedAvg)}<small className="faint" style=${{ fontSize: 13 }}> AU</small></span><span className="small muted">target ${fmtAU(target)} AU</span></div>
            <${UI.Meter} value=${plannedAvg} max=${Math.max(plannedAvg, (target || 1) * 1.25)} tone=${diff == null ? '' : Math.abs(diff) <= 8 ? 'good' : Math.abs(diff) <= 15 ? 'warn' : 'bad'} />
            <span className="small">${diff == null ? 'No target for this week' : html`<b className=${Math.abs(diff) <= 8 ? 'good' : Math.abs(diff) <= 15 ? 'warn' : 'bad'}>${diff > 0 ? '+' : ''}${diff}%</b> vs the ${meso ? meso.focus.toLowerCase() : ''} target${meso && meso.deload[w - meso.startWeek] ? ' (deload week)' : ''}`}</span>
            <div className="col tight">${Object.keys(types).map((t) => html`<div key=${t} className="row between small"><span className="row tight"><span className="dot" style=${{ background: typeColor(t) }} />${t}</span><span className="tnum faint">${types[t].length} × · ${AMS.sum(types[t].map((s) => s.duration))} min</span></div>`)}</div>
          </div>
        <//>
        <${UI.Card} title="Daily planned load" icon="chart" hint="RPE × minutes">
          <${UI.BarChart} height=${170} data=${days.map((d, i) => ({ label: D.dow(d), value: dayLoad[i], tone: d === AMS.TODAY ? 'accent' : 'var(--fg-3)' }))} highlight=${days.indexOf(AMS.TODAY) >= 0 ? days.indexOf(AMS.TODAY) : null} />
        <//>
        <${UI.Card} ai title="Projected ACWR" hint=${proj ? 'if the week runs as planned' : ''}>
          ${!proj ? html`<div className="small muted">This week is already in the past — see Workload & ACWR for what actually happened.</div>` : html`<div className="col">
            <div className="row between" style=${{ alignItems: 'flex-end' }}><span className=${'trn-big ' + AMS.calc.acwrBand(proj.mean)}>${proj.mean.toFixed(2)}</span><span className="small muted">squad mean by ${D.dow(D.add(AMS.TODAY, proj.endIdx - 41))}</span></div>
            ${proj.over.length === 0 ? html`<div className="small good row tight"><${UI.Icon} name="check" size=${14} />Nobody crosses 1.5 with this plan.</div>` : html`<div className="col tight">
              <div className="small"><b className="bad">${proj.over.length} athlete${proj.over.length > 1 ? 's' : ''} would cross 1.5</b> if they complete every session as written:</div>
              ${proj.over.slice(0, 6).map((x) => html`<div key=${x.a.id} className="row between small"><span className="ellipsis">${x.a.name}</span><span className="row tight"><span className="tiny faint">${D.dow(D.add(AMS.TODAY, x.peakIdx - 41))}</span><${UI.AcwrPill} value=${x.peak} />${editable && html`<button className="btn xs ai" onClick=${() => AMS.runAction('training.protectUpcoming', { athleteId: x.a.id })}>Adjust</button>`}</span></div>`)}
            </div>`}
            <span className="tiny faint">Uses recorded loads up to today plus planned sessions (RPE × min × variant). Duplicating or moving sessions updates this instantly.</span>
          </div>`}
        <//>
      </div>
    </div>`;
  }

  /* ================================================================== SESSION BUILDER */
  function newDraft(squadId) {
    const sq = squadId && AMS.org.squad(squadId);
    return { squadIds: squadId ? [squadId] : [], date: D.add(AMS.TODAY, 1), start: (sq && sq.slot) || '07:30', location: ((LOCATIONS[sq && sq.sport] || ['Gym A'])[0]), title: '', type: 'Speed', intensity: 'High', duration: 75, plannedRPE: 7, blocks: [], mods: {}, notes: '' };
  }
  function templatesFor(squadIds) {
    const disc = new Set(squadIds.map((id) => (AMS.org.squad(id) || {}).discipline));
    const seen = {};
    AMS.db.sessions.forEach((s) => { const sq = AMS.org.squad(s.squadId); if (!sq || !disc.has(sq.discipline) || seen[s.title]) return; seen[s.title] = s; });
    return Object.values(seen);
  }
  function LibraryPicker({ onAdd, compact }) {
    const { db } = AMS.useStore();
    const [q, setQ] = useState('');
    const [cat, setCat] = useState('');
    const cats = [...new Set(db.exercises.map((e) => e.category))];
    const list = db.exercises.filter((e) => (!cat || e.category === cat) && (!q || (e.name + ' ' + e.focus + ' ' + e.category).toLowerCase().includes(q.toLowerCase())));
    return html`<div className="col tight">
      <div className="row tight"><${UI.Search} value=${q} onChange=${setQ} placeholder="Search exercises" style=${{ flex: 1 }} /><${UI.Select} value=${cat} onChange=${setCat} placeholder="All categories" options=${cats} /></div>
      <div className="list" style=${{ maxHeight: compact ? 300 : 460, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
        ${list.length === 0 && html`<${UI.Empty} icon="search" title="No exercises match" />`}
        ${list.map((e) => html`<div key=${e.id} className="list-item" style=${{ padding: '7px 10px' }}>
          <div className="col tight grow" style=${{ gap: 0 }}><span className="small" style=${{ fontWeight: 600 }}>${e.name}</span><span className="tiny faint">${e.category} · ${e.focus} · ${e.dose}</span></div>
          <button className="btn xs" onClick=${() => onAdd(e)}><${UI.Icon} name="plus" size=${12} />Add</button>
        </div>`)}
      </div>
    </div>`;
  }
  function BuilderTab({ squadId, squads, draft, setDraft, setTab }) {
    const { db, v } = AMS.useStore();
    const role = AMS.ui.role;
    const editableSquads = squads.filter(canEditSquad);
    const sel = (draft.squadIds || []).filter((id) => squads.includes(id));
    const squadIds = sel.length ? sel : [squadId];
    const set = (patch) => setDraft((d) => Object.assign({}, d, patch));
    const est = Math.round((+draft.plannedRPE || 0) * (+draft.duration || 0));
    const idx = dayIdx(draft.date);
    const members = useMemo(() => { const seen = {}; const out = []; squadIds.forEach((id) => squadMembers(id).forEach((a) => { if (!seen[a.id]) { seen[a.id] = 1; out.push(a); } })); return out; }, [v, squadIds.join(',')]);
    const rows = useMemo(() => members.map((a) => {
      const chosen = draft.mods[a.id];
      const dv = defaultVariant(a);
      const variant = chosen ? chosen.variant : (dv || 'none');
      const source = chosen ? chosen.source : (dv ? 'auto' : '');
      const load = Math.round(est * VARIANTS[variant].scale);
      const base = extLoads(a);
      const before = idx >= 41 && idx <= 48 ? acwrAt(base, idx) : AMS.calc.acwr(a);
      const after = idx >= 41 && idx <= 48 ? acwrAt(extLoads(a, [{ idx, load }]), idx) : before;
      const full = idx >= 41 && idx <= 48 ? acwrAt(extLoads(a, [{ idx, load: est }]), idx) : before;
      return { id: a.id, a, variant, source, load, before, after, full, r: AMS.calc.readiness(a) };
    }), [v, members, est, idx, JSON.stringify(draft.mods)]);
    const over = rows.filter((r) => r.after >= 1.5 && r.variant !== 'excluded');
    const fixable = over.filter((r) => r.variant === 'none' || r.variant === 'reduced');
    const autoRows = rows.filter((r) => r.source === 'auto');
    const templates = useMemo(() => templatesFor(squadIds), [v, squadIds.join(',')]);
    const canPublish = editableSquads.length > 0 && squadIds.every(canEditSquad);
    const problems = [!draft.title && 'Give the session a title', !draft.blocks.length && 'Add at least one exercise', !(idx >= 41) && 'Date must be today or later'].filter(Boolean);
    const addEx = (e) => set({ blocks: draft.blocks.concat({ exerciseId: e.id, dose: e.dose, key: AMS.uid('B') }) });
    const moveBlock = (i, dir) => { const b = draft.blocks.slice(); const j = i + dir; if (j < 0 || j >= b.length) return; const t = b[i]; b[i] = b[j]; b[j] = t; set({ blocks: b }); };
    const setMod = (aid, variant, source) => setDraft((d) => { const mods = Object.assign({}, d.mods); if (variant == null) delete mods[aid]; else mods[aid] = { variant, source: source || 'coach' }; return Object.assign({}, d, { mods }); });
    const applyAI = () => setDraft((d) => { const mods = Object.assign({}, d.mods); fixable.forEach((r) => { mods[r.id] = { variant: r.variant === 'none' ? 'reduced' : 'recovery', source: 'ai' }; }); return Object.assign({}, d, { mods }); });
    const applyTemplate = (title) => { const t = templates.find((x) => x.title === title); if (!t) return; set({ title: t.title, type: t.type, intensity: t.intensity, duration: t.duration, plannedRPE: sessRPE(t), blocks: t.blocks.map((b) => ({ exerciseId: b.exerciseId, dose: b.dose, key: AMS.uid('B') })) }); };
    const publish = () => {
      const mods = {}; Object.keys(draft.mods).forEach((id) => { mods[id] = draft.mods[id]; });
      const res = AMS.runAction('session.create', { squadIds, date: draft.date, start: draft.start, location: draft.location, title: draft.title, type: draft.type, intensity: draft.intensity, duration: +draft.duration, plannedRPE: +draft.plannedRPE, blocks: draft.blocks, mods, notes: draft.notes });
      if (res) { const ids = AMS.training.lastCreated || []; setDraft(newDraft(squadId)); setTab('week'); if (ids[0]) AMS.openDrawer('session', { sessionId: ids[0] }); }
    };
    if (!AMS.canEdit('training')) return html`<div className="col loose"><${LockNotice} text=${editReason(squadId) + ' The session builder is available to coaches.'} /><${UI.Card} title="Templates in use for this squad" icon="book" flush><div className="list">${templates.map((t) => html`<div key=${t.id} className="list-item"><span className="dot" style=${{ background: typeColor(t.type) }} /><div className="col tight grow" style=${{ gap: 0 }}><b className="small">${t.title}</b><span className="tiny faint">${t.type} · ${t.intensity} · ${t.duration} min · ${t.blocks.length} exercises</span></div><span className="tiny faint tnum">${fmtAU(sessLoad(t))} AU</span></div>`)}</div><//></div>`;
    return html`<div className="grid g-main">
      <div className="col loose">
        <${UI.Card} title="Session details" icon="edit" actions=${templates.length > 0 && html`<${UI.Select} value="" onChange=${applyTemplate} placeholder="Start from template…" options=${templates.map((t) => ({ value: t.title, label: t.title + ' (' + t.duration + '′)' }))} style=${{ maxWidth: 220 }} />`}>
          <div className="col">
            <${UI.Field} label="Squads">
              <div className="row wrap tight">${editableSquads.map((id) => html`<label key=${id} className="tag" style=${{ cursor: 'pointer', height: 26, background: squadIds.includes(id) ? 'var(--accent-weak)' : null, borderColor: squadIds.includes(id) ? 'var(--accent)' : null }}>
                <input type="checkbox" checked=${squadIds.includes(id)} onChange=${(e) => { const next = e.target.checked ? squadIds.concat(id) : squadIds.filter((x) => x !== id); set({ squadIds: next.length ? next : [id] }); }} />${squadLabel(id)}</label>`)}</div>
            <//>
            <div className="grid g3">
              <${UI.Field} label="Title"><input className="input" value=${draft.title} onChange=${(e) => set({ title: e.target.value })} placeholder="e.g. Acceleration + sled" /><//>
              <${UI.Field} label="Date"><${UI.Select} value=${draft.date} onChange=${(x) => set({ date: x })} options=${D.range(AMS.TODAY, 8).map((d) => ({ value: d, label: D.dow(d) + ' ' + D.fmt(d) + (d === AMS.TODAY ? ' (today)' : '') }))} /><//>
              <${UI.Field} label="Start"><input className="input" type="time" value=${draft.start} onChange=${(e) => set({ start: e.target.value })} /><//>
              <${UI.Field} label="Location"><${UI.Select} value=${draft.location} onChange=${(x) => set({ location: x })} options=${[...new Set(squadIds.flatMap((id) => LOCATIONS[(AMS.org.squad(id) || {}).sport] || ['Gym A']).concat(draft.location))]} /><//>
              <${UI.Field} label="Type"><${UI.Select} value=${draft.type} onChange=${(x) => set({ type: x })} options=${TYPES} /><//>
              <${UI.Field} label="Duration (min)"><input className="input" type="number" min="10" max="240" step="5" value=${draft.duration} onChange=${(e) => set({ duration: AMS.clamp(+e.target.value || 0, 0, 240) })} /><//>
            </div>
            <div className="grid g2">
              <${UI.Field} label="Intensity"><${UI.Seg} options=${['Low', 'Moderate', 'High']} value=${draft.intensity} onChange=${(x) => set({ intensity: x, plannedRPE: INTENSITY_RPE[x] })} /><//>
              <${UI.Field} label=${'Planned RPE: ' + draft.plannedRPE + ' — ' + BORG[draft.plannedRPE]} help="Borg CR-10: how hard should this feel?"><input type="range" min="1" max="10" value=${draft.plannedRPE} onChange=${(e) => set({ plannedRPE: +e.target.value })} /><//>
            </div>
          </div>
        <//>
        <${UI.Card} title="Blocks" icon="list" hint=${draft.blocks.length + ' exercises · drag order with arrows'} flush actions=${draft.blocks.length > 0 && html`<button className="btn xs ghost" onClick=${() => set({ blocks: [] })}>Clear</button>`}>
          ${draft.blocks.length === 0 ? html`<${UI.Empty} icon="dumbbell" title="No exercises yet">Pick a template above or add drills from the library on the right.<//>` : html`<div>${draft.blocks.map((b, i) => { const e = AMS.byId(db.exercises, b.exerciseId) || { name: b.exerciseId, category: '' }; return html`<div key=${b.key || b.exerciseId + i} className="trn-blk">
            <span className="trn-n">${i + 1}</span>
            <div className="col tight grow" style=${{ gap: 0 }}><span className="small" style=${{ fontWeight: 600 }}>${e.name}</span><span className="tiny faint">${e.category} · ${e.focus || ''}</span></div>
            <input className="input" style=${{ width: 110, height: 28 }} value=${b.dose || ''} onChange=${(ev) => { const bl = draft.blocks.slice(); bl[i] = Object.assign({}, b, { dose: ev.target.value }); set({ blocks: bl }); }} aria-label="Dose" />
            <div className="row tight" style=${{ gap: 2 }}>
              <button className="btn ghost xs icon" disabled=${i === 0} onClick=${() => moveBlock(i, -1)} aria-label="Move up"><${UI.Icon} name="chev-u" size=${13} /></button>
              <button className="btn ghost xs icon" disabled=${i === draft.blocks.length - 1} onClick=${() => moveBlock(i, 1)} aria-label="Move down"><${UI.Icon} name="chev-d" size=${13} /></button>
              <button className="btn ghost xs icon" onClick=${() => set({ blocks: draft.blocks.filter((_, k) => k !== i) })} aria-label="Remove"><${UI.Icon} name="trash" size=${13} /></button>
            </div>
          </div>`; })}</div>`}
        <//>
        <${UI.Card} title="Impact per athlete if they complete it" icon="users" hint=${idx >= 41 && idx <= 48 ? 'projected ACWR on ' + D.dow(draft.date) + ' ' + D.fmt(draft.date) : ''} flush>
          <${UI.Table} compact rows=${rows} maxHeight=${440} initialSort=${{ key: 'after', dir: 'desc' }} columns=${[
            { key: 'name', label: 'Athlete', render: (r) => html`<${UI.AthleteCell} athlete=${r.a} size=${26} sub=${r.a.availability + (availabilityNote(r.a) ? ' · ' + availabilityNote(r.a) : '')} />`, sort: (r) => r.a.name },
            { key: 'rd', label: 'Ready', render: (r) => html`<${UI.Ring} value=${r.r.score} tone=${r.r.band} size=${28} />`, sort: (r) => r.r.score, hideSm: true },
            { key: 'variant', label: 'Version', sort: (r) => VARIANT_ORDER.indexOf(r.variant), render: (r) => html`<div className="col tight" style=${{ gap: 2 }}><select className="select" style=${{ height: 26, fontSize: 12 }} value=${r.variant} onChange=${(e) => setMod(r.id, e.target.value === (defaultVariant(r.a) || 'none') && !draft.mods[r.id] ? null : e.target.value, 'coach')}>${VARIANT_ORDER.map((k) => html`<option key=${k} value=${k}>${VARIANTS[k].short}</option>`)}</select>${r.source && html`<span className=${'tiny ' + (r.source === 'ai' ? 'ai-c' : 'faint')}>${r.source === 'auto' ? 'Auto · ' + r.a.availability : r.source === 'ai' ? 'AI suggested' : 'Coach'}</span>`}</div>` },
            { key: 'load', label: 'Load AU', num: true, render: (r) => fmtAU(r.load), sort: (r) => r.load },
            { key: 'before', label: 'ACWR before', num: true, render: (r) => html`<${UI.AcwrPill} value=${r.before} />`, sort: (r) => r.before, hideSm: true },
            { key: 'after', label: 'After', num: true, render: (r) => html`<span className="row tight" style=${{ justifyContent: 'flex-end' }}><${UI.AcwrPill} value=${r.after} />${r.after - r.before >= 0.05 && html`<span className="tiny faint">+${(r.after - r.before).toFixed(2)}</span>`}</span>`, sort: (r) => r.after },
          ]} />
        <//>
      </div>
      <div className="col loose">
        <${UI.Card} ai title="Live load estimate" hint="sRPE = RPE × minutes">
          <div className="col">
            <div className="row between" style=${{ alignItems: 'flex-end' }}><span className="trn-big">${fmtAU(est)}<small className="faint" style=${{ fontSize: 13 }}> AU</small></span><span className="small muted">RPE ${draft.plannedRPE} × ${draft.duration} min</span></div>
            <span className="small muted">Squad total ≈ ${fmtAU(AMS.sum(rows.map((r) => r.load)))} AU across ${rows.length} athletes · ${rows.filter((r) => r.variant !== 'none').length} on an adjusted version</span>
            ${over.length > 0 ? html`<div className="col tight" style=${{ borderTop: '1px solid var(--ai-border)', paddingTop: 10 }}>
              <div className="row tight"><${UI.AIChip} label="Load-jump check" /><span className="tiny faint">${Math.round(0.8 * 100)}% confidence</span></div>
              <div className="small"><b className="bad">${over.length} athlete${over.length > 1 ? 's' : ''}</b> would be above 1.5 after this session: ${over.slice(0, 5).map((r) => firstName(r.a) + ' ' + r.after.toFixed(2)).join(', ')}${over.length > 5 ? '…' : ''}.</div>
              <${UI.Evidence} items=${over.slice(0, 3).map((r) => ({ label: firstName(r.a), value: r.before.toFixed(2) + ' → ' + r.after.toFixed(2), tone: 'bad' }))} />
              ${over.some((r) => r.before >= 1.5) && html`<span className="tiny muted">${over.filter((r) => r.before >= 1.5).map((r) => firstName(r.a)).join(', ')} ${over.filter((r) => r.before >= 1.5).length > 1 ? 'are' : 'is'} already above 1.5 from last week's loads — a lighter version limits the damage; rest removes it.</span>`}
              ${fixable.length > 0 && html`<button className="btn sm ai" onClick=${applyAI}><${UI.Icon} name="zap" size=${13} />Create ${fixable.every((r) => r.variant === 'none') ? 'reduced' : 'lighter'} variant for ${fixable.length}</button>`}
            </div>` : html`<div className="small good row tight"><${UI.Icon} name="check" size=${14} />No athlete crosses the 1.5 load-jump line with this session.</div>`}
            ${autoRows.length > 0 && html`<div className="col tight" style=${{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <span className="upper">Adjusted automatically</span>
              ${autoRows.map((r) => html`<div key=${r.id} className="row between small"><span className="ellipsis">${r.a.name}</span><span className="row tight"><span className="tiny faint">${r.a.availability}</span><${VariantPill} variant=${r.variant} /></span></div>`)}
            </div>`}
          </div>
        <//>
        <${UI.Card} title="Exercise library" icon="book" hint=${db.exercises.length + ' drills'}><${LibraryPicker} onAdd=${addEx} compact=${true} /><//>
        <${UI.Card} title="Publish" icon="send" footer=${html`<button className="btn ghost sm" onClick=${() => setDraft(newDraft(squadId))}>Discard</button><button className="btn primary" disabled=${!canPublish || problems.length > 0} onClick=${publish}><${UI.Icon} name="send" size=${14} />Publish to ${squadIds.length} squad${squadIds.length > 1 ? 's' : ''}</button>`}>
          <div className="col tight small">
            <span>${draft.title || html`<span className="faint">Untitled session</span>`} · ${D.dow(draft.date)} ${D.fmt(draft.date)} ${draft.start} · ${draft.location}</span>
            <span className="muted">Athletes get a push notification with their own version; physio is told about rehab variants; the session appears in the week plan, the dashboard and each athlete's profile.</span>
            ${problems.map((p) => html`<span key=${p} className="warn row tight"><${UI.Icon} name="alert" size=${12} />${p}</span>`)}
            ${!canPublish && html`<span className="bad">You can only publish to your own squads.</span>`}
          </div>
        <//>
      </div>
    </div>`;
  }

  /* ================================================================== EXERCISE LIBRARY */
  function LibraryTab({ setDraft, setTab }) {
    const { db, v } = AMS.useStore();
    const [q, setQ] = useState('');
    const [cat, setCat] = useState('All');
    const [form, setForm] = useState({ name: '', category: 'Strength', focus: '', dose: '3 × 8' });
    const editable = AMS.canEdit('training');
    const usage = useMemo(() => { const m = {}; db.sessions.forEach((s) => { if (D.diff(AMS.TODAY, s.date) <= 14) (s.blocks || []).forEach((b) => { m[b.exerciseId] = (m[b.exerciseId] || 0) + 1; }); }); return m; }, [v]);
    const cats = AMS.groupBy(db.exercises, 'category');
    const list = db.exercises.filter((e) => (cat === 'All' || e.category === cat) && (!q || (e.name + ' ' + e.focus + ' ' + e.category + ' ' + e.dose).toLowerCase().includes(q.toLowerCase())));
    const add = (e) => { setDraft((d) => Object.assign({}, d, { blocks: d.blocks.concat({ exerciseId: e.id, dose: e.dose, key: AMS.uid('B') }) })); AMS.toast(e.name + ' added to the session draft', 'good', { label: 'Open builder', onClick: () => setTab('builder') }); };
    return html`<div className="col loose">
      <div className="row wrap between">
        <div className="row wrap tight"><${UI.Search} value=${q} onChange=${setQ} placeholder="Search name, focus, dose…" style=${{ width: 260 }} />
          <${UI.Seg} size="sm" options=${['All'].concat(Object.keys(cats)).map((c) => ({ id: c, label: c + (c === 'All' ? ' ' + db.exercises.length : ' ' + cats[c].length) }))} value=${cat} onChange=${setCat} />
        </div>
        <span className="small faint">${list.length} shown · shared across all centres</span>
      </div>
      <div className="grid g-main">
        <div className="trn-ex-grid">
          ${list.length === 0 && html`<${UI.Empty} icon="search" title="No exercises match" />`}
          ${list.map((e) => html`<div key=${e.id} className="trn-ex sev-stripe" style=${{ borderLeftColor: typeColor({ Speed: 'Speed', Strength: 'Strength', Conditioning: 'Endurance', Plyometrics: 'Power', Mobility: 'Technical', Recovery: 'Recovery', Rehab: 'Recovery' }[e.category] || 'Tactical') }}>
            <div className="row between top"><b className="small">${e.name}</b><span className="tiny mono faint">${e.id}</span></div>
            <div className="row tight wrap"><span className="tag">${e.category}</span><span className="tag">${e.focus}</span></div>
            <div className="row between small"><span className="muted">Dose <b>${e.dose}</b></span><span className="tiny faint">${usage[e.id] ? 'in ' + usage[e.id] + ' sessions (14 d)' : 'not used lately'}</span></div>
            ${editable && html`<button className="btn sm" onClick=${() => add(e)}><${UI.Icon} name="plus" size=${13} />Add to session</button>`}
          </div>`)}
        </div>
        <div className="col loose">
          ${editable ? html`<${UI.Card} title="Add exercise" icon="plus" footer=${html`<button className="btn primary sm" disabled=${!form.name} onClick=${() => { const id = AMS.runAction('exercise.create', form); if (id) setForm({ name: '', category: form.category, focus: '', dose: '3 × 8' }); }}>Add to library</button>`}>
            <div className="col">
              <${UI.Field} label="Name"><input className="input" value=${form.name} onChange=${(e) => setForm(Object.assign({}, form, { name: e.target.value }))} placeholder="e.g. Resisted wall drill" /><//>
              <div className="grid g2 keep">
                <${UI.Field} label="Category"><${UI.Select} value=${form.category} onChange=${(x) => setForm(Object.assign({}, form, { category: x }))} options=${Object.keys(cats)} /><//>
                <${UI.Field} label="Default dose"><input className="input" value=${form.dose} onChange=${(e) => setForm(Object.assign({}, form, { dose: e.target.value }))} /><//>
              </div>
              <${UI.Field} label="Focus"><input className="input" value=${form.focus} onChange=${(e) => setForm(Object.assign({}, form, { focus: e.target.value }))} placeholder="e.g. Acceleration" /><//>
            </div>
          <//>` : html`<${LockNotice} text="The exercise library is curated by coaches. You can browse it and see where each drill is used." />`}
          <${UI.Card} title="Most used (14 days)" icon="chart">
            <${UI.HBars} data=${Object.keys(usage).sort((a, b) => usage[b] - usage[a]).slice(0, 8).map((id) => ({ label: (AMS.byId(db.exercises, id) || {}).name || id, value: usage[id], tone: 'accent', onClick: () => setQ((AMS.byId(db.exercises, id) || {}).name || '') }))} labelWidth=${150} />
          <//>
        </div>
      </div>
    </div>`;
  }

  /* ================================================================== WORKLOAD & ACWR */
  function WorkloadTab({ squadId }) {
    const { db, v } = AMS.useStore();
    const members = useMemo(() => squadMembers(squadId), [v, squadId]);
    const rows = useMemo(() => members.map((a) => {
      const L = a.loads || [];
      const r = AMS.calc.acwr(a);
      return { id: a.id, a, tw: AMS.sum(L.slice(dayIdx(WEEK_START), 42)), lw: AMS.calc.weekLoad(a, 0), acute: Math.round(AMS.mean(L.slice(34, 41))), chronic: Math.round(AMS.mean(L.slice(13, 41))), acwr: r, mono: AMS.calc.monotony(a), strain: AMS.calc.strain(a), spark: L.slice(20, 42), proj: project(a).peak.acwr };
    }), [v, squadId]);
    const [selId, setSel] = useState(null);
    const top = rows.slice().sort((x, y) => y.acwr - x.acwr)[0];
    const sel = rows.find((r) => r.id === selId) || top;
    const plan = db.plans && db.plans.squads[squadId];
    const weekly = useMemo(() => Array.from({ length: CUR_W + 1 }, (_, w) => ({ label: weekLabel(D.add(SEASON_START, 7 * w)) + (w === CUR_W ? '*' : ''), values: [targetForWeek(plan, w) || 0, weekActual(members, w) || 0] })), [v, squadId]);
    const bands = { bad: rows.filter((r) => r.acwr >= 1.5).length, warn: rows.filter((r) => r.acwr > 1.3 && r.acwr < 1.5).length, good: rows.filter((r) => r.acwr >= 0.8 && r.acwr <= 1.3).length, info: rows.filter((r) => r.acwr < 0.8).length };
    if (sel) AMS.setFocus({ athleteId: sel.id });
    return html`<div className="col loose">
      <div className="grid g4">
        <${UI.KPI} label="Load jump (≥ 1.5)" value=${bands.bad} tone=${bands.bad ? 'bad' : ''} foot=${rows.filter((r) => r.acwr >= 1.5).map((r) => firstName(r.a)).join(', ') || 'nobody'} icon="alert" />
        <${UI.KPI} label="Rising (1.3–1.5)" value=${bands.warn} tone=${bands.warn ? 'warn' : ''} foot="watch these this week" icon="trend-up" />
        <${UI.KPI} label="Sweet spot (0.8–1.3)" value=${bands.good} foot=${pct(bands.good, rows.length) + '% of squad'} icon="check" />
        <${UI.KPI} label="Under-loaded (< 0.8)" value=${bands.info} foot="returning or missed sessions" icon="trend-down" />
      </div>
      <${UI.Card} title=${'Squad workload · ' + squadLabel(squadId)} icon="pulse" hint="click a row to chart the athlete · loads in AU (RPE × min)" flush>
        <${UI.Table} compact rows=${rows} selectedId=${sel && sel.id} onRow=${(r) => setSel(r.id)} initialSort=${{ key: 'acwr', dir: 'desc' }} columns=${[
          { key: 'name', label: 'Athlete', render: (r) => html`<${UI.AthleteCell} athlete=${r.a} size=${26} sub=${r.a.availability + (r.a.availability !== 'Available' && availabilityNote(r.a) ? ' · ' + availabilityNote(r.a) : '')} />`, sort: (r) => r.a.name },
          { key: 'tw', label: 'This week', num: true, render: (r) => fmtAU(r.tw), sort: (r) => r.tw },
          { key: 'lw', label: 'Last 7 d', num: true, render: (r) => fmtAU(r.lw), sort: (r) => r.lw, hideSm: true },
          { key: 'acute', label: 'Acute /d', num: true, render: (r) => fmtAU(r.acute), sort: (r) => r.acute, hideSm: true },
          { key: 'chronic', label: 'Chronic /d', num: true, render: (r) => fmtAU(r.chronic), sort: (r) => r.chronic, hideSm: true },
          { key: 'acwr', label: 'ACWR', render: (r) => html`<span className="row tight"><${UI.AcwrPill} value=${r.acwr} /><span className="tiny faint hide-sm">${AMS.calc.acwrLabel(r.acwr)}</span></span>`, sort: (r) => r.acwr },
          { key: 'proj', label: 'Plan peak', render: (r) => html`<span title="Highest ACWR in the next 6 days if the plan runs as written"><${UI.AcwrPill} value=${r.proj} /></span>`, sort: (r) => r.proj, hideSm: true },
          { key: 'mono', label: 'Monotony', num: true, render: (r) => html`<span className=${r.mono > 2 ? 'warn' : ''}>${r.mono.toFixed(2)}</span>`, sort: (r) => r.mono, hideSm: true },
          { key: 'strain', label: 'Strain', num: true, render: (r) => fmtAU(r.strain), sort: (r) => r.strain, hideSm: true },
          { key: 'trend', label: '22-day trend', sort: false, render: (r) => html`<${UI.Sparkline} data=${r.spark} width=${90} height=${24} tone=${AMS.calc.acwrBand(r.acwr) === 'good' ? 'accent' : AMS.calc.acwrBand(r.acwr)} />`, hideSm: true },
        ]} />
      <//>
      ${sel && html`<div className="grid g2">
        <${UI.Card} title=${'ACWR · ' + sel.a.name} icon="pulse" hint="sweet spot shaded · dashed = what the current plan does" actions=${html`<button className="btn xs" onClick=${() => AMS.openAthlete(sel.id, 'training')}>Profile</button>`}>
          <${AcwrChart} athlete=${sel.a} />
          <div className="row wrap tight" style=${{ marginTop: 8 }}>
            <${UI.Evidence} items=${[{ label: 'ACWR', value: sel.acwr.toFixed(2), tone: AMS.calc.acwrBand(sel.acwr) }, { label: 'Acute', value: fmtAU(sel.acute) + ' AU/d', tone: 'warn' }, { label: 'Chronic', value: fmtAU(sel.chronic) + ' AU/d', tone: 'info' }, { label: 'Plan peak', value: sel.proj.toFixed(2), tone: AMS.calc.acwrBand(sel.proj) }]} />
          </div>
        <//>
        <${UI.Card} title="Acute vs chronic load" icon="chart" hint=${sel.a.name}>
          <${AcuteChronicChart} athlete=${sel.a} />
          <div className="small muted" style=${{ marginTop: 6 }}>${sel.acwr >= 1.5 ? firstName(sel.a) + '\'s last 7 days averaged ' + fmtAU(sel.acute) + ' AU/day against a 4-week normal of ' + fmtAU(sel.chronic) + ' — a ' + Math.round((sel.acwr - 1) * 100) + '% jump.' : sel.acwr < 0.8 ? firstName(sel.a) + ' is training well below their own normal; build back gradually (≤ 10–15% per week).' : firstName(sel.a) + ' is close to their own 4-week normal.'}</div>
        <//>
      </div>`}
      <div className="grid g-main">
        <${UI.Card} title="Weekly load — planned vs actual" icon="chart" hint="squad average per athlete · * week in progress">
          <${UI.BarChart} height=${200} data=${weekly} keys=${[{ name: 'Planned target', tone: 'var(--border-strong)' }, { name: 'Actual', tone: 'accent' }]} highlight=${CUR_W} />
        <//>
        <${AcwrExplainer} />
      </div>
    </div>`;
  }

  /* ================================================================== ATTENDANCE & RPE */
  function AttendanceTab({ squadId, squads, setSquad }) {
    const { db, v } = AMS.useStore();
    const members = useMemo(() => squadMembers(squadId), [v, squadId]);
    const sessions = useMemo(() => recentSessions(squadId, 14), [v, squadId]);
    const rows = useMemo(() => members.map((a) => ({ a, st: attendanceStats(a, sessions), rpe: (() => { let n = 0, t = 0; sessions.filter((s) => s.status === 'Completed').forEach((s) => { const at = (s.attendance || {})[a.id]; if (at === 'present' || at === 'late') { t++; if (s.rpe && s.rpe[a.id] != null) n++; } }); return t ? Math.round((n / t) * 100) : null; })() })).sort((x, y) => (x.st.pct == null ? 101 : x.st.pct) - (y.st.pct == null ? 101 : y.st.pct)), [v, squadId]);
    const squadAtt = Math.round(AMS.mean(rows.map((r) => r.st.pct).filter((x) => x != null)));
    const comp = sessions.filter((s) => s.status === 'Completed');
    const rpeCompliance = (() => { let n = 0, t = 0; comp.forEach((s) => { const st = rpeStats(s); n += st.submitted; t += st.attended; }); return t ? Math.round((n / t) * 100) : 0; })();
    const lates = AMS.sum(rows.map((r) => r.st.late));
    const outstanding = useMemo(() => outstandingRpe([squadId], 14), [v, squadId]);
    const role = AMS.ui.role;
    const editable = canEditSquad(squadId);
    const bySquad = useMemo(() => squads.length > 1 ? squads.map((id) => { const ms = squadMembers(id); const ss = recentSessions(id, 14); return { id, pct: Math.round(AMS.mean(ms.map((a) => attendanceStats(a, ss).pct).filter((x) => x != null))) }; }).sort((a, b) => a.pct - b.pct) : [], [v, squads.join(',')]);
    return html`<div className="col loose">
      <div className="grid g4">
        <${UI.KPI} label="Squad attendance (14 sessions)" value=${squadAtt} unit="%" tone=${squadAtt < 85 ? 'warn' : ''} icon="users" foot=${rows.filter((r) => r.st.pct != null && r.st.pct < 80).length + ' athletes below 80%'} />
        <${UI.KPI} label="RPE compliance" value=${rpeCompliance} unit="%" tone=${rpeCompliance < 85 ? 'warn' : ''} icon="clipboard" foot="share of attendees who rated the session" />
        <${UI.KPI} label="Outstanding RPE" value=${AMS.sum(outstanding.map((x) => x.missing.length))} icon="clock" tone=${outstanding.length ? 'warn' : ''} foot=${outstanding.length + ' session(s)'} />
        <${UI.KPI} label="Late arrivals" value=${lates} icon="alert" foot="last 14 sessions" />
      </div>
      <${UI.Card} title=${'Attendance matrix · ' + squadLabel(squadId)} icon="grid" hint="last 14 sessions · P present · L late · A absent · E excused" flush>
        <div className="tbl-wrap" style=${{ padding: '10px 12px' }}>
          <table className="trn-matrix">
            <thead><tr><th style=${{ textAlign: 'left' }}>Athlete</th>${sessions.map((s) => html`<th key=${s.id} title=${s.title + ' · ' + D.fmtLong(s.date)} style=${{ cursor: 'pointer' }} onClick=${() => AMS.runAction('session.open', { sessionId: s.id })}>${D.dow(s.date).slice(0, 2)}<br />${D.parse(s.date).getUTCDate()}</th>`)}<th>Att %</th><th>RPE %</th></tr></thead>
            <tbody>${rows.map(({ a, st, rpe }) => html`<tr key=${a.id}>
              <td className="nm"><span className="clickable small" style=${{ fontWeight: 600 }} onClick=${() => AMS.openAthlete(a.id, 'training')}>${a.name}</span></td>
              ${sessions.map((s) => { const val = (s.attendance || {})[a.id]; const r = s.rpe && s.rpe[a.id]; return html`<td key=${s.id}><${AttCell} value=${val} title=${a.name + ' · ' + s.title + ' ' + D.fmt(s.date) + ': ' + (val ? ATT[val].label : 'not marked') + (r != null ? ' · RPE ' + r : (val === 'present' || val === 'late') && s.status === 'Completed' ? ' · RPE missing' : '') + (variantOf(s, a.id) !== 'none' ? ' · ' + VARIANTS[variantOf(s, a.id)].short : '')} /></td>`; })}
              <td><span className=${'small tnum ' + (st.pct == null ? 'faint' : st.pct < 80 ? 'bad' : st.pct < 90 ? 'warn' : 'good')} style=${{ fontWeight: 600 }}>${st.pct == null ? '—' : st.pct + '%'}</span></td>
              <td><span className=${'small tnum ' + (rpe == null ? 'faint' : rpe < 70 ? 'bad' : rpe < 90 ? 'warn' : '')}>${rpe == null ? '—' : rpe + '%'}</span></td>
            </tr>`)}</tbody>
          </table>
        </div>
      <//>
      <div className="grid g-main">
        <${UI.Card} title="Outstanding RPE" icon="clipboard" hint="attended but not rated — their load is missing from ACWR" flush>
          ${outstanding.length === 0 ? html`<${UI.Empty} icon="check" title="Every attendee rated their sessions" />` : html`<div className="list">${outstanding.map((x) => html`<div key=${x.s.id} className="list-item" style=${{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div className="col tight grow" style=${{ minWidth: 200 }}>
              <div className="row tight wrap"><b className="small">${x.s.title}</b><span className="tiny faint">${D.dow(x.s.date)} ${D.fmt(x.s.date)} · ${x.s.start}</span><${UI.Pill} tone=${x.share < 0.7 ? 'bad' : 'warn'}>${x.submitted}/${x.attended} rated<//></div>
              <div className="row tight wrap">${x.missing.map((id) => { const a = AMS.org.athlete(id); return a ? html`<span key=${id} className="tag clickable" onClick=${() => AMS.openAthlete(id, 'training')}>${a.name}</span>` : null; })}</div>
              ${x.s.rpeReminded && html`<span className="tiny faint">Reminder sent ${x.s.rpeReminded.at} to ${x.s.rpeReminded.n}</span>`}
            </div>
            <div className="row tight">
              <button className="btn sm" disabled=${role === 'director'} onClick=${() => AMS.runAction('training.rpeRemind', { sessionId: x.s.id })}><${UI.Icon} name="bell" size=${13} />Send reminder</button>
              ${editable && html`<button className="btn sm primary" onClick=${() => AMS.openModal('rpe-collect', { sessionId: x.s.id })}>Enter RPE</button>`}
            </div>
          </div>`)}</div>`}
        <//>
        <div className="col loose">
          ${bySquad.length > 1 && html`<${UI.Card} title="Attendance by squad" icon="users" hint=${AMS.scopeLabel()}>
            <${UI.HBars} data=${bySquad.map((x) => ({ label: squadLabel(x.id), value: x.pct || 0, tone: x.pct < 85 ? 'warn' : x.id === squadId ? 'accent' : 'cat-2', onClick: () => setSquad(x.id) }))} max=${100} format=${(n) => n + '%'} labelWidth=${170} />
          <//>`}
          <${UI.Card} title="Lowest attendance" icon="flag">
            <div className="col tight">${rows.slice(0, 5).map(({ a, st }) => html`<div key=${a.id} className="row between small"><span className="clickable" onClick=${() => AMS.openAthlete(a.id, 'training')}>${a.name}</span><span className="row tight"><span className="tiny faint">${st.absent} absent · ${st.late} late</span><b className=${st.pct < 80 ? 'bad' : st.pct < 90 ? 'warn' : 'good'}>${st.pct == null ? '—' : st.pct + '%'}</b></span></div>`)}</div>
          <//>
        </div>
      </div>
    </div>`;
  }

  /* ================================================================== SESSION DRAWER */
  function SessionDrawer({ sessionId }) {
    const { db, v } = AMS.useStore();
    const s = AMS.byId(db.sessions, sessionId);
    if (!s) return html`<${UI.DrawerHead} title="Session not found" /><div className="drawer-b"><${UI.Empty} title="This session no longer exists" /></div>`;
    AMS.setFocus({ sessionId: s.id });
    const role = AMS.ui.role;
    const editable = canEditSquad(s.squadId);
    const members = squadMembers(s.squadId);
    const idx = dayIdx(s.date);
    const future = s.status !== 'Completed' && idx >= 41 && idx <= 48;
    const roster = members.map((a) => {
      const r = AMS.calc.readiness(a);
      const variant = variantOf(s, a.id);
      const proj = future ? acwrAt(extLoads(a), idx) : null;
      const load = s.loadRecorded && s.loadRecorded[a.id] != null ? s.loadRecorded[a.id] : (s.rpe && s.rpe[a.id] != null ? Math.round(s.rpe[a.id] * s.duration * VARIANTS[variant].scale) : null);
      return { id: a.id, a, r, variant, mod: (s.mods || {})[a.id], att: (s.attendance || {})[a.id], rpe: s.rpe ? s.rpe[a.id] : null, proj, load };
    });
    const needsAuto = members.filter((a) => defaultVariant(a) && !(s.mods || {})[a.id]);
    const reds = roster.filter((x) => x.r.band === 'bad' && x.variant === 'none' && s.status !== 'Completed');
    const st = rpeStats(s);
    const unmarked = roster.filter((x) => !x.att).length;
    const recording = (s.recording || []).length;
    const liveMin = s.status === 'Live' && s.startedAt ? Math.max(0, toMin(AMS.clockTime()) - toMin(s.startedAt)) : 0;
    const counts = { present: 0, late: 0, absent: 0, excused: 0 };
    roster.forEach((x) => { if (x.att) counts[x.att]++; });
    const futureDays = D.range(AMS.TODAY, 8).filter((d) => d !== s.date);
    const devices = AMS.groupBy(members.filter((a) => (s.recording || []).includes(a.id)).flatMap((a) => a.devices), (d) => d);
    const stepIdx = s.status === 'Planned' ? 0 : s.status === 'Live' ? 1 : 3;
    const doneLoads = roster.map((x) => x.load).filter((x) => x != null);
    const flaggedAfter = s.status === 'Completed' && idx >= 40 ? roster.filter((x) => acwrAt(extLoads(x.a), Math.min(Math.max(idx, 40), 41)) >= 1.5) : [];
    return html`<${React.Fragment}>
      <${UI.DrawerHead} title=${s.title} sub=${squadLabel(s.squadId) + ' · ' + D.fmtLong(s.date) + ' · ' + s.start + '–' + endTime(s) + ' · ' + s.location}
        avatar=${html`<span style=${{ width: 38, height: 38, borderRadius: 8, background: 'color-mix(in srgb, ' + typeColor(s.type) + ' 16%, transparent)', color: typeColor(s.type), display: 'grid', placeItems: 'center', flex: 'none' }}><${UI.Icon} name="whistle" size=${19} /></span>`}
        actions=${html`<${StatusPill} s=${s} />`} />
      <div className="drawer-b">
        <${UI.Stepper} steps=${[{ label: 'Planned', sub: s.createdBy ? 'by ' + s.createdBy : 'week 42 plan' }, { label: 'Live', sub: s.startedAt ? 'started ' + s.startedAt : 'attendance + devices' }, { label: 'Completed', sub: s.completedAt ? 'RPE ' + st.submitted + '/' + st.attended : 'RPE → load' }]} current=${stepIdx} />
        ${!editable && html`<${LockNotice} text=${editReason(s.squadId)} />`}
        <div className="grid g4 keep">
          <div className="col tight" style=${{ gap: 0 }}><span className="upper">Type</span><span className="row tight"><span className="dot" style=${{ background: typeColor(s.type) }} /><b>${s.type}</b></span></div>
          <div className="col tight" style=${{ gap: 0 }}><span className="upper">Intensity</span><${UI.Pill} tone=${INT_TONE[s.intensity]}>${s.intensity}<//></div>
          <div className="col tight" style=${{ gap: 0 }}><span className="upper">Planned RPE × min</span><b className="tnum">${sessRPE(s)} × ${s.duration} = ${fmtAU(sessLoad(s))} AU</b></div>
          <div className="col tight" style=${{ gap: 0 }}><span className="upper">${s.status === 'Completed' ? 'Avg recorded load' : 'Adjusted versions'}</span><b className="tnum">${s.status === 'Completed' ? (doneLoads.length ? fmtAU(AMS.mean(doneLoads)) + ' AU' : '—') : Object.keys(s.mods || {}).length}</b></div>
        </div>
        ${s.status === 'Live' && html`<div className="ai-box" style=${{ background: 'var(--good-weak)', borderColor: 'color-mix(in srgb, var(--good) 35%, transparent)' }}>
          <div className="row wrap between"><span className="trn-rec"><span className="live-dot" />LIVE · ${liveMin} min · ${recording} athletes streaming</span><span className="small muted">${Object.keys(devices).map((d) => d + ' ×' + devices[d].length).join(' · ') || 'No wearables assigned'}</span></div>
          <div className="small muted" style=${{ marginTop: 4 }}>Attendance: ${counts.present} present · ${counts.late} late · ${counts.absent} absent · ${counts.excused} excused · ${unmarked} not marked</div>
        </div>`}
        ${s.status !== 'Completed' && (reds.length > 0 || needsAuto.length > 0) && html`<div className="ai-box">
          <div className="row tight" style=${{ marginBottom: 6 }}><${UI.AIChip} label="Pre-session check" /><span className="tiny faint">readiness + ACWR + availability</span></div>
          <div className="col tight">
            ${reds.map((x) => { const sug = suggestVariant(x.a, x.r) || 'recovery'; return html`<div key=${x.id} className="row between wrap small" style=${{ gap: 8 }}>
              <span><b>${x.a.name}</b> is red (${x.r.score}) — ${x.r.factors.slice(0, 3).map((f) => f.label.toLowerCase() + ' ' + f.value).join(', ')}</span>
              ${editable ? html`<button className="btn xs ai" onClick=${() => AMS.runAction('session.modifyForAthlete', { athleteId: x.id, sessionId: s.id, variant: sug })}><${UI.Icon} name="zap" size=${12} />Switch to ${VARIANTS[sug].short.toLowerCase()}</button>` : ['physio', 'scientist', 'doctor'].includes(role) && html`<button className="btn xs" onClick=${() => AMS.runAction('notify', { toRole: 'coach', athleteId: x.id, text: 'Recommend ' + VARIANTS[sug].label.toLowerCase() + ' for ' + x.a.name + ' in ' + s.title + '.' })}>Recommend to coach</button>`}
            </div>`; })}
            ${needsAuto.length > 0 && html`<div className="row between wrap small" style=${{ gap: 8 }}><span>${needsAuto.length} Modified / Unavailable athlete${needsAuto.length > 1 ? 's have' : ' has'} no adjusted version: ${needsAuto.map((a) => firstName(a) + ' → ' + VARIANTS[defaultVariant(a)].short.toLowerCase()).join(', ')}</span>${editable && html`<button className="btn xs ai" onClick=${() => AMS.runAction('session.applyVariants', { sessionId: s.id })}>Apply automatically</button>`}</div>`}
          </div>
        </div>`}
        ${s.status === 'Completed' && html`<div className="ai-box">
          <div className="row tight" style=${{ marginBottom: 6 }}><${UI.AIChip} label="Session summary" /></div>
          <div className="small">${st.submitted}/${st.attended} athletes rated (${Math.round(st.share * 100)}%)${doneLoads.length ? ', average RPE ' + AMS.round(AMS.mean(roster.map((x) => x.rpe).filter((x) => x != null)), 1) + ' vs planned ' + sessRPE(s) + ', average load ' + fmtAU(AMS.mean(doneLoads)) + ' AU' : ''}.${flaggedAfter.length ? ' Load jump after this session: ' + flaggedAfter.map((x) => firstName(x.a)).join(', ') + '.' : ' Nobody crossed 1.5.'}${st.missing.length ? ' Missing: ' + st.missing.map((id) => firstName(AMS.org.athlete(id))).join(', ') + '.' : ''}</div>
        </div>`}
        <${UI.Card} title="Blocks" icon="list" hint=${(s.blocks || []).length + ' exercises'} flush>
          <div>${(s.blocks || []).map((b, i) => { const e = AMS.byId(db.exercises, b.exerciseId) || { name: b.exerciseId }; return html`<div key=${i} className="trn-blk"><span className="trn-n">${i + 1}</span><div className="col tight grow" style=${{ gap: 0 }}><span className="small" style=${{ fontWeight: 600 }}>${e.name}</span><span className="tiny faint">${e.category || ''} · ${e.focus || ''}</span></div><span className="small mono">${b.dose || e.dose}</span></div>`; })}</div>
        <//>
        <${UI.Card} title="Roster" icon="users" hint=${members.length + ' athletes · per-athlete version'} flush actions=${editable && s.status === 'Live' && unmarked > 0 && html`<button className="btn xs" onClick=${() => AMS.runAction('session.markAttendance', { sessionId: s.id, all: true })}><${UI.Icon} name="check" size=${12} />Mark all present</button>`}>
          <${UI.Table} compact rows=${roster} columns=${[
            { key: 'name', label: 'Athlete', render: (x) => html`<${UI.AthleteCell} athlete=${x.a} size=${26} sub=${x.a.availability + (availabilityNote(x.a) ? ' · ' + availabilityNote(x.a) : '')} />`, sort: (x) => x.a.name },
            { key: 'rd', label: 'Ready', render: (x) => html`<${UI.Ring} value=${x.r.score} tone=${x.r.band} size=${28} />`, sort: (x) => x.r.score, hideSm: true },
            { key: 'variant', label: 'Version', sort: (x) => VARIANT_ORDER.indexOf(x.variant), render: (x) => editable && s.status !== 'Completed'
              ? html`<select className="select" style=${{ height: 26, fontSize: 12 }} value=${x.variant} onClick=${(e) => e.stopPropagation()} onChange=${(e) => AMS.runAction('training.setVariant', { sessionId: s.id, athleteId: x.id, variant: e.target.value })}>${VARIANT_ORDER.map((k) => html`<option key=${k} value=${k}>${VARIANTS[k].short}</option>`)}</select>`
              : html`<${VariantPill} variant=${x.variant} source=${x.mod && x.mod.source} />` },
            s.status !== 'Planned' && { key: 'att', label: 'Attendance', sort: (x) => x.att || '', render: (x) => editable && s.status === 'Live'
              ? html`<span className="trn-att">${Object.keys(ATT).map((k) => html`<button key=${k} className=${AMS.cx(k, x.att === k && 'on')} title=${ATT[k].label} onClick=${() => AMS.runAction('session.markAttendance', { sessionId: s.id, athleteId: x.id, value: x.att === k ? null : k })}>${ATT[k].short}</button>`)}</span>`
              : x.att ? html`<${UI.Pill} tone=${ATT[x.att].tone}>${ATT[x.att].label}<//>` : html`<span className="faint small">—</span>` },
            s.status === 'Live' && { key: 'dev', label: 'Device', sort: false, hideSm: true, render: (x) => (s.recording || []).includes(x.id) ? html`<span className="trn-rec" title=${x.a.devices.join(', ')}><span className="live-dot" />Recording</span>` : html`<span className="tiny faint">${x.a.devices.length ? 'idle' : 'none'}</span>` },
            s.status !== 'Planned' && { key: 'rpe', label: 'RPE', num: true, sort: (x) => x.rpe == null ? -1 : x.rpe, render: (x) => x.rpe != null ? html`<span title=${BORG[x.rpe] + ((s.rpeApp || {})[x.id] ? ' · from app ' + s.rpeApp[x.id] : '') + ((s.imputed || {})[x.id] ? ' · imputed from plan' : '')}><b>${x.rpe}</b>${(s.imputed || {})[x.id] ? html`<span className="tiny faint">*</span>` : null}</span>` : (x.att === 'present' || x.att === 'late') && s.status === 'Completed' ? html`<span className="tiny warn">missing</span>` : html`<span className="faint">—</span>` },
            s.status === 'Completed' && { key: 'load', label: 'Load AU', num: true, sort: (x) => x.load || 0, render: (x) => fmtAU(x.load) },
            future && { key: 'proj', label: 'ACWR after', num: true, sort: (x) => x.proj || 0, hideSm: true, render: (x) => html`<${UI.AcwrPill} value=${x.proj} />` },
          ].filter(Boolean)} />
        <//>
        ${s.notes && html`<div className="small muted">Notes: ${s.notes}</div>`}
      </div>
      <div className="drawer-f">
        ${editable ? html`<${React.Fragment}>
          ${s.status !== 'Completed' && html`<${UI.Menu} align="left" items=${futureDays.map((d) => ({ label: 'Duplicate to ' + D.dow(d) + ' ' + D.fmt(d), icon: 'copy', onClick: () => AMS.runAction('session.duplicate', { sessionId: s.id, date: d }) })).concat(s.status === 'Planned' && s.date >= AMS.TODAY ? futureDays.map((d) => ({ label: 'Move to ' + D.dow(d) + ' ' + D.fmt(d), icon: 'arrow-r', onClick: () => AMS.runAction('session.move', { sessionId: s.id, date: d }) })) : [])} trigger=${html`<button className="btn">Duplicate / move<${UI.Icon} name="chev-d" size=${13} /></button>`} />`}
          ${s.status === 'Planned' && html`<button className="btn primary" onClick=${() => AMS.runAction('session.start', { sessionId: s.id })}><${UI.Icon} name="play" size=${14} />Start session</button>`}
          ${s.status === 'Live' && html`<button className="btn" onClick=${() => AMS.runAction('session.simulateRpe', { sessionId: s.id })}><${UI.Icon} name="phone" size=${14} />Simulate app RPE</button>`}
          ${s.status === 'Live' && html`<button className="btn primary" onClick=${() => AMS.openModal('rpe-collect', { sessionId: s.id })}><${UI.Icon} name="check" size=${14} />Complete & collect RPE</button>`}
          ${s.status === 'Completed' && st.missing.length > 0 && html`<button className="btn" onClick=${() => AMS.runAction('training.rpeRemind', { sessionId: s.id })}><${UI.Icon} name="bell" size=${14} />Remind ${st.missing.length}</button>`}
          ${s.status === 'Completed' && html`<button className="btn primary" onClick=${() => AMS.openModal('rpe-collect', { sessionId: s.id })}>${st.missing.length ? 'Enter missing RPE (' + st.missing.length + ')' : 'Edit RPE'}</button>`}
        <//>` : html`<${React.Fragment}>
          <span className="small faint row tight" style=${{ marginRight: 'auto' }}><${UI.Icon} name="lock" size=${13} />View only</span>
          ${['physio', 'scientist', 'doctor', 'nutritionist'].includes(role) && html`<button className="btn" onClick=${() => AMS.runAction('notify', { toRole: 'coach', text: 'Question about ' + s.title + ' (' + D.fmt(s.date) + ', ' + squadLabel(s.squadId) + ') from the ' + AMS.roleLabel(role).toLowerCase() + '.' })}><${UI.Icon} name="message" size=${14} />Message coach</button>`}
        <//>`}
      </div>
    <//>`;
  }

  /* ================================================================== RPE COLLECTION MODAL */
  function RpeModal({ sessionId }) {
    const { db, v } = AMS.useStore();
    const s = AMS.byId(db.sessions, sessionId);
    const [vals, setVals] = useState(() => Object.assign({}, (s && s.rpe) || {}));
    const [impute, setImpute] = useState(false);
    const [done, setDone] = useState(false);
    const appKeys = s ? Object.keys(s.rpe || {}).join(',') : '';
    useEffect(() => { if (s) setVals((prev) => Object.assign({}, s.rpe || {}, prev)); }, [appKeys]);
    if (!s) return html`<${UI.ModalFrame} title="Session not found">This session no longer exists.<//>`;
    const editable = canEditSquad(s.squadId);
    const members = squadMembers(s.squadId);
    const roster = members.filter((a) => { const att = (s.attendance || {})[a.id]; return att !== 'absent' && att !== 'excused' && variantOf(s, a.id) !== 'excluded'; });
    const entered = roster.filter((a) => vals[a.id] != null).length;
    const zone = (n) => (n <= 3 ? 'z1' : n <= 6 ? 'z2' : 'z3');
    const save = () => { AMS.runAction('session.complete', { sessionId: s.id, rpe: vals, impute }); setDone(true); };
    if (done) {
      const idx = dayIdx(s.date);
      const rec = s.loadRecorded || {};
      const loads = roster.map((a) => ({ a, load: rec[a.id], rpe: s.rpe[a.id], acwr: acwrAt(extLoads(a), Math.min(Math.max(idx, 40), 41)) }));
      const got = loads.filter((x) => x.load != null);
      const flagged = loads.filter((x) => x.acwr >= 1.5).sort((x, y) => y.acwr - x.acwr);
      return html`<${UI.ModalFrame} title=${'Session load recorded · ' + s.title} sub=${squadLabel(s.squadId) + ' · ' + D.fmtLong(s.date)} icon="check" wide
        footer=${html`<button className="btn" onClick=${() => { AMS.closeModal(); AMS.go('training', { tab: 'workload', squadId: s.squadId }); }}>Open workload & ACWR</button><button className="btn primary" onClick=${AMS.closeModal}>Done</button>`}>
        <div className="grid g4 keep">
          <${UI.KPI} label="Rated" value=${got.length + '/' + roster.length} foot=${s.imputed && Object.keys(s.imputed).length ? Object.keys(s.imputed).length + ' imputed from plan' : 'session RPE'} />
          <${UI.KPI} label="Avg RPE" value=${AMS.round(AMS.mean(got.map((x) => x.rpe)), 1)} foot=${'planned ' + sessRPE(s)} />
          <${UI.KPI} label="Avg load" value=${fmtAU(AMS.mean(got.map((x) => x.load)))} unit="AU" foot="RPE × min × version" />
          <${UI.KPI} label="Load jump" value=${flagged.length} tone=${flagged.length ? 'bad' : ''} foot=${idx >= 41 ? 'ACWR from tomorrow' : 'ACWR now'} />
        </div>
        <div className="ai-box small">
          <div className="row tight" style=${{ marginBottom: 4 }}><${UI.AIChip} label="What changed" /></div>
          Loads are now in every athlete's record — the dashboard, Sports Science, each profile and the copilot use them.
          ${flagged.length ? html` <b className="bad">${flagged.map((x) => x.a.name + ' (' + x.acwr.toFixed(2) + ')').join(', ')}</b> ${flagged.length > 1 ? 'are' : 'is'} above 1.5 — plan a lighter day tomorrow.` : ' Nobody in this session is above the 1.5 load-jump line.'}
        </div>
        <${UI.Table} compact rows=${loads.map((x) => Object.assign({ id: x.a.id }, x))} initialSort=${{ key: 'load', dir: 'desc' }} columns=${[
          { key: 'name', label: 'Athlete', render: (x) => x.a.name, sort: (x) => x.a.name },
          { key: 'v', label: 'Version', render: (x) => html`<${VariantPill} variant=${variantOf(s, x.a.id)} />`, sort: false },
          { key: 'rpe', label: 'RPE', num: true, render: (x) => (x.rpe == null ? html`<span className="warn">missing</span>` : x.rpe), sort: (x) => x.rpe || 0 },
          { key: 'load', label: 'Load AU', num: true, render: (x) => fmtAU(x.load), sort: (x) => x.load || 0 },
          { key: 'acwr', label: 'ACWR', num: true, render: (x) => html`<${UI.AcwrPill} value=${x.acwr} />`, sort: (x) => x.acwr },
        ]} />
      <//>`;
    }
    return html`<${UI.ModalFrame} title=${'Collect session RPE · ' + s.title} sub=${squadLabel(s.squadId) + ' · ' + D.fmtLong(s.date) + ' · ' + s.duration + ' min · planned RPE ' + sessRPE(s)} icon="clipboard" wide
      footer=${html`<span className="small muted" style=${{ marginRight: 'auto' }}>${entered}/${roster.length} entered${roster.length - entered > 0 ? ' · ' + (roster.length - entered) + ' missing' : ''}</span>
        <button className="btn" onClick=${AMS.closeModal}>Cancel</button>
        <button className="btn primary" disabled=${!editable || (entered === 0 && !impute)} onClick=${save}><${UI.Icon} name="check" size=${14} />${s.status === 'Completed' ? 'Save RPE' : 'Save & complete session'}</button>`}>
      ${!editable && html`<${LockNotice} text=${editReason(s.squadId)} />`}
      <div className="row wrap between" style=${{ gap: 8 }}>
        <span className="small muted">Borg CR-10: "How hard was the whole session?" asked ~30 min after. Load = RPE × ${s.duration} min (scaled for adjusted versions).</span>
        <div className="row tight">
          ${editable && html`<button className="btn sm" onClick=${() => AMS.runAction('session.simulateRpe', { sessionId: s.id })}><${UI.Icon} name="phone" size=${13} />Simulate athlete submissions</button>`}
          ${editable && html`<button className="btn sm ghost" onClick=${() => { const n = {}; roster.forEach((a) => { if (vals[a.id] == null) n[a.id] = Math.max(1, sessRPE(s) + (variantOf(s, a.id) === 'none' ? 0 : -3)); }); setVals(Object.assign({}, vals, n)); }}>Fill gaps with planned</button>`}
        </div>
      </div>
      <div className="list" style=${{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
        ${roster.map((a) => { const val = vals[a.id]; const fromApp = (s.rpeApp || {})[a.id] || (s.rpe && s.rpe[a.id] != null && vals[a.id] === s.rpe[a.id]); const vr = variantOf(s, a.id); return html`<div key=${a.id} className="list-item" style=${{ flexWrap: 'wrap', gap: 8, padding: '8px 12px' }}>
          <div className="col tight" style=${{ gap: 0, minWidth: 150, flex: '1 1 150px' }}><b className="small">${a.name}</b><span className="tiny faint">${vr !== 'none' ? VARIANTS[vr].label : 'Full session'}${fromApp && val != null ? ' · from app' + ((s.rpeApp || {})[a.id] ? ' ' + s.rpeApp[a.id] : '') : ''}</span></div>
          <div className="trn-rpe">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => html`<button key=${n} className=${AMS.cx(zone(n), val === n && 'on')} title=${n + ' — ' + BORG[n]} disabled=${!editable} onClick=${() => setVals(Object.assign({}, vals, { [a.id]: val === n ? null : n }))}>${n}</button>`)}</div>
          <span className="tiny muted" style=${{ width: 100, textAlign: 'right' }}>${val != null ? BORG[val] + ' · ' + fmtAU(val * s.duration * VARIANTS[vr].scale) + ' AU' : html`<span className="warn">not rated</span>`}</span>
        </div>`; })}
        ${roster.length === 0 && html`<${UI.Empty} title="Nobody to rate — everyone was absent or excused" />`}
      </div>
      ${editable && roster.length - entered > 0 && html`<${UI.Toggle} id="trn-impute" checked=${impute} onChange=${setImpute} label=${'Impute planned RPE (' + sessRPE(s) + ') for the ' + (roster.length - entered) + ' who did not rate — marked with * so analysts can exclude them'} />`}
    <//>`;
  }

  /* ================================================================== ATHLETE PROFILE TAB */
  function AthleteTrainingTab({ athlete }) {
    const { db, v } = AMS.useStore();
    const a = athlete;
    if (!a) return null;
    const sq = homeSquadId(a);
    const L = a.loads || [];
    const r = AMS.calc.acwr(a);
    const p = useMemo(() => project(a), [v, a.id]);
    const thisWeek = db.sessions.filter((s) => s.squadId === sq && s.date >= WEEK_START && s.date <= D.add(WEEK_START, 6)).sort((x, y) => x.date.localeCompare(y.date));
    const history = recentSessions(sq, 14).slice().reverse();
    const st = attendanceStats(a, recentSessions(sq, 14));
    const rpeN = history.filter((s) => s.status === 'Completed' && ['present', 'late'].includes((s.attendance || {})[a.id])).length;
    const rpeGot = history.filter((s) => s.status === 'Completed' && s.rpe && s.rpe[a.id] != null && ['present', 'late'].includes((s.attendance || {})[a.id])).length;
    return html`<div className="col loose">
      <div className="grid g4 keep">
        <${UI.KPI} label="ACWR" value=${r.toFixed(2)} tone=${AMS.calc.acwrBand(r) === 'good' ? '' : AMS.calc.acwrBand(r)} foot=${AMS.calc.acwrLabel(r)} />
        <${UI.KPI} label="Last 7 days" value=${fmtAU(AMS.calc.weekLoad(a, 0))} unit="AU" foot=${'prev ' + fmtAU(AMS.calc.weekLoad(a, 1))} />
        <${UI.KPI} label="Attendance" value=${st.pct == null ? '—' : st.pct} unit=${st.pct == null ? '' : '%'} tone=${st.pct != null && st.pct < 80 ? 'bad' : ''} foot=${st.attended + '/' + st.total + ' sessions'} />
        <${UI.KPI} label="RPE logged" value=${pct(rpeGot, rpeN)} unit="%" foot=${rpeGot + '/' + rpeN + ' sessions'} />
      </div>
      <${UI.Card} title="Daily training load · 42 days" icon="chart" hint="sRPE (RPE × minutes), AU">
        <${UI.BarChart} height=${170} data=${L.map((x, i) => ({ label: D.fmt(AMS.series.loadDate(i)), value: x || 0, tone: i === 41 ? 'accent' : i >= 34 ? (r >= 1.5 ? 'bad' : 'cat-1') : 'var(--fg-3)' }))} highlight=${41} />
      <//>
      <${UI.Card} title="ACWR — this athlete vs their own normal" icon="pulse" hint=${'plan peak next 6 days: ' + p.peak.acwr.toFixed(2)}>
        <${AcwrChart} athlete=${a} height=${180} />
      <//>
      <${UI.Card} title="This week's sessions" icon="calendar" hint=${'W42 · ' + squadLabel(sq)} flush>
        ${thisWeek.length === 0 ? html`<${UI.Empty} title="No sessions this week" />` : html`<div className="list">${thisWeek.map((s) => { const vr = variantOf(s, a.id); return html`<div key=${s.id} className="list-item clickable" onClick=${() => AMS.runAction('session.open', { sessionId: s.id })}>
          <span className="tiny mono" style=${{ width: 74 }}>${D.dow(s.date)} ${D.fmt(s.date)}</span>
          <span className="dot" style=${{ background: typeColor(s.type) }} />
          <div className="col tight grow" style=${{ gap: 0 }}><b className="small">${s.title}</b><span className="tiny faint">${s.start} · ${s.duration} min · ${s.intensity}</span></div>
          ${vr !== 'none' ? html`<${VariantPill} variant=${vr} source=${(s.mods[a.id] || {}).source} />` : null}
          <span className="tiny tnum faint">${s.status === 'Completed' && s.rpe && s.rpe[a.id] != null ? 'RPE ' + s.rpe[a.id] : fmtAU(plannedLoad(s, a.id)) + ' AU'}</span>
          <${StatusPill} s=${s} />
        </div>`; })}</div>`}
      <//>
      <${UI.Card} title="Session history" icon="clock" hint="last 14 sessions" flush>
        <${UI.Table} compact rows=${history} onRow=${(s) => AMS.runAction('session.open', { sessionId: s.id })} columns=${[
          { key: 'date', label: 'Date', render: (s) => D.dow(s.date) + ' ' + D.fmt(s.date), sort: (s) => s.date },
          { key: 'title', label: 'Session', render: (s) => html`<span className="row tight"><span className="dot" style=${{ background: typeColor(s.type) }} />${s.title}</span>`, sort: (s) => s.title },
          { key: 'att', label: 'Attendance', render: (s) => { const x = (s.attendance || {})[a.id]; return x ? html`<${UI.Pill} tone=${ATT[x].tone}>${ATT[x].label}<//>` : html`<span className="faint">—</span>`; }, sort: (s) => (s.attendance || {})[a.id] || '' },
          { key: 'ver', label: 'Version', render: (s) => html`<${VariantPill} variant=${variantOf(s, a.id)} />`, sort: false, hideSm: true },
          { key: 'rpe', label: 'RPE', num: true, render: (s) => (s.rpe && s.rpe[a.id] != null ? s.rpe[a.id] : ['present', 'late'].includes((s.attendance || {})[a.id]) && s.status === 'Completed' ? html`<span className="warn tiny">missing</span>` : '—'), sort: (s) => (s.rpe && s.rpe[a.id]) || 0 },
          { key: 'load', label: 'Load AU', num: true, render: (s) => { const i = dayIdx(s.date); const x = (s.loadRecorded || {})[a.id]; return fmtAU(x != null ? x : i >= 0 && i <= 41 && L[i] ? L[i] : null); }, sort: (s) => { const i = dayIdx(s.date); return (i >= 0 && L[i]) || 0; } },
        ]} />
      <//>
    </div>`;
  }

  /* ================================================================== PAGE */
  let DRAFT = null;
  function Page({ params }) {
    const { db, ui, v } = AMS.useStore();
    params = params || {};
    const role = ui.role;
    const squads = useMemo(() => scopedSquadIds(), [v, role, JSON.stringify(ui.scope)]);
    const [pref, setPref] = UI.useLocal('trn.squad.' + role, null);
    useEffect(() => { if (params.squadId) setPref(params.squadId); }, [params.squadId]);
    const squadId = params.squadId && squads.includes(params.squadId) && pref == null ? params.squadId : (pref && squads.includes(pref) ? pref : defaultSquad(squads));
    const [tab, setTab] = useState(params.tab || 'today');
    useEffect(() => { if (params.tab) setTab(params.tab); }, [params.tab]);
    useEffect(() => { if (params.sessionId) AMS.openDrawer('session', { sessionId: params.sessionId }); }, [params.sessionId]);
    const [draft, setDraftState] = useState(() => DRAFT || newDraft(squadId));
    const setDraft = (fn) => setDraftState((prev) => { const next = typeof fn === 'function' ? fn(prev) : fn; DRAFT = next; return next; });
    const members = useMemo(() => (squadId ? squadMembers(squadId) : []), [v, squadId]);
    const plan = squadId && db.plans ? db.plans.squads[squadId] : null;
    const meso = plan ? mesoAt(plan, CUR_W) : null;
    if (!squadId) return html`<div className="page"><${UI.PageHead} title="Training & Periodisation" /><${UI.Empty} icon="calendar" title="No squads in the current scope">Widen the organisation filter in the top bar.<//></div>`;
    const todayCount = db.sessions.filter((s) => s.date === AMS.TODAY && squads.includes(s.squadId)).length;
    const outN = AMS.sum(outstandingRpe([squadId], 14).map((x) => x.missing.length));
    const jumps = members.filter((a) => AMS.calc.acwr(a) >= 1.5).length;
    const editable = canEditSquad(squadId);
    const setSquad = (id) => setPref(id);
    const tabs = [
      { id: 'today', label: 'Today', icon: 'whistle', count: todayCount },
      { id: 'plan', label: 'Season plan', icon: 'layers' },
      { id: 'week', label: 'Week', icon: 'calendar' },
      { id: 'builder', label: 'Session builder', icon: 'edit' },
      { id: 'library', label: 'Exercise library', icon: 'book', count: db.exercises.length },
      { id: 'workload', label: 'Workload & ACWR', icon: 'pulse', count: jumps || null },
      { id: 'attendance', label: 'Attendance & RPE', icon: 'clipboard', count: outN || null },
    ];
    const sub = squadLabel(squadId) + ' · ' + weekLabel(WEEK_START) + ' (12–18 Oct)' + (meso ? ' · ' + meso.phase + ': ' + meso.focus + ', week ' + (CUR_W - meso.startWeek + 1) + ' of ' + meso.weeks : '');
    const props = { squadId, squads, setSquad, setTab, draft, setDraft };
    return html`<div className="page">
      <${UI.PageHead} title="Training & Periodisation" sub=${sub}
        actions=${html`${squads.length > 1 ? html`<${UI.Select} value=${squadId} onChange=${setSquad} options=${squads.map((id) => ({ value: id, label: squadLabel(id) }))} style=${{ maxWidth: 290 }} />` : html`<${UI.Pill} tone="accent">${squadLabel(squadId)}<//>`}
          ${editable && html`<button className="btn primary" onClick=${() => setTab('builder')}><${UI.Icon} name="plus" size=${14} />New session</button>`}`} />
      ${!AMS.canEdit('training') && tab !== 'builder' && html`<${LockNotice} text=${editReason(squadId)} />`}
      <${UI.Tabs} tabs=${tabs} value=${tab} onChange=${setTab} />
      ${tab === 'today' && html`<${TodayTab} ...${props} />`}
      ${tab === 'plan' && html`<${PlanTab} ...${props} />`}
      ${tab === 'week' && html`<${WeekTab} ...${props} />`}
      ${tab === 'builder' && html`<${BuilderTab} ...${props} />`}
      ${tab === 'library' && html`<${LibraryTab} ...${props} />`}
      ${tab === 'workload' && html`<${WorkloadTab} ...${props} />`}
      ${tab === 'attendance' && html`<${AttendanceTab} ...${props} />`}
    </div>`;
  }

  /* ================================================================== registration */
  const sampleSession = (date, squadId) => { const s = AMS.db && AMS.db.sessions.find((x) => x.date === (date || AMS.TODAY) && x.squadId === (squadId || 'SQ-PUN-SPR17')); return s ? s.id : (AMS.db && AMS.db.sessions[0] ? AMS.db.sessions[0].id : 'none'); };
  AMS.registerModule({
    id: 'training', label: 'Training & Periodisation', icon: 'calendar', group: 'performance', order: 3,
    roles: ['director', 'coach', 'physio', 'doctor', 'scientist', 'nutritionist'], component: Page, short: 'Training',
    badge: () => {
      try {
        const ids = new Set(scopedSquadIds());
        let n = 0;
        AMS.db.sessions.forEach((s) => { if (s.date !== AMS.TODAY || !ids.has(s.squadId) || s.status === 'Completed') return; squadMembers(s.squadId).forEach((a) => { if (!(s.mods || {})[a.id] && AMS.calc.readiness(a).band === 'bad') n++; }); });
        return n ? { n, tone: 'bad' } : null;
      } catch (e) { return null; }
    },
    sampleParams: [{}, { tab: 'plan' }, { tab: 'week' }, { tab: 'builder' }, { tab: 'library' }, { tab: 'workload' }, { tab: 'attendance' }, { tab: 'week', squadId: 'SQ-PUN-SPR20' }],
  });
  AMS.registerDrawer('session', SessionDrawer, { wide: true, sample: () => [{ sessionId: sampleSession() }, { sessionId: sampleSession(D.add(AMS.TODAY, -1)) }, { sessionId: sampleSession(D.add(AMS.TODAY, 2), 'SQ-PUN-SPR20') }] });
  AMS.registerModal('rpe-collect', RpeModal, { sample: () => [{ sessionId: sampleSession() }, { sessionId: sampleSession(D.add(AMS.TODAY, -1)) }] });
  AMS.registerAthleteTab({ id: 'training', label: 'Training', order: 20, roles: ['director', 'coach', 'physio', 'doctor', 'scientist', 'nutritionist', 'athlete'], component: AthleteTrainingTab });

  AMS.registerCommand({ id: 'training.new', label: 'New training session', group: 'Training', icon: 'plus', keywords: 'create session build plan workout', roles: ['coach'], run: () => AMS.go('training', { tab: 'builder' }) });
  AMS.registerCommand({
    id: 'training.collectRpe', label: 'Collect RPE', group: 'Training', icon: 'clipboard', keywords: 'rpe effort rating session load complete', roles: ['coach'],
    run: () => {
      const ids = scopedSquadIds();
      const live = AMS.db.sessions.find((s) => s.date === AMS.TODAY && s.status === 'Live' && ids.includes(s.squadId));
      const out = outstandingRpe(ids, 3)[0];
      const today = AMS.db.sessions.find((s) => s.date === AMS.TODAY && ids.includes(s.squadId) && s.status !== 'Completed');
      const s = live || (out && out.s) || today;
      if (s) AMS.openModal('rpe-collect', { sessionId: s.id }); else AMS.go('training', { tab: 'attendance' });
    },
  });
  AMS.registerCommand({ id: 'training.week', label: 'Open this week\'s training plan', group: 'Training', icon: 'calendar', keywords: 'microcycle week plan calendar', roles: ['director', 'coach', 'physio', 'doctor', 'scientist', 'nutritionist'], run: () => AMS.go('training', { tab: 'week' }) });
  AMS.registerCommand({ id: 'training.acwr', label: 'Squad workload & ACWR', group: 'Training', icon: 'pulse', keywords: 'acwr load jump workload monotony strain', roles: ['director', 'coach', 'physio', 'doctor', 'scientist'], run: () => AMS.go('training', { tab: 'workload' }) });

  /* ================================================================== self-tests (workflow assertions on fresh seed) */
  const T = {
    today: () => AMS.db.sessions.find((s) => s.date === AMS.TODAY && s.squadId === 'SQ-PUN-SPR17'),
    priya: () => AMS.org.athlete('ATH-10421'),
    yash: () => AMS.db.athletes.find((a) => a.name === 'Yash More'),
  };
  AMS.selfTests.push({
    name: 'coach starts today\'s U-17 session: Live, devices recording, attendance taken', role: 'coach', fn: () => {
      const s = T.today(); if (!s) throw new Error('no session today for U-17 Sprints');
      AMS.runAction('session.start', { sessionId: s.id });
      const x = AMS.byId(AMS.db.sessions, s.id);
      if (x.status !== 'Live') throw new Error('status ' + x.status);
      if (!(x.recording || []).includes('ATH-10421')) throw new Error('Priya\'s Catapult/WHOOP not recording');
      AMS.runAction('session.markAttendance', { sessionId: s.id, all: true });
      if (squadMembers(s.squadId).some((a) => !x.attendance[a.id])) throw new Error('attendance incomplete after "mark all present"');
      if (!AMS.db.notifications.some((n) => n.toRole === 'scientist' && /devices recording/.test(n.title))) throw new Error('scientist not notified');
    },
  });
  AMS.selfTests.push({
    name: 'completing a session records RPE × minutes into today\'s load (idempotent deltas)', role: 'coach', fn: () => {
      const s = T.today(); const pr = T.priya(); const before = pr.loads[41];
      const rpe = {}; squadMembers(s.squadId).forEach((a) => { rpe[a.id] = 6; }); rpe[pr.id] = 4;
      AMS.runAction('session.complete', { sessionId: s.id, rpe });
      const x = AMS.byId(AMS.db.sessions, s.id);
      if (x.status !== 'Completed') throw new Error('not completed');
      if (pr.loads[41] - before !== 4 * s.duration) throw new Error('Priya load delta ' + (pr.loads[41] - before) + ' ≠ ' + 4 * s.duration);
      AMS.runAction('session.complete', { sessionId: s.id, rpe: { [pr.id]: 5 } });
      if (pr.loads[41] - before !== 5 * s.duration) throw new Error('re-rating should record only the delta, got ' + (pr.loads[41] - before));
      if (!AMS.db.activity.some((a) => /Completed/.test(a.text))) throw new Error('no activity logged');
    },
  });
  AMS.selfTests.push({
    name: 'AI recovery suggestion for red Priya scales her recorded load', role: 'coach', fn: () => {
      const s = T.today(); const pr = T.priya();
      if (AMS.calc.readiness(pr).band !== 'bad') throw new Error('Priya should be red today');
      AMS.runAction('session.modifyForAthlete', { athleteId: pr.id, sessionId: s.id, variant: 'recovery' });
      const before = pr.loads[41];
      AMS.runAction('session.complete', { sessionId: s.id, rpe: { [pr.id]: 3 } });
      const exp = Math.round(3 * s.duration * VARIANTS.recovery.scale);
      if (pr.loads[41] - before !== exp) throw new Error('expected recovery load ' + exp + ', got ' + (pr.loads[41] - before));
    },
  });
  AMS.selfTests.push({
    name: 'publishing from the builder auto-adjusts Modified athletes and notifies athletes', role: 'coach', fn: () => {
      const n0 = AMS.db.sessions.length, nt = AMS.db.notifications.length;
      const res = AMS.runAction('session.create', { squadIds: ['SQ-PUN-SPR17'], date: D.add(AMS.TODAY, 2), title: 'Acceleration + sled', type: 'Speed', intensity: 'High', duration: 70, plannedRPE: 7, blocks: [{ exerciseId: 'EX-021', dose: '15 min' }, { exerciseId: 'EX-005', dose: '5 × 20 m' }] });
      if (!res || AMS.db.sessions.length !== n0 + 1) throw new Error('session not created');
      const s = AMS.db.sessions[AMS.db.sessions.length - 1];
      const y = T.yash();
      if (!s.mods[y.id] || s.mods[y.id].source !== 'auto') throw new Error('Yash (Modified) has no automatic variant');
      if (AMS.db.notifications.length <= nt) throw new Error('no notification sent');
      if (!upcomingBySquad()['SQ-PUN-SPR17'].some((x) => x.s.id === s.id)) throw new Error('new session missing from projections');
    },
  });
  AMS.selfTests.push({
    name: 'projected ACWR flags Priya for an extra high session and the variant lowers it', role: 'coach', fn: () => {
      const pr = T.priya();
      const full = acwrAt(extLoads(pr, [{ idx: 42, load: 560 }]), 42);
      const rec = acwrAt(extLoads(pr, [{ idx: 42, load: 560 * VARIANTS.recovery.scale }]), 42);
      if (full < 1.5) throw new Error('extra 560 AU should push Priya above 1.5, got ' + full);
      if (!(rec < full)) throw new Error('recovery variant should lower projected ACWR');
    },
  });
  AMS.selfTests.push({
    name: 'late RPE for yesterday updates the load series and ACWR', role: 'coach', fn: () => {
      const s = AMS.db.sessions.find((x) => x.squadId === 'SQ-PUN-SPR17' && x.date === D.add(AMS.TODAY, -1));
      const st = rpeStats(s);
      if (!st.missing.length) throw new Error('seed should leave some RPE outstanding yesterday');
      const ins = AMS.detectors.find((d) => d.id === 'training.rpeMissing').fn({ db: AMS.db, athletes: AMS.scopedAthletes(), ids: new Set(), role: 'coach', me: AMS.me(), scope: AMS.effectiveScope() });
      if (!ins.some((i) => i.id.indexOf(s.id) > 0)) throw new Error('rpeMissing detector did not flag ' + s.id);
      const a = AMS.org.athlete(st.missing[0]); const r0 = AMS.calc.acwr(a); const l0 = a.loads[40];
      AMS.runAction('session.complete', { sessionId: s.id, rpe: { [a.id]: 7 } });
      if (a.loads[40] - l0 !== 7 * s.duration) throw new Error('late RPE not recorded on yesterday');
      if (AMS.calc.acwr(a) === r0) throw new Error('ACWR did not change');
    },
  });
  AMS.selfTests.push({
    name: 'projected-spike insight can be resolved with one tap; plan edits persist', role: 'coach', fn: () => {
      const ctx = { db: AMS.db, athletes: AMS.scopedAthletes(), ids: new Set(), role: 'coach', me: AMS.me(), scope: AMS.effectiveScope() };
      const det = AMS.detectors.find((d) => d.id === 'training.projectedSpike');
      const ins = det.fn(ctx);
      if (ins.length) {
        const i = ins[0]; const act = i.actions.find((x) => x.primary);
        AMS.runAction(act.action, act.payload);
        const a = AMS.org.athlete(i.athleteIds[0]);
        if (project(a).peak.acwr >= i.evidence[1].value) throw new Error('protectUpcoming did not lower ' + a.name + '\'s projected peak');
      }
      const plan = AMS.db.plans.squads['SQ-PUN-SPR17']; const m = mesoAt(plan, CUR_W); const t0 = m.targets[0];
      AMS.runAction('plan.updateMeso', { squadId: 'SQ-PUN-SPR17', mesoId: m.id, focus: 'Acceleration & speed development', scalePct: 90 });
      if (m.focus !== 'Acceleration & speed development' || m.targets[0] !== Math.round((t0 * 0.9) / 10) * 10) throw new Error('mesocycle not updated');
    },
  });
  AMS.selfTests.push({
    name: 'read-only roles cannot change sessions', role: 'director', fn: () => {
      const s = T.today();
      const r = AMS.runAction('session.start', { sessionId: s.id });
      if (r !== null || AMS.byId(AMS.db.sessions, s.id).status !== 'Planned') throw new Error('director was able to start a session');
    },
  });
})();
