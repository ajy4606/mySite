# ahnjaeyoung.com — 작업 노트

> **직접 고치실 거면 [EDITING.md](EDITING.md) 를 먼저 보세요.**
> 이 문서는 왜 그렇게 만들었는지(디자인 의도·기술 배경)를 적어둔 것이고,
> EDITING.md 는 무엇을 어디서 어떻게 고치는지 단계별로 적어둔 것입니다.

## 디자인 컨셉 — LAYER / DELAMINATION (층위 / 박리)

작업의 핵심(이미지의 층위를 쌓고 해체하는 것)을 사이트의 구조 자체로 옮겼습니다.
장식이 아니라, 원고에 이미 적혀 있는 문장을 동작으로 옮긴 것들입니다.

- **홈 히어로** — 작품들이 3D 공간에 인화지처럼 겹쳐 쌓여 있고, **커서를 올리거나
  스크롤하면** 층이 부채처럼 벌어져 뒤에 깔린 시트의 가장자리가 드러납니다.
  맨 앞 시트는 일정 시간마다 카메라 앞으로 들려 나가 뒤로 다시 들어갑니다.
- **모든 도판** — 클릭하면 전체화면 해체 뷰어가 열리고, 좌우로 드래그하면
  이미지가 4단계로 분해됩니다. **시리즈마다 해체되는 방식이 다릅니다:**

  | 시리즈 | 방식 | 단계 |
  |---|---|---|
  | 황곡 | 등고선 | 원본 → 등고선 → 환원 → 도면 |
  | 황곡_컬러라이즈드 | 흑백 | 원본 → 탈색 → 흑백 → 계조 축소 |
  | 미도래 | 디더링 (색 유지 · 타일 분산) | 원본 → 그레인 → 임계 → 인덱스 |
  | 풀 메탈 플랜트 | 철 | 원본 → 담금 → 헤어라인 → 철 |
  | 전시 전경 | **없음** | — |

  **전시 전경 배열** — 순서는 www.ahnjaeyoung.com/installation 의 배열을 따릅니다.
  라이브 사이트의 25장 중 22장을 이미지 대조(perceptual hash)로 찾아 그 순서대로
  놓고, 그 뒤에 새로 주신 25장을 붙였습니다. 포스터를 뒤에 따로 모으지 않고
  전시별로 사이사이 두는 것이 작가님 배열이라 그대로 복원했습니다.
  순서를 바꾸려면 `tools/gen-plates.js` 의 `INSTALL_ORDER` 배열을 고치세요.
  레이아웃은 좌→우로 읽히는 justified row 입니다 (CSS 컬럼은 왼쪽 열을 끝까지
  내려간 뒤 다음 열로 가서 순서가 흩어졌습니다).

  **전시 전경은 어떤 효과도 걸지 않습니다.** 작품이 아니라 작품의 기록이라
  해체할 것이 없습니다. 히어로에서도, 상세 페이지에서도, 뷰어에서도
  원본 그대로입니다. 뷰어는 슬라이더·단계 표시 없이 단순 확대창으로 열리고
  도판 라벨도 `⤢ Enlarge` 로 바뀝니다 (셰이더 모드 5 = 무처리).

  **히어로에서 시트에 커서를 올리면** 그 작품이 자기 방식으로 해체됩니다.
  쉬는 상태에서는 거의 걸리지 않고(t=0.07), 호버 시 t=0.62까지 올라갑니다.

  황곡_컬러라이즈드의 흑백화는 특히 작업 자체를 거꾸로 돌리는 것입니다 —
  흑백 원판에 생성모델로 색을 입힌 작업이니, 해체하면 그 색이 다시 빠집니다.
  컨트롤 이름은 《미도래》의 **물성조절**을 씁니다 — "점도와 결을 조정해 섭취(보기)를
  돕되, 의미의 농도는 관람자가 직접 가늠하도록 남겨 둔다."
  뷰어를 열면 이미지가 해체 상태에서 원본으로 **조립되며 도래**합니다.

  방식은 `main.js` 의 `MODES` 에서 뷰 id별로 지정하고, 단계 이름은
  `delaminate.js` 의 `STAGE_SETS`, 실제 셰이더는 `shaders.js` 의 `modeXxx()`
  함수들입니다. 시리즈를 추가하면 세 곳을 같이 맞춰야 합니다.
