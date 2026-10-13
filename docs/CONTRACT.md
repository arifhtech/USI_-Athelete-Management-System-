# USI · AMS prototype — module developer contract

Read this whole file before writing code. Also skim `docs/brief.md` (what is evaluated) and `docs/product-thinking.txt`
(the candidate's product doc — the prototype must match it: one shared athlete record, the org ladder, two statuses,
role matrix, Priya's journey, AI rules "always show why / never change medical status on its own / compare to own normal").

## Stack & file rules
- Single-page React 18 app, **no build step**. Each module is ONE plain-JS file `src/modules/<id>.js` wrapped in an IIFE.
- Templates use **htm** tagged templates: `const html = AMS.html;` then `` html`<div className="card">…</div>` ``.
  - Components: `` html`<${UI.Card} title="X">…<//>` `` (close with `<//>` or `</${UI.Card}>`). Props: `prop=${value}`. Spread: `...${obj}`.
  - Always `className` (not `class`), `htmlFor`, `strokeWidth` etc. (React DOM prop names). `style=${{ … }}` objects.
  - Every list item needs a `key=${…}`.
- NO JSX, NO `import`, NO TypeScript, NO external libraries, NO `fetch`, NO `alert/confirm/prompt` (use `UI.ConfirmButton` or inline UI).
  NO file downloads (the viewer blocks them) — "Export" means: a preview modal + "Copy CSV" (navigator.clipboard in a click handler, catch errors) + scheduled-report toggles.
- Hooks come from `React` (`const { useState, useMemo, useEffect, useRef } = React;`).
- **Only edit the files you own.** Never edit `src/core.js`, `src/data.js`, `src/ui.js`, `src/shell.js`, `src/styles.css`, or another module's file.
  If you truly need a core change, write it in your final report under "core requests". You may add module-scoped CSS by injecting
  ONE `<style>` element from your file (id `style-<moduleId>`), using only the theme tokens (CSS variables) listed below — never literal colours that work in one theme only.
- Must pass: `node --check src/modules/<id>.js` and `node tools/smoke.js <id>` (from the `usi-ams` folder). The smoke test server-renders
  your module for all 8 roles, plus every drawer/modal you register (using their `sample` props). Fix every failure.
- Do NOT start servers or use a browser. Do NOT rebuild `dist/` (the integrator does).

## Registration (keep the id/label/icon/group/order/roles from the existing stub file you replace)
```js
(function () {
  'use strict';
  const AMS = window.AMS, UI = window.UI, React = window.React, html = AMS.html;
  const { useState, useMemo, useEffect, useRef } = React;
  function Page({ params }) {
    const { db, ui, v } = AMS.useStore();          // subscribe → re-render on every change. Call at top of every component that reads db/ui.
    const athletes = AMS.scopedAthletes();          // role lock ∩ org ladder filter — ALWAYS start from this for lists/KPIs
    …
    return html`<div className="page">
      <${UI.PageHead} title="…" sub="…" actions=${html`<button className="btn primary">…</button>`} />
      …
    </div>`;
  }
  AMS.registerModule({ id, label, icon, group, order, roles, component: Page, short: 'Training', badge: () => ({ n: 3, tone: 'bad' }), sampleParams: [{}, { tab: 'x' }] });
})();
```
`params` come from `AMS.go(moduleId, params)` (e.g. `AMS.go('athletes', { tab: 'onboarding' })`). Support deep links into your tabs.
`sampleParams` (optional) tells the smoke test which param variants to render.

## State
- `AMS.db` — the shared database (see Data model). **Mutate only through** `AMS.mutate(db => { …in-place changes… }, { toast: 'Done', toastKind: 'good'|'bad'|'info'|'ai', log: { type, text, athleteId } })`.
  Persisted to localStorage automatically. Use `AMS.byId(db.list, id)` inside mutate to get the live object.
- `AMS.ui` — UI state: `route {module, params}`, `role`, `scope`, `drawers`, `modal`, `copilot`, `focus`, `live`, `clock`. Patch with `AMS.setUI({...})`.
  Component-local UI state (selected tab, filters, form fields) → `useState` (or `UI.useLocal(key, init)` to remember per viewer).
- `useMemo` deps: use `v` from `AMS.useStore()` (it increments on every change) — db is mutated in place so object identity never changes.
- Module-owned data: `AMS.registerSeed('<key>', (db, rng) => { db.<key> = … })` — runs on fresh data AND on old saved data missing the key.
  Use the provided seeded `rng` (rng(), rng.int(a,b), rng.pick(arr), rng.norm(mu,sd), rng.chance(p)) — never Math.random in seeds. Keep it compact (< 150 KB JSON).
- Live simulation: `AMS.onTick(n => {...})` runs every 5 s while "live" is on (simulated clock advances 1 min per tick; read `AMS.clockTime()`).
  Mutate `AMS.db` directly inside ticks (the shell re-renders after ticks). Keep ticks cheap and bounded.

## Time
"Today" is fixed: `AMS.TODAY = '2026-10-13'` (Tuesday), clock starts 07:05. Use `AMS.date.*`: `add(iso,n)`, `diff(a,b)` (a−b days), `fmt(iso)` "13 Oct",
`fmtLong`, `dow`, `rel(iso)` ("2d ago"), `ageOn(dob)`, `range(start,n)`. Series helpers: `AMS.series.loadDate(i)` (loads idx 41 = today), `AMS.series.wellDate(i)` (wellness idx 27 = today).

## Roles, RBAC and the org ladder (systems thinking — demonstrate these!)
- Roles: `director, coach, physio, doctor, scientist, nutritionist, ops, athlete`. Current: `AMS.ui.role`. Acting person: `AMS.me()` (staff record, or Priya's athlete record for `athlete`).
- `AMS.access(domain)` → 'none'|'own'|'summary'|'view'|'edit'|'full'|… for domains `training, readiness, medical, nutrition, documents, reports, athletes, assessments`.
  `AMS.can(domain, 'view')`, `AMS.canEdit(domain)`, `AMS.medicalFull()` (physio/doctor only).
- **Medical privacy**: non-medical roles see `AMS.medicalLabel(injury)` → "Modified training: upper leg", never the diagnosis, notes or pain log. Ops sees no medical at all.
- Ladder: Federation → State → Centre → Sport → Squad → Athlete. `AMS.effectiveScope()` = `{stateId, centreId, sport, squadId, lock}`; coaches are locked to their squads,
  centre staff (physio/doctor/scientist/nutritionist) to their centre (Pune HPC). `AMS.scopedAthletes({all})`, `AMS.inScope(a)`, `AMS.scopeLabel()`.
  Drill-down = `AMS.setUI({ scope: { ...AMS.ui.scope, centreId: 'PUN' } })` (changes the global filter in the top bar).
- `AMS.org.state(id) / centre(id) / squad(id) / staff(id) / athlete(id) / sports()`.

## Calculations (`AMS.calc`)
`acwr(a, endIdx?)` (as of this morning; 7d/28d rolling), `acwrSeries(a, days)`, `acwrBand(r)` → good|warn|bad|info, `acwrLabel(r)`, `weekLoad(a, weeksAgo)`, `monotony(a)`, `strain(a)`,
`todayWellness(a)`, `wellnessScore(w)`, `wellnessAvg(a, from, to)`, `wellnessBaseline(a)` (own 3-week normal), `readiness(a)` → `{score, band: good|warn|bad, checkedIn, factors:[{label,value,tone}]}`,
`bandLabel(band)` → Green/Amber/Red, `risk(a)` → `{score, band, factors}`, `checkinRate(list)`, `openInjuries(idSet?)`, `recordLoad(db, athleteId, load, dayIdx?)` (call inside mutate), `ageGroup(age)`.
Utils: `AMS.uid(prefix)`, `clamp`, `round(v,d)`, `sum`, `mean`, `groupBy`, `byId`, `cx(...classes)`, `initials`, `hue`, `rng(seed)`.

## Navigation, overlays, feedback
- `AMS.go(module, params)`; `AMS.openAthlete(id, tab?)` (global athlete drawer); `AMS.openDrawer(type, props)`, `AMS.closeDrawer()`; `AMS.openModal(type, props)`, `AMS.closeModal()`.
- `AMS.registerDrawer(type, Component, { wide: true, sample: () => [{...props}] })` — Component renders `<${UI.DrawerHead} title sub avatar actions />` then `<div className="drawer-b">…</div>` and optional `<div className="drawer-f">…buttons</div>`.
- `AMS.registerModal(type, Component, { sample: () => [{...}] })` — Component renders `<${UI.ModalFrame} title sub icon wide footer=${…}>…<//>`.
- `AMS.toast(text, kind, action?)`, `AMS.log({type, text, athleteId})` (inside mutate) → activity feed, `AMS.notify({toRole, title, text, athleteId, module})` (inside mutate) → bell.
- `AMS.setFocus({ athleteId, injuryId, sessionId })` when a detail view is open, so the Copilot knows what "she/this" means (call during render; it is cheap and idempotent).
- `AMS.registerCommand({ id, label, group, icon, keywords, roles, run })` — appears in Ctrl+K palette.
- `AMS.registerAthleteTab({ id, label, order, roles, component: ({ athlete }) => node })` — adds a tab to the global athlete profile drawer (owned by the athletes module).

## AI layer (AI-native: AI lives inside workflows, not only in a chat)
- `AMS.registerDetector(id, ctx => insights[])`. ctx = `{ db, athletes (scoped active), ids: Set, role, me, scope }`.
  Insight = `{ id (STABLE, include date/entity), kind: 'risk'|'medical'|'ops'|'training'|'nutrition'|'talent'|'wellness', severity: 'high'|'med'|'low', title, summary,
  athleteIds: [], evidence: [{label, value, tone}], confidence: 0..1, module: '<moduleId>', actions: [{ label, action: '<actionId>', payload, primary }], roles?: [] }`.
- `AMS.ai.insights({ module?, kinds?, athleteId?, limit? })` → ranked, scoped, minus dismissed/done. `AMS.ai.act(insight, action)`, `AMS.ai.dismiss(insight)`, `AMS.ai.actedRate()`.
- `AMS.registerAction(id, payload => { AMS.mutate(...); return 'short result'; })`; `AMS.runAction(id, payload)`.
  Core actions: `go {module, params}`, `open.athlete {athleteId, tab}`, `open.injury {injuryId}`, `notify {toRole, text, athleteId}`, `checkin.remind {athleteIds}`,
  `availability.set {athleteId, value, reason}`, `session.modifyForAthlete {athleteId, sessionId?, variant: recovery|reduced|excluded|rehab}`, `task.create {title, ownerRole, module, athleteId, due}`.
- Core detectors already exist: load spikes (ACWR ≥ 1.5), wellness drop vs own normal, missed check-ins, rehab stage overdue, verification SLA.
- UI: `UI.Insight`, `UI.InsightList({insights, max, compact, empty})`, `UI.AIChip`, `UI.Evidence`, `UI.AskCopilot({prompt, label})`, `.ai-box` container, `UI.Card ai` prop.
- AI rules (from the product doc): every AI output shows WHY (evidence chips with numbers), AI never changes medical status on its own (it drafts; a human confirms),
  compare each athlete to their own normal. Show confidence. Make AI text specific (names, numbers, dates) — never generic filler.
- `AMS.copilot.ask(text)` opens the copilot panel with a question.

## UI kit (`window.UI`)
`Icon({name,size})` names: dashboard users user calendar medical pulse flask apple target chart sparkles search bell chev-r chev-l chev-d chev-u x plus minus check alert info filter download upload file tag shield shield-check clock lock more arrow-up arrow-down arrow-r trend-up trend-down refresh send mic phone pin droplet pill scale zap eye edit trash settings layers link watch run dumbbell moon sun heart clipboard external grid list menu sliders flag copy play pause bolt bed gps building merge swap book message whistle
`Pill({tone: good|warn|bad|info|ai|accent, dot})`, `Tag`, `Dot({tone})`, `Avatar({name,size})`, `Meter({value,max,tone})`, `Kbd`, `Empty({icon,title})`, `Section({title,hint,actions})`,
`Card({title, icon, hint, actions, flush, ai, footer, className, style, bodyStyle})`, `KPI({label, value, unit, delta, deltaGood:'up'|'down', foot, spark:[n], sparkTone, onClick, icon, tone})`,
`Tabs({tabs:[{id,label,count,icon}], value, onChange})`, `Seg({options, value, onChange, size})`, `Toggle({checked,onChange,label,id})`, `Field({label,help})`, `Select({value,onChange,options,placeholder,id})`,
`Search({value,onChange,placeholder,id})`, `DL({items:[[label,value]], cols})`, `Stepper({steps:[{label,sub}], current, blocked, onStep})`, `Timeline({items:[{date,title,text,tone,icon,by}]})`,
`Ring({value,size,tone,label})`, `Readiness({athlete,size,showLabel})`, `AvailabilityPill({value})`, `EnrollmentPill({value})`, `AthleteCell({athlete, sub, size})` (opens profile on click), `AcwrPill({athlete|value})`,
`Table({columns:[{key,label,render,num,width,sort,hideSm}], rows, onRow, selectedId, empty, compact, maxHeight, initialSort:{key,dir}})`,
`DrawerHead`, `ModalFrame`, `ConfirmButton({label, confirmLabel, onConfirm, className, icon})`, `Menu({trigger, items:[{label,icon,onClick,danger}]})`,
Charts (SVG, theme-aware, hover tooltips): `Sparkline({data,width,height,tone})`, `LineChart({series:[{name,data:[{x,y}],tone,dashed,area}], height, yMin, yMax, bands:[{from,to,tone,label}], refs:[{y,label,tone}], markers:[{i,label,tone}], yFormat, onPoint})`,
`BarChart({data:[{label,value}|{label,values}], keys:[{name,tone}], stacked, height, onBar, highlight, refY, refLabel})`, `HBars({data:[{label,value,tone,sub,onClick}], max, format})`,
`Donut({data:[{label,value,tone}], size, thickness, center, onSlice})`, `Radar({axes:[{label,value,compare}], size, label, compareLabel})`, `HeatGrid({rows:[{label,onClick,cells:[{label,tone,title}]}], cols})`.
`UI.PageHead({title, sub, crumbs, actions})`. `UI.CAT` categorical colours. Tones accepted by charts: 'good','warn','bad','info','ai','accent','cat-1'…'cat-6', or 'var(--x)'.
Hooks: `UI.useWidth(ref)`, `UI.useClickOutside(ref, fn, active)`, `UI.useLocal(key, init)`.

## CSS classes (styles.css)
Layout: `page` (module root), `page-head`, `grid g2 g3 g4 g5 g6 g-main (2fr/1fr) g-side (sidebar/main)` (collapse responsively), `row` (`wrap top between tight`), `col` (`tight loose`), `grow`.
Surfaces: `card card-h card-b card-f`, `list list-item`, `ai-box`, `insight`, `sev-stripe good|warn|bad|info|ai`, `divider`.
Controls: `btn` + `primary | danger | good | ai | ghost` + `sm | xs | icon | block`; `input select textarea field search`; `tabs tab`; `seg`.
Text: `muted faint small tiny mono num (display numerals) tnum upper ellipsis good warn bad info ai-c`; `pill`, `tag`, `dot`, `meter`, `stepper step`, `tbl tbl-wrap compact`, `kpi`.
Theme tokens (light+dark handled): `--bg --surface --surface-2 --surface-3 --border --border-strong --fg --fg-2 --fg-3 --accent --accent-weak --good(-weak) --warn(-weak) --bad(-weak) --info(-weak) --ai(-weak) --ai-border --body-map-skin --body-map-line --chart-grid --cat-1..6 --font-ui --font-display --font-mono --r --r-lg --shadow --shadow-lg`.
Responsive: works at 1440, 1024 and 390 px wide. Wide tables sit inside `tbl-wrap` (scrolls). `hide-sm` hides on phones.
Visual language: dense, calm enterprise SaaS. Semantic colour only for state (good/warn/bad), violet only for AI. No emoji. No gradients except AI header tint already provided.

## Data model (`AMS.db`)
```
meta: { tenant, tenantShort, heroAthleteId: 'ATH-10421', remindersSent }
org: { states:[{id,name}], centres:[{id,stateId,name,short,type}], squads:[{id,centreId,sport,discipline,ageGroup,name,coachId,slot}] }
staff: [{ id, name, role, title, centreId, persona?, squads?: [squadIds] }]   // persona = the person you act as for that role (Pune HPC)
athletes: [{ id, name, gender 'F'|'M', dob, sport, discipline, events, squadId, centreId, stateId, coachId,
  enrollment: Prospect|Applied|Verifying|Active|Transferred|Inactive|Retired, availability: Available|Modified|Unavailable, availabilityReason,
  enrolledOn, level, tags:[], profileCompletion 0-100, missingFields:[], verification:{status,by,on}, docs:[{id,type,status,on,expires?,ai:{ok,confidence,note}}],
  guardian:{name,relation,consent,consentOn}|null, bloodGroup, heightCm, weightKg, dominantSide, devices:[], phone,
  wellness: [28 × ({sleep,soreness,mood,stress,energy (1–5, 5 = best), sleepHrs, at, note?} | null)]  // idx 27 = today (null = not checked in yet)
  loads: [42 × daily sRPE load (AU)]  // idx 41 = today (0 until today's session RPE is recorded)
  tempAssignment: { centreId, squadId, label, from, to, active } | null, returnedOn, pb?, discoveredAt? }]
applications: [{ id, name, gender, dob, centreId, squadId, sport, events, stage: Applied|Verifying|Docs returned|Approved|Rejected, submitted, source,
  guardian, docs:[{id,type,status: Pending|Verified|Flagged|Missing|Returned, ai:{ok,confidence,note}|null}], duplicateOf:{athleteId,score,reasons}|null, coachId, history:[{date,text,by}], returnReason }]
injuries: [{ id, athleteId, region, side 'L'|'R'|'C', view 'front'|'back', regionLabel, diagnosis, type, grade, severity minor|moderate|severe, mechanism, context,
  dateOfInjury, status: Reported|Assessment|Rehab|Clearance|Monitoring|Closed, path 'case'|'light', availability, reportedBy, physioId, doctorId,
  rtpTemplate, rtpStages:[{name,targetDays,criteria:[{text,met}],signedBy,signedAt}], rtpStage (index), stageSince, stageTargetDays, expectedReturn,
  timeline:[{date,type: report|assessment|stage|setback|note|clearance|decision,by,text}] (newest first), notes:[{date,by,role,text}], painLog:[{date,pain 0–10}],
  clearance:{by,date,conditions}|null, setbacks, closedOn?, daysLost? }]
  Region ids (body map): head neck shoulder chest upper_arm elbow forearm wrist hand abdomen hip_flexor groin quad knee shin ankle foot upper_back lower_back glute hamstring calf achilles
  AMS.RTP_TEMPLATES, AMS.rtpTemplateFor(region,type), AMS.makeRtpStages(key), AMS.bodyZone(region)
sessions: [{ id, squadId, date, start, duration (min), title, type, intensity High|Moderate|Low, plannedRPE, location, coachId, blocks:[{exerciseId,dose}],
  status Planned|Live|Completed, attendance:{athleteId: present|late|absent|excused}, rpe:{athleteId: 1–10}, mods:{athleteId:{variant,by,at}}, notes }]   // last 14 days + today + next 7 days
exercises: [{ id, name, category, focus, dose }]
tests: [{ id, athleteId, date, results:{ sprint30, flying20, slj, cmj, yoyo, mbt }, enteredBy, event? }]   testDefs: [{ id, name, unit, lowerBetter, sports, battery }]
competitions: [{ id, name, date, location, level, sports }]
tasks: [{ id, title, ownerRole, module, status Open|Done, due, created, athleteId?, ref? }]
notifications: [{ id, toRole, title, text, athleteId?, module?, at, read }]   activity: [{ id, at 'YYYY-MM-DDTHH:MM', text, by, role, athleteId, type }] (newest first)
aiState: { dismissed:{}, done:{}, acted, dismissedCount, baselineActed, baselineShown }
```
Story anchors (keep consistent): **Priya Deshmukh** (ATH-10421, 16, U-17 Sprints, Pune HPC, coach Rakesh Patil S-COA01) is RED today — 3 bad nights, soreness 2/5,
ACWR ≈ 1.74 after state-meet trials (load jump), note "Both hamstrings tight after Sunday trial". Discovered at District Talent Hunt (Jan 2026), past left shin splints (closed),
scheduled for National U-18 Sprint Camp at Patiala from 2 Nov (temporary assignment). Rohan Gaikwad (R hamstring, rehab stage 3 running long), Kavya Nair (L ankle, awaiting doctor
clearance), Aman Shinde (L calf, had a setback), Sneha Patil (patellar tendon, light-path monitoring), Yash More (groin, reported 06:52 via athlete app, awaiting physio assessment).
Personas: Director Dr. Anjali Rao · Coach Rakesh Patil · Physio Neha Kulkarni · Doctor Dr. Vikram Menon · Scientist Arjun Iyer · Nutritionist Farah Khan · Ops Sanjay Verma.

## Quality bar
- Enterprise SaaS density: real numbers, units, dates, names, statuses everywhere. No lorem ipsum, no empty shells, no "coming soon".
- Every screen has working interactions that CHANGE STATE (approve, assign, sign off, log, record) and the change shows up elsewhere (dashboard KPIs, athlete profile, activity feed, copilot).
- Drill-downs: KPIs and chart elements are clickable → filtered list / drawer / ladder scope change.
- Role-aware: render differently per role (hide edit controls without permission, show summary-only medical, show "why you can't see this" notes).
- Each module has an AI presence specific to it (detector + inline AI card/recommendation with evidence + one-tap action).
- Keep performance sane: compute heavy lists with `useMemo([v, …])`; no per-render loops over 160 athletes × 42 days more than needed.

## Self-tests (required — they prove your workflows actually change state)
Register 3–8 workflow assertions that run on fresh seed data in the smoke test:
```js
AMS.selfTests.push({ name: 'approving an application creates an active athlete', role: 'ops', fn: () => {
  const before = AMS.db.athletes.length;
  AMS.runAction('application.approve', { appId: 'APP-801' });
  if (AMS.db.athletes.length !== before + 1) throw new Error('athlete not created');
} });
```
Self-tests call your registered actions (or your exported pure functions) — not React components. Keep workflow logic in plain functions/actions
so the UI buttons, the copilot and the AI insights all reuse the same code path.
