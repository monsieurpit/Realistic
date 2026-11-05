/* Piano — play with keyboard or touch, record and play back */
(function () {
  'use strict';
  const { h } = PatOS;
  const KEYS = 'awsedftgyhujkolp;'.split(''); // white+black layout like a DAW
  const SOUNDS = { Piano: 'piano', Organ: 'organ', Synth: 'synth', Bell: 'bell' };
  PatOS.registerApp({
    id: 'piano', name: 'Piano', icon: 'piano', width: 820, height: 380, dark: true, keywords: 'music keyboard instrument play notes',
    launch(win) {
      win.el.classList.add('has-toolbar');
      let sound = 'piano', octave = 4, rec = null, recording = false;
      const sel = h('select', { class: 'field' }, ...Object.keys(SOUNDS).map((k) => h('option', { value: SOUNDS[k] }, k)));
      sel.onchange = () => { sound = sel.value; };
      const oct = h('span', { class: 'pi-oct' });
      const bDown = h('button', { class: 'tbtn' }, '−'); const bUp = h('button', { class: 'tbtn' }, '+');
      const bRec = h('button', { class: 'btn' }, '● Record'); const bPlay = h('button', { class: 'btn' }, '▶ Play');
      win.toolbar.append(sel, bDown, oct, bUp, h('div', { style: { flex: 1 } }), bRec, bPlay);
      const kb = h('div', { class: 'pi-kb' });
      win.body.append(kb, h('div', { class: 'pi-hint' }, 'Use your keyboard: A S D F G H J K L for white keys, W E T Y U O P for black keys, or tap the keys.'));
      const notes = []; // 2 octaves from C
      const pattern = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
      for (let i = 0; i < 24; i++) notes.push({ i, black: !!pattern[i % 12] });
      const active = {};
      function freq(i) { return 440 * Math.pow(2, (i + (octave - 4) * 12 - 9) / 12); }
      function play(i) {
        const a = PatOS.audio(); if (!a) return;
        const t = a.ctx.currentTime, f = freq(i);
        const g = a.ctx.createGain(); g.connect(a.out);
        const mk = (type, mul, vol) => { const o = a.ctx.createOscillator(); o.type = type; o.frequency.value = f * mul; const og = a.ctx.createGain(); og.gain.value = vol; o.connect(og); og.connect(g); o.start(t); o.stop(t + 3); };
        if (sound === 'piano') { mk('triangle', 1, 0.6); mk('sine', 2, 0.2); mk('sine', 3, 0.06); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2); }
        else if (sound === 'organ') { mk('sine', 1, 0.4); mk('sine', 2, 0.3); mk('sine', 4, 0.15); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35, t + 0.03); g.gain.setValueAtTime(0.35, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2); }
        else if (sound === 'synth') { mk('sawtooth', 1, 0.3); mk('square', 0.5, 0.15); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); }
        else { mk('sine', 1, 0.5); mk('sine', 2.76, 0.2); mk('sine', 5.4, 0.1); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 3); }
        if (recording) rec.push({ i, t: performance.now() - rec.start });
        const el = kb.children[i]; if (el) { el.classList.add('down'); clearTimeout(active[i]); active[i] = setTimeout(() => el.classList.remove('down'), 180); }
      }
      notes.forEach((n) => {
        const k = h('button', { class: 'pi-key ' + (n.black ? 'b' : 'w') });
        const label = KEYS[n.i]; if (label && n.i < 17) k.appendChild(h('span', {}, label.toUpperCase()));
        k.addEventListener('pointerdown', (e) => { e.preventDefault(); play(n.i); });
        k.addEventListener('pointerenter', (e) => { if (e.buttons) play(n.i); });
        kb.appendChild(k);
      });
      const onKey = (e) => {
        if (PatOS.wm.active !== win || e.repeat || e.altKey || e.ctrlKey) return;
        const i = KEYS.indexOf(e.key.toLowerCase()); if (i >= 0) { e.preventDefault(); play(i); }
        if (e.key === 'z') { octave = Math.max(2, octave - 1); upd(); } if (e.key === 'x') { octave = Math.min(6, octave + 1); upd(); }
      };
      document.addEventListener('keydown', onKey);
      function upd() { oct.textContent = 'Octave ' + octave; bRec.textContent = recording ? '■ Stop' : '● Record'; bRec.classList.toggle('danger', recording); bPlay.disabled = !rec || !rec.length || recording; }
      bDown.onclick = () => { octave = Math.max(2, octave - 1); upd(); }; bUp.onclick = () => { octave = Math.min(6, octave + 1); upd(); };
      bRec.onclick = () => { if (recording) { recording = false; } else { rec = []; rec.start = performance.now(); recording = true; } upd(); };
      bPlay.onclick = () => { if (!rec) return; const r = rec.slice(); r.forEach((n) => setTimeout(() => play(n.i), n.t)); };
      win.on('closed', () => document.removeEventListener('keydown', onKey));
      upd();
    }
  });
})();
