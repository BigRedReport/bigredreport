@echo off
title Servidor Big Red Racing
where node >nul 2>nul
if errorlevel 1 (
  echo Necesitas Node.js para el servidor: https://nodejs.org  ^(descarga la version LTS e instalala^)
  pause
  exit /b
)
node "%~dp0brr-server.js" 7777
pause
