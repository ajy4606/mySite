# 직접 고치기 — 실무 매뉴얼

이 문서는 "무엇을 어디서 어떻게" 만 다룹니다.
왜 그렇게 만들었는지(디자인 의도, 기술 배경)는 [NOTES.md](NOTES.md) 에 있습니다.

## 프로젝트 주소와 생성 페이지 (2026-09)

`index.html`이 모든 페이지의 편집 원본입니다. `midore/index.html` 등 프로젝트
폴더의 HTML은 생성 결과이므로 직접 고치지 마세요. 텍스트·배치 수정 후
`node tools/build-pages.js`를 실행하면 독립 주소와 공유 정보에 반영됩니다.
이미지를 추가하거나 다시 만든 뒤에는 `python tools/build-responsive.py`도 먼저
실행하세요. 800px 썸네일, 1200px 추가본, 1600px 본문 파일을 화면 크기에 따라
선택하며 확대본은 뷰어에서만 불러옵니다. `deploy.ps1`은 이 단계도 실행합니다.
페이지별 제목·공유 설명은 `assets/js/pages.mjs`에서 관리합니다.
기존 `#/midore` 주소는 `/midore/`로 호환되며, 목록에서 상세를 연 뒤 뒤로가면
방문 당시 스크롤 위치가 복원됩니다. 네 프로젝트의 도판 순서는 기존
`gen-plates.js` 설정을 그대로 따릅니다.

이메일과 Instagram은 작가 요청으로 클릭 링크 없이 일반 텍스트로 유지합니다.

---

## 0. 준비 — 딱 두 가지

### 편집기

메모장 말고 **VS Code** 를 쓰세요. 무료입니다. → https://code.visualstudio.com

- 폴더째 열기: VS Code → `File > Open Folder` → `Desktop/mySite`
- 파일 안에서 찾기: `Ctrl+F`
- **폴더 전체에서 찾기: `Ctrl+Shift+F`** ← 이걸 제일 많이 씁니다
- 되돌리기: `Ctrl+Z`
- 저장: `Ctrl+S`

메모장을 쓰면 한글이 깨질 수 있습니다. 이 프로젝트 파일은 전부 UTF-8 입니다.

### 미리보기 서버

**`index.html` 을 더블클릭하면 동작하지 않습니다.** 브라우저가 보안상 막습니다.
반드시 서버로 띄워야 합니다.

VS Code 에서 `Terminal > New Terminal` 을 열고:

```bash
node tools/build-pages.js
node tools/serve.js
```

그러면 `http://localhost:5173` 이 뜹니다. 브라우저에서 여세요.

- 파일 고치고 저장 → 브라우저 **새로고침(F5)** 하면 바로 반영됩니다
- 이 서버는 캐시를 아예 쓰지 않으므로 "고쳤는데 안 바뀌는" 일이 없습니다
- 끄려면 터미널에서 `Ctrl+C`

---

## 1. 캡션 고치기 — 파일 이름이 곧 캡션입니다

작품 네 시리즈(미도래 · 풀 메탈 플랜트 · 황곡_컬러라이즈드 · 황곡)의 캡션은
`images/` 안의 **원본 파일 이름에서 자동으로** 만들어집니다. `index.html` 을
직접 고치지 마세요 — 도판을 다시 만들면 날아갑니다.

파일 이름 형식은 네 시리즈 모두 같습니다.

```
제목, 크기, 매체, 연도.jpg
```

```
images/Midore/Midore #21, 30x30cm, Archival Pigment Print, 2024.jpg
   → 《Midore》 #21, 2024 · Archival Pigment Print · 30 × 30 cm

images/FullMetalPlant/Aralia, 100x100cm, Sublimation transfer on metal plate, 2022.jpg
   → 《Aralia》, 2022 · Sublimation transfer on metal plate · 100 × 100 cm
```

제목 뒤에 `#번호` 가 있으면 시리즈 번호로 떼어내고, 없으면 그 자체를 작품 제목으로
씁니다. `100x100cm` 는 `100 × 100 cm` 로 알아서 다듬습니다.

