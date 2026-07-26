// 빌드타임 SEO 사전 렌더 — 네이버·구글 크롤러가 JS 실행 전에 읽는 HTML 을 생성한다.
// (네이버 Yeti 는 2022년부터 Chromium 렌더링을 하지만, 사전 렌더 HTML 이 여전히 1차 판단 근거다.
//  네이버는 SSR/사전 렌더를 권장한다 — 크롤러와 사용자에게 "같은 내용의 다른 표현"이어야 클로킹이 아니다.)
//
// vite build 후 dist/index.html 셸을 읽어 다음을 생성한다:
//   dist/index.html          /            (en, 자기 canonical)
//   dist/kr/index.html       /kr          (ko, 한국어 메인)
//   dist/test/index.html     /test        (en)
//   dist/kr/test/index.html  /kr/test     (ko)
//   dist/kr/privacy/index.html, dist/kr/terms/index.html   (ko 법적 고지 — 신뢰 신호)
//   dist/privacy/index.html, dist/terms/index.html         (실제 본문이 한국어이므로 /kr/* 로 canonical 통합)
//   dist/app.html            사전 렌더 대상이 아닌 앱 라우트용 폴백 셸 (noindex, canonical 없음)
//   dist/sitemap.xml         canonical URL 만 + lastmod (수기 관리 폐지)
//
// 본문은 #root 안에 주입 — React createRoot().render() 가 마운트 시 통째로 교체한다.
// nginx try_files 가 경로별 파일을 서빙하고, 미매칭 경로는 app.html(noindex) 로 폴백한다.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const ORIGIN = 'https://typrun.com';
const BUILD_DATE = new Date().toISOString().slice(0, 10);

const OPERATOR_FOOTER_KO =
  '<a href="/kr/privacy">개인정보처리방침</a> · <a href="/kr/terms">이용약관</a> · ' +
  '운영사: Typ Run (<a href="https://kioskprogram.com" rel="noopener">kioskprogram.com</a>) · © 2026 Typ Run';
const OPERATOR_FOOTER_EN =
  '<a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms</a> · ' +
  'Operator: Typ Run (<a href="https://kioskprogram.com" rel="noopener">kioskprogram.com</a>) · © 2026 Typ Run';

/**
 * 페이지 정의.
 * - title 은 25~40자, 주 키워드 1회 + 브랜드 1회 (키워드 반복·홍보문구 나열은 네이버 감점 항목)
 * - description 은 60~80자, 페이지마다 고유
 * - hreflang: null 이면 상호 참조 쌍이 없는 페이지 → 셸의 hreflang 3줄을 삭제한다
 * - sitemap: false 면 sitemap 에 넣지 않는다(canonical 이 다른 URL 을 가리키는 중복 페이지)
 * - 본문은 실제 서비스에 존재하는 기능만 서술한다(없는 기능을 쓰면 낚시성 판정 + 즉시 이탈)
 */
