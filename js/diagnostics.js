/* Diagnostics: a report about this PatOS that a person can read in full before copying or saving it.
   It holds what helps find a problem (versions, what the browser can do, the problems PatOS wrote down, the health of the
   files, backups and sync) and never what is private: no passwords, keys, sign-in tokens, messages, file names or contents,
   notes, or the user name. Error messages are cut short and any path or address in them is blanked. */
(function () {
  'use strict';
  const T = (s) => PatOS.t(s);
  // anything that looks like a path, an e-mail, a web address or a long token is blanked
  const scrub = (s) => String(s || '').slice(0, 200).replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '[email]').replace(/https?:\/\/\S+/g, '[address]').replace(/(\/[^\s/:]+){2,}/g, '[path]').replace(/\b[A-Za-z0-9_-]{24,}\b/g, '[id]');
  async function report() {
    const c = PatOS.fs.integrity ? await PatOS.fs.integrity.check() : null;
    const snaps = PatOS.backup ? await PatOS.backup.verifyAll() : [];
    const sync = PatOS.sync ? PatOS.sync.status() : null; const acct = PatOS.account ? PatOS.account.status() : null;
    let est = null; try { est = navigator.storage && (await navigator.storage.estimate()); } catch (e) {}
    const nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    return {
      made: new Date().toISOString(), patos: { version: PatOS.version, build: PatOS.build || null, lang: PatOS.lang, device: PatOS.isMobile ? 'phone layout' : 'desktop layout', safeBoot: !!PatOS.safeBoot },
      browser: { userAgent: navigator.userAgent, cores: navigator.hardwareConcurrency || null, memoryGB: navigator.deviceMemory || null, online: navigator.onLine !== false, indexedDB: !!PatOS.store.idb, serviceWorker: !!navigator.serviceWorker, webgl: !!document.createElement('canvas').getContext('webgl'), persisted: PatOS.backup && PatOS.backup.persist ? await PatOS.backup.persist.status() : null },
      measured: { startupMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null, jsHeapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, storageUsedMB: est ? Math.round((est.usage || 0) / 1048576) : null, storageQuotaMB: est ? Math.round((est.quota || 0) / 1048576) : null },
      files: { atStartup: PatOS.fs.integrity ? (({ state, problems }) => ({ state, problems: problems.map((p) => p.what) }))(PatOS.fs.integrity.load()) : null, check: c ? { ok: c.ok, files: c.files, folders: c.dirs, bigFiles: c.bigFiles, bigMissing: c.bigMissing, problems: c.problems.map((p) => p.what), ms: c.ms } : null, damagedCopiesKept: PatOS.fs.integrity ? PatOS.fs.integrity.damaged().length : 0 },
      backups: { snapshots: snaps.map((x) => ({ when: new Date(x.t).toISOString(), state: x.state })), autoSnapshots: PatOS.backup ? PatOS.backup.autoOn() : null },
      sync: sync ? { on: sync.on, mode: sync.mode || null, state: sync.state, error: scrub(sync.error), items: sync.items, rejected: sync.rejected } : null,
      account: acct ? { signedIn: acct.signedIn, state: acct.state } : null,
      apps: { installed: PatOS.appOrder.length, community: PatOS.patapps ? PatOS.patapps.list().map((x) => ({ id: x.id, version: x.app && x.app.version, source: x.source })) : [] },
      problems: PatOS.errors.list().slice(-40).map((e) => ({ when: new Date(e.t).toISOString(), severity: e.sev || 'error', category: e.cat || '', where: scrub(e.where), message: scrub(e.msg), recovered: e.recovered == null ? null : e.recovered, version: e.v || '' })),
      intelligence: PatOS.intel ? { actions: PatOS.intel.list().length, recent: PatOS.intel.history().slice(-10).map((x) => ({ id: x.id, ok: x.ok, status: x.status })) } : null
    };
  }
  /* shows the whole report; nothing leaves PatOS unless the person copies or saves it */
  function review(r) {
    const { h } = PatOS; const text = JSON.stringify(r, null, 2);
    const layer = h('div', { class: 'dlg-layer' }); const close = () => { layer.remove(); document.removeEventListener('keydown', esc, true); };
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    const pre = h('pre', { class: 'diag-pre', tabindex: '0', 'aria-label': T('The report') }, text);
    layer.appendChild(h('div', { class: 'dlg diag-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-label': T('Diagnostic report') }, h('b', {}, T('Diagnostic report')),
      h('p', {}, T('This is everything in the report. It has no passwords, keys, sign-in tokens, messages, file names or file contents.')), pre,
      h('div', { class: 'dlg-btns' }, h('button', { class: 'btn', onclick: close }, T('Close')), h('button', { class: 'btn', onclick: () => { try { navigator.clipboard.writeText(text); PatOS.notify({ title: T('Copied'), body: T('Diagnostic report'), icon: 'settings' }); } catch (e) {} } }, T('Copy')),
        h('button', { class: 'btn primary', onclick: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = 'PatOS-diagnostics-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); } }, T('Save…')))));
    document.addEventListener('keydown', esc, true); document.body.appendChild(layer); setTimeout(() => pre.focus(), 30);
    return layer;
  }
  PatOS.diagnostics = { report, review, scrub };
})();
