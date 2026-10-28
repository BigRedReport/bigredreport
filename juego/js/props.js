// Objetos derribables (conos, señales, plantas, banderas): salen volando al golpearlos
"use strict";
(function () {
  const BRR = window.BRR, V = BRR.V;
  const mm = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  const axisRot = (ax, a) => { const [x, y, z] = ax, c = Math.cos(a), s = Math.sin(a), t = 1 - c;
    return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]]; };
  BRR.isCritter = o => /SHEEP|COW|CHICK|PIG|DUCK/.test(o.name);
  BRR.Props = class {
    constructor(lvl, R) {
      this.lvl = lvl; this.R = R; this.models = new Map(); this.list = []; this.grid = new Map();
      for (const p of lvl.props) {
        if (!this.models.has(p.name)) {
          const m = lvl.getModel(p.name), mb = new BRR.MeshBuilder(lvl.pal);
          mb.addModel(m, v => BRR.toGL(v[0], v[1], v[2]), n => lvl.find(n + '.TM'));
          this.models.set(p.name, R.upload(mb));
          // animales (ovejas...): como en el original, al pisarlos quedan aplastados y rojos
          if (BRR.isCritter(p)) { const P = lvl.pal, red = new Uint8Array(P);
            for (let c = 0; c < 256; c++) { const l = (0.3 * P[c * 3] + 0.59 * P[c * 3 + 1] + 0.11 * P[c * 3 + 2]) / 255; red[c * 3] = Math.min(255, 90 + l * 200); red[c * 3 + 1] = l * 30; red[c * 3 + 2] = l * 25; }
            const mr = new BRR.MeshBuilder(red); mr.addModel(m, v => BRR.toGL(v[0], v[1], v[2]), () => null); this.models.set(p.name + '#rojo', R.upload(mr)); }
        }
        const o = { ...p, p0: p.o.slice(), R0: p.R, pos: p.o.slice(), rot: p.R, v: null, w: null, t: 0 };
        this.list.push(o);
        const k = this.key(o.pos[0], o.pos[2]); if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(o);
      }
    }
    key(x, z) { return Math.floor(x / 8) * 65536 + Math.floor(z / 8); }
    reset() { for (const o of this.list) { o.pos = o.p0.slice(); o.rot = o.R0; o.v = null; o.t = 0; o.squash = 0; } }
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
            if (BRR.isCritter(o)) {   // aplastado: se queda en el sitio, plano y rojo
              o.v = [0, 0, 0]; o.t = 8; o.squash = 1; o.pos = [o.pos[0], this.lvl.terrain(o.pos[0], o.pos[2]) + 0.03, o.pos[2]];
              o.rot = o.R0.map(r => [r[0] * 1.35, r[1] * 0.12, r[2] * 1.35]);
              c.v = V.mul(c.v, 0.99); hits.push({ o, car: c, speed: Math.max(sp, 8) }); continue; }
            const push = V.norm([dx, 0, dz]);
            o.v = V.add(V.mul(c.v, 0.85), [push[0] * 3 + (Math.random() - .5) * 2, 3 + sp * 0.18, push[2] * 3 + (Math.random() - .5) * 2]);
            // plantas y circuitos de lanchas: giro libre (queda bien); carteles y demás: se vuelcan hacia atrás, sobre un eje horizontal
            const free = /PLANT|TREE|SHRUB|BUSH|GRASS|FLOWER|CACT|PALM|FERN|BAMB|WEED/.test(o.name || '') || /^WATER/.test(this.lvl.name || '');
            o.w = free ? { ax: V.norm([Math.random() - .5, Math.random() - .5, Math.random() - .5]), r: 4 + Math.random() * 8 }
              : { ax: V.norm(V.add(V.cross([0, 1, 0], push), [(Math.random() - .5) * 0.25, (Math.random() - .5) * 0.15, (Math.random() - .5) * 0.25])), r: 3 + Math.random() * 4 + sp * 0.12 }; o.t = 0;   // positivo: la parte de arriba se va hacia donde lo empujan
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
        this.R.draw(this.models.get(o.squash ? o.name + '#rojo' : o.name), BRR.M4.fromRT(o.rot, o.pos));
      }
    }
  };
})();