**캡션을 고치는 방법 = 파일 이름을 고치고 두 줄을 다시 돌리는 것**

```bash
powershell -File tools/build-images.ps1
```

```bash
node tools/gen-plates.js
```

형식이 안 맞는 파일은 캡션 자리에 회색 `매체 · 크기 입력` 이 남습니다.
그게 보이면 파일 이름의 쉼표 개수나 `cm` 표기를 확인해 보세요.

### 순서

각 시리즈는 **`#번호` 순서**로 놓입니다. 번호가 없는 작품(《Aralia》 등)은
번호가 붙은 것들 뒤에 제목순으로 붙습니다.
순서를 바꾸려면 파일 이름의 번호를 바꾸세요.

### 전시 전경은 별개입니다

전시 전경(Installation)은 순서와 캡션을 손으로 맞춰 둔 상태라
`node tools/gen-plates.js` 가 **건드리지 않습니다.**
굳이 다시 만들어야 할 때만 이렇게 하세요. 손으로 한 작업이 날아갑니다.

```bash
node tools/gen-plates.js installation
```

### 어느 도판이 어느 원본인지 모를 때

도판마다 원본 파일명이 붙어 있습니다.

```html
<div class="strata" style="--ar:1.5" data-src="assets/works/installation/03.jpg" data-orig="사진비평상_2.jpg">
```

`data-orig` 가 `images/` 폴더의 원본 파일명입니다. 이걸로 맞춰 보세요.
`assets/works/manifest.json` 에도 전체 대조표가 있습니다.

---

## 2. 글 고치기

전부 `index.html` 안에 있습니다. `Ctrl+F` 로 문장 일부를 검색해서 찾는 게 제일 빠릅니다.

| 무엇 | 찾을 말 |
|---|---|
| 작가 노트 (홈 + Info 두 곳) | `보이는 것과` |
| 작품별 작업 노트 | `class="stmt` 또는 작품 첫 문장 |
| CV — 전시 이력 | `그룹 전시` |
| 비평 · 서문 | `사진의 원초적 질감` |
| 연락처 | `ajy4606` |

### 국문과 영문

한 쪽만 보여줄 내용은 클래스로 감쌉니다.

```html
<div class="l-ko">국문만 보일 내용</div>
<div class="l-en" lang="en">English only</div>
```

- `l-ko` → KO 일 때만 보임
- `l-en` → EN 일 때만 보임
- 클래스가 없으면 **양쪽 언어에서 다 보입니다** (작품 제목, 연도 같은 것)

블록이든 문장 중간의 몇 글자든 상관없이 됩니다.

### CV 에 전시 한 줄 추가

국문 칸과 영문 칸 **두 군데** 를 같이 고쳐야 합니다.
`<h3>그룹 전시</h3>` 아래에 한 줄 복사해서 넣으세요.

```html
<div class="r"><span class="y">2026</span><span>《전시명》, 장소, 도시</span></div>
```

영문 칸은 `<h3>Group Exhibitions</h3>` 아래입니다.

---

## 3. 이미지 추가 · 교체

원본은 `images/<프로젝트 이름>/` 에 넣고, 웹용은 스크립트가 만듭니다.
`assets/works/` 안의 파일은 **직접 건드리지 마세요.** 전부 자동 생성물입니다.

### 순서

**① 원본을 넣습니다**

```
images/Midore/Midore #25, 60x80cm, Archival Pigment Print, 2026.jpg
```

파일명이 곧 캡션이고 `#번호` 가 곧 순서입니다 (1번 항목 참고).

폴더 이름은 정해져 있습니다. 바꾸면 스크립트가 못 찾습니다.

```
images/Midore              images/Hwanggok
images/FullMetalPlant      images/Hwanggok_colorized
images/Installation
```

**② 리사이즈 + 목록 갱신**

```bash
powershell -File tools/build-images.ps1
```

