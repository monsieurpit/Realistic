/* PatOS Terms of Use and Privacy Policy, and the screen that asks everyone to accept them.
   - Shown over everything (boot, lock screen, setup) until accepted, to new people and to everyone updating. Accept only works
     after reading to the end and ticking "I have read and agree"; Decline explains that PatOS can't be used without it.
   - Acceptance is kept on this device (localStorage "patos-policy" = the version accepted; not a "patos:" key, which preload.js moves into the database and deletes). Changing VERSION asks
     everyone again.
   - Settings has a small "Privacy Policy & Terms" link at the bottom of its sidebar (js/apps/settings.js) that shows the text.
   This text was written to describe what PatOS really does. It is not legal advice: have a lawyer review it before relying on it. */
(function () {
  'use strict';
  const VERSION = '2026-11-09';
  const KEY = 'patos-policy';

  const EN = {
    title: 'Terms of Use and Privacy Policy',
    updated: 'Last updated: November 9, 2026',
    intro: 'Please read these terms carefully. By selecting “Accept”, you agree to them. If you do not agree, do not use PatOS.',
    sections: [
      ['1. What PatOS is', 'PatOS is a free, experimental desktop environment that runs in your web browser. It is not an operating system installed on your device, and it is provided as a hobby project, not as a commercial product or service. “We” and “us” mean the person or people who run PatOS. “You” means anyone who uses it.'],
      ['2. Acceptance and changes', 'By using PatOS you accept these Terms and this Privacy Policy. We may change them at any time. When we do, PatOS will ask you to accept the new version before you can continue. If you do not accept, you must stop using PatOS.'],
      ['3. Who may use PatOS', 'If you are under the age of majority where you live, you may use PatOS only with the permission and supervision of a parent or legal guardian, who accepts these Terms on your behalf. Do not create an account or share personal information if you are not allowed to.'],
      ['4. No warranty', 'PatOS is provided “AS IS” and “AS AVAILABLE”, with all faults and without any warranty of any kind, whether express, implied or legal, including any warranty of merchantability, quality, fitness for a particular purpose, accuracy, availability, security, or non-infringement. We do not promise that PatOS will work, keep working, be free of errors or harmful components, or that any feature, file, message, backup or account will be available, kept or recoverable.'],
      ['5. Limitation of liability', 'To the maximum extent permitted by applicable law, we will not be liable for any damage or loss of any kind arising from or related to PatOS or these Terms, including loss of data, files, documents, passwords, messages, backups, accounts, time, profits or opportunities; damage to devices; security incidents; or any direct, indirect, incidental, special, consequential, exemplary or punitive damages, even if we were told such damage was possible. If, despite this, we are found liable, our total liability for all claims together is limited to zero dollars (CAD $0), or, where the law does not allow that, to the smallest amount the law allows. You use PatOS entirely at your own risk.'],
      ['6. Your data is your responsibility', 'You are solely responsible for your files and data and for keeping your own backups outside PatOS. Data stored in a browser can be deleted at any time, for example by clearing browsing data, by the browser freeing space, by an update, by a bug, or by losing your device. There is no password reset: if you lose your PatOS password, Sync code or master password, your encrypted data cannot be recovered by anyone, including us.'],
      ['7. Acceptable use', 'You agree not to use PatOS to break any law; to infringe anyone’s rights; to harass, threaten or harm anyone; to share illegal, hateful or sexual content involving minors; to send spam; to attack, overload, probe or reverse-engineer the PatOS servers; or to get around its security. We may remove content, refuse apps submitted to the App Store, and suspend or delete accounts, rooms or data at any time, for any reason or no reason, without notice.'],
      ['8. Your content and apps', 'You keep the rights you have to what you create. You are solely responsible for what you create, store, share, send or publish with PatOS, including messages, files and apps. If you submit an app to the App Store, you confirm you have the right to share it and you allow us to review, store, display and distribute it to PatOS users. Apps made by others and content shared by others are not ours: we do not check, endorse or take responsibility for them. Only run apps and code you trust.'],
      ['9. Third-party websites and services', 'PatOS shows and connects to websites and services that we do not control, such as YouTube, Google services, news sites, radio streams and any website you open. Their own terms and privacy policies apply to them, and we are not responsible for their content, availability, accuracy or practices. Names of other companies and their products belong to their owners and are used only to refer to them; PatOS is not affiliated with, sponsored or endorsed by them.'],
      ['10. Indemnity', 'To the extent permitted by law, you agree to defend, indemnify and hold us harmless from any claim, damage, loss, cost or expense (including reasonable legal fees) arising from your use of PatOS, your content, or your breach of these Terms or of anyone’s rights.'],
      ['11. Ending', 'You may stop using PatOS at any time. We may change, suspend or stop PatOS, or any part of it, at any time without notice and without liability. Sections 4 to 10 and 13 continue to apply after you stop using PatOS.'],
      ['12. Privacy: what stays on your device', 'Your files, notes, settings, passwords and the rest of your PatOS data are stored in your browser on your device. We do not collect them, and we do not use analytics, advertising or tracking cookies. Passwords are encrypted on the device whenever the browser allows it.'],
      ['12.1 Privacy: what leaves your device', 'Some features send data to servers, and only when you use them: • Sync and PatDrop: your data is encrypted on your device before it is sent to the PatOS server, which stores only encrypted data, an account number derived from your code, times and sizes. • Accounts and Messages use Google Firebase. Your saved items are encrypted on your device with a key made from your password. Your username, your conversations and the messages you send are stored in Firebase so they can reach the people you talk to; they are protected by access rules but are not end-to-end encrypted. • The PatOS server, hosted by Railway, fetches YouTube, news and book information for you and checks whether websites can be shown inside Patoogle; like most servers, it and its host may log technical data such as IP addresses and request times. • Apps you submit to the App Store are stored on the PatOS server for review. • Weather (Open-Meteo), maps (OpenStreetMap), books (Project Gutenberg), the dictionary, radio stations, Python files (jsDelivr), YouTube videos and the websites you open in Patoogle receive requests directly from your browser, including your IP address, under their own privacy policies. • Hey Pat voice is off unless you turn it on; in Chrome, the browser sends what you say to Google’s speech service to turn it into text. • Location, camera and microphone are used only after your browser asks you and you allow it.'],
      ['12.2 Privacy: your choices', 'You can use PatOS without an account, Sync, PatDrop or Messages. You can delete your local data by erasing PatOS in Settings or by clearing your browser data, and you can delete your account in Settings. Contact us through the PatOS website for any privacy request; we will answer as required by the law that applies to you. We do not sell your personal information.'],
      ['13. Law and disputes', 'These Terms are governed by the laws of the Province of Quebec and the federal laws of Canada that apply there, without regard to conflict-of-law rules, and any dispute will be decided by the courts of the Province of Quebec. If any part of these Terms cannot be enforced, the rest remains in effect. Nothing in these Terms limits any right you have that the law says cannot be limited or excluded, including under consumer protection laws. These Terms are the entire agreement between you and us about PatOS.'],
    ],
    agree: 'I have read and agree to the Terms of Use and the Privacy Policy',
    accept: 'Accept', decline: 'Decline', scroll: 'Scroll to the end to continue',
    declined: 'PatOS can’t be used without accepting the Terms of Use and the Privacy Policy. You can close this tab, or read them again and accept.',
    readAgain: 'Read again', acceptedOn: 'You accepted this version on', link: 'Privacy Policy & Terms'
  };
  const FR = {
    title: 'Conditions d’utilisation et politique de confidentialité',
    updated: 'Dernière mise à jour : 9 novembre 2026',
    intro: 'Veuillez lire ces conditions attentivement. En choisissant « Accepter », vous les acceptez. Si vous ne les acceptez pas, n’utilisez pas PatOS.',
    sections: [
      ['1. Ce qu’est PatOS', 'PatOS est un environnement de bureau gratuit et expérimental qui fonctionne dans votre navigateur. Ce n’est pas un système d’exploitation installé sur votre appareil, et il est offert comme projet personnel, et non comme produit ou service commercial. « Nous » désigne la ou les personnes qui exploitent PatOS. « Vous » désigne toute personne qui l’utilise.'],
      ['2. Acceptation et modifications', 'En utilisant PatOS, vous acceptez ces conditions et cette politique de confidentialité. Nous pouvons les modifier en tout temps. Le cas échéant, PatOS vous demandera d’accepter la nouvelle version avant de continuer. Si vous ne l’acceptez pas, vous devez cesser d’utiliser PatOS.'],
      ['3. Qui peut utiliser PatOS', 'Si vous n’avez pas atteint l’âge de la majorité là où vous habitez, vous ne pouvez utiliser PatOS qu’avec la permission et sous la supervision d’un parent ou d’un tuteur légal, qui accepte ces conditions en votre nom. Ne créez pas de compte et ne communiquez pas de renseignements personnels si vous n’en avez pas la permission.'],
      ['4. Aucune garantie', 'PatOS est fourni « TEL QUEL » et « SELON SA DISPONIBILITÉ », avec tous ses défauts et sans aucune garantie de quelque nature que ce soit, expresse, implicite ou légale, notamment quant à la qualité marchande, la qualité, l’adaptation à un usage particulier, l’exactitude, la disponibilité, la sécurité ou l’absence de contrefaçon. Nous ne garantissons pas que PatOS fonctionnera, continuera de fonctionner ou sera exempt d’erreurs ou d’éléments nuisibles, ni qu’une fonction, un fichier, un message, une sauvegarde ou un compte sera disponible, conservé ou récupérable.'],
      ['5. Limitation de responsabilité', 'Dans toute la mesure permise par la loi applicable, nous ne serons responsables d’aucun dommage ou perte de quelque nature que ce soit découlant de PatOS ou de ces conditions, ou s’y rapportant, notamment la perte de données, de fichiers, de documents, de mots de passe, de messages, de sauvegardes, de comptes, de temps, de profits ou d’occasions ; les dommages aux appareils ; les incidents de sécurité ; ou tout dommage direct, indirect, accessoire, spécial, consécutif, exemplaire ou punitif, même si nous avions été avisés de la possibilité de tels dommages. Si, malgré ce qui précède, notre responsabilité est retenue, notre responsabilité totale pour l’ensemble des réclamations est limitée à zéro dollar (0 $ CA) ou, si la loi ne le permet pas, au plus petit montant permis par la loi. Vous utilisez PatOS entièrement à vos propres risques.'],
      ['6. Vos données sont votre responsabilité', 'Vous êtes seul responsable de vos fichiers et de vos données et de la conservation de vos propres sauvegardes en dehors de PatOS. Les données stockées dans un navigateur peuvent être supprimées en tout temps, par exemple en effaçant les données de navigation, lorsque le navigateur libère de l’espace, lors d’une mise à jour, à cause d’un bogue ou si vous perdez votre appareil. Il n’y a pas de réinitialisation du mot de passe : si vous perdez votre mot de passe PatOS, votre code de synchronisation ou votre mot de passe principal, vos données chiffrées ne peuvent être récupérées par personne, y compris nous.'],
      ['7. Utilisation acceptable', 'Vous acceptez de ne pas utiliser PatOS pour enfreindre une loi ; porter atteinte aux droits d’autrui ; harceler, menacer ou blesser qui que ce soit ; partager du contenu illégal, haineux ou sexuel impliquant des mineurs ; envoyer des pourriels ; attaquer, surcharger, sonder ou faire de l’ingénierie inverse sur les serveurs de PatOS ; ou contourner sa sécurité. Nous pouvons retirer du contenu, refuser des apps soumises à l’App Store et suspendre ou supprimer des comptes, des salons ou des données en tout temps, pour quelque raison que ce soit ou sans raison, sans préavis.'],
      ['8. Votre contenu et vos apps', 'Vous conservez les droits que vous avez sur ce que vous créez. Vous êtes seul responsable de ce que vous créez, stockez, partagez, envoyez ou publiez avec PatOS, y compris les messages, les fichiers et les apps. Si vous soumettez une app à l’App Store, vous confirmez avoir le droit de la partager et vous nous permettez de l’examiner, de la stocker, de l’afficher et de la distribuer aux utilisateurs de PatOS. Les apps créées par d’autres et le contenu partagé par d’autres ne nous appartiennent pas : nous ne les vérifions pas, ne les cautionnons pas et n’en assumons pas la responsabilité. N’exécutez que des apps et du code en qui vous avez confiance.'],
      ['9. Sites et services de tiers', 'PatOS affiche des sites et des services que nous ne contrôlons pas et s’y connecte, comme YouTube, des services Google, des sites de nouvelles, des stations de radio et tout site que vous ouvrez. Leurs propres conditions et politiques de confidentialité s’appliquent, et nous ne sommes pas responsables de leur contenu, de leur disponibilité, de leur exactitude ou de leurs pratiques. Les noms d’autres entreprises et de leurs produits appartiennent à leurs propriétaires et ne servent qu’à les désigner ; PatOS n’est ni affilié à elles, ni commandité ou approuvé par elles.'],
      ['10. Indemnisation', 'Dans la mesure permise par la loi, vous acceptez de nous défendre, de nous indemniser et de nous tenir indemnes de toute réclamation, de tout dommage, de toute perte, de tout coût ou de toute dépense (y compris des honoraires juridiques raisonnables) découlant de votre utilisation de PatOS, de votre contenu ou de votre violation de ces conditions ou des droits d’autrui.'],
      ['11. Fin', 'Vous pouvez cesser d’utiliser PatOS en tout temps. Nous pouvons modifier, suspendre ou arrêter PatOS, en tout ou en partie, en tout temps, sans préavis et sans responsabilité. Les sections 4 à 10 et 13 continuent de s’appliquer après que vous avez cessé d’utiliser PatOS.'],
      ['12. Confidentialité : ce qui reste sur votre appareil', 'Vos fichiers, notes, réglages, mots de passe et autres données PatOS sont stockés dans votre navigateur, sur votre appareil. Nous ne les recueillons pas, et nous n’utilisons ni outils d’analyse, ni publicité, ni témoins de suivi. Les mots de passe sont chiffrés sur l’appareil chaque fois que le navigateur le permet.'],
      ['12.1 Confidentialité : ce qui quitte votre appareil', 'Certaines fonctions envoient des données à des serveurs, et seulement lorsque vous les utilisez : • Synchronisation et PatDrop : vos données sont chiffrées sur votre appareil avant d’être envoyées au serveur PatOS, qui ne conserve que des données chiffrées, un numéro de compte dérivé de votre code, des heures et des tailles. • Les comptes et Messages utilisent Google Firebase. Vos éléments sauvegardés sont chiffrés sur votre appareil avec une clé tirée de votre mot de passe. Votre nom d’utilisateur, vos conversations et les messages que vous envoyez sont stockés dans Firebase afin de parvenir aux personnes avec qui vous parlez ; ils sont protégés par des règles d’accès, mais ne sont pas chiffrés de bout en bout. • Le serveur PatOS, hébergé par Railway, récupère pour vous des renseignements de YouTube, de nouvelles et de livres, et vérifie si des sites peuvent s’afficher dans Patoogle ; comme la plupart des serveurs, lui et son hébergeur peuvent consigner des données techniques comme les adresses IP et les heures des requêtes. • Les apps que vous soumettez à l’App Store sont stockées sur le serveur PatOS pour examen. • La météo (Open-Meteo), les cartes (OpenStreetMap), les livres (Projet Gutenberg), le dictionnaire, les stations de radio, les fichiers Python (jsDelivr), les vidéos YouTube et les sites que vous ouvrez dans Patoogle reçoivent des requêtes directement de votre navigateur, y compris votre adresse IP, selon leurs propres politiques de confidentialité. • La voix « Salut Pat » est désactivée à moins que vous ne l’activiez ; dans Chrome, le navigateur envoie ce que vous dites au service vocal de Google pour le transformer en texte. • La position, la caméra et le micro ne sont utilisés qu’après que votre navigateur vous l’a demandé et que vous l’avez permis.'],
      ['12.2 Confidentialité : vos choix', 'Vous pouvez utiliser PatOS sans compte, sans synchronisation, sans PatDrop et sans Messages. Vous pouvez supprimer vos données locales en effaçant PatOS dans les Réglages ou en effaçant les données de votre navigateur, et vous pouvez supprimer votre compte dans les Réglages. Communiquez avec nous par le site de PatOS pour toute demande relative à la confidentialité ; nous y répondrons conformément à la loi qui s’applique à vous. Nous ne vendons pas vos renseignements personnels.'],
      ['13. Droit applicable et différends', 'Ces conditions sont régies par les lois de la province de Québec et les lois fédérales du Canada qui s’y appliquent, sans égard aux règles de conflit de lois, et tout différend sera tranché par les tribunaux de la province de Québec. Si une partie de ces conditions ne peut être appliquée, le reste demeure en vigueur. Rien dans ces conditions ne limite un droit que la loi vous reconnaît et qui ne peut être limité ou exclu, notamment en vertu des lois sur la protection du consommateur. Ces conditions constituent l’entente complète entre vous et nous au sujet de PatOS.'],
    ],
    agree: 'J’ai lu et j’accepte les conditions d’utilisation et la politique de confidentialité',
    accept: 'Accepter', decline: 'Refuser', scroll: 'Faites défiler jusqu’à la fin pour continuer',
    declined: 'PatOS ne peut pas être utilisé sans accepter les conditions d’utilisation et la politique de confidentialité. Vous pouvez fermer cet onglet, ou les relire et les accepter.',
    readAgain: 'Relire', acceptedOn: 'Vous avez accepté cette version le', link: 'Confidentialité et conditions'
  };
  const L = () => (PatOS.lang === 'fr' ? FR : EN);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const accepted = () => { const v = read(); return !!(v && (v === VERSION || v.version === VERSION)); };

  /* the text, as HTML (used by the gate and by Settings) */
  function html() {
    const t = L();
    return `<h1>${esc(t.title)}</h1><p class="lg-upd">${esc(t.updated)}</p><p class="lg-intro">${esc(t.intro)}</p>` +
      t.sections.map(([h, b]) => `<h2>${esc(h)}</h2>` + esc(b).split(' • ').map((part, i) => (i ? `<p class="lg-li">${part}</p>` : `<p>${part}</p>`)).join('')).join('');
  }

  /* the gate: over everything, until accepted */
  function gate() {
    if (accepted() || document.getElementById('legal-gate')) return;
    const t = L();
    const g = document.createElement('div');
    g.id = 'legal-gate'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); g.setAttribute('aria-labelledby', 'legal-title');
    g.innerHTML = `<div class="lg-card"><div class="lg-text" tabindex="0">${html().replace('<h1>', '<h1 id="legal-title">')}</div>` +
      `<div class="lg-foot"><label class="lg-check"><input type="checkbox" disabled> <span>${esc(t.agree)}</span></label>` +
      `<div class="lg-hint">${esc(t.scroll)}</div><div class="lg-btns"><button class="lg-decline" type="button">${esc(t.decline)}</button>` +
      `<button class="lg-accept" type="button" disabled>${esc(t.accept)}</button></div></div></div>`;
    document.body.appendChild(g);
    const text = g.querySelector('.lg-text'), box = g.querySelector('.lg-check input'), ok = g.querySelector('.lg-accept'), hint = g.querySelector('.lg-hint');
    const atEnd = () => text.scrollTop + text.clientHeight >= text.scrollHeight - 24;
    const check = () => { if (atEnd()) { box.disabled = false; hint.style.visibility = 'hidden'; } ok.disabled = !(box.checked && !box.disabled); };
    text.addEventListener('scroll', check, { passive: true }); box.addEventListener('change', check); setTimeout(check, 50);
    ok.onclick = () => {
      if (ok.disabled) return;
      localStorage.setItem(KEY, JSON.stringify({ version: VERSION, at: Date.now() }));
      g.classList.add('lg-out'); setTimeout(() => g.remove(), 260);
    };
    g.querySelector('.lg-decline').onclick = () => {
      const card = g.querySelector('.lg-card');
      card.innerHTML = `<div class="lg-declined"><h1>${esc(t.title)}</h1><p>${esc(t.declined)}</p><button class="lg-accept" type="button">${esc(t.readAgain)}</button></div>`;
      card.querySelector('button').onclick = () => { g.remove(); gate(); };
    };
    // nothing behind the gate can be reached with the keyboard either: keys never reach PatOS's shortcuts (Spotlight, Terminal...)
    g.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key !== 'Tab') return;
      const f = Array.from(g.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex="0"]')); if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
    setTimeout(() => text.focus(), 60);
  }

  // keys pressed while the gate is up, outside it (it has focus moved away), are dropped before any PatOS shortcut sees them
  window.addEventListener('keydown', (e) => {
    const g = document.getElementById('legal-gate');
    if (g && !g.contains(e.target)) { e.stopImmediatePropagation(); e.preventDefault(); const t = g.querySelector('.lg-text, button'); t && t.focus(); }
  }, true);

  PatOS.legal = {
    VERSION, html, accepted, gate, strings: L,
    acceptedAt() { const v = read(); return v && v.at ? new Date(v.at) : null; }
  };
  if (document.body) gate(); else document.addEventListener('DOMContentLoaded', gate);
})();
