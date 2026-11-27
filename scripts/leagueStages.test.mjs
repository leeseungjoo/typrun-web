// 리그 단계(시간에 따라 열리는 단어 묶음) 규칙 테스트 — `node --test scripts/leagueStages.test.mjs` (Node 24: .ts 직접 import)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStagePools, stageIndexAt, stagesForLeague } from '../src/lib/leagueStages.ts';

const word = (w, difficulty) => ({ seq: 0, word: w, input_form: w, meaning: '', example: '', difficulty });
const STAGES = [
  { startSec: 0, levels: [1], title: 'a', hint: '' },
  { startSec: 10, levels: [2], title: 'b', hint: '' },
  { startSec: 30, levels: [3, 2], title: 'c', hint: '' },
];

test('단계가 없는 리그는 null', () => {
  assert.equal(stagesForLeague('ko_words'), null);
  assert.equal(stagesForLeague(undefined), null);
});

test('독수리 탈출 리그는 5단계이고 0초부터 시간순으로 시작한다', () => {
  const stages = stagesForLeague('eagle_escape');
  assert.equal(stages.length, 5);
  assert.equal(stages[0].startSec, 0);
  for (let i = 1; i < stages.length; i++) assert.ok(stages[i].startSec > stages[i - 1].startSec);
  // 생초보 판 길이(150초) 안에 마지막 단계가 열리고, 마지막 단계에도 칠 시간이 넉넉히(40초 이상) 남아야 한다
  assert.ok(stages[stages.length - 1].startSec <= 150 - 40);
  // 단계마다 안내 배너(4초)가 지나고도 칠 시간이 있어야 한다
  for (let i = 1; i < stages.length; i++) assert.ok(stages[i].startSec - stages[i - 1].startSec >= 15);
  for (const s of stages) assert.ok(s.title.length > 0 && s.levels.length > 0);
});

test('경과 시간으로 단계를 고른다 — 경계는 다음 단계', () => {
  assert.equal(stageIndexAt(STAGES, 0), 0);
  assert.equal(stageIndexAt(STAGES, 9.99), 0);
  assert.equal(stageIndexAt(STAGES, 10), 1);
  assert.equal(stageIndexAt(STAGES, 29), 1);
  assert.equal(stageIndexAt(STAGES, 30), 2);
});

test('시간 연장으로 판이 길어져도 마지막 단계에 머문다', () => {
  assert.equal(stageIndexAt(STAGES, 9999), 2);
});

test('음수·NaN 은 첫 단계', () => {
  assert.equal(stageIndexAt(STAGES, -1), 0);
  assert.equal(stageIndexAt(STAGES, Number.NaN), 0);
});

test('단계마다 자기 levels 의 단어만 모은다', () => {
  const words = [word('ㅁ', 1), word('ㅂ', 2), word('나', 3), word('ㄴ', 1)];
  const pools = buildStagePools(words, STAGES);
  assert.deepEqual(pools[0].map((w) => w.word), ['ㅁ', 'ㄴ']);
  assert.deepEqual(pools[1].map((w) => w.word), ['ㅂ']);
  assert.deepEqual(pools[2].map((w) => w.word).sort(), ['ㅂ', '나'].sort());
});

test('해당 단어가 하나도 없는 단계는 전체 단어로 대신한다(빈 풀로 게임이 멈추지 않게)', () => {
  const words = [word('ㅁ', 1), word('ㄴ', 1)];
  const pools = buildStagePools(words, STAGES);
  assert.equal(pools[1].length, 2);
  assert.equal(pools[2].length, 2);
});

test('입력 배열을 바꾸지 않는다', () => {
  const words = [word('ㅁ', 1), word('ㅂ', 2)];
  const copy = structuredClone(words);
  buildStagePools(words, STAGES);
  assert.deepEqual(words, copy);
});
