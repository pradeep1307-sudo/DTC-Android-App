$ErrorActionPreference = 'Stop'

$source = 'C:\Users\HP\.vscode\DTC App'
$destination = Join-Path $PSScriptRoot '..\www'
$destination = [System.IO.Path]::GetFullPath($destination)

if (-not (Test-Path -LiteralPath (Join-Path $source 'index.html') -PathType Leaf)) {
  throw "Web source not found at $source"
}

New-Item -ItemType Directory -Force -Path $destination | Out-Null

$publicFiles = @(
  'index.html', 'contact.html', 'event-details.html', 'events.html',
  'gallery.html', 'give.html', 'live.html', 'ministry.html', 'missions.html', 'open-bible.html',
  'design-system.css', 'styles.css', 'favicon.ico', 'lOGO.png'
)

foreach ($file in $publicFiles) {
  Copy-Item -LiteralPath (Join-Path $source $file) -Destination (Join-Path $destination $file) -Force
}

foreach ($directory in @('assets', 'js')) {
  $target = Join-Path $destination $directory
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  Copy-Item -Path (Join-Path $source "$directory\*") -Destination $target -Recurse -Force
}

# The native bridge handles external schemes and target=_blank links.
$bridge = '<script src="mobile-bridge.js"></script>'
Get-ChildItem -LiteralPath $destination -Filter '*.html' -File | ForEach-Object {
  $content = Get-Content -Raw -LiteralPath $_.FullName
  if ($content -notmatch 'mobile-bridge\.js') {
    $content = $content -replace '</body>', "$bridge`r`n  </body>"
    Set-Content -LiteralPath $_.FullName -Value $content -Encoding utf8
  }
}

Write-Output "Synchronized public website into $destination"
