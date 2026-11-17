// 도둑 런 씬 그림 목록(매니페스트)과 로더.
// 그림 파일이 아직 없는 칸은 null/빈 배열로 두면 씬이 임시 도형(heistPainters)으로 대신 그린다.
// 새 그림이 들어오면 이 파일의 경로만 채우면 된다 — 씬 코드는 건드리지 않는다.
// 프롬프트·파일 규격: 루트 레포 `디자인/20261117/도둑런_이미지_프롬프트_리스트.md`

/** 한 개씩 흘려보내는 물체(건물·나무·소품). h = 화면 세로 대비 키. */
export interface SpriteRef {
  src: string;
  h: number;
  /** 등장 비중(기본 1). 큰 나무는 자주, 소화전은 가끔. */
  weight?: number;
}

/** 달리기·점프·넘어짐 프레임 경로. 프레임은 모두 같은 크기·같은 발 기준선으로 잘려 있어야 한다. */
export interface CharacterFramesRef {
  run: string[];
  jump?: string[];
  trip?: string[];
}

export interface HeistManifest {
  sky: string | null;            // 밤하늘(B1). 없으면 그라데이션 + 별 + 초승달을 코드로
  skyline: string | null;        // 먼 도시 실루엣 띠(B2). 없으면 코드로 구운 실루엣
  buildingStrip: string | null;  // 건물 띠(가로 반복). 개별 건물이 있으면 무시
  buildings: SpriteRef[];        // 개별 건물(B3)
  hedge: string | null;          // 건물 발치 덤불 띠
  near: SpriteRef[];             // 나무·가로등·소품(B4·B5)
  ground: { src: string; feetInset: number } | null; // 바닥 띠(B6). feetInset = 그림 윗변에서 발 닿는 선까지(그림 높이 대비)
  loot: string[];                // 전리품 아이콘(D1)
}

/**
 * 캐릭터 쌍 — 달리는 쪽(runner)과 쫓는 쪽(guard). 리그에 따라 바꿔 쓴다(heistCast.ts 가 리그 → 쌍을 정한다).
 *   thief   = 도둑 ← 경비원(기본)
 *   student = 학생 ← 나쁜 유혹 괴물(예방교육 리그)
 *   chick   = 병아리 ← 독수리(독수리 탈출·생초보)
 *   bride   = 신부 ← 신랑
 */
export type HeistCast = 'thief' | 'student' | 'chick' | 'bride';

export interface CastRef {
  runner: CharacterFramesRef;
  guard: CharacterFramesRef;
  /** 쫓는 쪽이 손전등을 들었는지 — 위기 때 빛줄기를 그릴지 정한다(경비원만 해당). */
  hasFlashlight: boolean;
}

// 그림은 전부 사장님 생성본(루트 레포 디자인/20261117/케릭터·배경)을 scripts/heist-ingest.mjs 로 변환한 것이다.
// h 는 화면 세로 대비 키 — 같은 시트에서 나온 그림끼리는 원본 픽셀 비율을 그대로 유지했다.
const B = '/heist/buildings';
const BUILDING_SCALE = 0.7; // 2026-11-17 사장 조정: 앞 건물은 처음 크기의 70%
const N = '/heist/near';
const frames = (dir: string, name: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => `/heist/${dir}/${name}_${i + 1}.webp`);

