# ============================================================
#  tools/bump.ps1 — 캐시 버전 올리기
# ------------------------------------------------------------
#  powershell -File tools/bump.ps1
#
#  CSS 나 JS 를 고쳐서 배포할 때 한 번 실행하세요.
#  index.html / main.js / stack.js / delaminate.js 여섯 군데의
#  ?v=... 값을 오늘 날짜 기준으로 한꺼번에 맞춥니다.
#  이걸 빼먹으면 방문자 브라우저가 옛 파일을 계속 씁니다.
# ============================================================

$site  = Split-Path -Parent $PSScriptRoot
$files = @(
  (Join-Path $site 'index.html'),
  (Join-Path $site 'assets\js\main.js'),
  (Join-Path $site 'assets\js\gl\stack.js'),
  (Join-Path $site 'assets\js\gl\delaminate.js')
)

# 현재 값 찾기
$current = $null
foreach ($f in $files) {
  $m = [regex]::Match((Get-Content $f -Raw -Encoding UTF8), '\.(?:css|m?js)\?v=([\w\-\.]+)')
  if ($m.Success) { $current = $m.Groups[1].Value; break }
}
if (-not $current) { Write-Host "?v= 표시를 못 찾았습니다. 중단합니다." -ForegroundColor Red; exit 1 }

# 새 값: 날짜 + 같은 날 두 번째부터는 -2, -3 …
$today = Get-Date -Format 'yyyyMMdd'
$new   = $today
if ($current -match "^$today(?:-(\d+))?$") {
  $n = if ($Matches[1]) { [int]$Matches[1] + 1 } else { 2 }
  $new = "$today-$n"
}

$count = 0
foreach ($f in $files) {
  $text = Get-Content $f -Raw -Encoding UTF8
  # Image versions are content hashes. Never replace them with a CSS/JS date.
  $pattern = '(\.(?:css|m?js)\?v=)[\w\-\.]+'
  $hits = ([regex]::Matches($text, $pattern)).Count
  if ($hits -gt 0) {
    $updated = [regex]::Replace($text, $pattern, { param($m) $m.Groups[1].Value + $new })
    [System.IO.File]::WriteAllText($f, $updated, (New-Object System.Text.UTF8Encoding($false)))
    $count += $hits
    Write-Host ("  {0,-28} {1} 곳" -f (Split-Path $f -Leaf), $hits)
  }
}

Write-Host ""
Write-Host "  $current  →  $new   (총 $count 곳)" -ForegroundColor Green
Write-Host ""
