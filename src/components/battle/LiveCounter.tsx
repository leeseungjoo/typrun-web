import { useEffect, useState } from 'react';
import { battleApi } from '../../api/battle';
import type { BattleStatus } from '../../api/types';

const POLL_MS = 5000;

interface LiveCounterProps {
  categorySeq: number;
  className?: string;
}

// 리그별 게임중/대기중 실시간 카운터(폴링).
// - 5s 단일 타이머 체인. 탭 비활성 시 네트워크 스킵, 복귀 시 즉시 1회 갱신.
// - 에러는 직전값 유지(throw 안 함) — 카운터가 페이지를 깨면 안 됨.
export default function LiveCounter({ categorySeq, className = '' }: LiveCounterProps) {
  const [status, setStatus] = useState<BattleStatus | null>(null);

  useEffect(() => {
    // effect 호출마다 독립 클로저 — categorySeq 변경 시 구 루프가 setState/재예약 못 하게 격리.
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const fetchOnce = async () => {
      try {
        const s = await battleApi.status(categorySeq);
        if (alive) setStatus(s);
      } catch {
        // 직전값 유지
      }
    };

    const loop = async () => {
      if (document.visibilityState === 'visible') await fetchOnce();
      if (alive) timer = setTimeout(loop, POLL_MS);
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      // 대기 중 타이머를 취소하고 즉시 1회 + 재예약 — 복귀 fetch와 loop 타이머의 이중 호출 방지.
      if (timer) clearTimeout(timer);
      void loop();
    };

    void loop();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [categorySeq]);

  const playing = status?.playing ?? 0;
  const waiting = status?.waiting ?? 0;
  const live = status !== null && !status.degraded;

  return (
    <div className={`flex items-center gap-1.5 text-xs text-white/55 ${className}`}>
      {/* ambient 정보라 aria-live 미사용(5s 폴링마다 재낭독 방지). 상태/색은 dot, degraded 는 sr-only 텍스트로 보조. */}
      <span className="relative flex h-2 w-2" aria-hidden>
        {live && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/60 animate-ping" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${live ? 'bg-emerald-400' : 'bg-white/30'}`}
        />
      </span>
      {!live && <span className="sr-only">접속 정보 연결 지연 — 최근값 표시 중. </span>}
      <span>
        게임중 <b className="text-white/85 font-semibold tabular-nums">{playing}</b>
      </span>
      <span className="text-white/25" aria-hidden>
        ·
      </span>
      <span>
        대기중 <b className="text-white/85 font-semibold tabular-nums">{waiting}</b>
      </span>
    </div>
  );
}