원본의 색상 프로필을 읽어 sRGB로 변환한 뒤, 긴 변 1600px(도판용),
800px(썸네일용), 최대 3000px(확대용)를 `assets/works/` 에 넣습니다.
JPEG에는 sRGB 프로필을 포함하고 색상 샘플링은 4:4:4로 저장합니다.
원본은 그대로 두며, 기존 웹용 폴더도 먼저 비우지 않습니다.
지운 원본은 새 매니페스트와 도판 목록에서 빠지지만 이전 웹용 파일은 남습니다.
Python/Pillow 준비 방법은 `HOW-TO-UPDATE.md`를 참고하세요.
기본으로는 작품 네 시리즈만 손대고 전시 전경은 그대로 둡니다.

```bash
powershell -File tools/build-images.ps1 -Only installation
```

**③ 도판 마크업 다시 만들기**

```bash
node tools/gen-plates.js
```

`index.html` 의 도판 블록을 통째로 다시 씁니다.
캡션이 파일 이름에서 나오므로 몇 번을 돌려도 결과는 같습니다.
전시 전경은 건드리지 않습니다.

**④ 캐시 버전 올리기**

```bash
powershell -File tools/bump.ps1
```

### 손으로 도판을 하나 넣고 싶을 때

### 도판 블록 형식

```html
<figure class="plate plate--right rv">
  <div class="strata" style="--ar:1.334" data-src="assets/works/midore/25.jpg" data-orig="원본파일명.jpg">
    <img src="assets/works/midore/25.jpg" alt="midore 25" loading="lazy" width="1600" height="1199">
  </div>
  <span class="tag">⌖ Delaminate</span>
  <figcaption><span>캡션</span><span class="no">Pl. 25</span></figcaption>
</figure>
```

- `--ar` 은 **가로 ÷ 세로** 입니다. 1600×1199 이면 `1.334`
- `data-src` 와 `<img src>` 는 **반드시 같은 경로** 여야 합니다 (캐시 공유)
- `width` / `height` 는 실제 픽셀 크기. 안 맞으면 로딩 중 레이아웃이 흔들립니다

폭 변형 — 번갈아 쓰면 리듬이 생깁니다.

| 클래스 | 폭 |
|---|---|
| `plate--wide` | 전체 |
| `plate--inset` | 72%, 가운데 |
| `plate--left` | 58%, 왼쪽 |
| `plate--right` | 52%, 오른쪽 |

두 장을 나란히 놓으려면 `<div class="plate-pair"> … </div>` 로 감싸세요.

---

## 4. 층위(Layers) 매니페스트

작품 페이지에서 "어떤 조작이 어떤 순서로 쌓였는지" 보여주는 표입니다.
`index.html` 에서 `layer-stack` 을 검색하세요.

```html
<ol class="layer-stack">
  <li><span class="n">04</span><span class="k">생성 모델</span><span class="e">Generative model</span></li>
  <li><span class="n">03</span><span class="k">3D 렌더</span><span class="e">Render</span></li>
  <li><span class="n">02</span><span class="k">픽셀 해체 · 망점</span><span class="e">Pixel decomposition, halftone</span></li>
  <li><span class="n">01</span><span class="k">촬영</span><span class="e">Capture</span></li>
</ol>
```

**아래가 01(가장 먼저 한 일), 위로 갈수록 나중** 입니다. 포토샵 레이어 패널과 같은 순서.
`n` = 번호, `k` = 국문, `e` = 영문. 줄을 지우거나 더하면 번호도 같이 맞춰주세요.

---

## 5. 개념의 실(Threads)

작품을 개념으로 묶는 태그입니다. **두 군데를 같이 고쳐야** 합니다.

**① 갈래 자체의 정의** — `assets/js/main.js` 위쪽

```js
const THREADS = {
  unit:       { ko:'단위 — 점·픽셀·데이터', en:'Unit — dot, pixel, data' },
  index:      { ko:'지표성',              en:'Indexicality' },
  ...
};
```