const PAGES = [
  {
    out: 'index.html',
    lang: 'en',
    canonical: `${ORIGIN}/`,
    hreflang: { en: `${ORIGIN}/`, ko: `${ORIGIN}/kr` },
    priority: '1.0',
    title: 'TypRun — Free Online Typing Game &amp; Multiplayer Battle',
    description:
      'Free browser typing game with real-time multiplayer battles. Measure your WPM and accuracy, then climb the monthly leaderboard — no install, no signup.',
    ogLocale: 'en_US',
    ogLocaleAlt: 'ko_KR',
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'TypRun',
      alternateName: ['TypRun typing game', '타입런', '타입런 타자게임'],
      url: `${ORIGIN}/`,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description:
        'Free browser typing game with real-time multiplayer battles, WPM measurement and a monthly leaderboard.',
      inLanguage: ['en', 'ko'],
      publisher: { '@type': 'Organization', name: 'Typ Run', url: 'https://kioskprogram.com' },
    },
    body: `
      <nav aria-label="Main">
        <a href="/test">Typing Test</a>
        <a href="/kr">한국어</a>
      </nav>
      <main>
        <h1>Free Online Typing Game and Multiplayer Typing Battles — TypRun</h1>
        <p>TypRun is a free typing game that runs in your browser — no install, no signup.
           Type the falling words before they pile up, race a friend in real time, measure your
           WPM and accuracy, and climb the leaderboard that resets on the 1st of every month.</p>
        <h2>Typing speed test — WPM and accuracy</h2>
        <p>Choose 15, 30 or 60 seconds and get words per minute, accuracy and consistency.
           Korean and English word sets are both supported.</p>
        <h2>Real-time battles and typing race</h2>
        <p>Send an invite link and battle head to head, or run the race mode and finish the word
           list as fast as you can.</p>
      </main>
      <footer>${OPERATOR_FOOTER_EN}</footer>`,
  },
  {
    out: 'kr/index.html',
    lang: 'ko',
    canonical: `${ORIGIN}/kr`,
    hreflang: { en: `${ORIGIN}/`, ko: `${ORIGIN}/kr` },
    priority: '0.9',
    title: '무료 타자게임 · 온라인 타자연습 — 타입런(TypRun)',
    description:
      '설치와 회원가입 없이 브라우저에서 바로 하는 무료 타자게임. 한글 타수와 영타 WPM을 재고, 친구와 실시간으로 대결합니다.',
    ogLocale: 'ko_KR',
    ogLocaleAlt: 'en_US',
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: '타입런(TypRun)',
      alternateName: ['타입런', 'TypRun', '타입런 타자게임'],
      url: `${ORIGIN}/kr`,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
      description:
        '무료 온라인 타자게임 — 떨어지는 단어를 입력하는 게임, 타자 속도 테스트, 실시간 대결, 월간 랭킹.',
      inLanguage: ['ko', 'en'],
      publisher: { '@type': 'Organization', name: 'Typ Run', url: 'https://kioskprogram.com' },
    },
    body: `
      <nav aria-label="주 메뉴">
        <a href="/kr/test">타자 속도 테스트</a>
        <a href="/">English</a>
      </nav>
      <main>
        <h1>무료 타자게임과 온라인 타자연습 — 타입런(TypRun)</h1>
        <p>타입런은 설치도 회원가입도 없이 브라우저에서 바로 시작하는 무료 타자게임입니다.
           위에서 떨어지는 단어를 입력해 없애는 방식이라 타자연습이 게임처럼 진행되고,
           한글은 분당 타수, 영어는 WPM으로 속도가 기록됩니다.</p>
        <h2>게임 모드</h2>
        <p>떨어지는 단어를 입력하는 기본 게임, 시간을 정해 속도를 재는 타자 속도 테스트,
           단어를 모두 입력해 결승선까지 달리는 타자 레이스, 초대 링크로 친구와 겨루는
           실시간 대결, 모바일 전용 탭 러너를 제공합니다.</p>
        <h2>주제별 리그</h2>
        <p>생초보 한글부터 영어 단어, 영화 제목, 아이돌, 사자성어까지 주제별 리그에서
           원하는 단어로 연습할 수 있습니다. 리그마다 난이도가 다르게 설정되어 있습니다.</p>
        <h2>랭킹과 시즌</h2>
        <p>랭킹은 매월 1일 초기화되어 누구나 새로 도전할 수 있습니다. 로그인 없이도 플레이할 수
           있고, 로그인하면 기록이 저장되어 월간 랭킹에 집계됩니다.</p>
      </main>
      <footer>${OPERATOR_FOOTER_KO}</footer>`,
  },
  {
    out: 'test/index.html',
    lang: 'en',
    canonical: `${ORIGIN}/test`,
    hreflang: { en: `${ORIGIN}/test`, ko: `${ORIGIN}/kr/test` },
    priority: '0.8',
    title: 'Typing Speed Test — Measure Your WPM Free | TypRun',
    description:
      'Free typing speed test in 15, 30 or 60 seconds. Measure WPM, accuracy and consistency, then compare on the monthly leaderboard.',
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
      description: 'Free typing speed test — 15, 30 or 60 seconds. WPM, accuracy and consistency.',
      inLanguage: ['en', 'ko'],
    },
    body: `
      <nav aria-label="Main">
        <a href="/">Home</a>
        <a href="/kr/test">한국어</a>
      </nav>
      <main>
        <h1>Typing Speed Test — WPM, Accuracy and Consistency</h1>
        <p>Pick 15, 30 or 60 seconds (30 is the default) and start typing. TypRun measures words
           per minute, accuracy and consistency in real time and saves your personal best.
           English and Korean word sets are both supported — no signup required.</p>
        <h2>What the numbers mean</h2>
        <p>WPM counts correctly typed words per minute, accuracy is the share of correct
           keystrokes, and consistency shows how steady your pace stays. Press Tab to retake.</p>
      </main>
      <footer>${OPERATOR_FOOTER_EN}</footer>`,
  },
  {
    out: 'kr/test/index.html',
    lang: 'ko',
    canonical: `${ORIGIN}/kr/test`,
    hreflang: { en: `${ORIGIN}/test`, ko: `${ORIGIN}/kr/test` },
    priority: '0.8',
    title: '타자 속도 테스트 — 타수·정확도 무료 측정 | 타입런',
    description:
      '15·30·60초 중 원하는 시간으로 타자 속도를 측정합니다. 한글 분당 타수와 영문 WPM, 정확도와 균일도를 함께 확인하세요.',
    ogLocale: 'ko_KR',
    ogLocaleAlt: 'en_US',
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: '타입런 타자 속도 테스트',
      url: `${ORIGIN}/kr/test`,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
      description: '무료 타자 속도 테스트 — 15·30·60초, 분당 타수·WPM·정확도·균일도 측정.',
      inLanguage: ['ko', 'en'],
    },
    body: `
      <nav aria-label="주 메뉴">
        <a href="/kr">홈</a>
        <a href="/test">English</a>
      </nav>
      <main>
        <h1>타자 속도 테스트 — 분당 타수와 정확도 무료 측정</h1>
        <p>15초·30초·60초 중 원하는 시간을 고르고(기본 30초) 아무 키나 누르면 측정이 시작됩니다.
           한글은 분당 타수, 영어는 WPM으로 속도를 계산하고 정확도와 균일도, 정타·오타 수까지
           함께 보여줍니다. 회원가입 없이 무료로 이용할 수 있습니다.</p>
        <h2>측정 항목</h2>
        <p>분당 타수와 WPM은 정확히 입력한 양을 기준으로 계산하고, 정확도는 전체 입력 중 정타
           비율, 균일도는 속도가 얼마나 일정했는지를 뜻합니다. Tab 키로 언제든 다시 시작합니다.</p>
        <h2>기록 저장과 리더보드</h2>
        <p>로그인하면 테스트 기록이 저장되고 내 통계와 타자 리더보드에서 다른 이용자와 비교할 수
           있습니다. 랭킹은 매월 1일 초기화됩니다.</p>
      </main>
      <footer>${OPERATOR_FOOTER_KO}</footer>`,
  },
  {
    out: 'kr/privacy/index.html',
    lang: 'ko',
    canonical: `${ORIGIN}/kr/privacy`,
    hreflang: null,
    priority: '0.4',
    title: '개인정보처리방침 — 타입런(TypRun)',
    description:
      '타입런(typrun.com)이 수집하는 개인정보 항목과 이용 목적, 보유 기간, 이용자의 권리와 문의 창구를 안내합니다.',
    ogLocale: 'ko_KR',
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: '개인정보처리방침 — 타입런(TypRun)',
      url: `${ORIGIN}/kr/privacy`,
      inLanguage: 'ko',
      isPartOf: { '@type': 'WebSite', name: '타입런(TypRun)', url: `${ORIGIN}/kr` },
    },
    body: `
      <nav aria-label="주 메뉴">
        <a href="/kr">홈</a>
        <a href="/kr/terms">이용약관</a>
      </nav>
      <main>
        <h1>개인정보처리방침</h1>
        <p>Typ Run(typrun.com, 이하 “서비스”)는 이용자의 개인정보를 중요하게 생각하며,
           「개인정보 보호법」 등 관련 법령을 준수합니다. 본 방침은 서비스가 어떤 개인정보를
           어떤 목적으로 수집·이용하며 어떻게 보호하는지 설명합니다.</p>
        <h2>1. 수집하는 개인정보 항목</h2>
        <p>이메일 회원가입 시 이메일·비밀번호(암호화 저장)·닉네임, 소셜 로그인 시 제공사
           식별자와 제공사가 전달한 이메일·닉네임·프로필 이미지, 선택 항목으로 자기소개와
           프로필 이미지를 수집합니다. 게임 이용 시 점수·정확도·타수(WPM)·콤보·플레이 시간이
           자동 생성되며, 경품 당첨 시 상품 발송용 이메일, 문의 접수 시 이름과 회신용 연락처를
           받습니다. 부정 이용·도배 방지를 위해 접속 IP 주소를 자동 수집합니다.</p>
        <h2>2. 개인정보의 수집·이용 목적</h2>
        <p>회원 식별과 로그인 유지, 타자 게임 서비스 제공과 점수 기록 및 리그·랭킹 운영,
           경품 추첨과 당첨 안내, 친구 추천 이벤트 집계, 문의 응대, 매크로·도배 등 부정 이용
           방지와 서비스 안정성 확보를 목적으로 이용합니다.</p>
        <h2>3. 보유 및 이용 기간</h2>
        <p>개인정보는 수집·이용 목적이 달성되거나 회원 탈퇴 시 지체 없이 파기합니다. 단 관련
           법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다. 게임 기록·랭킹은 회원
           탈퇴 시까지 보관하며 통계는 익명 처리 후 보관할 수 있습니다.</p>
        <h2>4. 제3자 제공 및 처리위탁</h2>
        <p>서비스는 이용자의 개인정보를 외부에 판매하거나 제공하지 않습니다. 다만 소셜
           로그인(카카오·구글·네이버) 인증과 회원 인증·비밀번호 재설정·문의 회신 메일 발송을
           위한 위탁·연동이 이루어질 수 있으며, 변경 시 본 방침을 통해 사전 고지합니다.</p>
        <h2>5. 이용자의 권리와 행사 방법</h2>
        <p>이용자는 언제든지 자신의 개인정보를 열람·정정·삭제하거나 처리정지를 요청할 수
           있습니다. 닉네임·자기소개·프로필 이미지·이메일은 프로필 화면에서 직접 수정할 수
           있으며, 회원 탈퇴 및 기타 요청은 아래 연락처로 문의해 주시기 바랍니다.</p>
        <h2>6. 안전성 확보 조치</h2>
        <p>비밀번호는 복호화 불가능한 방식으로 암호화하여 저장하고, 통신 구간에 SSL/TLS
           암호화를 적용하며, 접근 권한을 최소화하고 관리자 인증을 적용합니다.</p>
        <h2>7. 개인정보 보호책임자</h2>
        <p>운영 주체는 Typ Run이며, 개인정보 처리에 관한 문의·불만·피해 구제는
           lsj@kioskprogram.com 으로 연락해 주시기 바랍니다.</p>
        <h2>8. 권익 침해 구제 방법</h2>
        <p>개인정보 침해 상담·신고가 필요한 경우 개인정보분쟁조정위원회(privacy.go.kr,
           1833-6972), 개인정보침해신고센터(privacy.kisa.or.kr, 118), 대검찰청
           사이버수사과(spo.go.kr, 1301), 경찰청 사이버수사국(ecrm.police.go.kr, 182)에
           문의할 수 있습니다.</p>
        <h2>9. 방침의 변경</h2>
        <p>본 개인정보처리방침은 법령·서비스 변경에 따라 개정될 수 있으며, 변경 시 서비스 내
           공지를 통해 안내합니다.</p>
      </main>
      <footer>${OPERATOR_FOOTER_KO}</footer>`,
  },
  {
    out: 'kr/terms/index.html',
    lang: 'ko',
    canonical: `${ORIGIN}/kr/terms`,
    hreflang: null,
    priority: '0.4',
    title: '이용약관 — 타입런(TypRun)',
    description:
      '타입런 서비스 이용약관. 회원가입과 계정 관리, 이용자의 의무, 경품 이벤트, 이용 제한과 면책 범위를 규정합니다.',
    ogLocale: 'ko_KR',
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: '이용약관 — 타입런(TypRun)',
      url: `${ORIGIN}/kr/terms`,
      inLanguage: 'ko',
      isPartOf: { '@type': 'WebSite', name: '타입런(TypRun)', url: `${ORIGIN}/kr` },
    },
    body: `
      <nav aria-label="주 메뉴">
        <a href="/kr">홈</a>
        <a href="/kr/privacy">개인정보처리방침</a>
      </nav>
      <main>
        <h1>이용약관</h1>
        <h2>제1조 (목적)</h2>
        <p>본 약관은 Typ Run(typrun.com, 이하 “서비스”)가 제공하는 타자 게임, 랭킹·리그,
           경품 추첨 및 친구 추천 이벤트 등 일체의 서비스 이용에 관한 운영자와 이용자 간의
           권리·의무 및 책임 사항을 규정함을 목적으로 합니다.</p>
        <h2>제2조 (회원가입 및 계정)</h2>
        <p>이용자는 이메일 또는 소셜 로그인(카카오·구글·네이버)으로 회원가입할 수 있습니다.
           이메일 가입 시 이메일 인증을 완료해야 정상적으로 로그인할 수 있으며, 계정 정보는
           본인이 관리할 책임이 있고 타인에게 양도·대여할 수 없습니다.</p>
        <h2>제3조 (이용자의 의무)</h2>
        <p>매크로·자동 입력 등 비정상적인 방법으로 점수·랭킹을 조작하는 행위, 닉네임·자기소개에
           욕설·비방·음란물 등 타인의 권리를 침해하는 내용을 사용하는 행위, 타인의 계정을
           도용하거나 서비스 운영을 방해하는 행위, 문의·신고 기능을 도배하거나 허위 사실을
           접수하는 행위를 하여서는 안 됩니다.</p>
        <h2>제4조 (경품 및 이벤트)</h2>
        <p>경품 추첨은 공지된 기간·조건에 따라 진행되며, 상품 발송을 위해 당첨자의 이메일 등
           연락 정보가 필요할 수 있습니다. 부정한 방법으로 참여하거나 당첨된 경우 당첨과 보상은
           취소될 수 있고, 경품의 종류·수량·일정은 운영 사정에 따라 변경될 수 있습니다.</p>
        <h2>제5조 (서비스의 제공 및 변경)</h2>
        <p>운영자는 서비스의 내용·기능을 개선하기 위해 일부를 변경하거나, 운영상·기술상
           필요에 따라 서비스의 전부 또는 일부를 중단할 수 있습니다. 중대한 변경 시 사전에
           공지합니다.</p>
        <h2>제6조 (이용 제한)</h2>
        <p>이용자가 본 약관 또는 관련 법령을 위반한 경우, 운영자는 사전 통지 후(긴급한 경우
           통지 없이) 게시물 삭제, 점수·랭킹 초기화, 이용 정지 또는 계정 해지 등의 조치를 취할
           수 있습니다.</p>
        <h2>제7조 (면책)</h2>
        <p>천재지변·정전·외부 서비스 장애 등 운영자의 통제 범위를 벗어난 사유로 인한 손해와,
           이용자 본인의 부주의로 발생한 손해에 대해서는 책임을 지지 않습니다.</p>
        <h2>제8조 (약관의 변경 및 준거법)</h2>
        <p>본 약관은 관련 법령에 따라 변경될 수 있으며, 변경 시 서비스 내 공지를 통해 알립니다.
           명시되지 않은 사항은 관련 법령 및 상관례에 따르며, 분쟁은 대한민국 법을 준거법으로
           합니다.</p>
      </main>
      <footer>${OPERATOR_FOOTER_KO}</footer>`,
  },
];

