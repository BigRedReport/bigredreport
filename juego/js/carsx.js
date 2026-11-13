// Coches propios (no vienen en el juego original): se montan sobre las físicas, ruedas y sonido de un coche del juego
// y llevan una carrocería hecha aquí, de pocos polígonos, al estilo del original.
//  · PANDA ("Panda 86"): coupé japonés de los 80 de propulsión trasera, faros escamoteables levantados, parte de abajo negra
//    y la de arriba del color elegido (blanca por defecto). De momento solo en el modo drift.
//  · GT: coche de carreras de gran turismo para el Grand Prix: bajo y ancho, morro largo, trasera fastback, alerón grande y franjas blancas.
"use strict";
(function () {
  const BRR = window.BRR;
  BRR.CUSTOM_CARS = { PANDA: { base: 'MINI', name: 'Panda 86' }, GT: { base: 'MINI', name: 'GT' }, GTS: { base: 'MINI', name: 'GT Sprint' }, CIVICO: { base: 'MINI', name: 'Cívico' }, BAV30: { base: 'MINI', name: 'Bávaro 30' }, ZETA35: { base: 'MINI', name: 'Zeta 35' }, KART: { base: 'MINI', name: 'Go-kart' }, F1: { base: 'MINI', name: 'Fórmula' }, MINIMO: { base: 'MINI', name: 'Mínimo 50' } };
  const orig = BRR.loadVehicle;
  BRR.loadVehicle = async function (files, name, lvl, team = 1, extra = {}) {
    const C = BRR.CUSTOM_CARS[String(name).toUpperCase()]; if (!C) return orig(files, name, lvl, team, extra);
    const d = await orig(files, C.base, lvl, team, { ...extra, paint: null, logo: null, logoHi: null });
    const paint = (extra.paint || [238, 238, 234]).map(v => v / 255);
    const gl = extra.glass ? extra.glass.map(v => v / 255 * 0.8) : null;   // cristales del garaje
    const NM = String(name).toUpperCase();
    if (NM === 'CIVICO') return civico(d, (extra.paint || [215, 40, 30]).map(v => v / 255), gl);
    if (NM === 'GT') return gt(d, (extra.paint || [200, 30, 26]).map(v => v / 255), 'GT', gl);
    if (NM === 'GTS') return gt(d, (extra.paint || [30, 90, 200]).map(v => v / 255), 'GTS', gl, 'sprint');   // la variante del GT: mismo coche, otra carrocería
    if (NM === 'ZETA35') return zeta(d, (extra.paint || [235, 150, 30]).map(v => v / 255), gl);
    if (NM === 'MINIMO') return minimo(d, (extra.paint || [190, 20, 25]).map(v => v / 255), gl);
    if (NM === 'BAV30') return coupe(d, (extra.paint || (NM === 'BAV30' ? [235, 235, 230] : [235, 150, 30])).map(v => v / 255), NM, gl);
    if (NM === 'KART') return kart(d, (extra.paint || [230, 40, 30]).map(v => v / 255));
    if (NM === 'F1') return f1(d, (extra.paint || [200, 20, 20]).map(v => v / 255));
    return panda(d, paint, NM, gl);
  };
  // pilares y marcos para las carrocerías de 4 puntos por lado (Panda, Bávaro, GT): el cristal lateral va de [w·f, hombro] a [wt, techo]
  function frames(quad, lerpAt, f, P, o) {
    const pts = z => { const s = lerpAt(z); return [[s.w * f, s.sh], [s.wt, s.top]]; };
    const out = (p, sx) => [sx * (p[0] + 0.012), p[1] + 0.004];
    for (const sx of [-1, 1]) {
      for (const [z0, z1, col] of o.strips || []) { const A = pts(z0), B = pts(z1), a0 = out(A[0], sx), a1 = out(A[1], sx), b0 = out(B[0], sx), b1 = out(B[1], sx); quad([a0[0], a0[1], z0], [b0[0], b0[1], z1], [b1[0], b1[1], z1], [a1[0], a1[1], z0], col); }
      for (const [zs, col, k, hh] of o.lines || []) for (let i = 0; i < zs.length - 1; i++) { const a = out(pts(zs[i])[k], sx), b = out(pts(zs[i + 1])[k], sx); quad([a[0], a[1] - hh, zs[i]], [b[0], b[1] - hh, zs[i + 1]], [b[0], b[1] + hh, zs[i + 1]], [a[0], a[1] + hh, zs[i]], col); }
      if (o.wind) { const [z0, z1, wpx, col] = o.wind, n = 3; for (let i = 0; i < n; i++) { const za = z0 + (z1 - z0) * i / n, zb = z0 + (z1 - z0) * (i + 1) / n, A = lerpAt(za), B = lerpAt(zb);
        quad([sx * A.wt, A.top + 0.008, za], [sx * (A.wt - wpx), A.top + 0.008, za], [sx * (B.wt - wpx), B.top + 0.008, zb], [sx * B.wt, B.top + 0.008, zb], col || P); } }
      if (o.rear) { const [z0, z1, wpx, col] = o.rear, n = 3; for (let i = 0; i < n; i++) { const za = z0 + (z1 - z0) * i / n, zb = z0 + (z1 - z0) * (i + 1) / n, A = lerpAt(za), B = lerpAt(zb);
        quad([sx * A.wt, A.top + 0.008, za], [sx * (A.wt - wpx), A.top + 0.008, za], [sx * (B.wt - wpx), B.top + 0.008, zb], [sx * B.wt, B.top + 0.008, zb], col || P); } } }
  }
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
      if (seg === 3) return k === 'roof' || k === 'hatch' || k === 'wind' ? GLASS : P; if (seg === 4) return k === 'wind' || k === 'hatch' ? GLASS : P; return P; };
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
    frames(quad, lerpAt, 0.985, P, { strips: [[0.3, 0.38, BLACK], [1.15, 1.82, P], [0.95, 1.0, BLACK], [-0.72, -0.66, P]], lines: [[[-0.72, -0.4, -0.1], P, 1, 0.03], [[-0.1, 0.72, 1.15], BLACK, 1, 0.014], [[-0.66, -0.1, 0.72, 1.15], [0.6, 0.6, 0.62], 0, 0.01]], wind: [-0.72, -0.1, 0.05], rear: [0.72, 1.82, 0.05] });   // pilares B (negro) y C (chapa), marcos de las ventanillas y del parabrisas
    // ruedas del coche base, en el sitio de un coupé (batalla larga) y caja de choque a su medida
    const W = d.wheels.map(w => ({ ...w, c: [Math.sign(w.c[0]) * 0.72, w.c[1], w.c[2] < 0 ? -1.25 : 1.2] }));
    // motor: bastante más par que el Mini y más velocidad punta (para aguantar el derrape a fondo)
    const gearF = d.gearF.map(r => [r[0] * 1.45, r[1] * 1.9, ...r.slice(2)]);
    return { ...d, gearF, name, vname: name, mesh: mb, brake, wheels: W, box: { c: [0, 0.05, 0], h: [0.82, 0.5, 2.06] }, interior: null, logoSlot: false,
      brakeSpots: [[-0.55, 0.67 + G, 2.12], [0.55, 0.67 + G, 2.12]], nitro: [0.35, 0.3 + G, 2.12], decoParts: [] };
  }
  // ---------- ayudantes para los coches de ruedas al aire (kart y fórmula): cajas, cuñas y ruedas propias ----------
  function kit3(pal, G) {
    const mb = new BRR.MeshBuilder(pal), g = mb.group('COLOR'), brake = new BRR.MeshBuilder(pal), gb = brake.group('COLOR');
    const tri = (q, a, b, c, col) => { for (const v of [a, b, c]) { q.pos.push(v[0], v[1] + G, v[2]); q.col.push(...col); q.lay.push(0); } };
    const quad = (a, b, c, e, col, q = g) => { tri(q, a, b, c, col); tri(q, a, c, e, col); tri(q, a, c, b, col); tri(q, a, e, c, col); };
    const box = (x0, y0, z0, x1, y1, z1, col, top = col) => { const V = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
      quad(V[0], V[1], V[2], V[3], col); quad(V[4], V[5], V[6], V[7], col); quad(V[3], V[2], V[6], V[7], top); quad(V[0], V[1], V[5], V[4], col); quad(V[0], V[3], V[7], V[4], col); quad(V[1], V[2], V[6], V[5], col); };
    // pieza con sección distinta delante y detrás (morros, pontones): [ancho, alto abajo, alto arriba] en cada extremo
    const loft = (z0, a, z1, b, col, top = col, xc = 0) => { const P = (z, q) => [[xc - q[0], q[1], z], [xc + q[0], q[1], z], [xc + q[0], q[2], z], [xc - q[0], q[2], z]], A = P(z0, a), B = P(z1, b);
      quad(A[0], A[1], A[2], A[3], col); quad(B[0], B[1], B[2], B[3], col); quad(A[3], A[2], B[2], B[3], top); quad(A[0], A[1], B[1], B[0], col); quad(A[0], A[3], B[3], B[0], col); quad(A[1], A[2], B[2], B[1], col); };
    return { mb, g, brake, gb, tri, quad, box, loft };
  }
  // rueda propia (cubierta, flancos y llanta): centrada, con el eje en x
  function wheel(pal, r, hw, rim, tread = [0.07, 0.07, 0.08]) {
    const mb = new BRR.MeshBuilder(pal), g = mb.group('COLOR'), N = 18, T = (a, b, c, k) => { for (const v of [a, b, c, a, c, b]) { g.pos.push(...v); g.col.push(...k); g.lay.push(0); } };
    const P = (x, rr, a) => [x, Math.cos(a) * rr, Math.sin(a) * rr], Q = (a, b, c, d, k) => { T(a, b, c, k); T(a, c, d, k); }, wall = [0.12, 0.12, 0.13], rr = r * 0.62;
    for (let i = 0; i < N; i++) { const a0 = i / N * 6.2832, a1 = (i + 1) / N * 6.2832;
      Q(P(-hw, r, a0), P(hw, r, a0), P(hw, r, a1), P(-hw, r, a1), tread);
      for (const x of [-hw, hw]) { Q(P(x, r, a0), P(x, rr, a0), P(x, rr, a1), P(x, r, a1), wall); Q(P(x * 1.01, rr, a0), P(x * 1.01, rr * 0.25, a0), P(x * 1.01, rr * 0.25, a1), P(x * 1.01, rr, a1), rim); Q(P(x * 1.02, rr * 0.25, a0), P(x * 1.02, 0, a0), P(x * 1.02, 0, a1), P(x * 1.02, rr * 0.25, a1), rim.map(v => v * 0.6)); }
      if (i % 3 === 0) for (const x of [-hw, hw]) Q(P(x * 1.015, rr * 0.9, a0), P(x * 1.015, rr * 0.3, a0), P(x * 1.015, rr * 0.3, a0 + 0.18), P(x * 1.015, rr * 0.9, a0 + 0.18), [0.04, 0.04, 0.05]); }   // huecos de la llanta
    return mb;
  }
  // coloca las 4 ruedas: [x, z, radio, medio ancho] delante y detrás; el suelo no cambia (la carrocería se ajusta encima)
  function placeWheels(d, front, rear, rimCol) { const low = Math.min(...d.wheels.map(w => w.c[1] - w.radius));
    const W = d.wheels.map(w => { const fr = w.c[2] < 0, q = fr ? front : rear; return { ...w, c: [Math.sign(w.c[0]) * q[0], low + q[2], q[1]], radius: q[2] }; });
    const M = W.map(w => wheel(d.mesh.pal, w.radius, (w.c[2] < 0 ? front : rear)[3], rimCol)); return { W, M, G: low }; }
  // ---------- go-kart: pequeño, bajito, sin carrocería; el piloto va sentado a la vista ----------
  function kart(d, P) {
    if (BRR.KART_MESH) {   // kart con malla 3D (kart_data.js): chasis y carrocería del modelo, ruedas del juego
      const { W, M, G } = placeWheels(d, [0.5, -0.52, 0.13, 0.07], [0.55, 0.5, 0.14, 0.1], [0.75, 0.76, 0.78]);
      const COL = [P, [0.07, 0.07, 0.08], [0.09, 0.09, 0.11], [0.5, 0.51, 0.55], [0.78, 0.79, 0.82], [0.6, 0.61, 0.64], [0.33, 0.34, 0.36], [0.04, 0.04, 0.045]];
      const o = BRR.KART_MESH.body, body = meshCar(d.mesh.pal, { ...o, yOff: G }, k => COL[k] || P, null, false);
      const g = body.brake.group('COLOR'); for (const v of [[-0.2, 0.12, 0.826], [0.2, 0.12, 0.826], [0.2, 0.18, 0.826], [-0.2, 0.12, 0.826], [0.2, 0.18, 0.826], [-0.2, 0.18, 0.826]]) { g.pos.push(v[0], v[1] + G, v[2]); g.col.push(1, 0.15, 0.1); g.lay.push(0); }
      const gearF = d.gearF.map(r => [r[0] * 1.15, r[1] * 1.5, ...r.slice(2)]);
      return { ...d, gearF, name: 'KART', vname: 'KART', mesh: body.mb, brake: body.brake, wheels: W, wheelMeshes: M, box: { c: [0, G + 0.22, 0], h: [0.62, 0.22, 0.85] }, interior: null, logoSlot: false,
        brakeSpots: [[-0.15, G + 0.15, 0.83], [0.15, G + 0.15, 0.83]], nitro: [0, G + 0.2, 0.86], decoParts: [], headPos: [0, G + 0.86, 0.1] };
    }
    const { W, M, G } = placeWheels(d, [0.5, -0.52, 0.13, 0.07], [0.55, 0.5, 0.14, 0.1], [0.75, 0.76, 0.78]), K = kit3(d.mesh.pal, G);
    const TUBE = [0.55, 0.56, 0.6], BLK = [0.08, 0.08, 0.09], SEAT = [0.1, 0.1, 0.12], ENG = [0.35, 0.36, 0.38], NUM = [0.95, 0.95, 0.92];
    K.box(-0.32, 0.06, -0.62, 0.32, 0.09, 0.62, BLK);   // bandeja del suelo
    for (const sx of [-1, 1]) K.box(sx * 0.34 - 0.02, 0.07, -0.7, sx * 0.34 + 0.02, 0.11, 0.66, TUBE);   // largueros del chasis
    K.box(-0.5, 0.1, -0.55, 0.5, 0.13, -0.5, TUBE); K.box(-0.55, 0.1, 0.48, 0.55, 0.13, 0.53, TUBE);   // ejes
    K.loft(-0.95, [0.32, 0.08, 0.16], -0.62, [0.36, 0.08, 0.24], P);   // morro (carenado delantero)
    K.box(-0.18, 0.16, -0.97, 0.18, 0.3, -0.92, NUM);   // placa del número
    for (const sx of [-1, 1]) K.loft(-0.25, [0.09, 0.08, 0.2], 0.4, [0.09, 0.08, 0.22], P, P, sx * 0.48);   // pontones laterales
    K.box(-0.5, 0.08, 0.66, 0.5, 0.2, 0.74, P);   // paragolpes trasero
    K.box(-0.18, 0.09, -0.05, 0.18, 0.18, 0.32, SEAT); K.box(-0.18, 0.18, 0.24, 0.18, 0.5, 0.32, SEAT);   // asiento
    K.box(0.22, 0.1, 0.18, 0.42, 0.34, 0.44, ENG); K.box(0.3, 0.34, 0.25, 0.36, 0.42, 0.37, BLK);   // motor a un lado
    K.box(-0.02, 0.12, -0.55, 0.02, 0.36, -0.5, TUBE);   // columna de dirección
    for (let k = 0; k < 8; k++) { const a0 = k / 8 * 6.2832, a1 = (k + 1) / 8 * 6.2832, r = 0.13, y = 0.4, z = -0.45; K.quad([0, y, z], [Math.cos(a0) * r, y + Math.sin(a0) * r, z], [Math.cos(a1) * r, y + Math.sin(a1) * r, z], [0, y, z], BLK); }   // volante
    K.quad([-0.2, 0.12, 0.745], [0.2, 0.12, 0.745], [0.2, 0.18, 0.745], [-0.2, 0.18, 0.745], [1, 0.15, 0.1], K.gb);
    const gearF = d.gearF.map(r => [r[0] * 1.15, r[1] * 1.5, ...r.slice(2)]);   // ligero y con mucho tirón
    return { ...d, gearF, name: 'KART', vname: 'KART', mesh: K.mb, brake: K.brake, wheels: W, wheelMeshes: M, box: { c: [0, G + 0.22, 0], h: [0.62, 0.22, 0.85] }, interior: null, logoSlot: false,
      brakeSpots: [[-0.15, G + 0.15, 0.75], [0.15, G + 0.15, 0.75]], nitro: [0, G + 0.2, 0.78], decoParts: [], headPos: [0, G + 0.86, 0.1] };   // piloto sentado (con el cuerpo y las piernas a la vista)
  }
  // ---------- fórmula (estilo F1): morro largo, alerones, pontones, toma de aire sobre el piloto y ruedas grandes al aire ----------
  function f1(d, P) {
    if (BRR.F1_MESH) {   // fórmula con malla 3D (f1mesh_data.js): carrocería del modelo, ruedas del juego
      const { W, M, G } = placeWheels(d, [0.78, -1.45, 0.32, 0.15], [0.76, 1.32, 0.35, 0.2], [0.18, 0.18, 0.2]);
      const COL = [P, [0.09, 0.09, 0.1], [0.94, 0.94, 0.92], [0.98, 0.82, 0.12], [0.03, 0.03, 0.035]];
      const body = meshCar(d.mesh.pal, { ...BRR.F1_MESH.body, yOff: G }, k => COL[k] || P, null, true);
      const g = body.brake.group('COLOR'); for (const v of [[-0.09, 0.3, 1.862], [0.09, 0.42, 1.862], [0.09, 0.3, 1.862], [-0.09, 0.3, 1.862], [-0.09, 0.42, 1.862], [0.09, 0.42, 1.862], [-0.09, 0.3, 1.862], [0.09, 0.3, 1.862], [0.09, 0.42, 1.862], [-0.09, 0.3, 1.862], [0.09, 0.42, 1.862], [-0.09, 0.42, 1.862]]) { g.pos.push(v[0], v[1] + G, v[2]); g.col.push(1, 0.15, 0.1); g.lay.push(0); }
      const gearF = d.gearF.map(r => [r[0] * 2.0, r[1] * 2.4, ...r.slice(2)]);
      return { ...d, gearF, name: 'F1', vname: 'F1', mesh: body.mb, brake: body.brake, wheels: W, wheelMeshes: M, box: { c: [0, G + 0.35, 0], h: [0.95, 0.3, 2.4] }, interior: null, logoSlot: false,
        brakeSpots: [[0, G + 0.36, 1.87]], nitro: [0, G + 0.3, 1.9], decoParts: [], headPos: [0, G + 0.74, -0.2] };
    }
    const { W, M, G } = placeWheels(d, [0.78, -1.45, 0.32, 0.15], [0.76, 1.32, 0.35, 0.2], [0.18, 0.18, 0.2]), K = kit3(d.mesh.pal, G);
    const CARB = [0.1, 0.1, 0.11], WHITE = [0.94, 0.94, 0.92], ACC = [0.98, 0.82, 0.12];
    K.loft(-2.45, [0.08, 0.12, 0.2], -1.2, [0.2, 0.1, 0.42], P, P);   // morro
    K.box(-0.95, 0.06, -2.5, 0.95, 0.1, -2.15, P, ACC); for (const sx of [-1, 1]) K.box(sx * 0.95 - 0.02, 0.06, -2.5, sx * 0.95 + 0.02, 0.3, -2.12, CARB);   // alerón delantero con derivas
    K.box(-0.9, 0.12, -2.42, 0.9, 0.15, -2.28, CARB);   // segundo plano del alerón
    K.loft(-1.2, [0.26, 0.08, 0.46], 0.0, [0.34, 0.08, 0.58], P, P);   // monocasco (cockpit)
    K.loft(0.0, [0.3, 0.08, 0.6], 1.6, [0.18, 0.12, 0.4], P, P);   // tapa del motor
    K.loft(-0.15, [0.12, 0.62, 0.95], 0.55, [0.1, 0.62, 0.72], P, WHITE);   // toma de aire sobre el piloto
    for (const sx of [-1, 1]) K.loft(-0.6, [0.22, 0.1, 0.42], 0.9, [0.14, 0.1, 0.3], P, P, sx * 0.48);   // pontones
    for (const sx of [-1, 1]) K.box(sx * 0.48 - 0.2, 0.25, -0.62, sx * 0.48 + 0.2, 0.4, -0.58, CARB);   // bocas de los pontones
    K.box(-0.34, 0.585, -0.95, 0.34, 0.6, -0.4, CARB);   // borde del cockpit (hueco del piloto)
    for (const sx of [-1, 1]) { K.box(sx * 0.27 - 0.025, 0.84, -0.95, sx * 0.27 + 0.025, 0.88, -0.2, CARB); K.box(sx * 0.27 - 0.025, 0.6, -0.24, sx * 0.27 + 0.025, 0.88, -0.2, CARB); } K.box(-0.27, 0.84, -0.99, 0.27, 0.88, -0.95, CARB); K.box(-0.03, 0.6, -1.05, 0.03, 0.88, -0.98, CARB);   // halo (un aro: el casco se ve por dentro)
    K.box(-0.55, 0.92, 1.95, 0.55, 0.97, 2.3, P, ACC); K.box(-0.55, 0.78, 2.0, 0.55, 0.81, 2.25, CARB);   // alerón trasero (dos planos)
    for (const sx of [-1, 1]) K.box(sx * 0.56 - 0.02, 0.4, 1.9, sx * 0.56 + 0.02, 1.0, 2.32, P);   // derivas del alerón
    K.box(-0.04, 0.35, 1.85, 0.04, 0.95, 2.0, CARB);   // soporte central
    for (const sx of [-1, 1]) { K.box(sx * 0.2, 0.2, -1.4, sx * 0.62, 0.23, -1.36, CARB); K.box(sx * 0.2, 0.25, 1.28, sx * 0.6, 0.28, 1.32, CARB); }   // brazos de suspensión
    K.box(-0.35, 0.03, -0.8, 0.35, 0.06, 1.7, CARB);   // fondo plano
    K.box(-0.12, 0.18, 1.6, 0.12, 0.32, 1.7, [0.95, 0.15, 0.1]); K.quad([-0.1, 0.2, 1.705], [0.1, 0.2, 1.705], [0.1, 0.3, 1.705], [-0.1, 0.3, 1.705], [1, 0.15, 0.1], K.gb);   // luz de lluvia (freno)
    for (const sx of [-1, 1]) { const x = sx * 0.345, cy = 0.4, cz = -0.5, r = 0.12; for (let k = 0; k < 10; k++) { const a0 = k / 10 * 6.2832, a1 = (k + 1) / 10 * 6.2832; K.quad([x, cy, cz], [x, cy + Math.sin(a0) * r, cz + Math.cos(a0) * r], [x, cy + Math.sin(a1) * r, cz + Math.cos(a1) * r], [x, cy, cz], WHITE); } }   // dorsal
    const gearF = d.gearF.map(r => [r[0] * 2.0, r[1] * 2.4, ...r.slice(2)]);   // punta ~260 km/h en su modo
    return { ...d, gearF, name: 'F1', vname: 'F1', mesh: K.mb, brake: K.brake, wheels: W, wheelMeshes: M, box: { c: [0, G + 0.35, 0], h: [0.95, 0.3, 2.4] }, interior: null, logoSlot: false,
      brakeSpots: [[0, G + 0.25, 1.71]], nitro: [0, G + 0.3, 1.75], decoParts: [], headPos: [0, G + 0.82, -0.5] };   // solo asoma el casco
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
      quad([-0.72, 1.23, 0.9], [0.72, 1.23, 0.9], [0.72, 1.26, 1.12], [-0.72, 1.26, 1.12], BLACK);   // pequeño alerón en el maletero
      frames(quad, lerpAt, 0.99, P, { strips: [[0.28, 0.36, BLACK], [0.62, 0.85, P]], lines: [[[-0.25, 0.3, 0.62], CHROME, 1, 0.013], [[-0.25, 0.3, 0.62], CHROME, 0, 0.009]], wind: [-0.75, -0.25, 0.06], rear: [0.85, 1.35, 0.07] });   // pilares B (negro) y C (chapa), marcos cromados
      // doble parrilla de riñón: dos óvalos altos cromados, con el interior negro y lamas verticales, en el centro del frontal
      for (const sx of [-1, 1]) { const cx = sx * 0.1, cy = 0.5, hw = 0.075, hh = 0.1, rk = [[1, 1], [0.7, 1.12], [-0.7, 1.12], [-1, 1], [-1, -1], [-0.7, -1.12], [0.7, -1.12], [1, -1]];
        for (const [sc, col, e] of [[1.18, CHROME, 0.006], [1, BLACK, 0.01]]) for (let k = 0; k < rk.length; k++) { const a = rk[k], b = rk[(k + 1) % rk.length], zz = z0 - e;
          tri(g, [cx, cy, zz], [cx + a[0] * hw * sc, cy + a[1] * hh * sc, zz], [cx + b[0] * hw * sc, cy + b[1] * hh * sc, zz], col); tri(g, [cx, cy, zz], [cx + b[0] * hw * sc, cy + b[1] * hh * sc, zz], [cx + a[0] * hw * sc, cy + a[1] * hh * sc, zz], col); }
        for (let k = -2; k <= 2; k++) quad([cx + k * 0.026 - 0.004, cy - hh * 0.95, z0 - 0.013], [cx + k * 0.026 + 0.004, cy - hh * 0.95, z0 - 0.013], [cx + k * 0.026 + 0.004, cy + hh * 0.95, z0 - 0.013], [cx + k * 0.026 - 0.004, cy + hh * 0.95, z0 - 0.013], [0.35, 0.36, 0.38]); }
      quad([-0.76, 0.6, z0 - 0.003], [0.76, 0.6, z0 - 0.003], [0.76, 0.615, z0 - 0.003], [-0.76, 0.615, z0 - 0.003], CHROME); }   // moldura cromada sobre los faros
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
  // ---------- carrocería redondeada (Zeta 35 y Mínimo 50): secciones con puerta abombada, cristales que se curvan hacia dentro y techo con bombeo ----------
  // cada sección: z, w (medio ancho), lo (bajos), belt (cintura), sh (hombro), wt y top (borde y altura del techo), bul (abombado de la puerta),
  // rnd (curva del cristal lateral), crown (bombeo del techo), k (tramo: bumper, hood, wind, roof, hatch, tail, end), sg (cristal lateral: false = chapa)
  function body2(d, G, K, archZ, AR, P, C) {
    const mb = new BRR.MeshBuilder(d.mesh.pal), g = mb.group('COLOR'), brake = new BRR.MeshBuilder(d.mesh.pal), gb = brake.group('COLOR');
    const tri = (q, a, b, c, col) => { for (const v of [a, b, c]) { q.pos.push(v[0], v[1] + G, v[2]); q.col.push(...col); q.lay.push(0); } };
    const quad = (a, b, c, e, col, q = g) => { tri(q, a, b, c, col); tri(q, a, c, e, col); tri(q, a, c, b, col); tri(q, a, e, c, col); };
    const F = ['w', 'lo', 'belt', 'sh', 'wt', 'top', 'bul', 'rnd', 'crown'];
    // entre secciones, curva suave (Catmull-Rom) en vez de recta: la carrocería sale redondeada, sin aristas entre tramos
    const cr = (a, b, c, e, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - e) * t * t + (-a + 3 * b - 3 * c + e) * t * t * t);
    const lerpAt = z => { let i = 0; while (i < K.length - 2 && K[i + 1].z < z) i++; const a = K[i], b = K[i + 1], A0 = K[Math.max(0, i - 1)], B1 = K[Math.min(K.length - 1, i + 2)], t = Math.max(0, Math.min(1, (z - a.z) / (b.z - a.z))), o = { z, k: a.k, sg: a.sg, rg: a.rg };
      for (const f of F) { const v = [A0, a, b, B1].map(q => q[f] || 0); if (f === 'lo' || a.k === 'bumper' || a.k === 'end' || b.k === 'end') { o[f] = v[1] + (v[2] - v[1]) * t; continue; }
        const lo = Math.min(v[1], v[2]) - 0.02, hi = Math.max(v[1], v[2]) + 0.02; o[f] = Math.max(lo, Math.min(hi, cr(v[0], v[1], v[2], v[3], t))); } return o; };
    // secciones cada 8 cm (y las de las llaves); en los pasos de rueda, el borde de abajo sube en arco
    const zs = new Set(K.map(k => k.z)); for (let z = K[0].z; z < K[K.length - 1].z; z += 0.08) zs.add(+z.toFixed(3)); for (const zc of archZ) for (let q = 0; q <= 14; q++) zs.add(+(zc - Math.cos(Math.PI * q / 14) * AR).toFixed(4));
    const S = [...zs].sort((a, b) => a - b).map(z => { const st = lerpAt(z); for (const zc of archZ) { const u = (z - zc) / AR; if (Math.abs(u) < 1) { const h = Math.sqrt(1 - u * u);
      st.lo = Math.max(st.lo, Math.min(st.belt - 0.1, st.lo + (C.archLo + C.archH - st.lo) * h)); st.w += h * (C.flare || 0); } } return st; });
    // un lado de la sección: puntos de control (bajos, puerta abombada, cintura, hombro, cristal curvo, techo) y, entre ellos, puntos de curva
    const ctrl = s => { const wsh = s.w * 0.975; return [[s.w * 0.95, s.lo], [s.w, s.lo + (s.belt - s.lo) * 0.2], [s.w + (s.bul || 0), s.lo + (s.belt - s.lo) * 0.62], [s.w * 0.995, s.belt], [wsh, s.sh],
      [s.wt + (wsh - s.wt) * 0.5 + (s.rnd || 0), s.sh + (s.top - s.sh) * 0.55], [s.wt, s.top], [s.wt * 0.55, s.top + (s.crown || 0) * 0.8], [0, s.top + (s.crown || 0)]]; };
    const TYPE = [0, 1, 1, 1, 3, 3, 4, 4];   // tramo de cada arista de control: bajos, puerta, cristal lateral, techo
    const SMOOTH = new Set([1, 2, 4, 5, 6, 7]);   // aristas que se curvan (la de los bajos y la línea de cintura quedan marcadas)
    const side = s => { const c = ctrl(s), out = [], ty = []; for (let e = 0; e < c.length - 1; e++) { const a = c[Math.max(0, e - 1)], b = c[e], q = c[e + 1], f = c[Math.min(c.length - 1, e + 2)], n = SMOOTH.has(e) ? 3 : 1;
      for (let k = 0; k < n; k++) { const t = k / n; out.push(n === 1 ? b : [cr(a[0], b[0], q[0], f[0], t), cr(a[1], b[1], q[1], f[1], t)]); ty.push(TYPE[e]); } } out.push(c[c.length - 1]); return { pts: out, ty }; };
    const ringOf = s => { const { pts, ty } = side(s), R = [...pts.map(([x, y]) => [x, y, s.z]), ...pts.slice(0, -1).reverse().map(([x, y]) => [-x, y, s.z])], T = [...ty, ...ty.slice().reverse()]; return { R, T }; };
    const colOf = (s, ty) => { const k = s.k; if (ty === 0) return C.LOW;
      if (k === 'bumper' || k === 'end') return ty === 4 ? P : C.bumper || P;
      if (ty === 3) return (k === 'wind' || k === 'roof' || k === 'hatch') && s.sg !== false ? C.GLASS : (k === 'roof' || k === 'hatch') && C.pillar ? C.pillar : P;
      if (ty === 4) return k === 'wind' || (k === 'hatch' && s.rg !== false) ? C.GLASS : k === 'roof' && C.roof ? C.roof : P; return P; };
    const rings = S.map(ringOf);
    for (let i = 0; i < S.length - 1; i++) { const { R: a, T } = rings[i], b = rings[i + 1].R, n = a.length;
      for (let j = 0; j < n - 1; j++) quad(a[j], a[j + 1], b[j + 1], b[j], colOf(S[i], T[j])); quad(a[n - 1], a[0], b[0], b[n - 1], C.LOW); }
    const zA = K[0].z + 0.15, zB = K[K.length - 1].z - 0.15, fy = C.floor;
    quad([-0.62, fy, zA], [0.62, fy, zA], [0.62, fy, zB], [-0.62, fy, zB], C.LOW);
    for (const zc of archZ) for (const sx of [-1, 1]) { const x = sx * 0.5, y = Math.min(C.archLo + C.archH, Math.min(lerpAt(zc - AR).sh, lerpAt(zc).sh, lerpAt(zc + AR).sh) - 0.06); quad([x, fy, zc - AR], [x, fy, zc + AR], [x, y, zc + AR], [x, y, zc - AR], C.LOW); quad([x, y, zc - AR], [x, y, zc + AR], [sx * (C.shelf || 0.84), y, zc + AR], [sx * (C.shelf || 0.84), y, zc - AR], C.LOW); }
    for (const i of [0, S.length - 1]) { const { R: r, T } = rings[i], c0 = [0, (S[i].lo + S[i].sh) / 2, S[i].z], cap = C.cap || P; for (let j = 0; j < r.length; j++) { const a = r[j], b = r[(j + 1) % r.length], col = T[j] === 0 || j >= r.length - 1 ? C.LOW : cap; tri(g, c0, a, b, col); tri(g, c0, b, a, col); } }
    // puntos de la carrocería: u recorre los puntos de control de un lado (0 = bajos … 6 = borde del techo, 8 = centro del techo)
    const at = (z, u) => { const c = ctrl(lerpAt(z)), i = Math.max(0, Math.min(c.length - 2, Math.floor(u))), t = u - i; return [c[i][0] + (c[i + 1][0] - c[i][0]) * t, c[i][1] + (c[i + 1][1] - c[i][1]) * t]; };
    const lift = (p, sx, e) => { const nx = p[0], ny = p[1] - 0.45, l = Math.hypot(nx, ny) || 1; return [sx * (p[0] + nx / l * e), p[1] + ny / l * e]; };
    // parche pegado a la carrocería entre z0 y z1, de u0(z) a u1(z) (faros, pilotos, molduras); e = cuánto sobresale
    const patch = (z0, z1, u0, u1, col, sx, e = 0.012, q = g, n = 6, m = 3) => { const U0 = typeof u0 === 'function' ? u0 : () => u0, U1 = typeof u1 === 'function' ? u1 : () => u1;
      for (let i = 0; i < n; i++) { const za = z0 + (z1 - z0) * i / n, zb = z0 + (z1 - z0) * (i + 1) / n;
        for (let k = 0; k < m; k++) { const ua0 = U0(za) + (U1(za) - U0(za)) * k / m, ua1 = U0(za) + (U1(za) - U0(za)) * (k + 1) / m, ub0 = U0(zb) + (U1(zb) - U0(zb)) * k / m, ub1 = U0(zb) + (U1(zb) - U0(zb)) * (k + 1) / m;
          const A = lift(at(za, ua0), sx, e), Bq = lift(at(za, ua1), sx, e), Cq = lift(at(zb, ub1), sx, e), D = lift(at(zb, ub0), sx, e); quad([A[0], A[1], za], [Bq[0], Bq[1], za], [Cq[0], Cq[1], zb], [D[0], D[1], zb], col, q); } } };
    // pilares: postes finos (no triángulos). edgePost: a lo largo del borde entre cristal lateral y parabrisas/luna/techo; sidePost: de abajo arriba del cristal lateral
    const edgePost = (z0, z1, col, sx, wd = 0.05) => patch(z0, z1, 6 - wd * 6, 6 + wd * 3.2, col, sx, 0.014, g, 8, 2);
    const sidePost = (z, col, sx, wd = 0.07) => patch(z - wd / 2, z + wd / 2, 4, 6.05, col, sx, 0.014, g, 1, 4);
    const glassLine = (z0, z1, col, sx, u = 4, hh = 0.08) => patch(z0, z1, u - hh, u + hh, col, sx, 0.013, g, 10, 1);
    return { mb, g, brake, gb, tri, quad, lerpAt, at, patch, edgePost, sidePost, glassLine };
  }
  const disc = (B, cx, cy, z, r, col, n = 10, face = -1) => { for (let k = 0; k < n; k++) { const a0 = k / n * 6.2832, a1 = (k + 1) / n * 6.2832, c = [cx, cy, z], p0 = [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, z], p1 = [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, z]; B.tri(B.g, c, p0, p1, col); B.tri(B.g, c, p1, p0, col); } };
  // ---------- Zeta 35: coupé japonés de los 2000, todo curvas: capó bajo entre aletas altas, techo en arco hasta una cola corta;
  //            faros alargados en las esquinas delanteras (de la cara del morro hacia la aleta) y pilotos en punta que envuelven la cola ----------
  function zeta(d, P, gl) {
    const G = -0.66, BLACK = [0.05, 0.05, 0.06], TRIM = [0.12, 0.12, 0.13], LENS = [0.86, 0.89, 0.92], CHR = [0.7, 0.72, 0.76], RED = [0.82, 0.05, 0.04], AMB = [0.95, 0.55, 0.1];
    const K = [
      { z: -2.16, w: 0.78, lo: 0.2, belt: 0.3, sh: 0.38, wt: 0.6, top: 0.38, k: 'bumper' },
      { z: -2.06, w: 0.87, lo: 0.17, belt: 0.36, sh: 0.5, wt: 0.6, top: 0.47, bul: 0.02, rnd: 0.03, crown: -0.01, k: 'hood' },
      { z: -1.7, w: 0.93, lo: 0.16, belt: 0.44, sh: 0.62, wt: 0.62, top: 0.58, bul: 0.03, rnd: 0.035, crown: -0.01, k: 'hood' },
      { z: -1.2, w: 0.93, lo: 0.16, belt: 0.48, sh: 0.66, wt: 0.66, top: 0.64, bul: 0.03, rnd: 0.02, crown: 0.0, k: 'hood' },
      { z: -0.95, w: 0.93, lo: 0.16, belt: 0.5, sh: 0.68, wt: 0.74, top: 0.68, bul: 0.03, crown: 0.02, k: 'wind' },
      { z: -0.5, w: 0.93, lo: 0.16, belt: 0.51, sh: 0.7, wt: 0.68, top: 0.94, bul: 0.032, rnd: 0.02, crown: 0.045, k: 'wind' },
      { z: -0.12, w: 0.92, lo: 0.16, belt: 0.53, sh: 0.73, wt: 0.6, top: 1.1, bul: 0.035, rnd: 0.03, crown: 0.06, k: 'roof' },
      { z: 0.28, w: 0.92, lo: 0.16, belt: 0.54, sh: 0.75, wt: 0.6, top: 1.11, bul: 0.035, rnd: 0.03, crown: 0.06, k: 'roof' },
      { z: 0.55, w: 0.93, lo: 0.16, belt: 0.55, sh: 0.76, wt: 0.62, top: 1.06, bul: 0.04, rnd: 0.025, crown: 0.055, k: 'hatch' },
      { z: 0.95, w: 0.95, lo: 0.16, belt: 0.56, sh: 0.78, wt: 0.66, top: 0.98, bul: 0.045, rnd: 0.015, crown: 0.045, k: 'hatch', sg: false },
      { z: 1.58, w: 0.95, lo: 0.17, belt: 0.59, sh: 0.82, wt: 0.78, top: 0.85, bul: 0.045, crown: 0.03, k: 'tail' },
      { z: 1.92, w: 0.9, lo: 0.2, belt: 0.57, sh: 0.8, wt: 0.8, top: 0.81, bul: 0.02, crown: 0.02, k: 'bumper' },
      { z: 2.08, w: 0.82, lo: 0.25, belt: 0.5, sh: 0.66, wt: 0.74, top: 0.66, k: 'end' }];
    const archZ = [-1.3, 1.25], AR = 0.42;
    const B = body2(d, G, K, archZ, AR, P, { LOW: BLACK, GLASS: gl || [0.08, 0.11, 0.15], archLo: 0.28, archH: 0.35, flare: 0.045, floor: 0.3, shelf: 0.86 });
    const { quad, tri, g, gb } = B, z0 = -2.165, zr = 2.085;
    for (const sx of [-1, 1]) {
      // pilares: A del color del coche (poste fino junto al parabrisas), separador negro de la ventanilla trasera, C ancho de chapa; marco negro del cristal
      B.edgePost(-0.95, -0.12, P, sx, 0.045); B.sidePost(0.55, TRIM, sx, 0.05); B.edgePost(0.55, 1.5, P, sx, 0.04);
      B.glassLine(-0.95, 0.95, TRIM, sx, 6, 0.06); B.glassLine(-0.9, 0.95, TRIM, sx, 4, 0.05);
      // faro alargado en la esquina: nace en la cara del morro y sube estrechándose por el borde de la aleta (cristal claro, dos proyectores y borde cromado)
      const fu0 = z => 2.4 + (z + 2.12) / 0.4 * 1.3, fu1 = z => 5.1 - (z + 2.12) / 0.4 * 0.7;
      B.patch(-2.13, -1.72, z => fu0(z) - 0.12, z => fu1(z) + 0.12, CHR, sx, 0.011, g, 8, 3);
      B.patch(-2.12, -1.73, fu0, fu1, LENS, sx, 0.017, g, 8, 4);
      B.patch(-2.08, -1.98, 3.2, 3.9, CHR, sx, 0.022, g, 3, 2); B.patch(-1.96, -1.86, 3.7, 4.3, CHR, sx, 0.022, g, 3, 2);
      B.patch(-2.13, -2.07, 1.3, 2.2, AMB, sx, 0.016, g, 2, 2);   // intermitente bajo el faro
      // piloto trasero: alargado y en punta, envolviendo la esquina; centro cromado
      const tu0 = z => 3.5 - (z - 1.6) / 0.45 * 0.6, tu1 = z => 4.2 + (z - 1.6) / 0.45 * 0.4;
      B.patch(1.6, 2.05, tu0, tu1, RED, sx, 0.016, g, 8, 3); B.patch(1.6, 2.05, tu0, tu1, [1, 0.15, 0.1], sx, 0.02, gb, 8, 3);
      B.patch(1.75, 2.0, 3.85, 3.95, CHR, sx, 0.024, g, 4, 1);
      // tirador vertical de la puerta, espejo y escapes
      B.patch(0.3, 0.36, 3.1, 3.7, CHR, sx, 0.016, g, 1, 2);
      quad([sx * 0.9, 0.78, -0.82], [sx * 1.04, 0.79, -0.8], [sx * 1.04, 0.88, -0.76], [sx * 0.9, 0.88, -0.78], P); quad([sx * 0.88, 0.78, -0.84], [sx * 0.9, 0.78, -0.84], [sx * 0.9, 0.88, -0.8], [sx * 0.88, 0.88, -0.8], BLACK);
      for (const x of [0.2, 0.32]) disc(B, sx * x, 0.27, zr + 0.002, 0.05, [0.32, 0.32, 0.34], 10); }
    // boca delantera ancha con rejilla, matrícula y labio sobre el portón
    quad([-0.42, 0.18, z0 - 0.004], [0.42, 0.18, z0 - 0.004], [0.36, 0.33, z0 - 0.004], [-0.36, 0.33, z0 - 0.004], BLACK);
    for (let y = 0.21; y < 0.32; y += 0.035) quad([-0.4, y, z0 - 0.007], [0.4, y, z0 - 0.007], [0.4, y + 0.008, z0 - 0.007], [-0.4, y + 0.008, z0 - 0.007], TRIM);
    quad([-0.22, 0.4, zr + 0.004], [0.22, 0.4, zr + 0.004], [0.22, 0.52, zr + 0.004], [-0.22, 0.52, zr + 0.004], [0.9, 0.9, 0.85]);
    quad([-0.66, 0.87, 1.6], [0.66, 0.87, 1.6], [0.66, 0.91, 1.76], [-0.66, 0.91, 1.76], P);
    const W = d.wheels.map(w => ({ ...w, c: [Math.sign(w.c[0]) * 0.76, w.c[1], w.c[2] < 0 ? archZ[0] : archZ[1]] }));
    const gearF = d.gearF.map(r => [r[0] * 1.5, r[1] * 2.0, ...r.slice(2)]);
    return { ...d, gearF, name: 'ZETA35', vname: 'ZETA35', mesh: B.mb, brake: B.brake, wheels: W, box: { c: [0, 0.06, 0], h: [0.94, 0.5, 2.1] }, interior: null, logoSlot: false,
      brakeSpots: [[-0.6, 0.69 + G, zr], [0.6, 0.69 + G, zr]], nitro: [0.26, 0.27 + G, zr], decoParts: [], headPos: null };
  }
  // ---------- Mínimo 50 (utilitario británico de 2001), hecho de cero con las medidas, ruedas y físicas del Mini del juego ----------
  //  Silueta de «caja» con las ruedas en las esquinas: capó corto que baja al morro, faros redondos grandes en las esquinas del capó,
  //  parabrisas inclinado, techo blanco plano que parece flotar (todos los pilares negros), luna trasera casi vertical, pasos de rueda
  //  y faldones de plástico negro, cintura con moldura cromada, pilotos verticales en las esquinas del portón y llantas de aleación plateadas
  function alloy(pal, r, hw) {
    const mb = new BRR.MeshBuilder(pal), g = mb.group('COLOR'), N = 24, T = (a, b, c, k) => { for (const v of [a, b, c, a, c, b]) { g.pos.push(...v); g.col.push(...k); g.lay.push(0); } };
    const P = (x, rr, a) => [x, Math.cos(a) * rr, Math.sin(a) * rr], Q = (a, b, c, d, k) => { T(a, b, c, k); T(a, c, d, k); };
    const TYRE = [0.06, 0.06, 0.065], WALL = [0.1, 0.1, 0.11], LIP = [0.86, 0.87, 0.89], SIL = [0.72, 0.74, 0.77], DARK = [0.08, 0.08, 0.09], HUB = [0.55, 0.56, 0.6];
    const rr = r * 0.68, rh = r * 0.2;
    for (let i = 0; i < N; i++) { const a0 = i / N * 6.2832, a1 = (i + 1) / N * 6.2832;
      Q(P(-hw, r, a0), P(hw, r, a0), P(hw, r, a1), P(-hw, r, a1), TYRE);
      for (const x of [-hw, hw]) { const s = Math.sign(x);
        Q(P(x, r, a0), P(x * 1.02, r * 0.86, a0), P(x * 1.02, r * 0.86, a1), P(x, r, a1), WALL);   // flanco redondeado
        Q(P(x * 1.02, r * 0.86, a0), P(x, rr, a0), P(x, rr, a1), P(x * 1.02, r * 0.86, a1), WALL);
        Q(P(x * 1.03, rr, a0), P(x * 1.03, rr * 0.9, a0), P(x * 1.03, rr * 0.9, a1), P(x * 1.03, rr, a1), LIP);   // borde de la llanta
        Q(P(x * 0.9, rr * 0.9, a0), P(x * 0.9, rh, a0), P(x * 0.9, rh, a1), P(x * 0.9, rr * 0.9, a1), DARK);   // fondo oscuro entre radios
        Q(P(x * 1.06, rh, a0), P(x * 1.07, 0, a0), P(x * 1.07, 0, a1), P(x * 1.06, rh, a1), HUB); } }
    // cinco radios dobles en estrella, que se ensanchan hacia el borde
    for (let k = 0; k < 5; k++) for (const off of [-0.17, 0.17]) { const a = k / 5 * 6.2832 + off;
      for (const x of [-hw, hw]) { const xx = x * 1.04, w0 = 0.05, w1 = 0.11;
        Q(P(xx, rh, a - w0), P(xx, rr * 0.92, a - w1), P(xx, rr * 0.92, a + w1), P(xx, rh, a + w0), SIL);
        Q(P(xx, rr * 0.92, a - w1), P(x * 0.9, rr * 0.9, a - w1), P(x * 0.9, rr * 0.9, a + w1), P(xx, rr * 0.92, a + w1), SIL.map(v => v * 0.7)); } }
    for (const x of [-hw, hw]) for (let k = 0; k < 5; k++) { const a = (k + 0.5) / 5 * 6.2832, c = P(x * 1.075, rh * 0.55, a); Q([c[0], c[1] - 0.008, c[2] - 0.008], [c[0], c[1] + 0.008, c[2] - 0.008], [c[0], c[1] + 0.008, c[2] + 0.008], [c[0], c[1] - 0.008, c[2] + 0.008], DARK); }   // tuercas
    return mb;
  }
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm3 = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
  // Mínimo 50 con la malla de minimo_data.js (modelo 3D ajustado al tamaño y a las ruedas del Mini del juego)
  function unpackMesh(o) { const b = s => Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer; return { V: new Int16Array(b(o.v)), F: new Uint16Array(b(o.f)), C: new Uint8Array(b(o.c)), sc: o.sc }; }
  function meshCar(pal, o, colOf, brakeCats, one) {
    const { V, F, C, sc } = unpackMesh(o), mb = new BRR.MeshBuilder(pal), g = mb.group('COLOR'), brake = new BRR.MeshBuilder(pal), gb = brake.group('COLOR');
    const yo = o.yOff || 0, vx = i => [V[i * 3] / sc, V[i * 3 + 1] / sc + yo, V[i * 3 + 2] / sc];
    for (let t = 0; t < C.length; t++) { const a = vx(F[t * 3]), b2 = vx(F[t * 3 + 1]), c = vx(F[t * 3 + 2]), col = colOf(C[t]);
      const L = one ? [a, b2, c] : [a, b2, c, a, c, b2];   // one: la malla ya viene con las caras hacia fuera (una sola cara)
      for (const v of L) { g.pos.push(v[0], v[1], v[2]); g.col.push(...col); g.lay.push(0); }
      if (brakeCats && brakeCats.has(C[t])) for (const v of L) { gb.pos.push(v[0], v[1], v[2]); gb.col.push(1, 0.16, 0.1); gb.lay.push(0); } }
    return { mb, brake };
  }
  function minimo(d, P, gl) {
    const M = BRR.MINIMO_MESH; if (!M) return minimoOld(d, P, gl);
    const COL = [P, [0.93, 0.93, 0.91], gl || [0.06, 0.08, 0.1], [0.05, 0.05, 0.055], [0.8, 0.81, 0.84], [0.6, 0.66, 0.74], [0.88, 0.08, 0.06], [0.95, 0.55, 0.12], [0.03, 0.03, 0.035], [0.92, 0.92, 0.88], [0.08, 0.08, 0.09]];
    const body = meshCar(d.mesh.pal, M.body, k => COL[k] || P, new Set([6]), true);
    // ruedas: las del Mini del juego (las del modelo eran demasiado grandes)
    return { ...d, name: 'MINIMO', vname: 'MINIMO', mesh: body.mb, brake: body.brake, interior: null, logoSlot: false,   // ruedas (posición y radio), caja de choque, motor y marchas: las del Mini
      brakeSpots: [[-0.55, -0.05, 1.42], [0.55, -0.05, 1.42]], nitro: [0.2, -0.5, 1.45], decoParts: [], headPos: null };
  }
  function minimoOld(d, P, gl) {
    const G = Math.min(...d.wheels.map(w => w.c[1] - w.radius));   // el suelo bajo las ruedas del Mini del juego
    const BLACK = [0.045, 0.045, 0.05], TRIM = [0.1, 0.1, 0.11], LENS = [0.86, 0.89, 0.92], CHR = [0.82, 0.83, 0.86], RED = [0.7, 0.05, 0.05], AMB = [0.95, 0.55, 0.12], WHITE = [0.93, 0.93, 0.91];
    const SEAM = P.map(v => v * 0.45), GLASS = gl || [0.07, 0.1, 0.12];
    const K = [
      { z: -1.656, w: 0.639, lo: 0.194, belt: 0.352, sh: 0.44, wt: 0.552, top: 0.466, k: 'bumper' },
      { z: -1.606, w: 0.701, lo: 0.176, belt: 0.493, sh: 0.581, wt: 0.604, top: 0.616, bul: 0.0053, crown: 0.0132, k: 'hood' },
      { z: -1.408, w: 0.727, lo: 0.167, belt: 0.598, sh: 0.686, wt: 0.631, top: 0.695, bul: 0.0088, rnd: 0.0044, crown: 0.0176, k: 'hood' },
      { z: -1.077, w: 0.74, lo: 0.167, belt: 0.686, sh: 0.757, wt: 0.622, top: 0.748, bul: 0.0096, crown: 0.0176, k: 'hood' },
      { z: -0.846, w: 0.74, lo: 0.167, belt: 0.722, sh: 0.783, wt: 0.596, top: 0.783, bul: 0.0096, crown: 0.0132, k: 'wind' },
      { z: -0.284, w: 0.74, lo: 0.167, belt: 0.739, sh: 0.792, wt: 0.556, top: 1.223, bul: 0.0096, rnd: 0.0018, crown: 0.0176, k: 'roof' },
      { z: 1.022, w: 0.74, lo: 0.167, belt: 0.774, sh: 0.827, wt: 0.556, top: 1.232, bul: 0.0096, rnd: 0.0018, crown: 0.0176, k: 'roof' },
      { z: 1.137, w: 0.736, lo: 0.176, belt: 0.774, sh: 0.827, wt: 0.547, top: 1.197, bul: 0.0088, crown: 0.0158, sg: false, k: 'hatch' },
      { z: 1.237, w: 0.727, lo: 0.185, belt: 0.757, sh: 0.81, wt: 0.53, top: 0.88, bul: 0.0066, crown: 0.0088, k: 'tail' },
      { z: 1.294, w: 0.71, lo: 0.211, belt: 0.546, sh: 0.634, wt: 0.517, top: 0.581, k: 'bumper' },
      { z: 1.344, w: 0.648, lo: 0.264, belt: 0.44, sh: 0.51, wt: 0.482, top: 0.51, k: 'end' }];
    const fw = d.wheels.find(w => w.c[2] < 0), rw = d.wheels.find(w => w.c[2] > 0), archZ = [fw.c[2], rw.c[2]], AR = fw.radius + 0.085, archTop = fw.radius * 2 + 0.085;
    const B = body2(d, G, K, archZ, AR, P, { LOW: BLACK, GLASS, archLo: 0.2, archH: archTop - 0.2, flare: 0.028, floor: 0.2, roof: WHITE, pillar: BLACK, shelf: 0.72, cap: P });
    const { quad, tri, g, gb, lerpAt } = B, z0 = -1.656, zr = 1.344;
    // disco en cualquier orientación (faros): centro, normal hacia fuera, radio; e = cuánto se adelanta
    const disc3 = (c, n, r, col, e = 0, k = 16) => { const N = norm3(n), U = norm3(cross3(N, [0, 1, 0])), Vv = cross3(U, N), C0 = c.map((v, i) => v + N[i] * e);
      for (let j = 0; j < k; j++) { const a0 = j / k * 6.2832, a1 = (j + 1) / k * 6.2832, p0 = C0.map((v, i) => v + (U[i] * Math.cos(a0) + Vv[i] * Math.sin(a0)) * r), p1 = C0.map((v, i) => v + (U[i] * Math.cos(a1) + Vv[i] * Math.sin(a1)) * r); tri(g, C0, p0, p1, col); tri(g, C0, p1, p0, col); } };
    // arco de cada paso de rueda (el mismo que recorta la carrocería): y del borde de abajo en z
    const archY = (zc, z) => { const u = (z - zc) / AR, s = lerpAt(z); return Math.abs(u) >= 1 ? s.lo : Math.max(s.lo, Math.min(s.belt - 0.1, s.lo + (archTop - s.lo) * Math.sqrt(1 - u * u))); };
    for (const sx of [-1, 1]) {
      // pilares negros (A, B y C) y marco negro de los cristales: el techo blanco queda «flotando»
      B.edgePost(-0.846, -0.284, BLACK, sx, 0.06); B.sidePost(0.12, BLACK, sx, 0.09); B.sidePost(0.86, BLACK, sx, 0.06);
      B.glassLine(-0.84, 1.137, BLACK, sx, 6, 0.06);
      B.glassLine(-0.82, 1.15, CHR, sx, 4, 0.03);   // moldura cromada de la cintura
      // juntas de la puerta (delante y detrás), tirador cromado y tapa de gasolina (derecha)
      B.patch(-0.6, -0.592, 0.6, 4, SEAM, sx, 0.011, g, 1, 4); B.patch(0.42, 0.428, 0.6, 4, SEAM, sx, 0.011, g, 1, 4);
      B.patch(0.24, 0.36, 3.45, 3.62, CHR, sx, 0.015, g, 1, 1);
      if (sx > 0) B.patch(0.62, 0.74, 3.2, 3.62, P.map(v => v * 0.8), sx, 0.013, g, 2, 2);
      // intermitente lateral ámbar en la aleta delantera
      B.patch(-0.98, -0.92, 2.9, 3.15, AMB, sx, 0.014, g, 1, 1);
      // faros: redondos y grandes, en la esquina del capó (aro cromado, cristal claro, reflector y bombilla)
      { const n = [sx * 0.42, 0.3, -1], c = [sx * 0.505, 0.545, -1.648]; for (const [r, col, e] of [[0.104, CHR, 0], [0.09, LENS, 0.006], [0.05, [0.6, 0.62, 0.66], 0.012], [0.022, [1, 1, 0.94], 0.016]]) disc3(c, n, r, col, e, 20);
        // la carcasa del faro: un «tubo» corto que sale del capó (como el original, el faro asoma por delante)
        const nn = Math.hypot(...n), N = n.map(v => v / nn), U = norm3(cross3(N, [0, 1, 0])), Vv = cross3(U, N);
        for (let k = 0; k < 20; k++) { const a0 = k / 20 * 6.2832, a1 = (k + 1) / 20 * 6.2832, P0 = [0, 1, 2].map(i => c[i] + (U[i] * Math.cos(a0) + Vv[i] * Math.sin(a0)) * 0.104), P1 = [0, 1, 2].map(i => c[i] + (U[i] * Math.cos(a1) + Vv[i] * Math.sin(a1)) * 0.104);
          quad(P0, P1, P1.map((v, i) => v - N[i] * 0.06), P0.map((v, i) => v - N[i] * 0.06), P); } }
      // pasos de rueda de plástico negro: banda que sigue el arco, un poco salida
      for (const zc of archZ) { const n = 16;
        for (let i = 0; i < n; i++) { const a0 = Math.PI * i / n, a1 = Math.PI * (i + 1) / n, za = zc - Math.cos(a0) * (AR + 0.005), zb = zc - Math.cos(a1) * (AR + 0.005);
          const ya = archY(zc, za), yb = archY(zc, zb), na = [-Math.cos(a0), Math.sin(a0)], nb = [-Math.cos(a1), Math.sin(a1)], ww = 0.075;
          const fl = z => { const u = (z - zc) / AR; return Math.abs(u) < 1 ? Math.sqrt(1 - u * u) * 0.028 : 0; }, xa = (lerpAt(za).w + fl(za) + 0.045) * sx, xb = (lerpAt(zb).w + fl(zb) + 0.045) * sx, xo = sx * 0.004;
          quad([xa + xo, ya, za], [xb + xo, yb, zb], [xb + xo, yb + nb[1] * ww, zb + nb[0] * ww], [xa + xo, ya + na[1] * ww, za + na[0] * ww], BLACK);
          quad([xa - sx * 0.09, ya, za], [xb - sx * 0.09, yb, zb], [xb + xo, yb, zb], [xa + xo, ya, za], BLACK);
          quad([xa + xo, ya + na[1] * ww, za + na[0] * ww], [xb + xo, yb + nb[1] * ww, zb + nb[0] * ww], [xb - sx * 0.03, yb + nb[1] * (ww + 0.01), zb + nb[0] * (ww + 0.01)], [xa - sx * 0.03, ya + na[1] * (ww + 0.01), za + na[0] * (ww + 0.01)], BLACK); } }
      // faldón negro entre las ruedas y por debajo de los paragolpes
      B.patch(archZ[0] + AR - 0.02, archZ[1] - AR + 0.02, 0, 0.95, BLACK, sx, 0.03, g, 6, 2); B.patch(z0 + 0.02, archZ[0] - AR + 0.02, 0, 0.6, BLACK, sx, 0.02, g, 3, 2); B.patch(archZ[1] + AR - 0.02, zr - 0.03, 0, 0.6, BLACK, sx, 0.02, g, 3, 2);
      B.patch(-0.27, 1.13, 5.86, 6.3, WHITE, sx, 0.016, g, 14, 2);   // canto blanco del techo
      // pilotos traseros: verticales, en las esquinas del portón, con marco cromado (y el brillo de freno)
      const tx0 = 0.47, tx1 = 0.635, ty0 = 0.5, ty1 = 0.8, ze = zr - 0.002;
      quad([sx * (tx0 - 0.012), ty0 - 0.012, ze], [sx * (tx1 + 0.008), ty0 - 0.012, ze], [sx * (tx1 + 0.008), ty1 + 0.012, ze], [sx * (tx0 - 0.012), ty1 + 0.012, ze], CHR);
      quad([sx * tx0, ty0, ze + 0.004], [sx * tx1, ty0, ze + 0.004], [sx * (tx1 - 0.01), ty1, ze + 0.004], [sx * (tx0 + 0.02), ty1, ze + 0.004], RED);
      quad([sx * tx0, ty0, ze + 0.008], [sx * tx1, ty0, ze + 0.008], [sx * (tx1 - 0.01), ty1, ze + 0.008], [sx * (tx0 + 0.02), ty1, ze + 0.008], [1, 0.16, 0.1], gb);
      quad([sx * (tx0 + 0.03), 0.6, ze + 0.006], [sx * (tx1 - 0.03), 0.6, ze + 0.006], [sx * (tx1 - 0.03), 0.64, ze + 0.006], [sx * (tx0 + 0.03), 0.64, ze + 0.006], [0.92, 0.92, 0.9]);   // marcha atrás
      // espejos blancos como el techo, con el soporte negro
      const mz = -0.74, my = 0.84;
      quad([sx * 0.74, my, mz], [sx * 0.82, my, mz + 0.02], [sx * 0.82, my + 0.04, mz + 0.02], [sx * 0.74, my + 0.04, mz], BLACK);
      quad([sx * 0.8, my - 0.04, mz - 0.03], [sx * 0.93, my - 0.035, mz], [sx * 0.93, my + 0.08, mz], [sx * 0.8, my + 0.085, mz - 0.03], WHITE);
      quad([sx * 0.8, my - 0.04, mz + 0.05], [sx * 0.93, my - 0.035, mz + 0.04], [sx * 0.93, my + 0.08, mz + 0.04], [sx * 0.8, my + 0.085, mz + 0.05], BLACK);
      quad([sx * 0.8, my - 0.04, mz - 0.03], [sx * 0.93, my - 0.035, mz], [sx * 0.93, my - 0.035, mz + 0.04], [sx * 0.8, my - 0.04, mz + 0.05], WHITE);
      quad([sx * 0.8, my + 0.085, mz - 0.03], [sx * 0.93, my + 0.08, mz], [sx * 0.93, my + 0.08, mz + 0.04], [sx * 0.8, my + 0.085, mz + 0.05], WHITE);
      quad([sx * 0.93, my - 0.035, mz], [sx * 0.93, my + 0.08, mz], [sx * 0.93, my + 0.08, mz + 0.04], [sx * 0.93, my - 0.035, mz + 0.04], WHITE); }
    // morro: rejilla de arriba (marco cromado en arco y lamas horizontales), barra cromada, toma de abajo con malla, antinieblas e intermitentes redondos, matrícula
    const fz = z0 - 0.003;
    const grill = (x0, x1, y0, y1, col, e, arc) => { const n = 10; for (let i = 0; i < n; i++) { const xa = x0 + (x1 - x0) * i / n, xb = x0 + (x1 - x0) * (i + 1) / n, ca = arc * (1 - ((xa / x1) ** 2)), cb = arc * (1 - ((xb / x1) ** 2)); quad([xa, y0, fz - e], [xb, y0, fz - e], [xb, y1 + cb, fz - e], [xa, y1 + ca, fz - e], col); } };
    grill(-0.29, 0.29, 0.345, 0.44, CHR, 0.002, 0.03); grill(-0.265, 0.265, 0.36, 0.425, BLACK, 0.005, 0.026);
    for (let y = 0.37; y < 0.45; y += 0.016) quad([-0.25, y, fz - 0.008], [0.25, y, fz - 0.008], [0.25, y + 0.006, fz - 0.008], [-0.25, y + 0.006, fz - 0.008], CHR.map(v => v * 0.85));
    quad([-0.3, 0.315, fz - 0.004], [0.3, 0.315, fz - 0.004], [0.3, 0.333, fz - 0.004], [-0.3, 0.333, fz - 0.004], CHR);
    quad([-0.36, 0.205, fz - 0.003], [0.36, 0.205, fz - 0.003], [0.32, 0.29, fz - 0.003], [-0.32, 0.29, fz - 0.003], BLACK);
    for (let x = -0.34; x < 0.34; x += 0.04) quad([x, 0.215, fz - 0.006], [x + 0.008, 0.215, fz - 0.006], [x + 0.008, 0.28, fz - 0.006], [x, 0.28, fz - 0.006], TRIM);
    quad([-0.17, 0.25, fz - 0.009], [0.17, 0.25, fz - 0.009], [0.17, 0.3, fz - 0.009], [-0.17, 0.3, fz - 0.009], [0.93, 0.93, 0.9]);
    for (const sx of [-1, 1]) { disc(B, sx * 0.47, 0.26, fz - 0.004, 0.042, CHR, 12); disc(B, sx * 0.47, 0.26, fz - 0.007, 0.032, LENS, 12); disc(B, sx * 0.44, 0.36, fz - 0.004, 0.03, AMB, 12); }
    // portón: hueco de la matrícula con moldura cromada, barra cromada en el paragolpes, faldón negro, limpiaparabrisas y escapes dobles
    const re = zr + 0.003;
    quad([-0.25, 0.43, re], [0.25, 0.43, re], [0.25, 0.58, re], [-0.25, 0.58, re], CHR); quad([-0.23, 0.44, re + 0.003], [0.23, 0.44, re + 0.003], [0.23, 0.57, re + 0.003], [-0.23, 0.57, re + 0.003], [0.93, 0.93, 0.9]);
    quad([-0.5, 0.36, re], [0.5, 0.36, re], [0.5, 0.385, re], [-0.5, 0.385, re], CHR);
    quad([-0.6, 0.27, re - 0.001], [0.6, 0.27, re - 0.001], [0.6, 0.34, re - 0.001], [-0.6, 0.34, re - 0.001], BLACK);
    quad([-0.012, 0.88, 1.245], [0.24, 0.9, 1.24], [0.24, 0.915, 1.235], [-0.012, 0.895, 1.24], BLACK);
    for (const x of [0.16, 0.24]) disc(B, x, 0.25, re + 0.004, 0.032, [0.4, 0.4, 0.42], 10);
    // antena atrás del techo y tercera luz de freno
    quad([-0.008, 1.24, 0.95], [0.008, 1.24, 0.95], [0.008, 1.55, 1.12], [-0.008, 1.55, 1.12], BLACK);
    quad([-0.1, 1.215, 1.15], [0.1, 1.215, 1.15], [0.1, 1.205, 1.16], [-0.1, 1.205, 1.16], [1, 0.16, 0.1], gb);
    const M = d.wheels.map(w => alloy(d.mesh.pal, w.radius, 0.08));
    return { ...d, name: 'MINIMO', vname: 'MINIMO', mesh: B.mb, brake: B.brake, wheelMeshes: M, interior: null, logoSlot: false,   // ruedas, caja de choque, motor y marchas: las del Mini
      brakeSpots: [[-0.58, 0.68 + G, zr + 0.01], [0.58, 0.68 + G, zr + 0.01]], nitro: [0.2, 0.25 + G, zr], decoParts: [], headPos: null };
  }
  // ---------- GT de carreras ----------
  // ---------- Cívico (modo Kanjo Loop): compacto japonés de los 90. Malla 3D de civico_data.js (modelo de KidBi-Gaming, CC BY 4.0), ruedas del juego ----------
  function civico(d, P, gl) {
    const M = BRR.CIVICO_MESH; if (!M) return gt(d, P, 'CIVICO', gl);
    const G0 = Math.min(...d.wheels.map(w => w.c[1] - w.radius)), COL = M.cols.map((c, k) => k === 0 ? P : k === 1 ? (gl || [0.07, 0.09, 0.12]) : c);
    const body = meshCar(d.mesh.pal, { ...M.body, yOff: G0 }, k => COL[k] || P, null, false);
    const g = body.mb.group('COLOR'), gb = body.brake.group('COLOR');   // pilotos traseros (el modelo los traía pintados del color del coche)
    for (const sx of [-1, 1]) { const Q = [[sx * 0.42, 0.72, 1.945], [sx * 0.8, 0.72, 1.945], [sx * 0.8, 0.9, 1.945], [sx * 0.42, 0.9, 1.945]];
      for (const k of [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]) { const v = Q[k]; g.pos.push(v[0], v[1] + G0, v[2]); g.col.push(0.6, 0.04, 0.03); g.lay.push(2); gb.pos.push(v[0], v[1] + G0, v[2] + 0.004); gb.col.push(1, 0.16, 0.1); gb.lay.push(3); } }
    const W = d.wheels.map(w => ({ ...w, c: [Math.sign(w.c[0]) * 0.74, w.c[1], w.c[2] < 0 ? -1.27 : 1.215] })), gearF = d.gearF.map(r => [r[0] * 1.5, r[1] * 1.95, ...r.slice(2)]);   // punta ~190 km/h
    return { ...d, gearF, name: 'CIVICO', vname: 'CIVICO', mesh: body.mb, brake: body.brake, wheels: W, box: { c: [0, 0.1, -0.07], h: [0.86, 0.5, 2.0] }, interior: null, logoSlot: false,
      brakeSpots: [[-0.6, 0.81 + G0, 1.96], [0.6, 0.81 + G0, 1.96]], nitro: [0.35, 0.22 + G0, 1.95], decoParts: [], headPos: null };
  }
  function gt(d, P, name, gl, variant) {
    if (BRR.GT_MESH) {   // GT con malla 3D (gtmesh_data.js): carrocería del modelo, ruedas del juego
      const G0 = Math.min(...d.wheels.map(w => w.c[1] - w.radius)), GLS = gl || [0.07, 0.09, 0.12];
      const COL = [P, [0.05, 0.05, 0.055], GLS, [0.8, 0.81, 0.84], [0.12, 0.12, 0.13], [0.95, 0.95, 0.88], [0.8, 0.05, 0.04], [0.95, 0.55, 0.12], [0.85, 0.08, 0.06], [0.92, 0.92, 0.9], [0.3, 0.31, 0.34], [0.2, 0.2, 0.22]];
      const body = meshCar(d.mesh.pal, { ...BRR.GT_MESH.body, yOff: G0 }, k => COL[k] || P, new Set([6]), false);
      const W = d.wheels.map(w => ({ ...w, c: [Math.sign(w.c[0]) * 0.8, w.c[1], w.c[2] < 0 ? -1.38 : 1.36] })), gearF = d.gearF.map(r => [r[0] * 1.55, r[1] * 2.0, ...r.slice(2)]);
      return { ...d, gearF, name: 'GT', vname: 'GT', mesh: body.mb, brake: body.brake, wheels: W, box: { c: [0, 0.12, -0.2], h: [0.92, 0.45, 2.17] }, interior: null, logoSlot: false,
        brakeSpots: [[-0.59, 0.69 + G0, 1.98], [0.59, 0.69 + G0, 1.98]], nitro: [0.2, 0.29 + G0, 1.99], decoParts: [], headPos: null };
    }
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
      if (seg === 3) return k === 'roof' || k === 'hatch' || k === 'wind' ? GLASS : P; if (seg === 4) return k === 'wind' || k === 'hatch' ? GLASS : P; return P; };
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
    frames(quad, lerpAt, 0.97, P, { strips: [[0.42, 0.5, BLACK], [0.9, 1.95, P], [-0.55, -0.5, P]], lines: [[[-0.55, -0.2, 0.1], P, 1, 0.03], [[0.1, 0.5, 0.9], BLACK, 1, 0.013]], wind: [-0.55, 0.1, 0.05], rear: [0.75, 1.95, 0.06] });   // pilares B y C, marcos
    const W = d.wheels.map(w => ({ ...w, c: [Math.sign(w.c[0]) * 0.8, w.c[1], w.c[2] < 0 ? -1.38 : 1.36] }));   // (la carrocería va 12 cm más alta que antes: no toca el suelo y las ruedas caben en sus pasos)
    // motor de carreras: más punta y mucho más empuje que el Mini (y en el Grand Prix, todo a escala de GP)
    const gearF = d.gearF.map(r => [r[0] * 1.55, r[1] * 2.0, ...r.slice(2)]);   // punta ~200 km/h en el Grand Prix
    return { ...d, gearF, name, vname: name, mesh: mb, brake, wheels: W, box: { c: [0, 0.12, 0], h: [0.92, 0.45, 2.26] }, interior: null, logoSlot: false,
      brakeSpots: [[-0.6, 0.66 + G, 2.31], [0.6, 0.66 + G, 2.31]], nitro: [0.3, 0.22 + G, 2.32], decoParts: [], headPos: null };   // cerrado: el piloto no se ve (con el techo bajo asomaría la cabeza)
  }
})();
