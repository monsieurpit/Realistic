/* PatOS Profiles (4.0): separate environments, like School, Personal, Gaming or Development.

   What belongs to a profile (and changes when you switch):
     - the look: wallpaper, theme, accent, glass style, Liquid Glass
     - the Dock: its apps, size, magnification, hiding
     - the desktop: widgets, panels, extra menus, your keyboard shortcuts (a desktop configuration, js/desk.js)
     - notifications: the rules for each app, quiet hours, muted apps
     - the windows that were open (they are kept, hidden, while you're in another profile, and come back as they were)
   What is shared by every profile (one copy, never duplicated): your files, notes, calendar, reminders, messages, photos,
   music, installed apps, passwords, your account and sync.
   Which profile you're in is kept on this device; the profiles themselves sync with your account like your settings.
   A profile is not a lock: anyone using this PatOS can switch to any profile. It's about what you see, not who you are. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  const KEY = 'profiles', ACTIVE = 'profileActive';
  const SETTINGS = ['wallpaper', 'theme', 'accent', 'glassStyle', 'liquidGlass', 'dockPinned', 'dockSize', 'magnify', 'dockAutohide', 'showWidgets', 'notifRules', 'quietOn', 'quietFrom', 'quietTo', 'mutedApps'];
  const STORE = ['deskWidgets', 'deskPanels', 'deskMenus', 'deskShortcuts'];
  const ICONS = ['person', 'doc', 'gem', 'rocket', 'music', 'palette', 'star', 'moon', 'laptop', 'flag'];
  const COLORS = ['#0a84ff', '#30d158', '#ff9f0a', '#ff375f', '#bf5af2', '#64d2ff', '#ffd60a', '#8e8e93'];
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const load = () => { const d = PatOS.store.get(KEY, null); return d && Array.isArray(d.list) && d.list.length ? d : { list: [{ id: 'personal', name: T('Personal'), icon: 'person', color: '#0a84ff', created: Date.now(), settings: null, store: null, windows: [] }] }; };
  let data = load();
  const active = () => { const a = PatOS.store.get(ACTIVE, null); return data.list.some((p) => p.id === a) ? a : data.list[0].id; };
  const save = () => { PatOS.store.set(KEY, data); PatOS.emit('profiles'); };

  // what this profile looks like now (read from PatOS)
  function snapshot(p) {
    p.settings = Object.fromEntries(SETTINGS.map((k) => [k, clone(PatOS.settings[k])]));
    p.store = Object.fromEntries(STORE.map((k) => [k, clone(PatOS.store.get(k, null))]));
    p.windows = PatOS.wm.windows.filter((w) => !w.profileHidden).map((w) => ({ app: w.app.id, r: w.maximized ? 'max' : w.rect() }));
    p.updated = Date.now();
  }
  function create(o) {
    o = o || {};
    const name = String(o.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 30); if (!name) throw new Error(T('A profile needs a name.'));
    if (data.list.length >= 12) throw new Error(T('You can have up to 12 profiles.'));
    let id = name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'profile'; while (data.list.some((p) => p.id === id)) id += '-2';
    const p = { id, name, icon: ICONS.includes(o.icon) ? o.icon : 'person', color: COLORS.includes(o.color) ? o.color : COLORS[data.list.length % COLORS.length], created: Date.now(), settings: null, store: null, windows: [] };
    // a new profile starts from a copy of the one you're in (or from a desktop configuration)
    snapshot(p); p.windows = [];
    if (o.config) { const { config } = PatOS.desk.validate(o.config); p.config = config; }
    data.list.push(p); save(); return id;
  }
  let switching = false;
  async function switchTo(id) {
    const to = data.list.find((p) => p.id === id); const fromId = active();
    if (!to || id === fromId || switching) return false;
    switching = true;
    try {
      const from = data.list.find((p) => p.id === fromId);
      if (from) snapshot(from);
      // the windows of the profile you leave are kept, hidden (their apps keep their state)
      PatOS.wm.windows.forEach((w) => { if (!w.profileHidden) { w.profileHidden = fromId; w.el.style.display = 'none'; w.minimized = true; } });
      PatOS.wm.blurAll && PatOS.wm.blurAll();
      // the profile you go to
      if (to.settings) SETTINGS.forEach((k) => { if (to.settings[k] !== undefined && JSON.stringify(PatOS.settings[k]) !== JSON.stringify(to.settings[k])) PatOS.setSetting(k, clone(to.settings[k])); });
      if (to.store) STORE.forEach((k) => { if (to.store[k] == null) PatOS.store.remove(k); else PatOS.store.set(k, clone(to.store[k])); });
      if (to.config) { try { PatOS.desk.apply(to.config); } catch (e) {} delete to.config; }
      PatOS.store.set(ACTIVE, id);
      const mine = PatOS.wm.windows.filter((w) => w.profileHidden === id);
      if (mine.length) mine.forEach((w) => { w.profileHidden = null; w.el.style.display = ''; w.minimized = false; PatOS.wm.focus(w); });
      else (to.windows || []).forEach((it) => { if (!PatOS.apps[it.app]) return; const w = PatOS.launch(it.app); if (w && w.el && it.r !== 'max' && it.r) Object.assign(w.el.style, { left: it.r.x + 'px', top: it.r.y + 'px', width: it.r.w + 'px', height: it.r.h + 'px' }); });
      save();
      PatOS.emit('profile:switched', { from: fromId, to: id });
      if (PatOS.pill && PatOS.pill.flash) PatOS.pill.flash({ kind: 'profile', lead: '<span class="pl-glyph" style="color:' + to.color + '">' + PatOS.sym(to.icon) + '</span>', title: to.name, sub: T('Profile') });
      return true;
    } finally { switching = false; }
  }
  function remove(id) {
    if (data.list.length < 2) throw new Error(T('You need at least one profile.'));
    if (id === active()) throw new Error(T('Switch to another profile first.'));
    PatOS.wm.windows.filter((w) => w.profileHidden === id).forEach((w) => { w.profileHidden = null; w._force = true; w.close(); });
    data.list = data.list.filter((p) => p.id !== id); save(); return true;
  }
  function update(id, patch) {
    const p = data.list.find((x) => x.id === id); if (!p) return false;
    if (patch.name != null) { const n = String(patch.name).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 30); if (n) p.name = n; }
    if (ICONS.includes(patch.icon)) p.icon = patch.icon; if (COLORS.includes(patch.color)) p.color = patch.color;
    save(); return true;
  }
  // a profile as a file (its look, Dock and desktop: a desktop configuration with a name), and back
  function exportProfile(id) { const p = data.list.find((x) => x.id === id); if (!p) return null; if (id === active()) snapshot(p); const cfg = toConfig(p); return JSON.stringify({ schema: 'patos.profile/1', name: p.name, icon: p.icon, color: p.color, config: cfg }, null, 1); }
  function toConfig(p) {
    const s = p.settings || {}, st = p.store || {};
    return PatOS.desk.validate({ schema: PatOS.desk.SCHEMA, name: p.name, look: { theme: s.theme, accent: s.accent, wallpaper: s.wallpaper, glassStyle: s.glassStyle, liquidGlass: s.liquidGlass }, dock: { apps: s.dockPinned || [], size: s.dockSize, magnify: s.magnify, autohide: s.dockAutohide }, widgets: st.deskWidgets || [], panels: st.deskPanels || [], menus: st.deskMenus || [], shortcuts: st.deskShortcuts || [] }).config;
  }
  function importProfile(text) {
    let o; try { o = JSON.parse(String(text)); } catch (e) { throw new Error(T('This isn’t a PatOS profile.')); }
    if (!o || o.schema !== 'patos.profile/1') throw new Error(T('This isn’t a PatOS profile.'));
    return create({ name: o.name, icon: o.icon, color: o.color, config: o.config });
  }
  /* the desktop configuration of a profile, ready to apply (Studio and World use it) */
  function configOf(id) { const p = data.list.find((x) => x.id === id); if (!p) return null; if (id === active()) return PatOS.desk.capture(p.name); return toConfig(p); }
  /* puts a desktop configuration into a profile (applied now if it's the one you're in) */
  function setConfig(id, cfg) { const p = data.list.find((x) => x.id === id); if (!p) return false; if (id === active()) { PatOS.desk.apply(cfg); snapshot(p); } else { p.config = PatOS.desk.validate(cfg).config; } save(); return true; }

  /* the switcher: Control Center tile, Spotlight ("profile school"), Pat ("switch to my school profile"), the PatOS menu */
  function menu(x, y) {
    PatOS.menu([{ header: T('Profiles') }, ...data.list.map((p) => ({ label: p.name, checked: p.id === active(), action: () => switchTo(p.id) })), { divider: true }, { label: T('New Profile…'), action: () => PatOS.launch('settings', { pane: 'profiles' }) }], x, y);
  }
  PatOS.profiles = { list: () => data.list.map((p) => ({ id: p.id, name: p.name, icon: p.icon, color: p.color, active: p.id === active(), windows: (p.windows || []).length })), active, current: () => data.list.find((p) => p.id === active()), create, switchTo, remove, update, exportProfile, importProfile, configOf, setConfig, menu, ICONS, COLORS, SETTINGS, STORE };
  // the device remembers which profile it is in; the first time, the profile you have now is "Personal", as you set it up
  PatOS.on('wm:ready', () => { const p = data.list.find((x) => x.id === active()); if (p && !p.settings) { snapshot(p); save(); } });
  // other devices changed the profiles (sync): read them again
  PatOS.on('sync', () => { const d = PatOS.store.get(KEY, null); if (d && Array.isArray(d.list) && d.list.length && JSON.stringify(d) !== JSON.stringify(data)) { data = d; PatOS.emit('profiles'); } });
})();