- **층위(Layers) 매니페스트** — 작품마다 어떤 조작이 어떤 순서로 쌓였는지를
  아래에서 위로 읽는 스택으로 공개합니다. 다가가면 행이 부채처럼 벌어집니다.
- **관람의 잔흔** — 한 번 해체해 본 도판에는 옅은 망점이 남고, 인덱스의 해당
  작업에도 표식이 붙습니다. 원고의 "관람은 조용하지만 되돌릴 수 없는 변화를
  예고한다" / 『바늘』의 "외상 없이"를 그대로 옮긴 것이라, 흔적은 아주 옅습니다.
  방문(세션) 단위로만 남고 창을 닫으면 사라집니다.
- **개념의 실(Threads)** — 작품을 번호순 목록이 아니라 개념으로 가로지릅니다.
  단위 / 지표성 / 생성 모델 / 그럴듯한 허위 / 물성. 인덱스에서 필터로,
  작품 페이지에서는 다른 작업으로 건너뛰는 링크로 동작합니다.
- **스크롤** — 도판은 화면 중앙에서 멀수록 5개 층으로 어긋났다가, 중앙에 오면
  정확히 정렬됩니다.
- **KO / EN 토글** — 헤더에서 전환. 국문과 영문을 같은 페이지에 쌓지 않고
  하나씩 보여줍니다. 비평·서문은 국문만 있으므로 EN에서는 안내 문구가 뜹니다.
- **타이포** — Pretendard(본문·국영문) + IBM Plex Mono(라벨·캡션·수치).
  색은 무채색만 쓰고 위계는 밝기로만 만듭니다. 색은 작품에만 있습니다.
- 모서리 둥글기 0, 그림자 0, 헤어라인은 흰색 알파. 갤러리 인쇄물의 문법입니다.

## 참고한 레퍼런스

- **Trevor Paglen** (paglen.studio) — 작품을 연대기가 아니라 개념 태그 구름으로
  묶고 각 태그에 작품 수를 붙임. 이 사이트의 '개념의 실'이 여기서 왔습니다.
- **Rafaël Rozendaal** (newrafael.com) — 프로젝트가 아니라 존재 방식으로 구분
  (Exhibitions / Paintings / Internet / Texts / Info). 메타데이터를 극단적으로 줄임.
- **Thomas Ruff** (thomasruff.com) — DE/EN 언어 토글. 국제 활동 작가 사이트의 표준.
- 생성이미지 쪽에서 굳어지고 있는 **"generative layer"** 관행 — 프롬프트·시드·모델
  버전·마스크를 비파괴 컨테이너에 보존해 노출하는 것. 층위 매니페스트의 근거.
- (작가님이 원래 적어두셨던) Cargo 템플릿 `cargo.site/preview/1812426` 은 현재
  404. Framer 사례로 적어두셨던 Hannah Miles / Justin Bettman / Christopher
  Ireland 는 아직 확인하지 못했습니다.

## 파일 구조

```
index.html                 본문 전체 (해시 라우팅, 모든 원고 포함)
netlify.toml               배포 설정 (캐시 헤더)
robots.txt / sitemap.xml
assets/
  css/site.css             디자인 토큰 + 전체 스타일
  js/main.js               라우터, 스크롤 모션, 인덱스, 프리로더
  js/gl/shaders.js         GLSL — 해체 스택 (DATA / PIXEL / DOT)
  js/gl/stack.js           홈 히어로 3D 스택
  js/gl/delaminate.js      전체화면 해체 뷰어
  vendor/three.module.min.js   three.js r169 (로컬 고정)
  images/                  작품 이미지 (Wix에서 내려받아 로컬화)
```

## 로컬에서 보기

**index.html 더블클릭은 더 이상 동작하지 않습니다.** ES 모듈을 쓰기 때문에
`file://` 에서는 브라우저가 차단합니다. 로컬 서버를 띄우세요.

```bash
python -m http.server 5173 --directory "C:/Users/USER/Desktop/mySite"
```

그 다음 브라우저에서 `http://localhost:5173` 을 엽니다.

## 이미지

