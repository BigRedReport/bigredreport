// Big Red Racing: lectura de datos originales (contenedores LZSS, paletas, texturas)
"use strict";
const BRR = window.BRR = window.BRR || {};

BRR.lzss = function (src, outLen, pb) {
  const N = 1 << (8 + pb), M = N - 1, mask = (1 << pb) - 1;
  const buf = new Uint8Array(N), out = new Uint8Array(outLen);
  let r = 1, o = 0, i = 0;
  while (o < outLen && i < src.length) {
    const f = src[i++];
    for (let bit = 0; bit < 8; bit++) {
      if (o >= outLen || i >= src.length) break;
      if ((f >> bit) & 1) { const c = src[i++]; out[o++] = c; buf[r] = c; r = (r + 1) & M; }
      else {
        const a = src[i], b = src[i + 1]; i += 2;
        const pos = a | ((b & mask) << 8), len = (b >> pb) + 2;
        for (let k = 0; k < len; k++) { const c = buf[(pos + k) & M]; if (o < outLen) out[o++] = c; buf[r] = c; r = (r + 1) & M; }
      }
    }
  }
  return out;
};

// método 1: RLE (control>=128 -> repetir el siguiente byte control-125 veces; si no, copiar control+1 bytes)
BRR.rle = function (src, outLen) {
  const out = new Uint8Array(outLen); let o = 0, i = 0;
  while (i < src.length && o < outLen) {
    const c = src[i++];
    if (c >= 128) { const v = src[i++]; for (let k = 0; k < c - 125 && o < outLen; k++) out[o++] = v; }
    else for (let k = 0; k <= c && o < outLen; k++) out[o++] = src[i++];
  }
  return out;
};

// Devuelve Map NOMBRE -> Uint8Array
BRR.readArchive = function (bytes) {
  const d = bytes, dv = new DataView(d.buffer, d.byteOffset, d.byteLength), out = new Map();
  let p = 0;
  while (p < d.length) {
    let z = p; while (z < d.length && d[z] !== 0) z++;
    if (z === p || z + 9 > d.length) break;
    const name = String.fromCharCode(...d.subarray(p, z)).toUpperCase(); p = z + 1;
    const csize = dv.getUint32(p, true), usize = dv.getUint32(p + 4, true); p += 8;
    const method = d[p], blob = d.subarray(p + 1, p + 1 + csize); p += 1 + csize;
    out.set(name, method === 0 ? blob.slice(0, usize) : method === 1 ? BRR.rle(blob, usize) : BRR.lzss(blob, usize, 6 - method));
  }
  return out;
};

BRR.text = b => new TextDecoder('latin1').decode(b);

// Fuente de archivos: Map NOMBRE_MAYUS -> File (carpeta BIGRED del usuario)
BRR.Files = class {
  constructor(fileList) {
    this.files = new Map(); this.paths = new Map();
    for (const f of fileList) {
      const rel = (f.webkitRelativePath || f.name).replace(/\\/g, '/').toUpperCase();
      const parts = rel.split('/'); const name = parts[parts.length - 1];
      // ruta relativa a BIGRED (p. ej. "GEN/BANG1.WAV"); si la carpeta tiene otro nombre, relativa a la raíz elegida
      const bi = parts.lastIndexOf('BIGRED');
      this.paths.set((bi >= 0 ? parts.slice(bi + 1) : parts.slice(1)).join('/'), f);
      // preferimos los de la carpeta BIGRED, sin subcarpetas
      const depthOk = parts.length <= 2 || parts[parts.length - 2] === 'BIGRED';
      if (!this.files.has(name) || depthOk) this.files.set(name, f);
    }
    this.cache = new Map();
  }
  // mods: capas de archivos que sustituyen a los del juego (ver LEEME). mods = [{ files: [{ rel, blob }] }] en orden (el último gana)
  setMods(mods) {
    this.modName = new Map(); this.modPath = new Map(); this.modArc = new Map(); this.cache = new Map();
    for (const m of mods || []) for (const { rel, blob } of m.files || []) {
      const parts = rel.replace(/\\/g, '/').toUpperCase().split('/').filter(Boolean); if (!parts.length) continue;
      const name = parts[parts.length - 1], dir = parts.length > 1 ? parts[parts.length - 2] : null;
      if (dir && /\.(LEV|VHC|WAP|SCN)$/.test(dir)) { if (!this.modArc.has(dir)) this.modArc.set(dir, new Map()); this.modArc.get(dir).set(name, blob); continue; }
      this.modName.set(name, blob); this.modPath.set(parts.join('/'), blob); if (dir) this.modPath.set(dir + '/' + name, blob);
    }
  }
  has(n) { n = n.toUpperCase(); return this.files.has(n) || !!(this.modName && this.modName.has(n)); }
  path(rel) { rel = rel.toUpperCase(); return (this.modPath && this.modPath.get(rel)) || this.paths.get(rel) || null; }
  listDir(dir) { dir = dir.toUpperCase() + '/'; return [...this.paths.keys()].filter(k => k.startsWith(dir) && !k.slice(dir.length).includes('/')).map(k => k.slice(dir.length)); }
  list(ext) { return [...this.files.keys()].filter(n => n.endsWith(ext)).sort(); }
  async bytes(n) { n = n.toUpperCase(); const f = (this.modName && this.modName.get(n)) || this.files.get(n); if (!f) throw new Error('Falta ' + n); return new Uint8Array(await f.arrayBuffer()); }
  async archive(n) {
    n = n.toUpperCase();
    if (!this.cache.has(n)) this.cache.set(n, this.bytes(n).then(BRR.readArchive).then(A => this.applyMods(n, A)));
    return this.cache.get(n);
  }
  async applyMods(n, A) {
    if (!this.modName || (!this.modName.size && !this.modArc.size)) return A;
    const out = new Map(A);
    for (const k of A.keys()) { const b = this.modName.get(k); if (b && k !== n) out.set(k, new Uint8Array(await b.arrayBuffer())); }
    const add = this.modArc.get(n); if (add) for (const [k, b] of add) out.set(k, new Uint8Array(await b.arrayBuffer()));
    return out;
  }
};

// Paleta VGA 6 bits -> Uint8Array(256*3)
BRR.pal6 = p => { const o = new Uint8Array(768); for (let i = 0; i < 768; i++) o[i] = Math.min(255, ((p[i] & 63) * 255 / 63) | 0); return o; };

// Textura .TM (256x192 indexada) -> RGBA; índice 0 transparente
BRR.tmRGBA = function (tm, pal, opaque) {
  const o = new Uint8Array(256 * 192 * 4);
  for (let i = 0; i < 256 * 192; i++) {
    const c = tm[i]; o[i * 4] = pal[c * 3]; o[i * 4 + 1] = pal[c * 3 + 1]; o[i * 4 + 2] = pal[c * 3 + 2];
    o[i * 4 + 3] = (c === 0 && !opaque) ? 0 : 255;
  }
  return o;
};
