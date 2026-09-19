# scripts/register-file-associations.ps1
# Mendaftarkan asosiasi file .captr dan icon Captr Studio ke Windows File Explorer (Current User)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$rootDir = (Get-Item $scriptDir).Parent.FullName
$iconPath = Join-Path $rootDir "icons\icons\win\icon.ico"

if (-not (Test-Path $iconPath)) {
    Write-Error "Icon file not found at: $iconPath"
    exit 1
}

Write-Host "Mendaftarkan asosiasi file .captr ke Windows Registry (HKCU)..." -ForegroundColor Cyan
Write-Host "Path Icon: $iconPath" -ForegroundColor DarkGray

$classesRoot = "HKCU:\Software\Classes"

# 1. Daftarkan ekstensi .captr
$extKey = Join-Path $classesRoot ".captr"
if (-not (Test-Path $extKey)) {
    New-Item -Path $extKey -Force | Out-Null
}
Set-ItemProperty -Path $extKey -Name "(Default)" -Value "CaptrStudio.Project"

$openWithKey = Join-Path $extKey "OpenWithProgids"
if (-not (Test-Path $openWithKey)) {
    New-Item -Path $openWithKey -Force | Out-Null
}
Set-ItemProperty -Path $openWithKey -Name "CaptrStudio.Project" -Value ""

# 2. Daftarkan ProgID CaptrStudio.Project
$progIdKey = Join-Path $classesRoot "CaptrStudio.Project"
if (-not (Test-Path $progIdKey)) {
    New-Item -Path $progIdKey -Force | Out-Null
}
Set-ItemProperty -Path $progIdKey -Name "(Default)" -Value "Captr Studio Project"
Set-ItemProperty -Path $progIdKey -Name "FriendlyTypeName" -Value "Captr Studio Project File"

# 3. Daftarkan DefaultIcon
$defaultIconKey = Join-Path $progIdKey "DefaultIcon"
if (-not (Test-Path $defaultIconKey)) {
    New-Item -Path $defaultIconKey -Force | Out-Null
}
Set-ItemProperty -Path $defaultIconKey -Name "(Default)" -Value "$iconPath,0"

# 4. Refresh Windows Shell Icon Cache
Write-Host "Memperbarui cache icon Windows Shell..." -ForegroundColor Cyan
$cSharpCode = @"
using System;
using System.Runtime.InteropServices;
public class WindowsShell {
    [DllImport("shell32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern void SHChangeNotify(uint wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);
}
"@

try {
    Add-Type -TypeDefinition $cSharpCode -ErrorAction SilentlyContinue
} catch {}

[WindowsShell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)

Write-Host "SUKSES: Icon file .captr berhasil didaftarkan ke Windows Explorer!" -ForegroundColor Green
Write-Host "Seluruh file .captr sekarang akan menampilkan icon resmi Captr Studio." -ForegroundColor Green
