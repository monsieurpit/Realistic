/* What Pat knows without the internet, in English and French (js/intel-know.js reads it). Loaded only the first time a
   question needs it, and kept for offline use like the rest of PatOS.
   countries: "English name|French name|capital (EN)|capital (FR)|continent code|currency"
   elements:  "symbol|English|French" in atomic order (index + 1 = atomic number)
   planets:   name EN, FR, moons, average distance from the Sun (million km), day length, year length
   facts:     [words that must all be there, English answer, French answer] */
window.PatKnowledge = {
  countries: `Afghanistan|Afghanistan|Kabul|Kaboul|AS|AFN
Albania|Albanie|Tirana|Tirana|EU|ALL
Algeria|Algérie|Algiers|Alger|AF|DZD
Andorra|Andorre|Andorra la Vella|Andorre-la-Vieille|EU|EUR
Angola|Angola|Luanda|Luanda|AF|AOA
Antigua and Barbuda|Antigua-et-Barbuda|Saint John's|Saint John's|NA|XCD
Argentina|Argentine|Buenos Aires|Buenos Aires|SA|ARS
Armenia|Arménie|Yerevan|Erevan|AS|AMD
Australia|Australie|Canberra|Canberra|OC|AUD
Austria|Autriche|Vienna|Vienne|EU|EUR
Azerbaijan|Azerbaïdjan|Baku|Bakou|AS|AZN
Bahamas|Bahamas|Nassau|Nassau|NA|BSD
Bahrain|Bahreïn|Manama|Manama|AS|BHD
Bangladesh|Bangladesh|Dhaka|Dacca|AS|BDT
Barbados|Barbade|Bridgetown|Bridgetown|NA|BBD
Belarus|Biélorussie|Minsk|Minsk|EU|BYN
Belgium|Belgique|Brussels|Bruxelles|EU|EUR
Belize|Belize|Belmopan|Belmopan|NA|BZD
Benin|Bénin|Porto-Novo|Porto-Novo|AF|XOF
Bhutan|Bhoutan|Thimphu|Thimphou|AS|BTN
Bolivia|Bolivie|Sucre|Sucre|SA|BOB
Bosnia and Herzegovina|Bosnie-Herzégovine|Sarajevo|Sarajevo|EU|BAM
Botswana|Botswana|Gaborone|Gaborone|AF|BWP
Brazil|Brésil|Brasília|Brasilia|SA|BRL
Brunei|Brunei|Bandar Seri Begawan|Bandar Seri Begawan|AS|BND
Bulgaria|Bulgarie|Sofia|Sofia|EU|BGN
Burkina Faso|Burkina Faso|Ouagadougou|Ouagadougou|AF|XOF
Burundi|Burundi|Gitega|Gitega|AF|BIF
Cambodia|Cambodge|Phnom Penh|Phnom Penh|AS|KHR
Cameroon|Cameroun|Yaoundé|Yaoundé|AF|XAF
Canada|Canada|Ottawa|Ottawa|NA|CAD
Cape Verde|Cap-Vert|Praia|Praia|AF|CVE
Central African Republic|République centrafricaine|Bangui|Bangui|AF|XAF
Chad|Tchad|N'Djamena|N'Djamena|AF|XAF
Chile|Chili|Santiago|Santiago|SA|CLP
China|Chine|Beijing|Pékin|AS|CNY
Colombia|Colombie|Bogotá|Bogota|SA|COP
Comoros|Comores|Moroni|Moroni|AF|KMF
Congo|Congo|Brazzaville|Brazzaville|AF|XAF
Democratic Republic of the Congo|République démocratique du Congo|Kinshasa|Kinshasa|AF|CDF
Costa Rica|Costa Rica|San José|San José|NA|CRC
Croatia|Croatie|Zagreb|Zagreb|EU|EUR
Cuba|Cuba|Havana|La Havane|NA|CUP
Cyprus|Chypre|Nicosia|Nicosie|EU|EUR
Czech Republic|Tchéquie|Prague|Prague|EU|CZK
Denmark|Danemark|Copenhagen|Copenhague|EU|DKK
Djibouti|Djibouti|Djibouti|Djibouti|AF|DJF
Dominica|Dominique|Roseau|Roseau|NA|XCD
Dominican Republic|République dominicaine|Santo Domingo|Saint-Domingue|NA|DOP
Ecuador|Équateur|Quito|Quito|SA|USD
Egypt|Égypte|Cairo|Le Caire|AF|EGP
El Salvador|Salvador|San Salvador|San Salvador|NA|USD
Equatorial Guinea|Guinée équatoriale|Malabo|Malabo|AF|XAF
Eritrea|Érythrée|Asmara|Asmara|AF|ERN
Estonia|Estonie|Tallinn|Tallinn|EU|EUR
Eswatini|Eswatini|Mbabane|Mbabane|AF|SZL
Ethiopia|Éthiopie|Addis Ababa|Addis-Abeba|AF|ETB
Fiji|Fidji|Suva|Suva|OC|FJD
Finland|Finlande|Helsinki|Helsinki|EU|EUR
France|France|Paris|Paris|EU|EUR
Gabon|Gabon|Libreville|Libreville|AF|XAF
Gambia|Gambie|Banjul|Banjul|AF|GMD
Georgia|Géorgie|Tbilisi|Tbilissi|AS|GEL
Germany|Allemagne|Berlin|Berlin|EU|EUR
Ghana|Ghana|Accra|Accra|AF|GHS
Greece|Grèce|Athens|Athènes|EU|EUR
Grenada|Grenade|Saint George's|Saint-Georges|NA|XCD
Guatemala|Guatemala|Guatemala City|Guatemala|NA|GTQ
Guinea|Guinée|Conakry|Conakry|AF|GNF
Guinea-Bissau|Guinée-Bissau|Bissau|Bissau|AF|XOF
Guyana|Guyana|Georgetown|Georgetown|SA|GYD
Haiti|Haïti|Port-au-Prince|Port-au-Prince|NA|HTG
Honduras|Honduras|Tegucigalpa|Tegucigalpa|NA|HNL
Hungary|Hongrie|Budapest|Budapest|EU|HUF
Iceland|Islande|Reykjavík|Reykjavik|EU|ISK
India|Inde|New Delhi|New Delhi|AS|INR
Indonesia|Indonésie|Jakarta|Jakarta|AS|IDR
Iran|Iran|Tehran|Téhéran|AS|IRR
Iraq|Irak|Baghdad|Bagdad|AS|IQD
Ireland|Irlande|Dublin|Dublin|EU|EUR
Israel|Israël|Jerusalem|Jérusalem|AS|ILS
Italy|Italie|Rome|Rome|EU|EUR
Ivory Coast|Côte d'Ivoire|Yamoussoukro|Yamoussoukro|AF|XOF
Jamaica|Jamaïque|Kingston|Kingston|NA|JMD
Japan|Japon|Tokyo|Tokyo|AS|JPY
Jordan|Jordanie|Amman|Amman|AS|JOD
Kazakhstan|Kazakhstan|Astana|Astana|AS|KZT
Kenya|Kenya|Nairobi|Nairobi|AF|KES
Kiribati|Kiribati|Tarawa|Tarawa|OC|AUD
Kuwait|Koweït|Kuwait City|Koweït|AS|KWD
Kyrgyzstan|Kirghizistan|Bishkek|Bichkek|AS|KGS
Laos|Laos|Vientiane|Vientiane|AS|LAK
Latvia|Lettonie|Riga|Riga|EU|EUR
Lebanon|Liban|Beirut|Beyrouth|AS|LBP
Lesotho|Lesotho|Maseru|Maseru|AF|LSL
Liberia|Liberia|Monrovia|Monrovia|AF|LRD
Libya|Libye|Tripoli|Tripoli|AF|LYD
Liechtenstein|Liechtenstein|Vaduz|Vaduz|EU|CHF
Lithuania|Lituanie|Vilnius|Vilnius|EU|EUR
Luxembourg|Luxembourg|Luxembourg|Luxembourg|EU|EUR
Madagascar|Madagascar|Antananarivo|Antananarivo|AF|MGA
Malawi|Malawi|Lilongwe|Lilongwe|AF|MWK
Malaysia|Malaisie|Kuala Lumpur|Kuala Lumpur|AS|MYR
Maldives|Maldives|Malé|Malé|AS|MVR
Mali|Mali|Bamako|Bamako|AF|XOF
Malta|Malte|Valletta|La Valette|EU|EUR
Marshall Islands|Îles Marshall|Majuro|Majuro|OC|USD
Mauritania|Mauritanie|Nouakchott|Nouakchott|AF|MRU
Mauritius|Maurice|Port Louis|Port-Louis|AF|MUR
Mexico|Mexique|Mexico City|Mexico|NA|MXN
Micronesia|Micronésie|Palikir|Palikir|OC|USD
Moldova|Moldavie|Chișinău|Chisinau|EU|MDL
Monaco|Monaco|Monaco|Monaco|EU|EUR
Mongolia|Mongolie|Ulaanbaatar|Oulan-Bator|AS|MNT
Montenegro|Monténégro|Podgorica|Podgorica|EU|EUR
Morocco|Maroc|Rabat|Rabat|AF|MAD
Mozambique|Mozambique|Maputo|Maputo|AF|MZN
Myanmar|Birmanie|Naypyidaw|Naypyidaw|AS|MMK
Namibia|Namibie|Windhoek|Windhoek|AF|NAD
Nauru|Nauru|Yaren|Yaren|OC|AUD
Nepal|Népal|Kathmandu|Katmandou|AS|NPR
Netherlands|Pays-Bas|Amsterdam|Amsterdam|EU|EUR
New Zealand|Nouvelle-Zélande|Wellington|Wellington|OC|NZD
Nicaragua|Nicaragua|Managua|Managua|NA|NIO
Niger|Niger|Niamey|Niamey|AF|XOF
Nigeria|Nigeria|Abuja|Abuja|AF|NGN
North Korea|Corée du Nord|Pyongyang|Pyongyang|AS|KPW
North Macedonia|Macédoine du Nord|Skopje|Skopje|EU|MKD
Norway|Norvège|Oslo|Oslo|EU|NOK
Oman|Oman|Muscat|Mascate|AS|OMR
Pakistan|Pakistan|Islamabad|Islamabad|AS|PKR
Palau|Palaos|Ngerulmud|Ngerulmud|OC|USD
Panama|Panama|Panama City|Panama|NA|PAB
Papua New Guinea|Papouasie-Nouvelle-Guinée|Port Moresby|Port Moresby|OC|PGK
Paraguay|Paraguay|Asunción|Asuncion|SA|PYG
Peru|Pérou|Lima|Lima|SA|PEN
Philippines|Philippines|Manila|Manille|AS|PHP
Poland|Pologne|Warsaw|Varsovie|EU|PLN
Portugal|Portugal|Lisbon|Lisbonne|EU|EUR
Qatar|Qatar|Doha|Doha|AS|QAR
Romania|Roumanie|Bucharest|Bucarest|EU|RON
Russia|Russie|Moscow|Moscou|EU|RUB
Rwanda|Rwanda|Kigali|Kigali|AF|RWF
Saint Kitts and Nevis|Saint-Christophe-et-Niévès|Basseterre|Basseterre|NA|XCD
Saint Lucia|Sainte-Lucie|Castries|Castries|NA|XCD
Saint Vincent and the Grenadines|Saint-Vincent-et-les-Grenadines|Kingstown|Kingstown|NA|XCD
Samoa|Samoa|Apia|Apia|OC|WST
San Marino|Saint-Marin|San Marino|Saint-Marin|EU|EUR
Sao Tome and Principe|Sao Tomé-et-Principe|São Tomé|Sao Tomé|AF|STN
Saudi Arabia|Arabie saoudite|Riyadh|Riyad|AS|SAR
Senegal|Sénégal|Dakar|Dakar|AF|XOF
Serbia|Serbie|Belgrade|Belgrade|EU|RSD
Seychelles|Seychelles|Victoria|Victoria|AF|SCR
Sierra Leone|Sierra Leone|Freetown|Freetown|AF|SLE
Singapore|Singapour|Singapore|Singapour|AS|SGD
Slovakia|Slovaquie|Bratislava|Bratislava|EU|EUR
Slovenia|Slovénie|Ljubljana|Ljubljana|EU|EUR
Solomon Islands|Îles Salomon|Honiara|Honiara|OC|SBD
Somalia|Somalie|Mogadishu|Mogadiscio|AF|SOS
South Africa|Afrique du Sud|Pretoria|Pretoria|AF|ZAR
South Korea|Corée du Sud|Seoul|Séoul|AS|KRW
South Sudan|Soudan du Sud|Juba|Djouba|AF|SSP
Spain|Espagne|Madrid|Madrid|EU|EUR
Sri Lanka|Sri Lanka|Sri Jayawardenepura Kotte|Sri Jayawardenapura Kotte|AS|LKR
Sudan|Soudan|Khartoum|Khartoum|AF|SDG
Suriname|Suriname|Paramaribo|Paramaribo|SA|SRD
Sweden|Suède|Stockholm|Stockholm|EU|SEK
Switzerland|Suisse|Bern|Berne|EU|CHF
Syria|Syrie|Damascus|Damas|AS|SYP
Taiwan|Taïwan|Taipei|Taipei|AS|TWD
Tajikistan|Tadjikistan|Dushanbe|Douchanbé|AS|TJS
Tanzania|Tanzanie|Dodoma|Dodoma|AF|TZS
Thailand|Thaïlande|Bangkok|Bangkok|AS|THB
Timor-Leste|Timor oriental|Dili|Dili|AS|USD
Togo|Togo|Lomé|Lomé|AF|XOF
Tonga|Tonga|Nuku'alofa|Nuku'alofa|OC|TOP
Trinidad and Tobago|Trinité-et-Tobago|Port of Spain|Port-d'Espagne|NA|TTD
Tunisia|Tunisie|Tunis|Tunis|AF|TND
Turkey|Turquie|Ankara|Ankara|AS|TRY
Turkmenistan|Turkménistan|Ashgabat|Achgabat|AS|TMT
Tuvalu|Tuvalu|Funafuti|Funafuti|OC|AUD
Uganda|Ouganda|Kampala|Kampala|AF|UGX
Ukraine|Ukraine|Kyiv|Kiev|EU|UAH
United Arab Emirates|Émirats arabes unis|Abu Dhabi|Abou Dabi|AS|AED
United Kingdom|Royaume-Uni|London|Londres|EU|GBP
United States|États-Unis|Washington, D.C.|Washington|NA|USD
Uruguay|Uruguay|Montevideo|Montevideo|SA|UYU
Uzbekistan|Ouzbékistan|Tashkent|Tachkent|AS|UZS
Vanuatu|Vanuatu|Port Vila|Port-Vila|OC|VUV
Vatican City|Vatican|Vatican City|Vatican|EU|EUR
Venezuela|Venezuela|Caracas|Caracas|SA|VES
Vietnam|Viêt Nam|Hanoi|Hanoï|AS|VND
Yemen|Yémen|Sanaa|Sanaa|AS|YER
Zambia|Zambie|Lusaka|Lusaka|AF|ZMW
Zimbabwe|Zimbabwe|Harare|Harare|AF|ZWL`,
  aliases: { usa: 'United States', us: 'United States', 'united states of america': 'United States', america: 'United States', 'etats-unis': 'United States', uk: 'United Kingdom', 'great britain': 'United Kingdom', britain: 'United Kingdom', england: 'United Kingdom', angleterre: 'United Kingdom', holland: 'Netherlands', 'south korea': 'South Korea', korea: 'South Korea', coree: 'South Korea', drc: 'Democratic Republic of the Congo', 'czechia': 'Czech Republic', 'cote d\'ivoire': 'Ivory Coast', burma: 'Myanmar', uae: 'United Arab Emirates', vatican: 'Vatican City', swaziland: 'Eswatini' },
  continents: { AF: ['Africa', 'Afrique'], AS: ['Asia', 'Asie'], EU: ['Europe', 'Europe'], NA: ['North America', 'Amérique du Nord'], SA: ['South America', 'Amérique du Sud'], OC: ['Oceania', 'Océanie'] },
  elements: `H|Hydrogen|Hydrogène,He|Helium|Hélium,Li|Lithium|Lithium,Be|Beryllium|Béryllium,B|Boron|Bore,C|Carbon|Carbone,N|Nitrogen|Azote,O|Oxygen|Oxygène,F|Fluorine|Fluor,Ne|Neon|Néon,Na|Sodium|Sodium,Mg|Magnesium|Magnésium,Al|Aluminium|Aluminium,Si|Silicon|Silicium,P|Phosphorus|Phosphore,S|Sulfur|Soufre,Cl|Chlorine|Chlore,Ar|Argon|Argon,K|Potassium|Potassium,Ca|Calcium|Calcium,Sc|Scandium|Scandium,Ti|Titanium|Titane,V|Vanadium|Vanadium,Cr|Chromium|Chrome,Mn|Manganese|Manganèse,Fe|Iron|Fer,Co|Cobalt|Cobalt,Ni|Nickel|Nickel,Cu|Copper|Cuivre,Zn|Zinc|Zinc,Ga|Gallium|Gallium,Ge|Germanium|Germanium,As|Arsenic|Arsenic,Se|Selenium|Sélénium,Br|Bromine|Brome,Kr|Krypton|Krypton,Rb|Rubidium|Rubidium,Sr|Strontium|Strontium,Y|Yttrium|Yttrium,Zr|Zirconium|Zirconium,Nb|Niobium|Niobium,Mo|Molybdenum|Molybdène,Tc|Technetium|Technétium,Ru|Ruthenium|Ruthénium,Rh|Rhodium|Rhodium,Pd|Palladium|Palladium,Ag|Silver|Argent,Cd|Cadmium|Cadmium,In|Indium|Indium,Sn|Tin|Étain,Sb|Antimony|Antimoine,Te|Tellurium|Tellure,I|Iodine|Iode,Xe|Xenon|Xénon,Cs|Caesium|Césium,Ba|Barium|Baryum,La|Lanthanum|Lanthane,Ce|Cerium|Cérium,Pr|Praseodymium|Praséodyme,Nd|Neodymium|Néodyme,Pm|Promethium|Prométhium,Sm|Samarium|Samarium,Eu|Europium|Europium,Gd|Gadolinium|Gadolinium,Tb|Terbium|Terbium,Dy|Dysprosium|Dysprosium,Ho|Holmium|Holmium,Er|Erbium|Erbium,Tm|Thulium|Thulium,Yb|Ytterbium|Ytterbium,Lu|Lutetium|Lutécium,Hf|Hafnium|Hafnium,Ta|Tantalum|Tantale,W|Tungsten|Tungstène,Re|Rhenium|Rhénium,Os|Osmium|Osmium,Ir|Iridium|Iridium,Pt|Platinum|Platine,Au|Gold|Or,Hg|Mercury|Mercure,Tl|Thallium|Thallium,Pb|Lead|Plomb,Bi|Bismuth|Bismuth,Po|Polonium|Polonium,At|Astatine|Astate,Rn|Radon|Radon,Fr|Francium|Francium,Ra|Radium|Radium,Ac|Actinium|Actinium,Th|Thorium|Thorium,Pa|Protactinium|Protactinium,U|Uranium|Uranium,Np|Neptunium|Neptunium,Pu|Plutonium|Plutonium,Am|Americium|Américium,Cm|Curium|Curium,Bk|Berkelium|Berkélium,Cf|Californium|Californium,Es|Einsteinium|Einsteinium,Fm|Fermium|Fermium,Md|Mendelevium|Mendélévium,No|Nobelium|Nobélium,Lr|Lawrencium|Lawrencium,Rf|Rutherfordium|Rutherfordium,Db|Dubnium|Dubnium,Sg|Seaborgium|Seaborgium,Bh|Bohrium|Bohrium,Hs|Hassium|Hassium,Mt|Meitnerium|Meitnérium,Ds|Darmstadtium|Darmstadtium,Rg|Roentgenium|Roentgenium,Cn|Copernicium|Copernicium,Nh|Nihonium|Nihonium,Fl|Flerovium|Flérovium,Mc|Moscovium|Moscovium,Lv|Livermorium|Livermorium,Ts|Tennessine|Tennessine,Og|Oganesson|Oganesson`,
  planets: [['Mercury', 'Mercure', 0, 58, '59 days', '88 days'], ['Venus', 'Vénus', 0, 108, '243 days', '225 days'], ['Earth', 'Terre', 1, 150, '24 hours', '365.25 days'], ['Mars', 'Mars', 2, 228, '24.6 hours', '687 days'],
    ['Jupiter', 'Jupiter', 95, 778, '10 hours', '11.9 years'], ['Saturn', 'Saturne', 146, 1433, '10.7 hours', '29.5 years'], ['Uranus', 'Uranus', 28, 2872, '17 hours', '84 years'], ['Neptune', 'Neptune', 16, 4495, '16 hours', '165 years']],
  facts: [
    [['tallest', 'mountain'], 'Mount Everest, 8,849 m above sea level.', 'L’Everest, 8 849 m d’altitude.'], [['plus haute', 'montagne'], 'Mount Everest, 8,849 m.', 'L’Everest, 8 849 m d’altitude.'],
    [['longest', 'river'], 'The Nile (about 6,650 km), though some measure the Amazon as longer.', 'Le Nil (environ 6 650 km), même si certains mesurent l’Amazone plus long.'], [['plus long', 'fleuve'], 'The Nile.', 'Le Nil (environ 6 650 km).'],
    [['largest', 'ocean'], 'The Pacific Ocean.', 'L’océan Pacifique.'], [['plus grand', 'ocean'], 'The Pacific Ocean.', 'L’océan Pacifique.'],
    [['largest', 'country'], 'Russia, about 17.1 million km².', 'La Russie, environ 17,1 millions de km².'], [['plus grand', 'pays'], 'Russia.', 'La Russie, environ 17,1 millions de km².'],
    [['smallest', 'country'], 'Vatican City, 0.44 km².', 'Le Vatican, 0,44 km².'], [['plus petit', 'pays'], 'Vatican City.', 'Le Vatican, 0,44 km².'],
    [['most', 'populous', 'country'], 'India, then China (each about 1.4 billion people).', 'L’Inde, puis la Chine (environ 1,4 milliard d’habitants chacune).'],
    [['largest', 'desert'], 'Antarctica (a cold desert); the largest hot desert is the Sahara.', 'L’Antarctique (un désert froid); le plus grand désert chaud est le Sahara.'],
    [['largest', 'planet'], 'Jupiter.', 'Jupiter.'], [['plus grosse', 'planete'], 'Jupiter.', 'Jupiter.'], [['smallest', 'planet'], 'Mercury.', 'Mercure.'],
    [['closest', 'star'], 'The Sun; after it, Proxima Centauri, 4.24 light-years away.', 'Le Soleil; ensuite Proxima du Centaure, à 4,24 années-lumière.'],
    [['speed', 'light'], 'About 299,792 km per second.', 'Environ 299 792 km par seconde.'], [['vitesse', 'lumiere'], 'About 299,792 km/s.', 'Environ 299 792 km par seconde.'],
    [['speed', 'sound'], 'About 343 m per second in air at 20 °C.', 'Environ 343 m par seconde dans l’air à 20 °C.'],
    [['boiling', 'water'], '100 °C (212 °F) at sea level.', '100 °C au niveau de la mer.'], [['ebullition', 'eau'], '100 °C.', '100 °C au niveau de la mer.'],
    [['freezing', 'water'], '0 °C (32 °F).', '0 °C.'], [['how many', 'bones'], 'An adult has 206 bones.', 'Un adulte a 206 os.'], [['combien', 'os'], '206 bones.', 'Un adulte a 206 os.'],
    [['how many', 'continents'], 'Seven: Africa, Antarctica, Asia, Australia (Oceania), Europe, North America and South America.', 'Sept : Afrique, Antarctique, Asie, Océanie, Europe, Amérique du Nord et Amérique du Sud.'], [['combien', 'continents'], 'Seven.', 'Sept (ou six selon les écoles).'],
    [['how many', 'countries'], '195 (193 United Nations members plus 2 observers).', '195 (193 membres de l’ONU et 2 observateurs).'], [['combien', 'pays'], '195.', '195 (193 membres de l’ONU et 2 observateurs).'],
    [['how many', 'planets'], 'Eight: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune.', 'Huit : Mercure, Vénus, Terre, Mars, Jupiter, Saturne, Uranus et Neptune.'], [['combien', 'planetes'], 'Eight.', 'Huit.'],
    [['how many', 'days', 'year'], '365 (366 in a leap year).', '365 (366 dans une année bissextile).'], [['how many', 'weeks', 'year'], '52 weeks and 1 day (2 in a leap year).', '52 semaines et 1 jour.'],
    [['how many', 'hours', 'day'], '24.', '24.'], [['how many', 'seconds', 'hour'], '3,600.', '3 600.'], [['how many', 'minutes', 'day'], '1,440.', '1 440.'],
    [['mona lisa'], 'Leonardo da Vinci, in the early 1500s.', 'Léonard de Vinci, au début des années 1500.'], [['joconde'], 'Leonardo da Vinci.', 'Léonard de Vinci.'],
    [['invented', 'telephone'], 'Alexander Graham Bell patented it in 1876.', 'Alexander Graham Bell l’a breveté en 1876.'], [['invente', 'telephone'], 'Alexander Graham Bell.', 'Alexander Graham Bell, en 1876.'],
    [['invented', 'light bulb'], 'Thomas Edison made the first practical one in 1879 (others worked on it before him).', 'Thomas Edison a fait la première vraiment pratique en 1879.'], [['invented', 'internet'], 'Vint Cerf and Bob Kahn designed its basis (TCP/IP) in the 1970s; Tim Berners-Lee invented the Web in 1989.', 'Vint Cerf et Bob Kahn (TCP/IP, années 1970); Tim Berners-Lee a inventé le Web en 1989.'],
    [['first', 'moon'], 'Neil Armstrong, on July 20, 1969 (Apollo 11).', 'Neil Armstrong, le 20 juillet 1969 (Apollo 11).'], [['premier', 'lune'], 'Neil Armstrong, 1969.', 'Neil Armstrong, le 20 juillet 1969.'],
    [['world war 2', 'end'], '1945.', 'En 1945.'], [['world war ii', 'end'], '1945.', 'En 1945.'], [['world war 1', 'end'], '1918.', 'En 1918.'], [['seconde guerre', 'fin'], '1945.', 'En 1945.'],
    [['value', 'pi'], 'π ≈ 3.14159265.', 'π ≈ 3,14159265.'], [['valeur', 'pi'], 'π ≈ 3.14159.', 'π ≈ 3,14159265.'],
    [['meaning', 'life'], '42, according to The Hitchhiker’s Guide to the Galaxy. For the rest, you decide.', '42, selon Le Guide du voyageur galactique. Pour le reste, à toi de voir.'], [['sens', 'vie'], '42.', '42, selon Le Guide du voyageur galactique.'],
    [['how far', 'moon'], 'About 384,400 km on average.', 'Environ 384 400 km en moyenne.'], [['how far', 'sun'], 'About 150 million km (1 astronomical unit).', 'Environ 150 millions de km.'],
    [['how old', 'universe'], 'About 13.8 billion years.', 'Environ 13,8 milliards d’années.'], [['how old', 'earth'], 'About 4.54 billion years.', 'Environ 4,54 milliards d’années.'], [['age', 'terre'], '4.54 billion years.', 'Environ 4,54 milliards d’années.'],
    [['hottest', 'planet'], 'Venus (about 465 °C).', 'Vénus (environ 465 °C).'], [['biggest', 'animal'], 'The blue whale (up to about 30 m).', 'La baleine bleue (jusqu’à environ 30 m).'], [['plus gros', 'animal'], 'The blue whale.', 'La baleine bleue.'],
    [['fastest', 'animal'], 'The peregrine falcon in a dive (over 300 km/h); on land, the cheetah (about 110 km/h).', 'Le faucon pèlerin en piqué (plus de 300 km/h); sur terre, le guépard (environ 110 km/h).'],
    [['largest', 'organ'], 'The skin.', 'La peau.'], [['how many', 'teeth'], 'Adults have 32; children have 20 baby teeth.', 'Les adultes en ont 32; les enfants ont 20 dents de lait.'],
    [['how many', 'players', 'soccer'], '11 per team.', '11 par équipe.'], [['how many', 'players', 'hockey'], '6 per team on the ice (5 skaters and a goalie).', '6 par équipe sur la glace (5 joueurs et un gardien).'], [['how many', 'players', 'basketball'], '5 per team.', '5 par équipe.'],
    [['photosynthesis'], 'How plants use sunlight, water and carbon dioxide to make sugar and release oxygen.', 'Comment les plantes utilisent la lumière, l’eau et le gaz carbonique pour faire du sucre et libérer de l’oxygène.'],
    [['capital', 'quebec'], 'Quebec City.', 'La ville de Québec.'], [['capital', 'ontario'], 'Toronto.', 'Toronto.'], [['capital', 'british columbia'], 'Victoria.', 'Victoria.'], [['capital', 'alberta'], 'Edmonton.', 'Edmonton.'],
    [['largest', 'city', 'canada'], 'Toronto.', 'Toronto.'], [['largest', 'city', 'world'], 'Tokyo (about 37 million people in its metropolitan area).', 'Tokyo (environ 37 millions d’habitants dans l’agglomération).'],
    [['how many', 'provinces', 'canada'], '10 provinces and 3 territories.', '10 provinces et 3 territoires.'], [['combien', 'provinces'], '10 provinces and 3 territories.', '10 provinces et 3 territoires.'],
    [['how many', 'states', 'united states'], '50.', '50.'], [['how many', 'states', 'us'], '50.', '50.'], [['dna'], 'Deoxyribonucleic acid: the molecule that carries the genetic instructions of living things.', 'Acide désoxyribonucléique : la molécule qui porte les instructions génétiques des êtres vivants.'],
    [['gravity', 'earth'], 'About 9.81 m/s².', 'Environ 9,81 m/s².'], [['water', 'formula'], 'H₂O.', 'H₂O.'], [['formule', 'eau'], 'H₂O.', 'H₂O.']
  ]
};
