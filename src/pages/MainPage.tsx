import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { isSyntheticEmail } from '../api/auth';
import ContactModal from '../components/ContactModal';
import Footer from '../components/Footer';
import BannerSlot from '../components/BannerSlot';
import DailyEntry from '../components/daily/DailyEntry';
import RunnerScene from '../components/game/RunnerScene';
import { KeyboardIcon, PlayIcon, TrophyIcon } from '../components/heist/HeistIcons';
import '../components/heist/heistMenu.css';
import { SITE_THEME } from '../lib/theme';
import { sound } from '../lib/sound';
import logo from '../assets/backgrounds/logo.png';
import type { Season } from '../api/types';

// 도둑 런 메인 제목 로고(사장 생성본 "마스크 쓴 TYP RUN 로고" → heist-ingest). 크기는 자리를 미리 잡는 용도
const TITLE_LOGO = { src: '/heist/ui/title_logo.webp', width: 1266, height: 522 } as const;

export default function MainPage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [season, setSeason] = useState<Season | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const { user, loading } = useAuth();
  // 터치 기기(폰·태블릿)에만 탭 러너 진입 노출 — 데스크톱 메뉴는 3버튼 유지
  const [isTouch] = useState(
    () => (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) ?? false,
  );
  const isHeist = SITE_THEME === 'heist';

  useEffect(() => {
    api.currentSeason().then(setSeason).catch(console.error);
  }, []);

  // 메뉴 버튼 소리는 누르는 순간 나야 한다 — 그 파일 하나만 미리 받는다(게임용 소리는 게임 화면에서 받는다)
  useEffect(() => {
    if (isHeist) sound.preload(['click']);
  }, [isHeist]);

  // 제목 로고 그림을 다 받은 뒤에 나타나게 한다(받는 중에 빈 틀이 튀어나오지 않게)
  const [isLogoReady, setIsLogoReady] = useState(false);

  // 어트랙트 모드(도둑 런 이전 테마) — 방문자가 클릭 전에 게임을 보게 하는 데모 (아케이드 대기화면).
  // 가짜 정답/미스 카운터만 올려 러너 씬이 점프·가속·넘어짐을 스스로 연기한다.
  // 도둑 런 메인은 전역 배경(HeistBackdrop 의 run)이 화면 전체에 달리는 장면을 깔므로 여기서는 돌리지 않는다.
  const [demo, setDemo] = useState({ correct: 0, miss: 0 });
  useEffect(() => {
    if (isHeist) return;
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setDemo((d) =>
        n % 7 === 0 ? { ...d, miss: d.miss + 1 } : { ...d, correct: d.correct + 1 },
      );
    }, 2400);
    return () => clearInterval(id);
  }, [isHeist]);

  const seasonLine = season ? t('main.season', { year: season.year, month: season.month, end: season.end_date }) : null;

  const loginPrompt = !user && !loading && (
    <>
      {t('main.loginPromptPre')}
      <button className="underline hover:text-white font-semibold" onClick={() => nav('/login')}>
        {t('main.loginPromptLink')}
      </button>
      {t('main.loginPromptPost')}
    </>
  );

  // 상품 수령용 이메일 미등록 경고
  const emailWarning = user && isSyntheticEmail(user.email) && (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      onClick={() => nav('/profile')}
      className="px-4 py-3 rounded-xl bg-yellow-400/15 border border-yellow-400/40 text-yellow-100 text-xs leading-relaxed max-w-sm cursor-pointer hover:bg-yellow-400/20 backdrop-blur-sm"
    >
      {t('main.emailWarnTitle')}<br />
      <span className="text-yellow-100/70 text-[10px]">
        {t('main.emailWarnSub')}
      </span>
    </motion.div>
  );

  const footer = (
    <>
      {/* 하단 푸터 — 개인정보처리방침 / 이용약관 / 운영사 / 제휴문의 */}
      <div className="relative z-10">
        <Footer onContact={() => setContactOpen(true)} />
      </div>
      <AnimatePresence>
        {contactOpen && (
          <ContactModal onClose={() => setContactOpen(false)} defaultKind="inquiry" />
        )}
      </AnimatePresence>
    </>
  );

  // ── 도둑 런 메인(대기화면) — 가운데 위 큰 제목, 가운데에서 도둑이 달리고,
  //    아래 바닥 띠에 [랭킹] [게임 시작] [타자 테스트] 세 버튼(게임 시작이 가운데). 달리는 장면은 전역 배경(HeistBackdrop)이 그린다.
  //    타자 테스트를 우상단 작은 버튼으로 뺐더니 사용이 하루 20~50회 → 0~2회로 줄어 메인으로 되돌렸다(2026-11-27 사장).
  //    로그인·공지(좌상단)는 전역 TopBar. 좁은 화면에서는 버튼이 제목 바로 밑으로 올라간다(CSS).
  if (isHeist) {
    const go = (to: string) => () => {
      sound.play('click');
      nav(to);
    };
    return (
      <div className="relative min-h-[100dvh] flex flex-col">
        <main className="hm-main">
          <motion.h1
            className="hm-title"
            initial={{ opacity: 0, scale: 0.86 }}
            animate={isLogoReady ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.86 }}
            transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.05 }}
          >
            {/* 그림을 못 받아도(onError) 자리는 보여 준다 — 제목이 영영 숨지 않게 */}
            <img
              className="hm-title-logo"
              src={TITLE_LOGO.src}
              width={TITLE_LOGO.width}
              height={TITLE_LOGO.height}
              alt="TypRun"
              draggable={false}
              onLoad={() => setIsLogoReady(true)}
              onError={() => setIsLogoReady(true)}
            />
          </motion.h1>

          <motion.p
            className="hm-tagline"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <span>{t('main.heistTagline')}</span>
            {seasonLine && <span className="hm-tagline-season">{seasonLine}</span>}
          </motion.p>

          {/* 오늘의 도전 + 작은 안내(탭 러너·로그인·이메일 경고) — 넓은 화면은 제목 아래, 좁은 화면은 버튼 아래(CSS order) */}
          <div className="hm-main-notes">
            <DailyEntry onOpen={go('/daily')} />
            {isTouch && (
              <button type="button" className="hm-side" onClick={go('/tap')}>
                {t('main.tapRunner')}
                <span className="hm-badge">β</span>
              </button>
            )}
            {loginPrompt && <p className="hm-main-note">{loginPrompt}</p>}
            {emailWarning}
          </div>

          <motion.div
            className="hm-main-bottom"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.28 }}
          >
            <button type="button" className="hm-btn hm-btn--rank" onClick={go('/rankings')}>
              <TrophyIcon />
              {t('main.rankingShort')}
            </button>
            <button type="button" className="hm-btn hm-btn--go hm-main-go" onClick={go('/league')}>
              <PlayIcon />
              {t('main.start')}
            </button>
            <button type="button" className="hm-btn hm-btn--rank" onClick={go('/test')} title={t('main.speedTest')}>
              <KeyboardIcon />
              {t('main.typingTestShort')}
            </button>
          </motion.div>
        </main>
        {footer}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* 로그인/홈/초대는 전역 TopBar 가 담당 — 메인은 히어로만 */}

      {/* 어트랙트 모드 — 하단에서 러너가 계속 달리는 게임 데모 (클릭 무시, 장식) */}
      <div className="absolute bottom-0 inset-x-0 h-[280px] md:h-[340px] overflow-hidden pointer-events-none" aria-hidden>
        <RunnerScene hp={4} maxHp={5} correct={demo.correct} miss={demo.miss} />
        {/* 상단 페이드 — 씬이 페이지 배경과 자연스럽게 섞이게 */}
        <div
          className="absolute inset-x-0 top-0 h-28"
          style={{ background: 'linear-gradient(#0F1226, rgba(15,18,38,0))' }}
        />
      </div>

      {/* 중앙 히어로 — Figma 301-62 비율 (로고 → 시즌 → 3버튼 → 안내) */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        {/* 로고 그래픽 (태그라인 "단어가 비처럼 내려오는 AI타자게임" 포함) */}
        <motion.img
          src={logo}
          alt="Typ Run"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="w-[260px] md:w-[360px] h-auto drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)]"
        />

        {/* 시즌 */}
        {seasonLine && (
          <p className="text-base md:text-xl text-white mt-3 mb-7 drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)]">
            {seasonLine}
          </p>
        )}

        {/* 버튼 컬럼 (디자인 400px 비율) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full max-w-[400px] flex flex-col gap-3 mt-6 md:mt-8"
        >
          <button
            className="w-full py-4 rounded-[10px] bg-accent text-black font-extrabold text-xl text-center transition shadow-[0_4px_10px_rgba(0,0,0,0.4)] hover:brightness-105 active:scale-[0.98]"
            onClick={() => nav('/test')}
          >
            {t('main.typingTest')}{' '}
            <span className="text-black/55 text-sm font-bold align-middle">{t('main.speedTest')}</span>
          </button>
          {/* 타자레이스 — 속도측정과 중복·게임성 낮음으로 메뉴에서 숨김(2026-07-05, 라우트 /race 는 유지) */}
          <button className="cta-btn" onClick={() => nav('/league')}>
            {t('main.startGame')}
          </button>
          {isTouch && (
            <button className="line-btn py-4 text-lg" onClick={() => nav('/tap')}>
              {t('main.tapRunner')}{' '}
              <span className="text-white/45 text-sm font-bold align-middle">β</span>
            </button>
          )}
          <button className="line-btn py-4 text-lg" onClick={() => nav('/rankings')}>
            {t('main.ranking')}
          </button>
        </motion.div>

        {/* 메인 배너 (히어로 하단) */}
        <div className="w-full max-w-[400px] mt-6">
          <BannerSlot slot="main" isMember={!!user} />
        </div>

        {/* 비로그인 안내 */}
        {loginPrompt && (
          <p className="text-sm text-white/90 mt-5 drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)]">{loginPrompt}</p>
        )}

        {emailWarning && <div className="mt-6">{emailWarning}</div>}
      </div>

      {footer}
    </div>
  );
}
