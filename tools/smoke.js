// Smoke test: loads the whole app in Node, server-renders every module for every role, every registered drawer/modal/athlete tab
// (with `sample` props), runs every AI detector, copilot queries and module self-tests (workflow assertions on fresh data).
// Usage (from usi-ams/):  node tools/smoke.js              → everything
//                         node tools/smoke.js medical      → only things registered by files whose name contains "medical"
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { SCRIPTS, SRC } = require('./build.js');

const filter = process.argv[2] || '';
const store = {};
global.window = global;
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
global.location = { hash: '' };
global.history = { replaceState() {} };
global.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), head: { appendChild() {} } };
global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
global.__AMS_NO_MOUNT__ = true;
global.React = require(path.join(__dirname, 'node_modules/react'));
global.ReactDOM = require(path.join(__dirname, 'node_modules/react-dom'));
global.htm = require(path.join(__dirname, 'node_modules/htm'));
const { renderToString } = require(path.join(__dirname, 'node_modules/react-dom/server'));

const errors = [], warnings = [];
const origErr = console.error;
let captured = [];
console.error = (...a) => { captured.push(a.map(String).join(' ').slice(0, 500)); };
const mine = (file) => !filter || (file || '').includes(filter);

let curFile = null;
for (const f of SCRIPTS()) {
  curFile = f;
  try {
    vm.runInThisContext(fs.readFileSync(path.join(SRC, f), 'utf8'), { filename: f });
    if (f === 'core.js') {
      const A = global.AMS;
      const tag = (name, getTarget) => { const orig = A[name]; A[name] = function (...args) { const r = orig.apply(this, args); try { const t = getTarget(args); if (t) t.__file = curFile; } catch (e) { } return r; }; };
      tag('registerModule', (a) => A.modules.find((m) => m.id === a[0].id));
      tag('registerDrawer', (a) => A.drawers[a[0]]);
      tag('registerModal', (a) => A.modals[a[0]]);
      tag('registerAthleteTab', (a) => A.athleteTabs.find((t) => t.id === a[0].id));
      tag('registerDetector', (a) => A.detectors.find((d) => d.id === a[0]));
      const origPanel = A.registerPanel; A.registerPanel = (t, c) => { origPanel(t, c); A.panels['__file_' + t] = curFile; };
      const st = A.selfTests; A.selfTests = new Proxy(st, { get(t, p) { if (p === 'push') return (...items) => { items.forEach((i) => { i.__file = curFile; }); return t.push(...items); }; return t[p]; } });
    }
  } catch (e) {
    const msg = 'LOAD ' + f + ': ' + e.message + (e.stack ? ' @ ' + (e.stack.split('\n').find((l) => l.includes(f)) || '').trim() : '');
    if (mine(f) || !f.startsWith('modules/')) errors.push(msg); else warnings.push(msg + ' (not your file — ignored)');
  }
}
const AMS = global.AMS, html = AMS && AMS.html;
if (!AMS || errors.some((e) => e.startsWith('LOAD'))) { console.log(errors.join('\n')); process.exit(1); }
AMS.toast = () => {};
AMS.boot();
const t0 = Date.now();
function attempt(label, fn) {
  captured = [];
  try { fn(); } catch (e) { errors.push(label + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e)); return; }
  const real = captured.filter((m) => !/Warning: (useLayoutEffect|Each child in a list|A title element received an array|Encountered two children|A component is changing|validateDOMNesting|Received `(true|false)` for a non-boolean)/.test(m));
  if (real.length) errors.push(label + ' (console.error): ' + real[0]);
}
const roles = AMS.ROLES.map((r) => r.id);
let renders = 0;
const heroIds = () => [AMS.db.meta.heroAthleteId].concat(AMS.db.injuries.filter((i) => i.status !== 'Closed').slice(0, 3).map((i) => i.athleteId), AMS.db.athletes.filter((a) => a.sport === 'Boxing').slice(0, 1).map((a) => a.id));
for (const role of roles) {
  AMS.ui.role = role; AMS.ui.scope = {};
  for (const m of AMS.modules) {
    if (!mine(m.__file)) continue;
    if (m.roles && !m.roles.includes(role)) continue;
    for (const p of (m.sampleParams || [{}])) attempt(`module ${m.id} as ${role} ${JSON.stringify(p)}`, () => { renderToString(html`<${m.component} params=${p} />`); renders++; });
  }
  for (const [type, reg] of Object.entries(AMS.drawers)) {
    if (!mine(reg.__file)) continue;
    for (const s of (reg.sample ? [].concat(reg.sample()) : [{}])) attempt(`drawer ${type} as ${role} ${JSON.stringify(s)}`, () => { renderToString(html`<${reg.component} ...${s} />`); renders++; });
  }
  for (const [type, reg] of Object.entries(AMS.modals)) {
    if (!mine(reg.__file)) continue;
    for (const s of (reg.sample ? [].concat(reg.sample()) : [{}])) attempt(`modal ${type} as ${role} ${JSON.stringify(s)}`, () => { renderToString(html`<${reg.component} ...${s} />`); renders++; });
  }
  for (const t of AMS.athleteTabs) {
    if (!mine(t.__file)) continue;
    if (t.roles && !t.roles.includes(role)) continue;
    for (const id of heroIds()) attempt(`athleteTab ${t.id} as ${role} (${id})`, () => { renderToString(html`<${t.component} athlete=${AMS.org.athlete(id)} />`); renders++; });
  }
  attempt(`ai.insights as ${role}`, () => { const ins = AMS.ai.insights(); ins.forEach((i) => { if (!i.id || !i.title || !i.severity || !Array.isArray(i.evidence || [])) throw new Error('bad insight ' + JSON.stringify(i).slice(0, 200)); (i.actions || []).forEach((a) => { if (!AMS.actions[a.action]) throw new Error('insight "' + i.title + '" uses unregistered action ' + a.action); }); }); });
  if (AMS.panels.copilot && mine(AMS.panels.__file_copilot)) attempt(`copilot panel as ${role}`, () => { renderToString(html`<${AMS.panels.copilot} />`); renders++; });
  if (!filter) attempt(`App shell as ${role}`, () => { renderToString(html`<${AMS.App} />`); renders++; });
}
// copilot engine
if (AMS.copilot && typeof AMS.copilot.respond === 'function' && mine(AMS.panels.__file_copilot || 'modules/copilot.js')) {
  for (const role of ['coach', 'director', 'physio', 'ops']) {
    AMS.ui.role = role;
    for (const q of ['who is at risk today?', 'how is Priya doing?', 'move red athletes to recovery', 'show injuries at Pune', 'summarise the week', 'compare centres', 'which documents are pending?', 'what is ACWR?', 'xyzzy nonsense']) {
      attempt(`copilot.respond("${q}") as ${role}`, () => { const r = AMS.copilot.respond(q, { route: { module: 'dashboard' }, focus: { athleteId: AMS.db.meta.heroAthleteId } }); if (!r || !r.text) throw new Error('empty response'); (r.actions || []).forEach((a) => { if (a.action && !AMS.actions[a.action]) throw new Error('copilot uses unregistered action ' + a.action); }); });
    }
  }
}
attempt('registries', () => { AMS.commands.forEach((c) => { if (typeof c.run !== 'function') throw new Error('command without run: ' + c.id); }); });
// self-tests: each on fresh seed data
for (const t of AMS.selfTests) {
  if (!mine(t.__file)) continue;
  AMS.db = AMS.buildSeed(); AMS.setUI({ role: t.role || 'director', scope: {}, drawers: [], modal: null, focus: {} }); // setUI bumps AMS.version so per-version caches reset
  attempt(`selfTest "${t.name}"`, () => { t.fn(); });
}

console.error = origErr;
console.log(`Smoke${filter ? ' [' + filter + ']' : ''}: ${renders} renders across ${roles.length} roles · modules [${AMS.modules.map((m) => m.id).join(', ')}] · ${Object.keys(AMS.drawers).length} drawers [${Object.keys(AMS.drawers).join(', ')}] · ${Object.keys(AMS.modals).length} modals [${Object.keys(AMS.modals).join(', ')}] · ${AMS.athleteTabs.length} athlete tabs · ${AMS.detectors.length} detectors · ${Object.keys(AMS.actions).length} actions · ${AMS.selfTests.length} self-tests · ${Date.now() - t0} ms`);
if (warnings.length) console.log('Warnings:\n' + warnings.join('\n'));
if (errors.length) { console.log('\nFAILURES (' + errors.length + '):\n' + [...new Set(errors)].slice(0, 40).join('\n')); process.exit(1); }
console.log('OK');
process.exit(0);