작가님이 `images/` 에 넣어주신 원본 102장을 프로젝트별로 리사이즈해
`assets/works/<슬러그>/` 에 넣었습니다. 원본 194MB → 웹용 53MB.
Wix CDN 의존은 완전히 끊었고, 예전에 Wix에서 받아뒀던 `assets/images/` 는
전부 대체되어 삭제했습니다. **원본 `images/` 폴더는 그대로 두었습니다** —
배포할 필요는 없지만 지우지 마세요, 다시 만들 때 필요합니다.

2026-08-08에 작가님이 `images/` 를 캡션 정리된 파일명으로 다시 올려주셔서
작품 네 시리즈를 전부 다시 만들었습니다. 전시 전경은 손대지 않았습니다.

| 폴더 | 장수 | 비고 |
|---|---|---|
| `assets/works/midore/` | 20 | 캡션 자동 생성 (이전 24장) |
| `assets/works/full-metal-plant/` | 13 | 캡션 자동 생성 (이전 10장) |
| `assets/works/hwanggok/` | 18 | 캡션 자동 생성 (이전 12장) |
| `assets/works/hwanggok-colorized/` | 10 | 캡션 자동 생성 (이전 9장) |
| `assets/works/installation/` | 47 | 전경 43 + 포스터/인쇄물 4. 순서·캡션 수작업 |

각 폴더에 `NN.jpg`(긴 변 1600px, 도판·해체 뷰어용)와 `NN-sm.jpg`(800px, 썸네일)가
있습니다. `assets/works/manifest.json` 에 원본 파일명이 남아 있어 어떤 도판이 어떤
원본인지 추적할 수 있습니다. 도판의 `data-orig` 속성에도 들어 있습니다.

**대표 이미지** — 시리즈의 첫 도판이 아니라 작가님이 고른 것입니다.
`NN` 은 정렬 후 자리번호라 작품 번호와 다릅니다. 바꾸려면 `manifest.json` 에서
해당 작품의 `file` 을 찾아 아래 세 곳(미도래는 다섯 곳)을 같이 고치세요.

| 시리즈 | 작품 | 파일 |
|---|---|---|
| 미도래 | Midore #14 | `midore/13.jpg` |
| 풀 메탈 플랜트 | Full Metal Plant #1 | `full-metal-plant/01.jpg` |
| 황곡_컬러라이즈드 | Hwanggok_Colorized #68 | `hwanggok-colorized/10.jpg` |
| 황곡 | Hwanggok #7 | `hwanggok/03.jpg` |
| 전시 전경 | — | `installation/14.jpg` |

1. `assets/js/main.js` 의 `WORKS` 배열 `src` — 히어로 스택
2. `index.html` 목록 행의 `data-peek` 와 `.thumb img` — `-sm.jpg` 로
3. `index.html` 그리드 카드의 `figure img` — `-sm.jpg` 로

미도래는 공유 이미지도 겸하므로 `og:image` 와 `<link rel="preload">` 도 같이
바뀝니다. 히어로 폴백 `<img>` 세 장(`.hero-fallback`)도 대표 이미지를 씁니다.

**자리 바꾸기** — 작품 번호순이 아닌 자리에 두고 싶으면 파일 이름을 건드리지 말고
`tools/build-images.ps1` 위쪽의 `$rankOverride` 만 고치세요.

```powershell
$rankOverride = @{
  'midore' = @{ 21 = 23; 23 = 21 }   # #21과 #23의 자리를 맞바꿈
}
```

`작품번호 = 놓고싶은자리의번호` 입니다. 새 이미지를 넣어도 이 규칙은 유지됩니다.

**캡션과 순서는 원본 파일 이름에서 나옵니다**

```
제목, 크기, 매체, 연도.jpg
Midore #21, 30x30cm, Archival Pigment Print, 2024.jpg
  → 《Midore》 #21, 2024 · Archival Pigment Print · 30 × 30 cm
```

`#번호` 순으로 놓이고, 번호가 없는 작품(《Aralia》 등)은 뒤에 제목순으로 붙습니다.
캡션을 고치려면 `index.html` 이 아니라 파일 이름을 고치고 다시 돌리세요.

**이미지를 추가하거나 바꿀 때**

