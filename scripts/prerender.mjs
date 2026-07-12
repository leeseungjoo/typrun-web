// 빌드타임 SEO 사전 렌더 — 네이버 Yeti(JS 미실행) 대응.
// vite build 후 dist/index.html 셸을 읽어 페이지별 정적 HTML을 생성한다:
//   /            → dist/index.html      (en)
//   /kr          → dist/kr/index.html   (ko)
//   /test        → dist/test/index.html (en)
//   /kr/test     → dist/kr/test/index.html (ko)
// 본문은 #root 안에 주입 — React createRoot().render()가 마운트 시 통째로 교체하므로
// 크롤러(무JS)만 보고, 브라우저에선 앱이 즉시 덮어쓴다. nginx try_files가 경로별 파일을 서빙.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const ORIGIN = 'https://typrun.com';

/** 페이지 정의 — title/description은 페이지마다 개별(전 페이지 동일 title = 중복 신호) */
const PAGES = [
  {
    out: 'index.html',
    lang: 'en',
    canonical: `${ORIGIN}/`,
    hreflang: { en: `${ORIGIN}/`, ko: `${ORIGIN}/kr` },
    title: 'TypRun — Multiplayer Typing Test &amp; Battle',
    description:
      'Free online typing test with real-time multiplayer battles. Measure your WPM, climb the monthly leaderboard — no signup needed.',
    ogLocale: 'en_US',
    ogLocaleAlt: 'ko_KR',
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'TypRun',
      url: `${ORIGIN}/`,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description:
        'Free online typing test with real-time multiplayer battles. Measure your WPM and climb the monthly leaderboard.',
      inLanguage: ['en', 'ko'],
    },
    body: `
      <nav aria-label="Main">
        <a href="/test">Typing Test</a>
        <a href="/race">Typing Race</a>
        <a href="/rankings">Rankings</a>
        <a href="/league">League &amp; Battle</a>
        <a href="/kr">한국어</a>
      </nav>
      <main>
        <h1>Free Online Typing Test and Multiplayer Typing Battles — TypRun</h1>
        <p>TypRun is a free typing practice site that runs right in your browser — no install, no signup.
           Take a typing speed test to measure your WPM and accuracy, race friends in real time,
           and climb the monthly national leaderboard while you play.</p>
        <h2>Typing Speed Test — WPM and Accuracy</h2>
        <p>Start typing to begin a 1-minute test. TypRun measures words per minute, accuracy and
           consistency, and keeps your personal bests. Korean and English tests are both supported.</p>
        <h2>Typing Race and Real-time Battles</h2>
        <p>Race to the finish line word by word, or invite a friend with a link and battle head-to-head
           in real time. Every match is a fun way to build typing speed.</p>
        <h2>Monthly Rankings and Leagues</h2>
        <p>Leaderboards reset on the 1st of every month, so everyone gets a fresh shot at the top.
           Join a league, set a record, and defend your rank.</p>
      </main>
      <footer>
        <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms</a> ·
        Operator: Typ Run (<a href="https://kioskprogram.com" rel="noopener">kioskprogram.com</a>)
        · © 2026 Typ Run
      </footer>`,
  },
  {
    out: 'kr/index.html',
    lang: 'ko',
    canonical: `${ORIGIN}/kr`,
    hreflang: { en: `${ORIGIN}/`, ko: `${ORIGIN}/kr` },
    title: '타입런 TypRun — 무료 타자연습 · 온라인 타자 테스트 · 실시간 타자 대결',
    description:
      '설치·회원가입 없이 브라우저에서 바로 하는 무료 타자연습. 한글 타자 테스트(분당 타수)와 영타 WPM 측정, 실시간 타자 대결과 월간 랭킹까지 — 타입런에서 타자 속도를 올려보세요.',
    ogLocale: 'ko_KR',
    ogLocaleAlt: 'en_US',
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'TypRun (타입런)',
      url: `${ORIGIN}/kr`,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
      description:
        '무료 온라인 타자연습 — 한글 타자 테스트, 영타 WPM 측정, 실시간 타자 대결과 월간 랭킹.',
      inLanguage: ['ko', 'en'],
    },
    body: `
      <nav aria-label="주 메뉴">
        <a href="/kr/test">타자 테스트</a>
        <a href="/kr/race">타자 레이스</a>
        <a href="/kr/rankings">랭킹</a>
        <a href="/kr/league">리그 · 대결</a>
        <a href="/">English</a>
      </nav>
      <main>
        <h1>무료 온라인 타자연습, 타자 테스트 — 타입런 (TypRun)</h1>
        <p>타입런은 설치와 회원가입 없이 브라우저에서 바로 시작하는 무료 타자연습 사이트입니다.
           한글 타자 테스트로 분당 타수와 정확도를 측정하고, 영타(WPM) 연습, 실시간 타자 대결,
           월간 랭킹까지 게임처럼 즐기면서 타자 속도를 올릴 수 있습니다.</p>
        <h2>타자 테스트 — 분당 타수와 정확도 측정</h2>
        <p>아무 키나 누르면 1분 타자 테스트가 시작됩니다. 한글은 분당 타수, 영어는 WPM으로
           속도를 측정하고 정확도·균일도까지 함께 기록합니다. 내 최고 기록은 자동으로 저장됩니다.</p>
        <h2>타자 레이스와 실시간 타자 대결</h2>
        <p>단어를 모두 입력해 결승선까지 달리는 타자 레이스, 초대 링크 하나로 친구와 겨루는
           실시간 대결(배틀)을 지원합니다. 혼자 하는 연습보다 훨씬 빠르게 실력이 늘어납니다.</p>
        <h2>월간 랭킹과 리그</h2>
        <p>랭킹은 매월 1일 초기화되어 누구나 새로 도전할 수 있습니다. 리그에 참가해 기록을 세우고
           전국 랭킹에 이름을 올려보세요.</p>
        <h2>이런 분께 추천합니다</h2>
        <p>타자 속도를 올리고 싶은 학생과 직장인, 자격시험을 준비하며 타수를 확인하고 싶은 분,
           지루한 타자연습 대신 게임으로 즐기고 싶은 분 모두 무료로 이용할 수 있습니다.</p>
      </main>
      <footer>
        <a href="/kr/privacy">개인정보처리방침</a> · <a href="/kr/terms">이용약관</a> ·
        운영사: Typ Run (<a href="https://kioskprogram.com" rel="noopener">kioskprogram.com</a>)
        · © 2026 Typ Run
      </footer>`,
  },
  {
    out: 'test/index.html',
    lang: 'en',
    canonical: `${ORIGIN}/test`,
    hreflang: { en: `${ORIGIN}/test`, ko: `${ORIGIN}/kr/test` },
    title: 'Typing Speed Test — Measure Your WPM Free | TypRun',
    description:
      'Take a free 1-minute typing test. Measure WPM, accuracy and consistency, then climb the monthly leaderboard. No signup needed.',
    ogLocale: 'en_US',
    ogLocaleAlt: 'ko_KR',
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'TypRun Typing Test',
      url: `${ORIGIN}/test`,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: 'Free 1-minute typing speed test — WPM, accuracy and consistency.',
      inLanguage: ['en', 'ko'],
    },
    body: `
      <nav aria-label="Main">
        <a href="/">Home</a>
        <a href="/race">Typing Race</a>
        <a href="/rankings">Rankings</a>
        <a href="/kr/test">한국어</a>
      </nav>
      <main>
        <h1>Typing Speed Test — WPM and Accuracy</h1>
        <p>Press any key to start a free 1-minute typing test. TypRun measures your words per minute,
           accuracy and consistency in real time, and saves your personal best. English and Korean
           tests are both supported — no signup required.</p>
        <h2>What your results mean</h2>
        <p>WPM counts correctly typed words per minute; accuracy is the share of correct keystrokes;
           consistency shows how steady your pace stays. Retake the test any time with Tab.</p>
      </main>
      <footer>
        <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms</a> · © 2026 Typ Run
      </footer>`,
  },
  {
    out: 'kr/test/index.html',
    lang: 'ko',
    canonical: `${ORIGIN}/kr/test`,
    hreflang: { en: `${ORIGIN}/test`, ko: `${ORIGIN}/kr/test` },
    title: '한글 타자 테스트 — 분당 타수 · 정확도 측정 | 타입런',
    description:
      '1분 한글 타자 테스트로 분당 타수와 정확도를 무료로 측정하세요. 영어 WPM 테스트 지원, 회원가입 없이 바로 시작 — 타입런.',
    ogLocale: 'ko_KR',
    ogLocaleAlt: 'en_US',
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: '타입런 타자 테스트',
      url: `${ORIGIN}/kr/test`,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
      description: '무료 1분 한글 타자 테스트 — 분당 타수·정확도·균일도 측정.',
      inLanguage: ['ko', 'en'],
    },
    body: `
      <nav aria-label="주 메뉴">
        <a href="/kr">홈</a>
        <a href="/kr/race">타자 레이스</a>
        <a href="/kr/rankings">랭킹</a>
        <a href="/test">English</a>
      </nav>
      <main>
        <h1>한글 타자 테스트 — 분당 타수와 정확도 측정</h1>
        <p>아무 키나 누르면 1분 타자 테스트가 바로 시작됩니다. 한글은 분당 타수, 영어는 WPM으로
           측정하며 정확도와 균일도, 정타·오타 수까지 함께 보여줍니다. 회원가입 없이 무료입니다.</p>
        <h2>측정 항목 안내</h2>
        <p>분당 타수는 1분 동안 정확히 입력한 타수, 정확도는 전체 입력 중 정타 비율,
           균일도는 속도가 얼마나 일정했는지를 뜻합니다. Tab 키로 언제든 다시 시작할 수 있습니다.</p>
        <h2>기록 저장과 랭킹</h2>
        <p>로그인하면 테스트 기록이 저장되고 매월 초기화되는 타자 리더보드에 도전할 수 있습니다.</p>
      </main>
      <footer>
        <a href="/kr/privacy">개인정보처리방침</a> · <a href="/kr/terms">이용약관</a> · © 2026 Typ Run
      </footer>`,
  },
];

