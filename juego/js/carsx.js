// Coches propios (no vienen en el juego original): se montan sobre las físicas, ruedas y sonido de un coche del juego
// y llevan una carrocería hecha aquí, de pocos polígonos, al estilo del original.
//  · PANDA ("Panda 86"): coupé japonés de los 80 de propulsión trasera, faros escamoteables levantados, parte de abajo negra
//    y la de arriba del color elegido (blanca por defecto). De momento solo en el modo drift.
//  · GT: coche de carreras de gran turismo para el Grand Prix: bajo y ancho, morro largo, trasera fastback, alerón grande y franjas blancas.
"use strict";
(function () {
  const BRR = window.BRR;
  BRR.CUSTOM_CARS = { PANDA: { base: 'MINI', name: 'Panda 86' }, GT: { base: 'MINI', name: 'GT' }, GTS: { base: 'MINI', name: 'GT Sprint' }, BAV30: { base: 'MINI', name: 'Bávaro 30' }, ZETA35: { base: 'MINI', name: 'Zeta 35' } };
  const orig = BRR.loadVehicle;
  BRR.loadVehicle = async function (files, name, lvl, team = 1, extra = {}) {
    const C = BRR.CUSTOM_CARS[String(name).toUpperCase()]; if (!C) return orig(files, name, lvl, team, extra);
    const d = await orig(files, C.base, lvl, team, { ...extra, paint: null, logo: null, logoHi: null });
    const paint = (extra.paint || [238, 238, 234]).map(v => v / 255);
    const gl = extra.glass ? extra.glass.map(v => v / 255 * 0.8) : null;   // cristales del garaje
    const NM = String(name).toUpperCase();
    if (NM === 'GT') return gt(d, (extra.paint || [200, 30, 26]).map(v => v / 255), 'GT', gl);
    if (NM === 'GTS') return gt(d, (extra.paint || [30, 90, 200]).map(v => v / 255), 'GTS', gl, 'sprint');   // la variante del GT: mismo coche, otra carrocería
    if (NM === 'BAV30' || NM === 'ZETA35') return coupe(d, (extra.paint || (NM === 'BAV30' ? [235, 235, 230] : [235, 150, 30])).map(v => v / 255), NM, gl);
    return panda(d, paint, NM, gl);
  };
  // ---------- carrocería ----------
  function panda(d, P, name, gl) {
    const G = -0.72;   // suelo (bajo las ruedas del coche base)
    const BLACK = [0.07, 0.07, 0.08], GLASS = gl || [0.1, 0.13, 0.17], TRIM = [0.18, 0.18, 0.2], RED = [0.75, 0.06, 0.05], AMBER = [0.95, 0.55, 0.1], LENS = [0.95, 0.95, 0.85];
    const mb = new BRR.MeshBuilder(d.mesh.pal), g = mb.group('COLOR'), brake = new BRR.MeshBuilder(d.mesh.pal), gb = brake.group('COLOR');
    const tri = (q, a, b, c, col) => { for (const v of [a, b, c]) { q.pos.push(v[0], v[1] + G, v[2]); q.col.push(...col); q.lay.push(0); } };
    const quad = (a, b, c, e, col, q = g) => { tri(q, a, b, c, col); tri(q, a, c, e, col); tri(q, a, c, b, col); tri(q, a, e, c, col); };   // por las dos caras: sin agujeros vistos desde cualquier lado
    // secciones de delante (z negativa) a atrás: z, medio ancho, altura de los bajos, línea de cintura, hombro (capó/maletero), ancho y altura del techo; tipo de tramo hasta la siguiente
    const K = [
      { z: -2.08, w: 0.76, lo: 0.2, belt: 0.44, sh: 0.56, wt: 0.72, top: 0.56, k: 'bumper' },
      { z: -2.0, w: 0.81, lo: 0.2, belt: 0.46, sh: 0.66, wt: 0.74, top: 0.66, k: 'hood' },
      { z: -1.0, w: 0.82, lo: 0.2, belt: 0.48, sh: 0.77, wt: 0.74, top: 0.77, k: 'hood' },
      { z: -0.72, w: 0.82, lo: 0.2, belt: 0.48, sh: 0.79, wt: 0.72, top: 0.8, k: 'wind' },
      { z: -0.1, w: 0.81, lo: 0.2, belt: 0.48, sh: 0.81, wt: 0.63, top: 1.22, k: 'roof' },
      { z: 0.72, w: 0.81, lo: 0.2, belt: 0.48, sh: 0.83, wt: 0.63, top: 1.21, k: 'hatch' },
      { z: 1.82, w: 0.8, lo: 0.2, belt: 0.5, sh: 0.84, wt: 0.7, top: 0.9, k: 'tail' },
      { z: 2.02, w: 0.79, lo: 0.2, belt: 0.5, sh: 0.8, wt: 0.72, top: 0.8, k: 'bumper' },
      { z: 2.1, w: 0.75, lo: 0.24, belt: 0.48, sh: 0.6, wt: 0.7, top: 0.6, k: 'end' }];
    // pasos de rueda: secciones de más alrededor de cada rueda donde el borde de abajo sube en arco (se ve la rueda por el lado)
    const lerpAt = z => { let i = 0; while (i < K.length - 2 && K[i + 1].z < z) i++; const a = K[i], b = K[i + 1], t = (z - a.z) / (b.z - a.z), L = x => a[x] + (b[x] - a[x]) * t; return { z, w: L('w'), lo: L('lo'), belt: L('belt'), sh: L('sh'), wt: L('wt'), top: L('top'), k: a.k }; };
    const archZ = [-1.25, 1.2], AR = 0.4, extra = [];
    for (const zc of archZ) for (let q = 0; q <= 8; q++) { const t = q / 8, ang = Math.PI * (1 - t), z = zc - Math.cos(ang) * AR * -1; const st = lerpAt(zc + Math.cos(Math.PI * t) * -AR); st.lo = Math.max(st.lo, 0.3 + Math.sin(Math.PI * t) * 0.34); extra.push(st); }
    const S = K.concat(extra).sort((a, b) => a.z - b.z);
    const ring = s => { const R = [[s.w, s.lo], [s.w, s.belt], [s.w * 0.985, s.sh], [s.wt, s.top]]; return [...R.map(([x, y]) => [x, y, s.z]), ...R.slice().reverse().map(([x, y]) => [-x, y, s.z])]; };
    // color de cada lado de la sección según el tramo: 0 bajos (negro), 1 puerta (color), 2 hombro (color), 3 ventanilla, 4 techo/capó/lunas
    const colOf = (k, seg) => { if (seg === 0) return BLACK; if (k === 'bumper') return seg === 4 ? P : BLACK;
      if (seg === 3) return k === 'roof' || k === 'hatch' ? GLASS : P; if (seg === 4) return k === 'wind' || k === 'hatch' ? GLASS : P; return P; };
    for (let i = 0; i < S.length - 1; i++) { const a = ring(S[i]), b = ring(S[i + 1]), k = S[i].k, n = a.length;
      const SEG = [0, 1, 3, 4, 3, 1, 0];   // bajos · puerta · ventanilla/canto · techo/capó/luna · ventanilla/canto · puerta · bajos
      for (let j = 0; j < n - 1; j++) quad(a[j], a[j + 1], b[j + 1], b[j], colOf(k, SEG[j]));
      quad(a[n - 1], a[0], b[0], b[n - 1], BLACK); }   // los bajos
    quad([-0.62, 0.3, -1.95], [0.62, 0.3, -1.95], [0.62, 0.3, 2.0], [-0.62, 0.3, 2.0], BLACK);   // suelo (entre las ruedas)
    for (const zc of archZ) for (const sx of [-1, 1]) { const x = sx * 0.5; quad([x, 0.3, zc - AR], [x, 0.3, zc + AR], [x, 0.66, zc + AR], [x, 0.66, zc - AR], BLACK); quad([x, 0.66, zc - AR], [x, 0.66, zc + AR], [sx * 0.8, 0.66, zc + AR], [sx * 0.8, 0.66, zc - AR], BLACK); }   // huecos de las ruedas
    // tapas de delante y de atrás
    for (const [i, col] of [[0, BLACK], [S.length - 1, BLACK]]) { const r = ring(S[i]), c0 = [0, (S[i].lo + S[i].sh) / 2, S[i].z]; for (let j = 0; j < r.length; j++) { const a = r[j], b = r[(j + 1) % r.length]; tri(g, c0, a, b, col); tri(g, c0, b, a, col); } }
    // morro: rejilla negra fina, intermitentes ámbar en el paragolpes
    const zf = -2.085; for (const sx of [-1, 1]) quad([sx * 0.5, 0.36, zf - 0.01], [sx * 0.7, 0.36, zf - 0.01], [sx * 0.7, 0.44, zf - 0.01], [sx * 0.5, 0.44, zf - 0.01], AMBER);
    // faros escamoteables, levantados: caja con la tapa del color de la carrocería y el cristal mirando adelante
    for (const sx of [-1, 1]) { const x0 = sx * 0.4, x1 = sx * 0.74, z0 = -1.97, z1 = -1.8, y0 = 0.64, y1 = 0.76;
      const box = (p0, p1, cols) => { const [a, b, c] = p0, [e, f, h] = p1, V = [[a, b, c], [e, b, c], [e, f, c], [a, f, c], [a, b, h], [e, b, h], [e, f, h], [a, f, h]];
        quad(V[0], V[1], V[2], V[3], cols.front); quad(V[4], V[5], V[6], V[7], cols.back); quad(V[3], V[2], V[6], V[7], cols.top); quad(V[0], V[3], V[7], V[4], cols.side); quad(V[1], V[2], V[6], V[5], cols.side); };
      box([x0, y0, z0], [x1, y1, z1], { front: TRIM, back: P, top: P, side: P });
      quad([x0 + sx * 0.02, y0 + 0.02, z0 - 0.005], [x1 - sx * 0.02, y0 + 0.02, z0 - 0.005], [x1 - sx * 0.02, y1 - 0.02, z0 - 0.005], [x0 + sx * 0.02, y1 - 0.02, z0 - 0.005], LENS); }
    // pilotos traseros (franja roja de lado a lado, con el centro negro) y luces de freno
    const zr = 2.105; for (const sx of [-1, 1]) { quad([sx * 0.3, 0.6, zr], [sx * 0.74, 0.6, zr], [sx * 0.74, 0.74, zr], [sx * 0.3, 0.74, zr], RED);
      quad([sx * 0.3, 0.6, zr + 0.01], [sx * 0.74, 0.6, zr + 0.01], [sx * 0.74, 0.74, zr + 0.01], [sx * 0.3, 0.74, zr + 0.01], [1, 0.15, 0.1], gb); }
    quad([-0.3, 0.6, zr], [0.3, 0.6, zr], [0.3, 0.74, zr], [-0.3, 0.74, zr], BLACK);
    // espejos y alerón pequeño sobre el portón
    for (const sx of [-1, 1]) quad([sx * 0.82, 0.86, -0.62], [sx * 0.95, 0.86, -0.6], [sx * 0.95, 0.96, -0.58], [sx * 0.82, 0.96, -0.6], P);
    quad([-0.66, 1.0, 1.66], [0.66, 1.0, 1.66], [0.66, 1.03, 1.86], [-0.66, 1.03, 1.86], BLACK);
    // ruedas del coche base, en el sitio de un coupé (batalla larga) y caja de choque a su medida
    const W = d.wheels.map(w => ({ ...w, c: [Math.sign(w.c[0]) * 0.72, w.c[1], w.c[2] < 0 ? -1.25 : 1.2] }));
    // motor: bastante más par que el Mini y más velocidad punta (para aguantar el derrape a fondo)
    const gearF = d.gearF.map(r => [r[0] * 1.45, r[1] * 1.9, ...r.slice(2)]);
    return { ...d, gearF, name, vname: name, mesh: mb, brake, wheels: W, box: { c: [0, 0.05, 0], h: [0.82, 0.5, 2.06] }, interior: null, logoSlot: false,
      brakeSpots: [[-0.55, 0.67 + G, 2.12], [0.55, 0.67 + G, 2.12]], nitro: [0.35, 0.3 + G, 2.12], decoParts: [] };
  }
  // ---------- coupés de drift: Bávaro 30 (berlina alemana de los 80, cuadrada, paragolpes negros, faros dobles redondos)
  //            y Zeta 35 (coupé japonés de los 2000, curvo, capó largo, trasera corta y pasos de rueda marcados) ----------
  function coupe(d, P, name, gl) {
    const E = name === 'BAV30', G = -0.66, BLACK = [0.06, 0.06, 0.07], GLASS = gl || [0.09, 0.12, 0.16], CHROME = [0.75, 0.76, 0.78], RED = [0.8, 0.06, 0.05], LENS = [0.95, 0.95, 0.88], AMBER = [0.95, 0.55, 0.1];
    const mb = new BRR.MeshBuilder(d.mesh.pal), g = mb.group('COLOR'), brake = new BRR.MeshBuilder(d.mesh.pal), gb = brake.group('COLOR');
    const tri = (q, a, b, c, col) => { for (const v of [a, b, c]) { q.pos.push(v[0], v[1] + G, v[2]); q.col.push(...col); q.lay.push(0); } };
    const quad = (a, b, c, e, col, q = g) => { tri(q, a, b, c, col); tri(q, a, c, e, col); tri(q, a, c, b, col); tri(q, a, e, c, col); };
    const K = E ? [   // tres volúmenes: capó plano, luna casi vertical, techo plano y maletero
      { z: -2.12, w: 0.8, lo: 0.2, belt: 0.36, sh: 0.5, wt: 0.76, top: 0.5, k: 'bumper' }, { z: -2.02, w: 0.84, lo: 0.2, belt: 0.44, sh: 0.64, wt: 0.8, top: 0.66, k: 'hood' },
      { z: -0.75, w: 0.85, lo: 0.2, belt: 0.48, sh: 0.72, wt: 0.8, top: 0.74, k: 'wind' }, { z: -0.25, w: 0.85, lo: 0.2, belt: 0.48, sh: 0.74, wt: 0.68, top: 1.22, k: 'roof' },
      { z: 0.85, w: 0.85, lo: 0.2, belt: 0.48, sh: 0.75, wt: 0.68, top: 1.2, k: 'hatch' }, { z: 1.35, w: 0.85, lo: 0.2, belt: 0.5, sh: 0.76, wt: 0.8, top: 0.8, k: 'tail' },
      { z: 2.0, w: 0.84, lo: 0.2, belt: 0.5, sh: 0.76, wt: 0.8, top: 0.78, k: 'bumper' }, { z: 2.1, w: 0.8, lo: 0.22, belt: 0.48, sh: 0.6, wt: 0.74, top: 0.6, k: 'end' }]
      : [   // curvo: capó largo y bajo, techo que cae en arco hasta una cola corta y alta
      { z: -2.15, w: 0.8, lo: 0.17, belt: 0.32, sh: 0.44, wt: 0.74, top: 0.44, k: 'bumper' }, { z: -2.05, w: 0.88, lo: 0.16, belt: 0.4, sh: 0.56, wt: 0.8, top: 0.6, k: 'hood' },
      { z: -0.9, w: 0.93, lo: 0.16, belt: 0.48, sh: 0.7, wt: 0.82, top: 0.74, k: 'wind' }, { z: -0.1, w: 0.92, lo: 0.16, belt: 0.5, sh: 0.74, wt: 0.62, top: 1.13, k: 'roof' },
      { z: 0.55, w: 0.93, lo: 0.16, belt: 0.52, sh: 0.76, wt: 0.62, top: 1.08, k: 'hatch' }, { z: 1.7, w: 0.92, lo: 0.17, belt: 0.56, sh: 0.82, wt: 0.82, top: 0.86, k: 'tail' },
      { z: 2.02, w: 0.88, lo: 0.2, belt: 0.54, sh: 0.8, wt: 0.82, top: 0.8, k: 'bumper' }, { z: 2.1, w: 0.82, lo: 0.24, belt: 0.5, sh: 0.64, wt: 0.76, top: 0.64, k: 'end' }];
    const lerpAt = z => { let i = 0; while (i < K.length - 2 && K[i + 1].z < z) i++; const a = K[i], b = K[i + 1], t = (z - a.z) / (b.z - a.z), L = x => a[x] + (b[x] - a[x]) * t; return { z, w: L('w'), lo: L('lo'), belt: L('belt'), sh: L('sh'), wt: L('wt'), top: L('top'), k: a.k }; };
    const archZ = [-1.3, 1.25], AR = 0.41, extra = [];
    for (const zc of archZ) for (let q = 0; q <= 8; q++) { const t = q / 8, st = lerpAt(zc + Math.cos(Math.PI * t) * -AR); st.lo = Math.max(st.lo, 0.28 + Math.sin(Math.PI * t) * 0.34); if (!E) st.w += Math.sin(Math.PI * t) * 0.035; extra.push(st); }
    const S = K.concat(extra).sort((a, b) => a.z - b.z);
    const ring = s => { const R = [[s.w, s.lo], [s.w, s.belt], [s.w * (E ? 0.99 : 0.97), s.sh], [s.wt, s.top]]; return [...R.map(([x, y]) => [x, y, s.z]), ...R.slice().reverse().map(([x, y]) => [-x, y, s.z])]; };
    const colOf = (k, seg) => { if (seg === 0) return BLACK; if (k === 'bumper' || k === 'end') return E ? (seg === 4 ? P : BLACK) : (seg === 0 ? BLACK : P);
      if (seg === 3) return k === 'roof' || k === 'hatch' ? GLASS : P; if (seg === 4) return k === 'wind' || k === 'hatch' ? GLASS : P; return P; };
    for (let i = 0; i < S.length - 1; i++) { const a = ring(S[i]), b = ring(S[i + 1]), k = S[i].k, n = a.length, SEG = [0, 1, 3, 4, 3, 1, 0];
      for (let j = 0; j < n - 1; j++) quad(a[j], a[j + 1], b[j + 1], b[j], colOf(k, SEG[j])); quad(a[n - 1], a[0], b[0], b[n - 1], BLACK); }
    quad([-0.62, 0.3, -1.95], [0.62, 0.3, -1.95], [0.62, 0.3, 1.95], [-0.62, 0.3, 1.95], BLACK);
    for (const zc of archZ) for (const sx of [-1, 1]) { const x = sx * 0.5, y = 0.62; quad([x, 0.3, zc - AR], [x, 0.3, zc + AR], [x, y, zc + AR], [x, y, zc - AR], BLACK); quad([x, y, zc - AR], [x, y, zc + AR], [sx * (E ? 0.83 : 0.9), y, zc + AR], [sx * (E ? 0.83 : 0.9), y, zc - AR], BLACK); }
    for (const i of [0, S.length - 1]) { const r = ring(S[i]), c0 = [0, (S[i].lo + S[i].sh) / 2, S[i].z]; for (let j = 0; j < r.length; j++) { const a = r[j], b = r[(j + 1) % r.length]; tri(g, c0, a, b, BLACK); tri(g, c0, b, a, BLACK); } }
    const z0 = K[0].z - 0.006, zr = K[K.length - 1].z + 0.006;
    if (E) {   // faros redondos dobles (como cuadrados de 8 lados), rejilla negra ancha, intermitentes y pilotos traseros anchos
      const disc = (cx, cy, r, col) => { for (let k = 0; k < 8; k++) { const a0 = k / 8 * 6.2832, a1 = (k + 1) / 8 * 6.2832; tri(g, [cx, cy, z0 - 0.002], [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, z0 - 0.002], [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, z0 - 0.002], col); tri(g, [cx, cy, z0 - 0.002], [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, z0 - 0.002], [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, z0 - 0.002], col); } };
      quad([-0.76, 0.4, z0], [0.76, 0.4, z0], [0.76, 0.6, z0], [-0.76, 0.6, z0], BLACK); for (const sx of [-1, 1]) { disc(sx * 0.6, 0.5, 0.075, LENS); disc(sx * 0.4, 0.5, 0.065, LENS); }
      for (const sx of [-1, 1]) quad([sx * 0.62, 0.28, z0 - 0.003], [sx * 0.76, 0.28, z0 - 0.003], [sx * 0.76, 0.34, z0 - 0.003], [sx * 0.62, 0.34, z0 - 0.003], AMBER);
      for (const sx of [-1, 1]) { quad([sx * 0.25, 0.54, zr], [sx * 0.78, 0.54, zr], [sx * 0.78, 0.7, zr], [sx * 0.25, 0.7, zr], RED); quad([sx * 0.25, 0.54, zr + 0.01], [sx * 0.78, 0.54, zr + 0.01], [sx * 0.78, 0.7, zr + 0.01], [sx * 0.25, 0.7, zr + 0.01], [1, 0.15, 0.1], gb); }
      quad([-0.25, 0.54, zr], [0.25, 0.54, zr], [0.25, 0.7, zr], [-0.25, 0.7, zr], BLACK);
      for (const sx of [-1, 1]) { const x = sx * 0.856; quad([x, 0.44, -1.8], [x, 0.44, 1.9], [x, 0.47, 1.9], [x, 0.47, -1.8], CHROME); }   // moldura lateral
      quad([-0.72, 1.23, 0.9], [0.72, 1.23, 0.9], [0.72, 1.26, 1.12], [-0.72, 1.26, 1.12], BLACK); }   // pequeño alerón en el maletero
    else {   // faros alargados hacia atrás, toma negra baja, pilotos traseros en bumerán
      for (const sx of [-1, 1]) quad([sx * 0.42, 0.5, z0 + 0.03], [sx * 0.82, 0.48, z0 + 0.24], [sx * 0.84, 0.56, z0 + 0.3], [sx * 0.46, 0.58, z0 + 0.05], LENS);
      quad([-0.45, 0.2, z0], [0.45, 0.2, z0], [0.45, 0.34, z0], [-0.45, 0.34, z0], BLACK);
      for (const sx of [-1, 1]) { quad([sx * 0.5, 0.66, zr], [sx * 0.86, 0.6, zr - 0.08], [sx * 0.86, 0.76, zr - 0.1], [sx * 0.55, 0.78, zr], RED); quad([sx * 0.5, 0.66, zr + 0.01], [sx * 0.86, 0.6, zr - 0.07], [sx * 0.86, 0.76, zr - 0.09], [sx * 0.55, 0.78, zr + 0.01], [1, 0.15, 0.1], gb); }
      for (const sx of [-1, 1]) quad([sx * 0.18, 0.22, zr], [sx * 0.3, 0.22, zr], [sx * 0.3, 0.3, zr], [sx * 0.18, 0.3, zr], [0.3, 0.3, 0.32]); }   // escapes dobles
    for (const sx of [-1, 1]) quad([sx * (E ? 0.85 : 0.9), 0.8, -0.7], [sx * (E ? 0.98 : 1.02), 0.8, -0.68], [sx * (E ? 0.98 : 1.02), 0.9, -0.66], [sx * (E ? 0.85 : 0.9), 0.9, -0.68], P);   // espejos
    const W = d.wheels.map(w => ({ ...w, c: [Math.sign(w.c[0]) * (E ? 0.7 : 0.75), w.c[1], w.c[2] < 0 ? archZ[0] : archZ[1]] }));
    const gearF = d.gearF.map(r => [r[0] * (E ? 1.42 : 1.5), r[1] * (E ? 1.85 : 2.0), ...r.slice(2)]);   // como el Panda: mucho par para derrapar
    return { ...d, gearF, name, vname: name, mesh: mb, brake, wheels: W, box: { c: [0, 0.06, 0], h: [E ? 0.86 : 0.92, 0.5, 2.1] }, interior: null, logoSlot: false,
      brakeSpots: [[-0.5, 0.62 + G, zr], [0.5, 0.62 + G, zr]], nitro: [0.3, 0.26 + G, zr], decoParts: [], headPos: null };
  }
  // ---------- GT de carreras ----------
  function gt(d, P, name, gl, variant) {
    const SPR = variant === 'sprint', ACC = [0.98, 0.78, 0.1];   // GT Sprint: misma mecánica, otra carrocería (morro con toma, franja lateral amarilla, alerón doble, escape central)
    const G = -0.6, BLACK = [0.06, 0.06, 0.07], GLASS = gl || [0.08, 0.1, 0.14], WHITE = [0.93, 0.93, 0.9], RED = [0.8, 0.05, 0.04], LENS = [0.95, 0.95, 0.88], CARB = [0.13, 0.13, 0.15];
    const mb = new BRR.MeshBuilder(d.mesh.pal), g = mb.group('COLOR'), brake = new BRR.MeshBuilder(d.mesh.pal), gb = brake.group('COLOR');
    const tri = (q, a, b, c, col) => { for (const v of [a, b, c]) { q.pos.push(v[0], v[1] + G, v[2]); q.col.push(...col); q.lay.push(0); } };
    const quad = (a, b, c, e, col, q = g) => { tri(q, a, b, c, col); tri(q, a, c, e, col); tri(q, a, c, b, col); tri(q, a, e, c, col); };
    const box = (p0, p1, col) => { const [a, b, c] = p0, [e, f, h] = p1, V = [[a, b, c], [e, b, c], [e, f, c], [a, f, c], [a, b, h], [e, b, h], [e, f, h], [a, f, h]];
      quad(V[0], V[1], V[2], V[3], col); quad(V[4], V[5], V[6], V[7], col); quad(V[3], V[2], V[6], V[7], col); quad(V[0], V[1], V[5], V[4], col); quad(V[0], V[3], V[7], V[4], col); quad(V[1], V[2], V[6], V[5], col); };
    // secciones (como el Panda): bajo, ancho, capó largo y trasera fastback que cae hasta la cola
    const K = [
      { z: -2.3, w: 0.84, lo: 0.14, belt: 0.3, sh: 0.4, wt: 0.78, top: 0.4, k: 'bumper' },
      { z: -2.2, w: 0.9, lo: 0.13, belt: 0.36, sh: 0.52, wt: 0.82, top: 0.55, k: 'hood' },
      { z: -1.4, w: 0.94, lo: 0.13, belt: 0.42, sh: 0.64, wt: 0.84, top: 0.68, k: 'hood' },
      { z: -0.55, w: 0.93, lo: 0.13, belt: 0.42, sh: 0.66, wt: 0.82, top: 0.7, k: 'wind' },
      { z: 0.1, w: 0.92, lo: 0.13, belt: 0.42, sh: 0.68, wt: 0.6, top: 1.05, k: 'roof' },
      { z: 0.75, w: 0.93, lo: 0.13, belt: 0.43, sh: 0.7, wt: 0.6, top: 1.03, k: 'hatch' },
      { z: 1.95, w: 0.94, lo: 0.13, belt: 0.45, sh: 0.74, wt: 0.8, top: 0.78, k: 'tail' },
      { z: 2.22, w: 0.9, lo: 0.16, belt: 0.45, sh: 0.74, wt: 0.82, top: 0.76, k: 'bumper' },
      { z: 2.3, w: 0.84, lo: 0.2, belt: 0.44, sh: 0.62, wt: 0.76, top: 0.62, k: 'end' }];
    const lerpAt = z => { let i = 0; while (i < K.length - 2 && K[i + 1].z < z) i++; const a = K[i], b = K[i + 1], t = (z - a.z) / (b.z - a.z), L = x => a[x] + (b[x] - a[x]) * t; return { z, w: L('w'), lo: L('lo'), belt: L('belt'), sh: L('sh'), wt: L('wt'), top: L('top'), k: a.k }; };
    const archZ = [-1.38, 1.36], AR = 0.42, extra = [];
    for (const zc of archZ) for (let q = 0; q <= 8; q++) { const t = q / 8, st = lerpAt(zc + Math.cos(Math.PI * t) * -AR); st.lo = Math.max(st.lo, 0.26 + Math.sin(Math.PI * t) * 0.32); st.w += Math.sin(Math.PI * t) * 0.04; extra.push(st); }   // pasos de rueda ensanchados
    const S = K.concat(extra).sort((a, b) => a.z - b.z);
    const ring = s => { const R = [[s.w, s.lo], [s.w, s.belt], [s.w * 0.97, s.sh], [s.wt, s.top]]; return [...R.map(([x, y]) => [x, y, s.z]), ...R.slice().reverse().map(([x, y]) => [-x, y, s.z])]; };
    const colOf = (k, seg) => { if (seg === 0) return CARB; if (k === 'bumper' || k === 'end') return seg === 4 ? P : seg === 1 ? P : CARB;
      if (seg === 3) return k === 'roof' || k === 'hatch' ? GLASS : P; if (seg === 4) return k === 'wind' || k === 'hatch' ? GLASS : P; return P; };
    for (let i = 0; i < S.length - 1; i++) { const a = ring(S[i]), b = ring(S[i + 1]), k = S[i].k, n = a.length, SEG = [0, 1, 3, 4, 3, 1, 0];
      for (let j = 0; j < n - 1; j++) quad(a[j], a[j + 1], b[j + 1], b[j], colOf(k, SEG[j])); quad(a[n - 1], a[0], b[0], b[n - 1], BLACK); }
    quad([-0.7, 0.26, -2.1], [0.7, 0.26, -2.1], [0.7, 0.26, 2.15], [-0.7, 0.26, 2.15], BLACK);
    for (const zc of archZ) for (const sx of [-1, 1]) { const x = sx * 0.56, y = 0.56; quad([x, 0.26, zc - AR], [x, 0.26, zc + AR], [x, y, zc + AR], [x, y, zc - AR], BLACK); quad([x, y, zc - AR], [x, y, zc + AR], [sx * 0.96, y, zc + AR], [sx * 0.96, y, zc - AR], BLACK); }
    for (const i of [0, S.length - 1]) { const r = ring(S[i]), c0 = [0, (S[i].lo + S[i].sh) / 2, S[i].z]; for (let j = 0; j < r.length; j++) { const a = r[j], b = r[(j + 1) % r.length]; tri(g, c0, a, b, BLACK); tri(g, c0, b, a, BLACK); } }
    // franjas blancas de carreras por el centro (capó, techo y maletero), un pelo por encima de la chapa
    const topAt = z => lerpAt(z).top + 0.012; if (!SPR) for (const sx of [-1, 1]) { const x0 = sx * 0.1, x1 = sx * 0.26; let zs = [-2.2, -1.8, -1.4, -0.98, -0.55]; for (let i = 0; i < zs.length - 1; i++) quad([x0, topAt(zs[i]), zs[i]], [x1, topAt(zs[i]), zs[i]], [x1, topAt(zs[i + 1]), zs[i + 1]], [x0, topAt(zs[i + 1]), zs[i + 1]], WHITE);
      zs = [0.1, 0.45, 0.75]; for (let i = 0; i < zs.length - 1; i++) quad([x0, topAt(zs[i]), zs[i]], [x1, topAt(zs[i]), zs[i]], [x1, topAt(zs[i + 1]), zs[i + 1]], [x0, topAt(zs[i + 1]), zs[i + 1]], WHITE);
      zs = [1.95, 2.22]; quad([x0, topAt(zs[0]), zs[0]], [x1, topAt(zs[0]), zs[0]], [x1, topAt(zs[1]), zs[1]], [x0, topAt(zs[1]), zs[1]], WHITE); }
    if (SPR) { // franja lateral amarilla de punta a punta, toma de aire en el techo y capó negro mate
      for (const sx of [-1, 1]) { const zs = [-2.15, -1.8, -0.9, 0.2, 1.2, 2.15]; for (let i = 0; i < zs.length - 1; i++) { const a = lerpAt(zs[i]), b = lerpAt(zs[i + 1]), x0 = sx * (a.w + 0.006), x1 = sx * (b.w + 0.006);
        quad([x0, a.belt - 0.05, zs[i]], [x1, b.belt - 0.05, zs[i + 1]], [x1, b.belt + 0.03, zs[i + 1]], [x0, a.belt + 0.03, zs[i]], ACC); } }
      { const z0 = -1.5, z1 = -0.6; quad([-0.5, topAt(z0) + 0.004, z0], [0.5, topAt(z0) + 0.004, z0], [0.5, topAt(z1) + 0.004, z1], [-0.5, topAt(z1) + 0.004, z1], BLACK); }
      box([-0.16, 1.02, 0.0], [0.16, 1.12, 0.42], BLACK); quad([-0.13, 1.03, -0.005], [0.13, 1.03, -0.005], [0.13, 1.1, -0.005], [-0.13, 1.1, -0.005], [0.02, 0.02, 0.02]); }
    // círculo de dorsal blanco en las puertas
    for (const sx of [-1, 1]) { const x = sx * 0.945, cz = -0.05, cy = 0.42, r = 0.2; for (let k = 0; k < 10; k++) { const a0 = k / 10 * 2 * Math.PI, a1 = (k + 1) / 10 * 2 * Math.PI; tri(g, [x, cy, cz], [x, cy + Math.sin(a0) * r, cz + Math.cos(a0) * r], [x, cy + Math.sin(a1) * r, cz + Math.cos(a1) * r], WHITE); tri(g, [x, cy, cz], [x, cy + Math.sin(a1) * r, cz + Math.cos(a1) * r], [x, cy + Math.sin(a0) * r, cz + Math.cos(a0) * r], WHITE); } }
    // morro: faros estrechos, toma de aire negra y labio delantero
    const zf = -2.305; for (const sx of [-1, 1]) quad([sx * 0.48, 0.34, zf], [sx * 0.8, 0.36, zf + 0.02], [sx * 0.8, 0.4, zf + 0.04], [sx * 0.48, 0.39, zf], LENS);
    quad([-0.4, 0.18, zf - 0.005], [0.4, 0.18, zf - 0.005], [0.4, 0.32, zf - 0.005], [-0.4, 0.32, zf - 0.005], BLACK);
    quad([-0.9, 0.12, -2.42], [0.9, 0.12, -2.42], [0.9, 0.12, -2.15], [-0.9, 0.12, -2.15], CARB);
    // alerón trasero sobre dos soportes, con derivas laterales
    if (SPR) { quad([-0.9, 1.15, 1.96], [0.9, 1.15, 1.96], [0.9, 1.18, 2.12], [-0.9, 1.18, 2.12], ACC); for (const sx of [-1, 1]) box([sx * 0.2 - 0.025, 1.02, 2.0], [sx * 0.2 + 0.025, 1.16, 2.08], CARB); }   // segundo plano del alerón
    for (const sx of [-1, 1]) box([sx * 0.42 - 0.03, 0.74, 1.98], [sx * 0.42 + 0.03, 1.02, 2.1], CARB);
    quad([-0.92, 1.04, 1.94], [0.92, 1.04, 1.94], [0.92, 1.08, 2.26], [-0.92, 1.08, 2.26], CARB); quad([-0.92, 1.0, 1.94], [0.92, 1.0, 1.94], [0.92, 1.04, 2.26], [-0.92, 1.04, 2.26], P);
    for (const sx of [-1, 1]) quad([sx * 0.92, 0.94, 1.9], [sx * 0.92, 0.94, 2.3], [sx * 0.92, 1.14, 2.3], [sx * 0.92, 1.14, 1.9], CARB);
    // pilotos (franja roja), luces de freno y difusor
    const zr = 2.305; for (const sx of [-1, 1]) { quad([sx * 0.4, 0.62, zr], [sx * 0.82, 0.62, zr], [sx * 0.82, 0.7, zr], [sx * 0.4, 0.7, zr], RED);
      quad([sx * 0.4, 0.62, zr + 0.01], [sx * 0.82, 0.62, zr + 0.01], [sx * 0.82, 0.7, zr + 0.01], [sx * 0.4, 0.7, zr + 0.01], [1, 0.15, 0.1], gb); }
    for (const x of [-0.5, -0.17, 0.17, 0.5]) quad([x, 0.14, 2.0], [x, 0.14, 2.32], [x, 0.3, 2.32], [x, 0.3, 2.0], CARB);
    if (SPR) box([-0.1, 0.2, 2.28], [0.1, 0.3, 2.36], [0.3, 0.3, 0.32]);   // escape central
    for (const sx of [-1, 1]) quad([sx * 0.9, 0.74, -0.45], [sx * 1.03, 0.74, -0.43], [sx * 1.03, 0.82, -0.41], [sx * 0.9, 0.82, -0.43], P);   // espejos
    const W = d.wheels.map(w => ({ ...w, c: [Math.sign(w.c[0]) * 0.8, w.c[1], w.c[2] < 0 ? -1.38 : 1.36] }));   // (la carrocería va 12 cm más alta que antes: no toca el suelo y las ruedas caben en sus pasos)
    // motor de carreras: más punta y mucho más empuje que el Mini (y en el Grand Prix, todo a escala de GP)
    const gearF = d.gearF.map(r => [r[0] * 1.55, r[1] * 2.0, ...r.slice(2)]);   // punta ~200 km/h en el Grand Prix
    return { ...d, gearF, name, vname: name, mesh: mb, brake, wheels: W, box: { c: [0, 0.12, 0], h: [0.92, 0.45, 2.26] }, interior: null, logoSlot: false,
      brakeSpots: [[-0.6, 0.66 + G, 2.31], [0.6, 0.66 + G, 2.31]], nitro: [0.3, 0.22 + G, 2.32], decoParts: [], headPos: null };   // cerrado: el piloto no se ve (con el techo bajo asomaría la cabeza)
  }
})();
