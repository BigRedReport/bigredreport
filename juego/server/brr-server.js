// Servidor de Big Red Racing online: lobby público + salas creadas por los jugadores + reenvío de mensajes de la carrera.
// Sin dependencias: solo Node.js (https://nodejs.org). Uso:  node brr-server.js [puerto]   (por defecto 7777)
// Cualquier jugador puede abrir su propio servidor; si lo deja accesible desde Internet (puerto abierto en el router
// o en un hosting), los demás lo añaden en "Online → Servidor" y ven su lista de partidas.
'use strict';
const http = require('http'), crypto = require('crypto'), fs = require('fs'), path = require('path');

  // límites del contenido propio que llega por la red: logos (formato y tamaño), color, piloto, vehículo y nombre
const cleanData = d => { const o = {}; if (!d || typeof d !== 'object') return o;
    for (const k of ['team', 'char', 'head', 'body']) if (d[k] != null) { const v = d[k] | 0; if (v >= 0 && v <= 12) o[k] = v; }
    if (typeof d.veh === 'string' && /^[A-Z0-9_]{1,12}$/i.test(d.veh)) o.veh = d.veh.toUpperCase();
    if (d.ready != null) o.ready = !!d.ready;
    if (typeof d.teamName === 'string') o.teamName = d.teamName.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 24); else if (d.teamName === null) o.teamName = null;
    if (typeof d.paint === 'string' && /^#[0-9a-f]{6}$/i.test(d.paint)) o.paint = d.paint; else if (d.paint === null) o.paint = null;
    if (typeof d.logo === 'number' && d.logo >= 0 && d.logo < 64) o.logo = d.logo | 0;
    else if (typeof d.logo === 'string' && d.logo.length <= 200000 && /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(d.logo)) o.logo = d.logo;
    else if ('logo' in d) o.logo = null;
    return o; };
// clasificaciones de contrarreloj por circuito (se guardan en clasificaciones.json junto al servidor)
const LBF = path.join(__dirname, 'clasificaciones.json'); let LB = {}; try { LB = JSON.parse(fs.readFileSync(LBF, 'utf8')); } catch (e) { }
let lbSaveT = null; const lbSave = () => { clearTimeout(lbSaveT); lbSaveT = setTimeout(() => { try { fs.writeFileSync(LBF, JSON.stringify(LB)); } catch (e) { } }, 2000); };
const PORT = +(process.argv[2] || process.env.PORT || 7777);
const VERSION = 1;

// ---------- WebSocket mínimo (RFC 6455) ----------
function accept(req, sock) {
  const key = req.headers['sec-websocket-key']; if (!key) return sock.destroy();
  const acc = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  sock.setNoDelay(true);
  const c = { sock, buf: Buffer.alloc(0), alive: true, id: crypto.randomBytes(4).toString('hex'), name: 'Jugador', room: null };
  sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); parse(c); });
  sock.on('close', () => drop(c)); sock.on('error', () => drop(c));
  return c;
}
function parse(c) {
  for (;;) {
    const b = c.buf; if (b.length < 2) return;
    const op = b[0] & 15, masked = b[1] & 128; let len = b[1] & 127, o = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); o = 4; }
    else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); o = 10; }
    if (len > 512 * 1024) { c.sock.destroy(); return; }   // mensajes de más de 512 KB: fuera
    const mo = o; if (masked) o += 4; if (b.length < o + len) return;
    let p = b.subarray(o, o + len); if (masked) { const m = b.subarray(mo, mo + 4); p = Buffer.from(p); for (let i = 0; i < p.length; i++) p[i] ^= m[i & 3]; }
    c.buf = b.subarray(o + len);
    if (op === 8) { c.sock.end(); return; }
    if (op === 9) { frame(c, p, 10); continue; }
    if (op === 1) { let m; try { m = JSON.parse(p.toString('utf8')); } catch (e) { continue; } onMsg(c, m); }
  }
}
function frame(c, data, op = 1) {
  if (c.sock.destroyed) return;
  const p = Buffer.isBuffer(data) ? data : Buffer.from(data), n = p.length;
  const h = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : (() => { const x = Buffer.alloc(10); x[0] = 0x80 | op; x[1] = 127; x.writeBigUInt64BE(BigInt(n), 2); return x; })();
  try { c.sock.write(Buffer.concat([h, p])); } catch (e) { }
}
const send = (c, m) => frame(c, JSON.stringify(m));

