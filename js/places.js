/* Places: where you are, finding places and what is nearby, and directions. Shared by Maps and PatOS Intelligence
   ("bring me to the nearest gym", "directions to the library", "where am I").
   - Your location comes from the browser, only when asked, and the browser asks you first. PatOS keeps it in memory for
     5 minutes (never saved, never synced, never sent anywhere except as the search area below).
   - Places come from OpenStreetMap's free search (Nominatim, the same as Maps): a search sends the words and, for "near
     me", the area around you. Nothing else. One search at a time, as its rules ask.
   - Directions open in Google Maps (in a new tab), which can route on foot, by bike or by car; PatOS can't navigate itself. */
(function () {
  'use strict';
  const NOM = 'https://nominatim.openstreetmap.org';
  let here = null, queue = Promise.resolve();
  const T = (s) => PatOS.t(s);
  const fail = (code, msg) => Object.assign(new Error(msg), { code });

  /* where the device is: { lat, lon } (asks the browser; refused or unavailable → an error that says so) */
  function locate(opts) {
    if (here && Date.now() - here.t < 5 * 60 * 1000 && !(opts && opts.fresh)) return Promise.resolve({ lat: here.lat, lon: here.lon, cached: true });
    if (!navigator.geolocation) return Promise.reject(fail('nogeo', T('This browser can’t tell where you are.')));
    return new Promise((ok, bad) => navigator.geolocation.getCurrentPosition(
      (p) => { here = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, t: Date.now() }; ok({ lat: here.lat, lon: here.lon, accuracy: here.acc }); },
      (e) => bad(fail(e && e.code === 1 ? 'denied' : 'nogeo', e && e.code === 1 ? T('You didn’t allow PatOS to see your location. Allow it in the browser’s site settings to find places near you.') : T('Your location isn’t available right now.'))),
      { timeout: 12000, maximumAge: 120000 }));
  }
  // one request at a time (Nominatim's rule), with a clear error when offline
  function get(url) {
    const run = () => { if (navigator.onLine === false) return Promise.reject(fail('offline', T('Places need the internet, and you’re offline.')));
      return fetch(url, { headers: { Accept: 'application/json' } }).then((r) => { if (!r.ok) throw fail('http', T('The map search didn’t answer.')); return r.json(); }); };
    const p = queue.then(run, run); queue = p.then(() => new Promise((r) => setTimeout(r, 1000)), () => new Promise((r) => setTimeout(r, 1000)));
    return p;
  }
  /* distance in metres between two points */
  function distance(a, b) {
    const R = 6371000, rad = (x) => x * Math.PI / 180, dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const fmtDistance = (m) => (m < 950 ? Math.max(10, Math.round(m / 10) * 10) + ' m' : (m / 1000).toFixed(m < 9500 ? 1 : 0).replace('.', PatOS.lang === 'fr' ? ',' : '.') + ' km');
  const shape = (x, from) => { const p = { name: (x.name || String(x.display_name || '').split(',')[0] || '').trim(), address: String(x.display_name || '').split(',').slice(1, 4).join(',').trim(), lat: +x.lat, lon: +x.lon, type: x.type || '' }; if (from) p.distance = distance(from, p); return p; };

  /* places matching words; near: { lat, lon } to look around a point (about 15 km) */
  async function search(q, near, limit) {
    q = String(q || '').trim().slice(0, 120); if (!q) return [];
    let url = NOM + '/search?format=jsonv2&limit=' + (limit || 8) + '&q=' + encodeURIComponent(q) + '&accept-language=' + (PatOS.lang === 'fr' ? 'fr' : 'en');
    if (near) { const d = 0.14; url += '&viewbox=' + (near.lon - d) + ',' + (near.lat + d) + ',' + (near.lon + d) + ',' + (near.lat - d) + '&bounded=1'; }
    const l = await get(url); return (Array.isArray(l) ? l : []).map((x) => shape(x, near));
  }
  /* the nearest places of a kind ("gym", "pharmacy"), closest first */
  async function nearby(what) {
    const at = await locate(); const l = await search(what, at, 12);
    return { at, places: l.sort((a, b) => a.distance - b.distance) };
  }
  /* what is at a point (an address) */
  async function reverse(at) { const x = await get(NOM + '/reverse?format=jsonv2&zoom=17&lat=' + at.lat + '&lon=' + at.lon + '&accept-language=' + (PatOS.lang === 'fr' ? 'fr' : 'en')); return x && x.display_name ? shape(x) : null; }
  /* directions (Google Maps, in a new tab): from where you are when known */
  function directionsUrl(to, from) { return 'https://www.google.com/maps/dir/?api=1' + (from ? '&origin=' + from.lat + ',' + from.lon : '') + '&destination=' + (to.lat != null ? to.lat + ',' + to.lon : encodeURIComponent(to.name || to)); }
  function directions(to, from) { const u = directionsUrl(to, from); if (PatOS.openExternal) PatOS.openExternal(u); else window.open(u, '_blank', 'noopener'); return u; }

  PatOS.places = { locate, search, nearby, reverse, distance, fmtDistance, directions, directionsUrl, forget: () => { here = null; } };
})();
