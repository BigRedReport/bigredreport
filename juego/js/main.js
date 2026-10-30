// Bucle del juego, menús, entrada y cámara
"use strict";
(function () {
  const BRR = window.BRR, V = BRR.V, $ = id => document.getElementById(id);
  const canvas = $('c'); let R;
  try { R = new BRR.Renderer(canvas); } catch (e) { $('err').textContent = e.message; return; }

  // ---------- opciones ----------
  const DEF = { autoRes: true, scale: 100, fov: 70, far: 1500, filter: 'smooth', cam: 'cerca', fps: false, vehicle: 'JEEP', level: 'CITY1', team: 1, laps: 0, vsfx: 80, vmusic: 60, vvoice: 100, vmaster: 100, vengine: 80, vui: 70, vamb: 60, msrc: 'cd', aa: '1', parts: '1', fpslim: '0', hudw: 'full', hudstyle: 'moderno', touch: 'auto', aiPack: 'no', hudsc: 100, speedo: 'dig', hmini: true, hpos: true, htimes: true, hnitro: true, hmsg: true, hnames: false, cabin: true, hhelp: true, spatial: true, rumble: '1', cb: 'no', uiz: '100', assist: '0', rivLook: 'aleatorio', damage: '1', ground: 'suave', fxs: 'original', engSnd: 'mejorado', gloss: 'si', ssao: 'si', hora: 'original', clima: 'despejado', clouds: 'nuevas', menuImg: 'hd', autopause: true, menu: 'moderno', horn: 'normal', rivals: 5, diff: 2, light: 'moderna', shadows: 2, players: 1, origAI: true };
  let opt = { ...DEF };
  // perfiles: cada uno guarda sus ajustes, récords, campeonato y estadísticas aparte (claves con @perfil)
  let PROF = ''; try { PROF = localStorage.getItem('brr_profile') || ''; } catch (e) { }
  const pkey = k => PROF ? k + '@' + PROF : k;
  const ST = { get: k => { try { return localStorage.getItem(pkey(k)); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(pkey(k), v); } catch (e) { } },
    keys: () => { try { return Object.keys(localStorage).filter(k => PROF ? k.endsWith('@' + PROF) : !k.includes('@')).map(k => PROF ? k.slice(0, -PROF.length - 1) : k); } catch (e) { return []; } } };
  try { Object.assign(opt, JSON.parse(ST.get('brr_opt') || (PROF ? localStorage.getItem('brr_opt') : null) || '{}')); } catch (e) { }
  // 0.14: las funciones nuevas pasan a estar activadas por defecto (menú nuevo, texturas suavizadas, antialiasing); las ayudas siguen desactivadas
  if (!(opt.cfgv >= 2)) { Object.assign(opt, { menu: 'moderno', filter: 'smooth', aa: '1', light: 'moderna' }); opt.cfgv = 2; try { setTimeout(() => save(), 0); } catch (e) { } }
  // 0.92: carreras justas por defecto: rivales con físicas de verdad (no los grabados, que van «por raíles») y sin pelotón (cada uno a su ritmo)
  if (!(opt.cfgv >= 3)) { Object.assign(opt, { origAI: false, aiPack: 'no' }); opt.cfgv = 3; try { setTimeout(() => save(), 0); } catch (e) { } }
  // Steam Deck (lo indica el programa de escritorio): la primera vez, ajustes pensados para su pantalla de 7" (1280×800) y su gráfica
  const DECK = (() => { try { return new URLSearchParams(location.search).get('deck') === '1'; } catch (e) { return false; } })(); BRR.deck = DECK; if (DECK) document.documentElement.classList.add('deck');
  if (DECK && !opt.deckInit) { Object.assign(opt, { deckInit: 1, autoRes: true, shadows: 1, ssao: 'no', uiz: '115', hudsc: 115, aa: '1' }); try { setTimeout(() => save(), 0); } catch (e) { } }
  if (BRR.HORN_RENAMED && BRR.HORN_RENAMED[opt.horn]) opt.horn = BRR.HORN_RENAMED[opt.horn];
  if (!BRR.HORNS.some(h => h.id === opt.horn)) opt.horn = 'normal';
  if (typeof opt.logo === 'string' && opt.logo.startsWith('x:') && !(BRR.LOGOS_EXTRA || []).some(l => 'x:' + l.id === opt.logo)) opt.logo = 0;
  setTimeout(() => applyAccess(), 0); BRR.texHD = opt.filter !== 'nearest'; BRR.flatGround = opt.ground === 'original'; BRR.newClouds = opt.clouds !== 'originales';   BRR.menuImg = opt.menuImg || 'hd'; document.body.classList.toggle('img-pixel', BRR.menuImg === 'pixel');
  const save = () => ST.set('brr_opt', JSON.stringify(opt));
  function bindOptions() {
    const sync = () => {
      $('o_scale_v').textContent = opt.scale + '%'; $('o_fov_v').textContent = opt.fov + '°'; $('o_far_v').textContent = opt.far + ' m';
      const w = Math.round(innerWidth * devicePixelRatio * opt.scale / 100), h = Math.round(innerHeight * devicePixelRatio * opt.scale / 100);
      $('o_res').textContent = `Resolución interna: ${w}×${h}`;
    };
    for (const k of ['scale', 'fov', 'far']) { const el = $('o_' + k); el.value = opt[k]; el.oninput = () => { opt[k] = +el.value; sync(); resize(); save(); }; }
    for (const k of ['vsfx', 'vmusic', 'vvoice', 'vmaster', 'vengine', 'vui', 'vamb']) { const el = $('o_' + k); el.value = opt[k]; const sv = () => { const v = $('o_' + k + '_v'); if (v) v.textContent = opt[k] + '%'; }; sv(); el.oninput = () => { opt[k] = +el.value; sv(); applyVol(); save(); }; }
    // ajustes nuevos: listas y casillas que solo se guardan (se leen donde se usan)
    { const el = $('o_lang'); el.innerHTML = Object.entries(BRR.LANGS).map(([k, n]) => `<option value="${k}">${n}</option>`).join(''); el.value = BRR.lang(); el.onchange = () => BRR.setLang(el.value); }
    for (const k of ['ssao', 'gloss', 'engSnd', 'fxs', 'aa', 'parts', 'fpslim', 'hudw', 'hudstyle', 'aiPack', 'touch', 'speedo', 'rumble', 'msrc', 'rivLook', 'menuImg', 'cb', 'uiz', 'assist', 'damage', 'ground', 'clouds']) { const el = $('o_' + k); el.value = opt[k]; el.onchange = () => { opt[k] = el.value; save(); applyHud(); applyVol(); if (k === 'clouds') BRR.newClouds = opt.clouds !== 'originales'; if (k === 'fxs' && fx) fx.orig = opt.fxs !== 'moderno'; if (k === 'ssao') R.ssao = opt.ssao === 'no' ? 0 : 1; if (k === 'ground') { BRR.flatGround = opt.ground === 'original'; if (BRR.lvlCache) BRR.lvlCache.clear && BRR.lvlCache.clear(); } if (k === 'cb' || k === 'uiz') { applyAccess(); showTeamHead(); renderHomeProf(); } if (k === 'menuImg') { document.body.classList.toggle('img-pixel', opt.menuImg === 'pixel'); $('o_menuImg_n').hidden = false; } if (k === 'aa') R.fxaa = opt.aa === '1'; if (k === 'msrc' && state === 'menu') { if (audio) audio.stopMusic(); menuMusic(); } }; }
    for (const k of ['cabin', 'hmini', 'hpos', 'htimes', 'hnitro', 'hmsg', 'hnames', 'hhelp', 'spatial', 'autopause']) { const el = $('o_' + k); el.checked = !!opt[k]; el.onchange = () => { opt[k] = el.checked; save(); applyHud(); }; }
    { const el = $('o_hudsc'); el.value = opt.hudsc; const sv = () => $('o_hudsc_v').textContent = opt.hudsc + '%'; sv(); el.oninput = () => { opt.hudsc = +el.value; sv(); save(); applyHud(); }; }
    for (const b of document.querySelectorAll('.otabs button')) b.onclick = () => { for (const x of document.querySelectorAll('.otabs button')) x.classList.toggle('on', x === b); for (const pg of document.querySelectorAll('.opage')) pg.hidden = pg.dataset.op !== b.dataset.ot; };
    R.fxaa = opt.aa === '1'; R.ssao = opt.ssao === 'no' ? 0 : 1;
    for (const k of ['filter', 'cam']) { const el = $('o_' + k); el.value = opt[k]; el.onchange = () => { opt[k] = el.value; if (k === 'filter') { R.setFilterAll(opt.filter); BRR.texHD = opt.filter !== 'nearest'; } if (k === 'cam') for (const h of humans) { h.camMode = null; h.cam.init = h.cam.posInit = false; } save(); }; }
    $('o_light').value = opt.light; $('o_light').onchange = () => { opt.light = $('o_light').value; R.mode = opt.light === 'original' ? 0 : 1; R.setShadows(R.mode ? opt.shadows : 0); save(); };
    $('o_shadows').value = opt.shadows; $('o_shadows').onchange = () => { opt.shadows = +$('o_shadows').value; R.setShadows(R.mode ? opt.shadows : 0); save(); };
    $('o_fps').checked = opt.fps; $('o_fps').onchange = () => { opt.fps = $('o_fps').checked; save(); };
    $('o_origai').value = opt.origAI !== false ? '1' : '0'; $('o_origai').onchange = () => { opt.origAI = $('o_origai').value === '1'; save(); };
    $('o_auto').checked = opt.autoRes !== false; $('o_auto').onchange = () => { opt.autoRes = $('o_auto').checked; dyn = 1; resize(); save(); };
    // modo clásico: todo como se veía en 1995 (y vuelta a como lo tenías)
    const CLASSIC = { ssao: 'no', light: 'original', scale: 50, filter: 'nearest', far: 700, aa: '0', gloss: 'no', clouds: 'originales', ground: 'original', shadows: 0, fxs: 'original', hora: 'original', clima: 'despejado', engSnd: 'original', cabin: true, autoRes: false, hudstyle: 'original' };
    const clUI = () => { $('o_classic').textContent = opt.classicPrev ? 'Volver a mis ajustes' : 'Verlo como en 1995'; };
    $('o_classic').onclick = () => { if (opt.classicPrev) { Object.assign(opt, opt.classicPrev); opt.classicPrev = null; } else { const prev = {}; for (const k in CLASSIC) prev[k] = opt[k]; opt.classicPrev = prev; Object.assign(opt, CLASSIC); }
      save(); location.reload(); };
    clUI();
    $('o_full').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    sync();
  }
  function applyVol() { if (!audio) return; audio.musicSource = opt.msrc;
    audio.setVolumes({ master: opt.vmaster / 100, sfx: opt.vsfx / 100, music: opt.vmusic / 100, voice: opt.vvoice / 100, engine: opt.vengine / 100, ui: opt.vui / 100, amb: opt.vamb / 100 }); }
  // marcador: qué se ve, tamaño y ancho (pantallas ultrapanorámicas)
  function applyHud() {
    const st = document.documentElement.style; st.setProperty('--hudsc', opt.hudsc / 100);
    document.body.classList.toggle('hud169', opt.hudw === '169'); document.body.classList.toggle('hud-orig', opt.hudstyle === 'original');
    const cls = { 'hide-mini': !opt.hmini, 'hide-pos': !opt.hpos, 'hide-times': !opt.htimes, 'hide-nitro': !opt.hnitro, 'hide-msg': !opt.hmsg, 'hide-help': !opt.hhelp, 'hide-speed': opt.speedo === 'off', 'speed-ana': opt.speedo === 'ana' };
    for (const [k, v] of Object.entries(cls)) document.body.classList.toggle(k, v);
  }
  let dyn = 1, dynT = 0;   // resolución dinámica: baja sola si no se llega a ~55 fps
  function resize() {
    const s = Math.min(devicePixelRatio, 1.5) * opt.scale / 100 * (opt.autoRes !== false ? dyn : 1);
    canvas.width = Math.max(64, Math.round(innerWidth * s)); canvas.height = Math.max(64, Math.round(innerHeight * s));
  }
  addEventListener('resize', resize); resize(); bindOptions(); applyHud();

  // ---------- pantallas ----------
  const show = id => { for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id; };
  let terrainB = [], fx = null, props = null, files = null, lvl = null, car = null, statics = [], carDraw = null, state = 'folder', race = null, audio = null, snd = {}, rivals = [];
  const TEAM = [null, { n: 'Rojo', c: '#e23b3b', v: 'RED' }, { n: 'Verde', c: '#3bb54a', v: 'GREEN' }, { n: 'Amarillo', c: '#f2d230', v: 'YELLOW' },
    { n: 'Azul', c: '#3b6fe2', v: 'BLUE' }, { n: 'Naranja', c: '#f28c28', v: 'ORANGE' }, { n: 'Morado', c: '#9b4fd6', v: 'PURPLE' }];
  // accesibilidad: colores de equipo que se distinguen con daltonismo (paleta Okabe-Ito) en marcador, minimapa y nombres
  const TEAM_C0 = TEAM.map(t => t && t.c), CB = { deu: ['#d55e00', '#009e73', '#f0e442', '#0072b2', '#e69f00', '#cc79a7'], tri: ['#e8384f', '#2fb36b', '#ffffff', '#1f4e9c', '#f6a6b2', '#7f3c8d'] };
  function applyAccess() {
    for (let t = 1; t <= 6; t++) TEAM[t].c = CB[opt.cb] ? CB[opt.cb][t - 1] : TEAM_C0[t];
    document.documentElement.style.setProperty('--uiz', String((+opt.uiz || 100) / 100));
  }

  // carpeta: File System Access API (recordable) o input webkitdirectory
  const idb = () => new Promise((ok, ko) => { const r = indexedDB.open('brr', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => ok(r.result); r.onerror = ko; });
  const idbSet = async (k, v) => { const db = await idb(); return new Promise(ok => { const t = db.transaction('h', 'readwrite'); t.objectStore('h').put(v, k); t.oncomplete = ok; }); };
  const idbGet = async k => { const db = await idb(); return new Promise(ok => { const r = db.transaction('h').objectStore('h').get(k); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); }); };
  async function filesFromHandle(dir) {
    const out = [];
    // si se elige la carpeta que contiene BIGRED, entramos solo en BIGRED (y leemos la imagen del CD de la raíz)
    let hasBig = false; for await (const [name, h] of dir.entries()) if (h.kind === 'directory' && name.toUpperCase() === 'BIGRED') hasBig = true;
    async function walk(d, prefix, depth) {
      for await (const [name, h] of d.entries()) {
        if (h.kind === 'file') { const f = await h.getFile(); Object.defineProperty(f, 'webkitRelativePath', { value: prefix + name }); out.push(f); }
        else if (depth === 0 && hasBig ? name.toUpperCase() === 'BIGRED' : depth < (hasBig ? 2 : 1)) await walk(h, prefix + name + '/', depth + 1);
      }
    }
    await walk(dir, hasBig ? dir.name + '/' : 'BIGRED/', 0); return out;
  }
  async function useFiles(list) {
    const f = new BRR.Files(list);
    if (!f.list('.LEV').length) { $('folder_msg').textContent = 'En esa carpeta no hay circuitos (.LEV). Elige la carpeta BIGRED del juego.'; return; }
    try { f.setMods(((await idbGet('mods')) || []).filter(m => m.on)); } catch (e) { }
    files = f; audio = new BRR.Audio(files); applyVol(); loadCustomHorn(); loadMyMusic(); buildMenu(); show('menu'); state = 'menu'; go('home');
    // ¿has llegado con un enlace de invitación (?sala=CÓDIGO)? → directo a esa sala online
    try { const code = new URLSearchParams(location.search).get('sala'); if (code && /^[A-Z0-9]{3,12}$/i.test(code) && !useFiles.invited) { useFiles.invited = true;
      setTimeout(async () => { if (orig && orig.on) { try { orig.h.modern(); } catch (e) { } } go('online'); $('n_code').value = code.toUpperCase(); try { await $('n_join').onclick(); } catch (e) { } }, 600); } } catch (e) { }
    $('cdinfo').textContent = files.list('.CUE').length ? 'Música: pistas de audio del CD encontradas (' + files.list('.CUE')[0] + ').' :
      'Música: no encontré la imagen del CD. Elige la carpeta que contiene BIGRED e IMAGE.img para tener la música original.';
  }
  $('pick').onclick = async () => {
    if (window.showDirectoryPicker) {
      try { const h = await showDirectoryPicker({ id: 'bigred', mode: 'read' }); await idbSet('dir', h); await useFiles(await filesFromHandle(h)); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    $('dirinput').click();
  };
  $('dirinput').onchange = e => useFiles([...e.target.files]);
  // en el móvil: un .zip con la carpeta BIGRED (se guarda en el navegador para no tener que elegirlo cada vez)
  async function useZip(z, keep) {
    $('folder_msg').textContent = 'Leyendo el zip…';
    try { const L = await BRR.zipFiles(z); if (!L.some(f => /\.LEV$/i.test(f.name))) { $('folder_msg').textContent = 'En ese zip no hay circuitos (.LEV). Comprime la carpeta BIGRED del juego.'; return; }
      if (keep) { $('folder_msg').textContent = 'Guardando el juego en este navegador…'; try { await idbSet('zip', z); } catch (e) { } }
      $('folder_msg').textContent = ''; useFiles(L); }
    catch (e) { $('folder_msg').textContent = 'No se ha podido leer el zip: ' + e.message; }
  }
  $('pickzip').onclick = () => $('zipinput').click();
  $('zipinput').onchange = e => { const z = e.target.files[0]; if (z) useZip(z, true); };
  (async () => { try { const z = await idbGet('zip'); if (z && z.size) { const b = $('again'); if (!b.hidden) return; b.hidden = false; b.textContent = 'Usar el zip de la última vez (' + Math.round(z.size / 1048576) + ' MB)'; b.onclick = () => useZip(z, false); } } catch (e) { } })();
  let lastDir = null;
  (async () => {
    try {
      const h = lastDir = window.showDirectoryPicker && await idbGet('dir');
      if (h) { $('again').hidden = false; $('again').textContent = 'Usar la carpeta de la última vez (' + h.name + ')';
        $('again').onclick = async () => { if (await h.requestPermission({ mode: 'read' }) === 'granted') useFiles(await filesFromHandle(h)); }; }
    } catch (e) { }
  })();
  // versión de escritorio (Windows/Linux): los archivos se leen del disco a través del programa, sin elegir carpeta en el navegador
  const NAT = window.BRR_NATIVE;
  async function nativeFiles() {
    if (!NAT) return null; const L = await NAT.list(); if (!L || !L.some(f => /\.LEV$/i.test(f.rel))) return null;
    const mk = (f, s, e) => ({ size: e - s, arrayBuffer: () => NAT.read(f.rel, s, e), slice: (a = 0, b = e - s) => mk(f, s + Math.max(0, a), s + Math.min(b, e - s)) });
    return L.map(f => Object.assign(mk(f, 0, f.size), { name: f.rel.split('/').pop(), webkitRelativePath: f.rel }));
  }
  if (NAT) { try { const l = new URLSearchParams(location.search).get('lang'); if (l && BRR.LANGS[l] && BRR.lang() !== l) BRR.setLang(l); } catch (e) { }
    $('pick').onclick = async () => { const d = await NAT.pickDir(); if (!d) return; const L = await nativeFiles(); if (L) useFiles(L); else $('folder_msg').textContent = 'En esa carpeta no hay circuitos (.LEV). Elige la carpeta BIGRED del juego.'; }; }
  // pantalla de inicio (PRESS START): al pulsar, si ya se eligió la carpeta otra vez, se entra directo al menú con su música
  { let gone = false;
    const go1 = async () => { if (gone || $('title').hidden) return; gone = true; $('t_press').style.animation = 'none';
      if (NAT) { try { const L = await nativeFiles(); if (L) { await useFiles(L); if (audio) { audio.init && audio.init(); menuMusic(); } return; } } catch (e) { } show('folder'); return; }
      try { if (lastDir && (await lastDir.queryPermission({ mode: 'read' }) === 'granted' || await lastDir.requestPermission({ mode: 'read' }) === 'granted')) { await useFiles(await filesFromHandle(lastDir)); if (audio) { audio.init && audio.init(); menuMusic(); } return; } } catch (e) { }
      if (state === 'folder') show('folder'); };
    $('title').onclick = go1; addEventListener('keydown', e => { if (!$('title').hidden && !e.repeat) go1(); });
    const padT = () => { if ($('title').hidden) return; if (pads().some(g => g.buttons.some(b => b.pressed))) go1(); else requestAnimationFrame(padT); }; requestAnimationFrame(padT); }

  const LEVEL_NAMES = { CITY: 'Ciudad', DIRT: 'Tierra', MOON: 'Marte', WATER: 'Río', SNOW: 'Nieve', RUF: 'Desierto', RIG: 'Plataforma', CHOPPER: 'Helicóptero', TEST: 'Prueba' };
  const VEH_NAMES = { JEEP: 'Jeep', MINI: 'Mini', BEETLE: 'Escarabajo', ATV: 'Quad 6x6', CAT: 'Dumper', MONS: 'Monster truck', TRUCK: 'Camión', JCB: 'Excavadora', CABBET: 'Escarabajo descapotable', CABMINI: 'Mini descapotable',
    PLOUGH: 'Quitanieves', SNOWCAT: 'Máquina de nieve', BUGGY: 'Buggy lunar', JETCAR: 'Jet car', UFO: 'OVNI', INFLATE: 'Lancha neumática', HOVCAR: 'Aerodeslizador', HELI: 'Helicóptero', COPTER: 'Helicóptero ligero' };
  // vehículos de cada circuito (líneas "car" del guion del nivel), como en el original
  const levelCars = {};
  async function carsFor(id) {
    if (String(id).includes('~')) return carsFor(id.split('~')[0]);   // circuito propio: los vehículos de su tema
    if (levelCars[id]) return levelCars[id];
    try { const A = await files.archive(id + '.LEV'), t = [...A.keys()].find(k => k === id + '.TXT') || [...A.keys()].find(k => k.endsWith('.TXT') && k !== 'VIEW.TXT');
      const txt = BRR.text(A.get(t)).replace(/;[^\n]*/g, '');
      const L = [...txt.matchAll(/^\s*car\s+(\w+)/gm)].map(m => m[1].toUpperCase()).slice(0, 2).filter(n => n !== 'FEHELI' && files.has(n + '.VHC'));
      if (/^MOON/.test(id) && files.has('UFO.VHC') && !L.includes('UFO')) L.push('UFO');   // el ovni, también de serie en Marte, Venus y la Luna
      return levelCars[id] = L;   // el original deja elegir los 2 primeros (el 3º es el helicóptero de cámara u oculto)
    } catch (e) { return levelCars[id] = []; }
  }
  async function fillVehicles() {
    const id = $('m_level').value, own = await carsFor(id), vs = $('m_veh'), keep = vs.value || opt.vehicle; vs.innerHTML = '';
    const add = (par, n) => { const o = document.createElement('option'); o.value = n; o.textContent = VEH_NAMES[n] || n; par.appendChild(o); };
    // solo los vehículos del circuito (como en el original)
    // solo los del circuito, salvo en el modo libre (cualquier vehículo en cualquier circuito)
    let list;
    if (qmode === 'free' && own.length) {   // modo libre: los del circuito arriba y marcados, y cualquier otro debajo
      const g1 = document.createElement('optgroup'), g2 = document.createElement('optgroup'); g1.label = 'De este circuito'; g2.label = 'Otros vehículos';
      own.forEach(n => { add(g1, n); g1.lastChild.textContent = '★ ' + (VEH_NAMES[n] || n); }); const rest = BRR.VEHICLES.filter(n => files.has(n + '.VHC') && !own.includes(n)); rest.forEach(n => add(g2, n));
      vs.appendChild(g1); vs.appendChild(g2); list = own.concat(rest);
    } else { list = qmode === 'free' || !own.length ? BRR.VEHICLES.filter(n => files.has(n + '.VHC')) : own; list.forEach(n => add(vs, n)); }
    vs.value = list.includes(keep) ? keep : list[0] || keep;
    if (!vs.value) vs.selectedIndex = 0;
    qvLoad();
  }
  // vehículo elegido dando vueltas junto al nombre del equipo (pantalla de elegir circuito)
  let qvThumb = null, qvKey = '', qvA = 0, qvRun = false;
  async function qvLoad() {
    const v = $('m_veh').value, t = +$('m_team').value || 1, lv = $('m_level').value, key = v + '_' + t + '_' + lv + (opt.paint || '');
    if (!v || !lv || !orig || !front) return; if (key !== qvKey) { qvKey = key; try { qvThumb = await orig.h.carThumb(v, t, lv, t === (opt.team || 1) ? opt.paint : null); } catch (e) { qvThumb = null; } }
    if (qvRun) return; qvRun = true;
    const step = () => { if (state !== 'menu' || $('pane_quick').hidden) { qvRun = false; return; }
      const cv = $('d_vcv'); if (qvThumb && cv) { const g = cv.getContext('2d'), im = qvThumb.frame(qvA += 0.025); g.clearRect(0, 0, cv.width, cv.height); const sz = Math.min(cv.width, cv.height * 1.3); g.drawImage(im, (cv.width - sz) / 2, (cv.height - sz) / 2 - 4, sz, sz); }
      setTimeout(() => requestAnimationFrame(step), 40); };
    step();
  }
  function buildMenu() {
    const ls = $('m_level'); ls.innerHTML = '';
    for (const n of files.list('.LEV').filter(n => !n.startsWith('TEST'))) {
      const id = n.replace('.LEV', ''), env = id.replace(/\d+$/, '');
      const o = document.createElement('option'); o.value = id; o.textContent = `${LEVEL_NAMES[env] || env} ${id.slice(env.length)} (${id})`; ls.appendChild(o);
    }
    ls.value = files.has(opt.level + '.LEV') ? opt.level : ls.options[0].value;
    ls.onchange = fillVehicles; fillVehicles();
    { const H = { normal: 'Gana el primero en terminar las vueltas.', elim_cp: 'Cada pocos controles (según lo grande que sea el circuito) el último en pasar queda eliminado. Gana el que queda.', bomba: 'Libre, sin vueltas (como el pillado): la bomba pasa con solo tocar a otro coche. Cada uno tiene 1 minuto con la bomba encima (su reloj solo corre mientras la lleva); si llega a cero, explota y la bomba pasa al que más tiempo tenga. Gana el último vivo. Puedes saltar (V).', kart: 'Carrera con cajas de objetos en el circuito: mancha de aceite, misil recto, misil que busca al de delante, bomba que dejas detrás y turbo. Se usan con V (o G / cruceta ↑).', polis: 'Sin vueltas: la mitad son polis (con sirena, salen de la salida) y la otra mitad cacos (salen a medio circuito). Los polis eliminan a los cacos chocándolos; si algún caco aguanta 5 minutos, ganan los cacos. Puedes saltar (V).', zombie: 'Sin vueltas: un coche empieza de zombi (verde) y contagia al que toca. Gana el último sin infectar. Puedes saltar (V).' };
      const cz = $('m_crazy'); cz.value = H[opt.crazy] ? opt.crazy : 'normal'; const up = () => { $('m_crazyhelp').textContent = H[cz.value]; $('m_laps').disabled = cz.value !== 'normal' && cz.value !== 'kart'; }; cz.onchange = () => { opt.crazy = cz.value; save(); up(); }; up(); }
    $('m_ghost').value = ['si', 'record', 'ambos', 'no'].includes(opt.ghost) ? opt.ghost : 'ambos'; $('m_ghost').onchange = () => { opt.ghost = $('m_ghost').value; save(); };
    $('m_hora').value = opt.hora || 'original'; $('m_clima').value = opt.clima || 'despejado'; $('m_hora').onchange = () => { opt.hora = $('m_hora').value; save(); }; $('m_clima').onchange = () => { opt.clima = $('m_clima').value; save(); };
    $('m_team').value = opt.team; $('m_rivals').value = opt.rivals; $('m_diff').value = opt.diff; $('m_players').value = opt.players || 1;
    $('t_team').value = opt.team; $('t_diff').value = opt.diff;
    BRR.loadFront(files).then(async F => { front = F; try { await makeHeads(); } catch (e) { console.error(e); } renderFront(); await startOrigMenu(); customRefresh(); }).catch(e => console.error(e));
  }
  // ---------- caras de los pilotos de cada equipo (TEAMS.TEA), renderizadas a imagen ----------
  // personajes: cuerpo (BLOKE/WOMAN + color del equipo) y cabeza (HEAD1x, 2, 3, 4x, 5, 6) de CHARSCN con su paleta (DRIVER.RAW)
  const CHARS = [{ b: 'BLOKE', h: 'HEAD1', v: 1 }, { b: 'BLOKE', h: 'HEAD2' }, { b: 'BLOKE', h: 'HEAD3' }, { b: 'WOMAN', h: 'HEAD4', v: 1 }, { b: 'WOMAN', h: 'HEAD5' }, { b: 'BLOKE', h: 'HEAD6' },
    // cabezas nuevas de mujer hechas con las del original cambiando colores: pelo rubio (los amarillos del rubio) · piel clara y melena castaña (sin el color del equipo)
    { b: 'WOMAN', h: 'HEAD5', r: { 47: 84 } }, { b: 'WOMAN', h: 'HEAD4', v: 1, r: {48: 13, 49: 13, 50: 13, 51: 13, 52: 13, 53: 13, 54: 14, 55: 14, 56: 14, 57: 14, 58: 14, 59: 14, 60: 15, 61: 15, 62: 15, 63: 15, 11: 241, 12: 242, 13: 243, 14: 244, 15: 245} }];
  const remapFaces = (m, r) => r ? { ...m, faces: m.faces.map(f => f.color != null && !f.tex && r[f.color] != null ? { ...f, color: r[f.color] } : f) } : m;
  // cabeza y cuerpo por separado: cualquier cabeza con cualquier cuerpo
  const BODIES = ['BLOKE', 'WOMAN', 'BLOKE:kid', 'BLOKE:fat'];
  // cuerpos nuevos con el estilo del original: se sacan del cuerpo de hombre deformándolo (niño: bajito y cabezón; grande: ancho y con barriga)
  function morphBody(m, mod) {
    if (!mod) return m; const V0 = m.verts.filter(Boolean), y0 = Math.min(...V0.map(v => v[1])), y1 = Math.max(...V0.map(v => v[1])), H = y1 - y0 || 1, hip = y0 + H * 0.5, legH = y1 - hip;
    const verts = m.verts.map(v => { if (!v) return v; const d = y1 - v[1], t = (v[1] - y0) / H;
      if (mod === 'kid') { const dn = d <= legH ? d * 0.62 : legH * 0.62 + (d - legH) * 0.8; return [v[0] * 0.86, y1 - dn, v[2] * 0.86]; }
      if (mod === 'fat') { const k = t < 0.12 ? 1.2 : t < 0.55 ? 1.5 : 1.25, kz = t < 0.12 ? 1.15 : t < 0.25 ? 1.6 : t < 0.58 ? 2.3 : 1.25; return [v[0] * k, v[1] + (t < 0.55 ? H * 0.02 : 0), v[2] * kz]; }
      return v; });
    return { ...m, verts };
  }
  const headScale = mod => mod === 'kid' ? 1.08 : mod === 'fat' ? 1.06 : 1;
  const charOf = ci => ci && typeof ci === 'object' ? ci : CHARS[(ci | 0) % CHARS.length];
  const specOf = (head, body) => { const H = CHARS[(head | 0) % CHARS.length]; return { h: H.h, v: H.v, r: H.r, b: BODIES[(body | 0) % BODIES.length] }; };
  const myHead = () => opt.head != null ? opt.head : (opt.char || 0), myBody = () => opt.body != null ? opt.body : Math.max(0, BODIES.indexOf(CHARS[(opt.char || 0) % 6].b));
  const mySpec = () => specOf(myHead(), myBody());
  const specFrom = e => e.head != null || e.body != null ? specOf(e.head != null ? e.head : e.char || 0, e.body != null ? e.body : BODIES.indexOf(CHARS[(e.char || 0) % 6].b)) : null;
  let charArc = null, charPal = null; const charCache = new Map();
  // el color del equipo en los pilotos es la gama 32 + 16·equipo de su paleta: con color propio se cambia esa gama
  const charPalFor = (team, paint) => paint ? BRR.paintPal(charPal, [], paint, 32 + 16 * team) : charPal;
  async function charMesh(ci, color, dirty, headOnly, paint) {
    const key = [JSON.stringify(ci), color, dirty, headOnly, paint || ''].join(); if (charCache.has(key)) return charCache.get(key);
    if (!charArc) { charArc = await files.archive('CHARSCN.SCN'); charPal = BRR.pal6(charArc.get('DRIVER.RAW').subarray(0, 768)); }
    const c = charOf(ci), A = charArc, mb = new BRR.MeshBuilder(charPalFor(color, paint)), tm = n => A.get(n + '.TM');
    const head = remapFaces(BRR.parse3DW(A.get(c.h + (c.v ? color : '') + '.3DW')), c.r), [bf, mod] = c.b.split(':'), hs = headScale(mod);
    let top = 0;
    if (!headOnly) { const body = morphBody(BRR.parse3DW(A.get(bf + (dirty ? 'B' : '') + color + '.3DW')), mod); top = Math.min(...body.verts.filter(Boolean).map(v => v[1])); mb.addModel(body, v => BRR.toGL(v[0], v[1], v[2]), tm); }
    const hb = Math.max(...head.verts.filter(Boolean).map(v => v[1]));
    mb.addModel(head, v => BRR.toGL(v[0] * hs, (v[1] - hb) * hs + top + 1, v[2] * hs), tm);
    if (!R.L) R.setEnvironment([-0.35, 0.75, 0.55], [0.62, 0.7, 0.82]);
    let hsz = head.radius * 1.2 * BRR.S, hcy = 0;
    if (headOnly) { const G = head.verts.filter(Boolean).map(v => BRR.toGL(v[0] * hs, (v[1] - hb) * hs + top + 1, v[2] * hs)), ys = G.map(g => g[1]), xs = G.map(g => g[0]), zs = G.map(g => g[2]);   // encuadre por el contorno real de la cabeza (las de mujer salían pequeñas)
      hcy = (Math.max(...ys) + Math.min(...ys)) / 2; hsz = Math.max(Math.max(...ys) - Math.min(...ys), Math.max(...xs) - Math.min(...xs)) * 0.7; }   // por la altura de la cara, no por la coleta o la melena
    const out = { up: R.upload(mb), size: headOnly ? hsz : (Math.abs(top) + 18) * BRR.S, cy: headOnly ? hcy : (Math.abs(top) + 14) * 0.5 * BRR.S };
    charCache.set(key, out); return out;
  }
  // cabeza del piloto elegido para llevarla en el coche (en el sitio "head" del vehículo), a tamaño real (~30 cm)
  const driverCache = new Map();
  async function driverHead(ci, team, paint) {
    const key = JSON.stringify(ci) + '_' + team + '_' + (paint || ''); if (driverCache.has(key)) return driverCache.get(key);
    let out = null;
    try {
      if (!charArc) { charArc = await files.archive('CHARSCN.SCN'); charPal = BRR.pal6(charArc.get('DRIVER.RAW').subarray(0, 768)); }
      const c = charOf(ci), A = charArc, head = remapFaces(BRR.parse3DW(A.get(c.h + (c.v ? team : '') + '.3DW')), c.r), [bf, mod] = c.b.split(':'), hs = headScale(mod), body = morphBody(BRR.parse3DW(A.get(bf + team + '.3DW')), mod);
      // como en el menú: la cabeza encima del cuerpo; en el coche solo se ve de cintura para arriba
      const top = Math.min(...body.verts.filter(Boolean).map(v => v[1])), hb = Math.max(...head.verts.filter(Boolean).map(v => v[1]));
      const hxf = v => BRR.toGL(v[0] * hs, (v[1] - hb) * hs + top + 1, v[2] * hs), bxf = v => BRR.toGL(v[0], v[1], v[2]);
      const H = head.verts.filter(Boolean).map(hxf), B = body.verts.filter(Boolean).map(bxf);
      const hmn = [0, 1, 2].map(a => Math.min(...H.map(g => g[a]))), hmx = [0, 1, 2].map(a => Math.max(...H.map(g => g[a])));
      const bmn = Math.min(...B.map(g => g[1])), bmx = Math.max(...B.map(g => g[1])), waist = bmn + (bmx - bmn) * 0.5;
      const k = 0.3 / Math.max(1e-3, hmx[1] - hmn[1]), cx = (hmn[0] + hmx[0]) / 2, cz = (hmn[2] + hmx[2]) / 2;
      const place = g => [(g[0] - cx) * k, (g[1] - hmn[1]) * k - 0.2, (g[2] - cz) * k];
      const torso = { ...body, faces: body.faces.filter(f => f.idx.some(i => body.verts[i] && bxf(body.verts[i])[1] >= waist)) };
      const mb = new BRR.MeshBuilder(charPalFor(team, paint)), tm = n => A.get(n + '.TM');
      mb.addModel(torso, v => place(bxf(v)), tm); mb.addModel(head, v => place(hxf(v)), tm);
      out = R.upload(mb);
    } catch (e) { console.warn('piloto', e); }
    driverCache.set(key, out); return out;
  }
  async function makeHeads() {
    front.heads = {}; if (!files.has('CHARSCN.SCN')) return;
    for (let t = 1; t <= 6; t++) { const m = await charMesh(t - 1, t, false, true); front.heads[t] = R.thumb(m.up, { size: 128, yaw: Math.PI + 0.4, pitch: -0.12, dist: m.size * 3.4, target: [0, m.cy || 0, 0] }); }
  }
  const headImg = (team, sz = 22) => front && front.heads && front.heads[team] ? `<img src="${front.heads[team]}" style="width:${sz}px;height:${sz}px;vertical-align:middle;margin-right:6px;background:${TEAM[team].c}33;border-radius:50%">` : `<span class="dot" style="background:${TEAM[team].c}"></span>`;
  // piloto de cuerpo entero con el nombre del equipo (el equipo y el color se eligen en Piloto y escudería)
  async function showTeamHead() { const t = opt.team || 1; $('m_team').value = t; $('t_team').value = t; const tok = showTeamHead.tok = (showTeamHead.tok || 0) + 1;
    const nm = '<b style="color:' + (opt.paint || TEAM[t].c) + '">' + (myTeamName() ? esc(myTeamName()) : 'Equipo ' + TEAM[t].n) + '</b>';
    let body = null; try { if (front && files.has('CHARSCN.SCN')) body = await charURL(mySpec(), t); } catch (e) { }
    if (tok !== showTeamHead.tok) return;
    $('d_head').innerHTML = (body ? `<img src="${body}" alt="" style="height:96px;width:auto">` : headImg(t, 54)) + nm; }
  $('m_team').addEventListener('change', showTeamHead); $('m_team').addEventListener('change', qvLoad); $('m_veh').addEventListener('change', qvLoad);
  // ---------- menú original (pantallas .SCN del juego) ----------
  let orig = null, fromOrig = false;
  async function startOrigMenu() {
    if (!files.has('ALWAYS.WAP') || !files.has('TOURN.WAP') || !BRR.OrigMenu) return;
    if (orig) { if (opt.menu !== 'moderno') { orig.open(); } return; }
    const vehCache = new Map();
    orig = new BRR.OrigMenu(files, {
      front: () => front, level: () => opt.level, team: opt.team, diff: opt.diff, rivals: opt.rivals, audio,
      teamName: t => TEAM[t].n, vehName: v => VEH_NAMES[v] || v,
      narrate: t => { if (audio && audio.ctx && t.intro) audio.narrate(t.intro); },
      vol: () => ({ vmusic: opt.vmusic, vsfx: opt.vsfx, vvoice: opt.vvoice }),
      setVol: v => { Object.assign(opt, v); applyVol(); save(); for (const k of ['vsfx', 'vmusic', 'vvoice']) $('o_' + k).value = opt[k]; },
      options: () => { $('optpanel').hidden = false; },
      modern: () => { opt.menu = 'moderno'; save(); orig.close(); show('menu'); state = 'menu'; renderTourn(); go('home'); },
      charThumb: async (ci, color, dirty) => { const m = await charMesh(ci, color, dirty, false), cv = document.createElement('canvas');
        return { frame: a => R.thumb(m.up, { size: 192, yaw: Math.PI + a, pitch: -0.12, dist: m.size * 3.1, target: [0, m.cy, 0], canvas: cv }) }; },
      tournNext: () => { const T = tget() || tnew(); if (T.over) return null; return front.tracks.find(x => x.id === front.series[T.series].use[T.idx]); },
      carThumb: async (veh, team, level, paint, gar) => {
        const key = veh + team + level + (paint || '') + (gar ? JSON.stringify(gar) : ''); let up = vehCache.get(key);
        if (!up) {
          const A = await files.archive(String(level).split('~')[0] + '.LEV'), colk = [...A.keys()].find(k => k.endsWith('.COL'));
          const fake = { pal: BRR.pal6((colk ? A.get(colk) : (await files.archive('ALWAYS.WAP')).get('DEFAULT.COL')).subarray(0, 768)), find: n => A.get(n) || null };
          const d = await BRR.loadVehicle(files, veh, fake, team, { paint: hexRGB(paint), glass: gar ? garGlass(gar) : null });
          const rw = gar ? rimWheels(d, { ...gar, paint }) : null;   // garaje: llantas
          if (!R.L) R.setEnvironment([-0.35, 0.75, 0.55], [0.62, 0.7, 0.82]);
          // carrocería + ruedas (en su sitio, apoyadas) + piezas decorativas (hélices, orugas, timones)
          const parts = d.wheels.map((w, i) => d.wheelMeshes[i] ? { b: (rw && rw[i]) || R.upload(d.wheelMeshes[i]), W: BRR.M4.fromRT([[1, 0, 0], [0, 1, 0], [0, 0, 1]], w.c) } : null).filter(Boolean);
          for (const x of d.decoParts) parts.push({ b: R.upload(x.mesh), W: BRR.M4.fromRT(x.R, x.p) });
          // tamaño: lo que ocupa el modelo entero (carrocería + ruedas), no solo la caja de choque (el buggy lunar lleva las ruedas muy fuera)
          let ext = Math.max(d.box.h[0], d.box.h[2]); const grow = (mb, o) => { for (const g of mb.groups.values()) for (let i = 0; i < g.pos.length; i += 3) ext = Math.max(ext, Math.abs(g.pos[i] + o[0]), Math.abs(g.pos[i + 2] + o[2]), Math.abs(g.pos[i + 1] + o[1]) * 0.8); };
          grow(d.mesh, [0, 0, 0]); d.wheels.forEach((w, i) => { if (d.wheelMeshes[i]) grow(d.wheelMeshes[i], w.c); });
          up = { body: R.upload(d.mesh), parts, len: ext * 2 };
          vehCache.set(key, up);
        }
        const cv = document.createElement('canvas');
        return { frame: a => { const all = [...up.body]; R.thumb(all, { size: 192, yaw: a, pitch: -0.32, dist: up.len * 2.1, target: [0, 0, 0], canvas: cv, parts: up.parts }); return cv; } };
      },
      start: cfg => { fromOrig = true; if (orig.st.logo != null && typeof opt.logo !== 'string') opt.logo = orig.st.logo; if (orig.st.char != null && orig.st.char !== opt.char) { opt.char = orig.st.char; delete opt.head; delete opt.body; } tourMode = cfg.tourn; opt.rivals = cfg.rivals; opt.diff = cfg.diff; opt.players = cfg.players; save();
        if (audio) { audio.stopNarration(); } crazyPick = 'normal'; startRace(cfg.level, cfg.veh, cfg.team, 0, cfg.players); },
    });
    await orig.init();
    if (opt.menu !== 'moderno') { state = 'origmenu'; orig.open(); }
  }
  addEventListener('keydown', e => { if (e.code === 'F2' && state === 'menu' && orig && !orig.on) { opt.menu = 'original'; save(); orig.open(); } });
  // ---------- menú con las tarjetas originales de los circuitos y torneo ----------
  let front = null, tourMode = false;
  const DIFF = ['', 'Fácil', 'Mediana', 'Difícil'];
  const tname = t => (t && t.place ? t.place : '') || (t ? t.id : '');
  function card(t, extra = '') {
    return `<div class="tcard" data-id="${t.id}">${t.view ? `<img src="${t.view}" alt="">` : `<div style="padding:30px 10px">${t.id}</div>`}<div class="tag"><b${t.custom ? ' data-notr' : ''}>${t.custom ? esc(tname(t)) : tname(t)}</b><span>${t.custom ? esc(t.desc.split(' · ').pop()) : t.id}</span></div>${extra}</div>`;
  }
  function selectTrack(id, narrate) {
    const t = front.tracks.find(x => x.id === id); if (!t) return;
    $('m_level').value = id; opt.level = id; save(); fillVehicles();
    for (const c of document.querySelectorAll('#tracks .tcard')) c.classList.toggle('on', c.dataset.id === id);
    $('d_img').src = t.view || ''; $('d_place').textContent = ''; $('d_name').textContent = t.place || t.id; if (t.custom) $('d_name').setAttribute('data-notr', ''); else $('d_name').removeAttribute('data-notr');   // solo el país (sin el nombre interno del mapa)
    $('d_diff').textContent = DIFF[t.diff] || ''; $('d_diff').className = 'diff d' + t.diff;
    $('d_desc').textContent = (t.desc || '') + (t.laps ? `\n${t.laps} vueltas.` : '');
    let rec = null; try { for (const k of ST.keys()) if (k.startsWith('brr_rec_' + id + '_')) { const r = JSON.parse(ST.get(k)); if (r.lap && (!rec || r.lap < rec)) rec = r.lap; } } catch (e) { }
    $('d_rec').textContent = rec ? 'Tu mejor vuelta aquí: ' + fmt(rec) : '';
    showTTBest();
    if (narrate && audio && audio.ctx && t.intro) audio.narrate(t.intro);
    if (qmode === 'tt' && view === 'tt') refreshLB();
    $('d_img').classList.toggle('cust', !!t.custom); $('d_img').hidden = !t.custom; if (globeD && t.custom) $('d_globe').hidden = true;
    if (globeD && !t.custom) { const pl = t.planet > 0 && front.planets && front.planets[t.planet]; $('d_globe').hidden = t.planet > 0 && !pl; globeD.map = pl || front.world; globeD.noMarks = !!pl;
      if (pl) { globeD.sel = null; globeD.focus(globeD.lon + 60, 15); } else { globeD.sel = globeD.marks.find(m => m.id === id); globeD.focus(t.lon, t.lat); } }
  }
  // contrareloj: tu mejor tiempo en el circuito (con las vueltas elegidas y cualquier vehículo)
  function showTTBest() {
    const el = $('d_ttbest'); if (!el) return; if (qmode !== 'tt') { el.hidden = true; return; }
    const id = $('m_level').value, laps = +$('m_laps').value || 3; let best = null, lap = null;
    try { for (const k of ST.keys()) { const m = k.match(/^brr_rec_([A-Z0-9]+)_([A-Z0-9]+)_(\d+)$/); if (!m || m[1] !== id) continue; const r = JSON.parse(ST.get(k));
      if (+m[3] === laps && r.total && (!best || r.total < best.t)) best = { t: r.total, v: m[2] }; if (r.lap && (!lap || r.lap < lap.t)) lap = { t: r.lap, v: m[2] }; } } catch (e) { }
    el.hidden = false;
    const vn = v => '<span>' + esc(VEH_NAMES[v] || v) + '</span>';
    el.innerHTML = '<div class="small"><span>Tu récord</span> · ' + laps + ' <span>vueltas</span></div><div class="ttb">' + (best ? fmt(best.t) : '—') + '</div>' + (best ? '<div class="small">' + vn(best.v) + '</div>' : '<div class="small"><span>Aún no tienes tiempo aquí</span></div>') + (lap ? '<div class="small"><span>Mejor vuelta</span> ' + fmt(lap.t) + ' · ' + vn(lap.v) + '</div>' : '');
  }
  $('m_laps').addEventListener('change', showTTBest);
  let globeD = null, globeT = null, globeN = null;
  function makeGlobes() {
    if (!front.world) return;
    const marks = front.tracks.filter(t => !(t.planet > 0) && t.lon != null).map(t => ({ id: t.id, lon: t.lon, lat: t.lat, name: t.place || t.id }));
    globeD = new BRR.Globe($('d_globe'), front.world); globeD.marks = marks;
    globeT = new BRR.Globe($('t_globe'), front.world); globeT.marks = marks;
  }
  function renderFront() {
    if (!front) return;
    if (front.bg.menu) $('menu').style.backgroundImage = `url(${front.bg.menu})`;
    makeGlobes();
    if (front.bg.load) $('loading').style.backgroundImage = `url(${front.bg.load})`;
    $('tracks').innerHTML = front.tracks.map(t => card(t)).join('');
    for (const c of document.querySelectorAll('#tracks .tcard')) { c.tabIndex = 0; c.onclick = () => { menuBeep(); selectTrack(c.dataset.id, true); }; }
    selectTrack(front.tracks.find(t => t.id === opt.level) ? opt.level : front.tracks[0].id, false);
    renderTourn(); menuMusic(); showTeamHead(); renderHomeProf(); if (state === 'menu') go(view || 'home', true);
  }
  function menuBeep() { if (audio) { audio.init(); audio.play('SAMPLES/BEEP3.WAV', { vol: 0.5, bus: 'ui' }); menuMusic(); } }
  // el navegador no deja sonar nada hasta que el jugador toca algo: a la primera tecla/clic/botón del mando, arranca la música del menú
  const wakeAudio = () => { if (!audio) return; audio.init(); if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume(); if (state === 'menu' || state === 'bye') menuMusic(); };
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, wakeAudio, { capture: true });
  setInterval(() => { if (state === 'menu' && audio && (!audio.ctx || !audio.musicTrack) && pads().some(g => g.buttons.some(b => b.pressed))) wakeAudio(); }, 300);
  function menuMusic() { if (audio && audio.ctx && state === 'menu') audio.playTrack(2); }
  // ---------- menú principal: pantallas y navegación ----------
  const VIEWS = {
    home: { pane: 'home', col: 'h_main', title: '' }, single: { pane: 'home', col: 'h_single', title: 'Un jugador', back: 'home' }, multi: { pane: 'home', col: 'h_multi', title: 'Multijugador', back: 'home' },
    quick: { pane: 'quick', title: 'Carrera rápida', back: 'single' }, tt: { pane: 'quick', title: 'Contrareloj', back: 'single' }, free: { pane: 'quick', title: 'Modo libre', back: 'single' }, split: { pane: 'quick', title: 'Pantalla partida', back: 'multi' },
    tourn: { pane: 'tourn', title: 'Campeonato', back: 'single' }, online: { pane: 'online', title: 'Online', back: 'multi' }, lan: { pane: 'online', title: 'Red local (LAN)', back: 'multi' },
    mods: { pane: 'mods', title: 'Mods', back: 'home' }, profile: { pane: 'profile', title: 'Piloto y escudería', back: 'home' } };
  let view = 'home', qmode = 'quick', ttMode = false, freeMode = false;
  const sfx = n => { if (audio) { audio.init(); audio.play('SAMPLES/' + n + '.WAV', { vol: 0.5, bus: 'ui' }); } };
  function go(v, silent) {
    if (v === 'options') { $('optpanel').hidden = false; setTimeout(() => navFocusFirst($('optpanel')), 0); return; }
    if (v === 'orig') { if (orig) { opt.menu = 'original'; save(); orig.open(); } return; }
    if (v === 'reto') { retoOpen(); return; }
    if (v === 'friends') { frOpen(); return; }
    if (v === 'comm') { cmOpen(); return; }
    if (v === 'editor') { if (!BRR.editor) return; BRR.editor.open(); return; }
    if (v === 'replays') { $('rplist').hidden = false; rpRenderList(); setTimeout(() => navFocusFirst($('rplist')), 0); return; }
    if (v === 'garage') { $('garage').hidden = false; garSel = opt.vehicle; garRender(); setTimeout(() => navFocusFirst($('garage')), 0); return; }
    if (v === 'donate') { $('donate').hidden = false; setTimeout(() => navFocusFirst($('donate')), 0); return; }
    if (v === 'exit') { show('bye'); state = 'bye'; if (audio) audio.stopMusic(); try { window.close(); } catch (e) { } if (NAT) setTimeout(() => window.close(), 300); return; }
    if (v === 'back') v = (VIEWS[view] || {}).back || 'home';
    const W = VIEWS[v]; if (!W) return; view = v;
    for (const p of ['home', 'quick', 'tourn', 'online', 'mods', 'profile']) $('pane_' + p).hidden = p !== W.pane;
    for (const c of ['h_main', 'h_single', 'h_multi']) $(c).hidden = c !== W.col;
    $('m_back').hidden = v === 'home'; $('m_title').textContent = W.title; $('menu').classList.toggle('homeview', W.pane === 'home');
    if (W.pane === 'quick') { setQuickMode(v); setTimeout(qvLoad, 0); }
    if (v === 'online') onlineEnter(); if (v === 'lan') lanEnter(); if (v === 'profile') { renderProfile(); renderHorns(); renderProfiles(); renderStats(); renderAch(); } if (v === 'mods') renderMods(); if (W.pane === 'home') renderHomeProf();
    if (globeT) { globeT.drawn = false; globeT.start(); } if (globeD) { globeD.drawn = false; globeD.start(); }
    setTimeout(() => navFocusFirst(W.pane === 'home' ? $(W.col) : $('pane_' + W.pane)), 0);
  }
  $('dn_close').onclick = () => { $('donate').hidden = true; }; $('donate').onclick = e => { if (e.target.id === 'donate') $('donate').hidden = true; };
  $('m_back').onclick = () => { sfx('BEEP2'); go('back'); };
  for (const b of document.querySelectorAll('.hbtn')) b.onclick = () => { sfx(b.dataset.go === 'back' ? 'BEEP2' : 'BEEP4'); go(b.dataset.go); };
  $('bye_back').onclick = () => { state = 'menu'; show('menu'); go('home'); menuMusic(); };
  function setQuickMode(v) {
    qmode = v; const tt = v === 'tt', split = v === 'split', free = v === 'free';
    $('m_rivals').parentElement.hidden = tt || free; $('m_diff').parentElement.hidden = tt || free; $('m_laps').parentElement.hidden = free; $('m_crazy').parentElement.hidden = tt || free; $('m_ghost').parentElement.hidden = !tt; $('m_laps').disabled = !(tt || free) && $('m_crazy').value !== 'normal' && $('m_crazy').value !== 'kart';
    $('m_players').parentElement.parentElement.hidden = !split;
    const pl = $('m_players'); for (const o of pl.options) o.hidden = split && o.value === '1';
    if (split && +pl.value < 2) pl.value = String(Math.max(2, opt.players || 2)); if (!split) pl.value = '1';
    if (tt && $('m_laps').value === '0') $('m_laps').value = '3';
    $('go').textContent = tt ? 'Salir a por el récord' : split ? 'Correr (pantalla partida)' : free ? 'Conducir' : 'Correr';
    fillVehicles();
    $('d_lb').hidden = !tt; if (tt) refreshLB(); showTTBest(); showTeamHead();
  }
  // perfil: piloto (6 personajes del original) y escudería (13 logos × 6 colores)
  async function headURL(ci, team) { const pt = hexRGB(opt.paint), k = 'hd' + JSON.stringify(ci) + '_' + team + '_' + (opt.paint || ''); if (front[k]) return front[k]; const m = await charMesh(ci, team, false, true, pt);
    return front[k] = R.thumb(m.up, { size: 128, yaw: Math.PI + 0.4, pitch: -0.12, dist: m.size * 3.4, target: [0, m.cy || 0, 0] }); }
  async function charURL(ci, team) { const pt = hexRGB(opt.paint), k = 'ch' + JSON.stringify(ci) + '_' + team + '_' + (opt.paint || ''); if (front[k]) return front[k]; const m = await charMesh(ci, team, false, false, pt);
    return front[k] = R.thumb(m.up, { size: 128, yaw: Math.PI + 0.35, pitch: -0.1, dist: m.size * 2.0, target: [0, m.cy, 0] }); }
  async function renderProfile() {
    if (!front) return; const team = opt.team || 1; $('pf_name').value = opt.netName || '';
    $('pf_title').textContent = myTeamName() || (opt.paint ? 'Tu escudería' : 'Escudería ' + TEAM[team].n); $('pf_tname').value = opt.teamName || ''; $('pf_tname').placeholder = 'Equipo ' + TEAM[team].n; $('pf_title').style.color = carColOpt();
    const heads = []; for (let i = 0; i < CHARS.length; i++) heads.push(`<div class="pitem${myHead() === i ? ' on' : ''}" tabindex="0" data-hd="${i}"><img src="${await headURL(specOf(i, myBody()), team).catch(() => '')}"></div>`);
    $('pf_heads').innerHTML = heads.join('');
    const chars = []; for (let i = 0; i < BODIES.length; i++) chars.push(`<div class="pitem${myBody() === i ? ' on' : ''}" tabindex="0" data-bd="${i}"><img src="${await charURL(specOf(myHead(), i), team).catch(() => '')}"><div>${['Hombre', 'Mujer', 'Niño', 'Grandullón'][i] || 'Cuerpo ' + (i + 1)}</div></div>`);
    $('pf_chars').innerHTML = chars.join('');
    const logos = []; for (let i = 0; i < 13; i++) logos.push(`<div class="pitem${(opt.logo || 0) === i ? ' on' : ''}" tabindex="0" data-l="${i}"><img src="${orig ? await orig.logoURL(i, team, hexRGB(opt.paint)).catch(() => '') : ''}"></div>`);
    for (const L of BRR.LOGOS_EXTRA || []) logos.push(`<div class="pitem${opt.logo === 'x:' + L.id ? ' on' : ''}" tabindex="0" data-x="${L.id}" title="${esc(L.n)}"><img src="${L.src}" style="background:${carColOpt()};image-rendering:auto"></div>`);
    logos.push(`<div class="pitem${opt.logo === 'custom' ? ' on' : ''}" tabindex="0" data-custom="1" title="Tu propio logo (PNG)">${opt.customLogo ? `<img src="${opt.customLogo}" style="background:${carColOpt()}">` : '<div style="font-size:42px;line-height:72px">＋</div>'}<div>Logo propio</div></div>`);
    const cols = [];
    cols.push(`<div class="pitem${opt.paint ? ' on' : ''}" tabindex="0" data-paint="1" title="Color propio (RGB)"><div style="height:40px;border-radius:8px;background:${opt.paint || 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)'}"></div>${opt.paint ? 'Color propio' : 'Color RGB…'}</div>`);
    cols.push(...[1, 2, 3, 4, 5, 6].map(t => `<div class="pitem${team === t && !opt.paint ? ' on' : ''}" tabindex="0" data-t="${t}" style="background:${TEAM[t].c}55"><div style="height:40px;border-radius:8px;background:${TEAM[t].c}"></div>${TEAM[t].n}</div>`));
    $('pf_logos').innerHTML = logos.join(''); $('pf_colors').innerHTML = cols.join('');
    for (const el of document.querySelectorAll('#pane_profile .pitem')) el.onclick = () => { sfx('BEEP4');
      if (el.dataset.paint) { const inp = document.createElement('input'); inp.type = 'color'; inp.value = opt.paint || TEAM[opt.team || 1].c;
        inp.oninput = inp.onchange = () => { opt.paint = inp.value; save(); renderProfile(); renderHomeProf(); }; inp.click(); return; }
      if (el.dataset.t != null) opt.paint = null;   // elegir un color de equipo quita el color propio
      if (el.dataset.custom) { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = async () => { const f = inp.files[0]; if (!f) return; const im = new Image(); im.src = URL.createObjectURL(f); await im.decode();
          const cv = document.createElement('canvas'); cv.width = cv.height = 40; const g = cv.getContext('2d'), k = Math.min(40 / im.width, 40 / im.height);
          g.drawImage(im, (40 - im.width * k) / 2, (40 - im.height * k) / 2, im.width * k, im.height * k);
          const N = 256, cv2 = document.createElement('canvas'); cv2.width = cv2.height = N; const g2 = cv2.getContext('2d'), k2 = Math.min(N / im.width, N / im.height); g2.imageSmoothingQuality = 'high';
          g2.drawImage(im, (N - im.width * k2) / 2, (N - im.height * k2) / 2, im.width * k2, im.height * k2);
          opt.customLogo = cv2.toDataURL('image/png'); for (const q of [0.9, 0.75, 0.6]) if (opt.customLogo.length > 180000) opt.customLogo = cv2.toDataURL('image/webp', q); /* siempre por debajo del límite que se acepta en online */ delete opt.customLogoHi; opt.logo = 'custom'; save(); renderProfile(); renderHomeProf(); };
        if (opt.customLogo && opt.logo !== 'custom') { opt.logo = 'custom'; save(); renderProfile(); renderHomeProf(); } else inp.click(); return; }
      if (el.dataset.hd != null) opt.head = +el.dataset.hd; if (el.dataset.bd != null) opt.body = +el.dataset.bd; if (el.dataset.l != null) opt.logo = +el.dataset.l; if (el.dataset.x != null) opt.logo = 'x:' + el.dataset.x; if (el.dataset.t != null) opt.team = +el.dataset.t;
      if (orig) Object.assign(orig.st, { char: opt.char || 0, logo: typeof opt.logo === 'number' ? opt.logo : 0, team: opt.team });
      $('m_team').value = opt.team; $('t_team').value = opt.team; showTeamHead(); save(); const k = ['hd', 'bd', 'l', 'x', 't'].find(q => el.dataset[q] != null) || 't'; renderProfile().then(() => { const n = document.querySelector(`#pane_profile .pitem[data-${k}="${el.dataset[k]}"]`); if (n) n.focus(); }); };
    // vista grande: el piloto girando
    profSpin(team);
  }
  // mis canciones (lista de reproducción guardada en el navegador)
  async function loadMyMusic() { try { const L = (await idbGet('music')) || []; if (audio) audio.userTracks = L; $('o_mymusic_n').textContent = L.length ? L.length + ' canciones' : 'ninguna'; } catch (e) { } }
  $('o_mymusic').onclick = () => $('o_mymusic_in').click();
  $('o_mymusic_in').onchange = async e => { const add = [...e.target.files].map(f => ({ name: f.name, blob: f })); e.target.value = ''; if (!add.length) return;
    const L = ((await idbGet('music')) || []).concat(add).slice(0, 200); await idbSet('music', L); await loadMyMusic(); if (opt.msrc === 'cd') { opt.msrc = 'mias'; $('o_msrc').value = 'mias'; save(); applyVol(); } if (audio) { audio.stopMusic(); menuMusic(); } };
  $('o_mymusic_clear').onclick = async () => { await idbSet('music', []); await loadMyMusic(); if (audio) { audio.stopMusic(); menuMusic(); } };
  // estadísticas que se van sumando mientras se conduce
  const statAcc = { km: 0, t: 0, veh: null };
  function statsFlush() { if (!statAcc.t) return; const a = { ...statAcc }; statAcc.km = 0; statAcc.t = 0; statsAdd(S => { S.km = (S.km || 0) + a.km; S.time = (S.time || 0) + a.t; S.veh = S.veh || {}; if (a.veh) S.veh[a.veh] = (S.veh[a.veh] || 0) + a.km + 0.001; }); }
  // rivales con color RGB y bocina al azar (opción "Aspecto de los rivales"); los colores se separan entre sí y del jugador
  const hueOf = h => { const c = hexRGB(h); if (!c) return null; const [r, g, b] = c.map(x => x / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 0.15) return null;
    return (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; };
  const hslHex = (h, s2, l) => { const f = n => { const k = (n + h / 30) % 12, a = s2 * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); }; return '#' + f(0) + f(8) + f(4); };
  function rivalLooks(n, avoid) {
    const out = [], names = RIVAL_TEAMS.filter(n => n !== myTeamName()).sort(() => Math.random() - 0.5), hues = avoid.filter(x => x != null), horns = BRR.HORNS.map(x => x.id).filter(x => x !== 'propia').sort(() => Math.random() - 0.5);
    // logos distintos para cada rival (los 13 del original y los añadidos), sin repetir el del jugador
    const mine = typeof opt.logo === 'number' ? opt.logo : opt.logo, logos = [...Array.from({ length: 13 }, (_, i) => i), ...(BRR.LOGOS_EXTRA || []).map(l => 'x:' + l.id)].filter(l => l !== mine).sort(() => Math.random() - 0.5);
    for (let k = 0; k < n; k++) { let best = 0, bd = -1;
      for (let t = 0; t < 40; t++) { const h = Math.random() * 360, d = Math.min(360, ...hues.map(q => Math.min(Math.abs(h - q), 360 - Math.abs(h - q)))); if (d > bd) { bd = d; best = h; } }
      hues.push(best); out.push({ paint: hslHex(best, 0.7 + Math.random() * 0.3, 0.42 + Math.random() * 0.16), horn: horns[k % horns.length], teamName: names[k % names.length], logo: logos[k % logos.length], gar: garRandom() }); }
    return out; }
  const carCol = c => c.paintHex || TEAM[c.team].c;
  // logo elegido como imagen: el propio del jugador o uno de los añadidos al port ('x:id')
  const extraLogo = id => (BRR.LOGOS_EXTRA || []).find(l => l.id === id);
  const myLogoData = () => opt.logo === 'custom' ? opt.customLogo || null : typeof opt.logo === 'string' && opt.logo.startsWith('x:') ? (extraLogo(opt.logo.slice(2)) || {}).src || null : null;
  const carColOpt = () => opt.paint || TEAM[opt.team || 1].c;
  // nombre del equipo: el que se pone el jugador (o el que eligen los rivales al azar); si no, el color
  const RIVAL_TEAMS = ['Dust Devils', 'Mud Monkeys', 'Thunder Pigs', 'Rusty Bolts', 'Nitro Nuts', 'Gravel Gang', 'Bumper Bros', 'Skid Kings', 'Crazy Hogs', 'Big Wheels', 'Rocket Rats', 'Diesel Dogs', 'Wild Sheep', 'Mad Moles', 'Los Locos', 'Turbo Turtles'];
  const cleanTeamName = v => String(v || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 24);
  const myTeamName = () => cleanTeamName(opt.teamName);
  const teamLabel = c => c.teamName || 'Equipo ' + TEAM[c.team].n;
  const hexRGB = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  // bocinas
  function renderHorns() {
    $('pf_horns').innerHTML = BRR.HORNS.map(h => `<button data-h="${h.id}" class="${opt.horn === h.id ? 'on' : ''}"${h.id === 'propia' && !customHornOk ? ' disabled title="Carga antes tu sonido"' : ''}>📯 <span>${esc(h.n)}</span></button>`).join('');
    for (const b of document.querySelectorAll('#pf_horns button')) b.onclick = () => { opt.horn = b.dataset.h; save(); if (audio) { audio.init(); if (hornPrev && hornPrev.cut) hornPrev.cut(); hornPrev = BRR.playHorn(audio, opt.horn, 1, 0.8, { dur: 0.6 }); } renderHorns(); const n = document.querySelector(`#pf_horns [data-h="${opt.horn}"]`); if (n) n.focus(); };
    $('pf_hornname').textContent = customHornOk ? 'Tienes una bocina propia cargada.' : '';
  }
  let customHornOk = false;
  async function loadCustomHorn() { try { const f = await idbGet('horn'); if (!f || !audio) return; audio.init(); audio.customHorn = await audio.ctx.decodeAudioData(await f.arrayBuffer()); customHornOk = true; } catch (e) { } }
  $('pf_hornfile').onclick = () => $('pf_hornin').click();
  $('pf_hornin').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > 1024 * 1024) { $('pf_hornname').textContent = 'Ese archivo pesa más de 1 MB: recórtalo o elige otro.'; return; }
    try { audio.init(); const b = await audio.ctx.decodeAudioData(await f.arrayBuffer()); if (b.duration > 4.2) { $('pf_hornname').textContent = 'Dura más de 4 segundos: recórtalo o elige otro.'; return; }
      await idbSet('horn', f); audio.customHorn = b; customHornOk = true; opt.horn = 'propia'; save(); renderHorns(); BRR.playHorn(audio, 'propia', 1, 0.8); }
    catch (x) { $('pf_hornname').textContent = 'No se ha podido leer ese sonido.'; } };
  // perfiles
  const profList = () => { try { return JSON.parse(localStorage.getItem('brr_profiles') || '[]'); } catch (e) { return []; } };
  function renderProfiles() {
    const L = profList(); $('pf_prof').innerHTML = `<option value="">Principal</option>` + L.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join(''); $('pf_prof').value = PROF;
    $('pf_pdel').disabled = !PROF;
  }
  $('pf_prof').onchange = () => { try { localStorage.setItem('brr_profile', $('pf_prof').value); } catch (e) { } location.reload(); };
  $('pf_pnew').onclick = () => { $('pf_pnewrow').hidden = false; $('pf_pname').focus(); };
  $('pf_pok').onclick = () => { const n = $('pf_pname').value.trim().replace(/[@]/g, '').slice(0, 16); if (!n) return; const L = profList(); if (!L.includes(n)) L.push(n);
    try { localStorage.setItem('brr_profiles', JSON.stringify(L)); localStorage.setItem('brr_profile', n); } catch (e) { } location.reload(); };
  $('pf_pdel').onclick = () => { if (!PROF) return; if ($('pf_pdel').dataset.sure !== '1') { $('pf_pdel').dataset.sure = '1'; $('pf_pdel').textContent = '¿Seguro? Pulsa otra vez'; return; }
    try { for (const k of Object.keys(localStorage)) if (k.endsWith('@' + PROF)) localStorage.removeItem(k); localStorage.setItem('brr_profiles', JSON.stringify(profList().filter(x => x !== PROF))); localStorage.setItem('brr_profile', ''); } catch (e) { } location.reload(); };
  // estadísticas del piloto
  const statsGet = () => { try { return JSON.parse(ST.get('brr_stats')) || {}; } catch (e) { return {}; } };
  function statsAdd(f) { const S = statsGet(); f(S); ST.set('brr_stats', JSON.stringify(S)); }
  // ---------- logros ----------
  const ACH = [
    ['m_elim', '✂️', 'El último en pie', 'Gana una carrera de eliminación'], ['m_bomba', '💣', 'Patata caliente', 'Sobrevive a la bomba caliente'],
    ['m_zombi', '🧟', 'Superviviente', 'Sé el último sin infectar en infección zombi'], ['m_poli', '🚨', 'Ley y orden', 'Pilla a todos los cacos siendo poli'],
    ['m_caco', '💰', 'Fuga perfecta', 'Aguanta hasta el final siendo caco'], ['m_kart', '🏎️', 'Rey del kart', 'Gana una carrera en modo kart'],
    ['m_misil', '🎯', 'Francotirador', 'Acierta 10 misiles en modo kart'],
    ['primera', '🏁', 'Primera carrera', 'Termina una carrera'], ['victoria', '🏆', 'Primera victoria', 'Gana una carrera con rivales'],
    ['sinnitro', '🐢', 'A pelo', 'Gana una carrera sin usar el nitro'], ['remontada', '🚀', 'Remontada', 'Gana después de haber ido último'],
    ['ovejas', '🐑', 'Esquilador', 'Aplasta 10 ovejas'], ['destrozos', '💥', 'Elefante en una cacharrería', 'Derriba 100 objetos'],
    ['vuelo', '🛫', 'Vuelo sin motor', 'Pasa más de 2 segundos en el aire'], ['vuelco', '🙃', 'Patas arriba', 'Vuelca el coche'],
    ['bocinazos', '📯', 'Pesado', 'Toca la bocina 50 veces'], ['foto', '📷', 'Paparazzi', 'Guarda una foto en el modo foto'],
    ['record', '⏱️', 'Contra el reloj', 'Bate un récord de vuelta en la contrareloj'], ['serie', '🎖️', 'Serie superada', 'Supera una serie del torneo'],
    ['torneo', '👑', 'Campeón del mundo', 'Gana el torneo completo'], ['km100', '🛣️', 'Kilómetros', 'Conduce 100 km en total'],
    ['veterano', '🎗️', 'Veterano', 'Termina 50 carreras'], ['turista', '🗺️', 'Turista', 'Corre en todos los circuitos'],
    ['online', '🌐', 'Conectado', 'Termina una carrera online'], ['onlinewin', '🥇', 'Rey de la red', 'Gana una carrera online'],
    ['fiesta', '🎉', 'Fiesta en casa', 'Corre en pantalla partida con 2 o más jugadores'], ['estilo', '🎨', 'Con estilo', 'Ponle nombre y color propio a tu escudería'],
    ['libre', '🌄', 'Domingo', 'Pasea 5 minutos en el modo libre'],
    ['garaje', '🚙', 'Coleccionista', 'Conduce todos los vehículos'], ['rampero', '🛹', 'Rampero', 'Pon 10 rampas en el modo libre'],
  ];
  // un logro por circuito («Visita Italia»…), con la imagen del circuito como icono: se añaden al cargar el juego
  function addVisitAch() { if (!front || !front.tracks || ACH.some(a => a[0].startsWith('v_'))) return;
    for (const t of front.tracks.filter(t => !t.custom)) ACH.push(['v_' + t.id, t.view ? { img: t.view } : '📍', 'Visita ' + (t.place || t.id), 'Corre en ' + t.id]); }
  const achIco = i => i && i.img ? `<img src="${i.img}" alt="">` : i;
  const achGet = () => { try { return JSON.parse(ST.get('brr_ach')) || {}; } catch (e) { return {}; } };
  const achQ = []; let achShowing = false;
  function achUnlock(id) {
    const A = achGet(); if (A[id]) return; const a = ACH.find(x => x[0] === id); if (!a) return;
    A[id] = Date.now(); ST.set('brr_ach', JSON.stringify(A)); achQ.push(a); achNext();
  }
  function achNext() {
    if (achShowing || !achQ.length) return; achShowing = true; const a = achQ.shift(), el = $('achtoast');
    el.innerHTML = `<span class="ai">${achIco(a[1])}</span><div><small>Logro conseguido</small><b>${a[2]}</b><span>${a[3]}</span></div>`; el.hidden = false; el.classList.remove('out');
    if (audio && audio.ctx) audio.play('GEN/CHECKPOI.WAV', { vol: 0.6, bus: 'ui' });
    setTimeout(() => el.classList.add('out'), 3600); setTimeout(() => { el.hidden = true; achShowing = false; achNext(); }, 4100);
  }
  function achCount(k, n, id) { let v = 0; statsAdd(S => { S[k] = v = (S[k] || 0) + 1; }); if (v >= n) achUnlock(id); }
  function renderAch() { addVisitAch(); const A = achGet(), n = ACH.filter(a => A[a[0]]).length;
    $('pf_achn').textContent = n + ' / ' + ACH.length;
    // por secciones, de lo básico a lo más difícil
    const SEC = [['Primeros pasos', ['primera', 'victoria', 'estilo', 'foto', 'bocinazos']], ['Carreras', ['sinnitro', 'remontada', 'record', 'vuelo', 'vuelco', 'ovejas', 'destrozos']],
      ['Campeonato', ['serie', 'torneo']], ['Modos extra', ['m_elim', 'm_bomba', 'm_zombi', 'm_poli', 'm_caco', 'm_kart', 'm_misil']], ['Modo libre', ['libre', 'rampero']],
      ['Multijugador', ['fiesta', 'online', 'onlinewin']], ['Constancia', ['km100', 'veterano', 'garaje', 'turista']], ['Circuitos', ACH.filter(x => x[0].startsWith('v_')).map(x => x[0])]];
    const used = new Set(SEC.flatMap(x => x[1])); const rest = ACH.filter(x => !used.has(x[0])).map(x => x[0]); if (rest.length) SEC.push(['Otros', rest]);
    const card = a => `<div class="ach${A[a[0]] ? ' on' : ''}" title="${a[3]}"><span class="ai">${A[a[0]] ? achIco(a[1]) : '🔒'}</span><div><b>${a[2]}</b><span>${a[3]}</span></div></div>`;
    $('pf_ach').innerHTML = SEC.map(([t, ids]) => { const L = ids.map(id => ACH.find(x => x[0] === id)).filter(Boolean); if (!L.length) return '';
      return `<div class="achsec"><span>${t}</span> <small>${L.filter(a => A[a[0]]).length} / ${L.length}</small></div>` + L.map(card).join(''); }).join(''); }
  function renderStats() {
    const S = statsGet(), fav = Object.entries(S.veh || {}).sort((a, b) => b[1] - a[1])[0], hrs = (S.time || 0) / 3600;
    const cell = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
    $('pf_stats').innerHTML = cell(S.races || 0, 'carreras') + cell(S.wins || 0, 'victorias') + cell(S.podiums || 0, 'podios') + cell(S.recLaps || 0, 'récords de vuelta') +
      cell(((S.km || 0)).toFixed(1), 'km recorridos') + cell(hrs >= 1 ? hrs.toFixed(1) + ' h' : Math.round(hrs * 60) + ' min', 'conduciendo') + cell(S.champs || 0, 'campeonatos ganados') + cell(fav ? (VEH_NAMES[fav[0]] || fav[0]) : '–', 'vehículo favorito');
    const R0 = []; for (const k of ST.keys()) { const m = k.match(/^brr_rec_([A-Z0-9]+)_([A-Z0-9]+)_(\d+)$/); if (!m) continue; try { const r = JSON.parse(ST.get(k)); if (r.lap) R0.push([m[1], m[2], r.lap, r.total, +m[3]]); } catch (e) { } }
    R0.sort((a, b) => a[0].localeCompare(b[0]) || a[2] - b[2]);
    { const by = {}; for (const r of R0) { const b = by[r[0]] || (by[r[0]] = { lap: r, tot: null }); if (r[2] < b.lap[2]) b.lap = r; if (r[3] && (!b.tot || r[3] < b.tot[3])) b.tot = r; }
      $('pf_recs').innerHTML = R0.length ? '<table class="lbt">' + Object.keys(by).sort().map(id => { const b = by[id]; return `<tr><td>${esc(tname(front.tracks.find(t => t.id === id) || { id }))} · ${id}</td><td>vuelta ${fmt(b.lap[2])} <span class="small">(${VEH_NAMES[b.lap[1]] || b.lap[1]})</span></td><td>${b.tot ? 'carrera (' + b.tot[4] + ' v.) ' + fmt(b.tot[3]) + ' <span class="small">(' + (VEH_NAMES[b.tot[1]] || b.tot[1]) + ')</span>' : ''}</td></tr>`; }).join('') + '</table>' : 'Aún no tienes récords: ¡a correr!'; }
    if (0) $('pf_recs').innerHTML = R0.length ? '<table class="lbt">' + R0.map(r => `<tr><td>${esc(tname(front.tracks.find(t => t.id === r[0]) || { id: r[0] }))} · ${r[0]}</td><td>${VEH_NAMES[r[1]] || r[1]}</td><td>vuelta ${fmt(r[2])}</td><td>${r[3] ? 'carrera (' + r[4] + ' v.) ' + fmt(r[3]) : ''}</td></tr>`).join('') + '</table>' : 'Aún no tienes récords: ¡a correr!';
  }
  $('pf_tname').onchange = () => { opt.teamName = cleanTeamName($('pf_tname').value); save(); renderProfile(); renderHomeProf(); if (BRR_net.room) BRR_net.data(myData()); };
  $('pf_name').onchange = () => { opt.netName = $('pf_name').value.trim().slice(0, 20); BRR_net.p2p && (BRR_net.p2p.name = opt.netName || 'Piloto'); save(); renderHomeProf(); };
  let spinT = 0;
  async function profSpin(team) { const tok = ++spinT; let m; try { m = await charMesh(mySpec(), team, false, false, hexRGB(opt.paint)); } catch (e) { return; } const cv = $('pf_view'), g = cv.getContext('2d'); let a = 0;
    const step = () => { if (tok !== spinT || view !== 'profile' || state !== 'menu') return; a += 0.03; const im = R.thumb(m.up, { size: 192, yaw: Math.PI + a, pitch: -0.1, dist: m.size * 2.2, target: [0, m.cy, 0], canvas: document.createElement('canvas') });
      g.clearRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height); setTimeout(step, 50); }; step(); }
  // logo propio (PNG/JPG del jugador), guardado en el navegador como imagen de 40×40
  async function logoRGBAOf(v) {
    if (typeof v === 'string' && v.startsWith('x:')) v = (extraLogo(v.slice(2)) || {}).src || null;
    try { if (typeof v === 'string' && v.startsWith('data:image')) { if (v.length > 200000) return null; const im = new Image(); im.src = v; await im.decode(); if (im.width > 2048 || im.height > 2048) return null; const cv = document.createElement('canvas'); cv.width = cv.height = 40; const g = cv.getContext('2d'); g.drawImage(im, 0, 0, 40, 40); return g.getImageData(0, 0, 40, 40).data; }
      if (typeof v === 'number' && orig) return await orig.logoRGBA(v); } catch (e) { } return null; }
  // logo propio en alta resolución (256×256) para la calcomanía del coche
  async function logoHiOf(v) {
    try { if (typeof v === 'string' && v.startsWith('data:image')) { if (v.length > 200000) return null; const im = new Image(); im.src = v; await im.decode(); if (im.width > 2048 || im.height > 2048) return null; const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
      const k = Math.min(N / im.width, N / im.height); g.imageSmoothingQuality = 'high'; g.drawImage(im, (N - im.width * k) / 2, (N - im.height * k) / 2, im.width * k, im.height * k); return { w: N, h: N, data: new Uint8Array(g.getImageData(0, 0, N, N).data.buffer) }; } } catch (e) { } return null; }
  async function myLogoRGBA() {
    try {
      if (myLogoData()) { const im = new Image(); im.src = myLogoData(); await im.decode(); const cv = document.createElement('canvas'); cv.width = cv.height = 40; const g = cv.getContext('2d'); g.drawImage(im, 0, 0, 40, 40); return g.getImageData(0, 0, 40, 40).data; }
      if (typeof opt.logo === 'number' && orig) return await orig.logoRGBA(opt.logo);
    } catch (e) { console.warn(e); }
    return null;
  }
  async function logoImgURL(team) { if (myLogoData()) return myLogoData(); return orig ? orig.logoURL(opt.logo || 0, team, hexRGB(opt.paint)).catch(() => null) : null; }
  async function renderHomeProf() {
    if (!front) return; const t = opt.team || 1, tok = (renderHomeProf.tok = (renderHomeProf.tok || 0) + 1);
    const u = await logoImgURL(t), body = await charURL(mySpec(), t).catch(() => null); if (tok !== renderHomeProf.tok) return;   // solo la última llamada pinta (evita el logo repetido)
    $('h_prof').innerHTML = `${body ? `<img class="hbody" src="${body}" style="background:${carColOpt()}33">` : front.heads && front.heads[t] ? `<img src="${front.heads[t]}" style="background:${TEAM[t].c}33;border-radius:50%">` : ''}<div><b style="color:${carColOpt()}">${esc(opt.netName || 'Piloto')}</b><br><span class="small" style="color:${carColOpt()}">${myTeamName() ? esc(myTeamName()) : 'Escudería ' + TEAM[t].n}</span></div>` + (u ? `<img src="${u}" style="border-radius:6px">` : '');   // el logo con sus propios colores (sin fondo del equipo)
  }
  // ---------- mods (guardados en el navegador) ----------
  async function modsGet() { return (await idbGet('mods')) || []; }
  async function modsSet(m) { await idbSet('mods', m); if (files) files.setMods(m.filter(x => x.on)); levelCars && Object.keys(levelCars).forEach(k => delete levelCars[k]); }
  async function renderMods() {
    const M = await modsGet();
    $('mod_list').innerHTML = M.length ? M.map((m, i) => `<div class="modrow"><label style="flex:1"><input type="checkbox" data-i="${i}" ${m.on ? 'checked' : ''}> <b>${esc(m.name)}</b> <span class="small">${m.files.length} archivos</span></label><button data-up="${i}" title="Subir">▲</button><button data-del="${i}">Borrar</button></div>`).join('') : 'Ninguno.';
    for (const c of document.querySelectorAll('#mod_list input')) c.onchange = async () => { const M2 = await modsGet(); M2[+c.dataset.i].on = c.checked; await modsSet(M2); sfx('BEEP4'); };
    for (const b of document.querySelectorAll('#mod_list [data-del]')) b.onclick = async () => { const M2 = await modsGet(); if (!confirm('¿Borrar el mod "' + M2[+b.dataset.del].name + '"?')) return; M2.splice(+b.dataset.del, 1); await modsSet(M2); renderMods(); };
    for (const b of document.querySelectorAll('#mod_list [data-up]')) b.onclick = async () => { const i = +b.dataset.up; if (!i) return; const M2 = await modsGet(); [M2[i - 1], M2[i]] = [M2[i], M2[i - 1]]; await modsSet(M2); renderMods(); };
  }
  $('mod_add').onclick = () => $('mod_input').click();
  $('mod_input').onchange = async e => {
    const list = [...e.target.files]; if (!list.length) return;
    const root = (list[0].webkitRelativePath || '').split('/')[0];
    const mod = { name: $('mod_name').value.trim() || root || 'Mod', on: true, files: list.map(f => ({ rel: (f.webkitRelativePath || f.name).split('/').slice(1).join('/') || f.name, blob: f })) };
    const M = await modsGet(); M.push(mod); await modsSet(M); $('mod_msg').textContent = 'Mod "' + mod.name + '" instalado y activado (' + mod.files.length + ' archivos).'; $('mod_name').value = ''; e.target.value = ''; renderMods();
  };
  // ---------- contrareloj: clasificación local y online por circuito ----------
  const lbKey = id => 'brr_lb_' + id;
  const lbLocal = id => { try { return JSON.parse(ST.get(lbKey(id))) || []; } catch (e) { return []; } };
  function lbAddLocal(id, row) { const L = lbLocal(id); L.push(row); L.sort((a, b) => a.lap - b.lap); ST.set(lbKey(id), JSON.stringify(L.slice(0, 10))); }
  let lbOnline = null;
  // clasificación online: buzones públicos (BRR.cloud); si hay servidor dedicado configurado, también se manda allí
  async function refreshLB() {
    const id = $('m_level').value, tok = refreshLB.tok = (refreshLB.tok || 0) + 1; $('d_lbsrc').textContent = '(conectando…)'; drawLB();
    let r = null; try { r = await BRR.cloud.lbGet(id); } catch (e) { }
    if (tok !== refreshLB.tok || $('m_level').value !== id) return;
    if (r && r.rows.length) lbOnline = r.rows; else if (!r || !r.online) lbOnline = lbOnline && lbOnline.level === id ? lbOnline : null;   // sin conexión: se conserva lo que ya se veía
    else lbOnline = [];
    if (lbOnline) lbOnline.level = id;
    $('d_lbsrc').textContent = r && r.online ? '(online)' : '(sin conexión: tus tiempos y los últimos vistos)'; drawLB();
  }
  function drawLB() {
    const id = $('m_level').value, mine = lbLocal(id).map(r => ({ ...r, name: r.name || 'Tú', pid: BRR.cloud && BRR.cloud.id })), on = lbOnline && lbOnline.level === id ? lbOnline : [];
    const best = new Map(); for (const r of on.concat(mine)) { const k = (r.pid || r.name) + '|' + (r.veh || ''); const o = best.get(k); if (!o || r.lap < o.lap) best.set(k, r); }
    const rows = [...best.values()].sort((a, b) => a.lap - b.lap);
    const fr = new Set(frList().map(f => f.id)), me = BRR.cloud && BRR.cloud.id, tr = (r, i) => `<tr${r.pid === me ? ' class="me"' : fr.has(r.pid) ? ' class="fr"' : ''}><td>${i + 1}. ${fr.has(r.pid) ? '👫 ' : ''}${esc(r.name || '?')} <span class="small">${VEH_NAMES[r.veh] || r.veh || ''}</span></td><td>${fmt(r.lap)}</td></tr>`;
    const extra = rows.map((r, i) => [r, i]).filter(([r, i]) => i >= 10 && (fr.has(r.pid) || r.pid === me)).slice(0, 6);   // tus amigos (y tú) aunque no estéis entre los 10 primeros
    $('d_lbt').innerHTML = rows.length ? rows.slice(0, 10).map(tr).join('') + (extra.length ? '<tr><td class="small">…</td><td></td></tr>' + extra.map(([r, i]) => tr(r, i)).join('') : '') : '<tr><td class="small">Aún no hay tiempos. ¡Sé el primero!</td></tr>';
  }
  async function lbSubmit(id, veh, lap, total) {
    const row = { name: opt.netName || 'Piloto', veh, lap, total, team: opt.team, t: Date.now() }; lbAddLocal(id, row);
    try { await BRR.cloud.lbPut(id, row); } catch (e) { }
    if (opt.netUrl && /^wss?:/.test(opt.netUrl) && BRR_net.connected && BRR_net.mode === 'server') BRR_net.send({ t: 'lbput', level: id, row });
  }
  // ---------- navegación con mando y flechas por cualquier menú (A aceptar, B atrás, cruceta/stick moverse) ----------
  function navRoot() {
    if (!$('optpanel').hidden) return $('optpanel');
    for (const id of ['comm', 'rplist', 'friends', 'garage', 'reto', 'donate']) if ($(id) && !$(id).hidden) return $(id);   // ventanas encima del menú
    if (state === 'results' && !$('results').hidden) return $('results');
    if (!$('vehpick').hidden) return $('vehpick');
    if (state === 'pause' || !$('pause').hidden) return $('pause');
    if (state === 'bye') return $('bye');
    if (state === 'menu') return $('menu');
    if (state === 'folder') return $('folder');
    return null;
  }
  const visible = el => !!(el.offsetParent || el.getClientRects().length) && !el.closest('[hidden]') && !el.disabled;
  const navList = root => [...root.querySelectorAll('button, select, input:not([type=file]), .tcard, .pitem')].filter(visible);
  function navFocus(el) { if (!el) return; for (const x of document.querySelectorAll('.padfocus')) x.classList.remove('padfocus'); el.focus({ preventScroll: true }); if (navPadUsed) el.classList.add('padfocus'); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  function navFocusFirst(root) { if (!root || !navPadUsed) return; const L = navList(root); navFocus(L.find(e => e.classList.contains('on')) || L[0]); }
  function navMove(dir) {
    const root = navRoot(); if (!root) return; const L = navList(root); if (!L.length) return;
    let cur = document.activeElement; if (!L.includes(cur)) { navFocus(L[0]); return; }
    const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2; let best = null, bs = 1e9;
    for (const e of L) { if (e === cur) continue; const b = e.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2, dx = bx - ax, dy = by - ay;
      const along = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx, side = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
      if (along <= 4) continue; const sc = along + side * 2.2; if (sc < bs) { bs = sc; best = e; } }
    if (best) { navFocus(best); sfx('BEEP3'); }
  }
  function navAdjust(el, d) {   // izquierda/derecha cambian selects y deslizadores
    if (el.tagName === 'SELECT') { const opts = [...el.options].filter(o => !o.hidden); let i = opts.indexOf(el.selectedOptions[0]) + d; if (i < 0 || i >= opts.length) return false; el.value = opts[i].value; el.dispatchEvent(new Event('change')); sfx('BEEP3'); return true; }
    if (el.type === 'range') { el.value = +el.value + d * (+el.step || Math.max(1, (el.max - el.min) / 20)); el.dispatchEvent(new Event('input')); return true; }
    return false;
  }
  function navBack() {
    if (!$('optpanel').hidden) { $('optpanel').hidden = true; sfx('BEEP2'); navFocusFirst(navRoot()); return; }
    if (!$('vehpick').hidden) { $('vp_back').click(); return; }
    if (state === 'pause' || !$('pause').hidden) { togglePause(); return; }
    if (state === 'results' && !$('results').hidden) { $('r_menu').click(); return; }
    if (state === 'menu' && view !== 'home') { sfx('BEEP2'); go('back'); }
  }
  function navPress() { const el = document.activeElement; if (!el || !navRoot() || !navRoot().contains(el)) return;
    if (el.tagName === 'SELECT') { navAdjust(el, 1) || (el.value = el.options[0].value, el.dispatchEvent(new Event('change'))); return; }
    if (el.tagName === 'INPUT' && el.type !== 'checkbox') { el.focus(); return; }
    sfx('BEEP4'); el.click(); }
  let navPadUsed = false, navPrev = {}, navHold = { d: null, t: 0 };
  function navPoll() {
    requestAnimationFrame(navPoll);
    const root = navRoot(), P = pads();
    // sin menú en pantalla (en carrera) se siguen apuntando los botones pulsados: así el mismo Start que abre la pausa no la vuelve a cerrar
    if (!root || (orig && orig.on)) { const b0 = {}; for (const gp of P) gp.buttons.forEach((b, i) => { if (b.pressed) b0[i] = true; }); navPrev = b0; return; }
    if (!P.length) return; for (const gp of P) padSeen(gp);
    const now = performance.now(), btn = {}; let dir = null;
    for (const gp of P) { gp.buttons.forEach((b, i) => { if (b.pressed) btn[i] = true; });
      const x = gp.axes[0] || 0, y = gp.axes[1] || 0; if (Math.abs(x) > 0.6 || Math.abs(y) > 0.6) dir = Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up'); }
    if (btn[12]) dir = 'up'; if (btn[13]) dir = 'down'; if (btn[14]) dir = 'left'; if (btn[15]) dir = 'right';
    const edge = i => btn[i] && !navPrev[i];
    if (Object.keys(btn).length || dir) { if (!navPadUsed) { navPadUsed = true; if (!root.contains(document.activeElement)) { navFocusFirst(root); navPrev = btn; return; } } }
    if (dir) { if (navHold.d !== dir || now > navHold.t) { const el = document.activeElement;
        if ((dir === 'left' || dir === 'right') && el && root.contains(el) && (el.tagName === 'SELECT' || el.type === 'range') && navAdjust(el, dir === 'left' ? -1 : 1)) { }
        else navMove(dir);
        navHold.t = now + (navHold.d === dir ? 110 : 380); navHold.d = dir; } } else navHold.d = null;
    if (edge(0)) navPress(); if (edge(1)) navBack();
    if (edge(9) && state === 'pause' && performance.now() - pauseAt > 250) togglePause();
    if (edge(2) && state === 'menu' && view === 'home') go('options');
    if (state === 'menu' && VIEWS[view] && VIEWS[view].pane === 'quick' && (edge(4) || edge(5)) && front) {   // LB/RB: circuito anterior/siguiente (la bola gira)
      const T = front.tracks, i = T.findIndex(t => t.id === $('m_level').value), n = T[(i + (edge(5) ? 1 : -1) + T.length) % T.length]; sfx('BEEP3'); selectTrack(n.id, false);
      const c = document.querySelector(`#tracks .tcard[data-id="${n.id}"]`); if (c) navFocus(c); }
    navPrev = btn;
  }
  requestAnimationFrame(navPoll);
  addEventListener('mousemove', () => { if (navPadUsed) { navPadUsed = false; for (const x of document.querySelectorAll('.padfocus')) x.classList.remove('padfocus'); } });
  addEventListener('keydown', e => {
    if (!navRoot() || (orig && orig.on)) return; const el = document.activeElement, typing = el && el.tagName === 'INPUT' && !['checkbox', 'range'].includes(el.type);
    const m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.code];
    if (m && !typing) { e.preventDefault(); if ((m === 'left' || m === 'right') && el && (el.tagName === 'SELECT' || el.type === 'range') && navAdjust(el, m === 'left' ? -1 : 1)) return; navMove(m); }
    if (e.code === 'Backspace' && !typing && state === 'menu') navBack();
    if (e.code === 'Enter' && el && el.classList && (el.classList.contains('tcard') || el.classList.contains('pitem'))) el.click();
  });
  // torneo: series en orden, hay que ganar 'need' carreras de la serie para pasar a la siguiente; puntos 10-5-3-2-1-0
  const TKEY = 'brr_tourn';
  const tget = () => { try { return JSON.parse(ST.get(TKEY)) || null; } catch (e) { return null; } };
  const tset = T => ST.set(TKEY, JSON.stringify(T));
  const tnew = () => ({ series: 0, idx: 0, wins: 0, pts: {}, done: {}, over: false });
  function renderTourn() {
    if (!front || !front.series.length) { $('t_list').innerHTML = '<p>No encuentro TOURN.WAP en la carpeta.</p>'; return; }
    const T = tget() || tnew();
    $('t_list').innerHTML = front.series.map((se, i) => {
      const st = i < T.series ? 'Superada' : i === T.series ? (T.over ? 'Completada' : `Ganadas ${T.wins} de ${se.need} necesarias`) : 'Bloqueada';
      return `<div class="series${i === T.series ? ' cur' : ''}"><h3>Serie ${i + 1}<small>${st}</small></h3><div class="row4">` + se.use.map((id, k) => {
        const t = front.tracks.find(x => x.id === id) || { id }, r = T.done[id];
        return card(t, (i > T.series ? '<div class="lock">🔒</div>' : '') + (r ? `<div class="won">${r}º</div>` : '') + (i === T.series && k === T.idx && !T.over ? '<div class="won" style="background:var(--red);color:#fff">SIGUIENTE</div>' : ''));
      }).join('') + '</div></div>';
    }).join('');
    const pts = Object.entries(T.pts).sort((a, b) => b[1] - a[1]);
    $('t_info').innerHTML = pts.length ? '<label class="row">Clasificación general</label>' + pts.map(([tm, p]) => `<div style="display:flex;justify-content:space-between;align-items:center;margin:2px 0"><span>${headImg(tm, 26)}${+tm === +($('t_team').value) ? 'Tú' : 'Equipo ' + TEAM[tm].n}</span><b>${p}</b></div>`).join('') : '';
    $('t_go').textContent = T.over ? '¡Torneo completado!' : 'Siguiente carrera: ' + tname(front.tracks.find(x => x.id === front.series[T.series].use[T.idx]));
    $('t_go').disabled = T.over;
    if (globeT) { const nt = front.tracks.find(x => x.id === front.series[T.series].use[T.idx]); if (nt && !(nt.planet > 0)) { globeT.sel = globeT.marks.find(m => m.id === nt.id); globeT.focus(nt.lon, nt.lat); } }
  }
  $('t_reset').onclick = () => { if (confirm('¿Empezar un torneo nuevo? Se pierde el progreso.')) { tset(tnew()); renderTourn(); } };
  $('t_go').onclick = () => {
    const T = tget() || tnew(); if (T.over) return; tset(T);
    const id = front.series[T.series].use[T.idx], t = front.tracks.find(x => x.id === id);
    if (audio) audio.init(); tourMode = true; opt.rivals = 5; opt.diff = +$('t_diff').value;
    startRace(id, (t && t.cars && t.cars[0]) || 'JEEP', +$('t_team').value, 0);
  };
  function tournResult(myPos) {
    const T = tget() || tnew(), se = front.series[T.series], id = se.use[T.idx], P = front.points || [10, 5, 3, 2, 1, 0];
    order.forEach((o, i) => { T.pts[o.car.team] = (T.pts[o.car.team] || 0) + (P[i] || 0); });
    T.done[id] = myPos; if (myPos === 1) T.wins++;
    let msg = `Torneo · serie ${T.series + 1}: ${T.wins}/${se.need} victorias.`;
    T.idx++;
    if (T.wins >= se.need) { T.series++; T.idx = 0; T.wins = 0; msg = `¡Serie superada!` + (T.series >= front.series.length ? ' ¡HAS GANADO EL TORNEO!' : ` Pasas a la serie ${T.series + 1}.`); achUnlock('serie'); if (T.series >= front.series.length) achUnlock('torneo'); if (T.series >= front.series.length) { T.over = true; T.series = front.series.length - 1; statsAdd(S => S.champs = (S.champs || 0) + 1); } }
    else if (T.idx >= se.use.length) { T.idx = 0; T.wins = 0; for (const u of se.use) delete T.done[u]; msg = `No has ganado las carreras necesarias (${se.need}). Repite la serie ${T.series + 1}.`; }
    tset(T); return msg;
  }
  $('go').onclick = () => {
    tourMode = false; ttMode = qmode === 'tt'; freeMode = qmode === 'free'; if (audio) audio.init();
    if (!ttMode && !freeMode) { opt.rivals = +$('m_rivals').value; opt.diff = +$('m_diff').value; }
    const pl = qmode === 'split' ? Math.max(2, +$('m_players').value) : 1; if (qmode === 'split') opt.players = pl; save();
    crazyPick = ttMode || freeMode ? 'normal' : $('m_crazy').value;
    startRace($('m_level').value, $('m_veh').value, +$('m_team').value, freeMode || (crazyPick !== 'normal' && crazyPick !== 'kart') ? 99 : +$('m_laps').value, pl);
  };

  // ======================= carrera (1 a 4 jugadores en pantalla partida) =======================
  // Cada jugador humano tiene su coche, su carrera, su cámara, su marcador y su mando/teclado.
  // (La entrada de cada jugador pasa por un "control" — el día de mañana un jugador en red será otro tipo de control.)
  let humans = [];
  const NAMES = ['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7', 'J8'];
  function newHuman(i, c, rc, team) {
    const el = $('phud_t').content.firstElementChild.cloneNode(true); $('phuds').appendChild(el);
    const q = k => el.querySelector('.' + k);
    return { i, car: c, race: rc, team, hud: el, q, msgT: 0, cam: { init: false, posInit: false, pos: [0, 0, 0], yaw: 0, look: [0, 0, 0], lookYaw: 0, lookPitch: 0, up: [0, 1, 0] },
      inp: null, nPrev: false, padPrev: {}, steerKb: 0, snd: {}, done: false };
  }
  async function startRace(level, veh, team, laps = opt.laps, nPlayers = 1, net = null) {
    const custom = level.includes('~'); if (!custom) { opt.level = level; opt.vehicle = veh; opt.team = team; opt.laps = laps; save(); }
    nPlayers = Math.max(1, Math.min(8, nPlayers | 0)); if (tourMode || net) nPlayers = 1;
    netRace = net; netWait = !!net; netLoaded = new Set(); netT = 0;
    show('loading'); state = 'loading';
    try {
      $('load_msg').textContent = 'Cargando ' + level + '…';
      await new Promise(r => setTimeout(r, 30));
      const cT = custom ? (edTrack && BRR.editor.levelOf(edTrack) === level ? edTrack : await BRR.editor.byLevel(level)) : null; if (custom && !cT) throw new Error('No tienes ese circuito (' + level + ')');
      lvl = custom ? await BRR.loadCustomLevel(files, cT, s => $('load_msg').textContent = 'Cargando ' + (cT.name || level) + ': ' + s + '…') : await BRR.loadLevel(files, level, s => $('load_msg').textContent = 'Cargando ' + level + ': ' + s + '…');
      R.allTex = []; statics = R.upload(lvl.mesh); terrainB = R.upload(lvl.terrainMesh);
      R.setEnvironment(lvl.sun, lvl.sky); { const at = makeAtmos(level, lvl.sun, lvl.sky); R.setAtmos(at.A); lvl.atmosInfo = at; } R.setPalAnim(lvl.palAnim, lvl.pal); R.mode = opt.light === 'original' ? 0 : 1; R.setShadows(R.mode ? opt.shadows : 0);
      // jugadores humanos: el equipo elegido para J1 y los siguientes colores para los demás
      $('phuds').innerHTML = ''; humans = [];
      const teams = [team, ...[1, 2, 3, 4, 5, 6].filter(t => t !== team)];
      let def0 = null;
      for (let i = 0; i < nPlayers; i++) {
        const d = await BRR.loadVehicle(files, veh, lvl, teams[i % 6], i === 0 ? { glass: garGlass(garMine(veh)), logo: await myLogoRGBA(), logoHi: opt.logo === 'custom' ? await logoHiOf(opt.customLogoHi || opt.customLogo) : myLogoData() ? await logoHiOf(myLogoData()) : null, paint: hexRGB(opt.paint) } : {}); if (!def0) def0 = d;
        const c = new BRR.Car(d, lvl); c.team = teams[i % 6]; c.isPlayer = true; c.human = i; if (i === 0 && opt.paint) c.paintHex = opt.paint; if (i === 0 && myTeamName()) c.teamName = myTeamName(); c.headDraw = await driverHead(i === 0 ? mySpec() : (i % 6), teams[i % 6], i === 0 ? hexRGB(opt.paint) : null);
        const h = newHuman(i, c, new BRR.Race(lvl, laps || lvl.laps), teams[i % 6]); h.draw = R.upload(d.mesh); humans.push(h);
      }
      car = humans[0].car; race = humans[0].race;
      carDraw = { body: humans[0].draw, ...vehDraw(def0) }; { const rw = rimWheels(def0, garMine(def0.name)); if (rw) carDraw = { ...carDraw, wheels: carDraw.wheels.map((w, i) => rw[i] || w) }; }   // llantas del garaje
      // rivales de la máquina: los demás equipos, con el mismo vehículo
      rivals = []; const nR = ttMode || freeMode ? 0 : Math.min(12 - nPlayers, opt.rivals | 0), skill = [0, 0.86, 0.95, 1.0, 1.06][opt.diff] || 0.95, lanes = [-0.45, 0.45, -0.15, 0.15, 0, -0.3, 0.3, -0.6, 0.6, -0.05, 0.05];
      const profiles = ['experto', 'agresivo', 'torpe', 'prudente', 'imprevisible'].sort(() => Math.random() - .5); while (profiles.length < 11) profiles.push(profiles[profiles.length % 5]);
      if (rpLoad) {   // repetición guardada: todos los coches son marionetas que mueve la grabación (el tuyo no corre)
        for (const e of rpLoad.cars) { $('load_msg').textContent = 'Cargando ' + (e.name || 'coche') + '…';
          const t = e.team || 1, vn = files.has((e.veh || veh) + '.VHC') ? e.veh || veh : veh, d = await BRR.loadVehicle(files, vn, lvl, t, { logo: e.logo != null ? await logoRGBAOf(e.logo) : null, logoHi: typeof e.logo === 'string' ? await logoHiOf(e.logo) : null, paint: hexRGB(e.paint), glass: e.gar ? garGlass(e.gar) : null }), c = new BRR.Car(d, lvl);
          c.team = t; if (e.paint) c.paintHex = e.paint; if (e.tname) c.teamName = e.tname; if (e.gar) garApply(c, e.gar); c.puppet = true;
          const ent = { name: e.name, car: c, race: null, ai: null, draw: R.upload(d.mesh), dd: e.gar ? withRims(vehDraw(d), d, { ...e.gar, paint: e.paint }) : vehDraw(d), inp: null, remote: true };
          ent.race = puppetRace(ent, laps || lvl.laps); rivals.push(ent); }
      }
      if (net) {   // online: los demás jugadores (y en los invitados, los rivales del anfitrión) son "marionetas" movidas por la red
        let ak = 0;
        for (const e of net.order) {
          if (e.id === net.myId) continue;
          $('load_msg').textContent = 'Cargando ' + (e.name || 'rival') + '…';
          const t = e.team || 1, d = await BRR.loadVehicle(files, e.veh || veh, lvl, t, { logo: e.logo != null ? await logoRGBAOf(e.logo) : null, logoHi: typeof e.logo === 'string' ? await logoHiOf(e.logo) : null, paint: hexRGB(e.paint), glass: e.gar ? garGlass(e.gar) : null }), c = new BRR.Car(d, lvl); c.team = t; c.paintHex = e.paint || null; c.teamName = cleanTeamName(e.teamName) || null; c.headDraw = await driverHead(specFrom(e) || (e.char != null ? e.char : t - 1), t, hexRGB(e.paint));
          if (e.gar) garApply(c, e.gar);
          const rr = new BRR.Race(lvl, laps || lvl.laps), ent = { id: e.id, name: e.name, car: c, race: rr, ai: null, draw: R.upload(d.mesh), dd: e.gar ? withRims(vehDraw(d), d, { ...e.gar, paint: e.paint }) : vehDraw(d), inp: null, isAI: !!e.ai, hornType: e.horn || null };
          if (e.ai && net.role === 'host') ent.ai = new BRR.AIDriver(c, rr, (skill) * (0.97 + 0.03 * Math.random()), lanes[ak % lanes.length], e.profile || profiles[ak % profiles.length]);
          else { ent.remote = true; c.puppet = true; ent.race = puppetRace(ent, laps || lvl.laps); }
          if (e.ai) ak++; ent.lk = { logo: e.logo, paint: e.paint, gar: e.gar };
          rivals.push(ent);
        }
      }
      // rivales originales: reproducen las carreras grabadas del juego (como en 1995); si se piden más, el resto con la IA nueva
      replayBand = null;
      const looks = !net && opt.rivLook !== 'clasico' ? rivalLooks(12, [hueOf(opt.paint || TEAM[humans[0].team].c), ...humans.slice(1).map(h => hueOf(TEAM[h.team].c))]) : [];
      const recs = !net && !rpLoad && opt.origAI !== false && !['bomba', 'zombie', 'polis', 'kart'].includes(crazyPick) ? BRR.loadReplays(lvl) : [];   // modos libres: rivales con físicas (los grabados no pueden salirse de su vuelta)
      if (recs.length) {
        const free = Math.max(0, Math.max(6, lvl.gridSlots.length) - nPlayers);
        while (recs.length > Math.min(nR, free)) recs.splice(Math.random() * recs.length | 0, 1);   // el original deja fuera una al azar (orden "spos")
        const cars = [...(lvl.script || '').matchAll(/^car\s+(\w+)/gm)].map(m => m[1].toUpperCase());
        const used = new Set(humans.map(h => h.team));
        replayBand = new BRR.ReplayBand(recs.speed, [0, 0.9, 1, 1.07, 1.14][opt.diff] || 1);
        const per = [];
        for (const rec of recs) {
          $('load_msg').textContent = 'Cargando rivales… ' + (rivals.length + 1) + '/' + nR;
          let t = rec.team + 1; if (used.has(t)) t = [1, 2, 3, 4, 5, 6].find(x => !used.has(x)) || t; used.add(t);
          const lk = looks[rivals.length] || {}, pt = hexRGB(lk.paint);
          const vn = cars[rec.veh] || veh, d = await BRR.loadVehicle(files, files.path(vn + '.VHC') ? vn : veh, lvl, t, { paint: pt, glass: lk.gar ? garGlass(lk.gar) : null, logo: lk.logo != null ? await logoRGBAOf(lk.logo) : null }), c = new BRR.Car(d, lvl); if (lk.gar) garApply(c, lk.gar); c.team = t; c.paintHex = lk.paint || null; c.teamName = lk.teamName || null; c.headDraw = await driverHead(t - 1, t, pt);
          const rr = new BRR.Race(lvl, laps || lvl.laps);
          per.push(BRR.replayPace(rec) * BRR.S / (0.88 * c.topSpeed));
          rivals.push({ car: c, race: rr, ai: null, replay: new BRR.ReplayDriver(c, rr, rec, replayBand, 0.23), draw: R.upload(d.mesh), dd: lk.gar ? withRims(vehDraw(d), d, { ...lk.gar, paint: lk.paint }) : vehDraw(d), inp: null, hornType: lk.horn || null, lk });
        }
        per.sort((a, b) => a - b); const T = Math.max(0.12, Math.min(0.4, per[per.length >> 1]));
        for (const r of rivals) if (r.replay) r.replay.period = T;
      }
      // IA nueva: sigue las trazadas y el ritmo de las grabaciones originales (una distinta por rival) si el circuito las tiene
      const allRecs = !net && !rpLoad ? BRR.loadReplays(lvl) : [], recLines = [];
      if (allRecs.length) { const Tn = rivals.find(r => r.replay) ? rivals.find(r => r.replay).replay.period : 0.24;
        const S = BRR.S, a = -lvl.start.yaw, gx = lvl.start.x / S, gz = -lvl.start.z / S, fw = [Math.sin(a), Math.cos(a)], rt = [Math.cos(a), -Math.sin(a)];
        for (const rec of allRecs) { const sl = lvl.gridSlots[rec.slot] || [0, 0, 0]; const L = BRR.replayLine(lvl, rec, gx + rt[0] * sl[0] + fw[0] * sl[1], gz + rt[1] * sl[0] + fw[1] * sl[1], (lvl.start.a16 || 0) + (sl[2] || 0), Tn); if (L) recLines.push(L); } }
      for (let k = rivals.length; k < (net || rpLoad ? 0 : nR); k++) {
        $('load_msg').textContent = 'Cargando rivales… ' + (k + 1) + '/' + nR;
        const lk = looks[k] || {}, pt = hexRGB(lk.paint);
        const t = teams[(nPlayers + k) % 6], d = await BRR.loadVehicle(files, veh, lvl, t, { paint: pt, glass: lk.gar ? garGlass(lk.gar) : null, logo: lk.logo != null ? await logoRGBAOf(lk.logo) : null }), c = new BRR.Car(d, lvl); if (lk.gar) garApply(c, lk.gar); c.team = t; c.paintHex = lk.paint || null; c.teamName = lk.teamName || null; c.headDraw = await driverHead(t - 1, t, pt);
        const rr = new BRR.Race(lvl, laps || lvl.laps), ai = new BRR.AIDriver(c, rr, skill * (0.97 + 0.03 * Math.random()), lanes[k], profiles[k]);
        if (recLines.length) ai.line = recLines[k % recLines.length];
        rivals.push({ car: c, race: rr, ai, draw: R.upload(d.mesh), dd: lk.gar ? withRims(vehDraw(d), d, { ...lk.gar, paint: lk.paint }) : vehDraw(d), inp: null, hornType: lk.horn || null, lk });
      }
      const firstAI = rivals.find(r => r.ai); if (firstAI) { const md = BRR.aiMode(firstAI.car);
        if (!(lvl.aiLines || {})[md] && !(await BRR.loadAILine(lvl, md))) { $('load_msg').textContent = 'Preparando a los pilotos (solo la primera vez)…'; await new Promise(r => setTimeout(r, 30)); BRR.buildAILine(lvl, firstAI.race, md); BRR.saveAILine(lvl, md); } }
      props = new BRR.Props(lvl, R); fx = new BRR.Effects(R.gl, lvl);
      fx.orig = opt.fxs !== 'moderno';   // humo y polvo: los sprites animados del original (o los modernos)
      try { const E = files.has(lvl.env + '.ENV') ? await files.archive(lvl.env + '.ENV') : null, tm = E && E.get('SPOTFX2.TM'), tm2 = E && E.get('SPOTFX.TM'); if (tm) { const a2 = BRR.tmRGBA(tm, lvl.pal), b2 = tm2 ? BRR.tmRGBA(tm2, lvl.pal) : null, all = new Uint8Array(256 * 384 * 4);
        if (b2) for (let y = 12; y < 80; y++) for (let x = 0; x < 256; x++) { const k = (y * 256 + x) * 4; if (!b2[k + 3]) continue; const l = Math.max(b2[k], b2[k + 1], b2[k + 2]); b2[k] = Math.min(255, l * 0.62 + 40); b2[k + 1] = Math.min(255, l * 0.8 + 45); b2[k + 2] = Math.min(255, l * 0.95 + 55); } /* agua: azul blanquecino (con algunas paletas salía verde) */
        all.set(a2, 0); if (b2) all.set(b2, 256 * 192 * 4); fx.setSprites({ w: 256, h: b2 ? 384 : 192, data: b2 ? all : a2 }); } } catch (e) { }   // SPOTFX2 (humo, polvo) + SPOTFX (agua, chispas)
      if ((net && net.role === 'spec') || rpLoad) humans[0].car.spec = true;
      placeGrid(); layoutViews();
      R.setFilterAll(opt.filter);
      // sin parpadeo negro: los primeros fotogramas (que suben texturas y compilan sombreadores) se dibujan aún tapados por la pantalla de carga
      $('results').hidden = true; state = 'race';
      for (let k = 0; k < 4; k++) await new Promise(r => requestAnimationFrame(r));
      if (!rpLoad) await ghostLoad(); show('hud'); window.BRR_READY = true;
      if (net && net.role === 'spec') { netWait = false; $('netbar').hidden = true; $('phuds').style.visibility = 'hidden'; $('help').hidden = true; $('specbar').hidden = false; specT = 0; specUI(); }
      // logros: visitar el circuito y conducir todos los vehículos
      if (!net || true) { addVisitAch(); achUnlock('v_' + lvl.name); let nv = 0; statsAdd(S2 => { S2.vehs = S2.vehs || {}; S2.vehs[humans[0].car.def.name] = 1; nv = Object.keys(S2.vehs).length; });
        if (nv >= BRR.VEHICLES.filter(n => files.has(n + '.VHC')).length) achUnlock('garaje'); }
      $('help').hidden = false; clearTimeout(helpT); helpT = setTimeout(() => $('help').hidden = true, 9000);
      prepMinimap(); await startSounds(level, def0);
      if (net && net.role !== 'spec') { BRR_net.game({ k: 'loaded' }); netLoaded.add(net.myId); $('netbar').hidden = false; $('netbar').textContent = 'Esperando a los demás jugadores…'; }
    } catch (e) { console.error(e); $('load_msg').textContent = 'Error: ' + e.message; }
  }
  let helpT = 0, replayBand = null;
  const vdCache = new Map();
  function vehDraw(d) { const k = d.name; if (vdCache.has(k) && vdCache.get(k).lvl === lvl) return vdCache.get(k).v;
    const v = { brake: d.brake ? R.upload(d.brake) : null, wheels: d.wheelMeshes.map(m => m ? R.upload(m) : null), deco: d.decoParts.map(x => ({ ...x, draw: R.upload(x.mesh) })), interior: d.interior ? { src: d.interior, body: R.upload(d.interior.mesh), steer: d.interior.steer ? { ...d.interior.steer, draw: R.upload(d.interior.steer.mesh) } : null } : null }; vdCache.set(k, { lvl, v }); return v; }
  // carrera de una marioneta de red: lo que se sabe de ella llega en sus mensajes
  function puppetRace(ent, laps) { return { laps, lapTimes: [], ev: [], phase: 'race', get finishT() { return ent.fin; }, score: () => ent.sc || 0, reset() { ent.fin = null; ent.sc = 0; }, update() { } }; }
  // ---------- online: estado ----------
  let netRace = null, netWait = false, netLoaded = new Set(), netT = 0;
  const BRR_net = new BRR.NetMux();
  // vistas: 1 = pantalla completa · 2 = arriba/abajo · 3-4 = cuatro cuartos
  function viewRects(n) {
    if (n === 1) return [[0, 0, 1, 1]];
    if (n === 2) return [[0, 0, 1, .5], [0, .5, 1, .5]];
    if (n <= 4) return [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]].slice(0, n);
    const cols = n <= 6 ? 3 : 4, out = [];   // 5-8 jugadores: rejilla de 3×2 o 4×2 (pantallas grandes)
    for (let i = 0; i < n; i++) out.push([(i % cols) / cols, Math.floor(i / cols) / 2, 1 / cols, .5]); return out;
  }
  function layoutViews() {
    const rs = viewRects(humans.length);
    humans.forEach((h, i) => { const [x, y, w, hh] = rs[i]; h.rect = rs[i];
      Object.assign(h.hud.style, { left: x * 100 + '%', top: y * 100 + '%', width: w * 100 + '%', height: hh * 100 + '%' });
      h.hud.classList.toggle('small', humans.length > 1); h.hud.classList.toggle('solo', humans.length === 1); h.q('pname').textContent = humans.length > 1 ? NAMES[i] : ''; h.q('pname').style.color = TEAM[h.team].c; });
  }
  // parrilla: plazas del script (lateral, atrás, giro); los jugadores salen detrás
  function groundY(x, z) { const h = BRR.raycast(lvl, [x, 200, z], [0, -1, 0], 400); return h ? 200 - h.t : lvl.terrain(x, z); }
  function placeGrid() {
    if (lvl.collider.clearDyn) lvl.collider.clearDyn(); for (const h of humans) { h.ramp = null; h.pipe = null; h.stunt = null; } netRamps.clear();
    const S = BRR.S, a = -lvl.start.yaw, gx = lvl.start.x / S, gz = -lvl.start.z / S;
    const fw = [Math.sin(a), Math.cos(a)], rt = [Math.cos(a), -Math.sin(a)];
    const all = netRace ? netRace.order.map(e => e.id === netRace.myId ? humans[0].car : (rivals.find(r => r.id === e.id) || {}).car).filter(Boolean) : [...rivals.map(r => r.car), ...humans.map(h => h.car).reverse()];
    // plazas que faltan: se sigue el mismo dibujo de la parrilla (lado alterno, 4 m más atrás cada una), sin salirse por un lado
    const slots = lvl.gridSlots.length ? lvl.gridSlots.slice() : [[256, 0, 0], [-256, -256, 0]]; if (slots.length < 2) slots.push([-slots[0][0] || -256, slots[0][1] - 256, 0]);
    { const n0 = slots.length, back0 = Math.min(...slots.map(q => q[1]));
      while (slots.length < all.length + 6) { const k = slots.length - n0; slots.push([[-256, 256, 0][k % 3], back0 - 256 * (1 + Math.floor(k / 3)), 0]); } }
    // los rivales grabados salen de la plaza en la que se grabaron; los demás ocupan las plazas libres por orden
    const taken = new Set(), slotOf = new Map();
    for (const r of rivals) if (r.replay && !netRace) { slotOf.set(r.car, r.replay.rec.slot); taken.add(r.replay.rec.slot); }
    let nx = 0; for (const c of all) if (!slotOf.has(c)) { while (taken.has(nx)) nx++; slotOf.set(c, nx); taken.add(nx); }
    const gy0 = groundY(lvl.start.x, lvl.start.z);
    all.forEach(c => { let [dx, dz, da = 0] = slots[slotOf.get(c)];
      for (let t = 0; t < 6; t++) { const ox2 = gx + rt[0] * dx + fw[0] * dz, oz2 = gz + rt[1] * dx + fw[1] * dz; if (Math.abs(groundY(ox2 * S, -oz2 * S) - gy0) < 3) break; dx *= 0.5; dz = dz * 0.7; }   // no salir fuera de la plataforma/pista
      const ox = gx + rt[0] * dx + fw[0] * dz, oz = gz + rt[1] * dx + fw[1] * dz;
      c.reset(ox * S, -oz * S, lvl.start.yaw - da * 2 * Math.PI / 65536);
      const r = rivals.find(q => q.car === c); if (r && r.replay) r.replay.setStart(ox, oz, (lvl.start.a16 || 0) + da); });
    if (replayBand) replayBand.reset();
    for (const r of rivals) { r.race.reset(); if (r.ai) r.ai.reset(); r.hornStart = r.hornFin = false; r.rankWas = null; }
    for (const h of humans) { h.race.reset(); h.cam.init = false; h.cam.posInit = false; h.done = false; h.q('done').hidden = true; h.q('msg').hidden = true; }
    for (const c of all) { dentReset(c); c.hitV = 0; c.dmg = 0; c.broken = 0; c.nitros = lvl.nitros; c.nitroInf = freeMode && c.isPlayer; }
    if (humans[0]) garApply(humans[0].car, garMine(humans[0].car.def.name));   // modo libre: turbo sin límite
    if (props) props.reset(); if (fx) fx.reset(); crazyInit(); rpStart();
  }
  function restart() {
    if (!lvl) return; placeGrid(); leader = null; for (const h of humans) h.gRec = []; for (const g of ghosts) g.i = 0;
    $('results').hidden = true; state = 'race'; show('hud'); last = performance.now();
  }
  // ---------- sonido ----------
  const pickV = n => snd && typeof snd.pickVoice === 'function' ? snd.pickVoice(n) : null;   // voces del locutor (aún sin cargar: nada)
  async function startSounds(level, def) {
    if (!audio || !audio.ctx) return;
    audio.stopAll(); audio.loops = [];
    snd.voices = files.listDir(level).filter(n => n.endsWith('.WAV')).map(n => level + '/' + n);
    snd.pickVoice = pre => { const l = snd.voices.filter(v => v.split('/')[1].startsWith(pre)); return l.length ? l[Math.random() * l.length | 0] : null; };
    snd.bangs = files.listDir('GEN').filter(n => /^BANG\d+\.WAV$/.test(n)).map(n => 'GEN/' + n);
    // por jugador: motor, derrape y rodadura según la superficie (los de varios jugadores suenan más bajos)
    const SK = { asfalto: 'SKD_TM', tierra: 'SKD_GRAV', arena: 'SKD_GRAV', nieve: 'SKD_GRAV', agua: 'SKD_WATR', roca: 'SKD_ROCK' };
    const GR = { tierra: 'DRV_GRAV', arena: 'SAND', nieve: 'SNOW2', agua: 'DRV_WAT', hierba: 'GRASS', roca: 'DRV_ROCK' };
    for (const h of humans) {
      const S2 = h.snd = { skidL: {}, groundL: {} };
      S2.engine = def.engineWav ? (opt.engSnd === 'original' ? await audio.loop(def.engineWav, 0, 'engine') : await audio.engine(def.engineWav)) : null;
      for (const [k, n] of Object.entries(SK)) if (files.path('GEN/' + n + '.WAV')) S2.skidL[k] = await audio.loop('GEN/' + n + '.WAV', 0);
      for (const [k, n] of Object.entries(GR)) if (files.path('GEN/' + n + '.WAV')) S2.groundL[k] = await audio.loop('GEN/' + n + '.WAV', 0);
      audio.loops.push(S2.engine, ...Object.values(S2.skidL), ...Object.values(S2.groundL));
    }
    snd.rivEng = []; if (def.engineWav && rivals.length) for (let k = 0; k < Math.min(3, rivals.length); k++) { const l = await audio.loop(def.engineWav, 0, 'engine', [0, 0, 0]); snd.rivEng.push(l); audio.loops.push(l); }
    snd.nextGeneral = 18 + Math.random() * 15;
    audio.stopNarration(); audio.stopMusic();
    const tm = front && front.tracks.find(t => t.id === level);
    let seed = 0; for (const ch of level) seed = seed * 31 + ch.charCodeAt(0);
    // la música que pide el circuito; si esa pista dura menos de un minuto es una presentación hablada (WATER2: «This is wet and wild…»), no música
    (async () => { let mt = tm && tm.music; try { const cd = await audio.cdTracks(), tr = cd && mt && cd.audio.find(t => t.n === mt); if (tr && tr.end - tr.start < 44100 * 4 * 60) mt = 0; } catch (e) { }
      return mt ? audio.playTrack(mt) : audio.playMusic(Math.abs(seed)); })().then(n => { if (n) $('trackinfo').textContent = 'CD pista ' + n; });
  }
  function soundFrame(dt) {
    if (!audio || !audio.ctx) return;
    const paused = state !== 'race', mix = humans.length > 1 ? 0.6 : 1;
    for (const h of humans) {
      const c = h.car, S2 = h.snd; if ((c.lastHit || 0) > (h.rbHit || 0)) h.rbHit = c.lastHit; if (c.landed) h.rbLand = Math.max(h.rbLand || 0, c.landed); if (!S2) continue;
      { const thr = h.inp ? h.inp.throttle : 0, air = !c.W.some(w => w.contact), tgt = air && thr > 0.3 ? 255 : c.rpm();   // en el aire, acelerando: se revoluciona
        S2.rpmS = S2.rpmS == null ? tgt : S2.rpmS + (tgt - S2.rpmS) * Math.min(1, dt * (tgt > S2.rpmS ? 6 : 3.5)); S2.thrS = (S2.thrS || 0) + (thr - (S2.thrS || 0)) * Math.min(1, dt * 8);
        if (S2.engine) S2.engine.set(paused ? 0 : (0.33 + 0.27 * S2.thrS) * mix, 0.8 + S2.rpmS / 255 * 1.1, S2.thrS); }
      let slip = 0; const cnt = {}; let nc = 0;
      for (const w of c.W) if (w.contact) { slip = Math.max(slip, w.slip); let t = w.surface || 'asfalto'; if (t === 'tierra' && w.green) t = 'hierba'; cnt[t] = (cnt[t] || 0) + 1; nc++; }
      const spd = Math.abs(c.speed()), surf = nc ? Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] : null;
      // derrape: solo cuando de verdad se derrapa durante un rato (no el deslizamiento normal de las ruedas)
      const sk = slip > 0.32 && spd > 5; S2.skidT = sk ? (S2.skidT || 0) + dt : Math.max(0, (S2.skidT || 0) - dt * 3);
      const skV = S2.skidT > 0.35 ? Math.min(0.6, (slip - 0.32) * 1.8) * Math.min(1, (S2.skidT - 0.35) * 4) * Math.min(1, spd / 10) : 0;
      for (const [k, l] of Object.entries(S2.skidL || {})) l && l.set(paused || k !== surf ? 0 : skV * mix, 1);
      // rodadura sobre el suelo (grava, arena, nieve...): suave y solo con velocidad; no debe sonar a derrape
      for (const [k, l] of Object.entries(S2.groundL || {})) l && l.set(paused || k !== surf ? 0 : Math.min(0.22, Math.max(0, spd - 4) / 90) * (c.K.fly ? 0 : 1) * mix, 0.8 + Math.min(0.5, spd / 60));
      if (paused) continue;
      if (c.landed && surf === 'agua') audio.play('GEN/SPLASH.WAV', { vol: Math.min(1, c.landed / 8) });
      if (c.nitroT <= 0 && S2.nitroOn) audio.play('GEN/NOTTURB.WAV', { vol: 0.7 }); S2.nitroOn = c.nitroT > 0;
      if (c.lastHit > 3) { const B = snd.bangs || [], b = B[Math.random() * B.length | 0]; if (b) audio.play(b, { vol: Math.min(1, c.lastHit / 12) });
        if (c.lastHit > 9) { const v = pickV('CRASH') || pickV('CRAS'); if (v) audio.voice(v); } }
      c.lastHit = 0;
      if (c.landed) { audio.play('GEN/BIG.WAV', { vol: Math.min(1, c.landed / 10) }); c.landed = 0;
        if (c.lastAir > 1.0) { const v = pickV('JUMP'); if (v) audio.voice(v); } if (c.isPlayer && c.human === 0 && c.lastAir > 2) achUnlock('vuelo'); }
      const up = c.R[1][1]; if (up < 0.1 && !S2.rolled) { S2.rolled = true; if (c.isPlayer && c.human === 0 && state === 'race') achUnlock('vuelco'); const v = pickV('ROLL'); if (v) audio.voice(v); } if (up > 0.8) S2.rolled = false;
    }
    if (snd.rivEng && snd.rivEng.length) {
      const dmin = c => Math.min(...humans.map(h => Math.hypot(c.p[0] - h.cam.pos[0], c.p[1] - h.cam.pos[1], c.p[2] - h.cam.pos[2])));
      const near = rivals.map(r => ({ c: r.car, d: dmin(r.car) })).sort((a, b) => a.d - b.d);
      snd.rivEng.forEach((l, k) => { const n = near[k]; if (!l || !n) return; l.set(paused ? 0 : 0.3 * Math.max(0, 1 - n.d / 90) ** (audio.spatial ? 1 : 2), 0.8 + n.c.rpm() / 255 * 1.1, n.c.p); });
    }
    if (!paused && race.phase === 'race') { snd.nextGeneral -= dt; if (snd.nextGeneral < 0) { snd.nextGeneral = 20 + Math.random() * 20; const v = pickV('GENRAL'); if (v) audio.voice(v); } }
  }
  // ---------- eventos de carrera -> marcador y sonido ----------
  const fmt = t => { if (t == null || !isFinite(t)) return '–:––.––'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
  // ---------- marcador original de 1995: los dibujos de INGAME.WAP (GAMESVGA.SPR, pensados para 640×480) en un lienzo encima ----------
  // posición grande (1st…), vueltas, nitro en cuadraditos, DAMAGE:% y avisos (WRONG WAY, FINAL LAP, MISSED CHECK)
  let OH = null;
  async function ohudLoad() {
    OH = { ok: false }; try {
      const A = await files.archive('INGAME.WAP'), pal = (await files.archive('ALWAYS.WAP')).get('DEFAULT.COL'), d = A.get('GAMESVGA.SPR'); if (!d || !pal) return;
      const dv = new DataView(d.buffer, d.byteOffset, d.byteLength), n = dv.getUint16(0, true), S = [];
      for (let i = 0; i < n; i++) { const o = dv.getUint32(2 + i * 4, true), w = dv.getUint16(o, true), hh = dv.getUint16(o + 2, true), px = d.subarray(o + 8, o + 8 + w * hh);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = hh; const g = cv.getContext('2d'), im = g.createImageData(w, hh);
        for (let k = 0; k < w * hh; k++) { const c = px[k]; if (!c) continue; im.data[k * 4] = pal[c * 3] * 4.05; im.data[k * 4 + 1] = pal[c * 3 + 1] * 4.05; im.data[k * 4 + 2] = pal[c * 3 + 2] * 4.05; im.data[k * 4 + 3] = 255; }
        g.putImageData(im, 0, 0); S.push(cv); }
      OH = { ok: S.length >= 41, S };
    } catch (e) { OH = { ok: false }; }
  }
  function ohudDraw(h, dt) {
    const cv = h.q('ohud'); if (!cv) return; const on = opt.hudstyle === 'original' && !freeMode && !crazyR();
    h.hud.classList.toggle('orig', on); if (!on) return; if (!OH) ohudLoad(); if (!OH.ok) { h.hud.classList.remove('orig'); return; }
    const r = cv.parentElement.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d'); g.clearRect(0, 0, W, H); g.imageSmoothingEnabled = opt.filter !== 'nearest'; g.imageSmoothingQuality = 'high';
    const S = OH.S, k = Math.min(W / 640, H / 480) * (opt.hudsc / 100), c = h.car, rc = h.race, m = 10 * k;
    const put = (i, x, y, sc = 1) => { const s = S[i]; g.drawImage(s, x, y, s.width * k * sc, s.height * k * sc); return s.width * k * sc; };
    const num = (v, x, y, base, sc = 1, gap = -2) => { for (const ch of String(v)) x += put(base + (+ch), x, y, sc) + gap * k * sc; return x; };
    // posición
    if (opt.hpos && order.length > 1) { const pos = Math.max(1, order.findIndex(o => o.h === h) + 1), suf = pos % 100 >= 11 && pos % 100 <= 13 ? 13 : pos % 10 === 1 ? 10 : pos % 10 === 2 ? 11 : pos % 10 === 3 ? 12 : 13;
      const x = num(pos, m, m, 0); put(suf, x + 2 * k, m, 0.72); }
    // vueltas (cifras pequeñas y una barra inclinada)
    if (opt.hpos && rc.laps > 1) { const y = m + 50 * k, sc = 0.62, x = num(rc.phase === 'finished' ? rc.laps : Math.min(rc.lap + 1, rc.laps), m + 4 * k, y, 27, sc);
      g.save(); g.lineCap = 'round'; g.strokeStyle = '#000'; g.lineWidth = 6 * k; g.beginPath(); g.moveTo(x + 12 * k, y + 4 * k); g.lineTo(x + 2 * k, y + 24 * k); g.stroke(); g.strokeStyle = '#f2f2f2'; g.lineWidth = 3.2 * k; g.stroke(); g.restore();
      num(rc.laps, x + 14 * k, y, 27, sc); }
    // nitro: una «r» por lata; con el turbo puesto, giran, se enciende el piloto y la barra se va vaciando
    let RX = W - m; { const mi = h.q('mini'); if (opt.hmini && mi && mi.offsetParent) { const a = mi.getBoundingClientRect(); if (a.top - r.top < H / dpr * 0.4 && a.left > r.left + r.width / 2) RX = Math.min(RX, (a.left - r.left) * dpr - m); } }   // a la izquierda del minimapa
    // nitro: cuadraditos (uno por lata), como en el marcador moderno; el que se está gastando parpadea
    if (opt.hnitro) { const n = c.nitroInf ? 0 : Math.max(0, Math.min(12, c.nitros | 0)), act = c.nitroT > 0, q = 15 * k, gp = 5 * k;
      const tot = n + (act && !c.nitroInf ? 1 : 0); let x = RX - tot * (q + gp);
      for (let i = 0; i < tot; i++, x += q + gp) { const burn = act && i === tot - 1 && !c.nitroInf; if (burn && (performance.now() / 120 | 0) % 2) continue;
        g.fillStyle = '#000'; g.fillRect(x - 2 * k, m - 2 * k, q + 4 * k, q * 1.5 + 4 * k); g.fillStyle = burn ? '#ffd23f' : '#e2231a'; g.fillRect(x, m, q, q * 1.5); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, m, q, q * 0.35); }
      if (c.nitroInf) { g.font = `900 ${26 * k}px system-ui`; g.textAlign = 'right'; g.lineWidth = 4 * k; g.strokeStyle = '#000'; g.fillStyle = act ? '#ffd23f' : '#fff'; g.strokeText('N₂O ∞', RX, m + 24 * k); g.fillText('N₂O ∞', RX, m + 24 * k); g.textAlign = 'left'; } }
    // daños
    if (opt.damage !== '0' && !netRace) { const d = Math.min(100, Math.round(c.dmg || 0)), sc = 0.6, y = H - m - 42 * k * sc; let x = m + put(25, m, y, sc); x = num(d, x + 4 * k, y, 27, sc); put(26, x, y, sc);
      if (d >= 80) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = d >= 95 ? 'rgba(255,40,30,.5)' : 'rgba(255,170,40,.35)'; g.fillRect(0, y, x + 40 * k, 42 * k); g.globalCompositeOperation = 'source-over'; } }
    // avisos
    let msg = null; if (h.oMsg && (h.oMsg.t -= dt) > 0) msg = h.oMsg.k; if (rc.wrong && (performance.now() / 400 | 0) % 2 === 0) msg = 20;
    if (msg != null && opt.hmsg) { const s = S[msg], sc = 1.1; put(msg, (W - s.width * k * sc) / 2, H * 0.3, sc); }
  }
  function flash(h, text, secs = 2, cls = '') { const e = h.q('msg'); e.textContent = text; e.className = 'msg ' + cls; e.style.animation = 'none'; void e.offsetWidth; e.style.animation = ''; e.hidden = false; h.msgT = secs; }
  const recKey = h => 'brr_rec_' + lvl.name + '_' + h.car.def.name + '_' + h.race.laps;
  function getRec(h) { try { return JSON.parse(ST.get(recKey(h)) || '{}'); } catch (e) { return {}; } }
  function handleEvents(h) {
    const first = h === humans[0];   // los sonidos comunes (cuenta atrás) solo una vez
    for (const e of h.race.ev.splice(0)) {
      if (crazyJump() && (e.type === 'check' || e.type === 'missed' || e.type === 'wrong' || e.type === 'lap')) continue;   // sin vueltas: nada de avisos de controles
      if (e.type === 'beep') { flash(h, String(e.n), 1, 'big cnt n' + e.n); if (first && audio) { audio.play('SAMPLES/BEEP3.WAV'); if (e.n === 3 && snd.pickVoice) { const v = pickV('READYGO'); if (v) audio.voice(v, true); } } }
      if (e.type === 'go') { flash(h, '¡YA!', 1, 'big cnt go'); if (first && audio) audio.play('SAMPLES/BEEP4.WAV'); }
      if (e.type === 'check') { flash(h, `Control ${e.num}/${e.of}  ·  ${fmt(e.split)}`, 2); if (audio) audio.play('GEN/CHECKPOI.WAV'); }
      if (e.type === 'missed') { if (opt.hudstyle === 'original') h.oMsg = { k: 40, t: 2.5 }; else flash(h, '¡Te has saltado un control! Vuelve atrás', 2.5, 'warn'); if (audio) audio.play('GEN/CHCKMIS.WAV'); }
      if (e.type === 'wrong') { if (audio) audio.play('GEN/WRGWAY.WAV'); if (h === humans[0]) say(['WRONG', 'WRGWAY', 'BACKW'], 0.7, false); }
      if (e.type === 'lap' || e.type === 'finish') ghostLap(h, e.lapTime);
      if (e.type === 'lap') {
        const rec = getRec(h), best = !rec.lap || e.lapTime < rec.lap; if (best) { rec.lap = e.lapTime; ST.set(recKey(h), JSON.stringify(rec)); }
        flash(h, `Vuelta ${e.lap}: ${fmt(e.lapTime)}${best ? '  ·  ¡récord!' : ''}${e.final ? '  ·  ÚLTIMA VUELTA' : ''}`, 3); if (e.final && opt.hudstyle === 'original') h.oMsg = { k: 21, t: 3 };
        if (audio) audio.play(e.final ? 'GEN/FINLAP.WAV' : 'GEN/LAPCOM.WAV'); if (e.final && h === humans[0]) setTimeout(() => say(['LASTLAP', 'LAST', 'FINAL'], 0.9), 900); else if (best && h === humans[0]) say(['RECORD', 'FAST', 'BEST'], 0.5, false);
      }
      if (e.type === 'finish') humanFinished(h, e);
    }
  }
  function humanFinished(h, e) {
    const rec = getRec(h); h.newLap = !rec.lap || e.lapTime < rec.lap; h.newTotal = !rec.total || e.total < rec.total;
    if (h.newLap) rec.lap = e.lapTime; if (h.newTotal) rec.total = e.total;
    ST.set(recKey(h), JSON.stringify(rec));
    h.done = true; h.total = e.total; updatePositions(0); h.pos = order.findIndex(o => o.h === h) + 1;
    if (h === humans[0] && crazy && crazy.mode === 'kart' && h.pos === 1 && order.length > 1) achUnlock('m_kart');
    if (h === humans[0] && !freeMode) { const withRivals = order.length > 1; statsAdd(S => { S.races = (S.races || 0) + 1; if (withRivals && h.pos === 1) S.wins = (S.wins || 0) + 1; if (withRivals && h.pos <= 3) S.podiums = (S.podiums || 0) + 1; if (h.newLap) S.recLaps = (S.recLaps || 0) + 1; }); statsFlush(); }
    if (humans.length > 1) { h.q('done').textContent = h.pos === 1 ? '¡1º! ¡GANADOR!' : h.pos + 'º'; h.q('done').hidden = false; }
    if (h === humans[0] && !freeMode) { const withR = order.length > 1, win = withR && h.pos === 1;
      achUnlock('primera'); if (win) achUnlock('victoria'); if (win && !h.usedNitro) achUnlock('sinnitro'); if (win && h.wasLast) achUnlock('remontada');
      if (ttMode && h.newLap) achUnlock('record'); if (netRace) { achUnlock('online'); if (win) achUnlock('onlinewin'); }
      if (humans.length >= 2) achUnlock('fiesta'); if (opt.paint && myTeamName()) achUnlock('estilo');
      const S = statsGet(); if ((S.races || 0) >= 50) achUnlock('veterano'); if ((S.km || 0) >= 100) achUnlock('km100');
      statsAdd(S2 => { S2.tracks = S2.tracks || {}; if (!lvl.custom) S2.tracks[lvl.name] = 1; if (front && front.tracks && Object.keys(S2.tracks).length >= front.tracks.filter(t => !t.custom).length) achUnlock('turista'); }); }
    if (audio) { const v = snd.pickVoice && (pickV('FINISH') || pickV('GAMEOVER')); if (v) audio.voice(v, true); }
    // resultados cuando han llegado todos los jugadores (o 45 s después del primero)
    if (humans.every(x => x.done) && rivals.filter(r => r.remote && !r.isAI).every(r => r.fin != null)) setTimeout(showResults, 1500);
    else if (netRace) { const iv = setInterval(() => { if (state !== 'race' || !netRace) return clearInterval(iv); if (rivals.filter(r => r.remote && !r.isAI).every(r => r.fin != null)) { clearInterval(iv); setTimeout(showResults, 1000); } }, 500); if (!finishTimer) finishTimer = setTimeout(showResults, 45000); }
    else if (!finishTimer) finishTimer = setTimeout(() => { for (const x of humans) if (!x.done) { x.done = true; x.dnf = true; } showResults(); }, 45000);
  }
  let finishTimer = null, netResT = null;
  function showResults() {
    clearTimeout(finishTimer); finishTimer = null; if (state !== 'race' && state !== 'results') return;
    updatePositions(0);
    const multi = humans.length > 1, h0 = humans[0], rec = getRec(h0), bestLap = h0.race.lapTimes.length ? Math.min(...h0.race.lapTimes) : null;
    const who = o => o.h ? (multi ? 'Jugador ' + (o.h.i + 1) : 'Tú') : o.name && !o.isAI ? o.name + ' <small style="color:var(--mut)">(online)</small>' : teamLabel(o.car) + (o.ai ? ' <small style="color:var(--mut)">(' + o.ai.P.name.toLowerCase() + ')</small>' : '');
    const posRows = (rivals.length || multi) ? `<tr class="hdr"><td colspan="2">Clasificación</td></tr>` + order.map((o, i) => `<tr${o.h ? ' class="me"' : ''}><td>${headImg(o.car.team, 26)}${i + 1}. ${who(o)}</td><td>${crazyR() ? (crazy.loser && crazy.loser.car === o.car ? '💣 ¡bum!' : o.car.cop ? '🚨 poli' : o.car.robber && o.car.out ? '💰 pillado' : o.car.robber ? '💰 caco libre' : o.car.zombie ? '🧟 zombi' : o.car.out ? 'eliminado' : 'superviviente') : o.race.finishT != null ? fmt(o.race.finishT) : 'en carrera'}</td></tr>`).join('') : '';
    const laps = multi || crazyR() ? '' : `<tr class="hdr"><td colspan="2">Tus vueltas</td></tr>` + h0.race.lapTimes.map((t, i) => `<tr${t === bestLap ? ' class="best"' : ''}><td>Vuelta ${i + 1}</td><td>${fmt(t)}</td></tr>`).join('') + `<tr class="tot"><td>Total</td><td>${fmt(h0.total)}</td></tr>`;
    $('r_list').innerHTML = posRows + laps;
    const myPos = h0.pos || order.findIndex(o => o.h === h0) + 1;
    $('r_rec').textContent = crazyR() ? CRAZY_NAME[crazy.mode] + ' · ' + order.filter(o => o.car.out).length + ' eliminados' : multi ? '' : (h0.newTotal ? '¡Nuevo récord de carrera! ' : 'Récord de carrera: ' + fmt(rec.total) + '. ') + (h0.newLap ? '¡Nueva mejor vuelta!' : 'Mejor vuelta: ' + fmt(rec.lap) + '.');
    const winner = order[0];
    $('r_title').textContent = multi ? (winner.h ? '¡Gana el Jugador ' + (winner.h.i + 1) + '!' : (winner.car.teamName ? '¡Gana ' + winner.car.teamName + '!' : 'Gana el equipo ' + TEAM[winner.car.team].n)) + ' · ' + lvl.name
      : rivals.length ? (myPos === 1 ? '¡Has ganado!' : `Has quedado ${myPos}º`) + ' · ' + lvl.name : 'Carrera terminada · ' + lvl.name;
    if (crazyR() && !multi) { const me = h0.car; $('r_title').textContent = (crazy.mode === 'bomba' ? (me.out ? '¡Bum! Has perdido' : '¡Último superviviente!') : crazy.mode === 'zombie' ? (me.zombie ? 'Te han infectado' : '¡Has sobrevivido!') : crazy.mode === 'polis' ? (crazy.team === 'cops' ? '¡Ganan los polis!' : '¡Ganan los cacos!') + ((crazy.team === 'cops') === me.cop ? ' · ¡HAS GANADO!' : ' · has perdido') : myPos === 1 ? '¡Último superviviente!' : 'Eliminado · ' + myPos + 'º') + ' · ' + lvl.name; }
    if (ttMode && !multi && bestLap) { lbSubmit(lvl.name, car.def.name, bestLap, h0.total); $('r_title').textContent = 'Contrareloj · ' + lvl.name + ' · mejor vuelta ' + fmt(bestLap);
      if (reto && reto.level === lvl.name) { lbSubmit(reto.id, car.def.name, bestLap, h0.total); $('r_title').textContent = '⭐ Reto semanal · ' + lvl.name + ' · mejor vuelta ' + fmt(bestLap); } }
    if (tourMode && rivals.length) { $('r_rec').textContent += ' ' + tournResult(myPos); $('r_again').hidden = true; $('r_menu').textContent = 'Volver al torneo'; }
    else { $('r_again').hidden = false; $('r_menu').textContent = 'Menú'; }
    if (netRace) { $('r_again').hidden = !BRR_net.isHost; $('r_again').textContent = 'Revancha'; $('r_again').onclick = BRR_net.isHost ? () => { toMenu(); setTimeout(() => { if (BRR_net.isHost && BRR_net.room) netLaunch(); }, 900); } : null; }
    else { $('r_again').textContent = 'Repetir'; $('r_again').onclick = restart; }
    if (netRace) { netRace.resultIds = order.map(o => o.h ? { id: BRR_net.id, name: opt.netName || 'Piloto' } : { id: o.id, name: o.name || 'IA' }).filter(x => x.id);
      clearTimeout(netResT); netResT = setTimeout(() => { if (state === 'results' && netRace) toMenu(); }, 12000); $('r_menu').textContent = 'Volver a la sala'; }
    if (front && front.bg.results) $('results').style.backgroundImage = `url(${front.bg.results})`;
    state = 'results';
    if (orig && fromOrig && opt.menu !== 'moderno') {   // resultados en la pantalla original (RESULSCN)
      const rows = order.slice(0, 6).map((o, i) => `${i + 1}. ${o.h ? (multi ? 'JUGADOR ' + (o.h.i + 1) : 'TU') : (o.car.teamName ? o.car.teamName.toUpperCase() : 'EQUIPO ' + TEAM[o.car.team].n.toUpperCase())}  ${o.race.finishT != null ? fmt(o.race.finishT) : '--'}`);
      if (audio) { audio.stopAll(); audio.playTrack(2); }
      orig.results(rows, $('r_title').textContent.replace(' · ', ' - ').toUpperCase().slice(0, 26), $('r_rec').textContent.toUpperCase().slice(0, 48), () => { orig.close(); toMenu(); });
      return;
    }
    $('r_replay').hidden = !rpRec || rpRec.frames.length < 10; { const b = $('r_rpsave'); b.hidden = $('r_replay').hidden; b.disabled = !!(rpRec && rpRec.savedId); b.textContent = rpRec && rpRec.savedId ? '✓ Repetición guardada' : '💾 Guardar repetición'; } $('results').hidden = false;
  }
  $('r_again').onclick = restart;
  function toMenu() {
    if (netRace) { const ids = netRace.resultIds; netRace = null; netWait = false; clearTimeout(netResT); $('netbar').hidden = true; if (BRR_net.isHost && BRR_net.room) netAfterRace(ids); fromOrig = false; if (orig) orig.close(); opt.menu = 'moderno';
      setTimeout(() => { go(BRR_net.lanUrl ? 'lan' : 'online'); netRenderRoom(); }, 50); }
    statsFlush(); clearTimeout(finishTimer); finishTimer = null; $('results').hidden = true; if (audio) { audio.stopAll(); audio.stopMusic(); }
    retoEnd(); state = 'menu'; show('menu'); if (edBack) { edBack = false; setTimeout(() => BRR.editor && BRR.editor.open(edTrack), 30); } renderTourn(); selectTrack(opt.level, false); tourMode = false; ttMode = false; freeMode = false; go(view, true); if (qmode === 'tt' && view === 'tt') refreshLB();
    if (orig && fromOrig && opt.menu !== 'moderno') { fromOrig = false; state = 'origmenu'; if (!orig.on) { orig.on = true; orig.root.hidden = false; orig.loop(); } if (audio) audio.playTrack(2); orig.globe(); }
    else menuMusic();
  }
  $('r_menu').onclick = toMenu;
  $('r_replay').onclick = () => rpOpen();
  // ---------- minimapa (recorrido + controles + coches) ----------
  let mm = null, mmPath = null;
  function prepMinimap() {
    // el dibujo del recorrido: la trazada real de una vuelta grabada del original (los coches van justo por ahí); si no hay, el .CSE
    let P = lvl.course;
    try { const recs = BRR.loadReplays(lvl), S = BRR.S, a = -lvl.start.yaw, gx = lvl.start.x / S, gz = -lvl.start.z / S, fw = [Math.sin(a), Math.cos(a)], rt = [Math.cos(a), -Math.sin(a)];
      for (const rec of recs) { const sl = lvl.gridSlots[rec.slot] || [0, 0, 0], L = BRR.replayLine(lvl, rec, gx + rt[0] * sl[0] + fw[0] * sl[1], gz + rt[1] * sl[0] + fw[1] * sl[1], (lvl.start.a16 || 0) + (sl[2] || 0), 0.25);
        if (L) { P = L.pts.map(q => q.p); break; } } } catch (e) { }
    mm = null; if (!P.length) return; mmPath = P;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of P) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
    const sz = Math.max(x1 - x0, z1 - z0) * 1.15 || 1; mm = { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, sz };
  }
  function drawMinimap(h) {
    const c = h.q('mini'); c.hidden = !mm; if (!mm) return; const g = c.getContext('2d'), W = c.width, s = W / mm.sz;
    const X = p => W / 2 + (p[0] - mm.cx) * s, Y = p => W / 2 + (p[2] - mm.cz) * s;
    g.clearRect(0, 0, W, W); g.lineJoin = 'round';
    g.beginPath(); (mmPath || lvl.course).forEach((p, i) => i ? g.lineTo(X(p), Y(p)) : g.moveTo(X(p), Y(p))); g.closePath();
    const rw = Math.max(11, s * 16);   // ancho de la carretera a escala (unos 16 m), para que los coches caigan dentro
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = rw + 6; g.stroke(); g.strokeStyle = 'rgba(235,240,248,.88)'; g.lineWidth = rw; g.stroke();
    // controles: una raya amarilla que cruza la carretera (la meta en blanco y negro); el siguiente, más gruesa y brillante
    g.lineCap = 'butt';
    for (const gt of h.race.gates) {
      const nx = gt.num === h.race.expected, ax = gt.ax || [1, 0, 0], al = Math.hypot(ax[0], ax[2]) || 1, L = rw / 2 + (nx ? 6 : 4), dx = ax[0] / al * L, dy = ax[2] / al * L, x = X(gt.c), y = Y(gt.c);
      const line = (w, col, dash) => { g.setLineDash(dash || []); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x - dx, y - dy); g.lineTo(x + dx, y + dy); g.stroke(); };
      if (gt.num === 0) { line(7, '#000'); line(5, '#fff', [4, 4]); }
      else { line(nx ? 7 : 5, 'rgba(0,0,0,.6)'); line(nx ? 4.5 : 2.5, nx ? '#ffd23f' : 'rgba(255,210,63,.55)'); }
    }
    g.setLineDash([]);
    const dot = c2 => { g.fillStyle = c2.zombie ? '#46cd3c' : c2.cop ? '#2f5cff' : carCol(c2); g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(X(c2.p), Y(c2.p), 6, 0, 7); g.fill(); g.stroke(); };
    for (const r of rivals) if (!r.car.out) dot(r.car); for (const o of humans) if (o !== h && !o.car.out) dot(o.car);
    const cc = h.car, f = cc.forward(), a = Math.atan2(f[0], -f[2]);
    g.save(); g.translate(X(cc.p), Y(cc.p)); g.rotate(a); g.fillStyle = carCol(cc); g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
  }

  // ---------- entrada ----------
  // Controles: con 1 jugador vale todo (teclado completo + cualquier mando).
  // Con varios: cada mando conectado es un jugador; si faltan mandos, los primeros juegan con teclado
  // (J1: WASD, Espacio freno de mano, Mayús izq. nitro · J2: flechas, Ctrl dcho. freno de mano, Intro nitro).
  const keys = {};
  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Escape' && photo) { togglePhoto(); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    if (state === 'race' && e.code === 'KeyO') toggleLight();
    if ((state === 'race' || photo) && e.code === 'KeyF' && document.activeElement.tagName !== 'INPUT') togglePhoto();
    if (state === 'race') {
      for (const h of humans) { const K = h.ctl && h.ctl.kb && KB[h.ctl.kb]; if (!K || e.repeat) continue;
        if (K.cam.includes(e.code)) cycleCam(h); if (K.reset.includes(e.code)) recoverHuman(h); }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Backspace'].includes(e.code)) e.preventDefault();
    }
  });
  addEventListener('keyup', e => keys[e.code] = false);
  const CAMS = ['cerca', 'lejos', 'alta', 'capo', 'parachoques', 'tv', 'cenital'], CAM_N = { cerca: 'persecución cerca', lejos: 'persecución lejos', alta: 'persecución alta', capo: 'cabina', parachoques: 'parachoques', tv: 'televisión', cenital: 'cenital (miniaturas)' };
  function cycleCam(h = humans[0]) { const cur = h.camMode || opt.cam, nx = CAMS[(CAMS.indexOf(cur) + 1) % CAMS.length]; h.camMode = nx; h.cam.init = h.cam.posInit = false; if (h.i === 0) { opt.cam = nx; $('o_cam').value = nx; save(); } flash(h, 'Cámara: ' + CAM_N[nx], 1.2); }
  // comparador: iluminación original de 1995 / moderna, en plena carrera
  function toggleLight() { opt.light = opt.light === 'original' ? 'moderna' : 'original'; $('o_light').value = opt.light; R.mode = opt.light === 'original' ? 0 : 1; R.setShadows(R.mode ? opt.shadows : 0); save();
    for (const h of humans) flash(h, opt.light === 'original' ? 'Iluminación original (1995)' : 'Iluminación moderna', 1.4); }
  // pausa automática al cambiar de ventana o de pestaña (o al suspender el ordenador)
  const autoPause = () => { if (opt.autopause !== false && state === 'race' && !netRace && !photo) togglePause(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); }); addEventListener('blur', autoPause);
  addEventListener('pagehide', () => { try { if (BRR_net.room) BRR_net.leave(); } catch (e) { } });   // al cerrar la pestaña se avisa a los demás (el anfitrión pasa el testigo)
  // ---------- modo foto: la carrera se congela y la cámara vuela libre ----------
  let photo = null;
  function togglePhoto() {
    if (photo) { photo = null; $('photo').hidden = true; R.exposure = 0; R.dof = 0; document.body.classList.remove('photo'); $('hud').hidden = false; if (document.pointerLockElement) document.exitPointerLock(); last = performance.now(); return; }
    if (state !== 'race' || netRace || !humans.length) return;
    const cam = humans[0].cam, f = V.norm(V.sub(cam.look, cam.pos));
    photo = { p: cam.pos.slice(), yaw: Math.atan2(-f[0], -f[2]), pitch: Math.asin(Math.max(-1, Math.min(1, f[1]))) };
    $('photo').hidden = false; $('ph_hud').checked = false; $('hud').hidden = true; $('ph_exp').value = 0; $('ph_dof').value = 0;
  }
  $('ph_exit').onclick = togglePhoto;
  $('ph_hud').onchange = () => { $('hud').hidden = !$('ph_hud').checked; };
  $('ph_exp').oninput = () => R.exposure = +$('ph_exp').value / 100 * 1.5;
  $('ph_dof').oninput = () => R.dof = +$('ph_dof').value / 100;
  let photoShot = false; $('ph_shot').onclick = () => { photoShot = true; };
  canvas.addEventListener('click', () => { if (photo && canvas.requestPointerLock) canvas.requestPointerLock(); });
  addEventListener('mousemove', e => { if (photo && document.pointerLockElement === canvas) { photo.yaw -= e.movementX * 0.0025; photo.pitch = Math.max(-1.45, Math.min(1.45, photo.pitch - e.movementY * 0.0025)); } });
  function photoFrame(dt) {
    const P = photo; let mx = 0, mz = 0, my = 0, fast = keys.ShiftLeft || keys.ShiftRight;
    if (keys.KeyW || keys.ArrowUp) mz += 1; if (keys.KeyS || keys.ArrowDown) mz -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1; if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyE) my += 1; if (keys.KeyQ) my -= 1;
    const gp = pads()[0]; if (gp) { const dz = v => Math.abs(v) < 0.15 ? 0 : v; mx += dz(gp.axes[0] || 0); mz -= dz(gp.axes[1] || 0); P.yaw -= dz(gp.axes[2] || 0) * 2 * dt; P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch - dz(gp.axes[3] || 0) * 2 * dt));
      my += (gp.buttons[7] ? gp.buttons[7].value : 0) - (gp.buttons[6] ? gp.buttons[6].value : 0); if (gp.buttons[0] && gp.buttons[0].pressed) fast = true; }
    const sp = (fast ? 30 : 8) * dt, cy = Math.cos(P.yaw), sy = Math.sin(P.yaw), cp = Math.cos(P.pitch), spp = Math.sin(P.pitch);
    P.p = [P.p[0] + (-sy * mz + cy * mx) * sp, P.p[1] + my * sp, P.p[2] + (-cy * mz - sy * mx) * sp];
    const g = lvl.terrain(P.p[0], P.p[2]) + 0.3; if (P.p[1] < g) P.p[1] = g;
    const cam = humans[0].cam; cam.pos = P.p; cam.look = [P.p[0] - sy * cp, P.p[1] + spp, P.p[2] - cy * cp]; cam.up = [0, 1, 0];
    // enfoque automático en tu coche
    const d = Math.max(0.5, V.len(V.sub(humans[0].car.p, P.p))), F = opt.far, n = 0.3; R.focusZ = (F / (F - n)) * (1 - n / d);
  }
  let pauseAt = 0;
  // ---------- controles táctiles (móvil / tablet): aparecen al tocar la pantalla durante la carrera ----------
  const TOUCH = { on: false, k: {}, was: false };
  (function touchSetup() {
    const root = document.createElement('div'); root.id = 'touch'; root.hidden = true;
    root.innerHTML = `<div class="tl"><button data-k="left" aria-label="Izquierda">◀</button><button data-k="right" aria-label="Derecha">▶</button></div>
      <div class="tr"><button data-k="act" class="sm" aria-label="Objeto / salto">★</button><button data-k="nitro" class="sm" aria-label="Nitro">N₂O</button><button data-k="hb" class="sm" aria-label="Freno de mano">⊓</button>
        <button data-k="brake" aria-label="Freno">▼</button><button data-k="gas" class="big" aria-label="Acelerar">▲</button></div>
      <div class="rot">⟳ Gira el móvil para jugar en horizontal</div><div class="tt"><button data-t="pause" aria-label="Pausa">⏸</button><button data-t="cam" aria-label="Cámara">🎥</button><button data-t="reset" aria-label="Volver a la pista">↺</button><button data-k="horn" aria-label="Bocina">📯</button></div>`;
    document.body.appendChild(root);
    const set = (b, on) => { const k = b.dataset.k; if (k) { TOUCH.k[k] = on; b.classList.toggle('on', on); } };
    for (const b of root.querySelectorAll('button')) {
      b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) { } set(b, true);
        const t = b.dataset.t; if (t === 'pause') togglePause(); else if (t === 'cam' && humans[0]) cycleCam(humans[0]); else if (t === 'reset' && humans[0]) recoverHuman(humans[0]);
        if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) { } });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => set(b, false));
      b.addEventListener('contextmenu', e => e.preventDefault());
    }
    // se activan con el primer toque (o en pantallas táctiles) y solo se ven en carrera
    const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    TOUCH.on = coarse || opt.touch === 'si'; if (opt.touch === 'no') TOUCH.on = false;
    window.addEventListener('touchstart', () => { TOUCH.lastT = Date.now(); if (opt.touch !== 'no' && !TOUCH.on) TOUCH.on = true; }, { passive: true });
    setInterval(() => { if (pads().some(g => g.buttons.some(b => b.pressed) || g.axes.some(a => Math.abs(a) > 0.4))) TOUCH.padT = Date.now();   // jugando con mando: los botones táctiles se esconden hasta que vuelvas a tocar la pantalla
      const on = opt.touch === 'si' || (opt.touch !== 'no' && TOUCH.on && !((TOUCH.padT || 0) > (TOUCH.lastT || 0)));
      const vis = on && state === 'race' && !photo && humans.length === 1; if (root.hidden === vis) root.hidden = !vis; document.body.classList.toggle('touchui', vis); if (!vis) for (const k in TOUCH.k) TOUCH.k[k] = false; }, 200);
  })();
  function togglePause() { pauseAt = performance.now();
    if (netRace && state === 'race') { $('pause').hidden = !$('pause').hidden; return; }
    if (state === 'race') { state = 'pause'; show('pause'); if (audio && audio.ctx) audio.ctx.suspend();
      $('p_swap').hidden = !(freeMode && humans.length === 1 && !netRace); }
    else if (state === 'pause') { state = 'race'; show('hud'); last = performance.now(); if (audio && audio.ctx) audio.ctx.resume(); }
  }
  $('p_resume').onclick = togglePause;
  $('p_photo').onclick = () => { if (state === 'pause') togglePause(); if (state === 'race' && !photo) togglePhoto(); };
  // modo libre: cambiar de vehículo sin salir (aparece en el mismo sitio, mirando hacia donde ibas)
  async function swapVehicle(veh) {
    const h = humans[0]; if (!h || !lvl || !veh || veh === h.car.def.name || !files.has(veh + '.VHC')) return;   // (aviso de la 0.53: vehículo vacío)
    const old = h.car, d = await BRR.loadVehicle(files, veh, lvl, old.team, { glass: garGlass(garMine(veh)), logo: await myLogoRGBA(), logoHi: opt.logo === 'custom' ? await logoHiOf(opt.customLogoHi || opt.customLogo) : myLogoData() ? await logoHiOf(myLogoData()) : null, paint: hexRGB(opt.paint) });
    const c = new BRR.Car(d, lvl); Object.assign(c, { team: old.team, isPlayer: true, human: 0, paintHex: old.paintHex, teamName: old.teamName, headDraw: old.headDraw, nitros: old.nitros, nitroInf: old.nitroInf });
    const f = old.forward(); c.reset(old.p[0], old.p[2], Math.atan2(-f[0], -f[2]), old.p[1]);
    garApply(c, garMine(veh));
    h.car = car = c; h.draw = R.upload(d.mesh); carDraw = { body: h.draw, ...vehDraw(d) }; { const rw = rimWheels(d, garMine(d.name)); if (rw) carDraw = { ...carDraw, wheels: carDraw.wheels.map((w, i) => rw[i] || w) }; } h.cam.init = h.cam.posInit = false; if (fx) fx.reset();
    try { await startSounds(lvl.name, d); } catch (e) { }
    opt.vehicle = veh; save();
  }
  // menú de vehículos (desde la pausa del modo libre): cuadrícula con la foto de cada uno; los del circuito, primero y marcados
  $('p_swap').onclick = async () => {
    show('vehpick'); const cur = humans[0].car.def.name, own = await carsFor(lvl.name), all = BRR.VEHICLES.filter(n => files.has(n + '.VHC')), list = own.filter(n => all.includes(n)).concat(all.filter(n => !own.includes(n)));
    $('vp_grid').innerHTML = list.map(n => `<div class="pitem${n === cur ? ' on' : ''}" tabindex="0" data-v="${n}"><img alt=""><span>${esc(VEH_NAMES[n] || n)}</span>${own.includes(n) ? '<small>★ <span>De este circuito</span></small>' : ''}</div>`).join('');
    for (const el of $('vp_grid').querySelectorAll('.pitem')) el.onclick = async () => { el.style.opacity = 0.5; try { await swapVehicle(el.dataset.v); } finally { show('pause'); togglePause(); } };
    setTimeout(() => navFocusFirst($('vehpick')), 0);
    for (const el of $('vp_grid').querySelectorAll('.pitem')) { if ($('vehpick').hidden) break; try { const t = await orig.h.carThumb(el.dataset.v, humans[0].car.team || 1, lvl.name, opt.paint); el.querySelector('img').src = t.frame(0.75).toDataURL(); } catch (e) { } }
  };
  $('vp_back').onclick = () => { show('pause'); setTimeout(() => navFocusFirst($('pause')), 0); };
  $('p_menu').onclick = () => { if (audio && audio.ctx) audio.ctx.resume(); toMenu(); };
  $('p_restart').onclick = () => { if (audio && audio.ctx) audio.ctx.resume(); restart(); };
  for (const b of document.querySelectorAll('.optbtn')) b.onclick = () => { $('optpanel').hidden = !$('optpanel').hidden; };
  const pads = () => (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter(g => g && g.connected);
  // mandos "de verdad": se apunta cómo está cada uno al aparecer (algunos aparatos virtuales o volantes tienen ejes o botones fijos);
  // se da por bueno en cuanto se pulsa un botón o se mueve un eje respecto a ese reposo
  const padInfo = new Map();
  function padSeen(gp) {
    let I = padInfo.get(gp.index); if (!I || I.id !== gp.id) { I = { id: gp.id, ax: [...gp.axes], bt: gp.buttons.map(b => b.pressed), active: false }; padInfo.set(gp.index, I); }
    if (!I.active && (gp.buttons.some((b, i) => b.pressed && !I.bt[i]) || gp.axes.some((v, i) => Math.abs(v - (I.ax[i] || 0)) > 0.5))) I.active = true;
    return I;
  }
  const padsFor = ctl => { if (ctl.pad == null) return []; const P = pads(); if (ctl.pad !== 'all') return P.filter(g => g.index === ctl.pad);
    const A = P.filter(g => padSeen(g).active); return A.length ? A : P; };
  function assignControls() {
    const P = pads(), n = humans.length;
    // 1 jugador: valen TODOS los mandos a la vez (en muchos PC el sistema enseña varios aparatos: el mando de verdad no siempre es el primero)
    if (n === 1) { humans[0].ctl = { kb: 'all', pad: 'all' }; return; }
    P.sort((a, b) => (padSeen(b).active ? 1 : 0) - (padSeen(a).active ? 1 : 0) || a.index - b.index);   // primero los que se han usado de verdad
    const cnt = P.filter(g => padSeen(g).active).length || P.length, kbN = Math.min(2, Math.max(0, n - cnt)); let pi = 0;
    humans.forEach((h, i) => { h.ctl = i < kbN ? { kb: kbN === 1 ? 'all' : (i === 0 ? 'A' : 'B'), pad: null } : { kb: null, pad: P[pi] ? P[pi++].index : null }; });
  }
  const KB = {
    all: { up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], hb: ['Space'], nitro: ['ShiftLeft', 'KeyN'], horn: ['KeyH'], cam: ['KeyC'], reset: ['KeyR'], ramp: ['KeyT'], pipe: ['KeyG'], jump: ['KeyV'], climb: ['KeyE'], dive: ['KeyQ'], lookL: ['KeyJ'], lookR: ['KeyL'], lookB: ['KeyK'] },
    A: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], hb: ['Space'], nitro: ['ShiftLeft'], horn: ['KeyH'], cam: ['KeyC'], reset: ['KeyR'], ramp: ['KeyT'], pipe: ['KeyG'], jump: ['KeyV'], climb: ['KeyE'], dive: ['KeyQ'], lookL: [], lookR: [], lookB: [] },
    B: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], hb: ['ControlRight'], nitro: ['Enter', 'ShiftRight'], horn: ['Numpad0', 'Backslash'], cam: [], reset: ['Backspace'], ramp: ['Numpad1', 'Period'], pipe: ['Numpad2', 'Comma'], jump: ['Numpad3', 'Slash'], climb: ['PageUp'], dive: ['PageDown'], lookL: [], lookR: [], lookB: [] },
  };
  // controles a gusto (Opciones → Controles): se guardan en opt.keys / opt.pad y se aplican encima de los de fábrica
  const KB_DEF = JSON.parse(JSON.stringify(KB));
  const PAD_DEF = { throttle: [7, 0], brake: [6, 2], hb: [1, 5], nitro: [4], horn: [10, 11], reset: [3], cam: [8], ramp: [14], pipe: [15], jump: [12], climb: [12], dive: [13] };
  let PAD = { ...PAD_DEF };
  function applyBindings() {
    for (const L of Object.keys(KB_DEF)) for (const a of Object.keys(KB_DEF[L])) KB[L][a] = ((opt.keys || {})[L] || {})[a] || KB_DEF[L][a].slice();
    PAD = {}; for (const a of Object.keys(PAD_DEF)) PAD[a] = (opt.pad || {})[a] || PAD_DEF[a].slice();
  }
  applyBindings();
  // pantalla de controles
  const K_ACT = [['up', 'Acelerar'], ['down', 'Frenar / marcha atrás'], ['left', 'Girar a la izquierda'], ['right', 'Girar a la derecha'], ['hb', 'Freno de mano'], ['nitro', 'Nitro'], ['horn', 'Bocina'],
    ['cam', 'Cámara'], ['reset', 'Recolocar'], ['ramp', 'Poner rampa (modo libre)'], ['pipe', 'Poner half pipe (modo libre)'], ['jump', 'Saltar (modo libre)'], ['climb', 'Subir (helicóptero)'], ['dive', 'Bajar (helicóptero)'], ['lookL', 'Mirar a la izquierda'], ['lookR', 'Mirar a la derecha'], ['lookB', 'Mirar atrás']];
  const P_ACT = [['throttle', 'Acelerar'], ['brake', 'Frenar / marcha atrás'], ['hb', 'Freno de mano'], ['nitro', 'Nitro'], ['horn', 'Bocina'], ['reset', 'Recolocar'], ['cam', 'Cámara'], ['ramp', 'Poner rampa (modo libre)'], ['pipe', 'Poner half pipe (modo libre)'], ['jump', 'Saltar (modo libre)'], ['climb', 'Subir (helicóptero)'], ['dive', 'Bajar (helicóptero)']];
  const PAD_N = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menú', 'L3', 'R3', 'Cruceta ↑', 'Cruceta ↓', 'Cruceta ←', 'Cruceta →'];
  const keyName = c => !c ? '—' : c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : c.startsWith('Numpad') ? 'Num ' + c.slice(6) : ({ ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Espacio', ShiftLeft: 'Mayús izq.', ShiftRight: 'Mayús dcha.', ControlLeft: 'Ctrl izq.', ControlRight: 'Ctrl dcha.', AltLeft: 'Alt', AltRight: 'Alt Gr', Enter: 'Intro', Backspace: 'Retroceso', Backslash: '\\', PageUp: 'Re Pág', PageDown: 'Av Pág', Tab: 'Tab' }[c] || c);
  let kWait = null;
  function renderKeys() {
    const L = $('k_layout').value, pad = L === 'pad', acts = pad ? P_ACT : K_ACT, cur = pad ? PAD : KB[L];
    $('k_list').innerHTML = acts.map(([a, n]) => `<span>${n}</span>` + [0, 1].map(i => { const v = (cur[a] || [])[i]; return `<button data-a="${a}" data-i="${i}">${pad ? (v != null ? PAD_N[v] || 'Botón ' + v : '—') : keyName(v)}</button>`; }).join('')).join('');
    for (const b of $('k_list').querySelectorAll('button')) b.onclick = () => { if (kWait) kWait.b.classList.remove('wait'); kWait = { L, pad, a: b.dataset.a, i: +b.dataset.i, b }; b.classList.add('wait'); b.textContent = pad ? 'Pulsa un botón…' : 'Pulsa una tecla…'; if (pad) padListen(); };
  }
  function setBind(w, v) {
    const store = w.pad ? (opt.pad = opt.pad || {}) : ((opt.keys = opt.keys || {})[w.L] = (opt.keys || {})[w.L] || {});
    const list = (w.pad ? PAD[w.a] : KB[w.L][w.a]).slice(); if (v == null) list.splice(w.i, 1); else list[w.i] = v;
    store[w.a] = list.filter(x => x != null); save(); applyBindings(); kWait = null; renderKeys();
  }
  addEventListener('keydown', e => { if (!kWait || kWait.pad) return; e.preventDefault(); e.stopImmediatePropagation();
    if (e.code === 'Escape') { kWait = null; renderKeys(); return; } setBind(kWait, e.code === 'Delete' ? null : e.code); }, true);
  function padListen() { const w = kWait, prev = new Set(); for (const g of pads()) g.buttons.forEach((b, i) => { if (b.pressed) prev.add(g.index + ':' + i); });
    const tick = () => { if (kWait !== w) return; for (const g of pads()) g.buttons.forEach((b, i) => { const k = g.index + ':' + i; if (b.pressed && !prev.has(k) && kWait === w) setBind(w, i); else if (!b.pressed) prev.delete(k); }); if (kWait === w) requestAnimationFrame(tick); }; tick(); }
  $('k_layout').onchange = () => { kWait = null; renderKeys(); };
  $('k_reset').onclick = () => { const L = $('k_layout').value; if (L === 'pad') delete opt.pad; else if (opt.keys) delete opt.keys[L]; save(); applyBindings(); renderKeys(); };
  renderKeys();
  function readInput(h, dt) {
    const inp = { steer: 0, throttle: 0, brake: 0, handbrake: false, pitchAir: 0, lookX: 0, lookY: 0 }, ctl = h.ctl || {};
    const any = l => l.some(k => keys[k]);
    if (ctl.kb) {
      const K = KB[ctl.kb], kbSteer = (any(K.right) ? 1 : 0) - (any(K.left) ? 1 : 0);
      h.steerKb += (kbSteer - h.steerKb) * Math.min(1, dt * (kbSteer ? 6 : 10)); inp.steer = h.steerKb;
      inp.throttle = any(K.up) ? 1 : 0; inp.brake = any(K.down) ? 1 : 0; inp.handbrake = any(K.hb); inp.pitchAir = inp.throttle - inp.brake;
      if (any(K.lookL) || any(K.lookR)) inp.lookX = (any(K.lookR) ? 1 : 0) - (any(K.lookL) ? 1 : 0); if (any(K.lookB)) inp.lookX = 1;
      if (K.ramp && any(K.ramp)) inp.ramp = true; if (K.pipe && any(K.pipe)) inp.pipe = true; if (K.jump && any(K.jump)) inp.jump = true; if (any(K.nitro)) inp.nitro = true; if (K.horn && any(K.horn)) inp.horn = true; if (any(K.climb) || any(K.dive)) inp.climb = (any(K.climb) ? 1 : 0) - (any(K.dive) ? 1 : 0);
    }
    for (const gp of padsFor(ctl)) {
      const prev = (h.padPrevs || (h.padPrevs = {}))[gp.index] || {};
      const dz = (v, z = .12) => Math.abs(v) < z ? 0 : (v - Math.sign(v) * z) / (1 - z);
      const b = i => gp.buttons[i] ? gp.buttons[i].value : 0, pressed = i => gp.buttons[i] && gp.buttons[i].pressed;
      const sx = dz(gp.axes[0] || 0); if (sx) inp.steer = Math.sign(sx) * sx * sx * 0.4 + sx * 0.6;
      const bv = L => Math.max(0, ...L.map(b)), bp = L => L.some(pressed);
      inp.throttle = Math.max(inp.throttle, bv(PAD.throttle)); inp.brake = Math.max(inp.brake, bv(PAD.brake));
      inp.handbrake = inp.handbrake || bp(PAD.hb); inp.pitchAir = dz(gp.axes[1] || 0) * -1 || inp.pitchAir;
      inp.lookX = dz(gp.axes[2] || 0, 0.15) || inp.lookX; inp.lookY = dz(gp.axes[3] || 0, 0.15);   // stick derecho: mirar alrededor
      if (bp(PAD.nitro)) inp.nitro = true; if (bp(PAD.ramp)) inp.ramp = true; if (PAD.pipe && bp(PAD.pipe)) inp.pipe = true; if (PAD.jump && bp(PAD.jump)) inp.jump = true;
      if (bp(PAD.horn)) inp.horn = true;
      if (bp(PAD.climb) || bp(PAD.dive)) inp.climb = (bp(PAD.climb) ? 1 : 0) - (bp(PAD.dive) ? 1 : 0);
      const edge = i => pressed(i) && !prev[i];
      if (edge(9) && state === 'race' && performance.now() - pauseAt > 250) togglePause();
      // View/Select: suelto = cambiar de cámara · mantenido + Y = iluminación original/moderna · mantenido + X = modo foto
      if (pressed(8) && edge(3)) { toggleLight(); h.selCombo = true; } else if (state === 'race' && PAD.reset.some(edge) && !photo) recoverHuman(h);
      if (pressed(8) && edge(2) && h.i === 0) { togglePhoto(); h.selCombo = true; }
      if (!pressed(8) && prev[8]) { if (!h.selCombo && state === 'race' && !photo && PAD.cam.includes(8)) cycleCam(h); h.selCombo = false; }
      if (state === 'race' && !photo && PAD.cam.some(i => i !== 8 && edge(i))) cycleCam(h);
      const nx = {}; gp.buttons.forEach((x, i) => nx[i] = x.pressed); h.padPrevs[gp.index] = nx; h.padPrev = nx;
    }
    if (h.i === 0 && TOUCH.on) {   // controles táctiles (jugador 1)
      const T = TOUCH.k, ts = (T.right ? 1 : 0) - (T.left ? 1 : 0);
      if (ts || TOUCH.was) { h.steerT = (h.steerT || 0) + (ts - (h.steerT || 0)) * Math.min(1, dt * (ts ? 6 : 10)); if (ts || Math.abs(h.steerT) > 0.01) inp.steer = h.steerT; } TOUCH.was = !!ts;
      if (T.gas) inp.throttle = 1; if (T.brake) inp.brake = 1; if (T.gas || T.brake) inp.pitchAir = inp.throttle - inp.brake; if (T.hb) inp.handbrake = true; if (T.nitro) inp.nitro = true;
      if (T.act) { inp.jump = true; if (freeMode) inp.ramp = true; } if (T.horn) inp.horn = true;
    }
    if (h.i === 0 && window.BRR_TEST_INPUT) Object.assign(inp, window.BRR_TEST_INPUT);
    if (+opt.assist && h.race.phase === 'race' && !netRace) assist(h, inp, dt, +opt.assist);
    if (h.race.phase === 'countdown') { inp.throttle = 0; inp.brake = 0; inp.nitro = false; inp.climb = 0; inp.handbrake = true; }   // en la cuenta atrás no se mueve (ni marcha atrás)
    if (h.race.phase === 'finished') { inp.throttle = 0; inp.brake = 0.4; inp.steer = 0; }
    if (h.car.broken > 0 || h.car.kSpin > 0) { inp.throttle = 0; inp.nitro = false; inp.brake = 0; }   // destrozado: unos segundos sin control
    h.inp = inp; return inp;
  }
  setInterval(() => { const P = pads(); $('pad').textContent = P.length ? 'Mandos: ' + P.map(g => (padSeen(g).active ? '✓ ' : '') + (g.id.replace(/\(.*?\)/g, '').trim().slice(0, 28) || 'Mando') + (g.mapping === 'standard' ? '' : ' (modo DirectInput)')).join(' · ') : 'Mando: conéctalo y pulsa un botón para que el navegador lo detecte.'; }, 1500);

  // recolocar: en el último control pasado, mirando hacia el siguiente (o en la salida)
  // ---------- modo libre: rampa que pone cada jugador y acrobacias con puntos ----------
  let rampDef = null;
  async function loadRamp() {
    if (rampDef !== null) return rampDef;
    try { const A = await files.archive('CITY1.LEV'), m = BRR.parse3DW(A.get('RAMP.3DW')), colk = [...A.keys()].find(k => k.endsWith('.COL'));
      const pal = BRR.pal6((colk ? A.get(colk) : (await files.archive('ALWAYS.WAP')).get('DEFAULT.COL')).subarray(0, 768)), mb = new BRR.MeshBuilder(pal), tris = [];
      mb.addModel(m, v => BRR.toGL(v[0], v[1], v[2]), n => A.get(n + '.TM'), (a, b, c) => tris.push([a, b, c]));
      // eje de subida de la rampa (de lo bajo a lo alto) y su base
      const P = tris.flat(), mn = [0, 1, 2].map(i => Math.min(...P.map(q => q[i]))), mx = [0, 1, 2].map(i => Math.max(...P.map(q => q[i]))), top = P.reduce((a, q) => q[1] > a[1] ? q : a);
      const c = [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2], ax = (mx[0] - mn[0]) > (mx[2] - mn[2]) ? [Math.sign(top[0] - c[0]) || 1, 0, 0] : [0, 0, Math.sign(top[2] - c[2]) || 1];
      rampDef = { up: R.upload(mb), tris: tris.map(t => t.map(q => V.sub(q, c))), ax, len: Math.max(mx[0] - mn[0], mx[2] - mn[2]) };
    } catch (e) { console.warn('rampa', e); rampDef = false; }
    return rampDef;
  }
  async function placeRamp(h) {
    const D = await loadRamp(); if (!D) return; const c = h.car, f0 = c.forward(), f = V.norm([f0[0], 0, f0[2]]);
    const dist = Math.max(9, Math.min(28, 9 + Math.abs(c.speed()) * 0.45)) + D.len / 2, p = [c.p[0] + f[0] * dist, 0, c.p[2] + f[2] * dist];
    const n = [0, 1, 0]; p[1] = lvl.terrain(p[0], p[2], n);
    const fw = V.norm(V.sub(f, V.mul(n, V.dot(f, n)))), rt = V.norm([fw[2] * n[1] - fw[1] * n[2], fw[0] * n[2] - fw[2] * n[0], fw[1] * n[0] - fw[0] * n[1]]);
    // matriz: el eje de subida del modelo apunta a donde va el coche, su "arriba" sigue al suelo
    const A = D.ax, side = [A[2], 0, -A[0]];
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i][j] = rt[i] * side[j] + n[i] * (j === 1 ? 1 : 0) + fw[i] * A[j];
    h.ramp = { R: M, p: [p[0], p[1] - 0.05, p[2]], up: D.up }; if (netRace && h.i === 0) BRR_net.game({ k: 'ramp', t: 'ramp', p: h.ramp.p, R: M });
    lvl.collider.setDyn('ramp' + h.i, D.tris.map(t => t.map(q => V.add(h.ramp.p, BRR.mv(M, q)))), 'RAMP');
    if (audio) audio.play('GEN/SIGN.WAV', { vol: 0.6 }); flash(h, 'Rampa', 1, 'stunt'); if (h.i === 0) achCount('ramps', 10, 'rampero');
  }
  // half pipe (un solo lado, como un quarter pipe): una pared curva delante de ti que acaba en vertical, para salir disparado hacia arriba
  let pipeDef = null;
  function makePipe() {
    if (pipeDef) return pipeDef;
    const W = 8, lead = 1.5, Rr = 4.6, deck = 1.3, segs = 10, mb = new BRR.MeshBuilder(null), g = mb.group('COLOR'), tris = [];
    // perfil (d, y): d = distancia hacia delante desde la entrada
    const prof = [[0, 0.02], [lead, 0.02]]; for (let k = 1; k <= segs; k++) { const a = k / segs * Math.PI / 2; prof.push([lead + Math.sin(a) * Rr, 0.02 + (1 - Math.cos(a)) * Rr]); }
    prof.push([lead + Rr + deck, Rr + 0.02], [lead + Rr + deck, 0]);
    const L = lead + Rr + deck, Z = d => L / 2 - d;   // +z del modelo apunta hacia el coche
    const wood = k => k % 2 ? [0.62, 0.43, 0.24] : [0.7, 0.5, 0.29], edge = [0.85, 0.15, 0.1], sideC = [0.5, 0.34, 0.19];
    const tri = (a, b, c, col) => { tris.push([a, b, c]); for (const order of [[0, 1, 2], [0, 2, 1]]) for (const j of order) { g.pos.push(...[a, b, c][j]); g.col.push(...col); g.lay.push(0); } };
    for (let k = 0; k < prof.length - 1; k++) { const [d0, y0] = prof[k], [d1, y1] = prof[k + 1], col = k === prof.length - 3 ? edge : wood(k);
      for (let x = -W / 2; x < W / 2 - 1e-6; x += W / 4) { const a = [x, y0, Z(d0)], b = [x + W / 4, y0, Z(d0)], c = [x + W / 4, y1, Z(d1)], d = [x, y1, Z(d1)]; tri(a, b, c, col); tri(a, c, d, col); } }
    // laterales cerrados (abanico desde el pie de la pared vertical)
    for (const sx of [-W / 2, W / 2]) { const base = [sx, 0, Z(L)]; for (let k = 1; k < prof.length - 2; k++) { const [d0, y0] = prof[k], [d1, y1] = prof[k + 1]; tri(base, [sx, y0, Z(d0)], [sx, y1, Z(d1)], sideC); } }
    pipeDef = { up: R.upload(mb), tris, ax: [0, 0, 1], len: L }; return pipeDef;
  }
  function placePipe(h) {
    const D = makePipe(), c = h.car, f0 = c.forward(), f = V.norm([f0[0], 0, f0[2]]);
    const dist = Math.max(9, Math.min(28, 9 + Math.abs(c.speed()) * 0.45)) + D.len / 2, p = [c.p[0] + f[0] * dist, 0, c.p[2] + f[2] * dist];
    const n = [0, 1, 0]; p[1] = lvl.terrain(p[0], p[2], n);
    const fw = V.norm(V.sub(f, V.mul(n, V.dot(f, n)))), rt = V.norm(V.cross(fw, n));
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (let i = 0; i < 3; i++) { M[i][0] = rt[i]; M[i][1] = n[i]; M[i][2] = -fw[i]; }
    h.pipe = { R: M, p: [p[0], p[1] - 0.03, p[2]], up: D.up }; if (netRace && h.i === 0) BRR_net.game({ k: 'ramp', t: 'pipe', p: h.pipe.p, R: M });
    lvl.collider.setDyn('pipe' + h.i, D.tris.map(t => t.map(q => V.add(h.pipe.p, BRR.mv(M, q)))), 'RAMP');
    if (audio) audio.play('GEN/SIGN.WAV', { vol: 0.6 }); flash(h, 'Half pipe', 1, 'stunt'); if (h.i === 0) achCount('ramps', 10, 'rampero');
  }
  // rampas de los demás jugadores (online): se ven y se puede saltar con ellas
  const netRamps = new Map();
  async function placeNetRamp(id, kind, p, M) {
    if (!lvl || !freeMode) return; const D = kind === 'pipe' ? makePipe() : await loadRamp(); if (!D) return;
    netRamps.set(id + kind, { up: D.up, R: M, p }); lvl.collider.setDyn('net' + kind + id, D.tris.map(t => t.map(q => V.add(p, BRR.mv(M, q)))), 'RAMP');
  }
  // ---------- ambiente: hora del día y clima (bloque 3) ----------
  // 'original' deja la luz del circuito; el resto cambia sol, cielo, niebla y nubes. Los faros se encienden de noche, con niebla y con lluvia
  const HORAS = { original: 'Original', manana: 'Amanecer', dia: 'Mediodía', tarde: 'Atardecer', noche: 'Noche', azar: 'Al azar' };
  const CLIMAS = { despejado: 'Despejado', nublado: 'Nublado', niebla: 'Niebla', lluvia: 'Lluvia', nieve: 'Nieve', azar: 'Al azar' };
  function pickAtmos(level) {
    const env = BRR.envOf(level); let h = opt.hora || 'original', c = opt.clima || 'despejado';
    if (h === 'azar') h = ['manana', 'dia', 'tarde', 'noche', 'original'][Math.random() * 5 | 0];
    if (c === 'azar') c = env === 'MOON' ? 'despejado' : env === 'SNOW' ? ['despejado', 'nieve', 'niebla'][Math.random() * 3 | 0] : env === 'RUF' ? ['despejado', 'despejado', 'nublado'][Math.random() * 3 | 0] : ['despejado', 'nublado', 'niebla', 'lluvia'][Math.random() * 4 | 0];
    if (env === 'MOON') c = 'despejado';   // en Marte y Venus no llueve ni hay nubes
    return { h, c, env };
  }
  function makeAtmos(level, sun, sky) {
    const { h, c, env } = pickAtmos(level); if (h === 'original' && c === 'despejado') return { h, c, A: { cloudK: env === 'MOON' ? 0 : 0.22, cloudC: [0.97, 0.97, 0.99], sunCol: [1, 0.9, 0.7] } };
    const az = Math.atan2(sun[2], sun[0]), el = d => { const e = d * Math.PI / 180; return [Math.cos(az) * Math.cos(e), Math.sin(e), Math.sin(az) * Math.cos(e)]; };
    const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t), mul = (a, k) => a.map(x => x * k);
    let A = { cloudK: 0.22, cloudC: [0.97, 0.97, 0.99], sunCol: [1, 0.9, 0.7], fogK: 1, wet: 0, night: 0, lights: false };
    const base = { zen: sky.map(x => x * 0.78), hor: sky.map(x => Math.min(1, x * 0.85 + 0.2)), skyC: sky.map(x => 0.6 + x * 0.55), sunC: [1.05, 0.98, 0.88], gndC: [0.45, 0.4, 0.34] };
    Object.assign(A, base);
    if (h === 'manana') Object.assign(A, { L: el(11), zen: [0.36, 0.48, 0.7], hor: [0.98, 0.74, 0.56], skyC: [0.78, 0.7, 0.68], sunC: [1.18, 0.8, 0.52], sunCol: [1, 0.7, 0.42], cloudC: [1, 0.86, 0.78] });
    if (h === 'dia') Object.assign(A, { L: el(58), zen: [0.24, 0.45, 0.82], hor: [0.7, 0.8, 0.93], skyC: [0.76, 0.83, 0.96], sunC: [1.12, 1.04, 0.94] });
    if (h === 'tarde') Object.assign(A, { L: el(7).map((x, i) => i === 1 ? x : -x), zen: [0.3, 0.3, 0.52], hor: [1, 0.56, 0.36], skyC: [0.68, 0.52, 0.56], sunC: [1.25, 0.62, 0.34], sunCol: [1, 0.52, 0.28], cloudC: [1, 0.66, 0.55] });
    if (h === 'noche') Object.assign(A, { L: el(38), zen: [0.012, 0.02, 0.06], hor: [0.05, 0.065, 0.12], skyC: [0.15, 0.17, 0.27], sunC: [0.24, 0.28, 0.42], gndC: [0.05, 0.05, 0.07], sunCol: [0.6, 0.65, 0.8], cloudC: [0.12, 0.13, 0.18], night: 1, lights: true });
    const dark = h === 'noche' ? 0.35 : 1;
    if (c === 'nublado') Object.assign(A, { cloudK: 0.82, sunC: mul(A.sunC, 0.55), skyC: mix(A.skyC, [0.7, 0.72, 0.75].map(x => x * dark), 0.5), zen: mix(A.zen, [0.55, 0.58, 0.62].map(x => x * dark), 0.65), hor: mix(A.hor, [0.72, 0.74, 0.77].map(x => x * dark), 0.6), cloudC: mix(A.cloudC, [0.78, 0.8, 0.83].map(x => x * dark), 0.6) });
    if (c === 'niebla') { const g = [0.74, 0.76, 0.78].map(x => x * dark); Object.assign(A, { cloudK: 0, fogK: 11, sunC: mul(A.sunC, 0.6), hor: mix(A.hor, g, 0.92), zen: mix(A.zen, g, 0.85), skyC: mix(A.skyC, g, 0.5), lights: true }); }
    if (c === 'lluvia') Object.assign(A, { cloudK: 0.95, fogK: 2.4, wet: 0.7, sunC: mul(A.sunC, 0.42), skyC: mix(A.skyC, [0.55, 0.58, 0.62].map(x => x * dark), 0.6), zen: mix(A.zen, [0.4, 0.42, 0.46].map(x => x * dark), 0.75), hor: mix(A.hor, [0.56, 0.58, 0.62].map(x => x * dark), 0.7), cloudC: [0.5, 0.52, 0.56].map(x => x * dark), rain: 1, lights: true });
    if (c === 'nieve') Object.assign(A, { cloudK: 0.85, fogK: 2, sunC: mul(A.sunC, 0.55), skyC: mix(A.skyC, [0.8, 0.82, 0.86].map(x => x * dark), 0.6), zen: mix(A.zen, [0.7, 0.72, 0.76].map(x => x * dark), 0.7), hor: mix(A.hor, [0.84, 0.86, 0.9].map(x => x * dark), 0.7), cloudC: [0.82, 0.84, 0.88].map(x => x * dark), snow: 1 });
    if (env === 'MOON') A.cloudK = 0;
    return { h, c, A };
  }
  // faros de los coches cercanos a la cámara (para la luz) y su brillo
  function headlightsFrame(cam) {
    const A = R.atmos; if (!A || !A.lights || !R.mode) { R.headl = null; return; }
    const cars = [...humans.map(h => h.car), ...rivals.map(r => r.car)].filter(c => V.len(V.sub(c.p, cam)) < 90).sort((a, b) => V.len(V.sub(a.p, cam)) - V.len(V.sub(b.p, cam))).slice(0, 8), H = [];
    for (const c of cars) { const Rm = c.R, b = c.def.box, d = V.norm(BRR.mv(Rm, [0, -0.1, -1]));
      const lt = c.lightT || 0, gc = [[1, 0.95, 0.8], [0.82, 0.9, 1], [1, 0.96, 0.88], [1, 0.78, 0.32]][lt];   // color de las luces del garaje
      for (const sx of [-1, 1]) { const p = V.add(c.p, BRR.mv(Rm, [b.c[0] + sx * b.h[0] * 0.62, b.c[1], b.c[2] - b.h[2] * 0.98])); H.push({ p, d, k: 2.4, t: lt });
        if (fx) { fx.glow(p, [gc[0], gc[1], gc[2], 0.5], 0.42); fx.glow(p, [Math.min(1, gc[0] + 0.05), Math.min(1, gc[1] + 0.05), Math.min(1, gc[2] + 0.1), 0.8], 0.14); } } }
    R.headl = H;
  }
  // lluvia y nieve alrededor de la cámara
  function weatherFrame(cam, dt) { const A = R.atmos; if (!A || !fx || !R.mode) return; if (A.rain) fx.weather(cam, 'rain', dt, A.rain); if (A.snow) fx.weather(cam, 'snow', dt, A.snow); }
  // salto con carga: un toque = saltito; mantenido 2 s = más alto; 5 s = más alto todavía (salta al soltar)
  const JUMP_LV = [[0, 4.2, 'Saltito'], [0.7, 6.2, 'Salto'], [1.5, 8.4, 'Supersalto']];   // un toque · ~0,7 s · ~1,5 s
  function jumpCharge(h, down) {
    const now = performance.now() / 1000;
    if (down && !h.jumpPrev) h.jumpHold = now;
    if (down && h.jumpHold != null) { const held = now - h.jumpHold, lv = JUMP_LV.filter(l => held >= l[0]).pop();
      if (held > 0.35 && lv !== h.jumpLv) { h.jumpLv = lv; flash(h, lv[2] + (lv === JUMP_LV[2] ? ' ▮▮▮' : lv === JUMP_LV[1] ? ' ▮▮▯' : ' ▮▯▯'), 9, 'stunt'); if (audio) audio.play('SAMPLES/BEEP3.WAV', { vol: 0.25 }); } }
    if (!down && h.jumpPrev && h.jumpHold != null) { const held = now - h.jumpHold; h.jumpHold = null; h.jumpLv = null; h.msgT = Math.min(h.msgT, 0.3); carJump(h, JUMP_LV.filter(l => held >= l[0]).pop()[1]); }
  }
  function carJump(h, vy) {
    const c = h.car; if (c.K.fly) return; const now = performance.now();
    if (now - (h.jumpT || 0) < 600 || c.W.filter(w => w.contact).length < 2) return; h.jumpT = now;
    const up = BRR.mv(c.R, [0, 1, 0]), u = up[1] > 0.5 ? up : [0, 1, 0]; c.v = V.madd(c.v, u, vy); c.v[1] = Math.max(c.v[1], vy * 0.85);
    if (audio) audio.play('SAMPLES/BEEP4.WAV', { vol: 0.3 });
  }
  // ---------- daños (como el original): golpes y aterrizajes fuertes suman; humo al 80/90/95 % y al 100 % explota ----------
  function damageFrame(c, dt) {
    const r = rivals.find(q => q.car === c); if (r && (r.replay || r.remote)) return;
    const k = 100 / Math.max(30, c.def.tough || 100); c.dmg = c.dmg || 0;
    if (c.broken > 0) { c.broken -= dt; if (Math.random() < dt * 25) fx.puff(V.add(c.p, [0, 0.6, 0]), [0, 2.2, 0], [0.1, 0.1, 0.1, 0.5], 0.7, 2.5, 3, 1, 0.5);
      if (c.broken <= 0) { c.dmg = 0; const h = humans.find(q => q.car === c); if (h) recoverHuman(h); else c.v = V.mul(c.v, 0.2); } return; }
    // daño (v0.70): los roces y los toques de lado quitan poco pero algo (rozar una pared un rato, un 1-2 % por segundo);
    // un golpe a ~30 km/h ≈ 1 %, a ~70 km/h ≈ 4 %, a ~110 km/h ≈ 8 %; como mucho un 15 % por golpe
    const hit = c.lastHit || 0, tnow = performance.now(); c.dmgScr = c.dmgScr || 0;   // desde ~10 km/h ya se nota (≈0,4 %)
    if (hit > 1.2 && hit !== c.dmgHit && (hit > 4 || tnow - c.dmgScr > 200)) { c.dmg += Math.min(15, (0.25 + Math.pow(hit - 1.2, 1.3) * 0.1) * k); if (hit <= 4) c.dmgScr = tnow; } c.dmgHit = hit;   // roces: como mucho 5 veces por segundo
    if ((c.landEv || 0) > 14) c.dmg += Math.min(10, (c.landEv - 14) * 0.5 * k); c.landEv = 0;
    const R = c.R;
    for (const lv of [80, 90, 95]) if (c.dmg >= lv && Math.random() < dt * (lv === 80 ? 6 : lv === 90 ? 10 : 16)) { const q = c.def.dmgFx && c.def.dmgFx[lv] || [0, 0.4, 0];
      fx.puff(V.add(c.p, BRR.mv(R, q)), [c.v[0] * 0.5, 1.4, c.v[2] * 0.5], lv < 95 ? [0.55, 0.55, 0.58, 0.35] : [0.15, 0.15, 0.15, 0.5], 0.35, 1.8, 2.6, 1, 0.4); }
    if (c.dmg >= 100) {   // ¡bum!
      const q = c.def.dmgFx && c.def.dmgFx[100] || [0, 0.4, 0], p = V.add(c.p, BRR.mv(R, q)); fx.sparks(p, 40);
      for (let i = 0; i < 14; i++) { const a = Math.random() * 6.283; fx.puff(p, [Math.cos(a) * 4, 2 + Math.random() * 3, Math.sin(a) * 4], [1, 0.45 + Math.random() * 0.3, 0.1, 0.8], 0.6, 0.9, 3, 1, 0.5); }
      c.v = V.add(V.mul(c.v, 0.3), [0, 6, 0]); c.w = V.add(c.w, [(Math.random() - .5) * 4, 0, (Math.random() - .5) * 4]); c.broken = 2.6; c.dmg = 100; debris(c);
      if (audio && audio.ctx && camDist(c.p) < 120) audio.play('GEN/EXPLODE.WAV', { vol: c.isPlayer ? 1 : 0.7, pos: c.isPlayer ? null : c.p });
      if (c.isPlayer) { const h = humans.find(q => q.car === c); if (h) flash(h, '¡Vehículo destrozado!', 2.2, 'warn'); }
    }
  }
  function stuntFrame(h, dt) {
    const c = h.car, S = h.stunt || (h.stunt = { pts: 0, best: 0, air: 0, pitch: 0, roll: 0, yaw: 0, combo: 0 });
    if (h.race.phase !== 'race') return;
    const onG = c.W.some(w => w.contact), R = c.R, right = [R[0][0], R[1][0], R[2][0]], fwd = [R[0][2], R[1][2], R[2][2]], up = [R[0][1], R[1][1], R[2][1]];
    if (!onG) { S.air += dt; S.pitch += V.dot(c.w, right) * dt; S.roll += V.dot(c.w, fwd) * dt; S.yaw += V.dot(c.w, up) * dt; return; }
    if (S.air > 0.6) {
      const turns = a => Math.floor((Math.abs(a) + 0.6) / (2 * Math.PI)), flips = turns(S.pitch), rolls = turns(S.roll), spins = turns(S.yaw), upright = up[1] > 0.6;
      if (upright) {
        let pts = Math.round(S.air * 120) + flips * 600 + rolls * 500 + spins * 250; S.combo++; pts = Math.round(pts * (1 + Math.min(4, S.combo - 1) * 0.25));
        const what = [flips && (flips > 1 ? flips + ' mortales' : 'Mortal'), rolls && (rolls > 1 ? rolls + ' vueltas de campana' : 'Vuelta de campana'), spins && (spins > 1 ? spins + ' trompos en el aire' : 'Trompo en el aire')].filter(Boolean);
        S.pts += pts; flash(h, (what.length ? what.join(' + ') : 'Salto ' + S.air.toFixed(1) + ' s') + '  +' + pts + (S.combo > 1 ? '  ×' + S.combo : ''), 2, 'stunt');
        if (h.i === 0 && flips + rolls >= 1) achUnlock('vuelco');
        const k = 'brr_stunt_' + lvl.name, best = +(ST.get(k) || 0); if (S.pts > best && h.i === 0) { ST.set(k, String(S.pts)); S.rec = true; }
      } else { S.combo = 0; flash(h, '¡Aterrizaje fallido!', 1.5, 'stunt warn'); }
    } else if (S.air < 0.05 && Math.abs(c.speed()) < 2) S.combo = 0;
    S.air = 0; S.pitch = S.roll = S.yaw = 0;
  }
  // ayudas de conducción (principiantes): corrige un poco la dirección hacia la trazada, frena antes de las curvas y
  // recoloca solo si te quedas atascado o fuera de la pista
  function assist(h, inp, dt, lv) {
    const c = h.car, md = BRR.aiMode(c); if (c.K.fly) return;
    let line = (lvl.aiLines || {})[md]; if (!line) { if (h.asBuilding) return; h.asBuilding = true; setTimeout(() => { try { BRR.buildAILine(lvl, h.race, md); } catch (e) { } }, 0); return; }
    const pj = BRR.aiProject(line, c.p, h.asLi); if (pj.d > 900) { h.asLi = null; return; } h.asLi = pj.i;
    const v = Math.max(0, c.speed()), s = pj.i * line.step, tg = BRR.aiAt(line, s + 7 + v * 0.5), d = V.sub(tg.p, c.p), fw = c.forward();
    const err = Math.atan2(fw[0] * d[2] - fw[2] * d[0], fw[0] * d[0] + fw[2] * d[2]), want = Math.max(-1, Math.min(1, err * 2.2));
    const k = (lv === 1 ? 0.3 : 0.6) * (1 - Math.min(1, Math.abs(inp.steer) * 1.5));   // si el jugador gira fuerte, manda él
    inp.steer += (want - inp.steer) * k;
    if (!h.asProf || h.asProf.line !== line) h.asProf = { line, v: BRR.aiProfile(line, c, { pace: 1.05, corner: lv === 1 ? 1.25 : 1.12 }) };
    const i0 = Math.floor(s / line.step); let vp = 1e9; for (let q = 0; q < 6; q++) vp = Math.min(vp, h.asProf.v[(i0 + q) % line.N]);
    if (v > vp + (lv === 1 ? 5 : 3)) { inp.throttle = Math.min(inp.throttle, 0.3); inp.brake = Math.max(inp.brake, Math.min(lv === 1 ? 0.4 : 0.7, (v - vp - 2) / 8)); inp.nitro = false; }
    // atascado o volcado: recolocar
    h.asStuck = (v < 1.5 && inp.throttle > 0.5) || c.R[1][1] < 0.2 ? (h.asStuck || 0) + dt : 0;
    if (h.asStuck > (lv === 1 ? 4 : 2.5)) { h.asStuck = 0; recoverHuman(h); }
  }
  function recoverHuman(h) {
    const g = h.race.lastGate, c = h.car;
    if (!g) { const s = lvl.start; c.reset(s.x, s.z, s.yaw); }
    else { const f = V.mul(g.az, g.fwdSign || 1); c.reset(g.c[0] + f[0] * 4, g.c[2] + f[2] * 4, Math.atan2(-f[0], -f[2]), g.c[1] + 1); }
    h.race.prev = c.p.slice(); h.cam.init = false;
  }
  // ======================= online =======================
  // Cada jugador simula su coche y manda su estado 20 veces por segundo; el anfitrión además simula y manda los rivales de la IA.
  // Los coches de los demás son "marionetas": se colocan suavemente donde dice la red (con extrapolación por su velocidad).
  let netWaitT = 0, netLastStart = null, specT = 0;
  const specList = () => rivals.filter(r => !r.gone && !r.car.out);
  function specCamera(dt) { const L = specList(); if (!L.length) return; const r = L[((specT % L.length) + L.length) % L.length], h = humans[0];
    updateCamera({ i: 1, car: r.car, cam: h.cam, camMode: h.specCam || 'tv', inp: {}, race: h.race }, dt); }
  function specUI() { const L = specList(), r = L[((specT % Math.max(1, L.length)) + L.length) % Math.max(1, L.length)]; $('sp_name').textContent = r ? (r.name && !r.isAI ? r.name : r.car.teamName || 'IA') : '–'; $('sp_cam').textContent = '🎥 ' + (CAM_N[humans[0] && humans[0].specCam || 'tv'] || ''); }
  (function specSetup() {
    const bar = document.createElement('div'); bar.id = 'specbar'; bar.hidden = true;
    bar.innerHTML = `<b>👀 ESPECTADOR</b><button id="sp_prev">◀</button><span id="sp_name"></span><button id="sp_next">▶</button><button id="sp_cam"></button><button id="sp_exit">✕ Salir</button>`;
    document.body.appendChild(bar); const q = id => bar.querySelector('#' + id), CY = ['tv', 'cerca', 'lejos', 'alta', 'cenital'];
    q('sp_prev').onclick = () => { specT--; humans[0].cam.init = false; specUI(); }; q('sp_next').onclick = () => { specT++; humans[0].cam.init = false; specUI(); };
    q('sp_cam').onclick = () => { const h = humans[0]; h.specCam = CY[(CY.indexOf(h.specCam || 'tv') + 1) % CY.length]; h.cam.init = false; specUI(); };
    q('sp_exit').onclick = () => { $('specbar').hidden = true; $('phuds').style.visibility = ''; toMenu(); };
    addEventListener('keydown', e => { if (!netRace || netRace.role !== 'spec' || state !== 'race') return; if (e.code === 'ArrowRight' || e.code === 'ArrowUp') q('sp_next').onclick(); else if (e.code === 'ArrowLeft' || e.code === 'ArrowDown') q('sp_prev').onclick(); else if (e.code === 'KeyC') q('sp_cam').onclick(); }, true);
  })();
  function specLeave() { netRace = null; netWait = false; $('specbar').hidden = true; $('phuds').style.visibility = ''; state = 'menu'; }
  const R3 = a => a.map(x => Math.round(x * 1000) / 1000);
  function netFrame(dt) {
    netT += dt; if (netT < 0.05) return; netT = 0;
    const h = humans[0], c = h.car;
    if (netRace.role === 'spec') return;   // espectador: no tiene coche en la carrera
    BRR_net.game({ k: 's', p: R3(c.p), q: R3(c.q), v: R3(c.v), st: +c.steerAng.toFixed(3), n: c.nitroT > 0 ? 1 : 0, sc: +h.race.score().toFixed(3), f: h.race.finishT, lap: h.race.lap });
    if (netRace.role === 'host') {
      const ai = rivals.filter(r => r.ai);
      if (ai.length) BRR_net.game({ k: 'ai', a: ai.map(r => ({ id: r.id, p: R3(r.car.p), q: R3(r.car.q), v: R3(r.car.v), st: +r.car.steerAng.toFixed(3), sc: +r.race.score().toFixed(3), f: r.race.finishT })) });
      if (netWait) { netWaitT += 0.05; const need = netRace.order.filter(e => !e.ai).map(e => e.id);
        if (need.every(id => netLoaded.has(id)) || netWaitT > 30) { BRR_net.game({ k: 'go' }); netGo(); } }
    }
  }
  function netGo() { netWait = false; netWaitT = 0; for (const h of humans) h.race.reset(); for (const r of rivals) { r.race.reset(); if (r.ai) r.ai.reset(); } $('netbar').hidden = true; last = performance.now(); }
  // coches de los demás: se dibujan 0,12 s "en el pasado" interpolando entre los dos últimos estados recibidos (movimiento suave
  // aunque la red tenga tirones); si falta información, se extrapola con su velocidad un máximo de 0,3 s
  const NET_DELAY = 0.12;
  function netPush(e, d, now) { const b = e.buf || (e.buf = []); b.push({ ...d, time: now }); while (b.length > 8) b.shift(); e.tgt = b[b.length - 1]; }
  function puppets(dt) {
    const now = performance.now() / 1000, rt = now - NET_DELAY;
    for (const r of rivals) { if (!r.remote || !r.buf || !r.buf.length) continue; const B = r.buf, c = r.car;
      let a = null, b = null; for (let i = B.length - 1; i > 0; i--) if (B[i - 1].time <= rt && B[i].time >= rt) { a = B[i - 1]; b = B[i]; break; }
      let tp, q, v, st, n;
      if (a && b) { const u = (rt - a.time) / Math.max(1e-3, b.time - a.time); tp = a.p.map((x, i) => x + (b.p[i] - x) * u);
        let qb = b.q; if (a.q[0] * qb[0] + a.q[1] * qb[1] + a.q[2] * qb[2] + a.q[3] * qb[3] < 0) qb = qb.map(x => -x);
        q = a.q.map((x, i) => x + (qb[i] - x) * u); v = a.v.map((x, i) => x + (b.v[i] - x) * u); st = (a.st || 0) + ((b.st || 0) - (a.st || 0)) * u; n = b.n; }
      else { const L = B[B.length - 1], age = Math.max(0, Math.min(0.3, rt - L.time)); tp = [L.p[0] + L.v[0] * age, L.p[1] + L.v[1] * age, L.p[2] + L.v[2] * age]; q = L.q; v = L.v; st = L.st || 0; n = L.n; }
      const k = Math.min(1, dt * 20);
      if (V.len(V.sub(tp, c.p)) > 15) c.p = tp; else c.p = V.add(c.p, V.mul(V.sub(tp, c.p), k));
      if (c.q[0] * q[0] + c.q[1] * q[1] + c.q[2] * q[2] + c.q[3] * q[3] < 0) q = q.map(x => -x);
      const nq = c.q.map((x, i) => x + (q[i] - x) * k), l = Math.hypot(...nq) || 1; c.q = nq.map(x => x / l);
      c.v = v; c.steerAng = st; if (n && !(c.nitroT > 0)) nitroFx(c); c.nitroT = n ? 0.1 : 0;
      const sp = V.dot(c.v, c.forward()); for (const w of c.W) { w.spin += sp / (w.radius || 0.3) * dt; w.len = 0.3; }
    }
  }
  const netEnt = id => rivals.find(r => r.id === id);
  BRR_net.on('g', m => {
    const d = m.d || {};
    if (d.k === 'rtc') { rtcSignal(m.from, d); return; }
    if (d.k === 'ramp' && Array.isArray(d.p) && Array.isArray(d.R) && d.p.length === 3 && d.R.length === 3) { placeNetRamp(m.from, d.t === 'pipe' ? 'pipe' : 'ramp', d.p.map(Number), d.R.map(r => r.map(Number))); return; }
    if (d.k === 'hn') { const e = rivals.find(r => r.id === m.from); if (!e || !audio || !audio.ctx || typeof d.t !== 'string' || d.t === 'propia' || !BRR.HORNS.some(x => x.id === d.t)) return; const info = BRR.hornInfo(d.t);
      if (d.on) { if (e.hornH) e.hornH.stop(); e.hornH = audio.horn(1, 0.7, null, d.t, e.car.p); } else if (e.hornH && info.hold) { e.hornH.stop(); e.hornH = null; } return; }
    if (d.k === 'trkreq' && typeof d.id === 'string' && BRR.editor) { (async () => { const t = await BRR.editor.get(d.id.slice(0, 40)); if (!t) return; const s2 = await BRR.editor.pack(t), CH = 12000, n = Math.ceil(s2.length / CH);
        for (let i = 0; i < n; i++) { BRR_net.game({ k: 'trkd', id: d.id, i, n, d: s2.slice(i * CH, (i + 1) * CH) }, m.from); await new Promise(r => setTimeout(r, 30)); } })(); return; }
    if (d.k === 'trkd' && typeof d.id === 'string' && trkWant.has(d.id)) { const w = trkWant.get(d.id); if (!(d.n > 0 && d.n < 400 && d.i >= 0 && d.i < d.n && typeof d.d === 'string')) return; w.parts[d.i] = d.d; w.n = d.n;
      if (w.parts.filter(x => x != null).length === d.n) { const sj = w.parts.join(''); trkWant.delete(d.id); BRR.editor.unpack(sj).then(async t => { if (t.id !== d.id) t.id = d.id; await BRR.editor.saveDownload(t, false); w.ok(true); }, () => w.ok(false)); } return; }
    if (d.k === 'start') { if (netRace && netRace.role === 'spec' && !d.spec) specLeave(); if (!netRace && state !== 'race') netStart(d); return; }
    if (d.k === 'spec') { if (BRR_net.isHost && netRace && netLastStart && state === 'race') BRR_net.game({ ...netLastStart, spec: 1 }, m.from); return; }
    if (!netRace) return;
    const now = performance.now() / 1000;
    if (d.k === 'loaded') netLoaded.add(m.from);
    else if (d.k === 'go') { if (netRace.role !== 'host') netGo(); }
    else if (d.k === 's') { const e = netEnt(m.from); if (e) { netPush(e, d, now); e.sc = d.sc; e.fin = d.f; } }
    else if (d.k === 'cz' || d.k === 'czh') crazyNetMsg(m.from, d);
    else if (d.k === 'kt' || d.k === 'ktx') kartNet(m.from, d);
    else if (d.k === 'ai') { for (const a of d.a || []) { const e = netEnt(a.id); if (e && e.remote) { netPush(e, a, now); e.sc = a.sc; e.fin = a.f; } } }
  });
  BRR_net.on('closed', m => { if (netRace && state === 'race') { netRace.lost = true; $('netbar').hidden = false; $('netbar').textContent = m.why || 'Partida cerrada'; } netRenderRoom(); });
  BRR_net.on('disconnect', () => { $('n_status').textContent = 'Desconectado (se reintentará al volver a Online).'; $('n_room').hidden = true; if (netRace && state === 'race') { $('netbar').hidden = false; $('netbar').textContent = 'Conexión perdida con el servidor'; } });
  // circuito propio en una partida online: si no lo tienes, se lo pide al anfitrión (y si no, a la nube) antes de empezar
  const trkWant = new Map();
  async function ensureTrack(level) {
    if (!String(level || '').includes('~') || !BRR.editor) return true; if (await BRR.editor.byLevel(level)) return true;
    const id = level.split('~')[1]; if (trkWant.has(id)) return trkWant.get(id).p;
    const w = { parts: [], n: 0 }; w.p = new Promise(ok => { w.ok = ok; }); trkWant.set(id, w);
    const host = (BRR_net.members || []).find(x => x.host); if (host && host.id !== BRR_net.id) BRR_net.game({ k: 'trkreq', id }, host.id);
    const res = await Promise.race([w.p, new Promise(r => setTimeout(() => r(null), 20000))]);
    if (res) return true; trkWant.delete(id);
    try { await BRR.editor.download(id, false); return true; } catch (e) { return false; }
  }
  async function netStart(d) {
    if (String(d.level || '').includes('~')) { $('netbar').hidden = false; $('netbar').textContent = 'Descargando el circuito…'; const ok = await ensureTrack(d.level); if (!ok) { $('netbar').textContent = 'No se ha podido descargar el circuito de esta partida'; return; } }
    const me = BRR_net.id; let e = d.order.find(x => x.id === me); if (!e && !d.spec) return;
    if (!e) e = { veh: (d.order.find(x => !x.ai) || d.order[0] || {}).veh || 'JEEP', team: 1 };   // espectador: un coche invisible para la cámara
    clearTimeout(netResT); $('results').hidden = true; netRace = null;
    tourMode = false; fromOrig = false; opt.diff = d.diff || 2; freeMode = !!d.free; ttMode = false;
    if (orig && orig.on) orig.close();
    startRace(d.level, e.veh, e.team, d.laps || 0, 1, { role: d.spec ? 'spec' : BRR_net.isHost ? 'host' : 'client', myId: me, order: d.order, crazy: typeof d.crazy === 'string' && CRAZY_NAME[d.crazy] ? d.crazy : null });
  }
  // ---------- lobby online ----------
  function netTracks() { return front ? front.tracks : []; }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const myLogo = () => myLogoData() || (typeof opt.logo === 'number' ? opt.logo : null);
  const myData = () => ({ gar: garMine($('n_veh').value || opt.vehicle), team: +$('n_team').value, veh: $('n_veh').value, ready: $('n_ready').checked, logo: myLogo(), char: opt.char || 0, head: myHead(), body: myBody(), paint: opt.paint || null, teamName: myTeamName() || null });
  const tById = id => netTracks().find(x => x.id === id);
  const tLabel = id => { const t = tById(id); return t ? (t.place || t.id) + ' · ' + t.id : id || '?'; };
  $('n_url').value = opt.netUrl && /^wss?:/.test(opt.netUrl) ? opt.netUrl : '';
  let listT = null;
  // ---------- red local (LAN): mismas salas que el online, a través del servidor que lleva el programa de escritorio ----------
  let lanT = 0;
  function lanUI(on) { $('l_home').hidden = !on; $('n_home').hidden = on || !!BRR_net.room; if (on && !BRR_net.lanUrl) $('n_home').hidden = true; }
  async function lanConnect(url) {
    $('l_status').textContent = 'Conectando…'; if (BRR_net.room) BRR_net.leave();
    try { BRR_net.use('server'); await BRR_net.connect(url, opt.netName || 'Piloto'); BRR_net.lanUrl = url; $('l_status').textContent = 'Conectado a ' + url; $('n_home').hidden = false; $('n_status').textContent = 'Red local: ' + url; BRR_net.list(); return true; }
    catch (e) { $('l_status').textContent = e.message; return false; }
  }
  async function lanEnter() {
    $('n_team').value = opt.team || 1; lanUI(true); $('l_host').hidden = !(NAT && NAT.lanHost);
    if (!(NAT && NAT.lanList)) $('l_list').innerHTML = 'Desde el navegador no se pueden buscar partidas de la red: abre el juego con el programa de Windows o Linux, o escribe abajo la dirección del ordenador que la crea.';
    clearInterval(lanT); const scan = async () => { if (view !== 'lan' || state !== 'menu') return clearInterval(lanT); if (!(NAT && NAT.lanList)) return;
      const L = await NAT.lanList().catch(() => []);
      $('l_list').innerHTML = L.length ? L.map((s, i) => `<div class="rrow"><span><b>${esc(s.name)}</b> · ${esc(s.ip)}${s.rooms.length ? ' · ' + s.rooms.map(r => esc(r.name) + ' (' + (r.players | 0) + '/' + (r.max | 0) + ')').join(', ') : ' · <span>sin partidas aún</span>'}</span><button data-i="${i}">Ver</button></div>`).join('') : 'Buscando… (no hay ninguna todavía)';
      for (const b of $('l_list').querySelectorAll('button')) b.onclick = () => { const s = L[+b.dataset.i]; lanConnect('ws://' + s.ip + ':' + s.port); }; };
    scan(); lanT = setInterval(scan, 2000);
    netRenderRoom();
  }
  $('l_host').onclick = async () => { $('l_host').disabled = true; try { const r = await NAT.lanHost(); if (await lanConnect('ws://127.0.0.1:' + r.port)) { $('l_status').textContent = 'Tu partida se ve en la red como ' + (r.ips.map(ip => 'ws://' + ip + ':' + r.port).join(' · ') || 'este PC'); $('n_newbtn').onclick(); } } finally { $('l_host').disabled = false; } };
  $('l_conn').onclick = () => { const u = $('l_url').value.trim(); if (/^wss?:\/\//.test(u)) lanConnect(u); else $('l_status').textContent = 'La dirección empieza por ws:// (ej. ws://192.168.1.20:7777)'; };
  async function onlineEnter() {
    lanUI(false); if (BRR_net.lanUrl) { if (BRR_net.room) BRR_net.leave(); try { BRR_net.srv.close(); } catch (e) { } BRR_net.lanUrl = null; BRR_net.use(opt.netUrl && /^wss?:/.test(opt.netUrl) ? 'server' : 'p2p'); }
    $('n_team').value = opt.team || 1;
    if (!BRR_net.connected) { $('n_status').textContent = 'Conectando…';
      try { await BRR_net.connect(opt.netUrl && /^wss?:/.test(opt.netUrl) ? opt.netUrl : null, opt.netName || 'Piloto'); $('n_status').textContent = BRR_net.mode === 'server' ? 'Conectado al servidor ' + opt.netUrl : 'Conectado. Tu nombre: ' + (opt.netName || 'Piloto'); }
      catch (e) { $('n_status').textContent = e.message; } }
    BRR_net.list(); clearInterval(listT); listT = setInterval(() => { if ((view === 'online' || view === 'lan') && state === 'menu') BRR_net.list(); else clearInterval(listT); }, 4000);
    netRenderRoom();
  }
  $('n_conn').onclick = async () => { opt.netUrl = $('n_url').value.trim(); save(); if (BRR_net.room) BRR_net.leave(); BRR_net.use(/^wss?:/.test(opt.netUrl) ? 'server' : 'p2p');
    $('n_status').textContent = 'Conectando…'; try { await BRR_net.connect(opt.netUrl || null, opt.netName || 'Piloto'); $('n_status').textContent = 'Conectado' + (opt.netUrl ? ' a ' + opt.netUrl : '') + '.'; BRR_net.list(); } catch (e) { $('n_status').textContent = e.message; } };
  $('n_refresh').onclick = () => BRR_net.list();
  // lista de partidas públicas: circuito, modo (y modo extra), jugadores y señal (ida y vuelta hasta el anfitrión)
  const roomPing = new Map();
  const sigHTML = ms => { if (ms == null) return '<span class="sig" title="Midiendo señal…">📶 …</span>'; const n = ms < 120 ? 4 : ms < 250 ? 3 : ms < 500 ? 2 : 1;
    return `<span class="sig s${n}" title="Señal: ${ms} ms">${'▮'.repeat(n)}${'▯'.repeat(4 - n)} ${ms} ms</span>`; };
  BRR_net.on('pong', m => { if (!m.id) return; roomPing.set(m.id, { ms: m.ms, at: Date.now() }); const el = document.querySelector(`#n_list [data-sig="${CSS.escape(m.id)}"]`); if (el) el.innerHTML = sigHTML(m.ms); });
  BRR_net.on('list', m => {
    const L = m.rooms || [];
    for (const r of L) { const q = roomPing.get(r.id); if (!q || Date.now() - q.at > 8000) BRR_net.ping(r.id); }
    const modeOf = info => { const cz = info.crazy && info.crazy !== 'normal' && CRAZY_NAME[info.crazy]; return '<span>' + (MODE_N[info.mode] || '') + '</span>' + (cz ? ' · <b>' + cz + '</b>' : ''); };
    $('n_list').innerHTML = L.length ? L.map(r => `<div class="rrow"><span><b>${esc(r.name)}</b> · ${esc(r.host)} · ${esc(tLabel((r.info || {}).level))}<br><small>🎮 ${modeOf(r.info || {})} · 👥 ${r.players}/${r.max} <span>jugadores</span>${r.pass ? ' · 🔒' : ''}${r.state === 'racing' ? ' · <span>en carrera</span>' : ''} · <span data-sig="${esc(r.id)}">${sigHTML((roomPing.get(r.id) || {}).ms)}</span></small></span><button data-id="${r.id}" data-pass="${r.pass ? 1 : ''}">Unirse</button></div>`).join('') : 'No hay partidas públicas ahora mismo. ¡Crea una!';
    for (const b of $('n_list').querySelectorAll('button')) b.onclick = () => { $('n_code').value = b.dataset.id; if (b.dataset.pass && !$('n_pass').value) { $('n_pass').focus(); $('n_status').textContent = 'Esa partida tiene contraseña: escríbela y pulsa Unirse.'; return; } $('n_join').onclick(); };
  });
  $('n_join').onclick = async () => { const id = $('n_code').value.trim().toUpperCase(); if (!id) return; if (!BRR_net.connected) await onlineEnter(); $('n_status').textContent = 'Conectando con la partida ' + id + '…'; BRR_net.join(id, $('n_pass').value, myData()); };
  BRR_net.on('error', m => { $('n_status').textContent = m.msg; });
  // ---------- crear partida ----------
  const MODE_N = { single: 'Una carrera', list: 'Lista de carreras', champ: 'Campeonato', rotate: 'Circuito al azar', vote: 'Votación', free: 'Modo libre' };
  let newMaps = [];
  $('n_newbtn').onclick = () => { $('n_home').hidden = true; $('n_new').hidden = false; $('n_rname').value = (opt.netName || 'Piloto') + ' - partida'; newMaps = [opt.level || (netTracks()[0] || {}).id].filter(Boolean);
    $('n_series').innerHTML = (front && front.series || []).map((se, i) => `<option value="${i}">Serie ${i + 1}: ${se.use.map(id => (tById(id) || {}).place || id).join(', ')}</option>`).join('');
    newModeUI(); navFocusFirst($('n_new')); };
  $('n_cancel').onclick = () => { $('n_new').hidden = true; $('n_home').hidden = false; };
  function newModeUI() { const m = $('n_mode').value;
    $('n_mapsrow').hidden = m === 'rotate' || m === 'champ'; $('n_seriesrow').hidden = m !== 'champ'; $('n_laps').parentElement.hidden = $('n_ai').parentElement.hidden = $('n_crazy').parentElement.hidden = m === 'free';
    if (m !== 'list' && newMaps.length > 1) newMaps = newMaps.slice(0, 1);
    $('n_mapshint').textContent = m === 'list' ? '(en orden; puedes elegir varios)' : m === 'vote' ? '(la primera carrera; luego se vota)' : '';
    $('n_maps').innerHTML = newMaps.map((id, i) => `${m === 'list' ? (i + 1) + '. ' : ''}${esc(tLabel(id))}`).join('<br>') || '—'; }
  $('n_mode').onchange = newModeUI;
  $('n_pickmaps').onclick = async () => { const r = await pickMaps({ multi: $('n_mode').value === 'list', sel: newMaps }); if (r && r.length) { newMaps = r; newModeUI(); } };
  $('n_create').onclick = async () => {
    if (!BRR_net.connected) await onlineEnter();   // sin conexión con el buscador también se puede jugar (solo con la máquina)
    BRR_net.use(BRR_net.mode === 'server' && BRR_net.connected ? 'server' : 'p2p');
    const mode = $('n_mode').value, T = netTracks(); let maps = newMaps.slice();
    if (mode === 'champ') maps = ((front.series || [])[+$('n_series').value] || { use: [] }).use.filter(id => tById(id));
    if (mode === 'rotate') maps = [T[Math.random() * T.length | 0].id];
    if (!maps.length) maps = [T[0].id];
    const info = { mode, maps, idx: 0, level: maps[0], laps: +$('n_laps').value, crazy: $('n_crazy').value, ai: +$('n_ai').value, diff: +$('n_diff').value, pts: {}, names: {}, race: 1 };
    BRR_net.create({ name: $('n_rname').value.trim() || (opt.netName || 'Piloto') + ' - partida', pub: $('n_pub').value === '1', pass: $('n_rpass').value, max: +$('n_max').value, info, data: myData() });
    $('n_new').hidden = true; $('n_home').hidden = false;
  };
  // ---------- selector de circuitos (tarjetas originales); multi = varios en orden ----------
  function pickMaps({ multi = false, sel = [], title } = {}) {
    return new Promise(ok => {
      let S = sel.slice(); $('pk_title').textContent = title || (multi ? 'Elige los circuitos (en el orden en que se correrán)' : 'Elige circuito');
      const draw = () => { $('pk_grid').innerHTML = netTracks().map(t => card(t, S.includes(t.id) ? `<div class="num">${multi ? S.indexOf(t.id) + 1 : '✓'}</div>` : '')).join('');
        for (const c of $('pk_grid').querySelectorAll('.tcard')) { c.tabIndex = 0; c.classList.toggle('on', S.includes(c.dataset.id)); c.onclick = () => { sfx('BEEP3'); const id = c.dataset.id;
          if (multi) S = S.includes(id) ? S.filter(x => x !== id) : [...S, id]; else S = [id]; draw(); const n = $('pk_grid').querySelector(`.tcard[data-id="${id}"]`); if (n) navFocus(n); if (!multi) { /* un clic basta */ } }; } };
      draw(); $('picker').hidden = false; setTimeout(() => navFocusFirst($('picker')), 0);
      const end = r => { $('picker').hidden = true; sfx(r ? 'BEEP4' : 'BEEP2'); ok(r); };
      $('pk_ok').onclick = () => end(S); $('pk_cancel').onclick = () => end(null); pickerClose = () => end(null);
    });
  }
  let pickerClose = null;
  // ---------- editor de circuitos (no en Android): probar el circuito con tu coche y los rivales, y al salir se vuelve al editor ----------
  let edTrack = null, edBack = false; if (/Android/i.test(navigator.userAgent)) document.documentElement.classList.add('android');   // el editor no está en el móvil
  if (BRR.editor) BRR.editor.init({ files: () => files,
    play: async T => { if (!files) return; edTrack = T; edBack = true; BRR.editor.close(); if (audio) { audio.init(); audio.stopMusic(); } ttMode = false; freeMode = false; tourMode = false;
      const veh = files.has(opt.vehicle + '.VHC') && !/^(FEHELI|HELI|COPTER|INFLATE|HOVCAR)$/.test(opt.vehicle) ? opt.vehicle : 'JEEP'; await startRace(BRR.editor.levelOf(T), veh, opt.team || 1, T.laps || 3, 1); }, author: () => opt.netName || 'Piloto', close: () => customRefresh() });
  // ---------- circuitos propios y de la comunidad: en las listas de carrera (rápida, contrarreloj, online) y la ventana para descargarlos ----------
  async function customRefresh() {
    if (!front || !BRR.editor) return; let A = []; try { A = await BRR.editor.active(); } catch (e) { }
    front.tracks = front.tracks.filter(t => !t.custom);
    for (const r of A) { const t = await BRR.editor.get(r.id); if (!t || !t.road || t.road.length < 3) continue; const b = front.tracks.find(x => x.id === t.base) || {};
      front.tracks.push({ id: BRR.editor.levelOf(t), custom: true, place: t.name, view: BRR.editor.preview(t.road, t.base), diff: 1, laps: t.laps, cars: b.cars || ['JEEP'], planet: 0,
        desc: (r.mine ? 'Tu circuito' : 'Circuito de ' + (t.author || 'la comunidad')) + ' · ' + (LEVEL_NAMES[BRR.envOf(t.base)] || t.base) }); }
    const ls = $('m_level'); [...ls.querySelectorAll('.cust')].forEach(o => o.remove());
    const C = front.tracks.filter(t => t.custom); if (C.length) { const g = document.createElement('optgroup'); g.className = 'cust'; g.label = 'Circuitos propios y de la comunidad'; for (const t of C) { const o = document.createElement('option'); o.value = t.id; o.textContent = t.place; g.appendChild(o); } ls.appendChild(g); }
    const cur = $('m_level').value;
    $('tracks').innerHTML = front.tracks.map(t => card(t, t.custom ? '<span class="cbadge">' + (t.desc.startsWith('Tu') ? '🛠' : '🌐') + '</span>' : '')).join('');
    for (const c of document.querySelectorAll('#tracks .tcard')) { c.tabIndex = 0; c.onclick = () => { menuBeep(); selectTrack(c.dataset.id, true); }; }
    if (front.tracks.some(t => t.id === cur)) selectTrack(cur, false); else if (front.tracks.some(t => t.id === opt.level)) selectTrack(opt.level, false);
  }
  let cmTab = 'com', cmCache = null;
  function cmOpen(tab) { cmCache = null; $('comm').hidden = false; cmTab = tab || cmTab; cmRender(); setTimeout(() => navFocusFirst($('comm')), 0); }
  async function cmPlay(level) { await customRefresh(); $('comm').hidden = true; go('quick'); setTimeout(() => selectTrack(level, false), 60); }
  async function cmRender() {
    for (const b of document.querySelectorAll('#comm [data-ct]')) b.classList.toggle('on', b.dataset.ct === cmTab);
    const el = $('cm_body'), ED = BRR.editor, theme = b => LEVEL_NAMES[BRR.envOf(b)] || b, row = (img, title, sub, btns, id) => `<div class="cmrow" data-id="${esc(id)}"><img src="${img}" alt=""><div class="cminfo"><b data-notr>${esc(title)}</b><span class="small">${sub}</span></div><div class="rplb">${btns}</div></div>`;
    $('cm_search').hidden = cmTab !== 'com';
    if (cmTab === 'com') {
      el.innerHTML = '<p class="small">Buscando circuitos…</p>'; let R = cmCache; if (!R || Date.now() - R.at > 60000) { try { R = await BRR.cloud.trackList(); R.at = Date.now(); cmCache = R; } catch (e) { R = { rows: [], online: false }; } }
      if (cmTab !== 'com') return; const dl = new Set((await ED.downloads()).map(x => x.id)), mine = new Set((await ED.listTracks()).map(x => x.id)), q = $('cm_search').value.trim().toLowerCase();
      const rows = R.rows.filter(r => !q || (r.name + ' ' + r.author).toLowerCase().includes(q));
      el.innerHTML = !R.online && !rows.length ? '<p class="small">No se puede conectar con la nube de circuitos (¿sin Internet?).</p>' : !rows.length ? '<p class="small">Todavía no hay circuitos publicados. ¡Publica el primero desde el editor!</p>' :
        rows.map(r => row(ED.preview((r.path || []).map(p => [p[0], p[1]]), r.base), r.name, `de ${esc(r.author || '?')} · ${esc(theme(r.base))} · ${r.len || '?'} m · ${new Date(r.t).toLocaleDateString()}`,
          mine.has(r.id) ? '<span class="small">Tuyo</span>' : dl.has(r.id) ? '<button data-a="play" class="main">▶ Correr</button><button data-a="get" title="Volver a descargar">⟳</button>' : '<button data-a="get" class="main">⬇ Descargar</button>', r.id)).join('');
    } else if (cmTab === 'dl') {
      const L = await ED.downloads(); el.innerHTML = !L.length ? '<p class="small">No has descargado ninguno. Mira en «Comunidad».</p>' : (await Promise.all(L.map(async r => { const t = await ED.get(r.id); return t ? row(ED.preview(t.road, t.base), r.name, `de ${esc(r.author || '?')} · ${esc(theme(r.base))} · ${r.len || '?'} m`,
        `<label class="small"><input type="checkbox" data-a="on" ${r.on ? 'checked' : ''}> En las listas</label><button data-a="play" class="main">▶</button><button data-a="del" title="Borrar">🗑</button>`, r.id) : ''; }))).join('');
    } else {
      const L = await ED.listTracks(); el.innerHTML = !L.length ? '<p class="small">Aún no has hecho ninguno. Ábrelo con «Abrir el editor».</p>' : (await Promise.all(L.map(async r => { const t = await ED.get(r.id); return t ? row(ED.preview(t.road, t.base), r.name, `${esc(theme(r.base))} · ${r.len || '?'} m${t.pub ? ' · 🌐 publicado' + (t.pub.rev < t.rev - 1 ? ' (hay cambios sin publicar)' : '') : ''}`,
        `<label class="small"><input type="checkbox" data-a="mon" ${r.off ? '' : 'checked'}> En las listas</label><button data-a="play" class="main">▶</button><button data-a="edit" title="Editar">✏️</button><button data-a="pub">${t.pub ? '🌐 Actualizar' : '🌐 Publicar'}</button>${t.pub ? '<button data-a="unpub" title="Retirar de la comunidad">Retirar</button>' : ''}`, r.id) : ''; }))).join('');
    }
    for (const b of el.querySelectorAll('[data-a]')) { const id = b.closest('.cmrow').dataset.id, a = b.dataset.a, ev = b.tagName === 'INPUT' ? 'onchange' : 'onclick';
      b[ev] = async () => { try {
        if (a === 'get') { b.disabled = true; b.textContent = 'Descargando…'; await ED.download(id, true); await customRefresh(); cmRender(); }
        else if (a === 'play') { const t = await ED.get(id); if (!t) return; if (t.src === 'com') await ED.setDownloadOn(id, true); else await ED.setMineOn(id, true); cmPlay(ED.levelOf(t)); }
        else if (a === 'on') { await ED.setDownloadOn(id, b.checked); customRefresh(); }
        else if (a === 'mon') { await ED.setMineOn(id, b.checked); customRefresh(); }
        else if (a === 'del') { if (b.dataset.sure) { await ED.delDownload(id); await customRefresh(); cmRender(); } else { b.dataset.sure = 1; b.textContent = '¿Borrar?'; } }
        else if (a === 'edit') { const t = await ED.get(id); $('comm').hidden = true; BRR.editor.open(t); }
        else if (a === 'pub') { const t = await ED.get(id); b.disabled = true; b.textContent = 'Publicando…'; await ED.publish(t, opt.netName || 'Piloto'); cmCache = null; cmRender(); }
        else if (a === 'unpub') { const t = await ED.get(id); b.disabled = true; await ED.unpublish(t); cmCache = null; cmRender(); }
      } catch (e) { b.disabled = false; b.textContent = '✗ ' + (e.message || e); } }; }
  }
  (function cmSetup() {
    for (const b of document.querySelectorAll('#comm [data-ct]')) b.onclick = () => { cmTab = b.dataset.ct; cmRender(); };
    $('cm_close').onclick = () => { $('comm').hidden = true; }; $('comm').onclick = e => { if (e.target.id === 'comm') $('comm').hidden = true; };
    $('cm_editor').onclick = () => { $('comm').hidden = true; BRR.editor && BRR.editor.open(); };
    let st = 0; $('cm_search').oninput = () => { clearTimeout(st); st = setTimeout(cmRender, 250); }; $('cm_search').addEventListener('keydown', e => e.stopPropagation());
  })();
  // ---------- amigos: código de amigo (tu id), lista guardada, quién está conectado y en qué sala, invitaciones ----------
  const frCode = id => String(id || '').toUpperCase().replace(/^(.{4})(.+)$/, '$1-$2');
  const frId = c => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  let frPres = {}, frStarted = false, frT = 0;
  function frList() { return Array.isArray(opt.friends) ? opt.friends : (opt.friends = []); }
  function frMyRoom() { const r = BRR_net.room; return r && BRR_net.mode === 'p2p' && !BRR_net.lanUrl ? r : null; }
  function frStatus() { const r = frMyRoom(); return { n: opt.netName || 'Piloto', st: state === 'race' || state === 'results' || state === 'replay' ? 'carrera' : 'menu', lv: state === 'race' && lvl ? lvl.name : null, room: r ? r.id : null, rn: r ? String(r.name || '').slice(0, 30) : null, rp: r ? r.players : null, rm: r ? r.max : null, ver: BRR.VERSION || '' }; }
  function frStart() {   // solo si usas amigos: tu estado cada minuto y tu buzón abierto
    if (frStarted || !BRR.cloud || !BRR.cloud.inbox) return; frStarted = true; opt.friendsUsed = 1; save();
    BRR.cloud.inbox(frMsg);
    const pub = () => { if (opt.friendsShow !== false && document.visibilityState !== 'hidden') BRR.cloud.presence(frStatus()).catch(() => { }); };
    pub(); setInterval(pub, 60000); BRR_net.on('room', () => { clearTimeout(frT); frT = setTimeout(pub, 1500); });
    addEventListener('pagehide', () => { if (opt.friendsShow !== false) BRR.cloud.presence({ n: opt.netName || 'Piloto', off: 1 }).catch(() => { }); });
  }
  function frToast(html, btns) {
    let el = $('ftoast'); if (!el) { el = document.createElement('div'); el.id = 'ftoast'; document.body.appendChild(el); }
    const d = document.createElement('div'); d.className = 'ft'; d.innerHTML = html + '<div class="ftb"></div>'; for (const [t, f] of btns) { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { d.remove(); f && f(); }; d.querySelector('.ftb').appendChild(b); }
    el.appendChild(d); setTimeout(() => d.remove(), 30000); if (audio && audio.ctx) audio.play('SAMPLES/BEEP2.WAV', { vol: 0.4, bus: 'ui' });
  }
  async function frJoin(code, pass) {
    if (state !== 'menu') return; $('friends').hidden = true; if (orig && orig.on) { try { orig.h.modern(); } catch (e) { } } go('online');
    if (BRR_net.room && BRR_net.room.id === code) return; if (BRR_net.room) BRR_net.leave(); $('n_code').value = code; $('n_pass').value = pass || ''; try { await $('n_join').onclick(); } catch (e) { }
  }
  function frMsg(m) {
    const name = esc(String(m.n || 'Piloto').slice(0, 24)), known = frList().find(f => f.id === m.from);
    if (m.k === 'inv' && /^[A-Z0-9]{3,12}$/.test(m.room || '')) frToast(`👫 <b>${name}</b> te invita a su partida${m.rn ? ' «' + esc(String(m.rn).slice(0, 30)) + '»' : ''}`, [['Unirse', () => frJoin(m.room, typeof m.pw === 'string' ? m.pw.slice(0, 40) : '')], ['Ahora no']]);
    else if (m.k === 'add' && !known) frToast(`👫 <b>${name}</b> te ha añadido como amigo (${frCode(m.from)})`, [['Añadir también', () => { frList().push({ id: m.from, name: String(m.n || 'Piloto').slice(0, 24) }); save(); frRender(); }], ['Ignorar']]);
    else if (m.k === 'add' && known) { known.name = String(m.n || known.name).slice(0, 24); save(); }
  }
  const ago = t => { const s2 = (Date.now() - t) / 1000; return s2 < 3600 ? 'hace ' + Math.max(1, Math.round(s2 / 60)) + ' min' : s2 < 86400 ? 'hace ' + Math.round(s2 / 3600) + ' h' : 'hace ' + Math.round(s2 / 86400) + ' días'; };
  async function frRefresh() { const L = frList(); if (!L.length || !BRR.cloud) return; try { frPres = { ...frPres, ...(await BRR.cloud.presenceGet(L.map(f => f.id))) }; } catch (e) { } frRender(); }
  function frRender() {
    $('fr_code').textContent = frCode(BRR.cloud ? BRR.cloud.id : '—'); $('fr_show').checked = opt.friendsShow !== false;
    const L = frList(), mine = frMyRoom();
    if (!L.length) { $('fr_list').innerHTML = '<p class="small">Aún no tienes amigos añadidos. Pásales tu código o pídeles el suyo.</p>'; return; }
    const row = f => { const p = frPres[f.id], on = p && !p.off && Date.now() - p.t < 150000; if (p && p.n) f.name = String(p.n).slice(0, 24);
      const st = !p ? 'Sin datos todavía' : !on ? 'Desconectado · ' + ago(p.t) : p.room ? 'En la sala «' + esc(p.rn || p.room) + '»' + (p.rp ? ' (' + p.rp + '/' + p.rm + ')' : '') : p.st === 'carrera' ? 'Corriendo' + (p.lv ? ' en ' + esc(p.lv) : '') : 'En el menú';
      return `<div class="frow" data-id="${esc(f.id)}"><span class="fdot ${on ? 'on' : ''}"></span><div class="fmain"><b>${esc(f.name || 'Piloto')}</b> <span class="small">${frCode(f.id)}</span><br><span class="small">${st}</span></div><div class="rplb">
        ${on && p.room && (!mine || mine.id !== p.room) ? '<button class="main" data-a="join">Unirse</button>' : ''}${on && mine && p.room !== mine.id ? '<button data-a="inv">Invitar</button>' : ''}<button data-a="del" title="Quitar">🗑</button></div></div>`; };
    const sorted = L.slice().sort((a, b) => { const on = f => { const p = frPres[f.id]; return p && !p.off && Date.now() - p.t < 150000 ? 1 : 0; }; return on(b) - on(a) || String(a.name).localeCompare(String(b.name)); });
    $('fr_list').innerHTML = sorted.map(row).join('');
    for (const b of $('fr_list').querySelectorAll('button')) b.onclick = async () => { const id = b.closest('.frow').dataset.id, a = b.dataset.a, p = frPres[id];
      if (a === 'join' && p) frJoin(p.room);
      else if (a === 'inv') { const r = frMyRoom(); if (!r) return; await BRR.cloud.send(id, { k: 'inv', n: opt.netName || 'Piloto', room: r.id, rn: r.name, pw: BRR_net.isHost && BRR_net.p2p && BRR_net.p2p.host ? BRR_net.p2p.host.pass || '' : '' }); b.textContent = '✓ Invitado'; b.disabled = true; }
      else if (a === 'del') { if (b.dataset.sure) { opt.friends = frList().filter(f => f.id !== id); save(); frRender(); } else { b.dataset.sure = 1; b.textContent = '¿Quitar?'; } } };
  }
  function frOpen() { frStart(); $('friends').hidden = false; frRender(); frRefresh(); clearInterval(frOpen.t); frOpen.t = setInterval(() => { if ($('friends').hidden) clearInterval(frOpen.t); else frRefresh(); }, 15000); setTimeout(() => navFocusFirst($('friends')), 0); }
  (function frSetup() {
    $('fr_close').onclick = () => { $('friends').hidden = true; }; $('friends').onclick = e => { if (e.target.id === 'friends') $('friends').hidden = true; };
    $('fr_copy').onclick = async () => { try { await navigator.clipboard.writeText(frCode(BRR.cloud.id)); $('fr_copy').textContent = '✓ Copiado'; } catch (e) { } };
    $('fr_show').onchange = () => { opt.friendsShow = $('fr_show').checked; save(); if (!opt.friendsShow && BRR.cloud) BRR.cloud.presence({ n: opt.netName || 'Piloto', off: 1 }).catch(() => { }); };
    const add = async () => { const id = frId($('fr_add').value), msg = $('fr_msg');
      if (!/^[a-z0-9]{6,12}$/.test(id)) { msg.textContent = 'Ese código no es válido (son 8 letras y números, como ' + frCode(BRR.cloud.id) + ').'; return; }
      if (BRR.cloud && id === BRR.cloud.id) { msg.textContent = 'Ese es tu propio código.'; return; }
      if (frList().some(f => f.id === id)) { msg.textContent = 'Ya lo tienes en la lista.'; return; }
      frList().push({ id, name: 'Piloto' }); save(); $('fr_add').value = ''; msg.textContent = 'Añadido. Le avisamos para que te añada también.'; frRender();
      try { await BRR.cloud.send(id, { k: 'add', n: opt.netName || 'Piloto' }); } catch (e) { } frRefresh(); };
    $('fr_addb').onclick = add; $('fr_add').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') add(); });
    if (opt.friendsUsed && frList().length) setTimeout(frStart, 4000);   // si ya usas amigos: conectado desde el principio para recibir invitaciones
  })();
  // ---------- sala ----------
  $('n_change').onclick = async () => { const r = BRR_net.room; if (!r || !BRR_net.isHost) return; const info = { ...r.info };
    const sel = await pickMaps({ multi: info.mode === 'list', sel: info.mode === 'list' ? info.maps : [info.level] }); if (!sel || !sel.length) return;
    if (info.mode === 'list') { info.maps = sel; info.idx = 0; info.level = sel[0]; } else { info.level = sel[0]; info.maps = [sel[0]]; } info.vote = null; info.autoAt = null; BRR_net.info(info); };
  const sendChat = () => { const t = $('n_msg').value.trim(); if (!t) return; BRR_net.chat(t); $('n_msg').value = ''; };
  $('n_send').onclick = sendChat;
  $('n_msg').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } e.stopPropagation(); });
  // ---------- red: avisos de reconexión y cambio de anfitrión; silenciar y expulsar ----------
  const muted = new Set();
  BRR_net.on('netstate', m => { $('n_status').textContent = m.msg; if (state === 'race' || state === 'results') { $('netbar').hidden = false; $('netbar').textContent = m.msg; if (m.ok) setTimeout(() => { if ($('netbar').textContent === m.msg) $('netbar').hidden = true; }, 3000); }
    if (m.ok && micStream) for (const x of BRR_net.members) if (x.id !== BRR_net.id && !peers.has(x.id) && !muted.has(x.id)) rtcCall(x.id); });
  BRR_net.on('becamehost', ev => {
    if (netRace && ev && ev.prevMembers) { const keep = new Set(ev.prevMembers.map(x => x.id)); for (const r of rivals) if (!r.isAI && r.id && !keep.has(r.id)) { r.buf = null; r.car.p = [0, -500, 0]; r.car.v = [0, 0, 0]; r.gone = true; } }
    $('netbar').hidden = false; $('netbar').textContent = 'Ahora eres el anfitrión de la partida'; setTimeout(() => { $('netbar').hidden = true; }, 4000);
    if (netRace) { netRace.role = 'host'; const skill = [0, 0.86, 0.95, 1.0, 1.06][opt.diff] || 0.95;
      // los rivales de la máquina los llevaba el anfitrión anterior: ahora los conduce este ordenador
      rivals.forEach((r, k) => { if (r.isAI && r.remote) { r.remote = false; r.buf = null; r.car.puppet = false;
        // su "carrera" era la de una marioneta: se crea una de verdad con los controles que ya llevaba pasados
        const pr = r.race, rr = new BRR.Race(lvl, pr.laps || lvl.laps), done = Math.max(0, Math.floor(pr.score ? pr.score() : 0)), N = rr.maxNum + 1, e0 = rr.expected;
        rr.phase = 'race'; rr.cd = 0; rr.t = humans[0] ? humans[0].race.t : 0; rr.passed = done; rr.expected = (e0 + done) % N; rr.lap = Math.floor((done + (e0 === 0 ? N : e0) - 1) / N); rr.lapStart = rr.t; rr.armed = true; r.race = rr;
        r.ai = new BRR.AIDriver(r.car, r.race, skill, [-0.4, 0.4, 0, -0.2, 0.2][k % 5], ['experto', 'agresivo', 'imprevisible', 'prudente', 'torpe'][k % 5]); r.race.phase = 'race'; } }); }
    if (micStream) setTimeout(() => { for (const x of BRR_net.members) if (x.id !== BRR_net.id && !peers.has(x.id)) rtcCall(x.id); }, 3000);
    netRenderRoom();
  });
  BRR_net.on('left', m => { if (!m || !m.id || !netRace) return; const r = rivals.find(x => x.id === m.id && !x.isAI); if (r) { r.buf = null; r.car.p = [0, -500, 0]; r.car.v = [0, 0, 0]; } });
  BRR_net.on('chat', m => { if (m.id && muted.has(m.id)) return; const c = $('n_chat'); c.insertAdjacentHTML('beforeend', `<div><b>${esc(m.from)}:</b> ${esc(m.text)}</div>`); c.scrollTop = c.scrollHeight; if (audio && view === 'online') audio.play('SAMPLES/BEEP3.WAV', { vol: 0.3 }); });
  $('n_leave').onclick = () => { BRR_net.leave(); $('n_room').hidden = true; $('n_chat').innerHTML = ''; BRR_net.list(); };
  BRR_net.on('room', () => netRenderRoom());
  BRR_net.on('left', () => netRenderRoom());
  BRR_net.on('closed', m => { $('n_status').textContent = m.why || 'La partida se ha cerrado.'; netRenderRoom(); });
  let lastLevel = null, lastFree = false;
  function netRenderRoom() {
    { const lv = BRR_net.room && BRR_net.room.info && BRR_net.room.info.level; if (lv && String(lv).includes('~') && !BRR_net.isHost) ensureTrack(lv); }   // circuito propio del anfitrión: se descarga ya en la sala
    const r = BRR_net.room; $('n_room').hidden = !r; $('pane_online').classList.toggle('inroom', !!r); if (!r) return;
    if (r.state === 'racing' && !netRace && !BRR_net.isHost) $('n_modeinfo').textContent = 'Hay una carrera en curso: entrarás en la siguiente.';
    $('n_spec').hidden = !(r.state === 'racing' && !netRace && !BRR_net.isHost);
    const host = BRR_net.isHost, info = r.info || {}, T = netTracks();
    if (!T.length) { setTimeout(netRenderRoom, 500); return; }
    $('n_rtitle').textContent = r.name; $('n_rcode').textContent = r.players + '/' + r.max + ' jugadores · ' + (host ? 'eres el anfitrión 👑' : 'anfitrión: ' + r.host) + ' · ' + (MODE_N[info.mode] || 'Una carrera');
    $('n_codebox').innerHTML = `<span class="small">Código para tus amigos:</span><br><span class="code">${esc(r.id)}</span> <button id="n_copy">Copiar</button>`;
    $('n_copy').onclick = () => { try { navigator.clipboard.writeText(r.id); $('n_copy').textContent = '¡Copiado!'; } catch (e) { } };
    if (BRR_net.mode === 'p2p') {   // enlace de invitación: abre el juego en el navegador y entra directo en esta sala
      const b = document.createElement('button'); b.id = 'n_invite'; b.textContent = 'Copiar invitación'; b.style.marginLeft = '6px'; $('n_codebox').appendChild(b);
      b.onclick = () => { const url = 'https://bigredreport.github.io/bigredreport/juego/BigRedRacing.html?sala=' + encodeURIComponent(r.id);
        try { if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) navigator.share({ title: 'Big Red Report', text: '¡Échate una carrera conmigo!', url }); else navigator.clipboard.writeText('¡Échate una carrera conmigo en Big Red Report! ' + url); b.textContent = '¡Enlace copiado!'; } catch (e) { } }; }
    const pts = info.pts || {};
    $('n_members').innerHTML = BRR_net.members.map(m => `<div class="mrow">${headImg(m.data.team || 1, 24)}<b>${esc(m.name)}</b>${m.host ? ' 👑' : ''}${m.lost ? ' <span class="small" style="color:#ffd23f">reconectando…</span>' : ''} <span class="small">${VEH_NAMES[m.data.veh] || m.data.veh || ''}</span>${pts[m.id] ? ` <span class="small">${pts[m.id]} pts</span>` : ''} <span style="margin-left:auto">${m.data.ready || m.host ? '✅' : '⏳'}</span>${m.id !== BRR_net.id ? `<button class="mbtn" data-mute="${m.id}" title="No ver sus mensajes ni oír su voz">${muted.has(m.id) ? '🔇' : '🔈'}</button>${host ? `<button class="mbtn" data-kick="${m.id}" title="Expulsar de la partida">✖</button>` : ''}` : ''}</div>`).join('');
    for (const b of $('n_members').querySelectorAll('[data-mute]')) b.onclick = () => { const id = b.dataset.mute; if (muted.has(id)) muted.delete(id); else { muted.add(id); rtcClose(id); } netRenderRoom(); };
    for (const b of $('n_members').querySelectorAll('[data-kick]')) b.onclick = () => { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '¿Seguro?'; return; } BRR_net.kick(b.dataset.kick); };
    const lv = info.level || T[0].id, t = tById(lv);
    if (front && front.world && t) { if (!globeN) { globeN = new BRR.Globe($('n_globe'), front.world); globeN.marks = globeD ? globeD.marks : []; }   // bola del mundo del circuito elegido
      const pl = t.planet > 0 && front.planets && front.planets[t.planet]; globeN.map = pl || front.world; globeN.noMarks = !!pl; if (pl) { globeN.sel = null; globeN.focus(globeN.lon + 60, 15); } else { globeN.sel = globeN.marks.find(m => m.id === t.id); globeN.focus(t.lon, t.lat); } globeN.drawn = false; globeN.start(); }
    $('n_timg').src = (t && t.view) || ''; $('n_tname').textContent = tLabel(lv); $('n_levelinfo').textContent = t ? (t.desc || '') : '';
    const n = (info.maps || []).length;
    $('n_modeinfo').textContent = (info.mode === 'list' || info.mode === 'champ') ? `Carrera ${Math.min(n, (info.idx || 0) + 1)} de ${n}` + (info.done ? ' · ¡terminado! (la siguiente empieza de nuevo)' : '') : info.mode === 'rotate' ? 'Tras cada carrera, otro circuito al azar' : info.mode === 'vote' ? 'Tras cada carrera se vota el siguiente circuito' : '';
    if (info.autoAt && !info.vote) $('n_modeinfo').textContent += ` · siguiente carrera en ${Math.max(0, Math.ceil((info.autoAt - Date.now()) / 1000))} s`;
    if (info.crazy && info.crazy !== 'normal' && CRAZY_NAME[info.crazy]) { const rest = $('n_modeinfo').textContent; $('n_modeinfo').innerHTML = '<b>' + esc(CRAZY_NAME[info.crazy]) + '</b>' + (rest ? ' · <span>' + esc(rest) + '</span>' : ''); }
    $('n_change').hidden = true; const tr = document.querySelector('#n_room .ntrack'); tr.classList.toggle('pick', host); tr.title = host ? 'Pulsa para elegir circuito' : '';
    tr.onclick = host ? () => $('n_change').onclick() : null; tr.tabIndex = host ? 0 : -1;
    if (host) $('n_tname').textContent += '  ✎';
    // votación
    const vt = info.vote; $('n_vote').hidden = !vt;
    if (vt) { const cnt = {}; for (const k in vt.votes || {}) cnt[vt.votes[k]] = (cnt[vt.votes[k]] || 0) + 1; const mine = (vt.votes || {})[BRR_net.id];
      $('n_vote').innerHTML = `<label class="row">Vota el siguiente circuito · quedan ${Math.max(0, Math.ceil((vt.until - Date.now()) / 1000))} s</label>` + vt.opts.map(id => { const tt = tById(id) || { id };
        return `<button class="vopt${mine === id ? ' main' : ''}" data-v="${id}"><img src="${tt.view || ''}"><span>${esc(tLabel(id))}</span><b style="margin-left:auto">${cnt[id] || 0} 🗳</b></button>`; }).join('');
      for (const b of $('n_vote').querySelectorAll('[data-v]')) b.onclick = () => { sfx('BEEP4'); if (host) netVote(BRR_net.id, b.dataset.v); else BRR_net.game({ k: 'vote', map: b.dataset.v }); }; }
    // clasificación de la partida
    const ranks = Object.entries(pts).sort((a, b) => b[1] - a[1]);
    $('n_stand').innerHTML = ranks.length ? '<label class="row">Clasificación</label>' + ranks.map(([id, p], i) => `<div style="display:flex;justify-content:space-between"><span>${i + 1}. ${esc((info.names || {})[id] || id)}</span><b>${p}</b></div>`).join('') : '';
    const freeR = info.mode === 'free';
    if (lv !== lastLevel || !$('n_veh').options.length || freeR !== lastFree) { lastLevel = lv; lastFree = freeR; const own = (t && t.cars && t.cars.length) ? t.cars : ['JEEP'], cars = freeR ? own.concat(BRR.VEHICLES.filter(n => files.has(n + '.VHC') && !own.includes(n))) : own, keep = $('n_veh').value;
      $('n_veh').innerHTML = cars.map(v => `<option value="${v}">${VEH_NAMES[v] || v}</option>`).join(''); if (cars.includes(keep)) $('n_veh').value = keep; BRR_net.data(myData()); }
    vpickLoad();
    $('n_start').hidden = !host; $('n_start').textContent = BRR_net.members.length === 1 ? ((info.ai | 0) ? 'Empezar (tú y ' + info.ai + ' de la máquina)' : 'Empezar tú solo') : BRR_net.members.every(m => m.data.ready || m.host) ? 'Empezar carrera' : 'Empezar (no todos están listos)';
    if (!BRR_net.connected && host) $('n_rcode').textContent += ' · sin conexión con el buscador: nadie más puede entrar';
  }
  for (const id of ['n_veh', 'n_team', 'n_ready']) $(id).onchange = () => { BRR_net.data(myData()); if (id !== 'n_ready') vpickLoad(); };
  // selector de vehículo con el coche girando en 3D (como en el menú original, en pequeño)
  let vpThumb = null, vpKey = '', vpA = 0, vpRun = false;
  async function vpickLoad() {
    const v = $('n_veh').value, lv = (BRR_net.room && BRR_net.room.info && BRR_net.room.info.level) || opt.level, key = v + '_' + $('n_team').value + '_' + lv + (opt.paint || '');
    $('n_vname').textContent = VEH_NAMES[v] || v || ''; if (!v || key === vpKey || !orig) return; vpKey = key;
    try { vpThumb = await orig.h.carThumb(v, +$('n_team').value, lv, opt.paint); } catch (e) { vpThumb = null; }
    if (!vpRun) { vpRun = true; const step = () => { if ((view !== 'online' && view !== 'lan') || state !== 'menu' || $('n_room').hidden) { vpRun = false; return; }
        if (vpThumb) { const cv = $('n_vcv'), g = cv.getContext('2d'), im = vpThumb.frame(vpA += 0.025); g.clearRect(0, 0, cv.width, cv.height); const sz = Math.min(cv.width, cv.height * 1.25); g.drawImage(im, (cv.width - sz) / 2, (cv.height - sz) / 2 - 5, sz, sz); }
        setTimeout(() => requestAnimationFrame(step), 40); }; step(); }
  }
  const vpStep = d => { const o = [...$('n_veh').options]; if (o.length < 2) return; const i = (o.findIndex(x => x.value === $('n_veh').value) + d + o.length) % o.length; $('n_veh').value = o[i].value; sfx('BEEP3'); $('n_veh').onchange(); };
  $('n_vprev').onclick = () => vpStep(-1); $('n_vnext').onclick = () => vpStep(1);
  function netVote(id, map) { const r = BRR_net.room; if (!r || !BRR_net.isHost || !r.info.vote) return; const info = { ...r.info, vote: { ...r.info.vote, votes: { ...r.info.vote.votes, [id]: map } } };
    if (BRR_net.members.every(m => info.vote.votes[m.id])) info.vote.until = Math.min(info.vote.until, Date.now() + 1500); BRR_net.info(info); }
  // el anfitrión: votaciones, cuenta atrás y salida automática entre carreras
  setInterval(() => {
    const r = BRR_net.room; if (!r) return; if ((view === 'online' || view === 'lan') && state === 'menu') netRenderRoom();
    if (!BRR_net.isHost || r.state !== 'lobby') return; const info = r.info || {}, now = Date.now();
    if (info.vote && now > info.vote.until) { const cnt = {}; for (const k in info.vote.votes) cnt[info.vote.votes[k]] = (cnt[info.vote.votes[k]] || 0) + 1;
      const best = info.vote.opts.slice().sort((a, b) => (cnt[b] || 0) - (cnt[a] || 0) || Math.random() - .5)[0]; BRR_net.info({ ...info, level: best, vote: null, autoAt: now + 8000 }); return; }
    if (info.autoAt && now > info.autoAt && state === 'menu') { BRR_net.info({ ...info, autoAt: null }); netLaunch(); }
  }, 500);
  // al volver de una carrera (anfitrión): puntos y siguiente circuito según el modo
  function netAfterRace(ids) {
    const r = BRR_net.room; if (!r || !BRR_net.isHost) return; const info = { ...r.info }, T = netTracks(), P = [10, 6, 4, 3, 2, 1];
    info.pts = info.done ? {} : { ...(info.pts || {}) }; info.names = { ...(info.names || {}) }; info.done = false;
    (ids || []).forEach((e, i) => { info.pts[e.id] = (info.pts[e.id] || 0) + (P[i] || 0); info.names[e.id] = e.name; });
    if (info.mode === 'list' || info.mode === 'champ') { info.idx = (info.idx || 0) + 1; if (info.idx >= info.maps.length) { info.idx = 0; info.done = true; } info.level = info.maps[info.idx]; }
    else if (info.mode === 'rotate') { const o = T.filter(t => t.id !== info.level); info.level = o[Math.random() * o.length | 0].id; }
    else if (info.mode === 'vote') { const o = T.filter(t => t.id !== info.level).sort(() => Math.random() - .5).slice(0, 3).map(t => t.id); info.vote = { opts: o, votes: {}, until: Date.now() + 20000 }; }
    info.autoAt = info.mode === 'single' ? null : info.mode === 'vote' ? null : Date.now() + 12000; info.race = (info.race || 1) + 1;
    BRR_net.info(info, 'lobby');
  }
  function netLaunch() {
    const r = BRR_net.room; if (!r || !BRR_net.isHost) return; const info = r.info || {};
    const players = BRR_net.members.map(m => ({ id: m.id, name: m.name, team: m.data.team || 1, veh: m.data.veh, logo: m.data.logo || null, char: m.data.char || 0, paint: m.data.paint || null, gar: m.data.gar || null }));
    const t = tById(info.level), cars = (t && t.cars && t.cars.length) ? t.cars : ['JEEP'];
    const freeR = info.mode === 'free'; for (const p of players) if (!freeR && !cars.includes(p.veh) || !p.veh) p.veh = cars[0];
    const used = new Set(players.map(p => p.team)), free = [1, 2, 3, 4, 5, 6].filter(x => !used.has(x)), prof = ['experto', 'agresivo', 'imprevisible', 'prudente', 'torpe'];
    const aiLooks = opt.rivLook !== 'clasico' ? rivalLooks(12, players.map(e => hueOf(e.paint || TEAM[e.team || 1].c))) : [];
    const ais = Array.from({ length: freeR ? 0 : Math.min(info.ai || 0, 12 - players.length) }, (_, k) => ({ id: 'ai' + k, ai: true, name: 'IA ' + (k + 1), team: free[k % Math.max(1, free.length)] || (k % 6) + 1, veh: cars[k % cars.length], profile: prof[k % 5], ...(aiLooks[k] || {}) }));
    const cz = !freeR && info.crazy && info.crazy !== 'normal' ? info.crazy : null;
    const d = { k: 'start', level: info.level, laps: freeR || (cz && cz !== 'kart') ? 99 : info.laps || 0, diff: info.diff || 2, free: freeR ? 1 : 0, crazy: cz, order: [...ais, ...players.reverse()] };
    netLastStart = d; BRR_net.info(info, 'racing'); BRR_net.game(d); netStart(d);
  }
  $('n_start').onclick = netLaunch;
  BRR_net.on('room', () => { if (netRace && netRace.role === 'spec' && BRR_net.room && BRR_net.room.state === 'lobby' && state === 'race') { $('specbar').hidden = true; $('phuds').style.visibility = ''; toMenu(); } });
  $('n_spec').onclick = () => { $('n_spec').textContent = 'Conectando…'; BRR_net.game({ k: 'spec' }); setTimeout(() => { $('n_spec').textContent = '👀 Ver la carrera en curso'; }, 5000); };
  BRR_net.on('g', m => { const d = m.d || {}; if (d.k === 'vote' && BRR_net.isHost) netVote(m.from, d.map); });

  // ---------- chat de voz (WebRTC entre los jugadores de la sala; el servidor solo pasa los mensajes de conexión) ----------
  let micStream = null; const peers = new Map();
  const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
  function rtcPeer(id) {
    let P = peers.get(id); if (P) return P;
    const pc = new RTCPeerConnection(ICE); P = { pc, audio: null }; peers.set(id, P);
    if (micStream) for (const t of micStream.getTracks()) pc.addTrack(t, micStream);
    pc.onicecandidate = e => { if (e.candidate) BRR_net.game({ k: 'rtc', ice: e.candidate }, id); };
    pc.ontrack = e => { if (!P.audio) { P.audio = new Audio(); P.audio.autoplay = true; } P.audio.srcObject = e.streams[0]; P.audio.play().catch(() => { }); };
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) rtcClose(id); };
    return P;
  }
  function rtcClose(id) { const P = peers.get(id); if (!P) return; try { P.pc.close(); } catch (e) { } if (P.audio) P.audio.srcObject = null; peers.delete(id); }
  async function rtcCall(id) { rtcClose(id); const P = rtcPeer(id); const o = await P.pc.createOffer({ offerToReceiveAudio: true }); await P.pc.setLocalDescription(o); BRR_net.game({ k: 'rtc', sdp: P.pc.localDescription }, id); }
  async function rtcSignal(from, d) {
    if (muted.has(from)) return;
    try {
      if (d.sdp && d.sdp.type === 'offer') { rtcClose(from); const P = rtcPeer(from); await P.pc.setRemoteDescription(d.sdp); const a = await P.pc.createAnswer(); await P.pc.setLocalDescription(a); BRR_net.game({ k: 'rtc', sdp: P.pc.localDescription }, from); }
      else if (d.sdp && d.sdp.type === 'answer') { const P = peers.get(from); if (P) await P.pc.setRemoteDescription(d.sdp); }
      else if (d.ice) { const P = peers.get(from); if (P) await P.pc.addIceCandidate(d.ice).catch(() => { }); }
      else if (d.hello && micStream) rtcCall(from);   // alguien nuevo con micro: le llamo para que también me oiga
    } catch (e) { console.warn('voz', e); }
  }
  $('n_mic').onclick = async () => {
    if (micStream) { for (const t of micStream.getTracks()) t.stop(); micStream = null; for (const id of [...peers.keys()]) rtcClose(id); $('n_mic').textContent = '🎤 Micro: no'; return; }
    try { micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { alert('No se puede usar el micrófono: ' + e.message); return; }
    $('n_mic').textContent = '🎤 Micro: SÍ';
    for (const m of BRR_net.members) if (m.id !== BRR_net.id) rtcCall(m.id);
    BRR_net.game({ k: 'rtc', hello: 1 });
  };
  BRR_net.on('left', m => { if (m && m.id) rtcClose(m.id); });
  BRR_net.on('lb', m => { if (m.level === $('m_level').value && (m.rows || []).length) { lbOnline = (lbOnline && lbOnline.level === m.level ? lbOnline : []).concat(m.rows); lbOnline.level = m.level; drawLB(); } });
  BRR_net.on('closed', () => { for (const id of [...peers.keys()]) rtcClose(id); });
  // ---------- cámara (sin temblor: muelle crítico + rumbo suavizado) ----------
  function updateCamera(h, dt) {
    const cam = h.cam, car = h.car;
    if (window.BRR_CAMOVR && h.i === 0) { const o = window.BRR_CAMOVR(car); cam.pos = o.pos; cam.look = o.look; cam.up = [0, 1, 0]; return; }
    const Rm = car.R, fwd = BRR.mv(Rm, [0, 0, -1]), li = h.inp || {};
    const tY = (li.lookX || 0) * Math.PI, tP = -(li.lookY || 0) * 0.6, k = 1 - Math.exp(-dt * ((li.lookX || li.lookY) ? 7 : 4));
    cam.lookYaw += (tY - cam.lookYaw) * k; cam.lookPitch += (tP - cam.lookPitch) * k;
    const mode = h.camMode || opt.cam;
    if (mode === 'capo' || mode === 'parachoques') {   // cabina (sitio de la cabeza) o parachoques (delante y abajo)
      const hd = car.def.head, b = car.def.box, e = V.add(car.p, BRR.mv(Rm, mode === 'capo' ? [hd[0], hd[1] + 0.25, hd[2]] : [b.c[0], b.c[1] - b.h[1] * 0.35, b.c[2] - b.h[2] - 0.15])); cam.pos = e;
      const cy = Math.cos(cam.lookYaw), sy = Math.sin(cam.lookYaw), cp = Math.cos(cam.lookPitch), sp = Math.sin(cam.lookPitch);
      cam.look = V.add(e, BRR.mv(Rm, [sy * cp, (mode === 'capo' ? -0.05 : 0.02) + sp, -cy * cp])); cam.up = BRR.mv(Rm, [0, 1, 0]); return;
    }
    if (mode === 'cenital') {   // vista desde muy arriba, casi vertical, como los juegos de coches en miniatura (Micro Machines): mira un poco por delante del coche
      const v = car.v, ahead = V.add(car.p, [v[0] * 0.45, 0, v[2] * 0.45]), tgt = [ahead[0], car.p[1], ahead[2]];
      cam.mm = cam.mm && cam.posInit ? V.add(cam.mm, V.mul(V.sub(tgt, cam.mm), 1 - Math.exp(-dt * 3.5))) : tgt; cam.posInit = true;
      cam.pos = [cam.mm[0], cam.mm[1] + 46, cam.mm[2] + 11]; cam.look = cam.mm; cam.up = [0, 1, 0]; return; }
    if (mode === 'tv' && lvl.fixcams && lvl.fixcams.length) {   // cámaras de televisión del original: la más cercana que ve el coche
      const dd = q => Math.hypot(q[0] - car.p[0], q[2] - car.p[2]), cur = cam.tv;
      const best = lvl.fixcams.slice().sort((a, b) => dd(a) - dd(b))[0];
      if (!cur || dd(cur) > 140 || (best !== cur && dd(best) < dd(cur) * 0.6)) cam.tv = best;
      cam.pos = cam.tv; const tgt = V.add(car.p, [0, 1, 0]); cam.look = cam.look && cam.tvLast === cam.tv ? V.add(cam.look, V.mul(V.sub(tgt, cam.look), 1 - Math.exp(-dt * 8))) : tgt; cam.tvLast = cam.tv; cam.up = [0, 1, 0]; return;
    }
    const target = Math.atan2(-fwd[0], -fwd[2]);
    const cs = Math.max(0.62, Math.min(1.5, car.def.box.h[2] * 2 / 4.8)), [dist, hgt] = (mode === 'lejos' ? [12, 4.2] : mode === 'alta' ? [12, 6.5] : [8, 2.8]).map(x => x * cs);   // distancia según el tamaño del vehículo
    if (!cam.init) { cam.yaw = target; cam.init = true; }
    let d = target - cam.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    cam.yaw += d * (1 - Math.exp(-dt * 5));
    const oy = cam.yaw - cam.lookYaw, pc = Math.cos(cam.lookPitch), ps = Math.sin(cam.lookPitch);
    const back = [Math.sin(oy), 0, Math.cos(oy)];
    let want = V.add(car.p, [back[0] * dist * pc, hgt + dist * Math.max(-0.2, ps) * 0.9, back[2] * dist * pc]);
    const g = lvl.terrain(want[0], want[2]); if (want[1] < g + 0.8) want[1] = g + 0.8;
    { const from = V.add(car.p, [0, 1.4, 0]), dv = V.sub(want, from), L = V.len(dv);
      if (L > 0.5) { const hh = BRR.raycast(lvl, from, V.mul(dv, 1 / L), L); if (hh && hh.surf === 1) want = V.madd(from, dv, Math.max(0.15, (hh.t - 0.6) / L)); } }
    if (!cam.posInit) { cam.pos = want; cam.posInit = true; }
    const a = 1 - Math.exp(-dt * (Math.abs(cam.lookYaw) > 0.05 ? 20 : 12)); cam.pos = V.add(cam.pos, V.mul(V.sub(want, cam.pos), a));
    cam.look = mode === 'alta' ? V.add(car.p, [fwd[0] * 6, 0.5 * cs, fwd[2] * 6]) : V.add(car.p, [0, 1.2 * cs, 0]); cam.up = [0, 1, 0];
  }
  function camShare() { BRR.aiCams = humans.map(h => { const f = V.sub(h.cam.look, h.cam.pos), L = V.len(f) || 1; return { p: h.cam.pos, f: V.mul(f, 1 / L) }; }); }
  const mm3 = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  // interior original (cámara de cabina): el salpicadero y el volante, colocados en la cabeza del piloto
  window.BRR_INTK = window.BRR_INTK || [1, 0, -0.3, 0];   // escala y desplazamiento del interior (ajustado a ojo)
  // agujas del velocímetro y del cuentarrevoluciones: se pintan en la hoja del salpicadero (20 veces por segundo)
  function dialsFrame(c, I) {
    const S0 = I.src; if (!S0 || !S0.dashBase || !S0.dials || !S0.dials.some(d => d.kind !== 'pill')) return; const now = performance.now(); if (now - (I.dT || 0) < 50) return; I.dT = now;
    const bt = I.body.find(b => b.key === 'tex:' + S0.dash); if (!bt || !bt.tex) return;
    const W = 256, H = S0.dashBase.length / 1024, buf = I.buf || (I.buf = new Uint8Array(S0.dashBase.length)); buf.set(S0.dashBase); const pal = S0.pal;
    const px = (x, y, rgb) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const k = (y * W + x) * 4; buf[k] = rgb[0]; buf[k + 1] = rgb[1]; buf[k + 2] = rgb[2]; buf[k + 3] = 255; };
    for (const d of S0.dials) { if (d.kind === 'pill') continue;
      // la esfera de la izquierda es el cuentarrevoluciones y la de la derecha el velocímetro (como se ven dibujadas)
      const fr = d.kind === 'speed' ? c.rpm() / 255 : Math.abs(c.speed()) / (BRR.SPEED_K || 1) / 45000, a = d.a0 + d.ar * Math.max(0, Math.min(1.02, fr)), sx = Math.sin(a), sy = -Math.cos(a);
      for (let r = d.r0; r <= d.r1; r += 0.5) { const x = d.cx + sx * r, y = d.cy + sy * r; px(x + sy * 0.8, y - sx * 0.8, [70, 10, 6]); px(x - sy * 0.8, y + sx * 0.8, [70, 10, 6]); px(x, y, [255, 70, 40]); } }
    const gl = R.gl; gl.bindTexture(gl.TEXTURE_2D, bt.tex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf); gl.generateMipmap(gl.TEXTURE_2D);
  }
  function drawInterior(c, I) {
    const Rm = c.R, hd = c.def.head, [k, ox, oy, oz] = window.BRR_INTK, e = V.add(c.p, BRR.mv(Rm, [hd[0] + ox, hd[1] + 0.25 + oy, hd[2] + oz])), Ks = Rm.map(r => r.map(x => x * k));
    dialsFrame(c, I); R.draw(I.body, BRR.M4.fromRT(Ks, e));
    if (I.steer) { const t = I.steer.tilt, a = -c.steerAng * 2.5, ct = Math.cos(t), st = Math.sin(t), ca = Math.cos(a), sa = Math.sin(a);
      const Rt = [[1, 0, 0], [0, ct, -st], [0, st, ct]], Rz = [[ca, -sa, 0], [sa, ca, 0], [0, 0, 1]], M = mm3(Rm, mm3(Rt, Rz)).map(r => r.map(x => x * k));
      R.draw(I.steer.draw, BRR.M4.fromRT(M, V.add(e, BRR.mv(Rm, I.steer.pos.map(x => x * k))))); }
  }
  function drawCar(c, body, hide, dd = carDraw) {
    const Rm = c.R; if (c.out) return;
    if (hide) { if (hide === 'capo' && dd.interior && opt.cabin !== false) drawInterior(c, dd.interior); return; }
    if (opt.gloss !== 'no' && R.mode) R.drawGloss(body, BRR.M4.fromRT(Rm, c.p), 1); else R.draw(body, BRR.M4.fromRT(Rm, c.p));   // reflejos en la carrocería
    if (c.headDraw && c.def.headPos) R.draw(c.headDraw, BRR.M4.fromRT(Rm, V.add(c.p, BRR.mv(Rm, c.def.headPos))));   // el piloto
    if (dd.brake && c.brakeLight) { R.drawGlow(dd.brake, BRR.M4.fromRT(Rm, c.p), 1.7);   // luces de freno, con halo de luz
      if (fx && c.def.brakeSpots) for (const q of c.def.brakeSpots) { const p = V.add(c.p, BRR.mv(Rm, [q[0], q[1], q[2] + 0.05])); fx.glow(p, [1, 0.12, 0.08, 0.55], 0.45); fx.glow(p, [1, 0.55, 0.45, 0.6], 0.16); } }
    for (const d of dd.deco) {   // hélices, rotores, timones y orugas
      const a = d.spin ? (c.decoA || 0) * d.spin * (0.4 + Math.min(1, Math.abs(c.speed()) / 20 + (c.K.fly ? 1 : 0))) : 0, ca = Math.cos(a), sa = Math.sin(a);
      R.draw(d.draw, BRR.M4.fromRT(mm3(Rm, mm3(d.R, [[ca, -sa, 0], [sa, ca, 0], [0, 0, 1]])), V.add(c.p, BRR.mv(Rm, d.p))));
    }
    c.W.forEach((w, i) => {
      const wd = dd.wheels[i]; if (!wd) return;
      const cc = [w.c[0], w.c[1] + 0.3 - w.len, w.c[2]];
      const sa = -c.steerAng * (w.steerK != null ? w.steerK : w.steer ? 1 : 0), cs = Math.cos(sa), sn = Math.sin(sa), cx = Math.cos(w.spin), sx = Math.sin(w.spin);
      const Ry = [[cs, 0, sn], [0, 1, 0], [-sn, 0, cs]], Rx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]];
      R.draw(wd, BRR.M4.fromRT(mm3(Rm, mm3(Ry, Rx)), V.add(c.p, BRR.mv(Rm, cc))));
    });
  }
  // primeros segundos tras la salida: choques suaves entre coches
  const softStart = () => { const r0 = humans[0] && humans[0].race; return !!r0 && r0.phase === 'race' && r0.t < 4.5; };
  const camDist = p => Math.min(...humans.map(h => Math.hypot(p[0] - h.cam.pos[0], p[2] - h.cam.pos[2])));
  // bocinas: el jugador con H / L3 / R3; la máquina pita si la golpeas, al caer de un salto grande o si vuelca
  let hornPrev = null;
  const RIVAL_HORNS = ['normal', 'aguda', 'grave', 'payaso', 'claxon', 'camion', 'boing'];
  const humanHorn = h => h.i === 0 ? (opt.horn || 'normal') : ['aguda', 'grave', 'payaso', 'claxon', 'trombon', 'camion', 'boing', 'laser'][h.i % 8];
  function hornFrame(dt) {
    if (!audio || !audio.ctx || state !== 'race') { for (const h of humans) if (h.horn) { h.horn.stop(); h.horn = null; } return; }
    for (const h of humans) { const on = !!(h.inp && h.inp.horn), was = !!h.hornWas; h.hornWas = on; if (on === was) continue;
      const type = humanHorn(h), info = BRR.hornInfo(type), vol = humans.length > 1 ? 0.6 : 0.8;
      if (on) { if (h.horn) (h.horn.cut || h.horn.stop).call(h.horn); h.horn = BRR.playHorn(audio, type, 1, vol); if (h.i === 0) achCount('horns', 50, 'bocinazos'); }
      else if (h.horn && info.hold) { h.horn.stop(); h.horn = null; }
      if (netRace && h.i === 0) BRR_net.game({ k: 'hn', t: type === 'propia' ? 'normal' : type, on: on ? 1 : 0 });
      if (on) for (const r of rivals) if (!r.remote && V.len(V.sub(r.car.p, h.car.p)) < 25) r.honked = performance.now() / 1000;   // les has pitado: a veces contestan
    }
    const now = performance.now() / 1000;
    for (const r of rivals) { const c = r.car; if (r.remote) continue;
      if ((r.hornCd || 0) > now) continue;
      let why = null;
      if (c.bumpT && now - c.bumpT < 0.35 && c.bumpBy) { why = c.bumpBy.isPlayer || Math.random() < 0.5 ? 'golpe' : null; c.bumpT = 0; }
      // más motivos para pitar: al salir, al adelantar, cuando alguien lento le tapa y al cruzar la meta
      const rk = order.findIndex(o => o.car === c);
      if (!why && r.race.phase === 'race' && r.race.t < 2.5 && !r.hornStart) { r.hornStart = true; if (Math.random() < 0.35) why = 'salida'; }
      if (!why && r.rankWas != null && rk >= 0 && rk < r.rankWas) { const ov = order[rk + 1]; if (ov && V.len(V.sub(ov.car.p, c.p)) < 18 && Math.random() < 0.45) why = 'adelanta'; }
      if (rk >= 0) r.rankWas = rk;
      if (!why && rk > 0) { const a = order[rk - 1].car, d2 = V.sub(a.p, c.p), dl = V.len(d2); if (dl < 9 && V.dot(d2, c.forward()) > dl * 0.8 && Math.abs(a.speed()) < Math.abs(c.speed()) + 1) { r.blockT = (r.blockT || 0) + dt; if (r.blockT > 1.2) { why = 'tapon'; r.blockT = 0; } } else r.blockT = 0; }
      if (!why && r.race.finishT != null && !r.hornFin) { r.hornFin = true; if (Math.random() < 0.6) why = 'meta'; }
      if ((c.landed || 0) > 7) { why = why || 'salto'; c.landed = 0; }
      if (c.R[1][1] < 0.25) { r.flipT = (r.flipT || 0) + dt; if (r.flipT > 0.6) why = 'vuelco'; } else r.flipT = 0;
      if (r.honked && now - r.honked < 0.6 && now - r.honked > 0.3) { why = why || 'respuesta'; r.honked = 0; }
      if (!why || Math.random() > (why === 'golpe' ? 0.7 : 0.5)) { if (why) r.hornCd = now + 1.5; continue; }
      const d = camDist(c.p); if (d > 110) continue;
      const type = r.hornType || (r.hornType = RIVAL_HORNS[(c.team || 1) % RIVAL_HORNS.length]), hold = BRR.hornInfo(type).hold;
      const p = 0.9 + ((c.team || 1) % 3) * 0.06, v = 0.6 * (audio.spatial ? 1 : (1 - d / 110));
      if (why === 'vuelco' && Math.random() < 0.4) audio.horn(1, v, null, 'trombon', c.p);
      else if (!hold) audio.horn(p, v, null, type, c.p);
      else if (why === 'vuelco' || why === 'golpe') { audio.horn(p, v, 0.18, type, c.p); setTimeout(() => audio.horn(p, v, 0.18, type, c.p), 260); if (why === 'vuelco') setTimeout(() => audio.horn(p, v, 0.45, type, c.p), 520); }
      else audio.horn(p, v, 0.35, type, c.p);
      r.hornCd = now + 1.5 + Math.random() * 2.5;
    }
  }
  function nitroFx(c) {
    if (!audio || !audio.ctx) return;
    c.boostT = 0.6;   // llamarada grande y halo al encenderlo
    const d = c.isPlayer ? 0 : camDist(c.p); if (d > 140) return; const k = c.isPlayer ? 1 : Math.max(0.25, 1 - d / 140);
    audio.play('GEN/TUR.WAV', { vol: c.isPlayer ? 0.9 : 0.85 * k, pos: c.isPlayer ? null : c.p }); audio.boost(c.isPlayer ? 0.7 : 0.75 * k, c.isPlayer ? null : c.p.slice());
  }
  function propSound(hit) {
    if (hit.car && hit.car.isPlayer && hit.car.human === 0 && state === 'race') { achCount('props', 100, 'destrozos'); if (BRR.isCritter(hit.o)) achCount('sheep', 10, 'ovejas'); }
    if (!audio || !audio.ctx) return;
    const d = camDist(hit.o.pos); if (d > 120) return;
    const f = /CONE/.test(hit.o.name) ? 'GEN/CONE.WAV' : hit.o.cls === 4 || BRR.isCritter(hit.o) ? 'GEN/SPLAT.WAV' : 'GEN/SIGN.WAV';
    audio.play(f, { vol: Math.min(1, hit.speed / 15) * Math.max(0.15, 1 - d / 120), pos: hit.o.pos });
  }
  // ---------- posiciones ----------
  let order = [], leader = null, leaderT = 0;
  // comentarista: voces del CD por nombre (se prueban varios); si no hay una concreta, a veces un comentario general
  function say(prefs, chance = 1, general = true) {
    if (!audio || !snd.pickVoice || Math.random() > chance) return; const now = performance.now() / 1000; if (now < (snd.sayT || 0)) return;
    let v = null; for (const p of prefs) if ((v = pickV(p))) break; if (!v && general && Math.random() < 0.4) v = pickV('GENRAL');
    if (v) { audio.voice(v); snd.sayT = now + 6; snd.nextGeneral = Math.max(snd.nextGeneral || 0, 12); }
  }
  function updatePositions(dt) {
    const all = [...humans.map(h => ({ car: h.car, race: h.race, h })), ...rivals];
    order = all.map(o => ({ o, s: o.car.out ? -1e7 + o.car.outN : o.car.zombie ? -1e6 + o.car.zN : o.car.cop && crazy ? -5e5 : o.race.finishT != null ? 1e6 - o.race.finishT : o.remote && o.sc != null ? o.sc : o.race.score() })).sort((a, b) => b.s - a.s).map(x => x.o);
    for (const h of humans) { const pos = order.findIndex(o => o.h === h) + 1; h.q('h_pos').textContent = order.length > 1 ? `${pos}/${order.length}` : '–';
      if (!h.done) { if (race.phase === 'race' && race.t > 5 && h.pos && order.length > 1 && humans.length === 1) { if (pos < h.pos) say(['OVERTAK', 'OVERTK', 'PASS', 'OVER'], 0.55); else if (pos > h.pos) say(['PASSED', 'BEHIND', 'LOSE'], 0.25, false); } h.pos = pos; } }
    const lt = order[0].car.team; leaderT += dt;
    if (race.phase === 'race' && race.t > 6 && lt !== leader && leaderT > 4 && order.length > 1 && snd.pickVoice) {
      leaderT = 0; const v = pickV(TEAM[lt].v); if (v && audio) audio.voice(v);
    }
    if (race.phase === 'race') leader = lt;
  }

  // ---------- modos locos: eliminación por tiempo · eliminación por controles · bomba ----------
  // el que se elimina desaparece (sin física, sin choques, sin dibujo); gana el último que queda
  let crazy = null, crazyId = 0, crazyPick = 'normal';   // crazyPick: solo lo pone «Correr» del menú moderno
  const BOMB_T = 60, ZOMBIE_T = 300, COPS_T = 300;
  const CRAZY_NAME = { elim_cp: 'Eliminación', bomba: 'Bomba caliente', zombie: 'Infección zombi', polis: 'Polis y cacos', kart: 'Modo kart' };
  const crazyR = () => crazy && crazy.mode !== 'kart';   // modos con eliminados/ganadores propios (el kart es una carrera normal)
  const crazyJump = () => crazy && (crazy.mode === 'bomba' || crazy.mode === 'zombie' || crazy.mode === 'polis');   // modos sin vueltas: se puede saltar
  function crazyInit() {
    const mode = ttMode || tourMode || rpLoad ? 'normal' : netRace ? (netRace.crazy || 'normal') : !freeMode ? crazyPick : 'normal';
    for (const c of [...humans.map(h => h.car), ...rivals.map(r => r.car)]) { c.out = !!c.spec; c.outN = 0; c.bombLeft = BOMB_T; c.cop = false; c.robber = false; }
    crazyId++; crazy = null; kart = null; if (!CRAZY_NAME[mode] || humans.length + rivals.length < 2) return;
    // eliminación por controles según el tamaño del circuito: pequeño → cada vuelta; mediano → cada media vuelta; grande → cada ~1 km de controles
    const rc = humans[0].race, G = rc.maxNum + 1, L = rc.total;
    // controles juntos (mapa pequeño) → cada 2 controles; separados (mapa largo) → cada control; y que con muchos coches no pase de unas 2 vueltas
    const nCars = humans.length + rivals.length, spacing = L / Math.max(1, G); let step = spacing < 380 ? 2 : 1; step = Math.max(1, Math.min(step, Math.floor(2 * G / Math.max(1, nCars - 1))));
    crazy = { mode, id: crazyId, n: 0, cpStep: step, cpNext: step, bomb: null, bombT0: 3, over: false, zT0: 3, zLeft: ZOMBIE_T, zN: 0, copsLeft: COPS_T };
    crazy.net = netRace ? (netRace.role === 'host' ? 'host' : 'client') : null; crazy.sendT = 0; crazy.hitT = new Map();
    if (mode === 'polis' && crazy.net !== 'client') copsSetup();
    if ((mode === 'zombie' || mode === 'bomba') && humans[0]) { const L0 = [...humans.map(h => ({ car: h.car, race: h.race, h })), ...(crazy.net === 'client' ? [] : rivals.filter(r => !r.remote))]; roamSpawns(L0, null, mode === 'bomba' ? 15 : 40, mode === 'bomba' ? 140 : 320); }
    if (mode === 'kart') kartInit();
    for (const c of [...humans.map(h => h.car), ...rivals.map(r => r.car)]) { c.zombie = false; if (c.drawN) { const o = humans.find(h => h.car === c) || rivals.find(r => r.car === c); if (o) o.draw = c.drawN; c.drawN = null; } }
  }
  const crazyWho = o => o.h ? (humans.length > 1 ? NAMES[o.h.i] : 'Tú') : (o.name && !o.isAI ? o.name : o.car.teamName || (o.ai ? o.ai.P.name : 'Equipo ' + TEAM[o.car.team].n));
  function crazyBoom(c) {
    const p = V.add(c.p, [0, 0.6, 0]); fx.sparks(p, 50);
    for (let i = 0; i < 22; i++) { const a = Math.random() * 6.283; fx.puff(p, [Math.cos(a) * 5, 2 + Math.random() * 4, Math.sin(a) * 5], [1, 0.4 + Math.random() * 0.35, 0.1, 0.85], 0.7, 1.1, 3.5, 1, 0.5); }
    for (let i = 0; i < 10; i++) fx.puff(p, [(Math.random() - .5) * 3, 2.5, (Math.random() - .5) * 3], [0.12, 0.12, 0.12, 0.6], 0.8, 2.5, 4, 1, 0.5);
    if (audio && audio.ctx) audio.play('GEN/EXPLODE.WAV', { vol: c.isPlayer ? 1 : Math.max(0.25, 1 - camDist(c.p) / 160), pos: c.isPlayer ? null : c.p });
  }
  function eliminate(o, quiet, msg) {
    const c = o.car; if (c.out) return; crazy.n++; c.out = true; c.outN = crazy.n; crazyBoom(c); c.v = [0, 0, 0]; c.w = [0, 0, 0]; c.nitroT = 0; if (quiet) return;
    const who = crazyWho(o);
    for (const x of humans) if (!x.car.out || x === o.h) flash(x, x === o.h ? (msg || '¡ELIMINADO!') : who + (msg ? ' · ¡pillado!' : ' · ¡eliminado!'), 2.5, x === o.h ? 'big warn' : 'warn');
    if (o.h) { o.h.done = true; if (humans.length > 1) { o.h.q('done').textContent = 'Eliminado'; o.h.q('done').hidden = false; } }
    if (!crazy.net && humans.every(x => x.car.out) && !crazy.over) { crazy.over = true; const id = crazy.id; setTimeout(() => { if (crazy && crazy.id === id) showResults(); }, 3000); }
  }
  function crazyEnd(win, loser, team) {
    if (crazy.over && !loser) return; crazy.over = true; crazy.bomb = null; crazy.team = team; crazy.win = win || null; if (loser) crazy.loser = loser; const id = crazy.id;
    if (crazy.net === 'host') { crazy.sendT = 0; crazyNetSend(0); }
    for (const x of humans) { x.done = true; flash(x, team ? ((team === 'cops') === x.car.cop ? (team === 'cops' ? '¡Ganan los polis!' : '¡Ganan los cacos!') + ' · ¡HAS GANADO!' : (team === 'cops' ? '¡Ganan los polis!' : '¡Ganan los cacos!') + ' · has perdido') : loser ? (loser.h === x ? '¡BUM! Te ha explotado la bomba: pierdes' : '¡BUM! ' + crazyWho(loser) + ' pierde · ¡te has librado!') : win && win.h === x ? '¡ÚLTIMO SUPERVIVIENTE!' : win ? '¡Gana ' + crazyWho(win) + '!' : crazy.mode === 'zombie' ? '¡Tiempo! Ganan los que no son zombis' : 'Fin', 3, 'big'); }
    if (audio) { const v = pickV('FINISH') || pickV('GAMEOVER'); if (v) audio.voice(v, true); }
    if (humans.length === 1 && ((win && win.h === humans[0]) || (team && (team === 'cops') === humans[0].car.cop))) achUnlock('victoria');
    { const me = humans[0] && humans[0].car; if (me) { const won = (win && win.h === humans[0]) || (!win && !team && !me.out && !me.zombie);
      if (crazy.mode === 'elim_cp' && won) achUnlock('m_elim'); if (crazy.mode === 'bomba' && !me.out) achUnlock('m_bomba'); if (crazy.mode === 'zombie' && !me.zombie) achUnlock('m_zombi');
      if (crazy.mode === 'polis' && team === 'cops' && me.cop) achUnlock('m_poli'); if (crazy.mode === 'polis' && team === 'robbers' && me.robber && !me.out) achUnlock('m_caco'); } }
    setTimeout(() => { if (crazy && crazy.id === id) showResults(); }, 2500);
  }
  function bombGive(car, prev) {
    crazy.bomb.car = car; crazy.bomb.cool = 1.5; const h = humans.find(x => x.car === car);
    if (h) flash(h, '¡Tienes la bomba! Choca con otro para pasarla', 2.5, 'warn');
    if (prev) { const hp = humans.find(x => x.car === prev); if (hp) flash(hp, '¡Bomba pasada!', 1.5); }
    if (audio && audio.ctx) audio.play('SAMPLES/BEEP4.WAV', { vol: 0.8 });
  }
  // bomba caliente (sin vueltas): cada coche tiene 2 minutos de vida con la bomba encima; su reloj solo corre mientras la lleva.
  // Se pasa al chocar. Si a uno se le acaba, explota (eliminado) y la bomba pasa al más cercano. Gana el último que queda.
  // ¿se tocan? (basta un roce: distancia entre los coches menor que su tamaño)
  const touching = (a, b) => { const ra = Math.hypot(a.def.box.h[0], a.def.box.h[2]) * 0.72, rb = Math.hypot(b.def.box.h[0], b.def.box.h[2]) * 0.72; return V.len(V.sub(a.p, b.p)) < ra + rb + 0.3; };
  const touchOf = (c, alive, ok) => alive.find(o => o.car !== c && !o.car.out && ok(o.car) && touching(c, o.car));
  // bomba caliente (sin vueltas, libre): cada coche tiene 1 minuto con la bomba encima (su reloj solo corre mientras la lleva); se pasa con solo tocar a otro.
  // Si a uno se le acaba, explota (eliminado) y la bomba pasa al que más tiempo le quede (si empatan, a uno al azar). Gana el último vivo.
  function bombFrame(dt, alive) {
    let B = crazy.bomb;
    if (!B) { crazy.bombT0 -= dt; if (crazy.bombT0 <= 0) { crazy.bomb = { car: null, cool: 0 }; bombGive(alive[Math.random() * alive.length | 0].car); } return; }
    B.cool -= dt; const c = B.car; c.bombLeft = Math.max(0, c.bombLeft - dt); B.t = c.bombLeft;
    if (B.cool <= 0) { const t = touchOf(c, alive, () => true) || (c.hitBy && !c.hitBy.out ? { car: c.hitBy } : null); c.hitBy = null; if (t) { bombGive(t.car, c); return; } }
    if (Math.random() < dt * 40) fx.sparks(V.add(c.p, [0, 2.4, 0]), 2);   // la mecha
    if (c.bombLeft < 10 && Math.ceil(c.bombLeft) !== Math.ceil(c.bombLeft + dt) && audio && audio.ctx) audio.play('SAMPLES/BEEP3.WAV', { vol: 0.6 });
    if (c.bombLeft <= 0) { const o = alive.find(x => x.car === c); if (o) eliminate(o); const rest = alive.filter(x => x.car !== c && !x.car.out);
      if (rest.length > 1) { const mx = Math.max(...rest.map(x => x.car.bombLeft)), top = rest.filter(x => x.car.bombLeft >= mx - 0.05); bombGive(top[Math.random() * top.length | 0].car); }
      else { crazy.bomb = null; crazyEnd(rest[0]); } }
  }
  // polis y cacos (sin vueltas): la mitad son polis (salen de la salida, con sirena) y la otra mitad cacos (salen a medio circuito).
  // Un poli que choca a un caco lo elimina. Ganan los polis si pillan a todos; los cacos, si alguno aguanta 5 minutos.
  function copsSetup() {
    const all = [...humans.map(h => ({ car: h.car, race: h.race, h })), ...rivals], n = all.length, nCops = Math.max(1, Math.floor(n / 2));
    // los humanos: el J1 al azar y los demás alternando; luego se completan con la IA (los grabados, de polis: no se pueden mover de su trazada)
    const r0 = Math.random() < 0.5; humans.forEach((h, i) => { h.car.cop = (i % 2 === 0) === r0; });
    let cops = humans.filter(h => h.car.cop).length;
    const ais = rivals.slice().sort((a, b) => (b.replay ? 1 : 0) - (a.replay ? 1 : 0) || Math.random() - 0.5);
    for (const r of ais) { r.car.cop = cops < nCops || (!!r.replay && cops < n - 1); if (r.car.cop) cops++; }
    if (!all.some(o => !o.car.cop)) { const o = all.find(o => !o.replay && !o.h) || all[0]; o.car.cop = false; }
    for (const o of all) o.car.robber = !o.car.cop;
    // los cacos, a medio circuito, uno detrás de otro
    let k = 0; for (const o of all) { if (!o.car.robber) continue; o.car.sk = k; if (!o.remote) spawnRobber(o, k); k++; }
  }
  function spawnRobber(o, k) {   // los cacos salen repartidos por la zona más lejana de la salida (cada uno en un sitio)
    const P = o.race.P, sp = lvl.startPos; let fi = 0, fd = -1; P.forEach((q, i) => { const d = (q[0] - sp[0]) ** 2 + (q[2] - sp[2]) ** 2; if (d > fd) { fd = d; fi = i; } });
    roamSpawns([o], P[fi], 5 + k * 6, 170);
  }

  function crazySirens() {   // sirena de los polis: rojo y azul alternando sobre el techo (también en la cuenta atrás)
    if (!crazy || crazy.mode !== 'polis') return; const blink = (performance.now() / 250 | 0) % 2;
    for (const c of [...humans.map(h => h.car), ...rivals.map(r => r.car)]) { if (!c.cop || c.out) continue;
      const top = (c.def.box ? c.def.box.c[1] + c.def.box.h[1] : 1.2) + 0.05;
      fx.glow(V.add(c.p, BRR.mv(c.R, [-0.5, top, 0])), blink ? [1, 0.12, 0.1, 1] : [1, 0.12, 0.1, 0.2], 0.55);
      fx.glow(V.add(c.p, BRR.mv(c.R, [0.5, top, 0])), blink ? [0.15, 0.35, 1, 0.2] : [0.15, 0.35, 1, 1], 0.55); }
  }
  function copsFrame(dt, alive) {
    crazy.copsLeft -= dt;
    for (const o of alive) { const c = o.car; if (!c.cop) continue;
      const t = c.hitBy && c.hitBy.robber && !c.hitBy.out ? alive.find(x => x.car === c.hitBy) : touchOf(c, alive, x => x.robber); c.hitBy = null; if (t) eliminate(t, false, '¡Pillado!'); }
    const left = order.filter(o => !o.car.out && o.car.robber);
    if (!left.length) crazyEnd(null, null, 'cops'); else if (crazy.copsLeft <= 0) crazyEnd(null, null, 'robbers');
  }
  // infección zombi: sin vueltas (libre); un coche empieza de zombi (verde) y contagia al que toca; gana el último sin contagiar
  const zMesh = new Map();
  async function zombify(o) {
    const c = o.car; if (c.zombie) return; c.zombie = true; crazy.zN++; c.zN = crazy.zN; const id = crazy.id;
    for (let i = 0; i < 16; i++) fx.puff(V.add(c.p, [0, 1, 0]), [(Math.random() - .5) * 5, 1.5 + Math.random() * 2, (Math.random() - .5) * 5], [0.3, 0.95, 0.25, 0.7], 0.6, 1.2, 3, 1, 0.5);
    const who = crazyWho(o); for (const x of humans) flash(x, x === o.h ? '¡Te han infectado! Ahora eres zombi: contagia a los demás' : who + ' · ¡infectado!', 2.5, x === o.h ? 'big warn' : 'warn');
    if (audio && audio.ctx) audio.play('SAMPLES/BEEP4.WAV', { vol: 0.8 });
    const k = c.def.name; let m = zMesh.get(k);
    if (!m) { try { const d = await BRR.loadVehicle(files, k, lvl, c.team, { paint: [70, 205, 60] }); m = R.upload(d.mesh); zMesh.set(k, m); } catch (e) { return; } }
    if (!crazy || crazy.id !== id || !c.zombie) return; c.drawN = o.draw; o.draw = m; if (o.h) o.h.draw = m;
  }
  function zombieFrame(dt, alive) {
    if (!crazy.zN) { crazy.zT0 -= dt; if (crazy.zT0 <= 0) zombify(alive[Math.random() * alive.length | 0]); return; }
    crazy.zLeft -= dt; const now = performance.now() / 1000;
    for (const o of alive) { const c = o.car; if (!c.zombie) continue; if (Math.random() < dt * 6) fx.puff(V.add(c.p, [0, 1.2, 0]), [0, 1.2, 0], [0.3, 0.9, 0.25, 0.4], 0.4, 1.5, 2.2, 1, 0.4);
      const t = c.hitBy && !c.hitBy.zombie && !c.hitBy.out ? alive.find(x => x.car === c.hitBy) : touchOf(c, alive, x => !x.zombie); c.hitBy = null; if (t) zombify(t); }
    const free = alive.filter(o => !o.car.zombie);
    if (free.length <= 1 || crazy.zLeft <= 0) crazyEnd(free.length === 1 ? free[0] : null);
  }
  // la IA que lleva la bomba o es zombi persigue al coche más cercano (si lo tiene a tiro)
  function crazyChase(r) {
    if (!crazy || crazy.over || !r.inp || r.car.out) return; const c = r.car;
    const hunt = crazy.mode === 'bomba' ? crazy.bomb && crazy.bomb.car === c && crazy.bomb.cool <= 0 : crazy.mode === 'zombie' ? c.zombie : crazy.mode === 'polis' && c.cop; if (!hunt) return;
    let best = null, bd = (c.cop ? 110 : 70) ** 2; for (const o of order) { const x = o.car; if (x === c || x.out || x.zombie || (c.cop && !x.robber)) continue; const d = (x.p[0] - c.p[0]) ** 2 + (x.p[2] - c.p[2]) ** 2; if (d < bd) { bd = d; best = x; } }
    if (!best) return; const fw = c.forward(), d = V.sub(V.madd(best.p, best.v, 0.4), c.p), err = Math.atan2(fw[0] * d[2] - fw[2] * d[0], fw[0] * d[0] + fw[2] * d[2]);
    r.inp.steer = Math.max(-1, Math.min(1, err * 2.5)); r.inp.throttle = 1; r.inp.brake = 0; r.inp.handbrake = Math.abs(err) > 1.4;
  }
  function crazyFrame(dt) {
    if (crazy && crazy.mode === 'kart') return;
    if (crazy && crazy.net === 'client') return crazyClientFrame(dt);
    if (!crazy || crazy.over || state !== 'race' || humans[0].race.phase !== 'race') return;
    const alive = order.filter(o => !o.car.out);
    if (alive.length <= 1) return crazyEnd(alive[0]);
    else if (crazy.mode === 'elim_cp') {   // el último en llegar a la marca de controles queda fuera
      const behind = alive.filter(o => (o.remote ? (o.sc != null ? Math.ceil(o.sc) - 1 : 0) : o.race.passed) < crazy.cpNext);
      if (behind.length <= 1) { if (behind.length) eliminate(behind[0]); crazy.cpNext += crazy.cpStep; }
    } else if (crazy.mode === 'bomba') bombFrame(dt, alive);
    else if (crazy.mode === 'zombie') return zombieFrame(dt, alive);
    else if (crazy.mode === 'polis') return copsFrame(dt, alive);
    const left = order.filter(o => !o.car.out); if (left.length <= 1 && !crazy.over && crazy.mode !== 'bomba') crazyEnd(left[0]);
  }
  // ---------- modos extra en online: el anfitrión decide (bomba, contagios, pillados, eliminaciones) y manda el estado;
  // cada jugador avisa al anfitrión de con quién ha chocado su coche
  const czId = c => c === humans[0].car ? netRace.myId : (rivals.find(r => r.car === c) || {}).id;
  const czObj = id => id === netRace.myId ? { car: humans[0].car, race: humans[0].race, h: humans[0] } : rivals.find(r => r.id === id);
  function crazyNetSend(dt) {   // anfitrión: 5 veces por segundo
    if (!crazy || crazy.net !== 'host' || crazy.mode === 'kart') return; crazy.sendT -= dt; if (crazy.sendT > 0) return; crazy.sendT = 0.2;
    const all = [humans[0].car, ...rivals.map(r => r.car)];
    BRR_net.game({ k: 'cz', cars: all.map(c => [czId(c), c.out ? 1 : 0, c.zombie ? 1 : 0, c.cop ? 1 : c.robber ? 2 : 0, c.sk ?? -1, +(c.bombLeft || 0).toFixed(1)]), b: crazy.bomb && crazy.bomb.car ? czId(crazy.bomb.car) : null,
      zl: +crazy.zLeft.toFixed(1), cl: +crazy.copsLeft.toFixed(1), cp: crazy.cpNext, z: crazy.zN, over: crazy.over ? { w: crazy.win ? czId(crazy.win.car) : null, l: crazy.loser ? czId(crazy.loser.car) : null, t: crazy.team || null } : null });
  }
  function crazyNetHits() {   // jugador (no anfitrión): sus choques, al anfitrión
    if (!crazy || crazy.net !== 'client' || crazy.over) return; const c = humans[0].car, t = c.hitBy; if (!t) return; const id = czId(t), now = performance.now();
    if (!id || now - (crazy.hitT.get(id) || 0) < 300) return; crazy.hitT.set(id, now); BRR_net.game({ k: 'czh', by: id });
  }
  function crazyNetMsg(from, d) {
    if (!crazy || !netRace) return;
    if (d.k === 'czh' && crazy.net === 'host') { const a = czObj(from), b = czObj(d.by); if (a && b && a !== b) { a.car.hitBy = b.car; b.car.hitBy = a.car; } return; }
    if (d.k !== 'cz' || crazy.net !== 'client' || !Array.isArray(d.cars)) return;
    for (const [id, out, zb, role, sk, bl] of d.cars) { const o = czObj(id); if (!o) continue; const c = o.car;
      c.cop = role === 1; c.robber = role === 2; c.bombLeft = +bl || 0;
      if (c.robber && sk >= 0 && c.sk == null) { c.sk = sk; if (o.h) spawnRobber(o, sk); }
      if (zb && !c.zombie) zombify(o); if (out && !c.out) eliminate(o); }
    const bc = d.b != null && czObj(d.b);
    if (bc) { if (!crazy.bomb) crazy.bomb = { car: null, cool: 0 }; if (crazy.bomb.car !== bc.car) { const prev = crazy.bomb.car; bombGive(bc.car, prev); } } else if (crazy.bomb && !d.over) crazy.bomb = null;
    crazy.zLeft = d.zl ?? crazy.zLeft; crazy.copsLeft = d.cl ?? crazy.copsLeft; crazy.cpNext = d.cp ?? crazy.cpNext;
    if (d.over && !crazy.over) { const w = d.over.w && czObj(d.over.w), l = d.over.l && czObj(d.over.l); crazy.loser = l || null; crazyEnd(w || null, l || null, d.over.t || null); }
  }
  function crazyClientFrame(dt) {   // jugador: solo lo que se ve (relojes y efectos) entre mensajes del anfitrión
    if (crazy.over || state !== 'race' || humans[0].race.phase !== 'race') return;
    const B = crazy.bomb; if (B && B.car) { B.car.bombLeft = Math.max(0, B.car.bombLeft - dt); B.t = B.car.bombLeft; if (Math.random() < dt * 40) fx.sparks(V.add(B.car.p, [0, 2.4, 0]), 2); }
    if (crazy.mode === 'zombie') { crazy.zLeft -= dt; for (const c of [humans[0].car, ...rivals.map(r => r.car)]) if (c.zombie && !c.out && Math.random() < dt * 6) fx.puff(V.add(c.p, [0, 1.2, 0]), [0, 1.2, 0], [0.3, 0.9, 0.25, 0.4], 0.4, 1.5, 2.2, 1, 0.4); }
    if (crazy.mode === 'polis') crazy.copsLeft -= dt;
  }
  function crazyHud(h) {
    if (crazy.mode === 'elim_cp') { const left = crazy.cpNext - h.race.passed; return h.car.out ? '–' : left > 0 ? '🏁 ' + left : '✔'; }
    if (crazy.mode === 'zombie') { const n = order.filter(o => !o.car.out && !o.car.zombie).length; return (h.car.zombie ? '🧟 ' : '🙂 ') + n + ' · ' + fmt(Math.max(0, crazy.zLeft)).slice(0, -3); }
    if (crazy.mode === 'polis') { const n = order.filter(o => !o.car.out && o.car.robber).length; return (h.car.cop ? '🚨 ' : '💰 ') + n + ' · ' + fmt(Math.max(0, crazy.copsLeft)).slice(0, -3); }
    const B = crazy.bomb; return h.car.out ? '💥' : '💣 ' + fmt(Math.max(0, h.car.bombLeft)).slice(0, -3) + (B && B.car === h.car ? ' ¡TÚ!' : '');
  }

  // ---------- modo kart: cajas de objetos en el circuito y objetos para usar (V o G / cruceta ↑) ----------
  // 🛢️ mancha de aceite (detrás, hace trompear) · 🟢 misil recto · 🔴 misil que busca al de delante · 💣 bomba (detrás, explota) · ⚡ turbo
  const KITEMS = { oil: { e: '🛢️', n: 'Mancha de aceite' }, mg: { e: '🟢', n: 'Misil recto' }, mr: { e: '🔴', n: 'Misil buscador' }, bomb: { e: '💣', n: 'Bomba' }, turbo: { e: '🚀', n: 'Turbo extra' }, rayo: { e: '⚡', n: 'Rayo' } };
  let kMesh = null;
  function kartMeshes() {
    if (kMesh) return kMesh;
    const mk = fill => { const mb = new BRR.MeshBuilder(null), g = mb.group('COLOR'); fill((a, b, c, col) => { for (const v of [a, b, c, a, c, b]) { g.pos.push(...v); g.col.push(...col); g.lay.push(0); } }); return R.upload(mb); };
    const box = (T, c, h, cols) => { const [x, y, z] = c, [a, b, d] = h, P = (i, j, k) => [x + i * a, y + j * b, z + k * d];
      const F = [[P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)], [P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1)], [P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1)],
        [P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)], [P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1)], [P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1)]];
      F.forEach((q, i) => { const col = cols[i % cols.length]; T(q[0], q[1], q[2], col); T(q[0], q[2], q[3], col); }); };
    kMesh = {
      box: mk(T => { box(T, [0, 0, 0], [0.75, 0.75, 0.75], [[1, 0.25, 0.2], [0.25, 0.6, 1], [1, 0.85, 0.2], [0.3, 0.9, 0.35], [0.85, 0.3, 1], [1, 0.55, 0.15]]); box(T, [0, 0, 0], [0.8, 0.12, 0.8], [[1, 1, 1]]); }),
      mg: mk(T => { box(T, [0, 0, 0], [0.32, 0.32, 0.9], [[0.2, 0.85, 0.3]]); box(T, [0, 0, -1.05], [0.2, 0.2, 0.2], [[0.95, 0.95, 0.95]]); box(T, [0, 0, 0.7], [0.6, 0.06, 0.25], [[0.1, 0.5, 0.15]]); }),
      mr: mk(T => { box(T, [0, 0, 0], [0.32, 0.32, 0.9], [[0.95, 0.15, 0.12]]); box(T, [0, 0, -1.05], [0.2, 0.2, 0.2], [[0.95, 0.95, 0.95]]); box(T, [0, 0, 0.7], [0.6, 0.06, 0.25], [[0.55, 0.05, 0.05]]); }),
      bomb: mk(T => { box(T, [0, 0.45, 0], [0.55, 0.45, 0.55], [[0.12, 0.12, 0.14]]); box(T, [0, 1.0, 0], [0.12, 0.12, 0.12], [[0.9, 0.7, 0.2]]); box(T, [0, 0.45, 0], [0.57, 0.08, 0.57], [[0.9, 0.1, 0.1]]); }),
      oil: mk(T => { const n = 14, col = [0.04, 0.04, 0.06]; for (let i = 0; i < n; i++) { const a0 = i / n * 6.283, a1 = (i + 1) / n * 6.283, r0 = 1.6 + 0.6 * Math.sin(i * 2.3), r1 = 1.6 + 0.6 * Math.sin((i + 1) * 2.3);
        T([0, 0.04, 0], [Math.cos(a0) * r0, 0.04, Math.sin(a0) * r0], [Math.cos(a1) * r1, 0.04, Math.sin(a1) * r1], col); } }),
    };
    return kMesh;
  }
  let kart = null;
  function kartInit() {
    kart = null; if (!crazy || crazy.mode !== 'kart') return; kartMeshes();
    const rc = humans[0].race, P = rc.P, boxes = [], gap = Math.max(160, Math.min(320, rc.total / 6));
    const line = (rivals.find(r => r.ai && r.ai.line) || {}).ai?.line || (lvl.aiLines || {})[BRR.aiMode ? BRR.aiMode(humans[0].car) : 'wheels'];
    for (let s = 90; s < rc.total - 40; s += gap) { let c0, t;
      if (line) { const tg = BRR.aiAt(line, s / rc.total * (line.total || rc.total)); t = tg.t; const nrm = [-t[2], 0, t[0]], off = ((tg.roomR || 6) - (tg.roomL || 6)) / 2; c0 = V.madd(tg.p, nrm, off); }   // centro del hueco libre de la carretera
      else { const j = Math.max(0, rc.cum.findIndex(x => x >= s) - 1), a = P[j], b = P[(j + 1) % P.length], u = (s - rc.cum[j]) / Math.max(1, rc.cum[j + 1] - rc.cum[j]); t = V.norm([b[0] - a[0], 0, b[2] - a[2]]); c0 = [a[0] + (b[0] - a[0]) * u, 0, a[2] + (b[2] - a[2]) * u]; }
      for (const side of [-6.25, -3.75, -1.25, 1.25, 3.75, 6.25]) { const x = c0[0] - t[2] * side, z = c0[2] + t[0] * side; boxes.push({ p: [x, groundY(x, z) + 1.3, z], off: 0 }); } }
    kart = { boxes, objs: [], seq: 0, a: 0 };
    for (const c of [...humans.map(h => h.car), ...rivals.map(r => r.car)]) { c.kItem = null; c.kSpin = 0; c.kHold = 0; c.kImm = 0; }
  }
  const kAll = () => [...humans.map(h => ({ car: h.car, race: h.race, h })), ...rivals];
  function kRoll(c) {
    const rank = order.findIndex(o => o.car === c), n = Math.max(2, order.length), f = rank < 0 ? 0.5 : rank / (n - 1);
    // justo: el primero nunca recibe misil buscador ni turbo; los de delante, sobre todo defensas (aceite, bomba, rayo); los de atrás, ataque y turbo
    const W = { oil: 3 * (1 - f) + 1, bomb: 2 * (1 - f) + 0.6, rayo: 1.6 * (1 - f) + 0.6, mg: 1.5 + f, mr: rank === 0 ? 0 : 0.3 + 3.2 * f * f, turbo: rank === 0 ? 0 : 0.3 + 3.2 * f }; let r = Math.random() * Object.values(W).reduce((a, b) => a + b, 0);
    for (const k in W) { r -= W[k]; if (r <= 0) return k; } return 'mg';
  }
  // los objetos se lanzan con un evento (también por la red); cada coche comprueba los golpes que recibe él
  function kSpawn(type, owner, p, d, id) {
    const o = { id: id || (czIdSafe(owner) + ':' + (kart.seq++)), type, owner, p: p.slice(), d: d.slice(), t: 0, live: type === 'oil' ? 30 : type === 'bomb' ? 40 : type === 'mg' ? 4 : 7 };
    if (type === 'mr') o.target = kTarget(owner); kart.objs.push(o); return o;
  }
  const czIdSafe = c => netRace ? czId(c) || 'x' : String(kAll().findIndex(o => o.car === c));
  const kById = id => { if (netRace) { const o = czObj(id); return o && o.car; } const o = kAll()[+id]; return o && o.car; };
  function kTarget(owner) { const i = order.findIndex(o => o.car === owner); for (let k = i - 1; k >= 0; k--) if (!order[k].car.out) return order[k].car;
    let best = null, bd = 1e18; const f = owner.forward(); for (const o of order) { const c = o.car; if (c === owner) continue; const d = V.sub(c.p, owner.p); if (V.dot(d, f) < 0) continue; const l = V.dot(d, d); if (l < bd) { bd = l; best = c; } } return best; }
  function kUse(c) {
    const it = c.kItem; if (!it || !kart) return; c.kItem = null; const f0 = c.forward(), f = V.norm([f0[0], 0, f0[2]]);
    if (it === 'turbo') { c.nitroT = Math.max(c.nitroT || 0, 2.4); nitroFx(c); if (audio && audio.ctx) audio.play('SAMPLES/BEEP4.WAV', { vol: 0.5 }); return; }
    if (it === 'rayo') { c.kZap = 6; c.kZapped = new Set(); if (audio && audio.ctx) audio.play('SAMPLES/BEEP4.WAV', { vol: 0.6, pos: c.isPlayer ? null : c.p }); if (netRace) BRR_net.game({ k: 'kt', id: czIdSafe(c) + ':z' + (kart.seq++), ty: 'rayo', o: czId(c), p: R3(c.p), d: [0, 0, 0], sp: 0 }); return; }
    const back = it === 'oil' || it === 'bomb', p = V.add(c.p, V.mul(f, back ? -3.5 : 3)); p[1] = groundY(p[0], p[2]) + (back ? 0 : 0.7);
    const o = kSpawn(it, c, p, it === 'mg' || it === 'mr' ? f : [0, 0, 0]); o.sp = it === 'mg' ? Math.max(0, c.speed()) + 42 : it === 'mr' ? Math.max(0, c.speed()) + 32 : 0;
    if (netRace) BRR_net.game({ k: 'kt', id: o.id, ty: it, o: czId(c), p: R3(o.p), d: R3(o.d), sp: o.sp, tg: o.target ? czId(o.target) : null });
    if (audio && audio.ctx) audio.play(back ? 'GEN/SIGN.WAV' : 'SAMPLES/BEEP4.WAV', { vol: 0.6, pos: c.isPlayer ? null : c.p });
  }
  function kHit(c, kind) {   // efecto en el coche que recibe: trompo (aceite) o salto por los aires (misil, bomba)
    if (c.kImm > 0) return; c.kImm = 1.6;
    const h = humans.find(x => x.car === c);
    if (kind === 'oil') { c.kSpin = 1.3; c.v = V.mul(c.v, 0.7); if (h) flash(h, '¡Aceite!', 1.2, 'warn'); }
    else { c.kSpin = 1.5; c.v = [c.v[0] * 0.25, 7.5, c.v[2] * 0.25]; c.w = V.add(c.w, BRR.mv(c.R, [(Math.random() - .5) * 4, 3, 5])); crazyBoom(c); if (h) flash(h, kind === 'bomb' ? '¡Bomba!' : '¡Misil!', 1.2, 'warn'); }
  }
  function kartFrame(dt) {
    if (!kart || state !== 'race') return; kart.a += dt * 2;
    const all = kAll(), racing = humans[0].race.phase === 'race', host = !netRace || netRace.role === 'host';
    for (const o of all) { const c = o.car; c.kImm = Math.max(0, (c.kImm || 0) - dt);
      if (c.kSpin > 0) { c.kSpin -= dt; const up = BRR.mv(c.R, [0, 1, 0]); c.w = V.add(V.sub(c.w, V.mul(up, V.dot(c.w, up))), V.mul(up, 9)); c.v = V.mul(c.v, 1 - Math.min(0.9, dt * 1.2)); } }
    if (!racing) return;
    // rayo: durante 6 s, a quien se acerque (menos de 9 m) le cae una descarga que lo frena
    for (const o of all) { const c = o.car; if (!(c.kZap > 0)) continue; c.kZap -= dt; if (Math.random() < dt * 14) fx.glow(V.add(c.p, [(Math.random() - .5) * 2.4, 0.6 + Math.random(), (Math.random() - .5) * 2.4]), [0.55, 0.75, 1, 0.9], 0.35);
      for (const q of all) { const v = q.car; if (v === c || v.out || c.kZapped.has(v) || V.len(V.sub(v.p, c.p)) > 9) continue; c.kZapped.add(v);
        for (let i = 0; i <= 8; i++) { const u = i / 8, p = V.add(V.add(c.p, V.mul(V.sub(v.p, c.p), u)), [(Math.random() - .5) * 0.8, 1 + Math.sin(u * 3.1) * 0.8, (Math.random() - .5) * 0.8]); fx.glow(p, [0.7, 0.85, 1, 1], 0.28); }
        if (!q.remote) { v.v = V.mul(v.v, 0.45); v.kSpin = Math.max(v.kSpin || 0, 0.5); } fx.sparks(V.add(v.p, [0, 1, 0]), 16); if (q.h) flash(q.h, '¡Rayo!', 1.2, 'warn'); } }
    // la IA salta para esquivar misiles que le vienen y manchas o bombas que tiene delante
    if (host) for (const r of rivals) { const c = r.car; if (!r.ai || c.out || c.kSpin > 0) continue; const fw = c.forward();
      for (const o of kart.objs) { if (o.owner === c) continue; const d = V.sub(o.p, c.p), l = V.len(d);
        const danger = (o.type === 'mg' || o.type === 'mr') ? l < 14 && V.dot(o.d, V.mul(d, -1 / Math.max(1, l))) > 0.6 : l < 9 && V.dot(d, fw) > l * 0.8;
        if (danger && Math.random() < 0.5) { aiJump(c); break; } } }
    // cajas: se recogen pasando por encima y vuelven a los 4 s (cada uno comprueba las suyas: humanos, y la IA en el anfitrión)
    for (const b of kart.boxes) { if (b.off > 0) { b.off -= dt; continue; }
      for (const o of all) { const c = o.car; if (o.remote || c.out || c.kItem) continue; const dx = c.p[0] - b.p[0], dz = c.p[2] - b.p[2];
        if (dx * dx + dz * dz < 6.5 && Math.abs(c.p[1] - b.p[1]) < 3.5) { b.off = 4; c.kItem = kRoll(c); c.kHold = 0.8 + Math.random() * 3; fx.sparks(b.p, 14);
          if (o.h) { flash(o.h, KITEMS[c.kItem].n, 1.5, 'stunt'); if (audio && audio.ctx) audio.play('SAMPLES/BEEP3.WAV', { vol: 0.6 }); } break; } } }
    // la IA (en el anfitrión): usa lo que tiene cuando le conviene
    if (host) for (const r of rivals) { const c = r.car; if (!r.ai || !c.kItem || c.kSpin > 0) continue; c.kHold -= dt; if (c.kHold > 0) continue;
      const it = c.kItem, f = c.forward(); let go = false;
      if (it === 'turbo') go = Math.abs(r.inp ? r.inp.steer : 0) < 0.2;
      else if (it === 'rayo') go = order.some(o => o.car !== c && !o.car.out && V.len(V.sub(o.car.p, c.p)) < 12);
      else if (it === 'mr') go = !!kTarget(c);
      else if (it === 'mg') go = order.some(o => o.car !== c && !o.car.out && (() => { const d = V.sub(o.car.p, c.p), l = V.len(d); return l < 70 && V.dot(d, f) > l * 0.95; })());
      else go = order.some(o => o.car !== c && !o.car.out && (() => { const d = V.sub(o.car.p, c.p), l = V.len(d); return l < 40 && V.dot(d, f) < -l * 0.7; })()) || c.kHold < -8;
      if (go) kUse(c); else c.kHold = 0.4; }
    // objetos en el suelo y misiles
    const mine = o => !o.remote && (!netRace || o.h || host);   // de quién comprueba los golpes este ordenador
    for (let i = kart.objs.length - 1; i >= 0; i--) { const o = kart.objs[i]; o.t += dt; let dead = o.t > o.live;
      if (o.type === 'mg' || o.type === 'mr') {
        if (o.type === 'mr' && o.target && !o.target.out) { const want = V.norm([o.target.p[0] - o.p[0], 0, o.target.p[2] - o.p[2]]), k = Math.min(1, dt * 3.5); o.d = V.norm(V.add(V.mul(o.d, 1 - k), V.mul(want, k))); }
        const step = o.sp * dt, eye = [o.p[0], o.p[1] + 0.2, o.p[2]];
        if (o.type === 'mg' && BRR.objRay(lvl, eye, o.d, step + 0.8) < step + 0.8) dead = true;   // el recto choca con las paredes
        o.p = [o.p[0] + o.d[0] * step, 0, o.p[2] + o.d[2] * step]; o.p[1] = groundY(o.p[0], o.p[2]) + 0.7;
        if (Math.random() < dt * 30) fx.puff(V.sub(o.p, V.mul(o.d, 1.2)), [0, 0.6, 0], o.type === 'mg' ? [0.6, 1, 0.6, 0.5] : [1, 0.6, 0.5, 0.5], 0.35, 0.6, 2, 1, 0.2);
        fx.glow(V.sub(o.p, V.mul(o.d, 1.1)), o.type === 'mg' ? [0.4, 1, 0.4, 1] : [1, 0.35, 0.25, 1], 0.6);
      }
      if (o.type === 'bomb') fx.glow(V.add(o.p, [0, 1.15, 0]), (kart.a * 2 | 0) % 2 ? [1, 0.2, 0.1, 1] : [1, 0.2, 0.1, 0.25], 0.35);
      if (!dead) for (const q of all) { const c = q.car; if (c.out || !mine(q)) continue; if (c === o.owner && o.t < (o.type === 'oil' || o.type === 'bomb' ? 1.2 : 0.5)) continue;
        const dx = c.p[0] - o.p[0], dz = c.p[2] - o.p[2], R2 = o.type === 'oil' ? 4.8 : 5.5; if (dx * dx + dz * dz > R2 || Math.abs(c.p[1] - o.p[1]) > 3) continue;
        kHit(c, o.type === 'oil' ? 'oil' : o.type === 'bomb' ? 'bomb' : 'mis'); dead = true; if ((o.type === 'mg' || o.type === 'mr') && humans[0] && o.owner === humans[0].car && c !== o.owner) achCount('misiles', 10, 'm_misil'); if (netRace) BRR_net.game({ k: 'ktx', id: o.id, v: czId(c), ty: o.type }); break; }
      if (dead) { if (o.type !== 'oil' && o.t <= o.live) fx.sparks(o.p, 20); kart.objs.splice(i, 1); }
    }
  }
  function kartNet(from, d) {   // objetos de los demás y golpes que han recibido
    if (!kart) return;
    if (d.k === 'kt' && d.ty === 'rayo') { const own = kById(d.o); if (own) { own.kZap = 6; own.kZapped = new Set(); } return; }
    if (d.k === 'kt' && KITEMS[d.ty] && Array.isArray(d.p) && Array.isArray(d.d)) { if (kart.objs.some(o => o.id === d.id)) return; const own = kById(d.o); if (!own) return;
      const o = kSpawn(d.ty, own, d.p.map(Number), d.d.map(Number), String(d.id)); o.sp = +d.sp || 0; if (d.tg) o.target = kById(d.tg) || o.target; return; }
    if (d.k === 'ktx') { const i = kart.objs.findIndex(o => o.id === d.id); if (i >= 0) { fx.sparks(kart.objs[i].p, 20); kart.objs.splice(i, 1); }
      const v = kById(d.v); if (v && !v.isPlayer && d.ty !== 'oil') crazyBoom(v); }
  }
  function kartDraw() {
    if (!kart) return; const M = kMesh, a = kart.a;
    const rot = ang => [[Math.cos(ang), 0, Math.sin(ang)], [0, 1, 0], [-Math.sin(ang), 0, Math.cos(ang)]];
    for (const b of kart.boxes) if (b.off <= 0) R.draw(M.box, BRR.M4.fromRT(rot(a + b.p[0] * 0.1), [b.p[0], b.p[1] + Math.sin(a * 1.3 + b.p[2]) * 0.2, b.p[2]]));
    for (const o of kart.objs) { if (o.type === 'oil' || o.type === 'bomb') { R.draw(M[o.type], BRR.M4.fromRT(BRR.M3I || (BRR.M3I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]), o.p)); continue; }
      const d = o.d, rt = [-d[2], 0, d[0]], Rm = [[rt[0], 0, -d[0]], [rt[1], 1, -d[1]], [rt[2], 0, -d[2]]]; R.draw(M[o.type], BRR.M4.fromRT(Rm, o.p)); }
  }
  function kartHud(h) {   // el objeto que llevas (arriba en el centro)
    let el = h.kEl; if (!el) { el = h.kEl = document.createElement('div'); el.className = 'kitem'; h.hud.appendChild(el); }
    const it = kart && h.car.kItem; const on = !!kart; el.hidden = !on; if (!on) return;
    const k = it || ''; if (el.dataset.k !== k) { el.dataset.k = k; el.innerHTML = it ? `<b>${KITEMS[it].e}</b><span>${KITEMS[it].n}</span><small>V / ↑</small>` : '<b style="opacity:.35">?</b>'; }
  }

  // ---------- fantasmas en contrarreloj: tu mejor vuelta (azul) y la del récord online (dorado) ----------
  // tu vuelta se graba (20 muestras por segundo) y, si mejora la guardada, se queda como tu fantasma (y se sube a la nube para los demás)
  let ghosts = [];   // [{ t, veh, f: Float32Array [t, x,y,z, qx,qy,qz,qw]..., car, draw, dd, mine, name }]
  const ghostKey = (lv, veh) => 'ghost_' + lv + '_' + veh;
  const ghostMine = () => ghosts.find(g => g.mine);
  async function ghostCar(veh) {   // coche del fantasma: el tuyo o, si es otro vehículo, cargado aparte
    const h = humans[0]; if (veh === h.car.def.name) { const c = new BRR.Car(h.car.def, lvl); c.headDraw = h.car.headDraw; return { car: c, draw: h.draw, dd: carDraw }; }
    const d = await BRR.loadVehicle(files, veh, lvl, 1); const c = new BRR.Car(d, lvl); return { car: c, draw: R.upload(d.mesh), dd: { body: null, ...vehDraw(d) } };
  }
  async function ghostLoad() {
    ghosts = []; const mode = opt.ghost || 'ambos'; if (!ttMode || !humans[0] || mode === 'no') return; const veh = humans[0].car.def.name, id = lvl.name;
    if (mode === 'si' || mode === 'ambos') { try { const g = await idbGet(ghostKey(id, veh)); if (g && g.f && g.f.length >= 16) ghosts.push({ ...g, ...(await ghostCar(veh)), i: 0, mine: true }); } catch (e) { } }
    if ((mode === 'record' || mode === 'ambos') && BRR.cloud) {   // el del primero de la clasificación online (si no eres tú)
      (async () => { try { const L = await BRR.cloud.lbGet(id), top = (L.rows || [])[0]; if (!top || !top.pid || top.pid === BRR.cloud.id || !files.has((top.veh || '') + '.VHC')) return;
        const g = await BRR.cloud.ghostGet(id, top.veh, top.pid); if (!g || lvl.name !== id || !ttMode) return;
        ghosts.push({ ...g, ...(await ghostCar(g.veh)), i: 0, mine: false, name: top.name }); for (const h of humans) flash(h, 'Fantasma del récord: ' + (top.name || 'Piloto') + ' · ' + fmt(g.t), 3, 'stunt'); } catch (e) { } })();
    }
  }
  function ghostRecord(h) {   // después de la lógica de carrera de ese fotograma
    if (!ttMode || h !== humans[0]) return; const rc = h.race; if (rc.phase !== 'race') return;
    const t = rc.t - rc.lapStart, Rr = h.gRec || (h.gRec = []); if (Rr.length && t - Rr[Rr.length - 8] < 0.05) return; const c = h.car;
    Rr.push(t, c.p[0], c.p[1], c.p[2], c.q[0], c.q[1], c.q[2], c.q[3]);
  }
  async function ghostLap(h, lapTime) {   // al cerrar una vuelta: ¿mejor que tu fantasma?
    if (!ttMode || h !== humans[0]) return; const Rr = h.gRec || []; h.gRec = [];
    const c = h.car; Rr.push(lapTime, c.p[0], c.p[1], c.p[2], c.q[0], c.q[1], c.q[2], c.q[3]);
    const mine = ghostMine() || { t: (await idbGet(ghostKey(lvl.name, c.def.name)).catch(() => null) || {}).t };
    const ref = ghosts.find(g => !g.mine) || mine; if (ref && ref.t) { const d = lapTime - ref.t; setTimeout(() => flash(h, (d < 0 ? '−' : '+') + Math.abs(d).toFixed(2) + ' s · ' + (ref.mine === false ? 'récord' : 'fantasma'), 2.2, d < 0 ? 'stunt' : ''), 1600); }
    if (Rr.length < 16 || Rr[0] > 1 || (mine && mine.t && lapTime >= mine.t)) return;
    const g = { t: lapTime, veh: c.def.name, lvl: lvl.name, f: new Float32Array(Rr), date: Date.now() };
    try { await idbSet(ghostKey(lvl.name, c.def.name), g); } catch (e) { }
    try { if (BRR.cloud) BRR.cloud.ghostPut(lvl.name, c.def.name, { ...g, name: opt.netName || 'Piloto' }); } catch (e) { }
    if (opt.ghost === 'no' || opt.ghost === 'record') return;
    const old = ghostMine(); ghosts = ghosts.filter(x => !x.mine); ghosts.push({ ...g, ...(old ? { car: old.car, draw: old.draw, dd: old.dd } : await ghostCar(c.def.name)), i: 0, mine: true });
  }
  function ghostFrame() {   // coloca cada fantasma en el tiempo de la vuelta actual
    if (!ghosts.length || !humans[0]) return; const rc = humans[0].race, t = rc.phase === 'race' ? rc.t - rc.lapStart : 0;
    for (const g of ghosts) { const F = g.f, n = F.length / 8; g.show = rc.phase !== 'finished' && t <= g.t + 0.3; if (!g.show) continue;
      let i = Math.min(g.i, n - 2); if (F[i * 8] > t) i = 0; while (i < n - 2 && F[(i + 1) * 8] < t) i++; g.i = i;
      const a = i * 8, b = a + 8, u = Math.max(0, Math.min(1, (t - F[a]) / Math.max(1e-3, F[b] - F[a]))), c = g.car;
      const p0 = c.p ? c.p.slice() : null; c.p = [0, 1, 2].map(k => F[a + 1 + k] + (F[b + 1 + k] - F[a + 1 + k]) * u);
      let q = [0, 1, 2, 3].map(k => F[a + 4 + k]), qb = [0, 1, 2, 3].map(k => F[b + 4 + k]); if (q[0] * qb[0] + q[1] * qb[1] + q[2] * qb[2] + q[3] * qb[3] < 0) qb = qb.map(x => -x);
      q = q.map((x, k) => x + (qb[k] - x) * u); const l = Math.hypot(...q) || 1; c.q = q.map(x => x / l);
      const sp = p0 ? Math.hypot(c.p[0] - p0[0], c.p[2] - p0[2]) : 0; for (const w of c.W) { w.spin += sp / (w.radius || 0.3); w.len = 0.3; } c.v = [0, 0, 0]; }
  }
  function ghostDraw(h) {
    if (!ghosts.length || h !== humans[0]) return;
    for (const g of ghosts) { if (!g.show) continue; const c = g.car; if (V.len(V.sub(c.p, h.cam.pos)) < 2.5) continue;   // no tapar la cámara
      const raw = R.draw, a = g.mine ? 0.5 : 1.5; R.draw = (b, W) => R.drawGhost(b, W, a);   // >1: dorado (el récord)
      try { drawCar(c, g.draw, false, g.dd); } finally { R.draw = raw; } }
  }

  // ---------- repeticiones: se graba la carrera (20 veces por segundo, todos los coches) y al acabar se puede ver con cualquier cámara,
  // a cámara lenta o rápida, rebobinar y grabarla en vídeo (.webm) ----------
  let rpRec = null, rp = null;
  const RP_N = 11;   // por coche: posición (3), giro (4), dirección, nitro|freno|fuera, velocidad, ruedas
  function rpStart() { if (rpLoad) return; rpRec = { cars: [...humans.map(h => h.car), ...rivals.map(r => r.car)], frames: [], t: 0, next: 0, info: rpInfo() }; }
  // ---------- repeticiones guardadas (IndexedDB): coches (vehículo, equipo, pintura, logo, garaje, nombre) + fotogramas ----------
  let rpLoad = null;
  const rpKindName = k => ({ carrera: 'Carrera', tt: 'Contrarreloj', camp: 'Campeonato', online: 'Online', reto: 'Reto semanal' })[k] || CRAZY_LBL(k) || k;
  const CRAZY_LBL = k => ({ elim_cp: 'Eliminación', bomba: 'Bomba', zombie: 'Zombi', polis: 'Polis y cacos', kart: 'Kart' })[k] || '';
  function rpInfo() {
    const nm = c => { const h = humans.find(x => x.car === c); if (h) return { name: humans.length > 1 ? NAMES[h.i] : (opt.netName || 'Tú'), logo: h.i === 0 ? myLogo() : null, tname: c.teamName || null };
      const r = rivals.find(x => x.car === c) || {}, lk = r.lk || {}; return { name: r.name && !r.isAI ? r.name : c.teamName || (r.ai ? r.ai.P.name : 'Equipo ' + TEAM[c.team].n), logo: lk.logo != null ? lk.logo : null, tname: c.teamName || null }; };
    const cars = [...humans.map(h => h.car), ...rivals.map(r => r.car)].map(c => ({ veh: c.def.name, team: c.team, paint: c.paintHex || null, gar: c.gar || null, ...nm(c) }));
    const kind = netRace ? 'online' : crazyR() ? crazy.mode : ttMode ? 'tt' : tourMode ? 'camp' : reto ? 'reto' : 'carrera';
    return { level: lvl.name, laps: humans[0] ? humans[0].race.laps : 1, kind, cars };
  }
  async function rpList() { return (await idbGet('rp_list')) || []; }
  async function rpSave() {
    if (!rpRec || rpRec.frames.length < 10 || rpRec.savedId) return rpRec && rpRec.savedId; const F = rpRec.frames, st = F[0].length, all = new Float32Array(F.length * st); F.forEach((f, i) => all.set(f, i * st));
    const id = Date.now().toString(36), info = rpRec.info || rpInfo(), h0 = humans[0], pos = h0 ? Math.max(1, order.findIndex(o => o.h === h0) + 1) : 0;
    const rec = { v: 1, id, date: Date.now(), ...info, stride: st, n: F.length, frames: all, dur: F[F.length - 1][0] - F[0][0], pos, time: h0 && h0.race.finishT != null ? h0.race.finishT : null };
    await idbSet('rp_' + id, rec); let L = await rpList(); L.unshift({ id, date: rec.date, level: rec.level, kind: rec.kind, laps: rec.laps, n: rec.cars.length, dur: rec.dur, pos, time: rec.time, veh: rec.cars[0] && rec.cars[0].veh, size: all.byteLength });
    while (L.length > 40) { const old = L.pop(); try { await idbSet('rp_' + old.id, null); } catch (e) { } }
    await idbSet('rp_list', L); rpRec.savedId = id; return id;
  }
  async function rpWatch(id, rec) {
    rec = rec || await idbGet('rp_' + id); if (!rec || !rec.frames || !rec.cars) return; $('rplist').hidden = true;
    const st = rec.stride, F = []; for (let i = 0; i < rec.n; i++) F.push(rec.frames.subarray(i * st, (i + 1) * st));
    rpLoad = rec; ttMode = false; freeMode = false; tourMode = false;
    try { await startRace(rec.level, rec.cars[0].veh, rec.cars[0].team || 1, rec.laps, 1, null); } finally { rpLoad = null; }
    if (state !== 'race') return; if (audio) audio.stopMusic();
    rpRec = { cars: rivals.map(r => r.car), frames: F, names: rec.cars.map(c => c.name), saved: true, savedId: rec.id, info: rec }; humans[0].car.out = true; $('help').hidden = true; rpOpen();
  }
  const rpB64 = u8 => { let s2 = ''; for (let i = 0; i < u8.length; i += 0x8000) s2 += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s2); };
  async function rpExport(id) { const rec = await idbGet('rp_' + id); if (!rec) return;
    const j = JSON.stringify({ ...rec, frames: rpB64(new Uint8Array(rec.frames.buffer, rec.frames.byteOffset, rec.frames.byteLength)), brr: 'replay' }), a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([j], { type: 'application/json' })); a.download = 'BigRedReport_' + rec.level + '_' + new Date(rec.date).toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.brrrep'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  async function rpImport(file) {
    const j = JSON.parse(await file.text()); if (j.brr !== 'replay' || !j.frames || !Array.isArray(j.cars) || !j.level) throw new Error('No es una repetición de Big Red Report');
    const b = atob(j.frames), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    const rec = { ...j, frames: new Float32Array(u.buffer), id: Date.now().toString(36) }; delete rec.brr; if (rec.frames.length < rec.stride * rec.n) throw new Error('Repetición incompleta');
    rec.cars = rec.cars.slice(0, 16).map(c => ({ veh: String(c.veh || '').replace(/[^A-Z0-9_]/gi, '').slice(0, 12), team: Math.max(1, Math.min(6, c.team | 0)), paint: /^#[0-9a-f]{6}$/i.test(c.paint || '') ? c.paint : null, gar: c.gar && typeof c.gar === 'object' ? c.gar : null, logo: typeof c.logo === 'number' || typeof c.logo === 'string' ? c.logo : null, name: String(c.name || '').slice(0, 24), tname: c.tname ? String(c.tname).slice(0, 24) : null }));
    await idbSet('rp_' + rec.id, rec); const L = await rpList(); L.unshift({ id: rec.id, date: rec.date || Date.now(), level: rec.level, kind: rec.kind, laps: rec.laps, n: rec.cars.length, dur: rec.dur, pos: rec.pos, time: rec.time, veh: rec.cars[0] && rec.cars[0].veh, size: rec.frames.byteLength, imported: 1 }); await idbSet('rp_list', L.slice(0, 60));
  }
  async function rpRenderList() {
    const L = await rpList(), el = $('rpl_body');
    if (!L.length) { el.innerHTML = '<p class="small">Aún no has guardado ninguna. Al terminar una carrera pulsa «💾 Guardar repetición».</p>'; return; }
    el.innerHTML = L.map(r => `<div class="rpl" data-id="${esc(r.id)}"><div><b>${esc((LEVEL_NAMES[String(r.level).replace(/\d+$/, '')] || '') + ' ' + String(r.level).replace(/^\D+/, ''))}</b> <span class="small">(${esc(r.level)})</span> · ${esc(rpKindName(r.kind))}${r.pos ? ' · ' + r.pos + 'º' : ''}<br><span class="small">${new Date(r.date).toLocaleString()} · ${esc(VEH_NAMES[r.veh] || r.veh || '')} · ${r.n} coches · ${fmt(r.dur || 0)}${r.time ? ' · ' + fmt(r.time) : ''}</span></div>
      <div class="rplb"><button data-a="ver" class="main">▶ Ver</button><button data-a="exp" title="Exportar archivo">⬇</button><button data-a="del" title="Borrar">🗑</button></div></div>`).join('');
    for (const b of el.querySelectorAll('button')) b.onclick = async () => { const id = b.closest('.rpl').dataset.id, a = b.dataset.a;
      if (a === 'ver') rpWatch(id); else if (a === 'exp') rpExport(id);
      else if (a === 'del') { if (b.dataset.sure) { await idbSet('rp_' + id, null); await idbSet('rp_list', (await rpList()).filter(x => x.id !== id)); rpRenderList(); } else { b.dataset.sure = 1; b.textContent = '¿Borrar?'; } } };
  }
  function rpRecord(dt) {
    if (!rpRec || netWait || photo) return; if (!humans[0] || humans[0].race.phase === 'countdown') return;
    rpRec.t += dt; if (rpRec.t < rpRec.next || rpRec.frames.length > 20 * 60 * 15) return; rpRec.next = rpRec.t + 0.05;
    const C = rpRec.cars, F = new Float32Array(1 + C.length * RP_N); F[0] = rpRec.t;
    C.forEach((c, k) => { const o = 1 + k * RP_N; F.set([c.p[0], c.p[1], c.p[2], c.q[0], c.q[1], c.q[2], c.q[3], c.steerAng || 0, (c.nitroT > 0 ? 1 : 0) | (c.brakeLight ? 2 : 0) | (c.out ? 4 : 0), c.speed ? c.speed() : 0, c.W && c.W[0] ? c.W[0].len : 0.3], o); });
    rpRec.frames.push(F);
  }
  function rpOpen() {
    if (!rpRec || rpRec.frames.length < 10) return; $('results').hidden = true; for (const h of humans) if (h.horn) { h.horn.stop(); h.horn = null; }
    rp = { t: rpRec.frames[0][0], t0: rpRec.frames[0][0], t1: rpRec.frames[rpRec.frames.length - 1][0], i: 0, speed: 1, play: true, target: 0, cam: 'tv', rec: null,
      save: rpRec.cars.map(c => ({ p: c.p.slice(), q: c.q.slice(), v: c.v.slice(), w: c.w.slice(), out: c.out })) };
    state = 'replay'; $('phuds').style.visibility = 'hidden'; $('replaybar').hidden = false; { const b = $('rp_save'); b.hidden = !!rpRec.saved; b.disabled = !!rpRec.savedId; b.textContent = rpRec.savedId ? '✓' : '💾'; } rpUI(); last = performance.now();
  }
  function rpClose() {
    if (!rp) return; if (rp.rec) rpVideoStop();
    rpRec.cars.forEach((c, k) => { const s0 = rp.save[k]; c.p = s0.p; c.q = s0.q; c.v = s0.v; c.w = s0.w; c.out = s0.out; });
    if (rpRec.saved) { rp = null; $('replaybar').hidden = true; $('phuds').style.visibility = ''; rpRec = null; toMenu(); setTimeout(() => { $('rplist').hidden = false; rpRenderList(); }, 60); return; }
    rp = null; $('replaybar').hidden = true; $('phuds').style.visibility = ''; state = 'results'; $('results').hidden = false; humans[0].cam.init = false;
  }
  function rpFrame(dt) {
    const F = rpRec.frames, n = F.length; if (rp.play) { rp.t += dt * rp.speed; if (rp.t >= rp.t1) { rp.t = rp.t1; rp.play = false; if (rp.rec) rpVideoStop(); rpUI(); } }
    let i = Math.min(rp.i, n - 2); if (F[i][0] > rp.t) i = 0; while (i < n - 2 && F[i + 1][0] < rp.t) i++; rp.i = i;
    const A = F[i], B = F[i + 1], u = Math.max(0, Math.min(1, (rp.t - A[0]) / Math.max(1e-3, B[0] - A[0])));
    rpRec.cars.forEach((c, k) => { const o = 1 + k * RP_N, L = j => A[o + j] + (B[o + j] - A[o + j]) * u;
      const p0 = c.p; c.p = [L(0), L(1), L(2)]; let qa = [0, 1, 2, 3].map(j => A[o + 3 + j]), qb = [0, 1, 2, 3].map(j => B[o + 3 + j]); if (qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3] < 0) qb = qb.map(x => -x);
      const q = qa.map((x, j) => x + (qb[j] - x) * u), l = Math.hypot(...q) || 1; c.q = q.map(x => x / l); c.steerAng = L(7);
      const fl = A[o + 8] | 0; if (fl & 1 && !(c.nitroT > 0) && rp.play && rp.speed > 0 && rp.speed <= 2) nitroFx(c); c.nitroT = fl & 1 ? 0.1 : 0; c.brakeLight = !!(fl & 2); c.out = !!(fl & 4); c.v = V.mul(c.forward(), L(9));
      const sp = Math.hypot(c.p[0] - p0[0], c.p[2] - p0[2]) * Math.sign(L(9) || 1); for (const w of c.W) { w.spin += sp / (w.radius || 0.3); w.len = L(10) || 0.3; } });
    for (const c of rpRec.cars) if (c.boostT > 0) c.boostT -= dt;
    for (const c of rpRec.cars) if (c.nitroT > 0 && !c.out) { const tc = c._tint || (c._tint = (hexRGB(carCol(c)) || [255, 140, 30]).map(x => x / 255)); fx.flame(V.add(c.p, BRR.mv(c.R, c.def.nitro || [0, 0.4, c.def.box.c[2] + c.def.box.h[2]])), V.mul(c.forward(), -4), c.v, tc, (c.boostT || 0) > 0 ? 1.7 : 1.2); }
    rpRec.cars.forEach((c, k) => fx.car(c, dt * (rp.play ? rp.speed : 0), 'rp' + k)); fx.update(dt * (rp.play ? rp.speed : 0));
    $('rp_time').value = String(Math.round((rp.t - rp.t0) / Math.max(0.01, rp.t1 - rp.t0) * 1000)); $('rp_clock').textContent = fmt(rp.t - rp.t0);
  }
  function rpCamera(dt) {   // la cámara sigue al coche elegido (con la del modo elegido; por defecto, las de televisión del original)
    const h = humans[0], c = rpRec.cars[rp.target] || h.car, fh = { i: 1, car: c, cam: h.cam, camMode: rp.cam, inp: {}, race: h.race };
    updateCamera(fh, dt * Math.max(0.25, rp.play ? rp.speed : 1));
  }
  const RP_CAMS = ['tv', 'cerca', 'lejos', 'alta', 'cenital', 'capo'];
  function rpUI() {
    if (!rp) return; $('rp_play').textContent = rp.play ? '⏸' : '▶'; $('rp_speed').textContent = (rp.speed < 1 ? '½' : rp.speed) + '×';
    $('rp_cam').textContent = '🎥 ' + (CAM_N[rp.cam] || rp.cam); const c = rpRec.cars[rp.target], hh = humans.find(x => x.car === c), r = rivals.find(x => x.car === c);
    $('rp_car').textContent = rpRec.names ? rpRec.names[rp.target] || '' : hh ? (humans.length > 1 ? NAMES[hh.i] : 'Tú') : r ? (r.name && !r.isAI ? r.name : c.teamName || (r.ai ? r.ai.P.name : 'Equipo ' + TEAM[c.team].n)) : '';
    $('rp_rec').textContent = rp.rec ? '⏹ Parar vídeo' : '⏺ Grabar vídeo'; $('rp_rec').classList.toggle('on', !!rp.rec);
  }
  function rpSeek(d) { rp.t = Math.max(rp.t0, Math.min(rp.t1, rp.t + d)); rp.i = 0; if (fx) fx.reset(); humans[0].cam.init = false; }
  function rpVideoStart() {   // vídeo de lo que se ve (desde donde está la repetición hasta el final o hasta que se pare)
    try { const st = canvas.captureStream(30); try { if (audio && audio.ctx && audio.gMaster) { const d = audio.ctx.createMediaStreamDestination(); audio.gMaster.connect(d); d.stream.getAudioTracks().forEach(t => st.addTrack(t)); rp.aDest = d; } } catch (e) { }
      const mt = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)); if (!mt) throw new Error('Este navegador no puede grabar vídeo');
      const mr = new MediaRecorder(st, { mimeType: mt, videoBitsPerSecond: 8e6 }), chunks = []; mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = () => { const b = new Blob(chunks, { type: 'video/webm' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'BigRedReport_' + lvl.name + '_' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.webm'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); };
      mr.start(500); rp.rec = mr; rp.play = true; if (rp.t >= rp.t1 - 0.1) rpSeek(-1e9); } catch (e) { $('rp_clock').textContent = e.message; }
    rpUI();
  }
  function rpVideoStop() { const mr = rp && rp.rec; if (!mr) return; rp.rec = null; try { mr.stop(); } catch (e) { } try { if (rp.aDest && audio.gMaster) audio.gMaster.disconnect(rp.aDest); } catch (e) { } rpUI(); }
  (function rplSetup() {
    $('rpl_close').onclick = () => { $('rplist').hidden = true; };
    $('rpl_imp').onclick = () => $('rpl_file').click();
    $('rpl_file').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { await rpImport(f); rpRenderList(); } catch (x) { $('rpl_body').insertAdjacentHTML('afterbegin', '<p class="small" style="color:#ff6a5a">' + esc(x.message || x) + '</p>'); } };
    $('r_rpsave').onclick = async () => { const b = $('r_rpsave'); b.disabled = true; try { await rpSave(); b.textContent = '✓ Repetición guardada'; } catch (x) { b.disabled = false; b.textContent = 'No se ha podido guardar'; } };
  })();
  (function rpSetup() {
    const bar = document.createElement('div'); bar.id = 'replaybar'; bar.hidden = true;
    bar.innerHTML = `<div class="rpt"><b>REPETICIÓN</b> <span id="rp_clock">0:00.00</span></div><input type="range" id="rp_time" min="0" max="1000" value="0">
      <div class="rpb"><button id="rp_back" title="Atrás 10 s">⏪</button><button id="rp_play">⏸</button><button id="rp_fwd" title="Adelante 10 s">⏩</button><button id="rp_speed">1×</button>
      <button id="rp_prev" title="Coche anterior">◀</button><span id="rp_car"></span><button id="rp_next" title="Coche siguiente">▶</button><button id="rp_cam"></button><button id="rp_rec"></button><button id="rp_save" title="Guardar repetición">💾</button><button id="rp_exit">✕ Salir</button></div>`;
    document.body.appendChild(bar);
    const $b = id => bar.querySelector('#' + id);
    $b('rp_play').onclick = () => { rp.play = !rp.play; if (rp.play && rp.t >= rp.t1) rpSeek(-1e9); rpUI(); };
    $b('rp_back').onclick = () => rpSeek(-10); $b('rp_fwd').onclick = () => rpSeek(10);
    $b('rp_speed').onclick = () => { const S = [0.25, 0.5, 1, 2, 4], i = S.indexOf(rp.speed); rp.speed = S[(i + 1) % S.length]; rpUI(); };
    $b('rp_prev').onclick = () => { rp.target = (rp.target - 1 + rpRec.cars.length) % rpRec.cars.length; humans[0].cam.init = false; rpUI(); };
    $b('rp_next').onclick = () => { rp.target = (rp.target + 1) % rpRec.cars.length; humans[0].cam.init = false; rpUI(); };
    $b('rp_cam').onclick = () => { rp.cam = RP_CAMS[(RP_CAMS.indexOf(rp.cam) + 1) % RP_CAMS.length]; humans[0].cam.init = false; rpUI(); };
    $b('rp_rec').onclick = () => rp.rec ? rpVideoStop() : rpVideoStart();
    $b('rp_exit').onclick = () => rpClose();
    $b('rp_save').onclick = async () => { const b = $b('rp_save'); b.disabled = true; try { await rpSave(); b.textContent = '✓'; } catch (e) { b.textContent = '✗'; b.disabled = false; } };
    $b('rp_time').oninput = e => { rp.t = rp.t0 + (+e.target.value / 1000) * (rp.t1 - rp.t0); rp.i = 0; if (fx) fx.reset(); };
    addEventListener('keydown', e => { if (state !== 'replay' || !rp) return; const k = e.code;
      if (k === 'Space') { e.preventDefault(); $b('rp_play').onclick(); } else if (k === 'ArrowLeft') rpSeek(-5); else if (k === 'ArrowRight') rpSeek(5);
      else if (k === 'ArrowUp') $b('rp_next').onclick(); else if (k === 'ArrowDown') $b('rp_prev').onclick(); else if (k === 'KeyC') $b('rp_cam').onclick(); else if (k === 'Escape') rpClose(); }, true);
  })();

  // ---------- reto semanal: cada semana (de lunes a domingo) el mismo circuito, vehículo, hora y clima para todos, con su clasificación ----------
  let reto = null;   // reto en curso (contrarreloj con esas condiciones)
  function retoWeek(now = Date.now()) {
    const MON = Date.UTC(2024, 0, 1), W = 7 * 864e5, k = Math.floor((now - MON) / W);   // 1-ene-2024 fue lunes
    let x = (k * 2654435761) >>> 0; const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
    const T = (front && front.tracks || []).filter(t => files.has(t.id + '.LEV')); if (!T.length) return null;
    const t = T[Math.floor(rnd() * T.length)], all = BRR.VEHICLES.filter(n => files.has(n + '.VHC') && !/HELI|COPTER|UFO/.test(n)), own = (t.cars || []).filter(n => all.includes(n));
    const veh = rnd() < 0.6 && own.length ? own[Math.floor(rnd() * own.length)] : all[Math.floor(rnd() * all.length)] || 'JEEP';
    const H = ['dia', 'manana', 'tarde', 'noche', 'original'], C = ['despejado', 'despejado', 'nublado', 'niebla', 'lluvia', 'nieve'];
    return { k, id: 'RETO' + k, level: t.id, track: t, veh, hora: H[Math.floor(rnd() * H.length)], clima: /SNOW/.test(t.id) ? 'nieve' : C[Math.floor(rnd() * C.length)], laps: 3, ends: MON + (k + 1) * W };
  }
  const HORA_N = { original: 'Original', manana: 'Amanecer', dia: 'Mediodía', tarde: 'Atardecer', noche: 'Noche' }, CLIMA_N = { despejado: 'Despejado', nublado: 'Nublado', niebla: 'Niebla', lluvia: 'Lluvia', nieve: 'Nieve' };
  async function retoOpen() {
    const w = retoWeek(); if (!w) return; $('reto').hidden = false; const left = w.ends - Date.now(), d = Math.floor(left / 864e5), hh = Math.floor(left % 864e5 / 36e5);
    $('rt_body').innerHTML = `<img class="rtimg" alt="" src="${(w.track && w.track.view) || ''}"><div class="rtgrid"><span>Circuito</span><b>${esc(tname(w.track))} · ${esc(w.level)}</b><span>Vehículo</span><b>${esc(VEH_NAMES[w.veh] || w.veh)}</b>
      <span>Condiciones</span><b><span>${HORA_N[w.hora]}</span> · <span>${CLIMA_N[w.clima]}</span></b><span>Termina en</span><b>${d} d ${hh} h</b></div><label class="row">Clasificación del reto</label><table class="lbt" id="rt_lb"><tr><td>Cargando…</td></tr></table>`;
    setTimeout(() => navFocusFirst($('reto')), 0);
    try { const L = await BRR.cloud.lbGet(w.id), rows = (L.rows || []).slice(0, 10), me = BRR.cloud.id;
      $('rt_lb').innerHTML = rows.length ? rows.map((r, i) => `<tr${r.pid === me ? ' class="me"' : ''}><td>${i + 1}. ${esc(r.name || 'Piloto')}</td><td>${fmt(r.lap)}</td></tr>`).join('') : (L.online ? '<tr><td>Nadie lo ha corrido todavía. ¡Sé el primero!</td></tr>' : '<tr><td>Sin conexión</td></tr>'); } catch (e) { $('rt_lb').innerHTML = '<tr><td>Sin conexión</td></tr>'; }
  }
  $('rt_close').onclick = () => { $('reto').hidden = true; };
  $('reto').onclick = e => { if (e.target.id === 'reto') $('reto').hidden = true; };
  $('rplist').onclick = e => { if (e.target.id === 'rplist') $('rplist').hidden = true; };
  $('rt_go').onclick = () => { const w = retoWeek(); if (!w) return; $('reto').hidden = true; if (audio) audio.init();
    reto = { ...w, prev: { hora: opt.hora, clima: opt.clima, ghost: opt.ghost } }; opt.hora = w.hora; opt.clima = w.clima;
    tourMode = false; ttMode = true; freeMode = false; crazyPick = 'normal'; startRace(w.level, w.veh, opt.team || 1, w.laps, 1); };
  function retoEnd() { if (!reto) return; Object.assign(opt, { hora: reto.prev.hora, clima: reto.prev.clima }); save(); reto = null; }

  // ---------- garaje: solo estética (los coches son los que son): ruedas, color del turbo, neones debajo del coche y tintado de ventanas ----------
  const GLASS = { normal: null, oscuro: 0.45, negro: 0.18, color: 'c' };
  // lo del garaje de un coche: el tuyo sale de las opciones; el de los demás (online) y el de la IA llega en sus datos
  // cada vehículo guarda su propio aspecto (opt.garVeh[VEHÍCULO]); lo que había antes (para todos) sirve de punto de partida
  let garSel = null;
  function garCfg(veh) { const A = opt.garVeh || (opt.garVeh = {}); if (!A[veh]) A[veh] = { rim: opt.rim || 'orig', rimSize: opt.rimSize || 17, rimCol: opt.rimCol || 'plata', neon: opt.neon || 'no', neonCol: opt.neonCol || '#00e5ff', glass: opt.glass || 'normal', glassCol: opt.glassCol || '#46607a', turboCol: opt.turboCol || null, lightCol: opt.lightCol || 'normal' }; return A[veh]; }
  let garT = 0; const GC = () => garCfg(garSel), garSave = () => { save(); clearTimeout(garT); garT = setTimeout(garPreview, 120); };
  const garMine = (veh = opt.vehicle) => ({ ...garCfg(veh), paint: opt.paint || null });
  function garRandom() {   // un aspecto al azar para la IA (a veces tuneado, a veces de serie)
    const pick = a => a[Math.random() * a.length | 0], hue = Math.random() * 360, tuned = Math.random() < 0.55;
    return { rim: tuned ? pick(['malla', 'radios5', 'multi', 'estrella', 'disco', 'acero']) : 'orig', rimSize: pick([15, 16, 17, 17, 18, 19]), rimCol: pick(['plata', 'plata', 'negro', 'gris', 'oro', 'bronce', 'blanco', 'carro']),
      neon: tuned && Math.random() < 0.35 ? 'si' : 'no', neonCol: hslHex(hue, 1, 0.55), glass: tuned ? pick(['normal', 'oscuro', 'negro', 'normal']) : 'normal', glassCol: '#46607a', turboCol: null, lightCol: pick(['normal', 'normal', 'blanca', 'intermedia', 'amarilla']) };
  }
  function garGlass(G = garMine()) {   // color de los cristales (null = el de siempre)
    const g = G.glass || 'normal'; if (!GLASS[g] && g !== 'color' || g === 'normal') return null; const base = hexRGB(G.glassCol || '#46607a') || [70, 96, 122];
    return g === 'color' ? base : [70, 92, 122].map(x => Math.round(x * GLASS[g]));
  }
  function garApply(c, G = garMine()) {   // al empezar la carrera
    if (!c || !G) return; c.gar = G; if (G.turboCol && hexRGB(G.turboCol)) c._tint = hexRGB(G.turboCol).map(x => x / 255);
    c.neon = G.neon === 'si' && hexRGB(G.neonCol || '#00e5ff') ? hexRGB(G.neonCol || '#00e5ff').map(x => x / 255) : null; c.lightT = { blanca: 1, intermedia: 2, amarilla: 3 }[G.lightCol] || 0;
  }
  function neonFrame() {   // neones: luz de color bajo la carrocería (como los coches tuneados)
    for (const c of [...humans.map(h => h.car), ...rivals.map(r => r.car)]) { if (!c || !c.neon || c.out || camDist(c.p) > 120) continue; const b = c.def.box, R = c.R, y = b.c[1] - b.h[1] + 0.12, pul = 0.85 + 0.15 * Math.sin(performance.now() / 260);
      // mancha de luz en el suelo (rectángulo algo más grande que el coche, pegado al terreno) y un brillo en los bajos
      const rt = BRR.mv(R, [1, 0, 0]), fw = BRR.mv(R, [0, 0, 1]), cc = V.add(c.p, BRR.mv(R, [0, 0, b.c[2]])), W = b.h[0] * 2.0, L = b.h[2] * 1.45;
      const pt = (sx, sz) => { const q = V.add(cc, V.add(V.mul(rt, sx * W), V.mul(fw, sz * L))); return [q[0], lvl.terrain(q[0], q[2]) + 0.06, q[2]]; };
      if (Math.abs(c.p[1] - lvl.terrain(c.p[0], c.p[2])) < 2.5) { fx.glowQuad([pt(-1, -1), pt(1, -1), pt(1, 1), pt(-1, 1)], [c.neon[0], c.neon[1], c.neon[2], 0.5 * pul]);
        fx.glowQuad([pt(-0.6, -0.75), pt(0.6, -0.75), pt(0.6, 0.75), pt(-0.6, 0.75)], [c.neon[0], c.neon[1], c.neon[2], 0.35 * pul]); }
      for (const [x, z] of [[-b.h[0] * 0.8, b.c[2]], [b.h[0] * 0.8, b.c[2]]]) fx.glow(V.add(c.p, BRR.mv(R, [x, y, z])), [c.neon[0], c.neon[1], c.neon[2], 0.5 * pul], 0.5); }
  }
  // vista previa del garaje: el coche elegido girando, con los cambios aplicados al momento
  let grThumb = null, grKey = '', grA = 0, grRun = false;
  async function garPreview() {
    const v = garSel, G = garMine(v), key = v + JSON.stringify(G); if (key === grKey || !orig) return; grKey = key;
    try { const t = await orig.h.carThumb(v, opt.team || 1, opt.level || 'CITY1', opt.paint, G); if (grKey === key) grThumb = t; } catch (e) { }
    if (!grRun) { grRun = true; const step = () => { if ($('garage').hidden) { grRun = false; return; }
        if (grThumb) { const cv = $('gr_car'), g = cv.getContext('2d'), im = grThumb.frame(grA += 0.02); g.clearRect(0, 0, cv.width, cv.height); const sz = Math.min(cv.width, cv.height * 1.3); g.drawImage(im, (cv.width - sz) / 2, (cv.height - sz) / 2, sz, sz);
          const N = garMine(v); if (N.neon === 'si') { const gr = g.createRadialGradient(cv.width / 2, cv.height * 0.78, 4, cv.width / 2, cv.height * 0.78, cv.width * 0.32); gr.addColorStop(0, N.neonCol + 'aa'); gr.addColorStop(1, N.neonCol + '00'); g.globalCompositeOperation = 'destination-over'; g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height); g.globalCompositeOperation = 'source-over'; } }
        setTimeout(() => requestAnimationFrame(step), 40); }; step(); }
  }
  function garRender() {
    const all = BRR.VEHICLES.filter(n => files.has(n + '.VHC')); if (!all.includes(garSel)) garSel = all.includes(opt.vehicle) ? opt.vehicle : all[0];
    if ($('gr_vsel').options.length !== all.length) $('gr_vsel').innerHTML = all.map(n => `<option value="${n}">${esc(VEH_NAMES[n] || n)}</option>`).join(''); $('gr_vsel').value = garSel;
    $('gr_rim').value = RIM_STYLES[GC().rim] ? GC().rim : 'orig'; $('gr_rimsize').value = String(GC().rimSize || 17); $('gr_rimcol').value = GC().rimCol || 'plata'; $('gr_rimsize').hidden = $('gr_rimcol').hidden = $('gr_rim').value === 'orig'; rimPreview();
    $('gr_lights').value = GC().lightCol || 'normal'; setTimeout(garPreview, 0);
    $('gr_turbo').value = GC().turboCol || '#ff8c1e'; $('gr_neon').value = GC().neon === 'si' ? 'si' : 'no'; $('gr_neoncol').value = GC().neonCol || '#00e5ff';
    $('gr_glass').value = GC().glass || 'normal'; $('gr_glasscol').value = GC().glassCol || '#46607a'; $('gr_glasscol').hidden = (GC().glass || 'normal') !== 'color'; $('gr_neoncol').hidden = GC().neon !== 'si';
  }
  for (const id of ['gr_rim', 'gr_rimsize', 'gr_rimcol']) $(id).onchange = () => { GC().rim = $('gr_rim').value; GC().rimSize = +$('gr_rimsize').value; GC().rimCol = $('gr_rimcol').value; garSave(); garRender(); };
  // vista previa de la llanta (dibujo 2D de frente)
  function rimPreview() {
    const cv = $('gr_rimcv'), g = cv.getContext('2d'), W = cv.width, c = W / 2, R0 = W * 0.46, st = GC().rim || 'orig'; g.clearRect(0, 0, W, W); if (st === 'orig') { cv.hidden = true; return; } cv.hidden = false;
    const col = GC().rimCol === 'carro' ? (hexRGB(opt.paint) || [200, 40, 30]) : (RIM_COLS[GC().rimCol] || RIM_COLS.plata).map(x => x * 255), css = a => `rgb(${col.map(x => Math.round(x * a)).join(',')})`, rr = R0 * (RIM_SIZES[GC().rimSize] || 0.7);
    g.fillStyle = '#121214'; g.beginPath(); g.arc(c, c, R0, 0, 7); g.fill(); g.fillStyle = '#0a0a0b'; g.beginPath(); g.arc(c, c, rr, 0, 7); g.fill();
    g.strokeStyle = css(1); g.lineWidth = rr * 0.08; g.beginPath(); g.arc(c, c, rr * 0.95, 0, 7); g.stroke();
    const sp = (a, w0, w1, r0, r1, f = css(1)) => { const ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca; g.fillStyle = f; g.beginPath(); g.moveTo(c + ca * r0 - px * w0, c + sa * r0 - py * w0); g.lineTo(c + ca * r1 - px * w1, c + sa * r1 - py * w1); g.lineTo(c + ca * r1 + px * w1, c + sa * r1 + py * w1); g.lineTo(c + ca * r0 + px * w0, c + sa * r0 + py * w0); g.fill(); };
    const hub = rr * 0.2;
    if (st === 'disco' || st === 'acero') { g.fillStyle = css(1); g.beginPath(); g.arc(c, c, rr * 0.88, 0, 7); g.fill(); for (let i = 0; i < (st === 'acero' ? 8 : 5); i++) sp(i / (st === 'acero' ? 8 : 5) * 6.2832 + (st === 'disco' ? 0.6 : 0), rr * 0.07, rr * 0.07, rr * 0.5, rr * 0.66, '#0a0a0b'); }
    if (st === 'malla') { for (let i = 0; i < 10; i++) { const a = i / 10 * 6.2832; sp(a - 0.16, rr * 0.03, rr * 0.03, hub, rr * 0.86); sp(a + 0.16, rr * 0.03, rr * 0.03, hub, rr * 0.86); } g.strokeStyle = css(0.9); g.lineWidth = rr * 0.06; g.beginPath(); g.arc(c, c, rr * 0.53, 0, 7); g.stroke(); }
    if (st === 'radios5') for (let i = 0; i < 5; i++) sp(i / 5 * 6.2832, rr * 0.16, rr * 0.22, hub * 0.8, rr * 0.88);
    if (st === 'multi') for (let i = 0; i < 14; i++) sp(i / 14 * 6.2832, rr * 0.03, rr * 0.06, hub * 0.8, rr * 0.88);
    if (st === 'estrella') for (let i = 0; i < 6; i++) { const a = i / 6 * 6.2832; sp(a, rr * 0.08, rr * 0.05, hub * 0.8, rr * 0.45); sp(a - 0.13, rr * 0.04, rr * 0.05, rr * 0.42, rr * 0.88); sp(a + 0.13, rr * 0.04, rr * 0.05, rr * 0.42, rr * 0.88); }
    g.fillStyle = css(1.1); g.beginPath(); g.arc(c, c, hub, 0, 7); g.fill();
  }
  $('gr_close').onclick = () => { $('garage').hidden = true; };
  $('gr_vsel').onchange = () => { garSel = $('gr_vsel').value; garRender(); };
  $('garage').onclick = e => { if (e.target.id === 'garage') $('garage').hidden = true; };
  $('gr_turbo').oninput = () => { GC().turboCol = $('gr_turbo').value; garSave(); };
  $('gr_turbo0').onclick = () => { GC().turboCol = null; garSave(); garRender(); };
  $('gr_lights').onchange = () => { GC().lightCol = $('gr_lights').value; garSave(); };
  $('gr_neon').onchange = () => { GC().neon = $('gr_neon').value; garSave(); garRender(); };
  $('gr_neoncol').oninput = () => { GC().neonCol = $('gr_neoncol').value; garSave(); };
  $('gr_glass').onchange = () => { GC().glass = $('gr_glass').value; garSave(); garRender(); };
  $('gr_glasscol').oninput = () => { GC().glassCol = $('gr_glasscol').value; garSave(); };

  // ---------- llantas del garaje: ruedas hechas aquí (neumático + llanta) con estilos genéricos y tamaños de 15" a 19" ----------
  // el tamaño total de la rueda no cambia (la física es la misma): una llanta más grande deja menos goma (perfil más bajo)
  const RIM_STYLES = { orig: 'Originales', malla: 'Malla (cruzada)', radios5: '5 radios', multi: 'Radios finos', estrella: 'Estrella partida', disco: 'Disco', acero: 'De acero' };
  const RIM_COLS = { plata: [0.78, 0.8, 0.83], negro: [0.09, 0.09, 0.1], oro: [0.86, 0.68, 0.26], bronce: [0.55, 0.38, 0.2], blanco: [0.92, 0.92, 0.92], gris: [0.35, 0.36, 0.38] };
  const RIM_SIZES = { 15: 0.6, 16: 0.65, 17: 0.7, 18: 0.75, 19: 0.8 };
  function rimMesh(rad, hw, side, style, col, frac, cx = 0) {
    const mb = new BRR.MeshBuilder(null), g = mb.group('COLOR'), N = 28, T = (a, b, c, k) => { for (const v of [a, b, c, a, c, b]) { g.pos.push(...v); g.col.push(...k); g.lay.push(0); } };
    const P = (x, r, a) => [x, Math.cos(a) * r, Math.sin(a) * r], Q = (a, b, c, d, k) => { T(a, b, c, k); T(a, c, d, k); };
    const tyre = [0.07, 0.07, 0.08], wall = [0.11, 0.11, 0.12], rr = rad * frac, out = side * hw, inn = -side * hw, face = side * hw * 0.55;
    for (let i = 0; i < N; i++) { const a0 = i / N * 6.2832, a1 = (i + 1) / N * 6.2832;
      Q(P(inn * 0.92, rad, a0), P(out * 0.92, rad, a0), P(out * 0.92, rad, a1), P(inn * 0.92, rad, a1), tyre);   // banda de rodadura
      for (const x of [out, inn]) { const sx = x * 0.92 / x; Q(P(x * 0.92, rad, a0), P(x, rad * 0.93, a0), P(x, rad * 0.93, a1), P(x * 0.92, rad, a1), wall); Q(P(x, rad * 0.93, a0), P(x, rr, a0), P(x, rr, a1), P(x, rad * 0.93, a1), wall); }
      Q(P(out, rr, a0), P(out, rr * 0.93, a0), P(out, rr * 0.93, a1), P(out, rr, a1), col);   // labio exterior de la llanta
      Q(P(out, rr * 0.93, a0), P(face, rr * 0.9, a0), P(face, rr * 0.9, a1), P(out, rr * 0.93, a1), col.map(x => x * 0.7));   // fondo (hacia dentro)
      Q(P(face, rr * 0.9, a0), P(inn * 0.6, rr * 0.9, a0), P(inn * 0.6, rr * 0.9, a1), P(face, rr * 0.9, a1), [0.05, 0.05, 0.06]);   // interior oscuro (barril)
      Q(P(face - side * 0.01, rr * 0.88, a0), P(face - side * 0.01, 0, a0), P(face - side * 0.01, 0, a1), P(face - side * 0.01, rr * 0.88, a1), [0.04, 0.04, 0.05]);   // fondo negro (huecos entre radios)
      if (style === 'disco' || style === 'acero') Q(P(face + side * 0.005, rr * 0.88, a0), P(face + side * 0.005, rr * 0.18, a0), P(face + side * 0.005, rr * 0.18, a1), P(face + side * 0.005, rr * 0.88, a1), col);
    }
    const fx2 = face + side * 0.012, spoke = (a, w0, w1, r0, r1, k = col, x = fx2) => { const c0 = Math.cos(a), s0 = Math.sin(a), px = -s0, py = c0, pt = (r, w) => [x, c0 * r + px * w, s0 * r + py * w]; Q(pt(r0, -w0), pt(r1, -w1), pt(r1, w1), pt(r0, w0), k); };
    const hubR = rr * 0.2;
    if (style === 'malla') { for (let i = 0; i < 10; i++) { const a = i / 10 * 6.2832; spoke(a - 0.16, rr * 0.03, rr * 0.03, hubR, rr * 0.86); spoke(a + 0.16, rr * 0.03, rr * 0.03, hubR, rr * 0.86); }
      for (let i = 0; i < 20; i++) { const a = i / 20 * 6.2832; spoke(a, rr * 0.05, rr * 0.05, rr * 0.5, rr * 0.56, col.map(x => x * 0.9), fx2 + side * 0.004); } }
    else if (style === 'radios5') for (let i = 0; i < 5; i++) spoke(i / 5 * 6.2832, rr * 0.16, rr * 0.22, hubR * 0.8, rr * 0.88);
    else if (style === 'multi') for (let i = 0; i < 14; i++) spoke(i / 14 * 6.2832, rr * 0.03, rr * 0.06, hubR * 0.8, rr * 0.88);
    else if (style === 'estrella') for (let i = 0; i < 6; i++) { const a = i / 6 * 6.2832; spoke(a, rr * 0.08, rr * 0.05, hubR * 0.8, rr * 0.45); spoke(a - 0.13, rr * 0.04, rr * 0.05, rr * 0.42, rr * 0.88); spoke(a + 0.13, rr * 0.04, rr * 0.05, rr * 0.42, rr * 0.88); }
    else if (style === 'disco') for (let i = 0; i < 5; i++) { const a = i / 5 * 6.2832 + 0.6; spoke(a, rr * 0.07, rr * 0.07, rr * 0.5, rr * 0.66, [0.05, 0.05, 0.06], fx2 + side * 0.006); }
    else if (style === 'acero') for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832; spoke(a, rr * 0.06, rr * 0.08, rr * 0.48, rr * 0.66, [0.05, 0.05, 0.06], fx2 + side * 0.006); }
    for (let i = 0; i < N; i++) { const a0 = i / N * 6.2832, a1 = (i + 1) / N * 6.2832; Q(P(fx2 + side * 0.008, hubR, a0), P(fx2 + side * 0.02, 0, a0), P(fx2 + side * 0.02, 0, a1), P(fx2 + side * 0.008, hubR, a1), col.map(x => Math.min(1, x * 1.1))); }   // buje
    if (cx) for (let i = 0; i < g.pos.length; i += 3) g.pos[i] += cx;
    return R.upload(mb);
  }
  const rimCache = new Map();
  const withRims = (dd, d, G) => { const rw = rimWheels(d, G); return rw ? { ...dd, wheels: dd.wheels.map((w, i) => rw[i] || w) } : dd; };
  function rimWheels(d, G = garMine()) {   // las ruedas del vehículo con las llantas elegidas (null si no se usan)
    const st = (G && G.rim) || 'orig'; if (st === 'orig' || !d.wheelMeshes || /hover|boat|track/.test(d.kind || '')) return null;
    const key = d.name + '|' + st + '|' + (G.rimCol || 'plata') + '|' + (G.rimSize || 17) + '|' + (G.rimCol === 'carro' ? G.paint : ''); if (rimCache.has(key) && rimCache.get(key).lvl === lvl) return rimCache.get(key).w;
    const col = G.rimCol === 'carro' ? (hexRGB(G.paint) || [200, 40, 30]).map(x => x / 255) : RIM_COLS[G.rimCol] || RIM_COLS.plata, frac = RIM_SIZES[G.rimSize] || 0.7;
    const W = d.wheelMeshes.map((mb, wi) => { if (!mb) return null; let x0 = 1e9, x1 = -1e9, r = 0; for (const g of mb.groups.values()) for (let i = 0; i < g.pos.length; i += 3) { x0 = Math.min(x0, g.pos[i]); x1 = Math.max(x1, g.pos[i]); r = Math.max(r, Math.hypot(g.pos[i + 1], g.pos[i + 2])); }
      if (!(r > 0.05) || x1 - x0 < 0.02) return null; const hw = (x1 - x0) / 2, cx = (x0 + x1) / 2, side = d.wheels && d.wheels[wi] ? (d.wheels[wi].c[0] < 0 ? -1 : 1) : (Math.abs(x1) >= Math.abs(x0) ? 1 : -1);
      const m = rimMesh(r, hw, side, st, col, frac, cx); return { m, cx }; });
    const out = W.map(x => x && x.m); if (out.every(x => !x)) return null; rimCache.set(key, { lvl, w: out }); return out;
  }

  // ---------- daños visuales: abolladuras donde golpea el coche (la carrocería se hunde un poco) y piezas que saltan al reventar ----------
  const drawOf = c => { const h = humans.find(x => x.car === c); if (h) return h.draw; const r = rivals.find(x => x.car === c); return r && r.draw; };
  function dentReset(c) { const D = drawOf(c); if (!D || !c.dented) return; const gl = R.gl; for (const b of D) { if (!b.pbuf || !b.cur) continue; b.cur = null; gl.bindBuffer(gl.ARRAY_BUFFER, b.pbuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.base), gl.STATIC_DRAW); } c.dented = false; }
  function dentFrame(c) {
    const v = c.hitV || 0, hr = c.hitR; c.hitV = 0; if (v < 3 || !hr || opt.damage === '0' || opt.dents === 'no') return;
    const D = drawOf(c); if (!D || camDist(c.p) > 140) return;
    const L = BRR.mtv(c.R, hr), b = c.def.box, cx = b.c[0], cy = b.c[1], cz = b.c[2];   // punto del golpe en coordenadas del coche
    const dir = V.norm([cx - L[0], (cy - L[1]) * 0.3, cz - L[2]]), depth = Math.min(0.3, (v - 3) * 0.022) * (100 / Math.max(40, c.def.tough || 100)), rad = 0.8 + Math.min(0.6, v * 0.03);
    // el punto de contacto sale en la superficie de la esfera de choque: se lleva al borde de la caja del coche
    const P = [Math.max(cx - b.h[0], Math.min(cx + b.h[0], L[0])), Math.max(cy - b.h[1], Math.min(cy + b.h[1], L[1])), Math.max(cz - b.h[2], Math.min(cz + b.h[2], L[2]))];
    const gl = R.gl, MAX = 0.45;
    for (const bt of D) { if (!bt.pbuf || !bt.base) continue; const cur = bt.cur || (bt.cur = new Float32Array(bt.base)), base = bt.base; let any = false;
      for (let i = 0; i < cur.length; i += 3) { const dx = base[i] - P[0], dy = base[i + 1] - P[1], dz = base[i + 2] - P[2], d2 = dx * dx + dy * dy + dz * dz; if (d2 > rad * rad) continue;
        const f = 1 - Math.sqrt(d2) / rad, k = depth * f * f * (0.8 + 0.4 * Math.sin(base[i] * 37 + base[i + 2] * 23));   // un poco irregular
        let nx = cur[i] + dir[0] * k, ny = cur[i + 1] + dir[1] * k, nz = cur[i + 2] + dir[2] * k; const ox = nx - base[i], oy = ny - base[i + 1], oz = nz - base[i + 2], ol = Math.hypot(ox, oy, oz);
        if (ol > MAX) { nx = base[i] + ox / ol * MAX; ny = base[i + 1] + oy / ol * MAX; nz = base[i + 2] + oz / ol * MAX; } cur[i] = nx; cur[i + 1] = ny; cur[i + 2] = nz; any = true; }
      if (any) { gl.bindBuffer(gl.ARRAY_BUFFER, bt.pbuf); gl.bufferData(gl.ARRAY_BUFFER, cur, gl.DYNAMIC_DRAW); c.dented = true; } }
  }
  function debris(c) {   // al reventar: trozos de carrocería y cristales que salen volando
    const col = (hexRGB(carCol(c)) || [200, 40, 30]).map(x => x / 255);
    for (let i = 0; i < 14; i++) { const glass = i % 4 === 0, a = Math.random() * 6.283;
      fx.parts.push({ p: V.add(c.p, [(Math.random() - .5) * 1.2, 0.6 + Math.random() * 0.5, (Math.random() - .5) * 1.2]), v: [Math.cos(a) * (3 + Math.random() * 4) + c.v[0] * 0.4, 4 + Math.random() * 5, Math.sin(a) * (3 + Math.random() * 4) + c.v[2] * 0.4],
        col: glass ? [0.7, 0.85, 1, 0.8] : [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8, 1], size: glass ? 0.06 : 0.1 + Math.random() * 0.1, life: 1.4 + Math.random(), age: 0, grow: 0, grav: 1, solid: true }); }
  }

  // ---------- IA libre (bomba, zombi, polis y cacos): sin circuito; los cazadores persiguen y los demás huyen por donde puedan ----------
  const roamMode = () => crazy && (crazy.mode === 'bomba' || crazy.mode === 'zombie' || crazy.mode === 'polis');
  const isHunter = c => crazy.mode === 'bomba' ? !!(crazy.bomb && crazy.bomb.car === c) : crazy.mode === 'zombie' ? !!c.zombie : !!c.cop;
  const isPrey = (hunter, c) => crazy.mode === 'bomba' ? true : crazy.mode === 'zombie' ? !c.zombie : !!c.robber;
  function aiJump(c, vy = 6) {   // salto de la IA (para esquivar)
    const now = performance.now(); if (c.K.fly || now - (c.jumpT || 0) < 1500 || c.W.filter(w => w.contact).length < 2) return false; c.jumpT = now;
    const up = BRR.mv(c.R, [0, 1, 0]); c.v = V.madd(c.v, up[1] > 0.5 ? up : [0, 1, 0], vy); c.v[1] = Math.max(c.v[1], vy * 0.85); return true;
  }
  function roamControl(r, dt) {
    const c = r.car, inp = { steer: 0, throttle: 1, brake: 0, handbrake: false, pitchAir: 0 }, fw = c.forward(), sp = Math.abs(c.speed()), S = r.roam || (r.roam = { wander: Math.random() * 6.28, stuck: 0, rev: 0 });
    const alive = order.filter(o => !o.car.out && o.car !== c);
    let want = null;
    if (isHunter(c)) {   // a por la presa más cercana (adelantándose a por dónde irá)
      let best = null, bd = 1e18; for (const o of alive) { if (!isPrey(c, o.car)) continue; const d = V.len(V.sub(o.car.p, c.p)); if (d < bd) { bd = d; best = o.car; } }
      if (best) want = V.sub(V.madd(best.p, best.v, Math.min(1.2, bd / 25)), c.p);
    } else {   // huir: lejos de los cazadores (más fuerte cuanto más cerca), y si no hay peligro, vagar
      let f = [0, 0, 0], danger = 1e9; for (const o of alive) { if (!isHunter(o.car)) continue; const d = V.sub(c.p, o.car.p), l = V.len(d) || 1; danger = Math.min(danger, l); if (l < 120) f = V.madd(f, d, 1 / (l * l)); }
      if (danger < 120) { want = f; if (danger < 9 && V.dot(V.norm(V.sub(c.p, alive.find(o => isHunter(o.car) && V.len(V.sub(o.car.p, c.p)) === danger)?.car.p || c.p)), V.norm(c.v)) < 0.5 && Math.random() < dt * 3) aiJump(c); }
      else { S.wander += (Math.random() - 0.5) * dt * 1.5; want = [Math.sin(S.wander), 0, Math.cos(S.wander)]; inp.throttle = 0.7; }
    }
    if (!want) want = fw;
    // que no se salga del mapa: hacia el centro si está cerca del borde
    const size = lvl.size || 2048, m = 60, cx = size / 2, cz = -size / 2; if (c.p[0] < m || c.p[0] > size - m || -c.p[2] < m || -c.p[2] > size - m) want = V.add(V.norm([want[0], 0, want[2]]), V.mul(V.norm([cx - c.p[0], 0, cz - c.p[2]]), 2));
    // esquivar obstáculos: tres rayos por delante; si el central choca, gira hacia el lado con más hueco
    const eye = [c.p[0], c.p[1] + 0.8, c.p[2]], L = 6 + sp * 0.7, ray = a => { const ca = Math.cos(a), sa = Math.sin(a), d = V.norm([fw[0] * ca - fw[2] * sa, 0, fw[0] * sa + fw[2] * ca]); return BRR.objRay(lvl, eye, d, L); };
    const dC = ray(0), dL = ray(-0.55), dR = ray(0.55);
    let err = Math.atan2(fw[0] * want[2] - fw[2] * want[0], fw[0] * want[0] + fw[2] * want[2]);
    if (dC < L * 0.9) err += (dR > dL ? 1 : -1) * 1.2 * (1 - dC / L);
    S.dbg = [+dC.toFixed(1), +dL.toFixed(1), +dR.toFixed(1), +err.toFixed(2), +L.toFixed(1), S.rev > 0 ? 1 : 0, isHunter(c) ? 1 : 0];
    // atascado contra algo: marcha atrás un momento
    S.stuck = sp < 1.2 && inp.throttle > 0 ? S.stuck + dt : 0; if (S.stuck > 1.6) { S.rev = 1.1; S.stuck = 0; }
    if (S.rev > 0) { S.rev -= dt; inp.throttle = 0; inp.brake = 1; inp.steer = -Math.sign(err || 1); return inp; }
    inp.steer = Math.max(-1, Math.min(1, err * 2.2)); if (Math.abs(err) > 1.3 && sp > 8) { inp.handbrake = true; } if (Math.abs(err) > 2.2 && sp > 14) inp.brake = 0.5;
    if (isHunter(c) && Math.abs(err) < 0.25 && sp > 10 && Math.random() < dt * 0.3) inp.nitro = true;
    // volcado: se endereza en el sitio (nunca vuelve al circuito)
    if (c.R[1][1] < 0.2) { S.flip = (S.flip || 0) + dt; if (S.flip > 2.5) { const f2 = c.forward(); c.reset(c.p[0], c.p[2], Math.atan2(-f2[0], -f2[2]), c.p[1] + 1); S.flip = 0; } } else S.flip = 0;
    return inp;
  }
  // salidas repartidas por el mapa (solo en estos modos): sitios al azar en tierra firme, separados entre sí
  function roamSpawns(list, near, minR, maxR) {
    const size = lvl.size || 2048, pts = [], sp = lvl.startPos;
    for (const o of list) { let p = null;
      for (let t = 0; t < 80 && !p; t++) { const a = Math.random() * 6.283, d = minR + Math.random() * (maxR - minR), x = (near ? near[0] : sp[0]) + Math.cos(a) * d, z = (near ? near[2] : sp[2]) + Math.sin(a) * d;
        if (x < 40 || x > size - 40 || -z < 40 || -z > size - 40) continue; const s = lvl.surface(x, z); if (s.type === 'agua' && !o.car.K.floats) continue;
        const n = [0, 1, 0]; lvl.terrain(x, z, n); if (n[1] < 0.85) continue; if (pts.some(q => Math.hypot(q[0] - x, q[1] - z) < 25)) continue; p = [x, z]; }
      if (!p) continue; pts.push(p); const yaw = Math.random() * 6.283; o.car.reset(p[0], p[1], yaw, groundY(p[0], p[1]) + 1); o.race.prev = o.car.p.slice(); if (o.h) o.h.cam.init = o.h.cam.posInit = false; }
  }

  // ---------- bucle ----------
  let last = performance.now(), acc = 0, fpsT = 0, fpsN = 0, fps = 0, shTick = 0;
  const DT = 1 / 240;
  // velocímetro de aguja
  function drawGauge(h, kmh, c) {
    const cv = h.q('gauge'), g = cv.getContext('2d'), W = cv.width, cx = W / 2, cy = W / 2, r = W * 0.44, top = Math.max(160, Math.ceil((c.topSpeed || 30) * 3.6 * 1.25 / 20) * 20);
    const ang = v => Math.PI * 0.75 + Math.min(1.05, v / top) * Math.PI * 1.5;
    g.clearRect(0, 0, W, W); g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 14; g.beginPath(); g.arc(cx, cy, r, ang(0), ang(top)); g.stroke();
    g.strokeStyle = TEAM[h.team].c; g.beginPath(); g.arc(cx, cy, r, ang(0), ang(kmh)); g.stroke();
    g.fillStyle = '#cfd6e2'; g.font = '600 18px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let v = 0; v <= top; v += top / 8) { const a = ang(v); g.fillText(Math.round(v), cx + Math.cos(a) * (r - 30), cy + Math.sin(a) * (r - 30)); }
    const a = ang(kmh); g.strokeStyle = '#ff4a3a'; g.lineWidth = 6; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12)); g.stroke();
    g.fillStyle = '#fff'; g.font = '800 40px system-ui'; g.fillText(kmh, cx, cy + 52); g.font = '600 15px system-ui'; g.fillStyle = '#9aa4b2'; g.fillText('km/h', cx, cy + 80);
  }
  // nombres sobre los coches
  function nameTags(h, VP, vw, vh) {
    const box = h.q('tags'); h.tagsOn = true; const out = [];
    const list = [...rivals.map(r => ({ c: r.car, n: r.name && !r.isAI ? r.name : (r.car.teamName || (r.replay ? 'Equipo ' + TEAM[r.car.team].n : (r.ai ? r.ai.P.name : ''))) })), ...humans.filter(o => o !== h).map(o => ({ c: o.car, n: NAMES[o.i] }))];
    const bc = crazy && crazy.bomb && crazy.bomb.car;
    for (const { c, n: n0 } of list) { if (!n0 || c.out || (!opt.hnames && c !== bc && !c.zombie && !c.cop && !c.robber)) continue; const n = c === bc ? '💣 ' + Math.ceil(Math.max(0, crazy.bomb.t)) + ' · ' + n0 : c.zombie ? '🧟 ' + n0 : c.cop ? '🚨 ' + n0 : c.robber ? '💰 ' + n0 : n0; const p = [c.p[0], c.p[1] + 2.2, c.p[2]], m = VP;
      const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
      if (w <= 0.5 || w > 150) continue; const sx = (x / w * 0.5 + 0.5) * 100, sy = (1 - (y / w * 0.5 + 0.5)) * 100; if (sx < -5 || sx > 105 || sy < -5 || sy > 105) continue;
      out.push(`<div class="ntag" style="left:${sx}%;top:${sy}%;color:${carCol(c)};opacity:${Math.max(0.35, 1 - w / 150)}">${esc(n)}</div>`); }
    box.innerHTML = out.join('');
  }
  // sonido en 3D: el oyente es la cámara del jugador (con pantalla partida no hay oyente único) · eco en los túneles · viento
  function listenerFrame() {
    if (!audio || !audio.ctx || !humans.length) return; const h = humans[0], cam = h.cam; if (!cam.pos || !cam.look) return;
    const f = V.norm(V.sub(cam.look, cam.pos)); audio.setListener(cam.pos, f, cam.up || [0, 1, 0], opt.spatial && humans.length === 1);
    const inTun = state === 'race' && lvl.tunnel && lvl.tunnel(cam.pos[0], cam.pos[2]); h.revK = (h.revK || 0) + ((inTun ? 1 : 0) - (h.revK || 0)) * 0.1; audio.setReverb(h.revK);
    const amb = audio.ambient(); if (amb) { const sp = state === 'race' ? Math.abs(h.car.speed()) : 0; amb.set(state === 'race' ? 0.04 + Math.min(0.5, sp / 70) : 0, 300 + sp * 25); }
  }
  // vibración del mando: golpes, aterrizajes, derrapes y suelo rugoso
  function rumble(h, dt) {
    const k = +opt.rumble || 0; if (!k || !h.ctl || h.ctl.pad == null) return; const gp = padsFor(h.ctl)[0]; const act = gp && (gp.vibrationActuator || (gp.hapticActuators && gp.hapticActuators[0])); if (!act) return;
    const c = h.car; let strong = 0, weak = 0;
    if (h.rbHit) { strong = Math.min(1, h.rbHit / 10); weak = strong; h.rbHit = 0; }
    if (h.rbLand) { strong = Math.max(strong, Math.min(1, h.rbLand / 9)); h.rbLand = 0; }
    let slip = 0, rough = 0, nc = 0; for (const w of c.W) if (w.contact) { nc++; slip = Math.max(slip, w.slip || 0); if (/tierra|arena|hierba|nieve/.test(w.surface || '')) rough++; }
    const sp = Math.min(1, Math.abs(c.speed()) / 25); weak = Math.max(weak, Math.min(0.6, slip * 0.9) * sp, nc ? rough / nc * 0.12 * sp : 0); if (c.nitroT > 0) weak = Math.max(weak, 0.25);
    h.rbT = (h.rbT || 0) - dt; if ((strong > 0.05 || weak > 0.03) && h.rbT <= 0) { h.rbT = 0.08;
      try { act.playEffect ? act.playEffect('dual-rumble', { duration: strong > 0.05 ? 160 : 100, strongMagnitude: Math.min(1, strong * k), weakMagnitude: Math.min(1, weak * k) }) : act.pulse(Math.min(1, (strong + weak) * k), 100); } catch (e) { } }
  }
  // ---------- PELOTÓN ----------
  // Cada rival tiene una distancia objetivo respecto al jugador que va cambiando despacio (unos delante, otros detrás, y se
  // van cruzando): así se corre en grupo, con adelantamientos y choques, sin obligarte a ir en ningún puesto.
  // A la vista se corrige poco (±12 %, la mitad en la última vuelta); fuera de la vista se acercan o se alejan más deprisa.
  // La dificultad desplaza el grupo: fácil, casi todos detrás; muy difícil, casi todos delante.
  let packT = 0;
  const camHidden = p => !humans.length || humans.every(h => { const C = h.cam; if (!C || !C.pos || !C.look) return true; const d = V.sub(p, C.pos), L = V.len(d), f = V.norm(V.sub(C.look, C.pos)); return L > 90 || V.dot(d, f) < L * 0.2; });
  function packFrame(dt) {
    if (!rivals.length || !humans.length) return; if (window.BRR_NOPACK || opt.aiPack !== 'si') { for (const r of rivals) { if (r.replay) r.replay.rate = (r.replay.band && r.replay.band.nom) || 1; if (r.ai) r.ai.rubber = 1; } return; }   // pruebas: sin pelotón
    if (netRace && netRace.role !== 'host') return;
    if (crazyJump()) { for (const r of rivals) if (r.ai) r.ai.rubber = 1; return; }   // modos libres: sin pelotón ni saltos de la IA
    const H = humans.filter(h => h.race.phase === 'race' || h.race.phase === 'finished'); if (!H.length) return;
    packT += dt;
    const seg = race.total / ((race.maxNum || 1) + 1);
    let hs = Math.max(...humans.map(h => h.race.score()));
    for (const r of rivals) if (r.remote && !r.isAI && r.sc != null) hs = Math.max(hs, r.sc);   // online: el humano que vaya primero
    const lead = humans.reduce((a, b) => b.race.score() > a.race.score() ? b : a), lastLap = lead.race.lap >= lead.race.laps - 1, hP = lead.race.progress || 0;
    const bias = [0, -40, -10, 12, 30][opt.diff] ?? -10, mine = rivals.filter(r => !r.remote), n = mine.length, span = 22 + 7 * Math.min(11, n);
    const assist = lastLap ? 0.5 : 1;
    mine.forEach((r, i) => {
      if (r.race.phase !== 'race') return;
      if (r.packPh == null) { r.packPh = Math.random() * 6.283; r.packPer = 22 + Math.random() * 30; r.packAmp = 0.5 + Math.random() * 0.5; }
      const base = n > 1 ? (i / (n - 1) * 2 - 1) * span * 0.55 : 0;
      const target = bias + base + Math.sin(packT * 6.283 / r.packPer + r.packPh) * span * r.packAmp;
      // distancia real por la carretera: la del recorrido (continua) ajustada a vueltas con la de los controles (gruesa)
      const coarse = (r.race.score() - hs) * seg, T0 = race.total, fine0 = ((r.race.progress || 0) - (hP || 0)) * T0;
      const gap = fine0 + Math.round((coarse - fine0) / T0) * T0, err = target - gap, early = r.race.t < 6, hid = camHidden(r.car.p);
      // a la vista: frena hasta un 25 % si va por delante de su sitio y acelera hasta un 15 % si va por detrás
      let m = early ? 1 : 1 + (err > 0 ? Math.min(1, err / 110) * 0.15 : Math.max(-1, err / 110) * 0.25) * assist;
      if (!early && hid && Math.abs(err) > 90) m = 1 + (err > 0 ? Math.min(0.55, (err - 60) / 250) : -Math.min(0.65, (-err - 60) / 220));
      r.packM = r.packM == null ? 1 : r.packM + (m - r.packM) * Math.min(1, dt * (hid ? 2 : 0.7));
      // cerca de un jugador nunca va mucho más rápido de lo normal (si no, llegan como balas y destrozan al chocar)
      r.packM = Math.min(r.packM, 1);   // la IA nunca va más rápida de lo que da su coche (sin acelerones para alcanzar al grupo): solo puede ir más despacio si va muy por delante
      if (r.replay) { const B = r.replay.band; r.replay.rate = B.nom * r.packM; }
      if (r.ai) r.ai.rubber = Math.min(1, r.packM);   // sin saltos hacia delante: la IA se gana la posición conduciendo
    });
  }
  let lastDraw = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    const lim = +opt.fpslim || 0; if (lim && t - lastDraw < 1000 / lim - 1.5) return; lastDraw = t;   // límite de FPS
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    if (state !== 'race' && state !== 'pause' && state !== 'results' && state !== 'replay') return;
    assignControls();
    const allCars = [...humans.map(h => h.car), ...rivals.map(r => r.car)].filter(c => !c.out);
    if (netWait && state === 'race') { netFrame(dt); crazyNetSend(dt); for (const h of humans) { readInput(h, 0); h.race.phase = 'countdown'; h.race.cd = 3.6; } }
    else if (photo) { photoFrame(dt); }
    else if (state === 'replay' && rp) { rpFrame(dt); }
    else if (state === 'race' || state === 'results') {
      for (const h of humans) { const inp = readInput(h, dt); if (freeMode && inp.ramp && !h.rampPrev && h.race.phase === 'race') placeRamp(h); h.rampPrev = !!inp.ramp; if (freeMode && inp.pipe && !h.pipePrev && h.race.phase === 'race') placePipe(h); h.pipePrev = !!inp.pipe; if ((freeMode || crazyJump()) && h.race.phase === 'race') jumpCharge(h, !!inp.jump); h.jumpPrev = !!inp.jump; if (kart && h.race.phase === 'race' && ((inp.jump && !h.kjPrev) || (inp.ramp && !h.krPrev))) kUse(h.car); h.kjPrev = !!inp.jump; h.krPrev = !!inp.ramp; if (freeMode) stuntFrame(h, dt); if (inp.nitro && !h.nPrev && h.race.phase === 'race' && h.car.fireNitro()) { nitroFx(h.car); h.usedNitro = true; if (h.i === 0) say(['NITRO', 'TURBO', 'BOOST'], 0.3, false); } h.nPrev = inp.nitro; }
      for (const r of rivals) if (r.inp && r.inp.nitro && r.car.fireNitro()) nitroFx(r.car);
      const ps = Math.max(...humans.map(h => h.race.score())), tA = performance.now();
      for (const r of rivals) if (r.ai && !r.car.out) { r.inp = roamMode() ? roamControl(r, dt) : r.ai.control(dt, allCars, null); if (!roamMode()) crazyChase(r); if (r.car.kSpin > 0) { r.inp.throttle = 0; r.inp.nitro = false; } }   // ritmo: lo pone el pelotón (packFrame)
      const tB = performance.now();
      acc += dt; let n = 0;
      while (acc >= DT) { for (const h of humans) if (!h.car.out) h.car.step(DT, h.inp); for (const r of rivals) if (!r.remote && !r.replay && !r.car.out) r.car.step(DT, r.inp); acc -= DT; if (++n % 3 === 0) BRR.carCollisions(allCars, softStart()); }
      if (replayBand && replayBand.age == null) replayBand.age = 0; if (replayBand) replayBand.age += dt;
      packFrame(dt);
      for (const r of rivals) if (r.replay && !r.car.out) r.replay.update(dt);
      BRR.carCollisions(allCars, softStart()); const tC = performance.now(); const P = BRR.PERF || (BRR.PERF = { ai: 0, phys: 0, n: 0 }); P.ai += tB - tA; P.phys += tC - tB; P.n++;
      for (const h of humans) { h.race.update(dt, h.car); handleEvents(h); ghostRecord(h); } ghostFrame();
      for (const r of rivals) { if (r.remote || r.car.out) continue; r.race.update(dt, r.car); r.race.ev.length = 0; }
      if (netRace) netFrame(dt);
      updatePositions(dt); crazyFrame(dt); kartFrame(dt); crazySirens(); neonFrame(); rpRecord(dt); if (netRace) { crazyNetHits(); crazyNetSend(dt); } for (const c of allCars) c.hitBy = null;   // los choques de este fotograma ya se han usado
      if (humans[0] && humans[0].race.phase === 'race') { const h0 = humans[0]; if (h0.race.t > 8 && order.length >= 4 && h0.pos === order.length) h0.wasLast = true; if (freeMode && (h0.freeT = (h0.freeT || 0) + dt) > 300) achUnlock('libre'); statAcc.km += Math.abs(humans[0].car.speed()) * dt / 1000; statAcc.t += dt; statAcc.veh = humans[0].car.def.name; }
      for (const hit of props.update(dt, allCars)) propSound(hit);
      for (const c of allCars) if (c.boostT > 0) c.boostT -= dt;
      for (const c of allCars) if (c.nitroT > 0) { const tc = c._tint || (c._tint = (hexRGB(carCol(c)) || [255, 140, 30]).map(x => x / 255)); fx.flame(V.add(c.p, BRR.mv(c.R, c.def.nitro || [0, 0.4, c.def.box.c[2] + c.def.box.h[2]])), V.mul(c.forward(), -4), c.v, tc, (c.boostT || 0) > 0 ? 1.7 : 1.2); }
      humans.forEach(h => fx.car(h.car, dt, 'p' + h.i)); rivals.forEach((r, k) => { if (camDist(r.car.p) < 160) fx.car(r.car, dt, 'r' + k); });
      if (opt.damage !== '0' && !netRace) for (const c of allCars) damageFrame(c, dt);
      for (const c of allCars) dentFrame(c);
      for (const c of allCars) { if ((c.lastHit || 0) > 4) { fx.sparks(V.add(c.p, V.mul(c.forward(), 1.5)), Math.min(25, c.lastHit * 2 * (+opt.parts || 1) | 0));
          if (!c.isPlayer && audio && audio.ctx && snd.bangs && camDist(c.p) < 90) { const b = snd.bangs[Math.random() * snd.bangs.length | 0]; if (b) audio.play(b, { vol: Math.min(0.8, c.lastHit / 14) * (1 - camDist(c.p) / 90), pos: c.p }); } }
        if (!c.isPlayer) c.lastHit = 0; }
      fx.density = +opt.parts || 1; fx.update(dt); for (const c of allCars) c.decoA = (c.decoA || 0) + dt;
    } else for (const h of humans) readInput(h, 0);
    if (netRace) puppets(dt);
    soundFrame(dt); for (const h of humans) h.car.lastHit = 0; hornFrame(dt); if (state === 'race') for (const h of humans) rumble(h, dt);
    if (state === 'replay' && rp) rpCamera(dt); else if (netRace && netRace.role === 'spec' && humans[0]) specCamera(dt); else for (const h of humans) if (!(photo && h.i === 0)) updateCamera(h, dt);
    camShare(); listenerFrame(); if (humans[0]) { headlightsFrame(humans[0].cam.pos); if (state === 'race') weatherFrame(humans[0].cam.pos, dt); }
    // una vista por jugador (con su propio mapa de sombras centrado en su coche)
    const W = canvas.width, H = canvas.height, far = opt.far;
    R.frameBegin(W, H);
    R.gl.clearColor(0, 0, 0, 1); R.viewRect = null; R.gl.disable(R.gl.SCISSOR_TEST); R.gl.viewport(0, 0, W, H); R.gl.clear(R.gl.COLOR_BUFFER_BIT);
    for (const h of humans) {
      const [rx, ry, rw, rh] = h.rect, vx = Math.round(rx * W), vw = Math.round(rw * W), vh = Math.round(rh * H), vy = H - Math.round(ry * H) - vh;
      const cam = h.cam, aspect = vw / Math.max(1, vh), fov = opt.fov * Math.PI / 180 * (humans.length === 2 ? 0.8 : 1) * (1 + (h.fovK = (h.fovK || 0) + ((h.car && h.car.nitroT > 0 ? 0.09 : 0) - (h.fovK || 0)) * Math.min(1, dt * 4)));
      const proj = BRR.M4.persp(fov, aspect, 0.3, far), view = BRR.M4.lookAt(cam.pos, cam.look, cam.up);
      if (R.mode === 1 && R.shadowQ && (humans.length > 1 || (shTick++ & 1) === 0)) {   // con 1 jugador, sombras a 30 Hz
        const c = h.car, fwd = c.forward(); R.shadowBegin(V.madd(c.p, [fwd[0], 0, fwd[2]], R.shadowRange * 0.45));
        R.drawDepth(statics); for (const o of props.list) { const dx = o.pos[0] - c.p[0], dz = o.pos[2] - c.p[2]; if (dx * dx + dz * dz < 40000) R.drawDepth(props.models.get(o.name), BRR.M4.fromRT(o.rot, o.pos)); }
        for (const hh of humans) if (!hh.car.out) R.drawDepth(hh.draw, BRR.M4.fromRT(hh.car.R, hh.car.p));
        for (const r of rivals) if (!r.car.out) R.drawDepth(r.draw, BRR.M4.fromRT(r.car.R, r.car.p));
        R.shadowEnd();
      }
      R.viewRect = [vx, vy, vw, vh];
      R.begin(cam.pos, view, proj, far, lvl.sky);
      R.draw(terrainB); R.draw(statics); props.draw(cam.pos, far); for (const q of netRamps.values()) R.draw(q.up, BRR.M4.fromRT(q.R, q.p)); for (const q of humans) { if (q.ramp) R.draw(q.ramp.up, BRR.M4.fromRT(q.ramp.R, q.ramp.p)); if (q.pipe) R.draw(q.pipe.up, BRR.M4.fromRT(q.pipe.R, q.pipe.p)); }
      for (const hh of humans) drawCar(hh.car, hh.draw, hh === h && ['capo', 'parachoques'].includes(h.camMode || opt.cam) ? (h.camMode || opt.cam) : false, hh === humans[0] ? carDraw : undefined);
      for (const r of rivals) { const d2 = (r.car.p[0] - cam.pos[0]) ** 2 + (r.car.p[2] - cam.pos[2]) ** 2; if (d2 < far * far) drawCar(r.car, r.draw, false, r.dd); }
      kartDraw(); ghostDraw(h);
      fx.draw(BRR.M4.mul(proj, view), cam.pos, view, far, R.fogUsed || lvl.sky);
      // marcador del jugador
      const c = h.car, rc = h.race;
      const kmh = Math.round(Math.abs(c.speed()) * 3.6); h.q('speed').textContent = kmh; if (opt.speedo === 'ana') drawGauge(h, kmh, c);
      if (opt.hnames || (crazy && (crazy.bomb || crazy.zN || crazy.mode === 'polis'))) nameTags(h, BRR.M4.mul(proj, view), vw, vh); else if (h.tagsOn) { h.q('tags').innerHTML = ''; h.tagsOn = false; }
      kartHud(h);
      { const lk = crazyR() ? crazy.mode : ''; if (h.lapLbl !== lk) { h.lapLbl = lk; const el = h.q('h_lap').previousElementSibling; if (el) el.textContent = !lk ? 'VUELTA' : lk === 'bomba' ? 'BOMBA' : lk === 'zombie' ? 'SANOS' : lk === 'polis' ? 'CACOS' : 'META EN'; } }
      h.q('h_lap').textContent = rc.phase === 'finished' ? 'META' : freeMode ? 'LIBRE' : crazyR() ? crazyHud(h) : `${Math.min(rc.lap + 1, rc.laps)}/${rc.laps}`;
      if (h.freeLbl !== freeMode) { h.freeLbl = freeMode; const rows = h.hud.querySelectorAll('.race .row'), L = freeMode ? ['Puntos ', 'Combo ', 'Récord '] : ['Tiempo ', 'Esta vuelta ', 'Mejor vuelta ']; rows.forEach((r, i) => { r.firstChild.nodeValue = L[i]; }); }
      if (freeMode) { const S = h.stunt || {}, best = +(ST.get('brr_stunt_' + lvl.name) || 0); h.q('h_time').textContent = (S.pts || 0) + ' pts'; h.q('h_cur').textContent = S.combo > 1 ? '×' + S.combo : '–'; h.q('h_best').textContent = best + ' pts'; }
      else { h.q('h_time').textContent = fmt(rc.t); h.q('h_cur').textContent = fmt(rc.t - rc.lapStart); }
      const rec = getRec(h), bl = rc.lapTimes.length ? Math.min(...rc.lapTimes) : null;
      if (!freeMode) h.q('h_best').textContent = fmt(bl != null && (!rec.lap || bl < rec.lap) ? bl : rec.lap);
      h.q('wrong').hidden = !rc.wrong;
      { const d = Math.min(100, Math.round(c.dmg || 0)), on = opt.damage !== '0' && !netRace; h.q('h_dmg').hidden = h.q('h_dmgl').hidden = !on; if (on) { h.q('h_dmg').textContent = d + '%'; h.q('h_dmg').style.color = d >= 95 ? '#ff4a3d' : d >= 80 ? '#ffb13d' : ''; } }
      h.q('h_nitro').textContent = c.nitroInf ? '∞' : '▮'.repeat(Math.max(0, c.nitros | 0)) || '–'; h.q('nitrobox').classList.toggle('on', c.nitroT > 0);
      if (h.msgT > 0) { h.msgT -= dt; if (h.msgT <= 0) h.q('msg').hidden = true; }
      drawMinimap(h); ohudDraw(h, dt);
    }
    R.gl.disable(R.gl.SCISSOR_TEST); R.viewRect = null; R.frameEnd();
    if (photoShot) { photoShot = false; achUnlock('foto'); canvas.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'BigRedRacing_' + lvl.name + '_' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }, 'image/png'); }
    fpsN++; fpsT += dt; if (fpsT > 0.5) { fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0;
      if (opt.autoRes !== false && state === 'race') { dynT = (dynT || 0) + 1;
        if (dynT >= 3) { dynT = 0; const old = dyn; if (fps < 50 && dyn > 0.5) dyn = Math.max(0.5, dyn * 0.85); else if (fps > 58 && dyn < 1) dyn = Math.min(1, dyn * 1.07); if (dyn !== old) resize(); } } }
    $('fps').textContent = opt.fps ? fps + ' fps · ' + W + '×' + H : '';
    window.BRR_STATE = { p: car.p, v: car.v, speed: car.speed(), grounded: car.grounded, up: car.R[1][1] };
  }
  requestAnimationFrame(frame);
  // ---------- ¿versión nueva? (GitHub). En la web siempre se juega la última; en el zip y en el programa se avisa ----------
  setTimeout(async () => {
    if (/github\.io$/.test(location.hostname) || !BRR.cloud || !BRR.VERSION) return;
    const L = await BRR.cloud.latest(); if (!L || !BRR.cloud.newer(L.ver, BRR.VERSION)) return;
    const el = $('updbar'); el.hidden = false;
    el.innerHTML = '⬆ <span>Versión nueva</span> <b>' + esc(L.ver) + '</b> · ' + esc(BRR.VERSION) + ' → ' + esc(L.ver) + ' ' + (NAT && NAT.updateGame ? '<button id="upd_go">Actualizar ahora</button>' : '<a href="' + esc(L.url) + '" target="_blank" rel="noopener">Descargar</a>');
    const b = $('upd_go'); if (b) b.onclick = async () => { b.disabled = true; b.textContent = 'Descargando…'; try { await NAT.updateGame(); } catch (e) { b.textContent = 'No se ha podido: ' + (e.message || e); b.disabled = false; } };
  }, 4000);
  // ---------- aviso de fallos: si algo falla se manda solo al tablero de fallos (y se puede añadir una explicación) ----------
  { const seen = new Set();
    const report = (msg, stack) => {
      msg = String(msg || 'Error'); if (seen.has(msg) || seen.size > 5 || /ResizeObserver|Script error/.test(msg)) return; seen.add(msg);
      const el = $('errbar'); if (!el) return;
      const where = netRace ? 'Online' : humans.length > 1 ? 'Pantalla partida' : state === 'race' ? 'En carrera' : orig && orig.on ? 'Menú original' : 'Menú nuevo';
      const q = new URLSearchParams({ template: 'fallo.yml', title: 'Error: ' + msg.slice(0, 80), donde: where, circuito: lvl ? lvl.name + (car ? ' · ' + car.def.name : '') : '',
        descripcion: 'El juego avisó de un error.\n\n```\n' + msg + '\n' + String(stack || '').split('\n').slice(0, 8).join('\n') + '\n```', navegador: navigator.userAgent.slice(0, 160) });
      // se manda solo (sin datos personales) y además se puede añadir una explicación
      let sent = false; try { if (BRR.cloud) BRR.cloud.report({ msg: msg.slice(0, 300), stack: String(stack || '').split('\n').slice(0, 10).join('\n'), ver: BRR.VERSION || '?', where, track: lvl ? lvl.name + (car ? ' · ' + car.def.name : '') : '', ua: navigator.userAgent.slice(0, 160), lang: BRR.lang ? BRR.lang() : '', native: !!NAT, t: Date.now() }).catch(() => { }); sent = true; } catch (e) { }
      el.innerHTML = `<span>⚠️</span> <span>Algo ha fallado.</span> ${sent ? '<span>Aviso enviado automáticamente.</span>' : ''} <a target="_blank" rel="noopener" href="https://github.com/BigRedReport/bigredreport/issues/new?${q}">${sent ? 'Añadir detalles' : 'Enviar el aviso'}</a> <button aria-label="Cerrar">✕</button>`;
      el.hidden = false; el.querySelector('button').onclick = () => { el.hidden = true; }; setTimeout(() => { el.hidden = true; }, 20000);
    };
    addEventListener('error', e => report(e.message, e.error && e.error.stack));
    addEventListener('unhandledrejection', e => report(e.reason && (e.reason.message || e.reason), e.reason && e.reason.stack)); }
  // instalable como app (solo en la versión web; abriendo el archivo directamente no se puede)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });
  let installEv = null; addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEv = e; const b = $('o_install'); if (b) b.hidden = false; });
  $('o_install').onclick = async () => { if (!installEv) return; installEv.prompt(); try { await installEv.userChoice; } catch (e) { } installEv = null; $('o_install').hidden = true; };
  window.BRR_DEBUG = { achUnlock, get front() { return front; }, customRefresh: () => customRefresh(), get opt() { return opt; }, flash: (h, t, s2) => flash(h, t, s2), rpSave, rpList, rpWatch, rpExport, rpImport, toMenu: () => toMenu(), get R() { return R; }, rpOpen: () => rpOpen(), get rp() { return rp; }, get rpRec() { return rpRec; }, get ghost() { return ghosts.find(g => g.mine) || ghosts[0] || null; }, get ghosts() { return ghosts; }, ghostLap: t => ghostLap(humans[0], t), restart: () => restart(), set tt(v) { ttMode = v; }, get crazy() { return crazy; }, get kart() { return kart; }, set crazyPick(v) { crazyPick = v; }, get order() { return order; }, get keys() { return keys; }, get dbg() { return { state, netWait, photo: !!photo, ph: humans[0] && humans[0].race.phase }; }, get KB() { return KB; }, set free(v) { freeMode = v; }, get rampOf() { return humans[0] && humans[0].ramp; }, get rivals() { return rivals; }, get humans() { return humans; }, get race() { return race; }, get audio() { return audio; }, R, startRace, useFiles, get car() { return car; }, get lvl() { return lvl; }, get files() { return files; }, get orig() { return orig; }, net: BRR_net, get props() { return props; } };
})();
