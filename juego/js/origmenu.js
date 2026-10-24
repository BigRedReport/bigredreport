// Menú original de Big Red Racing: pantallas .SCN (fondo RAW, sprites SPR, textos con las "letras locas" WIBS1-5,
// zonas de ratón y teclas) dibujadas a 320×200 y escaladas, con el flujo de pantallas del juego.
"use strict";
(function () {
  const BRR = window.BRR;
  const W = 320, H = 200;
  // sprites: u16 número, u32 posiciones; cada uno: u16 ancho, alto, a, b + píxeles (0 = transparente)
  function parseSPR(d) {
    if (!d) return [];
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength), n = dv.getUint16(0, true), out = [];
    for (let i = 0; i < n; i++) {
      const o = dv.getUint32(2 + i * 4, true); if (o + 8 > d.length) { out.push(null); continue; }
      const w = dv.getUint16(o, true), h = dv.getUint16(o + 2, true), a = dv.getUint16(o + 4, true), b = dv.getUint16(o + 6, true);
      out.push({ w, h, a, b, px: d.subarray(o + 8, o + 8 + w * h) });
    }
    return out;
  }
  const num = t => { t = String(t).trim(); const n = t[0] === '-'; t = t.replace('-', ''); const v = t[0] === '&' ? parseInt(t.slice(1), 16) : parseInt(t, 10); return n ? -v : v; };
  // textos: bloque = ID + líneas "@X x,y" "@F n" "@C n" "@W" y texto ("\" = salto de línea)
  function parseText(txt) {
    const out = {}, L = txt.split(/\r?\n/); let id = null, ops = [];
    const flush = () => { if (id) out[id] = ops; id = null; ops = []; };
    for (const raw of L) {
      const l = raw.replace(/\s+$/, '');
      if (/^;/.test(l)) continue;
      if (!l.trim()) { flush(); continue; }
      if (!id) { if (/^[A-Z0-9_]+$/.test(l.trim())) id = l.trim(); continue; }
      if (/^\s*@/.test(l)) {
        for (const m of l.matchAll(/@([A-Z])([-\d]*(?:,[-\d]+)?)/g)) {
          if (m[1] === 'X') { const [x, y] = m[2].split(',').map(Number); ops.push({ X: x, Y: y }); }
          else if (m[1] === 'F') ops.push({ F: +m[2] }); else if (m[1] === 'C') ops.push({ C: +m[2] }); else if (m[1] === 'W') ops.push({ Wb: 1 });
        }
      } else ops.push({ t: l.trim() });
    }
    flush(); return out;
  }
  function parseScript(txt) {
    const S = { raw: null, spr: null, items: [], boxes: [], keys: [], glbox: [] };
    let lang = 'ANY';
    for (const raw of txt.split(/\r?\n/)) {
      const l = raw.replace(/;.*$/, '').replace(/\/\/.*$/, '').trim(); if (!l) continue;
      const [cmd, ...rest] = l.split(/\s+/); const args = rest.join(' ').split(',').map(s => s.trim());
      const c = cmd.toLowerCase();
      if (c === 'iflang') { lang = (rest[0] || 'ANY').toUpperCase(); continue; }
      if (lang !== 'ANY' && lang !== 'SPA') continue;
      if (c === 'raw') S.raw = rest[0].toUpperCase();
      else if (c === 'spr') S.spr = rest[0].toUpperCase();
      else if (c === 'anisprite') S.items.push({ type: 'spr', g: num(args[0]), first: num(args[1]), x: num(args[3]), y: num(args[4]) });
      else if (c === 'stext') S.items.push({ type: 'txt', g: num(args[0]), id: args[1].split(/\s+/)[0], font: num((args[1].split(/\s+/)[1]) || args[2]) });
      else if (c === 'mbox') S.boxes.push({ id: num(args[0]), x: num(args[1]), y: num(args[2]), w: num(args[3]), h: num(args[4]) });
      else if (c === 'key') S.keys.push({ id: num(args[0]), sc: num(args[1]) });
      else if (c === 'glbox') S.glbox.push({ g: num(args[0]), x: num(args[2]), y: num(args[3]), w: num(args[4]), h: num(args[5]) });
    }
    return S;
  }
  // letras: código -> índice de glifo (WIBS y SML_ALPH empiezan en el espacio; sin minúsculas)
  const ACC = { 'á': 'à', 'í': 'ì', 'ó': 'ò', 'ú': 'ù', 'Á': 'A', 'É': 'È', 'Í': 'I', 'Ó': 'O', 'Ú': 'Ù', 'ñ': 'N', 'Ñ': 'N', '¿': '?', '¡': '!', 'ª': 'A', 'º': 'O' };
  const WIBS_EXTRA = { 'Ø': 61, '©': 59, '\x01': 61, '\x02': 61, '☺': 61, '☻': 61, 'È': 62, 'é': 63, 'É': 63, 'Ê': 64, 'ê': 64, 'à': 65, 'â': 66, 'ä': 67, 'ì': 68, 'î': 69, 'ï': 70, 'Ï': 70, 'ç': 71, 'Ç': 71, 'ò': 72, 'ô': 73, 'ö': 74, 'Ö': 74, 'ù': 75, 'Ù': 75, 'ü': 76, 'Ü': 76, 'û': 77, 'Û': 77, 'ß': 78 };
  const SML_EXTRA = { 'Ø': 47, 'é': 60, 'É': 60, 'è': 61, 'È': 61, 'ê': 62, 'à': 63, 'â': 64, 'ä': 65, 'ì': 66, 'î': 67, 'ï': 68, 'ç': 69, 'ò': 70, 'ô': 71, 'ö': 72, 'ù': 73, 'ü': 74, 'û': 75, 'ß': 76 };
  function glyphIndex(ch, extra) {
    if (ACC[ch] && !(ch in extra)) ch = ACC[ch];
    if (ch in extra) return extra[ch];
    let c = ch.charCodeAt(0); if (c >= 97 && c <= 122) c -= 32;
    return c >= 32 && c <= 90 ? c - 32 : 31;   // desconocido -> '?'
  }

  BRR.OrigMenu = class {
    constructor(files, hooks) {
      this.files = files; this.h = hooks; this.st = { mode: 'single', players: 1, team: hooks.team || 1, diff: hooks.diff || 2, rivals: hooks.rivals != null ? hooks.rivals : 5, track: null, veh: null, sel: 0 };
      this.cache = new Map(); this.t = 0; this.focus = -1; this.hidden = new Set(); this.screen = null; this.on = false;
    }
    async init() {
      const F = this.files, A = await F.archive('ALWAYS.WAP'), T = await F.archive('TOURN.WAP');
      this.wibs = [1, 2, 3, 4, 5].map(i => parseSPR(A.get('WIBS' + i + '.SPR')));
      this.sml = parseSPR(A.get('SML_ALPH.SPR')); this.always = parseSPR(A.get('ALWAYS.SPR'));
      this.coltab = A.get('COLTAB.DAT');
      const dos = b => b ? BRR.dosText(b) : '';
      this.str = Object.assign({}, parseText(dos(T.get('START.ENG'))), parseText(dos(T.get('TOURN.ENG'))), parseText(dos(T.get('START.SPA'))), parseText(dos(T.get('TOURN.SPA'))));
      // lienzo 320×200 escalado con píxeles nítidos
      const root = this.root = document.createElement('div'); root.id = 'origmenu'; root.hidden = true;
      root.innerHTML = '<canvas width="320" height="200"></canvas><div class="omhint">F2 / botón ☰: menú moderno · Opciones de gráficos en "Opciones → Pantalla"</div>';
      document.body.appendChild(root);
      this.cv = root.querySelector('canvas'); this.g = this.cv.getContext('2d'); this.img = this.g.createImageData(W, H);
      this.ov = document.createElement('canvas'); this.ov.width = W; this.ov.height = H; this.og = this.ov.getContext('2d'); this.oimg = this.og.createImageData(W, H);
      this.cv.addEventListener('mousemove', e => { const p = this.pt(e); const b = this.boxAt(p); this.focus = b ? this.boxes.indexOf(b) : -1; });
      this.cv.addEventListener('pointerdown', () => this.wake());
      this.cv.addEventListener('click', e => { const b = this.boxAt(this.pt(e)); if (b) this.press(b.id); });
      this.cv.addEventListener('contextmenu', e => { e.preventDefault(); this.back(); });
      addEventListener('keydown', e => this.key(e));
      this.padPrev = {};
    }
    pt(e) { const r = this.cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
    boxAt([x, y]) { return (this.boxes || []).find(b => b.w > 4 && x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h && !this.boxOff(b)); }
    boxOff(b) { return this.disabled && this.disabled.has(b.id); }
    async scene(name) {
      if (this.cache.has(name)) return this.cache.get(name);
      const A = await this.files.archive(name + '.SCN'), txt = BRR.text(A.get(name + '.TXT') || new Uint8Array());
      const S = parseScript(txt); S.A = A;
      if (S.raw && A.get(S.raw)) S.rawData = A.get(S.raw);
      S.sprites = S.spr ? parseSPR(A.get(S.spr)) : [];
      this.cache.set(name, S); return S;
    }
    // ---------- dibujo ----------
    setBg(raw) { this.bg = raw; this.pal = BRR.pal6(raw.subarray(0, 768)); }
    blit(buf, s, x, y, remap) {
      if (!s) return;
      for (let j = 0; j < s.h; j++) { const yy = y + j; if (yy < 0 || yy >= H) continue;
        for (let i = 0; i < s.w; i++) { const c = s.px[j * s.w + i]; if (!c) continue; const xx = x + i; if (xx < 0 || xx >= W) continue; buf[yy * W + xx] = remap ? remap(c) : c; } }
    }
    textWidth(str, font) {
      let w = 0; const big = font === 5;
      for (const ch of str) { if (ch === ' ') { w += big ? 9 : 5; continue; } const s = big ? this.wibs[0][glyphIndex(ch, WIBS_EXTRA)] : this.sml[glyphIndex(ch, SML_EXTRA)]; w += s ? (big ? s.w - 1 : (s.a || s.w)) : 6; }
      return w;
    }
    drawString(buf, str, x, y, font, level, wib, phase) {
      const big = font === 5, lh = big ? 22 : 10; let cx = x;
      const remap = this.coltab ? c => this.coltab[Math.min(15, Math.max(0, level)) * 256 + c] : null;
      let k = 0;
      for (const ch of str) {
        if (ch === '\n') { cx = x; y += lh; continue; }
        if (ch === ' ') { cx += big ? 9 : 5; continue; }
        if (big) {
          const fr = wib ? (Math.floor(this.t * 9 + k * 1.7 + phase) % 5 + 5) % 5 : 0, s = this.wibs[fr][glyphIndex(ch, WIBS_EXTRA)];
          if (s) { this.blit(buf, s, cx, y - 7, remap); cx += s.w - 1; }
        } else { const s = this.sml[glyphIndex(ch, SML_EXTRA)]; if (s) { this.blit(buf, s, cx, y, remap); cx += s.a || s.w; } }
        k++;
      }
    }
    drawBlock(buf, id, font, level, wib, override) {
      const ops = this.str[id]; if (!ops && override == null) return;
      let x = 10, y = 10, f = font, lv = level, w = wib, lines = 0;
      for (const o of ops || [{ t: '' }]) {
        if (o.X !== undefined) { x = o.X; y = o.Y; lines = 0; }
        else if (o.F !== undefined) f = o.F === 0 || o.F === 1 || o.F === 2 ? 1 : 5;
        else if (o.C !== undefined) lv = Math.max(lv, o.C);
        else if (o.Wb) w = true;
        else if (o.t !== undefined) { const s = (override != null ? override : o.t).replace(/\s*\\\s*/g, '\n'); this.drawString(buf, s, x, y + lines * (f === 5 ? 22 : 10), f, lv, w || f === 5, id.length); lines += 1 + (s.match(/\n/g) || []).length; if (override != null) break; }
      }
    }
    render() {
      const S = this.S; if (!S) return;
      const buf = this.fb || (this.fb = new Uint8Array(W * H)), ov = this.ovb || (this.ovb = new Uint8Array(W * H));
      if (this.bg) buf.set(this.bg.subarray(768, 768 + W * H)); else buf.fill(0);
      ov.fill(0);
      // sprites animados (5 fotogramas cada uno) y textos del guion
      for (const it of S.items) {
        if (this.hidden.has(it.g)) continue;
        if (it.type === 'spr') { const n = S.sprites.length, fr = it.first + (it.first + 5 <= n ? Math.floor(this.t * 7) % 5 : 0); this.blit(ov, S.sprites[fr] || S.sprites[it.first], it.x, it.y); }
        else {
          const bi = this.textBox(it), hot = bi >= 0 && bi === this.focus;
          this.drawBlock(ov, it.id, it.font === 5 ? 5 : 1, hot ? 15 : 4, true, this.texts && this.texts[it.id]);
        }
      }
      if (this.extra) this.extra(ov);
      // a color
      const P = this.pal || new Uint8Array(768), d = this.img.data, od = this.oimg.data;
      for (let i = 0; i < W * H; i++) { const c = buf[i], o = i * 4; d[o] = P[c * 3]; d[o + 1] = P[c * 3 + 1]; d[o + 2] = P[c * 3 + 2]; d[o + 3] = 255;
        const v = ov[i]; if (v) { od[o] = P[v * 3]; od[o + 1] = P[v * 3 + 1]; od[o + 2] = P[v * 3 + 2]; od[o + 3] = 255; } else od[o + 3] = 0; }
      this.g.putImageData(this.img, 0, 0);
      if (this.layer3d) this.layer3d(this.g);
      this.og.putImageData(this.oimg, 0, 0); this.g.drawImage(this.ov, 0, 0);
      // marco del elemento seleccionado (teclado/mando)
      const b = this.boxes && this.boxes[this.focus];
      if (b && this.kbFocus) { this.g.strokeStyle = `rgba(255,255,255,${0.45 + 0.35 * Math.sin(this.t * 8)})`; this.g.lineWidth = 1; this.g.strokeRect(b.x + .5, b.y + .5, b.w - 1, b.h - 1); }
    }
    textBox(it) { // la zona de ratón asociada a un texto (por posición)
      const ops = this.str[it.id]; if (!ops || !this.boxes) return -1; const p = ops.find(o => o.X !== undefined); if (!p) return -1;
      return this.boxes.findIndex(b => b.w > 4 && p.X >= b.x - 4 && p.X < b.x + b.w && p.Y + 6 >= b.y && p.Y < b.y + b.h);
    }
    loop() {
      if (!this.on) return; requestAnimationFrame(() => this.loop());
      const now = performance.now(); this.t += Math.min(0.1, (now - (this.lt || now)) / 1000); this.lt = now;
      this.pad(); this.render();
    }
    // ---------- entrada ----------
    // el navegador solo deja sonar el audio tras una pulsación: se activa (y arranca la música del menú) al primer toque
    wake() { const a = this.h.audio; if (!a) return; a.init(); if (a.ctx && a.ctx.state !== 'running') a.ctx.resume(); if (!a.music && this.on) a.playTrack(2); }
    key(e) {
      if (!this.on) return; this.wake();
      if (e.code === 'F2') { e.preventDefault(); this.h.modern(); return; }
      const sc = { Escape: 1, Enter: 0x1C, NumpadEnter: 0x1C, Space: 0x39, ArrowLeft: 0x4B, ArrowRight: 0x4D, ArrowUp: 0x48, ArrowDown: 0x50 }[e.code];
      if (e.code === 'Escape') { e.preventDefault(); this.back(); return; }
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') { e.preventDefault(); const b = this.boxes[this.focus]; if (b && this.kbFocus) this.press(b.id); else { const k = this.S.keys.find(k => k.sc === sc); if (k) this.press(k.id); } return; }
      if (e.code.startsWith('Arrow')) { e.preventDefault(); this.move(e.code.slice(5).toLowerCase()); return; }
      if (e.key && e.key.length === 1) { const k = this.S.keys.find(k => k.sc === LETTER_SC[e.key.toLowerCase()]); if (k) this.press(k.id); }
    }
    move(dir) {
      const bs = this.boxes.map((b, i) => ({ b, i })).filter(o => o.b.w > 4 && !this.boxOff(o.b));
      if (this.onArrow && this.onArrow(dir)) return;
      if (!this.kbFocus || this.focus < 0) { this.kbFocus = true; this.focus = bs.length ? bs[0].i : -1; return; }
      const c = this.boxes[this.focus], cx = c.x + c.w / 2, cy = c.y + c.h / 2, dx = { left: -1, right: 1 }[dir] || 0, dy = { up: -1, down: 1 }[dir] || 0;
      let best = null, bd = 1e9;
      for (const o of bs) { if (o.i === this.focus) continue; const ox = o.b.x + o.b.w / 2 - cx, oy = o.b.y + o.b.h / 2 - cy; if (ox * dx + oy * dy <= 2) continue; const d = Math.hypot(ox, oy) + Math.abs(ox * dy - oy * dx) * 1.5; if (d < bd) { bd = d; best = o.i; } }
      if (best != null) { this.focus = best; this.beep(); }
    }
    pad() {
      const gp = (navigator.getGamepads ? [...navigator.getGamepads()] : []).find(g => g && g.connected); if (!gp) return;
      const p = i => gp.buttons[i] && gp.buttons[i].pressed, ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      const cur = { a: p(0), b: p(1), up: p(12) || ay < -0.6, down: p(13) || ay > 0.6, left: p(14) || ax < -0.6, right: p(15) || ax > 0.6, menu: p(8) };
      const ed = k => cur[k] && !this.padPrev[k]; if (Object.keys(cur).some(ed)) this.wake();
      if (ed('up')) this.move('up'); if (ed('down')) this.move('down'); if (ed('left')) this.move('left'); if (ed('right')) this.move('right');
      if (ed('a')) { const b = this.boxes[this.focus]; if (b) this.press(b.id); else this.move('down'); }
      if (ed('b')) this.back(); if (ed('menu')) this.h.modern();
      this.padPrev = cur;
    }
    beep() { this.h.audio && this.h.audio.play('SAMPLES/BEEP3.WAV', { vol: 0.45 }); }
    press(id) { if (this.disabled && this.disabled.has(id)) return; this.h.audio && this.h.audio.play('SAMPLES/BEEP4.WAV', { vol: 0.6 }); this.onBox && this.onBox(id); }
    back() { this.h.audio && this.h.audio.play('SAMPLES/BEEP2.WAV', { vol: 0.6 }); const b = this.boxes && this.boxes.find(b => b.w <= 4); if (b) this.onBox && this.onBox(b.id); else if (this.onBack) this.onBack(); }
    // ---------- pantallas ----------
    async show(name, { bg, hide = [], onBox, onArrow, extra, layer3d, texts, disabled, onBack } = {}) {
      const S = await this.scene(name); this.S = S; this.screen = name;
      this.boxes = S.boxes; this.hidden = new Set(hide); this.onBox = onBox; this.onArrow = onArrow; this.extra = extra; this.layer3d = layer3d; this.texts = texts || null; this.disabled = disabled ? new Set(disabled) : null; this.onBack = onBack;
      if (bg) this.setBg(bg); else if (S.rawData) this.setBg(S.rawData);
      this.focus = -1; this.kbFocus = false;
    }
    async open() {
      this.on = true; this.root.hidden = false; this.loop();
      if (this.h.audio) { this.h.audio.init(); this.h.audio.playTrack(2); }
      await this.conf();
    }
    close() { this.on = false; this.root.hidden = true; }
    tracks() { return this.h.front().tracks; }
    // 1) configuración: carrera única / torneo / multijugador / cargar / opciones
    async conf() {
      await this.show('CONFSCN', { onBox: id => {
        if (id === 0) { this.st.mode = 'single'; this.st.players = 1; this.choose(); }
        else if (id === 1 || id === 3) { this.st.mode = 'tourn'; this.st.players = 1; this.choose(); }
        else if (id === 2) { this.st.mode = 'multi'; this.st.players = Math.max(2, this.st.players); this.choose(); }
        else if (id === 4) this.opt();
        else if (id === 10) this.bye();
      }, texts: { CONFIG_LOAD: 'Continuar torneo' } });
    }
    // 2) antes del globo: personaje, logotipo, teclas, daños/jugadores
    async choose() {
      await this.show('CHOOSCN', { hide: [3], onBox: id => {
        if (id === 0) this.conf(); else if (id === 1) this.globe(); else if (id === 3) this.chara(); else if (id === 4) this.logo(); else if (id === 5) this.keys(); else if (id === 6) this.game();
      } });
    }
    headLayer(x, y, w, h, team) {
      const url = this.h.front().heads && this.h.front().heads[team]; if (!url) return null;
      const im = new Image(); im.src = url; return g => { if (im.complete) g.drawImage(im, x, y, w, h); };
    }
    // logotipo de la escudería como imagen (para el menú moderno): panel del color + dibujo del logo, con la paleta de LOGOSCN
    async logoURL(logo, team) {
      const S = await this.scene('LOGOSCN'); if (!S.rawData || !S.sprites.length) return null;
      const pal = BRR.pal6(S.rawData.subarray(0, 768)), p = S.sprites[13 + (team - 1) * 5], l = S.sprites[logo]; if (!l) return null;
      const w = p ? p.w : l.w + 16, h = p ? p.h : l.h + 16, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d'), im = g.createImageData(w, h);
      const put = (sp, ox, oy) => { if (!sp) return; for (let j = 0; j < sp.h; j++) for (let i = 0; i < sp.w; i++) { const c = sp.px[j * sp.w + i]; if (!c) continue; const x = ox + i, y = oy + j; if (x < 0 || y < 0 || x >= w || y >= h) continue; const k = (y * w + x) * 4; im.data[k] = pal[c * 3]; im.data[k + 1] = pal[c * 3 + 1]; im.data[k + 2] = pal[c * 3 + 2]; im.data[k + 3] = 255; } };
      put(p, 0, 0); put(l, 8, 8); g.putImageData(im, 0, 0); return cv.toDataURL();
    }
    // logo i en RGBA 40×40 (transparente donde no hay dibujo), para pintarlo en los coches
    async logoRGBA(i) {
      const S = await this.scene('LOGOSCN'); const l = S.sprites[i]; if (!l || !S.rawData) return null; const pal = BRR.pal6(S.rawData.subarray(0, 768)), o = new Uint8ClampedArray(40 * 40 * 4);
      const ox = Math.floor((40 - l.w) / 2), oy = Math.floor((40 - l.h) / 2);
      for (let j = 0; j < l.h; j++) for (let x = 0; x < l.w; x++) { const c = l.px[j * l.w + x]; if (!c) continue; const X = x + ox, Y = j + oy; if (X < 0 || Y < 0 || X >= 40 || Y >= 40) continue; const k = (Y * 40 + X) * 4; o[k] = pal[c * 3]; o[k + 1] = pal[c * 3 + 1]; o[k + 2] = pal[c * 3 + 2]; o[k + 3] = 255; }
      return o;
    }
    async logo() {   // logotipo (13 dibujos) y color del equipo (6), con las flechas y los paneles de LOGOS.SPR
      const st = this.st; st.logo = st.logo || 0;
      const label = () => ({ LOGO_HED: 'EQUIPO ' + this.h.teamName(st.team).toUpperCase() });
      await this.show('LOGOSCN', { hide: [11, 12], texts: label(), onBox: id => {
        if (id === 0) st.logo = (st.logo + 12) % 13; else if (id === 1) st.logo = (st.logo + 1) % 13;
        else if (id === 99) { st.team = st.team % 6 + 1; this.texts = label(); }
        else this.choose();
      }, onArrow: d => { if (d === 'left' || d === 'right') { this.press(d === 'left' ? 0 : 1); return true; } if (d === 'up' || d === 'down') { this.press(99); return true; } },
        extra: buf => { const S = this.S.sprites, f = Math.floor(this.t * 7) % 5;
          this.blit(buf, S[13 + (st.team - 1) * 5 + f], 131, 52); this.blit(buf, S[st.logo], 139, 60);
          this.blit(buf, S[48 + f], 92, 66); this.blit(buf, S[43 + f], 192, 66);
          this.drawString(buf, 'ARRIBA/ABAJO O CLIC EN EL PANEL: COLOR', 40, 128, 1, 10, false, 0); } });
      this.boxes = [...this.S.boxes, { id: 99, x: 131, y: 52, w: 58, h: 58 }];
    }
    async chara() {   // piloto: 6 personajes con el color del equipo y ropa limpia/sucia, girando en 3D
      const st = this.st; st.char = st.char || 0; st.dirty = !!st.dirty; let th = null, ang = 0;
      const load = async () => { th = null; try { th = await this.h.charThumb(st.char, st.team, st.dirty); } catch (e) { console.error(e); } };
      await this.show('CHARSCN', { hide: [11, 12], onBox: id => {
        if (id === 0) { st.team = st.team % 6 + 1; load(); } else if (id === 1) { st.char = (st.char + 1) % 6; load(); } else if (id === 3 || id === 5) { st.dirty = !st.dirty; load(); }
        else this.choose();
      }, layer3d: g => { if (th) g.drawImage(th.frame(ang += 0.025), 70, 8, 190, 190); } });
      load();
    }
    async keys() {   // teclas: se muestran los controles actuales
      await this.show('CHOOSCN', { hide: [1, 2, 3], onBox: () => this.choose(), onBack: () => this.choose(),
        extra: buf => { const lines = ['TECLADO: FLECHAS O WASD', 'ESPACIO  FRENO DE MANO', 'MAYUS  NITRO   R  RECOLOCAR', 'C  CAMARA   ESC  PAUSA', '', 'MANDO: RT ACELERA  LT FRENA', 'B FRENO DE MANO  LB NITRO', 'Y RECOLOCAR', '', 'J2: FLECHAS  CTRL DCHA  INTRO']; lines.forEach((l, i) => this.drawString(buf, l, 22, 30 + i * 13, 1, 12, false, 0)); } });
      this.boxes = [{ id: 1, x: 250, y: 155, w: 60, h: 45 }, { id: 0, x: 0, y: 0, w: 2, h: 2 }];
    }
    async game() {   // rivales (0-11) · jugadores en pantalla partida (1-4) · dificultad (casilla)
      const DN = ['', 'FACIL', 'NORMAL', 'DIFICIL', 'MUY DIFICIL'], st = this.st; if (st.rivals == null) st.rivals = 5;
      const upd = () => { this.texts = { GAME_DAM: 'RIVALES: ' + st.rivals, GAME_PL1: 'JUGADORES: ' + st.players, GAME_PL2: ' ' }; };
      await this.show('GAMESCN', { hide: [2, 3], onBox: id => {
        if (id === 0) st.rivals = Math.max(0, st.rivals - 1); else if (id === 2) st.rivals = Math.min(12 - st.players, st.rivals + 1);
        else if (id === 3) st.players = Math.max(1, st.players - 1); else if (id === 5) { st.players = Math.min(4, st.players + 1); st.rivals = Math.min(st.rivals, 12 - st.players); }
        else if (id === 7) st.diff = st.diff % 4 + 1;
        else if (id === 10 || id === 20) { st.mode = st.players > 1 ? 'multi' : st.mode === 'multi' ? 'single' : st.mode; return this.choose(); }
        upd();
      }, extra: buf => { this.drawString(buf, 'DIFICULTAD: ' + DN[st.diff], 20, 150, 5, 8, true, 3);
        const bar = (v, max, y) => { for (let x = 0; x < Math.round(96 * v / max); x++) for (let j = 0; j < 17; j++) buf[(y + j) * 320 + 112 + x] = 18; }; bar(st.rivals, 11, 74); bar(st.players, 4, 117); } });
      this.boxes = [...this.S.boxes.filter(b => b.id !== 7), { id: 7, x: 10, y: 140, w: 230, h: 28 }];
      upd();
    }
    // 3) globo: elegir circuito (en el torneo, el siguiente de la serie)
    async globe() {
      const T = this.tracks(), tour = this.st.mode === 'tourn' && this.h.tournNext, F = this.h.front();
      const list = tour ? [this.h.tournNext()].filter(Boolean) : T;
      if (!list.length) return this.conf();
      let i = Math.max(0, list.findIndex(t => t.id === (this.st.track || this.h.level())));
      const gcv = document.createElement('canvas'); gcv.width = gcv.height = 150;
      const globe = F.world ? new BRR.Globe(gcv, F.world) : null, views = new Map();
      if (globe) globe.marks = T.filter(t => !(t.planet > 0)).map(t => ({ id: t.id, lon: t.lon, lat: t.lat, name: '' }));
      const view = t => { if (!views.has(t.id)) { views.set(t.id, null); this.files.archive(t.id + '.LEV').then(A => { const u = BRR.rawToURL(A.get('VIEW.RAW')); if (u) { const im = new Image(); im.src = u; views.set(t.id, im); } }); } return views.get(t.id); };
      const sel = () => { const t = list[i]; this.st.track = t.id;
        if (globe) { const pl = t.planet > 0 && F.planets && F.planets[t.planet]; globe.map = pl || F.world; globe.noMarks = !!pl;
          if (pl) { globe.sel = null; globe.focus(globe.lon + 60, 15); } else { globe.sel = globe.marks.find(m => m.id === t.id); globe.focus(t.lon, t.lat); } }
        const place = (t.place || t.id).toUpperCase(); this.texts = { GLB_SINGLE: tour ? 'SIGUIENTE CARRERA' : 'ELIGE CIRCUITO', GLB_CHOSEN: ' ', GLB_SELECT: ' ' }; this.place = place + ' (' + t.id + ')';
        this.h.narrate && this.h.narrate(t); };
      await this.show('GLOBESCN', { hide: [4, 5, 6, 7, 8, 10, 11, 13], onBox: id => {
        if (id === 2) { i = (i + list.length - 1) % list.length; sel(); } else if (id === 3) { i = (i + 1) % list.length; sel(); }
        else if (id === 0 || id === 4) this.trak(list[i]); else if (id === 1) this.choose();
      }, onArrow: d => { if (d === 'left' || d === 'right') { this.press(d === 'left' ? 2 : 3); return true; } },
        extra: buf => { this.drawString(buf, this.place || '', 172, 128, 1, 15, false, 0); this.drawString(buf, (i + 1) + ' / ' + list.length, 172, 140, 1, 10, false, 0); },
        layer3d: g => {
          if (globe) { globe.drawn = false; globe.frame(1 / 60); g.drawImage(gcv, 12, 14, 150, 150); }
          else { g.fillStyle = '#fff'; g.font = '10px system-ui'; g.fillText('No se pudo dibujar el globo', 20, 90); }
          const im = view(list[i]); g.fillStyle = '#000'; g.fillRect(170, 32, 144, 92); if (im && im.complete) g.drawImage(im, 172, 34, 140, 88);
          g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(170.5, 32.5, 143, 91); g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(168, 124, 148, 28);
        } });
      sel();
    }
    // 4) circuito: imagen y descripción; vehículo / ver / carrera
    async trak(t) {
      const A = await this.files.archive(t.id + '.LEV'), view = A.get('VIEW.RAW');
      const cars = t.cars && t.cars.length ? t.cars : ['JEEP']; if (!cars.includes(this.st.veh)) this.st.veh = cars[0];
      await this.show('TRAKSCN', { bg: view, hide: this.st.players > 1 ? [3] : [3], onBox: id => {
        if (id === 0) this.globe(); else if (id === 1) this.car(t, cars); else if (id === 2) { this.h.narrate && this.h.narrate(t); } else if (id === 3) this.go(t);
      }, extra: buf => { this.drawBlock(buf, t.vie, 1, 15, false); } });
    }
    async car(t, cars) {
      let k = Math.max(0, cars.indexOf(this.st.veh)), thumb = null, ang = 0, busy = false;
      const shot = async () => { busy = true; try { thumb = await this.h.carThumb(cars[k], this.st.team, t.id); } catch (e) { thumb = null; } busy = false; };
      await this.show('CARSCN', { bg: this.bg ? this.bg : null, hide: [11, 12], texts: { CAR_HED: 'ELIGE TU VEHICULO', CAR_NXT: this.h.vehName(cars[k]).toUpperCase() },
        onBox: id => { if (id === 0) { k = (k + 1) % cars.length; this.st.veh = cars[k]; this.texts = { CAR_HED: 'ELIGE TU VEHICULO', CAR_NXT: this.h.vehName(cars[k]).toUpperCase() }; shot(); } else this.trak(t); },
        layer3d: g => { if (thumb) { g.save(); g.fillStyle = '#0008'; g.fillRect(60, 40, 200, 110); g.drawImage(thumb.frame(ang += 0.02), 95, 30, 130, 130);   /* imagen cuadrada: sin estirar */ g.restore(); } } });
      this.st.veh = cars[k]; shot();
    }
    go(t) { this.close(); const pl = this.st.mode === 'multi' ? Math.max(2, this.st.players) : 1; this.h.start({ level: t.id, veh: this.st.veh, team: this.st.team, players: pl, diff: this.st.diff, rivals: this.st.mode === 'tourn' ? 5 : Math.min(12 - pl, this.st.rivals == null ? 5 : this.st.rivals), tourn: this.st.mode === 'tourn' }); }
    async opt() {
      await this.show('OPTSCN', { onBox: id => {
        if (id === 0 || id === 1) this.keys(); else if (id === 2) this.h.options(); else if (id === 3) this.sound(); else if (id === 4) this.game(); else if (id === 10) this.conf();
      }, texts: { OPT_DISP: 'Pantalla y graficos' } });
    }
    async sound() {
      const v = this.h.vol(), step = (k, d) => { v[k] = Math.max(0, Math.min(100, v[k] + d)); this.h.setVol(v); };
      await this.show('SOUNDSCN', { onBox: id => {
        if (id === 0) step('vmusic', -10); else if (id === 1) step('vmusic', 10); else if (id === 2) step('vsfx', -10); else if (id === 3) step('vsfx', 10);
        else if (id >= 10 && id <= 17) { v.vmusic = (id - 10 + 1) * 12.5; this.h.setVol(v); } else if (id >= 20 && id <= 27) { v.vsfx = (id - 20 + 1) * 12.5; this.h.setVol(v); }
        else if (id === 28) { v.vvoice = v.vvoice > 0 ? 0 : 100; this.h.setVol(v); } else if (id === 4) this.opt();
      }, extra: buf => { this.drawString(buf, 'MUSICA ' + Math.round(v.vmusic) + '%', 140, 82, 1, 12, false, 0); this.drawString(buf, 'EFECTOS ' + Math.round(v.vsfx) + '%', 140, 125, 1, 12, false, 0); this.drawString(buf, 'COMENTARISTA: ' + (v.vvoice > 0 ? 'SI' : 'NO'), 24, 172, 1, 12, false, 0); } });
    }
    async results(rows, title, msg, next) {   // tras la carrera
      await this.show('RESULSCN', { hide: [2, 3, 5, 6, 7, 8, 9, 10, 20, 30], texts: { RES_RESULT: title }, onBox: () => next(),
        onBack: () => next(),
        extra: buf => { rows.forEach((r, i) => this.drawString(buf, r, 20, 52 + i * 14, 1, i === 0 ? 15 : 10, false, 0)); if (msg) this.drawString(buf, msg, 20, 52 + rows.length * 14 + 8, 1, 14, false, 0); } });
      this.boxes = [{ id: 1, x: 260, y: 155, w: 55, h: 45 }, { id: 9, x: 0, y: 0, w: 2, h: 2 }];
      if (!this.on) { this.on = true; this.root.hidden = false; this.loop(); }
    }
    async bye() { await this.show('BYESCN', { onBox: () => this.conf() }); }
  };
  const LETTER_SC = { '1': 2, '2': 3, '3': 4, '4': 5, '5': 6, q: 0x10, w: 0x11, e: 0x12, r: 0x13, t: 0x14, y: 0x15, u: 0x16, i: 0x17, o: 0x18, p: 0x19, a: 0x1e, s: 0x1f, d: 0x20, f: 0x21, g: 0x22, h: 0x23, j: 0x24, k: 0x25, l: 0x26, z: 0x2c, x: 0x2d, c: 0x2e, v: 0x2f, b: 0x30, n: 0x31, m: 0x32 };
})();
