/* Shortcuts and Pat's voice: steps run in order and stop at a mistake, shortcuts start by hand, by time, when you unlock and by voice,
   "Hey Pat" listens only when it is on, and the Shortcuts window works. (The microphone is replaced by a stand-in that "hears" typed text.) */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

async function setup() {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 780 } });
  await ctx.addInitScript(() => {
    window.__spoken = []; window.__recs = [];
    window.SpeechRecognition = window.webkitSpeechRecognition = class { constructor() { window.__recs.push(this); this.running = false; } start() { this.running = true; window.__sr = this; setTimeout(() => this.onstart && this.onstart(), 0); } stop() { if (!this.running) return; this.running = false; setTimeout(() => this.onend && this.onend(), 0); } };
    window.__say = (t) => { const r = window.__sr; if (!r) throw new Error('nothing is listening'); const res = Object.assign([{ transcript: t, confidence: 1 }], { isFinal: true }); r.onresult({ resultIndex: 0, results: [res] }); };
    Object.defineProperty(window, 'speechSynthesis', { value: { speak: (u) => window.__spoken.push(u.text), cancel() {} }, configurable: true }); window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  });
  const page = await ctx.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => { window.__notes = []; PatOS.notify = (n) => window.__notes.push(n); PatOS.alertBox = async () => {}; PatOS.confirmBox = async () => true; PatOS.store.set('accountPrompt', { snoozedUntil: Date.now() + 1e10 }); });
  return { ctx, page, errors };
}

test('steps run in order, stop at a mistake, and a shortcut can run another', { skip: skipNoBrowser }, async () => {
  const { ctx, page, errors } = await setup();
  const r = await page.evaluate(async () => {
    const S = PatOS.shortcuts; const o = {};
    const a = S.save({ name: 'Morning mix', steps: [{ type: 'theme', p: { value: 'light' } }, { type: 'openApp', p: { app: 'calculator' } }, { type: 'wait', p: { seconds: 0 } }, { type: 'notify', p: { title: 'Hi there', body: 'steps done' } }, { type: 'pat', p: { command: 'what time is it' } }, { type: 'volume', p: { percent: 30 } }] });
    const res = await S.run(a); o.ok = res.ok; o.labels = res.log.map((x) => x.label); o.theme = PatOS.settings.theme; o.calc = PatOS.wm.windowsOf('calculator').length; o.note = window.__notes.filter((n) => n.title === 'Hi there').length; o.vol = PatOS.settings.volume; o.patOut = res.log[4].out;
    const bad = S.save({ name: 'Broken', steps: [{ type: 'openApp', p: { app: 'nope-app' } }, { type: 'theme', p: { value: 'dark' } }] });
    const rb = await S.run(bad); o.badOk = rb.ok; o.badLog = rb.log.map((x) => x.ok + ':' + (x.error || '')); o.themeAfterBad = PatOS.settings.theme; o.badNote = window.__notes.some((n) => n.title === 'Broken');
    const outer = S.save({ name: 'Outer', steps: [{ type: 'runShortcut', p: { name: 'morning mix' } }, { type: 'closeApp', p: { app: 'calculator' } }] }); const ro = await S.run(outer); o.outerOk = ro.ok; o.calcClosed = PatOS.wm.windowsOf('calculator').length;
    const loop = S.save({ name: 'Loop', steps: [{ type: 'runShortcut', p: { name: 'loop' } }] }); const rl = await S.run(loop); o.loop = rl.log.map((x) => x.error || '').join('|');
    const u = S.save({ name: 'Unknown step', steps: [{ type: 'format-disk', p: {} }] }); o.unknown = (await S.run(u)).ok;
    o.persisted = PatOS.store.get('shortcuts').length;
    return o;
  });
  assert.equal(r.ok, true); assert.deepEqual(r.labels, ['Set dark or light mode', 'Open an app', 'Wait', 'Show a notification', 'Ask Pat', 'Set the volume']); assert.equal(r.theme, 'light'); assert.equal(r.calc, 1); assert.equal(r.note, 1); assert.equal(r.vol, 0.3); assert.match(r.patOut, /^It’s /);
  assert.equal(r.badOk, false); assert.match(r.badLog[0], /^false:That app is not here/); assert.equal(r.badLog.length, 1, 'stops at the first mistake'); assert.notEqual(r.themeAfterBad, 'dark'); assert.equal(r.badNote, true, 'says what went wrong');
  assert.equal(r.outerOk, true); assert.equal(r.calcClosed, 0); assert.match(r.loop, /already running|too deep/); assert.equal(r.unknown, false); assert.equal(r.persisted, 5);
  assert.deepEqual(errors, []); await ctx.close();
});

