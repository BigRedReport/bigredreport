#!/bin/bash
# Big Red Report para Steam Deck: instala el juego en ~/Games/BigRedReport, lo añade al menú y a Steam (modo juego)
# Uso (modo escritorio): clic derecho en este archivo → "Ejecutar en Konsole"  (o en una terminal: ./instalar-steamdeck.sh)
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"; DST="$HOME/Games/BigRedReport"
say() { if command -v kdialog >/dev/null 2>&1 && [ -n "$DISPLAY$WAYLAND_DISPLAY" ]; then kdialog --title "Big Red Report" --msgbox "$1" 2>/dev/null || true; fi; echo "$1"; }
mkdir -p "$DST"
if [ "$SRC" != "$DST" ]; then cp -rf "$SRC/." "$DST/"; fi
chmod +x "$DST/BigRedReport" "$DST/BigRedReport.sh" "$DST/instalar-steamdeck.sh" 2>/dev/null || true
ICON="$DST/icon-512.png"
mkdir -p "$HOME/.local/share/applications"
DESK="$HOME/.local/share/applications/bigredreport.desktop"
cat > "$DESK" <<EOD
[Desktop Entry]
Type=Application
Name=Big Red Report
Comment=Port de fans de Big Red Racing
Exec="$DST/BigRedReport.sh" --deck
Path=$DST
Icon=$ICON
Terminal=false
Categories=Game;
EOD
chmod +x "$DESK"
cp -f "$DESK" "$HOME/Desktop/" 2>/dev/null || true
# añadir a Steam como juego que no es de Steam (SteamOS trae steamos-add-to-steam; Steam tiene que estar abierto)
ADDED=0
if command -v steamos-add-to-steam >/dev/null 2>&1; then steamos-add-to-steam "$DESK" >/dev/null 2>&1 && ADDED=1 || true; fi
if [ $ADDED = 1 ]; then
  say "Big Red Report instalado en $DST y añadido a Steam.

Vuelve al modo juego: lo tienes en Biblioteca → No de Steam.
La primera vez, el lanzador busca solo tu copia de Big Red Racing (carpeta BIGRED en la tarjeta SD, Descargas, Games…)."
else
  say "Big Red Report instalado en $DST (y en el menú de aplicaciones → Juegos).

Para tenerlo en el modo juego: abre Steam → Añadir un juego → Añadir un juego que no es de Steam → marca «Big Red Report»."
fi
