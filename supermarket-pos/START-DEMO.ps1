$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$localRoot = Join-Path $projectRoot '.local'
$backendRoot = Join-Path $projectRoot 'backend'
$frontendRoot = Join-Path $projectRoot 'frontend'
$pgRoot = Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName 'bin\pg_ctl.exe') } | Sort-Object Name -Descending | Select-Object -First 1
if (-not $pgRoot) { throw 'Install PostgreSQL 14 or newer first. Its command-line tools are required.' }
Get-Command node,npm.cmd -ErrorAction Stop | Out-Null
$pgBin = Join-Path $pgRoot.FullName 'bin'
$pgData = Join-Path $localRoot 'pgdata'
$demoEnv = Join-Path $localRoot 'demo.env'
New-Item -ItemType Directory -Force -Path $localRoot | Out-Null
function Invoke-Checked([scriptblock]$Step) { & $Step; if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code $LASTEXITCODE" } }
if (-not (Test-Path $demoEnv)) {
  $dbPassword = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
  $tokenSecret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
  @(
    'NODE_ENV=production', 'PORT=4010', 'CORS_ORIGIN=http://localhost:4010',
    "DATABASE_URL=postgresql://pos_demo:${dbPassword}@127.0.0.1:55440/pos_demo",
    "ACCESS_TOKEN_SECRET=$tokenSecret", "PG_BIN_DIR=$pgBin", "BACKUP_DIR=$localRoot\backups",
    'BACKUP_INTERVAL_HOURS=24', 'SEED_DEMO=true'
  ) | Set-Content -LiteralPath $demoEnv -Encoding utf8
}
Get-Content -LiteralPath $demoEnv | ForEach-Object { $pair = $_ -split '=',2; [Environment]::SetEnvironmentVariable($pair[0],$pair[1],'Process') }
if (-not (Test-Path (Join-Path $pgData 'PG_VERSION'))) {
  $passwordFile = Join-Path $localRoot 'init-password.txt'
  $dbUri = [Uri]$env:DATABASE_URL
  ($dbUri.UserInfo -split ':',2)[1] | Set-Content -LiteralPath $passwordFile -Encoding utf8NoBOM
  try { Invoke-Checked { & "$pgBin\initdb.exe" -D $pgData -U pos_demo --auth=scram-sha-256 --encoding=UTF8 --locale=C "--pwfile=$passwordFile" } }
  finally { Remove-Item -LiteralPath $passwordFile -ErrorAction SilentlyContinue }
  Add-Content -LiteralPath (Join-Path $pgData 'postgresql.conf') -Value "`nlisten_addresses = '127.0.0.1'`nport = 55440"
}
& "$pgBin\pg_ctl.exe" -D $pgData status *> $null
if ($LASTEXITCODE -ne 0) { Invoke-Checked { & "$pgBin\pg_ctl.exe" -D $pgData -l (Join-Path $localRoot 'postgres.log') start } }
$env:PGPASSWORD = ([Uri]$env:DATABASE_URL).UserInfo.Split(':',2)[1]
$exists = & "$pgBin\psql.exe" -h 127.0.0.1 -p 55440 -U pos_demo -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='pos_demo'"
if ($exists -ne '1') { Invoke-Checked { & "$pgBin\createdb.exe" -h 127.0.0.1 -p 55440 -U pos_demo pos_demo } }
Push-Location $backendRoot
try {
  Invoke-Checked { npm.cmd ci --include=dev }
  Invoke-Checked { npm.cmd run prisma:generate }
  Invoke-Checked { npm.cmd run prisma:deploy }
  if (-not (Test-Path (Join-Path $localRoot 'seeded'))) { Invoke-Checked { npm.cmd run prisma:seed }; New-Item -ItemType File (Join-Path $localRoot 'seeded') | Out-Null }
  Invoke-Checked { npm.cmd run build }
} finally { Pop-Location }
Push-Location $frontendRoot
try { $env:VITE_API_BASE_URL='/api'; Invoke-Checked { npm.cmd ci --include=dev }; Invoke-Checked { npm.cmd run typecheck }; Invoke-Checked { npm.cmd run build } } finally { Pop-Location }
try { $health = Invoke-RestMethod 'http://localhost:4010/api/health' } catch { $health = $null }
if (-not $health) {
  $server = Start-Process -FilePath (Get-Command node).Source -ArgumentList 'dist/server.js' -WorkingDirectory $backendRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $localRoot 'api.log') -RedirectStandardError (Join-Path $localRoot 'api-error.log') -PassThru
  $server.Id | Set-Content (Join-Path $localRoot 'api.pid')
}
Write-Host 'Demo: http://localhost:4010 — admin / Admin@12345'
Write-Host 'Demo data only. For a real store, follow docs/DEPLOYMENT.md.'
