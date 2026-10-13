// Debug harness: load the app in Node and run a snippet. Usage: node tools/dbg.js "<js>"
const path = require('path'), fs = require('fs'), vm = require('vm');
const { SCRIPTS, SRC } = require('./build.js');
const store = {};
Object.assign(global, { window: global, localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } }, location: { hash: '' }, history: { replaceState() {} }, document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), head: { appendChild() {} } }, __AMS_NO_MOUNT__: true });
global.React = require('./node_modules/react'); global.require = require; if (process.env.PRE) vm.runInThisContext(process.env.PRE); global.ReactDOM = require('./node_modules/react-dom'); global.htm = require('./node_modules/htm');
for (const f of SCRIPTS()) { try { vm.runInThisContext(fs.readFileSync(path.join(SRC, f), 'utf8'), { filename: f }); } catch (e) { console.log('LOAD FAIL', f, e.message); } }
AMS.toast = () => {}; AMS.boot();
const out = vm.runInThisContext('(function(){' + process.argv[2] + '})()');
if (out !== undefined) console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
process.exit(0);
