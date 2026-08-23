$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$workspace = Split-Path -Parent (Split-Path -Parent $root)
$releaseDir = Join-Path $workspace "outputs\release"
$webDir = Join-Path $workspace "outputs\web"

function Invoke-Checked {
  param(
    [string]$FilePath,
    [string[]]$Arguments = @()
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath failed with exit code $LASTEXITCODE"
  }
}

Set-Location $root

Write-Host "Generating Muv'it brand icons..."
Invoke-Checked "powershell" @("-ExecutionPolicy", "Bypass", "-File", (Join-Path $root "scripts\generate-brand-icons.ps1"))

Write-Host "Building PWA..."
Invoke-Checked "npm" @("run", "build")

Write-Host "Packaging PWA upload zip..."
New-Item -ItemType Directory -Force -Path $webDir | Out-Null
$webZip = Join-Path $webDir "muvit-site-public-html-fixed.zip"
if (Test-Path $webZip) {
  Remove-Item -LiteralPath $webZip -Force
}
Compress-Archive -Path (Join-Path $root "dist\*") -DestinationPath $webZip -Force

Write-Host "Syncing Android Capacitor project..."
Invoke-Checked "npx" @("cap", "sync", "android")

Write-Host "Building signed APK and AAB..."
Set-Location (Join-Path $root "android")
Invoke-Checked ".\gradlew.bat" @("assembleRelease", "bundleRelease")

New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
Copy-Item -LiteralPath "app\build\outputs\apk\release\app-release.apk" -Destination (Join-Path $releaseDir "muvit-v1-build1-playstore.apk") -Force
Copy-Item -LiteralPath "app\build\outputs\bundle\release\app-release.aab" -Destination (Join-Path $releaseDir "muvit-v1-build1-playstore.aab") -Force

Write-Host ""
Write-Host "Release outputs:"
Get-Item (Join-Path $webDir "muvit-site-public-html-fixed.zip"), (Join-Path $releaseDir "muvit-v1-build1-playstore.apk"), (Join-Path $releaseDir "muvit-v1-build1-playstore.aab") |
  Select-Object FullName, Length |
  Format-Table -AutoSize
