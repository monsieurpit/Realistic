/* Videos — plays your own video files (from Finder or imported from your device) */
(function () {
  'use strict';
  const { h } = PatOS;
  const isVideo = (name) => /\.(mp4|webm|mov|m4v|ogv)$/i.test(name);
  PatOS.registerApp({
    id: 'videos', name: 'Videos', icon: 'videos', width: 940, height: 620, category: 'Apps', keywords: 'movie player mp4 film tv',
    about: 'Watch your own video files.',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      const bImport = h('button', { class: 'btn' }, PatOS.t('Open a video…'));
      win.toolbar.append(bImport, h('div', { style: { flex: 1 } }));
      win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px';
      const main = h('div', { class: 'vd-main' }); win.body.appendChild(main);
      const session = []; // videos opened from the device this session (object URLs)
      function library() {
        const out = [];
        try { PatOS.fs.walk('/', (path, n) => { if (n.type !== 'dir' && isVideo(path)) out.push({ name: path.split('/').pop(), src: n.content, path }); }); } catch (e) {}
        return out.concat(session);
      }
      function home() {
        win.setTitle(PatOS.t('Videos')); main.innerHTML = '';
        const vids = library();
        if (!vids.length) {
          main.appendChild(h('div', { class: 'vd-empty' }, h('div', { class: 'vd-big', html: PatOS.iconHTML('videos') }), h('h2', {}, PatOS.t('No videos yet')), h('p', {}, PatOS.t('Open an MP4 or WebM video from your computer or phone. Videos you put in Finder show up here too.')), h('button', { class: 'btn primary', onclick: pick }, PatOS.t('Open a video…'))));
          return;
        }
        const g = h('div', { class: 'vd-grid' });
        vids.forEach((v) => {
          const vid = h('video', { src: v.src, preload: 'metadata', muted: true });
          vid.addEventListener('loadedmetadata', () => { try { vid.currentTime = Math.min(2, vid.duration / 3); } catch (e) {} const d = vid.duration; if (isFinite(d)) c.querySelector('.vd-dur').textContent = Math.floor(d / 60) + ':' + String(Math.floor(d % 60)).padStart(2, '0'); });
          const c = h('div', { class: 'vd-card' }, h('div', { class: 'vd-th' }, vid, h('span', { class: 'vd-dur' })), h('b', {}, v.name));
          c.onclick = () => play(v); g.appendChild(c);
        });
        main.appendChild(g);
      }
      function play(v) {
        win.setTitle(v.name); main.innerHTML = '';
        const vid = h('video', { src: v.src, controls: true, autoplay: true, playsinline: true, class: 'vd-player' });
        const speed = h('select', { class: 'field' }, ...[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => h('option', { value: s }, s + '×'))); speed.value = '1';
        speed.onchange = () => { vid.playbackRate = +speed.value; };
        const bPip = h('button', { class: 'btn' }, PatOS.t('Picture in Picture')); bPip.onclick = () => { if (document.pictureInPictureEnabled) vid.requestPictureInPicture().catch(() => {}); };
        main.append(h('div', { class: 'vd-stage' }, vid), h('div', { class: 'vd-bar' }, h('button', { class: 'btn', onclick: home }, '‹ ' + PatOS.t('All videos')), h('b', {}, v.name), h('div', { style: { flex: 1 } }), h('span', { class: 'vd-l' }, PatOS.t('Speed')), speed, document.pictureInPictureEnabled ? bPip : null));
      }
      function pick() {
        const inp = h('input', { type: 'file', accept: 'video/*', multiple: true, style: { display: 'none' } });
        inp.onchange = () => { const files = [...inp.files]; files.forEach((f) => session.unshift({ name: f.name, src: URL.createObjectURL(f) })); inp.remove(); if (files.length === 1) play(session[0]); else home(); };
        document.body.appendChild(inp); inp.click();
      }
      bImport.onclick = pick;
      win._open = (a) => { if (a && a.path) { const n = PatOS.fs.get(a.path); if (n) play({ name: a.path.split('/').pop(), src: n.content, path: a.path }); } };
      if (args && args.path) win._open(args); else home();
    },
    onArgs(win, a) { win._open && win._open(a); }
  });
})();
