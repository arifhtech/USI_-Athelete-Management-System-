// Build: inline src/* into dist/index.html (standalone, host anywhere) and dist/artifact.html (fragment for claude.ai Artifact).
// Usage: node tools/build.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const MODULE_ORDER = ['dashboard', 'athletes', 'training', 'medical', 'science', 'nutrition', 'assessments', 'analytics', 'copilot', 'athlete-app'];

function moduleFiles() {
  const dir = path.join(SRC, 'modules');
  const all = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
  const rank = (f) => { const i = MODULE_ORDER.indexOf(f.replace(/\.js$/, '')); return i < 0 ? 99 : i; };
  return all.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map((f) => 'modules/' + f);
}
const SCRIPTS = () => ['core.js', 'data.js', 'ui.js', 'shell.js', ...moduleFiles(), 'app.js'];
module.exports = { SCRIPTS, SRC };

const HEAD = `<title>USI Athlete Management</title>
<meta name="description" content="AI-native Athlete Management System prototype for the Unified Sports Interface">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">`;
const LIBS = `<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js"></script>`;

if (require.main === module) {
  const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');
  const js = SCRIPTS().map((f) => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(SRC, f), 'utf8').replace(/<\/script/gi, '<\\/script')).join('\n');
  const body = `<div id="root"></div>\n${LIBS}\n<script>\n${js}\n</script>`;
  const fragment = `${HEAD}\n<style>\n${css}\n</style>\n${body}\n`;
  const full = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${HEAD}\n<style>\n${css}\n</style>\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
  fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'dist', 'index.html'), full);
  fs.writeFileSync(path.join(ROOT, 'dist', 'artifact.html'), fragment);
  // dev page that loads source files directly
  const dev = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${HEAD}\n<link rel="stylesheet" href="styles.css">\n</head>\n<body>\n<div id="root"></div>\n${LIBS}\n${SCRIPTS().map((f) => `<script src="${f}"></script>`).join('\n')}\n</body>\n</html>\n`;
  fs.writeFileSync(path.join(SRC, 'index.html'), dev);
  console.log('Built dist/index.html (' + Math.round(full.length / 1024) + ' KB) with', SCRIPTS().length, 'scripts:', SCRIPTS().join(', '));
}
