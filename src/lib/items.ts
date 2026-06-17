// 아이템 정의 — 단판(GamePage)·배틀(useBattleEngine) 공용 단일 소스.
// positive 플래그가 핵심: 배틀에선 positive=자기 버프, negative(positive:false)=상대 공격으로 발사한다.

export type ItemEffect =
  // 슬롯 (1~5 키 발동)
  | 'slow_motion' | 'freeze' | 'clear_all' | 'booster'
  | 'time_extend' | 'shield' | 'snipe' | 'combo_boost'
  // 즉시 발동
  | 'heal' | 'blur' | 'speedup' | 'word_burst' | 'combo_break';

export interface ItemDef {
  effect: ItemEffect;
  name: string;
  icon: string;
  hint: string;
  slot: boolean;   // true = 인벤토리 저장, false = 즉시 발동
  weight: number;  // 드롭 가중치
  positive: boolean; // true = 자기 버프 / false = 상대 공격(배틀)
}

export interface InventoryItem extends ItemDef {
  id: number;
}

export type TimedEffect = 'slow_motion' | 'freeze' | 'booster' | 'blur' | 'speedup';

export interface ActiveEffect {
  id: number;
  effect: TimedEffect;
  endsAt: number; // performance.now() ms
}

export const MAX_INVENTORY = 5;
export const ITEM_DROP_CHANCE = 0.15; // 단어 스폰 시 아이템 부착 확률
export const SLOW_DURATION_MS = 6000;
export const FREEZE_DURATION_MS = 3000;
export const BOOSTER_DURATION_MS = 10000;
export const BLUR_DURATION_MS = 5000;
export const SPEEDUP_DURATION_MS = 3000;
export const BOOSTER_MULTIPLIER = 10;
export const SLOW_FACTOR = 0.4;
export const SPEEDUP_FACTOR = 1.5;
export const BOMB_SCORE_PER_WORD = 50;
export const BOMB_MAX = 5; // 폭탄: 화면 단어 중 랜덤 최대 N개만 터뜨림(수정요청: 전체 X)
export const TIME_EXTEND_SEC = 10;
export const SNIPE_BONUS = 100;
export const COMBO_BOOST = 5;
export const WORD_BURST_COUNT = 4;

export const ITEM_POOL: ItemDef[] = [
  // ===== 슬롯 (1~5 키 발동) =====
  { effect: 'slow_motion',  name: '슬로우',     icon: '🐢',   slot: true,  positive: true,  weight: 10, hint: '6초간 낙하 60% 감속' },
  { effect: 'freeze',       name: '프리즈',     icon: '🧊',   slot: true,  positive: true,  weight: 7,  hint: '3초간 모두 정지' },
  { effect: 'booster',      name: '부스터',     icon: '⚡',   slot: false, positive: true,  weight: 8,  hint: '10초간 점수 x10 (즉시 발동)' },
  { effect: 'clear_all',    name: '폭탄',       icon: '💣',   slot: true,  positive: true,  weight: 6,  hint: '화면 단어 폭파 + 점수 보너스 (배틀: 랜덤 최대 5개·콤보 반영)' },
  { effect: 'time_extend',  name: '시간연장',   icon: '⏰',   slot: true,  positive: true,  weight: 6,  hint: '게임 시간 +10초' },
  { effect: 'shield',       name: '방어막',     icon: '🛡',   slot: true,  positive: true,  weight: 7,  hint: '다음 miss 1회 무효' },
  { effect: 'snipe',        name: '저격',       icon: '🎯',   slot: true,  positive: true,  weight: 6,  hint: '가장 아래 단어 1개 즉시 폭파 (+100)' },
  { effect: 'combo_boost',  name: '콤보부스트', icon: '💎',   slot: true,  positive: true,  weight: 5,  hint: '콤보 즉시 +5' },
  // ===== 즉시 발동 (배틀에선 negative=상대에게 발사) =====
  { effect: 'heal',         name: '힐',         icon: '❤️‍🩹', slot: false, positive: true,  weight: 8,  hint: 'HP +1' },
  { effect: 'blur',         name: '블러',       icon: '👁‍🗨', slot: false, positive: false, weight: 6,  hint: '5초간 단어 흐림(상대에게)' },
  { effect: 'speedup',      name: '가속',       icon: '💨',   slot: false, positive: false, weight: 6,  hint: '3초간 낙하 1.5배(상대에게)' },
  { effect: 'word_burst',   name: '단어폭주',   icon: '🌪',   slot: false, positive: false, weight: 5,  hint: '즉시 4개 추가 스폰(상대에게)' },
  { effect: 'combo_break',  name: '콤보붕괴',   icon: '🥚',   slot: false, positive: false, weight: 5,  hint: '콤보 즉시 0(상대에게)' },
];

const TOTAL_WEIGHT = ITEM_POOL.reduce((sum, it) => sum + it.weight, 0);

export const randomItemDef = (): ItemDef => {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const it of ITEM_POOL) {
    r -= it.weight;
    if (r <= 0) return it;
  }
  return ITEM_POOL[0];
};

/** effect 코드로 ItemDef 조회(상대 공격 수신 시 아이콘/이름 표시용). */
export function itemByEffect(effect: ItemEffect): ItemDef | undefined {
  return ITEM_POOL.find((i) => i.effect === effect);
}
