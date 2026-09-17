Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$logoPath = Join-Path $projectRoot "public\muvit-logo.png"
$outputPath = Join-Path $projectRoot "public\og-image.jpg"

$canvas = New-Object System.Drawing.Bitmap 1200, 630
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.Clear([System.Drawing.Color]::FromArgb(13, 146, 244))

$logo = [System.Drawing.Image]::FromFile($logoPath)
$logoRect = New-Object System.Drawing.Rectangle 55, 55, 520, 520
$graphics.DrawImage($logo, $logoRect)

$titleFont = New-Object System.Drawing.Font "Arial", 76, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$taglineFont = New-Object System.Drawing.Font "Arial", 38, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)

$graphics.DrawString("Muv'it", $titleFont, $whiteBrush, 625, 210)
$graphics.DrawString("Create. Connect. Grow.", $taglineFont, $whiteBrush, 625, 315)

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq "image/jpeg"
$qualityEncoder = [System.Drawing.Imaging.Encoder]::Quality
$encoderParameters = New-Object System.Drawing.Imaging.EncoderParameters 1
$encoderParameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter $qualityEncoder, 92L
$canvas.Save($outputPath, $jpegCodec, $encoderParameters)

$encoderParameters.Dispose()
$whiteBrush.Dispose()
$taglineFont.Dispose()
$titleFont.Dispose()
$logo.Dispose()
$graphics.Dispose()
$canvas.Dispose()

Write-Output "Created $outputPath (1200x630)"
