// Idiomas: el juego está escrito en español y aquí se traduce al vuelo todo lo que aparece en pantalla
// (textos de la página, mensajes que se van creando y avisos). Los diccionarios están en lang.js.
"use strict";
(function () {
  const BRR = window.BRR = window.BRR || {};
  BRR.LANGS = { es: 'Español', en: 'English', fr: 'Français', de: 'Deutsch', it: 'Italiano', pt: 'Português' };
  BRR.I18N = BRR.I18N || {};
  const pick = () => {
    try { const s = localStorage.getItem('brr_lang'); if (s && BRR.LANGS[s]) return s; } catch (e) { }
    for (const l of navigator.languages || [navigator.language || 'es']) { const k = String(l).slice(0, 2).toLowerCase(); if (BRR.LANGS[k]) return k; }
    return 'en';
  };
  let lang = pick(), D = null, P = [], big = null, cache = new Map();
  // palabras cortas o ambiguas que solo se traducen si son el texto entero
  const STOP = new Set(['de', 'Tú', 'No', 'Pos', 'TU', 'Mod', 'Modo', 'Tipo', 'Total', 'Normal', 'Original', 'General', 'Media', 'Mediana', 'Grave', 'Aguda', 'Prueba', 'Nada', 'Juego', 'Serie']);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function load(l) {
    lang = l; cache = new Map(); const L = BRR.I18N[l];
    if (!L || l === 'es') { D = null; P = []; big = null; return; }
    D = L.dict; P = (L.patterns || []).map(([re, tpl]) => [new RegExp(re, 'u'), tpl]);
    const keys = Object.keys(D).filter(k => !STOP.has(k) && (k.length >= 4 || /[^\x00-\x7f]/.test(k))).sort((a, b) => b.length - a.length);
    big = keys.length ? new RegExp('(?<![\\p{L}\\p{N}])(' + keys.map(esc).join('|') + ')(?![\\p{L}])', 'gu') : null;
  }
  function tr(s) {
    if (!D || !s || !/\p{L}{2}/u.test(s)) return s;
    if (cache.has(s)) return cache.get(s);
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), core = m[2]; let out = D[core];
    if (out == null) for (const [re, tpl] of P) { const g = re.exec(core); if (g) { out = tpl.replace(/\$(\d)/g, (_, n) => { const v = g[+n] || ''; return D[v] != null ? D[v] : tr(v); }); break; } }
    if (out == null && big) { const r = core.replace(big, w => D[w]); if (r !== core) out = r; }
    out = out == null ? s : m[1] + out + m[3];
    if (cache.size > 5000) cache.clear(); cache.set(s, out); return out;
  }
  BRR.t = tr;
  BRR.lang = () => lang;
  // ---------- página ----------
  const TXT = new WeakMap(), ATT = new WeakMap(), ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  const skip = n => { const e = n.nodeType === 1 ? n : n.parentElement; return !e || !!e.closest('script,style,textarea,[data-notr]'); };
  function doText(n) {
    if (skip(n)) return; const r = TXT.get(n), cur = n.data;
    if (r && cur === r.out) return;   // es lo que pusimos nosotros
    const orig = cur, out = tr(orig); TXT.set(n, { orig, out }); if (out !== cur) n.data = out;
  }
  function doAttrs(e) {
    if (skip(e)) return; let rec = ATT.get(e); if (!rec) ATT.set(e, rec = {});
    for (const a of ATTRS) { const v = e.getAttribute(a); if (v == null) continue; const r = rec[a]; if (r && v === r.out) continue;
      const out = tr(v); rec[a] = { orig: v, out }; if (out !== v) e.setAttribute(a, out); }
  }
  function walk(root) {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) doAttrs(root);
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n;
    while ((n = it.nextNode())) n.nodeType === 3 ? doText(n) : doAttrs(n);
  }
  // cambiar de idioma en marcha: se vuelve a traducir desde el texto original guardado
  function retranslate() {
    const it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n;
    while ((n = it.nextNode())) {
      if (n.nodeType === 3) { const r = TXT.get(n); if (r && n.data === r.out) { const out = tr(r.orig); r.out = out; n.data = out; } else doText(n); }
      else { const rec = ATT.get(n); if (rec) for (const a in rec) { const r = rec[a]; if (n.getAttribute(a) === r.out) { r.out = tr(r.orig); n.setAttribute(a, r.out); } } doAttrs(n); }
    }
  }
  BRR.setLang = l => { if (!BRR.LANGS[l]) return; try { localStorage.setItem('brr_lang', l); } catch (e) { } load(l); document.documentElement.lang = l; retranslate(); if (BRR.onLang) BRR.onLang(l); };
  // avisos del navegador
  for (const f of ['alert', 'confirm', 'prompt']) { const o = window[f].bind(window); window[f] = (m, ...a) => o(tr(String(m)), ...a); }
  load(lang);
  const start = () => {
    document.documentElement.lang = lang; walk(document.body);
    new MutationObserver(ms => { if (!D) return; for (const m of ms) {
      if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') doAttrs(m.target);
      else for (const n of m.addedNodes) walk(n); } })
      .observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
