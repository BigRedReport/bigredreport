// Servidor oficial de Big Red Report en Cloudflare (Workers + Durable Objects, plan gratuito).
// Es el mismo servidor que server/brr-server.js (salas, reenvío de la carrera, clasificaciones) y además tiene una
// sala permanente, «Servidor oficial»: siempre abierta, hasta 12 jugadores, carreras normales con bots y votación del
// siguiente circuito al acabar cada carrera. La lleva el primer jugador que entra (su juego hace de anfitrión); si se va,
// pasa al siguiente. Cuando se queda vacía vuelve a esperar.
// Se publica solo desde GitHub (.github/workflows/servidor.yml).

const VERSION = 1;
const ORIG = ['RIG1', 'RIG3', 'RIG4', 'CHOPPER1', 'CHOPPER2', 'CHOPPER3', 'DIRT1', 'DIRT2', 'DIRT3', 'RUF1', 'RUF2', 'RUF3', 'WATER1', 'WATER2', 'WATER3', 'CITY1', 'CITY2', 'CITY4', 'SNOW1', 'SNOW2', 'SNOW3', 'MOON1', 'MOON2', 'MOON3'];
const OFFICIAL = 'OFICIAL', BOTS = 5, FIRST_WAIT = 25000;
const pick = a => a[Math.random() * a.length | 0];
const officialInfo = level => ({ mode: 'vote', maps: [level], idx: 0, level, laps: 3, crazy: 'normal', ai: BOTS, diff: 2, pts: {}, names: {}, race: 1, official: 1, hz: 12 });

// límites del contenido propio que llega por la red (igual que en el servidor de Node)
const cleanData = d => { const o = {}; if (!d || typeof d !== 'object') return o;
  for (const k of ['team', 'char', 'head', 'body']) if (d[k] != null) { const v = d[k] | 0; if (v >= 0 && v <= 12) o[k] = v; }
  if (typeof d.veh === 'string' && /^[A-Z0-9_]{1,12}$/i.test(d.veh)) o.veh = d.veh.toUpperCase();
  if (d.ready != null) o.ready = !!d.ready;
  if (typeof d.teamName === 'string') o.teamName = d.teamName.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 24); else if (d.teamName === null) o.teamName = null;
  if (typeof d.paint === 'string' && /^#[0-9a-f]{6}$/i.test(d.paint)) o.paint = d.paint; else if (d.paint === null) o.paint = null;
  if (typeof d.logo === 'number' && d.logo >= 0 && d.logo < 64) o.logo = d.logo | 0;
  else if (typeof d.logo === 'string' && d.logo.length <= 200000 && /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(d.logo)) o.logo = d.logo;
  else if ('logo' in d) o.logo = null;
  if (d.gar && typeof d.gar === 'object') o.gar = JSON.parse(JSON.stringify(d.gar).slice(0, 4000) || '{}');
  return o; };

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
    const stub = env.LOBBY.get(env.LOBBY.idFromName('principal'));
    return stub.fetch(req);
  },
};

