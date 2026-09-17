$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root "public\muvit-logo.png"

if (!(Test-Path $sourcePath)) {
  throw "Missing brand logo at $sourcePath"
}

$source = [System.Drawing.Image]::FromFile((Resolve-Path $sourcePath))

function Save-Png {
  param(
    [int]$Size,
    [string]$RelativePath
  )

  $targetPath = Join-Path $root $RelativePath
  $targetDir = Split-Path -Parent $targetPath
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
  $graphics.DrawImage($source, 0, 0, $Size, $Size)
  $graphics.Dispose()
  $bitmap.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

Save-Png 192 "public\icons\android\icon-192x192.png"
Save-Png 512 "public\icons\android\icon-512x512.png"
Save-Png 512 "public\icons\android\ic_launcher_foreground.png"
Save-Png 180 "public\icons\ios\icon-180x180.png"
Save-Png 1024 "public\icons\ios\icon-1024x1024.png"
Save-Png 512 "public\android-chrome-512x512.png"
Save-Png 32 "public\favicon.png"

# Create a standards-compliant ICO containing the official 32x32 PNG.
$faviconPngPath = Join-Path $root "public\favicon.png"
$faviconIcoPath = Join-Path $root "public\favicon.ico"
$pngBytes = [System.IO.File]::ReadAllBytes($faviconPngPath)
$icoStream = New-Object System.IO.MemoryStream
$icoWriter = New-Object System.IO.BinaryWriter($icoStream)
$icoWriter.Write([UInt16]0)
$icoWriter.Write([UInt16]1)
$icoWriter.Write([UInt16]1)
$icoWriter.Write([Byte]32)
$icoWriter.Write([Byte]32)
$icoWriter.Write([Byte]0)
$icoWriter.Write([Byte]0)
$icoWriter.Write([UInt16]1)
$icoWriter.Write([UInt16]32)
$icoWriter.Write([UInt32]$pngBytes.Length)
$icoWriter.Write([UInt32]22)
$icoWriter.Write($pngBytes)
$icoWriter.Flush()
[System.IO.File]::WriteAllBytes($faviconIcoPath, $icoStream.ToArray())
$icoWriter.Dispose()
$icoStream.Dispose()

$source.Dispose()

Write-Host "Muv'it brand icons generated from public\muvit-logo.png"
