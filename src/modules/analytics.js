/* USI · AMS — Analytics & BI (lightweight).
   Federation KPIs with trends, a drill-down table (state → centre → squad) that sets the global ladder scope, a simple 4-week injury
   forecast, and a report preview with Copy CSV + schedule. Ops sees operational metrics only (no medical). Owns db.reports. */
(function () {
  'use strict';
  const AMS = window.AMS, UI = window.UI, React = window.React, html = AMS.html;
  const { useState, useMemo } = React;
  const D = AMS.date, C = AMS.calc;
  const MOD = 'analytics';

  const medOk = () => AMS.access('medical') !== 'none';
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

  /** Core metrics for any list of athletes (same maths everywhere: tiles, table, reports). */
  function metrics(list) {
    const ids = new Set(list.map((a) => a.id));
    const open = AMS.db.injuries.filter((i) => ids.has(i.athleteId) && i.status !== 'Closed');
    const recent = AMS.db.injuries.filter((i) => ids.has(i.athleteId) && D.diff(AMS.TODAY, i.dateOfInjury) <= 90);
    const hours = AMS.sum(list.map((a) => AMS.sum(a.loads || []) / 5.5 / 60)) * (90 / 42); // sRPE ÷ typical RPE → minutes → hours, scaled to 90 days
    return {
      athletes: list.length,
      readiness: list.length ? Math.round(AMS.mean(list.map((a) => C.readiness(a).score))) : 0,
      checkin: C.checkinRate(list),
      available: pct(list.filter((a) => a.availability === 'Available').length, list.length),
      loadJumps: list.filter((a) => C.acwr(a) >= 1.5).length,
      openInjuries: open.length,
      incidence: hours ? AMS.round((recent.length / hours) * 1000, 1) : 0,
    };
  }
  const COLS = [
    { key: 'athletes', label: 'Athletes', fmt: (v) => v },
    { key: 'readiness', label: 'Readiness', fmt: (v) => v, tone: (v) => (v >= 70 ? 'good' : v >= 55 ? 'warn' : 'bad') },
    { key: 'checkin', label: 'Check-in %', fmt: (v) => v + '%', tone: (v) => (v >= 85 ? 'good' : v >= 70 ? 'warn' : 'bad') },
    { key: 'available', label: 'Available %', fmt: (v) => v + '%', tone: (v) => (v >= 92 ? 'good' : v >= 85 ? 'warn' : 'bad') },
    { key: 'loadJumps', label: 'Load jumps', fmt: (v) => v, tone: (v) => (v ? 'warn' : 'good') },
    { key: 'openInjuries', label: 'Open injuries', med: true, fmt: (v) => v, tone: (v) => (v > 2 ? 'bad' : v ? 'warn' : 'good') },
    { key: 'incidence', label: 'Inj / 1000 h', med: true, fmt: (v) => v, tone: (v) => (v > 6 ? 'bad' : v > 3 ? 'warn' : 'good') },
  ];
  const cols = () => COLS.filter((c) => !c.med || medOk());

  /** Monthly injury counts (12 months) and weekly check-in % (4 weeks) for the trend card. */
  function trends(list) {
    const ids = new Set(list.map((a) => a.id));
    const months = Array.from({ length: 12 }, (_, k) => { const d = D.add(AMS.TODAY, -30 * (11 - k)); return d.slice(0, 7); });
    const inj = months.map((m) => ({ x: D.month(m + '-01'), y: AMS.db.injuries.filter((i) => ids.has(i.athleteId) && i.dateOfInjury.slice(0, 7) === m).length }));
    const weeks = [0, 1, 2, 3].map((w) => { const from = 27 - 7 * (3 - w) - 6, to = 27 - 7 * (3 - w); let n = 0, t = 0; list.forEach((a) => { for (let i = Math.max(0, from); i <= to; i++) { t++; if ((a.wellness || [])[i]) n++; } }); return { x: 'Wk ' + (w + 1), y: pct(n, t) }; });
    return { inj, weeks };
  }

  /** 4-week forecast: expected injuries from each athlete's explainable risk score; what-if: fewer load jumps. */
  function forecast(list, cutPct) {
    const base = AMS.sum(list.map((a) => (C.risk(a).score / 100) * 0.09));
    const jumpShare = AMS.sum(list.filter((a) => C.acwr(a) >= 1.3).map((a) => (C.risk(a).score / 100) * 0.09 * 0.45));
    const weekly = base - jumpShare * (cutPct / 100);
    return { weeks: [1, 2, 3, 4].map((w) => ({ x: 'Wk ' + w, y: AMS.round(weekly * (1 + (w - 1) * 0.03), 1), lo: AMS.round(weekly * 0.7, 1), hi: AMS.round(weekly * 1.35, 1) })), avoided: AMS.round(jumpShare * (cutPct / 100) * 4, 1), total: AMS.round(weekly * 4.2, 1) };
  }

  /* ---------------------------------------------------------------- reports */
  AMS.registerSeed('reports', (db) => {
    db.reports = {
      schedules: [{ id: 'RS-1', template: 'Weekly Performance Director pack', cadence: 'Weekly · Mon 08:00', roles: ['director'], created: '2026-09-01' }],
      runs: [{ id: 'RR-1', template: 'Weekly Performance Director pack', at: '2026-10-12T08:00', scope: 'Whole federation', by: 'Scheduled', rows: 9 }],
    };
  });
  const TEMPLATES = ['Weekly Performance Director pack', 'Monthly federation report', 'Centre medical summary', 'Scheme utilisation'];
  function reportRows(list) {
    const by = AMS.groupBy(list, 'centreId');
    return Object.keys(by).map((cid) => Object.assign({ id: cid, name: AMS.org.centre(cid).short }, metrics(by[cid])));
  }
  function toCsv(rows) { const cs = cols(); return ['Centre,' + cs.map((c) => c.label).join(',')].concat(rows.map((r) => r.name + ',' + cs.map((c) => r[c.key]).join(','))).join('\n'); }
  AMS.registerAction('report.run', (p) => {
    const tpl = p.template || TEMPLATES[0];
    if (/medical/i.test(tpl) && !medOk()) { AMS.toast('Operations cannot run medical reports', 'bad'); return null; }
    const rows = reportRows(AMS.scopedAthletes());
    AMS.mutate((db) => { db.reports.runs.unshift({ id: AMS.uid('RR'), template: tpl, at: AMS.TODAY + 'T' + AMS.clockTime(), scope: AMS.scopeLabel(), by: (AMS.me() || {}).name, rows: rows.length }); },
      { toast: tpl + ' generated (' + rows.length + ' centres)', log: { type: 'report', text: 'Report generated: ' + tpl + ' — ' + AMS.scopeLabel() } });
    return 'Generated';
  });
  AMS.registerAction('report.schedule', (p) => {
    const tpl = p.template || TEMPLATES[0];
    AMS.mutate((db) => { db.reports.schedules.unshift({ id: AMS.uid('RS'), template: tpl, cadence: p.cadence || 'Weekly · Mon 08:00', roles: p.roles || ['director'], created: AMS.TODAY }); },
      { toast: tpl + ' scheduled ' + (p.cadence || 'weekly').toLowerCase(), log: { type: 'report', text: 'Scheduled ' + tpl + ' (' + (p.cadence || 'Weekly') + ')' } });
    return 'Scheduled';
  });

  /* ---------------------------------------------------------------- AI: KPI anomaly by centre */
  AMS.registerDetector('analytics.kpiAnomaly', (ctx) => {
    if (!['director', 'ops'].includes(ctx.role)) return [];
    const by = AMS.groupBy(ctx.athletes, 'centreId');
    const fed = C.checkinRate(ctx.athletes);
    return Object.entries(by).map(([cid, l]) => ({ cid, l, r: C.checkinRate(l) })).filter((x) => x.l.length >= 5 && x.r < fed - 15).map((x) => ({
      id: 'kpi:checkin:' + x.cid + ':' + AMS.TODAY, kind: 'ops', severity: 'med', module: MOD,
      title: AMS.org.centre(x.cid).short + ' check-in rate ' + x.r + '% vs ' + fed + '% overall',
      summary: 'Lowest check-in compliance in scope this morning. Without check-ins the readiness board for ' + x.l.length + ' athletes is guesswork.',
      athleteIds: x.l.map((a) => a.id), confidence: 0.8,
      evidence: [{ label: 'Centre', value: x.r + '%', tone: 'bad' }, { label: 'Overall', value: fed + '%', tone: 'info' }],
      actions: [{ label: 'Send reminder', action: 'checkin.remind', payload: { athleteIds: x.l.filter((a) => !C.todayWellness(a)).map((a) => a.id) }, primary: true }, { label: 'Drill into centre', action: 'go', payload: { module: MOD, params: { centreId: x.cid } } }],
    }));
  });

  /* ---------------------------------------------------------------- page */
  function Page() {
    const { v, ui } = AMS.useStore();
    const list = AMS.scopedAthletes();
    const [cut, setCut] = useState(30);
    const [tpl, setTpl] = useState(TEMPLATES[0]);
    const m = useMemo(() => metrics(list), [v, list.length]);
    const t = useMemo(() => trends(list), [v, list.length]);
    const fc = useMemo(() => forecast(list, cut), [v, list.length, cut]);
    const s = AMS.effectiveScope();
    // Drill-down rows: states (federation) → centres (state) → squads (centre)
    const level = s.centreId ? 'squad' : s.stateId ? 'centre' : 'state';
    const groups = AMS.groupBy(list, level === 'squad' ? 'squadId' : level === 'centre' ? 'centreId' : 'stateId');
    const rows = Object.entries(groups).map(([id, l]) => Object.assign({ id, name: level === 'squad' ? AMS.org.squad(id).name : level === 'centre' ? AMS.org.centre(id).short : AMS.org.state(id).name }, metrics(l)));
    const drill = (id) => AMS.setUI({ scope: Object.assign({}, ui.scope, level === 'state' ? { stateId: id } : level === 'centre' ? { centreId: id } : { squadId: id }) });
    const rptRows = reportRows(list);
    const copy = () => { try { navigator.clipboard.writeText(toCsv(rptRows)).then(() => AMS.toast('CSV copied (' + rptRows.length + ' rows)', 'good'), () => AMS.toast('Clipboard blocked — select the preview instead', 'bad')); } catch (e) { AMS.toast('Clipboard unavailable', 'bad'); } };
    const ins = AMS.ai.insights({ limit: 4 });
    return html`<div className="page">
      <${UI.PageHead} title="Analytics & BI" sub=${'Federation KPIs, drill-down and reports · ' + AMS.scopeLabel()} actions=${s.stateId || s.centreId ? html`<button className="btn" onClick=${() => AMS.setUI({ scope: {} })}><${UI.Icon} name="arrow-up" size=${14} />Back to federation</button>` : null} />
      <div className="grid g4">
        <${UI.KPI} label="Avg readiness" value=${m.readiness} icon="pulse" foot=${m.athletes + ' athletes'} />
        <${UI.KPI} label="Check-in today" value=${m.checkin} unit="%" icon="check" spark=${t.weeks.map((w) => w.y)} />
        <${UI.KPI} label="Available" value=${m.available} unit="%" icon="users" foot=${m.loadJumps + ' load jumps (ACWR ≥ 1.5)'} />
        ${medOk() ? html`<${UI.KPI} label="Injuries / 1000 h" value=${m.incidence} icon="medical" foot=${m.openInjuries + ' open cases · last 90 days'} spark=${t.inj.map((x) => x.y)} sparkTone="bad" />` : html`<${UI.KPI} label="AI warnings acted on" value=${AMS.ai.actedRate()} unit="%" icon="sparkles" foot="Medical KPIs hidden for Operations" />`}
      </div>
      <div className="grid g-main">
        <${UI.Card} title=${'By ' + level} icon="layers" hint="click a row to drill down" flush>
          <${UI.Table} compact=${true} rows=${rows} onRow=${(r) => drill(r.id)} initialSort=${{ key: 'readiness', dir: 'asc' }}
            columns=${[{ key: 'name', label: level[0].toUpperCase() + level.slice(1), render: (r) => html`<b>${r.name}</b>` }].concat(cols().map((c) => ({ key: c.key, label: c.label, num: true, render: (r) => html`<span className=${c.tone ? c.tone(r[c.key]) : ''} style=${{ fontWeight: 600 }}>${c.fmt(r[c.key])}</span>` })))} />
        <//>
        <${UI.Card} title="What changed" ai=${true} flush><${UI.InsightList} insights=${ins} compact=${true} /><//>
      </div>
      <div className="grid g2">
        ${medOk() ? html`<${UI.Card} title="Injury forecast — next 4 weeks" icon="trend-up" hint=${'expected ' + fc.total + ' injuries'}>
          <${UI.LineChart} height=${180} series=${[{ name: 'Expected', data: fc.weeks.map((w) => ({ x: w.x, y: w.y })), tone: 'bad' }, { name: 'Upper band', data: fc.weeks.map((w) => ({ x: w.x, y: w.hi })), tone: 'fg-3', dashed: true }, { name: 'Lower band', data: fc.weeks.map((w) => ({ x: w.x, y: w.lo })), tone: 'fg-3', dashed: true }]} />
          <div className="row" style=${{ gap: 12, marginTop: 8 }}><span className="small">What if load jumps drop by <b>${cut}%</b>?</span><input type="range" min="0" max="80" step="10" value=${cut} onChange=${(e) => setCut(+e.target.value)} className="grow" /><${UI.Pill} tone="good">${fc.avoided} avoided<//></div>
          <div className="tiny faint" style=${{ marginTop: 4 }}>Model inputs: each athlete's injury-risk score (ACWR, wellness vs own normal, sleep, history, monotony).</div>
        <//>` : html`<${UI.Card} title="Check-in trend" icon="check"><${UI.BarChart} height=${180} data=${t.weeks.map((w) => ({ label: w.x, value: w.y }))} yFormat=${(x) => x + '%'} /><//>`}
        <${UI.Card} title="Reports" icon="file" actions=${html`<${UI.Select} value=${tpl} onChange=${setTpl} options=${TEMPLATES.filter((x) => medOk() || !/medical/i.test(x))} />`}>
          <div className="col" style=${{ gap: 10 }}>
            <pre className="mono tiny" style=${{ margin: 0, maxHeight: 130, overflow: 'auto', background: 'var(--surface-2)', padding: 8, borderRadius: 6 }}>${toCsv(rptRows)}</pre>
            <div className="row tight wrap">
              <button className="btn sm primary" onClick=${() => AMS.runAction('report.run', { template: tpl })}>Generate</button>
              <button className="btn sm" onClick=${copy}><${UI.Icon} name="copy" size=${13} />Copy CSV</button>
              <button className="btn sm" onClick=${() => AMS.runAction('report.schedule', { template: tpl, cadence: 'Weekly · Mon 08:00' })}><${UI.Icon} name="clock" size=${13} />Schedule weekly</button>
            </div>
            <div className="tiny faint">${(AMS.db.reports.schedules || []).length} scheduled · last run ${((AMS.db.reports.runs || [])[0] || {}).at ? AMS.db.reports.runs[0].at.replace('T', ' ') : '—'}</div>
          </div>
        <//>
      </div>
    </div>`;
  }
  AMS.registerModule({ id: 'analytics', label: 'Analytics & BI', icon: 'chart', group: 'intelligence', order: 8, roles: ['director', 'coach', 'physio', 'doctor', 'scientist', 'nutritionist', 'ops'], component: Page });

  /* ---------------------------------------------------------------- self-tests */
  const assert = (c, msg) => { if (!c) throw new Error(msg); };
  AMS.selfTests.push({ name: 'analytics: report run and schedule are stored', role: 'director', fn: () => {
    const r0 = AMS.db.reports.runs.length, s0 = AMS.db.reports.schedules.length;
    AMS.runAction('report.run', { template: 'Monthly federation report' });
    AMS.runAction('report.schedule', { template: 'Scheme utilisation', cadence: 'Monthly · 1st 09:00' });
    assert(AMS.db.reports.runs.length === r0 + 1 && AMS.db.reports.schedules.length === s0 + 1, 'report not stored');
  } });
  AMS.selfTests.push({ name: 'analytics: centre rows add up to the federation total; ops cannot run medical reports', role: 'ops', fn: () => {
    const list = AMS.scopedAthletes();
    assert(AMS.sum(reportRows(list).map((r) => r.athletes)) === list.length, 'rows do not add up');
    assert(!toCsv(reportRows(list)).includes('Open injuries'), 'ops CSV contains medical columns');
    assert(AMS.runAction('report.run', { template: 'Centre medical summary' }) == null, 'ops ran a medical report');
  } });
})();
