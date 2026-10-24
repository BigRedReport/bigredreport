// Objetos derribables (conos, señales, plantas, banderas): salen volando al golpearlos
"use strict";
(function () {
  const BRR = window.BRR, V = BRR.V;
  const mm = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  const axisRot = (ax, a) => { const [x, y, z] = ax, c = Math.cos(a), s = Math.sin(a), t = 1 - c;
    return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]]; };
  BRR.Props = class {
    constructor(lvl, R) {
      this.lvl = lvl; this.R = R; this.models = new Map(); this.list = []; this.grid = new Map();
      for (const p of lvl.props) {
        if (!this.models.has(p.name)) {
          const m = lvl.getModel(p.name), mb = new BRR.MeshBuilder(lvl.pal);
          mb.addModel(m, v => BRR.toGL(v[0], v[1], v[2]), n => lvl.find(n + '.TM'));
          this.models.set(p.name, R.upload(mb));
        }
        const o = { ...p, p0: p.o.slice(), R0: p.R, pos: p.o.slice(), rot: p.R, v: null, w: null, t: 0 };
        this.list.push(o);
        const k = this.key(o.pos[0], o.pos[2]); if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(o);
      }
    }
    key(x, z) { return Math.floor(x / 8) * 65536 + Math.floor(z / 8); }
    reset() { for (const o of this.list) { o.pos = o.p0.slice(); o.rot = o.R0; o.v = null; o.t = 0; } }
    // golpes de coches; devuelve los objetos golpeados (para el sonido)
    update(dt, cars) {
      const hits = [];
      for (const c of cars) {
        const sp = V.len(c.v); if (sp < 1) continue;
        const ix = Math.floor(c.p[0] / 8), iz = Math.floor(c.p[2] / 8);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
          const l = this.grid.get((ix + a) * 65536 + iz + b); if (!l) continue;
          for (const o of l) {
            if (o.v) continue;
            const dx = o.pos[0] - c.p[0], dz = o.pos[2] - c.p[2], dy = o.pos[1] - c.p[1];
            if (dx * dx + dz * dz > (o.r + 1.6) ** 2 || Math.abs(dy) > 4) continue;
            const push = V.norm([dx, 0, dz]);
            o.v = V.add(V.mul(c.v, 0.85), [push[0] * 3 + (Math.random() - .5) * 2, 3 + sp * 0.18, push[2] * 3 + (Math.random() - .5) * 2]);
            o.w = { ax: V.norm([Math.random() - .5, Math.random() - .5, Math.random() - .5]), r: 4 + Math.random() * 8 }; o.t = 0;
            c.v = V.mul(c.v, o.cls === 4 ? 0.985 : 0.96);
            hits.push({ o, car: c, speed: sp });
          }
        }
      }
      for (const o of this.list) {
        if (!o.v) continue;
        o.t += dt; if (o.t > 8) continue;
        o.v[1] -= 9.81 * dt; o.pos = V.madd(o.pos, o.v, dt);
        const g = this.lvl.terrain(o.pos[0], o.pos[2]);
        if (o.pos[1] < g) { o.pos[1] = g; o.v = [o.v[0] * 0.6, Math.abs(o.v[1]) * 0.3, o.v[2] * 0.6]; o.w.r *= 0.6; if (V.len(o.v) < 0.5) o.t = 8; }
        o.rot = mm(axisRot(o.w.ax, o.w.r * dt), o.rot);
      }
      return hits;
    }
    draw(cam, far) {
      const f2 = far * far;
      for (const o of this.list) {
        const dx = o.pos[0] - cam[0], dz = o.pos[2] - cam[2]; if (dx * dx + dz * dz > f2) continue;
        this.R.draw(this.models.get(o.name), BRR.M4.fromRT(o.rot, o.pos));
      }
    }
  };
})();
