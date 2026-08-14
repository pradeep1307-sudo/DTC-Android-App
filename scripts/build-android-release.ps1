$ErrorActionPreference = 'Stop'

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$jdk = Join-Path $root '.local-tools\jdk-21.0.12+8'
$sdk = 'C:\Users\HP\AppData\Local\Android\Sdk'
$gradleHome = Join-Path $root '.gradle-cache'

if (-not (Test-Path -LiteralPath (Join-Path $jdk 'bin\java.exe') -PathType Leaf)) {
  throw "Project JDK 21 is missing at $jdk"
}
if (-not (Test-Path -LiteralPath (Join-Path $sdk 'platforms') -PathType Container)) {
  throw "Android SDK is missing at $sdk"
}

$env:JAVA_HOME = $jdk
$env:ANDROID_HOME = $sdk
$env:GRADLE_USER_HOME = $gradleHome
$env:GRADLE_OPTS = '-Dorg.gradle.vfs.watch=false'

& (Join-Path $root 'android\gradlew.bat') -p (Join-Path $root 'android') bundleRelease --no-daemon --max-workers=1
if ($LASTEXITCODE -ne 0) { throw 'Android release bundle build failed.' }

$bundle = Join-Path $root 'android\app\build\outputs\bundle\release\app-release.aab'
if (-not (Test-Path -LiteralPath $bundle -PathType Leaf)) { throw 'Gradle succeeded but no release bundle was found.' }

$hash = Get-FileHash -Algorithm SHA256 -LiteralPath $bundle
Write-Output "Release bundle: $bundle"
Write-Output "SHA-256: $($hash.Hash)"
if (-not $env:DTC_KEYSTORE_FILE) {
  Write-Warning 'Bundle is unsigned. Set the four DTC_KEYSTORE_* variables described in PUBLISHING.md for Play upload signing.'
}
