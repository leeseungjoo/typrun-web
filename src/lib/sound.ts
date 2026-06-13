// 게임 SFX — HTMLAudioElement 기반 (오버랩 지원: cloneNode)
// 첫 재생 지연 방지 위해 preload() 권장.

export type SfxKey = 'hit' | 'miss' | 'wrong' | 'combo' | 'start' | 'over' | 'click';

interface SfxConfig {
  url: string;
  volume: number; // 0~1, 사운드별 기본 볼륨
}

const CONFIG: Record<SfxKey, SfxConfig> = {
  hit:   { url: '/sounds/hit.wav',   volume: 0.6 },
  miss:  { url: '/sounds/miss.wav',  volume: 0.7 },
  wrong: { url: '/sounds/wrong.wav', volume: 0.5 },
  combo: { url: '/sounds/combo.wav', volume: 0.8 },
  start: { url: '/sounds/start.wav', volume: 0.7 },
  over:  { url: '/sounds/over.wav',  volume: 0.7 },
  click: { url: '/sounds/click.wav', volume: 0.4 },
};

const MUTE_KEY = 'typrain.sfx.muted';
const VOL_KEY  = 'typrain.sfx.volume';

const cache: Partial<Record<SfxKey, HTMLAudioElement>> = {};

function getAudio(key: SfxKey): HTMLAudioElement {
  let a = cache[key];
  if (!a) {
    a = new Audio(CONFIG[key].url);
    a.preload = 'auto';
    cache[key] = a;
  }
  return a;
}

let muted = (() => {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
})();

let masterVolume = (() => {
  try {
    const v = parseFloat(localStorage.getItem(VOL_KEY) ?? '1');
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
  } catch { return 1; }
})();

export const sound = {
  preload() {
    (Object.keys(CONFIG) as SfxKey[]).forEach(getAudio);
  },
  play(key: SfxKey) {
    if (muted) return;
    const base = getAudio(key);
    // 클론해서 재생 → 빠른 연타 시 겹쳐 재생 가능
    const a = base.cloneNode() as HTMLAudioElement;
    a.volume = CONFIG[key].volume * masterVolume;
    a.play().catch(() => {
      // 자동재생 정책 등은 조용히 무시
    });
  },
  setMuted(m: boolean) {
    muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ }
  },
  isMuted() { return muted; },
  setVolume(v: number) {
    masterVolume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem(VOL_KEY, String(masterVolume)); } catch { /* ignore */ }
  },
  getVolume() { return masterVolume; },
};
