/* Elements — interactive periodic table with a molar mass calculator */
(function () {
  'use strict';
  const { h } = PatOS;
  // Z|symbol|name|mass|category   categories: a alkali, e alkaline earth, t transition, p post-transition, m metalloid, n nonmetal, h halogen, g noble gas, l lanthanide, c actinide
  const RAW = 'H|Hydrogen|1.008|n He|Helium|4.0026|g Li|Lithium|6.94|a Be|Beryllium|9.0122|e B|Boron|10.81|m C|Carbon|12.011|n N|Nitrogen|14.007|n O|Oxygen|15.999|n F|Fluorine|18.998|h Ne|Neon|20.180|g Na|Sodium|22.990|a Mg|Magnesium|24.305|e Al|Aluminium|26.982|p Si|Silicon|28.085|m P|Phosphorus|30.974|n S|Sulfur|32.06|n Cl|Chlorine|35.45|h Ar|Argon|39.948|g K|Potassium|39.098|a Ca|Calcium|40.078|e Sc|Scandium|44.956|t Ti|Titanium|47.867|t V|Vanadium|50.942|t Cr|Chromium|51.996|t Mn|Manganese|54.938|t Fe|Iron|55.845|t Co|Cobalt|58.933|t Ni|Nickel|58.693|t Cu|Copper|63.546|t Zn|Zinc|65.38|t Ga|Gallium|69.723|p Ge|Germanium|72.630|m As|Arsenic|74.922|m Se|Selenium|78.971|n Br|Bromine|79.904|h Kr|Krypton|83.798|g Rb|Rubidium|85.468|a Sr|Strontium|87.62|e Y|Yttrium|88.906|t Zr|Zirconium|91.224|t Nb|Niobium|92.906|t Mo|Molybdenum|95.95|t Tc|Technetium|98|t Ru|Ruthenium|101.07|t Rh|Rhodium|102.91|t Pd|Palladium|106.42|t Ag|Silver|107.87|t Cd|Cadmium|112.41|t In|Indium|114.82|p Sn|Tin|118.71|p Sb|Antimony|121.76|m Te|Tellurium|127.60|m I|Iodine|126.90|h Xe|Xenon|131.29|g Cs|Caesium|132.91|a Ba|Barium|137.33|e La|Lanthanum|138.91|l Ce|Cerium|140.12|l Pr|Praseodymium|140.91|l Nd|Neodymium|144.24|l Pm|Promethium|145|l Sm|Samarium|150.36|l Eu|Europium|151.96|l Gd|Gadolinium|157.25|l Tb|Terbium|158.93|l Dy|Dysprosium|162.50|l Ho|Holmium|164.93|l Er|Erbium|167.26|l Tm|Thulium|168.93|l Yb|Ytterbium|173.05|l Lu|Lutetium|174.97|l Hf|Hafnium|178.49|t Ta|Tantalum|180.95|t W|Tungsten|183.84|t Re|Rhenium|186.21|t Os|Osmium|190.23|t Ir|Iridium|192.22|t Pt|Platinum|195.08|t Au|Gold|196.97|t Hg|Mercury|200.59|t Tl|Thallium|204.38|p Pb|Lead|207.2|p Bi|Bismuth|208.98|p Po|Polonium|209|p At|Astatine|210|h Rn|Radon|222|g Fr|Francium|223|a Ra|Radium|226|e Ac|Actinium|227|c Th|Thorium|232.04|c Pa|Protactinium|231.04|c U|Uranium|238.03|c Np|Neptunium|237|c Pu|Plutonium|244|c Am|Americium|243|c Cm|Curium|247|c Bk|Berkelium|247|c Cf|Californium|251|c Es|Einsteinium|252|c Fm|Fermium|257|c Md|Mendelevium|258|c No|Nobelium|259|c Lr|Lawrencium|266|c Rf|Rutherfordium|267|t Db|Dubnium|268|t Sg|Seaborgium|269|t Bh|Bohrium|270|t Hs|Hassium|277|t Mt|Meitnerium|278|t Ds|Darmstadtium|281|t Rg|Roentgenium|282|t Cn|Copernicium|285|t Nh|Nihonium|286|p Fl|Flerovium|289|p Mc|Moscovium|290|p Lv|Livermorium|293|p Ts|Tennessine|294|h Og|Oganesson|294|g';
  const CATS = { a: ['Alkali metal', '#ff6b6b'], e: ['Alkaline earth metal', '#ffa94d'], t: ['Transition metal', '#ffd43b'], p: ['Post-transition metal', '#8ce99a'], m: ['Metalloid', '#63e6be'], n: ['Nonmetal', '#74c0fc'], h: ['Halogen', '#91a7ff'], g: ['Noble gas', '#da77f2'], l: ['Lanthanide', '#f783ac'], c: ['Actinide', '#e599f7'] };
  const GAS = ['H', 'He', 'N', 'O', 'F', 'Ne', 'Cl', 'Ar', 'Kr', 'Xe', 'Rn'], LIQ = ['Br', 'Hg'];
  const FR = 'Hydrogène Hélium Lithium Béryllium Bore Carbone Azote Oxygène Fluor Néon Sodium Magnésium Aluminium Silicium Phosphore Soufre Chlore Argon Potassium Calcium Scandium Titane Vanadium Chrome Manganèse Fer Cobalt Nickel Cuivre Zinc Gallium Germanium Arsenic Sélénium Brome Krypton Rubidium Strontium Yttrium Zirconium Niobium Molybdène Technétium Ruthénium Rhodium Palladium Argent Cadmium Indium Étain Antimoine Tellure Iode Xénon Césium Baryum Lanthane Cérium Praséodyme Néodyme Prométhium Samarium Europium Gadolinium Terbium Dysprosium Holmium Erbium Thulium Ytterbium Lutécium Hafnium Tantale Tungstène Rhénium Osmium Iridium Platine Or Mercure Thallium Plomb Bismuth Polonium Astate Radon Francium Radium Actinium Thorium Protactinium Uranium Neptunium Plutonium Américium Curium Berkélium Californium Einsteinium Fermium Mendélévium Nobélium Lawrencium Rutherfordium Dubnium Seaborgium Bohrium Hassium Meitnérium Darmstadtium Roentgenium Copernicium Nihonium Flérovium Moscovium Livermorium Tennesse Oganesson'.split(' ');
  const EL = RAW.split(' ').map((s, i) => { const [sym, en, mass, cat] = s.split('|'); return { z: i + 1, sym, en, fr: FR[i], get name() { return PatOS.lang === 'fr' ? this.fr : this.en; }, mass: +mass, cat }; });
  function pos(z) {
    if (z === 1) return [1, 1]; if (z === 2) return [1, 18];
    const rows = [[3, 10, 2], [11, 18, 3]];
    for (const [a, b, p] of rows) if (z >= a && z <= b) return [p, z - a < 2 ? z - a + 1 : z - a + 11];
    if (z <= 36) return [4, z - 18]; if (z <= 54) return [5, z - 36];
    if (z <= 56) return [6, z - 54]; if (z <= 71) return [9, z - 57 + 3]; if (z <= 86) return [6, z - 68];
    if (z <= 88) return [7, z - 86]; if (z <= 103) return [10, z - 89 + 3]; return [7, z - 100];
  }
  const bySym = {}; EL.forEach((e) => { bySym[e.sym] = e; });
  function molarMass(formula) {
    let i = 0; const s = formula.replace(/\s/g, '');
    function group() {
      const counts = {};
      while (i < s.length && s[i] !== ')') {
        let part = {};
        if (s[i] === '(') { i++; part = group(); if (s[i] !== ')') throw new Error('paren'); i++; }
        else { const m = /^[A-Z][a-z]?/.exec(s.slice(i)); if (!m || !bySym[m[0]]) throw new Error('el'); part[m[0]] = 1; i += m[0].length; }
        const n = /^\d+/.exec(s.slice(i)); const k = n ? +n[0] : 1; if (n) i += n[0].length;
        Object.keys(part).forEach((e) => { counts[e] = (counts[e] || 0) + part[e] * k; });
      }
      return counts;
    }
    const c = group(); if (i !== s.length || !Object.keys(c).length) throw new Error('bad');
    return { counts: c, mass: Object.entries(c).reduce((t, [e, n]) => t + bySym[e].mass * n, 0) };
  }
  PatOS.registerApp({
    id: 'elements', name: 'Elements', icon: 'elements', width: 1080, height: 660, category: 'Utilities', keywords: 'chemistry periodic table science atoms molar mass',
    about: 'The periodic table, with a molar mass calculator.',
    launch(win) {
      win.el.classList.add('has-toolbar');
      let sel = EL[0], filter = null;
      const q = h('input', { class: 'field', placeholder: 'Find an element', style: { width: '170px' } });
      const mm = h('input', { class: 'field', placeholder: 'Molar mass, e.g. H2O', style: { width: '170px' }, spellcheck: 'false' });
      const mmOut = h('span', { class: 'el-mm' });
      win.toolbar.append(mm, mmOut, h('div', { style: { flex: 1 } }), q); win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px';
      const grid = h('div', { class: 'el-grid' }), card = h('div', { class: 'el-card' }), legend = h('div', { class: 'el-legend' });
      win.body.appendChild(h('div', { class: 'el-wrap' }, h('div', { class: 'el-main' }, grid, legend), card));
      function render() {
        grid.innerHTML = ''; const ql = q.value.trim().toLowerCase();
        EL.forEach((e) => {
          const [r, c] = pos(e.z);
          const match = (!ql || e.en.toLowerCase().includes(ql) || e.fr.toLowerCase().includes(ql) || e.sym.toLowerCase() === ql || String(e.z) === ql) && (!filter || e.cat === filter);
          const cell = h('button', { class: 'el-cell' + (sel === e ? ' on' : '') + (match ? '' : ' dim'), style: { gridRow: r, gridColumn: c, '--c': CATS[e.cat][1] } }, h('small', {}, e.z), h('b', {}, e.sym), h('span', {}, e.name));
          cell.onclick = () => { sel = e; render(); };
          grid.appendChild(cell);
        });
        grid.appendChild(h('div', { class: 'el-gap', style: { gridRow: 8, gridColumn: '1 / -1' } }));
        grid.appendChild(h('div', { class: 'el-mark', style: { gridRow: 6, gridColumn: 3 } }, '57–71')); grid.appendChild(h('div', { class: 'el-mark', style: { gridRow: 7, gridColumn: 3 } }, '89–103'));
        legend.innerHTML = '';
        Object.entries(CATS).forEach(([k, [l, c]]) => { const b = h('button', { class: 'el-leg' + (filter === k ? ' on' : ''), style: { '--c': c } }, h('i'), PatOS.t(l)); b.onclick = () => { filter = filter === k ? null : k; render(); }; legend.appendChild(b); });
        const e = sel, [r, c] = pos(e.z);
        card.innerHTML = '';
        card.append(h('div', { class: 'el-big', style: { '--c': CATS[e.cat][1] } }, h('small', {}, e.z), h('b', {}, e.sym), h('span', {}, e.mass)),
          h('h2', {}, e.name), h('div', { class: 'el-cat', style: { color: CATS[e.cat][1] } }, PatOS.t(CATS[e.cat][0])),
          h('div', { class: 'el-props' }, ...[['Atomic number', e.z], ['Atomic mass', e.mass + ' u'], ['Period', r > 7 ? r - 3 : r], ['Group', r > 7 ? '3' : c], ['State at room temperature', PatOS.t(e.z > 100 ? 'Unknown' : GAS.includes(e.sym) ? 'Gas' : LIQ.includes(e.sym) ? 'Liquid' : 'Solid')], ['Protons', e.z], ['Electrons', e.z], ['Neutrons (most common)', Math.max(0, Math.round(e.mass) - e.z)]].map(([k, v]) => h('div', {}, h('span', {}, PatOS.t(k)), h('b', {}, String(v))))),
          h('button', { class: 'btn', onclick: () => PatOS.launch('browser', { url: (PatOS.lang === 'fr' ? 'https://fr' : 'https://en') + '.wikipedia.org/wiki/' + encodeURIComponent(PatOS.lang === 'fr' ? e.fr : e.en) }) }, PatOS.t('Read more')));
      }
      q.oninput = render;
      mm.oninput = () => { const v = mm.value.trim(); if (!v) { mmOut.textContent = ''; return; } try { const r = molarMass(v); mmOut.textContent = '= ' + r.mass.toFixed(3) + ' g/mol'; mmOut.classList.remove('err'); } catch (e) { mmOut.textContent = PatOS.t('not a valid formula'); mmOut.classList.add('err'); } };
      win.body.tabIndex = 0;
      win.body.addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT') return; const i = EL.indexOf(sel); if (e.key === 'ArrowRight') { sel = EL[Math.min(117, i + 1)]; render(); } if (e.key === 'ArrowLeft') { sel = EL[Math.max(0, i - 1)]; render(); } });
      render();
    }
  });
  PatOS.molarMass = molarMass;
})();