**② 작품에 붙이기** — `index.html` 의 `data-threads` 속성.
인덱스 행/카드와 작품 페이지 세 곳에 있습니다.

```html
<a class="row" href="#/midore" data-work="v-midore" data-threads="unit index material" ...>
...
<div class="threads" data-threads="unit index material"></div>
```

띄어쓰기로 구분합니다. `THREADS` 에 없는 이름을 쓰면 그냥 무시됩니다.

---

## 6. 해체 효과 조절

`assets/js/gl/shaders.js` 입니다. **여기는 조심해서 만지세요.** 숫자 하나만 바꾸고 저장 →
새로고침 → 확인, 이 순서로 조금씩 하는 게 좋습니다. 망가지면 `Ctrl+Z`.

### 어느 작품이 어느 효과인지

`assets/js/main.js` 의 `MODES` 에서 정합니다.

```js
const MODES = {
  'v-hwanggok':           0,   // 디더링
  'v-hwanggok-colorized': 1,   // 흑백
  'v-midore':             2,   // 데이터
  'v-full-metal-plant':   3,   // 철
  'v-installation':       5    // 없음
};
```

바꾸려면 숫자만 바꾸면 됩니다. **`5` 는 "효과 없음"** 입니다.
히어로 스택도 같이 바꾸려면 바로 아래 `WORKS` 배열의 `mode:` 값도 맞추세요.

단계 이름(원본 / 그레인 / 임계 / 1비트)은 `assets/js/gl/delaminate.js` 의 `STAGE_SETS` 입니다.

### 자주 만질 만한 숫자들

`shaders.js` 안, 각 `modeXxx()` 함수에 있습니다.

| 효과 | 줄 | 뜻 |
|---|---|---|
| 디더링 | `mix(1.6, 6.0, coarse)` | 점 크기. 뒤 숫자를 키우면 더 굵어짐 |
| 디더링 | `mix(8.0, 2.0, …)` | 계조 수. `2` 는 흑백 1비트 |
| 흑백 | `smoothstep(0.02, 0.66, t)` | 색이 빠지는 속도. 뒤 숫자가 작을수록 빨리 |
| 철 | `mix(1.0, 3.2, s)` | 대비. 키우면 더 딱딱해짐 |
| 철 | `vec3(0.86, 0.91, 1.00)` | 강철 색조. 파랗게/따뜻하게 조절 |
| 픽셀 | `ruling * 3.4` | 블록 크기 |
| 데이터 | `0.075 * band * s3` | 밴드가 밀리는 폭 |

히어로 호버 세기는 `assets/js/gl/stack.js` 의 `t: 0.62` (호버) 와
`t: slot === 0 ? 0.07 : 0.03` (평소) 입니다.

---

## 7. 색과 글자

`assets/css/site.css` 맨 위 `:root` 블록. 여기만 고치면 사이트 전체가 따라옵니다.

```css
:root{
  --ground:      #0a0a0b;   /* 바탕 */
  --ink:         #eceae5;   /* 본문 글자 */
  --ink-2:       #93938c;   /* 보조 글자 */
  --ink-3:       #5e5e59;   /* 더 흐린 글자 */
  --ink-4:       #383835;   /* 가장 흐린 글자 */
  --line:        rgba(236,234,229,.11);   /* 가는 선 */
  --m:    clamp(18px, 3.6vw, 56px);       /* 화면 좌우 여백 */
}
```

**글씨가 안 보인다** 싶으면 그 요소가 쓰는 `--ink-3` 을 `--ink-2` 로 바꾸는 식으로
한 단계씩 올리세요. 개별 요소 색은 해당 규칙에서 `color:var(--ink-3)` 을 찾으면 됩니다.

흰 바탕으로 뒤집고 싶다면 `--ground` 를 `#fff`, `--ink` 를 `#111` 로 바꾸고
`--line` 을 `rgba(0,0,0,.12)` 로 바꾸면 대체로 따라옵니다. 다만 히어로 WebGL 쪽은
따로 손봐야 하니, 그건 저에게 맡기시는 게 낫습니다.

