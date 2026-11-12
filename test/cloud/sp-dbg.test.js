/* Shared Spaces in PatOS (js/spaces.js, the Spaces app) against the emulator: invite and accept, a file opened as a copy on
   the device saves back as the next revision, a conflict keeps both versions, offline saves wait and go out, the app. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const emu = require('./emulator');
const { startServer, browser, boot } = require('../helpers');

let server, srv, b;
const tag = Date.now().toString(36).slice(-5);
test.before(async () => { if (emu.skip) return; server = await emu.start(); srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); if (server) server.stop(); });
const EMU = { auth: 'http://127.0.0.1:9199', firestoreHost: '127.0.0.1', firestorePort: 8180, projectId: 'demo-patos' };
async function person(name) {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 760 } }); await ctx.addInitScript((e) => { window.__PATOS_FIREBASE_EMULATOR = e; }, EMU);
  console.log('STEP 1');
  const page = await ctx.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  console.log('STEP 2');
  const u = name + tag; await page.evaluate(async (u) => { await PatOS.account.signUp(u, 'a long password 1'); await PatOS.spaces.start(); }, u);
  console.log('STEP 3');
  return { ctx, page, errors, name: u, ev: (fn, a) => page.evaluate(fn, a) };
}
const until = async (p, fn, a, ms) => p.page.waitForFunction(fn, a, { timeout: ms || 15000 });

test('a shared file: open as a copy, save back, conflicts keep both, offline saves wait', { skip: emu.skip }, async () => {
  const A = await person('ann'), B = await person('ben');
  console.log('STEP 4');
  const sid = await A.ev(() => PatOS.spaces.create('Group Lab'));
  console.log('STEP 5');
  await until(A, (sid) => PatOS.spaces.get(sid), sid);
  console.log('STEP 6');
  await A.ev(([sid, u]) => PatOS.spaces.invite(PatOS.spaces.get(sid), u, 'editor'), [sid, B.name]);
  console.log('STEP 7');
  await until(B, () => PatOS.spaces.invites().length === 1);
  console.log('STEP 8');
  assert.ok(await B.ev(() => PatOS.nc.list().some((n) => /Invitation to a space/.test(n.title) && n.actions.length === 2)), 'an invitation notifies, with Accept and Decline');
  await B.ev(() => PatOS.spaces.accept(PatOS.spaces.invites()[0]));
  console.log('STEP 9');
  await until(B, (sid) => PatOS.spaces.get(sid) && PatOS.spaces.roleOf(PatOS.spaces.get(sid)) === 'editor', sid);
  console.log('STEP 10');
  // A adds a file; B opens it: a copy on B's device, then edits it, and A gets revision 2
  await A.ev((sid) => PatOS.spaces.addFile(PatOS.spaces.get(sid), 'plan.txt', 'step 1'), sid);
  console.log('STEP 11');
  const path = await B.ev((sid) => new Promise((res) => { const off = PatOS.spaces.files(PatOS.spaces.get(sid), (l) => { if (l.length) { off(); PatOS.wm.closeAll(); res(PatOS.spaces.openFile(PatOS.spaces.get(sid), l[0])); } }); }), sid);
  console.log('STEP 12');
  assert.match(path, /^\/Spaces\/Group Lab\/plan\.txt$/);
  assert.equal(await B.ev((p) => PatOS.fs.read(p), path), 'step 1');
  console.log('STEP 13');
  await B.ev((p) => PatOS.fs.write(p, 'step 1\nstep 2 (ben)'), path);
  console.log('STEP 14');
  const watchA = (sid) => new Promise((res) => { const off = PatOS.spaces.files(PatOS.spaces.get(sid), (l) => { const f = l.find((x) => x.name === 'plan.txt'); if (f && f.rev === 2) { off(); res(f); } }); });
  const f2 = await A.ev(watchA, sid);
  console.log('STEP 15');
  assert.equal(f2.content, 'step 1\nstep 2 (ben)'); assert.equal(f2.updatedName, B.name);
  // a conflict: A saves revision 3 from revision 2 while B still thinks it is at 2; B's save keeps both
  await A.ev(([sid]) => new Promise((res) => { const off = PatOS.spaces.files(PatOS.spaces.get(sid), async (l) => { const f = l.find((x) => x.name === 'plan.txt'); off(); res(await PatOS.spaces.save(sid, f.id, 'step 1\nstep 2\nstep 3 (ann)', 2, f.name)); }); }), [sid]);
  console.log('STEP 16');
  await B.ev((p) => PatOS.fs.write(p, 'step 1\nstep 2 (ben)\nben again'), path);
  console.log('STEP 17');
  await until(B, () => PatOS.nc.list().some((n) => /Someone saved first/.test(n.title)), null, 15000);
  const names = await A.ev((sid) => new Promise((res) => { const off = PatOS.spaces.files(PatOS.spaces.get(sid), (l) => { if (l.length >= 2) { off(); res(l.map((f) => [f.name, f.content])); } }); }), sid);
  console.log('STEP 18');
  assert.ok(names.some(([n, c]) => n === 'plan.txt' && /step 3 \(ann\)/.test(c)), 'Ann’s save is not overwritten');
  assert.ok(names.some(([n, c]) => /your version/.test(n) && /ben again/.test(c)), 'Ben’s version is kept as a copy');
  // offline: a save waits on the device and goes out when the internet is back
  await B.ctx.setOffline(true); await B.ev(() => window.dispatchEvent(new Event('offline')));
  console.log('STEP 19');
  const q = await B.ev(async (sid) => { const f = await new Promise((res) => { const off = PatOS.spaces.files(PatOS.spaces.get(sid), (l) => { off(); res(l.find((x) => x.name === 'plan.txt')); }); }); Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); return PatOS.spaces.save(sid, f.id, 'offline edit', f.rev, f.name); }, sid);
  console.log('STEP 20');
  assert.equal(q.queued, true); assert.equal(await B.ev(() => PatOS.spaces.pending().length), 1);
  console.log('STEP 21');
  await B.ctx.setOffline(false); await B.ev(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }); window.dispatchEvent(new Event('online')); });
  console.log('STEP 22');
  await until(B, () => PatOS.spaces.pending().length === 0, null, 20000);
  console.log('STEP 23');
  const f4 = await A.ev((sid) => new Promise((res) => { const off = PatOS.spaces.files(PatOS.spaces.get(sid), (l) => { const f = l.find((x) => x.name === 'plan.txt'); if (f && f.content === 'offline edit') { off(); res(f.rev); } }); }), sid);
  console.log('STEP 24');
  assert.equal(f4, 4);
  // the app and Command Center
  await A.ev(() => PatOS.launch('spaces')); await A.page.waitForSelector('.sp-si'); await A.page.click('.sp-si');
  console.log('STEP 25');
  await A.page.waitForSelector('.sp-file'); assert.ok((await A.page.textContent('.sp-files')).includes('plan.txt'));
  console.log('STEP 26');
  assert.match(await A.ev(() => PatOS.spaces.summary()), /1 space/);
  console.log('STEP 27');
  assert.deepEqual(A.errors.filter((e) => !/Firebase|firestore|network|offline/i.test(e)), []);
  await A.ctx.close(); await B.ctx.close();
  console.log('STEP 28');
});
