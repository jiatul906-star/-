@echo off
chcp 65001 >nul
setlocal

set "BACKUP=%APPDATA%\with-u-backup"
set "TARGET=%APPDATA%\with-u"

if not exist "%BACKUP%" (
    echo [错误] 备份目录不存在: %BACKUP%
    pause
    exit /b 1
)

echo 正在停止 Electron ...
taskkill /F /IM electron.exe >nul 2>&1
timeout /t 2 /nobreak >nul

if exist "%TARGET%" (
    echo 删除当前数据: %TARGET%
    rmdir /S /Q "%TARGET%"
)

echo 正在恢复数据 ...
xcopy "%BACKUP%" "%TARGET%" /E /I /H /Y >nul

echo 恢复完成！
pause
