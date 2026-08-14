param([switch]$Once)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$adbPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
$apkPath = Join-Path $projectRoot 'app\build\outputs\apk\debug\app-debug.apk'
$packageName = 'org.denvertamilchurch.app'
$activityName = 'org.denvertamilchurch.app/.MainActivity'
$lastDevice = ''

if (-not (Test-Path -LiteralPath $adbPath -PathType Leaf)) {
    Write-Error "ADB was not found at $adbPath. Install Android SDK Platform Tools or update adbPath in this script."
}

if (-not (Test-Path -LiteralPath $apkPath -PathType Leaf)) {
    $javaHome = 'C:\Program Files\Android\Android Studio\jbr'
    if (Test-Path -LiteralPath $javaHome -PathType Container) { $env:JAVA_HOME = $javaHome }
    Push-Location $projectRoot
    try {
        & '.\gradlew.bat' assembleDebug
        if ($LASTEXITCODE -ne 0) { throw 'The initial Android debug build failed.' }
    } finally {
        Pop-Location
    }
}

Write-Output 'DTC device watcher started'

while ($true) {
    $connected = @(& $adbPath devices | Select-String '\tdevice$' | ForEach-Object { ($_.Line -split "`t")[0] })
    $device = $connected | Select-Object -First 1

    if ($device -and $device -ne $lastDevice) {
        Write-Output "Android device connected: $device"
        & $adbPath -s $device install -r $apkPath
        if ($LASTEXITCODE -eq 0) {
            & $adbPath -s $device shell am force-stop $packageName
            & $adbPath -s $device shell am start -n $activityName
            Write-Output 'Denver Tamil Church app launched'
        } else {
            Write-Warning 'APK installation failed. Reconnect the device after checking USB debugging authorization.'
        }
        $lastDevice = $device
    } elseif (-not $device -and $lastDevice) {
        Write-Output 'Android device disconnected'
        $lastDevice = ''
    }

    if (-not $device) { Write-Output 'Waiting for Android device' }
    if ($Once) { break }
    Start-Sleep -Seconds 3
}
