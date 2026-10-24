// Rivales del juego original: en Big Red Racing los coches de la máquina no "conducen", reproducen carreras grabadas
// por los programadores (0.REC … 5.REC dentro de cada circuito). Así lo hace WINRACE.EXE:
//  - cabecera de 40 bytes: tipo (2 o 3), nombre del circuito, coche (0/2), plaza en la parrilla, equipo y nº de muestras
//  - cada muestra: incrementos dx, dy, dz y de los tres ángulos (16 bits = 360°); el tipo 3 añade 2 bytes de estado
//  - una muestra cada 8 fotogramas; posición interpolada entre muestras
//  - "goma elástica": cada 32 fotogramas se acelera o frena la reproducción de TODOS los rivales según la posición
//    del jugador (1º → más rápidos, 2º-3º → velocidad normal, 5º o peor → más lentos), entre los límites de la orden
//    "speed min,normal,max" del circuito (por defecto &120,&200,&300; &200 = velocidad real de la grabación)
"use strict";
(function () {
  const BRR = window.BRR, V = BRR.V, S = BRR.S, A16 = 2 * Math.PI / 65536;
  const num = t => { const neg = t[0] === '-'; t = t.replace('-', ''); const v = t[0] === '&' ? parseInt(t.slice(1), 16) : parseInt(t, 10); return neg ? -v : v; };

  // matriz de rotación -> cuaternión [x, y, z, w]
  function m2q(m) {
    const t = m[0][0] + m[1][1] + m[2][2]; let x, y, z, w;
    if (t > 0) { const s = Math.sqrt(t + 1) * 2; w = s / 4; x = (m[2][1] - m[1][2]) / s; y = (m[0][2] - m[2][0]) / s; z = (m[1][0] - m[0][1]) / s; }
    else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; w = (m[2][1] - m[1][2]) / s; x = s / 4; y = (m[0][1] + m[1][0]) / s; z = (m[0][2] + m[2][0]) / s; }
    else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; w = (m[0][2] - m[2][0]) / s; x = (m[0][1] + m[1][0]) / s; y = s / 4; z = (m[1][2] + m[2][1]) / s; }
    else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; w = (m[1][0] - m[0][1]) / s; x = (m[0][2] + m[2][0]) / s; y = (m[1][2] + m[2][1]) / s; z = s / 4; }
    return [x, y, z, w];
  }
  // orientación del original (Ry·Rx·Rz en coordenadas originales) -> GL (x, -y, -z)
  function origQ(rx, ry, rz) { const M = BRR.rot(rx * A16, ry * A16, rz * A16), F = [1, -1, -1];
    return m2q(M.map((r, i) => r.map((v, j) => v * F[i] * F[j]))); }

  // lee las grabaciones del circuito; devuelve [] si no hay
  BRR.loadReplays = function (lvl) {
    const out = [];
    for (let k = 0; k < 6; k++) {
      const b = lvl.find(k + '.REC'); if (!b || b.length < 40) continue;
      const type = b[0], dv = new DataView(b.buffer, b.byteOffset, b.byteLength), n = dv.getUint16(0x20, true), sz = type === 3 ? 14 : 12;
      if ((type !== 2 && type !== 3) || !n || b.length < 40 + n * sz) continue;
      const D = new Int16Array(n * 6), X = new Uint8Array(n * 2);
      for (let i = 0; i < n; i++) { for (let j = 0; j < 6; j++) D[i * 6 + j] = dv.getInt16(40 + i * sz + j * 2, true); if (type === 3) { X[i * 2] = b[40 + i * sz + 12]; X[i * 2 + 1] = b[40 + i * sz + 13]; } }
      out.push({ file: k, type, n, D, X, veh: (b[0x1d] >> 1) & 1, team: b[0x1f] % 6, slot: type === 2 ? k : b[0x1e] });
    }
    // si varias grabaciones dicen salir de la misma plaza (helicópteros), cada una sale de la suya
    if (new Set(out.map(r => r.slot)).size !== out.length) out.forEach((r, i) => r.slot = r.file);
    // límites de velocidad de reproducción del circuito
    const m = (lvl.script || '').match(/^\s*speed\s+([^;\r\n]+)/m);
    let sp = [0x120, 0x200, 0x300]; if (m) { const v = m[1].split(/[\s,]+/).filter(Boolean).map(num); if (v.length >= 3 && v.every(isFinite)) sp = v.slice(0, 3); }
    out.speed = sp;
    return out;
  };

  // Trazada para la IA nueva sacada de una grabación original: una vuelta lanzada (la 2ª) con su velocidad.
  // Así los rivales con físicas siguen el mismo recorrido y ritmo que los del juego original, cada uno con su
  // grabación (y su carril y personalidad), en vez de una trazada calculada.
  BRR.replayLine = function (lvl, rec, x0, z0, a0, period) {
    const P = integrate(rec, x0, z0, a0), n = rec.n, sx = lvl.start.x / S, sz = -lvl.start.z / S;
    const d = i => Math.hypot(P[i * 6] - sx, P[i * 6 + 2] - sz);
    const argmin = (a, b) => { let bi = a; for (let i = a; i <= Math.min(n, b); i++) if (d(i) < d(bi)) bi = i; return bi; };
    const i1 = argmin(Math.floor(n * 0.2), Math.floor(n * 0.5)), i2 = argmin(i1 + Math.floor(n * 0.2), i1 + Math.floor(n * 0.5));
    if (i2 - i1 < 30 || d(i1) > 2500 || d(i2) > 2500) return null;
    // puntos cada 3 m con la velocidad grabada
    const raw = []; for (let i = i1; i < i2; i++) raw.push([P[i * 6] * S, 0, -P[i * 6 + 2] * S, Math.hypot(P[(i + 1) * 6] - P[i * 6], P[(i + 1) * 6 + 2] - P[i * 6 + 2]) * S / period]);
    const step = 3, res = []; let carry = 0;
    for (let k = 0; k < raw.length; k++) { const a = raw[k], b = raw[(k + 1) % raw.length], L = Math.hypot(b[0] - a[0], b[2] - a[2]);
      let q = carry; while (q < L) { const f = q / L; res.push([a[0] + (b[0] - a[0]) * f, 0, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f]); q += step; } carry = q - L; }
    const N = res.length; if (N < 20) return null;
    const pts = res.map(p => ({ p: [p[0], 0, p[2]], w: 10, vh: 3000, roomL: 2.5, roomR: 2.5, s: 0 }));
    pts.forEach((q, k) => { const nx = pts[(k + 1) % N].p; q.t = V.norm([nx[0] - q.p[0], 0, nx[2] - q.p[2]]); });
    // pasillo de la grabación (como el del recorrido en la IA calculada): por ahí se atraviesan vallas finas, que el original saltaba
    const cor = new Set(); for (const q of res) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) cor.add((Math.floor(q[0]) + dx) * 100000 + Math.floor(q[2]) + dz);
    return { mode: 'rec', pts, step, N, total: N * step, vrec: Float32Array.from(res, p => p[3]), corridorAt: (x, z) => cor.has(Math.floor(x) * 100000 + Math.floor(z)), fromRec: rec.file };
  };

  // posición absoluta de cada muestra a partir de la plaza de salida
  function integrate(rec, x0, z0, a0) {
    const n = rec.n, P = new Float64Array((n + 1) * 6), D = rec.D;
    P[0] = x0; P[1] = 0; P[2] = z0; P[3] = 0; P[4] = a0; P[5] = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < 6; j++) P[(i + 1) * 6 + j] = P[i * 6 + j] + D[i * 6 + j];
    return P;
  }
  // velocidad característica de una grabación (unidades originales por muestra, percentil 90)
  BRR.replayPace = function (rec) { const v = []; for (let i = 0; i < rec.n; i++) v.push(Math.hypot(rec.D[i * 6], rec.D[i * 6 + 2])); v.sort((a, b) => a - b); return v[Math.floor(v.length * 0.9)] || 1; };

  // banda elástica compartida por todos los rivales grabados
  BRR.ReplayBand = class {
    constructor(speed, mul) { this.min = speed[0] * mul; this.nom = speed[1] * mul; this.max = speed[2] * mul; this.rate = this.nom; this.acc = 0; }
    reset() { this.rate = this.nom; this.acc = 0; this.age = 0; }
    // pos = puesto (0 = primero) del mejor jugador humano
    update(dt, pos) {
      this.age = (this.age || 0) + dt; if (this.age < 8 || !this.global) return;   // la salida, a ritmo normal; la goma global del original solo si se pide
      this.acc += dt; const TICK = 32 / 70;
      while (this.acc >= TICK) { this.acc -= TICK; const st = 0x10;
        if (pos <= 0) { if (this.rate < this.max) this.rate = Math.min(this.max, this.rate + st); }
        else if (pos <= 2) { if (this.rate < this.nom) this.rate = Math.min(this.nom, this.rate + st); else if (this.rate > this.nom) this.rate = Math.max(this.nom, this.rate - st); }
        else if (pos >= 4) { if (this.rate > this.min) this.rate = Math.max(this.min, this.rate - st); }
      }
    }
  };

  // un rival que reproduce una grabación
  BRR.ReplayDriver = class {
    constructor(car, race, rec, band, period) { this.car = car; this.race = race; this.rec = rec; this.band = band; this.period = period; car.kinematic = true; this.reset(); }
    // plaza de salida (coordenadas originales) y ángulo de 16 bits
    setStart(x0, z0, a0) { this.P = integrate(this.rec, x0, z0, a0); this.reset(); }
    reset() { this.rate = null; this.t = 0; this.loopFrom = null; this.off = [0, 0, 0]; this.lapsSeen = 0; this.hOff = null; this.up = null; this.done = false; this.lastSp = null; }
    // goma elástica por coche (más suave que la del original, que aceleraba o frenaba a todos a la vez):
    // el que va muy por delante del jugador afloja y el que va muy por detrás aprieta, sin cambios bruscos
    adjust(gap, dt) { const B = this.band; if (this.rate == null) this.rate = B.nom; if ((B.age || 0) < 8) return;
      const f = gap > 0 ? 1 - Math.min(0.3, gap / 600) : 1 + Math.min(0.22, -gap / 500);
      const tgt = Math.max(B.min, Math.min(B.max, B.nom * f)), st = B.nom * 0.08 * dt;
      this.rate += Math.max(-st, Math.min(st, tgt - this.rate)); }
    // diferencia entre la altura grabada y la del suelo (mediana de toda la carrera, fuera de túneles)
    calib() { const c = this.car, lvl = c.lvl, P = this.P, n = this.rec.n, d = [];
      this.low = Math.min(...c.W.map(w => w.c[1] - (w.radius || 0.4)));
      for (let i = 0; i <= n; i += 3) { const x = P[i * 6] * S, z = -P[i * 6 + 2] * S; if (lvl.tunnel && lvl.tunnel(x, z)) continue; d.push(-P[i * 6 + 1] * S - (lvl.terrain(x, z) - this.low)); }
      d.sort((a, b) => a - b); this.hOff = d.length ? d[Math.floor(d.length * 0.3)] : 0; }
    sample(t, o) { const P = this.P, n = this.rec.n, i = Math.max(0, Math.min(n - 1, Math.floor(t))), f = Math.max(0, Math.min(1, t - i)), a = i * 6, b = a + 6;
      for (let j = 0; j < 6; j++) o[j] = P[a + j] + (P[b + j] - P[a + j]) * f; return o; }
    update(dt) {
      const c = this.car, r = this.race; if (!this.P) return;
      const prev = c.p.slice();
      if (r.phase === 'race' || r.phase === 'finished') {
        // al terminar la primera vuelta se apunta dónde empieza la segunda (para repetir vueltas si la grabación se acaba)
        if (r.lapTimes.length > this.lapsSeen) { this.lapsSeen = r.lapTimes.length; if (this.lapsSeen === 1) this.loopFrom = this.t; }
        this.t += dt / this.period * ((this.rate || this.band.nom) / 0x200);
        const end = this.rec.n;
        if (this.t >= end) {
          if (r.phase === 'finished' || this.loopFrom === null) { this.t = end; this.done = true; }
          else { const a = this.sample(end, []), b = this.sample(this.loopFrom, []);
            this.off = [this.off[0] + (a[0] - b[0]), this.off[1] + (a[1] - b[1]), this.off[2] + (a[2] - b[2])]; this.t = this.loopFrom + (this.t - end); }
        }
      }
      const s = this.sample(this.t, this.tmp || (this.tmp = []));
      // la diferencia acumulada al repetir vueltas se reabsorbe poco a poco
      if (this.off[0] || this.off[2]) { const k = Math.min(1, dt * 0.4); for (let j = 0; j < 3; j++) this.off[j] *= 1 - k; }
      const x = (s[0] + this.off[0]) * S, z = -(s[2] + this.off[2]) * S, lvl = c.lvl;
      // altura: la grabación dice cuánto va por encima del suelo; se apoya sobre el suelo real (terreno, puentes, rampas)
      if (this.hOff == null) this.calib();
      const yRec = -(s[1] + this.off[1]) * S, low = this.low, fly = c.K && c.K.fly;
      let y = yRec - this.hOff, n = null;
      if (!fly) {
        const top = Math.max(y, lvl.terrain(x, z)) + 2.5, hit = BRR.raycast(lvl, [x, top, z], [0, -1, 0], 12);
        const gy = hit ? top - hit.t : lvl.terrain(x, z), want = gy - low;
        if (y < want + 0.6) { y = want; n = hit && hit.n && hit.n[1] > 0.4 ? hit.n : null; if (!n) { const nn = [0, 1, 0]; lvl.terrain(x, z, nn); n = nn; } }   // en el suelo: pegado
        else y = Math.max(y, want);
      } else y = yRec - this.hOff;
      c.p = [x, y, z];
      // orientación: rumbo de la grabación; inclinación según el suelo (en el aire, se conserva suavizada)
      const yaw = -s[4] * A16, f = [-Math.sin(yaw), 0, -Math.cos(yaw)];
      const up0 = this.up || [0, 1, 0], upT = n || (fly ? [0, 1, 0] : up0), k = Math.min(1, dt * (n ? 12 : 2));
      let up = V.norm([up0[0] + (upT[0] - up0[0]) * k, up0[1] + (upT[1] - up0[1]) * k, up0[2] + (upT[2] - up0[2]) * k]); this.up = up;
      const fd = V.norm(V.sub(f, V.mul(up, V.dot(f, up)))), rt = V.cross(fd, up), bk = V.mul(fd, -1);
      c.q = m2q([[rt[0], up[0], bk[0]], [rt[1], up[1], bk[1]], [rt[2], up[2], bk[2]]]);
      c.v = dt > 0 ? [(c.p[0] - prev[0]) / dt, (c.p[1] - prev[1]) / dt, (c.p[2] - prev[2]) / dt] : [0, 0, 0];
      if (Math.hypot(c.v[0], c.v[2]) > 120) c.v = [0, 0, 0];   // salto al repetir vuelta
      c.w = [0, 0, 0];
      // aspecto: ruedas girando y dirección según el giro de la grabación
      const sp = c.speed ? c.speed() : 0, yawRate = (this.lastYaw != null ? ((s[4] - this.lastYaw) * A16) : 0) / Math.max(dt, 1e-3); this.lastYaw = s[4];
      c.steerAng = Math.max(-0.5, Math.min(0.5, (c.steerAng || 0) * 0.8 + 0.2 * (-yawRate * (c.wheelBase || 2.5) / Math.max(3, Math.abs(sp))) ));
      for (const w of c.W) { w.spinRate = sp / (w.radius || 0.4); w.spin += w.spinRate * dt; w.len = w.prevLen = 0.3; w.contact = !fly; }
      c.grounded = true; c.throttleVis = 1;
      // caída de un salto (para la bocina)
      if (this.vyPrev != null && this.vyPrev < -7 && c.v[1] > -1.5) c.landed = -this.vyPrev; this.vyPrev = c.v[1];
      // luces de freno cuando la grabación decelera
      const hs = Math.hypot(c.v[0], c.v[2]); if (this.lastSp != null && dt > 0 && (this.lastSp - hs) / dt > 5) this.brakeT = 0.35; this.lastSp = hs;
      this.brakeT = Math.max(0, (this.brakeT || 0) - dt); c.brakeLight = this.brakeT > 0;
    }
  };
})();
