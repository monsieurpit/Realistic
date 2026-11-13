/* Music — your songs (with playlists, a queue and their own artwork), plus songs PatOS composes live (Web Audio), and a 3D visualizer. */
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

  /* =================== your music: tags, artwork, length =================== */
  // MP3 files carry their title, artist, album and cover picture in an "ID3" tag at the start
  const META_KEY = 'musicMeta';
  let metaCache = null;
  const metas = () => (metaCache = metaCache || PatOS.store.get(META_KEY, {}) || {});
  const saveMeta = PatOS.debounce(() => PatOS.store.set(META_KEY, metas()), 600);
  function decodeText(bytes, enc) {
    try {
      if (enc === 0) return new TextDecoder('latin1').decode(bytes);
      if (enc === 1) return new TextDecoder(bytes[0] === 0xfe ? 'utf-16be' : 'utf-16le').decode(bytes.subarray(bytes[0] === 0xff || bytes[0] === 0xfe ? 2 : 0));
      if (enc === 2) return new TextDecoder('utf-16be').decode(bytes);
      return new TextDecoder('utf-8').decode(bytes);
    } catch (e) { return ''; }
  }
  const clean = (s) => String(s || '').replace(/\u0000+$/g, '').replace(/\u0000/g, ' / ').trim();
  async function readTags(blob) {
    const head = new Uint8Array(await blob.slice(0, 10).arrayBuffer());
    if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return {};
    const ver = head[3]; const size = (head[6] & 127) << 21 | (head[7] & 127) << 14 | (head[8] & 127) << 7 | (head[9] & 127);
    const d = new Uint8Array(await blob.slice(10, 10 + Math.min(size, 8 * 1024 * 1024)).arrayBuffer());
    const out = {}; let i = 0; const v22 = ver === 2;
    if (!v22 && head[5] & 0x40) { const ext = ver === 4 ? ((d[0] & 127) << 21 | (d[1] & 127) << 14 | (d[2] & 127) << 7 | (d[3] & 127)) : ((d[0] << 24) | (d[1] << 16) | (d[2] << 8) | d[3]) + 4; i = ext; }
    while (i + (v22 ? 6 : 10) <= d.length) {
      const id = String.fromCharCode(...d.subarray(i, i + (v22 ? 3 : 4))); if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
      let len; if (v22) len = d[i + 3] << 16 | d[i + 4] << 8 | d[i + 5]; else if (ver === 4) len = (d[i + 4] & 127) << 21 | (d[i + 5] & 127) << 14 | (d[i + 6] & 127) << 7 | (d[i + 7] & 127); else len = (d[i + 4] << 24 | d[i + 5] << 16 | d[i + 6] << 8 | d[i + 7]) >>> 0;
      const start = i + (v22 ? 6 : 10); const body = d.subarray(start, start + len); i = start + len;
      if (!len || start + len > d.length) break;
      const key = { TIT2: 'title', TT2: 'title', TPE1: 'artist', TP1: 'artist', TALB: 'album', TAL: 'album', TRCK: 'track', TRK: 'track' }[id];
      if (key) out[key] = clean(decodeText(body.subarray(1), body[0]));
      if ((id === 'APIC' || id === 'PIC') && !out.pic) {
        const enc = body[0]; let k = 1; let mime = '';
        if (id === 'PIC') { mime = 'image/' + String.fromCharCode(...body.subarray(1, 4)).toLowerCase().replace('jpg', 'jpeg'); k = 4; }
        else { while (k < body.length && body[k]) mime += String.fromCharCode(body[k++]); k++; }
        k++; // picture type
        if (enc === 1 || enc === 2) { while (k + 1 < body.length && (body[k] || body[k + 1])) k += 2; k += 2; } else { while (k < body.length && body[k]) k++; k++; }
        out.pic = new Blob([body.subarray(k)], { type: /image\//.test(mime) ? mime : 'image/jpeg' });
      }
    }
    return out;
  }
  async function thumb(blob) {
    try { const bmp = await createImageBitmap(blob); const s = 160; const c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d'); const k = Math.max(s / bmp.width, s / bmp.height); x.drawImage(bmp, (s - bmp.width * k) / 2, (s - bmp.height * k) / 2, bmp.width * k, bmp.height * k); return c.toDataURL('image/jpeg', 0.8); } catch (e) { return ''; }
  }
  function durationOf(url) {
    return new Promise((res) => { const a = new Audio(); a.preload = 'metadata'; const done = (v) => { a.removeAttribute('src'); a.load(); res(v); }; a.onloadedmetadata = () => done(isFinite(a.duration) ? a.duration : 0); a.onerror = () => done(0); setTimeout(() => done(0), 8000); a.src = url; });
  }
  const base = (p) => PatOS.fs.basename(p).replace(/\.[^.]+$/, '');
  function metaOf(path) {
    const n = PatOS.fs.get(path); const m = metas()[path];
    const stamp = n ? (n.mtime || 0) + ':' + (n.size || (n.content || '').length) : '';
    if (m && m.stamp === stamp) return m;
    return { title: base(path), artist: '', album: '', dur: 0, art: '', stamp, pending: true };
  }
  // read tags for the files that don't have them yet, one at a time, in the background
  let reading = false;
  async function readPending(paths, onDone) {
    if (reading) return; reading = true;
    try {
      for (const p of paths) {
        const m = metaOf(p); if (!m.pending) continue;
        const blob = await PatOS.fs.getBlob(p); if (!blob) continue;
        let tags = {}; try { tags = await readTags(blob); } catch (e) {}
        const url = URL.createObjectURL(blob); const dur = await durationOf(url); URL.revokeObjectURL(url);
        metas()[p] = { title: tags.title || base(p), artist: tags.artist || '', album: tags.album || '', track: parseInt(tags.track, 10) || 0, dur, art: tags.pic ? await thumb(tags.pic) : '', stamp: m.stamp, added: Date.now() };
        saveMeta(); onDone && onDone();
      }
    } finally { reading = false; }
  }
  function libraryPaths() { const out = []; PatOS.fs.walk('/', (p, n) => { if (!/\/\./.test(p) && n.type === 'file' && PatOS.fileKind(p, n) === 'audio') out.push(p); }); return out; }

  /* =================== the queue and playback =================== */
  // an item is { gen: index } for a PatOS Original, or { path } for one of your files
  E.queue = []; E.qi = 0; E.base = null;
  E.shuffle = PatOS.store.get('musicShuffle', false); E.repeat = PatOS.store.get('musicRepeat', 'all');
  const cur = () => E.queue[E.qi] || null;
  function info(item) {
    item = item || cur(); if (!item) return null;
    if (item.gen != null) { const s = SONGS[item.gen]; return Object.assign({ gen: item.gen, album: 'PatOS Originals', dur: songDuration(item.gen) }, s); }
    const m = metaOf(item.path); return { path: item.path, title: m.title, artist: m.artist || PatOS.t('Unknown Artist'), album: m.album, dur: m.dur, art: m.art, color: 'linear-gradient(135deg,#3a3a40,#121216)', hue: 0.55 };
  }
  function position() {
    const it = cur(); if (!it) return { t: 0, d: 0 };
    if (it.path) return { t: (E.el && E.el.currentTime) || 0, d: (E.el && isFinite(E.el.duration) ? E.el.duration : 0) || info(it).dur || 0 };
    return { t: E.step * (60 / SONGS[it.gen].bpm / 4), d: songDuration(it.gen) };
  }
  function directOut() { if (E.direct) return; E.direct = true; try { E.analyser.disconnect(); } catch (e) {} E.analyser.connect(PatOS.audio().out); E.sink = null; }
  function sinkPlay() { if (E.sink) E.sink.play().catch(() => directOut()); }
  function elem(a) {
    if (E.el) return E.el;
    E.el = new Audio(); E.el.preload = 'auto';
    const node = a.ctx.createMediaElementSource(E.el); node.connect(E.bus);
    E.el.addEventListener('ended', () => songEnded());
    E.el.addEventListener('error', () => { if (cur() && cur().path && E.playing) { PatOS.notify({ title: PatOS.t('This song can’t be played'), body: info().title, icon: 'music' }); next(); } });
    return E.el;
  }
  let loadedPath = null, srcUrl = null;
  async function play() {
    const a = ensure(); if (!a) return;
    const it = cur(); if (!it) { if (!E.queue.length) setQueue(SONGS.map((s, i) => ({ gen: i })), 0); return play(); }
    sinkPlay(); E.playing = true;
    if (it.path) {
      clearInterval(E.timer);
      const el = elem(a);
      if (loadedPath !== it.path) {
        const keepT = E.resumeAt || 0; E.resumeAt = 0;
        const url = await PatOS.fs.blobURL(it.path);
        if (cur() !== it || !E.playing) return; // changed or paused while loading
        if (!url) { E.playing = false; PatOS.notify({ title: PatOS.t('This song can’t be played'), body: base(it.path), icon: 'music' }); return emit(); }
        srcUrl = url; el.src = url; loadedPath = it.path; if (keepT) el.currentTime = keepT;
      }
      if (!E.playing) return emit();
      try { await el.play(); } catch (e) { if (e && e.name !== 'AbortError') { E.playing = false; } }
    } else {
      if (E.el) E.el.pause();
      E.idx = it.gen; E.seed = E.idx * 9973 + 7 + Math.floor(E.step / 64);
      E.nextTime = a.ctx.currentTime + 0.05; clearInterval(E.timer); E.timer = setInterval(schedule, 25);
    }
    emit(); saveState();
  }
  function pause() { E.playing = false; clearInterval(E.timer); if (E.el) E.el.pause(); if (E.sink) E.sink.pause(); emit(); saveState(); }
  function go(i, autoplay) {
    clearInterval(E.timer); if (E.el) E.el.pause(); E.step = 0; loadedPath = null;
    E.qi = Math.max(0, Math.min(E.queue.length - 1, i));
    if (autoplay) play(); else { E.playing = false; emit(); saveState(); }
  }
  function next(fromEnd) {
    if (!E.queue.length) return;
    if (E.qi + 1 < E.queue.length) return go(E.qi + 1, true);
    if (E.repeat === 'all' || !fromEnd) return go(0, E.repeat === 'all' || E.playing);
    go(0, false); // the end of the list
  }
  function songEnded() { if (E.repeat === 'one') { E.step = 0; if (cur() && cur().path && E.el) { E.el.currentTime = 0; E.el.play().catch(() => {}); } else play(); return; } next(true); }
  function prev() { if (position().t > 3) return seek(0); go(E.qi - 1 < 0 ? (E.repeat === 'all' ? E.queue.length - 1 : 0) : E.qi - 1, true); }
  function seek(t) { const it = cur(); if (!it) return; if (it.path && E.el) { E.el.currentTime = Math.max(0, t); } else if (it.gen != null) E.step = Math.max(0, Math.floor(t / (60 / SONGS[it.gen].bpm / 4))); emit(); }
  const shuffled = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function setQueue(items, start, play2) {
    E.base = items.slice();
    if (E.shuffle) { const first = items[start || 0]; E.queue = [first, ...shuffled(items.filter((_, k) => k !== (start || 0)))]; E.qi = 0; }
    else { E.queue = items.slice(); E.qi = start || 0; }
    go(E.qi, !!play2);
  }
  function setShuffle(on) {
    E.shuffle = on; PatOS.store.set('musicShuffle', on); const it = cur();
    if (!E.queue.length || !it) return emit();
    if (on) { E.base = E.base || E.queue.slice(); E.queue = [it, ...shuffled(E.queue.filter((x, k) => k !== E.qi))]; E.qi = 0; }
    else if (E.base) { const k = E.base.findIndex((x) => same(x, it)); E.queue = E.base.slice(); E.qi = Math.max(0, k); }
    emit(); saveState();
  }
  const same = (a, b) => a && b && (a.path ? a.path === b.path : a.gen === b.gen);
  function playNext(item) { if (!E.queue.length) return setQueue([item], 0, true); E.queue.splice(E.qi + 1, 0, item); emit(); saveState(); }
  function addToQueue(item) { if (!E.queue.length) return setQueue([item], 0, false); E.queue.push(item); emit(); saveState(); }
  function removeFromQueue(i) { if (i === E.qi) return; E.queue.splice(i, 1); if (i < E.qi) E.qi--; emit(); saveState(); }
  // remember the queue and where we were, so a reload doesn't lose your place
  const saveState = PatOS.debounce(() => { PatOS.store.set('musicState', { queue: E.queue.slice(0, 500), qi: E.qi, t: position().t }); }, 800);
  (function restore() {
    const st = PatOS.store.get('musicState', null);
    if (st && Array.isArray(st.queue) && st.queue.length) { E.queue = st.queue.filter((x) => x && (x.gen != null ? SONGS[x.gen] : PatOS.fs.get(x.path))); E.qi = Math.min(E.queue.length - 1, Math.max(0, st.qi || 0)); const it = cur(); if (it && it.path) E.resumeAt = st.t || 0; else if (it) E.step = Math.floor((st.t || 0) / (60 / SONGS[it.gen].bpm / 4)); }
  })();
  setInterval(() => { if (E.playing) saveState(); }, 5000);

  let artCache = {};
  function artwork(s) {
    if (s.art) return s.art;
    const key = s.title + '|' + s.color; if (artCache[key]) return artCache[key];
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const m = String(s.color).match(/#[0-9a-f]{6}/gi) || ['#ff6482', '#5b2bff'];
    const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, m[0]); g.addColorStop(1, m[1] || m[0]); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.fillStyle = 'rgba(255,255,255,.9)'; x.font = '700 120px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('♫', 128, 136);
    return (artCache[key] = c.toDataURL('image/png'));
  }
  function mediaSession() {
    if (!('mediaSession' in navigator)) return;
    const s = info(); if (!s) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: s.title, artist: s.artist, album: s.album || 'PatOS Music', artwork: [{ src: artwork(s), sizes: s.art ? '160x160' : '256x256', type: s.art ? 'image/jpeg' : 'image/png' }] });
      navigator.mediaSession.playbackState = E.playing ? 'playing' : 'paused';
      if (!E.msWired) {
        E.msWired = true;
        navigator.mediaSession.setActionHandler('play', () => play());
        navigator.mediaSession.setActionHandler('pause', () => pause());
        navigator.mediaSession.setActionHandler('nexttrack', () => next());
        navigator.mediaSession.setActionHandler('previoustrack', () => prev());
        try { navigator.mediaSession.setActionHandler('seekto', (d) => seek(d.seekTime)); } catch (e) {}
      }
    } catch (e) {}
  }
  function emit() { mediaSession(); E.listeners.forEach((f) => { try { f(); } catch (e) {} }); PatOS.emit('music'); } // (the Pill follows it: js/pill.js)
  PatOS.music = {
    toggle: () => (E.playing ? pause() : play()), next: () => next(), prev,
    nowPlaying: () => { const s = (E.playing || E.step > 0 || (E.el && E.el.currentTime > 0)) ? info() : null; return s ? Object.assign({ playing: E.playing }, s) : null; },
    playPath: (p) => setQueue([{ path: p }], 0, true),
    position: () => position(),
    // how loud it is right now, in a few bands (0..1), for the Pill's bars
    levels(n) { n = n || 4; if (!E.analyser || !E.playing) return new Array(n).fill(0); const d = new Uint8Array(E.analyser.frequencyBinCount); E.analyser.getByteFrequencyData(d); const out = []; for (let i = 0; i < n; i++) { const a = Math.floor(Math.pow(i / n, 1.6) * d.length * .7), b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / n, 1.6) * d.length * .7)); let m = 0; for (let j = a; j < b; j++) m = Math.max(m, d[j]); out.push(m / 255); } return out; }
  };

  /* =================== the app =================== */
  const T = (s) => PatOS.t(s);
  const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const svg = (d) => '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  PatOS.registerApp({
    id: 'music', name: 'Music', icon: 'music', width: 1040, height: 660, dark: true, keywords: 'songs audio player playlist mp3 musique',
    about: 'Your songs, with playlists and a queue. It can make music too.',
    launch(win, args) {
      win.el.classList.add('has-toolbar', 'mu-win');
      let view = PatOS.store.get('musicView', 'songs'), sub = null, q = '';
      const playlists = () => PatOS.store.get('musicPlaylists', []) || [];
      const savePlaylists = (l) => PatOS.store.set('musicPlaylists', l);

      const search = h('input', { class: 'field', type: 'search', placeholder: T('Search your music'), 'aria-label': T('Search your music'), style: { width: '220px' } });
      const bAdd = h('button', { class: 'btn' }, T('Add Music…'));
      win.toolbar.append(h('div', { style: { flex: 1 } }), search, bAdd);
      const side = h('div', { class: 'mu-side' }); const main = h('div', { class: 'mu-main' }); const queueBox = h('div', { class: 'mu-queue hidden' });
      // bottom bar
      const art = h('div', { class: 'mu-art' }); const tt = h('div', { class: 'mu-tt' }); const ar = h('div', { class: 'mu-ar' });
      const bPrev = h('button', { class: 'mu-b', title: T('Previous'), html: PatOS.sym('prev') }); const bPlay = h('button', { class: 'mu-b big', title: T('Play'), html: PatOS.sym('play') }); const bNext = h('button', { class: 'mu-b', title: T('Next'), html: PatOS.sym('next') });
      const bShuf = h('button', { class: 'mu-b sm', title: T('Shuffle'), html: svg('<path d="M3 7h3c4 0 6 10 10 10h5M17 14l4 3-4 3M3 17h3c1.5 0 2.7-1.4 3.8-3M14.2 10C15.3 8.4 16.5 7 18 7h3M17 4l4 3-4 3"/>') });
      const bRep = h('button', { class: 'mu-b sm', title: T('Repeat'), html: svg('<path d="M4 11V9a3 3 0 0 1 3-3h13M17 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H4M7 21l-3-3 3-3"/>') });
      const bQueue = h('button', { class: 'mu-b sm', title: T('Up Next'), html: svg('<path d="M4 6h12M4 12h12M4 18h8M18 15v6M15 18h6"/>') });
      const bViz = h('button', { class: 'mu-b sm', title: T('Now Playing'), html: svg('<path d="M4 18V12M8 18V6M12 18v-9M16 18V4M20 18v-6"/>') });
      const prog = h('div', { class: 'mu-prog scrub', role: 'slider', 'aria-label': T('Position'), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', tabindex: '0' }, h('span')); const tA = h('small'); const tB = h('small');
      const vol = h('input', { type: 'range', min: 0, max: 100, value: Math.round(PatOS.settings.volume * 100), class: 'mu-vol', 'aria-label': T('Volume') });
      const bar = h('div', { class: 'mu-bar' }, art, h('div', { class: 'mu-info' }, tt, ar), h('div', { class: 'mu-ctl' }, bShuf, bPrev, bPlay, bNext, bRep), h('div', { class: 'mu-time' }, tA, prog, tB), bQueue, bViz, vol);
      win.body.append(h('div', { class: 'mu-wrap2' }, side, main, queueBox), bar);

      /* ----- sidebar ----- */
      function renderSide() {
        side.innerHTML = '';
        const item = (key, label, ic, extra) => { const el = h('div', { class: 'mu-si' + (view === key ? ' on' : ''), role: 'button', tabindex: '0' }, h('span', { class: 'mu-sic', html: svg(ic) }), h('span', {}, label)); el.onclick = () => { view = key; sub = null; PatOS.store.set('musicView', key); renderSide(); renderMain(); }; el.onkeydown = (e) => { if (e.key === 'Enter') el.click(); }; if (extra) extra(el); return el; };
        side.append(h('div', { class: 'mu-sh' }, T('Library')),
          item('songs', T('Songs'), '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
          item('albums', T('Albums'), '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4"/>'),
          item('artists', T('Artists'), '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'),
          item('recent', T('Recently Added'), '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
          item('originals', T('PatOS Originals'), '<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/>'),
          h('div', { class: 'mu-sh' }, T('Playlists')));
        playlists().forEach((pl) => side.appendChild(item('pl:' + pl.id, pl.name, '<path d="M4 6h12M4 12h12M4 18h8M18 13v8"/>', (el) => {
          el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop'); }); el.addEventListener('dragleave', () => el.classList.remove('drop'));
          el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('drop'); const p = e.dataTransfer.getData('text/x-patos-song'); if (p) addTo(pl.id, [p]); });
          el.oncontextmenu = (e) => { e.preventDefault(); PatOS.menu([{ label: T('Rename Playlist…'), action: async () => { const n = await PatOS.ask(T('Rename Playlist…'), pl.name, { icon: 'music', ok: T('Rename') }); if (n) { const l = playlists(); l.find((x) => x.id === pl.id).name = n; savePlaylists(l); renderSide(); renderMain(); } } }, { label: T('Delete Playlist'), action: async () => { if (await PatOS.confirmBox(T('Delete this playlist?'), T('The songs stay in your library.'), { ok: T('Delete'), danger: true, icon: 'music' })) { savePlaylists(playlists().filter((x) => x.id !== pl.id)); if (view === 'pl:' + pl.id) view = 'songs'; renderSide(); renderMain(); } } }], e.clientX, e.clientY); };
        })));
        side.appendChild(h('button', { class: 'mu-newpl', onclick: () => newPlaylist() }, '+ ' + T('New Playlist')));
      }
      async function newPlaylist(songs) {
        const n = await PatOS.ask(T('New Playlist'), T('My Playlist'), { icon: 'music', ok: T('Create') }); if (!n) return null;
        const l = playlists(); const pl = { id: PatOS.uid(), name: n, tracks: songs || [] }; l.push(pl); savePlaylists(l); renderSide(); return pl;
      }
      function addTo(id, paths) { const l = playlists(); const pl = l.find((x) => x.id === id); if (!pl) return; paths.forEach((p) => { if (!pl.tracks.includes(p)) pl.tracks.push(p); }); savePlaylists(l); PatOS.notify({ title: T('Added to') + ' ' + pl.name, body: paths.length === 1 ? metaOf(paths[0]).title : paths.length + ' ' + T('songs'), icon: 'music', duration: 2500 }); if (view === 'pl:' + id) renderMain(); }

      /* ----- the main list ----- */
      const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      function songsFor() {
        const all = libraryPaths();
        let list;
        if (view === 'recent') list = all.slice().sort((a, b) => (metas()[b] ? metas()[b].added || 0 : Date.now()) - (metas()[a] ? metas()[a].added || 0 : Date.now()) || ((PatOS.fs.get(b) || {}).mtime || 0) - ((PatOS.fs.get(a) || {}).mtime || 0)).slice(0, 50);
        else if (view.startsWith('pl:')) { const pl = playlists().find((x) => 'pl:' + x.id === view); list = pl ? pl.tracks.filter((p) => PatOS.fs.get(p)) : []; }
        else list = all.slice().sort((a, b) => { const A = metaOf(a), B = metaOf(b); return (!A.artist - !B.artist) || (A.artist || '').localeCompare(B.artist || '') || (A.album || '').localeCompare(B.album || '') || (A.track || 0) - (B.track || 0) || A.title.localeCompare(B.title); });
        if (sub) list = list.filter((p) => (sub.kind === 'album' ? (metaOf(p).album || T('Unknown Album')) === sub.name && (metaOf(p).artist || '') === sub.artist : (metaOf(p).artist || T('Unknown Artist')) === sub.name));
        if (q) list = list.filter((p) => { const m = metaOf(p); return fold(m.title + ' ' + m.artist + ' ' + m.album + ' ' + PatOS.fs.basename(p)).includes(fold(q)); });
        return list;
      }
      function header(title, items, extra) {
        const bPlayAll = h('button', { class: 'btn primary', disabled: !items.length }, '▶  ' + T('Play')); bPlayAll.onclick = () => { if (E.shuffle) setShuffle(false); setQueue(items, 0, true); };
        const bShuffle = h('button', { class: 'btn', disabled: !items.length }, T('Shuffle')); bShuffle.onclick = () => { E.shuffle = true; PatOS.store.set('musicShuffle', true); setQueue(items, Math.floor(Math.random() * items.length), true); syncModes(); };
        return h('div', { class: 'mu-head' }, h('div', {}, h('h1', {}, title), extra ? h('small', {}, extra) : null), h('div', { class: 'mu-hbtns' }, bPlayAll, bShuffle));
      }
      function songTable(paths) {
        const rows = h('div', { class: 'mu-table', role: 'list' });
        rows.appendChild(h('div', { class: 'mu-tr mu-th' }, h('span', {}, '#'), h('span', {}, T('Title')), h('span', {}, T('Artist')), h('span', {}, T('Album')), h('span', {}, T('Duration'))));
        const items = paths.map((p) => ({ path: p }));
        paths.forEach((p, i) => {
          const m = metaOf(p); const playingNow = cur() && cur().path === p;
          const row = h('div', { class: 'mu-tr' + (playingNow ? ' on' : ''), draggable: 'true', role: 'listitem', tabindex: '0' },
            h('span', { class: 'mu-n' }, playingNow && E.playing ? h('i', { class: 'mu-eq' }, h('b'), h('b'), h('b')) : String(i + 1)),
            h('span', { class: 'mu-t' }, m.art ? h('img', { src: m.art, alt: '' }) : h('i', { class: 'mu-noart' }, '♪'), h('b', {}, m.title)),
            h('span', {}, m.artist || T('Unknown Artist')), h('span', {}, m.album || ''), h('span', {}, m.dur ? fmt(m.dur) : ''));
          row.onclick = (e) => { if (e.detail > 1) return; setQueue(items, i, true); };
          row.onkeydown = (e) => { if (e.key === 'Enter') setQueue(items, i, true); };
          row.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/x-patos-song', p));
          row.oncontextmenu = (e) => { e.preventDefault(); songMenu(p, e.clientX, e.clientY); };
          rows.appendChild(row);
        });
        return rows;
      }
      function songMenu(p, x, y) {
        const pls = playlists(); const inPl = view.startsWith('pl:') ? view.slice(3) : null;
        PatOS.menu([
          { label: T('Play Next'), action: () => playNext({ path: p }) },
          { label: T('Add to Up Next'), action: () => addToQueue({ path: p }) },
          { divider: true },
          { header: T('Add to Playlist') },
          ...pls.map((pl) => ({ label: pl.name, action: () => addTo(pl.id, [p]) })),
          { label: T('New Playlist…'), action: async () => { const pl = await newPlaylist([p]); if (pl) PatOS.notify({ title: T('Added to') + ' ' + pl.name, body: metaOf(p).title, icon: 'music', duration: 2500 }); } },
          { divider: true },
          inPl ? { label: T('Remove from Playlist'), action: () => { const l = playlists(); const pl = l.find((x2) => x2.id === inPl); pl.tracks = pl.tracks.filter((t) => t !== p); savePlaylists(l); renderMain(); } } : null,
          { label: T('Show in Piles'), action: () => PatOS.launch('finder', { path: PatOS.fs.dirname(p) }) }
        ].filter(Boolean), x, y);
      }
      function groups(kind) {
        const map = new Map();
        libraryPaths().forEach((p) => { const m = metaOf(p); const key = kind === 'album' ? (m.album || T('Unknown Album')) + '\u0000' + (m.artist || '') : (m.artist || T('Unknown Artist')); if (!map.has(key)) map.set(key, { name: kind === 'album' ? (m.album || T('Unknown Album')) : key, artist: m.artist || '', art: m.art, n: 0 }); const g = map.get(key); g.n++; if (!g.art && m.art) g.art = m.art; });
        return [...map.values()].filter((g) => !q || fold(g.name + ' ' + g.artist).includes(fold(q))).sort((a, b) => a.name.localeCompare(b.name));
      }
      function renderMain() {
        main.innerHTML = ''; main.classList.remove('viz');
        if (vizOn) return showViz();
        if (view === 'originals') {
          const items = SONGS.map((s, i) => ({ gen: i }));
          main.appendChild(header(T('PatOS Originals'), items, T('Songs composed live by PatOS')));
          const list = h('div', { class: 'mu-table' });
          SONGS.forEach((s, i) => { const on = cur() && cur().gen === i; const row = h('div', { class: 'mu-tr' + (on ? ' on' : ''), tabindex: '0' }, h('span', { class: 'mu-n' }, on && E.playing ? h('i', { class: 'mu-eq' }, h('b'), h('b'), h('b')) : String(i + 1)), h('span', { class: 'mu-t' }, h('i', { class: 'mu-noart', style: { background: s.color } }, '♫'), h('b', {}, s.title)), h('span', {}, s.artist), h('span', {}, 'PatOS Originals'), h('span', {}, fmt(songDuration(i)))); row.onclick = () => setQueue(items, i, true); list.appendChild(row); });
          main.appendChild(list); return;
        }
        if ((view === 'albums' || view === 'artists') && !sub) {
          const kind = view === 'albums' ? 'album' : 'artist'; const gs = groups(kind);
          main.appendChild(h('div', { class: 'mu-head' }, h('h1', {}, T(view === 'albums' ? 'Albums' : 'Artists'))));
          if (!gs.length) return main.appendChild(emptyLib());
          const grid = h('div', { class: 'mu-grid' });
          gs.forEach((g) => { const c = h('button', { class: 'mu-album' + (kind === 'artist' ? ' round' : '') }, g.art ? h('img', { src: g.art, alt: '' }) : h('div', { class: 'mu-ph' }, kind === 'artist' ? (g.name[0] || '?').toUpperCase() : '♪'), h('b', {}, g.name), h('small', {}, kind === 'album' ? g.artist || T('Unknown Artist') : g.n + ' ' + T(g.n === 1 ? 'song' : 'songs'))); c.onclick = () => { sub = { kind, name: g.name, artist: g.artist }; renderMain(); }; grid.appendChild(c); });
          main.appendChild(grid); return;
        }
        const paths = songsFor();
        const title = sub ? sub.name : view.startsWith('pl:') ? (playlists().find((x) => 'pl:' + x.id === view) || {}).name : T({ songs: 'Songs', recent: 'Recently Added', albums: 'Albums', artists: 'Artists' }[view] || 'Songs');
        const total = paths.reduce((s, p) => s + (metaOf(p).dur || 0), 0);
        const head = header(title, paths.map((p) => ({ path: p })), paths.length + ' ' + T(paths.length === 1 ? 'song' : 'songs') + (total ? ' · ' + (total < 60 ? Math.round(total) + ' s' : total < 3600 ? Math.round(total / 60) + ' min' : Math.floor(total / 3600) + ' h ' + Math.round(total % 3600 / 60) + ' min') : ''));
        if (sub) head.prepend(h('button', { class: 'tbtn mu-back', title: T('Back'), onclick: () => { sub = null; renderMain(); } }, '‹'));
        main.appendChild(head);
        if (!paths.length) { main.appendChild(view.startsWith('pl:') ? h('div', { class: 'mu-empty' }, h('p', {}, T('This playlist is empty. Drag songs onto it, or right-click a song › Add to Playlist.'))) : q ? h('div', { class: 'mu-empty' }, h('p', {}, T('No songs match your search.'))) : emptyLib()); return; }
        main.appendChild(songTable(paths));
        readPending(paths, refreshSoon);
      }
      const refreshSoon = PatOS.debounce(() => { if (!vizOn) { const st = main.scrollTop; renderMain(); main.scrollTop = st; } sync(); }, 400);
      function emptyLib() { return h('div', { class: 'mu-empty' }, h('div', { class: 'mu-bigic', html: PatOS.iconHTML('music') }), h('h2', {}, T('Add your music')), h('p', {}, T('Add MP3, M4A, WAV or OGG files, or drop them here. They go in the Music folder.')), h('div', { class: 'gm-row' }, h('button', { class: 'btn primary', onclick: () => bAdd.click() }, T('Add Music…')), h('button', { class: 'btn', onclick: () => { view = 'originals'; renderSide(); renderMain(); } }, T('Listen to PatOS Originals')))); }

      /* ----- adding music ----- */
      bAdd.onclick = async () => { const saved = await PatOS.importFiles('/Music', 'audio/*'); if (saved && saved.length) { PatOS.notify({ title: T('Music added'), body: saved.length + ' ' + T(saved.length === 1 ? 'song' : 'songs'), icon: 'music' }); view = 'recent'; renderSide(); renderMain(); } };
      win.body.addEventListener('dragover', (e) => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); win.body.classList.add('mu-drop'); } });
      win.body.addEventListener('dragleave', (e) => { if (e.target === win.body || !win.body.contains(e.relatedTarget)) win.body.classList.remove('mu-drop'); });
      win.body.addEventListener('drop', async (e) => {
        win.body.classList.remove('mu-drop'); const files = [...(e.dataTransfer.files || [])].filter((f) => /^audio\//.test(f.type) || /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(f.name)); if (!files.length) return; e.preventDefault();
        let n = 0; for (const f of files) { const name = PatOS.fs.uniqueName('/Music', f.name); try { if (f.size > 4 * 1024 * 1024) await PatOS.fs.writeBlob('/Music/' + name, f); else PatOS.fs.write('/Music/' + name, await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); })); n++; } catch (er) { PatOS.notify({ title: T('Couldn’t add'), body: f.name + ' · ' + er.message, icon: 'music' }); } }
        if (n) { PatOS.notify({ title: T('Music added'), body: n + ' ' + T(n === 1 ? 'song' : 'songs'), icon: 'music' }); view = 'recent'; renderSide(); renderMain(); }
      });
      search.addEventListener('input', PatOS.debounce(() => { q = search.value.trim(); if (vizOn) { vizOn = false; bViz.classList.remove('on'); } if ((view === 'originals') && q) view = 'songs'; renderSide(); renderMain(); }, 150));

      /* ----- Up Next ----- */
      function renderQueue() {
        if (queueBox.classList.contains('hidden')) return;
        queueBox.innerHTML = '';
        queueBox.appendChild(h('div', { class: 'mu-qhead' }, h('b', {}, T('Up Next')), h('button', { class: 'tbtn', title: T('Clear'), onclick: () => { E.queue = E.queue.slice(0, E.qi + 1); emit(); saveState(); } }, T('Clear'))));
        const list = h('div', { class: 'mu-qlist' });
        E.queue.forEach((it, i) => { if (i < E.qi) return; const s = info(it); const row = h('div', { class: 'mu-qi' + (i === E.qi ? ' on' : '') }, s.art ? h('img', { src: s.art, alt: '' }) : h('i', { class: 'mu-noart', style: { background: s.color } }, '♪'), h('div', {}, h('b', {}, s.title), h('small', {}, s.artist)), i === E.qi ? h('small', { class: 'mu-qnow' }, T('Now')) : h('button', { class: 'tbtn', title: T('Remove'), onclick: (e) => { e.stopPropagation(); removeFromQueue(i); } }, '×')); row.onclick = () => go(i, true); list.appendChild(row); });
        if (E.qi >= E.queue.length - 1) list.appendChild(h('p', { class: 'mu-qempty' }, T('Nothing else in the queue. Right-click a song › Play Next.')));
        queueBox.appendChild(list);
      }
      bQueue.onclick = () => { queueBox.classList.toggle('hidden'); bQueue.classList.toggle('on', !queueBox.classList.contains('hidden')); renderQueue(); };

      /* ----- the bottom bar ----- */
      const syncModes = () => { bShuf.classList.toggle('on', E.shuffle); bRep.classList.toggle('on', E.repeat !== 'off'); bRep.classList.toggle('one', E.repeat === 'one'); bRep.title = T({ off: 'Repeat off', all: 'Repeat all', one: 'Repeat one' }[E.repeat]); };
      bShuf.onclick = () => { setShuffle(!E.shuffle); syncModes(); };
      bRep.onclick = () => { E.repeat = { off: 'all', all: 'one', one: 'off' }[E.repeat]; PatOS.store.set('musicRepeat', E.repeat); syncModes(); };
      bPlay.onclick = () => PatOS.music.toggle(); bNext.onclick = () => next(); bPrev.onclick = prev;
      vol.oninput = () => PatOS.setSetting('volume', vol.value / 100);
      const onVol = (v) => { vol.value = Math.round(v * 100); }; PatOS.on('setting:volume', onVol);
      prog.addEventListener('pointerdown', (e) => { const r = prog.getBoundingClientRect(); const p = position(); if (p.d) seek((e.clientX - r.left) / r.width * p.d); });
      let lastKey = '';
      function sync() {
        const s = info(); syncModes();
        if (s) { art.style.background = s.art ? 'center/cover url("' + s.art + '")' : s.color; tt.textContent = s.title; ar.textContent = s.artist + (s.album ? ' · ' + s.album : ''); win.setTitle(s.title); }
        else { art.style.background = '#2c2c30'; tt.textContent = T('Not Playing'); ar.textContent = ''; win.setTitle(T('Music')); }
        bPlay.innerHTML = PatOS.sym(E.playing ? 'pause' : 'play'); bPlay.title = T(E.playing ? 'Pause' : 'Play');
        const key = (cur() ? JSON.stringify(cur()) : '') + E.playing + E.queue.length + E.qi;
        if (key !== lastKey) { lastKey = key; if (!vizOn) { const st = main.scrollTop; renderMain(); main.scrollTop = st; } renderQueue(); }
        if (viz) viz.setHue(s ? s.hue : 0.6);
      }
      E.listeners.add(sync);
      const ti = setInterval(() => { const p = position(); tA.textContent = fmt(p.t); tB.textContent = '-' + fmt(Math.max(0, p.d - p.t)); prog.setAttribute('aria-valuenow', String(p.d ? Math.round(Math.min(100, p.t / p.d * 100)) : 0)); prog.setAttribute('aria-valuetext', fmt(p.t)); prog.firstChild.style.width = (p.d ? Math.min(100, p.t / p.d * 100) : 0) + '%'; }, 250);
      win.el.addEventListener('keydown', (e) => {
        if (e.target.closest('input, textarea, select')) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); search.focus(); } return; }
        if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); PatOS.music.toggle(); }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); search.focus(); }
        else if (e.key === 'ArrowRight' && e.shiftKey) next(); else if (e.key === 'ArrowLeft' && e.shiftKey) prev();
        else if (e.key === 'ArrowRight') seek(position().t + 5); else if (e.key === 'ArrowLeft') seek(position().t - 5);
      });

      /* ----- Now Playing: big artwork and the 3D visualizer ----- */
      let vizOn = false, viz = null, vizStop = null;
      bViz.onclick = () => { vizOn = !vizOn; bViz.classList.toggle('on', vizOn); if (!vizOn && vizStop) { vizStop(); vizStop = null; viz = null; } renderMain(); };
      function showViz() {
        main.classList.add('viz'); const s = info();
        const stage = h('div', { class: 'mu-stage' }); const canvas = h('canvas', { class: 'mu-canvas' }); stage.appendChild(canvas);
        const card = h('div', { class: 'mu-nowcard' }, s && s.art ? h('img', { src: s.art, alt: '' }) : h('div', { class: 'mu-ph big', style: { background: s ? s.color : '#333' } }, '♫'), h('b', {}, s ? s.title : T('Not Playing')), h('small', {}, s ? s.artist : ''));
        main.append(stage, card);
        if (vizStop) return;
        if (!window.THREE) { if (PatOS.webgl) PatOS.load3D().then((ok) => { if (ok && stage.isConnected && !vizStop) build3D(); }); return; }
        build3D();
        function build3D() {
        const renderer = PatOS.makeRenderer(canvas);
        const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x05010d, 0.035);
        const cam = new THREE.PerspectiveCamera(55, 1, 0.1, 200); cam.position.set(0, 6, 16); cam.lookAt(0, 0, 0);
        const N = 64; const bars = []; const group = new THREE.Group(); scene.add(group);
        const geo = new THREE.BoxGeometry(0.35, 1, 0.35); geo.translate(0, 0.5, 0);
        for (let i = 0; i < N; i++) { const m = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000, metalness: 0.3, roughness: 0.4 }); const b = new THREE.Mesh(geo, m); const a2 = (i / N) * Math.PI * 2; b.position.set(Math.cos(a2) * 6, 0, Math.sin(a2) * 6); b.rotation.y = -a2; group.add(b); bars.push(b); }
        const sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 3), new THREE.MeshStandardMaterial({ color: 0xffffff, wireframe: true, emissive: 0x222222 })); scene.add(sphere);
        const basePos = sphere.geometry.attributes.position.array.slice();
        scene.add(new THREE.AmbientLight(0xffffff, 0.4)); const pl = new THREE.PointLight(0xffffff, 120, 50); pl.position.set(0, 8, 0); scene.add(pl);
        const data = new Uint8Array(256); let hue = s ? s.hue : 0.6, raf, t = 0;
        const orb = PatOS.orbit(canvas, cam, new THREE.Vector3(0, 1, 0), { dist: 17, phi: 1.2, auto: 0.0025 });
        viz = { setHue(x2) { hue = x2; } };
        const resize = () => { const w = stage.clientWidth, hh = stage.clientHeight; if (!w || !hh) return; renderer.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix(); };
        const ro = new ResizeObserver(resize); ro.observe(stage); resize();
        const loop = () => {
          raf = requestAnimationFrame(loop); if (win.minimized || document.hidden) return; t += 0.016;
          if (E.analyser) E.analyser.getByteFrequencyData(data); else data.fill(0);
          let bass = 0; for (let i = 0; i < 8; i++) bass += data[i]; bass /= 8 * 255;
          bars.forEach((b, i) => { const v = data[Math.floor((i < N / 2 ? i : N - i) * 2.5) + 2] / 255; b.scale.y = 0.15 + v * 7 + (E.playing ? 0 : Math.sin(t * 2 + i * 0.3) * 0.1 + 0.1); const c = new THREE.Color().setHSL((hue + i / N * 0.25) % 1, 0.85, 0.45 + v * 0.3); b.material.color.copy(c); b.material.emissive.copy(c).multiplyScalar(v * 0.8); });
          const p = sphere.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const k = i * 3; const n = 1 + bass * 0.35 * Math.sin(i * 0.7 + t * 4) + (data[i % 64] / 255) * 0.18; p.array[k] = basePos[k] * n; p.array[k + 1] = basePos[k + 1] * n; p.array[k + 2] = basePos[k + 2] * n; } p.needsUpdate = true;
          sphere.rotation.y += 0.004 + bass * 0.03; sphere.rotation.x += 0.002; sphere.material.color.setHSL((hue + 0.5) % 1, 0.8, 0.6); group.rotation.y += 0.002; pl.color.setHSL(hue, 0.9, 0.6);
          orb.update(); renderer.paced(scene, cam);
        };
        loop();
        vizStop = () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); };
        }
      }

      win.on('closed', () => { E.listeners.delete(sync); clearInterval(ti); PatOS.off('setting:volume', onVol); if (vizStop) vizStop(); });
      win._args = (a) => { if (a.path) { setQueue([{ path: a.path }], 0, true); } };
      renderSide(); sync(); renderMain();
      if (args.path) win._args(args);
    },
    onArgs(win, args) { win._args(args); }
  });
})();
