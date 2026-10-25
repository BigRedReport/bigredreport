// Big Red Report (escritorio): lanzador + ventana del juego. Lee los archivos de tu copia de Big Red Racing directamente del disco.
'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, utilityProcess } = require('electron');
const path = require('path'), fs = require('fs');
// Linux: al descomprimir el .tar.gz el ayudante del sandbox de Chromium no tiene permisos de root; sin esto no arranca
if (process.platform === 'linux' && !process.env.BRR_SANDBOX) app.commandLine.appendSwitch('no-sandbox');

const CFG = path.join(app.getPath('userData'), 'lanzador.json');
const DEF = { dir: '', fullscreen: true, width: 1600, height: 900, lang: '', server: false, port: 7777 };
let cfg = { ...DEF }; try { Object.assign(cfg, JSON.parse(fs.readFileSync(CFG, 'utf8'))); } catch (e) { }
const saveCfg = () => { try { fs.mkdirSync(path.dirname(CFG), { recursive: true }); fs.writeFileSync(CFG, JSON.stringify(cfg, null, 1)); } catch (e) { } };

let launcher = null, game = null, server = null;
const GAME = path.join(__dirname, 'game', 'BigRedRacing.html');

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
  game.loadFile(GAME, { query: { native: '1', ...(cfg.lang ? { lang: cfg.lang } : {}) } });
  game.on('closed', () => { game = null; if (launcher) launcher.show(); else app.quit(); });
  if (launcher) launcher.hide();
}
function startServer() {
  if (server || !cfg.server) return;
  const js = path.join(__dirname, 'game', 'server', 'brr-server.js'); if (!fs.existsSync(js)) return;
  server = utilityProcess.fork(js, [String(cfg.port || 7777)], { cwd: app.getPath('userData'), stdio: 'ignore' });
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
ipcMain.handle('open:url', (e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });
ipcMain.handle('app:quit', () => app.quit());

app.whenReady().then(() => { startServer(); openLauncher(); });
app.on('window-all-closed', () => { stopServer(); app.quit(); });
