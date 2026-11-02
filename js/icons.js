/* PatOS app icons: gradient squircles with hand-drawn SVG glyphs */
(function () {
  'use strict';
  const S = (inner, vb) => `<svg viewBox="${vb || '0 0 64 64'}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  const day = () => new Date().getDate();
  const wk = () => new Date().toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();

  const ICONS = {
    finder: { bg: 'linear-gradient(160deg,#5ac8fa,#0a63d8)', svg: () => S(`
      <path d="M10 20a4 4 0 0 1 4-4h12l5 5h19a4 4 0 0 1 4 4v23a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill="#e8f4ff"/>
      <path d="M10 27h44v21a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill="#fff"/>
      <circle cx="25" cy="35" r="2.6" fill="#0a63d8"/><circle cx="39" cy="35" r="2.6" fill="#0a63d8"/>
      <path d="M23 42q9 7 18 0" stroke="#0a63d8" stroke-width="3" fill="none" stroke-linecap="round"/>`) },
    launchpad: { bg: 'linear-gradient(160deg,#e9e9ee,#9ea3ad)', svg: () => {
      const c = ['#ff453a', '#ff9f0a', '#ffd60a', '#32d74b', '#64d2ff', '#0a84ff', '#bf5af2', '#ff375f', '#30d158'];
      let g = ''; c.forEach((col, i) => { g += `<rect x="${12 + (i % 3) * 15}" y="${12 + Math.floor(i / 3) * 15}" width="11" height="11" rx="3.5" fill="${col}"/>`; });
      return S(g);
    } },
    browser: { bg: 'linear-gradient(150deg,#7d5cff,#ff4fa0 70%,#ffb347)', svg: () => S(`
      <circle cx="28" cy="28" r="14" fill="none" stroke="#fff" stroke-width="6"/>
      <path d="M38 38l12 12" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
      <text x="28" y="34" font-size="16" font-family="system-ui,sans-serif" font-weight="900" fill="#fff" text-anchor="middle">P</text>`) },
    oldbrowser: { bg: 'linear-gradient(160deg,#ffffff,#d9e4f2)', svg: () => S(`
      <defs><linearGradient id="bw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34c3ff"/><stop offset="1" stop-color="#1f5bff"/></linearGradient></defs>
      <circle cx="32" cy="32" r="22" fill="url(#bw)"/>
      <g stroke="#fff" stroke-opacity=".55" stroke-width="1.6" fill="none"><ellipse cx="32" cy="32" rx="9" ry="22"/><path d="M10 32h44M13 21h38M13 43h38"/></g>
      <path d="M41 19 35 35 23 45 29 29z" fill="#ff3b30"/><path d="M41 19 35 35 29 29z" fill="#fff"/>`) },
    notes: { bg: 'linear-gradient(180deg,#ffe37a 0 26%,#fffdf5 26%)', svg: () => S(`
      <g stroke="#d9d1b8" stroke-width="2"><path d="M12 30h40M12 38h40M12 46h40M12 54h28"/></g>
      <path d="M8 14h48" stroke="#e6c34a" stroke-width="2" stroke-dasharray="2 3"/>`) },
    textedit: { bg: 'linear-gradient(160deg,#f7f7f7,#cfd4da)', svg: () => S(`
      <rect x="14" y="10" width="34" height="44" rx="3" fill="#fff" stroke="#c5c9cf"/>
      <g stroke="#9aa3ad" stroke-width="2.2" stroke-linecap="round"><path d="M20 20h22M20 27h22M20 34h16M20 41h20"/></g>
      <path d="M50 18 34 46l-4 8 7-6 16-27z" fill="#ffb340" stroke="#c77c00" stroke-width="1.2"/>`) },
    calculator: { bg: 'linear-gradient(160deg,#4a4a4f,#1c1c1e)', svg: () => {
      let g = '<rect x="13" y="11" width="38" height="10" rx="2.5" fill="#8e8e93" opacity=".6"/>';
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) g += `<circle cx="${18 + c * 11}" cy="${30 + r * 10}" r="4" fill="${c === 2 ? '#ff9f0a' : '#d4d4d2'}"/>`;
      return S(g);
    } },
    terminal: { bg: 'linear-gradient(160deg,#3a3a3c,#0b0b0d)', svg: () => S(`
      <path d="M15 22l10 9-10 9" stroke="#e5e5e7" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M30 42h17" stroke="#e5e5e7" stroke-width="4" stroke-linecap="round"/>`) },
    calendar: { bg: '#fff', svg: () => S(`
      <text x="32" y="21" font-size="11" font-family="system-ui,sans-serif" font-weight="700" fill="#ff3b30" text-anchor="middle">${wk()}</text>
      <text x="32" y="51" font-size="30" font-family="system-ui,sans-serif" font-weight="400" fill="#1c1c1e" text-anchor="middle">${day()}</text>`) },
    clock: { bg: 'linear-gradient(160deg,#2c2c2e,#000)', svg: () => {
      const d = new Date(); const h = (d.getHours() % 12 + d.getMinutes() / 60) * 30, m = d.getMinutes() * 6;
      let ticks = ''; for (let i = 0; i < 12; i++) ticks += `<line x1="32" y1="11" x2="32" y2="15" stroke="#1c1c1e" stroke-width="2" transform="rotate(${i * 30} 32 32)"/>`;
      return S(`<circle cx="32" cy="32" r="23" fill="#fff"/>${ticks}
        <line x1="32" y1="32" x2="32" y2="20" stroke="#1c1c1e" stroke-width="3" stroke-linecap="round" transform="rotate(${h} 32 32)"/>
        <line x1="32" y1="32" x2="32" y2="14" stroke="#1c1c1e" stroke-width="2" stroke-linecap="round" transform="rotate(${m} 32 32)"/>
        <circle cx="32" cy="32" r="2.2" fill="#ff9f0a"/>`);
    } },
    weather: { bg: 'linear-gradient(170deg,#4fb2ff,#1767d6)', svg: () => S(`
      <circle cx="26" cy="26" r="10" fill="#ffd60a"/>
      <path d="M22 48a9 9 0 0 1 1-18 12 12 0 0 1 22 3 8 8 0 0 1 1 15z" fill="#fff"/>`) },
    music: { bg: 'linear-gradient(160deg,#ff6482,#fa233b)', svg: () => S(`
      <path d="M26 16l20-5v28" stroke="#fff" stroke-width="4" fill="none" stroke-linejoin="round"/>
      <path d="M26 16v28" stroke="#fff" stroke-width="4"/>
      <ellipse cx="21" cy="45" rx="6.5" ry="5.2" fill="#fff"/><ellipse cx="41" cy="40" rx="6.5" ry="5.2" fill="#fff"/>`) },
    photos: { bg: '#fff', svg: () => {
      const c = ['#ff9f0a', '#ffd60a', '#32d74b', '#30b0c7', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f'];
      let g = ''; c.forEach((col, i) => { g += `<ellipse cx="32" cy="20" rx="7" ry="12" fill="${col}" opacity=".85" transform="rotate(${i * 45} 32 32)"/>`; });
      return S(g);
    } },
    paint: { bg: 'linear-gradient(160deg,#fff4e0,#ffcf8a)', svg: () => S(`
      <path d="M32 10C18 10 9 20 9 31c0 10 8 15 14 13 4-1 4 4 8 6 12 4 24-6 24-19 0-12-10-21-23-21z" fill="#fff" stroke="#d7a45c" stroke-width="1.5"/>
      <circle cx="21" cy="25" r="4" fill="#ff3b30"/><circle cx="31" cy="19" r="4" fill="#ffcc00"/><circle cx="42" cy="22" r="4" fill="#34c759"/>
      <circle cx="46" cy="33" r="4" fill="#0a84ff"/><circle cx="40" cy="43" r="4" fill="#af52de"/>`) },
    photobooth: { bg: 'linear-gradient(160deg,#ff5f57,#b3001b)', svg: () => S(`
      <rect x="12" y="21" width="40" height="27" rx="5" fill="#2c2c2e"/><rect x="24" y="16" width="16" height="7" rx="2" fill="#2c2c2e"/>
      <circle cx="32" cy="34.5" r="9.5" fill="#48484a" stroke="#8e8e93" stroke-width="2"/><circle cx="32" cy="34.5" r="4.5" fill="#0a84ff"/>
      <circle cx="46" cy="26" r="2" fill="#ffd60a"/>`) },
    reminders: { bg: '#fff', svg: () => S(`
      <circle cx="17" cy="20" r="5" fill="#0a84ff"/><circle cx="17" cy="33" r="5" fill="#ff3b30"/><circle cx="17" cy="46" r="5" fill="#ff9f0a"/>
      <g stroke="#c7c7cc" stroke-width="2.5" stroke-linecap="round"><path d="M28 20h22M28 33h22M28 46h22"/></g>`) },
    settings: { bg: 'linear-gradient(160deg,#d1d1d6,#7c7c84)', svg: () => {
      let teeth = ''; for (let i = 0; i < 12; i++) teeth += `<rect x="29" y="7" width="6" height="10" rx="1.5" fill="#3a3a3c" transform="rotate(${i * 30} 32 32)"/>`;
      return S(`${teeth}<circle cx="32" cy="32" r="17" fill="#3a3a3c"/><circle cx="32" cy="32" r="12" fill="#aeaeb2"/><circle cx="32" cy="32" r="5" fill="#3a3a3c"/>`);
    } },
    activity: { bg: 'linear-gradient(160deg,#2c2c2e,#000)', svg: () => S(`
      <rect x="10" y="12" width="44" height="40" rx="4" fill="#111" stroke="#3a3a3c"/>
      <path d="M12 38h8l4-12 6 20 6-28 5 20h11" stroke="#32d74b" stroke-width="2.6" fill="none" stroke-linejoin="round"/>`) },
    galaxy: { bg: 'radial-gradient(circle at 50% 50%,#3b1d78,#090418 75%)', svg: () => S(`
      <g fill="none" stroke-linecap="round">
      <path d="M32 32c6-6 16-2 16 6s-10 14-20 10S14 30 22 20s26-8 30 4" stroke="#c38bff" stroke-width="3"/>
      <path d="M32 32c-6 6-16 2-16-6s10-14 20-10 14 18 6 28-26 8-30-4" stroke="#6ad7ff" stroke-width="2.4" opacity=".9"/></g>
      <circle cx="32" cy="32" r="4" fill="#fff"/>
      <circle cx="12" cy="14" r="1" fill="#fff"/><circle cx="52" cy="50" r="1.2" fill="#fff"/><circle cx="50" cy="12" r=".9" fill="#fff"/>`) },
    orbrunner: { bg: 'linear-gradient(180deg,#0b0130,#2a0a5e 60%,#ff2fa3)', svg: () => S(`
      <path d="M4 60 26 30h12l22 30z" fill="#140638" stroke="#ff4fd8" stroke-width="1.5"/>
      <path d="M32 30v30M20 45h24M14 53h36" stroke="#ff4fd8" stroke-width="1" opacity=".7"/>
      <circle cx="32" cy="22" r="9" fill="#5cf2ff"/><circle cx="29" cy="19" r="3" fill="#fff" opacity=".8"/>`) },
    studio: { bg: 'linear-gradient(160deg,#30d158,#007a5a)', svg: () => S(`
      <path d="M32 9 52 20v24L32 55 12 44V20z" fill="#e9fff1"/>
      <path d="M32 9 52 20 32 31 12 20z" fill="#fff"/><path d="M32 31v24L12 44V20z" fill="#b6f0cb"/>
      <path d="M32 31 52 20v24L32 55z" fill="#7fdba1"/>`) },
    tictactoe: { bg: 'linear-gradient(160deg,#5e5ce6,#2d2a9e)', svg: () => S(`
      <g stroke="#fff" stroke-opacity=".5" stroke-width="2.5"><path d="M25 12v40M39 12v40M12 25h40M12 39h40"/></g>
      <path d="M14 14l8 8M22 14l-8 8M42 42l8 8M50 42l-8 8" stroke="#ff9f0a" stroke-width="3" stroke-linecap="round"/>
      <circle cx="32" cy="32" r="4.5" stroke="#64d2ff" stroke-width="3" fill="none"/><circle cx="46" cy="18" r="4.5" stroke="#64d2ff" stroke-width="3" fill="none"/>`) },
    about: { bg: 'linear-gradient(160deg,#7d5cff,#ff4fa0)', svg: () => S(`<text x="32" y="45" font-size="36" font-family="system-ui,sans-serif" font-weight="800" fill="#fff" text-anchor="middle">P</text>`) },
    trash: { bg: 'transparent', svg: (full) => S(`
      <path d="M16 18h32l-3 38a3 3 0 0 1-3 3H22a3 3 0 0 1-3-3z" fill="rgba(235,240,248,.9)" stroke="#9aa5b4"/>
      <g stroke="#9aa5b4" stroke-width="1.2">${[22, 27, 32, 37, 42].map((x) => `<path d="M${x} 22l${(x - 32) * 0.08} 33"/>`).join('')}</g>
      ${full ? '<path d="M20 18c2-6 7-8 10-5 3-5 9-4 11 0 3-2 7 0 7 5z" fill="#fff" stroke="#b8c0cc"/>' : ''}
      <rect x="13" y="14" width="38" height="5" rx="2.5" fill="#dfe5ee" stroke="#9aa5b4"/>`) },
    youtube: { bg: 'linear-gradient(160deg,#ff3b30,#c4001d)', svg: () => S(`<rect x="10" y="17" width="44" height="30" rx="9" fill="#fff"/><path d="M28 24v16l13-8z" fill="#e00"/>`) },
    maps: { bg: 'linear-gradient(160deg,#9be15d,#00b09b)', svg: () => S(`
      <path d="M8 20 24 14l16 6 16-6v30l-16 6-16-6-16 6z" fill="#e8f7e1"/><path d="M24 14v30M40 20v30" stroke="#a5c99a" stroke-width="1.5"/>
      <path d="M8 34 56 22" stroke="#ffd60a" stroke-width="3"/>
      <path d="M40 10a8 8 0 0 0-8 8c0 6 8 14 8 14s8-8 8-14a8 8 0 0 0-8-8z" fill="#ff3b30"/><circle cx="40" cy="18" r="3" fill="#fff"/>`) },
    gmail: { bg: '#fff', svg: () => S(`<rect x="10" y="16" width="44" height="32" rx="4" fill="#f2f2f2"/><path d="M10 20l22 16 22-16" stroke="#ea4335" stroke-width="5" fill="none" stroke-linejoin="round"/><path d="M10 20v28M54 20v28" stroke="#4285f4" stroke-width="5"/>`) },
    docs: { bg: '#fff', svg: () => S(`<path d="M18 8h20l10 10v38H18z" fill="#4285f4"/><path d="M38 8v10h10z" fill="#a1c2fa"/><g stroke="#fff" stroke-width="2.6"><path d="M24 30h18M24 37h18M24 44h12"/></g>`) },
    sheets: { bg: '#fff', svg: () => S(`<path d="M18 8h20l10 10v38H18z" fill="#0f9d58"/><path d="M38 8v10h10z" fill="#87ceac"/><rect x="23" y="28" width="20" height="18" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M23 37h20M33 28v18" stroke="#fff" stroke-width="2.4"/>`) },
    slides: { bg: '#fff', svg: () => S(`<path d="M18 8h20l10 10v38H18z" fill="#f4b400"/><path d="M38 8v10h10z" fill="#fadb7f"/><rect x="23" y="29" width="20" height="14" rx="1.5" fill="none" stroke="#fff" stroke-width="2.6"/>`) },
    drive: { bg: 'linear-gradient(160deg,#5ac8fa,#007aff)', svg: () => S(`<path d="M20 44a10 10 0 0 1-1-20 14 14 0 0 1 27-3 11 11 0 0 1 0 23z" fill="#fff"/><path d="M32 26v12M26 32l6-6 6 6" stroke="#007aff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`) },
    classroom: { bg: '#fff', svg: () => S(`<rect x="8" y="14" width="48" height="34" rx="3" fill="#1e8e3e"/><rect x="12" y="18" width="40" height="26" fill="#34a853"/><circle cx="32" cy="27" r="4" fill="#fff"/><path d="M24 40c1-5 5-7 8-7s7 2 8 7z" fill="#fff"/><rect x="36" y="48" width="14" height="4" fill="#fbbc04"/>`) },
    meet: { bg: '#fff', svg: () => S(`<rect x="8" y="18" width="34" height="28" rx="4" fill="#00897b"/><path d="M42 28l14-9v26l-14-9z" fill="#00ac47"/><rect x="8" y="18" width="12" height="28" fill="#4285f4" opacity=".9"/>`) },
    gcal: { bg: '#fff', svg: () => S(`<rect x="12" y="12" width="40" height="40" rx="4" fill="#fff" stroke="#4285f4" stroke-width="4"/><rect x="12" y="12" width="40" height="10" fill="#4285f4"/><text x="32" y="46" font-size="20" font-family="system-ui,sans-serif" font-weight="700" fill="#4285f4" text-anchor="middle">31</text>`) },
    search: { bg: '#fff', svg: () => S(`<circle cx="28" cy="28" r="13" fill="none" stroke="#4285f4" stroke-width="6"/><path d="M38 38l12 12" stroke="#ea4335" stroke-width="7" stroke-linecap="round"/>`) },
    translate: { bg: 'linear-gradient(160deg,#4285f4,#1a5fd1)', svg: () => S(`<text x="22" y="36" font-size="22" font-family="system-ui,sans-serif" font-weight="700" fill="#fff" text-anchor="middle">A</text><text x="42" y="52" font-size="20" font-family="system-ui,sans-serif" fill="#fff" text-anchor="middle">文</text>`) },
    gphotos: { bg: '#fff', svg: () => S(`<path d="M32 32V12a10 10 0 0 1 0 20z" fill="#ea4335"/><path d="M32 32h20a10 10 0 0 1-20 0z" fill="#4285f4"/><path d="M32 32v20a10 10 0 0 1 0-20z" fill="#34a853"/><path d="M32 32H12a10 10 0 0 1 20 0z" fill="#fbbc04"/>`) },
    forms: { bg: '#fff', svg: () => S(`<path d="M18 8h20l10 10v38H18z" fill="#7248b9"/><g fill="#fff"><circle cx="25" cy="30" r="2"/><circle cx="25" cy="38" r="2"/><circle cx="25" cy="46" r="2"/></g><g stroke="#fff" stroke-width="2.4"><path d="M30 30h12M30 38h12M30 46h12"/></g>`) },
    keep: { bg: '#fff', svg: () => S(`<path d="M16 8h24l10 10v38H16z" fill="#fbbc04"/><circle cx="33" cy="30" r="7" fill="#fff"/><rect x="29" y="38" width="8" height="6" fill="#fff"/>`) },
    chat: { bg: '#fff', svg: () => S(`<path d="M10 14h44v28H26l-10 8v-8h-6z" fill="#00ac47"/><g fill="#fff"><circle cx="22" cy="28" r="3"/><circle cx="32" cy="28" r="3"/><circle cx="42" cy="28" r="3"/></g>`) },
    folder: { bg: 'transparent', svg: () => S(`
      <path d="M6 16a4 4 0 0 1 4-4h14l5 5h25a4 4 0 0 1 4 4v29a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill="#3d9bf5"/>
      <path d="M6 23a4 4 0 0 1 4-4h44a4 4 0 0 1 4 4v27a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill="#6cb8ff"/>`) },
    file: { bg: 'transparent', svg: (ext) => S(`
      <path d="M14 6h26l12 12v38a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" fill="#fff" stroke="#c8ccd2"/>
      <path d="M40 6v12h12" fill="#eef0f3" stroke="#c8ccd2"/>
      <g stroke="#c5cad1" stroke-width="2"><path d="M18 26h26M18 32h26M18 38h20"/></g>
      <text x="32" y="52" font-size="8" font-family="system-ui,sans-serif" font-weight="700" fill="#8e96a3" text-anchor="middle">${(ext || 'TXT').toUpperCase().slice(0, 4)}</text>`) },
    imagefile: { bg: 'transparent', svg: () => S(`
      <rect x="8" y="12" width="48" height="40" rx="4" fill="#fff" stroke="#c8ccd2"/>
      <rect x="12" y="16" width="40" height="32" fill="#9fd6ff"/><circle cx="22" cy="25" r="4" fill="#ffd60a"/>
      <path d="M12 48l14-16 10 10 6-6 10 12z" fill="#34c759"/>`) },
    audiofile: { bg: 'transparent', svg: () => S(`<path d="M14 6h26l12 12v38a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" fill="#fff" stroke="#c8ccd2"/><path d="M28 24l12-3v18" stroke="#fa233b" stroke-width="3" fill="none"/><path d="M28 24v18" stroke="#fa233b" stroke-width="3"/><circle cx="25" cy="43" r="4" fill="#fa233b"/><circle cx="37" cy="40" r="4" fill="#fa233b"/>`) },
    linkfile: { bg: 'transparent', svg: () => S(`<path d="M14 6h26l12 12v38a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" fill="#fff" stroke="#c8ccd2"/><circle cx="32" cy="35" r="12" fill="#0a84ff"/><path d="M20 35h24M32 23c-6 6-6 18 0 24M32 23c6 6 6 18 0 24" stroke="#fff" stroke-width="1.5" fill="none"/>`) },
    appstore: { bg: 'linear-gradient(160deg,#36b5ff,#1569ff)', svg: () => S(`<g stroke="#fff" stroke-width="4.5" stroke-linecap="round" fill="none"><path d="M26 15l16 28M38 15L22 43M14 43h36M44 49l3 5"/></g>`) },
    code: { bg: 'linear-gradient(160deg,#1e1e2e,#2d2b55)', svg: () => S(`<path d="M24 20l-12 12 12 12M40 20l12 12-12 12" stroke="#7aa2ff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M35 14l-6 36" stroke="#ff7ad9" stroke-width="4.5" stroke-linecap="round"/>`) },
    messages: { bg: 'linear-gradient(160deg,#5df777,#0bbf3a)', svg: () => S(`<path d="M32 13c-12 0-21 7.5-21 17 0 5.5 3 10.3 7.8 13.4L17 51l9-4.3c1.9.4 3.9.7 6 .7 12 0 21-7.6 21-17S44 13 32 13z" fill="#fff"/>`) },
    piano: { bg: 'linear-gradient(160deg,#2c2c2e,#000)', svg: () => { let g = '<rect x="10" y="14" width="44" height="36" rx="3" fill="#fff"/>'; for (let i = 1; i < 7; i++) g += `<path d="M${10 + i * 6.3} 14v36" stroke="#bbb" stroke-width="1"/>`; [1, 2, 4, 5, 6].forEach((i) => { g += `<rect x="${10 + i * 6.3 - 2.2}" y="14" width="4.4" height="21" fill="#111"/>`; }); return S(g); } },
    flashcards: { bg: 'linear-gradient(160deg,#ffb340,#ff6a00)', svg: () => S(`<rect x="16" y="12" width="34" height="24" rx="4" fill="#fff" opacity=".55" transform="rotate(-8 33 24)"/><rect x="14" y="22" width="36" height="26" rx="4" fill="#fff"/><path d="M22 31h20M22 38h13" stroke="#ff8a00" stroke-width="3" stroke-linecap="round"/>`) },
    voicememos: { bg: 'linear-gradient(160deg,#2c2c2e,#000)', svg: () => { let g = ''; [8, 16, 26, 14, 30, 20, 10, 24, 12, 6].forEach((h2, i) => { g += `<rect x="${11 + i * 4.4}" y="${32 - h2 / 2}" width="2.6" height="${h2}" rx="1.3" fill="#ff453a"/>`; }); return S(g); } },
    stickies: { bg: 'linear-gradient(160deg,#fff27a,#ffd60a)', svg: () => S(`<path d="M14 12h36v28L38 52H14z" fill="#fffbe0"/><path d="M50 40H38v12z" fill="#e6c200"/><path d="M20 22h24M20 29h24M20 36h14" stroke="#c9a800" stroke-width="2.5" stroke-linecap="round"/>`) },
    typing: { bg: 'linear-gradient(160deg,#64d2ff,#0a84ff)', svg: () => { let g = '<rect x="8" y="20" width="48" height="26" rx="5" fill="#fff"/>'; for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) g += `<rect x="${12 + c * 7}" y="${24 + r * 7}" width="5" height="5" rx="1" fill="#0a84ff" opacity=".7"/>`; return S(g + '<rect x="18" y="38" width="28" height="4" rx="1" fill="#0a84ff"/>'); } },
    dictionary: { bg: 'linear-gradient(160deg,#8e2de2,#4a00e0)', svg: () => S(`<path d="M16 12h28a4 4 0 0 1 4 4v36H20a4 4 0 0 1-4-4z" fill="#fff"/><path d="M16 48a4 4 0 0 1 4-4h28" stroke="#c9b6ff" stroke-width="2" fill="none"/><text x="32" y="36" font-size="18" font-family="Georgia,serif" font-weight="700" fill="#6a1fd0" text-anchor="middle">Aa</text>`) },
    contacts: { bg: 'linear-gradient(160deg,#c7c7cc,#8e8e93)', svg: () => S(`<rect x="12" y="10" width="40" height="44" rx="5" fill="#f2f2f7"/><circle cx="32" cy="27" r="8" fill="#8e8e93"/><path d="M18 48c2-9 8-12 14-12s12 3 14 12z" fill="#8e8e93"/><rect x="9" y="18" width="5" height="6" rx="1.5" fill="#636366"/><rect x="9" y="30" width="5" height="6" rx="1.5" fill="#636366"/>`) },
    freeform: { bg: '#fff', svg: () => S(`<path d="M12 44c8-20 16 6 24-10s12-14 16-8" stroke="#0a84ff" stroke-width="4" fill="none" stroke-linecap="round"/><rect x="34" y="34" width="18" height="16" rx="3" fill="#ffd60a"/><circle cx="20" cy="20" r="7" fill="#ff375f"/>`) },
    preview: { bg: 'linear-gradient(160deg,#f5f5f7,#d1d1d6)', svg: () => S(`<rect x="10" y="16" width="34" height="38" rx="3" fill="#fff" stroke="#c7c7cc"/><rect x="14" y="20" width="26" height="18" fill="#64d2ff"/><path d="M14 38l8-8 6 6 4-4 8 6z" fill="#34c759"/><circle cx="44" cy="22" r="10" fill="none" stroke="#3a3a3c" stroke-width="4"/><path d="M51 29l6 6" stroke="#3a3a3c" stroke-width="5" stroke-linecap="round"/>`) },
    chess: { bg: 'linear-gradient(160deg,#a67c52,#5d3a1a)', svg: () => S(`<g fill="#fff"><path d="M26 50h18l-2-6H28z"/><path d="M29 44c0-8-6-10-6-18 0-6 5-10 11-10 7 0 10 6 9 10l-5 2 2 4-4 2c1 4 3 6 3 10z"/></g><rect x="22" y="50" width="26" height="4" rx="2" fill="#fff"/>`) },
    screenshot: { bg: 'linear-gradient(160deg,#636366,#2c2c2e)', svg: () => S(`<path d="M14 24v-8h8M42 16h8v8M50 40v8h-8M22 48h-8v-8" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="32" cy="32" r="8" fill="#ff453a"/>`) },
    grapher: { bg: 'linear-gradient(160deg,#0b3d91,#1e88e5)', svg: () => S(`<path d="M10 54h46M14 58V8" stroke="#bfe0ff" stroke-width="2"/><path d="M14 50c8-2 10-30 18-30s10 26 18 18 6-14 6-14" stroke="#ffd60a" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M14 40c10 0 20-6 40-26" stroke="#ff6b9d" stroke-width="3" fill="none" stroke-linecap="round"/>`) },
    elements: { bg: 'linear-gradient(160deg,#ff9a3c,#ff3d68)', svg: () => S(`<rect x="12" y="12" width="40" height="40" rx="6" fill="#fff"/><text x="16" y="22" font-size="7" font-family="system-ui" fill="#888">8</text><text x="32" y="42" font-size="22" font-weight="800" font-family="system-ui" fill="#ff3d68" text-anchor="middle">O</text><text x="32" y="49" font-size="5" font-family="system-ui" fill="#888" text-anchor="middle">15.999</text>`) },
    focus: { bg: 'linear-gradient(160deg,#5e5ce6,#bf5af2)', svg: () => S(`<circle cx="32" cy="34" r="19" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="5"/><path d="M32 15a19 19 0 1 1-17 27" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M32 24v10l6 4" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/>`) },
    journal: { bg: 'linear-gradient(160deg,#a06cd5,#6247aa)', svg: () => S(`<rect x="15" y="10" width="34" height="44" rx="4" fill="#fff"/><rect x="15" y="10" width="7" height="44" fill="#e0d4f7"/><path d="M27 22h16M27 29h16M27 36h10" stroke="#a06cd5" stroke-width="2.5" stroke-linecap="round"/><path d="M40 44l3-3 3 3-3 3z" fill="#ff6b9d"/>`) },
    sudoku: { bg: '#fff', svg: () => { let g = '<rect x="10" y="10" width="44" height="44" rx="4" fill="#f2f2f7" stroke="#3a3a3c" stroke-width="2"/>'; [24.7, 39.3].forEach((v) => { g += `<path d="M${v} 10v44M10 ${v}h44" stroke="#3a3a3c" stroke-width="2"/>`; }); [[17, 21, '5'], [32, 21, '3'], [47, 36, '7'], [17, 50, '9'], [32, 50, '1']].forEach(([x, y, n]) => { g += `<text x="${x}" y="${y}" font-size="10" font-weight="700" font-family="system-ui" fill="${n === '7' ? '#0a84ff' : '#1c1c1e'}" text-anchor="middle">${n}</text>`; }); return S(g); } },
    news: { bg: 'linear-gradient(160deg,#ff5f6d,#e0193f)', svg: () => S(`<rect x="12" y="14" width="40" height="36" rx="5" fill="#fff"/><rect x="17" y="20" width="16" height="12" rx="2" fill="#ff8a95"/><path d="M37 21h10M37 26h10M37 31h10M17 37h30M17 42h30" stroke="#e0193f" stroke-width="2.6" stroke-linecap="round"/>`) },
    books: { bg: 'linear-gradient(160deg,#ffb340,#ff7a00)', svg: () => S(`<path d="M32 18c-6-4-13-4-19-2v30c6-2 13-2 19 2 6-4 13-4 19-2V16c-6-2-13-2-19 2z" fill="#fff"/><path d="M32 18v30" stroke="#ff9500" stroke-width="2.5"/>`) },
    radio: { bg: 'linear-gradient(160deg,#ff2d55,#b40d6e)', svg: () => S(`<circle cx="32" cy="32" r="5" fill="#fff"/><path d="M23 23a13 13 0 0 0 0 18M41 23a13 13 0 0 1 0 18M17 17a21 21 0 0 0 0 30M47 17a21 21 0 0 1 0 30" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round"/>`) },
    videos: { bg: 'linear-gradient(160deg,#2c2c2e,#000)', svg: () => S(`<rect x="11" y="17" width="42" height="30" rx="6" fill="none" stroke="#fff" stroke-width="3"/><path d="M28 25v14l12-7z" fill="#fff"/>`) },
    solitaire: { bg: 'linear-gradient(160deg,#30b45a,#0b6b33)', svg: () => S(`<rect x="14" y="14" width="24" height="34" rx="4" fill="#fff" transform="rotate(-10 26 31)"/><rect x="26" y="16" width="24" height="34" rx="4" fill="#fff" stroke="#0b6b33" stroke-width="1.5" transform="rotate(8 38 33)"/><text x="33" y="39" font-size="16" fill="#e0193f" font-family="system-ui" transform="rotate(8 38 33)">♥</text>`) },
  };

  /* generic letter-tile icon */
  function letterIcon(letter, bg) {
    return { bg: bg || 'linear-gradient(160deg,#8e8e93,#48484a)', svg: () => S(`<text x="32" y="43" font-size="28" font-family="system-ui,sans-serif" font-weight="700" fill="#fff" text-anchor="middle">${letter}</text>`) };
  }

  PatOS.iconDefs = ICONS;
  PatOS.iconHTML = function (id, arg) {
    const def = ICONS[id] || letterIcon((id || '?')[0].toUpperCase());
    const flat = def.bg === 'transparent';
    return `<div class="icon-tile${flat ? ' flat' : ''}" style="background:${def.bg}">${def.svg(arg)}</div>`;
  };
  PatOS.icon = function (id, arg) {
    const wrap = document.createElement('div');
    wrap.className = 'icon';
    wrap.innerHTML = PatOS.iconHTML(id, arg);
    return wrap;
  };
  PatOS.fileIconHTML = function (name, n) {
    const kind = PatOS.fileKind(name, n);
    if (kind === 'folder') return PatOS.iconHTML('folder');
    if (kind === 'image') {
      if (n && n.content && n.content.startsWith('data:image')) return `<div class="icon-tile flat thumb"><img src="${n.content}" alt=""></div>`;
      return PatOS.iconHTML('imagefile');
    }
    if (kind === 'audio') return PatOS.iconHTML('audiofile');
    const docIc = { pdoc: 'docs', psheet: 'sheets', csv: 'sheets', pslides: 'slides', pform: 'forms', pdf: 'preview' }[PatOS.fs.ext(name)];
    if (docIc) return PatOS.iconHTML(docIc);
    if (kind === 'link') return PatOS.iconHTML('linkfile');
    return PatOS.iconHTML('file', PatOS.fs.ext(name) || 'txt');
  };
})();

