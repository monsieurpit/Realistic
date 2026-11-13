/* Dates and times written in plain words, English and French: "tomorrow at 5pm", "friday 3pm", "le 12 mars", "dans 3 jours".
   Shared by Reminders (quick add), Pat and PatOS Intelligence (js/intelligence.js), so a date means the same thing everywhere.
   Loaded at start-up (it is small): before 3.2 it lived inside the Reminders app, which only loads when opened, so Pat
   understood no dates until Reminders had been opened once. */
(function () {
  'use strict';
  /* ---------- quick add: dates, times, priority and list written in the text (English and French) ---------- */
  const WD = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };
  const MO = { january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8, sept: 8, sep: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
    janvier: 0, janv: 0, 'février': 1, fevrier: 1, 'févr': 1, mars: 2, avril: 3, mai: 4, juin: 5, juillet: 6, juil: 6, 'août': 7, aout: 7, septembre: 8, octobre: 9, novembre: 10, 'décembre': 11, decembre: 11, 'déc': 11 };
  function parseReminder(raw, lists, now) {
    now = now || new Date();
    const out = {}; let s = ' ' + String(raw).replace(/\s+/g, ' ') + ' ';
    const take = (re, fn) => { const m = s.match(re); if (!m) return false; const r = fn(m); if (r === false) return false; s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length); return true; };
    const day = (d) => PatOS.dateKey(d);
    const plus = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return d; };
    take(/\s(!{1,3})(?=\s)/, (m) => { out.prio = m[1].length; });
    if (lists) take(/\s#([\p{L}\d_-]+)(?=\s)/u, (m) => { const L = lists.find((l) => l.name.toLowerCase().replace(/\s+/g, '') === m[1].toLowerCase()); if (!L) return false; out.list = L.id; });
    take(/\s(?:at\s|à\s|a\s)?(noon|midi)(?=\s)/i, () => { out.time = '12:00'; });
    if (!out.time) take(/\s(?:at|à|vers)\s+(\d{1,2})(?:[:h](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|h)?(?=\s)/i, (m) => { let hh = +m[1]; const mm = +(m[2] || 0); const ap = (m[3] || '').toLowerCase(); if (hh > 23 || mm > 59) return false; if (ap.startsWith('p') && hh < 12) hh += 12; if (ap.startsWith('a') && hh === 12) hh = 0; if (!ap && hh >= 1 && hh <= 7) hh += 12; out.time = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); });
    if (!out.time) take(/\s(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)(?=\s)/i, (m) => { let hh = +m[1]; const mm = +(m[2] || 0); if (hh > 12 || mm > 59) return false; if (m[3][0].toLowerCase() === 'p' && hh < 12) hh += 12; if (m[3][0].toLowerCase() === 'a' && hh === 12) hh = 0; out.time = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); });
    if (!out.time) take(/\s(\d{1,2})h(\d{2})?(?=\s)/i, (m) => { const hh = +m[1], mm = +(m[2] || 0); if (hh > 23 || mm > 59) return false; out.time = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); });
    if (!out.time) take(/\s(\d{1,2}):(\d{2})(?=\s)/, (m) => { const hh = +m[1], mm = +m[2]; if (hh > 23 || mm > 59) return false; out.time = m[1].padStart(2, '0') + ':' + m[2]; });
    take(/\s(tonight|ce soir)(?=\s)/i, () => { out.due = day(now); if (!out.time) out.time = '19:00'; });
    if (!out.due) take(/\s(day after tomorrow|après-demain|apres-demain)(?=\s)/i, () => { out.due = day(plus(2)); });
    if (!out.due) take(/\s(today|aujourd['’]hui|auj)(?=\s)/i, () => { out.due = day(now); });
    if (!out.due) take(/\s(tomorrow|tmrw|tmr|demain)(?=\s)/i, () => { out.due = day(plus(1)); });
    if (!out.due) take(/\s(next week|la semaine prochaine|semaine prochaine)(?=\s)/i, () => { out.due = day(plus(7)); });
    if (!out.due) take(/\s(?:in|dans)\s+(\d{1,3})\s+(days?|jours?|weeks?|semaines?)(?=\s)/i, (m) => { out.due = day(plus(+m[1] * (/^(w|s)/i.test(m[2]) ? 7 : 1))); });
    if (!out.due) take(/\s(?:on\s|le\s|ce\s)?(next\s)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi)(\sprochain)?(?=\s)/i, (m) => { const want = WD[m[2].toLowerCase()]; let n = (want - now.getDay() + 7) % 7; if (n === 0) n = 7; out.due = day(plus(n)); });
    if (!out.due) take(/\s(?:on\s|le\s)?(\d{1,2})(?:er)?\s+([a-zéû]{3,9})\.?(?=\s)/i, (m) => { const mo = MO[m[2].toLowerCase()]; const dd = +m[1]; if (mo == null || dd < 1 || dd > 31) return false; const d = new Date(now.getFullYear(), mo, dd, 12); if (day(d) < day(now)) d.setFullYear(d.getFullYear() + 1); out.due = day(d); });
    if (!out.due) take(/\s(?:on\s)?([a-zéû]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?=\s)/i, (m) => { const mo = MO[m[1].toLowerCase()]; const dd = +m[2]; if (mo == null || dd < 1 || dd > 31) return false; const d = new Date(now.getFullYear(), mo, dd, 12); if (day(d) < day(now)) d.setFullYear(d.getFullYear() + 1); out.due = day(d); });
    if (!out.due) take(/\s(\d{4})-(\d{2})-(\d{2})(?=\s)/, (m) => { out.due = m[1] + '-' + m[2] + '-' + m[3]; });
    // a time with no day: today if it's still ahead, otherwise tomorrow
    if (out.time && !out.due) out.due = out.time > now.toTimeString().slice(0, 5) ? day(now) : day(plus(1));
    out.text = s.replace(/\s+/g, ' ').replace(/\s(at|à|on|le|by|pour)$/i, '').trim();
    if (!out.text) out.text = String(raw).trim();
    return out;
  }
  PatOS.parseReminder = parseReminder;
})();
