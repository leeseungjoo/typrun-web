// 내 타자 기록(통계) — PB 그리드(이번 달 locale×mode) + 최근 이력 + 시즌 요약. monkeytype 어카운트식.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { typingApi, type TypingMyStats } from '../api/typing';

const unit = (locale: string) => (locale === 'en' ? 'WPM' : '타수');
const modeTag = (locale: string, mode: number) => `${locale === 'en' ? 'EN' : '한'} ${mode}s`;

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function TypingStatsPage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const [data, setData] = useState<TypingMyStats | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) { setBusy(false); return; }
    setBusy(true);
    typingApi.myStats()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setBusy(false));
  }, [user, loading]);

  const hasRecords = !!data && (data.pbs.length > 0 || data.recent.length > 0);

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-6 py-12">
      <button className="text-white/45 text-sm hover:text-white mb-4" onClick={() => nav('/test')}>
        ← {t('test.title')}
      </button>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="font-impact text-4xl md:text-5xl tracking-wide">{t('stats.title')}</h1>
        <span className="text-white/40 text-sm">{t('stats.thisMonth')}</span>
      </div>

      {/* 비로그인 */}
      {!loading && !user && (
        <div className="card text-center py-10">
          <p className="text-white/70 mb-4">{t('stats.loginRequired')}</p>
          <button className="btn-primary" onClick={() => nav('/login', { state: { from: '/test/stats' } })}>
            {t('stats.login')}
          </button>
        </div>
      )}

      {user && busy && <div className="text-white/40 text-center py-10">···</div>}

      {user && !busy && !hasRecords && (
        <div className="card text-center py-10">
          <p className="text-white/60 mb-4">{t('stats.empty')}</p>
          <button className="btn-primary" onClick={() => nav('/test')}>{t('stats.goTest')}</button>
        </div>
      )}

      {user && !busy && hasRecords && data && (
        <div className="flex flex-col gap-8">
          {/* 요약 */}
          <div className="grid grid-cols-2 gap-3">
            <Summary label={t('stats.tests')} value={data.summary.tests} />
            <Summary label={t('stats.timeTyping')} value={fmtTime(data.summary.seconds)} />
          </div>

          {/* PB 그리드 */}
          {data.pbs.length > 0 && (
            <section>
              <h2 className="text-white/55 text-sm font-bold mb-3">{t('stats.pb')}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {data.pbs.map((pb) => (
                  <motion.div
                    key={`${pb.locale}-${pb.mode}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card !p-4"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white/55">{modeTag(pb.locale, pb.mode)}</span>
                      <span className="text-[10px] text-accent font-bold">#{pb.rank_no}</span>
                    </div>
                    <div className="font-impact text-4xl text-white tabular-nums leading-none">{pb.speed}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">{unit(pb.locale)}</div>
                    <div className="text-xs text-white/55 mt-2 tabular-nums">
                      {pb.accuracy}% · {pb.play_count}{t('stats.plays')}
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* 최근 이력 */}
          {data.recent.length > 0 && (
            <section>
              <h2 className="text-white/55 text-sm font-bold mb-3">{t('stats.recent')}</h2>
              <div className="card !p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="text-white/40 text-xs border-b border-white/10">
                    <tr>
                      <th className="text-left font-medium px-4 py-2.5">{t('stats.mode')}</th>
                      <th className="text-right font-medium px-3 py-2.5">{t('stats.speed')}</th>
                      <th className="text-right font-medium px-3 py-2.5">{t('stats.accuracy')}</th>
                      <th className="text-right font-medium px-4 py-2.5">{t('stats.date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((r, i) => (
                      <tr key={i} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-2.5 text-white/70">{modeTag(r.locale, r.mode)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-white font-semibold">
                          {r.speed} <span className="text-white/35 text-xs">{unit(r.locale)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-white/70">{r.accuracy}%</td>
                        <td className="px-4 py-2.5 text-right text-white/45 text-xs">
                          {new Date(r.date).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="flex justify-center">
            <button className="btn-ghost" onClick={() => nav('/test/leaderboard')}>
              {t('result.leaderboard')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card text-center py-5">
      <div className="font-impact text-3xl text-accent tabular-nums leading-none">{value}</div>
      <div className="text-xs text-white/45 mt-1.5">{label}</div>
    </div>
  );
}
