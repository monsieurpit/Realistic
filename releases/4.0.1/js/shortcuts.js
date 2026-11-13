/* PatOS Shortcuts and Pat's voice.
   - A shortcut is a list of steps (open an app, ask Pat to set a timer, change the theme, show a message, wait...) that run one
     after the other. It can start by hand, when you unlock PatOS, every day at a time, or when you say "Hey Pat, <its phrase>".
   - "Hey Pat": PatOS listens for the words "Hey Pat" and then does what you ask: it runs a shortcut if you said its name or phrase,
     otherwise Pat (the command helper) answers, out loud if you want. It is OFF until you turn it on in Settings › Pat Voice.
     It uses the browser's speech recognition: Chrome sends the sound to Google's speech service to turn it into text. PatOS only
     listens while the switch is on and PatOS is open, and shows a microphone pill the whole time.
   - Shortcuts are saved in your files and settings, so they follow you with Sync and with your account. */
(function () {
  'use strict';
  const T = (s) => PatOS.t(s);
  const get = (k, d) => PatOS.store.get(k, d), set = (k, v) => PatOS.store.set(k, v);
  const KEY = 'shortcuts';
  const newId = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const clean = (t) => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').replace(/\s+/g, ' ').trim();
  const orig = PatOS.assistantReply; // Pat's own answers (messages.js)

  /* ---------- the steps a shortcut can do ---------- */
  const appName = (id) => (PatOS.apps[id] ? PatOS.t(PatOS.apps[id].name) : id);
  const ACTIONS = {
    openApp: { label: 'Open an app', params: [{ k: 'app', type: 'app', label: 'App', def: 'notes' }], run: async (p) => { if (!PatOS.apps[p.app]) throw new Error(T('That app is not here.')); PatOS.launch(p.app); return T('Opened') + ' ' + appName(p.app); } },
    closeApp: { label: 'Close an app', params: [{ k: 'app', type: 'app', label: 'App', def: 'notes' }], run: async (p) => { const w = PatOS.wm.windowsOf(p.app); w.forEach((x) => x.close()); return T('Closed') + ' ' + appName(p.app); } },
    openUrl: { label: 'Open a web page', params: [{ k: 'url', type: 'text', label: 'Web address', def: 'https://' }], run: async (p) => { if (!/^https?:\/\/\S+$/i.test(p.url || '')) throw new Error(T('Type a web address that starts with http:// or https://')); PatOS.launch('browser', { url: p.url }); return p.url; } },
    openFile: { label: 'Open a file', params: [{ k: 'path', type: 'text', label: 'File path', def: '/Documents/' }], run: async (p) => { if (!PatOS.fs.exists(p.path)) throw new Error(T('That file is not here.')); PatOS.openFile(p.path); return p.path; } },
    pat: { label: 'Ask Pat', params: [{ k: 'command', type: 'text', label: 'What to ask (like timer 10 min)', def: 'timer 10 min' }], run: async (p) => { const r = orig ? orig(String(p.command || '')) : ''; return r && r !== '\u0000clear' ? String(r) : ''; } },
    playMusic: { label: 'Play music', params: [], run: async () => { const r = orig ? orig('play music') : ''; return String(r || ''); } },
    notify: { label: 'Show a notification', params: [{ k: 'title', type: 'text', label: 'Title', def: 'Hello' }, { k: 'body', type: 'text', label: 'Message', def: '' }], run: async (p) => { PatOS.notify({ title: String(p.title || 'PatOS').slice(0, 80), body: String(p.body || '').slice(0, 200), icon: 'shortcuts' }); return p.title; } },
    alert: { label: 'Show a message box', params: [{ k: 'text', type: 'text', label: 'Message', def: '' }], run: async (p) => { PatOS.alertBox('Shortcut', String(p.text || '').slice(0, 300), { icon: 'shortcuts' }); return p.text; } },
    speak: { label: 'Say something out loud', params: [{ k: 'text', type: 'text', label: 'What to say', def: 'Good morning' }], run: async (p) => { api.voice.speak(String(p.text || '')); return p.text; } },
    wait: { label: 'Wait', params: [{ k: 'seconds', type: 'number', label: 'Seconds', def: 3, min: 0, max: 300 }], run: async (p) => { const s = Math.max(0, Math.min(300, +p.seconds || 0)); await new Promise((r) => setTimeout(r, s * 1000)); return s + ' s'; } },
    theme: { label: 'Set dark or light mode', params: [{ k: 'value', type: 'choice', label: 'Mode', def: 'dark', choices: [['dark', 'Dark'], ['light', 'Light'], ['auto', 'Automatic']] }], run: async (p) => { if (!['dark', 'light', 'auto'].includes(p.value)) throw new Error('?'); PatOS.setSetting('theme', p.value); return p.value; } },
    volume: { label: 'Set the volume', params: [{ k: 'percent', type: 'number', label: 'Percent', def: 50, min: 0, max: 100 }], run: async (p) => { const v = Math.max(0, Math.min(100, +p.percent || 0)); PatOS.setSetting('volume', v / 100); return v + '%'; } },
    copy: { label: 'Copy text', params: [{ k: 'text', type: 'text', label: 'Text', def: '' }], run: async (p) => { await navigator.clipboard.writeText(String(p.text || '')); return T('Copied'); } },
    // anything PatOS Intelligence can do, in words ("create a folder called Projects"): the same engine as Pat and Spotlight
    command: { label: 'Do a command', params: [{ k: 'text', type: 'text', label: 'Command (like: open notes, turn on dark mode)', def: 'open notes' }], run: async (p) => {
      const r = PatOS.intel ? PatOS.intel.respond(String(p.text || ''), { source: 'shortcut' }) : null; if (!r) throw new Error(T('PatOS doesn’t understand this step.'));
      const x = await r; if (x.status === 'confirm') throw new Error(T('This step needs a yes, so it can’t run inside a shortcut.')); if (x.ok === false) throw new Error(x.message); return x.message; } },
    runShortcut: { label: 'Run another shortcut', params: [{ k: 'name', type: 'text', label: 'Shortcut name', def: '' }], run: async (p, ctx) => { const s = byName(p.name); if (!s) throw new Error(T('No shortcut has that name.')); if (ctx.depth >= 3) throw new Error(T('Shortcuts are running shortcuts too deep.')); const r = await run(s, { depth: ctx.depth + 1, quiet: true }); if (!r.ok) throw new Error(r.log.filter((x) => !x.ok).map((x) => x.error).join(' ')); return s.name; } }
  };
  const list = () => get(KEY, []).filter((s) => s && s.id);
  const byName = (n) => { const c = clean(n); return list().find((s) => clean(s.name) === c) || null; };
  const save = (all) => set(KEY, all);

  /* ---------- running one ---------- */
  const running = new Set();
  async function run(sc, opts) {
    opts = opts || {}; const ctx = { depth: opts.depth || 0 }; const log = [];
    if (running.has(sc.id) && ctx.depth === 0) return { ok: false, log: [{ ok: false, label: sc.name, error: T('It is already running.') }] };
    running.add(sc.id); PatOS.emit('shortcut:run', { id: sc.id, name: sc.name, state: 'start' });
    try {
      for (const step of sc.steps || []) {
        const def = ACTIONS[step.type]; if (!def) { log.push({ ok: false, label: step.type, error: T('PatOS does not know this step.') }); break; }
        try { const out = await def.run(step.p || {}, ctx); log.push({ ok: true, label: def.label, out: String(out == null ? '' : out).slice(0, 200) }); }
        catch (e) { log.push({ ok: false, label: def.label, error: String((e && e.message) || e) }); break; }
      }
    } finally { running.delete(sc.id); }
    const ok = log.every((x) => x.ok);
    if (!ok && !opts.quiet) { try { PatOS.notify({ title: sc.name, body: log.filter((x) => !x.ok).map((x) => x.error).join(' '), icon: 'shortcuts' }); } catch (e) {} }
    PatOS.emit('shortcut:run', { id: sc.id, name: sc.name, state: 'done', ok, log });
    return { ok, log };
  }

  /* what someone said or typed: "run study mode", "study mode", or a phrase a shortcut listens for */
  function match(text) {
    const c = clean(text).replace(/^(?:please |s'il te plaît |s'il vous plaît )/, ''); if (!c) return null;
    const stripped = c.replace(/^(?:run|start|do|launch|play|lance|lancer|exécute|execute|démarre|fais|fais le)\s+(?:the\s+|my\s+|le\s+|la\s+|mon\s+|ma\s+)?(?:shortcut\s+|raccourci\s+)?/, '');
    return list().find((s) => s.on !== false && s.trigger && s.trigger.type === 'voice' && s.trigger.phrase && (clean(s.trigger.phrase) === c || clean(s.trigger.phrase) === stripped))
      || list().find((s) => s.on !== false && (clean(s.name) === c || clean(s.name) === stripped)) || null;
  }

  /* ---------- starting by themselves ---------- */
  const hm = (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  function tick() { if (PatOS.safeBoot) return; // (Safe Boot: no timed automations)
    if (!PatOS.loggedIn) return; const d = new Date(), key = PatOS.dateKey ? PatOS.dateKey(d) : d.toDateString(); const fired = get('shortcutFired', {});
    list().forEach((s) => {
      const t = s.trigger; if (s.on === false || !t || t.type !== 'time' || !t.at || (t.days && t.days.length && !t.days.includes(d.getDay()))) return;
      if (hm(d) !== t.at || fired[s.id] === key + t.at) return;
      fired[s.id] = key + t.at; set('shortcutFired', fired); run(s, { from: 'time' });
    });
  }
  function onLogin() { if (PatOS.safeBoot) return; /* (Safe Boot: no automations) */ list().forEach((s) => { if (s.on !== false && s.trigger && s.trigger.type === 'login') run(s, { from: 'login' }); }); }
  setInterval(tick, 20000);
  let loggedSeen = false; const loginIv = setInterval(() => { if (PatOS.loggedIn && !loggedSeen) { loggedSeen = true; clearInterval(loginIv); try { if (sessionStorage.getItem('patos-sc-login')) return; sessionStorage.setItem('patos-sc-login', '1'); } catch (e) {} setTimeout(onLogin, 1500); } }, 1000);

  /* ---------- Pat's voice ---------- */
  const SR = () => window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, wantOn = false, awakeUntil = 0, backoff = 0, restartT = null, pill = null, listening = false;
  const lang = () => (PatOS.lang === 'fr' ? 'fr-CA' : 'en-US');
  const WAKE = /\b(?:hey|hay|hi|ok|okay|a|salut|allo|allô|hé|dis|yo)[\s,.!]*pat\b[\s,.!:]*/i;
  const voice = {
    supported: () => !!SR(),
    on: () => get('voiceOn', false),
    speaks: () => get('voiceSpeak', true),
    /* say something out loud (if the browser can) */
    speak(text) { try { if (!window.speechSynthesis || !text) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(text).slice(0, 400)); u.lang = lang(); speechSynthesis.speak(u); } catch (e) {} },
    /* do what was said */
    async handle(text) {
      text = String(text || '').trim(); if (!text) return null;
      const sc = match(text); let say;
      if (sc) { say = T('Running') + ' ' + sc.name; run(sc, { from: 'voice' }); }
      else { const r = PatOS.assistantReply ? PatOS.assistantReply(text) : ''; say = r === '\u0000clear' ? '' : String(r || ''); }
      if (say) { try { PatOS.notify({ title: 'Pat', body: say.slice(0, 160), icon: 'messages' }); } catch (e) {} if (voice.speaks()) voice.speak(say.replace(/[•\n]+/g, '. ')); }
      PatOS.emit('voice', { heard: text, said: say });
      return say;
    },
    /* the words that come out of the microphone: wait for "Hey Pat", then take what follows (or the next thing said) */
    heard(text) {
      text = String(text || '').trim(); if (!text) return;
      const m = WAKE.exec(text);
      if (m) { const rest = text.slice(m.index + m[0].length).trim(); if (rest) { awakeUntil = 0; drawPill(); voice.handle(rest); } else { awakeUntil = Date.now() + 8000; drawPill(); try { PatOS.sound && PatOS.sound.tone(900, 0.1, { vol: 0.05 }); } catch (e) {} setTimeout(drawPill, 8200); } return; }
      if (awakeUntil > Date.now()) { awakeUntil = 0; drawPill(); voice.handle(text); }
    },
    /* one question, no wake word (the microphone button in Pat's panel); calls back with the words */
    listenOnce(cb, onEnd) {
      const S = SR(); if (!S) { if (onEnd) onEnd(new Error(T('This browser cannot listen.'))); return () => {}; }
      const r = new S(); r.lang = lang(); r.interimResults = false; r.continuous = false; r.maxAlternatives = 1; let got = false;
      r.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { got = true; cb(e.results[i][0].transcript); } };
      r.onerror = (e) => { if (onEnd) onEnd(new Error(e.error === 'not-allowed' ? T('The microphone is not allowed. Allow it in the browser.') : e.error === 'no-speech' ? T('I did not hear anything.') : String(e.error))); onEnd = null; };
      r.onend = () => { if (onEnd) onEnd(got ? null : new Error(T('I did not hear anything.'))); };
      try { r.start(); } catch (e) { if (onEnd) onEnd(e); }
      return () => { try { r.stop(); } catch (e) {} };
    },
    enable() { if (!SR()) throw new Error(T('This browser cannot listen. Use Chrome or Safari.')); set('voiceOn', true); begin(); PatOS.emit('voice:state'); },
    disable() { set('voiceOn', false); end(); PatOS.emit('voice:state'); },
    state: () => ({ on: voice.on(), listening, awake: awakeUntil > Date.now() })
  };
  function drawPill() {
    const show = wantOn && voice.on();
    if (!show) { if (pill) { pill.remove(); pill = null; } return; }
    if (!pill) { pill = PatOS.h('button', { class: 'voice-pill', title: T('Stop listening for “Hey Pat”'), 'aria-label': T('Stop listening for “Hey Pat”'), onclick: () => voice.disable() }, PatOS.h('i', { class: 'vp-dot' }), PatOS.h('span', {})); document.body.appendChild(pill); }
    const awake = awakeUntil > Date.now(); pill.classList.toggle('awake', awake); pill.querySelector('span').textContent = awake ? T('Listening…') : T('Say “Hey Pat”');
  }
  function begin() {
    if (rec || !SR() || !voice.on() || document.hidden) return; wantOn = true;
    const r = new (SR())(); r.lang = lang(); r.continuous = true; r.interimResults = false; r.maxAlternatives = 1;
    r.onstart = () => { listening = true; backoff = 0; drawPill(); PatOS.emit('voice:state'); };
    r.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) voice.heard(e.results[i][0].transcript); };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { voice.disable(); try { PatOS.notify({ title: T('Hey Pat is off'), body: T('The microphone is not allowed. Allow it in the browser, then turn Hey Pat on again.'), icon: 'settings' }); } catch (x) {} }
      else backoff = Math.min(8000, (backoff || 500) * 2);
    };
    r.onend = () => { rec = null; listening = false; drawPill(); PatOS.emit('voice:state'); if (wantOn && voice.on() && !document.hidden) { clearTimeout(restartT); restartT = setTimeout(begin, Math.max(300, backoff)); } };
    rec = r; try { r.start(); } catch (e) { rec = null; }
    drawPill();
  }
  function end() { wantOn = false; clearTimeout(restartT); awakeUntil = 0; const r = rec; rec = null; if (r) { r.onend = null; try { r.stop(); } catch (e) {} } listening = false; drawPill(); }
  document.addEventListener('visibilitychange', () => { if (!voice.on()) return; if (document.hidden) { const r = rec; rec = null; if (r) { r.onend = null; try { r.stop(); } catch (e) {} } listening = false; } else { wantOn = true; begin(); } drawPill(); });
  setInterval(() => { if (voice.on() && SR() && PatOS.loggedIn && !rec && !document.hidden) begin(); }, 4000); // after sign-in, and if the browser let go of the microphone

  /* ---------- the public side ---------- */
  const api = {
    actions: ACTIONS, list, byName, match, run,
    get: (id) => list().find((s) => s.id === id) || null,
    save(sc) { const all = list(); const i = all.findIndex((s) => s.id === sc.id); const x = Object.assign({ id: newId(), name: T('New Shortcut'), on: true, trigger: { type: 'manual' }, steps: [] }, sc); if (i >= 0) all[i] = x; else all.push(x); save(all); PatOS.emit('shortcuts'); return x; },
    remove(id) { save(list().filter((s) => s.id !== id)); PatOS.emit('shortcuts'); },
    isRunning: (id) => running.has(id),
    /* ready-made ones to start from */
    gallery: () => [
      { key: 'morning', name: 'Good morning', trigger: { type: 'voice', phrase: 'good morning' }, steps: [{ type: 'theme', p: { value: 'light' } }, { type: 'pat', p: { command: 'what’s on my calendar today?' } }, { type: 'openApp', p: { app: 'weather' } }, { type: 'speak', p: { text: 'Good morning! Here is your day.' } }] },
      { key: 'study', name: 'Study time', trigger: { type: 'manual' }, steps: [{ type: 'openApp', p: { app: 'focus' } }, { type: 'openApp', p: { app: 'notes' } }, { type: 'pat', p: { command: 'timer 25 min' } }, { type: 'notify', p: { title: 'Study time', body: '25 minutes. You can do it.' } }] },
      { key: 'bedtime', name: 'Bedtime', trigger: { type: 'time', at: '21:30', days: [0, 1, 2, 3, 4] }, steps: [{ type: 'theme', p: { value: 'dark' } }, { type: 'volume', p: { percent: 20 } }, { type: 'notify', p: { title: 'Bedtime', body: 'Time to wind down.' } }] },
      { key: 'welcome', name: 'When I unlock', trigger: { type: 'login' }, steps: [{ type: 'openApp', p: { app: 'notes' } }, { type: 'playMusic', p: {} }] }
    ],
    voice, _tick: tick, _onLogin: onLogin
  };
  PatOS.shortcuts = api; PatOS.voice = voice;

  /* Pat (the command helper) runs a shortcut when you say or type its name */
  PatOS.assistantReply = (text) => { const sc = match(text); if (sc) { run(sc, { from: 'pat' }); return T('Running') + ' ' + sc.name + '.'; } return orig ? orig(text) : ''; };

  /* start listening again after a restart if it was on */
  setTimeout(() => { if (voice.on() && SR() && !document.hidden) begin(); }, 2000);
})();
