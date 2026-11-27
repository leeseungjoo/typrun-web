import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dailyApi, type DailyInfo } from '../../api/daily';
import { liveStreak, readStreak } from '../../lib/dailyStreak';

interface DailyEntryProps {
  onOpen: () => void;
  className?: string;
}

/**
 * 메인·결과 화면의 '오늘의 도전' 진입 버튼.
 * 그날의 리그와 참가자 수를 받아 한 줄로 보여 준다. 못 받아도 버튼은 그대로 뜬다(누르면 도전 화면으로).
 */
export default function DailyEntry({ onOpen, className = '' }: DailyEntryProps) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<DailyInfo | null>(null);
  const [streakState] = useState(() => readStreak());

  useEffect(() => {
    let alive = true;
    dailyApi
      .info(1)
      .then((d) => { if (alive) setInfo(d); })
      .catch(() => { /* 진입 버튼은 정보 없이도 동작한다 */ });
    return () => { alive = false; };
  }, []);

  const streak = info ? liveStreak(streakState, info.date) : 0;
  const sub = !info
    ? t('daily.entrySubLoading')
    : info.players > 0
      ? t('daily.entrySub', { league: info.category_name, count: info.players })
      : t('daily.entrySubEmpty', { league: info.category_name });

  return (
    <button type="button" className={`hm-daily-entry ${className}`} onClick={onOpen}>
      <span className="hm-daily-entry-tag">{t('daily.entryLabel')}</span>
      <span className="hm-daily-entry-sub">{sub}</span>
      {streak > 0 && <span className="hm-daily-entry-streak">{t('daily.streak', { count: streak })}</span>}
      <span className="hm-daily-entry-arrow" aria-hidden>→</span>
    </button>
  );
}