// 실제 본문이 한국어인 법적 고지의 영어 트리 URL — 중복이므로 /kr/* 로 canonical 통합하고 sitemap 제외.
for (const [enPath, koPage] of [
  ['privacy/index.html', 'kr/privacy/index.html'],
  ['terms/index.html', 'kr/terms/index.html'],
]) {
  const base = PAGES.find((p) => p.out === koPage);
  PAGES.push({ ...base, out: enPath, sitemap: false });
}

/** 하이드레이션 전 플래시가 깨져 보이지 않게 하는 최소 스타일 (앱 배경 #0F1226 동일) */
const SEO_STYLE = `
    <style>
      .seo-pre{min-height:100vh;background:#0F1226;color:#e7e9f4;font-family:Pretendard,'Nanum Gothic',sans-serif;padding:48px 20px;box-sizing:border-box}
      .seo-pre nav a,.seo-pre footer a{color:#9aa3d0;margin-right:14px;text-decoration:none}
      .seo-pre main{max-width:760px;margin:32px auto;line-height:1.7}
      .seo-pre h1{font-size:1.5rem}.seo-pre h2{font-size:1.15rem;margin-top:1.6em}
      .seo-pre footer{max-width:760px;margin:40px auto 0;font-size:.85rem;color:#8b91b5}
    </style>`;

