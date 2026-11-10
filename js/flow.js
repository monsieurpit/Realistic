/* Flow: the motion that ties PatOS together (with css/signature.css).
   - Arrival: after you log in, the wallpaper settles, the menu bar drops in, the Dock rises and the desktop fades up in order.
   - Light and dark: switching (from Control Center, Settings or Spotlight) is a circle that grows from where you clicked;
     a new accent color cross-fades.
   - Segmented controls: the selection glides to the tab you pick instead of jumping.
   - Launchpad: apps arrive in a wave that starts from the middle.
   Everything respects Reduce Motion (Settings › Accessibility) and Speed mode, and nothing here changes how things look at rest. */
(function () {
  'use strict';
  const root = document.documentElement;
  const calm = () => root.classList.contains('reduce-motion') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || PatOS.settings.perfMode === 'light';
  const spring = () => (PatOS.motion && PatOS.motion.get ? PatOS.motion.get() : { dur: 520, easing: 'cubic-bezier(.2,.95,.25,1.08)' });

  /* ---------- where the pointer last went down (the circle grows from there) ---------- */
  let px = innerWidth / 2, py = innerHeight / 2;
  document.addEventListener('pointerdown', (e) => { px = e.clientX; py = e.clientY; }, true);

  /* ---------- light / dark and accent: a view transition ---------- */
  const VT_KEYS = { theme: 'circle', accent: 'fade' };
  const rawSet = PatOS.setSetting;
  PatOS.setSetting = function (key, value) {
    const kind = VT_KEYS[key];
    // only for a change the person just made (a click or a key), so scripts and tests keep the instant, in-order behavior
    const gesture = navigator.userActivation ? navigator.userActivation.isActive : false;
    if (!kind || !document.startViewTransition || calm() || !gesture || PatOS.settings[key] === value || document.hidden) return rawSet.call(PatOS, key, value);
    // the value is saved right away (code that reads it next sees the new one); what it changes on screen happens inside the transition
    PatOS.settings[key] = value; PatOS.store.set('settings', PatOS.settings);
    if (kind === 'fade') root.classList.add('vt-fade');
    let vt;
    try { vt = document.startViewTransition(() => { PatOS.emit('setting', { key, value }); PatOS.emit('setting:' + key, value); }); }
    catch (e) { root.classList.remove('vt-fade'); PatOS.emit('setting', { key, value }); PatOS.emit('setting:' + key, value); return; }
    if (kind === 'circle') {
      vt.ready.then(() => {
        const r = Math.hypot(Math.max(px, innerWidth - px), Math.max(py, innerHeight - py));
        root.animate({ clipPath: [`circle(0px at ${px}px ${py}px)`, `circle(${r}px at ${px}px ${py}px)`] }, { duration: 620, easing: 'cubic-bezier(.3,.7,.2,1)', pseudoElement: '::view-transition-new(root)' });
      }).catch(() => {});
    }
    vt.finished.finally(() => root.classList.remove('vt-fade'));
  };

  /* ---------- arrival after login ---------- */
  function arrive() {
    if (calm()) return;
    const sp = spring();
    const anim = (sel, frames, delay, dur) => document.querySelectorAll(sel).forEach((el, i) => {
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
      try { el.animate(frames, { duration: dur || sp.dur, delay: delay + i * 45, easing: sp.easing, fill: 'backwards' }); } catch (e) {}
    });
    anim('#wallpaper, #wallpaper3d', [{ scale: '1.06', opacity: .4 }, { scale: '1', opacity: 1 }], 0, 1000);
    anim('#menubar', [{ translate: '0 -100%', opacity: 0 }, { translate: '0 0', opacity: 1 }], 160);
    anim('#dock-wrap', [{ translate: '0 130%', opacity: 0 }, { translate: '0 0', opacity: 1 }], 220);
    anim('#desk-widgets .widget, #desk-widgets > *', [{ translate: '0 18px', scale: '.96', opacity: 0 }, { translate: '0 0', scale: '1', opacity: 1 }], 320);
    anim('.desk-icon', [{ translate: '0 12px', opacity: 0 }, { translate: '0 0', opacity: 1 }], 380, 420);
  }
  const lock = document.getElementById('lock');
  if (lock && window.MutationObserver) {
    new MutationObserver(() => { if (lock.classList.contains('unlocking') && !lock._arrived) { lock._arrived = true; arrive(); } else if (!lock.classList.contains('unlocking')) lock._arrived = false; })
      .observe(lock, { attributes: true, attributeFilter: ['class'] });
  }

  /* ---------- segmented controls: the selection glides ---------- */
  // FLIP: remember where the selected tab was, let the app re-render, then slide a copy of its highlight to the new one
  document.addEventListener('pointerdown', (e) => {
    if (calm()) return;
    const tab = e.target.closest && e.target.closest('.seg .tab'); if (!tab) return;
    const seg = tab.parentElement, from = seg.querySelector('.tab.on'); if (!from || from === tab) return;
    const fr = from.getBoundingClientRect(), sr0 = seg.getBoundingClientRect();
    const look = getComputedStyle(from);
    const start = { x: fr.left - sr0.left, y: fr.top - sr0.top, w: fr.width, h: fr.height, bg: look.backgroundColor, bgi: look.backgroundImage, sh: look.boxShadow, br: look.borderRadius };
    setTimeout(() => requestAnimationFrame(() => {
      if (!seg.isConnected) return;
      const to = seg.querySelector('.tab.on'); if (!to) return;
      const tr = to.getBoundingClientRect(), sr = seg.getBoundingClientRect();
      if (Math.abs(tr.left - sr.left - start.x) < 2) return;
      const g = document.createElement('div'); g.className = 'seg-glide';
      Object.assign(g.style, { left: '0px', top: '0px', width: start.w + 'px', height: start.h + 'px', background: start.bg, backgroundImage: start.bgi, boxShadow: start.sh, borderRadius: start.br });
      seg.insertBefore(g, seg.firstChild);
      const keep = { bg: to.style.background, sh: to.style.boxShadow };
      to.style.setProperty('background', 'transparent', 'important'); to.style.setProperty('box-shadow', 'none', 'important');
      const sp = spring();
      const a = g.animate([
        { transform: `translate(${start.x}px, ${start.y}px)`, width: start.w + 'px', height: start.h + 'px' },
        { transform: `translate(${tr.left - sr.left}px, ${tr.top - sr.top}px)`, width: tr.width + 'px', height: tr.height + 'px' }
      ], { duration: Math.min(420, sp.dur * .75), easing: sp.easing, fill: 'forwards' });
      const done = () => { g.remove(); to.style.background = keep.bg; to.style.boxShadow = keep.sh; };
      a.onfinish = done; a.oncancel = done;
    }), 0);
  }, true);

  /* ---------- Launchpad: a wave from the middle ---------- */
  if (PatOS.launchpad) {
    const show = PatOS.launchpad.show.bind(PatOS.launchpad);
    PatOS.launchpad.show = function () {
      show();
      if (calm()) return;
      const lp = document.getElementById('launchpad'); if (!lp) return;
      const items = [...lp.querySelectorAll('.lp-item')].slice(0, 80);
      const cx = innerWidth / 2, cy = innerHeight / 2.4;
      items.forEach((it) => { const r = it.getBoundingClientRect(); it.style.setProperty('--w', Math.round(Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy) * .45)); });
      lp.classList.remove('lp-enter'); void lp.offsetWidth; lp.classList.add('lp-enter');
      clearTimeout(lp._wave); lp._wave = setTimeout(() => lp.classList.remove('lp-enter'), 1200);
    };
  }

  /* ---------- for apps: let a freshly shown page settle in ---------- */
  PatOS.paneIn = (el) => { if (!el || calm()) return; el.classList.remove('pane-in'); void el.offsetWidth; el.classList.add('pane-in'); setTimeout(() => el.classList.remove('pane-in'), 600); };
})();