/** 하이드레이션 전 플래시가 깨져 보이지 않게 하는 최소 스타일 (앱 배경 #0F1226 동일) */
const SEO_STYLE = `
    <style>
      .seo-pre{min-height:100vh;background:#0F1226;color:#e7e9f4;font-family:Pretendard,'Nanum Gothic',sans-serif;padding:48px 20px;box-sizing:border-box}
      .seo-pre nav a,.seo-pre footer a{color:#9aa3d0;margin-right:14px;text-decoration:none}
      .seo-pre main{max-width:760px;margin:32px auto;line-height:1.7}
      .seo-pre h1{font-size:1.5rem}.seo-pre h2{font-size:1.15rem;margin-top:1.6em}
      .seo-pre footer{max-width:760px;margin:40px auto 0;font-size:.85rem;color:#8b91b5}
    </style>`;

function renderPage(shell, page) {
  let html = shell;
  html = html.replace(/<html lang="[^"]*">/, `<html lang="${page.lang}">`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${page.title}</title>`);
  html = html.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${page.description}" />`,
  );
  html = html.replace(
    /<link rel="canonical" href="[^"]*" \/>/,
    `<link rel="canonical" href="${page.canonical}" />`,
  );
  html = html.replace(
    /<link rel="alternate" hreflang="en" href="[^"]*" \/>/,
    `<link rel="alternate" hreflang="en" href="${page.hreflang.en}" />`,
  );
  html = html.replace(
    /<link rel="alternate" hreflang="ko" href="[^"]*" \/>/,
    `<link rel="alternate" hreflang="ko" href="${page.hreflang.ko}" />`,
  );
  html = html.replace(
    /<link rel="alternate" hreflang="x-default" href="[^"]*" \/>/,
    `<link rel="alternate" hreflang="x-default" href="${page.hreflang.en}" />`,
  );
  html = html
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${page.title}" />`)
    .replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${page.description}" />`,
    )
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${page.canonical}" />`)
    .replace(/<meta property="og:locale" content="[^"]*" \/>/, `<meta property="og:locale" content="${page.ogLocale}" />`)
    .replace(
      /<meta property="og:locale:alternate" content="[^"]*" \/>/,
      `<meta property="og:locale:alternate" content="${page.ogLocaleAlt}" />`,
    )
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${page.title}" />`)
    .replace(
      /<meta name="twitter:description" content="[^"]*" \/>/,
      `<meta name="twitter:description" content="${page.description}" />`,
    );
  html = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">\n    ${JSON.stringify(page.jsonld, null, 2).replace(/\n/g, '\n    ')}\n    </script>`,
  );
  html = html.replace('</head>', `${SEO_STYLE}\n  </head>`);
  html = html.replace(
    /<div id="root"><\/div>/,
    `<div id="root"><div class="seo-pre">${page.body}\n    </div></div>`,
  );
  return html;
}

const shell = readFileSync(join(DIST, 'index.html'), 'utf8');
if (!shell.includes('<div id="root"></div>')) {
  throw new Error('prerender: dist/index.html에 빈 #root가 없습니다 — 셸 구조 변경 여부를 확인하세요.');
}
for (const page of PAGES) {
  const outPath = join(DIST, page.out);
  mkdirSync(dirname(outPath), { recursive: true });
  const html = renderPage(shell, page);
  // 치환 실패(마커 유실) 감지 — 페이지별 title이 실제 반영됐는지 확인
  if (!html.includes(`<title>${page.title}</title>`)) {
    throw new Error(`prerender: ${page.out} title 치환 실패`);
  }
  writeFileSync(outPath, html, 'utf8');
  console.log(`prerender: ${page.out} (${page.lang}) 생성`);
}
