// Modo Kanjo: decorado propio del loop de Osaka. Todo se genera aquí (nada viene de otros juegos):
//  una autopista elevada sobre pilares con muros, pantallas acústicas, farolas, pórticos de señales y la ciudad
//  alrededor (edificios con las ventanas encendidas, neones y balizas rojas). Siempre de noche.
// El trazado (kanjo_data.js) es el real, de OpenStreetMap. La música del modo (music/kanjo.mp3) es de NipponBass.
"use strict";
(function () {
  const BRR = window.BRR, KJ = BRR.kanjo = {};
  const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const HC = 24;   // rejilla (m) para buscar el tramo de carretera más cercano

  // ---------- el tablero: la carretera va en alto y el juego la trata como suelo ----------
  KJ.install = function (lvl, P, T, CM) {
    const S = P.S, n = S.length, hw = (T.w || 15) / 2, X = new Float32Array(n), Z = new Float32Array(n), NX = new Float32Array(n), NZ = new Float32Array(n), SS = new Float32Array(n), Y = new Float32Array(n);
    for (let i = 0; i < n; i++) { X[i] = S[i].x * CM; Z[i] = -S[i].z * CM; NX[i] = S[i].tz; NZ[i] = S[i].tx; SS[i] = S[i].s; }
    // altura del tablero: la de cada tramo real (más alto donde cruza por encima de otras autopistas), muy suavizada
    const hs = Array.isArray(T.hs) && T.hs.length === T.road.length ? T.hs : null; let h = new Float32Array(n);
    for (let i = 0, k = 0; i < n; i++) { if (hs) { const m = T.road.length, dd = q => Math.hypot(T.road[q % m][0] - S[i].x, T.road[q % m][1] - S[i].z); while (dd(k + 1) <= dd(k)) k++; h[i] = +hs[k % m] || 12; } else h[i] = 12; }
    for (let pass = 0; pass < 4; pass++) { const o = new Float32Array(n), win = 30; let a = 0; for (let k = -win; k <= win; k++) a += h[(k + n) % n];
      for (let i = 0; i < n; i++) { o[i] = a / (2 * win + 1); a += h[(i + win + 1) % n] - h[(i - win + n) % n]; } h = o; }
    const t0 = lvl.terrain; for (let i = 0; i < n; i++) Y[i] = t0(X[i], Z[i]) + h[i];
    const G = new Map(), key = (a, b) => a * 4096 + b;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n, m = Math.max(1, Math.ceil(Math.hypot(X[j] - X[i], Z[j] - Z[i]) / (HC * 0.5)));
      for (let k = 0; k <= m; k++) { const kk = key(Math.floor((X[i] + (X[j] - X[i]) * k / m) / HC), Math.floor(-(Z[i] + (Z[j] - Z[i]) * k / m) / HC)); let L = G.get(kk); if (!L) G.set(kk, L = []); if (L[L.length - 1] !== i) L.push(i); } }
    // tramo más cercano a un punto: deja en N el índice, la distancia lateral y la altura del tablero
    const N = { i: 0, t: 0, d: 1e9, y: 0 };
    const near = (x, z, R = 1) => { N.d = 1e9; const cx = Math.floor(x / HC), cz = Math.floor(-z / HC);
      for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) { const L = G.get(key(cx + a, cz + b)); if (!L) continue;
        for (let q = 0; q < L.length; q++) { const i = L[q], j = i + 1 === n ? 0 : i + 1, dx = X[j] - X[i], dz = Z[j] - Z[i], l2 = dx * dx + dz * dz || 1; let t = ((x - X[i]) * dx + (z - Z[i]) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const ex = x - X[i] - dx * t, ez = z - Z[i] - dz * t, d = Math.sqrt(ex * ex + ez * ez); if (d < N.d) { N.d = d; N.i = i; N.t = t; N.y = Y[i] + (Y[j] - Y[i]) * t; } } }
      return N.d < 1e8; };
    lvl.terrain = (x, z, nrm) => { if (near(x, z) && N.d < hw + 1.4) { if (nrm) { nrm[0] = 0; nrm[1] = 1; nrm[2] = 0; } return N.y; } return t0(x, z, nrm); };
    lvl.kanjo = { n, X, Z, NX, NZ, SS, Y, hw, near, N, total: S.total, ground: t0, T };
    lvl.tunnel = (x, z) => near(x, z, 2) && N.d < hw + 2 && KJ.inTunnel(lvl.kanjo, SS[N.i]);   // eco dentro de los túneles
  };

  // ---------- texturas de fachada: ventanas encendidas y apagadas ----------
  function winTex(seed, pLit, lit, wall) {
    const W = 256, R = rnd(seed), d = new Uint8Array(W * W * 4);
    for (let i = 0; i < W * W; i++) { const v = 0.85 + ((i * 2654435761 >>> 24) / 255) * 0.3; d[i * 4] = wall[0] * v; d[i * 4 + 1] = wall[1] * v; d[i * 4 + 2] = wall[2] * v; d[i * 4 + 3] = 255; }
    for (let wy = 0; wy < 16; wy++) { const row = R() < 0.12;   // alguna planta entera a oscuras
      for (let wx = 0; wx < 16; wx++) { const on = !row && R() < pLit, b = on ? 0.55 + R() * 0.45 : 0.1 + R() * 0.06, c = on ? lit[R() * lit.length | 0] : [70, 85, 110];
        for (let y = 4; y < 13; y++) for (let x = 3; x < 14; x++) { const o = ((wy * 16 + y) * W + wx * 16 + x) * 4, e = (x === 8 || y === 4) ? 0.55 : 1; d[o] = c[0] * b * e; d[o + 1] = c[1] * b * e; d[o + 2] = c[2] * b * e; } } }
    return { w: W, h: W, data: d, smooth: true };
  }
  const WARM = [[255, 214, 150], [255, 228, 180], [255, 200, 120]], COOL = [[205, 228, 255], [235, 245, 255], [180, 215, 255]], MIX = [...WARM, ...COOL, [255, 240, 205]];
  const TEXS = () => [winTex(11, 0.42, WARM, [16, 15, 15]), winTex(23, 0.6, COOL, [12, 14, 18]), winTex(37, 0.25, MIX, [20, 18, 16]), winTex(51, 0.5, MIX, [9, 10, 12])];
  // tramos cubiertos (fracción de la vuelta): techo, paredes y luz amarilla de sodio
  const TUN = [[0.115, 0.165], [0.43, 0.475], [0.70, 0.765], [0.905, 0.935]];
  KJ.AMB_SKY = [2.7, 1.85, 0.6]; KJ.AMB_GND = [1.7, 1.15, 0.35];   // luz de sodio de los túneles sobre los coches
  KJ.inTunnel = (K, s) => { const f = (((s % K.total) + K.total) % K.total) / K.total; return TUN.some(t => f >= t[0] && f < t[1]); };
  const NEON = [[1, 0.15, 0.25], [0.2, 0.8, 1], [1, 0.75, 0.1], [0.3, 1, 0.45], [1, 0.35, 0.9], [1, 1, 1]];

  // ---------- la geometría ----------
  KJ.build = function (lvl, R) {
    const K = lvl.kanjo; if (!K) return null; const { n, X, Z, NX, NZ, SS, Y, hw, near, N, total, ground } = K, rr = rnd(20261113);
    const kit = () => { const mb = new BRR.MeshBuilder(null), g = mb.group('COLOR');
      const tri = (a, b, c, col) => { for (const v of [a, b, c, a, c, b]) { g.pos.push(v[0], v[1], v[2]); g.col.push(col[0], col[1], col[2]); g.lay.push(0); } };
      const quad = (a, b, c, d, col) => { tri(a, b, c, col); tri(a, c, d, col); };
      const box = (c, ax, az, hx, hz, y0, y1, col, top = col) => { const P = (sx, sz, y) => [c[0] + ax[0] * sx * hx + az[0] * sz * hz, y, c[2] + ax[2] * sx * hx + az[2] * sz * hz];   // caja orientada (ax, az: ejes en planta)
        const a = P(-1, -1, y0), b = P(1, -1, y0), cc = P(1, 1, y0), d = P(-1, 1, y0), e = P(-1, -1, y1), f = P(1, -1, y1), gg = P(1, 1, y1), hh = P(-1, 1, y1);
        quad(a, b, f, e, col); quad(b, cc, gg, f, col); quad(cc, d, hh, gg, col); quad(d, a, e, hh, col); quad(e, f, gg, hh, top); };
      return { mb, g, tri, quad, box }; };
    // punto de la carretera a una distancia s del inicio: centro, altura, tangente y lateral
    const at = s => { s = ((s % total) + total) % total; let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (SS[m] <= s) lo = m; else hi = m - 1; }
      const i = lo, j = (i + 1) % n, s1 = j ? SS[j] : total, t = Math.min(1, Math.max(0, (s - SS[i]) / Math.max(1e-6, s1 - SS[i]))), nx = NX[i] + (NX[j] - NX[i]) * t, nz = NZ[i] + (NZ[j] - NZ[i]) * t, l = Math.hypot(nx, nz) || 1;
      return { c: [X[i] + (X[j] - X[i]) * t, Y[i] + (Y[j] - Y[i]) * t, Z[i] + (Z[j] - Z[i]) * t], n: [nx / l, 0, nz / l], t: [nz / l, 0, -nx / l], i }; };
    const off = (q, o, dy = 0) => [q.c[0] + q.n[0] * o, q.c[1] + dy, q.c[2] + q.n[2] * o];
    const CONC = [0.5, 0.5, 0.49], CONC2 = [0.36, 0.36, 0.37], DARK = [0.13, 0.13, 0.14], LINE = [0.86, 0.86, 0.82], STEEL = [0.42, 0.44, 0.47], PANEL = [0.3, 0.36, 0.38];
    const tun = sv => KJ.inTunnel(K, sv), AMB = [1, 0.72, 0.22], lampK = sv => { const u = ((sv % 38) + 38) % 38 / 38; return 0.62 + 0.38 * (0.5 + 0.5 * Math.cos(u * 6.2832)); };
    const CH = 160, nch = Math.max(1, Math.round(total / CH)), len = total / nch, chunks = [];
    const noise = sd => { const blk = Math.floor(sd / 320); return ((blk * 9301 + 49297) % 233280) / 233280; };   // tramos con pantalla acústica
    for (let c = 0; c < nch; c++) { const A = kit(), Gl = kit(), tris = [], s0 = c * len, s1 = s0 + len, step = 6, m = Math.ceil(len / step), ds = len / m;
      const wallTri = (a, b, cc) => tris.push([a, b, cc]);
      for (let k = 0; k < m; k++) { const sa = s0 + k * ds, p = at(sa), q = at(sa + ds), sm = sa + ds / 2;
        const T0 = tun(sm), ka = lampK(sa), kb = lampK(sa + ds), g = Gl.g, RC = T0 ? [0.4, 0.29, 0.1] : [0.165, 0.155, 0.14];
        // calzada iluminada por las farolas (más clara debajo de cada una); en los túneles, ámbar
        { const P4 = [[off(p, -hw - 0.3, 0.07), ka], [off(p, hw + 0.3, 0.07), ka], [off(q, hw + 0.3, 0.07), kb], [off(q, -hw - 0.3, 0.07), kb]]; for (const k2 of [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]) { const v = P4[k2], b2 = T0 ? 1 : v[1]; g.pos.push(v[0][0], v[0][1], v[0][2]); g.col.push(RC[0] * b2, RC[1] * b2, RC[2] * b2); g.lay.push(4); } }
        for (const sd of [-1, 1]) { const o = sd * (hw + 0.35), o2 = sd * (hw + 0.7);
          wallTri(off(p, o), off(q, o), off(q, o, 4)); wallTri(off(p, o), off(q, o, 4), off(p, o, 4));   // choque: más alto que el murete (nadie salta fuera)
          A.quad(off(p, o2, 1.0), off(q, o2, 1.0), off(q, o2, -1.6), off(p, o2, -1.6), CONC2);   // canto del tablero
          if (T0) { Gl.quad(off(p, o), off(q, o), off(q, o, 5.4), off(p, o, 5.4), k % 2 ? [0.5, 0.36, 0.13] : [0.46, 0.33, 0.12]);   // pared del túnel, bañada de luz amarilla
            Gl.quad(off(p, o, 1.1), off(q, o, 1.1), off(q, o - sd * 0.04, 1.25), off(p, o - sd * 0.04, 1.25), [0.75, 0.55, 0.2]);   // franja
            A.quad(off(p, o2, 1.0), off(q, o2, 1.0), off(q, o2, 6.0), off(p, o2, 6.0), CONC2);   // por fuera
            continue; }
          A.quad(off(p, o), off(q, o), off(q, o, 1.0), off(p, o, 1.0), CONC);   // murete (cara de dentro)
          A.quad(off(p, o, 1.0), off(q, o, 1.0), off(q, o2, 1.0), off(p, o2, 1.0), CONC);
          const nz = noise(sm + (sd > 0 ? 5000 : 0)); if (nz < 0.42) { A.quad(off(p, o2, 1.0), off(q, o2, 1.0), off(q, o2, 3.8), off(p, o2, 3.8), k % 2 ? PANEL : [0.26, 0.31, 0.33]); A.quad(off(p, o2 + sd * 0.12, 3.8), off(q, o2 + sd * 0.12, 3.8), off(q, o2 - sd * 0.5, 4.5), off(p, o2 - sd * 0.5, 4.5), PANEL); }   // pantalla acústica con visera
        }
        if (T0) { Gl.quad(off(p, -hw - 0.35, 5.4), off(p, hw + 0.35, 5.4), off(q, hw + 0.35, 5.4), off(q, -hw - 0.35, 5.4), [0.2, 0.145, 0.05]);   // techo
          A.quad(off(p, -hw - 0.7, 6.0), off(p, hw + 0.7, 6.0), off(q, hw + 0.7, 6.0), off(q, -hw - 0.7, 6.0), DARK);
          if (!tun(sa - ds) || !tun(sa + 2 * ds)) { const e = tun(sa - ds) ? q : p; A.quad(off(e, -hw - 0.7, 5.4), off(e, hw + 0.7, 5.4), off(e, hw + 0.7, 6.6), off(e, -hw - 0.7, 6.6), CONC); }   // boca
          for (const sd of [-1, 1]) Gl.box(off(at(sm), sd * (hw - 0.9)), p.t, p.n, 1.6, 0.22, p.c[1] + 5.22, p.c[1] + 5.38, AMB); }   // lámparas de sodio, en dos filas
        A.quad(off(p, -hw - 0.7, -1.6), off(p, hw + 0.7, -1.6), off(q, hw + 0.7, -1.6), off(q, -hw - 0.7, -1.6), DARK);   // panza del tablero
      }
      // líneas de carril discontinuas (4 carriles)
      for (let s = Math.ceil(s0 / 12) * 12; s < s1; s += 12) { const p = at(s), q = at(s + 5); for (const o of [-hw / 2, 0, hw / 2]) { const g = Gl.g; for (const v of [off(p, o - 0.08, 0.1), off(p, o + 0.08, 0.1), off(q, o + 0.08, 0.1), off(p, o - 0.08, 0.1), off(q, o + 0.08, 0.1), off(q, o - 0.08, 0.1)]) { g.pos.push(v[0], v[1], v[2]); g.col.push(...(tun(s) ? [0.85, 0.66, 0.3] : LINE)); g.lay.push(6); } } }
      // pilares
      for (let s = Math.ceil(s0 / 36) * 36; s < s1; s += 36) { const p = at(s), gy = ground(p.c[0], p.c[2]); A.box(p.c, p.n, p.t, hw + 0.4, 1.1, p.c[1] - 3.2, p.c[1] - 1.6, CONC2); A.box(p.c, p.n, p.t, 1.6, 1.0, gy - 0.3, p.c[1] - 3.2, CONC); }
      // farolas (alternando lado): poste, brazo y luminaria encendida
      for (let s = Math.ceil(s0 / 38) * 38; s < s1; s += 38) { if (tun(s)) continue; const p = at(s), sd = Math.round(s / 38) % 2 ? 1 : -1, b = off(p, sd * (hw + 0.55));
        A.box(b, p.n, p.t, 0.09, 0.09, p.c[1] + 1, p.c[1] + 9.5, STEEL); A.box(off(p, sd * (hw - 0.6)), p.n, p.t, 1.2, 0.06, p.c[1] + 9.4, p.c[1] + 9.55, STEEL);
        Gl.box(off(p, sd * (hw - 1.5)), p.n, p.t, 0.55, 0.16, p.c[1] + 9.25, p.c[1] + 9.42, [1, 0.82, 0.52]); }
      // pórticos de señales
      for (let s = Math.ceil(s0 / 640) * 640 + 200; s < s1; s += 640) { if (s < s0 || tun(s)) continue; const p = at(s);
        for (const sd of [-1, 1]) A.box(off(p, sd * (hw + 0.55)), p.n, p.t, 0.18, 0.18, p.c[1] + 1, p.c[1] + 7.6, STEEL);
        A.box(p.c, p.n, p.t, hw + 0.7, 0.14, p.c[1] + 7.2, p.c[1] + 7.6, STEEL); A.box(p.c, p.n, p.t, hw + 0.7, 0.14, p.c[1] + 6.0, p.c[1] + 6.2, STEEL);
        const blue = rr() < 0.3; for (const o of [-hw * 0.5, hw * 0.5]) { const cc = off(p, o), f = [cc[0] - p.t[0] * 0.2, cc[1], cc[2] - p.t[2] * 0.2];
          Gl.box(f, p.n, p.t, 2.6, 0.05, p.c[1] + 5.4, p.c[1] + 7.9, blue ? [0.04, 0.16, 0.55] : [0.03, 0.3, 0.16]);
          for (let r = 0; r < 3; r++) Gl.box([f[0] - p.t[0] * 0.08, f[1], f[2] - p.t[2] * 0.08], p.n, p.t, 1.4 + (r % 2) * 0.7, 0.02, p.c[1] + 5.8 + r * 0.65, p.c[1] + 6.1 + r * 0.65, [0.9, 0.92, 0.9]); } }
      chunks.push({ A, Gl, tris, c: at(s0 + len / 2).c, s0, s1 });
    }
    // ---------- la ciudad ----------
    const B = new BRR.MeshBuilder(null), TX = TEXS(); TX.forEach((t, k) => B.textures.set('KJW' + k, t));
    const clear = (x, z, r) => !(near(x, z, 2) && N.d < r);
    const facade = (a, b, y0, y1, v, R2) => { const W = Math.hypot(b[0] - a[0], b[2] - a[2]), nx = Math.max(1, Math.round(W / 2.3)), ny = Math.max(1, Math.round((y1 - y0) / 3.1)), g = B.group('tex:KJW' + v);
      for (let ix = 0; ix < nx; ix += 16) for (let iy = 0; iy < ny; iy += 16) { const wx = Math.min(16, nx - ix), wy = Math.min(16, ny - iy), u0 = (R2() * (17 - wx) | 0) / 16, v0 = (R2() * (17 - wy) | 0) / 16, u1 = u0 + wx / 16, v1 = v0 + wy / 16;
        const P = (fx, fy) => [a[0] + (b[0] - a[0]) * fx, y0 + (y1 - y0) * fy, a[2] + (b[2] - a[2]) * fx], f0 = ix / nx, f1 = (ix + wx) / nx, g0 = iy / ny, g1 = (iy + wy) / ny;
        const q = [[P(f0, g0), [u0, v1]], [P(f1, g0), [u1, v1]], [P(f1, g1), [u1, v0]], [P(f0, g1), [u0, v0]]];
        for (const k of [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]) { g.pos.push(...q[k][0]); g.uv.push(...q[k][1]); g.lay.push(0); } } };
    const chunkOf = s => chunks[Math.min(nch - 1, Math.max(0, Math.floor((((s % total) + total) % total) / len)))];
    const building = (s, sd, setback, w, d, h, R2) => { const p = at(s), o = sd * (hw + 0.7 + setback + d / 2), c = off(p, o), gy = ground(c[0], c[2]);
      const P = (ax, az) => [c[0] + p.t[0] * ax * w / 2 + p.n[0] * az * d / 2, 0, c[2] + p.t[2] * ax * w / 2 + p.n[2] * az * d / 2], V = [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)];
      for (const v of V) if (!clear(v[0], v[2], hw + 4)) return false; if (!clear(c[0], c[2], hw + 4)) return false;
      const v = R2() * 4 | 0, y1 = gy + h; for (let k = 0; k < 4; k++) facade(V[k], V[(k + 1) % 4], gy, y1, v, R2);
      const Gl = chunkOf(s).Gl; Gl.quad([V[0][0], y1, V[0][2]], [V[1][0], y1, V[1][2]], [V[2][0], y1, V[2][2]], [V[3][0], y1, V[3][2]], [0.02, 0.02, 0.025]);
      if (h > 70) Gl.box([c[0], 0, c[2]], p.t, p.n, 0.5, 0.5, y1, y1 + 1.2, [1, 0.12, 0.06]);   // baliza roja
      if (R2() < 0.3 && h > p.c[1] - gy + 8) { const col = NEON[R2() * NEON.length | 0], fx = (R2() - 0.5) * 0.6, e = [c[0] + p.t[0] * fx * w - p.n[0] * sd * (d / 2 + 0.15), 0, c[2] + p.t[2] * fx * w - p.n[2] * sd * (d / 2 + 0.15)], yb = p.c[1] + 3 + R2() * Math.max(1, h - (p.c[1] - gy) - 12);
        if (R2() < 0.55) Gl.box(e, p.t, p.n, 0.9, 0.12, yb, yb + 5 + R2() * 6, col); else Gl.box(e, p.t, p.n, 3 + R2() * 3, 0.12, yb, yb + 1.8, col); }   // neón: vertical u horizontal
      return true; };
    for (const sd of [-1, 1]) { const R2 = rnd(sd > 0 ? 7001 : 9103);
      for (let s = 0; s < total;) { const w = 16 + R2() * 26, d = 14 + R2() * 22, u = R2(), h = u < 0.55 ? 20 + R2() * 28 : u < 0.88 ? 48 + R2() * 45 : 95 + R2() * 70; building(s + w / 2, sd, 5 + R2() * 16, w, d, h, R2); s += w + 3 + R2() * (R2() < 0.15 ? 40 : 9); }
      for (let s = 30; s < total;) { const w = 24 + R2() * 30, h = 60 + R2() * 130; building(s, sd, 70 + R2() * 110, w, 22 + R2() * 20, h, R2); s += w + 20 + R2() * 90; } }   // segunda fila: torres al fondo
    const out = { city: R.upload(B), chunks: chunks.map(q => ({ up: R.upload(q.A.mb), glow: q.Gl.g.pos.length ? R.upload(q.Gl.mb) : null, tris: q.tris, c: q.c })) };
    out.free = () => { if (R.free) { R.free(out.city); for (const q of out.chunks) { R.free(q.up); if (q.glow) R.free(q.glow); } } };
    return out;
  };

  // ---------- tráfico: coches que circulan por su carril a velocidad fija (la misma para todos los de un carril) ----------
  // Su posición solo depende del tiempo de carrera, así que en el online todos los jugadores ven el mismo tráfico.
  function tmesh(R, type, col) {
    const mk = () => { const mb = new BRR.MeshBuilder(null), g = mb.group('COLOR'); return { mb, bx: (x0, y0, z0, x1, y1, z1, c, top = c) => { const V = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
      for (const [f, cc] of [[[0, 1, 2, 3], c], [[5, 4, 7, 6], c], [[3, 2, 6, 7], top], [[4, 0, 3, 7], c], [[1, 5, 6, 2], c]]) for (const k of [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]) { const v = V[f[k]]; g.pos.push(v[0], v[1], v[2]); g.col.push(cc[0], cc[1], cc[2]); g.lay.push(0); } } }; };
    const A = mk(), G = mk(), GL = [0.05, 0.07, 0.1], BLK = [0.04, 0.04, 0.045], D = col.map(v => v * 0.72); let L, W, H;
    const wheels = (zs, w) => { for (const z of zs) for (const sx of [-1, 1]) A.bx(sx * w - 0.11, 0, z - 0.3, sx * w + 0.11, 0.6, z + 0.3, BLK); };
    const lights = (w, y, l, big) => { for (const sx of [-1, 1]) { G.bx(sx * w - 0.2, y, l - 0.02, sx * w + 0.2, y + (big ? 0.3 : 0.16), l + 0.04, [1, 0.1, 0.06]); G.bx(sx * w - 0.2, y - 0.05, -l - 0.04, sx * w + 0.2, y + 0.12, -l + 0.02, [1, 0.95, 0.8]); } };
    if (type === 'camion') { L = 8.4; W = 2.4; H = 3.3; A.bx(-1.15, 0.45, -4.2, 1.15, 2.6, -2.5, col, D); A.bx(-1.05, 1.5, -4.22, 1.05, 2.3, -4.18, GL); A.bx(-1.2, 0.9, -2.3, 1.2, 3.3, 4.2, [0.78, 0.79, 0.8], [0.6, 0.6, 0.62]); A.bx(-1.1, 0.5, -2.5, 1.1, 0.9, 4.1, BLK); wheels([-3.3, 2.2, 3.3], 1.05); lights(0.85, 0.75, 4.2, true); }
    else if (type === 'furgo') { L = 4.7; W = 1.8; H = 1.95; A.bx(-0.9, 0.3, -2.35, 0.9, 1.95, 2.35, col, D); A.bx(-0.84, 1.15, -2.37, 0.84, 1.8, -2.3, GL); A.bx(-0.92, 1.2, -1.9, 0.92, 1.75, -0.6, GL); wheels([-1.5, 1.5], 0.8); lights(0.62, 0.8, 2.35, true); }
    else if (type === 'kei') { L = 3.4; W = 1.48; H = 1.6; A.bx(-0.74, 0.28, -1.7, 0.74, 0.95, 1.7, col); A.bx(-0.7, 0.95, -1.05, 0.7, 1.6, 1.62, col, D); A.bx(-0.72, 1.02, -1.08, 0.72, 1.5, -1.0, GL); A.bx(-0.75, 1.02, -0.9, 0.75, 1.5, 1.4, GL); A.bx(-0.66, 1.05, 1.6, 0.66, 1.5, 1.65, GL); wheels([-1.15, 1.15], 0.64); lights(0.5, 0.7, 1.7); }
    else { L = 4.5; W = 1.74; H = 1.42; A.bx(-0.87, 0.26, -2.25, 0.87, 0.86, 2.25, col); A.bx(-0.76, 0.86, -0.75, 0.76, 1.42, 1.35, col, D); A.bx(-0.78, 0.92, -0.95, 0.78, 1.34, -0.7, GL); A.bx(-0.79, 0.94, -0.6, 0.79, 1.34, 1.2, GL); A.bx(-0.72, 0.94, 1.33, 0.72, 1.32, 1.5, GL); wheels([-1.4, 1.4], 0.76); lights(0.62, 0.62, 2.25);
      if (type === 'taxi') G.bx(-0.22, 1.42, -0.1, 0.22, 1.58, 0.12, [1, 0.85, 0.3]); }
    return { up: R.upload(A.mb), glow: R.upload(G.mb), box: { c: [0, H / 2, 0], h: [W / 2, H / 2, L / 2] }, len: L };
  }
  // modelos low poly del tráfico (trafmesh_data.js): pintura del color que toque, cristales, ruedas, embellecedores; las luces se encienden aparte
  const unb = (b, T) => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new T(u.buffer); };
  function tmesh3(R, M, col) {
    const v = unb(M.v, Int16Array), f = unb(M.f, Uint16Array), c = unb(M.c, Uint8Array), sc = M.sc, mb = new BRR.MeshBuilder(null), g = mb.group('COLOR');
    const C2 = col.map(x => Math.min(1, x * 0.55 + 0.4)), K = [col, C2, [0.05, 0.07, 0.1], [0.05, 0.05, 0.055], [0.62, 0.63, 0.66], [0.16, 0.16, 0.17], [0.95, 0.93, 0.8], [0.7, 0.05, 0.04]];
    for (let t = 0; t < c.length; t++) { const k = K[c[t]] || K[5]; for (const q of [0, 1, 2, 0, 2, 1]) { const i = f[t * 3 + q] * 3; g.pos.push(v[i] / sc, v[i + 1] / sc, v[i + 2] / sc); g.col.push(k[0], k[1], k[2]); g.lay.push(0); } }
    const G = new BRR.MeshBuilder(null), gg = G.group('COLOR'), L = M.L / 2, hw = M.W / 2, big = M.t === 'camion', y = big ? 0.85 : M.t === 'sedan' ? 0.62 : 0.8;
    const quad = (P, cc) => { for (const k of [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]) { gg.pos.push(P[k][0], P[k][1], P[k][2]); gg.col.push(cc[0], cc[1], cc[2]); gg.lay.push(0); } };
    for (const sx of [-1, 1]) { const x0 = sx * (hw - 0.22), x1 = sx * (hw - (big ? 0.6 : 0.5));
      quad([[x0, y, -L - 0.02], [x1, y, -L - 0.02], [x1, y + 0.16, -L - 0.02], [x0, y + 0.16, -L - 0.02]], [1, 0.95, 0.8]);
      quad([[x0, y + 0.05, L + 0.02], [x1, y + 0.05, L + 0.02], [x1, y + (big ? 0.35 : 0.22), L + 0.02], [x0, y + (big ? 0.35 : 0.22), L + 0.02]], [1, 0.1, 0.06]); }
    if (M.taxi) { const yt = M.H; for (const [a, b] of [[-0.25, 0.25]]) quad([[a, yt + 0.16, 0.2], [b, yt + 0.16, 0.2], [b, yt + 0.16, -0.05], [a, yt + 0.16, -0.05]], [1, 0.85, 0.3]); }
    const bk = [-1, 1].map(sx => { const B = new BRR.MeshBuilder(null), gb = B.group('COLOR'), x0 = sx * (hw - 0.02), x1 = sx * (hw - 0.24);
      for (const z of [-L - 0.03, L + 0.03]) for (const k of [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]) { const P = [[x0, y - 0.02, z], [x1, y - 0.02, z], [x1, y + 0.14, z], [x0, y + 0.14, z]][k]; gb.pos.push(P[0], P[1], P[2]); gb.col.push(1, 0.6, 0.05); gb.lay.push(0); } return R.upload(B); });
    return { up: R.upload(mb), glow: R.upload(G), bk, box: { c: [0, M.H / 2, 0], h: [hw, M.H / 2, L] }, len: M.L };
  }
  KJ.traffic = function (lvl, R, density) {
    const K = lvl.kanjo; if (!K) return null; const { n, X, Z, NX, NZ, SS, Y, hw, total } = K, rr = rnd(density === 'poco' ? 4242 : density === 'mucho' ? 9090 : 1717);
    const COLS = [[0.82, 0.82, 0.84], [0.1, 0.1, 0.12], [0.55, 0.57, 0.6], [0.6, 0.08, 0.08], [0.1, 0.2, 0.5], [0.85, 0.8, 0.6], [0.08, 0.3, 0.2]];
    const KINDS = []; const TM = BRR.TRAF_MESH;
    if (TM && TM.length) { const by = t => TM.filter(m => m.t === t), TRK = [[0.85, 0.85, 0.86], [0.12, 0.25, 0.55], [0.55, 0.08, 0.07], [0.15, 0.4, 0.2]];
      by('sedan').forEach((m, i) => { for (const c of [i % 7, (i + 3) % 7]) KINDS.push({ t: 'sedan', m: tmesh3(R, m, COLS[c]) }); });
      [...by('suv'), ...by('pickup')].forEach((m, i) => KINDS.push({ t: 'suv', m: tmesh3(R, m, COLS[(i * 2 + 1) % 7]) }));
      by('camion').forEach((m, i) => KINDS.push({ t: 'camion', m: tmesh3(R, m, TRK[i % 4]) }));
      by('sedan').slice(0, 2).forEach(m => KINDS.push({ t: 'taxi', m: tmesh3(R, { ...m, taxi: 1 }, [0.92, 0.72, 0.12]) })); }
    else for (const [t, cs] of [['sedan', [0, 1, 2, 3, 4]], ['kei', [0, 5, 6, 2]], ['furgo', [0, 2]], ['taxi', [1]], ['camion', [0, 4]]]) for (const c of cs) KINDS.push({ t, m: tmesh(R, t, t === 'taxi' ? [0.9, 0.7, 0.1] : COLS[c]) });
    const pick = lane => { const u = rr(), t = TM && TM.length ? (lane === 0 ? (u < 0.3 ? 'camion' : u < 0.55 ? 'suv' : 'sedan') : lane === 1 ? (u < 0.1 ? 'camion' : u < 0.35 ? 'suv' : u < 0.5 ? 'taxi' : 'sedan') : (u < 0.15 ? 'taxi' : u < 0.3 ? 'suv' : 'sedan')) : lane === 0 ? (u < 0.4 ? 'camion' : u < 0.6 ? 'furgo' : u < 0.8 ? 'kei' : 'sedan') : lane === 1 ? (u < 0.15 ? 'camion' : u < 0.35 ? 'furgo' : u < 0.55 ? 'kei' : u < 0.7 ? 'taxi' : 'sedan') : (u < 0.2 ? 'taxi' : u < 0.3 ? 'kei' : 'sedan'), L = KINDS.filter(k => k.t === t); return L[rr() * L.length | 0]; };
    const LW = 2 * hw / 4, SPD = [21, 24.5, 28, 31.5], gap = density === 'poco' ? 230 : density === 'mucho' ? 58 : 105, cars = [];   // 76–113 km/h; el carril rápido es el de dentro
    for (let lane = 0; lane < 4; lane++) for (let s = rr() * gap; s < total - 20;) { const k = pick(lane); if (!(s < 320 || s > total - 650)) cars.push({ lane, lag: 0, dO: 0, vO: 0, yaw: 0, yawV: 0, hitT: 0, s0: s, o: (lane - 1.5) * LW, spd: SPD[lane], k,
        p: [0, 0, 0], v: [0, 0, 0], w: [0, 0, 0], R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], def: { box: k.m.box, name: 'TRAFICO' }, m: k.t === 'camion' ? 9000 : 1400, kinematic: true, traffic: true, out: false, K: {}, lastHit: 0,
        applyImpulse() { }, speed() { return this.spd; }, forward() { return [-this.R[0][2], 0, -this.R[2][2]]; } }); s += k.m.len + 22 + rr() * gap * (lane === 3 ? 3 : lane === 2 ? 2 : 1.3); }
    const at = (s, c) => { s = ((s % total) + total) % total; let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (SS[m] <= s) lo = m; else hi = m - 1; }
      const i = lo, j = (i + 1) % n, s1 = j ? SS[j] : total, t = Math.min(1, Math.max(0, (s - SS[i]) / Math.max(1e-6, s1 - SS[i]))), nx = NX[i] + (NX[j] - NX[i]) * t, nz = NZ[i] + (NZ[j] - NZ[i]) * t, l = Math.hypot(nx, nz) || 1, ux = nx / l, uz = nz / l, tx = uz, tz = -ux;
      // sentido de la marcha: el de la carretera (s creciente)
      const dx = X[j] - X[i], dz = Z[j] - Z[i], sg = dx * tx + dz * tz < 0 ? -1 : 1, fx = tx * sg, fz = tz * sg;
      const oo = c.o + c.dO, cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), gx = fx * cy - fz * sy, gz = fx * sy + fz * cy;
      c.p[0] = X[i] + (X[j] - X[i]) * t + ux * oo; c.p[1] = Y[i] + (Y[j] - Y[i]) * t + 0.05; c.p[2] = Z[i] + (Z[j] - Z[i]) * t + uz * oo;
      c.v[0] = fx * c.spd + ux * c.vO; c.v[2] = fz * c.spd + uz * c.vO; c.R[0][0] = -gz; c.R[0][2] = -gx; c.R[2][0] = gx; c.R[2][2] = -gz; c.ux = ux; c.uz = uz; c.sg = sg; };
    const T = { cars, near: [], free() { if (R.free) for (const k of KINDS) { R.free(k.m.up); R.free(k.m.glow); if (k.m.bk) k.m.bk.forEach(b => R.free(b)); } } };
    // t: tiempo de carrera; focos: posiciones [x,z] de los coches de verdad y de la cámara. Solo se colocan los que están cerca
    // t: tiempo de carrera; reales: los coches de verdad. Solo se colocan los que están cerca de alguno.
    // Si tienen delante un coche más lento (parado en su carril, la parrilla de salida…) frenan y se quedan detrás, no lo arrollan
    T.frame = 0; T.update = (t, reales, dt) => { T.near.length = 0; T.frame++; const fs = []; for (const r of reales) if (K.near(r.p[0], r.p[2], 3)) { const i = K.N.i; fs.push({ s: SS[i] + K.N.t * ((i + 1 < n ? SS[i + 1] : total) - SS[i]), lat: (r.p[0] - X[i]) * NX[i] + (r.p[2] - Z[i]) * NZ[i], v: Math.hypot(r.v[0], r.v[2]) }); } if (!fs.length) return;
      const cd = (a, b) => { let d = a - b; if (d > total / 2) d -= total; if (d < -total / 2) d += total; return d; }, tt = Math.max(-8, t);
      for (const c of cars) { const s = c.s0 + c.spd * tt - c.lag; c.sNow = ((s % total) + total) % total; let ok = false; for (const f of fs) { const d = cd(c.sNow, f.s); if (d > -260 && d < 520) { ok = true; break; } } if (ok) T.near.push(c); }
      const p0 = fs[0]; T.miss = null;
      for (const c of T.near) { let slow = c.spd; const hl = c.k.m.len / 2, d2 = dt || 0;
        // de vez en cuando cambia de carril (con intermitente), si tiene hueco y no le viene nadie por ese lado
        if (!c.lc) { c.lcT = (c.lcT ?? (10 + Math.random() * 50)) - d2;
          if (c.lcT <= 0 && !(c.hitT > 0) && !c.dO) { c.lcT = 25 + Math.random() * 60; const to = c.lane + (Math.random() < 0.5 ? -1 : 1);
            if (to >= 0 && to <= 3 && (c.k.t !== 'camion' || to <= 1)) { const o2 = (to - 1.5) * LW; let free = true;
              for (const o of T.near) if (o !== c && (Math.abs(o.o + o.dO - o2) < LW * 0.9 || (o.lc && Math.abs(o.lc.to - o2) < LW * 0.9)) && Math.abs(cd(o.sNow, c.sNow)) < 40) { free = false; break; }
              for (const f of fs) { const d = cd(f.s, c.sNow); if (Math.abs(f.lat - o2) < LW * 1.2 && d > -90 && d < 30) { free = false; break; } }
              if (free) c.lc = { from: c.o, to: o2, lane: to, u: 0, side: Math.sign(o2 - c.o) }; } } }
        else { c.lc.u += d2 / 3.4; const u = Math.min(1, c.lc.u), e = u * u * (3 - 2 * u); c.o = c.lc.from + (c.lc.to - c.lc.from) * e;
          if (u >= 1) { const raw = c.s0 + c.spd * tt - c.lag; c.lane = c.lc.lane; c.o = c.lc.to; c.spd = SPD[c.lane]; c.s0 = raw - c.spd * tt + c.lag; c.lc = null; } }
        // pasar rozando (para los puntos del modo libre): el jugador lo adelanta con muy poco hueco de lado
        if (p0) { const d = cd(c.sNow, p0.s), cl = Math.abs(p0.lat - c.o - c.dO) - c.k.m.box.h[0] - 0.86; if (c.nmD != null && c.nmF === T.frame - 1 && c.nmD > 0 && d <= 0 && cl < 1.25 && cl > -0.2 && p0.v > c.spd + 4) T.miss = { cl, dv: p0.v - c.spd }; c.nmD = d; c.nmF = T.frame; }
        // golpe: sale despedido de su carril (de lado y girando), pierde velocidad y luego vuelve poco a poco a su sitio
        if (c.lastHit > 1.5 && c.hitBy && c.ux != null) { const o = c.hitBy, sd = (c.p[0] - o.p[0]) * c.ux + (c.p[2] - o.p[2]) * c.uz, k = Math.min(1, c.lastHit / 12) * (c.m > 5000 ? 0.35 : 1), sg = sd >= 0 ? 1 : -1;
          const lf = 0.35 + 0.65 * Math.min(1, Math.abs(sd) / 1.2); c.vO += sg * (1.5 + 6 * k) * lf; c.yawV += -sg * (0.4 + 1.5 * k) * lf; c.hitT = 1.0 + 1.2 * k; }   // de refilón sale más de lado que por detrás
        if (c.hitBy && !c.hitBy.traffic) c.hitBy.kjHit = (c.hitBy.kjHit || 0) + 1;   // para el logro «sin un rasguño»
        c.lastHit = 0; c.hitBy = null;
        if (c.hitT > 0 || c.dO || c.yaw) { c.hitT = Math.max(0, c.hitT - d2); c.dO += c.vO * d2; c.vO *= Math.exp(-2.2 * d2); c.yaw += c.yawV * d2; c.yawV *= Math.exp(-2.5 * d2); c.yaw = Math.max(-0.75, Math.min(0.75, c.yaw));
          const lim = hw - 1.2; if (c.o + c.dO > lim) { c.dO = lim - c.o; c.vO = -Math.abs(c.vO) * 0.3; } if (c.o + c.dO < -lim) { c.dO = -lim - c.o; c.vO = Math.abs(c.vO) * 0.3; }
          if (c.hitT > 0) slow = Math.min(slow, c.spd * 0.45); else { c.dO -= c.dO * Math.min(1, d2 * 0.8); c.yaw -= c.yaw * Math.min(1, d2 * 2.2); slow = Math.min(slow, c.spd * (Math.abs(c.dO) > 0.4 ? 0.75 : 1)); if (Math.abs(c.dO) < 0.05 && Math.abs(c.yaw) < 0.01) { c.dO = 0; c.yaw = 0; c.vO = 0; c.yawV = 0; } } }
        for (const f of fs) { const d = cd(f.s, c.sNow); if (d > 0 && d < hl + 7 + Math.max(0, c.spd - f.v) * 1.6 && Math.abs(f.lat - c.o - c.dO) < 2.4 && f.v < slow) slow = Math.max(0, f.v - 0.5); }
        for (const o of T.near) if (o !== c && Math.abs(o.o + o.dO - c.o - c.dO) < 2.3) { const d = cd(o.sNow, c.sNow); if (d > 0 && d < hl + o.k.m.len / 2 + 9) slow = Math.min(slow, (o.vNow ?? o.spd) * 0.8); }
        if (slow < c.spd) { c.lag += (c.spd - slow) * (dt || 0); c.sNow = (((c.s0 + c.spd * tt - c.lag) % total) + total) % total; }
        const sp = c.spd; c.spd = slow; at(c.sNow, c); c.spd = sp; c.vNow = slow; } };
    T.draw = (M4) => { const bl = (performance.now() / 380 | 0) % 2 === 0; let amb = false;
      for (const c of T.near) { const W = M4.fromRT(c.R, c.p), tu = KJ.inTunnel(K, c.sNow); if (tu !== amb && R.ambient) { amb = tu; if (tu) R.ambient(KJ.AMB_SKY, KJ.AMB_GND); else R.ambient(); }
        R.draw(c.k.m.up, W); R.drawGlow(c.k.m.glow, W, 1.6); if (c.lc && bl && c.k.m.bk) R.drawGlow(c.k.m.bk[c.lc.side * (c.sg || 1) > 0 ? 1 : 0], W, 1.8); }
      if (amb && R.ambient) R.ambient(); };
    return T;
  };
})();
