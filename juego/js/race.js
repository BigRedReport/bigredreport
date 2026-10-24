// Lógica de carrera: puntos de control, vueltas, cronómetro, sentido contrario
"use strict";
(function () {
  const BRR = window.BRR, V = BRR.V;
  BRR.Race = class {
    constructor(lvl, laps) {
      this.lvl = lvl; this.laps = laps; this.ev = [];
      // recorrido (polilínea cerrada) con longitud acumulada
      const P = lvl.course; this.P = P; const n = P.length; this.cum = [0];
      for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; this.cum.push(this.cum[i] + Math.hypot(b[0] - a[0], b[2] - a[2])); }
      this.total = this.cum[n];
      // puertas: las del mapa (objetos CHECKP) o, si no hay, generadas sobre el recorrido
      let gates = lvl.checkpoints.map(c => ({ ...c }));
      if (!gates.length && n > 3) {
        const k = 4; for (let j = 0; j < k; j++) {
          const i = Math.floor(j * n / k), a = P[i], b = P[(i + 1) % n], t = V.norm([b[0] - a[0], 0, b[2] - a[2]]);
          gates.push({ num: j, last: j === k - 1, c: a, ax: [-t[2], 0, t[0]], az: t, hw: 32 });
        }
      }
      for (const g of gates) { // sentido de paso hacia delante según el recorrido (tramo alineado con la puerta)
        const s = this.project(g.c, { axis: g.az }); g.s = s.s; g.fwdSign = Math.sign(V.dot(g.az, s.t)) || 1;
      }
      this.gates = gates; this.maxNum = Math.max(0, ...gates.map(g => g.num));
      this.reset();
    }
    reset() {
      this.lastGate = null;
      this.phase = 'countdown'; this.cd = 3.6; this.t = 0; this.lap = 0; this.lapStart = 0; this.lapTimes = [];
      this.wrongT = 0; this.wrong = false; this.prev = null; this.armed = false; this.passed = 0; this.finishT = null; this.progress = 0;
      // primer control esperado: el siguiente por delante de la salida
      const sy = this.lvl.start.yaw, sp = this.project(this.lvl.startPos, { dir: [-Math.sin(sy), 0, -Math.cos(sy)] });
      this.seg = sp.i; const s0 = sp.s; let best = null;
      for (const g of this.gates) { let d = g.s - s0; if (d < 0) d += this.total; if (!best || d < best.d) best = { d, num: g.num }; }
      this.expected = best ? best.num : 0;
      this.armed = this.expected !== 0;
    }
    // proyección sobre el recorrido: {s (distancia), t (tangente), i}
    // opt.dir: preferir tramos en esa dirección; opt.axis: preferir tramos paralelos al eje; opt.near: buscar cerca de ese tramo
    project(p, opt = {}) {
      const P = this.P, n = P.length; let best = null;
      const idx = opt.near != null ? Array.from({ length: 13 }, (_, k) => (opt.near + k - 4 + n) % n) : Array.from({ length: n }, (_, k) => k);
      for (const i of idx) {
        const a = P[i], b = P[(i + 1) % n], ab = [b[0] - a[0], b[2] - a[2]], l2 = ab[0] * ab[0] + ab[1] * ab[1] || 1;
        let u = ((p[0] - a[0]) * ab[0] + (p[2] - a[2]) * ab[1]) / l2; u = Math.max(0, Math.min(1, u));
        const L = Math.sqrt(l2), t = [ab[0] / L, 0, ab[1] / L], q = [a[0] + ab[0] * u, a[2] + ab[1] * u];
        let d2 = (p[0] - q[0]) ** 2 + (p[2] - q[1]) ** 2;
        if (opt.dir && V.dot(t, opt.dir) < 0.3) d2 = d2 * 4 + 400;
        if (opt.axis && Math.abs(V.dot(t, opt.axis)) < 0.5) d2 = d2 * 4 + 400;
        if (!best || d2 < best.d2) best = { d2, i, s: this.cum[i] + u * L, t };
      }
      return best;
    }
    emit(type, data = {}) { this.ev.push({ type, ...data }); }
    // puntuación para ordenar posiciones: controles pasados + fracción hasta el siguiente
    score() {
      if (this.phase === 'finished') return 1e6 - this.finishT;
      const sNow = (this.progress || 0) * this.total; let best = 1e9;
      for (const g of this.gates) if (g.num === this.expected) best = Math.min(best, ((g.s - sNow) % this.total + this.total) % this.total);
      const seg = this.total / (this.maxNum + 1);
      return this.passed + 1 - Math.min(1, best / seg) * 0.999;
    }
    update(dt, car) {
      if (this.phase === 'countdown') {
        const before = Math.ceil(this.cd); this.cd -= dt; const after = Math.ceil(this.cd);
        if (after !== before && after > 0) this.emit('beep', { n: after });
        if (this.cd <= 0) { this.phase = 'race'; this.t = 0; this.lapStart = 0; this.emit('go'); }
        this.prev = car.p.slice(); return;
      }
      if (this.phase !== 'race') { this.prev = car.p.slice(); return; }
      this.t += dt;
      const p = car.p, q = this.prev || p;
      for (const g of this.gates) {
        const z0 = V.dot(V.sub(q, g.c), g.az), z1 = V.dot(V.sub(p, g.c), g.az);
        if ((z0 < 0) === (z1 < 0)) continue;
        const u = z0 / (z0 - z1), m = V.add(q, V.mul(V.sub(p, q), u)), d = V.sub(m, g.c);
        if (Math.abs(V.dot(d, g.ax)) > g.hw + 2 || Math.abs(d[1]) > 30) continue;
        if (Math.sign(z1 - z0) !== g.fwdSign) continue;          // paso hacia atrás: no cuenta
        this.cross(g);
      }
      // seguimiento sobre el recorrido con continuidad (los circuitos se cruzan consigo mismos)
      let pr = this.project(p, { near: this.seg });
      if (pr.d2 > 45 * 45) { const v = V.len(car.v) > 2 ? V.norm(car.v) : car.forward(); pr = this.project(p, { dir: v }); }
      this.seg = pr.i;
      // sentido contrario
      const sp = V.len(car.v);
      const wrongNow = sp > 4 && V.dot(car.v, pr.t) < -0.4 * sp;
      this.wrongT = wrongNow ? this.wrongT + dt : Math.max(0, this.wrongT - dt * 2);
      const w = this.wrongT > 1.2; if (w !== this.wrong) { this.wrong = w; if (w) this.emit('wrong'); }
      this.progress = pr.s / this.total;
      this.prev = p.slice();
    }
    cross(g) {
      if (g.num === this.expected) {
        this.passed++; this.lastGate = g;
        if (g.num === 0 && this.armed) {               // línea de meta
          const lt = this.t - this.lapStart; this.lapTimes.push(lt); this.lapStart = this.t; this.lap++;
          if (this.lap >= this.laps) { this.phase = 'finished'; this.finishT = this.t; this.emit('finish', { lapTime: lt, total: this.t }); }
          else this.emit('lap', { lapTime: lt, lap: this.lap, final: this.lap === this.laps - 1 });
        } else if (g.num !== 0) this.emit('check', { num: g.num, of: this.maxNum, split: this.t - this.lapStart });
        this.armed = true;
        this.expected = g.num >= this.maxNum ? 0 : g.num + 1;
      } else if (g.num !== (this.expected + this.maxNum) % (this.maxNum + 1)) {
        // te has saltado al menos un control (no avisa por el que acabas de pasar)
        if (this.lastMiss !== g || this.t - (this.lastMissT || 0) > 3) { this.emit('missed', { num: this.expected }); this.lastMiss = g; this.lastMissT = this.t; }
      }
    }
  };
})();
