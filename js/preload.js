/* PatOS preloader: opens the browser database (IndexedDB), loads every saved setting and file into
   memory, moves old localStorage data over once, then starts PatOS. This is what lets PatOS keep
   gigabytes of files instead of the 5 MB that localStorage allows. */
(function () {
  'use strict';
  // Chrome may offer to install PatOS before the rest of PatOS has loaded; keep that offer for later
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); window.__installPrompt = e; });
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
          start();
        });
      });
    });
  }
  setTimeout(function () { if (!started) { window.__KV = null; start(); } }, 6000);
  // "Erase PatOS" asks for a clean start
  if (ls && ls.getItem('patos-wipe')) {
    try { ls.removeItem('patos-wipe'); Object.keys(ls).filter(function (k) { return k.indexOf('patos:') === 0; }).forEach(function (k) { ls.removeItem(k); }); } catch (e) {}
    try { var d = indexedDB.deleteDatabase('patos'); d.onsuccess = d.onerror = d.onblocked = go; } catch (e) { go(); }
  } else go();
})();