export const HEIST_MANIFEST: HeistManifest = {
  sky: '/heist/bg/sky.webp',
  skyline: '/heist/bg/skyline.webp',
  buildingStrip: null,
  buildings: [
    { src: `${B}/jewelry.webp`, h: 0.3 * BUILDING_SCALE },
    { src: `${B}/bank.webp`, h: 0.3 * BUILDING_SCALE },
    { src: `${B}/museum.webp`, h: 0.33 * BUILDING_SCALE },
    { src: `${B}/store.webp`, h: 0.32 * BUILDING_SCALE },
    { src: `${B}/apartment.webp`, h: 0.435 * BUILDING_SCALE },
    { src: `${B}/police.webp`, h: 0.355 * BUILDING_SCALE },
    // 2026-11-17 추가 6채(유치원·한옥 서점·키보드 가게·학교·도서관·찻집) — 원래 리그 카드용으로 뽑은 건물을 배경에 섞어 쓴다
    { src: `${B}/kindergarten.webp`, h: 0.38 * BUILDING_SCALE },
    { src: `${B}/hanok.webp`, h: 0.32 * BUILDING_SCALE },
    { src: `${B}/keyshop.webp`, h: 0.38 * BUILDING_SCALE },
    { src: `${B}/school.webp`, h: 0.32 * BUILDING_SCALE },
    { src: `${B}/library.webp`, h: 0.395 * BUILDING_SCALE },
    { src: `${B}/teahouse.webp`, h: 0.35 * BUILDING_SCALE },
  ],
  hedge: null,
  near: [
    { src: `${N}/tree_round.webp`, h: 0.4, weight: 3 },
    { src: `${N}/tree_lean.webp`, h: 0.3, weight: 2 },
    { src: `${N}/tree_slim.webp`, h: 0.34, weight: 3 },
    { src: `${N}/bush_wide.webp`, h: 0.107, weight: 2 },
    { src: `${N}/bush_round.webp`, h: 0.1, weight: 2 },
    { src: `${N}/lamp.webp`, h: 0.42, weight: 3 },
    { src: `${N}/traffic.webp`, h: 0.38, weight: 1 },
    { src: `${N}/hydrant.webp`, h: 0.11, weight: 1 },
    { src: `${N}/bin.webp`, h: 0.098, weight: 1 },
    { src: `${N}/mailbox.webp`, h: 0.103, weight: 1 },
    { src: `${N}/bench.webp`, h: 0.1, weight: 1 },
  ],
  ground: { src: '/heist/bg/ground.webp', feetInset: 0.03 },
  loot: ['coin', 'diamond', 'ruby', 'goldbar', 'ring', 'cash', 'crown', 'key', 'sack'].map((n) => `/heist/loot/${n}.webp`),
};

// 캐릭터 쌍별 프레임 — 달리기 4 · 점프(도약·낙하) · 넘어짐(휘청·엎어짐), 쫓는 쪽은 달리기 4.
// 쫓는 쪽은 달리는 쪽과 같은 픽셀 배율로 맞춰 변환했다(씬이 두 그림의 픽셀 높이 비로 크기를 정한다).
const castFrames = (cast: string): CastRef['runner'] => ({
  run: frames(`cast/${cast}`, 'run', 4),
  jump: frames(`cast/${cast}`, 'jump', 2),
  trip: frames(`cast/${cast}`, 'trip', 2),
});
export const HEIST_CASTS: Record<HeistCast, CastRef> = {
  thief: {
    runner: { run: frames('thief', 'run', 4), jump: frames('thief', 'jump', 2), trip: frames('thief', 'trip', 2) },
    guard: { run: frames('guard', 'run', 4) },
    hasFlashlight: true,
  },
  student: { runner: castFrames('student'), guard: { run: frames('cast/student', 'chase', 4) }, hasFlashlight: false },
  chick: { runner: castFrames('chick'), guard: { run: frames('cast/chick', 'chase', 4) }, hasFlashlight: false },
  bride: { runner: castFrames('bride'), guard: { run: frames('cast/bride', 'chase', 4) }, hasFlashlight: false },
};

export interface LoadedSprite {
  img: HTMLImageElement;
  h: number;
  weight: number;
}

export interface LoadedFrames {
  run: HTMLImageElement[];
  jump: HTMLImageElement[];
  trip: HTMLImageElement[];
}

export interface HeistAssets {
  sky: HTMLImageElement | null;
  skyline: HTMLImageElement | null;
  buildingStrip: HTMLImageElement | null;
  buildings: LoadedSprite[];
  hedge: HTMLImageElement | null;
  near: LoadedSprite[];
  ground: { img: HTMLImageElement; feetInset: number } | null;
  runner: LoadedFrames | null;
  guard: LoadedFrames | null;
  /** 쫓는 쪽이 손전등을 들었는지(경비원만) — 위기 때 빛줄기를 그릴지 정한다. */
  hasFlashlight: boolean;
  loot: HTMLImageElement[];
}

/** 그림이 하나도 없는 상태 — 로딩 전·실패 시 씬이 이 값으로 임시 도형만 그린다. */
export const EMPTY_HEIST_ASSETS: HeistAssets = {
  sky: null,
  skyline: null,
  buildingStrip: null,
  buildings: [],
  hedge: null,
  near: [],
  ground: null,
  runner: null,
  guard: null,
  hasFlashlight: false,
  loot: [],
};

