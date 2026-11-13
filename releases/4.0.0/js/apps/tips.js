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
    ['w40', 'new', 'clock', ['Widgets on your desktop', 'Des widgets sur ton bureau'], ['Clock, calendar, weather, music, reminders and more live right on the desktop. Right-click the desktop and choose Edit Widgets to add, resize or remove them.', 'Horloge, calendrier, météo, musique, rappels et plus vivent directement sur le bureau. Clic droit sur le bureau, puis Modifier les widgets pour en ajouter, les redimensionner ou les retirer.'], null, ['Edit widgets', 'Modifier les widgets'], () => PatOS.widgets && PatOS.widgets.edit && PatOS.widgets.edit(true)],
    ['studio40', 'new', 'deskstudio', ['Design your whole desktop in Studio', 'Dessine tout ton bureau dans Studio'], ['PatOS Studio arranges widgets and panels, the look, the Dock, menus and shortcuts. Preview a change, then keep it or put yours back. Save versions and share a desktop as a .patdesk file.', 'PatOS Studio place les widgets et les panneaux, l’apparence, le Dock, les menus et les raccourcis. Prévisualise un changement, puis garde-le ou remets le tien. Enregistre des versions et partage un bureau en fichier .patdesk.'], null, ['Open Studio', 'Ouvrir Studio'], open('deskstudio')],
    ['prof40', 'new', 'settings', ['A profile for each part of your life', 'Un profil pour chaque partie de ta vie'], ['School, Work, Games: each profile keeps its own wallpaper, Dock, widgets, notifications and open windows. Switch from your name in the menu bar.', 'École, Travail, Jeux : chaque profil garde son fond d’écran, son Dock, ses widgets, ses notifications et ses fenêtres. Change de profil avec ton nom dans la barre des menus.'], null, ['Switch profile', 'Changer de profil'], () => { const b = document.getElementById('mb-profile'); if (b) b.click(); else settings('profiles')(); }],
    ['world40', 'new', 'world', ['Think big in World', 'Voir grand dans Monde'], ['An endless board for a project: stickies, files, links, notes, widgets and even real windows. Drop a file into a zone to move it there.', 'Un tableau sans fin pour un projet : pense-bêtes, fichiers, liens, notes, widgets et même de vraies fenêtres. Dépose un fichier dans une zone pour l’y déplacer.'], null, ['Open World', 'Ouvrir Monde'], open('world')],
    ['data40', 'new', 'data', ['See what goes together with Data', 'Vois ce qui va ensemble avec Data'], ['Data links your files, notes, events and reminders about the same thing, and says why. Make a collection from a few words and it keeps itself up to date.', 'Data relie tes fichiers, notes, événements et rappels sur un même sujet, et dit pourquoi. Fais une collection avec quelques mots et elle se tient à jour toute seule.'], null, ['Open Data', 'Ouvrir Data'], open('data')],
    ['gal40', 'new', 'gallery', ['Collections you can present', 'Des collections à présenter'], ['Gallery arranges pictures, videos, notes and links in five layouts, follows a folder for you, and presents full screen.', 'Galerie arrange images, vidéos, notes et liens en cinq dispositions, suit un dossier pour toi, et présente en plein écran.'], null, ['Open Gallery', 'Ouvrir Galerie'], open('gallery')],
    ['search40', 'new', 'finder', ['Search inside everything', 'Chercher dans tout'], ['Spotlight, Piles and Pat find the words inside your files, notes, reminders and events, in any order, and show the passage where they are.', 'Spotlight, Piles et Pat trouvent les mots à l’intérieur de tes fichiers, notes, rappels et événements, dans n’importe quel ordre, et montrent le passage où ils sont.'], 'Ctrl+Space', ['Search', 'Chercher'], () => PatOS.spotlight.show()],
    ['ai40', 'new', 'pat', ['Ask Pat for more', 'Demande plus à Pat'], ['Try “the document I edited last Tuesday”, “everything related to biology”, “prepare my desktop for school tomorrow”, “find duplicate files” or “every weekday at 8 open calendar”. Pat asks before anything risky.', 'Essaie « le document que j’ai modifié mardi dernier », « tout ce qui concerne la biologie », « prépare mon bureau pour l’école demain », « trouve les doublons » ou « chaque jour de semaine à 8 h ouvre calendrier ». Pat demande avant tout ce qui est risqué.'], null, ['Ask Pat', 'Demander à Pat'], open('pat')],
    ['live40', 'new', 'livespace', ['Work together live', 'Travaillez ensemble en direct'], ['PatOS Live adds boards, live notes, tasks and voice calls to a Shared Space, and shows who is here. If two people change the same thing, both versions are kept.', 'PatOS Live ajoute tableaux, notes en direct, tâches et appels vocaux à un espace partagé, et montre qui est là. Si deux personnes modifient la même chose, les deux versions sont gardées.'], null, ['Open Live', 'Ouvrir Live'], open('livespace')],
    ['commons40', 'new', 'commons', ['Join a community', 'Rejoins une communauté'], ['PatOS Commons: communities with posts, events, challenges and showcases. Share your desktop, a gallery or a widget, and try other people’s.', 'PatOS Commons : des communautés avec publications, événements, défis et vitrines. Partage ton bureau, une galerie ou un widget, et essaie ceux des autres.'], null, ['Open Commons', 'Ouvrir Commons'], open('commons')],
    ['pill40', 'new', 'settings', ['The Pill knows more', 'La Pill en sait plus'], ['The black capsule at the top shows rain coming, storms from the forecast, the next songs with a favourite button, and how fast your files copy.', 'La capsule noire en haut montre la pluie qui arrive, les orages selon les prévisions, les prochaines chansons avec un bouton favori, et la vitesse de tes copies.'], 'Alt+A', ['Open the Pill', 'Ouvrir la Pill'], () => PatOS.pill && PatOS.pill.expand()],
    // ---------- essentials ----------
    ['dock', 'basics', 'finder', ['The Dock', 'Le Dock'], ['Click an icon to open the app. A dot means it is open. Press and hold an icon, then drag it to move it; drag it away to remove it.', 'Clique une icône pour ouvrir l’app. Un point veut dire qu’elle est ouverte. Garde le bouton appuyé sur une icône, puis glisse-la pour la déplacer; glisse-la dehors pour la retirer.'], null, ['Dock settings', 'Réglages du Dock'], settings('dock')],
    ['launchpad', 'basics', 'launchpad', ['Every app in Launchpad', 'Toutes les apps dans Launchpad'], ['Launchpad shows all your apps. Start typing to find one.', 'Launchpad montre toutes tes apps. Commence à taper pour en trouver une.'], 'Alt+L', ['Open Launchpad', 'Ouvrir Launchpad'], () => PatOS.launchpad.show()],
    ['spotlight', 'basics', 'finder', ['Find anything with Spotlight', 'Trouve tout avec Spotlight'], ['Apps, files, notes, settings, contacts, websites, math (12*7) and conversions (5 km in miles), all from one box. Enter opens the first result.', 'Apps, fichiers, notes, réglages, contacts, sites, calculs (12*7) et conversions (5 km en miles), dans une seule boîte. Entrée ouvre le premier résultat.'], 'Ctrl+Space', ['Open Spotlight', 'Ouvrir Spotlight'], () => PatOS.spotlight.show()],
    ['pat', 'basics', 'pat', ['Pat does things for you', 'Pat fait des choses pour toi'], ['Ask in your own words: open apps, set timers, add reminders and events, find and tidy files, change settings. Pat uses fixed rules, no AI, and shows what it understood in Settings.', 'Demande avec tes mots : ouvrir des apps, mettre des minuteries, ajouter rappels et événements, trouver et ranger des fichiers, changer des réglages. Pat suit des règles fixes, sans IA, et montre ce qu’il a compris dans Réglages.'], null, ['Ask Pat', 'Demander à Pat'], open('pat')],
    ['cc', 'basics', 'settings', ['Control Center', 'Centre de contrôle'], ['Wi-Fi, dark mode, Do Not Disturb, volume, brightness and your profile, in one place: the switches icon in the menu bar.', 'Wi-Fi, mode sombre, Ne pas déranger, volume, luminosité et ton profil, au même endroit : l’icône des interrupteurs dans la barre des menus.'], null, ['Open Control Center', 'Ouvrir le Centre de contrôle'], () => { const b = document.getElementById('mb-cc'); if (b) b.click(); }],
    ['notifs', 'basics', 'settings', ['Notifications', 'Notifications'], ['Click the date and time in the menu bar to see your notifications. Choose which apps may notify you, and quiet hours, in Settings.', 'Clique la date et l’heure dans la barre des menus pour voir tes notifications. Choisis quelles apps peuvent te notifier, et les heures calmes, dans Réglages.'], null, ['Notification settings', 'Réglages des notifications'], settings('notifications')],
    ['piles', 'basics', 'finder', ['Your files in Piles', 'Tes fichiers dans Piles'], ['Piles keeps your documents, downloads and pictures, sorted by kind and date. Drag files between folders, and right-click for more.', 'Piles garde tes documents, téléchargements et images, triés par sorte et par date. Glisse des fichiers entre dossiers, et fais un clic droit pour plus.'], null, ['Open Piles', 'Ouvrir Piles'], open('finder')],
    ['command', 'basics', 'settings', ['Command Center', 'Centre de commande'], ['Everything happening now in one place: copies, downloads, backups and what needs your attention.', 'Tout ce qui se passe maintenant au même endroit : copies, téléchargements, sauvegardes et ce qui demande ton attention.'], 'Alt+K', ['Open it', 'L’ouvrir'], () => PatOS.command && PatOS.command.open()],
    ['undo', 'basics', 'finder', ['Nothing is lost in the Trash', 'Rien n’est perdu dans la Corbeille'], ['Deleted files go to the Trash in the Dock. Open it and put a file back where it was. Text files also keep their earlier versions.', 'Les fichiers supprimés vont dans la Corbeille du Dock. Ouvre-la et remets un fichier où il était. Les fichiers texte gardent aussi leurs versions précédentes.'], null, ['Open the Trash', 'Ouvrir la Corbeille'], open('finder', { path: '/.Trash' })],
    // ---------- windows & desktop ----------
    ['snap', 'windows', 'settings', ['Snap windows side by side', 'Mets des fenêtres côte à côte'], ['Drag a window to the left or right edge to fill half the screen. Drag it to the top to choose a layout.', 'Glisse une fenêtre vers le bord gauche ou droit pour remplir la moitié de l’écran. Glisse-la vers le haut pour choisir une disposition.']],
    ['tile', 'windows', 'settings', ['Tile all your windows', 'Range toutes tes fenêtres'], ['Puts every open window side by side, so nothing hides another.', 'Place toutes les fenêtres ouvertes côte à côte, pour que rien n’en cache une autre.'], 'Ctrl+Alt+T', ['Tile them now', 'Les ranger maintenant'], () => PatOS.wmPro && PatOS.wmPro.tileAll()],
    ['mission', 'windows', 'settings', ['See every window', 'Vois toutes les fenêtres'], ['Mission Control spreads out all your windows. Click one to go to it.', 'Mission Control étale toutes tes fenêtres. Clique sur l’une pour y aller.'], 'Alt+Up', ['Show them', 'Les montrer'], () => PatOS.mission && PatOS.mission.toggle()],
    ['tabs', 'windows', 'notes', ['Windows as tabs', 'Des fenêtres en onglets'], ['Drag a window onto the title bar of another window of the same app: they become tabs of one window.', 'Glisse une fenêtre sur la barre de titre d’une autre fenêtre de la même app : elles deviennent les onglets d’une seule fenêtre.']],
    ['fullscreen', 'windows', 'settings', ['Full screen', 'Plein écran'], ['The green button makes a window full screen. Rest the pointer at the top or bottom of the screen to see the menu bar and Dock again.', 'Le bouton vert met une fenêtre en plein écran. Laisse le pointeur en haut ou en bas de l’écran pour revoir la barre des menus et le Dock.']],
    ['desktop', 'windows', 'finder', ['Your desktop', 'Ton bureau'], ['Right-click the desktop to make a folder, change the wallpaper or edit widgets. Files you put on the desktop stay there.', 'Fais un clic droit sur le bureau pour créer un dossier, changer le fond d’écran ou modifier les widgets. Les fichiers que tu mets sur le bureau y restent.']],
    // ---------- get things done ----------
    ['notes', 'work', 'notes', ['Notes', 'Notes'], ['Write quick notes, pin the important ones, and find them by any word inside with Spotlight.', 'Écris des notes rapides, épingle les importantes, et retrouve-les par n’importe quel mot avec Spotlight.'], null, ['Open Notes', 'Ouvrir Notes'], open('notes')],
    ['calendar', 'work', 'calendar', ['Calendar and Reminders', 'Calendrier et Rappels'], ['Add events and reminders, or just tell Pat: “remind me to call mom tomorrow at 5”. The Pill shows what is coming.', 'Ajoute des événements et des rappels, ou dis-le à Pat : « rappelle-moi d’appeler maman demain à 17 h ». La Pill montre ce qui arrive.'], null, ['Open Calendar', 'Ouvrir Calendrier'], open('calendar')],
    ['shortcuts', 'work', 'shortcuts', ['Shortcuts do several things at once', 'Les raccourcis font plusieurs choses d’un coup'], ['Build a shortcut that opens apps, changes settings and asks Pat things, then run it with one click, at a time of day, or when you unlock.', 'Construis un raccourci qui ouvre des apps, change des réglages et demande des choses à Pat, puis lance-le d’un clic, à une heure, ou quand tu déverrouilles.'], null, ['Open Shortcuts', 'Ouvrir Raccourcis'], open('shortcuts')],
    ['clipboard', 'work', 'timeline', ['Everything you copied', 'Tout ce que tu as copié'], ['Your clipboard history: pick something you copied earlier and paste it again. Pin what you want to keep.', 'L’historique du presse-papiers : choisis quelque chose copié plus tôt et colle-le encore. Épingle ce que tu veux garder.'], 'Alt+V', ['Show it', 'L’afficher'], () => PatOS.timeline && PatOS.timeline.clipPanel()],
    ['capture', 'work', 'capture', ['Capture a thought in a second', 'Note une idée en une seconde'], ['Type it and press Enter: a task, a link, a note. Capture sorts it for you.', 'Tape-la et appuie sur Entrée : une tâche, un lien, une note. Capture la range pour toi.'], 'Alt+C', ['Capture now', 'Capturer maintenant'], press('KeyC')],
    ['timeline', 'work', 'timeline', ['Go back in time with Timeline', 'Remonte le temps avec Timeline'], ['Timeline remembers what you opened, on this device only, and can reopen your windows where you left off.', 'Timeline se souvient de ce que tu as ouvert, sur cet appareil seulement, et peut rouvrir tes fenêtres là où tu étais.'], null, ['Open Timeline', 'Ouvrir Timeline'], open('timeline')],
    ['office', 'work', 'docs', ['Documents, sheets and slides', 'Documents, feuilles et présentations'], ['Docs, Sheets and Slides open Word, Excel and PowerPoint files and save them back.', 'Docs, Sheets et Slides ouvrent les fichiers Word, Excel et PowerPoint et les enregistrent.'], null, ['Open Docs', 'Ouvrir Docs'], open('docs')],
    ['focus', 'work', 'focus', ['Focus', 'Concentration'], ['Turn on Do Not Disturb, or ask Pat to “start my study workspace” to open what you need and quiet the rest.', 'Active Ne pas déranger, ou demande à Pat « lance mon espace étude » pour ouvrir ce qu’il faut et faire taire le reste.'], null, ['Open Focus', 'Ouvrir Concentration'], open('focus')],
    // ---------- make it yours ----------
    ['wallpaper', 'yours', 'settings', ['Change the wallpaper', 'Change le fond d’écran'], ['Pick a picture, a moving 3D wallpaper, or one of your own photos.', 'Choisis une image, un fond 3D animé, ou une de tes photos.'], null, ['Choose a wallpaper', 'Choisir un fond d’écran'], settings('wallpaper')],
    ['appearance', 'yours', 'settings', ['Light, dark and your color', 'Clair, sombre et ta couleur'], ['Choose light or dark, an accent color, and how clear Liquid Glass looks.', 'Choisis clair ou sombre, une couleur d’accent, et la transparence du Liquid Glass.'], null, ['Appearance', 'Apparence'], settings('appearance')],
    ['dockyours', 'yours', 'settings', ['Your Dock, your way', 'Ton Dock, à ta façon'], ['Make it smaller or bigger, magnify icons as you pass over them, or hide it until you need it.', 'Rends-le plus petit ou plus grand, grossis les icônes au passage, ou cache-le jusqu’à ce que tu en aies besoin.'], null, ['Dock settings', 'Réglages du Dock'], settings('dock')],
    ['speed', 'yours', 'settings', ['Faster on a slow computer', 'Plus rapide sur un ordinateur lent'], ['If PatOS feels slow, Settings › Display has a lighter look that keeps everything working.', 'Si PatOS te semble lent, Réglages › Affichage propose une apparence plus légère où tout fonctionne encore.'], null, ['Display settings', 'Réglages d’affichage'], settings('display')],
    ['access', 'yours', 'settings', ['Accessibility', 'Accessibilité'], ['Bigger text, fewer animations, less transparency, and more, for everyone.', 'Texte plus grand, moins d’animations, moins de transparence, et plus, pour tout le monde.'], null, ['Accessibility', 'Accessibilité'], settings('accessibility')],
    ['apps', 'yours', 'appstore', ['Get more apps', 'Obtiens plus d’apps'], ['The App Store has apps, games and community apps. They run in their own space and only do what you allow.', 'L’App Store a des apps, des jeux et des apps de la communauté. Elles tournent dans leur propre espace et ne font que ce que tu permets.'], null, ['Open the App Store', 'Ouvrir l’App Store'], open('appstore')],
    // ---------- together ----------
    ['account', 'together', 'settings', ['Your PatOS account', 'Ton compte PatOS'], ['Sign in with a username and password to keep your files and settings on every device, encrypted with your password.', 'Connecte-toi avec un nom d’utilisateur et un mot de passe pour garder tes fichiers et réglages sur tous tes appareils, chiffrés avec ton mot de passe.'], null, ['Sync settings', 'Réglages de synchro'], settings('sync')],
    ['messages', 'together', 'messages', ['Messages', 'Messages'], ['Talk with other PatOS people by username. A first message is a request they can accept or decline.', 'Parle avec d’autres gens de PatOS par nom d’utilisateur. Un premier message est une demande qu’ils peuvent accepter ou refuser.'], null, ['Open Messages', 'Ouvrir Messages'], open('messages')],
    ['spaces', 'together', 'spaces', ['Share files in a Space', 'Partage des fichiers dans un espace'], ['Make a Shared Space, invite people as editors or viewers, and work on the same files. Every save is kept.', 'Crée un espace partagé, invite des gens comme éditeurs ou lecteurs, et travaillez sur les mêmes fichiers. Chaque enregistrement est gardé.'], null, ['Open Shared Spaces', 'Ouvrir Espaces partagés'], open('spaces')],
    ['handoff', 'together', 'settings', ['Continue on another device', 'Continue sur un autre appareil'], ['Start a note on your phone and pick it up on your Chromebook: PatOS offers it on the other device.', 'Commence une note sur ton téléphone et reprends-la sur ton Chromebook : PatOS te la propose sur l’autre appareil.']],
    // ---------- privacy & safety ----------
    ['backup', 'privacy', 'settings', ['Back up everything', 'Sauvegarde tout'], ['Make a backup file of all your files and settings, and restore it any time. Command Center can make one for you.', 'Fais un fichier de sauvegarde de tous tes fichiers et réglages, et restaure-le quand tu veux. Le Centre de commande peut en faire un pour toi.'], null, ['Open Command Center', 'Ouvrir le Centre de commande'], () => PatOS.command && PatOS.command.open()],
    ['passwords', 'privacy', 'passwords', ['Keep passwords safe', 'Garde tes mots de passe en sécurité'], ['Passwords keeps your logins locked with a master password, on this device only.', 'Mots de passe garde tes identifiants verrouillés avec un mot de passe principal, sur cet appareil seulement.'], null, ['Open Passwords', 'Ouvrir Mots de passe'], open('passwords')],
    ['privacy', 'privacy', 'settings', ['You decide what is kept', 'Tu décides ce qui est gardé'], ['Pause or clear Timeline, turn off Data or keep folders out of it, and see what Pat has done, all in Settings.', 'Mets Timeline en pause ou efface-la, désactive Data ou exclus des dossiers, et vois ce que Pat a fait, tout dans Réglages.'], null, ['Privacy settings', 'Réglages de confidentialité'], settings('privacy')],
    ['lock', 'privacy', 'settings', ['Lock your screen', 'Verrouille ton écran'], ['Leaving for a moment? Lock PatOS from Spotlight (“Lock Screen”) or Control Center.', 'Tu t’absentes un moment? Verrouille PatOS depuis Spotlight (« Verrouiller l’écran ») ou le Centre de contrôle.']]
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
