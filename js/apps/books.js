/* Books — 70,000 free classic books from Project Gutenberg, with a page-turning reader */
(function () {
  'use strict';
  const { h } = PatOS;
  const FEATURED = [[11, 'Alice’s Adventures in Wonderland', 'Lewis Carroll'], [84, 'Frankenstein', 'Mary Shelley'], [1342, 'Pride and Prejudice', 'Jane Austen'], [1661, 'The Adventures of Sherlock Holmes', 'Arthur Conan Doyle'], [120, 'Treasure Island', 'Robert Louis Stevenson'], [64317, 'The Great Gatsby', 'F. Scott Fitzgerald'], [2701, 'Moby Dick', 'Herman Melville'], [74, 'The Adventures of Tom Sawyer', 'Mark Twain'], [345, 'Dracula', 'Bram Stoker'], [35, 'The Time Machine', 'H. G. Wells'], [36, 'The War of the Worlds', 'H. G. Wells'], [16, 'Peter Pan', 'J. M. Barrie'], [55, 'The Wonderful Wizard of Oz', 'L. Frank Baum'], [1260, 'Jane Eyre', 'Charlotte Brontë'], [17489, 'Les Misérables (tome 1)', 'Victor Hugo'], [5097, 'Vingt mille lieues sous les mers', 'Jules Verne'], [4791, 'Voyage au centre de la Terre', 'Jules Verne'], [800, 'Le Tour du monde en 80 jours', 'Jules Verne'], [13951, 'Les Trois Mousquetaires', 'Alexandre Dumas'], [17989, 'Le Comte de Monte-Cristo (tome 1)', 'Alexandre Dumas'], [14287, 'L’Île mystérieuse', 'Jules Verne']];
  const cover = (id) => 'https://www.gutenberg.org/cache/epub/' + id + '/pg' + id + '.cover.medium.jpg';

  PatOS.registerApp({
    id: 'books', name: 'Books', icon: 'books', width: 1000, height: 680, category: 'Apps', keywords: 'read library novel ebook livres lecture gutenberg',
    about: 'Read thousands of free classic books from Project Gutenberg.',
    launch(win) {
      win.el.classList.add('has-toolbar');
      const lib = PatOS.store.get('booksLib', {}); // id -> { title, author, page, pages, opened }
      const saveLib = () => PatOS.store.set('booksLib', lib);
      const prefs = Object.assign({ size: 19, theme: 'paper', font: 'serif' }, PatOS.store.get('booksPrefs', {}));
      const q = h('input', { class: 'field', placeholder: 'Search 70,000 free books', style: { width: '240px' } });
      const bHome = h('button', { class: 'btn' }, PatOS.t('Library'));
      win.toolbar.append(bHome, h('div', { style: { flex: 1 } }), q);
      win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px';
      const main = h('div', { class: 'bk-main' }); win.body.appendChild(main);
      const bookCard = (b) => {
        const c = h('div', { class: 'bk-card' }, h('div', { class: 'bk-cover' }, h('img', { src: b.cover || cover(b.id), alt: '', loading: 'lazy', onerror: (e) => { e.target.replaceWith(h('div', { class: 'bk-fake' }, h('b', {}, b.title), h('small', {}, b.author || ''))); } })), h('b', {}, b.title), h('small', {}, (b.author || '').replace(/^(.+), (.+)$/, '$2 $1')),
          lib[b.id] && lib[b.id].pages ? h('div', { class: 'bk-prog' }, h('i', { style: { width: Math.round((lib[b.id].page + 1) / lib[b.id].pages * 100) + '%' } })) : null);
        c.onclick = () => read(b); return c;
      };
      function home() {
        win.setTitle(PatOS.t('Books')); main.innerHTML = '';
        const mine = Object.entries(lib).sort((a, b) => b[1].opened - a[1].opened).map(([id, v]) => ({ id: +id, title: v.title, author: v.author }));
        if (mine.length) { main.appendChild(h('h2', {}, PatOS.t('Continue reading'))); const g = h('div', { class: 'bk-grid' }); mine.forEach((b) => g.appendChild(bookCard(b))); main.appendChild(g); }
        main.appendChild(h('h2', {}, PatOS.t('Classics')));
        const g = h('div', { class: 'bk-grid' }); FEATURED.forEach(([id, title, author]) => g.appendChild(bookCard({ id, title, author }))); main.appendChild(g);
        main.appendChild(h('p', { class: 'bk-note' }, PatOS.t('Free books from Project Gutenberg.')));
      }
      // books that were opened once are kept on the device (they never change), so they open instantly and offline
      const BOOKS = 'patos-data-books';
      async function savedText(id) { try { if (!window.caches) return null; const r = await (await caches.open(BOOKS)).match('/patos-books/' + id); return r ? await r.text() : null; } catch (e) { return null; } }
      async function saveText(id, text) { try { if (window.caches) await (await caches.open(BOOKS)).put('/patos-books/' + id, new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })); } catch (e) {} }
      async function base() { const b = PatOS.server && await PatOS.server(); if (!b) throw new Error(PatOS.sandboxed ? PatOS.t('This is blocked in Claude Artifacts. Open PatOS from its website.') : PatOS.t('Open PatOS from its website (your Render link) to search and read books.')); return b; }
      async function search(text) {
        main.innerHTML = ''; main.appendChild(h('div', { class: 'bk-msg' }, PatOS.t('Searching…'))); win.setTitle(text);
        if (PatOS.isOffline()) { main.innerHTML = ''; main.appendChild(PatOS.offlineCard(() => search(text), { body: 'Searching for books needs the internet. Your opened books are in Continue reading.' })); return; }
        try {
          const b = await base(); const r = await fetch(b + '/api/books/search?q=' + encodeURIComponent(text)); const j = await r.json(); if (j.error) throw new Error(j.error);
          main.innerHTML = ''; main.appendChild(h('h2', {}, PatOS.t('Results for') + ' “' + text + '”'));
          if (!j.items.length) { main.appendChild(h('div', { class: 'bk-msg' }, PatOS.t('No books found.'))); return; }
          const g = h('div', { class: 'bk-grid' }); j.items.forEach((x) => g.appendChild(bookCard(x))); main.appendChild(g);
        } catch (e) { main.innerHTML = ''; main.appendChild(h('div', { class: 'bk-msg' }, e.message)); }
      }
      async function read(b) {
        main.innerHTML = ''; main.appendChild(h('div', { class: 'bk-msg' }, PatOS.t('Opening the book…'))); win.setTitle(b.title);
        let text = await savedText(b.id);
        if (text == null) {
          if (PatOS.isOffline()) { main.innerHTML = ''; main.appendChild(PatOS.offlineCard(() => read(b), { body: 'This book needs the internet the first time. After that it works offline.' })); return; }
          try { const base0 = await base(); const r = await fetch(base0 + '/api/books/text?id=' + b.id); const j = await r.json(); if (j.error) throw new Error(j.error); text = j.text; saveText(b.id, text); }
          catch (e) { main.innerHTML = ''; main.appendChild(PatOS.isOffline() ? PatOS.offlineCard(() => read(b)) : h('div', { class: 'bk-msg' }, e.message)); return; }
        }
        const paras = text.replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/_([^_]+)_/g, '$1').trim()).filter(Boolean);
        const entry = lib[b.id] || (lib[b.id] = { title: b.title, author: b.author, page: 0 }); entry.opened = Date.now(); saveLib();
        main.innerHTML = '';
        const page = h('div', { class: 'bk-page' }), cols = h('div', { class: 'bk-cols' });
        const pn = h('span', { class: 'bk-pn' });
        const slider = h('input', { type: 'range', min: 0, value: 0, class: 'bk-slider' });
        const reader = h('div', { class: 'bk-reader bk-' + prefs.theme + ' bk-f-' + prefs.font, style: { '--fs': prefs.size + 'px' } },
          h('div', { class: 'bk-rbar' },
            h('button', { class: 'tbtn', title: 'Library', onclick: home }, '‹'), h('b', {}, b.title),
            h('div', { class: 'bk-rset' },
              h('button', { class: 'tbtn', title: 'Smaller text', onclick: () => setSize(-1) }, 'A−'), h('button', { class: 'tbtn', title: 'Bigger text', onclick: () => setSize(1) }, 'A+'),
              ...['paper', 'sepia', 'night'].map((t) => h('button', { class: 'bk-th bk-th-' + t, title: t, onclick: () => { prefs.theme = t; PatOS.store.set('booksPrefs', prefs); reader.className = 'bk-reader bk-' + t + ' bk-f-' + prefs.font; } })),
              h('button', { class: 'tbtn', title: 'Font', onclick: () => { prefs.font = prefs.font === 'serif' ? 'sans' : 'serif'; PatOS.store.set('booksPrefs', prefs); reader.className = 'bk-reader bk-' + prefs.theme + ' bk-f-' + prefs.font; layout(); } }, 'Aa'))),
          page, h('div', { class: 'bk-foot' }, h('button', { class: 'tbtn', title: 'Previous page', onclick: () => turn(-1) }, '‹'), slider, pn, h('button', { class: 'tbtn', title: 'Next page', onclick: () => turn(1) }, '›')));
        page.appendChild(cols); main.appendChild(reader);
        // the book is laid out in CSS columns; one "page" is one screen width
        const chunk = paras.slice(0, 6000);
        chunk.forEach((p) => cols.appendChild(/^(CHAPTER|CHAPITRE|BOOK|LIVRE|PART|PARTIE|STAVE|[IVXLC]+\.)\b/.test(p) && p.length < 120 ? h('h3', {}, p) : h('p', {}, p)));
        let pages = 1, cur = entry.page || 0;
        function layout() {
          const w = page.clientWidth; if (!w) return;
          cols.style.columnWidth = w + 'px'; cols.style.height = page.clientHeight + 'px';
          pages = Math.max(1, Math.round(cols.scrollWidth / (w + 40)));
          slider.max = pages - 1; cur = Math.min(cur, pages - 1); go();
        }
        function go() { cols.style.transform = 'translateX(' + (-cur * (page.clientWidth + 40)) + 'px)'; pn.textContent = (cur + 1) + ' / ' + pages; slider.value = cur; entry.page = cur; entry.pages = pages; saveLib(); }
        function turn(d) { cur = Math.max(0, Math.min(pages - 1, cur + d)); go(); }
        function setSize(d) { prefs.size = Math.max(13, Math.min(30, prefs.size + d)); PatOS.store.set('booksPrefs', prefs); reader.style.setProperty('--fs', prefs.size + 'px'); const ratio = cur / pages; layout(); cur = Math.round(ratio * pages); go(); }
        slider.oninput = () => { cur = +slider.value; go(); };
        page.onclick = (e) => { const r = page.getBoundingClientRect(); turn(e.clientX - r.left > r.width / 2 ? 1 : -1); };
        let tx = null; page.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true }); page.addEventListener('touchend', (e) => { if (tx == null) return; const d = e.changedTouches[0].clientX - tx; if (Math.abs(d) > 40) turn(d < 0 ? 1 : -1); tx = null; });
        reader.tabIndex = 0; reader.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); turn(1); } if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); turn(-1); } });
        setTimeout(() => { layout(); reader.focus(); }, 30);
        win.on('resize', () => { if (reader.isConnected) { const ratio = cur / pages; layout(); cur = Math.round(ratio * pages); go(); } });
      }
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && q.value.trim()) search(q.value.trim()); });
      bHome.onclick = home;
      home();
    }
  });
})();
