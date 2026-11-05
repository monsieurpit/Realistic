/* Photo Booth — camera with effects */
(function () {
  'use strict';
  const { h } = PatOS;
  const FX = [['Normal', 'none'], ['Sepia', 'sepia(1)'], ['B&W', 'grayscale(1) contrast(1.2)'], ['Thermal', 'hue-rotate(180deg) saturate(3) contrast(1.4)'], ['Comic', 'contrast(2) saturate(2)'], ['Invert', 'invert(1)'], ['Dream', 'blur(2px) saturate(1.8) brightness(1.1)'], ['Neon', 'hue-rotate(90deg) saturate(4)'], ['Vintage', 'sepia(.6) contrast(1.1) brightness(.9) saturate(1.4)']];
  PatOS.registerApp({
    id: 'photobooth', name: 'Photo Booth', icon: 'photobooth', width: 760, height: 600, dark: true, keywords: 'camera selfie webcam',
    launch(win) {
      let stream = null, fx = 0, mirror = true;
      const video = h('video', { autoplay: true, playsinline: true, muted: true, class: 'pb-video' });
      const flash = h('div', { class: 'pb-flash' });
      const count = h('div', { class: 'pb-count' });
      const msg = h('div', { class: 'pb-msg' }, 'Starting camera…');
      const stage = h('div', { class: 'pb-stage' }, video, msg, count, flash);
      const strip = h('div', { class: 'pb-strip' });
      const shoot = h('button', { class: 'pb-shoot', title: 'Take photo' });
      const fxBar = h('div', { class: 'pb-fx' });
      FX.forEach(([n], i) => fxBar.appendChild(h('button', { class: 'btn', onclick: () => { fx = i; sync(); } }, n)));
      const bMirror = h('button', { class: 'btn', onclick: () => { mirror = !mirror; sync(); } }, '⇋ Mirror');
      win.body.append(stage, h('div', { class: 'pb-ctl' }, fxBar, shoot, bMirror), strip);
      function sync() { video.style.filter = FX[fx][1]; video.style.transform = mirror ? 'scaleX(-1)' : ''; [...fxBar.children].forEach((b, i) => b.classList.toggle('primary', i === fx)); }
      async function start() {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
          video.srcObject = stream; msg.remove();
        } catch (e) { msg.innerHTML = PatOS.sym('camera', 'big') + '<br>' + PatOS.t('The camera isn’t available.') + '<br><small>' + PatOS.t('Allow camera access in your browser settings. On a school Chromebook it may be turned off.') + '</small>'; }
      }
      shoot.onclick = async () => {
        if (!stream) return;
        for (let i = 3; i > 0; i--) { count.textContent = i; PatOS.sound.tone(660, 0.1, { vol: 0.1 }); await new Promise((r) => setTimeout(r, 700)); }
        count.textContent = '';
        flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
        PatOS.sound.tone(2000, 0.08, { vol: 0.15, type: 'square' });
        const c = document.createElement('canvas'); c.width = video.videoWidth / 2; c.height = video.videoHeight / 2;
        const x = c.getContext('2d'); x.filter = FX[fx][1];
        if (mirror) { x.translate(c.width, 0); x.scale(-1, 1); }
        x.drawImage(video, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/jpeg', 0.82);
        const nm = PatOS.fs.uniqueName('/Pictures', 'Photo Booth ' + new Date().toLocaleString().replace(/[\/:]/g, '-') + '.jpg');
        PatOS.fs.write('/Pictures/' + nm, url);
        strip.prepend(h('img', { src: url, title: nm, onclick: () => PatOS.launch('photos', { path: '/Pictures/' + nm }) }));
      };
      win.on('closed', () => stream && stream.getTracks().forEach((t) => t.stop()));
      sync(); start();
    }
  });
})();
