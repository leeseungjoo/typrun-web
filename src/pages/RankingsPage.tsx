import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import { pickProfileImage } from '../api/auth';
import ContactModal from '../components/ContactModal';
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

export default function RankingsPage() {
  const { t } = useTranslation();
  const { categorySeq } = useParams();
  const nav = useNavigate();

  const [view, setView] = useState<View>('score');

  // 운영중(active/ended) 랭킹 리그 목록 — 페이징 대상
  const [leagues, setLeagues] = useState<Category[]>([]);
  const [idx, setIdx] = useState(0);

  const [rows, setRows] = useState<RankingEntry[]>([]);
  const [scoreMeta, setScoreMeta] = useState<{
    mode: 'event' | 'season';
    start: string | null;
    end: string | null;
  } | null>(null);
  const [scoreLoad, setScoreLoad] = useState(true);
  const [scoreErr, setScoreErr] = useState<string | null>(null);

  const [detail, setDetail] = useState<RankingEntry | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const current = leagues[idx];

  // 1) 리그 목록 로드 (1회) + 진입 카테고리로 시작 인덱스 결정
  useEffect(() => {
    api.categories()
      .then((cats) => {
        const running = cats.filter(
          (c) => c.is_ranking_league === 'Y' && (c.status === 'active' || c.status === 'ended'),
        );
        setLeagues(running);
        const start = running.findIndex((c) => String(c.seq) === String(categorySeq));
        setIdx(start >= 0 ? start : 0);
      })
      .catch((e) => setScoreErr(e instanceof Error ? e.message : String(e)));
    // categorySeq 는 최초 진입에만 사용 — 이후 페이징은 내부 idx 로 제어
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) 현재 리그 점수 랭킹 로드
  const loadScore = useCallback(() => {
    if (!current) {
      // 운영 중 랭킹 리그가 0개 — 로딩을 종료해 하단 버튼(리그선택/문의)이 정상 노출되게
      setScoreLoad(false);
      return;
    }
    setScoreLoad(true);
    setScoreErr(null);
    api.rankings(current.seq, 50)
      .then((d) => {
        setRows(d.rankings);
        setScoreMeta({ mode: d.mode, start: d.window_start, end: d.window_end });
      })
      .catch((e) => setScoreErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setScoreLoad(false));
  }, [current]);

  useEffect(() => {
    loadScore();
    // URL 동기화 (뒤로가기/공유용)
    if (current) nav(`/rankings/${current.seq}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadScore, reloadKey]);

  const canPrev = idx > 0;
  const canNext = idx < leagues.length - 1;

  const eventBanner = useMemo(() => {
    if (!current?.event_title && !current?.event_body) return null;
    return (
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 mb-4">
        {current.event_title && (
          <div className="font-bold text-amber-200 mb-0.5">🎁 {current.event_title}</div>
        )}
        {current.event_body && (
          <div className="text-sm text-amber-100/80 whitespace-pre-wrap">{current.event_body}</div>
        )}
      </div>
    );
  }, [current]);

  return (
    <div className="min-h-screen px-5 pt-16 pb-8 max-w-3xl mx-auto">
      {/* 헤더 — 홈은 공용 상단바(우상단)에 있으므로 제목만 */}
      <h2 className="text-2xl font-bold tracking-tight text-center mb-4">🏆 {t('rankings.title')}</h2>

      {/* 뷰 탭(점수/배틀) + 우측 홈·새로고침 */}
      <div className="mb-5 flex items-center justify-center gap-2">
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
      </div>

      {view === 'score' ? (
        <>
          {/* 리그 페이저 */}
          {leagues.length > 0 && current && (
            <div className="card mb-4 flex items-center justify-between gap-3">
              <button
                disabled={!canPrev}
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                className="text-2xl px-2 disabled:opacity-20 hover:text-violet-300 transition"
                aria-label={t('rankings.prevLeague')}
              >
                ◀
              </button>
              <div className="text-center min-w-0">
                <div className="text-xs text-white/40 tracking-wider mb-0.5">
                  {t('rankings.leagueCount', { current: idx + 1, total: leagues.length })}
                  {current.status === 'ended' && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-white/10 text-white/60">{t('rankings.ended')}</span>
                  )}
                </div>
                <div className="text-lg font-bold truncate">{current.name}</div>
                {scoreMeta?.start && scoreMeta?.end && (
                  <div className="text-[11px] text-white/45 mt-0.5">
                    🗓 {scoreMeta.mode === 'event' ? t('rankings.eventTally') : t('rankings.season')} {scoreMeta.start} ~ {scoreMeta.end}
                  </div>
                )}
              </div>
              <button
                disabled={!canNext}
                onClick={() => setIdx((i) => Math.min(leagues.length - 1, i + 1))}
                className="text-2xl px-2 disabled:opacity-20 hover:text-violet-300 transition"
                aria-label={t('rankings.nextLeague')}
              >
                ▶
              </button>
            </div>
          )}

          {eventBanner}

          {leagues.length === 0 && !scoreErr && (
            <div className="text-center py-16 text-white/50">{t('rankings.noActiveLeague')}</div>
          )}

          {current && (
            <ScoreRankings
              rows={rows}
              load={scoreLoad}
              err={scoreErr}
              onRetry={() => setReloadKey((k) => k + 1)}
              onPlay={() => nav(`/game/${current.seq}`)}
              onSelect={setDetail}
            />
          )}

          {/* 하단 액션 — 랭킹 로드 완료 후 노출(로딩 중 버튼이 먼저 떴다 밀리는 튐 방지) */}
          {!scoreLoad && (
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              {current && (
                <button className="btn-primary" onClick={() => nav(`/game/${current.seq}`)}>
                  🎮 {t('rankings.challenge')}
                </button>
              )}
              <button className="btn-ghost" onClick={() => nav('/league')}>{t('rankings.selectLeague')}</button>
              <button className="btn-ghost" onClick={() => setShowContact(true)}>🤝 {t('rankings.inquiry')}</button>
            </div>
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

/* ====================== 배틀 랭킹(시즌 누적 — 전 리그 통합) ====================== */

function BattleRankings({ onLeague, reloadKey }: { onLeague: () => void; reloadKey: number }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<BattleRankEntry[]>([]);
  const [load, setLoad] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoad(true);
    setErr(null);
    api.battleRankings(50)
      .then((d) => setRows(d.rankings))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoad(false));
  }, [reloadKey]);

  if (load) {
    return <div className="min-h-[280px] flex items-center justify-center text-white/50">{t('rankings.loading')}</div>;
  }
  if (err) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-3">{err}</p>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="card text-center py-12">
        <div className="text-5xl mb-3" aria-hidden>⚔️</div>
        <p className="text-lg font-bold mb-1">{t('rankings.noBattleRecord')}</p>
        <p className="text-sm text-white/55 leading-relaxed mb-6">
          {t('rankings.noBattleRecordLine1')}<br />{t('rankings.noBattleRecordLine2')}
        </p>
        <button className="btn-primary" onClick={onLeague}>⚔️ {t('rankings.goBattle')}</button>
      </div>
    );
  }

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  return (
    <>
      <p className="text-center text-xs text-white/40 mb-4">⚔️ {t('rankings.battleSeasonCaption')}</p>
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {top3.map((r, i) => (
            <BattlePodiumCard key={r.user_seq} entry={r} index={i} />
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <div className="card p-0 overflow-hidden">
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
        </div>
      )}
      <div className="flex justify-center mt-8">
        <button className="btn-primary" onClick={onLeague}>⚔️ {t('rankings.goBattle')}</button>
      </div>
    </>
  );
}

function BattlePodiumCard({ entry, index }: { entry: BattleRankEntry; index: number }) {
  const { t } = useTranslation();
  const s = PODIUM_STYLE[index] ?? PODIUM_STYLE[2];
  const isFirst = index === 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-2xl border ${s.bg} ${s.border} backdrop-blur p-4 ${isFirst ? 'ring-2 ' + s.ring : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-3xl">{s.medal}</span>
        <span className={`text-xs tracking-wider font-bold ${s.text}`}>#{entry.rank}</span>
      </div>
      <div className="flex items-center gap-3 mb-2">
        <Avatar entry={entry} size={48} />
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold truncate">{entry.nickname}</div>
        </div>
      </div>
      <div className={`text-2xl font-extrabold tabular-nums ${s.text}`}>{t('rankings.points', { n: entry.points })}</div>
      <div className="text-[10px] text-white/40 mt-1 tabular-nums">
        {t('rankings.battleRecord', { wins: entry.wins, losses: entry.losses, draws: entry.draws, rate: Math.round(entry.win_rate) })}
      </div>
    </motion.div>
  );
}

/* ============================ 점수 랭킹 ============================ */

function ScoreRankings({
  rows,
  load,
  err,
  onRetry,
  onPlay,
  onSelect,
}: {
  rows: RankingEntry[];
  load: boolean;
  err: string | null;
  onRetry: () => void;
  onPlay: () => void;
  onSelect: (e: RankingEntry) => void;
}) {
  const { t } = useTranslation();
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  // 로딩 영역에 카드 높이만큼 공간을 확보해 로드 완료 시 콘텐츠 점프(튐) 최소화
  if (load) {
    return (
      <div className="min-h-[280px] flex items-center justify-center text-white/50">
        {t('rankings.loading')}
      </div>
    );
  }
  if (err) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-3">{t('rankings.errorPrefix', { msg: err })}</p>
        <button className="btn-ghost text-sm" onClick={onRetry}>{t('rankings.retry')}</button>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-white/50 mb-2">{t('rankings.noScoreRecord')}</p>
        <p className="text-white/40 text-sm mb-6">{t('rankings.beFirst')}</p>
        <button className="btn-primary" onClick={onPlay}>🎮 {t('rankings.challenge')}</button>
      </div>
    );
  }

  return (
    <>
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {top3.map((r, i) => (
            <PodiumCard key={r.rank} entry={r} index={i} onClick={() => onSelect(r)} />
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <div className="card p-0 overflow-hidden">
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
        </div>
      )}
    </>
  );
}

/* ============================ 공통 컴포넌트 ============================ */

const PODIUM_STYLE: Array<{ medal: string; bg: string; border: string; text: string; ring: string }> = [
  { medal: '🥇', bg: 'bg-yellow-400/10', border: 'border-yellow-400/40', text: 'text-yellow-300', ring: 'ring-yellow-400/30' },
  { medal: '🥈', bg: 'bg-zinc-300/10',  border: 'border-zinc-300/30',  text: 'text-zinc-200',  ring: 'ring-zinc-300/20' },
  { medal: '🥉', bg: 'bg-amber-700/15', border: 'border-amber-600/40', text: 'text-amber-300', ring: 'ring-amber-600/20' },
];

function PodiumCard({
  entry,
  index,
  onClick,
}: {
  entry: RankingEntry;
  index: number;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const s = PODIUM_STYLE[index] ?? PODIUM_STYLE[2];
  const isFirst = index === 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className={`rounded-2xl border ${s.bg} ${s.border} backdrop-blur p-4 cursor-pointer hover:brightness-110 transition ${isFirst ? 'ring-2 ' + s.ring : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-3xl">{s.medal}</span>
        <span className={`text-xs tracking-wider font-bold ${s.text}`}>#{entry.rank}</span>
      </div>
      <div className="flex items-center gap-3 mb-2">
        <Avatar entry={entry} size={48} />
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold truncate">{entry.nickname}</div>
        </div>
      </div>
      <div className={`text-2xl font-extrabold tabular-nums ${s.text}`}>
        {entry.best_score.toLocaleString()}
      </div>
      <div className="text-[10px] text-white/40 mt-1">
        {t('rankings.plays', { n: entry.play_count })} · {relativeTime(entry.updated_at, t)}
      </div>
    </motion.div>
  );
}

function Avatar({
  entry,
  size,
}: {
  entry: { profile_image_data?: string; profile_image?: string };
  size: number;
}) {
  const src = pickProfileImage(entry);
  return (
    <div
      className="rounded-full overflow-hidden border border-white/20 bg-white/5 shrink-0 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-white/30" style={{ fontSize: size * 0.5 }}>👤</span>
      )}
    </div>
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
