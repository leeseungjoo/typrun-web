import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import BannerSlot from '../components/BannerSlot';
import RecordDelta from '../components/RecordDelta';
import DailyEntry from '../components/daily/DailyEntry';
import HeistPose from '../components/heist/HeistPose';
import '../components/heist/heistMenu.css';
import { SITE_THEME } from '../lib/theme';
import { sound } from '../lib/sound';
import { heistSfx } from '../lib/heistSfx';
import { readLastCast } from '../components/game/heist/heistCast';
import { SOCIAL_PROVIDERS, startSocialLogin, type SocialProvider } from '../lib/socialLogin';
import { track } from '../lib/track';
import { recordKey, recordPlay } from '../lib/myRecords';
import type { RankPreview, ScoreSaveResponse } from '../api/types';

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
  client_hash?: string; // 판 키 — 같은 판을 다시 보내도 서버가 한 번만 저장한다(옛 결과에는 없음)
  round_sec?: number;   // 이 판의 길이(초) — '내 기록'이 길이가 다른 판끼리 견주지 않게(옛 결과에는 없음)
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

  // 내 기록(이 브라우저) — 지난 판 대비·내 최고. 가입하지 않아도 보인다. 같은 판은 다시 열어도 한 번만 반영된다.
  // 판 길이를 모르는 옛 결과(배포 전에 로그인하러 갔다 온 판)는 반영하지 않는다 — 길이가 다른 판으로 보여 기록이 새로 시작된다
  const [record] = useState(() =>
    result && result.round_sec
      ? recordPlay(recordKey(result.category_seq), {
          score: result.score,
          wpm: result.wpm,
          accuracy: result.accuracy,
          roundSec: result.round_sec,
          key: result.client_hash ?? null,
          at: new Date().toISOString(),
        })
      : null,
  );

  const [saving, setSaving] = useState(false);
  const [saveRes, setSaveRes] = useState<ScoreSaveResponse | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const savedOnce = useRef(false);
  // 비회원 CTA — "지금 로그인하면 N위". 실패해도 CTA 는 일반 문구로 뜬다(전환 흐름을 막지 않음).
  const [preview, setPreview] = useState<RankPreview | null>(null);

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

  useEffect(() => {
    if (!result || result.is_practice || authLoading || user) return;
    let alive = true;
    api
      .rankPreview(result.category_seq, result.score)
      .then((r) => { if (alive) setPreview(r); })
      .catch(() => { /* 미리보기 실패는 무해 — 일반 문구로 폴백 */ });
    return () => { alive = false; };
  }, [result, user, authLoading]);

  // 결과를 sessionStorage 에 남겨 두면 로그인 라운드트립 후 /game-over 복귀 시 자동 저장된다(위 useEffect).
  const persistResult = () => {
    if (result) {
      try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(result)); } catch {}
    }
  };

  const goLogin = () => {
    persistResult();
    track('cta_login', 'email|gameover');
    nav('/login', { state: { from: '/game-over' } });
  };

  // 소셜 원클릭 — 로그인 화면을 거치지 않고 바로 OAuth 로. 콜백은 /login → from(/game-over) 복귀.
  const goSocial = (provider: SocialProvider) => {
    persistResult();
    startSocialLogin(provider, '/game-over', 'gameover');
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
  const isHeist = SITE_THEME === 'heist';
  // 비회원 로그인 유도 판 — 있으면 넓은 화면에서 결과(왼쪽)·로그인(오른쪽) 두 칸으로 나눈다
  const hasGuestCta = !isPractice && !authLoading && !user;
  const pose = isNewBest ? 'cheer' : 'caught';

  // 한 화면에 다 들어오게(스크롤 없이) 배열한다(2026-11-17 사장): 점수·스탯을 한 묶음으로 줄이고,
  // 세로로 길던 로그인 판은 넓은 화면에선 옆 칸으로, 폰에선 소셜 버튼 3개를 한 줄로 눕힌다.
  // 도둑 런: 배경이 달리는 장면(HeistBackdrop 의 run)이라 결과는 위쪽 하늘에, 버튼은 맨 아래 바닥 띠에 두고
  // 그 사이를 비워 쫓기는 도둑이 보이게 한다(다른 테마는 예전처럼 가운데 정렬).
  return (
    <div
      className={`min-h-[100dvh] flex flex-col items-center px-4 gap-4 ${
        isHeist ? 'pt-[clamp(16px,4.5dvh,56px)] pb-[clamp(12px,2.5dvh,28px)]' : 'justify-center py-5 md:gap-6'
      }`}
    >
      <div className={`w-full grid items-center gap-4 md:gap-8 ${hasGuestCta ? 'max-w-4xl md:grid-cols-2' : 'max-w-xl'}`}>
        {/* 결과: 포즈 → GAME OVER → 점수 → (저장 상태) → 스탯 4칸 */}
        <section className="flex flex-col items-center min-w-0">
          {/* 포즈 그림은 세로가 넉넉할 때만 — 낮은 화면에서는 뒤에서 달리는 도둑을 가리지 않게 뺀다 */}
          {/* 도둑 포즈라 도둑으로 한 판에만 보여 준다(학생·병아리·신부로 한 판은 뒤의 달리는 장면이 그 캐릭터다) */}
          {isHeist && readLastCast() === 'thief' && (
            <HeistPose key={pose} pose={pose} className="h-24 md:h-28 [@media(max-height:860px)]:hidden" />
          )}
          <motion.h2
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-impact text-2xl md:text-3xl tracking-wide text-white/65 mt-2"
          >
            GAME OVER
          </motion.h2>

          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
            className="font-impact text-6xl md:text-7xl leading-none text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.45)]"
          >
            {result.score.toLocaleString()}
          </motion.div>
          <div className="text-white/50 text-xs mt-1">SCORE</div>
          <RecordDelta summary={record} className="mt-2" />

          {/* 연습 리그: 랭킹/저장 없이 격려 메시지만 */}
          {isPractice && (
            <div className="mt-3 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-sm text-center [word-break:keep-all]">
              🌱 {t('gameover.practiceNotice')}
            </div>
          )}

          {/* 랭킹 리그 · 로그인 사용자: 저장 상태 표시 */}
          {!isPractice && user && (
            <div className="mt-3 min-h-[1.75rem] flex flex-wrap items-center justify-center gap-3" role="status">
              {saving && <span className="text-white/60 text-sm">{t('gameover.saving')}</span>}
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
                  <span className="text-white/75">
                    {t('gameover.seasonRank')} <span className="font-bold text-white">#{saveRes.rank_no}</span>
                  </span>
                </>
              )}
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-4 w-full max-w-md grid grid-cols-2 min-[360px]:grid-cols-4 gap-2"
          >
            <Stat label={t('gameover.accuracy')} value={`${accuracyPct}%`} />
            <Stat label="WPM" value={result.wpm} />
            <Stat label={t('gameover.maxCombo')} value={result.max_combo} />
            <Stat label={t('gameover.correctMissed')} value={`${result.correct_count} / ${result.miss_count}`} />
          </motion.div>
        </section>

        {/* 랭킹 리그 · 비로그인: "지금 로그인하면 N위" + 소셜 원클릭 (게스트→회원 전환 CTA) */}
        {hasGuestCta && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="hm-panel p-4 md:p-6 text-center w-full max-w-md mx-auto"
          >
            {preview ? (
              <div className="text-sm text-white/90 flex items-baseline justify-center gap-1.5 flex-wrap">
                <span>{t('gameover.loginRankBefore')}</span>
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                  className="font-impact text-3xl text-yellow-300 drop-shadow-[0_2px_0_rgba(0,0,0,0.4)]"
                >
                  #{preview.rank_no}
                </motion.span>
                <span>{t('gameover.loginRankAfter')} 🏆</span>
              </div>
            ) : (
              <div className="text-sm text-white/85">
                {t('gameover.loginPromptLine2')} 🏆
              </div>
            )}
            {preview && preview.ranked_count > 0 && (
              <div className="text-[11px] text-white/55 mt-0.5">{t('gameover.rankedCount', { count: preview.ranked_count })}</div>
            )}
            {/* 폰: 3개를 한 줄(이름만) · 넓은 화면: 세로로 "…로 계속하기" */}
            <div className="grid grid-cols-3 md:grid-cols-1 gap-2 mt-3">
              {SOCIAL_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => goSocial(p.id)}
                  aria-label={t('auth.continueWith', { provider: p.name })}
                  className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 md:gap-2 transition active:scale-[0.98] ${p.cls}`}
                >
                  <span className="text-base" aria-hidden>{p.icon}</span>
                  <span className="md:hidden" aria-hidden>{p.name}</span>
                  <span className="hidden md:inline" aria-hidden>{t('auth.continueWith', { provider: p.name })}</span>
                </button>
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <button type="button" className="text-xs text-white/70 underline underline-offset-2 hover:text-white" onClick={goLogin}>
                {t('gameover.loginWithEmail')}
              </button>
              <span className="text-[11px] text-white/50">{t('gameover.autoSaveHint')}</span>
            </div>
          </motion.section>
        )}
      </div>

      {/* 오늘의 도전 — 한 판 하고 나가는 사람에게 내일도 올 이유를 하나 더 보여 준다 */}
      <DailyEntry onOpen={() => nav('/daily')} />

      {/* 배너 — 종료화면(전환 최적 위치). 등록된 배너 없으면 렌더 안 됨 */}
      <BannerSlot slot="gameover" />

      {/* 달리는 도둑이 보이는 자리 — 남는 세로 공간을 여기에 몰아 준다 */}
      {isHeist && <div className="flex-1 min-h-0" aria-hidden />}

      {/* 액션 — 폰: 다시 도전(한 줄 전체) + 나머지 한 줄 · 넓은 화면: 한 줄 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        className={`w-full max-w-md md:max-w-none grid gap-2 md:flex md:flex-wrap md:items-center md:justify-center md:gap-3 ${isPractice ? 'grid-cols-2' : 'grid-cols-3'}`}
      >
        <button
          className={isHeist ? 'hm-btn hm-btn--go col-span-full !min-h-[52px] md:px-8' : 'btn-primary col-span-full'}
          onClick={() => {
            sound.play('click');
            heistSfx.unlock();
            nav(`/game/${result.category_seq}`, { replace: true });
          }}
        >
          🔁 {t('gameover.tryAgain')}
        </button>
        {!isPractice && (
          <button className={SUB_ACTION_CLS} onClick={() => nav(`/rankings/${result.category_seq}`)}>
            🏆 {t('gameover.viewRankings')}
          </button>
        )}
        <button className={SUB_ACTION_CLS} onClick={() => nav('/league')}>
          {t('gameover.chooseLeague')}
        </button>
        <button className={SUB_ACTION_CLS} onClick={() => nav('/')}>
          {t('gameover.home')}
        </button>
      </motion.div>
    </div>
  );
}

// 보조 버튼(랭킹 보기·리그 선택·홈) — 폰에서는 한 줄에 셋이 들어가게 작게, 그림 배경 위에서도 읽히게 어두운 바탕
const SUB_ACTION_CLS =
  'btn-ghost !px-2 !py-2.5 text-sm md:!px-6 md:!py-3 md:text-base bg-[rgba(11,16,38,0.62)] [word-break:keep-all]';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-[rgba(11,16,38,0.86)] border border-white/10 px-1 py-2.5 text-center">
      <div className="text-base min-[400px]:text-lg md:text-xl font-bold tabular-nums leading-tight whitespace-nowrap">{value}</div>
      <div className="text-[11px] text-white/60 mt-0.5 leading-tight [word-break:keep-all]">{label}</div>
    </div>
  );
}
