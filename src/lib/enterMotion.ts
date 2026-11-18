import { useState } from 'react';
import type { MotionProps } from 'framer-motion';

/**
 * 등장 모션 계약(사랑공장 표준 kiosk-page-motion) — 덩어리마다
 * 알파 0 → 1, 아래 10~20px 에서 올라오며, expo-out 1.4~1.6초(덩어리마다 랜덤), 덩어리 사이 0.2초.
 * 퇴장 모션은 없다(즉시 교체 → 새 덩어리만 등장). 방향은 항상 y — x 로 움직이면 폰에서 가로가 넘친다.
 *
 * ⚠ 이 값을 받는 요소에는 Tailwind `transition` 클래스(opacity·transform CSS 트랜지션)를 같이 달지 말 것.
 *   framer-motion 의 페이드가 끝나는 순간 CSS 트랜지션이 투명도 0 부터 다시 재생돼
 *   "나타났다 → 사라졌다 → 다시 나타나는" 깜빡임이 된다(2026-11-18 랭킹 1~3등 카드). 호버 효과는 안쪽 요소에 단다.
 */
export const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const ENTER_STAGGER_S = 0.2;

const ENTER_Y_MIN_PX = 10;
const ENTER_Y_SPREAD_PX = 10;
const ENTER_DURATION_MIN_S = 1.4;
const ENTER_DURATION_SPREAD_S = 0.2;

export type EnterMotionProps = Required<Pick<MotionProps, 'initial' | 'animate' | 'transition'>>;

/** order 번째 덩어리(0부터)의 등장 값. baseDelayS 는 앞선 덩어리들 뒤로 미룰 때 쓴다. */
export function enterMotion(order: number, baseDelayS = 0): EnterMotionProps {
  return {
    initial: { opacity: 0, y: ENTER_Y_MIN_PX + Math.random() * ENTER_Y_SPREAD_PX },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: ENTER_DURATION_MIN_S + Math.random() * ENTER_DURATION_SPREAD_S,
      ease: EXPO_OUT,
      delay: baseDelayS + order * ENTER_STAGGER_S,
    },
  };
}

/** 마운트 때 한 번 뽑은 값을 유지한다 — 다시 그려도 랜덤 오프셋·지속시간이 바뀌지 않게. */
export function useEnterMotion(order: number, baseDelayS = 0): EnterMotionProps {
  const [props] = useState(() => enterMotion(order, baseDelayS));
  return props;
}
