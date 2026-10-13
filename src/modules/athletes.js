/* USI · AMS — Athlete Management.
   Registry · onboarding & verification queue · approval flow · coach assignment · profile completion · documents,
   plus the GLOBAL athlete profile drawer ('athlete') that every module opens via AMS.openAthlete(id, tab).
   Workflow logic lives in registered actions so the UI, the AI insights, the copilot and the self-tests share one code path. */
(function () {
  'use strict';
  const AMS = window.AMS, UI = window.UI, React = window.React, html = AMS.html;
  const { useState, useMemo, useEffect } = React;
  const I = UI.Icon;
  const D = AMS.date;
  const T = AMS.TODAY;
  const Frag = React.Fragment;

  /* ================================================================== module-scoped CSS (theme tokens only) */
  const CSS = `
.ath-chip{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px;border-radius:13px;border:1px solid var(--border-strong);background:var(--surface);font-size:12px;color:var(--fg-2);cursor:pointer;white-space:nowrap}
.ath-chip:hover{background:var(--surface-2)}
.ath-chip.on{background:var(--accent-weak);border-color:var(--accent);color:var(--accent);font-weight:600}
.ath-chip .n{font-size:11px;color:var(--fg-3);font-weight:500}
.ath-board{display:grid;grid-template-columns:repeat(5,minmax(210px,1fr));gap:12px;overflow-x:auto;padding-bottom:4px}
.ath-col{background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-lg);display:flex;flex-direction:column;min-width:0}
.ath-col-h{padding:10px 12px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);font-weight:600;font-size:12.5px;gap:8px}
.ath-col-b{padding:8px;display:flex;flex-direction:column;gap:8px;min-height:90px}
.ath-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:10px;display:flex;flex-direction:column;gap:6px;cursor:pointer;text-align:left}
.ath-card:hover{border-color:var(--border-strong);box-shadow:var(--shadow)}
.ath-bulk{position:sticky;top:0;z-index:3;background:var(--accent-weak);border:1px solid var(--accent);border-radius:var(--r-lg);padding:8px 12px}
.ath-banner{border-radius:var(--r-lg);padding:10px 12px;display:flex;gap:10px;align-items:flex-start;border:1px solid var(--border);background:var(--surface-2);font-size:12.5px;line-height:1.45}
.ath-banner.info{background:var(--info-weak);border-color:var(--info)}
.ath-banner.warn{background:var(--warn-weak);border-color:var(--warn)}
.ath-banner.bad{background:var(--bad-weak);border-color:var(--bad)}
.ath-banner.good{background:var(--good-weak);border-color:var(--good)}
.ath-banner.ai{background:var(--ai-weak);border-color:var(--ai-border)}
.ath-check{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px dashed var(--border);font-size:12.5px;min-width:0}
.ath-check:last-child{border-bottom:0}
.ath-stat{padding:9px 11px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface-2);display:flex;flex-direction:column;gap:2px;min-width:0}
.ath-stat b{font:600 19px/1.1 var(--font-display);font-variant-numeric:tabular-nums}
.ath-stat span{font-size:11px;color:var(--fg-3)}
.ath-cmp td,.ath-cmp th{padding:6px 10px;border-bottom:1px solid var(--border);font-size:12.5px;text-align:left;vertical-align:top}
.ath-cmp tr.same td{background:var(--bad-weak)}
.ath-cmp tr.same td:first-child{color:var(--bad);font-weight:600}
.ath-spin{width:13px;height:13px;border-radius:50%;border:2px solid var(--ai-border);border-top-color:var(--ai);animation:athspin .8s linear infinite;display:inline-block;flex:none}
@keyframes athspin{to{transform:rotate(360deg)}}
.ath-hero{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.ath-opt{border:1px solid var(--border);border-radius:var(--r-lg);padding:10px 12px;display:flex;gap:10px;align-items:flex-start;cursor:pointer;background:var(--surface)}
.ath-opt.on{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-weak)}
.ath-opt.blocked{opacity:.55;cursor:not-allowed}
.ath-wiz-steps{display:flex;gap:6px;flex-wrap:wrap}
.ath-ta{width:100%}
@media (max-width:760px){.ath-board{grid-template-columns:repeat(5,240px)}.ath-hide-sm{display:none!important}}
`;
  try {
    if (typeof document !== 'undefined' && document.head && !document.getElementById('style-athletes')) {
      const s = document.createElement('style'); s.id = 'style-athletes'; s.textContent = CSS; document.head.appendChild(s);
    }
  } catch (e) { /* no DOM */ }

  /* ================================================================== constants */
  const OPEN_STAGES = ['Applied', 'Verifying', 'Docs returned'];
  const BOARD_COLS = [
    { id: 'Applied', label: 'Applied', stages: ['Applied'], tone: 'info' },
    { id: 'Verifying', label: 'Verifying', stages: ['Verifying'], tone: 'warn' },
    { id: 'Docs returned', label: 'Docs returned', stages: ['Docs returned'], tone: 'bad' },
    { id: 'Approved', label: 'Approved', stages: ['Approved'], tone: 'good' },
    { id: 'Closed', label: 'Rejected / merged', stages: ['Rejected', 'Merged'], tone: '' },
  ];
  const SLA_DAYS = 5;
  const CAPACITY = { 'U-17': 14, 'U-20': 12, Senior: 10 };
  const CASELOAD_LIMIT = 24;
  const AG_ORDER = { 'U-17': 0, 'U-20': 1, Senior: 2 };
  const TAG_POOL = ['Khelo India scheme', 'TOPS development', 'Talent pathway', 'Scholarship', 'Hostel resident', 'Day scholar', 'Left-footed', 'Para-eligible', 'On national camp', 'New intake', 'Selection watch', 'Return-to-play', 'Relay pool'];
  const DOC_FIELDS = ['Blood test report', 'Passport', 'Previous coach reference', 'Guardian consent'];
  const REQUIRED_DOCS = ['Aadhaar card', 'Birth certificate', 'Medical fitness certificate'];
  const OPTIONAL_DOCS = ['Previous competition records'];
  const QUALITY = [
    { value: 'clear', label: 'Clear scan (PDF)' },
    { value: 'photo', label: 'Phone photo, good light' },
    { value: 'blurred', label: 'Blurred phone photo' },
    { value: 'mismatch', label: 'Scan with a different DOB' },
    { value: 'unsigned', label: 'Unsigned / unstamped form' },
  ];
  const DOC_TONE = { Verified: 'good', Pending: 'info', Expiring: 'warn', Expired: 'bad', Flagged: 'bad', Returned: 'warn', Missing: 'bad', Superseded: '' };
  const SOURCES = ['Talent hunt referral', 'Online application', 'Academy transfer', 'State association nomination', 'Walk-in (ops entry)'];

  /* ================================================================== helpers */
  const ageOf = (x) => (x && x.dob ? D.ageOn(x.dob) : 0);
  const agOf = (x) => AMS.calc.ageGroup(ageOf(x));
  const first = (n) => String(n || '').split(' ')[0];
  const meName = () => { const m = AMS.me(); return m ? m.name : 'System'; };
  const plural = (n, w, pl) => n + ' ' + (n === 1 ? w : (pl || w + 's'));
  const squadName = (id) => (AMS.org.squad(id) || {}).name || '—';
  const centreShort = (id) => (AMS.org.centre(id) || {}).short || '—';
  const staffName = (id) => (id && AMS.org.staff(id) ? AMS.org.staff(id).name : 'Unassigned');
  const isClinical = (type) => /Blood test|Medical report|ECG|Scan|MRI/i.test(type || '');
  const isMedicalDoc = (type) => /fitness|Blood test|Medical report|ECG|Scan|MRI/i.test(type || '');
  const hero = () => AMS.db.meta.heroAthleteId;
  const openInj = (a) => AMS.db.injuries.filter((i) => i.athleteId === a.id && i.status !== 'Closed');
  const closedInj = (a) => AMS.db.injuries.filter((i) => i.athleteId === a.id && i.status === 'Closed').sort((x, y) => y.dateOfInjury.localeCompare(x.dateOfInjury));
  const reqRef = (athleteId, field) => 'REQ:' + athleteId + ':' + field;
  const pcTone = (pc) => (pc >= 100 ? 'good' : pc >= 90 ? 'accent' : pc >= 80 ? 'warn' : 'bad');
  const noConsent = (x) => ageOf(x) < 18 && !(x.guardian && x.guardian.consent);

  /** Effective document status: expiry is computed from the date, not trusted from the stored label. */
  function docStatus(d) {
    if (!d) return 'Missing';
    if (d.status === 'Superseded') return 'Superseded';
    let s = d.status === 'Expiring' ? 'Verified' : d.status;
    if (d.expires && (s === 'Verified' || s === 'Pending')) {
      const n = D.diff(d.expires, T);
      if (n < 0) s = 'Expired'; else if (n <= 30) s = 'Expiring';
    }
    return s;
  }
  const liveDocs = (a) => (a.docs || []).filter((d) => d.status !== 'Superseded');
  const docIssues = (a) => liveDocs(a).filter((d) => ['Flagged', 'Expired', 'Expiring', 'Pending', 'Returned'].includes(docStatus(d)));

  /* Permissions (RBAC from the product doc §5) */
  const P = {
    edit: () => AMS.canEdit('athletes'),                                   // ops
    tag: () => ['ops', 'coach', 'director'].includes(AMS.ui.role),
    request: () => ['ops', 'coach'].includes(AMS.ui.role),
    perf: () => AMS.can('readiness', 'view'),                               // readiness, load
    medical: () => AMS.access('medical') !== 'none',
    docsAll: () => AMS.access('documents') === 'edit',
    docsMed: () => AMS.access('documents') === 'medical',
    tests: () => AMS.can('assessments', 'view'),
  };
  function canSeeDoc(d, a) {
    if (AMS.ui.role === 'athlete') return !!a && a.id === hero();
    if (P.docsAll()) return true;
    if (P.docsMed()) return isMedicalDoc(d.type);
    return false;
  }
  function canActDoc(d) {
    if (P.docsAll()) return !isClinical(d.type);
    if (P.docsMed()) return isMedicalDoc(d.type);
    return false;
  }
  /** Role lock only (ignores the user's ladder filter) — "may this role see this athlete at all?" */
  function inRoleScope(a) {
    const lock = AMS.roleScopeLock();
    const sc = { lock };
    if (lock.centreId) sc.centreId = lock.centreId;
    return AMS.inScope(a, sc);
  }
  /** Application visible in the current ladder scope + role lock. */
  function appInScope(p) {
    const s = AMS.effectiveScope(); const lock = s.lock || {};
    if (lock.athleteId) return false;
    const c = AMS.org.centre(p.centreId);
    if (s.stateId && c && c.stateId !== s.stateId) return false;
    if (s.centreId && p.centreId !== s.centreId) return false;
    if (s.sport && p.sport !== s.sport) return false;
    if (s.squadId && p.squadId !== s.squadId) return false;
    if (lock.squadIds && !lock.squadIds.includes(p.squadId)) return false;
    return true;
  }
  function availabilityText(a) {
    if (a.availability === 'Available') return 'Available — no restrictions';
    if (AMS.ui.role === 'ops') return a.availability + ' — reason visible to medical & coaching staff only';
    const inj = openInj(a)[0];
    if (inj) return AMS.medicalLabel(inj);
    return a.availability + (a.availabilityReason ? ': ' + a.availabilityReason : '');
  }
  /** Age-group eligibility: athlete's age group (from DOB, on today's date) vs the squad's. */
  function eligibility(dob, squadId) {
    const sq = AMS.org.squad(squadId);
    if (!sq || !dob) return { ok: false, tone: 'info', label: 'Incomplete', text: 'Pick a date of birth and a squad to run the eligibility check.' };
    const age = D.ageOn(dob), ag = AMS.calc.ageGroup(age);
    const d = AG_ORDER[sq.ageGroup] - AG_ORDER[ag];
    if (d === 0) return { ok: true, tone: 'good', label: 'Eligible', text: 'Age ' + age + ' on ' + D.fmt(T) + ' → ' + ag + '; squad is ' + sq.ageGroup + '.' };
    if (d > 0) return { ok: true, tone: 'warn', label: 'Playing up', text: 'Age ' + age + ' (' + ag + ') in a ' + sq.ageGroup + ' squad — allowed, needs head-coach sign-off.' };
    return { ok: false, tone: 'bad', label: 'Not eligible', text: 'Age ' + age + ' is ' + ag + ' — too old for a ' + sq.ageGroup + ' squad. Pick an older age group.' };
  }
  function approvedOn(p) { return p.approvedOn || D.add(T, -2); }

  /* ================================================================== AI: document pre-check (deterministic) */
  function aiCheckDoc(type, quality, ctx) {
    ctx = ctx || {};
    const r = AMS.rng('doc:' + type + ':' + quality + ':' + (ctx.name || ''));
    const c = (lo, hi) => AMS.round(lo + r() * (hi - lo), 2);
    if (quality === 'blurred') return { ok: false, confidence: c(0.38, 0.55), note: 'Image blurred — ' + (/fitness/i.test(type) ? 'practitioner registration number unreadable' : 'name and number fields unreadable') + '; ask for a clearer scan' };
    if (quality === 'mismatch') {
      if (!ctx.dob) return { ok: false, confidence: c(0.35, 0.5), note: 'Date of birth on document differs from application' };
      const alt = D.add(ctx.dob, -365);
      const ag1 = AMS.calc.ageGroup(D.ageOn(ctx.dob)), ag2 = AMS.calc.ageGroup(D.ageOn(alt));
      return { ok: false, confidence: c(0.35, 0.5), note: 'DOB on document (' + D.fmt(alt) + ' ' + alt.slice(0, 4) + ') differs from application (' + D.fmt(ctx.dob) + ' ' + ctx.dob.slice(0, 4) + ')' + (ag1 !== ag2 ? ' — would move athlete from ' + ag1 + ' to ' + ag2 + ', age-fraud check needed' : '') };
    }
    if (quality === 'unsigned') return { ok: false, confidence: c(0.3, 0.45), note: /consent/i.test(type) ? 'Guardian signature missing on page 2' : 'Signature / issuing stamp missing' };
    const notes = {
      'Aadhaar card': 'Name and DOB match application; QR code valid',
      'Birth certificate': 'DOB matches Aadhaar; issuing authority recognised',
      'Medical fitness certificate': 'Signed by registered practitioner; valid 12 months',
      'Guardian consent': 'Signature present; guardian ID matched',
      'Previous competition records': 'Result found in state meet records',
      Passport: 'MRZ valid; name matches Aadhaar',
      'Blood test report': 'NABL-accredited lab; report dated within 90 days',
      'Previous coach reference': 'Letterhead and contact verified',
    };
    return { ok: true, confidence: quality === 'clear' ? c(0.94, 0.99) : c(0.86, 0.93), note: notes[type] || 'Fields readable and consistent with profile' };
  }
  function aiPrecheck(p) {
    const docs = p.docs || [];
    const flags = docs.filter((d) => d.ai && !d.ai.ok && d.status !== 'Verified');
    const missing = docs.filter((d) => d.status === 'Missing');
    const running = docs.filter((d) => !d.ai && d.status !== 'Missing');
    const pass = docs.filter((d) => d.ai && d.ai.ok);
    const minConf = pass.length ? Math.min(...pass.map((d) => d.ai.confidence)) : 0;
    let summary, tone, rec;
    if (flags.length) { summary = flags.map((d) => d.type + ': ' + d.ai.note).join(' · '); tone = 'bad'; rec = 'Return to applicant: ' + flags.map((d) => d.type.toLowerCase()).join(', '); }
    else if (missing.length) { summary = missing.map((d) => d.type).join(', ') + ' not uploaded yet'; tone = 'warn'; rec = 'Return to applicant for missing documents'; }
    else if (running.length) { summary = 'AI check running on ' + plural(running.length, 'document'); tone = 'info'; rec = 'Wait for the AI pre-check'; }
    else { summary = 'All ' + pass.length + ' documents pass · lowest confidence ' + Math.round(minConf * 100) + '%'; tone = 'good'; rec = docs.every((d) => d.status === 'Verified') ? 'Ready to approve' : 'Confirm the AI-passed documents'; }
    if (p.duplicateOf && !p.duplicateOf.resolved) rec = 'Resolve the possible duplicate first';
    return { pass: pass.length, flags, missing, running, total: docs.length, summary, tone, rec, verified: docs.filter((d) => d.status === 'Verified').length };
  }
  function approvalBlockers(p) {
    const bl = [];
    if (!OPEN_STAGES.includes(p.stage)) bl.push('Application is ' + p.stage.toLowerCase());
    const notVer = (p.docs || []).filter((d) => d.status !== 'Verified');
    if (notVer.length) bl.push(plural(notVer.length, 'document') + ' not verified (' + notVer.map((d) => d.type).join(', ') + ')');
    if (p.duplicateOf && !p.duplicateOf.resolved) bl.push('Possible duplicate not resolved');
    if (noConsent(p)) bl.push('Guardian consent missing (under 18)');
    const el = eligibility(p.dob, p.squadId);
    if (!el.ok) bl.push(el.label + ' — ' + el.text);
    return bl;
  }
  /** Duplicate check against existing athletes (name, DOB, centre, gender) — used by the enrolment wizard. */
  function findDuplicate(x) {
    if (!x.name || !x.dob) return null;
    const nm = x.name.trim().toLowerCase();
    let best = null;
    AMS.db.athletes.forEach((a) => {
      let s = 0; const reasons = [];
      const an = a.name.toLowerCase();
      if (an === nm) { s += 0.5; reasons.push('Same name'); }
      else if (an.split(' ').pop() === nm.split(' ').pop() && an[0] === nm[0]) { s += 0.2; reasons.push('Similar name'); }
      if (a.dob === x.dob) { s += 0.3; reasons.push('Same date of birth'); }
      if (a.centreId === x.centreId) { s += 0.08; reasons.push('Same centre'); }
      if (a.gender === x.gender) s += 0.04;
      if (s >= 0.6 && (!best || s > best.score)) best = { athleteId: a.id, score: AMS.round(Math.min(s, 0.97), 2), reasons };
    });
    return best;
  }

  /* ================================================================== AI: coach recommendation */
  const squadSize = (sqId) => AMS.db.athletes.filter((a) => a.squadId === sqId && a.enrollment === 'Active').length;
  const caseload = (coachId) => AMS.db.athletes.filter((a) => a.coachId === coachId && a.enrollment === 'Active').length;
  const coachInjuries = (coachId) => AMS.db.injuries.filter((i) => i.status !== 'Closed' && (AMS.org.athlete(i.athleteId) || {}).coachId === coachId).length;
  function subjectFrom(props) {
    if (!props) return null;
    if (props.appId) {
      const p = AMS.byId(AMS.db.applications, props.appId);
      if (!p) return null;
      const a = p.athleteId && AMS.org.athlete(p.athleteId);
      if (a) return { kind: 'athlete', id: a.id, appId: p.id, name: a.name, dob: a.dob, gender: a.gender, sport: a.sport, discipline: a.discipline, centreId: a.centreId, squadId: a.squadId, coachId: a.coachId, athlete: a };
      const sq = AMS.org.squad(p.squadId);
      return { kind: 'app', id: p.id, appId: p.id, name: p.name, dob: p.dob, gender: p.gender, sport: p.sport, discipline: sq ? sq.discipline : p.sport, centreId: p.centreId, squadId: p.squadId, coachId: p.coachId, app: p };
    }
    const id = props.athleteId || (props.athleteIds || [])[0];
    const a = id && AMS.org.athlete(id);
    if (!a) return null;
    return { kind: 'athlete', id: a.id, name: a.name, dob: a.dob, gender: a.gender, sport: a.sport, discipline: a.discipline, centreId: a.centreId, squadId: a.squadId, coachId: a.coachId, athlete: a };
  }
  function recommendCoaches(subj) {
    if (!subj) return [];
    const ag = AMS.calc.ageGroup(D.ageOn(subj.dob));
    return AMS.db.org.squads.filter((sq) => sq.sport === subj.sport).map((sq) => {
      const reasons = []; let score = 34; let blocked = null;
      const d = AG_ORDER[sq.ageGroup] - AG_ORDER[ag];
      if (d === 0) { score += 24; reasons.push({ label: 'Age group', value: ag, tone: 'good' }); }
      else if (d > 0) { score += 4; reasons.push({ label: 'Playing up', value: ag + ' → ' + sq.ageGroup, tone: 'warn' }); }
      else { blocked = ag + ' athlete cannot join a ' + sq.ageGroup + ' squad'; score -= 50; reasons.push({ label: 'Age group', value: ag + ' > ' + sq.ageGroup, tone: 'bad' }); }
      if (sq.discipline === subj.discipline) { score += 14; reasons.push({ label: 'Discipline', value: sq.discipline, tone: 'good' }); }
      else { score -= 6; reasons.push({ label: 'Discipline', value: sq.discipline, tone: 'warn' }); }
      if (sq.centreId === subj.centreId) { score += 14; reasons.push({ label: 'Centre', value: centreShort(sq.centreId), tone: 'good' }); }
      else { score -= 14; reasons.push({ label: 'Transfer to', value: centreShort(sq.centreId), tone: 'warn' }); }
      const size = squadSize(sq.id), cap = CAPACITY[sq.ageGroup] || 12, room = cap - size;
      score += AMS.clamp(room, -3, 5) * 2;
      reasons.push({ label: 'Squad size', value: size + '/' + cap, tone: room <= 0 ? 'bad' : room <= 2 ? 'warn' : 'good' });
      const load = caseload(sq.coachId);
      score += AMS.clamp((CASELOAD_LIMIT - load) / 2, -6, 6);
      reasons.push({ label: 'Coach caseload', value: load + '/' + CASELOAD_LIMIT, tone: load >= CASELOAD_LIMIT ? 'bad' : load >= CASELOAD_LIMIT - 4 ? 'warn' : 'good' });
      const inj = coachInjuries(sq.coachId);
      if (inj >= 3) { score -= 3; reasons.push({ label: 'Open injury cases', value: String(inj), tone: 'warn' }); }
      if (sq.id === subj.squadId) { score += 5; reasons.push({ label: 'Requested squad', value: 'yes', tone: 'good' }); }
      return { squad: sq, squadId: sq.id, coachId: sq.coachId, coach: AMS.org.staff(sq.coachId), score: AMS.clamp(Math.round(score), 1, 99), reasons, blocked, size, cap, load, inj };
    }).sort((x, y) => (x.blocked ? 1 : 0) - (y.blocked ? 1 : 0) || y.score - x.score);
  }
  const recConfidence = (opts) => { const ok = opts.filter((o) => !o.blocked); if (!ok.length) return 0.4; const gap = ok.length > 1 ? ok[0].score - ok[1].score : 30; return AMS.round(AMS.clamp(0.62 + gap / 60, 0.55, 0.96), 2); };

  /* ================================================================== AI: athlete summary (specific, role-aware, with evidence) */
  function athleteBrief(a) {
    const role = AMS.ui.role, fn = first(a.name);
    const own = role === 'athlete' && a.id === hero();
    const perf = (P.perf() || own) && a.enrollment === 'Active';
    const s = [], ev = [];
    if (a.enrollment !== 'Active') s.push(fn + ' is ' + a.enrollment.toLowerCase() + ' — not counted in squad readiness or load reports.');
    if (perf) {
      const rd = AMS.calc.readiness(a), r = AMS.calc.acwr(a), w = AMS.calc.todayWellness(a);
      const base = Math.round(AMS.calc.wellnessBaseline(a) || 0);
      const wk = AMS.calc.weekLoad(a);
      const chronicWk = Math.round(AMS.mean((a.loads || []).slice(13, 41)) * 7);
      const why = rd.factors.filter((f) => f.tone !== 'good').map((f) => f.label.replace(/ \(ACWR\)/, '').toLowerCase() + ' ' + f.value);
      s.push(fn + ' is ' + AMS.calc.bandLabel(rd.band) + ' today — readiness ' + rd.score + (w ? ' from the ' + w.at + ' check-in' : ' (no check-in yet, 3-day average used)') + (why.length ? ', driven by ' + why.join(', ') : '') + '.');
      const sleeps = (a.wellness || []).slice(25, 28).filter(Boolean).map((x) => x.sleep);
      if (sleeps.length === 3 && sleeps.every((x) => x <= 3)) s.push('Sleep has been ' + sleeps.join(', ') + '/5 over the last three nights' + (base ? ' (own wellness normal: ' + base + ')' : '') + '.');
      const pct = chronicWk ? Math.round((wk / chronicWk - 1) * 100) : 0;
      if (chronicWk) s.push('Load: ACWR ' + r.toFixed(2) + ' (' + AMS.calc.acwrLabel(r).toLowerCase() + ') — ' + wk + ' AU this week vs a 4-week normal of ' + chronicWk + ' AU' + (Math.abs(pct) >= 10 ? ' (' + (pct > 0 ? '+' : '') + pct + '%)' : '') + '.');
      else s.push('No training load recorded yet — ACWR will be meaningful after 3–4 weeks of sessions.');
      if (w && w.note) s.push('Athlete note: "' + w.note + '".');
      ev.push({ label: 'Readiness', value: String(rd.score), tone: rd.band }, { label: 'ACWR', value: r.toFixed(2), tone: AMS.calc.acwrBand(r) });
      if (chronicWk) ev.push({ label: 'Week load', value: wk + ' AU', tone: pct > 30 ? 'bad' : pct > 15 ? 'warn' : 'good' });
      if (sleeps.length) ev.push({ label: 'Sleep, 3 nights', value: AMS.mean(sleeps).toFixed(1) + '/5', tone: AMS.mean(sleeps) <= 2.5 ? 'bad' : AMS.mean(sleeps) <= 3.2 ? 'warn' : 'good' });
    }
    if (role !== 'ops' && (inRoleScope(a) || own)) {
      const open = openInj(a), closed = closedInj(a);
      if (open.length) {
        s.push('Medical: ' + open.map((i) => AMS.medicalLabel(i) + (AMS.medicalFull() ? ' (' + i.status + (i.status === 'Rehab' ? ', stage ' + (i.rtpStage + 1) + '/' + i.rtpStages.length : '') + ')' : '')).join('; ') + '.');
        ev.push({ label: 'Open medical', value: String(open.length), tone: 'warn' });
      } else {
        s.push('No open medical case' + (closed.length ? '; ' + plural(closed.length, 'past injury', 'past injuries') + ' (latest: ' + (AMS.medicalFull() ? closed[0].diagnosis : AMS.bodyZone(closed[0].region)) + ', ' + D.month(closed[0].dateOfInjury) + ' ' + closed[0].dateOfInjury.slice(0, 4) + ')' : '') + '.');
      }
    }
    const comp = AMS.db.competitions.filter((c) => c.sports.includes(a.sport) && c.date >= T).sort((x, y) => x.date.localeCompare(y.date))[0];
    const ta = a.tempAssignment;
    const nexts = [];
    if (comp) nexts.push(comp.name + ' on ' + D.fmt(comp.date) + ' (' + D.rel(comp.date) + ')');
    if (ta && !ta.active && ta.from >= T) nexts.push(ta.label + ' at ' + centreShort(ta.centreId) + ' from ' + D.fmt(ta.from));
    if (nexts.length) s.push('Next: ' + nexts.join('; then ') + '.');
    if (a.missingFields.length) { s.push('Profile ' + a.profileCompletion + '% — still missing ' + a.missingFields.join(', ') + '.'); ev.push({ label: 'Profile', value: a.profileCompletion + '%', tone: a.profileCompletion < 85 ? 'bad' : 'warn' }); }
    else ev.push({ label: 'Profile', value: '100%', tone: 'good' });
    if (noConsent(a)) { s.push('Guardian consent is missing — no medical data can be recorded until it is on file.'); ev.push({ label: 'Consent', value: 'missing', tone: 'bad' }); }
    const exp = liveDocs(a).filter((d) => ['Expiring', 'Expired'].includes(docStatus(d)));
    if (exp.length && (P.docsAll() || P.docsMed() || P.edit())) s.push(exp.map((d) => d.type + (docStatus(d) === 'Expired' ? ' expired ' : ' expires ') + D.fmt(d.expires)).join('; ') + '.');
    return { text: s.join(' '), evidence: ev };
  }

  /* ================================================================== workflow logic (pure-ish; called inside mutate) */
  function nextAthleteId(db) { const n = Math.max(...db.athletes.map((a) => +String(a.id).replace(/\D/g, '') || 0)); return 'ATH-' + (n + 1); }
  function nextAppId(db) { const n = Math.max(800, ...db.applications.map((p) => +String(p.id).replace(/\D/g, '') || 0)); return 'APP-' + (n + 1); }
  function createAthleteFromApp(db, p, coachId) {
    const sq = AMS.byId(db.org.squads, p.squadId);
    const c = AMS.byId(db.org.centres, p.centreId);
    const r = AMS.rng('intake:' + p.id);
    const id = nextAthleteId(db);
    const h = +p.heightCm || (p.gender === 'F' ? r.int(155, 171) : r.int(166, 186));
    const missing = ['Emergency contact', 'Blood test report', 'Bank details (stipend)'];
    const a = {
      id, name: p.name, gender: p.gender, dob: p.dob, sport: p.sport, discipline: sq ? sq.discipline : p.sport, events: p.events || '—',
      squadId: p.squadId, centreId: p.centreId, stateId: c ? c.stateId : null, coachId: coachId || null,
      enrollment: 'Active', availability: 'Available', availabilityReason: '', enrolledOn: T, level: p.level || 'District',
      tags: ['New intake'], profileCompletion: 76, missingFields: missing,
      verification: { status: 'Verified', by: meName(), on: T },
      docs: (p.docs || []).filter((d) => d.status !== 'Missing').map((d, i) => {
        const nd = { id: id + '-D' + (i + 1), type: d.type, status: d.status === 'Verified' ? 'Verified' : 'Pending', on: T, ai: d.ai };
        if (/fitness/i.test(d.type)) nd.expires = D.add(T, 365);
        return nd;
      }),
      guardian: p.guardian ? Object.assign({}, p.guardian, p.guardian.consent ? { consentOn: p.guardian.consentOn || T } : {}) : null,
      bloodGroup: null, heightCm: h, weightKg: +p.weightKg || Math.round(h - (p.gender === 'F' ? 108 : 102) + r.int(-4, 4)),
      dominantSide: p.dominantSide || 'Right', devices: [], phone: p.phone || '+91 9' + r.int(10, 99) + 'xx xx' + r.int(100, 999),
      wellness: new Array(28).fill(null), loads: new Array(42).fill(0), tempAssignment: null, returnedOn: null,
      baseRPE: 0, wellBase: 3.8, loadMult: 1, appId: p.id,
    };
    db.athletes.push(a);
    p.athleteId = id;
    return a;
  }
  function markReceived(db, a, field) {
    const idx = a.missingFields.indexOf(field);
    if (idx < 0) return false;
    const bump = Math.ceil((100 - a.profileCompletion) / a.missingFields.length);
    a.missingFields.splice(idx, 1);
    a.profileCompletion = a.missingFields.length ? Math.min(99, a.profileCompletion + bump) : 100;
    const key = field.toLowerCase();
    db.tasks.forEach((t) => { if (t.status === 'Open' && t.athleteId === a.id && (t.ref === reqRef(a.id, field) || (t.title || '').toLowerCase().includes(key))) { t.status = 'Done'; t.doneOn = T; } });
    if (DOC_FIELDS.includes(field)) a.docs.push({ id: AMS.uid(a.id + '-D'), type: field, status: isClinical(field) ? 'Pending' : 'Verified', on: T, ai: aiCheckDoc(field, 'clear', a) });
    if (field === 'Guardian consent' && a.guardian) { a.guardian.consent = true; a.guardian.consentOn = T; }
    return true;
  }
  function createApplication(x) {
    let created = null;
    AMS.mutate((db) => {
      const id = nextAppId(db);
      const u18 = D.ageOn(x.dob) < 18;
      const docs = (x.docs || []).map((d, i) => ({ id: id + '-D' + i, type: d.type, status: d.ai ? (d.ai.ok ? 'Pending' : 'Flagged') : 'Missing', ai: d.ai || null }));
      const dup = findDuplicate(x);
      const p = {
        id, name: x.name.trim(), gender: x.gender, dob: x.dob, centreId: x.centreId, squadId: x.squadId, sport: x.sport, events: x.events || '—',
        stage: 'Applied', submitted: T, source: x.source || 'Walk-in (ops entry)', phone: x.phone, heightCm: x.heightCm, weightKg: x.weightKg,
        guardian: u18 ? { name: (x.guardian && x.guardian.name) || 'Guardian', relation: (x.guardian && x.guardian.relation) || 'Parent', phone: x.guardian && x.guardian.phone, consent: !!x.consent, consentOn: x.consent ? T : null, method: x.consentMode } : null,
        docs, duplicateOf: dup, coachId: null, returnReason: null,
        history: [{ date: T, text: 'Application submitted (' + (x.source || 'ops entry') + ')', by: meName() }],
      };
      if (u18 && x.consentMode === 'link') p.history.push({ date: T, text: 'E-consent link sent to ' + p.guardian.name + ' (' + (p.guardian.phone || 'SMS') + ')', by: 'System' });
      const pre = aiPrecheck(p);
      p.history.push({ date: T, text: 'AI pre-check: ' + pre.summary, by: 'AI' });
      if (dup) p.history.push({ date: T, text: 'Possible duplicate of ' + dup.athleteId + ' (' + Math.round(dup.score * 100) + '% match)', by: 'AI' });
      db.applications.unshift(p);
      AMS.notify({ toRole: 'ops', title: 'New application — ' + p.name, text: squadName(p.squadId) + ', ' + centreShort(p.centreId) + ' · AI pre-check: ' + pre.summary + (dup ? ' · possible duplicate' : ''), module: 'athletes' });
      AMS.log({ type: 'onboarding', text: 'Application ' + id + ' submitted for ' + p.name + ' (' + squadName(p.squadId) + ')' });
      created = p;
    }, { toast: 'Application created for ' + x.name + ' — now in the verification queue' });
    return created;
  }
  function requestMissing(p) {
    const ids = p.athleteIds || (p.athleteId ? [p.athleteId] : []);
    let items = 0, people = 0;
    const by = AMS.ui.role;
    AMS.mutate((db) => {
      ids.forEach((id) => {
        const a = AMS.byId(db.athletes, id);
        if (!a) return;
        const fields = p.field ? [p.field] : a.missingFields.slice();
        if (!fields.length) return;
        const to = p.to || (ageOf(a) < 18 ? 'guardian' : 'athlete');
        let added = 0;
        fields.forEach((f) => {
          if (db.tasks.some((t) => t.status === 'Open' && t.ref === reqRef(a.id, f))) return;
          db.tasks.unshift({ id: AMS.uid('TSK'), title: 'Provide ' + f + ' — ' + a.name, ownerRole: 'athlete', module: 'athletes', status: 'Open', due: D.add(T, 5), created: T, athleteId: a.id, ref: reqRef(a.id, f), requestedFrom: to, requestedBy: by });
          added++;
        });
        if (!added) return;
        items += added; people++;
        if (a.id === db.meta.heroAthleteId) AMS.notify({ toRole: 'athlete', title: 'Profile items requested', text: 'Please upload: ' + fields.join(', ') + ' (due ' + D.fmt(D.add(T, 5)) + ').', athleteId: a.id, module: 'athletes' });
        if (ids.length <= 3) AMS.log({ type: 'profile', text: 'Requested ' + fields.join(', ') + ' from ' + (to === 'guardian' && a.guardian ? a.guardian.name + ' (guardian)' : a.name), athleteId: a.id });
      });
      if (ids.length > 3 && items) AMS.log({ type: 'profile', text: 'Profile reminders sent: ' + plural(items, 'item') + ' across ' + plural(people, 'athlete') + (p.field ? ' (' + p.field + ')' : '') });
      if (by === 'coach' && items) AMS.notify({ toRole: 'ops', title: 'Coach requested profile items', text: meName() + ' requested ' + plural(items, 'item') + ' from ' + plural(people, 'athlete') + '.', module: 'athletes' });
    }, { toast: items ? 'Requested ' + plural(items, 'item') + ' from ' + plural(people, 'athlete') : 'Already requested — reminders are open', toastKind: items ? 'good' : 'info' });
    return items ? 'Requested ' + items + ' items' : 'Nothing new to request';
  }

  /* ================================================================== actions */
  AMS.registerAction('open.application', (p) => { AMS.openDrawer('application', { appId: p.appId }); return 'Opened'; });
  AMS.registerAction('open.assignCoach', (p) => { AMS.openModal('assign-coach', p); return 'Opened'; });
  AMS.registerAction('application.create', (p) => { const x = createApplication(p); return x ? 'Application ' + x.id + ' created' : null; });

  /** { appId, docId, status: 'Verified'|'Flagged'|'Returned', note? } */
  AMS.registerAction('application.verifyDoc', function (p) {
    const app = AMS.byId(AMS.db.applications, p.appId); if (!app) return null;
    const doc = AMS.byId(app.docs, p.docId); if (!doc) return null;
    const status = p.status || 'Verified';
    AMS.mutate((db) => {
      const x = AMS.byId(db.applications, p.appId); const d = AMS.byId(x.docs, p.docId);
      d.status = status; d.by = meName(); d.on = T; if (p.note) d.reviewNote = p.note;
      if (x.stage === 'Applied') { x.stage = 'Verifying'; x.history.push({ date: T, text: 'Verification started', by: meName() }); }
      if (/consent/i.test(d.type) && status === 'Verified' && x.guardian) { x.guardian.consent = true; x.guardian.consentOn = T; }
      x.history.push({ date: T, text: d.type + ' → ' + status + (p.note ? ' (' + p.note + ')' : d.ai ? ' · AI ' + Math.round(d.ai.confidence * 100) + '%' : ''), by: meName() });
    }, { toast: doc.type + ' marked ' + status.toLowerCase() + ' — ' + app.name, toastKind: status === 'Verified' ? 'good' : 'info', log: { type: 'onboarding', text: app.name + ': ' + doc.type + ' ' + status.toLowerCase() } });
    return doc.type + ' ' + status;
  });
  /** Human-confirmed bulk: verify every pending document the AI passed with ≥ 90% confidence. { appIds } */
  AMS.registerAction('application.autoVerify', function (p) {
    let n = 0;
    AMS.mutate((db) => {
      (p.appIds || []).forEach((id) => {
        const x = AMS.byId(db.applications, id); if (!x || !OPEN_STAGES.includes(x.stage)) return;
        let k = 0;
        x.docs.forEach((d) => { if (d.status === 'Pending' && d.ai && d.ai.ok && d.ai.confidence >= 0.9) { d.status = 'Verified'; d.by = 'AI pre-check · confirmed by ' + meName(); d.on = T; k++; if (/consent/i.test(d.type) && x.guardian) { x.guardian.consent = true; x.guardian.consentOn = T; } } });
        if (k) { n += k; if (x.stage === 'Applied') x.stage = 'Verifying'; x.history.push({ date: T, text: plural(k, 'AI-passed document') + ' confirmed in bulk', by: meName() }); }
      });
    }, { toast: n ? plural(n, 'document') + ' verified from AI pre-check' : 'No AI-passed documents waiting', toastKind: n ? 'ai' : 'info', log: n ? { type: 'onboarding', text: 'Bulk-confirmed ' + plural(n, 'AI-passed document') } : null });
    return n + ' documents verified';
  });
  /** Loop back to the applicant with a reason. { appId, reason, docIds? } */
  AMS.registerAction('application.returnDocs', function (p) {
    const app = AMS.byId(AMS.db.applications, p.appId); if (!app) return null;
    const reason = (p.reason || '').trim() || 'Documents need to be re-uploaded';
    AMS.mutate((db) => {
      const x = AMS.byId(db.applications, p.appId);
      const ids = p.docIds && p.docIds.length ? p.docIds : x.docs.filter((d) => d.status === 'Flagged' || d.status === 'Missing').map((d) => d.id);
      x.docs.forEach((d) => { if (ids.includes(d.id)) d.status = 'Returned'; });
      x.stage = 'Docs returned'; x.returnReason = reason; x.returnedOn = T; x.returns = (x.returns || 0) + 1;
      x.history.push({ date: T, text: 'Returned to applicant: ' + reason, by: meName() });
      db.tasks.unshift({ id: AMS.uid('TSK'), title: 'Follow up re-upload — ' + x.name, ownerRole: 'ops', module: 'athletes', status: 'Open', due: D.add(T, 3), created: T, ref: x.id });
    }, { toast: 'Returned to ' + app.name + ' with reason — SLA clock stays visible', toastKind: 'info', log: { type: 'onboarding', text: app.name + ' — documents returned: ' + reason } });
    return 'Returned to applicant';
  });
  /** Simulates the applicant re-uploading returned documents (demo of the loop). { appId } */
  AMS.registerAction('application.resubmit', function (p) {
    const app = AMS.byId(AMS.db.applications, p.appId); if (!app) return null;
    AMS.mutate((db) => {
      const x = AMS.byId(db.applications, p.appId);
      let k = 0;
      x.docs.forEach((d) => { if (d.status === 'Returned' || d.status === 'Missing' || d.status === 'Flagged') { d.status = 'Pending'; d.ai = aiCheckDoc(d.type, 'clear', x); d.ai.note = 'Re-uploaded: ' + d.ai.note; k++; } });
      if (/consent/i.test(x.returnReason || '') || x.docs.some((d) => /consent/i.test(d.type) && d.status === 'Pending')) { if (x.guardian) x.guardian.consent = true; }
      x.stage = 'Verifying'; x.resubmittedOn = T;
      x.history.push({ date: T, text: 'Applicant re-uploaded ' + plural(k, 'document') + ' · AI re-check passed', by: x.name });
      db.tasks.forEach((t) => { if (t.status === 'Open' && t.ref === x.id && /re-upload/.test(t.title)) t.status = 'Done'; });
      AMS.notify({ toRole: 'ops', title: 'Documents re-uploaded', text: x.name + ' re-uploaded ' + plural(k, 'document') + '. AI re-check passed — ready to verify.', module: 'athletes' });
    }, { toast: app.name + ' re-uploaded — back in Verifying', toastKind: 'ai', log: { type: 'onboarding', text: app.name + ' re-uploaded returned documents' } });
    return 'Resubmitted';
  });
  /** Approve → creates the athlete record. { appId, coachId? } */
  AMS.registerAction('application.approve', function (p) {
    const app = AMS.byId(AMS.db.applications, p.appId); if (!app) return null;
    const bl = approvalBlockers(app);
    if (bl.length) { AMS.toast('Cannot approve yet: ' + bl[0], 'bad'); return 'Blocked: ' + bl.join('; '); }
    let newId = null;
    AMS.mutate((db) => {
      const x = AMS.byId(db.applications, p.appId);
      const a = createAthleteFromApp(db, x, p.coachId || null);
      newId = a.id;
      x.stage = 'Approved'; x.approvedOn = T; x.approvedBy = meName();
      if (p.coachId) x.coachId = p.coachId;
      x.history.push({ date: T, text: 'Approved — athlete record ' + a.id + ' created (Active · Available)', by: meName() });
      if (!p.coachId) db.tasks.unshift({ id: AMS.uid('TSK'), title: 'Assign coach to ' + x.name, ownerRole: 'ops', module: 'athletes', status: 'Open', due: D.add(T, 1), created: T, athleteId: a.id, ref: x.id });
      AMS.log({ type: 'onboarding', text: x.name + ' approved — ' + a.id + ' created in ' + squadName(x.squadId), athleteId: a.id });
      AMS.notify({ toRole: 'director', title: 'New athlete enrolled', text: x.name + ' (' + squadName(x.squadId) + ', ' + centreShort(x.centreId) + ') approved by ' + meName() + '.', athleteId: a.id, module: 'athletes' });
    }, { toast: app.name + ' approved — athlete record created. Next: assign a coach.', toastAction: { label: 'Assign coach', run: () => AMS.openModal('assign-coach', { appId: p.appId }) } });
    return 'Approved as ' + newId;
  });
  /** { appId, reason } */
  AMS.registerAction('application.reject', function (p) {
    const app = AMS.byId(AMS.db.applications, p.appId); if (!app) return null;
    const reason = (p.reason || '').trim() || 'Not eligible';
    AMS.mutate((db) => {
      const x = AMS.byId(db.applications, p.appId);
      x.stage = 'Rejected'; x.rejectReason = reason; x.decidedOn = T;
      x.history.push({ date: T, text: 'Rejected: ' + reason, by: meName() });
      db.tasks.forEach((t) => { if (t.status === 'Open' && t.ref === x.id) t.status = 'Done'; });
    }, { toast: app.name + ' rejected — reason logged for review', toastKind: 'info', log: { type: 'onboarding', text: app.name + ' rejected: ' + reason } });
    return 'Rejected';
  });
  /** Merge a duplicate application into the existing athlete record. { appId } */
  AMS.registerAction('application.merge', function (p) {
    const app = AMS.byId(AMS.db.applications, p.appId);
    if (!app || !app.duplicateOf) return null;
    const ex = AMS.org.athlete(app.duplicateOf.athleteId);
    let carried = 0;
    AMS.mutate((db) => {
      const x = AMS.byId(db.applications, p.appId); const a = AMS.byId(db.athletes, x.duplicateOf.athleteId);
      x.docs.forEach((d) => { if (d.status !== 'Missing' && !a.docs.some((ad) => ad.type === d.type && ad.status !== 'Superseded')) { a.docs.push({ id: AMS.uid(a.id + '-D'), type: d.type, status: d.status === 'Verified' ? 'Verified' : 'Pending', on: T, ai: d.ai }); carried++; } });
      x.stage = 'Merged'; x.mergedInto = a.id; x.decidedOn = T; x.duplicateOf.resolved = 'merged';
      x.history.push({ date: T, text: 'Merged into existing record ' + a.id + (carried ? ' (' + plural(carried, 'new document') + ' carried over)' : ''), by: meName() });
      db.tasks.forEach((t) => { if (t.status === 'Open' && t.ref === x.id) t.status = 'Done'; });
      AMS.log({ type: 'onboarding', text: 'Duplicate application ' + x.id + ' merged into ' + a.name + ' (' + a.id + ')', athleteId: a.id });
    }, { toast: 'Merged into ' + (ex ? ex.name + ' · ' + ex.id : 'existing record') + ' — one history kept' });
    return 'Merged';
  });
  /** { appId } — ops confirms the "duplicate" is a different person. */
  AMS.registerAction('application.notDuplicate', function (p) {
    const app = AMS.byId(AMS.db.applications, p.appId); if (!app || !app.duplicateOf) return null;
    AMS.mutate((db) => {
      const x = AMS.byId(db.applications, p.appId);
      x.duplicateOf.resolved = 'different'; x.duplicateOf.resolvedBy = meName();
      x.history.push({ date: T, text: 'Confirmed different person from ' + x.duplicateOf.athleteId + (p.note ? ' — ' + p.note : ''), by: meName() });
    }, { toast: 'Marked as a different person — application can proceed', toastKind: 'info', log: { type: 'onboarding', text: app.name + ': duplicate warning cleared (different person)' } });
    return 'Cleared';
  });
  /** { athleteId | athleteIds | appId, squadId, coachId? } — creates the athlete for an approved application if needed. */
  AMS.registerAction('athlete.assignCoach', function (p) {
    const sq = AMS.org.squad(p.squadId);
    const coachId = p.coachId || (sq && sq.coachId);
    if (!sq || !coachId) { AMS.toast('Pick a squad and coach first', 'bad'); return null; }
    if (p.appId) { const app = AMS.byId(AMS.db.applications, p.appId); if (!app || (app.stage !== 'Approved' && !app.athleteId)) { AMS.toast('Approve the application before assigning a coach', 'bad'); return null; } }
    const names = [];
    const coach = AMS.org.staff(coachId);
    AMS.mutate((db) => {
      const targets = [];
      if (p.appId) {
        const app = AMS.byId(db.applications, p.appId);
        let a = app.athleteId && AMS.byId(db.athletes, app.athleteId);
        if (!a) { a = createAthleteFromApp(db, app, null); AMS.log({ type: 'onboarding', text: app.name + ' activated — record ' + a.id + ' created', athleteId: a.id }); }
        targets.push(a);
      }
      (p.athleteIds || (p.athleteId ? [p.athleteId] : [])).forEach((id) => { const a = AMS.byId(db.athletes, id); if (a && !targets.includes(a)) targets.push(a); });
      targets.forEach((a) => {
        const moved = a.squadId !== sq.id;
        a.coachId = coachId; a.squadId = sq.id; a.centreId = sq.centreId; a.stateId = (AMS.byId(db.org.centres, sq.centreId) || {}).stateId; a.discipline = sq.discipline;
        if (a.appId) { const app = AMS.byId(db.applications, a.appId); if (app) { app.coachId = coachId; app.history.push({ date: T, text: 'Coach assigned: ' + coach.name + ' · ' + sq.name + ' → athlete Active', by: meName() }); } }
        db.tasks.forEach((t) => { if (t.status === 'Open' && ((a.appId && t.ref === a.appId && /coach/i.test(t.title)) || t.ref === 'COACH:' + a.id || (/^Assign coach to /.test(t.title || '') && t.title.includes(a.name)))) { t.status = 'Done'; t.doneOn = T; } });
        const inj = db.injuries.filter((i) => i.athleteId === a.id && i.status !== 'Closed').length;
        AMS.notify({ toRole: 'coach', title: 'New athlete assigned', text: a.name + ' joins your ' + sq.name + ' squad (' + centreShort(sq.centreId) + '). Profile ' + a.profileCompletion + '% complete · ' + (inj ? plural(inj, 'open medical flag') : 'no open medical flags') + (moved ? ' · moved from another squad' : '') + '.', athleteId: a.id, module: 'athletes' });
        AMS.log({ type: 'onboarding', text: a.name + ' assigned to ' + coach.name + ' — ' + sq.name, athleteId: a.id });
        names.push(a.name);
      });
    });
    if (names.length) AMS.toast((names.length === 1 ? names[0] : plural(names.length, 'athlete')) + ' assigned to ' + coach.name + ' · coach notified', 'good');
    return names.length ? 'Assigned to ' + coach.name : null;
  });
  /** { athleteId | athleteIds, tag } */
  AMS.registerAction('athlete.addTag', function (p) {
    const tag = String(p.tag || '').trim(); if (!tag) return null;
    const ids = p.athleteIds || [p.athleteId];
    let n = 0;
    AMS.mutate((db) => {
      ids.forEach((id) => { const a = AMS.byId(db.athletes, id); if (a && !a.tags.includes(tag)) { a.tags.push(tag); n++; } });
      if (n) AMS.log({ type: 'tag', text: 'Tag "' + tag + '" added' + (ids.length === 1 ? ' to ' + (AMS.byId(db.athletes, ids[0]) || {}).name : ' to ' + plural(n, 'athlete')), athleteId: ids.length === 1 ? ids[0] : undefined });
    }, { toast: n ? 'Tagged ' + plural(n, 'athlete') + ' "' + tag + '"' : 'Already tagged', toastKind: n ? 'good' : 'info' });
    return n + ' tagged';
  });
  /** { athleteId, tag } */
  AMS.registerAction('athlete.removeTag', function (p) {
    const a = AMS.org.athlete(p.athleteId); if (!a) return null;
    AMS.mutate((db) => { const x = AMS.byId(db.athletes, p.athleteId); x.tags = x.tags.filter((t) => t !== p.tag); }, { toast: 'Removed "' + p.tag + '"', toastKind: 'info', log: { type: 'tag', text: 'Tag "' + p.tag + '" removed from ' + a.name, athleteId: a.id } });
    return 'Removed';
  });
  /** { athleteId | athleteIds, field?, to?: 'athlete'|'guardian' } → athlete task + notification */
  AMS.registerAction('athlete.requestMissing', requestMissing);
  /** { athleteId, field } — item received; raises profile completion. */
  AMS.registerAction('athlete.markReceived', function (p) {
    const a = AMS.org.athlete(p.athleteId); if (!a) return null;
    let ok = false;
    AMS.mutate((db) => { ok = markReceived(db, AMS.byId(db.athletes, p.athleteId), p.field); }, { toast: p.field + ' received for ' + a.name, log: { type: 'profile', text: p.field + ' received — ' + a.name, athleteId: a.id } });
    return ok ? 'Profile ' + AMS.org.athlete(p.athleteId).profileCompletion + '%' : 'Not missing';
  });
  /** { athleteId, docId, status, note? } */
  AMS.registerAction('athlete.docStatus', function (p) {
    const a = AMS.org.athlete(p.athleteId); if (!a) return null;
    const d = AMS.byId(a.docs, p.docId); if (!d) return null;
    AMS.mutate((db) => { const x = AMS.byId(AMS.byId(db.athletes, p.athleteId).docs, p.docId); x.status = p.status; x.reviewedBy = meName(); x.reviewedOn = T; if (p.note) x.reviewNote = p.note; },
      { toast: d.type + ' → ' + p.status, toastKind: p.status === 'Verified' ? 'good' : 'info', log: { type: 'document', text: a.name + ': ' + d.type + ' ' + p.status.toLowerCase() + (p.note ? ' (' + p.note + ')' : ''), athleteId: a.id } });
    return p.status;
  });
  /** { athleteId, docId, reason } — ask for a new upload. */
  AMS.registerAction('athlete.requestReupload', function (p) {
    const a = AMS.org.athlete(p.athleteId); if (!a) return null;
    const d = AMS.byId(a.docs, p.docId); if (!d) return null;
    AMS.mutate((db) => {
      const x = AMS.byId(db.athletes, p.athleteId); const dd = AMS.byId(x.docs, p.docId);
      dd.status = 'Returned'; dd.reviewNote = p.reason || 'Please upload a clearer copy';
      db.tasks.unshift({ id: AMS.uid('TSK'), title: 'Re-upload ' + d.type + ' — ' + a.name, ownerRole: 'athlete', module: 'athletes', status: 'Open', due: D.add(T, 5), created: T, athleteId: a.id, ref: 'DOC:' + d.id });
      if (a.id === db.meta.heroAthleteId) AMS.notify({ toRole: 'athlete', title: 'Please re-upload a document', text: d.type + ': ' + (p.reason || 'clearer copy needed'), athleteId: a.id });
    }, { toast: 'Re-upload requested from ' + first(a.name), toastKind: 'info', log: { type: 'document', text: 'Re-upload requested: ' + d.type + ' — ' + a.name, athleteId: a.id } });
    return 'Requested';
  });
  /** Renewal requests for expiring documents. { items: [{ athleteId, docId }] } */
  AMS.registerAction('athlete.requestRenewal', function (p) {
    const items = p.items || (p.athleteId ? [{ athleteId: p.athleteId, docId: p.docId }] : []);
    let n = 0;
    AMS.mutate((db) => {
      items.forEach((it) => {
        const a = AMS.byId(db.athletes, it.athleteId); if (!a) return;
        const d = AMS.byId(a.docs, it.docId); if (!d || d.renewalRequested) return;
        d.renewalRequested = T; n++;
        db.tasks.unshift({ id: AMS.uid('TSK'), title: 'Renew ' + d.type.toLowerCase() + ' — ' + a.name, ownerRole: 'athlete', module: 'athletes', status: 'Open', due: d.expires && d.expires > T ? d.expires : D.add(T, 7), created: T, athleteId: a.id, ref: 'RENEW:' + d.id });
        if (a.id === db.meta.heroAthleteId) AMS.notify({ toRole: 'athlete', title: 'Document renewal', text: d.type + ' expires ' + D.fmt(d.expires) + '. Please upload a renewed copy.', athleteId: a.id });
        if (items.length <= 3) AMS.log({ type: 'document', text: 'Renewal requested: ' + d.type + ' — ' + a.name + ' (expires ' + D.fmt(d.expires) + ')', athleteId: a.id });
      });
      if (items.length > 3 && n) AMS.log({ type: 'document', text: 'Renewal requests sent for ' + plural(n, 'document') });
    }, { toast: n ? 'Renewal requested for ' + plural(n, 'document') : 'Renewals already requested', toastKind: n ? 'good' : 'info' });
    return n + ' renewals requested';
  });
  /** Simulated upload with AI pre-check. { athleteId, type, quality } */
  AMS.registerAction('athlete.uploadDoc', function (p) {
    const a = AMS.org.athlete(p.athleteId); if (!a) return null;
    const ai = aiCheckDoc(p.type, p.quality || 'clear', a);
    AMS.mutate((db) => {
      const x = AMS.byId(db.athletes, p.athleteId);
      x.docs.forEach((d) => { if (d.type === p.type && d.status !== 'Superseded' && ai.ok) d.status = 'Superseded'; });
      const nd = { id: AMS.uid(x.id + '-D'), type: p.type, status: ai.ok ? (isClinical(p.type) ? 'Pending' : 'Pending') : 'Flagged', on: T, ai, uploadedBy: meName() };
      if (/fitness/i.test(p.type)) nd.expires = D.add(T, 365);
      x.docs.push(nd);
      if (ai.ok && x.missingFields.includes(p.type)) markReceived(db, x, p.type);
      db.tasks.forEach((t) => { if (t.status === 'Open' && t.athleteId === x.id && ((t.ref || '').startsWith('RENEW:') || (t.ref || '').startsWith('DOC:')) && t.title.toLowerCase().includes(p.type.toLowerCase()) && ai.ok) t.status = 'Done'; });
    }, { toast: ai.ok ? p.type + ' uploaded — AI pre-check passed (' + Math.round(ai.confidence * 100) + '%)' : p.type + ' flagged by AI: ' + ai.note, toastKind: ai.ok ? 'ai' : 'bad', log: { type: 'document', text: p.type + ' uploaded for ' + a.name + ' · AI ' + (ai.ok ? 'pass' : 'flag') + ' ' + Math.round(ai.confidence * 100) + '%', athleteId: a.id } });
    return ai.ok ? 'Passed' : 'Flagged';
  });
  /** { athleteId, patch } — ops profile edit; filling a missing field completes it. */
  AMS.registerAction('athlete.updateProfile', function (p) {
    const a = AMS.org.athlete(p.athleteId); if (!a) return null;
    const changed = [];
    AMS.mutate((db) => {
      const x = AMS.byId(db.athletes, p.athleteId);
      Object.keys(p.patch || {}).forEach((k) => { if (JSON.stringify(x[k]) !== JSON.stringify(p.patch[k])) { x[k] = p.patch[k]; changed.push(k); } });
      if (x.emergencyContact && x.emergencyContact.name && x.emergencyContact.phone) markReceived(db, x, 'Emergency contact');
      if (x.bankStatus === 'Received') markReceived(db, x, 'Bank details (stipend)');
    }, { toast: changed.length ? 'Profile saved — ' + changed.length + ' field' + (changed.length > 1 ? 's' : '') + ' updated' : 'No changes', toastKind: changed.length ? 'good' : 'info', log: { type: 'profile', text: a.name + ' profile updated', athleteId: a.id } });
    return 'Saved';
  });
  /** { athleteId, name, relation, phone } — record guardian consent (under-18). */
  AMS.registerAction('athlete.recordConsent', function (p) {
    const a = AMS.org.athlete(p.athleteId); if (!a) return null;
    AMS.mutate((db) => {
      const x = AMS.byId(db.athletes, p.athleteId);
      x.guardian = Object.assign({}, x.guardian || {}, { name: p.name || (x.guardian && x.guardian.name) || 'Guardian', relation: p.relation || (x.guardian && x.guardian.relation) || 'Parent', consent: true, consentOn: T });
      if (!x.docs.some((d) => d.type === 'Guardian consent' && d.status !== 'Superseded')) x.docs.push({ id: AMS.uid(x.id + '-D'), type: 'Guardian consent', status: 'Verified', on: T, ai: aiCheckDoc('Guardian consent', 'clear', x) });
      markReceived(db, x, 'Guardian consent');
      AMS.notify({ toRole: 'physio', title: 'Consent on file', text: 'Guardian consent recorded for ' + x.name + ' — medical records can now be created.', athleteId: x.id });
    }, { toast: 'Guardian consent recorded for ' + a.name, log: { type: 'profile', text: 'Guardian consent recorded for ' + a.name, athleteId: a.id } });
    return 'Consent recorded';
  });

  /* ================================================================== AI detectors */
  AMS.registerDetector('athletes.duplicate', function (ctx) {
    if (!['ops', 'director'].includes(ctx.role)) return [];
    return ctx.db.applications.filter((p) => OPEN_STAGES.includes(p.stage) && p.duplicateOf && !p.duplicateOf.resolved && appInScope(p)).map((p) => {
      const ex = AMS.org.athlete(p.duplicateOf.athleteId);
      if (!ex) return null;
      const val = { 'Same name': p.name, 'Same date of birth': D.fmt(p.dob) + ' ' + p.dob.slice(0, 4), 'Same centre': centreShort(p.centreId), 'Aadhaar last 4 digits match': 'xxxx ' + (String(ex.id).slice(-2) + '17') };
      return {
        id: 'dup:' + p.id, kind: 'ops', severity: p.duplicateOf.score >= 0.9 ? 'high' : 'med', module: 'athletes',
        title: p.name + ' (' + p.id + ') may already be athlete ' + ex.id,
        summary: Math.round(p.duplicateOf.score * 100) + '% match with ' + ex.name + ' — ' + squadName(ex.squadId) + ', enrolled ' + D.fmt(ex.enrolledOn) + (ex.enrolledOn.slice(0, 4) !== '2026' ? ' ' + ex.enrolledOn.slice(0, 4) : '') + '. Approving would split one athlete into two histories; merge keeps one record.',
        athleteIds: [ex.id], confidence: p.duplicateOf.score,
        evidence: p.duplicateOf.reasons.map((r) => ({ label: r, value: val[r] || 'match', tone: 'bad' })),
        actions: [{ label: 'Compare side by side', action: 'open.application', payload: { appId: p.id }, primary: true }, { label: 'Merge into ' + ex.id, action: 'application.merge', payload: { appId: p.id } }],
      };
    }).filter(Boolean);
  });
  AMS.registerDetector('athletes.unassignedCoach', function (ctx) {
    if (!['ops', 'director'].includes(ctx.role)) return [];
    const out = [];
    ctx.db.applications.filter((p) => p.stage === 'Approved' && !p.coachId && !p.athleteId && appInScope(p) && D.diff(T, approvedOn(p)) > 1).forEach((p) => {
      const subj = subjectFrom({ appId: p.id });
      const top = recommendCoaches(subj).find((o) => !o.blocked);
      const days = D.diff(T, approvedOn(p));
      out.push({
        id: 'nocoach:' + p.id, kind: 'ops', severity: days >= 3 ? 'high' : 'med', module: 'athletes',
        title: p.name + ' approved ' + days + ' days ago — still no coach',
        summary: 'Without a coach the athlete is not in any session plan or readiness view.' + (top ? ' Best fit: ' + top.coach.name + ' (' + top.squad.name + ', ' + top.size + '/' + top.cap + ' athletes, caseload ' + top.load + ').' : ''),
        athleteIds: [], confidence: 0.9,
        evidence: [{ label: 'Approved', value: D.rel(approvedOn(p)), tone: 'warn' }].concat(top ? top.reasons.slice(0, 3) : []),
        actions: [top && { label: 'Assign ' + top.coach.name, action: 'athlete.assignCoach', payload: { appId: p.id, squadId: top.squadId, coachId: top.coachId }, primary: true }, { label: 'Compare coaches', action: 'open.assignCoach', payload: { appId: p.id } }].filter(Boolean),
      });
    });
    AMS.scopedAthletes({ all: true }).filter((a) => a.enrollment === 'Active' && !a.coachId && D.diff(T, a.enrolledOn) > 1).forEach((a) => {
      const top = recommendCoaches(subjectFrom({ athleteId: a.id })).find((o) => !o.blocked);
      out.push({
        id: 'nocoach:' + a.id, kind: 'ops', severity: 'med', module: 'athletes',
        title: a.name + ' is active without a coach', summary: 'Enrolled ' + D.rel(a.enrolledOn) + '. Assign a coach so the athlete appears in session plans and readiness checks.',
        athleteIds: [a.id], confidence: 0.88, evidence: top ? top.reasons.slice(0, 3) : [],
        actions: [top && { label: 'Assign ' + top.coach.name, action: 'athlete.assignCoach', payload: { athleteId: a.id, squadId: top.squadId, coachId: top.coachId }, primary: true }, { label: 'Compare coaches', action: 'open.assignCoach', payload: { athleteId: a.id } }].filter(Boolean),
      });
    });
    return out;
  });
  AMS.registerDetector('athletes.consentMissing', function (ctx) {
    if (!['ops', 'director', 'physio', 'doctor'].includes(ctx.role)) return [];
    const out = [];
    AMS.scopedAthletes({ all: true }).filter((a) => ['Active', 'Verifying'].includes(a.enrollment) && noConsent(a)).forEach((a) => {
      out.push({
        id: 'consent:' + a.id, kind: 'ops', severity: 'high', module: 'athletes',
        title: a.name + ' (' + ageOf(a) + ') has no guardian consent on file',
        summary: 'Under-18 athletes need guardian consent (DPDP Act) before any medical data is recorded. Injury reports for ' + first(a.name) + ' are blocked until it arrives.',
        athleteIds: [a.id], confidence: 0.97, evidence: [{ label: 'Age', value: String(ageOf(a)), tone: 'warn' }, { label: 'Consent', value: 'missing', tone: 'bad' }],
        actions: [{ label: 'Request consent from guardian', action: 'athlete.requestMissing', payload: { athleteId: a.id, field: 'Guardian consent', to: 'guardian' }, primary: true }],
      });
    });
    if (['ops', 'director'].includes(ctx.role)) {
      ctx.db.applications.filter((p) => OPEN_STAGES.includes(p.stage) && noConsent(p) && appInScope(p)).forEach((p) => {
        out.push({
          id: 'consent:' + p.id, kind: 'ops', severity: 'med', module: 'athletes',
          title: p.name + ' (' + ageOf(p) + ', applicant) — guardian consent not received',
          summary: 'Application ' + p.id + ' cannot be approved until a guardian consents. Submitted ' + D.rel(p.submitted) + '.',
          athleteIds: [], confidence: 0.95, evidence: [{ label: 'Age', value: String(ageOf(p)), tone: 'warn' }, { label: 'Stage', value: p.stage, tone: 'info' }],
          actions: [{ label: 'Open application', action: 'open.application', payload: { appId: p.id }, primary: true }, { label: 'Return: consent needed', action: 'application.returnDocs', payload: { appId: p.id, reason: 'Guardian consent form missing — please have a parent/guardian sign' } }],
        });
      });
    }
    return out;
  });
  AMS.registerDetector('athletes.docExpiring', function (ctx) {
    if (!['ops', 'director', 'physio', 'doctor'].includes(ctx.role)) return [];
    const items = [];
    AMS.scopedAthletes().forEach((a) => liveDocs(a).forEach((d) => {
      if (/fitness/i.test(d.type) && d.expires && !d.renewalRequested && D.diff(d.expires, T) <= 14) items.push({ a, d, days: D.diff(d.expires, T) });
    }));
    if (!items.length) return [];
    items.sort((x, y) => x.days - y.days);
    const soon = items[0];
    const comp = ctx.db.competitions.filter((c) => c.date >= T).sort((x, y) => x.date.localeCompare(y.date))[0];
    return [{
      id: 'docexp:' + T + ':' + items.length, kind: 'ops', severity: items.some((x) => x.days <= 7) ? 'high' : 'med', module: 'athletes',
      title: plural(items.length, 'medical fitness certificate') + ' expire within 14 days',
      summary: 'Earliest: ' + soon.a.name + ' (' + D.fmt(soon.d.expires) + ', ' + D.rel(soon.d.expires) + '). An expired certificate blocks competition entry' + (comp ? ' — next: ' + comp.name + ' on ' + D.fmt(comp.date) : '') + '.',
      athleteIds: items.map((x) => x.a.id), confidence: 0.99,
      evidence: items.slice(0, 4).map((x) => ({ label: first(x.a.name) + ' ' + x.a.name.split(' ').slice(-1)[0][0] + '.', value: x.days < 0 ? 'expired' : x.days + 'd', tone: x.days <= 7 ? 'bad' : 'warn' })),
      actions: [{ label: 'Send ' + plural(items.length, 'renewal request'), action: 'athlete.requestRenewal', payload: { items: items.map((x) => ({ athleteId: x.a.id, docId: x.d.id })) }, primary: true }, { label: 'Open documents', action: 'go', payload: { module: 'athletes', params: { tab: 'documents' } } }],
    }];
  });
  AMS.registerDetector('athletes.profileGaps', function (ctx) {
    if (!['ops', 'coach', 'director'].includes(ctx.role)) return [];
    const by = AMS.groupBy(ctx.athletes.filter((a) => a.profileCompletion < 90 && a.missingFields.length), 'squadId');
    return Object.entries(by).filter(([, l]) => l.length >= 5).sort((x, y) => y[1].length - x[1].length).slice(0, 2).map(([sqId, list]) => {
      const size = ctx.athletes.filter((a) => a.squadId === sqId).length;
      const fields = AMS.groupBy(list.flatMap((a) => a.missingFields), (f) => f);
      const top = Object.entries(fields).sort((x, y) => y[1].length - x[1].length)[0];
      return {
        id: 'gaps:' + sqId + ':' + list.length, kind: 'ops', severity: list.length / size >= 0.6 ? 'med' : 'low', module: 'athletes',
        title: squadName(sqId) + ' (' + centreShort((AMS.org.squad(sqId) || {}).centreId) + '): ' + list.length + ' of ' + size + ' profiles below 90%',
        summary: 'Most common gap: ' + top[0] + ' (' + top[1].length + '). Incomplete records weaken selection, travel and insurance paperwork.',
        athleteIds: list.map((a) => a.id), confidence: 0.86,
        evidence: [{ label: 'Below 90%', value: list.length + '/' + size, tone: 'warn' }, { label: 'Avg profile', value: Math.round(AMS.mean(list.map((a) => a.profileCompletion))) + '%', tone: 'warn' }, { label: top[0], value: String(top[1].length), tone: 'info' }],
        actions: [{ label: 'Send reminders to ' + list.length, action: 'athlete.requestMissing', payload: { athleteIds: list.map((a) => a.id) }, primary: true }, { label: 'Open profile completion', action: 'go', payload: { module: 'athletes', params: { tab: 'completion' } } }],
      };
    });
  });

  /* Live: the AI pre-check finishes on documents that were still being read (e.g. Bhavani Devi R., submitted at 06:58). */
  AMS.onTick(function (n) {
    if (n % 3 !== 0) return;
    AMS.db.applications.forEach((p) => {
      if (!OPEN_STAGES.includes(p.stage)) return;
      const d = p.docs.find((x) => !x.ai && x.status === 'Pending');
      if (!d) return;
      d.ai = aiCheckDoc(d.type, 'clear', p);
      p.history.push({ date: T, text: 'AI pre-check finished: ' + d.type + ' — ' + d.ai.note + ' (' + Math.round(d.ai.confidence * 100) + '%)', by: 'AI' });
    });
  });

  /* ================================================================== small shared UI */
  function Banner({ tone, icon, children, actions }) {
    return html`<div className=${'ath-banner ' + (tone || '')}><span style=${{ color: tone && tone !== 'ai' ? 'var(--' + tone + ')' : tone === 'ai' ? 'var(--ai)' : 'var(--fg-3)', flex: 'none', marginTop: 1 }}><${I} name=${icon || 'info'} size=${16} /></span><div className="grow">${children}</div>${actions && html`<div className="row tight wrap" style=${{ flex: 'none' }}>${actions}</div>`}</div>`;
  }
  function Locked({ title, children }) {
    return html`<div className="ath-banner"><span style=${{ color: 'var(--fg-3)', flex: 'none' }}><${I} name="lock" size=${16} /></span><div className="col tight grow" style=${{ gap: 2 }}><b style=${{ fontSize: 12.5 }}>${title}</b><span className="small muted">${children}</span></div></div>`;
  }
  function DocStatusPill({ d }) { const s = docStatus(d); return html`<${UI.Pill} tone=${DOC_TONE[s]} dot>${s}<//>`; }
  function AiResult({ ai, compact }) {
    if (!ai) return html`<span className="row tight small faint"><span className="ath-spin" />AI reading document…</span>`;
    return html`<span className="col tight" style=${{ gap: 1, minWidth: 0 }}>
      <span className="row tight" style=${{ gap: 5 }}><${I} name=${ai.ok ? 'shield-check' : 'alert'} size=${13} style=${{ color: ai.ok ? 'var(--good)' : 'var(--bad)' }} /><span className=${'small ' + (ai.ok ? 'good' : 'bad')} style=${{ fontWeight: 600 }}>${ai.ok ? 'Pass' : 'Flag'}</span><span className="tiny faint tnum">${Math.round(ai.confidence * 100)}% conf.</span></span>
      ${!compact && html`<span className="tiny muted" style=${{ overflowWrap: 'anywhere' }}>${ai.note}</span>`}
    </span>`;
  }
  function SlaPill({ p }) {
    if (!OPEN_STAGES.includes(p.stage)) return html`<span className="tiny faint">${p.stage === 'Approved' ? 'Approved ' + D.rel(approvedOn(p)) : (p.decidedOn ? p.stage + ' ' + D.rel(p.decidedOn) : p.stage)}</span>`;
    const d = D.diff(T, p.submitted);
    const tone = d > SLA_DAYS ? 'bad' : d >= SLA_DAYS - 1 ? 'warn' : 'good';
    return html`<${UI.Pill} tone=${tone} title=${'Submitted ' + D.fmt(p.submitted) + ' · target ' + SLA_DAYS + ' days'}><${I} name="clock" size=${11} />${d}d / ${SLA_DAYS}d<//>`;
  }
  function Stat({ label, value, sub, tone }) {
    return html`<div className="ath-stat"><span>${label}</span><b className=${tone || ''}>${value}</b>${sub && html`<span>${sub}</span>`}</div>`;
  }
  function Boundary({ name, children }) {
    const EB = AMS.ErrorBoundary;
    return EB ? html`<${EB} name=${name}>${children}<//>` : html`<${Frag}>${children}<//>`;
  }

  /* Tag editor with suggestions (inline). */
  function TagEditor({ a, editable }) {
    const { db } = AMS.useStore();
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const all = useMemo(() => [...new Set(TAG_POOL.concat(db.athletes.flatMap((x) => x.tags || [])))], [db.athletes.length]);
    const sugg = all.filter((t) => !a.tags.includes(t) && (!q || t.toLowerCase().includes(q.toLowerCase()))).slice(0, 8);
    const add = (t) => { if (!t.trim()) return; AMS.runAction('athlete.addTag', { athleteId: a.id, tag: t.trim() }); setQ(''); };
    return html`<div className="row wrap tight">
      ${a.tags.map((t) => html`<${UI.Tag} key=${t} onRemove=${editable ? () => AMS.runAction('athlete.removeTag', { athleteId: a.id, tag: t }) : null}><${I} name="tag" size=${10} />${t}<//>`)}
      ${a.tags.length === 0 && html`<span className="tiny faint">No tags</span>`}
      ${editable && !open && html`<button className="btn ghost xs" onClick=${() => setOpen(true)}><${I} name="plus" size=${12} />Tag</button>`}
      ${editable && open && html`<span className="col tight" style=${{ gap: 4, width: '100%' }}>
        <span className="row tight"><input className="input" style=${{ height: 26, fontSize: 12, maxWidth: 220 }} value=${q} placeholder="Type or pick a tag" onChange=${(e) => setQ(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') add(q); if (e.key === 'Escape') setOpen(false); }} /><button className="btn xs primary" disabled=${!q.trim()} onClick=${() => add(q)}>Add</button><button className="btn ghost xs" onClick=${() => { setOpen(false); setQ(''); }}>Done</button></span>
        <span className="row wrap tight">${sugg.map((t) => html`<button key=${t} className="ath-chip" style=${{ height: 22, fontSize: 11 }} onClick=${() => add(t)}><${I} name="plus" size=${10} />${t}</button>`)}</span>
      </span>`}
    </div>`;
  }

  /* ================================================================== GLOBAL ATHLETE DRAWER */
  function AthleteDrawer({ athleteId, tab }) {
    const { db, ui, v } = AMS.useStore();
    const [t, setT] = useState(tab || 'overview');
    useEffect(() => { if (tab) setT(tab); }, [tab, athleteId]);
    const a = AMS.org.athlete(athleteId);
    if (!a) return html`<${Frag}><${UI.DrawerHead} title="Athlete not found" /><div className="drawer-b"><${UI.Empty} title=${'No athlete with ID ' + athleteId} /></div><//>`;
    AMS.setFocus({ athleteId: a.id });
    const role = ui.role;
    const own = role === 'athlete' && a.id === db.meta.heroAthleteId;
    if (role === 'athlete' && !own) return html`<${Frag}><${UI.DrawerHead} title="Not available" /><div className="drawer-b"><${Locked} title="Athletes can only open their own profile">Your coach and support staff can see the whole squad.<//></div><//>`;
    const scoped = own || inRoleScope(a);
    const perf = (P.perf() && scoped) || own;
    const age = ageOf(a), ag = AMS.calc.ageGroup(age);
    const sq = AMS.org.squad(a.squadId);
    const ta = a.tempAssignment;
    const extTabs = scoped ? AMS.athleteTabs.filter((x) => !x.roles || x.roles.includes(role)) : [];
    const issues = docIssues(a).filter((d) => canSeeDoc(d, a)).length;
    const tabs = [{ id: 'overview', label: 'Overview' }].concat(extTabs.map((x) => ({ id: x.id, label: x.label })), [{ id: 'documents', label: 'Documents', count: issues || null }, { id: 'timeline', label: 'Timeline' }, { id: 'profile', label: 'Profile' }]);
    const cur = tabs.some((x) => x.id === t) ? t : 'overview';
    const ext = extTabs.find((x) => x.id === cur);
    const u18NoConsent = noConsent(a);
    const injuryRegistered = !!AMS.actions['injury.report'];
    const injuryReason = !injuryRegistered ? 'Medical module not loaded' : u18NoConsent ? 'Guardian consent required before medical data can be recorded' : !scoped ? 'Outside your scope' : '';
    const enrolTone = { Active: 'accent' }[a.enrollment];
    return html`<${Frag}>
      <${UI.DrawerHead} avatar=${html`<${UI.Avatar} name=${a.name} size=${46} />`} title=${a.name}
        sub=${html`<span><span className="mono">${a.id}</span> · ${age} yrs (${ag}) · ${a.gender === 'F' ? 'Female' : 'Male'} · ${a.sport} — ${a.events}</span>`}
        actions=${perf && a.enrollment === 'Active' ? html`<span className="hide-sm"><${UI.Readiness} athlete=${a} size=${42} showLabel=${true} /></span>` : null}>
        <div className="row wrap tight" style=${{ marginTop: 4 }}>
          <span className="small muted">${sq ? sq.name : '—'} · ${centreShort(a.centreId)} · Coach ${staffName(a.coachId)}</span>
        </div>
        <div className="row wrap tight" style=${{ marginTop: 4 }}>
          <${UI.Pill} tone=${enrolTone} className=${enrolTone ? '' : 'outline'} title="Enrollment — is this athlete in the programme?">${a.enrollment}<//>
          <span title=${'Availability — can train today? ' + availabilityText(a)}><${UI.AvailabilityPill} value=${a.availability} /></span>
          ${a.availability !== 'Available' && html`<span className="tiny muted">${availabilityText(a)}</span>`}
          ${a.verification && a.verification.status === 'Verified' && html`<${UI.Pill} tone="good" title=${'Verified by ' + a.verification.by + ' on ' + D.fmt(a.verification.on)}><${I} name="shield-check" size=${11} />Verified<//>`}
          ${u18NoConsent && html`<${UI.Pill} tone="bad"><${I} name="alert" size=${11} />No guardian consent<//>`}
        </div>
      <//>
      <div className="drawer-b">
        ${perf && a.enrollment === 'Active' && html`<div className="row wrap tight show-sm" style=${{ display: 'none' }}><${UI.Readiness} athlete=${a} size=${34} showLabel=${true} /></div>`}
        <div className="row between wrap" style=${{ gap: 10 }}>
          <div className="row wrap tight">
            <button className="btn sm" onClick=${() => AMS.openModal('athlete-message', { athleteId: a.id })}><${I} name="message" size=${14} />Message</button>
            ${P.edit() && html`<button className="btn sm" onClick=${() => AMS.openModal('assign-coach', { athleteId: a.id })}><${I} name="whistle" size=${14} />${a.coachId ? 'Change coach' : 'Assign coach'}</button>`}
            ${role !== 'ops' && html`<button className="btn sm" disabled=${!!injuryReason} title=${injuryReason || 'Open the injury report flow'} onClick=${() => AMS.runAction('injury.report', { athleteId: a.id })}><${I} name="medical" size=${14} />Report injury</button>`}
            <${UI.AskCopilot} prompt=${'Summarise ' + a.name} label="Ask Copilot" />
          </div>
        </div>
        <div className="col tight" style=${{ gap: 4 }}><${TagEditor} a=${a} editable=${P.tag() && scoped} /></div>
        ${ta && html`<${Banner} tone=${ta.active ? 'info' : 'ai'} icon="pin">
          <b>${ta.active ? 'On temporary assignment' : 'Scheduled temporary assignment'}: ${ta.label}</b>, ${centreShort(ta.centreId)} · ${D.fmt(ta.from)} – ${D.fmt(ta.to)}${!ta.active && ta.from > T ? ' (starts ' + D.rel(ta.from) + ')' : ''}.
          <span className="muted"> Home centre (${centreShort(a.centreId)}) keeps the full record; the camp coach (${staffName((AMS.org.squad(ta.squadId) || {}).coachId)}) sees training and readiness ${ta.active ? 'now' : 'during the camp'}. Medical stays with the home medical team.</span>
        <//>`}
        ${!scoped && html`<${Locked} title="Outside your scope — directory view only">${a.name} is not in ${role === 'coach' ? 'your squads' : 'your centre'}. Training, readiness and medical details are hidden; contact ${staffName(a.coachId)} for access.<//>`}
        <${UI.Tabs} tabs=${tabs} value=${cur} onChange=${setT} />
        ${cur === 'overview' && html`<${OverviewTab} a=${a} perf=${perf} scoped=${scoped} own=${own} v=${v} />`}
        ${ext && html`<${Boundary} name=${'athleteTab:' + ext.id}><${ext.component} athlete=${a} /><//>`}
        ${cur === 'documents' && html`<${DocumentsTab} a=${a} />`}
        ${cur === 'timeline' && html`<${TimelineTab} a=${a} scoped=${scoped} own=${own} />`}
        ${cur === 'profile' && html`<${ProfileTab} a=${a} key=${a.id + ':' + v} />`}
      </div>
    <//>`;
  }

  function OverviewTab({ a, perf, scoped, own }) {
    const { db, ui } = AMS.useStore();
    const role = ui.role;
    const brief = athleteBrief(a);
    const age = ageOf(a);
    const sq = AMS.org.squad(a.squadId);
    const wl = (a.wellness || []).slice(14, 28);
    const wSeries = wl.map((w, i) => ({ x: D.fmt(D.add(T, i - 13)), y: w ? AMS.calc.wellnessScore(w) : null }));
    const base = Math.round(AMS.calc.wellnessBaseline(a) || 0);
    const loads14 = (a.loads || []).slice(27, 41).map((l, i) => ({ label: D.dow(AMS.series.loadDate(27 + i)).slice(0, 2), value: l }));
    const rd = AMS.calc.readiness(a), r = AMS.calc.acwr(a), risk = AMS.calc.risk(a);
    const checkins7 = (a.wellness || []).slice(21, 28).filter(Boolean).length;
    const insights = scoped ? AMS.ai.insights({ athleteId: a.id, limit: 3 }) : [];
    const tasks = db.tasks.filter((t) => t.athleteId === a.id && t.status === 'Open');
    const lastTest = P.tests() ? db.tests.filter((t) => t.athleteId === a.id).sort((x, y) => y.date.localeCompare(x.date))[0] : null;
    const pbs = a.pb ? Object.entries(a.pb).map(([k, val]) => k + ' ' + val).join(' · ') : null;
    const requested = (f) => db.tasks.find((t) => t.ref === reqRef(a.id, f) && t.status === 'Open');
    const reqFrom = age < 18 ? 'guardian' : 'athlete';
    const canReq = P.request() && scoped;
    const checklist = [
      { label: 'Identity proof (Aadhaar)', done: liveDocs(a).some((d) => /Aadhaar/.test(d.type) && docStatus(d) === 'Verified') },
      { label: 'Birth certificate', done: liveDocs(a).some((d) => /Birth/.test(d.type) && docStatus(d) === 'Verified') },
      { label: 'Medical fitness certificate (valid)', done: liveDocs(a).some((d) => /fitness/i.test(d.type) && ['Verified', 'Expiring'].includes(docStatus(d))) },
      age < 18 ? { label: 'Guardian consent', done: !!(a.guardian && a.guardian.consent), field: 'Guardian consent' } : null,
    ].filter(Boolean).concat(a.missingFields.filter((f) => f !== 'Guardian consent').map((f) => ({ label: f, done: false, field: f })));
    const showStats = perf ? [
      ['Readiness', rd.score, AMS.calc.bandLabel(rd.band) + (rd.checkedIn ? ' · checked in' : ' · no check-in'), rd.band],
      ['ACWR', r.toFixed(2), AMS.calc.acwrLabel(r), AMS.calc.acwrBand(r)],
      ['This week', AMS.calc.weekLoad(a), 'AU · last week ' + AMS.calc.weekLoad(a, 1)],
      ['Injury risk', risk.score, risk.factors.slice(0, 2).map((f) => f.label).join(', ') || 'no flags', risk.band],
      ['Check-ins', checkins7 + '/7', 'last 7 days', checkins7 >= 6 ? 'good' : checkins7 >= 4 ? 'warn' : 'bad'],
      ['Age group', a.dob ? age : '—', AMS.calc.ageGroup(age) + ' · ' + a.level],
      ['Height · weight', a.heightCm ? a.heightCm + ' cm' : '—', a.weightKg ? a.weightKg + ' kg · ' + (a.dominantSide || '—') + ' side' : '—'],
      ['Best marks', pbs ? Object.values(a.pb)[0] : (lastTest && lastTest.results.sprint30 ? lastTest.results.sprint30 + ' s' : '—'), pbs || (lastTest ? '30 m sprint · ' + D.fmt(lastTest.date) : 'no tests')],
    ] : [
      ['Age group', age, AMS.calc.ageGroup(age) + ' · ' + a.level],
      ['Enrolled', D.fmt(a.enrolledOn), a.enrolledOn.slice(0, 4) + ' · ' + D.rel(a.enrolledOn)],
      ['Profile', a.profileCompletion + '%', a.missingFields.length ? plural(a.missingFields.length, 'item') + ' missing' : 'complete', pcTone(a.profileCompletion)],
      ['Documents', liveDocs(a).filter((d) => docStatus(d) === 'Verified').length + '/' + liveDocs(a).length, 'verified', docIssues(a).length ? 'warn' : 'good'],
      ['Coach', first(staffName(a.coachId)), a.coachId ? staffName(a.coachId) : 'assign a coach', a.coachId ? '' : 'bad'],
      ['Squad', sq ? squadSize(sq.id) : '—', sq ? sq.name + ' · cap ' + (CAPACITY[sq.ageGroup] || 12) : '—'],
      ['Height · weight', a.heightCm ? a.heightCm + ' cm' : '—', a.weightKg ? a.weightKg + ' kg' : '—'],
      ['Devices', (a.devices || []).length, (a.devices || []).join(', ') || 'none paired'],
    ];
    return html`<div className="col loose">
      <div className="ai-box col tight" style=${{ gap: 8 }}>
        <div className="row between wrap"><span className="row tight"><${UI.AIChip} label="AI summary" /><span className="tiny faint">generated ${AMS.clockTime()} from check-ins, load, medical${role === 'ops' ? ' (hidden for your role)' : ''}, documents</span></span><${UI.AskCopilot} prompt=${'What should I do about ' + a.name + ' today?'} label="Ask a follow-up" /></div>
        <div style=${{ fontSize: 13, lineHeight: 1.55 }}>${brief.text}</div>
        <${UI.Evidence} items=${brief.evidence} />
      </div>
      <div className="grid g4 keep" style=${{ gap: 8 }}>${showStats.map(([l, val, sub, tone]) => html`<${Stat} key=${l} label=${l} value=${val} sub=${sub} tone=${tone} />`)}</div>
      ${perf && a.enrollment === 'Active' && rd.factors.length > 0 && html`<div className="row wrap tight"><span className="tiny faint">Readiness factors:</span>${rd.factors.map((f, i) => html`<span key=${i} className="evidence"><span className=${'dot ' + f.tone} style=${{ width: 6, height: 6 }} />${f.label} <b>${f.value}</b></span>`)}</div>`}
      ${perf && html`<div className="grid g2">
        <${UI.Card} title="Wellness, last 14 days" icon="pulse" hint=${'own normal ' + (base || '—')}>
          ${wSeries.some((p) => p.y != null) ? html`<${UI.LineChart} series=${[{ name: 'Wellness score', data: wSeries, tone: rd.band === 'bad' ? 'bad' : 'accent', area: true }]} refs=${base ? [{ y: base, label: 'Own normal', tone: 'info' }] : []} height=${150} yMin=${0} yMax=${100} />` : html`<${UI.Empty} icon="pulse" title="No check-ins yet">New athletes start checking in from their first morning.<//>`}
        <//>
        <${UI.Card} title="Daily load (sRPE), 14 days" icon="bolt" hint=${'ACWR ' + r.toFixed(2)}>
          ${loads14.some((x) => x.value > 0) ? html`<${UI.BarChart} data=${loads14} height=${150} tone=${AMS.calc.acwrBand(r) === 'bad' ? 'warn' : 'accent'} />` : html`<${UI.Empty} icon="bolt" title="No sessions recorded yet" />`}
        <//>
      </div>`}
      <div className="grid g2">
        <${UI.Card} title="Two statuses" icon="layers" hint="kept separate on purpose">
          <div className="col" style=${{ gap: 10 }}>
            <div className="row top" style=${{ gap: 10 }}><${UI.EnrollmentPill} value=${a.enrollment} /><span className="small muted grow"><b>Enrollment</b> — is ${first(a.name)} in the programme? Changes rarely (enrolled ${D.fmt(a.enrolledOn)}${a.enrolledOn.slice(0, 4) !== '2026' ? ' ' + a.enrolledOn.slice(0, 4) : ''}).</span></div>
            <div className="row top" style=${{ gap: 10 }}><${UI.AvailabilityPill} value=${a.availability} /><span className="small muted grow"><b>Availability</b> — can ${first(a.name)} train today? ${availabilityText(a)}.</span></div>
            ${a.enrollment === 'Active' && a.availability !== 'Available' && html`<${Banner} tone="warn" icon="info"><b>Active but ${a.availability.toLowerCase()}.</b> ${first(a.name)} still counts as an enrolled athlete in programme reports, but is excluded from full-training numbers today. Keeping the two apart keeps reports honest.<//>`}
          </div>
        <//>
        <${UI.Card} title="Assignment" icon="pin">
          <div className="col" style=${{ gap: 8 }}>
            <div className="row top" style=${{ gap: 10 }}><${UI.Pill} tone="accent">Home<//><span className="small grow"><b>${sq ? sq.name : '—'}</b> · ${(AMS.org.centre(a.centreId) || {}).name || '—'}<br /><span className="muted">Coach ${staffName(a.coachId)} · full record, medical and documents live here</span></span></div>
            ${a.tempAssignment ? html`<div className="row top" style=${{ gap: 10 }}><${UI.Pill} tone=${a.tempAssignment.active ? 'info' : 'ai'}>${a.tempAssignment.active ? 'Now' : 'From ' + D.fmt(a.tempAssignment.from)}<//><span className="small grow"><b>${a.tempAssignment.label}</b> · ${(AMS.org.centre(a.tempAssignment.centreId) || {}).name}<br /><span className="muted">${D.fmt(a.tempAssignment.from)} – ${D.fmt(a.tempAssignment.to)} · camp coach sees training & readiness only</span></span></div>` : html`<span className="small faint">No temporary assignment.</span>`}
            ${a.discoveredAt && html`<div className="row top" style=${{ gap: 10 }}><${UI.Pill} tone="info">Found<//><span className="small grow muted">${a.discoveredAt.event}, ${D.fmt(a.discoveredAt.date)} — ${a.discoveredAt.by}</span></div>`}
          </div>
        <//>
      </div>
      <div className="grid g2">
        <${UI.Card} title="Profile completion" icon="clipboard" hint=${a.profileCompletion + '%'} actions=${canReq && a.missingFields.length > 0 ? html`<button className="btn xs" onClick=${() => AMS.runAction('athlete.requestMissing', { athleteId: a.id })}><${I} name="send" size=${12} />Request all from ${reqFrom}</button>` : null}>
          <${UI.Meter} value=${a.profileCompletion} tone=${pcTone(a.profileCompletion)} />
          <div className="col" style=${{ gap: 0, marginTop: 8 }}>
            ${checklist.map((c) => { const rq = c.field && requested(c.field); return html`<div key=${c.label} className="ath-check">
              <${I} name=${c.done ? 'check' : 'alert'} size=${14} style=${{ color: c.done ? 'var(--good)' : 'var(--warn)', flex: 'none' }} />
              <span className=${'grow ' + (c.done ? 'muted' : '')}>${c.label}${rq && html`<span className="tiny faint"> · requested ${D.rel(rq.created)} from ${rq.requestedFrom || reqFrom}</span>`}</span>
              ${!c.done && c.field && canReq && !rq && html`<button className="btn xs" onClick=${() => AMS.runAction('athlete.requestMissing', { athleteId: a.id, field: c.field })}>Request from ${reqFrom}</button>`}
              ${!c.done && c.field && P.edit() && (c.field !== 'Blood test report') && html`<button className="btn xs ghost" onClick=${() => c.field === 'Guardian consent' ? AMS.runAction('athlete.recordConsent', { athleteId: a.id }) : AMS.runAction('athlete.markReceived', { athleteId: a.id, field: c.field })}><${I} name="check" size=${12} />Received</button>`}
              ${!c.done && c.field === 'Blood test report' && (P.edit() || AMS.medicalFull()) && html`<button className="btn xs ghost" title="Clinical document — contents go to medical staff" onClick=${() => AMS.runAction('athlete.markReceived', { athleteId: a.id, field: c.field })}><${I} name="check" size=${12} />Received</button>`}
            </div>`; })}
          </div>
        <//>
        <${UI.Card} title="Guardian & consent" icon="shield">
          ${age < 18 ? html`<div className="col" style=${{ gap: 8 }}>
            ${a.guardian ? html`<${UI.DL} cols=${2} items=${[['Guardian', a.guardian.name], ['Relation', a.guardian.relation], ['Consent', a.guardian.consent ? 'Given ' + D.fmt(a.guardian.consentOn) : 'Not given'], ['Required because', 'Athlete is ' + age + ' (under 18)']]} />` : html`<span className="small bad">No guardian recorded.</span>`}
            ${a.guardian && a.guardian.consent ? html`<${Banner} tone="good" icon="shield-check">Consent on file — medical staff may record injuries and treatment notes (DPDP Act).<//>` : html`<${Banner} tone="bad" icon="lock" actions=${P.edit() ? html`<button className="btn xs" onClick=${() => AMS.runAction('athlete.recordConsent', { athleteId: a.id })}>Record consent</button>` : canReq ? html`<button className="btn xs" onClick=${() => AMS.runAction('athlete.requestMissing', { athleteId: a.id, field: 'Guardian consent', to: 'guardian' })}>Request</button>` : null}>Consent required before medical data can be recorded. Injury reporting is blocked for ${first(a.name)}.<//>`}
          </div>` : html`<div className="col tight"><span className="small muted">${first(a.name)} is ${age} — an adult; consents for themselves.</span>${a.emergencyContact ? html`<span className="small">Emergency contact: <b>${a.emergencyContact.name}</b> · ${a.emergencyContact.phone}</span>` : html`<span className="small warn">No emergency contact on file.</span>`}</div>`}
        <//>
      </div>
      ${(insights.length > 0 || tasks.length > 0) && html`<div className="grid g2">
        <${UI.Card} title="AI flags for this athlete" ai=${true} flush=${true}><${UI.InsightList} insights=${insights} compact=${true} empty="No AI flags" /><//>
        <${UI.Card} title="Open tasks" icon="clipboard" hint=${String(tasks.length)} flush=${true}>
          <div className="list">${tasks.length === 0 ? html`<${UI.Empty} icon="check" title="No open tasks" />` : tasks.slice(0, 6).map((tk) => html`<div key=${tk.id} className="list-item"><${I} name="clipboard" size=${14} style=${{ color: 'var(--fg-3)' }} /><span className="col tight grow" style=${{ gap: 0 }}><span className="small" style=${{ fontWeight: 600 }}>${tk.title}</span><span className="tiny faint">${AMS.roleLabel(tk.ownerRole)} · due ${D.fmt(tk.due)} (${D.rel(tk.due)})</span></span></div>`)}</div>
        <//>
      </div>`}
    </div>`;
  }

  function DocumentsTab({ a }) {
    const { ui } = AMS.useStore();
    const [type, setType] = useState('Medical fitness certificate');
    const [quality, setQuality] = useState('clear');
    const [checking, setChecking] = useState(false);
    const [result, setResult] = useState(null);
    const [showOld, setShowOld] = useState(false);
    const role = ui.role;
    const all = (a.docs || []).filter((d) => showOld || d.status !== 'Superseded');
    const visible = all.filter((d) => canSeeDoc(d, a));
    const hidden = all.length - visible.length;
    const canUpload = P.docsAll() || P.docsMed() || (role === 'athlete' && a.id === hero());
    const types = (P.docsMed() ? ['Medical fitness certificate', 'Blood test report'] : ['Aadhaar card', 'Birth certificate', 'Medical fitness certificate', 'Guardian consent', 'Passport', 'Previous coach reference', 'Previous competition records']);
    const upload = () => {
      setChecking(true); setResult(null);
      setTimeout(() => {
        const ai = aiCheckDoc(type, quality, a);
        AMS.runAction('athlete.uploadDoc', { athleteId: a.id, type, quality });
        setChecking(false); setResult({ type, ai });
      }, 1100);
    };
    if (!P.docsAll() && !P.docsMed() && role !== 'athlete') {
      const ok = liveDocs(a).filter((d) => docStatus(d) === 'Verified').length;
      return html`<div className="col">
        <${Locked} title="Documents are restricted to Operations and medical staff">Your role (${AMS.roleLabel(role)}) sees verification status only — identity papers, consent forms and certificates are handled by Operations (product doc §5, “Who sees what”).<//>
        <div className="grid g3 keep" style=${{ gap: 8 }}>
          <${Stat} label="Verified" value=${ok + '/' + liveDocs(a).length} sub="documents" tone=${ok === liveDocs(a).length ? 'good' : 'warn'} />
          <${Stat} label="Identity" value=${a.verification ? a.verification.status : '—'} sub=${a.verification ? 'by ' + a.verification.by : ''} tone="good" />
          <${Stat} label="Needs attention" value=${docIssues(a).length} sub="handled by Operations" tone=${docIssues(a).length ? 'warn' : 'good'} />
        </div>
      </div>`;
    }
    return html`<div className="col">
      ${hidden > 0 && html`<${Locked} title=${plural(hidden, 'document') + ' hidden'}>${P.docsMed() ? 'Medical staff see medical documents only (fitness certificates, lab reports).' : 'Restricted.'}<//>`}
      <div className="row between wrap"><span className="small muted">${plural(visible.length, 'document')} · AI pre-checks every upload for legibility, signatures and consistency with the profile</span><${UI.Toggle} id=${'old-' + a.id} checked=${showOld} onChange=${setShowOld} label="Show superseded" /></div>
      <${UI.Table} compact=${true} rows=${visible} empty="No documents" columns=${[
        { key: 'type', label: 'Document', render: (d) => html`<span className="col tight" style=${{ gap: 0 }}><span style=${{ fontWeight: 600 }} className=${d.status === 'Superseded' ? 'faint' : ''}>${d.type}</span><span className="tiny faint">${d.on ? 'Uploaded ' + D.fmt(d.on) : ''}${isClinical(d.type) && P.docsAll() ? ' · clinical: contents restricted' : ''}</span></span>` },
        { key: 'st', label: 'Status', sort: (d) => docStatus(d), render: (d) => html`<span className="col tight" style=${{ gap: 2 }}><${DocStatusPill} d=${d} />${d.renewalRequested && html`<span className="tiny faint">renewal asked ${D.rel(d.renewalRequested)}</span>`}${d.reviewNote && html`<span className="tiny faint">${d.reviewNote}</span>`}</span>` },
        { key: 'exp', label: 'Expires', hideSm: true, sort: (d) => d.expires || '9999', render: (d) => d.expires ? html`<span className="col tight" style=${{ gap: 0 }}><span className="small tnum">${D.fmt(d.expires)} ${d.expires.slice(0, 4) !== '2026' ? d.expires.slice(0, 4) : ''}</span><span className=${'tiny ' + (D.diff(d.expires, T) <= 14 ? 'bad' : 'faint')}>${D.rel(d.expires)}</span></span>` : html`<span className="faint">—</span>` },
        { key: 'ai', label: 'AI verification', sort: false, render: (d) => html`<${AiResult} ai=${d.ai} />` },
        { key: 'act', label: '', sort: false, render: (d) => canActDoc(d) && d.status !== 'Superseded' ? html`<span className="row tight wrap" style=${{ justifyContent: 'flex-end' }}>
          ${docStatus(d) !== 'Verified' && docStatus(d) !== 'Expired' && html`<button className="btn xs" onClick=${() => AMS.runAction('athlete.docStatus', { athleteId: a.id, docId: d.id, status: 'Verified' })}><${I} name="check" size=${12} />Verify</button>`}
          ${d.status !== 'Flagged' && html`<button className="btn xs ghost" onClick=${() => AMS.runAction('athlete.docStatus', { athleteId: a.id, docId: d.id, status: 'Flagged', note: d.ai && !d.ai.ok ? d.ai.note : 'Flagged on review' })}><${I} name="flag" size=${12} />Flag</button>`}
          ${['Expiring', 'Expired'].includes(docStatus(d)) && !d.renewalRequested ? html`<button className="btn xs" onClick=${() => AMS.runAction('athlete.requestRenewal', { items: [{ athleteId: a.id, docId: d.id }] })}><${I} name="refresh" size=${12} />Renewal</button>` : html`<button className="btn xs ghost" onClick=${() => AMS.runAction('athlete.requestReupload', { athleteId: a.id, docId: d.id, reason: d.ai && !d.ai.ok ? d.ai.note : 'Please upload a clearer copy' })}><${I} name="upload" size=${12} />Re-upload</button>`}
        </span>` : html`<span className="tiny faint">${d.status === 'Superseded' ? 'replaced' : 'view only'}</span>` },
      ]} />
      ${canUpload && html`<${UI.Card} title="Upload a document" icon="upload" hint="simulated — the AI pre-check runs on upload">
        <div className="row wrap" style=${{ gap: 10, alignItems: 'flex-end' }}>
          <${UI.Field} label="Document type"><${UI.Select} value=${type} onChange=${setType} options=${types} /><//>
          <${UI.Field} label="Simulated file"><${UI.Select} value=${quality} onChange=${setQuality} options=${QUALITY} /><//>
          <button className="btn ai" disabled=${checking} onClick=${upload}>${checking ? html`<span className="ath-spin" style=${{ borderTopColor: '#fff' }} />` : html`<${I} name="upload" size=${14} />`}${checking ? 'AI checking…' : 'Upload & check'}</button>
        </div>
        ${checking && html`<div className="row tight small ai-c" style=${{ marginTop: 10 }}><span className="ath-spin" />Reading ${type.toLowerCase()} — OCR, signature and stamp detection, cross-check with ${first(a.name)}'s profile (DOB ${D.fmt(a.dob)} ${a.dob.slice(0, 4)})…</div>`}
        ${result && !checking && html`<div style=${{ marginTop: 10 }}><${Banner} tone=${result.ai.ok ? 'good' : 'bad'} icon=${result.ai.ok ? 'shield-check' : 'alert'}><b>${result.type}: ${result.ai.ok ? 'passed AI pre-check' : 'flagged by AI'}</b> (${Math.round(result.ai.confidence * 100)}% confidence) — ${result.ai.note}. ${result.ai.ok ? 'A human still confirms it in the list above.' : 'Ask for a re-upload or override after manual review.'}<//></div>`}
      <//>`}
    </div>`;
  }

  function TimelineTab({ a, scoped, own }) {
    const { db, v } = AMS.useStore();
    const [filter, setFilter] = useState('all');
    const role = AMS.ui.role;
    const items = useMemo(() => {
      const out = [];
      const ICON = { injury: 'medical', checkin: 'pulse', onboarding: 'shield-check', notify: 'message', training: 'calendar', availability: 'flag', tag: 'tag', document: 'file', profile: 'user', medical: 'medical' };
      db.activity.filter((x) => x.athleteId === a.id).forEach((x) => {
        if (role === 'ops' && ['injury', 'medical'].includes(x.type)) return;
        out.push({ at: x.at, cat: ['injury', 'medical'].includes(x.type) ? 'medical' : ['onboarding', 'document', 'profile', 'tag'].includes(x.type) ? 'enrollment' : 'activity', title: x.text, by: x.by + (x.role ? ' · ' + AMS.roleLabel(x.role) : ''), icon: ICON[x.type] || 'clock' });
      });
      if (P.medical() && (scoped || own)) db.injuries.filter((i) => i.athleteId === a.id).forEach((i) => {
        const lbl = AMS.medicalFull() || own ? i.diagnosis : AMS.bodyZone(i.region) + ' injury';
        out.push({ at: i.dateOfInjury, cat: 'medical', title: 'Injury reported — ' + lbl, text: (AMS.medicalFull() ? (i.mechanism || '') + ' · ' : '') + i.status + (i.path === 'light' ? ' (light path)' : ''), tone: i.status === 'Closed' ? null : 'warn', icon: 'medical', by: i.reportedBy });
        if (i.closedOn) out.push({ at: i.closedOn, cat: 'medical', title: 'Returned to training — ' + lbl, text: i.clearance ? 'Cleared by ' + i.clearance.by + (i.daysLost ? ' · ' + i.daysLost + ' days lost' : '') : '', tone: 'good', icon: 'check' });
      });
      if ((P.tests() && scoped) || own) db.tests.filter((t) => t.athleteId === a.id).forEach((t) => {
        const res = t.results || {};
        const parts = [res.sprint30 && '30 m ' + res.sprint30 + ' s', res.cmj && 'CMJ ' + res.cmj + ' cm', res.slj && 'SLJ ' + res.slj + ' cm', res.yoyo && 'Yo-Yo ' + res.yoyo + ' m', res.mbt && 'MBT ' + res.mbt + ' m'].filter(Boolean);
        out.push({ at: t.date, cat: 'tests', title: t.event ? 'Field test — ' + t.event : 'Field testing', text: parts.join(' · '), icon: 'target', by: t.enteredBy });
      });
      if (a.discoveredAt) out.push({ at: a.discoveredAt.date, cat: 'enrollment', title: 'Discovered — ' + a.discoveredAt.event, by: a.discoveredAt.by, icon: 'sparkles', tone: 'ai' });
      out.push({ at: a.enrolledOn, cat: 'enrollment', title: 'Enrolled — ' + squadName(a.squadId) + ', ' + centreShort(a.centreId), icon: 'user', tone: 'info' });
      if (a.verification && a.verification.on) out.push({ at: a.verification.on, cat: 'enrollment', title: 'Identity & documents verified', by: a.verification.by, icon: 'shield-check', tone: 'good' });
      if (a.guardian && a.guardian.consentOn) out.push({ at: a.guardian.consentOn, cat: 'enrollment', title: 'Guardian consent given — ' + a.guardian.name + ' (' + a.guardian.relation + ')', icon: 'shield' });
      if (a.tempAssignment) out.push({ at: a.tempAssignment.from, cat: 'enrollment', title: (a.tempAssignment.from > T ? 'Scheduled: ' : '') + a.tempAssignment.label + ' — ' + centreShort(a.tempAssignment.centreId), text: D.fmt(a.tempAssignment.from) + ' – ' + D.fmt(a.tempAssignment.to), icon: 'pin', tone: 'info' });
      const app = a.appId && AMS.byId(db.applications, a.appId);
      if (app) app.history.forEach((h) => out.push({ at: h.date, cat: 'enrollment', title: h.text, by: h.by + ' · application ' + app.id, icon: 'file' }));
      return out.sort((x, y) => String(y.at).localeCompare(String(x.at)));
    }, [v, a.id, role]);
    const list = items.filter((x) => filter === 'all' || x.cat === filter);
    const opts = [{ id: 'all', label: 'All' }, { id: 'activity', label: 'Activity' }].concat(P.medical() && (scoped || own) ? [{ id: 'medical', label: 'Medical' }] : [], [{ id: 'enrollment', label: 'Enrollment' }], (P.tests() && scoped) || own ? [{ id: 'tests', label: 'Tests' }] : []);
    return html`<div className="col">
      <div className="row between wrap"><${UI.Seg} options=${opts} value=${filter} onChange=${setFilter} size="sm" /><span className="tiny faint">${plural(list.length, 'event')} · newest first${role === 'ops' ? ' · medical events hidden for Operations' : ''}</span></div>
      ${list.length ? html`<${UI.Timeline} items=${list.slice(0, 60).map((x) => ({ date: D.fmt(String(x.at).slice(0, 10)) + (String(x.at).slice(0, 4) !== '2026' ? ' ' + String(x.at).slice(0, 4) : '') + (String(x.at).length > 10 ? ' · ' + String(x.at).slice(11, 16) : ''), title: x.title, text: x.text, by: x.by, icon: x.icon, tone: x.tone }))} />` : html`<${UI.Empty} icon="clock" title="Nothing in this view yet" />`}
    </div>`;
  }

  function ProfileTab({ a }) {
    const canEdit = P.edit();
    const init = () => ({ phone: a.phone || '', ecName: (a.emergencyContact || {}).name || '', ecPhone: (a.emergencyContact || {}).phone || '', bloodGroup: a.bloodGroup || '', heightCm: a.heightCm || '', weightKg: a.weightKg || '', dominantSide: a.dominantSide || 'Right', events: a.events || '', level: a.level || 'District', bankStatus: a.bankStatus || (a.missingFields.includes('Bank details (stipend)') ? 'Missing' : 'Received') });
    const [f, setF] = useState(init);
    const set = (k) => (val) => setF(Object.assign({}, f, { [k]: val }));
    const inp = (k, ph, type) => html`<input className="input" type=${type || 'text'} value=${f[k]} placeholder=${ph} disabled=${!canEdit} onChange=${(e) => set(k)(e.target.value)} />`;
    const save = () => AMS.runAction('athlete.updateProfile', { athleteId: a.id, patch: {
      phone: f.phone, emergencyContact: f.ecName || f.ecPhone ? { name: f.ecName, phone: f.ecPhone } : a.emergencyContact || null, bloodGroup: f.bloodGroup || null,
      heightCm: f.heightCm ? +f.heightCm : null, weightKg: f.weightKg ? +f.weightKg : null, dominantSide: f.dominantSide, events: f.events, level: f.level, bankStatus: f.bankStatus,
    } });
    return html`<div className="col">
      ${!canEdit && html`<${Locked} title="Read-only for your role">Only Operations edits registry details (contact, emergency contact, measurements). ${AMS.ui.role === 'coach' ? 'Use “Request from athlete” on the Overview tab to ask for missing items.' : ''}<//>`}
      <div className="grid g3" style=${{ gap: 12 }}>
        <${UI.Field} label="Phone">${inp('phone', '+91 …')}<//>
        <${UI.Field} label="Emergency contact name" help=${a.missingFields.includes('Emergency contact') ? 'Missing — filling this completes the profile item' : null}>${inp('ecName', 'e.g. Sunita Deshmukh')}<//>
        <${UI.Field} label="Emergency contact phone">${inp('ecPhone', '+91 …')}<//>
        <${UI.Field} label="Blood group"><select className="select" value=${f.bloodGroup} disabled=${!canEdit} onChange=${(e) => set('bloodGroup')(e.target.value)}><option value="">Not recorded</option>${['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((b) => html`<option key=${b} value=${b}>${b}</option>`)}</select><//>
        <${UI.Field} label="Height (cm)">${inp('heightCm', '170', 'number')}<//>
        <${UI.Field} label="Weight (kg)">${inp('weightKg', '60', 'number')}<//>
        <${UI.Field} label="Dominant side"><select className="select" value=${f.dominantSide} disabled=${!canEdit} onChange=${(e) => set('dominantSide')(e.target.value)}>${['Right', 'Left', 'Both'].map((s) => html`<option key=${s} value=${s}>${s}</option>`)}</select><//>
        <${UI.Field} label="Events / weight class">${inp('events', '100m, 200m')}<//>
        <${UI.Field} label="Competitive level"><select className="select" value=${f.level} disabled=${!canEdit} onChange=${(e) => set('level')(e.target.value)}>${['District', 'State', 'National', 'International'].map((s) => html`<option key=${s} value=${s}>${s}</option>`)}</select><//>
        <${UI.Field} label="Bank details (stipend)" help="Account number is collected by Finance, not stored here"><select className="select" value=${f.bankStatus} disabled=${!canEdit} onChange=${(e) => set('bankStatus')(e.target.value)}>${['Missing', 'Requested', 'Received'].map((s) => html`<option key=${s} value=${s}>${s}</option>`)}</select><//>
      </div>
      <${UI.DL} cols=${3} items=${[['Athlete ID', html`<span className="mono">${a.id}</span>`], ['Date of birth', D.fmt(a.dob) + ' ' + a.dob.slice(0, 4)], ['Gender', a.gender === 'F' ? 'Female' : 'Male'], ['Sport · discipline', a.sport + ' · ' + a.discipline], ['State', (AMS.org.state(a.stateId) || {}).name], ['Wearables', (a.devices || []).join(', ') || 'None paired']]} />
      ${canEdit && html`<div className="row" style=${{ justifyContent: 'flex-end' }}><button className="btn ghost" onClick=${() => setF(init())}>Reset</button><button className="btn primary" onClick=${save}><${I} name="check" size=${14} />Save profile</button></div>`}
    </div>`;
  }

  AMS.registerDrawer('athlete', AthleteDrawer, {
    wide: true,
    sample: () => {
      const db = AMS.db;
      const byName = (n) => (db.athletes.find((x) => x.name === n) || {}).id;
      const far = db.athletes.find((x) => x.centreId === 'SNP');
      const h = db.meta.heroAthleteId;
      return [{ athleteId: h }, { athleteId: h, tab: 'documents' }, { athleteId: h, tab: 'timeline' }, { athleteId: h, tab: 'profile' }, { athleteId: byName('Rohan Gaikwad') }, { athleteId: byName('Kavya Nair'), tab: 'documents' }, { athleteId: far && far.id }, { athleteId: far && far.id, tab: 'timeline' }].filter((x) => x.athleteId);
    },
  });

  /* ================================================================== APPLICATION DRAWER (approval flow) */
  function ApplicationDrawer({ appId }) {
    const { db, ui } = AMS.useStore();
    const [mode, setMode] = useState(null); // 'return' | 'reject'
    const [reason, setReason] = useState('');
    const p = AMS.byId(db.applications, appId);
    if (!p) return html`<${Frag}><${UI.DrawerHead} title="Application not found" /><div className="drawer-b"><${UI.Empty} title=${'No application ' + appId} /></div><//>`;
    const canEdit = P.edit();
    const age = ageOf(p), ag = AMS.calc.ageGroup(age);
    const el = eligibility(p.dob, p.squadId);
    const pre = aiPrecheck(p);
    const bl = approvalBlockers(p);
    const open = OPEN_STAGES.includes(p.stage);
    const dup = p.duplicateOf;
    const ex = dup && AMS.org.athlete(dup.athleteId);
    const ath = p.athleteId && AMS.org.athlete(p.athleteId);
    const coachId = p.coachId || (ath && ath.coachId);
    const cur = p.stage === 'Applied' ? 0 : ['Verifying', 'Docs returned'].includes(p.stage) ? 1 : p.stage === 'Approved' ? (coachId ? 5 : 3) : 1;
    const steps = [{ label: 'Applied', sub: D.fmt(p.submitted) }, { label: 'Verifying', sub: pre.verified + '/' + pre.total + ' docs' }, { label: 'Approved', sub: p.approvedOn ? D.fmt(p.approvedOn) : '' }, { label: 'Coach assigned', sub: coachId ? first(staffName(coachId)) : '' }, { label: 'Active', sub: ath ? ath.id : '' }];
    const days = D.diff(T, p.submitted);
    const presets = p.stage === 'Docs returned' ? [] : (pre.flags.length ? pre.flags.map((d) => d.type + ': ' + d.ai.note) : []).concat(pre.missing.map((d) => d.type + ' not uploaded'), ['Guardian signature missing on consent form', 'Upload a clearer copy of the birth certificate']).slice(0, 4);
    const rejectPresets = ['Not eligible — age group does not match any open squad', 'Duplicate application', 'Applicant withdrew', 'Did not meet talent-ID entry benchmark'];
    const cmpRows = ex ? [
      ['Name', p.name, ex.name], ['Date of birth', D.fmt(p.dob) + ' ' + p.dob.slice(0, 4), D.fmt(ex.dob) + ' ' + ex.dob.slice(0, 4)], ['Gender', p.gender, ex.gender],
      ['Centre', centreShort(p.centreId), centreShort(ex.centreId)], ['Squad', squadName(p.squadId), squadName(ex.squadId)], ['Events', p.events, ex.events],
      ['Aadhaar (last 4)', 'xxxx ' + String(ex.id).slice(-2) + '17', 'xxxx ' + String(ex.id).slice(-2) + '17'], ['Status', 'Applicant · ' + p.stage, ex.enrollment + ' since ' + D.fmt(ex.enrolledOn) + ' ' + ex.enrolledOn.slice(0, 4)],
    ] : [];
    return html`<${Frag}>
      <${UI.DrawerHead} avatar=${html`<${UI.Avatar} name=${p.name} size=${42} />`} title=${p.name} sub=${html`<span><span className="mono">${p.id}</span> · ${p.sport} — ${p.events} · ${squadName(p.squadId)}, ${centreShort(p.centreId)}</span>`}>
        <div className="row wrap tight" style=${{ marginTop: 4 }}>
          <${UI.Pill} tone=${{ Applied: 'info', Verifying: 'warn', 'Docs returned': 'bad', Approved: 'good' }[p.stage]} className=${['Rejected', 'Merged'].includes(p.stage) ? 'outline' : ''}>${p.stage}<//>
          <${SlaPill} p=${p} />
          ${dup && !dup.resolved && html`<${UI.Pill} tone="bad"><${I} name="copy" size=${11} />Possible duplicate · ${Math.round(dup.score * 100)}%<//>`}
          ${noConsent(p) && html`<${UI.Pill} tone="bad">Consent missing<//>`}
        </div>
      <//>
      <div className="drawer-b">
        <${UI.Stepper} steps=${steps} current=${cur} blocked=${p.stage === 'Docs returned'} />
        ${p.stage === 'Docs returned' && html`<${Banner} tone="warn" icon="refresh" actions=${canEdit ? html`<button className="btn xs" onClick=${() => AMS.runAction('application.resubmit', { appId: p.id })}>Simulate applicant re-upload</button>` : null}><b>Returned to applicant ${p.returnedOn ? D.rel(p.returnedOn) : ''}</b> — ${p.returnReason}. Clock keeps running: ${days} days since submission (target ${SLA_DAYS}).<//>`}
        ${p.stage === 'Rejected' && html`<${Banner} tone="bad" icon="x"><b>Rejected${p.decidedOn ? ' ' + D.rel(p.decidedOn) : ''}</b> — ${p.rejectReason || 'reason not recorded'}. Logged for review.<//>`}
        ${p.stage === 'Merged' && html`<${Banner} tone="info" icon="merge" actions=${html`<button className="btn xs" onClick=${() => AMS.openAthlete(p.mergedInto)}>Open ${p.mergedInto}</button>`}><b>Merged</b> into existing athlete record ${p.mergedInto}. One history kept.<//>`}
        ${p.stage === 'Approved' && html`<${Banner} tone=${coachId ? 'good' : 'warn'} icon=${coachId ? 'check' : 'whistle'} actions=${html`${ath && html`<button className="btn xs" onClick=${() => AMS.openAthlete(ath.id)}>Open ${ath.id}</button>`}${!coachId && canEdit && html`<button className="btn xs primary" onClick=${() => AMS.openModal('assign-coach', { appId: p.id })}>Assign coach</button>`}`}>
          ${coachId ? html`<b>Active</b> — coach ${staffName(coachId)} notified; athlete appears in their squad views.` : html`<b>Approved ${D.rel(approvedOn(p))}, no coach yet.</b> Until a coach is assigned the athlete is not in any session plan or readiness view.`}
        <//>`}
        <div className="ai-box col tight" style=${{ gap: 8 }}>
          <div className="row between wrap"><${UI.AIChip} label="AI pre-check" /><span className="tiny faint">${pre.pass}/${pre.total} pass · ${pre.flags.length} flagged · ${pre.missing.length} missing</span></div>
          <div className="small" style=${{ lineHeight: 1.5 }}>${pre.summary}.</div>
          <div className="row wrap tight"><span className="tiny ai-c" style=${{ fontWeight: 600 }}>Suggested next step:</span><span className="small">${pre.rec}</span></div>
          ${open && canEdit && p.docs.some((d) => d.status === 'Pending' && d.ai && d.ai.ok && d.ai.confidence >= 0.9) && html`<div><button className="btn sm ai" onClick=${() => AMS.runAction('application.autoVerify', { appIds: [p.id] })}><${I} name="zap" size=${13} />Confirm ${p.docs.filter((d) => d.status === 'Pending' && d.ai && d.ai.ok && d.ai.confidence >= 0.9).length} AI-passed documents</button></div>`}
        </div>
        ${dup && !dup.resolved && ex && html`<${UI.Card} title="Possible duplicate" icon="copy" hint=${Math.round(dup.score * 100) + '% match · ' + dup.reasons.join(', ')}>
          <div className="tbl-wrap"><table className="ath-cmp" style=${{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th className="upper">Field</th><th className="upper">This application</th><th className="upper">Existing · <a className="clickable" style=${{ color: 'var(--accent)' }} onClick=${() => AMS.openAthlete(ex.id)}>${ex.id}</a></th></tr></thead>
            <tbody>${cmpRows.map(([k, x, y]) => html`<tr key=${k} className=${x === y ? 'same' : ''}><td>${k}</td><td>${x}</td><td>${y}</td></tr>`)}</tbody>
          </table></div>
          <div className="small muted" style=${{ marginTop: 8 }}>Rows in red are identical. Merging carries over any new documents and closes this application; the existing record keeps its history.</div>
          ${canEdit && open && html`<div className="row wrap tight" style=${{ marginTop: 10 }}><button className="btn primary sm" onClick=${() => AMS.runAction('application.merge', { appId: p.id })}><${I} name="merge" size=${14} />Merge into ${ex.id}</button><button className="btn sm" onClick=${() => AMS.runAction('application.notDuplicate', { appId: p.id })}>Confirm different person</button></div>`}
        <//>`}
        ${dup && dup.resolved && html`<span className="tiny faint">Duplicate check resolved: ${dup.resolved === 'merged' ? 'merged into ' + dup.athleteId : 'confirmed different person' + (dup.resolvedBy ? ' by ' + dup.resolvedBy : '')}.</span>`}
        <${UI.Card} title="Applicant" icon="user">
          <${UI.DL} cols=${3} items=${[['Date of birth', D.fmt(p.dob) + ' ' + p.dob.slice(0, 4)], ['Age · group', age + ' · ' + ag], ['Gender', p.gender === 'F' ? 'Female' : 'Male'], ['Squad', squadName(p.squadId)], ['Centre', (AMS.org.centre(p.centreId) || {}).name], ['Source', p.source], ['Submitted', D.fmt(p.submitted) + ' (' + D.rel(p.submitted) + ')'], ['Guardian', p.guardian ? p.guardian.name + ' (' + p.guardian.relation + ')' : 'Not required (18+)'], ['Consent', p.guardian ? (p.guardian.consent ? 'Given' : 'Not received') : '—']]} />
          <div style=${{ marginTop: 10 }}><${Banner} tone=${el.tone} icon=${el.ok ? 'check' : 'alert'}><b>Eligibility: ${el.label}.</b> ${el.text}<//></div>
        <//>
        <${UI.Card} title="Documents" icon="file" hint=${pre.verified + ' of ' + pre.total + ' verified'} flush=${true}>
          <div className="list">${p.docs.map((d) => html`<div key=${d.id} className="list-item" style=${{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <${I} name="file" size=${16} style=${{ color: 'var(--fg-3)', marginTop: 2 }} />
            <div className="col tight grow" style=${{ gap: 3, minWidth: 180 }}>
              <span className="row tight wrap"><b style=${{ fontSize: 13 }}>${d.type}</b><${UI.Pill} tone=${DOC_TONE[d.status]} dot>${d.status}<//>${d.by && html`<span className="tiny faint">${d.by}</span>`}</span>
              ${d.status === 'Missing' ? html`<span className="tiny bad">Not uploaded by applicant</span>` : html`<${AiResult} ai=${d.ai} />`}
            </div>
            ${canEdit && open && d.status !== 'Missing' && html`<div className="row tight wrap">
              ${d.status !== 'Verified' && html`<button className=${'btn xs ' + (d.ai && d.ai.ok ? 'good' : '')} onClick=${() => AMS.runAction('application.verifyDoc', { appId: p.id, docId: d.id, status: 'Verified', note: d.ai && !d.ai.ok ? 'manual override after review' : null })}><${I} name="check" size=${12} />${d.ai && !d.ai.ok ? 'Override & verify' : 'Verify'}</button>`}
              ${d.status !== 'Flagged' && html`<button className="btn xs ghost" onClick=${() => AMS.runAction('application.verifyDoc', { appId: p.id, docId: d.id, status: 'Flagged', note: d.ai && !d.ai.ok ? d.ai.note : 'flagged on review' })}><${I} name="flag" size=${12} />Flag</button>`}
              <button className="btn xs ghost" onClick=${() => AMS.runAction('application.returnDocs', { appId: p.id, docIds: [d.id], reason: d.type + ': ' + (d.ai && !d.ai.ok ? d.ai.note : 'please re-upload a clearer copy') })}><${I} name="refresh" size=${12} />Return</button>
            </div>`}
          </div>`)}</div>
        <//>
        <${UI.Card} title="History" icon="clock">
          <${UI.Timeline} items=${p.history.slice().reverse().map((h) => ({ date: D.fmt(h.date), title: h.text, by: h.by, icon: h.by === 'AI' ? 'sparkles' : /Approved|Verified|verified/.test(h.text) ? 'check' : /Returned|Rejected/.test(h.text) ? 'alert' : 'clock', tone: h.by === 'AI' ? 'ai' : /Approved/.test(h.text) ? 'good' : /Returned|Rejected/.test(h.text) ? 'warn' : null }))} />
        <//>
        ${!canEdit && html`<${Locked} title="View only">Only Operations verifies documents and approves applications (your access: ${AMS.access('athletes')}).<//>`}
        ${canEdit && mode && html`<${UI.Card} title=${mode === 'return' ? 'Return to applicant' : 'Reject application'} icon=${mode === 'return' ? 'refresh' : 'x'}>
          <div className="col tight">
            <div className="row wrap tight">${(mode === 'return' ? presets : rejectPresets).map((r) => html`<button key=${r} className="ath-chip" onClick=${() => setReason(r)}>${r.length > 60 ? r.slice(0, 58) + '…' : r}</button>`)}</div>
            <textarea className="textarea ath-ta" value=${reason} placeholder=${mode === 'return' ? 'Reason the applicant will see (sent by SMS + email)' : 'Reason logged for review'} onChange=${(e) => setReason(e.target.value)} />
            <div className="row" style=${{ justifyContent: 'flex-end' }}><button className="btn ghost sm" onClick=${() => { setMode(null); setReason(''); }}>Cancel</button>
              <button className=${'btn sm ' + (mode === 'return' ? 'primary' : 'danger')} disabled=${!reason.trim()} onClick=${() => { AMS.runAction(mode === 'return' ? 'application.returnDocs' : 'application.reject', { appId: p.id, reason }); setMode(null); setReason(''); }}>${mode === 'return' ? 'Return with reason' : 'Reject with reason'}</button></div>
          </div>
        <//>`}
      </div>
      ${canEdit && open && html`<div className="drawer-f">
        ${bl.length > 0 && html`<span className="tiny muted grow" style=${{ alignSelf: 'center' }} title=${bl.join('\n')}><${I} name="lock" size=${11} /> Approve blocked: ${bl[0]}${bl.length > 1 ? ' (+' + (bl.length - 1) + ')' : ''}</span>`}
        <button className="btn" onClick=${() => { setMode('reject'); setReason(''); }}>Reject</button>
        <button className="btn" onClick=${() => { setMode('return'); setReason(presets[0] || ''); }}><${I} name="refresh" size=${14} />Return to applicant</button>
        <button className="btn primary" disabled=${bl.length > 0} title=${bl.join('\n') || 'Create the athlete record'} onClick=${() => AMS.runAction('application.approve', { appId: p.id })}><${I} name="check" size=${14} />Approve</button>
      </div>`}
      ${canEdit && p.stage === 'Approved' && !coachId && html`<div className="drawer-f"><button className="btn primary" onClick=${() => AMS.openModal('assign-coach', { appId: p.id })}><${I} name="whistle" size=${14} />Assign coach</button></div>`}
    <//>`;
  }
  AMS.registerDrawer('application', ApplicationDrawer, { wide: true, sample: () => AMS.db.applications.map((p) => ({ appId: p.id })) });

  /* ================================================================== MODAL: enrol (multi-step wizard) */
  const WIZ = ['Basic details', 'Sport, centre & squad', 'Documents', 'Guardian consent', 'Review & submit'];
  const SAMPLE_APPLICANT = { name: 'Ishaan Kulkarni', gender: 'M', dob: '2011-05-09', phone: '+91 98220 41736', source: 'Talent hunt referral', sport: 'Athletics', centreId: 'PUN', squadId: 'SQ-PUN-SPR17', events: '100m, 200m', heightCm: '168', weightKg: '54', guardian: { name: 'Meena Kulkarni', relation: 'Mother', phone: '+91 98220 41700' } };
  function EnrollModal() {
    const { db } = AMS.useStore();
    const [step, setStep] = useState(0);
    const [f, setF] = useState({ name: '', gender: 'F', dob: '', phone: '', source: 'Online application', sport: 'Athletics', centreId: 'PUN', squadId: '', events: '', heightCm: '', weightKg: '', guardian: { name: '', relation: 'Mother', phone: '' }, consentMode: 'signed' });
    const [docs, setDocs] = useState({}); // type → { quality, state, ai }
    const set = (patch) => setF(Object.assign({}, f, patch));
    if (!P.edit()) return html`<${UI.ModalFrame} title="Enrol a new athlete" icon="user"><${Locked} title="Operations only">Enrolment is run by the Operations team. ${AMS.ui.role === 'coach' ? 'Ask ops to start an application, or share the talent-hunt referral with them.' : ''}<//><//>`;
    const age = f.dob ? D.ageOn(f.dob) : null;
    const u18 = age != null && age < 18;
    const el = eligibility(f.dob, f.squadId);
    const sports = AMS.org.sports();
    const centres = db.org.centres.filter((c) => db.org.squads.some((s) => s.centreId === c.id && s.sport === f.sport));
    const squads = db.org.squads.filter((s) => s.centreId === f.centreId && s.sport === f.sport);
    const docTypes = REQUIRED_DOCS.concat(OPTIONAL_DOCS);
    const consentDoc = docs['Guardian consent'];
    const upload = (type) => {
      const cur = docs[type] || { quality: 'clear' };
      const next = Object.assign({}, docs, { [type]: Object.assign({}, cur, { state: 'checking', ai: null }) });
      setDocs(next);
      setTimeout(() => setDocs((d) => Object.assign({}, d, { [type]: Object.assign({}, d[type] || cur, { state: 'done', ai: aiCheckDoc(type, (d[type] || cur).quality || 'clear', f) }) })), 900);
    };
    const setQ = (type, q) => setDocs(Object.assign({}, docs, { [type]: Object.assign({}, docs[type] || {}, { quality: q, state: 'idle', ai: null }) }));
    const dup = findDuplicate(f);
    const consentOk = !u18 || (f.consentMode === 'link') || (f.guardian.name && consentDoc && consentDoc.ai && consentDoc.ai.ok);
    const valid = [
      f.name.trim().split(' ').length >= 2 && f.dob && age >= 10 && age <= 40 ? null : 'Enter full name and a valid date of birth (age 10–40)',
      f.squadId && el.ok ? null : (f.squadId ? el.text : 'Pick a squad'),
      REQUIRED_DOCS.every((t) => docs[t] && docs[t].state === 'done') ? null : 'Upload the 3 required documents (AI checks each one)',
      !u18 ? null : !f.guardian.name ? 'Enter the guardian’s name' : consentOk ? null : 'Upload a signed consent form that passes the AI check, or send an e-consent link',
      null,
    ];
    const blockedMsg = valid.slice(0, step + 1).find(Boolean);
    const submit = () => {
      const payload = Object.assign({}, f, {
        docs: docTypes.filter((t) => docs[t] && docs[t].state === 'done').map((t) => ({ type: t, ai: docs[t].ai })).concat(u18 ? [f.consentMode === 'signed' && consentDoc && consentDoc.ai ? { type: 'Guardian consent', ai: consentDoc.ai } : { type: 'Guardian consent', ai: null }] : []).concat(REQUIRED_DOCS.filter((t) => !(docs[t] && docs[t].state === 'done')).map((t) => ({ type: t, ai: null }))),
        consent: u18 ? (f.consentMode === 'signed' && !!(consentDoc && consentDoc.ai && consentDoc.ai.ok)) : true,
      });
      const p = createApplication(payload);
      AMS.closeModal();
      if (p) { AMS.go('athletes', { tab: 'onboarding' }); AMS.openDrawer('application', { appId: p.id }); }
    };
    const DocRow = ({ type, req }) => {
      const st = docs[type] || {};
      return html`<div className="list-item" style=${{ padding: '10px 0', flexWrap: 'wrap', alignItems: 'center' }}>
        <${I} name="file" size=${16} style=${{ color: 'var(--fg-3)' }} />
        <span className="col tight grow" style=${{ gap: 2, minWidth: 160 }}><b style=${{ fontSize: 13 }}>${type}</b><span className="tiny faint">${req ? 'Required' : 'Optional'}</span></span>
        <select className="select" style=${{ height: 28, fontSize: 12 }} value=${st.quality || 'clear'} onChange=${(e) => setQ(type, e.target.value)}>${QUALITY.map((q) => html`<option key=${q.value} value=${q.value}>${q.label}</option>`)}</select>
        <button className="btn sm" disabled=${st.state === 'checking'} onClick=${() => upload(type)}><${I} name="upload" size=${13} />${st.state === 'done' ? 'Replace' : 'Upload'}</button>
        <span style=${{ minWidth: 200, flex: '1 1 200px' }}>${st.state === 'checking' ? html`<span className="row tight small ai-c"><span className="ath-spin" />AI checking…</span>` : st.state === 'done' ? html`<${AiResult} ai=${st.ai} />` : html`<span className="tiny faint">Not uploaded</span>`}</span>
      </div>`;
    };
    const footer = html`<div className="row between grow" style=${{ flexWrap: 'wrap', gap: 8 }}>
      <span className="tiny muted">${blockedMsg ? html`<span className="warn"><${I} name="alert" size=${11} /> ${blockedMsg}</span>` : 'Step ' + (step + 1) + ' of ' + WIZ.length}</span>
      <span className="row tight">
        ${step === 0 && html`<button className="btn ghost sm" onClick=${() => { setF(Object.assign({}, f, SAMPLE_APPLICANT)); }}><${I} name="sparkles" size=${13} />Fill sample applicant</button>`}
        ${step > 0 && html`<button className="btn" onClick=${() => setStep(step - 1)}>Back</button>`}
        ${step < WIZ.length - 1 ? html`<button className="btn primary" disabled=${!!valid[step]} onClick=${() => setStep(step + 1)}>Next<${I} name="chev-r" size=${14} /></button>` : html`<button className="btn primary" disabled=${valid.some(Boolean)} onClick=${submit}><${I} name="send" size=${14} />Submit application</button>`}
      </span>
    </div>`;
    return html`<${UI.ModalFrame} title="Enrol a new athlete" sub="Creates an application in the verification queue · nothing reaches a coach until it is verified" icon="user" wide=${true} footer=${footer}>
      <${UI.Stepper} steps=${WIZ.map((w, i) => ({ label: w, sub: i < step ? 'done' : '' }))} current=${step} onStep=${(i) => { if (i < step || !valid.slice(0, i).some(Boolean)) setStep(i); }} />
      ${step === 0 && html`<div className="grid g2" style=${{ gap: 12 }}>
        <${UI.Field} label="Full name (as on Aadhaar)"><input className="input" value=${f.name} placeholder="e.g. Ishaan Kulkarni" onChange=${(e) => set({ name: e.target.value })} /><//>
        <${UI.Field} label="Gender"><${UI.Seg} options=${[{ id: 'F', label: 'Female' }, { id: 'M', label: 'Male' }]} value=${f.gender} onChange=${(g) => set({ gender: g })} /><//>
        <${UI.Field} label="Date of birth" help=${age != null ? 'Age ' + age + ' on ' + D.fmt(T) + ' → ' + AMS.calc.ageGroup(age) + (u18 ? ' · guardian consent required' : '') : 'Used for the age-group eligibility check'}><input className="input" type="date" value=${f.dob} onChange=${(e) => set({ dob: e.target.value })} /><//>
        <${UI.Field} label="Mobile"><input className="input" value=${f.phone} placeholder="+91 …" onChange=${(e) => set({ phone: e.target.value })} /><//>
        <${UI.Field} label="Source"><${UI.Select} value=${f.source} onChange=${(s) => set({ source: s })} options=${SOURCES} /><//>
        <div className="grid g2" style=${{ gap: 8 }}><${UI.Field} label="Height (cm)"><input className="input" type="number" value=${f.heightCm} onChange=${(e) => set({ heightCm: e.target.value })} /><//><${UI.Field} label="Weight (kg)"><input className="input" type="number" value=${f.weightKg} onChange=${(e) => set({ weightKg: e.target.value })} /><//></div>
      </div>`}
      ${step === 1 && html`<div className="col">
        <div className="grid g3" style=${{ gap: 12 }}>
          <${UI.Field} label="Sport"><${UI.Select} value=${f.sport} onChange=${(s) => set({ sport: s, centreId: (db.org.squads.find((q) => q.sport === s) || {}).centreId, squadId: '' })} options=${sports} /><//>
          <${UI.Field} label="Centre"><${UI.Select} value=${f.centreId} onChange=${(c) => set({ centreId: c, squadId: '' })} options=${centres.map((c) => ({ value: c.id, label: c.short + ' — ' + c.type }))} /><//>
          <${UI.Field} label="Squad"><${UI.Select} value=${f.squadId} placeholder="Pick a squad" onChange=${(s) => set({ squadId: s })} options=${squads.map((s) => ({ value: s.id, label: s.name + ' · ' + squadSize(s.id) + '/' + (CAPACITY[s.ageGroup] || 12) }))} /><//>
        </div>
        <${UI.Field} label="Events / weight class / position"><input className="input" value=${f.events} placeholder="e.g. 100m, 200m" onChange=${(e) => set({ events: e.target.value })} /><//>
        <${Banner} tone=${el.tone} icon=${el.ok ? 'check' : 'alert'}><b>Eligibility check: ${el.label}.</b> ${el.text}<//>
        ${f.squadId && html`<div className="row wrap tight">${squads.map((s) => { const e2 = eligibility(f.dob, s.id); return html`<span key=${s.id} className="evidence"><span className=${'dot ' + e2.tone} style=${{ width: 6, height: 6 }} />${s.name} <b>${e2.label}</b></span>`; })}</div>`}
      </div>`}
      ${step === 2 && html`<div className="col tight">
        <div className="small muted">Pick how each simulated file looks, then upload — the AI reads it (OCR, signature, stamp, DOB cross-check) and returns a pass or a flag with its reason. Try “Scan with a different DOB” on the birth certificate.</div>
        <div className="list">${docTypes.map((t) => html`<${DocRow} key=${t} type=${t} req=${REQUIRED_DOCS.includes(t)} />`)}</div>
        ${REQUIRED_DOCS.some((t) => docs[t] && docs[t].ai && !docs[t].ai.ok) && html`<${Banner} tone="warn" icon="info">Flagged documents can still be submitted — ops will see the AI reason and can return them to the applicant.<//>`}
      </div>`}
      ${step === 3 && html`<div className="col">
        ${!u18 ? html`<${Banner} tone="good" icon="check"><b>Not required.</b> ${f.name || 'The applicant'} is ${age} — an adult who consents for themselves.<//>` : html`<${Frag}>
          <${Banner} tone="info" icon="shield">${first(f.name) || 'The applicant'} is ${age}. Under India's DPDP Act a parent or guardian must consent before any medical data can be recorded. The application cannot be approved without it.<//>
          <div className="grid g3" style=${{ gap: 12 }}>
            <${UI.Field} label="Guardian name"><input className="input" value=${f.guardian.name} onChange=${(e) => set({ guardian: Object.assign({}, f.guardian, { name: e.target.value }) })} /><//>
            <${UI.Field} label="Relation"><${UI.Select} value=${f.guardian.relation} onChange=${(r) => set({ guardian: Object.assign({}, f.guardian, { relation: r }) })} options=${['Mother', 'Father', 'Legal guardian', 'Grandparent']} /><//>
            <${UI.Field} label="Guardian mobile"><input className="input" value=${f.guardian.phone} onChange=${(e) => set({ guardian: Object.assign({}, f.guardian, { phone: e.target.value }) })} /><//>
          </div>
          <${UI.Seg} options=${[{ id: 'signed', label: 'Signed form collected now' }, { id: 'link', label: 'Send e-consent link to guardian' }]} value=${f.consentMode} onChange=${(m) => set({ consentMode: m })} />
          ${f.consentMode === 'signed' ? html`<div className="list"><${DocRow} type="Guardian consent" req=${true} /></div>` : html`<${Banner} tone="warn" icon="send">An e-consent link will be sent to ${f.guardian.phone || 'the guardian'}. The application goes to the queue with consent <b>pending</b>; approval stays blocked until the guardian signs.<//>`}
        <//>`}
      </div>`}
      ${step === 4 && html`<div className="col">
        <${UI.DL} cols=${3} items=${[['Name', f.name], ['DOB · age', f.dob ? D.fmt(f.dob) + ' ' + f.dob.slice(0, 4) + ' · ' + age + ' (' + AMS.calc.ageGroup(age) + ')' : '—'], ['Gender', f.gender === 'F' ? 'Female' : 'Male'], ['Squad', squadName(f.squadId)], ['Centre', centreShort(f.centreId)], ['Events', f.events || '—'], ['Source', f.source], ['Guardian', u18 ? f.guardian.name + ' (' + f.guardian.relation + ')' : 'Not required'], ['Consent', u18 ? (f.consentMode === 'link' ? 'E-consent link pending' : 'Signed form uploaded') : '—']]} />
        <div className="ai-box col tight" style=${{ gap: 6 }}>
          <${UI.AIChip} label="AI pre-check summary" />
          ${docTypes.concat(u18 && f.consentMode === 'signed' ? ['Guardian consent'] : []).filter((t) => docs[t] && docs[t].ai).map((t) => html`<div key=${t} className="row tight small"><${I} name=${docs[t].ai.ok ? 'check' : 'alert'} size=${13} style=${{ color: docs[t].ai.ok ? 'var(--good)' : 'var(--bad)' }} /><b>${t}</b><span className="muted">${docs[t].ai.note} · ${Math.round(docs[t].ai.confidence * 100)}%</span></div>`)}
          ${dup ? html`<div className="row tight small bad"><${I} name="copy" size=${13} /><b>Possible duplicate</b> of ${AMS.org.athlete(dup.athleteId).name} (${dup.athleteId}) — ${Math.round(dup.score * 100)}% · ${dup.reasons.join(', ')}. Ops will be asked to merge or confirm.</div>` : html`<div className="row tight small"><${I} name="check" size=${13} style=${{ color: 'var(--good)' }} />No duplicate found across ${db.athletes.length} athlete records (name, DOB, centre).</div>`}
          <div className="row tight small"><${I} name=${el.ok ? 'check' : 'alert'} size=${13} style=${{ color: el.ok ? 'var(--good)' : 'var(--bad)' }} />Eligibility: ${el.label} — ${el.text}</div>
        </div>
      </div>`}
    <//>`;
  }
  AMS.registerModal('enroll', EnrollModal, { sample: () => [{}] });

  /* ================================================================== MODAL: assign coach (AI-recommended) */
  function AssignCoachModal(props) {
    const { v } = AMS.useStore();
    const subj = subjectFrom(props);
    const opts = useMemo(() => recommendCoaches(subj), [v, subj && subj.id]);
    const best = opts.find((o) => !o.blocked);
    const [pick, setPick] = useState(best ? best.squadId : null);
    const [all, setAll] = useState(false);
    if (!subj) return html`<${UI.ModalFrame} title="Assign coach" icon="whistle"><${UI.Empty} title="Nothing to assign" /><//>`;
    const canEdit = P.edit();
    const count = props.athleteIds ? props.athleteIds.length : 1;
    const chosen = opts.find((o) => o.squadId === pick) || best;
    const conf = recConfidence(opts);
    const age = D.ageOn(subj.dob);
    const injN = subj.athlete ? openInj(subj.athlete).length : 0;
    const shown = all ? opts : opts.slice(0, 4);
    const confirm = () => {
      const payload = { squadId: chosen.squadId, coachId: chosen.coachId };
      if (props.athleteIds) payload.athleteIds = props.athleteIds; else if (props.appId) payload.appId = props.appId; else payload.athleteId = subj.id;
      AMS.runAction('athlete.assignCoach', payload);
      AMS.closeModal();
    };
    const footer = canEdit ? html`<span className="tiny muted grow" style=${{ alignSelf: 'center' }}>${chosen ? chosen.coach.name + ' will be notified: “New athlete assigned — profile and open medical flags”' : ''}</span><button className="btn" onClick=${AMS.closeModal}>Cancel</button><button className="btn primary" disabled=${!chosen || chosen.blocked} onClick=${confirm}><${I} name="check" size=${14} />Assign ${chosen ? first(chosen.coach.name) : ''}${count > 1 ? ' to ' + count : ''}</button>` : null;
    return html`<${UI.ModalFrame} title=${count > 1 ? 'Assign coach to ' + count + ' athletes' : 'Assign coach — ' + subj.name} sub=${age + ' yrs · ' + AMS.calc.ageGroup(age) + ' · ' + subj.sport + ' (' + subj.discipline + ') · requested ' + squadName(subj.squadId)} icon="whistle" wide=${true} footer=${footer}>
      ${!canEdit && html`<${Locked} title="View only">Coach assignment is done by Operations. You can see the recommendation and its reasons.<//>`}
      ${subj.kind === 'app' && html`<${Banner} tone="info" icon="info">Approved application ${subj.appId} — confirming creates the athlete record (Active · Available) and assigns the coach in one step.<//>`}
      ${best && html`<div className="ai-box col tight" style=${{ gap: 8 }}>
        <div className="row between wrap"><span className="row tight"><${UI.AIChip} label="Recommended" /><span className="tiny faint">${Math.round(conf * 100)}% confidence · age group, discipline, squad size vs capacity, coach caseload</span></span><span className="num" style=${{ fontSize: 22, color: 'var(--ai)' }}>${best.score}</span></div>
        <div style=${{ fontSize: 13.5 }}><b>${best.coach.name}</b> · ${best.squad.name}, ${centreShort(best.squad.centreId)} — ${best.size} of ${best.cap} places used, ${best.load} athletes in caseload${best.inj ? ', ' + plural(best.inj, 'open injury case') : ''}.</div>
        <${UI.Evidence} items=${best.reasons} />
      </div>`}
      <div className="row between"><span className="upper">Options</span>${opts.length > 4 && html`<button className="btn ghost xs" onClick=${() => setAll(!all)}>${all ? 'Show top 4' : 'Show all ' + opts.length}</button>`}</div>
      <div className="col tight">${shown.map((o) => html`<div key=${o.squadId} className=${AMS.cx('ath-opt', pick === o.squadId && 'on', o.blocked && 'blocked')} onClick=${() => !o.blocked && setPick(o.squadId)} role="radio" aria-checked=${pick === o.squadId}>
        <input type="radio" checked=${pick === o.squadId} disabled=${!!o.blocked} onChange=${() => setPick(o.squadId)} style=${{ marginTop: 3 }} />
        <${UI.Avatar} name=${o.coach ? o.coach.name : '?'} size=${30} />
        <div className="col tight grow" style=${{ gap: 4 }}>
          <div className="row between wrap"><span><b>${o.coach ? o.coach.name : '—'}</b> <span className="muted small">· ${o.coach ? o.coach.title : ''}</span></span><span className="row tight"><span className="tiny faint">fit</span><b className="tnum" style=${{ color: o.blocked ? 'var(--bad)' : 'var(--ai)' }}>${o.score}</b></span></div>
          <span className="small muted">${o.squad.name} · ${(AMS.org.centre(o.squad.centreId) || {}).name}${o.blocked ? ' — ' + o.blocked : ''}</span>
          <div className="row wrap" style=${{ gap: 14 }}>
            <span className="row tight tiny" style=${{ minWidth: 150 }}>Squad ${o.size}/${o.cap}<${UI.Meter} value=${o.size} max=${o.cap} tone=${o.size >= o.cap ? 'bad' : o.size >= o.cap - 2 ? 'warn' : 'good'} style=${{ width: 70 }} /></span>
            <span className="row tight tiny" style=${{ minWidth: 150 }}>Caseload ${o.load}/${CASELOAD_LIMIT}<${UI.Meter} value=${o.load} max=${CASELOAD_LIMIT} tone=${o.load >= CASELOAD_LIMIT ? 'bad' : o.load >= CASELOAD_LIMIT - 4 ? 'warn' : 'good'} style=${{ width: 70 }} /></span>
          </div>
          <${UI.Evidence} items=${o.reasons.slice(0, 5)} />
        </div>
      </div>`)}</div>
      <div className="small muted">${subj.athlete ? (AMS.ui.role === 'ops' ? (injN ? plural(injN, 'open medical flag') + ' — details are shared with the coach and medical team, not with Operations.' : 'No open medical flags.') : (injN ? 'Open medical: ' + openInj(subj.athlete).map((i) => AMS.medicalLabel(i)).join('; ') : 'No open medical flags.')) : 'New athlete — no medical history in USI yet.'} Assigning to a squad at another centre is a transfer and needs centre approval (not modelled yet).</div>
    <//>`;
  }
  AMS.registerModal('assign-coach', AssignCoachModal, {
    sample: () => {
      const db = AMS.db;
      const appr = db.applications.find((p) => p.stage === 'Approved');
      const two = db.athletes.filter((a) => a.squadId === 'SQ-PUN-SPR17').slice(4, 6).map((a) => a.id);
      return [appr ? { appId: appr.id } : null, { athleteId: db.meta.heroAthleteId }, { athleteIds: two }, { appId: 'APP-801' }].filter(Boolean);
    },
  });

  /* ================================================================== MODAL: message */
  function aiDraft(a, to) {
    const fn = first(a.name);
    const rd = AMS.calc.readiness(a), r = AMS.calc.acwr(a);
    const perf = P.perf();
    if (to === 'guardian') return 'Namaste ' + (a.guardian ? a.guardian.name.split(' ')[0] : '') + ', this is ' + meName() + ' from ' + centreShort(a.centreId) + '. ' + (a.missingFields.length ? 'We still need ' + a.missingFields.join(', ') + ' for ' + fn + "'s profile — please upload them in the USI app by " + D.fmt(D.add(T, 5)) + '.' : fn + "'s profile is complete — thank you.");
    if (to === 'coach') return perf ? fn + ': readiness ' + rd.score + ' (' + AMS.calc.bandLabel(rd.band).toLowerCase() + '), ACWR ' + r.toFixed(2) + '. ' + (rd.band === 'bad' ? 'Suggest the recovery variant for today’s session and a quick physio screen.' : 'No action needed today.') : fn + "'s profile is " + a.profileCompletion + '% complete' + (a.missingFields.length ? ' — missing ' + a.missingFields.join(', ') : '') + '. Could you remind them at training?';
    if (to === 'physio' || to === 'doctor') return 'Please screen ' + fn + ' before training' + (perf ? ' — readiness ' + rd.score + ', ' + rd.factors.slice(0, 2).map((x) => x.label.toLowerCase() + ' ' + x.value).join(', ') : '') + '.';
    if (to === 'ops') return fn + ': ' + (a.missingFields.length ? 'profile items outstanding (' + a.missingFields.join(', ') + ').' : 'please check documents and consent are current.');
    return 'Update on ' + a.name + '.';
  }
  function MessageModal({ athleteId, athleteIds }) {
    const ids = athleteIds || (athleteId ? [athleteId] : []);
    const list = ids.map((id) => AMS.org.athlete(id)).filter(Boolean);
    const a = list[0];
    const role = AMS.ui.role;
    const roles = ['coach', 'physio', 'doctor', 'scientist', 'nutritionist', 'ops', 'director'].filter((r) => r !== role);
    const [to, setTo] = useState(role === 'coach' ? 'physio' : 'coach');
    const [text, setText] = useState(() => (a ? aiDraft(a, role === 'coach' ? 'physio' : 'coach') : ''));
    if (!a) return html`<${UI.ModalFrame} title="Message" icon="message"><${UI.Empty} title="No athlete selected" /><//>`;
    const send = () => {
      if (to === 'guardian') {
        AMS.mutate(() => {
          list.forEach((x) => { if (x.id === hero()) AMS.notify({ toRole: 'athlete', title: 'Message from ' + AMS.roleLabel(role), text, athleteId: x.id }); AMS.log({ type: 'notify', text: 'SMS to ' + (x.guardian ? x.guardian.name + ' (guardian of ' + first(x.name) + ')' : x.name) + ': ' + text.slice(0, 80), athleteId: x.id }); });
        }, { toast: 'Sent to ' + plural(list.length, list.length === 1 && ageOf(list[0]) >= 18 ? 'athlete' : 'guardian') + ' by SMS + app' });
      } else if (list.length === 1) AMS.runAction('notify', { toRole: to, athleteId: a.id, text, title: 'Re: ' + a.name });
      else AMS.mutate(() => { AMS.notify({ toRole: to, title: 'Re: ' + plural(list.length, 'athlete'), text: text + ' (' + list.map((x) => x.name).slice(0, 6).join(', ') + (list.length > 6 ? ' +' + (list.length - 6) : '') + ')' }); }, { toast: 'Sent to ' + AMS.roleLabel(to).toLowerCase() + ' about ' + plural(list.length, 'athlete'), log: { type: 'notify', text: 'Message to ' + AMS.roleLabel(to) + ' about ' + plural(list.length, 'athlete') } });
      AMS.closeModal();
    };
    const footer = html`<button className="btn" onClick=${AMS.closeModal}>Cancel</button><button className="btn primary" disabled=${!text.trim()} onClick=${send}><${I} name="send" size=${14} />Send</button>`;
    const recips = [{ id: 'guardian', label: list.length === 1 && ageOf(a) >= 18 ? 'Athlete (SMS)' : 'Guardian (SMS)' }].concat(roles.map((r) => ({ id: r, label: AMS.ROLES.find((x) => x.id === r).short })));
    return html`<${UI.ModalFrame} title=${list.length === 1 ? 'Message about ' + a.name : 'Message about ' + list.length + ' athletes'} sub="Goes to the recipient's bell and the athlete's timeline" icon="message" footer=${footer}>
      <${UI.Field} label="To"><div className="row wrap tight">${recips.map((r) => html`<button key=${r.id} className=${AMS.cx('ath-chip', to === r.id && 'on')} onClick=${() => { setTo(r.id); setText(aiDraft(a, r.id)); }}>${r.label}</button>`)}</div><//>
      <${UI.Field} label="Message" help=${role === 'ops' ? 'Operations cannot see readiness or medical details, so the AI draft sticks to admin items.' : 'Medical details are summarised per the recipient’s access.'}><textarea className="textarea" rows=${5} value=${text} onChange=${(e) => setText(e.target.value)} /><//>
      <div className="row tight"><button className="btn sm" style=${{ borderColor: 'var(--ai-border)', color: 'var(--ai)' }} onClick=${() => setText(aiDraft(a, to))}><${I} name="sparkles" size=${13} />Redraft with AI</button><span className="tiny faint">Draft uses ${first(a.name)}'s live data — you edit before sending.</span></div>
    <//>`;
  }
  AMS.registerModal('athlete-message', MessageModal, { sample: () => [{ athleteId: AMS.db.meta.heroAthleteId }, { athleteIds: AMS.db.athletes.slice(0, 5).map((a) => a.id) }] });

  /* ================================================================== MODAL: export (preview + copy CSV) */
  const EXPORT_COLS = [
    { id: 'id', label: 'Athlete ID', get: (a) => a.id }, { id: 'name', label: 'Name', get: (a) => a.name }, { id: 'dob', label: 'DOB', get: (a) => a.dob },
    { id: 'ag', label: 'Age group', get: (a) => agOf(a) }, { id: 'sport', label: 'Sport', get: (a) => a.sport }, { id: 'squad', label: 'Squad', get: (a) => squadName(a.squadId) },
    { id: 'centre', label: 'Centre', get: (a) => centreShort(a.centreId) }, { id: 'coach', label: 'Coach', get: (a) => staffName(a.coachId) }, { id: 'enr', label: 'Enrollment', get: (a) => a.enrollment },
    { id: 'avail', label: 'Availability', get: (a) => a.availability }, { id: 'rd', label: 'Readiness', perf: true, get: (a) => AMS.calc.readiness(a).score }, { id: 'acwr', label: 'ACWR', perf: true, get: (a) => AMS.calc.acwr(a).toFixed(2) },
    { id: 'pc', label: 'Profile %', get: (a) => a.profileCompletion }, { id: 'tags', label: 'Tags', get: (a) => a.tags.join('; ') },
  ];
  function ExportModal({ ids, label }) {
    const perf = P.perf();
    const cols = EXPORT_COLS.filter((c) => !c.perf || perf);
    const [on, setOn] = useState(() => cols.reduce((m, c) => { m[c.id] = !['dob', 'tags'].includes(c.id); return m; }, {}));
    const [sched, setSched] = UI.useLocal('athletes:schedules', { weekly: false, monthly: true });
    const [copied, setCopied] = useState(null);
    const list = (ids || []).map((id) => AMS.org.athlete(id)).filter(Boolean);
    const sel = cols.filter((c) => on[c.id]);
    const esc = (x) => { const s = String(x == null ? '' : x); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = [sel.map((c) => c.label).join(',')].concat(list.map((a) => sel.map((c) => esc(c.get(a))).join(','))).join('\n');
    const copy = () => {
      try { navigator.clipboard.writeText(csv).then(() => setCopied('ok'), () => setCopied('fail')); } catch (e) { setCopied('fail'); }
      AMS.mutate(() => AMS.log({ type: 'export', text: 'Exported ' + plural(list.length, 'athlete') + ' (' + sel.length + ' columns) — ' + (label || 'registry') }));
    };
    const footer = html`<span className="tiny muted grow" style=${{ alignSelf: 'center' }}>${copied === 'ok' ? 'Copied ' + list.length + ' rows to clipboard' : copied === 'fail' ? 'Clipboard blocked — select the preview text and copy manually' : plural(list.length, 'row') + ' · ' + sel.length + ' columns'}</span><button className="btn" onClick=${AMS.closeModal}>Close</button><button className="btn primary" onClick=${copy}><${I} name="copy" size=${14} />Copy CSV</button>`;
    return html`<${UI.ModalFrame} title="Export athletes" sub=${(label || 'Current view') + ' · ' + AMS.scopeLabel() + (perf ? '' : ' · readiness & load columns not available to your role')} icon="download" wide=${true} footer=${footer}>
      <div className="row wrap tight">${cols.map((c) => html`<button key=${c.id} className=${AMS.cx('ath-chip', on[c.id] && 'on')} onClick=${() => setOn(Object.assign({}, on, { [c.id]: !on[c.id] }))}>${on[c.id] && html`<${I} name="check" size=${11} />`}${c.label}</button>`)}</div>
      <pre className="mono" style=${{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: 10, maxHeight: 220, overflow: 'auto', fontSize: 11, margin: 0, whiteSpace: 'pre' }}>${csv.split('\n').slice(0, 9).join('\n')}${list.length > 8 ? '\n… ' + (list.length - 8) + ' more rows' : ''}</pre>
      <${UI.Card} title="Scheduled reports" icon="clock" hint="for federation & government reporting">
        <div className="col tight">
          <${UI.Toggle} id="sched-weekly" checked=${!!sched.weekly} onChange=${(x) => setSched(Object.assign({}, sched, { weekly: x }))} label="Every Monday 08:00 — registry snapshot to the Performance Director" />
          <${UI.Toggle} id="sched-monthly" checked=${!!sched.monthly} onChange=${(x) => setSched(Object.assign({}, sched, { monthly: x }))} label="1st of the month — Khelo India enrolment return (PDF + Excel)" />
        </div>
      <//>
    <//>`;
  }
  AMS.registerModal('athletes-export', ExportModal, { sample: () => [{ ids: AMS.db.athletes.slice(0, 20).map((a) => a.id), label: 'Sample' }] });

  /* ================================================================== PAGE: registry */
  const VIEWS = [
    { id: 'all', label: 'All athletes', test: () => true },
    { id: 'red', label: 'Red today', perf: true, test: (r) => r.a.enrollment === 'Active' && r.rd.band === 'bad' },
    { id: 'unavail', label: 'Active but unavailable', test: (r) => r.a.enrollment === 'Active' && r.a.availability !== 'Available' },
    { id: 'u18', label: 'Under-18 without consent', test: (r) => r.u18nc },
    { id: 'profile', label: 'Profiles < 90%', test: (r) => r.a.profileCompletion < 90 },
    { id: 'docs', label: 'Document issues', test: (r) => r.issues > 0 },
    { id: 'nocoach', label: 'No coach', test: (r) => !r.a.coachId },
    { id: 'camp', label: 'Temporary assignment', test: (r) => !!r.a.tempAssignment },
  ];
  const EMPTY_F = { q: '', enrollment: '', availability: '', band: '', sport: '', squad: '', tag: '', ageGroup: '' };
  function RegistryTab({ params, goTab }) {
    const { db, ui, v } = AMS.useStore();
    const role = ui.role, perf = P.perf();
    const [view, setView] = useState(params.view || 'all');
    const [f, setF] = useState(EMPTY_F);
    const [sel, setSel] = useState({});
    const [tagDraft, setTagDraft] = useState('');
    const [saved, setSaved] = UI.useLocal('athletes:savedViews', []);
    const [naming, setNaming] = useState(null);
    useEffect(() => { if (params.view) setView(params.view); }, [params.view]);
    const scopeKey = JSON.stringify(AMS.effectiveScope());
    const rows = useMemo(() => AMS.scopedAthletes({ all: true }).map((a) => {
      const age = ageOf(a);
      return { id: a.id, a, age, ag: AMS.calc.ageGroup(age), rd: AMS.calc.readiness(a), acwr: AMS.calc.acwr(a), u18nc: age < 18 && !(a.guardian && a.guardian.consent), issues: docIssues(a).length };
    }), [v, role, scopeKey]);
    const views = VIEWS.filter((x) => !x.perf || perf);
    const custom = saved.find((s) => s.id === view);
    const vdef = views.find((x) => x.id === view) || (custom ? { id: custom.id, label: custom.label, test: () => true } : views[0]);
    const ff = custom ? Object.assign({}, EMPTY_F, custom.f) : f;
    const q = ff.q.trim().toLowerCase();
    const list = rows.filter((r) => vdef.test(r)
      && (!q || r.a.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || String(r.a.events).toLowerCase().includes(q) || r.a.tags.some((t) => t.toLowerCase().includes(q)))
      && (!ff.enrollment || r.a.enrollment === ff.enrollment) && (!ff.availability || r.a.availability === ff.availability)
      && (!ff.band || (r.a.enrollment === 'Active' && r.rd.band === ff.band)) && (!ff.sport || r.a.sport === ff.sport) && (!ff.squad || r.a.squadId === ff.squad)
      && (!ff.tag || r.a.tags.includes(ff.tag)) && (!ff.ageGroup || r.ag === ff.ageGroup));
    const count = (id) => rows.filter((r) => (VIEWS.find((x) => x.id === id) || {}).test(r)).length;
    const selIds = Object.keys(sel).filter((k) => sel[k] && list.some((r) => r.id === k));
    const allSel = list.length > 0 && selIds.length === list.length;
    const toggle = (id) => setSel(Object.assign({}, sel, { [id]: !sel[id] }));
    const toggleAll = () => setSel(allSel ? {} : list.reduce((m, r) => { m[r.id] = true; return m; }, {}));
    const setFilter = (k, val) => { if (custom) { setF(Object.assign({}, custom.f, { [k]: val })); setView('all'); } else setF(Object.assign({}, f, { [k]: val })); };
    const active = Object.entries(ff).filter(([k, val]) => val && k !== 'q');
    const sports = [...new Set(rows.map((r) => r.a.sport))];
    const squads = [...new Set(rows.map((r) => r.a.squadId))].map((id) => ({ value: id, label: squadName(id) + ' · ' + centreShort((AMS.org.squad(id) || {}).centreId) }));
    const tags = [...new Set(rows.flatMap((r) => r.a.tags))].sort();
    const actives = rows.filter((r) => r.a.enrollment === 'Active');
    const openApps = db.applications.filter((p) => OPEN_STAGES.includes(p.stage) && appInScope(p));
    const insights = AMS.ai.insights({ module: 'athletes', limit: 3 });
    const kpis = role === 'ops' ? [
      { label: 'Active athletes', value: actives.length, foot: rows.length - actives.length + ' other enrollment states', icon: 'users', onClick: () => setView('all') },
      { label: 'Applications open', value: openApps.length, foot: openApps.filter((p) => D.diff(T, p.submitted) > SLA_DAYS).length + ' over the 5-day target', icon: 'shield-check', tone: openApps.some((p) => D.diff(T, p.submitted) > SLA_DAYS) ? 'warn' : '', onClick: () => goTab('onboarding') },
      { label: 'Profiles < 90%', value: count('profile'), foot: 'avg ' + Math.round(AMS.mean(actives.map((r) => r.a.profileCompletion))) + '% complete', icon: 'clipboard', onClick: () => setView('profile') },
      { label: 'Document issues', value: count('docs'), foot: 'expiring, flagged or pending', icon: 'file', tone: count('docs') ? 'warn' : '', onClick: () => setView('docs') },
      { label: 'Without coach', value: count('nocoach') + db.applications.filter((p) => p.stage === 'Approved' && !p.coachId && !p.athleteId && appInScope(p)).length, foot: 'incl. approved, not yet active', icon: 'whistle', tone: 'bad', onClick: () => goTab('assignment') },
    ] : [
      { label: 'Active athletes', value: actives.length, foot: actives.filter((r) => r.a.availability === 'Available').length + ' available today', icon: 'users', onClick: () => setView('all') },
      perf && { label: 'Red today', value: count('red'), foot: 'readiness < 50', icon: 'alert', tone: count('red') ? 'bad' : 'good', onClick: () => setView('red') },
      { label: 'Active but unavailable', value: count('unavail'), foot: 'Modified or Unavailable', icon: 'flag', tone: 'warn', onClick: () => setView('unavail') },
      { label: 'Under-18 w/o consent', value: count('u18'), foot: 'blocks medical records', icon: 'shield', tone: count('u18') ? 'bad' : 'good', onClick: () => setView('u18') },
      { label: 'Profiles < 90%', value: count('profile'), foot: 'tap to see who', icon: 'clipboard', onClick: () => setView('profile') },
    ].filter(Boolean);
    const cols = [
      { key: 'sel', label: html`<input type="checkbox" checked=${allSel} onChange=${toggleAll} onClick=${(e) => e.stopPropagation()} aria-label="Select all" />`, sort: false, width: 32, render: (r) => html`<input type="checkbox" checked=${!!sel[r.id]} onClick=${(e) => e.stopPropagation()} onChange=${() => toggle(r.id)} aria-label=${'Select ' + r.a.name} />` },
      { key: 'name', label: 'Athlete', sort: (r) => r.a.name, render: (r) => html`<${UI.AthleteCell} athlete=${r.a} sub=${r.a.events + ' · ' + (r.a.gender === 'F' ? 'F' : 'M')} />` },
      { key: 'id', label: 'ID', hideSm: true, sort: (r) => r.id, render: (r) => html`<span className="mono faint">${r.id}</span>` },
      { key: 'squad', label: 'Squad · centre', hideSm: true, sort: (r) => squadName(r.a.squadId), render: (r) => html`<span className="col tight" style=${{ gap: 0 }}><span className="small ellipsis" style=${{ maxWidth: 170 }}>${squadName(r.a.squadId)}</span><span className="tiny faint">${centreShort(r.a.centreId)}${r.a.tempAssignment ? (r.a.tempAssignment.active ? ' · at ' : ' · → ') + centreShort(r.a.tempAssignment.centreId) : ''}</span></span>` },
      { key: 'ag', label: 'Age', sort: (r) => r.age, render: (r) => html`<span className="small tnum">${r.age} · ${r.ag}${r.u18nc ? html` <${UI.Pill} tone="bad" title="No guardian consent">!<//>` : ''}</span>` },
      { key: 'enr', label: 'Enrollment', hideSm: true, sort: (r) => r.a.enrollment, render: (r) => html`<${UI.EnrollmentPill} value=${r.a.enrollment} />` },
      { key: 'avail', label: 'Availability', sort: (r) => r.a.availability, render: (r) => html`<span title=${availabilityText(r.a)}><${UI.AvailabilityPill} value=${r.a.availability} /></span>` },
      perf && { key: 'rd', label: 'Readiness', sort: (r) => (r.a.enrollment === 'Active' ? r.rd.score : -1), render: (r) => (r.a.enrollment === 'Active' ? html`<${UI.Readiness} athlete=${r.a} size=${30} />` : html`<span className="faint">—</span>`) },
      perf && { key: 'acwr', label: 'ACWR', sort: (r) => r.acwr, render: (r) => html`<${UI.AcwrPill} value=${r.acwr} />` },
      !perf && { key: 'coach', label: 'Coach', hideSm: true, sort: (r) => staffName(r.a.coachId), render: (r) => (r.a.coachId ? html`<span className="small">${staffName(r.a.coachId)}</span>` : html`<${UI.Pill} tone="bad">None<//>`) },
      { key: 'pc', label: 'Profile', sort: (r) => r.a.profileCompletion, render: (r) => html`<span className="row tight" style=${{ minWidth: 92 }} title=${r.a.missingFields.join(', ') || 'Complete'}><${UI.Meter} value=${r.a.profileCompletion} tone=${pcTone(r.a.profileCompletion)} style=${{ width: 48 }} /><span className="tiny tnum">${r.a.profileCompletion}%</span></span>` },
      { key: 'ver', label: 'Verification', hideSm: true, sort: (r) => r.issues, render: (r) => (r.issues ? html`<${UI.Pill} tone="warn">${plural(r.issues, 'doc issue')}<//>` : html`<${UI.Pill} tone="good"><${I} name="shield-check" size=${11} />Verified<//>`) },
      { key: 'tags', label: 'Tags', hideSm: true, sort: false, render: (r) => html`<span className="row tight" style=${{ flexWrap: 'nowrap' }}>${r.a.tags.slice(0, 2).map((t) => html`<span key=${t} className="tag">${t}</span>`)}${r.a.tags.length > 2 && html`<span className="tiny faint">+${r.a.tags.length - 2}</span>`}</span>` },
    ].filter(Boolean);
    const exportIt = (ids, lbl) => AMS.openModal('athletes-export', { ids, label: lbl });
    return html`<div className="col loose">
      <div className=${'grid ' + (kpis.length === 5 ? 'g5' : 'g4')}>${kpis.map((k) => html`<${UI.KPI} key=${k.label} ...${k} />`)}</div>
      ${insights.length > 0 && html`<${UI.Card} title="AI — athlete operations" ai=${true} flush=${true} hint=${plural(insights.length, 'flag')}><${UI.InsightList} insights=${insights} compact=${true} /><//>`}
      <div className="row wrap tight">
        ${views.map((x) => html`<button key=${x.id} className=${AMS.cx('ath-chip', view === x.id && 'on')} onClick=${() => { setView(x.id); setSel({}); }}>${x.label}<span className="n">${x.id === 'all' ? rows.length : count(x.id)}</span></button>`)}
        ${saved.map((s) => html`<span key=${s.id} className=${AMS.cx('ath-chip', view === s.id && 'on')} onClick=${() => { setView(s.id); setSel({}); }}><${I} name="filter" size=${11} />${s.label}<button className="btn ghost xs icon" style=${{ height: 16, width: 16 }} aria-label="Delete view" onClick=${(e) => { e.stopPropagation(); setSaved(saved.filter((x) => x.id !== s.id)); if (view === s.id) setView('all'); }}><${I} name="x" size=${10} /></button></span>`)}
      </div>
      <div className="row wrap tight">
        <${UI.Search} value=${ff.q} onChange=${(x) => setFilter('q', x)} placeholder="Search name, ID, event, tag" style=${{ width: 240 }} />
        <${UI.Select} value=${ff.enrollment} onChange=${(x) => setFilter('enrollment', x)} placeholder="Enrollment" options=${['Active', 'Verifying', 'Transferred', 'Inactive', 'Retired']} />
        <${UI.Select} value=${ff.availability} onChange=${(x) => setFilter('availability', x)} placeholder="Availability" options=${['Available', 'Modified', 'Unavailable']} />
        ${perf && html`<${UI.Select} value=${ff.band} onChange=${(x) => setFilter('band', x)} placeholder="Readiness" options=${[{ value: 'good', label: 'Green' }, { value: 'warn', label: 'Amber' }, { value: 'bad', label: 'Red' }]} />`}
        <${UI.Select} value=${ff.sport} onChange=${(x) => setFilter('sport', x)} placeholder="Sport" options=${sports} />
        <${UI.Select} value=${ff.squad} onChange=${(x) => setFilter('squad', x)} placeholder="Squad" options=${squads} />
        <${UI.Select} value=${ff.tag} onChange=${(x) => setFilter('tag', x)} placeholder="Tag" options=${tags} />
        <${UI.Select} value=${ff.ageGroup} onChange=${(x) => setFilter('ageGroup', x)} placeholder="Age group" options=${['U-17', 'U-20', 'Senior']} />
        ${(active.length > 0 || ff.q) && !custom && (naming == null ? html`<button className="btn sm" onClick=${() => setNaming('')}><${I} name="filter" size=${13} />Save view</button>` : html`<span className="row tight"><input className="input" style=${{ height: 28, width: 150 }} value=${naming} placeholder="View name" onChange=${(e) => setNaming(e.target.value)} /><button className="btn sm primary" disabled=${!naming.trim()} onClick=${() => { const id = 'custom:' + naming.trim().toLowerCase().replace(/\W+/g, '-'); setSaved(saved.filter((s) => s.id !== id).concat({ id, label: naming.trim(), f })); setView(id); setNaming(null); }}>Save</button></span>`)}
        ${(active.length > 0 || ff.q) && html`<button className="btn ghost sm" onClick=${() => { setF(EMPTY_F); if (custom) setView('all'); }}>Clear filters</button>`}
        <span className="grow" />
        <span className="small muted">${plural(list.length, 'athlete')}</span>
        <button className="btn sm" onClick=${() => exportIt(list.map((r) => r.id), vdef.label)}><${I} name="download" size=${13} />Export</button>
      </div>
      ${active.length > 0 && html`<div className="row wrap tight">${active.map(([k, val]) => html`<span key=${k} className="tag">${k === 'squad' ? squadName(val) : k === 'band' ? AMS.calc.bandLabel(val) : val}<button className="btn ghost xs icon" style=${{ height: 16, width: 16 }} aria-label="Remove filter" onClick=${() => setFilter(k, '')}><${I} name="x" size=${10} /></button></span>`)}</div>`}
      ${selIds.length > 0 && html`<div className="ath-bulk row wrap tight">
        <b className="small">${selIds.length} selected</b>
        ${P.tag() && html`<span className="row tight"><input className="input" list="ath-tag-suggest" style=${{ height: 28, width: 170 }} value=${tagDraft} placeholder="Tag to add" onChange=${(e) => setTagDraft(e.target.value)} /><datalist id="ath-tag-suggest">${TAG_POOL.concat(tags).filter((t, i, arr) => arr.indexOf(t) === i).map((t) => html`<option key=${t} value=${t} />`)}</datalist><button className="btn sm" disabled=${!tagDraft.trim()} onClick=${() => { AMS.runAction('athlete.addTag', { athleteIds: selIds, tag: tagDraft }); setTagDraft(''); }}><${I} name="tag" size=${13} />Add tag</button></span>`}
        <button className="btn sm" onClick=${() => AMS.openModal('athlete-message', { athleteIds: selIds })}><${I} name="message" size=${13} />Message</button>
        ${P.request() && html`<button className="btn sm" onClick=${() => AMS.runAction('athlete.requestMissing', { athleteIds: selIds })}><${I} name="send" size=${13} />Request missing items</button>`}
        ${P.edit() && html`<button className="btn sm" onClick=${() => AMS.openModal('assign-coach', { athleteIds: selIds })}><${I} name="whistle" size=${13} />Assign coach</button>`}
        <button className="btn sm" onClick=${() => exportIt(selIds, 'Selection')}><${I} name="download" size=${13} />Export</button>
        <span className="grow" /><button className="btn ghost sm" onClick=${() => setSel({})}>Clear</button>
      </div>`}
      <${UI.Card} flush=${true}>
        <${UI.Table} columns=${cols} rows=${list} onRow=${(r) => AMS.openAthlete(r.id)} maxHeight=${640} compact=${true} empty="No athletes match these filters" initialSort=${perf && view === 'red' ? { key: 'rd', dir: 'asc' } : null} />
      <//>
      ${!perf && html`<span className="tiny faint"><${I} name="lock" size=${11} /> Readiness, load and medical columns are not shown to ${AMS.roleLabel(role)} (product doc §5).</span>`}
    </div>`;
  }

  /* ================================================================== PAGE: onboarding & verification queue */
  function AppCard({ p }) {
    const pre = aiPrecheck(p);
    const u18nc = noConsent(p);
    return html`<button className="ath-card" onClick=${() => AMS.openDrawer('application', { appId: p.id })}>
      <span className="row between" style=${{ gap: 6 }}><b style=${{ fontSize: 13 }} className="ellipsis">${p.name}</b><${SlaPill} p=${p} /></span>
      <span className="tiny faint ellipsis">${p.id} · ${squadName(p.squadId)} · ${centreShort(p.centreId)}</span>
      <span className="row tight wrap">
        <span className="tiny">${pre.verified}/${pre.total} verified</span>
        ${p.duplicateOf && !p.duplicateOf.resolved && html`<${UI.Pill} tone="bad"><${I} name="copy" size=${10} />Duplicate ${Math.round(p.duplicateOf.score * 100)}%<//>`}
        ${u18nc && OPEN_STAGES.includes(p.stage) && html`<${UI.Pill} tone="warn">Consent<//>`}
        ${p.stage === 'Approved' && html`<${UI.Pill} tone=${p.coachId || (p.athleteId && (AMS.org.athlete(p.athleteId) || {}).coachId) ? 'good' : 'bad'}>${p.coachId || (p.athleteId && (AMS.org.athlete(p.athleteId) || {}).coachId) ? 'Coach ' + first(staffName(p.coachId || AMS.org.athlete(p.athleteId).coachId)) : 'Needs coach'}<//>`}
      </span>
      ${OPEN_STAGES.includes(p.stage) && html`<span className="row top tight" style=${{ gap: 5 }}><${I} name="sparkles" size=${12} style=${{ color: 'var(--ai)', flex: 'none', marginTop: 2 }} /><span className=${'tiny ' + (pre.tone === 'bad' ? 'bad' : pre.tone === 'warn' ? 'warn' : 'muted')} style=${{ lineHeight: 1.4 }}>${pre.summary.length > 110 ? pre.summary.slice(0, 108) + '…' : pre.summary}</span></span>`}
      ${p.stage === 'Docs returned' && html`<span className="tiny muted">Returned: ${p.returnReason}</span>`}
      ${p.stage === 'Rejected' && html`<span className="tiny muted">${p.rejectReason}</span>`}
      ${p.stage === 'Merged' && html`<span className="tiny muted">Merged into ${p.mergedInto}</span>`}
    </button>`;
  }
  function OnboardingTab() {
    const { db, v } = AMS.useStore();
    const [mode, setMode] = UI.useLocal('athletes:onbMode', 'board');
    const apps = db.applications.filter(appInScope);
    const open = apps.filter((p) => OPEN_STAGES.includes(p.stage));
    const over = open.filter((p) => D.diff(T, p.submitted) > SLA_DAYS);
    const dups = open.filter((p) => p.duplicateOf && !p.duplicateOf.resolved);
    const aiReady = open.filter((p) => p.docs.some((d) => d.status === 'Pending' && d.ai && d.ai.ok && d.ai.confidence >= 0.9));
    const aiDocs = AMS.sum(aiReady.map((p) => p.docs.filter((d) => d.status === 'Pending' && d.ai && d.ai.ok && d.ai.confidence >= 0.9).length));
    const ready = open.filter((p) => approvalBlockers(p).length === 0);
    const flagged = open.filter((p) => aiPrecheck(p).flags.length);
    const decided = apps.filter((p) => p.approvedOn || p.decidedOn);
    const avgDays = Math.round(AMS.mean(open.map((p) => D.diff(T, p.submitted))) * 10) / 10;
    const canEdit = P.edit();
    const insights = AMS.ai.insights({ module: 'athletes' }).filter((i) => /^(dup|consent|nocoach):APP/.test(i.id) || /^sla:/.test(i.id));
    return html`<div className="col loose">
      <div className="grid g5">
        <${UI.KPI} label="Open applications" value=${open.length} foot=${apps.length - open.length + ' decided'} icon="file" />
        <${UI.KPI} label="Over 5-day target" value=${over.length} tone=${over.length ? 'bad' : 'good'} foot=${'avg ' + avgDays + ' days open'} icon="clock" />
        <${UI.KPI} label="AI-flagged" value=${flagged.length} tone=${flagged.length ? 'warn' : ''} foot="document problems found" icon="sparkles" />
        <${UI.KPI} label="Possible duplicates" value=${dups.length} tone=${dups.length ? 'bad' : 'good'} foot="merge or confirm" icon="copy" />
        <${UI.KPI} label="Ready to approve" value=${ready.length} tone=${ready.length ? 'good' : ''} foot=${decided.length + ' decided so far'} icon="check" />
      </div>
      <div className="grid g-main">
        <div className="ai-box col tight" style=${{ gap: 8 }}>
          <div className="row between wrap"><${UI.AIChip} label="Verification copilot" /><span className="tiny faint">AI reads every upload; a person confirms</span></div>
          <div className="small" style=${{ lineHeight: 1.5 }}>
            ${aiDocs ? html`<b>${plural(aiDocs, 'document')}</b> across ${plural(aiReady.length, 'application')} passed the AI pre-check at ≥ 90% confidence and only need your confirmation. ` : 'No AI-passed documents are waiting. '}
            ${flagged.length ? html`${plural(flagged.length, 'application')} ha${flagged.length === 1 ? 's' : 've'} a flagged document (${flagged.map((p) => first(p.name)).join(', ')}) — usually a return to the applicant. ` : ''}
            ${dups.length ? html`${dups.map((p) => p.name).join(', ')} may already exist in the registry. ` : ''}
            ${over.length ? html`Oldest open: <b>${over.sort((x, y) => x.submitted.localeCompare(y.submitted))[0].name}</b>, ${D.diff(T, over[0].submitted)} days.` : ''}
          </div>
          ${canEdit && html`<div className="row wrap tight">
            <button className="btn sm ai" disabled=${!aiDocs} onClick=${() => AMS.runAction('application.autoVerify', { appIds: aiReady.map((p) => p.id) })}><${I} name="zap" size=${13} />Confirm ${aiDocs} AI-passed documents</button>
            <button className="btn sm" onClick=${() => AMS.openModal('enroll')}><${I} name="plus" size=${13} />New application</button>
          </div>`}
        </div>
        <${UI.Card} title="Flags" ai=${true} flush=${true}><${UI.InsightList} insights=${insights} compact=${true} max=${3} empty="Queue is clean" /><//>
      </div>
      <div className="row between wrap"><${UI.Seg} options=${[{ id: 'board', label: 'Pipeline' }, { id: 'table', label: 'Table' }]} value=${mode} onChange=${setMode} /><span className="tiny faint">Applied → Verifying → (Docs returned ↺) → Approved → Coach assigned → Active · SLA target ${SLA_DAYS} days</span></div>
      ${mode === 'board' ? html`<div className="ath-board">${BOARD_COLS.map((c) => { const items = apps.filter((p) => c.stages.includes(p.stage)).sort((x, y) => x.submitted.localeCompare(y.submitted)); return html`<div key=${c.id} className="ath-col">
        <div className="ath-col-h"><span className="row tight"><span className=${'dot ' + (c.tone || 'neutral')} />${c.label}</span><span className="tiny faint">${items.length}</span></div>
        <div className="ath-col-b">${items.length ? items.map((p) => html`<${AppCard} key=${p.id} p=${p} />`) : html`<span className="tiny faint" style=${{ padding: 8 }}>Empty</span>`}</div>
      </div>`; })}</div>` : html`<${UI.Card} flush=${true}><${UI.Table} rows=${apps} onRow=${(p) => AMS.openDrawer('application', { appId: p.id })} compact=${true} initialSort=${{ key: 'sub', dir: 'asc' }} columns=${[
        { key: 'name', label: 'Applicant', sort: (p) => p.name, render: (p) => html`<span className="row tight"><${UI.Avatar} name=${p.name} size=${26} /><span className="col tight" style=${{ gap: 0 }}><b className="small">${p.name}</b><span className="tiny faint mono">${p.id}</span></span></span>` },
        { key: 'stage', label: 'Stage', sort: (p) => p.stage, render: (p) => html`<${UI.Pill} tone=${{ Applied: 'info', Verifying: 'warn', 'Docs returned': 'bad', Approved: 'good' }[p.stage]} className=${['Rejected', 'Merged'].includes(p.stage) ? 'outline' : ''}>${p.stage}<//>` },
        { key: 'squad', label: 'Squad', hideSm: true, sort: (p) => squadName(p.squadId), render: (p) => html`<span className="small">${squadName(p.squadId)} · ${centreShort(p.centreId)}</span>` },
        { key: 'sub', label: 'SLA', sort: (p) => p.submitted, render: (p) => html`<${SlaPill} p=${p} />` },
        { key: 'docs', label: 'Docs', sort: (p) => aiPrecheck(p).verified, render: (p) => { const x = aiPrecheck(p); return html`<span className="small tnum">${x.verified}/${x.total}</span>`; } },
        { key: 'ai', label: 'AI pre-check', hideSm: true, sort: false, render: (p) => { const x = aiPrecheck(p); return html`<span className=${'tiny ' + (x.tone === 'bad' ? 'bad' : x.tone === 'warn' ? 'warn' : 'muted')}>${x.summary.length > 80 ? x.summary.slice(0, 78) + '…' : x.summary}</span>`; } },
        { key: 'dup', label: 'Flags', sort: false, render: (p) => html`<span className="row tight">${p.duplicateOf && !p.duplicateOf.resolved && html`<${UI.Pill} tone="bad">Duplicate<//>`}${noConsent(p) && OPEN_STAGES.includes(p.stage) && html`<${UI.Pill} tone="warn">Consent<//>`}</span>` },
      ]} /><//>`}
    </div>`;
  }

  /* ================================================================== PAGE: coach assignment */
  function AssignmentTab() {
    const { db, v } = AMS.useStore();
    const canEdit = P.edit();
    const queue = useMemo(() => {
      const out = [];
      db.applications.filter((p) => p.stage === 'Approved' && !p.coachId && !p.athleteId && appInScope(p)).forEach((p) => out.push({ key: p.id, props: { appId: p.id }, name: p.name, since: approvedOn(p), label: 'Approved application · ' + p.id }));
      AMS.scopedAthletes({ all: true }).filter((a) => a.enrollment === 'Active' && !a.coachId).forEach((a) => out.push({ key: a.id, props: { athleteId: a.id }, name: a.name, since: a.enrolledOn, label: 'Active athlete · ' + a.id, athlete: a }));
      return out.map((x) => { const subj = subjectFrom(x.props); const opts = recommendCoaches(subj); return Object.assign(x, { subj, top: opts.find((o) => !o.blocked), conf: recConfidence(opts) }); });
    }, [v, JSON.stringify(AMS.ui.scope), AMS.ui.role]);
    const lock = AMS.effectiveScope();
    const squads = db.org.squads.filter((s) => (!lock.centreId || s.centreId === lock.centreId) && (!lock.stateId || (AMS.org.centre(s.centreId) || {}).stateId === lock.stateId) && (!lock.sport || s.sport === lock.sport) && (!lock.squadId || s.id === lock.squadId) && (!(lock.lock || {}).squadIds || lock.lock.squadIds.includes(s.id)));
    const coachIds = [...new Set(squads.map((s) => s.coachId))];
    const coaches = coachIds.map((id) => ({ c: AMS.org.staff(id), sq: db.org.squads.filter((s) => s.coachId === id), load: caseload(id), inj: coachInjuries(id) })).filter((x) => x.c).sort((x, y) => y.load - x.load);
    const recent = db.activity.filter((x) => x.type === 'onboarding' && / assigned to /.test(x.text)).slice(0, 5);
    return html`<div className="grid g-main">
      <div className="col">
        <${UI.Card} title="Waiting for a coach" icon="whistle" hint=${plural(queue.length, 'athlete')} flush=${true}>
          ${queue.length === 0 ? html`<${UI.Empty} icon="check" title="Everyone has a coach">Approved athletes appear here until a coach and squad are confirmed.<//>` : html`<div className="list">${queue.map((x) => html`<div key=${x.key} className="list-item" style=${{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <${UI.Avatar} name=${x.name} size=${34} />
            <div className="col tight grow" style=${{ gap: 4, minWidth: 220 }}>
              <span className="row tight wrap"><b>${x.name}</b><span className="tiny faint">${x.label}</span><${UI.Pill} tone=${D.diff(T, x.since) > 1 ? 'bad' : 'warn'}><${I} name="clock" size=${10} />waiting ${D.diff(T, x.since)}d<//></span>
              <span className="small muted">${ageOf(x.subj)} yrs · ${agOf(x.subj)} · ${x.subj.sport} (${x.subj.discipline}) · requested ${squadName(x.subj.squadId)}, ${centreShort(x.subj.centreId)}</span>
              ${x.top ? html`<div className="ai-box col tight" style=${{ gap: 5, padding: '8px 10px' }}>
                <span className="row tight wrap"><${UI.AIChip} label="Best fit" /><b className="small">${x.top.coach.name}</b><span className="small muted">· ${x.top.squad.name} · ${x.top.size}/${x.top.cap} places · caseload ${x.top.load}</span><span className="tiny faint">${Math.round(x.conf * 100)}% conf.</span></span>
                <${UI.Evidence} items=${x.top.reasons.slice(0, 4)} />
              </div>` : html`<span className="small bad">No eligible squad for this age group and sport.</span>`}
            </div>
            <div className="col tight" style=${{ alignItems: 'stretch' }}>
              ${canEdit && x.top && html`<button className="btn sm primary" onClick=${() => AMS.runAction('athlete.assignCoach', Object.assign({ squadId: x.top.squadId, coachId: x.top.coachId }, x.props))}><${I} name="check" size=${13} />Assign ${first(x.top.coach.name)}</button>`}
              <button className="btn sm" onClick=${() => AMS.openModal('assign-coach', x.props)}>Compare options</button>
            </div>
          </div>`)}</div>`}
        <//>
        <${UI.Card} title="Recently assigned" icon="check" flush=${true}>
          ${recent.length ? html`<div className="list">${recent.map((x) => html`<div key=${x.id} className="list-item clickable" onClick=${() => x.athleteId && AMS.openAthlete(x.athleteId)}><${I} name="whistle" size=${14} style=${{ color: 'var(--good)' }} /><span className="small grow">${x.text}</span><span className="tiny faint">${x.at.slice(11, 16)} · ${D.rel(x.at.slice(0, 10))}</span></div>`)}</div>` : html`<${UI.Empty} icon="clock" title="No assignments yet today" />`}
        <//>
      </div>
      <div className="col">
        <${UI.Card} title="Coach capacity" icon="users" hint=${'caseload limit ' + CASELOAD_LIMIT} flush=${true}>
          <${UI.Table} compact=${true} rows=${coaches.map((x) => Object.assign({ id: x.c.id }, x))} maxHeight=${420} columns=${[
            { key: 'c', label: 'Coach', sort: (x) => x.c.name, render: (x) => html`<span className="col tight" style=${{ gap: 0 }}><b className="small">${x.c.name}</b><span className="tiny faint">${x.sq.map((s) => s.name).join(', ')} · ${centreShort(x.c.centreId)}</span></span>` },
            { key: 'load', label: 'Caseload', sort: (x) => x.load, render: (x) => html`<span className="row tight" style=${{ minWidth: 96 }}><${UI.Meter} value=${x.load} max=${CASELOAD_LIMIT} tone=${x.load >= CASELOAD_LIMIT ? 'bad' : x.load >= CASELOAD_LIMIT - 4 ? 'warn' : 'good'} style=${{ width: 50 }} /><span className="tiny tnum">${x.load}</span></span>` },
            { key: 'inj', label: 'Open inj.', num: true, sort: (x) => x.inj, render: (x) => html`<span className=${x.inj >= 3 ? 'warn' : ''}>${x.inj}</span>` },
          ]} />
        <//>
        <${UI.Card} title="Squad capacity" icon="layers" hint="places used">
          <${UI.HBars} labelWidth=${150} data=${squads.map((s) => ({ label: s.name, sub: centreShort(s.centreId), value: squadSize(s.id), tone: squadSize(s.id) >= (CAPACITY[s.ageGroup] || 12) ? 'bad' : squadSize(s.id) >= (CAPACITY[s.ageGroup] || 12) - 2 ? 'warn' : 'good' })).sort((x, y) => y.value - x.value).slice(0, 12)} max=${14} format=${(n) => n + '/' + 14} />
        <//>
      </div>
    </div>`;
  }

  /* ================================================================== PAGE: profile completion */
  function CompletionTab() {
    const { db, v } = AMS.useStore();
    const [bucket, setBucket] = useState(null);
    const canEdit = P.edit(), canReq = P.request();
    const list = AMS.scopedAthletes();
    const incomplete = list.filter((a) => a.profileCompletion < 100 || a.missingFields.length);
    const B = [['< 80%', 0, 79], ['80–84%', 80, 84], ['85–89%', 85, 89], ['90–94%', 90, 94], ['95–99%', 95, 99], ['100%', 100, 100]];
    const dist = B.map(([label, lo, hi], i) => ({ label, value: list.filter((a) => a.profileCompletion >= lo && a.profileCompletion <= hi).length, tone: i < 2 ? 'bad' : i < 4 ? 'warn' : 'good' }));
    const shown = bucket ? incomplete.filter((a) => { const b = B.find((x) => x[0] === bucket); return a.profileCompletion >= b[1] && a.profileCompletion <= b[2]; }) : incomplete;
    const byField = AMS.groupBy(shown.flatMap((a) => a.missingFields.map((f) => ({ f, a }))), (x) => x.f);
    const groups = Object.entries(byField).sort((x, y) => y[1].length - x[1].length);
    const openReq = db.tasks.filter((t) => t.status === 'Open' && (t.ref || '').startsWith('REQ:'));
    const verifiedComplete = list.filter((a) => a.profileCompletion === 100 && docIssues(a).length === 0).length;
    const insights = AMS.ai.insights({ module: 'athletes' }).filter((i) => /^gaps:/.test(i.id));
    return html`<div className="col loose">
      <div className="grid g4">
        <${UI.KPI} label="Average completion" value=${Math.round(AMS.mean(list.map((a) => a.profileCompletion)))} unit="%" foot=${plural(list.length, 'active athlete')} icon="clipboard" />
        <${UI.KPI} label="Complete & verified" value=${list.length ? Math.round((verifiedComplete / list.length) * 100) : 0} unit="%" foot="success metric (product doc §8)" icon="shield-check" tone="good" />
        <${UI.KPI} label="Missing items" value=${AMS.sum(list.map((a) => a.missingFields.length))} foot=${plural(incomplete.length, 'athlete')} icon="alert" tone="warn" />
        <${UI.KPI} label="Requests open" value=${openReq.length} foot="waiting on athlete / guardian" icon="send" />
      </div>
      <div className="grid g-main">
        <${UI.Card} title="Completion distribution" icon="chart" hint=${bucket ? 'filtered: ' + bucket : 'tap a bar to filter'} actions=${bucket ? html`<button className="btn ghost xs" onClick=${() => setBucket(null)}>Clear</button>` : null}>
          <${UI.BarChart} data=${dist} height=${170} onBar=${(d) => setBucket(bucket === d.label ? null : d.label)} highlight=${bucket ? B.findIndex((x) => x[0] === bucket) : null} />
        <//>
        <${UI.Card} title="AI" ai=${true} flush=${true}><${UI.InsightList} insights=${insights} compact=${true} max=${2} empty="No squad stands out" /><//>
      </div>
      <div className="grid g2">${groups.map(([field, items]) => { const ids = items.map((x) => x.a.id); const reqd = items.filter((x) => db.tasks.some((t) => t.status === 'Open' && t.ref === reqRef(x.a.id, field))).length; return html`<${UI.Card} key=${field} title=${field} icon=${DOC_FIELDS.includes(field) ? 'file' : 'user'} hint=${items.length + ' athletes · ' + reqd + ' requested'} flush=${true}
        actions=${canReq ? html`<button className="btn xs" disabled=${reqd === items.length} onClick=${() => AMS.runAction('athlete.requestMissing', { athleteIds: ids, field })}><${I} name="send" size=${12} />Send reminder to ${items.length - reqd}</button>` : null}>
        <div className="list" style=${{ maxHeight: 280, overflowY: 'auto' }}>${items.slice(0, 30).map(({ a }) => { const rq = db.tasks.find((t) => t.status === 'Open' && t.ref === reqRef(a.id, field)); return html`<div key=${a.id} className="list-item" style=${{ padding: '8px 14px' }}>
          <span className="grow" style=${{ minWidth: 0 }}><${UI.AthleteCell} athlete=${a} size=${26} /></span>
          <span className="row tight" style=${{ width: 74 }}><${UI.Meter} value=${a.profileCompletion} tone=${pcTone(a.profileCompletion)} style=${{ width: 36 }} /><span className="tiny tnum">${a.profileCompletion}%</span></span>
          ${rq ? html`<span className="tiny faint" style=${{ width: 92 }}>asked ${D.rel(rq.created)}</span>` : canReq ? html`<button className="btn xs ghost" style=${{ width: 92 }} onClick=${() => AMS.runAction('athlete.requestMissing', { athleteId: a.id, field })}>Request</button>` : html`<span style=${{ width: 92 }} />`}
          ${canEdit && html`<button className="btn xs" onClick=${() => AMS.runAction('athlete.markReceived', { athleteId: a.id, field })}><${I} name="check" size=${12} />Received</button>`}
        </div>`; })}${items.length > 30 && html`<div className="list-item tiny faint">+${items.length - 30} more</div>`}</div>
      <//>`; })}${groups.length === 0 && html`<${UI.Empty} icon="check" title="All profiles in this view are complete" />`}</div>
    </div>`;
  }

  /* ================================================================== PAGE: documents */
  function DocumentsPage() {
    const { db, ui, v } = AMS.useStore();
    const [mode, setMode] = useState('action');
    const role = ui.role;
    const rows = useMemo(() => {
      const out = [];
      AMS.scopedAthletes({ all: true }).forEach((a) => liveDocs(a).forEach((d) => { if (canSeeDoc(d, a)) out.push({ id: d.id, a, d, st: docStatus(d) }); }));
      return out;
    }, [v, role, JSON.stringify(ui.scope)]);
    if (!P.docsAll() && !P.docsMed()) {
      const all = AMS.scopedAthletes({ all: true });
      const iss = all.filter((a) => docIssues(a).length).length;
      return html`<div className="col">
        <${Locked} title="Documents are restricted to Operations and medical staff">${AMS.roleLabel(role)} sees verification status only. Identity papers, consent forms and certificates are handled by Operations; medical documents by physios and doctors (product doc §5).<//>
        <div className="grid g3"><${UI.KPI} label="Athletes fully verified" value=${all.length - iss} foot=${'of ' + all.length} icon="shield-check" tone="good" /><${UI.KPI} label="With document issues" value=${iss} foot="handled by Operations" icon="file" tone=${iss ? 'warn' : 'good'} /><${UI.KPI} label="Your access" value="Status only" foot=${AMS.access('documents')} icon="lock" /></div>
      </div>`;
    }
    const need = rows.filter((r) => ['Expired', 'Expiring', 'Flagged', 'Pending', 'Returned'].includes(r.st));
    const exp = rows.filter((r) => ['Expired', 'Expiring'].includes(r.st));
    const fit14 = rows.filter((r) => /fitness/i.test(r.d.type) && r.d.expires && D.diff(r.d.expires, T) <= 14 && !r.d.renewalRequested);
    const list = mode === 'action' ? need : mode === 'expiring' ? exp : mode === 'flagged' ? rows.filter((r) => r.st === 'Flagged' || r.st === 'Returned') : rows;
    return html`<div className="col loose">
      ${P.docsMed() && html`<${Locked} title="Medical documents only">As ${AMS.roleLabel(role)} you see fitness certificates and lab reports for ${AMS.scopeLabel()}. Identity and consent documents stay with Operations.<//>`}
      <div className="grid g4">
        <${UI.KPI} label="Need action" value=${need.length} foot=${plural(rows.length, 'document') + ' in scope'} icon="file" tone=${need.length ? 'warn' : 'good'} onClick=${() => setMode('action')} />
        <${UI.KPI} label="Expiring ≤ 30 days" value=${exp.filter((r) => r.st === 'Expiring').length} foot=${exp.filter((r) => r.st === 'Expired').length + ' already expired'} icon="clock" tone="warn" onClick=${() => setMode('expiring')} />
        <${UI.KPI} label="Flagged / returned" value=${rows.filter((r) => r.st === 'Flagged' || r.st === 'Returned').length} foot="AI or reviewer flagged" icon="flag" tone="bad" onClick=${() => setMode('flagged')} />
        <${UI.KPI} label="Renewals requested" value=${rows.filter((r) => r.d.renewalRequested).length} foot="awaiting new upload" icon="refresh" onClick=${() => setMode('expiring')} />
      </div>
      ${fit14.length > 0 && html`<${Banner} tone="ai" icon="sparkles" actions=${canActDoc(fit14[0].d) || P.docsAll() ? html`<button className="btn sm ai" onClick=${() => AMS.runAction('athlete.requestRenewal', { items: fit14.map((r) => ({ athleteId: r.a.id, docId: r.d.id })) })}><${I} name="zap" size=${13} />Request ${fit14.length} renewals</button>` : null}>
        <b>${plural(fit14.length, 'medical fitness certificate')} expire within 14 days</b> — ${fit14.slice(0, 4).map((r) => r.a.name + ' (' + D.fmt(r.d.expires) + ')').join(', ')}${fit14.length > 4 ? '…' : ''}. An expired certificate blocks competition entry; State Open Meet entries close 24 Oct.
      <//>`}
      <div className="row between wrap"><${UI.Seg} options=${[{ id: 'action', label: 'Needs action' }, { id: 'expiring', label: 'Expiring' }, { id: 'flagged', label: 'Flagged' }, { id: 'all', label: 'All' }]} value=${mode} onChange=${setMode} /><span className="small muted">${plural(list.length, 'document')}</span></div>
      <${UI.Card} flush=${true}>
        <${UI.Table} rows=${list} compact=${true} maxHeight=${600} empty="Nothing needs action" initialSort=${{ key: 'exp', dir: 'asc' }} onRow=${(r) => AMS.openAthlete(r.a.id, 'documents')} columns=${[
          { key: 'a', label: 'Athlete', sort: (r) => r.a.name, render: (r) => html`<${UI.AthleteCell} athlete=${r.a} size=${26} />` },
          { key: 'type', label: 'Document', sort: (r) => r.d.type, render: (r) => html`<span className="small" style=${{ fontWeight: 600 }}>${r.d.type}</span>` },
          { key: 'st', label: 'Status', sort: (r) => r.st, render: (r) => html`<span className="col tight" style=${{ gap: 1 }}><${DocStatusPill} d=${r.d} />${r.d.renewalRequested && html`<span className="tiny faint">renewal asked ${D.rel(r.d.renewalRequested)}</span>`}</span>` },
          { key: 'exp', label: 'Expires', sort: (r) => r.d.expires || '9999', render: (r) => (r.d.expires ? html`<span className="col tight" style=${{ gap: 0 }}><span className="small tnum">${D.fmt(r.d.expires)}</span><span className=${'tiny ' + (D.diff(r.d.expires, T) <= 14 ? 'bad' : 'faint')}>${D.rel(r.d.expires)}</span></span>` : html`<span className="faint">—</span>`) },
          { key: 'ai', label: 'AI check', hideSm: true, sort: false, render: (r) => html`<${AiResult} ai=${r.d.ai} />` },
          { key: 'act', label: '', sort: false, render: (r) => (canActDoc(r.d) ? html`<span className="row tight" style=${{ justifyContent: 'flex-end' }} onClick=${(e) => e.stopPropagation()}>
            ${['Expiring', 'Expired'].includes(r.st) && !r.d.renewalRequested && html`<button className="btn xs" onClick=${() => AMS.runAction('athlete.requestRenewal', { items: [{ athleteId: r.a.id, docId: r.d.id }] })}><${I} name="refresh" size=${12} />Renewal</button>`}
            ${['Pending', 'Flagged', 'Returned'].includes(r.st) && html`<button className="btn xs" onClick=${() => AMS.runAction('athlete.docStatus', { athleteId: r.a.id, docId: r.d.id, status: 'Verified' })}><${I} name="check" size=${12} />Verify</button>`}
            ${r.st === 'Pending' && html`<button className="btn xs ghost" onClick=${() => AMS.runAction('athlete.requestReupload', { athleteId: r.a.id, docId: r.d.id, reason: 'Please upload a clearer copy' })}>Re-upload</button>`}
          </span>` : html`<span className="tiny faint">view only</span>`) },
        ]} />
      <//>
    </div>`;
  }

  /* ================================================================== PAGE */
  function Page({ params }) {
    const { db, ui, v } = AMS.useStore();
    params = params || {};
    const [tab, setTab] = useState(params.tab || 'registry');
    useEffect(() => { if (params.tab) setTab(params.tab); }, [params.tab, params.view]);
    const role = ui.role;
    const counts = useMemo(() => {
      const all = AMS.scopedAthletes({ all: true });
      const act = all.filter((a) => a.enrollment === 'Active');
      const apps = db.applications.filter(appInScope);
      return {
        athletes: all.length,
        openApps: apps.filter((p) => OPEN_STAGES.includes(p.stage)).length,
        noCoach: act.filter((a) => !a.coachId).length + apps.filter((p) => p.stage === 'Approved' && !p.coachId && !p.athleteId).length,
        incomplete: act.filter((a) => a.missingFields.length).length,
        docIssues: (P.docsAll() || P.docsMed()) ? AMS.sum(all.map((a) => liveDocs(a).filter((d) => canSeeDoc(d, a) && ['Expired', 'Expiring', 'Flagged', 'Pending', 'Returned'].includes(docStatus(d))).length)) : null,
        over: apps.filter((p) => OPEN_STAGES.includes(p.stage) && D.diff(T, p.submitted) > SLA_DAYS).length,
      };
    }, [v, role, JSON.stringify(ui.scope)]);
    const tabs = [
      { id: 'registry', label: 'Registry', icon: 'users', count: counts.athletes },
      { id: 'onboarding', label: 'Onboarding & verification', icon: 'shield-check', count: counts.openApps },
      { id: 'assignment', label: 'Coach assignment', icon: 'whistle', count: counts.noCoach || null },
      { id: 'completion', label: 'Profile completion', icon: 'clipboard', count: counts.incomplete },
      { id: 'documents', label: 'Documents', icon: 'file', count: counts.docIssues },
    ];
    const goTab = (t) => setTab(t);
    const sub = role === 'ops'
      ? 'One verified record per athlete · ' + counts.openApps + ' applications open (' + counts.over + ' over SLA) · ' + (counts.noCoach || 0) + ' waiting for a coach'
      : role === 'coach' ? 'Your squads — tag, request missing items and open any athlete profile'
        : role === 'director' ? 'Federation registry across ' + db.org.centres.length + ' centres — read-only drill-down'
          : 'Athlete registry for ' + AMS.scopeLabel() + (P.docsMed() ? ' · medical documents' : '');
    const actions = html`
      ${P.edit() && html`<button className="btn primary" onClick=${() => AMS.openModal('enroll')}><${I} name="plus" size=${15} />Enrol athlete</button>`}
      <${UI.AskCopilot} prompt=${role === 'ops' ? 'Which applications need my attention today?' : 'Who in my athletes needs attention today?'} label="Ask Copilot" />`;
    return html`<div className="page">
      <${UI.PageHead} title="Athletes" sub=${sub} actions=${actions} />
      <${UI.Tabs} tabs=${tabs} value=${tab} onChange=${setTab} style=${{ marginBottom: 16 }} />
      ${tab === 'registry' && html`<${RegistryTab} params=${params} goTab=${goTab} />`}
      ${tab === 'onboarding' && html`<${OnboardingTab} />`}
      ${tab === 'assignment' && html`<${AssignmentTab} />`}
      ${tab === 'completion' && html`<${CompletionTab} />`}
      ${tab === 'documents' && html`<${DocumentsPage} />`}
    </div>`;
  }

  AMS.registerModule({
    id: 'athletes', label: 'Athletes', icon: 'users', group: 'people', order: 2,
    roles: ['director', 'coach', 'physio', 'doctor', 'scientist', 'nutritionist', 'ops'],
    component: Page, short: 'Athletes',
    badge: () => {
      if (!['ops', 'director'].includes(AMS.ui.role) || !AMS.db) return null;
      const open = AMS.db.applications.filter((p) => OPEN_STAGES.includes(p.stage) && appInScope(p));
      const over = open.filter((p) => D.diff(T, p.submitted) > SLA_DAYS).length;
      return open.length ? { n: open.length, tone: over ? 'bad' : 'info' } : null;
    },
    sampleParams: [{}, { tab: 'registry', view: 'red' }, { tab: 'registry', view: 'u18' }, { tab: 'onboarding' }, { tab: 'assignment' }, { tab: 'completion' }, { tab: 'documents' }],
  });

  /* ================================================================== commands */
  AMS.registerCommand({ id: 'athletes.enroll', label: 'Enrol a new athlete', group: 'Athletes', icon: 'plus', keywords: 'onboard enrol enroll register new application', roles: ['ops'], run: () => AMS.openModal('enroll') });
  AMS.registerCommand({ id: 'athletes.queue', label: 'Open verification queue', group: 'Athletes', icon: 'shield-check', keywords: 'applications verify approve onboarding sla', roles: ['ops', 'director'], run: () => AMS.go('athletes', { tab: 'onboarding' }) });
  AMS.registerCommand({ id: 'athletes.assign', label: 'Assign coaches to new athletes', group: 'Athletes', icon: 'whistle', keywords: 'coach assignment squad capacity', roles: ['ops', 'director'], run: () => AMS.go('athletes', { tab: 'assignment' }) });
  AMS.registerCommand({ id: 'athletes.completion', label: 'Profile completion — send reminders', group: 'Athletes', icon: 'clipboard', keywords: 'missing profile reminder documents', roles: ['ops', 'coach', 'director'], run: () => AMS.go('athletes', { tab: 'completion' }) });
  AMS.registerCommand({ id: 'athletes.docs', label: 'Expiring documents & renewals', group: 'Athletes', icon: 'file', keywords: 'fitness certificate expiry renewal documents', roles: ['ops', 'physio', 'doctor'], run: () => AMS.go('athletes', { tab: 'documents' }) });
  AMS.registerCommand({ id: 'athletes.red', label: 'Athletes in the red today', group: 'Athletes', icon: 'alert', keywords: 'readiness red risk today', roles: ['director', 'coach', 'physio', 'doctor', 'scientist', 'nutritionist'], run: () => AMS.go('athletes', { tab: 'registry', view: 'red' }) });
  AMS.registerCommand({ id: 'athletes.consent', label: 'Under-18 athletes without consent', group: 'Athletes', icon: 'shield', keywords: 'guardian consent minor dpdp', roles: ['ops', 'director', 'physio', 'doctor'], run: () => AMS.go('athletes', { tab: 'registry', view: 'u18' }) });

  /* Expose pure helpers for other modules / copilot. */
  AMS.athletes = { aiCheckDoc, aiPrecheck, approvalBlockers, recommendCoaches, eligibility, athleteBrief, docStatus, findDuplicate };

  /* ================================================================== self-tests (workflows change state) */
  const assert = (c, m) => { if (!c) throw new Error(m); };
  AMS.selfTests.push({ name: 'verify last doc + approve creates an Active athlete linked to the application', role: 'ops', fn: () => {
    const app = AMS.byId(AMS.db.applications, 'APP-808');
    const before = AMS.db.athletes.length;
    assert(approvalBlockers(app).length > 0, 'expected a blocker before verification');
    AMS.runAction('application.approve', { appId: app.id });
    assert(AMS.db.athletes.length === before, 'approve must be blocked while a document is pending');
    app.docs.filter((d) => d.status !== 'Verified').forEach((d) => AMS.runAction('application.verifyDoc', { appId: app.id, docId: d.id, status: 'Verified' }));
    AMS.runAction('application.approve', { appId: app.id });
    assert(AMS.db.athletes.length === before + 1, 'athlete not created');
    const a = AMS.org.athlete(app.athleteId);
    assert(a && a.enrollment === 'Active' && a.availability === 'Available', 'new athlete must be Active + Available');
    assert(a.wellness.length === 28 && a.loads.length === 42 && a.docs.length >= 3, 'series/docs not initialised');
    assert(app.stage === 'Approved' && AMS.db.tasks.some((t) => t.ref === app.id && t.status === 'Open' && /Assign coach/.test(t.title)), 'stage/task wrong');
  } });
  AMS.selfTests.push({ name: 'return to applicant loops back and re-upload returns to Verifying', role: 'ops', fn: () => {
    const app = AMS.byId(AMS.db.applications, 'APP-801');
    AMS.runAction('application.returnDocs', { appId: app.id, reason: 'Birth certificate DOB mismatch' });
    assert(app.stage === 'Docs returned' && app.returnReason === 'Birth certificate DOB mismatch', 'not returned');
    assert(app.docs.some((d) => d.status === 'Returned'), 'flagged doc not marked Returned');
    AMS.runAction('application.resubmit', { appId: app.id });
    assert(app.stage === 'Verifying' && !app.docs.some((d) => d.status === 'Returned'), 'resubmit did not loop back');
  } });
  AMS.selfTests.push({ name: 'duplicate application merges into the existing record without a new athlete', role: 'ops', fn: () => {
    const app = AMS.db.applications.find((p) => p.duplicateOf);
    const before = AMS.db.athletes.length;
    const ins = AMS.ai.insights({ module: 'athletes' });
    assert(ins.some((i) => i.id === 'dup:' + app.id), 'duplicate detector did not fire');
    AMS.runAction('application.merge', { appId: app.id });
    assert(app.stage === 'Merged' && app.mergedInto === app.duplicateOf.athleteId, 'not merged');
    assert(AMS.db.athletes.length === before, 'merge must not create an athlete');
  } });
  AMS.selfTests.push({ name: 'assigning a coach to approved Sakshi creates her record, closes the task and notifies the coach', role: 'ops', fn: () => {
    const app = AMS.db.applications.find((p) => p.name === 'Sakshi Malik');
    assert(AMS.ai.insights({ module: 'athletes' }).some((i) => i.id === 'nocoach:' + app.id), 'unassigned-coach detector did not fire');
    const top = recommendCoaches(subjectFrom({ appId: app.id })).find((o) => !o.blocked);
    assert(top && top.squadId === 'SQ-SNP-WR20', 'expected Sonipat U-20 Freestyle as best fit, got ' + (top && top.squadId));
    const nBefore = AMS.db.notifications.length;
    AMS.runAction('athlete.assignCoach', { appId: app.id, squadId: top.squadId, coachId: top.coachId });
    const a = AMS.org.athlete(app.athleteId);
    assert(a && a.coachId === top.coachId && app.coachId === top.coachId, 'coach not set');
    assert(AMS.byId(AMS.db.tasks, 'TSK-1').status === 'Done', 'TSK-1 not closed');
    assert(AMS.db.notifications.length > nBefore && AMS.db.notifications[0].toRole === 'coach', 'coach not notified');
  } });
  AMS.selfTests.push({ name: 'profile completion: request creates a task, marking received reaches 100%', role: 'ops', fn: () => {
    const a = AMS.org.athlete(AMS.db.meta.heroAthleteId);
    AMS.db.tasks.find((t) => t.id === 'TSK-6').status = 'Done';
    AMS.runAction('athlete.requestMissing', { athleteId: a.id });
    assert(AMS.db.tasks.some((t) => t.ref === reqRef(a.id, 'Blood test report') && t.status === 'Open'), 'request task not created');
    assert(AMS.db.notifications.some((n) => n.toRole === 'athlete' && n.athleteId === a.id), 'athlete not notified');
    AMS.runAction('athlete.markReceived', { athleteId: a.id, field: 'Blood test report' });
    assert(a.profileCompletion === 100 && a.missingFields.length === 0, 'completion not updated: ' + a.profileCompletion);
    assert(!AMS.db.tasks.some((t) => t.ref === reqRef(a.id, 'Blood test report') && t.status === 'Open'), 'task not closed');
  } });
  AMS.selfTests.push({ name: 'enrol wizard path: under-18 with pending e-consent is blocked from approval; tags add/remove', role: 'ops', fn: () => {
    const p = createApplication({ name: 'Ishaan Kulkarni', gender: 'M', dob: '2011-05-09', sport: 'Athletics', centreId: 'PUN', squadId: 'SQ-PUN-SPR17', events: '100m', consentMode: 'link', consent: false, guardian: { name: 'Meena Kulkarni', relation: 'Mother' }, docs: REQUIRED_DOCS.map((t) => ({ type: t, ai: aiCheckDoc(t, 'clear', { name: 'Ishaan Kulkarni' }) })).concat([{ type: 'Guardian consent', ai: null }]) });
    assert(p && p.stage === 'Applied' && AMS.db.applications[0].id === p.id, 'application not created');
    assert(approvalBlockers(p).some((b) => /consent/i.test(b)), 'consent must block approval');
    const h = AMS.db.meta.heroAthleteId;
    AMS.runAction('athlete.addTag', { athleteId: h, tag: 'Selection watch' });
    assert(AMS.org.athlete(h).tags.includes('Selection watch'), 'tag not added');
    AMS.runAction('athlete.removeTag', { athleteId: h, tag: 'Selection watch' });
    assert(!AMS.org.athlete(h).tags.includes('Selection watch'), 'tag not removed');
  } });
  AMS.selfTests.push({ name: 'expiring fitness certificates raise one insight; renewal requests clear it', role: 'ops', fn: () => {
    const a = AMS.scopedAthletes()[3];
    const d = a.docs.find((x) => /fitness/i.test(x.type));
    d.expires = D.add(T, 6); d.renewalRequested = null;
    const ins = AMS.ai.insights({ module: 'athletes' }).find((i) => /^docexp:/.test(i.id));
    assert(ins && ins.athleteIds.includes(a.id), 'expiry detector did not include athlete');
    AMS.ai.act(ins, ins.actions[0]);
    assert(d.renewalRequested === T, 'renewal not requested');
    assert(!AMS.ai.insights({ module: 'athletes' }).some((i) => /^docexp:/.test(i.id) && i.athleteIds.includes(a.id)), 'insight should clear');
  } });
})();
