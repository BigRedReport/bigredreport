// Tarea de cada hora (GitHub Actions):
//  1) copia las clasificaciones de los buzones públicos a datos/lb.json (copia de seguridad que leen la web y el juego)
//  2) convierte los avisos de fallos automáticos del juego en avisos (issues) de GitHub y los borra del buzón
// MQTT 3.1.1 mínimo por TCP, sin dependencias.
import net from 'node:net';
import fs from 'node:fs';

const BROKERS = [['broker.emqx.io', 1883], ['broker.hivemq.com', 1883], ['test.mosquitto.org', 1883]];
const T = 'bigredracing/v1/', REPO = process.env.GITHUB_REPOSITORY || 'BigRedReport/bigredreport', TOKEN = process.env.GH_TOKEN;
const str = s => { const b = Buffer.from(s); return Buffer.concat([Buffer.from([b.length >> 8, b.length & 255]), b]); };
const len = n => { const o = []; do { let d = n % 128; n = Math.floor(n / 128); if (n) d |= 128; o.push(d); } while (n); return Buffer.from(o); };
const pkt = (h, body) => Buffer.concat([Buffer.from([h]), len(body.length), body]);

function collect([host, port], filters, ms = 9000) {
  return new Promise(ok => {
    const got = new Map(); let buf = Buffer.alloc(0), done = false;
    const s = net.connect(port, host); s.setTimeout(ms + 4000);
    const end = () => { if (done) return; done = true; ok({ s, got }); };
    s.on('connect', () => s.write(pkt(0x10, Buffer.concat([str('MQTT'), Buffer.from([4, 0x02, 0, 60]), str('brrgh' + Math.random().toString(36).slice(2, 9))]))));
    s.on('data', d => { buf = Buffer.concat([buf, d]);
      for (;;) { if (buf.length < 2) break; let mul = 1, n = 0, i = 1, c; do { if (i >= buf.length) return; c = buf[i++]; n += (c & 127) * mul; mul *= 128; } while (c & 128);
        if (buf.length < i + n) break; const h = buf[0], body = buf.subarray(i, i + n); buf = buf.subarray(i + n); const type = h >> 4;
        if (type === 2) { let id = 1; for (const f of filters) s.write(pkt(0x82, Buffer.concat([Buffer.from([0, id++]), str(f), Buffer.from([0])]))); setTimeout(end, ms); }
        else if (type === 3) { const tl = (body[0] << 8) | body[1], topic = body.subarray(2, 2 + tl).toString(); let o = 2 + tl; if ((h >> 1) & 3) o += 2; const p = body.subarray(o).toString(); if (p) got.set(topic, p); } } });
    s.on('error', () => end()); s.on('timeout', () => { s.destroy(); end(); });
  });
}
const pubRetained = (s, topic, payload) => { try { s.write(pkt(0x31, Buffer.concat([str(topic), Buffer.from(payload)]))); } catch (e) { } };

const R = await Promise.all(BROKERS.map(b => collect(b, [T + 'lb/#', T + 'err/#'])));
console.log('buzones:', R.map((r, i) => BROKERS[i][0] + ' ' + r.got.size).join(', '));

// ---------- 1) clasificaciones ----------
const okRow = r => r && typeof r === 'object' && typeof r.lap === 'number' && r.lap > 5 && r.lap < 3600 && typeof r.name === 'string';
fs.mkdirSync('datos', { recursive: true });
let LB = {}; try { LB = JSON.parse(fs.readFileSync('datos/lb.json', 'utf8')); } catch (e) { }
const add = (lv, r) => { if (!okRow(r) || !/^[A-Z0-9]{3,12}$/.test(lv)) return; const row = { name: String(r.name).slice(0, 20), veh: String(r.veh || '').slice(0, 10), lap: r.lap, total: typeof r.total === 'number' ? r.total : undefined, team: r.team | 0, pid: r.pid ? String(r.pid).slice(0, 12) : undefined, t: typeof r.t === 'number' && r.t > 1e12 ? Math.round(r.t) : 0 };
  (LB[lv] = LB[lv] || []).push(row); };
