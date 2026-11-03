/* On GitHub Actions (CI=true) the browser tests must really run. On a computer without Playwright they are
   skipped, which is fine for quick checks, but a green result in CI has to mean everything ran. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { browser, playwright } = require('../helpers');

test('in CI the browser tests are not skipped', { skip: process.env.CI ? false : 'only checked in CI' }, async () => {
  assert.ok(playwright(), 'Playwright is not installed: run npm install');
  const b = await browser();
  assert.ok(b, 'Chromium is not installed: run npx playwright install chromium');
  await b.close();
});
