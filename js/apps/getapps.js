/* Phone & web apps: install Snapchat, Instagram, TikTok and more.
   Opening one does the right thing for the device you're on:
   - iPhone / iPad: opens the real app, or the App Store page if it isn't installed
   - Android (Samsung, Pixel and others): opens the real app, or its Google Play page
   - Computer (Chromebook, Windows, Mac): opens the app's website, inside PatOS when the
     site allows it, otherwise in its own app window */
(function () {
  'use strict';
  const { h } = PatOS;
  // id, name, App Store id, URL scheme, Android package, website, category, icon, website can show inside PatOS
  const CATALOG = [
    ["snapchat", "Snapchat", 447188370, "snapchat", "com.snapchat.android", "https://www.snapchat.com/web", "Social", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/bf/73/37/bf7337b7-c382-5539-1180-d282ae58119c/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/256x256bb.jpg", 0],
    ["instagram", "Instagram", 389801252, "instagram", "com.instagram.android", "https://www.instagram.com/", "Social", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/65/b4/b1/65b4b1e1-9891-0b84-4d9a-6370410bfbf4/Prod-0-0-1x_U007epad-0-1-0-sRGB-85-220.png/256x256bb.jpg", 0],
    ["tiktok", "TikTok", 835599320, "snssdk1233", "com.zhiliaoapp.musically", "https://www.tiktok.com/", "Social", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/4b/af/40/4baf40d2-5fec-a1fe-da33-cafd0c87f18b/TikTok_AppIcon26-0-0-1x_U007epad-0-1-0-85-220.png/256x256bb.jpg", 0],
    ["whatsapp", "WhatsApp", 310633997, "whatsapp", "com.whatsapp", "https://web.whatsapp.com/", "Chat", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/15/eb/39/15eb3965-bec3-4737-950a-9d9df5303e93/AppIcon-0-0-1x_U007epad-0-0-0-1-0-0-sRGB-0-85-220.png/256x256bb.jpg", 0],
    ["spotify", "Spotify", 324684580, "spotify", "com.spotify.music", "https://open.spotify.com/", "Music", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/8b/f2/6a/8bf26ab9-3ced-cb5c-a2b3-19f65e7f5cc6/AppIcon-0-0-1x_U007epad-0-1-0-0-85-220.png/256x256bb.jpg", 0],
    ["discord", "Discord", 985746746, "discord", "com.discord", "https://discord.com/app", "Chat", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/65/9c/e0/659ce065-5dd8-eb35-378f-217d9658f6d9/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/256x256bb.jpg", 0],
    ["netflix", "Netflix", 363590051, "nflx", "com.netflix.mediaclient", "https://www.netflix.com/", "Video", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/73/dd/0e/73dd0eae-8fc8-94cc-da59-2512616c784f/AppIcon-0-0-1x_U007epad-0-1-0-sRGB-0-85-220.png/256x256bb.jpg", 0],
    ["x", "X", 333903271, "twitter", "com.twitter.android", "https://x.com/", "Social", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/e3/b3/93/e3b393f1-101b-5e94-d31e-38f6ddabce76/ProductionAppIcon-0-0-1x_U007emarketing-0-8-0-0-0-85-220.png/256x256bb.jpg", 0],
    ["facebook", "Facebook", 284882215, "fb", "com.facebook.katana", "https://www.facebook.com/", "Social", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/77/5b/7b/775b7b40-4e22-ba5e-2255-668c2473048c/Icon-Production-0-0-1x_U007epad-0-1-0-sRGB-85-220.png/256x256bb.jpg", 0],
    ["messenger", "Messenger", 454638411, "fb-messenger", "com.facebook.orca", "https://www.messenger.com/", "Chat", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/49/bf/d5/49bfd562-f165-a59c-c82d-49d20cd98931/AppIcon-0-0-1x_U007epad-0-1-0-sRGB-85-220.png/256x256bb.jpg", 0],
    ["pinterest", "Pinterest", 429047995, "pinterest", "com.pinterest", "https://www.pinterest.com/", "Social", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/f0/8e/3d/f08e3d30-65df-7233-d2e5-a9cb133c6af1/AppIcon-0-0-1x_U007epad-0-1-0-0-0-85-220.png/256x256bb.jpg", 0],
    ["reddit", "Reddit", 1064216828, "reddit", "com.reddit.frontpage", "https://www.reddit.com/", "Social", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/a1/74/9d/a1749d85-1061-a0ac-0731-6ea329d668cf/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/256x256bb.jpg", 0],
    ["roblox", "Roblox", 431946152, "roblox", "com.roblox.client", "https://www.roblox.com/", "Games", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/c4/73/78/c4737895-ef0a-5de8-35b0-67b9bd2f55d8/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/256x256bb.jpg", 0],
    ["minecraft", "Minecraft", 479516143, "minecraft", "com.mojang.minecraftpe", "https://www.minecraft.net/", "Games", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/72/09/34/720934b1-4519-6661-cc9c-075075d54a38/AppIcon-0-0-1x_U007emarketing-0-10-0-85-220.png/256x256bb.jpg", 0],
    ["duolingo", "Duolingo", 570060128, "duolingo", "com.duolingo", "https://www.duolingo.com/", "School", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/8d/11/e8/8d11e8e6-8040-7512-d03e-ea56124d3eef/AppIcon-0-0-1x_U007epad-0-1-85-220.png/256x256bb.jpg", 0],
    ["twitch", "Twitch", 460177396, "twitch", "tv.twitch.android.app", "https://www.twitch.tv/", "Video", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/d5/af/88/d5af88c1-ef7a-2d28-90c0-1f3335b21efe/TwitchAppIcon-0-0-1x_U007epad-0-1-0-0-sRGB-0-0-0-85-220.png/256x256bb.jpg", 0],
    ["telegram", "Telegram", 686449807, "tg", "org.telegram.messenger", "https://web.telegram.org/", "Chat", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/ce/41/d8/ce41d807-350e-69f1-f31e-16be42b6ebfb/Telegram-0-0-1x_U007epad-0-1-0-85-220.png/256x256bb.jpg", 0],
    ["gmail", "Gmail", 422689480, "googlegmail", "com.google.android.gm", "https://mail.google.com/", "Productivity", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/83/a9/eb/83a9eb0a-ab2b-da1f-41a9-8357822787a8/gmail_2026_ios-0-0-1x_U007epad-0-0-0-1-0-0-0-0-85-220.png/256x256bb.jpg", 0],
    ["gmaps", "Google Maps", 585027354, "comgooglemaps", "com.google.android.apps.maps", "https://www.google.com/maps", "Travel", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/f8/76/ce/f876ce27-b7c2-e674-5c9d-8d0fcb041673/maps_2025-0-0-1x_U007epad-0-0-0-1-0-0-sRGB-0-0-85-220.png/256x256bb.jpg", 0],
    ["threads", "Threads", 6446901002, "barcelona", "com.instagram.barcelona", "https://www.threads.net/", "Social", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/41/ae/77/41ae77b4-ea15-2bbf-dc7d-3b67e887209e/Prod-0-0-1x_U007ephone-0-0-0-1-0-0-sRGB-85-220.png/256x256bb.jpg", 0],
    ["bereal", "BeReal", 1459645446, "bereal", "com.bereal.ft", "https://bere.al/", "Social", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/84/c4/21/84c421ef-2540-bf4b-7d69-d239181d02f0/AppIcon-0-0-1x_U007emarketing-0-6-0-85-220.png/256x256bb.jpg", 1],
    ["shazam", "Shazam", 284993459, "shazam", "com.shazam.android", "https://www.shazam.com/", "Music", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/a6/e3/8a/a6e38a72-31d3-fa19-8733-d71f38edcf62/AppIcon-0-0-1x_U007epad-0-1-85-220.png/256x256bb.jpg", 0],
    ["disneyplus", "Disney+", 1446075923, "disneyplus", "com.disney.disneyplus", "https://www.disneyplus.com/", "Video", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/3f/7f/cb/3f7fcb64-82d5-7f5d-e453-6532b9e497d4/AppIcon-0-0-1x_U007emarketing-0-8-0-0-0-85-220.png/256x256bb.jpg", 1],
    ["primevideo", "Prime Video", 545519333, "aiv", "com.amazon.avod.thirdpartyclient", "https://www.primevideo.com/", "Video", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/8d/b6/ab/8db6ab2a-de8d-c581-d1be-6f408bf4d921/AppIcon-0-0-1x_U007epad-0-1-0-0-85-220.png/256x256bb.jpg", 0],
    ["zoom", "Zoom", 546505307, "zoomus", "us.zoom.videomeetings", "https://app.zoom.us/wc", "Productivity", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/fc/d0/96/fcd09664-56c3-f856-4311-da9dcbae1fd2/AppIcon-0-0-1x_U007epad-0-1-0-0-85-220.png/256x256bb.jpg", 0],
    ["teams", "Microsoft Teams", 1113153706, "msteams", "com.microsoft.teams", "https://teams.microsoft.com/", "Productivity", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/48/42/d4/4842d4b9-5d20-be03-d72d-6e81c1035773/AppIcon-0-0-1x_U007epad-0-1-0-0-85-220.png/256x256bb.jpg", 0],
    ["canva", "Canva", 897446215, "canva", "com.canva.editor", "https://www.canva.com/", "Productivity", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/3f/a0/78/3fa078f4-ab6d-c5b7-ac83-873fc19a4685/AppIcon-0-0-1x_U007epad-0-11-0-85-220.png/256x256bb.jpg", 0],
    ["quizlet", "Quizlet", 546473125, "quizlet", "com.quizlet.quizletandroid", "https://quizlet.com/", "School", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/89/63/1a/89631ab3-341a-541e-f7d9-cb8fdff31b60/AppIcon-production-0-0-1x_U007emarketing-0-8-0-85-220.png/256x256bb.jpg", 0],
    ["kahoot", "Kahoot!", 1131203560, "kahoot", "no.mobitroll.kahoot.android", "https://kahoot.it/", "School", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/06/5c/1f/065c1f2b-fef6-5fcd-f111-c90bbb9e4f65/AppIcon-0-0-1x_U007epad-0-1-0-0-sRGB-85-220.png/256x256bb.jpg", 1],
    ["chatgpt", "ChatGPT", 6448311069, "chatgpt", "com.openai.chatgpt", "https://chatgpt.com/", "Productivity", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/72/2d/27/722d272a-9d6f-d186-8a92-6a884107df8f/AppIcon-0-0-1x_U007epad-0-0-0-1-0-85-220.png/256x256bb.jpg", 0],
    ["claude", "Claude", 6473753684, "claude", "com.anthropic.claude", "https://claude.ai/", "Productivity", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/d7/d6/f1/d7d6f168-f3ce-ee3c-e8fd-0563019400d4/AppIcon-0-0-1x_U007epad-0-1-85-220.png/256x256bb.jpg", 0],
    ["brawlstars", "Brawl Stars", 1229016807, "brawlstars", "com.supercell.brawlstars", "https://supercell.com/en/games/brawlstars/", "Games", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/27/98/dd/2798dd4e-f772-d93b-0a82-588d3fb55302/AppIcon-0-0-1x_U007epad-0-1-85-220.png/256x256bb.jpg", 1],
    ["clashroyale", "Clash Royale", 1053012308, "clashroyale", "com.supercell.clashroyale", "https://supercell.com/en/games/clashroyale/", "Games", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/82/9e/a7/829ea73c-c333-1953-f5fb-c16ea2ed80e3/AppIcon-0-0-1x_U007emarketing-0-7-0-85-220.png/256x256bb.jpg", 1],
    ["capcut", "CapCut", 1500855883, "capcut", "com.lemon.lvoverseas", "https://www.capcut.com/", "Video", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/31/d8/5b/31d85b5d-7785-5789-df84-1b052afd2e43/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/256x256bb.jpg", 0],
    ["soundcloud", "SoundCloud", 336353151, "soundcloud", "com.soundcloud.android", "https://soundcloud.com/", "Music", "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/1b/03/50/1b035022-a482-798c-e754-798b78331c9b/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/256x256bb.jpg", 0],
    ["waze", "Waze", 323229106, "waze", "com.waze", "https://www.waze.com/live-map", "Travel", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/a9/b3/57/a9b35786-b96f-9fe4-3cc5-6bce1b9a7e40/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/256x256bb.jpg", 0],
    ["ytofficial", "YouTube (official app)", 544007664, "youtube", "com.google.android.youtube", "https://www.youtube.com/", "Video", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/82/43/be/8243be7f-17c3-33ae-720a-ffcde48bed61/logo_youtube_2024_q4_color-0-0-1x_U007emarketing-0-0-0-7-0-0-0-85-220.png/256x256bb.jpg", 0]
  ];

  const ua = navigator.userAgent || '';
  function device() {
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(ua);
    if (ios) return { kind: 'ios', name: /iPad|Macintosh/.test(ua) ? 'iPad' : 'iPhone', store: 'App Store' };
    if (android) {
      const samsung = /SamsungBrowser|SM-[A-Z0-9]+|Samsung/i.test(ua);
      const m = ua.match(/Android[^;]*;\s*([^;)]+?)(?:\s+Build|\))/);
      return { kind: 'android', name: samsung ? 'Samsung Galaxy' : (m && !/^K$|wv/.test(m[1]) ? m[1].trim() : 'Android phone'), store: 'Google Play' };
    }
    return { kind: 'computer', name: /CrOS/.test(ua) ? 'Chromebook' : /Windows/.test(ua) ? 'Windows PC' : /Mac/.test(ua) ? 'Mac' : 'computer', store: '' };
  }
  const installed = new Set(PatOS.store.get('extInstalled', []));
  const saveInstalled = () => PatOS.store.set('extInstalled', [...installed]);
  const byId = {};
  const refresh = () => PatOS.setSetting('hiddenApps', (PatOS.settings.hiddenApps || []).slice()); // redraws Home Screen / Launchpad
  const popups = {};

  /* ---------- opening ---------- */
  /* If the app opens, this page goes to the background. If it is still showing a moment later, the app
     isn't installed, so go to its store page. Timers are paused while the page is in the background,
     so a late timer means the app did open. */
  const go = (u) => { if (PatOS.extApps && PatOS.extApps._nav) PatOS.extApps._nav(u); else window.location.href = u; };
  function tryThenStore(target, store, wait) {
    let left = false; const t0 = Date.now();
    const mark = () => { if (document.hidden) left = true; };
    document.addEventListener('visibilitychange', mark); window.addEventListener('pagehide', mark);
    try { go(target); } catch (e) {}
    setTimeout(() => {
      document.removeEventListener('visibilitychange', mark); window.removeEventListener('pagehide', mark);
      if (!left && !document.hidden && Date.now() - t0 < wait + 1500) go(store);
    }, wait);
  }
  function openOnIOS(c) { tryThenStore(c.scheme + '://', 'itms-apps://apps.apple.com/app/id' + c.appStore, 2500); }
  function openOnAndroid(c) {
    const play = 'https://play.google.com/store/apps/details?id=' + c.pkg;
    // Android opens the app if it's installed; if not, the browser follows the fallback to Google Play
    const intent = 'intent://open#Intent;scheme=' + c.scheme + ';package=' + c.pkg + ';S.browser_fallback_url=' + encodeURIComponent(play) + ';end';
    tryThenStore(intent, 'market://details?id=' + c.pkg, 3000);
  }
  function openOnComputer(c, forceWindow) {
    if (c.frame && !forceWindow && !PatOS.sandboxed) return PatOS.launch('extweb', { app: c.id });
    const w = Math.min(1200, screen.availWidth - 80), hh = Math.min(820, screen.availHeight - 80);
    const left = Math.max(0, (screen.availWidth - w) / 2), top = Math.max(0, (screen.availHeight - hh) / 2);
    let win = popups[c.id];
    if (win && !win.closed) { try { win.focus(); return; } catch (e) {} }
    try { win = window.open(c.web, 'patos_' + c.id, `popup=yes,width=${w},height=${hh},left=${left},top=${top}`); } catch (e) { win = null; }
    if (win) { popups[c.id] = win; PatOS.notify({ title: c.name, body: PatOS.t('Opened in its own window.'), icon: 'x-' + c.id }); }
    else PatOS.launch('extweb', { app: c.id, blocked: true });
  }
  function open(id, opts) {
    const c = byId[id]; if (!c) return;
    const d = device();
    PatOS.emit('app:launch', 'x-' + id);
    if (d.kind === 'ios') return openOnIOS(c);
    if (d.kind === 'android') return openOnAndroid(c);
    return openOnComputer(c, opts && opts.window);
  }

  /* ---------- registry ---------- */
  CATALOG.forEach(([id, name, appStore, scheme, pkg, web, cat, art, frame]) => {
    const c = { id, name, appStore, scheme, pkg, web, cat, art, frame: !!frame };
    byId[id] = c;
    const fav = 'https://www.google.com/s2/favicons?sz=128&domain=' + new URL(web).hostname;
    PatOS.iconDefs['x-' + id] = { bg: '#fff', svg: () => `<img class="ext-ic" src="${art || fav}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${fav}'">` };
    PatOS.registerApp({ id: 'x-' + id, name, icon: 'x-' + id, category: 'Apps', keywords: (name + ' ' + cat + ' phone app').toLowerCase(), hidden: !installed.has(id), external: c, about: cat, action: () => open(id) });
  });

  /* window used on computers for sites that can show inside PatOS (or when a popup was blocked) */
  PatOS.registerApp({
    id: 'extweb', name: 'Web App', icon: 'browser', hidden: true, single: false, width: 1100, height: 720, category: 'Apps',
    launch(win, args) {
      const c = byId[args && args.app]; if (!c) return win.close();
      win.setTitle(c.name);
      win.el.classList.add('has-toolbar');
      const bReload = h('button', { class: 'tbtn', title: 'Reload' }, '↻');
      const bOwn = h('button', { class: 'btn' }, PatOS.t('Open in its own window'));
      win.toolbar.append(h('span', { class: 'xw-title', html: PatOS.iconHTML('x-' + c.id) }, c.name), h('div', { style: { flex: 1 } }), bReload, bOwn);
      win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px';
      bOwn.onclick = () => openOnComputer(c, true);
      if (args.blocked || !c.frame || PatOS.sandboxed) {
        const card = h('div', { class: 'xw-card' }, h('div', { class: 'xw-ic', html: PatOS.iconHTML('x-' + c.id) }), h('h2', {}, c.name),
          h('p', {}, PatOS.t(PatOS.sandboxed ? 'This copy of PatOS runs inside a Claude Artifact, which can’t open other websites. Open PatOS from its website.' : args.blocked ? 'Your browser blocked the new window. Press the button to open it.' : 'This website doesn’t allow being shown inside other apps, so it opens in its own window.')),
          h('button', { class: 'btn primary', onclick: () => openOnComputer(c, true) }, PatOS.t('Open') + ' ' + c.name),
          h('small', {}, c.web.replace(/^https:\/\//, '').replace(/\/$/, '')));
        win.body.appendChild(card); bReload.style.display = 'none'; return;
      }
      const f = h('iframe', { src: c.web, class: 'xw-frame', allow: 'camera; microphone; autoplay; fullscreen; clipboard-write; encrypted-media', referrerpolicy: 'strict-origin-when-cross-origin' });
      bReload.onclick = () => { f.src = c.web; };
      win.body.appendChild(f);
    }
  });

  PatOS.extApps = {
    list: () => CATALOG.map((x) => byId[x[0]]),
    device,
    isInstalled: (id) => installed.has(id),
    install(id) { installed.add(id); saveInstalled(); PatOS.apps['x-' + id].hidden = false; refresh(); },
    uninstall(id) {
      installed.delete(id); saveInstalled(); PatOS.apps['x-' + id].hidden = true;
      ['dockPinned', 'mobileDock'].forEach((k) => { const l = PatOS.settings[k] || []; if (l.includes('x-' + id)) PatOS.setSetting(k, l.filter((x) => x !== 'x-' + id)); });
      refresh();
    },
    open
  };
})();
