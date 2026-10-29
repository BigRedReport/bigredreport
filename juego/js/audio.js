// Sonido con Web Audio: efectos y voces originales (WAV) y música de las pistas de audio del CD
"use strict";
(function () {
  const BRR = window.BRR;
  BRR.Audio = class {
    constructor(files) {
      this.files = files; this.cache = new Map(); this.ctx = null;
      // mezcla: general, música, voces, efectos, motores, interfaz (menús) y ambiente
      this.vol = { master: 1, sfx: 0.8, music: 0.6, voice: 1, engine: 0.8, ui: 0.7, amb: 0.6 };
      this.voiceBusyUntil = 0; this.musicSource = 'cd'; this.userTracks = []; this.loops = [];
    }
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      const c = this.ctx = new C(); this.gMaster = c.createGain(); this.gMaster.connect(c.destination);
      const g = (to = this.gMaster) => { const x = c.createGain(); x.connect(to); return x; };
      this.gSfx = g(); this.gMusic = g(); this.gVoice = g(); this.gEngine = g(); this.gUI = g(); this.gAmb = g(); this.gHorn = g(this.gSfx);
      // eco de túnel: envío a una reverberación (respuesta sintética), cuánto según dónde está la cámara
      this.rev = c.createConvolver(); this.rev.buffer = this.impulse(1.6, 2.5); this.revOut = g(); this.revOut.gain.value = 0; this.rev.connect(this.revOut);
      for (const b of [this.gSfx, this.gEngine, this.gAmb]) b.connect(this.rev);
      this.setVolumes(this.vol);
    }
    impulse(sec, decay) { const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < 400 ? i / 400 : 1); } return b; }
    setReverb(k) { if (this.ctx) this.revOut.gain.setTargetAtTime(k * 0.9, this.ctx.currentTime, 0.15); }
    setVolumes(v) { Object.assign(this.vol, v); if (!this.ctx) return; const V = this.vol;
      this.gMaster.gain.value = V.master ?? 1; this.gSfx.gain.value = V.sfx; this.gMusic.gain.value = V.music; this.gVoice.gain.value = V.voice;
      this.gEngine.gain.value = V.engine ?? V.sfx; this.gUI.gain.value = V.ui ?? V.sfx; this.gAmb.gain.value = V.amb ?? V.sfx;
      if (this.music && V.music <= 0) this.stopMusic(); }
    bus(name) { return { voice: this.gVoice, ui: this.gUI, engine: this.gEngine, amb: this.gAmb, horn: this.gHorn, music: this.gMusic }[name] || this.gSfx; }
    // escucha para el sonido posicional (cámara del jugador); con pantalla partida no hay oyente único: sin panorama
    setListener(pos, fwd, up, on = true) {
      this.spatial = on; if (!this.ctx || !on) return; const L = this.ctx.listener, t = this.ctx.currentTime;
      if (L.positionX) { L.positionX.setTargetAtTime(pos[0], t, 0.02); L.positionY.setTargetAtTime(pos[1], t, 0.02); L.positionZ.setTargetAtTime(pos[2], t, 0.02);
        L.forwardX.setTargetAtTime(fwd[0], t, 0.02); L.forwardY.setTargetAtTime(fwd[1], t, 0.02); L.forwardZ.setTargetAtTime(fwd[2], t, 0.02);
        L.upX.setTargetAtTime(up[0], t, 0.02); L.upY.setTargetAtTime(up[1], t, 0.02); L.upZ.setTargetAtTime(up[2], t, 0.02); }
      else { L.setPosition(...pos); L.setOrientation(...fwd, ...up); }
    }
    panner(pos) { const p = this.ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 6; p.rolloffFactor = 1.1; p.maxDistance = 400; this.movePanner(p, pos); return p; }
    movePanner(p, pos) { if (p.positionX) { const t = this.ctx.currentTime; p.positionX.setTargetAtTime(pos[0], t, 0.03); p.positionY.setTargetAtTime(pos[1], t, 0.03); p.positionZ.setTargetAtTime(pos[2], t, 0.03); } else p.setPosition(...pos); }
    async buf(rel) {
      if (!this.ctx) return null; rel = rel.toUpperCase();
      if (!this.cache.has(rel)) this.cache.set(rel, (async () => {
        const f = this.files.path(rel); if (!f) return null;
        try { return await this.ctx.decodeAudioData(await f.arrayBuffer()); } catch (e) { return null; }
      })());
      return this.cache.get(rel);
    }
    // pos: sonido en un punto del mundo (si hay oyente único); si no, se usa tal cual (con el volumen ya atenuado por distancia)
    async play(rel, { vol = 1, rate = 1, bus = 'sfx', pos = null } = {}) {
      const b = await this.buf(rel); if (!b) return null;
      const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = b; s.playbackRate.value = rate; g.gain.value = vol;
      s.connect(g); let o = g; if (pos && this.spatial) { const p = this.panner(pos); g.connect(p); o = p; }
      o.connect(this.bus(bus)); s.start(); return { s, dur: b.duration / rate };
    }
    async loop(rel, vol = 0, bus = 'sfx', pos = null) {
      const b = await this.buf(rel); if (!b) return null;
      const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = b; s.loop = true; g.gain.value = vol;
      s.connect(g); let p = null; if (pos) { p = this.panner(pos); g.connect(p); p.connect(this.bus(bus)); } else g.connect(this.bus(bus)); s.start();
      return { set: (v, r, at) => { const t = this.ctx.currentTime; g.gain.setTargetAtTime(v, t, 0.05); if (r) s.playbackRate.setTargetAtTime(r, t, 0.05); if (p && at) this.movePanner(p, at); }, stop: () => { try { s.stop(); } catch (e) { } } };
    }
    // motor con dos capas de la misma muestra: una grave (a media velocidad, filtrada) que manda a bajas vueltas y la normal arriba,
    // un filtro que se abre al acelerar (al soltar suena ahogado) y una leve vibración; así los cambios de régimen suenan suaves
    async engine(rel, bus = 'engine') {
      const b = await this.buf(rel); if (!b) return null; const c = this.ctx, mk = () => { const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.loopStart = 0; s.loopEnd = b.duration; return s; };
      const s1 = mk(), s2 = mk(), g1 = c.createGain(), g2 = c.createGain(), lp = c.createBiquadFilter(), lp2 = c.createBiquadFilter(), out = c.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.5; lp2.type = 'lowpass'; lp2.frequency.value = 900; g1.gain.value = 0; g2.gain.value = 0; out.gain.value = 0;
      s1.connect(lp2); lp2.connect(g1); s2.connect(g2); g1.connect(lp); g2.connect(lp); lp.connect(out); out.connect(this.bus(bus));
      try { s2.start(0, b.duration * 0.37); } catch (e) { s2.start(); } s1.start();
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 7; lg.gain.value = 0.012; lfo.connect(lg); lg.connect(s2.playbackRate); lg.connect(s1.playbackRate); lfo.start();
      return { set: (v, r, thr = 0.5) => { const t = c.currentTime, x = Math.max(0, Math.min(1, (r - 0.8) / 1.1));
          out.gain.setTargetAtTime(v, t, 0.06); g1.gain.setTargetAtTime(0.9 * (1 - x) + 0.1, t, 0.08); g2.gain.setTargetAtTime(0.35 + 0.65 * x, t, 0.08);
          s1.playbackRate.setTargetAtTime(r * 0.62, t, 0.07); s2.playbackRate.setTargetAtTime(r, t, 0.07); lp.frequency.setTargetAtTime(900 + 3200 * thr + 1500 * x, t, 0.1); lfo.frequency.setTargetAtTime(5 + 9 * x, t, 0.2); },
        stop: () => { for (const n of [s1, s2, lfo]) try { n.stop(); } catch (e) { } } };
    }
    // ambiente: viento según la velocidad (ruido filtrado), en su propio canal
    ambient() {
      if (!this.ctx || this.amb) return this.amb; const c = this.ctx, n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
      let last = 0; for (let i = 0; i < n; i++) { last = last * 0.98 + (Math.random() * 2 - 1) * 0.02; d[i] = last * 6; }
      const s = c.createBufferSource(); s.buffer = b; s.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6;
      const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.gAmb); s.start();
      return this.amb = { set: (v, fr) => { const t = c.currentTime; g.gain.setTargetAtTime(v, t, 0.2); f.frequency.setTargetAtTime(fr, t, 0.2); } };
    }
    // turbo: soplido sintetizado (ruido que barre de grave a agudo + golpe grave), sale también en los rivales con su posición
    boost(vol = 0.8, pos = null) {
      if (!this.ctx) return; const c = this.ctx, t = c.currentTime, dur = 1.3;
      if (!this._nz) { const n = c.sampleRate * 1.5 | 0, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this._nz = b; }
      const s = c.createBufferSource(); s.buffer = this._nz; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.3;
      f.frequency.setValueAtTime(350, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.35); f.frequency.exponentialRampToValueAtTime(900, t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.05); g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.4);
      const og = c.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.03); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
      s.connect(f); f.connect(g); o.connect(lp); lp.connect(og); const out = c.createGain(); g.connect(out); og.connect(out);
      if (pos && this.spatial) { const p = this.panner(pos); out.connect(p); p.connect(this.bus('sfx')); } else out.connect(this.bus('sfx'));
      s.start(t); s.stop(t + dur + 0.05); o.start(t); o.stop(t + 0.7);
    }
    // bocina sintetizada sencilla (rivales): ver horns.js para todas las demás
    horn(pitch = 1, vol = 0.5, dur = null, type = 'normal', pos = null) {
      const h = BRR.playHorn ? BRR.playHorn(this, type, pitch, vol, { dur, pos }) : null; return h || { stop() { } };
    }
    // voces del comentarista: una a la vez, con pausa mínima entre frases y sin repetir la misma categoría seguido
    async voice(rel, force = false) {
      if (!this.ctx) return; const now = this.ctx.currentTime, cat = rel.split('/').pop().replace(/\d*\.WAV$/i, '');
      this.catT = this.catT || {};
      if (!force && (now < this.voiceBusyUntil || now < (this.catT[cat] || 0))) return;
      this.voiceBusyUntil = now + 4; this.catT[cat] = now + 15;
      const r = await this.play(rel, { bus: 'voice' }); if (r) this.voiceBusyUntil = now + r.dur + 4;
    }
    stopAll() { for (const l of this.loops || []) l && l.stop(); this.loops = []; if (this.amb) this.amb.set(0, 500); this.setReverb(0); }

    // ---------- música del CD (pistas de audio de la imagen .cue/.img) ----------
    cdTracks() {
      if (this._cd !== undefined) return this._cd;
      this._cd = null; const cue = this.files.list('.CUE')[0]; if (!cue) return null;
      return this._cd = (async () => {
        const txt = BRR.text(await this.files.bytes(cue)); let fileName = null, cur = null; const tracks = [];
        for (const l of txt.split(/\r?\n/)) {
          let m;
          if ((m = l.match(/FILE\s+"([^"]+)"/i))) fileName = m[1].toUpperCase().split(/[\\/]/).pop();
          else if ((m = l.match(/TRACK\s+(\d+)\s+(\S+)/i))) tracks.push(cur = { n: +m[1], type: m[2].toUpperCase(), idx: {} });
          else if ((m = l.match(/INDEX\s+(\d+)\s+(\d+):(\d+):(\d+)/i)) && cur) cur.idx[+m[1]] = ((+m[2] * 60 + +m[3]) * 75 + +m[4]) * 2352;
        }
        const img = fileName && this.files.files.get(fileName); if (!img) return null;
        const audio = [];
        tracks.forEach((t, i) => {
          if (t.type !== 'AUDIO' || t.idx[1] === undefined) return;
          const nx = tracks[i + 1], end = nx ? (nx.idx[0] ?? nx.idx[1]) : img.size;
          audio.push({ n: t.n, start: t.idx[1], end });
        });
        return { img, audio };
      })();
    }
    // pista de audio del CD por número (como en TOURN.TXT); loop para música, sin loop para las presentaciones habladas
    async cdBuffer(n) {
      const cd = await this.cdTracks(); if (!cd) return null;
      const tr = cd.audio.find(t => t.n === n); if (!tr) return null;
      this.cdCache = this.cdCache || new Map();
      if (!this.cdCache.has(n)) this.cdCache.set(n, (async () => {
        const raw = new Int16Array(await cd.img.slice(tr.start, tr.end - ((tr.end - tr.start) % 4)).arrayBuffer());
        const k = raw.length / 2, b = this.ctx.createBuffer(2, k, 44100), L = b.getChannelData(0), Rr = b.getChannelData(1);
        for (let i = 0; i < k; i++) { L[i] = raw[2 * i] / 32768; Rr[i] = raw[2 * i + 1] / 32768; }
        if (this.cdCache.size > 6) this.cdCache.delete(this.cdCache.keys().next().value);
        return b;
      })());
      return this.cdCache.get(n);
    }
    // música propia del jugador (lista de reproducción): suena en orden, una tras otra
    async playUser() {
      if (!this.userTracks.length) return false; if (this.musicTrack === 'u' && this.music) return 'u';
      this.stopMusic(); const token = this.musicToken = Symbol(); this.userIdx = ((this.userIdx ?? -1) + 1) % this.userTracks.length;
      let b = null; try { b = await this.ctx.decodeAudioData(await this.userTracks[this.userIdx].blob.arrayBuffer()); } catch (e) { }
      if (!b || token !== this.musicToken) return false;
      const s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.gMusic); s.start(); this.music = s; this.musicTrack = 'u';
      s.onended = () => { if (this.music === s) { this.music = null; this.musicTrack = null; this.playUser(); } }; return 'u';
    }
    async playTrack(n) {
      if (this.musicSource === 'off') { this.stopMusic(); return false; }
      if (this.musicSource === 'mias' && this.userTracks.length) return this.playUser();
      if (this.musicTrack === n && this.music) return n;
      this.stopMusic(); if (!this.ctx || this.vol.music <= 0) return false;
      const token = this.musicToken = Symbol(), b = await this.cdBuffer(n);
      if (!b || token !== this.musicToken) return false;
      const s = this.ctx.createBufferSource(); s.buffer = b; s.loop = true; s.connect(this.gMusic); s.start();
      this.music = s; this.musicTrack = n; return n;
    }
    async narrate(n) {   // presentación hablada del circuito (pista corta del CD), baja la música mientras habla
      this.stopNarration(); if (!this.ctx) return;
      const token = this.narToken = Symbol(), b = await this.cdBuffer(n);
      if (!b || token !== this.narToken) return;
      const s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.gVoice); s.start(); this.nar = s;
      const t = this.ctx.currentTime; this.gMusic.gain.setTargetAtTime(this.vol.music * 0.3, t, 0.2);
      s.onended = () => { if (this.nar === s) { this.nar = null; this.gMusic.gain.setTargetAtTime(this.vol.music, this.ctx.currentTime, 0.4); } };
    }
    stopNarration() { this.narToken = null; if (this.nar) { try { this.nar.stop(); } catch (e) { } this.nar = null; if (this.ctx) this.gMusic.gain.setTargetAtTime(this.vol.music, this.ctx.currentTime, 0.2); } }
    async playMusic(seed) {
      if (this.musicSource === 'off') return false;
      if ((this.musicSource === 'mias' || (this.musicSource === 'mezcla' && Math.random() < 0.5)) && this.userTracks.length) { this.stopMusic(); return this.playUser(); }
      const cd = await this.cdTracks(); if (!cd || !cd.audio.length) return false;
      const longs = cd.audio.filter(t => t.end - t.start > 44100 * 4 * 60);   // solo pistas largas (música)
      const l = longs.length ? longs : cd.audio;
      return this.playTrack(l[((seed % l.length) + l.length) % l.length].n);
    }
    stopMusic() { this.musicToken = null; this.musicTrack = null; if (this.music) { const m = this.music; this.music = null; try { m.onended = null; m.stop(); } catch (e) { } } }
  };
})();
