// Destruction Derby: arenas de vigas y losas sobre el mar (a varias alturas). Gana el último que queda arriba; el que cae al agua, fuera.
// Todo se genera aquí: los mapas (piezas), la malla, los choques, los sitios de salida, los objetos y la IA (que sabe por dónde hay suelo).
// El escenario de fondo es el mar abierto de un nivel del juego original (CHOPPER3).
"use strict";
(function () {
  const BRR = window.BRR, DB = BRR.derby = {};
  DB.BASE = 'CHOPPER3'; DB.ORIGIN = [504, -1528];   // centro del mar abierto de ese nivel (un cuadrado de 1 km de agua)
  DB.CARS = ['MINI', 'BEETLE', 'JEEP'];
  const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // ---------- mapas: listas de piezas { a:[x,y,z], b:[x,y,z], w, k } (k: 'v' viga de madera, 'l' losa gris), en metros desde el centro ----------
  const beam = (P, a, b, w = 5, k = 'v') => P.push({ a, b, w, k });
  const slab = (P, x, y, z, sx, sz) => P.push({ a: [x - sx / 2, y, z], b: [x + sx / 2, y, z], w: sz, k: 'l' });
  const ring = (P, r, y, n, w, a0 = 0) => { for (let i = 0; i < n; i++) { const a = a0 + i / n * 6.2832, b = a0 + (i + 1) / n * 6.2832; beam(P, [Math.cos(a) * r, y, Math.sin(a) * r], [Math.cos(b) * r, y, Math.sin(b) * r], w); } };
  const MAPS = [];
  // Telaraña: rejilla abajo, diagonales a media altura que bajan a las esquinas y una viga alta que cruza por encima
  { const P = [], y0 = 8, y1 = 15, y2 = 21;
    for (const x of [-60, 0, 60]) beam(P, [x, y0, -70], [x, y0, 70], 6);
    for (const z of [-70, 0, 70]) beam(P, [-60, y0, z], [60, y0, z], 6);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { beam(P, [0, y1, 0], [45 * sx, y1, 45 * sz], 5.5); beam(P, [45 * sx, y1, 45 * sz], [60 * sx, y0, 70 * sz], 5.5); }
    slab(P, 0, y1, 0, 16, 16);
    beam(P, [0, y2, -22], [0, y2, 22], 5); for (const s of [-1, 1]) beam(P, [0, y2, 22 * s], [0, y0, 70 * s], 5);
    for (const [x, z] of [[-60, -70], [60, -70], [-60, 70], [60, 70], [-60, 0], [60, 0]]) slab(P, x, y0, z, 13, 13);
    MAPS.push({ id: 'telarana', name: 'Telaraña', desc: 'Vigas estrechas a tres alturas', P }); }
  // Cruz: plano y ancho, para empezar
  { const P = [], y = 8; beam(P, [-75, y, 0], [75, y, 0], 9); beam(P, [0, y, -75], [0, y, 75], 9); slab(P, 0, y, 0, 28, 28);
    for (const [x, z] of [[-75, 0], [75, 0], [0, -75], [0, 75]]) slab(P, x, y, z, 20, 20);
    MAPS.push({ id: 'cruz', name: 'Cruz', desc: 'Plano y ancho: el clásico', P }); }
  // Anillos: tres anillos, cada uno más alto hacia el centro, unidos por rampas
  { const P = [], Y = [8, 11.5, 15], Rr = [78, 52, 26];
    ring(P, Rr[0], Y[0], 20, 6); ring(P, Rr[1], Y[1], 14, 5.5, 0.2); ring(P, Rr[2], Y[2], 10, 5);
    for (let i = 0; i < 4; i++) { const a = i / 4 * 6.2832 + 0.4, c = Math.cos(a), s = Math.sin(a); beam(P, [c * Rr[0], Y[0], s * Rr[0]], [c * Rr[1], Y[1], s * Rr[1]], 5); }
    for (let i = 0; i < 3; i++) { const a = i / 3 * 6.2832 + 1.2, c = Math.cos(a), s = Math.sin(a); beam(P, [c * Rr[1], Y[1], s * Rr[1]], [c * Rr[2], Y[2], s * Rr[2]], 5); }
    beam(P, [-Rr[2], Y[2], 0], [Rr[2], Y[2], 0], 4.5);
    MAPS.push({ id: 'anillos', name: 'Anillos', desc: 'Tres anillos, cada uno más alto', P }); }
  // Torres: tres plazas a distinta altura unidas por pasarelas y un anillo bajo alrededor
  { const P = [], T = [[-55, 8, 35], [55, 13, 35], [0, 18, -55]];
    for (const [x, y, z] of T) slab(P, x, y, z, 30, 30);
    for (let i = 0; i < 3; i++) { const a = T[i], b = T[(i + 1) % 3]; beam(P, [a[0], a[1], a[2]], [b[0], b[1], b[2]], 4.5); }
    ring(P, 95, 8, 18, 5, 0.1);
    beam(P, [-55, 8, 35], [-95 * Math.cos(0.35), 8, 95 * Math.sin(0.35)], 4.5);
    beam(P, [55, 13, 35], [95 * Math.cos(0.36), 8, 95 * Math.sin(0.36)], 4.5); beam(P, [0, 18, -55], [0, 8, -95], 4.5);
    MAPS.push({ id: 'torres', name: 'Torres', desc: 'Tres plazas unidas por pasarelas', P }); }
  // Parrilla: rejilla densa de vigas muy estrechas, todo huecos
  { const P = [], y = 8, L = [-64, -32, 0, 32, 64];
    for (const x of L) beam(P, [x, y, -64], [x, y, 64], 4.2); for (const z of L) beam(P, [-64, y, z], [64, y, z], 4.2);
    slab(P, 0, y, 0, 14, 14); for (const [x, z] of [[-64, -64], [64, -64], [-64, 64], [64, 64]]) slab(P, x, y, z, 11, 11);
    MAPS.push({ id: 'parrilla', name: 'Parrilla', desc: 'Vigas muy estrechas y todo huecos', P }); }
  DB.MAPS = MAPS; DB.levelOf = m => DB.BASE + '~dby-' + m.id;
  DB.mapOf = level => { const id = String(level || '').split('~')[1] || ''; return id.startsWith('dby-') ? MAPS.find(m => 'dby-' + m.id === id) || null : null; };

  // vista desde arriba (tarjeta del mapa): más claro cuanto más alto
  DB.preview = m => { const cv = document.createElement('canvas'); cv.width = 320; cv.height = 200; const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 200); gr.addColorStop(0, '#0b2a3a'); gr.addColorStop(1, '#06202c'); g.fillStyle = gr; g.fillRect(0, 0, 320, 200);
    g.strokeStyle = 'rgba(120,190,220,.10)'; for (let y = 8; y < 200; y += 12) { g.beginPath(); for (let x = 0; x <= 320; x += 16) g.lineTo(x, y + Math.sin(x * 0.08 + y) * 2); g.stroke(); }
    let R = 1; for (const p of m.P) for (const q of [p.a, p.b]) R = Math.max(R, Math.abs(q[0]) + p.w / 2, Math.abs(q[2]) + p.w / 2); const s = 92 / R;
    const ys = m.P.map(p => (p.a[1] + p.b[1]) / 2), y0 = Math.min(...ys), y1 = Math.max(...ys) + 0.01;
    for (const p of m.P.slice().sort((a, b) => (a.a[1] + a.b[1]) - (b.a[1] + b.b[1]))) { const t = ((p.a[1] + p.b[1]) / 2 - y0) / (y1 - y0), wood = p.k === 'v';
      g.strokeStyle = wood ? `rgb(${110 + 90 * t | 0},${72 + 62 * t | 0},${38 + 40 * t | 0})` : `rgb(${120 + 70 * t | 0},${124 + 70 * t | 0},${130 + 70 * t | 0})`; g.lineWidth = Math.max(2, p.w * s); g.lineCap = 'butt';
      g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 5; g.shadowOffsetY = 2 + t * 4; g.beginPath(); g.moveTo(160 + p.a[0] * s, 100 + p.a[2] * s); g.lineTo(160 + p.b[0] * s, 100 + p.b[2] * s); g.stroke(); }
    return cv.toDataURL('image/jpeg', 0.85); };

  // ---------- instalación en el nivel: piezas en coordenadas del mundo, suelo, grafo para la IA, salidas y objetos ----------
  DB.install = function (lvl, map) {
    const ox = DB.ORIGIN[0], oz = DB.ORIGIN[1], wy = lvl.terrain(ox, oz), EXT = 0.5;
    // las rampas empiezan en el borde de la pieza a la que llegan (no en su centro, que dejaba un escalón)
    const on = (q, x, z) => { const dx = q.b[0] - q.a[0], dz = q.b[2] - q.a[2], L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, rx = x - q.a[0], rz = z - q.a[2], t = rx * ux + rz * uz, e = q.k === 'l' ? 0 : Math.min(EXT * q.w, 3);
      if (t < -e || t > L + e || Math.abs(rx * uz - rz * ux) > q.w / 2) return null; return q.a[1] + (q.b[1] - q.a[1]) * Math.max(0, Math.min(1, t / L)); };
    const P0 = map.P.map(p => ({ ...p, a: p.a.slice(), b: p.b.slice() }));
    for (const p of P0) { if (Math.abs(p.b[1] - p.a[1]) < 0.1) continue; for (const [E, O] of [[p.a, p.b], [p.b, p.a]]) { const L = Math.hypot(O[0] - E[0], O[2] - E[2]), ux = (O[0] - E[0]) / L, uz = (O[2] - E[2]) / L;
        for (const q of P0) { if (q === p || Math.abs(q.b[1] - q.a[1]) > 0.1) continue; const y = on(q, E[0], E[2]); if (y == null || Math.abs(y - E[1]) > 0.4) continue;
          let d = 0; while (d < 20 && on(q, E[0] + ux * (d + 0.25), E[2] + uz * (d + 0.25)) != null) d += 0.25; d = Math.max(0, d - 0.4); E[0] += ux * d; E[2] += uz * d; break; } } }
    const PC = P0.map(p => { const a = [ox + p.a[0], wy + p.a[1], oz + p.a[2]], b = [ox + p.b[0], wy + p.b[1], oz + p.b[2]], dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, e = p.k === 'l' ? 0 : Math.min(EXT * p.w, 3);
      return { a, b, w: p.w, k: p.k, L, ux: dx / L, uz: dz / L, e: Math.abs(b[1] - a[1]) > 0.1 ? 0.4 : e, sl: (b[1] - a[1]) / L }; });
    // altura del suelo en (x, z): la pieza más alta que quede por debajo de yMax (o null si ahí no hay nada: agua)
    const floor = (x, z, yMax = 1e9, mg = 0) => { let best = null; for (const p of PC) { const rx = x - p.a[0], rz = z - p.a[2], t = rx * p.ux + rz * p.uz; if (t < -p.e + mg || t > p.L + p.e - mg) continue; const l = Math.abs(rx * p.uz - rz * p.ux); if (l > p.w / 2 - mg) continue;
        const y = p.a[1] + p.sl * Math.max(0, Math.min(p.L, t)); if (y <= yMax + 1 && (best == null || y > best)) best = y; } return best; };
    // la pieza que hay bajo (x, z) a esa altura, con la distancia lateral (con signo) a su eje
    const under = (x, z, y) => { let best = null, by = -1e9; for (const p of PC) { const rx = x - p.a[0], rz = z - p.a[2], t = rx * p.ux + rz * p.uz; if (t < -p.e - 0.5 || t > p.L + p.e + 0.5) continue; const l = rx * p.uz - rz * p.ux; if (Math.abs(l) > p.w / 2 + 1.2) continue;
        const py = p.a[1] + p.sl * Math.max(0, Math.min(p.L, t)); if (py > y + 1 || py < y - 2.5 || py <= by) continue; by = py; best = { p, l, t }; } return best; };
    // grafo: un nodo cada ~5 m por el eje de cada pieza; se unen los seguidos y los de piezas que se tocan a la misma altura
    const N = [], adj = [];
    PC.forEach((p, pi) => { const n = Math.max(1, Math.round(p.L / 5)); p.n0 = N.length; for (let i = 0; i <= n; i++) { const t = i / n * p.L; N.push({ p: [p.a[0] + p.ux * t, p.a[1] + p.sl * t, p.a[2] + p.uz * t], w: p.w, pi, ramp: Math.abs(p.sl) > 0.03, end: Math.min(t, p.L - t) + p.e }); adj.push([]); if (i) { adj[N.length - 1].push(N.length - 2); adj[N.length - 2].push(N.length - 1); } } p.n1 = N.length - 1; });
    const link = (i, j) => { if (i !== j && !adj[i].includes(j)) { adj[i].push(j); adj[j].push(i); } };
    for (let i = 0; i < N.length; i++) { const a = N[i]; for (let pj = 0; pj < PC.length; pj++) { if (pj === a.pi) continue; const p = PC[pj], rx = a.p[0] - p.a[0], rz = a.p[2] - p.a[2], t = rx * p.ux + rz * p.uz; if (t < -p.e || t > p.L + p.e) continue;
        if (Math.abs(rx * p.uz - rz * p.ux) > p.w / 2 + 0.5) continue; const y = p.a[1] + p.sl * Math.max(0, Math.min(p.L, t)); if (Math.abs(y - a.p[1]) > 0.7) continue;
        let bj = -1, bd = 1e9; for (let j = p.n0; j <= p.n1; j++) { const d = Math.hypot(N[j].p[0] - a.p[0], N[j].p[2] - a.p[2]); if (d < bd) { bd = d; bj = j; } } if (bj >= 0) link(i, bj); } }
    const nearest = (q, yTol = 2.2) => { let b = -1, bd = 1e9; for (let i = 0; i < N.length; i++) { const n = N[i], dy = Math.abs(n.p[1] - q[1]); if (dy > yTol) continue; const d = (n.p[0] - q[0]) ** 2 + (n.p[2] - q[2]) ** 2 + dy * dy * 4; if (d < bd) { bd = d; b = i; } } return b; };
    const prev = new Int32Array(N.length), queue = new Int32Array(N.length);
    const dist = to => { const d = new Int32Array(N.length).fill(1e6); if (to < 0) return d; d[to] = 0; let qh = 0, qt = 0; queue[qt++] = to; while (qh < qt) { const c = queue[qh++]; for (const o of adj[c]) if (d[o] > d[c] + 1) { d[o] = d[c] + 1; queue[qt++] = o; } } return d; };
    const path = (from, to) => { if (from < 0 || to < 0) return null; prev.fill(-2); prev[to] = -1; let qh = 0, qt = 0; queue[qt++] = to;   // desde el destino: así prev[] da el siguiente paso
      while (qh < qt) { const c = queue[qh++]; if (c === from) break; for (const o of adj[c]) if (prev[o] === -2) { prev[o] = c; queue[qt++] = o; } }
      if (prev[from] === -2) return null; const out = [from]; let c = from; while (prev[c] >= 0 && out.length < 400) { c = prev[c]; out.push(c); } return out; };
    // salidas: nodos llanos bien repartidos (el más lejano de los ya elegidos cada vez), mirando hacia donde sigue la viga hacia el centro
    const flat = N.map((n, i) => i).filter(i => !N[i].ramp && N[i].end >= 6), spawns = [], R0 = rnd(map.P.length * 977 + 13);
    let cur = flat[Math.floor(R0() * flat.length)];
    for (let k = 0; k < 16 && flat.length; k++) { const n = N[cur], p = PC[n.pi], toC = (ox - n.p[0]) * p.ux + (oz - n.p[2]) * p.uz, sg = toC >= 0 ? 1 : -1; spawns.push({ p: n.p.slice(), yaw: Math.atan2(-p.ux * sg, -p.uz * sg), node: cur });
      let bi = -1, bd = -1; for (const i of flat) { let m = 1e9; for (const s of spawns) m = Math.min(m, Math.hypot(N[i].p[0] - s.p[0], N[i].p[2] - s.p[2]) + Math.abs(N[i].p[1] - s.p[1]) * 3); if (m > bd) { bd = m; bi = i; } } cur = bi; }
    // objetos: reparar (verde) y nitro (azul), lejos de las salidas
    const picks = []; { const cand = flat.filter(i => spawns.every(s => Math.hypot(N[i].p[0] - s.p[0], N[i].p[2] - s.p[2]) > 9)); for (let k = 0; k < 8 && cand.length; k++) { const i = cand.splice(Math.floor(R0() * cand.length), 1)[0];
      if (picks.some(q => Math.hypot(q.p[0] - N[i].p[0], q.p[2] - N[i].p[2]) < 22)) { k--; if (cand.length < 3) break; continue; } picks.push({ p: [N[i].p[0], N[i].p[1] + 1.1, N[i].p[2]], t: k % 2 ? 'nitro' : 'rep', off: 0 }); } }
    lvl.derby = { map, PC, N, adj, floor, under, nearest, path, dist, spawns, picks, waterY: wy, c: [ox, wy, oz] };
    // cámaras de televisión: las del circuito base quedaban lejísimos; aquí, 8 alrededor de la estructura, algo por encima y mirando hacia dentro
    { let R = 0, top = wy; for (const n of N) { R = Math.max(R, Math.hypot(n.p[0] - ox, n.p[2] - oz)); top = Math.max(top, n.p[1]); }
      lvl.fixcams = []; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + 0.3, r = R * 0.6 + 6; lvl.fixcams.push([ox + Math.cos(a) * r, top + 5 + (k % 2) * 3, oz + Math.sin(a) * r]); } }
    return lvl.derby;
  };

  // ---------- malla y triángulos de choque ----------
  DB.build = function (lvl, R) {
    const D = lvl.derby; if (!D) return null; const mb = new BRR.MeshBuilder(null), g = mb.group('COLOR'), tris = [], rr = rnd(4242);
    const tri = (a, b, c, col) => { for (const v of [a, b, c, a, c, b]) { g.pos.push(v[0], v[1], v[2]); g.col.push(col[0], col[1], col[2]); g.lay.push(0); } };
    const quad = (a, b, c, d, col) => { tri(a, b, c, col); tri(a, c, d, col); };
    const WOOD = [[0.40, 0.27, 0.15], [0.35, 0.235, 0.13], [0.44, 0.30, 0.17], [0.32, 0.215, 0.12]], SIDE = [0.17, 0.115, 0.065], GREY = [[0.40, 0.41, 0.43], [0.36, 0.37, 0.39]], GSIDE = [0.2, 0.2, 0.22], EDGE = [0.78, 0.66, 0.3], POST = [0.12, 0.085, 0.05];
    for (const p of D.PC) { const nx = p.uz, nz = -p.ux, hw = p.w / 2, TH = 0.55;
      const at = (t, l, dy = 0) => [p.a[0] + p.ux * t + nx * l, p.a[1] + p.sl * Math.max(0, Math.min(p.L, t)) + dy, p.a[2] + p.uz * t + nz * l];
      const t0 = -p.e, t1 = p.L + p.e, wood = p.k === 'v', step = wood ? 2.6 : Math.max(3, (t1 - t0) / Math.max(1, Math.round((t1 - t0) / 5))), n = Math.max(1, Math.round((t1 - t0) / step));
      for (let i = 0; i < n; i++) { const ta = t0 + (t1 - t0) * i / n, tb = t0 + (t1 - t0) * (i + 1) / n;
        if (wood) { quad(at(ta, -hw + 0.3), at(ta, hw - 0.3), at(tb, hw - 0.3), at(tb, -hw + 0.3), WOOD[Math.floor(rr() * WOOD.length)]);
          for (const s of [-1, 1]) quad(at(ta, s * hw), at(ta, s * (hw - 0.3)), at(tb, s * (hw - 0.3)), at(tb, s * hw), EDGE.map(v => v * (0.75 + 0.25 * rr()))); }   // borde claro: se ve dónde acaba la viga
        else { const m = Math.max(1, Math.round(p.w / 5)); for (let j = 0; j < m; j++) { const la = -hw + p.w * j / m, lb = -hw + p.w * (j + 1) / m; quad(at(ta, la), at(ta, lb), at(tb, lb), at(tb, la), GREY[(i + j) % 2]); } }
        const sc = wood ? SIDE : GSIDE; for (const s of [-1, 1]) quad(at(ta, s * hw), at(tb, s * hw), at(tb, s * hw, -TH), at(ta, s * hw, -TH), sc);
        quad(at(ta, -hw, -TH), at(tb, -hw, -TH), at(tb, hw, -TH), at(ta, hw, -TH), sc.map(v => v * 0.6)); }
      const sc = wood ? SIDE : GSIDE; quad(at(t0, -hw), at(t0, hw), at(t0, hw, -TH), at(t0, -hw, -TH), sc); quad(at(t1, -hw), at(t1, hw), at(t1, hw, -TH), at(t1, -hw, -TH), sc);
      // choque: la caja entera (arriba, abajo y los cuatro lados)
      const A = at(t0, -hw), B = at(t0, hw), C = at(t1, hw), E = at(t1, -hw), A2 = at(t0, -hw, -TH), B2 = at(t0, hw, -TH), C2 = at(t1, hw, -TH), E2 = at(t1, -hw, -TH);
      for (const [a, b, c, d] of [[A, B, C, E], [A2, B2, C2, E2], [A, B, B2, A2], [B, C, C2, B2], [C, E, E2, C2], [E, A, A2, E2]]) { tris.push([a, b, c]); tris.push([a, c, d]); }
      // pilotes hasta el agua
      const np = Math.max(1, Math.round(p.L / 28)); for (let i = 0; i < np; i++) { const t = p.L * (i + 0.5) / np, c = at(t, 0, -TH), r = 0.28;
        const q = (dx, dz, y) => [c[0] + dx * r, y, c[2] + dz * r], yb = D.waterY - 1; const K = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (let k = 0; k < 4; k++) { const u = K[k], v = K[(k + 1) % 4]; quad(q(u[0], u[1], c[1]), q(v[0], v[1], c[1]), q(v[0], v[1], yb), q(u[0], u[1], yb), POST.map(x => x * (k % 2 ? 1 : 0.7))); } } }
    return { up: R.upload(mb), tris };
  };

  // ---------- IA: conduce por las vigas como un coche (sigue el trazado y gira en los cruces), y cuando tiene a alguien a tiro va a por él a fondo ----------
  DB.ai = function (r, cars, dt, K = 1) {
    const D = r.car.lvl.derby, c = r.car, inp = { steer: 0, throttle: 0, brake: 0, handbrake: false, pitchAir: 0 }; if (!D) return inp;
    const S = r.dby || (r.dby = { t: Math.random() * 0.5, tgt: null, tT: 0, d: null, goal: -1, stuck: 0, rev: 0, revS: 0, last: -1, wander: -1, ramT: 0 });
    const fw = c.forward(), sp = Math.hypot(c.v[0], c.v[2]), vf = c.v[0] * fw[0] + c.v[2] * fw[2], y = c.p[1], now = performance.now() / 1000;
    const has = (d, l = 0) => { const f = D.floor(c.p[0] + fw[0] * d + fw[2] * l, c.p[2] + fw[2] * d - fw[0] * l, y + 0.5); return f != null && f > y - 1.8 - Math.abs(d) * 0.4; };   // suelo a su altura (una viga de abajo no cuenta)
    if (D.floor(c.p[0], c.p[2], y + 0.5) == null && !c.W.some(w => w.contact)) return inp;   // cayendo: nada que hacer
    // ayuda: sin que nadie le empuje, la IA no se cae por un lado de la viga (se le frena la deriva hacia el borde)
    { const U = D.under(c.p[0], c.p[2], y); if (U && now - (c.dbT || 0) > 1.2 && U.p.k === 'v') { const nx = U.p.uz, nz = -U.p.ux, sg = Math.sign(U.l) || 1, room = U.p.w / 2 - Math.abs(U.l) - c.def.box.h[0];
        if (room < 0.6) { const vo = (c.v[0] * nx + c.v[2] * nz) * sg; if (vo > 0) { const k = Math.min(1, dt * 10) * (room < 0.2 ? 1 : 0.6); c.v[0] -= nx * sg * vo * k; c.v[2] -= nz * sg * vo * k; }
          if (room < 0.1) { c.v[0] -= nx * sg * dt * 3; c.v[2] -= nz * sg * dt * 3; } } } }
    // presa: la más cercana (con algo de azar), mejor si está a su altura
    S.tT -= dt; if (!S.tgt || S.tgt.out || S.tT <= 0) { let b = null, bd = 1e9; for (const o of cars) { if (o === c || o.out) continue; const d = (Math.hypot(o.p[0] - c.p[0], o.p[2] - c.p[2]) + Math.abs(o.p[1] - y) * 4) * (0.6 + 0.8 * Math.random()); if (d < bd) { bd = d; b = o; } } S.tgt = b; S.tT = 3 + Math.random() * 3; S.t = 0; }
    const me = D.nearest(c.p); if (me >= 0 && me !== S.cur) { S.last = S.cur ?? -1; S.cur = me; }
    S.t -= dt; if (S.t <= 0 || !S.d) { S.t = 0.5 + Math.random() * 0.2; let goal = S.tgt ? D.nearest(S.tgt.p) : -1; if (goal < 0) { if (S.wander < 0 || S.wander === me) S.wander = Math.floor(Math.random() * D.N.length); goal = S.wander; } if (goal !== S.goal || !S.d) { S.goal = goal; S.d = D.dist(goal); } }
    // siguiente nodo: de los vecinos que quedan por delante (no da la vuelta en la viga), el que más acerca al objetivo; si no hay ninguno por delante (final de viga), el mejor de todos
    const ahead = (from, prevN) => { const n0 = D.N[from], dd = S.d; let best = -1, bs = 1e9, anyB = -1, anyS = 1e9;
      for (const o of D.adj[from]) { if (o === prevN) continue; const n = D.N[o], dx = n.p[0] - c.p[0], dz = n.p[2] - c.p[2], l = Math.hypot(dx, dz) || 1, fwd = (dx * fw[0] + dz * fw[2]) / l, sc = dd[o] - fwd * 0.6;
        if (fwd > -0.15 && sc < bs) { bs = sc; best = o; } if (sc < anyS) { anyS = sc; anyB = o; } } return best >= 0 ? best : anyB; };
    let aim = null, nodeW = 6, ram = false, tdist = 0;
    const T = S.tgt;
    // a tiro: delante, a su altura y con suelo hasta ella (hasta 45 m): a por ella a fondo, sin frenar
    if (T) { const dx = T.p[0] - c.p[0], dz = T.p[2] - c.p[2], d = Math.hypot(dx, dz), a = Math.atan2(fw[0] * dz - fw[2] * dx, fw[0] * dx + fw[2] * dz);
      if (d < 45 && Math.abs(T.p[1] - y) < 1.3 && Math.abs(a) < (d < 12 ? 0.6 : 0.4)) { let ok = true; for (let k = 3; k < d && ok; k += 3) { const f = D.floor(c.p[0] + dx * k / d, c.p[2] + dz * k / d, y + 0.5); if (f == null || f < y - 2) ok = false; }
        if (ok) { const lead = Math.min(0.6, d / 30); aim = [T.p[0] + T.v[0] * lead, 0, T.p[2] + T.v[2] * lead]; ram = true; tdist = d; } } }
    let vTurn = 99;
    if (!aim && me >= 0) { const n1 = ahead(me, S.last); if (n1 >= 0) { const n2 = ahead(n1, me), A = D.N[n1].p, B = n2 >= 0 ? D.N[n2].p : A, d1 = Math.hypot(A[0] - c.p[0], A[2] - c.p[2]);
        // el giro que viene en el siguiente nodo: frena antes de llegar y empieza a girar un poco antes, avanzando (como un coche en un cruce)
        const a1 = Math.atan2(A[2] - c.p[2], A[0] - c.p[0]), a2 = Math.atan2(B[2] - A[2], B[0] - A[0]); let tA = Math.abs(a2 - a1); if (tA > Math.PI) tA = 2 * Math.PI - tA; if (n2 < 0 || B === A) tA = 0;
        if (tA > 0.35) vTurn = Math.max(3.2, 11 - tA * 6) + Math.max(0, d1 - 2) * 0.7;
        aim = d1 < 2 + tA * 2.6 ? B : A; nodeW = Math.min(D.N[me].w, D.N[n1].w); } }
    if (!aim) { inp.brake = sp > 1 ? 1 : 0; return inp; }
    const dx = aim[0] - c.p[0], dz = aim[2] - c.p[2], err = Math.atan2(fw[0] * dz - fw[2] * dx, fw[0] * dx + fw[2] * dz);
    inp.steer = Math.max(-1, Math.min(1, err * 1.8));
    // velocidad: según lo ancho que sea y lo que haya que girar (para girar en un cruce, frena antes y gira avanzando); a la presa, a fondo
    let vmax = (nodeW >= 11 ? 17 : nodeW >= 7 ? 12 : nodeW >= 5 ? 9.5 : 7.5) * K; vmax *= Math.max(0.35, 1 - Math.abs(err) * 0.8); vmax = Math.min(vmax, vTurn * K); if (ram) vmax = 40;
    // sensores: suelo delante y en las esquinas y los costados (l < 0: a la derecha, hacia donde gira un volante positivo)
    const hw = c.def.box.h[0] + 0.45, look = ram ? Math.min(3 + sp * 0.75, Math.max(3, tdist - 2)) : 3 + sp * 0.75, aheadOk = has(look), fR = has(1.2 + sp * 0.25, -hw), fL = has(1.2 + sp * 0.25, hw), sR = has(0, -hw), sL = has(0, hw), sR2 = has(look * 0.75, -hw * 1.3), sL2 = has(look * 0.75, hw * 1.3);
    if (nodeW < 8 && sp > 6 && !ram) inp.steer = Math.max(-0.7, Math.min(0.7, inp.steer));
    if (!fR || !sR) inp.steer = Math.min(inp.steer, -0.45 - (!fR && !sR ? 0.4 : 0)); else if (!fL || !sL) inp.steer = Math.max(inp.steer, 0.45 + (!fL && !sL ? 0.4 : 0));
    else if (!sR2 && sL2) inp.steer = Math.min(inp.steer, 0.15); else if (!sL2 && sR2) inp.steer = Math.max(inp.steer, -0.15);
    if (!aheadOk) { vmax = Math.min(vmax, 2.5); if (sp > 3) { inp.brake = 1; inp.throttle = 0; } if (sR2 !== sL2) inp.steer = sR2 ? 0.8 : -0.8; }
    if (!inp.brake) { if (vf < vmax - 0.5) inp.throttle = ram ? 1 : Math.min(1, 0.4 + (vmax - vf) * 0.25); else if (vf > vmax + 1.5) inp.brake = Math.min(1, (vf - vmax) * 0.3); }
    if (ram && Math.abs(err) < 0.25 && tdist > 4 && aheadOk && (c.nitroBar || 0) > 0.05) inp.nitro = true;   // el último empujón con el nitro
    // atascado (contra otro o contra el final de una viga): marcha atrás un momento y sigue; empujándose de frente sin avanzar: se echa atrás y vuelve con carrerilla
    if (sp < 0.8 && r.race && r.race.phase === 'race') S.stuck += dt; else S.stuck = Math.max(0, S.stuck - dt * 2);
    S.ramT = ram && sp < 2.5 ? S.ramT + dt : 0;
    if (S.rev > 0) { S.rev -= dt; if (has(-(2.5 + sp * 0.4))) { inp.throttle = 0; inp.brake = 0.8; inp.steer = -S.revS; } else { inp.brake = 0; inp.throttle = 0.6; S.rev = 0; } }
    else if (S.ramT > 1.4 && has(-3.5)) { S.ramT = 0; S.rev = 0.8 + Math.random() * 0.4; S.revS = 0; S.nR = (S.nR || 0) + 1; }
    else if (S.stuck > 1.5) { S.stuck = 0; S.rev = 0.8 + Math.random() * 0.4; S.revS = Math.sign(err) * 0.6; S.nS = (S.nS || 0) + 1; }
    return inp;
  };
})();
