import { spawnRng } from './rng';
import type { Word } from '../api/types';

// 배틀 결정성 스폰 — 모든 클라가 matchSeed + spawnIndex 만으로 동일한 단어/위치를 그린다.
// 서버는 "이벤트"(누가 spawnIndex 를 깼는지)만 중계하면 된다(풀 위치는 안 보냄).

export interface BattleSpawn {
  spawnIndex: number;
  word: Word;
  x: number; // % from left (10~90)
}

/** API 가 주는 풀 순서가 클라마다 달라도 동일 인덱스가 되도록 seq 오름차순으로 정규화. */
export function canonicalPool(words: readonly Word[]): Word[] {
  return [...words].sort((a, b) => a.seq - b.seq);
}

/**
 * n번째 스폰의 단어/위치를 인덱스 기반으로 결정. pool 은 canonicalPool() 로 정규화된 것이어야 한다.
 * 같은 (matchSeed, spawnIndex, pool) 이면 어느 기기에서도 동일.
 */
export function computeSpawn(pool: readonly Word[], matchSeed: number, spawnIndex: number): BattleSpawn {
  const rng = spawnRng(matchSeed, spawnIndex);
  const word = pool[Math.floor(rng() * pool.length)];
  const x = 10 + rng() * 80;
  return { spawnIndex, word, x };
}