1. `images/<프로젝트 이름>/` 에 원본을 넣습니다
   (`Midore` `FullMetalPlant` `Hwanggok` `Hwanggok_colorized` `Installation` —
   폴더 이름을 바꾸면 `build-images.ps1` 의 `$slugs` 도 같이 고쳐야 합니다)
2. 리사이즈 + 매니페스트 갱신:
   ```bash
   powershell -File tools/build-images.ps1
   ```
3. 도판 마크업 재생성 — `index.html` 의 `data-plates` 컨테이너를 다시 채웁니다:
   ```bash
   node tools/gen-plates.js
   ```
4. 캐시 버전 올리기:
   ```bash
   powershell -File tools/bump.ps1
   ```

두 스크립트 모두 **기본값이 작품 네 시리즈**입니다. 전시 전경은 순서(`INSTALL_ORDER`)와
빈 캡션을 손으로 맞춰 둔 상태라 건드리지 않습니다. 굳이 다시 만들어야 할 때만
`-Only installation` / `gen-plates.js installation` 을 붙이세요 — 수작업이 날아갑니다.

## 채워야 할 것

- [x] ~~작품 캡션 61장~~ — 파일명이 정리되어 전부 자동으로 채워졌습니다.
      더 이상 `매체 · 크기 입력` 자리는 없습니다
- [ ] **《Companion Plant》 #1 · #2 소속 확인** — `images/FullMetalPlant/` 안에
      있지만 매체와 크기가 다릅니다 (Archival Pigment Print, 100 × 75 cm).
      나머지 11장은 금속판 승화전사 100 × 100 cm 입니다. 같은 시리즈가 맞는지,
      아니면 따로 빼야 하는지 알려주세요
- [ ] **Installation 캡션** — 47장 전부 비워둔 상태입니다 (작가님 요청).
      나중에 넣으시려면 `data-orig` 로 원본을 맞출 수 있습니다
      (예: `사진비평상_2.jpg`, `칠곡트랜스미디어축제_전시전경.jpg`)
- [ ] **포스터 4장 위치** — 포스터·현수막은 전경과 섞이면 지저분해서 페이지 아래
      별도 그룹으로 뺐습니다. 아예 빼고 싶으면 말씀해주세요
- [ ] **`images/smog_3 copy.png`** — 프로젝트 폴더 밖에 있어서 어디에도 넣지
      않았습니다. 어느 시리즈인지 알려주시면 넣겠습니다
- [x] ~~Instagram 아이디~~ — `@ahnjy222` 로 들어가 있습니다
- [ ] **《미도래》 시작 연도** — `Midore #22` 를 2023년으로 고쳐주셔서 시리즈가
      2023~2025년에 걸칩니다. 머리말은 아직 `2024 — Ongoing` 입니다.
      `2023 — Ongoing` 으로 바꿀지 알려주세요
- [x] ~~《황곡》 연도~~ — `2021 — 2025` 로 고쳤습니다 (`#72` 가 2025년).
      수상연도 2022는 `Award` 줄로 옮겼습니다
- [ ] `index.html` 의 `og:url` / `canonical` / `sitemap.xml` 의 도메인이
      `ahnjaeyoung.com` 으로 되어 있습니다. 다른 도메인을 쓰면 바꿔주세요.
- [ ] **층위 매니페스트 확인** — 각 작품의 `.layer-stack` 은 작가 노트에 적힌
      공정을 그대로 옮긴 제 해석입니다. 순서나 명칭이 실제와 다르면 고쳐주세요.
      특히 《미도래》의 02(픽셀 해체 · 망점)와 03(3D 렌더) 순서를 확인 부탁드립니다.
- [ ] **《황곡_컬러라이즈드》 효과 재검토** — 네 시리즈 중 이것만 해체되는 느낌이
      약합니다. 나머지는 타일이 떨어져 나가거나(미도래), 금속판이 되거나(FMP),
      도면이 되는데(황곡) 이건 채도만 빠집니다. 게다가 이 작업의 논점은
      "생성 착색이 그럴듯한 믿음을 만든다"는 것이라, 색을 빼는 것보다
      **생성된 색만 남기고 사진을 걷어내는** 쪽이 개념에 더 맞습니다.
      바꿀지 판단해주세요
