/* 3.3 system services working together: Notifications 2.0, Live Activities, Universal Actions and Command Center. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, reload, skipNoBrowser } = require('../helpers');

let srv, b, page, errors;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); page = await b.newPage({ viewport: { width: 1366, height: 820 } }); errors = await boot(page, srv.base, { fresh: true }); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('notifications: kept after a reload, counted not piled up, rules, quiet hours, actions, scheduled ones arrive', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    PatOS.nc.clear(); let acted = 0;
    PatOS.notify({ title: 'Build done', body: 'All good', icon: 'pitstudio', actions: [{ label: 'Open', run: () => { acted++; } }] });
    PatOS.notify({ title: 'Build done', body: 'All good', icon: 'pitstudio' });
    const counted = PatOS.nc.list().filter((n) => n.title === 'Build done').map((n) => n.count);
    const banner = document.querySelectorAll('#toasts .toast[data-nid]').length;
    const actBtn = !!document.querySelector('#toasts .toast-act');
    PatOS.nc.act(PatOS.nc.list()[0].id, 0);
    // per-app rule: no banners from Music, but kept
    PatOS.setSetting('notifRules', { music: { banner: false } }); document.querySelectorAll('#toasts .toast').forEach((t) => t.remove());
    PatOS.notify({ title: 'Song', icon: 'music' }); const musicBanner = document.querySelectorAll('#toasts .toast').length; const musicKept = PatOS.nc.list({ app: 'music' }).length;
    // quiet hours all day: banners wait, urgent ones still show
    PatOS.setSetting('quietOn', true); PatOS.setSetting('quietFrom', '00:00'); PatOS.setSetting('quietTo', '23:59');
    PatOS.notify({ title: 'Quiet', icon: 'notes' }); const quietBanner = !!document.querySelector('#toasts .toast:not(.out) b') && [...document.querySelectorAll('#toasts b')].some((x) => x.textContent === 'Quiet');
    PatOS.notify({ title: 'Fire drill', icon: 'clock', priority: 'urgent' }); const urgent = [...document.querySelectorAll('#toasts b')].some((x) => x.textContent === 'Fire drill');
    PatOS.setSetting('quietOn', false);
    // scheduled in 1 s, saved in the queue
    PatOS.notify({ title: 'Later', icon: 'reminders', at: Date.now() + 1500, open: { app: 'reminders' } });
    const queued = PatOS.nc.scheduled().length;
    return { counted, banner, actBtn, acted, musicBanner, musicKept, quietBanner, urgent, queued };
  });
  assert.deepEqual(r.counted, [2], 'the same one twice is one notification ×2'); assert.equal(r.banner, 1); assert.ok(r.actBtn); assert.equal(r.acted, 1);
  assert.equal(r.musicBanner, 0, 'Music’s banners are off'); assert.equal(r.musicKept, 1, 'but it is in the history');
  assert.equal(r.quietBanner, false, 'quiet hours: no banner'); assert.equal(r.urgent, true, 'urgent ones still show'); assert.equal(r.queued, 1);
  await reload(page);
  await page.waitForFunction(() => PatOS.nc && PatOS.nc.list().some((n) => n.title === 'Later'), null, { timeout: 30000 });
  const after = await page.evaluate(() => ({ kept: PatOS.nc.list().some((n) => n.title === 'Song'), later: PatOS.nc.list().find((n) => n.title === 'Later').open, queue: PatOS.nc.scheduled().length }));
  assert.ok(after.kept, 'history survives a reload'); assert.deepEqual(after.later, { app: 'reminders' }); assert.equal(after.queue, 0, 'the scheduled one was delivered (after a restart)');
});

test('live activities: real controls only, failures notify and show in Command Center with Retry', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    let paused = 0, retried = 0;
    const a = PatOS.live.start({ app: 'finder', title: 'Copying 3 files', progress: 0, pause: () => { paused++; }, retry: () => { retried++; } });
    a.update({ progress: 0.4, detail: '2 of 3' }); await wait(250);
    const pill = document.getElementById('mb-live'); const pillText = pill.textContent, pillShown = !pill.classList.contains('hidden');
    const can = PatOS.live.get(a.id).can;
    const noCancel = PatOS.live.act(a.id, 'cancel'); // (the copy gave no cancel: refused)
    PatOS.live.act(a.id, 'pause');
    PatOS.command.open(); await wait(250);
    const nowText = document.querySelector('#cmd [data-sec="now"]').innerText;
    a.end('failed', 'The disk is full'); await wait(300);
    const att = document.querySelector('#cmd [data-sec="attention"]').innerText;
    const note = PatOS.nc.list().find((n) => /Copying 3 files/.test(n.title));
    const retryBtn = [...document.querySelectorAll('#cmd [data-sec="attention"] .btn')].find((x) => x.textContent === 'Retry'); retryBtn && retryBtn.click(); await wait(200);
    PatOS.command.close();
    return { pillText, pillShown, can, noCancel, paused, nowText, att, note: note && { pr: note.priority, acts: note.actions.length }, retried, pillAfter: document.getElementById('mb-live').classList.contains('hidden') };
  });
  assert.ok(r.pillShown); assert.match(r.pillText, /40%/);
  assert.deepEqual(r.can, { pause: true, resume: false, cancel: false, retry: false, open: false });
  assert.equal(r.noCancel, false, 'no fake cancel'); assert.equal(r.paused, 1);
  assert.match(r.nowText, /Copying 3 files[\s\S]*Paused/);
  assert.match(r.att, /Copying 3 files: didn’t finish[\s\S]*The disk is full/); assert.deepEqual(r.note, { pr: 'high', acts: 1 });
  assert.equal(r.retried, 1, 'Retry runs the operation’s own retry'); assert.equal(r.pillAfter, true, 'nothing running: no pill');
});

test('universal actions: typed objects, only what applies, refusals, undo, and the share sheet', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    PatOS.fs.write('/Documents/pic-note.txt', 'hello'); 
    const img = '/Pictures/dot.png'; if (!PatOS.fs.exists('/Pictures')) PatOS.fs.mkdir('/Pictures');
    PatOS.fs.write(img, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
    const ids = (x) => PatOS.actions.for(x).map((a) => a.id);
    const forImage = ids(img), forText = ids('buy milk'), forUrl = ids('https://example.com');
    const bad = await PatOS.actions.run('nope.nope', 'x'), wrong = await PatOS.actions.run('wallpaper.set', 'just text');
    const w0 = PatOS.settings.wallpaper; const set = await PatOS.actions.run('wallpaper.set', img); const now = PatOS.settings.wallpaper; set.undo(); const back = PatOS.settings.wallpaper;
    const note = await PatOS.actions.run('notes.add', 'a note from actions'); const inNotes = (PatOS.store.get('notes', []) || []).some((n) => /a note from actions/.test((n.title || '') + (n.body || '')));
    // an app that isn't installed: its actions are gone, not broken
    const real = PatOS.apps.paint; delete PatOS.apps.paint; const noPaint = !ids(img).includes('paint.edit'); PatOS.apps.paint = real;
    PatOS.actions.sheet(img, 200, 200); const sheet = [...document.querySelectorAll('.menu .menu-label')].map((x) => x.textContent); PatOS.closeMenus();
    return { forImage, forText, forUrl, bad: bad.ok, wrong: wrong.message, w0, now, back, note: note.ok, inNotes, noPaint, sheet };
  });
  assert.ok(r.forImage.includes('photos.open') && r.forImage.includes('paint.edit') && r.forImage.includes('wallpaper.set') && !r.forImage.includes('notes.add'));
  assert.ok(r.forText.includes('notes.add') && r.forText.includes('reminders.add') && !r.forText.includes('photos.open'));
  assert.ok(r.forUrl.includes('browser.open'));
  assert.equal(r.bad, false); assert.match(r.wrong, /can’t take that/);
  assert.equal(r.now, 'custom'); assert.equal(r.back, r.w0, 'undo puts the wallpaper back');
  assert.equal(r.note, true); assert.ok(r.inNotes, 'the note is really in Notes');
  assert.ok(r.noPaint); assert.ok(r.sheet.includes('Open in Photos') && r.sheet.includes('Use as Wallpaper'));
  assert.deepEqual(errors, []);
});