test('starting by themselves: by name, by phrase, by time (once a minute), when you unlock; turned-off ones stay quiet', { skip: skipNoBrowser }, async () => {
  const { ctx, page } = await setup();
  const r = await page.evaluate(async () => {
    const S = PatOS.shortcuts; const o = {}; const hm = (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    S.save({ name: 'Study time', steps: [{ type: 'notify', p: { title: 'ran-study' } }] });
    S.save({ name: 'Greeting', trigger: { type: 'voice', phrase: 'good morning' }, steps: [{ type: 'notify', p: { title: 'ran-greeting' } }] });
    S.save({ name: 'Off one', on: false, trigger: { type: 'voice', phrase: 'secret words' }, steps: [{ type: 'notify', p: { title: 'ran-off' } }] });
    S.save({ name: 'Unlock thing', trigger: { type: 'login' }, steps: [{ type: 'notify', p: { title: 'ran-login' } }] });
    const d = new Date(); S.save({ name: 'Daily', trigger: { type: 'time', at: hm(d), days: [d.getDay()] }, steps: [{ type: 'notify', p: { title: 'ran-daily' } }] });
    S.save({ name: 'Other day', trigger: { type: 'time', at: hm(d), days: [(d.getDay() + 3) % 7] }, steps: [{ type: 'notify', p: { title: 'ran-otherday' } }] });
    o.byName = [S.match('Study time') && 1, S.match('run study time') && 1, S.match('Start my Study Time!') && 1, S.match('lance study time') && 1, S.match('study') && 1];
    o.byPhrase = [S.match('good morning') && S.match('good morning').name, S.match('do good morning') && 1, S.match('secret words') && 1, S.match('off one') && 1];
    o.pat = PatOS.assistantReply('run study time'); o.pat2 = PatOS.assistantReply('what time is it'); o.pat3 = PatOS.assistantReply('good morning');
    await new Promise((res) => setTimeout(res, 150));
    PatOS.loggedIn = true; S._tick(); S._tick(); S._onLogin(); await new Promise((res) => setTimeout(res, 200));
    const titles = window.__notes.map((n) => n.title); const count = (t) => titles.filter((x) => x === t).length;
    o.counts = { study: count('ran-study'), greeting: count('ran-greeting'), off: count('ran-off'), login: count('ran-login'), daily: count('ran-daily'), other: count('ran-otherday') };
    return o;
  });
  assert.deepEqual(r.byName, [1, 1, 1, 1, null]); assert.deepEqual(r.byPhrase, ['Greeting', 1, null, null]);
  assert.equal(r.pat, 'Running Study time.'); assert.match(r.pat2, /^It’s /); assert.equal(r.pat3, 'Running Greeting.');
  assert.deepEqual(r.counts, { study: 1, greeting: 1, off: 0, login: 1, daily: 1, other: 0 }, 'the daily one ran once even though the clock was checked twice');
  await ctx.close();
});

test('Hey Pat: off until you turn it on, then it listens for the words, answers, and runs shortcuts', { skip: skipNoBrowser }, async () => {
  const { ctx, page, errors } = await setup();
  assert.equal(await page.evaluate(() => [PatOS.voice.supported(), PatOS.voice.on(), window.__recs.length, !!document.querySelector('.voice-pill')].join()), 'true,false,0,false', 'nothing listens by default');
  await page.evaluate(() => { PatOS.loggedIn = true; PatOS.shortcuts.save({ name: 'Good morning', trigger: { type: 'voice', phrase: 'good morning' }, steps: [{ type: 'notify', p: { title: 'voice-ran' } }] }); PatOS.voice.enable(); });
  await page.waitForSelector('.voice-pill'); assert.match(await page.innerText('.voice-pill'), /Say “Hey Pat”/);
  assert.equal(await page.evaluate(() => window.__sr.lang + ',' + window.__sr.continuous), 'en-US,true');
  // talk that is not for Pat is ignored
  await page.evaluate(() => window.__say('what time is it')); await page.evaluate(() => window.__say('open the calculator'));
  assert.deepEqual(await page.evaluate(() => [window.__notes.filter((n) => n.title === 'Pat').length, PatOS.wm.windowsOf('calculator').length]), [0, 0]);
  // wake word and a question in one go, answered in writing and out loud
  await page.evaluate(() => window.__say('Hey Pat, what time is it?'));
  const a = await page.evaluate(() => ({ note: window.__notes.find((n) => n.title === 'Pat'), spoken: window.__spoken.slice() })); assert.match(a.note.body, /^It’s /); assert.match(a.spoken[0], /^It’s /);
  // wake word, then the next thing said
  await page.evaluate(() => window.__say('hey pat')); assert.match(await page.innerText('.voice-pill'), /Listening/);
  await page.evaluate(() => window.__say('open calculator')); await page.waitForFunction(() => PatOS.wm.windowsOf('calculator').length === 1, null, { timeout: 5000 }); assert.match(await page.innerText('.voice-pill'), /Say “Hey Pat”/);
  // a shortcut by its phrase
  await page.evaluate(() => window.__say('hey pat good morning')); await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__notes.filter((n) => n.title === 'voice-ran').length), 1); assert.ok((await page.evaluate(() => window.__spoken)).some((t) => /^Running Good morning/.test(t)));
  // the spoken answer can be turned off
  await page.evaluate(() => { PatOS.store.set('voiceSpeak', false); window.__spoken.length = 0; window.__say('hey pat what time is it'); }); assert.equal(await page.evaluate(() => window.__spoken.length), 0);
  // it keeps listening if the browser stops the session, and stops for good when turned off
  await page.evaluate(() => window.__sr.stop()); await page.waitForFunction(() => window.__recs.length >= 2 && window.__recs[window.__recs.length - 1].running, null, { timeout: 8000 });
  await page.click('.voice-pill'); assert.deepEqual(await page.evaluate(() => [PatOS.voice.on(), !!document.querySelector('.voice-pill'), window.__recs.every((r) => !r.running)]), [false, false, true]);
  // the microphone being refused turns it off by itself, and says why
  await page.evaluate(() => { PatOS.voice.enable(); }); await page.waitForFunction(() => window.__sr && window.__sr.running);
  await page.evaluate(() => { const r = window.__sr; r.onerror({ error: 'not-allowed' }); });
  assert.equal(await page.evaluate(() => PatOS.voice.on()), false); assert.match(await page.evaluate(() => window.__notes.map((n) => n.title).join('|')), /Hey Pat is off/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the Shortcuts window, the Pat Voice settings, and the microphone button in Pat’s panel (top bar)', { skip: skipNoBrowser }, async () => {
  const { ctx, page, errors } = await setup();
  await page.evaluate(() => { PatOS.launch('shortcuts'); }); await page.waitForSelector('.sc');
  assert.match(await page.innerText('.sc-main'), /Little automations for PatOS/);
  await page.click('text=Gallery'); await page.waitForSelector('.sc-gal'); assert.match(await page.innerText('.sc-main'), /Good morning[\s\S]*Study time[\s\S]*Bedtime[\s\S]*When I unlock/);
  await page.click('.sc-gal >> nth=1 >> text=Add'); await page.waitForSelector('.sc-step'); assert.equal(await page.locator('.sc-step').count(), 4);
  assert.match(await page.innerText('.sc-side'), /Study time[\s\S]*Runs when you press it/);
  // edit: rename, add a step, run, see the log
  await page.fill('.sc-grid input >> nth=0', 'Focus now'); await page.keyboard.press('Tab'); await page.waitForFunction(() => /Focus now/.test(document.querySelector('.sc-side').innerText));
  await page.click('text=Add Step'); await page.click('.menu >> text=Show a message box'); await page.waitForFunction(() => document.querySelectorAll('.sc-step').length === 5);
  await page.selectOption('.sc-grid select', 'voice'); await page.fill('.sc-days input', 'focus please'); await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => PatOS.shortcuts.list()[0].trigger.phrase), 'focus please'); assert.match(await page.innerText('.sc-side'), /Hey Pat, focus please/);
  await page.click('.sc-hb .btn.primary'); await page.waitForSelector('.sc-log', { timeout: 8000 }); assert.match(await page.innerText('.sc-log'), /Open an app[\s\S]*Open an app[\s\S]*Ask Pat[\s\S]*Show a notification[\s\S]*Show a message box/);
  assert.equal(await page.evaluate(() => PatOS.wm.windowsOf('focus').length + PatOS.wm.windowsOf('notes').length), 2);
  await page.evaluate(() => { ['focus', 'notes'].forEach((id) => PatOS.wm.windowsOf(id).forEach((w) => w.close())); }); await page.waitForTimeout(500);
  await page.click('.sc-acts .btn.danger'); await page.waitForFunction(() => PatOS.shortcuts.list().length === 0);
  // Settings › Pat Voice
  const v = await page.evaluate(async () => { const w = PatOS.launch('settings', { pane: 'voice' }); await new Promise((r) => setTimeout(r, 700)); const sw = w.body.querySelector('.vo .switch'); const o = { text: w.body.querySelector('.vo').innerText, before: sw.classList.contains('on') }; sw.click(); await new Promise((r) => setTimeout(r, 400)); o.after = PatOS.voice.on(); o.pill = !!document.querySelector('.voice-pill'); return o; });
  assert.match(v.text, /Hey Pat[\s\S]*Off\. Nothing is listening[\s\S]*Google’s speech service/); assert.equal(v.before, false); assert.equal(v.after, true); assert.equal(v.pill, true);
  // the microphone button in Pat's panel (Messages): hears one question, no wake word
  await page.evaluate(() => { PatOS.voice.disable(); }); await page.click('#mb-pat'); await page.waitForSelector('#pat-panel:not(.hidden) .msg-mic');
  await page.click('.msg-mic'); await page.waitForFunction(() => window.__sr && window.__sr.running); await page.evaluate(() => window.__say('what time is it'));
  await page.waitForFunction(() => /what time is it[\s\S]*It’s /.test(document.querySelector('#pat-panel').innerText), null, { timeout: 6000 });
  assert.deepEqual(errors, []); await ctx.close();
});
