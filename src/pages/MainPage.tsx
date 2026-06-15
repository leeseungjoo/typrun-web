import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { isSyntheticEmail } from '../api/auth';
import ContactModal from '../components/ContactModal';
import Footer from '../components/Footer';
import logo from '../assets/backgrounds/logo.png';
import type { Season } from '../api/types';

export default function MainPage() {
  const nav = useNavigate();
  const [season, setSeason] = useState<Season | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const { user, loading } = useAuth();

  useEffect(() => {
    api.currentSeason().then(setSeason).catch(console.error);
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* 로그인/홈/초대는 전역 TopBar 가 담당 — 메인은 히어로만 */}

      {/* 중앙 히어로 — Figma 301-62 비율 (로고 → 시즌 → 3버튼 → 안내) */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
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
            {season.year}년 {season.month}월 시즌 진행중 · ~{season.end_date}
          </p>
        )}

        {/* 버튼 컬럼 (디자인 400px 비율) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full max-w-[400px] flex flex-col gap-3"
        >
          <button className="cta-btn" onClick={() => nav('/league')}>
            게임 시작하기
          </button>
          <button className="line-btn py-4 text-lg" onClick={() => nav('/rankings')}>
            랭킹 보기
          </button>
          <button className="line-btn py-3.5 text-base" onClick={() => setContactOpen(true)}>
            <span className="text-white/70">아이디어 / </span>
            <span className="text-white">이벤트 제휴 문의</span>
          </button>
        </motion.div>

        {/* 메인 배너 (히어로 하단) */}
        <div className="w-full max-w-[400px] mt-6">
          <BannerSlot slot="main" isMember={!!user} />
        </div>

        {/* 메인 배너 (히어로 하단) */}
        <div className="w-full max-w-[400px] mt-6">
          <BannerSlot slot="main" isMember={!!user} />
        </div>

        {/* 비로그인 안내 */}
        {!user && !loading && (
          <p className="text-sm text-white/90 mt-5 drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)]">
            🏆 랭킹에 점수 저장하려면{' '}
            <button className="underline hover:text-white font-semibold" onClick={() => nav('/login')}>
              로그인
            </button>{' '}
            하세요
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
            ⚠️ 상품 수령용 이메일이 등록되지 않았어요<br />
            <span className="text-yellow-100/70 text-[10px]">
              랭킹 상위 입상 시 연락받으려면 클릭해서 이메일 등록
            </span>
          </motion.div>
        )}
      </div>

      {/* 하단 푸터 — 개인정보처리방침 / 이용약관 */}
      <Footer />

      {/* 문의 모달 */}
      <AnimatePresence>
        {contactOpen && (
          <ContactModal onClose={() => setContactOpen(false)} defaultKind="inquiry" />
        )}
      </AnimatePresence>
    </div>
  );
}
