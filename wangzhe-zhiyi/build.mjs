// 构建：把 src 下的样式、结构与脚本内联成单文件
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const src = f => readFileSync(join(root, 'src', f), 'utf8');
const js = ['data.js', 'art.js', 'combat.js', 'game.js', 'audio.js', 'render.js', 'ui.js', 'main.js'].map(src).join('\n');
const head = `<title>王者之弈</title>
<meta name="description" content="王者荣耀 IP 自走棋战棋：召集英雄、排兵布阵、羁绊升星，八人对局与风暴龙王挑战。">
<style>
${src('fonts.css')}
${src('style.css')}
</style>`;
const body = `${src('shell.html')}
<script>
${js}
</script>`;
mkdirSync(join(root, 'dist'), { recursive: true });
// Artifact 版本：由平台补全 <html>/<head>/<body>
writeFileSync(join(root, 'dist', 'artifact.html'), head + '\n' + body + '\n');
// 独立版本：完整 HTML 文档，可直接部署到任意静态托管 / CDN
writeFileSync(join(root, 'dist', 'index.html'), `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
${head}
</head>
<body>
${body}
</body>
</html>
`);
console.log('built', (readFileSync(join(root, 'dist', 'index.html')).length / 1024).toFixed(1) + ' KB');
