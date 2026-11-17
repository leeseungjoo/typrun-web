import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { Category } from '../api/types';
import CoverFlow from '../components/league/CoverFlow';
import BannerSlot from '../components/BannerSlot';
import '../components/heist/heistMenu.css';

type Tab = 'practice' | 'ranking';

export default function LeaguePage() {
  const nav = useNavigate();
  const { t } = useTranslation();
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
    <div className="min-h-screen px-4 pt-16 pb-8 max-w-5xl mx-auto flex flex-col">
      {/* 리그 선택(2026-11-17 화면 재질 통일): 카드 = 밤거리에 선 "이번에 털 건물" + 크림색 판, 탭 = 크림색 알약 */}
      <h2 className="hm-page-title text-center">{t('league.selectLeague')}</h2>
      <p className="hm-page-sub text-center mb-4">
        {tab === 'practice' ? t('league.practiceSubtitle') : t('league.rankingSubtitle')}
      </p>

      {/* 카테고리 탭(랭킹/연습) + 새로고침. 홈 버튼은 화면 우상단 TopBar 에 있어 여기서는 뺐다(폰에서 한 줄에 안 들어감) */}
      <div className="mb-5 flex items-center justify-center gap-2 flex-wrap">
        <div className="hm-seg">
          <TabButton active={tab === 'ranking'} onClick={() => setTab('ranking')} label={t('league.rankingLeagueTab')} count={ranking.length} />
          <TabButton active={tab === 'practice'} onClick={() => setTab('practice')} label={t('league.practiceLeagueTab')} count={practice.length} />
        </div>
        <button onClick={() => setReloadKey((k) => k + 1)} className="hm-roundbtn" title={t('league.refresh')} aria-label={t('league.refresh')}>
          <span aria-hidden>↻</span>
        </button>
      </div>

      {load && <p className="text-center text-white/70">{t('league.loading')}</p>}
      {err && <p className="text-center text-red-300">{t('league.error', { msg: err })}</p>}

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
    <button onClick={onClick} aria-pressed={active} className={`hm-seg-btn${active ? ' is-active' : ''}`}>
      {label}
      <span className="hm-seg-count">{count}</span>
    </button>
  );
}