---

## 8. ⚠️ 배포 전에 반드시 — 캐시 버전 올리기

**CSS 나 JS 를 고쳤다면** 배포 전에 한 번 실행하세요.

```bash
powershell -File tools/bump.ps1
```

`index.html` · `main.js` · `stack.js` · `delaminate.js` 여섯 군데의 `?v=…` 값을
한꺼번에 맞춰줍니다.

**이걸 빼먹으면** 이미 사이트를 본 적 있는 사람의 브라우저가 옛 CSS/JS 를 계속 씁니다.
새 HTML 에 옛 스크립트가 붙어서 **고친 게 반영 안 된 것처럼 보이거나, 깨져 보입니다.**
실제로 작업 중에 여러 번 겪은 문제입니다.

HTML 이나 이미지만 고쳤다면 안 해도 됩니다.

---

## 9. 고장났을 때

### 화면이 하얗거나 아무것도 안 뜬다

JS 문법이 깨진 겁니다. 브라우저에서 **F12 → Console** 탭을 보세요.
빨간 글씨에 파일명과 줄 번호가 나옵니다. 대개 괄호 `}` 나 따옴표를 빠뜨린 것입니다.

`Ctrl+Z` 로 되돌리는 게 가장 빠릅니다.

### 이미지가 안 나온다

경로 오타입니다. F12 → **Network** 탭에서 빨간 404 줄을 찾으세요.
`data-src` 와 `<img src>` 가 서로 다른 경우가 흔합니다.

### 고쳤는데 안 바뀐다

- `node tools/serve.js` 로 띄우셨나요? (python 서버는 캐시를 씁니다)
- 저장(`Ctrl+S`)은 하셨나요?
- 그래도 안 되면 `Ctrl+Shift+R` (강력 새로고침)

### 다 망가진 것 같다

지금 상태가 멀쩡할 때 폴더째 복사해서 `mySite-backup-0806` 처럼 날짜를 붙여
바탕화면에 두세요. 그게 가장 확실한 되돌리기입니다.

(Git 을 쓰시면 훨씬 낫지만, 그건 따로 알려드릴게요.)

---

## 10. 배포

1. https://app.netlify.com 로그인
2. 기존 사이트를 열고 **Deploys** 탭
3. `mySite` 폴더를 그 화면에 **드래그앤드롭**
4. 1~2분 뒤 반영

배포 전 확인:

- [ ] `powershell -File tools/bump.ps1` 실행했나 (CSS/JS 고쳤다면)
- [ ] 로컬에서 각 페이지 열어봤나
- [ ] F12 콘솔에 빨간 에러 없나

`images/` 원본 폴더도 같이 올라가는데(194MB) 문제는 없습니다.
빼고 싶으면 `.netlifyignore` 에 `images/` 한 줄 넣으면 됩니다. **로컬 폴더는 지우지 마세요.**

---

## 파일 지도

```
index.html                   ← 글, 도판, 구조. 대부분의 수정이 여기
tools/
  serve.js                   ← 미리보기 서버        node tools/serve.js
  build-images.ps1           ← 이미지 리사이즈       powershell -File tools/build-images.ps1
  gen-plates.js              ← 도판 마크업 생성      node tools/gen-plates.js
  bump.ps1                   ← 캐시 버전 올리기      powershell -File tools/bump.ps1
assets/
  css/site.css               ← 색, 글자, 배치
  js/main.js                 ← 라우팅, 언어, 개념의 실, 효과 배정(MODES)
  js/gl/shaders.js           ← 해체 효과 (조심)
  js/gl/stack.js             ← 홈 히어로 3D 스택
  js/gl/delaminate.js        ← 확대 뷰어, 단계 이름
  works/                     ← 웹용 이미지 (자동 생성 — 직접 건드리지 말 것)
images/                      ← 원본 (지우지 말 것)
```
