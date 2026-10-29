// Red: conexión con el servidor de Big Red Racing (lobby, salas y reenvío de la carrera)
"use strict";
(function () {
  const BRR = window.BRR;
  BRR.Net = class {
    constructor() { this.ws = null; this.h = {}; this.id = null; this.room = null; this.members = []; }
    on(t, fn) { (this.h[t] = this.h[t] || []).push(fn); }
    emit(t, m) { for (const f of this.h[t] || []) try { f(m); } catch (e) { console.error(e); } }
    connect(url, name) {
      this.close();
      return new Promise((ok, ko) => {
        let ws; try { ws = new WebSocket(url); } catch (e) { return ko(new Error('Dirección no válida')); }
        this.ws = ws; const to = setTimeout(() => { ko(new Error('El servidor no responde')); try { ws.close(); } catch (e) { } }, 6000);
        ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', name }));
        ws.onerror = () => { clearTimeout(to); ko(new Error('No se puede conectar con ' + url)); };
        ws.onclose = () => { this.emit('disconnect', {}); this.room = null; };
        ws.onmessage = ev => {
          let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
          if (m.t === 'hello') { clearTimeout(to); this.id = m.id; ok(m); }
          if (m.t === 'room') { this.room = m.room; this.members = m.members; }
          if (m.t === 'pong') { if (typeof m.ts !== 'number') return; m = { t: 'pong', id: m.id, ms: Math.max(1, Date.now() - m.ts) }; }
          if (m.t === 'closed') { this.room = null; this.members = []; }
          this.emit(m.t, m);
        };
      });
    }
    get connected() { return this.ws && this.ws.readyState === 1; }
    get isHost() { return !!(this.members.find(x => x.id === this.id) || {}).host; }
    send(m) { if (this.connected) this.ws.send(JSON.stringify(m)); }
    list() { this.send({ t: 'list' }); }
    ping(id) { this.send({ t: 'ping', id, ts: Date.now() }); }
    create(o) { this.send({ t: 'create', ...o }); }
    join(id, pass, data) { this.send({ t: 'join', id, pass, data }); }
    leave() { this.send({ t: 'leave' }); this.room = null; this.members = []; }
    data(d) { this.send({ t: 'data', data: d }); }
    info(info, state) { this.send({ t: 'info', info, state }); }
    chat(text) { this.send({ t: 'chat', text }); }
    game(d, to) { this.send({ t: 'g', d, to }); }
    close() { if (this.ws) try { this.ws.close(); } catch (e) { } this.ws = null; }
  };
})();
