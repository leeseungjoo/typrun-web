// 도둑 포즈 한 장 — 준비(살금살금)·게임오버(들킴)·신기록(환호) 화면에 놓는 장식 그림.
// 그림은 사장 생성본(디자인/20261117/배경/귀여운 도둑의 세 가지 포즈.png)을 heist-ingest 로 자른 것이다.
//
// 사용 예
//   <HeistPose pose="sneak" />                       // 최소
//   <HeistPose pose="cheer" className="h-40" />      // 높이 지정(가로는 비율대로)
import './heistMenu.css';

export type HeistPoseName = 'sneak' | 'caught' | 'cheer';

// 원본 픽셀 크기 — 그림이 뜨기 전에도 자리를 잡아 화면이 밀리지 않게 한다
const POSE_SIZE: Record<HeistPoseName, { w: number; h: number }> = {
  sneak: { w: 451, h: 376 },
  caught: { w: 514, h: 392 },
  cheer: { w: 399, h: 578 },
};

interface HeistPoseProps {
  pose: HeistPoseName;
  /** 높이 지정용(예: "h-32"). 기본은 그림 원래 크기. */
  className?: string;
}

export default function HeistPose({ pose, className = '' }: HeistPoseProps) {
  const { w, h } = POSE_SIZE[pose];
  return (
    <img
      src={`/heist/pose/${pose}.webp`}
      width={w}
      height={h}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`hm-pose ${className}`}
    />
  );
}
