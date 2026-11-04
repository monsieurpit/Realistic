/* Per-app loading. Most apps only register themselves (a name, an icon, a window size, and the code that fills their window);
   there is no reason to read their code before someone opens them. This reads every app file in a sandbox (build time) and
   decides which ones are self-contained: those are marked type="patos/lazy" in index.html, and their name, icon, size and
   keywords go into js/appmeta.js, so Launchpad, the Dock and search know them without loading them. The first time one is
   opened, PatOS.launch loads its file (from the device's offline copy) and carries on.
   An app file stays eager (loaded at start) when it does anything else when it loads: sets something on PatOS, listens for
   events, starts a timer, touches the page, adds icons, or registers an app with functions other than launch/menus/onArgs.
   Usage: node scripts/appmeta.js [--apply]   (build.js runs it; without --apply it only reports) */
'use strict';
const fs = require('fs');
const path = require('path');
const util = require('util');
const ROOT = path.join(__dirname, '..');
const OK_FUNCS = new Set(['launch', 'menus', 'onArgs']); // the only functions an app definition may have (they live in the app's own file)
const PURE_CALLS = /^(?:PatOS\.(?:t|h|esc|uid|clamp|\$|\$\$|debounce|fmtBytes|dateKey|store\.get|store\.peek|store\.keys|apps|registerApp)|console\.\w+)$/;

function sandbox(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const effects = []; const defs = []; const icons = {}; const exported = [];
  const tag = (why) => { if (effects.length < 6) effects.push(why); };
  const mk = (p, root) => new Proxy(function () {}, {
    get(t, k) { if (k === Symbol.toPrimitive) return () => ''; if (k === Symbol.iterator) return function* () {}; if (k === 'then') return undefined; return mk(p + '.' + String(k), root); },
    apply() { if (!PURE_CALLS.test(p)) tag('calls ' + p + '()'); return mk(p + '()', root); },
    construct() { tag('new ' + p); return mk(p + '#', root); },
    set(t, k) { tag('sets ' + p + '.' + String(k)); return true; },
    deleteProperty() { tag('deletes on ' + p); return true; }, has() { return true; }
  });
  const patos = new Proxy({}, {
    get(t, k) {
      if (k === 'registerApp') return (def) => { defs.push(def); };
      if (k === 'iconDefs') return new Proxy({}, { set(tt, kk, vv) { icons[String(kk)] = vv; return true; }, get() { return mk('PatOS.iconDefs'); } });
      return mk('PatOS.' + String(k));
    },
    set(t, k) { exported.push(String(k)); return true; } // a helper other code may use: PatOS.theName is made to load this file when it is first used
  });
  const names = ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'location', 'screen', 'indexedDB', 'Notification', 'fetch', 'requestAnimationFrame', 'cancelAnimationFrame', 'addEventListener', 'removeEventListener', 'THREE', 'Image', 'Audio', 'AudioContext', 'webkitAudioContext', 'matchMedia', 'getComputedStyle', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'XMLHttpRequest', 'FileReader', 'Worker', 'WebSocket', 'MediaRecorder', 'DOMParser', 'HTMLElement', 'CSS', 'customElements', 'postMessage', 'alert', 'confirm', 'prompt', 'open', 'close', 'speechSynthesis'];
  const timers = ['setTimeout', 'setInterval', 'queueMicrotask', 'requestIdleCallback'];
  const args = ['PatOS'].concat(names, timers); const vals = [patos].concat(names.map((n) => mk(n)), timers.map((n) => (...a) => { tag('uses ' + n); return 0; }));
  let threw = null;
  try { new Function(...args, src)(...vals); } catch (e) { threw = e; }
  return { effects, defs, threw, icons, exported };
}
const clean = (v) => { try { if (util.types.isProxy(v) || typeof v === 'function') return false; if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) return true; if (Array.isArray(v)) return v.every(clean); if (typeof v === 'object') return Object.keys(v).every((k) => clean(v[k])); return false; } catch (e) { return false; } };

