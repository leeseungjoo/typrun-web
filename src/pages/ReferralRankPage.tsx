import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { pickProfileImage } from '../api/auth';
import InviteLink from '../components/InviteLink';
import type { ReferralEvent, ReferralRankEntry } from '../api/types';

// 화면에 노출할 추천왕 인원 — 상위 20명까지
const VISIBLE_LIMIT = 20;

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

export default function ReferralRankPage() {
  const nav = useNavigate();
  const [event, setEvent] = useState<ReferralEvent | null>(null);
  const [rows, setRows] = useState<ReferralRankEntry[]>([]);
  const [load, setLoad] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.referralRankings(undefined, VISIBLE_LIMIT)
      .then((d) => {
        setEvent(d.event);
        setRows(d.rankings);
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoad(false));
  }, []);

  return (
    <div className="min-h-screen px-6 pt-16 pb-8 max-w-2xl mx-auto">

      <div className="flex items-center justify-between mb-5">
        <button className="text-white/60 hover:text-white" onClick={() => nav('/league')}>
          ← 돌아가기
        </button>
        <h2 className="text-2xl font-bold">🤝 친구초대 랭킹</h2>
        <div className="w-12" />
      </div>

      {load && <p className="text-center text-white/50 py-12">불러오는 중...</p>}
      {err && <p className="text-center text-red-400 py-12">에러: {err}</p>}

      {!load && !err && !event && (
        <div className="text-center py-16 text-white/50">
          <div className="text-3xl mb-2">🤝</div>
          진행 중인 친구추천 이벤트가 없어요.
        </div>
      )}

      {!load && !err && event && (
        <>
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 mb-4">
            <div className="font-bold text-emerald-200 mb-0.5">🎉 {event.title}</div>
            {event.body && (
              <div className="text-sm text-emerald-100/80 whitespace-pre-wrap">{event.body}</div>
            )}
            <div className="text-[11px] text-emerald-100/50 mt-1">
              {event.start_date} ~ {event.end_date}
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="text-center py-12 text-white/50">
              아직 추천 기록이 없어요. 첫 추천왕이 되어보세요!
            </div>
          ) : (
            <>
              {/* 1~3등: 바둑판(포디움) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                {rows.slice(0, 3).map((r, i) => (
                  <PodiumCard key={r.referrer_seq} entry={r} index={i} />
                ))}
              </div>

              {/* 4등부터: 리스트 */}
              {rows.length > 3 && (
                <div className="card p-0 overflow-hidden">
                  <ul className="divide-y divide-white/10">
                    {rows.slice(3).map((r) => (
                      <li key={r.referrer_seq} className="flex items-center px-4 py-3">
                        <span className="w-10 text-center text-white/60 tabular-nums">{r.rank}</span>
                        <Avatar entry={r} size={32} />
                        <span className="flex-1 font-semibold truncate ml-2">{r.nickname}</span>
                        <span className="text-right ml-2">
                          <div className="font-bold tabular-nums text-emerald-200">
                            {r.invited_count.toLocaleString()}
                            <span className="text-xs text-white/40 ml-1">명</span>
                          </div>
                          {r.last_invited_at && (
                            <div className="text-[10px] text-white/40">{relativeTime(r.last_invited_at)}</div>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* 내 초대 링크 (로그인 시) / 로그인 유도 (비로그인 시) */}
      <InviteLink className="mt-8" />
    </div>
  );
}

const PODIUM_STYLE: Array<{ medal: string; bg: string; border: string; text: string; ring: string }> = [
  { medal: '🥇', bg: 'bg-yellow-400/10', border: 'border-yellow-400/40', text: 'text-yellow-300', ring: 'ring-yellow-400/30' },
  { medal: '🥈', bg: 'bg-zinc-300/10',  border: 'border-zinc-300/30',  text: 'text-zinc-200',  ring: 'ring-zinc-300/20' },
  { medal: '🥉', bg: 'bg-amber-700/15', border: 'border-amber-600/40', text: 'text-amber-300', ring: 'ring-amber-600/20' },
];

function PodiumCard({ entry, index }: { entry: ReferralRankEntry; index: number }) {
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
      <div className={`text-2xl font-extrabold tabular-nums ${s.text}`}>
        {entry.invited_count.toLocaleString()}
        <span className="text-sm text-white/40 ml-1">명</span>
      </div>
      {entry.last_invited_at && (
        <div className="text-[10px] text-white/40 mt-1">최근 {relativeTime(entry.last_invited_at)}</div>
      )}
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