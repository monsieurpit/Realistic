/* Device Lab: tries every part of the PatOS App SDK and reports what worked.
   Storage, window and theme need no permission. Files, notifications, clipboard, camera, microphone, location and internet each
   ask the first time (and can be changed in Settings > Privacy). */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var PERMS = ['files', 'notifications', 'clipboard', 'camera', 'microphone', 'location', 'network'];
  var LABEL = { files: 'Files', notifications: 'Notifications', clipboard: 'Clipboard', camera: 'Camera', microphone: 'Microphone', location: 'Location', network: 'Internet' };
  var state = {}; // what each permission did the last time it was used: 'ok', 'no' (refused) or undefined
  var report = [], last = { photo: null, audio: null, coords: null };

  /* ----- small helpers ----- */
  function out(sel, text, kind) { var e = $(sel); e.textContent = text == null ? '' : String(text); e.className = 'out' + (kind ? ' ' + kind : ''); }
  function say(sel, v) { out(sel, typeof v === 'string' ? v : JSON.stringify(v, null, 2), 'ok'); }
  function fail(sel, e) { out(sel, e && e.message ? e.message : String(e), 'err'); }
  function kb(n) { return (n / 1024).toFixed(1) + ' KB'; }
  function stamp() { return new Date().toLocaleTimeString(); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function busy(btn, on) { if (btn) btn.disabled = !!on; }

  /* what each permission did: shown as colored chips at the top */
  function drawPerms() {
    var box = $('#perms'); box.textContent = '';
    PERMS.forEach(function (p) {
      var c = document.createElement('span'); c.className = 'chip ' + (state[p] === 'ok' ? 'ok' : state[p] === 'no' ? 'no' : 'warn');
      var dot = document.createElement('i'); c.appendChild(dot); c.appendChild(document.createTextNode(LABEL[p] + ': ' + (state[p] === 'ok' ? 'works' : state[p] === 'no' ? 'refused' : 'not tried yet')));
      box.appendChild(c);
    });
  }
  /* every action goes through here: it records the result, and notes whether the permission was given or refused */
  function track(perm, name, fn) {
    return Promise.resolve().then(fn).then(function (v) {
      if (perm) state[perm] = 'ok'; note(name, true, ''); drawPerms(); return v;
    }, function (e) {
      var m = e && e.message ? e.message : String(e);
      if (perm && /did not (allow|ask)|not allowed/i.test(m)) state[perm] = 'no';
      note(name, false, m); drawPerms(); throw e;
    });
  }
  function note(name, ok, detail) {
    report.push({ name: name, ok: ok, detail: detail, t: stamp() });
    if (report.length > 200) report.shift();
    var ol = $('#report'); ol.textContent = '';
    report.forEach(function (r) {
      var li = document.createElement('li'); li.className = r.ok ? 'ok' : 'no'; li.appendChild(document.createTextNode((r.ok ? 'Works: ' : 'Failed: ') + r.name + ' '));
      var s = document.createElement('small'); s.textContent = r.t + (r.detail ? ' - ' + r.detail : ''); li.appendChild(s); ol.appendChild(li);
    });
    patos.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''), !ok);
  }
  function reportText() {
    return 'Device Lab report ' + new Date().toLocaleString() + '\n' + report.map(function (r) { return (r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.detail ? ' - ' + r.detail : ''); }).join('\n');
  }
  function listen(id, fn) {
    var b = $(id); b.addEventListener('click', function () {
      busy(b, true); Promise.resolve().then(function () { return fn(b); }).catch(function () {}).then(function () { busy(b, false); });
    });
  }

  /* ----- storage ----- */
  var S = {
    set: function () { var k = $('#sKey').value.trim(), v = $('#sVal').value; if (!k) throw new Error('Type a key first.'); return patos.storage.set(k, v).then(function () { return 'Saved "' + k + '".'; }); },
    get: function () { var k = $('#sKey').value.trim(); return patos.storage.get(k).then(function (v) { return v === null ? 'Nothing is saved under "' + k + '".' : '"' + k + '" = ' + JSON.stringify(v); }); },
    remove: function () { var k = $('#sKey').value.trim(); return patos.storage.remove(k).then(function () { return 'Removed "' + k + '".'; }); },
    keys: function () { return patos.storage.keys().then(function (l) { return l.length ? 'Keys: ' + l.join(', ') : 'No keys yet.'; }); },
    clear: function () { return patos.storage.clear().then(function () { return 'Everything was cleared.'; }); }
  };
  ['set', 'get', 'remove', 'keys', 'clear'].forEach(function (n) {
    listen('#s' + n[0].toUpperCase() + n.slice(1), function () { return track(null, 'storage.' + n, S[n]).then(function (m) { say('#sOut', m); }, function (e) { fail('#sOut', e); }); });
  });

  /* ----- files ----- */
  function showFiles(list, dir) {
    var box = $('#fFiles'); box.textContent = '';
    list.forEach(function (f) {
      var b = document.createElement('button'); b.textContent = ''; var a = document.createElement('span'); a.textContent = (f.folder ? '[folder] ' : '') + f.name; var s = document.createElement('small'); s.textContent = f.folder ? '' : kb(f.size); b.appendChild(a); b.appendChild(s);
      b.onclick = function () { $('#fName').value = (dir ? dir + '/' : '') + f.name; if (f.folder) { $('#fDir').value = (dir ? dir + '/' : '') + f.name; $('#fList').click(); } else $('#fOpen').click(); };
      box.appendChild(b);
    });
  }
  function fname() { var n = $('#fName').value.trim(); if (!n) throw new Error('Type a file name first.'); return n; }
  listen('#fSave', function () { return track('files', 'files.write', function () { return patos.files.write(fname(), $('#fText').value); }).then(function () { say('#fOut', 'Saved ' + fname() + ' (' + kb($('#fText').value.length) + ').'); $('#fList').click(); }, function (e) { fail('#fOut', e); }); });
  listen('#fOpen', function () { return track('files', 'files.read', function () { return patos.files.read(fname()); }).then(function (t) { if (t === null) return say('#fOut', 'There is no file called ' + fname() + '.'); $('#fText').value = t; say('#fOut', 'Opened ' + fname() + ' (' + kb(t.length) + ').'); }, function (e) { fail('#fOut', e); }); });
  listen('#fDelete', function () { return track('files', 'files.remove', function () { return patos.files.remove(fname()); }).then(function () { say('#fOut', 'Deleted ' + fname() + '.'); $('#fList').click(); }, function (e) { fail('#fOut', e); }); });
  listen('#fList', function () {
    var dir = $('#fDir').value.trim(); return track('files', 'files.list', function () { return patos.files.list(dir); }).then(function (l) { showFiles(l, dir); say('#fOut', l.length ? l.length + ' item(s) in ' + (dir || 'the app folder') + '.' : 'Nothing in ' + (dir || 'the app folder') + ' yet.'); }, function (e) { fail('#fOut', e); });
  });

  /* ----- notifications ----- */
  function notify(n) { return patos.notify({ title: $('#nTitle').value || 'Device Lab', body: ($('#nBody').value || 'Test') + (n ? ' (' + n + ')' : '') }); }
  listen('#nNow', function () { return track('notifications', 'notify (now)', function () { return notify(); }).then(function () { say('#nOut', 'Sent. Look at the top right of PatOS.'); }, function (e) { fail('#nOut', e); }); });
  listen('#nLater', function () {
    var left = 5; out('#nOut', 'Sending in ' + left + '...', ''); var t = setInterval(function () { left--; if (left > 0) out('#nOut', 'Sending in ' + left + '...', ''); }, 1000);
    return wait(5000).then(function () { clearInterval(t); return track('notifications', 'notify (after 5 seconds)', function () { return notify(); }); }).then(function () { say('#nOut', 'Sent after 5 seconds.'); }, function (e) { clearInterval(t); fail('#nOut', e); });
  });
  listen('#nThree', function () { return track('notifications', 'notify (3 in a row)', function () { return notify(1).then(function () { return wait(600); }).then(function () { return notify(2); }).then(function () { return wait(600); }).then(function () { return notify(3); }); }).then(function () { say('#nOut', 'Sent 3 notifications.'); }, function (e) { fail('#nOut', e); }); });

  /* ----- clipboard ----- */
  listen('#cCopy', function () { return track('clipboard', 'clipboard.write', function () { return patos.clipboard.write($('#cText').value); }).then(function () { say('#cOut', 'Copied. Paste it anywhere to check.'); }, function (e) { fail('#cOut', e); }); });
  listen('#cPaste', function () { return track('clipboard', 'clipboard.read', function () { return patos.clipboard.read(); }).then(function (t) { $('#cText').value = t; say('#cOut', 'Pasted ' + t.length + ' character(s) into the box above.'); }, function (e) { fail('#cOut', e); }); });

  /* ----- camera ----- */
  function drawGallery() {
    return patos.files.list('photos').then(function (l) {
      var g = $('#gallery'); g.textContent = ''; var files = l.filter(function (f) { return !f.folder; }).slice(-6);
      return files.reduce(function (p, f) { return p.then(function () { return patos.files.read('photos/' + f.name).then(function (d) { if (!d) return; var i = document.createElement('img'); i.src = d; i.title = f.name; i.onclick = function () { var big = $('#camImg'); big.src = d; big.hidden = false; }; g.appendChild(i); }); }); }, Promise.resolve());
    }).catch(function () {});
  }
  listen('#camSnap', function () {
    out('#camOut', 'Asking the camera...', ''); return track('camera', 'camera.snapshot', function () { return patos.camera.snapshot(); }).then(function (d) {
      last.photo = d; var i = $('#camImg'); i.src = d; i.hidden = false; $('#camSave').disabled = false; say('#camOut', 'Got a picture (' + kb(d.length * 0.75) + ').');
    }, function (e) { fail('#camOut', e); });
  });
  listen('#camSave', function () {
    if (!last.photo) return; var n = 'photos/photo-' + Date.now() + '.jpg';
    return track('files', 'files.write (photo)', function () { return patos.files.write(n, last.photo); }).then(function () { say('#camOut', 'Saved ' + n); return drawGallery(); }, function (e) { fail('#camOut', e); });
  });

  /* ----- microphone ----- */
  listen('#micRec', function () {
    var ms = +$('#micSecs').value, bar = $('#micBar'), t0 = Date.now(); out('#micOut', 'Recording... speak now.', ''); bar.style.width = '0%';
    var tick = setInterval(function () { bar.style.width = Math.min(100, (Date.now() - t0) / ms * 100) + '%'; }, 200);
    return track('microphone', 'microphone.record (' + ms / 1000 + ' s)', function () { return patos.microphone.record(ms); }).then(function (d) {
      clearInterval(tick); bar.style.width = '100%'; last.audio = d; var a = $('#micAudio'); a.src = d; a.hidden = false; $('#micSave').disabled = false; say('#micOut', 'Recorded ' + kb(d.length * 0.75) + '. Press play to hear it.');
    }, function (e) { clearInterval(tick); bar.style.width = '0%'; fail('#micOut', e); });
  });
  listen('#micSave', function () {
    if (!last.audio) return; var n = 'audio/recording-' + Date.now() + '.txt';
    return track('files', 'files.write (recording)', function () { return patos.files.write(n, last.audio); }).then(function () { say('#micOut', 'Saved ' + n + ' (the sound as a data: address).'); }, function (e) { fail('#micOut', e); });
  });

  /* ----- location ----- */
  function drawLoc(p) {
    var s = $('#locStat'); s.textContent = [['Latitude', p.lat.toFixed(5)], ['Longitude', p.lon.toFixed(5)], ['Accuracy', Math.round(p.accuracy) + ' m']].map(function (x) { return x[0] + ': ' + x[1]; }).join('   ');
  }
  listen('#locGet', function () {
    out('#locOut', 'Finding you (up to 15 seconds)...', ''); return track('location', 'location.get', function () { return patos.location.get(); }).then(function (p) {
      last.coords = p; drawLoc(p); $('#locCopy').disabled = false; $('#locPlace').disabled = false; say('#locOut', 'Found at ' + stamp() + '.');
    }, function (e) { fail('#locOut', e); });
  });
  listen('#locCopy', function () {
    if (!last.coords) return; var t = last.coords.lat.toFixed(5) + ', ' + last.coords.lon.toFixed(5);
    return track('clipboard', 'clipboard.write (coordinates)', function () { return patos.clipboard.write(t); }).then(function () { say('#locOut', 'Copied ' + t); }, function (e) { fail('#locOut', e); });
  });
  listen('#locPlace', function () {
    if (!last.coords) return; var u = 'https://nominatim.openstreetmap.org/reverse?format=json&zoom=14&lat=' + last.coords.lat + '&lon=' + last.coords.lon;
    return track('network', 'internet (place name)', function () { return fetch(u).then(function (r) { if (!r.ok) throw new Error('The place service said ' + r.status + '.'); return r.json(); }); }).then(function (j) { say('#locOut', 'Near: ' + (j.display_name || 'somewhere')); }, function (e) { fail('#locOut', e); });
  });

  /* ----- internet ----- */
  function showOnline() { var c = $('#online'); var on = navigator.onLine; c.className = 'chip ' + (on ? 'ok' : 'no'); c.textContent = ''; var d = document.createElement('i'); c.appendChild(d); c.appendChild(document.createTextNode(on ? 'Online' : 'Offline')); }
  window.addEventListener('online', showOnline); window.addEventListener('offline', showOnline);
  function get(url) {
    var t0 = performance.now(); return fetch(url).then(function (r) { return r.text().then(function (t) { return { status: r.status, ms: Math.round(performance.now() - t0), type: r.headers.get('content-type') || '', text: t }; }); });
  }
  function showGet(res) { say('#uOut', res.status + ' in ' + res.ms + ' ms (' + res.type.split(';')[0] + ')\n\n' + res.text.slice(0, 700) + (res.text.length > 700 ? '\n... (' + res.text.length + ' characters)' : '')); }
  function netFail(e) { fail('#uOut', /Failed to fetch|NetworkError|Load failed/i.test(e && e.message) ? 'Could not reach it. Check the address starts with https://, that you are online, and that the site allows other pages to read it. (' + e.message + ')' : e); }
  listen('#uGet', function () { var u = $('#uUrl').value.trim(); out('#uOut', 'Asking...', ''); return track('network', 'internet GET', function () { if (!/^https:\/\//i.test(u)) throw new Error('Only https:// addresses work.'); return get(u); }).then(showGet, netFail); });
  listen('#uZen', function () { out('#uOut', 'Asking...', ''); $('#uUrl').value = 'https://api.github.com/zen'; return track('network', 'internet (advice)', function () { return get('https://api.github.com/zen'); }).then(showGet, netFail); });
  listen('#uIp', function () { out('#uOut', 'Asking...', ''); $('#uUrl').value = 'https://api.ipify.org?format=json'; return track('network', 'internet (public address)', function () { return get('https://api.ipify.org?format=json'); }).then(showGet, netFail); });
  listen('#uImg', function () {
    out('#uOut', 'Loading a picture...', ''); var i = $('#uPic'); i.hidden = true;
    return track('network', 'internet (picture)', function () { return new Promise(function (ok, no) { i.onload = ok; i.onerror = function () { no(new Error('The picture did not load.')); }; i.src = 'https://picsum.photos/seed/patos/600/260?t=' + Date.now(); }); }).then(function () { i.hidden = false; say('#uOut', 'The picture loaded (' + i.naturalWidth + ' x ' + i.naturalHeight + ').'); }, function (e) { fail('#uOut', e); });
  });
  listen('#uPing', function () {
    out('#uOut', 'Testing 5 times...', ''); return track('network', 'internet (speed test)', function () {
      var times = []; var p = Promise.resolve(); for (var k = 0; k < 5; k++) p = p.then(function () { return get('https://api.github.com/zen?t=' + Date.now()).then(function (r) { times.push(r.ms); }); }); return p.then(function () { return times; });
    }).then(function (t) { var avg = Math.round(t.reduce(function (a, b) { return a + b; }, 0) / t.length); say('#uOut', 'Round trips: ' + t.join(', ') + ' ms\nAverage: ' + avg + ' ms'); }, netFail);
  });

  /* ----- window and theme ----- */
  function drawSwatches(t) {
    var box = $('#swatches'); box.textContent = ''; [['Background', t.bg], ['Text', t.text], ['Accent', t.accent]].forEach(function (c) { var d = document.createElement('div'); d.style.background = c[1]; d.style.color = c[0] === 'Text' ? t.bg : t.text; d.textContent = c[0] + ' ' + c[1]; box.appendChild(d); });
  }
  listen('#wSet', function () { return track(null, 'window.setTitle', function () { return patos.window.setTitle($('#wTitle').value); }).then(function () { say('#wOut', 'The window title changed.'); }, function (e) { fail('#wOut', e); }); });
  listen('#wInfo', function () { return track(null, 'info', function () { return patos.info(); }).then(function (i) { drawSwatches(i); say('#wOut', i); }, function (e) { fail('#wOut', e); }); });
  listen('#wClose', function () { return patos.window.close(); });
  patos.on('theme', function (t) { drawSwatches(t); patos.log('Theme changed: ' + (t.dark ? 'dark' : 'light') + ' ' + t.accent, false); });

  /* ----- report ----- */
  listen('#rCopy', function () { return track('clipboard', 'clipboard.write (report)', function () { return patos.clipboard.write(reportText()); }).catch(function () {}); });
  listen('#rSave', function () { var n = 'reports/report-' + Date.now() + '.txt'; return track('files', 'files.write (report)', function () { return patos.files.write(n, reportText()); }).then(function () { return patos.notify({ title: 'Report saved', body: n }).catch(function () {}); }).catch(function () {}); });
  listen('#rClear', function () { report = []; $('#report').textContent = ''; });

  /* ----- the two test runs ----- */
  function step(label, fn) { return Promise.resolve().then(fn).catch(function () {}); }
  function quiet() {
    return step('storage', function () { return track(null, 'storage.set/get', function () { return patos.storage.set('selftest', stamp()).then(function () { return patos.storage.get('selftest'); }).then(function (v) { if (!v) throw new Error('Nothing came back.'); }); }); })
      .then(function () { return step('info', function () { return track(null, 'info', function () { return patos.info(); }).then(drawSwatches); }); })
      .then(function () { return step('title', function () { return track(null, 'window.setTitle', function () { return patos.window.setTitle('Device Lab - self test'); }); }); })
      .then(function () { return step('files', function () { return track('files', 'files write, read, list, remove', function () { var n = 'lab/self-test.txt', want = 'self test ' + stamp(); return patos.files.write(n, want).then(function () { return patos.files.read(n); }).then(function (got) { if (got !== want) throw new Error('The file came back different.'); return patos.files.list('lab'); }).then(function (l) { if (!l.some(function (f) { return f.name === 'self-test.txt'; })) throw new Error('The file is not in the list.'); return patos.files.remove(n); }).then(function () { return patos.files.read(n); }).then(function (g) { if (g !== null) throw new Error('The file was not removed.'); }); }); }); });
  }
  listen('#runSafe', function () { return quiet().then(function () { return $('#fList').click(); }); });
  listen('#runAll', function () {
    return quiet()
      .then(function () { return step('notify', function () { return track('notifications', 'notify (self test)', function () { return patos.notify({ title: 'Device Lab', body: 'Self test: notifications work.' }); }); }); })
      .then(function () { return step('clipboard', function () { return track('clipboard', 'clipboard write and read', function () { var w = 'device-lab-' + Date.now(); return patos.clipboard.write(w).then(function () { return patos.clipboard.read(); }).then(function (r) { if (r !== w) throw new Error('The clipboard has something else now.'); }); }); }); })
      .then(function () { return step('location', function () { return track('location', 'location.get (self test)', function () { return patos.location.get(); }).then(function (p) { last.coords = p; drawLoc(p); $('#locCopy').disabled = false; $('#locPlace').disabled = false; }); }); })
      .then(function () { return step('internet', function () { return track('network', 'internet (self test)', function () { return get('https://api.github.com/zen').then(function (r) { if (r.status !== 200) throw new Error('Got status ' + r.status); }); }); }); })
      .then(function () { return step('camera', function () { return track('camera', 'camera.snapshot (self test)', function () { return patos.camera.snapshot(); }).then(function (d) { last.photo = d; var i = $('#camImg'); i.src = d; i.hidden = false; $('#camSave').disabled = false; }); }); })
      .then(function () { return step('microphone', function () { return track('microphone', 'microphone.record 1 s (self test)', function () { return patos.microphone.record(1000); }).then(function (d) { last.audio = d; var a = $('#micAudio'); a.src = d; a.hidden = false; $('#micSave').disabled = false; }); }); })
      .then(function () { var bad = report.filter(function (r) { return !r.ok; }).length; return step('done', function () { return patos.notify({ title: 'Device Lab', body: bad ? bad + ' test(s) failed. See the report.' : 'Everything works.' }); }); })
      .then(function () { $('#c-report').scrollIntoView(); });
  });

  /* ----- start ----- */
  patos.info().then(function (i) {
    $('#who').textContent = patos.app.name + ' ' + patos.app.version + '  -  ' + (i.dark ? 'dark' : 'light') + ' theme, ' + (i.language === 'fr' ? 'French' : 'English') + (i.mobile ? ', phone layout' : '') + (patos.app.network ? '  -  internet allowed' : '  -  internet not allowed (or not asked yet)');
    drawSwatches(i);
  });
  patos.storage.get('opens').then(function (n) { n = (n || 0) + 1; patos.storage.set('opens', n); $('#sOut').textContent = 'You have opened Device Lab ' + n + ' time(s).'; });
  showOnline(); drawPerms(); // (nothing asks for a permission until you press a button)
  patos.log('Device Lab started.', false);
})();