const HREFLANG_BLOCK =
  /\s*<!-- hreflang[^>]*-->\s*<link rel="alternate" hreflang="en"[^>]*\/>\s*<link rel="alternate" hreflang="ko"[^>]*\/>\s*<link rel="alternate" hreflang="x-default"[^>]*\/>/;

function replaceOnce(html, pattern, replacement, what, out) {
  if (!pattern.test(html)) {
    throw new Error(`prerender: ${out} — ${what} 치환 대상을 찾지 못했습니다(셸 구조 변경 확인 필요)`);
  }
  return html.replace(pattern, replacement);
}

function renderPage(shell, page) {
  let html = shell;
  const o = page.out;

  html = replaceOnce(html, /<html lang="[^"]*">/, `<html lang="${page.lang}">`, 'html lang', o);
  html = replaceOnce(html, /<title>[\s\S]*?<\/title>/, `<title>${page.title}</title>`, 'title', o);
  html = replaceOnce(
    html,
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${page.description}" />`,
    'description',
    o,
  );
  html = replaceOnce(
    html,
    /<link rel="canonical" href="[^"]*" \/>/,
    `<link rel="canonical" href="${page.canonical}" />`,
    'canonical',
    o,
  );

  if (page.hreflang) {
    html = replaceOnce(
      html,
      /<link rel="alternate" hreflang="en" href="[^"]*" \/>/,
      `<link rel="alternate" hreflang="en" href="${page.hreflang.en}" />`,
      'hreflang en',
      o,
    );
    html = replaceOnce(
      html,
      /<link rel="alternate" hreflang="ko" href="[^"]*" \/>/,
      `<link rel="alternate" hreflang="ko" href="${page.hreflang.ko}" />`,
      'hreflang ko',
      o,
    );
    html = replaceOnce(
      html,
      /<link rel="alternate" hreflang="x-default" href="[^"]*" \/>/,
      `<link rel="alternate" hreflang="x-default" href="${page.hreflang.en}" />`,
      'hreflang x-default',
      o,
    );
  } else {
    // 상호 참조 쌍이 없는 페이지는 hreflang 을 치환하지 않고 삭제한다(잘못된 언어 대체 신호 방지)
    html = replaceOnce(html, HREFLANG_BLOCK, '', 'hreflang 블록 삭제', o);
    html = replaceOnce(
      html,
      /\s*<meta property="og:locale:alternate" content="[^"]*" \/>/,
      '',
      'og:locale:alternate 삭제',
      o,
    );
  }

  html = replaceOnce(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${page.title}" />`, 'og:title', o);
  html = replaceOnce(
    html,
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${page.description}" />`,
    'og:description',
    o,
  );
  html = replaceOnce(html, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${page.canonical}" />`, 'og:url', o);
  html = replaceOnce(html, /<meta property="og:locale" content="[^"]*" \/>/, `<meta property="og:locale" content="${page.ogLocale}" />`, 'og:locale', o);
  if (page.hreflang) {
    html = replaceOnce(
      html,
      /<meta property="og:locale:alternate" content="[^"]*" \/>/,
      `<meta property="og:locale:alternate" content="${page.ogLocaleAlt}" />`,
      'og:locale:alternate',
      o,
    );
  }
  html = replaceOnce(html, /<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${page.title}" />`, 'twitter:title', o);
  html = replaceOnce(
    html,
    /<meta name="twitter:description" content="[^"]*" \/>/,
    `<meta name="twitter:description" content="${page.description}" />`,
    'twitter:description',
    o,
  );
  html = replaceOnce(
    html,
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">\n    ${JSON.stringify(page.jsonld, null, 2).replace(/\n/g, '\n    ')}\n    </script>`,
    'JSON-LD',
    o,
  );
  html = html.replace('</head>', `${SEO_STYLE}\n  </head>`);
  html = replaceOnce(
    html,
    /<div id="root"><\/div>/,
    `<div id="root"><div class="seo-pre">${page.body}\n    </div></div>`,
    '본문 주입',
    o,
  );
  return html;
}

