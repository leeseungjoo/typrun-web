import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { dailyApi, type DailyInfo } from '../api/daily';
import { useAuth } from '../contexts/AuthContext';
import DailyBoard from '../components/daily/DailyBoard';
import { PlayIcon } from '../components/heist/HeistIcons';
import '../components/heist/heistMenu.css';
import { liveStreak, playedToday, readStreak } from '../lib/dailyStreak';
import type { DailyGameCtx } from '../lib/dailyCtx';
import { sound } from '../lib/sound';
import { heistSfx } from '../lib/heistSfx';

const BOARD_ROWS = 10;
const SECOND_MS = 1000;
// 자정이 지났다고 보고 새 도전을 다시 받을 때의 최소 간격 — 기기 시계가 서버보다 빠르면
// 서버는 아직 어제 도전을 주므로, 간격을 두지 않으면 응답이 올 때마다 끝없이 다시 받는다.
const REFETCH_MIN_MS = 15_000;

/** 남은 시간을 03:12:45 꼴로. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / SECOND_MS));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** 서버 날짜(YYYY-MM-DD)를 '11월 27일' / '11/27' 로. */
export function useDailyDateLabel(date: string | undefined): string {
  const { t } = useTranslation();
  if (!date) return '';
  const [, month, day] = date.split('-').map(Number);
  return t('daily.dateFormat', { month, day });
}

// 오늘의 도전 시작 화면 — 하루 한 리그, 모두 같은 단어 순서로 치는 60초 한 판(2026-11-27).
// 가입 없이 바로 친다. 그날 순위는 한국 자정에 새로 시작하고, 리그는 날마다 바뀐다(서버 lib/daily.ts).
export default function DailyPage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [info, setInfo] = useState<DailyInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [streakState] = useState(() => readStreak());

  // 로그인 확인이 끝난 뒤에 조회한다 — 회원이면 회원 기록으로 내 순위가 잡히게
  useEffect(() => {
    if (authLoading) return;
    let alive = true;
    setErr(null);
    dailyApi
      .info(BOARD_ROWS)
      .then((d) => { if (alive) setInfo(d); })
      .catch((e: unknown) => { if (alive) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [authLoading, user?.seq, reloadKey]);

  // 남은 시간 표시 — 자정이 지나면 새 도전을 다시 받는다
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), SECOND_MS);
    return () => window.clearInterval(id);
  }, []);
  const resetAtMs = info ? Date.parse(info.resets_at) : 0;
  const lastRefetchAtRef = useRef(0);
  useEffect(() => {
    if (!info || now < resetAtMs || now - lastRefetchAtRef.current < REFETCH_MIN_MS) return;
    lastRefetchAtRef.current = now;
    setReloadKey((k) => k + 1); // 화면은 그대로 두고 새 도전이 오면 바꾼다
  }, [info, now, resetAtMs]);

  useEffect(() => {
    sound.preload(['click']);
  }, []);

  const dateLabel = useDailyDateLabel(info?.date);

  const start = () => {
    if (!info) return;
    sound.play('click');
    heistSfx.unlock(); // 게임 효과음이 첫 단어부터 나게, 누르는 순간 소리 장치를 깨운다
    const daily: DailyGameCtx = {
      date: info.date,
      categorySeq: info.category_seq,
      seed: info.seed,
      durationSec: info.duration_sec,
    };
    nav(`/game/${info.category_seq}`, { state: { daily } });
  };

  const streak = info ? liveStreak(streakState, info.date) : 0;
  const hasPlayedToday = info ? playedToday(streakState, info.date) || !!info.me : false;
  const streakLabel =
    streak > 0 ? (hasPlayedToday ? t('daily.streak', { count: streak }) : t('daily.streakKeep', { count: streak + 1 })) : null;

  return (
    <div className="min-h-screen px-5 pt-16 pb-8 max-w-2xl mx-auto">
      <button
        onClick={() => nav('/')}
        className="text-sm text-white/60 hover:text-white mb-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        {t('daily.backHome')}
      </button>

      {!info && !err && <p className="text-center text-white/60">{t('daily.loading')}</p>}
      {err && (
        <div className="hm-panel p-6 text-center">
          <p className="text-red-300 [word-break:keep-all]">{t('daily.loadFailed', { msg: err })}</p>
          <button type="button" className="btn-ghost mt-4" onClick={() => setReloadKey((k) => k + 1)}>
            {t('daily.retry')}
          </button>
        </div>
      )}

      {info && (
        <>
          <section className="hm-daily-ticket">
            <p className="hm-daily-kicker">{t('daily.kicker', { date: dateLabel })}</p>
            <h2 className="hm-daily-league">{info.category_name}</h2>
            <p className="hm-daily-rule">{t('daily.rule', { sec: info.duration_sec })}</p>
            <ul className="hm-daily-facts">
              <li>{info.players > 0 ? t('daily.players', { count: info.players }) : t('daily.noPlayers')}</li>
              {info.me && <li className="is-accent">{t('daily.myRank', { rank: info.me.rank })}</li>}
              {streakLabel && <li className="is-accent">{streakLabel}</li>}
            </ul>
          </section>

          <button type="button" className="hm-btn hm-btn--go hm-btn--tall w-full mt-4" onClick={start}>
            <PlayIcon />
            <span className="hm-btn-text">
              {info.me ? t('daily.again') : t('daily.start')}
              <small>
                {info.me
                  ? t('daily.againSub', { best: info.me.score.toLocaleString() })
                  : t('daily.startSub', { sec: info.duration_sec })}
              </small>
            </span>
          </button>

          <section className="hm-panel p-4 sm:p-5 mt-6" aria-labelledby="daily-board-title">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h3 id="daily-board-title" className="text-base font-extrabold">{t('daily.boardTitle')}</h3>
              <span className="text-xs text-white/60 tabular-nums">
                {t('daily.resetIn', { time: formatCountdown(resetAtMs - now) })}
              </span>
            </div>
            <DailyBoard rows={info.rows} me={info.me} />
          </section>

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
        </>
      )}
    </div>
  );
}
