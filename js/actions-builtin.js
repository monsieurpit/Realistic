/* What PatOS's own apps can do with things (Universal Actions, js/services.js). Each action only calls something the app
   really supports; reminders, notes and events go through PatOS Intelligence, so its permissions (Settings › PatOS
   Intelligence) apply here too. Apps that can't take content from outside yet (Messages, Contacts) aren't listed: no button
   that does nothing. */
(function () {
  'use strict';
  const A = PatOS.actions, T = (s) => PatOS.t(s);
  const fsx = () => PatOS.fs;
  const textOf = (o) => (o.type === 'url' ? (o.title ? o.title + ' ' : '') + o.url : o.type === 'contact' ? [o.name, o.phone, o.email].filter(Boolean).join(', ') : o.type === 'event' ? o.title : String(o.text || o.name || ''));
  async function intel(id, params) {
    if (!PatOS.intel) throw new Error(T('That isn’t available.'));
    const r = await PatOS.intel.execute(id, params, { source: 'actions', confirmed: true });
    if (!r || r.ok === false) throw new Error((r && r.message) || T('That didn’t work.'));
    return { message: r.message };
  }

  // open and show
  A.register({ id: 'file.open', title: 'Open', accepts: ['file', 'image', 'document', 'folder'], order: 1, run: (o) => { PatOS.openFile(o.path); } });
  A.register({ id: 'finder.reveal', app: 'finder', title: 'Show in Piles', accepts: ['file', 'image', 'document'], order: 2, run: (o) => { PatOS.launch('finder', { path: fsx().dirname(o.path) }); } });
  A.register({ id: 'photos.open', app: 'photos', title: 'Open in Photos', accepts: ['image'], order: 5, run: (o) => { PatOS.launch('photos', { path: o.path }); } });
  A.register({ id: 'paint.edit', app: 'paint', title: 'Edit in Paint', accepts: (o) => o.type === 'image' && !!o.path, order: 6, run: (o) => { PatOS.launch('paint', { path: o.path }); } });
  A.register({ id: 'preview.open', app: 'preview', title: 'Open in Preview', accepts: (o) => !!o.path && /\.(pdf|png|jpe?g|gif|webp)$/i.test(o.path), order: 7, run: (o) => { PatOS.launch('preview', { path: o.path }); } });
  A.register({ id: 'textedit.open', app: 'textedit', title: 'Open in TextEdit', accepts: (o) => !!o.path && /\.(txt|md|js|css|html|json|csv|py)$/i.test(o.path), order: 8, run: (o) => { PatOS.launch('textedit', { path: o.path }); } });
  A.register({ id: 'browser.open', app: 'browser', title: 'Open in Patoogle', accepts: ['url'], order: 3, run: (o) => { PatOS.launch('browser', { url: o.url }); } });

  // make something with it
  A.register({ id: 'notes.add', app: 'notes', title: 'Add to Notes', accepts: ['text', 'url', 'contact', 'event'], order: 20, run: (o) => intel('notes.create', { text: textOf(o).slice(0, 5000) }) });
  A.register({ id: 'reminders.add', app: 'reminders', title: 'Remind Me', accepts: ['text', 'url', 'contact', 'event'], order: 21, run: (o) => intel('reminders.create', { text: (o.type === 'contact' ? T('Call') + ' ' + o.name : textOf(o)).slice(0, 300) }) });
  A.register({ id: 'calendar.add', app: 'calendar', title: 'Add to Calendar', accepts: ['event', 'contact'], order: 22, run: (o) => intel('calendar.create', { title: (o.type === 'contact' ? T('Meet') + ' ' + o.name : o.title).slice(0, 200), day: o.start ? new Date(o.start) : undefined }) });
  A.register({
    id: 'wallpaper.set', title: 'Use as Wallpaper', accepts: (o) => o.type === 'image' && !!o.path, order: 30,
    async run(o) {
      const n = fsx().get(o.path); let url = n && typeof n.content === 'string' && n.content.startsWith('data:image') ? n.content : null;
      if (!url && fsx().getBlob) { const b = await fsx().getBlob(o.path); if (b) url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error(T('That picture can’t be read.'))); r.readAsDataURL(b); }); }
      if (!url) throw new Error(T('That picture can’t be read.'));
      const prev = { w: PatOS.settings.wallpaper, c: PatOS.settings.customWallpaper };
      PatOS.setSetting('customWallpaper', url); PatOS.setSetting('wallpaper', 'custom');
      return { message: T('New wallpaper.'), prev };
    },
    undo: (r) => { if (r && r.prev) { PatOS.setSetting('customWallpaper', r.prev.c || ''); PatOS.setSetting('wallpaper', r.prev.w); } }
  });

  // copy and keep
  A.register({ id: 'clipboard.copy', title: 'Copy', accepts: ['text', 'url', 'contact', 'event'], order: 40, run: async (o) => { await navigator.clipboard.writeText(textOf(o)); return { message: T('Copied') }; } });
  A.register({ id: 'clipboard.copypath', title: 'Copy Path', accepts: ['file', 'image', 'document', 'folder'], order: 41, run: async (o) => { await navigator.clipboard.writeText(o.path); return { message: T('Copied') }; } });
  A.register({ id: 'capture.add', title: 'Capture', accepts: () => !!PatOS.capture, order: 45, run: (o) => { PatOS.capture.add(o, { from: 'share' }); return { message: T('Saved to Capture') }; } });
})();
