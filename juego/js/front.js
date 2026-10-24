// Datos del menú original: tarjetas de circuito (VIEW.RAW), fondos (.SCN), textos en español (TOURN.SPA),
// orden del torneo y pistas de música/presentación del CD (TOURN.TXT)
"use strict";
(function () {
  const BRR = window.BRR;
  const CP850 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ';
  const dos = b => { let s = ''; for (const c of b) s += c < 128 ? String.fromCharCode(c) : CP850[c - 128]; return s; };
  BRR.dosText = dos;
  // imagen RAW 320×200 con paleta VGA de 768 bytes delante -> dataURL
  BRR.rawToURL = function (d) {
    if (!d || d.length < 64768) return null;
    const c = document.createElement('canvas'); c.width = 320; c.height = 200; const g = c.getContext('2d'), im = g.createImageData(320, 200);
    for (let i = 0; i < 64000; i++) { const p = d[768 + i] * 3; im.data[i * 4] = (d[p] & 63) * 255 / 63; im.data[i * 4 + 1] = (d[p + 1] & 63) * 255 / 63; im.data[i * 4 + 2] = (d[p + 2] & 63) * 255 / 63; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0); return c.toDataURL();
  };
  // ficheros de textos: bloque = línea en blanco, ID, líneas "@..." de posición y el texto (\ = salto de línea)
  function parseStrings(txt) {
    const out = {}, L = txt.split(/\r?\n/); let id = null, buf = [];
    const flush = () => { if (id) out[id] = buf.join(' ').replace(/\s*\\\s*/g, '\n').replace(/[ \t]+/g, ' ').trim(); id = null; buf = []; };
    for (const l of L) {
      if (/^;/.test(l)) continue;
      if (!l.trim()) { flush(); continue; }
      if (!id && /^[A-Z0-9_]+\s*$/.test(l.trim())) { id = l.trim(); continue; }
      if (id && !/^@/.test(l.trim())) buf.push(l.trim());
    }
    flush(); return out;
  }
  BRR.loadFront = async function (files) {
    const F = { tracks: [], series: [], str: {}, bg: {} };
    const W = files.has('TOURN.WAP') ? await files.archive('TOURN.WAP') : new Map();
    for (const lang of ['TOURN.SPA', 'TOURN.ENG']) if (W.get(lang)) { F.str = parseStrings(dos(W.get(lang))); F.lang = lang; break; }
    const T = W.get('TOURN.TXT') ? BRR.text(W.get('TOURN.TXT')).replace(/;[^\n]*/g, '') : '';
    const num = t => { const n = t[0] === '-'; t = t.replace('-', ''); const v = t[0] === '&' ? parseInt(t.slice(1), 16) : parseInt(t, 10); return n ? -v : v; };
    for (const m of T.matchAll(/^\s*track\s+(\w+)\s+(\w+)\s+(\w+)\s+(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?&?\w+)\s*,\s*(-?&?\w+)\s*,\s*(-?\w+)/gm))
      if (files.has(m[1] + '.LEV')) { const X = num(m[7]), Y = num(m[8]), pl = num(m[9]);
        // posición en el globo del original: longitud = 308° − X, latitud = 90° − Y (65536 = 360°); planeta 1-3 = Marte/Venus/Luna
        F.tracks.push({ id: m[1], glb: m[2], vie: m[3], intro: +m[5], music: +m[6], planet: pl, lon: 308 - X / 65536 * 360, lat: 90 - Y / 65536 * 360 }); }
    // torneos: bloques "tourn N ... need K ... use X"
    for (const m of T.matchAll(/tourn\s+(\d+)([\s\S]*?)(?=tourn\s+\d+|endalltourn)/g)) {
      const need = +((m[2].match(/need\s+(\d+)/) || [0, 1])[1]), use = [...m[2].matchAll(/use\s+(\w+)/g)].map(x => x[1]).filter(n => files.has(n + '.LEV'));
      if (use.length) F.series.push({ n: +m[1], need, use });
    }
    const pm = T.match(/network[\s\S]*?points\s+([\d,\s]+)/); F.points = pm ? pm[1].split(/[\s,]+/).filter(Boolean).map(Number) : [10, 5, 3, 2, 1, 0];
    // circuitos que no estén en TOURN.TXT (por si acaso)
    for (const n of files.list('.LEV').map(n => n.replace('.LEV', ''))) if (!n.startsWith('TEST') && !F.tracks.find(t => t.id === n)) F.tracks.push({ id: n, glb: '', vie: '', intro: 0, music: 0 });
    // imágenes de los circuitos y fondos de pantalla
    for (const t of F.tracks) {
      try { const A = await files.archive(t.id + '.LEV'); t.view = BRR.rawToURL(A.get('VIEW.RAW'));
        const tx = A.get(t.id + '.TXT'); if (tx) { const s = BRR.text(tx).replace(/;[^\n]*/g, ''); t.cars = [...s.matchAll(/^\s*car\s+(\w+)/gm)].map(x => x[1].toUpperCase()).slice(0, 2).filter(n => n !== 'FEHELI' && files.has(n + '.VHC'));   // el original deja elegir los 2 primeros (el 3º es el helicóptero de cámara u oculto)
          t.laps = +((s.match(/^\s*laps\s+(\d+)/m) || [0, 3])[1]); }
      } catch (e) { }
      t.place = F.str[t.glb] || ''; t.desc = F.str[t.vie] || '';
      t.diff = /^(F[áa]cil|Easy)/i.test(t.desc) ? 1 : /^(Mediano|Medium)/i.test(t.desc) ? 2 : /^(Duro|Hard)/i.test(t.desc) ? 3 : 2;
      t.desc = t.desc.replace(/^(F[áa]cil|Mediano|Duro|Easy|Medium|Hard)\s*-\s*/i, '');
    }
    try { F.world = await BRR.buildWorldMap(files); } catch (e) { console.error(e); F.world = null; }
    F.planets = {}; for (const [k, w] of [[1, 'marte'], [2, 'venus'], [3, 'luna']]) try { F.planets[k] = await BRR.buildWorldMap(files, w); } catch (e) { }
    for (const [k, scn, raw] of [['menu', 'GAMESCN', 'GAMESCN.RAW'], ['team', 'LOGOSCN', 'TEAM.RAW'], ['tune', 'CHOOSCN', 'CONFIG4B.RAW'], ['results', 'RESULSCN', 'RESULSCN.RAW'], ['options', 'OPTSCN', 'OPTSCN.RAW'], ['load', 'LANDSCN', 'LANDSCN.RAW'], ['bye', 'BYESCN', 'BYESCN.RAW']]) {
      try { if (files.has(scn + '.SCN')) F.bg[k] = BRR.rawToURL((await files.archive(scn + '.SCN')).get(raw)); } catch (e) { }
    }
    return F;
  };
})();
// ---------- globo terráqueo del original (GLOBESCN: texturas en husos + paleta GLOBE.COL) ----------
(function () {
  const BRR = window.BRR;
  // reconstruye un mapa equirectangular 512×256 a partir de los 12 husos (6 por textura, hemisferio sur arriba y norte abajo, intercalados)
  // which: tierra (GLOBE.COL) · marte / luna (las mismas texturas con MARSPAL / MOONPAL) · venus (VENUSTEX + VENUSPAL)
  BRR.buildWorldMap = async function (files, which = 'tierra') {
    if (!files.has('GLOBESCN.SCN')) return null;
    const A = await files.archive('GLOBESCN.SCN'), ven = which === 'venus';
    const t1 = A.get(ven ? 'VENUSTEX.TM' : 'WORLDTX1.TM'), t2 = A.get(ven ? 'VENUSTEX.TM' : 'WORLDTX2.TM'), cp = A.get({ tierra: 'GLOBE.COL', marte: 'MARSPAL.COL', luna: 'MOONPAL.COL', venus: 'VENUSPAL.COL' }[which]);
    if (!t1 || !t2 || !cp) return null;
    const pal = BRR.pal6(cp.subarray(0, 768)), T = [t1, t2], W = 512, H = 256, img = new Uint8ClampedArray(W * H * 4);
    const sample = (lat, lon) => {
      lon = ((lon + 180) % 360 + 360) % 360 - 180;
      let ti = lon < 0 ? 0 : 1, base = ti ? 0 : -180, loc = lon - base, k, lc, cx, y, half;
      if (lat >= 0) { k = Math.min(5, Math.floor(loc / 30)); lc = base + 15 + 30 * k; cx = 39 + 39 * k; y = 172 - lat / 90 * 104; half = 19 * (y - 68) / 104; }
      else { k = Math.floor((loc + 15) / 30); if (k >= 6) { ti = 1 - ti; base = ti ? 0 : -180; k = 0; if (lon > 0) lon -= 360; else lon += 360; lon = ((lon + 180) % 360 + 360) % 360 - 180; }
        lc = base + 30 * k; let d = lon - lc; if (d > 180) d -= 360; if (d < -180) d += 360; cx = 20 + 39 * k; y = 12 + (-lat) / 90 * 106; half = 19 * (118 - y) / 106; return T[ti][Math.min(191, Math.max(0, Math.round(y))) * 256 + ((Math.round(cx + d / 15 * half) % 256) + 256) % 256]; }
      let d = lon - lc; return T[ti][Math.min(191, Math.max(0, Math.round(y))) * 256 + ((Math.round(cx + d / 15 * half) % 256) + 256) % 256];
    };
    for (let j = 0; j < H; j++) { const lat = 90 - (j + .5) * 180 / H; for (let i = 0; i < W; i++) { const c = sample(lat, -180 + (i + .5) * 360 / W), o = (j * W + i) * 4; img[o] = pal[c * 3]; img[o + 1] = pal[c * 3 + 1]; img[o + 2] = pal[c * 3 + 2]; img[o + 3] = 255; } }
    return { W, H, img };
  };
  // globo que gira hasta un punto (lon/lat en grados) y marca los circuitos
  BRR.Globe = class {
    constructor(canvas, map) { this.c = canvas; this.g = canvas.getContext('2d'); this.map = map; this.lon = 0; this.lat = 20; this.tLon = 0; this.tLat = 20; this.marks = []; this.sel = null; this.run = false; }
    focus(lon, lat) { if (!isFinite(lon) || !isFinite(lat)) { lon = this.lon + 40; lat = 15; } if (!isFinite(this.lon)) this.lon = 0; if (!isFinite(this.lat)) this.lat = 20; this.drawn = false; this.tLon = lon; this.tLat = Math.max(-60, Math.min(60, lat)); this.start(); }
    start() { if (this.run) return; this.run = true; let last = performance.now(); const step = t => { if (!this.c.isConnected || this.c.offsetParent === null) { this.run = false; return; } const dt = Math.min(0.05, (t - last) / 1000); last = t; this.frame(dt); requestAnimationFrame(step); }; requestAnimationFrame(step); }
    frame(dt) {
      let d = this.tLon - this.lon; while (d > 180) d -= 360; while (d < -180) d += 360;
      this.lon += d * Math.min(1, dt * 3); this.lon = ((this.lon + 180) % 360 + 360) % 360 - 180; this.tLon = this.lon + d * (1 - Math.min(1, dt * 3)); this.lat += (this.tLat - this.lat) * Math.min(1, dt * 3);
      if (Math.abs(d) < 0.05 && Math.abs(this.tLat - this.lat) < 0.05 && this.drawn) return; this.drawn = true;
      const N = this.c.width, g = this.g, im = g.createImageData(N, N), r = N / 2 - 2, M = this.map, la = this.lat * Math.PI / 180, ca = Math.cos(la), sa = Math.sin(la), lo0 = this.lon;
      for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
        const x = (px - N / 2) / r, y = (N / 2 - py) / r, q = x * x + y * y; if (q > 1) continue;
        const z = Math.sqrt(1 - q), y2 = y * ca + z * sa, z2 = -y * sa + z * ca;   // inclinar
        const lat = Math.asin(Math.max(-1, Math.min(1, y2))) * 180 / Math.PI, lon = Math.atan2(x, z2) * 180 / Math.PI + lo0;
        const u = ((Math.floor((lon + 180) / 360 * M.W) % M.W) + M.W) % M.W, v = Math.min(M.H - 1, Math.floor((90 - lat) / 180 * M.H)), s = (v * M.W + u) * 4, o = (py * N + px) * 4;
        const sh = 0.45 + 0.55 * Math.max(0, x * -0.4 + y * 0.45 + z * 0.8);
        im.data[o] = M.img[s] * sh; im.data[o + 1] = M.img[s + 1] * sh; im.data[o + 2] = M.img[s + 2] * sh; im.data[o + 3] = 255;
      }
      g.clearRect(0, 0, N, N); g.putImageData(im, 0, 0);
      // marcas de circuitos (por delante del globo)
      for (const m of (this.noMarks ? [] : this.marks)) {
        const lat = m.lat * Math.PI / 180, lon = (m.lon - lo0) * Math.PI / 180, x = Math.cos(lat) * Math.sin(lon), y0 = Math.sin(lat), z0 = Math.cos(lat) * Math.cos(lon);
        const y = y0 * ca - z0 * sa, z = y0 * sa + z0 * ca; if (z < 0.05) continue;
        const sx = N / 2 + x * r, sy = N / 2 - y * r, on = m === this.sel;
        g.beginPath(); g.arc(sx, sy, on ? 6 : 3.5, 0, 7); g.fillStyle = on ? '#ffd23f' : m.c || '#fff'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#000'; g.stroke();
        if (on) { g.font = 'bold 12px system-ui'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeText(m.name, sx + 9, sy + 4); g.fillText(m.name, sx + 9, sy + 4); }
      }
      g.beginPath(); g.arc(N / 2, N / 2, r, 0, 7); g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,.25)'; g.stroke();
    }
  };
})();
