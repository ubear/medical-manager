<#
.SYNOPSIS
  医疗指标管理系统 — Windows 一键彻底卸载脚本
.DESCRIPTION
  删除以下内容：
  1. 应用数据（数据库、日志等）: %LOCALAPPDATA%\com.yyproject.medical-manager\
  2. 安装目录（默认或自定义）
  3. 卸载注册表项
  4. 开始菜单快捷方式
.NOTES
  以普通用户身份运行即可，不需要管理员权限（currentUser 安装模式）。
#>

$ErrorActionPreference = "Stop"
$ProductName = "MedicalManager"
$DataDir = "$env:LOCALAPPDATA\com.yyproject.medical-manager"
$DefaultInstallDir = "$env:LOCALAPPDATA\Programs\$ProductName"
$StartMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\$ProductName"
$RegPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$ProductName"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  医疗指标管理系统 — 彻底卸载" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ---- 1. 杀掉运行中的进程 ----
Write-Host "[1/5] 检查运行中的程序..." -ForegroundColor Yellow
$proc = Get-Process -Name $ProductName -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "  正在终止 $ProductName 进程..." -ForegroundColor Gray
    $proc | Stop-Process -Force
    Start-Sleep -Seconds 1
    Write-Host "  已终止" -ForegroundColor Green
} else {
    Write-Host "  未运行" -ForegroundColor Gray
}

# ---- 2. 删除应用数据 ----
Write-Host "[2/5] 删除应用数据..." -ForegroundColor Yellow
if (Test-Path $DataDir) {
    Write-Host "  路径: $DataDir" -ForegroundColor Gray
    Remove-Item -Recurse -Force $DataDir
    Write-Host "  已删除（含数据库、配置等）" -ForegroundColor Green
} else {
    Write-Host "  未找到: $DataDir" -ForegroundColor Gray
}

# ---- 3. 删除安装目录 ----
Write-Host "[3/5] 删除安装目录..." -ForegroundColor Yellow

# 先查注册表获取实际安装路径
$installDir = $null
if (Test-Path $RegPath) {
    try {
        $props = Get-ItemProperty -Path $RegPath -ErrorAction Stop
        $installDir = $props.InstallLocation
    } catch { }
}

if (-not $installDir) {
    # 回退：检查默认位置
    if (Test-Path $DefaultInstallDir) {
        $installDir = $DefaultInstallDir
    }
}

if ($installDir -and (Test-Path $installDir)) {
    Write-Host "  路径: $installDir" -ForegroundColor Gray
    Remove-Item -Recurse -Force $installDir
    Write-Host "  已删除" -ForegroundColor Green
} elseif ($installDir) {
    Write-Host "  路径不存在: $installDir" -ForegroundColor Gray
} else {
    Write-Host "  未找到安装目录（可能已手动删除）" -ForegroundColor Gray
}

# ---- 4. 删除开始菜单快捷方式 ----
Write-Host "[4/5] 删除开始菜单快捷方式..." -ForegroundColor Yellow
if (Test-Path $StartMenuDir) {
    Remove-Item -Recurse -Force $StartMenuDir
    Write-Host "  已删除" -ForegroundColor Green
} else {
    Write-Host "  未找到" -ForegroundColor Gray
}

# ---- 5. 删除注册表卸载项 ----
Write-Host "[5/5] 删除注册表卸载项..." -ForegroundColor Yellow
if (Test-Path $RegPath) {
    Remove-Item -Recurse -Force $RegPath
    Write-Host "  已删除" -ForegroundColor Green
} else {
    Write-Host "  未找到" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  卸载完成，系统已清理干净。" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
