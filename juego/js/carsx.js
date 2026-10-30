// Coches propios (no vienen en el juego original): se montan sobre las físicas, ruedas y sonido de un coche del juego
// y llevan una carrocería hecha aquí, de pocos polígonos, al estilo del original.
//  · PANDA ("Panda 86"): coupé japonés de los 80 de propulsión trasera, faros escamoteables levantados, parte de abajo negra
//    y la de arriba del color elegido (blanca por defecto). De momento solo en el modo drift.
"use strict";
(function () {
  const BRR = window.BRR;
  BRR.CUSTOM_CARS = { PANDA: { base: 'MINI', name: 'Panda 86' } };
  const orig = BRR.loadVehicle;
  BRR.loadVehicle = async function (files, name, lvl, team = 1, extra = {}) {
    const C = BRR.CUSTOM_CARS[String(name).toUpperCase()]; if (!C) return orig(files, name, lvl, team, extra);
    const d = await orig(files, C.base, lvl, team, { ...extra, paint: null, logo: null, logoHi: null });
    const paint = (extra.paint || [238, 238, 234]).map(v => v / 255);
    return panda(d, paint, String(name).toUpperCase());
  };
  // ---------- carrocería ----------
  function panda(d, P, name) {
    const G = -0.72;   // suelo (bajo las ruedas del coche base)
    const BLACK = [0.07, 0.07, 0.08], GLASS = [0.1, 0.13, 0.17], TRIM = [0.18, 0.18, 0.2], RED = [0.75, 0.06, 0.05], AMBER = [0.95, 0.55, 0.1], LENS = [0.95, 0.95, 0.85];
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
    return { ...d, name, vname: name, mesh: mb, brake, wheels: W, box: { c: [0, 0.05, 0], h: [0.82, 0.5, 2.06] }, interior: null, logoSlot: false,
      brakeSpots: [[-0.55, 0.67 + G, 2.12], [0.55, 0.67 + G, 2.12]], nitro: [0.35, 0.3 + G, 2.12], decoParts: [] };
  }
})();
