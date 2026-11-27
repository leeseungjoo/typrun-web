// 내 기록 — 가입하지 않아도 이 브라우저에 남는 리그별 기록(지난 판 · 내 최고).
// 결과 화면에서 "지난 판보다 +120점", "내 최고 기록!"을 보여 줘 다음 판을 칠 이유를 만든다(2026-11-27).
// 서버에 보내지 않는다. 브라우저 저장소(localStorage)가 막혀 있으면 조용히 건너뛴다.

export interface PlaySnapshot {
  score: number;
  wpm: number;
  /** 0~1 */
  accuracy: number;
  /** ISO 시각 */
  at: string;
}

export interface LeagueRecord {
  /** 이 기록을 만든 판 길이(초). 판 길이가 바뀌면 점수를 견줄 수 없어 기록을 새로 시작한다. */
  roundSec: number;
  plays: number;
  bestScore: number;
  bestWpm: number;
  last: PlaySnapshot;
  /** 최근에 반영한 판 키들(맨 뒤가 마지막 판) — 결과 화면을 새로고침하거나 뒤로 가기로 다시 열어도 같은 판을 두 번 세지 않는다. */
  recentKeys: string[];
  /** 마지막 판을 반영하기 직전의 값 — 같은 판을 다시 열었을 때 같은 요약을 보여 주려고 남긴다. */
  before: { last: PlaySnapshot | null; bestScore: number; bestWpm: number };
}

export interface PlayInput {
  score: number;
  wpm: number;
  accuracy: number;
  roundSec: number;
  /** 판 키(client_hash). 없으면 매번 새 판으로 센다. */
  key: string | null;
  at: string;
}

export interface RecordSummary {
  /** 이 리그(이 판 길이)에서 처음 친 판 */
  isFirst: boolean;
  isBestScore: boolean;
  isBestWpm: boolean;
  /** 지난 판 대비 — 첫 판이면 null */
  scoreDelta: number | null;
  wpmDelta: number | null;
  /** 이번 판까지 반영한 내 최고 점수 */
  bestScore: number;
  plays: number;
}

function summarize(record: LeagueRecord): RecordSummary {
  const { before, last } = record;
  const isFirst = before.last === null;
  return {
    isFirst,
    isBestScore: !isFirst && last.score > before.bestScore,
    isBestWpm: !isFirst && last.wpm > before.bestWpm,
    scoreDelta: before.last ? last.score - before.last.score : null,
    wpmDelta: before.last ? last.wpm - before.last.wpm : null,
    bestScore: record.bestScore,
    plays: record.plays,
  };
}

const RECENT_KEYS_KEEP = 8;

/**
 * 한 판을 기록에 반영한다(원본은 바꾸지 않는다).
 * 마지막 판의 키가 다시 오면 기록은 그대로 두고 같은 요약을 돌려준다.
 * 그보다 앞선 판의 키가 다시 오면(뒤로 가기로 옛 결과를 연 경우) 기록을 그대로 두고 요약은 null — 견줄 '지난 판'을 알 수 없다.
 */
export function applyPlay(prev: LeagueRecord | null, play: PlayInput): { record: LeagueRecord; summary: RecordSummary | null } {
  if (prev && play.key !== null && prev.recentKeys.includes(play.key)) {
    const isLastPlay = prev.recentKeys[prev.recentKeys.length - 1] === play.key;
    return { record: prev, summary: isLastPlay ? summarize(prev) : null };
  }

  const base = prev && prev.roundSec === play.roundSec ? prev : null;
  const last: PlaySnapshot = { score: play.score, wpm: play.wpm, accuracy: play.accuracy, at: play.at };
  const record: LeagueRecord = {
    roundSec: play.roundSec,
    plays: (base?.plays ?? 0) + 1,
    bestScore: Math.max(base?.bestScore ?? 0, play.score),
    bestWpm: Math.max(base?.bestWpm ?? 0, play.wpm),
    last,
    recentKeys: play.key === null ? base?.recentKeys ?? [] : [...(base?.recentKeys ?? []), play.key].slice(-RECENT_KEYS_KEEP),
    before: { last: base?.last ?? null, bestScore: base?.bestScore ?? 0, bestWpm: base?.bestWpm ?? 0 },
  };
  return { record, summary: summarize(record) };
}

const STORAGE_KEY = 'typrun_my_records';

type Store = Record<string, LeagueRecord>;

function isSnapshot(v: unknown): v is PlaySnapshot {
  const s = v as PlaySnapshot | null;
  return !!s && typeof s.score === 'number' && typeof s.wpm === 'number' && typeof s.accuracy === 'number' && typeof s.at === 'string';
}

function isRecord(v: unknown): v is LeagueRecord {
  const r = v as LeagueRecord | null;
  return (
    !!r &&
    typeof r.roundSec === 'number' &&
    typeof r.plays === 'number' &&
    typeof r.bestScore === 'number' &&
    typeof r.bestWpm === 'number' &&
    isSnapshot(r.last) &&
    Array.isArray(r.recentKeys) &&
    r.recentKeys.every((k) => typeof k === 'string') &&
    !!r.before &&
    typeof r.before.bestScore === 'number' &&
    typeof r.before.bestWpm === 'number' &&
    (r.before.last === null || isSnapshot(r.before.last))
  );
}

function readStore(): Store {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([, v]) => isRecord(v))) as Store;
  } catch {
    return {};
  }
}

/** 기록 묶음 이름 — 일반 리그와 오늘의 도전은 판 길이·조건이 달라 리그가 같아도 따로 둔다. */
export function recordKey(categorySeq: number, mode: 'league' | 'daily' = 'league'): string {
  return mode === 'daily' ? `d${categorySeq}` : `c${categorySeq}`;
}

/** 한 판을 이 브라우저의 내 기록에 반영하고 요약을 돌려준다(요약을 낼 수 없으면 null). 저장소를 못 쓰면 요약만 계산해 돌려준다. */
export function recordPlay(key: string, play: PlayInput): RecordSummary | null {
  const store = readStore();
  const { record, summary } = applyPlay(store[key] ?? null, play);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...store, [key]: record }));
  } catch {
    /* 저장소가 막힌 브라우저 — 이번 화면에서만 보여 준다 */
  }
  return summary;
}
