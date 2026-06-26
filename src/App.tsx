import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AuthProvider } from './contexts/AuthContext';
import MainPage from './pages/MainPage';
import LeaguePage from './pages/LeaguePage';
import LeagueDetailPage from './pages/LeagueDetailPage';
import BattleLobbyPage from './pages/BattleLobbyPage';
import InviteBattlePage from './pages/InviteBattlePage';
import GamePage from './pages/GamePage';
import GameOverPage from './pages/GameOverPage';
import TypingTestPage from './pages/TypingTestPage';
import TypingStatsPage from './pages/TypingStatsPage';
import TypingLeaderboardPage from './pages/TypingLeaderboardPage';
import RankingsPage from './pages/RankingsPage';
import ReferralRankPage from './pages/ReferralRankPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ProfilePage from './pages/ProfilePage';
import DrawPage from './pages/DrawPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import TopBar from './components/TopBar';
import LocaleSuggestBanner from './components/LocaleSuggestBanner';
import SceneBackground from './components/SceneBackground';
import MaintenanceGate from './components/MaintenanceGate';
import { getAppStatus } from './api/status';
import { trackOnce } from './lib/track';

export default function App() {
  // 점검모드 조회 — ON 이면 게임 전체를 점검 화면으로 대체.
  const [maint, setMaint] = useState<{ on: boolean; msg: string } | null>(null);
  useEffect(() => {
    getAppStatus()
      .then((s) => setMaint({ on: s.maintenance, msg: s.maintenanceMessage }))
      .catch(() => setMaint({ on: false, msg: '' }));
  }, []);

  // 퍼널 측정: 세션당 1회 방문 기록(유입 출처 referrer 포함). 게스트 포함.
  useEffect(() => {
    trackOnce('visit');
  }, []);

  if (maint?.on) {
    return (
      <MotionConfig reducedMotion="never">
        <SceneBackground />
        <MaintenanceGate message={maint.msg} />
      </MotionConfig>
    );
  }

  return (
    // reducedMotion="never" — 폰 저전력/동작줄이기에서도 슬라이드·전환 모션 유지(게임 특성상 모션이 핵심).
    // 배경 별은 동작줄이기 시 낙하 대신 은은한 트윙클로 대체(index.css star-twinkle)라 전정기관 안전.
    <MotionConfig reducedMotion="never">
      <AuthProvider>
      {/* 세션 테마 배경 — 모든 페이지에 연속 적용 (배경 고정 + 캐릭터 둥실) */}
      <SceneBackground />
      {/* 공용 상단 바 — 로그인/초대(좌) · 홈(우), 주요 네비 페이지 고정 */}
      <TopBar />
      {/* 한국어 브라우저 첫 방문자에게 "한국어로 보기" 안내 (영어 루트에서만) */}
      <LocaleSuggestBanner />
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/test" element={<TypingTestPage />} />
        <Route path="/test/stats" element={<TypingStatsPage />} />
        <Route path="/test/leaderboard" element={<TypingLeaderboardPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/league" element={<LeaguePage />} />
        <Route path="/league/:categorySeq" element={<LeagueDetailPage />} />
        <Route path="/battle/:categorySeq/:mode" element={<BattleLobbyPage />} />
        {/* 친구 초대 대결 — 생성(로그인 호스트) / 입장(비회원 게스트 가능). new/:cat 가 :code 보다 구체적이라 우선 매칭. */}
        <Route path="/battle/invite/new/:categorySeq" element={<InviteBattlePage mode="create" />} />
        <Route path="/battle/invite/:code" element={<InviteBattlePage mode="join" />} />
        <Route path="/game/:categorySeq" element={<GamePage />} />
        <Route path="/game-over" element={<GameOverPage />} />
        <Route path="/rankings" element={<RankingsPage />} />
        <Route path="/rankings/:categorySeq" element={<RankingsPage />} />
        <Route path="/insider" element={<ReferralRankPage />} />
        <Route path="/draw/:token" element={<DrawPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        {/* 알 수 없는 경로 → 홈으로 (빈 화면 방지) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </AuthProvider>
    </MotionConfig>
  );
}
