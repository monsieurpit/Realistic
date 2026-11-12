/* First launch with an account (3.2): language, then an account is required. Signing in brings the account's settings
   (language, name, theme) to the new device and ends setup; creating one goes on with the rest of setup.
   Real PatOS pages and Firebase code, against the Firebase emulator. Usage: npm run test:cloud */
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
async function device() {
  const ctx = await b.newContext({ viewport: { width: 1100, height: 760 } }); await ctx.addInitScript((e) => { window.__PATOS_FIREBASE_EMULATOR = e; }, EMU);
  const page = await ctx.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  return { ctx, page, errors };
}
// a fresh install: setup from the start (the test helper normally skips it)
async function freshSetup(page, at) {
  await page.evaluate((s) => { PatOS.store.set('setupDone', false); PatOS.store.set('setupStep', s); PatOS._leaving = true; location.reload(); }, at);
  await page.waitForSelector('#setup .su-card', { timeout: 20000 }); // (no lock screen before setup)
}

test('signing in during setup brings the account’s language, name and look, and ends setup', { skip: emu.skip }, async () => {
  const user = 'setup' + tag, pass = 'correct horse battery';
  const A = await device();
  await A.page.evaluate(async ([u, p]) => { await PatOS.account.signUp(u, p); PatOS.setSetting('userName', 'Camille'); PatOS.setSetting('theme', 'light'); PatOS.setSetting('language', 'fr'); await PatOS.sync.now(); await PatOS.sync.now(); }, [user, pass]);

  const B = await device();
  await freshSetup(B.page, 'account');
  assert.match(await B.page.textContent('#setup h1'), /Your account/);
  assert.equal(await B.page.locator('#setup .su-next:has-text("Skip"), #setup button:has-text("Cancel")').count(), 0, 'there is no way around the account');
  await B.page.click('#setup .su-tab:has-text("Sign in")');
  await B.page.fill('#setup input[autocomplete="username"]', user); await B.page.fill('#setup input[type="password"]', pass);
  await B.page.click('#setup .su-next');
  // the account's language is French: the page reloads into French and shows the last screen
  await B.page.waitForFunction(() => window.PatOS && PatOS.settings && PatOS.settings.language === 'fr' && document.querySelector('#setup h1') && /Bon retour, Camille/.test(document.querySelector('#setup h1').textContent), null, { timeout: 40000 });
  assert.equal(await B.page.evaluate(() => PatOS.settings.theme), 'light');
  await B.page.click('#setup .su-next');
  await B.page.waitForFunction(() => PatOS.store.get('setupDone', false) && !document.getElementById('setup'), null, { timeout: 5000 });
  assert.deepEqual(B.errors.filter((e) => !/Firebase|firestore|network/i.test(e)), []);
  await A.ctx.close(); await B.ctx.close();
});

test('creating an account during setup goes on with name, look and wallpaper', { skip: emu.skip }, async () => {
  const C = await device(); await freshSetup(C.page, 'account');
  await C.page.fill('#setup input[autocomplete="username"]', 'newbie' + tag);
  const pw = C.page.locator('#setup input[type="password"]'); await pw.nth(0).fill('a long password 1'); await pw.nth(1).fill('a different one 2');
  await C.page.click('#setup .su-next'); assert.match(await C.page.textContent('#setup .su-note'), /don’t match/);
  await pw.nth(1).fill('a long password 1'); await C.page.click('#setup .su-next');
  await C.page.waitForFunction(() => /What’s your name/.test(document.querySelector('#setup h1').textContent), null, { timeout: 30000 });
  assert.equal(await C.page.inputValue('#setup .su-in'), 'Newbie' + tag, 'the name starts as the username');
  assert.ok(await C.page.evaluate(() => PatOS.account.signedIn()));
  await C.ctx.close();
});
