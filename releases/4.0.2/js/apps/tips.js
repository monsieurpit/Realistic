/* Tips (4.0): how to use PatOS, from the first things (the Dock, Spotlight, windows) to the less obvious ones (World, Data,
   Live, Commons), and every keyboard shortcut. Each tip has a "Try it" that does the real thing: it opens the app or the
   panel, or presses the shortcut for you. Tips you have seen are remembered on this device; "New in 4.0" shows first after
   the update. Every tip is written in English and French here (not in js/i18n.js: they are long and only shown here). */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  const L = (o) => (PatOS.lang === 'fr' ? o[1] : o[0]);
  PatOS.iconDefs.tips = { bg: 'linear-gradient(160deg,#ffd60a,#ff9f0a)', svg: () => '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M32 10c-9.4 0-17 7.2-17 16.2 0 5.6 3 9.8 6.4 13 1.9 1.8 3 4 3 6.4V48h15.2v-2.4c0-2.4 1.1-4.6 3-6.4 3.4-3.2 6.4-7.4 6.4-13C49 17.2 41.4 10 32 10z" fill="#fff"/><rect x="24.5" y="50" width="15" height="4" rx="2" fill="#fff" opacity=".85"/><rect x="26.5" y="55.5" width="11" height="3.5" rx="1.75" fill="#fff" opacity=".7"/></svg>' };
  // a key press, as if you pressed it (the shortcut tips "Try it" with the real thing)
  const press = (code, mods) => () => { const o = Object.assign({ code, key: code.replace(/^Key/, '').toLowerCase(), bubbles: true, cancelable: true }, mods || { altKey: true }); document.dispatchEvent(new KeyboardEvent('keydown', o)); };
  const open = (app, args) => () => PatOS.launch(app, args || {});
  const settings = (pane) => open('settings', { pane });

  // [id, collection, app icon, [title en, title fr], [text en, text fr], keys?, try label?, try fn?]
  const C = {
    new: ['New in 4.0', 'Nouveau dans 4.0', 'sparkle'], basics: ['Essentials', 'L’essentiel', 'star'], windows: ['Windows & desktop', 'Fenêtres et bureau', 'window'],
    work: ['Get things done', 'Être efficace', 'check'], yours: ['Make it yours', 'À ton goût', 'wand'], together: ['Together', 'Ensemble', 'person'],
    privacy: ['Privacy & safety', 'Confidentialité et sécurité', 'shield'], keys: ['Keyboard shortcuts', 'Raccourcis clavier', 'grid']
  };
  const TIPS = [
    // ---------- new in 4.0 ----------
    ['w40', 'new', 'clock', ['Widgets on your desktop', 'Des widgets sur ton bureau'], ['Right-click the desktop and choose Edit Widgets.', 'Clic droit sur le bureau, puis Modifier les widgets.'], null, ['Edit widgets', 'Modifier les widgets'], () => PatOS.widgets && PatOS.widgets.edit && PatOS.widgets.edit(true)],
    ['studio40', 'new', 'deskstudio', ['Design your whole desktop in Studio', 'Dessine tout ton bureau dans Studio'], ['Arrange widgets, panels, the Dock and menus, then keep or undo.', 'Place widgets, panneaux, Dock et menus, puis garde ou annule.'], null, ['Open Studio', 'Ouvrir Studio'], open('deskstudio')],
    ['prof40', 'new', 'settings', ['A profile for each part of your life', 'Un profil pour chaque partie de ta vie'], ['Each profile has its own look, Dock, widgets and windows.', 'Chaque profil a son apparence, son Dock, ses widgets et ses fenêtres.'], null, ['Switch profile', 'Changer de profil'], () => { const b = document.getElementById('mb-profile'); if (b) b.click(); else settings('profiles')(); }],
    ['world40', 'new', 'world', ['Think big in World', 'Voir grand dans Monde'], ['An endless board for notes, files, links and windows.', 'Un tableau sans fin pour notes, fichiers, liens et fenêtres.'], null, ['Open World', 'Ouvrir Monde'], open('world')],
    ['data40', 'new', 'data', ['See what goes together with Data', 'Vois ce qui va ensemble avec Data'], ['Shows what goes together, and why.', 'Montre ce qui va ensemble, et pourquoi.'], null, ['Open Data', 'Ouvrir Data'], open('data')],
    ['gal40', 'new', 'gallery', ['Collections you can present', 'Des collections à présenter'], ['Collections of pictures, notes and links you can present.', 'Des collections d’images, notes et liens à présenter.'], null, ['Open Gallery', 'Ouvrir Galerie'], open('gallery')],
    ['search40', 'new', 'finder', ['Search inside everything', 'Chercher dans tout'], ['Spotlight finds the words inside your files and notes.', 'Spotlight trouve les mots dans tes fichiers et notes.'], 'Ctrl+Space', ['Search', 'Chercher'], () => PatOS.spotlight.show()],
    ['ai40', 'new', 'pat', ['Ask Pat for more', 'Demande plus à Pat'], ['Try “prepare my desktop for school tomorrow”.', 'Essaie « prépare mon bureau pour l’école demain ».'], null, ['Ask Pat', 'Demander à Pat'], open('pat')],
    ['live40', 'new', 'livespace', ['Work together live', 'Travaillez ensemble en direct'], ['Boards, notes, tasks and calls in a Shared Space.', 'Tableaux, notes, tâches et appels dans un espace partagé.'], null, ['Open Live', 'Ouvrir Live'], open('livespace')],
    ['commons40', 'new', 'commons', ['Join a community', 'Rejoins une communauté'], ['Communities with posts, events and challenges.', 'Des communautés avec publications, événements et défis.'], null, ['Open Commons', 'Ouvrir Commons'], open('commons')],
    ['pill40', 'new', 'settings', ['The Pill knows more', 'La Pill en sait plus'], ['Weather, music and copies at the top of the screen.', 'Météo, musique et copies en haut de l’écran.'], 'Alt+A', ['Open the Pill', 'Ouvrir la Pill'], () => PatOS.pill && PatOS.pill.expand()],
    // ---------- essentials ----------
    ['dock', 'basics', 'finder', ['The Dock', 'Le Dock'], ['Click to open. Hold and drag to move. Drag out to remove.', 'Clique pour ouvrir. Maintiens et glisse pour déplacer. Glisse dehors pour retirer.'], null, ['Dock settings', 'Réglages du Dock'], settings('dock')],
    ['launchpad', 'basics', 'launchpad', ['Every app in Launchpad', 'Toutes les apps dans Launchpad'], ['All your apps. Type to find one.', 'Toutes tes apps. Tape pour en trouver une.'], 'Alt+L', ['Open Launchpad', 'Ouvrir Launchpad'], () => PatOS.launchpad.show()],
    ['spotlight', 'basics', 'finder', ['Find anything with Spotlight', 'Trouve tout avec Spotlight'], ['Apps, files, settings, math and conversions.', 'Apps, fichiers, réglages, calculs et conversions.'], 'Ctrl+Space', ['Open Spotlight', 'Ouvrir Spotlight'], () => PatOS.spotlight.show()],
    ['pat', 'basics', 'pat', ['Pat does things for you', 'Pat fait des choses pour toi'], ['Ask in your own words: timers, reminders, files, settings.', 'Demande avec tes mots : minuteries, rappels, fichiers, réglages.'], null, ['Ask Pat', 'Demander à Pat'], open('pat')],
    ['cc', 'basics', 'settings', ['Control Center', 'Centre de contrôle'], ['Wi-Fi, dark mode, volume and more.', 'Wi-Fi, mode sombre, volume et plus.'], null, ['Open Control Center', 'Ouvrir le Centre de contrôle'], () => { const b = document.getElementById('mb-cc'); if (b) b.click(); }],
    ['notifs', 'basics', 'settings', ['Notifications', 'Notifications'], ['Click the time in the menu bar.', 'Clique l’heure dans la barre des menus.'], null, ['Notification settings', 'Réglages des notifications'], settings('notifications')],
    ['piles', 'basics', 'finder', ['Your files in Piles', 'Tes fichiers dans Piles'], ['Your documents, downloads and pictures.', 'Tes documents, téléchargements et images.'], null, ['Open Piles', 'Ouvrir Piles'], open('finder')],
    ['command', 'basics', 'settings', ['Command Center', 'Centre de commande'], ['Copies, downloads and backups in one place.', 'Copies, téléchargements et sauvegardes au même endroit.'], 'Alt+K', ['Open it', 'L’ouvrir'], () => PatOS.command && PatOS.command.open()],
    ['undo', 'basics', 'finder', ['Nothing is lost in the Trash', 'Rien n’est perdu dans la Corbeille'], ['Deleted files can be put back from the Trash.', 'Les fichiers supprimés peuvent être remis depuis la Corbeille.'], null, ['Open the Trash', 'Ouvrir la Corbeille'], open('finder', { path: '/.Trash' })],
    // ---------- windows & desktop ----------
    ['snap', 'windows', 'settings', ['Snap windows side by side', 'Mets des fenêtres côte à côte'], ['Drag a window to an edge to fill half the screen.', 'Glisse une fenêtre vers un bord pour remplir la moitié de l’écran.']],
    ['tile', 'windows', 'settings', ['Tile all your windows', 'Range toutes tes fenêtres'], ['Puts every window side by side.', 'Place toutes les fenêtres côte à côte.'], 'Ctrl+Alt+T', ['Tile them now', 'Les ranger maintenant'], () => PatOS.wmPro && PatOS.wmPro.tileAll()],
    ['mission', 'windows', 'settings', ['See every window', 'Vois toutes les fenêtres'], ['See all your windows at once.', 'Vois toutes tes fenêtres d’un coup.'], 'Alt+Up', ['Show them', 'Les montrer'], () => PatOS.mission && PatOS.mission.toggle()],
    ['tabs', 'windows', 'notes', ['Windows as tabs', 'Des fenêtres en onglets'], ['Drag a window onto another of the same app to make tabs.', 'Glisse une fenêtre sur une autre de la même app pour faire des onglets.']],
    ['fullscreen', 'windows', 'settings', ['Full screen', 'Plein écran'], ['The green button. Point at the top to see the menu bar.', 'Le bouton vert. Pointe en haut pour voir la barre des menus.']],
    ['desktop', 'windows', 'finder', ['Your desktop', 'Ton bureau'], ['Right-click for folders, wallpaper and widgets.', 'Clic droit pour les dossiers, le fond d’écran et les widgets.']],
    // ---------- get things done ----------
    ['notes', 'work', 'notes', ['Notes', 'Notes'], ['Quick notes, found by any word in Spotlight.', 'Des notes rapides, retrouvées par n’importe quel mot dans Spotlight.'], null, ['Open Notes', 'Ouvrir Notes'], open('notes')],
    ['calendar', 'work', 'calendar', ['Calendar and Reminders', 'Calendrier et Rappels'], ['Or tell Pat: “remind me to call mom tomorrow at 5”.', 'Ou dis à Pat : « rappelle-moi d’appeler maman demain à 17 h ».'], null, ['Open Calendar', 'Ouvrir Calendrier'], open('calendar')],
    ['shortcuts', 'work', 'shortcuts', ['Shortcuts do several things at once', 'Les raccourcis font plusieurs choses d’un coup'], ['Do several things with one click.', 'Fais plusieurs choses d’un clic.'], null, ['Open Shortcuts', 'Ouvrir Raccourcis'], open('shortcuts')],
    ['clipboard', 'work', 'timeline', ['Everything you copied', 'Tout ce que tu as copié'], ['Paste something you copied earlier.', 'Colle quelque chose copié plus tôt.'], 'Alt+V', ['Show it', 'L’afficher'], () => PatOS.timeline && PatOS.timeline.clipPanel()],
    ['capture', 'work', 'capture', ['Capture a thought in a second', 'Note une idée en une seconde'], ['Type a thought and press Enter.', 'Tape une idée et appuie sur Entrée.'], 'Alt+C', ['Capture now', 'Capturer maintenant'], press('KeyC')],
    ['timeline', 'work', 'timeline', ['Go back in time with Timeline', 'Remonte le temps avec Timeline'], ['Reopen what you were doing.', 'Rouvre ce que tu faisais.'], null, ['Open Timeline', 'Ouvrir Timeline'], open('timeline')],
    ['office', 'work', 'docs', ['Documents, sheets and slides', 'Documents, feuilles et présentations'], ['Open and save Word, Excel and PowerPoint files.', 'Ouvre et enregistre des fichiers Word, Excel et PowerPoint.'], null, ['Open Docs', 'Ouvrir Docs'], open('docs')],
    ['focus', 'work', 'focus', ['Focus', 'Concentration'], ['Quiet notifications while you work.', 'Fais taire les notifications pendant que tu travailles.'], null, ['Open Focus', 'Ouvrir Concentration'], open('focus')],
    // ---------- make it yours ----------
    ['wallpaper', 'yours', 'settings', ['Change the wallpaper', 'Change le fond d’écran'], ['A picture, a 3D wallpaper, or your own photo.', 'Une image, un fond 3D ou ta propre photo.'], null, ['Choose a wallpaper', 'Choisir un fond d’écran'], settings('wallpaper')],
    ['appearance', 'yours', 'settings', ['Light, dark and your color', 'Clair, sombre et ta couleur'], ['Light or dark, and your color.', 'Clair ou sombre, et ta couleur.'], null, ['Appearance', 'Apparence'], settings('appearance')],
    ['dockyours', 'yours', 'settings', ['Your Dock, your way', 'Ton Dock, à ta façon'], ['Size, magnification and hiding.', 'Taille, agrandissement et masquage.'], null, ['Dock settings', 'Réglages du Dock'], settings('dock')],
    ['speed', 'yours', 'settings', ['Faster on a slow computer', 'Plus rapide sur un ordinateur lent'], ['Settings › Display has a lighter look.', 'Réglages › Affichage propose une apparence plus légère.'], null, ['Display settings', 'Réglages d’affichage'], settings('display')],
    ['access', 'yours', 'settings', ['Accessibility', 'Accessibilité'], ['Bigger text, fewer animations, less transparency.', 'Texte plus grand, moins d’animations, moins de transparence.'], null, ['Accessibility', 'Accessibilité'], settings('accessibility')],
    ['apps', 'yours', 'appstore', ['Get more apps', 'Obtiens plus d’apps'], ['Apps and games, with permissions you control.', 'Apps et jeux, avec des permissions que tu contrôles.'], null, ['Open the App Store', 'Ouvrir l’App Store'], open('appstore')],
    // ---------- together ----------
    ['account', 'together', 'settings', ['Your PatOS account', 'Ton compte PatOS'], ['Your files and settings on every device.', 'Tes fichiers et réglages sur tous tes appareils.'], null, ['Sync settings', 'Réglages de synchro'], settings('sync')],
    ['messages', 'together', 'messages', ['Messages', 'Messages'], ['Talk with other PatOS people by username.', 'Parle avec d’autres gens de PatOS par nom d’utilisateur.'], null, ['Open Messages', 'Ouvrir Messages'], open('messages')],
    ['spaces', 'together', 'spaces', ['Share files in a Space', 'Partage des fichiers dans un espace'], ['Share files with people you invite.', 'Partage des fichiers avec les gens que tu invites.'], null, ['Open Shared Spaces', 'Ouvrir Espaces partagés'], open('spaces')],
    ['handoff', 'together', 'settings', ['Continue on another device', 'Continue sur un autre appareil'], ['Start on one device, pick up on another.', 'Commence sur un appareil, continue sur un autre.']],
    // ---------- privacy & safety ----------
    ['backup', 'privacy', 'settings', ['Back up everything', 'Sauvegarde tout'], ['Save a backup of everything, restore it any time.', 'Sauvegarde tout, restaure quand tu veux.'], null, ['Open Command Center', 'Ouvrir le Centre de commande'], () => PatOS.command && PatOS.command.open()],
    ['passwords', 'privacy', 'passwords', ['Keep passwords safe', 'Garde tes mots de passe en sécurité'], ['Logins locked with a master password.', 'Des identifiants verrouillés par un mot de passe principal.'], null, ['Open Passwords', 'Ouvrir Mots de passe'], open('passwords')],
    ['privacy', 'privacy', 'settings', ['You decide what is kept', 'Tu décides ce qui est gardé'], ['Choose what PatOS remembers.', 'Choisis ce dont PatOS se souvient.'], null, ['Privacy settings', 'Réglages de confidentialité'], settings('privacy')],
    ['lock', 'privacy', 'settings', ['Lock your screen', 'Verrouille ton écran'], ['Lock from Spotlight or Control Center.', 'Verrouille depuis Spotlight ou le Centre de contrôle.']]
  ];
  // every shortcut that really works (each is a tip of its own in Keyboard shortcuts)
  const KEYS = [
    ['Ctrl+Space', ['Spotlight search', 'Recherche Spotlight'], () => PatOS.spotlight.show()], ['Alt+L', ['Launchpad', 'Launchpad'], () => PatOS.launchpad.show()],
    ['Alt+Up', ['Mission Control', 'Mission Control'], () => PatOS.mission && PatOS.mission.toggle()], ['Alt+K', ['Command Center', 'Centre de commande'], () => PatOS.command && PatOS.command.open()],
    ['Alt+A', ['Activity Overview in the Pill', 'Aperçu des activités dans la Pill'], () => PatOS.pill && PatOS.pill.expand()], ['Alt+V', ['Clipboard history', 'Historique du presse-papiers'], () => PatOS.timeline && PatOS.timeline.clipPanel()],
    ['Alt+C', ['Quick Capture', 'Capture rapide'], press('KeyC')], ['Ctrl+Alt+T', ['Tile all windows', 'Ranger toutes les fenêtres'], () => PatOS.wmPro && PatOS.wmPro.tileAll()],
    ['Alt+W', ['Close the window', 'Fermer la fenêtre'], null], ['Alt+M', ['Minimize the window', 'Réduire la fenêtre'], null]
  ];
  KEYS.forEach(([k, label, run]) => TIPS.push(['key:' + k, 'keys', 'settings', label, ['Press ' + k + '.', 'Appuie sur ' + k + '.'], k, run ? ['Try it', 'Essayer'] : null, run]));
  const tipOf = (t) => ({ id: t[0], col: t[1], icon: t[2], title: t[3], text: t[4], keys: t[5] || '', tryLabel: t[6] || null, run: t[7] || null });
  const ALL = TIPS.map(tipOf);
  PatOS.tips = { all: () => ALL.map((t) => ({ id: t.id, col: t.col, title: L(t.title), keys: t.keys, canTry: !!t.run })), collections: () => Object.keys(C) };

  PatOS.registerApp({
    id: 'tips', name: 'Tips', icon: 'tips', width: 980, height: 660, minWidth: 380, minHeight: 360, category: 'Apps', keywords: 'tips help how to learn guide astuces aide apprendre conseils',
    about: 'How to use PatOS: the essentials, the rest, and every shortcut.',
    launch(win, args) {
      const seen = new Set(PatOS.store.get('tipsSeen', []) || []);
      const markSeen = (id) => { if (!seen.has(id)) { seen.add(id); PatOS.store.set('tipsSeen', [...seen]); } };
      let col = args.col && C[args.col] ? args.col : 'new', q = '';
      const side = h('nav', { class: 'tp-side ui-side', 'aria-label': T('Tips') }), main = h('div', { class: 'tp-main' });
      win.body.appendChild(h('div', { class: 'tips-app' }, side, main)); // (not "tp": that is the Terminal's purple text)
      const unread = (c) => ALL.filter((t) => t.col === c && !seen.has(t.id)).length;
      function drawSide() {
        side.innerHTML = '';
        const search = PatOS.ui.search({ placeholder: 'Search tips', value: q, onInput: (v) => { q = v; drawMain(); } });
        side.appendChild(search);
        [['new', 'basics', 'windows'], ['work', 'yours', 'together', 'privacy'], ['keys']].forEach((grp, gi) => {
          side.appendChild(h('h4', { class: 'ui-sh' }, L([['Start here', 'Pour commencer'], ['Go further', 'Aller plus loin'], ['Shortcuts', 'Raccourcis']][gi])));
          grp.forEach((c) => { const n = unread(c); side.appendChild(h('button', { class: 'tp-si' + (col === c && !q ? ' on' : ''), 'aria-current': col === c && !q ? 'page' : null, 'data-col': c, onclick: () => { col = c; q = ''; draw(); } }, h('span', { html: PatOS.sym(C[c][2]), 'aria-hidden': 'true' }), h('span', { class: 'tp-sl' }, L([C[c][0], C[c][1]])), n ? h('small', { title: L(['Not seen yet', 'Pas encore vus']) }, String(n)) : null)); });
        });
      }
      const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      function card(t, big) {
        const isNew = !seen.has(t.id);
        const el = h('article', { class: 'tp-card' + (big ? ' big' : '') + (isNew ? ' unseen' : ''), 'data-id': t.id },
          h('div', { class: 'tp-ic', html: t.col === 'keys' ? PatOS.sym('grid') : PatOS.iconHTML(t.icon), 'aria-hidden': 'true' }),
          h('div', { class: 'tp-body' }, h('h3', {}, L(t.title)), h('p', {}, L(t.text)),
            h('div', { class: 'tp-foot' }, t.keys ? PatOS.ui.kbd(t.keys) : null, h('span', { class: 'tp-grow' }),
              t.run ? h('button', { class: 'btn' + (big ? ' primary' : ''), onclick: () => { markSeen(t.id); try { t.run(); } catch (e) {} drawSide(); el.classList.remove('unseen'); } }, L(t.tryLabel || ['Try it', 'Essayer'])) : null)));
        return el;
      }
      function drawMain() {
        main.innerHTML = '';
        if (q.trim()) {
          const w = fold(q.trim()); const l = ALL.filter((t) => fold(L(t.title) + ' ' + L(t.text) + ' ' + t.keys).includes(w));
          main.append(h('header', { class: 'tp-head' }, h('h1', {}, L(['Search', 'Recherche'])), h('p', {}, l.length + ' ' + L(l.length === 1 ? ['tip', 'astuce'] : ['tips', 'astuces']))));
          if (!l.length) main.appendChild(PatOS.ui.empty({ title: 'Nothing matches.', text: '' }));
          else main.appendChild(h('div', { class: 'tp-grid' }, ...l.map((t) => card(t))));
          return;
        }
        const list = ALL.filter((t) => t.col === col);
        main.append(h('header', { class: 'tp-head' }, h('span', { class: 'tp-hic', html: PatOS.sym(C[col][2]), 'aria-hidden': 'true' }), h('div', {}, h('h1', {}, L([C[col][0], C[col][1]])), h('p', {}, list.length + ' ' + L(['tips', 'astuces']) + (unread(col) ? ' · ' + unread(col) + ' ' + L(['not seen yet', 'pas encore vues']) : '')))));
        if (col === 'keys') { main.appendChild(PatOS.ui.group(list.map((t) => PatOS.ui.row({ label: L(t.title), control: h('span', { class: 'tp-krow' }, PatOS.ui.kbd(t.keys), t.run ? h('button', { class: 'btn', onclick: () => { markSeen(t.id); t.run(); } }, L(['Try it', 'Essayer'])) : null) })))); list.forEach((t) => markSeen(t.id)); drawSide(); return; }
        const [first, ...rest] = list;
        main.appendChild(card(first, true));
        main.appendChild(h('div', { class: 'tp-grid' }, ...rest.map((t) => card(t))));
        // seen once they have been on screen for a moment
        clearTimeout(win._tpSeen); win._tpSeen = setTimeout(() => { list.forEach((t) => markSeen(t.id)); drawSide(); }, 2500);
      }
      function draw() { drawSide(); drawMain(); main.scrollTop = 0; }
      win._tips = { open: (c) => { col = c; q = ''; draw(); }, search: (s) => { q = s; drawMain(); }, seen: () => [...seen] };
      draw();
    },
    onArgs(win, args) { if (args && args.col && win._tips) win._tips.open(args.col); }
  });

})();
