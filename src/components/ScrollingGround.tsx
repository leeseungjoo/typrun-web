// 게임 하단 장식 — 가로로 끝없이 스크롤되는 땅(러너 느낌). 입력창 위 한 줄 높이의 띠.
// 트랙(2배 폭)을 translateX 로 흘려 GPU 합성 친화. prefers-reduced-motion 시 정지.

interface ScrollingGroundProps {
  /** 한 바퀴 도는 시간(초). 작을수록 빠르게 흐른다. */
  durationSec?: number;
  className?: string;
}

export default function ScrollingGround({ durationSec = 7, className = '' }: ScrollingGroundProps) {
  return (
    <div className={`ground-band ${className}`} aria-hidden>
      <div className="ground-track" style={{ animationDuration: `${durationSec}s` }}>
        <div className="ground-tile" />
        <div className="ground-tile" />
      </div>
    </div>
  );
}
