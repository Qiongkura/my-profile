@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo [1/3] 检查是否需要更新资源版本号...
python "%~dp0tools\bump_asset_version.py"

echo.
echo [2/3] 提交改动...
git add -A
git commit -m "Update site"
if errorlevel 1 echo （没有新的改动需要提交）

echo.
echo [3/3] 推送到 GitHub...
git push
if errorlevel 1 (
  echo 推送失败，请检查网络或 GitHub 登录状态。
  pause
  exit /b 1
)

echo.
echo 完成。Cloudflare 大约 1 分钟后会自动重新部署。
pause