/** 이미지 1장 로드. 실패(404·디코드 오류)는 null — 씬은 그 칸을 임시 도형으로 대신한다. */
function loadImage(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadSprites(refs: readonly SpriteRef[]): Promise<LoadedSprite[]> {
  const imgs = await Promise.all(refs.map((r) => loadImage(r.src)));
  return refs.flatMap((r, i) => {
    const img = imgs[i];
    return img ? [{ img, h: r.h, weight: r.weight ?? 1 }] : [];
  });
}

async function loadList(srcs: readonly string[] | undefined): Promise<HTMLImageElement[]> {
  const imgs = await Promise.all((srcs ?? []).map(loadImage));
  return imgs.filter((img): img is HTMLImageElement => img !== null);
}

/** 프레임 세트 로드. 달리기 프레임이 한 장도 없으면 세트 전체를 버린다(임시 도형으로 폴백). */
async function loadFrames(ref: CharacterFramesRef | null): Promise<LoadedFrames | null> {
  if (!ref) return null;
  const [run, jump, trip] = await Promise.all([loadList(ref.run), loadList(ref.jump), loadList(ref.trip)]);
  return run.length > 0 ? { run, jump, trip } : null;
}

type SceneryAssets = Omit<HeistAssets, 'runner' | 'guard' | 'hasFlashlight'>;
type CastAssets = Pick<HeistAssets, 'runner' | 'guard' | 'hasFlashlight'>;

let sceneryCached: Promise<SceneryAssets> | null = null;
const castCached = new Map<HeistCast, Promise<CastAssets>>();
// 다 받은 결과 — 다음에 씬이 뜰 때 기다리지 않고 바로 쓴다(peekHeistAssets)
let sceneryReady: SceneryAssets | null = null;
const castReady = new Map<HeistCast, CastAssets>();

/** 배경 그림(하늘·건물·나무·바닥·전리품) — 캐릭터 쌍과 무관하게 한 번만 받는다. */
function loadScenery(): Promise<SceneryAssets> {
  if (sceneryCached) return sceneryCached;
  const manifest = HEIST_MANIFEST;
  sceneryCached = (async (): Promise<SceneryAssets> => {
    const [sky, skyline, buildingStrip, buildings, hedge, near, groundImg, loot] = await Promise.all([
      loadImage(manifest.sky),
      loadImage(manifest.skyline),
      loadImage(manifest.buildingStrip),
      loadSprites(manifest.buildings),
      loadImage(manifest.hedge),
      loadSprites(manifest.near),
      loadImage(manifest.ground?.src ?? null),
      loadList(manifest.loot),
    ]);
    const ground = groundImg && manifest.ground ? { img: groundImg, feetInset: manifest.ground.feetInset } : null;
    const scenery: SceneryAssets = { sky, skyline, buildingStrip, buildings, hedge, near, ground, loot };
    // 하늘·바닥을 못 받았으면(회선 끊김 등) 기억해 두지 않는다 — 다음에 씬이 뜰 때 다시 받는다
    if (sky && ground) sceneryReady = scenery;
    else sceneryCached = null;
    return scenery;
  })();
  return sceneryCached;
}

/** 캐릭터 쌍 그림 — 쓰는 쌍만 받는다(쌍마다 한 번). */
function loadCast(cast: HeistCast): Promise<CastAssets> {
  const hit = castCached.get(cast);
  if (hit) return hit;
  const ref = HEIST_CASTS[cast];
  const job = (async (): Promise<CastAssets> => {
    const [runner, guard] = await Promise.all([loadFrames(ref.runner), loadFrames(ref.guard)]);
    const characters: CastAssets = { runner, guard, hasFlashlight: ref.hasFlashlight };
    // 캐릭터를 못 받았으면 기억해 두지 않는다 — 운영에서는 그 캐릭터가 안 보이므로 다음에 다시 받게 한다
    if (runner && guard) castReady.set(cast, characters);
    else castCached.delete(cast);
    return characters;
  })();
  castCached.set(cast, job);
  return job;
}

/** 이미 다 받아 둔 그림이 있으면 바로 돌려준다(없으면 null). 씬이 다시 뜰 때 깜빡이지 않게 하는 용도. */
export function peekHeistAssets(cast: HeistCast = 'thief'): HeistAssets | null {
  const characters = castReady.get(cast);
  return sceneryReady && characters ? { ...sceneryReady, ...characters } : null;
}

/** 씬 그림 전체 로드(배경 1회 + 캐릭터 쌍별 1회, 이후 캐시). 절대 reject 하지 않는다. */
export async function loadHeistAssets(cast: HeistCast = 'thief'): Promise<HeistAssets> {
  const [scenery, characters] = await Promise.all([loadScenery(), loadCast(cast)]);
  return { ...scenery, ...characters };
}
