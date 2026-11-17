// 게임 배경음 — 소리 파일 없이 WebAudio 로 연주하는 가벼운 8비트풍 반복 곡(2026-11-17 "가벼운 8비트 배경음도 넣자").
// 네모파 멜로디 + 세모파 베이스 + 잡음 드럼, 16마디(약 29초)를 되풀이한다. 곡은 이 파일에 적힌 음표가 전부다(자작, 외부 음원 없음).
// 음소거는 효과음과 같이 sound.ts 를 따르고, 음량은 따로 가진다(typrain.bgm.volume).
// 나중에 생성한 음악 파일로 바꾸려면 start/stop/setVolume/getVolume 만 같은 모양으로 다시 만들면 된다.
import { getAudioContext } from './audioCtx';
import { sound } from './sound';

const VOL_KEY = 'typrain.bgm.volume';
const DEFAULT_VOLUME = 0.6;
const BGM_GAIN = 0.35;        // 음량 100% 일 때의 실제 출력 — 효과음보다 뒤에 깔리게
const TEMPO_BPM = 132;
const STEPS_PER_BAR = 16;     // 16분음표 한 칸
const STEP_SEC = 60 / TEMPO_BPM / 4;
const TICK_MS = 25;           // 예약 주기
const SCHEDULE_AHEAD_SEC = 0.12; // 이만큼 앞의 음까지 미리 예약한다(타이머가 흔들려도 박자가 안 밀린다)

// 음 높이(MIDI 번호). 라단조: D E F G A Bb C
const A4 = 69, Bb4 = 70, C5 = 72, Cs5 = 73, D5 = 74, E5 = 76, F5 = 77, G5 = 79, A5 = 81;
const F4 = 65, G4 = 67;
const REST = null;

type Note = readonly [pitch: number | null, steps: number];

// 멜로디 — 한 줄이 한 마디(칸 수의 합 = 16)
const LEAD_BARS: readonly (readonly Note[])[] = [
  // A: Dm Dm Bb C | Dm Dm Bb A
  [[D5, 2], [REST, 1], [D5, 1], [F5, 2], [D5, 2], [A4, 2], [REST, 2], [C5, 2], [D5, 2]],
  [[F5, 2], [E5, 2], [D5, 2], [A4, 2], [D5, 4], [REST, 4]],
  [[Bb4, 2], [REST, 1], [Bb4, 1], [D5, 2], [Bb4, 2], [F4, 2], [REST, 2], [A4, 2], [Bb4, 2]],
  [[C5, 2], [E5, 2], [G5, 2], [E5, 2], [C5, 4], [REST, 4]],
  [[D5, 2], [REST, 1], [D5, 1], [F5, 2], [A5, 2], [F5, 2], [REST, 2], [D5, 2], [F5, 2]],
  [[A5, 2], [G5, 2], [F5, 2], [E5, 2], [D5, 4], [REST, 4]],
  [[Bb4, 2], [D5, 2], [F5, 2], [D5, 2], [Bb4, 2], [D5, 2], [F5, 4]],
  [[E5, 2], [Cs5, 2], [A4, 2], [Cs5, 2], [E5, 4], [REST, 4]],
  // B: F C Dm Bb | F C A A
  [[A4, 2], [C5, 2], [F5, 4], [E5, 2], [D5, 2], [C5, 4]],
  [[G4, 2], [C5, 2], [E5, 4], [D5, 2], [C5, 2], [G4, 4]],
  [[A4, 2], [D5, 2], [F5, 4], [E5, 2], [F5, 2], [A5, 4]],
  [[Bb4, 2], [D5, 2], [F5, 2], [D5, 2], [Bb4, 4], [REST, 4]],
  [[F5, 2], [REST, 2], [F5, 2], [A5, 2], [G5, 4], [F5, 4]],
  [[E5, 2], [REST, 2], [E5, 2], [G5, 2], [F5, 4], [E5, 4]],
  [[Cs5, 2], [E5, 2], [A5, 4], [G5, 2], [E5, 2], [Cs5, 4]],
  [[A4, 2], [Cs5, 2], [E5, 2], [A5, 2], [REST, 8]],
];
// 마디별 베이스 근음(MIDI) — 위 화음 진행과 같은 순서
const BASS_ROOTS: readonly number[] = [50, 50, 46, 48, 50, 50, 46, 45, 53, 48, 50, 46, 53, 48, 45, 45];
// 베이스 한 마디(8분음표 8개) — 근음에서 몇 반음 위인지: 근음·근음·옥타브·근음·근음·근음·옥타브·5도
const BASS_PATTERN: readonly number[] = [0, 0, 12, 0, 0, 0, 12, 7];

const TOTAL_STEPS = LEAD_BARS.length * STEPS_PER_BAR;

// 채널별 음량(마스터 곱하기 전)
const LEVEL = { lead: 0.16, bass: 0.26, kick: 0.34, snare: 0.14, hat: 0.05 } as const;

interface LeadEvent {
  pitch: number;
  steps: number;
}

/** 멜로디를 "몇 번째 칸에서 어떤 음이 시작하는지" 표로 편다. */
function buildLeadTable(): ReadonlyMap<number, LeadEvent> {
  const table = new Map<number, LeadEvent>();
  LEAD_BARS.forEach((bar, barIndex) => {
    let offset = 0;
    for (const [pitch, steps] of bar) {
      if (pitch !== null && offset < STEPS_PER_BAR) table.set(barIndex * STEPS_PER_BAR + offset, { pitch, steps });
      offset += steps;
    }
  });
  return table;
}
const LEAD_TABLE = buildLeadTable();

