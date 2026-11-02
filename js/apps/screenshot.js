/* Screenshot — capture your screen as a picture or record it as a video (real screen capture) */
(function () {
  'use strict';
  const { h } = PatOS;
  PatOS.registerApp({
    id: 'screenshot', name: 'Screenshot', icon: 'screenshot', width: 560, height: 470, category: 'Utilities', keywords: 'screen capture record video picture snap',
    about: 'Take a picture of your screen or record it as a video.',
    launch(win) {
      let rec = null, stream = null, chunks = [], t0 = 0, timer = 0;
      const canCapture = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
      const delaySel = h('select', { class: 'field' }, h('option', { value: '0' }, 'No delay'), h('option', { value: '3' }, '3 seconds'), h('option', { value: '5' }, '5 seconds'));
      const bShot = h('button', { class: 'ss-big' }, h('span', { html: PatOS.iconHTML('screenshot') }), h('b', {}, 'Take Screenshot'));
      const bRec = h('button', { class: 'ss-big rec' }, h('span', { class: 'ss-dot' }), h('b', {}, 'Record Screen'));
      const msg = h('div', { class: 'ss-msg' });
      const out = h('div', { class: 'ss-out' });
      win.body.appendChild(h('div', { class: 'ss' }, h('div', { class: 'ss-row' }, bShot, bRec), h('label', { class: 'ss-delay' }, 'Delay ', delaySel), msg, out));
      if (!canCapture) { msg.textContent = PatOS.t('This device doesn’t allow screen capture (iPhones and iPads don’t).'); bShot.disabled = bRec.disabled = true; }
      async function getStream(video) {
        try { return await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: video ? 30 : 5 }, audio: video }); }
        catch (e) { msg.textContent = e.name === 'NotAllowedError' ? PatOS.t('Screen capture was cancelled.') : e.message; return null; }
      }
      bShot.onclick = async () => {
        const d = +delaySel.value;
        const s = await getStream(false); if (!s) return;
        for (let i = d; i > 0; i--) { msg.textContent = i + '…'; await new Promise((r) => setTimeout(r, 1000)); }
        const v = h('video', { muted: true, playsinline: true }); v.srcObject = s; await v.play();
        await new Promise((r) => setTimeout(r, 250));
        const c = document.createElement('canvas'); const sc = Math.min(1, 1600 / v.videoWidth); c.width = v.videoWidth * sc; c.height = v.videoHeight * sc;
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); s.getTracks().forEach((t) => t.stop());
        const url = c.toDataURL('image/jpeg', 0.85);
        const nm = PatOS.fs.uniqueName('/Pictures', PatOS.t('Screenshot') + ' ' + new Date().toLocaleString().replace(/[\/:]/g, '-') + '.jpg');
        PatOS.fs.write('/Pictures/' + nm, url); PatOS.sound.tone(1800, 0.08, { vol: 0.12, type: 'square' });
        msg.textContent = ''; out.innerHTML = ''; out.append(h('img', { src: url, alt: '' }), h('div', { class: 'ss-btns' }, h('button', { class: 'btn', onclick: () => PatOS.launch('photos', { path: '/Pictures/' + nm }) }, 'Open in Photos'), h('button', { class: 'btn', onclick: () => PatOS.downloadFile(nm, url) }, 'Download')));
      };
      bRec.onclick = async () => {
        if (rec) { rec.stop(); return; }
        stream = await getStream(true); if (!stream) return;
        chunks = []; rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' });
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = () => {
          clearInterval(timer); stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: 'video/webm' }); const url = URL.createObjectURL(blob);
          bRec.classList.remove('on'); bRec.querySelector('b').textContent = PatOS.t('Record Screen'); msg.textContent = PatOS.fmtBytes(blob.size);
          out.innerHTML = ''; out.append(h('video', { src: url, controls: true }), h('div', { class: 'ss-btns' }, h('button', { class: 'btn primary', onclick: () => { const a = document.createElement('a'); a.href = url; a.download = 'Screen recording.webm'; document.body.appendChild(a); a.click(); a.remove(); } }, 'Save Video to Computer')));
          rec = null;
        };
        stream.getVideoTracks()[0].addEventListener('ended', () => rec && rec.stop());
        rec.start(500); t0 = Date.now(); bRec.classList.add('on');
        timer = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); bRec.querySelector('b').textContent = PatOS.t('Stop') + '  ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 250);
      };
      win.on('closed', () => { if (rec) rec.stop(); clearInterval(timer); });
    }
  });
})();
