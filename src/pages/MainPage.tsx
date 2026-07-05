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
import RunnerScene from '../components/game/RunnerScene';
import logo from '../assets/backgrounds/logo.png';
import type { Season } from '../api/types';

export default function MainPage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [season, setSeason] = useState<Season | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const { user, loading } = useAuth();

  useEffect(() => {
    api.currentSeason().then(setSeason).catch(console.error);
  }, []);

  // 어트랙트 모드 — 방문자가 클릭 전에 게임을 보게 하는 데모 (아케이드 대기화면).
  // 가짜 정답/미스 카운터만 올려 러너 씬이 점프·가속·넘어짐을 스스로 연기한다.
  const [demo, setDemo] = useState({ correct: 0, miss: 0 });
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setDemo((d) =>
        n % 7 === 0 ? { ...d, miss: d.miss + 1 } : { ...d, correct: d.correct + 1 },
      );
    }, 2400);
    return () => clearInterval(id);
  }, []);

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
        {season && (
          <p className="text-base md:text-xl text-white mt-3 mb-7 drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)]">
            {t('main.season', { year: season.year, month: season.month, end: season.end_date })}
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
          <button className="line-btn py-4 text-lg" onClick={() => nav('/rankings')}>
            {t('main.ranking')}
          </button>
        </motion.div>

        {/* 메인 배너 (히어로 하단) */}
        <div className="w-full max-w-[400px] mt-6">
          <BannerSlot slot="main" isMember={!!user} />
        </div>

        {/* 비로그인 안내 */}
        {!user && !loading && (
          <p className="text-sm text-white/90 mt-5 drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)]">
            {t('main.loginPromptPre')}
            <button className="underline hover:text-white font-semibold" onClick={() => nav('/login')}>
              {t('main.loginPromptLink')}
            </button>
            {t('main.loginPromptPost')}
          </p>
        )}

        {/* 상품 수령용 이메일 미등록 경고 */}
        {user && isSyntheticEmail(user.email) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onClick={() => nav('/profile')}
            className="mt-6 px-4 py-3 rounded-xl bg-yellow-400/15 border border-yellow-400/40 text-yellow-100 text-xs leading-relaxed max-w-sm cursor-pointer hover:bg-yellow-400/20 backdrop-blur-sm"
          >
            {t('main.emailWarnTitle')}<br />
            <span className="text-yellow-100/70 text-[10px]">
              {t('main.emailWarnSub')}
            </span>
          </motion.div>
        )}
      </div>

      {/* 하단 푸터 — 개인정보처리방침 / 이용약관 / 운영사 / 제휴문의 (어트랙트 씬 위 레이어) */}
      <div className="relative z-10">
        <Footer onContact={() => setContactOpen(true)} />
      </div>

      {/* 문의 모달 */}
      <AnimatePresence>
        {contactOpen && (
          <ContactModal onClose={() => setContactOpen(false)} defaultKind="inquiry" />
        )}
      </AnimatePresence>
    </div>
  );
}
