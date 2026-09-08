// Shared by the browser router and the static-page build. No project ranking.
export const PAGES = {
  '/': { id:'v-home', title:'Ahn Jaeyoung — Portfolio', work:'midore', description:'안재영의 사진 기반 작업. 미도래, 풀 메탈 플랜트, 황곡 컬러라이즈드, 황곡과 전시 기록.' },
  '/midore': { id:'v-midore', title:'Midore · 미도래 — Ahn Jaeyoung', work:'midore', description:'점, 픽셀, 텍스처 데이터의 침투와 중첩을 다루는 안재영의 사진 작업 《미도래》.' },
  '/full-metal-plant': { id:'v-full-metal-plant', title:'Full Metal Plant — Ahn Jaeyoung', work:'full-metal-plant', description:'생성 모델과 철의 질감 렌더링을 통해 반려 식물의 성질을 재고하는 안재영의 작업.' },
  '/hwanggok-colorized': { id:'v-hwanggok-colorized', title:'Hwanggok_Colorized — Ahn Jaeyoung', work:'hwanggok-colorized', description:'흑백으로 전환한 사진에 생성 모델로 색을 입혀 관념화된 도시 황곡을 시각화한 작업.' },
  '/hwanggok': { id:'v-hwanggok', title:'Hwanggok · 황곡 — Ahn Jaeyoung', work:'hwanggok', description:'한강의 『검은 사슴』 속 도시를 모티브로, 현실의 조각들을 모아 가상의 공간을 만드는 안재영의 작업 《황곡》.' },
  '/installation': { id:'v-installation', title:'Installation — Ahn Jaeyoung', work:'installation', description:'안재영의 전시 전경과 전시 관련 이미지 기록.' },
  '/texts': { id:'v-texts', title:'Texts — Ahn Jaeyoung', work:'hwanggok', description:'안재영의 작업에 관한 비평과 전시 서문. 구나연의 황곡 심사평, 나선의 미도래 서문.' },
  '/text-sajinbipyeong': { id:'v-text-sajinbipyeong', title:'사진의 원초적 질감의 회복 — Ahn Jaeyoung', work:'hwanggok', description:'구나연의 제19회 사진비평상 당선작 심사평. 안재영의 《황곡》에 관한 비평.' },
  '/text-midorepreface': { id:'v-text-midorepreface', title:'아직 도래하지 않은, 그러나 이미 도래한 — Ahn Jaeyoung', work:'midore', description:'나선의 《미도래》 전시 서문. 안재영의 이미지 생성 방식과 사진에 대한 인식의 변화를 다룬 글.' },
  '/info': { id:'v-info', title:'Info — Ahn Jaeyoung', work:'midore', description:'안재영 작가 소개, 작가 노트, 학력, 전시 이력과 수상 기록.' }
};
export const canonicalPath = path => path === '/' ? '/' : path + '/';
export function resolvePage(url){
  const target = url.hash.startsWith('#/') ? new URL(url.hash.slice(1), url.origin) : url;
  let path = target.pathname.replace(/\/+$/, '') || '/';
  if(path === '/index.html') path = '/';
  if(path === '/bio' || path === '/contact') path = '/info';
  return PAGES[path] ? { path, search:target.search, anchor:target.hash.slice(1) } : null;
}