- [ ] **뷰어 단계 이름 vs 층위 목록** — 뷰어는 `원본/그레인/임계/인덱스` 같은
      기법 용어를 쓰는데 프로젝트 페이지의 층위 목록은 `촬영/픽셀 해체·망점/
      3D 렌더/생성 모델` 입니다. 뷰어도 작가님 층위 용어로 맞출 수 있습니다
- [ ] **웹폰트가 외부 CDN에 있습니다** — Pretendard는 jsDelivr, IBM Plex Mono는
      Google Fonts에서 받아옵니다. CDN이 죽으면 글꼴이 바뀝니다. 폰트 파일을
      `assets/fonts/` 에 넣어 자체 호스팅하면 더 안전합니다
- [ ] **개념의 실 배정 확인** — `index.html` 의 `data-threads` 속성.
      작품별로 붙은 갈래가 맞는지, 갈래를 더하거나 뺄지 판단해주세요.
      특히 `단위 — 점·픽셀·데이터` 는 지금 《미도래》 하나뿐이라 필터로서
      의미가 약합니다. 작가 노트의 핵심 개념인데 한 작품만 달려 있습니다
- [ ] **영문 인용** — 《미도래》 서두 천운영 『바늘』 인용문의 영역은 제가
      옮긴 것입니다. 공식 번역본이 있으면 교체해주세요.

## 수정 방법

**도판 추가** — 해당 섹션의 `.plates` 안에 블록을 복사합니다. `--ar` 은 가로/세로
비율이고, `data-src` 와 `<img src>` 는 같은 경로여야 합니다 (캐시 공유).

```html
<figure class="plate plate--right rv">
  <div class="strata" style="--ar:1.334" data-src="assets/images/midore-03.jpg">
    <img src="assets/images/midore-03.jpg" alt="Midore, plate 3" loading="lazy" width="2000" height="1499">
  </div>
  <span class="tag">⌖ Delaminate</span>
  <figcaption><span>캡션</span><span class="no">Pl. 03</span></figcaption>
</figure>
```

폭 변형: `plate--wide`(전체) `plate--inset`(72%) `plate--left`(58%)
`plate--right`(52%, 오른쪽 정렬) `plate--tall`(44%). 번갈아 쓰면 리듬이 생깁니다.

**시리즈 추가**
1. `<section class="view" id="v-새이름" data-title="...">` 블록 추가
2. `assets/js/main.js` 의 `ROUTES` 와 `NAV_FOR` 에 항목 추가
3. 홈 인덱스의 `.idx-list` 와 `.idx-grid` 에 추가.
   `data-work`(섹션 id)과 `data-threads`를 꼭 넣어야 잔흔 표식과 필터가 붙습니다
4. 히어로 스택에도 넣으려면 `main.js` 의 `WORKS` 배열에 추가하고
   `index.html` 의 `#hero-ticks` 에 버튼을 하나 더 넣습니다 (개수가 맞아야 합니다)

**층위 매니페스트 수정** — 해당 섹션의 `.layer-stack` 안 `<li>` 를 고칩니다.
번호는 아래(01, 가장 먼저 한 일)에서 위로 올라갑니다.

```html
<li><span class="n">03</span><span class="k">한국어 이름</span><span class="e">English name</span></li>
```

**개념의 실 수정** — 갈래 자체는 `main.js` 의 `THREADS` 객체에서 정의합니다.
작품에 붙이려면 인덱스 행/카드의 `data-threads` 와 작품 페이지의
`<div class="threads" data-threads="...">` 두 곳을 같이 고쳐야 합니다.

**국문/영문** — 한 쪽만 보여줄 내용은 `class="l-ko"` / `class="l-en"` 으로
감쌉니다. 블록이든 인라인이든 됩니다. 클래스가 없으면 두 언어에서 모두 보입니다.

## 배포 (Netlify)

1. netlify.com → Sites → 이 폴더를 드래그앤드롭
2. 또는 GitHub 저장소에 올린 뒤 연결 (수정 시 자동 재배포)
3. Domain settings 에서 `ahnjaeyoung.com` 연결 → Wix에 걸린 DNS를 Netlify로 변경

`netlify.toml` 이 캐시 헤더를 잡아둡니다. HTML은 항상 재검증, three.js는 1년,
이미지는 30일, CSS/JS는 1시간입니다. CSS/JS를 자주 고칠 예정이면 그대로 두세요.

