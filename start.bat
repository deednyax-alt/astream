@echo off
title Serveur Premium Anime Streaming & Proxy
echo ===========================================================
echo   DEMARRAGE DU SERVEUR ANIME STREAMING & PROXY DEADCOW v1
echo ===========================================================
echo.
cd /d "%~dp0"

if exist "%~dp0node.exe" (
    echo Utilisation du binaire Node portable inclus...
    "%~dp0node.exe" server.js
) else (
    echo Utilisation de Node.js global...
    node server.js
)

pause
