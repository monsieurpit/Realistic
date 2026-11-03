/* Real Python in PatOS (Pyodide, which is CPython compiled for the browser). It runs in a Worker, so a
   loop that never ends can't freeze PatOS, and Stop really stops it. input() works through the service
   worker. Files in Documents, Desktop and Downloads are copied in before a run, and new or changed files are
   copied back out. */
(function () {
  'use strict';
  const CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
  const WORKER = `
    let py = null, base = '', runId = '';
    const post = (type, data) => postMessage({ type, data });
    async function init() {
      importScripts(base + 'pyodide.js');
      py = await loadPyodide({ indexURL: base });
      py.setStdin({ stdin: () => {
        post('need-input'); const x = new XMLHttpRequest();
        try { x.open('GET', self.location.origin + '/__stdin/' + runId + '?t=' + Date.now(), false); x.send(); } catch (e) { return null; }
        return x.status === 200 ? x.responseText : null;
      } });
      const dec = new TextDecoder(), dec2 = new TextDecoder();
      py.setStdout({ write: (b) => { post('out', dec.decode(b, { stream: true })); return b.length; } });
      py.setStderr({ write: (b) => { post('err', dec2.decode(b, { stream: true })); return b.length; } });
    }
    const cleanTrace = (m) => String(m).split('\\n').filter((l, i, a) => !/_pyodide|pyodide\\/|\\/lib\\/python3\\d+\\.zip\\/_|importlib/.test(l)).join('\\n').replace(/^PythonError: /, '').trim();
    onmessage = async (e) => {
      const m = e.data;
      try {
        if (m.type === 'init') { base = m.base; post('status', 'Starting Python…'); await init(); post('ready'); return; }
        if (m.type === 'run') {
          runId = m.id; post('status', 'Running…');
          try { py.FS.mkdirTree('/PatOS/Documents'); } catch (e2) {}
          const before = {};
          for (const [p, c] of Object.entries(m.files || {})) { const full = '/PatOS' + p; try { py.FS.mkdirTree(full.slice(0, full.lastIndexOf('/'))); py.FS.writeFile(full, c); before[full] = c; } catch (e3) {} }
          py.runPython("import os, sys; os.chdir('/PatOS/Documents'); sys.argv = ['" + String(m.name || 'main.py').replace(/'/g, '') + "']");
          let ok = true;
          try {
            await py.loadPackagesFromImports(m.code, { messageCallback: (t) => post('status', t), errorCallback: (t) => post('err', t + '\\n') });
            post('status', 'Running…');
            await py.runPythonAsync(m.code);
          } catch (err) { ok = false; post('err', cleanTrace(err && err.message ? err.message : err) + '\\n'); }
          const changed = {};
          (function walk(dir) { let names = []; try { names = py.FS.readdir(dir); } catch (e4) {} names.forEach((n) => { if (n === '.' || n === '..') return; const full = dir + '/' + n; let st; try { st = py.FS.stat(full); } catch (e5) { return; } if (py.FS.isDir(st.mode)) walk(full); else { try { const d = py.FS.readFile(full, { encoding: 'utf8' }); if (before[full] !== d && d.length < 2000000) changed[full.slice(6)] = d; } catch (e6) {} } }); })('/PatOS');
          post('done', { ok, changed }); return;
        }
      } catch (err) { post('fatal', String(err && err.message || err)); }
    };`;
  let worker = null, ready = null, runInfo = null, uid = 0;
  const handlers = { out: null, err: null, status: null, input: null };

  async function baseURL() {
    const srv = PatOS.server && !PatOS.sandboxed ? await PatOS.server() : null;
    return srv ? srv + '/pyodide/' : CDN;
  }
  function start() {
    if (ready) return ready;
    ready = (async () => {
      const base = await baseURL();
      const url = URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' }));
      worker = new Worker(url);
      await new Promise((res, rej) => {
        const to = setTimeout(() => rej(new Error('Python took too long to start. Your network may be blocking it.')), 90000);
        worker.onmessage = (e) => {
          const m = e.data;
          if (m.type === 'ready') { clearTimeout(to); res(); }
          else if (m.type === 'status' && handlers.status) handlers.status(m.data);
          else if (m.type === 'fatal') { clearTimeout(to); rej(new Error(m.data)); }
        };
        worker.onerror = (e) => { clearTimeout(to); rej(new Error(e.message || 'Python couldn’t start.')); };
        worker.postMessage({ type: 'init', base });
      });
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'out') handlers.out && handlers.out(m.data);
        else if (m.type === 'err') handlers.err && handlers.err(m.data);
        else if (m.type === 'status') handlers.status && handlers.status(m.data);
        else if (m.type === 'need-input') handlers.input && handlers.input();
        else if (m.type === 'done' && runInfo) { const r = runInfo; runInfo = null; r.res(m.data); }
        else if (m.type === 'fatal' && runInfo) { const r = runInfo; runInfo = null; r.rej(new Error(m.data)); }
      };
      return worker;
    })().catch((e) => { ready = null; if (worker) { worker.terminate(); worker = null; } throw e; });
    return ready;
  }
  function collectFiles() {
    const files = {}; let n = 0, total = 0;
    ['/Documents', '/Desktop', '/Downloads'].forEach((d) => PatOS.fs.walk(d, (p, node) => {
      if (node.type === 'dir' || node.blob || n > 250) return; const ext = PatOS.fs.ext(p);
      if (/^(txt|md|py|csv|json|js|html?|css|xml|log|yml|yaml)$/.test(ext) && typeof node.content === 'string' && !node.content.startsWith('data:') && node.content.length < 1e6 && total < 6e6) { files[p] = node.content; n++; total += node.content.length; }
    }));
    return files;
  }
  async function run(code, opts) {
    opts = opts || {}; Object.assign(handlers, { out: opts.onOut, err: opts.onErr, status: opts.onStatus, input: opts.onInput });
    if (opts.onStatus) opts.onStatus(worker ? '' : 'Loading Python (first time takes a moment)…');
    await start();
    const id = 'r' + (++uid) + Date.now().toString(36);
    runInfo = { id };
    const done = new Promise((res, rej) => { runInfo.res = res; runInfo.rej = rej; });
    runInfo.sid = id;
    worker.postMessage({ type: 'run', id, code, name: opts.name, files: opts.files || collectFiles() });
    const r = await done; runInfo = null;
    if (opts.onStatus) opts.onStatus('');
    // bring new and changed files back into PatOS
    const written = [];
    if (opts.writeBack !== false) Object.entries(r.changed || {}).forEach(([p, c]) => { try { const dir = PatOS.fs.dirname(p); if (!PatOS.fs.exists(dir)) { let acc = ''; dir.split('/').filter(Boolean).forEach((seg) => { acc += '/' + seg; if (!PatOS.fs.exists(acc)) PatOS.fs.mkdir(acc); }); } PatOS.fs.write(p, c); written.push(p); } catch (e) {} });
    return { ok: r.ok, written };
  }
  function sendInput(text) {
    const id = runInfo && runInfo.id; if (!id) return;
    const msg = { patosStdin: 1, id, text: text == null ? null : String(text) + '\n' };
    if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage(msg);
  }
  function stop() {
    if (runInfo) { try { sendInput(null); } catch (e) {} const r = runInfo; runInfo = null; r.rej && r.rej(new Error('Stopped.')); }
    if (worker) { worker.terminate(); worker = null; } ready = null;
  }
  PatOS.python = {
    run, stop, sendInput,
    get busy() { return !!runInfo; },
    get loaded() { return !!worker; },
    canInput: () => !!(navigator.serviceWorker && navigator.serviceWorker.controller),
    preload: () => start().catch(() => {})
  };
})();