/** 치환 누락 감지 — 셸 마커가 바뀌면 조용히 잘못된 메타가 나가는 것을 막는다 */
function assertReplaced(html, page) {
  const checks = [
    [`<title>${page.title}</title>`, 'title'],
    [`content="${page.description}"`, 'description'],
    [`<link rel="canonical" href="${page.canonical}" />`, 'canonical'],
    [`<meta property="og:url" content="${page.canonical}" />`, 'og:url'],
    [`<html lang="${page.lang}">`, 'html lang'],
    ['class="seo-pre"', '본문'],
  ];
  for (const [needle, what] of checks) {
    if (!html.includes(needle)) throw new Error(`prerender: ${page.out} — ${what} 반영 실패`);
  }
  if (!page.hreflang && /hreflang=/.test(html)) {
    throw new Error(`prerender: ${page.out} — hreflang 이 남아 있습니다(단독 페이지여야 함)`);
  }
  const titleLen = page.title.replace(/&amp;/g, '&').length;
  const descLen = page.description.length;
  if (titleLen > 40) console.warn(`  ⚠ ${page.out} title ${titleLen}자 — 네이버 권고 40자 초과`);
  if (descLen > 80) console.warn(`  ⚠ ${page.out} description ${descLen}자 — 네이버 권고 80자 초과`);
}

