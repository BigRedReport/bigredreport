// Bucle del juego, menús, entrada y cámara
"use strict";
(function () {
  const BRR = window.BRR, V = BRR.V, $ = id => document.getElementById(id);
  const canvas = $('c'); let R;
  try { R = new BRR.Renderer(canvas); } catch (e) { $('err').textContent = e.message; return; }

  // ---------- opciones ----------
  const DEF = { autoRes: true, scale: 100, fov: 70, far: 1500, filter: 'nearest', cam: 'cerca', fps: false, vehicle: 'JEEP', level: 'CITY1', team: 1, laps: 0, vsfx: 80, vmusic: 60, vvoice: 100, vmaster: 100, vengine: 80, vui: 70, vamb: 60, msrc: 'cd', aa: '0', parts: '1', fpslim: '0', hudw: 'full', hudsc: 100, speedo: 'dig', hmini: true, hpos: true, htimes: true, hnitro: true, hmsg: true, hnames: false, hhelp: true, spatial: true, rumble: '1', autopause: true, horn: 'normal', rivals: 5, diff: 2, light: 'moderna', shadows: 2, players: 1, origAI: true };
  let opt = { ...DEF };
  // perfiles: cada uno guarda sus ajustes, récords, campeonato y estadísticas aparte (claves con @perfil)
  let PROF = ''; try { PROF = localStorage.getItem('brr_profile') || ''; } catch (e) { }
  const pkey = k => PROF ? k + '@' + PROF : k;
  const ST = { get: k => { try { return localStorage.getItem(pkey(k)); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(pkey(k), v); } catch (e) { } },
    keys: () => { try { return Object.keys(localStorage).filter(k => PROF ? k.endsWith('@' + PROF) : !k.includes('@')).map(k => PROF ? k.slice(0, -PROF.length - 1) : k); } catch (e) { return []; } } };
  try { Object.assign(opt, JSON.parse(ST.get('brr_opt') || (PROF ? localStorage.getItem('brr_opt') : null) || '{}')); } catch (e) { }
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
    for (const k of ['aa', 'parts', 'fpslim', 'hudw', 'speedo', 'rumble', 'msrc']) { const el = $('o_' + k); el.value = opt[k]; el.onchange = () => { opt[k] = el.value; save(); applyHud(); applyVol(); if (k === 'aa') R.fxaa = opt.aa === '1'; if (k === 'msrc' && state === 'menu') { if (audio) audio.stopMusic(); menuMusic(); } }; }
    for (const k of ['hmini', 'hpos', 'htimes', 'hnitro', 'hmsg', 'hnames', 'hhelp', 'spatial', 'autopause']) { const el = $('o_' + k); el.checked = !!opt[k]; el.onchange = () => { opt[k] = el.checked; save(); applyHud(); }; }
    { const el = $('o_hudsc'); el.value = opt.hudsc; const sv = () => $('o_hudsc_v').textContent = opt.hudsc + '%'; sv(); el.oninput = () => { opt.hudsc = +el.value; sv(); save(); applyHud(); }; }
    for (const b of document.querySelectorAll('.otabs button')) b.onclick = () => { for (const x of document.querySelectorAll('.otabs button')) x.classList.toggle('on', x === b); for (const pg of document.querySelectorAll('.opage')) pg.hidden = pg.dataset.op !== b.dataset.ot; };
    R.fxaa = opt.aa === '1';
    for (const k of ['filter', 'cam']) { const el = $('o_' + k); el.value = opt[k]; el.onchange = () => { opt[k] = el.value; if (k === 'filter') R.setFilterAll(opt.filter); if (k === 'cam') for (const h of humans) { h.camMode = null; h.cam.init = h.cam.posInit = false; } save(); }; }
    $('o_light').value = opt.light; $('o_light').onchange = () => { opt.light = $('o_light').value; R.mode = opt.light === 'original' ? 0 : 1; R.setShadows(R.mode ? opt.shadows : 0); save(); };
    $('o_shadows').value = opt.shadows; $('o_shadows').onchange = () => { opt.shadows = +$('o_shadows').value; R.setShadows(R.mode ? opt.shadows : 0); save(); };
    $('o_fps').checked = opt.fps; $('o_fps').onchange = () => { opt.fps = $('o_fps').checked; save(); };
    $('o_origai').value = opt.origAI !== false ? '1' : '0'; $('o_origai').onchange = () => { opt.origAI = $('o_origai').value === '1'; save(); };
    $('o_auto').checked = opt.autoRes !== false; $('o_auto').onchange = () => { opt.autoRes = $('o_auto').checked; dyn = 1; resize(); save(); };
    $('o_full').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    sync();
  }
  function applyVol() { if (!audio) return; audio.musicSource = opt.msrc;
    audio.setVolumes({ master: opt.vmaster / 100, sfx: opt.vsfx / 100, music: opt.vmusic / 100, voice: opt.vvoice / 100, engine: opt.vengine / 100, ui: opt.vui / 100, amb: opt.vamb / 100 }); }
  // marcador: qué se ve, tamaño y ancho (pantallas ultrapanorámicas)
  function applyHud() {
    const st = document.documentElement.style; st.setProperty('--hudsc', opt.hudsc / 100);
    document.body.classList.toggle('hud169', opt.hudw === '169');
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
  (async () => {
    try {
      const h = window.showDirectoryPicker && await idbGet('dir');
      if (h) { $('again').hidden = false; $('again').textContent = 'Usar la carpeta de la última vez (' + h.name + ')';
        $('again').onclick = async () => { if (await h.requestPermission({ mode: 'read' }) === 'granted') useFiles(await filesFromHandle(h)); }; }
    } catch (e) { }
  })();

  const LEVEL_NAMES = { CITY: 'Ciudad', DIRT: 'Tierra', MOON: 'Marte', WATER: 'Río', SNOW: 'Nieve', RUF: 'Desierto', RIG: 'Plataforma', CHOPPER: 'Helicóptero', TEST: 'Prueba' };
  const VEH_NAMES = { JEEP: 'Jeep', MINI: 'Mini', BEETLE: 'Escarabajo', ATV: 'Quad 6x6', CAT: 'Dumper', MONS: 'Monster truck', TRUCK: 'Camión', JCB: 'Excavadora', CABBET: 'Escarabajo descapotable', CABMINI: 'Mini descapotable',
    PLOUGH: 'Quitanieves', SNOWCAT: 'Máquina de nieve', BUGGY: 'Buggy lunar', JETCAR: 'Jet car', UFO: 'OVNI', INFLATE: 'Lancha neumática', HOVCAR: 'Aerodeslizador', HELI: 'Helicóptero', COPTER: 'Helicóptero ligero' };
  // vehículos de cada circuito (líneas "car" del guion del nivel), como en el original
  const levelCars = {};
  async function carsFor(id) {
    if (levelCars[id]) return levelCars[id];
    try { const A = await files.archive(id + '.LEV'), t = [...A.keys()].find(k => k === id + '.TXT') || [...A.keys()].find(k => k.endsWith('.TXT') && k !== 'VIEW.TXT');
      const txt = BRR.text(A.get(t)).replace(/;[^\n]*/g, '');
      return levelCars[id] = [...txt.matchAll(/^\s*car\s+(\w+)/gm)].map(m => m[1].toUpperCase()).slice(0, 2).filter(n => n !== 'FEHELI' && files.has(n + '.VHC'));   // el original deja elegir los 2 primeros (el 3º es el helicóptero de cámara u oculto)
    } catch (e) { return levelCars[id] = []; }
  }
  async function fillVehicles() {
    const id = $('m_level').value, own = await carsFor(id), vs = $('m_veh'), keep = vs.value || opt.vehicle; vs.innerHTML = '';
    const add = (par, n) => { const o = document.createElement('option'); o.value = n; o.textContent = VEH_NAMES[n] || n; par.appendChild(o); };
    // solo los vehículos del circuito (como en el original)
    // solo los del circuito, salvo en el modo libre (cualquier vehículo en cualquier circuito)
    const list = qmode === 'free' || !own.length ? BRR.VEHICLES.filter(n => files.has(n + '.VHC')) : own; list.forEach(n => add(vs, n));
    vs.value = list.includes(keep) ? keep : list[0] || keep;
    if (!vs.value) vs.selectedIndex = 0;
  }
  function buildMenu() {
    const ls = $('m_level'); ls.innerHTML = '';
    for (const n of files.list('.LEV').filter(n => !n.startsWith('TEST'))) {
      const id = n.replace('.LEV', ''), env = id.replace(/\d+$/, '');
      const o = document.createElement('option'); o.value = id; o.textContent = `${LEVEL_NAMES[env] || env} ${id.slice(env.length)} (${id})`; ls.appendChild(o);
    }
    ls.value = files.has(opt.level + '.LEV') ? opt.level : ls.options[0].value;
    ls.onchange = fillVehicles; fillVehicles();
    $('m_team').value = opt.team; $('m_rivals').value = opt.rivals; $('m_diff').value = opt.diff; $('m_players').value = opt.players || 1;
    $('t_team').value = opt.team; $('t_diff').value = opt.diff;
    BRR.loadFront(files).then(async F => { front = F; try { await makeHeads(); } catch (e) { console.error(e); } renderFront(); await startOrigMenu(); }).catch(e => console.error(e));
  }
  // ---------- caras de los pilotos de cada equipo (TEAMS.TEA), renderizadas a imagen ----------
  // personajes: cuerpo (BLOKE/WOMAN + color del equipo) y cabeza (HEAD1x, 2, 3, 4x, 5, 6) de CHARSCN con su paleta (DRIVER.RAW)
  const CHARS = [{ b: 'BLOKE', h: 'HEAD1', v: 1 }, { b: 'BLOKE', h: 'HEAD2' }, { b: 'BLOKE', h: 'HEAD3' }, { b: 'WOMAN', h: 'HEAD4', v: 1 }, { b: 'WOMAN', h: 'HEAD5' }, { b: 'BLOKE', h: 'HEAD6' }];
  let charArc = null, charPal = null; const charCache = new Map();
  async function charMesh(ci, color, dirty, headOnly) {
    const key = [ci, color, dirty, headOnly].join(); if (charCache.has(key)) return charCache.get(key);
    if (!charArc) { charArc = await files.archive('CHARSCN.SCN'); charPal = BRR.pal6(charArc.get('DRIVER.RAW').subarray(0, 768)); }
    const c = CHARS[ci % CHARS.length], A = charArc, mb = new BRR.MeshBuilder(charPal), tm = n => A.get(n + '.TM');
    const head = BRR.parse3DW(A.get(c.h + (c.v ? color : '') + '.3DW'));
    let top = 0;
    if (!headOnly) { const body = BRR.parse3DW(A.get(c.b + (dirty ? 'B' : '') + color + '.3DW')); top = Math.min(...body.verts.filter(Boolean).map(v => v[1])); mb.addModel(body, v => BRR.toGL(v[0], v[1], v[2]), tm); }
    const hb = Math.max(...head.verts.filter(Boolean).map(v => v[1]));
    mb.addModel(head, v => BRR.toGL(v[0], v[1] + top - hb + 1, v[2]), tm);
    if (!R.L) R.setEnvironment([-0.35, 0.75, 0.55], [0.62, 0.7, 0.82]);
    const out = { up: R.upload(mb), size: (headOnly ? head.radius * 1.2 : (Math.abs(top) + 18)) * BRR.S, cy: headOnly ? 0 : (Math.abs(top) + 14) * 0.5 * BRR.S };
    charCache.set(key, out); return out;
  }
  // cabeza del piloto elegido para llevarla en el coche (en el sitio "head" del vehículo), a tamaño real (~30 cm)
  const driverCache = new Map();
  async function driverHead(ci, team) {
    const key = ci + '_' + team; if (driverCache.has(key)) return driverCache.get(key);
    let out = null;
    try {
      if (!charArc) { charArc = await files.archive('CHARSCN.SCN'); charPal = BRR.pal6(charArc.get('DRIVER.RAW').subarray(0, 768)); }
      const c = CHARS[ci % CHARS.length], A = charArc, head = BRR.parse3DW(A.get(c.h + (c.v ? team : '') + '.3DW')), body = BRR.parse3DW(A.get(c.b + team + '.3DW'));
      // como en el menú: la cabeza encima del cuerpo; en el coche solo se ve de cintura para arriba
      const top = Math.min(...body.verts.filter(Boolean).map(v => v[1])), hb = Math.max(...head.verts.filter(Boolean).map(v => v[1]));
      const hxf = v => BRR.toGL(v[0], v[1] + top - hb + 1, v[2]), bxf = v => BRR.toGL(v[0], v[1], v[2]);
      const H = head.verts.filter(Boolean).map(hxf), B = body.verts.filter(Boolean).map(bxf);
      const hmn = [0, 1, 2].map(a => Math.min(...H.map(g => g[a]))), hmx = [0, 1, 2].map(a => Math.max(...H.map(g => g[a])));
      const bmn = Math.min(...B.map(g => g[1])), bmx = Math.max(...B.map(g => g[1])), waist = bmn + (bmx - bmn) * 0.5;
      const k = 0.3 / Math.max(1e-3, hmx[1] - hmn[1]), cx = (hmn[0] + hmx[0]) / 2, cz = (hmn[2] + hmx[2]) / 2;
      const place = g => [(g[0] - cx) * k, (g[1] - hmn[1]) * k - 0.2, (g[2] - cz) * k];
      const torso = { ...body, faces: body.faces.filter(f => f.idx.some(i => body.verts[i] && bxf(body.verts[i])[1] >= waist)) };
      const mb = new BRR.MeshBuilder(charPal), tm = n => A.get(n + '.TM');
      mb.addModel(torso, v => place(bxf(v)), tm); mb.addModel(head, v => place(hxf(v)), tm);
      out = R.upload(mb);
    } catch (e) { console.warn('piloto', e); }
    driverCache.set(key, out); return out;
  }
  async function makeHeads() {
    front.heads = {}; if (!files.has('CHARSCN.SCN')) return;
    for (let t = 1; t <= 6; t++) { const m = await charMesh(t - 1, t, false, true); front.heads[t] = R.thumb(m.up, { size: 128, yaw: Math.PI + 0.4, pitch: -0.12, dist: m.size * 3.4, target: [0, 0, 0] }); }
  }
  const headImg = (team, sz = 22) => front && front.heads && front.heads[team] ? `<img src="${front.heads[team]}" style="width:${sz}px;height:${sz}px;vertical-align:middle;margin-right:6px;background:${TEAM[team].c}33;border-radius:50%">` : `<span class="dot" style="background:${TEAM[team].c}"></span>`;
  function showTeamHead() { const t = +$('m_team').value; $('d_head').innerHTML = headImg(t, 54) + '<b style="color:' + TEAM[t].c + '">Equipo ' + TEAM[t].n + '</b>'; }
  $('m_team').addEventListener('change', showTeamHead);
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
      carThumb: async (veh, team, level) => {
        const key = veh + team + level; let up = vehCache.get(key);
        if (!up) {
          const A = await files.archive(level + '.LEV'), colk = [...A.keys()].find(k => k.endsWith('.COL'));
          const fake = { pal: BRR.pal6((colk ? A.get(colk) : (await files.archive('ALWAYS.WAP')).get('DEFAULT.COL')).subarray(0, 768)), find: n => A.get(n) || null };
          const d = await BRR.loadVehicle(files, veh, fake, team);
          if (!R.L) R.setEnvironment([-0.35, 0.75, 0.55], [0.62, 0.7, 0.82]);
          // carrocería + ruedas (en su sitio, apoyadas) + piezas decorativas (hélices, orugas, timones)
          const parts = d.wheels.map((w, i) => d.wheelMeshes[i] ? { b: R.upload(d.wheelMeshes[i]), W: BRR.M4.fromRT([[1, 0, 0], [0, 1, 0], [0, 0, 1]], w.c) } : null).filter(Boolean);
          for (const x of d.decoParts) parts.push({ b: R.upload(x.mesh), W: BRR.M4.fromRT(x.R, x.p) });
          up = { body: R.upload(d.mesh), parts, len: Math.max(d.box.h[0], d.box.h[2]) * 2 };
          vehCache.set(key, up);
        }
        const cv = document.createElement('canvas');
        return { frame: a => { const all = [...up.body]; R.thumb(all, { size: 192, yaw: a, pitch: -0.32, dist: up.len * 2.1, target: [0, 0, 0], canvas: cv, parts: up.parts }); return cv; } };
      },
      start: cfg => { fromOrig = true; if (orig.st.logo != null && opt.logo !== 'custom') opt.logo = orig.st.logo; if (orig.st.char != null) opt.char = orig.st.char; tourMode = cfg.tourn; opt.rivals = cfg.rivals; opt.diff = cfg.diff; opt.players = cfg.players; save();
        if (audio) { audio.stopNarration(); } startRace(cfg.level, cfg.veh, cfg.team, 0, cfg.players); },
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
    return `<div class="tcard" data-id="${t.id}">${t.view ? `<img src="${t.view}" alt="">` : `<div style="padding:30px 10px">${t.id}</div>`}<div class="tag"><b>${tname(t)}</b><span>${t.id}</span></div>${extra}</div>`;
  }
  function selectTrack(id, narrate) {
    const t = front.tracks.find(x => x.id === id); if (!t) return;
    $('m_level').value = id; opt.level = id; save(); fillVehicles();
    for (const c of document.querySelectorAll('#tracks .tcard')) c.classList.toggle('on', c.dataset.id === id);
    $('d_img').src = t.view || ''; $('d_place').textContent = t.place || ''; $('d_name').textContent = t.id;
    $('d_diff').textContent = DIFF[t.diff] || ''; $('d_diff').className = 'diff d' + t.diff;
    $('d_desc').textContent = (t.desc || '') + (t.laps ? `\n${t.laps} vueltas.` : '');
    let rec = null; try { for (const k of ST.keys()) if (k.startsWith('brr_rec_' + id + '_')) { const r = JSON.parse(ST.get(k)); if (r.lap && (!rec || r.lap < rec)) rec = r.lap; } } catch (e) { }
    $('d_rec').textContent = rec ? 'Tu mejor vuelta aquí: ' + fmt(rec) : '';
    if (narrate && audio && audio.ctx && t.intro) audio.narrate(t.intro);
    if (qmode === 'tt' && view === 'tt') refreshLB();
    if (globeD) { const pl = t.planet > 0 && front.planets && front.planets[t.planet]; $('d_globe').hidden = t.planet > 0 && !pl; globeD.map = pl || front.world; globeD.noMarks = !!pl;
      if (pl) { globeD.sel = null; globeD.focus(globeD.lon + 60, 15); } else { globeD.sel = globeD.marks.find(m => m.id === id); globeD.focus(t.lon, t.lat); } }
  }
  let globeD = null, globeT = null;
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
    quick: { pane: 'quick', title: 'Carrera rápida', back: 'single' }, tt: { pane: 'quick', title: 'Contrarreloj', back: 'single' }, free: { pane: 'quick', title: 'Modo libre', back: 'single' }, split: { pane: 'quick', title: 'Pantalla partida', back: 'multi' },
    tourn: { pane: 'tourn', title: 'Campeonato', back: 'single' }, online: { pane: 'online', title: 'Online', back: 'multi' },
    mods: { pane: 'mods', title: 'Mods', back: 'home' }, profile: { pane: 'profile', title: 'Piloto y escudería', back: 'home' } };
  let view = 'home', qmode = 'quick', ttMode = false, freeMode = false;
  const sfx = n => { if (audio) { audio.init(); audio.play('SAMPLES/' + n + '.WAV', { vol: 0.5, bus: 'ui' }); } };
  function go(v, silent) {
    if (v === 'options') { $('optpanel').hidden = false; setTimeout(() => navFocusFirst($('optpanel')), 0); return; }
    if (v === 'orig') { if (orig) { opt.menu = 'original'; save(); orig.open(); } return; }
    if (v === 'exit') { show('bye'); state = 'bye'; if (audio) audio.stopMusic(); try { window.close(); } catch (e) { } return; }
    if (v === 'back') v = (VIEWS[view] || {}).back || 'home';
    const W = VIEWS[v]; if (!W) return; view = v;
    for (const p of ['home', 'quick', 'tourn', 'online', 'mods', 'profile']) $('pane_' + p).hidden = p !== W.pane;
    for (const c of ['h_main', 'h_single', 'h_multi']) $(c).hidden = c !== W.col;
    $('m_back').hidden = v === 'home'; $('m_title').textContent = W.title; $('menu').classList.toggle('homeview', W.pane === 'home');
    if (W.pane === 'quick') setQuickMode(v);
    if (v === 'online') onlineEnter(); if (v === 'profile') { renderProfile(); renderHorns(); renderProfiles(); renderStats(); } if (v === 'mods') renderMods(); if (W.pane === 'home') renderHomeProf();
    if (globeT) { globeT.drawn = false; globeT.start(); } if (globeD) { globeD.drawn = false; globeD.start(); }
    setTimeout(() => navFocusFirst(W.pane === 'home' ? $(W.col) : $('pane_' + W.pane)), 0);
  }
  $('m_back').onclick = () => { sfx('BEEP2'); go('back'); };
  for (const b of document.querySelectorAll('.hbtn')) b.onclick = () => { sfx(b.dataset.go === 'back' ? 'BEEP2' : 'BEEP4'); go(b.dataset.go); };
  $('bye_back').onclick = () => { state = 'menu'; show('menu'); go('home'); menuMusic(); };
  function setQuickMode(v) {
    qmode = v; const tt = v === 'tt', split = v === 'split', free = v === 'free';
    $('m_rivals').parentElement.hidden = tt || free; $('m_diff').parentElement.hidden = tt || free; $('m_laps').parentElement.hidden = free;
    $('m_players').parentElement.parentElement.hidden = !split;
    const pl = $('m_players'); for (const o of pl.options) o.hidden = split && o.value === '1';
    if (split && +pl.value < 2) pl.value = String(Math.max(2, opt.players || 2)); if (!split) pl.value = '1';
    if (tt && $('m_laps').value === '0') $('m_laps').value = '3';
    $('go').textContent = tt ? 'Salir a por el récord' : split ? 'Correr (pantalla partida)' : free ? 'Conducir' : 'Correr';
    fillVehicles();
    $('d_lb').hidden = !tt; if (tt) refreshLB();
  }
  // perfil: piloto (6 personajes del original) y escudería (13 logos × 6 colores)
  async function charURL(ci, team) { const k = 'ch' + ci + '_' + team; if (front[k]) return front[k]; const m = await charMesh(ci, team, false, false);
    return front[k] = R.thumb(m.up, { size: 128, yaw: Math.PI + 0.35, pitch: -0.1, dist: m.size * 2.0, target: [0, m.cy, 0] }); }
  async function renderProfile() {
    if (!front) return; const team = opt.team || 1; $('pf_name').value = opt.netName || '';
    $('pf_title').textContent = 'Escudería ' + TEAM[team].n; $('pf_title').style.color = TEAM[team].c;
    const chars = []; for (let i = 0; i < 6; i++) chars.push(`<div class="pitem${(opt.char || 0) === i ? ' on' : ''}" tabindex="0" data-c="${i}"><img src="${await charURL(i, team).catch(() => '')}"><div>Piloto ${i + 1}</div></div>`);
    $('pf_chars').innerHTML = chars.join('');
    const logos = []; for (let i = 0; i < 13; i++) logos.push(`<div class="pitem${(opt.logo || 0) === i ? ' on' : ''}" tabindex="0" data-l="${i}"><img src="${orig ? await orig.logoURL(i, team).catch(() => '') : ''}"></div>`);
    logos.push(`<div class="pitem${opt.logo === 'custom' ? ' on' : ''}" tabindex="0" data-custom="1" title="Tu propio logo (PNG)">${opt.customLogo ? `<img src="${opt.customLogo}" style="background:${TEAM[team].c}">` : '<div style="font-size:42px;line-height:72px">＋</div>'}<div>Logo propio</div></div>`);
    logos.push(`<div class="pitem${opt.paint ? ' on' : ''}" tabindex="0" data-paint="1" title="Color propio (RGB)"><div style="height:40px;border-radius:8px;background:${opt.paint || 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)'}"></div>${opt.paint ? 'Color propio' : 'Color RGB…'}</div>`);
    logos.push(...[1, 2, 3, 4, 5, 6].map(t => `<div class="pitem${team === t ? ' on' : ''}" tabindex="0" data-t="${t}" style="background:${TEAM[t].c}55"><div style="height:40px;border-radius:8px;background:${TEAM[t].c}"></div>${TEAM[t].n}</div>`));
    $('pf_logos').innerHTML = logos.join('');
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
          opt.customLogo = cv2.toDataURL('image/png'); if (opt.customLogo.length > 180000) opt.customLogo = cv2.toDataURL('image/webp', 0.9); delete opt.customLogoHi; opt.logo = 'custom'; save(); renderProfile(); renderHomeProf(); };
        if (opt.customLogo && opt.logo !== 'custom') { opt.logo = 'custom'; save(); renderProfile(); renderHomeProf(); } else inp.click(); return; }
      if (el.dataset.c != null) opt.char = +el.dataset.c; if (el.dataset.l != null) opt.logo = +el.dataset.l; if (el.dataset.t != null) opt.team = +el.dataset.t;
      if (orig) Object.assign(orig.st, { char: opt.char || 0, logo: typeof opt.logo === 'number' ? opt.logo : 0, team: opt.team });
      $('m_team').value = opt.team; $('t_team').value = opt.team; showTeamHead(); save(); const k = el.dataset.c != null ? 'c' : el.dataset.l != null ? 'l' : 't'; renderProfile().then(() => { const n = document.querySelector(`#pane_profile .pitem[data-${k}="${el.dataset[k]}"]`); if (n) n.focus(); }); };
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
  const hexRGB = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  // bocinas
  function renderHorns() {
    $('pf_horns').innerHTML = BRR.HORNS.map(h => `<button data-h="${h.id}" class="${opt.horn === h.id ? 'on' : ''}"${h.id === 'propia' && !customHornOk ? ' disabled title="Carga antes tu sonido"' : ''}>${h.hold ? '🔊 ' : '🎺 '}${esc(h.n)}</button>`).join('');
    for (const b of document.querySelectorAll('#pf_horns button')) b.onclick = () => { opt.horn = b.dataset.h; save(); if (audio) { audio.init(); BRR.playHorn(audio, opt.horn, 1, 0.8, { dur: 0.6 }); } renderHorns(); const n = document.querySelector(`#pf_horns [data-h="${opt.horn}"]`); if (n) n.focus(); };
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
  function renderStats() {
    const S = statsGet(), fav = Object.entries(S.veh || {}).sort((a, b) => b[1] - a[1])[0], hrs = (S.time || 0) / 3600;
    const cell = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
    $('pf_stats').innerHTML = cell(S.races || 0, 'carreras') + cell(S.wins || 0, 'victorias') + cell(S.podiums || 0, 'podios') + cell(S.recLaps || 0, 'récords de vuelta') +
      cell(((S.km || 0)).toFixed(1), 'km recorridos') + cell(hrs >= 1 ? hrs.toFixed(1) + ' h' : Math.round(hrs * 60) + ' min', 'conduciendo') + cell(S.champs || 0, 'campeonatos ganados') + cell(fav ? (VEH_NAMES[fav[0]] || fav[0]) : '–', 'vehículo favorito');
    const R0 = []; for (const k of ST.keys()) { const m = k.match(/^brr_rec_([A-Z0-9]+)_([A-Z0-9]+)_(\d+)$/); if (!m) continue; try { const r = JSON.parse(ST.get(k)); if (r.lap) R0.push([m[1], m[2], r.lap, r.total, +m[3]]); } catch (e) { } }
    R0.sort((a, b) => a[0].localeCompare(b[0]) || a[2] - b[2]);
    $('pf_recs').innerHTML = R0.length ? '<table class="lbt">' + R0.map(r => `<tr><td>${esc(tname(front.tracks.find(t => t.id === r[0]) || { id: r[0] }))} · ${r[0]}</td><td>${VEH_NAMES[r[1]] || r[1]}</td><td>vuelta ${fmt(r[2])}</td><td>${r[3] ? 'carrera (' + r[4] + ' v.) ' + fmt(r[3]) : ''}</td></tr>`).join('') + '</table>' : 'Aún no tienes récords: ¡a correr!';
  }
  $('pf_name').onchange = () => { opt.netName = $('pf_name').value.trim().slice(0, 20); BRR_net.p2p && (BRR_net.p2p.name = opt.netName || 'Piloto'); save(); renderHomeProf(); };
  let spinT = 0;
  async function profSpin(team) { const tok = ++spinT; let m; try { m = await charMesh(opt.char || 0, team, false, false); } catch (e) { return; } const cv = $('pf_view'), g = cv.getContext('2d'); let a = 0;
    const step = () => { if (tok !== spinT || view !== 'profile' || state !== 'menu') return; a += 0.03; const im = R.thumb(m.up, { size: 192, yaw: Math.PI + a, pitch: -0.1, dist: m.size * 2.2, target: [0, m.cy, 0], canvas: document.createElement('canvas') });
      g.clearRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height); setTimeout(step, 50); }; step(); }
  // logo propio (PNG/JPG del jugador), guardado en el navegador como imagen de 40×40
  async function logoRGBAOf(v) {
    try { if (typeof v === 'string' && v.startsWith('data:image')) { const im = new Image(); im.src = v; await im.decode(); const cv = document.createElement('canvas'); cv.width = cv.height = 40; const g = cv.getContext('2d'); g.drawImage(im, 0, 0, 40, 40); return g.getImageData(0, 0, 40, 40).data; }
      if (typeof v === 'number' && orig) return await orig.logoRGBA(v); } catch (e) { } return null; }
  // logo propio en alta resolución (256×256) para la calcomanía del coche
  async function logoHiOf(v) {
    try { if (typeof v === 'string' && v.startsWith('data:image')) { const im = new Image(); im.src = v; await im.decode(); const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
      const k = Math.min(N / im.width, N / im.height); g.imageSmoothingQuality = 'high'; g.drawImage(im, (N - im.width * k) / 2, (N - im.height * k) / 2, im.width * k, im.height * k); return { w: N, h: N, data: new Uint8Array(g.getImageData(0, 0, N, N).data.buffer) }; } } catch (e) { } return null; }
  async function myLogoRGBA() {
    try {
      if (opt.logo === 'custom' && opt.customLogo) { const im = new Image(); im.src = opt.customLogo; await im.decode(); const cv = document.createElement('canvas'); cv.width = cv.height = 40; const g = cv.getContext('2d'); g.drawImage(im, 0, 0, 40, 40); return g.getImageData(0, 0, 40, 40).data; }
      if (typeof opt.logo === 'number' && orig) return await orig.logoRGBA(opt.logo);
    } catch (e) { console.warn(e); }
    return null;
  }
  async function logoImgURL(team) { if (opt.logo === 'custom' && opt.customLogo) return opt.customLogo; return orig ? orig.logoURL(opt.logo || 0, team).catch(() => null) : null; }
  async function renderHomeProf() {
    if (!front) return; const t = opt.team || 1, tok = (renderHomeProf.tok = (renderHomeProf.tok || 0) + 1);
    const u = await logoImgURL(t); if (tok !== renderHomeProf.tok) return;   // solo la última llamada pinta (evita el logo repetido)
    $('h_prof').innerHTML = `${front.heads && front.heads[t] ? `<img src="${front.heads[t]}" style="background:${TEAM[t].c}33;border-radius:50%">` : ''}<div><b style="color:${TEAM[t].c}">${esc(opt.netName || 'Piloto')}</b><br><span class="small">Escudería ${TEAM[t].n}</span></div>` + (u ? `<img src="${u}" style="background:${TEAM[t].c};border-radius:6px">` : '');
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
  // ---------- contrarreloj: clasificación local y online por circuito ----------
  const lbKey = id => 'brr_lb_' + id;
  const lbLocal = id => { try { return JSON.parse(ST.get(lbKey(id))) || []; } catch (e) { return []; } };
  function lbAddLocal(id, row) { const L = lbLocal(id); L.push(row); L.sort((a, b) => a.lap - b.lap); ST.set(lbKey(id), JSON.stringify(L.slice(0, 10))); }
  let lbOnline = null;
  async function lbConnect() {
    if (BRR_net.connected) return true; const url = opt.netUrl && /^wss?:/.test(opt.netUrl) ? opt.netUrl : null;
    try { await BRR_net.connect(url, opt.netName || 'Piloto'); return true; } catch (e) { return false; }
  }
  async function refreshLB() { lbOnline = null; drawLB(); $('d_lbsrc').textContent = '(buscando servidor…)';
    if (await lbConnect()) { BRR_net.send({ t: 'lbget', level: $('m_level').value }); $('d_lbsrc').textContent = '(online)'; }
    else $('d_lbsrc').textContent = '(sin servidor: solo tus tiempos)'; }
  function drawLB() {
    const id = $('m_level').value, rows = lbOnline || lbLocal(id).map(r => ({ ...r, name: r.name || 'Tú' }));
    $('d_lbt').innerHTML = rows.length ? rows.slice(0, 10).map((r, i) => `<tr><td>${i + 1}. ${esc(r.name || '?')} <span class="small">${VEH_NAMES[r.veh] || r.veh || ''}</span></td><td>${fmt(r.lap)}</td></tr>`).join('') : '<tr><td class="small">Aún no hay tiempos. ¡Sé el primero!</td></tr>';
  }
  async function lbSubmit(id, veh, lap, total) {
    const row = { name: opt.netName || 'Piloto', veh, lap, total, team: opt.team, t: Date.now() }; lbAddLocal(id, row);
    if (await lbConnect()) BRR_net.send({ t: 'lbput', level: id, row });
  }
  // ---------- navegación con mando y flechas por cualquier menú (A aceptar, B atrás, cruceta/stick moverse) ----------
  function navRoot() {
    if (!$('optpanel').hidden) return $('optpanel');
    if (state === 'results' && !$('results').hidden) return $('results');
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
    const root = navRoot(); if (!root || (orig && orig.on)) { navPrev = {}; return; }
    const P = pads(); if (!P.length) return;
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
    if (edge(9) && state === 'pause') togglePause();
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
    if (T.wins >= se.need) { T.series++; T.idx = 0; T.wins = 0; msg = `¡Serie superada!` + (T.series >= front.series.length ? ' ¡HAS GANADO EL TORNEO!' : ` Pasas a la serie ${T.series + 1}.`); if (T.series >= front.series.length) { T.over = true; T.series = front.series.length - 1; statsAdd(S => S.champs = (S.champs || 0) + 1); } }
    else if (T.idx >= se.use.length) { T.idx = 0; T.wins = 0; for (const u of se.use) delete T.done[u]; msg = `No has ganado las carreras necesarias (${se.need}). Repite la serie ${T.series + 1}.`; }
    tset(T); return msg;
  }
  $('go').onclick = () => {
    tourMode = false; ttMode = qmode === 'tt'; freeMode = qmode === 'free'; if (audio) audio.init();
    if (!ttMode && !freeMode) { opt.rivals = +$('m_rivals').value; opt.diff = +$('m_diff').value; }
    const pl = qmode === 'split' ? Math.max(2, +$('m_players').value) : 1; if (qmode === 'split') opt.players = pl; save();
    startRace($('m_level').value, $('m_veh').value, +$('m_team').value, freeMode ? 99 : +$('m_laps').value, pl);
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
    opt.level = level; opt.vehicle = veh; opt.team = team; opt.laps = laps; save();
    nPlayers = Math.max(1, Math.min(8, nPlayers | 0)); if (tourMode || net) nPlayers = 1;
    netRace = net; netWait = !!net; netLoaded = new Set(); netT = 0;
    show('loading'); state = 'loading';
    try {
      $('load_msg').textContent = 'Cargando ' + level + '…';
      await new Promise(r => setTimeout(r, 30));
      lvl = await BRR.loadLevel(files, level, s => $('load_msg').textContent = 'Cargando ' + level + ': ' + s + '…');
      R.allTex = []; statics = R.upload(lvl.mesh); terrainB = R.upload(lvl.terrainMesh);
      R.setEnvironment(lvl.sun, lvl.sky); R.setPalAnim(lvl.palAnim, lvl.pal); R.mode = opt.light === 'original' ? 0 : 1; R.setShadows(R.mode ? opt.shadows : 0);
      // jugadores humanos: el equipo elegido para J1 y los siguientes colores para los demás
      $('phuds').innerHTML = ''; humans = [];
      const teams = [team, ...[1, 2, 3, 4, 5, 6].filter(t => t !== team)];
      let def0 = null;
      for (let i = 0; i < nPlayers; i++) {
        const d = await BRR.loadVehicle(files, veh, lvl, teams[i % 6], i === 0 ? { logo: await myLogoRGBA(), logoHi: opt.logo === 'custom' ? await logoHiOf(opt.customLogoHi || opt.customLogo) : null, paint: hexRGB(opt.paint) } : {}); if (!def0) def0 = d;
        const c = new BRR.Car(d, lvl); c.team = teams[i % 6]; c.isPlayer = true; c.human = i; c.headDraw = await driverHead(i === 0 ? (opt.char || 0) : (i % 6), teams[i % 6]);
        const h = newHuman(i, c, new BRR.Race(lvl, laps || lvl.laps), teams[i % 6]); h.draw = R.upload(d.mesh); humans.push(h);
      }
      car = humans[0].car; race = humans[0].race;
      carDraw = { body: humans[0].draw, ...vehDraw(def0) };
      // rivales de la máquina: los demás equipos, con el mismo vehículo
      rivals = []; const nR = ttMode || freeMode ? 0 : Math.min(12 - nPlayers, opt.rivals | 0), skill = [0, 0.86, 0.95, 1.0, 1.06][opt.diff] || 0.95, lanes = [-0.45, 0.45, -0.15, 0.15, 0, -0.3, 0.3, -0.6, 0.6, -0.05, 0.05];
      const profiles = ['experto', 'agresivo', 'torpe', 'prudente', 'imprevisible'].sort(() => Math.random() - .5); while (profiles.length < 11) profiles.push(profiles[profiles.length % 5]);
      if (net) {   // online: los demás jugadores (y en los invitados, los rivales del anfitrión) son "marionetas" movidas por la red
        let ak = 0;
        for (const e of net.order) {
          if (e.id === net.myId) continue;
          $('load_msg').textContent = 'Cargando ' + (e.name || 'rival') + '…';
          const t = e.team || 1, d = await BRR.loadVehicle(files, e.veh || veh, lvl, t, { logo: e.logo != null ? await logoRGBAOf(e.logo) : null, logoHi: typeof e.logo === 'string' ? await logoHiOf(e.logo) : null, paint: hexRGB(e.paint) }), c = new BRR.Car(d, lvl); c.team = t; c.headDraw = await driverHead(e.char != null ? e.char : t - 1, t);
          const rr = new BRR.Race(lvl, laps || lvl.laps), ent = { id: e.id, name: e.name, car: c, race: rr, ai: null, draw: R.upload(d.mesh), dd: vehDraw(d), inp: null, isAI: !!e.ai };
          if (e.ai && net.role === 'host') ent.ai = new BRR.AIDriver(c, rr, (skill) * (0.97 + 0.03 * Math.random()), lanes[ak % lanes.length], e.profile || profiles[ak % profiles.length]);
          else { ent.remote = true; c.puppet = true; ent.race = puppetRace(ent, laps || lvl.laps); }
          if (e.ai) ak++;
          rivals.push(ent);
        }
      }
      // rivales originales: reproducen las carreras grabadas del juego (como en 1995); si se piden más, el resto con la IA nueva
      replayBand = null;
      const recs = !net && opt.origAI !== false ? BRR.loadReplays(lvl) : [];
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
          const vn = cars[rec.veh] || veh, d = await BRR.loadVehicle(files, files.path(vn + '.VHC') ? vn : veh, lvl, t), c = new BRR.Car(d, lvl); c.team = t; c.headDraw = await driverHead(t - 1, t);
          const rr = new BRR.Race(lvl, laps || lvl.laps);
          per.push(BRR.replayPace(rec) * BRR.S / (0.88 * c.topSpeed));
          rivals.push({ car: c, race: rr, ai: null, replay: new BRR.ReplayDriver(c, rr, rec, replayBand, 0.23), draw: R.upload(d.mesh), dd: vehDraw(d), inp: null });
        }
        per.sort((a, b) => a - b); const T = Math.max(0.12, Math.min(0.4, per[per.length >> 1]));
        for (const r of rivals) if (r.replay) r.replay.period = T;
      }
      // IA nueva: sigue las trazadas y el ritmo de las grabaciones originales (una distinta por rival) si el circuito las tiene
      const allRecs = !net ? BRR.loadReplays(lvl) : [], recLines = [];
      if (allRecs.length) { const Tn = rivals.find(r => r.replay) ? rivals.find(r => r.replay).replay.period : 0.24;
        const S = BRR.S, a = -lvl.start.yaw, gx = lvl.start.x / S, gz = -lvl.start.z / S, fw = [Math.sin(a), Math.cos(a)], rt = [Math.cos(a), -Math.sin(a)];
        for (const rec of allRecs) { const sl = lvl.gridSlots[rec.slot] || [0, 0, 0]; const L = BRR.replayLine(lvl, rec, gx + rt[0] * sl[0] + fw[0] * sl[1], gz + rt[1] * sl[0] + fw[1] * sl[1], (lvl.start.a16 || 0) + (sl[2] || 0), Tn); if (L) recLines.push(L); } }
      for (let k = rivals.length; k < (net ? 0 : nR); k++) {
        $('load_msg').textContent = 'Cargando rivales… ' + (k + 1) + '/' + nR;
        const t = teams[(nPlayers + k) % 6], d = await BRR.loadVehicle(files, veh, lvl, t), c = new BRR.Car(d, lvl); c.team = t; c.headDraw = await driverHead(t - 1, t);
        const rr = new BRR.Race(lvl, laps || lvl.laps), ai = new BRR.AIDriver(c, rr, skill * (0.97 + 0.03 * Math.random()), lanes[k], profiles[k]);
        if (recLines.length) ai.line = recLines[k % recLines.length];
        rivals.push({ car: c, race: rr, ai, draw: R.upload(d.mesh), dd: vehDraw(d), inp: null });
      }
      const firstAI = rivals.find(r => r.ai); if (firstAI) { const md = BRR.aiMode(firstAI.car);
        if (!(lvl.aiLines || {})[md] && !(await BRR.loadAILine(lvl, md))) { $('load_msg').textContent = 'Preparando a los pilotos (solo la primera vez)…'; await new Promise(r => setTimeout(r, 30)); BRR.buildAILine(lvl, firstAI.race, md); BRR.saveAILine(lvl, md); } }
      props = new BRR.Props(lvl, R); fx = new BRR.Effects(R.gl, lvl);
      placeGrid(); layoutViews();
      R.setFilterAll(opt.filter);
      $('results').hidden = true; show('hud'); state = 'race'; window.BRR_READY = true;
      $('help').hidden = false; clearTimeout(helpT); helpT = setTimeout(() => $('help').hidden = true, 9000);
      prepMinimap(); await startSounds(level, def0);
      if (net) { BRR_net.game({ k: 'loaded' }); netLoaded.add(net.myId); $('netbar').hidden = false; $('netbar').textContent = 'Esperando a los demás jugadores…'; }
    } catch (e) { console.error(e); $('load_msg').textContent = 'Error: ' + e.message; }
  }
  let helpT = 0, replayBand = null;
  const vdCache = new Map();
  function vehDraw(d) { const k = d.name; if (vdCache.has(k) && vdCache.get(k).lvl === lvl) return vdCache.get(k).v;
    const v = { brake: d.brake ? R.upload(d.brake) : null, wheels: d.wheelMeshes.map(m => m ? R.upload(m) : null), deco: d.decoParts.map(x => ({ ...x, draw: R.upload(x.mesh) })) }; vdCache.set(k, { lvl, v }); return v; }
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
    for (const r of rivals) { r.race.reset(); if (r.ai) r.ai.reset(); }
    for (const h of humans) { h.race.reset(); h.cam.init = false; h.cam.posInit = false; h.done = false; h.q('done').hidden = true; h.q('msg').hidden = true; }
    for (const c of all) c.nitros = lvl.nitros;
    if (props) props.reset(); if (fx) fx.reset();
  }
  function restart() {
    if (!lvl) return; placeGrid(); leader = null;
    $('results').hidden = true; state = 'race'; show('hud'); last = performance.now();
  }
  // ---------- sonido ----------
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
      S2.engine = def.engineWav ? await audio.loop(def.engineWav, 0, 'engine') : null;
      for (const [k, n] of Object.entries(SK)) if (files.path('GEN/' + n + '.WAV')) S2.skidL[k] = await audio.loop('GEN/' + n + '.WAV', 0);
      for (const [k, n] of Object.entries(GR)) if (files.path('GEN/' + n + '.WAV')) S2.groundL[k] = await audio.loop('GEN/' + n + '.WAV', 0);
      audio.loops.push(S2.engine, ...Object.values(S2.skidL), ...Object.values(S2.groundL));
    }
    snd.rivEng = []; if (def.engineWav && rivals.length) for (let k = 0; k < Math.min(3, rivals.length); k++) { const l = await audio.loop(def.engineWav, 0, 'engine', [0, 0, 0]); snd.rivEng.push(l); audio.loops.push(l); }
    snd.nextGeneral = 18 + Math.random() * 15;
    audio.stopNarration(); audio.stopMusic();
    const tm = front && front.tracks.find(t => t.id === level);
    let seed = 0; for (const ch of level) seed = seed * 31 + ch.charCodeAt(0);
    (tm && tm.music ? audio.playTrack(tm.music) : audio.playMusic(Math.abs(seed))).then(n => { if (n) $('trackinfo').textContent = 'CD pista ' + n; });
  }
  function soundFrame(dt) {
    if (!audio || !audio.ctx) return;
    const paused = state !== 'race', mix = humans.length > 1 ? 0.6 : 1;
    for (const h of humans) {
      const c = h.car, S2 = h.snd; if ((c.lastHit || 0) > (h.rbHit || 0)) h.rbHit = c.lastHit; if (c.landed) h.rbLand = Math.max(h.rbLand || 0, c.landed); if (!S2) continue;
      if (S2.engine) S2.engine.set(paused ? 0 : (0.35 + 0.25 * (h.inp ? h.inp.throttle : 0)) * mix, 0.8 + c.rpm() / 255 * 1.1);
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
      if (c.lastHit > 3) { const b = snd.bangs[Math.random() * snd.bangs.length | 0]; if (b) audio.play(b, { vol: Math.min(1, c.lastHit / 12) });
        if (c.lastHit > 9) { const v = snd.pickVoice('CRASH') || snd.pickVoice('CRAS'); if (v) audio.voice(v); } }
      c.lastHit = 0;
      if (c.landed) { audio.play('GEN/BIG.WAV', { vol: Math.min(1, c.landed / 10) }); c.landed = 0;
        if (c.lastAir > 1.0) { const v = snd.pickVoice('JUMP'); if (v) audio.voice(v); } }
      const up = c.R[1][1]; if (up < 0.1 && !S2.rolled) { S2.rolled = true; const v = snd.pickVoice('ROLL'); if (v) audio.voice(v); } if (up > 0.8) S2.rolled = false;
    }
    if (snd.rivEng && snd.rivEng.length) {
      const dmin = c => Math.min(...humans.map(h => Math.hypot(c.p[0] - h.cam.pos[0], c.p[1] - h.cam.pos[1], c.p[2] - h.cam.pos[2])));
      const near = rivals.map(r => ({ c: r.car, d: dmin(r.car) })).sort((a, b) => a.d - b.d);
      snd.rivEng.forEach((l, k) => { const n = near[k]; if (!l || !n) return; l.set(paused ? 0 : 0.3 * Math.max(0, 1 - n.d / 90) ** (audio.spatial ? 1 : 2), 0.8 + n.c.rpm() / 255 * 1.1, n.c.p); });
    }
    if (!paused && race.phase === 'race') { snd.nextGeneral -= dt; if (snd.nextGeneral < 0) { snd.nextGeneral = 20 + Math.random() * 20; const v = snd.pickVoice('GENRAL'); if (v) audio.voice(v); } }
  }
  // ---------- eventos de carrera -> marcador y sonido ----------
  const fmt = t => { if (t == null || !isFinite(t)) return '–:––.––'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
  function flash(h, text, secs = 2, cls = '') { const e = h.q('msg'); e.textContent = text; e.className = 'msg ' + cls; e.hidden = false; h.msgT = secs; }
  const recKey = h => 'brr_rec_' + lvl.name + '_' + h.car.def.name + '_' + h.race.laps;
  function getRec(h) { try { return JSON.parse(ST.get(recKey(h)) || '{}'); } catch (e) { return {}; } }
  function handleEvents(h) {
    const first = h === humans[0];   // los sonidos comunes (cuenta atrás) solo una vez
    for (const e of h.race.ev.splice(0)) {
      if (e.type === 'beep') { flash(h, String(e.n), 1, 'big'); if (first && audio) { audio.play('SAMPLES/BEEP3.WAV'); if (e.n === 3 && snd.pickVoice) { const v = snd.pickVoice('READYGO'); if (v) audio.voice(v, true); } } }
      if (e.type === 'go') { flash(h, '¡YA!', 1, 'big'); if (first && audio) audio.play('SAMPLES/BEEP4.WAV'); }
      if (e.type === 'check') { flash(h, `Control ${e.num}/${e.of}  ·  ${fmt(e.split)}`, 2); if (audio) audio.play('GEN/CHECKPOI.WAV'); }
      if (e.type === 'missed') { flash(h, '¡Te has saltado un control! Vuelve atrás', 2.5, 'warn'); if (audio) audio.play('GEN/CHCKMIS.WAV'); }
      if (e.type === 'wrong') { if (audio) audio.play('GEN/WRGWAY.WAV'); }
      if (e.type === 'lap') {
        const rec = getRec(h), best = !rec.lap || e.lapTime < rec.lap; if (best) { rec.lap = e.lapTime; ST.set(recKey(h), JSON.stringify(rec)); }
        flash(h, `Vuelta ${e.lap}: ${fmt(e.lapTime)}${best ? '  ·  ¡récord!' : ''}${e.final ? '  ·  ÚLTIMA VUELTA' : ''}`, 3);
        if (audio) audio.play(e.final ? 'GEN/FINLAP.WAV' : 'GEN/LAPCOM.WAV');
      }
      if (e.type === 'finish') humanFinished(h, e);
    }
  }
  function humanFinished(h, e) {
    const rec = getRec(h); h.newLap = !rec.lap || e.lapTime < rec.lap; h.newTotal = !rec.total || e.total < rec.total;
    if (h.newLap) rec.lap = e.lapTime; if (h.newTotal) rec.total = e.total;
    ST.set(recKey(h), JSON.stringify(rec));
    h.done = true; h.total = e.total; updatePositions(0); h.pos = order.findIndex(o => o.h === h) + 1;
    if (h === humans[0] && !freeMode) { const withRivals = order.length > 1; statsAdd(S => { S.races = (S.races || 0) + 1; if (withRivals && h.pos === 1) S.wins = (S.wins || 0) + 1; if (withRivals && h.pos <= 3) S.podiums = (S.podiums || 0) + 1; if (h.newLap) S.recLaps = (S.recLaps || 0) + 1; }); statsFlush(); }
    if (humans.length > 1) { h.q('done').textContent = h.pos === 1 ? '¡1º! ¡GANADOR!' : h.pos + 'º'; h.q('done').hidden = false; }
    if (audio) { const v = snd.pickVoice && (snd.pickVoice('FINISH') || snd.pickVoice('GAMEOVER')); if (v) audio.voice(v, true); }
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
    const who = o => o.h ? (multi ? 'Jugador ' + (o.h.i + 1) : 'Tú') : o.name && !o.isAI ? o.name + ' <small style="color:var(--mut)">(online)</small>' : 'Equipo ' + TEAM[o.car.team].n + (o.ai ? ' <small style="color:var(--mut)">(' + o.ai.P.name.toLowerCase() + ')</small>' : '');
    const posRows = (rivals.length || multi) ? `<tr class="hdr"><td colspan="2">Clasificación</td></tr>` + order.map((o, i) => `<tr${o.h ? ' class="me"' : ''}><td>${headImg(o.car.team, 26)}${i + 1}. ${who(o)}</td><td>${o.race.finishT != null ? fmt(o.race.finishT) : 'en carrera'}</td></tr>`).join('') : '';
    const laps = multi ? '' : `<tr class="hdr"><td colspan="2">Tus vueltas</td></tr>` + h0.race.lapTimes.map((t, i) => `<tr${t === bestLap ? ' class="best"' : ''}><td>Vuelta ${i + 1}</td><td>${fmt(t)}</td></tr>`).join('') + `<tr class="tot"><td>Total</td><td>${fmt(h0.total)}</td></tr>`;
    $('r_list').innerHTML = posRows + laps;
    const myPos = h0.pos || order.findIndex(o => o.h === h0) + 1;
    $('r_rec').textContent = multi ? '' : (h0.newTotal ? '¡Nuevo récord de carrera! ' : 'Récord de carrera: ' + fmt(rec.total) + '. ') + (h0.newLap ? '¡Nueva mejor vuelta!' : 'Mejor vuelta: ' + fmt(rec.lap) + '.');
    const winner = order[0];
    $('r_title').textContent = multi ? (winner.h ? '¡Gana el Jugador ' + (winner.h.i + 1) + '!' : 'Gana el equipo ' + TEAM[winner.car.team].n) + ' · ' + lvl.name
      : rivals.length ? (myPos === 1 ? '¡Has ganado!' : `Has quedado ${myPos}º`) + ' · ' + lvl.name : 'Carrera terminada · ' + lvl.name;
    if (ttMode && !multi && bestLap) { lbSubmit(lvl.name, car.def.name, bestLap, h0.total); $('r_title').textContent = 'Contrarreloj · ' + lvl.name + ' · mejor vuelta ' + fmt(bestLap); }
    if (tourMode && rivals.length) { $('r_rec').textContent += ' ' + tournResult(myPos); $('r_again').hidden = true; $('r_menu').textContent = 'Volver al torneo'; }
    else { $('r_again').hidden = false; $('r_menu').textContent = 'Menú'; }
    if (netRace) { netRace.resultIds = order.map(o => o.h ? { id: BRR_net.id, name: opt.netName || 'Piloto' } : { id: o.id, name: o.name || 'IA' }).filter(x => x.id);
      clearTimeout(netResT); netResT = setTimeout(() => { if (state === 'results' && netRace) toMenu(); }, 12000); $('r_menu').textContent = 'Volver a la sala'; }
    if (front && front.bg.results) $('results').style.backgroundImage = `url(${front.bg.results})`;
    state = 'results';
    if (orig && fromOrig && opt.menu !== 'moderno') {   // resultados en la pantalla original (RESULSCN)
      const rows = order.slice(0, 6).map((o, i) => `${i + 1}. ${o.h ? (multi ? 'JUGADOR ' + (o.h.i + 1) : 'TU') : 'EQUIPO ' + TEAM[o.car.team].n.toUpperCase()}  ${o.race.finishT != null ? fmt(o.race.finishT) : '--'}`);
      if (audio) { audio.stopAll(); audio.playTrack(2); }
      orig.results(rows, $('r_title').textContent.replace(' · ', ' - ').toUpperCase().slice(0, 26), $('r_rec').textContent.toUpperCase().slice(0, 48), () => { orig.close(); toMenu(); });
      return;
    }
    $('results').hidden = false;
  }
  $('r_again').onclick = restart;
  function toMenu() {
    if (netRace) { const ids = netRace.resultIds; netRace = null; netWait = false; clearTimeout(netResT); $('netbar').hidden = true; if (BRR_net.isHost && BRR_net.room) netAfterRace(ids); fromOrig = false; if (orig) orig.close(); opt.menu = 'moderno';
      setTimeout(() => { go('online'); netRenderRoom(); }, 50); }
    statsFlush(); clearTimeout(finishTimer); finishTimer = null; $('results').hidden = true; if (audio) { audio.stopAll(); audio.stopMusic(); }
    state = 'menu'; show('menu'); renderTourn(); selectTrack(opt.level, false); tourMode = false; ttMode = false; freeMode = false; go(view, true); if (qmode === 'tt' && view === 'tt') refreshLB();
    if (orig && fromOrig && opt.menu !== 'moderno') { fromOrig = false; state = 'origmenu'; if (!orig.on) { orig.on = true; orig.root.hidden = false; orig.loop(); } if (audio) audio.playTrack(2); orig.globe(); }
    else menuMusic();
  }
  $('r_menu').onclick = toMenu;
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
    for (const gt of h.race.gates) {
      const nx = gt.num === h.race.expected; g.fillStyle = gt.num === 0 ? '#fff' : nx ? '#ffd23f' : 'rgba(255,255,255,.35)';
      g.beginPath(); g.arc(X(gt.c), Y(gt.c), nx ? 6 : 3.5, 0, 7); g.fill(); if (nx) { g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke(); }
    }
    const dot = c2 => { g.fillStyle = TEAM[c2.team].c; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(X(c2.p), Y(c2.p), 6, 0, 7); g.fill(); g.stroke(); };
    for (const r of rivals) dot(r.car); for (const o of humans) if (o !== h) dot(o.car);
    const cc = h.car, f = cc.forward(), a = Math.atan2(f[0], -f[2]);
    g.save(); g.translate(X(cc.p), Y(cc.p)); g.rotate(a); g.fillStyle = TEAM[cc.team].c; g.strokeStyle = '#fff'; g.lineWidth = 2;
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
      if (e.code === 'KeyC' && humans[0]) cycleCam(humans.find(x => x.ctl && (x.ctl.kb === 'all' || x.ctl.kb === 'A')) || humans[0]);
      if (e.code === 'KeyR') { const h = humans.find(x => x.ctl && (x.ctl.kb === 'all' || x.ctl.kb === 'A')); if (h) recoverHuman(h); }
      if (e.code === 'Backspace') { const h = humans.find(x => x.ctl && x.ctl.kb === 'B'); if (h) recoverHuman(h); }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Backspace'].includes(e.code)) e.preventDefault();
    }
  });
  addEventListener('keyup', e => keys[e.code] = false);
  const CAMS = ['cerca', 'lejos', 'alta', 'capo', 'parachoques', 'tv'], CAM_N = { cerca: 'persecución cerca', lejos: 'persecución lejos', alta: 'persecución alta', capo: 'cabina', parachoques: 'parachoques', tv: 'televisión' };
  function cycleCam(h = humans[0]) { const cur = h.camMode || opt.cam, nx = CAMS[(CAMS.indexOf(cur) + 1) % CAMS.length]; h.camMode = nx; h.cam.init = h.cam.posInit = false; if (h.i === 0) { opt.cam = nx; $('o_cam').value = nx; save(); } flash(h, 'Cámara: ' + CAM_N[nx], 1.2); }
  // comparador: iluminación original de 1995 / moderna, en plena carrera
  function toggleLight() { opt.light = opt.light === 'original' ? 'moderna' : 'original'; $('o_light').value = opt.light; R.mode = opt.light === 'original' ? 0 : 1; R.setShadows(R.mode ? opt.shadows : 0); save();
    for (const h of humans) flash(h, opt.light === 'original' ? 'Iluminación original (1995)' : 'Iluminación moderna', 1.4); }
  // pausa automática al cambiar de ventana o de pestaña (o al suspender el ordenador)
  const autoPause = () => { if (opt.autopause !== false && state === 'race' && !netRace && !photo) togglePause(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); }); addEventListener('blur', autoPause);
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
  function togglePause() {
    if (netRace && state === 'race') { $('pause').hidden = !$('pause').hidden; return; }
    if (state === 'race') { state = 'pause'; show('pause'); if (audio && audio.ctx) audio.ctx.suspend(); }
    else if (state === 'pause') { state = 'race'; show('hud'); last = performance.now(); if (audio && audio.ctx) audio.ctx.resume(); }
  }
  $('p_resume').onclick = togglePause;
  $('p_menu').onclick = () => { if (audio && audio.ctx) audio.ctx.resume(); toMenu(); };
  $('p_restart').onclick = () => { if (audio && audio.ctx) audio.ctx.resume(); restart(); };
  for (const b of document.querySelectorAll('.optbtn')) b.onclick = () => { $('optpanel').hidden = !$('optpanel').hidden; };
  const pads = () => (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter(g => g && g.connected);
  function assignControls() {
    const P = pads(), n = humans.length;
    if (n === 1) { humans[0].ctl = { kb: 'all', pad: P.length ? P[0].index : null }; return; }
    const kbN = Math.min(2, Math.max(0, n - P.length)); let pi = 0;
    humans.forEach((h, i) => { h.ctl = i < kbN ? { kb: kbN === 1 ? 'all' : (i === 0 ? 'A' : 'B'), pad: null } : { kb: null, pad: P[pi] ? P[pi++].index : null }; });
  }
  const KB = {
    all: { up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], hb: ['Space'], nitro: ['ShiftLeft', 'ShiftRight', 'KeyN'], climb: ['KeyE'], dive: ['KeyQ'], lookL: ['KeyJ'], lookR: ['KeyL'], lookB: ['KeyK'] },
    A: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], hb: ['Space'], nitro: ['ShiftLeft'], climb: ['KeyE'], dive: ['KeyQ'], horn: ['KeyH'], lookL: [], lookR: [], lookB: [] },
    B: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], hb: ['ControlRight'], nitro: ['Enter', 'ShiftRight'], climb: ['PageUp'], dive: ['PageDown'], horn: ['Numpad0', 'Backslash'], lookL: [], lookR: [], lookB: [] },
  };
  function readInput(h, dt) {
    const inp = { steer: 0, throttle: 0, brake: 0, handbrake: false, pitchAir: 0, lookX: 0, lookY: 0 }, ctl = h.ctl || {};
    const any = l => l.some(k => keys[k]);
    if (ctl.kb) {
      const K = KB[ctl.kb], kbSteer = (any(K.right) ? 1 : 0) - (any(K.left) ? 1 : 0);
      h.steerKb += (kbSteer - h.steerKb) * Math.min(1, dt * (kbSteer ? 6 : 10)); inp.steer = h.steerKb;
      inp.throttle = any(K.up) ? 1 : 0; inp.brake = any(K.down) ? 1 : 0; inp.handbrake = any(K.hb); inp.pitchAir = inp.throttle - inp.brake;
      if (any(K.lookL) || any(K.lookR)) inp.lookX = (any(K.lookR) ? 1 : 0) - (any(K.lookL) ? 1 : 0); if (any(K.lookB)) inp.lookX = 1;
      if (any(K.nitro)) inp.nitro = true; if (K.horn && any(K.horn)) inp.horn = true; if (any(K.climb) || any(K.dive)) inp.climb = (any(K.climb) ? 1 : 0) - (any(K.dive) ? 1 : 0);
    }
    const gp = ctl.pad != null ? pads().find(g => g.index === ctl.pad) : null;
    if (gp) {
      const dz = (v, z = .12) => Math.abs(v) < z ? 0 : (v - Math.sign(v) * z) / (1 - z);
      const b = i => gp.buttons[i] ? gp.buttons[i].value : 0, pressed = i => gp.buttons[i] && gp.buttons[i].pressed;
      const sx = dz(gp.axes[0] || 0); if (sx) inp.steer = Math.sign(sx) * sx * sx * 0.4 + sx * 0.6;
      inp.throttle = Math.max(inp.throttle, b(7), b(0)); inp.brake = Math.max(inp.brake, b(6), b(2));
      inp.handbrake = inp.handbrake || pressed(1) || pressed(5); inp.pitchAir = dz(gp.axes[1] || 0) * -1 || inp.pitchAir;
      inp.lookX = dz(gp.axes[2] || 0, 0.15) || inp.lookX; inp.lookY = dz(gp.axes[3] || 0, 0.15);   // stick derecho: mirar alrededor
      if (pressed(4)) inp.nitro = true;                                                    // LB: nitro
      if (pressed(10) || pressed(11)) inp.horn = true;                                     // L3 / R3: bocina
      if (pressed(12) || pressed(13)) inp.climb = (pressed(12) ? 1 : 0) - (pressed(13) ? 1 : 0);   // cruceta: subir/bajar (helicóptero)
      const edge = i => pressed(i) && !h.padPrev[i];
      if (edge(9)) togglePause();
      // View/Select: suelto = cambiar de cámara · mantenido + Y = iluminación original/moderna · mantenido + X = modo foto
      if (pressed(8) && edge(3)) { toggleLight(); h.selCombo = true; } else if (state === 'race' && edge(3) && !photo) recoverHuman(h);
      if (pressed(8) && edge(2) && h.i === 0) { togglePhoto(); h.selCombo = true; }
      if (!pressed(8) && h.padPrev[8]) { if (!h.selCombo && state === 'race' && !photo) cycleCam(h); h.selCombo = false; }
      h.padPrev = {}; gp.buttons.forEach((x, i) => h.padPrev[i] = x.pressed);
    }
    if (h.i === 0 && window.BRR_TEST_INPUT) Object.assign(inp, window.BRR_TEST_INPUT);
    if (h.race.phase === 'countdown') { inp.throttle = 0; inp.handbrake = true; }
    if (h.race.phase === 'finished') { inp.throttle = 0; inp.brake = 0.4; inp.steer = 0; }
    h.inp = inp; return inp;
  }
  setInterval(() => { const P = pads(); $('pad').textContent = P.length ? 'Mandos: ' + P.map(g => g.id.replace(/\(.*?\)/g, '').trim().slice(0, 28)).join(' · ') : 'Mando: conéctalo y pulsa un botón para que el navegador lo detecte.'; }, 1500);

  // recolocar: en el último control pasado, mirando hacia el siguiente (o en la salida)
  function recoverHuman(h) {
    const g = h.race.lastGate, c = h.car;
    if (!g) { const s = lvl.start; c.reset(s.x, s.z, s.yaw); }
    else { const f = V.mul(g.az, g.fwdSign || 1); c.reset(g.c[0] + f[0] * 4, g.c[2] + f[2] * 4, Math.atan2(-f[0], -f[2]), g.c[1] + 1); }
    h.race.prev = c.p.slice(); h.cam.init = false;
  }
  // ======================= online =======================
  // Cada jugador simula su coche y manda su estado 20 veces por segundo; el anfitrión además simula y manda los rivales de la IA.
  // Los coches de los demás son "marionetas": se colocan suavemente donde dice la red (con extrapolación por su velocidad).
  let netWaitT = 0;
  const R3 = a => a.map(x => Math.round(x * 1000) / 1000);
  function netFrame(dt) {
    netT += dt; if (netT < 0.05) return; netT = 0;
    const h = humans[0], c = h.car;
    BRR_net.game({ k: 's', p: R3(c.p), q: R3(c.q), v: R3(c.v), st: +c.steerAng.toFixed(3), n: c.nitroT > 0 ? 1 : 0, sc: +h.race.score().toFixed(3), f: h.race.finishT, lap: h.race.lap });
    if (netRace.role === 'host') {
      const ai = rivals.filter(r => r.ai);
      if (ai.length) BRR_net.game({ k: 'ai', a: ai.map(r => ({ id: r.id, p: R3(r.car.p), q: R3(r.car.q), v: R3(r.car.v), st: +r.car.steerAng.toFixed(3), sc: +r.race.score().toFixed(3), f: r.race.finishT })) });
      if (netWait) { netWaitT += 0.05; const need = netRace.order.filter(e => !e.ai).map(e => e.id);
        if (need.every(id => netLoaded.has(id)) || netWaitT > 30) { BRR_net.game({ k: 'go' }); netGo(); } }
    }
  }
  function netGo() { netWait = false; netWaitT = 0; for (const h of humans) h.race.reset(); for (const r of rivals) { r.race.reset(); if (r.ai) r.ai.reset(); } $('netbar').hidden = true; last = performance.now(); }
  function puppets(dt) {
    const now = performance.now() / 1000;
    for (const r of rivals) { if (!r.remote || !r.tgt) continue; const t = r.tgt, c = r.car, age = Math.min(0.3, now - t.time), k = Math.min(1, dt * 12);
      const tp = [t.p[0] + t.v[0] * age, t.p[1] + t.v[1] * age, t.p[2] + t.v[2] * age];
      if (V.len(V.sub(tp, c.p)) > 15) c.p = tp; else c.p = V.add(c.p, V.mul(V.sub(tp, c.p), k));
      let q = t.q; if (c.q[0] * q[0] + c.q[1] * q[1] + c.q[2] * q[2] + c.q[3] * q[3] < 0) q = q.map(x => -x);
      const nq = c.q.map((x, i) => x + (q[i] - x) * k), l = Math.hypot(...nq) || 1; c.q = nq.map(x => x / l);
      c.v = t.v; c.steerAng = t.st || 0; c.nitroT = t.n ? 0.1 : 0;
      const sp = V.dot(c.v, c.forward()); for (const w of c.W) { w.spin += sp / (w.radius || 0.3) * dt; w.len = 0.3; }
    }
  }
  const netEnt = id => rivals.find(r => r.id === id);
  BRR_net.on('g', m => {
    const d = m.d || {};
    if (d.k === 'rtc') { rtcSignal(m.from, d); return; }
    if (d.k === 'hn') { const e = rivals.find(r => r.id === m.from); if (!e || !audio || !audio.ctx) return; const info = BRR.hornInfo(d.t);
      if (d.on) { if (e.hornH) e.hornH.stop(); e.hornH = audio.horn(1, 0.7, null, d.t, e.car.p); } else if (e.hornH && info.hold) { e.hornH.stop(); e.hornH = null; } return; }
    if (d.k === 'start') { if (!netRace && state !== 'race') netStart(d); return; }
    if (!netRace) return;
    const now = performance.now() / 1000;
    if (d.k === 'loaded') netLoaded.add(m.from);
    else if (d.k === 'go') { if (netRace.role !== 'host') netGo(); }
    else if (d.k === 's') { const e = netEnt(m.from); if (e) { e.tgt = { ...d, time: now }; e.sc = d.sc; e.fin = d.f; } }
    else if (d.k === 'ai') { for (const a of d.a || []) { const e = netEnt(a.id); if (e && e.remote) { e.tgt = { ...a, time: now }; e.sc = a.sc; e.fin = a.f; } } }
  });
  BRR_net.on('closed', m => { if (netRace && state === 'race') { netRace.lost = true; $('netbar').hidden = false; $('netbar').textContent = m.why || 'Partida cerrada'; } netRenderRoom(); });
  BRR_net.on('disconnect', () => { $('n_status').textContent = 'Desconectado (se reintentará al volver a Online).'; $('n_room').hidden = true; if (netRace && state === 'race') { $('netbar').hidden = false; $('netbar').textContent = 'Conexión perdida con el servidor'; } });
  function netStart(d) {
    const me = BRR_net.id, e = d.order.find(x => x.id === me); if (!e) return;
    clearTimeout(netResT); $('results').hidden = true; netRace = null;
    tourMode = false; fromOrig = false; opt.diff = d.diff || 2;
    if (orig && orig.on) orig.close();
    startRace(d.level, e.veh, e.team, d.laps || 0, 1, { role: BRR_net.isHost ? 'host' : 'client', myId: me, order: d.order });
  }
  // ---------- lobby online ----------
  function netTracks() { return front ? front.tracks : []; }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const myLogo = () => opt.logo === 'custom' ? opt.customLogo || null : (typeof opt.logo === 'number' ? opt.logo : null);
  const myData = () => ({ team: +$('n_team').value, veh: $('n_veh').value, ready: $('n_ready').checked, logo: myLogo(), char: opt.char || 0, paint: opt.paint || null });
  const tById = id => netTracks().find(x => x.id === id);
  const tLabel = id => { const t = tById(id); return t ? (t.place || t.id) + ' · ' + t.id : id || '?'; };
  $('n_url').value = opt.netUrl && /^wss?:/.test(opt.netUrl) ? opt.netUrl : '';
  let listT = null;
  async function onlineEnter() {
    $('n_team').value = opt.team || 1;
    if (!BRR_net.connected) { $('n_status').textContent = 'Conectando…';
      try { await BRR_net.connect(opt.netUrl && /^wss?:/.test(opt.netUrl) ? opt.netUrl : null, opt.netName || 'Piloto'); $('n_status').textContent = BRR_net.mode === 'server' ? 'Conectado al servidor ' + opt.netUrl : 'Conectado. Tu nombre: ' + (opt.netName || 'Piloto'); }
      catch (e) { $('n_status').textContent = e.message; } }
    BRR_net.list(); clearInterval(listT); listT = setInterval(() => { if (view === 'online' && state === 'menu') BRR_net.list(); else clearInterval(listT); }, 4000);
    netRenderRoom();
  }
  $('n_conn').onclick = async () => { opt.netUrl = $('n_url').value.trim(); save(); if (BRR_net.room) BRR_net.leave(); BRR_net.use(/^wss?:/.test(opt.netUrl) ? 'server' : 'p2p');
    $('n_status').textContent = 'Conectando…'; try { await BRR_net.connect(opt.netUrl || null, opt.netName || 'Piloto'); $('n_status').textContent = 'Conectado' + (opt.netUrl ? ' a ' + opt.netUrl : '') + '.'; BRR_net.list(); } catch (e) { $('n_status').textContent = e.message; } };
  $('n_refresh').onclick = () => BRR_net.list();
  BRR_net.on('list', m => {
    const L = m.rooms || [];
    $('n_list').innerHTML = L.length ? L.map(r => `<div class="rrow"><span><b>${esc(r.name)}</b> · ${esc(r.host)} · ${esc(tLabel((r.info || {}).level))} · ${MODE_N[(r.info || {}).mode] || ''} · ${r.players}/${r.max}${r.pass ? ' 🔒' : ''}</span><button data-id="${r.id}" data-pass="${r.pass ? 1 : ''}">Unirse</button></div>`).join('') : 'No hay partidas públicas ahora mismo. ¡Crea una!';
    for (const b of $('n_list').querySelectorAll('button')) b.onclick = () => { $('n_code').value = b.dataset.id; if (b.dataset.pass && !$('n_pass').value) { $('n_pass').focus(); $('n_status').textContent = 'Esa partida tiene contraseña: escríbela y pulsa Unirse.'; return; } $('n_join').onclick(); };
  });
  $('n_join').onclick = async () => { const id = $('n_code').value.trim().toUpperCase(); if (!id) return; if (!BRR_net.connected) await onlineEnter(); $('n_status').textContent = 'Conectando con la partida ' + id + '…'; BRR_net.join(id, $('n_pass').value, myData()); };
  BRR_net.on('error', m => { $('n_status').textContent = m.msg; });
  // ---------- crear partida ----------
  const MODE_N = { single: 'Una carrera', list: 'Lista de carreras', champ: 'Campeonato', rotate: 'Circuito al azar', vote: 'Votación' };
  let newMaps = [];
  $('n_newbtn').onclick = () => { $('n_home').hidden = true; $('n_new').hidden = false; $('n_rname').value = (opt.netName || 'Piloto') + ' - partida'; newMaps = [opt.level || (netTracks()[0] || {}).id].filter(Boolean);
    $('n_series').innerHTML = (front && front.series || []).map((se, i) => `<option value="${i}">Serie ${i + 1}: ${se.use.map(id => (tById(id) || {}).place || id).join(', ')}</option>`).join('');
    newModeUI(); navFocusFirst($('n_new')); };
  $('n_cancel').onclick = () => { $('n_new').hidden = true; $('n_home').hidden = false; };
  function newModeUI() { const m = $('n_mode').value;
    $('n_mapsrow').hidden = m === 'rotate' || m === 'champ'; $('n_seriesrow').hidden = m !== 'champ';
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
    const info = { mode, maps, idx: 0, level: maps[0], laps: +$('n_laps').value, ai: +$('n_ai').value, diff: +$('n_diff').value, pts: {}, names: {}, race: 1 };
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
  // ---------- sala ----------
  $('n_change').onclick = async () => { const r = BRR_net.room; if (!r || !BRR_net.isHost) return; const info = { ...r.info };
    const sel = await pickMaps({ multi: info.mode === 'list', sel: info.mode === 'list' ? info.maps : [info.level] }); if (!sel || !sel.length) return;
    if (info.mode === 'list') { info.maps = sel; info.idx = 0; info.level = sel[0]; } else { info.level = sel[0]; info.maps = [sel[0]]; } info.vote = null; info.autoAt = null; BRR_net.info(info); };
  const sendChat = () => { const t = $('n_msg').value.trim(); if (!t) return; BRR_net.chat(t); $('n_msg').value = ''; };
  $('n_send').onclick = sendChat;
  $('n_msg').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } e.stopPropagation(); });
  BRR_net.on('chat', m => { const c = $('n_chat'); c.insertAdjacentHTML('beforeend', `<div><b>${esc(m.from)}:</b> ${esc(m.text)}</div>`); c.scrollTop = c.scrollHeight; if (audio && view === 'online') audio.play('SAMPLES/BEEP3.WAV', { vol: 0.3 }); });
  $('n_leave').onclick = () => { BRR_net.leave(); $('n_room').hidden = true; $('n_chat').innerHTML = ''; BRR_net.list(); };
  BRR_net.on('room', () => netRenderRoom());
  BRR_net.on('left', () => netRenderRoom());
  BRR_net.on('closed', m => { $('n_status').textContent = m.why || 'La partida se ha cerrado.'; netRenderRoom(); });
  let lastLevel = null;
  function netRenderRoom() {
    const r = BRR_net.room; $('n_room').hidden = !r; $('pane_online').classList.toggle('inroom', !!r); if (!r) return;
    if (r.state === 'racing' && !netRace && !BRR_net.isHost) $('n_modeinfo').textContent = 'Hay una carrera en curso: entrarás en la siguiente.';
    const host = BRR_net.isHost, info = r.info || {}, T = netTracks();
    if (!T.length) { setTimeout(netRenderRoom, 500); return; }
    $('n_rtitle').textContent = r.name; $('n_rcode').textContent = r.players + '/' + r.max + ' jugadores · ' + (host ? 'eres el anfitrión 👑' : 'anfitrión: ' + r.host) + ' · ' + (MODE_N[info.mode] || 'Una carrera');
    $('n_codebox').innerHTML = `<span class="small">Código para tus amigos:</span><br><span class="code">${esc(r.id)}</span> <button id="n_copy">Copiar</button>`;
    $('n_copy').onclick = () => { try { navigator.clipboard.writeText(r.id); $('n_copy').textContent = '¡Copiado!'; } catch (e) { } };
    const pts = info.pts || {};
    $('n_members').innerHTML = BRR_net.members.map(m => `<div class="mrow">${headImg(m.data.team || 1, 24)}<b>${esc(m.name)}</b>${m.host ? ' 👑' : ''} <span class="small">${VEH_NAMES[m.data.veh] || m.data.veh || ''}</span>${pts[m.id] ? ` <span class="small">${pts[m.id]} pts</span>` : ''} <span style="margin-left:auto">${m.data.ready || m.host ? '✅' : '⏳'}</span></div>`).join('');
    const lv = info.level || T[0].id, t = tById(lv);
    $('n_timg').src = (t && t.view) || ''; $('n_tname').textContent = tLabel(lv); $('n_levelinfo').textContent = t ? (t.desc || '') : '';
    const n = (info.maps || []).length;
    $('n_modeinfo').textContent = (info.mode === 'list' || info.mode === 'champ') ? `Carrera ${Math.min(n, (info.idx || 0) + 1)} de ${n}` + (info.done ? ' · ¡terminado! (la siguiente empieza de nuevo)' : '') : info.mode === 'rotate' ? 'Tras cada carrera, otro circuito al azar' : info.mode === 'vote' ? 'Tras cada carrera se vota el siguiente circuito' : '';
    if (info.autoAt && !info.vote) $('n_modeinfo').textContent += ` · siguiente carrera en ${Math.max(0, Math.ceil((info.autoAt - Date.now()) / 1000))} s`;
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
    if (lv !== lastLevel || !$('n_veh').options.length) { lastLevel = lv; const cars = (t && t.cars && t.cars.length) ? t.cars : ['JEEP'], keep = $('n_veh').value;
      $('n_veh').innerHTML = cars.map(v => `<option value="${v}">${VEH_NAMES[v] || v}</option>`).join(''); if (cars.includes(keep)) $('n_veh').value = keep; BRR_net.data(myData()); }
    vpickLoad();
    $('n_start').hidden = !host; $('n_start').textContent = BRR_net.members.length === 1 ? ((info.ai | 0) ? 'Empezar (tú y ' + info.ai + ' de la máquina)' : 'Empezar tú solo') : BRR_net.members.every(m => m.data.ready || m.host) ? 'Empezar carrera' : 'Empezar (no todos están listos)';
    if (!BRR_net.connected && host) $('n_rcode').textContent += ' · sin conexión con el buscador: nadie más puede entrar';
  }
  for (const id of ['n_veh', 'n_team', 'n_ready']) $(id).onchange = () => { BRR_net.data(myData()); if (id !== 'n_ready') vpickLoad(); };
  // selector de vehículo con el coche girando en 3D (como en el menú original, en pequeño)
  let vpThumb = null, vpKey = '', vpA = 0, vpRun = false;
  async function vpickLoad() {
    const v = $('n_veh').value, lv = (BRR_net.room && BRR_net.room.info && BRR_net.room.info.level) || opt.level, key = v + '_' + $('n_team').value + '_' + lv;
    $('n_vname').textContent = VEH_NAMES[v] || v || ''; if (!v || key === vpKey || !orig) return; vpKey = key;
    try { vpThumb = await orig.h.carThumb(v, +$('n_team').value, lv); } catch (e) { vpThumb = null; }
    if (!vpRun) { vpRun = true; const step = () => { if (view !== 'online' || state !== 'menu' || $('n_room').hidden) { vpRun = false; return; }
        if (vpThumb) { const cv = $('n_vcv'), g = cv.getContext('2d'), im = vpThumb.frame(vpA += 0.025); g.clearRect(0, 0, cv.width, cv.height); const sz = Math.min(cv.width, cv.height * 1.25); g.drawImage(im, (cv.width - sz) / 2, (cv.height - sz) / 2 - 5, sz, sz); }
        setTimeout(() => requestAnimationFrame(step), 40); }; step(); }
  }
  const vpStep = d => { const o = [...$('n_veh').options]; if (o.length < 2) return; const i = (o.findIndex(x => x.value === $('n_veh').value) + d + o.length) % o.length; $('n_veh').value = o[i].value; sfx('BEEP3'); $('n_veh').onchange(); };
  $('n_vprev').onclick = () => vpStep(-1); $('n_vnext').onclick = () => vpStep(1);
  function netVote(id, map) { const r = BRR_net.room; if (!r || !BRR_net.isHost || !r.info.vote) return; const info = { ...r.info, vote: { ...r.info.vote, votes: { ...r.info.vote.votes, [id]: map } } };
    if (BRR_net.members.every(m => info.vote.votes[m.id])) info.vote.until = Math.min(info.vote.until, Date.now() + 1500); BRR_net.info(info); }
  // el anfitrión: votaciones, cuenta atrás y salida automática entre carreras
  setInterval(() => {
    const r = BRR_net.room; if (!r) return; if (view === 'online' && state === 'menu') netRenderRoom();
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
    const players = BRR_net.members.map(m => ({ id: m.id, name: m.name, team: m.data.team || 1, veh: m.data.veh, logo: m.data.logo || null, char: m.data.char || 0, paint: m.data.paint || null }));
    const t = tById(info.level), cars = (t && t.cars && t.cars.length) ? t.cars : ['JEEP'];
    for (const p of players) if (!cars.includes(p.veh)) p.veh = cars[0];
    const used = new Set(players.map(p => p.team)), free = [1, 2, 3, 4, 5, 6].filter(x => !used.has(x)), prof = ['experto', 'agresivo', 'imprevisible', 'prudente', 'torpe'];
    const ais = Array.from({ length: Math.min(info.ai || 0, 12 - players.length) }, (_, k) => ({ id: 'ai' + k, ai: true, name: 'IA ' + (k + 1), team: free[k % Math.max(1, free.length)] || (k % 6) + 1, veh: cars[k % cars.length], profile: prof[k % 5] }));
    const d = { k: 'start', level: info.level, laps: info.laps || 0, diff: info.diff || 2, order: [...ais, ...players.reverse()] };
    BRR_net.info(info, 'racing'); BRR_net.game(d); netStart(d);
  }
  $('n_start').onclick = netLaunch;
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
  BRR_net.on('lb', m => { if (m.level === $('m_level').value) { lbOnline = m.rows || []; drawLB(); } });
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
  function drawCar(c, body, hide, dd = carDraw) {
    const Rm = c.R; if (hide) return; R.draw(body, BRR.M4.fromRT(Rm, c.p));
    if (c.headDraw && c.def.headPos) R.draw(c.headDraw, BRR.M4.fromRT(Rm, V.add(c.p, BRR.mv(Rm, c.def.headPos))));   // el piloto
    if (dd.brake && c.brakeLight) R.drawGlow(dd.brake, BRR.M4.fromRT(Rm, c.p), 1.7);   // luces de freno
    for (const d of dd.deco) {   // hélices, rotores, timones y orugas
      const a = d.spin ? (c.decoA || 0) * d.spin * (0.4 + Math.min(1, Math.abs(c.speed()) / 20 + (c.K.fly ? 1 : 0))) : 0, ca = Math.cos(a), sa = Math.sin(a);
      R.draw(d.draw, BRR.M4.fromRT(mm3(Rm, mm3(d.R, [[ca, -sa, 0], [sa, ca, 0], [0, 0, 1]])), V.add(c.p, BRR.mv(Rm, d.p))));
    }
    c.W.forEach((w, i) => {
      const wd = dd.wheels[i]; if (!wd) return;
      const cc = [w.c[0], w.c[1] + 0.3 - w.len, w.c[2]];
      const sa = w.steer ? -c.steerAng : 0, cs = Math.cos(sa), sn = Math.sin(sa), cx = Math.cos(w.spin), sx = Math.sin(w.spin);
      const Ry = [[cs, 0, sn], [0, 1, 0], [-sn, 0, cs]], Rx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]];
      R.draw(wd, BRR.M4.fromRT(mm3(Rm, mm3(Ry, Rx)), V.add(c.p, BRR.mv(Rm, cc))));
    });
  }
  const camDist = p => Math.min(...humans.map(h => Math.hypot(p[0] - h.cam.pos[0], p[2] - h.cam.pos[2])));
  // bocinas: el jugador con H / L3 / R3; la máquina pita si la golpeas, al caer de un salto grande o si vuelca
  const RIVAL_HORNS = ['normal', 'aguda', 'grave', 'payaso', 'pato', 'claxon', 'camion'];
  const humanHorn = h => h.i === 0 ? (opt.horn || 'normal') : ['aguda', 'grave', 'payaso', 'claxon', 'pato', 'camion', 'boing', 'cerdo'][h.i % 8];
  function hornFrame(dt) {
    if (!audio || !audio.ctx || state !== 'race') { for (const h of humans) if (h.horn) { h.horn.stop(); h.horn = null; } return; }
    for (const h of humans) { const on = !!(h.inp && h.inp.horn), was = !!h.hornWas; h.hornWas = on; if (on === was) continue;
      const type = humanHorn(h), info = BRR.hornInfo(type), vol = humans.length > 1 ? 0.6 : 0.8;
      if (on) { if (h.horn) h.horn.stop(); h.horn = BRR.playHorn(audio, type, 1, vol); }
      else if (h.horn && info.hold) { h.horn.stop(); h.horn = null; }
      if (netRace && h.i === 0) BRR_net.game({ k: 'hn', t: type === 'propia' ? 'normal' : type, on: on ? 1 : 0 });
      if (on) for (const r of rivals) if (!r.remote && V.len(V.sub(r.car.p, h.car.p)) < 25) r.honked = performance.now() / 1000;   // les has pitado: a veces contestan
    }
    const now = performance.now() / 1000;
    for (const r of rivals) { const c = r.car; if (r.remote) continue;
      if ((r.hornCd || 0) > now) continue;
      let why = null;
      if (c.bumpT && now - c.bumpT < 0.2 && c.bumpBy && c.bumpBy.isPlayer) why = 'golpe';
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
      r.hornCd = now + 2.5 + Math.random() * 3;
    }
  }
  function nitroFx(c) {
    if (!audio || !audio.ctx) return;
    const d = c.isPlayer ? 0 : camDist(c.p); if (d > 80) return;
    audio.play('GEN/TUR.WAV', { vol: c.isPlayer ? 0.9 : 0.6 * (1 - d / 80), pos: c.isPlayer ? null : c.p });
  }
  function propSound(hit) {
    if (!audio || !audio.ctx) return;
    const d = camDist(hit.o.pos); if (d > 120) return;
    const f = /CONE/.test(hit.o.name) ? 'GEN/CONE.WAV' : hit.o.cls === 4 ? 'GEN/SPLAT.WAV' : 'GEN/SIGN.WAV';
    audio.play(f, { vol: Math.min(1, hit.speed / 15) * Math.max(0.15, 1 - d / 120), pos: hit.o.pos });
  }
  // ---------- posiciones ----------
  let order = [], leader = null, leaderT = 0;
  function updatePositions(dt) {
    const all = [...humans.map(h => ({ car: h.car, race: h.race, h })), ...rivals];
    order = all.map(o => ({ o, s: o.race.finishT != null ? 1e6 - o.race.finishT : o.race.score() })).sort((a, b) => b.s - a.s).map(x => x.o);
    for (const h of humans) { const pos = order.findIndex(o => o.h === h) + 1; h.q('h_pos').textContent = order.length > 1 ? `${pos}/${order.length}` : '–'; }
    const lt = order[0].car.team; leaderT += dt;
    if (race.phase === 'race' && race.t > 6 && lt !== leader && leaderT > 4 && order.length > 1 && snd.pickVoice) {
      leaderT = 0; const v = snd.pickVoice(TEAM[lt].v); if (v && audio) audio.voice(v);
    }
    if (race.phase === 'race') leader = lt;
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
    const list = [...rivals.map(r => ({ c: r.car, n: r.name && !r.isAI ? r.name : (r.replay ? 'Equipo ' + TEAM[r.car.team].n : (r.ai ? r.ai.P.name : '')) })), ...humans.filter(o => o !== h).map(o => ({ c: o.car, n: NAMES[o.i] }))];
    for (const { c, n } of list) { if (!n) continue; const p = [c.p[0], c.p[1] + 2.2, c.p[2]], m = VP;
      const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
      if (w <= 0.5 || w > 150) continue; const sx = (x / w * 0.5 + 0.5) * 100, sy = (1 - (y / w * 0.5 + 0.5)) * 100; if (sx < -5 || sx > 105 || sy < -5 || sy > 105) continue;
      out.push(`<div class="ntag" style="left:${sx}%;top:${sy}%;color:${TEAM[c.team].c};opacity:${Math.max(0.35, 1 - w / 150)}">${esc(n)}</div>`); }
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
    const k = +opt.rumble || 0; if (!k || !h.ctl || h.ctl.pad == null) return; const gp = pads().find(g => g.index === h.ctl.pad); const act = gp && (gp.vibrationActuator || (gp.hapticActuators && gp.hapticActuators[0])); if (!act) return;
    const c = h.car; let strong = 0, weak = 0;
    if (h.rbHit) { strong = Math.min(1, h.rbHit / 10); weak = strong; h.rbHit = 0; }
    if (h.rbLand) { strong = Math.max(strong, Math.min(1, h.rbLand / 9)); h.rbLand = 0; }
    let slip = 0, rough = 0, nc = 0; for (const w of c.W) if (w.contact) { nc++; slip = Math.max(slip, w.slip || 0); if (/tierra|arena|hierba|nieve/.test(w.surface || '')) rough++; }
    const sp = Math.min(1, Math.abs(c.speed()) / 25); weak = Math.max(weak, Math.min(0.6, slip * 0.9) * sp, nc ? rough / nc * 0.12 * sp : 0); if (c.nitroT > 0) weak = Math.max(weak, 0.25);
    h.rbT = (h.rbT || 0) - dt; if ((strong > 0.05 || weak > 0.03) && h.rbT <= 0) { h.rbT = 0.08;
      try { act.playEffect ? act.playEffect('dual-rumble', { duration: strong > 0.05 ? 160 : 100, strongMagnitude: Math.min(1, strong * k), weakMagnitude: Math.min(1, weak * k) }) : act.pulse(Math.min(1, (strong + weak) * k), 100); } catch (e) { } }
  }
  let lastDraw = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    const lim = +opt.fpslim || 0; if (lim && t - lastDraw < 1000 / lim - 1.5) return; lastDraw = t;   // límite de FPS
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    if (state !== 'race' && state !== 'pause' && state !== 'results') return;
    assignControls();
    const allCars = [...humans.map(h => h.car), ...rivals.map(r => r.car)];
    if (netWait && state === 'race') { netFrame(dt); for (const h of humans) { readInput(h, 0); h.race.phase = 'countdown'; h.race.cd = 3.6; } }
    else if (photo) { photoFrame(dt); }
    else if (state === 'race' || state === 'results') {
      for (const h of humans) { const inp = readInput(h, dt); if (inp.nitro && !h.nPrev && h.race.phase === 'race' && h.car.fireNitro()) nitroFx(h.car); h.nPrev = inp.nitro; }
      for (const r of rivals) if (r.inp && r.inp.nitro && r.car.fireNitro()) nitroFx(r.car);
      const ps = Math.max(...humans.map(h => h.race.score())), tA = performance.now();
      for (const r of rivals) if (r.ai) r.inp = r.ai.control(dt, allCars, ps);
      const tB = performance.now();
      acc += dt; let n = 0;
      while (acc >= DT) { for (const h of humans) h.car.step(DT, h.inp); for (const r of rivals) if (!r.remote && !r.replay) r.car.step(DT, r.inp); acc -= DT; if (++n % 3 === 0) BRR.carCollisions(allCars); }
      if (replayBand && humans[0].race.phase === 'race') { let best = 99; for (const h of humans) { const p = order.findIndex(o => o.h === h); if (p >= 0) best = Math.min(best, p); } replayBand.update(dt, best === 99 ? 3 : best);
        const hs = Math.max(...humans.map(h => h.race.score())), seg = race.total / ((race.maxNum || 1) + 1);
        for (const r of rivals) if (r.replay) r.replay.adjust((r.race.score() - hs) * seg, dt); }
      for (const r of rivals) if (r.replay) r.replay.update(dt);
      BRR.carCollisions(allCars); const tC = performance.now(); const P = BRR.PERF || (BRR.PERF = { ai: 0, phys: 0, n: 0 }); P.ai += tB - tA; P.phys += tC - tB; P.n++;
      for (const h of humans) { h.race.update(dt, h.car); handleEvents(h); }
      for (const r of rivals) { if (r.remote) continue; r.race.update(dt, r.car); r.race.ev.length = 0; }
      if (netRace) netFrame(dt);
      updatePositions(dt);
      if (humans[0] && humans[0].race.phase === 'race') { statAcc.km += Math.abs(humans[0].car.speed()) * dt / 1000; statAcc.t += dt; statAcc.veh = humans[0].car.def.name; }
      for (const hit of props.update(dt, allCars)) propSound(hit);
      for (const c of allCars) if (c.nitroT > 0) fx.flame(V.add(c.p, BRR.mv(c.R, c.def.nitro || [0, 0.4, c.def.box.c[2] + c.def.box.h[2]])), V.mul(c.forward(), -4), c.v);
      humans.forEach(h => fx.car(h.car, dt, 'p' + h.i)); rivals.forEach((r, k) => { if (camDist(r.car.p) < 160) fx.car(r.car, dt, 'r' + k); });
      for (const c of allCars) { if ((c.lastHit || 0) > 4) { fx.sparks(V.add(c.p, V.mul(c.forward(), 1.5)), Math.min(25, c.lastHit * 2 * (+opt.parts || 1) | 0));
          if (!c.isPlayer && audio && audio.ctx && snd.bangs && camDist(c.p) < 90) { const b = snd.bangs[Math.random() * snd.bangs.length | 0]; if (b) audio.play(b, { vol: Math.min(0.8, c.lastHit / 14) * (1 - camDist(c.p) / 90), pos: c.p }); } }
        if (!c.isPlayer) c.lastHit = 0; }
      fx.density = +opt.parts || 1; fx.update(dt); for (const c of allCars) c.decoA = (c.decoA || 0) + dt;
    } else for (const h of humans) readInput(h, 0);
    if (netRace) puppets(dt);
    soundFrame(dt); hornFrame(dt); if (state === 'race') for (const h of humans) rumble(h, dt);
    for (const h of humans) if (!(photo && h.i === 0)) updateCamera(h, dt);
    camShare(); listenerFrame();
    // una vista por jugador (con su propio mapa de sombras centrado en su coche)
    const W = canvas.width, H = canvas.height, far = opt.far;
    R.frameBegin(W, H);
    R.gl.clearColor(0, 0, 0, 1); R.viewRect = null; R.gl.disable(R.gl.SCISSOR_TEST); R.gl.viewport(0, 0, W, H); R.gl.clear(R.gl.COLOR_BUFFER_BIT);
    for (const h of humans) {
      const [rx, ry, rw, rh] = h.rect, vx = Math.round(rx * W), vw = Math.round(rw * W), vh = Math.round(rh * H), vy = H - Math.round(ry * H) - vh;
      const cam = h.cam, aspect = vw / Math.max(1, vh), fov = opt.fov * Math.PI / 180 * (humans.length === 2 ? 0.8 : 1);
      const proj = BRR.M4.persp(fov, aspect, 0.3, far), view = BRR.M4.lookAt(cam.pos, cam.look, cam.up);
      if (R.mode === 1 && R.shadowQ && (humans.length > 1 || (shTick++ & 1) === 0)) {   // con 1 jugador, sombras a 30 Hz
        const c = h.car, fwd = c.forward(); R.shadowBegin(V.madd(c.p, [fwd[0], 0, fwd[2]], R.shadowRange * 0.45));
        R.drawDepth(statics); for (const o of props.list) { const dx = o.pos[0] - c.p[0], dz = o.pos[2] - c.p[2]; if (dx * dx + dz * dz < 40000) R.drawDepth(props.models.get(o.name), BRR.M4.fromRT(o.rot, o.pos)); }
        for (const hh of humans) R.drawDepth(hh.draw, BRR.M4.fromRT(hh.car.R, hh.car.p));
        for (const r of rivals) R.drawDepth(r.draw, BRR.M4.fromRT(r.car.R, r.car.p));
        R.shadowEnd();
      }
      R.viewRect = [vx, vy, vw, vh];
      R.begin(cam.pos, view, proj, far, lvl.sky);
      R.draw(terrainB); R.draw(statics); props.draw(cam.pos, far);
      for (const hh of humans) drawCar(hh.car, hh.draw, hh === h && ['capo', 'parachoques'].includes(h.camMode || opt.cam));
      for (const r of rivals) { const d2 = (r.car.p[0] - cam.pos[0]) ** 2 + (r.car.p[2] - cam.pos[2]) ** 2; if (d2 < far * far) drawCar(r.car, r.draw, false, r.dd); }
      fx.draw(BRR.M4.mul(proj, view), cam.pos, view, far, R.fogUsed || lvl.sky);
      // marcador del jugador
      const c = h.car, rc = h.race;
      const kmh = Math.round(Math.abs(c.speed()) * 3.6); h.q('speed').textContent = kmh; if (opt.speedo === 'ana') drawGauge(h, kmh, c);
      if (opt.hnames) nameTags(h, BRR.M4.mul(proj, view), vw, vh); else if (h.tagsOn) { h.q('tags').innerHTML = ''; h.tagsOn = false; }
      h.q('h_lap').textContent = rc.phase === 'finished' ? 'META' : freeMode ? 'LIBRE' : `${Math.min(rc.lap + 1, rc.laps)}/${rc.laps}`;
      h.q('h_time').textContent = fmt(rc.t); h.q('h_cur').textContent = fmt(rc.t - rc.lapStart);
      const rec = getRec(h), bl = rc.lapTimes.length ? Math.min(...rc.lapTimes) : null;
      h.q('h_best').textContent = fmt(bl != null && (!rec.lap || bl < rec.lap) ? bl : rec.lap);
      h.q('wrong').hidden = !rc.wrong;
      h.q('h_nitro').textContent = '▮'.repeat(Math.max(0, c.nitros | 0)) || '–'; h.q('nitrobox').classList.toggle('on', c.nitroT > 0);
      if (h.msgT > 0) { h.msgT -= dt; if (h.msgT <= 0) h.q('msg').hidden = true; }
      drawMinimap(h);
    }
    R.gl.disable(R.gl.SCISSOR_TEST); R.viewRect = null; R.frameEnd();
    if (photoShot) { photoShot = false; canvas.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'BigRedRacing_' + lvl.name + '_' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }, 'image/png'); }
    fpsN++; fpsT += dt; if (fpsT > 0.5) { fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0;
      if (opt.autoRes !== false && state === 'race') { dynT = (dynT || 0) + 1;
        if (dynT >= 3) { dynT = 0; const old = dyn; if (fps < 50 && dyn > 0.5) dyn = Math.max(0.5, dyn * 0.85); else if (fps > 58 && dyn < 1) dyn = Math.min(1, dyn * 1.07); if (dyn !== old) resize(); } } }
    $('fps').textContent = opt.fps ? fps + ' fps · ' + W + '×' + H : '';
    window.BRR_STATE = { p: car.p, v: car.v, speed: car.speed(), grounded: car.grounded, up: car.R[1][1] };
  }
  requestAnimationFrame(frame);
  window.BRR_DEBUG = { get rivals() { return rivals; }, get humans() { return humans; }, get race() { return race; }, get audio() { return audio; }, R, startRace, useFiles, get car() { return car; }, get lvl() { return lvl; }, get files() { return files; }, get orig() { return orig; }, net: BRR_net };
})();
