// Pilotos de la máquina con personalidad. Usan la misma física que el jugador.
"use strict";
(function () {
  const BRR = window.BRR, V = BRR.V;
  BRR.courseAt = function (race, s) {
    const P = race.P, n = P.length, L = race.lvl; s = ((s % race.total) + race.total) % race.total;
    let lo = 0, hi = n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (race.cum[m] <= s) lo = m; else hi = m; }
    const i = lo, a = P[i], b = P[(i + 1) % n], seg = race.cum[i + 1] - race.cum[i] || 1, u = (s - race.cum[i]) / seg;
    const t = V.norm([b[0] - a[0], 0, b[2] - a[2]]);
    const w = L.courseW[i] + (L.courseW[(i + 1) % n] - L.courseW[i]) * u;
    return { p: [a[0] + (b[0] - a[0]) * u, 0, a[2] + (b[2] - a[2]) * u], t, w, vh: L.courseV[i] || 3000, i };
  };
  // rayo solo contra objetos (sin terreno), rápido
  function objRay(lvl, o, d, L) {
    const C = lvl.collider, e = V.madd(o, d, L), lst = objRay.l || (objRay.l = []);
    C.query(Math.min(o[0], e[0]), Math.min(o[2], e[2]), Math.max(o[0], e[0]), Math.max(o[2], e[2]), lst);
    let best = L; const T = C.T;
    for (const i of lst) {
      const a = i * 9, e1 = [T[a + 3] - T[a], T[a + 4] - T[a + 1], T[a + 5] - T[a + 2]], e2 = [T[a + 6] - T[a], T[a + 7] - T[a + 1], T[a + 8] - T[a + 2]];
      const p = V.cross(d, e2), det = V.dot(e1, p); if (Math.abs(det) < 1e-9) continue;
      const inv = 1 / det, s = [o[0] - T[a], o[1] - T[a + 1], o[2] - T[a + 2]], u = V.dot(s, p) * inv; if (u < 0 || u > 1) continue;
      const q = V.cross(s, e1), v = V.dot(d, q) * inv; if (v < 0 || u + v > 1) continue;
      const t = V.dot(e2, q) * inv; if (t >= 0 && t < best) { const n = V.cross(e1, e2), nl = V.len(n); if (Math.abs(n[1] / nl) < 0.7) best = t; }
    }
    return best;
  }
  BRR.objRay = objRay;
  // trazada de la IA: rejilla de navegación de 1 m con las paredes de los objetos + A* entre puntos del recorrido
  // mode: 'ground' (ruedas/orugas), 'hover' (también por el agua), 'boat' (prefiere el agua), 'fly' (helicóptero: sin paredes)
  BRR.aiMode = car => car.K.boat ? 'boat' : car.K.fly ? 'fly' : car.K.floats ? 'hover' : 'ground';
  BRR.buildAILine = function (lvl, race, mode = 'ground') {
    lvl.aiLines = lvl.aiLines || {};
    if (lvl.aiLines[mode]) return lvl.aiLine = lvl.aiLines[mode];
    const t0 = performance.now(), C = lvl.collider, T = C.T, P = lvl.course;
    // puntos de paso: recorrido + puertas de control, ordenados por distancia
    const way = P.map((p, i) => ({ p, s: race.cum[i] }));
    for (const g of race.gates) way.push({ p: g.c, s: g.s });
    way.sort((a, b) => a.s - b.s);
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const w of way) { x0 = Math.min(x0, w.p[0]); x1 = Math.max(x1, w.p[0]); z0 = Math.min(z0, w.p[2]); z1 = Math.max(z1, w.p[2]); }
    x0 -= 70; z0 -= 70; x1 += 70; z1 += 70;
    const W = Math.ceil(x1 - x0), H = Math.ceil(z1 - z0), grid = new Uint8Array(W * H);
    const cell = (x, z) => { const ix = Math.floor(x - x0), iz = Math.floor(z - z0); return ix >= 0 && iz >= 0 && ix < W && iz < H ? iz * W + ix : -1; };
    // paredes: triángulos casi verticales que cortan la franja de altura del coche
    const n = mode === 'fly' ? 0 : T.length / 9;
    for (let i = 0; i < n; i++) {
      const a = i * 9, e1 = [T[a + 3] - T[a], T[a + 4] - T[a + 1], T[a + 5] - T[a + 2]], e2 = [T[a + 6] - T[a], T[a + 7] - T[a + 1], T[a + 8] - T[a + 2]];
      const nn = V.cross(e1, e2), nl = V.len(nn); if (nl < 1e-6 || Math.abs(nn[1] / nl) > 0.75) continue;
      const cx = (T[a] + T[a + 3] + T[a + 6]) / 3, cz = (T[a + 2] + T[a + 5] + T[a + 8]) / 3, ty = lvl.terrain(cx, cz);
      const lo = ty + 0.25, hi = ty + 2.6;
      // recortar el triángulo a la franja de altura del coche (los pasos bajo edificios quedan libres)
      let poly = [[T[a], T[a + 1], T[a + 2]], [T[a + 3], T[a + 4], T[a + 5]], [T[a + 6], T[a + 7], T[a + 8]]];
      const clip = (pl, keep, cut) => { const out = []; for (let k = 0; k < pl.length; k++) { const A = pl[k], B = pl[(k + 1) % pl.length], ia = keep(A), ib = keep(B);
        if (ia) out.push(A); if (ia !== ib) { const u = (cut - A[1]) / (B[1] - A[1]); out.push([A[0] + (B[0] - A[0]) * u, cut, A[2] + (B[2] - A[2]) * u]); } } return out; };
      poly = clip(poly, P0 => P0[1] >= lo, lo); if (poly.length < 2) continue;
      poly = clip(poly, P0 => P0[1] <= hi, hi); if (poly.length < 2) continue;
      for (let k = 0; k < poly.length; k++) {
        const A = poly[k], B = poly[(k + 1) % poly.length], L = Math.hypot(B[0] - A[0], B[2] - A[2]), st = Math.max(1, Math.ceil(L / 0.4));
        for (let j = 0; j <= st; j++) { const c = cell(A[0] + (B[0] - A[0]) * j / st, A[2] + (B[2] - A[2]) * j / st); if (c >= 0) grid[c] = 1; }
      }
    }
    // pasillo del recorrido original (incluye saltos por encima de vallas): siempre transitable, con coste extra
    const corridor = new Uint8Array(W * H);
    for (let k = 0; k < P.length; k++) {
      const A = P[k], B = P[(k + 1) % P.length], L = Math.hypot(B[0] - A[0], B[2] - A[2]), st = Math.ceil(L / 0.5);
      for (let j = 0; j <= st; j++) { const x = A[0] + (B[0] - A[0]) * j / st, z = A[2] + (B[2] - A[2]) * j / st;
        for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const c = cell(x + dx, z + dz); if (c >= 0) corridor[c] = 1; } }
    }
    // pendientes del terreno demasiado empinadas para subir (rocas, taludes)
    const nrm = [0, 1, 0];
    // superficie de la pista: las baldosas que hay bajo las puertas de control (tierra del circuito, asfalto, agua...)
    const tkey = q => q.tile !== undefined ? q.tile : 'c' + q.type, tgates = new Map(), mapFreq = new Map();
    race.gates.forEach((g, gi) => { for (let a = -6; a <= 6; a += 2) for (let b = -2; b <= 2; b += 2) {
      const k = tkey(lvl.surface(g.c[0] + g.ax[0] * a + g.az[0] * b, g.c[2] + g.ax[2] * a + g.az[2] * b)); if (!tgates.has(k)) tgates.set(k, new Set()); tgates.get(k).add(gi); } });
    for (let iz = 0; iz < 256; iz += 2) for (let ix = 0; ix < 256; ix += 2) { const k = tkey(lvl.surface((ix + .5) * lvl.size / 256, -(iz + .5) * lvl.size / 256)); mapFreq.set(k, (mapFreq.get(k) || 0) + 1); }
    const nG = Math.max(1, race.gates.length);
    // pista = baldosas bajo varias puertas; el fondo (lo que cubre casi todo el mapa) no cuenta salvo que esté bajo todas
    const trackT = new Set([...tgates].filter(([k, gs]) => gs.size >= Math.max(2, Math.ceil(nG * 0.3)) && ((mapFreq.get(k) || 0) < 16384 * 0.4 || gs.size >= nG)).map(([k]) => k));
    // baldosas de curva y transiciones: cuentan como pista si la mayoría de sus píxeles son colores de la pista (y no del fondo)
    if (mode !== 'boat' && mode !== 'fly' && trackT.size) {
      const hists = new Map(), freq = new Map();
      for (let iz = 0; iz < 256; iz++) for (let ix = 0; ix < 256; ix++) { const q = lvl.surface((ix + .5) * lvl.size / 256, -(iz + .5) * lvl.size / 256), k = tkey(q); if (q.hist) hists.set(k, q.hist); freq.set(k, (freq.get(k) || 0) + 1); }
      const tp = new Float32Array(256), bp = new Float32Array(256); let tn = 0, bn = 0;
      for (const k of trackT) { const h = hists.get(k); if (h) { for (let c = 0; c < 256; c++) tp[c] += h[c]; tn++; } }
      for (const [k] of [...freq].filter(([k]) => !trackT.has(k)).sort((a, b) => b[1] - a[1]).slice(0, 3)) { const h = hists.get(k); if (h) { for (let c = 0; c < 256; c++) bp[c] += h[c]; bn++; } }
      if (tn && bn) for (const [k, h] of hists) if (!trackT.has(k)) {
        let f = 0; for (let c = 0; c < 256; c++) if (h[c] && tp[c] / tn > bp[c] / bn) f += h[c];
        if (f / 256 > 0.4) trackT.add(k);
      }
    }
    const wet = new Uint8Array(W * H);   // 1 = en la pista (para la lancha: en el agua)
    if (mode !== 'fly') for (let iz = 0; iz < H; iz++) for (let ix = 0; ix < W; ix++) {
      const x = x0 + ix + 0.5, z = z0 + iz + 0.5, i = iz * W + ix, q = lvl.surface(x, z);
      if (mode === 'boat' ? q.type === 'agua' : trackT.has(tkey(q)) || (mode === 'hover' && q.type === 'agua')) { wet[i] = 1; if (mode === 'boat' || q.type === 'agua') continue; }
      lvl.terrain(x, z, nrm); if (nrm[1] < (wet[i] ? 0.68 : mode === 'boat' ? 0.97 : 0.8)) grid[i] = 1;   // la lancha: cualquier cuesta fuera del agua es pared (no subir montañas)
    }
    // si la "pista" ocupa casi todo el mapa (Marte: todo es la misma roca), la pista es una franja de 22 m alrededor del recorrido
    if (mode !== 'boat' && mode !== 'fly') { let nw = 0; for (let i = 0; i < W * H; i++) nw += wet[i];
      if (nw > W * H * 0.45) { wet.fill(0); const R0 = 22;
        for (let k = 0; k < P.length; k++) { const A = P[k], B = P[(k + 1) % P.length], L = Math.hypot(B[0] - A[0], B[2] - A[2]), st = Math.ceil(L / 2);
          for (let j = 0; j <= st; j++) { const cx = Math.floor(A[0] + (B[0] - A[0]) * j / st - x0), cz = Math.floor(A[2] + (B[2] - A[2]) * j / st - z0);
            for (let dz = -R0; dz <= R0; dz++) for (let dx = -R0; dx <= R0; dx++) { if (dx * dx + dz * dz > R0 * R0) continue; const X = cx + dx, Z = cz + dz; if (X >= 0 && Z >= 0 && X < W && Z < H) wet[Z * W + X] = 1; } } } } }
    const landCost = mode === 'boat' ? 45 : mode === 'fly' ? 0 : 2.5;   // fuera de la pista cuesta más
    // distancia a la pared más cercana (en celdas, hasta 10) por BFS
    const dist = new Uint8Array(W * H).fill(255), q = new Int32Array(W * H); let qh = 0, qt = 0;
    for (let i = 0; i < W * H; i++) if (grid[i]) { dist[i] = 0; q[qt++] = i; }
    while (qh < qt) { const i = q[qh++], d = dist[i]; if (d >= 10) continue; const x = i % W, z = (i / W) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X >= W || Z >= H) continue; const j = Z * W + X; if (dist[j] > d + 1) { dist[j] = d + 1; q[qt++] = j; } } }
    // distancia al borde de la pista (para ir por el centro)
    const tdist = new Uint8Array(W * H).fill(255); { let h2 = 0, t2 = 0; const q2 = q;
      for (let i = 0; i < W * H; i++) if (!wet[i]) { tdist[i] = 0; q2[t2++] = i; }
      while (h2 < t2) { const i = q2[h2++], d = tdist[i]; if (d >= 15) continue; const x = i % W, z = (i / W) | 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X >= W || Z >= H) continue; const j = Z * W + X; if (tdist[j] > d + 1) { tdist[j] = d + 1; q2[t2++] = j; } } } }
    const centerUp = c => { for (let it = 0; it < 30; it++) { const x = c % W, z = (c / W) | 0; let best = c;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X >= W || Z >= H) continue; const j = Z * W + X; if (tdist[j] > tdist[best] && dist[j] >= 2) best = j; }
        if (best === c) break; c = best; } return c; };
    const free = i => dist[i] >= 2 || corridor[i] === 1;    // al menos 2 m de la pared (o pasillo del recorrido)
    const good = mode === 'fly' ? free : i => free(i) && wet[i] && dist[i] >= 2;   // puntos de paso sobre la pista
    const snap = (p) => { let c = cell(p[0], p[2]); if (c < 0) return -1; if (good(c)) return mode === 'fly' ? c : centerUp(c);
      const x = c % W, z = (c / W) | 0; for (let r = 1; r < 40; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X >= W || Z >= H) continue; const j = Z * W + X; if (good(j)) return mode === 'fly' ? j : centerUp(j); } return free(c) ? c : snapF(c); };
    const snapF = c => { const x = c % W, z = (c / W) | 0; for (let r = 1; r < 20; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X >= W || Z >= H) continue; const j = Z * W + X; if (free(j)) return j; } return c; };
    // A* entre puntos de paso (coste extra cerca de las paredes para ir por el centro)
    const gS = new Float32Array(W * H), seen = new Int32Array(W * H), par = new Int32Array(W * H); let stamp = 0;
    const heap = [], push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p2 = (k - 1) >> 1; if (heap[p2][0] <= heap[k][0]) break; [heap[p2], heap[k]] = [heap[k], heap[p2]]; k = p2; } },
      pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    function astar(sc, gc) {
      stamp++; heap.length = 0; const gx = gc % W, gz = (gc / W) | 0;
      const h = i => Math.hypot(i % W - gx, ((i / W) | 0) - gz);
      gS[sc] = 0; seen[sc] = stamp; par[sc] = -1; push(h(sc), sc); let it = 0;
      while (heap.length && it++ < 400000) {
        const [, i] = pop(); if (i === gc) break;
        const x = i % W, z = (i / W) | 0, gi = gS[i];
        for (const [dx, dz, c] of N8) {
          const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X >= W || Z >= H) continue; const j = Z * W + X;
          if (!free(j)) continue;
          const g = gi + c * (1 + Math.max(0, 6 - dist[j]) * 0.5 + (dist[j] < 2 ? 4 : 0) + (landCost && !wet[j] ? landCost : 0) + (wet[j] && tdist[j] < 5 ? (5 - tdist[j]) * 0.4 : 0));
          if (seen[j] !== stamp || g < gS[j]) { seen[j] = stamp; gS[j] = g; par[j] = i; push(g + h(j), j); }
        }
      }
      if (seen[gc] !== stamp) return null;
      const path = []; for (let i = gc; i >= 0; i = par[i]) { path.push(i); if (i === sc) break; } return path.reverse();
    }
    let cells = [], fails = 0;
    const wc = way.map(w => snap(w.p));
    for (let k = 0; k < way.length; k++) {
      const a = wc[k], b = wc[(k + 1) % way.length]; if (a < 0 || b < 0 || a === b) continue;
      const pth = astar(a, b);
      if (pth) cells.push(...(cells.length ? pth.slice(1) : pth));
      else { cells.push(a, b); fails++; }
    }
    let pts = cells.map(i => [x0 + (i % W) + 0.5, 0, z0 + ((i / W) | 0) + 0.5]);
    // suavizado y remuestreo cada 3 m
    for (let it = 0; it < 10; it++) pts = pts.map((p, k) => { const a = pts[(k - 2 + pts.length) % pts.length], b = pts[(k + 2) % pts.length]; return [(a[0] + 2 * p[0] + b[0]) / 4, 0, (a[2] + 2 * p[2] + b[2]) / 4]; });    for (let it = 0; it < 10; it++) pts = pts.map((p, k) => { const a = pts[(k - 2 + pts.length) % pts.length], b = pts[(k + 2) % pts.length]; return [(a[0] + 2 * p[0] + b[0]) / 4, 0, (a[2] + 2 * p[2] + b[2]) / 4]; });
    // trazada de carreras: se tensa la línea (menos curvatura, recorta por dentro) sin salirse de la pista ni acercarse a paredes
    { const ok = (x, z) => { const c = cell(x, z); return c >= 0 && dist[c] >= 3 && (mode === 'fly' || wet[c] || !landCost) && (mode !== 'fly' || dist[c] >= 3); };
      const n = pts.length;
      for (let it = 0; it < 80; it++) for (let k = 0; k < n; k++) {
        const a = pts[(k - 1 + n) % n], b = pts[(k + 1) % n], p = pts[k], tx = (a[0] + b[0]) / 2, tz = (a[2] + b[2]) / 2;
        const nx = p[0] + (tx - p[0]) * 0.5, nz = p[2] + (tz - p[2]) * 0.5;
        if (ok(nx, nz)) { p[0] = nx; p[2] = nz; }
      } }
    const step = 3, res = []; { let carry = 0;
      for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[2] - a[2]);
        let d = carry; while (d < L) { const f = d / L; res.push([a[0] + (b[0] - a[0]) * f, 0, a[2] + (b[2] - a[2]) * f]); d += step; } carry = d - L; } }
    const N = res.length;
    const out = res.map((p, k) => { const c = cell(p[0], p[2]), d = c >= 0 ? dist[c] : 5, pr = race.project(p);
      return { p, w: 30, vh: lvl.courseV[pr.i] || 3000, roomL: Math.max(0, d - 2), roomR: Math.max(0, d - 2), s: pr.s }; });
    out.forEach((q2, k) => { const nx = out[(k + 1) % N].p; q2.t = V.norm([nx[0] - q2.p[0], 0, nx[2] - q2.p[2]]); });
    const cmask = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) cmask[i] = corridor[i] === 1 && dist[i] < 3 ? 1 : 0;
    lvl.aiLine = lvl.aiLines[mode] = { mode, cache: { x0, z0, W, H, cmask }, pts: out, step, N, total: N * step, ms: Math.round(performance.now() - t0), dbg: { grid, dist, wet, W, H, x0, z0, fails }, corridorAt: (x, z) => { const c = cell(x, z); return c >= 0 && corridor[c] === 1 && dist[c] < 3; } };
    return lvl.aiLine;
  };
  // proyección sobre la trazada de la IA con continuidad
  BRR.aiProject = function (line, p, hint) {
    const N = line.N; let best = null;
    const idx = hint != null ? Array.from({ length: 31 }, (_, k) => (hint + k - 10 + N) % N) : Array.from({ length: N }, (_, k) => k);
    for (const i of idx) { const q = line.pts[i].p, d = (p[0] - q[0]) ** 2 + (p[2] - q[2]) ** 2; if (!best || d < best.d) best = { d, i }; }
    return best;
  };
  // caché en IndexedDB de la trazada (tarda unos segundos en calcularse la primera vez)
  const AIV = 'v13';   // v13: suelo, objetos apoyados y lanchas sin montañas: las trazadas se recalculan
  const aidb = () => new Promise((ok, ko) => { const r = indexedDB.open('brr_ai', 1); r.onupgradeneeded = () => r.result.createObjectStore('l'); r.onsuccess = () => ok(r.result); r.onerror = ko; });
  const rle = a => { const o = []; let v = a[0], n = 0; for (let i = 0; i < a.length; i++) { if (a[i] === v) n++; else { o.push(n); v = a[i]; n = 1; } } o.push(n); return { first: a[0], runs: o }; };
  const unrle = (r, len) => { const a = new Uint8Array(len); let v = r.first, i = 0; for (const n of r.runs) { if (v) a.fill(1, i, i + n); i += n; v ^= 1; } return a; };
  const attach = L => { const { x0, z0, W, H, cmask } = L.cache; L.corridorAt = (x, z) => { const ix = Math.floor(x - x0), iz = Math.floor(z - z0); return ix >= 0 && iz >= 0 && ix < W && iz < H && cmask[iz * W + ix] === 1; }; return L; };
  BRR.loadAILine = async function (lvl, mode) {
    try { const db = await aidb(), key = AIV + ':' + (lvl.aiKey || lvl.name) + ':' + mode;
      const v = await new Promise(ok => { const r = db.transaction('l').objectStore('l').get(key); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); });
      if (!v) return false;
      const L = { ...v, cache: { ...v.cache, cmask: unrle(v.cache.cmask, v.cache.W * v.cache.H) } }; attach(L);
      lvl.aiLines = lvl.aiLines || {}; lvl.aiLines[mode] = L; return true;
    } catch (e) { return false; }
  };
  BRR.saveAILine = async function (lvl, mode) {
    const L = (lvl.aiLines || {})[mode]; if (!L) return;
    try { const db = await aidb(), key = AIV + ':' + (lvl.aiKey || lvl.name) + ':' + mode;
      const v = { mode, pts: L.pts, step: L.step, N: L.N, total: L.total, cache: { ...L.cache, cmask: rle(L.cache.cmask) } };
      db.transaction('l', 'readwrite').objectStore('l').put(v, key);
    } catch (e) { }
  };
  // velocidad máxima en cada punto: agarre lateral en curva y distancia de frenada hasta la siguiente curva
  const SURF_MU = { asfalto: 1.0, tierra: 0.9, arena: 0.78, nieve: 0.7, agua: 0.6 };
  BRR.aiProfile = function (line, car, P) {
    const N = line.N, st = line.step, vtop = car.topSpeed * P.pace * (car.K.fly ? 1.1 : 1);
    const mu = (car.K.fly ? 2.5 : car.K.boat ? 0.6 : car.K.thrust ? 0.55 : 1.0) * P.corner, out = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = line.pts[(i - 5 + N) % N].t, b = line.pts[(i + 5) % N].t, ang = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[2] * b[2])));
      // agarre del suelo en ese punto (arena, nieve... agarran menos que el asfalto): la curva se toma más despacio
      let ms = 1; if (!car.K.fly && !car.K.floats && car.lvl && car.lvl.surface) { const p = line.pts[i].p, sf = car.lvl.surface(p[0], p[2]); ms = SURF_MU[sf ? sf.type : 'asfalto'] || 0.95; }
      const k = ang / (10 * st); out[i] = Math.min(vtop, Math.sqrt(mu * ms * 9.81 / Math.max(k, 1e-5)));
    }
    // límite de la dirección: a más velocidad, menos ángulo de giro (como en el original); no se puede entrar a una curva
    // más rápido de lo que deja girar el volante a esa velocidad
    if (!car.K.fly && !car.K.yaw && car.def && car.def.steer) { const L = car.wheelBase, kmax = [], SK = BRR.SPEED_K || 1;
      for (let v = 0; v <= 70; v++) { const def = car.def, sp = v / SK, [s1, a1, s2, a2] = def.steer, tt = Math.min(1, Math.max(0, (sp - s1) / (s2 - s1))); kmax.push(Math.tan((a1 + (a2 - a1) * tt) / 0x280 * 0.55) / L); }
      for (let i = 0; i < N; i++) { const a = line.pts[(i - 5 + N) % N].t, b = line.pts[(i + 5) % N].t, ang = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[2] * b[2]))), k = ang / (10 * st) * 1.25;
        let v = Math.min(70, Math.floor(out[i])); while (v > 7 && kmax[v] < k) v--; out[i] = Math.min(out[i], Math.max(7, v)); } }
    const brake = 6.5 * Math.min(1.2, P.corner);
    for (let pass = 0; pass < 2; pass++) for (let i = N - 1; i >= 0; i--) { const j = (i + 1) % N; out[i] = Math.min(out[i], Math.sqrt(out[j] * out[j] + 2 * brake * st)); }
    for (let i = 0; i < N; i++) out[i] = Math.max(7, out[i]);
    return out;
  };
  BRR.aiAt = function (line, s) {
    const N = line.N, f = ((s / line.step) % N + N) % N, i = Math.floor(f), u = f - i, a = line.pts[i], b = line.pts[(i + 1) % N];
    return { p: V.add(a.p, V.mul(V.sub(b.p, a.p), u)), t: V.norm(V.add(V.mul(a.t, 1 - u), V.mul(b.t, u))), w: a.w, vh: a.vh, roomL: Math.min(a.roomL, b.roomL), roomR: Math.min(a.roomR, b.roomR) };
  };
  // personalidades
  // pace: ritmo · corner: velocidad en curva · cut: cuánto recorta por el interior · react: retraso de reacción (s)
  // wobble: imprecisión del volante · mistake: despistes por minuto · aggro: busca el contacto · overtake: ganas de adelantar
  BRR.AI_PROFILES = {
    experto:      { name: 'Experto',      pace: 1.03, corner: 1.08, cut: 0.55, react: 0.06, wobble: 0.02, mistake: 0.2, aggro: 0.2, overtake: 0.8, laneJitter: 0.05 },
    agresivo:     { name: 'Agresivo',     pace: 1.02, corner: 1.12, cut: 0.35, react: 0.10, wobble: 0.06, mistake: 1.0, aggro: 1.0, overtake: 1.0, laneJitter: 0.15 },
    torpe:        { name: 'Torpe',        pace: 0.96, corner: 0.95, cut: 0.10, react: 0.25, wobble: 0.16, mistake: 3.0, aggro: 0.3, overtake: 0.4, laneJitter: 0.25 },
    prudente:     { name: 'Prudente',     pace: 0.95, corner: 0.90, cut: 0.25, react: 0.12, wobble: 0.03, mistake: 0.3, aggro: 0.0, overtake: 0.3, laneJitter: 0.05 },
    imprevisible: { name: 'Imprevisible', pace: 1.00, corner: 1.00, cut: 0.30, react: 0.15, wobble: 0.08, mistake: 1.5, aggro: 0.5, overtake: 0.7, laneJitter: 0.45 },
  };
  BRR.AIDriver = class {
    constructor(car, race, skill, lane, profile = 'experto') {
      this.car = car; this.race = race; this.skill = skill; this.baseLane = lane; this.lane = lane;
      this.P = BRR.AI_PROFILES[profile] || BRR.AI_PROFILES.experto; this.profile = profile;
      this.reset();
    }
    reset() {
      this.stuckT = 0; this.lastS = null; this.revT = 0; this.offT = 0; this.steerOut = 0; this.mistakeT = 0; this.mistake = null;
      this.laneT = 0; this.laneTarget = this.baseLane; this.rubber = 1; this.phase = Math.random() * 6.28; this.fails = 0;
    }
    // others: los demás coches (para adelantar o embestir); player: el coche del jugador (rubber banding)
    control(dt, others = [], playerScore = null) {
      const car = this.car, race = this.race, P = this.P, inp = { steer: 0, throttle: 0, brake: 0, handbrake: false, pitchAir: 0 };
      if (race.phase === 'countdown') { inp.handbrake = true; this.startLane = null; return inp; }
      if (race.phase === 'finished') { inp.brake = 0.5; return inp; }
      const line = this.line || (this.line = BRR.buildAILine(car.lvl, race, BRR.aiMode(car)));
      let pj = BRR.aiProject(line, car.p, this.li); if (pj.d > 900) pj = BRR.aiProject(line, car.p, null); this.li = pj.i;
      const v = Math.max(0, car.speed()), s = pj.i * line.step;
      car.ghost = line.corridorAt(car.p[0], car.p[2]) && this.hidden();   // vallas finas de su pasillo: solo las atraviesa si nadie lo ve (a la vista choca como todos)
      const here = BRR.aiAt(line, s), half = Math.max(0, Math.min(here.w / 2 - 3, 6));
      // rubber banding suave: según la distancia (en controles) al jugador
      if (playerScore != null) {
        const gap = race.score() - playerScore;                 // >0: va por delante del jugador
        const want = gap > 0 ? 1 - Math.min(0.08, gap * 0.04) : 1;   // por detrás ya no acelera de más (era injusto)
        this.rubber += (want - this.rubber) * Math.min(1, dt * 0.5);
      }
      // curva por delante: sentido y fuerza
      const near = BRR.aiAt(line, s + 6), far = BRR.aiAt(line, s + 20 + v * 1.2);
      const turnSign = Math.sign(near.t[0] * far.t[2] - near.t[2] * far.t[0]);   // + = curva a la derecha
      const turn = Math.acos(Math.max(-1, Math.min(1, V.dot(near.t, far.t))));
      // carril: propio + variaciones de la personalidad + recorte por el interior de la curva
      this.laneT -= dt;
      if (this.laneT <= 0) { this.laneT = 2 + Math.random() * 4; this.laneTarget = Math.max(-0.7, Math.min(0.7, this.baseLane + (Math.random() - .5) * 2 * P.laneJitter)); }
      let lane = this.laneTarget + turnSign * P.cut * Math.min(1, turn * 1.5) * 0.8;
      // salida limpia: los primeros segundos cada uno mantiene su fila de la parrilla y nadie va a por nadie (sin peloteras)
      const clean = race.t < 6;
      if (this.startLane == null) { const d0 = V.sub(car.p, here.p); this.startLane = Math.max(-0.9, Math.min(0.9, (d0[0] * -here.t[2] + d0[2] * here.t[0]) / Math.max(1.5, half))); this.lane = this.startLane; }
      if (clean) { const k = Math.max(0, (race.t - 3.5) / 2.5); lane = this.startLane * (1 - k) + lane * k; }
      // tráfico: adelantar al de delante o, si es agresivo, ir a por él
      let blockSpeed = null;
      for (const o of others) {
        if (o === car) continue;
        const d = V.sub(o.p, car.p), ahead = V.dot(d, here.t), side = d[0] * -here.t[2] + d[2] * here.t[0];
        if (ahead > 0 && ahead < 14 + v * 0.6 && Math.abs(side) < 3.2) {
          if (clean) { if (ahead < 9 && Math.abs(side) < 2.4) blockSpeed = Math.max(0, V.dot(o.v, here.t) - 0.5); continue; }   // en la salida: levantar el pie, no embestir
          if (car.gpMode) {   // Grand Prix: carreras limpias, sin toques; adelanta por donde hay hueco y si no, espera detrás
            const vo = V.dot(o.v, here.t), myS = this.lane * Math.max(1, half), room = side > myS ? -1 : 1;
            if (vo < v - 1.5 && Math.random() < dt * 2) this.passSide = room; if (this.passSide) lane = this.passSide * 0.6;
            if (ahead < 6 + v * 0.35 && Math.abs(side) < 2.4) blockSpeed = Math.max(0, vo - 1.5); continue; }
          if (P.aggro > 0.6 && o.isPlayer && Math.random() < P.aggro * dt * 3) lane = (side / Math.max(1, half)) * 0.9;   // ir a por el jugador
          else if (Math.random() < P.overtake) lane = (side > 0 ? -1 : 1) * 0.55;          // abrirse para adelantar
          else blockSpeed = Math.max(0, V.dot(o.v, here.t) - 1);                             // quedarse detrás
        }
      }
      if (car.gpMode) { for (const o of others) { if (o === car) continue; const d = V.sub(o.p, car.p), ah = V.dot(d, here.t), sd = d[0] * -here.t[2] + d[2] * here.t[0]; if (Math.abs(ah) < 5.5 && Math.abs(sd) < 3.2) lane = Math.max(-0.9, Math.min(0.9, this.lane - Math.sign(sd || 1) * 0.35)); }   // rueda con rueda: dejar sitio
        if (Math.random() < dt * 0.3) this.passSide = 0; }
      // obstáculos sólidos delante (vallas, farolas, señales): apartarse hacia el lado libre
      this.scanT = (this.scanT || 0) - dt;
      if (this.scanT <= 0) {
        this.scanT = 0.12; this.avoid = 0;
        const f0 = car.forward(), fh = V.norm([f0[0], 0, f0[2]]), o = V.add(car.p, [0, 0.4, 0]), L = 7 + v * 0.55;
        const ray = ang => { const c = Math.cos(ang), s2 = Math.sin(ang), d = [fh[0] * c - fh[2] * s2, 0, fh[2] * c + fh[0] * s2];
          const h = BRR.raycast(car.lvl, o, d, L); return h && h.surf === 1 && Math.abs(h.n[1]) < 0.6 ? h.t : L; };
        const mid = ray(0);
        if (mid < L) { const l = ray(-0.45), r = ray(0.45); this.avoid = (r >= l ? 1 : -1) * (1 - mid / L); }
      }
      if (this.avoid) lane = Math.max(-0.9, Math.min(0.9, this.lane + this.avoid * 1.2));
      this.lane += (lane - this.lane) * Math.min(1, dt * (this.avoid ? 4 : 1.6));
      // perfil de velocidad de la trazada (curvatura + frenada), una vez por coche
      if (!this.vprof) {
        if (line.vrec) {   // trazada de una grabación original: su velocidad, limitada por la curva y con margen de frenada para estas físicas
          const cv = BRR.aiProfile(line, car, P), N0 = line.N, o = new Float32Array(N0);
          for (let i = 0; i < N0; i++) o[i] = Math.max(7, Math.min(line.vrec[i] * P.pace, cv[i] * 1.15, car.topSpeed * 1.02));
          for (let pass = 0; pass < 2; pass++) for (let i = N0 - 1; i >= 0; i--) { const j = (i + 1) % N0; o[i] = Math.min(o[i], Math.sqrt(o[j] * o[j] + 2 * 7 * line.step)); }
          this.vprof = o;
        } else this.vprof = BRR.aiProfile(line, car, P);
      }
      // punto objetivo (persecución pura) con visión directa: si una valla lo tapa, uno más cercano
      let look = 7 + v * 0.55, tg = BRR.aiAt(line, s + look);
      const eye = V.add(car.p, [0, 0.9, 0]);
      for (const f of [1, 0.6, 0.35]) {
        tg = BRR.aiAt(line, s + look * f); const tp0 = [tg.p[0], car.lvl.terrain(tg.p[0], tg.p[2]) + 0.9, tg.p[2]], dd = V.sub(tp0, eye), L = V.len(dd);
        if (L < 0.5 || car.K.fly || BRR.objRay(car.lvl, eye, V.mul(dd, 1 / L), L) >= L) { look *= f; break; }
      }
      // el carril se limita al hueco libre medido en esa zona (no se mete contra vallas)
      const latOff = this.lane >= 0 ? this.lane * Math.min(half, tg.roomR) : this.lane * Math.min(half, tg.roomL);
      const nrm = [-tg.t[2], 0, tg.t[0]], tp = V.madd(tg.p, nrm, latOff);
      const d = V.sub(tp, car.p), fw = car.forward(), ld = Math.max(2, Math.hypot(d[0], d[2]));
      let err = Math.atan2(fw[0] * d[2] - fw[2] * d[0], fw[0] * d[0] + fw[2] * d[2]);   // + = derecha
      err += P.wobble * Math.sin(performance.now() / 700 + this.phase) * 0.6;
      // ángulo de dirección necesario (geometría de Ackermann) / tope de giro a esta velocidad
      const delta = Math.atan2(2 * car.wheelBase * Math.sin(err), ld), lock = Math.max(0.05, car.steerLock());
      const want = car.K.yaw ? Math.max(-1, Math.min(1, err * 2.2)) : Math.max(-1, Math.min(1, delta / lock * 1.1));
      this.steerOut += (want - this.steerOut) * Math.min(1, dt / Math.max(0.02, P.react));
      inp.steer = this.steerOut;
      // despistes: frenar tarde, volantazo o un momento sin acelerar
      this.mistakeT -= dt;
      if (!this.mistake && Math.random() < P.mistake / 60 * dt && v > 12) { this.mistake = ['tarde', 'volantazo', 'duda'][Math.random() * 3 | 0]; this.mistakeT = 0.4 + Math.random() * 0.6; this.mistakeDir = Math.random() < .5 ? -1 : 1; }
      if (this.mistake && this.mistakeT <= 0) this.mistake = null;
      // velocidad objetivo: el perfil en este punto y un poco por delante (reacción), con rubber banding
      const i0 = Math.floor(s / line.step), N = line.N; let vp = 1e9; for (let k = 0; k <= 3; k++) vp = Math.min(vp, this.vprof[(i0 + k) % N]);
      let vt = vp * this.skill * this.rubber;
      // muy desviado (cruzado o mirando hacia atrás): frenar de verdad para poder girar; si no hay manera, maniobra
      const ae = Math.abs(err);
      if (ae > 0.45 && v > 8) vt = Math.min(vt, Math.max(6, v * (1.3 - ae)));   // no consigue seguir la curva: levantar y frenar ya
      if (ae > 0.9) vt = Math.min(vt, Math.max(4, 9 - (ae - 0.9) * 5));
      // aprende: si se pasa en una curva, la próxima vuelta llega más despacio a ese tramo
      if (ae > 0.8 && !this.overT && this.vprof) { this.overT = 3; const N0 = line.N, back = Math.round(45 / line.step);
        for (let k = 0; k <= back; k++) { const j = ((i0 - k) % N0 + N0) % N0; this.vprof[j] = Math.max(7, this.vprof[j] * (0.86 + 0.14 * k / back)); } }
      if (this.overT) this.overT = Math.max(0, this.overT - dt);
      this.crossT = ae > 1.5 ? (this.crossT || 0) + dt : 0;
      if (this.crossT > 1.6 && !(this.revT > 0)) { this.crossT = 0; if (this.hidden() && this.crossN > 1) { this.recover(s); this.crossN = 0; } else { this.crossN = (this.crossN || 0) + 1; this.revT = 1.1; this.revSteer = Math.sign(err) || 1; } }
      if (blockSpeed != null) vt = Math.min(vt, Math.max(8, blockSpeed));
      this.dbg = { err: +err.toFixed(2), vt: +vt.toFixed(1), lat: +latOff.toFixed(1), look: +look.toFixed(1), blk: blockSpeed, half: +half.toFixed(1) };
      inp.throttle = v < vt ? 1 : (v < vt + 2 ? 0.3 : 0);
      inp.brake = v > vt + (ae > 0.9 ? 1 : 3) ? Math.min(1, (v - vt) / 6 + (ae > 0.9 ? 0.3 : 0)) : 0;
      // nitro en las rectas
      // se reparten a lo largo de la carrera (no todos en la salida) y solo en rectas largas; en la última vuelta, los que queden
      if (this.nitro0 == null && race.phase === 'race') this.nitro0 = car.nitroInf ? 0 : (car.nitros | 0);
      if (race.phase === 'race') this.runT = (this.runT || 0) + dt;
      if (this.nitro0 > 0 && car.nitros > 0 && race.phase === 'race' && this.runT > 6 && turn < 0.1 && v > 14 && !this.mistake) {
        const L = line.total || race.total || 1, pr = Math.min(1, (race.lap + ((s % L) + L) % L / L) / Math.max(1, race.laps || 1)), used = this.nitro0 - car.nitros;
        const due = (used + 1) / (this.nitro0 + 1) - 0.05 * (1 + P.aggro), last = race.lap >= (race.laps || 1) - 1 && pr > 1 - 0.6 / Math.max(1, race.laps || 1);
        const ahead = BRR.aiAt(line, s + 50 + v * 2.2), longStraight = Math.acos(Math.max(-1, Math.min(1, V.dot(near.t, ahead.t)))) < 0.18;
        if ((pr >= due || last) && longStraight && Math.random() < dt * 0.8) inp.nitro = true; }
      if (this.mistake === 'tarde') { inp.brake = 0; inp.throttle = 1; }
      if (this.mistake === 'volantazo') inp.steer = Math.max(-1, Math.min(1, inp.steer + this.mistakeDir * 0.6));
      if (this.mistake === 'duda') { inp.throttle = 0.2; inp.brake = 0; }
      // atascos: marcha atrás; si sigue, recolocar
      if (this.revT > 0) { this.revT -= dt; inp.throttle = 0; inp.brake = 1; inp.steer = -(this.revSteer || Math.sign(err) || 1); if (this.revT <= 0) this.revSteer = 0; return inp; }
      this.stuckT += dt;
      // fuera de la vista del jugador se recoloca antes (sin que se note)
      const hidden = this.hidden();
      if (this.stuckT > (hidden ? 1.4 : 2.5)) {
        const prog = this.lastS == null ? 99 : ((s - this.lastS) % line.total + line.total) % line.total;
        if (prog < 4) { this.fails++; if (this.fails >= (hidden ? 2 : 6)) { this.recover(s); this.fails = 0; } else { this.revT = 1.2; this.revSteer = this.fails % 2 ? 1 : -1; } }   // a la vista intenta salir solo mucho más tiempo antes de recolocarse
        else this.fails = 0;
        this.stuckT = 0; this.lastS = s;
      }
      const lat = Math.hypot(car.p[0] - here.p[0], car.p[2] - here.p[2]);
      this.offT = lat > here.w * 0.75 + 12 ? this.offT + dt : 0;
      if (this.offT > (hidden ? 4 : 14)) { this.recover(s); this.offT = 0; }
      return inp;
    }
    // ¿lo ve el jugador? (lejos de la cámara o detrás de ella)
    hidden() {   // ningún jugador lo ve (lejos de todas las cámaras o detrás de ellas)
      const cams = BRR.aiCams || (BRR.aiCam ? [BRR.aiCam] : []); if (!cams.length) return false;
      return cams.every(C => { const d = V.sub(this.car.p, C.p), L = V.len(d); return L > 60 || V.dot(d, C.f) < L * 0.3; });
    }
    recover(s) {
      // si vuelve a atascarse en el mismo tramo, lo salta
      const tot = this.line.total, near = this.lastRecS != null && ((s - this.lastRecS) % tot + tot) % tot < 30;
      this.recStreak = near ? (this.recStreak || 0) + 1 : 0; this.lastRecS = s;
      const s1 = s + 1 + Math.min(3, this.recStreak) * 8,   // sin ganar terreno: casi donde estaba (solo avanza si se vuelve a atascar en el mismo sitio)
        c = BRR.aiAt(this.line, s1), p = c.p; this.li = null;
      // los controles que quedan entre el punto de atasco y el de recolocación cuentan como pasados
      const race = this.race, rs0 = race.project(this.car.p).s, rs1 = race.project(p).s, span = ((rs1 - rs0) % race.total + race.total) % race.total;
      if (span < 200) for (const g of race.gates.slice().sort((a, b) => (((a.s - rs0) % race.total + race.total) % race.total) - (((b.s - rs0) % race.total + race.total) % race.total)))
        { const d = ((g.s - rs0) % race.total + race.total) % race.total; if (d <= span + 3 && g.num === race.expected) race.cross(g); }
      (this.recLog = this.recLog || []).push([+this.car.p[0].toFixed(0), +this.car.p[2].toFixed(0), +s.toFixed(0)]);
      this.car.reset(p[0], p[2], Math.atan2(-c.t[0], -c.t[2]), this.car.p[1]); this.race.prev = this.car.p.slice(); this.recovers = (this.recovers || 0) + 1;
      this.steerOut = 0; this.mistake = null;
      // si la trazada grabada no le va bien a estas físicas (se atasca a menudo), pasa a la trazada calculada
      if (this.line.vrec && this.recovers >= 3) { const md = BRR.aiMode(this.car), L = (this.car.lvl.aiLines || {})[md];
        if (L) { this.line = L; this.vprof = null; this.li = null; } }
    }
  };
  // choques entre coches (esferas de carrocería)
  // choques entre coches con cajas orientadas (la caja real de cada vehículo, no esferas): separación por el eje de menor
  // penetración (teorema del eje separador en planta) y rebote; los rivales grabados empujan como si pesaran muchísimo
  // soft: en la salida los toques solo separan (sin rebote ni trompos) para que no se forme una pelotera
  BRR.carCollisions = function (cars, soft) {
    const box = c => { const R = c.R, b = c.def.box, ctr = V.add(c.p, BRR.mv(R, b.c)), f = V.norm([R[0][2], 0, R[2][2]]), r = [f[2], 0, -f[0]]; return { ctr, f, r, h: b.h }; };
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
      const A = cars[i], B = cars[j], dx = A.p[0] - B.p[0], dz = A.p[2] - B.p[2]; if (A.kinematic && B.kinematic) continue;
      if (dx * dx + dz * dz > 144) continue;
      const a = box(A), bb = box(B), d = V.sub(a.ctr, bb.ctr);
      if (Math.abs(d[1]) > a.h[1] + bb.h[1] + 0.2) continue;   // uno encima del otro (salto)
      let pen = 1e9, n = null;
      for (const ax of [a.r, a.f, bb.r, bb.f]) {
        const ra = a.h[0] * Math.abs(V.dot(a.r, ax)) + a.h[2] * Math.abs(V.dot(a.f, ax)), rb = bb.h[0] * Math.abs(V.dot(bb.r, ax)) + bb.h[2] * Math.abs(V.dot(bb.f, ax));
        const dist = V.dot(d, ax), o = ra + rb - Math.abs(dist); if (o <= 0) { n = null; pen = 0; break; }
        if (o < pen) { pen = o; n = dist >= 0 ? ax : V.mul(ax, -1); }
      }
      if (!n || pen <= 0) continue;
      const kA = A.kinematic ? 0 : B.kinematic ? 1 : 0.5, kB = B.kinematic ? 0 : A.kinematic ? 1 : 0.5;
      A.p = V.madd(A.p, n, pen * kA); B.p = V.madd(B.p, n, -pen * kB);
      const vrel = V.dot(V.sub(A.v, B.v), n);
      if (vrel < 0) {
        const iA = A.kinematic ? 0 : 1 / A.m, iB = B.kinematic ? 0 : 1 / B.m, jj = -(soft ? 1 : 1.25) * vrel / (iA + iB);
        if (soft) { if (!A.kinematic) A.applyImpulse(V.mul(n, jj), [0, 0, 0], 0); if (!B.kinematic) B.applyImpulse(V.mul(n, -jj), [0, 0, 0], 0); continue; }
        const mid = V.mul(V.add(a.ctr, bb.ctr), 0.5);
        if (!A.kinematic) A.applyImpulse(V.mul(n, jj), V.sub(mid, A.p), 0.2); if (!B.kinematic) B.applyImpulse(V.mul(n, -jj), V.sub(mid, B.p), 0.2);
        // rozamiento lateral entre carrocerías (se frotan, no se pegan)
        const vt = V.sub(V.sub(A.v, B.v), V.mul(n, vrel)), vtl = V.len(vt); if (vtl > 0.1) { const jt = Math.min(0.15 * jj, vtl / (iA + iB) * 0.5); if (!A.kinematic) A.applyImpulse(V.mul(vt, -jt / vtl), [0, 0, 0], 0); if (!B.kinematic) B.applyImpulse(V.mul(vt, jt / vtl), [0, 0, 0], 0); }
        A.lastHit = Math.max(A.lastHit || 0, -vrel); B.lastHit = Math.max(B.lastHit || 0, -vrel);
        if (-vrel > (A.hitV || 0)) { A.hitV = -vrel; A.hitR = V.sub(mid, A.p); } if (-vrel > (B.hitV || 0)) { B.hitV = -vrel; B.hitR = V.sub(mid, B.p); }
        if (-vrel > 2.5) { const t = performance.now() / 1000; A.bumpT = B.bumpT = t; A.bumpBy = B; B.bumpBy = A; A.hitBy = B; B.hitBy = A; }
      }
    }
  };
})();
