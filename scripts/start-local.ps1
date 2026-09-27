param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$localDir = Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Force -Path $localDir | Out-Null
function Test-Ready([string]$Url) {
  try { return (Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { return $false }
}
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'apps/api/dist/main.js')) -or -not (Test-Path -LiteralPath (Join-Path $projectRoot 'apps/web/.next/BUILD_ID'))) {
  throw 'App chua duoc bien dich. Chay npm run build trong thu muc du an truoc.'
}
$nodeExe = (Get-Command node.exe).Source
$env:APP_MODE = 'local-demo'
$env:NODE_ENV = 'production'
$env:APP_ORIGIN = 'http://127.0.0.1:3000'
$env:COOKIE_SECURE = 'false'
# This launcher is strictly for the local demo, never a production database.
Remove-Item Env:DATABASE_API_URL,Env:DATABASE_AUTH_URL,Env:DATABASE_WORKER_URL -ErrorAction SilentlyContinue
$processes = @()
if (-not (Test-Ready 'http://127.0.0.1:3001/api/v1/health')) {
  $apiEntry = Join-Path $projectRoot 'apps/api/dist/main.js'
  $p = Start-Process -FilePath $nodeExe -ArgumentList @(('"' + $apiEntry + '"')) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $localDir 'api.log') -RedirectStandardError (Join-Path $localDir 'api-error.log')
  $processes += @{ id=$p.Id; entry=$apiEntry }
  for ($i=0; $i -lt 45; $i++) { if (Test-Ready 'http://127.0.0.1:3001/api/v1/health') { break }; Start-Sleep -Seconds 1 }
  if (-not (Test-Ready 'http://127.0.0.1:3001/api/v1/health')) { throw 'May chu du lieu chua san sang. Xem .local/api-error.log.' }
}
if (-not (Test-Ready 'http://127.0.0.1:3000')) {
  $webEntry = Join-Path $projectRoot 'node_modules/next/dist/bin/next'
  $webDir = Join-Path $projectRoot 'apps/web'
  $p = Start-Process -FilePath $nodeExe -ArgumentList @(('"' + $webEntry + '"'),'start','--hostname','127.0.0.1','--port','3000') -WorkingDirectory $webDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $localDir 'web.log') -RedirectStandardError (Join-Path $localDir 'web-error.log')
  $processes += @{ id=$p.Id; entry=$webEntry }
  for ($i=0; $i -lt 30; $i++) { if (Test-Ready 'http://127.0.0.1:3000') { break }; Start-Sleep -Seconds 1 }
}
if ($processes.Count -gt 0) { ConvertTo-Json -InputObject @($processes) | Set-Content -LiteralPath (Join-Path $localDir 'app-processes.json') -Encoding utf8 }
if (-not (Test-Ready 'http://127.0.0.1:3000')) { throw 'Giao dien chua san sang. Xem .local/web-error.log.' }
Write-Output 'App san sang tai http://127.0.0.1:3000'
if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:3000' }

