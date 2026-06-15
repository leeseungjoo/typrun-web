import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AuthProvider } from './contexts/AuthContext';
import MainPage from './pages/MainPage';
import LeaguePage from './pages/LeaguePage';
import LeagueDetailPage from './pages/LeagueDetailPage';
import BattleLobbyPage from './pages/BattleLobbyPage';
import GamePage from './pages/GamePage';
import GameOverPage from './pages/GameOverPage';
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
import SceneBackground from './components/SceneBackground';
import MaintenanceGate from './components/MaintenanceGate';
import { getAppStatus } from './api/status';

export default function App() {
  // 점검모드 조회 — ON 이면 게임 전체를 점검 화면으로 대체.
  const [maint, setMaint] = useState<{ on: boolean; msg: string } | null>(null);
  useEffect(() => {
    getAppStatus()
      .then((s) => setMaint({ on: s.maintenance, msg: s.maintenanceMessage }))
      .catch(() => setMaint({ on: false, msg: '' }));
  }, []);

  if (maint?.on) {
    return (
      <MotionConfig reducedMotion="user">
        <SceneBackground />
        <MaintenanceGate message={maint.msg} />
      </MotionConfig>
    );
  }

  return (
    // reducedMotion="user" — OS '동작 줄이기' 설정 시 모든 framer-motion 연출 자동 감속(a11y).
    <MotionConfig reducedMotion="user">
      <AuthProvider>
      {/* 세션 테마 배경 — 모든 페이지에 연속 적용 (배경 고정 + 캐릭터 둥실) */}
      <SceneBackground />
      {/* 공용 상단 바 — 로그인/초대(좌) · 홈(우), 주요 네비 페이지 고정 */}
      <TopBar />
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/league" element={<LeaguePage />} />
        <Route path="/league/:categorySeq" element={<LeagueDetailPage />} />
        <Route path="/battle/:categorySeq/:mode" element={<BattleLobbyPage />} />
        <Route path="/game/:categorySeq" element={<GamePage />} />
        <Route path="/game-over" element={<GameOverPage />} />
        <Route path="/rankings" element={<RankingsPage />} />
        <Route path="/rankings/:categorySeq" element={<RankingsPage />} />
        <Route path="/insider" element={<ReferralRankPage />} />
        <Route path="/draw/:token" element={<DrawPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
      </Routes>
      </AuthProvider>
    </MotionConfig>
  );
}
