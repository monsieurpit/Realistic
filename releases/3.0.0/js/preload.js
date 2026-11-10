/* PatOS preloader: opens the browser database (IndexedDB), loads every saved setting and file into
   memory, moves old localStorage data over once, then starts PatOS. This is what lets PatOS keep
   gigabytes of files instead of the 5 MB that localStorage allows. */
(function () {
  'use strict';
  // Chrome may offer to install PatOS before the rest of PatOS has loaded; keep that offer for later
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); window.__installPrompt = e; });

  /* Update safety. Each start is written down, and PatOS marks it finished once the lock screen shows.
     A start that stayed alive more than 15 seconds without finishing counts as a failed start. After two
     failed starts in a row, the service worker is asked to go back to the version that worked before. */
  (function () {
    var KEY = 'patos-boot', st = {};
    try { st = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { st = {}; }
    var failed = st.pending && st.alive && st.alive - st.t > 15000;
    st.fails = failed ? (st.fails || 0) + 1 : (st.pending ? st.fails || 0 : 0);
    st.pending = true; st.t = Date.now(); st.alive = st.t;
    var save = function () { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
    save();
    var timer = setInterval(function () { if (!st.pending) return clearInterval(timer); st.alive = Date.now(); save(); }, 2000);
    window.__patosBootOK = function () {
      st.pending = false; st.fails = 0; save(); clearInterval(timer);
      var rolled = st.rolledBack; if (rolled) { st.rolledBack = false; save(); }
      return rolled;
    };
    if (st.fails >= 2 && navigator.serviceWorker && navigator.serviceWorker.controller && window.MessageChannel) {
      var ch = new MessageChannel();
      ch.port1.onmessage = function (e) { if (e.data && e.data.ok && e.data.useOld) { st.fails = 0; st.pending = false; st.rolledBack = true; save(); location.reload(); } };
      navigator.serviceWorker.controller.postMessage({ patosRollback: true }, [ch.port2]);
    }
  })();
  var started = false;
  function start() {
    if (started) return; started = true;
    var list = [].slice.call(document.querySelectorAll('script[type="patos/js"]'));
    list.forEach(function (el) {
      var s = document.createElement('script');
      if (el.getAttribute('src')) { s.src = el.getAttribute('src'); s.async = false; } else s.text = el.textContent;
      document.body.appendChild(s);
    });
  }
  function open(cb) {
    try {
      var r = indexedDB.open('patos', 2);
      r.onupgradeneeded = function () { var d = r.result; ['kv', 'fc', 'blobs', 'handles'].forEach(function (n) { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); }); };
      r.onsuccess = function () { cb(r.result); };
      r.onerror = r.onblocked = function () { cb(null); };
    } catch (e) { cb(null); }
  }
  function readAll(db, store, cb) {
    var out = Object.create(null);
    try {
      var tx = db.transaction(store, 'readonly'), c = tx.objectStore(store).openCursor();
      c.onsuccess = function () { var cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } };
      tx.oncomplete = function () { cb(out); }; tx.onerror = tx.onabort = function () { cb(out); };
    } catch (e) { cb(out); }
  }
  var ls = null; try { ls = window.localStorage; } catch (e) {}
  function go() {
    open(function (db) {
      if (!db) { window.__KV = null; return start(); }
      readAll(db, 'kv', function (kv) {
        readAll(db, 'fc', function (fc) {
          window.__IDB = db; window.__KV = kv; window.__FC = fc;
          // one-time move of the old localStorage data into the database
          if (ls && !Object.keys(kv).length) {
            var moved = [];
            try { for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k.indexOf('patos:') === 0) { try { kv[k.slice(6)] = JSON.parse(ls.getItem(k)); moved.push(k); } catch (e) {} } } } catch (e) {}
            window.__MIGRATE = moved;
          }
          // changes that were still being saved when PatOS last closed (see journal() in core.js)
          var J = null; try { J = ls && ls.getItem('patos-journal'); } catch (e) {}
          if (J) {
            try {
              var j = JSON.parse(J), tx = db.transaction(['kv', 'fc'], 'readwrite'), kvs = tx.objectStore('kv'), fcs = tx.objectStore('fc');
              Object.keys(j.s || {}).forEach(function (k) { kv[k] = j.s[k]; kvs.put(j.s[k], k); });
              (j.d || []).forEach(function (k) { delete kv[k]; kvs.delete(k); });
              Object.keys(j.f || {}).forEach(function (k) { fc[k] = j.f[k]; fcs.put(j.f[k], k); });
              (j.fd || []).forEach(function (k) { delete fc[k]; fcs.delete(k); });
              tx.oncomplete = function () { try { ls.removeItem('patos-journal'); } catch (e) {} };
            } catch (e) { try { ls.removeItem('patos-journal'); } catch (e2) {} }
          }
          start();
        });
      });
    });
  }
  setTimeout(function () { if (!started) { window.__KV = null; start(); } }, 6000);
  // "Erase PatOS" asks for a clean start
  if (ls && ls.getItem('patos-wipe')) {
    try { ls.removeItem('patos-wipe'); ls.removeItem('patos-journal'); Object.keys(ls).filter(function (k) { return k.indexOf('patos:') === 0; }).forEach(function (k) { ls.removeItem(k); }); } catch (e) {}
    try { var d = indexedDB.deleteDatabase('patos'); d.onsuccess = d.onerror = d.onblocked = go; } catch (e) { go(); }
  } else go();
})();
