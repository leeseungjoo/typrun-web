// 레이스 트랙 — 진행률(0..1)에 따라 레이서가 결승선까지 달린다.
// 진행 채움은 scaleX(컴포지터 친화), 레이서는 트랙 내부 [7%, 88%] 구간을 left로 이동(단일 요소라 비용 미미).
interface RaceTrackProps {
  progress: number;   // 0..1
  racer?: string;     // 레이서 이모지
  done?: boolean;     // 완주 시 축하 표시
  label?: string;     // 트랙 좌측 라벨(예: 닉네임/나)
}

export default function RaceTrack({ progress, racer = '🏎️', done = false, label }: RaceTrackProps) {
  const pct = Math.max(0, Math.min(1, progress));
  const left = 7 + pct * 81; // 레이서가 트랙 밖으로 나가지 않도록 매핑

  return (
    <div className="relative w-full max-w-2xl h-16 rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden">
      {/* 진행 채움(scaleX) */}
      <div
        className="absolute inset-y-0 left-0 w-full origin-left bg-gradient-to-r from-accent/35 via-accent/15 to-transparent"
        style={{ transform: `scaleX(${pct})`, transition: 'transform 140ms linear' }}
        aria-hidden
      />
      {/* 점선 주행선 */}
      <div
        className="absolute inset-x-3 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-white/15"
        aria-hidden
      />
      {/* 결승 깃발 */}
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xl select-none" aria-hidden>
        🏁
      </div>
      {/* 레이서 */}
      <div
        className="absolute top-1/2 text-2xl select-none will-change-transform"
        style={{ left: `${left}%`, transform: 'translate(-50%, -50%)', transition: 'left 140ms linear' }}
        aria-hidden
      >
        {done ? '🎉' : racer}
      </div>
      {/* 라벨 / 퍼센트 */}
      <div className="absolute left-3 top-1.5 flex items-center gap-2">
        {label && <span className="text-[11px] font-bold text-white/70">{label}</span>}
      </div>
      <div className="absolute right-2.5 top-1.5 text-[11px] font-bold text-white/70 tabular-nums">
        {Math.round(pct * 100)}%
      </div>
    </div>
  );
}
