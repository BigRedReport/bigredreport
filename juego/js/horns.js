// Bocinas: sintetizadas con Web Audio (no hacen falta archivos), las muestras graciosas del propio juego original
// (carpeta SAMPLES) y una bocina propia que carga el jugador.
// hold: suena mientras se mantiene pulsado · si no, es un efecto que suena entero una vez por pulsación
"use strict";
(function () {
  const BRR = window.BRR;
  BRR.HORNS = [
    { id: 'normal', n: 'Normal', hold: 1 }, { id: 'aguda', n: 'Aguda', hold: 1 }, { id: 'grave', n: 'Grave', hold: 1 },
    { id: 'camion', n: 'Camión', hold: 1 }, { id: 'barco', n: 'Barco', hold: 1 }, { id: 'tren', n: 'Tren', hold: 1 },
    { id: 'policia', n: 'Policía', hold: 1 }, { id: 'ambulancia', n: 'Ambulancia', hold: 1 },
    { id: 'claxon', n: 'Claxon antiguo (¡auuga!)' }, { id: 'payaso', n: 'Bocina de payaso' }, { id: 'cucaracha', n: 'La cucaracha' },
    { id: 'trombon', n: 'Trombón triste' }, { id: 'boing', n: 'Muelle (boing)' }, { id: 'silbato', n: 'Silbato de émbolo' },
    { id: 'laser', n: 'Láser' }, { id: 'bici', n: 'Timbre de bici' },
    { id: 's:FART1', n: 'Pedo (del juego)' }, { id: 's:FART2', n: 'Pedo largo (del juego)' }, { id: 's:BURP1', n: 'Eructo (del juego)' },
    { id: 's:LAUGH', n: 'Risa (del juego)' }, { id: 's:PARROT', n: 'Loro (del juego)' }, { id: 's:BABY', n: 'Bebé (del juego)' },
    { id: 's:HEY', n: '¡Hey! (del juego)' }, { id: 's:OOH', n: '¡Ooh! (del juego)' }, { id: 's:SPIT', n: 'Escupitajo (del juego)' },
    { id: 'propia', n: 'Bocina propia' },
  ];
  // si no está el paquete de clips (horns_data.js), esas bocinas no aparecen
  // bocinas de clips (horns_data.js trae la lista y los sonidos): van antes de las del juego original
  { const at = BRR.HORNS.findIndex(h => h.id.startsWith('s:')); BRR.HORNS.splice(at, 0, ...(BRR.HORN_CLIP_LIST || []).filter(h => BRR.HORN_CLIPS && BRR.HORN_CLIPS[h.id]).map(h => ({ id: 'u:' + h.id, n: h.n }))); }
  BRR.hornInfo = id => BRR.HORNS.find(h => h.id === id) || BRR.HORNS[0];
  // bocinas que se quitaron: quien las tuviera pasa a la nueva equivalente
  BRR.HORN_RENAMED = { gato: 'u:kittie', vaca: 'u:cow', cerdo: 'u:goat', rana: 'u:monkey', pato: 'u:sheep' };
  // clips incluidos en el port (horns_data.js): se decodifican la primera vez que suenan
  async function clip(A, k) {
    A._clips = A._clips || {}; if (A._clips[k]) return A._clips[k];
    const src = BRR.HORN_CLIPS && BRR.HORN_CLIPS[k]; if (!src) return null;
    const bin = atob(src.slice(src.indexOf(',') + 1)), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return A._clips[k] = await A.ctx.decodeAudioData(u8.buffer);
  }

  // nodos auxiliares
  function out(A, vol, dest) { const c = A.ctx, g = c.createGain(); g.gain.value = 0; g.connect(dest || A._hornDest || A.gHorn || A.gSfx); return g; }
  function osc(c, type, f, t0, dest) { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); o.connect(dest); o.start(t0); return o; }
  function bp(c, f, q, dest) { const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; b.connect(dest); return b; }
  function lp(c, f, q, dest) { const b = c.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; b.Q.value = q || 0.7; b.connect(dest); return b; }
  function noise(c, t0, dest) { const n = c.sampleRate, b = c.createBuffer(1, n, n), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.connect(dest); s.start(t0); return s; }
  const env = (g, t, a, peak, hold, rel) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); if (hold != null) { g.gain.setValueAtTime(peak, t + a + hold); g.gain.linearRampToValueAtTime(0, t + a + hold + rel); } };
  const finish = (srcs, g, c, t) => { for (const s of srcs) try { s.stop(t + 0.3); } catch (e) { } setTimeout(() => { try { g.disconnect(); } catch (e) { } }, (t - c.currentTime + 0.5) * 1000); };

  // bocina continua: devuelve stop()
  function sustained(A, build, vol) {
    const c = A.ctx, t = c.currentTime, g = out(A); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.025);
    const srcs = build(c, t, g);
    return { stop: (w = 0) => { const t2 = c.currentTime + w; g.gain.cancelScheduledValues(t2); g.gain.setTargetAtTime(0, t2, 0.03); finish(srcs, g, c, t2); } };
  }
  const SYN = {
    normal: (A, p, v) => sustained(A, (c, t, g) => { const f = lp(c, 1800, 2, g); return [[340, 'sawtooth'], [428, 'square'], [341.5, 'sawtooth']].map(([fr, ty]) => osc(c, ty, fr * p, t, f)); }, v * 0.3),
    aguda: (A, p, v) => SYN.normal(A, p * 1.55, v * 0.85),
    grave: (A, p, v) => SYN.normal(A, p * 0.6, v * 1.15),
    camion: (A, p, v) => sustained(A, (c, t, g) => { const f = lp(c, 2200, 1.5, g); return [155, 185, 233, 156].map(fr => osc(c, 'sawtooth', fr * p, t, f)); }, v * 0.28),
    barco: (A, p, v) => sustained(A, (c, t, g) => { const f = lp(c, 420, 2, g); return [88, 89.5, 132].map(fr => osc(c, 'sawtooth', fr * p, t, f)); }, v * 0.6),
    tren: (A, p, v) => sustained(A, (c, t, g) => { const f = bp(c, 900, 0.8, g), n = bp(c, 2500, 1, g); const ng = c.createGain(); ng.gain.value = 0.15; ng.connect(n);
      return [...[277, 349, 415].map(fr => osc(c, 'triangle', fr * p, t, f)), noise(c, t, ng)]; }, v * 0.55),
    policia: (A, p, v) => sustained(A, (c, t, g) => { const f = lp(c, 2500, 1, g), o = osc(c, 'square', 650 * p, t, f);
      for (let k = 0; k < 40; k++) o.frequency.setValueAtTime((k % 2 ? 860 : 650) * p, t + k * 0.42); return [o]; }, v * 0.16),
    ambulancia: (A, p, v) => sustained(A, (c, t, g) => { const f = lp(c, 2500, 1, g), o = osc(c, 'triangle', 700 * p, t, f), l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = 0.9; lg.gain.value = 320 * p; l.connect(lg); lg.connect(o.frequency); l.start(t); return [o, l]; }, v * 0.3),
  };
  // efectos de una vez (devuelven duración)
  const ONE = {
    claxon: (A, p, v) => { const c = A.ctx, t = c.currentTime, g = out(A), f = bp(c, 900, 2.5, g), s = c.createWaveShaper(), cur = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = i / 128 - 1; cur[i] = Math.tanh(x * 4); } s.curve = cur; s.connect(f);
      const o = osc(c, 'sawtooth', 170 * p, t, s); o.frequency.linearRampToValueAtTime(430 * p, t + 0.35); o.frequency.setValueAtTime(430 * p, t + 0.55); o.frequency.linearRampToValueAtTime(390 * p, t + 0.75);
      env(g, t, 0.03, v * 0.35, 0.7, 0.08); finish([o], g, c, t + 0.85); return 0.85; },
    payaso: (A, p, v) => { const c = A.ctx, t0 = c.currentTime, g = out(A), f = bp(c, 1300, 3, g), srcs = [];
      for (const d of [0, 0.32]) { const t = t0 + d, o = osc(c, 'sawtooth', 470 * p, t, f); o.frequency.exponentialRampToValueAtTime(390 * p, t + 0.22); srcs.push(o);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.6, t + 0.02); g.gain.linearRampToValueAtTime(0, t + 0.24); o.stop(t + 0.26); }
      finish([], g, c, t0 + 0.6); return 0.6; },
    cucaracha: (A, p, v) => { const c = A.ctx, t0 = c.currentTime, g = out(A), f = lp(c, 2000, 2, g);
      // melodía tradicional (dominio público): sol sol sol do mi · sol sol sol do mi
      const N = [392, 392, 392, 523, 659, 0, 392, 392, 392, 523, 659], D = [0.12, 0.12, 0.12, 0.24, 0.32, 0.1, 0.12, 0.12, 0.12, 0.24, 0.5]; let t = t0;
      N.forEach((fr, i) => { if (fr) { const o1 = osc(c, 'square', fr * p, t, f), o2 = osc(c, 'sawtooth', fr * p * 1.26, t, f); const e = c.createGain(); o1.disconnect(); o2.disconnect(); o1.connect(e); o2.connect(e); e.connect(f);
        e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(1, t + 0.01); e.gain.setValueAtTime(1, t + D[i] - 0.03); e.gain.linearRampToValueAtTime(0, t + D[i]); o1.stop(t + D[i]); o2.stop(t + D[i]); }
        t += D[i]; });
      g.gain.value = v * 0.18; finish([], g, c, t); return t - t0; },
    trombon: (A, p, v) => { const c = A.ctx, t0 = c.currentTime, g = out(A), f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6; f.connect(g);
      const N = [233, 220, 208, 196], D = [0.42, 0.42, 0.42, 1.3]; let t = t0; const o = osc(c, 'sawtooth', N[0] * p, t, f), lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 5.5; lg.gain.value = 0; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t0);
      N.forEach((fr, i) => { o.frequency.setValueAtTime(fr * p, t); f.frequency.setValueAtTime(350, t); f.frequency.linearRampToValueAtTime(1500, t + 0.15); f.frequency.linearRampToValueAtTime(500, t + D[i] - 0.02);
        g.gain.setValueAtTime(v * 0.45, t); g.gain.linearRampToValueAtTime(v * 0.3, t + D[i] - 0.03); if (i === 3) lg.gain.setValueAtTime(6 * p, t + 0.2); t += D[i]; });
      g.gain.linearRampToValueAtTime(0, t); finish([o, lfo], g, c, t); return t - t0; },
    boing: (A, p, v) => { const c = A.ctx, t = c.currentTime, g = out(A), o = osc(c, 'sine', 160 * p, t, g), l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = 14; lg.gain.setValueAtTime(140 * p, t); lg.gain.exponentialRampToValueAtTime(4, t + 0.7); l.connect(lg); lg.connect(o.frequency); l.start(t);
      o.frequency.linearRampToValueAtTime(330 * p, t + 0.7); env(g, t, 0.005, v * 0.7, 0.2, 0.5); finish([o, l], g, c, t + 0.75); return 0.75; },
    silbato: (A, p, v) => { const c = A.ctx, t = c.currentTime, g = out(A), o = osc(c, 'sine', 600 * p, t, g);
      o.frequency.exponentialRampToValueAtTime(1900 * p, t + 0.45); o.frequency.exponentialRampToValueAtTime(650 * p, t + 0.95); env(g, t, 0.04, v * 0.35, 0.85, 0.08); finish([o], g, c, t + 1); return 1; },
    laser: (A, p, v) => { const c = A.ctx, t0 = c.currentTime, g = out(A), srcs = [];
      for (const d of [0, 0.18]) { const t = t0 + d, o = osc(c, 'square', 2200 * p, t, g); o.frequency.exponentialRampToValueAtTime(140 * p, t + 0.16); o.stop(t + 0.17); srcs.push(o); }
      g.gain.setValueAtTime(v * 0.15, t0); finish([], g, c, t0 + 0.4); return 0.4; },
    bici: (A, p, v) => { const c = A.ctx, t0 = c.currentTime, g = out(A); g.gain.value = 1;
      for (const d of [0, 0.22]) for (const [fr, a] of [[2000, 1], [2760, 0.6], [5400, 0.3], [4100, 0.25]]) { const t = t0 + d, e = c.createGain(), o = osc(c, 'sine', fr * p, t, e); e.connect(g);
        e.gain.setValueAtTime(v * 0.18 * a, t); e.gain.exponentialRampToValueAtTime(0.0005, t + 0.9); o.stop(t + 0.95); }
      finish([], g, c, t0 + 1.2); return 1.2; },
    gato: (A, p, v) => { const c = A.ctx, t = c.currentTime, g = out(A), f = bp(c, 1000, 5, g), o = osc(c, 'sawtooth', 480 * p, t, f);
      o.frequency.linearRampToValueAtTime(720 * p, t + 0.25); o.frequency.linearRampToValueAtTime(430 * p, t + 0.7);
      f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1900, t + 0.25); f.frequency.linearRampToValueAtTime(800, t + 0.65);
      env(g, t, 0.06, v * 0.7, 0.45, 0.2); finish([o], g, c, t + 0.75); return 0.75; },
    vaca: (A, p, v) => { const c = A.ctx, t = c.currentTime, g = out(A), f = lp(c, 300, 6, g), o = osc(c, 'sawtooth', 125 * p, t, f);
      o.frequency.linearRampToValueAtTime(140 * p, t + 0.3); o.frequency.linearRampToValueAtTime(100 * p, t + 1.1);
      f.frequency.setValueAtTime(280, t); f.frequency.linearRampToValueAtTime(950, t + 0.35); f.frequency.linearRampToValueAtTime(320, t + 1.05);
      env(g, t, 0.12, v * 0.8, 0.85, 0.2); finish([o], g, c, t + 1.2); return 1.2; },
    cerdo: (A, p, v) => { const c = A.ctx, t0 = c.currentTime, g = out(A), f = bp(c, 900, 3, g), am = c.createGain(); am.connect(f);
      const o = osc(c, 'sawtooth', 170 * p, t0, am), n = c.createGain(); n.gain.value = 0.4; n.connect(am); const ns = noise(c, t0, n), l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = 38; lg.gain.value = 0.6; l.connect(lg); lg.connect(am.gain); am.gain.value = 0.5; l.start(t0);
      for (const d of [0, 0.26]) { const t = t0 + d; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.6, t + 0.03); g.gain.linearRampToValueAtTime(0, t + 0.19); o.frequency.setValueAtTime(190 * p, t); o.frequency.linearRampToValueAtTime(140 * p, t + 0.18); }
      finish([o, ns, l], g, c, t0 + 0.5); return 0.5; },
    rana: (A, p, v) => { const c = A.ctx, t0 = c.currentTime, g = out(A), f = bp(c, 420 * p, 4, g), o = osc(c, 'square', 28, t0, f);
      for (const d of [0, 0.45]) { const t = t0 + d; o.frequency.setValueAtTime(26, t); o.frequency.linearRampToValueAtTime(38, t + 0.3);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 1.2, t + 0.04); g.gain.linearRampToValueAtTime(0, t + 0.33); }
      finish([o], g, c, t0 + 0.85); return 0.85; },
    pato: (A, p, v) => { const c = A.ctx, t0 = c.currentTime, g = out(A), f = bp(c, 900, 4, g), o = osc(c, 'sawtooth', 230 * p, t0, f);
      for (const d of [0, 0.24]) { const t = t0 + d; o.frequency.setValueAtTime(240 * p, t); o.frequency.linearRampToValueAtTime(185 * p, t + 0.17);
        f.frequency.setValueAtTime(1300, t); f.frequency.linearRampToValueAtTime(650, t + 0.17); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.7, t + 0.015); g.gain.linearRampToValueAtTime(0, t + 0.18); }
      finish([o], g, c, t0 + 0.5); return 0.5; },
  };
  // id: tipo de bocina · pitch: variación por coche · vol · o.dur: para las continuas, cuánto dura (null = hasta stop) · o.custom: AudioBuffer propio
  BRR.playHorn = function (A, id, pitch = 1, vol = 0.8, o = {}) {
    if (!A || !A.ctx) return null; const info = BRR.hornInfo(id);
    let dest = null; if (o.pos && A.spatial) { dest = A.panner(o.pos); dest.connect(A.gHorn || A.gSfx); }
    // todo suena a través de un volumen propio: así se puede cortar al volver a pulsar (vuelve a empezar)
    const wrap = A.ctx.createGain(); wrap.connect(dest || A.gHorn || A.gSfx); A._hornDest = wrap;
    const cut = () => { try { const t = A.ctx.currentTime; wrap.gain.cancelScheduledValues(t); wrap.gain.setValueAtTime(wrap.gain.value, t); wrap.gain.linearRampToValueAtTime(0, t + 0.03); setTimeout(() => { try { wrap.disconnect(); } catch (e) { } }, 80); } catch (e) { } };
    try {
      if (id === 'propia' || id.startsWith('s:') || id.startsWith('u:')) {
        const go = async () => { const b = id === 'propia' ? A.customHorn : id.startsWith('u:') ? await clip(A, id.slice(2)).catch(() => null) : await A.buf('SAMPLES/' + id.slice(2) + '.WAV'); if (!b) return SYN.normal(A, pitch, vol).stop(0.3);
          if (h.dead) return; const s = A.ctx.createBufferSource(), g = A.ctx.createGain(); s.buffer = b; s.playbackRate.value = id === 'propia' || id.startsWith('u:') ? 1 : pitch; g.gain.value = vol; s.connect(g); g.connect(wrap); s.start(); };
        const h = { stop() { }, cut() { h.dead = true; cut(); }, oneShot: true }; go(); return h;
      }
      if (info.hold) { const h = SYN[id](A, pitch, vol); if (o.dur) h.stop(o.dur); h.cut = () => { try { h.stop(0.02); } catch (e) { } cut(); }; return h; }
      ONE[id](A, pitch, vol); return { stop() { }, cut, oneShot: true };
    } catch (e) { console.warn('bocina', e); return null; } finally { A._hornDest = null; }
  };
})();
