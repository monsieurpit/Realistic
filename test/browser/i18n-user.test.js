/* French mode translates PatOS's own words, never what people wrote, copied or named (Timeline's clipboard, Notes, Messages...). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('French: copied text stays as written', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext({ locale: 'fr-CA' }); const page = await ctx.newPage();
  const { boot } = require('../helpers'); await boot(page, srv.base, { fresh: true });
  assert.equal(await page.evaluate(() => PatOS.lang), 'fr');
  await page.evaluate(() => { navigator.clipboard.writeText('Delete'); PatOS.launch('timeline'); });
  await page.waitForTimeout(1200);
  const tl = await page.evaluate(() => [...document.querySelectorAll('.tl-ctext')].map((e) => e.textContent));
  assert.ok(tl.includes('Delete'), 'the copied word stays "Delete": ' + JSON.stringify(tl));
  assert.ok(!tl.includes('Supprimer'));
  await ctx.close();
});
