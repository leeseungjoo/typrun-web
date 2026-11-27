// 내 기록 · 오늘의 도전 연속 기록 · 판 길이 규칙 테스트 — `node --test scripts/playerRecords.test.mjs` (Node 24: .ts 직접 import)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPlay } from '../src/lib/myRecords.ts';
import { advanceStreak, liveStreak, playedToday } from '../src/lib/dailyStreak.ts';
import { rankedRoundSec } from '../src/lib/roundLength.ts';

const play = (over = {}) => ({ score: 1000, wpm: 20, accuracy: 0.9, roundSec: 90, key: 'k1', at: '2026-11-27T01:00:00.000Z', ...over });

test('첫 판은 견줄 기록이 없다', () => {
  const { record, summary } = applyPlay(null, play());
  assert.equal(summary.isFirst, true);
  assert.equal(summary.isBestScore, false);
  assert.equal(summary.scoreDelta, null);
  assert.equal(summary.bestScore, 1000);
  assert.equal(record.plays, 1);
});

test('두 번째 판은 지난 판과의 차이를 알려 준다', () => {
  const first = applyPlay(null, play()).record;
  const { record, summary } = applyPlay(first, play({ score: 1300, wpm: 24, key: 'k2' }));
  assert.equal(summary.isFirst, false);
  assert.equal(summary.scoreDelta, 300);
  assert.equal(summary.wpmDelta, 4);
  assert.equal(summary.isBestScore, true);
  assert.equal(summary.isBestWpm, true);
  assert.equal(record.bestScore, 1300);
  assert.equal(record.plays, 2);
});

test('지난 판보다 낮으면 최고 기록은 그대로', () => {
  const two = applyPlay(applyPlay(null, play({ score: 2000 })).record, play({ score: 800, wpm: 15, key: 'k2' }));
  assert.equal(two.summary.scoreDelta, -1200);
  assert.equal(two.summary.isBestScore, false);
  assert.equal(two.summary.bestScore, 2000);
});

test('지난 판보다는 높아도 내 최고보다 낮으면 최고 기록이 아니다', () => {
  let r = applyPlay(null, play({ score: 3000, key: 'a' })).record;
  r = applyPlay(r, play({ score: 500, key: 'b' })).record;
  const { summary } = applyPlay(r, play({ score: 900, key: 'c' }));
  assert.equal(summary.scoreDelta, 400);
  assert.equal(summary.isBestScore, false);
});

test('같은 판을 다시 열면(결과 화면 새로고침) 판 수가 늘지 않고 같은 요약이 나온다', () => {
  const first = applyPlay(null, play()).record;
  const second = applyPlay(first, play({ score: 1300, key: 'k2' }));
  const again = applyPlay(second.record, play({ score: 1300, key: 'k2' }));
  assert.equal(again.record, second.record);
  assert.deepEqual(again.summary, second.summary);
});

test('앞선 판의 결과를 다시 열어도(뒤로 가기) 판 수가 늘지 않고, 견줄 수 없으니 요약은 없다', () => {
  let r = applyPlay(null, play({ key: 'a' })).record;
  r = applyPlay(r, play({ score: 1300, key: 'b' })).record;
  const replay = applyPlay(r, play({ key: 'a' }));
  assert.equal(replay.record, r);
  assert.equal(replay.summary, null);
});

test('판 키가 없으면 매번 새 판으로 센다', () => {
  const first = applyPlay(null, play({ key: null })).record;
  assert.equal(applyPlay(first, play({ key: null })).record.plays, 2);
});

test('판 길이가 바뀌면 기록을 새로 시작한다(2분 기록과 90초 기록은 견줄 수 없다)', () => {
  const old = applyPlay(null, play({ score: 9000, roundSec: 120 })).record;
  const { record, summary } = applyPlay(old, play({ score: 1000, roundSec: 90, key: 'k2' }));
  assert.equal(summary.isFirst, true);
  assert.equal(summary.scoreDelta, null);
  assert.equal(record.bestScore, 1000);
  assert.equal(record.plays, 1);
});

test('원본 기록을 바꾸지 않는다', () => {
  const first = applyPlay(null, play()).record;
  const frozen = JSON.stringify(first);
  applyPlay(first, play({ score: 5000, key: 'k2' }));
  assert.equal(JSON.stringify(first), frozen);
});

test('연속 기록: 첫 도전은 1일', () => {
  assert.deepEqual(advanceStreak(null, '2026-11-27'), { lastDate: '2026-11-27', streak: 1, best: 1 });
});

test('연속 기록: 다음 날 이어 치면 늘고, 같은 날 다시 치면 그대로', () => {
  const d1 = advanceStreak(null, '2026-11-27');
  assert.equal(advanceStreak(d1, '2026-11-27'), d1);
  const d2 = advanceStreak(d1, '2026-11-28');
  assert.deepEqual(d2, { lastDate: '2026-11-28', streak: 2, best: 2 });
});

test('연속 기록: 하루 건너뛰면 1부터 다시, 최고 기록은 남는다', () => {
  const d3 = { lastDate: '2026-11-29', streak: 3, best: 3 };
  assert.deepEqual(advanceStreak(d3, '2026-12-01'), { lastDate: '2026-12-01', streak: 1, best: 3 });
});

test('연속 기록: 달이 바뀌어도 이어진다', () => {
  assert.equal(advanceStreak({ lastDate: '2026-11-30', streak: 4, best: 4 }, '2026-12-01').streak, 5);
});

test('보여 줄 연속 일수: 어제까지 이어 왔으면 유지, 끊겼으면 0', () => {
  const s = { lastDate: '2026-11-27', streak: 3, best: 3 };
  assert.equal(liveStreak(s, '2026-11-27'), 3);
  assert.equal(liveStreak(s, '2026-11-28'), 3);
  assert.equal(liveStreak(s, '2026-11-29'), 0);
  assert.equal(liveStreak(null, '2026-11-27'), 0);
  assert.equal(playedToday(s, '2026-11-27'), true);
  assert.equal(playedToday(s, '2026-11-28'), false);
});

test('일반 리그 판 길이: 11월 시즌은 120초, 12월 시즌(한국 12/1 0시)부터 90초', () => {
  assert.equal(rankedRoundSec(Date.parse('2026-11-30T14:59:59Z')), 120);
  assert.equal(rankedRoundSec(Date.parse('2026-11-30T15:00:00Z')), 90);
  assert.equal(rankedRoundSec(Date.parse('2027-03-01T00:00:00Z')), 90);
});
