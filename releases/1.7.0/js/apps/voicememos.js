/* Voice Memos — record and play back audio */
(function () {
  'use strict';
  const { h } = PatOS;
  PatOS.registerApp({
    id: 'voicememos', name: 'Voice Memos', icon: 'voicememos', width: 520, height: 560, dark: true, keywords: 'record audio microphone voice',
    launch(win) {
      const list = h('div', { class: 'vm-list' });
      const wave = h('canvas', { class: 'vm-wave' });
      const time = h('div', { class: 'vm-time' }, '00:00.0');
      const btn = h('button', { class: 'vm-rec', 'aria-label': 'Record' }, h('span'));
      const msg = h('div', { class: 'vm-msg' });
      win.body.appendChild(h('div', { class: 'vm' }, h('h1', {}, 'All Recordings'), list, h('div', { class: 'vm-panel' }, wave, time, btn, msg)));
      let rec = null, stream = null, chunks = [], start = 0, raf = 0, analyser = null;
      function memos() { const out = []; PatOS.fs.walk('/Music', (p, n) => { if (/Memo .*\.(webm|ogg|m4a|mp3|wav)$/.test(p)) out.push({ p, n }); }); return out.sort((a, b) => b.n.mtime - a.n.mtime); }
      function renderList() {
        list.innerHTML = '';
        const m = memos();
        if (!m.length) list.appendChild(h('div', { class: 'vm-empty' }, 'Tap the red button to record your first memo.'));
        m.forEach(({ p, n }) => {
          const audio = h('audio', { src: n.content, controls: true, preload: 'none' });
          list.appendChild(h('div', { class: 'vm-item' }, h('div', { class: 'vm-it' }, h('b', {}, PatOS.fs.basename(p).replace(/\.\w+$/, '')), h('small', {}, new Date(n.mtime).toLocaleString()), h('button', { class: 'tbtn', title: 'Delete', onclick: () => { PatOS.fs.remove(p); renderList(); } }, '🗑')), audio));
        });
      }
      function draw() {
        const c = wave, x = c.getContext('2d'); c.width = c.clientWidth * 2; c.height = c.clientHeight * 2;
        const data = new Uint8Array(analyser ? analyser.fftSize : 256);
        const step = () => {
          raf = requestAnimationFrame(step);
          x.clearRect(0, 0, c.width, c.height);
          if (analyser) analyser.getByteTimeDomainData(data); else data.fill(128);
          x.strokeStyle = '#ff453a'; x.lineWidth = 3; x.beginPath();
          for (let i = 0; i < data.length; i++) { const px = i / data.length * c.width, py = c.height / 2 + (data[i] - 128) / 128 * c.height * 0.45; i ? x.lineTo(px, py) : x.moveTo(px, py); }
          x.stroke();
          if (rec) { const s = (Date.now() - start) / 1000; time.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + (s % 60).toFixed(1).padStart(4, '0'); }
        };
        step();
      }
      async function startRec() {
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
        catch (e) { msg.textContent = 'Microphone not available. Allow microphone access in your browser.'; return; }
        const a = PatOS.audio(); analyser = a.ctx.createAnalyser(); analyser.fftSize = 1024; a.ctx.createMediaStreamSource(stream).connect(analyser);
        chunks = []; rec = new MediaRecorder(stream);
        rec.ondataavailable = (e) => chunks.push(e.data);
        rec.onstop = () => {
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
          if (blob.size > 2.5 * 1024 * 1024) { msg.textContent = 'That memo is too long to store. Keep memos under about 2 minutes.'; }
          else {
            const r = new FileReader(); r.onload = () => {
              const ext = (blob.type.match(/audio\/(\w+)/) || [0, 'webm'])[1];
              const nm = PatOS.fs.uniqueName('/Music', 'Memo ' + new Date().toLocaleString().replace(/[\/:]/g, '-') + '.' + ext);
              PatOS.fs.write('/Music/' + nm, r.result); renderList();
            }; r.readAsDataURL(blob);
          }
          stream.getTracks().forEach((t) => t.stop()); rec = null; analyser = null; btn.classList.remove('on');
        };
        rec.start(); start = Date.now(); btn.classList.add('on'); msg.textContent = '';
      }
      btn.onclick = () => { if (rec) rec.stop(); else startRec(); };
      win.on('closed', () => { cancelAnimationFrame(raf); if (rec) rec.stop(); });
      renderList(); setTimeout(draw, 50);
    }
  });
})();