// ---------- salas ----------
const rooms = new Map();   // id -> { id, name, host, pub, max, members: Set, state, info }
const roomInfo = r => ({ id: r.id, name: r.name, players: r.members.size, max: r.max, state: r.state, info: r.info || {}, host: r.host.name, pass: !!r.pass });
const members = r => [...r.members].map(m => ({ id: m.id, name: m.name, host: m === r.host, data: m.data || {} }));
function roomUpdate(r) { for (const m of r.members) send(m, { t: 'room', room: roomInfo(r), you: m.id, members: members(r) }); }
function leave(c) {
  const r = c.room; if (!r) return; r.members.delete(c); c.room = null;
  if (r.host === c) { for (const m of r.members) { send(m, { t: 'closed', why: 'El anfitrión ha cerrado la partida' }); m.room = null; } rooms.delete(r.id); }
  else { for (const m of r.members) send(m, { t: 'left', id: c.id }); roomUpdate(r); }
}
function drop(c) { if (!c.alive) return; c.alive = false; leave(c); }
function onMsg(c, m) {
  switch (m.t) {
    case 'hello': c.name = String(m.name || 'Jugador').slice(0, 20); send(c, { t: 'hello', id: c.id, version: VERSION }); break;
    case 'list': send(c, { t: 'list', rooms: [...rooms.values()].filter(r => r.pub).map(roomInfo) }); break;
    case 'create': {
      leave(c); const id = crypto.randomBytes(3).toString('hex').toUpperCase();
      const r = { id, name: String(m.name || c.name + ' ').slice(0, 30), host: c, pub: m.pub !== false, pass: m.pass || '', max: Math.max(2, Math.min(12, m.max | 0 || 6)), members: new Set([c]), state: 'lobby', info: m.info || {} };
      rooms.set(id, r); c.room = r; c.data = cleanData(m.data); roomUpdate(r); break;
    }
    case 'join': {
      const r = rooms.get(String(m.id || '').toUpperCase());
      if (!r) return send(c, { t: 'error', msg: 'No existe esa partida' });
      if (r.pass && r.pass !== m.pass) return send(c, { t: 'error', msg: 'Contraseña incorrecta' });
      if (r.members.size >= r.max) return send(c, { t: 'error', msg: 'La partida está llena' });
      leave(c); r.members.add(c); c.room = r; c.data = cleanData(m.data); roomUpdate(r); break;
    }
    case 'leave': leave(c); send(c, { t: 'left', id: c.id }); break;
    case 'data': if (c.room) { c.data = Object.assign(c.data || {}, cleanData(m.data)); roomUpdate(c.room); } break;
    case 'info': if (c.room && c.room.host === c) { c.room.info = m.info || {}; if (m.state) c.room.state = m.state; roomUpdate(c.room); } break;
    case 'chat': if (c.room) for (const o of c.room.members) send(o, { t: 'chat', from: c.name, text: String(m.text || '').slice(0, 200) }); break;
    // reenvío de la carrera: a todos (menos el que lo manda) o a uno concreto
    case 'g': if (c.room) { const out = JSON.stringify({ t: 'g', from: c.id, d: m.d }); for (const o of c.room.members) if (o !== c && (!m.to || o.id === m.to)) frame(o, out); } break;
    case 'ping': send(c, { t: 'pong', ts: m.ts }); break;
    case 'lbget': { const lv = String(m.level || '').slice(0, 16).toUpperCase(); send(c, { t: 'lb', level: lv, rows: (LB[lv] || []).slice(0, 20) }); break; }
    case 'lbput': {
      const lv = String(m.level || '').slice(0, 16).toUpperCase(), r = m.row || {}, lap = +r.lap; if (!lv || !(lap > 5 && lap < 3600)) break;
      const row = { name: String(r.name || c.name).slice(0, 20), veh: String(r.veh || '').slice(0, 12), lap: Math.round(lap * 1000) / 1000, total: +r.total || null, team: r.team | 0, t: Date.now() };
      const L = (LB[lv] = LB[lv] || []), i = L.findIndex(x => x.name === row.name && x.veh === row.veh);
      if (i >= 0) { if (L[i].lap <= row.lap) { send(c, { t: 'lb', level: lv, rows: L.slice(0, 20) }); break; } L.splice(i, 1); }
      L.push(row); L.sort((a, b) => a.lap - b.lap); LB[lv] = L.slice(0, 100); lbSave();
      send(c, { t: 'lb', level: lv, rows: LB[lv].slice(0, 20) }); break;
    }
  }
}

const srv = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end('Servidor de Big Red Racing en marcha. Partidas abiertas: ' + rooms.size + '\n');
});
srv.on('upgrade', (req, sock) => accept(req, sock));
// red local: se anuncia cada 2 s por difusión UDP (puerto 7779) para que los juegos de la misma red lo encuentren solos
function lanAnnounce() {
  try { const dgram = require('dgram'), os = require('os'), s = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    s.bind(() => { s.setBroadcast(true);
      setInterval(() => { const msg = Buffer.from(JSON.stringify({ brr: 1, name: (process.env.BRR_NAME || os.hostname()).slice(0, 30), port: PORT, rooms: [...rooms.values()].filter(r => r.pub !== false).map(r => ({ name: String(r.name || '').slice(0, 30), players: r.members ? r.members.size : 0, max: r.max })).slice(0, 8) }));
        const targets = new Set(['255.255.255.255']); const nets = os.networkInterfaces();
        for (const k in nets) for (const a of nets[k]) if (a.family === 'IPv4' && !a.internal && a.netmask) { const ip = a.address.split('.').map(Number), m = a.netmask.split('.').map(Number); targets.add(ip.map((x, i) => (x & m[i]) | (~m[i] & 255)).join('.')); }
        for (const t of targets) s.send(msg, 7779, t, () => { }); }, 2000); });
    s.on('error', () => { }); } catch (e) { }
}
srv.listen(PORT, () => {
  lanAnnounce();
  console.log('Servidor de Big Red Racing escuchando en el puerto ' + PORT);
  const nets = require('os').networkInterfaces();
  for (const k in nets) for (const a of nets[k]) if (a.family === 'IPv4' && !a.internal) console.log('  En tu red local:  ws://' + a.address + ':' + PORT);
  console.log('  En este PC:       ws://localhost:' + PORT);
  console.log('Para jugar por Internet abre el puerto ' + PORT + ' (TCP) en tu router y comparte ws://TU_IP_PUBLICA:' + PORT);
});
