// Efectos: polvo, salpicaduras, chispas y marcas de neumático (con transparencia)
"use strict";
(function () {
  const BRR = window.BRR, V = BRR.V;
  BRR.Effects = class {
    constructor(gl, lvl) {
      this.gl = gl; this.lvl = lvl; this.parts = []; this.marks = []; this.maxMarks = 2600; this.last = new Map();
      const VS = `#version 300 es
in vec3 p; in vec2 uv; in vec4 col; uniform mat4 VP; out vec2 vuv; out vec4 vcol; out vec3 wp;
void main(){ vuv=uv; vcol=col; wp=p; gl_Position=VP*vec4(p,1.); }`;
      const FS = `#version 300 es
precision highp float; in vec2 vuv; in vec4 vcol; in vec3 wp; uniform vec3 cam; uniform float far; uniform vec3 fogc; out vec4 o;
void main(){ float a=vcol.a;
  if(vuv.x>=0.){ vec2 q=vuv*2.-1.; float r=dot(q,q); if(r>1.) discard; a*=1.-smoothstep(.25,1.,r); }
  float f=clamp((length(wp-cam)-far*.55)/(far*.45),0.,1.); o=vec4(mix(vcol.rgb,fogc,f),a*(1.-f)); }`;
      const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
      const pr = this.pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
      gl.bindAttribLocation(pr, 0, 'p'); gl.bindAttribLocation(pr, 1, 'uv'); gl.bindAttribLocation(pr, 2, 'col'); gl.linkProgram(pr);
      this.U = {}; for (const n of ['VP', 'cam', 'far', 'fogc']) this.U[n] = gl.getUniformLocation(pr, n);
      this.vao = gl.createVertexArray(); this.buf = gl.createBuffer(); gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      const st = 9 * 4; gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, st, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, st, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, st, 20);
      gl.bindVertexArray(null); this.data = new Float32Array(9 * 6 * 6000);
    }
    reset() { this.parts.length = 0; this.marks.length = 0; this.last.clear(); }
    puff(p, v, col, size, life, grow = 1.6, n = 1, spread = 0.6) {
      const dn = this.density ?? 1; n = dn >= 1 ? Math.round(n * dn) : (Math.random() < dn ? n : 0);   // cantidad de partículas (opciones)
      for (let k = 0; k < n; k++) {
        if (this.parts.length > 1400 * Math.max(1, dn)) this.parts.shift();
        this.parts.push({ p: [p[0] + (Math.random() - .5) * spread, p[1] + Math.random() * 0.2, p[2] + (Math.random() - .5) * spread],
          v: [v[0] + (Math.random() - .5) * 1.5, v[1] + Math.random() * 1.2, v[2] + (Math.random() - .5) * 1.5], col, size, life, age: 0, grow });
      }
    }
    flame(p, back, v) {   // llamarada del nitro
      for (let k = 0; k < 2; k++) this.parts.push({ p: [p[0] + (Math.random() - .5) * .2, p[1] + (Math.random() - .5) * .2, p[2] + (Math.random() - .5) * .2],
        v: [v[0] * 0.7 + back[0] + (Math.random() - .5), v[1] * 0.7 + Math.random() * 0.6, v[2] * 0.7 + back[2] + (Math.random() - .5)],
        col: k ? [1, 0.55, 0.12, 0.9] : [0.55, 0.75, 1, 0.8], size: 0.28, life: 0.22 + Math.random() * 0.12, age: 0, grow: 1.2, solid: true });
    }
    sparks(p, n = 12) {
      for (let k = 0; k < n; k++) this.parts.push({ p: p.slice(), v: [(Math.random() - .5) * 9, Math.random() * 6, (Math.random() - .5) * 9], col: [1, 0.85 - Math.random() * .3, 0.3, 1], size: 0.12, life: 0.35 + Math.random() * .3, age: 0, grow: 0, grav: 1, solid: true });
    }
    // un coche: polvo/agua según superficie y velocidad, marcas al derrapar o en tierra
    car(c, dt, id) {
      const sp = V.len(c.v), R = c.R, fw = BRR.mv(R, [0, 0, -1]);
      c.W.forEach((w, i) => {
        const key = id + ':' + i;
        if (!w.contact) { this.last.delete(key); return; }
        const wc = V.add(c.p, BRR.mv(R, [w.c[0], w.c[1] + 0.3 - w.len - w.radius + 0.03, w.c[2]]));
        const s = this.lvl.surface(wc[0], wc[2]), slip = w.slip || 0;
        // polvo / agua / nieve
        if (s.type !== 'asfalto' && sp > 3) {
          const rate = (s.type === 'agua' ? 0.55 : 0.3) * Math.min(1, sp / 18) + slip * 0.35 * Math.min(1, sp / 15);   // poco polvo al arrancar
          if (Math.random() < rate * dt * 30) {
            const back = V.mul(fw, -Math.min(4, sp * 0.15));
            if (s.type === 'agua') {   // agua: gotas que salen hacia los lados y caen (no una nube), y algo de espuma baja que se queda atrás
              const rt = BRR.mv(R, [1, 0, 0]), side = (i % 2 ? 1 : -1);
              for (let k = 0; k < 3; k++) this.parts.push({ p: [wc[0], wc[1] + 0.05, wc[2]], v: [back[0] * 0.5 + rt[0] * side * (1.5 + Math.random() * 2.5) + (Math.random() - .5), 1.8 + Math.random() * (1.5 + sp * 0.06), back[2] * 0.5 + rt[2] * side * (1.5 + Math.random() * 2.5) + (Math.random() - .5)],
                col: [0.86, 0.94, 1, 0.75], size: 0.07 + Math.random() * 0.07, life: 0.45 + Math.random() * 0.35, age: 0, grow: 0.3, grav: 1, solid: true });
              if (Math.random() < 0.35) this.puff([wc[0], wc[1] + 0.02, wc[2]], [back[0] * 0.2, 0.05, back[2] * 0.2], [0.92, 0.97, 1, 0.35], 0.35, 0.9, 1.4, 1, 0.4);
            }
            else this.puff(wc, [back[0], 0.6, back[2]], [...(s.type === 'nieve' ? s.col : s.col.map(x => x * 0.6 + 0.2)), s.type === 'nieve' ? 0.8 : 0.5], 0.35, 1.2 + Math.random(), s.type === 'nieve' ? 2 : 1.7);
          }
        } else if (slip > 0.45 && sp > 9 && Math.random() < slip * dt * 8) this.puff(wc, [0, 0.4, 0], [0.75, 0.75, 0.75, 0.3], 0.35, 0.8, 1.6);   // humo de rueda
        // marcas: derrape en cualquier superficie; en tierra/nieve siempre (rastro)
        const leave = slip > 0.3 ? 1 : (s.type === 'tierra' || s.type === 'nieve' || s.type === 'arena') && sp > 2 ? 0.55 : 0;
        const prev = this.last.get(key);
        if (leave && prev && V.len(V.sub(wc, prev.p)) > 0.25) {
          const d = V.sub(wc, prev.p), side = V.mul(V.norm([-d[2], 0, d[0]]), Math.min(0.28, w.radius * 0.45));
          const col = s.type === 'asfalto' ? [0.05, 0.05, 0.05] : s.type === 'nieve' ? [0.62, 0.66, 0.74] : s.col.map(x => x * 0.55);
          this.marks.push({ a: V.add(prev.p, side), b: V.sub(prev.p, side), c: V.sub(wc, side), d: V.add(wc, side), col, al: leave * (s.type === 'asfalto' ? 0.55 : 0.5), age: 0 });
          if (this.marks.length > this.maxMarks) this.marks.shift();
          this.last.set(key, { p: wc });
        } else if (!prev || !leave) this.last.set(key, { p: wc });
      });
    }
    update(dt) {
      for (const q of this.parts) { q.age += dt; q.v[1] -= (q.grav ? 9.8 : 0.8) * dt; q.v = V.mul(q.v, 1 - dt * (q.grav ? 0.5 : 1.6)); q.p = V.madd(q.p, q.v, dt); }
      this.parts = this.parts.filter(q => q.age < q.life);
      for (const m of this.marks) m.age += dt;
      while (this.marks.length && this.marks[0].age > 40) this.marks.shift();
    }
    draw(VP, cam, view, far, fog) {
      const gl = this.gl, D = this.data; let n = 0;
      const put = (p, u, v, c, a) => { if (n + 9 > D.length) return; D[n++] = p[0]; D[n++] = p[1]; D[n++] = p[2]; D[n++] = u; D[n++] = v; D[n++] = c[0]; D[n++] = c[1]; D[n++] = c[2]; D[n++] = a; };
      for (const m of this.marks) {
        const a = m.al * Math.min(1, (40 - m.age) / 10), y = 0.03;
        const A = [m.a[0], m.a[1] + y, m.a[2]], B = [m.b[0], m.b[1] + y, m.b[2]], C = [m.c[0], m.c[1] + y, m.c[2]], Dd = [m.d[0], m.d[1] + y, m.d[2]];
        for (const p of [A, B, C, A, C, Dd]) put(p, -1, 0, m.col, a);
      }
      const nMarks = n / 9;
      // partículas orientadas a la cámara
      const right = [view[0], view[4], view[8]], up = [view[1], view[5], view[9]];
      for (const q of this.parts) {
        const t = q.age / q.life, sz = q.size * (1 + q.grow * t), a = q.col[3] * (q.solid ? 1 - t : (1 - t) * Math.min(1, t * 6));
        const r = V.mul(right, sz), u = V.mul(up, sz), p = q.p;
        const P0 = V.sub(V.sub(p, r), u), P1 = V.sub(V.add(p, r), u), P2 = V.add(V.add(p, r), u), P3 = V.add(V.sub(p, r), u);
        put(P0, 0, 0, q.col, a); put(P1, 1, 0, q.col, a); put(P2, 1, 1, q.col, a); put(P0, 0, 0, q.col, a); put(P2, 1, 1, q.col, a); put(P3, 0, 1, q.col, a);
      }
      const verts = n / 9; if (!verts) return;
      gl.useProgram(this.pr); gl.uniformMatrix4fv(this.U.VP, false, VP); gl.uniform3fv(this.U.cam, cam); gl.uniform1f(this.U.far, far); gl.uniform3fv(this.U.fogc, fog);
      gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, D.subarray(0, n), gl.DYNAMIC_DRAW);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4); gl.drawArrays(gl.TRIANGLES, 0, nMarks); gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.drawArrays(gl.TRIANGLES, nMarks, verts - nMarks);
      gl.depthMask(true); gl.disable(gl.BLEND); gl.bindVertexArray(null);
    }
  };
})();
