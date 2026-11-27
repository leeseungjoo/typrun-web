import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { dailyApi, type DailyInfo, type DailySubmitResult } from '../api/daily';
import { useAuth } from '../contexts/AuthContext';
import DailyBoard from '../components/daily/DailyBoard';
import RecordDelta from '../components/RecordDelta';
import '../components/heist/heistMenu.css';
import { isDailyResult, type DailyGameCtx, type DailyGameResult } from '../lib/dailyCtx';
import { markPlayedToday } from '../lib/dailyStreak';
import { recordKey, recordPlay } from '../lib/myRecords';
import { sound } from '../lib/sound';
import { heistSfx } from '../lib/heistSfx';
import { useDailyDateLabel } from './DailyPage';

const BOARD_ROWS = 10;
const SHARE_DONE_MS = 2000;

/** 공유 문구에 넣을 오늘의 도전 주소 — 지금 언어 경로(/kr)를 유지한다. */
function dailyUrl(): string {
  const localeRoot = window.location.pathname.startsWith('/kr') ? '/kr' : '';
  return `${window.location.origin}${localeRoot}/daily`;
}

// 오늘의 도전 결과 — 기록을 그날 순위표에 올리고 순위·연속 일수·지난 판 대비를 보여 준다.
// ⚠ 월간 랭킹 저장(score_save)·typrun_pending_result·게임오버 로그인 CTA 를 타지 않는다(일반 결과 화면과 별개).
export default function DailyResultPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const stateResult = (loc.state as { result?: unknown } | null)?.result;
  const [result] = useState<DailyGameResult | null>(() => (isDailyResult(stateResult) ? stateResult : null));
  // 연속 기록·내 기록은 이 브라우저에만 남긴다 — 같은 날·같은 판은 다시 열어도 한 번만 반영된다
  const [streak] = useState(() => (result ? markPlayedToday(result.date) : null));
  const [record] = useState(() =>
    result
      ? recordPlay(recordKey(result.category_seq, 'daily'), {
          score: result.score,
          wpm: result.wpm,
          accuracy: result.accuracy,
          roundSec: result.duration_sec,
          key: result.client_hash,
          at: new Date().toISOString(),
        })
      : null,
  );

  const [saved, setSaved] = useState<DailySubmitResult | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [info, setInfo] = useState<DailyInfo | null>(null);
  const [isShared, setIsShared] = useState(false);
  const submittedAttempt = useRef(-1);

  // 로그인 확인이 끝난 뒤에 올린다 — 회원이면 닉네임으로 올라가게. 같은 판은 서버가 한 번만 받는다(client_hash).
  useEffect(() => {
    if (!result || authLoading) return;
    if (submittedAttempt.current === attempt) return; // StrictMode 이중 실행 방지
    submittedAttempt.current = attempt;
    setSaveErr(null);
    // 정리 함수로 응답을 버리지 않는다 — 개발 모드(StrictMode)의 이중 실행에서 첫 요청의 응답이 곧 결과다
    dailyApi
      .submit(result)
      .then((res) => {
        setSaved(res);
        // 순위표는 없어도 결과 화면은 선다 — 조회 실패를 '기록을 못 올렸다'로 보여 주지 않는다
        dailyApi.info(BOARD_ROWS).then(setInfo).catch(() => undefined);
      })
      .catch((e: unknown) => setSaveErr(e instanceof Error ? e.message : String(e)));
  }, [result, authLoading, attempt]);

  useEffect(() => {
    sound.preload(['click']);
  }, []);

  const dateLabel = useDailyDateLabel(result?.date);

  if (!result) return <Navigate to="/daily" replace />;

  const accuracyPct = Math.round(result.accuracy * 100);
  // 순위표가 오늘 것일 때만 보여 준다(자정을 넘겨 결과를 열면 서버는 새 날짜의 순위표를 준다)
  const board = info && info.date === result.date && info.category_seq === result.category_seq ? info : null;

  const playAgain = () => {
    sound.play('click');
    heistSfx.unlock();
    if (!board) {
      nav('/daily', { replace: true });
      return;
    }
    const daily: DailyGameCtx = {
      date: board.date,
      categorySeq: board.category_seq,
      seed: board.seed,
      durationSec: board.duration_sec,
    };
    nav(`/game/${board.category_seq}`, { replace: true, state: { daily } });
  };

  const share = async () => {
    if (!saved) return;
    const text = t('daily.shareText', {
      date: dateLabel,
      league: result.category_name,
      score: result.score.toLocaleString(),
      players: saved.players,
      rank: saved.rank,
      streak: streak && streak.streak > 1 ? t('daily.shareStreak', { count: streak.streak }) : '',
      url: dailyUrl(),
    });
    try {
      await navigator.clipboard.writeText(text);
      setIsShared(true);
      window.setTimeout(() => setIsShared(false), SHARE_DONE_MS);
    } catch {
      /* 클립보드를 못 쓰는 브라우저 — 버튼만 반응이 없다 */
    }
  };

  return (
    <div className="min-h-screen px-5 pt-16 pb-8 max-w-2xl mx-auto flex flex-col items-center">
      <p className="hm-daily-kicker">
        {t('daily.kicker', { date: dateLabel })} · {result.category_name}
      </p>
      <div className="font-impact text-6xl md:text-7xl leading-none text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.45)] mt-2">
        {result.score.toLocaleString()}
      </div>
      <div className="text-white/50 text-xs mt-1">SCORE</div>

      {/* 순위 — 제출이 끝나면 '오늘 37명 중 5등' */}
      <div className="mt-4 min-h-[3.5rem] flex flex-col items-center justify-center text-center" role="status">
        {!saved && !saveErr && <span className="text-white/70 text-sm">{t('daily.submitting')}</span>}
        {saveErr && (
          <>
            <span className="text-red-300 text-sm [word-break:keep-all]">{t('daily.submitFailed', { msg: saveErr })}</span>
            <button type="button" className="btn-ghost text-sm mt-2" onClick={() => setAttempt((n) => n + 1)}>
              {t('daily.retry')}
            </button>
          </>
        )}
        {saved && (
          <>
            <span className="text-sm text-white/75">{t('daily.rankLine', { players: saved.players })}</span>
            <span className="font-impact text-4xl text-[var(--hm-amber)] leading-tight drop-shadow-[0_2px_0_rgba(0,0,0,0.4)]">
              {t('daily.rankValue', { rank: saved.rank })}
            </span>
          </>
        )}
      </div>

      <ul className="hm-daily-facts justify-center mt-2">
        {saved?.is_new_best && <li className="is-accent">{t('daily.newBest')}</li>}
        {saved?.is_first && <li>{t('daily.firstToday')}</li>}
        {streak && streak.streak > 1 && <li className="is-accent">{t('daily.streak', { count: streak.streak })}</li>}
      </ul>
      <RecordDelta summary={record} className="mt-3" />

      <div className="mt-4 w-full max-w-md grid grid-cols-2 min-[360px]:grid-cols-4 gap-2">
        <Stat label={t('gameover.accuracy')} value={`${accuracyPct}%`} />
        <Stat label="WPM" value={result.wpm} />
        <Stat label={t('gameover.maxCombo')} value={result.max_combo} />
        <Stat label={t('gameover.correctMissed')} value={`${result.correct_count} / ${result.miss_count}`} />
      </div>

      <div className="w-full grid grid-cols-2 gap-3 mt-6">
        <button type="button" className="hm-btn hm-btn--go" onClick={playAgain}>
          {t('daily.again')}
        </button>
        <button type="button" className="hm-btn hm-btn--rank" onClick={share} disabled={!saved}>
          {isShared ? t('daily.shareDone') : t('daily.share')}
        </button>
      </div>

      {board && (
        <section className="hm-panel p-4 sm:p-5 mt-6 w-full" aria-labelledby="daily-result-board">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h3 id="daily-result-board" className="text-base font-extrabold">{t('daily.boardTitle')}</h3>
            <span className="text-xs text-white/60">{t('daily.tomorrow')}</span>
          </div>
          <DailyBoard rows={board.rows} me={board.me} />
        </section>
      )}

      {!authLoading && !user && (
        <p className="text-center text-xs text-white/70 mt-4 [word-break:keep-all]">
          {t('daily.loginHint')}{' '}
          <button
            type="button"
            className="underline underline-offset-2 font-bold hover:text-white"
            onClick={() => nav('/login', { state: { from: '/daily' } })}
          >
            {t('daily.loginLink')}
          </button>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
        <button type="button" className="btn-ghost text-sm bg-[rgba(11,16,38,0.62)]" onClick={() => nav(`/league/${result.category_seq}`)}>
          {t('daily.playLeague')}
        </button>
        <button type="button" className="btn-ghost text-sm bg-[rgba(11,16,38,0.62)]" onClick={() => nav('/')}>
          {t('daily.home')}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-[rgba(11,16,38,0.86)] border border-white/10 px-1 py-2.5 text-center">
      <div className="text-base min-[400px]:text-lg md:text-xl font-bold tabular-nums leading-tight whitespace-nowrap">{value}</div>
      <div className="text-[11px] text-white/60 mt-0.5 leading-tight [word-break:keep-all]">{label}</div>
    </div>
  );
}
