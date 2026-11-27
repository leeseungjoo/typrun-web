import { useTranslation } from 'react-i18next';
import type { DailyRow } from '../../api/daily';

interface DailyBoardProps {
  rows: DailyRow[];
  /** 내 기록이 순위표(위쪽 몇 줄) 밖에 있을 때 맨 아래에 따로 보여 줄 내 순위·점수 */
  me?: { rank: number; score: number } | null;
  className?: string;
}

/** 오늘의 도전 순위표 — 회원은 닉네임, 비회원은 '손님 #A3F2'. 내 줄은 강조한다. */
export default function DailyBoard({ rows, me = null, className = '' }: DailyBoardProps) {
  const { t } = useTranslation();
  const isMeListed = rows.some((r) => r.is_me);

  if (rows.length === 0) {
    return <p className={`hm-daily-empty ${className}`}>{t('daily.boardEmpty')}</p>;
  }

  return (
    <ol className={`hm-daily-board ${className}`}>
      {rows.map((row) => (
        <li key={row.rank} className={`hm-daily-row${row.is_me ? ' is-me' : ''}${row.rank <= 3 ? ' is-top' : ''}`}>
          <span className="hm-daily-rank">{row.rank}</span>
          <span className="hm-daily-name">
            {row.name ?? t('daily.guestName', { tag: row.tag ?? '' })}
            {row.is_me && <em>{t('daily.me')}</em>}
          </span>
          <span className="hm-daily-score">{row.score.toLocaleString()}</span>
        </li>
      ))}
      {me && !isMeListed && (
        <li className="hm-daily-row is-me is-apart">
          <span className="hm-daily-rank">{me.rank}</span>
          <span className="hm-daily-name">
            <em>{t('daily.me')}</em>
          </span>
          <span className="hm-daily-score">{me.score.toLocaleString()}</span>
        </li>
      )}
    </ol>
  );
}