## 기술 메모 (나중에 만질 때 참고)

- **폰트는 CDN** — Pretendard(jsDelivr), IBM Plex Mono(Google Fonts). 오프라인이나
  CDN 차단 환경에서는 시스템 폰트로 대체됩니다. 완전히 자립시키려면 woff2를
  내려받아 `assets/fonts/` 에 넣고 `@font-face` 를 직접 씁니다.
- **색공간** — three.js는 WebGL2에서 텍스처를 하드웨어 sRGB 디코드하므로
  셰이더의 `texture2D()` 는 **선형광**을 돌려줍니다. 반대로 커스텀 ShaderMaterial은
  출력 인코딩을 자동으로 해주지 않으므로 셰이더가 직접 sRGB로 인코딩해 내보내야
  합니다. `shaders.js` 는 샘플링 직후 sRGB로 올린 뒤 모든 계산을 그 공간에서
  합니다 — 망점 면적과 포스터라이즈는 지각 공간에서만 제대로 보입니다.
- **망점** — 점 면적 = 계조값이라 셀 평균 밝기가 보존됩니다. 스크린은 무채색이고
  채널 어긋남은 서브픽셀입니다. 채널마다 셀의 일부라도 어긋내면 어두운 영역에서
  점이 완전히 분리되어 원색 알갱이가 됩니다.
- **WebGL이 없으면** 히어로는 정적 이미지 3장 스택으로, 도판은 평범한 `<img>` 로,
  해체 뷰어는 원본 이미지 새 탭으로 각각 대체됩니다.
- **`prefers-reduced-motion` 원칙 — 중요** (Windows: 설정 → 접근성 → 시각 효과 →
  애니메이션 효과). 이 설정은 **사용자가 요청하지 않은 움직임만** 끕니다:
  자동 순환, 커서 패럴랙스, 층 어긋남. **호버로 벌어지는 것과 휠로 작품을 넘기는
  것은 끄지 않습니다.** 이건 사용자가 직접 내린 지시라서, 여기까지 막으면 히어로가
  완전히 죽은 것처럼 보이고 작품을 넘길 방법 자체가 사라집니다.

  `stack.js` 의 `pointermove` · `wheel` 핸들러 가드에 `reduced` 를 **넣지 마세요.**
  이 버그가 두 번 재발했습니다. 프레임 루프(`frame()`)에서 자동 순환과 패럴랙스만
  끄는 것으로 충분합니다.
- **도판 지연 로딩** — 한 시리즈가 40장을 넘기 때문에, 뷰포트 700px 이내로
  들어온 도판만 받아옵니다. 한 번에 전부 받으면 수십 MB가 나갑니다.
- **캐시 버전 — CSS/JS를 고치면 반드시 같이 올려야 합니다.**
  다섯 곳이 같은 값을 써야 합니다 — `index.html` 의 `site.css?v=…` 와
  `main.js?v=…`, `main.js` 안의 `stack.js?v=…` 와 `delaminate.js?v=…`,
  그리고 `stack.js` · `delaminate.js` 안의 `shaders.js?v=…`.
  현재 값은 `20260806-modes` 입니다. 안 올리면 브라우저가 예전 파일을 계속 쓰고,
  새 HTML에 옛 스크립트가 붙어 **고친 게 반영되지 않은 것처럼 보입니다.**
  (`netlify.toml` 에서 CSS/JS는 항상 재검증하도록 바꿔뒀지만, 쿼리를 올리는 쪽이
  확실합니다.)
- **JS를 꺼도** 모든 글과 이미지는 읽힙니다 (`<noscript>` 스타일이 섹션을 전부 펴고
  국문을 보여줍니다).
- **언어 기본값** — 저장된 선택이 있으면 그것, 없으면 브라우저 언어가 한국어면
  KO, 아니면 EN. `localStorage` 의 `ajy-lang` 에 남습니다.
- **잔흔 저장 위치** — `sessionStorage` 의 `ajy-residue`. 방문 단위로만 남습니다.
  영구히 남기고 싶으면 `main.js` 에서 `sessionStorage` 를 `localStorage` 로
  바꾸면 됩니다.
