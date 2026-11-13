/* The first time someone opens PatOS (4.0): Hello → language → account → name → look → wallpaper → done, on a brand-new
   browser that doesn't look automated (the old account invitation skips test browsers, so it has to be fooled here).
   PatOS must never restart during setup (choosing French switches at once), and the old "Create your PatOS account"
   invitation must never cover the setup. Against the Firebase emulator. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const emu = require('./emulator');
const { startServer, browser, POLICY } = require('../helpers');

let server, srv, b;
const tag = Date.now().toString(36).slice(-5);
test.before(async () => { if (emu.skip) return; server = await emu.start(); srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); if (server) server.stop(); });
const EMU = { auth: 'http://127.0.0.1:9199', firestoreHost: '127.0.0.1', firestorePort: 8180, projectId: 'demo-patos' };

test('first launch: language and account without any restart, and no old account pop-up', { skip: emu.skip }, async () => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
  await ctx.addInitScript((e) => { window.__PATOS_FIREBASE_EMULATOR = e; Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); }, EMU);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  let loads = 0; page.on('load', () => { loads++; });
  // a brand-new visitor: only the Terms are accepted ahead (they have their own test)
  await page.goto(srv.base + '/manifest.webmanifest');
  await page.evaluate((v) => { localStorage.clear(); localStorage.setItem('patos-policy', JSON.stringify({ version: v, at: Date.now() })); }, POLICY);
  await page.goto(srv.base + '/'); loads = 0;
  await page.waitForSelector('#setup .su-card', { timeout: 30000 });
  const popup = () => page.evaluate(() => !!document.querySelector('.acc-layer'));
  await page.click('#setup .su-next'); // Get Started
  await page.waitForSelector('#setup .su-opt');
  await page.waitForTimeout(6500); // (the old invitation used to appear after 6 s)
  assert.equal(await popup(), false, 'no old account pop-up over the setup');
  // French: at once, no restart
  await page.click('#setup .su-opt:has-text("Français")'); await page.waitForTimeout(800);
  assert.equal(loads, 0, 'choosing a language does not restart PatOS');
  assert.equal(await page.evaluate(() => PatOS.lang), 'fr');
  assert.match(await page.evaluate(() => document.querySelector('#setup').textContent), /Ton compte|Votre compte|Créer/, 'the next screen is in French');
  assert.match(await page.evaluate(() => document.getElementById('menubar').textContent), /Fichier|Édition|Fenêtre/, 'and so is the menu bar, without restarting');
  // the account: created here, no restart
  const u = 'onb' + tag;
  await page.fill('#setup input[autocomplete="username"]', u); await page.fill('#setup input[type=password] >> nth=0', 'a long password 1'); await page.fill('#setup input[type=password] >> nth=1', 'a long password 1');
  await page.click('#setup .su-next'); await page.waitForSelector('#setup .su-in[maxlength="24"]', { timeout: 20000 }); // the name
  assert.equal(loads, 0, 'creating the account does not restart PatOS');
  assert.equal(await popup(), false);
  await page.click('#setup .su-next'); await page.waitForTimeout(300); // name
  await page.click('#setup .su-next'); await page.waitForTimeout(300); // look
  await page.click('#setup .su-next'); await page.waitForTimeout(300); // wallpaper
  await page.click('#setup .su-next'); await page.waitForTimeout(900); // done: Start
  assert.equal(await page.evaluate(() => !!document.getElementById('setup')), false, 'setup is over');
  assert.equal(await page.evaluate(() => PatOS.store.get('setupDone', false)), true);
  assert.equal(loads, 0, 'not a single restart in the whole setup');
  // and later, signed in, the old invitation still never comes
  await page.waitForTimeout(6500); assert.equal(await popup(), false, 'signed in: no invitation');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('back to English from a French device, live', { skip: emu.skip }, async () => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-CA' });
  await ctx.addInitScript((e) => { window.__PATOS_FIREBASE_EMULATOR = e; }, EMU);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(srv.base + '/manifest.webmanifest');
  await page.evaluate((v) => { localStorage.clear(); localStorage.setItem('patos-policy', JSON.stringify({ version: v, at: Date.now() })); }, POLICY);
  await page.goto(srv.base + '/'); let loads = 0; page.on('load', () => { loads++; });
  await page.waitForSelector('#setup .su-card', { timeout: 30000 });
  assert.equal(await page.evaluate(() => PatOS.lang), 'fr', 'a French device starts in French');
  await page.click('#setup .su-next'); await page.waitForSelector('#setup .su-opt');
  await page.click('#setup .su-opt:has-text("English")'); await page.waitForTimeout(800);
  assert.equal(loads, 0); assert.equal(await page.evaluate(() => PatOS.lang), 'en');
  assert.match(await page.evaluate(() => document.querySelector('#setup').textContent), /Your account|Create/);
  assert.match(await page.evaluate(() => document.getElementById('menubar').textContent), /File|Edit|Window/, 'the menu bar is back in English');
  assert.deepEqual(errors, []);
  await ctx.close();
});
