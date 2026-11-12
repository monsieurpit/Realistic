/* Accessibility (WCAG 2.2 A/AA rules, checked with axe-core): no serious or critical problem on the desktop, in Spotlight,
   or in the most used apps, in light and dark mode. (The page's zoom lock is a deliberate exception: PatOS is a whole
   desktop, so pinch-zoom would zoom the system itself; Settings › Accessibility › Text size enlarges app content instead.) */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

const APPS = ['settings', 'finder', 'notes', 'calendar', 'reminders', 'messages', 'developer', 'appstore', 'shortcuts', 'music', 'timeline'];
for (const theme of ['dark', 'light']) {
  test('no serious or critical accessibility problems (' + theme + ' mode)', { skip: skipNoBrowser }, async () => {
    const page = await b.newPage({ viewport: { width: 1280, height: 820 } }); await boot(page, srv.base, { fresh: true });
    await page.evaluate((t) => PatOS.setSetting('theme', t), theme); await page.waitForTimeout(300);
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const run = (sel) => page.evaluate(async (s) => { const res = await window.axe.run(s ? document.querySelector(s) : document, { resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
      return res.violations.filter((v) => (v.impact === 'serious' || v.impact === 'critical') && v.id !== 'meta-viewport').map((v) => v.id + ' ×' + v.nodes.length + ': ' + v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')); }, sel || null);
    const found = { desktop: await run(null) };
    for (const id of APPS) { await page.evaluate((a) => { PatOS.wm.closeAll(); PatOS.launch(a); }, id); await page.waitForTimeout(900); found[id] = await run('.window'); }
    await page.evaluate(() => { PatOS.wm.closeAll(); PatOS.spotlight.show(); }); await page.fill('.sp-input', 'notes'); await page.waitForTimeout(300); found.spotlight = await run('#spotlight');
    const bad = Object.entries(found).filter(([, v]) => v.length);
    assert.deepEqual(bad, [], JSON.stringify(Object.fromEntries(bad), null, 1));
    await page.close();
  });
}
