param(
  [switch]$All,
  [switch]$SkipImages,
  [string]$Message,
  [switch]$Help
)

if ($Help) {
  Write-Host ""
  Write-Host '  powershell -File tools\deploy.ps1' -ForegroundColor Cyan
  Write-Host '      Rebuild the four work series, refresh the page, and commit.'
  Write-Host '  powershell -File tools\deploy.ps1 -All' -ForegroundColor Cyan
  Write-Host '      Also rebuild the installation photographs.'
  Write-Host '  powershell -File tools\deploy.ps1 -SkipImages' -ForegroundColor Cyan
  Write-Host '      Skip images; refresh cache versions and commit only.'
  Write-Host '  powershell -File tools\deploy.ps1 -Message "Add new work"' -ForegroundColor Cyan
  Write-Host '      Set the commit message.'
  Write-Host ""
  exit 0
}

$ErrorActionPreference = 'Stop'
$site = Split-Path -Parent $PSScriptRoot
Set-Location $site

# $LASTEXITCODE is undefined until a native command runs, and a PowerShell
# script that ends without an explicit `exit` leaves it untouched. Both
# build-images.ps1 and bump.ps1 do exactly that on success, so an unguarded
# check would compare $null against 0, decide that failed, and abort a run
# that had in fact worked. Start from a known value and treat $null as fine.
$global:LASTEXITCODE = 0

function Step([int]$Number, [string]$Text) {
  Write-Host ""
  Write-Host "  [$Number] $Text" -ForegroundColor Cyan
  Write-Host '  ------------------------------------------------'
}

function Stop-OnFailure([string]$Task) {
  if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw "Failed during: $Task" }
  $global:LASTEXITCODE = 0   # don't let one step's code leak into the next check
}

Write-Host ""
Write-Host '  Portfolio site update' -ForegroundColor White
Write-Host "  Folder: $site"

if ($SkipImages) {
  Step 1 'Skipping image processing (-SkipImages)'
} else {
  Step 1 'Resizing images and generating the manifest'
  $projects = if ($All) {
    @('all')
  } else {
    @('midore', 'full-metal-plant', 'hwanggok-colorized', 'hwanggok')
  }
  & (Join-Path $PSScriptRoot 'build-images.ps1') -Only $projects
  Stop-OnFailure 'image processing'

  Step 2 'Updating plates in index.html'
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node was not found. Install Node.js and run this script again.'
  }
  if ($All) {
    & node (Join-Path $PSScriptRoot 'gen-plates.js') midore full-metal-plant hwanggok-colorized hwanggok installation
  } else {
    & node (Join-Path $PSScriptRoot 'gen-plates.js')
  }
  Stop-OnFailure 'plate generation'
}

Step 3 'Refreshing browser cache versions'
& (Join-Path $PSScriptRoot 'bump.ps1')
Stop-OnFailure 'cache version refresh'

Step 4 'Creating a Git commit'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'Git was not found. Install Git and run this script again.'
}
if (-not (Test-Path -LiteralPath (Join-Path $site '.git'))) {
  throw 'This is not a Git repository. Run tools\setup-git.ps1 first.'
}

# A crashed or interrupted Git leaves .git\index.lock behind, and every later
# `git add` refuses to run until it is gone. The message Git gives is easy to
# miss, so say plainly what happened and what to do.
$indexLock = Join-Path $site '.git\index.lock'
if (Test-Path -LiteralPath $indexLock) {
  $age = (Get-Date) - (Get-Item -LiteralPath $indexLock).LastWriteTime
  Write-Host '  A leftover Git lock file is blocking this commit.' -ForegroundColor Yellow
  Write-Host ("  .git\index.lock  (created {0:N0} minutes ago)" -f $age.TotalMinutes)
  Write-Host '  If no other Git program is running, remove it and try again:'
  Write-Host '    Remove-Item .git\index.lock' -ForegroundColor Cyan
  throw 'Git index is locked.'
}

# Git writes ordinary notices to stderr — "LF will be replaced by CRLF" is the
# usual one on Windows. Under $ErrorActionPreference = 'Stop', PowerShell 5.1
# promotes any stderr line from a native command into a TERMINATING error the
# moment the output is redirected, so that harmless notice killed this script
# immediately after staging, with no message and no commit. Exit codes are the
# dependable signal for native commands, and Stop-OnFailure already reads them.
$ErrorActionPreference = 'Continue'

git add -A 2>&1 | Out-Null
Stop-OnFailure 'git add'
$staged = @(git diff --cached --name-only)
if ($staged.Count -eq 0) {
  Write-Host '  Nothing changed; no commit was created.' -ForegroundColor Yellow
  Write-Host ""
  exit 0
}

Write-Host '  Files to commit:'
$staged | Select-Object -First 12 | ForEach-Object { Write-Host "    $_" }
$more = $staged.Count - 12
if ($more -gt 0) { Write-Host "    ... and $more more" }

if (-not $Message) { $Message = 'Site update ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') }
git commit -m $Message 2>&1 | Out-Null
Stop-OnFailure 'git commit'
Write-Host ""
Write-Host "  Commit complete: $Message" -ForegroundColor Green

Write-Host ""
if (@(git remote).Count -gt 0) {
  Write-Host '  Run git push to publish through the connected remote.' -ForegroundColor White
} else {
  Write-Host '  No GitHub remote is connected yet.' -ForegroundColor Yellow
  Write-Host '  See the first-time setup section in HOW-TO-UPDATE.md.'
}
Write-Host '  Local preview: powershell -File tools\serve.ps1' -ForegroundColor Cyan
Write-Host ""
