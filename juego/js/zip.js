// Leer el juego desde un .zip (para móviles, donde no se puede elegir una carpeta): sin librerías, con DecompressionStream
"use strict";
(function () {
  const BRR = window.BRR = window.BRR || {};
  const u16 = (d, o) => d.getUint16(o, true), u32 = (d, o) => d.getUint32(o, true);
  async function view(blob, a, b) { return new DataView(await blob.slice(a, b).arrayBuffer()); }
  async function inflate(blob) {
    if (!window.DecompressionStream) throw new Error('Este navegador no sabe descomprimir zips');
    return new Response(blob.stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
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
