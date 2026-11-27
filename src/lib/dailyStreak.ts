// 오늘의 도전 연속 기록 — 며칠째 이어서 도전했는지. 가입 없이 이 브라우저에 남긴다(서버에 보내지 않는다).
// 날짜는 서버가 내려준 한국 날짜(YYYY-MM-DD)를 쓴다 — 기기 시계·시간대가 달라도 어긋나지 않게.

export interface DailyStreak {
  /** 마지막으로 도전한 날짜(YYYY-MM-DD) */
  lastDate: string;
  streak: number;
  best: number;
}

const DAY_MS = 86_400_000;

function dayNumber(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

/** 오늘 한 판을 마쳤을 때의 연속 기록. 같은 날 다시 쳐도 늘지 않고, 하루라도 건너뛰면 1부터 다시 센다. */
export function advanceStreak(prev: DailyStreak | null, today: string): DailyStreak {
  if (!prev) return { lastDate: today, streak: 1, best: 1 };
  const gap = dayNumber(today) - dayNumber(prev.lastDate);
  if (gap <= 0) return prev; // 같은 날(또는 시계가 거꾸로 간 경우) — 그대로
  const streak = gap === 1 ? prev.streak + 1 : 1;
  return { lastDate: today, streak, best: Math.max(prev.best, streak) };
}

/** 지금 보여 줄 연속 일수 — 어제까지 이어 왔으면 그 숫자(오늘 치면 +1 이 된다), 끊겼으면 0. */
export function liveStreak(prev: DailyStreak | null, today: string): number {
  if (!prev) return 0;
  const gap = dayNumber(today) - dayNumber(prev.lastDate);
  return gap <= 1 ? prev.streak : 0;
}

/** 오늘 이미 도전했는지. */
export function playedToday(prev: DailyStreak | null, today: string): boolean {
  return !!prev && prev.lastDate === today;
}

const STORAGE_KEY = 'typrun_daily_streak';

export function readStreak(): DailyStreak | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as DailyStreak | null;
    if (!v || typeof v.lastDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.lastDate)) return null;
    if (!Number.isInteger(v.streak) || v.streak < 1 || !Number.isInteger(v.best) || v.best < v.streak) return null;
    return { lastDate: v.lastDate, streak: v.streak, best: v.best };
  } catch {
    return null;
  }
}

/** 오늘 도전을 마친 것으로 기록하고 새 연속 기록을 돌려준다. */
export function markPlayedToday(today: string): DailyStreak {
  const next = advanceStreak(readStreak(), today);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* 저장소가 막힌 브라우저 — 이번 화면에서만 보여 준다 */
  }
  return next;
}
