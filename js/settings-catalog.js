/* What Settings contains, loaded at start-up so Spotlight, PatOS Intelligence and Settings' own search all use one list
   (before 3.2 it lived inside the Settings app, so Spotlight found no settings until Settings had been opened once).
   - settingsPages: each page [key, name, icon "symbol|color"]
   - settingsCategories: the sidebar, in order: [key, name, icon, [pages]]
   - settingsCatalog: individual settings, each with the words that find it; Settings opens right on it (args.find) */
(function () {
  'use strict';
  const PANES = [
    ['general', 'General', 'gear|#8e8e93'], ['account', 'Account', 'person|#0a84ff'], ['voice', 'Pat Voice', 'mic|#ff375f'], ['update', 'Software Update', 'download|#5e5ce6'], ['appearance', 'Appearance', 'contrast|#48484a'], ['accessibility', 'Accessibility', 'access|#0a84ff'], ['wallpaper', 'Wallpaper', 'image|#30b0c7'], ['dock', 'Home Screen & Dock', 'dock|#5e5ce6'],
    ['display', 'Displays & 3D', 'display|#0a84ff'], ['sound', 'Sound', 'speaker|#ff375f'], ['lock', 'Lock Screen', 'lock|#ff9f0a'], ['network', 'Network', 'wifi|#0a84ff'], ['startup', 'Install & Start Up', 'rocket|#ff6a3d'], ['permissions', 'Permissions', 'shield|#30d158'], ['system', 'This Device', 'laptop|#8e8e93'],
    ['legal', 'Privacy Policy & Terms', 'doc|#8e8e93'], ['keyboard', 'Keyboard', 'keyboard|#8e8e93'], ['storage', 'Storage', 'storage|#8e8e93'], ['backup', 'Backup & Restore', 'history|#30d158'], ['sync', 'Sync', 'cloud|#5ac8fa'], ['privacy', 'Privacy', 'hand|#0a84ff'], ['me', 'Account Info', 'person|#0a84ff']
  ];
  // the sidebar: the categories of an operating system's settings, each with its pages
  const CATS = [
    ['general', 'General', 'gear|#8e8e93', ['general', 'update', 'startup', 'keyboard', 'legal']],
    ['looks', 'Appearance', 'palette|#bf5af2', ['appearance', 'wallpaper']],
    ['desk', 'Desktop & Multitasking', 'window|#5e5ce6', ['dock']],
    ['apps', 'Applications', 'grid|#ff9f0a', ['apps']],
    ['notif', 'Notifications', 'bell|#ff453a', ['notifications']],
    ['sound', 'Sound', 'speaker|#ff375f', ['sound']],
    ['display', 'Display', 'display|#0a84ff', ['display']],
    ['safe', 'Privacy & Security', 'hand|#30d158', ['privacy', 'permissions', 'lock']],
    ['net', 'Internet & Connectivity', 'wifi|#0a84ff', ['network']],
    ['cont', 'Account & Continuity', 'cloud|#5ac8fa', ['account', 'sync']],
    ['storage', 'Storage', 'storage|#8e8e93', ['storage']],
    ['backup', 'Backup & Restore', 'history|#30d158', ['backup']],
    ['intel', 'Pat & Intelligence', 'sparkle|#bf5af2', ['intelligence', 'voice']],
    ['access', 'Accessibility', 'access|#0a84ff', ['accessibility']],
    ['system', 'System', 'laptop|#8e8e93', ['system', 'diagnostics']]
  ];
  PANES.push(['apps', 'Applications', 'grid|#ff9f0a'], ['notifications', 'Notifications', 'bell|#ff453a'], ['intelligence', 'PatOS Intelligence', 'sparkle|#bf5af2'], ['diagnostics', 'Diagnostics', 'chart|#30d158']);
  const KW = {
    apps: 'apps applications installed uninstall remove manage versions app storage permissions applications installees desinstaller gerer', notifications: 'notifications alerts banners do not disturb focus sounds history notification alertes ne pas deranger historique', intelligence: 'intelligence pat commands actions workspaces automation shortcuts history permissions commandes espaces de travail', diagnostics: 'diagnostics health errors logs report problems system health check integrity sante erreurs journal rapport verification', legal: 'privacy policy terms conditions legal law confidentialite politique conditions utilisation juridique', me: 'me user computer device info about name account profile utilisateur ordinateur appareil informations profil', voice: 'voice hey pat microphone speech listen talk say wake voix micro parler ecouter', account: 'account username password sign in sign up cloud save login compte nom utilisateur mot de passe connexion creer', privacy: 'privacy apps permissions camera microphone location log timeline clipboard history activity confidentialite applications permissions camera micro position journal historique presse-papiers activite', sync: 'sync cloud devices iphone chromebook account encrypted key code synchroniser appareils compte chiffre cle', backup: 'backup restore snapshot export import sauvegarde restaurer copie folder dossier recover recuperer data safe', update: 'update mise à jour version new nouveau what changed nouveautés restart redémarrer', general: 'name language langue layout disposition full screen plein écran clock horloge seconds secondes 24', appearance: 'dark sombre light clair theme thème color couleur glass verre transparency transparence motion animations', wallpaper: 'background fond écran 3d picture image photo', dock: 'dock icons icônes size taille grow hide masquer widgets home accueil apps', display: 'brightness luminosité 3d quality qualité graphics graphismes webgl', sound: 'volume sounds sons chime son', lock: 'password mot de passe lock verrouiller', network: 'wifi internet connection connexion', keyboard: 'shortcuts raccourcis keys touches alt', storage: 'backup sauvegarde erase effacer trash corbeille reset restore restaurer space espace', accessibility: 'contrast bold text motion focus screen reader lecteur écran accessibilité', permissions: 'camera microphone location notifications permissions', startup: 'install installer app application startup démarrage shelf étagère pin épingler files fichiers open with ouvrir avec full screen plein écran', system: 'device battery memory processor system appareil batterie mémoire' };
  PatOS.settingsPages = PANES; PatOS.settingsCategories = CATS; PatOS.settingsKeywords = KW;
  PatOS.settingsIndex = () => PANES.map(([k, l]) => ({ pane: k, label: l, keywords: KW[k] || '' }));
  const CATALOG = [
    { key: 'theme', type: 'enum', values: ['dark', 'light', 'auto'], pane: 'appearance', label: 'Appearance', words: 'appearance theme dark mode light mode night mode automatic apparence theme mode sombre mode clair mode nuit' },
    { key: 'reduceMotion', type: 'bool', pane: 'accessibility', label: 'Reduce motion', words: 'reduce motion animations movement reduire les animations mouvement' },
    { key: 'highContrast', type: 'bool', pane: 'accessibility', label: 'High contrast', words: 'high contrast increase contrast contraste eleve augmenter le contraste' },
    { key: 'boldText', type: 'bool', pane: 'accessibility', label: 'Bold text', words: 'bold text texte en gras gras' },
    { key: 'showFocus', type: 'bool', pane: 'accessibility', label: 'Always show focus', words: 'focus ring keyboard focus outline contour du focus clavier' },
    { key: 'bigTargets', type: 'bool', pane: 'accessibility', label: 'Larger click targets', words: 'bigger buttons larger targets touch targets grandes cibles gros boutons' },
    { key: 'reduceTransparency', type: 'bool', pane: 'accessibility', label: 'Reduce transparency', words: 'reduce transparency see-through glass reduire la transparence' },
    { key: 'uiSounds', type: 'bool', pane: 'sound', label: 'Sound effects', words: 'sound effects ui sounds clicks effets sonores sons' },
    { key: 'volume', type: 'percent', pane: 'sound', label: 'Volume', words: 'volume sound level loudness son niveau' },
    { key: 'brightness', type: 'percent', min: 30, pane: 'display', label: 'Brightness', words: 'brightness screen brightness luminosite' },
    { key: 'liquidGlass', type: 'bool', pane: 'appearance', label: 'Liquid Glass', words: 'liquid glass verre liquide' },
    { key: 'showWidgets', type: 'bool', pane: 'dock', label: 'Desktop widgets', words: 'widgets desktop widgets widgets du bureau' },
    { key: 'dockAutohide', type: 'bool', pane: 'dock', label: 'Hide the Dock automatically', words: 'hide dock autohide dock masquer le dock automatiquement' },
    { key: 'magnify', type: 'bool', pane: 'dock', label: 'Dock magnification', words: 'magnification dock zoom grossissement' },
    { key: 'clock24', type: 'bool', pane: 'general', label: '24-hour clock', words: '24 hour clock 24h time format horloge 24 heures' },
    { key: 'showSeconds', type: 'bool', pane: 'general', label: 'Show seconds', words: 'show seconds clock seconds afficher les secondes' },
    { key: 'timeline', type: 'bool', pane: 'privacy', label: 'Timeline', words: 'timeline activity history memory historique activite' },
    { key: 'handoff', type: 'bool', pane: 'sync', label: 'Handoff', words: 'handoff continuity continue on other devices continuite' },
    { key: 'reopenWindows', type: 'bool', pane: 'general', label: 'Reopen windows', words: 'reopen windows restore windows rouvrir les fenetres' },
    { key: 'systemNotifications', type: 'bool', pane: 'notifications', label: 'Notifications in other tabs', words: 'browser notifications system notifications notifications du navigateur' }
  ];
  PatOS.settingsCatalog = CATALOG;
})();
