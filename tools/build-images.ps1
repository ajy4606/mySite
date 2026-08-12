param(
  [string[]]$Only = @('midore','full-metal-plant','hwanggok-colorized','hwanggok'),
  [switch]$Help
)

# ============================================================
#  tools/build-images.ps1 — 원본을 웹용으로 리사이즈
# ------------------------------------------------------------
#  powershell -File tools/build-images.ps1
#     → 작품 네 시리즈만 다시 만듭니다 (전시 전경은 건드리지 않음)
#
#  powershell -File tools/build-images.ps1 -Only installation
#     → 전시 전경만
#
#  powershell -File tools/build-images.ps1 -Only all
#     → 전부
#
#  powershell -File tools/build-images.ps1 -Help
#     → 사용법과 폴더 이름 안내
#
#  대상 폴더는 통째로 지우고 다시 만듭니다. assets/works/ 안의 파일을
#  직접 고치지 마세요 — 전부 여기서 생성된 것입니다.
#
#  이 스크립트만 돌리면 사진 파일만 바뀝니다. 페이지에 반영하려면 이어서
#  node tools/gen-plates.js 까지 돌려야 합니다 (deploy.ps1이 둘 다 합니다).
# ============================================================

if ($Help) {
  Write-Host ""
  Write-Host "  사진 넣는 곳" -ForegroundColor Cyan
  Write-Host "    images\Midore\            → 미도래"
  Write-Host "    images\FullMetalPlant\    → 풀 메탈 플랜트"
  Write-Host "    images\Hwanggok_colorized\→ 황곡_컬러라이즈드"
  Write-Host "    images\Hwanggok\          → 황곡"
  Write-Host "    images\Installation\      → 전시 전경"
  Write-Host ""
  Write-Host "  파일 이름이 곧 캡션입니다" -ForegroundColor Cyan
  Write-Host "    제목 #번호, 크기cm, 매체, 연도.jpg"
  Write-Host "    예)  Hwanggok #73, 60x80cm, Archival Pigment Print, 2022.jpg"
  Write-Host "    이 형식이 아니면 캡션 자리에 '매체 · 크기 입력'이 남습니다."
  Write-Host ""
  Write-Host "  실행" -ForegroundColor Cyan
  Write-Host "    powershell -File tools\build-images.ps1                 (작품 4개 시리즈)"
  Write-Host "    powershell -File tools\build-images.ps1 -Only installation"
  Write-Host "    powershell -File tools\build-images.ps1 -Only all"
  Write-Host ""
  exit 0
}

Add-Type -AssemblyName System.Drawing

# 폴더를 옮기거나 이름을 바꿔도 따라오도록 스크립트 위치에서 거슬러 올라갑니다.
$site = Split-Path -Parent $PSScriptRoot
$src  = Join-Path $site 'images'
$dst  = Join-Path $site 'assets\works'

if (-not (Test-Path $src)) {
  Write-Host ""
  Write-Host "  원본 폴더를 못 찾았습니다: $src" -ForegroundColor Red
  Write-Host "  mySite 폴더 안에 images\ 가 있어야 합니다." -ForegroundColor Red
  Write-Host ""
  exit 1
}
if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Force -Path $dst | Out-Null }

$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }

# 폴더 이름 → 슬러그. 작가님이 폴더 이름을 바꾸면 여기도 고쳐야 합니다.
$slugs = [ordered]@{
  'Midore'             = 'midore'
  'FullMetalPlant'     = 'full-metal-plant'
  'Hwanggok_colorized' = 'hwanggok-colorized'
  'Hwanggok'           = 'hwanggok'
  'Installation'       = 'installation'
}
if ($Only -contains 'all') { $Only = $slugs.Values }