for (const { got } of R) for (const [topic, p] of got) {
  const m = topic.match(/^bigredracing\/v1\/lb\/([A-Z0-9]+)(?:\/.*)?$/); if (!m) continue; let v; try { v = JSON.parse(p); } catch (e) { continue; }
  if (Array.isArray(v)) v.forEach(r => add(m[1], r)); else add(m[1], v);
}
for (const lv of Object.keys(LB)) { const best = new Map(); for (const r of LB[lv]) { const k = (r.pid || r.name) + '|' + r.veh; const o = best.get(k); if (!o || r.lap < o.lap) best.set(k, r); }
  LB[lv] = [...best.values()].sort((a, b) => a.lap - b.lap).slice(0, 100); }
const sorted = Object.fromEntries(Object.keys(LB).sort().map(k => [k, LB[k]]));
fs.writeFileSync('datos/lb.json', JSON.stringify(sorted, null, 0) + '\n');
console.log('circuitos con tiempos:', Object.keys(sorted).length);

// ---------- 2) avisos de fallos ----------
const errs = new Map();   // huella -> { info, n, topics }
for (const { got } of R) for (const [topic, p] of got) {
  const m = topic.match(/^bigredracing\/v1\/err\/([a-z0-9]+)_([a-z0-9]+)$/); if (!m) continue; let info; try { info = JSON.parse(p); } catch (e) { info = { msg: p.slice(0, 300) }; }
  const e = errs.get(m[1]) || { info, users: new Set(), topics: new Set() }; e.users.add(m[2]); e.topics.add(topic); errs.set(m[1], e);
}
const gh = async (path, opt = {}) => { const r = await fetch('https://api.github.com/repos/' + REPO + path, { ...opt, headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' } }); return r.ok ? r.json() : (console.log('GitHub', r.status, await r.text()), null); };
if (errs.size && TOKEN) {
  for (const [name, color] of [['automático', 'c5def5'], ['fallo', 'd73a4a']]) await fetch('https://api.github.com/repos/' + REPO + '/labels', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json' }, body: JSON.stringify({ name, color }) }).catch(() => { });
  const open = (await gh('/issues?state=all&labels=automático&per_page=100')) || [];
  for (const [hash, e] of errs) {
    const I = e.info || {}, clean = s => String(s || '').replace(/[`<>]/g, '').slice(0, 2000);
    const detail = `- **Versión:** ${clean(I.ver)}\n- **Dónde:** ${clean(I.where)}${I.track ? ' · ' + clean(I.track) : ''}\n- **Navegador:** ${clean(I.ua)}${I.native ? ' (programa de escritorio)' : ''}\n- **Idioma:** ${clean(I.lang)}\n- **Jugadores afectados en esta hora:** ${e.users.size}\n\n\`\`\`\n${clean(I.msg)}\n${clean(I.stack)}\n\`\`\``;
    const ex = open.find(x => x.title.includes('[' + hash + ']'));
    if (ex) await gh('/issues/' + ex.number + '/comments', { method: 'POST', body: JSON.stringify({ body: 'Ha vuelto a pasar:\n\n' + detail }) });
    else await gh('/issues', { method: 'POST', body: JSON.stringify({ title: 'Fallo automático: ' + clean(I.msg).slice(0, 80) + ' [' + hash + ']', body: 'Aviso enviado automáticamente por el juego.\n\n' + detail, labels: ['automático', 'fallo'] }) });
    console.log('aviso', hash, ex ? 'comentado #' + ex.number : 'nuevo');
  }
  // fuera del buzón (un mensaje retenido vacío lo borra)
  for (const { s } of R) for (const e of errs.values()) for (const t of e.topics) pubRetained(s, t, '');
}
await new Promise(r => setTimeout(r, 1500));
for (const { s } of R) { try { s.end(pkt(0xE0, Buffer.alloc(0))); } catch (e) { } }
setTimeout(() => process.exit(0), 1000);
