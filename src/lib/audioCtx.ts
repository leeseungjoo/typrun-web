// 합성 소리(효과음 heistSfx · 배경음 chipBgm)가 같이 쓰는 WebAudio 장치 하나.
// 브라우저는 사용자 입력(클릭·키) 처리 중에만 소리 시작을 허락하므로, 멈춰 있으면 부를 때마다 깨우기를 시도한다.

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

/** 소리 장치를 돌려준다(없으면 만든다). 소리를 못 내는 환경이면 null — 게임 진행에는 영향 없다. */
export function getAudioContext(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor: AudioContextCtor | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    // 자동재생 정책으로 멈춰 있으면 깨운다(suspended 뿐 아니라 사파리의 interrupted 도 포함)
    if (ctx.state !== 'running' && ctx.state !== 'closed') void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}
