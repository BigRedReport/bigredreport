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
  setInterval(() => { for (const [u, c] of pool) if (Date.now() - c.used > 60000) { try { c.mq.close(); } catch (e) { } pool.delete(u); } }, 20000);
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