# 오타로 아무것도 안 만들어지는 일이 없도록 먼저 확인합니다.
$known = @($slugs.Values)
$bad   = @($Only | Where-Object { $known -notcontains $_ })
if ($bad.Count -gt 0) {
  Write-Host ""
  Write-Host ("  모르는 이름입니다: " + ($bad -join ', ')) -ForegroundColor Red
  Write-Host ("  쓸 수 있는 이름: " + ($known -join ', ') + ", all") -ForegroundColor Yellow
  Write-Host ""
  exit 1
}

function Save-Resized($img, $dstPath, $maxDim, $quality) {
  $scale = [Math]::Min(1.0, $maxDim / [Math]::Max($img.Width, $img.Height))
  $nw = [int][Math]::Round($img.Width * $scale)
  $nh = [int][Math]::Round($img.Height * $scale)
  $bmp = New-Object System.Drawing.Bitmap($nw, $nh)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Black)          # flatten any alpha onto the site ground
  $g.InterpolationMode  = 'HighQualityBicubic'
  $g.SmoothingMode      = 'HighQuality'
  $g.PixelOffsetMode    = 'HighQuality'
  $g.CompositingQuality = 'HighQuality'
  $g.DrawImage($img, 0, 0, $nw, $nh)
  $g.Dispose()
  $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$quality)
  $bmp.Save($dstPath, $jpeg, $ep)
  $bmp.Dispose()
  return @{ w = $nw; h = $nh }
}

# System.Drawing exposes raw pixels and does not apply the camera's EXIF
# rotation automatically. Normalize it before creating the web copies.
function Apply-ExifOrientation($img) {
  try {
    if ($img.PropertyIdList -notcontains 274) { return }
    $orientation = [BitConverter]::ToUInt16($img.GetPropertyItem(274).Value, 0)
    switch ($orientation) {
      3 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
      6 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
      8 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
    }
  } catch {
    # Bad or missing metadata must not stop the remaining image build.
  }
}

# 자리 바꾸기 — 작품 번호순이 아닌 자리에 두고 싶을 때만 씁니다.
#   슬러그 = @{ 작품번호 = 놓고싶은자리의번호 }
# 아래는 《미도래》 #21과 #23의 자리를 맞바꾼 것입니다. 파일 이름은 그대로 두고
# 여기만 고치면 되고, 새 이미지를 넣어도 이 규칙은 그대로 유지됩니다.
$rankOverride = @{
  'midore' = @{ 21 = 23; 23 = 21 }
}

# 순서: 시리즈 제목이 붙은 것부터 번호순, 그 다음 개별 제목이 붙은 것 이름순.
# 파일명이 "Midore #21, ..." 이면 21번으로, "Aralia, ..." 면 제목순으로 갑니다.
function Get-SortKeys($name, $seriesTitle, $rank) {
  $title = ($name -replace '\.(jpg|jpeg|png)$','') -split ',' | Select-Object -First 1
  $title = $title.Trim()
  $num = 99999
  if ($title -match '#\s*(\d+)') { $num = [int]$Matches[1] }
  $prefix = ($title -replace '#\s*\d+\s*$','').Trim()
  $isSeries = if ($prefix -replace '\s','' -ieq ($seriesTitle -replace '\s','')) { 0 } else { 1 }
  $key = if ($rank -and $rank.ContainsKey($num)) { $rank[$num] } else { $num }
  return @($isSeries, $prefix, $key)
}

# 기존 매니페스트에서 이번에 안 건드리는 시리즈는 그대로 살립니다
$manifestPath = Join-Path $dst 'manifest.json'
$kept = @()
if (Test-Path $manifestPath) {
  # PS 5.1\uC758 ConvertFrom-Json\uC740 \uBC30\uC5F4\uC744 \uD3BC\uCE58\uC9C0 \uC54A\uACE0 \uD1B5\uC9F8\uB85C \uB0B4\uBCF4\uB0C5\uB2C8\uB2E4.
  # \uBC18\uB4DC\uC2DC \uBCC0\uC218\uC5D0 \uBA3C\uC800 \uBC1B\uC740 \uB4A4\uC5D0 \uAC78\uB7EC\uC57C \uD569\uB2C8\uB2E4 (\uD30C\uC774\uD504\uC5D0 \uBC14\uB85C \uBB3C\uB9AC\uBA74 \uC804\uBD80 \uD1B5\uACFC).
  $prev = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $kept = @($prev | Where-Object { $Only -notcontains $_.project })
}

