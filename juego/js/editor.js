// Editor de circuitos (ordenador, Steam Deck, navegador y Android con pantalla táctil): vista desde arriba con brochas de terreno, pintura de suelo,
// carretera dibujada con puntos (curva suave), objetos del tema y ajustes. Al probarlo, el circuito se convierte en los
// mismos datos que usa el juego original (alturas, baldosas, objetos, recorrido, controles y parrilla) sobre un circuito
// base que pone las texturas, la paleta y los objetos; la carretera se dibuja encima como una cinta suave.
"use strict";
(function () {
  const BRR = window.BRR, N = 256, CELL = 512, CM = 8;   // 256×256 casillas de 8 m (512 unidades originales)
  const THEMES = ['CITY1', 'CITY2', 'CITY3', 'CITY4', 'DIRT1', 'DIRT2', 'DIRT3', 'SNOW1', 'SNOW2', 'SNOW3', 'RUF1', 'RUF2', 'RUF3', 'RIG1', 'RIG3', 'RIG4', 'MOON1', 'MOON2', 'MOON3'];
  const NOOBJ = /^(START\d?|ST_POSTS?|ST_POST2|CHECKP|S_GRID|S_LINES|S_LIGHTS|CLOUDS?|CLOUDSLO|SUNRISE|HUGPOSTS)$/;
  const SOFTN = /PLANT|PALM|CONE|GRASS|BUSH|SHRUB|FLOWER|WEED|REED|CACT|SHEEP|COW|CHICK/;

  // ---------- almacenamiento (IndexedDB propia) ----------
  const db = () => new Promise((ok, ko) => { const r = indexedDB.open('brr_tracks', 1); r.onupgradeneeded = () => r.result.createObjectStore('t'); r.onsuccess = () => ok(r.result); r.onerror = ko; });
  const dget = async k => { const d = await db(); return new Promise(ok => { const r = d.transaction('t').objectStore('t').get(k); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); }); };
  const dset = async (k, v) => { const d = await db(); return new Promise(ok => { const t = d.transaction('t', 'readwrite'); if (v == null) t.objectStore('t').delete(k); else t.objectStore('t').put(v, k); t.oncomplete = ok; t.onerror = ok; }); };
  async function listTracks() { return (await dget('list')) || []; }
  async function saveTrack(T) {
    T.updated = Date.now(); T.rev = (T.rev || 0) + 1; await dset('trk_' + T.id, T);
    const L = (await listTracks()).filter(x => x.id !== T.id); L.unshift({ id: T.id, name: T.name, base: T.base, updated: T.updated, len: T.lenM || 0 }); await dset('list', L);
  }
  async function delTrack(id) { const t = await dget('trk_' + id); if (t && t.pub && BRR.cloud && BRR.cloud.trackDel) { try { await BRR.cloud.trackDel(id); } catch (e) { } }   // si lo habías publicado, se retira también de la comunidad
    await dset('trk_' + id, null); await dset('list', (await listTracks()).filter(x => x.id !== id)); }
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };

  // ---------- circuito base: texturas del suelo, paleta, objetos y baldosas típicas (carretera y suelo) ----------
  const baseCache = new Map();
  async function loadBase(files, base) {
    if (baseCache.has(base)) return baseCache.get(base);
    const L = await files.archive(base + '.LEV'), script = BRR.text(L.get(base + '.TXT')), find = n => L.get(n) || null, mapn = (script.match(/^map\s+(\w+)/m) || [0, 'MAP'])[1].toUpperCase();
    const E = files.has(BRR.envOf(base) + '.ENV') ? await files.archive(BRR.envOf(base) + '.ENV') : new Map(), col = find(mapn + '.COL') || E.get('CARSEL.RAW') || (await files.archive('CITY.ENV')).get('CARSEL.RAW'), pal = BRR.pal6(col.subarray(0, 768));
    if (BRR.envOf(base) === 'SNOW') for (let i = 0; i < 256; i++) { const r = pal[i * 3], g = pal[i * 3 + 1], b = pal[i * 3 + 2];   // como en el juego: la nieve lila, hacia blanco azulado
      if (b > r + 25 && b > g + 18 && b > 120) { const l = 0.3 * r + 0.59 * g + 0.11 * b, t = 0.7; pal[i * 3] = r + (l * 1.08 - r) * t; pal[i * 3 + 1] = g + (l * 1.12 - g) * t; pal[i * 3 + 2] = Math.min(255, b + (l * 1.22 - b) * t); } }
    const mt = script.match(/^\s*texes\s+(\w+?)(\d)\s+(\d+)/m), pages = []; for (let k = 0; k < +mt[3]; k++) pages.push(find(`${mt[1]}${+mt[2] + k}.TM`));
    const nT = pages.length * 48, thumbs = [];
    for (let t = 0; t < nT; t++) { const pg = pages[t / 48 | 0], lt = t % 48, sx = (lt % 8) * 32, sy = (lt / 8 | 0) * 32, cv = document.createElement('canvas'); cv.width = cv.height = 32;
      const g = cv.getContext('2d'), im = g.createImageData(32, 32);
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const c = pg[(sy + y) * 256 + sx + x], o = ((31 - y) * 32 + x) * 4; im.data[o] = pal[c * 3]; im.data[o + 1] = pal[c * 3 + 1]; im.data[o + 2] = pal[c * 3 + 2]; im.data[o + 3] = 255; }
      g.putImageData(im, 0, 0); thumbs.push(cv); }
    // baldosas del original: la que hay bajo los controles y la parrilla (carretera) y la más repetida alrededor (suelo)
    const C = find(mapn + '.MPC'), T = find(mapn + '.CHT'), shl = find(mapn + '.SHL'), dat = find(mapn + '.DAT'), rc = new Map(), gc = new Map(), names = [];
    const tileAt = (ix, iz) => T[512 + C[(iz & 255) * 256 + (ix & 255)]];
    for (let i = 0; i + 13 <= shl.length; i += 13) { let q = ''; for (let k = i; k < i + 13 && shl[k]; k++) q += String.fromCharCode(shl[k]); names.push(q.toUpperCase()); }
    const dv = new DataView(dat.buffer, dat.byteOffset, dat.byteLength), spots = [];
    for (let i = 0; i + 22 <= dat.length; i += 22) if (/^(CHECKP|S_GRID|S_LINES)$/.test(names[dat[i]] || '')) spots.push([dv.getInt32(i + 1, true) / CELL, dv.getInt32(i + 9, true) / CELL]);
    const gm = script.match(/^\s*grid\s+&([0-9A-Fa-f]+),\s*&([0-9A-Fa-f]+)/m); if (gm) spots.push([parseInt(gm[1], 16) / CELL, parseInt(gm[2], 16) / CELL]);
    for (const [x, z] of spots) { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const t = tileAt(Math.floor(x) + dx, Math.floor(z) + dz); if (t < nT) rc.set(t, (rc.get(t) || 0) + (dx || dz ? 1 : 3)); }
      for (let a = 0; a < 16; a++) for (const r of [5, 7, 9]) { const t = tileAt(Math.floor(x + Math.cos(a / 16 * 6.283) * r), Math.floor(z + Math.sin(a / 16 * 6.283) * r)); if (t < nT) gc.set(t, (gc.get(t) || 0) + 1); } }
    const top = m => [...m].sort((a, b) => b[1] - a[1]).map(x => x[0]);
    const avg = t => { const d = thumbs[t].getContext('2d').getImageData(0, 0, 32, 32).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } return [r, g, b]; };
    const wet = t => { const [r, g, b] = avg(t); return b > r * 1.15 && b > g * 1.02; };   // agua: no vale como suelo por defecto
    const roadTile = top(rc)[0] ?? 0, groundTile = top(gc).find(t => t !== roadTile && !wet(t)) ?? top(gc).find(t => t !== roadTile) ?? 0;
    const models = [...L.keys()].filter(k => k.endsWith('.3DW')).map(k => k.slice(0, -4)).filter(n => !NOOBJ.test(n)).sort();
    const B = { base, script, mapn, col, pal, pages, nT, thumbs, roadTile, groundTile, models, hasBanner: !!(find('START.3DW') && find('ST_POSTS.3DW')), L };
    baseCache.set(base, B); return B;
  }

  // ---------- curva de la carretera (Catmull-Rom cerrada) muestreada cada ~2 m ----------
  function spline(P, step = 0.25, open = false) {   // open: tramo abierto (mientras se dibuja), sin unir el último punto con el primero
    const n = P.length, out = []; if (n < (open ? 2 : 3)) return out; let s = 0;
    for (let i = 0; i < (open ? n - 1 : n); i++) { const p0 = open ? P[Math.max(0, i - 1)] : P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = open ? P[Math.min(n - 1, i + 2)] : P[(i + 2) % n], L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), k = Math.max(2, Math.ceil(L / step));
      for (let j = 0; j < k; j++) { const t = j / k, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        const x = f(p0[0], p1[0], p2[0], p3[0]), z = f(p0[1], p1[1], p2[1], p3[1]); if (out.length) s += Math.hypot(x - out[out.length - 1].x, z - out[out.length - 1].z) * CM; out.push({ x, z, s }); } }
    if (open) out.push({ x: P[n - 1][0], z: P[n - 1][1], s: s + Math.hypot(P[n - 1][0] - out[out.length - 1].x, P[n - 1][1] - out[out.length - 1].z) * CM });
    const tot = out.length ? (open ? out[out.length - 1].s : s + Math.hypot(out[0].x - out[out.length - 1].x, out[0].z - out[out.length - 1].z) * CM) : 0;
    for (let i = 0; i < out.length; i++) { const a = open ? out[Math.max(0, i - 1)] : out[(i - 1 + out.length) % out.length], b = open ? out[Math.min(out.length - 1, i + 1)] : out[(i + 1) % out.length], l = Math.hypot(b.x - a.x, b.z - a.z) || 1; out[i].tx = (b.x - a.x) / l; out[i].tz = (b.z - a.z) / l; }
    out.total = tot; return out;
  }
  const hAt = (h, x, z) => { const ix = Math.max(0, Math.min(254, Math.floor(x))), iz = Math.max(0, Math.min(254, Math.floor(z))), u = x - ix, v = z - iz, q = (a, b) => h[b * 256 + a];
    return (q(ix, iz) * (1 - u) + q(ix + 1, iz) * u) * (1 - v) + (q(ix, iz + 1) * (1 - u) + q(ix + 1, iz + 1) * u) * v; };

  // ---------- del circuito del editor a los datos del juego ----------
  // devuelve { h, t, S (curva), gates } con el terreno allanado bajo la carretera y la carretera pintada
  function prepare(T, B) {
    const h = T.h.slice(), t = T.t.slice(), S = spline(T.road), w = (T.w || 14) / CM, half = w / 2; let best = null;
    if (S.length) {
      // altura de la carretera: el terreno bajo ella suavizado a lo largo (sin baches)
      let y = S.map(p => hAt(T.h, p.x, p.z)); const n = y.length;
      for (let pass = 0; pass < 3; pass++) { const win = 24, out = new Array(n); for (let i = 0; i < n; i++) { let a = 0; for (let k = -win; k <= win; k++) a += y[(i + k + n) % n]; out[i] = a / (2 * win + 1); } y = out; }
      const R = half + 2.2, tgt = new Float32Array(65536); best = new Float32Array(65536).fill(1e9);
      S.forEach((p, i) => { for (let z = Math.floor(p.z - R); z <= Math.ceil(p.z + R); z++) for (let x = Math.floor(p.x - R); x <= Math.ceil(p.x + R); x++) { if (x < 0 || z < 0 || x > 255 || z > 255) continue;
        const d = Math.hypot(x - p.x, z - p.z), k = z * 256 + x; if (d < best[k]) { best[k] = d; tgt[k] = y[i]; } } });
      for (let k = 0; k < 65536; k++) { const d = best[k]; if (d > R) continue; const a = d <= half + 0.6 ? 1 : 1 - (d - half - 0.6) / (R - half - 0.6); h[k] = Math.round(h[k] + (tgt[k] - h[k]) * Math.max(0, Math.min(1, a))); }
      // suelo de carretera bajo la cinta (para el polvo, el agarre y los sonidos)
      const RT = T.roadTile ?? B.roadTile; for (let z = 0; z < 255; z++) for (let x = 0; x < 255; x++) { const k = z * 256 + x; if (Math.max(best[k], best[k + 1], best[k + 256], best[k + 257]) < half) t[k] = RT; }   // solo las casillas que quedan del todo bajo la cinta
    }
    return { h, t, S, gates: gatesOf(S), half, best: S.length ? best : null };
  }
  function gatesOf(S) { const G = S.length ? Math.max(3, Math.min(12, Math.round(S.total / 260))) : 0, gates = [];
    for (let g = 0; g < G; g++) { const s = g * S.total / G; let i = 0; while (i < S.length - 1 && S[i + 1].s <= s) i++; gates.push({ num: g, last: g === G - 1, p: S[i] }); }
    return gates; }
  // todos los objetos de todos los circuitos (para poner en cualquier tema)
  let allM = null;
  async function allModels(files) {
    if (allM) return allM; const out = [];
    for (const n of files.list('.LEV').map(x => x.replace(/\.LEV$/i, '')).filter(x => !/^TEST/.test(x)).sort()) { try { const A = await files.archive(n + '.LEV'); out.push({ lev: n, names: [...A.keys()].filter(k => k.endsWith('.3DW')).map(k => k.slice(0, -4)).filter(m => !NOOBJ.test(m)).sort() }); } catch (e) { } }
    return allM = out; }
  const rawPal = async (files, lev) => { const A = await files.archive(lev + '.LEV'), sc = BRR.text(A.get(lev + '.TXT')), mp = (sc.match(/^map\s+(\w+)/m) || [0, 'MAP'])[1].toUpperCase();
    const c = A.get(mp + '.COL') || ((files.has(BRR.envOf(lev) + '.ENV') ? await files.archive(BRR.envOf(lev) + '.ENV') : new Map()).get('CARSEL.RAW')); return { A, pal: BRR.pal6(c.subarray(0, 768)) }; };
  // objetos de otros circuitos: el modelo y sus texturas con los colores pasados a la paleta del tema (el más parecido) y nombres propios para no chocar
  async function foreign(files, B, objs, L, extra) {
    const map = new Map(), basePal = BRR.pal6(B.col.subarray(0, 768)), keyB = (() => { for (let c = 0; c < 256; c++) if (BRR.isKey(basePal, c)) return c; return 0; })(), palC = new Map(); let k = 0;
    for (const o of objs) { if (!o.s || o.s === B.base) continue; const key = o.s + '|' + o.n; if (map.has(key)) continue;
      try { if (!palC.has(o.s)) { const { A, pal } = await rawPal(files, o.s), rm = new Uint8Array(256);
          for (let c = 0; c < 256; c++) { if (BRR.isKey(pal, c)) { rm[c] = keyB; continue; } let best = 0, bd = 1e9; for (let d = 0; d < 256; d++) { if (BRR.isKey(basePal, d)) continue; const e = (pal[c * 3] - basePal[d * 3]) ** 2 * 0.3 + (pal[c * 3 + 1] - basePal[d * 3 + 1]) ** 2 * 0.59 + (pal[c * 3 + 2] - basePal[d * 3 + 2]) ** 2 * 0.11; if (e < bd) { bd = e; best = d; } } rm[c] = best; }
          palC.set(o.s, { A, rm }); }
        const { A, rm } = palC.get(o.s), raw = A.get(o.n + '.3DW'); if (!raw) continue; const m = BRR.parse3DW(raw), alias = o.n.slice(0, 9) + '_' + (k++).toString(36), tx = new Map();
        const tname = t => { if (!t) return t; if (!tx.has(t)) { const tm = A.get(t + '.TM'); const nn = 'X' + k.toString(36) + '_' + tx.size; if (tm) { const out = new Uint8Array(tm.length); for (let i = 0; i < tm.length; i++) out[i] = rm[tm[i]]; extra.set(nn + '.TM', out); tx.set(t, nn); } else tx.set(t, t); } return tx.get(t); };
        const faces = m.faces.map(f => ({ ...f, color: f.color != null ? rm[f.color] : f.color, tex: tname(f.tex), alt: f.alt ? { ...f.alt, tex: tname(f.alt.tex) } : f.alt }));
        extra.set(alias + '.3DW', { ...m, faces }); map.set(key, alias); } catch (e) { } }
    return map; }
  const hex = v => (v < 0 ? '-&' : '&') + Math.abs(Math.round(v)).toString(16).toUpperCase();
  async function build(files, T) {
    const B = await loadBase(files, T.base), P = prepare(T, B), { h, t, S, gates, half } = P;
    if (S.length < 8) throw new Error('La carretera necesita al menos 3 puntos');
    const name = T.base + '~' + T.id, L = new Map();
    for (const [k, v] of B.L) if (!/\.REC$/i.test(k) && !/^MAP\.(MPH|MPC|CHT|DAT|SHL|CSE|GRP)$/i.test(k) && !/\.TXT$/i.test(k)) L.set(k, v);
    const mre = new RegExp('^' + B.mapn + '\\.', 'i'); for (const k of [...L.keys()]) if (mre.test(k)) L.delete(k);
    L.set('MAP.COL', B.col); L.set('MAP.MPH', h); L.set('MAP.MPC', t);
    const cht = new Uint8Array(768); for (let k = 0; k < 256; k++) { cht[k] = 1; cht[256 + k] = 0; cht[512 + k] = k < B.nT ? k : 255; } L.set('MAP.CHT', cht);
    // objetos: controles (invisibles), pancarta de salida/control con sus postes y los que has puesto
    const names = [], recs = []; const nid = n => { let i = names.indexOf(n); if (i < 0) { names.push(n); i = names.length - 1; } return i; };
    const gyU = (x, z) => -hAt(h, x, z) * 16;   // y original (hacia abajo) del suelo en unidades
    const add = (n, x, z, y, ry, b19, cls) => recs.push({ n: nid(n), x: Math.round(x * CELL), y: Math.round(y), z: Math.round(z * CELL), ry: ((Math.round(ry / (2 * Math.PI) * 65536) % 65536) + 65536) % 65536, b19, cls });
    for (const g of gates) { const p = g.p, a = Math.atan2(p.tx, p.tz);   // eje de la puerta perpendicular a la carretera
      add('CHECKP', p.x, p.z, gyU(p.x, p.z), a, g.num | (g.last ? 0x80 : 0), 50);
      if (B.hasBanner) { const ax = [Math.cos(a), -Math.sin(a)], off = half + 0.35;
        add('START', p.x, p.z, gyU(p.x, p.z) - 300, a, 0, 8);
        for (const sg of [-1, 1]) { const px = p.x + ax[0] * off * sg, pz = p.z + ax[1] * off * sg; add('ST_POSTS', px, pz, gyU(px, pz), a, 1, 0); } } }
    const extra = new Map(), fmap = await foreign(files, B, T.objs || [], L, extra);
    for (const o of T.objs || []) { const nm = o.s && o.s !== T.base ? fmap.get(o.s + '|' + o.n) : (B.models.includes(o.n) ? o.n : null); if (!nm) continue; add(nm, o.x, o.z, gyU(o.x, o.z), (o.r || 0) * Math.PI / 180, 0, SOFTN.test(o.n) ? 4 : 0); }
    const shl = new Uint8Array(names.length * 13); names.forEach((n, i) => { for (let k = 0; k < Math.min(12, n.length); k++) shl[i * 13 + k] = n.charCodeAt(k); }); L.set('MAP.SHL', shl);
    const dat = new Uint8Array(recs.length * 22), dv = new DataView(dat.buffer);
    recs.forEach((r, i) => { const o = i * 22; dat[o] = r.n; dv.setInt32(o + 1, r.x, true); dv.setInt32(o + 5, r.y, true); dv.setInt32(o + 9, r.z, true); dv.setInt16(o + 13, 0, true); dv.setUint16(o + 15, r.ry, true); dv.setInt16(o + 17, 0, true); dat[o + 19] = r.b19; dat[o + 20] = r.cls; dat[o + 21] = 0; });
    L.set('MAP.DAT', dat);
    // recorrido: un punto cada ~16 m con el ancho de la carretera
    const cs = []; for (let i = 0; i < S.length; i += 8) cs.push(S[i]);
    const cse = new Uint8Array(cs.length * 16), cv = new DataView(cse.buffer), hw = half * CELL;
    cs.forEach((p, i) => { const o = i * 16; cv.setInt32(o, Math.round(p.x * CELL), true); cv.setInt32(o + 4, Math.round(p.z * CELL), true); cv.setInt16(o + 8, Math.round(Math.atan2(p.tx, p.tz) / (2 * Math.PI) * 1024) & 1023, true); cv.setInt16(o + 10, 4360, true); cv.setInt16(o + 12, Math.round(hw), true); cv.setInt16(o + 14, -Math.round(hw), true); });
    L.set('MAP.CSE', cse);
    // guion: mapa, texturas, parrilla (detrás de la salida, mirando hacia la carretera), vueltas, nitros, luz y cámaras de tele
    const keep = re => (B.script.match(re) || [''])[0];
    const st = S[Math.max(0, S.length - 7)];   // la parrilla empieza 14 m antes de la línea de salida
    const ga = ((Math.round(Math.atan2(st.tx, st.tz) / (2 * Math.PI) * 65536) % 65536) + 65536) % 65536, lat = Math.round(half * CELL * 0.45);
    const slots = []; for (let k = 0; k < 12; k++) slots.push(`${k % 2 ? -lat : lat},${-(160 + k * 300)},&0`);
    const cams = []; for (let s = 40; s < S.total; s += 140) { let i = 0; while (i < S.length - 1 && S[i].s < s) i++; const p = S[i], sg = (i / 7 | 0) % 2 ? 1 : -1, cx = p.x + p.tz * (half + 3) * sg, cz = p.z - p.tx * (half + 3) * sg; cams.push(`fixcam ${hex(cx * CELL)},${hex(-(5 + Math.random() * 4) / BRR.S)},${hex(cz * CELL)}`); }
    const script = [`; circuito hecho con el editor: ${String(T.name || '').replace(/[\r\n]/g, ' ')}`, 'map MAP', keep(/^\s*texes.*$/m), keep(/^\s*speed.*$/m), keep(/^\s*palanim.*$/m), keep(/^light.*$/m),
      `grid ${hex(st.x * CELL)},${hex(st.z * CELL)},${hex(ga)},`, '        -956,0,&2000,', '        444,0,-&2000,', ...slots.map((q, i) => '        ' + q + (i < slots.length - 1 ? ',' : '')),
      `laps ${Math.max(1, Math.min(20, T.laps | 0 || 3))}`, `nitros ${Math.max(0, Math.min(12, T.nitros | 0))},1200`, ...cams].join('\n');
    L.set(name + '.TXT', new TextEncoder().encode(script));
    const files2 = Object.create(files); files2.extra = extra; const lev = name + '.LEV';
    files2.archive = async n => n === lev ? L : files.archive(n); files2.has = n => n === lev || files.has(n);
    return { name, files2, P, B };
  }
  // cinta de la carretera (curva suave encima del terreno) y línea de salida a cuadros
  function ribbon(lvl, P, B, T) {
    const tile = B.thumbs[T.roadTile ?? B.roadTile], tg = tile.getContext('2d').getImageData(0, 0, 32, 32).data, W = 64, H = 64, tex = new Uint8Array(W * H * 4);
    const city = /^(CITY|RIG)/.test(T.base);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4, q = ((y % 32) * 32 + (x % 32)) * 4; let r = tg[q], g = tg[q + 1], b = tg[q + 2]; const ed = Math.min(x, W - 1 - x);
      if (ed < 3) { r *= 0.72; g *= 0.72; b *= 0.72; } if (city && (ed === 4 || ed === 5)) r = g = b = 225; tex[o] = r; tex[o + 1] = g; tex[o + 2] = b; tex[o + 3] = 255; }
    const chk = new Uint8Array(16 * 16 * 4); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const o = (y * 16 + x) * 4, c = ((x >> 2) + (y >> 2)) % 2 ? 235 : 25; chk[o] = chk[o + 1] = chk[o + 2] = c; chk[o + 3] = 255; }
    const mb = lvl.mesh; mb.textures.set('ROADRIB', { w: W, h: H, data: tex, smooth: true }); mb.textures.set('STARTLN', { w: 16, h: 16, data: chk, smooth: true });
    const g = mb.group('tex:ROADRIB'), S = P.S, half = P.half * CM, n = S.length, M = 4, gl = p => [p.x * CELL * BRR.S, 0, -p.z * CELL * BRR.S];
    const pt = (i, u) => { const p = S[i % n], c = gl(p), nx = p.tz, nz = p.tx, off = (u - 0.5) * 2 * half; const x = c[0] + nx * off, z = c[2] + nz * off; return [x, lvl.terrain(x, z) + 0.05, z]; };
    for (let i = 0; i < n; i++) { const v0 = (i % 4) / 4, v1 = v0 + 0.25;
      for (let m = 0; m < M; m++) { const u0 = m / M, u1 = (m + 1) / M, A = pt(i, u0), Bq = pt(i, u1), C = pt(i + 1, u1), D = pt(i + 1, u0), UV = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
        for (const k of [0, 2, 1, 0, 3, 2, 0, 1, 2, 0, 2, 3]) { g.pos.push(...[A, Bq, C, D][k]); g.uv.push(...UV[k]); g.lay.push(3); } } }
    const gs = mb.group('tex:STARTLN'); for (let i = 0; i < 2; i++) for (let m = 0; m < M; m++) { const u0 = m / M, u1 = (m + 1) / M, A = pt(i, u0), Bq = pt(i, u1), C = pt(i + 1, u1), D = pt(i + 1, u0); A[1] += 0.01; Bq[1] += 0.01; C[1] += 0.01; D[1] += 0.01;
      const UV = [[u0 * 4, i * .5], [u1 * 4, i * .5], [u1 * 4, i * .5 + .5], [u0 * 4, i * .5 + .5]].map(q => [q[0] % 1 || (q[0] ? 1 : 0), q[1]]);
      for (const k of [0, 2, 1, 0, 3, 2, 0, 1, 2, 0, 2, 3]) { gs.pos.push(...[A, Bq, C, D][k]); gs.uv.push(...UV[k]); gs.lay.push(5); } }
  }
  BRR.loadCustomLevel = async function (files, T, progress) {
    const { name, files2, P, B } = await build(files, T); const lvl = await BRR.loadLevel(files2, name, progress);
    ribbon(lvl, P, B, T);
    // la carretera tiene su propio suelo (asfalto, tierra, arena o nieve), no el de la baldosa que queda debajo: polvo, agarre y sonidos
    if (P.best) { const st = T.surf || ED.defSurf(T.base), d = B.thumbs[T.roadTile ?? B.roadTile].getContext('2d').getImageData(0, 0, 32, 32).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const rs = { type: st, col: [r, g, b].map(v => Math.min(1, v / 1024 / 255 * 1.15)) }, S0 = lvl.surface, bst = P.best, half = P.half, CS = CELL * BRR.S;
      lvl.surface = (x, z) => { const fx = x / CS, fz = -z / CS, ix = Math.floor(fx), iz = Math.floor(fz); if (ix < 0 || iz < 0 || ix > 254 || iz > 254) return S0(x, z); const u = fx - ix, v = fz - iz, q = (a, b2) => bst[b2 * 256 + a];
        const dd = (q(ix, iz) * (1 - u) + q(ix + 1, iz) * u) * (1 - v) + (q(ix, iz + 1) * (1 - u) + q(ix + 1, iz + 1) * u) * v; return dd < half + 0.05 ? rs : S0(x, z); }; }
    lvl.custom = T; lvl.title = T.name || 'Mi circuito'; lvl.aiKey = name + ':' + (T.rev || 0) + ':' + (T.updated || 0); return lvl;
  };

  // ---------- la pantalla del editor ----------
  const DEFS = { CITY: 'asfalto', DIRT: 'tierra', SNOW: 'nieve', RUF: 'tierra', RIG: 'tierra', MOON: 'tierra' };
  const ED = BRR.editor = { defSurf: base => DEFS[BRR.envOf(base)] || 'asfalto', THEMES, listTracks, saveTrack, delTrack, loadBase, spline, prepare, build };
  let delMode = false, hov = null, hf = null, host = null, T = null, B = null, cv = null, cx2 = null, terr = null, view = { z: 4, x: 0, y: 0 }, tool = 'road', brush = { r: 4, mode: 'up', str: 1 }, drag = null, undo = [], redo = [], sel = null, dirty = true, objPick = null;
  const $ = id => document.getElementById(id);
  function newTrack(base, Bb) { const h = new Uint8Array(65536).fill(48), t = new Uint8Array(65536).fill(Bb.groundTile);
    return { v: 1, id: ((BRR.cloud && BRR.cloud.id) || 'x') + '-' + Date.now().toString(36), name: 'Mi circuito', base, h, t, road: [], open: true, w: 14, objs: [], laps: 3, nitros: 3, roadTile: Bb.roadTile, rev: 0 }; }
  function snap() { undo.push({ h: T.h.slice(), t: T.t.slice(), road: JSON.stringify(T.road), objs: JSON.stringify(T.objs), w: T.w, open: !!T.open }); if (undo.length > 30) undo.shift(); redo = []; }
  function restore(st) { T.h = st.h; hf = Float32Array.from(T.h); T.t = st.t; T.road = JSON.parse(st.road); T.objs = JSON.parse(st.objs); T.w = st.w; T.open = !!st.open; openUI(); terrAll(); dirty = true; }
  const cur = () => ({ h: T.h.slice(), t: T.t.slice(), road: JSON.stringify(T.road), objs: JSON.stringify(T.objs), w: T.w, open: !!T.open });
  // terreno desde arriba: baldosa + sombreado del relieve (8 px por casilla)
  function terrCell(x, z) { const g = terr.getContext('2d'), k = z * 256 + x, px = x * 8, py = (255 - z) * 8; g.drawImage(B.thumbs[T.t[k]] || B.thumbs[0], px, py, 8, 8);
    const hh = (a, b) => T.h[Math.max(0, Math.min(255, b)) * 256 + Math.max(0, Math.min(255, a))], dx = hh(x + 1, z) - hh(x - 1, z), dz = hh(x, z + 1) - hh(x, z - 1), l = (-dx * 0.7 + dz * 0.7) / 10;
    g.fillStyle = l > 0 ? `rgba(255,255,255,${Math.min(0.35, l)})` : `rgba(0,0,0,${Math.min(0.5, -l)})`; g.fillRect(px, py, 8, 8);
    const ht = T.h[k] / 255; g.fillStyle = `rgba(${ht > 0.5 ? '255,250,230' : '0,10,40'},${Math.abs(ht - 0.19) * 0.25})`; g.fillRect(px, py, 8, 8); }
  function terrAll() { if (!terr) { terr = document.createElement('canvas'); terr.width = terr.height = 2048; } for (let z = 0; z < 256; z++) for (let x = 0; x < 256; x++) terrCell(x, z); }
  function terrArea(x0, z0, x1, z1) { for (let z = Math.max(0, z0 - 1); z <= Math.min(255, z1 + 1); z++) for (let x = Math.max(0, x0 - 1); x <= Math.min(255, x1 + 1); x++) terrCell(x, z); }
  const toCell = (mx, my) => [(mx - view.x) / view.z, (view.y - my) / view.z];
  const toScr = (x, z) => [view.x + x * view.z, view.y - z * view.z];
  function draw() {
    if (!cv || host.hidden) return; requestAnimationFrame(draw); if (drag && drag.brush) brushStep(drag.p);
    if (!dirty || !T || !terr || !B) return; dirty = false; const g = cx2, W = cv.width, H = cv.height; g.fillStyle = '#0b0d12'; g.fillRect(0, 0, W, H);
    g.imageSmoothingEnabled = view.z < 8; const [sx, sy] = toScr(0, 256); g.drawImage(terr, sx, sy, 256 * view.z, 256 * view.z);
    // carretera
    const S = spline(T.road, 0.25, !!T.open), half = (T.w || 14) / CM / 2;
    if (S.length && T.open && T.road.length > 2) { const [a, b] = toScr(S[S.length - 1].x, S[S.length - 1].z), [c, d] = toScr(S[0].x, S[0].z); g.setLineDash([6, 6]); g.strokeStyle = 'rgba(255,210,63,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); g.setLineDash([]); }   // por dónde se cerraría
    if (S.length) { g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath(); S.forEach((p, i) => { const [a, b] = toScr(p.x, p.z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); if (!T.open) g.closePath();
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = (half * 2 + 0.4) * view.z; g.stroke(); g.strokeStyle = 'rgba(120,124,132,.92)'; g.lineWidth = half * 2 * view.z; g.stroke();
      g.setLineDash([view.z * 1.5, view.z * 1.5]); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = Math.max(1, view.z * 0.15); g.stroke(); g.setLineDash([]);
      const GT = T.open ? [] : gatesOf(S); for (const gt of GT) { const p = gt.p, [a, b] = toScr(p.x - p.tz * half * 1.3, p.z + p.tx * half * 1.3), [c, d] = toScr(p.x + p.tz * half * 1.3, p.z - p.tx * half * 1.3);
        g.strokeStyle = gt.num === 0 ? '#fff' : '#ffd23f'; g.lineWidth = gt.num === 0 ? 4 : 3; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
      const p0 = S[0], [ax, ay] = toScr(p0.x, p0.z); g.save(); g.translate(ax, ay); g.rotate(Math.atan2(-p0.tz, p0.tx)); g.fillStyle = '#e2231a'; g.beginPath(); g.moveTo(16, 0); g.lineTo(-6, -9); g.lineTo(-6, 9); g.closePath(); g.fill(); g.restore(); }
    if (tool === 'road') T.road.forEach((p, i) => { const [a, b] = toScr(p[0], p[1]); g.fillStyle = i === 0 ? '#e2231a' : '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(a, b, 7, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#000'; g.font = 'bold 10px system-ui'; g.textAlign = 'center'; g.fillText(String(i + 1), a, b + 3.5); });
    // objetos
    for (const o of T.objs) { const [a, b] = toScr(o.x, o.z), bd = bounds(o.s || T.base, o.n), z = view.z; g.save(); g.translate(a, b); g.rotate((o.r || 0) * Math.PI / 180);   // a escala: su huella real
      let x0 = -2 / z, x1 = 2 / z, y0 = -2 / z, y1 = 2 / z; if (bd) { x0 = bd.x0; x1 = bd.x1; y0 = -bd.z1; y1 = -bd.z0; } const W2 = Math.max(3, (x1 - x0) * z), H2 = Math.max(3, (y1 - y0) * z), X0 = x0 * z - (W2 - (x1 - x0) * z) / 2, Y0 = y0 * z - (H2 - (y1 - y0) * z) / 2;
      g.fillStyle = o === sel ? 'rgba(255,210,63,.85)' : o.n === 'HALFPIPE' ? 'rgba(200,120,60,.8)' : SOFTN.test(o.n) ? 'rgba(90,209,122,.75)' : 'rgba(232,226,214,.75)'; g.strokeStyle = '#000'; g.lineWidth = 1; g.fillRect(X0, Y0, W2, H2); g.strokeRect(X0, Y0, W2, H2);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, Y0); g.stroke(); g.restore();
      if (view.z >= 10 && o === sel) { g.fillStyle = '#fff'; g.font = '10px system-ui'; g.textAlign = 'center'; g.fillText(o.n, a, b - Math.max(W2, H2) / 2 - 4); } }
    if (drag && drag.row && drag.p2) { const [a, b] = toScr(drag.p1[0], drag.p1[1]), [c2, d2] = toScr(drag.p2[0], drag.p2[1]); g.strokeStyle = '#ffd23f'; g.lineWidth = 2; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d2); g.stroke(); g.setLineDash([]);
      for (const q of rowPlan(drag.p1, drag.p2)) { const [x, y] = toScr(q.x, q.z); g.fillStyle = '#ffd23f'; g.fillRect(x - 2, y - 2, 4, 4); } }
    // brocha
    const hv = (drag && drag.hover) || hov; if (hv && tool === 'paint' && brush.r < 0.5) { const [a, b] = toScr(Math.floor(hv[0]), Math.floor(hv[1]) + 1); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(a, b, view.z, view.z); }
    else if (hv && (tool === 'terrain' || tool === 'paint')) { const [a, b] = toScr(hv[0], hv[1]); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(a, b, brush.r * view.z, 0, 7); g.stroke(); }
    $('ed_info').textContent = T.open ? `Circuito abierto: ${T.road.length} puntos · ${Math.round(S.total || 0)} m · ciérralo con «Cerrar circuito»` : S.length ? `Vuelta: ${Math.round(S.total)} m · ${gatesOf(S).length} controles · ${T.road.length} puntos` : 'Pon al menos 3 puntos de carretera';
  }
  function brushStep(p) {
    if (!p) return; if (tool === 'paint' && brush.r < 0.5) { const x = Math.floor(p[0]), z = Math.floor(p[1]); if (x >= 0 && z >= 0 && x < 256 && z < 256 && brush.tile != null && T.t[z * 256 + x] !== brush.tile) { T.t[z * 256 + x] = brush.tile; terrArea(x, z, x, z); dirty = true; } return; }   // tamaño 0: una sola casilla
    const [px, pz] = p, r = brush.r, x0 = Math.floor(px - r), x1 = Math.ceil(px + r), z0 = Math.floor(pz - r), z1 = Math.ceil(pz + r), now = performance.now(), dt = Math.min(0.05, (now - (drag.t || now)) / 1000) || 0.016; drag.t = now;
    for (let z = Math.max(0, z0); z <= Math.min(255, z1); z++) for (let x = Math.max(0, x0); x <= Math.min(255, x1); x++) {
      const d = Math.hypot(x - px, z - pz); if (d > r) continue; const k = z * 256 + x, f = Math.cos(d / r * Math.PI / 2) ** 2;
      if (tool === 'paint') { if (brush.tile != null) T.t[k] = brush.tile; continue; }
      const sp = 60 * brush.str * dt * f; let v = hf[k];
      if (brush.mode === 'up') v += sp; else if (brush.mode === 'down') v -= sp; else if (brush.mode === 'flat') v += (drag.flat - v) * Math.min(1, f * dt * 6 * brush.str);
      else if (brush.mode === 'smooth') { let a = 0, n = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X > 255 || Z > 255) continue; a += hf[Z * 256 + X]; n++; } v += (a / n - v) * Math.min(1, f * dt * 8 * brush.str); }
      hf[k] = Math.max(0, Math.min(255, v)); T.h[k] = Math.round(hf[k]); }
    terrArea(x0, z0, x1, z1); dirty = true;
  }
  // estilos de terreno al azar: octavas [tamaño en casillas, altura] · multiplicador · altura base · crestas (montañas afiladas)
  // sitios del mundo para poner el circuito en el globo (en las coordenadas del globo del juego original)
  const PLACES = [["España", -2.78, 37.97], ["Portugal", -8, 34.5], ["Francia", 7.06, 37.97], ["Italia", 18.31, 33.75], ["Alemania", 9.88, 42.19], ["Inglaterra", -1.38, 45], ["Escocia", -1.38, 50.63], ["Irlanda", -5.59, 45], ["Países Bajos", 5, 45], ["Bélgica", 4.4, 43], ["Suiza", 8, 39.5], ["Austria", 14, 41], ["Noruega", 15.5, 53.44], ["Suecia", 18, 52], ["Finlandia", 26, 55], ["Polonia", 19, 45], ["Rusia", 83, 50.63], ["Grecia", 22, 32], ["Turquía", 33, 33], ["Marruecos", -6, 26], ["Egipto", 23.94, 16.88], ["Kenia", 14.09, 22.5], ["Sudáfrica", 25, -34], ["Arabia Saudí", 45, 18], ["Emiratos Árabes", 54, 18], ["India", 83, 16.88], ["China", 116.75, 45], ["Japón", 142.06, 33.75], ["Corea del Sur", 128, 31], ["Tailandia", 101, 9], ["Singapur", 104, 1], ["Australia", 139.25, -33.75], ["Nueva Zelanda", 174, -42], ["Hawái", 218, 11.25], ["Canadá", 255, 50], ["EE. UU. (este)", 274.25, 22.5], ["EE. UU. (oeste)", 240.5, 33.75], ["Méjico", 274.25, 11.25], ["Colombia", 286, 4], ["Brasil", 312, -15], ["Argentina", 296, -38], ["Chile", 285.5, -45], ["Ártico", 308, 90]];
  ED.PLACES = PLACES;
  const HILLS = { suave: { oct: [[24, 22], [12, 10], [6, 4]], k: 2.2, b: 24 }, montanas: { oct: [[56, 46], [22, 18], [8, 5]], k: 2.6, b: 10, ridge: 1 }, medio: { oct: [[36, 18], [14, 8], [6, 3]], k: 1.8, b: 34 }, llano: { oct: [[48, 9], [16, 4]], k: 1.4, b: 44 }, dunas: { oct: [[18, 14], [9, 6]], k: 1.6, b: 36 } };
  function hills() { snap(); const R = (n => { let s = n; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(Date.now() % 1e6 + 1), HS = HILLS[$('ed_hstyle').value] || HILLS.suave, oct = HS.oct;
    const NN = c => Math.ceil(256 / c) + 2, grid = oct.map(([c]) => { const G = []; for (let i = 0; i < NN(c) ** 2; i++) G.push(R()); return G; });
    for (let z = 0; z < 256; z++) for (let x = 0; x < 256; x++) { let v = 0; oct.forEach(([c, a], o) => { const n = NN(c), gx = x / c, gz = z / c, ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, w = gz - iz, s = q => q * q * (3 - 2 * q), G = grid[o], q = (a2, b2) => G[b2 * n + a2];
      const nv = (q(ix, iz) * (1 - s(u)) + q(ix + 1, iz) * s(u)) * (1 - s(w)) + (q(ix, iz + 1) * (1 - s(u)) + q(ix + 1, iz + 1) * s(u)) * s(w); v += a * (HS.ridge && o === 0 ? (1 - Math.abs(nv * 2 - 1)) ** 1.5 : nv); }); T.h[z * 256 + x] = Math.max(0, Math.min(255, Math.round(HS.b + v * HS.k))); }
    hf = Float32Array.from(T.h); terrAll(); dirty = true; }
  // en fila: el objeto elegido repetido a lo largo de la línea, pegado uno al otro y girado según la línea (vallas, carteles)
  function rowPlan(p1, p2) { const [os, on] = (objPick || '|').split('|'), bd = bounds(os, on); if (!bd) return []; const dx = p2[0] - p1[0], dz = p2[1] - p1[1], L = Math.hypot(dx, dz); if (L < 0.05) return [];
    const alongX = bd.x1 - bd.x0 >= bd.z1 - bd.z0, step = Math.max(0.05, alongX ? bd.x1 - bd.x0 : bd.z1 - bd.z0), r = alongX ? Math.atan2(-dz, dx) : Math.atan2(dx, dz), n = Math.max(1, Math.floor(L / step) + 1), out = [];
    for (let i = 0; i < Math.min(n, 300); i++) { const t = i * step / L; out.push({ n: on, s: os === T.base ? undefined : os, x: p1[0] + dx * t, z: p1[1] + dz * t, r: Math.round(r * 180 / Math.PI * 10) / 10 }); } return out; }
  function pickAt(mx, my) { let best = null, bd = 9; T.road.forEach((p, i) => { const [a, b] = toScr(p[0], p[1]), d = Math.hypot(a - mx, b - my); if (d < bd) { bd = d; best = i; } }); return best; }
  function objAt(mx, my) { const [cx, cz] = toCell(mx, my); for (let i = T.objs.length - 1; i >= 0; i--) { const o = T.objs[i], bd = bounds(o.s || T.base, o.n); if (!bd) continue; const r = (o.r || 0) * Math.PI / 180, dx = cx - o.x, dz = cz - o.z, lx = dx * Math.cos(r) - dz * Math.sin(r), lz = dx * Math.sin(r) + dz * Math.cos(r);   // a sus ejes
      if (lx >= bd.x0 && lx <= bd.x1 && lz >= bd.z0 && lz <= bd.z1) return o; }
    let best = null, bd = 5; for (const o of T.objs) { const [a, b] = toScr(o.x, o.z), d = Math.hypot(a - mx, b - my); if (d < bd) { bd = d; best = o; } } return best; }
  function openUI() { const b = $('ed_close'); if (b && T) b.textContent = T.open ? '🔁 Cerrar circuito' : '✂ Abrir circuito'; }
  function insertRoad(c) { const P = T.road; if (P.length < 3 || T.open) { P.push(c); return P.length - 1; }   // abierto: cada punto nuevo sigue el trazado desde el último
    let bi = 0, bd = 1e9; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], vx = b[0] - a[0], vz = b[1] - a[1], t = Math.max(0, Math.min(1, ((c[0] - a[0]) * vx + (c[1] - a[1]) * vz) / (vx * vx + vz * vz || 1))), d = Math.hypot(a[0] + vx * t - c[0], a[1] + vz * t - c[1]); if (d < bd) { bd = d; bi = i; } }
    P.splice(bi + 1, 0, c); return bi + 1; }
  // huella de cada objeto (en casillas, ejes propios del modelo) para dibujarlo a escala y ponerlos en fila
  const BND = new Map(), bndLoading = new Set();
  function bounds(s0, n) { const k = s0 + '|' + n; if (BND.has(k)) return BND.get(k); if (n === 'HALFPIPE') { const b = { x0: -0.5, x1: 0.5, z0: -0.47, z1: 0.47 }; BND.set(k, b); return b; }
    if (!bndLoading.has(k) && host) { bndLoading.add(k); host.files().archive(s0 + '.LEV').then(A => { const raw = A.get(n + '.3DW'); if (!raw) return; const m = BRR.parse3DW(raw); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const v of m.verts) if (v) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); z0 = Math.min(z0, v[2]); z1 = Math.max(z1, v[2]); } if (x1 > x0) { BND.set(k, { x0: x0 / CELL, x1: x1 / CELL, z0: z0 / CELL, z1: z1 / CELL }); dirty = true; } }).catch(() => { }); }
    return null; }
  let oTh = null, oTk = 0, oA = 0;
  async function othumb() { const k = ++oTk, [lev, n] = (objPick || '|').split('|'); oTh = null; $('ed_oinfo').textContent = n || ''; if (!host.objThumb || !n) return;
    try { const th = await host.objThumb(lev, n); if (k !== oTk) return; oTh = th; if (th && th.size) $('ed_oinfo').textContent = `${n} · ${lev} · ${th.size[0].toFixed(1)} × ${th.size[2].toFixed(1)} × ${th.size[1].toFixed(1)} m`; } catch (e) { } }
  function othumbLoop() { if (!host || host.hidden) return; requestAnimationFrame(othumbLoop); if (tool !== 'objs' || !oTh) return; oA += 0.02; const src = oTh.frame(oA), cv2 = $('ed_othumb'), g = cv2.getContext('2d'); g.clearRect(0, 0, cv2.width, cv2.height); const sz = Math.min(cv2.width, cv2.height); g.drawImage(src, (cv2.width - sz) / 2, 0, sz, sz); }
  function setTool(t) { tool = t; if (t === 'objs' && !oTh) othumb(); if (t === 'paint') brush.r = +$('ed_pr').value; if (t === 'terrain') brush.r = +$('ed_r').value; for (const b of host.querySelectorAll('[data-tool]')) b.classList.toggle('on', b.dataset.tool === t); for (const p of host.querySelectorAll('.edp')) p.hidden = p.dataset.p !== t; dirty = true; }
  function resize() { const r = cv.parentElement.getBoundingClientRect(); cv.width = Math.max(200, r.width | 0); cv.height = Math.max(200, r.height | 0); dirty = true; }
  function fit() { const r = cv.getBoundingClientRect(); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const p of T.road.length ? T.road : [[96, 96], [160, 160]]) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    const m = 12; view.z = Math.max(1, Math.min(r.width / (x1 - x0 + 2 * m), r.height / (z1 - z0 + 2 * m))); view.x = r.width / 2 - (x0 + x1) / 2 * view.z; view.y = r.height / 2 + (z0 + z1) / 2 * view.z; dirty = true; }
  async function openTrack(t, keepView) {
    T = t; openUI(); B = await loadBase(host.files(), T.base); if (T.roadTile == null) T.roadTile = B.roadTile; undo = []; redo = []; sel = null; terr = null; hf = Float32Array.from(T.h); terrAll();
    $('ed_name').value = T.name; $('ed_cover').src = T.cover || ED.preview(T.road, T.base, 480, 270); $('ed_surf').value = T.surf || ED.defSurf(T.base); $('ed_laps').value = T.laps; $('ed_kind').value = T.kind || 'normal'; $('ed_place').value = T.placeName ? String(PLACES.findIndex(p => p[0] === T.placeName)) : ''; $('ed_desc').value = T.desc || ''; $('ed_scale').value = 100; $('ed_scalev').textContent = '100%'; $('ed_nitros').value = T.nitros; $('ed_w').value = T.w; $('ed_wv').textContent = T.w + ' m'; $('ed_base').textContent = T.base;
    $('ed_tiles').innerHTML = ''; B.thumbs.forEach((c, i) => { const b = document.createElement('canvas'); b.width = b.height = 32; b.getContext('2d').drawImage(c, 0, 0); b.title = 'Baldosa ' + i; b.className = 'edtile'; b.onclick = () => { brush.tile = i; for (const x of $('ed_tiles').children) x.classList.toggle('on', x === b); }; $('ed_tiles').appendChild(b); });
    brush.tile = B.groundTile; $('ed_tiles').children[brush.tile] && $('ed_tiles').children[brush.tile].classList.add('on');
    const rt = $('ed_rtile'); rt.innerHTML = ''; B.thumbs.forEach((c, i) => { const b = document.createElement('canvas'); b.width = b.height = 32; b.getContext('2d').drawImage(c, 0, 0); b.className = 'edtile' + (i === T.roadTile ? ' on' : ''); b.onclick = () => { snap(); T.roadTile = i; for (const x of rt.children) x.classList.toggle('on', x === b); }; rt.appendChild(b); });
    { const AM = await allModels(host.files()), by = new Map(); for (const n of B.models) by.set(n, T.base); for (const g of AM) for (const n of g.names) if (!by.has(n)) by.set(n, g.lev);   // cada objeto una vez (si está en el tema, el del tema)
      by.set('HALFPIPE', 'BRR'); const L = [...by].sort((a, b) => a[0].localeCompare(b[0]));
      $('ed_obj').innerHTML = L.map(([n, lev]) => `<option value="${lev}|${n}">${n === 'HALFPIPE' ? 'HALFPIPE (half pipe)' : n}</option>`).join(''); objPick = L[0][1] + '|' + L[0][0]; $('ed_obj').value = objPick; }
    if (!keepView) setTimeout(fit, 0); dirty = true;
  }
  function readUI() { T.kind = $('ed_kind').value; const pi = $('ed_place').value; if (pi === '') { delete T.lon; delete T.lat; delete T.placeName; } else { const P = PLACES[+pi]; T.lon = P[1]; T.lat = P[2]; T.placeName = P[0]; } T.desc = $('ed_desc').value.trim().slice(0, 80);
    T.name = $('ed_name').value.trim().slice(0, 40) || 'Mi circuito'; T.laps = Math.max(1, Math.min(20, +$('ed_laps').value || 3)); T.nitros = Math.max(0, Math.min(12, +$('ed_nitros').value || 0)); }
  async function saveNow(msg = true) { readUI(); const S = spline(T.road); T.lenM = Math.round(S.total || 0); await saveTrack(T); if (msg) toast('Guardado'); }
  function toast(t) { const e = $('ed_toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, 1800); }
  async function renderList() {
    const L = await listTracks(), el = $('ed_list');
    el.innerHTML = (L.length ? L.map(r => `<div class="rpl" data-id="${r.id}"><div><b>${esc(r.name)}</b> <span class="small">(${esc(r.base)})</span><br><span class="small">${new Date(r.updated).toLocaleString()} · ${r.len ? r.len + ' m' : ''}</span></div><div class="rplb"><button data-a="open" class="main">Abrir</button><button data-a="play">▶</button><button data-a="exp" title="Exportar archivo">⬇</button><button data-a="del" title="Borrar">🗑</button></div></div>`).join('') : '<p class="small">Aún no tienes circuitos. Empieza uno nuevo eligiendo el tema.</p>');
    for (const b of el.querySelectorAll('button')) b.onclick = async () => { const id = b.closest('.rpl').dataset.id, a = b.dataset.a, t = await dget('trk_' + id); if (!t && a !== 'del') return;
      if (a === 'open') { $('ed_home').hidden = true; await openTrack(t); }
      else if (a === 'play') host.play(t);
      else if (a === 'exp') exportTrack(t);
      else if (a === 'del') { if (b.dataset.sure) { await delTrack(id); renderList(); } else { b.dataset.sure = 1; b.textContent = '¿Borrar?'; } } };
  }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  async function exportTrack(t) { const j = await ED.pack(t), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([j], { type: 'application/json' })); a.download = (t.name || 'circuito').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') + '.brrtrack'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  async function importTrack(f) { const j = JSON.parse(await f.text()); if (j && j.hz) { const t = await ED.unpack(j); t.id = ((BRR.cloud && BRR.cloud.id) || 'x') + '-' + Date.now().toString(36); delete t.pub; await saveTrack(t); return t; } if (j.brr !== 'track' || !j.h || !j.t || !Array.isArray(j.road)) throw new Error('No es un circuito de Big Red Report');
    const t = { v: 1, id: ((BRR.cloud && BRR.cloud.id) || 'x') + '-' + Date.now().toString(36), name: String(j.name || 'Circuito').slice(0, 40), base: THEMES.includes(j.base) ? j.base : 'CITY1', h: unb64(j.h), t: unb64(j.t), road: j.road.filter(p => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])).slice(0, 200).map(p => [+p[0], +p[1]]),
      w: Math.max(8, Math.min(30, +j.w || 14)), objs: (j.objs || []).slice(0, 2000).map(o => ({ n: String(o.n || '').replace(/[^A-Z0-9_]/gi, '').slice(0, 12).toUpperCase(), x: +o.x || 0, z: +o.z || 0, r: +o.r || 0 })), laps: j.laps | 0 || 3, nitros: j.nitros | 0, roadTile: j.roadTile | 0, rev: 0 };
    if (t.h.length !== 65536 || t.t.length !== 65536) throw new Error('Circuito incompleto'); await saveTrack(t); return t; }

  ED.init = function (opts) {
    host = document.createElement('div'); host.id = 'editor'; host.hidden = true; host.files = opts.files; host.play = opts.play; host.close = opts.close; host.author = opts.author || (() => 'Piloto'); host.view3d = opts.view3d; host.objThumb = opts.objThumb;
    host.innerHTML = `<div class="edtop"><b>🛠 Editor de circuitos</b><input id="ed_name" maxlength="40" placeholder="Nombre del circuito"><span class="small">Tema: <b id="ed_base"></b></span><span class="small" id="ed_info"></span>
      <span style="flex:1"></span><button id="ed_undo" title="Deshacer (Ctrl+Z)">↶</button><button id="ed_redo" title="Rehacer (Ctrl+Y)">↷</button><button id="ed_fit" title="Ver todo">⤢</button><button id="ed_save">💾 Guardar</button><button id="ed_3d" title="Recorrerlo con la cámara libre">🧊 Ver en 3D</button><button id="ed_play" class="main">▶ Probar</button><button id="ed_pub">🌐 Publicar</button><button id="ed_my">📁 Mis circuitos</button><button id="ed_exit">✕ Salir</button></div>
      <div class="edmain"><div class="edcv"><canvas id="ed_cv"></canvas><div id="ed_toast" hidden></div></div>
      <div class="edside"><div class="edtools"><button data-tool="road">🛣️ Carretera</button><button data-tool="terrain">⛰️ Terreno</button><button data-tool="paint">🎨 Suelo</button><button data-tool="objs">🌴 Objetos</button><button data-tool="set">⚙️ Ajustes</button></div>
        <div class="edp" data-p="road"><p class="small">Clic para añadir un punto (abierto: sigue desde el último; cerrado: se mete en el tramo más cercano) · arrastra para moverlo · clic derecho para quitarlo. Cuando acabes, pulsa «Cerrar circuito». El punto rojo es la salida. Los controles y la parrilla se ponen solos.</p>
          <div class="edrow"><span>Ancho</span><input type="range" id="ed_w" min="8" max="30" step="1"><span id="ed_wv"></span></div>
          <div class="edrow"><button id="ed_close" class="main">🔁 Cerrar circuito</button><button id="ed_rev">⇄ Cambiar sentido</button><button id="ed_clear">Borrar carretera</button><button class="eddel">🗑 Modo borrar</button></div><div class="edrow"><span>Tipo</span><select id="ed_surf"><option value="asfalto">Asfalto</option><option value="tierra">Tierra</option><option value="arena">Arena</option><option value="nieve">Nieve</option></select></div><p class="small">Textura de la carretera:</p><div id="ed_rtile" class="edtiles"></div></div>
        <div class="edp" data-p="terrain"><div class="edrow edmodes"><button data-m="up" class="on">⬆ Subir</button><button data-m="down">⬇ Bajar</button><button data-m="flat">▬ Allanar</button><button data-m="smooth">≈ Suavizar</button></div>
          <div class="edrow"><span>Tamaño</span><input type="range" id="ed_r" min="1" max="24" value="4"></div><div class="edrow"><span>Fuerza</span><input type="range" id="ed_s" min="1" max="10" value="5"></div>
          <div class="edrow"><select id="ed_hstyle" title="Estilo del terreno al azar"><option value="suave">Colinas suaves</option><option value="medio">Desniveles intermedios</option><option value="montanas">Montañas grandes</option><option value="llano">Casi llano</option><option value="dunas">Dunas</option></select><button id="ed_hills">🎲 Terreno al azar</button><button id="ed_flatall">Todo llano</button></div><p class="small">Bajo la carretera el terreno se allana solo al probar el circuito.</p></div>
        <div class="edp" data-p="paint"><div class="edrow"><span>Tamaño</span><input type="range" id="ed_pr" min="0" max="24" value="0"></div><div id="ed_tiles" class="edtiles"></div><div class="edrow"><button id="ed_fill">Pintar todo con esta</button></div></div>
        <div class="edp" data-p="objs"><canvas id="ed_othumb" width="192" height="150" style="display:block;width:100%;max-width:240px;margin:0 auto;border-radius:10px;background:radial-gradient(#2a3040,#10131b)"></canvas><div class="small" id="ed_oinfo" style="text-align:center"></div><select id="ed_obj" size="9" style="width:100%"></select><p class="small">Clic para poner el objeto elegido · arrastra para moverlo · clic derecho para quitarlo · R o rueda con Mayús para girarlo.</p>
          <div class="edrow"><label class="small"><input type="checkbox" id="ed_rnd" checked> Giro al azar</label><label class="small"><input type="checkbox" id="ed_row"> En fila (arrastra)</label><button id="ed_odel">Quitar el elegido</button><button id="ed_orot">⟳ Girar</button><button class="eddel">🗑 Modo borrar</button></div></div>
        <div class="edp" data-p="set"><p class="small" style="margin:0">Portada (sale en las listas y en la comunidad):</p><img id="ed_cover" alt="" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;background:#222"><div class="edrow"><button id="ed_coverf">📂 Cargar imagen</button><button id="ed_cover3d">📷 Sacar foto en 3D</button><button id="ed_coverx" title="Quitar la portada">✕</button></div><input type="file" id="ed_coverfile" accept="image/*" hidden><div class="edrow"><span>Vueltas</span><input type="number" id="ed_laps" min="1" max="20" style="width:70px"></div><div class="edrow"><span>Nitros</span><input type="number" id="ed_nitros" min="0" max="12" style="width:70px"></div><div class="edrow"><span>Modo</span><select id="ed_kind"><option value="normal">Normal (carreras, contrarreloj…)</option><option value="gp">Grand Prix</option><option value="drift">Drift</option></select></div><div class="edrow"><span>Lugar</span><select id="ed_place"><option value="">Sin lugar</option>${PLACES.map((p, i) => `<option value="${i}">${p[0]}</option>`).join('')}</select></div><p class="small" style="margin:6px 0 2px">Comentario (sale debajo del nombre):</p><input id="ed_desc" maxlength="80" placeholder="Ej.: rápido, con muchas curvas enlazadas" style="width:100%"><p class="small" style="margin:10px 0 2px">Tamaño del trazado (todo junto, con los objetos): <b id="ed_scalev">100%</b></p><input type="range" id="ed_scale" min="50" max="200" value="100" style="width:100%">
          <p class="small">Rueda del ratón: zoom · arrastrar con botón derecho o central (o Espacio): mover la vista. En pantalla táctil: dos dedos para mover y pellizcar para el zoom.</p><div class="edrow"><button id="ed_exp">⬇ Exportar archivo</button></div></div></div></div>
      <div id="ed_home" class="edhome" hidden><div class="card"><h2>🛠 Mis circuitos</h2><div id="ed_list"></div>
        <h3 style="margin:14px 0 6px">Nuevo circuito</h3><div class="edrow"><span>Tema</span><select id="ed_theme"></select><button id="ed_new" class="main">Crear</button></div>
        <div class="grid2" style="margin-top:12px"><button id="ed_imp">📂 Importar archivo…</button><button id="ed_hclose">Cerrar</button></div><input type="file" id="ed_file" accept=".brrtrack,application/json" hidden></div></div>`;
    document.body.appendChild(host); cv = $('ed_cv'); cx2 = cv.getContext('2d');
    addEventListener('resize', () => { if (!host.hidden) resize(); });
    for (const b of host.querySelectorAll('[data-tool]')) b.onclick = () => setTool(b.dataset.tool);
    for (const b of host.querySelectorAll('[data-m]')) b.onclick = () => { brush.mode = b.dataset.m; for (const x of host.querySelectorAll('[data-m]')) x.classList.toggle('on', x === b); };
    $('ed_r').oninput = () => { brush.r = +$('ed_r').value; }; $('ed_s').oninput = () => { brush.str = +$('ed_s').value / 5; }; $('ed_pr').oninput = () => { brush.r = +$('ed_pr').value; dirty = true; };
    $('ed_w').oninput = () => { T.w = +$('ed_w').value; $('ed_wv').textContent = T.w + ' m'; dirty = true; }; $('ed_w').onchange = () => snap();
    $('ed_surf').onchange = () => { snap(); T.surf = $('ed_surf').value; };
    // tamaño: escala todo el trazado (y los objetos) desde su centro, como una sola pieza
    let scB = null; $('ed_scale').oninput = () => { if (!T.road.length) return; if (!scB) { snap(); let cx = 0, cz = 0; for (const p of T.road) { cx += p[0]; cz += p[1]; } cx /= T.road.length; cz /= T.road.length; scB = { c: [cx, cz], road: T.road.map(p => p.slice()), objs: T.objs.map(o => ({ x: o.x, z: o.z })) }; }
      const k = +$('ed_scale').value / 100, cl = v => Math.max(4, Math.min(252, v)); $('ed_scalev').textContent = Math.round(k * 100) + '%';
      T.road = scB.road.map(p => [cl(scB.c[0] + (p[0] - scB.c[0]) * k), cl(scB.c[1] + (p[1] - scB.c[1]) * k)]); T.objs.forEach((o, i) => { const b = scB.objs[i]; if (b) { o.x = cl(scB.c[0] + (b.x - scB.c[0]) * k); o.z = cl(scB.c[1] + (b.z - scB.c[1]) * k); } }); dirty = true; };
    $('ed_scale').onchange = () => { scB = null; $('ed_scale').value = 100; $('ed_scalev').textContent = '100%'; };
    $('ed_close').onclick = () => { if (!T.open && T.road.length < 3) return; if (T.open && T.road.length < 3) { toast('Pon al menos 3 puntos de carretera'); return; } snap(); T.open = !T.open; openUI(); dirty = true; };
    $('ed_rev').onclick = () => { snap(); T.road = [T.road[0], ...T.road.slice(1).reverse()]; dirty = true; };
    $('ed_clear').onclick = () => { snap(); T.road = []; T.open = true; openUI(); dirty = true; };
    $('ed_hills').onclick = hills; $('ed_flatall').onclick = () => { snap(); T.h.fill(48); hf = Float32Array.from(T.h); terrAll(); dirty = true; };
    $('ed_fill').onclick = () => { if (brush.tile == null) return; snap(); T.t.fill(brush.tile); terrAll(); dirty = true; };
    $('ed_obj').onchange = () => { objPick = $('ed_obj').value; othumb(); };
    for (const b of host.querySelectorAll('.eddel')) b.onclick = () => { delMode = !delMode; for (const x of host.querySelectorAll('.eddel')) x.classList.toggle('on', delMode); };
    $('ed_orot').onclick = () => { if (sel) { sel.r = ((sel.r || 0) + 15) % 360; dirty = true; } };
    $('ed_odel').onclick = () => { if (!sel) return; snap(); T.objs = T.objs.filter(o => o !== sel); sel = null; dirty = true; };
    $('ed_undo').onclick = () => { const s = undo.pop(); if (s) { redo.push(cur()); restore(s); } }; $('ed_redo').onclick = () => { const s = redo.pop(); if (s) { undo.push(cur()); restore(s); } };
    $('ed_fit').onclick = fit; $('ed_save').onclick = () => saveNow();
    $('ed_play').onclick = async () => { await saveNow(false); if (T.open) { toast('Primero cierra el circuito (botón «Cerrar circuito»)'); return; } if (T.road.length < 3) { toast('Pon al menos 3 puntos de carretera'); return; } host.play(T); };
    $('ed_my').onclick = async () => { await saveNow(false); $('ed_home').hidden = false; renderList(); };
    $('ed_exit').onclick = async () => { if (T) await saveNow(false); ED.close(); };
    $('ed_coverf').onclick = () => $('ed_coverfile').click();
    $('ed_coverfile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const im = await createImageBitmap(f), c = document.createElement('canvas'); c.width = 480; c.height = 270; const g = c.getContext('2d'), k = Math.max(480 / im.width, 270 / im.height);
      g.drawImage(im, (480 - im.width * k) / 2, (270 - im.height * k) / 2, im.width * k, im.height * k); snap(); T.cover = c.toDataURL('image/jpeg', 0.78); $('ed_cover').src = T.cover; await saveNow(false); toast('Portada puesta'); } catch (x) { toast('No se puede leer esa imagen'); } };
    $('ed_cover3d').onclick = () => { toast('En la vista 3D, pulsa «🖼 Usar como portada»'); $('ed_3d').onclick(); };
    $('ed_coverx').onclick = async () => { delete T.cover; $('ed_cover').src = ED.preview(T.road, T.base, 480, 270); await saveNow(false); };
    $('ed_3d').onclick = async () => { await saveNow(false); if (T.open) { toast('Primero cierra el circuito (botón «Cerrar circuito»)'); return; } if (T.road.length < 3) { toast('Pon al menos 3 puntos de carretera'); return; } host.view3d(T); };
    $('ed_pub').onclick = async () => { const b = $('ed_pub'); await saveNow(false); if (T.open) { toast('Primero cierra el circuito (botón «Cerrar circuito»)'); return; } if (T.road.length < 3) { toast('Pon al menos 3 puntos de carretera'); return; } b.disabled = true; b.textContent = 'Publicando…';
      try { await ED.publish(T, host.author()); toast('Publicado en la comunidad'); } catch (e) { toast(e.message || String(e)); } b.disabled = false; b.textContent = '🌐 Publicar'; };
    $('ed_exp').onclick = async () => { await saveNow(false); exportTrack(T); };
    $('ed_theme').innerHTML = THEMES.map(t => `<option value="${t}">${t}</option>`).join('');
    $('ed_new').onclick = async () => { const base = $('ed_theme').value; try { const Bb = await loadBase(host.files(), base); $('ed_home').hidden = true; await openTrack(newTrack(base, Bb)); await saveNow(false); } catch (e) { toast('No se puede usar ese tema: ' + (e.message || e)); } };
    $('ed_hclose').onclick = () => { if (T) $('ed_home').hidden = true; else ED.close(); };
    $('ed_imp').onclick = () => $('ed_file').click();
    $('ed_file').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const t = await importTrack(f); renderList(); toast('Importado: ' + t.name); } catch (x) { toast(x.message || String(x)); } };
    // ratón
    let space = false;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) * cv.width / (r.width || 1), my = (e.clientY - r.top) * cv.height / (r.height || 1);
      if (e.shiftKey && tool === 'objs' && sel) { sel.r = ((sel.r || 0) + (e.deltaY > 0 ? 15 : -15) + 360) % 360; dirty = true; return; }
      const [cx, cz] = toCell(mx, my), k = e.deltaY > 0 ? 1 / 1.15 : 1.15; view.z = Math.max(0.8, Math.min(40, view.z * k)); view.x = mx - cx * view.z; view.y = my + cz * view.z; dirty = true; }, { passive: false });
    // táctil: dos dedos mueven y hacen zoom (pellizco); con «Borrar» activado, tocar quita el punto o el objeto
    const ptrs = new Map(); let pinch = null;
    const pinchStart = () => { const [a, b] = [...ptrs.values()], r = cv.getBoundingClientRect(); if (drag && drag.brush) { const s0 = undo.pop(); if (s0) restore(s0); } else if (drag && (drag.road != null || drag.obj)) { const s0 = undo.pop(); if (s0) restore(s0); }
      drag = null; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top, z: view.z, vx: view.x, vy: view.y }; };
    cv.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 2) { pinchStart(); return; } if (ptrs.size > 2 || pinch) return;
      const r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) * cv.width / (r.width || 1), my = (e.clientY - r.top) * cv.height / (r.height || 1), c = toCell(mx, my); cv.setPointerCapture(e.pointerId);
      if (delMode && (tool === 'road' || tool === 'objs')) { if (tool === 'road') { const i = pickAt(mx, my); if (i != null) { snap(); T.road.splice(i, 1); dirty = true; } } else { const o = objAt(mx, my); if (o) { snap(); T.objs = T.objs.filter(x => x !== o); if (sel === o) sel = null; dirty = true; } } return; }
      if (e.button === 1 || (e.button === 2 && tool !== 'road' && tool !== 'objs') || space) { drag = { pan: true, mx, my, vx: view.x, vy: view.y }; return; }
      if (tool === 'road') { const i = pickAt(mx, my); if (e.button === 2) { if (i != null) { snap(); T.road.splice(i, 1); dirty = true; } else drag = { pan: true, mx, my, vx: view.x, vy: view.y }; return; }
        snap(); drag = { road: i != null ? i : insertRoad(c) }; dirty = true; return; }
      if (tool === 'objs') { const o = objAt(mx, my); if (e.button === 2) { if (o) { snap(); T.objs = T.objs.filter(x => x !== o); if (sel === o) sel = null; dirty = true; } else drag = { pan: true, mx, my, vx: view.x, vy: view.y }; return; }
        snap(); if ($('ed_row').checked && objPick && !o) { drag = { row: true, p1: c, p2: c }; return; }
        if (o) { sel = o; drag = { obj: o }; } else if (objPick) { const [os, on] = objPick.split('|'), n = { n: on, s: os === T.base ? undefined : os, x: c[0], z: c[1], r: $('ed_rnd').checked ? Math.floor(Math.random() * 24) * 15 : 0 }; T.objs.push(n); sel = n; drag = { obj: n }; } dirty = true; return; }
      if (tool === 'terrain' || tool === 'paint') { if (tool === 'paint') brush.r = +$('ed_pr').value; else brush.r = +$('ed_r').value; snap(); drag = { brush: true, p: c, hover: c, flat: hAt(T.h, c[0], c[1]) }; }
    });
    cv.addEventListener('pointermove', e => { if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch) { if (ptrs.size < 2) return; const [a, b] = [...ptrs.values()], r = cv.getBoundingClientRect(), d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
        const z2 = Math.max(0.8, Math.min(40, pinch.z * d / pinch.d)), cx = (pinch.mx - pinch.vx) / pinch.z, cz = (pinch.vy - pinch.my) / pinch.z; view.z = z2; view.x = mx - cx * z2; view.y = my + cz * z2; dirty = true; return; }
      const r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) * cv.width / (r.width || 1), my = (e.clientY - r.top) * cv.height / (r.height || 1), c = toCell(mx, my);
      if (!drag) { if (tool === 'terrain' || tool === 'paint') { hov = c; dirty = true; } return; }
      if (drag.pan) { view.x = drag.vx + mx - drag.mx; view.y = drag.vy + my - drag.my; dirty = true; }
      else if (drag.road != null) { T.road[drag.road] = [Math.max(4, Math.min(252, c[0])), Math.max(4, Math.min(252, c[1]))]; dirty = true; }
      else if (drag.obj) { drag.obj.x = c[0]; drag.obj.z = c[1]; dirty = true; }
      else if (drag.row) { drag.p2 = c; dirty = true; }
      else if (drag.brush) { drag.p = c; drag.hover = c; } });
    const up = e => { ptrs.delete(e.pointerId); if (pinch) { if (!ptrs.size) pinch = null; return; } if (drag && drag.brush) dirty = true; if (drag && drag.row) { const L = rowPlan(drag.p1, drag.p2); if (L.length) { T.objs.push(...L); sel = L[L.length - 1]; } dirty = true; } drag = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    addEventListener('keydown', e => { if (host.hidden || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return;
      if (e.code === 'Space') { space = true; e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); $('ed_undo').onclick(); } if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); $('ed_redo').onclick(); }
      if (e.code === 'KeyR' && sel) { sel.r = ((sel.r || 0) + (e.shiftKey ? -15 : 15) + 360) % 360; dirty = true; }
      if ((e.code === 'Delete' || e.code === 'Backspace') && sel && tool === 'objs') { snap(); T.objs = T.objs.filter(o => o !== sel); sel = null; dirty = true; }
      e.stopPropagation(); }, true);
    addEventListener('keyup', e => { if (e.code === 'Space') space = false; });
  };
  ED.open = async function (track) {
    host.hidden = false; resize(); if (!host.ro && window.ResizeObserver) { host.ro = new ResizeObserver(() => resize()); host.ro.observe(cv.parentElement); }   /* si la barra de arriba cambia de alto, el lienzo se ajusta (si no, el clic no caía donde se pinchaba) */ requestAnimationFrame(draw); requestAnimationFrame(othumbLoop);
    if (track) { $('ed_home').hidden = true; await openTrack(track, true); setTool(tool); dirty = true; return; }
    if (!T) { $('ed_home').hidden = false; renderList(); } setTool(tool);
  };
  ED.close = function () { host.hidden = true; if (host.close) host.close(); };
  ED.isOpen = () => host && !host.hidden; ED._view = () => view; ED.cur = () => T; ED.objThumb = (l, n) => host.objThumb(l, n);
  ED.get = id => dget('trk_' + id);
  // ---------- circuitos de la comunidad: empaquetar (comprimido), publicar, descargar, activar ----------
  const z = async (u8, mode) => { const S = mode === 'c' ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw'); const w = S.writable.getWriter(); w.write(u8); w.close(); return new Uint8Array(await new Response(S.readable).arrayBuffer()); };
  ED.pack = async t => JSON.stringify({ v: 1, brr: 'track', id: t.gid || t.id, name: t.name, author: t.author || '', pid: t.pid || '', base: t.base, w: t.w, road: t.road.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]), objs: (t.objs || []).map(o => ({ n: o.n, ...(o.s ? { s: o.s } : {}), x: +o.x.toFixed(2), z: +o.z.toFixed(2), r: o.r | 0 })), laps: t.laps, nitros: t.nitros, roadTile: t.roadTile, surf: t.surf, ...(t.kind && t.kind !== 'normal' ? { kind: t.kind } : {}), ...(t.placeName ? { lon: t.lon, lat: t.lat, placeName: t.placeName } : {}), ...(t.desc ? { desc: t.desc } : {}), ...(t.cover ? { cover: t.cover } : {}), rev: t.rev || 0, hz: b64(await z(t.h, 'c')), tz: b64(await z(t.t, 'c')) });
  ED.unpack = async (s, extra = {}) => { const j = typeof s === 'string' ? JSON.parse(s) : s; if (!j || j.brr !== 'track' || !j.hz || !j.tz || !Array.isArray(j.road)) throw new Error('No es un circuito de Big Red Report');
    const t = { v: 1, id: String(j.id || '').replace(/[^a-z0-9\-_]/gi, '').slice(0, 40), name: String(j.name || 'Circuito').slice(0, 40), author: String(j.author || '').slice(0, 24), pid: String(j.pid || '').slice(0, 12), base: THEMES.includes(j.base) ? j.base : 'CITY1',
      h: await z(unb64(j.hz), 'd'), t: await z(unb64(j.tz), 'd'), road: j.road.filter(p => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])).slice(0, 200).map(p => [Math.max(2, Math.min(253, +p[0])), Math.max(2, Math.min(253, +p[1]))]), w: Math.max(8, Math.min(30, +j.w || 14)),
      objs: (j.objs || []).slice(0, 2000).map(o => ({ n: String(o.n || '').replace(/[^A-Z0-9_]/gi, '').slice(0, 12).toUpperCase(), ...(/^[A-Z]{3,8}\d$/.test(o.s || '') ? { s: o.s } : {}), x: +o.x || 0, z: +o.z || 0, r: +o.r || 0 })), surf: ['asfalto', 'tierra', 'arena', 'nieve'].includes(j.surf) ? j.surf : undefined, cover: typeof j.cover === 'string' && j.cover.length < 200000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(j.cover) ? j.cover : undefined, laps: Math.max(1, Math.min(20, j.laps | 0 || 3)), nitros: Math.max(0, Math.min(12, j.nitros | 0)), roadTile: j.roadTile | 0, rev: j.rev | 0, kind: ['gp', 'drift'].includes(j.kind) ? j.kind : 'normal', ...(typeof j.placeName === 'string' && isFinite(j.lon) && isFinite(j.lat) ? { lon: +j.lon, lat: +j.lat, placeName: j.placeName.slice(0, 30) } : {}), ...(typeof j.desc === 'string' ? { desc: j.desc.slice(0, 80) } : {}), ...extra };
    if (!t.id || t.h.length !== 65536 || t.t.length !== 65536) throw new Error('Circuito incompleto'); return t; };
  ED.levelOf = t => t.base + '~' + t.id;
  const BI = new Map();   // circuitos que vienen con el juego (Redrock)
  // si el autor ha publicado una versión más nueva, se usa esa (y se queda guardada para la próxima vez)
  ED.builtinRefresh = async id => { try { const j0 = (BRR.BUILTIN_TRACKS || []).find(x => x.id === id); if (!j0 || !BRR.cloud || !BRR.cloud.trackGet) return; const loc = await dget('bi_' + id), cur = Math.max(j0.rev | 0, (loc && loc.rev) | 0);
      const j = await Promise.race([BRR.cloud.trackGet(id), new Promise(r => setTimeout(() => r(null), 4000))]); if (j && (j.rev | 0) > cur) { await dset('bi_' + id, j); BI.delete(id); } } catch (e) { } };
  ED.builtin = async id => { if (BI.has(id)) return BI.get(id); { const loc = await dget('bi_' + id), j0 = (BRR.BUILTIN_TRACKS || []).find(x => x.id === id); if (loc && j0 && (loc.rev | 0) > (j0.rev | 0)) { const t = await ED.unpack(loc, { builtin: true }); BI.set(id, t); return t; } } const j = (BRR.BUILTIN_TRACKS || []).find(x => x.id === id); if (!j) return null; const t = await ED.unpack(j, { builtin: true }); BI.set(id, t); return t; };
  ED.byLevel = async level => { const id = String(level || '').split('~')[1]; if (!id) return null; if (T && T.id === id) return T; return (await dget('trk_' + id)) || ED.builtin(id); };
  ED.downloads = async () => (await dget('dl')) || [];
  ED.saveDownload = async (t, on = true) => { t.src = 'com'; t.on = on; await dset('trk_' + t.id, t); const L = (await ED.downloads()).filter(x => x.id !== t.id); L.unshift({ id: t.id, name: t.name, base: t.base, author: t.author, on, rev: t.rev, len: t.lenM || Math.round(spline(t.road).total || 0), date: Date.now() }); await dset('dl', L); };
  ED.setDownloadOn = async (id, on) => { const L = await ED.downloads(), r = L.find(x => x.id === id); if (r) { r.on = on; await dset('dl', L); } };
  ED.delDownload = async id => { await dset('dl', (await ED.downloads()).filter(x => x.id !== id)); const t = await dget('trk_' + id); if (t && t.src === 'com') await dset('trk_' + id, null); };
  ED.setMineOn = async (id, on) => { const L = await listTracks(), r = L.find(x => x.id === id); if (r) { r.off = !on; await dset('list', L); } };
  // los circuitos que salen en las listas de carrera: los tuyos (salvo los que quites) y los descargados activados
  ED.active = async () => { const out = []; for (const r of await listTracks()) if (!r.off) out.push({ ...r, mine: true }); for (const r of await ED.downloads()) if (r.on) out.push({ ...r, mine: false }); return out; };
  // dibujo pequeño del circuito (para las tarjetas)
  ED.preview = (road, base, W = 240, H = 150) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), S = spline(road || []);
    const col = { CITY: ['#4d5a3c', '#8a8f99'], DIRT: ['#3f5e2c', '#8b6a44'], SNOW: ['#c9d3e6', '#7f8fb5'], RUF: ['#b89a64', '#7a5530'], RIG: ['#4c3a22', '#a07040'], MOON: ['#6e2b25', '#c26b55'] }[BRR.envOf(base)] || ['#444', '#999'];
    g.fillStyle = col[0]; g.fillRect(0, 0, W, H); if (S.length < 3) return c.toDataURL();
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of S) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    const k = Math.min((W - 30) / (x1 - x0 || 1), (H - 30) / (z1 - z0 || 1)), X = x => W / 2 + (x - (x0 + x1) / 2) * k, Y = z => H / 2 - (z - (z0 + z1) / 2) * k;
    g.lineJoin = 'round'; g.beginPath(); S.forEach((p, i) => i ? g.lineTo(X(p.x), Y(p.z)) : g.moveTo(X(p.x), Y(p.z))); g.closePath(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 9; g.stroke(); g.strokeStyle = col[1]; g.lineWidth = 6; g.stroke();
    g.fillStyle = '#e2231a'; g.beginPath(); g.arc(X(S[0].x), Y(S[0].z), 4.5, 0, 7); g.fill(); return c.toDataURL(); };
  ED.publish = async (t, author) => { if (!BRR.cloud || !BRR.cloud.trackPut) throw new Error('Sin conexión'); if ((t.road || []).length < 3) throw new Error('La carretera necesita al menos 3 puntos');
    t.author = author || t.author || 'Piloto'; t.pid = BRR.cloud.id; const S = spline(t.road); t.lenM = Math.round(S.total);
    const small = t.cover ? await new Promise(ok => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = 192; c.height = 108; c.getContext('2d').drawImage(im, 0, 0, 192, 108); ok(c.toDataURL('image/jpeg', 0.6)); }; im.onerror = () => ok(null); im.src = t.cover; }) : null;
    const data = await ED.pack(t), meta = { id: t.id, ...(small ? { c: small } : {}), name: t.name, author: t.author, pid: t.pid, base: t.base, len: t.lenM, laps: t.laps, ...(t.kind && t.kind !== 'normal' ? { kind: t.kind } : {}), ...(t.desc ? { desc: t.desc } : {}), rev: t.rev || 0, t: Date.now(), size: data.length, path: S.filter((p, i) => i % Math.max(1, Math.floor(S.length / 40)) === 0).map(p => [+p.x.toFixed(1), +p.z.toFixed(1)]) };
    const n = await BRR.cloud.trackPut(t.id, meta, data); if (!n) throw new Error('No se ha podido publicar (¿sin Internet?)');
    t.pub = { t: meta.t, rev: meta.rev }; await saveTrack(t); return meta; };
  ED.unpublish = async t => { await BRR.cloud.trackDel(t.id); delete t.pub; await saveTrack(t); };
  ED.download = async (id, on = true) => { const s = await BRR.cloud.trackGet(id); if (!s) throw new Error('No se encuentra ese circuito en la nube'); const t = await ED.unpack(s); await ED.saveDownload(t, on); return t; };
  ED.isMine = id => listTracks().then(L => L.some(x => x.id === id));
})();