/**
 * 사전 렌더 대상이 아닌 앱 라우트(/kr/race, /kr/league, /profile …)용 폴백 셸.
 * canonical·hreflang·JSON-LD 를 제거하고 noindex 를 넣어, 같은 HTML 이 여러 URL 에서
 * 색인되는 것(영문 루트 셸이 /terms 로 색인되던 문제)을 막는다. 사용자에게는 SPA 가 정상 동작한다.
 */
function renderAppShell(shell) {
  let html = shell;
  html = html.replace(/\s*<link rel="canonical" href="[^"]*" \/>/, '');
  html = html.replace(HREFLANG_BLOCK, '');
  html = html.replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/, '');
  html = html.replace(
    /<title>[\s\S]*?<\/title>/,
    '<title>TypRun</title>\n    <meta name="robots" content="noindex, follow" />',
  );
  if (!html.includes('noindex')) throw new Error('prerender: app.html noindex 주입 실패');
  if (/rel="canonical"/.test(html)) throw new Error('prerender: app.html 에 canonical 이 남아 있습니다');
  return html;
}

function renderSitemap(pages) {
  const entries = pages
    .filter((p) => p.sitemap !== false)
    .map((p) => {
      const alt = p.hreflang
        ? [
            `    <xhtml:link rel="alternate" hreflang="en" href="${p.hreflang.en}"/>`,
            `    <xhtml:link rel="alternate" hreflang="ko" href="${p.hreflang.ko}"/>`,
            `    <xhtml:link rel="alternate" hreflang="x-default" href="${p.hreflang.en}"/>`,
          ].join('\n')
        : null;
      return [
        '  <url>',
        `    <loc>${p.canonical}</loc>`,
        alt,
        `    <lastmod>${BUILD_DATE}</lastmod>`,
        '    <changefreq>weekly</changefreq>',
        `    <priority>${p.priority}</priority>`,
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n');
    });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
}

const shell = readFileSync(join(DIST, 'index.html'), 'utf8');
if (!shell.includes('<div id="root"></div>')) {
  throw new Error('prerender: dist/index.html 에 빈 #root 가 없습니다 — 셸 구조 변경 여부를 확인하세요.');
}

for (const page of PAGES) {
  const outPath = join(DIST, page.out);
  mkdirSync(dirname(outPath), { recursive: true });
  const html = renderPage(shell, page);
  assertReplaced(html, page);
  writeFileSync(outPath, html, 'utf8');
  console.log(`prerender: ${page.out} (${page.lang}) — ${page.canonical}`);
}

writeFileSync(join(DIST, 'app.html'), renderAppShell(shell), 'utf8');
console.log('prerender: app.html (noindex 폴백 셸)');

writeFileSync(join(DIST, 'sitemap.xml'), renderSitemap(PAGES), 'utf8');
console.log(`prerender: sitemap.xml (${PAGES.filter((p) => p.sitemap !== false).length} URL, lastmod ${BUILD_DATE})`);
