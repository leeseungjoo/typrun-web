// 도둑 런 사이트 배경 — 화면 성격에 따라 넷으로 나뉜다(2026-11-17 사장).
//   run   = 대기화면(메인)·종료화면: 게임 씬이 스스로 달리는 "달리는 화면"
//   page  = 사이 화면(리그·랭킹·프로필·로그인 등): 별 바탕 + 키아트(별빛 아래 도둑 추격전), 글이 읽히게 한 겹 덮는다
//   quiet = 글·떨어지는 단어가 주인공인 화면(타자 테스트·배틀·탭 러너·약관): 키아트를 거의 가린다
//   none  = 게임 화면: 자기 씬(준비 단계 포함)을 직접 그리므로 바탕색만
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import HeistDemoScene from './HeistDemoScene';
import { readLastCast } from '../game/heist/heistCast';
import './heistMenu.css';

const KEYART_SRC = '/heist/bg/keyart.webp';
const STAR_COUNT = 44;
const SKY_BOTTOM_PCT = 48; // 그림에서 하늘이 끝나는 높이(%). 별은 이 위에만 뿌린다

export type BackdropTone = 'run' | 'page' | 'quiet' | 'none';

// 떨어지는 단어·긴 글을 읽어야 하는 화면 — 그림이 방해되지 않게 거의 가린다
const QUIET_PREFIXES = ['/test', '/race', '/battle', '/tap', '/privacy', '/terms', '/draw'];
const GAME_OVER_PATH = '/game-over';

export function backdropTone(pathname: string): BackdropTone {
  if (pathname === '/' || pathname.startsWith(GAME_OVER_PATH)) return 'run';
  if (pathname.startsWith('/game/')) return 'none'; // '/game-over' 는 위에서 먼저 걸린다
  return QUIET_PREFIXES.some((p) => pathname.startsWith(p)) ? 'quiet' : 'page';
}

interface BackdropStar {
  left: number; // %
  top: number; // %
  size: number; // px
  dur: number; // s
  delay: number; // s (음수 — 첫 프레임부터 제각각 반짝이게)
  max: number; // 최대 밝기
}

function buildStars(): BackdropStar[] {
  return Array.from({ length: STAR_COUNT }, () => {
    const dur = 3 + Math.random() * 5;
    return {
      left: Math.random() * 100,
      top: Math.random() * SKY_BOTTOM_PCT,
      size: Math.random() < 0.18 ? 3 : Math.random() < 0.5 ? 2 : 1.5,
      dur,
      delay: -Math.random() * dur,
      max: 0.45 + Math.random() * 0.5,
    };
  });
}

export default function HeistBackdrop() {
  const { pathname } = useLocation();
  const tone = backdropTone(pathname);

  if (tone === 'none') return <div className="hm-backdrop" data-tone="none" aria-hidden="true" />;

  if (tone === 'run') {
    const isGameOver = pathname.startsWith(GAME_OVER_PATH);
    const mood = isGameOver ? 'chased' : 'attract';
    // 종료화면은 방금 한 리그의 캐릭터가 쫓기는 장면, 메인은 언제나 도둑
    const cast = isGameOver ? readLastCast() : 'thief';
    return (
      <div className="hm-backdrop" data-tone="run" aria-hidden="true">
        {/* key = 분위기가 바뀌면 씬을 새로 시작한다(가짜 카운터가 이어지면 꼬리와 넘어짐이 어긋난다) */}
        <HeistDemoScene key={mood} mood={mood} cast={cast} />
        <div className="hm-backdrop-veil" />
      </div>
    );
  }

  return <KeyArtBackdrop tone={tone} />;
}

function KeyArtBackdrop({ tone }: { tone: 'page' | 'quiet' }) {
  const stars = useMemo(buildStars, []);
  // 그림을 못 받으면(오프라인·경로 오류) 깨진 그림 표시 대신 밤하늘 바탕만 남긴다
  const [isArtBroken, setIsArtBroken] = useState(false);

  return (
    <div className="hm-backdrop" data-tone={tone} aria-hidden="true">
      {!isArtBroken && (
        <img className="hm-backdrop-art" src={KEYART_SRC} alt="" decoding="async" draggable={false} onError={() => setIsArtBroken(true)} />
      )}
      {stars.map((s, i) => (
        <span
          key={i}
          className="hm-star"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            ['--hm-star-dur' as string]: `${s.dur}s`,
            ['--hm-star-delay' as string]: `${s.delay}s`,
            ['--hm-star-max' as string]: `${s.max}`,
          }}
        />
      ))}
      <div className="hm-backdrop-veil" />
    </div>
  );
}
