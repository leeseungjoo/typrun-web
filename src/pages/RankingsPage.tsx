import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import { pickProfileImage } from '../api/auth';
import ContactModal from '../components/ContactModal';
import { PlayIcon } from '../components/heist/HeistIcons';
import '../components/heist/heistMenu.css';
import { ENTER_STAGGER_S, useEnterMotion } from '../lib/enterMotion';
import { SITE_THEME } from '../lib/theme';
import type { Category, RankingEntry, BattleRankEntry } from '../api/types';

function relativeTime(input: string, t: TFunction): string {
  if (!input) return '';
  const ts = Date.parse(input);
  if (Number.isNaN(ts)) return input;
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return t('rankings.justNow');
  const min = Math.floor(sec / 60);
  if (min < 60) return t('rankings.minutesAgo', { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('rankings.hoursAgo', { n: hr });
  const day = Math.floor(hr / 24);
  if (day < 7) return t('rankings.daysAgo', { n: day });
  return new Date(ts).toLocaleDateString();
}

type View = 'score' | 'battle';

/** 집계 기간 — seq 는 어느 리그의 기간인지(리그를 넘기는 동안 옛 리그 날짜를 새 이름 밑에 보이지 않게) */
interface ScoreMeta {
  seq: number;
  mode: 'event' | 'season';
  start: string | null;
  end: string | null;
}

/** 응답이 금방 오면 '불러오는 중' 글자가 깜빡이지 않게 이만큼 기다렸다 보인다 */
const LOADING_NOTE_DELAY_S = 0.4;

/*
 * 등장 순서(lib/enterMotion 계약: 알파 0 + 아래에서 + expo 1.4~1.6초 + 0.2초 간격)
 *   점수 탭 첫 진입: 리그 페이저 → 1등 → 2등 → 3등 → 4등~ 목록 → 하단 버튼
 *   리그 넘김·새로고침: 옛 리그 글은 즉시 감추고(자리는 유지) 새 랭킹이 오면 1등부터 다시 등장. 틀(페이저·버튼)은 그대로
 */
export default function RankingsPage() {
  const { t } = useTranslation();
  const { categorySeq } = useParams();
  const nav = useNavigate();

  const [view, setView] = useState<View>('score');

  // 운영중(active/ended) 랭킹 리그 목록 — 페이징 대상
  const [leagues, setLeagues] = useState<Category[]>([]);
  // 리그 목록을 받았는지 — 받기 전엔 '운영 중인 랭킹 리그가 없어요'·하단 버튼을 띄우지 않는다(받기 전 깜빡 노출 방지)
  const [leaguesReady, setLeaguesReady] = useState(false);
  const [idx, setIdx] = useState(0);

  const [rows, setRows] = useState<RankingEntry[]>([]);
  const [scoreMeta, setScoreMeta] = useState<ScoreMeta | null>(null);
  const [scoreLoad, setScoreLoad] = useState(true);
  const [scoreErr, setScoreErr] = useState<string | null>(null);
  // 랭킹을 새로 받을 때마다 +1 — 1~3등·목록이 이 값을 key 로 다시 등장한다(0 = 아직 한 번도 못 받음)
  const [scoreVersion, setScoreVersion] = useState(0);
  const scoreReq = useRef(0);

  const [detail, setDetail] = useState<RankingEntry | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const current = leagues[idx];

  // 1) 리그 목록 로드 + 진입 카테고리로 시작 인덱스 결정. 목록이 없을 때(실패·0개)만 새로고침(reloadKey)으로 다시 받는다
  useEffect(() => {
    if (leagues.length > 0) return;
    setLeaguesReady(false);
    setScoreErr(null);
    api.categories()
      .then((cats) => {
        const running = cats.filter(
          (c) => c.is_ranking_league === 'Y' && (c.status === 'active' || c.status === 'ended'),
        );
        const start = running.findIndex((c) => String(c.seq) === String(categorySeq));
        setLeagues(running);
        setIdx(start >= 0 ? start : 0);
        setLeaguesReady(true);
      })
      .catch((e) => {
        setScoreErr(e instanceof Error ? e.message : String(e));
        setLeaguesReady(true);
      });
    // categorySeq 는 최초 진입에만 사용 — 이후 페이징은 내부 idx 로 제어
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  // 2) 현재 리그 점수 랭킹 로드
  const loadScore = useCallback(() => {
    if (!current) {
      // 운영 중 랭킹 리그가 0개 — 로딩을 종료해 하단 버튼(리그선택/문의)이 정상 노출되게
      setScoreLoad(false);
      return;
    }
    const req = ++scoreReq.current;
    setScoreLoad(true);
    setScoreErr(null);
    const seq = current.seq;
    api.rankings(seq, 50)
      .then((d) => {
        // 리그를 빨리 넘기면 늦게 도착한 옛 리그 응답은 버린다
        if (req !== scoreReq.current) return;
        // 새 랭킹·기간·로딩 끝을 한 번에 — 사이에 그려지면 새 글이 감춰진 채 등장 모션을 다 써 버린다
        setRows(d.rankings);
        setScoreMeta({ seq, mode: d.mode, start: d.window_start, end: d.window_end });
        setScoreVersion((v) => v + 1);
        setScoreLoad(false);
      })
      .catch((e) => {
        if (req !== scoreReq.current) return;
        setScoreErr(e instanceof Error ? e.message : String(e));
        setScoreLoad(false);
      });
  }, [current]);

  useEffect(() => {
    loadScore();
    // URL 동기화 (뒤로가기/공유용)
    if (current) nav(`/rankings/${current.seq}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadScore, reloadKey]);

  const canPrev = idx > 0;
  const canNext = idx < leagues.length - 1;
  const goPrev = () => setIdx((i) => Math.max(0, i - 1));
  const goNext = () => setIdx((i) => Math.min(leagues.length - 1, i + 1));

  // 하단 버튼 — 첫 랭킹이 온 뒤에 한 번 들어오고, 리그를 넘겨도 그 자리에 그대로 둔다(들썩임 방지)
  const showActions = leaguesReady && (!current || scoreVersion > 0 || !!scoreErr);
  const actionsEnter = useEnterMotion(4, ENTER_STAGGER_S);

  return (
    <div className="min-h-screen px-5 pt-16 pb-8 max-w-3xl mx-auto">
      {/* 헤더 — 홈은 공용 상단바(우상단)에 있으므로 제목만 */}
      <h2 className="text-2xl font-bold tracking-tight text-center mb-4">🏆 {t('rankings.title')}</h2>

      {/* 뷰 탭(점수/배틀) + 홈·새로고침 + 게임 시작 — 랭킹이 길면 맨 아래 버튼이 안 보여 맨 위 줄로 올렸다(2026-11-18 사장).
          폰은 게임 시작이 다음 줄 전체 폭 */}
      <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
        <div className="flex flex-1 max-w-xs rounded-full border border-white/15 bg-white/5 p-1">
          <RankTab active={view === 'score'} onClick={() => setView('score')} label={`🏅 ${t('rankings.tabScore')}`} />
          <RankTab active={view === 'battle'} onClick={() => setView('battle')} label={`⚔️ ${t('rankings.tabBattle')}`} />
        </div>
        <button
          onClick={() => nav('/')}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition"
          title={t('rankings.home')}
          aria-label={t('rankings.goHome')}
        >
          🏠
        </button>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition text-lg"
          title={t('rankings.refresh')}
          aria-label={t('rankings.refresh')}
        >
          ↻
        </button>
        {/* 점수 탭 = 보고 있는 리그로 바로 시작(예전 '도전하기'), 배틀 탭 = 리그 선택(메인의 게임 시작과 같음) */}
        <StartButton
          className="w-full sm:w-auto"
          onClick={() => nav(view === 'score' && current ? `/game/${current.seq}` : '/league')}
        />
      </div>

      {view === 'score' ? (
        <>
          {!leaguesReady && <LoadingBlock />}

          {/* 리그 페이저 */}
          {current && (
            <LeaguePager
              current={current}
              position={idx + 1}
              total={leagues.length}
              meta={scoreMeta}
              canPrev={canPrev}
              canNext={canNext}
              onPrev={goPrev}
              onNext={goNext}
            />
          )}

          {current && (current.event_title || current.event_body) && (
            <EventBanner key={current.seq} title={current.event_title} body={current.event_body} />
          )}

          {leaguesReady && !current && (
            <Enter className="text-center py-16 text-white/50">
              {scoreErr ? (
                <>
                  <p className="text-red-400 mb-3">{t('rankings.errorPrefix', { msg: scoreErr })}</p>
                  <button className="btn-ghost text-sm" onClick={() => setReloadKey((k) => k + 1)}>
                    {t('rankings.retry')}
                  </button>
                </>
              ) : (
                t('rankings.noActiveLeague')
              )}
            </Enter>
          )}

          {current && (
            <ScoreRankings
              rows={rows}
              load={scoreLoad}
              err={scoreErr}
              version={scoreVersion}
              onRetry={() => setReloadKey((k) => k + 1)}
              onPlay={() => nav(`/game/${current.seq}`)}
              onSelect={setDetail}
            />
          )}

          {showActions && (
            <motion.div {...actionsEnter} className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <button className="btn-ghost" onClick={() => nav('/league')}>{t('rankings.selectLeague')}</button>
              <button className="btn-ghost" onClick={() => setShowContact(true)}>🤝 {t('rankings.inquiry')}</button>
            </motion.div>
          )}
        </>
      ) : (
        <BattleRankings onLeague={() => nav('/league')} reloadKey={reloadKey} />
      )}

      {/* 상세 모달 */}
      <AnimatePresence>
        {detail && <DetailModal entry={detail} onClose={() => setDetail(null)} />}
      </AnimatePresence>

      {/* 협업 문의 모달 */}
      <AnimatePresence>
        {showContact && <ContactModal onClose={() => setShowContact(false)} />}
      </AnimatePresence>
    </div>
  );
}

/* ============================ 뷰 탭 ============================ */

function RankTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 px-4 py-2 rounded-full text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
        active ? 'bg-white text-ink shadow' : 'text-white/65 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

/** 게임 시작 — 메인 메뉴의 '게임 시작'과 같은 버튼(도둑 런 테마는 빨간 hm-btn 을 납작하게) */
function StartButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  const { t } = useTranslation();
  if (SITE_THEME !== 'heist') {
    return (
      <button type="button" className={`btn-primary ${className}`} onClick={onClick}>
        🎮 {t('main.start')}
      </button>
    );
  }
  return (
    <button type="button" className={`hm-btn hm-btn--go hm-btn--compact ${className}`} onClick={onClick}>
      <PlayIcon />
      {t('main.start')}
    </button>
  );
}

/* ============================ 등장·로딩 공통 ============================ */

/** 등장 모션을 받는 덩어리 하나 — ⚠ className 에 `transition` 을 넣지 말 것(lib/enterMotion 주석) */
function Enter({
  order = 0,
  baseDelay = 0,
  className,
  children,
}: {
  order?: number;
  baseDelay?: number;
  className?: string;
  children: ReactNode;
}) {
  const enter = useEnterMotion(order, baseDelay);
  return (
    <motion.div {...enter} className={className}>
      {children}
    </motion.div>
  );
}

function LoadingNote({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: LOADING_NOTE_DELAY_S, duration: 0.3 }}
      className={`text-white/50 ${className}`}
    >
      {t('rankings.loading')}
    </motion.div>
  );
}

/** 처음 받는 동안 자리만 잡아 둔다(로드 완료 시 아래가 튀지 않게) */
function LoadingBlock() {
  return (
    <div className="min-h-[280px] flex items-center justify-center">
      <LoadingNote />
    </div>
  );
}

/**
 * 다시 받는 동안(리그 넘김·새로고침) 옛 글은 즉시 감추되 자리는 지키고, 새 글이 오면 version 이 바뀌어 처음부터 등장.
 * 퇴장 모션은 두지 않는다(즉시 교체).
 */
function Reloadable({ load, version, children }: { load: boolean; version: number; children: ReactNode }) {
  return (
    <div className="relative" aria-busy={load}>
      {load && <LoadingNote className="absolute inset-x-0 top-12 text-center" />}
      <div key={version} className={load ? 'invisible' : undefined}>
        {children}
      </div>
    </div>
  );
}

/* ============================ 리그 페이저 ============================ */

function LeaguePager({
  current,
  position,
  total,
  meta,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  current: Category;
  position: number;
  total: number;
  meta: ScoreMeta | null;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  const enter = useEnterMotion(0);
  // 페이저가 뜬 뒤 리그가 바뀌었는지 — 처음엔 페이저 전체가 들어오므로 리그 이름은 따로 움직이지 않는다
  // (탭을 오가며 페이저가 새로 뜰 때도 마찬가지 — 이름과 틀이 겹쳐 두 번 움직이지 않게)
  const [shownSeq, setShownSeq] = useState(current.seq);
  const [switched, setSwitched] = useState(false);
  if (current.seq !== shownSeq) {
    setShownSeq(current.seq);
    setSwitched(true);
  }
  return (
    <motion.div {...enter} className="card mb-4 flex items-center justify-between gap-3">
      <button
        disabled={!canPrev}
        onClick={onPrev}
        className="text-2xl px-2 disabled:opacity-20 hover:text-violet-300 transition"
        aria-label={t('rankings.prevLeague')}
      >
        ◀
      </button>
      {/* 리그를 넘기면 가운데 글만 새로 들어온다(틀은 그대로) */}
      <LeagueTitle key={current.seq} animate={switched}>
        <div className="text-xs text-white/40 tracking-wider mb-0.5">
          {t('rankings.leagueCount', { current: position, total })}
          {current.status === 'ended' && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-white/10 text-white/60">{t('rankings.ended')}</span>
          )}
        </div>
        <div className="text-lg font-bold truncate">{current.name}</div>
        {meta?.start && meta?.end && (
          // 새 리그 기간이 오기 전에는 옛 리그 날짜를 감춘다(자리는 유지 — 페이저 높이가 들썩이지 않게)
          <div className={`text-[11px] text-white/45 mt-0.5 ${meta.seq === current.seq ? '' : 'invisible'}`}>
            🗓 {meta.mode === 'event' ? t('rankings.eventTally') : t('rankings.season')} {meta.start} ~ {meta.end}
          </div>
        )}
      </LeagueTitle>
      <button
        disabled={!canNext}
        onClick={onNext}
        className="text-2xl px-2 disabled:opacity-20 hover:text-violet-300 transition"
        aria-label={t('rankings.nextLeague')}
      >
        ▶
      </button>
    </motion.div>
  );
}

function LeagueTitle({ animate, children }: { animate: boolean; children: ReactNode }) {
  const enter = useEnterMotion(0);
  return (
    <motion.div {...enter} initial={animate ? enter.initial : false} className="text-center min-w-0">
      {children}
    </motion.div>
  );
}

function EventBanner({ title, body }: { title?: string | null; body?: string | null }) {
  return (
    <Enter order={1} className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 mb-4">
      {title && <div className="font-bold text-amber-200 mb-0.5">🎁 {title}</div>}
      {body && <div className="text-sm text-amber-100/80 whitespace-pre-wrap">{body}</div>}
    </Enter>
  );
}

/* ====================== 배틀 랭킹(시즌 누적 — 전 리그 통합) ====================== */

function BattleRankings({ onLeague, reloadKey }: { onLeague: () => void; reloadKey: number }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<BattleRankEntry[]>([]);
  const [load, setLoad] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const req = useRef(0);

  useEffect(() => {
    const mine = ++req.current;
    setLoad(true);
    setErr(null);
    api.battleRankings(50)
      .then((d) => {
        if (mine !== req.current) return;
        setRows(d.rankings);
        setVersion((v) => v + 1);
        setLoad(false);
      })
      .catch((e) => {
        if (mine !== req.current) return;
        setErr(e instanceof Error ? e.message : String(e));
        setLoad(false);
      });
  }, [reloadKey]);

  if (err) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-3">{err}</p>
      </div>
    );
  }
  if (version === 0) return <LoadingBlock />;

  return (
    <Reloadable load={load} version={version}>
      {rows.length === 0 ? (
        <Enter className="card text-center py-12">
          <div className="text-5xl mb-3" aria-hidden>⚔️</div>
          <p className="text-lg font-bold mb-1">{t('rankings.noBattleRecord')}</p>
          <p className="text-sm text-white/55 leading-relaxed mb-6">
            {t('rankings.noBattleRecordLine1')}<br />{t('rankings.noBattleRecordLine2')}
          </p>
          <button className="btn-primary" onClick={onLeague}>⚔️ {t('rankings.goBattle')}</button>
        </Enter>
      ) : (
        <BattleBoard rows={rows} onLeague={onLeague} />
      )}
    </Reloadable>
  );
}

function BattleBoard({ rows, onLeague }: { rows: BattleRankEntry[]; onLeague: () => void }) {
  const { t } = useTranslation();
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  return (
    <>
      <Enter className="text-center text-xs text-white/40 mb-4">⚔️ {t('rankings.battleSeasonCaption')}</Enter>
      <PodiumRow>
        {top3.map((r, i) => (
          <PodiumSpot
            key={r.user_seq}
            entry={r}
            index={i}
            order={i + 1}
            score={t('rankings.points', { n: r.points })}
            meta={t('rankings.battleRecord', { wins: r.wins, losses: r.losses, draws: r.draws, rate: Math.round(r.win_rate) })}
          />
        ))}
      </PodiumRow>
      {rest.length > 0 && (
        <Enter order={4} className="card p-0 overflow-hidden">
          <ul className="divide-y divide-white/10">
            {rest.map((r) => (
              <li key={r.user_seq} className="flex items-center px-4 py-3">
                <span className="w-10 text-center text-white/60 tabular-nums">{r.rank}</span>
                <Avatar entry={r} size={32} />
                <span className="flex-1 font-semibold truncate ml-2">{r.nickname}</span>
                <span className="text-right ml-2">
                  <div className="font-bold tabular-nums">{t('rankings.points', { n: r.points })}</div>
                  <div className="text-[10px] text-white/40 tabular-nums">
                    {t('rankings.battleRecord', { wins: r.wins, losses: r.losses, draws: r.draws, rate: Math.round(r.win_rate) })}
                  </div>
                </span>
              </li>
            ))}
          </ul>
        </Enter>
      )}
      <Enter order={5} className="flex justify-center mt-8">
        <button className="btn-primary" onClick={onLeague}>⚔️ {t('rankings.goBattle')}</button>
      </Enter>
    </>
  );
}

/* ============================ 점수 랭킹 ============================ */

function ScoreRankings({
  rows,
  load,
  err,
  version,
  onRetry,
  onPlay,
  onSelect,
}: {
  rows: RankingEntry[];
  load: boolean;
  err: string | null;
  version: number;
  onRetry: () => void;
  onPlay: () => void;
  onSelect: (e: RankingEntry) => void;
}) {
  const { t } = useTranslation();
  // 이 표가 뜬 뒤 처음 보여 주는 랭킹(첫 진입·탭 왕복)은 함께 뜨는 리그 페이저 다음 박자로, 리그를 넘긴 뒤엔 오자마자 등장
  const [firstShown, setFirstShown] = useState<number | null>(null);
  if (version > 0 && firstShown === null) setFirstShown(version);

  if (err) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-3">{t('rankings.errorPrefix', { msg: err })}</p>
        <button className="btn-ghost text-sm" onClick={onRetry}>{t('rankings.retry')}</button>
      </div>
    );
  }
  if (version === 0) return <LoadingBlock />;

  const baseDelay = version === firstShown ? ENTER_STAGGER_S : 0;
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <Reloadable load={load} version={version}>
      {rows.length === 0 ? (
        <Enter baseDelay={baseDelay} className="text-center py-16">
          <p className="text-white/50 mb-2">{t('rankings.noScoreRecord')}</p>
          <p className="text-white/40 text-sm mb-6">{t('rankings.beFirst')}</p>
          <StartButton onClick={onPlay} />
        </Enter>
      ) : (
        <>
          <PodiumRow>
            {top3.map((r, i) => (
              <PodiumSpot
                key={r.rank}
                entry={r}
                index={i}
                order={i}
                baseDelay={baseDelay}
                score={r.best_score.toLocaleString()}
                meta={`${t('rankings.plays', { n: r.play_count })} · ${relativeTime(r.updated_at, t)}`}
                onClick={() => onSelect(r)}
              />
            ))}
          </PodiumRow>
          {rest.length > 0 && (
            <Enter order={3} baseDelay={baseDelay} className="card p-0 overflow-hidden">
              <ul className="divide-y divide-white/10">
                {rest.map((r) => (
                  <li
                    key={r.rank}
                    onClick={() => onSelect(r)}
                    className="flex items-center px-4 py-3 hover:bg-white/5 transition cursor-pointer"
                  >
                    <span className="w-10 text-center text-white/60 tabular-nums">{r.rank}</span>
                    <Avatar entry={r} size={32} />
                    <span className="flex-1 font-semibold truncate ml-2">{r.nickname}</span>
                    <span className="text-right ml-2">
                      <div className="font-bold tabular-nums">{r.best_score.toLocaleString()}</div>
                      <div className="text-[10px] text-white/40">
                        {t('rankings.plays', { n: r.play_count })} · {relativeTime(r.updated_at, t)}
                      </div>
                    </span>
                  </li>
                ))}
              </ul>
            </Enter>
          )}
        </>
      )}
    </Reloadable>
  );
}

/* ============================ 1~3등 ============================ */

// 1~3등은 박스 없이 메달·프로필 테두리·점수 색으로만 구분한다(2026-11-18 사장: "박스를 빼도 괜찮을 것 같다", 1~3등만).
// 1등은 메달·프로필을 크게 + 금빛 번짐. 바닥선을 맞춰(items-end) 1등이 한 단 높아 보이게 한다.
const PODIUM_STYLE: Array<{ medal: string; medalSize: string; avatar: number; ring: string; text: string }> = [
  { medal: '🥇', medalSize: 'text-4xl', avatar: 64, ring: 'ring-yellow-300/80 shadow-[0_0_28px_rgba(253,224,71,0.35)]', text: 'text-yellow-300' },
  { medal: '🥈', medalSize: 'text-3xl', avatar: 52, ring: 'ring-zinc-300/70', text: 'text-zinc-200' },
  { medal: '🥉', medalSize: 'text-3xl', avatar: 52, ring: 'ring-amber-500/75', text: 'text-amber-300' },
];

function PodiumRow({ children }: { children: ReactNode }) {
  // 320px 폰(칸 하나 약 85px)에서도 여섯 자리 점수가 옆 칸을 넘지 않게 좁은 화면은 간격·점수 글자를 한 단계 줄인다
  return <div className="mt-2 mb-6 flex items-end justify-center gap-2 min-[360px]:gap-3 sm:gap-8">{children}</div>;
}

function PodiumSpot({
  entry,
  index,
  order,
  baseDelay = 0,
  score,
  meta,
  onClick,
}: {
  entry: { nickname: string; profile_image_data?: string; profile_image?: string };
  index: number;
  order: number;
  baseDelay?: number;
  score: string;
  meta: string;
  onClick?: () => void;
}) {
  const enter = useEnterMotion(order, baseDelay);
  const s = PODIUM_STYLE[index] ?? PODIUM_STYLE[2];
  // 그림(키아트) 위에 바로 놓이므로 글자에 그림자를 깐다
  const base = 'min-w-0 flex-1 max-w-[220px] px-1 text-center [text-shadow:0_2px_10px_rgba(0,0,0,0.75)]';
  const body = (
    // 호버로 살짝 뜨는 움직임은 안쪽 요소에만(바깥은 framer-motion 등장 전용 — transition 클래스 금지)
    <span className="flex flex-col items-center transition-transform duration-300 ease-out group-hover/spot:-translate-y-1">
      <span className={`${s.medalSize} leading-none`}>{s.medal}</span>
      <Avatar entry={entry} size={s.avatar} className={`mt-2 ring-2 ${s.ring}`} />
      <span className="mt-2 block max-w-full truncate text-sm sm:text-base font-bold text-white">{entry.nickname}</span>
      <span className={`block text-lg min-[360px]:text-xl sm:text-2xl font-extrabold tabular-nums leading-tight ${s.text}`}>{score}</span>
      <span className="mt-0.5 block max-w-full truncate text-[10px] sm:text-[11px] text-white/45">{meta}</span>
    </span>
  );
  if (!onClick) {
    return (
      <motion.div {...enter} className={base}>
        {body}
      </motion.div>
    );
  }
  return (
    <motion.button
      type="button"
      {...enter}
      onClick={onClick}
      className={`${base} group/spot cursor-pointer rounded-2xl py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60`}
    >
      {body}
    </motion.button>
  );
}

/* ============================ 공통 컴포넌트 ============================ */

function Avatar({
  entry,
  size,
  className = '',
}: {
  entry: { profile_image_data?: string; profile_image?: string };
  size: number;
  className?: string;
}) {
  const src = pickProfileImage(entry);
  return (
    <span
      className={`rounded-full overflow-hidden border border-white/20 bg-white/5 shrink-0 flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-white/30" style={{ fontSize: size * 0.5 }}>👤</span>
      )}
    </span>
  );
}

function DetailModal({ entry, onClose }: { entry: RankingEntry; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-white/40 tracking-wider">RANK #{entry.rank}</span>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="flex flex-col items-center mb-4">
          <Avatar entry={entry} size={96} />
          <div className="mt-3 text-xl font-bold">{entry.nickname}</div>
        </div>

        {entry.bio && entry.bio.length > 0 ? (
          <div className="bg-white/5 rounded-xl p-3 mb-4 text-sm text-white/80 whitespace-pre-wrap break-words text-center">
            {entry.bio}
          </div>
        ) : (
          <div className="text-center text-xs text-white/30 mb-4">{t('rankings.noBio')}</div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
          <div className="text-center">
            <div className="text-xs text-white/40 tracking-wider">{t('rankings.bestScore')}</div>
            <div className="text-lg font-bold tabular-nums mt-0.5">{entry.best_score.toLocaleString()}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-white/40 tracking-wider">{t('rankings.play')}</div>
            <div className="text-lg font-bold tabular-nums mt-0.5">{t('rankings.plays', { n: entry.play_count })}</div>
          </div>
        </div>

        <div className="text-center text-[10px] text-white/30 mt-3">
          {t('rankings.lastUpdated', { time: relativeTime(entry.updated_at, t) })}
        </div>
      </motion.div>
    </motion.div>
  );
}
