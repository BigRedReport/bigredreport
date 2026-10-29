// Big Red Report (escritorio): lanzador + ventana del juego. Lee los archivos de tu copia de Big Red Racing directamente del disco.
'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, utilityProcess } = require('electron');
const path = require('path'), fs = require('fs'), zlib = require('zlib');
// Linux: al descomprimir el .tar.gz el ayudante del sandbox de Chromium no tiene permisos de root; sin esto no arranca
if (process.platform === 'linux' && !process.env.BRR_SANDBOX) app.commandLine.appendSwitch('no-sandbox');

const CFG = path.join(app.getPath('userData'), 'lanzador.json');
const DEF = { dir: '', fullscreen: true, width: 1600, height: 900, lang: '', server: false, port: 7777 };
let cfg = { ...DEF }; try { Object.assign(cfg, JSON.parse(fs.readFileSync(CFG, 'utf8'))); } catch (e) { }
const saveCfg = () => { try { fs.mkdirSync(path.dirname(CFG), { recursive: true }); fs.writeFileSync(CFG, JSON.stringify(cfg, null, 1)); } catch (e) { } };

let launcher = null, game = null, server = null;
// el juego puede venir actualizado (descargado de GitHub a la carpeta de datos del programa); si no, el que trae el programa
const UPD = path.join(app.getPath('userData'), 'juego');
const verOf = dir => { try { return (fs.readFileSync(path.join(dir, 'js', 'version.js'), 'utf8').match(/VERSION\s*=\s*'([\d.]+)'/) || [])[1] || '0'; } catch (e) { return '0'; } };
const newer = (a, b) => { const A = String(a).split('.').map(Number), B = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if ((A[i] || 0) !== (B[i] || 0)) return (A[i] || 0) > (B[i] || 0); return false; };
const gameDir = () => fs.existsSync(path.join(UPD, 'BigRedRacing.html')) && newer(verOf(UPD), verOf(path.join(__dirname, 'game'))) ? UPD : path.join(__dirname, 'game');
const GAME_HTML = () => path.join(gameDir(), 'BigRedRacing.html');

function openLauncher() {
  launcher = new BrowserWindow({ width: 980, height: 620, minWidth: 760, minHeight: 520, title: 'Big Red Report', backgroundColor: '#14121a', autoHideMenuBar: true,
    icon: path.join(__dirname, 'game', 'icon-512.png'), webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true } });
  launcher.loadFile(path.join(__dirname, 'launcher.html'));
  launcher.on('closed', () => { launcher = null; if (!game) app.quit(); });
}
function openGame() {
  if (game) { game.focus(); return; }
  game = new BrowserWindow({ width: cfg.width, height: cfg.height, fullscreen: !!cfg.fullscreen, title: 'Big Red Report', backgroundColor: '#000', autoHideMenuBar: true,
    icon: path.join(__dirname, 'game', 'icon-512.png'), webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, backgroundThrottling: false } });
  game.loadFile(GAME_HTML(), { query: { native: '1', ...(cfg.lang ? { lang: cfg.lang } : {}) } });
  game.on('closed', () => { game = null; if (launcher) launcher.show(); else app.quit(); });
  if (launcher) launcher.hide();
}
function startServer(force) {
  if (server || !(cfg.server || force)) return;
  const js = path.join(gameDir(), 'server', 'brr-server.js'); if (!fs.existsSync(js)) return;
  server = utilityProcess.fork(js, [String(cfg.port || 7777)], { cwd: app.getPath('userData'), stdio: 'ignore', env: { ...process.env, BRR_NAME: require('os').hostname() } });
  server.on('exit', () => { server = null; });
}
function stopServer() { if (server) { try { server.kill(); } catch (e) { } server = null; } }

// lista de archivos de la carpeta del juego (rutas relativas como las del navegador)
function walk(dir, base, out, depth = 0) {
  if (depth > 6) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name), rel = base + e.name;
    if (e.isDirectory()) walk(p, rel + '/', out, depth + 1);
    else if (e.isFile()) { try { out.push({ rel, size: fs.statSync(p).size }); } catch (x) { } }
  }
  return out;
}
const safe = rel => { const p = path.resolve(cfg.dir, '..', rel); if (!p.startsWith(path.resolve(cfg.dir, '..'))) throw new Error('ruta'); return p; };

