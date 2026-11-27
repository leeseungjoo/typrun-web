import { useTranslation } from 'react-i18next';
import type { RecordSummary } from '../lib/myRecords';

interface RecordDeltaProps {
  /** lib/myRecords 의 recordPlay 결과. null 이면 아무것도 그리지 않는다. */
  summary: RecordSummary | null;
  className?: string;
}

/**
 * 내 기록 한 줄 — "지난 판보다 +300점 · 내 최고 12,340점".
 * 이 브라우저에 남긴 기록과 견준 값이라 가입하지 않아도 보인다(결과 화면 공용).
 */
export default function RecordDelta({ summary, className = '' }: RecordDeltaProps) {
  const { t } = useTranslation();
  if (!summary) return null;

  const delta = summary.scoreDelta ?? 0;
  const tone = summary.isFirst ? 'first' : summary.isBestScore ? 'best' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
  const absDelta = Math.abs(delta).toLocaleString();
  const headline =
    tone === 'first'
      ? t('record.first')
      : tone === 'best'
        ? t('record.best', { delta: `+${absDelta}` })
        : tone === 'same'
          ? t('record.same')
          : t(tone === 'up' ? 'record.up' : 'record.down', { delta: absDelta });
  // 최고 기록을 넘은 판은 머리말이 곧 최고 기록이라 뒤에 다시 적지 않는다
  const showBest = tone === 'up' || tone === 'down' || tone === 'same';
  const wpmUp = summary.wpmDelta !== null && summary.wpmDelta > 0 ? summary.wpmDelta : 0;

  return (
    <p className={`hm-record hm-record--${tone} ${className}`} role="status">
      <strong>{headline}</strong>
      {showBest && <span>{t('record.myBest', { best: summary.bestScore.toLocaleString() })}</span>}
      {wpmUp > 0 && <span>{t('record.wpmUp', { delta: wpmUp })}</span>}
    </p>
  );
}