function analyze() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const files = [...html.matchAll(/<script type="patos\/(?:js|lazy)" src="(js\/apps\/[^"]+)"><\/script>/g)].map((m) => m[1]);
  const out = { lazy: [], eager: [], meta: [], order: [], icons: {}, exports: {}, lazyBytes: 0 };
  for (const f of files) {
    const r = sandbox(f); let why = r.threw ? 'throws when loaded (' + String(r.threw.message).slice(0, 60) + ')' : r.effects[0] || '';
    if (!why && !r.defs.length && !r.exported.length) why = 'registers no app and shares nothing';
    // a new icon is fine when it is the same picture every time (the picture is saved in js/appmeta.js)
    const icons = {};
    if (!why) for (const id of Object.keys(r.icons)) {
      const ic = r.icons[id]; try { const a1 = ic && typeof ic.svg === 'function' && ic.svg.length === 0 ? ic.svg() : null; const a2 = a1 && ic.svg(); if (typeof a1 === 'string' && a1 === a2 && typeof ic.bg === 'string' && Object.keys(ic).every((k) => k === 'bg' || k === 'svg')) icons[id] = { bg: ic.bg, svg: a1 }; else { why = 'has an icon (' + id + ') that changes'; break; } } catch (e) { why = 'has an icon (' + id + ') that fails'; break; }
    }
    const metas = [];
    if (!why) for (const d of r.defs) {
      const m = {}; let bad = '';
      for (const k of Object.keys(d)) {
        const v = d[k];
        if (typeof v === 'function') { if (!OK_FUNCS.has(k)) bad = 'has the function ' + k; continue; }
        if (!clean(v)) { bad = 'has a value of ' + k + ' that is not plain'; break; }
        m[k] = v;
      }
      if (!bad && typeof d.launch !== 'function') bad = 'has no launch()';
      if (!bad && (typeof m.id !== 'string' || typeof m.name !== 'string')) bad = 'has no plain id and name';
      if (bad) { why = bad; break; } metas.push(m);
    }
    r.defs.forEach((d) => { if (d && typeof d.id === 'string') out.order.push(d.id); });
    if (why) out.eager.push({ file: f, why, bytes: fs.statSync(path.join(ROOT, f)).size }); else { out.lazy.push(f); out.lazyBytes = (out.lazyBytes || 0) + fs.statSync(path.join(ROOT, f)).size; Object.assign(out.icons, icons); r.exported.forEach((k) => { if (!out.exports[k]) out.exports[k] = f; }); metas.forEach((m) => out.meta.push(Object.assign({}, m, { lazy: f }))); }
  }
  return out;
}
function generate(apply) {
  const a = analyze();
  const text = '/* generated by scripts/appmeta.js (node build.js): do not edit.\n   What Launchpad, the Dock and search need to know about the apps that load only when opened. */\n' +
    'PatOS.appRank = ' + JSON.stringify(a.order) + ';\n' + Object.keys(a.icons).map((id) => 'PatOS.iconDefs[' + JSON.stringify(id) + '] = { bg: ' + JSON.stringify(a.icons[id].bg) + ', svg: () => ' + JSON.stringify(a.icons[id].svg) + ' };\n').join('') + 'PatOS.lazyExports(' + JSON.stringify(a.exports) + ');\nPatOS.lazyApps(' + JSON.stringify(a.meta) + ');\n';
  if (apply) {
    fs.writeFileSync(path.join(ROOT, 'js', 'appmeta.js'), text);
    let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'); const lazy = new Set(a.lazy);
    html = html.replace(/<script type="patos\/(?:js|lazy)" src="(js\/apps\/[^"]+)"><\/script>/g, (m, f) => `<script type="patos/${lazy.has(f) ? 'lazy' : 'js'}" src="${f}"></script>`);
    if (!html.includes('js/appmeta.js')) html = html.replace('  <script type="patos/js" src="js/pat.js"></script>', '  <script type="patos/js" src="js/pat.js"></script>\n  <script type="patos/js" src="js/appmeta.js"></script>');
    fs.writeFileSync(path.join(ROOT, 'index.html'), html);
  }
  return { analysis: a, text };
}
module.exports = { analyze, generate };
if (require.main === module) {
  const r = generate(process.argv.includes('--apply')); const a = r.analysis;
  console.log('helpers that load their file when first used: ' + Object.keys(a.exports).length);
  console.log('load on demand: ' + a.lazy.length + ' files (' + Math.round(a.lazyBytes / 1024) + ' KB), loaded at start: ' + a.eager.length + ' files (' + Math.round(a.eager.reduce((n, e) => n + e.bytes, 0) / 1024) + ' KB)');
  a.eager.forEach((e) => console.log('  eager  ' + e.file + '  (' + e.why + ')'));
}
