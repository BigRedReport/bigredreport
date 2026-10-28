// Big Red Report: navegación, reporte de fallos (GitHub Issues) y clasificaciones de contrarreloj (en directo)
(function () {
  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // repositorio: se deduce de la dirección (usuario.github.io/repo) y si no, el del proyecto
  let REPO = 'BigRedReport/bigredreport';
  try { const h = location.hostname, m = h.match(/^([^.]+)\.github\.io$/i); if (m) { const seg = location.pathname.split('/').filter(Boolean)[0]; REPO = m[1] + '/' + (seg && !/\.html?$/.test(seg) ? seg : m[1] + '.github.io'); } } catch (e) { }
  for (const a of document.querySelectorAll('a[href^="https://github.com/BigRedReport/bigredreport"]')) a.href = 'https://github.com/' + REPO;

  // idioma: la web está en español; los demás idiomas se sirven con la traducción automática de Google
  try {
    const F = {
      es: ['Español', '<rect width="30" height="20" fill="#c60b1e"/><rect y="5" width="30" height="10" fill="#ffc400"/>'],
      en: ['English', '<rect width="30" height="20" fill="#012169"/><path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0L30 20M30 0L0 20" stroke="#c8102e" stroke-width="1.6"/><path d="M15 0V20M0 10H30" stroke="#fff" stroke-width="6"/><path d="M15 0V20M0 10H30" stroke="#c8102e" stroke-width="3.4"/>'],
      fr: ['Français', '<rect width="30" height="20" fill="#fff"/><rect width="10" height="20" fill="#0055a4"/><rect x="20" width="10" height="20" fill="#ef4135"/>'],
      de: ['Deutsch', '<rect width="30" height="20" fill="#000"/><rect y="6.67" width="30" height="6.67" fill="#dd0000"/><rect y="13.33" width="30" height="6.67" fill="#ffce00"/>'],
      it: ['Italiano', '<rect width="30" height="20" fill="#fff"/><rect width="10" height="20" fill="#009246"/><rect x="20" width="10" height="20" fill="#ce2b37"/>'],
      pt: ['Português', '<rect width="30" height="20" fill="#ff0000"/><rect width="12" height="20" fill="#006600"/><circle cx="12" cy="10" r="4" fill="#ffcc00"/><circle cx="12" cy="10" r="2.4" fill="#fff" stroke="#ff0000" stroke-width="1"/>']
    };
    const cur = (location.hostname.match(/translate\.goog$/) && new URLSearchParams(location.search).get('_x_tr_tl')) || 'es', base = 'https://bigredreport.github.io/bigredreport/';
    $('langs').innerHTML = Object.entries(F).map(([l, [n, svg]]) => `<a href="${l === 'es' ? base : 'https://bigredreport-github-io.translate.goog/bigredreport/?_x_tr_sl=es&_x_tr_tl=' + l + '&_x_tr_hl=' + l}" title="${n}" aria-label="${n}" lang="${l}"${l === cur ? ' class="on" aria-current="true"' : ''}><svg viewBox="0 0 30 20" aria-hidden="true">${svg}</svg></a>`).join('');
  } catch (e) { }
  // navegación: resalta la sección visible
  const links = [...document.querySelectorAll('.top nav a')];
  const secs = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const onScroll = () => { let cur = secs[0]; for (const s of secs) if (s.getBoundingClientRect().top < 120) cur = s; links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + cur.id)); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // ---------- fallos ----------
  try { $('b_browser').value = (navigator.userAgent.match(/(Edg|OPR|Chrome|Firefox|Safari)\/[\d.]+/) || [''])[0] + ' · ' + (navigator.platform || ''); } catch (e) { }
  $('bugform').addEventListener('submit', e => {
    e.preventDefault(); const m = $('b_msg'); m.className = 'msg';
    const title = $('b_title').value.trim(), desc = $('b_desc').value.trim();
    if (!title || !desc) { m.className = 'msg err'; m.textContent = 'Escribe al menos el resumen y la descripción.'; return; }
    const q = new URLSearchParams({ template: 'fallo.yml', title, donde: $('b_area').value, circuito: $('b_track').value.trim(), descripcion: desc, pasos: $('b_steps').value.trim(), navegador: $('b_browser').value.trim() });
    window.open('https://github.com/' + REPO + '/issues/new?' + q.toString(), '_blank', 'noopener');
    m.className = 'msg ok'; m.textContent = 'Se ha abierto GitHub en otra pestaña: revisa y pulsa «Create». Aparecerá aquí en unos minutos.';
  });
  // estado según las etiquetas del fallo en GitHub
  const ST = { pend: ['Por revisar', 's-pend'], acc: ['Aceptado', 's-acc'], inv: ['Investigando', 's-inv'], fix: ['Arreglado', 's-fix'], rej: ['Descartado', 's-rej'], dup: ['Duplicado', 's-dup'] };
  const stOf = is => { const L = is.labels.map(l => l.name.toLowerCase());
    if (L.includes('arreglado')) return 'fix'; if (L.includes('duplicado')) return 'dup'; if (L.includes('descartado')) return 'rej';
    if (L.includes('investigando')) return 'inv'; if (L.includes('aceptado')) return 'acc'; return is.state === 'closed' ? 'rej' : 'pend'; };
  const field = (body, name) => { const m = (body || '').match(new RegExp('### ' + name + '\\s*\\n+([\\s\\S]*?)(?=\\n### |$)')); const v = m ? m[1].trim() : ''; return v === '_No response_' ? '' : v; };
  let bugs = [], filter = 'all';
  for (const b of document.querySelectorAll('.filters button')) b.onclick = () => { filter = b.dataset.f; document.querySelectorAll('.filters button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); render(); };
  const fmt = iso => { try { return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };
  function render() {
    const list = bugs.filter(b => filter === 'all' || (filter === 'pend' && b.st === 'pend') || (filter === 'open' && (b.st === 'acc' || b.st === 'inv')) || (filter === 'fix' && b.st === 'fix') || (filter === 'rej' && (b.st === 'rej' || b.st === 'dup')));
    if (!list.length) { $('board').innerHTML = '<div class="empty">' + (bugs.length ? 'No hay fallos con este estado.' : 'Aún no hay fallos enviados. Usa el formulario para mandar el primero.') + '</div>'; return; }
    $('board').innerHTML = list.map(b => `<article class="bug ${ST[b.st][1]}"><div class="t"><b><a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.title)}</a></b><span class="pill">${ST[b.st][0]}</span></div>
      <div class="meta">#${b.n} · ${esc(b.donde || '')}${b.circuito ? ' · ' + esc(b.circuito) : ''} · ${fmt(b.created)} · ${esc(b.user)}${b.comments ? ' · ' + b.comments + ' comentarios' : ''}</div>
      <p>${esc((b.desc || '').slice(0, 400))}${(b.desc || '').length > 400 ? '…' : ''}</p></article>`).join('');
  }
  fetch('https://api.github.com/repos/' + REPO + '/issues?state=all&per_page=100', { headers: { Accept: 'application/vnd.github+json' } })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(L => { bugs = L.filter(i => !i.pull_request && !i.labels.some(l => l.name === 'comentarios')).map(i => ({ n: i.number, url: i.html_url, title: i.title, user: i.user ? i.user.login : '', created: i.created_at, comments: i.comments, st: stOf(i),
      donde: field(i.body, 'Dónde'), circuito: field(i.body, 'Circuito / vehículo'), desc: field(i.body, 'Descripción') || i.body })); render(); })
    .catch(() => { $('board').innerHTML = '<div class="empty">No se ha podido cargar la lista ahora mismo. <a href="https://github.com/' + REPO + '/issues" target="_blank" rel="noopener">Ver los fallos en GitHub</a>.</div>'; });

  // ---------- descargas: las versiones publicadas en GitHub (Releases) llevan la cuenta ----------
  fetch('https://api.github.com/repos/' + REPO + '/releases?per_page=100', { headers: { Accept: 'application/vnd.github+json' } })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(L => { if (!L.length) return; const n = L.reduce((a, r) => a + r.assets.reduce((b, x) => b + (x.download_count || 0), 0), 0), last = L.find(r => !r.prerelease && !r.draft) || L[0];
      $('dlver').textContent = 'Versión ' + last.tag_name.replace(/^v/, '') + ' (' + fmt(last.published_at) + ')';
      $('dlcount').textContent = ' · ' + n.toLocaleString('es-ES') + (n === 1 ? ' descarga' : ' descargas'); })
    .catch(() => { });
  // ---------- comentarios: los del hilo de GitHub (issue 1) ----------
  const md = t => esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener nofollow">$1</a>');
  fetch('https://api.github.com/repos/' + REPO + '/issues/1/comments?per_page=100', { headers: { Accept: 'application/vnd.github+json' } })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(L => { $('c_n').textContent = L.length ? L.length + (L.length === 1 ? ' comentario' : ' comentarios') : '';
      $('c_list').innerHTML = L.length ? L.slice().reverse().map(c => `<div class="cmt"><img src="${esc(c.user.avatar_url)}&s=80" alt="" loading="lazy"><div><div class="who">${esc(c.user.login)}<small>${fmt(c.created_at)}</small></div><p>${md(c.body)}</p></div></div>`).join('')
        : '<div class="empty">Aún no hay comentarios. ¡Escribe el primero!</div>'; })
    .catch(() => { $('c_list').innerHTML = '<div class="empty">No se han podido cargar ahora mismo. <a href="https://github.com/' + REPO + '/issues/1" target="_blank" rel="noopener">Verlos en GitHub</a>.</div>'; });

  // ---------- clasificaciones: el juego las guarda como mensajes retenidos en un buzón público MQTT ----------
  const BROKERS = window.BRR_BROKERS || [
    { url: 'wss://broker.emqx.io:8084/mqtt' },
    { url: 'wss://broker.hivemq.com:8884/mqtt' },
    { url: 'wss://test.mosquitto.org:8081/mqtt' },
    { url: 'wss://public.cloud.shiftr.io', user: 'public', password: 'public' }
  ];
  const T = 'bigredracing/v1/lb/', te = new TextEncoder(), td = new TextDecoder();
  const VEH = { JEEP: 'Jeep', MINI: 'Mini', BEETLE: 'Escarabajo', ATV: 'Quad 6x6', CAT: 'Dumper', MONS: 'Monster truck', TRUCK: 'Camión', JCB: 'Excavadora', CABBET: 'Escarabajo descapotable', CABMINI: 'Mini descapotable', PLOUGH: 'Quitanieves', SNOWCAT: 'Máquina de nieve', BUGGY: 'Buggy lunar', JETCAR: 'Jet car', UFO: 'OVNI', INFLATE: 'Lancha neumática', HOVCAR: 'Aerodeslizador', HELI: 'Helicóptero', COPTER: 'Helicóptero ligero' };
  const str = s => { const b = te.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
  const len = n => { const o = []; do { let d = n % 128; n = Math.floor(n / 128); if (n) d |= 128; o.push(d); } while (n); return o; };
  let ws = null, buf = new Uint8Array(0), pid = 1, ready = false, cur = null, pingTimer = null; const rows = {};
  const send = (h, body) => { if (ws && ws.readyState === 1) ws.send(new Uint8Array([h, ...len(body.length), ...body])); };
  function parse() { for (;;) { const b = buf; if (b.length < 2) return; let mul = 1, n = 0, i = 1, d; do { if (i >= b.length) return; d = b[i++]; n += (d & 127) * mul; mul *= 128; } while (d & 128);
    if (b.length < i + n) return; const h = b[0], body = b.subarray(i, i + n); buf = b.slice(i + n); const type = h >> 4;
    if (type === 2) { ready = true; subbed.clear(); if (cur) sub(cur); $('lb_st').textContent = ''; draw(); clearTimeout(retryTimer); clearInterval(pingTimer); pingTimer = setInterval(() => send(0xC0, []), 25000); }
    else if (type === 3) { const tl = (body[0] << 8) | body[1], topic = td.decode(body.subarray(2, 2 + tl)); let o = 2 + tl; if ((h >> 1) & 3) o += 2;
      const lv = topic.slice(T.length).split('/')[0], txt = td.decode(body.subarray(o)); if (!txt) continue;   // un mensaje vacío nunca borra tiempos
      let r = null; try { r = JSON.parse(txt); } catch (e) { } addRows(lv, Array.isArray(r) ? r : [r]); if (lv === cur) draw(); } } }
  // tiempos: una fila por piloto y vehículo con su mejor vuelta; se juntan los del buzón y la copia de seguridad (datos/lb.json)
  const okRow = r => r && typeof r === 'object' && typeof r.lap === 'number' && r.lap > 5 && r.lap < 3600 && typeof r.name === 'string';
  function addRows(lv, list) { const M = rows[lv] || (rows[lv] = new Map()); for (const r of list) { if (!okRow(r)) continue; const k = (r.pid || r.name) + '|' + (r.veh || ''); const o = M.get(k); if (!o || r.lap < o.lap) M.set(k, r); } }
  const subbed = new Set(); let snapDone = false;
  fetch('datos/lb.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).then(j => { for (const lv in j) addRows(lv, j[lv] || []); }).catch(() => { }).finally(() => { snapDone = true; draw(); });
  let retryTimer = null;
  function connect(k = 0) {
    if (k >= BROKERS.length) {
      $('lb_st').textContent = 'No se ha podido conectar con el servidor de clasificaciones. Reintentando…';
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => { buf = new Uint8Array(0); connect(0); }, 15000);
      return;
    }
    const b = BROKERS[k], broker = typeof b === 'string' ? { url: b } : b;
    buf = new Uint8Array(0);
    try { ws = new WebSocket(broker.url, 'mqtt'); } catch (e) { return connect(k + 1); }
    const socket = ws;
    let failed = false;
    const nextBroker = () => { if (failed || ready) return; failed = true; clearTimeout(to); try { socket.close(); } catch (e) { } connect(k + 1); };
    ws.binaryType = 'arraybuffer'; const to = setTimeout(() => { if (!ready) nextBroker(); }, 6000);
    ws.onopen = () => {
      const auth = broker.user != null, flags = 0x02 | (auth ? 0xC0 : 0);
      const payload = [...str('brrweb' + Math.random().toString(36).slice(2, 10))];
      if (auth) payload.push(...str(broker.user), ...str(broker.password || ''));
      send(0x10, [...str('MQTT'), 4, flags, 0, 60, ...payload]);
    };
    ws.onmessage = ev => { const d = new Uint8Array(ev.data), b = new Uint8Array(buf.length + d.length); b.set(buf); b.set(d, buf.length); buf = b; parse(); };
    ws.onerror = nextBroker;
    ws.onclose = () => {
      clearTimeout(to);
      if (socket !== ws) return;
      clearInterval(pingTimer);
      if (!ready) return nextBroker();
      ready = false;
      $('lb_st').textContent = 'Se ha interrumpido la conexión. Reintentando…';
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => { buf = new Uint8Array(0); connect(0); }, 15000);
    };
  }
  function sub(lv) { if (subbed.has(lv)) return; subbed.add(lv); const id = pid++ & 0xffff; send(0x82, [id >> 8, id & 255, ...str(T + lv + '/#'), 0]); }
  function draw() {
    const M = rows[cur], R = M ? [...M.values()].sort((a, b) => a.lap - b.lap) : null, tb = $('lb_t').tBodies[0];
    if (!R || !R.length) { tb.innerHTML = '<tr><td colspan="5" class="empty">' + (!ready && !snapDone ? 'Cargando…' : 'Aún no hay tiempos en este circuito. ¡Sé el primero!' + (ready ? '' : ' (sin conexión con el buzón en directo; reintentando…)')) + '</td></tr>'; return; }
    const f = t => { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
    tb.innerHTML = R.slice(0, 50).map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name || '?')}</td><td>${esc(VEH[r.veh] || r.veh || '')}</td><td>${f(+r.lap)}</td><td>${r.t ? new Date(r.t).toLocaleDateString('es-ES') : ''}</td></tr>`).join('');
  }
  $('lb_lv').onchange = () => { cur = $('lb_lv').value; draw(); if (ready) sub(cur); };
  cur = $('lb_lv').value; draw(); connect();
})();
