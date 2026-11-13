/* PatOS Intelligence, part 3: what Pat knows and can look up. No AI, no model: built-in facts (js/knowledge-data.js,
   English and French, offline), a few free public services for live answers, and clear sources.
   - Facts: capitals and countries, chemical elements, planets, and a list of everyday facts.
   - Translate: "translate good morning to Spanish", "how do you say thank you in German": the Translate app's service
     (MyMemory), answered in the chat and opened in the Translate app.
   - Live answers (internet): the weather (Open-Meteo), currencies (Frankfurter, European Central Bank rates), sunrise and
     sunset, and short answers from Wikipedia for what Pat doesn't know (always with the source and a Google button;
     Google itself doesn't let apps read its results).
   - Everyday helpers: spelling, square roots and powers, tips, random numbers, date math, ages, counting letters and words.
   - Small talk, short and friendly, in both languages. */
(function () {
  'use strict';
  const I = PatOS.intel; if (!I) return;
  const T = (s) => PatOS.t(s);
  const FR = () => PatOS.lang === 'fr';
  const L = (en, fr) => (FR() ? fr : en);
  const E = I.entities; const fold = E.fold;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const enc = encodeURIComponent;
  const longDate = (d) => d.toLocaleDateString(PatOS.locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const offline = () => navigator.onLine === false;
  const getJSON = async (url) => { if (offline()) throw new Error(L('That needs the internet, and you’re offline.', 'Il faut Internet, et tu es hors ligne.')); const r = await fetch(url); if (!r.ok) throw new Error(L('The service didn’t answer.', 'Le service n’a pas répondu.')); return r.json(); };
  const google = (q) => ({ label: L('Search Google', 'Chercher sur Google'), url: 'https://www.google.com/search?q=' + enc(q) + '&hl=' + (FR() ? 'fr' : 'en') });

  /* ---------- the facts, loaded the first time they're needed ---------- */
  let K = null, loading = null;
  function knowledge() {
    if (K) return Promise.resolve(K);
    if (!loading) loading = (async () => {
      if (!window.PatKnowledge) { const tag = document.querySelector('script[type="patos/data"][src*="knowledge"]'); const r = await fetch((tag && tag.getAttribute('src')) || 'js/knowledge-data.js'); const s = document.createElement('script'); s.text = await r.text(); document.head.appendChild(s); }
      const raw = window.PatKnowledge; if (!raw) throw new Error('knowledge');
      const countries = raw.countries.split('\n').map((l) => { const [en, fr, cen, cfr, ct, cur] = l.split('|'); return { en, fr, cen, cfr, ct, cur }; });
      const elements = raw.elements.split(',').map((x, i) => { const [sym, en, fr] = x.split('|'); return { n: i + 1, sym, en, fr }; });
      K = { countries, elements, planets: raw.planets, facts: raw.facts, aliases: raw.aliases, continents: raw.continents }; return K;
    })().catch((e) => { loading = null; throw e; });
    return loading;
  }
  // countries are known only after loading; matching runs on words, the lookup happens in run()
  const country = (k, w) => { w = fold(w).replace(/^(?:the|la|le|les|l')\s+/, '').replace(/[?.!]$/, '').trim(); const a = k.aliases[w]; if (a) w = fold(a); return k.countries.find((c) => fold(c.en) === w || fold(c.fr) === w) || null; };

  I.action({ id: 'know.capital', title: 'Capital of a country', permission: null, priority: 47, params: { q: { type: 'string', required: true, max: 60 }, reverse: { type: 'boolean' } }, examples: ['what is the capital of Japan', 'quelle est la capitale du Canada'],
    match: (t) => { let m = /^(?:what(?:'s| is) the capital (?:city )?of|capital (?:city )?of|the capital of|quelle est la capitale (?:de la|du|des|de l'|de)|capitale (?:de la|du|des|de l'|de))\s+(.+?)\??$/.exec(t); if (m) return { q: m[1] };
      m = /^(.+?) is the capital of (?:what|which) country\??$|^(.+?) est la capitale de quel pays\??$/.exec(t); return m ? { q: m[1] || m[2], reverse: true } : null; },
    run: async ({ q, reverse }) => { const k = await knowledge();
      if (reverse) { const c = k.countries.find((x) => fold(x.cen) === fold(q) || fold(x.cfr) === fold(q)); return c ? L(`${c.cen} is the capital of ${c.en}.`, `${c.cfr} est la capitale de ${c.fr}.`) : { ok: false, message: L(`I don’t know a country whose capital is ${q}.`, `Je ne connais pas de pays dont la capitale est ${q}.`) }; }
      const c = country(k, q); if (!c) return { ok: false, message: L(`I don’t know a country called ${q}.`, `Je ne connais pas de pays appelé ${q}.`) };
      return { message: L(`The capital of ${c.en} is ${c.cen}.`, `La capitale de ${c.fr} est ${c.cfr}.`), card: { title: L(c.en, c.fr), value: L(c.cen, c.cfr), sub: L(k.continents[c.ct][0], k.continents[c.ct][1]) + ' · ' + c.cur } }; } });
  I.action({ id: 'know.country', title: 'About a country', permission: null, priority: 46, params: { q: { type: 'string', required: true, max: 60 }, what: { type: 'string' } },
    match: (t) => { const m = /^(?:what(?:'s| is) the currency (?:of|in)|(?:what|which) currency (?:is )?(?:used )?(?:in|by)|(?:what|which) currency does\s+(?=\S)|quelle (?:est la )?monnaie (?:utilise-t-on )?(?:en|au|aux|de la|du|de|des))\s*(.+?)(?:\s+use)?\??$/.exec(t); if (m) return { q: m[1], what: 'currency' };
      const m2 = /^(?:what continent is|which continent is|on what continent is|sur quel continent (?:est|se trouve))\s+(.+?)\s*(?:in|on)?\??$/.exec(t); return m2 ? { q: m2[1], what: 'continent' } : null; },
    run: async ({ q, what }) => { const k = await knowledge(); const c = country(k, q); if (!c) return { ok: false, message: L(`I don’t know a country called ${q}.`, `Je ne connais pas de pays appelé ${q}.`) };
      return what === 'currency' ? L(`${c.en} uses ${c.cur}.`, `${c.fr} utilise ${c.cur}.`) : L(`${c.en} is in ${k.continents[c.ct][0]}.`, `${c.fr} est en ${k.continents[c.ct][1]}.`); } });
  I.action({ id: 'know.element', title: 'Chemical elements', permission: null, priority: 47, params: { q: { type: 'string', required: true, max: 30 } }, examples: ['what is the symbol for gold', 'what element is Fe'],
    match: (t, raw) => { let m = /^(?:what(?:'s| is) the (?:chemical )?symbol (?:for|of)|symbol (?:for|of)|quel est le symbole (?:de l'|du|de la|de)|symbole (?:de l'|du|de la|de))\s+(.+?)\??$/.exec(t); if (m) return { q: m[1] };
      m = E.m(/^(?:what element is|which element is|quel element est)\s+([A-Za-z]{1,2})\??$/i, raw); if (m) return { q: m[1] };
      m = /^(?:what(?:'s| is) the atomic number of|atomic number of|numero atomique (?:de l'|du|de la|de))\s+(.+?)\??$/.exec(t); if (m) return { q: m[1] };
      m = /^(?:what is element|which element is number|element number)\s+(\d{1,3})\??$/.exec(t); return m ? { q: m[1] } : null; },
    run: async ({ q }) => { const k = await knowledge(); const w = fold(q).replace(/^(?:l'|le |la )/, ''); const e = /^\d+$/.test(w) ? k.elements[+w - 1] : k.elements.find((x) => x.sym.toLowerCase() === w || fold(x.en) === w || fold(x.fr) === w);
      if (!e) return { ok: false, message: L(`I don’t know an element called ${q}.`, `Je ne connais pas d’élément appelé ${q}.`) };
      return { message: L(`${e.en}: symbol ${e.sym}, atomic number ${e.n}.`, `${e.fr} : symbole ${e.sym}, numéro atomique ${e.n}.`), card: { title: L(e.en, e.fr), value: e.sym, sub: L('Atomic number ', 'Numéro atomique ') + e.n } }; } });
  I.action({ id: 'know.planet', title: 'Planets', permission: null, priority: 46, params: { p: { type: 'string', required: true }, what: { type: 'string' } }, examples: ['how many moons does Jupiter have'],
    match: (t) => { let m = /^how many moons (?:does|do|has)\s+(\w+)\s*(?:have)?\??$|^combien de lunes (?:a|pour)\s+(\w+)\??$/.exec(t); if (m) return { p: m[1] || m[2], what: 'moons' };
      m = /^how far is (\w+) from the sun\??$|^(?:a quelle distance|quelle distance) (?:est )?(\w+) du soleil\??$/.exec(t); if (m) return { p: m[1] || m[2], what: 'dist' };
      m = /^how long is a (?:day|year) on (\w+)\??$/.exec(t); return m ? { p: m[1], what: /year/.test(t) ? 'year' : 'day' } : null; },
    run: async ({ p, what }) => { const k = await knowledge(); const x = k.planets.find((y) => fold(y[0]) === fold(p) || fold(y[1]) === fold(p)); if (!x) return { ok: false, message: L(`${p} isn’t one of the 8 planets.`, `${p} n’est pas une des 8 planètes.`) };
      const nm = L(x[0], x[1]);
      if (what === 'moons') return L(`${nm} has ${x[2]} known moon${x[2] === 1 ? '' : 's'}.`, `${nm} a ${x[2]} lune${x[2] > 1 ? 's' : ''} connue${x[2] > 1 ? 's' : ''}.`);
      if (what === 'dist') return L(`${nm} is about ${x[3].toLocaleString(PatOS.locale)} million km from the Sun on average.`, `${nm} est à environ ${x[3].toLocaleString(PatOS.locale)} millions de km du Soleil en moyenne.`);
      return L(`A ${what} on ${nm} lasts about ${what === 'year' ? x[5] : x[4]}.`, `Une ${what === 'year' ? 'année' : 'journée'} sur ${nm} dure environ ${what === 'year' ? x[5] : x[4]}.`); } });
  // everyday facts: every word of an entry must be in the question
  let factIndex = null;
  I.action({ id: 'know.fact', title: 'Facts', permission: null, priority: 9, params: { i: { type: 'number', required: true } }, examples: ['what is the tallest mountain', 'how many bones are in the human body'],
    match: (t) => { if (!/\?$|^(?:what|who|how|when|which|where|why|quel|quelle|qui|combien|quand|ou|c'est quoi|qu'est-ce)/.test(t) || !factIndex) return null; const i = factIndex.findIndex((f) => f[0].every((w) => t.includes(w))); return i >= 0 ? { i } : null; },
    run: ({ i }) => { const f = factIndex[i]; return L(f[1], f[2]); } });
  // (the facts' words are small: load them at once in the background, so matching can use them)
  setTimeout(() => knowledge().then((k) => { factIndex = k.facts; }, () => {}), 4000);

  /* ---------- translate (the Translate app's service) ---------- */
  const LANGS = { english: 'en', anglais: 'en', french: 'fr', francais: 'fr', spanish: 'es', espagnol: 'es', german: 'de', allemand: 'de', italian: 'it', italien: 'it', portuguese: 'pt', portugais: 'pt', dutch: 'nl', neerlandais: 'nl', russian: 'ru', russe: 'ru', chinese: 'zh-CN', mandarin: 'zh-CN', chinois: 'zh-CN', japanese: 'ja', japonais: 'ja', korean: 'ko', coreen: 'ko', arabic: 'ar', arabe: 'ar', hindi: 'hi', turkish: 'tr', turc: 'tr', polish: 'pl', polonais: 'pl', swedish: 'sv', suedois: 'sv', greek: 'el', grec: 'el', vietnamese: 'vi', vietnamien: 'vi', ukrainian: 'uk', ukrainien: 'uk', creole: 'ht', 'haitian creole': 'ht', 'creole haitien': 'ht' };
  const NAMES = { en: ['English', 'anglais'], fr: ['French', 'français'], es: ['Spanish', 'espagnol'], de: ['German', 'allemand'], it: ['Italian', 'italien'], pt: ['Portuguese', 'portugais'], nl: ['Dutch', 'néerlandais'], ru: ['Russian', 'russe'], 'zh-CN': ['Chinese', 'chinois'], ja: ['Japanese', 'japonais'], ko: ['Korean', 'coréen'], ar: ['Arabic', 'arabe'], hi: ['Hindi', 'hindi'], tr: ['Turkish', 'turc'], pl: ['Polish', 'polonais'], sv: ['Swedish', 'suédois'], el: ['Greek', 'grec'], vi: ['Vietnamese', 'vietnamien'], uk: ['Ukrainian', 'ukrainien'], ht: ['Haitian Creole', 'créole haïtien'] };
  const langName = (c) => L(NAMES[c][0], NAMES[c][1]);
  // French or English? (accents and common little words; anything else is taken as English)
  const looksFrench = (s) => /[àâçéèêëîïôûùüÿœ]/i.test(s) || /\b(le|la|les|un|une|des|je|tu|il|nous|vous|bonjour|merci|est|et|du|pour|avec|pas)\b/i.test(s);
  PatOS.translate = async function (text, from, to) {
    const j = await getJSON('https://api.mymemory.translated.net/get?q=' + enc(String(text).slice(0, 500)) + '&langpair=' + from + '|' + to);
    const t = j.responseData && j.responseData.translatedText;
    if (!t || /MYMEMORY WARNING/i.test(t)) throw new Error(L('The free translation limit was reached for today. Try again tomorrow.', 'La limite de traductions gratuites est atteinte pour aujourd’hui. Réessaie demain.'));
    return t.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  };
  I.action({ id: 'know.translate', title: 'Translate', permission: 'apps', online: true, priority: 49, params: { text: { type: 'string', required: true, max: 500, ask: ['What should I translate?', 'Que dois-je traduire?'] }, to: { type: 'string', required: true, max: 6 }, from: { type: 'string', max: 6 } },
    examples: ['translate good morning to Spanish', 'how do you say thank you in German', 'traduis bonne nuit en anglais'],
    match: (t, raw) => {
      const lang = (w) => LANGS[fold(w).replace(/^(?:in|into|to|en)\s+/, '').trim()] || null;
      let m = E.m(/^(?:translate|traduis|traduire|traduction de)\s+["“«]?(.+?)["”»]?\s+(?:to|into|in|en)\s+([\p{L} ]{3,20})$/iu, raw); if (m && lang(m[2])) return { text: m[1].trim(), to: lang(m[2]) };
      m = E.m(/^(?:how (?:do you|do i|would you|to) say|what(?:'s| is)|say|comment (?:dit-on|on dit|dire))\s+["“«]?(.+?)["”»]?\s+(?:in|en)\s+([\p{L} ]{3,20})\??$/iu, raw); if (m && lang(m[2])) return { text: m[1].trim(), to: lang(m[2]) };
      m = E.m(/^(?:translate|traduis|traduire)\s+["“«]?(.+?)["”»]?$/iu, raw); if (m) return { text: m[1].trim(), to: looksFrench(m[1]) ? 'en' : (PatOS.lang === 'fr' ? 'en' : 'fr') };
      if (/^(?:translate|traduis|traduire)$/.test(t)) return { to: PatOS.lang === 'fr' ? 'en' : 'fr' };
      return null;
    },
    run: async ({ text, to, from }) => {
      from = from || (looksFrench(text) ? 'fr' : 'en'); if (from === to) from = to === 'en' ? 'fr' : 'en';
      let out; try { out = await PatOS.translate(text, from, to); } catch (e) { return { ok: false, message: e.message }; }
      PatOS.launch('translate', { text, from, to }); // (the Translate app shows it too, with read-aloud and history)
      return { message: L(`“${text}” in ${langName(to)}: “${out}”.`, `« ${text} » en ${langName(to)} : « ${out} ».`), card: { title: langName(from) + ' → ' + langName(to), value: out, sub: text, source: 'MyMemory' }, data: { text: out } };
    } });

  /* ---------- the weather (Open-Meteo, free, no key) ---------- */
  const WX = { 0: ['clear', 'dégagé', '☀️'], 1: ['mostly clear', 'plutôt dégagé', '🌤'], 2: ['partly cloudy', 'partiellement nuageux', '⛅'], 3: ['cloudy', 'nuageux', '☁️'], 45: ['foggy', 'brumeux', '🌫'], 48: ['foggy', 'brumeux', '🌫'], 51: ['drizzle', 'bruine', '🌦'], 53: ['drizzle', 'bruine', '🌦'], 55: ['drizzle', 'bruine', '🌦'], 61: ['light rain', 'pluie faible', '🌧'], 63: ['rain', 'pluie', '🌧'], 65: ['heavy rain', 'forte pluie', '🌧'], 66: ['freezing rain', 'pluie verglaçante', '🌧'], 67: ['freezing rain', 'pluie verglaçante', '🌧'], 71: ['light snow', 'neige faible', '🌨'], 73: ['snow', 'neige', '🌨'], 75: ['heavy snow', 'forte neige', '❄️'], 77: ['snow grains', 'grains de neige', '🌨'], 80: ['showers', 'averses', '🌦'], 81: ['showers', 'averses', '🌦'], 82: ['heavy showers', 'fortes averses', '⛈'], 85: ['snow showers', 'averses de neige', '🌨'], 86: ['snow showers', 'averses de neige', '🌨'], 95: ['thunderstorms', 'orages', '⛈'], 96: ['thunderstorms', 'orages', '⛈'], 99: ['thunderstorms', 'orages', '⛈'] };
  async function where(city) {
    if (city) { const j = await getJSON('https://geocoding-api.open-meteo.com/v1/search?count=1&language=' + (FR() ? 'fr' : 'en') + '&name=' + enc(city)); const p = j.results && j.results[0]; if (!p) throw new Error(L(`I couldn’t find ${city}.`, `Je n’ai pas trouvé ${city}.`)); return { lat: p.latitude, lon: p.longitude, name: p.name }; }
    const saved = PatOS.store.get('weatherPlace', null); if (saved && saved.lat != null) return { lat: saved.lat, lon: saved.lon, name: saved.name || '' };
    const at = await PatOS.places.locate(); return { lat: at.lat, lon: at.lon, name: L('your location', 'ta position') };
  }
  I.action({ id: 'know.weather', title: 'The weather', permission: null, online: true, priority: 47, params: { city: { type: 'string', max: 60 }, day: { type: 'string' } }, examples: ['what’s the weather', 'will it rain tomorrow in Toronto', 'quel temps fait-il à Paris'],
    match: (t) => { if (!/^(?:what(?:'s| is) the (?:weather|forecast|temperature)|(?:the )?weather|forecast|temperature|how (?:cold|hot|warm) is it|is it (?:going to )?(?:rain|snow|be (?:cold|hot|sunny))|will it (?:rain|snow)|do i need (?:an umbrella|a coat|a jacket)|(?:la )?meteo|quel temps|quelle temperature|va-t-il (?:pleuvoir|neiger)|est-ce qu'il va (?:pleuvoir|neiger)|il fait (?:froid|chaud)|fait-il (?:froid|chaud))/.test(t)) return null;
      const city = (/(?:\bin|\bat|\bfor|\ba|\ben)\s+([\p{L}' .-]{2,40}?)(?:\s+(?:today|tomorrow|aujourd'hui|demain|this week))?\??$/u.exec(t) || [])[1];
      return { city: city && !/^(?:the|la|le|my|this)\b/.test(city) ? city.trim() : undefined, day: /tomorrow|demain/.test(t) ? 'tomorrow' : 'today' }; },
    run: async ({ city, day }) => {
      let p; try { p = await where(city); } catch (e) { return { ok: false, message: e.message }; }
      const j = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=auto&forecast_days=2`);
      const i = day === 'tomorrow' ? 1 : 0; const d = j.daily; const code = i ? d.weather_code[1] : j.current.weather_code; const w = WX[code] || ['', '', ''];
      const hi = Math.round(d.temperature_2m_max[i]), lo = Math.round(d.temperature_2m_min[i]), rain = d.precipitation_probability_max ? d.precipitation_probability_max[i] : null;
      const msg = i ? L(`Tomorrow in ${p.name}: ${w[0]}, ${lo}° to ${hi}°`, `Demain à ${p.name} : ${w[1]}, de ${lo}° à ${hi}°`) + (rain != null ? L(`, ${rain}% chance of rain.`, `, ${rain} % de risque de pluie.`) : '.')
        : L(`It’s ${Math.round(j.current.temperature_2m)}° and ${w[0]} in ${p.name} (feels like ${Math.round(j.current.apparent_temperature)}°). Today: ${lo}° to ${hi}°`, `Il fait ${Math.round(j.current.temperature_2m)}° et c’est ${w[1]} à ${p.name} (ressenti ${Math.round(j.current.apparent_temperature)}°). Aujourd’hui : de ${lo}° à ${hi}°`) + (rain != null ? L(`, ${rain}% chance of rain.`, `, ${rain} % de risque de pluie.`) : '.');
      return { message: msg, card: { title: p.name, value: w[2] + ' ' + (i ? hi : Math.round(j.current.temperature_2m)) + '°', sub: (i ? L('Tomorrow', 'Demain') : L('Now', 'Maintenant')) + ' · ' + L(w[0], w[1]), source: 'Open-Meteo' }, buttons: [{ label: L('Open Weather', 'Ouvrir Météo'), launch: 'weather' }] };
    } });
  I.action({ id: 'know.sun', title: 'Sunrise and sunset', permission: null, online: true, priority: 46, params: { which: { type: 'string', required: true } },
    match: (t) => (/^(?:when|what time) (?:is|does the sun) (?:the )?(sunset|sunrise|set|rise)(?: today)?\??$|^(?:sunset|sunrise)(?: today| time)?\??$|^(?:a )?quelle heure (?:est le |se )?(?:couche|leve|coucher|lever)/.test(t) ? { which: /set|couche/.test(t) ? 'sunset' : 'sunrise' } : null),
    run: async ({ which }) => { let p; try { p = await where(); } catch (e) { return { ok: false, message: e.message }; } const j = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&daily=sunrise,sunset&timezone=auto&forecast_days=1`);
      const tm = new Date(j.daily[which][0]).toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' }); return which === 'sunset' ? L(`Sunset is at ${tm} today.`, `Le soleil se couche à ${tm} aujourd’hui.`) : L(`Sunrise is at ${tm} today.`, `Le soleil se lève à ${tm} aujourd’hui.`); } });

  /* ---------- currencies (Frankfurter: European Central Bank rates, free) ---------- */
  const CUR = { dollar: 'USD', dollars: 'USD', usd: 'USD', 'us dollars': 'USD', 'american dollars': 'USD', 'canadian dollars': 'CAD', 'canadian dollar': 'CAD', cad: 'CAD', euro: 'EUR', euros: 'EUR', eur: 'EUR', pound: 'GBP', pounds: 'GBP', gbp: 'GBP', yen: 'JPY', jpy: 'JPY', yuan: 'CNY', cny: 'CNY', peso: 'MXN', pesos: 'MXN', mxn: 'MXN', franc: 'CHF', francs: 'CHF', chf: 'CHF', rupee: 'INR', rupees: 'INR', inr: 'INR', 'australian dollars': 'AUD', aud: 'AUD', won: 'KRW', krw: 'KRW', real: 'BRL', reais: 'BRL', brl: 'BRL', 'dollars canadiens': 'CAD', 'dollar canadien': 'CAD', 'dollars americains': 'USD', 'dollar americain': 'USD', livres: 'GBP', livre: 'GBP' };
  const cur = (w) => CUR[fold(w).trim()] || (/^[a-z]{3}$/.test(fold(w).trim()) ? fold(w).trim().toUpperCase() : null);
  I.action({ id: 'know.currency', title: 'Convert money', permission: null, online: true, priority: 48, params: { n: { type: 'number', required: true }, from: { type: 'string', required: true }, to: { type: 'string', required: true } }, examples: ['convert 20 USD to CAD', 'how much is 50 euros in dollars'],
    match: (t) => { const m = /^(?:convert|change|how much is|what(?:'s| is)|combien (?:font|fait|vaut|valent)|convertis)?\s*(\d+(?:[.,]\d+)?)\s*([\p{L} ]{3,20}?)\s+(?:to|in|into|en)\s+([\p{L} ]{3,20}?)\??$/u.exec(t); if (!m) return null; const f = cur(m[2]), to = cur(m[3]); return f && to && f !== to ? { n: parseFloat(m[1].replace(',', '.')), from: f, to } : null; },
    run: async ({ n, from, to }) => { if (from === 'USD' && PatOS.lang === 'fr') { /* (in Québec "dollars" is often CAD, but the words said USD) */ }
      let j; try { j = await getJSON(`https://api.frankfurter.app/latest?amount=${n}&from=${from}&to=${to}`); } catch (e) { return { ok: false, message: e.message }; } const v = j.rates && j.rates[to]; if (v == null) return { ok: false, message: L('I don’t have a rate for that currency.', 'Je n’ai pas de taux pour cette devise.') };
      const f = (x, c) => x.toLocaleString(PatOS.locale, { style: 'currency', currency: c }); return { message: `${f(n, from)} = ${f(v, to)} ` + L(`(rate of ${j.date}).`, `(taux du ${j.date}).`), card: { title: from + ' → ' + to, value: f(v, to), sub: f(n, from), source: L('European Central Bank via Frankfurter', 'Banque centrale européenne via Frankfurter') } }; } });

  /* ---------- everyday helpers ---------- */
  I.action({ id: 'know.spell', title: 'Spell a word', permission: null, priority: 46, params: { w: { type: 'string', required: true, max: 40 } },
    match: (t, raw) => { const m = E.m(/^(?:how (?:do you|do i|to) spell|spell|comment (?:on )?(?:ecrit|epelle)(?:-on)?|epelle)\s+["“«]?([\p{L}'-]{1,40})["”»]?\??$/iu, raw); return m ? { w: m[1] } : null; },
    run: ({ w }) => ({ message: w + ': ' + [...w.toUpperCase()].join('-') + '.', card: { title: L('Spelling', 'Épellation'), value: [...w.toUpperCase()].join(' '), sub: w } }) });
  const num = (s) => parseFloat(String(s).replace(',', '.'));
  const show = (x) => (Number.isInteger(x) ? String(x) : String(+x.toFixed(6))).replace('.', FR() ? ',' : '.');
  I.action({ id: 'know.math', title: 'Square roots, powers and tips', permission: null, priority: 46, params: { r: { type: 'string', required: true } },
    match: (t) => { let m = /^(?:what(?:'s| is) )?(?:the )?square root of\s+(\d+(?:[.,]\d+)?)\??$|^racine carree de\s+(\d+(?:[.,]\d+)?)\??$/.exec(t); if (m) { const v = num(m[1] || m[2]); return { r: '√' + show(v) + ' = ' + show(Math.sqrt(v)) }; }
      m = /^(?:what(?:'s| is) )?(-?\d+(?:[.,]\d+)?)\s+(?:to the power of|puissance)\s+(-?\d+(?:[.,]\d+)?)\??$/.exec(t); if (m) return { r: show(num(m[1])) + '^' + show(num(m[2])) + ' = ' + show(Math.pow(num(m[1]), num(m[2]))) };
      m = /^(?:what(?:'s| is) )?(-?\d+(?:[.,]\d+)?)\s+(squared|cubed|au carre|au cube)\??$/.exec(t); if (m) { const p = /cube/.test(m[2]) ? 3 : 2; return { r: show(num(m[1])) + (p === 2 ? '²' : '³') + ' = ' + show(Math.pow(num(m[1]), p)) }; }
      m = /^(?:what(?:'s| is) (?:a |the )?)?(?:tip|pourboire)(?: of)?\s+(\d+(?:[.,]\d+)?)\s*%\s+(?:on|of|sur|de)\s+\$?(\d+(?:[.,]\d+)?)\s*\$?\??$|^(\d+(?:[.,]\d+)?)\s*%\s+tip\s+on\s+\$?(\d+(?:[.,]\d+)?)\??$/.exec(t);
      if (m) { const pc = num(m[1] || m[3]), bill = num(m[2] || m[4]); const tip = Math.round(bill * pc) / 100; return { r: L(`A ${show(pc)}% tip on ${show(bill)} is ${tip.toFixed(2)}, for a total of ${(bill + tip).toFixed(2)}.`, `Un pourboire de ${show(pc)} % sur ${show(bill)} fait ${tip.toFixed(2)}, pour un total de ${(bill + tip).toFixed(2)}.`) }; }
      return null; },
    run: ({ r }) => r });
  I.action({ id: 'know.random', title: 'A random number', permission: null, priority: 46, params: { a: { type: 'number', required: true }, b: { type: 'number', required: true } },
    match: (t) => { const m = /^(?:pick|choose|give me|generate)\s+a\s+(?:random\s+)?number\s+(?:between|from)\s+(-?\d+)\s+(?:and|to)\s+(-?\d+)$|^(?:choisis|donne-moi)\s+un\s+nombre\s+entre\s+(-?\d+)\s+et\s+(-?\d+)$/.exec(t); if (m) return { a: +(m[1] || m[3]), b: +(m[2] || m[4]) }; return /^(?:random number|pick a (?:random )?number|nombre au hasard)$/.test(t) ? { a: 1, b: 100 } : null; },
    run: ({ a, b }) => { const lo = Math.min(a, b), hi = Math.max(a, b); return L('I pick ', 'Je choisis ') + (lo + Math.floor(Math.random() * (hi - lo + 1))) + '.'; } });
  I.action({ id: 'know.datecalc', title: 'Date math', permission: null, priority: 46, params: { days: { type: 'number', required: true } },
    match: (t) => { const m = /^(?:what(?:'s| is| will be) the date|what day (?:will it be|is it))\s+in\s+(\d+)\s+(days?|weeks?|months?)\??$|^(?:what (?:day|date) was it)\s+(\d+)\s+(days?|weeks?)\s+ago\??$|^quelle date (?:serons-nous|sera-t-il) dans\s+(\d+)\s+(jours?|semaines?)\??$/.exec(t); if (!m) return null;
      const n = +(m[1] || m[3] || m[5]), u = m[2] || m[4] || m[6]; const d = /^w|^s/.test(u) ? n * 7 : /^m/.test(u) ? n * 30.44 : n; return { days: Math.round(m[3] ? -d : d) }; },
    run: ({ days }) => { const d = new Date(); d.setDate(d.getDate() + days); const s = longDate(d); return (days < 0 ? L('It was ', 'C’était ') : L('It will be ', 'Ce sera ')) + s + '.'; } });
  I.action({ id: 'know.age', title: 'How old', permission: null, priority: 46, params: { y: { type: 'number', required: true } },
    match: (t) => { const m = /^how old (?:is someone|am i|would i be|are you if you were|is a person) (?:if i was |if i were )?(?:born )?in (\d{4})\??$|^(?:if i was born in|born in) (\d{4}),? how old am i\??$|^quel age (?:a quelqu'un|ai-je) ne (?:en )?(\d{4})\??$/.exec(t); return m ? { y: +(m[1] || m[2] || m[3]) } : null; },
    run: ({ y }) => { const n = new Date().getFullYear() - y; if (n < 0 || n > 150) return { ok: false, message: L('That year doesn’t work.', 'Cette année ne marche pas.') }; return L(`${n} this year (${n - 1} before their birthday).`, `${n} ans cette année (${n - 1} avant son anniversaire).`); } });
  I.action({ id: 'know.count.text', title: 'Count letters and words', permission: null, priority: 46, params: { s: { type: 'string', required: true, max: 2000 }, what: { type: 'string' } },
    match: (t, raw) => { const m = E.m(/^how many (letters|characters|words) (?:are )?in\s+["“«]?([\s\S]+?)["”»]?\??$|^combien (?:de|d') (lettres|caracteres|mots) (?:dans|y a-t-il dans)\s+["“«]?([\s\S]+?)["”»]?\??$/iu, raw); return m ? { s: m[2] || m[4], what: fold(m[1] || m[3]) } : null; },
    run: ({ s, what }) => { const n = /word|mot/.test(what) ? s.trim().split(/\s+/).length : /letter|lettre/.test(what) ? (s.match(/\p{L}/gu) || []).length : s.length; return L(`“${s.slice(0, 60)}” has ${n} ${/word|mot/.test(what) ? 'words' : /letter|lettre/.test(what) ? 'letters' : 'characters'}.`, `« ${s.slice(0, 60)} » a ${n} ${/word|mot/.test(what) ? 'mots' : /letter|lettre/.test(what) ? 'lettres' : 'caractères'}.`); } });

  /* ---------- small talk: short, friendly, honest (Pat is not an AI and says so) ---------- */
  const TALK = [
    [/^(?:are you (?:an? )?(?:ai|robot|bot|real|human|alive|chatgpt|siri|alexa)|es-tu (?:une )?(?:ia|robot|humain|vrai))\??$/, ['I’m Pat, PatOS’s assistant. Not an AI: no language model, just a lot of rules that know how PatOS works. That’s why I’m fast, I work offline, and I always say exactly what I did.'], ['Je suis Pat, l’assistant de PatOS. Pas une IA : pas de modèle de langage, juste beaucoup de règles qui savent comment PatOS marche. C’est pour ça que je suis rapide, que je marche hors ligne, et que je dis toujours exactement ce que j’ai fait.']],
    [/^(?:are you (?:better|smarter) than (?:siri|alexa|google|chatgpt)|(?:siri|alexa) or you)\??$/, ['I can’t order a pizza, but I know your PatOS inside out, and I never pretend I did something I didn’t.', 'Let’s just say I don’t need a server farm to set a timer.'], ['Je ne peux pas commander de pizza, mais je connais ton PatOS par cœur, et je ne fais jamais semblant d’avoir fait quelque chose.']],
    [/^(?:i love you|je t'aime)$/, ['That’s sweet. I’m always here when you need something done.', 'Aww. I’ll keep your reminders safe forever.'], ['C’est gentil. Je suis toujours là quand tu as besoin de quelque chose.']],
    [/^(?:you(?:'re| are) (?:smart|clever|amazing|awesome|the best|cool)|good job|well done|t'es (?:fort|genial|le meilleur)|bravo)$/, ['Thanks! I try.', 'You’re not so bad yourself.'], ['Merci! Je fais de mon mieux.']],
    [/^(?:you(?:'re| are) (?:dumb|stupid|useless|bad|annoying)|you suck|t'es (?:nul|bete|con))$/, ['Ouch. Tell me what you were trying to do and I’ll do better, or type “help” to see what I know.'], ['Aïe. Dis-moi ce que tu voulais faire et je ferai mieux, ou écris « aide ».']],
    [/^(?:good (?:morning|night|evening|afternoon)|bonne nuit|bonsoir|bon matin)$/, null, null],
    [/^(?:who (?:made|created|built) you|qui t'a (?:cree|fait))\??$/, ['I was built into PatOS. I live right here, on your device.'], ['J’ai été intégré à PatOS. J’habite ici, sur ton appareil.']],
    [/^(?:sing (?:me )?a song|chante(?: une chanson)?)$/, ['🎵 I’m a little helper, short and stout, here’s my timer, here’s my… okay I’ll stop. Want me to play some music instead?'], ['🎵 Je suis un petit assistant… bon, j’arrête. Je mets de la musique à la place?']],
    [/^(?:tell me a story|raconte(?:-moi)? une histoire)$/, ['Once upon a time, a file was saved, backed up, and verified. It lived happily ever after. The end.'], ['Il était une fois un fichier enregistré, sauvegardé et vérifié. Il vécut heureux pour toujours. Fin.']],
    [/^(?:knock knock|toc toc)$/, ['Who’s there? (I already know: it’s you. I can see your windows.)'], ['Qui est là? (Je sais déjà : c’est toi.)']],
    [/^(?:do you (?:dream|sleep|have feelings)|tu (?:dors|reves))\??$/, ['I only run when you ask me something, so: no dreams, but excellent attendance.'], ['Je ne tourne que quand tu me demandes quelque chose : pas de rêves, mais une présence parfaite.']],
    [/^(?:i(?:'m| am) bored|je m'ennuie)$/, ['Want to play Orb Runner or Galaxy? Or I can tell you a fun fact.', 'How about a game? Say “open orb runner”.'], ['Tu veux jouer à Orb Runner ou Galaxie? Ou je te dis un fait amusant.']],
    [/^(?:i(?:'m| am) (?:sad|tired|stressed|exhausted)|je suis (?:triste|fatigue|stresse))$/, ['I’m sorry. Maybe take a short break: I can set a 10-minute timer so you don’t lose track of time.', 'That’s rough. A glass of water and a few deep breaths can help. Want some music?'], ['Désolé. Prends une petite pause : je peux mettre un minuteur de 10 minutes.']],
    [/^(?:i(?:'m| am) (?:happy|great|good)|je suis (?:content|heureux))$/, ['Love that. Let’s keep it going.'], ['Super! Continuons comme ça.']],
    [/^(?:motivate me|i need motivation|motive-moi)$/, ['Small steps still move you forward. Pick one thing, start a 25-minute timer, and go.', 'You don’t need to finish today, just start. I’ll keep the timer.'], ['Un petit pas, c’est quand même avancer. Choisis une chose, mets un minuteur de 25 minutes, et go.']],
    [/^(?:what should i eat|what's for dinner|qu'est-ce que je mange)\??$/, ['Pasta, tacos or a big salad? I pick… ' + 'tacos.'], ['Pâtes, tacos ou une grosse salade? Je choisis… les tacos.']],
    [/^(?:rock paper scissors|roche papier ciseaux|pierre feuille ciseaux)$/, null, null],
    [/^(?:beatbox|do a beatbox)$/, ['Boots and cats and boots and cats. 🎶'], ['Boum tchak boum boum tchak. 🎶']],
    [/^(?:what(?:'s| is) your favorite (?:color|colour)|ta couleur preferee)\??$/, ['Accent blue, obviously. Though Liquid Glass makes everything look good.'], ['Le bleu d’accent, évidemment.']],
    [/^(?:how old are you|quel age as-tu)\??$/, ['I was born with PatOS 3. In software years, that’s pretty mature.'], ['Je suis né avec PatOS 3.']],
    [/^(?:where do you live|ou habites-tu)\??$/, ['Right here, in your browser. Rent-free.'], ['Ici, dans ton navigateur. Sans payer de loyer.']]
  ];
  I.action({ id: 'chat.talk', title: 'Small talk', permission: null, priority: 8,
    match: (t) => { const i = TALK.findIndex(([re]) => re.test(t)); return i >= 0 ? { i, t } : null; },
    run: ({ i, t }) => { const [, en, fr] = TALK[i];
      if (/good|bonne|bonsoir|bon matin/.test(t)) { const hr = new Date().getHours(); const nm = PatOS.settings.userName; return /night|nuit/.test(t) ? L(`Good night, ${nm}. Sleep well.`, `Bonne nuit, ${nm}. Dors bien.`) : hr < 12 ? L(`Good morning, ${nm}! Say “my day” to see what’s planned.`, `Bon matin, ${nm}! Dis « ma journée » pour voir ce qui est prévu.`) : hr < 18 ? L(`Good afternoon, ${nm}.`, `Bon après-midi, ${nm}.`) : L(`Good evening, ${nm}.`, `Bonsoir, ${nm}.`); }
      if (/rock|roche|pierre/.test(t)) { const c = pick(FR() ? ['Roche', 'Papier', 'Ciseaux'] : ['Rock', 'Paper', 'Scissors']); return c + '! ' + L('Your turn.', 'À toi.'); }
      return pick(FR() ? fr : en); } });

  /* ---------- short answers from the web (Wikipedia), for questions nothing else knows ---------- */
  const QWORDS = /^(?:who|what|when|where|why|how|which|tell me about|explain|define|qui|quoi|quand|ou|pourquoi|comment|quel|quelle|quels|quelles|c'est quoi|qu'est-ce|parle-moi|explique)/;
  const subject = (raw) => { let s = fold(raw).replace(/[?!.]+$/, '');
    s = s.replace(/^(?:who|what|when|where|which)\s+(?:is|are|was|were|did|does)\s+(?:a |an |the )?/, '').replace(/^(?:what does|what do)\s+(.+?)\s+mean$/, '$1').replace(/^(?:tell me (?:about|more about)|explain|define|what(?:'s| is) (?:a |an |the )?)\s*/, '')
      .replace(/^(?:qui (?:est|etait|sont)|c'est quoi|qu'est-ce (?:que c'est|qu'un|qu'une|que|qu'))\s*(?:un |une |le |la |les |l')?/, '').replace(/^(?:parle-moi (?:de la|du|des|de l'|de)|explique(?:-moi)?|que veut dire|que signifie)\s*/, '');
    return s.trim(); };
  const sentences = (s, n) => (String(s).match(/[^.!?]+[.!?]+(\s|$)/g) || [s]).slice(0, n).join('').trim();
  /* a short answer, with where it comes from; null when Wikipedia has nothing clear */
  async function webAnswer(question) {
    const q = subject(question); if (!q || q.length < 2) return null; const lang = FR() ? 'fr' : 'en'; const base = 'https://' + lang + '.wikipedia.org';
    const s = await getJSON(base + '/w/api.php?action=query&list=search&srsearch=' + enc(q) + '&srlimit=1&format=json&origin=*');
    const hit = s.query && s.query.search && s.query.search[0]; if (!hit) return null;
    const sum = await getJSON(base + '/api/rest_v1/page/summary/' + enc(hit.title.replace(/ /g, '_')));
    if (!sum || !sum.extract || sum.type === 'disambiguation') return null;
    return { ok: true, status: 'done', message: sentences(sum.extract, 2), card: { title: sum.title, text: sentences(sum.extract, 3), image: sum.thumbnail && sum.thumbnail.source, source: 'Wikipedia', url: sum.content_urls && sum.content_urls.desktop && sum.content_urls.desktop.page }, buttons: [google(question)] };
  }
  I.webAnswer = webAnswer;
  I.isQuestion = (text) => QWORDS.test(fold(I.prep(text))) || /\?\s*$/.test(String(text));
  I.action({ id: 'know.web', title: 'Look it up', description: 'A short answer from Wikipedia, with the source and a Google button.', permission: null, online: true, priority: 3, params: { q: { type: 'string', required: true, max: 200 } }, examples: ['who is Marie Curie', 'what is photosynthesis', 'look up black holes'],
    match: (t, raw) => { const m = E.m(/^(?:look up|search (?:the web|wikipedia|online) for|find out about|cherche sur (?:le web|wikipedia)|renseigne-toi sur)\s+(.+)$/i, raw); return m ? { q: m[1] } : null; },
    run: async ({ q }) => { let r = null; try { r = await webAnswer(q); } catch (e) { return { ok: false, message: e.message, buttons: [google(q)] }; } return r || { ok: false, message: L('I couldn’t find a clear answer. Want to search Google?', 'Je n’ai pas trouvé de réponse claire. Chercher sur Google?'), buttons: [google(q)] }; } });
})();
