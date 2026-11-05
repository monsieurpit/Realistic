/* PatOS.zip — read and write .zip files (and Word, Excel, PowerPoint files, which are zips) with the
   browser's own compression. No libraries. */
(function () {
  'use strict';
  const te = new TextEncoder(), td = new TextDecoder();
  let table = null;
  function crc32(u8) {
    if (!table) { table = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } }
    let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = table[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0;
  }
  async function pipe(u8, stream) {
    const out = new Blob([u8]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(out).arrayBuffer());
  }
  const inflate = (u8) => pipe(u8, new DecompressionStream('deflate-raw'));
  const deflate = (u8) => pipe(u8, new CompressionStream('deflate-raw'));
  const toU8 = async (d) => (typeof d === 'string' ? te.encode(d) : d instanceof Uint8Array ? d : d instanceof Blob ? new Uint8Array(await d.arrayBuffer()) : new Uint8Array(d));

  /* read: returns { names: [...], get(name) -> Promise<Uint8Array>, text(name) -> Promise<string>, has(name) } */
  async function read(source) {
    const buf = source instanceof Uint8Array ? source : new Uint8Array(source instanceof Blob ? await source.arrayBuffer() : source);
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('This isn’t a valid zip file.');
    const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
    const entries = {};
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
      const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = td.decode(buf.subarray(p + 46, p + 46 + nl));
      entries[name] = { method, csize, usize, off };
      p += 46 + nl + el + cl;
    }
    const get = async (name) => {
      const e = entries[name]; if (!e) throw new Error('Missing ' + name);
      const lh = e.off, nl = dv.getUint16(lh + 26, true), el = dv.getUint16(lh + 28, true), start = lh + 30 + nl + el;
      const data = buf.subarray(start, start + e.csize);
      return e.method === 0 ? data : e.method === 8 ? inflate(data) : Promise.reject(new Error('Unsupported zip compression'));
    };
    return { names: Object.keys(entries), has: (n) => n in entries, size: (n) => entries[n].usize, get, text: async (n) => td.decode(await get(n)) };
  }

  /* write: files is [{ name, data (string | Uint8Array | Blob), store? }] -> Blob */
  async function write(files, mime) {
    const parts = [], central = []; let offset = 0;
    const now = new Date(); const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const f of files) {
      const raw = await toU8(f.data); const nameB = te.encode(f.name);
      const useStore = f.store || raw.length < 64; const data = useStore ? raw : await deflate(raw); const method = useStore ? 0 : 8; const crc = crc32(raw);
      const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, method, true); lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, raw.length, true); lh.setUint16(26, nameB.length, true);
      parts.push(new Uint8Array(lh.buffer), nameB, data);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true); ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, raw.length, true); ch.setUint16(28, nameB.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nameB);
      offset += 30 + nameB.length + data.length;
    }
    const csize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: mime || 'application/zip' });
  }

  /* zip a PatOS folder or files, and unzip into a folder */
  async function zipPaths(paths, rootName) {
    const files = [];
    const add = async (path, prefix) => {
      const n = PatOS.fs.get(path); if (!n) return;
      const name = prefix + PatOS.fs.basename(path);
      if (n.type === 'dir') { files.push({ name: name + '/', data: new Uint8Array(0), store: true }); for (const it of PatOS.fs.list(path)) await add(it.path, name + '/'); }
      else files.push({ name, data: await PatOS.fs.getBlob(path) });
    };
    for (const p of paths) await add(p, rootName ? rootName + '/' : '');
    return write(files);
  }
  async function unzipTo(path, destDir) {
    const z = await read(await PatOS.fs.getBlob(path));
    const base = PatOS.fs.basename(path).replace(/\.zip$/i, '') || 'Archive';
    const root = destDir + '/' + PatOS.fs.uniqueName(destDir, base); PatOS.fs.mkdir(root);
    let count = 0;
    for (const name of z.names) {
      if (name.includes('..') || name.startsWith('/') || name.startsWith('__MACOSX')) continue;
      const parts = name.split('/').filter(Boolean); if (!parts.length) continue;
      let dir = root; for (let i = 0; i < parts.length - (name.endsWith('/') ? 0 : 1); i++) { dir += '/' + parts[i]; if (!PatOS.fs.exists(dir)) PatOS.fs.mkdir(dir); }
      if (name.endsWith('/')) continue;
      const data = await z.get(name); const file = parts[parts.length - 1]; const ext = (file.split('.').pop() || '').toLowerCase();
      const isText = /^(txt|md|js|css|html?|json|csv|py|xml|svg|yml|yaml|log|ts|psheet|pdoc|pslides|pform)$/.test(ext);
      const dest = dir + '/' + file;
      if (isText && data.length < 8e6) PatOS.fs.write(dest, td.decode(data));
      else if (data.length > 8 * 1024 * 1024 || /^(mp4|webm|mov|m4v|ogv)$/.test(ext)) await PatOS.fs.writeBlob(dest, new Blob([data]));
      else { const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', mp3: 'audio/mpeg', wav: 'audio/wav', pdf: 'application/pdf' }[ext] || 'application/octet-stream'; PatOS.fs.write(dest, await dataURL(new Blob([data], { type: mime }))); }
      count++;
    }
    return { path: root, count };
  }
  const dataURL = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };

  PatOS.zip = { read, write, zipPaths, unzipTo, crc32, b64, toU8 };
})();
