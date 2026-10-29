// Efectos: polvo, salpicaduras, chispas y marcas de neumático (con transparencia)
"use strict";
(function () {
  const BRR = window.BRR, V = BRR.V;
  // hojas de sprites del original (SPOTFX2 arriba, SPOTFX debajo): posición del primer fotograma, tamaño, columnas y número de fotogramas
  const SPR = { smoke: { x: 0, y: 0, w: 40, h: 40, cols: 6, n: 12 }, dust: { x: 0, y: 80, w: 40, h: 40, cols: 6, n: 12 },
    splash: { x: 0, y: 192 + 56, w: 24, h: 24, cols: 9, n: 9, k: 1.2 }, spark: { x: 0, y: 192 + 80, w: 32, h: 24, cols: 3, n: 6, k: 0.9, mid: true } };
  BRR.Effects = class {
    constructor(gl, lvl) {
      this.gl = gl; this.lvl = lvl; this.parts = []; this.marks = []; this.maxMarks = 2600; this.last = new Map();
      const VS = `#version 300 es
in vec3 p; in vec2 uv; in vec4 col; uniform mat4 VP; out vec2 vuv; out vec4 vcol; out vec3 wp;
void main(){ vuv=uv; vcol=col; wp=p; gl_Position=VP*vec4(p,1.); }`;
      const FS = `#version 300 es
precision highp float; in vec2 vuv; in vec4 vcol; in vec3 wp; uniform vec3 cam; uniform float far; uniform vec3 fogc; uniform sampler2D S; out vec4 o;
void main(){ float a=vcol.a;
  vec3 rgb=vcol.rgb;
  if(vuv.x>=10.){ vec4 t=texture(S,vec2(vuv.x-10.,vuv.y)); if(t.a<.06) discard; rgb=t.rgb*mix(vec3(1.),vcol.rgb*1.3,.3); a*=smoothstep(.15,.75,t.a); }   /* humo y polvo del original (hojas SPOTFX2 del .ENV) */
  else if(vuv.x>=0.){ vec2 q=vuv*2.-1.;
    // borde irregular (ruido según la posición) para que el humo y el polvo no sean círculos perfectos
    float ang=atan(q.y,q.x), sd=dot(floor(wp*1.7),vec3(1.7,9.2,3.1));
    float wob=.82+.12*sin(ang*3.+sd)+.08*sin(ang*7.-sd*1.3);
    float r=length(q)/wob; if(r>1.) discard; a*=1.-smoothstep(.2,1.,r);
    if(vuv.y<=1.) rgb*=.78+.34*vuv.y+.06*sin(q.x*5.+sd);   // volumen: más claro arriba (luz del cielo) y más oscuro abajo
  }
  float f=clamp((length(wp-cam)-far*.55)/(far*.45),0.,1.); o=vec4(mix(rgb,fogc,f),a*(1.-f)); }`;
      const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
      const pr = this.pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
      gl.bindAttribLocation(pr, 0, 'p'); gl.bindAttribLocation(pr, 1, 'uv'); gl.bindAttribLocation(pr, 2, 'col'); gl.linkProgram(pr);
      this.U = {}; for (const n of ['VP', 'cam', 'far', 'fogc', 'S']) this.U[n] = gl.getUniformLocation(pr, n);
      this.vao = gl.createVertexArray(); this.buf = gl.createBuffer(); gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      const st = 9 * 4; gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, st, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, st, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, st, 20);
      gl.bindVertexArray(null); this.data = new Float32Array(9 * 6 * 6000);
    }
    // hoja de humo/polvo animados del juego original (256×192, fotogramas de 40×40: humo en las filas 0-1, polvo en las 2-3)
    setSprites(img) { const gl = this.gl; if (!img) { this.sprTex = null; return; } const t = this.sprTex || gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      // más calidad: ×4 con Scale2x dos veces (redondea los dientes de sierra), un suavizado ligero del color y filtrado lineal con mipmaps
      let W = img.w, H = img.h, D = img.data;
      if (BRR.scale2xRGBA) { for (let k = 0; k < 2; k++) { D = BRR.scale2xRGBA(D, W, H); W *= 2; H *= 2; }
        const o = new Uint8Array(D); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = (y * W + x) * 4; if (!D[i + 3]) continue; let r = 0, g = 0, b = 0, n = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = i + (dy * W + dx) * 4; if (D[j + 3]) { r += D[j]; g += D[j + 1]; b += D[j + 2]; n++; } }
          o[i] = (D[i] + r / n) / 2; o[i + 1] = (D[i + 1] + g / n) / 2; o[i + 2] = (D[i + 2] + b / n) / 2; }
        for (let pass = 0; pass < 2; pass++) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = (y * W + x) * 4; if (D[i + 3] || o[i + 3]) continue; let r = 0, g = 0, b = 0, n = 0;   // color sangrado hacia lo transparente (sin halo negro al filtrar)
          for (const j of [i - 4, i + 4, i - W * 4, i + W * 4]) if (o[j + 3] || o[j] + o[j + 1] + o[j + 2]) { r += o[j]; g += o[j + 1]; b += o[j + 2]; n++; } if (n) { o[i] = r / n; o[i + 1] = g / n; o[i + 2] = b / n; } }
        D = o; }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, D); gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); this.sprTex = t; this.sprH = img.h; }
    reset() { this.parts.length = 0; this.marks.length = 0; this.last.clear(); this.air = new Map(); }
    puff(p, v, col, size, life, grow = 1.6, n = 1, spread = 0.6, spr = null) {
      const dn = this.density ?? 1; n = dn >= 1 ? Math.round(n * dn) : (Math.random() < dn ? n : 0);   // cantidad de partículas (opciones)
      // con sprites del original: la nube moderna (que se queda en el aire y deja rastro) y, cerca del coche, a veces un sprite pequeño y corto encima
      const useSpr = spr && this.sprTex && this.orig && Math.random() < 0.45 ? spr : null; spr = null;
      for (let k = 0; k < n; k++) {
        if (this.parts.length > 1800 * Math.max(1, dn)) this.parts.shift();
        this.parts.push({ p: [p[0] + (Math.random() - .5) * spread, p[1] + Math.random() * 0.2, p[2] + (Math.random() - .5) * spread],
          v: [v[0] + (Math.random() - .5) * 1.5, v[1] + Math.random() * 1.2, v[2] + (Math.random() - .5) * 1.5], col, size, life, age: 0, grow });
        if (useSpr) this.parts.push({ p: [p[0] + (Math.random() - .5) * spread * 0.5, p[1], p[2] + (Math.random() - .5) * spread * 0.5], v: [v[0] * 0.6, v[1] * 0.5 + 0.2, v[2] * 0.6], col, size: size * 0.6, life: 0.6 + Math.random() * 0.25, age: 0, grow: 0, spr: useSpr });
      }
    }
    flame(p, back, v, tint, big = 1) {   // llamarada del nitro (tint: color del equipo, 0..1): núcleo blanco-azulado, cuerpo del color del equipo, cola larga y halo de luz
      const T = tint || [1, 0.55, 0.12], n = 3 + (big > 1 ? 1 : 0);
      for (let k = 0; k < n; k++) { const core = k === 0, r = Math.random(), sp = 1.1 + r * 0.9;
        this.parts.push({ p: [p[0] + (Math.random() - .5) * .08, p[1] + (Math.random() - .5) * .08, p[2] + (Math.random() - .5) * .08],
          v: [v[0] * 0.8 + back[0] * sp + (Math.random() - .5) * 0.5, v[1] * 0.8 + back[1] * sp + Math.random() * 0.3, v[2] * 0.8 + back[2] * sp + (Math.random() - .5) * 0.5],
          col: core ? [0.75 + T[0] * 0.25, 0.8 + T[1] * 0.2, 1, 0.95] : k === 1 ? [Math.min(1, T[0] * 1.2 + 0.2), Math.min(1, T[1] * 1.2 + 0.1), Math.min(1, T[2] * 1.2 + 0.1), 0.9] : [1, 0.5 + Math.random() * 0.25, 0.12, 0.8],
          size: (core ? 0.16 : 0.24 + r * 0.12) * big, life: (core ? 0.1 : 0.2 + r * 0.12) * big, age: 0, grow: core ? 0.6 : 1.4, solid: true }); }
      if (Math.random() < 0.35) this.parts.push({ p: p.slice(), v: [v[0] * 0.7 + back[0] * 1.6 + (Math.random() - .5) * 2, v[1] + Math.random() * 1.5, v[2] * 0.7 + back[2] * 1.6 + (Math.random() - .5) * 2], col: [1, 0.8, 0.35, 1], size: 0.05, life: 0.35, age: 0, grow: 0, grav: 1, solid: true });   // chispitas
      if (Math.random() < 0.25) this.parts.push({ p: [p[0] + back[0] * 0.3, p[1] + 0.05, p[2] + back[2] * 0.3], v: [v[0] * 0.3 + back[0] * 0.4, 0.5, v[2] * 0.3 + back[2] * 0.4], col: [0.55, 0.55, 0.6, 0.18], size: 0.35, life: 0.9, age: 0, grow: 2 });   // estela de humo fino
      this.glow(p, [Math.min(1, T[0] * 0.6 + 0.4), Math.min(1, T[1] * 0.6 + 0.35), Math.min(1, T[2] * 0.6 + 0.3)], 1.1 * big + Math.random() * 0.3);
    }
    // lluvia (gotas alargadas que caen en diagonal) y nieve (copos lentos) en una caja alrededor de la cámara
    weather(cam, kind, dt, k = 1) {
      const rain = kind === 'rain', n = Math.min(60, (rain ? 420 : 160) * k * dt * (this.density || 1) | 0) + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) { const R0 = rain ? 22 : 26, p = [cam[0] + (Math.random() * 2 - 1) * R0, cam[1] + 6 + Math.random() * 10, cam[2] + (Math.random() * 2 - 1) * R0];
        if (rain) this.parts.push({ p, v: [1.2, -22 - Math.random() * 6, 0.6], col: [0.82, 0.86, 0.95, 0.6], size: 0.022, life: 0.9, age: 0, grow: 0, solid: true, streak: 0.9 });
        else this.parts.push({ p, v: [(Math.random() - .5) * 0.8, -1.6 - Math.random(), (Math.random() - .5) * 0.8], col: [0.97, 0.98, 1, 0.85], size: 0.05, life: 6, age: 0, grow: 0, solid: true, snow: 1 }); }
    }
    // halo de luz (luces de freno): se suma a lo que hay detrás, solo dura este fotograma
    glow(p, col, size) { (this.glows || (this.glows = [])).push({ p, col, size }); }
    glowQuad(P, col) { (this.glows || (this.glows = [])).push({ quad: P, col }); }   // mancha de luz plana (neones en el suelo)
    sparks(p, n = 12) {
      if (this.sprTex && this.orig && this.sprH > 192) { for (let k = 0; k < Math.max(1, Math.min(3, n / 10 | 0)); k++) this.parts.push({ p: [p[0] + (Math.random() - .5) * 0.4, p[1] + Math.random() * 0.3, p[2] + (Math.random() - .5) * 0.4], v: [0, 0.3, 0], col: [1, 1, 1, 1], size: 0.5, life: 0.3, age: 0, grow: 0, solid: true, spr: 'spark' }); n = Math.ceil(n / 3); }   // chispas del original + unas pocas sueltas
      for (let k = 0; k < n; k++) this.parts.push({ p: p.slice(), v: [(Math.random() - .5) * 9, Math.random() * 6, (Math.random() - .5) * 9], col: [1, 0.85 - Math.random() * .3, 0.3, 1], size: 0.12, life: 0.35 + Math.random() * .3, age: 0, grow: 0, grav: 1, solid: true });
    }
    // un coche: polvo/agua según superficie y velocidad, marcas al derrapar o en tierra
    car(c, dt, id) {
      const sp = V.len(c.v), R = c.R, fw = BRR.mv(R, [0, 0, -1]);
      // aterrizaje tras un salto: nube de polvo alrededor (o salpicón)
      this.air = this.air || new Map(); const onG = c.W.some(w => w.contact), at = this.air.get(id) || 0;
      if (!onG) this.air.set(id, at + dt);
      else { if (at > 0.45 && Math.abs(c.v[1]) + sp * 0.1 > 3) { const s = this.lvl.surface(c.p[0], c.p[2]);
          if (s.type !== 'agua') { const col = [...(s.type === 'asfalto' ? [0.7, 0.7, 0.72] : s.col.map(x => x * 0.6 + 0.22)), s.type === 'asfalto' ? 0.25 : 0.45];
            for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; this.puff([c.p[0] + Math.cos(a) * 0.8, c.p[1] - 0.3, c.p[2] + Math.sin(a) * 0.8], [Math.cos(a) * 3.5 + c.v[0] * 0.3, 0.6, Math.sin(a) * 3.5 + c.v[2] * 0.3], col, 0.55, 1.6 + Math.random(), 3, 1, 0.4, s.type === 'asfalto' ? 'smoke' : s.type === 'nieve' ? null : 'dust'); } } }
        this.air.set(id, 0); }
      if (c.def.kind === 'hover') {   // flota: sin marcas de ruedas; levanta polvo (o agua) por debajo del centro
        const low = c.W.some(w => w.contact); if (!low || sp < 2) return;
        const bc = V.add(c.p, BRR.mv(R, [0, c.def.box.c[1] - c.def.box.h[1], c.def.box.c[2]])), s = this.lvl.surface(bc[0], bc[2]), gy = this.lvl.terrain(bc[0], bc[2]);
        if (Math.random() < Math.min(1, sp / 20) * dt * 26) { const a = Math.random() * 6.283, out = 1.2 + sp * 0.04, p0 = [bc[0], Math.max(gy, bc[1] - 0.6) + 0.05, bc[2]];
          const col = s.type === 'agua' ? [0.9, 0.96, 1, 0.4] : [...(s.type === 'asfalto' ? [0.72, 0.72, 0.74] : s.col.map(x => x * 0.6 + 0.22)), s.type === 'asfalto' ? 0.18 : 0.32];
          this.puff(p0, [Math.cos(a) * out - fw[0] * sp * 0.15, 0.35, Math.sin(a) * out - fw[2] * sp * 0.15], col, 0.5, 1.2 + Math.random(), 2.6, 1, 0.6); }
        return;
      }
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
              if (this.sprTex && this.orig && this.sprH > 192 && Math.random() < 0.5) this.parts.push({ p: [wc[0], wc[1] - 0.1, wc[2]], v: [back[0] * 0.3, 0, back[2] * 0.3], col: [1, 1, 1, 1], size: 0.45 + Math.min(0.5, sp / 40), life: 0.55, age: 0, grow: 0, solid: true, spr: 'splash' });   // salpicón del original
            }
            else {   // polvo: una nube que se queda flotando, crece y se deja llevar
              const big = Math.min(1, sp / 25), col = [...(s.type === 'nieve' ? s.col : s.col.map(x => x * 0.6 + 0.22)), s.type === 'nieve' ? 0.6 : 0.3 + 0.1 * big];
              this.puff(wc, [back[0], 0.5 + big * 0.6, back[2]], col, 0.4 + big * 0.25, 1.8 + Math.random() * 1.6 + big, s.type === 'nieve' ? 2.4 : 3.2, 1, 0.7, s.type === 'nieve' ? null : 'dust');   // en la nieve, polvo de nieve (sin sprites de 1995)
            }
          }
        } else {
          // asfalto: humo de neumático al derrapar o al patinar las ruedas al arrancar (quemar rueda)
          const burn = (c.thr || 0) > 0.8 && sp > 0.3 && sp < 9 && !c.K.fly ? (9 - sp) / 9 * 0.7 : 0, sm = Math.max(slip > 0.4 && sp > 7 ? (slip - 0.4) * 2 : 0, burn);
          if (sm > 0 && Math.random() < sm * dt * 22) this.puff([wc[0], wc[1] + 0.15, wc[2]], [-fw[0] * sp * 0.25, 0.35, -fw[2] * sp * 0.25], [0.86, 0.86, 0.88, 0.22 + sm * 0.2], 0.45, 2.2 + Math.random() * 1.5, 4.2, 1, 0.5, 'smoke');
        }
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
      this.t = (this.t || 0) + dt; const t = this.t;
      for (const q of this.parts) { q.age += dt;
        if (q.grav || q.solid) q.v[1] -= (q.grav ? 9.8 : 0.8) * dt;
        else { q.v[1] += (0.25 - q.v[1] * 0.4) * dt; q.v[0] += Math.sin(t * 0.9 + q.p[2] * 0.3) * 0.25 * dt; q.v[2] += Math.cos(t * 0.7 + q.p[0] * 0.3) * 0.25 * dt; }   // humo/polvo: sube despacio y se mece
        q.v = V.mul(q.v, 1 - dt * (q.grav ? 0.5 : 1.6)); q.p = V.madd(q.p, q.v, dt); }
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
        let r = V.mul(right, sz), u = V.mul(up, sz); const p = q.p;
        if (q.streak) { const L0 = V.len(q.v) || 1; u = V.mul(q.v, q.streak / L0); }   // gota: rayita en la dirección en que cae
        if (q.spr) {   // fotograma de la animación original según la edad
          const S = SPR[q.spr], f = Math.min(S.n - 1, Math.floor(t * S.n)), fx = f % S.cols, fy = (f / S.cols) | 0, H = this.sprH || 384;
          const u0 = 10 + (S.x + fx * S.w) / 256, u1 = 10 + (S.x + fx * S.w + S.w) / 256, v0 = (S.y + fy * S.h) / H, v1 = (S.y + fy * S.h + S.h) / H, s2 = (S.k || 1) * (0.16 + q.size * 0.42), aa = Math.min(1, (1 - t) * 3) * 0.9;
          r = V.mul(right, s2 * S.w / S.h); u = V.mul(up, s2); const c2 = [p[0], p[1] + s2 * (S.mid ? 0 : 0.6), p[2]], Q0 = V.sub(V.sub(c2, r), u), Q1 = V.sub(V.add(c2, r), u), Q2 = V.add(V.add(c2, r), u), Q3 = V.add(V.sub(c2, r), u);
          put(Q0, u0, v1, q.col, aa); put(Q1, u1, v1, q.col, aa); put(Q2, u1, v0, q.col, aa); put(Q0, u0, v1, q.col, aa); put(Q2, u1, v0, q.col, aa); put(Q3, u0, v0, q.col, aa); continue; }
        const P0 = V.sub(V.sub(p, r), u), P1 = V.sub(V.add(p, r), u), P2 = V.add(V.add(p, r), u), P3 = V.add(V.sub(p, r), u);
        put(P0, 0, 0, q.col, a); put(P1, 1, 0, q.col, a); put(P2, 1, 1, q.col, a); put(P0, 0, 0, q.col, a); put(P2, 1, 1, q.col, a); put(P3, 0, 1, q.col, a);
      }
      const nPart = n / 9;
      for (const q of this.glows || []) { if (q.quad) { const [A, B, C, Dd] = q.quad, a = q.col[3]; put(A, 0, 0, q.col, a); put(B, 1, 0, q.col, a); put(C, 1, 1, q.col, a); put(A, 0, 0, q.col, a); put(C, 1, 1, q.col, a); put(Dd, 0, 1, q.col, a); continue; }
        const r = V.mul(right, q.size), u = V.mul(up, q.size), p = q.p, a = q.col[3];
        const P0 = V.sub(V.sub(p, r), u), P1 = V.sub(V.add(p, r), u), P2 = V.add(V.add(p, r), u), P3 = V.add(V.sub(p, r), u);
        put(P0, 0, 0, q.col, a); put(P1, 1, 0, q.col, a); put(P2, 1, 1, q.col, a); put(P0, 0, 0, q.col, a); put(P2, 1, 1, q.col, a); put(P3, 0, 1, q.col, a); }
      if (this.glows) this.glows.length = 0;
      const verts = n / 9; if (!verts) return;
      gl.useProgram(this.pr); if (this.sprTex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.sprTex); gl.uniform1i(this.U.S, 0); } gl.uniformMatrix4fv(this.U.VP, false, VP); gl.uniform3fv(this.U.cam, cam); gl.uniform1f(this.U.far, far); gl.uniform3fv(this.U.fogc, fog);
      gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, D.subarray(0, n), gl.DYNAMIC_DRAW);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4); gl.drawArrays(gl.TRIANGLES, 0, nMarks); gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.drawArrays(gl.TRIANGLES, nMarks, nPart - nMarks);
      if (verts > nPart) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.drawArrays(gl.TRIANGLES, nPart, verts - nPart); }
      gl.depthMask(true); gl.disable(gl.BLEND); gl.bindVertexArray(null);
    }
  };
})();
