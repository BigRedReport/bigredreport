// Servicios en la nube sin servidor propio (buzones públicos MQTT + GitHub):
//  · clasificaciones de contrareloj: cada piloto guarda SU mejor tiempo en su propio mensaje retenido (lb/CIRCUITO/ID),
//    así nadie borra los tiempos de los demás; se publica en todos los buzones y se lee de varios a la vez.
//    Una tarea de GitHub copia además todo cada hora a datos/lb.json (la web y el juego lo leen como copia de seguridad).
//  · avisos de fallos automáticos: el error se deja en err/HUELLA y la misma tarea de GitHub lo convierte en un aviso (issue).
//  · comprobar si hay versión nueva (Releases de GitHub).
"use strict";
(function () {
  const BRR = window.BRR;
  const BROKERS = window.BRR_BROKERS || ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
  const T = 'bigredracing/v1/', REPO = 'BigRedReport/bigredreport', SITE = 'https://bigredreport.github.io/bigredreport/';
  const ID = (() => { let v = null; try { v = localStorage.getItem('brr_pid'); } catch (e) { }
    if (!v) { v = Math.random().toString(36).slice(2, 10); try { localStorage.setItem('brr_pid', v); } catch (e) { } } return v; })();
  // conexiones a los buzones: se abren al usarlas y se cierran solas al minuto sin uso
  const pool = new Map();
  function conn(url) {
    let c = pool.get(url); if (c && c.ok) { c.used = Date.now(); return c.p; }
    const mq = new BRR.MQ([url]); c = { mq, used: Date.now(), ok: true }; pool.set(url, c);
    c.p = mq.connect().then(() => { mq.onclose = () => { c.ok = false; }; return mq; }, e => { c.ok = false; pool.delete(url); throw e; });
    return c.p;
  }
  setInterval(() => { for (const [u, c] of pool) if (!c.keep && Date.now() - c.used > 60000) { try { c.mq.close(); } catch (e) { } pool.delete(u); } }, 20000);
  // publica en todos los buzones que respondan (para que lo vea quien lea de cualquiera)
  async function pubAll(topic, payload, retain) {
    const R = await Promise.allSettled(BROKERS.map(u => conn(u).then(mq => { mq.pub(topic, payload, retain); return 1; })));
    return R.filter(r => r.status === 'fulfilled').length;
  }
  // lee los mensajes retenidos de un filtro en varios buzones a la vez y espera un poco a que lleguen todos
  async function readAll(filter, ms = 2200) {
    const got = new Map(); let any = 0;
    await Promise.allSettled(BROKERS.map(u => conn(u).then(mq => new Promise(ok => { any++;
      const cb = (t, p) => { if (p) got.set(t + '|' + u, { t, p }); };
      mq.sub(filter, cb); setTimeout(() => { mq.subs = mq.subs.filter(s => s.cb !== cb); try { mq.unsub(filter); } catch (e) { } ok(); }, ms); }))));
    return { any, items: [...got.values()] };
  }
  const parse = s => { try { return JSON.parse(s); } catch (e) { return null; } };
  const okRow = r => r && typeof r === 'object' && typeof r.lap === 'number' && r.lap > 5 && r.lap < 3600 && typeof r.name === 'string';
  function merge(rows) {   // una fila por piloto y vehículo: la mejor vuelta
    const best = new Map(); for (const r of rows) { if (!okRow(r)) continue; const k = (r.pid || r.name) + '|' + (r.veh || ''); const o = best.get(k); if (!o || r.lap < o.lap) best.set(k, r); }
    return [...best.values()].sort((a, b) => a.lap - b.lap);
  }
  let snap = null, snapT = 0;
  async function snapshot() {   // copia de seguridad de la web (la actualiza GitHub cada hora)
    if (snap && Date.now() - snapT < 300000) return snap;
    try { const r = await fetch(SITE + 'datos/lb.json', { cache: 'no-cache' }); if (r.ok) { snap = await r.json(); snapT = Date.now(); } } catch (e) { }
    return snap || {};
  }
  const cache = {};
  BRR.cloud = {
    id: ID,
    // devuelve { rows, online } — si no hay conexión, rows es lo último que se vio (no se vacía la tabla por un fallo)
    async lbGet(level) {
      level = String(level || '').toUpperCase(); const [live, sn] = await Promise.all([readAll(T + 'lb/' + level + '/#'), snapshot()]);
      // lb/CIRCUITO/# incluye también lb/CIRCUITO (el formato antiguo: la tabla entera en un solo mensaje)
      const rows = []; for (const it of live.items) { const r = parse(it.p); if (Array.isArray(r)) rows.push(...r); else if (okRow(r)) rows.push(r); }
      if (Array.isArray(sn[level])) rows.push(...sn[level]);
      const online = live.any > 0 || Array.isArray(sn[level]);
      const m = merge(rows); if (m.length || online) cache[level] = m.length ? m : (cache[level] || []);
      return { rows: cache[level] || [], online };
    },
    async lbPut(level, row) {
      level = String(level || '').toUpperCase(); const R = { ...row, pid: ID, t: Date.now() }; if (!okRow(R)) return 0;
      const k = 'brr_lbmine_' + level + '_' + (R.veh || ''); let prev = null; try { prev = JSON.parse(localStorage.getItem(k)); } catch (e) { }
      if (prev && prev.lap <= R.lap) R.lap = prev.lap, R.total = prev.total || R.total;   // siempre se guarda tu mejor tiempo
      try { localStorage.setItem(k, JSON.stringify({ lap: R.lap, total: R.total })); } catch (e) { }
      const c = cache[level] || []; cache[level] = merge(c.concat([R]));
      return pubAll(T + 'lb/' + level + '/' + ID + '_' + (R.veh || 'X'), JSON.stringify(R), true);
    },
    // fantasmas de contrarreloj: el de tu mejor vuelta (uno por circuito y vehículo), para que otros corran contra el récord
    // formato compacto: 10 muestras por segundo, posición cada 5 cm (int16, relativa a la primera) y giro en 4 bytes
    async ghostPut(level, veh, g) {
      level = String(level || '').toUpperCase(); if (!g || !g.f || !g.t) return 0;
      const F = g.f, n0 = F.length / 8, N = Math.min(6000, Math.floor(g.t * 10) + 1), b = new DataView(new ArrayBuffer(12 + N * 10));
      const x0 = F[1], y0 = F[2], z0 = F[3]; b.setFloat32(0, x0, true); b.setFloat32(4, y0, true); b.setFloat32(8, z0, true);
      let i = 0; for (let k = 0; k < N; k++) { const t = Math.min(g.t, k / 10); while (i < n0 - 2 && F[(i + 1) * 8] < t) i++;
        const a = i * 8, c = Math.min(n0 - 1, i + 1) * 8, u = Math.max(0, Math.min(1, (t - F[a]) / Math.max(1e-3, F[c] - F[a]))), L = j => F[a + j] + (F[c + j] - F[a + j]) * u, o = 12 + k * 10;
        b.setInt16(o, Math.round((L(1) - x0) * 20), true); b.setInt16(o + 2, Math.round((L(2) - y0) * 20), true); b.setInt16(o + 4, Math.round((L(3) - z0) * 20), true);
        let q = [L(4), L(5), L(6), L(7)]; const l = Math.hypot(...q) || 1; q = q.map(x => x / l); for (let j = 0; j < 4; j++) b.setInt8(o + 6 + j, Math.round(q[j] * 127)); }
      let bin = ''; const u8 = new Uint8Array(b.buffer); for (let k = 0; k < u8.length; k++) bin += String.fromCharCode(u8[k]);
      return pubAll(T + 'gh/' + level + '/' + ID + '_' + veh, JSON.stringify({ v: 1, lap: g.t, veh, name: g.name || 'Piloto', n: N, d: btoa(bin), t: Date.now() }), true);
    },
    async ghostGet(level, veh, pid) {
      level = String(level || '').toUpperCase(); const R = await readAll(T + 'gh/' + level + '/' + pid + '_' + veh, 3000); let best = null;
      for (const it of R.items) { const j = parse(it.p); if (j && j.v === 1 && typeof j.d === 'string' && j.n > 1 && (!best || j.t > best.t)) best = j; }
      if (!best) return null;
      try { const bin = atob(best.d), u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k); const b = new DataView(u8.buffer), N = Math.min(best.n, (u8.length - 12) / 10 | 0);
        const x0 = b.getFloat32(0, true), y0 = b.getFloat32(4, true), z0 = b.getFloat32(8, true), f = new Float32Array(N * 8);
        for (let k = 0; k < N; k++) { const o = 12 + k * 10; f.set([Math.min(best.lap, k / 10), x0 + b.getInt16(o, true) / 20, y0 + b.getInt16(o + 2, true) / 20, z0 + b.getInt16(o + 4, true) / 20,
          b.getInt8(o + 6) / 127, b.getInt8(o + 7) / 127, b.getInt8(o + 8) / 127, b.getInt8(o + 9) / 127], k * 8); }
        return { t: best.lap, veh: best.veh, name: best.name, f }; } catch (e) { return null; }
    },
    // amigos: «presencia» retenida en pr/ID (nombre, si estás conectado y en qué sala) y un buzón fi/ID para invitaciones y avisos
    async presence(st) { return pubAll(T + 'pr/' + ID, JSON.stringify({ ...st, t: Date.now() }), true); },
    async presenceGet(ids) {
      const out = {}; ids = ids.filter(x => /^[a-z0-9]{4,12}$/.test(x)); if (!ids.length) return out;
      const R = await Promise.all(ids.map(id => readAll(T + 'pr/' + id, 2000).then(r => [id, r])));
      for (const [id, r] of R) for (const it of r.items) { const j = parse(it.p); if (j && typeof j.t === 'number' && (!out[id] || j.t > out[id].t)) out[id] = j; }
      return out;
    },
    async send(id, msg) { if (!/^[a-z0-9]{4,12}$/.test(id)) return 0; return pubAll(T + 'fi/' + id, JSON.stringify({ ...msg, from: ID, mid: Math.random().toString(36).slice(2, 9), t: Date.now() }), false); },
    inbox(cb) {   // escucha tu buzón en todos los servidores (y se reconecta solo)
      const seen = new Set(), on = (t, p) => { const j = parse(p); if (!j || !j.mid || seen.has(j.mid) || Date.now() - (j.t || 0) > 120000) return; seen.add(j.mid); cb(j); };
      const hook = u => conn(u).then(mq => { const c = pool.get(u); if (c) c.keep = true; mq.sub(T + 'fi/' + ID, on); const was = mq.onclose; mq.onclose = () => { was && was(); setTimeout(() => hook(u), 15000); }; }, () => setTimeout(() => hook(u), 60000));
      BROKERS.forEach(hook);
    },
    // aviso de fallo automático (sin datos personales: mensaje, pila, versión, navegador y dónde ocurrió)
    async report(info) {
      const s = JSON.stringify(info); let h = 0; const key = String(info.msg || '') + String(info.stack || '').split('\n')[1];
      for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
      return pubAll(T + 'err/' + (h >>> 0).toString(36) + '_' + ID, s.slice(0, 6000), true);
    },
    // ¿hay versión nueva? → { ver, url, notes } o null
    async latest() {
      try { const r = await fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } }); if (!r.ok) return null;
        const j = await r.json(); return { ver: String(j.tag_name || '').replace(/^v/, ''), url: j.html_url, assets: (j.assets || []).map(a => ({ name: a.name, url: a.browser_download_url })) }; } catch (e) { return null; }
    },
    newer(a, b) { const A = String(a).split('.').map(Number), B = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((A[i] || 0) !== (B[i] || 0)) return (A[i] || 0) > (B[i] || 0); } return false; }
  };
})();
