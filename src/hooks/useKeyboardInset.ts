import { useEffect, useState } from 'react';

/**
 * 모바일 온스크린 키보드가 화면 하단을 가리는 높이(px)를 추적한다.
 * visualViewport(시각 뷰포트)는 키보드가 올라오면 줄어들지만, 레이아웃 뷰포트(window.innerHeight)와
 * position:fixed 기준은 그대로라 fixed 하단 요소가 키보드 뒤로 숨는다. 그 차이를 inset 으로 돌려주면
 * 하단 입력/버튼을 translateY 로 키보드 위까지 들어올릴 수 있다.
 *
 * - visualViewport 미지원 환경에선 0(영향 없음).
 * - 작은 흔들림은 무시(임계값)해서 불필요한 리렌더/덜컥임 방지.
 */
export function useKeyboardInset(threshold = 120): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // 레이아웃 뷰포트 대비 시각 뷰포트가 줄어든 만큼 = 키보드(또는 기타 UI)가 가린 높이(근사).
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      // 임계값 미만(주소창 변화 등)은 0 으로 — 키보드가 실제로 올라왔을 때만 반응.
      setInset(covered > threshold ? Math.round(covered) : 0);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [threshold]);

  return inset;
}

/**
 * 보이는 시각 뷰포트의 위치/높이(px). 전체화면 게임 컨테이너를 이 박스 크기로 고정하면
 * 키보드가 올라와도 (HUD·낙하시작점·입력칸이) 모두 보이는 영역 안에 들어와 iOS 문서 스크롤이 안 일어난다.
 * visualViewport 미지원 시 null → 호출부에서 100vh 폴백.
 */
export function useVisualViewportBox(): { top: number; height: number } | null {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setBox({ top: Math.round(vv.offsetTop), height: Math.round(vv.height) });
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return box;
}
