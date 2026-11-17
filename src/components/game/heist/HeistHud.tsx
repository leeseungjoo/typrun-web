// 도둑 런 상단 표시줄 — 올리브영 타자게임 구도.
//   1줄: [홈] 리그 이름 ······ [TIME] [SCORE] ······ [소리 조절] [내 정보] TYPRUN
//   2줄: [SPEED 게이지] 콤보 ······ 방어막 · 하트
// 값만 받아 그리는 표현 컴포넌트다(게임 상태·판정은 GamePage 가 가진다).
import type { MouseEvent, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import HeistSoundMenu from './HeistSoundMenu';
import './heist.css';

interface HeistHudProps {
  /** 루트 요소 ref — GamePage 가 높이를 재서 단어 낙하 시작점을 정한다. */
  rootRef: RefObject<HTMLDivElement>;
  /** 속도 게이지 채움 요소 ref — HeistScene 이 scaleX 로 직접 갱신한다. */
  speedFillRef: RefObject<HTMLDivElement>;
  title: string;      // 리그 이름
  timeLeft: number;   // 남은 초
  bonusTime: number;  // 시간연장 누적 초(0 이면 표시 안 함)
  score: number;
  combo: number;
  comboMul: number;   // 콤보 배수(0 이면 표시 안 함)
  hp: number;
  maxHp: number;
  shields: number;
  muted: boolean;
  onHome: () => void;
  onToggleMute: () => void;
  /** 소리 조절 판 조작이 끝났을 때 — 게임 입력칸에 포커스를 돌려준다(안 돌려주면 다음 첫 글자가 버려진다). */
  onSoundMenuDone?: () => void;
  /** 로그인·내 정보 칩. 교실 모드처럼 계정을 권하지 않는 화면에서는 넘기지 않는다. */
  userLabel?: string;
  onUser?: () => void;
  /** 진행 중인 친구초대 이벤트 칩(있을 때만). */
  eventLabel?: string | null;
  onEvent?: () => void;
}

const LOW_TIME_SEC = 10;
const HOT_COMBO = 5;

function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const ICON_HEART = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
const ICON_HOME = 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z';

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  );
}

// 게임 중에는 입력칸이 포커스를 쥐고 있어야 한다 — 버튼을 눌러도 포커스를 뺏지 않는다
const keepInputFocus = (e: MouseEvent) => e.preventDefault();

export default function HeistHud({
  rootRef, speedFillRef, title, timeLeft, bonusTime, score, combo, comboMul, hp, maxHp, shields, muted,
  onHome, onToggleMute, onSoundMenuDone, userLabel, onUser, eventLabel, onEvent,
}: HeistHudProps) {
  const { t } = useTranslation();
  const hearts = Array.from({ length: maxHp }, (_, i) => i < hp);

  return (
    <div ref={rootRef} className="heist-hud">
      <div className="heist-row1">
        <button type="button" className="heist-iconbtn" onMouseDown={keepInputFocus} onClick={onHome} title={t('game.quit')} aria-label={t('game.quit')}>
          <Icon d={ICON_HOME} />
        </button>
        <h1 className="heist-title">{title}</h1>
        <div className="heist-spacer" />
        <div className="heist-pill" role="timer">
          <span className="heist-pill-label">TIME</span>
          <span className={`heist-pill-value${timeLeft <= LOW_TIME_SEC ? ' is-low' : ''}`}>
            {formatClock(timeLeft)}
            {bonusTime > 0 && <span className="heist-pill-bonus">+{bonusTime}</span>}
          </span>
        </div>
        <div className="heist-pill">
          <span className="heist-pill-label">SCORE</span>
          <span className="heist-pill-value">{score.toLocaleString()}</span>
        </div>
        <div className="heist-spacer" />
        <HeistSoundMenu muted={muted} onToggleMute={onToggleMute} onDone={onSoundMenuDone} />
        {eventLabel && onEvent && (
          <button type="button" className="heist-chip heist-chip--event" onMouseDown={keepInputFocus} onClick={onEvent}>
            🤝 {eventLabel}
          </button>
        )}
        {userLabel && onUser && (
          <button type="button" className="heist-chip" onMouseDown={keepInputFocus} onClick={onUser}>
            {userLabel}
          </button>
        )}
        <img className="heist-wordmark" src="/heist/ui/title_logo.webp" width={1266} height={522} alt="" aria-hidden draggable={false} />
      </div>

      <div className="heist-row2">
        <div className="heist-speed" aria-hidden>
          <span className="heist-speed-label">
            <span className="heist-speed-dial">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
                <path d="M4.5 16a7.5 7.5 0 1 1 15 0" />
                <path d="m12 16 3.5-5" stroke="#E63A58" />
              </svg>
            </span>
            SPEED
          </span>
          <div className="heist-speed-track">
            <div ref={speedFillRef} className="heist-speed-fill" />
          </div>
        </div>
        <div className={`heist-combo${combo >= HOT_COMBO ? ' is-hot' : ''}`}>
          <span className="heist-combo-tag">COMBO</span>
          <span>{combo}</span>
          {comboMul > 0 && <small>x{comboMul.toFixed(1)}</small>}
        </div>
        <div className="heist-spacer" />
        {shields > 0 && <span className="heist-shield" aria-label={`shield ${shields}`}>🛡 {shields}</span>}
        <div className="heist-hearts" role="img" aria-label={`HP ${hp}/${maxHp}`}>
          {hearts.map((filled, i) => (
            <span key={i} className={`heist-heart${filled ? '' : ' is-empty'}`}>
              <Icon d={ICON_HEART} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
