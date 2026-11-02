/* PatOS languages: English and French.
   PatOS follows the device language (French if the device is in French, otherwise English),
   or the choice in System Settings › General › Language. Interface text is translated as it
   appears on screen; your own content (notes, documents, file names, chats) is left alone. */
(function () {
  'use strict';
  const PatOS = window.PatOS;
  const pref = PatOS.settings.language;
  const devLang = ((navigator.languages && navigator.languages[0]) || navigator.language || 'en').toLowerCase();
  PatOS.deviceLang = devLang.startsWith('fr') ? 'fr' : 'en';
  PatOS.lang = pref === 'en' || pref === 'fr' ? pref : PatOS.deviceLang;
  PatOS.locale = PatOS.lang === 'fr' ? (devLang.startsWith('fr') ? devLang : 'fr-CA') : (devLang.startsWith('fr') ? 'en-CA' : undefined);
  document.documentElement.lang = PatOS.lang;

  // dates and numbers follow the PatOS language
  if (PatOS.locale) {
    ['toLocaleDateString', 'toLocaleTimeString', 'toLocaleString'].forEach((fn) => {
      const orig = Date.prototype[fn];
      Date.prototype[fn] = function (loc, opts) { return orig.call(this, loc === undefined ? PatOS.locale : loc, opts); };
    });
    const nOrig = Number.prototype.toLocaleString;
    Number.prototype.toLocaleString = function (loc, opts) { return nOrig.call(this, loc === undefined ? PatOS.locale : loc, opts); };
  }

  const FR = {
    // system
    'Finder': 'Finder', 'File': 'Fichier', 'Edit': 'Édition', 'View': 'Présentation', 'Window': 'Fenêtre', 'Help': 'Aide', 'Go': 'Aller',
    'About PatOS': 'À propos de PatOS', 'About PatOS…': 'À propos de PatOS…', 'System Settings…': 'Réglages Système…', 'Settings…': 'Réglages…', 'Settings': 'Réglages',
    'App Library (Launchpad)': 'Bibliothèque d’apps (Launchpad)', 'Force Quit…': 'Forcer à quitter…', 'Force Quit': 'Forcer à quitter', 'Sleep': 'Suspendre', 'Restart…': 'Redémarrer…', 'Restart': 'Redémarrer',
    'Shut Down…': 'Éteindre…', 'Shut Down': 'Éteindre', 'Lock Screen': 'Verrouiller l’écran', 'Lock screen': 'Verrouiller l’écran', 'Lock now': 'Verrouiller maintenant',
    'New Window': 'Nouvelle fenêtre', 'New Folder on Desktop': 'Nouveau dossier sur le bureau', 'Open Finder': 'Ouvrir le Finder', 'Close Window': 'Fermer la fenêtre',
    'Undo': 'Annuler', 'Redo': 'Rétablir', 'Cut': 'Couper', 'Copy': 'Copier', 'Paste': 'Coller', 'Select All': 'Tout sélectionner',
    'Enter Full Screen': 'Passer en plein écran', 'Mission Control': 'Mission Control', 'Launchpad': 'Launchpad', 'Switch to Light Mode': 'Passer au mode clair', 'Switch to Dark Mode': 'Passer au mode sombre',
    'Minimize': 'Placer dans le Dock', 'Zoom': 'Réduire/agrandir', 'Tile Left': 'Placer à gauche', 'Tile Right': 'Placer à droite', 'Bring All to Front': 'Tout ramener au premier plan',
    'PatOS Help': 'Aide PatOS', 'Keyboard Shortcuts': 'Raccourcis clavier', 'Wi-Fi': 'Wi-Fi', 'Connected': 'Connecté', 'Not connected': 'Non connecté', 'Network Settings…': 'Réglages réseau…',
    'Spotlight Search': 'Recherche Spotlight', 'Search': 'Rechercher', 'Applications': 'Applications', 'Files': 'Fichiers', 'Notes': 'Notes', 'Web': 'Web', 'Calculator': 'Calculatrice',
    'Click a window to focus it · Esc to exit': 'Cliquez sur une fenêtre pour l’afficher · Échap pour quitter',
    'Enter Password': 'Mot de passe', 'Press Enter to log in': 'Appuyez sur Entrée', 'Swipe up to open': 'Balayez vers le haut pour ouvrir', 'Swipe up, then enter your password': 'Balayez vers le haut, puis entrez votre mot de passe',
    'No password set. You can add one in System Settings › Lock Screen.': 'Aucun mot de passe. Vous pouvez en ajouter un dans Réglages Système › Écran verrouillé.',
    'Restart PatOS?': 'Redémarrer PatOS?', 'Shut down PatOS?': 'Éteindre PatOS?', 'Open windows will close.': 'Les fenêtres ouvertes seront fermées.', 'OK': 'OK', 'Cancel': 'Annuler',
    'PatOS is shut down.': 'PatOS est éteint.', 'Click anywhere to start up.': 'Cliquez n’importe où pour démarrer.',
    // control center / notifications
    'Focus': 'Concentration', 'Off': 'Désactivé', 'On': 'Activé', 'Do Not Disturb': 'Ne pas déranger', 'Dark': 'Sombre', 'Light': 'Clair', 'Appearance': 'Apparence', 'Full Screen': 'Plein écran',
    'Display': 'Écran', 'Sound': 'Son', '3D Wallpaper': 'Fond d’écran 3D', 'Animating': 'Animé', 'Paused': 'En pause', 'Pick in Settings': 'Choisir dans Réglages', 'UI Sounds': 'Sons de l’interface',
    'Keep Screen On': 'Garder l’écran allumé', 'Mute': 'Muet', 'Sound off': 'Son coupé', 'Sound on': 'Son activé', 'No Internet': 'Pas d’Internet',
    'Notifications': 'Notifications', 'Clear': 'Effacer', 'No new notifications': 'Aucune nouvelle notification', 'Today': 'Aujourd’hui', 'No events today': 'Aucun événement aujourd’hui',
    'Reminders': 'Rappels', 'All done!': 'Tout est fait!', 'Music': 'Musique', 'Tap to play a song': 'Touchez pour jouer une chanson', 'now': 'maintenant', 'Now playing': 'En lecture',
    // launchpad categories
    'Apps': 'Apps', 'Office': 'Bureautique', '3D & Games': '3D et jeux', 'Utilities': 'Utilitaires',
    // app names
    'Patoogle': 'Patoogle', 'TextEdit': 'TextEdit', 'Terminal': 'Terminal', 'Calendar': 'Calendrier', 'Clock': 'Horloge', 'Weather': 'Météo', 'Photos': 'Photos', 'Paint': 'Dessin', 'Photo Booth': 'Photo Booth',
    'System Settings': 'Réglages Système', 'Activity Monitor': 'Moniteur d’activité', 'Galaxy': 'Galaxie', 'Orb Runner': 'Orb Runner', '3D Studio': 'Studio 3D', 'Tic-Tac-Toe': 'Tic-tac-toe', 'Maps': 'Plans',
    'Messages': 'Messages', 'App Store': 'App Store', 'Code Studio': 'Code Studio', 'Piano': 'Piano', 'Flashcards': 'Cartes mémoire', 'Typing Trainer': 'Dactylo', 'Typing': 'Dactylo', 'Voice Memos': 'Dictaphone',
    'Stickies': 'Post-it', 'Dictionary': 'Dictionnaire', 'Docs': 'Docs', 'Sheets': 'Tableurs', 'Slides': 'Présentations', 'Drive': 'Drive', 'Forms': 'Formulaires', 'Translate': 'Traduire', 'YouTube': 'YouTube',
    'Trash': 'Corbeille', 'Keep in Dock': 'Garder dans le Dock', 'Remove from Dock': 'Retirer du Dock', 'Add to Dock': 'Ajouter au Dock', 'Open': 'Ouvrir', 'Show': 'Afficher', 'Quit': 'Quitter', 'Empty Trash': 'Vider la corbeille',
    // desktop
    'New Folder': 'Nouveau dossier', 'New Text File': 'Nouveau fichier texte', 'Import Files from Computer…': 'Importer des fichiers de l’ordinateur…', 'Clean Up Icons': 'Ranger les icônes', 'Change Wallpaper…': 'Changer le fond d’écran…',
    'Next Wallpaper': 'Fond d’écran suivant', 'Open Terminal': 'Ouvrir le Terminal', 'Open with TextEdit': 'Ouvrir avec TextEdit', 'Rename…': 'Renommer…', 'Duplicate': 'Dupliquer', 'Download to Computer': 'Télécharger sur l’ordinateur',
    'Get Info': 'Lire les informations', 'Move to Trash': 'Placer dans la corbeille', 'Rename': 'Renommer', 'Folder': 'Dossier',
    // finder
    'Favorites': 'Favoris', 'Desktop': 'Bureau', 'Documents': 'Documents', 'Downloads': 'Téléchargements', 'Pictures': 'Images', 'Home': 'Accueil', 'PatOS': 'PatOS', 'Storage': 'Stockage',
    'Back': 'Précédent', 'Forward': 'Suivant', 'Icons': 'Icônes', 'List': 'Liste', 'Import from computer': 'Importer de l’ordinateur', 'Name': 'Nom', 'Date Modified': 'Date de modification', 'Size': 'Taille', 'Kind': 'Type',
    'This folder is empty': 'Ce dossier est vide', 'Trash is empty': 'La corbeille est vide', 'No results': 'Aucun résultat', 'Items in the Trash': 'Éléments dans la corbeille', 'Empty': 'Vider', 'Put Back': 'Remettre',
    'Delete Immediately': 'Supprimer immédiatement', 'Import from Computer…': 'Importer de l’ordinateur…', 'View as List': 'Présenter en liste', 'View as Icons': 'Présenter par icônes', 'Application': 'Application',
    'Empty the Trash?': 'Vider la corbeille?', 'The items will be erased for good.': 'Les éléments seront effacés pour de bon.',
    // browser
    'New Tab': 'Nouvel onglet', 'New tab': 'Nouvel onglet', 'Close tab': 'Fermer l’onglet', 'Reload': 'Actualiser', 'Search Google or type a URL': 'Rechercher sur Google ou saisir une URL', 'Search Patoogle or type a web address': 'Rechercher sur Patoogle ou taper une adresse Web', 'Bookmark this page': 'Ajouter cette page aux favoris',
    'Open in a real browser tab': 'Ouvrir hors de PatOS', 'Open outside PatOS': 'Ouvrir hors de PatOS', 'Open in New Tab': 'Ouvrir dans un nouvel onglet', 'Delete Bookmark': 'Supprimer le favori',
    'Good morning': 'Bonjour', 'Good afternoon': 'Bon après-midi', 'Good evening': 'Bonsoir',
    'Most sites open right here. A few big ones, like Gmail, won’t load inside other apps, so use the PatOS app for those.': 'La plupart des sites s’ouvrent ici. Quelques gros sites, comme Gmail, refusent de s’ouvrir dans d’autres apps; utilisez l’app PatOS pour ceux-là.',
    'This site doesn’t let other apps show it, so it won’t open in Patoogle. You can search for it instead, or use the PatOS app that does the same thing (YouTube, Docs, Drive, Maps or Translate).': 'Ce site refuse d’être affiché dans d’autres apps, alors il ne peut pas s’ouvrir dans Patoogle. Cherchez-le avec Google ci-dessus, ou utilisez l’app PatOS correspondante (YouTube, Docs, Drive, Plans, Traduire).',
    // notes / textedit
    'New note': 'Nouvelle note', 'Delete note': 'Supprimer la note', 'Bold': 'Gras', 'Italic': 'Italique', 'Underline': 'Souligné', 'Heading': 'Titre', 'Bulleted list': 'Liste à puces', 'Checkbox': 'Case à cocher',
    'Pin to top': 'Épingler en haut', 'Unpin': 'Désépingler', 'Export as .txt to Documents': 'Exporter en .txt dans Documents', 'Delete': 'Supprimer', 'No additional text': 'Aucun texte supplémentaire', 'New Note': 'Nouvelle note',
    'Save': 'Enregistrer', 'Save As': 'Enregistrer sous', 'Save As…': 'Enregistrer sous…', 'Smaller': 'Plus petit', 'Bigger': 'Plus grand', 'Code font': 'Police de code', 'Preview HTML in Patoogle': 'Aperçu HTML dans Patoogle',
    'Download to computer': 'Télécharger sur l’ordinateur', 'Start typing…': 'Commencez à écrire…', 'Untitled': 'Sans titre', 'New Document': 'Nouveau document', 'Open…': 'Ouvrir…', 'Close': 'Fermer',
    'The file is saved in Documents.': 'Le fichier est enregistré dans Documents.', 'Close without saving?': 'Fermer sans enregistrer?', 'Your text will be lost.': 'Votre texte sera perdu.',
    // calendar / clock / weather
    'New event': 'Nouvel événement', 'No events. Double-click a day or press + to add one.': 'Aucun événement. Double-cliquez sur un jour ou appuyez sur + pour en ajouter un.', '+ Add Event': '+ Ajouter un événement',
    'Leave empty for an all-day event.': 'Laissez vide pour un événement d’une journée entière.', 'Add Event': 'Ajouter', 'Next': 'Suivant', 'All day': 'Toute la journée',
    'World Clock': 'Horloge mondiale', 'Stopwatch': 'Chronomètre', 'Timer': 'Minuterie', 'Local': 'Local', 'Your time': 'Votre heure', 'Same time': 'Même heure', 'Start': 'Démarrer', 'Stop': 'Arrêter', 'Lap': 'Tour',
    'Reset': 'Réinitialiser', 'Pause': 'Pause', 'Timer done!': 'Minuterie terminée!', 'London': 'Londres', 'Tokyo': 'Tokyo', 'Sydney': 'Sydney', 'New York': 'New York', 'Vancouver': 'Vancouver', 'Paris': 'Paris',
    'Loading weather…': 'Chargement de la météo…', 'HOURLY FORECAST': 'PRÉVISIONS HORAIRES', '7-DAY FORECAST': 'PRÉVISIONS SUR 7 JOURS', 'FEELS LIKE': 'RESSENTI', 'HUMIDITY': 'HUMIDITÉ', 'WIND': 'VENT', 'UV INDEX': 'INDICE UV',
    'SUNRISE': 'LEVER DU SOLEIL', 'SUNSET': 'COUCHER DU SOLEIL', 'Clear Sky': 'Ciel dégagé', 'Sun': 'dim.', 'Mon': 'lun.', 'Tue': 'mar.', 'Wed': 'mer.', 'Thu': 'jeu.', 'Fri': 'ven.', 'Sat': 'sam.', 'Mostly Clear': 'Plutôt dégagé', 'Partly Cloudy': 'Partiellement nuageux', 'Cloudy': 'Nuageux', 'Fog': 'Brouillard', 'Drizzle': 'Bruine',
    'Light Rain': 'Pluie légère', 'Rain': 'Pluie', 'Heavy Rain': 'Forte pluie', 'Freezing Rain': 'Pluie verglaçante', 'Light Snow': 'Neige légère', 'Snow': 'Neige', 'Heavy Snow': 'Forte neige', 'Snow Grains': 'Grésil',
    'Showers': 'Averses', 'Heavy Showers': 'Fortes averses', 'Snow Showers': 'Averses de neige', 'Thunderstorm': 'Orage', 'Now': 'Maintenant', 'Try again': 'Réessayer', 'City not found': 'Ville introuvable',
    'Use my location': 'Utiliser ma position', 'My Location': 'Ma position', 'Location blocked': 'Position bloquée', 'Search for your city instead.': 'Recherchez plutôt votre ville.', 'Search failed': 'La recherche a échoué',
    'Can’t reach the weather service.': 'Impossible de joindre le service météo.', 'Check your internet connection (some school networks block it).': 'Vérifiez votre connexion Internet (certains réseaux scolaires la bloquent).',
    // music / photos / paint / booth
    'PatOS Originals': 'Originaux PatOS', 'Your Files': 'Vos fichiers', 'Play an audio file from your computer': 'Jouer un fichier audio de l’ordinateur', 'Import': 'Importer',
    'Library': 'Bibliothèque', 'Art': 'Art', 'Import photos': 'Importer des photos', 'Import Photos': 'Importer des photos', 'No photos yet': 'Aucune photo pour l’instant', '‹ All Photos': '‹ Toutes les photos',
    'Take pictures in Photo Booth, draw in Paint, or import images from your computer.': 'Prenez des photos dans Photo Booth, dessinez dans Dessin ou importez des images de l’ordinateur.',
    'Set as Wallpaper': 'Utiliser comme fond d’écran', 'Download': 'Télécharger', 'Wallpaper set': 'Fond d’écran modifié',
    'Brush': 'Pinceau', 'Pencil': 'Crayon', 'Highlighter': 'Surligneur', 'Spray': 'Aérographe', 'Eraser': 'Gomme', 'Fill': 'Remplissage', 'Line': 'Ligne', 'Rectangle': 'Rectangle', 'Ellipse': 'Ellipse', 'Color picker': 'Pipette',
    'Rainbow brush': 'Pinceau arc-en-ciel', 'Custom color': 'Couleur personnalisée', 'Brush size': 'Taille du pinceau', 'Save to Pictures': 'Enregistrer dans Images', 'Saved to Pictures': 'Enregistré dans Images', 'Download PNG': 'Télécharger en PNG',
    'Open image': 'Ouvrir une image', 'Starting camera…': 'Démarrage de la caméra…', 'Take photo': 'Prendre une photo', '⇋ Mirror': '⇋ Miroir', 'Normal': 'Normal', 'Sepia': 'Sépia', 'Thermal': 'Thermique', 'Comic': 'BD',
    'Invert': 'Inverser', 'Dream': 'Rêve', 'Neon': 'Néon', 'Vintage': 'Rétro',
    // reminders / settings
    'To Do': 'À faire', 'Completed': 'Terminés', 'All': 'Tout', '+ New Reminder (press Enter)': '+ Nouveau rappel (appuyez sur Entrée)',
    'General': 'Général', 'Wallpaper': 'Fond d’écran', 'Home Screen & Dock': 'Écran d’accueil et Dock', 'Displays & 3D': 'Écrans et 3D', 'Network': 'Réseau', 'Keyboard': 'Clavier', 'PatOS Account': 'Compte PatOS',
    'Your name': 'Votre nom', 'Layout': 'Disposition', 'Automatic (phone or computer)': 'Automatique (téléphone ou ordinateur)', 'Computer': 'Ordinateur', 'Phone': 'Téléphone',
    'Automatic uses the phone layout on small touch screens': 'Le mode automatique utilise la disposition téléphone sur les petits écrans tactiles',
    'Language': 'Langue', 'Automatic (device language)': 'Automatique (langue de l’appareil)', 'English': 'Anglais', 'French': 'Français', 'PatOS restarts to change the language.': 'PatOS redémarre pour changer de langue.',
    'Ask for full screen at login': 'Demander le plein écran à l’ouverture', 'Makes PatOS feel like a real OS': 'PatOS ressemble encore plus à un vrai système', '24-hour clock': 'Horloge sur 24 heures',
    'Show seconds in menu bar': 'Afficher les secondes dans la barre des menus', 'About this computer': 'À propos de cet ordinateur', 'Highlight color': 'Couleur de mise en valeur', 'Liquid Glass': 'Liquid Glass',
    'See-through glass for the dock, menus, panels and widgets': 'Verre transparent pour le Dock, les menus, les panneaux et les widgets', 'Glass bends the background': 'Le verre déforme l’arrière-plan',
    'Works in Chrome. Uses more battery.': 'Fonctionne dans Chrome. Consomme plus de batterie.', 'Reduce transparency': 'Réduire la transparence',
    'Solid windows. Runs faster on older Chromebooks.': 'Fenêtres opaques. Plus rapide sur les vieux Chromebooks.', 'Fewer animations': 'Moins d’animations', 'Live 3D Wallpapers': 'Fonds d’écran 3D animés',
    'Animated with three.js. They react to your mouse!': 'Animés avec three.js. Ils réagissent à votre souris!', 'Animate 3D wallpaper': 'Animer le fond d’écran 3D', 'Turn off to save battery': 'Désactivez pour économiser la batterie',
    'Your own picture': 'Votre propre image', 'Choose a Photo…': 'Choisir une photo…', 'Size': 'Taille', 'Grow icons under the pointer': 'Agrandir les icônes sous le pointeur', 'How much icons grow': 'Taille de l’agrandissement',
    'Automatically hide the Dock': 'Masquer automatiquement le Dock', 'Show desktop widgets': 'Afficher les widgets sur le bureau', 'Apps in the Dock': 'Apps dans le Dock', 'Desktop icons': 'Icônes du bureau', 'Clean Up': 'Ranger',
    'Dock (up to 4 apps)': 'Dock (jusqu’à 4 apps)', 'Apps on the Home Screen': 'Apps sur l’écran d’accueil', 'Brightness': 'Luminosité', '3D Graphics': 'Graphismes 3D', '3D quality': 'Qualité 3D',
    'Low (best for older Chromebooks)': 'Basse (idéal pour les vieux Chromebooks)', 'Balanced': 'Équilibrée', 'High (sharpest)': 'Haute (la plus nette)', 'Output volume': 'Volume de sortie',
    'Play user interface sounds': 'Jouer les sons de l’interface', 'Test': 'Tester', 'Play Startup Chime': 'Jouer le son de démarrage', 'Login password': 'Mot de passe d’ouverture', 'Set': 'Définir',
    'Leave empty for no password. This only protects PatOS, not your computer.': 'Laissez vide pour ne pas avoir de mot de passe. Il protège seulement PatOS, pas votre ordinateur.',
    'Status': 'État', 'Connection type': 'Type de connexion', 'Speed estimate': 'Vitesse estimée', 'Unknown': 'Inconnu', 'Connected': 'Connecté', 'Offline': 'Hors ligne',
    'PatOS uses Alt because Chromebooks reserve most Ctrl shortcuts.': 'PatOS utilise Alt parce que les Chromebooks réservent la plupart des raccourcis Ctrl.',
    'Spotlight search': 'Recherche Spotlight', 'Close window': 'Fermer la fenêtre', 'Quit app': 'Quitter l’app', 'Zoom window': 'Agrandir la fenêtre', 'Tile window left / right': 'Placer la fenêtre à gauche / à droite',
    'New window': 'Nouvelle fenêtre', 'Cycle windows': 'Changer d’app', 'Patoogle browser': 'Navigateur Patoogle', 'Close menus & overlays': 'Fermer les menus',
    'Empty Trash': 'Vider la corbeille', 'Back up everything': 'Tout sauvegarder', 'Download Backup': 'Télécharger la sauvegarde', 'Restore backup': 'Restaurer une sauvegarde', 'Restore…': 'Restaurer…',
    'Erase all content and settings': 'Effacer contenu et réglages', 'Erase PatOS…': 'Effacer PatOS…', 'Erase PatOS?': 'Effacer PatOS?', 'Erase': 'Effacer',
    'Everything in PatOS will be erased and it will start fresh. This cannot be undone.': 'Tout PatOS sera effacé et repartira à zéro. Cette action est irréversible.',
    // activity
    'Windows': 'Fenêtres', 'Memory used': 'Mémoire utilisée', 'Items on screen': 'Éléments à l’écran', 'Time on': 'Allumé depuis', 'App': 'App', 'Items': 'Éléments', 'No apps are open': 'Aucune app ouverte',
    // 3d apps
    'Galaxy Generator': 'Générateur de galaxie', 'Stars': 'Étoiles', 'Arms': 'Bras', 'Radius': 'Rayon', 'Spin': 'Rotation', 'Spread': 'Dispersion', 'Star size': 'Taille des étoiles', 'Rotation speed': 'Vitesse de rotation',
    'Core': 'Cœur', 'Edge': 'Bord', 'Spiral': 'Spirale', 'Nebula': 'Nébuleuse', 'Ring': 'Anneau', 'Vortex': 'Vortex', 'Controls': 'Réglages', 'Toggle controls': 'Afficher les réglages', 'Save picture to Photos': 'Enregistrer l’image dans Photos',
    'Drag to orbit · scroll to zoom · click to make a supernova': 'Glissez pour tourner · défilez pour zoomer · cliquez pour une supernova', 'Galaxy saved': 'Galaxie enregistrée',
    'Add Shape': 'Ajouter une forme', 'Cube': 'Cube', 'Sphere': 'Sphère', 'Torus': 'Tore', 'Knot': 'Nœud', 'Cone': 'Cône', 'Cylinder': 'Cylindre', 'Gem': 'Gemme', 'Select a shape to edit it.': 'Sélectionnez une forme pour la modifier.',
    'Color': 'Couleur', 'Height': 'Hauteur', 'Left / Right': 'Gauche / Droite', 'Front / Back': 'Avant / Arrière', 'Metal': 'Métal', 'Matte': 'Mat', 'Spinning': 'Tourne', 'Outline': 'Contour',
    '⟳ Auto-rotate': '⟳ Rotation auto', 'Save to Photos': 'Enregistrer dans Photos', 'Scene saved': 'Scène enregistrée', 'Click a shape to select · drag empty space to orbit · scroll to zoom': 'Cliquez une forme pour la choisir · glissez le vide pour tourner · défilez pour zoomer',
    '▶  PLAY': '▶  JOUER', '↻  PLAY AGAIN': '↻  REJOUER', 'GAME OVER': 'PARTIE TERMINÉE', 'PAUSED': 'PAUSE', 'RESUME': 'REPRENDRE', 'New best!': 'Nouveau record!',
    '← → or A / D to switch lanes · Space / ↑ to jump': '← → ou A / D pour changer de voie · Espace / ↑ pour sauter', 'Dodge the blocks, grab the gems. It gets faster!': 'Évitez les blocs, attrapez les gemmes. Ça accélère!',
    'vs Computer': 'contre l’ordinateur', 'vs Friend': 'contre un ami', 'Unbeatable': 'Imbattable', 'Easy': 'Facile', 'New Game': 'Nouvelle partie', 'Your turn (X)': 'À vous (X)', 'Computer is thinking…': 'L’ordinateur réfléchit…',
    'You win! ': 'Vous gagnez! ', 'Computer wins ': 'L’ordinateur gagne ', "It's a draw!": 'Match nul!',
    'Version': 'Version', 'Device': 'Appareil', 'Browser': 'Navigateur', 'Graphics': 'Graphismes', 'Activity…': 'Activité…', 'Made by Pat': 'Fait par Pat',
    // messages / app store / code / piano / cards / typing / memos / stickies / dictionary
    'PatOS Assistant': 'Assistant PatOS', 'help': 'aide', 'tell me a joke': 'raconte une blague', 'open galaxy': 'ouvre galaxie', 'what time is it?': 'quelle heure est-il?', 'remind me to study': 'rappelle-moi d’étudier',
    'Discover': 'Découvrir', 'All Apps': 'Toutes les apps', 'Search apps': 'Rechercher des apps', 'Results': 'Résultats', 'Essentials': 'Essentiels', 'Hidden Apps': 'Apps masquées', 'APP OF THE DAY': 'APP DU JOUR', 'FEATURED': 'EN VEDETTE',
    'OPEN': 'OUVRIR', 'GET': 'OBTENIR', 'Hide App': 'Masquer l’app', 'Show App': 'Afficher l’app', '‹ Back': '‹ Retour', 'Open in New Tab': 'Ouvrir dans un nouvel onglet',
    'Templates…': 'Modèles…', '▶ Run': '▶ Exécuter', 'Save as .html in Documents': 'Enregistrer en .html dans Documents', 'Open the page in Patoogle': 'Ouvrir la page dans Patoogle', 'Save project as': 'Enregistrer le projet sous', 'Project saved': 'Projet enregistré',
    'Saved in Documents. Double-click it to open it in Patoogle.': 'Enregistré dans Documents. Double-cliquez pour l’ouvrir dans Patoogle.', 'Live': 'En direct',
    '● Record': '● Enregistrer', '■ Stop': '■ Arrêter', '▶ Play': '▶ Lire', 'Organ': 'Orgue', 'Synth': 'Synthé', 'Bell': 'Cloche',
    'Use your keyboard: A S D F G H J K L for white keys, W E T Y U O P for black keys, or tap the keys.': 'Utilisez le clavier : A S D F G H J K L pour les touches blanches, W E T Y U O P pour les noires, ou touchez les touches.',
    'Your Decks': 'Vos paquets', '+ New Deck': '+ Nouveau paquet', 'Study': 'Étudier', 'Delete Deck': 'Supprimer le paquet', '+ Add Card': '+ Ajouter une carte', 'Front': 'Recto', 'Show Answer': 'Voir la réponse',
    'Didn’t know': 'Je ne savais pas', 'Knew it': 'Je savais', 'Click the card or press Space to flip': 'Cliquez sur la carte ou appuyez sur Espace pour la retourner', 'Study Again': 'Étudier encore', 'All Decks': 'Tous les paquets',
    '‹ Decks': '‹ Paquets', 'Perfect! ': 'Parfait! ', 'Great job! ': 'Bravo! ', 'Keep practicing! ': 'Continuez à pratiquer! ', 'Name your new deck': 'Nommez votre nouveau paquet',
    'New Text': 'Nouveau texte', 'WPM': 'MPM', 'Accuracy': 'Précision', 'Best': 'Record', 'Start typing to begin the timer. Press Esc to restart.': 'Commencez à taper pour lancer le chrono. Échap pour recommencer.',
    'All Recordings': 'Tous les enregistrements', 'Tap the red button to record your first memo.': 'Touchez le bouton rouge pour enregistrer votre premier mémo.', 'Write something…': 'Écrivez quelque chose…', 'New sticky': 'Nouveau post-it',
    'Look up a word': 'Chercher un mot', 'Type a word above and press Enter.': 'Tapez un mot ci-dessus et appuyez sur Entrée.', 'Looking up…': 'Recherche…', 'No definition found': 'Aucune définition trouvée', 'Synonyms: ': 'Synonymes : ',
    // office
    'Saved': 'Enregistré', 'Saving…': 'Enregistrement…', 'Not saved': 'Non enregistré', 'Normal text': 'Texte normal', 'Title': 'Titre', 'Heading 1': 'Titre 1', 'Heading 2': 'Titre 2', 'Quote': 'Citation', 'Code': 'Code',
    'Text style': 'Style de texte', 'Font': 'Police', 'Font size': 'Taille de police', 'Text color': 'Couleur du texte', 'Highlight': 'Surlignage', 'Align left': 'Aligner à gauche', 'Center': 'Centrer', 'Align right': 'Aligner à droite',
    'Justify': 'Justifier', 'Numbered list': 'Liste numérotée', 'Indent': 'Augmenter le retrait', 'Outdent': 'Diminuer le retrait', 'Insert link': 'Insérer un lien', 'Insert image': 'Insérer une image', 'Insert table': 'Insérer un tableau',
    'Horizontal line': 'Ligne horizontale', 'Checklist item': 'Case à cocher', 'Clear formatting': 'Effacer la mise en forme', 'Find and replace': 'Rechercher et remplacer', 'Print': 'Imprimer', 'Strikethrough': 'Barré',
    'Link address': 'Adresse du lien', 'Insert': 'Insérer', 'Table size (columns x rows)': 'Taille du tableau (colonnes x rangées)', 'Find': 'Rechercher', 'Replace All': 'Tout remplacer', 'Leave empty to just count matches.': 'Laissez vide pour seulement compter.',
    'Web page (.html)': 'Page Web (.html)', 'Plain text (.txt)': 'Texte brut (.txt)', 'Word document (.doc)': 'Document Word (.doc)', 'Untitled document': 'Document sans titre',
    'Fill color': 'Couleur de remplissage', 'Currency': 'Devise', 'Percent': 'Pourcentage', 'Two decimals': 'Deux décimales', 'Plain number': 'Nombre simple', 'Sum the selection': 'Additionner la sélection',
    'Sort by this column': 'Trier selon cette colonne', 'Chart the selection': 'Graphique de la sélection', 'Clear selection': 'Effacer la sélection', 'Import CSV': 'Importer un CSV', 'Export CSV': 'Exporter en CSV', 'Chart': 'Graphique', 'Done': 'Terminé',
    'Type a value or a formula like =SUM(A1:A5)': 'Tapez une valeur ou une formule comme =SUM(A1:A5)', 'Select some numbers first': 'Sélectionnez d’abord des nombres',
    'Pick a column of numbers (and the labels to its left), then press Chart.': 'Choisissez une colonne de nombres (et les étiquettes à gauche), puis appuyez sur Graphique.',
    'Item': 'Article', 'Cost': 'Coût', 'Notebook': 'Cahier', 'Pens': 'Stylos', 'Total': 'Total', 'filled': 'remplies',
    '▶ Present': '▶ Présenter', '＋ Slide': '＋ Diapo', 'New slide': 'Nouvelle diapo', 'Title slide': 'Diapo de titre', 'Title and content': 'Titre et contenu', 'Blank': 'Vide', 'Duplicate this slide': 'Dupliquer cette diapo',
    'Text box': 'Zone de texte', 'Image': 'Image', 'Circle': 'Cercle', 'Bring to front': 'Mettre au premier plan', 'Delete selected': 'Supprimer la sélection', 'Theme': 'Thème', 'Transition': 'Transition', 'Text size': 'Taille du texte',
    'Fade': 'Fondu', 'Slide': 'Glisser', 'Flip': 'Retourner', 'None': 'Aucune', 'Your notes (only you see them)': 'Vos notes (vous seul les voyez)', 'Move up': 'Monter', 'Move down': 'Descendre', 'Delete slide': 'Supprimer la diapo',
    'Presentation title': 'Titre de la présentation', 'Subtitle': 'Sous-titre', 'Slide title': 'Titre de la diapo', 'New text': 'Nouveau texte', 'My Presentation': 'Ma présentation', 'Made in PatOS Slides': 'Fait avec Présentations PatOS',
    '＋ New': '＋ Nouveau', 'Document': 'Document', 'Spreadsheet': 'Feuille de calcul', 'Presentation': 'Présentation', 'Form': 'Formulaire', 'Upload a file…': 'Téléverser un fichier…', 'Search in Drive': 'Rechercher dans Drive',
    'My Drive': 'Mon Drive', 'Spreadsheets': 'Feuilles de calcul', 'Presentations': 'Présentations', 'Start something new': 'Commencer quelque chose', 'Recent files': 'Fichiers récents', 'Blank document': 'Document vide',
    'Blank spreadsheet': 'Feuille vide', 'Blank presentation': 'Présentation vide', 'Blank form': 'Formulaire vide', 'Nothing here yet. Create one above.': 'Rien ici pour l’instant. Créez-en un ci-dessus.', 'No files match your search': 'Aucun fichier ne correspond',
    'Questions': 'Questions', 'Answer': 'Répondre', 'Responses': 'Réponses', 'Form title': 'Titre du formulaire', 'Form description': 'Description du formulaire', 'Question': 'Question', 'Multiple choice': 'Choix multiples',
    'Checkboxes': 'Cases à cocher', 'Short answer': 'Réponse courte', 'Paragraph': 'Paragraphe', 'Linear scale 1–5': 'Échelle de 1 à 5', '+ Add option': '+ Ajouter une option', ' Required': ' Obligatoire', 'Required': 'Obligatoire',
    '+ Add question': '+ Ajouter une question', ' Make this a quiz (mark the right answers to grade it)': ' En faire un quiz (cochez les bonnes réponses pour noter)', 'Correct answer': 'Bonne réponse', 'Correct answer (optional)': 'Bonne réponse (facultatif)',
    'Submit': 'Envoyer', 'Response recorded': 'Réponse enregistrée', 'Submit another response': 'Envoyer une autre réponse', 'Please answer every required question': 'Répondez à toutes les questions obligatoires',
    'Delete all responses': 'Supprimer toutes les réponses', 'Delete all responses?': 'Supprimer toutes les réponses?', 'No responses yet. Use the Answer tab to fill in the form.': 'Aucune réponse. Utilisez l’onglet Répondre pour remplir le formulaire.',
    'Untitled form': 'Formulaire sans titre', 'Untitled question': 'Question sans titre', 'Untitled spreadsheet': 'Feuille sans titre', 'Untitled presentation': 'Présentation sans titre',
    'Enter text': 'Saisissez du texte', 'Swap languages': 'Inverser les langues', 'Listen': 'Écouter', 'Recent': 'Récents', 'Translations by MyMemory (needs internet)': 'Traductions par MyMemory (Internet requis)', 'Copied': 'Copié',
    'Spanish': 'Espagnol', 'German': 'Allemand', 'Italian': 'Italien', 'Portuguese': 'Portugais', 'Dutch': 'Néerlandais', 'Russian': 'Russe', 'Chinese': 'Chinois', 'Japanese': 'Japonais', 'Korean': 'Coréen', 'Arabic': 'Arabe',
    'Hindi': 'Hindi', 'Turkish': 'Turc', 'Polish': 'Polonais', 'Swedish': 'Suédois', 'Greek': 'Grec', 'Vietnamese': 'Vietnamien', 'Ukrainian': 'Ukrainien', 'Haitian Creole': 'Créole haïtien',
    'YouTube in PatOS': 'YouTube dans PatOS', 'Save key': 'Enregistrer la clé', 'Paste your YouTube API key': 'Collez votre clé d’API YouTube', 'Or paste a YouTube video link to watch it now': 'Ou collez un lien de vidéo YouTube pour la regarder',
    'Watch again': 'Regarder à nouveau', 'Comments': 'Commentaires', 'YouTube settings': 'Réglages YouTube', 'YouTube couldn’t load': 'YouTube n’a pas pu charger', 'That API key doesn’t work': 'Cette clé d’API ne fonctionne pas',
    'Music': 'Musique', 'Gaming': 'Jeux vidéo', 'Science': 'Science', 'Space': 'Espace', 'Coding': 'Programmation', 'Sports': 'Sports', 'Comedy': 'Humour', 'Animals': 'Animaux', 'Cooking': 'Cuisine', 'Lofi': 'Lofi', 'Minecraft': 'Minecraft',
    'Videos play in the real YouTube player, right here. To search and see trending videos, PatOS needs a free YouTube API key from Google (you only do this once):': 'Les vidéos jouent dans le vrai lecteur YouTube, ici même. Pour chercher et voir les tendances, PatOS a besoin d’une clé d’API YouTube gratuite de Google (une seule fois) :',
    'On a computer, go to console.cloud.google.com and sign in with a Google account.': 'Sur un ordinateur, allez sur console.cloud.google.com et connectez-vous avec un compte Google.',
    'Create a project, then open “APIs & Services” › “Library” and turn on “YouTube Data API v3”.': 'Créez un projet, puis ouvrez « API et services » › « Bibliothèque » et activez « YouTube Data API v3 ».',
    'Open “Credentials” › “Create credentials” › “API key”, and copy the key.': 'Ouvrez « Identifiants » › « Créer des identifiants » › « Clé API », puis copiez la clé.',
    'Paste it below. It stays only on this device.': 'Collez-la ci-dessous. Elle reste seulement sur cet appareil.',
    'Comments are turned off for this video.': 'Les commentaires sont désactivés pour cette vidéo.', 'This video is unavailable.': 'Cette vidéo n’est pas disponible.',
    'Add a YouTube API key in settings () to see the title, comments and more videos.': 'Ajoutez une clé d’API YouTube dans les réglages () pour voir le titre, les commentaires et d’autres vidéos.',
    'Search for a place': 'Rechercher un lieu', 'My location': 'Ma position', 'Open in Google Maps': 'Ouvrir dans Google Maps', 'Your location': 'Votre position',
    // dialogs and misc
    'Got it': 'Compris', 'Create': 'Créer', 'Copied': 'Copié', 'Error': 'Erreur', 'Yes': 'Oui', 'No': 'Non',
    'Storage is full': 'Le stockage est plein', 'PatOS could not save. Delete some pictures to free space.': 'PatOS n’a pas pu enregistrer. Supprimez des images pour libérer de l’espace.',
    'Make PatOS full screen': 'Mettre PatOS en plein écran', 'In Safari tap Share, then “Add to Home Screen”. PatOS then opens like a real app.': 'Dans Safari, touchez Partager, puis « Sur l’écran d’accueil ». PatOS s’ouvre alors comme une vraie app.',
    'Downloads are off here': 'Téléchargements désactivés ici', 'Not supported': 'Non pris en charge', 'This browser can’t keep the screen on.': 'Ce navigateur ne peut pas garder l’écran allumé.',
    'No recent apps': 'Aucune app récente', 'Close App': 'Fermer l’app', 'Hide App': 'Masquer l’app', 'Edit Home Screen in Settings': 'Modifier l’écran d’accueil dans Réglages',
    'Press Enter to log in ': 'Appuyez sur Entrée ',
    'A full desktop that runs in your browser, even on a school Chromebook.': 'Un bureau complet qui fonctionne dans votre navigateur, même sur un Chromebook d’école.',
    'These results are from Bing.': 'Ces résultats viennent de Bing.', 'Get real Google results': 'Obtenir les vrais résultats Google', 'Search Google': 'Rechercher sur Google', 'Searching…': 'Recherche…',
    'Results by Google': 'Résultats par Google', 'Search settings': 'Réglages de recherche', 'Searching with Google': 'Recherche avec Google', 'Searching with Bing': 'Recherche avec Bing', 'Change': 'Changer', 'Use Google instead': 'Utiliser Google à la place',
    'Use Google': 'Utiliser Google', 'Stop using Google and search with Bing': 'Arrêter Google et chercher avec Bing', 'Not now, keep using Bing': 'Pas maintenant, garder Bing', 'Search engine ID (looks like a1b2c3d4e5f6g7h8i)': 'ID du moteur de recherche (ressemble à a1b2c3d4e5f6g7h8i)',
    'google.com doesn’t let other apps show it, which is why you saw an error or an old-looking Google page. Google does offer an official search box that apps can use. It gives the same up-to-date results. You just need a free ID for it:': 'google.com ne se laisse pas afficher par d’autres apps, c’est pour ça que vous avez vu une erreur ou une vieille page Google. Google offre par contre une boîte de recherche officielle que les apps peuvent utiliser, avec les mêmes résultats à jour. Il vous faut juste un ID gratuit :',
    'On any device, go to programmablesearchengine.google.com and sign in.': 'Sur n’importe quel appareil, allez sur programmablesearchengine.google.com et connectez-vous.',
    'Click Add. Give it any name, and pick “Search the entire web”.': 'Cliquez sur Ajouter. Donnez-lui un nom, puis choisissez « Rechercher sur l’ensemble du Web ».',
    'Click Create, then copy the Search engine ID it shows you.': 'Cliquez sur Créer, puis copiez l’ID du moteur de recherche affiché.', 'Paste it here. It only stays on this device.': 'Collez-le ici. Il reste seulement sur cet appareil.',
    'Close and reopen PatOS to use your new Search engine ID.': 'Fermez et rouvrez PatOS pour utiliser votre nouvel ID de moteur de recherche.', 'Google search can’t run inside a Claude Artifact. Open PatOS from its website.': 'La recherche Google ne fonctionne pas dans un Artifact Claude. Ouvrez PatOS depuis son site Web.',
    'Google search didn’t load. Check your internet connection, or the Search engine ID in Search settings.': 'La recherche Google n’a pas chargé. Vérifiez votre connexion Internet ou l’ID dans les réglages de recherche.',
    'Sort by': 'Trier par', 'Ascending': 'Croissant', 'Descending': 'Décroissant', 'Show info': 'Afficher les infos', 'Show Info': 'Afficher les infos', 'Hide Info': 'Masquer les infos', 'Tags': 'Étiquettes',
    'Red': 'Rouge', 'Orange': 'Orange', 'Yellow': 'Jaune', 'Green': 'Vert', 'Blue': 'Bleu', 'Purple': 'Violet', 'Gray': 'Gris', 'No files with this tag': 'Aucun fichier avec cette étiquette',
    'Select something to see its details.': 'Sélectionnez un élément pour voir ses détails.', 'Where': 'Emplacement', 'Contains': 'Contient', 'Quick Look': 'Coup d’œil', 'items': 'éléments', 'item': 'élément', 'of': 'sur', 'used': 'utilisés',
    'Image': 'Image', 'Audio': 'Audio', 'PDF document': 'Document PDF', 'Web page': 'Page Web', 'Web link': 'Lien Web', 'Text document': 'Document texte', 'Modified': 'Modifié',
    'Albums': 'Albums', 'Screenshots': 'Captures d’écran', 'Drawings': 'Dessins', 'No favorites yet': 'Aucun favori pour l’instant', 'No photos here yet': 'Aucune photo ici pour l’instant',
    'Open a photo and press the star to add it here.': 'Ouvrez une photo et appuyez sur l’étoile pour l’ajouter ici.', 'Thumbnail size': 'Taille des vignettes', 'Slideshow': 'Diaporama', 'Revert': 'Revenir à l’original',
    'Save as Copy': 'Enregistrer une copie', 'Save to Photos': 'Enregistrer dans Photos', 'Filters': 'Filtres', 'Adjust': 'Ajuster', 'Contrast': 'Contraste', 'Warmth': 'Chaleur', 'Vignette': 'Vignettage',
    'Crop and Rotate': 'Recadrer et pivoter', 'Original': 'Originale', 'Square': 'Carré', 'Mirror': 'Miroir', 'edited': 'modifiée', 'Photo saved': 'Photo enregistrée', 'Copy saved to Pictures': 'Copie enregistrée dans Images', 'More': 'Plus',
    'Vivid': 'Éclatant', 'Warm': 'Chaud', 'Cool': 'Froid', 'Mono': 'Mono', 'Noir': 'Noir', 'Dramatic': 'Dramatique',
    'Shuffle': 'Aléatoire', 'Repeat': 'Répéter', 'Repeat off': 'Répétition désactivée', 'Repeat all': 'Tout répéter', 'Repeat one': 'Répéter un morceau', 'Previous': 'Précédent', 'Play': 'Lire',
    'Week': 'Semaine', 'Month': 'Mois', 'all-day': 'journée', 'Coming up': 'À venir', 'New Event': 'Nouvel événement', 'Edit Event': 'Modifier l’événement', 'Date': 'Date', 'Add': 'Ajouter', 'Starting now': 'Commence maintenant',
    'Nothing planned. Double-click a day or press + to add an event.': 'Rien de prévu. Double-cliquez sur un jour ou appuyez sur + pour ajouter un événement.',
    'Conversion': 'Conversion', 'Timer': 'Minuterie', 'Start a timer for': 'Lancer une minuterie de', 'Timer started': 'Minuterie lancée', 'Timer done': 'Minuterie terminée', 'Your timer finished.': 'Votre minuterie est terminée.',
    'Press Enter to copy': 'Appuyez sur Entrée pour copier', 'Open now': 'Ouverte',
    'Body': 'Texte', 'Monospaced': 'Chasse fixe', 'Table': 'Tableau', 'Add a picture': 'Ajouter une image', 'Share and export': 'Partager et exporter', 'Copy Text': 'Copier le texte', 'Open in Docs': 'Ouvrir dans Docs',
    'Save as Text File in Documents': 'Enregistrer en fichier texte dans Documents', 'All Notes': 'Toutes les notes', 'Rename Folder…': 'Renommer le dossier…', 'Delete Folder': 'Supprimer le dossier', 'Delete this folder?': 'Supprimer ce dossier?',
    'Its notes move to Recently Deleted.': 'Ses notes iront dans Supprimés récemment.', 'Recently Deleted': 'Supprimés récemment', 'School': 'École', 'note': 'note', 'notes': 'notes', 'Date Edited': 'Date de modification', 'Pinned': 'Épinglées',
    'Previous 7 Days': '7 derniers jours', 'Earlier': 'Plus tôt', 'Recover': 'Récupérer', 'Move to': 'Déplacer vers', 'Nothing here. Deleted notes stay for 30 days.': 'Rien ici. Les notes supprimées restent 30 jours.', 'No notes yet': 'Aucune note pour l’instant',
    'In Recently Deleted': 'Dans Supprimés récemment', 'No note selected': 'Aucune note sélectionnée', 'Search all notes': 'Rechercher dans toutes les notes', 'New Folder': 'Nouveau dossier',
    'Tomorrow': 'Demain', 'Yesterday': 'Hier', 'Scheduled': 'Planifiés', 'All': 'Tout', 'Flagged': 'Avec drapeau', 'My Lists': 'Mes listes', 'Rename List…': 'Renommer la liste…', 'Delete List': 'Supprimer la liste', 'Delete this list?': 'Supprimer cette liste?',
    'Its reminders will be deleted too.': 'Ses rappels seront aussi supprimés.', 'New List': 'Nouvelle liste', 'Homework': 'Devoirs', 'Add List': 'Ajouter une liste', 'Hide Completed': 'Masquer les terminés', 'Show Completed': 'Afficher les terminés',
    'Overdue': 'En retard', 'Nothing completed yet': 'Rien de terminé pour l’instant', 'All done. Nice.': 'Tout est fait. Bravo.', 'New Reminder': 'Nouveau rappel', 'Details': 'Détails', 'Time': 'Heure', 'Priority': 'Priorité', 'List': 'Liste',
    'None': 'Aucune', 'Low': 'Basse', 'Medium': 'Moyenne', 'High': 'Haute', 'Reminder': 'Rappel', 'Pink': 'Rose', 'Teal': 'Turquoise',
    'Saved cities': 'Villes enregistrées', 'Search for a city above to add it.': 'Cherchez une ville ci-dessus pour l’ajouter.', 'Remove': 'Retirer', 'NEXT 24 HOURS': 'PROCHAINES 24 HEURES', 'temperature and chance of rain': 'température et risque de pluie',
    'AIR QUALITY': 'QUALITÉ DE L’AIR', 'Good': 'Bonne', 'Moderate': 'Moyenne', 'Unhealthy for sensitive people': 'Mauvaise pour les personnes sensibles', 'Unhealthy': 'Mauvaise', 'Very unhealthy': 'Très mauvaise',
    'Grapher': 'Grapheur',
    'Elements': 'Éléments',
    'Journal': 'Journal',
    'Sudoku': 'Sudoku',
    'Add Function': 'Ajouter une fonction',
    'Examples': 'Exemples',
    'Drag to move · scroll to zoom · hover to trace': 'Glissez pour déplacer · molette pour zoomer · survolez pour lire les valeurs',
    'Graph': 'Graphique',
    'Reset view': 'Réinitialiser la vue',
    'Show or hide': 'Afficher ou masquer',
    'Save picture to Photos': 'Enregistrer l’image dans Photos',
    'Alkali metal': 'Métal alcalin',
    'Alkaline earth metal': 'Métal alcalino-terreux',
    'Transition metal': 'Métal de transition',
    'Post-transition metal': 'Métal pauvre',
    'Metalloid': 'Métalloïde',
    'Nonmetal': 'Non-métal',
    'Halogen': 'Halogène',
    'Noble gas': 'Gaz noble',
    'Lanthanide': 'Lanthanide',
    'Actinide': 'Actinide',
    'Atomic number': 'Numéro atomique',
    'Atomic mass': 'Masse atomique',
    'Period': 'Période',
    'Group': 'Groupe',
    'State at room temperature': 'État à température ambiante',
    'Gas': 'Gaz',
    'Liquid': 'Liquide',
    'Solid': 'Solide',
    'Protons': 'Protons',
    'Electrons': 'Électrons',
    'Neutrons (most common)': 'Neutrons (isotope le plus courant)',
    'Read more': 'En savoir plus',
    'not a valid formula': 'formule invalide',
    'Find an element': 'Trouver un élément',
    'Molar mass, e.g. H2O': 'Masse molaire, ex. H2O',
    'Short Break': 'Petite pause',
    'Long Break': 'Longue pause',
    'What are you working on?': 'Sur quoi travaillez-vous ?',
    'Skip': 'Passer',
    'No sound': 'Sans son',
    'White noise': 'Bruit blanc',
    'Brown noise': 'Bruit brun',
    'Timer settings': 'Réglages du minuteur',
    'Statistics': 'Statistiques',
    'Stay focused': 'Restez concentré',
    'Take a breather': 'Respirez un peu',
    'Resume': 'Reprendre',
    'No task': 'Sans tâche',
    'Focus session done': 'Session terminée',
    'Nice work. Time for a break.': 'Beau travail. C’est l’heure de la pause.',
    'Break is over': 'La pause est finie',
    'Ready for the next session?': 'Prêt pour la prochaine session ?',
    'sessions': 'sessions',
    'minutes today': 'minutes aujourd’hui',
    'day streak': 'jours de suite',
    'hours in total': 'heures au total',
    'Last 7 days': '7 derniers jours',
    'Worked on today': 'Travaillé aujourd’hui',
    'Focus (minutes)': 'Concentration (minutes)',
    'Short break (minutes)': 'Petite pause (minutes)',
    'Long break (minutes)': 'Longue pause (minutes)',
    'Long break after': 'Longue pause après',
    'Daily goal (sessions)': 'Objectif du jour (sessions)',
    'Start the next timer automatically': 'Lancer le minuteur suivant automatiquement',
    'Erase all your Focus history?': 'Effacer tout l’historique de concentration ?',
    'Clear history': 'Effacer l’historique',
    'Go to a date': 'Aller à une date',
    'Nothing written yet': 'Rien d’écrit pour l’instant',
    'words': 'mots',
    'Delete Entry': 'Supprimer l’entrée',
    'Delete this entry?': 'Supprimer cette entrée ?',
    'This can’t be undone.': 'Impossible d’annuler.',
    'day in a row': 'jour de suite',
    'days in a row': 'jours de suite',
    'How was your day?': 'Comment s’est passée votre journée ?',
    'Start writing…': 'Commencez à écrire…',
    'Previous day': 'Jour précédent',
    'Next day': 'Jour suivant',
    'Something to write about': 'Une idée pour écrire',
    'Use it': 'L’utiliser',
    'Notes on': 'Notes activées',
    'Notes off': 'Notes désactivées',
    'Hint': 'Indice',
    'Mistakes': 'Erreurs',
    'Solved!': 'Résolu !',
    'New best time': 'Nouveau record',
    'Play Again': 'Rejouer',
    'The periodic table, with a molar mass calculator.': 'Le tableau périodique, avec un calculateur de masse molaire.',
    'Draw graphs of math functions like y = x² or y = sin(x).': 'Tracez des fonctions comme y = x² ou y = sin(x).',
    'A study timer: 25 minutes of focus, then a break. Keeps track of your time.': 'Un minuteur d’étude : 25 minutes de travail, puis une pause. Garde la trace de votre temps.',
    'A private diary: one page per day, with your mood and a question to get you writing.': 'Un journal privé : une page par jour, avec votre humeur et une question pour vous lancer.',
    'Number puzzles with exactly one answer, made fresh every game.': 'Des grilles avec une seule solution, nouvelles à chaque partie.',
    'What made you smile today?': 'Qu’est-ce qui vous a fait sourire aujourd’hui ?',
    'What is one thing you learned today?': 'Qu’avez-vous appris aujourd’hui ?',
    'What are you looking forward to this week?': 'Qu’attendez-vous avec impatience cette semaine ?',
    'Who helped you today, and how?': 'Qui vous a aidé aujourd’hui, et comment ?',
    'What was the hardest part of your day?': 'Quel a été le moment le plus difficile de la journée ?',
    'If today had a title, what would it be?': 'Si aujourd’hui avait un titre, quel serait-il ?',
    'What is something you want to get better at?': 'Dans quoi aimeriez-vous vous améliorer ?',
    'Describe a small win from today.': 'Décrivez une petite victoire d’aujourd’hui.',
    'What would you tell yourself from a year ago?': 'Que diriez-vous à la personne que vous étiez il y a un an ?',
    'What are three things you are thankful for?': 'Quelles sont trois choses pour lesquelles vous êtes reconnaissant ?',
    'What is on your mind right now?': 'À quoi pensez-vous en ce moment ?',
    'What did you do today just for fun?': 'Qu’avez-vous fait aujourd’hui juste pour le plaisir ?',
    'What is a goal for tomorrow?': 'Quel est votre objectif pour demain ?',
    'What song matches your mood today, and why?': 'Quelle chanson correspond à votre humeur aujourd’hui, et pourquoi ?',
    'Ask Pat': 'Demander à Pat',
    'Every single one. Nice.': 'Tout bon. Bien joué.', 'Solid work.': 'Beau travail.', 'Give it another go.': 'Essaie encore une fois.', 'Thanks, your answers were sent': 'Merci, vos réponses ont été envoyées',
    'You win.': 'Vous gagnez.', 'The computer wins.': 'L’ordinateur gagne.', "It's a draw.": 'Match nul.', 'New personal best': 'Nouveau record personnel', 'Offline': 'Hors ligne', 'Connected': 'Connecté',
    'Not available on this device': 'Non disponible sur cet appareil', 'Search for a city': 'Rechercher une ville', 'The camera isn’t available.': 'La caméra n’est pas disponible.',
    'Allow camera access in your browser settings. On a school Chromebook it may be turned off.': 'Autorisez la caméra dans les réglages du navigateur. Sur un Chromebook d’école, elle est peut-être désactivée.',
    'Commands you can use:': 'Commandes disponibles :', 'Made by Pat': 'Fait par Pat', 'Can’t get the weather right now.': 'Impossible d’obtenir la météo pour l’instant.', 'Bing': 'Bing',
    'A web browser with tabs. Searches go through Bing, since Google won’t show its results inside other apps.': 'Un navigateur avec onglets. Les recherches passent par Bing, car Google refuse d’afficher ses résultats dans d’autres apps.',
    'Most sites open right here. A few big ones, like Gmail, won’t load inside other apps, so use the PatOS app for those.': 'La plupart des sites s’ouvrent ici. Quelques gros sites, comme Gmail, refusent de s’ouvrir dans d’autres apps; utilisez l’app PatOS pour ceux-là.',
    'This site doesn’t let other apps show it, so it won’t open in Patoogle. You can search for it instead, or use the PatOS app that does the same thing (YouTube, Docs, Drive, Maps or Translate).': 'Ce site ne se laisse pas afficher par d’autres apps, alors il ne s’ouvre pas dans Patoogle. Vous pouvez le chercher à la place, ou utiliser l’app PatOS qui fait la même chose (YouTube, Docs, Drive, Plans ou Traduire).',
    'Solid windows. Runs faster on older Chromebooks.': 'Fenêtres opaques. Plus rapide sur les vieux Chromebooks.', 'A full desktop that runs in your browser, even on a school Chromebook.': 'Un bureau complet qui fonctionne dans votre navigateur, même sur un Chromebook d’école.',
    'Controls': 'Réglages', 'Import': 'Importer', 'That’s the fastest you’ve typed so far.': 'C’est le plus vite que vous avez tapé jusqu’ici.', 'History': 'Historique', 'No history yet': 'Aucun historique', 'Clear History': 'Effacer l’historique',
    // newer apps
    'Contacts': 'Contacts', 'Freeform': 'Freeform', 'Preview': 'Aperçu', 'Chess': 'Échecs', 'Screenshot': 'Capture d’écran', 'Patoogle': 'Patoogle',
    'No Name': 'Sans nom', 'New contact': 'Nouveau contact', 'Import or export': 'Importer ou exporter', 'No contacts yet. Press + to add one.': 'Aucun contact. Appuyez sur + pour en ajouter un.',
    'Select a contact or add a new one.': 'Choisissez un contact ou ajoutez-en un.', 'First name': 'Prénom', 'Last name': 'Nom', 'Phone': 'Téléphone', 'Email': 'Courriel', 'Birthday': 'Anniversaire', 'Address': 'Adresse',
    'Delete Contact': 'Supprimer le contact', 'Delete this contact?': 'Supprimer ce contact?', 'Favorite': 'Favori', 'Favorite': 'Favori', 'Message': 'Message', 'Change photo': 'Changer la photo',
    'Press Edit to add a phone number, email or birthday.': 'Appuyez sur Édition pour ajouter un numéro, un courriel ou un anniversaire.', 'Import a vCard (.vcf)…': 'Importer une vCard (.vcf)…', 'Export all as vCard': 'Tout exporter en vCard',
    'contacts imported': 'contacts importés', 'Birthday today': 'Anniversaire aujourd’hui',
    'Select and move': 'Sélectionner et déplacer', 'Draw': 'Dessiner', 'Sticky note': 'Note autocollante', 'Text': 'Texte', 'Box': 'Boîte', 'Add a picture': 'Ajouter une image', 'Fit everything': 'Tout afficher', 'Boards': 'Tableaux',
    'New Board': 'Nouveau tableau', 'Rename Board…': 'Renommer le tableau…', 'Clear Board': 'Effacer le tableau', 'Delete Board': 'Supprimer le tableau', 'Board': 'Tableau', 'My Board': 'Mon tableau', 'Name the new board': 'Nommez le nouveau tableau',
    'Rename board': 'Renommer le tableau', 'Clear this board?': 'Effacer ce tableau?', 'Everything on it will be removed.': 'Tout ce qu’il contient sera supprimé.', 'Clear': 'Effacer',
    'Open a PDF or a picture': 'Ouvrir un PDF ou une image', 'Choose a file from your computer, or one already in PatOS.': 'Choisissez un fichier de votre ordinateur ou un fichier déjà dans PatOS.', 'Choose a File…': 'Choisir un fichier…',
    'Zoom out': 'Zoom arrière', 'Zoom in': 'Zoom avant', 'Rotate': 'Pivoter', 'Actual size': 'Taille réelle', 'This PDF can’t be opened': 'Ce PDF ne peut pas être ouvert',
    'Medium': 'Moyen', 'Hard': 'Difficile', 'Flip board': 'Retourner l’échiquier', 'White': 'Les blancs', 'Black': 'Les noirs', 'to move': 'jouent', 'Check!': 'Échec!', 'Checkmate!': 'Échec et mat!',
    'Black wins': 'Les noirs gagnent', 'White wins': 'Les blancs gagnent', 'Stalemate. It’s a draw.': 'Pat. Match nul.', 'Draw (50-move rule)': 'Nul (règle des 50 coups)',
    'Take Screenshot': 'Prendre une capture', 'Record Screen': 'Enregistrer l’écran', 'No delay': 'Sans délai', '3 seconds': '3 secondes', '5 seconds': '5 secondes', 'Delay ': 'Délai ', 'Open in Photos': 'Ouvrir dans Photos',
    'Save Video to Computer': 'Enregistrer la vidéo sur l’ordinateur', 'Screen capture was cancelled.': 'La capture d’écran a été annulée.', 'This device doesn’t allow screen capture (iPhones and iPads don’t).': 'Cet appareil ne permet pas la capture d’écran (les iPhone et iPad ne le permettent pas).',
    'Switch mode': 'Changer de mode', 'Alarms': 'Alarmes', 'Alarm': 'Alarme', 'Add Alarm': 'Ajouter', 'Label': 'Étiquette', 'No alarms yet. Alarms ring while PatOS is open.': 'Aucune alarme. Les alarmes sonnent quand PatOS est ouvert.',
    'Continue': 'Continuer', 'Get Started': 'Commencer', 'Welcome to PatOS. Let’s set things up. It takes less than a minute.': 'Bienvenue dans PatOS. Préparons tout. Ça prend moins d’une minute.',
    'Choose your language': 'Choisissez votre langue', 'You can change it later in System Settings.': 'Vous pourrez la changer plus tard dans Réglages Système.', 'What’s your name?': 'Comment vous appelez-vous?',
    'PatOS shows it on the lock screen and greets you with it.': 'PatOS l’affiche sur l’écran verrouillé et vous salue avec.', 'Choose your look': 'Choisissez votre style', 'Pick a wallpaper': 'Choisissez un fond d’écran',
    'The first three move in 3D.': 'Les trois premiers bougent en 3D.', 'You’re all set, ': 'Tout est prêt, ', 'Start Using PatOS': 'Commencer à utiliser PatOS',
    'Swipe up from the bottom to go home': 'Balayez vers le haut depuis le bas pour revenir à l’accueil', 'Swipe up and pause to switch apps': 'Balayez vers le haut et attendez pour changer d’app',
    'Pull down from the top right for Control Center': 'Tirez vers le bas en haut à droite pour le centre de contrôle', 'Ctrl+Space searches everything': 'Ctrl+Espace cherche partout',
    'Alt+L shows all your apps': 'Alt+L affiche toutes vos apps', 'Drag a window to the edge to snap it': 'Glissez une fenêtre vers le bord pour la placer', 'Waves': 'Vagues', 'Dot Waves': 'Vagues de points', 'Crystals': 'Cristaux', 'Warp': 'Hyperespace', 'Clear Sky': 'Ciel dégagé'
  };
  const PATTERNS = [
    [/^About (.+)$/, (m) => 'À propos de ' + t(m[1])], [/^Hide (.+)$/, (m) => 'Masquer ' + t(m[1])], [/^Quit (.+)$/, (m) => 'Quitter ' + t(m[1])], [/^Log Out (.+)…$/, (m) => 'Fermer la session de ' + m[1] + '…'],
    [/^(\d+) items?( · (.+) used)?$/, (m) => m[1] + ' élément' + (+m[1] > 1 ? 's' : '') + (m[3] ? ' · ' + m[3] + ' utilisés' : '')],
    [/^(.+) of ~5 MB used$/, (m) => m[1] + ' sur ~5 Mo utilisés'], [/^(.+) of about 5 MB used$/, (m) => m[1] + ' sur environ 5 Mo utilisés'], [/^(.+) used of about 5 MB browser storage$/, (m) => m[1] + ' utilisés sur environ 5 Mo de stockage'],
    [/^(\d+) words · (\d+) characters(.*)$/, (m) => m[1] + ' mots · ' + m[2] + ' caractères' + m[3].replace(' min read', ' min de lecture')],
    [/^Welcome to PatOS, (.+)!$/, (m) => 'Bienvenue dans PatOS, ' + m[1] + '!'],
    [/^Double-click “Welcome to PatOS” on the desktop for tips\. Press Ctrl\+Space to search\.$/, () => 'Double-cliquez sur « Welcome to PatOS » sur le bureau pour des astuces. Ctrl+Espace pour rechercher.'],
    [/^Press Ctrl\+Space to search, Alt\+L for Launchpad\.$/, () => 'Ctrl+Espace pour rechercher, Alt+L pour le Launchpad.'],
    [/^(\d+) cards( · best (\d+)%)?$/, (m) => m[1] + ' cartes' + (m[2] ? ' · record ' + m[3] + ' %' : '')], [/^(\d+) of (\d+) correct$/, (m) => m[1] + ' sur ' + m[2] + ' bonnes réponses'],
    [/^(\d+) responses?$/, (m) => m[1] + ' réponse' + (+m[1] > 1 ? 's' : '')], [/^(\d+) questions$/, (m) => m[1] + ' questions'], [/^You scored (.+)$/, (m) => 'Votre note : ' + m[1]], [/^Average score: (.+)$/, (m) => 'Note moyenne : ' + m[1]],
    [/^Search Google for (.+)$/, (m) => 'Rechercher ' + m[1] + ' sur Google'], [/^Search the web for ([^“].*)$/, (m) => 'Rechercher ' + m[1] + ' sur le Web'], [/^Available \(three\.js r(\d+)\)$/, (m) => 'Disponible (three.js r' + m[1] + ')'], [/^(.+) can’t be shown inside PatOS$/, (m) => m[1] + ' ne peut pas s’afficher dans PatOS'], [/^New best: (\d+) WPM$/, (m) => 'Nouveau record : ' + m[1] + ' MPM'], [/^Search the web for “(.+)”$/, (m) => 'Rechercher « ' + m[1] + ' » sur le Web'],
    [/^Octave (\d+)$/, (m) => 'Octave ' + m[1]], [/^(\d+) left$/, (m) => m[1] + ' restant' + (+m[1] > 1 ? 's' : '')], [/^Lap (\d+)$/, (m) => 'Tour ' + m[1]],
    [/^(Document|Spreadsheet|Presentation|Form) · (.+)$/, (m) => t(m[1]) + ' · ' + m[2]], [/^([\d.,KMB]+) views( · (.+))?$/, (m) => m[1] + ' vues' + (m[3] ? ' · ' + ago(m[3]) : '')], [/^(\d+ \w+s? ago)$/, (m) => ago(m[1])],
    [/^Sum: (.+?)   Average: (.+?)   Count: (.+)$/, (m) => 'Somme : ' + m[1] + '   Moyenne : ' + m[2] + '   Nombre : ' + m[3]], [/^(\d+) filled$/, (m) => m[1] + ' remplies'],
    [/^\+(\d+) more$/, (m) => '+' + m[1] + ' autres'], [/^([+-]\d+) hrs$/, (m) => m[1] + ' h'], [/^H:(.+)  L:(.+)$/, (m) => 'Max. ' + m[1] + '  Min. ' + m[2]],
    [/^New event on (.+)$/, (m) => 'Nouvel événement le ' + m[1]], [/^Rename “(.+)”$/, (m) => 'Renommer « ' + m[1] + ' »'], [/^Delete “(.+)”\?$/, (m) => 'Supprimer « ' + m[1] + ' »?'],
    [/^(.+) — Edited$/, (m) => m[1] + ' — Modifié'], [/^Battery (\d+)%( \(charging\))?$/, (m) => 'Batterie ' + m[1] + ' %' + (m[2] ? ' (en charge)' : '')],
    [/^Connected · (.+)$/, (m) => 'Connecté · ' + m[1]], [/^Version (.+)$/, (m) => 'Version ' + m[1]], [/^(\d+) installed$/, (m) => m[1] + ' installées'], [/^(.+) used$/, (m) => m[1] + ' utilisés'],
    [/^(\d+) words$/, (m) => m[1] + ' mots']
  ];
  function ago(s) {
    const m = /^(\d+) (\w+?)s? ago$/.exec(s); if (!m) return s === 'just now' ? 'à l’instant' : s;
    const u = { year: 'an', month: 'mois', week: 'semaine', day: 'jour', hour: 'heure', minute: 'minute' }[m[2]] || m[2];
    return 'il y a ' + m[1] + ' ' + u + (+m[1] > 1 && u !== 'mois' ? 's' : '');
  }
  function t(s) {
    if (PatOS.lang !== 'fr' || s == null) return s;
    const k = String(s);
    if (FR[k] !== undefined) return FR[k];
    const trim = k.trim();
    if (trim !== k && FR[trim] !== undefined) return k.replace(trim, FR[trim]);
    if (trim.endsWith('…') && FR[trim.slice(0, -1)]) return FR[trim.slice(0, -1)] + '…';
    for (const [re, fn] of PATTERNS) { const m = re.exec(trim); if (m) return k.replace(trim, fn(m)); }
    return s;
  }
  PatOS.t = t;
  PatOS.tr = t;

  /* translate interface text as it appears */
  if (PatOS.lang !== 'fr') return;
  const SKIP = '.notes-ed, .te-area, textarea, .term, .cs-wrap, .msg-b, .sticky-ta, [contenteditable="true"], .no-tr, .doc-page, .sh-grid, .sl-el, .fd-nm, .di-name, .fd-rn, .ph-bar b, script, style, .mu-item b, .mu-tt, .mu-ar, .tr-out, .tr-hi, .dc-main, .yt-title, .yt-info, .yt-winfo, .yt-dtext, .yt-cm, .nt-item, .rm-txt, .fc-face, .fc-erow, .fm-ans, .dv-txt b, .as-txt b, .cal-ev, .cal-item b, .w-ev, .mw-ev, .vm-it b, .sp-res small';
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  function skip(el) { return el && el.closest && el.closest(SKIP); }
  function doText(node) {
    const v = node.nodeValue; if (!v || !/[A-Za-z]/.test(v)) return;
    const p = node.parentElement; if (!p || skip(p)) return;
    const out = t(v); if (out !== v) node.nodeValue = out;
  }
  function doEl(el) {
    const host = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el.parentElement : el;
    if (host && skip(host)) return;
    for (const a of ATTRS) { const v = el.getAttribute(a); if (v) { const o = t(v); if (o !== v) el.setAttribute(a, o); } }
  }
  function walk(root) {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1) return;
    if (skip(root)) { if (root.tagName === 'TEXTAREA' || root.tagName === 'INPUT') doEl(root); return; }
    doEl(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n; while ((n = tw.nextNode())) { if (n.nodeType === 3) doText(n); else doEl(n); }
  }
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') { if (m.target.nodeType === 1) { const v = m.target.getAttribute(m.attributeName); if (v) { const o = t(v); if (o !== v && !skip(/^(INPUT|TEXTAREA)$/.test(m.target.tagName) ? m.target.parentElement : m.target)) m.target.setAttribute(m.attributeName, o); } } }
      else m.addedNodes.forEach(walk);
    }
  });
  document.addEventListener('DOMContentLoaded', () => {
    walk(document.body);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  });
})();
