import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Category } from '../api/types';
import CoverFlow from '../components/league/CoverFlow';
import BannerSlot from '../components/BannerSlot';

type Tab = 'practice' | 'ranking';

export default function LeaguePage() {
  const nav = useNavigate();
  const [cats, setCats] = useState<Category[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [load, setLoad] = useState(true);
  const [tab, setTab] = useState<Tab>('ranking'); // 디폴트: 랭킹 리그(수정요청3)
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoad(true);
    setErr(null);
    api
      .categories()
      .then(setCats)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoad(false));
  }, [reloadKey]);

  // 활성화(플레이 가능) → 종료 → 오픈예정 순으로 정렬
  const statusOrder = (c: Category) => (c.status === 'coming_soon' ? 2 : c.status === 'ended' ? 1 : 0);
  const byActive = (a: Category, b: Category) => statusOrder(a) - statusOrder(b);

  // 연습(랭킹 X) / 랭킹(랭킹 O) 분리
  const { practice, ranking } = useMemo(() => {
    return {
      practice: cats.filter((c) => c.is_ranking_league === 'N').sort(byActive),
      ranking: cats.filter((c) => c.is_ranking_league === 'Y').sort(byActive),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats]);

  const list = tab === 'practice' ? practice : ranking;

  return (
    <div className="min-h-screen px-4 pt-16 pb-10 max-w-5xl mx-auto flex flex-col">
      <h2 className="text-2xl font-bold text-center mb-1">리그 선택</h2>
      <p className="text-center text-sm text-white/45 mb-6">
        {tab === 'practice' ? '천천히 연습하고 실력을 키워요' : '매월 1일 초기화 · 전국 랭킹에 도전'}
      </p>

      {/* 카테고리 탭(랭킹/연습) + 홈·새로고침 */}
      <div className="mb-8 flex items-center justify-center gap-2 flex-wrap">
        <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-1">
          <TabButton active={tab === 'ranking'} onClick={() => setTab('ranking')} label="🏅 랭킹 리그" count={ranking.length} />
          <TabButton active={tab === 'practice'} onClick={() => setTab('practice')} label="🌱 연습 리그" count={practice.length} />
        </div>
        <button
          onClick={() => nav('/')}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition"
          title="홈"
          aria-label="홈으로"
        >
          🏠
        </button>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition text-lg"
          title="새로고침"
          aria-label="새로고침"
        >
          ↻
        </button>
      </div>

      {load && <p className="text-center text-white/50">불러오는 중...</p>}
      {err && <p className="text-center text-red-400">에러: {err}</p>}

      {!load && !err && (
        <div className="flex-1 flex items-center">
          {/* 탭 전환 시 인덱스 리셋 위해 key 로 리마운트 */}
          <CoverFlow
            key={tab}
            items={list}
            isRanking={tab === 'ranking'}
            onEnter={(c) => nav(tab === 'ranking' ? `/league/${c.seq}` : `/game/${c.seq}`)}
            onRanking={(c) => nav(`/rankings/${c.seq}`)}
          />
        </div>
      )}

      {/* 로비 배너 (카테고리 선택 화면 하단) */}
      {!load && !err && (
        <div className="mt-4 flex justify-center">
          <BannerSlot slot="lobby" />
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-5 py-2 rounded-full text-sm font-bold transition flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
        active ? 'bg-white text-ink shadow' : 'text-white/65 hover:text-white'
      }`}
    >
      {label}
      <span
        className={`text-[11px] px-1.5 py-0.5 rounded-full tabular-nums ${
          active ? 'bg-ink/10 text-ink/70' : 'bg-white/10 text-white/55'
        }`}
      >
        {count}
      </span>
    </button>
  );
}
