@echo off
chcp 65001 >NUL
cd /d "%~dp0"
where node >NUL 2>NUL || (echo Node.js is not installed. Download LTS from https://nodejs.org and run this file again. & pause & exit /b 1)
echo [1/2] Installing packages...
call npm install || (echo npm install failed. & pause & exit /b 1)
echo [2/2] Building Windows installer...
call npm run dist || (echo Build failed. & pause & exit /b 1)
echo.
echo Done! Give "Yadnegar-Setup-x.x.x.exe" from the "release" folder to anyone.
start "" "%~dp0release"
pause
