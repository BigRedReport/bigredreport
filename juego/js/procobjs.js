// Objetos propios del editor de circuitos (no vienen en el juego original), hechos con caras planas al estilo del original:
//  gradas de público, boxes de circuito, emisores de humo de colores y el pórtico de los controles.
// Medidas en metros; el modelo mira hacia +z (el lado que da a la pista), x a lo largo, y hacia arriba.
"use strict";
(function () {
  const BRR = window.BRR;
  // ayudante: caras de color por las dos caras, y triángulos para el choque
  function kit() {
    const mb = new BRR.MeshBuilder(null), g = mb.group('COLOR'), tris = [];
    const tri = (a, b, c, col, solid = true) => { if (solid) tris.push([a, b, c]); for (const o of [[0, 1, 2], [0, 2, 1]]) for (const j of o) { g.pos.push(...[a, b, c][j]); g.col.push(...col); g.lay.push(0); } };
    const quad = (a, b, c, d, col, solid) => { tri(a, b, c, col, solid); tri(a, c, d, col, solid); };
    const box = (x0, y0, z0, x1, y1, z1, col, solid = true, top = col, side = col) => { const V = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
      quad(V[0], V[1], V[2], V[3], side, solid); quad(V[4], V[5], V[6], V[7], col, solid); quad(V[3], V[2], V[6], V[7], top, solid); quad(V[0], V[3], V[7], V[4], side, solid); quad(V[1], V[2], V[6], V[5], side, solid); };
    return { mb, tris, tri, quad, box };
  }
  // números pseudoaleatorios fijos (el público siempre igual)
  const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const CROWD = [[0.85, 0.15, 0.12], [0.12, 0.3, 0.8], [0.95, 0.8, 0.15], [0.95, 0.95, 0.95], [0.15, 0.6, 0.25], [0.9, 0.45, 0.1], [0.55, 0.2, 0.6], [0.2, 0.2, 0.22]];
  function grada() {
    const K = kit(), L = 28, D = 10, N = 7, stepH = 0.9, stepD = D / N, R = rnd(7), concrete = [0.62, 0.62, 0.6], dark = [0.32, 0.33, 0.35], seat = [0.2, 0.3, 0.55];
    for (let i = 0; i < N; i++) { const z1 = D / 2 - i * stepD, z0 = z1 - stepD, y = (i + 1) * stepH; K.box(-L / 2, 0, z0, L / 2, y, z1, concrete, true, seat, dark);   // gradas escalonadas
      for (let x = -L / 2 + 0.6; x < L / 2 - 0.4; x += 0.9) if (R() < 0.82) { const c = CROWD[R() * CROWD.length | 0], hx = x + (R() - 0.5) * 0.2, zz = z0 + stepD * 0.45;   // público
        K.box(hx - 0.22, y, zz - 0.18, hx + 0.22, y + 0.55, zz + 0.18, c, false); K.box(hx - 0.13, y + 0.55, zz - 0.13, hx + 0.13, y + 0.82, zz + 0.13, [0.85, 0.66, 0.5], false); } }
    K.box(-L / 2, 0, -D / 2 - 0.3, L / 2, N * stepH + 3.2, -D / 2, dark);   // pared de atrás
    for (const sx of [-1, 1]) K.box(sx * L / 2 - (sx > 0 ? 0.3 : 0), 0, -D / 2, sx * L / 2 + (sx < 0 ? 0.3 : 0), N * stepH + 1, D / 2, dark);   // laterales
    for (let x = -L / 2 + 1; x <= L / 2 - 1; x += 6.5) K.box(x - 0.15, 0, D / 2 - 0.2, x + 0.15, N * stepH + 4.6, D / 2 + 0.1, [0.75, 0.75, 0.78]);   // postes del techo
    K.box(-L / 2 - 0.5, N * stepH + 4.6, -D / 2 - 0.5, L / 2 + 0.5, N * stepH + 4.9, D / 2 + 1, [0.85, 0.86, 0.88], true, [0.9, 0.9, 0.92], [0.7, 0.1, 0.08]);   // techo con borde rojo
    K.box(-L / 2, 0, D / 2, L / 2, 1.1, D / 2 + 0.25, [0.9, 0.9, 0.9], true, [0.9, 0.9, 0.9], [0.8, 0.1, 0.08]);   // murete delantero
    return K;
  }
  function boxes() {
    const K = kit(), L = 36, D = 12, H = 6, N = 6, wall = [0.88, 0.88, 0.9], stripe = [0.75, 0.08, 0.06], door = [0.12, 0.12, 0.14], glass = [0.15, 0.22, 0.3];
    K.box(-L / 2, 0, -D / 2, L / 2, H, D / 2, wall, true, [0.6, 0.6, 0.62]);
    const w = L / N; for (let i = 0; i < N; i++) { const x0 = -L / 2 + i * w + 0.5, x1 = x0 + w - 1; K.quad([x0, 0.02, D / 2 + 0.02], [x1, 0.02, D / 2 + 0.02], [x1, 3.6, D / 2 + 0.02], [x0, 3.6, D / 2 + 0.02], door, false);   // puertas de cada box
      K.quad([x0 + 0.3, 3.9, D / 2 + 0.03], [x1 - 0.3, 3.9, D / 2 + 0.03], [x1 - 0.3, 4.4, D / 2 + 0.03], [x0 + 0.3, 4.4, D / 2 + 0.03], i % 2 ? [0.95, 0.8, 0.1] : [0.2, 0.45, 0.85], false); }   // cartel de cada equipo
    K.quad([-L / 2, 4.6, D / 2 + 0.03], [L / 2, 4.6, D / 2 + 0.03], [L / 2, 5.2, D / 2 + 0.03], [-L / 2, 5.2, D / 2 + 0.03], stripe, false);
    K.box(-L / 2, H, -D / 2 + 2, L / 2, H + 2.4, D / 2 - 1, wall, true, [0.6, 0.6, 0.62]);   // planta de arriba (control)
    K.quad([-L / 2 + 1, H + 0.5, D / 2 - 0.98], [L / 2 - 1, H + 0.5, D / 2 - 0.98], [L / 2 - 1, H + 2, D / 2 - 0.98], [-L / 2 + 1, H + 2, D / 2 - 0.98], glass, false);
    K.box(-L / 2 - 0.4, H - 0.2, D / 2, L / 2 + 0.4, H, D / 2 + 2.2, [0.8, 0.8, 0.82]);   // visera
    for (let x = -L / 2; x <= L / 2; x += 3) K.quad([x, 0.01, D / 2 + 6], [x + 1.5, 0.01, D / 2 + 6], [x + 1.5, 0.01, D / 2 + 6.4], [x, 0.01, D / 2 + 6.4], [0.95, 0.95, 0.95], false);   // línea del pit lane
    return K;
  }
  function humo(col) {
    const K = kit(); K.box(-0.35, 0, -0.35, 0.35, 0.9, 0.35, [0.25, 0.25, 0.27], true, col); K.box(-0.15, 0.9, -0.15, 0.15, 1.1, 0.15, [0.15, 0.15, 0.16]); return K; }
  // pórtico de un control: dos postes a los lados de la carretera y una viga con franjas (ancho = carretera)
  BRR.gantry = function (width) {
    const K = kit(), h = 5.6, x = width / 2 + 1, red = [0.82, 0.1, 0.08], white = [0.94, 0.94, 0.92], post = [0.3, 0.31, 0.33];
    for (const sx of [-1, 1]) K.box(sx * x - 0.25, 0, -0.25, sx * x + 0.25, h + 0.9, 0.25, post);
    const n = Math.max(4, Math.round(width / 2)); for (let i = 0; i < n; i++) { const a = -x + 2 * x * i / n, b = -x + 2 * x * (i + 1) / n; K.box(a, h, -0.3, b, h + 0.9, 0.3, i % 2 ? red : white, false); }
    return K; };
  const SMOKE = { HUMO_ROJO: [0.95, 0.15, 0.12], HUMO_AZUL: [0.2, 0.45, 1], HUMO_VERDE: [0.2, 0.85, 0.3], HUMO_AMAR: [1, 0.85, 0.15], HUMO_MORADO: [0.7, 0.25, 0.9], HUMO_BLANCO: [0.95, 0.95, 0.95] };
  // registro: etiqueta, huella en el editor (metros: x0, x1, z0, z1) y constructor
  BRR.PROC_OBJS = {
    GRADA: { label: 'Grada de público', fp: [-14.5, 14.5, -5.6, 5.4], build: grada },
    BOXES: { label: 'Boxes (pit lane)', fp: [-18.4, 18.4, -6, 12.6], build: boxes } };
  const SMN = { HUMO_ROJO: 'rojo', HUMO_AZUL: 'azul', HUMO_VERDE: 'verde', HUMO_AMAR: 'amarillo', HUMO_MORADO: 'morado', HUMO_BLANCO: 'blanco' };
  for (const [k, c] of Object.entries(SMOKE)) BRR.PROC_OBJS[k] = { label: 'Humo ' + SMN[k], fp: [-0.4, 0.4, -0.4, 0.4], build: () => humo(c), smoke: c };
})();
