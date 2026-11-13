/* Device notifications (4.0.2): a message reaches the device when PatOS isn't the window in front, or is closed.
   - sw.js shows a Web Push (push-server.js) only when no PatOS window is in front, with the conversation attached
   - PatOS.notify goes to the device (through the service worker) when PatOS isn't focused, not only when the tab is hidden
   - clicking opens the conversation; Messages asks to turn notifications on (on iPhone: add to the Home Screen first)
   Uses Chromium's newer headless mode: the older one always refuses notifications. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, boot, skipNoBrowser, playwright } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await playwright().chromium.launch({ channel: 'chromium' }); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });
const shown = (p) => p.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration('/'); return reg ? (await reg.getNotifications()).map((n) => ({ title: n.title, body: n.body, tag: n.tag, data: n.data })) : null; });

test('a push shows when PatOS is closed, not when it is in front', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext(); await ctx.grantPermissions(['notifications']);
  const page = await ctx.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const regs = []; const cdp = await ctx.newCDPSession(page); cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => regs.push(...e.registrations));
  await cdp.send('ServiceWorker.enable'); await page.waitForTimeout(800);
  const r = regs.find((x) => !x.isDeleted); assert.ok(r, 'the service worker is there'); const origin = new URL(r.scopeURL).origin;
  const push = (s, body) => s.send('ServiceWorker.deliverPushMessage', { origin: origin + '/', registrationId: r.registrationId, data: JSON.stringify({ title: 'ann', body, tag: 'msg-a_b', cid: 'a_b', at: Date.now() }) });
  await push(cdp, 'in front'); await page.waitForTimeout(800);
  assert.deepEqual(await shown(page), [], 'PatOS in front shows it itself');
  assert.deepEqual(errors, []);
  // PatOS closed: only the service worker is left
  const keep = await ctx.newPage(); await keep.goto('about:blank'); const kc = await ctx.newCDPSession(keep); await kc.send('ServiceWorker.enable');
  await page.close(); await keep.waitForTimeout(500);
  await push(kc, 'closed'); await keep.waitForTimeout(1000);
  const p3 = await ctx.newPage(); await p3.goto(origin + '/manifest.webmanifest');
  assert.deepEqual(await shown(p3), [{ title: 'ann', body: 'closed', tag: 'msg-a_b', data: { push: true, cid: 'a_b' } }]);
  await ctx.close();
});

test('PatOS.notify reaches the device when PatOS is not focused; clicks open the conversation; the Messages bar', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext(); await ctx.grantPermissions(['notifications']);
  const page = await ctx.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => navigator.serviceWorker.ready);
  // in front: only PatOS's own banner
  await page.evaluate(() => PatOS.notify({ title: 'In front', body: 'x', icon: 'messages' })); await page.waitForTimeout(500);
  assert.deepEqual(await shown(page), []);
  // another window in front (the tab is still visible): the device shows it too, a message with its conversation
  await page.evaluate(() => { document.hasFocus = () => false; PatOS.notify({ title: 'ann', body: 'Salut', icon: 'messages', tag: 'msg-a_b', chat: 'a_b' }); PatOS.notify({ title: 'Saved', body: 'Report', icon: 'textedit' }); });
  await page.waitForTimeout(800);
  const s = await shown(page); assert.equal(s.length, 2, JSON.stringify(s));
  assert.deepEqual(s.find((n) => n.title === 'ann'), { title: 'ann', body: 'Salut', tag: 'msg-a_b', data: { chat: 'a_b' } });
  assert.equal(s.find((n) => n.title === 'Saved').data.nc, true);
  // turned off in Settings: nothing
  await page.evaluate(async () => { PatOS.setSetting('systemNotifications', false); (await (await navigator.serviceWorker.ready).getNotifications()).forEach((n) => n.close()); PatOS.notify({ title: 'Off', body: 'x', icon: 'messages' }); });
  await page.waitForTimeout(500); assert.deepEqual(await shown(page), []);
  // a click on a message notification (sw.js tells PatOS): Messages opens on that conversation
  await page.evaluate(() => { document.hasFocus = () => true; navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { patosOpen: { app: 'messages', chat: 'a_b' } } })); });
  await page.waitForFunction(() => PatOS.wm.windowsOf('messages').length === 1, null, { timeout: 5000 });
  assert.deepEqual(errors, []);
  await ctx.close();
  // opened from a notification while PatOS was closed: the address opens Messages
  const c2 = await b.newContext(); const p2 = await c2.newPage(); const e2 = await boot(p2, srv.base, { fresh: true });
  await p2.goto(srv.base + '/?app=messages&chat=a_b'); await p2.waitForTimeout(1500); if (await p2.$('.lock, #lock, .lockscreen')) await p2.keyboard.press('Enter'); await p2.waitForFunction(() => window.PatOS && PatOS.wm && PatOS.wm.windowsOf('messages').length === 1, null, { timeout: 15000 });
  assert.deepEqual(e2, []);
  await c2.close();
});

test('Messages: notification states on each kind of device', { skip: skipNoBrowser }, async () => {
  const states = async (opts, setup) => {
    const ctx = await b.newContext(opts || {}); if (setup) await ctx.addInitScript(setup);
    const page = await ctx.newPage(); await boot(page, srv.base, { fresh: true });
    const st = await page.evaluate(() => PatOS.chat.notifState()); await ctx.close(); return st;
  };
  assert.equal(await states(), 'ask', 'a computer that hasn’t answered yet');
  assert.equal(await states({ permissions: ['notifications'] }), 'on');
  assert.equal(await states({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }, () => { delete window.Notification; }), 'homescreen', 'iPhone in Safari: add to the Home Screen');
  assert.equal(await states({ userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' }, () => { delete window.Notification; }), 'unsupported');
});
