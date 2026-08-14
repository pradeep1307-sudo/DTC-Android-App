$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$logoPath = Join-Path $root 'android\aicon.png'
if (-not (Test-Path -LiteralPath $logoPath -PathType Leaf)) { throw "Logo not found: $logoPath" }
$logo = [System.Drawing.Image]::FromFile($logoPath)
$navy = [System.Drawing.ColorTranslator]::FromHtml('#071D49')

function Save-BrandedSquare([string]$path, [int]$size, [double]$logoWidthRatio = 0.76) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear($navy)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $width = [int]($size * $logoWidthRatio)
  $height = [int]($width * $logo.Height / $logo.Width)
  $graphics.DrawImage($logo, [int](($size - $width) / 2), [int](($size - $height) / 2), $width, $height)
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose()
}

$densities = @{ 'mdpi' = 48; 'hdpi' = 72; 'xhdpi' = 96; 'xxhdpi' = 144; 'xxxhdpi' = 192 }
foreach ($density in $densities.Keys) {
  $folder = Join-Path $root "android\app\src\main\res\mipmap-$density"
  foreach ($name in @('ic_launcher.png', 'ic_launcher_round.png')) {
    Save-BrandedSquare (Join-Path $folder $name) $densities[$density]
  }
  Save-BrandedSquare (Join-Path $folder 'ic_launcher_foreground.png') $densities[$density] 0.66
}

$splashTargets = Get-ChildItem (Join-Path $root 'android\app\src\main\res') -Recurse -Filter 'splash.png' -File
foreach ($target in $splashTargets) {
  $existing = [System.Drawing.Image]::FromFile($target.FullName)
  $width = $existing.Width; $height = $existing.Height; $existing.Dispose()
  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear($navy)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $logoWidth = [int]([Math]::Min($width * 0.55, $height * 0.42 * $logo.Width / $logo.Height))
  $logoHeight = [int]($logoWidth * $logo.Height / $logo.Width)
  $graphics.DrawImage($logo, [int](($width - $logoWidth) / 2), [int](($height - $logoHeight) / 2), $logoWidth, $logoHeight)
  $bitmap.Save($target.FullName, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose()
}

$logo.Dispose()
Write-Output 'Generated branded Android icon and splash assets.'