$fresh = @()
foreach ($folder in $slugs.Keys) {
  $slug = $slugs[$folder]
  if ($Only -notcontains $slug) { continue }
  $inDir = Join-Path $src $folder
  if (-not (Test-Path $inDir)) {
    Write-Host "  !! 원본 폴더가 없습니다: images\$folder" -ForegroundColor Yellow
    Write-Host "     (폴더 이름을 바꾸셨다면 이 스크립트 위쪽 `$slugs 목록도 같이 고쳐야 합니다)" -ForegroundColor Yellow
    continue
  }

  $outDir = Join-Path $dst $slug
  if (Test-Path $outDir) { Remove-Item (Join-Path $outDir '*') -Force }
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null

  $seriesTitle = switch ($slug) {
    'midore'             { 'Midore' }
    'full-metal-plant'   { 'Full Metal Plant' }
    'hwanggok-colorized' { 'Hwanggok_Colorized' }
    'hwanggok'           { 'Hwanggok' }
    default              { '' }
  }

  $rank = $rankOverride[$slug]

  $files = Get-ChildItem $inDir -File |
           Where-Object { $_.Extension -match '\.(jpg|jpeg|png)$' } |
           Sort-Object @{ Expression = { (Get-SortKeys $_.Name $seriesTitle $rank)[0] } },
                       @{ Expression = { (Get-SortKeys $_.Name $seriesTitle $rank)[1] } },
                       @{ Expression = { (Get-SortKeys $_.Name $seriesTitle $rank)[2] } },
                       Name

  if ($files.Count -eq 0) {
    Write-Host "  !! images\$folder 안에 jpg/png 가 없습니다 — 건너뜁니다" -ForegroundColor Yellow
    continue
  }

  $i = 0
  foreach ($f in $files) {
    $i++
    $nn = '{0:d2}' -f $i

    # 사진 한 장이 깨져 있어도 나머지는 계속 만들도록 감쌉니다.
    try   {
      $img = [System.Drawing.Image]::FromFile($f.FullName)
      Apply-ExifOrientation $img
    }
    catch {
      Write-Host "  !! 못 읽는 파일이라 건너뜁니다: $($f.Name)" -ForegroundColor Yellow
      $i--
      continue
    }
    try {
      $big = Save-Resized $img (Join-Path $outDir "$nn.jpg")     1600 84
      $sm  = Save-Resized $img (Join-Path $outDir "$nn-sm.jpg")   800 80
    } finally { $img.Dispose() }

    $fresh += [pscustomobject]@{
      project = $slug
      n       = $nn
      file    = "assets/works/$slug/$nn.jpg"
      thumb   = "assets/works/$slug/$nn-sm.jpg"
      orig    = $f.Name
      w       = $big.w
      h       = $big.h
    }
  }
  "  {0,-20} {1,3} images" -f $slug, $i
}

$all = @($fresh) + @($kept)
# Windows PowerShell aligns JSON property values with spaces. Strip only the
# line-end padding so generated manifests stay clean in Git diffs.
$json = ($all | ConvertTo-Json -Depth 4) -replace '(?m)[ \t]+(?=\r?$)', ''
$json = ($json -replace "\r\n", "\n").TrimEnd() + "\n"
[System.IO.File]::WriteAllText($manifestPath, $json, (New-Object System.Text.UTF8Encoding($false)))
""
"  rebuilt: " + $fresh.Count + "   kept untouched: " + $kept.Count
