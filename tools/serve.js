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
// Optional local simulation of slow zoom downloads; production hosting is unaffected.
const FULL_DELAY = Math.max(0, Number(process.env.SITE_PREVIEW_FULL_DELAY_MS) || 0);

const TYPES = {
  '.html':'text/html; charset=utf-8',
  '.css' :'text/css; charset=utf-8',
  '.js'  :'text/javascript; charset=utf-8',
  '.mjs' :'text/javascript; charset=utf-8',
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
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); }
  catch { res.writeHead(400); return res.end('invalid URL'); }
  if (rel === '/' || rel === '') rel = '/index.html';

  let file = path.resolve(ROOT, '.' + rel);

  // 프로젝트 폴더 밖으로 나가는 요청은 거부
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    res.writeHead(403); return res.end('forbidden');
  }

  if(fs.existsSync(file) && fs.statSync(file).isDirectory()){
    if(!rel.endsWith('/')){
      res.writeHead(301, { Location:rel + '/' + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '') });
      return res.end();
    }
    file = path.join(file, 'index.html');
  }

  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store' });
      return res.end(fs.readFileSync(path.join(ROOT, '404.html')));
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    if(FULL_DELAY && /-full\.jpg$/.test(rel)) setTimeout(() => res.end(buf), FULL_DELAY);
    else res.end(buf);
  });
}).listen(PORT, () => {
  console.log('');
  console.log('  미리보기 준비됨  →  http://localhost:' + PORT);
  console.log('  폴더: ' + ROOT);
  console.log('  캐시 없음 — 파일 저장하고 새로고침하면 바로 반영됩니다.');
  console.log('  끄려면 Ctrl+C');
  console.log('');
}).on('error', (err) => {
  /* 포트가 이미 쓰이고 있을 때 기본 메시지는 "EADDRINUSE" 한 줄이라 무슨
     뜻인지 알기 어렵습니다. 대개는 미리보기 창을 안 끄고 또 띄운 경우입니다. */
  if(err.code === 'EADDRINUSE'){
    console.log('');
    console.log('  포트 ' + PORT + ' 는 이미 쓰이고 있습니다.');
    console.log('  미리보기 창이 이미 떠 있지 않은지 확인해 보세요.');
    console.log('  다른 번호로 띄우려면:');
    console.log('    powershell -File tools\\serve.ps1 -Port ' + (PORT + 1));
    console.log('');
    process.exit(1);
  }
  throw err;
});
