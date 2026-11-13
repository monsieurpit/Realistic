/* PatOS.install — PatOS as a real app on the Chromebook.
   - Install: Chrome's own install prompt (PatOS then opens in its own window, with its own icon in the shelf)
   - Files: once installed, the Files app can open documents with PatOS (Open with › PatOS)
   - Shortcuts: right-click the PatOS icon in the shelf to jump straight to Piles, Docs, Notes or Code Studio */
(function () {
  'use strict';
  const T = (s) => (PatOS.t ? PatOS.t(s) : s);
  let promptEvent = window.__installPrompt || null;
  const listeners = new Set();
  const changed = () => listeners.forEach((fn) => { try { fn(); } catch (e) {} });

  // only app windows count: Chrome's own full screen (F11, or PatOS asking at login) also matches "fullscreen"
  const standalone = () => {
    try { return ['standalone', 'minimal-ui', 'window-controls-overlay'].some((m) => matchMedia('(display-mode: ' + m + ')').matches) || navigator.standalone === true; } catch (e) { return false; }
  };
  const supported = () => /^https?:$/.test(location.protocol) && !PatOS.singleFile && 'serviceWorker' in navigator;

  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptEvent = e; window.__installPrompt = e; changed(); });
  window.addEventListener('appinstalled', () => {
    promptEvent = null; window.__installPrompt = null; PatOS.store.set('appInstalled', true); changed();
    PatOS.notify({ title: T('PatOS is installed'), body: T('Find it in your Launcher. Right-click its shelf icon › Pin to keep it.'), icon: 'about', duration: 9000 });
  });

  async function prompt() {
    const ev = promptEvent; if (!ev) return 'unavailable';
    try { ev.prompt(); const r = await ev.userChoice; promptEvent = null; window.__installPrompt = null; const ok = r && r.outcome === 'accepted'; if (ok) PatOS.store.set('appInstalled', true); changed(); return ok ? 'accepted' : 'dismissed'; } catch (e) { return 'unavailable'; }
  }

  /* ---------- launches: files from the Files app, and shelf shortcuts ---------- */
  const pending = [];
  let ready = false;
  function whenReady(fn) { if (ready) fn(); else pending.push(fn); }
  PatOS.on('wm:ready', () => {
    // wait for the first-time setup to finish before opening anything
    const go = () => { if (document.getElementById('setup')) return setTimeout(go, 500); ready = true; pending.splice(0).forEach((fn) => { try { fn(); } catch (e) {} }); };
    go();
  });

  let lastURL = '', lastAt = 0;
  function handleURL(u) {
    let url; try { url = new URL(u, location.href); } catch (e) { return; }
    const app = url.searchParams.get('app');
    if (!app || !/^[\w-]{1,32}$/.test(app)) return;
    // the page address and Chrome's launch notice can both report the same launch
    if (url.href === lastURL && Date.now() - lastAt < 5000) return; lastURL = url.href; lastAt = Date.now();
    const chat = url.searchParams.get('chat'); const args = app === 'messages' && chat && /^[\w-]{1,200}$/.test(chat) ? { chat } : undefined; // (from a message notification)
    whenReady(() => { if (PatOS.apps[app]) PatOS.launch(app, args); });
  }
  // a message notification clicked while PatOS is open (sw.js)
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', (e) => {
    const o = e.data && e.data.patosOpen; if (!o || o.app !== 'messages') return;
    whenReady(() => { if (PatOS.apps.messages) PatOS.launch('messages', o.chat && /^[\w-]{1,200}$/.test(o.chat) ? { chat: o.chat } : undefined); });
  });
  async function openHandles(handles) {
    if (!handles || !handles.length) return;
    if (!PatOS.device || !PatOS.device.importHandles) return;
    whenReady(async () => {
      const paths = await PatOS.device.importHandles(handles, '/Documents');
      paths.forEach((p, i) => setTimeout(() => PatOS.openFile(p), i * 250));
      if (paths.length > 1) PatOS.notify({ title: T('Files opened'), body: paths.length + ' ' + T('files are in Documents. Saving in PatOS saves the real files too.'), icon: 'finder' });
    });
  }
  handleURL(location.href);
  if ('launchQueue' in window && window.launchQueue && window.launchQueue.setConsumer) {
    window.launchQueue.setConsumer((params) => {
      if (params.targetURL) handleURL(params.targetURL);
      if (params.files && params.files.length) openHandles(params.files);
    });
  }
  // tidy the address so a reload doesn't reopen the same thing
  try { if (/[?&](app|open|source)=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}

  /* ---------- a friendly offer, once, after PatOS has been used a little ---------- */
  const sessions = (PatOS.store.get('sessions', 0) || 0) + 1; PatOS.store.set('sessions', sessions);
  whenReady(() => setTimeout(() => {
    if (standalone() || PatOS.isMobile || PatOS.store.get('installOffered', false) || sessions < 2) return;
    if (!promptEvent) return;
    PatOS.store.set('installOffered', true);
    PatOS.notify({ title: T('Install PatOS as an app'), body: T('Install it to get its own window and an icon in your shelf. Click here.'), icon: 'about', duration: 12000, onClick: () => prompt() });
  }, 6000));

  PatOS.install = {
    standalone, supported, prompt,
    canPrompt: () => !!promptEvent,
    fileHandling: () => 'launchQueue' in window,
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    address: () => location.origin + location.pathname
  };
})();
