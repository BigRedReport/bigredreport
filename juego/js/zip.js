// Leer el juego desde un .zip (para móviles, donde no se puede elegir una carpeta): sin librerías, con DecompressionStream
"use strict";
(function () {
  const BRR = window.BRR = window.BRR || {};
  const u16 = (d, o) => d.getUint16(o, true), u32 = (d, o) => d.getUint32(o, true);
  async function view(blob, a, b) { return new DataView(await blob.slice(a, b).arrayBuffer()); }
  // descompresor «deflate» en JS, para navegadores sin DecompressionStream('deflate-raw') (Chrome/WebView anteriores a la 103, p. ej. algunas consolas Android)
  function jsInflate(src) {
    let pos = 0, bit = 0, out = new Uint8Array(Math.max(1024, src.length * 4)), op = 0;
    const need = n => { if (op + n > out.length) { let L = out.length * 2; while (L < op + n) L *= 2; const o = new Uint8Array(L); o.set(out.subarray(0, op)); out = o; } };
    const bits = n => { let v = 0; for (let i = 0; i < n; i++) { if (pos >= src.length) throw new Error('zip dañado'); v |= ((src[pos] >> bit) & 1) << i; if (++bit === 8) { bit = 0; pos++; } } return v; };
    const build = lens => { const cnt = new Uint16Array(16), offs = new Uint16Array(16), sym = new Uint16Array(lens.length); for (const l of lens) cnt[l]++; cnt[0] = 0; for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + cnt[i - 1]; lens.forEach((l, i) => { if (l) sym[offs[l]++] = i; }); return { cnt, sym }; };
    const dec = h => { let code = 0, first = 0, idx = 0; for (let l = 1; l < 16; l++) { code |= bits(1); const c = h.cnt[l]; if (code - first < c) return h.sym[idx + code - first]; idx += c; first = (first + c) << 1; code <<= 1; } throw new Error('zip dañado'); };
    const LB = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258], LE = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
    const DB = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577], DE = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
    let fl = null, fd = null, last = 0;
    while (!last) { last = bits(1); const t = bits(2);
      if (t === 0) { if (bit) { bit = 0; pos++; } const len = src[pos] | (src[pos + 1] << 8); pos += 4; need(len); out.set(src.subarray(pos, pos + len), op); op += len; pos += len; continue; }
      let hl, hd;
      if (t === 1) { if (!fl) { const l = new Uint8Array(288); l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280); fl = build(l); fd = build(new Uint8Array(30).fill(5)); } hl = fl; hd = fd; }
      else { const nl = bits(5) + 257, nd = bits(5) + 1, nc = bits(4) + 4, ord = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15], cl = new Uint8Array(19); for (let i = 0; i < nc; i++) cl[ord[i]] = bits(3);
        const ch = build(cl), L = new Uint8Array(nl + nd); for (let i = 0; i < nl + nd;) { const sy = dec(ch); if (sy < 16) L[i++] = sy; else if (sy === 16) { const p = L[i - 1]; for (let r = 3 + bits(2); r--;) L[i++] = p; } else if (sy === 17) i += 3 + bits(3); else i += 11 + bits(7); }
        hl = build(L.subarray(0, nl)); hd = build(L.subarray(nl)); }
      for (;;) { const sy = dec(hl); if (sy < 256) { need(1); out[op++] = sy; } else if (sy === 256) break; else { const k = sy - 257, len = LB[k] + bits(LE[k]), dk = dec(hd), dist = DB[dk] + bits(DE[dk]); need(len); for (let i = 0; i < len; i++, op++) out[op] = out[op - dist]; } } }
    return out.slice(0, op).buffer;
  }
  // «deflate» sin comprimir (bloques guardados): válido para cualquier descompresor
  function jsStore(u8) { const n = Math.max(1, Math.ceil(u8.length / 65535)), o = new Uint8Array(u8.length + n * 5); let p = 0;
    for (let i = 0; i < n; i++) { const a = i * 65535, b = Math.min(u8.length, a + 65535), L = b - a; o[p++] = i === n - 1 ? 1 : 0; o[p++] = L & 255; o[p++] = L >> 8; o[p++] = ~L & 255; o[p++] = (~L >> 8) & 255; o.set(u8.subarray(a, b), p); p += L; } return o; }
  BRR.jsInflate = jsInflate; BRR.jsStore = jsStore;
  let rawOK = null;
  async function inflate(blob) {
    if (rawOK === null) { try { new DecompressionStream('deflate-raw'); rawOK = true; } catch (e) { rawOK = false; } }
    if (rawOK) return new Response(blob.stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    return jsInflate(new Uint8Array(await blob.arrayBuffer()));
  }
  // devuelve objetos tipo File (name, webkitRelativePath, size, arrayBuffer, slice), que se leen al usarlos
  BRR.zipFiles = async function (zip) {
    const n = zip.size, tail = Math.min(n, 65557), d = await view(zip, n - tail, n);
    let e = -1; for (let i = tail - 22; i >= 0; i--) if (u32(d, i) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('No es un archivo .zip válido');
    let count = u16(d, e + 10), cdSize = u32(d, e + 12), cdOff = u32(d, e + 16);
    if (cdOff === 0xffffffff || count === 0xffff) {   // zip64
      const loc = e - 20; if (loc >= 0 && u32(d, loc) === 0x07064b50) { const off = Number(d.getBigUint64(loc + 8, true)), z = await view(zip, off, off + 56);
        count = Number(z.getBigUint64(32, true)); cdSize = Number(z.getBigUint64(40, true)); cdOff = Number(z.getBigUint64(48, true)); } }
    const cd = await view(zip, cdOff, cdOff + cdSize), td = new TextDecoder(), out = [];
    for (let p = 0, k = 0; k < count && p + 46 <= cdSize; k++) {
      if (u32(cd, p) !== 0x02014b50) break;
      const flags = u16(cd, p + 8), method = u16(cd, p + 10); let csize = u32(cd, p + 20), usize = u32(cd, p + 24), lho = u32(cd, p + 42);
      const nl = u16(cd, p + 28), xl = u16(cd, p + 30), cl = u16(cd, p + 32);
      const name = (flags & 0x800 ? td : new TextDecoder('latin1')).decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nl)).replace(/\\/g, '/');
      for (let x = p + 46 + nl; x < p + 46 + nl + xl - 4;) { const id = u16(cd, x), sz = u16(cd, x + 2); if (id === 1) { let q = x + 4;
          if (usize === 0xffffffff) { usize = Number(cd.getBigUint64(q, true)); q += 8; } if (csize === 0xffffffff) { csize = Number(cd.getBigUint64(q, true)); q += 8; } if (lho === 0xffffffff) lho = Number(cd.getBigUint64(q, true)); } x += 4 + sz; }
      p += 46 + nl + xl + cl;
      if (name.endsWith('/') || (method !== 0 && method !== 8)) continue;
      let start = null; const dataStart = async () => { if (start == null) { const h = await view(zip, lho, lho + 30); start = lho + 30 + u16(h, 26) + u16(h, 28); } return start; };
      let memo = null;
      const whole = async () => { if (memo) return memo; const s = await dataStart(), raw = zip.slice(s, s + csize); const pr = method === 0 ? raw.arrayBuffer() : inflate(raw); if (usize < 16e6) memo = pr; return pr; };
      const mk = (a, b) => ({ size: b - a, arrayBuffer: async () => { if (method === 0) { const s = await dataStart(); return zip.slice(s + a, s + b).arrayBuffer(); } const w = await whole(); return w.slice(a, b); },
        slice: (x = 0, y = b - a) => mk(a + Math.max(0, x), a + Math.min(y, b - a)) });
      out.push(Object.assign(mk(0, usize), { name: name.split('/').pop(), webkitRelativePath: name }));
    }
    return out;
  };
})();
