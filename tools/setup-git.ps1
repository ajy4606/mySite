$ErrorActionPreference = 'Stop'
$site = Split-Path -Parent $PSScriptRoot
$siteFull = [System.IO.Path]::GetFullPath($site).TrimEnd('\')
Set-Location $siteFull

function Stop-OnGitError([string]$Task) {
  if ($LASTEXITCODE -ne 0) { throw "Git failed: $Task" }
}

Write-Host ""
Write-Host "  Preparing Git repository: $siteFull" -ForegroundColor White
Write-Host ""

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'Git was not found. Install Git and run this script again.'
}

# Remove only the explicitly named temporary items under this site root.
Write-Host '  [1] Cleaning temporary files' -ForegroundColor Cyan
foreach ($name in @('_streak-prototype', 'probe.tmp')) {
  $candidate = [System.IO.Path]::GetFullPath((Join-Path $siteFull $name))
  if (-not $candidate.StartsWith($siteFull + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Unsafe cleanup path: $candidate"
  }
  if (Test-Path -LiteralPath $candidate) {
    Remove-Item -LiteralPath $candidate -Recurse -Force
    Write-Host "      Removed: $name"
  }
}

$gitDir = Join-Path $siteFull '.git'
$lock = Join-Path $gitDir 'index.lock'
if (Test-Path -LiteralPath $lock) {
  Remove-Item -LiteralPath $lock -Force
  Write-Host '      Removed: .git\index.lock'
}
$objects = Join-Path $gitDir 'objects'
if (Test-Path -LiteralPath $objects) {
  Get-ChildItem -LiteralPath $objects -Recurse -File -Filter 'tmp_obj_*' -ErrorAction SilentlyContinue |
    Remove-Item -Force -ErrorAction SilentlyContinue
}

Write-Host '  [2] Checking repository' -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $gitDir)) {
  git init -b main | Out-Null
  Stop-OnGitError 'git init'
  Write-Host '      Created a repository on branch main.'
} else {
  git rev-parse --git-dir | Out-Null
  Stop-OnGitError 'repository check'
  Write-Host '      Continuing the existing repository.'
}

Write-Host '  [3] Checking commit identity' -ForegroundColor Cyan
if (-not (git config user.name))  { git config user.name 'Ahn Jaeyoung' }
if (-not (git config user.email)) { git config user.email 'ajy4606@gmail.com' }
Write-Host ("      {0} <{1}>" -f (git config user.name), (git config user.email))

Write-Host '  [4] Creating the first commit' -ForegroundColor Cyan
git add -A
Stop-OnGitError 'git add'
$staged = @(git diff --cached --name-only)
if ($staged.Count -eq 0) {
  Write-Host '      Nothing new to commit.' -ForegroundColor Yellow
} else {
  git commit -m 'Initial portfolio site' | Out-Null
  Stop-OnGitError 'git commit'
  Write-Host ("      Committed {0} files." -f $staged.Count) -ForegroundColor Green
}

Write-Host ""
Write-Host '  The source images\ folder is excluded from Git.' -ForegroundColor Yellow
Write-Host '  Keep a separate copy on an external drive or cloud storage.' -ForegroundColor Yellow
Write-Host ""
Write-Host '  Next: create a GitHub repository, then run:' -ForegroundColor White
Write-Host '    git remote add origin https://github.com/<account>/<repository>.git' -ForegroundColor Cyan
Write-Host '    git push -u origin main' -ForegroundColor Cyan
Write-Host ""
