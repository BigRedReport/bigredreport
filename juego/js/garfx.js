// Garaje: lo que cambia la malla del coche al cargarlo.
//  - dos tonos (techo y/o capó de otro color)
//  - franjas de carreras por encima del coche (siguen la forma del capó, el techo y el maletero; se saltan los cristales)
//  - dorsal en las puertas
// La altura, la caída de las ruedas y el acabado de la pintura se aplican al dibujar (main.js).
"use strict";
(function () {
  const BRR = window.BRR, prev = BRR.loadVehicle;
  const hex = h => { const m = /^#([0-9a-f]{6})$/i.exec(h || ''); return m ? [0, 2, 4].map(i => parseInt(m[1].substr(i, 2), 16) / 255) : null; };
  BRR.garFx = function (d, G) {
    const mb = d && d.mesh; if (!mb || !mb.groups || !G) return; const c2 = hex(G.tone2Col), tm = G.tone2 || 'no', st = G.stripes || 'no', sc = hex(G.stripeCol) || [0.95, 0.95, 0.93], num = String(G.num ?? '').replace(/[^0-9]/g, '').slice(0, 2);
    if ((tm === 'no' || !c2) && st === 'no' && !num) return;
    let y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9, xm = 0; const T = [];   // triángulos: [grupo, índice, oscuro]
    for (const [key, g] of mb.groups) for (let i = 0; i + 8 < g.pos.length; i += 9) { for (let k = 0; k < 9; k += 3) { y0 = Math.min(y0, g.pos[i + k + 1]); y1 = Math.max(y1, g.pos[i + k + 1]); z0 = Math.min(z0, g.pos[i + k + 2]); z1 = Math.max(z1, g.pos[i + k + 2]); xm = Math.max(xm, Math.abs(g.pos[i + k])); }
      T.push([g, i, g.col ? Math.max(g.col[i], g.col[i + 1], g.col[i + 2]) < 0.22 : false]); }
    const H = y1 - y0, L = z1 - z0; if (!(H > 0.3 && L > 1)) return; const C = mb.group('COLOR');
    // 1) dos tonos: las caras que miran hacia arriba del techo y/o del capó
    if (tm !== 'no' && c2) for (const [g, i, dark] of T) { if (!g.col || dark) continue; const p = g.pos, ax = p[i + 3] - p[i], ay = p[i + 4] - p[i + 1], az = p[i + 5] - p[i + 2], bx = p[i + 6] - p[i], by = p[i + 7] - p[i + 1], bz = p[i + 8] - p[i + 2];
      const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, l = Math.hypot(nx, ny, nz) || 1; if (Math.abs(ny) / l < 0.72) continue;
      const fy = ((p[i + 1] + p[i + 4] + p[i + 7]) / 3 - y0) / H, fz = ((p[i + 2] + p[i + 5] + p[i + 8]) / 3 - z0) / L, roof = fy > 0.8, hood = fz < 0.36 && fy > 0.38 && fy <= 0.8;
      if ((roof && tm !== 'capo') || (hood && tm !== 'techo')) for (let k = 0; k < 9; k++) g.col[i + k] = c2[k % 3]; }
    // rayo hacia abajo: altura de la carrocería en (x, z) y si lo que hay es cristal u otra pieza oscura
    const top = (x, z) => { let best = -1e9, dk = false; for (const [g, i, dark] of T) { const p = g.pos, x1 = p[i], z1b = p[i + 2], x2 = p[i + 3], z2 = p[i + 5], x3 = p[i + 6], z3 = p[i + 8];
        if ((x < x1 && x < x2 && x < x3) || (x > x1 && x > x2 && x > x3) || (z < z1b && z < z2 && z < z3) || (z > z1b && z > z2 && z > z3)) continue;
        const den = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1b - z3); if (Math.abs(den) < 1e-9) continue; const a = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / den, b = ((z3 - z1b) * (x - x3) + (x1 - x3) * (z - z3)) / den, c = 1 - a - b; if (a < -1e-4 || b < -1e-4 || c < -1e-4) continue;
        const y = a * p[i + 1] + b * p[i + 4] + c * p[i + 7]; if (y > best) { best = y; dk = dark; } } return best > -1e8 && !dk ? best : null; };
    const quad = (g, P, col, uv, lay) => { for (const k of [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]) { g.pos.push(P[k][0], P[k][1], P[k][2]); if (g.col) g.col.push(col[0], col[1], col[2]); if (g.uv) g.uv.push(uv[k][0], uv[k][1]); g.lay.push(lay); } };
    // 2) franjas
    if (st !== 'no') { const bands = st === 'ancha' ? [[-0.22, 0.22]] : [[-0.29, -0.07], [0.07, 0.29]];
      for (const [xa, xb] of bands) { let pa = null; for (let z = z0 + 0.04; z <= z1 - 0.03; z += 0.09) { const ya = top(xa, z), yb = top(xb, z), ym = top((xa + xb) / 2, z);
          if (ya == null || yb == null || ym == null || ya < y0 + H * 0.3) { pa = null; continue; } const cur = [z, ya + 0.014, yb + 0.014];
          if (pa && Math.abs(pa[1] - cur[1]) < 0.05 && Math.abs(pa[2] - cur[2]) < 0.05) quad(   /* solo donde la chapa va casi plana: se salta los parabrisas y las lunas (van inclinados) */ C, [[xa, pa[1], pa[0]], [xb, pa[2], pa[0]], [xb, cur[2], cur[0]], [xa, cur[1], cur[0]]], sc, null, 2); pa = cur; } } }
    // 3) dorsal en las puertas: una placa blanca con el número, pegada al costado
    if (num && typeof document !== 'undefined') { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g2 = cv.getContext('2d'); g2.fillStyle = '#f4f4f0'; g2.fillRect(0, 0, 64, 64); g2.strokeStyle = '#111'; g2.lineWidth = 3; g2.strokeRect(2.5, 2.5, 59, 59);
      g2.fillStyle = '#111'; g2.font = 'bold ' + (num.length > 1 ? 40 : 48) + 'px Arial, sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(num, 32, 35);
      const name = 'DORSAL' + num; mb.textures.set(name, { w: 64, h: 64, data: new Uint8Array(g2.getImageData(0, 0, 64, 64).data.buffer), smooth: true }); const gt = mb.group('tex:' + name);
      const side = (sx, y, z) => { let best = null; for (const [g, i] of T) { const p = g.pos, ya = p[i + 1], za = p[i + 2], yb = p[i + 4], zb = p[i + 5], yc = p[i + 7], zc = p[i + 8];
          if ((y < ya && y < yb && y < yc) || (y > ya && y > yb && y > yc) || (z < za && z < zb && z < zc) || (z > za && z > zb && z > zc)) continue;
          const den = (zb - zc) * (ya - yc) + (yc - yb) * (za - zc); if (Math.abs(den) < 1e-9) continue; const a = ((zb - zc) * (y - yc) + (yc - yb) * (z - zc)) / den, b = ((zc - za) * (y - yc) + (ya - yc) * (z - zc)) / den, c = 1 - a - b; if (a < -1e-4 || b < -1e-4 || c < -1e-4) continue;
          const x = a * p[i] + b * p[i + 3] + c * p[i + 6]; if (best == null || x * sx > best * sx) best = x; } return best; };
      const s = Math.min(0.46, H * 0.36), zc = (z0 + z1) / 2 + L * 0.03, yc = y0 + H * 0.47;
      for (const sx of [-1, 1]) { const P = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => { const z = zc + sx * u * s / 2, y = yc + v * s / 2, x = side(sx, y, z); return x == null ? null : [x + sx * 0.02, y, z]; });
        if (P.some(q => !q) || Math.max(...P.map(q => Math.abs(q[0]))) - Math.min(...P.map(q => Math.abs(q[0]))) > 0.25) continue;
        quad(gt, P, null, [[0, 1], [1, 1], [1, 0], [0, 0]], 2); } }
  };
  BRR.loadVehicle = async function (files, name, lvl, team, extra) { const d = await prev(files, name, lvl, team, extra); try { if (extra && extra.gar) BRR.garFx(d, extra.gar); } catch (e) { } return d; };
})();
