# SEO 적용 및 운영

2026-09-12 로컬 파일에 적용했습니다. 운영 사이트 배포와 검색엔진 계정 등록은 수행하지 않았습니다.

- 10개 페이지 제목에 한글·영문 작가명을 함께 표시하고 홈 설명을 보강했습니다.
- 페이지별 Person, WebSite, WebPage 구조화 데이터를 생성합니다. 작가 소개는 ProfilePage입니다.
- Open Graph 사이트명과 이미지 설명, Twitter 카드 정보를 생성합니다.
- 페이지 이동 시 메타 정보와 구조화 데이터를 함께 갱신합니다.
- 기존 대표 URL을 유지하고 사이트맵에 작품 이미지를 추가했습니다.
- 큰 이미지 검색 미리보기를 허용합니다. 실제 검색 표시나 순위를 보장하지는 않습니다.

## 수정 후 검사

제목·설명과 구조화 데이터는 assets/js/pages.mjs, 본문은 index.html에서 관리합니다. 하위 폴더 HTML은 자동 생성됩니다.

```powershell
node tools/build-pages.js
node tools/build-pages.js --check
node tools/test-site.js
node tools/test-seo.js
```

## 배포 후 할 일

1. 기존 절차로 사이트 전체를 배포합니다.
2. Google Search Console과 네이버 서치어드바이저에서 ahnjaeyoung.com의 소유권을 확인합니다. 이미 등록했다면 재등록하지 않습니다.
3. 두 서비스에 https://ahnjaeyoung.com/sitemap.xml 을 제출합니다.
4. Google URL 검사에서 홈과 주요 작품 주소를 검사하고 색인 생성을 요청합니다.
5. 색인 현황과 작가명·작품명별 노출 및 클릭 추이를 확인합니다.

소유권 확인 코드는 서비스가 실제 발급한 값만 사용합니다. 언어 전환이 같은 주소를 사용하므로 별도 언어 URL용 hreflang은 추가하지 않았습니다.

참고: [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [사이트맵 안내](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
