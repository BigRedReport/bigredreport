// Puente seguro entre el juego/lanzador y el ordenador: solo leer archivos de la carpeta del juego y unos pocos ajustes
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('BRR_NATIVE', {
  getCfg: () => ipcRenderer.invoke('cfg:get'),
  setCfg: c => ipcRenderer.invoke('cfg:set', c),
  pickDir: () => ipcRenderer.invoke('dir:pick'),
  checkDir: () => ipcRenderer.invoke('dir:check'),
  list: () => ipcRenderer.invoke('files:list'),
  read: (rel, start, end) => ipcRenderer.invoke('files:read', rel, start, end),
  play: () => ipcRenderer.invoke('game:play'),
  openUrl: u => ipcRenderer.invoke('open:url', u),
  quit: () => ipcRenderer.invoke('app:quit'),
  checkUpdate: () => ipcRenderer.invoke('upd:check'),
  lanList: () => ipcRenderer.invoke('lan:list'),
  lanHost: () => ipcRenderer.invoke('lan:host'),
  updateGame: () => ipcRenderer.invoke('upd:game'),
});
