@echo off
cd /d "%~dp0."

echo [1/3] Check asset version...
python "%~dp0toolsump_asset_version.py" || echo   (python not available, version not bumped)

echo.
echo [2/3] Commit changes...
git add -A
git commit -m "Update site" || echo   (nothing new to commit)

echo.
echo [3/3] Push to GitHub...
git push || (echo Push FAILED. Check network or GitHub login. & pause & exit /b 1)

echo.
echo Done. Cloudflare will redeploy in about a minute.
pause
