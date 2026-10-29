// Online sin servidor propio: el jugador que crea la partida hace de servidor dentro de su navegador.
// - Para encontrarse (lista de partidas públicas y "llamada" inicial) se usa un buzón público de mensajes MQTT por WebSocket
//   (varios proveedores gratuitos, el primero que responda). Por ahí solo pasan anuncios de partidas y los datos de conexión.
// - La partida en sí va directa entre navegadores (WebRTC): el anfitrión recibe y reenvía, como hacía server/brr-server.js.
// Misma interfaz que BRR.Net (servidor propio), así el resto del juego no cambia.
"use strict";
(function () {

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
    if (d.gar && typeof d.gar === 'object') { const g = d.gar, q = {}, hx = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : null, w = (v, n) => typeof v === 'string' && new RegExp('^[a-z0-9]{1,' + n + '}$').test(v) ? v : null;   // garaje (estética)
      q.rim = w(g.rim, 10); if ([15, 16, 17, 18, 19].includes(+g.rimSize)) q.rimSize = +g.rimSize; q.rimCol = w(g.rimCol, 8); q.neon = g.neon === 'si' ? 'si' : 'no'; q.neonCol = hx(g.neonCol); q.glass = w(g.glass, 8); q.glassCol = hx(g.glassCol); q.turboCol = hx(g.turboCol); q.lightCol = w(g.lightCol, 10); o.gar = q; }
    return o; };
  const BRR = window.BRR;
  const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt', 'wss://public:public@public.cloud.shiftr.io'];
  const T = 'bigredracing/v1/';
  const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' }] };
  const te = new TextEncoder(), td = new TextDecoder();
  const rid = n => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < n; i++) s += A[Math.random() * A.length | 0]; return s; };

  // ---------- cliente MQTT 3.1.1 mínimo (QoS 0) ----------
  class MQ {
    constructor(urls) { this.urls = urls; this.subs = []; this.buf = new Uint8Array(0); this.pid = 1; }
    static str(s) { const b = te.encode(s); return [b.length >> 8, b.length & 255, ...b]; }
    static len(n) { const o = []; do { let d = n % 128; n = Math.floor(n / 128); if (n) d |= 128; o.push(d); } while (n); return o; }
    pkt(h, body) { const b = body instanceof Uint8Array ? body : new Uint8Array(body); const o = new Uint8Array([h, ...MQ.len(b.length)].concat([])); const r = new Uint8Array(o.length + b.length); r.set(o); r.set(b, o.length); if (this.ws && this.ws.readyState === 1) this.ws.send(r); }
    async connect() {
      for (const url of this.urls) { try { await this.open(url); this.url = url; return url; } catch (e) { } }
      throw new Error('No se puede conectar con el buscador de partidas (¿sin Internet?)');
    }
    open(url) {
      return new Promise((ok, ko) => {
        let user = null, pass = null; const mu = url.match(/^(wss?:\/\/)([^:@\/]+):([^@\/]*)@(.*)$/); if (mu) { user = mu[2]; pass = mu[3]; url = mu[1] + mu[4]; }
        let ws; try { ws = new WebSocket(url, 'mqtt'); } catch (e) { return ko(e); }
        ws.binaryType = 'arraybuffer'; const to = setTimeout(() => { ko(new Error('timeout')); try { ws.close(); } catch (e) { } }, 6000);
        ws.onopen = () => { this.ws = ws; const cid = MQ.str('brr' + rid(10));
          if (user) this.pkt(0x10, [...MQ.str('MQTT'), 4, 0xC2, 0, 60, ...cid, ...MQ.str(user), ...MQ.str(pass)]); else this.pkt(0x10, [...MQ.str('MQTT'), 4, 0x02, 0, 60, ...cid]); };
        ws.onerror = () => { clearTimeout(to); ko(new Error('error')); };
        ws.onclose = () => { clearTimeout(this.pingT); if (this.ws === ws) { this.ws = null; this.onclose && this.onclose(); } };
        ws.onmessage = ev => { const d = new Uint8Array(ev.data), b = new Uint8Array(this.buf.length + d.length); b.set(this.buf); b.set(d, this.buf.length); this.buf = b; this.parse(() => { clearTimeout(to); ok(); }); };
        this.pingT = setInterval(() => this.pkt(0xC0, []), 25000);
      });
    }
    parse(onConnack) {
      for (;;) {
        const b = this.buf; if (b.length < 2) return; let mul = 1, n = 0, i = 1, d;
        do { if (i >= b.length) return; d = b[i++]; n += (d & 127) * mul; mul *= 128; } while (d & 128);
        if (b.length < i + n) return; const h = b[0], body = b.subarray(i, i + n); this.buf = b.slice(i + n);
        const type = h >> 4;
        if (type === 2) onConnack();
        else if (type === 3) { const tl = (body[0] << 8) | body[1], topic = td.decode(body.subarray(2, 2 + tl)); let o = 2 + tl; if ((h >> 1) & 3) o += 2;
          const payload = td.decode(body.subarray(o)); for (const s of this.subs) if (MQ.match(s.f, topic)) try { s.cb(topic, payload); } catch (e) { console.error(e); } }
      }
    }
    static match(f, t) { const F = f.split('/'), X = t.split('/'); for (let i = 0; i < F.length; i++) { if (F[i] === '#') return true; if (F[i] !== '+' && F[i] !== X[i]) return false; } return F.length === X.length; }
    sub(f, cb) { this.subs.push({ f, cb }); const id = this.pid++ & 0xffff; this.pkt(0x82, [id >> 8, id & 255, ...MQ.str(f), 0]); }
    unsub(f) { this.subs = this.subs.filter(s => s.f !== f); const id = this.pid++ & 0xffff; this.pkt(0xA2, [id >> 8, id & 255, ...MQ.str(f)]); }
    pub(topic, payload, retain = false) { const p = te.encode(payload); const body = new Uint8Array([...MQ.str(topic), ...p]); this.pkt(0x30 | (retain ? 1 : 0), body); }
    close() { try { this.pkt(0xE0, []); this.ws && this.ws.close(); } catch (e) { } this.ws = null; }
  }
  BRR.MQ = MQ;

  BRR.NetP2P = class {
    constructor(brokers) { this.brokers = brokers || window.BRR_BROKERS || BROKERS; this.h = {}; this.id = rid(6); this.room = null; this.members = []; this.rooms = new Map(); this.mq = null; this.links = new Map(); }
    on(t, fn) { (this.h[t] = this.h[t] || []).push(fn); }
    emit(t, m) { for (const f of this.h[t] || []) try { f(m); } catch (e) { console.error(e); } }
    get connected() { return !!(this.mq && this.mq.ws && this.mq.ws.readyState === 1); }
    get isHost() { return !!this.host; }
    async connect(_url, name) {
      this.name = String(name || 'Piloto').slice(0, 20);
      if (this.connected) return { id: this.id };
      this.mq = new MQ(this.brokers); await this.mq.connect();
      this.mq.onclose = () => { this.emit('disconnect', {}); };
      this.mq.sub(T + 'sig/' + this.id, (t, p) => { try { this.onSig(JSON.parse(p)); } catch (e) { } });
      this.mq.sub(T + 'rooms/+', (t, p) => { const code = t.split('/').pop(); if (!p) { this.rooms.delete(code); return; } try { const r = JSON.parse(p); r.seen = Date.now(); this.rooms.set(code, r); } catch (e) { } });
      this.emit('hello', { t: 'hello', id: this.id }); return { id: this.id };
    }
    list() { const now = Date.now(); this.emit('list', { t: 'list', rooms: [...this.rooms.values()].filter(r => now - r.ts < 30000 && r.id !== this.id) }); }
    sig(to, m) { this.mq.pub(T + 'sig/' + to, JSON.stringify({ ...m, from: this.id })); }
    // ---------- como anfitrión: hace de servidor ----------
    create(o) {
      this.leave(true);
      const me = { id: this.id, name: this.name, data: cleanData(o.data), self: true };
      this.host = { id: this.id, name: String(o.name || this.name).slice(0, 30), pub: o.pub !== false, pass: o.pass || '', max: Math.max(2, Math.min(12, o.max | 0 || 6)), state: o.state || 'lobby', info: o.info || {}, members: new Map([[me.id, me]]), hostM: me, banned: new Set(o.banned || []) };
      this.lastRoom = null; this.migrating = null;
      this.adT = setInterval(() => this.advertise(), 5000); this.advertise(); this.roomUpdate();
      clearInterval(this.pingT); this.pingT = setInterval(() => { const h = this.host; if (h) for (const m of h.members.values()) if (!m.self && !m.lost) this.toMember(m, { t: 'ping' }); }, 1500);   // latido: los demás notan enseguida si el anfitrión desaparece
    }
    roomInfo() { const r = this.host; return { id: r.id, name: r.name, players: r.members.size, max: r.max, state: r.state, info: r.info || {}, host: r.hostM.name, pass: !!r.pass, ts: Date.now() }; }
    advertise() { const r = this.host; if (!r || !this.connected) return; this.mq.pub(T + 'rooms/' + r.id, r.pub ? JSON.stringify(this.roomInfo()) : '', true); }
    toMember(m, msg) { if (m.self) setTimeout(() => this.recv(msg), 0); else if (m.ch && m.ch.readyState === 'open') try { m.ch.send(JSON.stringify(msg)); } catch (e) { } }
    roomUpdate() { const r = this.host, info = { ...this.roomInfo(), pub: r.pub, secret: r.pass, banned: [...r.banned] }, mem = [...r.members.values()].map(m => ({ id: m.id, name: m.name, host: m === r.hostM, data: m.data || {}, lost: !!m.lost }));
      for (const m of r.members.values()) this.toMember(m, { t: 'room', room: info, you: m.id, members: mem }); }
    hostMsg(m, msg) {   // lo mismo que onMsg de server/brr-server.js
      const r = this.host; if (!r) return;
      switch (msg.t) {
        case 'data': m.data = Object.assign(m.data || {}, cleanData(msg.data)); this.roomUpdate(); break;
        case 'info': if (m === r.hostM) { r.info = msg.info || {}; if (msg.state) r.state = msg.state; this.roomUpdate(); this.advertise(); } break;
        case 'chat': for (const o of r.members.values()) this.toMember(o, { t: 'chat', from: m.name, id: m.id, text: String(msg.text || '').slice(0, 200) }); break;
        case 'g': { const out = { t: 'g', from: m.id, d: msg.d }; for (const o of r.members.values()) if (o !== m && (!msg.to || o.id === msg.to)) this.toMember(o, out); break; }
        case 'leave': m.left = true; this.dropMember(m); break;
        case 'kick': if (m === r.hostM) { const v = r.members.get(msg.id); if (v && !v.self) { r.banned.add(v.id); this.toMember(v, { t: 'closed', why: 'El anfitrión te ha expulsado de la partida', kicked: 1 }); setTimeout(() => this.dropMember(v, true), 300); } } break;
      }
    }
    // si se corta sin despedirse, se le guarda el sitio 30 s por si vuelve (reconexión)
    dropMember(m, now) { const r = this.host; if (!r || !r.members.has(m.id) || m.self || r.members.get(m.id) !== m) return;
      if (!now && !m.left) { if (m.lost) return; m.lost = Date.now(); this.roomUpdate(); m.lostT = setTimeout(() => { if (m.lost) this.dropMember(m, true); }, 30000); return; }
      r.members.delete(m.id); clearTimeout(m.lostT); try { m.pc && m.pc.close(); } catch (e) { }
      for (const o of r.members.values()) this.toMember(o, { t: 'left', id: m.id }); this.roomUpdate(); this.advertise(); }
    ping(code) { if (this.connected) this.sig(code, { type: 'ping', ts: Date.now() }); }   // señal aproximada hasta el anfitrión (ida y vuelta por el buzón)
    async onSig(s) {
      if (s.type === 'ping') { if (this.host) this.sig(s.from, { type: 'pong', ts: s.ts }); return; }
      if (s.type === 'pong') { if (typeof s.ts === 'number') this.emit('pong', { t: 'pong', id: s.from, ms: Math.max(1, Date.now() - s.ts) }); return; }
      if (s.type === 'error') { this.emit('error', { t: 'error', msg: s.msg }); this.joining = null; return; }
      if (this.host && s.type === 'offer') {   // alguien quiere entrar
        const r = this.host;
        if (r.banned.has(s.from)) return this.sig(s.from, { type: 'error', msg: 'No puedes entrar en esta partida' });
        const old = r.members.get(s.from);   // vuelve alguien que se había cortado (o el resto tras cambiar de anfitrión): conserva su sitio
        if (r.pass && r.pass !== s.pass && !old) return this.sig(s.from, { type: 'error', msg: 'Contraseña incorrecta' });
        if (r.members.size >= r.max && !old) return this.sig(s.from, { type: 'error', msg: 'La partida está llena' });
        if (old) { clearTimeout(old.lostT); try { old.pc && old.pc.close(); } catch (e) { } r.members.delete(s.from); }
        const m = { id: s.from, name: String(s.name || 'Piloto').slice(0, 20), data: (old && old.data) || cleanData(s.data) };
        const pc = new RTCPeerConnection(ICE); m.pc = pc; this.links.set(s.from, pc);
        pc.onicecandidate = e => { if (e.candidate) this.sig(s.from, { type: 'ice', c: e.candidate }); };
        pc.ondatachannel = e => { const ch = e.channel; m.ch = ch;
          ch.onopen = () => { r.members.set(m.id, m); this.roomUpdate(); this.advertise(); };
          ch.onmessage = ev => { try { this.hostMsg(m, JSON.parse(ev.data)); } catch (x) { } };
          ch.onclose = () => this.dropMember(m); };
        pc.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) setTimeout(() => { if (pc.connectionState !== 'connected') this.dropMember(m); }, pc.connectionState === 'disconnected' ? 4000 : 0); };
        await pc.setRemoteDescription(s.sdp); const a = await pc.createAnswer(); await pc.setLocalDescription(a);
        this.sig(s.from, { type: 'answer', sdp: pc.localDescription }); return;
      }
      const pc = this.links.get(s.from); if (!pc) return;
      if (s.type === 'answer') await pc.setRemoteDescription(s.sdp).catch(() => { });
      else if (s.type === 'ice') await pc.addIceCandidate(s.c).catch(() => { });
    }
    // ---------- como jugador: entrar en la partida de otro ----------
    async join(code, pass, data, quiet) {
      code = String(code || '').trim().toUpperCase(); if (!code) return; this.leave(true, quiet);
      if (code === this.id) return; this.joinArgs = { code, pass, data };
      const pc = new RTCPeerConnection(ICE), ch = pc.createDataChannel('brr', { ordered: true });
      this.links.set(code, pc); this.joining = code;
      pc.onicecandidate = e => { if (e.candidate) this.sig(code, { type: 'ice', c: e.candidate }); };
      ch.onopen = () => { this.ch = ch; this.joining = null; this.lastRx = Date.now(); clearInterval(this.wdT);
        this.wdT = setInterval(() => { if (this.ch !== ch) { clearInterval(this.wdT); return; } if (Date.now() - this.lastRx > 7000) { clearInterval(this.wdT); this.ch = null; try { ch.close(); } catch (e) { } if (this.room && !this.closedOk) this.lostHost(); } }, 1000);
        if (this.reconnecting) { this.reconnecting = null; this.emit('netstate', { ok: true, msg: 'Conexión recuperada' }); } };
      ch.onmessage = ev => { this.lastRx = Date.now(); try { this.recv(JSON.parse(ev.data)); } catch (e) { } };
      ch.onclose = () => { if (this.ch !== ch) return; this.ch = null; if (this.room && !this.closedOk) this.lostHost(); };
      const o = await pc.createOffer(); await pc.setLocalDescription(o);
      this.sig(code, { type: 'offer', sdp: pc.localDescription, name: this.name, pass, data });
      setTimeout(() => { if (this.joining === code) { this.joining = null; if (!quiet) this.emit('error', { t: 'error', msg: 'No se ha podido conectar con esa partida (¿código correcto? A veces los routers bloquean la conexión directa).' }); else this.emit('joinfail', { code }); } }, quiet ? 6000 : 15000);
    }
    recv(m) {   // mensajes del "servidor" (el anfitrión)
      if (m.t === 'ping') return;
      if (m.t === 'room') { this.room = m.room; this.members = m.members; this.lastRoom = { room: m.room, members: m.members }; this.closedOk = false; }
      if (m.t === 'closed') { if (m.kicked) { this.closedOk = true; this.room = null; this.members = []; this.lastRoom = null; this.emit('closed', m); return; }
        this.lostHost(true); return; }   // el anfitrión se va: otro ocupa su lugar
      this.emit(m.t, m);
    }
    // se ha perdido el anfitrión: primero se intenta volver a conectar; si no vuelve (o se ha ido), el siguiente jugador pasa a ser anfitrión
    lostHost(gone) {
      const L = this.lastRoom; if (!L) { this.room = null; this.members = []; this.emit('closed', { t: 'closed', why: 'Se ha perdido la conexión con el anfitrión' }); return; }
      const oldHost = (L.members.find(x => x.host) || {}).id, rest = L.members.filter(x => x.id !== oldHost && !x.lost).map(x => x.id).sort();
      const migrate = () => {
        const nh = rest[0]; if (!nh) { this.room = null; this.members = []; this.lastRoom = null; this.emit('closed', { t: 'closed', why: 'La partida se ha cerrado' }); return; }
        const nm = (L.members.find(x => x.id === nh) || {}).name || '?'; this.emit('netstate', { ok: false, msg: 'El anfitrión se ha ido: ' + nm + ' pasa a ser el anfitrión…', migrate: nh });
        if (nh === this.id) {
          const R = L.room, me = L.members.find(x => x.id === this.id) || {};
          this.create({ name: R.name, pub: R.pub !== false, pass: R.secret || '', max: R.max, info: R.info, state: R.state, banned: R.banned, data: me.data });
          this.emit('becamehost', { prevMembers: L.members.filter(x => x.id !== oldHost && x.id !== this.id) });
        } else { let n = 0; const tryJoin = () => { if (this.ch || this.host || ++n > 8) { if (!this.ch && !this.host) { this.room = null; this.lastRoom = null; this.emit('closed', { t: 'closed', why: 'No se ha podido seguir en la partida' }); } return; }
            const me = L.members.find(x => x.id === this.id) || {}; this.join(nh, L.room.secret || '', me.data, true); setTimeout(tryJoin, 3500); }; setTimeout(tryJoin, 1500); }
      };
      if (gone) return migrate();
      // reconexión: unos intentos con el mismo anfitrión antes de dar la partida por perdida
      this.reconnecting = Date.now(); this.emit('netstate', { ok: false, msg: 'Se ha cortado la conexión con el anfitrión. Reconectando…' });
      let n = 0; const again = () => { if (this.ch || !this.reconnecting) return; if (++n > 3) { this.reconnecting = null; return migrate(); }
        const a = this.joinArgs; if (a) this.join(a.code, a.pass, a.data, true); setTimeout(again, 3000); };
      setTimeout(again, 800);
    }
    kick(id) { this.send({ t: 'kick', id }); }
    send(msg) {
      if (msg.t === 'lbget' || msg.t === 'lbput') return this.lb(msg);
      if (this.host) return this.hostMsg(this.host.hostM, msg);
      if (this.ch && this.ch.readyState === 'open') this.ch.send(JSON.stringify(msg));
    }
    data(d) { this.send({ t: 'data', data: d }); }
    info(info, state) { this.send({ t: 'info', info, state }); }
    chat(text) { this.send({ t: 'chat', text }); }
    game(d, to) { this.send({ t: 'g', d, to }); }
    leave(silent, keepRoom) {
      if (!keepRoom) { this.lastRoom = null; this.reconnecting = null; this.closedOk = true; }
      if (this.host) { const r = this.host; for (const m of r.members.values()) if (!m.self) { this.toMember(m, { t: 'closed', why: 'El anfitrión se ha ido' }); setTimeout(() => { try { m.pc.close(); } catch (e) { } }, 300); }
        clearInterval(this.adT); clearInterval(this.pingT); if (this.connected) this.mq.pub(T + 'rooms/' + r.id, '', true); this.host = null; }
      else if (this.ch) { try { this.ch.send(JSON.stringify({ t: 'leave' })); } catch (e) { } const c = this.ch; this.ch = null; setTimeout(() => { try { c.close(); } catch (e) { } }, 200); }
      for (const pc of this.links.values()) if (!silent) try { pc.close(); } catch (e) { }
      this.links.clear(); if (!keepRoom) { this.room = null; this.members = []; }
      if (!silent) this.emit('left', { t: 'left', id: this.id });
    }
    // ---------- clasificación de contrarreloj: un mensaje "retenido" por circuito en el buzón público ----------
    lb(msg) {
      if (!this.connected) return; const lv = String(msg.level || '').toUpperCase(), topic = T + 'lb/' + lv;
      const got = rows => { this.mq.unsub(topic); return rows; };
      let done = false; const fin = rows => { if (done) return; done = true; got(rows);
        if (msg.t === 'lbput' && msg.row && msg.row.lap > 5) { const R = msg.row, old = rows.find(x => x.name === R.name && x.veh === R.veh);
          if (!old || old.lap > R.lap) { rows = rows.filter(x => x !== old); rows.push({ ...R, t: Date.now() }); rows.sort((x, y) => x.lap - y.lap); rows = rows.slice(0, 50); this.mq.pub(topic, JSON.stringify(rows), true); } }
        this.emit('lb', { t: 'lb', level: lv, rows: rows.slice(0, 20) }); };
      this.mq.sub(topic, (t, p) => { let r = []; try { r = JSON.parse(p) || []; } catch (e) { } fin(Array.isArray(r) ? r : []); });
      setTimeout(() => fin([]), 2500);   // sin mensaje retenido: aún no hay tiempos
    }
  };

  // ---------- conmutador: online sin servidor (por defecto) o servidor propio (avanzado, ws://...) ----------
  BRR.NetMux = class {
    constructor() { this.p2p = new BRR.NetP2P(); this.srv = new BRR.Net(); this.cur = this.p2p; }
    on(t, fn) { this.p2p.on(t, fn); this.srv.on(t, fn); }
    use(kind) { const n = kind === 'server' ? this.srv : this.p2p; if (n !== this.cur) { try { this.cur.leave && this.cur.room && this.cur.leave(); } catch (e) { } this.cur = n; } }
    get mode() { return this.cur === this.srv ? 'server' : 'p2p'; }
    get id() { return this.cur.id; } get room() { return this.cur.room; } get members() { return this.cur.members; }
    get connected() { return this.cur.connected; } get isHost() { return this.cur.isHost; }
    connect(url, name) { if (url && /^wss?:\/\//.test(url)) { this.use('server'); return this.srv.connect(url, name); } this.use('p2p'); return this.p2p.connect(null, name); }
    list() { this.cur.list(); } ping(id) { if (this.cur.ping) this.cur.ping(id); } create(o) { this.cur.create(o); } join(id, pass, data) { this.cur.join(id, pass, data); } leave() { this.cur.leave(); }
    kick(id) { this.cur.kick ? this.cur.kick(id) : this.cur.send({ t: 'kick', id }); }
    data(d) { this.cur.data(d); } info(i, s) { this.cur.info(i, s); } chat(t) { this.cur.chat(t); } game(d, to) { this.cur.game(d, to); } send(m) { this.cur.send(m); }
  };
})();