const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

function readVolume(): number {
  try {
    const v = parseFloat(localStorage.getItem(VOL_KEY) ?? '');
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

let volume = readVolume();
let audio: AudioContext | null = null; // start() 에서 한 번 잡는다(매 예약마다 다시 깨우지 않게)
let appliedGain = -1;                  // 마지막으로 건 음량 — 바뀔 때만 다시 건다
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextTime = 0; // 다음 칸을 울릴 시각(오디오 시계)
let step = 0;

function ensureGraph(ac: AudioContext): GainNode {
  if (!master) {
    master = ac.createGain();
    master.gain.value = 0;
    master.connect(ac.destination);
  }
  if (!noise) {
    // 드럼용 흰 잡음 0.25초
    noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.25), ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return master;
}

/** 지금 들려야 하는 음량(음소거·음량 0 이면 0). */
function targetGain(): number {
  return sound.isMuted() ? 0 : volume * BGM_GAIN;
}

function playTone(ac: AudioContext, out: AudioNode, type: OscillatorType, hz: number, start: number, dur: number, peak: number): void {
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(hz, start);
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(peak, start + 0.008);
  amp.gain.linearRampToValueAtTime(peak * 0.6, start + dur * 0.45);
  amp.gain.linearRampToValueAtTime(0, start + dur);
  osc.connect(amp).connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function playKick(ac: AudioContext, out: AudioNode, start: number): void {
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, start);
  osc.frequency.exponentialRampToValueAtTime(45, start + 0.11);
  amp.gain.setValueAtTime(LEVEL.kick, start);
  amp.gain.linearRampToValueAtTime(0, start + 0.13);
  osc.connect(amp).connect(out);
  osc.start(start);
  osc.stop(start + 0.15);
}

function playNoise(ac: AudioContext, out: AudioNode, start: number, dur: number, peak: number, filter: BiquadFilterType, hz: number): void {
  if (!noise) return;
  const src = ac.createBufferSource();
  const band = ac.createBiquadFilter();
  const amp = ac.createGain();
  src.buffer = noise;
  band.type = filter;
  band.frequency.value = hz;
  amp.gain.setValueAtTime(peak, start);
  amp.gain.linearRampToValueAtTime(0, start + dur);
  src.connect(band).connect(amp).connect(out);
  src.start(start);
  src.stop(start + dur + 0.01);
}

/** 한 칸(16분음표)에 해당하는 음들을 예약한다. */
function scheduleStep(ac: AudioContext, out: AudioNode, index: number, at: number): void {
  const inBar = index % STEPS_PER_BAR;
  const lead = LEAD_TABLE.get(index);
  if (lead) playTone(ac, out, 'square', midiToHz(lead.pitch), at, lead.steps * STEP_SEC * 0.9, LEVEL.lead);
  if (inBar % 2 === 0) {
    const root = BASS_ROOTS[Math.floor(index / STEPS_PER_BAR)];
    playTone(ac, out, 'triangle', midiToHz(root + BASS_PATTERN[inBar / 2]), at, STEP_SEC * 2 * 0.8, LEVEL.bass);
    playNoise(ac, out, at, 0.03, LEVEL.hat, 'highpass', 6000); // 하이햇: 8분음표마다
  }
  if (inBar === 0 || inBar === 8) playKick(ac, out, at);            // 킥: 1·3박
  if (inBar === 4 || inBar === 12) playNoise(ac, out, at, 0.09, LEVEL.snare, 'bandpass', 1800); // 스네어: 2·4박
}

function tick(): void {
  const ac = audio;
  if (!ac || !master) return;
  const gain = targetGain();
  if (gain !== appliedGain) {
    appliedGain = gain;
    master.gain.setTargetAtTime(gain, ac.currentTime, 0.03);
  }
  // 탭이 숨겨졌거나 소리가 꺼져 있으면 예약하지 않는다 — 돌아오면 아래에서 박자를 다시 잡는다
  if (document.hidden || gain <= 0) return;
  // 예약이 밀렸으면(숨김·음소거에서 돌아옴, 타이머 지연) 밀린 음을 몰아서 울리지 않고 지금 시각에서 이어 간다
  if (nextTime < ac.currentTime) nextTime = ac.currentTime + 0.05;
  while (nextTime < ac.currentTime + SCHEDULE_AHEAD_SEC) {
    scheduleStep(ac, master, step, nextTime);
    nextTime += STEP_SEC;
    step = (step + 1) % TOTAL_STEPS;
  }
}

export const chipBgm = {
  /** 처음부터 연주를 시작한다(이미 연주 중이면 그대로). 소리를 못 내는 환경이면 조용히 넘어간다. */
  start(): void {
    if (timer !== null) return;
    const ac = getAudioContext();
    if (!ac) return;
    audio = ac;
    ensureGraph(ac);
    appliedGain = -1;
    step = 0;
    nextTime = ac.currentTime + 0.06;
    timer = setInterval(tick, TICK_MS);
  },
  /** 연주를 멈춘다(짧게 줄이며 끈다). */
  stop(): void {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
    if (audio && master) master.gain.setTargetAtTime(0, audio.currentTime, 0.05);
  },
  isPlaying(): boolean {
    return timer !== null;
  },
  /** 배경음 음량(0~1). 연주 중이면 바로 반영된다. */
  setVolume(v: number): void {
    volume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem(VOL_KEY, String(volume)); } catch { /* 저장 못 해도 이번 판에는 적용된다 */ }
  },
  getVolume(): number {
    return volume;
  },
};
