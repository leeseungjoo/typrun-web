// 도둑 런 씬 — 밤 도시를 달리는 도둑(판정에 관여하지 않는 그림 레이어).
// 구도·속도는 자사 올리브영 타자게임의 설계 수치를 따른다(heistConfig). 정답 = 점프 + 영구 가속 + 전리품,
// 미스 = 넘어짐 + 속도 리셋 + 경광등, 체력 = 뒤쫓는 경비원과의 거리.
//
// 사용 예
//   <HeistScene hp={hp} maxHp={8} correct={correct} miss={miss} />                      // 최소
//   <HeistScene hp={hp} maxHp={8} correct={correct} miss={miss} combo={combo}
//               bursts={bursts} speedFillRef={speedFillRef} hasSound />                 // 전체
import { memo, useEffect, useRef, useState, type RefObject } from 'react';
import { createHeistEngine, type HeistEngine } from './heistEngine';
import { loadHeistAssets, peekHeistAssets, type HeistCast } from './heistAssets';
import { heistSfx } from '../../../lib/heistSfx';

/** 정답이 터진 자리. x·y 는 씬 영역 대비 % 좌표, id 는 증가하는 고유값. */
export interface HeistBurst {
  id: number;
  x: number;
  y: number;
}

interface HeistSceneProps {
  hp: number;
  maxHp: number;
  correct: number; // 누적 정답 수 — 늘면 점프 + 가속
  miss: number;    // 누적 미스 수 — 늘면 넘어짐 + 속도 리셋
  combo?: number;  // 현재 콤보 — 3 이상이면 점선 꼬리(기본 0)
  bursts?: readonly HeistBurst[]; // 새 항목이 생기면 그 자리에서 전리품이 날아든다(기본 없음)
  /** 속도 게이지 채움 요소. 씬이 매 프레임 scaleX 로 직접 갱신한다(리렌더 없음). */
  speedFillRef?: RefObject<HTMLElement>;
  /** 점프·경광등 소리를 낼지(기본 false). 게임 화면만 켠다 — 메인의 데모 씬은 조용해야 한다. */
  hasSound?: boolean;
  /** 캐릭터 쌍(기본 'thief' = 도둑 ← 경비원). 리그에 따라 학생·병아리·신부로 바꾼다. */
  cast?: HeistCast;
}

const MAX_DPR = 1.5; // 풀스크린 캔버스라 고해상도 화면에서도 픽셀 수를 제한

export default memo(function HeistScene({ hp, maxHp, correct, miss, combo = 0, bursts, speedFillRef, hasSound = false, cast = 'thief' }: HeistSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<HeistEngine | null>(null);
  const prevCorrectRef = useRef(correct);
  const prevMissRef = useRef(miss);
  const lastBurstIdRef = useRef(0);
  // 그림을 다 받기 전에는 아무것도 그리지 않는다 — 받기 전 한순간 임시 도형("그림 자리" 표시·코드로 그린 건물)이
  // 보이던 것을 막는다(2026-11-17 사장: 메인에 처음 들어가면 그게 떠 있다). 다 받으면 부드럽게 나타난다.
  // 이미 받아 둔 그림이면(메인·카운트 화면에서 넘어온 경우) 처음부터 보인다 — 화면이 바뀔 때마다 비었다 나타나지 않게.
  const [isLoaded, setIsLoaded] = useState(() => peekHeistAssets(cast) !== null);
  const isLoadedRef = useRef(isLoaded);

  // 엔진 생성 + 그리기 루프 (다른 effect 보다 먼저 선언 — 마운트 시 엔진이 먼저 준비돼야 한다)
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const engine = createHeistEngine(ctx, { reduced });
    engineRef.current = engine;

    const fit = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      engine.resize(w, h, dpr);
    };
    const ro = new ResizeObserver(fit);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    fit();

    let raf = 0;
    let shownRatio = -1;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!isLoadedRef.current) return; // 그림을 받는 중 — 캔버스는 비워 둔다
      const ratio = engine.frame(now);
      const fill = speedFillRef?.current;
      if (fill && Math.abs(ratio - shownRatio) > 0.004) {
        shownRatio = ratio;
        fill.style.transform = `scaleX(${ratio.toFixed(3)})`;
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      engineRef.current = null;
      isLoadedRef.current = false;
    };
  }, [speedFillRef]);

  // 그림 받기 — 배경은 한 번, 캐릭터 쌍은 cast 가 바뀔 때마다(엔진 생성 effect 다음에 선언해야 engineRef 가 준비돼 있다)
  useEffect(() => {
    let alive = true;
    const apply = (assets: Awaited<ReturnType<typeof loadHeistAssets>>) => {
      if (!alive) return;
      engineRef.current?.setAssets(assets);
      isLoadedRef.current = true;
      setIsLoaded(true);
    };
    const ready = peekHeistAssets(cast);
    if (ready) apply(ready); // 첫 프레임을 그리기 전에 바로 넣는다
    else loadHeistAssets(cast).then(apply);
    return () => {
      alive = false;
    };
  }, [cast, speedFillRef]);

  // 소리를 내는 화면이면 첫 키·터치 입력에서 소리 장치를 깨운다(시작 버튼을 거치지 않고 주소로 바로 들어온 경우 대비)
  useEffect(() => {
    if (!hasSound) return;
    const wake = () => heistSfx.unlock();
    window.addEventListener('keydown', wake, { once: true });
    window.addEventListener('pointerdown', wake, { once: true });
    return () => {
      window.removeEventListener('keydown', wake);
      window.removeEventListener('pointerdown', wake);
    };
  }, [hasSound]);

  useEffect(() => {
    engineRef.current?.setStatus(hp, maxHp, combo);
  }, [hp, maxHp, combo]);

  useEffect(() => {
    const gained = correct - prevCorrectRef.current;
    prevCorrectRef.current = correct;
    if (gained <= 0) return;
    engineRef.current?.onCorrect(gained);
    if (hasSound) heistSfx.jump();
    // hasSound 는 화면마다 고정값 — 정답 수가 늘 때만 돈다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correct]);

  useEffect(() => {
    const lost = miss - prevMissRef.current;
    prevMissRef.current = miss;
    if (lost <= 0) return;
    engineRef.current?.onMiss();
    if (hasSound) heistSfx.siren();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miss]);

  useEffect(() => {
    if (!bursts) return;
    for (const b of bursts) {
      if (b.id <= lastBurstIdRef.current) continue;
      lastBurstIdRef.current = b.id;
      engineRef.current?.spawnLoot(b.x, b.y, combo);
    }
    // combo 는 조각 수에만 쓰인다 — 콤보 변화만으로 다시 돌 필요 없다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bursts]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none select-none transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
      aria-hidden
    />
  );
});
