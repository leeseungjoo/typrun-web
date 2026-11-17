// 도둑 런 효과음 — 소리 파일 없이 WebAudio 로 합성하는 짧은 소리(2026-11-17 "소리도 조금 넣어 보자").
// 기존 효과음(sound.ts 의 wav 7종)은 그대로 두고, 그림에 새로 생긴 동작(점프·경광등)에만 얹는다.
// 음소거·볼륨은 sound.ts 설정을 그대로 따른다. 나중에 생성한 소리 파일로 바꾸려면 이 파일만 고치면 된다.
import { getAudioContext } from './audioCtx';
import { sound } from './sound';

interface Tone {
  type: OscillatorType;
  from: number; // 시작 주파수(Hz)
  to: number;   // 끝 주파수(Hz)
  at: number;   // 시작 시각(초, 소리 묶음 기준)
  dur: number;  // 길이(초)
  gain: number; // 최대 음량(0~1, 마스터 볼륨 곱하기 전)
}

const SILENT = 0.0001; // 지수 램프는 0 을 못 쓴다 — 사실상 무음인 값
const ATTACK_SEC = 0.012;

// 점프: 짧게 올라가는 음(기존 hit 소리와 겹치므로 작게)
const JUMP: readonly Tone[] = [{ type: 'triangle', from: 320, to: 640, at: 0, dur: 0.13, gain: 0.07 }];
// 경광등: 높낮이가 두 번 오가는 사이렌
const SIREN: readonly Tone[] = [
  { type: 'sawtooth', from: 620, to: 880, at: 0, dur: 0.16, gain: 0.045 },
  { type: 'sawtooth', from: 880, to: 620, at: 0.16, dur: 0.16, gain: 0.045 },
  { type: 'sawtooth', from: 620, to: 880, at: 0.32, dur: 0.16, gain: 0.045 },
  { type: 'sawtooth', from: 880, to: 620, at: 0.48, dur: 0.18, gain: 0.045 },
];

function playTones(tones: readonly Tone[]): void {
  if (sound.isMuted()) return;
  const master = sound.getVolume();
  if (master <= 0) return;
  const ac = getAudioContext();
  if (!ac) return;
  const t0 = ac.currentTime;
  for (const tone of tones) {
    const start = t0 + tone.at;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.from, start);
    osc.frequency.exponentialRampToValueAtTime(tone.to, start + tone.dur);
    amp.gain.setValueAtTime(SILENT, start);
    amp.gain.exponentialRampToValueAtTime(Math.max(SILENT, tone.gain * master), start + ATTACK_SEC);
    amp.gain.exponentialRampToValueAtTime(SILENT, start + tone.dur);
    osc.connect(amp).connect(ac.destination);
    osc.start(start);
    osc.stop(start + tone.dur + 0.02);
  }
}

export const heistSfx = {
  /**
   * 소리 장치를 깨운다 — 브라우저는 사용자 입력(클릭·키) 처리 중에만 소리 시작을 허락한다.
   * 시작 버튼이나 게임 화면의 첫 키 입력에서 한 번 불러 두면 이후 효과음·배경음이 바로 난다. 음소거 중에는 아무것도 하지 않는다.
   */
  unlock(): void {
    if (sound.isMuted()) return;
    getAudioContext();
  },
  /** 단어를 맞혀 도둑이 뛰어오를 때 */
  jump(): void {
    playTones(JUMP);
  },
  /** 단어를 놓쳐 경광등이 켜질 때 */
  siren(): void {
    playTones(SIREN);
  },
};
