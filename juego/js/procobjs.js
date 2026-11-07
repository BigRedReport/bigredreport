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
  // cilindro / tronco de cono con n lados (r0 abajo, r1 arriba); tapas opcionales
  function cyl(K, cx, cz, r0, r1, y0, y1, n, col, solid, capTop, capBot) {
    for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      K.quad([cx + c0 * r0, y0, cz + s0 * r0], [cx + c1 * r0, y0, cz + s1 * r0], [cx + c1 * r1, y1, cz + s1 * r1], [cx + c0 * r1, y1, cz + s0 * r1], col, solid);
      if (capTop) K.tri([cx, y1, cz], [cx + c0 * r1, y1, cz + s0 * r1], [cx + c1 * r1, y1, cz + s1 * r1], capTop, false);
      if (capBot) K.tri([cx, y0, cz], [cx + c1 * r0, y0, cz + s1 * r0], [cx + c0 * r0, y0, cz + s0 * r0], capBot, false); } }
  // la torre redonda de un circuito (el "ovni" de Jerez): un platillo de cristal sobre una columna, encima de la recta de meta
  function torre() {
    const K = kit(), N = 28, white = [0.93, 0.93, 0.92], grey = [0.62, 0.63, 0.65], glass = [0.16, 0.28, 0.42], dark = [0.25, 0.26, 0.28];
    cyl(K, 0, -4, 2.6, 2.6, 0, 16, 12, grey, true, null, null);   // columna central (con el ascensor)
    K.box(-1.6, 0, -9.5, 1.6, 15, -6.5, white, true);   // torre de escaleras de atrás
    for (const sx of [-1, 1]) K.box(sx * 7 - 0.5, 0, -9.5, sx * 7 + 0.5, 15.5, -8.5, grey, true);   // dos patas traseras
    cyl(K, 0, -4, 5, 13, 15, 17.5, N, white, false, null, white);   // panza del platillo
    cyl(K, 0, -4, 13, 13.4, 17.5, 20.5, N, glass, false, null, null);   // franja de cristal (salas de autoridades y prensa)
    for (let i = 0; i < N; i += 2) { const a = i / N * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a); K.box(c * 13.45 - 0.15, 17.5, -4 + sn * 13.45 - 0.15, c * 13.45 + 0.15, 20.5, -4 + sn * 13.45 + 0.15, white, false); }   // montantes
    cyl(K, 0, -4, 13.6, 13.6, 20.5, 21.2, N, white, false, null, null);   // borde de arriba
    cyl(K, 0, -4, 13.6, 6, 21.2, 22.6, N, [0.8, 0.81, 0.83], false, null, null);   // tejado
    cyl(K, 0, -4, 3, 3, 22.6, 24.2, 12, white, false, dark, null);   // cabina de arriba
    K.box(-0.12, 24.2, -4.12, 0.12, 28, -3.88, dark, false);   // antena
    return K;
  }
  // pino piñonero (el árbol típico de los circuitos andaluces): tronco y copa ancha
  function pino() {
    const K = kit(), bark = [0.36, 0.26, 0.18], g1 = [0.2, 0.36, 0.16], g2 = [0.26, 0.44, 0.2];
    cyl(K, 0, 0, 0.35, 0.25, 0, 6.2, 6, bark, true, null, null);
    cyl(K, 0, 0, 1.5, 4.2, 5.6, 7.2, 10, g1, false, null, g1); cyl(K, 0, 0, 4.2, 2.6, 7.2, 8.6, 10, g2, false, g2, null);
    return K;
  }
  // valla de circuito (tramo de 7 m): bionda (guardarraíl) doble sobre postes y red de protección encima; choca hasta 3 m de alto.
  // Se dibujan todas juntas (main.js las une en bloques) y se pegan al terreno
  function valla() {
    const K = kit(), L = 3.5, steel = [0.7, 0.72, 0.75], dark = [0.32, 0.33, 0.35], post = [0.45, 0.46, 0.48], net = [0.22, 0.24, 0.26];
    K.box(-L, 0.35, -0.06, L, 0.62, 0.06, steel, false, [0.8, 0.82, 0.85], steel); K.box(-L, 0.7, -0.06, L, 0.95, 0.06, steel, false, [0.8, 0.82, 0.85], steel);   // las dos biondas
    for (const x of [-L + 0.1, 0]) K.box(x - 0.07, 0, -0.16, x + 0.07, 1.0, -0.06, dark, false);   // postes de la bionda
    K.box(L - 0.12, 0, -0.3, L, 3.1, -0.18, post, false);   // poste de la red
    for (const y of [1.4, 2.2, 3.0]) K.box(-L, y, -0.25, L, y + 0.05, -0.22, net, false);   // cables de la red
    for (let x = -L + 0.6; x < L - 0.3; x += 0.7) K.box(x - 0.02, 1.0, -0.25, x + 0.02, 3.05, -0.22, net, false);   // malla (vertical)
    for (const [a, b, c] of [[[-L, 0, 0], [L, 0, 0], [L, 3, 0]], [[-L, 0, 0], [L, 3, 0], [-L, 3, 0]]]) K.tris.push([a, b, c]);   // pared invisible para el choque
    return K;
  }
  // noria de feria (la de Suzuka, al fondo): rueda de ~50 m sobre dos patas en A, radios y cabinas de colores
  function noria() {
    const K = kit(), Rr = 24, C = 28, N = 32, steel = [0.85, 0.86, 0.9], red = [0.85, 0.15, 0.12], leg = [0.7, 0.72, 0.76];
    const P = (a, r, x) => [x, C + Math.sin(a) * r, Math.cos(a) * r];
    for (const x of [-1.2, 1.2]) for (let i = 0; i < N; i++) { const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2;   // los dos aros
      const p0 = P(a0, Rr, x), p1 = P(a1, Rr, x), q0 = P(a0, Rr - 0.7, x), q1 = P(a1, Rr - 0.7, x); K.quad(p0, p1, q1, q0, i % 2 ? steel : red, false); }
    for (let i = 0; i < N / 2; i++) { const a = i / (N / 2) * Math.PI * 2, e = P(a, Rr - 0.4, 0), c0 = [0, C, 0];   // radios
      K.quad([-1.2, C, 0.15], [-1.2, e[1], e[2] + 0.15], [1.2, e[1], e[2] - 0.15], [1.2, C, -0.15], steel, false); }
    cyl(K, 0, 0, 1.6, 1.6, C - 1.6, C + 1.6, 10, red, false, red, red);
    for (let i = 0; i < N; i += 1) { const a = i / N * Math.PI * 2, y = C + Math.sin(a) * Rr - 2.6, z = Math.cos(a) * Rr, col = [[0.95, 0.8, 0.15], [0.2, 0.5, 0.9], [0.9, 0.3, 0.5], [0.3, 0.75, 0.35]][i % 4];   // cabinas
      K.box(-1, y, z - 1, 1, y + 2.2, z + 1, col, false, [0.95, 0.95, 0.95]); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const b = [sx * 7, 0, sz * 13];   // patas en A
      K.quad([b[0] - 0.5, 0, b[2]], [b[0] + 0.5, 0, b[2]], [sx * 1.8 + 0.4, C, 0], [sx * 1.8 - 0.4, C, 0], leg, true); }
    K.box(-9, 0, -16, 9, 3, 16, [0.75, 0.75, 0.78], true, [0.55, 0.56, 0.6]);   // estación de abajo
    return K;
  }
  // "la pagoda" de Indianapolis: torre de cristal de plantas escalonadas con voladizos
  function pagoda() {
    const K = kit(), glass = [0.18, 0.3, 0.45], slab = [0.9, 0.9, 0.92], core = [0.55, 0.56, 0.6];
    K.box(-9, 0, -7, 9, 6, 7, core, true, slab);
    const lv = [[8, 6], [7.5, 5.6], [7, 5.2], [6.5, 4.8], [6, 4.4], [5.4, 4], [4.8, 3.6], [4, 3], [3, 2.4]];
    lv.forEach(([w, d], i) => { const y = 6 + i * 4; K.box(-w, y, -d, w, y + 3.4, d, glass, true, glass); K.box(-w - 1.6, y + 3.4, -d - 1.6, w + 1.6, y + 4, d + 1.6, slab, false); });
    K.box(-0.2, 42, -0.2, 0.2, 50, 0.2, [0.3, 0.3, 0.32], false);
    return K;
  }
  // la "yarda de ladrillos" de la meta de Indianapolis: franja de ladrillo de 0,9 m que cruza la pista (no choca)
  function ladrillos() {
    const K = kit(), W2 = 11.5, D2 = 0.46, y = 0.12, mortar = [0.55, 0.52, 0.48];
    K.quad([-W2, y - 0.005, -D2], [W2, y - 0.005, -D2], [W2, y - 0.005, D2], [-W2, y - 0.005, D2], mortar, false);
    const R = rnd(13), bw = 0.22, bd = 0.1;
    for (let r = 0, z = -D2 + 0.01; z + bd <= D2; r++, z += bd + 0.012) for (let x = -W2 + (r % 2 ? bw / 2 : 0); x + bw <= W2; x += bw + 0.012) {
      const k = 0.85 + R() * 0.3, c = [0.55 * k, 0.24 * k, 0.16 * k]; K.quad([x, y, z], [x + bw, y, z], [x + bw, y, z + bd], [x, y, z + bd], c, false); }
    return K;
  }
  // pasarela sobre la pista (Donington): dos torres a los lados y un puente de vigas a 7 m (para pistas de 20 m)
  function pasarela() {
    const K = kit(), x = 13.5, h = 7, white = [0.92, 0.92, 0.9], red = [0.8, 0.12, 0.1], grey = [0.5, 0.52, 0.55];
    for (const sx of [-1, 1]) { K.box(sx * x - 1.5, 0, -2, sx * x + 1.5, h + 2.6, 2, white, true, grey); }
    K.box(-x, h, -1.6, x, h + 0.5, 1.6, grey, false); for (const sz of [-1.5, 1.5]) K.box(-x, h + 0.5, sz - 0.08, x, h + 1.6, sz + 0.08, white, false);
    const n = 10; for (let i = 0; i < n; i++) { const a = -x + 2 * x * i / n; K.box(a, h - 1.4, -1.7, a + 2 * x / n, h, -1.6, i % 2 ? red : white, false); K.box(a, h - 1.4, 1.6, a + 2 * x / n, h, 1.7, i % 2 ? white : red, false); }   // franjas a cuadros
    return K;
  }
  // árboles de cada zona: de hoja ancha (Inglaterra, EE. UU.), ciprés (Toscana), palmera (Murcia)
  function arbol() { const K = kit(), bark = [0.35, 0.27, 0.2], g = [[0.22, 0.42, 0.18], [0.28, 0.5, 0.22], [0.2, 0.38, 0.16]];
    cyl(K, 0, 0, 0.4, 0.3, 0, 4, 6, bark, true, null, null); cyl(K, 0, 0, 2.4, 3.6, 3.2, 5.6, 9, g[0], false, null, g[0]); cyl(K, 0, 0, 3.6, 2.8, 5.6, 7.8, 9, g[1], false, null, null); cyl(K, 0, 0, 2.8, 0.6, 7.8, 9.6, 9, g[2], false, null, null); return K; }
  function cipres() { const K = kit(), g = [0.13, 0.27, 0.12]; cyl(K, 0, 0, 0.3, 0.25, 0, 1, 6, [0.33, 0.25, 0.18], true, null, null);
    cyl(K, 0, 0, 0.9, 1.4, 0.8, 5, 8, g, false, null, g); cyl(K, 0, 0, 1.4, 0.05, 5, 13, 8, [0.15, 0.3, 0.13], false, null, null); return K; }
  function palmera() { const K = kit(), bark = [0.5, 0.4, 0.28], leaf = [0.3, 0.52, 0.2];
    let px = 0, pz = 0; for (let i = 0; i < 6; i++) { const nx = px + 0.18 * i * 0.25; cyl(K, nx, pz, 0.32 - i * 0.02, 0.3 - i * 0.02, i * 1.4, (i + 1) * 1.4, 6, i % 2 ? bark : [0.45, 0.36, 0.25], i < 2, null, null); px = nx; }
    const top = [px, 8.4, pz]; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a);
      K.tri(top, [top[0] + c * 4.2 - s2 * 0.7, 7.2, top[2] + s2 * 4.2 + c * 0.7], [top[0] + c * 4.2 + s2 * 0.7, 7.2, top[2] + s2 * 4.2 - c * 0.7], leaf, false);
      K.tri([top[0] + c * 4.2 - s2 * 0.7, 7.2, top[2] + s2 * 4.2 + c * 0.7], [top[0] + c * 5.4, 6, top[2] + s2 * 5.4], [top[0] + c * 4.2 + s2 * 0.7, 7.2, top[2] + s2 * 4.2 - c * 0.7], leaf, false); }
    return K; }
  // karting: muro de neumáticos (2,4 m; pilas de 2 ruedas, alguna pintada), barrera de plástico roja y blanca (2 m) y la caseta de control
  function neumat() {
    const K = kit(), blk = [0.09, 0.09, 0.1], cols = [blk, blk, [0.85, 0.12, 0.1], blk, blk, [0.92, 0.92, 0.92]], r = 0.36, h = 0.26;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const x = -0.9 + i * 0.6, y = j * h, c = cols[(i * 2 + j) % 6];
      cyl(K, x, 0, r, r, y, y + h, 6, c, false, j === 1 ? [0.05, 0.05, 0.05] : null, null); }
    K.box(-1.2, 0.18, 0.3, 1.2, 0.42, 0.34, [0.15, 0.15, 0.17], false);   // la cinta que las une
    for (const [a, b, c] of [[[-1.2, 0, 0], [1.2, 0, 0], [1.2, 1, 0]], [[-1.2, 0, 0], [1.2, 1, 0], [-1.2, 1, 0]]]) K.tris.push([a, b, c]);   // pared para el choque
    return K; }
  function barrera() {
    const K = kit(), red = [0.85, 0.12, 0.1], white = [0.93, 0.93, 0.93];
    K.box(-1, 0, -0.25, 0, 0.8, 0.25, red, false, [0.92, 0.2, 0.15]); K.box(0, 0, -0.25, 1, 0.8, 0.25, white, false, [0.98, 0.98, 0.98]);
    for (const [a, b, c] of [[[-1, 0, 0], [1, 0, 0], [1, 0.9, 0]], [[-1, 0, 0], [1, 0.9, 0], [-1, 0.9, 0]]]) K.tris.push([a, b, c]);
    return K; }
  function caseta() {
    const K = kit(), wall = [0.92, 0.9, 0.85], glass = [0.2, 0.32, 0.45], roof = [0.75, 0.15, 0.12], dark = [0.3, 0.3, 0.32];
    K.box(-6, 0, -3, 6, 3, 3, wall, true, wall);   // planta baja
    K.box(-3.5, 3, -2.5, 3.5, 5.6, 2.5, glass, true, glass); K.box(-4, 5.6, -3, 4, 5.9, 3, roof, false, roof, roof);   // cabina de cronometraje
    K.box(-6.3, 3, -3.3, 6.3, 3.2, 3.6, dark, false); for (const x of [-5, -1.8, 1.8, 5]) K.box(x - 0.6, 0.9, 3.01, x + 0.6, 2.1, 3.05, glass, false);
    K.box(-0.06, 5.9, -0.06, 0.06, 8, 0.06, dark, false); K.box(0.06, 7.2, -0.02, 1.4, 8, 0.02, [0.95, 0.95, 0.95], false);   // mástil con bandera
    return K; }
  const SMOKE = { HUMO_ROJO: [0.95, 0.15, 0.12], HUMO_AZUL: [0.2, 0.45, 1], HUMO_VERDE: [0.2, 0.85, 0.3], HUMO_AMAR: [1, 0.85, 0.15], HUMO_MORADO: [0.7, 0.25, 0.9], HUMO_BLANCO: [0.95, 0.95, 0.95] };
  // registro: etiqueta, huella en el editor (metros: x0, x1, z0, z1) y constructor
  BRR.PROC_OBJS = {
    GRADA: { label: 'Grada de público', fp: [-14.5, 14.5, -5.6, 5.4], build: grada },
    BOXES: { label: 'Boxes (pit lane)', fp: [-18.4, 18.4, -6, 12.6], build: boxes },
    TORRE: { label: 'Torre redonda (ovni)', fp: [-13.6, 13.6, -17.6, 9.6], build: torre },
    PINO: { label: 'Pino', fp: [-4.2, 4.2, -4.2, 4.2], build: pino, merge: true },
    VALLA: { label: 'Valla del circuito (7 m)', fp: [-3.5, 3.5, -0.4, 0.4], build: valla, merge: true },
    NORIA: { label: 'Noria', fp: [-9, 9, -24.5, 24.5], build: noria },
    PAGODA: { label: 'Torre de cristal escalonada (pagoda)', fp: [-9.6, 9.6, -7.6, 7.6], build: pagoda },
    LADRILLOS: { label: 'Franja de ladrillos de meta', fp: [-11.5, 11.5, -0.5, 0.5], build: ladrillos },
    PASARELA: { label: 'Pasarela sobre la pista', fp: [-15, 15, -2, 2], build: pasarela },
    ARBOL: { label: 'Árbol', fp: [-3.6, 3.6, -3.6, 3.6], build: arbol, merge: true },
    CIPRES: { label: 'Ciprés', fp: [-1.4, 1.4, -1.4, 1.4], build: cipres, merge: true },
    PALMERA: { label: 'Palmera', fp: [-5.4, 5.4, -5.4, 5.4], build: palmera, merge: true },
    NEUMAT: { label: 'Muro de neumáticos (karting, 2,4 m)', fp: [-1.2, 1.2, -0.4, 0.4], build: neumat, merge: true },
    BARRERA: { label: 'Barrera de plástico (karting, 2 m)', fp: [-1, 1, -0.25, 0.25], build: barrera, merge: true },
    KCASETA: { label: 'Caseta de control (karting)', fp: [-6.3, 6.3, -3.3, 3.6], build: caseta } };
  const SMN = { HUMO_ROJO: 'rojo', HUMO_AZUL: 'azul', HUMO_VERDE: 'verde', HUMO_AMAR: 'amarillo', HUMO_MORADO: 'morado', HUMO_BLANCO: 'blanco' };
  for (const [k, c] of Object.entries(SMOKE)) BRR.PROC_OBJS[k] = { label: 'Humo ' + SMN[k], fp: [-0.4, 0.4, -0.4, 0.4], build: () => humo(c), smoke: c };
})();
