// Lector de modelos .3DW (Virtek 3D-Ware) — ver FORMATOS.md
"use strict";
(function () {
  const BRR = window.BRR;
  BRR.parse3DW = function (bytes, lod = 0) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const I = o => dv.getInt32(o, true);
    const texoff = I(16);
    const lods = []; let o = 32;
    while (I(o) !== -1) { lods.push([dv.getUint32(o, true) >>> 16, I(o + 4)]); o += 8; }
    const texs = new Map(); o = texoff;
    while (I(o) !== -1) {
      const size = I(o + 4); let s = '';
      for (let k = o + 12; k < o + size && bytes[k]; k++) s += String.fromCharCode(bytes[k]);
      texs.set(o, s.toUpperCase()); o += size;
    }
    o = lods[Math.min(lod, lods.length - 1)][1];
    const nb = I(o); const boxes = [];
    for (let k = 0; k < nb; k++) boxes.push([0, 1, 2, 3, 4, 5].map(j => I(o + 4 + 24 * k + 4 * j) * 0.5));   // los modelos guardan el doble de las unidades del mundo
    o += 4 + nb * 24 + 4;
    const nv = I(o); o += 12;
    const verts = new Array(nv).fill(null), faces = [], stack = [];
    let state = null, cond = null, condEnd = -1, altUV = null, els = null, elsEnd = -1;   // geometría condicional: orden 9 + caras ("si") y bloque 7 ("si no"); variable 2: el "si" son los pilotos apagados, el "si no" encendidos (frenando)
    const uvblock = p => {
      const rel = I(p + 4), n = I(p + 8), t = p + 4 + rel;
      const uv = []; for (let k = 0; k < n; k++) uv.push([I(p + 12 + 8 * k), I(p + 16 + 8 * k)]);
      return { tex: texs.get(t - 8) || null, uv };
    };
    for (let guard = 0; guard < 200000; guard++) {
      if (o + 4 > bytes.length) break;
      if (cond !== null && o >= condEnd) cond = null;
      if (els !== null && o >= elsEnd) els = null;
      const c = I(o);
      if (c === 0) { if (stack.length) { o = stack.pop(); continue; } break; }
      if (c === 1) {
        const s = I(o + 4), n = I(o + 8);
        for (let k = 0; k < n; k++) verts[s + k] = [I(o + 12 + 12 * k) * 0.5, I(o + 16 + 12 * k) * 0.5, I(o + 20 + 12 * k) * 0.5];   // (escala 1/2: el cartel cabe entre sus postes, las rampas encajan)
        o += 12 + 12 * n;
      } else if (c === 2 || c === 14) {
        const n = I(o + 4), col = I(o + 8); const idx = [];
        for (let k = 0; k < n; k++) idx.push(I(o + 16 + 4 * k));
        faces.push({ color: col & 255, idx, two: c === 14, cond, els }); o += 16 + 4 * n;
      } else if (c === 5) { const u = uvblock(o); o += 12 + 8 * u.uv.length;
        // una textura dentro del "si" (p. ej. piloto encendido al frenar) es la alternativa de la que viene en el "si no"
        if (cond !== null) { altUV = { cond, tex: u.tex, uv: u.uv, n: 0 }; state = u; }   // (también vale para las caras de dentro del "si")
        else { if (altUV && altUV.n++ > 0) altUV = null; state = u; } }
      else if (c === 6) {
        const n = I(o + 4); const idx = [];
        for (let k = 0; k < n; k++) idx.push(I(o + 12 + 4 * k));
        if (state) faces.push({ tex: state.tex, uv: state.uv, idx, cond, els, alt: altUV && altUV.n > 0 && cond === null ? altUV : null }); o += 12 + 4 * n;
      } else if (c === 8) { stack.push(o + 8); o = o + 4 + I(o + 4); }
      else if (c === 7) { if (cond !== null) { els = cond; elsEnd = o + 4 + I(o + 4); cond = null; o += 8; } else o = o + 4 + I(o + 4); }   // fin del "si": el bloque "si no" es la geometría normal
      else if (c === 9) { const v = I(o + 8); if (v === 2) { cond = v; condEnd = o + 20 + I(o + 16); } o += 20; }   // solo la variable 2 (freno); las demás como antes: se pinta el "si" y se salta el "si no"
      else if (c === 10) o += 24;
      else if (c === 11) o += 16;
      else break; // comandos 3/12 sin documentar
    }
    return { radius: I(0), boxes, verts, faces, texNames: [...texs.values()] };
  };
})();