export class Lobby {
  constructor(state, env) {
    this.state = state; this.rooms = new Map(); this.n = 0; this.lb = null;
    this.rooms.set(OFFICIAL, { id: OFFICIAL, name: 'Servidor oficial', host: null, pub: true, pass: '', max: 12, members: new Set(), state: 'lobby', perm: true, info: officialInfo(pick(ORIG)) });
  }
  async fetch(req) {
    const u = new URL(req.url);
    if (req.headers.get('Upgrade') !== 'websocket') {   // estado (para la lista del juego y la web)
      const r = this.rooms.get(OFFICIAL), body = { ok: true, version: VERSION, rooms: this.rooms.size, official: this.roomInfo(r), players: [...this.rooms.values()].reduce((a, x) => a + x.members.size, 0) };
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } });
    }
    const [client, server] = Object.values(new WebSocketPair()); server.accept();
    const c = { ws: server, id: (++this.n).toString(36) + Math.random().toString(36).slice(2, 7), name: 'Jugador', room: null, data: {}, alive: true };
    server.addEventListener('message', ev => { let m; if (typeof ev.data !== 'string' || ev.data.length > 512 * 1024) return; try { m = JSON.parse(ev.data); } catch (e) { return; } this.onMsg(c, m).catch(() => { }); });
    const bye = () => { if (!c.alive) return; c.alive = false; this.leave(c); };
    server.addEventListener('close', bye); server.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }
  send(c, m) { try { c.ws.send(typeof m === 'string' ? m : JSON.stringify(m)); } catch (e) { } }
  roomInfo(r) { return { id: r.id, name: r.name, players: r.members.size, max: r.max, state: r.state, info: r.info || {}, host: r.host ? r.host.name : 'Servidor', pass: !!r.pass, official: !!r.perm }; }
  members(r) { return [...r.members].map(m => ({ id: m.id, name: m.name, host: m === r.host, data: m.data || {} })); }
  update(r) { const room = this.roomInfo(r), mem = this.members(r); for (const m of r.members) this.send(m, { t: 'room', room, you: m.id, members: mem }); }
  leave(c) {
    const r = c.room; if (!r) return; r.members.delete(c); c.room = null;
    if (r.perm) {   // la sala oficial nunca se cierra: el mando pasa al siguiente; vacía, vuelve a esperar
      if (r.host === c) r.host = r.members.values().next().value || null;
      if (!r.members.size) { r.state = 'lobby'; r.info = officialInfo(r.info && r.info.level || pick(ORIG)); }
      for (const m of r.members) this.send(m, { t: 'left', id: c.id }); this.update(r); return;
    }
    if (r.host === c) { for (const m of r.members) { this.send(m, { t: 'closed', why: 'El anfitrión ha cerrado la partida' }); m.room = null; } this.rooms.delete(r.id); }
    else { for (const m of r.members) this.send(m, { t: 'left', id: c.id }); this.update(r); }
  }
  async lbLoad() { if (!this.lb) this.lb = (await this.state.storage.get('lb')) || {}; return this.lb; }
  async onMsg(c, m) {
    switch (m.t) {
      case 'hello': c.name = String(m.name || 'Jugador').replace(/[<>\u0000-\u001f]/g, '').slice(0, 20) || 'Jugador'; this.send(c, { t: 'hello', id: c.id, version: VERSION }); break;
      case 'ping': this.send(c, { t: 'pong', id: String(m.id || '').slice(0, 12), ts: +m.ts || 0 }); break;
      case 'list': this.send(c, { t: 'list', rooms: [...this.rooms.values()].filter(r => r.pub).map(r => this.roomInfo(r)) }); break;
      case 'create': {
        this.leave(c); let id; do { id = Math.random().toString(16).slice(2, 8).toUpperCase(); } while (this.rooms.has(id));
        const r = { id, name: String(m.name || c.name + ' ').slice(0, 30), host: c, pub: m.pub !== false, pass: String(m.pass || ''), max: Math.max(2, Math.min(12, m.max | 0 || 6)), members: new Set([c]), state: 'lobby', info: m.info || {} };
        this.rooms.set(id, r); c.room = r; c.data = cleanData(m.data); this.update(r); break;
      }
      case 'join': {
        const r = this.rooms.get(String(m.id || '').toUpperCase());
        if (!r) return this.send(c, { t: 'error', msg: 'No existe esa partida' });
        if (r.pass && r.pass !== m.pass) return this.send(c, { t: 'error', msg: 'Contraseña incorrecta' });
        if (r.members.size >= r.max) return this.send(c, { t: 'error', msg: 'La partida está llena' });
        this.leave(c); r.members.add(c); c.room = r; c.data = cleanData(m.data);
        if (r.perm && !r.host) { r.host = c; if (r.state === 'lobby') r.info = { ...r.info, autoAt: Date.now() + FIRST_WAIT, vote: null }; }   // el primero en llegar: su juego lleva la sala; primera carrera en 25 s
        this.update(r); break;
      }
      case 'leave': this.leave(c); this.send(c, { t: 'left', id: c.id }); break;
      case 'data': if (c.room) { c.data = Object.assign(c.data || {}, cleanData(m.data)); this.update(c.room); } break;
      case 'info': if (c.room && c.room.host === c) { const r = c.room; r.info = m.info || {};
        if (r.perm) { r.info.official = 1; r.info.hz = 12; r.info.ai = BOTS; r.info.crazy = 'normal'; if (r.info.mode !== 'vote') r.info.mode = 'vote'; }   // la oficial: siempre carreras normales con bots y votación
        if (m.state === 'lobby' || m.state === 'racing') r.state = m.state; this.update(r); } break;
      case 'chat': if (c.room) for (const o of c.room.members) this.send(o, { t: 'chat', id: c.id, from: c.name, text: String(m.text || '').slice(0, 200) }); break;
      case 'kick': { const r = c.room; if (!r || r.host !== c || r.perm) break; const o = [...r.members].find(x => x.id === m.id); if (o) { this.send(o, { t: 'closed', why: 'El anfitrión te ha sacado de la partida' }); this.leave(o); } break; }
      // reenvío de la carrera: a todos (menos el que lo manda) o a uno concreto
      case 'g': if (c.room) { const out = JSON.stringify({ t: 'g', from: c.id, d: m.d }); for (const o of c.room.members) if (o !== c && (!m.to || o.id === m.to)) this.send(o, out); } break;
      case 'lbget': { const LB = await this.lbLoad(), lv = String(m.level || '').slice(0, 40).toUpperCase(); this.send(c, { t: 'lb', level: lv, rows: (LB[lv] || []).slice(0, 20) }); break; }
      case 'lbput': {
        const LB = await this.lbLoad(), lv = String(m.level || '').slice(0, 40).toUpperCase(), r = m.row || {}, lap = +r.lap; if (!lv || !(lap > 5 && lap < 3600)) break;
        const row = { name: String(r.name || c.name).slice(0, 20), veh: String(r.veh || '').slice(0, 12), lap: Math.round(lap * 1000) / 1000, total: +r.total || null, team: r.team | 0, t: Date.now() };
        const L = (LB[lv] = LB[lv] || []), i = L.findIndex(x => x.name === row.name && x.veh === row.veh);
        if (i >= 0) { if (L[i].lap <= row.lap) { this.send(c, { t: 'lb', level: lv, rows: L.slice(0, 20) }); break; } L.splice(i, 1); }
        L.push(row); L.sort((a, b) => a.lap - b.lap); LB[lv] = L.slice(0, 100); await this.state.storage.put('lb', LB);
        this.send(c, { t: 'lb', level: lv, rows: LB[lv].slice(0, 20) }); break;
      }
    }
  }
}
