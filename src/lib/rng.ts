// 결정성 RNG — 배틀모드 "공유 시드"용 (의존성 0).
// 같은 matchSeed + spawnIndex 면 모든 클라이언트가 동일한 난수열을 얻는다.
// → 모두 같은 단어·위치·아이템·스폰타이밍을 그리고, 서버는 "이벤트"만 중계하면 된다.
// (단판 모드에는 영향 없음. 배틀 엔진에서만 사용 예정.)

/** mulberry32 — 32비트 시드 기반 결정성 의사난수 생성기. 호출마다 0~1 미만 반환. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * n번째 스폰(spawnIndex)의 난수를 "인덱스 기반"으로 생성한다.
 * 프레임/시간에 의존하지 않으므로, 같은 spawnIndex 면 어느 기기에서도 동일한 결과가 나온다.
 * (불변식: wordInstanceId === spawnIndex — 서버 권위 검증의 키)
 */
export function spawnRng(matchSeed: number, spawnIndex: number): () => number {
  return mulberry32((matchSeed ^ Math.imul(spawnIndex + 1, 0x9e3779b1)) >>> 0);
}

/** 시드 고정 Fisher–Yates 셔플 — 단어 풀을 모든 클라가 동일 순서로 섞을 때 사용. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const arr = items.slice();
  const rng = mulberry32(seed >>> 0);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
