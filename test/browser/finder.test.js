/* Finder: copy, cut and paste, a folder can't be pasted into itself, files dropped from the computer */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('Finder copies, cuts, pastes and takes dropped files', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    PatOS.notify = () => {};
    PatOS.fs.mkdir('/Documents/Math'); PatOS.fs.write('/Documents/a.txt', 'A'); PatOS.fs.write('/Documents/b.txt', 'B');
    const w = PatOS.launch('finder', { path: '/Documents' }); await wait(300);
    const main = w.body.querySelector('.fd-main');
    const key = (k, o) => main.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true }, o)));
    w._finder.selectAll(); key('c', { ctrlKey: true });
    w._go('/Documents/Math'); await wait(100); key('v', { ctrlKey: true }); await wait(150);
    out.copied = PatOS.fs.list('/Documents/Math').map((x) => x.name).sort();
    out.originals = [PatOS.fs.exists('/Documents/a.txt'), PatOS.fs.exists('/Documents/b.txt')];
    w._go('/Documents'); await wait(100);
    main.querySelector('[data-path="/Documents/a.txt"]').click(); key('x', { ctrlKey: true }); await wait(100);
    out.cutLook = main.querySelector('[data-path="/Documents/a.txt"]').classList.contains('cut');
    w._go('/Desktop'); await wait(100); key('v', { ctrlKey: true }); await wait(150);
    out.moved = [PatOS.fs.read('/Desktop/a.txt'), PatOS.fs.exists('/Documents/a.txt')];
    const dt = new DataTransfer(); dt.items.add(new File(['hello'], 'dropped.txt', { type: 'text/plain' }));
    main.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); await wait(300);
    out.dropped = PatOS.fs.read('/Desktop/dropped.txt');
    return out;
  });
  assert.deepEqual(r.copied, ['a.txt', 'b.txt'], 'the folder itself must not be copied into itself');
  assert.deepEqual(r.originals, [true, true]);
  assert.equal(r.cutLook, true);
  assert.deepEqual(r.moved, ['A', false]);
  assert.equal(r.dropped, 'hello');
  assert.deepEqual(errors, []);
  await page.close();
});
