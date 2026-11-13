/* Launchpad shows every app (4.0: World, Data, Gallery, Live and Shared Spaces were missing: their category had no section). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('every app that isn’t hidden is in Launchpad, the 4.0 apps too', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => PatOS.launchpad.show()); await page.waitForSelector('.lp-item');
  const r = await page.evaluate(() => {
    const shown = [...document.querySelectorAll('.lp-item span')].map((s) => s.textContent);
    const want = PatOS.appOrder.filter((id) => !PatOS.apps[id].hidden && id !== 'launchpad').map((id) => PatOS.apps[id].name);
    return { missing: want.filter((n) => !shown.includes(n)), shown };
  });
  assert.deepEqual(r.missing, [], 'not in Launchpad: ' + r.missing.join(', '));
  for (const n of ['PatOS World', 'PatOS Data', 'Gallery', 'PatOS Live', 'Shared Spaces', 'PatOS Studio']) assert.ok(r.shown.some((x) => x === n || x.includes(n.replace('PatOS ', ''))), n + ' is in Launchpad');
  assert.deepEqual(errors, []); await page.close();
});
