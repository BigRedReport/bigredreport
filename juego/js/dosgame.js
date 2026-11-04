// "Juego original (1995)": el RACING.EXE de verdad, dentro de DOSBox (js-dos), con los archivos del propio jugador.
//  - la carpeta BIGRED del jugador se mete en una unidad C: que se guarda en el navegador (así se guardan sus pilotos y récords)
//  - si tiene la imagen del CD (IMAGE.cue + IMAGE.img), se copian los archivos de datos del CD (sonidos de los motores…)
//  - sin CD: los sonidos que faltan se sustituyen por silencio para que las carreras no se cuelguen
//  - extras: filtro de imagen (píxeles / suave / CRT), mando → teclado, controles táctiles, F2 o ✕ para volver al juego moderno
"use strict";
(function () {
  const BRR = window.BRR;
  const T = s => (BRR.tr ? BRR.tr(s) : s);
  // ---------- zip sin compresión (lo que js-dos sabe abrir) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function makeZip(entries) {   // entries: [{ name, data: Uint8Array }]
    { const dirs = new Set(); for (const e of entries) { const p = e.name.split('/'); for (let i = 1; i < p.length; i++) dirs.add(p.slice(0, i).join('/') + '/'); }   // las carpetas van primero (el extractor de js-dos no las crea solo)
      entries = [...[...dirs].sort().map(d => ({ name: d, data: new Uint8Array(0) })), ...entries]; }
    const parts = [], central = []; let off = 0;
    for (const e of entries) {
      const nm = new TextEncoder().encode(e.name), crc = crc32(e.data), n = e.data.length;
      const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 10, true); h.setUint32(14, crc, true); h.setUint32(18, n, true); h.setUint32(22, n, true); h.setUint16(26, nm.length, true);
      parts.push(new Uint8Array(h.buffer), nm, e.data);
      const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 10, true); c.setUint32(16, crc, true); c.setUint32(20, n, true); c.setUint32(24, n, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + n;
    }
    const cs = central.reduce((a, b) => a + b.length, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, cs, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }
  // ---------- la pista de datos del CD (ISO 9660 dentro de la imagen .img/.bin) ----------
  async function cdFiles(cueText, img) {
    const m = /TRACK\s+0*1\s+(MODE1|MODE2)\/(2352|2048|2336)/i.exec(cueText); if (!m) return [];
    const ss = +m[2], uoff = ss === 2048 ? 0 : ss === 2336 ? 8 : m[1].toUpperCase() === 'MODE1' ? 16 : 24;
    const read = async (lba, bytes) => { const n = Math.ceil(bytes / 2048), raw = new Uint8Array(await img.slice(lba * ss, (lba + n) * ss).arrayBuffer()), out = new Uint8Array(n * 2048);
      for (let i = 0; i < n; i++) out.set(raw.subarray(i * ss + uoff, i * ss + uoff + 2048), i * 2048); return out.subarray(0, bytes); };
    const pvd = await read(16, 2048); if (String.fromCharCode(...pvd.subarray(1, 6)) !== 'CD001') return [];
    const dv = new DataView(pvd.buffer, pvd.byteOffset), out = [], seen = new Set();
    const walk = async (lba, size, path, depth) => { if (depth > 8 || seen.has(lba)) return; seen.add(lba);
      const d = await read(lba, size), v = new DataView(d.buffer, d.byteOffset);
      for (let p = 0; p < d.length;) { const len = d[p]; if (!len) { p = (Math.floor(p / 2048) + 1) * 2048; continue; }
        const ext = v.getUint32(p + 2, true), sz = v.getUint32(p + 10, true), fl = d[p + 25], nl = d[p + 32], raw = d.subarray(p + 33, p + 33 + nl);
        if (!(nl === 1 && raw[0] < 2)) { const name = String.fromCharCode(...raw).replace(/;\d+$/, '').replace(/\.$/, '').toUpperCase();
          if (fl & 2) await walk(ext, sz, path + name + '/', depth + 1); else out.push({ path: path + name, lba: ext, size: sz }); }
        p += len; } };
    await walk(dv.getUint32(156 + 2, true), dv.getUint32(156 + 10, true), '', 0);
    return out.map(f => ({ path: f.path, size: f.size, get: () => read(f.lba, f.size) }));
  }
  function silentWav() { const n = 2205, b = new DataView(new ArrayBuffer(44 + n)), s = (o, t) => { for (let i = 0; i < t.length; i++) b.setUint8(o + i, t.charCodeAt(i)); };
    s(0, 'RIFF'); b.setUint32(4, 36 + n, true); s(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true); b.setUint32(24, 11025, true); b.setUint32(28, 11025, true); b.setUint16(32, 1, true); b.setUint16(34, 8, true); s(36, 'data'); b.setUint32(40, n, true);
    for (let i = 0; i < n; i++) b.setUint8(44 + i, 128); return new Uint8Array(b.buffer); }
  // ---------- carga del emulador ----------
  let scriptP = null;
  const addScript = src => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error(src)); document.head.appendChild(s); });
  const loadScript = () => scriptP || (scriptP = Promise.all([addScript('js/dos/js-dos.js'), addScript('js/dos/dosbin.js')]).catch(e => { scriptP = null; throw e; }));
  // js-dos descarga DOSBox y el zip con XMLHttpRequest, que no funciona desde file:// (app de escritorio): se los damos ya cargados
  const SERVE = new Map();
  function xhrShim() { const Real = window.XMLHttpRequest; if (Real.brrShim) return;
    class X extends Real {
      open(m, u, ...r) { const d = SERVE.get(String(u).replace(/^.*\/(?=wdosbox)/, '')); if (d) { this._brr = d; return; } return super.open(m, u, ...r); }
      overrideMimeType(t) { if (!this._brr) super.overrideMimeType(t); } setRequestHeader(a, b) { if (!this._brr) super.setRequestHeader(a, b); }
      send(b) { if (!this._brr) return super.send(b); const d = this._brr, self = this;
        setTimeout(() => { const bin = typeof d !== 'string', resp = bin ? (self.responseType === 'arraybuffer' ? d : d) : d, n = bin ? d.byteLength : d.length;
          for (const [k, v] of [['readyState', 4], ['status', 200], ['response', resp], ['responseText', bin ? '' : d]]) Object.defineProperty(self, k, { value: v, configurable: true });
          try { self.dispatchEvent(new ProgressEvent('progress', { lengthComputable: true, total: n, loaded: n })); } catch (e) { }
          if (self.onreadystatechange) self.onreadystatechange(); try { self.dispatchEvent(new Event('load')); } catch (e) { } }, 0); } }
    X.brrShim = true; window.XMLHttpRequest = X; }
  function serveDos() { if (SERVE.has('wdosbox.js')) return; const b = atob(BRR.DOSBIN.wasm), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    SERVE.set('wdosbox.js', BRR.DOSBIN.js); SERVE.set('wdosbox.wasm.js', u.buffer); }
  const KEY = { up: 38, down: 40, left: 37, right: 39, enter: 13, esc: 27, ctrl: 17, alt: 18, space: 32, y: 89, n: 78, plus: 107, minus: 109 };
  BRR.DosGame = { _zip: makeZip,
    on: false,
    // files: BRR.Files del jugador; o: { filter, setFilter(v), onExit() }
    async open(files, o = {}) {
      if (this.on) return; this.on = true; this.o = o;
      const root = document.createElement('div'); root.id = 'dosgame'; this.root = root;
      root.innerHTML = `<div class="dg_bar"><span class="dg_t">Big Red Racing · 1995</span><select class="dg_f"><option value="pixel">${T('Píxeles nítidos')}</option><option value="suave">${T('Suavizado')}</option><option value="crt">${T('Pantalla CRT')}</option></select><button class="dg_fs">⛶</button><button class="dg_x">✕ F2</button></div>
        <div class="dg_scr"><canvas class="dg_cv"></canvas></div><div class="dg_msg"></div>
        <div class="dg_help">${T('Flechas: conducir y moverse por los menús · Intro: aceptar · Esc: atrás · Ctrl / Alt: acciones del vehículo · + / −: resolución del juego (320×200 o 640×480) · F2: volver al juego moderno')}</div>
        <div class="dg_touch"><div class="dg_pad"><b data-k="up">▲</b><b data-k="left">◀</b><b data-k="right">▶</b><b data-k="down">▼</b></div><div class="dg_btns"><b data-k="enter">OK</b><b data-k="esc">Esc</b><b data-k="ctrl">Ctrl</b><b data-k="alt">Alt</b></div></div>`;
      document.body.appendChild(root);
      const msg = t => { root.querySelector('.dg_msg').textContent = t || ''; }, cv = root.querySelector('.dg_cv'), scr = root.querySelector('.dg_scr');
      const sel = root.querySelector('.dg_f'); sel.value = o.filter || 'pixel'; const applyF = () => { scr.className = 'dg_scr f_' + sel.value; }; applyF();
      sel.onchange = () => { applyF(); if (o.setFilter) o.setFilter(sel.value); cv.focus(); };
      root.querySelector('.dg_x').onclick = () => this.close();
      root.querySelector('.dg_fs').onclick = () => { try { document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen(); } catch (e) { } };
      root.querySelector('.dg_touch').hidden = !('ontouchstart' in window || navigator.maxTouchPoints > 0);
      this.onKey = e => { if (e.code === 'F2') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); } };
      addEventListener('keydown', this.onKey, true);
      const fit = () => { const W = innerWidth, H = innerHeight - 40, w = Math.min(W, H * 4 / 3); scr.style.width = w + 'px'; scr.style.height = w * 3 / 4 + 'px'; };
      fit(); this.onResize = fit; addEventListener('resize', fit);
      try {
        msg(T('Preparando tu copia del juego…'));
        await loadScript();
        // los archivos de la carpeta BIGRED (sin la imagen del CD)
        const ent = [], have = new Set();
        for (const [rel, f] of files.paths) { if (!rel || /\.(IMG|CUE|BIN|ISO|CCD|SUB|MDF|MDS|NRG|OGG|MP3)$/.test(rel) || f.size > 64e6) continue; ent.push({ name: 'BIGRED/' + rel, f }); have.add(rel); }
        if (!have.has('RACING.EXE')) throw new Error(T('No encuentro RACING.EXE en tu carpeta BIGRED.'));
        // los datos del CD
        let cd = false; const cueName = files.list('.CUE')[0];
        if (cueName) { try { const cueF = files.files.get(cueName.toUpperCase()), cueText = await cueF.text(), img = files.files.get((/FILE\s+"([^"]+)"/i.exec(cueText) || [])[1]?.toUpperCase()) || files.files.get('IMAGE.IMG');
          if (img) { msg(T('Leyendo el CD del juego…')); const L = await cdFiles(cueText, img); for (const x of L) if (!have.has(x.path) && x.size < 64e6) { ent.push({ name: 'BIGRED/' + x.path, cd: x }); have.add(x.path); } cd = L.length > 0; } } catch (e) { console.warn('CD', e); } }
        { const sil = silentWav();   // lo que falte (sin CD, o un CD distinto): silencio, para que la carrera no se cuelgue
           for (const rel of have) { const m = /^([A-Z0-9_]+)\.VHC$/.exec(rel); if (!m) continue; const p = m[1] + '/' + m[1].slice(0, 4).toLowerCase() + '_eng.WAV'; if (!have.has(p.toUpperCase()) && !have.has(p)) ent.push({ name: 'BIGRED/' + p, data: sil }); } }
        for (const e of ent) if (!e.data) e.data = e.cd ? await e.cd.get() : new Uint8Array(await e.f.arrayBuffer());
        const zip = makeZip(ent), url = 'brrgame.zip'; serveDos(); xhrShim(); SERVE.set(url, await zip.arrayBuffer());
        msg(T('Arrancando DOS…'));
        const mount = cd ? 'BRRCD' : 'BRR';   // unidad guardada en el navegador (con o sin los datos del CD)
        const dos = Dos(cv, { wdosboxUrl: 'js/dos/wdosbox.js', cycles: 'max', autolock: false, log: m => { const L = this.LOG || (this.LOG = []); L.push(String(m)); if (L.length > 60) L.shift(); } });
        this.dosP = dos;
        await new Promise((ok, ko) => { dos.ready((fs, main) => { this.fs = fs; fs.extract(url, '/' + mount).then(() => main(['-c', 'cd ' + mount + '\\BIGRED', '-c', 'RACING.EXE']).then(ci => { this.ci = ci; ok(); })).catch(ko); }); dos.catch && dos.catch(ko); });
        SERVE.delete(url);
        if (!this.on) { try { this.ci.exit(); } catch (e) { } return; }
        msg(cd ? '' : T('Sin la imagen del CD: no hay música ni sonidos de motor. Elige la carpeta que contiene BIGRED e IMAGE.img para tenerlos.'));
        if (!cd) setTimeout(() => msg(''), 9000);
        cv.focus(); this.padLoop(); this.touch();
      } catch (e) { console.error(e); msg(T('No se ha podido arrancar el juego original:') + ' ' + (e.message || e)); }
    },
    key(k, down) { const c = KEY[k]; if (c && this.ci) try { this.ci.simulateKeyEvent(c, down); } catch (e) { } },
    // mando → teclas: cruceta/stick = flechas, A = Intro, B = Esc, X = Ctrl, Y = Alt, RT = acelerar (▲), LT = frenar (▼), Start = Esc
    padLoop() { const st = {}; const set = (k, v) => { if (!!st[k] !== v) { st[k] = v; this.key(k, v); } };
      const loop = () => { if (!this.on) { for (const k in st) if (st[k]) this.key(k, false); return; } const gp = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(g => g);
        if (gp) { const b = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4)), ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
          set('left', b(14) || ax < -0.45); set('right', b(15) || ax > 0.45); set('up', b(12) || ay < -0.6 || b(7)); set('down', b(13) || ay > 0.6 || b(6));
          set('enter', b(0)); set('esc', b(1) || b(9)); set('ctrl', b(2) || b(5)); set('alt', b(3) || b(4)); }
        this.raf = requestAnimationFrame(loop); }; loop(); },
    touch() { for (const b of this.root.querySelectorAll('.dg_touch b')) { const k = b.dataset.k;
      b.onpointerdown = e => { e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); b.classList.add('on'); this.key(k, true); };
      b.onpointerup = b.onpointercancel = () => { b.classList.remove('on'); this.key(k, false); }; } },
    close() {
      if (!this.on) return; this.on = false; cancelAnimationFrame(this.raf);
      removeEventListener('keydown', this.onKey, true); removeEventListener('resize', this.onResize);
      try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { }
      try { if (this.ci) this.ci.exit(); } catch (e) { }
      this.ci = null; if (this.root) this.root.remove(); this.root = null;
      if (this.o && this.o.onExit) this.o.onExit();
    },
  };
})();
