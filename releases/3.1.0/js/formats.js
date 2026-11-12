/* Opening Word, Excel, PowerPoint and zip files from Piles, and the shared download helper. */
(function () {
  'use strict';
  const T = (s) => PatOS.t(s);
  PatOS.downloadBlob = function (name, blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
  };
  const KIND = { docx: 'Word', xlsx: 'Excel', pptx: 'PowerPoint' };
  /* turn an Office file into a PatOS document and return where it went */
  PatOS.importOffice = async function (blob, name, dest) {
    dest = dest || '/Documents'; const ext = name.split('.').pop().toLowerCase(); const base = name.replace(/\.[^.]+$/, '') || T('Imported');
    if (ext === 'docx') { const html = await PatOS.docx.toHTML(blob); const p = dest + '/' + PatOS.fs.uniqueName(dest, base + '.pdoc'); PatOS.fs.write(p, html); return { app: 'docs', path: p }; }
    if (ext === 'xlsx') { const book = await PatOS.xlsx.toBook(blob); const p = dest + '/' + PatOS.fs.uniqueName(dest, base + '.psheet'); PatOS.fs.write(p, JSON.stringify(book)); const skipped = book.sheets.reduce((n, s) => n + (s.skipped || 0), 0); if (skipped) PatOS.notify({ title: T('Some cells were skipped'), body: skipped + ' ' + T('cells are past column Z, which Sheets doesn’t have yet.'), icon: 'sheets' }); return { app: 'sheets', path: p }; }
    if (ext === 'pptx') { const deck = await PatOS.pptx.toDeck(blob); const p = dest + '/' + PatOS.fs.uniqueName(dest, base + '.pslides'); PatOS.fs.write(p, JSON.stringify(deck)); if (deck.warn) PatOS.notify({ title: T('Some pictures were skipped'), body: deck.warn + ' ' + T('pictures are in a format Slides can’t show.'), icon: 'slides' }); return { app: 'slides', path: p }; }
    throw new Error(T('PatOS can open .docx, .xlsx and .pptx files. Older .doc, .xls and .ppt files need to be saved as the newer type first.'));
  };
  PatOS.openOffice = async function (path) {
    const name = PatOS.fs.basename(path); const ext = PatOS.fs.ext(path);
    PatOS.notify({ title: T('Opening') + ' ' + name + '…', body: T('Making a copy you can edit in') + ' ' + { docx: 'Write', xlsx: 'Tables', pptx: 'Stage' }[ext], icon: { docx: 'docs', xlsx: 'sheets', pptx: 'slides' }[ext] });
    try { const blob = await PatOS.fs.getBlob(path); const r = await PatOS.importOffice(blob, name, PatOS.fs.dirname(path)); PatOS.launch(r.app, { path: r.path }); }
    catch (e) { PatOS.alertBox(T('Couldn’t open this file'), e.message || String(e), { icon: 'finder' }); }
  };
  PatOS.openZip = async function (path) {
    try { PatOS.notify({ title: T('Extracting…'), body: PatOS.fs.basename(path), icon: 'finder' }); const r = await PatOS.zip.unzipTo(path, PatOS.fs.dirname(path)); PatOS.notify({ title: T('Extracted'), body: r.count + ' ' + T('files'), icon: 'finder' }); PatOS.launch('finder', { path: r.path }); }
    catch (e) { PatOS.alertBox(T('Couldn’t extract this file'), e.message || String(e), { icon: 'finder' }); }
  };
  PatOS.compress = async function (paths) {
    try {
      const dir = PatOS.fs.dirname(paths[0]); const base = paths.length === 1 ? PatOS.fs.basename(paths[0]).replace(/\.[^.]+$/, '') : T('Archive');
      const blob = await PatOS.zip.zipPaths(paths); const name = PatOS.fs.uniqueName(dir, base + '.zip'); await PatOS.fs.writeBlob(dir + '/' + name, blob);
      PatOS.notify({ title: T('Compressed'), body: name, icon: 'finder' });
    } catch (e) { PatOS.alertBox(T('Couldn’t compress'), e.message || String(e), { icon: 'finder' }); }
  };
})();
