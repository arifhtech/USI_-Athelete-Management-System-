/* USI · AMS — AI Copilot + AI Operations.
   AMS.copilot.respond(text, ctx) is a pure, synchronous intent engine over the shared record (scope + RBAC aware, pronouns resolved from
   the screen the user is on). The side panel renders its answers as rich blocks with one-tap actions; anything that changes state needs an
   explicit Confirm. The AI Operations page shows every AI flag, the automation rules and an audit of AI-triggered actions. */
(function () {
  'use strict';
  const AMS = window.AMS, UI = window.UI, React = window.React, html = AMS.html;
  const { useState, useEffect, useRef } = React;
  const D = AMS.date, C = AMS.calc;
  const MOD = 'copilot';

  /* ================================================================== helpers */
  const first = (a) => a.name.split(' ')[0];
  const band = (a) => C.readiness(a);
  const scoped = () => AMS.scopedAthletes();
  const MODULE_WORDS = [['medical', /medical|injur|physio|rehab board/], ['training', /training|session|periodi|workload/], ['athletes', /athlete(s)? (list|registry)|onboarding|verification|registry/], ['science', /science|readiness board|gps|wearable/], ['nutrition', /nutrition|diet|hydration|supplement/], ['assessments', /assessment|testing|talent|tid/], ['analytics', /analytics|report|bi\b/], ['athlete-app', /athlete app|phone|mobile/], ['dashboard', /dashboard|command cent(er|re)|home/], ['copilot', /ai (ops|operations|inbox)/]];
  function findAthletes(text, ctx) {
    const t = ' ' + text.toLowerCase().replace(/[^a-z\s]/g, ' ') + ' ';
    const pool = scoped();
    const all = AMS.db.athletes;
    const full = all.filter((a) => t.includes(' ' + a.name.toLowerCase() + ' '));
    if (full.length) return full;
    const hit = (list) => list.filter((a) => t.includes(' ' + first(a).toLowerCase() + ' '));
    const s = hit(pool);
    if (s.length) { const hero = s.find((a) => a.id === AMS.db.meta.heroAthleteId); return [hero || s[0]]; }
    if (/\b(she|her|he|him|his|this athlete|they|them)\b/.test(t) && ctx && ctx.focus && ctx.focus.athleteId) { const a = AMS.org.athlete(ctx.focus.athleteId); return a ? [a] : []; }
    return [];
  }
  function findCentre(text) { const t = text.toLowerCase(); return AMS.db.org.centres.find((c) => t.includes(c.short.toLowerCase().split(' ')[0].toLowerCase()) || t.includes(c.id.toLowerCase() + ' ')); }
  const ev = (label, value, tone) => ({ label, value: String(value), tone });
  const reply = (text, extra) => Object.assign({ text, blocks: [], actions: [], suggestions: [] }, extra || {});
  function injuryText(i) { return AMS.medicalLabel(i) + (AMS.medicalFull() ? ' · ' + i.status : ''); }

  /* ================================================================== intent engine (pure) */
  const INTENTS = [];
  const intent = (id, test, fn) => INTENTS.push({ id, test, fn });

  intent('help', /^(help|what can you do|\?)|what can you/, () => reply('I work across every module. Ask me things like:', { suggestions: ['Who is at risk today?', 'Why is Priya red?', 'Move red athletes to recovery', 'Show open injuries', 'Check-in compliance', 'Compare centres', 'Summarise the week', 'Explain ACWR'] }));
  intent('explain', /\b(what is|what's|explain|meaning of)\b.*\b(acwr|readiness|srpe|rpe|monotony|strain)\b/, (q) => {
    const k = (q.match(/acwr|readiness|srpe|rpe|monotony|strain/) || [])[0];
    const txt = { acwr: '**ACWR** (acute:chronic workload ratio) is this week\'s training load divided by the average of the last 4 weeks. 0.8–1.3 is the sweet spot; **1.5 or more is a load jump** that roughly doubles soft-tissue injury risk in the following week.', readiness: '**Readiness** (0–100) comes from the 5-question morning check-in, compared with the athlete\'s **own 3-week normal**, then lowered for load jumps or modified availability. Green ≥ 70, amber 50–69, red under 50.', srpe: '**sRPE load** = session RPE (1–10, how hard it felt) × minutes. A 90-minute session at RPE 7 = **630 AU**. It is the input to ACWR.', rpe: '**RPE** is the athlete\'s 1–10 rating of how hard the whole session felt (Borg CR-10). Multiplied by minutes it gives **sRPE load**.', monotony: '**Monotony** = average daily load ÷ its standard deviation over the week. Above **2.0** means every day feels the same, which raises illness and injury risk.', strain: '**Strain** = weekly load × monotony. High strain with high monotony is the classic overtraining pattern.' }[k === 'srpe' ? 'srpe' : k];
    return reply(txt);
  });
  intent('navigate', /^(open|go to|show me the|take me to)\b/, (q) => {
    const m = MODULE_WORDS.find(([, re]) => re.test(q));
    if (!m) return null;
    const mod = AMS.modules.find((x) => x.id === m[0]);
    return reply('Opening **' + (mod ? mod.label : m[0]) + '**.', { actions: [{ label: 'Open ' + (mod ? mod.label : m[0]), action: 'go', payload: { module: m[0] } }], autorun: { action: 'go', payload: { module: m[0] } } });
  });
  intent('recovery', /(move|switch|put).*(red|at.risk|risk).*(recovery|lighter|rest)|recovery session for (all|the) red/, () => {
    const red = scoped().filter((a) => band(a).band === 'bad' && a.availability !== 'Unavailable').filter((a) => { const s = AMS.todaySessionFor(a); return s && !(s.mods && s.mods[a.id]); });
    if (!red.length) return reply('Every red athlete in **' + AMS.scopeLabel() + '** already has an adjusted session (or has none today).');
    return reply('**' + red.length + ' red athletes** still have the full session today. Move them to the recovery version?', { blocks: [{ type: 'athletes', ids: red.map((a) => a.id) }], actions: [{ label: 'Move ' + red.length + ' to recovery', action: 'copilot.recoverMany', payload: { athleteIds: red.map((a) => a.id) }, confirm: true }] });
  });
  intent('risk', /(who|which).*(risk|red|not ready|struggling)|at risk|red today|injury risk/, () => {
    const list = scoped().map((a) => ({ a, r: band(a), k: C.risk(a) })).filter((x) => x.r.band === 'bad' || x.k.band === 'bad').sort((x, y) => y.k.score - x.k.score).slice(0, 6);
    if (!list.length) return reply('Nobody in **' + AMS.scopeLabel() + '** is red or high-risk this morning.');
    return reply('**' + list.length + ' athletes** need attention in ' + AMS.scopeLabel() + ' today:', { blocks: [{ type: 'table', head: ['Athlete', 'Readiness', 'Risk', 'Why'], rows: list.map((x) => [{ athleteId: x.a.id }, x.r.score + ' ' + C.bandLabel(x.r.band), x.k.score, (x.k.factors[0] || x.r.factors[0] || {}).label + ' ' + ((x.k.factors[0] || x.r.factors[0] || {}).value || '')]) }], actions: [{ label: 'Move red athletes to recovery', action: 'copilot.recoverMany', payload: { athleteIds: list.filter((x) => x.r.band === 'bad').map((x) => x.a.id) }, confirm: true }], suggestions: list[0] ? ['Why is ' + first(list[0].a) + ' red?'] : [] });
  });
  intent('why', /\bwhy\b/, (q, ctx) => {
    const a = findAthletes(q, ctx)[0];
    if (!a) return reply('Who do you mean? Open an athlete or name them, e.g. "why is Priya red?".');
    const r = band(a), w = C.todayWellness(a), acwr = C.acwr(a), base = Math.round(C.wellnessBaseline(a));
    const lines = ['**' + a.name + '** is **' + C.bandLabel(r.band).toLowerCase() + ' (' + r.score + ')** today.'];
    if (w) lines.push('Check-in at ' + w.at + ': sleep ' + w.sleep + '/5 (' + w.sleepHrs + ' h), soreness ' + w.soreness + '/5, mood ' + w.mood + '/5. Their own 3-week normal is **' + base + '**.' + (w.note ? ' Note: "' + w.note + '".' : ''));
    else lines.push('No check-in yet today, so this uses the 3-day average.');
    if (acwr >= 1.3) lines.push('Training load this week is **' + Math.round((acwr - 1) * 100) + '% above** the 4-week normal (ACWR ' + acwr.toFixed(2) + ').');
    const s = AMS.todaySessionFor(a);
    return reply(lines.join(' '), { blocks: [{ type: 'evidence', items: r.factors.map((f) => ev(f.label, f.value, f.tone)).concat([ev('ACWR', acwr.toFixed(2), C.acwrBand(acwr))]) }], actions: s && !(s.mods && s.mods[a.id]) ? [{ label: 'Switch ' + first(a) + ' to recovery', action: 'session.modifyForAthlete', payload: { athleteId: a.id, sessionId: s.id, variant: 'recovery' }, confirm: true }] : [] });
  });
  intent('status', /how is|how's|status of|summari[sz]e|doing|tell me about/, (q, ctx) => {
    const a = findAthletes(q, ctx)[0];
    if (!a) return null;
    const r = band(a), k = C.risk(a), s = AMS.todaySessionFor(a), inj = AMS.db.injuries.filter((i) => i.athleteId === a.id && i.status !== 'Closed');
    const mod = s && s.mods && s.mods[a.id];
    const txt = '**' + a.name + '** (' + (AMS.org.squad(a.squadId) || {}).name + ', ' + AMS.org.centre(a.centreId).short + '): readiness **' + r.score + ' ' + C.bandLabel(r.band) + '**, injury risk ' + k.score + '/100, ACWR ' + C.acwr(a).toFixed(2) + ', ' + a.availability.toLowerCase() + '. ' + (s ? 'Today: ' + (mod ? mod.variant + ' version of ' : '') + s.title + ' at ' + s.start + '. ' : '') + (AMS.access('medical') === 'none' ? '' : inj.length ? 'Medical: ' + inj.map(injuryText).join('; ') + '.' : 'No open medical issues.') + (AMS.access('medical') === 'summary' && inj.length ? ' (Diagnoses are visible to medical staff only.)' : '');
    return reply(txt, { blocks: [{ type: 'athletes', ids: [a.id] }, { type: 'evidence', items: r.factors.slice(0, 4).map((f) => ev(f.label, f.value, f.tone)) }], actions: [{ label: 'Open profile', action: 'open.athlete', payload: { athleteId: a.id } }], suggestions: ['Why is ' + first(a) + ' red?', 'Draft a message to ' + first(a) + '\'s coach'] });
  });
  intent('injuries', /injur|rehab|return.to.play|medical cases|who is (out|injured)/, (q) => {
    if (AMS.access('medical') === 'none') return reply('Operations has no access to medical information under the USI role policy, so I can\'t list injuries for you.');
    const c = findCentre(q);
    const ids = new Set(scoped().filter((a) => !c || a.centreId === c.id).map((a) => a.id));
    const open = AMS.db.injuries.filter((i) => ids.has(i.athleteId) && i.status !== 'Closed');
    const rehab = /rehab|return/.test(q);
    const list = rehab ? open.filter((i) => ['Rehab', 'Clearance'].includes(i.status)) : open;
    if (!list.length) return reply('No ' + (rehab ? 'rehab cases' : 'open injuries') + ' in ' + (c ? c.short : AMS.scopeLabel()) + '.');
    return reply('**' + list.length + (rehab ? ' athletes in rehab' : ' open injuries') + '** in ' + (c ? c.short : AMS.scopeLabel()) + (AMS.medicalFull() ? '' : '. You see availability labels only; diagnoses stay with medical staff') + '.', { blocks: [{ type: 'table', head: ['Athlete', 'Status', 'Stage', 'Back'], rows: list.slice(0, 8).map((i) => [{ athleteId: i.athleteId }, injuryText(i), i.status === 'Rehab' ? (i.rtpStage + 1) + '/6 ' + ((i.rtpStages || [])[i.rtpStage] || {}).name : i.status, i.expectedReturn ? D.fmt(i.expectedReturn) : '—']) }], actions: [{ label: 'Open Medical', action: 'go', payload: { module: 'medical' } }] });
  });
  intent('checkin', /check.?in|compliance|who hasn.?t|reminder/, () => {
    const list = scoped(), miss = list.filter((a) => !C.todayWellness(a) && a.availability !== 'Unavailable');
    return reply('Check-in rate is **' + C.checkinRate(list) + '%** in ' + AMS.scopeLabel() + '; **' + miss.length + '** athletes haven\'t checked in yet.', { blocks: miss.length ? [{ type: 'athletes', ids: miss.slice(0, 10).map((a) => a.id) }] : [], actions: miss.length ? [{ label: 'Send reminder to ' + miss.length, action: 'checkin.remind', payload: { athleteIds: miss.map((a) => a.id) }, confirm: true }] : [] });
  });
  intent('compare', /compare|centres|centers|which centre|ranking/, () => {
    const by = AMS.groupBy(scoped(), 'centreId');
    const rows = Object.entries(by).map(([cid, l]) => ({ c: AMS.org.centre(cid).short, n: l.length, rd: Math.round(AMS.mean(l.map((a) => band(a).score))), ci: C.checkinRate(l), inj: AMS.db.injuries.filter((i) => i.status !== 'Closed' && l.some((a) => a.id === i.athleteId)).length })).sort((x, y) => x.rd - y.rd);
    const med = AMS.access('medical') !== 'none';
    return reply('Centres in ' + AMS.scopeLabel() + ', lowest readiness first. **' + rows[0].c + '** needs the most attention.', { blocks: [{ type: 'table', head: ['Centre', 'Athletes', 'Readiness', 'Check-in'].concat(med ? ['Open injuries'] : []), rows: rows.map((r) => [r.c, r.n, r.rd, r.ci + '%'].concat(med ? [r.inj] : [])) }], actions: [{ label: 'Open Analytics', action: 'go', payload: { module: 'analytics' } }] });
  });
  intent('summary', /summar|brief|this week|weekly|overview|what changed/, () => {
    const list = scoped(), ins = AMS.ai.insights();
    const red = list.filter((a) => band(a).band === 'bad').length, jumps = list.filter((a) => C.acwr(a) >= 1.5).length;
    const med = AMS.access('medical') !== 'none' ? AMS.db.injuries.filter((i) => i.status !== 'Closed' && list.some((a) => a.id === i.athleteId)).length : null;
    return reply('**Brief for ' + AMS.scopeLabel() + ', ' + D.fmtLong(AMS.TODAY) + ':** ' + list.length + ' active athletes, check-in **' + C.checkinRate(list) + '%**, **' + red + ' red**, **' + jumps + ' load jumps** (ACWR ≥ 1.5)' + (med != null ? ', **' + med + ' open injuries**' : '') + '. ' + ins.length + ' AI flags open; top: ' + (ins[0] ? ins[0].title : 'none') + '. AI warnings acted on: ' + AMS.ai.actedRate() + '%.', { blocks: [{ type: 'insights', items: ins.slice(0, 3) }] });
  });
  intent('docs', /document|verif|pending|application|onboard/, () => {
    if (AMS.access('documents') === 'none' && AMS.access('athletes') !== 'edit') return reply('Documents are handled by Operations and medical staff; your role can\'t see them.');
    const apps = AMS.db.applications.filter((p) => ['Applied', 'Verifying', 'Docs returned'].includes(p.stage));
    const flagged = apps.filter((p) => p.docs.some((d) => d.status === 'Flagged'));
    return reply('**' + apps.length + ' applications** are in verification; **' + flagged.length + '** have a document flagged by the AI pre-check.', { blocks: [{ type: 'table', head: ['Applicant', 'Stage', 'Submitted', 'AI flags'], rows: apps.slice(0, 8).map((p) => [p.name, p.stage, D.rel(p.submitted), p.docs.filter((d) => d.status === 'Flagged').map((d) => d.type).join(', ') || '—']) }], actions: [{ label: 'Open verification queue', action: 'go', payload: { module: 'athletes', params: { tab: 'onboarding' } } }] });
  });
  intent('coach', /coach assign|without a coach|no coach|assign (a )?coach/, () => {
    const apps = AMS.db.applications.filter((p) => p.stage === 'Approved' && !p.coachId);
    return reply(apps.length ? '**' + apps.map((p) => p.name).join(', ') + '** ' + (apps.length > 1 ? 'are' : 'is') + ' approved but still without a coach.' : 'Every approved athlete has a coach.', { actions: apps.length ? [{ label: 'Open onboarding', action: 'go', payload: { module: 'athletes', params: { tab: 'onboarding' } } }] : [] });
  });
  intent('plan', /plan|suggest.*session|what should .* train/, () => {
    const list = scoped(), red = list.filter((a) => band(a).band === 'bad'), amber = list.filter((a) => band(a).band === 'warn');
    return reply('Suggested split for today in ' + AMS.scopeLabel() + ': **' + (list.length - red.length - amber.length) + ' green** on the planned session, **' + amber.length + ' amber** at reduced volume (−40%), **' + red.length + ' red** on recovery (pool, mobility, easy bike). Keep max-velocity work for the green group only.', { actions: red.length ? [{ label: 'Move ' + red.length + ' red to recovery', action: 'copilot.recoverMany', payload: { athleteIds: red.map((a) => a.id) }, confirm: true }] : [] });
  });
  intent('nutrition', /nutrition|weight.?cut|making weight|hydrat|diet|supplement/, () => {
    const ins = AMS.ai.insights({ module: 'nutrition' });
    if (AMS.access('nutrition') === 'none') return reply('Nutrition data isn\'t visible to your role.');
    return reply(ins.length ? '**' + ins.length + ' nutrition flags** in ' + AMS.scopeLabel() + '.' : 'No nutrition flags in ' + AMS.scopeLabel() + '.', { blocks: [{ type: 'insights', items: ins.slice(0, 3) }], actions: [{ label: 'Open Nutrition', action: 'go', payload: { module: 'nutrition' } }] });
  });
  intent('talent', /talent|prospect|fastest|best (sprinter|athlete)/, () => {
    const best = scoped().map((a) => ({ a, t: AMS.db.tests.filter((x) => x.athleteId === a.id && x.results.sprint30).sort((x, y) => y.date.localeCompare(x.date))[0] })).filter((x) => x.t).sort((x, y) => x.t.results.sprint30 - y.t.results.sprint30).slice(0, 5);
    return reply('Fastest 30 m in ' + AMS.scopeLabel() + ' (latest field test):', { blocks: [{ type: 'table', head: ['Athlete', '30 m', 'Age', 'Tested'], rows: best.map((x) => [{ athleteId: x.a.id }, x.t.results.sprint30 + ' s', D.ageOn(x.a.dob), D.fmt(x.t.date)]) }], actions: [{ label: 'Open Assessments & TID', action: 'go', payload: { module: 'assessments' } }] });
  });
  intent('task', /remind|create (a )?task|follow up|draft a message|message to/, (q, ctx) => {
    const a = findAthletes(q, ctx)[0];
    const toRole = /physio/.test(q) ? 'physio' : /doctor/.test(q) ? 'doctor' : /nutrition/.test(q) ? 'nutritionist' : 'coach';
    const text = a ? a.name + ': readiness ' + band(a).score + ' (' + C.bandLabel(band(a).band) + '), ACWR ' + C.acwr(a).toFixed(2) + '. Please check in before today\'s session.' : 'Follow-up from the Copilot.';
    return reply('Draft to the **' + AMS.roleLabel(toRole).toLowerCase() + '**: "' + text + '"', { actions: [{ label: 'Send to ' + AMS.roleLabel(toRole).toLowerCase(), action: 'notify', payload: { toRole, athleteId: a && a.id, text }, confirm: true }, { label: 'Create task instead', action: 'task.create', payload: { title: text.slice(0, 80), ownerRole: toRole, module: 'dashboard', athleteId: a && a.id }, confirm: true }] });
  });

  /** Pure, synchronous: text + context → { text, blocks, actions, suggestions }. */
  function respond(text, ctx) {
    const q = String(text || '').toLowerCase().trim();
    ctx = ctx || { route: AMS.ui.route, focus: AMS.ui.focus };
    for (const it of INTENTS) {
      if (!it.test.test(q)) continue;
      const r = it.fn(q, ctx);
      if (r) { r.intent = it.id; if (!r.suggestions.length) r.suggestions = suggestionsFor(ctx).slice(0, 3); return r; }
    }
    const a = findAthletes(q, ctx)[0];
    if (a) return Object.assign(INTENTS.find((i) => i.id === 'status').fn('how is ' + a.name.toLowerCase(), ctx), { intent: 'status' });
    return reply('I didn\'t catch that. I can answer questions about readiness, risk, injuries, check-ins, centres, documents, nutrition and talent, and take actions with your confirmation.', { intent: 'fallback', suggestions: suggestionsFor(ctx) });
  }
  function suggestionsFor(ctx) {
    const f = ctx && ctx.focus && ctx.focus.athleteId && AMS.org.athlete(ctx.focus.athleteId);
    const mod = ctx && ctx.route && ctx.route.module;
    if (f) return ['How is ' + first(f) + ' doing?', 'Why is ' + first(f) + ' red?', 'Draft a message to ' + first(f) + '\'s coach'];
    const role = AMS.ui.role;
    if (role === 'ops') return ['Which documents are pending?', 'Who needs a coach?', 'Compare centres'];
    if (mod === 'medical' || role === 'physio' || role === 'doctor') return ['Show rehab status', 'Who is at risk today?', 'Explain ACWR'];
    if (mod === 'nutrition' || role === 'nutritionist') return ['Any weight-cut flags?', 'Who is at risk today?', 'Summarise the week'];
    return ['Who is at risk today?', 'Move red athletes to recovery', 'Summarise the week'];
  }
  AMS.copilot = Object.assign(AMS.copilot || {}, { respond, suggestionsFor });

  AMS.registerAction('copilot.recoverMany', (p) => {
    if (AMS.actions['dashboard.recoverAllRed']) return AMS.runAction('dashboard.recoverAllRed', { athleteIds: p.athleteIds });
    let n = 0; (p.athleteIds || []).forEach((id) => { if (AMS.runAction('session.modifyForAthlete', { athleteId: id, variant: 'recovery' })) n++; });
    return n + ' moved to recovery';
  });

  /* ================================================================== panel */
  const bold = (s) => String(s).split(/\*\*(.+?)\*\*/g).map((x, i) => (i % 2 ? html`<b key=${i}>${x}</b>` : x));
  function Blocks({ blocks }) {
    return (blocks || []).map((b, i) => {
      if (b.type === 'athletes') return html`<div key=${i} className="row tight wrap">${b.ids.map((id) => { const a = AMS.org.athlete(id); return a && html`<button key=${id} className="btn xs" onClick=${() => AMS.openAthlete(id)}><${UI.Avatar} name=${a.name} size=${16} />${a.name}</button>`; })}</div>`;
      if (b.type === 'evidence') return html`<${UI.Evidence} key=${i} items=${b.items} />`;
      if (b.type === 'insights') return html`<div key=${i} className="card" style=${{ overflow: 'hidden' }}><${UI.InsightList} insights=${b.items} compact=${true} /></div>`;
      if (b.type === 'table') return html`<div key=${i} className="tbl-wrap"><table className="tbl compact"><thead><tr>${b.head.map((h) => html`<th key=${h}>${h}</th>`)}</tr></thead><tbody>${b.rows.map((r, k) => html`<tr key=${k}>${r.map((c, j) => html`<td key=${j} className="small">${c && c.athleteId ? html`<a className="clickable" style=${{ fontWeight: 600 }} onClick=${() => AMS.openAthlete(c.athleteId)}>${(AMS.org.athlete(c.athleteId) || {}).name}</a>` : c}</td>`)}</tr>`)}</tbody></table></div>`;
      return null;
    });
  }
  function Panel() {
    const { ui } = AMS.useStore();
    const cp = ui.copilot || {};
    const msgs = cp.messages || [];
    const [input, setInput] = useState('');
    const [typing, setTyping] = useState(false);
    const [armed, setArmed] = useState(null);
    const end = useRef(null);
    const ctx = { route: ui.route, focus: ui.focus || {} };
    const save = (list) => AMS.setUI({ copilot: Object.assign({}, AMS.ui.copilot, { messages: list.slice(-40) }) });
    const ask = (text) => {
      if (!String(text || '').trim()) return;
      const base = (AMS.ui.copilot.messages || []).concat({ id: AMS.uid('M'), role: 'user', text });
      save(base); setInput(''); setTyping(true);
      setTimeout(() => {
        const r = respond(text, { route: AMS.ui.route, focus: AMS.ui.focus || {} });
        save((AMS.ui.copilot.messages || []).concat(Object.assign({ id: AMS.uid('M'), role: 'ai' }, r)));
        setTyping(false);
        if (r.autorun) AMS.runAction(r.autorun.action, r.autorun.payload);
      }, 450);
    };
    useEffect(() => { if (cp.pending && cp.pending.text) { const t = cp.pending.text; AMS.setUI({ copilot: Object.assign({}, AMS.ui.copilot, { pending: null }) }); ask(t); } }, [cp.pending && cp.pending.id]);
    useEffect(() => { if (end.current && end.current.scrollIntoView) end.current.scrollIntoView({ block: 'end' }); }, [msgs.length, typing]);
    const run = (a) => { setArmed(null); const res = AMS.runAction(a.action, a.payload); save((AMS.ui.copilot.messages || []).concat({ id: AMS.uid('M'), role: 'ai', text: res ? 'Done: **' + a.label + '**. ' + (typeof res === 'string' ? res + '.' : '') : 'That action was not allowed for your role.' })); };
    const focusA = ctx.focus.athleteId && AMS.org.athlete(ctx.focus.athleteId);
    const modLabel = (AMS.modules.find((m) => m.id === ui.route.module) || {}).label;
    return html`<div className="col" style=${{ height: '100%', gap: 0, minHeight: 0 }}>
      <div className="card-h" style=${{ borderBottom: '1px solid var(--border)' }}><h3><${UI.Icon} name="sparkles" size=${15} style=${{ color: 'var(--ai)' }} />Copilot</h3>
        <div className="row tight"><span className="ai-chip">${focusA ? 'Viewing ' + focusA.name + ' · ' : ''}${modLabel}</span><button className="btn ghost icon" onClick=${() => AMS.copilot.close()} aria-label="Close copilot"><${UI.Icon} name="x" /></button></div></div>
      <div className="col" style=${{ flex: 1, overflowY: 'auto', padding: 14, gap: 12, minHeight: 0 }}>
        ${!msgs.length && html`<div className="ai-box small">Ask about anyone or anything in <b>${AMS.scopeLabel()}</b>. I show the numbers behind every answer and never change anything without your confirmation.</div>`}
        ${msgs.map((m) => m.role === 'user' ? html`<div key=${m.id} style=${{ alignSelf: 'flex-end', maxWidth: '85%', background: 'var(--accent)', color: 'var(--surface)', padding: '8px 12px', borderRadius: 12 }} className="small">${m.text}</div>`
          : html`<div key=${m.id} className="col tight" style=${{ gap: 8, maxWidth: '100%' }}>
            <div className="small" style=${{ lineHeight: 1.5 }}>${bold(m.text)}</div>
            <${Blocks} blocks=${m.blocks} />
            ${(m.actions || []).length > 0 && html`<div className="row tight wrap">${m.actions.map((a, k) => armed === m.id + k
              ? html`<span key=${k} className="row tight"><span className="tiny">${a.label}?</span><button className="btn xs primary" onClick=${() => run(a)}>Confirm</button><button className="btn xs" onClick=${() => setArmed(null)}>Cancel</button></span>`
              : html`<button key=${k} className=${AMS.cx('btn xs', k === 0 && 'ai')} onClick=${() => (a.confirm ? setArmed(m.id + k) : run(a))}>${a.label}</button>`)}</div>`}
            ${(m.suggestions || []).length > 0 && html`<div className="row tight wrap">${m.suggestions.map((s) => html`<button key=${s} className="btn xs ghost" style=${{ color: 'var(--ai)' }} onClick=${() => ask(s)}>${s}</button>`)}</div>`}
          </div>`)}
        ${typing && html`<div className="tiny faint">Copilot is thinking…</div>`}
        <div ref=${end} />
      </div>
      <div style=${{ padding: 12, borderTop: '1px solid var(--border)' }} className="col tight">
        ${!msgs.length && html`<div className="row tight wrap" style=${{ marginBottom: 6 }}>${suggestionsFor(ctx).map((s) => html`<button key=${s} className="btn xs" style=${{ borderColor: 'var(--ai-border)', color: 'var(--ai)' }} onClick=${() => ask(s)}>${s}</button>`)}</div>`}
        <div className="row tight"><input className="input grow" placeholder="Ask anything, e.g. who is at risk today?" value=${input} onChange=${(e) => setInput(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') ask(input); }} /><button className="btn ai icon" aria-label="Send" onClick=${() => ask(input)}><${UI.Icon} name="send" size=${15} /></button></div>
      </div>
    </div>`;
  }
  AMS.registerPanel('copilot', Panel);

  /* ================================================================== AI Operations page */
  AMS.registerSeed('automations', (db) => {
    db.automations = [
      { id: 'AUT-1', name: 'Load jump + red readiness → draft recovery variant, coach approves', on: true, approval: true, runs: 14 },
      { id: 'AUT-2', name: '06:45 check-in reminder to athletes who have not checked in', on: true, approval: false, runs: 41 },
      { id: 'AUT-3', name: 'Weekly director brief, Monday 08:00', on: true, approval: false, runs: 6 },
      { id: 'AUT-4', name: 'AI pre-check on every uploaded document', on: true, approval: false, runs: 212 },
      { id: 'AUT-5', name: 'Weight cut over 3% in 14 days → alert nutritionist and doctor', on: true, approval: true, runs: 3 },
    ];
  });
  AMS.registerAction('automation.toggle', (p) => { const r = (AMS.db.automations || []).find((x) => x.id === p.id); if (!r) return null; AMS.mutate((db) => { const x = db.automations.find((y) => y.id === p.id); x.on = !x.on; }, { toast: r.name.split(' → ')[0] + (r.on ? ' paused' : ' switched on'), log: { type: 'ai', text: 'Automation ' + (r.on ? 'paused' : 'enabled') + ': ' + r.name } }); return 'Toggled'; });
  function Page({ params }) {
    const { db } = AMS.useStore();
    const [tab, setTab] = useState((params && params.tab) || 'inbox');
    const [q, setQ] = useState('');
    const ins = AMS.ai.insights();
    const byMod = AMS.groupBy(ins, 'module');
    const done = Object.entries(db.aiState.done || {}).map(([id, d]) => Object.assign({ id }, d)).reverse();
    return html`<div className="page">
      <${UI.PageHead} title="AI Operations" sub="Every AI flag in one inbox, the automation rules, and an audit of what the AI triggered" />
      <div className="row tight"><input className="input grow" placeholder="Ask the Copilot in plain language…" value=${q} onChange=${(e) => setQ(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter' && q.trim()) { AMS.copilot.ask(q); setQ(''); } }} /><button className="btn ai" onClick=${() => { if (q.trim()) { AMS.copilot.ask(q); setQ(''); } }}><${UI.Icon} name="sparkles" size=${14} />Ask</button></div>
      <div className="grid g4">
        <${UI.KPI} label="Open AI flags" value=${ins.length} icon="sparkles" foot=${Object.keys(byMod).length + ' modules'} />
        <${UI.KPI} label="Acted on" value=${AMS.ai.actedRate()} unit="%" icon="check" foot="Share of AI warnings staff acted on" />
        <${UI.KPI} label="Actions today" value=${db.aiState.acted} icon="zap" />
        <${UI.KPI} label="Dismissed" value=${db.aiState.dismissedCount} icon="x" foot="Feeds back into thresholds" />
      </div>
      <${UI.Tabs} value=${tab} onChange=${setTab} tabs=${[{ id: 'inbox', label: 'Inbox', count: ins.length }, { id: 'automations', label: 'Automations' }, { id: 'audit', label: 'Audit', count: done.length || null }, { id: 'models', label: 'Model cards' }]} />
      ${tab === 'inbox' && html`<div className="grid g2">${Object.entries(byMod).map(([m, list]) => html`<${UI.Card} key=${m} title=${(AMS.modules.find((x) => x.id === m) || {}).label || m} ai=${true} hint=${list.length} flush><${UI.InsightList} insights=${list} max=${5} /><//>`)}</div>`}
      ${tab === 'automations' && html`<${UI.Card} title="Automation rules" icon="settings" flush><div className="list">${(db.automations || []).map((r) => html`<div key=${r.id} className="list-item"><${UI.Toggle} checked=${r.on} onChange=${() => AMS.runAction('automation.toggle', { id: r.id })} /><span className="small grow">${r.name}</span>${r.approval && html`<${UI.Pill} tone="ai">Human approval<//>`}<span className="tiny faint">${r.runs} runs</span></div>`)}</div><//>`}
      ${tab === 'audit' && html`<${UI.Card} title="AI-triggered actions" icon="shield-check" flush>${done.length ? html`<div className="list">${done.map((d) => html`<div key=${d.id} className="list-item"><span className="tiny faint tnum" style=${{ width: 120 }}>${(d.at || '').replace('T', ' ')}</span><span className="small grow">${d.action}</span><span className="tiny faint">${d.id.split(':')[0]}</span><${UI.Pill}>${AMS.roleLabel(d.by)}<//></div>`)}</div>` : html`<${UI.Empty} icon="shield-check" title="No AI actions yet today">Act on an AI flag anywhere and it is recorded here with who confirmed it.<//>`}<//>`}
      ${tab === 'models' && html`<div className="grid g3">${[['Readiness', 'Morning check-in vs the athlete\'s own 3-week normal, ACWR, availability', 'Self-reported; a missed check-in falls back to a 3-day average'], ['Injury risk', 'ACWR, wellness vs normal, sleep, injury history, monotony, recent return to play', 'Flags risk, never changes medical status: a physio decides'], ['Document check', 'OCR fields vs application: name, date of birth, signatures, blur', 'Pre-check only; a person verifies every document']].map(([n, i, g]) => html`<${UI.Card} key=${n} title=${n} ai=${true}><div className="col tight small"><span><b>Inputs:</b> ${i}</span><span><b>Guardrail:</b> ${g}</span><span className="muted">Always shows why · compares to own normal</span></div><//>`)}</div>`}
    </div>`;
  }
  AMS.registerModule({ id: 'copilot', label: 'AI Operations', icon: 'sparkles', group: 'intelligence', order: 9, roles: ['director', 'coach', 'physio', 'doctor', 'scientist', 'nutritionist', 'ops'], component: Page });
  AMS.registerCommand({ id: 'copilot.ask', label: 'Ask Copilot', group: 'AI', icon: 'sparkles', keywords: 'ai assistant question', run: () => AMS.copilot.open() });
  AMS.registerCommand({ id: 'copilot.inbox', label: 'Open AI inbox', group: 'AI', icon: 'sparkles', keywords: 'ai flags insights', run: () => AMS.go(MOD) });

  /* ================================================================== self-tests */
  const assert = (c, m) => { if (!c) throw new Error(m); };
  AMS.selfTests.push({ name: 'copilot: bulk recovery lists the red athletes and needs confirmation', role: 'coach', fn: () => {
    const r = respond('move red athletes to recovery', { route: { module: 'dashboard' }, focus: {} });
    const a = r.actions[0]; assert(a && a.confirm && a.payload.athleteIds.includes(AMS.db.meta.heroAthleteId), 'Priya missing from the recovery action');
  } });
  AMS.selfTests.push({ name: 'copilot: coach asking about injuries never sees a diagnosis', role: 'coach', fn: () => {
    const r = respond('show injuries', { route: {}, focus: {} });
    assert(!/strain|sprain|Grade|tendin/i.test(JSON.stringify(r)), 'diagnosis leaked to coach');
  } });
  AMS.selfTests.push({ name: 'copilot: "why is she red" resolves to the athlete on screen', role: 'director', fn: () => {
    const r = respond('why is she red?', { route: { module: 'dashboard' }, focus: { athleteId: AMS.db.meta.heroAthleteId } });
    assert(/Priya Deshmukh/.test(r.text) && /ACWR|load/i.test(r.text), 'pronoun not resolved');
  } });
})();
