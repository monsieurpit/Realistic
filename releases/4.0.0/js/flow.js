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
      // Liquid Glass: the selection is a drop of glass. It stretches toward the tab you picked (its front leaves first),
      // lifts a little while it travels (a touch bigger and brighter, like glass picked up), then its back catches up
      const ex = tr.left - sr.left, ey = tr.top - sr.top, x0 = Math.min(start.x, ex), span = Math.max(start.x + start.w, ex + tr.width) - x0;
      const a = g.animate([
        { transform: `translate(${start.x}px, ${start.y}px)`, width: start.w + 'px', height: start.h + 'px', filter: 'brightness(1)', offset: 0 },
        { transform: `translate(${x0}px, ${(start.y + ey) / 2}px) scaleY(1.08)`, width: span + 'px', height: start.h + 'px', filter: 'brightness(1.12)', offset: 0.45 },
        { transform: `translate(${ex}px, ${ey}px)`, width: tr.width + 'px', height: tr.height + 'px', filter: 'brightness(1)', offset: 1 }
      ], { duration: Math.min(480, Math.max(340, sp.dur * .8)), easing: 'cubic-bezier(.3,.7,.25,1)', fill: 'forwards' });
      const done = () => { g.remove(); to.style.background = keep.bg; to.style.boxShadow = keep.sh; };
      a.onfinish = done; a.oncancel = done;
    }), 0);
  }, true);

  /* ---------- interactive glass: a touch lights it up from where you press ----------
     Like Apple's interactive Liquid Glass: light spreads through the glass from the finger or pointer, holds while you press,
     and fades after you let go (css/glass.css, --g-touch). It only adds light: the glass stays exactly as clear. */
  const LIT = '.cc-tile, #desk-widgets .widget, .mw, .toast:not(.static), .seg, .lg, .nc-list, .dlg, #dock, .mh-dock, .lp-search';
  document.addEventListener('pointerdown', (e) => {
    if (calm() || e.button > 0 || !document.documentElement.classList.contains('lg-on') || document.documentElement.classList.contains('reduce-transparency')) return;
    const el = e.target.closest && e.target.closest(LIT); if (!el || !el.animate) return;
    const r = el.getBoundingClientRect(); if (!r.width) return;
    el.style.setProperty('--g-tx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
    el.style.setProperty('--g-ty', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    if (el._lit) el._lit.cancel();
    const on = el._lit = el.animate([{ '--g-touch': 0 }, { '--g-touch': 1 }], { duration: 160, easing: 'ease-out', fill: 'forwards' });
    const off = () => {
      removeEventListener('pointerup', off, true); removeEventListener('pointercancel', off, true);
      if (el._lit !== on) return;
      const out = el._lit = el.animate([{ '--g-touch': 1 }, { '--g-touch': 0 }], { duration: 520, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'forwards' });
      on.cancel(); out.onfinish = () => { if (el._lit === out) { out.cancel(); el._lit = null; } };
    };
    addEventListener('pointerup', off, true); addEventListener('pointercancel', off, true);
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
      // (every place read first, then every delay written: reading after each write made the browser lay out Launchpad again
      //  for each icon, most of the time it took to open on a slow computer)
      const rs = items.map((it) => it.getBoundingClientRect());
      items.forEach((it, i) => { const r = rs[i]; it.style.setProperty('--w', Math.round(Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy) * .45)); });
      lp.classList.remove('lp-enter'); void lp.offsetWidth; lp.classList.add('lp-enter');
      clearTimeout(lp._wave); lp._wave = setTimeout(() => lp.classList.remove('lp-enter'), 1200);
    };
  }

  /* ---------- for apps: let a freshly shown page settle in ---------- */
  PatOS.paneIn = (el) => { if (!el || calm()) return; el.classList.remove('pane-in'); void el.offsetWidth; el.classList.add('pane-in'); setTimeout(() => el.classList.remove('pane-in'), 600); };
})();
