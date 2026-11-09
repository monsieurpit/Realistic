/* Terms of Use and Privacy Policy (js/legal.js): everyone must accept them before using PatOS, once per version, on every device;
   Settings shows the text from a small link at the bottom of its sidebar. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, reload, skipNoBrowser, POLICY } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('a new person (or someone updating) must read and accept before doing anything; once accepted it does not come back', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = await boot(page, srv.base, { fresh: true, policy: false, login: false });
  await page.waitForSelector('#legal-gate');
  assert.ok(POLICY, 'the version is read from js/legal.js');
  assert.equal(await page.isDisabled('#legal-gate .lg-accept'), true, 'Accept starts locked');
  assert.equal(await page.isDisabled('#legal-gate .lg-check input'), true, 'the box can only be ticked after reading');
  // the gate covers everything: a click in the middle of the screen lands on it
  assert.equal(await page.evaluate(() => !!document.elementFromPoint(innerWidth / 2, innerHeight / 2).closest('#legal-gate')), true);
  // keyboard shortcuts do nothing behind it
  await page.keyboard.press('Control+Space'); await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => { const sp = document.querySelector('#spotlight'); return !!sp && !sp.classList.contains('hidden'); }), false, 'Spotlight does not open');
  // Decline: PatOS explains it can't be used, and offers to read again
  await page.click('#legal-gate .lg-decline'); await page.waitForSelector('#legal-gate .lg-declined');
  await page.click('#legal-gate .lg-declined button'); await page.waitForSelector('#legal-gate .lg-text');
  // read to the end, tick, accept
  await page.evaluate(() => { const t = document.querySelector('#legal-gate .lg-text'); t.scrollTop = t.scrollHeight; t.dispatchEvent(new Event('scroll')); });
  await page.waitForFunction(() => !document.querySelector('#legal-gate .lg-check input').disabled);
  await page.check('#legal-gate .lg-check input');
  assert.equal(await page.isDisabled('#legal-gate .lg-accept'), false);
  await page.click('#legal-gate .lg-accept'); await page.waitForSelector('#legal-gate', { state: 'detached' });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('patos-policy')));
  assert.equal(saved.version, POLICY);
  await reload(page); await page.waitForTimeout(400);
  assert.equal(await page.$('#legal-gate'), null, 'not asked again for the same version');
  // a new version asks again
  await page.evaluate(() => localStorage.setItem('patos-policy', JSON.stringify({ version: '2000-01-01' })));
  await reload(page); await page.waitForSelector('#legal-gate');
  assert.deepEqual(errors, []); await page.close();
});

test('Settings has a small Privacy Policy & Terms link at the bottom of its sidebar that shows the text (not an app)', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errors = await boot(page, srv.base, { fresh: true });
  assert.equal(await page.evaluate(() => Object.keys(PatOS.apps).some((id) => /privacy|legal|terms/i.test(id))), false, 'it is not an app');
  await page.evaluate(() => PatOS.launch('settings')); await page.waitForSelector('.st-side .st-legal');
  const last = await page.evaluate(() => { const s = document.querySelector('.st-side'); return s.lastElementChild.className; });
  assert.match(last, /st-legal/, 'it is the last thing in the sidebar');
  await page.click('.st-side .st-legal'); await page.waitForSelector('.st-legal-text h2');
  assert.match(await page.textContent('.st-main'), /Limitation of liability/);
  assert.match(await page.textContent('.st-main'), /You accepted this version on/);
  assert.deepEqual(errors, []); await page.close();
});
