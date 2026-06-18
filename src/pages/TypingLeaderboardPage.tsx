// 타자 리더보드 — 월별, 언어(한글/English) × 시간(15/30/60) 탭. monkeytype 리더보드식 표.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import Segmented from '../components/typing/Segmented';
import { typingApi, type TypingLeaderboard } from '../api/typing';
import type { TestLocale } from '../lib/typingTest/score';

const MODES = [15, 30, 60];
const unit = (locale: string) => (locale === 'en' ? 'WPM' : '타수');

export default function TypingLeaderboardPage() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [locale, setLocale] = useState<TestLocale>(i18n.language?.startsWith('en') ? 'en' : 'ko');
  const [mode, setMode] = useState(30);
  const [data, setData] = useState<TypingLeaderboard | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    setBusy(true);
    typingApi.leaderboard(locale, mode)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setBusy(false));
  }, [locale, mode]);

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-6 py-12">
      <button className="text-white/45 text-sm hover:text-white mb-4" onClick={() => nav('/test')}>
        ← {t('test.title')}
      </button>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="font-impact text-4xl md:text-5xl tracking-wide">{t('board.title')}</h1>
        <span className="text-white/40 text-sm">{t('board.thisMonth')}</span>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Segmented
          options={[{ value: 'ko', label: '한글' }, { value: 'en', label: 'English' }]}
          value={locale}
          onChange={(v) => setLocale(v as TestLocale)}
        />
        <Segmented options={MODES.map((m) => ({ value: m, label: `${m}s` }))} value={mode} onChange={(v) => setMode(v as number)} />
      </div>

      {/* 내 순위 */}
      {user && data?.my_rank && (
        <div className="mb-4 px-4 py-2 rounded-xl bg-accent/15 border border-accent/30 text-sm text-white/85">
          {t('board.myRank')}: <span className="font-bold text-accent">#{data.my_rank}</span>
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-white/40 text-xs border-b border-white/10">
            <tr>
              <th className="text-left font-medium px-4 py-3 w-12">#</th>
              <th className="text-left font-medium px-2 py-3">{t('board.player')}</th>
              <th className="text-right font-medium px-3 py-3">{t('board.speed')}</th>
              <th className="text-right font-medium px-3 py-3 hidden sm:table-cell">{t('board.accuracy')}</th>
              <th className="text-right font-medium px-3 py-3 hidden md:table-cell">{t('board.consistency')}</th>
              <th className="text-right font-medium px-4 py-3 hidden md:table-cell">{t('board.plays')}</th>
            </tr>
          </thead>
          <tbody>
            {busy && (
              <tr><td colSpan={6} className="text-center text-white/40 py-10">···</td></tr>
            )}
            {!busy && data && data.entries.length === 0 && (
              <tr><td colSpan={6} className="text-center text-white/50 py-10">{t('board.empty')}</td></tr>
            )}
            {!busy && data && data.entries.map((e) => {
              const isMe = !!user && e.nickname === user.nickname && data.my_rank === e.rank;
              return (
                <tr key={e.rank} className={`border-b border-white/5 last:border-0 ${isMe ? 'bg-accent/10' : ''}`}>
                  <td className="px-4 py-2.5"><RankBadge rank={e.rank} /></td>
                  <td className="px-2 py-2.5 text-white/85 font-medium truncate max-w-[30vw]">
                    {e.nickname}
                    {isMe && <span className="text-accent text-[10px] ml-1">({t('board.you')})</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white font-bold">
                    {e.speed}<span className="text-white/35 text-xs ml-1">{unit(locale)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/65 hidden sm:table-cell">{e.accuracy}%</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/65 hidden md:table-cell">{e.consistency}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-white/45 hidden md:table-cell">{e.play_count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  if (medal) return <span className="text-lg">{medal}</span>;
  return <span className="text-white/40 tabular-nums">{rank}</span>;
}
