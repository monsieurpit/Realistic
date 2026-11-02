/* Builds dist/PatOS.html: the whole OS (including three.js) in ONE file.
   Use it as a Claude Artifact, or download it and open it on a Chromebook with no internet. */
const fs = require('fs');
const path = require('path');
const root = __dirname;
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
// inline stylesheets
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => `<style>\n${read(href)}\n</style>`);
// inline scripts (escape any closing script tags inside the code)
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => `<script>\n${read(src).replace(/<\/script/gi, '<\\/script')}\n</script>`);
// inline the icon, drop the manifest (single-file mode)
const icon = 'data:image/svg+xml;base64,' + Buffer.from(read('assets/icon.svg')).toString('base64');
const touch = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'assets/icon-180.png')).toString('base64');
html = html.replace(/<link rel="apple-touch-icon"[^>]*>/, `<link rel="apple-touch-icon" href="${touch}">`);
html = html.replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${icon}">`).replace(/<link rel="manifest"[^>]*>\n?/, '');
html = html.replace('<html lang="en" data-theme="dark">', '<html lang="en" data-theme="dark" data-single-file="1">');
html = html.replace('<link rel="stylesheet"', '<link rel="stylesheet"').replace('<body>', '<body>\n  <script>window.PATOS_SINGLE_FILE = 1;</script>');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'PatOS.html'), html);
console.log('Built dist/PatOS.html (' + (html.length / 1024 / 1024).toFixed(2) + ' MB)');

// Claude Artifact version: the artifact host adds its own <!doctype>/<html>/<head>/<body>, so emit just the contents.
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
const art = head.trim() + '\n<style>html,body{height:100%;margin:0;overflow:hidden}</style>\n' + body.trim() + '\n';
fs.writeFileSync(path.join(root, 'dist', 'artifact.html'), art);
console.log('Built dist/artifact.html (' + (art.length / 1024 / 1024).toFixed(2) + ' MB)');
