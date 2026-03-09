$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$port = 3000

# Avoid duplicate instances when the service is already listening.
$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  exit 0
}

$logDir = Join-Path $projectRoot "logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

$stdoutLog = Join-Path $logDir "autostart.out.log"
$stderrLog = Join-Path $logDir "autostart.err.log"

Start-Process `
  -FilePath "node" `
  -ArgumentList "src/server.js" `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog
