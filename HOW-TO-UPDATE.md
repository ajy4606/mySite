# 사이트 업데이트하는 법

사진을 새로 넣고, 확인하고, 실제 사이트에 올리는 전체 과정입니다.
개발 지식 없이 그대로 따라 하시면 됩니다.

명령은 전부 **PowerShell 창**에 칩니다.
`mySite` 폴더에서 빈 곳을 **Shift + 우클릭 → "여기에 PowerShell 창 열기"**
(또는 주소창에 `powershell` 입력)로 열면 됩니다.

---

## 요약 — 평소에 쓰는 건 이 세 줄

```powershell
powershell -File tools\deploy.ps1     # 사진 처리 + 페이지 반영 + 커밋
powershell -File tools\serve.ps1      # 눈으로 확인
git push                              # 실제 사이트에 올리기
```

처음 한 번만 준비가 필요합니다 → [처음 한 번만](#처음-한-번만) 으로.

---

## 1. 새 사진 추가하기

### 1-1. 사진을 폴더에 넣습니다

| 시리즈 | 넣는 곳 |
|---|---|
| 미도래 | `images\Midore\` |
| 풀 메탈 플랜트 | `images\FullMetalPlant\` |
| 황곡_컬러라이즈드 | `images\Hwanggok_colorized\` |
| 황곡 | `images\Hwanggok\` |
| 전시 전경 | `images\Installation\` |

원본 그대로 넣으시면 됩니다. 크기를 줄이거나 이름을 바꿀 필요 없습니다.

### 1-2. 파일 이름이 곧 캡션입니다

이 형식을 지켜 주세요. 쉼표 위치까지 그대로입니다.

```
제목 #번호, 크기cm, 매체, 연도.jpg
```

예시:

```
Hwanggok #73, 60x80cm, Archival Pigment Print, 2022.jpg
Midore #25, 40x40cm, Archival Pigment Print, 2025.jpg
Aralia, 100x100cm, Sublimation transfer on metal plate, 2022.jpg
```

- `#번호`가 있으면 시리즈 번호로, 없으면 개별 제목으로 들어갑니다.
- 형식이 안 맞으면 캡션 자리에 **"매체 · 크기 입력"** 이라는 빨간 표시가 남습니다.
  그게 보이면 파일 이름을 고치고 다시 돌리면 됩니다.
- 전시 전경(`Installation`)은 캡션이 없으므로 이름 규칙을 안 지켜도 됩니다.

### 1-3. 명령 한 줄

```powershell
powershell -File tools\deploy.ps1
```

이 한 줄이 아래를 순서대로 다 합니다.

1. 사진을 웹용 크기로 줄입니다 (큰 것 1600px, 썸네일 800px)
2. 페이지에 도판을 새로 깔고 캡션을 붙입니다
3. **캐시 버전을 올립니다** (아래 3번 설명 참고 — 빼먹으면 안 되는 단계)
4. git 에 커밋합니다

전시 전경까지 다시 만들려면:

```powershell
powershell -File tools\deploy.ps1 -All
```

사진은 그대로 두고 글·색만 고쳤다면:

```powershell
powershell -File tools\deploy.ps1 -SkipImages
```

커밋 메시지를 직접 정하고 싶다면 (안 쓰면 날짜가 들어갑니다):

```powershell
powershell -File tools\deploy.ps1 -Message "황곡 신작 3점 추가"
```

---

## 2. 눈으로 확인하기

```powershell
powershell -File tools\serve.ps1
```

브라우저가 열리면서 `http://localhost:5173` 에 사이트가 뜹니다.
확인이 끝나면 그 PowerShell 창에서 **Ctrl + C** 로 끕니다.

> `index.html` 을 더블클릭해서 여는 건 안 됩니다.
> 주소가 `file://` 로 시작하면 화면이 비어 보입니다. 반드시 위 명령으로 여세요.

"포트가 이미 쓰이고 있습니다" 라고 나오면 미리보기 창이 이미 떠 있는 것입니다.
그 창을 끄거나, 다른 번호로 띄우세요:

```powershell
powershell -File tools\serve.ps1 -Port 5174
```

새로고침해도 바뀐 게 안 보이면 **Ctrl + Shift + R** (강력 새로고침)을 눌러 보세요.

---

## 3. ⚠️ 캐시 버전 — 왜 중요한가

주소 뒤에 붙는 `?v=20260810-11` 같은 표시입니다.

브라우저는 한 번 받은 파일을 재활용합니다. 이 번호를 안 바꾸고 올리면
**이미 방문했던 사람에게는 예전 파일이 계속 보입니다.** 새로 고쳐도 안 바뀝니다.
"분명 고쳤는데 사이트에 반영이 안 돼요" 의 대부분이 이것입니다.

`deploy.ps1` 이 자동으로 올려 주므로 **평소에는 신경 쓰지 않아도 됩니다.**
직접 올리고 싶을 때만:

```powershell
powershell -File tools\bump.ps1
```

---

## 4. 실제 사이트에 올리기 (배포)

GitHub 연결이 끝나 있다면 이 한 줄입니다.

```powershell
git push
```

Netlify 가 알아서 새로 배포합니다. 1~2분 뒤에 사이트에 반영됩니다.

아직 연결 전이라면 → [처음 한 번만](#처음-한-번만)

---

## 처음 한 번만

### ① 저장소 만들기

```powershell
powershell -File tools\setup-git.ps1
```

임시 파일을 정리하고, git 저장소를 만들고, 첫 커밋까지 합니다.

### ② GitHub 에 올리기

1. [github.com](https://github.com) 에서 새 저장소를 만듭니다.
   - Private 로 두어도 사이트는 정상 배포됩니다.
   - **README / .gitignore 는 체크하지 마세요.** 여기 이미 있습니다.
2. 만들면 나오는 주소로:

```powershell
git remote add origin https://github.com/<아이디>/<저장소이름>.git
git push -u origin main
```

### ③ Netlify 연결

1. [netlify.com](https://netlify.com) 로그인
2. **Add new site → Import an existing project → GitHub**
3. 방금 만든 저장소 선택
4. 설정은 건드릴 것이 거의 없습니다:
   - Build command → **비워 둡니다**
   - Publish directory → **`.`** (점 하나)
   - 폴더 안의 `netlify.toml` 이 캐시 설정까지 자동으로 잡아 줍니다
5. **Deploy**

이 뒤로는 `git push` 만 하면 자동 배포됩니다.

### GitHub 없이 올리고 싶다면

Netlify 홈페이지에 **`mySite` 폴더를 통째로 끌어다 놓아도** 배포됩니다.
간단하지만 고칠 때마다 매번 다시 끌어다 놔야 하고, 되돌리기가 안 됩니다.

명령줄이 편하시면:

```powershell
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

---

## 사진 순서 바꾸기

기본은 작품 번호순입니다. 그게 아닌 자리에 두고 싶을 때만 고칩니다.

- **작품 페이지** (미도래·황곡 등) → `tools\gen-plates.js` 의 `PROJECT_ORDER`
- **전시 전경** → `tools\gen-plates.js` 의 `INSTALL_ORDER`

> ⚠️ `index.html` 을 직접 고쳐서 순서를 바꾸면 **다음에 `deploy.ps1` 을 돌릴 때
> 지워집니다.** 순서는 반드시 위 두 곳에 적어야 유지됩니다.

예 — 황곡에서 #7을 맨 앞으로 두고 싶다면:

```js
const PROJECT_ORDER = {
  'hwanggok': ['#7', '#6', '#3', ...]
};
```

파일 번호(01, 02)가 아니라 **작품 번호(#7)** 로 씁니다.
사진을 추가하면 파일 번호는 밀려서 바뀌지만 작품 번호는 그대로이기 때문입니다.

---

## 대표 이미지(커버) 바꾸기

각 시리즈가 첫 화면에 보여 주는 사진입니다. **네 군데를 같이** 고쳐야 합니다.

1. `assets\js\main.js` 의 `WORKS` 목록 → `src`
2. `index.html` 의 목록 행 → `data-peek`
3. 같은 행의 썸네일 `<img src=...>`
4. 격자 보기 카드의 `<img src=...>`

미도래는 공유 이미지로도 쓰여서 `og:image` 와 미리 불러오기 표시까지 따라갑니다.

---

## 고장났을 때

**화면이 하얗거나 아무것도 안 뜬다**
브라우저에서 **F12 → Console** 을 열어 빨간 글씨를 확인하세요.
`Shader Error` 가 보이면 셰이더 파일(`assets\js\gl\shaders.js`)이 깨진 것입니다.

**고쳤는데 안 바뀐다**
캐시입니다. **Ctrl + Shift + R**. 그래도 안 되면 `tools\bump.ps1`.

**사진이 안 나온다**
`assets\works\` 안에 파일이 생겼는지 확인하세요. 없다면
`powershell -File tools\build-images.ps1` 을 다시 돌립니다.

**전부 되돌리고 싶다**

```powershell
git status          # 뭐가 바뀌었는지 보기
git checkout -- .   # 마지막 커밋 상태로 되돌리기
```

---

## 원본 사진 백업 — 꼭 읽어 주세요

`images\` 폴더(카메라 원본)는 용량이 커서 **git 에 올라가지 않습니다.**
GitHub 에 백업되지 않는다는 뜻입니다.

**외장하드나 클라우드에 반드시 따로 백업해 두세요.**
원본이 사라지면 사진을 다시 만들 수 없습니다.

사이트가 실제로 쓰는 건 `assets\works\` 쪽이고 그건 저장소에 들어가므로
배포에는 문제가 없습니다.

---

## 파일 지도

```
mySite\
├─ HOW-TO-UPDATE.md     ← 지금 보고 있는 문서
├─ EDITING.md           글·캡션·색 등 세부 수정 매뉴얼
├─ NOTES.md             디자인 의도와 기술 메모
├─ index.html           사이트 본체 (페이지가 전부 여기 있습니다)
├─ netlify.toml         배포·캐시 설정
├─ images\              원본 사진 (git 제외)
├─ assets\
│   ├─ works\           웹용으로 줄인 사진 — 스크립트가 만듭니다
│   ├─ css\ js\         디자인과 동작
│   └─ vendor\          three.js
└─ tools\
    ├─ setup-git.ps1    처음 한 번: 저장소 만들기
    ├─ deploy.ps1       평소: 사진 처리 → 반영 → 캐시 → 커밋
    ├─ serve.ps1        로컬 미리보기 (serve.js 를 불러 줍니다)
    ├─ serve.js         실제 미리보기 서버 — 캐시를 아예 안 합니다
    ├─ build-images.ps1 사진 리사이즈만
    ├─ gen-plates.js    도판 마크업 생성 + 순서 지정
    └─ bump.ps1         캐시 버전만
```

> `assets\works\` 안의 파일은 직접 고치지 마세요.
> 전부 `build-images.ps1` 이 만든 것이라 다음 실행 때 덮어써집니다.
> 고칠 것은 언제나 `images\` 쪽 원본입니다.
