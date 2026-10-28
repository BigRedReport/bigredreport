// Vehículo: carga desde .VHC y física con ruedas de rayo + suspensión
"use strict";
(function () {
  const BRR = window.BRR, S = BRR.S;
  // ---------- vectores ----------
  const V = BRR.V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]), norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    madd: (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s],
  };
  const Q = BRR.Q = {
    fromYaw: y => [0, Math.sin(y / 2), 0, Math.cos(y / 2)],
    mat: q => { const [x, y, z, w] = q; return [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]; },
    integrate: (q, w, dt) => { const [x, y, z, s] = q, h = dt / 2;
      const r = [x + h * (w[0] * s + w[1] * z - w[2] * y), y + h * (w[1] * s + w[2] * x - w[0] * z), z + h * (w[2] * s + w[0] * y - w[1] * x), s - h * (w[0] * x + w[1] * y + w[2] * z)];
      const l = Math.hypot(...r); return r.map(c => c / l); },
  };
  const mv = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];
  const mtv = (M, v) => [M[0][0] * v[0] + M[1][0] * v[1] + M[2][0] * v[2], M[0][1] * v[0] + M[1][1] * v[1] + M[2][1] * v[2], M[0][2] * v[0] + M[1][2] * v[1] + M[2][2] * v[2]];
  BRR.mv = mv; BRR.mtv = mtv;

  // ---------- consultas al mundo ----------
  const tmpList = [];
  function rayTri(o, d, T, i) {
    const a = i * 9;
    const e1 = [T[a + 3] - T[a], T[a + 4] - T[a + 1], T[a + 5] - T[a + 2]], e2 = [T[a + 6] - T[a], T[a + 7] - T[a + 1], T[a + 8] - T[a + 2]];
    const p = V.cross(d, e2), det = V.dot(e1, p); if (Math.abs(det) < 1e-9) return -1;
    const inv = 1 / det, s = [o[0] - T[a], o[1] - T[a + 1], o[2] - T[a + 2]], u = V.dot(s, p) * inv; if (u < 0 || u > 1) return -1;
    const q = V.cross(s, e1), v = V.dot(d, q) * inv; if (v < 0 || u + v > 1) return -1;
    return V.dot(e2, q) * inv;
  }
  function triNormal(T, i) { const a = i * 9; return V.norm(V.cross([T[a + 3] - T[a], T[a + 4] - T[a + 1], T[a + 5] - T[a + 2]], [T[a + 6] - T[a], T[a + 7] - T[a + 1], T[a + 8] - T[a + 2]])); }
  // rayo contra terreno + objetos; devuelve {t, n, surf}
  BRR.raycast = function (lvl, o, d, maxT, skip) {
    let best = null; const n = [0, 1, 0];
    const f = t => o[1] + d[1] * t - lvl.terrain(o[0] + d[0] * t, o[2] + d[2] * t);
    // dentro de un túnel (por debajo del terreno) o sobre la boca del túnel, el terreno no cuenta
    const noTer = lvl.tunnel && lvl.tunnel(o[0], o[2]) && (f(0) < -0.4 || lvl.hole(o[0] + d[0] * maxT, o[2] + d[2] * maxT) || lvl.hole(o[0], o[2]));
    if (noTer) { }
    else if (f(0) <= 0) { lvl.terrain(o[0], o[2], n); best = { t: 0, n: n.slice(), surf: 0 }; }
    else if (f(maxT) < 0) {
      let lo = 0, hi = maxT; for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
      lvl.terrain(o[0] + d[0] * hi, o[2] + d[2] * hi, n); best = { t: hi, n: n.slice(), surf: 0 };
    }
    const C = lvl.collider, e = V.madd(o, d, maxT);
    C.query(Math.min(o[0], e[0]), Math.min(o[2], e[2]), Math.max(o[0], e[0]), Math.max(o[2], e[2]), tmpList);
    for (const i of tmpList) {
      if (skip && skip(C.tags[i])) continue;
      const t = rayTri(o, d, C.T, i);
      if (t >= 0 && t <= maxT && (!best || t < best.t)) { let nn = triNormal(C.T, i); if (V.dot(nn, d) > 0) nn = V.mul(nn, -1); best = { t, n: nn, surf: 1, tag: C.tags[i] }; }
    }
    return best;
  };
  function closestOnTri(p, T, i) {   // Ericson, Real-Time Collision Detection
    const j = i * 9, a = [T[j], T[j + 1], T[j + 2]], b = [T[j + 3], T[j + 4], T[j + 5]], c = [T[j + 6], T[j + 7], T[j + 8]];
    const ab = V.sub(b, a), ac = V.sub(c, a), ap = V.sub(p, a), d1 = V.dot(ab, ap), d2 = V.dot(ac, ap);
    if (d1 <= 0 && d2 <= 0) return a;
    const bp = V.sub(p, b), d3 = V.dot(ab, bp), d4 = V.dot(ac, bp); if (d3 >= 0 && d4 <= d3) return b;
    const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) return V.madd(a, ab, d1 / (d1 - d3));
    const cp = V.sub(p, c), d5 = V.dot(ab, cp), d6 = V.dot(ac, cp); if (d6 >= 0 && d5 <= d6) return c;
    const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) return V.madd(a, ac, d2 / (d2 - d6));
    const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return V.madd(b, V.sub(c, b), (d4 - d3) / ((d4 - d3) + (d5 - d6)));
    const den = 1 / (va + vb + vc); return V.add(a, V.add(V.mul(ab, vb * den), V.mul(ac, vc * den)));
  }
  // contactos de una esfera con el mundo
  BRR.sphereContacts = function (lvl, s, r, out, skip) {
    out.length = 0; const n = [0, 1, 0];
    const h = lvl.terrain(s[0], s[2], n), dist = (s[1] - h) * n[1];
    const inTun = lvl.tunnel && lvl.tunnel(s[0], s[2]) && (s[1] < h - 0.4 || lvl.hole(s[0], s[2]));
    if (dist < r && !inTun) out.push({ n: n.slice(), depth: r - dist, p: V.madd(s, n, -dist) });
    const C = lvl.collider; C.query(s[0] - r, s[2] - r, s[0] + r, s[2] + r, tmpList);
    for (const i of tmpList) {
      if (skip && skip(C.tags[i])) continue;
      const cp = closestOnTri(s, C.T, i), dv = V.sub(s, cp), dl = V.len(dv);
      if (dl < r && dl > 1e-6) out.push({ n: V.mul(dv, 1 / dl), depth: r - dl, p: cp });
    }
    return out;
  };

  // obstáculos finos que los rivales pueden "saltar" cuando siguen el recorrido original
  BRR.THIN = tag => /BARRIER|FENCE|LAMPOST|^DIR\d|CHEVRON|TYRES|SLATS|ST_POSTS|HUGPOSTS|SUPP|JOIN|S_LIGHTS/.test(tag || '');
  // ---------- carga del vehículo ----------
  const num = s => { s = s.trim(); const neg = s.startsWith('-'); if (neg) s = s.slice(1); const v = s.startsWith('&') ? parseInt(s.slice(1), 16) : parseInt(s, 10); return neg ? -v : v; };
  BRR.VEHICLES = ['JEEP', 'ATV', 'MINI', 'CABMINI', 'BEETLE', 'CABBET', 'MONS', 'TRUCK', 'JCB', 'CAT', 'PLOUGH', 'SNOWCAT', 'BUGGY', 'JETCAR', 'UFO', 'INFLATE', 'HOVCAR', 'HELI', 'COPTER'];
  // Luces de freno: los modelos del original traen las caras de los pilotos encendidos como geometría condicional
  // (orden 9 con la variable 2 + bloque 7), que el juego solo pinta al frenar. Si el modelo no las tiene, no hay luces.
  function buildBrake(body, findTM, pal) {
    const faces = [...body.faces.filter(f => f.els === 2), ...body.faces.filter(f => f.alt && f.alt.cond === 2).map(f => ({ tex: f.tex, uv: f.uv, idx: f.idx }))];
    if (!faces.length) return null;
    const mb = new BRR.MeshBuilder(pal); mb.condOnly = true;
    mb.addModel({ ...body, faces }, v => BRR.toGL(v[0], v[1], v[2]), findTM, null, 3);
    return mb;
  }
  // pintura propia: la gama de 16 tonos del color principal de los modelos (el del equipo) pasa a ser la del color elegido
  BRR.paintPal = function (P, models, rgb, onlyRamp) {
    if (!rgb) return P; const lum = c => 0.3 * P[c * 3] + 0.59 * P[c * 3 + 1] + 0.11 * P[c * 3 + 2] + 1;
    const sat = c => { const r = P[c * 3], g = P[c * 3 + 1], b = P[c * 3 + 2], mx = Math.max(r, g, b); return mx > 60 ? (mx - Math.min(r, g, b)) / mx : 0; };
    let base = onlyRamp;
    if (base == null) { const cnt = new Map(); for (const m of models) for (const f of m.faces) if (!f.tex && f.color != null && f.cond == null) cnt.set(f.color, (cnt.get(f.color) || 0) + f.idx.length);
      const c0 = [...cnt].sort((a, b) => b[1] * (sat(b[0]) > 0.3 ? 6 : 1) - a[1] * (sat(a[0]) > 0.3 ? 6 : 1))[0]; if (!c0) return P; base = c0[0] & ~15; }
    let ref = base; for (let c = base; c < base + 16; c++) if (sat(c) > sat(ref) || (sat(c) === sat(ref) && lum(c) > lum(ref))) ref = c;
    const out = new Uint8Array(P), l0 = lum(ref), [R0, G0, B0] = rgb;
    for (let c = base; c < base + 16; c++) { const k = lum(c) / l0; out[c * 3] = Math.min(255, R0 * k); out[c * 3 + 1] = Math.min(255, G0 * k); out[c * 3 + 2] = Math.min(255, B0 * k); }
    out.paintRamp = base; return out;
  };
  BRR.loadVehicle = async function (files, name, lvl, team = 1, extra = {}) {
    const A = await files.archive(name + '.VHC');
    const txtName = [...A.keys()].find(k => k.endsWith('.TXT'));
    const txt = BRR.text(A.get(txtName)).replace(/;[^\n]*/g, '');
    const lines = txt.split(/\r?\n/);
    const vi = lines.findIndex(l => /^vehicle\s/.test(l)), vname = lines[vi].trim().split(/\s+/)[1].toUpperCase();
    const block = []; for (let i = vi + 1; i < lines.length && !/^vehicle\s/.test(lines[i]); i++) block.push(lines[i]);
    const shapes = block.filter(l => /^\s*wheelsh\s/.test(l)).map(l => l.trim().split(/\s+/)[1].toUpperCase());
    const wheels = [], deco = []; let nitroPos = null, headPos = null; const dmgFx = {};
    for (const l of block) {
      const m = l.match(/^\s*wheel\s+(.*)$/); if (!m) continue;
      const f = m[1].split(',').map(num); if (f.length < 8) continue;
      if (f[0] === 0x87 && !nitroPos) nitroPos = [f[2], f[3], f[4]];   // escape del nitro
      if (f[0] >= 0x8A && f[0] <= 0x8D) dmgFx[{ 0x8A: 80, 0x8B: 90, 0x8C: 95, 0x8D: 100 }[f[0]]] = BRR.toGL(f[2], f[3], f[4]);   // daños: humo al 80/90/95 % y explosión al 100 %
      if (f[0] === 0xFF && (f[1] & 0x40) && !headPos) headPos = [f[2], f[3], f[4]];   // cabeza del piloto
      // piezas decorativas: hélices (129), rotores (131), timones (128) y orugas (&FF con forma < &40)
      if ((f[0] === 128 || f[0] === 129 || f[0] === 131 || f[0] === 0xFF) && !(f[1] & 0x60))
        deco.push({ spin: f[0] === 129 || f[0] === 131 ? (f[0] === 131 ? 40 : 25) : 0, shape: f[1] & 0x1f, follow: !!(f[1] & 0x80), pos: [f[2], f[3], f[4]], rot: [f[5], f[6], f[7]] });
      if (f[0] >= 0x80 || f[0] === 0xFF) continue;
      wheels.push({ flags: f[0], shape: f[1] & 0x1f, pos: [f[2], f[3], f[4]], rot: [f[5], f[6], f[7]] }); // unidades del mundo
    }
    const all = txt;   // parámetros de manejo
    const table = key => {
      const m = all.match(new RegExp('hnd gear ' + key + '\\s+(\\d+)\\s*,?([\\s\\S]*?)(?=\\n\\s*hnd|$)'));
      if (!m) return null; const nums = m[2].split(/[\s,]+/).filter(Boolean).map(num), rows = [];
      for (let i = 0; i + 4 < nums.length && rows.length < +m[1]; i += 5) rows.push([nums[i], nums[i + 1], nums[i + 2], nums[i + 3], nums[i + 4]]);
      return rows;
    };
    const intM = block.join('\n').match(/internal\s+([-&\w]+)\s*,\s*([-&\w]+)\s*,\s*([-&\w]+)/);
    const steerM = all.match(/hnd steering\s+\d+\s*,\s*([^,\s]+)\s*,\s*([^,\s]+)\s*,\s*([^,\s]+)\s*,\s*([^,\s]+)/);
    const engM = all.match(/hnd fx engine\s+\d+\s*,\s*\w+\s+vhc\s+(\w+)/i);
    const find = n => A.get(n) || lvl.find(n);
    const parseM = n => { const b = find(n.toUpperCase() + '.3DW'); return b ? BRR.parse3DW(b) : null; };
    const body = parseM(vname + team) || parseM(name + team) || parseM(vname + '1') || parseM(name + '1');
    if (!body) throw new Error('No encuentro el modelo de ' + name);
    const findTM = n => find(n + '.TM');
    // pintura propia (color RGB): la gama de 16 tonos del color del equipo se cambia por la del color elegido, con las mismas luces y sombras
    let pal = lvl.pal;
    // la gama del color del equipo es la 32 + 16·equipo (la que cambia entre JEEP1, JEEP2…): si el modelo la usa, se pinta esa (si no, la más llamativa)
    if (extra.paint) { const tb = 32 + 16 * team, uses = body.faces.some(f => !f.tex && f.color >= tb && f.color < tb + 16);
      pal = BRR.paintPal(lvl.pal, [body], extra.paint, uses ? tb : undefined); if (pal !== lvl.pal) body.paint = extra.paint.slice(); }
    const mb = new BRR.MeshBuilder(pal);
    mb.addModel(body, v => BRR.toGL(v[0], v[1], v[2]), findTM);
    // hojas de textura que llevan el hueco del logo de este equipo (JDSH, MDSH, TRDH...): las que usa alguna cara dentro del hueco
    const slotX = 136 + ((team - 1) % 3) * 40, slotY = 112 + (((team - 1) / 3) | 0) * 40, slotTex = new Set();
    for (const f of body.faces) if (f.tex && f.uv && f.uv.length) { const us = f.uv.map(q => q[0]), vs = f.uv.map(q => q[1]);
      if (Math.min(...us) >= slotX - 1 && Math.max(...us) <= slotX + 41 && Math.min(...vs) >= slotY - 1 && Math.max(...vs) <= slotY + 41) slotTex.add(f.tex); }
    // logotipo de la escudería: las hojas xDSH.TM tienen 6 huecos de 40×40 (uno por equipo, en x 136/176/216, y 112/152);
    // como hacía el original con el logo elegido, se pinta el logo (o una imagen propia) en el hueco del equipo
    // logo en alta resolución (imagen propia): una calcomanía aparte encima de las caras que usan el hueco del logo
    if (extra.logoHi) { const ox = 136 + ((team - 1) % 3) * 40, oy = 112 + (((team - 1) / 3) | 0) * 40, g = mb.group('tex:LOGOHI'), V0 = body.verts.map(v => v ? BRR.toGL(v[0], v[1], v[2]) : null);
      for (const f of body.faces) { if (!f.tex || !slotTex.has(f.tex) || f.cond != null || !f.uv || f.uv.length !== f.idx.length) continue;
        const us = f.uv.map(q => q[0]), vs = f.uv.map(q => q[1]); if (Math.min(...us) < ox - 1 || Math.max(...us) > ox + 41 || Math.min(...vs) < oy - 1 || Math.max(...vs) > oy + 41) continue;
        const P = f.idx.map(i => V0[i]); if (P.some(v => !v)) continue;
        const e1 = V.sub(P[1], P[0]), e2 = V.sub(P[2], P[0]); let n = V.norm(V.cross(e1, e2)); { const b0 = body.boxes[0] || [0, 0, 0]; if (V.dot(n, V.sub(P[0], BRR.toGL(b0[0], b0[1], b0[2]))) < 0) n = V.mul(n, -1); }
        const Q = P.map(p => V.madd(p, n, 0.008));
        for (let k = 1; k < Q.length - 1; k++) for (const order of [[0, k + 1, k], [0, k, k + 1]]) for (const j of order) { g.pos.push(...Q[j]); g.uv.push(Math.min(1, Math.max(0, (f.uv[j][0] - ox) / 40)), Math.min(1, Math.max(0, (f.uv[j][1] - oy) / 40))); g.lay.push(4); } }
      mb.textures.set('LOGOHI', { w: extra.logoHi.w, h: extra.logoHi.h, data: extra.logoHi.data, smooth: true }); }
    if (extra.logo) for (const [tn, rgba] of mb.textures) { if (!rgba || !slotTex.has(tn)) continue;
      const ox = 136 + ((team - 1) % 3) * 40, oy = 112 + (((team - 1) / 3) | 0) * 40, L = extra.logo;
      // lo transparente del logo toma el color de la carrocería (el color de cara más abundante del modelo), sin recuadro
      if (!body.paint) { const area = new Map(); for (const f of body.faces) { if (f.tex || f.cond != null || f.idx.length < 3) continue; const P = f.idx.map(i => body.verts[i]); if (P.some(v => !v)) continue;
          let a = 0; for (let k = 1; k < P.length - 1; k++) { const e1 = [P[k][0] - P[0][0], P[k][1] - P[0][1], P[k][2] - P[0][2]], e2 = [P[k + 1][0] - P[0][0], P[k + 1][1] - P[0][1], P[k + 1][2] - P[0][2]]; a += Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2; }
          area.set(f.color, (area.get(f.color) || 0) + a); }
        const sat = c => { const r = lvl.pal[c * 3], g = lvl.pal[c * 3 + 1], b = lvl.pal[c * 3 + 2], mx = Math.max(r, g, b); return mx > 80 ? (mx - Math.min(r, g, b)) / mx : 0; };
        const c = [...area].sort((x, y) => (y[1] * (sat(y[0]) > 0.35 ? 6 : 1)) - (x[1] * (sat(x[0]) > 0.35 ? 6 : 1)))[0]; body.paint = c ? [lvl.pal[c[0] * 3], lvl.pal[c[0] * 3 + 1], lvl.pal[c[0] * 3 + 2]] : null; }
      const bg = body.paint || [rgba[((oy + 1) * 256 + ox + 1) * 4], rgba[((oy + 1) * 256 + ox + 1) * 4 + 1], rgba[((oy + 1) * 256 + ox + 1) * 4 + 2]];
      for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) { const k = ((oy + y) * 256 + ox + x) * 4, j = (y * 40 + x) * 4, a = L[j + 3] / 255;
        for (let c = 0; c < 3; c++) rgba[k + c] = Math.round(L[j + c] * a + bg[c] * (1 - a)); rgba[k + 3] = 255; } }
    const shapeCache = new Map(); const wheelMeshes = []; const wheelRad = [];
    for (const w of wheels) {
      const sh = shapes[w.shape]; let m = null;
      if (sh) { if (!shapeCache.has(sh)) shapeCache.set(sh, parseM(sh)); m = shapeCache.get(sh); }
      let rad = 0.4;
      if (m) {
        rad = Math.max(...m.verts.filter(Boolean).map(v => Math.hypot(v[0], v[1]))) * S;
        const k = 2 * Math.PI / 65536, R = BRR.rot(w.rot[0] * k, w.rot[1] * k, w.rot[2] * k);
        const wm = new BRR.MeshBuilder(pal); wm.addModel(m, v => BRR.toGL(...mv(R, v)), findTM); wheelMeshes.push(wm);
      } else wheelMeshes.push(null);
      wheelRad.push(rad);
    }
    // ruedas cuya forma no está en la lista (las del lado derecho del buggy lunar): la rueda del otro lado, en espejo
    wheels.forEach((w, i) => { if (wheelMeshes[i]) return;
      let j = wheels.findIndex((o, k) => wheelMeshes[k] && Math.abs(o.pos[2] - w.pos[2]) < 2 && Math.sign(o.pos[0]) === -Math.sign(w.pos[0])); if (j < 0) j = wheels.findIndex((o, k) => wheelMeshes[k]); if (j < 0) return;
      const o = wheels[j], m = shapeCache.get(shapes[o.shape]); if (!m) return; const k = 2 * Math.PI / 65536, R = BRR.rot(o.rot[0] * k, o.rot[1] * k, o.rot[2] * k);
      const wm = new BRR.MeshBuilder(pal); wm.addModel({ ...m, faces: m.faces.map(f => ({ ...f, two: true })) }, v => { const g = BRR.toGL(...mv(R, v)); return [-g[0], g[1], g[2]]; }, findTM);
      wheelMeshes[i] = wm; wheelRad[i] = wheelRad[j]; });
    const bx = body.boxes[0] || [0, 0, 0, 40, 25, 70];
    // piezas decorativas (malla sin rotar + rotación aparte para poder girarlas)
    const C = M => M.map((r, i) => r.map((x, j) => (i === 0) === (j === 0) ? x : -x));   // cambio de ejes script -> GL
    const decoParts = [];
    for (const d of deco) {
      let sh = shapes[d.shape]; if (!sh) continue;
      if (d.follow && /1$/.test(sh) && find(sh.replace(/1$/, String(team)) + '.3DW')) sh = sh.replace(/1$/, String(team));   // &80: pieza del color del equipo (timones)
      if (!shapeCache.has(sh)) shapeCache.set(sh, parseM(sh)); const m = shapeCache.get(sh); if (!m) continue;
      const k = 2 * Math.PI / 65536, wm = new BRR.MeshBuilder(pal); wm.addModel({ ...m, faces: m.faces.map(f => ({ ...f, two: true })) }, v => BRR.toGL(v[0], v[1], v[2]), findTM);   // hélices y timones: finos, se ven por las dos caras
      decoParts.push({ mesh: wm, R: C(BRR.rot(d.rot[0] * k, d.rot[1] * k, d.rot[2] * k)), p: BRR.toGL(...d.pos), spin: d.spin });
    }
    // tipo de vehículo: con ruedas, orugas, aerodeslizador/jet, lancha o helicóptero
    const NM = name.toUpperCase();
    const kind = /HELI|COPTER/.test(NM) ? 'heli' : NM === 'INFLATE' ? 'boat' : /HOVCAR|JETCAR|UFO/.test(NM) ? 'hover' : wheels.length ? 'wheels' : 'track';
    let wl = wheels.map((w, i) => ({ c: BRR.toGL(...w.pos), steer: (w.flags & 0x10) !== 0, radius: wheelRad[i] }));
    if (!wl.length) {   // puntos de apoyo invisibles en las esquinas de la carrocería
      const c = BRR.toGL(bx[0], bx[1], bx[2]), hx = bx[3] * S * 0.8, hy = bx[4] * S, hz = bx[5] * S * 0.75, r = 0.35;
      let y = c[1] - hy + r + (kind === 'heli' ? 0 : 0.1);
      if (kind === 'track') {   // orugas: se apoya en lo más bajo de las orugas (si no, se ven hundidas en el suelo)
        let lo = 1e9; for (const v of body.verts) if (v) lo = Math.min(lo, BRR.toGL(v[0], v[1], v[2])[1]);
        for (const d of decoParts) for (const g of d.mesh.groups.values()) for (let q = 1; q < g.pos.length; q += 3) lo = Math.min(lo, g.pos[q] + d.p[1]);
        if (lo < 1e8) y = lo + r + 0.02; }
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { wl.push({ c: [c[0] + sx * hx, y, c[2] + sz * hz], steer: sz < 0, radius: r, virtual: true }); wheelMeshes.push(null); }
    }
    // centros de las luces de freno (izquierda y derecha) para el halo de luz
    const brakeMB = (() => { try { return buildBrake(body, findTM, lvl.pal); } catch (e) { console.warn(e); return null; } })(), brakeSpots = [];
    if (brakeMB) { const P = []; for (const g of brakeMB.groups.values()) for (let i = 0; i < g.pos.length; i += 3) P.push([g.pos[i], g.pos[i + 1], g.pos[i + 2]]);
      for (const sd of [-1, 1]) { const Q = P.filter(p => Math.sign(p[0] || sd) === sd); if (Q.length) brakeSpots.push([0, 1, 2].map(a => Q.reduce((s, q) => s + q[a], 0) / Q.length)); } }
    return {
      dmgFx, brakeSpots, tough: (() => { const m = all.match(/hnd damage\s+(\d+)/); return m ? +m[1] : 100; })(),
      kind, decoParts, brake: brakeMB,
      name, vname, mesh: mb, wheelMeshes, engineWav: engM ? name + '/' + engM[1].toUpperCase() + '.WAV' : null,
      nitro: nitroPos ? BRR.toGL(...nitroPos) : null, headPos: headPos ? BRR.toGL(...headPos) : null,
      head: intM ? BRR.toGL(num(intM[1]), num(intM[2]), num(intM[3])) : [0, 0.5, 0],
      wheels: wl,
      box: { c: BRR.toGL(bx[0], bx[1], bx[2]), h: [bx[3] * S, bx[4] * S, bx[5] * S] },
      gearF: table('f') || [[0, 600], [35000, 0]], gearB: table('b') || [[0, 444], [15000, 0]],
      steer: steerM ? [num(steerM[1]), num(steerM[2]), num(steerM[3]), num(steerM[4])] : [7000, 0x280, 28000, 0x180],
    };
  };

  // ---------- física ----------
  const SPEED_K = 30 / 35000;   // unidades de velocidad del script -> m/s (35000 ≈ 108 km/h)
  BRR.SPEED_K = SPEED_K;
  const curve = (rows, spd) => { // fuerza (0..~650) según la velocidad del script
    for (let i = 0; i < rows.length - 1; i++) {
      const [s0, f0] = rows[i], [s1, f1] = rows[i + 1];
      if (spd <= s1) return f0 + (f1 - f0) * Math.max(0, (spd - s0)) / Math.max(1, s1 - s0);
    }
    return 0;
  };
  BRR.Car = class {
    constructor(def, lvl) {
      this.def = def; this.lvl = lvl;
      this.m = 1200; const h = def.box.h;
      this.I = [this.m / 3 * (h[1] * h[1] + h[2] * h[2]) * 1.2, this.m / 3 * (h[0] * h[0] + h[2] * h[2]) * 1.2, this.m / 3 * (h[0] * h[0] + h[1] * h[1]) * 1.2];
      this.k = this.m * 9.81 / def.wheels.length / 0.15; this.c = 0.7 * Math.sqrt(this.k * this.m / def.wheels.length);
      this.W = def.wheels.map(w => ({ ...w, len: 0.3, prevLen: 0.3, spin: 0, contact: false, load: 0, slip: 0 }));
      // muelles según el peso que carga cada eje (centro de masas en el origen): todas las ruedas quedan a la misma altura en reposo
      { const zs = this.W.map(w => w.c[2]), f = Math.min(...zs), r = Math.max(...zs);
        if (r - f > 0.5 && f < 0 && r > 0) { const nf = this.W.filter(w => w.c[2] - f < (r - f) / 2).length, nr = this.W.length - nf;
          for (const w of this.W) { const t = (w.c[2] - f) / (r - f), share = Math.min(0.8, Math.max(0.2, t < 0.5 ? r / (r - f) : -f / (r - f))) / (t < 0.5 ? nf : nr);
            w.k = this.m * 9.81 * share / 0.15; w.cd = 0.7 * Math.sqrt(w.k * this.m * share); } } }
      this.ndrive = def.wheels.length;
      // parámetros según el tipo: altura de suspensión, agarre lateral, giro por par (sin ruedas), flota, vuela
      this.K = { wheels: { L0: 0.45, lat: 1 }, track: { L0: 0.45, lat: 1.1, muFix: 1 },
        hover: { L0: 0.95, lat: 0.16, muFix: 1, floats: 1, yaw: 1.7, thrust: 1 }, boat: { L0: 0.55, lat: 0.3, muFix: 1, floats: 1, yaw: 1.5, boat: 1, thrust: 1 },
        heli: { L0: 0.45, lat: 0.3, muFix: 1, floats: 1, yaw: 1.6, fly: 1 } }[def.kind || 'wheels'];
      this.altOff = 0;
      // esferas de la carrocería a lo largo del eje largo
      // esferas de la carrocería: siempre por encima del punto de apoyo de las ruedas (si no, rozan el suelo sin parar)
      const wb = Math.min(...this.W.map(w => w.c[1] - w.radius)), c = def.box.c;
      const r = Math.max(0.35, Math.min(h[0], h[1]) * 0.8), cy = Math.max(c[1], wb + 0.35 + r), n = Math.max(2, Math.round(h[2] * 2 / r));
      this.spheres = []; for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : i / (n - 1) * 2 - 1; this.spheres.push([c[0], cy, c[2] + t * Math.max(0, h[2] - r)]); }
      this.sr = r; this.contacts = [];
      this.reset(lvl.start.x, lvl.start.z, lvl.start.yaw);
    }
    reset(x, z, yaw, yHint) {
      // superficie: desde arriba (salida) o, al recolocar, la más cercana por debajo de la altura actual (no encima de un edificio)
      let y = this.lvl.terrain(x, z);
      const top = yHint != null ? Math.max(y, yHint) + 3 : y + 60;
      const hit = BRR.raycast(this.lvl, [x, top, z], [0, -1, 0], top - y + 10); if (hit) y = top - hit.t;
      const low = Math.min(...this.W.map(w => w.c[1] - w.radius));
      this.p = [x, y - low + 0.35, z]; this.v = [0, 0, 0]; this.w = [0, 0, 0]; this.q = BRR.Q.fromYaw(yaw);
      this.steerAng = 0; this.upsideTime = 0; this.nitroT = 0;
    }
    steerLock() { const def = this.def, spd = Math.abs(this.speed()) / SPEED_K, [s1, a1, s2, a2] = def.steer, tt = Math.min(1, Math.max(0, (spd - s1) / (s2 - s1))); return (a1 + (a2 - a1) * tt) / 0x280 * 0.55; }
    get topSpeed() { if (this._top) return this._top; if (this.K.fly) return this._top = 48; const r = this.def.gearF; let v = r[r.length - 1][0]; for (const x of r) if (x[1] <= 0) { v = x[0]; break; } return this._top = Math.min(60, v * SPEED_K); }
    get wheelBase() { const z = this.W.map(w => w.c[2]); return Math.max(1.5, Math.max(...z) - Math.min(...z)); }
    fireNitro() { if (this.nitroT > 0 || !(this.nitros > 0 || this.nitroInf)) return false; if (!this.nitroInf) this.nitros--; this.nitroT = 2.6; return true; }
    get R() { return BRR.Q.mat(this.q); }
    // régimen del motor 0..255 según la tabla "hnd gear" (columnas 4 y 5) -> tono del sonido
    rpm() {
      const vf = this.speed(), rows = vf >= -0.5 ? this.def.gearF : this.def.gearB, s = Math.abs(vf) / SPEED_K;
      for (let i = 0; i < rows.length - 1; i++) { const r = rows[i], n = rows[i + 1]; if (s <= n[0]) return r[3] + (r[4] - r[3]) * Math.max(0, s - r[0]) / Math.max(1, n[0] - r[0]); }
      return 255;
    }
    speed() { return V.dot(this.v, V.mul(this.forward(), 1)); }
    forward() { return mv(this.R, [0, 0, -1]); }
    step(dt, inp) {
      const R = this.R, up = mv(R, [0, 1, 0]), fwd = mv(R, [0, 0, -1]), right = mv(R, [1, 0, 0]);
      const vf = V.dot(this.v, fwd), spdScript = Math.abs(vf) / SPEED_K, def = this.def;
      // dirección: el ángulo máximo baja con la velocidad (tabla "hnd steering")
      const [s1, a1, s2, a2] = def.steer, tt = Math.min(1, Math.max(0, (spdScript - s1) / (s2 - s1)));
      const lock = (a1 + (a2 - a1) * tt) / 0x280 * 0.55;
      this.steerAng += (inp.steer * lock - this.steerAng) * Math.min(1, dt * 10);
      let F = [0, -9.81 * this.m, 0], T = [0, 0, 0];
      const K = this.K, L0 = K.L0, nW = this.W.length; let grounded = 0, wetN = 0;
      const throttle = inp.throttle, brake = inp.brake; this.thr = throttle;
      // marcha: adelante, freno o atrás
      let drive = 0;
      if (throttle > 0.01) drive = throttle * curve(def.gearF, vf > 0 ? spdScript : 0) / 600 * 7.5 * this.m;
      // nitro: empuje extra y supera la velocidad máxima
      if (this.nitroT > 0) { this.nitroT -= dt; drive = Math.max(drive, curve(def.gearF, Math.max(0, spdScript) * 0.7) / 600 * 7.5 * this.m) + 0.38 * 9.81 * this.m; }
      let braking = 0; this.brakeLight = brake > 0.05 && Math.abs(this.speed()) > 0.3;
      if (brake > 0.01) { if (vf > 1) braking = brake; else drive = -brake * curve(def.gearB, vf < 0 ? spdScript : 0) / 444 * 5 * this.m; }
      for (const w of this.W) {
        const top = V.add(this.p, mv(R, [w.c[0], w.c[1] + 0.3, w.c[2]])), down = V.mul(up, -1);
        const hit = BRR.raycast(this.lvl, top, down, L0 + w.radius, this.ghost ? BRR.THIN : null);
        w.contact = !!hit;
        if (!hit) { w.prevLen = w.len = L0; w.load = 0; w.spin += (w.spinRate || 0) * dt; continue; }
        grounded++;
        const len = Math.max(0, hit.t - w.radius), dl = (len - w.prevLen) / dt; w.prevLen = w.len = len;
        const kw = w.k || this.k, cw = w.cd || this.c; let Fs = kw * (L0 - len) - cw * dl; if (len <= 0.01) Fs += kw * 4 * (0.01 - len);
        Fs = Math.max(0, Fs); w.load = Fs;
        const n = hit.n, cp = V.madd(top, down, hit.t), r = V.sub(cp, this.p);
        const vc = V.add(this.v, V.cross(this.w, r));
        const sa = w.steer ? this.steerAng : 0;
        const f0 = V.add(V.mul(fwd, Math.cos(sa)), V.mul(right, Math.sin(sa)));
        const fw = V.norm(V.madd(f0, n, -V.dot(f0, n))), lat = V.norm(V.cross(fw, n));
        const vLong = V.dot(vc, fw), vLat = V.dot(vc, lat); let Flong0 = 0;
        const sf = hit.surf ? null : this.lvl.surface(cp[0], cp[2]); w.surface = sf ? sf.type : 'asfalto'; w.green = !!(sf && sf.grass);
        const MU = { asfalto: 1.0, tierra: 0.9, arena: 0.8, nieve: 0.72, agua: 0.62 };
        const mu = (K.muFix ? 1 : hit.surf ? 1.0 : MU[w.surface] || 0.95) * (inp.handbrake && !w.steer ? 0.45 : 1);
        if (w.surface === 'agua' && !K.floats) Flong0 -= vLong * 120;   // el agua frena (salvo a lo que flota)
        let dmul = 1;
        const rampHit = hit.surf && /RAMP|JUMP|SKI|WEDGE|SLOPE|KICK/.test(hit.tag || ''); if (rampHit) this.onRamp = 0.5;
        if (K.boat && !rampHit && (hit.surf || w.surface !== 'agua')) { dmul = 0.3; Flong0 -= vLong * 260; }   // la lancha fuera del agua apenas avanza (en las rampas, sí: salta)
        // en el agua lo que flota puede remontar los rápidos (en el original el agua no frena las subidas)
        if (K.floats && !hit.surf && w.surface === 'agua') wetN++;
        const share = this.m / nW;
        let Flat = -vLat * Math.min(14000, 0.5 * share / dt) * K.lat;
        let Flong = (K.thrust ? 0 : drive * dmul / this.ndrive) - vLong * 25 + Flong0;
        if (braking) Flong -= Math.sign(vLong) * Math.min(braking * 9 * share, Math.abs(vLong) * share / dt * 0.5);
        if (inp.handbrake && !w.steer) Flong -= Math.sign(vLong) * Math.min(6 * share, Math.abs(vLong) * share / dt * 0.5);
        if (!throttle && !brake && Math.abs(vLong) < 1.5) Flong -= vLong * Math.min(0.3 * share / dt, 6000);
        const lim = mu * Fs * 1.15, tot = Math.hypot(Flat, Flong);
        w.slip = tot > lim ? 1 - lim / tot : 0;
        if (tot > lim) { Flat *= lim / tot; Flong *= lim / tot; }
        // suspensión en el punto real; tracción/agarre aplicados cerca de la altura del centro de masas
        // (truco arcade para que no vuelque en cada curva, como en el original)
        const Fsus = V.mul(up, Fs), Ftire = V.add(V.mul(fw, Flong), V.mul(lat, Flat));
        const rT = V.madd(r, up, -V.dot(r, up) * 0.8);
        F = V.add(F, V.add(Fsus, Ftire)); T = V.add(T, V.add(V.cross(r, Fsus), V.cross(rT, Ftire)));
        w.spinRate = vLong / w.radius; w.spin += w.spinRate * dt;
      }
      if (!grounded) { this.air = (this.air || 0) + dt; this.fallV = Math.min(this.fallV || 0, this.v[1]); }
      else { if ((this.air || 0) > 0.35) { this.landed = Math.max(this.landed || 0, -(this.fallV || 0)); this.landEv = -(this.fallV || 0); } this.lastAir = this.air || 0; this.air = 0; this.fallV = 0; }
      this.grounded = grounded;
      // en el agua lo que flota remonta los rápidos (en el original el agua no impide las subidas): anula la gravedad cuesta arriba
      // hélice / turbina: empuje directo sobre el casco (no depende del agarre)
      if (K.thrust && (grounded || this.nitroT > 0)) F = V.madd(F, fwd, drive * (K.boat && !wetN && !(this.onRamp > 0) ? 0.3 : 1)); if (this.onRamp > 0) this.onRamp -= dt;
      // el aerodeslizador/jet sube las cuestas con su turbina (compensa parte de la gravedad en subida)
      if (K.floats && !K.boat && grounded && throttle > 0.1 && fwd[1] > 0 && !wetN) F = V.madd(F, fwd, this.m * 9.81 * fwd[1] * 0.6 * throttle);
      if (wetN && throttle > 0.1 && fwd[1] > 0) F =V.madd(F, fwd, this.m * 9.81 * fwd[1] * 1.05 * throttle * wetN / nW);
      // sin ruedas: se gira con par (aerodeslizador, lancha, helicóptero)
      if (K.yaw && (grounded || K.fly)) {
        const wy = V.dot(this.w, up), dir = vf < -0.5 && !K.fly ? -1 : 1;
        const target = -inp.steer * K.yaw * Math.min(1, 0.35 + Math.abs(vf) / 10) * dir;
        T = V.madd(T, up, (target - wy) * this.I[1] * 5);
      }
      // helicóptero: mantiene la altura sobre el suelo y los objetos (E/Q o cruceta para subir/bajar)
      if (K.fly) {
        this.altOff = Math.max(-4, Math.min(30, this.altOff + (inp.climb || 0) * 6 * dt));
        const fh = V.norm([fwd[0], 0, fwd[2]]), rh = [-fh[2], 0, fh[0]];
        const gy = (x, z) => { const h = BRR.raycast(this.lvl, [x, this.p[1] + 40, z], [0, -1, 0], 140); return h ? this.p[1] + 40 - h.t : this.lvl.terrain(x, z); };
        this.flyT = (this.flyT || 0) - dt;
        if (this.flyT <= 0) { this.flyT = 0.1; this.flyG = Math.max(gy(this.p[0], this.p[2]), gy(this.p[0] + this.v[0] * 1.5, this.p[2] + this.v[2] * 1.5), gy(this.p[0] + fh[0] * 12, this.p[2] + fh[2] * 12)); }
        const tgt = this.flyG + 6 + this.altOff, vyT = Math.max(-6, Math.min(8, (tgt - this.p[1]) * 1.5));
        F[1] += this.m * 9.81 + (vyT - this.v[1]) * this.m * 3;
        const thrust = (inp.throttle - inp.brake * 0.6) * 13 * this.m + (this.nitroT > 0 ? 7 * this.m : 0);
        F = V.madd(F, fh, thrust); F = V.madd(F, rh, -V.dot(this.v, rh) * this.m * 1.5);
        F = V.madd(F, [this.v[0], 0, this.v[2]], -0.26 * this.m);
        // actitud estable: se inclina un poco hacia donde avanza y hacia la curva
        const tf = inp.throttle - inp.brake * 0.6, dUp = V.norm(V.add(V.add([0, 1, 0], V.mul(fh, 0.22 * tf)), V.mul(rh, 0.25 * inp.steer)));
        const e = V.cross(up, dUp), wH = V.madd(this.w, up, -V.dot(this.w, up));
        T = V.add(T, V.mul(V.sub(V.mul(e, 60), V.mul(wH, 14)), this.I[0]));
      }
      // aire
      const sp = V.len(this.v); F = V.madd(F, this.v, -0.45 * sp);
      if (!grounded && !K.fly) { // un poco de control en el aire, como en el original
        T = V.add(T, V.mul(right, -inp.pitchAir * this.I[0] * 1.5));
      }
      // "tilter" del original: par que devuelve el coche a la vertical cuando se inclina demasiado
      const tilt = V.cross(up, [0, 1, 0]), tl = V.len(tilt), upY = up[1];
      if (!K.fly && (upY < 0.94 || tl > 0.35)) {
        const k = (grounded ? 14 : 5) * Math.min(1, (1 - upY) * 2 + 0.2);
        const tw = upY < 0 ? V.cross(up, [0, 1, 0]).map((x, i) => x || (i === 2 ? 1 : 0)) : tilt;
        T = V.add(T, [tw[0] * this.I[0] * k, tw[1] * this.I[1] * k, tw[2] * this.I[2] * k]);
      }
      // integración
      this.v = V.madd(this.v, F, dt / this.m);
      const Tl = mtv(R, T), wl = mtv(R, this.w);
      for (let i = 0; i < 3; i++) wl[i] += Tl[i] / this.I[i] * dt;
      this.w = mv(R, wl); this.w = V.mul(this.w, 1 - (grounded ? 1.5 : 0.4) * dt);
      this.p = V.madd(this.p, this.v, dt); this.q = BRR.Q.integrate(this.q, this.w, dt);
      this.collide(dt);
      // tras un golpe contra el suelo, que no salga girando como una peonza: limita cabeceo/alabeo (el giro en planta se respeta)
      { const up2 = this.R ? BRR.mv(this.R, [0, 1, 0]) : [0, 1, 0], wy = V.dot(this.w, up2), wt = V.madd(this.w, up2, -wy), L = V.len(wt), mx = this.K && this.K.fly ? 3 : 2.6;
        if (L > mx) this.w = V.madd(V.mul(wt, mx / L), up2, wy); }
      // vuelco: recolocar tras 2,5 s boca abajo y casi quieto
      const R2 = this.R; if (R2[1][1] < 0.2 && V.len(this.v) < 3) this.upsideTime += dt; else this.upsideTime = 0;
      if (this.upsideTime > 2.5) this.recover();
      if (this.p[1] < -200) this.recover();
    }
    collide(dt) {
      const R = this.R;
      // muros invisibles en el borde del mapa (una celda hacia dentro)
      const edge = this.lvl.size / 256, lo = edge, hi = this.lvl.size - 2 * edge;
      const walls = [[1, 0, 0, lo], [-1, 0, 0, -hi], [0, 0, -1, lo], [0, 0, 1, -hi]];  // n·p >= d   (z del mundo es negativa)
      for (const sl of this.spheres) {
        const s = V.add(this.p, mv(R, sl));
        BRR.sphereContacts(this.lvl, s, this.sr, this.contacts, this.ghost ? BRR.THIN : null);
        for (const [nx, ny, nz, d] of walls) {
          const dist = nx * s[0] + nz * s[2] - d;
          if (dist < this.sr) this.contacts.push({ n: [nx, 0, nz], depth: this.sr - dist, p: [s[0] - nx * dist, s[1], s[2] - nz * dist] });
        }
        for (const c of this.contacts) {
          this.p = V.madd(this.p, c.n, c.depth * 0.9);
          const r = V.sub(c.p, this.p), vrel = V.add(this.v, V.cross(this.w, r)), vn = V.dot(vrel, c.n);
          if (vn >= 0) continue;
          const Rn = V.cross(r, c.n), IinvRn = this.invI(Rn), den = 1 / this.m + V.dot(c.n, V.cross(IinvRn, r));
          // contra el suelo (caída de un salto): rebote y poco rozamiento, para que el coche siga corriendo tras el golpe
          // en vez de frenar en seco; contra paredes: rozamiento normal
          const floor = c.n[1] > 0.6, e = floor ? (vn < -5 ? 0.22 : 0.1) : 0.25;
          const j = -(1 + e) * vn / den;
          this.applyImpulse(V.mul(c.n, j), r, floor ? 0.18 : 0.35);   // contra el suelo, poco giro (rebota sin dar vueltas de campana)
          const vt = V.madd(vrel, c.n, -vn), vtl = V.len(vt);
          if (vtl > 1e-3) { const jt = Math.min((floor ? 0.12 : 0.5) * j, vtl / den); this.applyImpulse(V.mul(vt, -jt / vtl), r); }
          if (c.n[1] < 0.6) this.lastHit = Math.max(this.lastHit || 0, -vn);   // solo golpes contra paredes, no contra el suelo
        }
      }
    }
    invI(v) { const R = this.R, l = mtv(R, v); return mv(R, [l[0] / this.I[0], l[1] / this.I[1], l[2] / this.I[2]]); }
    applyImpulse(J, r, ang = 0.35) { this.v = V.madd(this.v, J, 1 / this.m); this.w = V.add(this.w, V.mul(this.invI(V.cross(r, J)), ang)); }
    recover() {
      const f = this.forward(); this.reset(this.p[0], this.p[2], Math.atan2(-f[0], -f[2]), this.p[1]);
    }
  };
})();
