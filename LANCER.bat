@echo off
chcp 65001 >nul
title Konoha Vivant
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js n'est pas installe.
  echo  Va sur  https://nodejs.org  , prends la version LTS, installe, et relance ce fichier.
  echo.
  pause
  exit /b
)

if not exist node_modules (
  echo.
  echo  Premiere fois : installation ^(2 a 3 minutes, une seule fois^)...
  echo.
  call npm install
)

echo.
echo  Lancement de Konoha Vivant...
echo  Au tout premier lancement, le jeu telecharge son cerveau (2 a 3 Go).
echo  Une seule fois. Ensuite il tourne hors ligne, sans limite.
echo.
call npm start
