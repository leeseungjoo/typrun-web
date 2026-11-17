// 게임 밖 화면에 까는 "달리는 화면" — 게임 씬(HeistScene)을 입력 없이 스스로 연기시킨다(소리 없음).
// 대기화면(메인)·출발 전·종료화면에 쓴다(2026-11-17 사장: 대기화면은 달려가던 화면이 좋았다, 키아트는 사이 화면에만).
// 부모가 화면 전체를 덮는 자리(fixed inset-0 등)를 잡아 줘야 한다 — 씬은 부모 크기를 그대로 채운다.
//
// 사용 예
//   <HeistDemoScene mood="attract" />   // 메인: 점프·가속·가끔 넘어짐
//   <HeistDemoScene mood="chased" />    // 게임오버: 경비원이 손전등을 켜고 바짝 붙는다
import { useEffect, useState } from 'react';
import HeistScene from '../game/heist/HeistScene';
import type { HeistCast } from '../game/heist/heistAssets';

/** attract = 대기화면(점프·가속·가끔 넘어짐) · ready = 출발 전(달리기만) · chased = 종료화면(경비원이 바짝) */
export type HeistDemoMood = 'attract' | 'ready' | 'chased';

interface HeistDemoSceneProps {
  mood: HeistDemoMood;
  /** 캐릭터 쌍(기본 도둑 ← 경비원). 출발 전·종료 화면에서 방금 한 리그의 캐릭터를 보여 줄 때 넘긴다. */
  cast?: HeistCast;
}

const DEMO_MAX_HP = 5;
const MISS_EVERY = 7; // attract: 이 횟수마다 한 번 넘어진다(그 사이엔 정답 = 점프)

// 분위기별 연기 — hp 는 경비원과의 거리(낮을수록 가깝고, 1 이면 손전등을 켠다), stepMs 는 점프 간격(0 = 달리기만)
const MOODS: Record<HeistDemoMood, { hp: number; stepMs: number; canTrip: boolean }> = {
  attract: { hp: 4, stepMs: 2400, canTrip: true },
  ready: { hp: DEMO_MAX_HP, stepMs: 0, canTrip: false },
  chased: { hp: 1, stepMs: 3200, canTrip: false },
};

export default function HeistDemoScene({ mood, cast }: HeistDemoSceneProps) {
  const { hp, stepMs, canTrip } = MOODS[mood];
  // 가짜 정답/미스 카운터만 올려 씬이 점프·가속·넘어짐을 스스로 연기하게 한다
  const [demo, setDemo] = useState({ correct: 0, miss: 0 });

  useEffect(() => {
    if (stepMs <= 0) return;
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      const isTrip = canTrip && n % MISS_EVERY === 0;
      setDemo((d) => (isTrip ? { ...d, miss: d.miss + 1 } : { ...d, correct: d.correct + 1 }));
    }, stepMs);
    return () => clearInterval(id);
  }, [stepMs, canTrip]);

  // 콤보 = 마지막 넘어짐 이후 맞힌 수 → 점선 꼬리가 붙었다 끊기는 것까지 보여 준다(넘어지지 않는 분위기는 꼬리 없이)
  const combo = canTrip ? (demo.correct + demo.miss) % MISS_EVERY : 0;
  return <HeistScene hp={hp} maxHp={DEMO_MAX_HP} correct={demo.correct} miss={demo.miss} combo={combo} cast={cast} />;
}
