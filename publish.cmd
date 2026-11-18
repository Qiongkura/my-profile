@echo off
chcp 65001 >nul
cd /d "%~dp0."

echo [1/4] Check asset version...
python "%~dp0tools/bump_asset_version.py" || echo   (python not available, version not bumped)

echo.
echo [2/4] Commit changes...
git add -A
git commit -m "Update site" || echo   (nothing new to commit)

echo.
echo [3/4] Push to GitHub...
git push || (echo Push FAILED. Check network or GitHub login. & pause & exit /b 1)

echo.
echo [4/4] Sync static files to Aliyun ECS...
node "%~dp0tools/deploy-ecs.mjs" || (echo ECS deploy FAILED. Check SSH connection or .env. & pause & exit /b 1)

echo.
echo Done. GitHub and Aliyun ECS (https://qiongkura.xyz) are both up to date.
pause
