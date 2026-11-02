/* Weather — live forecast from Open-Meteo (no key needed) */
(function () {
  'use strict';
  const { h } = PatOS;
  const CODES = {
    0: ['Clear Sky', '☀️', 'clear'], 1: ['Mostly Clear', '🌤', 'clear'], 2: ['Partly Cloudy', '⛅', 'cloud'], 3: ['Cloudy', '☁️', 'cloud'],
    45: ['Fog', '🌫', 'fog'], 48: ['Fog', '🌫', 'fog'], 51: ['Drizzle', '🌦', 'rain'], 53: ['Drizzle', '🌦', 'rain'], 55: ['Drizzle', '🌧', 'rain'],
    61: ['Light Rain', '🌧', 'rain'], 63: ['Rain', '🌧', 'rain'], 65: ['Heavy Rain', '🌧', 'rain'], 66: ['Freezing Rain', '🌧', 'rain'], 67: ['Freezing Rain', '🌧', 'rain'],
    71: ['Light Snow', '🌨', 'snow'], 73: ['Snow', '❄️', 'snow'], 75: ['Heavy Snow', '❄️', 'snow'], 77: ['Snow Grains', '🌨', 'snow'],
    80: ['Showers', '🌦', 'rain'], 81: ['Showers', '🌧', 'rain'], 82: ['Heavy Showers', '⛈', 'rain'], 85: ['Snow Showers', '🌨', 'snow'], 86: ['Snow Showers', '🌨', 'snow'],
    95: ['Thunderstorm', '⛈', 'storm'], 96: ['Thunderstorm', '⛈', 'storm'], 99: ['Thunderstorm', '⛈', 'storm']
  };
  const code = (c) => CODES[c] || ['—', '🌡', 'cloud'];
  const BG = { clear: 'linear-gradient(180deg,#2f80ed,#56ccf2)', cloud: 'linear-gradient(180deg,#5a6f8a,#93a5bd)', fog: 'linear-gradient(180deg,#7d8a99,#b7c0ca)', rain: 'linear-gradient(180deg,#24384f,#4b6584)', snow: 'linear-gradient(180deg,#6d8bb3,#b8cbe3)', storm: 'linear-gradient(180deg,#1d1f33,#3e4466)', night: 'linear-gradient(180deg,#0b1026,#2b3a67)' };

  PatOS.registerApp({
    id: 'weather', name: 'Weather', icon: 'weather', width: 760, height: 560, titlebar: 'hidden', keywords: 'forecast rain temperature',
    launch(win) {
      let place = PatOS.store.get('weatherPlace', { name: 'Montréal', lat: 45.5019, lon: -73.5674 });
      let unit = PatOS.store.get('weatherUnit', 'C');
      const fx = h('canvas', { class: 'wx-fx' });
      const content = h('div', { class: 'wx' });
      win.body.classList.add('wx-body');
      win.body.append(fx, content);
      let raf = 0, mode = 'clear';

      const search = h('input', { class: 'wx-search', placeholder: '🔍 Search city', spellcheck: 'false' });
      const bUnit = h('button', { class: 'wx-unit' });
      const bLoc = h('button', { class: 'wx-unit', title: 'Use my location' }, '➤');
      const top = h('div', { class: 'wx-top' }, search, bLoc, bUnit);
      const main = h('div', { class: 'wx-main' }, h('div', { class: 'wx-loading' }, 'Loading weather…'));
      content.append(top, main);
      const T = (c) => Math.round(unit === 'C' ? c : c * 9 / 5 + 32) + '°';

      async function load() {
        bUnit.textContent = '°' + unit;
        try {
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto&forecast_days=7`;
          const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status);
          draw(await r.json());
        } catch (e) {
          main.innerHTML = '';
          main.appendChild(h('div', { class: 'wx-loading' }, '⚠️ Can’t reach the weather service.', h('br'), h('small', {}, PatOS.sandboxed ? 'Claude Artifacts block live data. Open PatOS from its own website to see the weather.' : 'Check your internet connection (some school networks block it).'), h('br'), h('button', { class: 'btn', onclick: load, style: { marginTop: '12px' } }, 'Try again')));
          setMode('cloud');
        }
      }
      function draw(d) {
        const c = d.current; const [label, emoji, m] = code(c.weather_code);
        setMode(c.is_day ? m : (m === 'clear' ? 'night' : m));
        const dl = d.daily;
        const nowIdx = Math.max(0, d.hourly.time.findIndex((t) => t >= c.time.slice(0, 13)));
        main.innerHTML = '';
        main.append(
          h('div', { class: 'wx-hero' },
            h('div', { class: 'wx-city' }, place.name),
            h('div', { class: 'wx-temp' }, T(c.temperature_2m)),
            h('div', { class: 'wx-cond' }, label),
            h('div', { class: 'wx-hl' }, 'H:' + T(dl.temperature_2m_max[0]) + '  L:' + T(dl.temperature_2m_min[0]))),
          h('div', { class: 'wx-card' }, h('div', { class: 'wx-ch' }, '🕒 HOURLY FORECAST'),
            h('div', { class: 'wx-hours' }, ...d.hourly.time.slice(nowIdx, nowIdx + 24).map((t, i) => h('div', { class: 'wx-h' },
              h('small', {}, i === 0 ? 'Now' : new Date(t).toLocaleTimeString(undefined, { hour: 'numeric' })),
              h('span', {}, code(d.hourly.weather_code[nowIdx + i])[1]),
              h('b', {}, T(d.hourly.temperature_2m[nowIdx + i])))))),
          h('div', { class: 'wx-row' },
            h('div', { class: 'wx-card wx-days' }, h('div', { class: 'wx-ch' }, '📅 7-DAY FORECAST'),
              ...dl.time.map((t, i) => {
                const lo = Math.min(...dl.temperature_2m_min), hi = Math.max(...dl.temperature_2m_max);
                const a = (dl.temperature_2m_min[i] - lo) / (hi - lo || 1) * 100, b = (dl.temperature_2m_max[i] - lo) / (hi - lo || 1) * 100;
                return h('div', { class: 'wx-day' }, h('span', { class: 'wx-dn' }, i === 0 ? 'Today' : new Date(t + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' })),
                  h('span', {}, code(dl.weather_code[i])[1]), h('small', {}, T(dl.temperature_2m_min[i])),
                  h('div', { class: 'wx-bar' }, h('span', { style: { left: a + '%', width: Math.max(4, b - a) + '%' } })), h('b', {}, T(dl.temperature_2m_max[i])));
              })),
            h('div', { class: 'wx-tiles' },
              tile('🌡 FEELS LIKE', T(c.apparent_temperature)), tile('💧 HUMIDITY', c.relative_humidity_2m + '%'),
              tile('💨 WIND', Math.round(c.wind_speed_10m) + ' km/h'), tile('☀️ UV INDEX', Math.round(dl.uv_index_max[0])),
              tile('🌅 SUNRISE', new Date(dl.sunrise[0]).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })),
              tile('🌇 SUNSET', new Date(dl.sunset[0]).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })))));
        win.setTitle('Weather — ' + place.name);
      }
      const tile = (k, v) => h('div', { class: 'wx-card wx-tile' }, h('div', { class: 'wx-ch' }, k), h('div', { class: 'wx-tv' }, v));

      function setMode(m) {
        mode = m; win.body.style.background = BG[m] || BG.clear;
        cancelAnimationFrame(raf);
        const ctx = fx.getContext('2d');
        const parts = Array.from({ length: m === 'rain' || m === 'storm' ? 160 : m === 'snow' ? 110 : m === 'clear' || m === 'night' ? 40 : 14 }, () => ({ x: Math.random(), y: Math.random(), s: 0.3 + Math.random(), r: Math.random() }));
        let flash = 0;
        const step = () => {
          raf = requestAnimationFrame(step);
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
      search.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter' || !search.value.trim()) return;
        try {
          const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(search.value.trim()));
          const j = await r.json();
          if (!j.results || !j.results.length) { PatOS.notify({ title: 'City not found', body: search.value, icon: 'weather' }); return; }
          const g = j.results[0]; place = { name: g.name, lat: g.latitude, lon: g.longitude };
          PatOS.store.set('weatherPlace', place); search.value = ''; search.blur(); load();
        } catch (er) { PatOS.notify({ title: 'Search failed', body: 'No internet connection?', icon: 'weather' }); }
      });
      bUnit.onclick = () => { unit = unit === 'C' ? 'F' : 'C'; PatOS.store.set('weatherUnit', unit); load(); };
      bLoc.onclick = () => navigator.geolocation && navigator.geolocation.getCurrentPosition((p) => { place = { name: 'My Location', lat: p.coords.latitude, lon: p.coords.longitude }; PatOS.store.set('weatherPlace', place); load(); }, () => PatOS.notify({ title: 'Location blocked', body: 'Search for your city instead.', icon: 'weather' }));
      win.on('closed', () => cancelAnimationFrame(raf));
      setMode('clear'); load();
    }
  });
})();