ipcMain.handle('cfg:get', () => ({ ...cfg, version: app.getVersion(), platform: process.platform }));
ipcMain.handle('cfg:set', (e, c) => { const was = cfg.server, port = cfg.port; Object.assign(cfg, c || {}); saveCfg(); if (cfg.server !== was || cfg.port !== port) { stopServer(); startServer(); } return cfg; });
ipcMain.handle('dir:pick', async () => {
  const r = await dialog.showOpenDialog(launcher || game, { title: 'Elige la carpeta del juego (la que contiene BIGRED, o la propia BIGRED)', properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null; cfg.dir = r.filePaths[0]; saveCfg(); return cfg.dir;
});
ipcMain.handle('dir:check', () => { try { const L = walk(cfg.dir, path.basename(cfg.dir) + '/', []); return { ok: L.some(f => /\.LEV$/i.test(f.rel)), n: L.length, cd: L.some(f => /\.CUE$/i.test(f.rel)) }; } catch (e) { return { ok: false }; } });
ipcMain.handle('files:list', () => { if (!cfg.dir) return []; try { return walk(cfg.dir, path.basename(cfg.dir) + '/', []); } catch (e) { return []; } });
ipcMain.handle('files:read', async (e, rel, start, end) => {
  const p = safe(rel), fh = await fs.promises.open(p, 'r');
  try { const st = await fh.stat(), s = start || 0, en = end == null ? st.size : Math.min(end, st.size), buf = Buffer.alloc(Math.max(0, en - s)); await fh.read(buf, 0, buf.length, s); return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length); }
  finally { await fh.close(); }
});
ipcMain.handle('game:play', () => { openGame(); return true; });
// ---------- red local (LAN): se escuchan los servidores que se anuncian en la red y se puede crear uno aquí ----------
const lanSeen = new Map();
try { const dgram = require('dgram'), s = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  s.on('message', (b, ri) => { try { const m = JSON.parse(b.toString()); if (m && m.brr === 1 && m.port) lanSeen.set(ri.address + ':' + m.port, { ...m, ip: ri.address, t: Date.now() }); } catch (e) { } });
  s.on('error', () => { }); s.bind(7779); } catch (e) { }
ipcMain.handle('lan:list', () => { const now = Date.now(), out = []; for (const [k, v] of lanSeen) if (now - v.t > 7000) lanSeen.delete(k); else out.push({ name: String(v.name || '').slice(0, 30), ip: v.ip, port: v.port | 0, rooms: Array.isArray(v.rooms) ? v.rooms.slice(0, 8) : [] }); return out; });
ipcMain.handle('lan:host', async () => {
  startServer(true); await new Promise(r => setTimeout(r, 700));
  const os = require('os'), ips = []; const nets = os.networkInterfaces(); for (const k in nets) for (const a of nets[k]) if (a.family === 'IPv4' && !a.internal) ips.push(a.address);
  return { port: cfg.port || 7777, ips, running: !!server };
});
// ---------- actualizaciones (Releases de GitHub) ----------
const REPO = 'BigRedReport/bigredreport';
async function latest() {
  const r = await fetch(process.env.BRR_UPD_API || 'https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'BigRedReport' } });   // BRR_UPD_API: solo para probar
  if (!r.ok) throw new Error('GitHub ' + r.status); const j = await r.json();
  const asset = n => (j.assets || []).find(a => a.name === n);
  return { ver: String(j.tag_name || '').replace(/^v/, ''), url: j.html_url, game: asset('BigRedRacing_port.zip'), app: asset(process.platform === 'win32' ? 'BigRedReport-Windows.zip' : 'BigRedReport-Linux.tar.gz') };
}
// descomprime un .zip (sin programas externos): directorio central + inflate
function unzip(buf, dest) {
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--; if (e < 0) throw new Error('zip no válido');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16);
  for (let k = 0; k < n; k++) {
    const meth = buf.readUInt16LE(p + 10), csz = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nl); p += 46 + nl + xl + cl;
    const out = path.resolve(dest, name); if (!out.startsWith(path.resolve(dest) + path.sep)) continue;   // nada fuera de la carpeta
    if (name.endsWith('/')) { fs.mkdirSync(out, { recursive: true }); continue; }
    const lo = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28), data = buf.subarray(lo, lo + csz);
    fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(/\.asar$/i.test(out) ? out + '_' : out, meth === 8 ? zlib.inflateRawSync(data) : data);   // los .asar con otro nombre: Electron no deja escribirlos tal cual
  }
}
ipcMain.handle('upd:check', async () => {
  const cur = process.env.BRR_FAKE_VER || verOf(gameDir()), appVer = process.env.BRR_FAKE_VER || app.getVersion();   // BRR_FAKE_VER: solo para probar el actualizador
  let failed = null; try { failed = fs.readFileSync(path.join(app.getPath('userData'), 'actualizacion-fallida.txt'), 'utf8').trim(); } catch (x) { }
  try { const L = await latest(), retried = !!(cfg.updTry && cfg.updTry.ver === L.ver && Date.now() - cfg.updTry.t < 30 * 60000);
    return { ok: true, ver: L.ver, cur, appVer, game: newer(L.ver, cur) && !!L.game, app: newer(L.ver, appVer), appUrl: L.app ? L.app.browser_download_url : L.url, url: L.url, retried: retried && newer(L.ver, appVer), failed }; }
  catch (e) { return { ok: false, cur, appVer, err: String(e.message || e) }; }
});
// descarga con progreso (para la barra del lanzador)
async function download(url, onPct) {
  const r = await fetch(url, { headers: { 'User-Agent': 'BigRedReport' } }); if (!r.ok) throw new Error('Descarga ' + r.status);
  const total = +r.headers.get('content-length') || 0, rd = r.body.getReader(), parts = []; let got = 0, last = -1;
  for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; const p = total ? Math.floor(got * 100 / total) : 0; if (p !== last) { last = p; onPct && onPct(p, got, total); } }
  return Buffer.concat(parts.map(u => Buffer.from(u)));
}
// .tar.gz (Linux) sin programas externos
function untar(buf, dest) {
  const t = zlib.gunzipSync(buf); let o = 0, long = null;
  while (o + 512 <= t.length) {
    const h = t.subarray(o, o + 512); if (h.every(b => b === 0)) break;
    const str = (a, b) => h.toString('utf8', a, b).replace(/\0.*$/s, ''), size = parseInt(str(124, 136).trim() || '0', 8), type = String.fromCharCode(h[156] || 48), mode = parseInt(str(100, 108).trim() || '644', 8);
    let name = long || ((str(345, 500) ? str(345, 500) + '/' : '') + str(0, 100)); long = null; const data = t.subarray(o + 512, o + 512 + size); o += 512 + Math.ceil(size / 512) * 512;
    if (type === 'L') { long = data.toString('utf8').replace(/\0.*$/s, ''); continue; }
    const out = path.resolve(dest, name); if (!out.startsWith(path.resolve(dest) + path.sep)) continue;
    if (type === '5') fs.mkdirSync(out, { recursive: true });
    else if (type === '0' || type === '\0') { const o2 = /\.asar$/i.test(out) ? out + '_' : out; fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(o2, data); try { fs.chmodSync(o2, mode & 0o777); } catch (e) { } }
    else if (type === '2') { try { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.rmSync(out, { force: true }); fs.symlinkSync(str(157, 257), out); } catch (e) { } }
  }
}
// actualizar el PROGRAMA entero (lanzador + juego): se descarga, se descomprime aparte y, al cerrarse, un pequeño guion copia los archivos encima y lo vuelve a abrir
ipcMain.handle('upd:app', async (e) => {
  const L = await latest(); if (!L.app) throw new Error('No hay paquete para este sistema');
  const send = (p, got, total) => { try { e.sender.send('upd:progress', { p, got, total }); } catch (x) { } };
  const buf = await download(L.app.browser_download_url, send);
  // carpeta nueva en cada intento (lo que quedara de un intento fallido se borra si se puede; si no, da igual)
  const na = process.noAsar; process.noAsar = true;
  try { for (const d of fs.readdirSync(app.getPath('userData'))) if (/^programa-nuevo/.test(d)) try { fs.rmSync(path.join(app.getPath('userData'), d), { recursive: true, force: true }); } catch (x) { } } catch (x) { }
  const tmp = path.join(app.getPath('userData'), 'programa-nuevo-' + Date.now());
  try { fs.mkdirSync(tmp, { recursive: true }); if (process.platform === 'win32') unzip(buf, tmp); else untar(buf, tmp); }
  finally { process.noAsar = na; }
  const src = fs.existsSync(path.join(tmp, 'BigRedReport')) ? path.join(tmp, 'BigRedReport') : tmp, dst = path.dirname(process.execPath), exe = path.basename(process.execPath);
  if (!fs.existsSync(path.join(src, exe))) throw new Error('El paquete descargado no trae el programa');
  fs.rmSync(UPD, { recursive: true, force: true });   // el juego nuevo ya viene dentro del programa
  const { spawn } = require('child_process');
  const fail = path.join(app.getPath('userData'), 'actualizacion-fallida.txt'); try { fs.rmSync(fail, { force: true }); } catch (x) { }
  cfg.updTry = { ver: L.ver, t: Date.now() }; saveCfg();   // para no repetir en bucle si algo sale mal
  if (process.platform === 'win32') {
    // guion de instalación: espera a que se cierren TODOS los procesos del programa (los auxiliares de Chromium tardan un poco),
    // copia con reintentos y, si no puede, lo apunta para no intentarlo en bucle. Se lanza oculto con wscript (sin ventanas negras)
    const bat = path.join(app.getPath('temp'), 'brr-actualizar.cmd'), vbs = path.join(app.getPath('temp'), 'brr-actualizar.vbs'), q = x => '"' + x + '"';
    fs.writeFileSync(bat, ['@echo off', 'set N=0', ':espera',
      `tasklist /FI "IMAGENAME eq ${exe}" 2>nul | find /I "${exe}" >nul || goto libre`,
      'set /a N+=1', `if %N% GEQ 25 taskkill /F /IM ${q(exe)} >nul 2>&1`, 'if %N% GEQ 40 goto libre', 'ping -n 2 127.0.0.1 >nul', 'goto espera', ':libre',
      `robocopy ${q(src)} ${q(dst)} /E /R:30 /W:1 /NFL /NDL /NJH /NJS /NP >nul`,
      `if %ERRORLEVEL% GEQ 8 (echo No se pudieron copiar los archivos > ${q(fail)}) else (for /r ${q(path.join(dst, 'resources'))} %%f in (*.asar_) do move /y "%%f" "%%~dpnf.asar" >nul)`,
      `start "" ${q(path.join(dst, exe))}`, `rmdir /s /q ${q(tmp)}`, `del ${q(vbs)}`, '(goto) 2>nul & del "%~f0"'].join('\r\n'));
    // ¿se puede escribir en la carpeta del programa? (en Program Files o en discos protegidos, no sin permisos de administrador):
    // si no, el guion se lanza como administrador (Windows lo pregunta una vez) en vez de fallar en silencio
    let canWrite = true; try { const t = path.join(dst, '.brr-prueba-escritura'); fs.writeFileSync(t, 'ok'); fs.rmSync(t, { force: true }); } catch (x) { canWrite = false; }
    const b2 = bat.replace(/"/g, '""');
    fs.writeFileSync(vbs, canWrite ? `CreateObject("WScript.Shell").Run "cmd /c """ & "${b2}" & """", 0, False\r\n`
      : `CreateObject("Shell.Application").ShellExecute "cmd.exe", "/c """ & "${b2}" & """", "", "runas", 0\r\n`);
    spawn('wscript.exe', [vbs], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } else {
    const sh = path.join(app.getPath('temp'), 'brr-actualizar.sh'), ex = path.join(dst, exe);
    fs.writeFileSync(sh, ['#!/bin/sh', 'n=0', `while pgrep -f "${ex}" >/dev/null 2>&1 || kill -0 ${process.pid} 2>/dev/null; do n=$((n+1)); [ $n -ge 40 ] && pkill -9 -f "${ex}"; [ $n -ge 60 ] && break; sleep 0.5; done`,
      `if cp -rf "${src}/." "${dst}/"; then for f in "${dst}"/resources/*.asar_; do [ -e "$f" ] && mv -f "$f" "\${f%_}"; done; else echo "No se pudieron copiar los archivos" > "${fail}"; fi`,
      `chmod +x "${ex}" "${path.join(dst, 'BigRedReport.sh')}" 2>/dev/null`, `rm -rf "${tmp}"`, `nohup "${ex}" >/dev/null 2>&1 &`, 'rm -f "$0"'].join('\n'), { mode: 0o755 });
    spawn('/bin/sh', [sh], { detached: true, stdio: 'ignore' }).unref();
  }
  setTimeout(() => { stopServer(); app.exit(0); }, 400);
  return { ok: true, ver: L.ver };
});
ipcMain.handle('upd:game', async () => {
  const L = await latest(); if (!L.game) throw new Error('Esta versión no trae el juego por separado');
  const r = await fetch(L.game.browser_download_url, { headers: { 'User-Agent': 'BigRedReport' } }); if (!r.ok) throw new Error('Descarga ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer()), tmp = UPD + '.nuevo';
  fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true }); unzip(buf, tmp);
  if (!fs.existsSync(path.join(tmp, 'BigRedRacing.html'))) throw new Error('El paquete no trae el juego');
  fs.rmSync(UPD, { recursive: true, force: true }); fs.renameSync(tmp, UPD);
  if (game) { const g = game; game = null; g.removeAllListeners('closed'); g.close(); openGame(); }
  stopServer(); startServer();
  return { ok: true, ver: verOf(UPD) };
});
ipcMain.handle('open:url', (e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });
ipcMain.handle('app:quit', () => app.quit());

app.whenReady().then(() => { startServer(); openLauncher(); });
app.on('window-all-closed', () => { stopServer(); app.quit(); });
