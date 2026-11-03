/* Shared helpers for PatOS tests.
   - startServer(): runs server.js on a free port and waits until it answers
   - browser(): Playwright Chromium, or null when Playwright isn't installed (browser tests then skip)
   - boot(page, base, opts): opens PatOS, skips the setup assistant and logs in */
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');
const ROOT = path.join(__dirname, '..');

function freePort() {
  return new Promise((res, rej) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
}
async function startServer() {
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(port) }), stdio: ['ignore', 'ignore', 'pipe'] });
  let err = ''; child.stderr.on('data', (d) => { err += d; });
  const base = 'http://localhost:' + port;
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(base + '/api/ping'); if (r.ok) return { base, port, stop: () => child.kill() }; } catch (e) {}
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill(); throw new Error('server did not start: ' + err);
}
function playwright() { try { return require('playwright'); } catch (e) { return null; } }
async function browser() {
  const pw = playwright(); if (!pw) return null;
  try { return await pw.chromium.launch(); } catch (e) { return null; }
}
async function boot(page, base, opts) {
  opts = opts || {};
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 2).join('').trim()));
  await page.goto(base + '/manifest.webmanifest');
  await page.evaluate((o) => { if (o.fresh) localStorage.clear(); localStorage.setItem('patos:setupDone', 'true'); localStorage.setItem('patos:seenWelcome', 'true'); localStorage.setItem('patos:iosHint', 'true'); }, opts);
  await page.goto(base + '/');
  await page.waitForFunction(() => window.PatOS && PatOS.boot && PatOS.fs, null, { timeout: 20000 });
  if (opts.login !== false) { await page.waitForSelector('#lock:not(.hidden)', { timeout: 20000 }); await page.evaluate(() => PatOS.boot.login()); await page.waitForTimeout(600); }
  return errors;
}
// reload and wait until PatOS has started again (its scripts load after the database is read)
async function reload(page) {
  await page.reload();
  await page.waitForFunction(() => window.PatOS && PatOS.boot && PatOS.fs && PatOS.apps && Object.keys(PatOS.apps).length > 20, null, { timeout: 20000 });
  await page.waitForTimeout(300);
}
// pass "skip" to node:test when the browser isn't there
const skipNoBrowser = !playwright() ? 'Playwright is not installed (npm i -D playwright && npx playwright install chromium)' : false;
module.exports = { ROOT, startServer, browser, boot, reload, skipNoBrowser, playwright };
