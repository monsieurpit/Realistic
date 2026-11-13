/* The .patapp file format: one JSON file that holds a whole PatOS app (its HTML, a name, an icon, and what it asks for).
   Used by PatOS (to install apps) and by the server (to check submissions), so both agree. See docs/APP-SDK.md. */
(function (g, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else g.PatAppFormat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  /* what an app can ask for; every one is asked again, on the device, before the app first uses it */
  const PERMS = ['files', 'clipboard', 'notifications', 'camera', 'microphone', 'location', 'network'];
  const ID = /^[a-z0-9][a-z0-9.-]{2,48}$/;
  const MAX_HTML = 1000000;
  const ENGINES = ['web', 'pitcode']; // 'pitcode': the app is written in PitCode (github.com/monsieurpit/PitCode); PatOS provides the language
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  // optional (3.2): every older app stays valid; these only add information
  const CATEGORIES = ['Games', 'Productivity', 'Education', 'Utilities', 'Creativity', 'Music', 'Social', 'Other'];
  const VER = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
  function validate(raw) {
    const bad = (error) => ({ ok: false, error });
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return bad('This is not a PatOS app file.');
    if (raw.format !== 'patapp') return bad('This is not a PatOS app file.');
    if (raw.formatVersion !== 1) return bad('This app was made for a different version of the app format.');
    const id = str(raw.id, 60); if (!ID.test(id)) return bad('The app id must be 3 to 49 characters: lowercase letters, numbers, dots and dashes (like com.maya.timer).');
    const name = str(raw.name, 40); if (!name) return bad('The app needs a name.');
    const version = str(raw.version, 20); if (!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(version)) return bad('The version must look like 1.0.0.');
    const html = typeof raw.html === 'string' ? raw.html : ''; if (!html.trim()) return bad('The app has no HTML.');
    if (html.length > MAX_HTML) return bad('The app is too big (the limit is 1 MB of HTML).');
    const perms = Array.isArray(raw.permissions) ? raw.permissions : [];
    if (perms.some((p) => PERMS.indexOf(p) < 0) || new Set(perms).size !== perms.length) return bad('The app asks for something PatOS does not offer.');
    const engine = raw.engine == null ? 'web' : raw.engine; if (ENGINES.indexOf(engine) < 0) return bad('The app engine is not known.');
    const color = /^#[0-9a-fA-F]{6}$/.test(raw.color || '') ? raw.color : '#0a84ff';
    const clamp = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : d);
    if (raw.minPatOS != null && !VER.test(String(raw.minPatOS))) return bad('minPatOS must look like 3.2.0.');
    if (raw.category != null && CATEGORIES.indexOf(raw.category) < 0) return bad('The category must be one of: ' + CATEGORIES.join(', ') + '.');
    const shots = Array.isArray(raw.screenshots) ? raw.screenshots : [];
    if (shots.length > 4 || shots.some((x) => typeof x !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(x) || x.length > 400000)) return bad('Screenshots: up to 4 PNG, JPEG or WebP pictures (data: addresses), under 400 KB each.');
    const acts = Array.isArray(raw.actions) ? raw.actions : [];
    if (acts.length > 10 || acts.some((a) => !a || !/^[a-z0-9-]{1,30}$/.test(a.id || '') || typeof a.title !== 'string' || !Array.isArray(a.phrases) || !a.phrases.length)) return bad('Actions: up to 10, each with an id (a-z, 0-9, -), a title and the phrases that call it.');
    const homepage = str(raw.homepage, 200); if (homepage && !/^https:\/\/[^\s]+$/.test(homepage)) return bad('The homepage must be an https:// address.');
    return { ok: true, app: {
      format: 'patapp', formatVersion: 1, id, name, version, author: str(raw.author, 40), description: str(raw.description, 300),
      engine, icon: Array.from(str(raw.icon, 8)).slice(0, 2).join('') || name[0].toUpperCase(), color, permissions: perms.slice(),
      width: clamp(raw.width, 240, 1600, 520), height: clamp(raw.height, 200, 1200, 420), html,
      ...(raw.minPatOS ? { minPatOS: String(raw.minPatOS) } : {}), ...(raw.category ? { category: raw.category } : {}), ...(shots.length ? { screenshots: shots.slice() } : {}),
      ...(acts.length ? { actions: acts.map((a) => ({ id: a.id, title: str(a.title, 60), phrases: a.phrases.slice(0, 10).map((x) => str(String(x), 80)) })) } : {}),
      ...(str(raw.changelog, 2000) ? { changelog: str(raw.changelog, 2000) } : {}), ...(homepage ? { homepage } : {}) } };
  }
  const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1; return 0; };
  /* can this PatOS run the app? (minPatOS) */
  const compatible = (app, patosVersion) => !app.minPatOS || !patosVersion || cmp(String(patosVersion).split('-')[0], app.minPatOS) >= 0;
  return { PERMS, ENGINES, ID, MAX_HTML, CATEGORIES, validate, cmp, compatible };
});
