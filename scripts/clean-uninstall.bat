@echo off
chcp 65001 >nul
title 医疗指标管理系统 — 彻底卸载

echo ========================================
echo   医疗指标管理系统 — 彻底卸载
echo ========================================
echo.

set "PRODUCT=MedicalManager"
set "DATA_DIR=%LOCALAPPDATA%\com.yyproject.medical-manager"
set "DEFAULT_INSTALL=%LOCALAPPDATA%\Programs\%PRODUCT%"
set "START_MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs\%PRODUCT%"
set "REG_KEY=HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\%PRODUCT%"

:: ---- 1. 杀掉运行中的进程 ----
echo [1/5] 检查运行中的程序...
tasklist /FI "IMAGENAME eq %PRODUCT%.exe" 2>nul | find /I "%PRODUCT%.exe" >nul
if %errorlevel% equ 0 (
    echo   正在终止 %PRODUCT%.exe ...
    taskkill /F /IM %PRODUCT%.exe >nul 2>&1
    timeout /t 2 /nobreak >nul
    echo   已终止
) else (
    echo   未运行
)

:: ---- 2. 删除应用数据 ----
echo [2/5] 删除应用数据（数据库、配置等）...
if exist "%DATA_DIR%" (
    echo   路径: %DATA_DIR%
    rd /s /q "%DATA_DIR%" 2>nul
    echo   已删除
) else (
    echo   未找到: %DATA_DIR%
)

:: ---- 3. 删除安装目录 ----
echo [3/5] 删除安装目录...

:: 先尝试从注册表读取实际安装路径
set "INSTALL_DIR="
for /f "tokens=2*" %%a in ('reg query "%REG_KEY%" /v InstallLocation 2^>nul ^| find "InstallLocation"') do (
    set "INSTALL_DIR=%%b"
)

:: 如果注册表没找到，检查默认路径
if not defined INSTALL_DIR (
    if exist "%DEFAULT_INSTALL%" set "INSTALL_DIR=%DEFAULT_INSTALL%"
)

if defined INSTALL_DIR (
    if exist "%INSTALL_DIR%" (
        echo   路径: %INSTALL_DIR%
        rd /s /q "%INSTALL_DIR%" 2>nul
        echo   已删除
    ) else (
        echo   路径不存在: %INSTALL_DIR%
    )
) else (
    echo   未找到安装目录（可能已手动删除）
)

:: ---- 4. 删除开始菜单快捷方式 ----
echo [4/5] 删除开始菜单快捷方式...
if exist "%START_MENU%" (
    rd /s /q "%START_MENU%" 2>nul
    echo   已删除
) else (
    echo   未找到
)

:: ---- 5. 删除注册表卸载项 ----
echo [5/5] 删除注册表卸载项...
reg query "%REG_KEY%" >nul 2>&1
if %errorlevel% equ 0 (
    reg delete "%REG_KEY%" /f >nul 2>&1
    echo   已删除
) else (
    echo   未找到
)

echo.
echo ========================================
echo   卸载完成，系统已清理干净。
echo ========================================
echo.
pause
