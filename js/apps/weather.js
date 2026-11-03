/* Weather — live forecast from Open-Meteo (no key needed).
   Search with suggestions, saved cities, a one-line summary ("Rain expected around 3 PM"), the next 24 hours
   (also as a chart), a 10-day forecast, and details: feels like, humidity, wind and gusts, UV, air quality,
   pressure, visibility, rain today, sunrise and sunset. °F also switches wind, rain and pressure to
   mph, inches and inHg. Refreshes itself every 15 minutes and keeps the last forecast for when you are offline. */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const LOC = () => (PatOS.lang === 'fr' ? 'fr-CA' : undefined);
  const CODES = {
    0: ['Clear Sky', 'sunny', 'clear'], 1: ['Mostly Clear', 'sunny', 'clear'], 2: ['Partly Cloudy', 'partly', 'cloud'], 3: ['Cloudy', 'cloudy', 'cloud'],
    45: ['Fog', 'fog', 'fog'], 48: ['Fog', 'fog', 'fog'], 51: ['Drizzle', 'rain', 'rain'], 53: ['Drizzle', 'rain', 'rain'], 55: ['Drizzle', 'rain', 'rain'],
    61: ['Light Rain', 'rain', 'rain'], 63: ['Rain', 'rain', 'rain'], 65: ['Heavy Rain', 'rain', 'rain'], 66: ['Freezing Rain', 'rain', 'rain'], 67: ['Freezing Rain', 'rain', 'rain'],
    71: ['Light Snow', 'snow', 'snow'], 73: ['Snow', 'snow', 'snow'], 75: ['Heavy Snow', 'snow', 'snow'], 77: ['Snow Grains', 'snow', 'snow'],
    80: ['Showers', 'rain', 'rain'], 81: ['Showers', 'rain', 'rain'], 82: ['Heavy Showers', 'rain', 'rain'], 85: ['Snow Showers', 'snow', 'snow'], 86: ['Snow Showers', 'snow', 'snow'],
    95: ['Thunderstorm', 'storm', 'storm'], 96: ['Thunderstorm', 'storm', 'storm'], 99: ['Thunderstorm', 'storm', 'storm']
  };
  const code = (c) => CODES[c] || ['—', 'cloud', 'cloud'];
  const BG = { clear: 'linear-gradient(180deg,#2f80ed,#56ccf2)', cloud: 'linear-gradient(180deg,#5a6f8a,#93a5bd)', fog: 'linear-gradient(180deg,#7d8a99,#b7c0ca)', rain: 'linear-gradient(180deg,#24384f,#4b6584)', snow: 'linear-gradient(180deg,#6d8bb3,#b8cbe3)', storm: 'linear-gradient(180deg,#1b1f2e,#3d4559)', night: 'linear-gradient(180deg,#0b1026,#1d2b53)' };
  const icon = (name, cls) => h('span', { class: 'wx-i ' + (cls || '') + ' wx-i-' + name, html: PatOS.sym(name), 'aria-hidden': 'true' });
  const REFRESH = '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>';
  const COMPASS = { en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], fr: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] };

  PatOS.registerApp({
    id: 'weather', name: 'Weather', icon: 'weather', width: 780, height: 600, titlebar: 'hidden', keywords: 'forecast rain temperature météo température neige snow wind',
    about: 'Live forecast with a 10-day outlook, saved cities, air quality, and a summary of what the next hours bring.',
    launch(win) {
      let place = PatOS.store.get('weatherPlace', { name: 'Montréal', lat: 45.5019, lon: -73.5674 });
      let unit = PatOS.store.get('weatherUnit', 'C');
      const fx = h('canvas', { class: 'wx-fx' });
      const content = h('div', { class: 'wx' });
      win.body.classList.add('wx-body');
      win.body.append(fx, content);
      let raf = 0, mode = 'clear', req = 0, lastOK = 0, lastData = null;
      const imperial = () => unit === 'F';
      const deg = (c) => Math.round(imperial() ? c * 9 / 5 + 32 : c) + '°';
      const speed = (v) => Math.round(imperial() ? v * 0.621371 : v) + (imperial() ? ' mph' : ' km/h');
      const rainAmt = (mm) => (imperial() ? (mm / 25.4).toFixed(2) + ' in' : (mm >= 10 ? Math.round(mm) : mm.toFixed(1)) + ' mm');
      const fmtT = (iso, mins) => new Date(iso).toLocaleTimeString(LOC(), mins === false ? { hour: 'numeric' } : { hour: 'numeric', minute: '2-digit' });

      const search = h('input', { class: 'wx-search', placeholder: T('Search for a city'), spellcheck: 'false', 'aria-label': T('Search for a city'), autocomplete: 'off' });
      const sug = h('div', { class: 'wx-sug hidden', role: 'listbox' });
      const bUnit = h('button', { class: 'wx-unit', title: T('Change units'), 'aria-label': T('Change units') });
      const bLoc = h('button', { class: 'wx-unit', title: T('Use my location'), 'aria-label': T('Use my location'), html: PatOS.sym('pin') });
      const bRef = h('button', { class: 'wx-unit', title: T('Refresh'), 'aria-label': T('Refresh'), html: REFRESH });
      const bList = h('button', { class: 'wx-unit', title: T('Saved cities'), 'aria-label': T('Saved cities'), html: PatOS.sym('apps') });
      const top = h('div', { class: 'wx-top' }, bList, h('div', { class: 'wx-sw' }, search, sug), bLoc, bRef, bUnit);
      const main = h('div', { class: 'wx-main' }, h('div', { class: 'wx-loading' }, T('Loading weather…')));
      const placesEl = h('div', { class: 'wx-places hidden' });
      content.append(top, placesEl, main);
      let places = PatOS.store.get('weatherPlaces', null) || [place];
      const savePlaces = () => PatOS.store.set('weatherPlaces', places);
      const same = (a, b) => Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01;
      const ck = (p) => p.lat.toFixed(2) + ',' + p.lon.toFixed(2);
      const URL_ = (p) => `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,is_day&hourly=temperature_2m,weather_code,precipitation_probability,is_day,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=10`;

      /* ---------- saved cities ---------- */
      async function renderPlaces() {
        placesEl.innerHTML = '';
        places.forEach((pl) => {
          const temp = h('b', {}, '…'), cond = h('small', {}, '');
          const card = h('div', { class: 'wx-pcard' + (same(pl, place) ? ' on' : ''), tabindex: '0', role: 'button' }, h('div', {}, h('span', { class: 'wx-pname' }, pl.name === 'My Location' ? T('My Location') : pl.name), cond), temp,
            places.length > 1 ? h('button', { class: 'wx-px', title: T('Remove'), 'aria-label': T('Remove') + ' ' + pl.name, onclick: (e) => { e.stopPropagation(); places = places.filter((x) => x !== pl); savePlaces(); if (same(pl, place)) { place = places[0]; PatOS.store.set('weatherPlace', place); load(); } renderPlaces(); } }, '×') : null);
          const pick = () => { place = pl; PatOS.store.set('weatherPlace', place); placesEl.classList.add('hidden'); load(); };
          card.onclick = pick; card.onkeydown = (e) => { if (e.key === 'Enter') pick(); };
          placesEl.appendChild(card);
          const cached = (PatOS.store.get('wxCache', {})[ck(pl)] || {}).j;
          if (cached && PatOS.isOffline()) { temp.textContent = deg(cached.current.temperature_2m); cond.textContent = T(code(cached.current.weather_code)[0]); return; }
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pl.lat}&longitude=${pl.lon}&current=temperature_2m,weather_code&timezone=auto`).then((r) => r.json()).then((j) => { temp.textContent = deg(j.current.temperature_2m); cond.textContent = T(code(j.current.weather_code)[0]); }).catch(() => { if (cached) { temp.textContent = deg(cached.current.temperature_2m); cond.textContent = T(code(cached.current.weather_code)[0]); } });
        });
        placesEl.appendChild(h('div', { class: 'wx-hint' }, T('Search for a city above to add it.')));
      }
      bList.onclick = () => { placesEl.classList.toggle('hidden'); if (!placesEl.classList.contains('hidden')) renderPlaces(); };

      /* ---------- loading ---------- */
      async function load(quiet) {
        const my = ++req;
        bUnit.textContent = '°' + unit;
        if (!quiet) { main.innerHTML = ''; main.appendChild(h('div', { class: 'wx-loading' }, T('Loading weather…'))); }
        const cache = PatOS.store.get('wxCache', {});
        try {
          if (PatOS.isOffline() && cache[ck(place)]) return drawSaved(cache[ck(place)]);
          if (PatOS.isOffline()) throw new Error('offline');
          const r = await fetch(URL_(place)); if (!r.ok) throw new Error('HTTP ' + r.status);
          const j = await r.json(); if (my !== req) return;
          // keep the last forecast for each place (only the 6 most recent), for when the device is offline
          cache[ck(place)] = { t: Date.now(), j }; const ks = Object.keys(cache); if (ks.length > 6) ks.sort((a, b) => cache[a].t - cache[b].t).slice(0, ks.length - 6).forEach((k) => delete cache[k]);
          PatOS.store.set('wxCache', cache); lastOK = Date.now(); lastData = j;
          draw(j);
        } catch (e) {
          if (my !== req) return;
          if (PatOS.isOffline()) {
            const c = PatOS.store.get('wxCache', {})[ck(place)];
            if (c) return drawSaved(c);
            main.innerHTML = ''; main.appendChild(PatOS.offlineCard(load, { body: 'The weather needs the internet. It will load by itself when you’re back online.' })); return;
          }
          if (quiet && lastData) return; // a failed background refresh keeps what is on screen
          main.innerHTML = '';
          main.appendChild(h('div', { class: 'wx-loading' }, T('Can’t get the weather right now.'), h('br'), h('small', {}, PatOS.sandboxed ? T('Claude Artifacts block live data. Open PatOS from its own website to see the weather.') : T('Check your internet connection (some school networks block it).')), h('br'), h('button', { class: 'wx-unit', style: { marginTop: '14px' }, onclick: () => load() }, T('Try again'))));
          setMode('cloud');
        }
      }
      function drawSaved(c) {
        draw(c.j);
        const when = new Date(c.t).toLocaleString(PatOS.locale, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
        const bar = h('div', { class: 'nw-offbar wx-offbar' }, T('You’re offline. This forecast is from') + ' ' + when + '.');
        main.insertBefore(bar, main.firstChild);
        const back = () => { window.removeEventListener('online', back); if (bar.isConnected) setTimeout(() => load(true), 600); };
        window.addEventListener('online', back);
      }

      /* ---------- what the next hours bring, in a sentence ---------- */
      function summary(d, nowIdx) {
        const hr = d.hourly, wet = (i) => hr.weather_code[i] >= 51;
        const kind = (c) => { const m = code(c)[2]; return m === 'snow' ? 'Snow' : m === 'storm' ? 'Thunderstorms' : 'Rain'; };
        const at = (i) => fmtT(hr.time[i], false);
        const cc = d.current.weather_code;
        if (cc >= 51) { for (let i = 1; i <= 12; i++) if (!wet(nowIdx + i)) return T(kind(cc) + ' easing around') + ' ' + at(nowIdx + i) + '.'; return T(kind(cc) + ' for the next 12 hours') + '.'; }
        for (let i = 1; i <= 12; i++) if (wet(nowIdx + i)) return T(kind(hr.weather_code[nowIdx + i]) + ' expected around') + ' ' + at(nowIdx + i) + '.';
        return T('No rain expected in the next 12 hours.');
      }
      const uvLevel = (v) => (v < 3 ? 'Low' : v < 6 ? 'Moderate' : v < 8 ? 'High' : v < 11 ? 'Very high' : 'Extreme');

      /* ---------- the next 24 hours as a chart ---------- */
      function chart(d, nowIdx) {
        const cv = h('canvas', { class: 'wx-chart', width: 720, height: 150, role: 'img', 'aria-label': T('Temperature and chance of rain') });
        requestAnimationFrame(() => {
          const W = cv.width = Math.max(300, cv.clientWidth * 2), H = cv.height = 300; const x = cv.getContext('2d');
          const temps = d.hourly.temperature_2m.slice(nowIdx, nowIdx + 24), rain = (d.hourly.precipitation_probability || []).slice(nowIdx, nowIdx + 24);
          const mn = Math.min(...temps) - 1, mx = Math.max(...temps) + 1, px = (i) => 30 + i * (W - 60) / 23, py = (v) => 40 + (1 - (v - mn) / (mx - mn)) * (H - 110);
          rain.forEach((p, i) => { if (!p) return; x.fillStyle = 'rgba(100,180,255,' + (0.25 + p / 250) + ')'; const bh = p / 100 * 60; x.fillRect(px(i) - 7, H - 30 - bh, 14, bh); });
          const g = x.createLinearGradient(0, 40, 0, H - 70); g.addColorStop(0, 'rgba(255,214,10,.45)'); g.addColorStop(1, 'rgba(255,214,10,0)');
          x.beginPath(); temps.forEach((v, i) => (i ? x.lineTo(px(i), py(v)) : x.moveTo(px(i), py(v)))); x.lineTo(px(23), H - 70); x.lineTo(px(0), H - 70); x.closePath(); x.fillStyle = g; x.fill();
          x.beginPath(); temps.forEach((v, i) => (i ? x.lineTo(px(i), py(v)) : x.moveTo(px(i), py(v)))); x.strokeStyle = '#ffd60a'; x.lineWidth = 5; x.lineJoin = 'round'; x.stroke();
          x.fillStyle = '#fff'; x.font = '600 22px system-ui'; x.textAlign = 'center';
          temps.forEach((v, i) => { if (i % 3) return; x.fillText(deg(v), px(i), py(v) - 14); x.fillStyle = 'rgba(255,255,255,.7)'; x.font = '20px system-ui'; x.fillText(i === 0 ? T('Now') : fmtT(d.hourly.time[nowIdx + i], false), px(i), H - 6); if (rain[i] >= 20) { x.fillStyle = '#9fd3ff'; x.fillText(rain[i] + '%', px(i), H - 36 - rain[i] / 100 * 60); } x.fillStyle = '#fff'; x.font = '600 22px system-ui'; });
        });
        return h('div', { class: 'wx-card' }, h('div', { class: 'wx-ch' }, T('Next 24 hours') + ' · ' + T('temperature and chance of rain')), cv);
      }

      const tile = (ic, k, v, sub) => h('div', { class: 'wx-card wx-tile' }, h('div', { class: 'wx-ch' }, icon(ic), ' ', T(k)), h('div', { class: 'wx-tv' }, v), sub ? h('div', { class: 'wx-ts' }, sub) : null);
      let aqiTile = null;
      function draw(d) {
        const c = d.current; const [label, symName, m] = code(c.weather_code);
        const dl = d.daily;
        const nowIdx = Math.max(0, d.hourly.time.findIndex((t) => t >= c.time.slice(0, 13)));
        const night = !c.is_day; const sym = (n, isDay) => (n === 'sunny' && isDay === 0 ? 'moon' : n);
        aqiTile = h('div', { class: 'wx-card wx-tile' }, h('div', { class: 'wx-ch' }, icon('cloud'), ' ', T('Air quality')), h('div', { class: 'wx-tv' }, '…'));
        fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${place.lat}&longitude=${place.lon}&current=us_aqi`).then((r) => r.json()).then((j) => {
          const v = Math.round(j.current.us_aqi); const lvl = v <= 50 ? ['Good', '#32d74b'] : v <= 100 ? ['Moderate', '#ffd60a'] : v <= 150 ? ['Unhealthy for sensitive people', '#ff9f0a'] : v <= 200 ? ['Unhealthy', '#ff453a'] : ['Very unhealthy', '#bf5af2'];
          const tv = aqiTile.querySelector('.wx-tv'); tv.innerHTML = ''; tv.append(String(v), h('small', { class: 'wx-aqi', style: { color: lvl[1] } }, T(lvl[0])));
          aqiTile.appendChild(h('div', { class: 'wx-aqibar' }, h('i', { style: { left: Math.min(100, v / 3) + '%' } })));
        }).catch(() => { aqiTile.querySelector('.wx-tv').textContent = '—'; });
        setMode(!night ? m : (m === 'clear' ? 'night' : m));
        const offsetDiff = d.utc_offset_seconds != null && d.utc_offset_seconds !== -new Date().getTimezoneOffset() * 60;
        const dirs = COMPASS[PatOS.lang === 'fr' ? 'fr' : 'en'], dir = dirs[Math.round(c.wind_direction_10m / 45) % 8];
        const vis = (d.hourly.visibility || [])[nowIdx], pressure = c.pressure_msl;
        const dayLen = (new Date(dl.sunset[0]) - new Date(dl.sunrise[0])) / 60000;
        const ago = () => Math.max(0, Math.round((Date.now() - (lastOK || Date.now())) / 60000));
        main.innerHTML = '';
        main.append(
          h('div', { class: 'wx-hero' },
            h('div', { class: 'wx-city' }, place.name === 'My Location' ? T('My Location') : place.name),
            offsetDiff ? h('div', { class: 'wx-local' }, T('Local time') + ' ' + fmtT(c.time)) : null,
            h('div', { class: 'wx-temp' }, deg(c.temperature_2m)),
            h('div', { class: 'wx-cond' }, icon(sym(symName, c.is_day), 'big'), ' ', T(label)),
            h('div', { class: 'wx-hl' }, T('H') + ':' + deg(dl.temperature_2m_max[0]) + '  ' + T('L') + ':' + deg(dl.temperature_2m_min[0])),
            h('div', { class: 'wx-sum' }, summary(d, nowIdx))),
          h('div', { class: 'wx-card' }, h('div', { class: 'wx-ch' }, icon('clock'), ' ', T('Hourly forecast')),
            h('div', { class: 'wx-hours' }, ...d.hourly.time.slice(nowIdx, nowIdx + 24).map((t, i) => {
              const p = d.hourly.precipitation_probability[nowIdx + i];
              return h('div', { class: 'wx-h' },
                h('small', {}, i === 0 ? T('Now') : fmtT(t, false)),
                icon(sym(code(d.hourly.weather_code[nowIdx + i])[1], d.hourly.is_day[nowIdx + i])),
                h('b', {}, deg(d.hourly.temperature_2m[nowIdx + i])),
                h('small', { class: 'wx-hp' }, p >= 20 ? p + '%' : ''));
            }))),
          chart(d, nowIdx),
          h('div', { class: 'wx-row' },
            h('div', { class: 'wx-card wx-days' }, h('div', { class: 'wx-ch' }, icon('calendar'), ' ', T('10-day forecast')),
              ...dl.time.map((t, i) => {
                const lo = Math.min(...dl.temperature_2m_min), hi = Math.max(...dl.temperature_2m_max);
                const a = (dl.temperature_2m_min[i] - lo) / (hi - lo || 1) * 100, b = (dl.temperature_2m_max[i] - lo) / (hi - lo || 1) * 100;
                const p = dl.precipitation_probability_max[i];
                return h('div', { class: 'wx-day' }, h('span', { class: 'wx-dn' }, i === 0 ? T('Today') : new Date(t + 'T12:00').toLocaleDateString(LOC(), { weekday: 'short' })),
                  h('span', { class: 'wx-di' }, icon(code(dl.weather_code[i])[1]), h('small', { class: 'wx-dp' }, p >= 20 ? p + '%' : '')), h('small', {}, deg(dl.temperature_2m_min[i])),
                  h('div', { class: 'wx-bar' }, h('span', { style: { left: a + '%', width: Math.max(4, b - a) + '%' } })), h('b', {}, deg(dl.temperature_2m_max[i])));
              })),
            h('div', { class: 'wx-tiles' },
              tile('thermo', 'Feels like', deg(c.apparent_temperature), Math.abs(c.apparent_temperature - c.temperature_2m) >= 2 ? T(c.apparent_temperature < c.temperature_2m ? 'Wind makes it feel colder.' : 'Humidity makes it feel warmer.') : T('Similar to the actual temperature.')),
              tile('drop', 'Humidity', c.relative_humidity_2m + '%'),
              tile('wind', 'Wind', speed(c.wind_speed_10m), dir + (c.wind_gusts_10m > c.wind_speed_10m + 8 ? ' · ' + T('gusts') + ' ' + speed(c.wind_gusts_10m) : '')),
              tile('sunny', 'UV index', String(Math.round(dl.uv_index_max[0])), T(uvLevel(dl.uv_index_max[0]))),
              aqiTile,
              tile('cloud', 'Pressure', imperial() ? (pressure * 0.02953).toFixed(2) + ' inHg' : Math.round(pressure) + ' hPa'),
              tile('fog', 'Visibility', vis == null ? '—' : imperial() ? (vis * 0.000621371 >= 10 ? Math.round(vis * 0.000621371) : (vis * 0.000621371).toFixed(1)) + ' mi' : (vis >= 10000 ? Math.round(vis / 1000) : (vis / 1000).toFixed(1)) + ' km'),
              tile('rain', 'Rain today', rainAmt(dl.precipitation_sum[0] || 0), dl.precipitation_probability_max[0] != null ? dl.precipitation_probability_max[0] + '% ' + T('chance') : ''),
              tile('sunrise', 'Sunrise', fmtT(dl.sunrise[0]), Math.floor(dayLen / 60) + ' h ' + Math.round(dayLen % 60) + ' min ' + T('of daylight')),
              tile('sunset', 'Sunset', fmtT(dl.sunset[0])))),
          h('div', { class: 'wx-foot' }, lastOK ? T('Updated') + ' ' + (ago() < 1 ? T('just now') : ago() + ' min') : ''));
        win.setTitle(T('Weather') + ' — ' + place.name);
      }

      /* ---------- rain, snow and stars behind it all ---------- */
      function setMode(m) {
        mode = m; win.body.style.background = BG[m] || BG.clear;
        cancelAnimationFrame(raf);
        const ctx = fx.getContext('2d');
        const calm = PatOS.settings.reduceMotion; const lite = PatOS.weakDevice ? 0.5 : 1;
        const parts = Array.from({ length: Math.round((m === 'rain' || m === 'storm' ? 160 : m === 'snow' ? 110 : m === 'clear' || m === 'night' ? 40 : 14) * lite) }, () => ({ x: Math.random(), y: Math.random(), s: 0.3 + Math.random(), r: Math.random() }));
        let flash = 0;
        const step = () => {
          if (!calm) raf = requestAnimationFrame(step);
          if (document.hidden || win.minimized) return;
          const W = fx.width = fx.clientWidth, H = fx.height = fx.clientHeight;
          ctx.clearRect(0, 0, W, H);
          parts.forEach((p) => {
            if (mode === 'rain' || mode === 'storm') { p.y += 0.02 * p.s; p.x -= 0.002; ctx.strokeStyle = 'rgba(200,220,255,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x * W, p.y * H); ctx.lineTo(p.x * W - 3, p.y * H + 14 * p.s); ctx.stroke(); }
            else if (mode === 'snow') { p.y += 0.002 * p.s; p.x += Math.sin(Date.now() / 1000 + p.r * 9) * 0.0008; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 1.5 + p.s * 1.6, 0, 7); ctx.fill(); }
            else if (mode === 'night') { ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * Math.abs(Math.sin(Date.now() / 900 + p.r * 20))})`; ctx.fillRect(p.x * W, p.y * H * 0.6, 1.5, 1.5); }
            else if (mode === 'clear') { p.x += 0.0003 * p.s; ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 2 + p.s * 3, 0, 7); ctx.fill(); }
            else { p.x += 0.0004 * p.s; ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.ellipse(p.x * W, p.y * H * 0.5, 120 * p.s, 40 * p.s, 0, 0, 7); ctx.fill(); }
            if (p.y > 1.05) { p.y = -0.05; p.x = Math.random() * 1.1; } if (p.x > 1.2) p.x = -0.2; if (p.x < -0.1) p.x = 1.1;
          });
          if (mode === 'storm') { if (Math.random() < 0.004) flash = 1; if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.5})`; ctx.fillRect(0, 0, W, H); flash -= 0.05; } }
        };
        step();
      }

      /* ---------- finding a city, with suggestions ---------- */
      let sugList = [], sugAt = -1, sugTimer = 0, sugReq = 0;
      const hideSug = () => { sug.classList.add('hidden'); sugAt = -1; };
      function choose(g) {
        place = { name: g.name, sub: [g.admin1, g.country].filter(Boolean).join(', '), lat: g.latitude, lon: g.longitude };
        if (!places.some((x) => same(x, place))) { places.push(place); savePlaces(); }
        PatOS.store.set('weatherPlace', place); search.value = ''; search.blur(); hideSug(); placesEl.classList.add('hidden'); load();
      }
      function paintSug() {
        sug.innerHTML = '';
        sugList.forEach((g, i) => sug.appendChild(h('button', { class: 'wx-sg' + (i === sugAt ? ' on' : ''), role: 'option', onmousedown: (e) => { e.preventDefault(); choose(g); } }, h('b', {}, g.name), h('small', {}, [g.admin1, g.country].filter(Boolean).join(', ')))));
        sug.classList.toggle('hidden', !sugList.length);
      }
      async function lookup(q, count) {
        const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=' + count + '&language=' + (PatOS.lang === 'fr' ? 'fr' : 'en') + '&name=' + encodeURIComponent(q));
        const j = await r.json(); return j.results || [];
      }
      search.addEventListener('input', () => {
        clearTimeout(sugTimer); const q = search.value.trim();
        if (q.length < 2) { sugList = []; hideSug(); return; }
        sugTimer = setTimeout(async () => { const my = ++sugReq; try { const res = await lookup(q, 6); if (my !== sugReq) return; sugList = res; sugAt = -1; paintSug(); } catch (e) { /* offline: Enter will say so */ } }, 250);
      });
      search.addEventListener('blur', () => setTimeout(hideSug, 120));
      search.addEventListener('keydown', async (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (!sugList.length) return; e.preventDefault(); sugAt = (sugAt + (e.key === 'ArrowDown' ? 1 : -1) + sugList.length) % sugList.length; paintSug(); return; }
        if (e.key === 'Escape') { hideSug(); search.blur(); return; }
        if (e.key !== 'Enter' || !search.value.trim()) return;
        if (sugList.length) return choose(sugList[Math.max(0, sugAt)]);
        try {
          const res = await lookup(search.value.trim(), 1);
          if (!res.length) { PatOS.notify({ title: T('City not found'), body: search.value, icon: 'weather' }); return; }
          choose(res[0]);
        } catch (er) { PatOS.notify({ title: T('Search failed'), body: T('No internet connection?'), icon: 'weather' }); }
      });
      bUnit.onclick = () => { unit = unit === 'C' ? 'F' : 'C'; PatOS.store.set('weatherUnit', unit); bUnit.textContent = '°' + unit; if (lastData) draw(lastData); else load(); if (!placesEl.classList.contains('hidden')) renderPlaces(); };
      bRef.onclick = () => load();
      bLoc.onclick = () => {
        if (!navigator.geolocation) return PatOS.notify({ title: T('Location blocked'), body: T('Search for your city instead.'), icon: 'weather' });
        navigator.geolocation.getCurrentPosition((p) => {
          place = { name: 'My Location', lat: p.coords.latitude, lon: p.coords.longitude };
          const old = places.findIndex((x) => x.name === 'My Location'); if (old >= 0) places[old] = place; else places.push(place); savePlaces();
          PatOS.store.set('weatherPlace', place); load();
        }, () => PatOS.notify({ title: T('Location blocked'), body: T('Search for your city instead.'), icon: 'weather' }), { timeout: 10000 });
      };
      // refresh by itself every 15 minutes, and when you come back to it
      const tick = setInterval(() => { if (!document.hidden && !win.minimized && Date.now() - lastOK > 15 * 60000) load(true); }, 60000);
      const vis = () => { if (!document.hidden && lastOK && Date.now() - lastOK > 10 * 60000) load(true); };
      document.addEventListener('visibilitychange', vis);
      win.on('closed', () => { cancelAnimationFrame(raf); clearInterval(tick); document.removeEventListener('visibilitychange', vis); clearTimeout(sugTimer); });
      win._wx = { refresh: () => load(), units: () => bUnit.click(), locate: () => bLoc.click(), places: () => bList.click() };
      setMode('clear'); load();
    },
    menus(win) {
      const W = win._wx || {};
      return { file: [
        { label: PatOS.t('Refresh'), shortcut: 'Alt+R', action: () => W.refresh && W.refresh() },
        { label: PatOS.t('Use my location'), action: () => W.locate && W.locate() },
        { label: PatOS.t('Saved cities'), action: () => W.places && W.places() },
        { divider: true },
        { label: PatOS.t('Change units'), action: () => W.units && W.units() },
        { divider: true },
        { label: PatOS.t('Close Window'), shortcut: 'Alt+W', action: () => win.close() }
      ] };
    }
  });
})();
