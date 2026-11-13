/* PatOS sound design (3.3): one family of sounds, made live (no audio files).
   - Everything plays in one key (D major) through one chain: a gentle compressor so nothing spikes, a little warmth, and a
     short room (a generated reverb) so every sound sits in the same space. Voices: a glass bell (two-operator FM), a soft tap,
     a pluck, air (filtered noise), a muted thud, paper.
   - Themes (Settings › Sound): Glass (default), Soft (rounder, quieter), Off. An interface volume of its own. The same sound
     never machine-guns: it waits a moment before it can play again.
   - PatOS.sound keeps its old names (click, pop, trash, notify, error, startup, tone), so everything that made a sound still
     does, and gains the new ones (play(name)). Alarms and timers (tone with force) still ring with interface sounds off. */
(function () {
  'use strict';
  const old = PatOS.sound || {}; const tone = old.tone;
  const NOTE = (n) => 293.66 * Math.pow(2, n / 12); // semitones from D4
  let bus = null;
  const theme = () => (PatOS.settings.uiSounds === false ? 'off' : PatOS.settings.soundTheme || 'glass');
  const vol = () => Math.max(0, Math.min(1, PatOS.settings.uiVolume == null ? 0.8 : +PatOS.settings.uiVolume));

  function chain() {
    const a = PatOS.audio && PatOS.audio(); if (!a) return null;
    if (bus && bus.ctx === a.ctx) return bus;
    const ctx = a.ctx, input = ctx.createGain(), comp = ctx.createDynamicsCompressor(), warm = ctx.createBiquadFilter(), dry = ctx.createGain(), wet = ctx.createGain(), verb = ctx.createConvolver();
    comp.threshold.value = -20; comp.knee.value = 18; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    warm.type = 'lowpass'; warm.frequency.value = 9000; warm.Q.value = 0.4;
    // a small, bright room: a short decaying noise burst, a little longer on the right so it feels wide
    const len = Math.floor(ctx.sampleRate * 0.9), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, c ? 2.6 : 3); }
    verb.buffer = ir; dry.gain.value = 1; wet.gain.value = 0.16;
    input.connect(warm); warm.connect(dry); warm.connect(verb); verb.connect(wet); dry.connect(comp); wet.connect(comp); comp.connect(a.out);
    bus = { ctx, input, wet }; return bus;
  }
  let noiseBuf = null;
  function noise(ctx) { if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf; noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return noiseBuf; }
  const env = (g, t, peak, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };

  /* ---------- voices ---------- */
  function bell(b, t, f, v, d, bright) { // two-operator FM: a glassy, clean tone
    const c = b.ctx, car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.value = f; mod.frequency.value = f * (bright ? 3.5 : 2); mg.gain.setValueAtTime(f * (bright ? 2.2 : 1.2), t); mg.gain.exponentialRampToValueAtTime(1, t + d * 0.6);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(b.input); env(g, t, v, 0.004, d);
    car.start(t); mod.start(t); car.stop(t + d + 0.1); mod.stop(t + d + 0.1);
  }
  function tap(b, t, f, v) { // a short, soft tick: a sine blip and a pinch of filtered noise
    const c = b.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.05);
    o.connect(g); g.connect(b.input); env(g, t, v, 0.002, 0.05); o.start(t); o.stop(t + 0.1);
    const n = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain(); n.buffer = noise(c); nf.type = 'bandpass'; nf.frequency.value = f * 3; nf.Q.value = 4;
    n.connect(nf); nf.connect(ng); ng.connect(b.input); env(ng, t, v * 0.5, 0.001, 0.025); n.start(t, Math.random() * 0.5); n.stop(t + 0.05);
  }
  function pluck(b, t, f, v, d) { const c = b.ctx, o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 6, t); lp.frequency.exponentialRampToValueAtTime(f * 1.2, t + d); o.connect(lp); lp.connect(g); g.connect(b.input); env(g, t, v, 0.003, d); o.start(t); o.stop(t + d + 0.05); }
  function air(b, t, from, to, v, d) { // a breath of filtered noise sweeping from one pitch to another
    const c = b.ctx, n = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain(); n.buffer = noise(c); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(from, t); bp.frequency.exponentialRampToValueAtTime(to, t + d);
    n.connect(bp); bp.connect(g); g.connect(b.input); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + d * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + d); n.start(t, Math.random() * 0.4); n.stop(t + d + 0.05);
  }
  function thud(b, t, f, v, d) { const c = b.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(f * 2, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06); o.connect(g); g.connect(b.input); env(g, t, v, 0.003, d); o.start(t); o.stop(t + d + 0.05); }
  function paper(b, t, v, d) { // crumple: little bursts of brighter noise
    for (let i = 0; i < 6; i++) { const c = b.ctx, n = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain(), tt = t + i * d / 6 + Math.random() * 0.02; n.buffer = noise(c); hp.type = 'highpass'; hp.frequency.value = 1800 + Math.random() * 2500; n.connect(hp); hp.connect(g); g.connect(b.input); env(g, tt, v * (0.6 + Math.random() * 0.6), 0.002, 0.04 + Math.random() * 0.04); n.start(tt, Math.random()); n.stop(tt + 0.1); }
  }

  /* ---------- the set ---------- */
  const SOUNDS = {
    click: (b, t, k) => tap(b, t, 2200, 0.05 * k),
    key: (b, t, k) => tap(b, t, 1600 + Math.random() * 300, 0.035 * k),
    toggleOn: (b, t, k) => { tap(b, t, 1900, 0.05 * k); bell(b, t + 0.03, NOTE(12), 0.05 * k, 0.18); },
    toggleOff: (b, t, k) => { tap(b, t, 1500, 0.05 * k); bell(b, t + 0.03, NOTE(7), 0.04 * k, 0.14); },
    pop: (b, t, k) => { tap(b, t, 1300, 0.05 * k); bell(b, t + 0.01, NOTE(19), 0.035 * k, 0.12, true); },
    open: (b, t, k) => { air(b, t, 500, 3200, 0.05 * k, 0.28); bell(b, t + 0.12, NOTE(14), 0.03 * k, 0.3); },
    close: (b, t, k) => air(b, t, 2600, 500, 0.045 * k, 0.24),
    minimize: (b, t, k) => { air(b, t, 2200, 300, 0.05 * k, 0.36); thud(b, t + 0.3, 110, 0.04 * k, 0.12); },
    notify: (b, t, k) => { bell(b, t, NOTE(16), 0.09 * k, 0.9, true); bell(b, t + 0.13, NOTE(23), 0.07 * k, 1.2, true); },
    important: (b, t, k) => { bell(b, t, NOTE(12), 0.09 * k, 0.8, true); bell(b, t + 0.12, NOTE(16), 0.08 * k, 0.8, true); bell(b, t + 0.24, NOTE(19), 0.08 * k, 1.1, true); },
    urgent: (b, t, k) => { [0, 0.18, 0.36].forEach((d) => { bell(b, t + d, NOTE(19), 0.1 * k, 0.4, true); bell(b, t + d + 0.08, NOTE(23), 0.08 * k, 0.4, true); }); },
    success: (b, t, k) => [0, 4, 7, 12].forEach((n, i) => pluck(b, t + i * 0.06, NOTE(n + 12), 0.06 * k, 0.5)),
    error: (b, t, k) => { thud(b, t, 140, 0.08 * k, 0.18); pluck(b, t + 0.02, NOTE(-2), 0.06 * k, 0.3); pluck(b, t + 0.14, NOTE(-5), 0.06 * k, 0.4); },
    trash: (b, t, k) => { paper(b, t, 0.06 * k, 0.22); thud(b, t + 0.2, 90, 0.05 * k, 0.15); },
    emptyTrash: (b, t, k) => { paper(b, t, 0.08 * k, 0.4); air(b, t + 0.1, 1500, 300, 0.05 * k, 0.4); },
    screenshot: (b, t, k) => { tap(b, t, 3000, 0.08 * k); tap(b, t + 0.07, 2400, 0.07 * k); air(b, t, 4000, 2000, 0.03 * k, 0.12); },
    lock: (b, t, k) => { thud(b, t, 120, 0.06 * k, 0.12); tap(b, t + 0.04, 1200, 0.06 * k); },
    unlock: (b, t, k) => { tap(b, t, 1400, 0.05 * k); bell(b, t + 0.05, NOTE(9), 0.05 * k, 0.4); bell(b, t + 0.12, NOTE(14), 0.05 * k, 0.6); },
    sent: (b, t, k) => air(b, t, 700, 4200, 0.06 * k, 0.32),
    received: (b, t, k) => { bell(b, t, NOTE(21), 0.07 * k, 0.5, true); bell(b, t + 0.09, NOTE(26), 0.05 * k, 0.6, true); },
    capture: (b, t, k) => { tap(b, t, 2600, 0.06 * k); bell(b, t + 0.04, NOTE(24), 0.05 * k, 0.5, true); },
    done: (b, t, k) => { pluck(b, t, NOTE(12), 0.05 * k, 0.4); pluck(b, t + 0.08, NOTE(19), 0.05 * k, 0.6); },
    startup: (b, t, k) => { // a slow-blooming D major chord with a high shimmer: the PatOS signature
      [0, 7, 12, 16, 19, 24].forEach((n, i) => { const c = b.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = NOTE(n - 12);
        o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 1.003; o.connect(g); o2.connect(g); g.connect(b.input);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045 * k, t + 0.35 + i * 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.8);
        o.start(t + i * 0.06); o2.start(t + i * 0.06); o.stop(t + 4); o2.stop(t + 4); });
      bell(b, t + 0.5, NOTE(31), 0.03 * k, 2.4, true); bell(b, t + 0.75, NOTE(36), 0.02 * k, 2.4, true); air(b, t, 300, 6000, 0.025 * k, 1.8);
    },
    shutdown: (b, t, k) => { [12, 7, 0].forEach((n, i) => pluck(b, t + i * 0.12, NOTE(n), 0.05 * k, 0.9)); air(b, t, 3000, 200, 0.03 * k, 1.2); }
  };
  const last = {};
  function play(name, opts) {
    const th = theme(); if (th === 'off' || !SOUNDS[name]) return false;
    const now = performance.now(); if (last[name] && now - last[name] < (name === 'key' ? 30 : 80)) return false; last[name] = now; // (never machine-guns)
    const b = chain(); if (!b) return false;
    if (b.ctx.state !== 'running') { const asked = Date.now(); b.ctx.resume().then(() => { if (Date.now() - asked < 1200) { last[name] = 0; play(name, opts); } }).catch(() => {}); return false; }
    const soft = th === 'soft'; b.wet.gain.value = soft ? 0.24 : 0.16;
    try { SOUNDS[name](b, b.ctx.currentTime + 0.005, vol() * (soft ? 0.6 : 1) * ((opts && opts.k) || 1)); } catch (e) { return false; }
    return true;
  }
  PatOS.sound = Object.assign({}, old, {
    tone, play, names: () => Object.keys(SOUNDS),
    click: () => play('click'), pop: () => play('pop'), trash: () => play('trash'), notify: (pr) => play(pr === 'urgent' ? 'urgent' : pr === 'high' ? 'important' : 'notify'),
    error: () => play('error'), success: () => play('success'),
    startup() { if (theme() === 'off') return; const a = PatOS.audio && PatOS.audio(); if (a && a.ctx.state !== 'running') { const go = () => { document.removeEventListener('pointerdown', go, true); document.removeEventListener('keydown', go, true); a.ctx.resume().then(() => play('startup')); }; document.addEventListener('pointerdown', go, true); document.addEventListener('keydown', go, true); return; } play('startup'); }
  });

  /* ---------- where they play ---------- */
  document.addEventListener('click', (e) => { const sw = e.target.closest && e.target.closest('.switch'); if (sw) setTimeout(() => play(sw.classList.contains('on') ? 'toggleOn' : 'toggleOff'), 0); }, true);
  PatOS.on('wm:open', () => play('open')); PatOS.on('wm:close', () => play('close')); PatOS.on('wm:minimize', () => play('minimize'));
  const heard = new Set(); // (each activity's end is heard once)
  PatOS.on('live', () => { const r = PatOS.live && PatOS.live.recent()[0]; if (r && r.ended && Date.now() - r.ended < 1000 && !heard.has(r.id)) { heard.add(r.id); play(r.status === 'failed' ? 'error' : r.status === 'done' ? 'done' : 'close'); } });
  const menu0 = PatOS.menu; if (menu0) PatOS.menu = function () { const el = menu0.apply(this, arguments); play('pop'); return el; };
})();
