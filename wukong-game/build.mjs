// Concatenates src/00_head.html + all src/*.js (sorted) into dist/index.html
// EXCLUDE=20,30 node build.mjs  -> skips files whose name starts with those prefixes
import fs from 'fs'; import path from 'path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const src = path.join(dir, 'src');
const out = process.env.OUT || path.join(dir, 'dist', 'index.html');
const ex = (process.env.EXCLUDE || '').split(',').filter(Boolean);
const head = fs.readFileSync(path.join(src, '00_head.html'), 'utf8');
const files = fs.readdirSync(src).filter(f => f.endsWith('.js') && !ex.some(e => f.startsWith(e))).sort();
let js = '';
for (const f of files) js += `\n// ===== ${f} =====\n` + fs.readFileSync(path.join(src, f), 'utf8') + '\n';
fs.mkdirSync(path.dirname(out), { recursive: true });
const html = head + '\n<script type="module">\n' + js + '\n</script>\n';
fs.writeFileSync(out, html);
console.log('built', out, (html.length / 1024).toFixed(1) + ' KB', files.join(' '));
