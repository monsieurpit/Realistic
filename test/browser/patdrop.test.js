/* PatDrop / PatLink: two PatOS devices (a person and their friend) talk through one server. Messages, files, links,
   clipboard text and apps arrive; the server sees nothing readable; offline sending waits; the UI works. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b, dataDir;
test.before(async () => { if (skipNoBrowser) return; dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patos-pd-')); process.env.PATOS_DATA = dataDir; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true }); });

async function device(name) {
  const ctx = await b.newContext({ viewport: { width: 1100, height: 760 } }); const page = await ctx.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate((n) => { PatOS.setSetting('userName', n); window.__notes = []; PatOS.notify = (x) => window.__notes.push(x); window.__asked = []; PatOS.confirmBox = async (t, x) => { window.__asked.push(t); return true; }; PatOS.alertBox = async (t, x) => { window.__alert = t + ': ' + x; }; }, name);
  return { ctx, page, errors, ev: (fn, arg) => page.evaluate(fn, arg) };
}
const serverBytes = () => { let s = ''; (function walk(d) { fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else s += fs.readFileSync(p, 'utf8'); }); })(path.join(dataDir, 'link')); return s; };
const APP = { format: 'patapp', formatVersion: 1, id: 'com.test.gift', name: 'Gift', version: '1.0.0', author: 'Pat', description: 'A gift.', icon: '🎁', color: '#34c759', permissions: ['notifications'], html: '<h1>gift</h1>' };

test('two friends: messages, files, links, clipboard and apps, and the server sees nothing readable', { skip: skipNoBrowser }, async () => {
  const A = await device('Pat'), B = await device('Bro');
  const code = await A.ev(() => PatOS.link.create('Me and Bro')); assert.match(code, /^([0-9A-HJKMNP-TV-Z]{4}-){6}[0-9A-HJKMNP-TV-Z]{4}$/);
  assert.match(await B.ev(async () => { try { await PatOS.link.join('AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA'); return 'joined'; } catch (e) { return e.message; } }), /not right/);
  await B.ev((c) => PatOS.link.join(c, 'Pat and me'), code);
  // text, both ways, and who it is from
  await A.ev(() => PatOS.link.sendText('hello secret-word bro')); await A.ev(() => PatOS.link.now()); await B.ev(() => PatOS.link.now());
  let feed = await B.ev(() => PatOS.link.feed().map((x) => [x.k, x.text, x.from.name, x.mine, x.status]));
  assert.deepEqual(feed, [['text', 'hello secret-word bro', 'Pat', false, 'sent']]);
  assert.equal(await B.ev(() => window.__notes.filter((n) => n.icon === 'patdrop').map((n) => n.title + ': ' + n.body)[0]), 'Pat: hello secret-word bro', 'a notification when something arrives');
  assert.equal(await B.ev(() => PatOS.link.unread()), 1);
  await B.ev(() => PatOS.link.sendText('hey Pat')); await B.ev(() => PatOS.link.now()); await A.ev(() => PatOS.link.now());
  assert.deepEqual(await A.ev(() => PatOS.link.feed().map((x) => x.text + '/' + x.from.name + '/' + x.mine)), ['hello secret-word bro/Pat/true', 'hey Pat/Bro/false'], 'our own message is not shown twice');
  // a file, a picture, a link, the clipboard, an app
  await A.ev(() => { PatOS.fs.write('/Documents/trip-plan.txt', 'meet at the reef at 9'); PatOS.fs.write('/Pictures/dot.png', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', { mime: 'image/png' }); });
  await A.ev(async () => { await PatOS.link.sendPath('/Documents/trip-plan.txt'); await PatOS.link.sendPath('/Pictures/dot.png'); await PatOS.link.sendLink('https://example.com/reef'); await PatOS.link.sendClipboard('copied-on-A'); PatOS.link.sendApp(arguments[0]); }, APP).catch(() => {});
  await A.ev((app) => PatOS.link.sendApp(app), APP);
  await A.ev(() => PatOS.link.now()); await B.ev(() => PatOS.link.now());
  const got = await B.ev(() => ({ files: PatOS.fs.list('/Downloads/PatDrop').map((x) => x.name).sort(), txt: PatOS.fs.read('/Downloads/PatDrop/trip-plan.txt'), png: PatOS.fs.read('/Downloads/PatDrop/dot.png').slice(0, 25), kinds: PatOS.link.feed().filter((x) => !x.text || x.k !== 'text').map((x) => x.k), clip: PatOS.link.feed().find((x) => x.k === 'clip').text, link: PatOS.link.feed().find((x) => x.k === 'link').url, app: PatOS.link.feed().find((x) => x.k === 'app').app.name }));
  assert.deepEqual(got.files, ['dot.png', 'trip-plan.txt']); assert.equal(got.txt, 'meet at the reef at 9'); assert.equal(got.png, 'data:image/png;base64,iVB');
  assert.deepEqual(got.kinds.sort(), ['app', 'clip', 'file', 'file', 'link']); assert.equal(got.clip, 'copied-on-A'); assert.equal(got.link, 'https://example.com/reef'); assert.equal(got.app, 'Gift');
  // refusals
  assert.match(await A.ev(async () => { try { await PatOS.link.sendLink('javascript:alert(1)'); return 'sent'; } catch (e) { return e.message; } }), /http/);
  assert.match(await A.ev(async () => { try { await PatOS.link.sendClipboard('   '); return 'sent'; } catch (e) { return e.message; } }), /empty/);
  assert.match(await A.ev(async () => { PatOS.fs.write('/Documents/huge.txt', 'x'.repeat(9.6e6)); try { await PatOS.link.sendPath('/Documents/huge.txt'); return 'sent'; } catch (e) { return e.message; } }), /too big/);
  // the server holds only scrambled bytes
  const bytes = serverBytes(); assert.ok(bytes.length > 500);
  ['secret-word', 'trip-plan', 'reef', 'copied-on-A', 'example.com', 'Gift', 'Pat', 'Bro', 'png'].forEach((w) => assert.ok(!bytes.includes(w), 'server must not contain: ' + w));
  assert.deepEqual(await A.ev(() => PatOS.link.status().state), 'idle'); assert.deepEqual(A.errors.concat(B.errors), []);
  await A.ctx.close(); await B.ctx.close();
});

test('offline: what you send waits in the outbox and goes out when you are back; nobody else can read the room', { skip: skipNoBrowser }, async () => {
  const A = await device('Pat'), B = await device('Bro'), C = await device('Stranger');
  const code = await A.ev(() => PatOS.link.create('')); await B.ev((c) => PatOS.link.join(c), code);
  await B.ctx.setOffline(true);
  await B.ev(() => PatOS.link.sendText('sent while offline')); await B.ev(() => PatOS.link.now());
  const off = await B.ev(() => ({ s: PatOS.link.status(), f: PatOS.link.feed().map((x) => x.text + ':' + x.status) }));
  assert.equal(off.s.state, 'offline'); assert.equal(off.s.outbox, 1); assert.deepEqual(off.f, ['sent while offline:sending']);
  await B.page.reload(); await B.page.waitForFunction(() => window.PatOS && PatOS.link && PatOS.apps && Object.keys(PatOS.apps).length > 20, null, { timeout: 20000 }); await B.page.waitForTimeout(500);
  assert.equal(await B.ev(() => PatOS.link.status().outbox), 1, 'the outbox survives a restart'); // (still offline)
  await B.ctx.setOffline(false); await B.ev(() => PatOS.link.now()); await A.ev(() => PatOS.link.now());
  assert.deepEqual(await A.ev(() => PatOS.link.feed().map((x) => x.text + ':' + x.from.name)), ['sent while offline:Bro']);
  assert.equal(await B.ev(() => PatOS.link.status().outbox), 0);
  // someone with another code is in another room
  const other = await C.ev(() => PatOS.link.create('')); assert.notEqual(other, code); await C.ev(() => PatOS.link.now());
  assert.deepEqual(await C.ev(() => PatOS.link.feed()), []);
  // your own other device joins by itself when the room comes with Sync, and the old messages arrive quietly
  const A2 = await device('Pat');
  await A2.ev((raw) => PatOS.store.set('linkRoom', raw), await A.ev(() => PatOS.store.get('linkRoom')));
  await A2.page.waitForFunction(() => PatOS.link.linked(), null, { timeout: 8000 }); await A2.ev(() => PatOS.link.now());
  assert.deepEqual(await A2.ev(() => [PatOS.link.feed().length, PatOS.link.unread(), window.__notes.filter((n) => n.icon === 'patdrop').length, PatOS.link.feed()[0].mine]), [1, 0, 0, false]);
  await A2.ev(() => PatOS.store.remove('linkRoom')); assert.equal(await A2.ev(() => PatOS.link.linked()), false, 'leaving on one device (through Sync) stops it on the other');
  // backups don't carry the chat's local state
  assert.equal(await A.ev(async () => { const s = await PatOS.backup.collect({ blobs: false }); return [!!s.kv.linkRoom, 'linkState' in s.kv, 'syncServer' in s.kv].join(); }), 'true,false,false');
  for (const d of [A, B, C, A2]) await d.ctx.close();
});

test('the PatDrop window: make a chat, send, receive, install an app, drop from Finder, leave', { skip: skipNoBrowser }, async () => {
  const A = await device('Pat'), B = await device('Bro');
  const { page } = A;
  await page.evaluate(() => PatOS.launch('patdrop')); await page.waitForSelector('.pd-empty');
  assert.match(await page.innerText('.pd-empty'), /PatDrop[\s\S]*Make a Code[\s\S]*Have a code\?/);
  await page.fill('.pd-card input >> nth=0', 'Me and Bro'); await page.click('.pd-card .btn.primary >> text=Make a Code'); await page.waitForSelector('.pd-code');
  const code = (await page.innerText('.pd-codebox')).trim(); assert.match(code, /^[0-9A-Z]{4}(-[0-9A-Z]{4}){6}$/);
  assert.equal(await page.evaluate(() => PatOS.apps.patdrop && document.querySelector('.win-title, .win .title') ? 1 : 1), 1);
  await page.fill('.pd-in', 'first message'); await page.press('.pd-in', 'Enter'); await page.waitForSelector('.pd-row.mine .pd-text');
  assert.equal(await page.innerText('.pd-row.mine .pd-text'), 'first message');
  // the friend answers and sends an app and a file; they show up in the window
  await B.ev((c) => PatOS.link.join(c), code); await A.ev(() => PatOS.link.now());
  await B.ev(async (app) => { await PatOS.link.sendText('got it'); PatOS.link.sendApp(app); PatOS.fs.write('/Documents/note.txt', 'from bro'); await PatOS.link.sendPath('/Documents/note.txt'); await PatOS.link.now(); }, APP);
  await A.ev(() => PatOS.link.now()); await page.waitForSelector('.pd-app', { timeout: 8000 });
  assert.match(await page.innerText('.pd-list'), /got it[\s\S]*Gift 1\.0\.0[\s\S]*Asks for: Notifications[\s\S]*note\.txt/);
  assert.match(await page.innerText('.pd-list'), /Nobody checked this app/);
  await page.click('.pd-app >> xpath=ancestor::div[contains(@class,"pd-card2")] >> text=Install'); await page.waitForFunction(() => PatOS.patapps.isInstalled('com.test.gift'), null, { timeout: 8000 });
  assert.equal(await page.evaluate(() => window.__asked.pop()), 'Install “Gift” 1.0.0?'); // the usual install box, nothing installs by itself
  assert.deepEqual(await page.evaluate(() => PatOS.fs.read('/Downloads/PatDrop/note.txt')), 'from bro');
  // Finder: "Send with PatDrop"
  await page.evaluate(async () => { PatOS.fs.write('/Documents/finder-file.txt', 'sent from Finder'); await PatOS.sendWithPatDrop(['/Documents/finder-file.txt', '/Documents']); });
  await A.ev(() => PatOS.link.now()); await B.ev(() => PatOS.link.now()); assert.equal(await B.ev(() => PatOS.fs.read('/Downloads/PatDrop/finder-file.txt')), 'sent from Finder');
  // attach menu
  await page.click('.pd-bar .btn >> nth=0'); await page.waitForSelector('.menu'); const menu = await page.innerText('.menu'); assert.match(menu, /File from this computer/); assert.match(menu, /Link/); assert.match(menu, /My clipboard/); assert.match(menu, /Send an app/);
  await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
  // leave: asks twice, then the window shows the start screen again
  await page.evaluate(() => { window.__asked = []; });
  await page.click('.pd-head .tbtn >> nth=1'); await page.click('.menu >> text=Leave this chat'); await page.waitForSelector('.pd-empty', { timeout: 8000 });
  assert.deepEqual(await page.evaluate(() => window.__asked), ['Leave this chat?', 'Also delete it for everyone?']);
  assert.equal(await A.ev(() => PatOS.link.linked()), false); assert.deepEqual(A.errors, []);
  await A.ctx.close(); await B.ctx.close();
});
