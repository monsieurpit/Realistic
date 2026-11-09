/* Screen Recorder — pictures and videos of your screen, with your microphone, system sound and camera.
   Screen: pick a tab, window or the whole screen. Your camera can sit in a corner of the video, and the
   microphone and the sound of what you share are mixed together. Recordings are saved in Videos. */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const CORNERS = [['br', 'Bottom right'], ['bl', 'Bottom left'], ['tr', 'Top right'], ['tl', 'Top left']];
  const QUALITY = { src: ['Original', 0, 6e6], '1080': ['1080p', 1080, 5e6], '720': ['720p', 720, 2.5e6], '480': ['480p', 480, 1.2e6] };
  const stamp = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + '.' + p(d.getMinutes()) + '.' + p(d.getSeconds()); };
  const fmtT = (s) => { const hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60; return (hh ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0'); };
  // whole sentences per device, so they can be translated properly (le microphone, la caméra)
  const SENT = {
    microphone: { blocked: 'Chrome blocked the microphone. Click the lock icon next to the address, then allow it.', missing: 'No microphone was found on this device.', busy: 'The microphone is being used by another app.' },
    camera: { blocked: 'Chrome blocked the camera. Click the lock icon next to the address, then allow it.', missing: 'No camera was found on this device.', busy: 'The camera is being used by another app.' }
  };
  const errText = (e, what) => {
    const n = e && e.name, S = SENT[what];
    if (n === 'NotAllowedError' || n === 'PermissionDeniedError') return what === 'screen' || !S ? T('Screen sharing was cancelled, or this browser blocked it.') : T(S.blocked);
    if ((n === 'NotFoundError' || n === 'OverconstrainedError') && S) return T(S.missing);
    if (n === 'NotReadableError' && S) return T(S.busy);
    return (e && e.message) || String(e);
  };

  let session = null; // one recording at a time, even if the window is closed
  PatOS.isRecording = () => !!session;

  PatOS.registerApp({
    id: 'screenshot', name: 'Screen Recorder', icon: 'screenshot', width: 640, height: 640, category: 'Utilities', keywords: 'screen capture record video picture snap screenshot camera microphone mic webcam',
    about: 'Record your screen with your microphone and camera, or take a picture of it.',
    launch(win) {
      const cfg = Object.assign({ mode: 'video', source: 'screen', mic: false, sysAudio: true, cam: false, corner: 'br', quality: '1080', countdown: 3, micId: '', camId: '' }, PatOS.store.get('recorderCfg', {}));
      const save = () => PatOS.store.set('recorderCfg', cfg);
      const canScreen = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
      const canMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      if (!canScreen && cfg.source === 'screen') cfg.source = 'camera';
      const body = h('div', { class: 'rc' }); win.body.appendChild(body);
      let previewStream = null, meterRaf = 0, meterCtx = null;

      function toggle(label, key, hint, onchange) {
        const s = h('button', { class: 'switch' + (cfg[key] ? ' on' : ''), role: 'switch', 'aria-checked': cfg[key] ? 'true' : 'false' });
        s.onclick = () => { cfg[key] = !cfg[key]; s.classList.toggle('on', cfg[key]); s.setAttribute('aria-checked', cfg[key]); save(); if (onchange) onchange(cfg[key]); };
        return h('label', { class: 'rc-opt' }, h('div', {}, h('b', {}, T(label)), hint ? h('small', {}, T(hint)) : null), s);
      }
      const stopPreview = () => { if (previewStream) previewStream.getTracks().forEach((t) => t.stop()); previewStream = null; cancelAnimationFrame(meterRaf); if (meterCtx) { try { meterCtx.close(); } catch (e) {} meterCtx = null; } };

      function render() {
        stopPreview();
        body.innerHTML = '';
        if (session) return renderRecording();
        const mode = h('div', { class: 'seg rc-mode' }, ...[['video', 'Record Video'], ['picture', 'Take Picture']].map(([k, l]) => h('button', { class: 'tab' + (cfg.mode === k ? ' on' : ''), onclick: () => { cfg.mode = k; save(); render(); } }, T(l))));
        body.appendChild(mode);
        if (cfg.mode === 'picture') {
          const delay = h('select', { class: 'field' }, ...[['0', 'No delay'], ['3', '3 seconds'], ['5', '5 seconds'], ['10', '10 seconds']].map(([v, l]) => h('option', { value: v }, T(l))));
          const bShot = h('button', { class: 'rc-go' }, h('span', { html: PatOS.iconHTML('screenshot') }), h('b', {}, T('Take Screenshot')));
          bShot.disabled = !canScreen;
          bShot.onclick = () => picture(+delay.value);
          body.append(bShot, h('label', { class: 'rc-row' }, T('Delay'), delay));
          if (!canScreen) body.appendChild(h('p', { class: 'rc-warn' }, T('This device doesn’t allow screen capture (iPhones and iPads don’t).')));
          body.appendChild(h('div', { class: 'rc-out', id: 'rc-out' }));
          return;
        }
        // video options
        const src = h('div', { class: 'seg rc-src' }, ...[['screen', 'Screen'], ['camera', 'Camera only']].map(([k, l]) => { const b = h('button', { class: 'tab' + (cfg.source === k ? ' on' : ''), onclick: () => { cfg.source = k; save(); render(); } }, T(l)); if (k === 'screen' && !canScreen) b.disabled = true; return b; }));
        const card = h('div', { class: 'rc-card' });
        card.appendChild(toggle('Microphone', 'mic', 'Record your voice', () => render()));
        if (cfg.mic) {
          const sel = h('select', { class: 'field rc-dev' }, h('option', { value: '' }, T('Default microphone')));
          const meter = h('div', { class: 'rc-meter' }, h('i'));
          card.append(h('div', { class: 'rc-sub' }, sel, meter));
          startMicPreview(sel, meter);
        }
        if (cfg.source === 'screen') card.appendChild(toggle('Sound from the screen', 'sysAudio', 'Pick “Share tab audio” or “Share system audio” in Chrome’s window'));
        card.appendChild(toggle('Camera', 'cam', cfg.source === 'screen' ? 'Shows you in a corner of the video' : 'Records your camera', () => render()));
        if (cfg.cam) {
          const sel = h('select', { class: 'field rc-dev' }, h('option', { value: '' }, T('Default camera')));
          const pv = h('video', { class: 'rc-camprev', muted: true, playsinline: true, autoplay: true });
          const sub = h('div', { class: 'rc-sub' }, sel);
          if (cfg.source === 'screen') {
            const cs = h('div', { class: 'rc-corners' }, ...CORNERS.map(([k, l]) => h('button', { class: cfg.corner === k ? 'on' : '', title: T(l), 'data-c': k, onclick: () => { cfg.corner = k; save(); [...cs.children].forEach((x) => x.classList.toggle('on', x.dataset.c === k)); } })));
            sub.appendChild(h('div', { class: 'rc-cornerbox' }, h('small', {}, T('Corner')), cs));
          }
          card.append(sub, pv);
          startCamPreview(sel, pv);
        }
        const q = h('select', { class: 'field' }, ...Object.entries(QUALITY).map(([k, v]) => h('option', { value: k }, T(v[0])))); q.value = cfg.quality; q.onchange = () => { cfg.quality = q.value; save(); };
        const cd = h('select', { class: 'field' }, ...[0, 3, 5].map((n) => h('option', { value: n }, n ? n + ' ' + T('seconds') : T('No countdown')))); cd.value = String(cfg.countdown); cd.onchange = () => { cfg.countdown = +cd.value; save(); };
        card.append(h('label', { class: 'rc-row' }, T('Quality'), q), h('label', { class: 'rc-row' }, T('Countdown'), cd));
        const go = h('button', { class: 'rc-go rec' }, h('span', { class: 'ss-dot' }), h('b', {}, T('Start Recording')));
        go.disabled = cfg.source === 'screen' ? !canScreen : !canMedia;
        go.onclick = () => start(go);
        body.append(src, card, go, h('div', { class: 'rc-out', id: 'rc-out' }));
        if (cfg.source === 'screen' && !canScreen) body.appendChild(h('p', { class: 'rc-warn' }, T('This device doesn’t allow screen capture (iPhones and iPads don’t). Use Camera only.')));
        const last = PatOS.fs.list('/Videos').filter((f) => /^(Screen|Camera|Audio) Recording|^Enregistrement/.test(f.name)).sort((a, b) => (b.mtime || 0) - (a.mtime || 0))[0];
        if (last) body.appendChild(h('button', { class: 'rc-last', onclick: () => PatOS.launch('videos', { path: last.path }) }, T('Last recording') + ': ' + last.name.replace(/\.webm$/, '')));
      }

      /* ----- device lists + live previews (so you can see the mic and camera work before you start) ----- */
      async function fillDevices(sel, kind, key) {
        try {
          const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === kind);
          list.forEach((d, i) => sel.appendChild(h('option', { value: d.deviceId }, d.label || (kind === 'audioinput' ? T('Microphone') : T('Camera')) + ' ' + (i + 1))));
          sel.value = list.some((d) => d.deviceId === cfg[key]) ? cfg[key] : '';
        } catch (e) {}
        sel.onchange = () => { cfg[key] = sel.value; save(); render(); };
      }
      async function startMicPreview(sel, meter) {
        if (!canMedia) { meter.parentNode.textContent = T('This device has no microphone access.'); return; }
        try {
          const s = await navigator.mediaDevices.getUserMedia({ audio: cfg.micId ? { deviceId: { exact: cfg.micId } } : true });
          if (!body.isConnected || !cfg.mic) { s.getTracks().forEach((t) => t.stop()); return; }
          if (previewStream) previewStream.getTracks().forEach((t) => t.stop());
          previewStream = previewStream ? new MediaStream([...previewStream.getVideoTracks(), ...s.getTracks()]) : s;
          await fillDevices(sel, 'audioinput', 'micId');
          meterCtx = new (window.AudioContext || window.webkitAudioContext)(); const an = meterCtx.createAnalyser(); an.fftSize = 512; meterCtx.createMediaStreamSource(s).connect(an);
          const buf = new Uint8Array(an.fftSize); const bar = meter.firstChild;
          const tick = () => { an.getByteTimeDomainData(buf); let m = 0; for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i] - 128)); bar.style.width = Math.min(100, m / 90 * 100) + '%'; meterRaf = requestAnimationFrame(tick); };
          tick();
        } catch (e) { meter.parentNode.replaceChildren(h('span', { class: 'rc-bad' }, errText(e, 'microphone'))); }
      }
      async function startCamPreview(sel, video) {
        if (!canMedia) { video.replaceWith(h('span', { class: 'rc-bad' }, T('This device has no camera access.'))); return; }
        try {
          const s = await navigator.mediaDevices.getUserMedia({ video: cfg.camId ? { deviceId: { exact: cfg.camId } } : { width: 640, height: 480 } });
          if (!body.isConnected || !cfg.cam) { s.getTracks().forEach((t) => t.stop()); return; }
          if (previewStream) s.getTracks().forEach((t) => previewStream.addTrack(t)); else previewStream = s;
          video.srcObject = s; video.play().catch(() => {});
          await fillDevices(sel, 'videoinput', 'camId');
        } catch (e) { video.replaceWith(h('span', { class: 'rc-bad' }, errText(e, 'camera'))); }
      }

      /* ----- picture ----- */
      async function picture(delay) {
        const out = body.querySelector('#rc-out'); const msg = h('div', { class: 'ss-msg' }); out.innerHTML = ''; out.appendChild(msg);
        let s; try { s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false }); } catch (e) { msg.textContent = errText(e, 'screen'); return; }
        for (let i = delay; i > 0; i--) { msg.textContent = i + '…'; await new Promise((r) => setTimeout(r, 1000)); }
        const v = h('video', { muted: true, playsinline: true }); v.srcObject = s; await v.play(); await new Promise((r) => setTimeout(r, 250));
        const c = document.createElement('canvas'); const sc = Math.min(1, 2000 / v.videoWidth); c.width = v.videoWidth * sc; c.height = v.videoHeight * sc;
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); s.getTracks().forEach((t) => t.stop());
        const url = c.toDataURL('image/jpeg', 0.88);
        const nm = PatOS.fs.uniqueName('/Pictures', T('Screenshot') + ' ' + stamp() + '.jpg');
        PatOS.fs.write('/Pictures/' + nm, url); PatOS.sound.tone(1800, 0.08, { vol: 0.12, type: 'square' });
        out.innerHTML = ''; out.append(h('img', { src: url, alt: '' }), h('div', { class: 'ss-btns' }, h('button', { class: 'btn', onclick: () => PatOS.launch('photos', { path: '/Pictures/' + nm }) }, T('Open in Photos')), h('button', { class: 'btn', onclick: () => PatOS.device.saveCopy('/Pictures/' + nm) }, T('Save to This Chromebook…'))));
      }

      /* ----- video ----- */
      async function start(btn) {
        stopPreview();
        const msg = h('div', { class: 'rc-bad' }); const out = body.querySelector('#rc-out'); out.innerHTML = ''; out.appendChild(msg);
        const sources = []; let screen = null, mic = null, cam = null;
        try {
          if (cfg.source === 'screen') {
            const q = QUALITY[cfg.quality];
            screen = await navigator.mediaDevices.getDisplayMedia({ video: Object.assign({ frameRate: 30 }, q[1] ? { height: { ideal: q[1] } } : {}), audio: cfg.sysAudio ? { echoCancellation: false, noiseSuppression: false } : false });
          }
        } catch (e) { msg.textContent = errText(e, 'screen'); return; }
        try { if (cfg.mic) mic = await navigator.mediaDevices.getUserMedia({ audio: Object.assign({ echoCancellation: true, noiseSuppression: true }, cfg.micId ? { deviceId: { exact: cfg.micId } } : {}) }); }
        catch (e) { msg.textContent = errText(e, 'microphone') + ' ' + T('Recording without it.'); mic = null; }
        try { if (cfg.cam) cam = await navigator.mediaDevices.getUserMedia({ video: Object.assign({ width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, cfg.camId ? { deviceId: { exact: cfg.camId } } : {}) }); }
        catch (e) { msg.textContent = errText(e, 'camera') + ' ' + T('Recording without it.'); cam = null; }
        if (!screen && !cam && !mic) return;
        if (cfg.source === 'camera' && !cam && !mic) { msg.textContent = T('Turn on the camera or the microphone to record.'); return; }
        // 3, 2, 1
        if (cfg.countdown) await countdown(cfg.countdown);
        try { await begin({ screen, mic, cam }); } catch (e) { [screen, mic, cam].forEach((s) => s && s.getTracks().forEach((t) => t.stop())); PatOS.alertBox(T('Couldn’t start recording'), e.message || String(e), { icon: 'screenshot' }); render(); }
      }
      function countdown(n) {
        return new Promise((res) => {
          const layer = h('div', { class: 'rc-count' }); document.body.appendChild(layer);
          const tick = () => { if (n <= 0) { layer.remove(); return res(); } layer.innerHTML = '<b>' + n + '</b>'; PatOS.sound.tone(660 + (3 - n) * 110, 0.1, { vol: 0.15 }); n--; setTimeout(tick, 1000); };
          tick();
        });
      }
      async function begin({ screen, mic, cam }) {
        const q = QUALITY[cfg.quality];
        const tracks = []; const cleanup = [];
        let videoTrack, w = 1280, hgt = 720;
        const stopAll = () => { [screen, mic, cam].forEach((s) => s && s.getTracks().forEach((t) => t.stop())); cleanup.forEach((f) => { try { f(); } catch (e) {} }); };
        // ----- video -----
        if (screen) {
          const st = screen.getVideoTracks()[0].getSettings(); w = st.width || 1280; hgt = st.height || 720;
          if (cam) {
            const sv = h('video', { muted: true, playsinline: true }); sv.srcObject = screen; await sv.play();
            const cv = h('video', { muted: true, playsinline: true }); cv.srcObject = cam; await cv.play();
            const canvas = document.createElement('canvas'); canvas.width = sv.videoWidth || w; canvas.height = sv.videoHeight || hgt; const ctx = canvas.getContext('2d');
            const camH = Math.round(canvas.height * 0.26), camW = Math.round(camH * (cv.videoWidth / cv.videoHeight || 4 / 3)), r = Math.round(camH / 2), pad = Math.round(canvas.height * 0.03);
            const cx = cfg.corner.endsWith('l') ? pad + camH / 2 : canvas.width - pad - camH / 2, cy = cfg.corner.startsWith('t') ? pad + camH / 2 : canvas.height - pad - camH / 2;
            const draw = () => {
              ctx.drawImage(sv, 0, 0, canvas.width, canvas.height);
              ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
              const sc = camH / Math.min(cv.videoWidth, cv.videoHeight); const dw = cv.videoWidth * sc, dh = cv.videoHeight * sc;
              ctx.translate(cx, cy); ctx.scale(-1, 1); ctx.drawImage(cv, -dw / 2, -dh / 2, dw, dh); ctx.restore();
              ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = Math.max(3, camH * 0.025); ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.stroke();
            };
            // a Worker keeps time even when PatOS is hidden behind the window you are recording
            const wk = new Worker(URL.createObjectURL(new Blob(['setInterval(function(){postMessage(0)},33)'], { type: 'text/javascript' })));
            wk.onmessage = draw; cleanup.push(() => wk.terminate());
            videoTrack = canvas.captureStream(30).getVideoTracks()[0]; draw();
          } else videoTrack = screen.getVideoTracks()[0];
        } else if (cam) { videoTrack = cam.getVideoTracks()[0]; const st = videoTrack.getSettings(); w = st.width || 1280; hgt = st.height || 720; }
        if (videoTrack) tracks.push(videoTrack);
        // ----- audio: mix the microphone and the sound of the shared screen -----
        const audioSources = []; if (mic) audioSources.push(mic); if (screen && screen.getAudioTracks().length) audioSources.push(new MediaStream(screen.getAudioTracks()));
        if (audioSources.length) {
          const ac = new (window.AudioContext || window.webkitAudioContext)(); await ac.resume(); const dest = ac.createMediaStreamDestination();
          audioSources.forEach((s) => { const g = ac.createGain(); g.gain.value = 1; ac.createMediaStreamSource(s).connect(g); g.connect(dest); });
          cleanup.push(() => ac.close()); tracks.push(...dest.stream.getAudioTracks());
        }
        if (!tracks.length) throw new Error(T('Nothing to record.'));
        const stream = new MediaStream(tracks);
        const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
        const rec = new MediaRecorder(stream, Object.assign({ videoBitsPerSecond: videoTrack ? q[2] : undefined, audioBitsPerSecond: 128000 }, mime ? { mimeType: mime } : {}));
        const chunks = []; rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        const s = session = { rec, chunks, t0: Date.now(), paused: 0, pausedAt: 0, kind: cfg.source === 'screen' ? 'Screen Recording' : videoTrack ? 'Camera Recording' : 'Audio Recording', hasVideo: !!videoTrack, stopAll, listeners: new Set(), result: null, mime: mime || 'video/webm' };
        rec.onstop = async () => {
          stopAll(); clearInterval(s.timer); hidePill();
          const blob = new Blob(chunks, { type: s.hasVideo ? 'video/webm' : 'audio/webm' });
          const ext = 'webm'; if (!PatOS.fs.exists('/Videos')) PatOS.fs.mkdir('/Videos');
          const dir = '/Videos';
          const nm = PatOS.fs.uniqueName(dir, T(s.kind) + ' ' + stamp() + '.' + ext);
          try { await PatOS.fs.writeBlob(dir + '/' + nm, blob); s.result = { path: dir + '/' + nm, size: blob.size, blob }; PatOS.notify({ title: T('Recording saved'), body: nm, icon: 'screenshot' }); PatOS.sound.tone(880, 0.12, { vol: 0.15 }); }
          catch (e) { s.result = { error: e.message || 'Not enough storage space.', blob }; }
          session = null; s.listeners.forEach((f) => f()); win.el.isConnected && render(); if (s.result) showResult(s.result);
        };
        if (screen) screen.getVideoTracks()[0].addEventListener('ended', () => { if (session === s && rec.state !== 'inactive') rec.stop(); });
        rec.start(1000);
        showPill(s); s.timer = setInterval(() => updatePill(s), 500);
        render();
        if (cfg.source === 'screen') win.minimize();
      }
      function elapsed(s) { return Math.floor((Date.now() - s.t0 - s.paused - (s.pausedAt ? Date.now() - s.pausedAt : 0)) / 1000); }

      /* ----- the little control pill that floats over PatOS while recording ----- */
      function showPill(s) {
        hidePill();
        const pill = h('div', { class: 'rc-pill', id: 'rc-pill' },
          h('span', { class: 'rc-pdot' }), h('b', { class: 'rc-ptime' }, '0:00'),
          h('button', { class: 'rc-pb', title: T('Pause'), id: 'rc-pause', onclick: () => { if (s.rec.state === 'recording') { s.rec.pause(); s.pausedAt = Date.now(); } else if (s.rec.state === 'paused') { s.rec.resume(); s.paused += Date.now() - s.pausedAt; s.pausedAt = 0; } updatePill(s); } }),
          h('button', { class: 'rc-pb stop', title: T('Stop'), onclick: () => s.rec.state !== 'inactive' && s.rec.stop() }));
        document.body.appendChild(pill);
      }
      function updatePill(s) { const p = document.getElementById('rc-pill'); if (!p) return; p.querySelector('.rc-ptime').textContent = fmtT(elapsed(s)); p.classList.toggle('paused', s.rec.state === 'paused'); const pb = document.getElementById('rc-pause'); if (pb) pb.title = T(s.rec.state === 'paused' ? 'Resume' : 'Pause'); const t = body.querySelector('.rc-time'); if (t) t.textContent = fmtT(elapsed(s)); const pa = body.querySelector('.rc-pause'); if (pa) pa.textContent = T(s.rec.state === 'paused' ? 'Resume' : 'Pause'); }
      function hidePill() { const p = document.getElementById('rc-pill'); if (p) p.remove(); }
      function renderRecording() {
        const s = session;
        body.append(h('div', { class: 'rc-live' }, h('span', { class: 'ss-dot' }), h('b', { class: 'rc-time' }, fmtT(elapsed(s))), h('small', {}, T(s.kind))),
          h('div', { class: 'rc-livebtns' }, h('button', { class: 'btn rc-pause', onclick: () => document.getElementById('rc-pause').click() }, T('Pause')), h('button', { class: 'btn danger', onclick: () => s.rec.state !== 'inactive' && s.rec.stop() }, T('Stop and save'))),
          h('p', { class: 'rc-hint' }, T('To stop from another window, use Chrome’s “Stop sharing” bar, or the red timer at the top of PatOS.')));
        s.listeners.add(() => { if (win.el.isConnected) render(); });
      }
      function showResult(r) {
        if (!win.el.isConnected) return;
        const out = body.querySelector('#rc-out'); if (!out) return; out.innerHTML = '';
        if (r.error) { out.appendChild(h('p', { class: 'rc-bad' }, T('Couldn’t save the recording') + ': ' + r.error)); out.appendChild(h('button', { class: 'btn', onclick: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(r.blob); a.download = 'recording.webm'; a.click(); } }, T('Download it instead'))); return; }
        const v = h('video', { controls: true, src: URL.createObjectURL(r.blob) });
        out.append(v, h('div', { class: 'ss-msg' }, PatOS.fs.basename(r.path) + ' · ' + PatOS.fmtBytes(r.size)), h('div', { class: 'ss-btns' },
          h('button', { class: 'btn primary', onclick: () => PatOS.launch('videos', { path: r.path }) }, T('Open')),
          h('button', { class: 'btn', onclick: () => PatOS.device.saveCopy(r.path) }, T('Save to This Chromebook…')),
          h('button', { class: 'btn', onclick: () => PatOS.launch('finder', { path: PatOS.fs.dirname(r.path) }) }, T('Show in Piles'))));
      }
      win.on('closed', () => { stopPreview(); });
      if (session) session.listeners.add(() => {});
      render();
    }
  });
})();
