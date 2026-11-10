/* iPhone sweep (3.1): every app opens on an iPhone without errors, and the things found broken there stay fixed:
   Messages signed out showed a blank screen, the Notes toolbar ran off the screen, the YouTube search box was cut,
   Control Center and banners were clear glass straight over app icons (unreadable), and wide toolbars gave no hint
   that they scroll. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser, playwright } = require('../helpers');

let srv, b, ctx, page, errors;
test.before(async () => {
  if (skipNoBrowser) return; srv = await startServer(); b = await browser();
  ctx = await b.newContext(Object.assign({}, playwright().devices['iPhone 14'])); page = await ctx.newPage();
  errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => { PatOS.notify = () => {}; });
});
test.after(async () => { if (ctx) await ctx.close(); if (b) await b.close(); if (srv) srv.stop(); });
const open = (id) => page.evaluate(async (id) => { PatOS.wm.closeAll(); await new Promise((r) => setTimeout(r, 200)); PatOS.launch(id); await new Promise((r) => setTimeout(r, 1300)); }, id);

test('every app opens on an iPhone with no errors and no button pushed off the screen', { skip: skipNoBrowser }, async () => {
  const ids = await page.evaluate(() => PatOS.appOrder.filter((id) => PatOS.apps[id] && !PatOS.apps[id].hidden && !PatOS.apps[id].action));
  assert.ok(ids.length > 40);
  const cut = [];
  for (const id of ids) {
    const r = await page.evaluate(async (id) => {
      PatOS.wm.closeAll(); await new Promise((res) => setTimeout(res, 150));
      let w; try { w = PatOS.launch(id); } catch (e) { return { crash: String(e.message || e) }; }
      await new Promise((res) => setTimeout(res, 900));
      if (!w || !w.el) return { nowin: true };
      const vw = innerWidth; const out = [];
      // a button that sticks out past the right edge, and no scroller to bring it in
      w.el.querySelectorAll('button, .tbtn, input, select').forEach((el) => {
        const r = el.getBoundingClientRect(); if (!r.width || !r.height || r.top > innerHeight || r.bottom < 0) return;
        if (r.right > vw + 1 && r.left < vw - 4) {
          let p = el.parentElement, scroller = false; while (p && p !== w.el) { const s = getComputedStyle(p).overflowX; if (s === 'auto' || s === 'scroll') { scroller = true; break; } p = p.parentElement; }
          if (!scroller) out.push(el.className || el.tagName);
        }
      });
      return { err: !!w.body.querySelector('.app-error'), out };
    }, id);
    assert.ok(!r.crash && !r.nowin && !r.err, id + ' should open: ' + JSON.stringify(r));
    // (the camera's mode strip slides like the real one: its far modes are meant to sit at the edge)
    if (r.out.length && id !== 'photobooth') cut.push(id + ': ' + r.out.join(', '));
  }
  assert.deepEqual(cut, [], 'buttons cut off at the right edge');
  assert.deepEqual(errors.filter((e) => !/Failed to load resource|net::|status of 4\d\d|status of 5\d\d/.test(e)), []);
});

test('Messages signed out shows how to start (not a blank screen)', { skip: skipNoBrowser }, async () => {
  await open('messages');
  const r = await page.evaluate(() => { const c = PatOS.wm.active.el.querySelector('.m2-card'); const b = c && c.getBoundingClientRect(); return b ? [Math.round(b.width), Math.round(b.height), c.textContent] : null; });
  assert.ok(r && r[0] > 200 && r[1] > 100, 'the sign-in card is visible: ' + JSON.stringify(r));
  assert.match(r[2], /Create Account/);
});

test('Notes: the list has no formatting buttons, the note’s toolbar fits the screen, folder names are whole', { skip: skipNoBrowser }, async () => {
  await open('notes');
  const list = await page.evaluate(() => {
    const t = PatOS.wm.active.toolbar;
    return { fmt: [...t.querySelectorAll('.nt-fmt')].filter((b) => b.offsetWidth).length, names: [...document.querySelectorAll('.nf-side .nf-name')].map((n) => n.scrollWidth <= n.clientWidth + 1) };
  });
  assert.equal(list.fmt, 0, 'no Bold/Italic… in the note list');
  assert.ok(list.names.length && list.names.every(Boolean), 'folder names are not cut');
  const note = await page.evaluate(async () => {
    PatOS.wm.active.el.querySelector('.notes-side .nt-item, .notes-side [class*=item]').click(); await new Promise((r) => setTimeout(r, 700));
    const t = PatOS.wm.active.toolbar; return { sw: t.scrollWidth, cw: t.clientWidth, bold: !!t.querySelector('[aria-label="Bold"]').offsetWidth };
  });
  assert.ok(note.sw <= note.cw + 1, 'the note toolbar fits: ' + JSON.stringify(note));
  assert.equal(note.bold, true);
});

test('YouTube: the search box fits next to the logo', { skip: skipNoBrowser }, async () => {
  await open('youtube');
  const r = await page.evaluate(() => { const q = document.querySelector('.ytx-q').getBoundingClientRect(); return [Math.round(q.right), innerWidth, Math.round(q.width)]; });
  assert.ok(r[0] <= r[1] && r[2] > 60, JSON.stringify(r));
});

test('a toolbar wider than the screen fades at the edge that has more', { skip: skipNoBrowser }, async () => {
  await open('calendar');
  const r = await page.evaluate(async () => {
    const t = PatOS.wm.active.toolbar; const a = t.className;
    t.scrollLeft = t.scrollWidth; await new Promise((res) => setTimeout(res, 100)); return [a, t.className];
  });
  assert.match(r[0], /tb-more-r/); assert.doesNotMatch(r[0], /tb-more-l/);
  assert.match(r[1], /tb-more-l/); assert.doesNotMatch(r[1], /tb-more-r/);
});

test('Control Center, banners and Spotlight have enough body to read over the home screen', { skip: skipNoBrowser }, async () => {
  await page.evaluate(() => PatOS.wm.closeAll());
  const alpha = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return 0; const p = m[1].split(','); return p.length > 3 ? parseFloat(p[3]) : 1; };
  const cc = await page.evaluate(async () => { PatOS.panels.toggle('#control-center'); await new Promise((r) => setTimeout(r, 500)); const e = document.getElementById('control-center'); const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return { bg: c.backgroundColor, bf: c.backdropFilter, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight }; });
  assert.ok(alpha(cc.bg) >= 0.3 && /blur\((2\d|3\d)px\)/.test(cc.bf), 'Control Center dims and blurs what is behind: ' + JSON.stringify(cc));
  assert.ok(cc.w >= cc.vw - 1 && cc.h >= cc.vh - 1, 'it covers the screen: ' + JSON.stringify(cc));
  // a tap on its empty background closes it
  await page.evaluate(() => { const e = document.getElementById('control-center'); e.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  assert.equal(await page.evaluate(() => document.getElementById('control-center').classList.contains('hidden')), true);
  const t = await page.evaluate(() => {
    const el = document.createElement('div'); el.className = 'toast in'; document.getElementById('toasts').appendChild(el);
    const c = getComputedStyle(el); const v = [c.getPropertyValue('--g-t'), c.backdropFilter]; el.remove(); return v;
  });
  assert.ok(alpha(t[0]) >= 0.6, 'banners: ' + JSON.stringify(t));
  const sp = await page.evaluate(async () => { PatOS.spotlight.toggle(); await new Promise((r) => setTimeout(r, 400)); const v = getComputedStyle(document.querySelector('#spotlight .sp-box')).getPropertyValue('--g-t'); PatOS.spotlight.hide(); return v; });
  assert.ok(alpha(sp) >= 0.5, 'Spotlight: ' + sp);
});
