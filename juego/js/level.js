// Construcción de un circuito: geometría para render + datos de colisión
"use strict";
(function () {
  const BRR = window.BRR;
  const S = BRR.S = 1 / 64;            // unidades originales -> metros (jeep ≈ 4,8 m)
  const CELL = 512, HSTEP = 16;
  BRR.toGL = (x, y, z) => [x * S, -y * S, -z * S];

  BRR.rot = function (rx, ry, rz) {     // Ry*Rx*Rz en coordenadas originales
    const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx), cz = Math.cos(rz), sz = Math.sin(rz);
    const Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], Rx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]], Rz = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]];
    const m = (A, B) => A.map((r, i) => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
    return m(m(Ry, Rx), Rz);
  };

  // Acumulador de triángulos por material
  BRR.MeshBuilder = class {
    constructor(pal) { this.pal = pal; this.groups = new Map(); this.textures = new Map(); }
    group(key) { let g = this.groups.get(key); if (!g) { g = { pos: [], uv: key === 'COLOR' ? null : [], col: key === 'COLOR' ? [] : null, lay: [] }; this.groups.set(key, g); } return g; }
    // añade un modelo; xf: [x,y,z] originales -> [x,y,z] GL; tri(a,b,c) opcional para colisión
    addModel(model, xf, findTM, tri, baseLayer = 0) {
      const V = model.verts.map(v => v ? xf(v) : null), pal = this.pal;
      const PI = this.planeIndex || (this.planeIndex = new Map());
      for (let f of model.faces) {
        if (!this.condOnly && f.els != null) continue;   // pilotos encendidos ("si no" de la variable 2): solo en la malla de freno
        const idx = f.idx; if (idx.length < 3 || idx.some(i => !V[i])) continue;
        let n = null;
        for (let k = 1; k < idx.length - 1 && !n; k++) {
          const a = V[idx[0]], b = V[idx[k]], c = V[idx[k + 1]];
          const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
          const x = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(...x);
          if (l > 1e-9) n = [x[0] / l, x[1] / l, x[2] / l];
        }
        // El original pinta por orden (sin z-buffer): una cara coplanaria que se solapa con otra anterior
        // (del mismo modelo o de otro objeto) va una capa por encima.
        let layer = baseLayer;
        if (n) {
          if (n[0] < -1e-6 || (Math.abs(n[0]) <= 1e-6 && (n[1] < -1e-6 || (Math.abs(n[1]) <= 1e-6 && n[2] < 0)))) n = [-n[0], -n[1], -n[2]];
          const d = n[0] * V[idx[0]][0] + n[1] * V[idx[0]][1] + n[2] * V[idx[0]][2];
          const bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
          for (const i of idx) for (let a = 0; a < 3; a++) { bb[a] = Math.min(bb[a], V[i][a] - 0.02); bb[a + 3] = Math.max(bb[a + 3], V[i][a] + 0.02); }
          const q = v => Math.round(v * 40);
          const key = q(n[0]) + ',' + q(n[1]) + ',' + q(n[2]) + ',' + Math.round(d * 25);
          let list = PI.get(key); if (!list) PI.set(key, list = []);
          for (const o of list) if (o[0] < bb[3] && o[3] > bb[0] && o[1] < bb[4] && o[4] > bb[1] && o[2] < bb[5] && o[5] > bb[2]) layer = Math.max(layer, o[6] + 1);
          bb.push(layer); list.push(bb);
        }
        layer = Math.min(layer, 24);
        let g, uv = null, rgb = null;
        if (f.alt && !this.condOnly && f.alt.uv.length === f.idx.length) f = { ...f, tex: f.alt.tex || f.tex, uv: f.alt.uv };   // textura del "si" (piloto apagado)
        if (f.tex) {
          if (!this.textures.has(f.tex)) { const tm = findTM(f.tex); this.textures.set(f.tex, tm ? BRR.tmRGBA(tm, pal) : null); }
          if (!this.textures.get(f.tex) || f.uv.length !== idx.length) continue;
          g = this.group('tex:' + f.tex); uv = f.uv;
        } else { g = this.group('COLOR'); rgb = [pal[f.color * 3] / 255, pal[f.color * 3 + 1] / 255, pal[f.color * 3 + 2] / 255]; }
        for (let k = 1; k < idx.length - 1; k++) {
          for (const order of f.two ? [[0, k + 1, k], [0, k, k + 1]] : [[0, k + 1, k]]) for (const j of order) {
            g.pos.push(...V[idx[j]]); g.lay.push(layer);
            if (uv) g.uv.push((uv[j][0] + .5) / 256, (uv[j][1] + .5) / 192); else g.col.push(...rgb);
          }
          if (tri) tri(V[idx[0]], V[idx[k + 1]], V[idx[k]]);
        }
      }
    }
  };

  // Rejilla espacial de triángulos para colisión
  BRR.Collider = class {
    constructor() { this.t = []; this.grid = new Map(); this.cs = 4; this.tags = []; }
    key(ix, iz) { return ix * 65536 + iz; }
    add(a, b, c, tag) {
      const id = this.t.length / 9; this.t.push(...a, ...b, ...c); this.tags.push(tag);
      const cs = this.cs;
      const x0 = Math.floor(Math.min(a[0], b[0], c[0]) / cs), x1 = Math.floor(Math.max(a[0], b[0], c[0]) / cs);
      const z0 = Math.floor(Math.min(a[2], b[2], c[2]) / cs), z1 = Math.floor(Math.max(a[2], b[2], c[2]) / cs);
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > 400) return;
      for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
        const k = this.key(ix, iz); let l = this.grid.get(k); if (!l) this.grid.set(k, l = []); l.push(id);
      }
    }
    finish() { this.T = new Float32Array(this.t); this.t = null; }
    // triángulos que se ponen y se quitan en plena carrera (la rampa del modo libre): cada clave tiene su hueco fijo
    setDyn(key, tris, tag) {
      this.dyn = this.dyn || {}; let d = this.dyn[key];
      if (d) this.unDyn(d);
      else { const base = this.T.length / 9, nt = new Float32Array(this.T.length + tris.length * 9); nt.set(this.T); this.T = nt; d = this.dyn[key] = { base, n: tris.length, cells: [] }; for (let i = 0; i < tris.length; i++) this.tags[base + i] = tag; }
      const cs = this.cs;
      tris.slice(0, d.n).forEach((t, i) => { const id = d.base + i; this.T.set([...t[0], ...t[1], ...t[2]], id * 9);
        const x0 = Math.floor(Math.min(t[0][0], t[1][0], t[2][0]) / cs), x1 = Math.floor(Math.max(t[0][0], t[1][0], t[2][0]) / cs), z0 = Math.floor(Math.min(t[0][2], t[1][2], t[2][2]) / cs), z1 = Math.floor(Math.max(t[0][2], t[1][2], t[2][2]) / cs);
        for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) { const k = this.key(ix, iz); let l = this.grid.get(k); if (!l) this.grid.set(k, l = []); l.push(id); d.cells.push(k, id); } });
    }
    unDyn(d) { for (let i = 0; i < d.cells.length; i += 2) { const l = this.grid.get(d.cells[i]); if (l) { const j = l.indexOf(d.cells[i + 1]); if (j >= 0) l.splice(j, 1); } } d.cells = []; }
    clearDyn() { for (const k in this.dyn || {}) this.unDyn(this.dyn[k]); }
    query(x0, z0, x1, z1, out) {
      const cs = this.cs, seen = out.seen || (out.seen = new Set()); seen.clear(); out.length = 0;
      for (let ix = Math.floor(x0 / cs); ix <= Math.floor(x1 / cs); ix++)
        for (let iz = Math.floor(z0 / cs); iz <= Math.floor(z1 / cs); iz++) {
          const l = this.grid.get(this.key(ix, iz)); if (!l) continue;
          for (const id of l) if (!seen.has(id)) { seen.add(id); out.push(id); }
        }
      return out;
    }
  };

  const SKY = { CITY: [.47, .62, .80], DIRT: [.60, .70, .82], MOON: [.30, .12, .12], WATER: [.50, .70, .90], SNOW: [.72, .78, .88],
    RUF: [.70, .62, .48], RIG: [.50, .66, .82], CHOPPER: [.55, .70, .85], TEST: [.47, .62, .80] };
  // objetos que el original trata como "aplastables": sin colisión sólida
  const SOFT = /PLANT|PALM|CONE|GRASS|BUSH|SHRUB|FLOWER|WEED|REED|CACT|SHEEP|COW|CHICK|FX$/;

  BRR.loadLevel = async function (files, level, progress = () => { }) {
    const env = level.replace(/\d+$/, '');
    const L = await files.archive(level + '.LEV');
    const E = files.has(env + '.ENV') ? await files.archive(env + '.ENV') : new Map();
    const extra = [];
    for (const n of ['INGAME.WAP', 'ALWAYS.WAP']) if (files.has(n)) extra.push(await files.archive(n));
    const script = BRR.text(L.get(level + '.TXT'));
    const mapn = (script.match(/^map\s+(\w+)/m) || [0, 'MAP'])[1].toUpperCase();
    // paleta del circuito: <map>.COL (la que carga el juego); CARSEL.RAW solo como reserva
    const colp = L.get(mapn + '.COL') || E.get('CARSEL.RAW') || (await files.archive('CITY.ENV')).get('CARSEL.RAW');
    const pal = BRR.pal6(colp.subarray(0, 768));
    // ártico: la nieve de la paleta es lila; se lleva hacia blanco azulado
    if (env === 'SNOW') for (let i = 0; i < 256; i++) { const r = pal[i * 3], g = pal[i * 3 + 1], b = pal[i * 3 + 2];
      if (b > r + 25 && b > g + 18 && b > 120) { const l = 0.3 * r + 0.59 * g + 0.11 * b, t = 0.7; pal[i * 3] = r + (l * 1.08 - r) * t; pal[i * 3 + 1] = g + (l * 1.12 - g) * t; pal[i * 3 + 2] = Math.min(255, b + (l * 1.22 - b) * t); } }
    const srcs = [L, E, ...extra];
    const find = n => { n = n.toUpperCase(); for (const s of srcs) if (s.has(n)) return s.get(n); return null; };
    const modelCache = new Map();
    const getModel = n => { if (!modelCache.has(n)) { const b = find(n + '.3DW'); modelCache.set(n, b ? BRR.parse3DW(b) : null); } return modelCache.get(n); };

    progress('terreno');
    const H = find(mapn + '.MPH'), C = find(mapn + '.MPC'), T = find(mapn + '.CHT');
    const mt = script.match(/^\s*texes\s+(\w+?)(\d)\s+(\d+)/m);
    const pages = []; for (let k = 0; k < +mt[3]; k++) pages.push(find(`${mt[1]}${+mt[2] + k}.TM`));
    const mb = new BRR.MeshBuilder(pal), mbT = new BRR.MeshBuilder(pal);   // objetos / terreno
    // atlas del terreno: cada baldosa de 32x32 con 8 px de borde replicado (evita mezclar baldosas al hacer mipmaps)
    // "palanim velocidad,primero,último": colores de la paleta que el original hace rotar (agua, luces)
    const pam = script.match(/^\s*palanim\s+(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/m), palA = pam ? [+pam[1], +pam[2], Math.min(+pam[3], +pam[2] + 15)] : null;
    const AW = 16 * 48, AH = 12 * 48, atlas = new Uint8Array(AW * AH * 4);
    for (let t = 0; t < pages.length * 48; t++) {
      const pg = pages[t / 48 | 0], lt = t % 48, sx = (lt % 8) * 32, sy = (lt / 8 | 0) * 32, cx = (t % 16) * 48, cy = (t / 16 | 0) * 48;
      for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
        const c = pg[(sy + Math.min(31, Math.max(0, y - 8))) * 256 + sx + Math.min(31, Math.max(0, x - 8))], o = ((cy + y) * AW + cx + x) * 4;
        atlas[o] = pal[c * 3]; atlas[o + 1] = pal[c * 3 + 1]; atlas[o + 2] = pal[c * 3 + 2]; atlas[o + 3] = palA && c >= palA[1] && c <= palA[2] ? 200 + c - palA[1] : 255;   // colores animados del original (alfa = índice)
      }
    }
    // texturas suavizadas: el suelo se escala ×2 con Scale2x (redondea los dientes de sierra de los bordes del césped y la arena)
    if (BRR.texHD && BRR.scale2xRGBA) { const up = BRR.scale2xRGBA(atlas, AW, AH); mbT.textures.set('TERRENO', { w: AW * 2, h: AH * 2, data: up, terrain: true }); }
    else mbT.textures.set('TERRENO', { w: AW, h: AH, data: atlas, terrain: true });
    // tipo de superficie por baldosa según su color medio (asfalto, tierra, arena, nieve, agua)
    const classify = (r, g, b) => {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
      if (b > r * 1.15 && b > g * 1.02 && b > 0.22) return 'agua';
      if (mx > 0.68 && sat < 0.2) return 'nieve';
      if (sat < 0.17) return 'asfalto';
      if (r >= g && g >= b && mx > 0.55) return 'arena';
      return 'tierra';
    };
    const tileSurf = [];
    for (let t = 0; t < pages.length * 48; t++) {
      const pg = pages[t / 48 | 0], lt = t % 48, sx = (lt % 8) * 32, sy = (lt / 8 | 0) * 32; let r = 0, g = 0, b = 0;
      const hist = new Uint16Array(256); let wet = 0;   // histograma de colores de la baldosa; píxeles con color de agua (verde azulado o azul): cuenta mayoría, no la media
      let nc = 0;   // los píxeles lila/rosa (color "transparente" de las marcas pintadas, p. ej. la línea de meta) no cuentan para el color del polvo
      for (let y = 0; y < 32; y += 2) for (let x = 0; x < 32; x += 2) { const c = pg[(sy + y) * 256 + sx + x]; hist[c]++; const pr = pal[c * 3], pg2 = pal[c * 3 + 1], pb = pal[c * 3 + 2];
        if (env !== 'MOON' && pr > pg2 * 1.35 + 10 && pb > pg2 * 1.35 + 10) continue; r += pr; g += pg2; b += pb; nc++;
        const mx = Math.max(pr, pg2, pb); if (pb > pr * 1.05 && pb > pg2 * 0.78 && mx > 45 && mx < 160 && (mx - Math.min(pr, pg2, pb)) / mx > 0.12) wet++; }
      if (nc < 64) { r = g = b = 128 * Math.max(1, nc); }   // casi todo lila: se trata como asfalto gris
      r /= Math.max(1, nc) * 255; g /= Math.max(1, nc) * 255; b /= Math.max(1, nc) * 255;
      const c0 = classify(r, g, b), col0 = [r, g, b];
      let type = wet > 140 ? 'agua' : c0 === 'agua' ? (Math.max(r, g, b) > 0.6 ? 'nieve' : 'tierra') : c0, col = col0;
      if (type === 'tierra' && g > r) col = [r * 0.6 + 0.25, g * 0.6 + 0.18, b * 0.6 + 0.1];   // hierba: polvo terroso
      if (type === 'agua' && (env === 'MOON' || env === 'SNOW')) type = env === 'SNOW' ? 'nieve' : 'tierra';   // en Marte/Venus/Luna no hay agua (los tonos azules/morados son roca)
      tileSurf.push({ type, col: col.map(x => Math.min(1, x * 1.15)), tile: t, wet, hist, grass: type === 'tierra' && g > r });
    }
    const hgt = new Float32Array(256 * 256); for (let i = 0; i < 65536; i++) hgt[i] = H[i] * HSTEP * S;
    const corner = (x, z) => [x * CELL * S, hgt[(z & 255) * 256 + (x & 255)], -z * CELL * S];
    // normal suave en cada esquina (diferencias centradas del mapa de alturas): el suelo se ve redondeado, sin "placas"
    const hAt = (x, z) => hgt[(Math.max(0, Math.min(255, z))) * 256 + Math.max(0, Math.min(255, x))];
    const vnorm = (x, z) => { const gx = (hAt(x + 1, z) - hAt(x - 1, z)) / (2 * CELL * S), gz = (hAt(x, z + 1) - hAt(x, z - 1)) / (2 * CELL * S), l = Math.hypot(gx, 1, gz); return [-gx / l, 1 / l, gz / l]; };
    // túneles: zona alrededor de los objetos *TUNN*; ahí las casillas "sin baldosa" (255) son la boca del túnel (agujero en el terreno)
    const tunnel = new Uint8Array(65536);
    { const shl0 = find(mapn + '.SHL'), dat0 = find(mapn + '.DAT'), nm = [];
      for (let i = 0; i + 13 <= shl0.length; i += 13) { let q = ''; for (let k = i; k < i + 13 && shl0[k]; k++) q += String.fromCharCode(shl0[k]); nm.push(q.toUpperCase()); }
      const dv0 = new DataView(dat0.buffer, dat0.byteOffset, dat0.byteLength);
      for (let i = 0; i + 22 <= dat0.length; i += 22) { if (!/TUNN/.test(nm[dat0[i]] || '')) continue;
        const cx = Math.floor(dv0.getInt32(i + 1, true) / CELL), cz = Math.floor(dv0.getInt32(i + 9, true) / CELL);
        for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) { const X = cx + dx, Z = cz + dz; if (X >= 0 && Z >= 0 && X < 256 && Z < 256) tunnel[Z * 256 + X] = 1; } } }
    const isHole = i => tunnel[i] && T[512 + C[i]] === 255;
    for (let z = 0; z < 255; z++) for (let x = 0; x < 255; x++) {
      const code = C[z * 256 + x], tile = T[512 + code];
      if (isHole(z * 256 + x)) continue;   // boca del túnel: sin terreno
      const P = [corner(x, z), corner(x + 1, z), corner(x + 1, z + 1), corner(x, z + 1)], Nn = [vnorm(x, z), vnorm(x + 1, z), vnorm(x + 1, z + 1), vnorm(x, z + 1)];
      const order = [0, 1, 2, 0, 2, 3];   // sentido antihorario visto desde arriba
      if (tile === 255 || (tile / 48 | 0) >= pages.length) {
        const g = mbT.group('COLOR'), c = T[code];
        g.nrm = g.nrm || []; for (const k of order) { g.pos.push(...P[k]); g.nrm.push(...Nn[k]); g.lay.push(0); g.col.push(pal[c * 3] / 255, pal[c * 3 + 1] / 255, pal[c * 3 + 2] / 255); }
      } else {
        const g = mbT.group('TERRENO'), u0 = (tile % 16) * 48 + 8, v0 = (tile / 16 | 0) * 48 + 8;
        const UV = [[u0, v0], [u0 + 32, v0], [u0 + 32, v0 + 32], [u0, v0 + 32]]; g.tiles = g.tiles || [];
        g.nrm = g.nrm || []; for (const k of order) { g.pos.push(...P[k]); g.nrm.push(...Nn[k]); g.lay.push(0); g.uv.push(UV[k][0] / AW, UV[k][1] / AH); g.tiles.push(tile); }
      }
    }

    progress('objetos');
    const col = new BRR.Collider();
    const shl = find(mapn + '.SHL'), names = [];
    for (let i = 0; i + 13 <= shl.length; i += 13) { let s = ''; for (let k = i; k < i + 13 && shl[k]; k++) s += String.fromCharCode(shl[k]); names.push(s.toUpperCase()); }
    const dat = find(mapn + '.DAT'), dv = new DataView(dat.buffer, dat.byteOffset, dat.byteLength);
    const findTM = n => find(n + '.TM');
    const cseRaw = []; { const cs = find(mapn + '.CSE'); if (cs) { const v = new DataView(cs.buffer, cs.byteOffset, cs.byteLength); for (let j = 0; j + 16 <= cs.length; j += 16) cseRaw.push([v.getInt32(j, true), v.getInt32(j + 4, true)]); } }
    const farFromCourse = (x, z) => { for (let j = 0; j < cseRaw.length; j++) { const a = cseRaw[j], b = cseRaw[(j + 1) % cseRaw.length], vx = b[0] - a[0], vz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz || 1))); if (Math.hypot(a[0] + vx * t - x, a[1] + vz * t - z) < 40 / S) return false; } return cseRaw.length > 0; };
    const groundAt = (x, z) => { const fx = x / CELL, fz = z / CELL, ix = Math.max(0, Math.min(254, Math.floor(fx))), iz = Math.max(0, Math.min(254, Math.floor(fz))), u = fx - ix, v = fz - iz, h = (a, b) => hgt[b * 256 + a]; return (h(ix, iz) * (1 - u) + h(ix + 1, iz) * u) * (1 - v) + (h(ix, iz + 1) * (1 - u) + h(ix + 1, iz + 1) * u) * v; };
    let nobj = 0, tGrey = -1, decalN = 0; const checkpoints = [], props = [], posts = [];
    for (let i = 0; i + 22 <= dat.length; i += 22) if (/POST/.test(names[dat[i]] || '')) posts.push([dv.getInt32(i + 1, true), dv.getInt32(i + 5, true), dv.getInt32(i + 9, true)]);
    const tunnelGrey = () => { if (tGrey < 0) { let best = 1e9; for (let c = 1; c < 256; c++) { const d = (pal[c * 3] - 92) ** 2 + (pal[c * 3 + 1] - 90) ** 2 + (pal[c * 3 + 2] - 86) ** 2; if (d < best) { best = d; tGrey = c; } } } return tGrey; };
    for (let i = 0; i + 22 <= dat.length; i += 22) {
      const name = names[dat[i]]; if (!name) continue;
      if (name === 'CHECKP') {   // puerta de control: byte19 = número (+0x80 último), byte21 = índice del recorrido hacia el siguiente
        const ox = dv.getInt32(i + 1, true), oy = dv.getInt32(i + 5, true), oz = dv.getInt32(i + 9, true), a = dv.getUint16(i + 15, true) * 2 * Math.PI / 65536;
        checkpoints.push({ num: dat[i + 19] & 0x7f, last: !!(dat[i + 19] & 0x80), c: BRR.toGL(ox, oy, oz), ax: [Math.cos(a), 0, Math.sin(a)], az: [Math.sin(a), 0, -Math.cos(a)], hw: 2048 * S });
      }
      // byte 20 = clase del objeto: 0 sólido · 4 planta aplastable · 5 cono/señal derribable · 8 marcas de salida (se atraviesan)
      //          10 bandera · 40 baliza · 50 punto de control invisible · resto: sólido
      const cls = dat[i + 20];
      if (cls === 50) continue;
      const m = getModel(name); if (!m) continue;
      const ox = dv.getInt32(i + 1, true), oz = dv.getInt32(i + 9, true); let oy = dv.getInt32(i + 5, true);
      // decorado lejano que flota sobre el terreno (icebergs del ártico...): se apoya en el suelo
      if (env === 'SNOW' && /^(STACK|ICEBRIJ)/.test(name) && farFromCourse(ox, oz)) { const lift = -oy * S - groundAt(ox, oz); if (lift > 3) oy += lift / S; }   // icebergs del ártico
      const k = 2 * Math.PI / 65536, R = BRR.rot(dv.getInt16(i + 13, true) * k, dv.getUint16(i + 15, true) * k, dv.getInt16(i + 17, true) * k);
      if (cls === 4 || cls === 5 || cls === 10 || SOFT.test(name)) {   // derribable: instancia aparte
        props.push({ name, cls, o: BRR.toGL(ox, oy, oz), R: [[R[0][0], -R[0][1], -R[0][2]], [-R[1][0], R[1][1], R[1][2]], [-R[2][0], R[2][1], R[2][2]]], r: Math.max(0.4, m.radius * S * 0.5) });
        continue;
      }
      const xf = v => BRR.toGL(ox + R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2], oy + R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2], oz + R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]);
      // clases 3, 7 y 8: marcas pintadas en el suelo (líneas blancas, parrilla, salida): no chocan y se pegan al terreno
      const decal = cls === 3 || cls === 7 || cls === 8, solid = !(decal || cls === 40);
      let xfm = xf;
      // pancarta de salida/control: se estira o encoge para llegar justo a sus dos postes
      if (name === 'START' && !window.BRR_NOFIT) { const hm = Math.max(...m.verts.filter(Boolean).map(v => Math.abs(v[0]))); let xl = null, xr = null;
        for (const q of posts) { const dx = q[0] - ox, dy = q[1] - oy, dz = q[2] - oz, lx = R[0][0] * dx + R[1][0] * dy + R[2][0] * dz, lz = R[0][2] * dx + R[1][2] * dy + R[2][2] * dz;
          if (Math.abs(lz) > 300 || Math.abs(lx) < 300 || Math.abs(lx) > 2600) continue;
          if (lx < 0 && (xl === null || lx > xl)) xl = lx; if (lx > 0 && (xr === null || lx < xr)) xr = lx; }
        if (xl !== null && xr !== null && hm > 0) { const cx = (xl + xr) / 2, sx = ((xr - xl) / 2 - 4) / hm; xfm = v => xf([cx + v[0] * sx, v[1], v[2]]); } }
      if (decal) { const ys = m.verts.filter(Boolean).map(v => v[1]), flat = ys.length && Math.max(...ys) - Math.min(...ys) < 24;
        const lift = 0.08 + 0.025 * (decalN++ % 8);   // cada marca un poco más alta que la anterior: el orden de pintado del original (la parrilla negra sobre la blanca)
        if (flat && Math.abs(-oy * S - groundAt(ox, oz)) < 2.5) xfm = v => { const g = xf(v), wx = ox + R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2], wz = oz + R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2];
          g[1] = groundAt(wx, wz) + lift; return g; }; }
      // postes finos y altos (los de las pancartas de salida y control) que en el original quedan colgando: se alargan hasta el suelo
      if (!decal) { const Vs = m.verts.filter(Boolean), ex = a => Math.max(...Vs.map(v => Math.abs(v[a])));
        const ymax = Math.max(...Vs.map(v => v[1])), ymin = Math.min(...Vs.map(v => v[1]));
        if (Vs.length && ex(0) <= 20 && ex(2) <= 20 && ymax - ymin >= 100) {
          const gap = -(oy + ymax) * S - groundAt(ox, oz);   // >0: el pie queda por encima del suelo (metros)
          if (gap > 0.05 && gap < 12) { const base = xfm; xfm = v => { const g = base(v); if (v[1] >= ymax - 1) { const wx = ox + R[0][0] * v[0] + R[0][2] * v[2], wz = oz + R[2][0] * v[0] + R[2][2] * v[2]; g[1] = groundAt(wx, wz) - 0.1; } return g; }; } } }
      let mm = m;
      if (/TUNN/.test(name)) {   // túneles: el original los pintaba negros y tapados por la colina (sin z-buffer); aquí gris oscuro,
        // visibles desde dentro (doble cara) y sin asomar por encima de la colina
        mm = { ...m, faces: m.faces.map(f => f.tex ? f : { ...f, two: true, color: tunnelGrey() }) };
        xfm = v => { const g = xf(v), wx = ox + R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2], wz = oz + R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2];
          g[1] = Math.min(g[1], groundAt(wx, wz) - 0.05); return g; };
      }
      mb.addModel(mm, xfm, findTM, solid ? (a, b, c) => col.add(a, b, c, name) : null, 1);
      nobj++;
    }
    col.finish();
    // cámaras de televisión del original (líneas fixcam x, altura sobre el suelo, z)
    const hx = t => { const m = t.trim().match(/^(-?)&?([0-9A-Fa-f]+)$/); if (!m) return NaN; return (m[1] ? -1 : 1) * parseInt(m[2], t.includes('&') ? 16 : 10); };
    const fixcams = [...script.matchAll(/^\s*fixcam\s+([^,;\n]+),([^,;\n]+),([^,;\s]+)/gm)].map(m => { const x = hx(m[1]), y = hx(m[2]), z = hx(m[3]);
      return isFinite(x + y + z) ? [x * S, groundAt(x, z) - y * S, -z * S] : null; }).filter(Boolean);
    const g = script.match(/^\s*grid\s+&([0-9A-Fa-f]+),\s*&([0-9A-Fa-f]+),\s*&([0-9A-Fa-f]+)/m);   // solo líneas activas (RIG1 tiene otra comentada)
    const gx = parseInt(g[1], 16), gz = parseInt(g[2], 16), ga = parseInt(g[3], 16) * 2 * Math.PI / 65536;

    // recorrido (MAP.CSE): registros de 16 bytes, i32 x, i32 z, 4×i16
    // registro: i32 x, i32 z, i16 ángulo (1024 = 360°), i16 velocidad orientativa, i16 a, i16 b
    // (a y b = límites laterales de la pista desde el punto, hacia la izquierda de la marcha)
    const cse = find(mapn + '.CSE'), raw = [], course = [], courseW = [], courseV = [];
    if (cse) { const cv = new DataView(cse.buffer, cse.byteOffset, cse.byteLength);
      for (let i = 0; i + 16 <= cse.length; i += 16) raw.push([cv.getInt32(i, true), cv.getInt32(i + 4, true), cv.getInt16(i + 10, true), cv.getInt16(i + 12, true), cv.getInt16(i + 14, true)]); }
    raw.forEach((r, k) => {
      const nx = raw[(k + 1) % raw.length], hx = nx[0] - r[0], hz = nx[1] - r[1], l = Math.hypot(hx, hz) || 1, Lx = -hz / l, Lz = hx / l, off = (r[3] + r[4]) / 2;
      course.push([(r[0] + Lx * off) * S, 0, -(r[1] + Lz * off) * S]); courseW.push(Math.max(400, Math.abs(r[3] - r[4])) * S); courseV.push(r[2]);
    });
    // parrilla de salida: x, z, ángulo, 2 vectores, y luego tríos (lateral, atrás, ?) por plaza
    const gridSlots = [];
    { const L = script.split(/\r?\n/), gi = L.findIndex(l => /^grid\b/.test(l)); let txt = '';
      if (gi >= 0) { txt = L[gi].slice(4).replace(/;.*/, ''); for (let j = gi + 1; j < L.length && /^(\s|;|$)/.test(L[j]); j++) txt += ' ' + L[j].replace(/;.*/, ''); }
      if (txt) { const nums = txt.split(/[\s,]+/).filter(t => /^-?&?[0-9A-Fa-f]+$/.test(t)).map(t => { const neg = t[0] === '-'; t = t.replace('-', ''); const v = t[0] === '&' ? parseInt(t.slice(1), 16) : parseInt(t, 10); return neg ? -v : v; });
        for (let i = 9; i + 2 < nums.length; i += 3) gridSlots.push([nums[i], nums[i + 1], nums[i + 2]]); } }
    const lapsM = script.match(/^\s*laps\s+(\d+)/m), nitM = script.match(/^\s*nitros\s+(\d+)/m);
    // dirección del sol: script "light giro, elevación" (65536 = 360°, elevación negativa = hacia arriba)
    function sunDir() {
      const m = script.match(/^light\s+(-?&?[0-9A-Fa-f]+)\s*,\s*(-?&?[0-9A-Fa-f]+)/m);
      const num = t => { const neg = t[0] === '-'; t = t.replace('-', ''); const v = t[0] === '&' ? parseInt(t.slice(1), 16) : parseInt(t, 10); return neg ? -v : v; };
      let a = 0x3000, e = 0x1800; if (m) { a = num(m[1]); e = Math.abs(num(m[2])); }
      const A = a / 65536 * 2 * Math.PI, Ev = Math.max(0.42, Math.min(1.2, e / 65536 * 2 * Math.PI));
      return [Math.sin(A) * Math.cos(Ev), Math.sin(Ev), -Math.cos(A) * Math.cos(Ev)];
    }
    const lvl = {
      name: level, palAnim: palA, fixcams, env, pal, mesh: mb, terrainMesh: mbT, collider: col, sun: sunDir(), hgt, sky: SKY[env] || SKY.CITY, nobj,
      checkpoints, props, course, courseW, courseV, gridSlots, laps: lapsM ? +lapsM[1] : 3, nitros: nitM ? +nitM[1] : 3, startPos: [gx * S, 0, -gz * S],
      start: { x: gx * S, z: -gz * S, yaw: -ga, a16: parseInt(g[3], 16) }, find, getModel, srcs, script,
      size: 256 * CELL * S,
    };
    // altura del terreno (coincide con la triangulación del render) y normal
    const CS = CELL * S;
    const LILAC = { type: 'asfalto', col: [.5, .5, .5] };
    lvl.surface = function (x, z) {
      const ix = Math.floor(x / CS), iz = Math.floor(-z / CS); if (ix < 0 || iz < 0 || ix > 255 || iz > 255) return { type: 'asfalto', col: [.5, .5, .5] };
      const code = C[iz * 256 + ix], tile = T[512 + code];
      if (tile < tileSurf.length) return tileSurf[tile];
      const c = T[code]; const rgb = [pal[c * 3] / 255, pal[c * 3 + 1] / 255, pal[c * 3 + 2] / 255];
      // casillas de color lila bajo las marcas pintadas (línea de meta, parrilla): suelo neutro, sin polvo rosa
      if (env !== 'MOON' && rgb[0] > rgb[1] * 1.35 + 0.04 && rgb[2] > rgb[1] * 1.35 + 0.04) return LILAC;
      return { type: classify(...rgb), col: rgb };
    };
    // circuitos de agua: el río son las baldosas que hay bajo los controles (y las que comparten sus colores)
    if (env === 'WATER' && checkpoints.length) {
      const under = new Map(), freq = new Map(), tileAt = (x, z) => { const ix = Math.floor(x / CS), iz = Math.floor(-z / CS); return ix < 0 || iz < 0 || ix > 255 || iz > 255 ? -1 : T[512 + C[iz * 256 + ix]]; };
      checkpoints.forEach((g, gi) => { for (let a = -10; a <= 10; a += 2) { const t = tileAt(g.c[0] + g.ax[0] * a, g.c[2] + g.ax[2] * a); if (t >= 0 && t < tileSurf.length) { if (!under.has(t)) under.set(t, new Set()); under.get(t).add(gi); } } });
      for (let i = 0; i < 65536; i++) { const t = T[512 + C[i]]; freq.set(t, (freq.get(t) || 0) + 1); }
      const water = new Set([...under].filter(([t, gs]) => gs.size >= 2 && (freq.get(t) || 0) < 65536 * 0.35).map(([t]) => t));
      const wp = new Float32Array(256), bp = new Float32Array(256); let wn = 0, bn = 0;
      for (const t of water) { for (let c = 0; c < 256; c++) wp[c] += tileSurf[t].hist[c]; wn++; }
      for (const [t] of [...freq].filter(([t]) => !water.has(t) && t < tileSurf.length).sort((a, b) => b[1] - a[1]).slice(0, 3)) { for (let c = 0; c < 256; c++) bp[c] += tileSurf[t].hist[c]; bn++; }
      if (wn && bn) tileSurf.forEach((q, t) => { if (water.has(t)) return; let f = 0; for (let c = 0; c < 256; c++) if (q.hist[c] && wp[c] / wn > bp[c] / bn) f += q.hist[c]; if (f / 256 > 0.45) water.add(t); });
      for (const t of water) tileSurf[t] = { ...tileSurf[t], type: 'agua', grass: false };
    }
    // agua: los vértices del terreno de baldosas de agua llevan capa -1 (el sombreado moderno les pone olas y reflejos)
    { const g = mbT.groups.get('TERRENO'); if (g && g.tiles) for (let i = 0; i < g.tiles.length; i++) { const t = tileSurf[g.tiles[i]]; if (t && t.type === 'agua') g.lay[i] = -1; } }
    lvl.hole = (x, z) => { const ix = Math.floor(x / CS), iz = Math.floor(-z / CS); return ix >= 0 && iz >= 0 && ix < 256 && iz < 256 && isHole(iz * 256 + ix); };
    lvl.tunnel = (x, z) => { const ix = Math.floor(x / CS), iz = Math.floor(-z / CS); return ix >= 0 && iz >= 0 && ix < 256 && iz < 256 && tunnel[iz * 256 + ix] === 1; };
    lvl.terrain = function (x, z, nrm) {
      const fx = x / CS, fz = -z / CS, ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz;
      const h = (a, b) => hgt[(b & 255) * 256 + (a & 255)];
      const h0 = h(ix, iz), h1 = h(ix + 1, iz), h2 = h(ix + 1, iz + 1), h3 = h(ix, iz + 1);
      let y, du, dv;
      if (u >= v) { du = h1 - h0; dv = h2 - h1; y = h0 + u * du + v * dv; }
      else { dv = h3 - h0; du = h2 - h3; y = h0 + v * dv + u * du; }
      if (nrm) { const gx = du / CS, gz = -dv / CS, l = Math.hypot(gx, 1, gz); nrm[0] = -gx / l; nrm[1] = 1 / l; nrm[2] = -gz / l; }
      return y;
    };
    return lvl;
  };
})();
