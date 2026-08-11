/* ============================================================
   tools/serve.js — 로컬 미리보기 서버
   ------------------------------------------------------------
   node tools/serve.js        →  http://localhost:5173

   파일을 절대 캐시하지 않습니다. 고친 게 반영 안 되는 것처럼
   보이는 문제(브라우저가 옛 파일을 계속 쓰는 것)를 없애려는
   것이므로, 개발용으로만 쓰세요. 배포는 netlify.toml 이 맡습니다.
   설치할 것 없이 Node 만 있으면 됩니다.
   ============================================================ */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2]) || 5173;

const TYPES = {
  '.html':'text/html; charset=utf-8',
  '.css' :'text/css; charset=utf-8',
  '.js'  :'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.jpg' :'image/jpeg',  '.jpeg':'image/jpeg',
  '.png' :'image/png',   '.webp':'image/webp',
  '.svg' :'image/svg+xml',
  '.pdf' :'application/pdf',
  '.woff2':'font/woff2', '.woff':'font/woff',
  '.txt' :'text/plain; charset=utf-8',
  '.xml' :'application/xml; charset=utf-8'
};

http.createServer((req, res) => {
  // 쿼리(?v=…)는 떼고, 한글 파일명을 위해 디코딩
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';

  const file = path.join(ROOT, rel);

  // 프로젝트 폴더 밖으로 나가는 요청은 거부
  if (!file.startsWith(ROOT)) {
    res.writeHead(403); return res.end('forbidden');
  }

  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' });
      return res.end('404  ' + rel);
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log('');
  console.log('  미리보기 준비됨  →  http://localhost:' + PORT);
  console.log('  폴더: ' + ROOT);
  console.log('  캐시 없음 — 파일 저장하고 새로고침하면 바로 반영됩니다.');
  console.log('  끄려면 Ctrl+C');
  console.log('');
});
