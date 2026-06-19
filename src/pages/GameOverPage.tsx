import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import BannerSlot from '../components/BannerSlot';
import type { ScoreSaveResponse } from '../api/types';

const PENDING_KEY = 'typrun_pending_result';

interface GameResult {
  category_seq: number;
  is_practice?: boolean; // 연습 리그면 점수 저장/랭킹 제외
  score: number;
  max_combo: number;
  correct_count: number;
  miss_count: number;
  accuracy: number;     // 0~1
  wpm: number;
  play_time_sec: number;
  items_used: number;
}

function isGameResult(v: unknown): v is GameResult {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as GameResult).score === 'number' &&
    typeof (v as GameResult).category_seq === 'number'
  );
}

function readPendingResult(): GameResult | null {
  try {
    const s = sessionStorage.getItem(PENDING_KEY);
    if (!s) return null;
    const parsed = JSON.parse(s);
    return isGameResult(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export default function GameOverPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const { user, loading: authLoading } = useAuth();

  // location.state 우선, 없으면 sessionStorage 백업 (로그인 라운드트립 후 복귀 케이스).
  // 마운트 시 한 번만 확정 — 저장 성공 후 PENDING_KEY 가 지워져도 화면이 빈 상태로
  // 뒤집히지 않도록 state 로 고정한다.
  const [result] = useState<GameResult | null>(() =>
    isGameResult(loc.state) ? loc.state : readPendingResult()
  );

  const [saving, setSaving] = useState(false);
  const [saveRes, setSaveRes] = useState<ScoreSaveResponse | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const savedOnce = useRef(false);

  // location.state 로 들어왔으면 sessionStorage 에도 백업 (OAuth 라운드트립 대비)
  useEffect(() => {
    if (isGameResult(loc.state)) {
      try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(loc.state)); } catch {}
    }
  }, [loc.state]);

  useEffect(() => {
    if (!result) return;
    if (result.is_practice) return;   // 연습 리그는 점수 저장 X
    if (authLoading) return;          // 인증 로드 대기
    if (!user) return;                // 비로그인은 저장 X (프롬프트 표시)
    if (savedOnce.current) return;    // StrictMode 이중 호출 방지
    savedOnce.current = true;
    setSaving(true);
    api
      .saveScore(result)
      .then((res) => {
        setSaveRes(res);
        try { sessionStorage.removeItem(PENDING_KEY); } catch {}
      })
      .catch((e) => setSaveErr(String(e)))
      .finally(() => setSaving(false));
  }, [result, user, authLoading]);

  const goLogin = () => {
    if (result) {
      try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(result)); } catch {}
    }
    nav('/login', { state: { from: '/game-over' } });
  };

  if (!result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4">
        <h2 className="text-2xl font-bold">{t('gameover.noResultTitle')}</h2>
        <p className="text-white/50 text-sm">{t('gameover.noResultDesc')}</p>
        <button className="btn-primary" onClick={() => nav('/league')}>
          {t('gameover.toChooseLeague')}
        </button>
      </div>
    );
  }

  const accuracyPct = Math.round(result.accuracy * 100);
  const isNewBest = saveRes?.is_new_best;
  const isPractice = result.is_practice ?? false;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <motion.h2
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-impact text-3xl md:text-4xl tracking-wide text-white/55 mb-2"
      >
        GAME OVER
      </motion.h2>

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
        className="font-impact text-7xl md:text-9xl text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.45)]"
      >
        {result.score.toLocaleString()}
      </motion.div>
      <div className="text-white/40 text-sm mt-1 mb-6">SCORE</div>

      {/* 저장 상태 / 순위 / 로그인 유도 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="min-h-[3rem] flex flex-col items-center gap-3 mb-8"
      >
        {/* 연습 리그: 랭킹/저장 없이 격려 메시지만 */}
        {isPractice && (
          <div className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-sm text-center">
            🌱 {t('gameover.practiceNotice')}
          </div>
        )}

        {/* 랭킹 리그 · 비로그인: 로그인 유도 카드 */}
        {!isPractice && !authLoading && !user && (
          <div className="card text-center max-w-md">
            <div className="text-sm text-white/80 mb-3">
              {t('gameover.loginPromptLine1')}<br />
              {t('gameover.loginPromptLine2')} 🏆
            </div>
            <button className="btn-primary w-full" onClick={goLogin}>
              {t('gameover.loginAndRegister')}
            </button>
            <div className="text-[10px] text-white/40 mt-2">
              {t('gameover.autoSaveHint')}
            </div>
          </div>
        )}

        {/* 랭킹 리그 · 로그인 사용자: 저장 상태 표시 */}
        {!isPractice && user && (
          <div className="flex items-center gap-3">
            {saving && <span className="text-white/50 text-sm">{t('gameover.saving')}</span>}
            {saveErr && <span className="text-red-400 text-sm">{t('gameover.saveFailed', { err: saveErr })}</span>}
            {saveRes && (
              <>
                {isNewBest && (
                  <motion.span
                    initial={{ scale: 0.5, rotate: -8 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="px-3 py-1 rounded-full bg-yellow-400 text-black font-bold text-sm"
                  >
                    🏆 NEW BEST
                  </motion.span>
                )}
                <span className="text-white/70">
                  {t('gameover.seasonRank')} <span className="font-bold text-white">#{saveRes.rank_no}</span>
                </span>
              </>
            )}
          </div>
        )}
      </motion.div>

      {/* 스탯 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl mb-10"
      >
        <Stat label={t('gameover.accuracy')} value={`${accuracyPct}%`} />
        <Stat label="WPM" value={result.wpm} />
        <Stat label={t('gameover.maxCombo')} value={result.max_combo} />
        <Stat label={t('gameover.correctMissed')} value={`${result.correct_count} / ${result.miss_count}`} />
      </motion.div>

      {/* 배너 — 종료화면(전환 최적 위치). 등록된 배너 없으면 렌더 안 됨 */}
      <div className="w-full max-w-2xl mb-8 flex justify-center">
        <BannerSlot slot="gameover" />
      </div>

      {/* 액션 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex flex-wrap items-center justify-center gap-3"
      >
        <button
          className="btn-primary"
          onClick={() => nav(`/game/${result.category_seq}`, { replace: true })}
        >
          🔁 {t('gameover.tryAgain')}
        </button>
        {!isPractice && (
          <button
            className="btn-ghost"
            onClick={() => nav(`/rankings/${result.category_seq}`)}
          >
            🏆 {t('gameover.viewRankings')}
          </button>
        )}
        <button className="btn-ghost" onClick={() => nav('/league')}>
          {t('gameover.chooseLeague')}
        </button>
        <button className="btn-ghost" onClick={() => nav('/')}>
          {t('gameover.home')}
        </button>
      </motion.div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card text-center py-4">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-white/50 mt-1">{label}</div>
    </div>
  );
}