/* ---------- interface symbols: simple line icons used instead of emoji ---------- */
(function () {
  'use strict';
  const P = {
    desktop: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-9 8"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    home: '<path d="M4 11l8-7 8 7v9H5z"/><path d="M10 20v-6h4v6"/>',
    apps: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    palette: '<path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7" r="1.2"/>',
    dock: '<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="6" y="15" width="12" height="3" rx="1.5"/>',
    display: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6"/>',
    speaker: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    mute: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M17 9l5 6M22 9l-5 6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1" fill="currentColor"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    storage: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    sheet: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/>',
    slides: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>',
    form: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor"/>',
    fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    sparkle: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
    note: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
    save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
    print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    link: '<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>',
    chart: '<path d="M4 20V4M4 20h16"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/>',
    broom: '<path d="M14 4l6 6M12 6l6 6-7 7H6l-1-5z"/>',
    bucket: '<path d="M5 10l7-7 7 7-7 7z"/><path d="M19 14s2 2.5 2 4a2 2 0 0 1-4 0c0-1.5 2-4 2-4z"/>',
    marker: '<path d="M15 4l5 5-9 9H6v-5z"/><path d="M4 20h7"/>',
    brush: '<path d="M18 3l3 3-9 9-3-3z"/><path d="M9 12c-3 0-5 2-5 5 0 2-1 3-2 3 5 1 9-1 9-5"/>',
    pencil: '<path d="M16 3l5 5L8 21H3v-5z"/><path d="M13 6l5 5"/>',
    eraser: '<path d="M8 20l-5-5 10-10 7 7-8 8z"/><path d="M8 20h12M10 9l6 6"/>',
    spray: '<rect x="7" y="9" width="8" height="12" rx="2"/><path d="M9 9V6h4v3M17 5h.01M19 7h.01M19 3h.01M21 5h.01"/>',
    drop: '<path d="M12 3s7 7 7 12a7 7 0 0 1-14 0c0-5 7-12 7-12z"/>',
    rainbow: '<path d="M3 18a9 9 0 0 1 18 0M7 18a5 5 0 0 1 10 0"/>',
    hand: '<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V3.5a1.5 1.5 0 0 1 3 0V11M14 11V5a1.5 1.5 0 0 1 3 0v8c0 4-2 8-7 8-3 0-5-2-6-4l-2-4a1.5 1.5 0 0 1 2.6-1.5L8 14"/>',
    sticky: '<path d="M4 4h16v10l-6 6H4z"/><path d="M14 20v-6h6"/>',
    play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>',
    prev: '<path d="M6 5v14"/><path d="M20 5L9 12l11 7z" fill="currentColor"/>',
    next: '<path d="M18 5v14"/><path d="M4 5l11 7-11 7z" fill="currentColor"/>',
    pin: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M12 21L8 9l4-6 4 6z"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    cake: '<path d="M4 21h16v-8H4zM4 16c2 1 4 1 5.3 0s4.4-1 5.4 0 3.3 1 5.3 0M12 13V9M12 6a1 1 0 0 1 0-2c0 1 1 1 0 2z"/>',
    alarm: '<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2 2M5 3L2 6M19 3l3 3"/>',
    window: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>',
    wall: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M3 14h18M9 4v5M15 9v5M9 14v6"/>',
    thermo: '<path d="M14 14V5a2 2 0 0 0-4 0v9a4 4 0 1 0 4 0z"/>',
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
    sunrise: '<path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 4v5M9 7l3-3 3 3M3 13l2 1M21 13l-2 1"/>',
    sunset: '<path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 9V4M9 6l3 3 3-3M3 13l2 1M21 13l-2 1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    thumb: '<path d="M7 11v9H4v-9zM7 11l4-8c2 0 3 1 3 3v3h5a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 2H7"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    cloud: '<path d="M7 18a5 5 0 0 1-.7-9.9A6 6 0 0 1 18 8a4.5 4.5 0 0 1-.5 10z"/>',
    sunny: '<circle cx="12" cy="12" r="4.5" fill="#ffd60a" stroke="#ffb300"/><path stroke="#ffb300" d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
    partly: '<circle cx="9" cy="9" r="3.5" fill="#ffd60a" stroke="#ffb300"/><path d="M9 20a4 4 0 0 1-.5-8 5 5 0 0 1 9.6.7A3.7 3.7 0 0 1 18 20z" fill="#fff" stroke="#d1d5db"/>',
    cloudy: '<path d="M7 19a5 5 0 0 1-.7-9.9A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 10z" fill="#e5e7eb" stroke="#9ca3af"/>',
    fog: '<path d="M4 9h16M3 13h18M5 17h14" stroke="#cbd5e1"/>',
    rain: '<path d="M7 14a4.5 4.5 0 0 1-.6-8.9A5.5 5.5 0 0 1 17 6a4 4 0 0 1-.5 8z" fill="#e5e7eb" stroke="#9ca3af"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" stroke="#60a5fa"/>',
    snow: '<path d="M7 13a4.5 4.5 0 0 1-.6-8.9A5.5 5.5 0 0 1 17 5a4 4 0 0 1-.5 8z" fill="#e5e7eb" stroke="#9ca3af"/><path d="M8 17h.01M12 19h.01M16 17h.01M10 21h.01M14 21h.01" stroke="#fff" stroke-width="3"/>',
    storm: '<path d="M7 13a4.5 4.5 0 0 1-.6-8.9A5.5 5.5 0 0 1 17 5a4 4 0 0 1-.5 8z" fill="#9ca3af" stroke="#6b7280"/><path d="M13 13l-3 4h3l-2 4" stroke="#ffd60a"/>'
  };
  PatOS.symPaths = P;
  PatOS.sym = (name, cls) => `<svg class="sym${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
  // emoji that the interface used to use as icons, and the drawn symbol that replaces each one
  const MAP = {
    '🖥': 'desktop', '📄': 'doc', '⬇': 'download', '⬆': 'upload', '🖼': 'image', '🎵': 'music', '🏠': 'home', '🚀': 'apps', '🗑': 'trash', '⚙': 'gear', '🎨': 'palette', '🧭': 'dock',
    '🔊': 'speaker', '🔇': 'mute', '🔒': 'lock', '📶': 'wifi', '⌨': 'keyboard', '💾': 'save', '🗂': 'folder', '📊': 'chart', '📽': 'slides', '📋': 'form', '🌙': 'moon', '☀': 'sun', '◐': 'contrast',
    '⛶': 'fullscreen', '✦': 'sparkle', '♪': 'note', '🕘': 'history', '📸': 'camera', '📷': 'camera', '🔍': 'search', '🖨': 'print', '🔗': 'link', '🧹': 'broom', '🪣': 'bucket', '🖍': 'marker',
    '🖌': 'brush', '✏': 'pencil', '🧽': 'eraser', '💨': 'spray', '💧': 'drop', '🌈': 'rainbow', '✋': 'hand', '🗒': 'sticky', '⏮': 'prev', '⏭': 'next', '⏸': 'pause', '▶': 'play', '📍': 'pin',
    '💎': 'gem', '⚡': 'bolt', '🎂': 'cake', '⏰': 'alarm', '🪟': 'window', '🧱': 'wall', '🌡': 'thermo', '🌅': 'sunrise', '🌇': 'sunset', '📅': 'calendar', '🕒': 'clock', '👍': 'thumb',
    '⚠': 'warn', '☁': 'cloudy', '⛅': 'partly', '🌤': 'partly', '🌫': 'fog', '🌦': 'rain', '🌧': 'rain', '🌨': 'snow', '❄': 'snow', '⛈': 'storm', '📂': 'folder', '☀️': 'sunny'
  };
  const WEATHER = { '☀': 'sunny', '🌤': 'partly', '⛅': 'partly', '☁': 'cloudy', '🌫': 'fog', '🌦': 'rain', '🌧': 'rain', '🌨': 'snow', '❄': 'snow', '⛈': 'storm' };
  /* used by PatOS.h: turns an emoji icon (alone, or at the start of a label) into a drawn symbol */
  PatOS.symFor = function (str) {
    if (!str || str.length > 60) return null;
    const s = str.replace(/️/g, '');
    const m = /^(\S{1,2}?)(?:\s+(.*))?$/u.exec(s); if (!m) return null;
    const icon = m[1], rest = m[2];
    const name = MAP[icon]; if (!name) return null;
    const wrap = document.createElement('span'); wrap.className = 'symw';
    wrap.innerHTML = PatOS.sym(WEATHER[icon] && !rest ? WEATHER[icon] : name, WEATHER[icon] && !rest ? 'wx' : '');
    if (rest === undefined) return wrap;
    const frag = document.createDocumentFragment(); frag.appendChild(wrap); frag.appendChild(document.createTextNode(' ' + rest)); return frag;
  };
})();
