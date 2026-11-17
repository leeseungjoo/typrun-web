// 게임 화면 소리 조절 — 스피커 버튼을 누르면 효과음·배경음 음량과 전체 끄기가 있는 작은 판이 열린다.
// 음량은 여기서 바로 저장한다(효과음 = lib/sound, 배경음 = lib/chipBgm). 전체 끄기 상태는 GamePage 가 가진다.
//
// ⚠ 타자 게임이라 입력칸이 포커스를 쥐고 있어야 한다. 슬라이더를 만진 뒤 포커스가 판에 남아 있으면
//    다음 첫 글자가 "키 입력 흔적 없는 삽입"으로 판정돼 버려진다(GamePage 의 매크로 차단).
//    그래서 조작이 끝날 때마다 onDone 으로 입력칸에 포커스를 돌려준다.
//
// 사용 예
//   <HeistSoundMenu muted={muted} onToggleMute={toggleMute} onDone={() => inputRef.current?.focus()} />
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { sound } from '../../../lib/sound';
import { chipBgm } from '../../../lib/chipBgm';

interface HeistSoundMenuProps {
  muted: boolean;
  onToggleMute: () => void;
  /** 조작이 끝났을 때(슬라이더에서 손을 뗌·음소거 누름·Esc) 불린다 — 게임 입력칸에 포커스를 돌려주는 용도. */
  onDone?: () => void;
}

const ICON_SOUND_ON = 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z';
const ICON_SOUND_OFF = 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z';

const VOLUME_STEP = 5; // 슬라이더 한 칸(%)
const toPercent = (v: number): number => Math.round(v * 100);

// 버튼은 눌러도 입력칸의 포커스를 뺏지 않는다(슬라이더는 끌어야 해서 이 방법을 못 쓴다 → onDone 으로 돌려준다)
const keepInputFocus = (e: MouseEvent) => e.preventDefault();

export default function HeistSoundMenu({ muted, onToggleMute, onDone }: HeistSoundMenuProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [sfx, setSfx] = useState(() => toPercent(sound.getVolume()));
  const [bgm, setBgm] = useState(() => toPercent(chipBgm.getVolume()));
  const rootRef = useRef<HTMLDivElement>(null);

  // 열려 있을 때: 판 밖을 누르거나, 판 밖에서 키를 치면(= 다시 타자를 치기 시작하면) 닫는다
  useEffect(() => {
    if (!isOpen) return;
    const isOutside = (target: EventTarget | null) => !(target instanceof Node && rootRef.current?.contains(target));
    const onPointerDown = (e: PointerEvent) => { if (isOutside(e.target)) setIsOpen(false); };
    const onKeyDown = (e: KeyboardEvent) => { if (isOutside(e.target)) setIsOpen(false); };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isOpen]);

  const changeSfx = (percent: number) => {
    setSfx(percent);
    sound.setVolume(percent / 100);
  };
  const changeBgm = (percent: number) => {
    setBgm(percent);
    chipBgm.setVolume(percent / 100); // 연주 중인 배경음에 바로 반영된다
  };
  // 효과음은 손을 뗄 때 한 번만 들려준다(끄는 동안 계속 울리지 않게)
  const previewSfx = () => sound.play('click');

  // 판 안에서 Esc → 닫고 입력칸으로 돌아간다
  const onPanelKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    setIsOpen(false);
    onDone?.();
  };

  return (
    // 판 안의 누름은 게임 화면의 "아무 데나 누르면 입력칸으로" 처리로 넘기지 않는다(슬라이더를 끌 수 있게)
    <div ref={rootRef} className="heist-sound" onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="heist-iconbtn heist-iconbtn--sm"
        onMouseDown={keepInputFocus}
        onClick={() => setIsOpen((open) => !open)}
        title={t('game.soundSettings')}
        aria-label={t('game.soundSettings')}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d={muted ? ICON_SOUND_OFF : ICON_SOUND_ON} />
        </svg>
      </button>

      {isOpen && (
        <div className="heist-sound-panel" role="dialog" aria-label={t('game.soundSettings')} onKeyDown={onPanelKeyDown}>
          <label className="heist-sound-row">
            <span>{t('game.soundSfx')}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={VOLUME_STEP}
              value={sfx}
              disabled={muted}
              onChange={(e) => changeSfx(Number(e.target.value))}
              onPointerUp={() => { previewSfx(); onDone?.(); }}
              onKeyUp={previewSfx}
            />
            <output>{sfx}</output>
          </label>
          <label className="heist-sound-row">
            <span>{t('game.soundBgm')}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={VOLUME_STEP}
              value={bgm}
              disabled={muted}
              onChange={(e) => changeBgm(Number(e.target.value))}
              onPointerUp={() => onDone?.()}
            />
            <output>{bgm}</output>
          </label>
          <button
            type="button"
            className={`heist-sound-mute${muted ? ' is-on' : ''}`}
            aria-pressed={muted}
            onMouseDown={keepInputFocus}
            onClick={onToggleMute}
          >
            {muted ? t('game.unmute') : t('game.mute')}
          </button>
        </div>
      )}
    </div>
  );
}
