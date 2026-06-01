# One-time GitHub Actions setup for projektmelody-archive.
# Prereq: gh auth login
# Usage: powershell -File scripts/setup-github-secrets.ps1

$ErrorActionPreference = 'Stop'
$gh = Join-Path ${env:ProgramFiles} 'GitHub CLI\gh.exe'
if (-not (Test-Path $gh)) { throw 'Install GitHub CLI: winget install GitHub.cli' }

& $gh auth status | Out-Null

$envFile = Join-Path $PSScriptRoot '..' '.env' | Resolve-Path -ErrorAction SilentlyContinue
if (-not $envFile) { throw '.env not found — add DATABASE_URL first' }

$dbLine = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $dbLine) { throw 'DATABASE_URL missing in .env' }
$dbUrl = $dbLine.Substring('DATABASE_URL='.Length).Trim().Trim('"')

Write-Output 'Setting DATABASE_URL secret...'
$dbUrl | & $gh secret set DATABASE_URL

Write-Output 'Setting CLOUDFLARE_ACCOUNT_ID variable...'
& $gh variable set CLOUDFLARE_ACCOUNT_ID --body '029c2362a173b92515b65f5f7fb96f28'

if ($env:CLOUDFLARE_API_TOKEN) {
  Write-Output 'Setting CLOUDFLARE_API_TOKEN from env...'
  $env:CLOUDFLARE_API_TOKEN | & $gh secret set CLOUDFLARE_API_TOKEN
} else {
  Write-Warning @'
CLOUDFLARE_API_TOKEN not in environment.
Create at: https://dash.cloudflare.com/profile/api-tokens
  Template: Edit Cloudflare Workers (or custom: Account + Pages Edit)
Then run:
  $env:CLOUDFLARE_API_TOKEN = "your-token"
  powershell -File scripts/setup-github-secrets.ps1
'@
}

Write-Output 'Done. Push to master to trigger deploy + neon-sync workflows.'
