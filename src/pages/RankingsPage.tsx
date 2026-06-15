import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import { pickProfileImage } from '../api/auth';
import ContactModal from '../components/ContactModal';
import type { Category, RankingEntry } from '../api/types';

function relativeTime(input: string): string {
  if (!input) return '';
  const ts = Date.parse(input);
  if (Number.isNaN(ts)) return input;
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '방금 전';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(ts).toLocaleDateString('ko-KR');
}

type View = 'score' | 'battle';

export default function RankingsPage() {
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
      .catch((e) => setScoreErr(String(e)));
    // categorySeq 는 최초 진입에만 사용 — 이후 페이징은 내부 idx 로 제어
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) 현재 리그 점수 랭킹 로드
  const loadScore = useCallback(() => {
    if (!current) return;
    setScoreLoad(true);
    setScoreErr(null);
    api.rankings(current.seq, 50)
      .then((d) => {
        setRows(d.rankings);
        setScoreMeta({ mode: d.mode, start: d.window_start, end: d.window_end });
      })
      .catch((e) => setScoreErr(String(e)))
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
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <button className="text-white/60 hover:text-white" onClick={() => nav('/')} aria-label="홈으로">
          ← 홈
        </button>
        <h2 className="text-2xl font-bold tracking-tight">🏆 랭킹</h2>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="text-white/60 hover:text-white text-lg"
          title="새로고침"
          aria-label="새로고침"
        >
          ↻
        </button>
      </div>

      {/* 뷰 탭 — 점수 / 배틀 */}
      <div className="mx-auto mb-5 flex w-full max-w-xs rounded-full border border-white/15 bg-white/5 p-1">
        <RankTab active={view === 'score'} onClick={() => setView('score')} label="🏅 점수" />
        <RankTab active={view === 'battle'} onClick={() => setView('battle')} label="⚔️ 배틀" />
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
                aria-label="이전 리그"
              >
                ◀
              </button>
              <div className="text-center min-w-0">
                <div className="text-xs text-white/40 tracking-wider mb-0.5">
                  리그 {idx + 1} / {leagues.length}
                  {current.status === 'ended' && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-white/10 text-white/60">종료</span>
                  )}
                </div>
                <div className="text-lg font-bold truncate">{current.name}</div>
                {scoreMeta?.start && scoreMeta?.end && (
                  <div className="text-[11px] text-white/45 mt-0.5">
                    🗓 {scoreMeta.mode === 'event' ? '이벤트 집계' : '시즌'} {scoreMeta.start} ~ {scoreMeta.end}
                  </div>
                )}
              </div>
              <button
                disabled={!canNext}
                onClick={() => setIdx((i) => Math.min(leagues.length - 1, i + 1))}
                className="text-2xl px-2 disabled:opacity-20 hover:text-violet-300 transition"
                aria-label="다음 리그"
              >
                ▶
              </button>
            </div>
          )}

          {eventBanner}

          {leagues.length === 0 && !scoreErr && (
            <div className="text-center py-16 text-white/50">운영 중인 랭킹 리그가 없어요.</div>
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

          {/* 하단 액션 */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            {current && (
              <button className="btn-primary" onClick={() => nav(`/game/${current.seq}`)}>
                🎮 도전하기
              </button>
            )}
            <button className="btn-ghost" onClick={() => nav('/league')}>리그 선택</button>
            <button className="btn-ghost" onClick={() => setShowContact(true)}>🤝 문의</button>
          </div>
        </>
      ) : (
        <BattleRankingsBeta onLeague={() => nav('/league')} />
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

/* ====================== 배틀 랭킹(베타 — 집계 준비중) ====================== */

function BattleRankingsBeta({ onLeague }: { onLeague: () => void }) {
  return (
    <div className="card text-center py-12">
      <div className="text-5xl mb-3" aria-hidden>⚔️</div>
      <p className="text-lg font-bold mb-1">배틀 랭킹 준비 중</p>
      <p className="text-sm text-white/55 leading-relaxed mb-6">
        실시간 배틀은 베타예요. 전적·승률 집계가 곧 시작돼요.<br />
        지금 배틀에 참여하면 집계 시작과 함께 순위에 반영돼요.
      </p>
      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto mb-6">
        {[
          { k: '플레이어', v: '–' },
          { k: '오늘 매치', v: '–' },
          { k: '집계 시작', v: '곧' },
        ].map((s) => (
          <div key={s.k} className="rounded-xl border border-white/10 bg-white/5 py-3">
            <div className="font-impact text-2xl leading-none">{s.v}</div>
            <div className="text-[11px] text-white/45 mt-1">{s.k}</div>
          </div>
        ))}
      </div>
      <button className="btn-primary" onClick={onLeague}>
        ⚔️ 배틀하러 가기
      </button>
    </div>
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
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  if (load) return <p className="text-center text-white/50 py-12">불러오는 중...</p>;
  if (err) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-3">에러: {err}</p>
        <button className="btn-ghost text-sm" onClick={onRetry}>다시 시도</button>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-white/50 mb-2">아직 기록이 없어요.</p>
        <p className="text-white/40 text-sm mb-6">첫 기록의 주인공이 되어보세요!</p>
        <button className="btn-primary" onClick={onPlay}>🎮 도전하기</button>
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
                    {r.play_count}판 · {relativeTime(r.updated_at)}
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
        {entry.play_count}판 · {relativeTime(entry.updated_at)}
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
          <div className="text-center text-xs text-white/30 mb-4">자기소개가 없어요</div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
          <div className="text-center">
            <div className="text-xs text-white/40 tracking-wider">최고 점수</div>
            <div className="text-lg font-bold tabular-nums mt-0.5">{entry.best_score.toLocaleString()}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-white/40 tracking-wider">플레이</div>
            <div className="text-lg font-bold tabular-nums mt-0.5">{entry.play_count}판</div>
          </div>
        </div>

        <div className="text-center text-[10px] text-white/30 mt-3">
          최근 갱신: {relativeTime(entry.updated_at)}
        </div>
      </motion.div>
    </motion.div>
  );
}
