/* Music — procedurally generated songs (Web Audio) + three.js 3D visualizer. Also plays your own audio files. */
(function () {
  'use strict';
  const { h } = PatOS;
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const SONGS = [
    { title: 'Neon Drive', artist: 'PatOS Synth Club', bpm: 104, key: 57, prog: [0, 5, 3, 7], scale: [0, 2, 3, 5, 7, 8, 10], color: 'linear-gradient(135deg,#ff2fa3,#5b2bff)', hue: 0.88, wave: 'sawtooth' },
    { title: 'Midnight Garden', artist: 'Lo-Fi Pat', bpm: 78, key: 60, prog: [0, 9, 5, 7], scale: [0, 2, 4, 7, 9], color: 'linear-gradient(135deg,#1e3c72,#2a5298)', hue: 0.6, wave: 'triangle' },
    { title: 'Pixel Rain', artist: 'Chiptune Kid', bpm: 132, key: 64, prog: [0, 7, 9, 5], scale: [0, 2, 4, 5, 7, 9, 11], color: 'linear-gradient(135deg,#11998e,#38ef7d)', hue: 0.38, wave: 'square' },
    { title: 'Starfall', artist: 'Ambient Orbit', bpm: 66, key: 55, prog: [0, 3, 8, 10], scale: [0, 2, 3, 7, 8], color: 'linear-gradient(135deg,#141e30,#8e54e9)', hue: 0.72, wave: 'sine' },
    { title: 'Summer Arcade', artist: 'Bit Beach', bpm: 118, key: 62, prog: [0, 5, 7, 5], scale: [0, 2, 4, 7, 9], color: 'linear-gradient(135deg,#f7971e,#ffd200)', hue: 0.1, wave: 'square' }
  ];
  const BARS = 32; // song length in bars

  /* ---------- engine (singleton so music keeps playing across windows) ---------- */
  const E = { idx: 0, playing: false, step: 0, nextTime: 0, timer: null, analyser: null, bus: null, startedAt: 0, el: null, custom: null, listeners: new Set(), seed: 1 };
  function rnd() { E.seed = (E.seed * 16807) % 2147483647; return E.seed / 2147483647; }
  function ensure() {
    const a = PatOS.audio(); if (!a) return null;
    if (!E.bus) {
      E.bus = a.ctx.createGain(); E.bus.gain.value = 0.55;
      E.analyser = a.ctx.createAnalyser(); E.analyser.fftSize = 512; E.analyser.smoothingTimeConstant = 0.8;
      const comp = a.ctx.createDynamicsCompressor();
      E.bus.connect(comp); comp.connect(E.analyser);
      /* send the music through a normal <audio> element so the device treats it as real media:
         Chromebook media keys and shelf controls, and the iPhone lock screen, can then control it */
      try {
        E.dest = a.ctx.createMediaStreamDestination(); E.outGain = a.ctx.createGain(); E.outGain.gain.value = PatOS.settings.volume;
        E.analyser.connect(E.outGain); E.outGain.connect(E.dest);
        E.sink = new Audio(); E.sink.srcObject = E.dest.stream;
        PatOS.on('setting:volume', (v) => { E.outGain.gain.value = v; });
      } catch (e) { E.analyser.connect(a.out); }
      // simple echo
      const d = a.ctx.createDelay(); d.delayTime.value = 0.33; const fb = a.ctx.createGain(); fb.gain.value = 0.28;
      E.echo = a.ctx.createGain(); E.echo.gain.value = 0.35; E.echo.connect(d); d.connect(fb); fb.connect(d); d.connect(E.bus);
    }
    return a;
  }
  function voice(a, t, freq, dur, type, vol, dest, opts) {
    const o = a.ctx.createOscillator(); const g = a.ctx.createGain(); const f = a.ctx.createBiquadFilter();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (opts && opts.detune) o.detune.value = opts.detune;
    f.type = 'lowpass'; f.frequency.setValueAtTime((opts && opts.cut) || 2400, t); f.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + ((opts && opts.att) || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(dest); if (opts && opts.echo) g.connect(E.echo);
    o.start(t); o.stop(t + dur + 0.05);
  }
  let noiseBuf = null;
  function drum(a, t, kind) {
    if (kind === 'kick') {
      const o = a.ctx.createOscillator(); const g = a.ctx.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g); g.connect(E.bus); o.start(t); o.stop(t + 0.32);
    } else {
      if (!noiseBuf) { noiseBuf = a.ctx.createBuffer(1, a.ctx.sampleRate * 0.5, a.ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const s = a.ctx.createBufferSource(); s.buffer = noiseBuf; const f = a.ctx.createBiquadFilter(); const g = a.ctx.createGain();
      f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
      const v = kind === 'hat' ? 0.12 : 0.4, d = kind === 'hat' ? 0.05 : 0.18;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      s.connect(f); f.connect(g); g.connect(E.bus); s.start(t); s.stop(t + d + 0.02);
    }
  }
  function schedule() {
    const a = ensure(); if (!a) return;
    const S = SONGS[E.idx]; const sixteenth = 60 / S.bpm / 4;
    while (E.nextTime < a.ctx.currentTime + 0.12) {
      const st = E.step, t = E.nextTime;
      const bar = Math.floor(st / 16), beat = st % 16;
      const chordRoot = S.key + S.prog[bar % S.prog.length];
      const section = Math.floor(bar / 8); // intro / A / B / outro
      if (beat === 0) { // pad chord
        [0, 4, 7].forEach((iv, i) => voice(a, t, NOTE(chordRoot + (S.scale.includes(3) && iv === 4 ? 3 : iv) - 12), sixteenth * 16, 'sawtooth', 0.035, E.bus, { att: 0.3, cut: 900 + section * 300, detune: i * 6 }));
      }
      if (section > 0 && beat % 4 === 0) voice(a, t, NOTE(chordRoot - 24), sixteenth * 3, 'triangle', 0.22, E.bus, { cut: 600 });
      if (section > 0 && section < 3) {
        if (beat % 4 === 0) drum(a, t, 'kick');
        if (beat === 4 || beat === 12) drum(a, t, 'snare');
        if (beat % 2 === 0) drum(a, t, 'hat');
      } else if (beat % 8 === 0) drum(a, t, 'hat');
      // melody
      if (section > 0 && (beat % 2 === 0) && rnd() < (S.bpm > 100 ? 0.7 : 0.5)) {
        const deg = S.scale[Math.floor(rnd() * S.scale.length)] + (rnd() < 0.3 ? 12 : 0);
        voice(a, t, NOTE(S.key + 12 + deg), sixteenth * (rnd() < 0.3 ? 4 : 2), S.wave, 0.06, E.bus, { echo: true, cut: 3200 });
      }
      // arpeggio sparkle
      if (section === 2 && beat % 1 === 0 && beat % 3 === 0) voice(a, t, NOTE(chordRoot + 24 + [0, 7, 12][beat % 3]), sixteenth, 'sine', 0.03, E.bus, { echo: true });
      E.step++; E.nextTime += sixteenth;
      if (E.step >= BARS * 16) { E.step = 0; songEnded(); return; }
    }
  }
  function songDuration(i) { return BARS * 4 * 60 / SONGS[i].bpm; }
  function position() {
    if (E.custom && E.el) return { t: E.el.currentTime || 0, d: E.el.duration || 0 };
    return { t: E.step * (60 / SONGS[E.idx].bpm / 4), d: songDuration(E.idx) };
  }
  function directOut() { if (E.direct) return; E.direct = true; try { E.analyser.disconnect(); } catch (e) {} E.analyser.connect(PatOS.audio().out); E.sink = null; }
  function sinkPlay() { if (E.sink) E.sink.play().catch(() => directOut()); }
  let artCache = {};
  function artwork(s) {
    if (artCache[s.title]) return artCache[s.title];
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const m = String(s.color).match(/#[0-9a-f]{6}/gi) || ['#ff6482', '#5b2bff'];
    const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, m[0]); g.addColorStop(1, m[1] || m[0]); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.fillStyle = 'rgba(255,255,255,.9)'; x.font = '700 120px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('♫', 128, 136);
    return (artCache[s.title] = c.toDataURL('image/png'));
  }
  function mediaSession() {
    if (!('mediaSession' in navigator)) return;
    const s = current();
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: s.title, artist: s.artist, album: 'PatOS Music', artwork: [{ src: artwork(s), sizes: '256x256', type: 'image/png' }] });
      navigator.mediaSession.playbackState = E.playing ? 'playing' : 'paused';
      if (!E.msWired) {
        E.msWired = true;
        navigator.mediaSession.setActionHandler('play', () => play());
        navigator.mediaSession.setActionHandler('pause', () => pause());
        navigator.mediaSession.setActionHandler('nexttrack', () => next());
        navigator.mediaSession.setActionHandler('previoustrack', () => prev());
      }
    } catch (e) {}
  }
  function emit() { mediaSession(); E.listeners.forEach((f) => f()); }
  function play() {
    const a = ensure(); if (!a) return;
    sinkPlay();
    if (E.custom) { E.el.play(); E.playing = true; emit(); return; }
    E.seed = E.idx * 9973 + 7 + Math.floor(E.step / 64);
    E.nextTime = a.ctx.currentTime + 0.05; E.playing = true;
    clearInterval(E.timer); E.timer = setInterval(schedule, 25); emit();
  }
  function pause() { E.playing = false; clearInterval(E.timer); if (E.el) E.el.pause(); if (E.sink) E.sink.pause(); emit(); }
  function stopCustom() { if (E.el) { E.el.pause(); } E.custom = null; }
  function select(i, autoplay) { stopCustom(); clearInterval(E.timer); E.idx = (i + SONGS.length) % SONGS.length; E.step = 0; if (autoplay !== false && (E.playing || autoplay)) play(); else emit(); }
  E.shuffle = PatOS.store.get('musicShuffle', false); E.repeat = PatOS.store.get('musicRepeat', 'all');
  function next() {
    if (E.shuffle && SONGS.length > 1) { let n; do { n = Math.floor(Math.random() * SONGS.length); } while (n === E.idx); select(n, true); }
    else if (E.repeat === 'off' && E.idx === SONGS.length - 1 && !E.custom) { select(0, false); pause(); }
    else select(E.idx + 1, true);
  }
  function songEnded() { if (E.repeat === 'one') { E.step = 0; if (E.custom && E.el) { E.el.currentTime = 0; E.el.play(); } else play(); } else next(); }
  function prev() { if (position().t > 3) { E.step = 0; emit(); } else select(E.idx - 1, true); }
  function playFile(name, src) {
    const a = ensure(); if (!a) return;
    pause();
    if (!E.el) { E.el = new Audio(); E.el.crossOrigin = 'anonymous'; const node = a.ctx.createMediaElementSource(E.el); node.connect(E.bus); E.el.addEventListener('ended', () => { if (E.repeat === 'one') { E.el.currentTime = 0; E.el.play(); } else { E.playing = false; emit(); } }); }
    E.el.src = src; E.custom = { title: name.replace(/\.[^.]+$/, ''), artist: 'Your Music', color: 'linear-gradient(135deg,#434343,#000)', hue: 0.55 };
    play();
  }
  function current() { return E.custom || SONGS[E.idx]; }
  PatOS.music = {
    toggle: () => (E.playing ? pause() : play()), next, prev,
    nowPlaying: () => (E.playing || E.step > 0 || E.custom ? Object.assign({ playing: E.playing }, current()) : null)
  };

  /* ---------- app window ---------- */
  PatOS.registerApp({
    id: 'music', name: 'Music', icon: 'music', width: 900, height: 580, dark: true, keywords: 'songs audio player visualizer',
    about: 'Every song is composed live by your computer. Import your own MP3s too!',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      const bImport = h('button', { class: 'tbtn', title: 'Play an audio file from your computer' }, '⬆ Import');
      win.toolbar.append(bImport);
      const list = h('div', { class: 'mu-list' });
      const stage = h('div', { class: 'mu-stage' });
      const canvas = h('canvas', { class: 'mu-canvas' });
      const art = h('div', { class: 'mu-art' }); const tt = h('div', { class: 'mu-tt' }); const ar = h('div', { class: 'mu-ar' });
      const bPrev = h('button', { class: 'mu-b', title: 'Previous', html: PatOS.sym('prev') }); const bPlay = h('button', { class: 'mu-b big', title: 'Play', html: PatOS.sym('play') }); const bNext = h('button', { class: 'mu-b', title: 'Next', html: PatOS.sym('next') });
      const svg = (d) => '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
      const bShuf = h('button', { class: 'mu-b sm', title: 'Shuffle', html: svg('<path d="M3 7h3c4 0 6 10 10 10h5M17 14l4 3-4 3M3 17h3c1.5 0 2.7-1.4 3.8-3M14.2 10C15.3 8.4 16.5 7 18 7h3M17 4l4 3-4 3"/>') });
      const bRep = h('button', { class: 'mu-b sm', title: 'Repeat', html: svg('<path d="M4 11V9a3 3 0 0 1 3-3h13M17 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H4M7 21l-3-3 3-3"/>') });
      const syncModes = () => { bShuf.classList.toggle('on', E.shuffle); bRep.classList.toggle('on', E.repeat !== 'off'); bRep.classList.toggle('one', E.repeat === 'one'); bRep.title = PatOS.t({ off: 'Repeat off', all: 'Repeat all', one: 'Repeat one' }[E.repeat]); };
      bShuf.onclick = () => { E.shuffle = !E.shuffle; PatOS.store.set('musicShuffle', E.shuffle); syncModes(); };
      bRep.onclick = () => { E.repeat = { off: 'all', all: 'one', one: 'off' }[E.repeat]; PatOS.store.set('musicRepeat', E.repeat); syncModes(); };
      syncModes();
      const prog = h('div', { class: 'mu-prog scrub' }, h('span')); const tA = h('small'); const tB = h('small');
      const vol = h('input', { type: 'range', min: 0, max: 100, value: Math.round(PatOS.settings.volume * 100), class: 'mu-vol' });
      const bar = h('div', { class: 'mu-bar' }, art, h('div', { class: 'mu-info' }, tt, ar), h('div', { class: 'mu-ctl' }, bShuf, bPrev, bPlay, bNext, bRep), h('div', { class: 'mu-time' }, tA, prog, tB), h('span', {}, '🔊'), vol);
      stage.appendChild(canvas);
      win.body.append(h('div', { class: 'mu-wrap' }, list, stage), bar);

      const fmt = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
      function renderList() {
        list.innerHTML = ''; list.appendChild(h('div', { class: 'mu-h' }, 'PatOS Originals'));
        SONGS.forEach((s, i) => {
          const it = h('div', { class: 'mu-item' + (!E.custom && i === E.idx ? ' on' : '') }, h('div', { class: 'mu-mini', style: { background: s.color } }), h('div', {}, h('b', {}, s.title), h('small', {}, s.artist)), h('span', {}, fmt(songDuration(i))));
          it.onclick = () => select(i, true);
          list.appendChild(it);
        });
        const files = []; PatOS.fs.walk('/', (p, n) => { if (PatOS.fileKind(p, n) === 'audio') files.push(p); });
        if (files.length) {
          list.appendChild(h('div', { class: 'mu-h' }, 'Your Files'));
          files.forEach((p) => { const it = h('div', { class: 'mu-item' + (E.custom && E.custom.title === PatOS.fs.basename(p).replace(/\.[^.]+$/, '') ? ' on' : '') }, h('div', { class: 'mu-mini', style: { background: '#333' } }, '♪'), h('div', {}, h('b', {}, PatOS.fs.basename(p)), h('small', {}, PatOS.fs.dirname(p)))); it.onclick = () => playFile(PatOS.fs.basename(p), PatOS.fs.read(p)); list.appendChild(it); });
        }
      }
      function sync() {
        const s = current();
        art.style.background = s.color; tt.textContent = s.title; ar.textContent = s.artist;
        bPlay.innerHTML = PatOS.sym(E.playing ? 'pause' : 'play'); bPlay.title = PatOS.t(E.playing ? 'Pause' : 'Play');
        renderList(); win.setTitle(s.title);
        if (viz) viz.setHue(s.hue);
      }
      bPlay.onclick = () => PatOS.music.toggle(); bNext.onclick = next; bPrev.onclick = prev;
      vol.oninput = () => PatOS.setSetting('volume', vol.value / 100);
      prog.addEventListener('pointerdown', (e) => {
        const r = prog.getBoundingClientRect(); const f = (e.clientX - r.left) / r.width;
        if (E.custom && E.el && E.el.duration) E.el.currentTime = f * E.el.duration;
        else { E.step = Math.floor(f * BARS * 16); }
      });
      bImport.onclick = async () => {
        const saved = await PatOS.importFiles('/Music', 'audio/*');
        if (saved[0]) playFile(PatOS.fs.basename(saved[0]), PatOS.fs.read(saved[0]));
      };
      E.listeners.add(sync);
      const ti = setInterval(() => { const p = position(); tA.textContent = fmt(p.t); tB.textContent = '-' + fmt(Math.max(0, p.d - p.t)); prog.firstChild.style.width = (p.d ? p.t / p.d * 100 : 0) + '%'; }, 250);

      /* three.js visualizer */
      let viz = null;
      if (PatOS.has3D) {
        const renderer = PatOS.makeRenderer(canvas);
        const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x05010d, 0.035);
        const cam = new THREE.PerspectiveCamera(55, 1, 0.1, 200); cam.position.set(0, 6, 16); cam.lookAt(0, 0, 0);
        const N = 64; const bars = [];
        const group = new THREE.Group(); scene.add(group);
        const geo = new THREE.BoxGeometry(0.35, 1, 0.35); geo.translate(0, 0.5, 0);
        for (let i = 0; i < N; i++) {
          const m = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000, metalness: 0.3, roughness: 0.4 });
          const b = new THREE.Mesh(geo, m); const a = (i / N) * Math.PI * 2;
          b.position.set(Math.cos(a) * 6, 0, Math.sin(a) * 6); b.rotation.y = -a; group.add(b); bars.push(b);
        }
        const sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 3), new THREE.MeshStandardMaterial({ color: 0xffffff, wireframe: true, emissive: 0x222222 }));
        scene.add(sphere);
        const base = sphere.geometry.attributes.position.array.slice();
        const pts = new THREE.BufferGeometry(); const pp = new Float32Array(1500 * 3);
        for (let i = 0; i < 1500; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(15 + Math.random() * 30); pp.set([v.x, v.y, v.z], i * 3); }
        pts.setAttribute('position', new THREE.BufferAttribute(pp, 3));
        const stars = new THREE.Points(pts, new THREE.PointsMaterial({ size: 0.12, color: 0xffffff, transparent: true, opacity: 0.7 })); scene.add(stars);
        scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const pl = new THREE.PointLight(0xffffff, 120, 50); pl.position.set(0, 8, 0); scene.add(pl);
        const data = new Uint8Array(256);
        let hue = 0.88, raf, t = 0;
        const orb = PatOS.orbit(canvas, cam, new THREE.Vector3(0, 1, 0), { dist: 17, phi: 1.2, auto: 0.0025 });
        viz = { setHue(x) { hue = x; } };
        const resize = () => { const w = stage.clientWidth, hh = stage.clientHeight; if (!w || !hh) return; renderer.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix(); };
        win.on('resize', resize); resize();
        const loop = () => {
          raf = requestAnimationFrame(loop);
          if (win.minimized || document.hidden) return;
          t += 0.016;
          if (E.analyser) E.analyser.getByteFrequencyData(data); else data.fill(0);
          let bass = 0; for (let i = 0; i < 8; i++) bass += data[i]; bass /= 8 * 255;
          bars.forEach((b, i) => {
            const v = data[Math.floor((i < N / 2 ? i : N - i) * 2.5) + 2] / 255;
            b.scale.y = 0.15 + v * 7 + (E.playing ? 0 : Math.sin(t * 2 + i * 0.3) * 0.1 + 0.1);
            const c = new THREE.Color().setHSL((hue + i / N * 0.25) % 1, 0.85, 0.45 + v * 0.3);
            b.material.color.copy(c); b.material.emissive.copy(c).multiplyScalar(v * 0.8);
          });
          const p = sphere.geometry.attributes.position;
          for (let i = 0; i < p.count; i++) {
            const k = i * 3; const n = 1 + bass * 0.35 * Math.sin(i * 0.7 + t * 4) + (data[i % 64] / 255) * 0.18;
            p.array[k] = base[k] * n; p.array[k + 1] = base[k + 1] * n; p.array[k + 2] = base[k + 2] * n;
          }
          p.needsUpdate = true;
          sphere.rotation.y += 0.004 + bass * 0.03; sphere.rotation.x += 0.002;
          sphere.material.color.setHSL((hue + 0.5) % 1, 0.8, 0.6);
          group.rotation.y += 0.002; stars.rotation.y -= 0.0005;
          pl.color.setHSL(hue, 0.9, 0.6);
          orb.update(); renderer.render(scene, cam);
        };
        loop();
        win.on('closed', () => { cancelAnimationFrame(raf); renderer.dispose(); });
      } else stage.appendChild(h('div', { class: 'mu-no3d' }, '🎵'));

      win.on('closed', () => { E.listeners.delete(sync); clearInterval(ti); });
      win._args = (a) => { if (a.path) playFile(PatOS.fs.basename(a.path), PatOS.fs.read(a.path)); };
      sync();
      if (args.path) win._args(args);
    },
    onArgs(win, args) { win._args(args); }
  });
})();
